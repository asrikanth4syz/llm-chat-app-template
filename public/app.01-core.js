/* ============================================================
   Smart Pantry — Full Production SPA
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const APP = { user: null, page: 'dashboard', cart: [], charts: {}, token: null };

// Persist the cart across reloads (localStorage) AND across devices (server).
// Called after every cart change, plus a backstop on tab hide/close.
function persistCart() {
  try {
    localStorage.setItem('sp_cart', JSON.stringify(APP.cart || []));
    localStorage.setItem('sp_cart_ts', String(Date.now()));
  } catch (_) {}
  scheduleCartSync();
}
let _cartSyncTimer = null;
function scheduleCartSync() {
  if (!APP.token) return;
  clearTimeout(_cartSyncTimer);
  _cartSyncTimer = setTimeout(saveCartToServer, 700);
}
// Silent (toast-free) server save of the current cart.
async function saveCartToServer() {
  if (!APP.token) return;
  try {
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + APP.token },
      body: JSON.stringify({ items: APP.cart || [] }),
    });
  } catch (_) {}
}
// On load, reconcile the local cart with the server's saved draft cart. The most
// recently changed side wins (timestamp compare) so the cart follows the user to
// another device without clobbering a newer local cart.
async function loadServerCart() {
  if (!APP.token) return;
  try {
    const res = await fetch('/api/cart', { headers: { 'Authorization': 'Bearer ' + APP.token } });
    if (!res.ok) return;
    const data = await res.json();
    const serverItems = Array.isArray(data.items) ? data.items : [];
    const serverTs = data.updated_at ? Date.parse(data.updated_at + 'Z') : 0;
    const localTs = Number(localStorage.getItem('sp_cart_ts') || 0);
    if (serverItems.length && serverTs >= localTs) {
      APP.cart = serverItems;
      try { localStorage.setItem('sp_cart', JSON.stringify(APP.cart)); localStorage.setItem('sp_cart_ts', String(serverTs || Date.now())); } catch (_) {}
    } else if ((APP.cart || []).length && localTs > serverTs) {
      saveCartToServer(); // local is newer — push it up
    } else if (serverItems.length) {
      APP.cart = serverItems;
      try { localStorage.setItem('sp_cart', JSON.stringify(APP.cart)); } catch (_) {}
    }
    if (APP.page === 'place_order' && typeof refreshCartUI === 'function') refreshCartUI();
    if (APP.page === 'orders_inventory' && typeof oiRefreshRail === 'function') oiRefreshRail();
  } catch (_) {}
}
window.addEventListener('pagehide', persistCart);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistCart(); });

// ── Role Config ────────────────────────────────────────────
const ROLES = {
  super_admin:         { label:'Super Admin',          org:'4SYZ Platform',    initials:'SA', nav:'platform' },
  ops_admin:           { label:'Operations Admin',     org:'4SYZ Platform',    initials:'OA', nav:'ops' },
  procurement_manager: { label:'Procurement Manager',  org:'4SYZ Platform',    initials:'PM', nav:'procurement' },
  warehouse_exec:      { label:'Warehouse Executive',  org:'4SYZ Platform',    initials:'WE', nav:'warehouse' },
  delivery_manager:    { label:'Delivery Manager',     org:'4SYZ Platform',    initials:'DM', nav:'delivery' },
  delivery_exec:       { label:'Delivery Executive',   org:'4SYZ Platform',    initials:'DE', nav:'delivery_exec' },
  finance_admin:       { label:'Finance Admin',        org:'4SYZ Platform',    initials:'FA', nav:'finance' },
  client_admin:        { label:'Client Admin',         org:'Corporate Client', initials:'CA', nav:'client' },
  client_approver:     { label:'Client Approver',      org:'Corporate Client', initials:'AP', nav:'approver' },
  client_user:         { label:'Client User',          org:'Corporate Client', initials:'CU', nav:'client_user' },
  vendor_admin:        { label:'Vendor Admin',         org:'Supplier/Vendor',  initials:'VA', nav:'vendor' },
  vendor_user:         { label:'Vendor User',          org:'Supplier/Vendor',  initials:'VU', nav:'vendor_user' },
};

// ── Icons (must be before NAV which references them) ───────
const svg = (d, s=16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const iconDashboard = s => svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',s);
const iconOrders   = s => svg('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>',s);
const iconInventory= s => svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',s);
const iconVendors  = s => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',s);
const iconProcure  = s => svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',s);
const iconWarehouse= s => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',s);
const iconDelivery = s => svg('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',s);
const iconBilling  = s => svg('<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',s);
const iconClients  = s => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',s);
const iconDesk     = s => svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',s);
const iconReports  = s => svg('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',s);
const iconUsers    = s => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',s);
const iconSettings = s => svg('<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',s);
const iconCart     = s => svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',s);
const iconApprove  = s => svg('<polyline points="20 6 9 17 4 12"/>',s);
const iconPlus     = s => svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',s);
const iconCheck    = s => svg('<polyline points="20 6 9 17 4 12"/>',s);
const iconX        = s => svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',s);
const iconTruck    = s => svg('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',s);
const iconUpload   = s => svg('<polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>',s);
const iconEye      = s => svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',s);
const iconRefresh  = s => svg('<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.36"/>',s);
const iconBell     = s => svg('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',s);
// ── Extended FMCG-ERP icon set: one distinct, semantic glyph per function ──
const iconHome     = s => svg('<path d="m3 10.5 9-7 9 7"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>',s);
const iconClock    = s => svg('<circle cx="12" cy="12" r="9"/><polyline points="12 7.5 12 12 15 13.5"/>',s);
const iconFulfil   = s => svg('<path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0"/><polyline points="3.3 7 12 12 20.7 7"/><line x1="12" y1="22" x2="12" y2="12"/><path d="m14.5 18.5 2 2 4-4"/>',s);
const iconCalendar = s => svg('<rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/>',s);
const iconCalCheck = s => svg('<rect x="3" y="4.5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2.5" x2="8" y2="6"/><line x1="16" y1="2.5" x2="16" y2="6"/><polyline points="9 14.5 11 16.5 15 12.5"/>',s);
const iconMap      = s => svg('<polygon points="2.5 6.5 9 3.5 15 6.5 21.5 3.5 21.5 17.5 15 20.5 9 17.5 2.5 20.5"/><line x1="9" y1="3.5" x2="9" y2="17.5"/><line x1="15" y1="6.5" x2="15" y2="20.5"/>',s);
const iconLayers   = s => svg('<polygon points="12 2.5 2 7 12 11.5 22 7"/><polyline points="2 12 12 16.5 22 12"/><polyline points="2 17 12 21.5 22 17"/>',s);
const iconPie      = s => svg('<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',s);
const iconGauge    = s => svg('<path d="M3.5 18a10 10 0 1 1 17 0"/><line x1="12" y1="14" x2="15.5" y2="10.5"/><circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none"/>',s);
const iconReceipt  = s => svg('<path d="M4 2.5v19l2.2-1.3 2.3 1.3 2.3-1.3 2.4 1.3 2.3-1.3 2.2 1.3v-19l-2.2 1.3-2.3-1.3-2.4 1.3-2.3-1.3-2.3 1.3z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/>',s);
const iconMail     = s => svg('<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 6.5L21 6"/>',s);
const iconBadge    = s => svg('<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10.5" r="2"/><path d="M5.6 16c.5-1.6 5.3-1.6 5.8 0"/><line x1="14.5" y1="9.5" x2="18.5" y2="9.5"/><line x1="14.5" y1="13" x2="18.5" y2="13"/>',s);
const iconLayout   = s => svg('<rect x="3" y="3.5" width="18" height="6" rx="1"/><rect x="3" y="12.5" width="7.5" height="8" rx="1"/><rect x="13.5" y="12.5" width="7.5" height="8" rx="1"/>',s);
const iconFlow     = s => svg('<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M6 8.5v7"/><path d="M18 9.5a6 6 0 0 1-6 6H8.5"/>',s);
const iconPin      = s => svg('<path d="M20 10.5c0 6-8 11.5-8 11.5s-8-5.5-8-11.5a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10.5" r="2.8"/>',s);
const iconWallet   = s => svg('<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19a1 1 0 0 1 1 1v2"/><path d="M3 7.5V18a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M20 11h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z"/>',s);
const iconSupplier = s => svg('<path d="M3 21h18"/><path d="M5 21V8l7-3.5V21"/><path d="M12 21V9l7 3.5V21"/><line x1="8.5" y1="11" x2="8.5" y2="11.01"/><line x1="8.5" y1="15" x2="8.5" y2="15.01"/>',s);
const iconHeadset  = s => svg('<path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13.5v3a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 .5Z"/><path d="M20 13.5v3a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 .5Z"/><path d="M18 18.5a4 4 0 0 1-4 3h-2"/>',s);
const iconFile     = s => svg('<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2.5 14 8 19 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="16.5" x2="15" y2="16.5"/>',s);

// Single source of truth for a page's sidebar icon — keyed by page id so every
// role that surfaces a page gets the same, semantically-correct glyph. buildNav
// resolves through this first, falling back to the item's own icon.
const PAGE_ICON = {
  dashboard: iconHome,
  // Orders & fulfilment
  orders: iconOrders, next_actions: iconCheck, pipeline: iconGauge, consolidated_due: iconClock, fulfilment: iconFulfil,
  todays_schedule: iconCalCheck,
  // Deliveries
  delivery: iconTruck, delivery_calendar: iconCalendar, delivery_routes: iconMap,
  track_delivery: iconPin,
  // Clients & support
  clients: iconClients, service_desk: iconHeadset, approval_chains: iconFlow,
  approvals: iconApprove,
  // Procurement & supply
  procurement: iconProcure, consolidated_orders: iconLayers, vendors: iconSupplier,
  inventory: iconInventory, warehouse: iconWarehouse, my_inventory: iconInventory,
  // Billing & finance
  dc_billing: iconBilling, dunning: iconMail, porter_expenses: iconReceipt,
  client_budget: iconWallet,
  // Reports & insight
  exec_bi: iconPie, consolidated_report: iconFile, reports: iconReports,
  sla_dashboard: iconGauge, client_reports: iconPie, client_consumption: iconReports,
  // Alerts
  alerts: iconBell,
  // Admin & settings
  users: iconUsers, staff: iconBadge, templates: iconLayout, import_data: iconUpload,
  zones: iconPin, settings: iconSettings,
  // Client / ordering
  place_order: iconCart, my_orders: iconOrders, orders_inventory: iconLayers,
  // Vendor portal
  vendor_pos: iconProcure, vendor_invoices: iconReceipt, vendor_payments: iconWallet,
};
const navIcon = (item, s = 18) => (PAGE_ICON[item.id] || item.icon || iconHome)(s);

// ── Nav surfaces ───────────────────────────────────────────
const NAV = {
  platform: [
    // IA 2026 (phase 1): the sidebar is ordered along the order→delivery flow,
    // labels are verb-first plain language, and every menu has a distinct icon
    // so the list can be scanned by shape. Every page id is unchanged, so ACL,
    // quick actions and the smoke test are unaffected — only order/label/icon.
    { section:'Home' },
    { id:'dashboard',   label:'Home', icon:iconHome, badge:null },
    { section:'Today & Orders' },
    { id:'next_actions',        label:'Today',        icon:iconCheck,   badge:null },
    { id:'pipeline',            label:'Pipeline',     icon:iconGauge,   badge:null },
    { id:'orders',              label:'Orders',       icon:iconOrders,  badge:'!' },
    { id:'consolidated_due',    label:'Due Items',    icon:iconReceipt, badge:'!' },
    { section:'Fulfilment & Delivery' },
    { id:'fulfilment',          label:'Pick & Pack',      icon:iconFulfil,   badge:'!' },
    { id:'delivery',            label:'Deliveries',       icon:iconDelivery, badge:null },
    { section:'Procurement & Stock' },
    { id:'procurement',         label:'Purchase Orders', icon:iconProcure,   badge:null },
    { id:'consolidated_orders', label:'Consolidated POs',icon:iconLayers,    badge:null },
    { id:'vendors',             label:'Vendors',         icon:iconSupplier,  badge:null },
    { id:'inventory',           label:'Inventory',       icon:iconInventory, badge:null },
    { id:'warehouse',           label:'Warehouse',       icon:iconWarehouse, badge:null },
    { section:'Clients' },
    { id:'clients',         label:'Clients',          icon:iconClients,  badge:null },
    { id:'service_desk',    label:'Service Desk',     icon:iconHeadset,  badge:null },
    { id:'approval_chains', label:'Approval Chains',  icon:iconFlow,     badge:null },
    { section:'Billing & Finance' },
    { id:'dc_billing',      label:'Billing',          icon:iconBilling,  badge:'!' },
    { id:'dunning',         label:'Dunning',          icon:iconMail,     badge:null },
    { id:'porter_expenses', label:'Porter Expenses',  icon:iconWallet,   badge:null },
    { section:'Reports & Insights' },
    { id:'exec_bi',              label:'Executive BI',        icon:iconPie,     badge:null },
    { id:'consolidated_report',  label:'Consolidated Report', icon:iconFile,    badge:null },
    { id:'reports',              label:'Reports & BI',        icon:iconReports, badge:null },
    { id:'sla_dashboard',        label:'SLA Dashboard',       icon:iconClock,   badge:'!' },
    { section:'Alerts & Exceptions' },
    { id:'alerts',              label:'Alerts & Exceptions', icon:iconBell,   badge:'!' },
    { id:'over_delivery_audit', label:'Over-Delivery Audit', icon:iconEye,    badge:null },
    { section:'Admin & Settings' },
    { id:'users',       label:'Users & Roles',  icon:iconUsers,  badge:null },
    { id:'staff',       label:'Staff',          icon:iconBadge,  badge:null },
    { id:'zones',       label:'Location Zones', icon:iconPin,    badge:null },
    { id:'templates',   label:'Templates',      icon:iconLayout, badge:null },
    { id:'import_data', label:'CSV Import',     icon:iconUpload, badge:null },
  ],
  ops: [
    { section:'Home' },
    { id:'dashboard',           label:'Home',             icon:iconHome,      badge:null },
    { section:'Today & Orders' },
    { id:'next_actions',        label:'Today',            icon:iconCheck,     badge:null },
    { id:'pipeline',            label:'Pipeline',         icon:iconGauge,     badge:null },
    { id:'orders',              label:'Orders',           icon:iconOrders,    badge:'!' },
    { id:'consolidated_due',    label:'Due Items',        icon:iconReceipt,   badge:'!' },
    { section:'Fulfilment & Delivery' },
    { id:'fulfilment',          label:'Pick & Pack',      icon:iconFulfil,    badge:'!' },
    { id:'delivery',            label:'Deliveries',       icon:iconDelivery,  badge:null },
    { section:'Billing & Finance' },
    { id:'dc_billing',          label:'Billing',          icon:iconBilling,   badge:'!' },
    { section:'Clients' },
    { id:'service_desk',        label:'Service Desk',     icon:iconHeadset,   badge:null },
    { section:'Alerts & Exceptions' },
    { id:'alerts',              label:'Alerts & Exceptions', icon:iconBell,   badge:'!' },
    { id:'over_delivery_audit', label:'Over-Delivery Audit', icon:iconEye,    badge:null },
  ],
  procurement: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',           icon:iconDashboard, badge:null },
    { section:'Procurement' },
    { id:'procurement', label:'Purchase Orders',icon:iconProcure,  badge:null },
    { id:'vendors',     label:'Vendors',       icon:iconVendors,   badge:null },
    { section:'Inventory' },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
    { section:'Reports & Insights' },
    { id:'consolidated_report', label:'Consolidated Report', icon:iconReports, badge:null },
  ],
  warehouse: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',          icon:iconDashboard, badge:null },
    { section:'Inventory' },
    { id:'warehouse',   label:'Warehouse',     icon:iconWarehouse, badge:null },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
  ],
  delivery: [
    { section:'Home' },
    { id:'dashboard',       label:'Home',               icon:iconDashboard, badge:null },
    { section:'Operations' },
    { id:'delivery',        label:'Deliveries',         icon:iconDelivery,  badge:null },
    { section:'Billing & Finance' },
    { id:'dc_billing',      label:'Billing',            icon:iconBilling,   badge:'!' },
  ],
  delivery_exec: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',          icon:iconDashboard, badge:null },
    { section:'Operations' },
    { id:'delivery',    label:'My Deliveries', icon:iconDelivery,  badge:null },
  ],
  finance: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',          icon:iconDashboard, badge:null },
    { section:'Billing & Finance' },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
    { section:'Reports & Insights' },
    { id:'reports',     label:'Reports & BI',  icon:iconReports,   badge:null },
  ],
  client: [
    { section:'Home' },
    { id:'dashboard',        label:'Home',               icon:iconDashboard, badge:null },
    { section:'Ordering' },
    { id:'place_order',    label:'Place Order',    icon:iconCart,      badge:null },
    { id:'my_orders',      label:'My Orders',      icon:iconOrders,    badge:null },
    { id:'track_delivery', label:'Track Delivery', icon:iconDelivery,  badge:null },
    { id:'approvals',      label:'Approvals',      icon:iconApprove,   badge:null },
    { section:'My Store' },
    { id:'my_inventory',   label:'My Inventory',   icon:iconInventory, badge:null },
    { section:'Reports & Insights' },
    { id:'client_consumption', label:'Consumption Report', icon:iconReports, badge:null },
    { id:'client_budget',  label:'Budget & Spend',    icon:iconReports, badge:null },
    { id:'client_reports', label:'Executive Reports', icon:iconReports, badge:null },
    { section:'Support' },
    { id:'service_desk',   label:'Service Desk',   icon:iconDesk,      badge:null },
  ],
  approver: [
    { section:'Home' },
    { id:'dashboard',        label:'Home',               icon:iconDashboard, badge:null },
    { id:'approvals',   label:'Pending Approvals',icon:iconApprove,badge:'!' },
    { section:'Ordering' },
    { id:'place_order',   label:'Place Order',    icon:iconCart,     badge:null },
    { id:'my_orders',     label:'All Orders',     icon:iconOrders,   badge:null },
    { id:'track_delivery',label:'Track Delivery', icon:iconDelivery, badge:null },
  ],
  client_user: [
    { section:'Home' },
    { id:'dashboard',        label:'Home',               icon:iconDashboard, badge:null },
    { section:'Ordering' },
    { id:'place_order', label:'Place Order',   icon:iconCart,      badge:null },
    { id:'my_orders',   label:'My Orders',     icon:iconOrders,    badge:null },
    { id:'track_delivery',label:'Track Delivery',icon:iconDelivery,badge:null },
    { section:'My Store' },
    { id:'my_inventory', label:'My Inventory', icon:iconInventory, badge:null },
  ],
  vendor: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',           icon:iconDashboard, badge:null },
    { section:'Vendor Portal' },
    { id:'vendor_pos',  label:'Purchase Orders',icon:iconProcure,  badge:'!' },
    { id:'vendor_invoices',label:'Invoices',   icon:iconBilling,   badge:null },
    { id:'vendor_payments',label:'Payments',   icon:iconReports,   badge:null },
  ],
  vendor_user: [
    { section:'Home' },
    { id:'dashboard',   label:'Home',           icon:iconDashboard, badge:null },
    { section:'Vendor Portal' },
    { id:'vendor_pos',  label:'Purchase Orders',icon:iconProcure,  badge:null },
  ],
};

// ── API wrapper ────────────────────────────────────────────
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (APP.token) headers['Authorization'] = `Bearer ${APP.token}`;
  const res = await fetch('/api' + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (res.status === 401) { doLogout(); return null; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    showToast('Error: ' + (err.error || res.statusText), 'error');
    return null;
  }
  return res.json();
}

// ── Auth ───────────────────────────────────────────────────
// Inline error shown right on the credentials card (not a toast).
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  if (!el) { showToast(msg, 'error'); return; }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; // retrigger shake
}
function clearLoginError() {
  const el = document.getElementById('login-error');
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

async function doLogin() {
  clearLoginError();
  const otpGroup = document.getElementById('otp-group');
  const otpVisible = !otpGroup.classList.contains('hidden');

  if (otpVisible) { doVerifyOTP(); return; }

  const email    = document.getElementById('login-email')?.value?.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value;
  if (!email || !password) { showLoginError('Please enter your email and password.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';

  // Use a direct fetch — the shared api() helper treats every 401 as a session
  // logout and returns null silently, so wrong credentials would show no error.
  let res, data;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    btn.disabled = false; btn.querySelector('span').textContent = 'Sign In';
    showLoginError('Network error — check your connection and try again.');
    return;
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = 'Sign In';

  if (!res.ok) {
    showLoginError(data.error || (res.status === 401 ? 'Invalid email or password.' : 'Sign in failed — please try again.'));
    const pw = document.getElementById('login-password'); if (pw) { pw.value = ''; pw.focus(); }
    return;
  }

  if (data.otp_required) {
    APP._pendingEmail = email;
    otpGroup.classList.remove('hidden');
    btn.querySelector('span').textContent = 'Verify OTP';
    document.querySelectorAll('.otp-input')[0]?.focus();
    setupOTPInputs();
    showToast('OTP sent to your registered email');
    return;
  }

  APP.token = data.token;
  APP.user = { ...data.user, nav: ROLES[data.user.role]?.nav || 'platform' };
  localStorage.setItem('sp_token', data.token);
  initApp();
}

function setupOTPInputs() {
  const inputs = document.querySelectorAll('.otp-input');
  inputs.forEach((inp, i) => {
    inp.value = '';
    inp.addEventListener('input', () => {
      if (inp.value && i < inputs.length - 1) inputs[i+1].focus();
    });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i-1].focus();
    });
  });
}

async function doVerifyOTP() {
  clearLoginError();
  const code = [...document.querySelectorAll('.otp-input')].map(i => i.value).join('');
  if (code.length < 6) { showLoginError('Enter all 6 digits of the OTP.'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Verifying…';

  // Direct fetch (see doLogin) so a wrong OTP shows an error without api()'s
  // 401-triggered logout wiping the OTP form.
  let res, data;
  try {
    res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: APP._pendingEmail, code }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    btn.disabled = false; btn.querySelector('span').textContent = 'Verify OTP';
    showLoginError('Network error — check your connection and try again.');
    return;
  }

  btn.disabled = false;
  btn.querySelector('span').textContent = 'Verify OTP';

  if (!res.ok || !data.token) { showLoginError(data.error || 'Invalid or expired OTP.'); return; }

  APP.token = data.token;
  APP.user = { ...data.user, nav: ROLES[data.user.role]?.nav || 'platform' };
  localStorage.setItem('sp_token', data.token);
  initApp();
}

function doLogout() {
  if (APP._notifInterval) clearInterval(APP._notifInterval);
  // Clear the server-side draft cart for this user (fire-and-forget, before the token is dropped).
  clearTimeout(_cartSyncTimer);
  if (APP.token) { try { fetch('/api/cart', { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + APP.token } }); } catch (_) {} }
  APP.token = null;
  APP.user = null;
  APP.cart = [];
  localStorage.removeItem('sp_token');
  localStorage.removeItem('sp_cart');
  localStorage.removeItem('sp_cart_ts');
  localStorage.removeItem('sp_page');
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  APP.charts = {};
  document.getElementById('otp-group').classList.add('hidden');
  document.getElementById('login-btn').querySelector('span').textContent = 'Sign In';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function tryAutoLogin() {
  const token = localStorage.getItem('sp_token');
  if (!token) return;
  APP.token = token;
  const data = await api('/auth/me').catch(() => null);
  if (data?.user) {
    APP.user = { ...data.user, nav: ROLES[data.user.role]?.nav || 'platform' };
    initApp();
  } else {
    APP.token = null;
    localStorage.removeItem('sp_token');
  }
}

function togglePw() {
  const inp = document.getElementById('login-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ── Profile Modal ──────────────────────────────────────────
async function openProfileModal() {
  const profile = await api('/profile');
  if (!profile) return;

  const roleLabel = (ROLES[profile.role]?.label) || profile.role;

  openModal('My Profile', `
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--gold);color:#fff;font-size:1.4rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">${profile.initials}</div>
      <div style="font-weight:800;font-size:1rem;color:var(--navy)">${h(profile.name)}</div>
      <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">${h(profile.email)} · ${roleLabel}</div>
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin-bottom:16px">
    <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">Edit Profile</div>
    <div class="form-group"><label>Display Name</label><input type="text" id="prof-name" value="${h(profile.name)}"></div>
    <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:16px 0 10px">Change Password</div>
    <div class="form-group"><label>Current Password</label><input type="password" id="prof-cur-pw" placeholder="Enter current password"></div>
    <div class="form-group"><label>New Password</label><input type="password" id="prof-new-pw" placeholder="Enter new password (min 6 chars)"></div>
    <div class="form-group"><label>Confirm New Password</label><input type="password" id="prof-conf-pw" placeholder="Confirm new password"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveProfile')}>Save Changes</button>`);
}

async function saveProfile() {
  const name = document.getElementById('prof-name').value.trim();
  const curPw = document.getElementById('prof-cur-pw').value;
  const newPw = document.getElementById('prof-new-pw').value;
  const confPw = document.getElementById('prof-conf-pw').value;

  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  if (newPw && newPw.length < 6) { showToast('New password must be at least 6 characters', 'error'); return; }
  if (newPw && newPw !== confPw) { showToast('Passwords do not match', 'error'); return; }

  const body = { name };
  if (newPw) { body.current_password = curPw; body.new_password = newPw; }

  const res = await api('/profile', { method:'PATCH', body: JSON.stringify(body) });
  if (!res) return;

  // Update local state and UI
  APP.user.name = res.name;
  APP.user.initials = res.initials;
  document.getElementById('user-name').textContent = res.name;
  document.getElementById('user-avatar').textContent = res.initials;
  document.getElementById('topbar-avatar').textContent = res.initials;

  closeModal();
  showToast('Profile updated');
}

// ── App init ───────────────────────────────────────────────
function initApp() {
  const u = APP.user;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = u.name;
  document.getElementById('user-role').textContent = u.org;
  document.getElementById('user-avatar').textContent = u.initials;
  document.getElementById('topbar-avatar').textContent = u.initials;
  // header profile menu
  setText('topbar-profile-name', (u.name||'').split(' ')[0]);
  setText('topbar-profile-org', u.org || '');
  setText('pm-avatar', u.initials); setText('pm-name', u.name); setText('pm-role', u.org);
  // Settings lives under the profile menu; only roles with the page see it
  const settingsItem = document.getElementById('pm-settings');
  if (settingsItem) settingsItem.style.display = (PAGE_MAP.settings && ['super_admin','ops_admin'].includes(u.role)) ? '' : 'none';
  // Hide the quick-action (+) menu entirely for roles that have no quick actions
  // (e.g. delivery executives).
  const quickWrap = document.getElementById('tb-quick-wrap');
  if (quickWrap) quickWrap.style.display = quickActionItems().length ? '' : 'none';
  buildNav();
  updateNavBadges(true); // live sidebar counts (internal roles); async, non-blocking
  // Restore the cart so it survives a page reload.
  try { const c = JSON.parse(localStorage.getItem('sp_cart') || '[]'); if (Array.isArray(c)) APP.cart = c; } catch (_) {}
  // Return to the last page on reload (falls back to the role's default; the
  // navigate() ACL guard redirects if the saved page isn't allowed for this role).
  let startPage = getDefaultPage();
  try { const p = localStorage.getItem('sp_page'); if (p && canAccessPage(p)) startPage = p; } catch (_) {}
  navigate(startPage);
  loadServerCart();        // reconcile with the server-saved draft cart (cross-device)
  loadNotifications();
  startNotificationPolling();

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar')) hideSearchResults();
    if (!e.target.closest('.tb-pop-wrap')) closeTbMenus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||'')) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault(); document.getElementById('global-search')?.focus();
    }
    if (e.key === 'Escape') closeTbMenus();
  });
}
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

/* ── Header: Quick actions + Profile menu ── */
function closeTbMenus() {
  document.getElementById('quick-menu')?.classList.add('hidden');
  document.getElementById('profile-menu')?.classList.add('hidden');
}
function toggleProfileMenu(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('profile-menu'); if (!m) return;
  const open = m.classList.contains('hidden');
  closeTbMenus();
  if (open) m.classList.remove('hidden');
}
function toggleQuickActions(e) {
  if (e) e.stopPropagation();
  const m = document.getElementById('quick-menu'); if (!m) return;
  const open = m.classList.contains('hidden');
  closeTbMenus();
  if (!open) return;
  m.innerHTML = quickActionItems().map(a =>
    `<button class="tb-menu-item" ${a.arg !== undefined ? dataAct(a.act, a.arg) : dataAct(a.act)}>
      <span class="tb-qa-ic">${a.icon}</span><span><span class="tb-qa-t">${a.label}</span><span class="tb-qa-s">${a.sub}</span></span></button>`).join('')
    || '<div class="tb-menu-empty">No quick actions for your role.</div>';
  m.classList.remove('hidden');
}
function quickActionItems() {
  const nav = APP.user?.nav;
  let items;
  if (['client','client_user','approver'].includes(nav)) items = [
    { icon:'🛒', label:'Place order', sub:'browse the catalogue', act:'quickNav', arg:'place_order' },
    { icon:'📋', label:'Upload order sheet', sub:'export &amp; import quantities', act:'quickNavCSV', need:'place_order' },
    { icon:'📉', label:'Log use', sub:'record consumption', act:'quickNav', arg:'my_inventory' },
  ];
  else if (nav === 'vendor' || nav === 'vendor_user') items = [
    { icon:'📦', label:'View purchase orders', sub:'respond to POs', act:'quickNav', arg:'vendor_pos' },
    { icon:'🧾', label:'Invoices', sub:'raise &amp; track', act:'quickNav', arg:'vendor_invoices' },
  ];
  else items = [
    { icon:'📅', label:'Delivery calendar', sub:'plan &amp; reschedule', act:'quickNav', arg:'delivery_calendar' },
    { icon:'📦', label:'Add product', sub:'to the catalogue', act:'quickNav', arg:'inventory' },
    { icon:'🏢', label:'Onboard client', sub:'new organisation', act:'quickNav', arg:'clients' },
    { icon:'🎫', label:'New ticket', sub:'service desk', act:'quickNav', arg:'service_desk' },
  ];
  // Every quick action must point at a page in the user's own navigation — so a
  // Client Approver (Approvals + My Orders only) never gets "Log use" or "Place
  // order", and a Vendor User never gets "Invoices". `need` covers actions whose
  // page target isn't a plain arg (e.g. the CSV upload shortcut → place_order).
  const navIds = new Set((NAV[nav] || []).filter(i => i.id).map(i => i.id));
  return items.filter(a => { const pg = a.arg ?? a.need; return pg === undefined || navIds.has(pg); });
}

