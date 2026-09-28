# Technical Plan: 003-finance-ar — Slice 1 (AR mirror + Gmail + consolidated dunning)

> Executable, micro-stepped build plan for the first shippable slice, derived from
> `PRD-receivables-reminders.md` v1.2 (authoritative; **§15 "Locked specification decisions"** governs
> every ambiguity). The high-level milestone sequencing lives in `plan.md`; this file is what the
> engineer executes. Validation gate for every task: `npx tsc --noEmit` + `npx vitest run` +
> `node test/smoke.mjs`, then deploy via the existing GitHub Actions loop.

## 🔍 Analysis & Context
- **Objective:** Mirror AR (invoices/payments/credit-notes/contacts) from Zoho Books into local
  read-model tables, present a Receivables cockpit, send Gmail via a service-account transport, and run
  a consolidated-per-customer dunning engine (auto pre-due/on-due; collector-initiated overdue) — all
  behind a tri-state mode that ships `off`.
- **Affected files:**
  - `src/index.ts` (all backend: schema self-heal, Books client, mirror upsert, endpoints, cron,
    Gmail transport, dunning engine). Single-file worker — every handler lives here.
  - `public/app.01-core.js` (nav entries + `canAccessPage`/`ACTION_PAGES` for a Finance section).
  - `public/app.05-billing-inventory.js` **or a new `public/app.11-finance.js`** (Receivables +
    Reminders pages). New file preferred to keep diffs isolated; must be registered in `index.html`
    with a `?v=` stamp.
  - `wrangler.jsonc` (add the `SEND_CRON` trigger; declare new secrets are *not* here — secrets stay
    Worker secrets).
  - `test/index.test.ts` (vitest unit/integration), `test/smoke.mjs` (delegated-target + route smoke).
  - `public/index.html` (script tag + `?v=` for the new finance JS).
- **Key dependencies:** existing `zohoGetToken`/`zohoFetchPage` (generalise to Books), `audit`,
  `pushNotification`, `getConfig`/`setConfig`, `D1_IN_CHUNK=90`, `chunkSkus` pattern, `crypto.subtle`
  (RS256 for Gmail JWT), `scheduled()` at `index.ts:3105`, role gate arrays.
- **Risks/Edge cases (from spec-validation §15):** cron multi-fire; `cycle_batch` idempotency +
  reserve-before-send; IST clock; per-currency totals; credit-note/allocation math; IDOR; dispute
  scope; PTP expiry; tri-state mode; PDF fallback; opt-out overwrite-on-sync; backfill-complete gate.
- **Established patterns to mirror:** provenance columns (`zoho_*_id`,`zoho_synced_at`), idempotent
  upsert chunked by 90 (the inventory bug — never regress), `json(...)` responses, `getUser`/
  `requireUser` + role arrays, ships-disabled + dry-run rollout.

## 📋 Task Execution (Parallel Groups)

*Tasks in a group are independent (no shared function/file region) and may run in parallel. A later
group depends on earlier ones.*

### Group 1 — Foundations (parallel; pure/isolated units)
- [ ] **1.A Aging/tier/DSO pure module** — `src/index.ts` (new pure functions) + `test/index.test.ts`.
      No I/O; takes explicit IST `today`.
- [ ] **1.B Money helpers** — `src/index.ts` (`toPaise`/`fromPaise`/`formatMoney`) + tests. Integer
      minor units only.
- [ ] **1.C IST date helpers** — `src/index.ts` (`istToday()`, `daysBetweenIST(a,b)`) + tests.
- [ ] **1.D Schema self-heal** — extend `ensureFeatureTables`/`fixCategoryNames` with the AR tables
      (§6 + §15). Additive `CREATE TABLE IF NOT EXISTS` / `ALTER … ADD COLUMN` guarded like existing.

### Group 2 — Books client + mirror (depends on 1.B/1.C/1.D)
- [ ] **2.A Books fetch client** — `booksFetch(entity,{page,modifiedSince})` generalising
      `zohoFetchPage`; `MAX_PAGES_PER_RUN`, 429/5xx backoff. Injectable for tests.
