# Architect Review — Receivables & Payment Reminders PRD

**Reviewer:** Chief Architect (planning mode) · **Lens:** receivables/collections domain + Workers/D1
architecture · **Date:** 2026-09-28
**Subject:** `PRD-receivables-reminders.md` v1.0
**Method:** claims cross-checked against `src/index.ts` (read-only). Findings cite `file:line`.

> **Resolution (2026-09-28):** `PRD-receivables-reminders.md` **v1.1** folds in this review —
> email transport switched to Gmail API (CF-3), webhook fix made a P3.1 task (CF-2), Books write-back
> reclassified net-new (CF-1), "pipeline purge" redefined as send-time re-read (CF-4), channels
> re-scoped (CF-6), and the model gaps added (credit notes DR-1, payment allocation DR-2, dispute/PTP
> DR-5, suppression log DR-8, integer money AD-1, cycle token AD-6, contacts-first AD-3).
> Consolidation decided: **one statement per customer, credit-terms-driven** (DR-3), Final tier
> exempt from throttle (DR-4). Remaining to pin at build time: O1 sending mailbox, O2 credit-terms
> source, O3 cron cadence (see PRD §11).

## Verdict
**Strategy: strong. Feasibility claims: oversold. Domain model: incomplete.**
The Books-as-SoR / mirror-and-overlay decision is right and the phasing instinct (reminders-first) is
sound. But the PRD's "reuse, do not rebuild" framing hides that the two things the reminder engine
actually stands on — **outbound delivery** and **AR payment plumbing** — are stubs today. And a
receivables pro would reject the data model as missing credit notes, payment allocation, and
consolidated dunning. **Do not plan-to-build until the CF-* and DR-1/2/6 items are folded in.**

Grade: **B− as a vision doc, C+ as a build-ready PRD.**

---

## A. Reality-check on "reuse, do not rebuild" (grounded in code)

These correct false/again-optimistic claims in the PRD §10 / `context.md`:

| ID | Sev | Finding (evidence) | Impact on PRD |
|----|-----|--------------------|---------------|
| **CF-1** | High | `syncToZohoBooks` is a **stub** — `console.log` only, no API call (`index.ts:171-179`). | `context.md` calls Books write-back "partially present." It is **greenfield**. Keep write-back deferred (PRD already does) but stop calling it existing. |
| **CF-2** | High | The only payment-received path updates **`purchase_orders`** (AP) by `invoice_number` and notifies role `finance_admin` (`index.ts:7940-7946`). No AR table is touched. | PRD §8 "extend `handleZohoWebhook` to drive auto-pause" is built on an **AP** handler that would mis-map a **customer** payment onto a PO. Auto-pause needs (a) an AR invoice + payment mirror to exist first, and (b) the webhook to branch customer-vs-vendor. Make this an explicit P3.1 task, not an "extend." |
| **CF-3** | High | `sendEmail` uses MailChannels, `MAILCHANNELS_ENABLED`-gated, **fire-and-forget, errors swallowed, no attachments, no delivered/opened signal** (`index.ts:138-153`). MailChannels' free Workers route was discontinued. | Reference **feature 02 (delivery receipts: delivered/opened/failed)** and **03/05 (PDF auto-attach)** are **not satisfiable** by the current sender. An automated dunning engine with no delivery signal is a liability (silent failures → uncollected debt). This is the #1 real work item and the PRD hand-waves it as "reuse `sendEmail`." **Requires: pick a real ESP (Resend/SES/Postmark), a sender that returns status + supports attachments, and webhook ingestion for delivered/opened/bounced.** |
| **CF-4** | Med | Runtime is **batch-compute-then-send per cron tick**; there is no durable send queue. | Reference **feature 08 "pipeline purge"** and the PRD's `status=queued` imply a queue to purge. Either redefine purge as "re-read invoice status at send-time inside the tick" (cheap, recommended) or introduce Cloudflare Queues/Durable Objects (scope +). Fix the data model's `queued` state accordingly. |
| **CF-5** | Med | `scheduled` runs nightly full + a 3-hourly delta only (`index.ts:3105-3117`). | Tier day-offsets (T−7…T+30) are fine, but reference **feature 01 "send-time window: business hours + customer timezone"** needs ≥ hourly ticks and a new `wrangler` cron trigger; otherwise ±3h drift. Call out the config change + drift, or drop per-timezone windows from the first slice. |
| **CF-6** | Med | `sendSMS` is hardwired to an MSG91 **OTP flow** (`flow_id:"smartpantry_otp"`, `OTP` field) (`index.ts:156-168`); no WhatsApp exists. | PRD §11 Q2 calls SMS/WhatsApp "stub adapters." They are **net-new transactional integrations** (templated WhatsApp needs Meta/BSP template approval). Re-scope honestly. |
| **CF-7** | Low | INR is baked into money formatting and the MSG91 `91` prefix. | Storing `currency_code`/`exchange_rate` is easy; "charge in customer currency" (feature 06) + locale formatting is more than two columns. Keep multi-currency as *store + display* in this slice (PRD already leans this way — make it explicit that no multi-currency *charging* ships). |

