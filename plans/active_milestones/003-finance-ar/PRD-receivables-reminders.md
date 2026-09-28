# PRD — Receivables & Payment Reminders

**Product:** SmartPantry ERP (Cloudflare Workers + D1 + vanilla-JS SPA)
**Module:** Finance → Receivables (AR) + Payment Reminders
**Moniker:** `003-finance-ar` · **Doc:** PRD v1.1 · **Date:** 2026-09-28
**Status:** DRAFT for review (no code yet)
**Companion docs:** `plan.md` (build plan), `context.md` (architecture decision), `PRD-review.md`
(architect review that this v1.1 answers)

> **v1.1 changelog** — folds in the architect review (`PRD-review.md`) and two operator decisions:
> **(a) email transport = Google Workspace / Gmail API** (see §10a); **(b) reminders = one
> consolidated statement per customer, driven by credit terms + due dates** (see §7). Also promotes
> the review's required data-model additions (credit notes, payment allocation, dispute/PTP,
> suppression log, integer money) into §6, and reclassifies Books write-back / AR payment plumbing /
> the email sender as **net-new, not reuse**.
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
- **"Follow-up due" worklist:** customers the daily pass flagged for an **overdue** statement
  (Overdue-1/2/Final). Each row: customer, worst-overdue days, total outstanding, tier, last-mailed
  date, and a **"Send follow-up"** button — disabled with "eligible in N days" until `min_gap_days`
  clears (override = explicit audited confirm). This is where all overdue mail is human-triggered.
- **Row actions:** view statement, preview follow-up, pause/resume (negotiation), flag dispute, set
  promise-to-pay (PTP), open in Books.
- CSV export (reuse `_csvDownload`).

### 5.2 Payment Reminders (finance)
- **Rules board:** the dunning ladder as editable tiers — `min_overdue_days`, **`send_mode`
  (auto/manual)**, `min_gap_days`, tone/template, attach-PDF, active. Seeded defaults = §7 table
  (Pre-due/On-due auto; overdue manual).
- **Template editor:** merge-tag palette (§6), **live preview** rendered with a real customer's open
  invoices, conditional blocks (show/hide by worst-age / total-balance).
- **Workflow branches:** default / VIP / disputed, each pointing at a template set.
- **Run log / audit:** every `reminder_runs` row — customer, tier, channel, run_at, status
  (**sent / failed / suppressed** + reason), Gmail message id, the actor ("system" for auto,
  collector name for manual), and the `invoice_ids` the statement covered.
- **Global switch:** reminders enabled/disabled (ships **disabled**, dry-run first — like inventory).

### 5.3 Client statement (client_*)
- Their outstanding invoices, aged, with amount/balance/due date and (if enabled) a **Pay Now** link.
- Read-only; no other client's data; no AP.

---

## 6. Data model

Builds on the tables already specified in `plan.md`. All new tables self-heal via
`fixCategoryNames` / `ensureFeatureTables`. Amounts REAL, paise-rounded. **Provenance columns**
(`zoho_*_id`, `zoho_synced_at`) on every mirrored table — same pattern as `inventory.zoho_item_id`.

> **Money is stored as INTEGER minor units (paise), not REAL** (review AD-1). REAL drifts under
> `exchange_rate` multiplication. Format to rupees on read only. Balances are always **derived**
> (`total − amount_paid − credited`), never hand-set.

### 6.1 Mirrored from Books (read model)
```
ar_invoices     id, zoho_invoice_id, number(=transaction_number), client_id, order_id, dc_id,
                date, due_date, payment_expected_date, subtotal, gst, total, amount_paid, credited,
                balance, currency_code, exchange_rate, late_fee, entity_id,
                status(open|partial|paid|overdue|void), age_bucket, cycle_token, zoho_synced_at
ar_credit_notes id, zoho_creditnote_id, number, client_id, invoice_id, amount, date, reason,
                zoho_synced_at                                        -- review DR-1
fin_payments    id, direction(in), zoho_payment_id, party_type(client), party_id, amount, date,
                method, ref, unapplied_amount, zoho_synced_at         -- payment header
fin_allocations id, payment_id, doc_type(invoice), doc_id, amount    -- review DR-2 (one payment
                → many invoices; leftover → payment.unapplied_amount)
ar_clients      client_id, zoho_contact_id, name, email, phone, credit_days(INT), currency_code,
                dunning_opt_out, zoho_synced_at                       -- customer/contact mirror
```
`credit_days` (net terms) is mirrored from the Books contact's `payment_terms` and drives the due-date
and dunning-tier logic in §7. `cycle_token` = hash(due_date+total) so a re-issued/edited invoice
restarts its ladder (review AD-6). `balance` is derived, never trusted from a partial Books payload.
`ar_invoices` carries **exactly the reference schema fields** so templates and rules port 1:1:
`due_date, payment_expected_date, age(→age_bucket), customer_id(→client_id), customer_name(join),
status, balance, transaction_number(→number), amount/total, currency_code, exchange_rate, entity_id,
reminders_sent, late_fee`.