- [ ] **2.B Generic idempotent mirror upsert** — keyed on `zoho_*_id`, existing-id lookup chunked by
      `D1_IN_CHUNK=90`; never blanks on partial payload; stamps `zoho_synced_at`.
- [ ] **2.C Entity mappers** — invoices, customerpayments (+applied lines → `fin_allocations`),
      creditnotes (+allocations), contacts (→`ar_clients`, `dunning_opt_out` app-owned/preserved).
- [ ] **2.D Sync orchestrator** — order contacts→invoices→creditnotes→payments; per-entity watermark;
      derive balances only after all streams complete; set `initial_backfill_complete` when caught up.

### Group 3 — AR read API + cockpit (depends on Group 2)
- [ ] **3.A AR read endpoints** — `/ar/invoices`, `/ar/summary`, `/ar/client/:id` with **forced
      client scoping** (§15 IDOR).
- [ ] **3.B Webhook fix** — branch `handleZohoWebhook` customer-vs-vendor; customer payment → AR.
- [ ] **3.C Receivables SPA page** — KPI row, per-currency aging, drill to order/DC, unlinked panel.
      New `public/app.11-finance.js` + nav wiring in `app.01-core.js` + `index.html` `?v=`.

### Group 4 — Gmail transport (depends on Group 1; parallel with Group 3)
- [ ] **4.A Google SA JWT + token** — RS256 sign via `crypto.subtle`, exchange, **cache to expiry +
      single-flight refresh + re-mint on 401 once**; distinct auth-failure state.
- [ ] **4.B `gmailSend`** — build RFC-822 MIME (+ base64url), optional attachment; returns
      `{ok, messageId} | {ok:false, error}`.

### Group 5 — Dunning engine (depends on Groups 2,3,4)
- [ ] **5.A `reminder_*` schema + seed rules** — tables incl. `cycle_batch`,
      `UNIQUE(client_id,tier,cycle_batch)`, audit columns; seed the 5 tiers (§7).
- [ ] **5.B Statement builder** — group open invoices by customer, exclude invoice-scope disputes/
      settled, per-currency subtotals, tier by highest `min_overdue_days≤worst`, render merge tags
      (account-level + per-invoice block).
- [ ] **5.C Send core (atomic)** — reserve `reminder_runs` (`sending`) → gmailSend → `sent`/`failed`;
      gap check on last `sent`; holds/opt-out/PTP suppression + logging; `reminders_mode` honoured.
- [ ] **5.D Cron pass** — gate on `SEND_CRON`; auto tiers only; `MAX_CUSTOMERS_PER_RUN` + cursor; skip
      unless `initial_backfill_complete`.
- [ ] **5.E Follow-up endpoints + Reminders SPA** — `followups-due`, `preview`, `send-followup`
      (force bounds), `rules`, `runs`; Reminders page + worklist.

## 📝 Step-by-Step Implementation Details

### Prerequisites
- Worker secrets set (out of band, not committed): `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`,
  `GMAIL_SENDER=accounts@4syz.com`, Books scope on the Zoho refresh token, `ZOHO_BOOKS_ORG_ID`.
- No behaviour ships enabled: `reminders_mode` defaults `off`; sync flag defaults disabled.

#### Task 1.A — Aging/tier/DSO pure module
1. **Test harness** — `test/index.test.ts`:
   - `agingBucket(dueDate, today)` → Current for `today==due`; `1..30`→"1-30"; `30`→"1-30"; `31`→
     "31-60"; `90`→"61-90"; `91`→"91+". Assert buckets partition (no value in two buckets).
   - `selectTier(worstOverdueDays, rules)` → highest tier whose `min_overdue_days ≤ worst`; boundary
     days 0/1/15/16/30/31 map to Current/Overdue-1/Overdue-1/Overdue-2/Overdue-2/Final.
   - `computeDSO(openAR, creditSales90)` → `(openAR/creditSales90)*90`; `creditSales90==0` → 0 (no
     divide-by-zero), documented.
