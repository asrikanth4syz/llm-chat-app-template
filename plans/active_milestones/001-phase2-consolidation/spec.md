# Product Specification: Phase 2 — Consolidation

> **Rev 3** (spec-validator rounds 1 + 2 folded; gate resolved — see `validation/spec-validation.md`,
> `validation/spec-validation-r2.md`). Brownfield consolidation: a first implementation exists on
> `claude/phase-2-consolidation-34ggxj` (see `context.md`). Acceptance criteria are pinned to explicit
> expected values so any criterion can *fail* the current code. Two criteria (AC3, AC5) encode **latent
> bugs** the panel found in the shipped code that Planning/Construction must fix.

## 🎯 Executive Summary
* **Goal:** consolidate the scattered Orders and Deliveries surfaces into addressable tabbed hubs, with
  one phase-based order-status stepper, verified against an explicit, implementation-independent contract.
* **Target User:** internal staff (super_admin, ops_admin, delivery roles) and client roles.
* **Business Value:** fewer sidebar entries; a consistent tabbed model; URL-addressable/shareable tabs
  that survive reload + back/forward; one status model replacing divergent progress bars.

## 📖 Reference tables (single source of truth)

### R1 — Role universe
`ROLES` = exactly these 12 keys: `super_admin, ops_admin, procurement_manager, warehouse_exec,
delivery_manager, delivery_exec, finance_admin, client_admin, client_approver, client_user,
vendor_admin, vendor_user`. "Delivery roles" = {delivery_manager, delivery_exec}.
- Tests MUST assert `Object.keys(ROLES)` **deep-equals** this set (order-insensitive), not merely
  `length === 12`.
- **Phantom-role reconciliation:** every role key appearing in any `ACTION_PAGES` value MUST be a member
  of `Object.keys(ROLES)`. `ACTION_PAGES.place_order` currently lists `ops_manager` (not in `ROLES`) —
  this stray entry MUST be removed (or `ops_manager` added to `ROLES` if it is a real role); a test
  asserts no phantom roles remain.

### R2 — Order status → phase (closed universe)
The stepper's accepted universe is **exactly** the union of the statuses in this table **and** the
non-lifecycle tokens listed in the fallback rule below — a finite, closed set. `statusBadge` is a
*reference for the order-lifecycle subset only* (its priority tokens HIGH/MEDIUM/LOW are **not**
statuses and are treated as unknown by the fallback).

| Phase (index) | Statuses |
|---|---|
| Placed (0) | DRAFT, PENDING_PRICING, SUBMITTED |
| Approved (1) | PENDING_APPROVAL, APPROVED, ACKNOWLEDGED |
| Fulfilment (2) | INVENTORY_CHECK, VENDOR_PO_RAISED, READY_TO_PICK, PICKED, QUALITY_CHECK |
| Shipment (3) | IN_SHIPMENT, PARTIALLY_CLOSED |
| Delivered (4) | CLOSED, DELIVERED, RECEIVED |
| Cancelled (terminal, −1) | CANCELLED, REJECTED |

- DELIVERED/RECEIVED/REJECTED are display synonyms (not an FSM claim).
- **Fallback set (each MUST render the Placed-anchored, no-step-lit stepper without throwing):**
  `null, undefined, ''`, the non-lifecycle tokens `IN_TRANSIT, DISPATCHED, ACCEPTED, SENT, SCHEDULED,
  OPEN, IN_PROGRESS, RESOLVED, INVOICED`, the priority tokens `HIGH, MEDIUM, LOW`, and **any** other
  string not in the phase table. (Property: any input not in the phase table and not CANCELLED/REJECTED →
  fallback render.)
- **Distinct terminal marker:** CANCELLED/REJECTED MUST render a testable cancelled marker (a node with
  selector `.ostep--cancelled` / red ✕) that the fallback render does **not** produce, so the two
  no-progress states are DOM-distinguishable.
