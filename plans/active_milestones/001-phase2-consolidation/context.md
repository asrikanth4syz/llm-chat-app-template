# Context Report: phase2-consolidation

> Milestone: **Phase 2 — Consolidation** (merge Orders surfaces, merge Deliveries hub,
> phase-based status stepper, addressable tabs) for the SmartPantry vanilla-JS SPA.
> **Brownfield:** a first implementation already exists on branch
> `claude/phase-2-consolidation-34ggxj`. This report maps the pre-existing architecture,
> the delta the current branch already shipped, and the remaining gaps/risks.

## Affected Domain

SmartPantry is a no-build vanilla-JS SPA served by a single Cloudflare Worker
(`docs/WORKFLOW.md:12-38`). All UI lives in `public/app.NN-*.js` files loaded as classic
scripts in a fixed order declared in `public/index.html:1226-1239`; there is **no bundler**
and **no framework** (`docs/WORKFLOW.md:16-19`). Global state is a single `APP` object
(`public/app.01-core.js:6`).

The request touches the **navigation + page-render layer**:
- Router / nav model: `navigate()`, `PAGE_MAP`, `NAV`, `ROLES`, `ACTION_PAGES`,
  `canAccessPage()` — all in `public/app.01-core.js`.
- Order surfaces: `renderOrderQueue`, `renderMyOrders`, `renderTrackDelivery`
  (`public/app.04-orders-delivery.js`); `renderPipeline`/`renderNextActions`
  (`public/app.14-pipeline.js`); `renderConsolidatedDue`/`renderConsolidatedOrders`
  (`public/app.12-fulfilment-staff.js`).
- Delivery surfaces: `renderDeliveriesHub` + the `DELIV_TABS` sub-renderers
  (`public/app.07-warehouse-delivery.js:1688-1744`).

## Existing Patterns (conventions any change must follow)

- **Page dispatch by id.** `navigate(page)` looks up `PAGE_MAP[page]` (a *string* fn name,
  resolved lazily via `window[...]` so later split-files can register) and calls it into
  `#main-content` (`public/app.01-core.js:1042-1049`, map at `978-1024`). The current page is
  persisted to `localStorage.sp_page` for reload (`:1033`).
- **Role-scoped sidebar.** `NAV[navProfile]` is an ordered list of `{section}` / `{id,label,icon,badge}`
  entries (`public/app.01-core.js:161-315`); `ROLES[role].nav` maps each of the 12 roles to one of
  the nav profiles (`:? ROLES` block). `buildNav()` renders it as an accordion.
- **ACL is derived from nav.** `canAccessPage(page)` = `true` iff the page is `dashboard`, OR in the
  role's `NAV`, OR listed in `ACTION_PAGES[page]` for that role (`public/app.01-core.js:719-739`).
  `ACTION_PAGES` is the sanctioned "off-nav but reachable" allowlist.
- **Event delegation via `dataAct`.** Buttons carry `${dataAct('fnName', arg)}`; clicks are delegated
  to a global `window.fnName`. **Every** such target must be a real global function (enforced by the
  smoke test — see below). Top-level `function foo(){}` declarations become window globals in these
  classic scripts.
- **Hub pattern (established in the earlier "Phase 3" delivery redesign).** A "hub" page renders a
  role-filtered tab bar + a body element, and each tab's body is produced by an *existing* page
  renderer called with the body element. Canonical example: `renderDeliveriesHub`
  (`public/app.07-warehouse-delivery.js:1703-1718`) with `DELIV_TABS`
  (`:1688-1693`), `delivTabsForRole()` (`:1697-1701`), `delivHubTab()` (`:1729-1743`), CSS via
  `injectDelivHubCss()` (`:1675-1686`). Off-nav sub-pages stay reachable via `ACTION_PAGES`
  (`public/app.01-core.js:733-739`).
- **Order FSM statuses.** The lifecycle statuses (DRAFT, PENDING_PRICING, SUBMITTED,
  PENDING_APPROVAL, APPROVED, ACKNOWLEDGED, INVENTORY_CHECK, VENDOR_PO_RAISED, READY_TO_PICK,
  PICKED, QUALITY_CHECK, IN_SHIPMENT, PARTIALLY_CLOSED, CLOSED, CANCELLED) are used across
  `statusBadge()` (`public/app.01-core.js:1159`) and the pre-existing client 5-step model
  (`ORDER_STEPS` formerly in `renderMyOrders`).

## Dependencies & Integration Points

- **`navigate()` is called widely** with a page id (sidebar items, dashboard tiles, quick actions,
  post-action redirects, e.g. `oqGoto`/`openPendingApprovals` in `public/app.04-orders-delivery.js`).
  Any consolidation that removes sidebar items must keep those call sites working.
