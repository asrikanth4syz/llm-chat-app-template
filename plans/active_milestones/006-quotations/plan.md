# Technical Plan: 006-quotations (GIFTSYZ Quotations in Smart Pantry)

> **Planning artifact only — no code written in this milestone step.** Companion docs:
> `context.md` (fit assessment), `data-model.md`, `api-contracts.md`.

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

### Group 1 (Parallel — independent files)
- [ ] Task 1.A: `src/quote_calc.ts` — pure pricing/landed-cost/GST/margin/rounding engine.
- [ ] Task 1.B: `test/quote_calc.test.mjs` — 18 calc vectors + edge cases (written against 1.A's exported signatures; co-authored so they land together).
- [ ] Task 1.C: `data-model.md`/`api-contracts.md` already drafted — no code; finalize field list only.

### Group 2 (Depends on Group 1 — schema + entitlement)
- [ ] Task 2.A: `ensureQuoteSchema(env)` + `_quoteSchemaReady` guard + parity migration file.
- [ ] Task 2.B: `requireQuoteAccess`, `getQuoteEnabledUsers`, admin access/settings endpoints + `GET /api/quotes/access`.
- [ ] Task 2.C: `redactForQuoteRole()` chokepoint helper + unit test.

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

#### Task 2.C — Redaction chokepoint
1. **Harness:** unit test `redactForQuoteRole('ops', payload)` strips `purchase_cost,markup_pct,margin,
   landed_cost,itc_*`; other roles untouched.
2. **Implementation:** single helper applied on list/detail/calc/document response builders.
3. **Verification:** test + grep that no quote response serializes raw rows without passing through it.

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
1. **Harness:** tests — `send` seeds R1–R8 due dates; `runQuoteReminderPass` fires only due+PENDING,
   dedups `(quote_id,rule)`, marks SENT; snooze pushes `snooze_until`; `GET /today` + `GET /bell` shapes.
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

## 🎯 Success Criteria
- `quote_calc.ts` passes all 18 PRD calc vectors incl. CGST/SGST-vs-IGST, ITC-into-landed-cost, and
  rounding policy — **before** any persistence code.
- A user can be granted/revoked the Quotations feature **and** assigned a quote-role from the admin
  Settings UI, taking effect with **no deploy**; nav + server + approvals all honor it.
- Editing a quote never mutates a prior version; `quote_versions` + `quote_audit` form verifiable
  SHA-256 chains.
- SoD holds: a creator cannot approve their own quote (403); Finance leg appears iff ITC=No or ≥₹5,00,000.
- `ops` quote-role never receives cost/margin/ITC on any endpoint or in the customer document.
- Reminders R1–R8 fire once each (deduped) via the cron pass; Today + bell reflect due work.
- `npm test` green; CSP intact (no inline JS); self-heal provisions all tables idempotently.

## 📌 Notes for downstream (spec-validation / construction)
- This plan is derived from an **external PRD**, not a validated in-repo `spec.md`. Recommend a
  `spec-validator` pass on `context.md`+`data-model.md` before construction, focused on: GST/ITC/rounding
  correctness, the entitlement model's three-layer enforcement, and immutability/SoD guarantees.
- Deploy remains **manual** (`npx wrangler deploy`); ships inert until an admin populates
  `quote.enabled_users`.
