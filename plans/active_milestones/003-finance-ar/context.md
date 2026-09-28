# Context — Phase 3: Finance (Receivables & Payables)

## Moniker
`003-finance-ar`

## Ask (verbatim intent)
Build **Payables and Receivables** with **reconciliation** and **reminders** as part of the
SmartPantry app. Decided with the operator:
- **Zoho Books is the accounting System of Record (SoR).** GST filing, the ledger, invoice/bill
  numbering and payment records live in Zoho Books.
- **Receivables (AR) first**, then Payables (AP), then the shared reconciliation engine and dunning.
- This document is the plan for review **before any code**.

## Architecture decision (the load-bearing one)
Because Zoho Books is the SoR, the app must **not** become a second general ledger that computes
balances independently — two ledgers drift and create endless reconciliation. We reuse the exact
model just adopted for inventory (Milestone 002, "Zoho owns the numbers"):

- The app **mirrors** financial documents **from Zoho Books** (invoices, bills, customer payments,
  vendor payments) into local read-model tables, **idempotently**, stamped with `zoho_*_id` +
  `zoho_synced_at` (same provenance pattern as `inventory.zoho_item_id`).
- On top of that mirror the app adds the **operational value Zoho Books does not**: linking each
  invoice/bill to the originating **order / DC / PO**, **aging** buckets, a **reconciliation /
  exception queue**, and **reminders / dunning** driven by the existing cron + notification + email
  infra.
- The app is **read-mostly** against Books. The only writes back to Books (optional, later) are
  "record a payment" and "raise an invoice from a DC" — both already partially present
  (`syncToZohoBooks`, DC billing) and both must be idempotent.

This keeps a single source of truth for money and makes reconciliation a *matching* problem
(operational doc ↔ Books doc ↔ payment), not a *balancing* problem.

## What already exists (reuse, do not rebuild)
- **AR triggers:** orders → `delivery_challans` → `handleBillDC` (mark billed, close order);
  `syncToZohoBooks(...)` pushes an invoice; `handleZohoWebhook` already receives
  "Payment received for invoice …".
- **AP triggers:** `purchase_orders` → `po_invoices` (vendor invoice) + `vendor_debit_notes`;
  `handleInvoicePO`.
- **Infra:** Cloudflare cron (`scheduled`), `pushNotification` (+ per-user targeting), `sendEmail`,
  `finance_admin` role and role gating, `audit(...)`, per-item GST, dataviz patterns, the D1
  idempotency/CAS + `D1_IN_CHUNK` chunking conventions, and the Zoho OAuth client
  (`zohoGetToken`, `zohoFetchPage` generalisable to Books endpoints).

## Zoho Books API surface needed (all under `https://www.zohoapis.<dc>/books/v3/…`)
Read (mirror): `GET /invoices`, `GET /bills`, `GET /customerpayments`, `GET /vendorpayments`
(paginated, `If-Modified-Since` for deltas, `organization_id` = `ZOHO_BOOKS_ORG_ID`).
Optional write (later): `POST /invoices`, `POST /customerpayments`.
Scope to add to the Zoho refresh token: `ZohoBooks.fullaccess.all` (or the read scopes for
invoices/bills/contacts/payments + write for invoices/payments if we push).

## Non-goals (explicit)
- No GST return filing / GSTR generation in-app (Zoho Books does it).
- No double-entry general ledger, journals, or trial balance in-app.
- No TDS computation engine (surface the field from Books; don't compute).
- No new payment-gateway integration.
