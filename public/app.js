/* ============================================================
   Smart Pantry — Full Production SPA
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const APP = { user: null, page: 'dashboard', cart: [], charts: {}, token: null };

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

// ── Nav surfaces ───────────────────────────────────────────
const NAV = {
  platform: [
    { section:'Control Tower' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'orders',      label:'Orders',        icon:iconOrders,    badge:'!' },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
    { id:'vendors',     label:'Vendors',       icon:iconVendors,   badge:null },
    { section:'Operations' },
    { id:'procurement', label:'Procurement',   icon:iconProcure,   badge:null },
    { id:'warehouse',   label:'Warehouse',     icon:iconWarehouse, badge:null },
    { id:'delivery',    label:'Deliveries',    icon:iconDelivery,  badge:null },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
    { section:'Management' },
    { id:'clients',     label:'Clients',       icon:iconClients,   badge:null },
    { id:'service_desk',label:'Service Desk',  icon:iconDesk,      badge:null },
    { id:'reports',     label:'Reports & BI',  icon:iconReports,   badge:null },
    { section:'Admin' },
    { id:'users',       label:'Users & Roles', icon:iconUsers,     badge:null },
    { id:'settings',    label:'Settings',      icon:iconSettings,  badge:null },
  ],
  ops: [
    { section:'Operations' },
    { id:'dashboard',   label:'Control Tower', icon:iconDashboard, badge:null },
    { id:'orders',      label:'Orders',        icon:iconOrders,    badge:'!' },
    { id:'delivery',    label:'Deliveries',    icon:iconDelivery,  badge:null },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
    { id:'service_desk',label:'Service Desk',  icon:iconDesk,      badge:null },
  ],
  procurement: [
    { section:'Procurement' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'procurement', label:'Purchase Orders',icon:iconProcure,  badge:null },
    { id:'vendors',     label:'Vendors',       icon:iconVendors,   badge:null },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
  ],
  warehouse: [
    { section:'Warehouse' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'warehouse',   label:'Warehouse',     icon:iconWarehouse, badge:null },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
  ],
  delivery: [
    { section:'Delivery' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'delivery',    label:'Deliveries',    icon:iconDelivery,  badge:null },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
  ],
  delivery_exec: [
    { section:'My Deliveries' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'delivery',    label:'My Deliveries', icon:iconDelivery,  badge:null },
  ],
  finance: [
    { section:'Finance' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
    { id:'reports',     label:'Reports & BI',  icon:iconReports,   badge:null },
  ],
  client: [
    { section:'Procurement' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'place_order', label:'Place Order',   icon:iconCart,      badge:null },
    { id:'my_orders',   label:'My Orders',     icon:iconOrders,    badge:null },
    { id:'track_delivery',label:'Track Delivery',icon:iconDelivery,badge:null },
    { id:'approvals',   label:'Approvals',     icon:iconApprove,   badge:null },
    { section:'Support' },
    { id:'service_desk',label:'Service Desk',  icon:iconDesk,      badge:null },
  ],
  approver: [
    { section:'Approvals' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'approvals',   label:'Pending Approvals',icon:iconApprove,badge:'!' },
    { id:'my_orders',   label:'All Orders',    icon:iconOrders,    badge:null },
  ],
  client_user: [
    { section:'Orders' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'place_order', label:'Place Order',   icon:iconCart,      badge:null },
    { id:'my_orders',   label:'My Orders',     icon:iconOrders,    badge:null },
    { id:'track_delivery',label:'Track Delivery',icon:iconDelivery,badge:null },
  ],
  vendor: [
    { section:'Vendor Portal' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'vendor_pos',  label:'Purchase Orders',icon:iconProcure,  badge:'!' },
    { id:'vendor_invoices',label:'Invoices',   icon:iconBilling,   badge:null },
    { id:'vendor_payments',label:'Payments',   icon:iconReports,   badge:null },
  ],
  vendor_user: [
    { section:'Vendor Portal' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'vendor_pos',  label:'Purchase Orders',icon:iconProcure,  badge:null },
  ],
};

// ── Demo role → email map ──────────────────────────────────
const ROLE_EMAILS = {
  super_admin: 'admin@4syz.com',
  ops_admin: 'ops@4syz.com',
  procurement_manager: 'procurement@4syz.com',
  warehouse_exec: 'warehouse@4syz.com',
  delivery_manager: 'delivery.mgr@4syz.com',
  delivery_exec: 'delivery@4syz.com',
  finance_admin: 'finance@4syz.com',
  client_admin: 'client.admin@meta.com',
  client_approver: 'approver@meta.com',
  client_user: 'user@meta.com',
  vendor_admin: 'vendor.admin@freshfarms.com',
  vendor_user: 'vendor@freshfarms.com',
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
async function doLogin() {
  const role = document.getElementById('demo-role').value;
  const email = ROLE_EMAILS[role] || document.getElementById('login-email').value;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';

  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'password' }),
  }).catch(() => null);

  btn.disabled = false;
  btn.querySelector('span').textContent = 'Sign In';

  if (!data) {
    showToast('Login failed — make sure the DB is seeded', 'error');
    return;
  }

  APP.token = data.token;
  APP.user = { ...data.user, nav: ROLES[data.user.role]?.nav || 'platform' };
  localStorage.setItem('sp_token', data.token);
  initApp();
}

function doLogout() {
  APP.token = null;
  APP.user = null;
  APP.cart = [];
  localStorage.removeItem('sp_token');
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  APP.charts = {};
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

// ── App init ───────────────────────────────────────────────
function initApp() {
  const u = APP.user;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = u.name;
  document.getElementById('user-role').textContent = u.org;
  document.getElementById('user-avatar').textContent = u.initials;
  document.getElementById('topbar-avatar').textContent = u.initials;
  buildNav();
  navigate(getDefaultPage());
  loadNotifications();
}

function getDefaultPage() {
  const nav = APP.user.nav;
  if (nav === 'vendor' || nav === 'vendor_user') return 'dashboard';
  if (nav === 'client_user') return 'place_order';
  return 'dashboard';
}

// ── Sidebar nav ────────────────────────────────────────────
function buildNav() {
  const nav = APP.user.nav;
  const items = NAV[nav] || NAV.platform;
  document.getElementById('sidebar-nav').innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item" id="nav-${item.id}" onclick="navigate('${item.id}')">
      <span class="nav-icon">${item.icon(16)}</span>
      <span class="nav-label">${item.label}</span>
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </div>`;
  }).join('');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Navigate ───────────────────────────────────────────────
const PAGE_MAP = {
  dashboard: renderDashboard,
  place_order: renderPlaceOrder,
  my_orders: renderMyOrders,
  track_delivery: renderTrackDelivery,
  orders: renderOrderQueue,
  dc_billing: renderDCBilling,
  inventory: renderInventory,
  vendors: renderVendors,
  procurement: renderProcurement,
  warehouse: renderWarehouse,
  delivery: renderDelivery,
  clients: renderClients,
  service_desk: renderServiceDesk,
  reports: renderReports,
  approvals: renderApprovals,
  users: renderUsers,
  settings: renderSettings,
  vendor_pos: renderVendorPOs,
  vendor_invoices: renderVendorInvoices,
  vendor_payments: renderVendorPayments,
};

function navigate(page) {
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  APP.charts = {};
  APP.page = page;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  document.getElementById('breadcrumb').textContent =
    (NAV[APP.user.nav] || []).find(i => i.id === page)?.label || page.replace(/_/g,' ');

  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

  const fn = PAGE_MAP[page];
  if (fn) fn(main);
  else main.innerHTML = notImplemented(page);
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
      <div class="notif-text">${n.message}</div>
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
function pct(n) { return (+(n || 0)).toFixed(1) + '%'; }
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
    IN_SHIPMENT:'info', IN_TRANSIT:'info', IN_PROGRESS:'info', DISPATCHED:'info', ACCEPTED:'info',
    PENDING_APPROVAL:'warning', SENT:'warning', SCHEDULED:'warning', OPEN:'warning', READY_TO_PICK:'warning',
    CANCELLED:'danger', REJECTED:'danger',
    SUBMITTED:'primary', APPROVED:'primary', ACKNOWLEDGED:'primary',
    VENDOR_PO_RAISED:'purple', INVENTORY_CHECK:'purple',
    DRAFT:'gold', PARTIALLY_CLOSED:'gold',
    HIGH:'danger', MEDIUM:'warning', LOW:'success',
  };
  const cls = map[s] || 'primary';
  return `<span class="badge badge-${cls}">${s.replace(/_/g,' ')}</span>`;
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  Object.assign(t.style, { position:'fixed', bottom:'24px', right:'24px', zIndex:9999,
    background: type==='error' ? '#dc2626' : 'var(--navy)', color:'#fff',
    padding:'12px 20px', borderRadius:'8px', fontSize:'.875rem', boxShadow:'0 4px 16px rgba(0,0,0,.2)',
    animation:'slideUp .2s ease' });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function openModal(title, body, footer = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

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

function emptyState(icon, title, desc, action = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div>
    <div class="empty-title">${title}</div>
    <div class="empty-desc">${desc}</div>${action}</div>`;
}

// ── Icons ──────────────────────────────────────────────────
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


/* ============================================================
   DASHBOARD (role-aware)
   ============================================================ */
