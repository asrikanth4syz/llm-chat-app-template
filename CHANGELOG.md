# Smart Pantry — Feature & Change Log

**Platform:** Cloudflare Workers + D1 SQLite  
**Branch:** `claude/ecstatic-gauss-l6ch3z`  
**Last updated:** June 2026

---

## Recent Session Changes

### 1. Client Portal — Account Auto-Linking
**Problem:** Client users saw a dropdown to select any client when placing an order; there was no server-side enforcement of which client an order belonged to.

**Changes:**
- **Migration `0008_user_client_link.sql`** — adds `client_id` column to `users` table and auto-populates it by matching `users.org` to `clients.name`.
- **`src/types.ts`** — added `client_id?: string` to `JWTPayload` interface.
- **`src/index.ts` → `issueToken()`** — `client_id` is now included in the JWT when present.
- **`src/index.ts` → `handleCreateOrder()`** — backend overrides `body.client_id` with the value from the JWT for client roles; returns a 400 error if the account is not linked.
- **`public/app.js` → `submitOrder()` / `confirmOrder()`** — client roles see a read-only company name display instead of a dropdown; `client_id` is sourced from `APP.user.client_id`.

---

### 2. PARTIALLY_CLOSED Order Workflow
**Problem:** After a partial delivery, there was no UI to dispatch the remaining items or freeze the order. Follow-up DCs also could not be dispatched because the backend only allowed dispatch from `READY_TO_PICK` status.

**Changes:**
- **`src/index.ts` → `ORDER_FSM`** — added `CANCELLED` as a valid transition from `PARTIALLY_CLOSED`.
- **`src/index.ts` → `handleDispatchDC()`** — updated SQL to allow dispatch when order is in `READY_TO_PICK` **or** `PARTIALLY_CLOSED`.
- **`public/app.js` → `orderQueueActions()`** — added action buttons for `PARTIALLY_CLOSED` orders:
  - **Dispatch Remaining** — fetches SCHEDULED DCs and goes directly to dispatch modal.
  - **Pre-Close** — confirmation modal that transitions the order to `CLOSED` with an audit note.
- **`public/app.js`** — added `dispatchRemainingModal()`, `preCloseOrder()`, `confirmPreClose()` functions.
- **`public/app.js` → `viewOrder()` modal footer** — shows Dispatch Remaining + Pre-Close buttons when order is `PARTIALLY_CLOSED`.
- **`public/app.js` → `STATUS_TABS`** — added `PARTIALLY_CLOSED` to order queue tab list (was invisible before).

---

### 3. Order vs Delivery (OVD) Report — Delivered Quantity Fix
**Problem:** Orders delivered via the old code path had `qty_delivered = 0` in `dc_items`, causing "Delivered: 0" in the OVD report.

**Changes:**
- **`src/index.ts` → `handleRptOrderVsDelivery()` and `handleRptDueItems()`** — all `SUM(dci.qty_delivered)` queries replaced with:
  ```sql
  SUM(CASE WHEN dc.status='DELIVERED' AND dci.qty_delivered=0
      THEN dci.qty_ordered ELSE dci.qty_delivered END)
  ```
- **OVD `order_status` CASE** — now checks `o.status IN ('CLOSED','PARTIALLY_CLOSED')` for "Complete" classification.

---

### 4. Page Redesigns — Ops/Admin Views

#### Warehouse Overview (`renderWHOverview`)
- 5-tile KPI row with utilisation bars.
- 2-column warehouse card layout.

#### DC Billing / Finance (`financeTabContent`)
- 4-tile KPI row with ₹ values.
- Oldest-first sort; red row highlight for overdue.

#### Reports & BI (`renderReports`)
- `REPORT_CATEGORIES` constant groups reports into colour-coded sections.
- Categorised card grid replaces flat list.

#### Today's Delivery Schedule (`renderTodaysSchedule`)
- 5-tile KPI row, progress bar, per-staff mini delivery bars, empty state.

