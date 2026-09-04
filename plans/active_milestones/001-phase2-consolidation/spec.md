# Product Specification: Phase 2 — Consolidation

> **Milestone type:** Brownfield **verification-and-hardening**. A first implementation of all four
> items already exists and is smoke/tsc-green on branch `claude/phase-2-consolidation-34ggxj`
> (see `context.md`). This spec defines the testable contract the existing implementation must satisfy,
> plus one approved enhancement (Due Items hub-tab badge). Scope decision confirmed with the user in the
> Grill Loop: verify & harden only — no new features beyond this spec.

## 🎯 Executive Summary
* **Goal:** Consolidate the scattered Orders and Deliveries surfaces of the SmartPantry SPA into
  addressable tabbed hubs, with a single phase-based order-status stepper, verified against a rigorous
  acceptance contract and hardened where gaps are found.
* **Target User:** Internal staff (super_admin, ops_admin, delivery roles) and corporate-client roles
  (client_admin, client_approver, client_user) who navigate orders and deliveries.
* **Business Value:** Fewer sidebar entries and a consistent tabbed model reduce navigation friction;
  URL-addressable tabs make surfaces shareable/deep-linkable and survive reload/back-forward; one
  status model removes the divergent bespoke progress bars.

## 🛠️ User Stories & Workflows
- **As** an ops_admin, **I want** the Order Queue, Pipeline board, and Due Items under one "Orders"
  surface with tabs **so that** I stop hunting across three sidebar entries.
- **As** any staff or client user, **I want** the tab I'm on reflected in the URL **so that** I can
  reload, deep-link, or use browser back/forward and land on the same tab.
- **As** a delivery_manager, **I want** the existing Deliveries hub tabs to be addressable **so that**
  a shared link opens the right sub-view without widening my access.
- **As** a client_user, **I want** "My Orders" and "Track Delivery" in one place **so that** I switch
  between ordering and tracking without leaving the surface.
- **As** any user viewing an order, **I want** its status shown as a five-phase stepper **so that**
  progress reads the same everywhere.
- **As** an ops_admin, **I want** the overdue Due-Items count visible on the Orders-hub tab **so that**
  folding Due Items into a tab does not cost me the at-a-glance signal I had in the sidebar.

## 📋 Acceptance Criteria
*Verified against the implementation on this branch; any failing criterion is a hardening task.*

### Scenario: Every hub tab is URL-addressable
- **Given** a role that can access the Orders hub
- **When** it navigates to the Pipeline tab
- **Then** the URL hash becomes `#orders/pipeline`, and a full page reload re-opens the Orders hub on
  the Pipeline tab (not the default tab, not the dashboard).

### Scenario: Browser back/forward switches tabs in place
- **Given** a user on `#orders/queue` who clicks the Pipeline tab (now `#orders/pipeline`)
- **When** they press browser Back
- **Then** the hub returns to the Queue tab without a full page re-render or a duplicate render of the
  Queue body.

### Scenario: A folded page's deep link opens inside its hub
- **Given** a role with access to both `orders` and the folded `pipeline`/`consolidated_due` pages
- **When** any existing shortcut calls `navigate('pipeline')` or `navigate('consolidated_due')`
- **Then** it opens the Orders hub on the Pipeline / Due Items tab respectively (via `HUB_REDIRECT`),
  never a bare standalone page.

### Scenario: Hash routing never widens access
- **Given** any role and any hub sub-page it may NOT reach
- **When** a `#page/tab` or `navigate()` redirect targets that sub-page
- **Then** the redirect does not occur unless `canAccessPage(subpage)` is true; e.g. `delivery_exec`
  stays on its single Deliveries tab and reaches no calendar/routes/today tab.

### Scenario: ACL parity holds for all roles (smoke invariant)
- **Given** the 12 roles in `ROLES`
- **When** `canAccessPage(pg)` is evaluated for every `PAGE_MAP` page
- **Then** it is true **iff** `pg` is `dashboard`, or in that role's `NAV`, or in `ACTION_PAGES[pg]`
  for that role — and `npm run test:smoke` passes all checks (routes resolve, every `dataAct` target
  resolves, no off-nav quick action).

### Scenario: No page id is removed
- **Given** the pre-consolidation `PAGE_MAP`
- **When** the consolidation is applied
- **Then** every original page id still resolves to a render function (folded pages remain in
  `PAGE_MAP` and reachable via `ACTION_PAGES`); no id is deleted.

### Scenario: Phase stepper maps every status correctly
- **Given** `phaseStepper(status)` and the 15 FSM statuses
- **When** rendered for each status
- **Then** DRAFT/PENDING_PRICING/SUBMITTED → phase "Placed"; PENDING_APPROVAL/APPROVED/ACKNOWLEDGED →
  "Approved"; INVENTORY_CHECK/VENDOR_PO_RAISED/READY_TO_PICK/PICKED/QUALITY_CHECK → "Fulfilment";
  IN_SHIPMENT/PARTIALLY_CLOSED → "Shipment"; CLOSED/DELIVERED/RECEIVED → "Delivered"; and
  CANCELLED/REJECTED render a distinct cancelled terminal marker rather than a normal phase.