- PARTIALLY_CLOSED → Shipment is an accepted product decision (a distinct partial indicator is out of scope).

### R3 — Hub tab table (slug ↔ backing page id ↔ label ↔ gate); **default tab = first row per hub**
| Hub page id | Tab slug | Backing page id | Label | Tab shown iff | Default? |
|---|---|---|---|---|---|
| `orders` | `queue` | `orders` (renderOrderQueue) | Queue | canAccessPage('orders') | ★ default |
| `orders` | `pipeline` | `pipeline` | Pipeline | canAccessPage('pipeline') | |
| `orders` | `due` | `consolidated_due` | Due Items | canAccessPage('consolidated_due') | |
| `my_orders` | `orders` | `my_orders` (renderMyOrders) | My Orders | canAccessPage('my_orders') | ★ default |
| `my_orders` | `tracking` | `track_delivery` | Track Delivery | canAccessPage('track_delivery') | |
| `delivery` | `today` | `todays_schedule` | Today's Runs | **delivTabsForRole** | |
| `delivery` | `list` | `delivery` (renderDelivery) | Deliveries | **delivTabsForRole** | ★ default |
| `delivery` | `calendar` | `delivery_calendar` | Calendar | **delivTabsForRole** | |
| `delivery` | `routes` | `delivery_routes` | Routes | **delivTabsForRole** (super_admin) | |

- **Gate authority:** orders/my_orders tabs are gated by `canAccessPage(backing)`; **delivery tabs are
  gated solely by `delivTabsForRole(role)`**. To keep the two consistent, a test MUST assert
  `delivTabsForRole(role)` equals `{ tab | canAccessPage(backingPageId(tab)) }` for all 12 roles × the 4
  delivery tabs (single effective authority, no divergence).
- **Default tab** for a role = the first row (in table order) for that hub whose gate passes for the role.
- The Queue tab's gate equals the Orders hub's own accessibility, so Queue is always shown when the hub
  is open; AC12's 0-/1-accessible-tab branches are therefore exercised via the My Orders and Deliveries
  hubs, not Orders.

## 📋 Acceptance Criteria

### AC1 — Hub tabs are URL-addressable; default landing is normalized
Activating a tab sets `location.hash` to its `#hub/slug` (R3); reload re-opens that hub+tab. Landing on a
hub without a tab (bare `#orders`, or `navigate('orders')`) MUST normalize the hash to `#hub/<defaultSlug>`
(R3 default) via `replaceState`. Single-accessible-tab hubs (AC12) still normalize to their `#hub/slug`.

### AC2 — Boot precedence: hash > sp_page, with defined fallbacks
On boot: if `location.hash` names an **accessible** page (and, for a hub, resolves to an accessible tab
per AC6) it wins (page + tab). Else `localStorage.sp_page`, if accessible, is used. Else `getDefaultPage(role)`.
The resolved landing is deterministic for every combination.

### AC3 — Back/forward flips tabs in place, including return-to-last-written-tab (**bug fix**)
A programmatic self-write MUST NOT cause a tab-body re-render; **any** user-driven hashchange — including
Back/forward returning to a hash whose tab equals the value the app last wrote itself — MUST flip the tab
(assert: write tab A, navigate away, Back to a hash with tab A → the tab-body renderer fires / render
token increments). The dedupe MUST also handle the **write-same-hash case**: when `writeHash` writes a
hash equal to the current one, no `hashchange` fires, so the dedupe state MUST NOT be left "armed" in a
way that swallows the next genuine navigation to that tab. *(This is a real defect in the shipped
`_hubTabWritten` design; the one-shot-token phrasing is guidance, not a mandated data structure — the
observable behavior above is the contract.)*

### AC4 — In-hub tab switch renders the body exactly once
Measurement window = from the click/back event dispatch until the next animation frame settles. Within it:
a **genuine** tab switch invokes the target tab-body renderer **exactly once**, does not re-run the
hub-shell/tab-bar builder, and preserves the hub container DOM node; a **same-tab** hashchange (resolved
tab already active) invokes the tab-body renderer **zero** additional times.

