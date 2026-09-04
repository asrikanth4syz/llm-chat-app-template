# Product Specification: Phase 2 — Consolidation

> **Milestone type:** Brownfield consolidation. A first implementation of all four items exists on
> branch `claude/phase-2-consolidation-34ggxj` (see `context.md`). This spec defines the **contract
> independently of that implementation** — expected values are stated explicitly so any criterion can
> *fail* the current code. (Rev 2 after spec-validator: all acceptance criteria are now falsifiable and
> pinned to explicit expected values, per `validation/spec-validation.md`.)

## 🎯 Executive Summary
* **Goal:** Consolidate the scattered Orders and Deliveries surfaces into addressable tabbed hubs, with
  one phase-based order-status stepper, verified against an explicit acceptance contract.
* **Target User:** Internal staff (super_admin, ops_admin, delivery roles) and client roles
  (client_admin, client_approver, client_user).
* **Business Value:** fewer sidebar entries, a consistent tabbed model, URL-addressable/shareable tabs
  that survive reload + back/forward, and a single status model replacing divergent progress bars.

## 📖 Reference tables (single source of truth for the criteria below)

### R1 — Role universe (12 roles in `ROLES`)
`super_admin, ops_admin, procurement_manager, warehouse_exec, delivery_manager, delivery_exec,
finance_admin, client_admin, client_approver, client_user, vendor_admin, vendor_user`.
"Delivery roles" = {delivery_manager, delivery_exec}. Tests MUST derive the iteration set from
`Object.keys(ROLES)` and assert its length is **12**.

### R2 — Order status universe → phase (authoritative; supersedes any "N statuses" prose)
The stepper MUST accept **every** status string the app can assign, cross-referenced to `statusBadge`
(`public/app.01-core.js`). Mapping:

| Phase (index) | Statuses |
|---|---|
| Placed (0) | DRAFT, PENDING_PRICING, SUBMITTED |
| Approved (1) | PENDING_APPROVAL, APPROVED, ACKNOWLEDGED |
| Fulfilment (2) | INVENTORY_CHECK, VENDOR_PO_RAISED, READY_TO_PICK, PICKED, QUALITY_CHECK |
| Shipment (3) | IN_SHIPMENT, PARTIALLY_CLOSED |
| Delivered (4) | CLOSED, DELIVERED, RECEIVED |
| Cancelled (terminal, index −1) | CANCELLED, REJECTED |

- **DELIVERED/RECEIVED/REJECTED** are display synonyms accepted for robustness even though the core
  order FSM in `context.md` ends at CANCELLED; they are included deliberately (not an FSM claim).
- **Fallback:** any status **not** in this table and **not** CANCELLED/REJECTED — including
  `null`/`undefined`/`''`/unknown future statuses, and any order-adjacent status seen in `statusBadge`
  that is not an order-lifecycle status (e.g. IN_TRANSIT, DISPATCHED, ACCEPTED, SENT, SCHEDULED, OPEN,
  IN_PROGRESS, RESOLVED, INVOICED) — MUST render the stepper anchored at Placed (index 0) with **no**
  step marked done/current, and MUST NOT throw. (This is the documented, testable "unknown" state.)
- **PARTIALLY_CLOSED** is intentionally mapped to Shipment (accepted product decision; a distinct
  partial-delivery indicator is out of scope for this milestone).

### R3 — Hub tab table (slug ↔ backing page id ↔ label ↔ ACL check)
| Hub page id | Tab slug (URL) | Backing page id (renderer) | Label | Tab shown iff |
|---|---|---|---|---|
| `orders` | `queue` | `orders` (renderOrderQueue) | Queue | canAccessPage('orders') |
| `orders` | `pipeline` | `pipeline` (renderPipeline) | Pipeline | canAccessPage('pipeline') |
| `orders` | `due` | `consolidated_due` (renderConsolidatedDue) | Due Items | canAccessPage('consolidated_due') |
| `my_orders` | `orders` | `my_orders` (renderMyOrders) | My Orders | canAccessPage('my_orders') |
| `my_orders` | `tracking` | `track_delivery` (renderTrackDelivery) | Track Delivery | canAccessPage('track_delivery') |
| `delivery` | `today` | `todays_schedule` | Today's Runs | delivTabsForRole |
| `delivery` | `list` | `delivery` (renderDelivery) | Deliveries | delivTabsForRole |
| `delivery` | `calendar` | `delivery_calendar` | Calendar | delivTabsForRole |
| `delivery` | `routes` | `delivery_routes` | Routes | delivTabsForRole (super_admin only) |