### 6.2 Reminder engine (new, app-owned) — **keyed per customer, not per invoice**
```
reminder_rules   id, workflow(default|vip|disputed), tier, min_overdue_days, send_mode(auto|manual),
                 min_gap_days(default 5), tone, attach_pdf, channel_priority(json), active
reminder_templates id, name, lang, subject, body(merge-tag markup), conditional_blocks(json)
reminder_runs    id, client_id, tier, run_at, channel, status(sent|failed|suppressed),
                 gmail_message_id, suppressed_reason, invoice_ids(json), total_outstanding
reminder_holds   id, client_id|invoice_id, kind(negotiation|dispute|opt_out|ptp),
                 ptp_date, channel|null, set_by, set_at, cleared_at   -- review DR-5
```
A **reminder is one consolidated statement per customer per tier per due-cycle** (see §7), not one row
per invoice. `reminder_runs` records exactly which `invoice_ids` a statement covered and — critically —
**why a run was suppressed** (paid / hold / opt-out / gap-not-elapsed / no-email) so collectors see the
engine's non-sends (review DR-8). Idempotency: unique on `(client_id, tier, cycle_batch)`; the send
loop never double-sends and re-reads status at send time (see §8, review CF-4).

### 6.3 Merge tags (from AR mirror)
`{{customer_name}} {{transaction_number}} {{due_date}} {{balance}} {{amount}} {{currency_code}}`
`{{payment_expected_date}} {{entity}} {{reminders_sent}} {{late_fee}} {{pay_now_link}}` — all resolved
from the joined `ar_invoices` + client row; `{{pay_now_link}}` empty until the gateway slice lands.

---

## 7. Reminder / dunning engine — consolidated statement per customer

**Decision (operator):** the unit of reminding is **one consolidated statement per customer**, not one
email per invoice. Timing and tone are driven by each customer's **credit terms** (`credit_days`) and
the **due dates** of their open invoices.

### How a customer's tier is chosen
1. Due date for each invoice = Books `due_date` (fallback: `date + credit_days`).
2. Compute `overdue_days` per open invoice; the customer's **worst (max) overdue_days** across their
   open invoices selects the tier below.
3. Send **one** statement listing **all** the customer's open invoices (each with its own due date,
   age, amount) + total outstanding + one Pay-Now (§8b). Tone/attachment come from the selected tier.

| Tier | Selected when worst invoice is… | Tone | PDF | **Send mode** |
|---|---|---|---|---|
| Pre-due | −7…−1 days (approaching, per credit terms) | Early friendly notice | no | **auto** |
| On-due | due today (0) | Polite | no | **auto** |
| Overdue-1 | +1…+15 overdue | Firm, balance highlighted | **yes** | **collector-initiated** |
| Overdue-2 | +16…+30 overdue | Formal, references terms | **yes** | **collector-initiated** |
| Final | +30 overdue | Final notice, escalation path | **yes** | **collector-initiated** |

Tiers are `reminder_rules` rows (editable, no deploy). `min_overdue_days` defines the ladder;
`send_mode(auto|manual)` per tier defines the posture below.

### Send posture (operator decision O3) — auto up to on-due, then assisted
- **Automatic:** the daily cron sends **only Pre-due and On-due** statements, unattended.
- **Collector-initiated:** every **overdue** tier (Overdue-1/2, Final) is **not auto-sent**. The cron
  instead marks the customer **"follow-up due"** on the Receivables worklist; a collector reviews and
  clicks **"Send follow-up"** to dispatch. **Nothing overdue leaves without a human.**
- **Minimum gap:** after any mail to a customer, the next mail (auto or manual) is blocked until
  `min_gap_days` (default **5**) have elapsed. The worklist shows "eligible in N days"; the manual
  send button is disabled until the gap clears (override requires an explicit, audited confirm).