2. **Implementation** — add pure functions (no `env`, no `Date.now()` inside; `today` passed in).
3. **Verify** — `npx vitest run -t "aging"` and `-t "tier"` and `-t "dso"` pass.

#### Task 1.B — Money helpers
1. **Test** — `toPaise("1234.56")==123456`; `fromPaise(123456)=="1234.56"`; round-trip stable;
   `toPaise` rejects/handles null → 0 with a flag; no float drift over 10k additions.
2. **Impl** — integer paise; `formatMoney(paise,currency)` for display only.
3. **Verify** — `npx vitest run -t "money"`.

#### Task 1.C — IST date helpers
1. **Test** — `istToday(fixedUtcInstant)` returns the IST civil date across the 18:30 UTC boundary
   (an instant at 18:45 UTC is *next* IST day); `daysBetweenIST` counts whole civil days.
2. **Impl** — compute via fixed +05:30 offset (India has no DST); functions take an injected `now`.
3. **Verify** — `npx vitest run -t "ist"`, incl. the midnight-boundary case.

#### Task 1.D — Schema self-heal
1. **Test** — a test DB migration run creates `ar_invoices, ar_credit_notes, fin_payments,
   fin_allocations, credit_allocations, ar_clients, reminder_rules, reminder_templates,
   reminder_runs, reminder_holds`; re-running is a no-op; every money column has INTEGER affinity
   (PRAGMA table_info); `reminder_runs` has `cycle_batch`, `actor`, `workflow`, `forced`,
   `recipient_email`, and `UNIQUE(client_id,tier,cycle_batch)`.
2. **Impl** — add guarded `CREATE TABLE IF NOT EXISTS` + `ALTER ADD COLUMN` in the existing self-heal
   path; add config keys `reminders_mode` (default `off`), `initial_backfill_complete` (`0`),
   `SEND_HOUR`/`SEND_CRON` constants.
3. **Verify** — `npx vitest run -t "schema"`; `npx tsc --noEmit`.

#### Task 2.A — Books fetch client
1. **Test** — with an injected fetch stub: paginates until `< per_page`; stops at
   `MAX_PAGES_PER_RUN`; retries a 429/500 with backoff then surfaces a typed error; passes
   `If-Modified-Since`.
2. **Impl** — `booksFetch(entity,{page,modifiedSince})` over `/books/v3/<entity>` with
   `ZOHO_BOOKS_ORG_ID`; reuse `zohoGetToken`.
3. **Verify** — `npx vitest run -t "booksFetch"`.

#### Task 2.B — Mirror upsert
1. **Test** — inserts new rows; updates > 90 existing ids in one call **without** "too many SQL
   variables" (regression for the inventory bug, chunk by 90); a partial payload missing `total`
   does not blank the stored `total`; stamps `zoho_synced_at`.
2. **Impl** — generic `upsertMirror(table, keyCol, rows)` with chunked existing-id lookup.
3. **Verify** — `npx vitest run -t "mirror upsert"`.

#### Task 2.C — Entity mappers
1. **Test (each mapper):**
   - invoice → `ar_invoices`, money to paise, `cycle_token=hash(due_date+total)`, `status` mirrored
     (open/partial/paid/void) — derived `overdue`/settled computed later, not stored on the mirror.
   - customerpayment → `fin_payments` + one `fin_allocations` row per applied invoice line; assert
     `Σ(allocations)+unapplied_amount == payment.amount`; `amount_paid(invoice)=Σ allocations`.
   - creditnote → `ar_credit_notes` + `credit_allocations`; on-account (no invoice) → customer-level;
     `credited(invoice)=Σ applied`.
   - contact → `ar_clients`; **`dunning_opt_out` is preserved if already set locally** (upsert must
     not overwrite an app-set opt-out from a blank Books value).
   - balance: `total + late_fee − amount_paid − credited`; equals Books-supplied balance to the paise.
2. **Impl** — pure mapper functions + the opt-out-preserving upsert branch.
3. **Verify** — `npx vitest run -t "map"` incl. the allocation-invariant and opt-out-preserve tests.