- **`updateNavBadges()` / `applyNavBadges()`** write live counts onto `#nav-<id>` elements
  (`public/app.01-core.js:912-940`); they are null-safe when an id is absent, so removing a nav item
  does not break badges.
- **Quick actions** (`quickActionItems()`, `public/app.01-core.js:609-633`) self-filter to the role's
  nav ids — so an action pointing at a now-off-nav page silently drops (not a leak, but a UX loss).
- **`refreshDeliveryView(fnName)`** re-renders a delivery view into `#dhub-body` or `#main-content`
  (`public/app.07-warehouse-delivery.js:1724-1727`) — depends on the delivery hub body id.
- **Backend:** none of the four items requires an API change; all are frontend nav/render only.

## Existing Tests

- **`test/smoke.mjs`** is the frontend safety net (Playwright + stubbed DOM/fetch, no server/D1). It
  loads every `public/app.NN-*.js` in `index.html` order and asserts (`test/smoke.mjs:95-166`):
  1. each script parses/runs with zero errors;
  2. core globals exist (`APP`, `navigate`, `openModal`, …);
  3. **every `PAGE_MAP` route resolves to a function** (`:113-119`);
  4. **every `dataAct(...)` target resolves to a global function** (`:82-93,131-133`);
  5. **ACL:** for every role, `canAccessPage(pg)` is `true` iff `pg` ∈ role nav ∪ `ACTION_PAGES[pg]`,
     and no role has an off-nav quick action (`:135-164`). `ACTION_PAGES` is read from the app itself,
     so the allowlist can't drift.
  Run: `npm run test:smoke`. **This is the hard gate for any nav/ACL change.**
- **`test/index.test.ts`** — backend API integration tests (Workers pool + throwaway D1); includes an
  "Order lifecycle & pipeline board" block (`test/index.test.ts:1356-1357`). Not affected by frontend
  consolidation, but must still pass.
- **`tsc --noEmit`** covers `src/*.ts` only; the `public/*.js` files are not type-checked. Coverage gap:
  no unit tests exercise the hash router or hub tab-switching logic beyond smoke's load/resolve checks.

## Current branch state (the brownfield delta vs `origin/main`)

`git diff origin/main...HEAD` touches `public/app.01-core.js` (+178), `app.04-orders-delivery.js`
(+171/-44-ish), `app.07-warehouse-delivery.js` (+8), `CHANGELOG.md` (+8), plus the `.claude/skills/`
install. **All four Phase-2 items already have a first implementation:**

1. **Addressable tabs (hash routing) — DONE.** New core helpers: `parseHash`
   (`public/app.01-core.js:1103`), `writeHash` (`:1112`), `routeTab` (`:1119`), `registerHub`
   (`:1101`), `onHashChange` (`:1125`), plus `APP_HUBS`/`_hubTabWritten` maps. `navigate(page, opts)`
   now takes `{tab, fromHash}` and writes the hash; `initApp` honors `location.hash` on boot and adds
   the `hashchange` listener; `doLogout` clears the hash. Self-write echo is de-duped via
   `_hubTabWritten` (chosen over a timeout lock to avoid the hashchange race).
2. **Phase-based status stepper — DONE.** `ORDER_PHASES` (5 phases: Placed → Approved → Fulfilment →
   Shipment → Delivered), `orderPhaseIndex`, `orderPhaseKey`, `phaseStepper(status,opts)` +
   `injectStepperCss` (`public/app.01-core.js:~1160-1210`). Reused in the client order cards
   (`renderMyOrders`, replacing the old bespoke 5-stage bar) and as the Order Queue filter.
3. **Merge Orders surfaces — DONE.** `orders` page is now a hub (`renderOrdersHub`,
   `public/app.04-orders-delivery.js:34`) with tabs Queue · Pipeline · Due Items (`ORDERS_TABS`),
   `ordersHubTab` (`:52`). `pipeline` + `consolidated_due` removed from platform/ops `NAV` and added
   to `ACTION_PAGES` (`public/app.01-core.js:~730-741`); `HUB_REDIRECT` folds their deep links into
   the hub. Order Queue's flat 14-status strip replaced by a phase-stepper filter
   (`oqTabsHtml`/`oqTableHtml`/`switchOQTab`, exact-status deep links like `oqGoto` still work).
4. **Merge Deliveries hub — DONE (addressable).** The pre-existing hub now honors `#delivery/<tab>`:
   `renderDeliveriesHub` uses `routeTab` + `writeHash` + `registerHub`
   (`public/app.07-warehouse-delivery.js:1703-1718`); `delivHubTab` emits the hash (`:1734`).
5. **Client surfaces — DONE.** `my_orders` is now `renderMyOrdersHub`
   (`public/app.04-orders-delivery.js:79`) with tabs Orders · Tracking (`MYORDERS_TABS`),
   `myOrdersHubTab` (`:96`); `track_delivery` removed from the three client navs, added to
   `ACTION_PAGES`, folded via `HUB_REDIRECT`.

