# Zoho Delivery Challans — finance register

A read-only register that mirrors **Zoho Inventory's Delivery Challans** into the
ERP so the finance team can see, per customer and per month, each challan's
number, date, billed-to, line count, quantity count, invoiced state and the
linked **invoice number(s)**.

It is additive and safe: the sync is manual, and it writes **only** to its own
mirror table (`zoho_delivery_challans`). It never touches inventory, orders, or
the app's own delivery challans / DC Manager.

---

## Where it lives

- **Menu:** `Billing & Finance → Delivery Challans (Zoho)`
- **Page id:** `zoho_dc`
- **Who can see it:** `super_admin`, `ops_admin`, `finance_admin`
  (the same `FIN_FULL_ROLES` gate the Receivables/Payables cockpits use).
  Client and vendor roles cannot reach it.

"Billing & Finance" is the right home: this is finance reference data about what
has been delivered and what has been invoiced in Zoho, sitting alongside
Receivables, Payables and Reconciliation.

## The screen

| Column | Source |
|---|---|
| **DC number** | `deliverychallan_number` |
| **DC date** | `date` |
| **Billed to** | `customer_name` |
| **Lines** | count of `line_items` (from the DC detail) |
| **Qty** | sum of `line_items[].quantity` (from the DC detail) |
| **Invoiced?** | `invoiced_status` → *Invoiced* / *Partially* / *Not* |
| **Invoice #** | linked invoice number(s) — one-to-many (see below) |
| **Total** | `total` |

Controls:

- **DC for (customer)** dropdown — filter by customer.
- **Month** dropdown — formatted `MONTHNAME-YYYY` (e.g. `November-2026`).
- **Search** — matches DC number, customer or invoice number.
- **Invoiced** chips — All / Invoiced / Partial / Not.
- **Sync now** — pull the latest challans from Zoho.
- **Export CSV** — downloads exactly the rows currently in view.
- A live summary line (challans · qty · value · # invoiced) and a
  "Last synced …" indicator.

## Invoice numbers (the one caveat)

The Zoho delivery-challan record itself does **not** carry an invoice number — it
only exposes `invoiced_status`. The number lives on the linked **invoice**. So:

- The sync reads invoice numbers from the DC's linked invoices where Zoho exposes
  them on the challan payload (`invoices[]` / `invoice_number` / `invoice_numbers`),
  stored as a JSON array in `invoice_numbers`.
- It is **one-to-many**: a challan can map to 0, 1, or several invoices (partial
  invoicing → several numbers). The UI shows the first number plus a `+N` chip
  (hover for the full list) and a `partial` tag when only part is invoiced.
- If a particular Zoho account/edition does not surface the linked invoice on the
  challan payload, the column is simply blank for that row — everything else
  still syncs.

## Data model

Migration: `migrations/0056_zoho_delivery_challans.sql`

```
zoho_delivery_challans(
  zoho_dc_id TEXT PRIMARY KEY,   -- Zoho deliverychallan_id
  dc_number, dc_date, ym,        -- ym = YYYY-MM of dc_date (month filter)
  customer_id, customer_name,
  line_count INTEGER, qty_count REAL,
  invoiced_status TEXT,
  invoice_numbers TEXT,          -- JSON array
  total REAL, currency_code TEXT,
  zoho_modified TEXT, synced_at TEXT,
  detail_ok INTEGER)             -- 1 once line/qty/invoice pulled from DC detail
```

`detail_ok` (migration `0057`) is the convergence + completeness key: the sync
only fetches detail for `detail_ok=0` rows, and `COUNT(detail_ok=0)` is "pending".

The table is also self-healed at runtime (`ensureZohoDCTable`) so the feature
works even before the migration is applied in a given environment.

## API

Both endpoints require auth and `FIN_FULL_ROLES`.

### `GET /api/integrations/zoho-inventory/delivery-challans`

Query params (all optional): `customer=<zoho customer_id>`, `month=YYYY-MM`,
`q=<text>`.

Returns:

```jsonc
{
  "rows": [ { "dc_number": "...", "invoice_numbers": ["INV-…"], ... } ],
  "customers": [ { "id": "...", "name": "..." } ],   // dropdown source
  "months": ["2026-11", "2026-10"],                   // dropdown source
  "last_synced": "2026-11-12T09:14:00Z",
  "last_result": { "status": "ok", "written": 42, ... },
  "configured": true,
  "missing_secrets": [],
  "count": 42
}
```

### `POST /api/integrations/zoho-inventory/delivery-challans/sync`

Pulls fresh from Zoho and upserts the mirror. Returns:

```jsonc
{ "status": "ok" | "not_configured" | "error" | "skipped",
  "total": 42, "written": 42, "detailed": 42, "failed": 0, "errors": [] }
```

## How the sync works

`runZohoDCSync` (in `src/index.ts`) runs in **two phases** so coverage converges
instead of re-zeroing already-fetched rows:

1. Requires the Zoho secrets (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, a refresh
   token, and an org id) — otherwise returns `not_configured` and does nothing.
2. Takes a CAS lock on `app_config.zoho_dc_sync_lock` (non-overlap, 15-min TTL).
3. **Phase A — headers** (`zohoDCSyncHeaders`): pages the DC list
   (`GET /inventory/v1/deliverychallans`) and upserts header fields only
   (number, date, billed-to, invoiced state, total). It **never** overwrites an
   already-fetched line/qty/invoice; it resets `detail_ok=0` only when Zoho
   reports the challan changed (`zoho_modified`), so edits re-pull. New rows land
   with `detail_ok=0`. It records Zoho's `page_context.total` as
   `zoho_dc_reported_total`.
4. **Phase B — detail backfill** (`zohoDCBackfillDetails`): fetches
   `GET /inventory/v1/deliverychallans/{id}` for up to `DETAIL_BATCH` (100)
   challans **where `detail_ok=0`**, newest first — line count, quantity total,
   invoice numbers — then sets `detail_ok=1`. A challan it can't reach
   (rate-limit / timeout) stays `detail_ok=0` and is retried next run.
   `runZohoDCSync({full:true})` loops Phase B (bounded by `DETAIL_FULL_MAX`) until
   nothing is pending.
5. Records a `zoho-dc-sync` job in `import_jobs` and stamps `zoho_dc_last_sync_at`
   / `zoho_dc_last_result` (with `mirrored`, `reported_total`, `detailed_now`,
   `pending`, `failed`) in `app_config`.

### Completeness — "is the sync done in full?"

The list endpoint returns a `health` block the register renders as a status strip:

- `mirrored` — challans in the mirror; `reported_total` — what Zoho's list reported.
  `headers_complete` is true when `mirrored >= reported_total`.
- `detailed` / `pending` — challans with / without line-qty-invoice detail.
  `details_complete` is true when `pending == 0`.
- `suspicious` — challans marked detailed but still showing 0 lines (a data
  anomaly worth checking in Zoho).

**Done in full** = `headers_complete` **and** `details_complete`. Until then the
strip shows how many are pending, and **"Fetch all details"** (a background
`{full:true}` sync) completes them on demand; the nightly sync finishes any
remainder.

It reuses the existing Zoho OAuth (`zohoGetToken`) and data-centre (`ZOHO_DC`)
plumbing, and is non-throwing. It runs nightly from `scheduled()` on the
`"30 3 * * *"` tick (alongside the inventory reconcile) and on demand from the
**Sync now** button.

### Configuration

Reuses the existing Zoho integration secrets (set as Worker secrets, or via the
in-app **Finance Setup → Connect Zoho** flow): `ZOHO_CLIENT_ID`,
`ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (or the stored Connect token),
`ZOHO_INVENTORY_ORG_ID` (or `ZOHO_BOOKS_ORG_ID`), and `ZOHO_DC` (data centre,
default `in`).

## Limits & future work

- DB writes are batched via `env.DB.batch()` in `WRITE_CHUNK` (100) chunks —
  essential because every D1 call counts against the Worker's ~1000-subrequest
  limit, so ~10k individual header writes would kill the run before the detail
  phase (and before "last sync" is recorded). Header writes and detail updates are
  both batched.
- The detail pull is an N+1 (one Zoho call per challan), bounded by `DETAIL_BATCH`
  (100) per ordinary "Sync now" and `DETAIL_FULL_MAX` (700) per `full`/"Fetch all
  details" run (staying under the subrequest ceiling), with `MAX_PAGES_PER_RUN`
  (50) for headers. Because detail is fetched only for rows still missing it,
  successive runs converge to full coverage. **A large backlog (e.g. ~10k
  challans) needs several rounds** — keep pressing "Fetch all details", or let the
  nightly sync chip away ~700/night. "Sync now" refreshes headers + one detail
  batch; "Fetch all details" skips the header re-page and spends the whole budget
  on detail.
- The sync runs **nightly** on the `"30 3 * * *"` cron (09:00 IST — the same tick
  as the Zoho Inventory reconcile) and on demand via the **Sync now** button. The
  cron step self-gates on Zoho being configured and has its own try/catch, so it
  is a no-op until the secrets are set and never affects the inventory pull.
- The register reads the mirror only (up to 1,000 rows per view); it does not
  live-call Zoho on every page load.

## Tests

`test/zoho_dc.int.test.ts` — auth gate (401/403), finance/ops/super read access,
customer/month/search filters, invoice-number JSON round-trip, and the
`not_configured` sync path.