### Controls (from reference)
- **Min-gap (replaces the fixed weekly throttle):** ≤ one mail per customer every `min_gap_days`
  (default 5). Applies to auto and manual alike — the gap is the guardrail, the collector is the
  trigger for overdue mails.
- **Send-time:** one daily cron pass at a fixed send-hour; timezone-aware windowing is a follow-up
  (needs ≥ hourly cron — review CF-5).
- **Per-channel opt-out** and **dunning_opt_out** (whole-customer) honoured; **dispute/negotiation/PTP
  holds** suppress both auto and manual sends (PTP suppresses until `ptp_date`).
- **Workflow branching:** VIP / disputed routed to gentler templates.
- **Conditional content blocks:** show/hide statement sections by worst-age / total-balance.

### Execution
Runs on the **Cloudflare cron** (`scheduled`, `index.ts:3105`) **once daily**. Each pass: recompute
aging (F4) for all open AR → **group open invoices by customer** → pick the tier (table above):
- `send_mode=auto` (Pre-due, On-due) and customer eligible (not held/opted-out, gap cleared) → render
  **one** statement, send via Gmail API (§10a) + in-app, write a `sent` `reminder_runs` row;
- `send_mode=manual` (overdue) → write/refresh a **"follow-up due"** marker (no send) for the collector.

Manual follow-ups dispatch via `POST /api/finance/reminders/send-followup` (collector action) — same
render + Gmail send + `reminder_runs` write, gated by gap + holds. Ships **disabled**; first rollout is
a **dry-run** that renders statements and resolves recipients but sends nothing, so we catch missing
emails before go-live.

---

## 8. Auto-pause & payment matching (reference feature 08)

> **Prerequisite (review CF-2):** the only existing payment-received path, `handleZohoWebhook`
> (`index.ts:7940-7946`), updates **`purchase_orders`** (AP) by `invoice_number` and notifies role
> `finance_admin` — it touches **no AR** and would mis-map a customer payment onto a PO. It must be
> **fixed** to branch customer-vs-vendor payments and target `ar_invoices`/`fin_payments`. This is a
> **P3.1 task, not an "extend."** Auto-pause also requires the AR payment mirror to exist first.

The safety feature that prevents chasing paid invoices (batch model — there is no durable queue,
review CF-4):
- **Status re-read at send time:** immediately before dispatching a customer's statement in a cron
  tick, re-read live invoice status; drop any invoice that cleared and **skip the whole statement** if
  the customer now owes nothing. This is the batch-model equivalent of the reference's "pipeline
  purge" — no separate queue to purge.
- **On payment mirror / webhook:** when a mirrored payment (or the fixed `handleZohoWebhook`) moves an
  invoice to `paid`, recompute the customer's balance; if fully settled, no further statements select
  them.
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
- `GET /api/finance/reminders/runs` — statement send/suppression log (`reminder_runs`, incl. reasons).
- `GET /api/finance/reminders/followups-due` — customers the daily pass flagged for a **manual**
  overdue follow-up (worklist for §5.1), each with gap-eligibility.
- `GET /api/finance/reminders/preview?client_id=` — rendered statement (subject + body + covered
  invoices) for the send-follow-up confirm screen; no send.

Write (`finance_admin`/`super_admin`):
- `POST /api/finance/reminders/rules` — edit tiers/templates/branches.
- `POST /api/finance/reminders/run` — manual trigger of the **daily auto pass** (respects dry-run).
- `POST /api/finance/reminders/send-followup` — **collector-initiated** overdue statement for one
  customer; gated by `min_gap_days` + holds; `force:true` (audited) overrides the gap.
- `POST /api/finance/ar/:id/hold` — pause / dispute / opt-out / **ptp** (kind + optional ptp_date in body).
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

## 10a. Email transport — Google Workspace / Gmail API (operator decision)

The current `sendEmail` (MailChannels, `index.ts:138-153`) is fire-and-forget, error-swallowing, no
attachments, and MailChannels' free Workers route is discontinued (review CF-3). **Replaced with the
Gmail API** on the operator's Google Workspace. Cloudflare Workers cannot open raw SMTP sockets, so
this is the **REST API**, not SMTP relay:

- **Auth:** a Google **service account** with **domain-wide delegation**, impersonating a sending
  mailbox (e.g. `ar@<domain>`). The Worker signs an **RS256 JWT** with WebCrypto
  (`crypto.subtle.importKey`/`sign` — already used for our HMAC/PBKDF2 today, `index.ts:8,33`),
  exchanges it for an access token, and calls
  `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send`. Scope
  `https://www.googleapis.com/auth/gmail.send`.
- **Secrets (Worker secrets, never committed):** `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`,
  `GMAIL_SENDER` (impersonated mailbox). Delegation is authorised once in Google Admin console.
- **Attachments:** build an RFC-822 MIME multipart, base64url-encode, send via `messages.send` →
  **PDF statement/invoice attach works** (resolves the reference features 03/05 attachment gap).
- **Send status:** `messages.send` returns a Gmail `messageId` → `reminder_runs.status='sent'` is
  now **reliable** (unlike the swallowed MailChannels call). A non-2xx or thrown error →
  `status='failed'`, which triggers the in-app fallback per `channel_priority`.
- **Honest limits (scope-setting):** Gmail API gives a trustworthy *accepted-by-Gmail* signal but
  **does not** push delivered/opened/bounce webhooks like a transactional ESP.
  - *Opens* — optional tracking pixel served by our Worker; **follow-up, not v1**.
  - *Bounces* — arrive as Mailer-Daemon replies to the sending mailbox; programmatic bounce
    detection = a later mailbox-scan job. **v1 hard-bounce handling is manual** (collector marks a
    bad address); the reference's "delivery receipts (delivered/opened/failed)" downgrades to
    **"send-accepted + failed-on-API-error"** for v1.
  - Gmail Workspace send caps (~2,000 recipients/day/user) comfortably exceed our client count;
    consolidation (§7) keeps volume to ~one email per customer per cycle.

## 11. Open questions — resolved by the reference material

The three questions left open in `plan.md` are answered by the reference spec:

1. **Auto-link key.** Link on Books `reference_number` (invoice number = `transaction_number`) to our
   order/DC id; **manual-link fallback** for unmatched. → *Resolved: reference_number + manual
   fallback.*
2. **Reminder channels.** Reference wants **Email, SMS, WhatsApp, in-app**. → *Resolved: ship
   **email (Gmail API, §10a) + in-app** now; model channel-priority/fallback/opt-out now. SMS/WhatsApp
   are **net-new transactional integrations, not adapter wiring** (review CF-6: `sendSMS` is an MSG91
   OTP flow only; no WhatsApp exists; WhatsApp needs Meta/BSP template approval) — a later milestone.*
3. **Currency.** Reference is **multi-currency** (`currency_code`, `exchange_rate`, multi-currency
   checkout). → *Resolved: store & display `currency_code`/`exchange_rate` from Books from day one;
   reminders and Pay-Now default to the invoice's own currency; INR is the primary operating currency.*

### Decisions now made (v1.1)
- **Email transport = Google Workspace / Gmail API** (operator). See §10a. Replaces MailChannels.
- **Consolidation = one statement per customer, driven by credit terms + due dates** (operator).
  See §7. Final-notice tier exempt from the cadence throttle.
- **D1 — Late fees:** surface `late_fee` **from Books** only in this slice (no in-app fee computation).
- **D2 — PDF:** attach the **Books-rendered PDF** (authoritative), fetched via the Books API; fall
  back to a generated statement PDF if the Books PDF is unavailable.
- **D3 — Pay Now:** include the link only if a gateway link already exists; otherwise defer feature 06.

### Decisions made (v1.1, cont.)
- **O1 — Sending mailbox = `accounts@4syz.com`** (impersonated by the service account; `GMAIL_SENDER`).
- **O2 — Credit terms are per customer** → `ar_clients.credit_days` is a clean per-customer mirror
  (from the Books contact); no per-invoice terms handling needed.
- **O3 — Daily send pass, and a human-in-the-loop follow-up posture** (see §7 "Send posture"):
  the cron runs **once daily**; the system **auto-sends only up to the on-due mail**; every **overdue
  follow-up is collector-initiated** (a person clicks "Send follow-up"), with a **minimum gap** since
  the last mail enforced. No hourly cron / timezone windowing in this slice.

---

## 12. Phasing & sequencing

Reconciled with `plan.md` (F1–F4 foundation still applies). This slice reorders to deliver
collection value first:

1. **F1–F4 (+contacts, +integer money)** — Books client, generic idempotent mirror upsert (chunked by
   90), **contacts/customer mirror first** (so invoices link — review AD-3), integer-minor-unit money
   helper (AD-1), cron wiring (ships disabled), pure aging/status/tier function.
2. **P3.1a — AR mirror + correct balances** — invoices + payments + **payment allocation** +
   **credit notes** mirrored; **`handleZohoWebhook` fixed** to target AR (CF-2); aging; order/DC
   linkage + unlinked panel; Receivables cockpit + client statement.
3. **P3.1b — Email-delivery foundation** — Gmail API sender (§10a): RS256 JWT, `messages.send`,
   MIME attachments, status-returning; replaces MailChannels for finance email.
4. **P3.4′ — Payment Reminders (consolidated)** — rules/templates/`reminder_runs`, credit-terms-driven
   ladder, cron send loop (dry-run first), **consolidated statement per customer**, status re-read
   auto-pause, holds/PTP, suppression logging. Email + in-app only.
5. *(then, per plan.md)* P3.2 AP → P3.3 full 3-way reconciliation → P3.5 finance dashboard; plus
   deferred: WhatsApp/SMS channels, timezone send-windows, open-tracking pixel + bounce-scan, Pay-Now
   gateway, in-app late-fee computation.

Each step ships behind `tsc --noEmit` + `vitest` + smoke, role-gated, `?v=` bumped on changed public
files, deployed through the existing GitHub Actions loop.

---

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Reminder sent for a paid invoice | Send-time status re-read (§8); dry-run first; idempotent send keys. |
| Two sources of truth for money | Mirror-only; balances derived from Books; no in-app ledger/fee compute (D1). |
| Over-chasing / spam flags | Auto only up to on-due; overdue mail is collector-initiated; `min_gap_days` (5) between mails; per-channel opt-out; dispute/negotiation/PTP holds. |
| D1 "too many SQL variables" on bulk id lookups | Chunk by `D1_IN_CHUNK=90` (already-fixed inventory bug; regression test). |
| Client sees another client's AR | Strict role scoping; client endpoints filter to `client_id` = caller. |
| Books partial payload blanks a total | Never blank a field on partial payload (F2 rule); balances always derived. |

---

## 14. Acceptance criteria (this slice)

- Books invoices/payments/customers/**credit notes** mirror into the AR tables idempotently; re-sync
  is a no-op; > 90 existing ids update correctly (chunked by 90).
- **Balances are correct under real AR:** a credit note reduces balance/aging; a **lump-sum payment
  allocates across multiple invoices** with any remainder tracked as `unapplied_amount`; money is
  integer paise with no rounding drift.
- Receivables page shows correct outstanding, aging buckets, DSO; every invoice links to its order/DC
  or appears in the unlinked panel.
- **`handleZohoWebhook` routes a customer payment to AR** (not `purchase_orders`) and to the right
  invoice(s).
- Dunning ladder seeded from `reminder_rules`; editing a tier changes behaviour without a deploy.
- A **consolidated statement per customer** renders with live merge data (all open invoices + total);
  live preview matches what sends; tier is chosen by the customer's worst overdue invoice vs credit
  terms.
- **Send posture holds:** the daily pass auto-sends **only** Pre-due/On-due; every overdue tier is
  flagged "follow-up due" and sent **only** by a collector via `send-followup`; a mail within
  `min_gap_days` of the last is blocked (button disabled) unless force-overridden (audited).
- Gmail API send returns a `messageId` persisted to `reminder_runs.status='sent'`; an API error →
  `status='failed'` → in-app fallback fires; a PDF statement attaches successfully.
- Dry-run renders statements + resolves recipients and sends nothing; a customer with **no email** is
  flagged, not silently skipped.
- Status re-read at send time drops cleared invoices; a fully-paid customer is not sent a statement.
- Negotiation pause, dispute hold, **PTP snooze until `ptp_date`**, per-channel opt-out, and whole-
  customer `dunning_opt_out` each suppress the statement — and **every suppression is logged with its
  reason**.
- Client sees only their own statement; no role can send AP data to a client.
- DSO and aging match the pinned formulas (unit-tested pure function); a Books-edited invoice
  (`cycle_token` change) restarts its ladder; a voided invoice sends nothing.
- All money/reminder writes are idempotent and appear in the audit log.
```