### AC5 — Raw hash obeys the role's real gate + folds folded pages (**bug check**)
`onHashChange` and `initApp` boot apply the same access decision and `HUB_REDIRECT` folding as `navigate()`:
for orders/my_orders that gate is `canAccessPage`; for delivery it is `delivTabsForRole` (R3). A raw hash
to a folded page id — `#pipeline`, `#consolidated_due`, `#track_delivery`, `#todays_schedule`,
`#delivery_calendar`, `#delivery_routes` — is redirected into its hub tab and the hash normalized via
`replaceState` (never a bare standalone page, no history spam, no double tab-body render). A hash to a
page/tab the role cannot access is refused per AC6. Concrete negative: `delivery_exec` setting
`#delivery/routes` does **not** reach Routes (delivTabsForRole grants it only `list`).

### AC6 — Malformed / unknown / forbidden hash → defined safe landing
Unknown page → dashboard. Unknown or forbidden **tab** on an accessible hub → that hub's **default
accessible tab** (R3), hash normalized via `replaceState`. `#main-content` is never empty; nothing throws.
Slugs are lowercase; a trailing slash means "no tab" (→ default tab).

### AC7 — ACL judged against a committed, hand-authored matrix (the sole authority)
A **committed fixture** enumerates the expected access decision (allow/deny) for **every** (role ∈ R1,
page ∈ `PAGE_MAP`) pair, hand-authored from product intent — **not** derived from `ACTION_PAGES` or
`canAccessPage`. The test asserts live `canAccessPage(role,pg)` equals that matrix cell-by-cell. A
separate lower-bound fixture, derived from the **pre-consolidation sidebar NAV** (menu-visible pages only,
from git history — not `ACTION_PAGES`), asserts no role lost a page it could previously reach from its
menu. Explicit negatives included in the matrix: `delivery_exec` ∌ {`delivery_calendar`, `delivery_routes`,
`todays_schedule`}; client roles ∌ the staff-only page set {`orders`, `pipeline`, `consolidated_due`,
`fulfilment`, `warehouse`, `procurement`, `vendors`, `clients`, `users`, `staff`, `zones`, `dc_billing`,
`reports`, `exec_bi`}. `npm run test:smoke` still passes all its existing checks.

### AC8 — No page id removed; untouched navs unchanged (against committed fixtures)
A committed fixture lists every **pre-consolidation** `PAGE_MAP` page id; the test asserts current
`PAGE_MAP` ⊇ that set and each id resolves to a function. Each **folded** id's renderer, given a seeded
fixture, MUST inject its primary content container (a named selector: pipeline board table, due-items
table, tracking list) or perform a documented redirect — asserted, so an empty stub fails. The `NAV`
arrays for the five untouched profiles (procurement, warehouse, finance, vendor, vendor_user) MUST
deep-equal a committed snapshot of their `{id,label}` structures (not a byte diff). (`vendor_user` is both
a role and a nav profile; the fixture covers the nav profile.)

### AC9 — Phase stepper mapped + exhaustive fallback + distinct cancelled marker
`phaseStepper(status)` is asserted for **every** status in R2's phase table (by name → its phase), for
CANCELLED/REJECTED (→ the `.ostep--cancelled` marker), and for the **entire** R2 fallback set (null,
undefined, '', IN_TRANSIT, DISPATCHED, ACCEPTED, SENT, SCHEDULED, OPEN, IN_PROGRESS, RESOLVED, INVOICED,
HIGH, MEDIUM, LOW, and one never-seen random string) → Placed-anchored no-progress render, no throw, and
NOT the cancelled marker.

