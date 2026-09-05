# Product Specification: Zoho Inventory → App Sync (Model A)

> One-way pull from **Zoho Inventory** into SmartPantry's `inventory` table. **Zoho is the stock
> authority (Model A).** Backend + a small super-admin UI. Ships **dry-run first**. Auth = OAuth2
> refresh-token. Cadence = **delta every 3h + nightly full reconcile**.

## 🎯 Executive Summary
* **Goal:** keep the app's catalogue, pricing and on-hand stock automatically in step with Zoho
  Inventory, without manual CSV, safely and observably.
* **Target user:** Super Admin / operations — inventory data is trustworthy and current.
* **Business value:** eliminates manual re-keying, one source of truth for stock, auditable and
  reversible.

## 📖 Reference tables

### R1 — Field map (Zoho Inventory item → app `inventory`, matched by `sku`)
| App column | ← Zoho field (confirm exact name in dry-run) | Written by sync? |
|---|---|---|
| `sku` | `sku` | key (skip row if blank) |
| `name` | `name` | yes |
| `unit_price` | `rate` | yes |
| `cost_excl_gst` | `purchase_rate` | yes |
| `mrp` | `mrp` / custom field (`cf_mrp`) | yes if present |
| `stock` | **`stock_on_hand`** (Model A) | yes |
| `gst_rate` | `tax_percentage` | yes if present |
| `category` | `category_name` | yes if present |
| `brand` | `brand` / custom field | yes if present |
| `barcode` | `ean`/`upc` | yes if present |
| `uom` | `unit` | yes if present |
| `weight_grams` | `weight` (→ grams) | yes if present |
| `reorder_level`, `max_stock` | — | **never** (app-owned operational settings) |
| `active` | derived from Zoho `status` (`active`→1, `inactive`→0) | yes |

Only columns whose Zoho value is present are written (data-loss-safe upsert). A field absent from a
given Zoho payload is left untouched.

### R2 — `app_config` keys (state; no redeploy to change)
| key | meaning | default |
|---|---|---|
| `zoho_sync_enabled` | kill switch (`"1"` on / `"0"` off) | `"0"` (off until configured) |
| `zoho_sync_mode` | `"dryrun"` (compute + log, write nothing) or `"live"` | `"dryrun"` |
| `zoho_sync_cursor` | ISO watermark = max `last_modified_time` successfully synced | `""` |
| `zoho_token` / `zoho_token_exp` | cached access token + epoch-seconds expiry | `""` |
| `zoho_sync_lock` | epoch seconds of an in-flight run (stale after 15 min) | `""` |
| `zoho_last_full_at` | ISO time of last successful full reconcile | `""` |

### R3 — Cron → run type (`wrangler.jsonc` `triggers.crons`, branched on `controller.cron`)
| cron (UTC) | run |
|---|---|
| `0 */3 * * *` | **delta** — items with `last_modified_time` > cursor (minus overlap) |
| `30 3 * * *` | **full reconcile** — all items; soft-deactivate app SKUs absent from Zoho |

## 🛠️ User Stories & Workflows
- **As** a Super Admin, **I want** inventory to auto-sync from Zoho every few hours **so that** stock
  and prices are current without CSV work.
- **As** a Super Admin, **I want** a **"Sync now"** button and a visible last-run/status **so that** I
  can force a refresh and see it worked.
- **As** an operator, **I want** a **dry-run** first **so that** I can confirm the field mapping before
  it writes anything.
- **As** the business, **I want** every sync **logged and reversible-safe** (no hard deletes) **so
  that** a bad Zoho state can't silently destroy catalogue history.

## 📋 Acceptance Criteria

### AC1 — OAuth refresh-token auth, cached
- **Given** `ZOHO_CLIENT_ID/SECRET/REFRESH_TOKEN` secrets and `ZOHO_DC` are set
- **When** the sync needs a token
- **Then** it exchanges the refresh token at `https://accounts.zoho.<dc>/oauth/v2/token` for an access
  token, caches it in `app_config` (`zoho_token`/`zoho_token_exp`), reuses it until ~2 min before
  expiry, and **never logs the token or secrets**. Missing secrets → the run is a no-op that records a
  clear "not configured" status (never throws, never 500s a cron).