async function renderDashboard(el) {
  const nav = APP.user.nav;
  if (nav==='client'||nav==='client_user'||nav==='approver') { renderClientDashboard(el); return; }
  if (nav==='vendor'||nav==='vendor_user') { renderVendorDashboard(el); return; }
  renderOpsDashboard(el);
}

async function renderClientDashboard(el) {
  const data = await api('/dashboard');
  if (!data) return;
  const { client, recentOrders, totalSpend, pendingApproval } = data;
  const budget = client?.monthly_budget || 500000;
  const spent  = client?.spent_this_month || totalSpend || 0;
  const pctSpent = Math.min(100, Math.round((spent / budget) * 100));
  const health = client?.health_score || 85;

  el.innerHTML = `
  ${pageHeader('Client Dashboard', client?.name || 'My Organization',
    `<button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>`)}
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">Health Score</div>
      <div class="kpi-value" style="color:var(--success)">${health}/100</div>
      <div class="kpi-sub">Service quality rating</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('approvals')">
      <div class="kpi-label">Pending Approvals</div>
      <div class="kpi-value${pendingApproval>0?' kpi-warning':''}">${pendingApproval}</div>
      <div class="kpi-sub">Orders awaiting approval</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Monthly Spend</div>
      <div class="kpi-value">${fmt(spent)}</div>
      <div class="kpi-sub">Budget: ${fmt(budget)}</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('my_orders')">
      <div class="kpi-label">Total Orders</div>
      <div class="kpi-value">${recentOrders?.length || 0}</div>
      <div class="kpi-sub">This month</div>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>Budget Utilization</span><span>${pctSpent}%</span></div>
    <div class="card-body">
      <div class="progress-bar" style="height:12px;border-radius:6px;background:var(--border);overflow:hidden">
        <div style="height:100%;width:${pctSpent}%;background:${pctSpent>90?'var(--danger)':pctSpent>70?'var(--warning)':'var(--success)'};border-radius:6px;transition:width .5s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:.8rem;color:var(--text-muted)">
        <span>Spent: ${fmt(spent)}</span><span>Remaining: ${fmt(budget-spent)}</span>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>Recent Orders</span>
      <button class="btn btn-secondary btn-sm" onclick="navigate('my_orders')">View All</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>${(recentOrders||[]).map(o=>`<tr>
          <td><b>${o.id}</b></td>
          <td>${fmt(o.grand_total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No orders yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function renderOpsDashboard(el) {
  const data = await api('/dashboard');
  if (!data) return;
  const { totalOrders, pendingOrders, lowStock, pendingDCBilling, openTickets, recentOrders, ordersByStatus, topClients } = data;

  el.innerHTML = `
  ${pageHeader('Control Tower', 'Platform-wide operations overview')}
  <div class="kpi-row">
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('orders')">
      <div class="kpi-label">Total Orders</div>
      <div class="kpi-value">${totalOrders||0}</div>
      <div class="kpi-sub">${pendingOrders||0} active</div>
    </div>
    <div class="kpi-card${lowStock>0?' kpi-warning':''}" style="cursor:pointer" onclick="navigate('inventory')">
      <div class="kpi-label">Low Stock SKUs</div>
      <div class="kpi-value${lowStock>0?' kpi-warning':''}">${lowStock||0}</div>
      <div class="kpi-sub">Need reorder</div>
    </div>
    <div class="kpi-card${pendingDCBilling>0?' kpi-warning':''}" style="cursor:pointer" onclick="navigate('dc_billing')">
      <div class="kpi-label">Pending Billing</div>
      <div class="kpi-value${pendingDCBilling>0?' kpi-warning':''}">${pendingDCBilling||0}</div>
      <div class="kpi-sub">DCs unbilled</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('service_desk')">
      <div class="kpi-label">Open Tickets</div>
      <div class="kpi-value">${openTickets||0}</div>
      <div class="kpi-sub">Service desk</div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span>Orders by Status</span></div>
      <div class="card-body"><canvas id="statusChart" height="200"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Top Clients by Spend</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Orders</th><th>Spend</th></tr></thead>
          <tbody>${(topClients||[]).map(c=>`<tr>
            <td><b>${c.name}</b></td>
            <td>${c.order_count}</td>
            <td>${fmt(c.total)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span>Recent Orders</span>
      <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">View All</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr></thead>
        <tbody>${(recentOrders||[]).map(o=>`<tr>
          <td><b>${o.id}</b></td>
          <td>${o.client_name||'—'}</td>
          <td>${fmt(o.grand_total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
  </div>`;

  // Chart
  const byStatus = {};
  (ordersByStatus||[]).forEach(r => { byStatus[r.status] = r.cnt; });
  const labels = ['SUBMITTED','APPROVED','IN_SHIPMENT','CLOSED','CANCELLED'];
  const counts = labels.map(l => byStatus[l]||0);
  const ctx = document.getElementById('statusChart');
  if (ctx) {
    APP.charts.status = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ data: counts, backgroundColor: ['#3b82f6','#1f8a5b','#f97316','#6b7280','#dc2626'], borderRadius: 4 }] },
      options: { plugins:{ legend:{display:false} }, scales:{ x:{grid:{display:false}}, y:{beginAtZero:true,ticks:{precision:0}} } }
    });
  }
}

async function renderVendorDashboard(el) {
  const data = await api('/dashboard');
  if (!data) return;
  const { vendor, pendingPOs } = data;

  el.innerHTML = `
  ${pageHeader('Vendor Dashboard', vendor?.name || 'Vendor Portal')}
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-label">On-time Rate</div>
      <div class="kpi-value" style="color:var(--success)">${pct(vendor?.on_time_rate||0)}</div>
      <div class="kpi-sub">Last 90 days</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Fill Rate</div>
      <div class="kpi-value">${pct(vendor?.fill_rate||0)}</div>
      <div class="kpi-sub">Order completeness</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Lead Time</div>
      <div class="kpi-value">${vendor?.avg_lead_days||0}d</div>
      <div class="kpi-sub">Days to deliver</div>
    </div>
    <div class="kpi-card kpi-warning" style="cursor:pointer" onclick="navigate('vendor_pos')">
      <div class="kpi-label">Pending POs</div>
      <div class="kpi-value kpi-warning">${(pendingPOs||[]).length}</div>
      <div class="kpi-sub">Awaiting action</div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>Pending Purchase Orders</span>
      <button class="btn btn-secondary btn-sm" onclick="navigate('vendor_pos')">View All</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>PO #</th><th>Amount</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${(pendingPOs||[]).map(po=>`<tr>
          <td><b>${po.id}</b></td>
          <td>${fmt(po.grand_total)}</td>
          <td>${fmtDate(po.expected_delivery)}</td>
          <td>${statusBadge(po.status)}</td>
          <td>${poActions(po)}</td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No pending POs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function poActions(po) {
  if (po.status === 'SENT') return `
    <button class="btn btn-primary btn-sm" onclick="acceptPO('${po.id}')">Accept</button>
    <button class="btn btn-danger btn-sm" onclick="rejectPO('${po.id}')">Reject</button>`;
  if (po.status === 'ACCEPTED') return `
    <button class="btn btn-gold btn-sm" onclick="dispatchPO('${po.id}')">Mark Dispatched</button>`;
  if (po.status === 'DISPATCHED') return `
    <button class="btn btn-secondary btn-sm" onclick="uploadInvoice('${po.id}')">Upload Invoice</button>`;
  return `<span style="color:var(--text-muted);font-size:.8rem">${po.status}</span>`;
}


/* ============================================================
   PLACE ORDER — catalog + cart
   ============================================================ */
async function renderPlaceOrder(el) {
  const [inventory] = await Promise.all([api('/inventory')]);
  if (!inventory) return;

  const cats = [...new Set(inventory.map(i => i.category))];
  APP._catalog = inventory;
  APP._catFilter = 'All';

  el.innerHTML = `
  ${pageHeader('Place Order', 'Browse catalogue and add items to cart')}
  <div style="display:flex;gap:16px;align-items:flex-start">
    <div style="flex:1;min-width:0">
      <div class="tab-pills" style="margin-bottom:16px">
        ${['All',...cats].map(c=>`<button class="tab-pill${c==='All'?' active':''}" onclick="filterCatalog('${c}',this)">${c}</button>`).join('')}
      </div>
      <div id="catalog-grid" class="catalog-grid">${renderCatalogItems(inventory)}</div>
    </div>
    <div class="cart-panel" id="cart-panel">
      <div class="cart-header">
        <div class="cart-title">${iconCart(16)} Cart</div>
        <span class="cart-count" id="cart-count">0 items</span>
      </div>
      <div class="cart-items" id="cart-items">
        <div class="empty-cart">Add items from the catalogue</div>
      </div>
      <div class="cart-totals" id="cart-totals" style="display:none">
        <div class="cart-row"><span>Subtotal</span><span id="cart-sub">₹0</span></div>
        <div class="cart-row"><span>GST (18%)</span><span id="cart-gst">₹0</span></div>
        <div class="cart-row cart-total"><span>Total</span><span id="cart-grand">₹0</span></div>
        <div id="approval-hint" class="alert alert-warning" style="display:none;margin-top:8px;font-size:.8rem">
          ⚠️ Amount exceeds ₹1L — approval required
        </div>
        <button class="btn btn-gold" style="width:100%;margin-top:12px" onclick="submitOrder()">
          ${iconCheck(14)} Place Order
        </button>
      </div>
    </div>
  </div>`;
  refreshCartUI();
}

function renderCatalogItems(items) {
  if (!items.length) return `<div style="padding:32px;text-align:center;color:var(--text-muted)">No items in this category</div>`;
  return items.map(item => {
    const inCart = APP.cart.find(c => c.sku === item.sku);
    const qty = inCart ? inCart.qty : 0;
    return `<div class="catalog-card">
      <div class="catalog-emoji">${item.emoji||'📦'}</div>
      <div class="catalog-name">${item.name}</div>
      <div class="catalog-cat">${item.category}</div>
      <div class="catalog-price">${fmt(item.unit_price)}</div>
      <div class="catalog-stock ${item.stock<=item.reorder_level?'text-danger':''}">Stock: ${item.stock}</div>
      <div class="catalog-qty">
        <button class="qty-btn" onclick="changeQty('${item.sku}',-1,${item.unit_price},this)">−</button>
        <span class="qty-val" id="qty-${item.sku}" data-name="${item.name.replace(/"/g,'&quot;')}">${qty}</span>
        <button class="qty-btn" onclick="changeQty('${item.sku}',1,${item.unit_price},this)">+</button>
      </div>
    </div>`;
  }).join('');
}

function filterCatalog(cat, btn) {
  APP._catFilter = cat;
  document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const items = cat === 'All' ? APP._catalog : APP._catalog.filter(i => i.category === cat);
  document.getElementById('catalog-grid').innerHTML = renderCatalogItems(items);
}

function changeQty(sku, delta, price, btnOrName) {
  const name = typeof btnOrName === 'string' ? btnOrName :
    (btnOrName.closest('.catalog-qty')?.querySelector('.qty-val')?.dataset.name || sku);
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) {
    existing.qty = Math.max(0, existing.qty + delta);
    if (existing.qty === 0) APP.cart = APP.cart.filter(c => c.sku !== sku);
  } else if (delta > 0) {
    APP.cart.push({ sku, name, qty: 1, unit_price: price });
  }
  const qtyEl = document.getElementById('qty-' + sku);
  if (qtyEl) qtyEl.textContent = APP.cart.find(c => c.sku === sku)?.qty || 0;
  refreshCartUI();
}

function refreshCartUI() {
  const countEl = document.getElementById('cart-count');
  const itemsEl = document.getElementById('cart-items');
  const totalsEl = document.getElementById('cart-totals');
  if (!countEl) return;

  const total = APP.cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const gst = Math.round(total * 0.18);
  const grand = total + gst;
  const count = APP.cart.reduce((s, i) => s + i.qty, 0);

  countEl.textContent = count + ' item' + (count !== 1 ? 's' : '');

  if (!APP.cart.length) {
    itemsEl.innerHTML = '<div class="empty-cart">Add items from the catalogue</div>';
    totalsEl.style.display = 'none';
    return;
  }

  itemsEl.innerHTML = APP.cart.map(i => `
    <div class="cart-item">
      <div class="cart-item-name">${i.name}</div>
      <div class="cart-item-row">
        <div class="catalog-qty" style="margin:0">
          <button class="qty-btn" onclick="changeQty('${i.sku}',-1,${i.unit_price},this)">−</button>
          <span class="qty-val" data-name="${i.name.replace(/"/g,'&quot;')}">${i.qty}</span>
          <button class="qty-btn" onclick="changeQty('${i.sku}',1,${i.unit_price},this)">+</button>
        </div>
        <span style="font-weight:600">${fmt(i.qty * i.unit_price)}</span>
      </div>
    </div>`).join('');

  document.getElementById('cart-sub').textContent = fmt(total);
  document.getElementById('cart-gst').textContent = fmt(gst);
  document.getElementById('cart-grand').textContent = fmt(grand);
  totalsEl.style.display = '';
  const hint = document.getElementById('approval-hint');
  if (hint) hint.style.display = grand > 100000 ? '' : 'none';
}

async function submitOrder() {
  if (!APP.cart.length) { showToast('Cart is empty', 'error'); return; }
  const clients = await api('/clients');
  const clientOpts = (clients||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  openModal('Confirm Order',
    `<div style="margin-bottom:16px">
      <label style="display:block;margin-bottom:6px;font-weight:600">Select Client</label>
      <select id="order-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">${clientOpts}</select>
    </div>
    <div class="cart-row cart-total"><span>Grand Total</span><span>${fmt(APP.cart.reduce((s,i)=>s+i.qty*i.unit_price,0)*1.18)}</span></div>
    <p style="font-size:.85rem;color:var(--text-muted);margin-top:8px">${APP.cart.length} item type(s) · ${APP.cart.reduce((s,i)=>s+i.qty,0)} units</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="confirmOrder()">Confirm & Submit</button>`
  );
}

async function confirmOrder() {
  const clientId = document.getElementById('order-client')?.value;
  if (!clientId) { showToast('Select a client', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, items: APP.cart }),
  });

  closeModal();
  if (result) {
    APP.cart = [];
    showToast(`Order ${result.id} placed — ${result.status==='PENDING_APPROVAL'?'sent for approval':'submitted to 4SYZ'}`);
    navigate('my_orders');
  }
}

