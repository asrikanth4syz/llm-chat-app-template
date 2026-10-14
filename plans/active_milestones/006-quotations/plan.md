# Technical Plan: 006-quotations (GIFTSYZ Quotations in Smart Pantry)

> **Planning artifact only — no code written in this milestone step.** Companion docs:
> `context.md` (fit assessment + resolved decisions), `calc-spec.md` (pricing/GST oracle),
> `data-model.md`, `api-contracts.md`, `adversarial-reviews/spec-validation.md` (r1, 31 findings folded).
> **r2:** spec-validation tightenings folded in; the groups below carry the added tenancy/concurrency/
> verifier/idempotency work.

## 🔍 Analysis & Context
- **Objective:** Fold the GIFTSYZ quotation workflow into the Smart Pantry Worker/D1 SPA, reusing the
  platform spine, with a **configurable per-user feature entitlement** (allowlist + quote-role).
- **Affected / new files:**
  - NEW `src/quote_calc.ts` — pure calc engine (no I/O).
  - NEW `test/quote_calc.test.mjs` — 18 PRD calc vectors + rounding/GST-split edge cases.
  - `src/index.ts` — `ensureQuoteSchema`, `requireQuoteAccess`, quote handlers, route block (~4480),
    `scheduled()` reminder pass (~4441), `quoteHashChain` helpers (reuse `crypto.subtle`).
  - NEW `public/app.NN-quotes.js` — Quotations SPA module (delegated handlers only).
  - `public/app.01-core.js` — `ROLES`? no; add `NAV`/`ACTION_PAGES['quotations']` + `PAGE_MAP` entries
    + nav badge wiring; `canAccessPage` already generic.
  - `public/index.html` — module load order + nav slot.
  - `test/smoke.mjs` — register new module + assert handler resolution + page gating.
  - NEW `migrations/00NN_quotations.sql` — parity mirror of `ensureQuoteSchema` (runtime truth is self-heal).
  - `plans/00-ROADMAP.md` — add milestone entry.
- **Key dependencies:** D1 `env.DB.batch()` (atomic multi-write), WebCrypto `crypto.subtle` (SHA-256,
  already used `src/index.ts:9`), `app_config` (`getConfig`/`setConfig` `:236/:242`), `currentFY`/
  `allocateDCSeriesNumber` pattern (`:341/:360`), `approval_chain_*` pattern, `pushNotification`
  (`:2695`), `scheduled()` (`:4441`).
- **Risks / edge cases:**
  - **Self-heal runner splits on `;`** → every schema stmt must be a single statement; **no triggers,
    no multi-statement strings**. Immutability enforced in app code, not DB.
  - **GST correctness** (CGST/SGST vs IGST, ITC non-claimable into landed cost, rounding half-up 2dp →
    round-off to rupee) → isolate in `quote_calc.ts`, lock with the 18 vectors *before* any handler.
  - **SoD bypass** — creator approving own quote; same user holding two quote-roles → enforce at act
    time (403), not just submit.
  - **Redaction leak** — cost/margin reaching `ops` role via list/detail/document/calc → single
    `redactForQuoteRole()` chokepoint applied on every response path; smoke/unit test it.
  - **Hash-chain integrity** — concurrent version appends → serialize via `batch()` reading
    `current_version` + `prev_hash` and writing both in one atomic batch; reject on version mismatch.
  - **Entitlement consistency** — nav shows tile but server 404s (or vice-versa) → both read the same
    `quote.enabled_users` key; nav calls `GET /api/quotes/access` on load rather than trusting client state.
  - **CSP** — zero inline JS; all handlers via `data-act`/`data-input`/`data-change` globals.

## 📋 Task Execution (Parallel Groups)

### Group 1 (Parallel — independent files) — ✅ BUILT (468 tests green, tsc clean, smoke green)
- [x] Task 1.A: `src/quote_calc.ts` — pure pricing/landed-cost/GST/margin/rounding engine (integer paise + bp, BigInt division).
- [x] Task 1.B: `test/quote_calc.test.ts` (vitest, repo convention) + `test/fixtures/quote_calc_vectors.json` — all 18 vectors byte-exact + rounding + validation (422) + I0-a integer guard; I0-b float-grep in `test/smoke.mjs`.
- [x] Task 1.C: data-model.md/api-contracts.md field list final (r1–r4 folds).