Slugs are stable and lowercase. The router MUST resolve a `#hub/slug` **only** through this table.

## 🛠️ User Stories & Workflows
- **As** an ops_admin, **I want** Queue, Pipeline, and Due Items under one "Orders" surface **so that**
  I stop hunting across three sidebar entries.
- **As** any user, **I want** the current tab reflected in the URL **so that** I can reload, deep-link,
  and use back/forward and land on the same tab.
- **As** a delivery_manager, **I want** the Deliveries hub tabs addressable **without** widening access.
- **As** a client_user, **I want** "My Orders" and "Track Delivery" in one place.
- **As** any user viewing an order, **I want** its status as a five-phase stepper reading the same
  everywhere.
- **As** an ops_admin, **I want** the overdue Due-Items count on the Orders-hub tab **so that** folding
  Due Items into a tab does not cost me the at-a-glance signal.

## 📋 Acceptance Criteria
*Each expected value is explicit (per R1–R3); a criterion the current code violates FAILS the milestone
and is a fix, not a relabel.*

### AC1 — Every hub tab is URL-addressable and survives reload
- **Given** a role that can access the Orders hub
- **When** it activates the Pipeline tab
- **Then** `location.hash === '#orders/pipeline'`, and a full reload re-opens the Orders hub on Pipeline
  (not the default tab, not the dashboard). Same for `#orders/queue`, `#orders/due`, `#my_orders/*`,
  `#delivery/*` per R3.

### AC2 — Hash takes precedence over stored page on boot
- **Given** `localStorage.sp_page` and `location.hash` disagree on reload (e.g. `sp_page='dashboard'`,
  hash `#orders/pipeline`)
- **When** the app boots
- **Then** a present **and accessible** `location.hash` wins (page + tab); `sp_page` is used only when
  the hash is empty/invalid/forbidden; the resolved landing is deterministic.

### AC3 — Back/forward flips tabs in place, including return-to-same-tab
- **Given** a user toggles `#orders/queue` → `#orders/pipeline`
- **When** they press Back
- **Then** the hub returns to Queue. **And** given they later navigate away and press Back to a hash
  whose tab equals the last value the app itself wrote, that Back **still** flips the tab (the echo
  dedupe MUST be a one-shot token set immediately before `writeHash` and cleared on receipt of the
  matching `hashchange`, per-hub — NOT an indefinitely-retained last-tab comparison).

### AC4 — In-hub tab switch renders the body exactly once
- **Given** an in-hub tab switch (click or back/forward)
- **When** it occurs
- **Then** the target tab-body renderer is invoked **exactly once** (assert via a render-count spy or a
  `data-render-token` that increments by exactly 1), the hub-shell/tab-bar builder is **not** re-run,
  and `#main-content`'s hub container DOM node is preserved (no full-page teardown).

### AC5 — Raw hash input obeys the same ACL + folding as navigate()
- **Given** any role and a raw `location.hash` typed/shared/reloaded (not via `navigate()`)
- **When** `onHashChange` or `initApp` boot resolves it
- **Then** it applies the **identical** `canAccessPage` gate and `HUB_REDIRECT` folding as `navigate()`:
  a hash to a folded page id (`#pipeline`, `#consolidated_due`, `#track_delivery`, delivery sub-pages)
  is redirected into its hub tab and the hash normalized (never a bare standalone page); a hash to a
  page/tab the role may not access is refused. Concretely: `delivery_exec` setting `#delivery/routes`
  does **not** reach Routes.