/* ============================================================
   MY ORDERS
   ============================================================ */
async function renderMyOrders(el) {
  const orders = await api('/orders');
  if (!orders) return;

  el.innerHTML = `
  ${pageHeader('My Orders', `${orders.length} orders`,
    `<button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${orders.length ? orders.map(o=>`<tr>
          <td><b>${o.id}</b></td>
          <td>${o.client_name||'—'}</td>
          <td>${fmt(o.grand_total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button>
            ${o.status==='DRAFT'||o.status==='SUBMITTED'?`<button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>`:''}
          </td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No orders found</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function viewOrder(id) {
  const order = await api('/orders/' + id);
  if (!order) return;
  openModal(`Order ${id}`,
    `<div style="display:grid;gap:8px;margin-bottom:16px">
      <div style="display:flex;gap:16px;flex-wrap:wrap">
        <div><b>Status:</b> ${statusBadge(order.status)}</div>
        <div><b>Client:</b> ${order.client_name||'—'}</div>
        <div><b>Date:</b> ${fmtDate(order.created_at)}</div>
      </div>
    </div>
    <b>Items</b>
    <table class="table" style="margin-top:8px">
      <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
      <tbody>${(order.items||[]).map(i=>`<tr>
        <td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.total)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="cart-row cart-total" style="margin-top:12px"><span>Grand Total</span><span>${fmt(order.grand_total)}</span></div>
    ${order.history?.length ? `<b style="display:block;margin-top:16px">Timeline</b>
    <div style="margin-top:8px;display:grid;gap:6px">
    ${order.history.map(h=>`<div style="display:flex;gap:8px;font-size:.82rem">
      <span style="color:var(--text-muted);min-width:90px">${fmtDate(h.created_at)}</span>
      <span>${statusBadge(h.to_status)}</span>
      <span style="color:var(--text-muted)">${h.actor_name||''} ${h.note?'— '+h.note:''}</span>
    </div>`).join('')}
    </div>` : ''}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  );
}

async function cancelOrder(id) {
  if (!confirm(`Cancel order ${id}?`)) return;
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note:'Cancelled by user' }) });
  if (res) { showToast(`Order ${id} cancelled`); navigate('my_orders'); }
}

/* ============================================================
   TRACK DELIVERY
   ============================================================ */
async function renderTrackDelivery(el) {
  const [dcs, orders] = await Promise.all([api('/delivery-challans'), api('/orders?status=IN_SHIPMENT')]);
  if (!dcs) return;

  const active = dcs.filter(d => d.status !== 'DELIVERED' && d.status !== 'CANCELLED');

  el.innerHTML = `
  ${pageHeader('Track Delivery', `${active.length} active shipments`)}
  ${active.length ? active.map(dc=>`
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <span><b>${dc.id}</b> — Order ${dc.order_id}</span>
      ${statusBadge(dc.status)}
    </div>
    <div class="card-body">
      <div class="timeline">
        ${['SCHEDULED','IN_TRANSIT','DELIVERED'].map((step,i)=>{
          const done = ['SCHEDULED','IN_TRANSIT','DELIVERED'].indexOf(dc.status) >= i;
          return `<div class="timeline-step ${done?'done':''}">
            <div class="timeline-dot"></div>
            <div class="timeline-label">${step.replace('_',' ')}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:24px;margin-top:12px;font-size:.84rem;color:var(--text-muted)">
        ${dc.driver_name?`<span>🚗 ${dc.driver_name}</span>`:''}
        ${dc.vehicle_no?`<span>🪪 ${dc.vehicle_no}</span>`:''}
        ${dc.dispatched_at?`<span>📅 Dispatched: ${fmtDate(dc.dispatched_at)}</span>`:''}
        <span>👤 ${dc.client_name||'—'}</span>
      </div>
    </div>
  </div>`).join('') : emptyState('🚚','No active deliveries','All deliveries are complete.')}`;
}


/* ============================================================
   ORDER QUEUE (Ops)
   ============================================================ */
async function renderOrderQueue(el) {
  const orders = await api('/orders');
  if (!orders) return;
  const active = orders.filter(o => !['CLOSED','CANCELLED'].includes(o.status));

  el.innerHTML = `
  ${pageHeader('Order Queue', `${active.length} active orders`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${orders.map(o=>`<tr>
          <td><b>${o.id}</b></td>
          <td>${o.client_name||'—'}</td>
          <td>${fmt(o.grand_total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td>${orderQueueActions(o)}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No orders</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function orderQueueActions(o) {
  const btns = [`<button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button>`];
  const next = { SUBMITTED:'ACKNOWLEDGED', APPROVED:'ACKNOWLEDGED', ACKNOWLEDGED:'INVENTORY_CHECK',
    INVENTORY_CHECK:'VENDOR_PO_RAISED', VENDOR_PO_RAISED:'READY_TO_PICK', READY_TO_PICK:'IN_SHIPMENT',
    IN_SHIPMENT:'CLOSED' };
  if (next[o.status]) {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','${next[o.status]}')">→ ${next[o.status].replace(/_/g,' ')}</button>`);
  }
  return btns.join(' ');
}

async function advanceOrder(id, to) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to }) });
  if (res) { showToast(`Order ${id} → ${to.replace(/_/g,' ')}`); navigate('orders'); }
}

/* ============================================================
   DC BILLING
   ============================================================ */
async function renderDCBilling(el) {
  const dcs = await api('/delivery-challans');
  if (!dcs) return;
  const unbilled = dcs.filter(d => d.status==='DELIVERED' && !d.billed);
  const billed   = dcs.filter(d => d.billed);

  el.innerHTML = `
  ${pageHeader('DC Billing', 'Delivery challan billing pipeline')}
  <div class="kpi-row">
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Billing</div><div class="kpi-value kpi-warning">${unbilled.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Billed Today</div><div class="kpi-value">${billed.filter(d=>d.billed_at?.startsWith(new Date().toISOString().slice(0,10))).length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total DCs</div><div class="kpi-value">${dcs.length}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span>Delivered — Pending Billing (${unbilled.length})</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Order Value</th><th>Delivered</th><th>Action</th></tr></thead>
        <tbody>${unbilled.map(dc=>`<tr>
          <td><b>${dc.id}</b></td>
          <td>${dc.order_id}</td>
          <td>${dc.client_name||'—'}</td>
          <td>${fmt(dc.order_value)}</td>
          <td>${fmtDate(dc.delivered_at||dc.dispatched_at)}</td>
          <td><button class="btn btn-gold btn-sm" onclick="billDC('${dc.id}')">Bill DC</button></td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No unbilled DCs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span>Billed DCs (${billed.length})</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Value</th><th>Billed On</th></tr></thead>
        <tbody>${billed.map(dc=>`<tr>
          <td><b>${dc.id}</b></td><td>${dc.order_id}</td>
          <td>${dc.client_name||'—'}</td>
          <td>${fmt(dc.order_value)}</td>
          <td>${fmtDate(dc.billed_at)}</td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">None yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function billDC(id) {
  openModal('Confirm DC Billing', `<p>Bill DC <b>${id}</b> and close the linked order?</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="confirmBillDC('${id}')">Confirm Billing</button>`);
}

async function confirmBillDC(id) {
  const res = await api(`/delivery-challans/${id}/bill`, { method:'POST' });
  closeModal();
  if (res) { showToast(`DC ${id} billed successfully`); navigate('dc_billing'); }
}

/* ============================================================
   INVENTORY
   ============================================================ */
async function renderInventory(el) {
  const inv = await api('/inventory');
  if (!inv) return;
  const lowStock = inv.filter(i => i.stock <= i.reorder_level);

  el.innerHTML = `
  ${pageHeader('Inventory', `${inv.length} SKUs · ${lowStock.length} low stock`,
    `<button class="btn btn-secondary" onclick="renderAddItem()">${iconPlus(14)} Add Item</button>`)}
  ${lowStock.length ? `<div class="alert alert-warning" style="margin-bottom:16px">⚠️ ${lowStock.length} SKU(s) below reorder level: ${lowStock.map(i=>i.name).join(', ')}</div>` : ''}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th>Level</th><th>Vendor</th><th>Actions</th></tr></thead>
        <tbody>${inv.map(item => {
          const pctStock = Math.round((item.stock / item.max_stock) * 100);
          const color = item.stock <= item.reorder_level ? 'var(--danger)' : item.stock <= item.reorder_level*1.5 ? 'var(--warning)' : 'var(--success)';
          return `<tr>
            <td><span style="font-size:1.2rem">${item.emoji}</span> ${item.sku}</td>
            <td><b>${item.name}</b></td>
            <td>${item.category}</td>
            <td>${fmt(item.unit_price)}</td>
            <td style="color:${color};font-weight:600">${item.stock}</td>
            <td style="min-width:100px">
              <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${Math.min(100,pctStock)}%;background:${color};border-radius:3px"></div>
              </div>
            </td>
            <td>${item.vendor_name||'—'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="editStock('${item.sku}',${item.stock},${item.reorder_level})">Edit Stock</button>
              <button class="btn btn-primary btn-sm" onclick="reorderItem('${item.sku}','${item.name.replace(/'/g,"\\'")}',${item.unit_price},'${item.vendor_id||''}')">Reorder</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function editStock(sku, stock, reorder) {
  openModal('Edit Stock — ' + sku,
    `<div class="form-group"><label>Current Stock</label><input type="number" id="edit-stock" value="${stock}" min="0"></div>
     <div class="form-group"><label>Reorder Level</label><input type="number" id="edit-reorder" value="${reorder}" min="0"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveStock('${sku}')">Save</button>`);
}

async function saveStock(sku) {
  const stock = +document.getElementById('edit-stock').value;
  const reorder = +document.getElementById('edit-reorder').value;
  const res = await api(`/inventory/${sku}`, { method:'PATCH', body: JSON.stringify({ stock, reorder_level: reorder }) });
  closeModal();
  if (res) { showToast('Stock updated'); navigate('inventory'); }
}

async function reorderItem(sku, name, price, vendorId) {
  const vendors = await api('/vendors');
  const vendorOpts = (vendors||[]).map(v=>`<option value="${v.id}" ${v.id===vendorId?'selected':''}>${v.name}</option>`).join('');
  openModal('Raise PO — ' + name,
    `<div class="form-group"><label>Vendor</label><select id="po-vendor">${vendorOpts}</select></div>
     <div class="form-group"><label>Quantity</label><input type="number" id="po-qty" value="100" min="1"></div>
     <div class="form-group"><label>Unit Price</label><input type="number" id="po-price" value="${price}" min="0" step="0.01"></div>
     <div class="form-group"><label>Expected Delivery</label><input type="date" id="po-delivery" value="${new Date(Date.now()+3*86400000).toISOString().slice(0,10)}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmReorder('${sku}','${name.replace(/'/g,"\\'")}')">Raise PO</button>`);
}

async function confirmReorder(sku, name) {
  const vendorId = document.getElementById('po-vendor').value;
  const qty = +document.getElementById('po-qty').value;
  const price = +document.getElementById('po-price').value;
  const delivery = document.getElementById('po-delivery').value;
  const res = await api('/purchase-orders', {
    method:'POST',
    body: JSON.stringify({ vendor_id: vendorId, items:[{sku, name, qty, unit_price: price}], expected_delivery: delivery })
  });
  closeModal();
  if (res) { showToast(`PO ${res.id} raised — vendor notified`); navigate('procurement'); }
}

function renderAddItem() {
  openModal('Add New Item to Catalogue',
    `<div class="form-group"><label>Item Name</label><input type="text" id="item-name" placeholder="e.g. Organic Green Tea"></div>
     <div class="form-group"><label>Category</label>
       <select id="item-cat"><option>Beverages</option><option>Snacks</option><option>Hygiene</option><option>Stationery</option><option>Office</option></select>
     </div>
     <div class="form-group"><label>Unit Price (₹)</label><input type="number" id="item-price" min="0" step="0.01"></div>
     <div class="form-group"><label>Opening Stock</label><input type="number" id="item-stock" value="0" min="0"></div>
     <div class="form-group"><label>HSN Code</label><input type="text" id="item-hsn" value="2101"></div>
     <div class="form-group"><label>Emoji</label><input type="text" id="item-emoji" value="📦" maxlength="2"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveNewItem()">Add Item</button>`);
}

async function saveNewItem() {
  const body = {
    name: document.getElementById('item-name').value,
    category: document.getElementById('item-cat').value,
    unit_price: +document.getElementById('item-price').value,
    stock: +document.getElementById('item-stock').value,
    hsn_code: document.getElementById('item-hsn').value,
    emoji: document.getElementById('item-emoji').value,
  };
  if (!body.name || !body.unit_price) { showToast('Name and price required','error'); return; }
  const res = await api('/inventory', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Item ${res.sku} added`); navigate('inventory'); }
}

/* ============================================================
   VENDORS
   ============================================================ */
async function renderVendors(el) {
  const vendors = await api('/vendors');
  if (!vendors) return;

  el.innerHTML = `
  ${pageHeader('Vendor Directory', `${vendors.length} vendors`,
    `<button class="btn btn-gold" onclick="addVendorModal()">${iconPlus(14)} Add Vendor</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Vendor</th><th>Category</th><th>On-time</th><th>Fill Rate</th><th>Lead Days</th><th>Rating</th><th>Actions</th></tr></thead>
        <tbody>${vendors.map(v=>`<tr>
          <td><b>${v.name}</b><div style="font-size:.78rem;color:var(--text-muted)">${v.contact_email||''}</div></td>
          <td>${v.category}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${v.on_time_rate}%;background:var(--success);border-radius:3px"></div>
              </div>
              <span style="font-size:.8rem">${pct(v.on_time_rate)}</span>
            </div>
          </td>
          <td>${pct(v.fill_rate)}</td>
          <td>${v.avg_lead_days}d</td>
          <td>⭐ ${(+v.rating).toFixed(1)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="newPOForVendor('${v.id}','${v.name.replace(/'/g,"\\'")}')">New PO</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function addVendorModal() {
  openModal('Add Vendor',
    `<div class="form-group"><label>Company Name</label><input type="text" id="v-name"></div>
     <div class="form-group"><label>Category</label>
       <select id="v-cat"><option>Beverages & Snacks</option><option>Office Supplies</option><option>Hygiene & Cleaning</option><option>Office Furniture</option><option>Electronics</option></select>
     </div>
     <div class="form-group"><label>Contact Email</label><input type="email" id="v-email"></div>
     <div class="form-group"><label>Contact Phone</label><input type="tel" id="v-phone"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveVendor()">Add Vendor</button>`);
}

async function saveVendor() {
  const body = {
    name: document.getElementById('v-name').value,
    category: document.getElementById('v-cat').value,
    contact_email: document.getElementById('v-email').value,
    contact_phone: document.getElementById('v-phone').value,
  };
  if (!body.name) { showToast('Vendor name required','error'); return; }
  const res = await api('/vendors', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Vendor added — welcome email sent`); navigate('vendors'); }
}

async function newPOForVendor(vendorId, vendorName) {
  const inv = await api('/inventory');
  const itemOpts = (inv||[]).map(i=>`<option value="${i.sku}" data-price="${i.unit_price}">${i.name} (${fmt(i.unit_price)})</option>`).join('');
  openModal(`New PO — ${vendorName}`,
    `<div class="form-group"><label>Item</label><select id="po-item" onchange="updatePOPrice(this)">${itemOpts}</select></div>
     <div class="form-group"><label>Quantity</label><input type="number" id="po-qty2" value="50" min="1"></div>
     <div class="form-group"><label>Unit Price (₹)</label><input type="number" id="po-price2" value="${inv?.[0]?.unit_price||0}"></div>
     <div class="form-group"><label>Expected Delivery</label><input type="date" id="po-del2" value="${new Date(Date.now()+3*86400000).toISOString().slice(0,10)}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="sendPOToVendor('${vendorId}')">Send PO</button>`);
}

function updatePOPrice(sel) {
  const opt = sel.options[sel.selectedIndex];
  const price = document.getElementById('po-price2');
  if (price) price.value = opt.dataset.price || '';
}

async function sendPOToVendor(vendorId) {
  const sku = document.getElementById('po-item').value;
  const name = document.getElementById('po-item').options[document.getElementById('po-item').selectedIndex].text.split(' (')[0];
  const qty = +document.getElementById('po-qty2').value;
  const price = +document.getElementById('po-price2').value;
  const delivery = document.getElementById('po-del2').value;
  const res = await api('/purchase-orders', {
    method:'POST',
    body: JSON.stringify({ vendor_id: vendorId, items:[{sku,name,qty,unit_price:price}], expected_delivery: delivery })
  });
  closeModal();
  if (res) { showToast(`PO ${res.id} sent to vendor`); navigate('procurement'); }
}


/* ============================================================
   PROCUREMENT
   ============================================================ */
async function renderProcurement(el) {
  const [pos, vendors] = await Promise.all([api('/purchase-orders'), api('/vendors')]);
  if (!pos) return;

  el.innerHTML = `
  ${pageHeader('Procurement', `${pos.length} purchase orders`,
    `<button class="btn btn-gold" onclick="navigate('vendors')">${iconPlus(14)} New PO</button>`)}
  <div class="kpi-row">
    ${['SENT','ACCEPTED','DISPATCHED','RECEIVED'].map(s=>`
    <div class="kpi-card">
      <div class="kpi-label">${s}</div>
      <div class="kpi-value">${pos.filter(p=>p.status===s).length}</div>
    </div>`).join('')}
  </div>
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span>Vendor Performance</span></div>
      <div class="card-body"><canvas id="vendorChart" height="220"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><span>PO Aging by Status</span></div>
      <div class="card-body"><canvas id="agingChart" height="220"></canvas></div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>All Purchase Orders</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>PO #</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Expected</th><th>Actions</th></tr></thead>
        <tbody>${pos.map(po=>`<tr>
          <td><b>${po.id}</b></td>
          <td>${po.vendor_name||'—'}</td>
          <td>${fmt(po.grand_total)}</td>
          <td>${statusBadge(po.status)}</td>
          <td>${fmtDate(po.expected_delivery)}</td>
          <td>${po.status==='DISPATCHED'?`<button class="btn btn-primary btn-sm" onclick="receiveGRN('${po.id}')">Receive GRN</button>`:'<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No POs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  if (vendors?.length) {
    const ctx = document.getElementById('vendorChart');
    if (ctx) {
      APP.charts.vendor = new Chart(ctx, {
        type:'bar',
        data:{ labels: vendors.map(v=>v.name.split(' ')[0]),
          datasets:[
            { label:'On-time %', data: vendors.map(v=>v.on_time_rate), backgroundColor:'#1f8a5b', borderRadius:4 },
            { label:'Fill Rate %', data: vendors.map(v=>v.fill_rate), backgroundColor:'#3b82f6', borderRadius:4 },
          ]},
        options:{ plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,max:100}} }
      });
    }
    const aCtx = document.getElementById('agingChart');
    const statuses = ['SENT','ACCEPTED','DISPATCHED','RECEIVED','INVOICED'];
    if (aCtx) {
      APP.charts.aging = new Chart(aCtx, {
        type:'doughnut',
        data:{ labels: statuses, datasets:[{ data: statuses.map(s=>pos.filter(p=>p.status===s).length),
          backgroundColor:['#f59e0b','#3b82f6','#f97316','#1f8a5b','#6b7280'], borderWidth:0 }]},
        options:{ plugins:{legend:{position:'bottom'}}, cutout:'65%' }
      });
    }
  }
}

async function receiveGRN(poId) {
  openModal('Receive GRN — PO ' + poId,
    `<div class="form-group"><label>Quantity Received</label><input type="number" id="grn-qty" value="100" min="0"></div>
     <div class="form-group"><label>Notes</label><textarea id="grn-notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmGRN('${poId}')">Confirm Receipt</button>`);
}

async function confirmGRN(poId) {
  const qty = +document.getElementById('grn-qty').value;
  const notes = document.getElementById('grn-notes').value;
  const res = await api('/grn', { method:'POST', body: JSON.stringify({ po_id: poId, qty_received: qty, notes }) });
  closeModal();
  if (res) { showToast(`GRN ${res.id} created — stock updated`); navigate('procurement'); }
}

/* ============================================================
   WAREHOUSE
   ============================================================ */
async function renderWarehouse(el) {
  const [grns, inv] = await Promise.all([api('/grn'), api('/inventory')]);
  if (!inv) return;

  const cats = {};
  inv.forEach(i => { cats[i.category] = (cats[i.category]||0) + i.stock; });
  const totalItems = inv.reduce((s,i) => s + i.stock, 0);
  const maxItems = inv.reduce((s,i) => s + i.max_stock, 0);

  el.innerHTML = `
  ${pageHeader('Warehouse', 'Stock & GRN management')}
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Total SKUs</div><div class="kpi-value">${inv.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Units</div><div class="kpi-value">${totalItems.toLocaleString('en-IN')}</div></div>
    <div class="kpi-card"><div class="kpi-label">Capacity Used</div><div class="kpi-value">${Math.round((totalItems/maxItems)*100)}%</div></div>
    <div class="kpi-card"><div class="kpi-label">GRNs Today</div><div class="kpi-value">${(grns||[]).filter(g=>g.received_at?.startsWith(new Date().toISOString().slice(0,10))).length}</div></div>
  </div>
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span>Stock by Category</span></div>
      <div class="card-body">
        ${Object.entries(cats).map(([cat,qty])=>{
          const pct = Math.min(100, Math.round((qty / (maxItems/Object.keys(cats).length)) * 100));
          return `<div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:.84rem;margin-bottom:4px"><span>${cat}</span><span>${qty} units</span></div>
            <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--navy);border-radius:4px"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Recent GRN Records</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>GRN #</th><th>PO #</th><th>Vendor</th><th>Qty</th><th>Date</th></tr></thead>
          <tbody>${(grns||[]).slice(0,8).map(g=>`<tr>
            <td><b>${g.id}</b></td>
            <td>${g.po_id}</td>
            <td>${g.vendor_name||'—'}</td>
            <td>${g.qty_received}</td>
            <td>${fmtDate(g.received_at)}</td>
          </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No GRNs yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   DELIVERY
   ============================================================ */
async function renderDelivery(el) {
  const dcs = await api('/delivery-challans');
  if (!dcs) return;

  el.innerHTML = `
  ${pageHeader('Deliveries', `${dcs.length} total challans`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Driver</th><th>Dispatched</th><th>Action</th></tr></thead>
        <tbody>${dcs.map(dc=>`<tr>
          <td><b>${dc.id}</b></td>
          <td>${dc.order_id}</td>
          <td>${dc.client_name||'—'}</td>
          <td>${statusBadge(dc.status)}</td>
          <td>${dc.driver_name||'—'}</td>
          <td>${fmtDate(dc.dispatched_at)}</td>
          <td>${dc.status==='IN_TRANSIT'?`<button class="btn btn-primary btn-sm" onclick="markDelivered('${dc.id}')">Mark Delivered</button>`:'—'}</td>
        </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No deliveries</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function markDelivered(id) {
  const res = await api(`/delivery-challans/${id}/deliver`, { method:'POST' });
  if (res) { showToast(`DC ${id} marked as delivered`); navigate('delivery'); }
}

/* ============================================================
   CLIENTS
   ============================================================ */
async function renderClients(el) {
  const clients = await api('/clients');
  if (!clients) return;

  el.innerHTML = `
  ${pageHeader('Client Directory', `${clients.length} clients`,
    `<button class="btn btn-gold" onclick="addClientModal()">${iconPlus(14)} Add Client</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Client</th><th>Contact</th><th>Health</th><th>Budget Used</th><th>Threshold</th><th>Actions</th></tr></thead>
        <tbody>${clients.map(c=>{
          const pct = Math.min(100, Math.round((c.spent_this_month/c.monthly_budget)*100));
          return `<tr>
            <td><b>${c.name}</b></td>
            <td><div style="font-size:.82rem">${c.contact_name||'—'}</div><div style="font-size:.78rem;color:var(--text-muted)">${c.contact_email||''}</div></td>
            <td><span style="font-weight:700;color:${c.health_score>=85?'var(--success)':c.health_score>=70?'var(--warning)':'var(--danger)'}">${c.health_score}/100</span></td>
            <td style="min-width:140px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${pct>90?'var(--danger)':pct>75?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                </div>
                <span style="font-size:.78rem;min-width:32px">${pct}%</span>
              </div>
              <div style="font-size:.76rem;color:var(--text-muted)">${fmt(c.spent_this_month)} / ${fmt(c.monthly_budget)}</div>
            </td>
            <td>${fmt(c.approval_threshold)}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="navigate('orders')">Orders</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function addClientModal() {
  openModal('Add Client',
    `<div class="form-group"><label>Company Name</label><input type="text" id="cl-name"></div>
     <div class="form-group"><label>Contact Name</label><input type="text" id="cl-cname"></div>
     <div class="form-group"><label>Contact Email</label><input type="email" id="cl-email"></div>
     <div class="form-group"><label>Monthly Budget (₹)</label><input type="number" id="cl-budget" value="500000"></div>
     <div class="form-group"><label>Approval Threshold (₹)</label><input type="number" id="cl-threshold" value="100000"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveClient()">Add Client</button>`);
}

async function saveClient() {
  const body = {
    name: document.getElementById('cl-name').value,
    contact_name: document.getElementById('cl-cname').value,
    contact_email: document.getElementById('cl-email').value,
    monthly_budget: +document.getElementById('cl-budget').value,
    approval_threshold: +document.getElementById('cl-threshold').value,
  };
  if (!body.name) { showToast('Name required','error'); return; }
  const res = await api('/clients', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Client added'); navigate('clients'); }
}


/* ============================================================
   SERVICE DESK
   ============================================================ */
async function renderServiceDesk(el) {
  const tickets = await api('/tickets');
  if (!tickets) return;
  const open = tickets.filter(t=>t.status!=='RESOLVED');

  el.innerHTML = `
  ${pageHeader('Service Desk', `${open.length} open tickets`,
    `<button class="btn btn-gold" onclick="newTicketModal()">${iconPlus(14)} New Ticket</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Ticket</th><th>Client</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${tickets.map(t=>`<tr>
          <td><b>${t.id}</b></td>
          <td>${t.client_name||'—'}</td>
          <td>${t.subject}</td>
          <td>${statusBadge(t.priority)}</td>
          <td>${statusBadge(t.status)}</td>
          <td>${fmtDate(t.created_at)}</td>
          <td>
            ${t.status!=='RESOLVED'?`<button class="btn btn-primary btn-sm" onclick="resolveTicket('${t.id}')">Resolve</button>`:''}
            ${t.status==='OPEN'?`<button class="btn btn-secondary btn-sm" onclick="startTicket('${t.id}')">Start</button>`:''}
          </td>
        </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No tickets</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function newTicketModal() {
  openModal('New Support Ticket',
    `<div class="form-group"><label>Subject</label><input type="text" id="tk-subject" placeholder="Brief summary of issue"></div>
     <div class="form-group"><label>Priority</label>
       <select id="tk-priority"><option value="LOW">Low</option><option value="MEDIUM" selected>Medium</option><option value="HIGH">High</option></select>
     </div>
     <div class="form-group"><label>Description</label>
       <textarea id="tk-desc" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="Describe the issue…"></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveTicket()">Submit Ticket</button>`);
}

async function saveTicket() {
  const body = {
    subject: document.getElementById('tk-subject').value,
    priority: document.getElementById('tk-priority').value,
    description: document.getElementById('tk-desc').value,
  };
  if (!body.subject) { showToast('Subject required','error'); return; }
  const res = await api('/tickets', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Ticket ${res.id} created`); navigate('service_desk'); }
}

async function resolveTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'RESOLVED' }) });
  if (res) { showToast(`Ticket ${id} resolved`); navigate('service_desk'); }
}

async function startTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'IN_PROGRESS' }) });
  if (res) { showToast(`Ticket ${id} in progress`); navigate('service_desk'); }
}

/* ============================================================
   APPROVALS
   ============================================================ */
async function renderApprovals(el) {
  const orders = await api('/orders');
  if (!orders) return;
  const pending = orders.filter(o=>o.status==='PENDING_APPROVAL');

  el.innerHTML = `
  ${pageHeader('Approvals', `${pending.length} awaiting approval`)}
  ${pending.length===0 ? emptyState('✅','All caught up','No orders pending approval.') :
  pending.map(o=>`
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div><b>${o.id}</b> <span style="color:var(--text-muted);font-size:.85rem">— ${o.client_name||'—'}</span></div>
      <div style="font-weight:700;font-size:1.1rem">${fmt(o.grand_total)}</div>
    </div>
    <div class="card-body">
      <div style="display:flex;gap:24px;font-size:.85rem;margin-bottom:12px">
        <div><span style="color:var(--text-muted)">Created:</span> ${fmtDate(o.created_at)}</div>
        <div><span style="color:var(--text-muted)">By:</span> ${o.creator_name||'—'}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-danger" onclick="rejectOrder('${o.id}')">Reject</button>
        <button class="btn btn-primary" onclick="approveOrder('${o.id}')">Approve & Submit</button>
        <button class="btn btn-secondary" onclick="viewOrder('${o.id}')">View Details</button>
      </div>
    </div>
  </div>`).join('')}`;
}

async function approveOrder(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'APPROVED', note:'Approved by approver' }) });
  if (res) { showToast(`Order ${id} approved`); navigate('approvals'); }
}

async function rejectOrder(id) {
  const reason = prompt('Rejection reason (optional):') || 'Rejected by approver';
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note: reason }) });
  if (res) { showToast(`Order ${id} rejected`); navigate('approvals'); }
}

/* ============================================================
   REPORTS
   ============================================================ */
function renderReports(el) {
  const reports = [
    { title:'Spend Analytics', desc:'Monthly spend by client, category, and vendor with trend lines.', icon:'📊' },
    { title:'Order Fulfilment', desc:'Order-to-delivery cycle time, SLA adherence, exception report.', icon:'📦' },
    { title:'Vendor Scorecard', desc:'On-time rate, fill rate, lead time, and quality metrics per vendor.', icon:'🏆' },
    { title:'Inventory Turnover', desc:'Stock movement, dead stock, fast & slow moving SKUs.', icon:'🔄' },
    { title:'Budget Utilisation', desc:'Client-wise budget vs. actual spend with forecasting.', icon:'💰' },
    { title:'DC Billing Report', desc:'Billing cycle performance, unbilled DCs, and ageing analysis.', icon:'🧾' },
    { title:'Service Desk SLA', desc:'Ticket resolution time, CSAT scores, and open ticket ageing.', icon:'🎫' },
    { title:'GST & Tax Report', desc:'Input/output GST summary, HSN-wise tax breakup for filing.', icon:'📋' },
  ];
  el.innerHTML = `
  ${pageHeader('Reports & BI', 'Export, schedule and view all platform reports')}
  <div class="grid-2">
    ${reports.map(r=>`
    <div class="card" style="cursor:pointer" onclick="showToast('Generating report…')">
      <div class="card-body" style="padding:20px">
        <div style="font-size:2rem;margin-bottom:8px">${r.icon}</div>
        <div style="font-weight:700;margin-bottom:6px">${r.title}</div>
        <div style="font-size:.84rem;color:var(--text-muted);margin-bottom:12px">${r.desc}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showToast('Generating PDF…')">PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showToast('Generating Excel…')">Excel</button>
          <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();showToast('Report scheduled for weekly delivery')">Schedule</button>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ============================================================
   USERS
   ============================================================ */
async function renderUsers(el) {
  const users = await api('/users');
  if (!users) return;

  el.innerHTML = `
  ${pageHeader('Users & Roles', `${users.length} users`,
    `<button class="btn btn-gold" onclick="addUserModal()">${iconPlus(14)} Add User</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Organisation</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u=>`<tr>
          <td><div class="su-avatar" style="display:inline-flex;width:28px;height:28px;font-size:.7rem">${u.initials}</div> ${u.name}</td>
          <td style="font-size:.84rem">${u.email}</td>
          <td>${statusBadge(u.role)}</td>
          <td>${u.org}</td>
          <td>${u.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
          <td>${u.active ? `<button class="btn btn-danger btn-sm" onclick="deactivateUser('${u.id}')">Deactivate</button>` :
            `<button class="btn btn-primary btn-sm" onclick="activateUser('${u.id}')">Activate</button>`}
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function addUserModal() {
  if (APP.user.role !== 'super_admin') { showToast('Only Super Admin can add users','error'); return; }
  openModal('Add User',
    `<div class="form-group"><label>Full Name</label><input type="text" id="u-name"></div>
     <div class="form-group"><label>Email</label><input type="email" id="u-email"></div>
     <div class="form-group"><label>Role</label>
       <select id="u-role">
         ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
       </select>
     </div>
     <div class="form-group"><label>Organisation</label><input type="text" id="u-org" placeholder="4SYZ Platform"></div>
     <div class="form-group"><label>Temporary Password</label><input type="password" id="u-pw" value="password"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveUser()">Create User</button>`);
}

async function saveUser() {
  const body = {
    name: document.getElementById('u-name').value,
    email: document.getElementById('u-email').value,
    role: document.getElementById('u-role').value,
    org: document.getElementById('u-org').value || ROLES[document.getElementById('u-role').value]?.org,
    password: document.getElementById('u-pw').value || 'password',
  };
  if (!body.name||!body.email) { showToast('Name and email required','error'); return; }
  const res = await api('/users', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('User created — credentials sent via email'); navigate('users'); }
}

async function deactivateUser(id) {
  if (!confirm('Deactivate this user?')) return;
  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify({ active:0 }) });
  if (res) { showToast('User deactivated'); navigate('users'); }
}

async function activateUser(id) {
  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify({ active:1 }) });
  if (res) { showToast('User reactivated'); navigate('users'); }
}

/* ============================================================
   SETTINGS
   ============================================================ */
function renderSettings(el) {
  const sections = [
    { title:'Authentication & SSO', desc:'Configure MFA, OTP, SSO providers (Google, Azure AD) and session expiry.', icon:'🔐' },
    { title:'Client Tenants', desc:'Manage client budgets, approval thresholds, and service level agreements.', icon:'🏢' },
    { title:'Notification Rules', desc:'Configure email, SMS, and in-app notification triggers and escalation rules.', icon:'🔔' },
    { title:'Integrations', desc:'Zoho Books, Twilio/MSG91 SMS, and outbound webhook configuration.', icon:'🔗' },
    { title:'Warehouses & Zones', desc:'Add or edit warehouses, bin locations, zones, and storage capacity.', icon:'🏭' },
    { title:'Item Categories & HSN', desc:'Manage product categories, HSN codes, GST rates and approval mappings.', icon:'📂' },
  ];
  el.innerHTML = `
  ${pageHeader('Platform Settings', 'System configuration & administration')}
  <div class="grid-2">
    ${sections.map(s=>`
    <div class="card" style="cursor:pointer" onclick="showToast('${s.title} settings — opening…')">
      <div class="card-body" style="padding:20px">
        <div style="font-size:1.8rem;margin-bottom:8px">${s.icon}</div>
        <div style="font-weight:700;margin-bottom:6px">${s.title}</div>
        <div style="font-size:.84rem;color:var(--text-muted);margin-bottom:14px">${s.desc}</div>
        <button class="btn btn-secondary btn-sm">Configure →</button>
      </div>
    </div>`).join('')}
  </div>`;
}

/* ============================================================
   VENDOR PORTAL — POs, Invoices, Payments
   ============================================================ */
async function renderVendorPOs(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;

  el.innerHTML = `
  ${pageHeader('Purchase Orders', `${pos.length} POs`)}
  <div class="kpi-row">
    ${['SENT','ACCEPTED','DISPATCHED','INVOICED'].map(s=>`
    <div class="kpi-card${s==='SENT'?' kpi-warning':''}">
      <div class="kpi-label">${s}</div>
      <div class="kpi-value${s==='SENT'?' kpi-warning':''}">${pos.filter(p=>p.status===s).length}</div>
    </div>`).join('')}
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>PO #</th><th>Items</th><th>Amount</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${pos.map(po=>`<tr>
          <td><b>${po.id}</b></td>
          <td>${(po.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', ')||'—'}</td>
          <td>${fmt(po.grand_total)}</td>
          <td>${fmtDate(po.expected_delivery)}</td>
          <td>${statusBadge(po.status)}</td>
          <td>${poActions(po)}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No POs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function acceptPO(id) {
  openModal(`Accept PO ${id}`,
    `<p>Confirm acceptance of PO <b>${id}</b>. The buyer will be notified and you commit to the delivery schedule.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmPOAction('${id}','ACCEPTED','PO accepted — delivery committed')">Confirm Acceptance</button>`);
}

async function rejectPO(id) {
  openModal(`Reject PO ${id}`,
    `<div class="form-group"><label>Reason for rejection</label><textarea id="rej-reason" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmPOAction('${id}','REJECTED','PO rejected')">Reject PO</button>`);
}

async function dispatchPO(id) {
  openModal(`Mark PO ${id} Dispatched`,
    `<p>Confirm dispatch of goods for PO <b>${id}</b>.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="confirmPOAction('${id}','DISPATCHED','Goods dispatched')">Confirm Dispatch</button>`);
}

async function uploadInvoice(id) {
  openModal(`Upload Invoice — PO ${id}`,
    `<div class="form-group"><label>Invoice URL / Reference</label><input type="text" id="inv-url" placeholder="https://... or INV-2024-001"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmUploadInvoice('${id}')">Upload Invoice</button>`);
}

async function confirmUploadInvoice(id) {
  const url = document.getElementById('inv-url').value;
  const res = await api(`/purchase-orders/${id}`, { method:'PATCH', body: JSON.stringify({ status:'INVOICED', invoice_url: url }) });
  closeModal();
  if (res) { showToast(`Invoice uploaded for PO ${id}`); navigate(APP.page); }
}

async function confirmPOAction(id, status, msg) {
  const res = await api(`/purchase-orders/${id}`, { method:'PATCH', body: JSON.stringify({ status }) });
  closeModal();
  if (res) { showToast(msg); navigate(APP.page); }
}

async function renderVendorInvoices(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;
  const invoiced = pos.filter(p => p.status === 'INVOICED' || p.invoice_url);

  el.innerHTML = `
  ${pageHeader('Invoices', `${invoiced.length} invoices`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>PO #</th><th>Amount</th><th>Invoice Ref</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${invoiced.map(po=>`<tr>
          <td><b>${po.id}</b></td>
          <td>${fmt(po.grand_total)}</td>
          <td>${po.invoice_url ? `<a href="${po.invoice_url}" target="_blank" style="color:var(--navy)">${po.invoice_url.length>30?po.invoice_url.slice(0,30)+'…':po.invoice_url}</a>` : '—'}</td>
          <td>${fmtDate(po.updated_at)}</td>
          <td>${statusBadge(po.status)}</td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No invoices yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function renderVendorPayments(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;
  const paid = pos.filter(p => p.status === 'INVOICED');
  const totalPending = paid.reduce((s,p) => s + (p.grand_total||0), 0);

  el.innerHTML = `
  ${pageHeader('Payments', 'Payment status for submitted invoices')}
  <div class="kpi-row">
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Payment</div><div class="kpi-value kpi-warning">${fmt(totalPending)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Invoices Submitted</div><div class="kpi-value">${paid.length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Payment Days</div><div class="kpi-value">30d</div><div class="kpi-sub">Net-30 terms</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span>Payment Tracker</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>PO #</th><th>Invoice Ref</th><th>Amount</th><th>Due Date</th><th>Payment Status</th></tr></thead>
        <tbody>${paid.map(po=>`<tr>
          <td><b>${po.id}</b></td>
          <td>${po.invoice_url||'—'}</td>
          <td>${fmt(po.grand_total)}</td>
          <td>${fmtDate(new Date(new Date(po.updated_at).getTime()+30*86400000).toISOString())}</td>
          <td><span class="badge badge-warning">PENDING</span></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No pending payments</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  tryAutoLogin();
});