// ── Global Search (Gap 10) ─────────────────────────────────
let _searchTimer;
function debounceSearch(q) {
  clearTimeout(_searchTimer);
  if (q.length < 2) { hideSearchResults(); return; }
  _searchTimer = setTimeout(() => runSearch(q), 280);
}

async function runSearch(q) {
  const data = await api('/search?q=' + encodeURIComponent(q));
  if (!data) return;
  const el = document.getElementById('search-results');
  if (!el) return;
  const all = [...(data.orders||[]).map(r=>({...r,_type:'order'})),
               ...(data.inventory||[]).map(r=>({...r,_type:'item'})),
               ...(data.vendors||[]).map(r=>({...r,_type:'vendor'})),
               ...(data.clients||[]).map(r=>({...r,_type:'client'})),
               ...(data.tickets||[]).map(r=>({...r,_type:'ticket'}))];
  if (!all.length) {
    el.style.display = '';
    el.innerHTML = '<div style="padding:16px;color:var(--text-muted);text-align:center">No results for "'+q+'"</div>';
    return;
  }
  const typeIcon = { order:'📋', item:'📦', vendor:'🤝', client:'🏢', ticket:'🎫' };
  const typeNav = { order:'orders', vendor:'vendors', client:'clients', ticket:'service_desk' };
  el.style.display = '';
  el.innerHTML = all.slice(0,10).map(r => `
    <div ${dataAct('handleSearchResult', r._type, r.id||r.sku||'')} style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" data-hover>
      <span style="font-size:1.2rem">${typeIcon[r._type]||'🔍'}</span>
      <div style="min-width:0">
        <div style="font-weight:600;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(r.title||r.name||r.subject||r.id||r.sku||'')}</div>
        <div style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r._type.toUpperCase()}${(r.id||r.sku)?' · '+h(String(r.id||r.sku)):''}${r.subtitle?' · '+h(String(r.subtitle)):''}</div>
      </div>
    </div>`).join('');
}

