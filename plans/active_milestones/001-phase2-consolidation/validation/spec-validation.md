# Spec Adversarial Review — Phase 2 Consolidation

> `spec-validator` · 3 independent skeptics, no shared scratchpad · default-to-reject · 2-of-3 majority gate

| Field | Value |
|---|---|
| Milestone | `001-phase2-consolidation` |
| Artifact | `plans/active_milestones/001-phase2-consolidation/spec.md` |
| Date | 2026-09-04 |
| Gate | 2-of-3 majority |
| Result | **14 confirmed · 4 unconfirmed** — highest severity **high** |

## Verdict

The spec is **not yet ready to plan against**. The panel unanimously found that the
verification-and-hardening framing made several acceptance criteria **circular or unfalsifiable**
(they compare the code to a restatement of itself, with no frozen baseline), and that key new/edge
behavior is **undefined**: the phase-stepper status universe, the Due-Items badge semantics, raw-hash
ACL enforcement + fallback, and the hash-echo dedupe. Two confirmed findings also point at **latent
implementation bugs** the tightened spec must force Planning to check: (a) raw hash input is not run
through the same ACL/redirect as `navigate()`, and (b) the echo-dedupe by last-written-tab can swallow
a legitimate Back to the same tab. Folding the tightenings in and re-running the gate once.

## Confirmed Findings (≥ 2 votes)

### 🔴 `phase-status-coverage` — status universe contradictory + unmapped statuses blank · 3/3
- **Clause:** "Given `phaseStepper(status)` and the 15 FSM statuses … CLOSED/DELIVERED/RECEIVED → "Delivered"; and CANCELLED/REJECTED render a distinct cancelled terminal marker"
- **Malicious reading:** "15" is stated but 18 names are enumerated; DELIVERED/RECEIVED/REJECTED are not in context.md's 15-status FSM, while real statuses that exist in `statusBadge` (IN_TRANSIT, DISPATCHED, ACCEPTED, RESOLVED, INVOICED, …) are unmapped → `orderPhaseIndex` returns −1 → blank all-todo stepper.
- **Harm:** orders in unmapped/unknown/null status show a progress bar with zero highlighted steps; the "progress reads the same everywhere" goal fails silently; the count claim is internally inconsistent.
- **Tightening:** replace "15 FSM statuses" with an explicit enumerated status universe cross-referenced to `statusBadge`; map every one to a phase or the cancelled marker; define a fallback for unmapped/null/unknown (render a defined "unknown"/anchored marker, never blank, never throw); state the exact count consistent with the enumeration.

### 🔴 `acl-parity-tautological` — parity check compares canAccessPage to its own definition · 3/3
- **Clause:** "canAccessPage(pg) … is true **iff** `pg` is `dashboard`, or in that role's `NAV`, or in `ACTION_PAGES[pg]` … `ACTION_PAGES` is read from the app itself"
- **Malicious reading:** the identity holds no matter what is in `ACTION_PAGES`; padding `ACTION_PAGES` widens access while the check stays green; dropping a nav item without the matching `ACTION_PAGES` entry silently removes access and the identity still holds (both sides drop together).
- **Harm:** the "ACL parity / never widens access" guarantee catches nothing.
- **Tightening:** add an **independent, hand-authored expected-access matrix** (role × page → allowed) as ground truth checked into the test, assert `canAccessPage` against it (not against `ACTION_PAGES`), and add explicit **negative** assertions (e.g. `delivery_exec` must NOT reach calendar/routes/today; the exact pre-consolidation reachable set per role is preserved).

### 🔴 `hash-input-acl-redirect-gap` — raw hash bypasses navigate()'s ACL + HUB_REDIRECT · 2/3 (S2 med, S3 high)
- **Clause:** "the redirect does not occur unless `canAccessPage(subpage)` is true; e.g. `delivery_exec` stays on its single Deliveries tab" (only the `navigate()`/`HUB_REDIRECT` path is covered).
- **Malicious reading:** a user typing/sharing a raw hash (`#delivery/routes`, or `#pipeline` / `#consolidated_due` for a folded id) is consumed by `onHashChange`/`initApp` boot, which the spec never requires to run `canAccessPage` or `HUB_REDIRECT` → forbidden tab reached, or the bare standalone folded page rendered.
- **Harm:** ACL bypass / data exposure via hand-edited or shared hash; the "never a bare standalone page" guarantee is violated for the most-bookmarked entry point.
- **Tightening:** require **every** hash-driven route resolution (`onHashChange`, `initApp` boot, `routeTab`) to apply the identical `canAccessPage` gate and `HUB_REDIRECT` folding as `navigate()`; a forbidden or folded raw hash is redirected/normalized, never rendered bare.

