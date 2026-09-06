# Implementation Plan — Zoho Inventory → App Sync (Model A, one-way pull)

> Spec: `spec.md` rev 2 (spec gate PASS). Direction is **one-way Zoho → app**; the existing app→Zoho
> push is retired. Backend + small super-admin UI. Ships **dry-run first, disabled by default**.
> Built against an **injectable fetch** so vitest drives it deterministically (no live Zoho in CI).

## Design in one screen
```
scheduled(controller)                POST /api/integrations/zoho/sync (super-admin)
   │ branch on controller.cron          │  {mode?, full?}
   ├ "30 3 * * *"  → runZohoSync(full)   ├ full:true → ctx.waitUntil(runZohoSync(full)) → job id
   └ else          → runZohoSync(delta)  └ else      → await runZohoSync(delta) → summary
   (still runs fixCategoryNames + runDeliveryReminders)

runZohoSync(env, {full, mode?, actor, fetchImpl}):
  0. if zoho_sync_enabled!="1"        → log "disabled", return (NO network)
  1. acquire CAS lock (run-token)     → if taken → return {status:"skipped"}   [finally: release]
  2. token = getAccessToken()         → refresh-token flow, cached; invalid_grant → error row, return
  3. pages = fetchAllItems(...)       → buffer ALL pages; verify completeness; any error → abort (no writes)
  4. rows  = pages.map(mapZohoItem)   → resolver R1; skip blank sku (count error)
  5. mode==="dryrun" → compute diff, log import_jobs, return (advance NOTHING)
  6. live: upsertInventoryRows(rows)  → shared writer; stock←stock_on_hand; sets zoho_item_id/zoho_synced_at
  7. full & complete & <10%           → soft-deactivate absent zoho-origin SKUs
  8. success → advance cursor (delta) / set zoho_last_full_at (full); log import_jobs
```

## Execution groups (each: build → typecheck → test → commit)

### G1 — Schema + provenance (migration, self-heal, Env)
- `migrations/0035_zoho_sync.sql`: `ALTER TABLE inventory ADD COLUMN zoho_item_id TEXT;`
  `ALTER TABLE inventory ADD COLUMN zoho_synced_at TEXT;` (guarded, matching existing style).
- `src/index.ts` self-heal block (~438/535 region): add the two columns idempotently
  (`ALTER … ` in try/catch, mirroring how other late columns are ensured).
- `src/types.ts` `Env`: add `ZOHO_CLIENT_ID?`, `ZOHO_CLIENT_SECRET?`, `ZOHO_REFRESH_TOKEN?`,
  `ZOHO_DC?` (keep existing `ZOHO_INVENTORY_ORG_ID?`, `ZOHO_ACCESS_TOKEN?`).
- **AC:** tsc clean; columns present in a fresh test D1 (vitest applies migrations).

