# PRD — Receivables & Payment Reminders

**Product:** SmartPantry ERP (Cloudflare Workers + D1 + vanilla-JS SPA)
**Module:** Finance → Receivables (AR) + Payment Reminders
**Moniker:** `003-finance-ar` · **Doc:** PRD v1.0 · **Date:** 2026-09-28
**Status:** DRAFT for review (no code yet)
**Companion docs:** `plan.md` (build plan), `context.md` (architecture decision)
**Source references:** `payment_reminders.html` (Feature Specification v1.1 — 8 core / 46 sub-features),
`Payment_Reminders_Feature_List_1.docx`, `tools.4syz.com/ReceivableOS.html` (not reachable from the
build environment; feature set taken from the two attachments, which mirror it).

---

## 1. Summary

Give SmartPantry a **Receivables cockpit** and an **automated Payment-Reminders engine** so the
business collects money owed by clients faster and with no manual chasing. Invoices, customers and
payments are **mirrored from Zoho Books** (the accounting system of record); on top of that mirror we
add what Books does not give us operationally: order/DC linkage, aging, a reminder/dunning engine,
late-fee visibility, "Pay Now" links, and automatic pause-on-payment.

This PRD covers the first shippable slice of Phase 3: **AR mirror (P3.1)** + **Payment Reminders
(P3.4)** brought forward, because the reference material and the operator's ask are reminder-first.
AP, the full 3-way reconciliation engine, and the finance dashboard remain in `plan.md` and follow.

### The load-bearing decision (unchanged from `context.md`)
Zoho Books stays the single source of truth for money. The app **does not** compute its own ledger.
It **reads** invoices/payments from Books idempotently (`zoho_*_id` provenance, exactly like the
inventory mirror) and **acts** on top: reminders, aging, linking, collection workflow. The reference
docs describe an Excel-upload data source; **we deliberately replace that with the Books/AR mirror** so
there is one source of truth and no re-keying. The reference's schema fields map cleanly onto Books
data (see §6).

---

## 2. Goals & non-goals

### Goals
- **G1 — Get paid sooner.** Reduce DSO (days sales outstanding) by automating reminders across the
  invoice lifecycle (before / on / after due date).
- **G2 — Zero manual chasing.** Reminders fire on schedule with live invoice data merged in; no one
  drafts emails by hand.
- **G3 — One collection cockpit.** Finance/ops see every outstanding invoice, aged, linked to the
  order/DC it came from, with next-reminder status.
- **G4 — No embarrassing over-chasing.** Reminders stop the instant a payment is reconciled, and
  honour disputes, negotiations and opt-outs.
- **G5 — Single source of truth.** All numbers reconcile to Zoho Books; the app never becomes a
  second ledger.

### Success metrics
- DSO trend (down) and % overdue balance (down) after 60 days live.
- % of collection touches that are automated (target > 90%).
- Reminder deliverability (delivered / opened) and **conversion** (reminder → payment) per stage/channel.
- Zero incidents of a reminder sent for an already-paid invoice.