function handleSearchResult(type, id) {
  hideSearchResults();
  document.getElementById('global-search').value = '';
  const navPage = { order:'orders', vendor:'vendors', client:'clients', ticket:'service_desk', item:'inventory' };
  navigate(navPage[type] || 'dashboard');
  if (type === 'order') setTimeout(() => viewOrder(id), 400);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.search-bar')) hideSearchResults();
});

function hideSearchResults() {
  const el = document.getElementById('search-results');
  if (el) el.style.display = 'none';
}

// ── Notification polling (Gap 2) ───────────────────────────
function startNotificationPolling() {
  if (APP._notifInterval) clearInterval(APP._notifInterval);
  let firstPoll = true;
  APP._notifInterval = setInterval(async () => {
    if (!APP.token) { clearInterval(APP._notifInterval); return; }
    const data = await api('/notifications').catch(() => null);
    if (!data) return;
    const unread = data.filter(n => !n.read_flag);
    const unreadCount = unread.length;
    const newestId = unread[0]?.id ?? null;

    document.querySelector('.notif-badge').textContent = unreadCount || '';
    document.querySelector('.notif-badge').style.display = unreadCount ? '' : 'none';

    // On the very first poll just baseline — never toast old notifications
    if (!firstPoll && newestId && newestId !== APP._lastToastedNotifId) {
      const prevCount = APP._prevUnread ?? 0;
      if (unreadCount > prevCount) {
        showToast(unread[0].message, 'info');
        APP._lastToastedNotifId = newestId;
      }
    }
    if (firstPoll) { APP._lastToastedNotifId = newestId; firstPoll = false; }
    APP._prevUnread = unreadCount;
  }, 30000);
}