### AC6 — Malformed / unknown / forbidden hash has a defined safe landing
- **Given** a hash like `#orders/`, `#orders/bogus`, `#nope/x`, wrong case, or a forbidden tab
- **When** resolved
- **Then** unknown page → dashboard; unknown/forbidden tab on a valid accessible hub → the hub's default
  **accessible** tab; the hash is normalized via `replaceState`; `#main-content` is never left empty and
  nothing throws. Slug matching is lowercase; a trailing slash is treated as no tab.

### AC7 — ACL parity against an independent baseline (not against ACTION_PAGES)
- **Given** a **frozen fixture** capturing, per role, the pre-consolidation reachable-page set
  (nav ∪ ACTION_PAGES snapshot, committed as test data) AND a hand-authored expected-access matrix
- **When** `canAccessPage(role, pg)` is evaluated for all 12 roles (R1) × every `PAGE_MAP` page
- **Then** every (role, page) reachable before consolidation is still reachable, no (role, page) is
  reachable that the hand-authored matrix forbids, and explicit **negative** cases hold (e.g.
  `delivery_exec` ∌ {calendar, routes, today}; client roles ∌ staff-only pages). `npm run test:smoke`
  passes all existing checks (routes resolve, every `dataAct` target resolves, no off-nav quick action).

### AC8 — No page id removed (against a frozen baseline, no stubs)
- **Given** a committed fixture listing every **pre-consolidation** `PAGE_MAP` page id
- **When** the consolidation is applied
- **Then** current `PAGE_MAP` ⊇ that frozen set; each id resolves to a function; and each **folded** id's
  renderer produces real content or an intentional redirect (**not** an empty stub). Untouched navs
  (procurement, warehouse, finance, vendor, vendor_user) are byte-for-byte unchanged.

### AC9 — Phase stepper maps every status per R2, with a defined fallback
- **Given** `phaseStepper(status)` iterated over the full R2 status set **plus** {null, undefined, '',
  'IN_TRANSIT', 'DISPATCHED', 'ACCEPTED', 'RESOLVED', 'INVOICED'}
- **Then** each maps to its R2 phase / cancelled marker; every fallback input renders the Placed-anchored
  no-progress stepper without throwing. Test asserts each input by name.

### AC10 — One stepper, reused; no bespoke bar remains (enumerated)
- **Given** the enumerated set of order-progress surfaces {client My Orders cards (`renderMyOrders`),
  and any other surface that renders order lifecycle progress}
- **Then** each uses the shared `phaseStepper`; a grep/AST assertion confirms the old bespoke
  `ORDER_STEPS`/5-stage-bar constructs are **absent** from `public/app.*.js`.

### AC11 — Order Queue phase filter preserves exact-status deep links
- **Given** the Order Queue phase-stepper filter
- **When** `oqGoto('PENDING_APPROVAL')` / `openPendingApprovals` runs
- **Then** the table filters to that exact status **and** its phase ("Approved") is highlighted; clicking
  a phase filters to all statuses in that phase (R2); an "All" step clears the filter.

### AC12 — Orders hub tab set is role-correct (0/1/≥2 rule)
- **Given** super_admin / ops_admin
- **Then** the Orders hub shows Queue · Pipeline · Due Items. **General rule:** a hub shows only tabs
  whose backing page the role `canAccessPage` (R3); with **≥2** accessible tabs → tab bar; **exactly 1**
  → that tab's renderer directly, no bar; **0** → the hub is inaccessible (`canAccessPage(hub)` false →
  redirect to dashboard).

### AC13 — My Orders hub tab set is role-correct
- **Given** client_admin / client_approver / client_user
- **Then** the My Orders hub shows Orders · Track Delivery **only for tabs the role can access** (R3, AC12
  rule); `track_delivery` is off-sidebar, reachable via `ACTION_PAGES`, folded via `HUB_REDIRECT`. A
  client role lacking `canAccessPage('track_delivery')` MUST NOT be shown the Tracking tab.