### Group 2 (Depends on Group 1 — schema + entitlement)
- [ ] Task 2.A: `ensureQuoteSchema(env)` + `_quoteSchemaReady` guard + parity migration file. **Includes
  `account_id` on every table and all UNIQUE constraints** (quote_id,version / quote_id,seq /
  account_id,quote_no) that back the concurrency guarantees.
- [ ] Task 2.B: `requireQuoteAccess` (+enum validation, fail-closed), `getQuoteEnabledUsers` (per-tenant key,
  malformed→empty), admin access/settings endpoints (self-grant block, `_ver` optimistic concurrency,
  `quote_entitlement_audit`), `GET /api/quotes/access` (**exempt from the guard**).
- [ ] Task 2.C: `redactForQuoteRole()` — **allowlist-based, deep** (nested payload_json/detail_json); unit
  test every role × every response path (list/detail/calc/versions/document/audit/today/bell).
- [ ] Task 2.D: `canonical()` (RFC 8785) + `sha256Hex` + audit preimage builder + `verifyQuoteChain` with
  unit test vector (payload→digest). Tenancy helper `requireQuoteTenant` wrapping `denyClientCrossAccess`.

### Group 3 (Depends on Group 2 — quote CRUD + immutable versions)
- [ ] Task 3.A: Quote counter + `POST /api/quotes` (v1) + `GET` list/detail + hash helpers.
- [ ] Task 3.B: `PUT /api/quotes/:id` version append + chain + `GET /versions`.

### Group 4 (Depends on Group 3 — approvals/SoD + lifecycle)
- [ ] Task 4.A: submit/approve/reject with SoD + conditional Finance leg + `quote_audit` chain.
- [ ] Task 4.B: send/accept/lost transitions + notifications.

### Group 5 (Depends on Group 4 — customer document + hash)
- [ ] Task 5.A: `quote_documents` generation (redacted, hashed) + `GET /document`.

### Group 6 (Depends on Group 5 — reminders / Today / bell)
- [ ] Task 6.A: reminder seeding + `runQuoteReminderPass` cron + snooze.
- [ ] Task 6.B: follow-ups + `GET /today` + `GET /bell`.

### Group 7 (Depends on 2–6 — SPA surface, built incrementally alongside each slice)
- [ ] Task 7.A: `public/app.NN-quotes.js` pages (list, editor, approvals, Today, admin settings) + nav/PAGE_MAP/ACTION_PAGES + `test/smoke.mjs` registration.

## 📝 Step-by-Step Implementation Details

### Prerequisites
- Pick next free SPA module number `NN` (inspect `public/` ordering) and next migration number.
- Confirm no route-prefix collision for `/api/quotes` (grep `src/index.ts`).

#### Task 1.A / 1.B — Calc engine (the keystone; build + lock first)
1. **Unit test harness (write first):** `test/quote_calc.test.mjs`.
   - Vectors: cost+markup line; MRP−disc line; mixed-line quote; ITC-claimable=Yes (GST excluded from
     landed cost) vs No (GST folded into landed cost); CGST/SGST (intra-state) vs IGST (inter-state) by
     `place_of_supply`; multi-rate GST slabs in one quote; freight + branding allocation; weighted
     margin across lines; rounding: half-up to 2dp per line then round-off to nearest rupee on grand
     total; zero-qty / zero-price guards; negative-margin flag. **≥18 assertions** mirroring PRD §pricing.
2. **Implementation:** `src/quote_calc.ts` exports pure fns, no `env`/no I/O:
   - `landedCost(line, {itcClaimable})`, `unitPrice(line)`, `lineGst(line, {intraState})`,
     `computeQuote(input): { lines, totals, weighted_margin, rounding }`, `roundHalfUp(n,dp)`,
     `roundOffRupee(n)`.
   - Deterministic; same shape the host would unit-test like `src/smart_paste.ts`.
3. **Verification:** `node --test test/quote_calc.test.mjs` → all pass. **No handler until green.**

#### Task 2.A — Schema (self-heal)
1. **Harness:** add a smoke assertion that `ensureQuoteSchema` creates all tables (local D1) and is
   idempotent on second call.
2. **Implementation:** `ensureQuoteSchema(env)` after `ensureSmartPasteSchema` (~`src/index.ts:6206`
   pattern) — one `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` per `prepare().run()`,
   guarded by module-level `_quoteSchemaReady`. Call it at the top of every quote handler (cheap after
   first). Mirror the same DDL into `migrations/00NN_quotations.sql` (single statements, no triggers).
