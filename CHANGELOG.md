# Smart Pantry — Platform Feature Reference

**Product:** Smart Pantry by 4SYZ — Enterprise B2B Procurement & Pantry Management Platform  
**Stack:** Cloudflare Workers + D1 SQLite · Vanilla JS SPA · Wrangler deploy  
**Branch:** `claude/ecstatic-gauss-l6ch3z`  
**Deployment:** `https://smart-pantry.asrikanth.workers.dev`  
**Last updated:** June 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Roles & Access Control](#2-roles--access-control)
3. [Database Schema & Migrations](#3-database-schema--migrations)
4. [Navigation & Sidebar](#4-navigation--sidebar)
5. [Authentication](#5-authentication)
6. [Client Portal](#6-client-portal)
7. [Operations & Order Management](#7-operations--order-management)
8. [Fulfilment & Delivery](#8-fulfilment--delivery)
9. [Procurement & Vendors](#9-procurement--vendors)
10. [Inventory & Warehouse](#10-inventory--warehouse)
11. [Reporting & Analytics](#11-reporting--analytics)
12. [Finance & DC Billing](#12-finance--dc-billing)
13. [Admin & Platform Tools](#13-admin--platform-tools)
14. [UI/UX Standards](#14-uiux-standards)
15. [Deployment & Migrations](#15-deployment--migrations)
16. [Session Change Log](#16-session-change-log)

---

## 1. Platform Overview

Smart Pantry is a multi-tenant enterprise B2B pantry procurement platform with a full order lifecycle from client order placement through warehouse pick-pack and last-mile delivery, plus vendor management, finance, and analytics.

**Architecture:**
- **Backend:** Single Cloudflare Workers file (`src/index.ts`) with REST API routing
- **Database:** Cloudflare D1 (SQLite) with 11 migration files
- **Frontend:** Single-page application (`public/app.js` + `public/app.css`) — no frameworks
- **Auth:** JWT-based with role in payload; OTP two-factor optional

**Scale targets:** Multi-tenant (multiple corporate clients), 12 distinct roles, 3 org types, 50+ pages/features.

---

## 2. Roles & Access Control

| Role | Label | Org | Nav Profile |
|------|-------|-----|-------------|
| `super_admin` | Super Admin | 4SYZ Platform | Full platform |
| `ops_admin` | Operations Admin | 4SYZ Platform | Operations-focused |
| `procurement_manager` | Procurement Manager | 4SYZ Platform | Procurement + vendors |
| `warehouse_exec` | Warehouse Executive | 4SYZ Platform | Warehouse + inventory |
| `delivery_manager` | Delivery Manager | 4SYZ Platform | Deliveries + DC billing |
| `delivery_exec` | Delivery Executive | 4SYZ Platform | My deliveries only |
| `finance_admin` | Finance Admin | 4SYZ Platform | DC billing + reports |
| `client_admin` | Client Admin | Corporate Client | Full client portal |
| `client_approver` | Client Approver | Corporate Client | Approvals + all orders |
| `client_user` | Client User | Corporate Client | Order + track only |
| `vendor_admin` | Vendor Admin | Supplier/Vendor | Full vendor portal |
| `vendor_user` | Vendor User | Supplier/Vendor | PO view only |

**RBAC enforcement:**
- `client_id` embedded in JWT at login; client roles can only order for their own linked client (backend enforced)
- Backend `requireUser()` guard on all mutating endpoints
- Role-specific sidebar nav profiles (`NAV` constant in `app.js`)

---

## 3. Database Schema & Migrations

| Migration | Purpose |
|-----------|---------|
| `0001_schema.sql` | Core tables: `orders`, `order_items`, `clients`, `vendors`, `inventory`, `delivery_challans`, `users`, `approval_rules`, `order_history`, `service_tickets` |
| `0002_features.sql` | Inventory enhancements, pick list support |
| `0003_features.sql` | RFQ, quote responses, invoice records |
| `0004_delivery_rebuild.sql` | `dc_items` (per-SKU DC tracking) + `stock_movements` audit log; backfills from `order_items` |
| `0005_fulfilment.sql` | Fulfilment tracking tables |
| `0006_spec_alignment.sql` | `dc_number`, `staff_id`, `scheduled_time` on `delivery_challans`; `sub_category` on `inventory` |
| `0007_pick_allocation.sql` | Pick allocation and warehouse assignment columns |
| `0008_user_client_link.sql` | `client_id` on `users` table; auto-populated by matching `users.org` → `clients.name` |
| `0009_inventory_fields.sql` | Additional inventory metadata fields |
| `0010_inventory_subcategory.sql` | Sub-category support for catalogue filtering |
| `0011_order_type.sql` | `order_type TEXT NOT NULL DEFAULT 'Regular'` on `orders` table |

**Key table relationships:**
```
clients ──< orders ──< order_items
                 └──< delivery_challans ──< dc_items
vendors ──< purchase_orders ──< po_items
users ──> clients (via client_id FK)
```

---

## 4. Navigation & Sidebar

### Platform (Super Admin) — 7 sections, 24 items

| Section | Items |
|---------|-------|
| Overview | Dashboard, Orders |
| Catalogue | Inventory, Vendors |
| Operations | Procurement, Warehouse, Deliveries, DC Billing, Fulfilment |
| Client Services | Clients, Service Desk, Approval Chains |
| Analytics | Reports & BI, SLA Dashboard |
| Tools | Route Planning, Dunning, CSV Import, Templates |
| Admin | Today's Schedule, Procurement View, Due Items, Staff, Porter Expenses, Users & Roles, Settings |

### Role-specific nav profiles

| Profile | Key Pages |
|---------|-----------|
| `ops` | Control Tower, Orders, Today's Schedule, Due Items, Deliveries, DC Billing, Fulfilment, Service Desk |
| `procurement` | Dashboard, Purchase Orders, Vendors, Inventory |
| `warehouse` | Dashboard, Warehouse, Inventory |
| `delivery` | Dashboard, Today's Schedule, Deliveries, DC Billing |
| `delivery_exec` | Dashboard, My Deliveries |
| `finance` | Dashboard, DC Billing, Reports & BI |
| `client` | Dashboard, Place Order, My Orders, Track Delivery, Approvals, Budget & Spend, Service Desk |
| `approver` | Dashboard, Pending Approvals, All Orders |
| `client_user` | Dashboard, Place Order, My Orders, Track Delivery |
| `vendor` | Dashboard, Purchase Orders, Invoices |
| `vendor_user` | Dashboard, Purchase Orders |

### Sidebar behaviour
- **Expanded:** 220px — section labels visible, item labels and badges visible
- **Collapsed:** 64px — icons only, section labels hidden (1px divider line), `title` tooltip on hover, active item shows `inset box-shadow` left indicator
- **Mobile (≤1024px):** Collapses by default; hamburger toggles open/close

---

## 5. Authentication

- **Demo mode:** Role selector on login screen; JWT issued without real credentials
- **OTP:** Optional 6-digit OTP field (UI built; backend stub)
- **JWT payload:** `{ sub, name, email, role, org, client_id, iat, exp }`
- **Token storage:** `localStorage` as `sp_token`
- `client_id` in JWT is the single source of truth for client-role order ownership; backend overwrites any `client_id` sent from the frontend for client roles

---

## 6. Client Portal

### 6.1 Client Dashboard (`renderClientDashboard`)
- **Welcome header** — first name + organisation + today's date
- **5 KPI tiles** (colour-coded, clickable):
  - Active Orders → My Orders
  - In Transit DCs (amber if >0) → Track Delivery section
  - Pending Approvals (amber if >0) → Approvals
  - Budget Used % (green/amber/red dynamic)
  - Delivered This Month
- **Monthly Budget bar** — progress bar with health score
- **Track Delivery pipeline** — full-width 3-column (Scheduled / In Transit / Delivered)
- **Recent Orders panel** — clickable rows, hover highlight, chevron
- **Async post-render KPIs** — Due Items count + Fulfilment Rate loaded after paint

### 6.2 Place Order (`renderPlaceOrder`)
- **Quick Reorder strip** — last 3 orders shown; one-click adds all items to cart
- **Catalogue** — searchable (name/SKU), filterable by category pills; tile and list view toggle
- **Cart panel** (sticky) — quantity controls, subtotal/GST/total, budget bar
- **Order Type selector** — always-visible toggle buttons: Regular (blue) / Urgent (red) / Ad-Hoc (amber)
- **Approval hint** — appears when order total exceeds ₹1L threshold
- **CSV import modal** — upload CSV or download template
- **Order confirmation modal** — ops/admin roles pick client from dropdown; client roles see read-only company name
- **Auto-approval rules** — backend checks `approval_rules` table; sets status to `APPROVED`, `SUBMITTED`, or `PENDING_APPROVAL`

### 6.3 My Orders (`renderMyOrders`)
- **Client role (card view):**
  - 5 KPI tiles: Active, In Transit, Partial, Delivered, Total Spend
  - Status + type filter pills; search input
  - Order cards with coloured top bar, emoji status icon, item preview chips, progress bar, action buttons
  - Order Type badge shown on cards (Urgent/Ad-Hoc only; Regular omitted for clean UI)
- **Ops/admin (table view):**
  - Columns: Order ID, Client, Amount, Status, Type, Date, Actions
  - Cancel button for DRAFT/SUBMITTED orders

### 6.4 Track Delivery (`renderTrackDelivery`)
- 3-column pipeline: Scheduled / In Transit / Delivered
- In-transit cards: driver name, vehicle no, ETA, `tel:` call link
- Delivered column: up to 4 cards + overflow count

### 6.5 Approvals
- Pending approval queue with one-click Approve / Reject
- Comment/reason field on rejection

### 6.6 Budget & Spend (`renderClientBudget`)
- Monthly spend vs. budget bar chart (Chart.js)
- Spend breakdown by category

---

## 7. Operations & Order Management

### 7.1 Order Queue (`renderOrderQueue`)

**KPI tiles (row 1 — status-based):**
| Tile | Colour | Action |
|------|--------|--------|
| Active Orders | Blue | All orders |
| Needs Attention | Amber (if >0) | PENDING_APPROVAL filter |
| In Shipment | Purple | IN_SHIPMENT filter |
| To Pick | Green | ACKNOWLEDGED filter |

**KPI tiles (row 2 — Order Type breakdown):**
| Tile | Colour | Action |
|------|--------|--------|
| Regular (📋) | Blue | Filter table to Regular only |
| Urgent (🚨) | Red | Filter table to Urgent only |
| Ad-Hoc (⚡) | Amber | Filter table to Ad-Hoc only |

- Clicking a type tile filters the order table; click again to clear (active tile shows coloured ring + "✕ clear" label)
- Month picker filters all KPIs and table simultaneously

**Order table columns:** Order ID, Client, Amount, Status, Type, Items, Total Qty, Created, Actions

**Status tabs:** All, SUBMITTED, PENDING_APPROVAL, APPROVED, ACKNOWLEDGED, PICKED, INVENTORY_CHECK, READY_TO_PICK, IN_SHIPMENT, PARTIALLY_CLOSED

**Order actions (by status):**
- SUBMITTED/APPROVED → Acknowledge, Cancel
- ACKNOWLEDGED → Pick List, Mark Picked, Inventory Check
- PICKED → Dispatch (creates DC)
- IN_SHIPMENT → Mark Delivered
- PARTIALLY_CLOSED → Dispatch Remaining, Pre-Close
- All → View Details

**Line Items tab:**
- Demand aggregated by SKU across all orders in selected month
- Grouped by brand or category; shows stock on hand vs. ordered quantity
- Stock health badges: OK (green), Short (amber), Out of Stock (red)

### 7.2 Order Detail Modal (`viewOrder`)
- Info row: Status badge, Order Type badge, Client, Date
- Items table with pick allocation qty
- Grand Total
- Timeline / order history
- DC breakdown (if dispatched)
- Comments thread (post inline)
- Footer actions: Cancel (SUBMITTED/APPROVED), Dispatch Remaining + Pre-Close (PARTIALLY_CLOSED)

### 7.3 Order Type
- Values: `Regular`, `Urgent`, `Ad-Hoc`
- Set at order placement via toggle buttons in cart panel
- Stored in `orders.order_type` (migration 0011)
- Backend validates against allowed values; defaults to `Regular`
- Colour coding throughout: Regular=blue, Urgent=red, Ad-Hoc=amber
- Urgent orders highlight row amber in Order Queue

### 7.4 Order FSM (Finite State Machine)

```
DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED → ACKNOWLEDGED
                                    ↗               ↓
                              (auto-approve)      INVENTORY_CHECK
                                                   ↓
                                              READY_TO_PICK → PICKED → IN_SHIPMENT
                                                                              ↓
                                                                    CLOSED  or  PARTIALLY_CLOSED
                                                                                      ↓
                                                                              (Dispatch Remaining)
                                                                                      ↓
                                                                                 CLOSED / CANCELLED
```

---

## 8. Fulfilment & Delivery

### 8.1 Fulfilment Dashboard (`renderFulfilment`)
Tabs: **Overview · Order vs Delivery · DC per Order · SLA Tracker**

#### Overview tab
- In-progress DCs with status pipeline
- Delivered-this-month section

#### Order vs Delivery (OVD) tab
- **Filter bar:** Client selector, date range (30/60/90 days), "Due only" toggle
- **5 KPI tiles:** Total Orders, Total Ordered Qty, Total Delivered Qty, Due Qty, Due Value
- **Order summary table** — one row per order with coloured left border (green=complete, amber=partial, red=nothing delivered):
  - Columns: Order ID, Client, Location, Date, DC Count, Last Delivery, Ordered Qty, Delivered Qty, Due Qty, Due Value, Status
  - Clicking a row opens full item drilldown modal
- **Item drilldown modal** — per-SKU breakdown with ordered/delivered/due quantities and value

#### DC per Order tab
- Columns: Order ID, Client, Ordered Date, Ordered Qty (+ progress bar), DC Count, Completion Date, Status, Actions
- **DC Count badge** — clickable, opens drilldown modal:
  - 4 summary tiles: Total DCs, Delivered, In Transit, Cancelled
  - Per-DC table: DC Number, Dispatch Date, Delivery Date, Status, Lines, Qty Dispatched, Qty Delivered %, Driver/Vehicle
- Completion Date = date of final DC delivered (from subquery)
- DC count excludes CANCELLED challans

### 8.2 Delivery Challans (DC)
- Fields: `id`, `dc_number`, `order_id`, `status`, `driver_name`, `vehicle_no`, `staff_id`, `dispatched_at`, `delivered_at`, `scheduled_time`, `total_qty`, `delivered_qty`
- Child table `dc_items`: per-SKU `qty_ordered`, `qty_delivered`
- Statuses: SCHEDULED → DISPATCHED / IN_TRANSIT → DELIVERED / CANCELLED

### 8.3 Today's Schedule (`renderTodaysSchedule`)
- 5 KPI tiles: Total DCs, Delivered, Pending, Delayed, Completion %
- Progress bar
- Per-staff mini delivery bars
- Empty state illustration

### 8.4 Route Planning (`renderDeliveryRoutes`)
- Drag-and-drop DC reordering (stub)
- Map integration placeholder

---

## 9. Procurement & Vendors

### 9.1 Purchase Orders
- Create PO from approved orders or manually
- PO FSM: DRAFT → SENT → ACCEPTED → RECEIVED / CANCELLED
- Line items with unit price and quantity

### 9.2 Vendor Portal
- Vendor admin sees their own POs and invoices
- Acknowledge PO → ACCEPTED
- Raise invoice against received POs

### 9.3 RFQ Module
- Create RFQ for a category of items
- Vendors submit quote responses
- Procurement manager compares and accepts

### 9.4 Templates (`renderTemplates`)
- Order templates — save a cart as a named template; apply to start a new order
- PO templates — save a PO structure for recurring procurement

---

## 10. Inventory & Warehouse

### 10.1 Inventory (`renderInventory`)
- Catalogue with SKU, name, category, sub-category, brand, unit, price
- Stock / reserved / available quantities
- Low stock alert badge
- Search, category filter, sub-category filter
- Add / edit / adjust stock modal

### 10.2 Warehouse (`renderWHOverview`)
- 5-tile KPI row with utilisation bars
- 2-column warehouse card layout
- Pick allocation tracking

### 10.3 Stock Movements
- `stock_movements` audit log: every stock change (receipt, pick, adjustment) recorded with `type`, `qty_change`, `reference_id`, `actor`

---

## 11. Reporting & Analytics

### 11.1 Reports & BI (`renderReports`)
- Categorised card grid (`REPORT_CATEGORIES` constant) — colour-coded sections
- Reports: Order vs Delivery, Due Items, DC per Order, SLA Report, Vendor Performance, Spend Analysis, Inventory Turnover, Client Spend

### 11.2 SLA Dashboard (`renderSLADashboard`)
- On-time delivery rate
- Average fulfilment time
- Breach summary by client

### 11.3 Ops Dashboard (`renderOpsDashboard`)
- 4 KPI tiles: Total Orders, Pending, Revenue, Active Clients
- 3 chart cards (Chart.js): Orders by Status (doughnut), Monthly Revenue (line), Top Categories (bar)
- Recent Orders table

### 11.4 Procurement Manager Dashboard
- Pending PO count, spend this month
- Vendor performance summary

---

## 12. Finance & DC Billing

### 12.1 DC Billing (`financeTabContent`)
- 4 KPI tiles: Total Invoiced, Pending, Overdue, Collected
- DC list sorted oldest-first
- Overdue rows highlighted red
- Mark as Paid / Raise Invoice actions

### 12.2 Dunning (`renderDunning`)
- Overdue invoice chase workflow
- Email/SMS trigger stubs

### 12.3 Porter Expenses (`renderPorterExpenses`)
- Daily delivery expense log per driver

---

## 13. Admin & Platform Tools

### 13.1 Users & Roles (`renderUsers`)
- User list with role badge
- Add user with role assignment
- Link client users to client accounts

### 13.2 Clients (`renderClients`)
- Client list with location and contact
- Add/edit client modal
- Per-client budget configuration

### 13.3 Approval Chains (`renderApprovalChains`)
- Rules: min/max order amount → auto-approve or require approval
- Client-specific or global rules

### 13.4 Service Desk (`renderServiceDesk`)
- Ticket creation (client or ops side)
- Status: OPEN → IN_PROGRESS → RESOLVED
- Priority: HIGH / MEDIUM / LOW
- Comment thread per ticket

### 13.5 Settings (`renderSettings`)
- Sidebar nav with sub-sections: General, Notifications, Integrations, Billing, Security
- `APP._settingsTab` persists active tab
- Zoho Books integration stub

### 13.6 CSV Import (`renderImportData`)
- Order import via CSV (upload or download template)
- Import job log with status

### 13.7 Consolidated Due Items (`renderConsolidatedDue`)
- Cross-client view of all overdue order items
- Value at risk calculation

### 13.8 Procurement View (`renderConsolidatedOrders`)
- Ops-level view of all active orders across clients

---

## 14. UI/UX Standards

### Card pattern
```html
<div class="card" style="padding:16px 18px; border-top:3px solid {colour}; margin-bottom:0">
```
Used for all KPI tiles and content panels. Colours: `var(--navy)`, `var(--primary)`, `var(--blue)`, `var(--success)`, `var(--danger)`, `var(--warning)`.

### CSS variables
```css
--navy: #0f172a       /* headings, primary text */
--primary: #f97316    /* brand orange */
--blue: #3b82f6       /* info / regular */
--success: #22c55e    /* green */
--danger: #ef4444     /* red / urgent */
--warning: #f59e0b    /* amber */
--border: #e2e8f0     /* dividers */
--text-muted: #64748b /* secondary text */
--sidebar-w: 220px
--sidebar-collapsed-w: 64px
```

### Modal
- Width: `75%` / `max-width: 75vw` (mobile: `96%`)
- `openModal(title, body, footer)` — centralised function
- `closeModal()` — resets overlay

### Helper functions
| Function | Purpose |
|----------|---------|
| `fmt(n)` | Format ₹ currency (Indian locale) |
| `fmtDate(iso)` | Format date (DD MMM YYYY) |
| `statusBadge(s)` | Coloured badge by status string |
| `orderTypeBadge(t)` | Coloured badge for order type |
| `pageHeader(title, sub, actions)` | Standard page header HTML |
| `showToast(msg, type)` | Bottom-right toast notification |
| `timeAgo(iso)` | Relative time string |

### Notifications
- Bell icon in topbar with badge count
- Slide-in panel with notification list
- Push notification stubs via `pushNotification(env, role, msg)`

---

## 15. Deployment & Migrations

### Deploy
```bash
git pull origin claude/ecstatic-gauss-l6ch3z
npx wrangler deploy
```

### Run a migration
```bash
npx wrangler d1 execute smart-pantry-db --file=migrations/0011_order_type.sql --remote
```

### All migrations (in order)
```bash
npx wrangler d1 execute smart-pantry-db --file=migrations/0001_schema.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0002_features.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0003_features.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0004_delivery_rebuild.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0005_fulfilment.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0006_spec_alignment.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0007_pick_allocation.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0008_user_client_link.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0009_inventory_fields.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0010_inventory_subcategory.sql --remote
npx wrangler d1 execute smart-pantry-db --file=migrations/0011_order_type.sql --remote
```

After deploying `0008_user_client_link.sql`, existing client users must **log out and back in** to get an updated JWT with `client_id`.

---

## 16. Session Change Log

### Session 1 — Foundation
- Core schema (migration 0001–0003)
- Auth, basic order flow, client/vendor/admin views

### Session 2 — Delivery & Fulfilment
- `dc_items` + `stock_movements` (migration 0004)
- Fulfilment tabs, DC dispatch workflow
- Pick allocation (migration 0007)

### Session 3 — Client Portal & UX
- Client portal account auto-linking (migration 0008)
- PARTIALLY_CLOSED order workflow (Dispatch Remaining, Pre-Close)
- OVD delivered quantity fix (fallback for zero qty_delivered)
- Ops/Admin page redesigns (Warehouse, DC Billing, Reports, Today's Schedule, Settings)
- Client Dashboard — welcome header, 5 KPI tiles, budget bar
- Track Delivery — 3-column pipeline layout
- Place Order — search + catalogue + sticky cart redesign

### Session 4 — Order Queue & OVD Overhaul
- Card style standardisation across all dashboards (all inline `background:#fff` → `class="card"`)
- OVD tab redesign: order-level summary table + 5 KPI tiles + item drilldown modal on click
- Orders Queue: added Items and Total Qty columns
- DC per Order: Ordered Date, Completion Date, DC count drilldown modal (DC number, date, line count, qty)
- All modal widths → 75% / 75vw
- Fix: "Fetching delivery breakdown" error — DC query used non-existent `created_at` (fixed to `dispatched_at`)
- Fix: Line Items tab 404 — `/orders/items-summary` intercepted by wildcard route (moved specific routes before `[^/]+` regex)

### Session 5 — Navigation & Sidebar Overhaul
- Merged "Features 16-25" nav section into "Management" / removed stale section
- Sidebar collapsed mode: icons only (64px), 1px divider for sections, `title` tooltip, active `inset box-shadow`
- Fixed `buildNav()` class names (`nav-item-icon`, `nav-item-label`, `nav-item-badge`)
- Restructured platform nav into 7 logical sections (24 items)

### Session 6 — Order Type (current)
- Migration 0011: `order_type` column on `orders` table
- Backend: validates `order_type` against `['Regular','Urgent','Ad-Hoc']`; defaults to `Regular`
- Cart panel: always-visible Order Type toggle buttons (Regular/Urgent/Ad-Hoc) with colour-coded styling
- Order Queue KPI row 2: 3 summary tiles by type with count, value, and click-to-filter
- Type filter: clicking tile toggles table filter; active state shows coloured ring + "✕ clear"
- `orderTypeBadge()` helper: Regular=blue, Urgent=red, Ad-Hoc=amber
- Badge shown in: Order Queue table, My Orders table, My Orders cards, Order Detail modal
- Urgent orders highlight row amber in Order Queue table

### Phase 2 — Consolidation
- **Addressable tabs (hash routing):** the URL hash is now the source of truth for the current page and, on tabbed hubs, the active tab (`#orders/pipeline`, `#delivery/calendar`, `#my_orders/tracking`). Deep links and browser back/forward work; `navigate(page, { tab })` keeps the hash in sync. Core helpers: `parseHash`, `writeHash`, `routeTab`, `registerHub`, `onHashChange`.
- **Phase-based status stepper:** shared `phaseStepper(status)` component + `ORDER_PHASES` map grouping the 14 FSM statuses into five phases (Placed → Approved → Fulfilment → Shipment → Delivered), with a Cancelled terminal marker. Single source of truth reused across surfaces.
- **Merged Orders surfaces:** the `orders` page is now a hub with addressable tabs **Queue · Pipeline · Due Items** (`renderOrdersHub`). Pipeline and Due Items left the sidebar and fold in as tabs; they stay reachable off-nav via `ACTION_PAGES`, and shortcuts/deep links redirect into the hub (`HUB_REDIRECT`). The Order Queue's flat 14-status strip was replaced by a phase-stepper filter (exact-status deep links like `oqGoto` still work — they light up their phase).
- **Merged Deliveries hub:** the existing Deliveries hub (Today · Deliveries · Calendar · Routes) tabs are now addressable (`#delivery/<tab>`) and honour deep links / back-forward.
- **Merged client order surfaces:** client **My Orders** + **Track Delivery** combined into one `renderMyOrdersHub` (tabs Orders · Tracking). Client order cards now use the shared phase stepper instead of a bespoke 5-stage bar.
- No page ids were removed, so ACL, quick actions and the frontend smoke test are unaffected.
