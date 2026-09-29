# Plan Adversarial Review — AR Slice 1 build plan

> `plan-validator` · independent skeptics, no shared scratchpad · default-to-reject · skeptics READ the codebase · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `003-finance-ar` |
| Artifact | `plans/active_milestones/003-finance-ar/build-plan-slice1.md` |
| Date | 2026-09-28 |
| Gate | 2-of-3 — **degraded to a 2-skeptic panel** (skeptic 1 terminated on a session rate-limit with no findings; not re-run — session limited until 11:40 UTC) |
| Result | **2 confirmed (2-vote) · 12 promoted (1-vote, cited/corroborated) · highest severity high** |
| 🁢 First domino | `group-parallelism-shared-monolith` (earliest, Group 1) + `gmail-rs256-pem-decode-omitted` (highest-severity correctness, Group 4) |

## Verdict

**Executable after fixes — no fatal design flaw, but the plan lies about parallelism and omits a
required crypto step.** The two skeptics that completed corroborated the plan's key premises (Zoho
reuse, injectable-fetch convention, real-D1 test harness, `handleZohoWebhook` shape, client-identity
mapping, safe additive rollout). The failures are mechanical: (1) every backend task edits one
monolithic `src/index.ts`, so the "parallel/independent" group framing is false and would cause
merge loss if executed concurrently; (2) the Gmail JWT step skips PEM→DER decoding and will throw;
(3) the `SEND_CRON` gate can silently never fire if the constant and `wrangler.jsonc` drift. All are
cheap to fix in the plan text; folded into a "Plan revisions (r1)" block.

## Confirmed Findings (≥ 2 votes)

