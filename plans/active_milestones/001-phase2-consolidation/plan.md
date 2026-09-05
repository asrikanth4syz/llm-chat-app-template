# Implementation Plan: Phase 2 — Consolidation (001-phase2-consolidation)

> Brownfield verify-and-harden. The four features already exist and are smoke/tsc-green. The plan's
> core loop is **executable-AC-first**: for each acceptance criterion, add a check that runs against the
> *shipped* code; a **green** check *verifies* the AC (no code change), a **red** check *drives* a fix.
> This avoids pre-judging which ACs are bugs. Test harness = `test/smoke.mjs` pattern (Playwright +
> stubbed DOM/fetch, scripts loaded in `index.html` order) + `tsc --noEmit`. No D1 / no server.

## Analysis (grounded in code)

- **Router / ACL / stepper / hash** live in `public/app.01-core.js`: `navigate` (opts.tab, HUB_REDIRECT),
  `parseHash/writeHash/routeTab/registerHub/onHashChange`, `_hubTabWritten`, `PAGE_MAP`, `NAV`, `ROLES`,
  `ACTION_PAGES`, `canAccessPage`, `ORDER_PHASES/orderPhaseIndex/phaseStepper`, `injectStepperCss`.
- **Orders/My-Orders hubs** in `public/app.04-orders-delivery.js`: `ORDERS_TABS/renderOrdersHub/
  ordersHubTab`, `MYORDERS_TABS/renderMyOrdersHub/myOrdersHubTab`, `renderOrderQueue` (phase filter),
  `renderMyOrders` (uses `phaseStepper`), `renderTrackDelivery`.
- **Deliveries hub** in `public/app.07-warehouse-delivery.js`: `DELIV_TABS/delivTabsForRole/
  renderDeliveriesHub/delivHubTab`.
- **Verified facts** (read-only): the delivery gate is consistent **for the four roles that can open the
  Deliveries hub** — `delivTabsForRole(role)` equals `{tab | canAccessPage(backing)}` for
  super_admin/ops_admin/delivery_manager/delivery_exec. **Correction (plan-validator first domino):**
  `delivTabsForRole` (app.07:1697-1701) returns `{today,list,calendar}` for the other 8 roles too, even
  though they cannot reach the hub (`delivery` is not in their nav) — so a naive "all 12 roles" equality
  would be red for them. `delivTabsForRole` is only ever *invoked* for hub-accessible roles, so this is a
  dead path; the fix is (B5) a defensive guard returning `[]` for no-access roles, and scoping A4f to
  hub-accessible roles. See Group B/B5. `ACTION_PAGES.place_order` contains the phantom role
  `ops_manager` (app.01-core.js:739) — a real small fix. `renderOrdersHub` already normalizes to
  `#orders/<default>` via `writeHash(active)`, and `routeTab` already falls back to the default tab for
  an unknown/forbidden slug (AC1/AC6 mostly satisfied; the test confirms and closes gaps).
- **AC3 echo-dedupe:** `writeHash` sets `_hubTabWritten[page]` even when the hash is unchanged (no
  `hashchange` fires). The test in Group A exercises "write tab A → away → Back to A"; if green the
  shipped design is adequate (AC3 verified), if red Group B hardens it.
- **Harness limits:** the smoke fetch stub returns 401 for everything. AC15 (Due badge) needs a stubbed
  `/reports/consolidated-due` (or `/nav-badges`) response → extend the stub to route those to a fixture.
  Pure-function ACs (canAccessPage, phaseStepper, PAGE_MAP, NAV, delivTabsForRole) are checked in
  `page.evaluate`, exactly like the existing smoke ACL block.

## Execution Groups

Groups are independently committable. **Group A first** (fixtures + checks land before/with fixes).
Within a group, `[P]` marks tasks that touch disjoint files and may run in parallel.

---