3. **Verification:** `npm test` smoke + a local `wrangler dev` hit to a quote route that provisions tables.

#### Task 2.B — Entitlement gate (**the added requirement**)
1. **Harness:** unit test `requireQuoteAccess` → returns quoteRole for allowlisted user; 404-signal for
   non-listed; empty config ⇒ everyone denied.
2. **Implementation:**
   - `getQuoteEnabledUsers(env)` → `JSON.parse(getConfig(env,'quote.enabled_users','{}'))`.
   - `requireQuoteAccess(user,env)` → `{quoteRole}` or throw→404.
   - Admin: `GET/PUT /api/admin/quote-access` (list users + upsert/remove one mapping; audited),
     `GET/PUT /api/admin/quote-settings`. Gate admin routes to `super_admin|ops_admin`.
   - `GET /api/quotes/access` for the SPA to decide nav visibility.
3. **Verification:** curl matrix — enabled user 200, disabled user 404, admin PUT grant→user now 200,
   revoke→404; assert in a small integration test.

#### Task 2.C — Redaction chokepoint (allowlist, deep)
1. **Harness:** unit test asserts an `ops` (or unknown) role response contains **only** the allowlisted keys —
   i.e. none of `purchase_cost_paise, markup_bp, mrp_paise, discount_bp, freight_alloc_paise,
   branding_cost_paise, landed_cost_paise, line_margin_paise, input_gst_paise, weighted_margin_bp, itc_*`
   at **any** nesting depth (incl. nested `payload_json`/`detail_json`).
2. **Implementation:** single allowlist helper applied on **all 8** response paths (list/detail/calc/versions/
   document/audit/today/bell); deep-redacts nested JSON; unknown role → full redaction (fail-closed).
3. **Verification:** per-role × per-path test + grep that no quote response serializes raw rows/payloads
   without passing through it.

#### Task 3.A / 3.B — Quote CRUD + immutable versions
1. **Harness:** integration test — create quote (v1, has `content_hash`, `prev_hash=null`); edit→v2
   (`prev_hash==v1.content_hash`, `current_version=2`, v1 row unchanged); edit on non-DRAFT→409.
2. **Implementation:**
   - Counter allocate inside create `batch()` using `currentFY()`; `quote_no` format from settings prefix.
   - `sha256Hex(canonical(payload))` via `crypto.subtle.digest`.
   - Create/edit write header + `quote_versions` + `quote_lines` + `quote_audit` in **one**
     `env.DB.batch([...])`; version append reads current + prev_hash and writes both atomically.
3. **Verification:** integration test asserts immutability (old version row byte-identical) + chain links.

#### Task 4.A / 4.B — Approvals (SoD) + lifecycle
1. **Harness:** tests — submit computes finance leg iff `itc=0 || total≥500000`; creator approving own
   quote→403; manager approves, finance approves→APPROVED; reject→DRAFT.
2. **Implementation:** reuse `approval_chain_*` shapes into `quote_approvals`; act-time SoD guard
   `actor_id!==created_by`; role-of-leg check against caller's quoteRole; `pushNotification` to creator.
3. **Verification:** integration tests for the two approval shapes (with/without finance leg) + SoD 403.

#### Task 5.A — Customer document + hash
1. **Harness:** test — `send` on APPROVED produces `quote_documents` row with `content_hash`, status→SENT,
   and the stored content contains **no** cost/margin/ITC strings.
2. **Implementation:** render redacted doc (HTML→stored b64; PDF optional later), `sha256Hex(bytes)`,
   `GET /document` returns content + hash.
3. **Verification:** test asserts hash stability + redaction.

#### Task 6.A / 6.B — Reminders / Today / bell
1. **Harness:** tests — `send` seeds the 3 due dates (R1=send+2d, R2=send+7d, R3=valid−2d; offsets ≤ send
   skipped); `runQuoteReminderPass` fires due PENDING/SNOOZED then sweeps SENT→EXPIRED; dedups
   `(quote_id,rule)`; snooze only from PENDING; `GET /today` + `GET /bell` shapes.
2. **Implementation:** add a gated branch in `scheduled()` (`src/index.ts:4441`) calling
   `runQuoteReminderPass(env)`; follow-ups endpoints; Today aggregates due reminders + follow-ups +
   expiring; bell = my pending approvals + my due follow-ups.
3. **Verification:** unit-test the pass with a frozen clock; smoke the Today/bell endpoints.