### 🟠 `send-cron-drift-silent-noop` — gate constant vs wrangler string can diverge · unverifiable · 2/2 · high confidence
- **Step:** 5.D + 1.D `SEND_CRON`
- **Failure:** the pass runs only when `controller.cron === SEND_CRON`; `SEND_CRON` is both a code
  constant and a `wrangler.jsonc` crons entry that must be byte-identical (08:00 IST = `"30 2 * * *"`,
  not among today's `["30 3 * * *","0 */3 * * *"]`). The 5.D test stubs `controller.cron===SEND_CRON`
  — a tautology. If the two ever drift by one char, **no reminder ever sends** and every test stays
  green.
- **Evidence:** `wrangler.jsonc` crons; `scheduled()` branches on `controller.cron` (`index.ts:3113`);
  tests use a separate `wrangler.test.jsonc`.
- **Fix:** one task owns both the constant and the wrangler entry; add a test that **reads
  `wrangler.jsonc` and asserts its crons array literally contains `SEND_CRON`** (not a stubbed
  self-match).

### 🟡 `ar-schema-waituntil-race` — self-heal not awaited on a cold isolate · hidden-coupling · 2/2 · med confidence
- **Step:** 1.D / 3.A (first finance-endpoint hit)
- **Failure:** `fixCategoryNames`/`ensureFeatureTables` run via `ctx.waitUntil` (not awaited) on the
  fetch path (`index.ts:3122`). A fresh isolate can serve `/ar/*` before the AR tables exist →
  "no such table". The codebase already hit this for PI and added an explicit `await ensurePiSchema`
  (`index.ts:3139-3143`).
- **Evidence:** `index.ts:3122` unawaited; `index.ts:3139-3143` PI workaround; test comment
  `test/index.test.ts:135-141`.
- **Fix:** add an awaited `ensureArSchema(env)` at the top of the `/api/finance/*` route block
  (mirror PI); 1.D tests call the self-heal function directly rather than racing `waitUntil`.

## Promoted Findings (1 vote — cited & independently corroborated; applied)

> The panel was degraded to 2 skeptics with deliberately different focus areas, so most real findings
> land at 1 vote. Per the skill's "never silently drop" + evidence rule, these carry `file:line`
> and/or I corroborated them against code read earlier this session. All are applied to the plan.

### 🔴 `gmail-rs256-pem-decode-omitted` — JWT signing will throw · false-assumption · high
- 4.A writes `importKey('pkcs8', …)` but the PRD frames RS256 as "already used for HMAC/PBKDF2"; every
  existing `crypto.subtle.importKey` uses `'raw'` + `TextEncoder` (symmetric). `GOOGLE_SA_PRIVATE_KEY`
  is an escaped PEM. Missing: un-escape `\n`, strip PEM armor, base64-decode to DER. **Corroborated:**
  I confirmed `importKey('raw', …)` at `index.ts:8/19/33/41` earlier. *(Workers WebCrypto does support
  RSASSA-PKCS1-v1_5+SHA-256 pkcs8 — only the decode is missing.)*
- **Fix:** add a PEM→DER helper (un-escape → strip armor → `atob`→Uint8Array) before `importKey`; test
  with a real test PEM, not just header/claims.

### 🟠 `group-parallelism-shared-monolith` — "parallel" is false (one file) · hidden-coupling · med
- Every backend task edits `src/index.ts` (~10.7k lines) and `test/index.test.ts`; the group header
  claims "no shared file region … parallel". Concurrent execution → merge loss.
- **Fix:** rewrite the group note — tasks share `src/index.ts`/`test file` and run **serially** within
  a group; only `public/*.js` vs `src/index.ts` work genuinely parallelizes.

### 🟠 `group5-internal-sequential` — Group 5 is a hard chain · ordering · med
- 5.B needs 5.A schema; 5.C needs 5.B+4.B+5.A unique index; 5.D/5.E call 5.C `sendStatement`.
- **Fix:** mark Group 5 sequential `5.A→5.B→5.C→{5.D,5.E}`.

### 🟠 `new-cron-fires-entire-scheduled-body` — added trigger re-runs existing work · hidden-coupling · med
- `scheduled()` runs `fixCategoryNames`+`runDeliveryReminders`+`runZohoSync` unconditionally every
  tick; only `runZohoSync`'s `full` flag branches. **Corroborated:** I read `index.ts:3106-3116`. A
  3rd `SEND_CRON` trigger re-fires the day-of delivery digest (no per-day guard) and an extra delta.
- **Fix:** gate the whole dispatch by cron — `if (controller.cron===SEND_CRON) runReminderPass else {existing body}` — or add a per-day guard to the digest.

### 🟠 `finance-pages-multi-nav-acl` — nav spans 3 surfaces, smoke enforces ACL · hidden-coupling · med
- Readers are `finance_admin`→NAV.finance, `ops_admin`→NAV.ops, `super_admin`→NAV.platform; the smoke
  test loops every role×PAGE_MAP and fails on ACL inconsistency. Single-surface wiring fails.
- **Fix:** add each new page id to PAGE_MAP + each relevant NAV surface (or ACTION_PAGES) for exactly
  the PRD roles; make the smoke ACL part of 3.C acceptance.

### 🟠 `schema-ownership-overlap-1d-5a` — two tasks CREATE the reminder tables · missing-migration · med
- 1.D and 5.A both create `reminder_*`. `CREATE TABLE IF NOT EXISTS` is a no-op once the table exists,
  so if 1.D creates `reminder_runs` first, 5.A's extra columns (`cycle_batch`,`actor`,…) never appear
  unless added via guarded `ALTER ADD COLUMN` → the reserve-before-send insert fails at runtime.
- **Fix:** one task owns each table's CREATE; every added column is an idempotent `ALTER ADD COLUMN`;
  test `PRAGMA table_info` shows all audit columns after a re-run over a pre-existing table.

### 🟠 `dryrun-sendfollowup-untested` — manual path can send live in dry-run · unverifiable · med
- §15 requires `dry_run` to cover cron, `/run`, **and** `send-followup`; 5.E has no test that
  `send-followup` under `dry_run` calls `gmailSend` zero times. A compliant impl could send live.
- **Fix:** add a 5.E test: `reminders_mode=dry_run` + `send-followup` ⇒ zero `gmailSend`, one
  `reminder_runs` row `status='dry_run'`.

### 🟠 `scheduled-not-invocable-in-harness` — cron gate has no test path · unverifiable · med
- No existing test invokes `scheduled()`; the default export is never imported.
- **Fix:** factor the send pass into a directly-callable `runReminderPass(env, cron)` unit-tested
  directly, plus one test that calls `worker.scheduled({cron}, env, ctx)` via `createExecutionContext`.

### 🟡 `3c-spa-after-3a-endpoints` — SPA green with endpoints absent · ordering · low
- 3.C renders 3.A data but verifies only via smoke (fetch stubbed 401), so it passes without 3.A.
- **Fix:** order 3.A before 3.C; add an integration test that the render path consumes a real
  `/ar/summary` shape.

### 🟡 `pure-fns-require-explicit-export` — tested fns must be exported · false-assumption · low
- Internal fns are testable only via the `export { … }` block (`index.ts:3099-3101`); the plan never
  says to add the new pure fns there.
- **Fix:** each pure/testable fn is added to the `export {}` block in its impl step.

### 🟡 `smoke-is-frontend-only` — "smoke route registration" is wrong for backend · false-assumption · low
- `test/smoke.mjs` is a Playwright SPA harness (PAGE_MAP, dataAct, ACL); it never touches `/api`.
- **Fix:** verify new backend routes via vitest `SELF.fetch`; reserve smoke for SPA page/nav/dataAct.

### 🟡 `dataact-targets-must-be-globals` — arrow/module fns fail smoke · hidden-coupling · low
- Smoke flags any `dataAct('fn')` where `typeof window[fn] !== 'function'`; a `const f = () =>` in the
  new file isn't a global.
- **Fix:** author every dataAct target as a top-level `function name(){}` (or `window.name=`) in
  `app.11-finance.js`; note in 3.C/5.E.

### 🟡 `webhook-vendor-path-nonexistent` — 3.B test assumes an AP webhook that doesn't exist · false-assumption · low
- The only branch is `invoice.payment_received` → `purchase_orders`; there is no vendor/AP
  bill-payment webhook to "still hit". **Corroborated:** `index.ts:7940-7947`.
- **Fix:** restate 3.B — the existing customer-payment event moves to AR; unknown events are a safe
  no-op; add a vendor branch only if an AP bill-payment webhook is actually in scope.

### 🟡 `ar-real-money-boundary` — existing money columns are REAL · false-assumption · low
- `orders`/`order_items`/`purchase_orders` money is REAL; AR uses INTEGER paise. Fine for slice 1
  because AR↔order/DC linkage is **id-based**, but any amount-based cross-boundary math is wrong 100×.
- **Fix:** keep AR↔order/DC linkage id/number-based only; never mix paise-integer with rupee-REAL.

## Checks That Passed (assumptions verified in source)

- Injectable-fetch convention **exists** (`fetchImpl?` on `runZohoSync`/`zohoGetToken`/`zohoFetchPage`,
  `index.ts:1766/1790/1878`) — 2.A/4.A/4.B "injectable for tests" is consistent, not invented.
- Test harness uses a **real D1** via `cloudflare:test`/vitest-pool-workers with migrations in
  `beforeAll` — schema/upsert/endpoint/IDOR tests can genuinely run.
- Workers WebCrypto **supports** RSASSA-PKCS1-v1_5+SHA-256 pkcs8 import+sign — algorithm choice valid.
- `handleZohoWebhook` is exactly as described (updates `purchase_orders` by `invoice_number`, no AR) —
  the 3.B fix premise is accurate (`index.ts:7932-7949`).
- Client identity mapping is **possible** — a `clients` table exists and the JWT carries
  `client_id`+`role` with `isClient` helpers — 3.A forced client-scoping is buildable.
- Rollout is **safe/additive** — `reminders_mode` defaults off, `initial_backfill_complete=0`, sync
  disabled; all schema work is `CREATE IF NOT EXISTS`/`ALTER ADD` on **new** tables; no irreversible
  migration.
- New-file loading is sound — `index.html` lists each `app.NN-*.js` and smoke derives its list from
  that HTML.
- The `>90`-id chunk regression and integer-paise money are concretely unit-tested.
- `npx vitest run -t "name"` filters by test name as assumed.

## Actions Taken

- [x] Fixed inline in `build-plan-slice1.md`: group-parallelism claim, Group 5 sequential marking,
  4.A PEM→DER step, 5.D whole-body cron gating.
- [x] Added a "Plan revisions (plan-validation r1)" block capturing the remaining confirmed/promoted
  fixes (SEND_CRON single-source + wrangler-read test, `ensureArSchema` await, 1.D/5.A schema
  ownership + ALTER guards, `runReminderPass` factoring, dry-run send-followup test, multi-nav ACL,
  3.A-before-3.C, export-block, dataAct globals, smoke-is-frontend, REAL-money id-linkage, 3.B
  wording).
- [ ] Skeptic 1 did not complete (session rate-limit); panel ran with 2. Re-run the full 3-skeptic
  panel after the limit resets **only if** a material reorder is made — the current fixes are additive
  clarifications, so a re-run is not required to proceed.
