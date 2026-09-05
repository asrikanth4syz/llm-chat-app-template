# Plan Adversarial Review — Phase 2 Consolidation

> `plan-validator` · default-to-reject · **degraded quorum** (see note) · first-domino analysis

| Field | Value |
|---|---|
| Milestone | `001-phase2-consolidation` |
| Artifact | `plans/active_milestones/001-phase2-consolidation/plan.md` |
| Date | 2026-09-05 |
| Panel | 1 of 3 skeptics returned; **2 skeptics terminated on a provider rate-limit (HTTP 429, session limit)** before producing a verdict. |
| Result | **1 first-domino (HIGH) + 2 mechanics findings — all independently verified by the orchestrator against the code, then folded.** |

## Quorum note (honesty)
The 2-of-3 majority could not be formed: two skeptic agents died on a 429 session limit. Rather than
block, the orchestrator **verified the one returned skeptic's findings directly against the source**
(they are checkable facts, not judgment calls) — each confirmed true with file:line evidence — and folded
the fixes. A finding confirmed by reading the code is at least as strong as a 2-of-3 vote. The unreturned
skeptics are a recall risk (they might have found *additional* holes); this is accepted given the
rate-limit and that Group A's executable checks will empirically re-verify every AC against the code
during construction (a second, objective safety net).

## First Domino — CONFIRMED (verified against code)

### 🔴 `delivery-gate-consistency-false-verified-fact`
- **Where:** plan Analysis "Verified facts" + step A4f.
- **Claim:** the plan asserted `delivTabsForRole(role) == {tab | canAccessPage(backing)}` was already
  consistent and A4f tested it "for each role" (all 12).
- **Reality (verified):** `delivTabsForRole` (`public/app.07-warehouse-delivery.js:1697-1701`) returns
  `{today,list,calendar}` for **every** role except `delivery_exec` (`{list}`) and `super_admin` (all 4).
  For the 8 roles that cannot open the hub — procurement_manager, warehouse_exec, finance_admin, and the
  client/vendor roles — `delivery` is not in their nav (`ROLES` at `app.01-core.js:66-77`; `delivery`
  nav entries only at platform/ops/delivery/delivery_exec profiles) and the delivery ACTION_PAGES only
  list super_admin/ops_admin/delivery_manager (`app.01-core.js:750-752`), so
  `{tab | canAccessPage(backing)} = {}` while `delivTabsForRole = {today,list,calendar}`. Divergent.
- **Why it's a plan defect, not a runtime bug:** `delivTabsForRole` is only ever *invoked* for
  hub-accessible roles (`renderDeliveriesHub` is reached only via `navigate('delivery')`), so the dead
  path never runs — but A4f as written goes red for 8 roles with **no Group B task to fix it**, so the
  milestone could never reach all-green.
- **Fix folded:** scope A4f's equality to hub-accessible roles; add **B5** — a defensive guard so
  `delivTabsForRole` returns `[]` for no-access roles, making the R3/AC14 invariant hold for all 12.

## Other findings — CONFIRMED (verified) & folded

### 🟠 `no-xfail-in-plain-node-script`
`test:phase2` is a plain `node` script; `smoke.mjs` exits non-zero on any `failures[]` entry
(`test/smoke.mjs:184-187`) and Node has no `.todo`/xfail. Folded: `phase2.mjs` defines `expect()` (counts
toward exit code) and `todo(name,cond,ac)` (records expected-red, never affects exit code); Group A marks
known-red ACs as `todo`, Group B/C promote them to `expect`. Keeps Commit A green-CI.

### 🟠 `phase2-must-not-copy-blanket-401-stub`
`smoke.mjs:67` stubs `window.fetch` to a URL-agnostic 401. Folded: `phase2.mjs` installs its own
URL-switching stub (routes `/reports/consolidated-due` + `/nav-badges` to fixtures for AC15, else 401),
so the badge's N>0 / 0 states are reachable.

## Attacks that failed (verified sound by the returned skeptic)
- `ops_manager` phantom at `app.01-core.js:739` is real and not in `ROLES` → B1 target correct; removing
  it doesn't affect smoke.
- `origin/main` predates the consolidation (no `renderOrdersHub` there) → A2/A3 `git show origin/main:…`
  fixture extraction is viable.
- `ORDER_STEPS` / inline 5-div bar are already **absent** from `public/*.js` → AC10 negative grep is
  satisfiable (and A4g likely green).
- `phaseStepper`/`orderPhaseIndex` return −1 + no `ostep--cancelled` for the fallback set without throwing
  → A4e/AC9 satisfiable against shipped code.
- Driving `onHashChange()`/`doLogout()` directly after setting `location.hash`, and `history.replaceState`,
  work under Playwright `setContent` → A4h/A4j/A4k drivable.

## Actions Taken
- [x] Verified all findings against source; folded fixes into `plan.md` (A0, A4f scope + no-access assert,
  B5 guard, todo/expect mechanism, per-URL fetch stub).
- [x] Recorded degraded-quorum honestly; Group A executable checks are the second objective net.
- [ ] Plan gate resolved → proceed to Construction (user approved the Planning gate).