**Validation status of the branch:** `npm run test:smoke` green (all 45 routes + 326 dataAct targets
resolve, ACL correct) and `tsc --noEmit` clean, per the last commit (`cf86ad9`) and `CHANGELOG.md`.

## Constraints & Risks

**Hard constraints**
- **No-build SPA.** No JSX/TS in `public/`; only ES that runs directly in the browser as a classic
  script. New handlers must be top-level `function` declarations (so they become `window` globals for
  `dataAct` + smoke).
- **Page-id invariant.** The codebase repeatedly states "every page id is unchanged, so ACL, quick
  actions and the smoke test are unaffected" (`public/app.01-core.js:163-166`). Consolidation must
  **keep page ids working** (fold into hubs / `ACTION_PAGES`), not delete them.
- **Smoke ACL identity.** `canAccessPage` must remain exactly `nav ∪ ACTION_PAGES` per role. Removing a
  nav item **requires** a matching `ACTION_PAGES` entry for every role that had it, or smoke fails.
- **Script load order** (`public/index.html:1226-1239`) — cross-file calls only resolve because core
  loads first and dispatch is lazy (`window[...]`).

**Risks / likely failure modes**
- **Hash-router race:** a `writeHash` fires a `hashchange`; the current fix de-dupes by comparing
  `_hubTabWritten[page]` to the incoming tab. Regression risk if a new hub forgets to `writeHash` on
  both render and switch (external back/forward would then double-render). Every hub must call
  `registerHub` + `writeHash` consistently.
- **Role-gated hub tabs must not widen access.** `HUB_REDIRECT` in `navigate` only redirects when
  `canAccessPage(subpage)` is also true (`public/app.01-core.js` navigate head) — this guard is what
  keeps e.g. `delivery_exec` on its single tab. Any new redirect must preserve that.
- **Nested headers:** hub tab bodies call full page renderers that bring their own `pageHeader(...)`
  (e.g. `renderPipeline`, `renderConsolidatedDue`) — cosmetic double-heading, consistent with the
  delivery hub; acceptable but worth a spec decision if a cleaner look is wanted.
- **Lost sidebar badges:** `consolidated_due` had a `!` badge in the sidebar; folding it into a hub tab
  removes that at-a-glance count (now only visible inside the tab). Possible UX regression to address.
- **Regression surface:** roles touched = super_admin, ops_admin (Orders hub), the delivery roles
  (Deliveries hub), and client_admin/client_approver/client_user (My Orders hub). Vendor / procurement
  / warehouse / finance navs are untouched.

## Key Files

| Path | Why it matters |
|---|---|
| `public/app.01-core.js` | Router, `PAGE_MAP`, `NAV`, `ROLES`, `ACTION_PAGES`, `canAccessPage`, hash router, `phaseStepper`/`ORDER_PHASES`, `HUB_REDIRECT`, `injectHubCss` |
| `public/app.04-orders-delivery.js` | `renderOrdersHub`/`ordersHubTab`/`ORDERS_TABS`; `renderOrderQueue` phase filter; `renderMyOrdersHub`/`myOrdersHubTab`/`MYORDERS_TABS`; `renderMyOrders`; `renderTrackDelivery` |
| `public/app.07-warehouse-delivery.js` | `renderDeliveriesHub`, `DELIV_TABS`, `delivHubTab`, `delivTabsForRole`, `refreshDeliveryView`, `injectDelivHubCss` |
| `public/app.12-fulfilment-staff.js` | `renderConsolidatedDue` (Due Items tab body), `renderConsolidatedOrders` |
| `public/app.14-pipeline.js` | `renderPipeline` (Pipeline tab body), `renderNextActions` |
| `public/index.html` | Script load order (1226-1239) — smoke reads it |
| `test/smoke.mjs` | The frontend invariant gate (routes/dataAct/ACL) — must stay green |
| `docs/WORKFLOW.md` | Architecture of record |
| `CHANGELOG.md` | Session/Phase change log (Phase 2 entry already added) |

## Bottom line for Discovery

All four Phase-2 items are **already implemented and validated** on this branch. The spec should treat
this as a **brownfield verification-and-hardening** milestone, not greenfield: decide whether "Phase 2"
is *done as specified*, and enumerate any acceptance criteria the current implementation must be
checked against (addressability of every hub tab incl. back/forward + reload; ACL parity per role;
smoke + tsc green; no regressed deep links; stepper correctness across all 15 statuses incl. CANCELLED;
lost-badge / nested-header UX decisions). If the spec gate finds the implementation already satisfies
the criteria, the milestone may reduce to a small hardening/decision set rather than a large build.
