# Plan Adversarial Review — Smart Paste Order (V1)

> `plan-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · skeptics READ the codebase · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `004-smart-paste-order` |
| Artifact | `plans/active_milestones/004-smart-paste-order/plan.md` (+ data-model.md, api-contracts.md) |
| Date | 2026-10-09 |
| Gate | 2-of-3 majority |
| Result | **2 confirmed · 6 unconfirmed** — highest severity **🔴 high** |
| 🁢 First domino | `missing-idempotency-key-column` — all three skeptics named it the earliest blocking failure |

## Verdict

**The plan is mechanically sound but has one hard, test-visible gap that must be fixed before Group 2 can pass its own tests, plus a UI reachability trap that would ship the feature invisible.** Crucially, the skeptics *verified* the risky assumptions and they hold: `env.DB.batch` mixing INSERT+UPDATE is idiomatic here (src/index.ts:419), the atomic DRAFT insert is replicable, `item_note`/`computeOrderGst`/`inventory.unit_price`/`denyClientCrossAccess` are all exactly as the plan claims, no route shadows the new POST paths, and the matcher's worked numbers (Diet Coke 0.5, Goodday 0, confidence 71) are correct. The blockers are additive schema/registration omissions, not design errors.

## Confirmed Findings (≥ 2 votes)

### 🔴 `missing-idempotency-key-column` — idempotency has nowhere to store its key · missing-migration · 3/3 · confidence high  ← FIRST DOMINO
- **Step:** Task 1.A schema → detonates in Task 2.B (from-paste pre-check) and Task 2.D (idempotency test).
- **Failure:** The contract keys replay on `idempotency_key` and the 2.D test asserts "same key twice → one order, same `order_id`", but **no column named `idempotency_key` exists** — not on `orders` (migrations/0001 + all ALTERs), not in `paste_match_log` (data-model §1), and 0053 adds only `paste_match_log` + `orders.source`. The parse-phase log rows are written *before* the key exists (it first arrives at Confirm), so they can't serve as the lookup either. The pre-check `SELECT … WHERE idempotency_key=?` has nothing to read; in tests it throws `no such column` or (if silently dropped) creates a second order → 2.D fails.
- **Evidence:** `data-model.md:10-33` (paste_match_log columns), `migrations/0001_schema.sql:28-49` (orders/order_items), `api-contracts.md:71`, `plan.md:95,111`; `grep idempotency src/index.ts` → only unrelated finance code (4178/4330).
- **Fix:** Add a dedicated `paste_idempotency(idempotency_key TEXT PRIMARY KEY, order_id TEXT, client_id TEXT, created_at TEXT)` table to migration 0053 **and** `ensureFeatureTables.stmts[]`; `from-paste` pre-checks it (`SELECT order_id WHERE idempotency_key=?`) and INSERTs the row inside the same batch. Update data-model.md, api-contracts.md, and Task 2.D.

### 🔴 `smart-paste-page-unreachable` — a PAGE_MAP entry alone is reachable by nobody · hidden-coupling · 3/3 · confidence high
- **Step:** Task 3.B wire-up.
- **Failure:** `canAccessPage(page)` allows a page only if it is `dashboard`, in the role's NAV, or in `ACTION_PAGES`; otherwise `navigate()` blocks it, toasts "not available for your role", and redirects. The plan says only "register in the SPA router/PAGE_MAP (follow place_order)" — but `place_order` works because it is in **both** NAV and `ACTION_PAGES`. A `smart_paste` entry in PAGE_MAP alone → `canAccessPage` false for **every** role incl. super_admin/ops_admin → the entry button never renders the page. And the **smoke test stays green** (it only checks PAGE_MAP names resolve to functions and delegated targets resolve; it does not test the nav ACL), so CI would not catch the shipped-invisible feature.
- **Evidence:** `public/app.01-core.js:771-786` (canAccessPage + ACTION_PAGES, place_order at :786), `:1117` (navigate ACL redirect), `:1039-1098` (PAGE_MAP); `test/smoke.mjs:154-163` (navGuard does not flag a reach-by-nobody page); `plan.md:123`.
- **Fix:** Task 3.B must add `smart_paste: ['super_admin','ops_admin','client_admin']` to `ACTION_PAGES` **in addition to** PAGE_MAP (mirroring place_order), and add an acceptance/smoke assertion that `canAccessPage('smart_paste')` is true for each allowed role and false otherwise (the existing smoke check is not a safety net here). Alternatively implement as a modal (no PAGE_MAP) — pick one and state it.

## Unconfirmed (FYI · 1 vote) — most adopted anyway (cheap + clearly correct)

| `id` | sev | step | disposition |
|---|---|---|---|
| `client-price-not-self-healed` (S_C) | 🟠 med | 2.A/2.B pool query | **Adopt.** `ensureFeatureTables` creates `client_catalog` without `client_price` and never ALTERs it in; prod self-heals via ensureFeatureTables (not migrations), so `COALESCE(cc.client_price,…)` → `no such column` 500 in prod (tests pass, they apply 0017). The codebase already guards this at `src/index.ts:2359-2363`. Fix: add `ALTER TABLE client_catalog ADD COLUMN client_price REAL` to `alters[]` (Task 1.A). |
| `schema-selfheal-not-awaited-prod` (S_B) | 🟠 med | 1.A/2.x | **Adopt.** `ensureFeatureTables` runs fire-and-forget via `ctx.waitUntil(fixCategoryNames…)` (src/index.ts:4438), not awaited before routing; a cold-isolate first hit on from-paste could INSERT `source`/`paste_match_log` before the ALTER/CREATE land. Fix: `await ensureFeatureTables(env)` at the top of both handlers (mirror `await ensurePiSchema` at 4457). |
| `group1-not-parallel-same-file` (S_A) | 🟠 med | Group 1 label | **Adopt.** 1.A and 1.B both edit `src/index.ts` (1.B moves `normNameForMatch`). Fix: 1.B **duplicates** the 6-line pure fn into `src/smart_paste.ts` (no index edit — the plan already offered this), making Group 1 genuinely parallel. |
| `confirm-update-orphan-noop` (S_C) | 🟡 low | 2.B confirm UPDATE | **Adopt.** Lines added via manual search / merge have no parse-phase row, so the keyed UPDATE is a silent no-op → violates "one row per line"/metric. Fix: `from-paste` UPSERTs (INSERT a confirm row when no `(parse_session_id,line_no)` exists). Also add `parse_session_id` to the from-paste request shape in spec R2-D4 (api-contracts already has it). |
| `tilehtml-not-table-rows` (S_B) | 🟡 low | 3.A | **Adopt (wording).** `tileHtml` renders a KPI tile, not table rows. Reword 3.A: hand-roll the review `<table>`; use `tileHtml` only for the footer KPI tiles. |
| `place-order-acl-excludes-client-admin` (S_C) | 🟡 low | 3.B entry | **Surface.** `place_order`'s ACTION_PAGES is ops-only (no client_admin), so an entry button there is unreachable for client_admin though the API allows them. V1 persona is ops-first; acceptable, but note it — or give Smart Paste its own correctly-ACL'd page (which the `smart_paste` ACTION_PAGES fix above already does). |
| `normnameformatch-mrp-strip` (S_C) | 🟡 low | 1.B | **Adopt (fixture).** `normNameForMatch` also strips an inline `MRP <n>` tag (beyond the spec's stated normalisation). Harmless/desirable, but add a fixture pinning it so it's documented. |

## Checks That Passed (verified assumptions that held — corroborated across skeptics)
- `env.DB.batch([...])` mixing INSERT+UPDATE with bound params is real and idiomatic (`src/index.ts:419`, also 379/1750/5613/7063); the SP- id is generated in JS (`6085`), so it's pre-known and bindable across the batch. **Atomic from-paste is feasible.**
- `normNameForMatch` (`2413-2420`) does not strip `ml`: `Diet Coke 330`/`330ml` → Jaccard 0.5; `Goodday 100`/`Britannia Good Day 100g` → 0 (honest unmatched); confidence(0.6, 8) = 71. **Matcher numbers correct.**
- `denyClientCrossAccess` (`125-128`) passes ops/super through and 404s client-role mismatch (and zero-binding client_admin). **Tenancy per R2-C1.**
- `order_items.item_note` exists (migration 0025, self-heal 3091); `computeOrderGst(env, {sku,qty,unit_price}[])` at `6043`; `inventory.unit_price` is the real column (`0001:66`). **DRAFT insert replicable.**
- No route shadows the new POSTs: `/api/orders/:id` wildcards are GET/PATCH only (`4485/4486`); exact `===` POST routes resolve. D1 binding is `DB` (`wrangler.jsonc`).
- Worker tests apply 0053 via `import.meta.glob('../migrations/*.sql')` in `beforeAll` (`test/index.test.ts:95-122`), so schema exists in tests independent of ensureFeatureTables.
- The spec's R2-C12 >800-posting-list token skip is present in the reused Jaccard loop (`src/index.ts:2518`).

## Actions Taken
- [x] Wrote this review.
- [x] **Fixed `missing-idempotency-key-column`** (first domino): `paste_idempotency` table added to data-model.md §1b + Task 1.A; Task 2.B pre-check/batch + api-contracts updated (PV-1).
- [x] **Fixed `smart-paste-page-unreachable`**: Task 3.B registers `smart_paste` in PAGE_MAP **and** ACTION_PAGES; `canAccessPage` assertion added to Task 4.A (PV-2).
- [x] Folded adopted single-votes: client_price ALTER (PV-3), awaited `ensureFeatureTables` (PV-4), Group-1 duplicate-not-move (label fixed inline), confirm UPSERT + parse_session_id (PV-5), tileHtml wording (PV-6), MRP fixture (PV-7).
- [x] Surfaced `place-order-acl-excludes-client-admin` as PV-8 (V1 ops-first UI; `smart_paste` page is the client_admin-reachable surface).
- [x] No re-run needed: all fixes are additive (new table/columns, registration, awaits), not a reordering — treated as a plan-time check. The plan is ready to execute.