### Non-goals (explicit — inherited from `context.md`)
- No in-app general ledger, journals, trial balance, or GST/GSTR filing (Zoho Books owns these).
- No TDS **computation** (surface the field from Books; don't compute).
- No new payment-gateway build in this slice — "Pay Now" is a **link** to an existing gateway
  (see §8, staged as optional).
- No Excel-upload ingestion path (superseded by the Books mirror).

---

## 3. Personas & roles

| Persona | Role code | What they do here |
|---|---|---|
| Finance admin | `finance_admin` | Owns AR: reviews aging, configures reminder rules, records/links payments, waives fees. Full write. |
| Super admin | `super_admin` | Everything finance_admin can, plus integration/config (Books connect, sync toggle). |
| Ops admin | `ops_admin` | Read AR, see which orders/DCs are unpaid; no fee/rule writes. |
| Collector (finance) | `finance_admin` | Works the worklist: pause under negotiation, flag dispute, send manual reminder. |
| Client | `client_*` | Sees **only their own** statement + outstanding invoices + Pay-Now; never sees AP or other clients. |

Write actions (edit rules, waive fee, record/link payment, resolve dispute) = `finance_admin` +
`super_admin`. Read = ops roles. Clients scoped to their own AR only.

---

## 4. Scope of this slice

Mapped from the reference's 8 core features onto our architecture. "Now" = this slice; "Later" =
follows in `plan.md` milestones.

| # | Reference feature | In this slice | Notes |
|---|---|---|---|
| 01 | Automated Scheduling | **Now** | Tiers T−7 / T−3 / due / T+7 / T+30, custom offsets, send-window, cadence throttle. |
| 02 | Multi-Channel Communication | **Now (email + in-app)** · Later (WhatsApp/SMS) | Channel priority + fallback + opt-out modelled now; SMS/WhatsApp adapters stubbed. |
| 03 | Customisable Dunning Workflows | **Now** | 3-stage escalation, PDF invoice attach, VIP/dispute branching, template library. |
| 04 | Dynamic Variables & Personalisation | **Now** | Merge tags from AR mirror, live preview, conditional blocks; multi-language Later. |
| 05 | Late Fee Management | **Surface Now, compute Later** | Show late fee **from Books**; in-app fee **rules/accrual** deferred (keeps Books as SoR). |
| 06 | Payment Gateway Integration | **Later (optional)** | "Pay Now" link scaffolding now if a gateway link exists; full connectors later. |
| 07 | Zoho Books Integration | **Now (read/mirror)** · Later (write-back) | Auto-import invoices/payments/customers; status write-back deferred & optional. |
| 08 | Automatic Pause on Payment Match | **Now** | Real-time status watch, pipeline purge, partial-pay reschedule, dispute/negotiation holds. |

---

## 5. User experience

New **Finance** nav section (role-gated). This slice ships two pages plus a client view.

### 5.1 Receivables (finance/ops)
- **KPI row:** Total outstanding · Overdue · Due this week · DSO.
- **Aging table by client:** buckets 0–30 / 31–60 / 61–90 / 90+, each drillable.
  - Drill: client → invoice list → invoice → **originating order/DC** (the operational overlay Books
    lacks).
- **Unlinked invoices panel:** Books invoices with no matched order/DC, with a manual-link action.
- **Filters:** client, status (open/partial/overdue/paid/void), aging bucket, currency.
- **Row actions:** view statement, send reminder now, pause/resume, flag dispute, open in Books.
- CSV export (reuse `_csvDownload`).

### 5.2 Payment Reminders (finance)
- **Rules board:** the dunning ladder as editable tiers (offset days, tone/template, channel,
  attach-PDF y/n, active toggle). Seeded defaults = reference tiers (§7).
- **Template editor:** merge-tag palette (§6), **live preview** rendered with a real overdue invoice,
  conditional blocks (show/hide by age / balance / history).
- **Workflow branches:** default / VIP / disputed / partial-paid, each pointing at a template set.
- **Send log / audit:** every reminder — invoice, tier, channel, sent_at, delivered/opened/failed,
  the actor (or "system").
- **Manual controls:** "send now", "pause customer (negotiation)", "hold (dispute)".
- **Global switch:** reminders enabled/disabled (ships **disabled**, dry-run first — like inventory).

### 5.3 Client statement (client_*)
- Their outstanding invoices, aged, with amount/balance/due date and (if enabled) a **Pay Now** link.
- Read-only; no other client's data; no AP.

---

## 6. Data model

Builds on the tables already specified in `plan.md`. All new tables self-heal via
`fixCategoryNames` / `ensureFeatureTables`. Amounts REAL, paise-rounded. **Provenance columns**
(`zoho_*_id`, `zoho_synced_at`) on every mirrored table — same pattern as `inventory.zoho_item_id`.

### 6.1 Mirrored from Books (read model)
```
ar_invoices    id, zoho_invoice_id, number(=transaction_number), client_id, order_id, dc_id,
               date, due_date, payment_expected_date, subtotal, gst, total, amount_paid, balance,
               currency_code, exchange_rate, late_fee, entity_id, status(open|partial|paid|overdue|void),
               age_bucket, reminders_sent, zoho_synced_at
fin_payments   id, direction(in), zoho_payment_id, party_type(client), party_id,
               doc_type(invoice), doc_id, amount, date, method, ref, zoho_synced_at
```
`ar_invoices` carries **exactly the reference schema fields** so templates and rules port 1:1:
`due_date, payment_expected_date, age(→age_bucket), customer_id(→client_id), customer_name(join),
status, balance, transaction_number(→number), amount/total, currency_code, exchange_rate, entity_id,
reminders_sent, late_fee`.

### 6.2 Reminder engine (new, app-owned)
```
reminder_rules   id, workflow(default|vip|disputed|partial), tier, offset_days(±from due_date or
                 payment_expected_date), channel(in_app|email|whatsapp|sms), template_id, attach_pdf,
                 tone, active
reminder_templates id, name, lang, subject, body(merge-tag markup), conditional_blocks(json)
reminder_log     id, invoice_id, transaction_number, client_id, workflow, tier, channel,
                 status(queued|sent|delivered|opened|failed|cancelled), sent_at, note
reminder_holds   id, client_id|invoice_id, kind(negotiation|dispute|opt_out), channel|null,
                 set_by, set_at, cleared_at
```
Idempotency keys: a reminder is unique on `(invoice_id, tier, channel)` per due-cycle — the send loop
never double-sends (reuses the CAS/idempotency pattern). `reminders_sent` is derived from
`reminder_log`, mirrored back to `ar_invoices` for display.

### 6.3 Merge tags (from AR mirror)
`{{customer_name}} {{transaction_number}} {{due_date}} {{balance}} {{amount}} {{currency_code}}`
`{{payment_expected_date}} {{entity}} {{reminders_sent}} {{late_fee}} {{pay_now_link}}` — all resolved
from the joined `ar_invoices` + client row; `{{pay_now_link}}` empty until the gateway slice lands.

---

## 7. Reminder / dunning engine

### Schedule (seeded defaults, editable)
| Tier | Offset | Workflow stage | Tone | PDF |
|---|---|---|---|---|
| Pre-due 1 | T−7 | — | Early friendly notice | no |
| Pre-due 2 | T−3 | — | Polite reminder | no |
| On-due | T+0 | Stage 1 (polite) | Assumes oversight | no |
| Overdue | T+7 | Stage 2 (firm) | Clear urgency, balance highlighted | **yes** |
| Final | T+30 | Stage 3 (final) | Formal, references late fee + escalation | **yes** |

Offsets are relative to `due_date` **or** `payment_expected_date` (custom trigger builder). Rules are
data, not code — a new tier is a row, not a deploy.

### Controls (from reference)
- **Send-time window:** dispatch only within business hours / client time zone.
- **Cadence throttle:** cap reminders per client per week (anti-fatigue / anti-spam).
- **Channel priority + fallback:** try preferred channel; fall back on failure/no-open.
- **Per-channel opt-out:** unsubscribe one channel without disabling all reminders.
- **Workflow branching:** VIP / disputed / partial-paid routed to gentler or separate ladders.
- **Conditional content blocks:** show/hide email sections by age / balance / history.

### Execution
Runs on the **existing Cloudflare cron** (`scheduled`) — the same 3-hourly tick inventory/Books sync
uses. Each run: recompute aging (F4) → select invoices whose tier is due and not yet sent (respect
holds, throttle, window) → render template → send via channel adapter (`sendEmail` /
`pushNotification` now; WhatsApp/SMS adapters later) → write `reminder_log`. Ships **disabled**; first
rollout is a **dry-run** that logs what *would* send without sending.

---

## 8. Auto-pause & payment matching (reference feature 08)

The safety feature that prevents chasing paid invoices:
- **Real-time status watch:** when a mirrored payment (or Books webhook `handleZohoWebhook`
  "Payment received…") moves an invoice to `paid`/`matched`, **cancel all pending reminders** for that
  `transaction_number` — including any already queued for this cron tick (**pipeline purge**).
- **Partial payment:** update `balance`, keep the invoice open, **reschedule** remaining tiers for the
  outstanding portion only.
- **Payment confirmation:** optional thank-you/receipt email on confirmation.
- **Manual override pause:** collector pauses a client under negotiation without touching invoice
  status (`reminder_holds.kind=negotiation`).
- **Dispute hold:** flag an invoice disputed → suppress all reminders until cleared
  (`kind=dispute`).

All of the above are idempotent and `audit(...)`-logged.

## 8b. Payment gateway "Pay Now" (later / optional — reference feature 06)
- Contextual, pre-filled secure link scoped to the exact invoice amount + currency, embedded in
  reminder emails and the client statement.
- Connectors out of scope for this slice; when added: Razorpay/Stripe/GoCardless/PayU, webhook
  confirmation, partial-pay from link, conversion tracking, multi-currency checkout honouring
  `currency_code`/`exchange_rate`.

---

## 9. API surface (this slice)

Read (finance/ops; client scoped to self):
- `GET /api/finance/ar/invoices` — filter client/status/aging/currency.
- `GET /api/finance/ar/summary` — outstanding + aging buckets + DSO.
- `GET /api/finance/ar/client/:id` — statement.
- `GET /api/finance/reminders/rules` — dunning ladder + templates.
- `GET /api/finance/reminders/log` — send/audit log.

Write (`finance_admin`/`super_admin`):
- `POST /api/finance/reminders/rules` — edit tiers/templates/branches.
- `POST /api/finance/reminders/run` — manual trigger (respects dry-run flag).
- `POST /api/finance/reminders/send-now` — one invoice, one tier.
- `POST /api/finance/ar/:id/hold` — pause / dispute / opt-out (kind in body).
- `POST /api/finance/ar/:id/link` — manual order/DC link for an unlinked invoice.
- `POST /api/integrations/zoho-books/sync` — mirror invoices/payments/customers (reuses Zoho client).

All money-touching endpoints idempotent + audited; sync chunks id lookups by `D1_IN_CHUNK=90` (the
inventory bug we already fixed — do not repeat).

---

## 10. Integration — Zoho Books (reference feature 07)

- **Auth:** reuse the existing Zoho OAuth refresh-token client (`zohoGetToken`); add scope
  `ZohoBooks.fullaccess.all` (or read scopes for invoices/contacts/payments). Uses
  `ZOHO_BOOKS_ORG_ID`. OAuth 2.0, token refresh automatic — matches reference requirement.
- **Auto-import (now):** `GET /books/v3/invoices`, `/customerpayments`, `/contacts` (customers),
  paginated, `If-Modified-Since` deltas → `ar_invoices` / `fin_payments` / client link. Replaces the
  reference's Excel-upload ingestion.
- **Linking:** match Books `reference_number` / line-notes to our `order_id` / `dc_id`; fallback =
  unlinked, flagged for manual link (§5.1).
- **Write-back (later, optional):** two-way status sync, payment-reconciliation push, late-fee
  write-back — deferred to keep Books authoritative and the first slice read-only-safe.
- **Webhooks:** `handleZohoWebhook` already receives "Payment received…"; extend it to drive
  auto-pause (§8) in real time.

---

## 11. Open questions — resolved by the reference material

The three questions left open in `plan.md` are answered by the reference spec:

1. **Auto-link key.** Link on Books `reference_number` (invoice number = `transaction_number`) to our
   order/DC id; **manual-link fallback** for unmatched. → *Resolved: reference_number + manual
   fallback.*
2. **Reminder channels.** Reference wants **Email, SMS, WhatsApp, in-app**. → *Resolved: ship
   email + in-app now (existing infra); model channel-priority/fallback/opt-out now; add WhatsApp/SMS
   adapters (MSG91/Twilio stubs) in a follow-up. No architectural change needed later.*
3. **Currency.** Reference is **multi-currency** (`currency_code`, `exchange_rate`, multi-currency
   checkout). → *Resolved: store & display `currency_code`/`exchange_rate` from Books from day one;
   reminders and Pay-Now default to the invoice's own currency; INR is the primary operating currency.*

### New decisions to confirm before build
- **D1 — Late fees:** surface `late_fee` **from Books** only in this slice (no in-app fee computation),
  to avoid a second source of truth. In-app accrual rules (flat/%/daily interest, grace, exemptions,
  updated-invoice PDF) come later *only if* Books can't express them. **Recommend: surface-only now.**
- **D2 — PDF invoice attach:** generate from mirrored invoice data, or fetch the Books-rendered PDF?
  **Recommend: fetch Books PDF** (authoritative, no divergence).
- **D3 — Pay Now:** include the link only if a gateway link already exists; otherwise defer feature 06
  entirely to a later milestone.

---

## 12. Phasing & sequencing

Reconciled with `plan.md` (F1–F4 foundation still applies). This slice reorders to deliver
collection value first:

1. **F1–F4** — Books client, generic idempotent mirror upsert (chunked by 90), cron wiring (ships
   disabled), pure aging/status function. *(from plan.md)*
2. **P3.1 — AR mirror + Receivables cockpit** — invoices/payments/customers mirrored, aging, order/DC
   linkage, unlinked panel, client statement.
3. **P3.4′ — Payment Reminders (brought forward)** — rules/templates/log tables, dunning ladder,
   cron send loop (dry-run first), auto-pause + holds, email + in-app.
4. *(then, per plan.md)* P3.2 AP → P3.3 full 3-way reconciliation → P3.5 finance dashboard; plus the
   deferred reminder channels (WhatsApp/SMS), Pay-Now gateway, and in-app late-fee rules as follow-ups.

Each step ships behind `tsc --noEmit` + `vitest` + smoke, role-gated, `?v=` bumped on changed public
files, deployed through the existing GitHub Actions loop.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Reminder sent for a paid invoice | Auto-pause + pipeline purge (§8); dry-run first; idempotent send keys. |
| Two sources of truth for money | Mirror-only; balances derived from Books; no in-app ledger/fee compute (D1). |
| Over-chasing / spam flags | Cadence throttle, send-window, per-channel opt-out, dispute/negotiation holds. |
| D1 "too many SQL variables" on bulk id lookups | Chunk by `D1_IN_CHUNK=90` (already-fixed inventory bug; regression test). |
| Client sees another client's AR | Strict role scoping; client endpoints filter to `client_id` = caller. |
| Books partial payload blanks a total | Never blank a field on partial payload (F2 rule); balances always derived. |

---

## 14. Acceptance criteria (this slice)

- Books invoices/payments/customers mirror into `ar_invoices`/`fin_payments` idempotently; re-sync is
  a no-op; > 90 existing ids update correctly (chunked).
- Receivables page shows correct outstanding, aging buckets, DSO; every invoice links to its order/DC
  or appears in the unlinked panel.
- Dunning ladder seeded with the 5 default tiers; editing a tier changes behaviour without a deploy.
- A reminder renders with live merge data; live preview matches what sends.
- Dry-run logs the exact set that *would* send and sends nothing; enabling sends via email + in-app.
- Marking an invoice paid/matched (payment mirror or webhook) cancels all its pending reminders,
  including any queued this tick; partial pay reschedules the remainder.
- Negotiation pause, dispute hold, and per-channel opt-out each suppress reminders as specified.
- Client sees only their own statement; no role can send AP data to a client.
- All money/reminder writes are idempotent and appear in the audit log.
```
