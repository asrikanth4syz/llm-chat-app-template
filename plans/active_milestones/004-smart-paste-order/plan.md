# Technical Plan: 004-smart-paste-order

> Translates `spec.md` (authoritative layer: "Revisions from spec-validation r2") into a
> micro-stepped, TDD-first build. Companion docs: `data-model.md`, `api-contracts.md`.
> Architect is read-only on code; this plan is for the Engineer. **Do not commit** (Auditor's job).

## 🔍 Analysis & Context

- **Objective:** Let an ops/admin user paste a free-text item+qty list for a chosen client and get a reviewable DRAFT order, each line matched to a `client_catalog` SKU via deterministic parse + token-Jaccard scoring, with confidence + "why", confirmation logged.
- **Affected files:**
  - `src/index.ts` — new pure-ish handlers `handleParsePaste`, `handleFromPaste`; shared matcher helper; 2 route registrations (near line 4480); schema add in `ensureFeatureTables` (`stmts[]` ~2821, `alters[]` ~2823); config keys.
  - `src/smart_paste.ts` — **NEW** pure module (no DB): `parsePasteText`, `scoreCandidate`, `confidenceOf`, unit/number grammar. Keeps all branchy logic unit-testable in isolation.
  - `migrations/0053_smart_paste.sql` — **NEW** (mirrors `data-model.md`).
  - `public/app.19-smart-paste.js` — **NEW** UI (paste entry + review table + handlers). Keeps `app.03` lean.
  - `public/index.html` — add `<script src="app.19-smart-paste.js?v=…">`; the Ordering page already loads via the SPA.
  - `public/app.03-ordering.js` — add ONE "📋 Smart Paste" entry button near the existing "Upload Order Sheet" (`quickNavCSV`); no other change.
  - `test/smart_paste.test.ts` — **NEW** pure-logic unit tests (the safety harness).
  - `test/index.test.ts` — extend with endpoint integration tests (existing vitest-pool-workers file).
- **Key dependencies (reuse, do not reinvent):** `normNameForMatch` (src/index.ts:2413); the Jaccard+margin loop (2519-2522) → extract into `src/smart_paste.ts`; `denyClientCrossAccess` (125); `handleCreateOrder` save_as_draft path (6091-6104) as the DRAFT/`order_items`/`computeOrderGst` reference; `getConfig`/`setConfig` (235/241); `uid`/`audit`/`json`; the `tileHtml` component (app.01) and `dataAct`/`dataInputVal`/`dataChangeVal` delegation; `api('/clients')` for the ops client picker (app.03:474).
- **Risks / edge cases (from r2):** parser quantity-vs-pack ambiguity (R2-C4/C5/C6 regexes); the token matcher genuinely cannot match concatenated brands like "Goodday" (expected `unmatched`, DO NOT fake the fixture — R2-D1); `from-paste` must be **atomic** via `env.DB.batch` (handleCreateOrder is NOT a batch — do not call it; replicate its DRAFT insert inside the batch); idempotency to survive network retry; the existing order-draft flow must stay byte-for-byte unchanged (new endpoint, not an extension); CSP forbids inline JS (smoke test enforces delegated targets resolve).

## 📋 Task Execution (Parallel Groups)

### Group 1 — foundations (parallel; different files, fully independent)
> Parallel-safe ONLY with the plan-validation fix: Task 1.B **duplicates** the 6-line `normNameForMatch` into `src/smart_paste.ts` (does NOT move it out of `src/index.ts`), so 1.B never touches `src/index.ts`. 1.A owns the only `src/index.ts` edit in this group.
- [x] **Task 1.A — Schema:** `migrations/0053_smart_paste.sql` + append to `ensureFeatureTables` in `src/index.ts`.
- [x] **Task 1.B — Pure logic module + unit tests:** `src/smart_paste.ts` + `test/smart_paste.test.ts`.

### Group 2 — backend endpoints (sequential; all edit `src/index.ts`, depends on Group 1)
- [x] **Task 2.A — `handleParsePaste`** (uses 1.B parser/scorer; reads pool; writes parse-phase log).
- [x] **Task 2.B — `handleFromPaste`** (atomic batch; tenancy; revalidation; merge; source tag; confirm-phase log UPDATE).
- [x] **Task 2.C — Route registration + config keys** (2 routes near 4480; `getConfig` reads).
- [x] **Task 2.D — Endpoint integration tests** in `test/index.test.ts`.

### Group 3 — UI (depends on Group 2)
- [x] **Task 3.A — `public/app.19-smart-paste.js`** (render + review table + delegated handlers + `from-paste` call + navigate).
- [x] **Task 3.B — Wire-up:** `index.html` script tag + cache-bust; `app.03` entry button.

### Group 4 — verification (depends on Group 3)
- [x] **Task 4.A — Smoke + typecheck + full suite** and acceptance-scenario checks.

---

## 📝 Step-by-Step Implementation Details

### Prerequisites
Run the existing suite first to capture a green baseline: `npm test` (vitest) and `node test/smoke.mjs` and `npx tsc --noEmit`. Record results; any pre-existing failure is documented, not "fixed" here.

### Task 1.A — Schema
1. **Harness:** add to `test/smart_paste.test.ts` (or a tiny `test/index.test.ts` case) an assertion that, after boot, `PRAGMA table_info(orders)` includes `source` and `SELECT name FROM sqlite_master WHERE name='paste_match_log'` returns a row. (Integration-level; can also be asserted in 2.D.)
2. **Implementation:**
   - Create `migrations/0053_smart_paste.sql` with the exact DDL from `data-model.md` §1+§2.
   - In `src/index.ts` `ensureFeatureTables`: append the `CREATE TABLE IF NOT EXISTS paste_match_log …` and both `CREATE INDEX IF NOT EXISTS …` to the `stmts[]` array (~line 2820, before the closing `];`); append `` `ALTER TABLE orders ADD COLUMN source TEXT` `` to the `alters[]` array (~2843). Both run under the existing per-statement try/catch at ~2845 — ALTER on an existing column is swallowed.
3. **Verify:** `npx tsc --noEmit` clean; `npm test` boots schema without error.

### Task 1.B — Pure logic module (`src/smart_paste.ts`) — THE SAFETY HARNESS
1. **Harness FIRST (`test/smart_paste.test.ts`, vitest):** write these cases before the implementation. Each row is `input → expected`:
   - **Parsing (`parsePasteText`)** returns `{line_no, raw, product_text, quantity, needs_qty, unit_hint, parse_flags}[]`:
     - `Goodday 100 - 10` → product_text `Goodday 100`, quantity `10` (R2-C6 separator tie-break: bare int after last `-`).
     - `Water 20` → `Water`, 20.
     - `Coke 300ml x 24 - 5` → `Coke 300ml x 24`, 5 (pack `x24` kept).
     - `2x Water` and `5 x Water` → product_text `Water`, quantity 2 / 5 (leading multiplier, any spacing; `x` stripped).
     - `Water x 5` → pack expr kept? Per R2-C6 trailing `x 5` with no leading digit → treat as pack; **state the agreed result in the test** (recommend product_text `Water x 5`, needs_qty true) — this is the one fixture the architect flagged for a decision; pick and encode it.
     - `Lays Classic 52g` → needs_qty true (only unit-bound number).
     - `5 notebooks` → quantity 5 (word-boundary: `no`/`g` must be whole tokens — R2-C4).
     - `Sugar 2.0` / `Sugar 2.00` → quantity 2, parse_flags `["coerced_decimal"]` (R2-D2).
     - `Milk 2.5` → needs_qty true, parse_flags `["rejected_fraction"]`.
     - `Rice 1,000` → quantity 1000; `1,00,000` → 100000; `Water, 20` → product_text `Water`, qty 20 (R2-C5 comma grammar).
     - `1. Sugar 10` → product_text `Sugar`, qty 10 (ordinal stripped first, R2-C5/B4); `1.5 kg Sugar` → needs_qty (decimal, not ordinal).
     - `Coca-Cola 300ml - 5` → product_text `Coca-Cola 300ml`, qty 5 (intra-token hyphen kept).
     - `- 5` / `1. 20` → empty product_text ⇒ status handled by caller as unmatched + "no product text" (parser returns product_text "", a flag) (R2-C13).
     - blank/whitespace lines skipped; `line_no` preserves original index.
   - **Scoring (`scoreCandidate(normInput, normCandidate)`)** = token Jaccard over `normNameForMatch` tokens; assert exact numbers, e.g. `Diet Coke 330` vs `Diet Coke 330ml` → tokens {diet,coke,330} vs {diet,coke,330ml} → 2/4 = 0.5; `Goodday 100` vs `Britannia Good Day 100g` → **0** (the honest Goodday result).
   - **Confidence (`confidenceOf(score, order_count, tier)`)**: exact tier → 100; fuzzy → `min(99, round(score*100) + min(15, round(5*ln(1+order_count))))`; assert `score 0.6, order_count 8 → min(99, 60 + round(5*ln9)=60+11=71)`.
2. **Implementation (`src/smart_paste.ts`):** write pure functions with NO `env`/DB imports:
   - `parsePasteText(text: string): ParsedLine[]` implementing R2-C4/C5/C6/C13 and R2-D2 (integer coercion / fraction rejection). Export the unit-token set as a single const (R2-B3).
   - `normTokens(s)` wrapping the same normalisation rules as `normNameForMatch` (import `normNameForMatch` from index is circular — instead **move `normNameForMatch` into `src/smart_paste.ts` and re-export it from index**, or duplicate the 6-line pure fn here; prefer moving it and having index import it, noting the Zoho caller at 2493 then imports it too — verify no other behaviour change).
   - `scoreCandidate`, `rankCandidates(input, pool, {matchMin, matchMargin})` (applies the R2-C1 single-candidate auto-pass + runner-up margin), `confidenceOf`.
3. **Verify:** `npm test test/smart_paste.test.ts` — all green. These pure tests are the regression spine; they must stay green through Groups 2–4.

### Task 2.A — `handleParsePaste(request, env)`
1. **Harness:** integration cases drafted in 2.D (needs routing) — but assert the pool/score wiring via the 1.B unit tests where possible.
2. **Implementation (src/index.ts):**
   - Auth: `getUser`/`requireUser`; role in `{super_admin,ops_admin,client_admin}` else 403; `denyClientCrossAccess(env,user,body.client_id)` (404).
   - Validate `text` per api-contracts §1 (split `/\r\n|\r|\n/`, ≤200 lines, ≤20000 code points on raw text, ≥1 parseable line).
   - `const lines = parsePasteText(text)` (1.B).
   - Build candidate pool ONCE: `SELECT cc.sku, i.name, COALESCE(cc.client_price, i.unit_price) AS price FROM client_catalog cc JOIN inventory i ON i.sku=cc.sku WHERE cc.client_id=? AND i.active=1`. If >2000 rows, cap per R2-C12 and set `summary.pool_truncated`.
   - History map: `SELECT oi.sku, COUNT(DISTINCT o.id) AS n, <latest qty> FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.client_id=? AND o.status IN (<R2-C3 whitelist>) AND o.created_at >= date('now','-365 day') GROUP BY oi.sku`.
   - For each line: `rankCandidates` over the pool (top 3); `confidenceOf`; attach `why` chips = `["ordered N×"]` when order_count>0 and `["exact name match"]` on exact tier (R2-C11 — no other chips in V1). For needs_qty lines whose top candidate has history, set `qty_suggested` from the history map + flag `qty_suggested`.
   - Generate `parse_session_id = uid()`; batch-insert one `phase='parse'` log row per surviving line (R2-C10).
   - Return the api-contracts §1 JSON.
3. **Verify:** covered by 2.D.

### Task 2.B — `handleFromPaste(request, env)`
1. **Harness:** 2.D cases (atomic success; 422 bad SKU; idempotent replay; cross-tenant 404; zero-resolved 400; operator merge sums).
2. **Implementation (src/index.ts):** exactly api-contracts §2 — build `env.DB.batch([...])` with the DRAFT `orders` insert (mirror 6095-6099: SP- id, `computeOrderGst`, `source='smart_paste'`), `order_items` (one per resolved/merged line, `item_note` null), `order_history` DRAFT row, and the `paste_match_log` confirm-phase UPDATEs. Idempotency: pre-check a prior row for `idempotency_key`; on hit return existing `order_id`. **Do not call `handleCreateOrder`** (not atomic, applies approval rules). Price via `COALESCE(cc.client_price, i.unit_price)`; re-derive pool server-side and 422 any out-of-pool `chosen_sku`.
3. **Verify:** 2.D.

### Task 2.C — Routes + config
1. **Implementation:** near src/index.ts:4480 add
   `if (path==="/api/orders/parse-paste" && method==="POST") return handleParsePaste(request,env);`
   `if (path==="/api/orders/from-paste"  && method==="POST") return handleFromPaste(request,env);`
   Read `smartpaste_match_min`/`_margin` via `getConfig` inside the handlers (clamp to [0.3,0.9]).
2. **Verify:** `npx tsc --noEmit`.

### Task 2.D — Endpoint integration tests (`test/index.test.ts`)
1. **Test cases (vitest-pool-workers, seed a client + client_catalog + inventory + prior order):**
   - parse-paste: a clean list returns matched candidates + a `needs_qty` line with `qty_suggested` from history; `pool_truncated=false`; writes parse rows.
   - parse-paste auth: client_admin for another client → 404; non-admin role → 403; >200 lines → 400.
   - from-paste: happy path creates a `DRAFT` order with `source='smart_paste'`, correct `order_items`, and flips the parse rows to `phase='confirm'` with `order_id`; returns 201.
   - from-paste 422: a `chosen_sku` not in `client_catalog` → 422, no order created.
   - from-paste idempotency: same `idempotency_key` twice → one order, second call replays same `order_id`.
   - from-paste merge: two lines, same SKU, same `merge_group` → one summed `order_items` line.
   - **Regression:** an ordinary `POST /api/orders` (non-paste) still behaves exactly as before (no `source`, unchanged status logic).
2. **Verify:** `npm test` green.

### Task 3.A — `public/app.19-smart-paste.js`
1. **Harness:** `node test/smoke.mjs` must pass "all delegated targets resolve" — so every `dataAct`/`dataInputVal`/`dataChangeVal` target is a top-level global in this file.
2. **Implementation:** CSP-safe, delegated handlers only. Render: client picker (reuse `api('/clients')`, pre-selected when context has one) + textarea; on submit POST `parse-paste`; render a review table built from `tileHtml`/existing table styles with columns Item (editable) · Qty (editable, prefilled from `qty_suggested`) · Match (candidate `<select>`) · Confidence · Why chips · Status; unmatched/needs_qty rows tinted with inline SKU search (scoped to the client via a `parse-paste`-style candidate lookup or a client-scoped search); a merge affordance for duplicate SKUs; sticky footer "N of M resolved · ₹subtotal (excludes K unpriced)" with a **Confirm** button disabled until ≥1 line resolved and none unresolved (R2-C14). Confirm sends a client-generated `idempotency_key` to `from-paste`, then `navigate`s to the order screen for the returned id. Globals: `renderSmartPaste`, `spRunParse`, `spSetQty`, `spPickCandidate`, `spSearchSku`, `spToggleMerge`, `spRemoveLine`, `spConfirm`, `spSetClient`.
3. **Verify:** `node test/smoke.mjs` green.

### Task 3.B — Wire-up
1. `public/index.html`: add `<script src="app.19-smart-paste.js?v=20261009a"></script>` after app.18; no version bump needed elsewhere unless app.03 changes (it does → bump app.03).
2. `public/app.03-ordering.js`: add a "📋 Smart Paste" button near the existing Upload-Order-Sheet entry, `dataAct('navigate','smart_paste')` or a modal open → `renderSmartPaste`. Register the `smart_paste` page in the SPA router/PAGE_MAP if a new page is used (follow how `place_order` is registered).
3. **Verify:** `node test/smoke.mjs` green (delegated targets + routes resolve).

### Task 4.A — Verification sweep
1. `npx tsc --noEmit` — clean.
2. `npm test` — vitest green (pure + integration).
3. `node test/smoke.mjs` — green.
4. Walk the spec's acceptance scenarios (as revised by R2-D1): confirm the replaced flagship fixture matches a case the bare matcher reaches; confirm Goodday-style line lands `unmatched` (not faked).

### 🧪 Global Testing Strategy
- **Unit (pure, `test/smart_paste.test.ts`):** the entire parser/number-grammar/scorer/confidence surface — the highest-value, fastest tests; every r2 parsing fixture lives here with asserted outputs.
- **Integration (`test/index.test.ts`, workers pool):** auth/tenancy, pool scoping, atomic Confirm, 422/idempotency/merge, and the non-paste-order regression.
- **Smoke (`test/smoke.mjs`):** CSP delegated-target resolution for the new UI file.

## 🎯 Success Criteria
- `npm test`, `node test/smoke.mjs`, `npx tsc --noEmit` all green.
- `POST /api/orders/parse-paste` returns ranked client-scoped candidates with honest confidence and the api-contracts shape; writes parse-phase log rows; never creates an order.
- `POST /api/orders/from-paste` creates a `DRAFT` order (`source='smart_paste'`) atomically with its confirm-phase log rows, enforces tenancy + pool re-validation (422) + idempotency, and honours operator merges.
- The existing `POST /api/orders` flow is behaviourally unchanged (regression test green).
- Goodday-style concatenated-brand lines are returned `unmatched` (documented V1 limitation), not hard-coded to pass.
- No inline JS; all new UI interactivity via delegated `data-*` globals.

## Open items for the Engineer to confirm (flagged, do not silently choose)
- The `Water x 5` and `Sugar 5 kg` fixture results (R2-C6): pick the result, encode it in `test/smart_paste.test.ts`, and note it in the PR.
- Whether editing product text re-runs matching (spec unconfirmed `edit-product-text-no-rematch`): V1 may leave edited-text lines to the manual SKU search; state the choice in 3.A.

---

## 🔧 Revisions from plan-validation r1 (AUTHORITATIVE — overrides the task bodies above on conflict)

> Source: `adversarial-reviews/plan-validation.md` (3 skeptics read the code; 2-of-3 gate). 2 confirmed (both 🔴) + 6 adopted single-votes. The passed-checks confirmed the atomicity, matcher numbers, tenancy, and route-safety assumptions hold — these are additive fixes, not a redesign.

- **PV-1 `missing-idempotency-key-column` (🔴 first domino).** Add a `paste_idempotency(idempotency_key PK, order_id, client_id, created_at)` table (data-model §1b) to migration 0053 AND `ensureFeatureTables.stmts[]`. **Task 2.B:** pre-check `SELECT order_id FROM paste_idempotency WHERE idempotency_key=?` → replay on hit; on miss, INSERT it as one statement of the from-paste batch. **Task 2.D:** the idempotency test now has a real column to assert against.
- **PV-2 `smart-paste-page-unreachable` (🔴).** **Task 3.B:** register `smart_paste` in **both** `PAGE_MAP` and `ACTION_PAGES` (app.01-core.js:~782) with `['super_admin','ops_admin','client_admin']` (matching the endpoint role gate). Add a **Task 4.A assertion** that `canAccessPage('smart_paste')` is true for each allowed role and false otherwise — the existing smoke navGuard does NOT catch a reach-by-nobody page. (Modal-without-a-page is the alternative; if chosen, drop the PAGE_MAP entry and state it.)
- **PV-3 `client-price-not-self-healed`.** **Task 1.A:** add `ALTER TABLE client_catalog ADD COLUMN client_price REAL` to `ensureFeatureTables.alters[]` (prod self-heals via ensureFeatureTables, which lacks this column today → `COALESCE(cc.client_price,…)` 500s in prod). Also mirror into migration 0053 is unnecessary (0017 already has it); the fix is the runtime alters[] only.
- **PV-4 `schema-selfheal-not-awaited`.** **Tasks 2.A & 2.B:** first line of each handler is `await ensureFeatureTables(env)` (mirror `await ensurePiSchema` at src/index.ts:4457), so `paste_match_log`/`paste_idempotency`/`orders.source`/`client_catalog.client_price` exist on a cold isolate's first hit (it currently runs fire-and-forget via `ctx.waitUntil`, src/index.ts:4438).
- **PV-5 `confirm-update-orphan-noop`.** **Task 2.B:** the confirm-phase write is an **UPSERT** on `paste_match_log(parse_session_id,line_no)`, not a bare UPDATE — manual-search/merge/added lines have no parse-phase row, and a no-op UPDATE would drop their confirm row and break the "one row per line" metric. `parse_session_id` is part of the from-paste request (api-contracts §2); note the spec R2-D4 body omits it — the api-contract is authoritative.
- **PV-6 `tilehtml-not-table-rows`.** **Task 3.A:** build the review table as a hand-rolled `<table>` with existing table styles; use `tileHtml` ONLY for the footer KPI tiles. `tileHtml` renders a single KPI tile, not rows.
- **PV-7 `normnameformatch-mrp-strip`.** **Task 1.B:** `normNameForMatch` also strips an inline `MRP <n>` tag (beyond the spec's stated normalisation). Keep it (desirable) and add a unit fixture pinning it (e.g. a name containing `-MRP 95`).
- **PV-8 (surfaced) `place-order-acl-excludes-client-admin`.** `place_order`'s ACTION_PAGES is ops-only, so a Smart-Paste entry button there is unreachable for `client_admin` despite the API allowing them. V1 persona is ops-first — acceptable; the dedicated `smart_paste` page (PV-2) is the client_admin-reachable surface. State this in the PR.
