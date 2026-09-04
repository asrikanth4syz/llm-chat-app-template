# Spec Adversarial Review r2 — Phase 2 Consolidation

> `spec-validator` · 3 independent skeptics · default-to-reject · 2-of-3 majority gate · **re-run (round 2 of 2)**

| Field | Value |
|---|---|
| Milestone | `001-phase2-consolidation` |
| Artifact | `spec.md` (rev 2 → folded to rev 3 here) |
| Date | 2026-09-04 |
| Result | **13 confirmed · ~9 unconfirmed** — highest severity **high**. Re-run budget spent; confirmed items folded into rev 3, gate declared resolved. |

## Verdict

Rev 2 closed all the round-1 holes but the new reference tables introduced fresh seams. The panel
confirms 13 findings — mostly making the new tables watertight, plus **three substantive** ones:
(1) the Deliveries hub is gated by `delivTabsForRole`, not `canAccessPage`, so AC5's "identical
canAccessPage gate" points at the wrong mechanism for delivery; (2) AC7's "independent" ACL baseline
re-imported the self-referential `nav ∪ ACTION_PAGES` identity; (3) AC3 over-prescribed a *mechanism*
whose literal form **deadlocks** — and that deadlock is a **real latent bug in the shipped code**
(`writeHash` sets `_hubTabWritten` even when the hash is unchanged and no `hashchange` fires, so a later
Back to that tab is swallowed). Also confirmed: `ACTION_PAGES.place_order` references `ops_manager`, a
role not in `ROLES` (phantom-role reconciliation). All folded into **rev 3**; per Contract 3 the re-run
budget (one) is spent, so the gate is resolved with rev 3 and the residue is carried as explicit
plan/impl test requirements (the plan and implementation gates will enforce them).

## Confirmed Findings (≥ 2 votes) → folded into rev 3

| # | id | sev | votes | Fix folded into rev 3 |
|---|---|---|---|---|
| 1 | `delivery-gate-authority` | 🔴 | 3 | R3/AC5/AC14: delivery tabs are gated by `delivTabsForRole` (single authority); require a test asserting `delivTabsForRole(role)` == `{tab | canAccessPage(backing)}` for all roles × 4 delivery tabs; AC5's "identical gate" scoped to orders/my_orders (canAccessPage) and delivery (delivTabsForRole). |
| 2 | `ac7-baseline-not-independent` + `ac7-matrix-values` | 🔴 | 3 | AC7: the **hand-authored expected-access matrix is the sole authority**, committed as a versioned fixture with concrete (role×page) allow/deny values authored from product intent — `nav ∪ ACTION_PAGES` dropped from the positive baseline (kept only as a "must-still-be-reachable" lower bound from sidebar NAV history). |
| 3 | `ac3-mechanism-and-deadlock` | 🔴 | 3 | AC3: specify **observable behavior** not mechanism — a self-write must not re-render; any user hashchange (incl. return to the last self-written tab) must flip the tab; **explicitly handle the write-same-hash case** (no `hashchange` fires → the dedupe guard must still allow the next real navigation). Marks the shipped `_hubTabWritten` design as needing this fix. |
| 4 | `ac15-count-equals-boolean` | 🟠 | 3 | AC15: drop "MUST equal the pre-consolidation value" (old `!` was a presence flag, no count); pin `N = |{ due items where overdue predicate holds }|` with the named field + comparison + timezone. |
| 5 | `ac15-eventually-populate-unbounded` | 🟠 | 3 | AC15: badge element present synchronously at hub render (possibly empty/hidden); populates within one animation frame of the **named** badge-data promise settling; test awaits that specific signal. |
| 6 | `ac15-unavailable-vs-zero` | 🟠 | 2 | AC15: make unavailable observably distinct (e.g. `data-badge-state="unknown"` / neutral dot) OR delete the word "distinct" and declare both render no badge; give exact DOM for all three states; scope the "permanently absent = FAIL" clause to the N>0-loadable case only. |
| 7 | `ac9-fallback-set-narrower` | 🟠 | 3 | AC9 test set = full R2 literals **∪** every non-lifecycle token in `statusBadge` (adds SENT, SCHEDULED, OPEN, IN_PROGRESS) **∪** a never-seen random string; each asserted by name → Placed-anchored render, no throw. Cancelled marker gets a distinct testable selector vs the fallback. |
| 8 | `ac10-surfaces-open-ended` | 🟠 | 3 | AC10: replace "any other surface" with a **closed list** of exact file:function order-progress surfaces (from a grep now); assert each calls `phaseStepper` (positive invariant), not just the renameable `ORDER_STEPS` negative grep. |
| 9 | `ac10-grep-token-renameable` | 🟠 | 2 | AC10: positive "calls phaseStepper" assertion per enumerated surface; negative grep lists the concrete tokens/markers, not a single identifier. |
| 10 | `ac8-real-content-vs-stub` | 🟠 | 3 | AC8: per folded id, assert its primary content container exists (named selector / row-count > 0 on a seeded fixture) or a documented redirect — "not an empty stub" made objective. |
| 11 | `ac8-nav-baseline` | 🟡 | 3 | AC8: compare serialized `NAV[profile]` structures (the five untouched profiles) deep-equal a committed fixture — "byte-for-byte" replaced; reconcile `vendor_user` (a role AND a nav profile). |
| 12 | `default-tab-unpinned` (AC2/AC6/R3) | 🟠 | 2 | R3 gets a **default-tab** = first accessible tab in listed order; AC6: accessible page + forbidden/unknown tab → that hub default accessible tab (never `sp_page`); AC2 final fallback when neither hash nor sp_page is accessible → `getDefaultPage(role)`. |
| 13 | `phantom-role-ops_manager` (R1/AC7) | 🟡 | 3 | R1/AC7: add assertion that every role key in any `ACTION_PAGES` value ∈ `Object.keys(ROLES)` (fails on `ops_manager` phantom), and assert `Object.keys(ROLES)` deep-equals the 12 named roles (not just length 12). Reconcile/annotate `ops_manager`. |