// Single source of truth for page-level access: a role may open a page only if it
// is in that role's navigation (dashboard is always allowed). Used to guard
// navigate() and to hide shortcuts that would lead somewhere off-menu.
function canAccessPage(page) {
  if (!APP.user) return true;
  if (page === 'dashboard') return true;
  // Allowed if the page is in the role's own sidebar nav …
  if ((NAV[APP.user.nav] || []).some(i => i.id === page)) return true;
  // … or it's an off-nav action page this role may reach via a button/menu —
  // e.g. the profile-menu Settings link, or ops/procurement placing an order on
  // a client's behalf from the order queue.
  return (ACTION_PAGES[page] || []).includes(APP.user.role);
}
// Pages not in any sidebar nav that specific roles may still reach via buttons/menus.
const ACTION_PAGES = {
  settings:    ['super_admin', 'ops_admin'],
  place_order: ['super_admin', 'ops_admin', 'ops_manager', 'procurement_manager'],
  // Phase 3: the delivery sub-pages are now tabs inside the "Deliveries" hub
  // (page id `delivery`). They stay reachable off-nav so existing deep links
  // (dashboard shortcuts, post-action redirects) keep working for these roles.
  todays_schedule:   ['super_admin', 'ops_admin', 'delivery_manager'],
  delivery_calendar: ['super_admin', 'ops_admin', 'delivery_manager'],
  delivery_routes:   ['super_admin'],
};

