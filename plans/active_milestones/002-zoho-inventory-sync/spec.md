# Product Specification: Zoho Inventory → App Sync (Model A) — rev 2

> One-way pull from **Zoho Inventory** into SmartPantry's `inventory` table. **Zoho is the stock
> authority (Model A).** Backend + a small super-admin UI. Ships **dry-run first**. Auth = OAuth2
> refresh-token. Cadence = **delta every 3h + nightly full reconcile**.
>
> **rev 2** folds the spec-validator's 2-of-3 verdict (14 confirmed findings). The two items the
> validator flagged as needing an external decision were resolved **from the source**, not by
> guessing — see "Resolved decisions" below.

## ✅ Resolved decisions (were "blocked", now pinned from code)

**D1 — Model-A stock policy → `stock ← stock_on_hand`, `reserved` is never written by the sync.**
The app mutates stock as follows (verified): order **placement** only reserves
(`UPDATE inventory SET reserved=MIN(stock,reserved+?)`, src/index.ts:2054/2108) — it does **not**
decrement `stock`. `stock` decrements only on **physical dispatch** (3178/3281) and increments on
**return** (3557), each paired with a `reserved` release. So `stock` is a *physical on-hand* number,
exactly what Zoho's `stock_on_hand` is. Overwriting `stock ← stock_on_hand` while leaving `reserved`
untouched is therefore coherent and **cannot cause an oversell-on-placement race** (placement never
touched stock). Available-to-promise stays `stock − reserved`, now with Zoho's on-hand as the base.
*Residual, accepted by Model A:* if the app dispatches goods and Zoho has not yet recorded that
dispatch, the next sync re-inflates `stock` to Zoho's (stale) on-hand. This is inherent to
"Zoho owns stock" with no write-back; write-back is explicitly out of scope (later milestone). No
`reserved`-aware carve-out is added — it would contradict Model A and is unnecessary given placement
never decrements stock. (A config escape hatch `zoho_stock_policy` is provided in R2 for future use,
defaulting to `authoritative`.)

**D2 — deactivation provenance + field names.** App-native SKUs **do** exist (CSV import creates
them), so the nightly reconcile must never deactivate a non-Zoho SKU. New columns `zoho_item_id` /
`zoho_synced_at` mark provenance; only rows with `zoho_synced_at IS NOT NULL` are deactivation
candidates. Exact Zoho field names are built into one **resolver** against the documented Zoho
Inventory `items` API and **confirmed by the dry-run** before any live write (that is what dry-run is
for). The resolver is the single place to adjust if a captured sample differs; tests assert against a
fixture shaped like the documented response.

## 🎯 Executive Summary
* **Goal:** keep the app's catalogue, pricing and on-hand stock automatically in step with Zoho
  Inventory, without manual CSV, safely and observably.
* **Target user:** Super Admin / operations — inventory data is trustworthy and current.
* **Business value:** eliminates manual re-keying, one source of truth for stock, auditable and
  reversible (soft-deactivate only, never hard-delete).

## 📖 Reference tables

### R1 — Field map (Zoho Inventory item → app `inventory`, matched by `sku`)
| App column | ← Zoho field (resolver; confirm in dry-run) | Written by sync? |
|---|---|---|
| `sku` | `sku` | key (skip row if blank) |
| `zoho_item_id` | `item_id` | yes (provenance) |
| `name` | `name` | yes if present & non-blank (never blanks an existing name) |
| `unit_price` | `rate` | yes if present |
| `cost_excl_gst` | `purchase_rate` | yes if present |
| `mrp` | `mrp` → else custom field `cf_mrp` | yes if present |
| `stock` | **`stock_on_hand`** (Model A, D1) | yes if present (from a complete fetch only) |
| `gst_rate` | `tax_percentage` (→ else resolve from `tax_id`) | yes if present |
| `category` | `category_name` | yes if present |
| `brand` | `brand` → else custom field `cf_brand` | yes if present |
| `barcode` | `ean` → else `upc` | yes if present |
| `uom` | `unit` | yes if present |
| `weight_grams` | `weight` × unit-factor (see R4) | yes if unit is unambiguous |
| `reserved` | — | **never** (app-owned overlay, see D1) |
| `reorder_level`, `max_stock` | — | **never** (app-owned operational settings) |
| `active` | Zoho `status`: `active`→1, `inactive`→0 | yes if `status` present |