### 🔴 `hash-echo-dedupe` — dedupe by last-written-tab drops legitimate Back to same tab · 3/3 (high,high,med→high)
- **Clause:** "`onHashChange` must ignore the echo of our own write (dedupe by last-written tab) so external back/forward is the only thing that flips a tab"
- **Malicious reading:** a genuine Back/forward that lands on a hash whose tab equals the last value we wrote is indistinguishable from our own echo and is ignored; the stored key is never cleared, so toggling between two tabs and pressing Back to the earlier one is dropped.
- **Harm:** the headline "back/forward switches tabs in place" story intermittently fails for the most common case.
- **Tightening:** identify the echo by a **one-shot token/nonce** set immediately before `writeHash` and **cleared on receipt** of the matching `hashchange` (or compare-then-clear the value writeHash just set), per hub; define ordering when multiple writes precede a hashchange; add a scenario: Back returning to a previously-written tab value still flips the tab.

### 🔴 `due-badge-async-noop` — no positive requirement that the badge ever renders · 3/3 (high,high,med→high)
- **Clause:** "the badge may be populated lazily/asynchronously and must never block tab render … must degrade gracefully if the count is unavailable"
- **Malicious reading:** treat the count as permanently "unavailable" (or leave the fetch forever pending / discard its result) → badge never appears, yet every clause ("absent on zero", "never blocks", "degrades gracefully") is satisfied.
- **Harm:** the one approved enhancement ships as a no-op that never shows a count.
- **Tightening:** add a **positive, bounded** requirement — when due data is available (or within a bounded time / on the same async cycle that already loads nav-badge data), the badge MUST render the non-zero count; add a deterministic fixture with a known non-zero count that the badge must display.

### 🔴 `no-page-id-baseline` — "no id removed" has no frozen baseline; stub passes · 3/3 (high,med→high)
- **Clause:** "Given the pre-consolidation `PAGE_MAP` … every original page id still resolves to a render function … no id is deleted."
- **Malicious reading:** no snapshot of the pre-consolidation `PAGE_MAP` exists, so "every original id" has nothing to diff against; and "resolves to a function" is satisfied by a stub that renders nothing.
- **Harm:** a page id can be silently dropped or gutted to a no-op and every stated check still passes.
- **Tightening:** commit a **frozen fixture list** of every pre-consolidation page id; assert current `PAGE_MAP` ⊇ that set; require each folded id's renderer to produce real content or an intentional redirect (not an empty stub).

### 🟠 `due-badge-count-semantics` — which number, from which source · 3/3 (med,med,high→med, spread noted)
- **Clause:** "a small count badge of overdue/pending due items … should come from the same signal the sidebar `!` badge used (nav-badges / due-items data)"
- **Malicious reading:** "overdue/pending" = two different sets; "nav-badges / due-items data" = two possible sources; "should" is non-binding → count whatever is cheapest.
- **Tightening:** define the exact counted set (e.g. items with due date < now, named field + timezone) and the single authoritative source; use MUST; state it must equal the pre-consolidation sidebar signal (or state explicitly if it differs).

### 🟠 `reload-precedence` — hash vs localStorage.sp_page precedence undefined · 3/3
- **Clause:** "a full page reload re-opens the Orders hub on the Pipeline tab (not the default tab, not the dashboard)"
- **Malicious reading:** `sp_page` (localStorage) and `location.hash` can disagree on reload; no precedence rule → restore `sp_page` and land on the wrong surface.
- **Tightening:** state that on boot a present & accessible `location.hash` takes precedence over `localStorage.sp_page`; define the fallback order when the hash is absent/invalid/forbidden.

### 🟠 `verify-against-impl-circular` — acceptance criteria defined by the code they judge · 3/3
- **Clause:** "*Verified against the implementation on this branch; any failing criterion is a hardening task.*"
- **Malicious reading:** the implementation is its own oracle; criteria whose expected values are read from the code can never fail; a bug baked into the branch is canonized.
- **Tightening:** state each scenario's expected values **independently** of the branch (exact hash strings, exact tab id/label lists, exact status→phase table, frozen page-id list, hand-written ACL matrix); remove the blanket "verified against the implementation" from the acceptance contract (keep it only as a changelog note).

### 🟠 `duplicate-render-untestable` — "no duplicate render" has no measurable probe · 3/3 (med,low,med→med)
- **Clause:** "the hub returns to the Queue tab without a full page re-render or a duplicate render of the Queue body"
- **Tightening:** define a measurable assertion — a Back tab-switch MUST invoke the tab-body renderer exactly once (render-count spy / `data-render-token`) and MUST NOT re-run the hub-shell/tab-bar builder; hub container DOM identity preserved.