function getDefaultPage() {
  const nav = APP.user.nav;
  if (nav === 'vendor' || nav === 'vendor_user') return 'dashboard';
  if (nav === 'client_user') return 'place_order';
  return 'dashboard';
}

// ── Sidebar nav ────────────────────────────────────────────
// Accordion state: at most one collapsible section is open at a time. We persist
// the single open section's label (empty = all collapsed) rather than a set.
function navPrefLoad() {
  if (APP._navOpen === undefined) { try { APP._navOpen = localStorage.getItem('sp_nav_open') || null; } catch { APP._navOpen = null; } }
}
function navPrefSave() { try { APP._navOpen ? localStorage.setItem('sp_nav_open', APP._navOpen) : localStorage.removeItem('sp_nav_open'); } catch {} }

// Apply accordion state to the DOM: open the one section whose label matches
// `openLabel`, collapse every other collapsible section, and persist the choice.
function applyAccordion(openLabel) {
  const wrap = document.getElementById('sidebar-nav'); if (!wrap) return;
  wrap.querySelectorAll('.nav-section-toggle').forEach(tog => {
    const lbl = (tog.querySelector('.nav-section-label')?.textContent || '').trim();
    const body = document.getElementById('nav-sec-' + lbl.replace(/\s+/g,'_'));
    const collapsed = lbl !== openLabel;
    tog.classList.toggle('collapsed', collapsed);
    if (body) {
      body.classList.toggle('collapsed', collapsed);
      body.style.maxHeight = collapsed ? '0' : (body.children.length * 44 + 'px');
    }
  });
  APP._navOpen = openLabel || null;
  navPrefSave();
}

function buildNav() {
  const nav = APP.user.nav;
  const items = NAV[nav] || NAV.platform;
  navPrefLoad();

  // Group items into sections
  const sections = [];
  let current = null;
  items.forEach(item => {
    if (item.section) {
      current = { label: item.section, items: [] };
      sections.push(current);
    } else if (current) {
      current.items.push(item);
    }
  });

  // Resolve the single section that should be open (accordion). Prefer the
  // persisted choice; otherwise open the section holding the current page, and
  // fall back to the first collapsible section so exactly one group is open.
  const collapsibleLabels = sections.slice(1).map(s => s.label);
  let openLabel = collapsibleLabels.includes(APP._navOpen) ? APP._navOpen : null;
  if (!openLabel) {
    const secOfCur = APP.page ? sections.find((s, i) => i > 0 && s.items.some(it => it.id === APP.page))?.label : null;
    openLabel = secOfCur || collapsibleLabels[0] || null;
  }
  APP._navOpen = openLabel; navPrefSave();

  const html = sections.map((sec, idx) => {
    const isFirst = idx === 0;
    const collapsed = !isFirst && sec.label !== openLabel;
    const bodyMaxH = sec.items.length * 44 + 'px';

    const headerHtml = isFirst
      ? `<div class="nav-section"><span class="nav-section-label">${sec.label}</span></div>`
      : `<div class="nav-section-toggle${collapsed ? ' collapsed' : ''}" ${dataAct('toggleNavSection', sec.label)}>
           <span class="nav-section-label">${sec.label}</span>
           <span class="nav-toggle-arrow">▶</span>
         </div>`;

    const itemsHtml = sec.items.map(item => `
      <div class="nav-item${item.id === 'dashboard' ? ' nav-item--home' : ''}" id="nav-${item.id}"
        role="button" tabindex="0" aria-label="${item.label}" ${dataAct('navigate', item.id)} title="${item.label}">
        <span class="nav-item-icon">${navIcon(item)}</span>
        <span class="nav-item-label">${item.label}</span>
        ${item.badge ? `<span class="nav-item-badge" aria-hidden="true">${item.badge}</span>` : ''}
      </div>`).join('');

    return headerHtml + (isFirst
      ? itemsHtml
      : `<div class="nav-section-body${collapsed ? ' collapsed' : ''}" id="nav-sec-${sec.label.replace(/\s+/g,'_')}" style="max-height:${collapsed ? '0' : bodyMaxH}">${itemsHtml}</div>`);
  }).join('');

  const collapseBtn = `<button class="nav-collapse-btn" ${dataAct('collapseSidebar')} title="Collapse menu">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/><path d="M21 18l-6-6 6-6" opacity=".5"/></svg>
    <span class="nav-collapse-lbl">Collapse</span></button>`;

  // Menu search — super admin only (their sidebar is the largest)
  const searchHtml = nav === 'platform' ? `
    <div class="nav-search-wrap">
      <svg class="nav-search-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input id="nav-search" class="nav-search" type="search" placeholder="Search menu…" autocomplete="off" spellcheck="false"
        ${dataInputVal('filterNav')} data-keydown="navSearchKey">
    </div>
    <div id="nav-no-results" class="nav-no-results" style="display:none">No menu matches.</div>` : '';

  document.getElementById('sidebar-nav').innerHTML = searchHtml + html + collapseBtn;
  applyNavBadges(); // re-apply any cached live counts over the static "!" badges

  // restore persisted icon-rail state (desktop only)
  const sb = document.getElementById('sidebar');
  if (sb && window.innerWidth > 768) {
    let rail = false; try { rail = localStorage.getItem('sp_nav_rail') === '1'; } catch {}
    sb.classList.toggle('collapsed', rail);
  }
}

// Live-filter the sidebar menu by label (super-admin search box). Matching items
// stay, their sections force-open; empty query restores the persisted state.
function filterNav(q) {
  const wrap = document.getElementById('sidebar-nav'); if (!wrap) return;
  q = (q || '').trim().toLowerCase();
  const items = [...wrap.querySelectorAll('.nav-item')];
  const nores = document.getElementById('nav-no-results');

  if (!q) {
    items.forEach(el => { el.style.display = ''; });
    // headers may have been hidden while searching — reveal them, then restore
    // the single-open accordion state.
    wrap.querySelectorAll('.nav-section-toggle, .nav-section').forEach(h => { h.style.display = ''; });
    navPrefLoad();
    applyAccordion(APP._navOpen);
    if (nores) nores.style.display = 'none';
    return;
  }

  let any = false;
  items.forEach(el => {
    const label = (el.querySelector('.nav-item-label')?.textContent || '').toLowerCase();
    const match = label.includes(q);
    el.style.display = match ? '' : 'none';
    if (match) any = true;
  });
  // Collapsible sections: open + show only those with a visible item
  wrap.querySelectorAll('.nav-section-body').forEach(body => {
    const hasVisible = [...body.querySelectorAll('.nav-item')].some(it => it.style.display !== 'none');
    body.classList.remove('collapsed');
    body.style.maxHeight = hasVisible ? 'none' : '0';
    const hdr = body.previousElementSibling;
    if (hdr) { hdr.classList.remove('collapsed'); hdr.style.display = hasVisible ? '' : 'none'; }
  });
  // First (non-collapsible) section header: its items are direct siblings
  const firstHdr = wrap.querySelector('.nav-section');
  if (firstHdr) {
    let anyFirst = false, n = firstHdr.nextElementSibling;
    while (n && n.classList.contains('nav-item')) { if (n.style.display !== 'none') anyFirst = true; n = n.nextElementSibling; }
    firstHdr.style.display = anyFirst ? '' : 'none';
  }
  if (nores) nores.style.display = any ? 'none' : '';
}