### AC14 — Deliveries hub addressable, access unchanged
- **Given** the Deliveries hub
- **Then** its tabs are addressable per R3, honor deep links + back/forward, and the role→tab set is
  exactly what `delivTabsForRole` granted before (delivery_exec sees only `list`).

### AC15 — Due Items hub-tab count badge (approved enhancement)
- **Definition:** the badge value = **count of due items that are overdue**, computed from the same
  data the pre-consolidation sidebar `!` badge used (the `/nav-badges` / due-items signal); it MUST
  equal that pre-consolidation value for the same data. (If that source is a boolean presence flag, the
  count comes from the due-items dataset filtered to overdue.)
- **Given** the Orders hub for a role that can see Due Items, and a deterministic fixture with N>0
  overdue due items
- **Then** the "Due Items" tab renders a visible badge showing N **within the same async cycle that
  loads the badge data** (it MUST NOT block tab render, and MUST eventually populate — a permanently
  absent badge is a FAIL). Counts > 99 display as "99+". `count === 0` → **badge absent**.
  Data **unavailable / NaN / negative** → a distinct non-count state (no badge, treated as unknown —
  NOT rendered as 0). The badge MUST NOT break the smoke `dataAct`/route invariants.

### AC16 — Logout clears ALL addressable-tab state
- **Given** a user on any hub hash (`#orders/pipeline`, `#delivery/routes`, `#my_orders/tracking`, …)
- **When** they log out
- **Then** `doLogout` resets to a hash-free URL via `history.replaceState(null,'',location.pathname
  + location.search)` for **any** current hash (asserted `location.hash === ''`), fires no navigation
  while logged out, and clears `localStorage.sp_page` (already done today) so a fresh login on the same
  browser never deep-links into the previous user's surface.

## 🚨 Constraints & Edge Cases
- **No-build SPA:** browser-native ES in `public/app.NN-*.js`; new click handlers are top-level
  `function` declarations (window globals for `dataAct` + smoke).
- **Page-id invariant:** never delete a page id; fold into a hub tab + `ACTION_PAGES`.
- **Smoke is a gate but not the ACL oracle:** `canAccessPage`'s correctness is judged by AC7's
  independent matrix/baseline, not by the self-referential `nav ∪ ACTION_PAGES` identity.
- **Nested header (DECISION — keep as-is):** hub tab bodies reuse full renderers with their own
  `pageHeader`; the stacked header is accepted for parity with the Deliveries hub. Out of scope to change.
- **Non-functional gate:** `npm run test:smoke` green and `tsc --noEmit` clean are release conditions.
- **Roles untouched:** procurement, warehouse, finance, vendor, vendor_user navs unchanged (AC8).

## 🎨 UI/UX Mockups
```
Orders hub (super_admin / ops_admin)          URL: #orders/queue | #orders/pipeline | #orders/due
┌───────────────────────────────────────────────┐
│ [ Queue ]  [ Pipeline ]  [ Due Items ‹99+› ]   │  ‹N› = overdue count badge (absent when 0)
├───────────────────────────────────────────────┤
│  active tab body = existing renderer            │
│  Queue: ● All — 📝 Placed — ✅ Approved — 📦 …   │  phase-stepper filter
└───────────────────────────────────────────────┘
Phase stepper: 📝 Placed ─✓─ ✅ Approved ─●─ 📦 Fulfilment ─○─ 🚚 Shipment ─○─ 🏁 Delivered
  (CANCELLED/REJECTED → red ✕ terminal; unknown/null → Placed-anchored, no step lit)
```

## Out of scope
- Backend/API changes. Suppressing hub-hosted renderers' own headers. Re-adding a sidebar affordance
  for the due count. A distinct PARTIALLY_CLOSED partial-delivery indicator. New consolidation beyond
  the four named items.