### 🟠 `hash-fallback-undefined` — malformed/unknown/forbidden hash has no defined landing · 2/3
- **Clause:** "When a `#page/tab` or `navigate()` redirect targets that sub-page" (nothing for `#orders/`, `#orders/bogus`, `#nope/x`, wrong case).
- **Tightening:** define normalization + fallback — unknown page → dashboard; unknown/forbidden tab on a valid hub → hub default accessible tab, then `replaceState`-normalize the hash; never leave `#main-content` empty; define case/trailing-slash handling.

### 🟠 `tab-slug-mapping` — slug↔page-id↔label↔ACL table missing for hubs · 2/3
- **Clause:** "URL: #orders/queue | #orders/pipeline | #orders/due" (slug `due` ≠ page id `consolidated_due`; My Orders / Deliveries slugs never given).
- **Tightening:** provide the complete table (hub page id, tab slug, backing page id, display label, ACL check) for Orders, My Orders, Deliveries; slugs stable and case-defined; router resolves only through the table.

### 🟠 `single-zero-tab-plain-page` — 0-tab and which-renderer cases undefined · 3/3 (low,med,med→med)
- **Clause:** "a role that can reach only one of these tabs is shown the plain page (no pointless single-tab bar)"
- **Malicious reading:** silent on zero accessible tabs (broken empty bar/crash) and on which renderer is "the plain page"; in tension with "My Orders always shows Orders · Track Delivery" even if a client role can't `canAccessPage(track_delivery)`.
- **Tightening:** specify 0 / 1 / ≥2 accessible-tab behavior (0 → hub inaccessible / dashboard; 1 → that tab's renderer, no bar; ≥2 → bar); a hub shows only tabs whose target the role `canAccessPage`; reconcile the My Orders tab-set claim with this rule.

### 🟡 `due-badge-cap-and-states` — overflow + zero-vs-unavailable indistinct · 2/3
- **Clause:** mockup "[ Due Items ⑤ ]"; "when the count is zero the badge is absent … degrade gracefully if unavailable"
- **Tightening:** cap display (exact ≤ 99, then "99+"), define NaN/negative → treated as unavailable → absent; make "unavailable" a distinct observable state from "zero" (zero → absent; unavailable → neutral placeholder / no-change, never rendered as 0).

## Unconfirmed (FYI · 1 vote)

| `id` | severity | note |
|---|---|---|
| `logout-clears-hash-not-localstorage` (S1) | 🔴→n/a | **False positive:** `doLogout` already `localStorage.removeItem('sp_page')` (app.01-core.js:460) and clears the whole hash via `replaceState(location.pathname+search)`. No leak. Will note in spec. |
| `logout-hash-clear-scope-and-value` (S3) | 🟠 | Spec wording implies only the orders hash; implementation already clears **any** hash. Tighten wording to "any hash" for clarity. |
| `stepper-negative-unbounded` (S3) | 🟠 | "No bespoke bar remains" is an unbounded negative — cheap to pin by enumerating order-progress surfaces + a grep target for old `ORDER_STEPS`. Will fold as a minor tightening. |
| `roles-set-underspecified` (S3) | 🟡 | Enumerate the 12 role ids and which are "delivery roles"; assert `Object.keys(ROLES).length === 12`. Will fold. |
| `partially-closed-phase-questionable` (S1) | 🟡 | Product question: PARTIALLY_CLOSED mapped to "Shipment" under-reports partial delivery. Surface to user; keep current mapping unless user wants a partial indicator. |

## Attacks That Failed (corroborate the spec holds here)
- Logout firing a navigation while logged out — mechanism pinned (`replaceState`, no nav).
- Nested/stacked header — explicitly decided out of scope; a documented trade-off, not a hole.
- "Roles untouched" (procurement/warehouse/finance/vendor/vendor_user) — concrete enumerated invariant.
- Quick-action leak after nav removal — `quickActionItems` self-filters to nav ids + smoke asserts no off-nav quick action.
- CANCELLED/REJECTED terminal marker — explicitly required and matches code (`ostep--cancelled`).

## Actions Taken
- [x] Persisted this verdict.
- [ ] Fold all 14 confirmed tightenings + the 3 actionable unconfirmed (logout wording, bespoke-bar enumeration, roles enumeration) into `spec.md`.
- [ ] Surface `partially-closed-phase-questionable` to the user (product decision).
- [ ] Re-run the spec panel once on the revision → `spec-validation-r2.md`.