**Net:** the honest critical path for a working reminder engine is **AR invoice+payment mirror (incl.
webhook fix) → a real email sender with delivery signal → the dunning loop**. The PRD's "reuse"
language makes items 1–2 look free. They are the milestone.

---

## B. Receivables-domain gaps a collections pro would block on

| ID | Sev | Gap | Why it matters |
|----|-----|-----|----------------|
| **DR-1** | High | **No credit notes / write-offs / adjustments** in the data model. | `balance = total − amount_paid` is wrong the moment an invoice is credited or partially written off. Real AR = `total − amount_paid − credits ± adjustments`. Add `ar_credit_notes` + include in balance/aging. |
| **DR-2** | High | **No payment allocation / unapplied (on-account) payments.** `fin_payments` assumes one payment → one `doc_id`. | Customers pay lump sums across many invoices, or pay in advance. Need an allocation table (payment ↔ invoice, amount) and an "unapplied credit" concept, or balances and auto-pause misfire. |
| **DR-3** | Med | **Consolidation rule undefined.** One overdue reminder **per invoice** or **one statement per customer**? | Reference implies per-`transaction_number`; collections best practice is a **consolidated** statement email. Drives deliverability, throttle, and template design. Must be decided before build. |
| **DR-4** | Med | **Throttle vs escalation precedence undefined** (cadence cap can silently suppress a Stage-3 final notice). | Define precedence: escalation tiers exempt from throttle, or throttle wins. Ambiguity = either spam or missed final notice. |
| **DR-5** | Med | **Dispute + Promise-to-Pay lifecycle is a single flag.** | Pros need dispute state (raised/amount-in-dispute/resolved), partial disputes, and **PTP date** tracking (snooze reminders until promised date). Model as first-class, not a boolean hold. |
| **DR-6** | Med | **DSO + aging boundaries not specified.** | Define: DSO method (simple avg vs count-back); is due-today "current" or bucket 0; overdue starts T+1; age from `due_date`. Unit-testable pure function (PRD F4) needs these fixed. |
| **DR-7** | Med | **Statement of account undefined.** | "Client statement" (§5.3) needs opening balance + activity + closing, period- and currency-bound. Specify it. |
| **DR-8** | Low | **No suppression audit.** `reminder_log` records sent/delivered/failed but not **why not sent** (paid/hold/opt-out/throttle/no-email). | Collectors won't trust automation they can't see deciding *not* to send. Add suppression reasons. |
| **DR-9** | Low | **No bounce/right-party handling.** | Repeated sends to dead addresses wreck sender reputation (ties to CF-3). Hard-bounce → auto-disable channel for that contact. |

---

## C. Architecture / data-model notes

- **AD-1 — Money type.** PRD stores amounts as REAL "paise-rounded." With `exchange_rate`
  multiplication this drifts. **Recommend INTEGER minor units (paise/cents)**; format on read.
- **AD-2 — `reminders_sent` is duplicated** (on `ar_invoices` *and* derived from `reminder_log`).
  Pick one: derive on read (a view/COUNT), or document a strict recompute-on-write invariant. Don't
  let two counters drift.
- **AD-3 — Client identity mapping missing.** Books `customer_id` ↔ our `client_id` must be resolved
  **before** invoices mirror, or everything lands unlinked. Sequence **contacts sync first** (feature
  07 "customer data sync"), then invoices, then payments.