### AC2 — Delta pull by watermark, idempotent, cursor advances only on success
- **Given** a stored `zoho_sync_cursor`
- **When** a delta run executes
- **Then** it fetches only items with `last_modified_time >= cursor − OVERLAP` (OVERLAP ≥ 5 min so
  boundary edits aren't missed), paginates fully (`per_page` ≤ 200), upserts by `sku`, and advances
  `zoho_sync_cursor` to the max `last_modified_time` seen **only if the entire run succeeded**. A
  failure mid-run leaves the cursor unchanged so the next run re-pulls (safe because upsert is
  idempotent by `sku`).

### AC3 — Model A stock overwrite, but never from an incomplete fetch
- **Given** live mode
- **When** an item is upserted
- **Then** `inventory.stock` is set to the Zoho on-hand value. **But** a run only writes rows it
  actually fetched successfully; an item merely **absent** from a delta page is **never** interpreted
  as stock 0, and a page/API error aborts the write for that run (no partial clobber). Rows with a
  blank Zoho `sku` are skipped and counted as errors, never written under an empty key.

### AC4 — Nightly full reconcile soft-deactivates, never hard-deletes
- **Given** the `30 3 * * *` full run completes fetching the whole active catalogue
- **When** an app `inventory` SKU is **not** present in the fetched Zoho set
- **Then** that SKU is marked `active=0` (soft), **never** `DELETE`d (orders/DCs/challans reference
  it), and the count is logged. Soft-deactivation happens **only** after a verified-complete fetch
  (if the full fetch errored partway, no deactivation runs).

### AC5 — Dry-run writes nothing
- **Given** `zoho_sync_mode="dryrun"`
- **When** any run executes
- **Then** it fetches + maps + computes the would-change diff and logs a summary (counts of
  would-insert / would-update / would-deactivate, and a sample), but performs **zero** writes to
  `inventory`. Switching to `"live"` is an `app_config` change (no redeploy).

### AC6 — Every run is audited in `import_jobs`
- **Given** any run (cron or manual, dry or live)
- **Then** it writes one `import_jobs` row with `type='zoho-sync'` (or `zoho-sync-dryrun`),
  `total/success_count/failed_count`, and an `errors` summary — visible in the Import → Import History
  tab. The run also records `zoho_last_full_at` for full runs.

### AC7 — Kill switch + non-overlap
- **Given** `zoho_sync_enabled="0"`
- **Then** cron runs no-op immediately (logged as "disabled").
- **And given** a run is already in flight (`zoho_sync_lock` set and < 15 min old)
- **When** another cron fires
- **Then** it skips (no overlapping runs); a stale lock (≥ 15 min) is ignored/reclaimed.

### AC8 — Manual "Sync now" is Super-Admin only
- **Given** `POST /api/integrations/zoho/sync` (optional `{mode:"dryrun"|"live", full:true}`)
- **When** called by a non-super-admin → **403**; by a super-admin → triggers a run and returns its
  summary. The **Sync now** button + status panel render only for super_admin (consistent with the
  inventory-import gating), and the panel shows last run time, mode, counts, and cursor.

### AC9 — Rate-limit & error resilience
- **Given** Zoho returns HTTP 429 or 5xx
- **Then** the client retries with capped exponential back-off (bounded attempts), and a run that
  still can't complete ends cleanly: no cursor advance, no partial deactivation, an `import_jobs`
  error row, and a non-throwing return so the Worker cron never crashes.

### AC10 — Non-functional gates
- `npx tsc --noEmit` clean · `npx vitest run` green (new sync tests against a **mocked Zoho fetch**:
  mapping, upsert-by-sku, cursor-advances-only-on-success, dry-run-writes-nothing,
  soft-deactivate-on-full, 403 for non-super-admin, disabled/lock no-op) · `test:smoke` + `test:phase2`
  green (any new `dataAct` target resolves).

## 🚨 Constraints & Edge Cases
- **No live Zoho in CI/sandbox** → the sync's HTTP client must be **injectable** so tests supply a
  deterministic fetch; the real client is used in production.
- **Secrets**: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_INVENTORY_ORG_ID`,
  `ZOHO_DC` (=`in`) via `wrangler secret put` — never in code; `Env` already declares the inventory
  fields, add the OAuth ones.
- **Timezone**: Zoho `last_modified_time` is org-timezone ISO; store/compare consistently (prefer the
  value Zoho returns; apply OVERLAP as a safety margin).
- **Weight/units**: convert `weight` to grams per Zoho's unit; skip if ambiguous rather than guess.
- **Backward compatible**: sync is **off by default** (`zoho_sync_enabled="0"`, `mode="dryrun"`) so
  merging/deploying changes nothing until an admin enables it. Existing CSV import stays.
- **Rollout order:** deploy (disabled) → set secrets → enable dry-run → verify mapping in Import
  History → flip to live → enable the 3h cron.

## 🎨 UI (super-admin, in Import → Inventory)
```
┌ Zoho Inventory sync ───────────────────────────────┐
│ Status: LIVE · last delta 2h ago · 14 updated       │
│ Cursor: 2026-09-05T06:00+05:30   Mode: [dryrun ▾]   │
│ [ Sync now ]  [ Full reconcile ]   ⏻ enabled        │
└─────────────────────────────────────────────────────┘
```

## Out of scope
- App → Zoho push (two-way / write-back of stock movements) — a later milestone.
- Webhook (near-real-time) ingestion — later; the 3h cron is the agreed cadence.
- Non-inventory Zoho objects (orders, invoices — Books already stubbed separately).
- Multi-warehouse stock breakdown (single on-hand number for now).
