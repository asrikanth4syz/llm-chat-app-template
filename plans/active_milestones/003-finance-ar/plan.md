# Phase 3 Plan — Finance: Receivables & Payables (AR first)

**Moniker:** `003-finance-ar` · **SoR:** Zoho Books · **Model:** mirror-from-Books + operational
overlay (aging, reconciliation, reminders). AR first, then AP, then reconciliation + dunning.

Each milestone ships behind validation (tsc + vitest + smoke), is `finance_admin`/`super_admin`
gated for writes, read-open to ops, and follows the existing deploy loop. Everything money-touching
is **idempotent** and **audited**.

---

## Data model (new tables — all self-heal via `fixCategoryNames`/`ensureFeatureTables`)

Provenance columns on every mirrored table: `zoho_*_id TEXT`, `zoho_synced_at TEXT` (exactly like
`inventory`). Amounts stored in minor-unit-safe REAL (paise-rounded) with `currency` default `INR`.

```
ar_invoices        id, zoho_invoice_id, number, client_id, order_id, dc_id,
                   date, due_date, subtotal, gst, total, amount_paid, balance,
                   status(open|partial|paid|overdue|void), zoho_synced_at
ap_bills           id, zoho_bill_id, number, vendor_id, po_id,
                   date, due_date, subtotal, gst, total, amount_paid, balance,
                   status(open|partial|paid|overdue|void), zoho_synced_at
fin_payments       id, direction(in|out), zoho_payment_id, party_type(client|vendor),
                   party_id, doc_type(invoice|bill), doc_id, amount, date, method, ref,
                   zoho_synced_at
reconciliations    id, kind(ar_3way|ap_3way), left_type, left_id, right_type, right_id,
                   status(matched|exception|manual), variance_amount, variance_reason,
                   matched_by, created_at
reminder_log       id, kind(ar_dunning|ap_due), doc_type, doc_id, party_id, tier,
                   channel(in_app|email), sent_at, note
reminder_rules     id, kind, tier, offset_days, channel, template, active   (seeded defaults)
fin_sync_state     key, value    (cursors/watermarks per Books entity; or reuse app_config)
```

Match keys: `ar_invoices.order_id`/`dc_id` link to operational docs; `zoho_invoice_id` is the
idempotency key from Books. Same for AP via `po_id`/`zoho_bill_id`.

---

## Shared foundation (build once, before P3.1)

**F1 — Zoho Books client.** Generalise the existing inventory fetch (`zohoFetchPage`) into a
`booksFetch(entity, {page, modifiedSince})` over `/books/v3/<entity>`; reuse `zohoGetToken`
(refresh token already stored). Add `ZohoBooks.fullaccess.all` (or read scopes) — surfaced in the
Connect UI note. Uses `ZOHO_BOOKS_ORG_ID`.

**F2 — Mirror upsert.** A generic idempotent upsert keyed on `zoho_*_id` (chunk existing-id lookups
by `D1_IN_CHUNK=90` — the exact bug we just fixed in inventory; do not repeat it). Never blanks a
field on a partial payload. Stamps `zoho_synced_at`.

**F3 — Cron wiring.** Extend `scheduled()` to run a Books delta pull (invoices, customer payments)
on the 3-hourly tick and a full reconcile nightly, gated by a `finance_sync_enabled` flag (ships
**disabled**, like inventory did). Manual "Sync now" button for finance.

**F4 — Aging + status recompute.** Pure function: given `total`, `amount_paid`, `due_date`, `today`
→ `balance`, `status`, `age_bucket` (0–30 / 31–60 / 61–90 / 90+). Recomputed on every sync and on
read; unit-tested in isolation.

---

## Milestone P3.1 — Receivables (AR)  ← FIRST

**Goal:** a finance cockpit for money owed by clients, mirrored from Zoho Books, with aging.

- **Backend**
  - Mirror `GET /books/v3/invoices` + `/customerpayments` → `ar_invoices` + `fin_payments(in)`
    (F1/F2/F3). Link each invoice to `order_id`/`dc_id` by matching Books `reference_number`/
    line-notes to our DC/order id (fallback: unlinked, flagged for manual link).
  - Apply payments → `amount_paid`/`balance`/`status` (F4). Idempotent on `zoho_payment_id`.
  - Endpoints (all `GET`, finance/ops read): `/api/finance/ar/invoices` (filter client/status/aging),
    `/api/finance/ar/summary` (per-client outstanding + aging buckets + DSO),
    `/api/finance/ar/client/:id` (statement).
- **UI** (new "Receivables" page in the ops/finance nav)
  - KPI row: total outstanding, overdue, due-this-week, DSO.
  - Aging table by client (0–30/31–60/61–90/90+), drill to invoice list, drill to invoice→order/DC.
  - "Unlinked invoices" panel (Books invoice with no matched order/DC) with a manual-link action.
