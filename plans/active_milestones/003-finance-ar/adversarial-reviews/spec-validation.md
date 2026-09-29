# Spec Adversarial Review — Receivables & Payment Reminders PRD

> `spec-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `003-finance-ar` |
| Artifact | `plans/active_milestones/003-finance-ar/PRD-receivables-reminders.md` (v1.1) |
| Date | 2026-09-28 |
| Gate | 2-of-3 majority |
| Result | **17 confirmed · 13 unconfirmed** — highest severity **high** |

## Verdict

**Not ready to plan against as-is.** The strategy holds, but the spec has 17 confirmed defects
including 5 three-vote highs and two outright textual contradictions in the document. The consistent
theme: the shift to a **consolidated-per-customer, assisted-follow-up** model was not propagated into
the mechanics — the idempotency key, merge tags, `cycle_token`, min-gap semantics, currency totals,
and dispute scope were all written for a per-invoice world and break under consolidation. Fixing the
confirmed findings (folded into PRD **v1.2**, §15) makes it plan-ready.

## Confirmed Findings (≥ 2 votes)

> Folded into PRD v1.2 §15 "Locked specification decisions" (and inline where a clause was wrong).

### 🔴 `cron-fires-multiple-times-daily` — "once daily" is false against the codebase · 3/3
- **Clause:** "Runs on the **Cloudflare cron** (`scheduled`, `index.ts:3105`) **once daily**."
- **Malicious reading:** `wrangler` registers `["30 3 * * *","0 */3 * * *"]` and `scheduled()` runs its
  whole body every tick (~9×/day). Hang the send loop off it ungated → auto statements fire 9×/day.
- **Harm:** up to 9 duplicate Pre-due/On-due emails per customer per day; polluted metrics/audit.
- **Tightening:** send pass executes only when `controller.cron === '<named send-hour expr>'`; add that
  trigger to `wrangler.jsonc`; test that a 3-hourly tick performs zero sends.

### 🔴 `idempotency-key-undefined` — `cycle_batch` is never defined · 3/3
- **Clause:** "Idempotency: unique on `(client_id, tier, cycle_batch)`; the send loop never double-sends"
- **Malicious reading:** `cycle_batch` appears in no schema and has no definition; `cycle_token` is
  per-invoice but a statement spans many invoices. Pick a constant (dun once ever), a per-run uid
  (never collides → always double-send), or today's date (can't restart on edit).
- **Harm:** either permanent suppression or unbounded duplicates; the headline "never double-sends"
  guarantee is unbuildable and untestable. Root cause of `cycle-token-vs-per-customer` mismatch.
- **Tightening:** define `cycle_batch = ` a deterministic digest over the sorted set of covered
  invoices' `cycle_token`s; add the column + `UNIQUE(client_id, tier, cycle_batch)` index; insert the
  row (INSERT OR IGNORE) **before** the Gmail call. Test: two runs in one window → one row, one email.

### 🔴 `min-gap-vs-final-exempt-contradiction` — §7 and §11 contradict · 3/3
- **Clause:** §7 "Min-gap … **Applies to auto and manual alike**" vs §11 "Final-notice tier **exempt
  from the cadence throttle**."
- **Malicious reading:** implementer follows either clause; Final notice is either silently blocked for
  5 days or exempt and spammable.
- **Harm:** the exact DR-4 defect resurfaces — missed final notice, or spam.
- **Tightening:** pick one rule and state it in both places. **Decision:** all tiers incl. Final obey
  `min_gap_days`; delete the §11 exemption line. (Final is reached by escalation, not by ignoring gap.)

### 🔴 `dso-aging-formulas-not-pinned` — "pinned formulas" don't exist · 3/3
- **Clause:** "DSO and aging match the pinned formulas (unit-tested pure function)"
- **Malicious reading:** no DSO method, age-from date, overdue-start, or bucket-edge ownership is
  stated. Code any formula; the test asserts what the code returns → passes vacuously.
- **Harm:** DSO and aging unverifiable; SPA, API, and pure function can silently disagree.
- **Tightening:** pin in §15 — age from `due_date`; overdue at ≥1; disjoint half-open buckets
  (Current=0 / 1–30 / 31–60 / 61–90 / ≥91); DSO = (AR ÷ trailing-N-day credit sales)×N with N and
  sales source named; 2–3 worked examples the test reproduces.

### 🔴 `cross-currency-total-undefined` — one scalar total across currencies · 3/3
- **Clause:** "Send **one** statement listing **all** the customer's open invoices … + total
  outstanding"; "KPI row: Total outstanding … DSO."
- **Malicious reading:** `reminder_runs.total_outstanding` is one scalar; sum INR+USD into one number.
- **Harm:** nonsensical totals (₹200 = $100+₹100); mis-fired conditional blocks; garbage DSO.
- **Tightening:** never sum across currencies. Group the statement by `currency_code` with a subtotal
  and one Pay-Now per currency; store `total_outstanding` as a per-currency map; KPI totals are
  per-currency (no FX conversion in v1 — that would make the app a second ledger).

### 🔴 `client-scoping-idor` — per-endpoint enforcement not required · 2/3 (S1 med, S2 high → high)
- **Clause:** "`GET /api/finance/ar/client/:id` — statement"; §13 "client endpoints filter to
  client_id = caller."
- **Malicious reading:** endpoint trusts the path param; client A requests `/client/B` and reads B's
  statement; a `client_*` token hits `/ar/invoices` and gets everyone's.
- **Harm:** cross-tenant AR data leak (IDOR).
- **Tightening:** for any `client_*` caller, the server **forces** `client_id = caller.client_id`
  (403 on mismatch) and rejects all `/ar/*` and `/reminders/*` except the self-scoped statement. Add
  an authz test: client A → `/client/B` returns 403, no data.

### 🔴 `send-atomicity-crash-and-concurrency` — send before record, no lock · 2/3 (both high)
- **Clause:** "same render + Gmail send + `reminder_runs` write"; "there is no durable queue".
- **Malicious reading:** order is render→send→write. A crash after Gmail accepts but before the write
  → no idempotency row → next run re-sends. Two collectors (or cron+collector) both pass the gap
  TOCTOU check and both send. A mid-batch isolate eviction emails some, records none.
- **Harm:** duplicate dunning emails; "never double-sends" holds only for the log row, not the send.
- **Tightening:** **reserve** the `reminder_runs` row in a `sending` state (claims the unique key)
  **before** the Gmail call; on 2xx → `sent`+messageId; on error → `failed`; a stale `sending` row on
  the next run is treated as already-attempted. Bound each tick to a max customer count with a
  persisted cursor for continuation. Concurrency + crash tests.

### 🔴 `aging-timezone-undefined` — UTC vs IST day boundary · 2/3 (S3 high, S2 med → high)
- **Clause:** "Compute `overdue_days` per open invoice"; "one daily cron pass at a fixed send-hour".
- **Malicious reading:** Workers run UTC; operator is IST (UTC+5:30). `now_utc − due_date` classifies
  an IST-today invoice as +1 overdue for 5.5h; on-due mail lands on the wrong calendar day.
- **Harm:** customers dunned a day before terms lapse (legal/relationship hazard); auto/manual
  boundary flips at midnight.
- **Tightening:** pin **Asia/Kolkata (IST)** as the single clock; the pure aging function takes an
  explicit IST civil `today`; pin the send-hour as a named config value referenced by the cron guard.

### 🔴 `credit-note-application-undefined` — on-account & split credits · 2/3 (S1 med, S2 high → high)
- **Clause:** "`total − amount_paid − credited`"; "`ar_credit_notes … invoice_id, amount`"; auto-import
  lists only invoices/customerpayments/contacts.
- **Malicious reading:** credit notes aren't even fetched (`/creditnotes` omitted) → table always
  empty → "credit reduces balance" passes vacuously. One nullable `invoice_id` can't express
  on-account or multi-invoice credits; whole credit dumped on one invoice or dropped.
- **Harm:** balances/aging wrong for any credited customer; over-chasing credited debt.
- **Tightening:** add `GET /books/v3/creditnotes` with its own cursor; add a credit-allocation table
  (credit ↔ invoice, amount) mirroring payments; `credited(invoice)=Σ applied credit allocations`;
  model on-account (invoice_id NULL) as customer-level credit; one authoritative source (recompute
  `credited`, never hand-set).

### 🔴 `dispute-scope-invoice-vs-customer` — one dispute freezes whole customer · 2/3 (both high)
- **Clause:** "flag an invoice disputed → **suppress all reminders** until cleared"
- **Malicious reading:** consolidated statement + "suppress all" → a ₹100 dispute on 1 of 10 invoices
  silences collection on the other 9 (classic evasion), or the disputed invoice still aggregates into
  the total/Pay-Now (chasing disputed money).
- **Harm:** uncollected debt or chasing disputed amounts — both G4 failures.
- **Tightening:** invoice-level dispute **excludes that invoice** from tier selection, total, and
  Pay-Now, but the customer is still reminded for the rest; only customer-level holds
  (negotiation/opt-out) suppress the whole statement; log excluded invoices + reason on the run.

### 🟠 `force-override-unbounded` — self-serve gap bypass · 3/3 (2 med, 1 high → medium)
- **Clause:** "`force:true` (audited) overrides the gap."
- **Malicious reading:** any collector sets `force:true` every call — unlimited back-to-back overdue
  mail, fully "audited"; and it's unstated that force must **not** bypass holds/opt-out.
- **Harm:** min-gap is toothless; possible mailing of opted-out/disputed customers (compliance breach).
- **Tightening:** `force` overrides **only** min-gap, **never** a hold/opt-out/PTP; require a reason
  string; cap forced sends (hard floor e.g. 1/customer/24h) and/or require `super_admin`. Test:
  force + active opt-out = no send.

### 🟠 `pdf-fallback-unspecified` — no generator, "unavailable" undefined · 3/3 (all med)
- **Clause:** "attach the **Books-rendered PDF** … fall back to a generated statement PDF if the Books
  PDF is unavailable."
- **Malicious reading:** Workers can't trivially render PDFs; no library named; "unavailable"
  undefined. Treat any non-200 as unavailable, attach nothing; happy-path acceptance still passes.
- **Harm:** overdue notices (which require a PDF) go out with no attachment on any Books hiccup.
- **Tightening:** define "unavailable" (non-2xx or timeout > N s after M retries); a send with
  `attach_pdf=true` either attaches a valid PDF or is recorded `failed` — never sent PDF-less; name
  the concrete fallback (a Books statement-of-account PDF endpoint, or "no attachment + flag" if none
  in v1). Test the Books-PDF-timeout path.

### 🟠 `tier-boundary-overlap-at-30` — +30 matches two tiers · 3/3 (2 med, 1 low → medium)
- **Clause:** "Overdue-2 | +16…+30 overdue … Final | +30 overdue"
- **Malicious reading:** at exactly 30 days both match; pick whichever comparison is first.
- **Harm:** Final notice fired a day early, or stalls in Overdue-2 — non-deterministic escalation.
- **Tightening:** disjoint half-open bands: Overdue-2 = 16–30, Final = ≥31; rule "highest tier whose
  `min_overdue_days ≤ worst_overdue_days` wins," driven purely off `reminder_rules` so table & engine
  can't disagree. Test days 15/16/30/31.

### 🟠 `dry-run-vs-disabled-tristate` — one boolean can't hold three states · 3/3 (all med)
- **Clause:** "**Global switch:** reminders enabled/disabled (ships **disabled**, dry-run first)"
- **Malicious reading:** one boolean maps `enabled`→live, skipping dry-run; or dry-run swallows
  collector `send-followup`s the collector thinks went out. Storage/owner/audit of the flag unstated.
- **Harm:** first enable sends production mail with no dry-run safety; or dangerous control has no
  owner/audit.
- **Tightening:** explicit tri-state `reminders_mode ∈ {off|dry_run|live}` in a persisted config row;
  writes `super_admin`-only and `audit(...)`-logged; `dry_run` applies to cron **and** `send-followup`
  and `/run` (render+resolve+log `status='dry_run'`, zero Gmail sends); go-live requires a clean
  dry-run log. Test each mode.

### 🟠 `min-gap-clock-basis` — what starts the 5-day clock? · 2/3 (both med)
- **Clause:** "after any mail to a customer, the next mail … is blocked until `min_gap_days`"; "a
  non-2xx … → `status='failed'`, which triggers the in-app fallback".
- **Malicious reading:** a failed/suppressed/dry-run run or an in-app fallback counts as "a mail" →
  one transient Gmail 500 freezes a customer for 5 days; or failures don't count → flapping retries.
- **Harm:** silent under-collection or spam, depending on the reading.
- **Tightening:** only a **successfully accepted email** (status=`sent`) starts the gap, counted in IST
  whole calendar days; `failed`/`suppressed`/`dry_run` rows and in-app-only sends do **not** start it;
  a failed email is eligible for retry next pass (with backoff).

### 🟠 `ptp-expiry-unbounded` — promise-to-pay never expires · 2/3 (low+med → medium)
- **Clause:** "PTP suppresses until `ptp_date`"
- **Malicious reading:** `ptp_date=2099` silences forever; past date undefined; nothing resumes
  dunning when the promise breaks; `cleared_at` population unspecified.
- **Harm:** a careless/malicious PTP permanently exempts a customer; or a broken promise never resumes.
- **Tightening:** cap `ptp_date` to ≤ 60 days out, reject past dates; on `ptp_date < today` with the
  invoice still open, the hold auto-expires (`cleared_at` set, audited) and the customer re-enters the
  ladder at the computed tier. Test past/future/expired PTP.

### 🟡 `reminders-sent-counter-source` — two counters, per-invoice tag on per-customer send · 3/3 (2 low,1 med → low)
- **Clause:** "`ar_invoices … reminders_sent`"; merge tag "`{{reminders_sent}}`"
- **Malicious reading:** kept as both an `ar_invoices` column and derivable from `reminder_runs`; for
  consolidated sends a per-invoice count is meaningless. Leave at 0 → "This is reminder #0".
- **Harm:** wrong/zero counter in customer emails; two counters drift.
- **Tightening:** derive on read = COUNT of `sent` `reminder_runs` covering the customer; drop the
  `ar_invoices.reminders_sent` column; `{{reminders_sent}}` is account-level (# prior statements).

### 🟠 `sync-robustness` (thematic cluster, 3 skeptics, distinct facets) — medium
- Facets: `sync-no-page-cap-backoff` (S1), `delta-sync-ordering-inconsistency` (S2),
  `backfill-day-one-no-completeness-gate` (S3). Each 1 vote individually, but all three independently
  attacked multi-entity sync robustness.
- **Harm:** a large first sync trips Workers subrequest/CPU or Zoho rate limits and aborts with
  partial data; interleaved deltas derive wrong balances; enabling reminders during backfill spams for
  coincidentally-dated old invoices.
- **Tightening:** pin `MAX_PAGES_PER_RUN` + per-entity `modifiedSince` watermark + 429/5xx backoff
  (inventory pattern); sync ordering contacts → invoices → creditnotes → payments/allocations; derive
  balances only after all streams for the run complete; **gate reminders hard-disabled until an
  `initial_backfill_complete` flag** is set. _(Cluster, not an identical finding — flagged for the
  author; treated as confirmed given 3 independent facets.)_

## Unconfirmed (FYI · 1 vote)

| `id` | sev | note |
|---|---|---|
| `money-real-vs-integer-contradiction` | 🔴 | §6 says "Amounts REAL, paise-rounded" **and** "INTEGER minor units" — a literal contradiction. **Fixing regardless** (self-evident). |
| `per-invoice-merge-tags-on-consolidated` | 🔴 | §6.3 tags are per-invoice scalars; statement is per-customer. Needs account-level tags + a per-invoice repeat block. **Likely fix.** |
| `opt-out-source-and-precedence` + `no-unsubscribe` | 🔴 | `dunning_opt_out` is on the mirrored `ar_clients` row → next sync could overwrite an app-set opt-out (compliance bug); no unsubscribe link. **Likely fix.** |
| `payment-allocation-ingestion-invariant` | 🔴 | `fin_allocations` modelled but population rule + invariant (Σ alloc + unapplied = payment) unstated. **Likely fix.** |
| `balance-excludes-late-fee` | 🟠 | derived `total−amount_paid−credited` omits `late_fee`; may diverge from Books balance. |
| `worst-overdue-locks-customer-auto` | 🟠 | a customer with any overdue invoice never gets the auto pre-due for a *new* invoice. |
| `auto-tiers-starved-by-min-gap` | 🔴 | min-gap between Pre-due(T−3) and On-due(T=0) blocks the on-due. Fold into min-gap fix: allow one send per tier per cycle regardless of gap. |
| `invoice-status-ownership` | 🟠 | `status` includes app-derived `overdue` but table is mirrored; sync vs aging can flap. |
| `in-app-fallback-external-clients` | 🟠 | clients are external; in-app fallback reaches no one. |
| `gmail-token-caching-auth-failure` | 🟠 | no token cache / 401-retry / distinct auth-failure alert. |
| `void-not-webhooked-race` | 🟠 | void only reaches mirror on next sync; a statement can send between. |
| `partial-pay-reschedule-noop` | 🟠 | "reschedule remaining tiers" is meaningless in the batch model. |
| `stale-followup-marker` | 🟡 | worklist marker not cleared when customer pays/held before collector acts. |

## Attacks That Failed (corroborate the spec holds here)

- **D1 100-var limit** — spec mandates `D1_IN_CHUNK=90` + regression test; verified in code.
- **Money REAL drift** — pinned INTEGER paise + derived balances (the REAL line is a leftover
  contradiction, fixed separately, not the intent).
- **`handleZohoWebhook` mis-map to PO** — real bug, but named an explicit P3.1 fix, not hand-waved.
- **Re-sync not idempotent** — provenance + "no-op on re-sync" concretely required, matches inventory.
- **MailChannels swallows errors** — replaced by Gmail API returning `messageId` with sent/failed.
- **Webhook authenticity** — `X-Zoho-Webhook-Secret` already verified in code and reused.
- **Write-endpoint role gating** — finance_admin/super_admin gating matches the existing role model.
- **Overdue auto-spam** — the assisted (collector-initiated) posture soundly guards overdue tiers.

## Actions Taken

- [x] Fixed inline: `money-real-vs-integer-contradiction`, `tier-boundary-overlap-at-30`,
  `cron-fires-multiple-times-daily`, `min-gap-vs-final-exempt-contradiction`.
- [x] Added PRD **§15 "Locked specification decisions (adversarial validation r1)"** pinning every
  confirmed finding's tightening + the 4 strong unconfirmed highs.
- [x] Surfaced remaining unconfirmed findings in the PRD §15 "Deferred / noted" list.
- [ ] Re-run panel on revision → not planned (fixes are additive pins; will be caught at plan-validation).