### G2 — Shared upsert writer (factor from handleImportInventory)
- Extract the SKU-keyed, data-loss-safe upsert core of `handleImportInventory` (5536) into
  `async function upsertInventoryRows(env, rows, opts)` returning `{written, errors}`.
  - `opts.extraCols`: allow the sync to also write `zoho_item_id`, `zoho_synced_at`, `active` (which
    the CSV `IMP_SPEC` doesn't include). Column names stay from a fixed whitelist (never row keys).
  - `handleImportInventory` now calls `upsertInventoryRows` (behavior unchanged — regression covered by
    the existing round-trip vitest).
- **AC:** existing inventory round-trip + partial-preimport tests stay green.

### G3 — Zoho client (token + fetch + map), injectable
- `zohoTokenGet(env, fetchImpl)`: refresh-token exchange at `accounts.zoho.<dc>/oauth/v2/token`,
  cache in `app_config` (`zoho_token`/`zoho_token_exp`), reuse until `TOKEN_SKEW`. `invalid_grant`/4xx
  → throw a typed `ZohoAuthError` (caller turns it into an error row, no cursor advance). Never log token.
- `zohoFetchItems(env, token, {modifiedSince?, page}, fetchImpl)`: `GET
  zohoapis.<dc>/inventory/v1/items?organization_id=…&per_page=200&page=…` (+ `last_modified_time` for
  delta); retry 429/5xx per R4 (honour `Retry-After`); returns `{items, page_context}`.
- `mapZohoItem(z)`: R1 resolver → app row; returns `null` (and reason) for blank sku. UTC-epoch helper
  `toEpoch(iso)` for `last_modified_time`. Weight via `WEIGHT_UNITS`.
- **AC:** unit tests: resolver vs fixture; toEpoch on offset ISO; blank-sku→null; retry stops after
  `MAX_RETRIES`.

### G4 — Orchestrator `runZohoSync` (the core; plain async, injectable fetch)
- Kill-switch first (no network). CAS lock via
  `UPDATE app_config SET value=? WHERE key='zoho_sync_lock' AND (value='' OR value < staleThreshold)`
  using rows-affected; run-token; `finally` release. Buffer-all-pages → completeness gate
  (`has_more==false ∧ count==total_count ∧ 0 errors`, else abort no-write). Delta lower bound
  `max(cursor−OVERLAP, cursor−OVERLAP_CAP)`; first-run (empty cursor) bootstraps full. Dry-run: diff +
  `import_jobs`, advance nothing. Live: `upsertInventoryRows`; full+complete+≤`MAX_DEACTIVATE_PCT` →
  `UPDATE inventory SET active=0 WHERE zoho_synced_at IS NOT NULL AND sku NOT IN (fetched)`. Advance
  cursor / `zoho_last_full_at` only on run-success (AC9). Always write one `import_jobs` row
  (`type='zoho-sync'`, mode+scope marker, counts, bounded errors; `created_by` = actor|'system').
  Non-throwing.
- **AC (vitest, injected fetch):** cursor-advance-only-on-success; dry-run writes+advances nothing;
  mid-fetch error → zero writes + cursor held; provenance deactivate on full; >10% abort; blank-sku
  skip; disabled → zero fetch calls; lock contention → skipped.

### G5 — Retire the app→Zoho push
- Remove `pushItemToZoho` + `runZohoInventorySync` (247–264) or convert to a no-op returning
  `{disabled:true}`. Repoint `handleZohoInvSync` (297) at the **pull** (`runZohoSync`), super-admin only.
- **AC:** a test asserts no outbound POST to Zoho `items` on any sync path (injected fetch records
  calls; only OAuth token + `GET items` allowed).

### G6 — Cron wiring + manual endpoint
- `scheduled()` (701): branch on `_controller.cron` (rename to `controller`) → `runZohoSync` full/delta
  inside the SAME `ctx.waitUntil`, AFTER the preserved `fixCategoryNames` + `runDeliveryReminders`.
- Route: keep `POST /api/integrations/zoho-inventory/sync` (already registered, super-admin) but its
  handler now runs the pull; add optional `{mode, full}`. `full:true` → `ctx.waitUntil` + return job id;
  else await + return summary. Locked → 409 `{status:'skipped'}`.
- `handleZohoInvStatus` (266): report R2 state (mode, cursor as UTC, enabled, last run, staleness).
- `wrangler.jsonc` (20): `triggers.crons: ["30 3 * * *", "0 */3 * * *"]`.
- **AC:** vitest: 403 for non-super-admin; delta inline summary; nightly cron calls full AND still runs
  delivery reminders. tsc clean.

### G7 — Super-admin UI (Import → Inventory)
- `public/app.11-vendor-portal-features.js`: add a "Zoho Inventory sync" panel (super_admin only,
  same gate as inventory import) showing status + `[Sync now]` `[Full reconcile]` + mode select +
  enable toggle. New `dataAct` targets are real globals: `zohoSyncNow()`, `zohoFullReconcile()`,
  `zohoToggleSync()`, `zohoSetMode()` → hit the endpoints and re-render status.
- **AC:** `test:smoke` + `test:phase2` green (every new `dataAct` target resolves).

### G8 — Validate + commit + push
- `npx tsc --noEmit`, `npx vitest run`, `node test/smoke.mjs`, `node test/phase2.mjs` all green.
- Commit per group; push `claude/phase-2-consolidation-34ggxj`.

## Risk register (from spec gate, mapped to guards)
- Destructive stock overwrite → dry-run default + complete-fetch-before-write + buffer-then-write.
- Mass wrongful deactivation → provenance scope + completeness gate + 10% valve.
- Overlapping cron runs → CAS lock + idempotent upsert.
- Watermark drift → UTC epoch + OVERLAP + OVERLAP_CAP + advance-only-on-success.
- Accidental push to Zoho → G5 removes the push; test asserts no outbound write.

## Plan gate
Direct translation of a gate-passed spec; each group carries its own executable AC and commits behind
`tsc`+`vitest`+`smoke`+`phase2`. Adversarial spec review already drove rev2; the plan introduces no new
external assumptions (all field names resolver-isolated + dry-run-confirmed). Proceeding to construction
per the user's explicit "go", shipping disabled + dry-run so the first live write is a deliberate admin action.