- **Tests:** aging/status pure-function table; payment application idempotency; unlinked fallback;
  D1-chunk safety on the id lookup.
- **Rollout:** ships with sync **disabled**; enable in a dry-run that only reads.

## Milestone P3.2 — Payables (AP)  ← BUILT (green; ships inert with the Books sync)

- Mirror `GET /books/v3/bills` + `/vendorpayments` → `ap_bills` + `fin_payments(out)`; link to
  `po_id` via Books reference; offset `vendor_debit_notes`.
- Endpoints: `/api/finance/ap/bills`, `/api/finance/ap/summary` (per-vendor outstanding + aging +
  DPO), `/api/finance/ap/vendor/:id`.
- UI "Payables" page: what's due when, per-vendor aging, debit-note offsets, "pay before due" flags.
- Tests mirror P3.1.

## Milestone P3.3 — Reconciliation engine  ← BUILT (green; exception queue + resolve)

- **AR 3-way:** order/DC ↔ `ar_invoice` ↔ payment. **AP 3-way:** PO ↔ receipt(DC-in/GRN) ↔
  `ap_bill` ↔ payment.
- Auto-match on ids + amount within tolerance; anything off (qty/price/tax/amount variance, missing
  doc, duplicate) → **exception queue** with a reason. Writes `reconciliations` rows.
- Endpoints: `/api/finance/reconcile/run` (POST, recompute), `/api/finance/reconcile/exceptions`
  (GET), `/api/finance/reconcile/:id/resolve` (POST — manual match / write-off note, audited).
- UI: Exceptions worklist with one-click "link" / "accept variance" / "flag".
- Tests: each mismatch class produces exactly one exception; resolve is idempotent.

## Milestone P3.4 — Reminders & dunning

- Reuse cron + `pushNotification` + `sendEmail`. `reminder_rules` seed: AR tiers at +0/+7/+15/+30
  days overdue (in-app + email, escalating tone); AP internal alert at due−3/−1 days.
- Per-run: select overdue AR invoices, respect the last-sent tier in `reminder_log` (no spam),
  send, log. Client-facing email uses the client contact; AP alerts go to `finance_admin`.
- Super-admin toggles per rule; per-client opt-out flag (reuse the per-client flag pattern).
- Endpoints: `/api/finance/reminders/rules` (GET/POST), `/api/finance/reminders/run` (POST manual),
  `/api/finance/reminders/log` (GET).
- Tests: tier progression, no double-send in a window, opt-out respected.

## Milestone P3.5 — Finance dashboard & reports  ← BUILT (green; AR/AP + cash + top debtors/creditors)

- One dashboard: AR vs AP aging, cash position (in − out projected by due date), top debtors/
  creditors, DSO/DPO trend, GST payable/ITC summary (values surfaced from Books, not computed).
- Reuse the dataviz palette/tile patterns. CSV export per table (reuse `_csvDownload`).

---

## Cross-cutting

- **Roles:** writes (resolve reconciliation, edit rules, record payment) = `finance_admin` +
  `super_admin`; read = ops roles; clients never see AP; a client sees only their own AR statement.
- **Idempotency & audit:** every payment application / reconciliation / reminder is keyed and
  `audit(...)`-logged; no double-clear (reuse CAS pattern).
- **Money safety:** amounts rounded to paise on read; never trust a partial Books payload to blank a
  total; balances always derived, never hand-edited.
- **Nav:** new "Finance" section (Receivables, Payables, Reconciliation, Reminders, Finance
  dashboard) in the ops/finance navs; gated by role.
- **Asset/version discipline:** bump `?v=` on changed public files; server has none.

## Sequencing & rough size
F1–F4 (foundation) → P3.1 AR → P3.2 AP → P3.3 reconcile → P3.4 reminders → P3.5 dashboard.
AR (F1–F4 + P3.1) is the first shippable unit and delivers cash-collection value on its own.

## Open questions — RESOLVED in the PRD
See `PRD-receivables-reminders.md` §11 (answered from the operator's reference spec):
1. **Auto-link** on Books `reference_number` (= invoice/transaction number) → order/DC, with a
   manual-link fallback for unmatched invoices.
2. **Channels:** email + in-app now (existing infra); channel-priority/fallback/opt-out modelled now;
   WhatsApp/SMS adapters (MSG91/Twilio) as a follow-up — no architectural change.
3. **Multi-currency:** store & display `currency_code`/`exchange_rate` from Books from day one;
   INR is the primary operating currency.

## PRD note
The reference material ("Payment Reminders" spec) is **reminder-first**, so the PRD reorders the first
shippable slice to **AR mirror (P3.1) + Payment Reminders (P3.4 brought forward)** rather than
AR → AP → reconcile → reminders. AP, full 3-way reconciliation, Pay-Now gateway, in-app late-fee
computation, and WhatsApp/SMS channels remain as sequenced follow-ups. The foundation F1–F4 is
unchanged.
