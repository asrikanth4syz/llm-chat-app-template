# Context Report: 002-zoho-inventory-sync

> Milestone: one-way **Zoho Inventory → SmartPantry** inventory sync. **Model A** (Zoho is the
> stock authority: each sync overwrites app `inventory.stock` with Zoho's on-hand). Cadence:
> **every-3-hours delta + nightly full reconcile**. Super-Admin gated. Dry-run first.

## Affected Domain
Backend-only (Cloudflare Worker `src/index.ts`) plus a small super-admin UI surface in the existing
Import → Inventory tab. No new datastore — reuse D1 `inventory`, `app_config`, `import_jobs`.

## Existing Patterns (anchors this must reuse — with evidence)
- **Cron / scheduled handler:** `export default { scheduled(_controller, env, ctx) {...} }`
  (`src/index.ts:701`). Currently runs `fixCategoryNames` + `runDeliveryReminders` via
  `ctx.waitUntil`. `_controller.cron` is **unused** — the branch point for delta-vs-full.
  Cron schedule in `wrangler.jsonc:20` = `["30 3 * * *"]` (daily 03:30 UTC / 09:00 IST).
- **Config store (watermark / token cache / kill-switch):** `getConfig(env,key,dflt)` /
  `setConfig(env,key,value,actor)` over the `app_config` key/value table
  (`src/index.ts:181-192`). Same table backs `po_seq`.
- **Import job log (reuse for sync runs):** `import_jobs (id,type,total,success_count,failed_count,
  errors,created_by)` (`migrations/0003_features.sql:35`, self-heal create at `src/index.ts:538`);
  surfaced in the Import → **Import History** tab (`renderImportData`, app.11). A sync run logs a
  row with `type='zoho-sync'`.
- **SKU-keyed, data-loss-safe upsert (the writer to reuse):** `handleImportInventory`
  (`src/index.ts:5536`) now upserts every inventory-template column, updating only columns the
  payload provides (just shipped in PR #24). This logic should be **factored into a shared
  `upsertInventoryRows(env, rows)`** and called by both CSV import and the Zoho sync.
- **Existing Zoho scaffolding:** `syncToZohoBooks(env, invoice)` stub (`src/index.ts:169`) is the
  pattern (secret-gated, no-op when unset). The **`Env` interface already declares**
  `ZOHO_INVENTORY_ORG_ID?`, `ZOHO_ACCESS_TOKEN?`, `ZOHO_INVENTORY_WEBHOOK_SECRET?`
  (`src/types.ts`), plus `ZOHO_BOOKS_*`. **Missing for OAuth refresh:** `ZOHO_CLIENT_ID`,
  `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, and a `ZOHO_DC` (data-center: `in`).
- **Route table:** flat `if (path===... && method===...)` list; add `POST /api/integrations/zoho/sync`
  (super-admin) for "Sync now" near the other admin POSTs.
- **Role gating precedent:** inventory import is now **super_admin only** (endpoint + UI), PR #24.
  The sync trigger + status must match.
- **Outbound fetch:** the Worker already calls external APIs via `fetch` (MSG91, MailChannels,
  Zoho Books stub) — same mechanism for Zoho Inventory (`https://www.zohoapis.in/inventory/v1/...`,
  token from `https://accounts.zoho.in/oauth/v2/token`).

## Dependencies & Integration Points
- **Zoho Inventory REST API** (data center `.in`): OAuth2 (refresh_token → 1 h access_token);
  `GET /inventory/v1/items?organization_id=…` with pagination (`page`, `per_page` ≤ 200) and a
  `last_modified_time` filter for delta. Rate-limited (per-minute + daily credits).
- **D1 `inventory`** — target table (PK `sku`). **Model A:** `stock ← stock_on_hand`.
- **`app_config`** — keys: `zoho_sync_cursor` (watermark), `zoho_token`/`zoho_token_exp` (cache),
  `zoho_sync_enabled` (kill switch), `zoho_sync_mode` (`dryrun`|`live`).
- **`import_jobs`** — per-run audit.
- **Secrets** (Worker, not code): `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN/INVENTORY_ORG_ID`, `ZOHO_DC=in`.

## Existing Tests
- `test/index.test.ts` (vitest + workers pool + throwaway D1) — 151 tests incl. the new inventory
  round-trip + super-admin 403. **Vitest runs in this sandbox** (confirmed). Zoho's live API is NOT
  reachable here, so the sync must be built against an **injectable/mockable fetch** so tests can
  drive mapping, upsert, watermark and failure paths deterministically. Cron `scheduled()` has no
  test today — the sync logic should live in a plain async function callable directly from a test.
- Frontend gates: `test/smoke.mjs`, `test/phase2.mjs` (any new `dataAct` target must resolve).

## Constraints & Risks
- **No live Zoho in CI/sandbox** → hard dependency on a mockable client + a **dry-run mode** that
  writes nothing, so the mapping is validated against real data before the first write.
- **Model-A stock overwrite is destructive by design** — a sync can clobber app-side stock. Risks:
  (a) racing an in-flight order/GRN; (b) a bad/partial Zoho page zeroing stock. Mitigations the spec
  must pin: only write from a *successful, complete* fetch; never treat "item absent from a delta
  page" as stock 0; consider not overwriting `stock` for items with active reservations, or accept
  Zoho-wins per Model A (product decision).
- **Watermark correctness:** advance the cursor **only after a fully successful run**; store Zoho's
  server time, mind the timezone/`last_modified_time` format; a crash mid-run must safely re-pull
  (idempotent via SKU upsert). Overlap the delta window slightly to avoid missed edits at boundaries.
- **Deletions/deactivations:** a delta pull won't report deletes. The nightly **full** reconcile must
  soft-deactivate (`active=0`) SKUs no longer in Zoho — **never hard-delete** (orders/DCs reference them).
- **Token cache races:** two overlapping cron runs could both refresh; cache token in `app_config`
  with expiry and tolerate double-refresh (idempotent). Guard against overlapping runs (a lock flag /
  skip-if-running).
- **Rate limits:** paginate with back-off on HTTP 429; cap pages per run; a full reconcile of a large
  catalogue may need chunking across invocations.
- **Cron semantics:** all cron expressions fire the same `scheduled()`; branch on `controller.cron`
  (`"0 */3 * * *"` delta vs `"30 3 * * *"` full). Cloudflare fires crons at least once; make the run
  idempotent and non-overlapping.
- **Secret handling:** never log tokens; the Books stub's "log intent when unset" pattern is fine for
  a no-op/dry state but must not print secrets.
- **SKU is the join key:** assumes Zoho item `sku` === app `sku`. Items with a blank Zoho SKU must be
  skipped and reported, not imported under an empty key.
- **Field-name uncertainty:** exact Zoho fields (`stock_on_hand` vs `available_stock`, mrp/brand as
  custom fields, tax percentage) confirmed only against a live sample — dry-run surfaces this.

## Key Files
| Path | Why |
|---|---|
| `src/index.ts` | `scheduled()` (701), `getConfig`/`setConfig` (181), `syncToZohoBooks` stub (169), `handleImportInventory` upsert (5536), route table, `import_jobs` writer |
| `src/types.ts` | `Env` (already has `ZOHO_INVENTORY_ORG_ID`/`ZOHO_ACCESS_TOKEN`/`ZOHO_INVENTORY_WEBHOOK_SECRET`); add OAuth secrets |
| `wrangler.jsonc` | `triggers.crons` (20) — add the 3-hourly delta cron alongside the nightly |
| `public/app.11-vendor-portal-features.js` | Import → Inventory tab (super-admin) — add "Sync now" + status |
| `test/index.test.ts` | vitest — add mocked-Zoho sync tests |
| `migrations/0003_features.sql` | `import_jobs` schema |

## Bottom line for Discovery
The platform is well-shaped for this: a cron handler, a config store, a job log, and a hardened
SKU-upsert already exist, and the `Env` even pre-declares Zoho Inventory fields. The spec's real work
is **the sync semantics under Model A** — watermark correctness, complete-fetch-before-write,
deletion reconcile via the nightly full, overlap/idempotency, dry-run rollout, and the destructive
stock-overwrite guardrails — not plumbing. Frequency is decided: **`0 */3 * * *` delta + `30 3 * * *`
full**. Auth is OAuth refresh-token (add secrets); a static `ZOHO_ACCESS_TOKEN` may serve dry-run.