function navSearchKey(e) {
  if (e.key === 'Escape') { e.target.value = ''; filterNav(''); e.target.blur(); }
  else if (e.key === 'Enter') {
    const first = [...document.querySelectorAll('#sidebar-nav .nav-item')].find(el => el.style.display !== 'none');
    if (first) { e.target.value = ''; filterNav(''); navigate(first.id.replace('nav-', '')); }
  }
}

// Live sidebar badge counts (#6). Replaces the static "!" with real numbers
// from /api/nav-badges for internal-ops roles; a zero count clears the badge.
async function updateNavBadges(force) {
  if (!APP.user) return;
  const internalNavs = ['platform','ops','procurement','warehouse','delivery','delivery_exec','finance'];
  if (!internalNavs.includes(APP.user.nav)) return;
  const now = Date.now();
  if (!force && APP._navBadgesAt && now - APP._navBadgesAt < 25000) { applyNavBadges(); return; }
  APP._navBadgesAt = now;
  const counts = await api('/nav-badges').catch(() => null);
  if (!counts) return;
  APP._navBadges = counts;
  applyNavBadges();
}
function applyNavBadges() {
  const counts = APP._navBadges; if (!counts) return;
  Object.keys(counts).forEach(id => {
    const item = document.getElementById('nav-' + id);
    if (!item) return;
    const num = Number(counts[id]) || 0;
    let badge = item.querySelector('.nav-item-badge');
    if (num > 0) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'nav-item-badge'; badge.setAttribute('aria-hidden', 'true'); item.appendChild(badge); }
      badge.textContent = num > 99 ? '99+' : String(num);
    } else if (badge) {
      badge.remove();
    }
  });
}

function toggleNavSection(label) {
  navPrefLoad();
  // Clicking the open section closes it; clicking any other opens it and
  // collapses the rest (accordion — one group open at a time).
  applyAccordion(APP._navOpen === label ? null : label);
}

// Ensure the section holding the active page is the open one, and reveal it
function revealActiveNavItem(page) {
  const navEl = document.getElementById('nav-' + page);
  if (!navEl) return;
  const body = navEl.closest('.nav-section-body');
  if (body) {
    const label = (body.previousElementSibling?.querySelector('.nav-section-label')?.textContent || '').trim();
    if (label && label !== APP._navOpen) applyAccordion(label);
  }
  if (!document.getElementById('sidebar')?.classList.contains('collapsed'))
    navEl.scrollIntoView({ block: 'nearest' });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    overlay?.classList.toggle('show');
  } else {
    collapseSidebar();
  }
}

// Desktop icon-rail toggle, persisted
function collapseSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const rail = sidebar.classList.toggle('collapsed');
  try { localStorage.setItem('sp_nav_rail', rail ? '1' : '0'); } catch {}
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
}

// ── Navigate ───────────────────────────────────────────────
const PAGE_MAP = {
  dashboard: 'renderDashboard',
  place_order: 'renderPlaceOrder',
  my_orders: 'renderMyOrders',
  track_delivery: 'renderTrackDelivery',
  orders: 'renderOrderQueue',
  dc_billing: 'renderDCBilling',
  inventory: 'renderInventory',
  vendors: 'renderVendors',
  procurement: 'renderProcurement',
  warehouse: 'renderWarehouse',
  delivery: 'renderDeliveriesHub',
  clients: 'renderClients',
  service_desk: 'renderServiceDesk',
  reports: 'renderReports',
  exec_bi: 'renderExecBI',
  client_reports: 'renderClientReports',
  approvals: 'renderApprovals',
  users: 'renderUsers',
  settings: 'renderSettings',
  vendor_pos: 'renderVendorPOs',
  vendor_invoices: 'renderVendorInvoices',
  vendor_payments: 'renderVendorPayments',
  delivery_routes: 'renderDeliveryRoutes',
  dunning: 'renderDunning',
  import_data: 'renderImportData',
  templates: 'renderTemplates',
  sla_dashboard: 'renderSLADashboard',
  approval_chains: 'renderApprovalChains',
  fulfilment: 'renderFulfilment',
  staff: 'renderStaff',
  porter_expenses: 'renderPorterExpenses',
  todays_schedule: 'renderTodaysSchedule',
  delivery_calendar: 'renderDeliveryCalendar',
  consolidated_orders: 'renderConsolidatedOrders',
  consolidated_report: 'renderConsolidatedReport',
  consolidated_due: 'renderConsolidatedDue',
  client_budget: 'renderClientBudget',
  client_consumption: 'renderClientConsumption',
  my_inventory: 'renderMyInventory',
  orders_inventory: 'renderOrdersInventory',
  alerts: 'renderAlerts',
  pipeline: 'renderPipeline',
  next_actions: 'renderNextActions',
  over_delivery_audit: 'renderOverDeliveryAudit',
  zones: 'renderZonesPage',
};

function navigate(page) {
  // ACL guard: never render a page outside the current role's navigation.
  if (!canAccessPage(page)) { showToast('That section is not available for your role', 'info'); page = getDefaultPage(); }
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  APP.charts = {};
  APP.page = page;
  // Remember the current page so a browser reload returns here, not the dashboard.
  try { localStorage.setItem('sp_page', page); } catch (_) {}

  document.querySelectorAll('.nav-item').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
  const navEl = document.getElementById('nav-' + page);
  if (navEl) { navEl.classList.add('active'); navEl.setAttribute('aria-current', 'page'); revealActiveNavItem(page); }

  document.getElementById('breadcrumb').textContent =
    (NAV[APP.user.nav] || []).find(i => i.id === page)?.label || page.replace(/_/g,' ');

  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

  // PAGE_MAP holds render-function names (not references) so the map can be built
  // in core before those functions load from later split files; resolve at nav time.
  const fn = window[PAGE_MAP[page]];
  if (typeof fn === 'function') fn(main);
  else main.innerHTML = notImplemented(page);

  ensureClientFAB();
  closeMobileSidebar();
  updateNavBadges(); // keep counts fresh as staff work (throttled to ~25s)
}

/* ── Persistent quick-action FAB (client roles) ───────────── */
function ensureClientFAB() {
  const isClient = ['client','client_user','approver'].includes(APP.user?.nav);
  let fab = document.getElementById('client-fab');
  // The order page has its own cart bar + action buttons; the floating FAB would
  // overlap them, so hide it there.
  if (!isClient || APP.page === 'place_order') { if (fab) fab.remove(); return; }
  if (fab) { fab.querySelector('#fab-menu').style.display='none'; fab.querySelector('#fab-main').textContent='+'; return; }

  fab = document.createElement('div');
  fab.id = 'client-fab';
  fab.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:500;display:flex;flex-direction:column;align-items:flex-end;gap:10px';
  fab.innerHTML = `
    <div id="fab-menu" style="display:none;flex-direction:column;gap:8px;align-items:flex-end">
      <button ${dataAct('fabNav', 'place_order')} style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">🛒 New Order</button>
      <button ${dataAct('fabNavCSV')} style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">📋 Upload Order Sheet</button>
      <button ${dataAct('fabNav', 'my_inventory')} style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">📉 Log Use</button>
    </div>
    <button id="fab-main" ${dataAct('toggleFAB')} title="Quick actions"
      style="width:54px;height:54px;border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:1.7rem;font-weight:400;cursor:pointer;box-shadow:0 6px 18px rgba(13,148,136,.45);display:flex;align-items:center;justify-content:center;line-height:1;transition:transform .2s">+</button>`;
  document.body.appendChild(fab);
}

function toggleFAB() {
  const menu = document.getElementById('fab-menu');
  const main = document.getElementById('fab-main');
  if (!menu || !main) return;
  const open = menu.style.display !== 'none';
  menu.style.display = open ? 'none' : 'flex';
  main.textContent = open ? '+' : '×';
  main.style.transform = open ? '' : 'rotate(90deg)';
}

// ── Notifications ──────────────────────────────────────────
async function loadNotifications() {
  const data = await api('/notifications');
  if (!data) return;
  const unread = data.filter(n => !n.read_flag).length;
  document.querySelector('.notif-badge').textContent = unread || '';
  document.querySelector('.notif-badge').style.display = unread ? '' : 'none';
  const list = document.getElementById('notif-list');
  list.innerHTML = data.map(n => `
    <div class="notif-item${n.read_flag ? '' : ' unread'}">
      <div class="notif-text">${h(n.message)}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>`).join('') || '<div style="padding:16px;text-align:center;color:var(--text-muted)">No notifications</div>';
}