Only columns whose Zoho value is **present** are written (data-loss-safe upsert; the shared
`upsertInventoryRows` writer). A field absent from a given payload is left untouched. `name` is
additionally guarded: a blank/absent `name` never overwrites an existing row's name, and a row that
would be a *new* SKU with a blank `name` is skipped and counted as an error.

### R2 — `app_config` keys (state; no redeploy to change)
| key | meaning | default |
|---|---|---|
| `zoho_sync_enabled` | kill switch (`"1"` on / `"0"` off). Checked **first**, before any network. | `"0"` |
| `zoho_sync_mode` | `"dryrun"` (compute + log, write nothing) or `"live"` | `"dryrun"` |
| `zoho_stock_policy` | `"authoritative"` (D1 default) — reserved for future variants | `"authoritative"` |
| `zoho_sync_cursor` | watermark = max `last_modified_time` synced, stored as **UTC epoch seconds** | `""` |
| `zoho_token` / `zoho_token_exp` | cached access token + epoch-seconds expiry | `""` |
| `zoho_sync_lock` | `"<epoch>:<run-token>"` of an in-flight run; stale after `LOCK_TTL` (15 min) | `""` |
| `zoho_last_full_at` | epoch seconds of last successful full reconcile | `""` |

### R3 — Cron → run type (`wrangler.jsonc` `triggers.crons`, branched on `controller.cron`)
| cron (UTC) | run |
|---|---|
| `0 */3 * * *` | **delta** — items with `last_modified_time` ≥ cursor − OVERLAP |
| `30 3 * * *` | **full reconcile** — all items; soft-deactivate absent Zoho-originated SKUs |
| *(any other / unknown cron string)* | default to **delta** (safe: never auto-deactivates) |

Both crons fire the same `scheduled()`. The existing `runDeliveryReminders` and `fixCategoryNames`
work MUST continue to run (they are not gated behind the sync branch).