### AC10 — One stepper, reused; enumerated surfaces (positive + negative checks)
Closed list of order-progress surfaces that MUST call `phaseStepper` (grepped now): `renderMyOrders`
(client cards); plus any surface the pre-work grep finds rendering a lifecycle progress bar. A test
asserts each listed surface calls `phaseStepper` (positive), and that the concrete bespoke tokens/markers
(`ORDER_STEPS`, and the inline 5-`div` progress-bar template) are absent from `public/app.*.js`
(negative). Renaming the identifier does not satisfy it — the positive assertion is primary.

### AC11 — Order Queue phase filter preserves exact-status deep links
`oqGoto('PENDING_APPROVAL')` / `openPendingApprovals` filters the table to that exact status and highlights
its phase (Approved); clicking a phase filters to all statuses in that phase (R2); an "All" step clears.

### AC12 — Hub tab set is role-correct (0 / 1 / ≥2 rule)
A hub shows only tabs whose gate passes for the role (R3). **≥2** accessible → tab bar; **exactly 1** →
that tab's renderer directly, no bar, still hash-normalized (AC1); **0 accessible tabs** → treat the hub as
inaccessible → redirect to dashboard (this is distinct from `canAccessPage(hub)`; a hub whose page id is
in nav but with zero accessible tabs still lands on dashboard/empty-state, not a broken bar).

### AC13 — My Orders hub tab set is role-correct
The My Orders hub shows Orders and Track Delivery **only for tabs the role's gate passes** (R3, AC12). A
client role lacking `canAccessPage('track_delivery')` is NOT shown the Tracking tab. `track_delivery` is
off-sidebar, reachable via `ACTION_PAGES`, folded via `HUB_REDIRECT`.

### AC14 — Deliveries hub addressable; access via delivTabsForRole unchanged
Deliveries tabs are addressable per R3, honor deep links + back/forward, and each role's tab set equals
`delivTabsForRole(role)` exactly as before (delivery_exec → only `list`). Consistency with AC7's authority
is asserted per R3's gate-authority rule.

### AC15 — Due Items hub-tab count badge
- **Value:** `N = |{ due item : overdue }|`, where **overdue** = the due-items dataset row is past its
  due date (the same `days_overdue > 0` / due-date-before-today predicate and field the Due Items page
  itself uses), computed from the `/nav-badges` or `/reports/consolidated-due` signal. (The old sidebar
  `!` was a presence flag with no count, so there is no legacy number to equal — this definition stands
  on its own.)
- **Render states (exact DOM):** the badge **element** is present in the tab-bar DOM synchronously at hub
  render (may start empty/hidden) and MUST NOT delay tab-body render. When the data promise the test
  awaits settles with `N > 0`, the badge shows `N` within one animation frame; **`N > 99` shows "99+"**;
  **`N === 0` → badge hidden/absent**; **data unavailable / NaN / negative → a distinct unknown state**
  (`data-badge-state="unknown"`, no number — observably different from the zero state). "Permanently
  absent is a FAIL" applies **only** to the `N > 0`-loadable case. The badge must not break the smoke
  `dataAct`/route invariants.

### AC16 — Logout clears all addressable-tab state
`doLogout` resets to a hash-free URL via `history.replaceState(null,'',location.pathname+location.search)`
for **any** current hash (assert `location.hash === ''`), fires no navigation while logged out, and clears
`localStorage.sp_page` (already done today).

## 🚨 Constraints
- No-build SPA; new handlers are top-level `function` declarations (window globals for `dataAct` + smoke).
- Page-id invariant: never delete a page id; fold into a hub tab + `ACTION_PAGES`.
- Nested header (kept as-is; out of scope). Non-functional gate: `npm run test:smoke` green + `tsc
  --noEmit` clean. Untouched navs unchanged (AC8).

## Out of scope
Backend/API changes; suppressing hub-hosted renderers' headers; a sidebar due-count affordance; a distinct
PARTIALLY_CLOSED indicator; consolidation beyond the four named items.