function toggleNotifications() {
  document.getElementById('notif-panel').classList.toggle('hidden');
}
function closeNotifications() {
  document.getElementById('notif-panel').classList.add('hidden');
  api('/notifications/read-all', { method: 'POST' });
  document.querySelector('.notif-badge').style.display = 'none';
}

// ── Helpers ────────────────────────────────────────────────
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
function fmtNum(n) { return Number(n || 0).toLocaleString('en-IN'); }
function pct(n) { return (+(n || 0)).toFixed(1) + '%'; }

// Line icons for Control Tower KPI tiles (stroke paths, 24×24 viewBox)
const CT_ICON = {
  box:    '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert:  '<path d="M12 3l9 16H3l9-16z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6"/><path d="M9 12h6"/>',
  bars:   '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M20 20H3"/>',
  life:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M5 5l4.2 4.2M14.8 14.8L19 19M19 5l-4.2 4.2M9.2 14.8L5 19"/>',
};

// Trend delta for a KPI tile. Colour follows whether the move is good/bad for
// THAT metric (goodDir), not the raw direction. Small bases show an absolute
// change instead of a noisy percentage. Renders nothing until history exists.
function ctDelta(trends, key, goodDir) {
  const t = trends && trends[key];
  if (!t || typeof t.delta !== 'number') return '';
  const UP = '<path d="M6 15l6-6 6 6"/>', DOWN = '<path d="M6 9l6 6 6-6"/>', FLAT = '<path d="M5 12h14"/>';
  if (t.delta === 0)
    return `<div class="ct-delta flat"><svg viewBox="0 0 24 24">${FLAT}</svg>0 <span class="ct-win">vs yesterday</span></div>`;
  const dir = t.delta > 0 ? 'up' : 'down';
  const sense = dir === goodDir ? 'good' : 'bad';
  const small = Math.abs(t.prev) < 10;
  const mag = small
    ? (t.delta > 0 ? '+' : '−') + Math.abs(t.delta)
    : Math.round(Math.abs(t.delta) / t.prev * 100) + '%';
  return `<div class="ct-delta ${sense}"><svg viewBox="0 0 24 24">${dir === 'up' ? UP : DOWN}</svg>${mag} <span class="ct-win">vs yesterday</span></div>`;
}
function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.floor(m/60) + ' hr ago';
  return Math.floor(m/1440) + ' days ago';
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function statusBadge(s) {
  const map = {
    CLOSED:'success', DELIVERED:'success', RESOLVED:'success', INVOICED:'success', RECEIVED:'success',
    IN_SHIPMENT:'info', IN_TRANSIT:'info', IN_PROGRESS:'info', DISPATCHED:'info', ACCEPTED:'info', QUALITY_CHECK:'info',
    PENDING_APPROVAL:'warning', PENDING_PRICING:'warning', SENT:'warning', SCHEDULED:'warning', OPEN:'warning', READY_TO_PICK:'warning', PICKED:'warning',
    CANCELLED:'danger', REJECTED:'danger',
    SUBMITTED:'primary', APPROVED:'primary', ACKNOWLEDGED:'primary',
    VENDOR_PO_RAISED:'purple', INVENTORY_CHECK:'purple',
    DRAFT:'gold', PARTIALLY_CLOSED:'gold',
    HIGH:'danger', MEDIUM:'warning', LOW:'success',
  };
  const cls = map[s] || 'primary';
  return `<span class="badge badge-${cls}">${s.replace(/_/g,' ')}</span>`;
}

function orderTypeBadge(t) {
  const cfg = { Regular:{cls:'info',label:'Regular'}, Urgent:{cls:'danger',label:'Urgent'}, 'Ad-Hoc':{cls:'gold',label:'Ad-Hoc'} };
  const c = cfg[t] || cfg.Regular;
  return `<span class="badge badge-${c.cls}" style="font-size:.68rem">${c.label}</span>`;
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', bottom:'24px', right:'24px', zIndex:9999,
    background: type==='error' ? '#dc2626' : type==='info' ? '#3b82f6' : type==='warning' ? '#d97706' : 'var(--navy)', color:'#fff',
    padding:'12px 20px', borderRadius:'8px', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.2)',
    animation:'slideUp .2s ease' });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ---- Modal manager: focus trap, ESC/backdrop close, focus restore, ARIA ----
let _modalPrevFocus = null;
function _modalFocusables() {
  const m = document.getElementById('modal');
  if (!m) return [];
  return [...m.querySelectorAll('a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter(el => el.offsetParent !== null);
}
function _modalKeydown(e) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  if (e.key === 'Escape') { e.preventDefault(); requestCloseModal(); return; }
  if (e.key === 'Tab') {
    const f = _modalFocusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
// ESC / backdrop go through here so an in-progress wizard isn't dismissed by
// accident (which would discard unsaved input). Explicit Cancel/Close buttons
// still call closeModal() directly.
function requestCloseModal() {
  if (typeof APP !== 'undefined' && APP && APP._vw) return;
  closeModal();
}
function openModal(title, body, footer = '') {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  if (overlay.classList.contains('hidden')) _modalPrevFocus = document.activeElement;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'modal-title');
  modal.tabIndex = -1;
  overlay.classList.remove('hidden');
  overlay.onclick = e => { if (e.target === overlay) requestCloseModal(); };
  document.removeEventListener('keydown', _modalKeydown, true);
  document.addEventListener('keydown', _modalKeydown, true);
  setTimeout(() => { const f = _modalFocusables(); (f[0] || modal).focus(); }, 0);
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.onclick = null;
  document.removeEventListener('keydown', _modalKeydown, true);
  if (_modalPrevFocus && typeof _modalPrevFocus.focus === 'function') {
    try { _modalPrevFocus.focus(); } catch { /* element gone */ }
  }
  _modalPrevFocus = null;
}

// Record registry + id resolvers. Buttons carry a system-generated id (quote-free)
// instead of a whole record serialized into the onclick attribute — smaller DOM
// and no attribute-escaping fragility. Records are registered inline at render time.
function _regVendor(v) { (APP._vendorById || (APP._vendorById = {}))[v.id] = v; return v.id; }
function _regClient(c) { (APP._clientById || (APP._clientById = {}))[c.id] = c; return c.id; }
function viewVendorById(id) { const v = APP._vendorById && APP._vendorById[id]; if (v) viewVendorModal(v); }
function editVendorById(id) { const v = APP._vendorById && APP._vendorById[id]; if (v) editVendorModal(v); }
function viewClientById(id) { const c = APP._clientById && APP._clientById[id]; if (c) viewClientModal(c); }
function editClientById(id) { const c = APP._clientById && APP._clientById[id]; if (c) editClientModal(c); }

// ---- Event delegation (replaces inline onclick, step toward a strict CSP) ----
// Markup carries data-act="fnName" and data-args="<json array>"; a single document
// listener resolves the global function and calls it with the decoded args. The
// dataAct() helper JSON-encodes args and HTML-escapes them (so names with quotes/
// apostrophes are safe), returning the attribute pair to drop into a tag.
function dataAct(fn, ...args) {
  return `data-act="${fn}"${args.length ? ` data-args="${h(JSON.stringify(args))}"` : ''}`;
}
// Variant for handlers whose original inline form passed `this` (the clicked
// element) as the last argument, e.g. a tab switcher called with (key, this).
function dataActEl(fn, ...args) {
  return `${dataAct(fn, ...args)} data-el`;
}
// Variant for the common "close the modal, then run fn" pattern.
function dataActClose(fn, ...args) {
  return `${dataAct(fn, ...args)} data-close`;
}
function _dispatchAct(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = window[el.dataset.act];
  if (typeof fn !== 'function') return;
  if (el.hasAttribute('data-prevent')) e.preventDefault();
  if (el.hasAttribute('data-stop')) e.stopPropagation();
  if (el.hasAttribute('data-close')) closeModal(); // matches inline "closeModal();fn()"
  if (el.hasAttribute('data-tbclose')) closeTbMenus(); // matches "closeTbMenus();fn()"
  let args = [];
  if (el.dataset.args) { try { args = JSON.parse(el.dataset.args); } catch { /* ignore */ } }
  if (el.hasAttribute('data-el')) fn(...args, el); // pass the element as the trailing arg
  else fn(...args);
}
document.addEventListener('click', _dispatchAct);
// Keyboard activation for the sidebar rows (role="button" divs): Enter/Space
// trigger the same navigation as a click, so the menu is keyboard-operable.
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target;
  if (el && el.classList && el.classList.contains('nav-item') && el.hasAttribute('data-act')) {
    e.preventDefault();
    _dispatchAct(e);
  }
});