#### Task 7.A — SPA surface
1. **Harness:** `test/smoke.mjs` — register `app.NN-quotes.js`; assert every `data-act`/`data-change`/
   `data-input` resolves to a global; assert `PAGE_MAP`/`ACTION_PAGES['quotations']`/`canAccessPage`
   gate the quote pages; assert nav tile hidden unless `GET /api/quotes/access` says enabled.
2. **Implementation:** list / editor (calc preview via `/calc`) / approvals / Today / **admin settings
   (toggle users + quote-role)** pages — delegated handlers only (CSP). Wire `public/index.html` order
   + nav slot + bell badge.
3. **Verification:** `npm test` (smoke) green; manual `wrangler dev` click-through of grant→see tile,
   revoke→tile gone.

### 🧪 Global Testing Strategy
- **Unit:** `quote_calc.ts` (18 vectors), `requireQuoteAccess`, `redactForQuoteRole`, hash/chain
  helpers, reminder-pass with frozen clock. All pure, no D1.
- **Integration (local D1 via wrangler/miniflare):** entitlement 404/200 matrix, create→version→immutable,
  submit/approve SoD + finance-leg, send→document hash + redaction, reminder dedup.
- **Smoke (`test/smoke.mjs`):** handler resolution + page gating + nav entitlement for the new module.

## 🎯 Success Criteria (r2)
- **Integer-only money/rates (calc-spec §0 I0):** no `REAL` column, no float computation, nothing float
  hashed; money is integer paise, rates are integer basis points (`_bp`). `tsc` brands `Paise`/`Bp` so a
  raw float can't be assigned into a money/rate position, and the I0-test greps `src/quote_calc.ts` for
  `/ 100`, `/ 10000`, `parseFloat`, float fields → fail. Every value the engine returns is
  `Number.isInteger`.
- `quote_calc.ts` passes all **18 named vectors** in `test/fixtures/quote_calc_vectors.json` **byte-exact**
  (all integers), covering intra/inter-state, per-line ITC fold, multi-rate basket, odd-paisa split
  (`541→271/270`), round-off ties, per-unit freight (qty>1), and the ₹5L boundary (`50000000` paise, asserted
  in the submit test) — fixtures **hand-authored, not engine-generated**; CI fails if < 18; **before** any
  persistence code.
- Every `quote_*` row carries `account_id`; a cross-tenant `:id` read/write returns 404 (test with two
  tenants); the feature config is per-tenant.
- Two concurrent `PUT` version-appends (and two concurrent creates) never fork the chain or duplicate
  `quote_no`: one succeeds, the other fails the batch and retries (integration test with racing writes).
- `verifyQuoteChain` recomputes and links every hash; tampering a stored row makes it report
  `verified:false` with the first broken version.
- Grant/revoke + quote-role assignment take effect with **no deploy**; nav re-checks `/access` per
  navigation; an unknown/typo'd role fails closed (no cost shown, no approval power).
- Redaction is allowlist-based and deep: an `ops` (or unknown) role receives **zero** cost/margin keys
  (incl. `weighted_margin`, `freight_alloc`, `branding_cost`, `mrp`, `discount_pct`) on **all 8** response
  paths and in the customer document — asserted by a path-coverage test + CI grep.
- SoD: approver ∉ {creator ∪ all version authors} (403); sole-approver submit returns 409 before PENDING;
  reject supersedes all rows; Finance leg iff `!itc_claimable_all` OR post-round-off grand ≥ ₹5,00,000.
- Reminders fire per the 3-step state machine (dedup; snooze only from PENDING; accept/lost/expire cancel PENDING+SNOOZED);
  SENT→EXPIRED via cron; Today/bell computed in IST with the defined predicates.
- Idempotency-Key honored on all mutations (replay cached; body-mismatch 409).
- `npm test` green (unit + integration + smoke); CSP intact (no inline JS); self-heal provisions all tables
  idempotently; `tsc` clean.

## 📌 Notes for downstream (spec-validation / construction)
- This plan is derived from an **external PRD**, not a validated in-repo `spec.md`. Recommend a
  `spec-validator` pass on `context.md`+`data-model.md` before construction, focused on: GST/ITC/rounding
  correctness, the entitlement model's three-layer enforcement, and immutability/SoD guarantees.
- Deploy remains **manual** (`npx wrangler deploy`); ships inert until an admin populates
  `quote.enabled_users`.