### R4 — Tuning constants (pinned)
| const | value | why |
|---|---|---|
| `PER_PAGE` | 200 | Zoho max page size |
| `OVERLAP` | 10 min | delta lower-bound safety margin for boundary edits |
| `OVERLAP_CAP` | 24 h | cursor is never rewound further than this (guards a corrupt/old cursor) |
| `MAX_RETRIES` | 4 | per-request attempts on 429/5xx |
| `RETRY_BASE` / `RETRY_CAP` | 1 s / 20 s | capped exponential back-off (honour `Retry-After` if sent) |
| `MAX_PAGES_PER_RUN` | 100 | invocation page ceiling (20k items); overflow → cursor holds, resume next run |
| `LOCK_TTL` | 15 min | stale-lock reclaim threshold (must exceed a run's wall-time budget) |
| `TOKEN_SKEW` | 120 s | refresh the access token this long before its expiry |
| `MAX_DEACTIVATE_PCT` | 10% | abort nightly deactivation if it would deactivate >10% of active Zoho SKUs |
| `WEIGHT_UNITS` | kg→1000, g→1, lb→453.592, oz→28.3495 | `weight_grams` conversion; skip if unit unrecognised |

## 🛠️ User Stories & Workflows
- **As** a Super Admin, **I want** inventory to auto-sync from Zoho every few hours **so that** stock
  and prices are current without CSV work.
- **As** a Super Admin, **I want** a **"Sync now"** / **"Full reconcile"** button and a visible
  last-run/status **so that** I can force a refresh and see it worked.
- **As** an operator, **I want** a **dry-run** first **so that** I confirm the field mapping before
  it writes anything.
- **As** the business, **I want** every sync **logged and reversible-safe** (soft-deactivate only,
  never hard delete, never blind mass-deactivation) **so that** a bad Zoho state can't silently
  destroy catalogue history.

## 📋 Acceptance Criteria

### AC1 — OAuth refresh-token auth, cached; refresh-token is the sole token source
- **Given** `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN` secrets and `ZOHO_DC` are set
- **When** the sync needs a token
- **Then** it exchanges the refresh token at `https://accounts.zoho.<dc>/oauth/v2/token` for an access
  token, caches it in `app_config` (`zoho_token`/`zoho_token_exp`), and reuses it until `TOKEN_SKEW`
  before expiry. The static `ZOHO_ACCESS_TOKEN` env var is **not** used as a live token source (it may
  seed a dry-run only). The token/secrets are **never logged**. A refresh **auth failure**
  (`invalid_grant`/4xx) is handled like the 429 path: no throw, an `import_jobs` error row, cursor
  unchanged, lock released. Missing secrets → the run is a no-op recording a clear "not configured"
  status (never throws, never 500s a cron). A mid-run 401 triggers exactly one re-refresh then retry.

### AC2 — Delta pull by watermark; UTC-normalized; cursor advances only on a fully successful run
- **Given** a stored `zoho_sync_cursor` (UTC epoch)
- **When** a delta run executes
- **Then** all timestamps are normalized to **UTC epoch** before compare/max/arithmetic (never lexical
  compare on offset-bearing ISO). It fetches items with `last_modified_time ≥ cursor − OVERLAP`
  (bounded below by `cursor − OVERLAP_CAP`), paginates fully (`PER_PAGE`), buffers all pages, upserts
  by `sku`, and advances `zoho_sync_cursor` to the max `last_modified_time` seen **only if the run
  fully succeeded** (AC9 definition). First run (empty cursor) bootstraps as a full fetch. A run that
  fetched **zero** items leaves the cursor **unchanged**. A failure mid-run leaves the cursor unchanged
  so the next run re-pulls (safe: upsert is idempotent by `sku`).

### AC3 — Model A stock overwrite, only from a complete fetch; buffer-then-write
- **Given** live mode
- **When** items are upserted
- **Then** `inventory.stock ← stock_on_hand` (D1) and **`reserved` is never written**. Because D1 has
  no cross-batch transaction, a run **buffers all fetched pages and verifies fetch completeness before
  writing any row**; a page/API error aborts the run with **no writes** (no partial clobber) and cursor
  unchanged. An item merely **absent** from a delta page is **never** interpreted as stock 0. Rows with
  a blank Zoho `sku` are skipped, counted as errors, never written under an empty key. Per-chunk writes
  are non-atomic but idempotent; recovery = re-pull (cursor held on failure).

### AC4 — Nightly full reconcile: provenance-scoped soft-deactivate, gated + safety-valved
- **Given** the `30 3 * * *` full run
- **When** it completes a **provably complete** fetch — `has_more==false` **AND** fetched count ==
  Zoho `page_context.total_count` **AND** zero page errors
- **Then** any `inventory` SKU with `zoho_synced_at IS NOT NULL` (Zoho-originated) that is **absent**
  from the fetched Zoho set is marked `active=0` (soft), **never `DELETE`d**; app-native SKUs
  (`zoho_synced_at IS NULL`, e.g. CSV) are **never** touched. **Safety valve:** if the set to
  deactivate exceeds `MAX_DEACTIVATE_PCT` of active Zoho-originated SKUs, **no** deactivation runs and
  the run logs a "deactivation aborted — exceeds 10%" error (guards a truncated/bad Zoho snapshot).
  If the full fetch errored partway, **no** deactivation runs. `zoho_last_full_at` is set only on a
  gated-complete full run.

### AC5 — Dry-run writes nothing and advances nothing
- **Given** `zoho_sync_mode="dryrun"`
- **When** any run executes (through the **exact same** fetch+map+diff codepath as live)
- **Then** it computes the would-change diff (counts of would-insert / would-update /
  would-deactivate + a bounded sample) and logs it, but performs **zero** writes to `inventory`
  **and does not** advance `zoho_sync_cursor`, set `zoho_last_full_at`, or deactivate anything. Only an
  `import_jobs` row is written. (So flipping to live later re-processes everything dry-run saw.)

### AC6 — Every run is audited in `import_jobs`
- **Given** any run (cron or manual, dry or live)
- **Then** it writes one `import_jobs` row: `type='zoho-sync'`, a `mode` marker (`dryrun`/`live` and
  `delta`/`full`) in the type suffix or errors summary, `total` (fetched), `success_count`
  (rows written or would-write), `failed_count` (blank-sku + row errors), and a bounded `errors`
  summary. `created_by='system'` for cron, the admin's id for manual. Full runs also record
  `zoho_last_full_at` (live only).

### AC7 — Kill switch (first op) + atomic non-overlap lock
- **Given** `zoho_sync_enabled != "1"` → cron/manual **no-op before any network**, logged "disabled".
- **And** the lock is acquired **atomically** (`UPDATE app_config SET value=? WHERE key='zoho_sync_lock'
  AND (value='' OR <stale>)`, check rows-affected) with a run-token; a second run that fails to acquire
  **skips** (manual → HTTP 409 `{status:'skipped'}`). Writes are idempotent/order-independent so a
  best-effort lock is safe; a lock older than `LOCK_TTL` is reclaimed; the lock is always released in a
  `finally` (even on throw).

### AC8 — Manual endpoints are Super-Admin only; full is async & guarded
- **Given** `POST /api/integrations/zoho/sync` (optional `{mode?:"dryrun"|"live", full?:true}`)
- **When** called by a non-super-admin → **403**; by a super-admin → a **delta** runs inline and
  returns its summary; a **`full:true`** run is dispatched via `ctx.waitUntil` returning a job id
  (poll status via the last `import_jobs` row) so the request doesn't exceed the HTTP budget. Both honor
  the kill switch, the lock (locked → 409 `{status:'skipped'}`), and the completeness/`MAX_DEACTIVATE_PCT`
  guards. Request `mode` overrides `zoho_sync_mode` for that run only. The **Sync now** / **Full
  reconcile** buttons + status panel render only for `super_admin` (consistent with inventory-import
  gating); the panel shows last run time, mode, counts, and the cursor.

### AC9 — "Run fully succeeded" defined; rate-limit & error resilience
- **Run success** = `failed_count==0` **AND** every page fetched (no page error) **AND** every fetched
  non-blank row written (live) / diffed (dry). Only then does the cursor advance / `zoho_last_full_at`
  set.
- **Given** Zoho returns HTTP 429 or 5xx → the client retries with capped exponential back-off
  (`MAX_RETRIES`, `RETRY_BASE`..`RETRY_CAP`, honouring `Retry-After`). A run that still can't complete
  ends cleanly: **no** cursor advance, **no** partial deactivation, an `import_jobs` error row, the lock
  released, and a **non-throwing** return so the Worker cron never crashes. Non-throw is asserted
  together with its side-effects (lock released, cursor unchanged, error row present).

### AC10 — Non-functional gates
- `npx tsc --noEmit` clean · `npx vitest run` green. New sync tests run against an **injectable/mocked
  fetch** and a **captured-shape fixture**, covering: field-map resolver vs fixture, upsert-by-sku,
  cursor-advances-only-on-success, UTC-normalized watermark, dry-run-writes-and-advances-nothing,
  buffer-then-write aborts with no partial clobber on a mid-fetch error, provenance-scoped
  soft-deactivate on full, `MAX_DEACTIVATE_PCT` abort, blank-sku skip, disabled/locked no-op (no network
  when disabled), 403 for non-super-admin, and preserved `runDeliveryReminders`/`fixCategoryNames` on
  the nightly cron. · `test:smoke` + `test:phase2` green (any new `dataAct` target resolves).

## 🚨 Constraints & Edge Cases
- **No live Zoho in CI/sandbox** → the sync's HTTP client is **injectable** so tests supply a
  deterministic fetch; the real client is used in production. The sync logic lives in a plain async
  function callable directly from a test (not only via `scheduled()`).
- **Secrets** (via `wrangler secret put`, never in code): `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`,
  `ZOHO_REFRESH_TOKEN`, `ZOHO_INVENTORY_ORG_ID`, `ZOHO_DC` (=`in`). `Env` already declares the
  inventory fields; add the OAuth ones to `src/types.ts`.
- **Timezone**: Zoho `last_modified_time` is org-timezone ISO with offset → normalize to UTC epoch
  before any compare/arithmetic; apply `OVERLAP` as margin, `OVERLAP_CAP` as floor.
- **Weight/units**: convert via `WEIGHT_UNITS` (R4); skip `weight_grams` if the unit is unrecognised
  rather than guess.
- **`zoho_last_full_at` staleness**: the status panel warns if the last full reconcile is > 48 h old.
- **Backward compatible**: sync is **off by default** (`zoho_sync_enabled="0"`, `mode="dryrun"`) so
  merging/deploying performs **no inventory writes** until an admin enables it. Existing CSV import
  stays. New columns are additive with safe defaults.
- **Migration**: `migrations/0035_zoho_sync.sql` adds `zoho_item_id TEXT`, `zoho_synced_at TEXT` to
  `inventory` (self-heal create mirrored in `src/index.ts` per existing pattern).
- **Rollout order:** deploy (disabled) → set secrets → enable dry-run → verify mapping in Import
  History → confirm field names → flip to live → enable the 3h cron.

## 🎨 UI (super-admin, in Import → Inventory)
```
┌ Zoho Inventory sync ───────────────────────────────┐
│ Status: LIVE · last delta 2h ago · 14 updated       │
│ Cursor: 2026-09-05 06:00 UTC     Mode: [dryrun ▾]   │
│ [ Sync now ]  [ Full reconcile ]   ⏻ enabled        │
│ ⚠ last full reconcile 3 days ago (if stale)         │
└─────────────────────────────────────────────────────┘
```

## ⛔ Direction is one-way (Zoho → app) — retire the existing push
The codebase already ships an **app → Zoho push** sync — `runZohoInventorySync` (src/index.ts:247)
loops inventory and `POST`s each item to Zoho via `pushItemToZoho` (`direction:"push"`), reachable at
`POST /api/integrations/zoho-inventory/sync` and gated by `zoho_inv_sync_enabled`. Per the product
decision, **the app must never push stock (or anything) to Zoho.** The build therefore:
- **Neutralizes the push:** `pushItemToZoho`/`runZohoInventorySync` are removed (or made a no-op that
  returns "push disabled"), and the manual endpoint + cron do the **pull** instead. No code path may
  write to Zoho. The old `zoho_inv_sync_enabled`/`zoho_inv_last_*` config is superseded by the R2 keys.
- **Keeps the inbound webhook harmless:** `handleZohoInvWebhook` (pull-only stock update) may remain,
  but is not required and is out of scope for this milestone (the 3h cron is the agreed mechanism).
- **AC:** a test asserts no outbound POST to Zoho `items` occurs on any sync path (the injected fetch
  records calls; the only allowed Zoho calls are the OAuth token exchange and `GET .../items`).

## Out of scope
- App → Zoho push / write-back of stock movements — **explicitly excluded** (see above); Zoho stays
  the sole authority and the app never writes to it.
- Webhook (near-real-time) ingestion — later; the 3h cron is the agreed cadence.
- Non-inventory Zoho objects (orders, invoices — Books already stubbed separately).
- Multi-warehouse stock breakdown (single on-hand number for now).