### Scenario: One stepper, reused
- **Given** the client "My Orders" cards
- **When** an order card renders its progress
- **Then** it uses the shared `phaseStepper` (no bespoke per-surface 5-stage bar remains).

### Scenario: Order Queue phase filter preserves exact-status deep links
- **Given** the Order Queue with the phase-stepper filter
- **When** an existing deep link calls `oqGoto('PENDING_APPROVAL')` (or `openPendingApprovals`)
- **Then** the table filters to that exact status AND the containing phase ("Approved") is highlighted;
  clicking a phase step filters to all statuses in that phase; an "All" step clears the filter.

### Scenario: Orders hub tab set is role-correct
- **Given** super_admin and ops_admin
- **When** the Orders hub renders
- **Then** it shows tabs Queue · Pipeline · Due Items; a role that can reach only one of these tabs is
  shown the plain page (no pointless single-tab bar).

### Scenario: My Orders hub tab set is role-correct
- **Given** client_admin, client_approver, client_user
- **When** the My Orders hub renders
- **Then** it shows tabs Orders · Track Delivery (Tracking); `track_delivery` is off-sidebar but
  reachable via `ACTION_PAGES` and folded via `HUB_REDIRECT`.

### Scenario: Due Items hub tab shows the overdue count (APPROVED ENHANCEMENT)
- **Given** the Orders hub for a role that can see Due Items
- **When** the hub tab bar renders and due-items data is available
- **Then** the "Due Items" tab displays a small count badge of overdue/pending due items, so the signal
  lost from the sidebar is preserved; when the count is zero the badge is absent; the badge must not
  break the smoke `dataAct`/route invariants and must degrade gracefully if the count is unavailable.

### Scenario: Logout clears the addressable-tab hash
- **Given** a user on `#orders/pipeline`
- **When** they log out
- **Then** the hash is cleared (via `history.replaceState`, without firing a navigation while logged
  out), so a fresh login does not deep-link into the previous user's last tab.

## 🚨 Constraints & Edge Cases
- **No-build SPA:** all code is browser-native ES in `public/app.NN-*.js`; new click handlers must be
  top-level `function` declarations so they are `window` globals for `dataAct` + the smoke test.
- **Page-id invariant:** never delete a page id; fold into a hub tab + `ACTION_PAGES` instead.
- **Smoke ACL identity is the gate:** removing any nav item requires a matching `ACTION_PAGES` entry
  for every role that had it; `canAccessPage` must equal `nav ∪ ACTION_PAGES` exactly.
- **Hash self-write race:** each hub must call `writeHash` on both initial render and tab switch and
  `registerHub` once; `onHashChange` must ignore the echo of our own write (dedupe by last-written
  tab) so external back/forward is the only thing that flips a tab.
- **Nested header (DECISION — keep as-is):** hub tab bodies reuse full page renderers that include
  their own `pageHeader`; the resulting stacked header is accepted for parity with the Deliveries hub.
  Not a defect; do not refactor renderers to suppress it in this milestone.
- **Non-functional gate:** `npm run test:smoke` green and `tsc --noEmit` clean are release conditions.
- **Roles untouched:** procurement, warehouse, finance, vendor, vendor_user navs must be unchanged.
- **Due-badge data source:** the count should come from the same signal the sidebar `!` badge used
  (nav-badges / due-items data); if that data is not readily available at hub-render time without a
  new blocking fetch, the badge may be populated lazily/asynchronously and must never block tab render.

## 🎨 UI/UX Mockups
```
Orders hub (super_admin / ops_admin)
┌───────────────────────────────────────────────┐
│ [ Queue ]  [ Pipeline ]  [ Due Items ⑤ ]       │  ← hub tab bar; ⑤ = overdue count badge
├───────────────────────────────────────────────┤
│  (active tab body = existing renderer)          │
│  Queue tab: phase-stepper filter                │
│  ● All  —  📝 Placed  —  ✅ Approved  —  📦 …    │
└───────────────────────────────────────────────┘
URL: #orders/queue | #orders/pipeline | #orders/due
```
```
Phase stepper (any order status)
📝 Placed ──✓── ✅ Approved ──●── 📦 Fulfilment ──○── 🚚 Shipment ──○── 🏁 Delivered
(CANCELLED → red ✕ terminal marker in place of the normal steps)
```

## Out of scope
- Any backend/API change.
- Suppressing hub-hosted renderers' own headers (decided: keep as-is).
- Re-adding a sidebar affordance for the due count (decided: badge on the hub tab only).
- New consolidation beyond the four named items.