#### Task 2.D — Sync orchestrator
1. **Test** — order is contacts→invoices→creditnotes→payments; a payment referencing a not-yet-
   mirrored invoice is deferred + reconciled (not dropped); balances derived only after all streams;
   `initial_backfill_complete` flips true only when all watermarks are caught up; re-run is a no-op.
2. **Impl** — `runBooksSync(env,{full})`; per-entity watermark in `app_config`; manual endpoint
   `POST /api/integrations/zoho-books/sync` (super_admin/finance_admin).
3. **Verify** — `npx vitest run -t "books sync"`.

#### Task 3.A — AR read endpoints
1. **Test** — finance/ops get all; a `client_*` token calling `/ar/invoices` → 403; `/ar/client/:B`
   with caller≠B → 403 no data; `/ar/client/:self` → only own; `/ar/summary` totals are per-currency;
   aging matches 1.A.
2. **Impl** — handlers with `getUser`/`requireUser`; for `client_*` **force** `client_id=caller` and
   reject cross-id. Register routes in the `route()` switch near other `/api/finance` paths.
3. **Verify** — `npx vitest run -t "ar read"` + smoke route registration.

#### Task 3.B — Webhook fix
1. **Test** — a customer-payment webhook updates AR (`fin_payments`/invoice), **not**
   `purchase_orders`; a vendor path still hits AP; unknown event is a safe no-op; secret still checked.
2. **Impl** — branch `handleZohoWebhook` on party/entity; keep `X-Zoho-Webhook-Secret` check.
3. **Verify** — `npx vitest run -t "webhook"`.

#### Task 3.C — Receivables SPA
1. **Test** — smoke: page registered, nav gated to finance/ops, every `dataAct` target resolves.
2. **Impl** — `public/app.11-finance.js` render funcs; nav in `app.01-core.js`; `?v=` in `index.html`.
3. **Verify** — `node test/smoke.mjs`; manual load.

#### Task 4.A — Google SA JWT + token
1. **Test** — signs an RS256 JWT (verify header/claims); caches the token until ~expiry (second call
   ⇒ no new exchange); a 401 triggers exactly one re-mint; a token-exchange failure yields a distinct
   `auth_error` (not per-recipient failure).
2. **Impl** — `crypto.subtle.importKey('pkcs8', …, 'RSASSA-PKCS1-v1_5'/'SHA-256')` + `sign`; token
   cache in module scope keyed to expiry.
3. **Verify** — `npx vitest run -t "gmail auth"`.

#### Task 4.B — gmailSend
1. **Test** — builds valid MIME (headers, base64url body); attaches a PDF part when given; returns
   `{ok,messageId}` on stubbed 2xx and `{ok:false,error}` on non-2xx (no throw); never logs the SA key.
2. **Impl** — `gmailSend(env,{to,subject,html,text,attachment?})` → `users/me/messages/send`.
3. **Verify** — `npx vitest run -t "gmailSend"`.

#### Task 5.A — reminder schema + seed
1. **Test** — tables exist with the unique index; seeding is idempotent; the 5 tiers match §7
   (`send_mode`, `min_overdue_days`, `min_gap_days`, `attach_pdf`).
2. **Impl** — extend self-heal + a seed-on-empty for `reminder_rules`.
3. **Verify** — `npx vitest run -t "reminder schema"`.

#### Task 5.B — Statement builder
1. **Test** — groups a customer's open invoices; **excludes** an invoice-scope-disputed invoice and a
   settled (balance≤0) invoice but still builds a statement for the rest; a two-currency customer gets
   two subtotals and no blended total; tier = highest `min_overdue_days≤worst`; per-invoice merge
   block renders each invoice, account-level tags render totals; `cycle_batch` = digest over covered
   `cycle_token`s (changes when a covered invoice edits).
2. **Impl** — pure `buildStatement(customer, invoices, rules, today)`.
3. **Verify** — `npx vitest run -t "statement"`.