- **AD-4 — Link-match confidence not stored.** PRD has manual link + fallback but no
  `match_confidence`/`match_method` column or audit. Store how each invoice was linked.
- **AD-5 — Books rate limits/volume.** Reuse the inventory `MAX_PAGES_PER_RUN` + `modifiedSince`
  delta + backoff; the PRD mentions delta but not per-entity cursors, rate-limit handling, or backoff.
  Spell out the multi-entity cursor design (invoices/payments/contacts each carry a watermark).
- **AD-6 — Idempotency key must survive re-issue.** `(invoice_id, tier, channel)` breaks if Books
  edits `due_date` or voids+reissues. Include a **cycle token** (e.g., hash of due_date+total) so a
  changed invoice restarts its ladder cleanly.

---

## D. What the PRD gets right (keep)

- Books = SoR, mirror-and-overlay, no second ledger — the load-bearing call is correct.
- Provenance columns + `D1_IN_CHUNK=90` chunking discipline carried over from the inventory bug.
- Ships **disabled + dry-run first** — consistent with the inventory rollout that worked.
- Role scoping (client sees only own AR; writes finance-gated) is right and matches existing gates
  (`index.ts:8551`, `6030`).
- Auto-pause as the headline safety feature — correct priority for a dunning system.

---

## E. Required changes before this is plan-ready

1. **Rewrite §10 + the "reuse" framing** to reflect CF-1/CF-2/CF-3: Books write-back, AR payment
   plumbing, and a delivery-tracking email sender are **net-new**, not reuse.
2. **Add an email-delivery sub-milestone** (real ESP + status-returning sender + attachments +
   delivered/opened/bounce webhook) as a **hard prerequisite** of the reminder loop. Without it,
   features 02/03/05 are undeliverable.
3. **Extend the data model** with `ar_credit_notes`, a **payment-allocation** table, dispute/PTP
   state, and suppression logging (DR-1/2/5/8). Switch money to **integer minor units** (AD-1).
4. **Fix `handleZohoWebhook`** to branch customer vs vendor payments and target AR — call it out as a
   P3.1 task (CF-2).
5. **Decide the consolidation rule** (per-invoice vs per-customer statement) and **throttle/escalation
   precedence** (DR-3/4) — both block template + engine design.
6. **Pin the numbers:** DSO method, aging boundaries, statement definition, currency scope
   (store+display, no charging) (DR-6/7, CF-7).
7. **Re-scope channels honestly** (CF-6): email + in-app this slice; SMS/WhatsApp are separate
   integrations with their own approval lead time.
8. **Redefine "pipeline purge"** as send-time status re-read (CF-4), or add Queues/DO to scope.

## F. Suggested revised first-slice scope (tighter than PRD §12)
1. F1–F4 foundation **+ contacts mirror** (AD-3) + integer-money helper (AD-1).
2. **P3.1a:** AR invoice mirror + payment mirror + **payment allocation** + `ar_credit_notes` +
   webhook fix (CF-2). Receivables cockpit with correct balances/aging.
3. **P3.1b:** email-delivery foundation (real ESP, status, attachments, bounce webhook) (CF-3).
4. **P3.4′:** dunning ladder + templates + dry-run + auto-pause (send-time re-read) + holds/PTP +
   suppression log. Email + in-app only.
Everything else (AP, 3-way reconcile, Pay-Now gateway, WhatsApp/SMS, in-app late-fee compute,
per-timezone windows) stays sequenced after.

## G. Added acceptance criteria (fold into PRD §14)
- Credit note / write-off reduces balance and aging correctly.
- Lump-sum payment allocates across multiple invoices; unapplied remainder tracked; auto-pause fires
  only on the invoices actually cleared.
- Consolidated-vs-per-invoice reminder behaves per the decided rule; throttle never suppresses the
  final-notice tier.
- Every send **and every suppression** is logged with reason; a hard bounce disables that channel for
  the contact.
- Email send returns a status persisted to `reminder_log`; a failed send triggers the fallback channel.
- DSO and aging match the pinned formulas (unit-tested pure function).
- Invoice edited in Books (due_date/total) restarts its reminder cycle; voided invoice sends nothing.
