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
  zoho_modified TEXT, synced_at TEXT)
```

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

`runZohoDCSync` (in `src/index.ts`):

1. Requires the Zoho secrets (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, a refresh
   token, and an org id) — otherwise returns `not_configured` and does nothing.
2. Takes a CAS lock on `app_config.zoho_dc_sync_lock` (non-overlap, 15-min TTL).
3. Pages the DC list (`GET /inventory/v1/deliverychallans`) for header fields.
4. For each challan (bounded by `MAX_DETAIL_PER_RUN`), fetches the detail
   (`GET /inventory/v1/deliverychallans/{id}`) for line count, quantity total and
   invoice numbers.
5. Upserts each row (`ON CONFLICT(zoho_dc_id) DO UPDATE`), records a
   `zoho-dc-sync` job in `import_jobs`, and stamps `zoho_dc_last_sync_at` /
   `zoho_dc_last_result` in `app_config`.

It reuses the existing Zoho OAuth (`zohoGetToken`) and data-centre (`ZOHO_DC`)
plumbing, and is non-throwing (safe to wire to cron later).

### Configuration

Reuses the existing Zoho integration secrets (set as Worker secrets, or via the
in-app **Finance Setup → Connect Zoho** flow): `ZOHO_CLIENT_ID`,
`ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` (or the stored Connect token),
`ZOHO_INVENTORY_ORG_ID` (or `ZOHO_BOOKS_ORG_ID`), and `ZOHO_DC` (data centre,
default `in`).

## Limits & future work

- The detail pull is an N+1 (one call per challan), bounded by
  `MAX_DETAIL_PER_RUN` (300) and `MAX_PAGES_PER_RUN` (50) per run. For very large
  histories, run the sync more than once or raise the caps.
- The sync is **manual** today (the "Sync now" button). Wiring it to the nightly
  `scheduled()` cron is a small, isolated follow-up.
- The register reads the mirror only (up to 1,000 rows per view); it does not
  live-call Zoho on every page load.

## Tests

`test/zoho_dc.int.test.ts` — auth gate (401/403), finance/ops/super read access,
customer/month/search filters, invoice-number JSON round-trip, and the
`not_configured` sync path.