#### Task 5.C — Send core (atomicity + suppression)
1. **Test** —
   - reserve-before-send: INSERT `sending` row happens before `gmailSend`; on gmail failure the row
     becomes `failed` (not deleted); a stale `sending` row on re-run is treated as attempted (no
     re-send).
   - idempotency: two calls same `(client_id,tier,cycle_batch)` ⇒ one email, one `sent` row (unique
     violation on the 2nd aborts before send).
   - gap: a `sent` email <`min_gap_days` ago blocks; `failed`/`suppressed`/`dry_run`/in-app-only do
     **not** start the gap.
   - suppression: dispute(customer)/negotiation/opt-out/`dunning_opt_out`/PTP-未expired ⇒ no send + a
     `suppressed` row with typed reason; PTP past its date auto-expires and no longer suppresses.
   - mode: `reminders_mode=dry_run` writes `dry_run` rows and calls `gmailSend` **zero** times;
     `off` writes nothing; `live` sends.
   - force: `force:true` overrides gap only; with an active hold/opt-out it still refuses; a 2nd
     forced send within 24h is refused (hard floor).
2. **Impl** — `sendStatement(env,customer,tier,{mode,force,actor})` with the atomic claim + audit.
3. **Verify** — `npx vitest run -t "send core"` (this is the highest-risk task; broadest tests).

#### Task 5.D — Cron pass
1. **Test** — with `controller.cron !== SEND_CRON` ⇒ zero sends; with `SEND_CRON` and
   `initial_backfill_complete=0` ⇒ zero sends; when complete ⇒ auto tiers (pre-due/on-due) send,
   overdue tiers write "follow-up due" markers (no send); a second same-day invocation is a no-op via
   the daily `cycle_batch` guard; batch caps at `MAX_CUSTOMERS_PER_RUN` and advances a cursor.
2. **Impl** — extend `scheduled()` (`index.ts:3105`) with the gated pass; add `SEND_CRON` to
   `wrangler.jsonc`.
3. **Verify** — `npx vitest run -t "cron pass"`.

#### Task 5.E — Follow-up endpoints + Reminders SPA
1. **Test** — `followups-due` lists only manual-tier eligible customers with gap-eligibility;
   `send-followup` respects gap/holds/force bounds and is finance-gated; `preview` renders without
   sending; `rules` GET/POST finance-gated; `runs` returns statuses+reasons+actor. Client token → 403
   on all. Smoke: page + `dataAct` targets resolve.
2. **Impl** — handlers + `public/app.11-finance.js` Reminders page & worklist; `?v=` bump.
3. **Verify** — `npx vitest run -t "followup"` + `node test/smoke.mjs`.

### 🧪 Global Testing Strategy
- **Unit (pure):** aging/tier/DSO, money, IST dates, statement builder, entity mappers, allocation
  invariant, `cycle_batch` digest — all no-I/O, table-driven.
- **Integration (D1 + stubbed fetch):** mirror upsert (>90 chunk regression), sync ordering/deferral,
  AR read scoping/IDOR, webhook AR-routing, send-core atomicity/idempotency/suppression/mode/force,
  cron gating + backfill gate + daily no-op.
- **Contract/smoke:** every new route registered; every delegated SPA target resolves; `tsc` clean.
- **Gmail/Books:** always injected stubs — never hit live Google/Zoho in tests.

## 🎯 Success Criteria
- All PRD §14 acceptance criteria pass as automated tests (money integer, no-op re-sync, >90 chunk,
  balances with credits, per-endpoint IDOR 403, per-currency totals, dispute-scope, send atomicity,
  dry-run zero-send, gap/force/PTP semantics, cron single-fire + backfill gate, DSO/aging formulas).
- `npx tsc --noEmit`, `npx vitest run`, `node test/smoke.mjs` all green; test count strictly increases.
- Ships with `reminders_mode=off` and Books sync disabled; enabling requires a clean dry-run log.
- Deployed green through GitHub Actions; `?v=` bumped on changed public files.
- No secret ever printed/logged/committed; every money & reminder write is `audit(...)`-logged.