// change / input / keydown delegation — same data-args convention as click, with
// optional data-val (pass the element's value) and data-el (pass the element).
function _runData(el, attr) {
  const fn = window[el.getAttribute(attr)];
  if (typeof fn !== 'function') return;
  let args = [];
  if (el.dataset.args) { try { args = JSON.parse(el.dataset.args); } catch { /* ignore */ } }
  if (el.hasAttribute('data-val')) args.push(el.value);
  if (el.hasAttribute('data-el')) args.push(el);
  fn(...args);
}
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el) _runData(el, 'data-change'); });
document.addEventListener('input',  e => { const el = e.target.closest('[data-input]');  if (el) _runData(el, 'data-input'); });
document.addEventListener('keydown', e => {
  const kEl = e.target.closest('[data-keydown]');
  if (kEl) { const fn = window[kEl.getAttribute('data-keydown')]; if (typeof fn === 'function') fn(e); }
  if (e.key === 'Enter') { const el = e.target.closest('[data-enter]'); if (el) _runData(el, 'data-enter'); }
});
function dataChange(fn, ...args) { return `data-change="${fn}"${args.length ? ` data-args="${h(JSON.stringify(args))}"` : ''}`; }
function dataInput(fn, ...args)  { return `data-input="${fn}"${args.length ? ` data-args="${h(JSON.stringify(args))}"` : ''}`; }
function dataChangeVal(fn, ...args) { return `${dataChange(fn, ...args)} data-val`; }
function dataInputVal(fn, ...args)  { return `${dataInput(fn, ...args)} data-val`; }
function dataInputEl(fn, ...args)   { return `${dataInput(fn, ...args)} data-el`; }
function dataEnter(fn, ...args)  { return `data-enter="${fn}"${args.length ? ` data-args="${h(JSON.stringify(args))}"` : ''}`; }
function dataBlur(fn, ...args)   { return `data-blur="${fn}"${args.length ? ` data-args="${h(JSON.stringify(args))}"` : ''}`; }
// focusin/focusout bubble (focus/blur don't), so they can be delegated.
document.addEventListener('focusin', e => {
  const el = e.target;
  if (el.matches && el.matches('[data-selectall]')) el.select();
  const f = el.closest && el.closest('[data-focusact]'); if (f) _runData(f, 'data-focusact');
});
document.addEventListener('focusout', e => { const el = e.target.closest && e.target.closest('[data-blur]'); if (el) _runData(el, 'data-blur'); });
function dataChangeEl(fn, ...args) { return `${dataChange(fn, ...args)} data-el`; }
function dataEnterEl(fn, ...args)  { return `${dataEnter(fn, ...args)} data-el`; }
// data-el appends the element as the LAST argument, so these take (…args, el).
function _blurEl(el) { el.blur(); }
function maskUpper(max, el) { el.value = el.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, max); }
function maskDigits(max, el) { el.value = el.value.replace(/[^0-9]/g, '').slice(0, max || 9999); }
function toggle2FAEl(id, el) { toggle2FA(id, el.checked); }
function previewCSVEl(tab, el) { previewCSV(el, tab); }
function onScanCapturedEl(dcId, el) { onScanCaptured(el, dcId); }
function toggleDisabledByValue(id, el) { const b = document.getElementById(id); if (b) b.disabled = !el.value; }
function vendorToggleInactive(el) { APP._vendorShowInactive = el.checked; renderVendors(document.getElementById('main-content')); }
function vendorSetCat(el) { APP._vendorCat = el.value; renderVendors(document.getElementById('main-content')); }
function sdSetClientFilter(el) { APP._sdClientFilter = el.value; navigate('service_desk'); }
function moSearch(el) { APP._moSearch = el.value; moRender(); }
function invSearch(el) { APP._invSearch = el.value.toLowerCase(); APP._invShowAll = false; refreshInvTable(); }
function colorByOrdered(el) { el.style.color = +el.value < +el.dataset.ordered ? 'var(--warning)' : 'inherit'; }
function clampDeliver(max, el) { if (+el.value > max) el.value = max; el.style.color = +el.value < max ? 'var(--warning)' : 'inherit'; }
function clampMax(max, el) { if (+el.value > max) el.value = max; }

// Named handlers extracted from former multi-statement inline onclick bodies, so
// they can be invoked through the delegation dispatcher like any other action.
function _noop() {}
function oqGoto(status) { switchOQMainTab('orders'); switchOQTab(status); }
function moGoTab(t) { APP._moTab = t; moRender(); }
function fabNav(page) { toggleFAB(); navigate(page); }
function fabNavCSV() { toggleFAB(); navigate('place_order'); setTimeout(() => showCSVUploadModal(), 400); }
function invFilterStatus(v, tab) {
  const el = document.getElementById('inv-filter-status');
  if (el) el.value = v;
  filterMyInventoryTable();
  if (tab) switchMyInvTab(tab);
}
function reviewPlaceOrder() { APP._postNavStep = 'review'; navigate('place_order'); }
function sdClearClientFilter() { APP._sdClientFilter = ''; navigate('service_desk'); }
function clearCartToCatalogue() { APP.cart = []; persistCart(); switchOrderStep('catalogue'); showToast('Cart cleared'); }
function stopVoiceAndClose() { stopVoiceIfRecording(); closeModal(); }
function goCriticalStockReport() { navigate('reports'); setTimeout(() => viewReport('critical-stock'), 300); }
function hideEl(id) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
function clickEl(id) { const e = document.getElementById(id); if (e) e.click(); }
function scrollToEl(id) { const e = document.getElementById(id); if (e) e.scrollIntoView({ behavior: 'smooth' }); }
function toggleParentOpen(el) { el.parentElement.classList.toggle('open'); }
function removeClosestRow(el) { const tr = el.closest('tr'); if (tr) tr.remove(); }
function printPage() { window.print(); }
function invShowAll() { APP._invShowAll = true; refreshInvTable(); }
function goImportVendors() { APP._importDefaultTab = 'vendors'; navigate('import_data'); }
function copyText(text) { navigator.clipboard.writeText(text).then(() => showToast('Copied')); }
function moGoTabPill(s, el) { APP._moTab = s; document.querySelectorAll('.mo-pill').forEach(b => b.classList.remove('active')); if (el) el.classList.add('active'); moRender(); }
function moGoTabByStatus(s) { APP._moTab = s; document.querySelectorAll('.mo-pill').forEach(b => b.classList.remove('active')); const pill = document.querySelector('.mo-pill[data-s="' + s + '"]'); if (pill) pill.classList.add('active'); moRender(); }
function whGoTab(tab) { const btns = document.querySelectorAll('#wh-tabs .tab-btn'); const idx = ['overview', 'grn', 'bins', 'picklist', 'transfers'].indexOf(tab); switchWHTab(tab, btns[idx]); }
function quickNav(page) { closeTbMenus(); navigate(page); }
function quickNavCSV() { closeTbMenus(); navigate('place_order'); setTimeout(() => showCSVUploadModal(), 400); }
function clearVendorSearch() {
  APP._vendorSearch = ''; APP._vendorCat = ''; APP._vendorLoc = '';
  ['vendor-search-q', 'vendor-search-loc', 'vendor-search-cat'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  filterVendorCards();
}
function viewReportModalRange(key) { viewReport(key, document.getElementById('rpt-modal-from').value, document.getElementById('rpt-modal-to').value); }
function hideCSVThenReview() { hideEl('csv-upload-modal'); switchOrderStep('review'); }
function pddEditShow(el) { const p = document.getElementById('pdd-edit'); if (p) p.style.display = 'flex'; if (el) el.style.display = 'none'; }
function pddEditHide() { hideEl('pdd-edit'); const t = document.querySelector('[data-act="pddEditShow"]'); if (t) t.style.display = ''; }

function notImplemented(page) {
  return `<div class="empty-state">
    <div class="empty-icon">🚧</div>
    <div class="empty-title">${page.replace(/_/g,' ')} — Coming Soon</div>
    <div class="empty-desc">This module is under active development</div>
  </div>`;
}

function pageHeader(title, sub, actions = '') {
  return `<div class="page-header">
    <div class="page-header-left">
      <div class="page-title">${title}</div>
      ${sub ? `<div class="page-subtitle">${sub}</div>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;
}

/* Icon-chip stat card (Stitch reference style) */
function statCard(icon, color, bg, value, label, act = '') {
  return `<div class="card" style="padding:14px 16px;margin-bottom:0;display:flex;align-items:center;gap:12px${act?';cursor:pointer':''}" ${act||''}>
    <div style="width:42px;height:42px;border-radius:10px;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:800;flex-shrink:0">${icon}</div>
    <div style="min-width:0">
      <div style="font-size:1.35rem;font-weight:800;color:var(--navy);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px;white-space:nowrap">${label}</div>
    </div>
  </div>`;
}

function emptyState(icon, title, desc, action = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>${action}</div>`;
}