#### Platform Settings (`renderSettings`)
- Sidebar navigation with `SETTINGS_NAV` constant.
- `APP._settingsTab` persists active tab across re-renders.

---

### 5. Client Dashboard Redesign (`renderClientDashboard`)

**Replaces** the previous flat card layout with:

- **Welcome header** — user first name + organisation + current date.
- **5-tile KPI row** with coloured top borders:
  | Tile | Colour | Action |
  |------|--------|--------|
  | Active Orders | Blue | → My Orders |
  | In Transit DCs | Amber (if >0) | Scrolls to Track Delivery |
  | Approvals | Amber (if >0) | → Approvals |
  | Budget Used % | Dynamic (green/amber/red) | — |
  | Delivered this month | Green | — |
- **Monthly Budget bar** — progress bar with health score indicator.
- **Track Delivery** (full width, 3-column pipeline — see section 6).
- **Recent Orders panel** — clickable rows with hover highlight and chevron.
- **Async KPIs** — Due Items count + Fulfilment Rate loaded after page paint.

---

### 6. Track Delivery — 3-Column Pipeline Layout

**Replaces** the old single-column list in a half-width card.

**New layout (full width):**

```
┌─────────────────────────────────────────────────────────────┐
│  Track Delivery          2 in transit · 1 scheduled · 5 del │
├──────────────────┬──────────────────┬───────────────────────┤
│  🔵 SCHEDULED  1 │  🟡 IN TRANSIT  2 │  🟢 DELIVERED      5  │
├──────────────────┼──────────────────┼───────────────────────┤
│  [DC card]       │  [DC card]       │  [DC card]            │
│  Order ref       │  Order ref       │  Order ref            │
│  Qty · Date      │  Driver · Vehicle│  Date delivered       │
│                  │  ETA             │  Units                │
│                  │  📞 Call Driver  │                       │
└──────────────────┴──────────────────┴───────────────────────┘
```

- Each stage has a colour-coded pill showing count.
- In-transit cards show driver name, vehicle number, ETA, and a "Call Driver" `tel:` link when a phone number is present.
- Delivered column shows up to 4 cards with an overflow count ("+N more this month").

---

### 7. Place Order Page Redesign (`renderPlaceOrder`)

**Replaces** the tab-based layout (Catalogue / Excel Upload / Quick Reorder / Standing Orders).

**New layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  Place Order              [Import CSV]  [My Orders]         │
├─────────────────────────────────────────────────────────────┤
│  🔄 Quick Reorder  ·  [Order A] [Reorder]  [Order B] [Re…] │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search items by name or SKU…                            │
│  [All] [Groceries] [Beverages] [Snacks] …                   │
├───────────────────────────────────┬─────────────────────────┤
│  Catalogue Grid (live filtered)   │  Cart Panel (sticky)    │
│  12 items found                   │  • Item A  ×2  ₹400     │
│  [card] [card] [card]             │  • Item B  ×1  ₹150     │
│  [card] [card] [card]             │  ──────────────────────  │
│                                   │  Subtotal  ₹550         │
│                                   │  GST 18%   ₹99          │
│                                   │  Total     ₹649         │
│                                   │  [Place Order]          │
│                                   │  [Clear Cart]           │
└───────────────────────────────────┴─────────────────────────┘
```

**Key improvements:**
- **Search bar** — live filters catalogue by name, SKU, or category.
- **Quick Reorder strip** — last 3 orders shown inline; one-click Reorder adds all items to cart.
- **Category pills + search** — both filters compose (category AND search term).
- **CSV Import modal** — moved from a tab to an overlay modal; accessible via "Import CSV" button.
- **Clear Cart button** added to cart panel.
- **Results count** shown below search ("12 items found").

---

## Deployment

All changes are on branch `claude/ecstatic-gauss-l6ch3z`.

```bash
git pull origin claude/ecstatic-gauss-l6ch3z
npx wrangler deploy
```

**Migration required** (run once after deploy):
- `0008_user_client_link.sql` — links client users to their client account.

After deploying, existing client users must **log out and back in** to get an updated JWT containing `client_id`.