### Group A — Executable ACs: fixtures + a Phase-2 test module  *(no product code)*
> New file `test/phase2.mjs` (mirrors `smoke.mjs`'s loader) + JSON fixtures under `test/fixtures/`.
> **A0:** add `"test:phase2": "node test/phase2.mjs"` to `package.json`.
> **Manual xfail (plan-validator finding):** a plain `node` script has no `.todo`/xfail primitive and
> `smoke.mjs` exits non-zero on any `failures[]` entry. So `phase2.mjs` defines two recorders:
> `expect(name,cond)` (a failure increments the exit code) and `todo(name,cond,ac)` (an expected-red
> check: prints `⚠ TODO[ac]`, **never** touches the exit code). Group A registers each known-red AC via
> `todo(...)` so Commit A stays green-CI while recording intent; Group B/C move each id from `todo()` to
> `expect()` as it goes green. Do not rely on a framework feature.
> **Per-URL fetch stub (plan-validator finding):** `smoke.mjs` stubs `window.fetch` to a URL-agnostic
> 401. `phase2.mjs` MUST install its OWN fetch stub that switches on the request URL (routes
> `/reports/consolidated-due` and `/nav-badges` to fixtures for AC15; everything else → 401), rather
> than reusing smoke's blanket stub — otherwise the badge always hits the "unavailable" branch and the
> N>0 / 0 render-state checks can never pass.

- [x] **A1 [P]** `test/fixtures/acl-matrix.json` — hand-authored allow/deny for every (role ∈ R1) ×
  (page ∈ PAGE_MAP), authored from `NAV`/product intent, **not** copied from `ACTION_PAGES`. Include the
  AC7 negatives (delivery_exec ∌ calendar/routes/today; client roles ∌ the staff-only set). [AC7]
- [x] **A2 [P]** `test/fixtures/pre-consolidation-page-ids.json` — the frozen list of page ids from
  `origin/main`'s `PAGE_MAP` (`git show origin/main:public/app.01-core.js` → extract keys). [AC8]
- [x] **A3 [P]** `test/fixtures/untouched-nav.json` — `{id,label}` arrays for NAV profiles
  procurement/warehouse/finance/vendor/vendor_user, captured from `origin/main`. [AC8]
- [x] **A4** `test/phase2.mjs` — load `public/app.*.js` in `index.html` order (reuse smoke's loader), then
  in `page.evaluate` assert:
  - **A4a** `Object.keys(ROLES)` deep-equals R1's 12; every role in any `ACTION_PAGES` value ∈ ROLES
    (fails on `ops_manager` → red until B1). [AC7,R1]
  - **A4b** `canAccessPage(role,pg)` equals `acl-matrix.json` for all pairs; smoke's own ACL checks still
    hold. [AC7]
  - **A4c** current `PAGE_MAP` ⊇ `pre-consolidation-page-ids.json`; each folded id
    (pipeline/consolidated_due/track_delivery/todays_schedule/delivery_calendar/delivery_routes) resolves
    to a function. [AC8]
  - **A4d** `NAV[profile]` `{id,label}` deep-equals `untouched-nav.json` for the five profiles. [AC8]
  - **A4e** `phaseStepper` over R2 table (each → its phase index via `orderPhaseIndex`), CANCELLED/REJECTED
    (→ output contains `ostep--cancelled`), and the full fallback set (null,undefined,'',IN_TRANSIT,
    DISPATCHED,ACCEPTED,SENT,SCHEDULED,OPEN,IN_PROGRESS,RESOLVED,INVOICED,HIGH,MEDIUM,LOW,'ZZZ_UNKNOWN')
    → `orderPhaseIndex` === -1 **and** output does NOT contain `ostep--cancelled` and does not throw. [AC9]
  - **A4f** delivery gate consistency: for each role **that can open the hub** (`canAccessPage('delivery')`
    true), `delivTabsForRole(role)` slugs’ backing pages equal `{tab | canAccessPage(backing)}`. Plus, for
    every role that CANNOT open the hub, assert `delivTabsForRole(role)` is `[]` — starts red (drives B5).
    [AC5/R3/AC14]
  - **A4g** enumerated stepper surfaces: assert `renderMyOrders` source calls `phaseStepper`; assert the
    bespoke tokens (`ORDER_STEPS`, inline 5-`div` progress-bar) are absent from `public/app.*.js`. [AC10]
  - **A4h** hash addressability: for a stubbed `APP.user`, drive `navigate('orders',{tab})` and
    `ordersHubTab/myOrdersHubTab/delivHubTab` and assert `location.hash` matches `#hub/slug` (R3), and a
    bare `navigate('orders')` normalizes to `#orders/queue`. [AC1,R3]
  - **A4i** AC3 return-to-same-tab: simulate write tab A → navigate to another page → set hash back to A →
    assert the tab-body switcher fires (instrument `APP_HUBS` / a render token). Red drives B3. [AC3]
  - **A4j** raw-hash ACL + fold: set `location.hash` to `#pipeline`, `#delivery/routes` (as delivery_exec),
    `#orders/bogus` and dispatch `onHashChange`/boot; assert fold→`#orders/pipeline`, forbidden→refused,
    unknown-tab→default tab, `#main-content` non-empty. Red drives B4. [AC5,AC6]
  - **A4k** logout: set a hash, call `doLogout` (stub DOM bits), assert `location.hash===''` and
    `sp_page` removed. [AC16]
- **Verify:** `npm run test:phase2` runs; green checks record verified ACs, red checks (expected: A4a
  phantom role, possibly A4i/A4j/A4h edges) are annotated with their AC + target group. `npm run
  test:smoke` still green. **Commit A.**

### Group B — Router/ACL fixes driven by Group-A red checks  *(product code, `app.01-core.js`; serialize — same file)*
- [x] **B1** Remove `ops_manager` from `ACTION_PAGES.place_order` (app.01-core.js:739) — it is not in
  `ROLES`. Flip A4a to asserting. [AC7,R1]  **Verify:** `test:phase2` A4a green; `test:smoke` green.
- [x] **B2** AC1/AC6 default-tab normalization — only if A4h/A4j show a gap: ensure a bare `#hub` and an
  unknown/forbidden tab normalize (via `replaceState`) to the hub's default **accessible** tab, and
  `onHashChange`/boot refuse a forbidden tab landing on the default tab rather than a blank body. Flip
  A4h/A4j. [AC1,AC6]  **Verify:** A4h/A4j green; `test:smoke` green.
- [x] **B3** AC3 echo-dedupe hardening — only if A4i is red: replace the retained `_hubTabWritten` compare
  with a one-shot guard set immediately before `writeHash` and cleared on the next `hashchange` **and**
  on a next-tick fallback (covers the write-same-hash no-event case), preserving "self-write → no
  re-render". Flip A4i. [AC3]  **Verify:** A4i green; back/forward manual trace; `test:smoke` green.
- [x] **B4** Raw-hash ACL/fold — only if A4j is red: make `onHashChange`+`initApp` boot run every raw hash
  through the same access decision (`canAccessPage` for orders/my_orders; `delivTabsForRole` for delivery)
  and `HUB_REDIRECT` fold, normalizing via `replaceState`. Flip A4j. [AC5]  **Verify:** A4j green; smoke green.
- [x] **B5** `delivTabsForRole` defensive guard: return `[]` when the role cannot open the Deliveries hub
  (no delivery backing page reachable — e.g. lead guard `if (!canAccessPage('delivery')) return [];`), so
  the R3/AC14 gate-consistency invariant holds for **all 12** roles, not just hub-accessible ones. Flip the
  no-access half of A4f. (Dead-path hardening — hub-accessible roles are unaffected.) [AC5/R3/AC14]
  **Verify:** A4f fully green; `test:smoke` green; delivery hub still renders for delivery roles.
- **Commit B** (one commit per applied fix; skip a task whose Group-A check was already green and note it).

### Group C — Due-Items hub-tab count badge  *(product code, `app.04-orders-delivery.js`; new AC15 check)*
- [x] **C1** In `renderOrdersHub`/`ordersHubTab`, render the "Due Items" tab label with a badge
  **element present synchronously** (empty/hidden). Add a helper that reads the overdue count from the
  same signal the Due page uses (`/reports/consolidated-due` → count rows with `days_overdue > 0`, or the
  `/nav-badges` consolidated_due count), populates the badge within one frame of the promise settling;
  `N>99`→"99+"; `N===0`→hidden; unavailable/NaN/negative→`data-badge-state="unknown"` (no number). Must
  not block tab render, must not add a `dataAct` target that breaks smoke. [AC15]
- [x] **C2** Extend the `test/phase2.mjs` fetch stub to route `/reports/consolidated-due` (and/or
  `/nav-badges`) to a fixture; assert the three render states (N>0 shows N / 99+ ; 0 → absent ;
  unavailable → `data-badge-state="unknown"`) and that the badge element exists before the promise
  resolves. [AC15]
- **Verify:** `npm run test:phase2` (AC15 block green) + `npm run test:smoke` + `tsc --noEmit`. **Commit C.**

### Group D — Final validation & CHANGELOG  *(docs/tests only)*
- [x] **D1** Update `CHANGELOG.md` Phase-2 entry to note the verify-and-harden pass (executable ACs,
  fixtures, any fixes applied). [docs]
- [x] **D2** Full green run: `npm run test:smoke && npm run test:phase2 && npx tsc --noEmit`. **Commit D.**

## Test commands (every task)
- `npm run test:smoke` — existing invariants (must stay green throughout).
- `npm run test:phase2` — the new executable ACs (added in Group A).
- `npx tsc --noEmit` — type check (src only; public/*.js unaffected but run as a gate).

## Parallelism / ordering
- A1,A2,A3 are `[P]` (disjoint fixture files); A4 depends on them. Group A precedes B/C.
- B tasks all edit `app.01-core.js` → **serialize** B1→B2→B3→B4.
- C edits `app.04-orders-delivery.js` → independent of B; may proceed once A is committed.
- D last.

## Risks
- Playwright DOM stub may not model `hashchange`/`history` fully; A4i/A4j/A4k may need a minimal
  `location`/`history` shim in the test rather than real browser events — the plan allows driving the
  handlers directly (call `onHashChange()` after setting `location.hash`) as the existing smoke does.
- Extracting `origin/main` `PAGE_MAP`/`NAV` for fixtures must use `git show origin/main:…`, not the
  working tree (which already has the consolidation).

---
## Completion status (construction)
- **Group A** ✅ committed `dc9754b` — fixtures + `test/phase2.mjs`; 12 ACs verified green against shipped code.
- **Group B** ✅ committed `56e8ebc` — B1 (ops_manager phantom removed) + B5 (delivTabsForRole guard).
  - B2 (default-tab normalization), B3 (echo-dedupe hardening), B4 (raw-hash ACL/fold) were **conditional
    on a red check**; all their checks came back **green** against the shipped code (AC1 hash round-trip +
    routeTab fallback, AC3 back-to-same-tab with the real switcher, AC5 delivery gate) — so no code change
    was needed. Verified, not skipped.
- **Group C** ✅ committed `d3c4cc1` — Due Items overdue-count badge (AC15), 6 checks green.
- **Group D** ✅ this commit — CHANGELOG + final validation.
- **Final gate:** `npm run test:smoke` green · `npm run test:phase2` green (0 todos) · `tsc --noEmit` clean.