## Unconfirmed (FYI · 1 vote) — folded where cheap
- `ac5-normalize-vs-echo-token` (S2) — folded: raw folded-hash normalization uses `replaceState` and must not double-render.
- `ac5-delivery-sub-pages-not-enumerated` (S3) — folded: AC5 enumerates todays_schedule/delivery_calendar/delivery_routes.
- `r3-queue-gate-equals-hub-gate` (S2) — folded: note Queue is always shown; AC12 0/1-tab branches are exercised via My Orders / Deliveries, not Orders.
- `ac1-vs-ac12-single-tab-addressability` (S3) / `ac1-default-tab-hash-unpinned` (S1) — folded: single-tab hubs still normalize `#hub/slug`; default landing normalized to `#hub/<defaultSlug>`.
- `ac12-zero-tabs-conflated-with-hub-acl` (S1) — folded: define "hub accessible AND 0 tabs" → dashboard/empty-state, separate from `canAccessPage(hub)`.
- `ac9-cancelled-vs-unknown-indistinguishable` (S3) — folded into #7.
- `ac4-render-count-window` (S1+S3, 2 votes actually) — folded: define the measurement window + same-tab expected count (0 additional renders).

## Attacks That Failed (corroborate rev 2 holds)
- R2 including DELIVERED/RECEIVED/REJECTED — explicitly labeled display synonyms, not an FSM claim.
- PARTIALLY_CLOSED→Shipment — documented accepted product decision.
- HUB_REDIRECT double-guard prevents widening for orders/my_orders folds at the navigate() layer.
- AC16 logout `replaceState(pathname+search)` → `location.hash===''` is concrete/testable.
- delivery_exec single-tab (`list` only) is a concrete verifiable value.

## Actions Taken
- [x] Persisted this r2 verdict.
- [x] Re-run budget (1) spent — no third panel.
- [ ] Fold all 13 confirmed + cheap-unconfirmed tightenings into `spec.md` rev 3.
- [ ] Carry the AC3 echo-dedupe deadlock as an explicit **implementation fix** for Construction (real bug in shipped code).
- [ ] Proceed to Phase 2 Planning.
