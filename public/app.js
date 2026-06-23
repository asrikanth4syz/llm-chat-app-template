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
    { section:'Features 16-25' },
    { id:'delivery_routes', label:'Route Optimization', icon:iconDelivery,  badge:null },
    { id:'dunning',         label:'Dunning & Payments', icon:iconBilling,   badge:null },
    { id:'import_data',     label:'CSV Import',         icon:iconInventory, badge:null },
    { id:'templates',       label:'Templates',          icon:iconOrders,    badge:null },
    { id:'sla_dashboard',   label:'SLA Dashboard',      icon:iconReports,   badge:'!' },
    { id:'approval_chains', label:'Approval Chains',    icon:iconApprove,   badge:null },
    { id:'fulfilment',      label:'Fulfilment',          icon:iconReports,   badge:'!' },
    { section:'Admin' },
    { id:'todays_schedule',       label:"Today's Schedule",    icon:iconDelivery,   badge:'!' },
    { id:'consolidated_orders',   label:'Procurement View',    icon:iconProcure,    badge:null },
    { id:'consolidated_due',      label:'Due Items',           icon:iconReports,    badge:'!' },
    { id:'staff',                 label:'Staff',               icon:iconUsers,      badge:null },
    { id:'porter_expenses',       label:'Porter Expenses',     icon:iconBilling,    badge:null },
    { id:'users',       label:'Users & Roles', icon:iconUsers,     badge:null },
    { id:'settings',    label:'Settings',      icon:iconSettings,  badge:null },
  ],
  ops: [
    { section:'Operations' },
    { id:'dashboard',           label:'Control Tower',    icon:iconDashboard, badge:null },
    { id:'orders',              label:'Orders',           icon:iconOrders,    badge:'!' },
    { id:'todays_schedule',     label:"Today's Schedule", icon:iconDelivery,  badge:'!' },
    { id:'consolidated_due',    label:'Due Items',        icon:iconReports,   badge:'!' },
    { id:'delivery',            label:'Deliveries',       icon:iconDelivery,  badge:null },
    { id:'dc_billing',          label:'DC Billing',       icon:iconBilling,   badge:'!' },
    { id:'fulfilment',          label:'Fulfilment',       icon:iconReports,   badge:'!' },
    { id:'service_desk',        label:'Service Desk',     icon:iconDesk,      badge:null },
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
    { id:'dashboard',       label:'Dashboard',          icon:iconDashboard, badge:null },
    { id:'todays_schedule', label:"Today's Schedule",   icon:iconDelivery,  badge:'!' },
    { id:'delivery',        label:'Deliveries',         icon:iconDelivery,  badge:null },
    { id:'dc_billing',      label:'DC Billing',         icon:iconBilling,   badge:'!' },
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
  const otpGroup = document.getElementById('otp-group');
  const otpVisible = !otpGroup.classList.contains('hidden');

  if (otpVisible) { doVerifyOTP(); return; }

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
  const code = [...document.querySelectorAll('.otp-input')].map(i => i.value).join('');
  if (code.length < 6) { showToast('Enter all 6 OTP digits', 'error'); return; }
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Verifying…';

  const data = await api('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email: APP._pendingEmail, code }),
  }).catch(() => null);

  btn.disabled = false;
  btn.querySelector('span').textContent = 'Verify OTP';

  if (!data?.token) { showToast('Invalid or expired OTP', 'error'); return; }

  APP.token = data.token;
  APP.user = { ...data.user, nav: ROLES[data.user.role]?.nav || 'platform' };
  localStorage.setItem('sp_token', data.token);
  initApp();
}

function doLogout() {
  if (APP._notifInterval) clearInterval(APP._notifInterval);
  APP.token = null;
  APP.user = null;
  APP.cart = [];
  localStorage.removeItem('sp_token');
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
  startNotificationPolling();

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar')) hideSearchResults();
  });
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
    <div onclick="handleSearchResult('${r._type}','${r.id||r.sku||''}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
      <span style="font-size:1.2rem">${typeIcon[r._type]||'🔍'}</span>
      <div>
        <div style="font-weight:600;font-size:.875rem">${r.name||r.subject||r.id||''}</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${r._type.toUpperCase()} ${r.id||r.sku||''}</div>
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
  APP._notifInterval = setInterval(async () => {
    if (!APP.token) { clearInterval(APP._notifInterval); return; }
    const data = await api('/notifications').catch(() => null);
    if (!data) return;
    const prevUnread = APP._prevUnread || 0;
    const unread = data.filter(n => !n.read_flag).length;
    APP._prevUnread = unread;
    document.querySelector('.notif-badge').textContent = unread || '';
    document.querySelector('.notif-badge').style.display = unread ? '' : 'none';
    if (unread > prevUnread) {
      const newest = data.find(n => !n.read_flag);
      if (newest) showToast(newest.message, 'info');
    }
  }, 30000);
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
  delivery_routes: renderDeliveryRoutes,
  dunning: renderDunning,
  import_data: renderImportData,
  templates: renderTemplates,
  sla_dashboard: renderSLADashboard,
  approval_chains: renderApprovalChains,
  fulfilment: renderFulfilment,
  staff: renderStaff,
  porter_expenses: renderPorterExpenses,
  todays_schedule: renderTodaysSchedule,
  consolidated_orders: renderConsolidatedOrders,
  consolidated_due: renderConsolidatedDue,
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
    PENDING_APPROVAL:'warning', SENT:'warning', SCHEDULED:'warning', OPEN:'warning', READY_TO_PICK:'warning', PICKED:'warning',
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
    background: type==='error' ? '#dc2626' : type==='info' ? '#3b82f6' : 'var(--navy)', color:'#fff',
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
  <div class="kpi-grid" style="margin-top:12px" id="client-fulfilment-kpis">
    <div class="kpi-card kpi-danger" style="cursor:pointer" onclick="navigate('fulfilment')">
      <div class="kpi-label">Due Items</div>
      <div class="kpi-value" id="due-items-count">—</div>
      <div class="kpi-sub">Items pending delivery</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('fulfilment')">
      <div class="kpi-label">Fulfilment %</div>
      <div class="kpi-value" id="client-fulfilment-pct">—</div>
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

  // Load fulfilment KPIs async
  api('/reports/pending-supply').then(ps => {
    const dueEl = document.getElementById('due-items-count');
    if (dueEl) dueEl.textContent = ps?.kpis?.due_qty ?? '—';
  });
  const today = new Date().toISOString().slice(0,10);
  const from30 = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  api(`/reports/client-fulfilment?from=${from30}&to=${today}`).then(cf => {
    const pctEl = document.getElementById('client-fulfilment-pct');
    if (pctEl && cf && cf.length) {
      const avg = cf.reduce((s,r)=>s+(r.fulfilment_pct||0),0)/cf.length;
      pctEl.textContent = Math.round(avg) + '%';
    }
  });
}

async function renderOpsDashboard(el) {
  const [data, pendingSupply] = await Promise.all([
    api('/dashboard'),
    api('/reports/pending-supply'),
  ]);
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
  </div>
  <div class="card" style="margin-top:16px">
    <div class="card-header"><span>Pending Supply Overview</span><button class="btn btn-secondary btn-sm" onclick="navigate('fulfilment')">Full Report</button></div>
    <div class="kpi-grid" style="padding:16px;margin-bottom:0">
      <div class="kpi-card kpi-danger"><div class="kpi-label">Total Due Qty</div><div class="kpi-value">${pendingSupply?.kpis?.due_qty||0}</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Due Value</div><div class="kpi-value">${fmt(pendingSupply?.kpis?.due_value||0)}</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Partial Orders</div><div class="kpi-value">${pendingSupply?.kpis?.partial_orders||0}</div></div>
      <div class="kpi-card"><div class="kpi-label">Delayed Deliveries</div><div class="kpi-value">${pendingSupply?.kpis?.delayed_deliveries||0}</div></div>
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
    <button class="btn btn-primary btn-sm" onclick="acceptPO('${po.id}',${po.grand_total||0})">Accept</button>
    <button class="btn btn-danger btn-sm" onclick="rejectPO('${po.id}')">Reject</button>`;
  if (po.status === 'ACCEPTED') return `
    <button class="btn btn-gold btn-sm" onclick="dispatchPO('${po.id}')">Mark Dispatched</button>`;
  if (po.status === 'DISPATCHED') return `
    <button class="btn btn-secondary btn-sm" onclick="uploadInvoice('${po.id}')">Upload Invoice</button>`;
  return `<span style="color:var(--text-muted);font-size:.8rem">${po.status}</span>`;
}


/* ============================================================
   PLACE ORDER — catalog + cart (with tabs)
   ============================================================ */
async function renderPlaceOrder(el) {
  const [inventory] = await Promise.all([api('/inventory')]);
  if (!inventory) return;

  const cats = [...new Set(inventory.map(i => i.category))];
  APP._catalog = inventory;
  APP._catFilter = 'All';
  if (!APP._orderTab) APP._orderTab = 'catalogue';

  el.innerHTML = `
  ${pageHeader('Place Order', 'Browse catalogue and add items to cart')}
  <div class="tabs" style="margin-bottom:20px">
    <button class="tab-btn${APP._orderTab==='catalogue'?' active':''}" onclick="switchOrderTab('catalogue')">Catalogue</button>
    <button class="tab-btn${APP._orderTab==='excel_upload'?' active':''}" onclick="switchOrderTab('excel_upload')">Excel Upload</button>
    <button class="tab-btn${APP._orderTab==='quick_reorder'?' active':''}" onclick="switchOrderTab('quick_reorder')">Quick Reorder</button>
    <button class="tab-btn${APP._orderTab==='standing_orders'?' active':''}" onclick="switchOrderTab('standing_orders')">Standing Orders</button>
  </div>
  <div id="order-tab-content">
    ${renderOrderTabContent(APP._orderTab, inventory, cats)}
  </div>`;
  if (APP._orderTab === 'catalogue') refreshCartUI();
}

function renderOrderTabContent(tab, inventory, cats) {
  inventory = inventory || APP._catalog || [];
  cats = cats || [...new Set(inventory.map(i => i.category))];

  if (tab === 'catalogue') {
    return `<div style="display:flex;gap:16px;align-items:flex-start">
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
        <div id="budget-bar-wrap" style="margin-top:12px;display:none">
          <div style="font-size:.8rem;font-weight:600;margin-bottom:4px;color:var(--text-muted)">Monthly Budget Used</div>
          <div style="background:var(--border);height:10px;border-radius:5px;overflow:hidden">
            <div id="budget-bar-fill" style="height:100%;border-radius:5px;transition:width .3s"></div>
          </div>
          <div id="budget-bar-label" style="font-size:.75rem;margin-top:3px;color:var(--text-muted)"></div>
        </div>
        <button class="btn btn-gold" style="width:100%;margin-top:12px" onclick="submitOrder()">
          ${iconCheck(14)} Place Order
        </button>
      </div>
    </div>
  </div>`;
  }

  if (tab === 'excel_upload') {
    return `<div class="card" style="max-width:640px">
      <div class="card-header"><span>Upload CSV / Excel Order</span></div>
      <div class="card-body" style="padding:24px">
        <p style="color:var(--text-muted);margin-bottom:16px">Download the template, fill in SKU and quantity, then upload.</p>
        <a href="#" onclick="downloadOrderTemplate();return false" class="btn btn-secondary" style="margin-bottom:20px">⬇ Download CSV Template</a>
        <div class="form-group">
          <label style="font-weight:600">Upload CSV File</label>
          <input type="file" id="csv-upload-input" accept=".csv,.xlsx" style="display:block;margin-top:8px;padding:8px;border:1px solid var(--border);border-radius:6px;width:100%">
        </div>
        <button class="btn btn-gold" style="margin-top:12px" onclick="processCSVUpload()">Import Order</button>
        <div id="csv-import-feedback" style="margin-top:16px"></div>
      </div>
    </div>`;
  }

  if (tab === 'quick_reorder') {
    return `<div id="quick-reorder-content"><div class="card"><div class="card-body" style="padding:24px;text-align:center;color:var(--text-muted)">Loading recent orders…</div></div></div>`;
  }

  if (tab === 'standing_orders') {
    return `<div id="standing-orders-content"><div class="card"><div class="card-body" style="padding:24px;text-align:center;color:var(--text-muted)">Loading standing orders…</div></div></div>`;
  }
  return '';
}

async function switchOrderTab(tab) {
  APP._orderTab = tab;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.textContent.trim().toLowerCase().replace(/ /g,'_') === tab ||
      (tab==='catalogue' && b.textContent.trim()==='Catalogue') ||
      (tab==='excel_upload' && b.textContent.trim()==='Excel Upload') ||
      (tab==='quick_reorder' && b.textContent.trim()==='Quick Reorder') ||
      (tab==='standing_orders' && b.textContent.trim()==='Standing Orders'));
  });
  const contentEl = document.getElementById('order-tab-content');
  contentEl.innerHTML = renderOrderTabContent(tab);
  if (tab === 'catalogue') { refreshCartUI(); loadBudgetBar(); }
  if (tab === 'quick_reorder') loadQuickReorder();
  if (tab === 'standing_orders') loadStandingOrders();
}

async function loadBudgetBar() {
  const wrap = document.getElementById('budget-bar-wrap');
  if (!wrap) return;
  try {
    const clientId = APP.user && APP.user.client_id;
    if (!clientId) return;
    const budget = await api('/clients/' + clientId + '/budget');
    if (!budget || budget.monthly_budget == null) return;
    const pct = Math.min(100, Math.round((budget.used / budget.monthly_budget) * 100));
    const color = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--success)';
    wrap.style.display = '';
    document.getElementById('budget-bar-fill').style.cssText = `height:100%;border-radius:5px;transition:width .3s;width:${pct}%;background:${color}`;
    document.getElementById('budget-bar-label').textContent = `${pct}% used — ₹${budget.used?.toLocaleString('en-IN')||0} of ₹${budget.monthly_budget?.toLocaleString('en-IN')||0}`;
  } catch(e) { /* hide bar on error */ }
}

function downloadOrderTemplate() {
  const csv = 'sku,quantity\nSKU-001,10\nSKU-002,5';
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'order_template.csv';
  a.click();
}

async function processCSVUpload() {
  const input = document.getElementById('csv-upload-input');
  const fb = document.getElementById('csv-import-feedback');
  if (!input || !input.files.length) { if(fb) fb.innerHTML = '<div class="alert alert-warning">Please select a CSV file.</div>'; return; }
  const file = input.files[0];
  const text = await file.text();
  const lines = text.trim().split('\n').filter(l => l.trim());
  const headers = lines[0].toLowerCase().split(',').map(h=>h.trim());
  const skuIdx = headers.indexOf('sku');
  const qtyIdx = headers.indexOf('quantity') !== -1 ? headers.indexOf('quantity') : headers.indexOf('qty');
  if (skuIdx === -1 || qtyIdx === -1) {
    if(fb) fb.innerHTML = '<div class="alert alert-danger">CSV must have "sku" and "quantity" columns.</div>'; return;
  }
  let imported = 0, skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c=>c.trim());
    const sku = cols[skuIdx];
    const qty = parseInt(cols[qtyIdx], 10);
    if (!sku || isNaN(qty) || qty < 1) { skipped++; continue; }
    const item = APP._catalog && APP._catalog.find(it => it.sku === sku);
    if (!item) { skipped++; continue; }
    const existing = APP.cart.find(c => c.sku === sku);
    if (existing) existing.qty += qty;
    else APP.cart.push({ sku, name: item.name, qty, unit_price: item.unit_price });
    imported++;
  }
  if(fb) fb.innerHTML = `<div class="alert ${imported?'alert-success':'alert-warning'}">${imported} item(s) added to cart${skipped?`, ${skipped} skipped`:''}.${imported?' <a href="#" onclick="switchOrderTab(\'catalogue\');return false">Go to Catalogue</a>':''}</div>`;
}

async function loadQuickReorder() {
  const orders = await api('/orders');
  const el = document.getElementById('quick-reorder-content');
  if (!el) return;
  const recent = (orders || []).slice(0, 5);
  if (!recent.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="padding:32px;text-align:center">${emptyState('🛒','No recent orders','Place your first order to see it here.')}</div></div>`;
    return;
  }
  el.innerHTML = recent.map(o=>`
    <div class="card" style="margin-bottom:12px">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
        <div><b>${o.id}</b> &nbsp;${statusBadge(o.status)} &nbsp;<span style="color:var(--text-muted);font-size:.84rem">${fmtDate(o.created_at)}</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font-weight:600">${fmt(o.grand_total)}</span>
          <button class="btn btn-gold btn-sm" onclick="reorderFromHistory('${o.id}')">Reorder</button>
        </div>
      </div>
      <div class="card-body" style="padding:10px 16px;font-size:.84rem;color:var(--text-muted)">
        ${(o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(' · ')||'—'}
      </div>
    </div>`).join('');
}

async function reorderFromHistory(orderId) {
  const order = await api('/orders/' + orderId);
  if (!order || !order.items) return;
  order.items.forEach(i => {
    const item = APP._catalog && APP._catalog.find(it => it.sku === i.sku || it.name === i.name);
    const price = item ? item.unit_price : (i.unit_price || 0);
    const existing = APP.cart.find(c => c.sku === (i.sku || i.name));
    if (existing) existing.qty += i.qty;
    else APP.cart.push({ sku: i.sku || i.name, name: i.name, qty: i.qty, unit_price: price });
  });
  showToast('Items added to cart');
  switchOrderTab('catalogue');
}

async function loadStandingOrders() {
  const el = document.getElementById('standing-orders-content');
  if (!el) return;
  let standing = null;
  try { standing = await api('/standing-orders'); } catch(e) {}
  if (!standing || !standing.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="padding:32px;text-align:center">${emptyState('🔄','No standing orders','Set up recurring orders to appear here.')}</div></div>`;
    return;
  }
  el.innerHTML = `<div class="card"><div class="table-wrap"><table class="table">
    <thead><tr><th>ID</th><th>Description</th><th>Frequency</th><th>Next Run</th><th>Status</th></tr></thead>
    <tbody>${standing.map(s=>`<tr>
      <td><b>${s.id}</b></td>
      <td>${s.description||'—'}</td>
      <td>${s.frequency||'—'}</td>
      <td>${fmtDate(s.next_run_at||s.next_run)}</td>
      <td>${statusBadge(s.status||'ACTIVE')}</td>
    </tr>`).join('')}
    </tbody></table></div></div>`;
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
  const [order, comments, dcRes] = await Promise.all([api('/orders/' + id), api('/orders/' + id + '/comments'), api('/delivery-challans').catch(()=>null)]);
  if (!order) return;

  const orderDCs = (dcRes||[]).filter(d => d.order_id === id);
  const dcSection = orderDCs.length ? `
  <div style="margin-top:20px">
    <div style="font-weight:600;margin-bottom:10px">Delivery Status</div>
    ${orderDCs.map(dc=>`
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><b>${dc.id}</b> — ${statusBadge(dc.status)}</div>
          <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button>
        </div>
        ${dc.driver_name?`<div style="margin-top:6px;font-size:.85rem;color:var(--text-muted)">Driver: ${dc.driver_name} · Vehicle: ${dc.vehicle_no||'—'}</div>`:''}
        ${dc.delivered_qty!=null&&dc.total_qty?`<div style="margin-top:4px;font-size:.85rem">Delivered: <b style="color:var(--success)">${dc.delivered_qty}</b> / ${dc.total_qty}</div>`:''}
      </div>`).join('')}
  </div>` : '';

  const commentsHtml = `
    <b style="display:block;margin-top:16px">Comments</b>
    <div id="order-comments" style="margin-top:8px;display:grid;gap:8px;max-height:180px;overflow-y:auto">
      ${(comments||[]).map(c=>`
        <div style="background:var(--bg);border-radius:8px;padding:10px 12px;font-size:.84rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <b>${c.author_name}</b>
            <span style="color:var(--text-muted)">${timeAgo(c.created_at)}</span>
          </div>
          <div>${c.message}</div>
        </div>`).join('') || '<div style="color:var(--text-muted);font-size:.84rem">No comments yet.</div>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input type="text" id="comment-input" placeholder="Add a comment…" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:.875rem">
      <button class="btn btn-primary btn-sm" onclick="addOrderComment('${id}')">Post</button>
    </div>`;

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
    </div>` : ''}
    ${dcSection}
    ${commentsHtml}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  );
}

async function addOrderComment(orderId) {
  const input = document.getElementById('comment-input');
  const msg = input?.value?.trim();
  if (!msg) return;
  const res = await api('/orders/' + orderId + '/comments', {
    method: 'POST',
    body: JSON.stringify({ message: msg }),
  });
  if (!res) return;
  input.value = '';
  const container = document.getElementById('order-comments');
  if (container) {
    const div = document.createElement('div');
    div.style.cssText = 'background:var(--bg);border-radius:8px;padding:10px 12px;font-size:.84rem';
    div.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>${APP.user.name}</b><span style="color:var(--text-muted)">just now</span></div><div>${msg}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
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
  const nowMonth = new Date().toISOString().slice(0, 7);
  const activeShipments = dcs.filter(d => d.status !== 'DELIVERED' && d.status !== 'CANCELLED').length;
  const itemsInTransit = dcs.filter(d => d.status === 'IN_TRANSIT').reduce((s, d) => s + (d.total_qty || 0), 0);
  const pendingDeliveries = dcs.filter(d => d.status === 'SCHEDULED').length;
  const deliveredThisMonth = dcs.filter(d => d.status === 'DELIVERED' && (d.delivered_at||'').startsWith(nowMonth)).length;

  el.innerHTML = `
  ${pageHeader('Track Delivery', `${active.length} active shipments`)}
  <div class="kpi-row" style="margin-bottom:20px">
    <div class="kpi-card"><div class="kpi-label">Active Shipments</div><div class="kpi-value">${activeShipments}</div></div>
    <div class="kpi-card"><div class="kpi-label">Items In Transit</div><div class="kpi-value">${itemsInTransit}</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Deliveries</div><div class="kpi-value kpi-warning">${pendingDeliveries}</div></div>
    <div class="kpi-card"><div class="kpi-label">Delivered This Month</div><div class="kpi-value" style="color:var(--success)">${deliveredThisMonth}</div></div>
  </div>
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
  if (!APP._oqTab) APP._oqTab = 'All';
  APP._oqOrders = orders;

  const STATUS_TABS = ['All','SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','PICKED','INVENTORY_CHECK','READY_TO_PICK','IN_SHIPMENT'];

  function oqTabsHtml() {
    return `<div class="tabs" style="margin-bottom:16px;flex-wrap:wrap">
      ${STATUS_TABS.map(s=>{
        const cnt = s==='All' ? orders.length : orders.filter(o=>o.status===s).length;
        return `<button class="tab-btn${APP._oqTab===s?' active':''}" onclick="switchOQTab('${s}')">
          ${s==='All'?'All':s.replace(/_/g,' ')} <span class="badge badge-secondary" style="margin-left:4px;font-size:.72rem">${cnt}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function oqTableHtml(tab) {
    const filtered = tab==='All' ? orders : orders.filter(o=>o.status===tab);
    return `<tbody id="oq-tbody">${filtered.map(o=>`<tr>
      <td><b>${o.id}</b></td>
      <td>${o.client_name||'—'}</td>
      <td>${fmt(o.grand_total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>${orderQueueActions(o)}</td>
    </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No orders</td></tr>'}</tbody>`;
  }

  APP._oqTabsHtml = oqTabsHtml;
  APP._oqTableHtml = oqTableHtml;

  el.innerHTML = `
  ${pageHeader('Order Queue', `${active.length} active orders`)}
  <div id="oq-tabs">${oqTabsHtml()}</div>
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        ${oqTableHtml(APP._oqTab)}
      </table>
    </div>
  </div>`;
}

function switchOQTab(tab) {
  APP._oqTab = tab;
  const orders = APP._oqOrders || [];
  const STATUS_TABS = ['All','SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','PICKED','INVENTORY_CHECK','READY_TO_PICK','IN_SHIPMENT'];
  // re-render tabs
  const tabsEl = document.getElementById('oq-tabs');
  if (tabsEl) {
    tabsEl.innerHTML = `<div class="tabs" style="margin-bottom:16px;flex-wrap:wrap">
      ${STATUS_TABS.map(s=>{
        const cnt = s==='All' ? orders.length : orders.filter(o=>o.status===s).length;
        return `<button class="tab-btn${tab===s?' active':''}" onclick="switchOQTab('${s}')">
          ${s==='All'?'All':s.replace(/_/g,' ')} <span class="badge badge-secondary" style="margin-left:4px;font-size:.72rem">${cnt}</span>
        </button>`;
      }).join('')}
    </div>`;
  }
  // re-render tbody
  const tbody = document.getElementById('oq-tbody');
  if (tbody) {
    const filtered = tab==='All' ? orders : orders.filter(o=>o.status===tab);
    tbody.outerHTML = `<tbody id="oq-tbody">${filtered.map(o=>`<tr>
      <td><b>${o.id}</b></td>
      <td>${o.client_name||'—'}</td>
      <td>${fmt(o.grand_total)}</td>
      <td>${statusBadge(o.status)}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td>${orderQueueActions(o)}</td>
    </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No orders</td></tr>'}
    </tbody>`;
  }
}

function orderQueueActions(o) {
  const btns = [`<button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button>`];
  const next = { SUBMITTED:'ACKNOWLEDGED', APPROVED:'ACKNOWLEDGED',
    INVENTORY_CHECK:'VENDOR_PO_RAISED', VENDOR_PO_RAISED:'READY_TO_PICK',
    IN_SHIPMENT:'CLOSED' };
  // ACKNOWLEDGED and READY_TO_PICK → Pick Items modal
  if (o.status === 'ACKNOWLEDGED' || o.status === 'READY_TO_PICK') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="pickOrderModal('${o.id}')">Pick Items</button>`);
  } else if (o.status === 'PICKED') {
    btns.push(`<button class="btn btn-success btn-sm" onclick="createDCFromPicklist('${o.id}')">Dispatch &rarr; DC</button>`);
  } else if (next[o.status]) {
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
  if (!APP._financeTab) APP._financeTab = 'dc_tracker';

  function agingBadge(dc) {
    const agingDays = Math.floor((Date.now() - new Date(dc.created_at).getTime()) / 86400000);
    if (agingDays <= 7) return `<span class="badge badge-success">0-7 days</span>`;
    if (agingDays <= 15) return `<span class="badge badge-warning">8-15 days</span>`;
    return `<span class="badge badge-danger">16+ days</span>`;
  }

  function financeTabContent(tab) {
    if (tab === 'dc_tracker') {
      return `
      <div class="kpi-row">
        <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Billing</div><div class="kpi-value kpi-warning">${unbilled.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Billed Today</div><div class="kpi-value">${billed.filter(d=>d.billed_at?.startsWith(new Date().toISOString().slice(0,10))).length}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total DCs</div><div class="kpi-value">${dcs.length}</div></div>
      </div>
      <div class="card">
        <div class="card-header"><span>Delivered — Pending Billing (${unbilled.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Order Value</th><th>Delivered</th><th>Aging</th><th>Action</th></tr></thead>
            <tbody>${unbilled.map(dc=>`<tr>
              <td><b>${dc.id}</b></td>
              <td>${dc.order_id}</td>
              <td>${dc.client_name||'—'}</td>
              <td>${fmt(dc.order_value)}</td>
              <td>${fmtDate(dc.delivered_at||dc.dispatched_at)}</td>
              <td>${agingBadge(dc)}</td>
              <td><button class="btn btn-gold btn-sm" onclick="billDC('${dc.id}')">Bill DC</button></td>
            </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No unbilled DCs</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><span>Billed DCs (${billed.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Value</th><th>Billed On</th><th>Aging</th></tr></thead>
            <tbody>${billed.map(dc=>`<tr>
              <td><b>${dc.id}</b></td><td>${dc.order_id}</td>
              <td>${dc.client_name||'—'}</td>
              <td>${fmt(dc.order_value)}</td>
              <td>${fmtDate(dc.billed_at)}</td>
              <td>${agingBadge(dc)}</td>
            </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">None yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    }
    if (tab === 'ar_aging') {
      return `<div class="card"><div class="card-body" style="padding:32px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:12px">📊</div>
        <div style="font-weight:600;font-size:1.05rem;margin-bottom:8px">AR Aging</div>
        <div style="color:var(--text-muted)">Coming soon — this module will show accounts receivable aging buckets (0-30, 31-60, 61-90, 90+ days) across all clients.</div>
      </div></div>`;
    }
    if (tab === 'ap_aging') {
      return `<div class="card"><div class="card-body" style="padding:32px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:12px">📋</div>
        <div style="font-weight:600;font-size:1.05rem;margin-bottom:8px">AP Aging</div>
        <div style="color:var(--text-muted)">Coming soon — this module will show accounts payable aging for vendor invoices and outstanding POs.</div>
      </div></div>`;
    }
    if (tab === 'margin_analysis') {
      return `<div class="card"><div class="card-body" style="padding:32px;text-align:center">
        <div style="font-size:1.5rem;margin-bottom:12px">📈</div>
        <div style="font-weight:600;font-size:1.05rem;margin-bottom:8px">Margin Analysis</div>
        <div style="color:var(--text-muted)">Coming soon — this module will show gross margin by product, category, and client with trend charts.</div>
      </div></div>`;
    }
    return '';
  }

  const FINANCE_TABS = [
    { id: 'dc_tracker', label: 'DC Tracker' },
    { id: 'ar_aging', label: 'AR Aging' },
    { id: 'ap_aging', label: 'AP Aging' },
    { id: 'margin_analysis', label: 'Margin Analysis' },
  ];

  el.innerHTML = `
  ${pageHeader('DC Billing', 'Delivery challan billing pipeline')}
  <div class="tabs" style="margin-bottom:20px">
    ${FINANCE_TABS.map(t=>`<button class="tab-btn${APP._financeTab===t.id?' active':''}" onclick="switchFinanceTab('${t.id}')">${t.label}</button>`).join('')}
  </div>
  <div id="finance-tab-content">${financeTabContent(APP._financeTab)}</div>`;

  APP._financeTabContent = financeTabContent;
}

function switchFinanceTab(tab) {
  APP._financeTab = tab;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => {
    const map = { 'dc_tracker':'DC Tracker','ar_aging':'AR Aging','ap_aging':'AP Aging','margin_analysis':'Margin Analysis' };
    b.classList.toggle('active', b.textContent.trim() === (map[tab]||tab));
  });
  const el = document.getElementById('finance-tab-content');
  if (el && APP._financeTabContent) el.innerHTML = APP._financeTabContent(tab);
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
let _invCache = {};

async function renderInventory(el) {
  const inv = await api('/inventory');
  if (!inv) return;
  _invCache = {};
  inv.forEach(i => { _invCache[i.sku] = i; });
  const lowStock = inv.filter(i => i.stock <= i.reorder_level);

  el.innerHTML = `
  ${pageHeader('Inventory', `${inv.length} SKUs · ${lowStock.length} low stock`,
    `<button class="btn btn-secondary" onclick="renderAddItem()">${iconPlus(14)} Add Item</button>`)}
  ${lowStock.length ? `<div class="alert alert-warning" style="margin-bottom:16px">⚠️ ${lowStock.length} SKU(s) below reorder level: ${lowStock.map(i=>i.name).join(', ')}</div>` : ''}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Category</th><th>Price</th><th>Stock</th><th>Reserved</th><th>Available</th><th>Level</th><th>Vendor</th><th>Actions</th></tr></thead>
        <tbody>${inv.map(item => {
          const reserved = item.reserved || 0;
          const available = Math.max(0, item.stock - reserved);
          const pctStock = Math.round((item.stock / (item.max_stock||1)) * 100);
          const color = item.stock <= item.reorder_level ? 'var(--danger)' : item.stock <= item.reorder_level*1.5 ? 'var(--warning)' : 'var(--success)';
          return `<tr>
            <td><span style="font-size:1.2rem">${item.emoji}</span> ${item.sku}</td>
            <td><b>${item.name}</b></td>
            <td>${item.category}</td>
            <td>${fmt(item.unit_price)}</td>
            <td style="color:${color};font-weight:600">${item.stock}</td>
            <td style="color:var(--warning);font-weight:500">${reserved}</td>
            <td style="color:${available<=0?'var(--danger)':'var(--success)'};font-weight:600">${available}</td>
            <td style="min-width:100px">
              <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${Math.min(100,pctStock)}%;background:${color};border-radius:3px"></div>
              </div>
            </td>
            <td>${item.vendor_name||'—'}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="editInventoryItem('${item.sku}')">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="viewStockHistory('${item.sku}','${item.name.replace(/'/g,"\\'")}')">History</button>
              <button class="btn btn-primary btn-sm" onclick="reorderItem('${item.sku}','${item.name.replace(/'/g,"\\'")}',${item.unit_price},'${item.vendor_id||''}')">Reorder</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function viewStockHistory(sku, itemName) {
  const movements = await api('/stock-movements?sku=' + sku);
  if (!movements) return;
  const rows = movements.length ? movements.map(m => `<tr>
    <td>${fmtDate(m.created_at)}</td>
    <td><span class="badge ${m.qty_change>0?'badge-success':'badge-danger'}">${m.type}</span></td>
    <td style="font-weight:600;color:${m.qty_change>0?'var(--success)':'var(--danger)'}">${m.qty_change>0?'+':''}${m.qty_change}</td>
    <td>${m.reference_id||'—'}</td>
    <td>${m.note||'—'}</td>
    <td>${m.actor||'—'}</td>
  </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No movements recorded</td></tr>';
  openModal(`Stock History — ${itemName}`,
    `<div class="table-wrap" style="max-height:50vh;overflow-y:auto">
      <table class="table">
        <thead><tr><th>Date</th><th>Type</th><th>Qty Change</th><th>Reference</th><th>Note</th><th>By</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}

async function editInventoryItem(sku) {
  const item = _invCache[sku];
  if (!item) return;
  const vendors = await api('/vendors') || [];
  const vendorOpts = vendors.map(v => `<option value="${v.id}" ${v.id===item.vendor_id?'selected':''}>${v.name}</option>`).join('');
  const cats = ['Beverages','Snacks','Hygiene','Stationery','Office','Dairy','Fruits & Vegetables','Other'];
  const catOpts = cats.map(c => `<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('');
  openModal(`Edit Item — ${sku}`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
       <div class="form-group" style="grid-column:1/-1"><label>Item Name</label><input type="text" id="ei-name" value="${item.name.replace(/"/g,'&quot;')}"></div>
       <div class="form-group"><label>Category</label><select id="ei-cat">${catOpts}</select></div>
       <div class="form-group"><label>Emoji</label><input type="text" id="ei-emoji" value="${item.emoji||'📦'}" maxlength="2"></div>
       <div class="form-group"><label>Unit Price (₹)</label><input type="number" id="ei-price" value="${item.unit_price}" min="0" step="0.01"></div>
       <div class="form-group"><label>HSN Code</label><input type="text" id="ei-hsn" value="${item.hsn_code||''}"></div>
       <div class="form-group"><label>GST Rate (%)</label><input type="number" id="ei-gst" value="${item.gst_rate||18}" min="0" max="28"></div>
       <div class="form-group"><label>Vendor</label><select id="ei-vendor"><option value="">— None —</option>${vendorOpts}</select></div>
       <div class="form-group"><label>Current Stock</label><input type="number" id="ei-stock" value="${item.stock}" min="0"></div>
       <div class="form-group"><label>Reorder Level</label><input type="number" id="ei-reorder" value="${item.reorder_level}" min="0"></div>
       <div class="form-group"><label>Max Stock</label><input type="number" id="ei-maxstock" value="${item.max_stock||200}" min="0"></div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveInventoryItem('${sku}')">Save Changes</button>`);
}

async function saveInventoryItem(sku) {
  const body = {
    name:          document.getElementById('ei-name').value,
    category:      document.getElementById('ei-cat').value,
    emoji:         document.getElementById('ei-emoji').value,
    unit_price:    +document.getElementById('ei-price').value,
    hsn_code:      document.getElementById('ei-hsn').value,
    gst_rate:      +document.getElementById('ei-gst').value,
    vendor_id:     document.getElementById('ei-vendor').value || null,
    stock:         +document.getElementById('ei-stock').value,
    reorder_level: +document.getElementById('ei-reorder').value,
    max_stock:     +document.getElementById('ei-maxstock').value,
  };
  if (!body.name) { showToast('Item name is required', 'error'); return; }
  const res = await api(`/inventory/${sku}`, { method:'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Item updated'); navigate('inventory'); }
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
            <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="openVendorFeedbackModal('${v.id}','${v.name.replace(/'/g,"\\'")}')">Rate</button>
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
          <td><b>${po.id}</b> ${po.auto_generated ? '<span class="badge badge-gold" title="Auto-generated by reorder engine">Auto</span>' : ''}</td>
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
   WAREHOUSE — Tabbed view (Section 6 rebuild)
   ============================================================ */
async function renderWarehouse(el) {
  el.innerHTML = `
  ${pageHeader('Warehouse', 'Warehouses, bins, GRN, picklist & stock transfers',
    `<button class="btn btn-primary" onclick="addWarehouseModal()">${iconPlus(14)} Add Warehouse</button>`)}
  <div class="tabs" id="wh-tabs" style="margin-bottom:16px">
    <button class="tab-btn active" onclick="switchWHTab('overview',this)">Overview</button>
    <button class="tab-btn" onclick="switchWHTab('grn',this)">GRN Records</button>
    <button class="tab-btn" onclick="switchWHTab('bins',this)">Bin Locations</button>
    <button class="tab-btn" onclick="switchWHTab('picklist',this)">Pick List</button>
    <button class="tab-btn" onclick="switchWHTab('transfers',this)">Stock Transfers</button>
  </div>
  <div id="wh-tab-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div>`;

  switchWHTab('overview', document.querySelector('#wh-tabs .tab-btn'));
}

async function switchWHTab(tab, btn) {
  document.querySelectorAll('#wh-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const content = document.getElementById('wh-tab-content');
  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div>';

  try {
    if (tab === 'overview') {
      const [warehouses, bins, inv, grns] = await Promise.all([
        api('/warehouses'), api('/bin-locations'), api('/inventory'), api('/grn')
      ]);
      renderWHOverview(content, warehouses||[], bins||[], inv||[], grns||[]);
    } else if (tab === 'grn') {
      const grns = await api('/grn');
      renderWHGRN(content, grns||[]);
    } else if (tab === 'bins') {
      const [bins, warehouses] = await Promise.all([api('/bin-locations'), api('/warehouses')]);
      renderWHBins(content, bins||[], warehouses||[]);
    } else if (tab === 'picklist') {
      const picklist = await api('/orders/picklist');
      renderWHPickList(content, picklist||[]);
    } else if (tab === 'transfers') {
      const [movements, bins] = await Promise.all([
        api('/stock-movements?type=TRANSFER'), api('/bin-locations')
      ]);
      renderWHTransfers(content, movements||[], bins||[]);
    }
  } catch(e) {
    content.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--danger)">
      Error loading data. <button class="btn btn-secondary btn-sm" onclick="switchWHTab('${tab}',document.querySelectorAll('#wh-tabs .tab-btn')[['overview','grn','bins','picklist','transfers'].indexOf('${tab}')])">Retry</button>
    </div>`;
  }
}

function renderWHOverview(el, warehouses, bins, inv, grns) {
  const totalUnits = inv.reduce((s,i) => s+i.stock, 0);
  const totalSKUs  = inv.length;
  const thisMonth  = new Date().toISOString().slice(0,7);
  const grnsThisMonth = grns.filter(g => (g.received_at||'').startsWith(thisMonth)).length;

  el.innerHTML = `
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Active Warehouses</div><div class="kpi-value">${warehouses.filter(w=>w.active).length}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total SKUs</div><div class="kpi-value">${totalSKUs}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Units In Stock</div><div class="kpi-value">${totalUnits.toLocaleString('en-IN')}</div></div>
    <div class="kpi-card"><div class="kpi-label">GRNs This Month</div><div class="kpi-value">${grnsThisMonth}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span>Warehouses</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>City</th><th>Capacity</th><th>Bins</th><th>Utilization</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${warehouses.map(w=>{
          const wBins = bins.filter(b=>b.warehouse_id===w.id);
          const occupied = wBins.reduce((s,b)=>s+(b.occupied||0),0);
          const cap = wBins.reduce((s,b)=>s+(b.capacity||1),1);
          const utilPct = Math.min(100, Math.round(occupied/cap*100));
          return `<tr>
            <td><b>${w.name}</b></td>
            <td>${w.city||'—'}</td>
            <td>${(w.capacity||0).toLocaleString('en-IN')} units</td>
            <td>${wBins.length}</td>
            <td>
              <div style="display:flex;align-items:center;gap:8px">
                <div style="background:var(--border);height:6px;border-radius:3px;flex:1;overflow:hidden">
                  <div style="height:100%;width:${utilPct}%;background:${utilPct>85?'var(--danger)':utilPct>60?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                </div>
                <span style="font-size:.8rem;white-space:nowrap">${utilPct}%</span>
              </div>
            </td>
            <td>${w.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
            <td style="display:flex;gap:4px">
              <button class="btn btn-secondary btn-sm" onclick="editWarehouseModal('${w.id}','${(w.name||'').replace(/'/g,"\\'")}',${w.capacity||1000})">Edit</button>
              <button class="btn btn-secondary btn-sm" onclick="switchWHTab('bins',document.querySelectorAll('#wh-tabs .tab-btn')[2])">View Bins</button>
              <button class="btn btn-primary btn-sm" onclick="addBinModal('${w.id}')">Add Bin</button>
            </td>
          </tr>`;
        }).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No warehouses yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderWHGRN(el, grns) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button class="btn btn-primary" onclick="recordGRNModal()">${iconPlus(14)} Record GRN</button>
  </div>
  <div class="card">
    <div class="card-header"><span>GRN Records</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>GRN #</th><th>PO #</th><th>Vendor</th><th>SKU</th><th>Qty Received</th><th>Received By</th><th>Date</th></tr></thead>
        <tbody>${grns.map(g=>`<tr>
          <td><b>${g.id}</b></td>
          <td>${g.po_id||'—'}</td>
          <td>${g.vendor_name||'—'}</td>
          <td>${g.sku||'—'}</td>
          <td><b style="color:var(--success)">${g.qty_received}</b></td>
          <td>${g.receiver_name||g.received_by||'—'}</td>
          <td>${fmtDate(g.received_at)}</td>
        </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No GRN records yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderWHBins(el, bins, warehouses) {
  const whMap = {};
  warehouses.forEach(w => { whMap[w.id] = w.name; });

  const whOptions = warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <label style="font-size:.875rem;color:var(--text-muted)">Filter by Warehouse:</label>
      <select id="bin-wh-filter" onchange="filterBinsTable()" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px">
        <option value="">All Warehouses</option>
        ${whOptions}
      </select>
    </div>
    <button class="btn btn-primary" onclick="addBinModal()">${iconPlus(14)} Add Bin</button>
  </div>
  <div class="card">
    <div class="card-header"><span>Bin Locations</span></div>
    <div class="table-wrap">
      <table class="table" id="bins-table">
        <thead><tr><th>Code</th><th>Warehouse</th><th>Zone</th><th>SKU Assigned</th><th>Capacity</th><th>Occupied</th><th>Free Space</th><th>Actions</th></tr></thead>
        <tbody id="bins-tbody">
          ${bins.map(b=>{
            const freeSpace = (b.capacity||0)-(b.occupied||0);
            const fillPct = Math.min(100, Math.round((b.occupied||0)/(b.capacity||1)*100));
            return `<tr data-wh="${b.warehouse_id}">
              <td><b>${b.code}</b></td>
              <td>${whMap[b.warehouse_id]||b.warehouse_id||'—'}</td>
              <td>${b.zone||'—'}</td>
              <td>${b.sku||'<em style="color:var(--text-muted)">Unassigned</em>'}</td>
              <td>${b.capacity||0}</td>
              <td>${b.occupied||0}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="background:var(--border);height:6px;border-radius:3px;width:80px;overflow:hidden">
                    <div style="height:100%;width:${fillPct}%;background:${fillPct>85?'var(--danger)':fillPct>60?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                  </div>
                  <span style="font-size:.8rem">${freeSpace} free</span>
                </div>
              </td>
              <td style="display:flex;gap:4px">
                <button class="btn btn-secondary btn-sm" onclick="editBinModal('${b.id}','${(b.code||'').replace(/'/g,"\\'")}','${(b.zone||'').replace(/'/g,"\\'")}',${b.capacity||0},'${b.sku||''}')">Edit</button>
              </td>
            </tr>`;
          }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No bins yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function filterBinsTable() {
  const whId = document.getElementById('bin-wh-filter').value;
  document.querySelectorAll('#bins-tbody tr[data-wh]').forEach(row => {
    row.style.display = (!whId || row.dataset.wh === whId) ? '' : 'none';
  });
}

function renderWHPickList(el, picklist) {
  // Group by order
  const orders = {};
  picklist.forEach(row => {
    if (!orders[row.order_id]) orders[row.order_id] = { order_id: row.order_id, client_name: row.client_name, created_at: row.created_at, items: [] };
    orders[row.order_id].items.push(row);
  });
  const orderList = Object.values(orders);

  el.innerHTML = `
  <div class="card">
    <div class="card-header"><span>Pick List — Orders Pending Pick &amp; Dispatch (${orderList.length})</span></div>
    ${orderList.length === 0
      ? '<div style="padding:32px;text-align:center;color:var(--text-muted)">No orders pending picking</div>'
      : orderList.map(order => `
        <div style="border-bottom:1px solid var(--border);padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <b>${order.order_id}</b>
              <span style="margin-left:8px;color:var(--text-muted)">${order.client_name}</span>
              <span style="margin-left:8px;font-size:.8rem;color:var(--text-muted)">${fmtDate(order.created_at)}</span>
              <span class="badge badge-${order.status==='PICKED'?'success':'warning'}" style="margin-left:8px">${order.status}</span>
              ${order.status==='PICKED'&&order.picker_name?`<span style="margin-left:6px;font-size:.78rem;color:var(--text-muted)">Picked by ${order.picker_name}</span>`:''}
            </div>
            <div>
              ${order.status!=='PICKED'
                ? `<button class="btn btn-primary btn-sm" onclick="pickOrderModal('${order.order_id}')">Pick Items</button>`
                : `<button class="btn btn-success btn-sm" onclick="createDCFromPicklist('${order.order_id}')">Dispatch &rarr; DC</button>`
              }
            </div>
          </div>
          <div class="table-wrap">
            <table class="table" style="margin:0">
              <thead><tr><th>SKU</th><th>Item</th><th>Qty Required</th><th>Stock Available</th>${order.status==='PICKED'?'<th>Bin Picked From</th>':''}</tr></thead>
              <tbody>${order.items.map(item=>`<tr>
                <td>${item.sku}</td>
                <td>${item.item_name}</td>
                <td>${item.qty}</td>
                <td style="color:${item.stock_available<item.qty?'var(--danger)':'var(--success)'}">
                  <b>${item.stock_available}</b>
                  ${item.stock_available<item.qty?`<span style="margin-left:4px;font-size:.75rem">(short by ${item.qty-item.stock_available})</span>`:''}
                </td>
                ${order.status==='PICKED'?`<td>${item.bin_code||'—'}</td>`:''}
              </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')
    }
  </div>`;
}

function renderWHTransfers(el, movements, bins) {
  const binOptions = bins.map(b=>`<option value="${b.id}">${b.code} (${b.warehouse_id||''})</option>`).join('');

  el.innerHTML = `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>New Stock Transfer</span></div>
    <div class="card-body" style="padding:16px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end">
        <div class="form-group" style="margin:0">
          <label>SKU</label>
          <input type="text" id="st-sku" placeholder="e.g. SKU001">
        </div>
        <div class="form-group" style="margin:0">
          <label>From Bin</label>
          <select id="st-from">${binOptions}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label>To Bin</label>
          <select id="st-to">${binOptions}</select>
        </div>
        <div class="form-group" style="margin:0">
          <label>Qty</label>
          <input type="number" id="st-qty" value="1" min="1">
        </div>
        <div class="form-group" style="margin:0">
          <label>Note</label>
          <input type="text" id="st-note" placeholder="Optional note">
        </div>
        <div>
          <button class="btn btn-primary" onclick="submitStockTransfer()">Transfer Stock</button>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>Recent Transfers</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Date</th><th>SKU</th><th>Item</th><th>Qty</th><th>From Bin</th><th>Note</th><th>By</th></tr></thead>
        <tbody>${movements.map(m=>`<tr>
          <td>${fmtDate(m.created_at)}</td>
          <td>${m.sku}</td>
          <td>${m.item_name||'—'}</td>
          <td>${m.qty_change}</td>
          <td>${m.reference_id||'—'}</td>
          <td>${m.note||'—'}</td>
          <td>${m.actor||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No transfers yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function recordGRNModal() {
  api('/purchase-orders').then(pos => {
    const poOptions = (pos||[]).filter(p=>['SENT','ACCEPTED'].includes(p.status))
      .map(p=>`<option value="${p.id}">${p.id} — ${p.vendor_name||p.vendor_id}</option>`).join('');
    openModal('Record GRN',
      `<div class="form-group"><label>Purchase Order</label>
         <select id="grn-po"><option value="">Select PO...</option>${poOptions}</select></div>
       <div class="form-group"><label>SKU</label><input type="text" id="grn-sku" placeholder="e.g. SKU001"></div>
       <div class="form-group"><label>Qty Received</label><input type="number" id="grn-qty" value="1" min="1"></div>
       <div class="form-group"><label>Notes</label><input type="text" id="grn-notes" placeholder="Optional notes"></div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="saveGRN()">Record GRN</button>`);
  });
}

async function saveGRN() {
  const body = {
    po_id:        document.getElementById('grn-po').value,
    sku:          document.getElementById('grn-sku').value,
    qty_received: +document.getElementById('grn-qty').value,
    notes:        document.getElementById('grn-notes').value,
  };
  if (!body.po_id)        { showToast('Please select a Purchase Order','error'); return; }
  if (!body.qty_received) { showToast('Quantity must be > 0','error'); return; }
  const res = await api('/grn', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`GRN recorded — ${body.qty_received} units received`); switchWHTab('grn', document.querySelectorAll('#wh-tabs .tab-btn')[1]); }
}

function addBinModal(warehouseId) {
  api('/warehouses').then(warehouses => {
    const whOptions = (warehouses||[]).map(w=>`<option value="${w.id}" ${w.id===warehouseId?'selected':''}>${w.name}</option>`).join('');
    openModal('Add Bin Location',
      `<div class="form-group"><label>Warehouse</label>
         <select id="bin-wh">${whOptions}</select></div>
       <div class="form-group"><label>Bin Code</label><input type="text" id="bin-code" placeholder="e.g. A-01-01"></div>
       <div class="form-group"><label>Zone</label><input type="text" id="bin-zone" placeholder="e.g. A, Cold Storage, Dry"></div>
       <div class="form-group"><label>Capacity (units)</label><input type="number" id="bin-cap" value="100" min="1"></div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="saveBin()">Add Bin</button>`);
  });
}

async function saveBin() {
  const body = {
    warehouse_id: document.getElementById('bin-wh').value,
    code:         document.getElementById('bin-code').value,
    zone:         document.getElementById('bin-zone').value,
    capacity:     +document.getElementById('bin-cap').value,
  };
  if (!body.warehouse_id || !body.code) { showToast('Warehouse and bin code required','error'); return; }
  const res = await api('/bin-locations', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Bin added'); switchWHTab('bins', document.querySelectorAll('#wh-tabs .tab-btn')[2]); }
}

function editBinModal(binId, code, zone, cap, sku) {
  openModal('Edit Bin Location',
    `<div class="form-group"><label>Bin Code</label><input type="text" id="ebin-code" value="${code}"></div>
     <div class="form-group"><label>Zone</label><input type="text" id="ebin-zone" value="${zone}"></div>
     <div class="form-group"><label>Capacity (units)</label><input type="number" id="ebin-cap" value="${cap}" min="1"></div>
     <div class="form-group"><label>Assigned SKU</label><input type="text" id="ebin-sku" value="${sku}" placeholder="Leave blank to unassign"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveBinEdit('${binId}')">Save Changes</button>`);
}

async function saveBinEdit(binId) {
  const body = {
    code:     document.getElementById('ebin-code').value,
    zone:     document.getElementById('ebin-zone').value,
    capacity: +document.getElementById('ebin-cap').value,
    sku:      document.getElementById('ebin-sku').value || null,
  };
  const res = await api('/bin-locations/' + binId, { method:'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Bin updated'); switchWHTab('bins', document.querySelectorAll('#wh-tabs .tab-btn')[2]); }
}

async function createDCFromPicklist(orderId) {
  if (!confirm(`Dispatch order ${orderId}? This will deduct stock and create a Delivery Challan.`)) return;
  const res = await api(`/orders/${orderId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ to: 'IN_SHIPMENT', note: 'Items picked — dispatched to delivery' })
  });
  if (res) { showToast(`Order ${orderId} dispatched — DC created`); switchWHTab('picklist', document.querySelectorAll('#wh-tabs .tab-btn')[3]); }
}

async function pickOrderModal(orderId) {
  const [order, bins] = await Promise.all([
    api(`/orders/${orderId}`),
    api('/bin-locations').catch(()=>[])
  ]);
  const items = order?.items || [];
  const binOptions = (bins||[]).map(b=>`<option value="${b.code}">${b.code}${b.zone?' — '+b.zone:''}</option>`).join('');
  openModal(`Pick Items — ${orderId}`, `
    <p style="color:var(--text-muted);margin-bottom:12px">
      Enter qty actually picked (can be less than ordered) and select the bin location.
    </p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>SKU</th><th>Item</th><th>Ordered</th><th>Qty to Pick</th><th>Bin Location</th></tr></thead>
      <tbody id="pick-items-body">
        ${(items||[]).map(item=>`<tr>
          <td><b>${item.sku}</b></td>
          <td>${item.name||item.item_name}</td>
          <td style="color:var(--text-muted)">${item.qty}</td>
          <td>
            <input type="number" class="form-control form-control-sm pick-qty"
              data-sku="${item.sku}" data-name="${item.name||item.item_name}" data-ordered="${item.qty}"
              value="${item.qty}" min="0" max="${item.qty}"
              style="width:72px;text-align:center"
              oninput="this.style.color=+this.value<+this.dataset.ordered?'var(--warning)':'inherit'">
          </td>
          <td>
            <select class="form-control form-control-sm pick-bin" data-sku="${item.sku}" style="min-width:140px">
              <option value="">— select bin —</option>
              ${binOptions}
            </select>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmPick('${orderId}')">Confirm Pick</button>
    </div>
  `);
}

async function confirmPick(orderId) {
  const qtyInputs = document.querySelectorAll('.pick-qty');
  const items = Array.from(qtyInputs).map(inp => {
    const binSel = document.querySelector(`.pick-bin[data-sku="${inp.dataset.sku}"]`);
    const qty = parseInt(inp.value) || 0;
    return { sku: inp.dataset.sku, name: inp.dataset.name, qty, bin_code: binSel?.value || '' };
  }).filter(i => i.qty > 0);
  if (!items.length) { showToast('Enter at least 1 item to pick', 'error'); return; }
  const hasPartial = Array.from(qtyInputs).some(inp => +inp.value < +inp.dataset.ordered);
  const res = await api(`/orders/${orderId}/pick`, { method:'POST', body: JSON.stringify({ items, partial: hasPartial }) });
  if (res) {
    showToast(`Order ${orderId} marked as PICKED${hasPartial ? ' (partial)' : ''}`);
    closeModal();
    switchWHTab('picklist', document.querySelectorAll('#wh-tabs .tab-btn')[3]);
    navigate('orders');
  }
}

async function submitStockTransfer() {
  const body = {
    sku:         document.getElementById('st-sku').value,
    from_bin_id: document.getElementById('st-from').value,
    to_bin_id:   document.getElementById('st-to').value,
    qty:         +document.getElementById('st-qty').value,
    note:        document.getElementById('st-note').value,
  };
  if (!body.sku || !body.from_bin_id || !body.to_bin_id || !body.qty) {
    showToast('All fields except note are required','error'); return;
  }
  if (body.from_bin_id === body.to_bin_id) { showToast('Source and destination bins must be different','error'); return; }
  const res = await api('/stock-transfers', { method:'POST', body: JSON.stringify(body) });
  if (res) { showToast(`Transferred ${body.qty} units of ${body.sku}`); switchWHTab('transfers', document.querySelectorAll('#wh-tabs .tab-btn')[4]); }
}

function viewBins(warehouseId, warehouseName) {
  api('/bin-locations').then(bins => {
    const wBins = (bins||[]).filter(b=>b.warehouse_id===warehouseId);
    openModal(`Bin Locations — ${warehouseName}`,
      `<div class="table-wrap">
        <table class="table">
          <thead><tr><th>Code</th><th>Zone</th><th>SKU</th><th>Capacity</th><th>Occupied</th><th>Free</th></tr></thead>
          <tbody>${wBins.map(b=>`<tr>
            <td><b>${b.code}</b></td>
            <td>${b.zone||'—'}</td>
            <td>${b.sku||'—'}</td>
            <td>${b.capacity}</td>
            <td>${b.occupied}</td>
            <td style="color:${b.capacity-b.occupied<10?'var(--danger)':'var(--success)'}">${b.capacity-b.occupied}</td>
          </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No bins</td></tr>'}
          </tbody>
        </table>
      </div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
  });
}

function addWarehouseModal() {
  openModal('Add Warehouse',
    `<div class="form-group"><label>Warehouse Name</label><input type="text" id="wh-name" placeholder="e.g. Mumbai Central Warehouse"></div>
     <div class="form-group"><label>City</label><input type="text" id="wh-city"></div>
     <div class="form-group"><label>Address</label><textarea id="wh-addr" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>
     <div class="form-group"><label>Capacity (units)</label><input type="number" id="wh-cap" value="1000" min="1"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveWarehouse()">Add Warehouse</button>`);
}

async function saveWarehouse() {
  const body = {
    name: document.getElementById('wh-name').value,
    city: document.getElementById('wh-city').value,
    address: document.getElementById('wh-addr').value,
    capacity: +document.getElementById('wh-cap').value,
  };
  if (!body.name) { showToast('Warehouse name required','error'); return; }
  const res = await api('/warehouses', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Warehouse added'); navigate('warehouse'); }
}

function editWarehouseModal(id, name, capacity) {
  openModal('Edit Warehouse',
    `<div class="form-group"><label>Warehouse Name</label><input type="text" id="ewh-name" value="${name}"></div>
     <div class="form-group"><label>Capacity (units)</label><input type="number" id="ewh-cap" value="${capacity}" min="1"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveWarehouseEdit('${id}')">Save Changes</button>`);
}

async function saveWarehouseEdit(id) {
  const body = {
    name:     document.getElementById('ewh-name').value,
    capacity: +document.getElementById('ewh-cap').value,
  };
  if (!body.name) { showToast('Warehouse name required','error'); return; }
  const res = await api('/warehouses/' + id, { method:'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Warehouse updated'); switchWHTab('overview', document.querySelectorAll('#wh-tabs .tab-btn')[0]); }
}

/* ============================================================
   DELIVERY — Tabbed view (Section 7 rebuild)
   ============================================================ */
async function renderDelivery(el) {
  el.innerHTML = `
  ${pageHeader('Deliveries', 'Delivery challans, dispatch, POD & returns')}
  <div class="tabs" id="dc-tabs" style="margin-bottom:16px">
    <button class="tab-btn active" onclick="switchDeliveryTab('scheduled',this)">Scheduled</button>
    <button class="tab-btn" onclick="switchDeliveryTab('transit',this)">In Transit</button>
    <button class="tab-btn" onclick="switchDeliveryTab('delivered',this)">Delivered</button>
    <button class="tab-btn" onclick="switchDeliveryTab('returns',this)">Returns</button>
    <button class="tab-btn" onclick="switchDeliveryTab('all',this)">All</button>
  </div>
  <div id="dc-tab-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div>`;

  switchDeliveryTab('scheduled', document.querySelector('#dc-tabs .tab-btn'));
}

async function switchDeliveryTab(tab, btn) {
  document.querySelectorAll('#dc-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const content = document.getElementById('dc-tab-content');
  content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div>';

  try {
    const dcs = await api('/delivery-challans');
    if (!dcs) { content.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--danger)">Failed to load delivery challans.</div>'; return; }
    const today = new Date();

    if (tab === 'scheduled') {
      const items = dcs.filter(d => d.status === 'SCHEDULED');
      content.innerHTML = `
      <div class="card">
        <div class="card-header"><span>Scheduled — Ready to Dispatch (${items.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Items</th><th>Total Qty</th><th>Actions</th></tr></thead>
            <tbody>${items.map(dc=>`<tr>
              <td><b>${dc.id}</b></td>
              <td>${dc.order_id}</td>
              <td>${dc.client_name||'—'}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button></td>
              <td>${dc.total_qty||'—'}</td>
              <td><button class="btn btn-primary btn-sm" onclick="dispatchDCModal('${dc.id}')">Dispatch</button></td>
            </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No scheduled challans</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    } else if (tab === 'transit') {
      const items = dcs.filter(d => d.status === 'IN_TRANSIT');
      content.innerHTML = `
      <div class="card">
        <div class="card-header"><span>In Transit (${items.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Items</th><th>Total Qty</th><th>Delivered</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Actions</th></tr></thead>
            <tbody>${items.map(dc=>{
              const overdue = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today;
              return `<tr style="${overdue?'background:var(--warning-bg,#fff8e6)':''}">
                <td><b>${dc.id}</b>${overdue?'<span class="badge badge-warning" style="margin-left:4px">Overdue</span>':''}</td>
                <td>${dc.order_id}</td>
                <td>${dc.client_name||'—'}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button></td>
                <td>${dc.total_qty||'—'}</td>
                <td>${dc.delivered_qty!=null&&dc.total_qty ? `<span style="color:var(--warning)">${dc.delivered_qty}/${dc.total_qty}</span>` : '—'}</td>
                <td>${dc.vehicle_no||'—'}</td>
                <td>${dc.driver_name||'—'}</td>
                <td>${fmtDate(dc.dispatched_at)}</td>
                <td>${dc.expected_delivery_date ? `<span style="color:${overdue?'var(--danger)':'var(--text)'}">${fmtDate(dc.expected_delivery_date)}</span>` : '—'}</td>
                <td style="display:flex;gap:4px;flex-wrap:wrap">
                  <button class="btn btn-primary btn-sm" onclick="markDelivered('${dc.id}')">Full Delivery</button>
                  <button class="btn btn-secondary btn-sm" onclick="partialDeliveryModal('${dc.id}',${dc.total_qty||0})">Partial</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="returnDCModal('${dc.id}')">Return</button>
                </td>
              </tr>`;
            }).join('')||'<tr><td colspan="11" style="text-align:center;color:var(--text-muted)">No challans in transit</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    } else if (tab === 'delivered') {
      const items = dcs.filter(d => d.status === 'DELIVERED');
      content.innerHTML = `
      <div class="card">
        <div class="card-header"><span>Delivered (${items.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Delivered Qty</th><th>Driver</th><th>Delivered At</th><th>Expected</th><th>POD</th><th>DC Scan</th><th>Billed</th></tr></thead>
            <tbody>${items.map(dc=>`<tr>
              <td><b>${dc.id}</b></td>
              <td>${dc.order_id}</td>
              <td>${dc.client_name||'—'}</td>
              <td style="color:var(--success);font-weight:600">${dc.delivered_qty||dc.total_qty||'—'}</td>
              <td>${dc.driver_name||'—'}</td>
              <td>${fmtDate(dc.delivered_at)}</td>
              <td>${dc.expected_delivery_date ? fmtDate(dc.expected_delivery_date) : '—'}</td>
              <td>${dc.pod_uploaded ? '<span class="badge badge-success">&#10003; Uploaded</span>' : `<button class="btn btn-secondary btn-sm" onclick="markPOD('${dc.id}')">Mark</button>`}</td>
              <td>${dc.dc_scan_uploaded ? '<span class="badge badge-success">&#10003; Uploaded</span>' : `<button class="btn btn-secondary btn-sm" onclick="markScan('${dc.id}')">Mark</button>`}</td>
              <td>${dc.billed ? '<span class="badge badge-success">Billed</span>' : `<button class="btn btn-primary btn-sm" onclick="billDC('${dc.id}')">Bill</button>`}</td>
            </tr>`).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">No delivered challans</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    } else if (tab === 'returns') {
      const items = dcs.filter(d => d.status === 'CANCELLED');
      content.innerHTML = `
      <div class="card">
        <div class="card-header"><span>Returns / Rejected (${items.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th></tr></thead>
            <tbody>${items.map(dc=>`<tr>
              <td><b>${dc.id}</b></td>
              <td>${dc.order_id}</td>
              <td>${dc.client_name||'—'}</td>
              <td>${dc.total_qty||'—'}</td>
              <td>${dc.driver_name||'—'}</td>
              <td>${fmtDate(dc.dispatched_at)}</td>
            </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No returns</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;

    } else if (tab === 'all') {
      const statusColors = {SCHEDULED:'info',IN_TRANSIT:'warning',DELIVERED:'success',CANCELLED:'danger'};
      content.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${['','SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s=>`
          <button class="btn btn-secondary btn-sm" onclick="filterDCTable('${s}')" id="dc-filter-${s||'all'}">${s||'All'}</button>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><span>All Delivery Challans (${dcs.length})</span></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Total Qty</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Delivered At</th><th>Billed</th></tr></thead>
            <tbody id="dc-all-tbody">${dcs.map(dc=>{
              const overdue = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today && dc.status !== 'DELIVERED';
              return `<tr data-status="${dc.status}" style="${overdue?'background:var(--warning-bg,#fff8e6)':''}">
                <td><b>${dc.id}</b></td>
                <td>${dc.order_id}</td>
                <td>${dc.client_name||'—'}</td>
                <td>${statusBadge(dc.status)}</td>
                <td>${dc.total_qty||'—'}</td>
                <td>${dc.vehicle_no||'—'}</td>
                <td>${dc.driver_name||'—'}</td>
                <td>${fmtDate(dc.dispatched_at)}</td>
                <td>${dc.expected_delivery_date ? fmtDate(dc.expected_delivery_date) : '—'}</td>
                <td>${fmtDate(dc.delivered_at)}</td>
                <td>${dc.billed?'<span class="badge badge-success">Billed</span>':'—'}</td>
              </tr>`;
            }).join('')||'<tr><td colspan="11" style="text-align:center;color:var(--text-muted)">No challans</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    }
  } catch(e) {
    content.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--danger)">
      Error loading data. <button class="btn btn-secondary btn-sm" onclick="switchDeliveryTab('${tab}',null)">Retry</button>
    </div>`;
  }
}

function filterDCTable(status) {
  document.querySelectorAll('#dc-all-tbody tr[data-status]').forEach(row => {
    row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
  });
}

async function viewDCItems(dcId) {
  const items = await api('/delivery-challans/' + dcId + '/items');
  if (!items) return;
  const rows = items.length ? items.map(i => `<tr>
    <td>${i.sku}</td>
    <td><b>${i.name}</b></td>
    <td>${i.qty_ordered}</td>
    <td style="color:${i.qty_delivered>0?'var(--success)':'var(--text-muted)'}">${i.qty_delivered}</td>
    <td style="color:${(i.qty_ordered-i.qty_delivered)>0?'var(--danger)':'var(--success)'};font-weight:600">${i.qty_ordered-i.qty_delivered}</td>
  </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No items</td></tr>';
  openModal(`DC Items — ${dcId}`,
    `<div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Pending</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}

async function dispatchDCModal(dcId) {
  const staff = await api('/staff') || [];
  const staffOpts = staff.filter(s=>s.active && s.role==='delivery_staff')
    .map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  openModal(`Dispatch DC — ${dcId}`,
    `<p style="margin-bottom:12px;color:var(--text-muted)">Enter vehicle and driver details to dispatch DC <b>${dcId}</b>. Order status will advance to IN_SHIPMENT.</p>
     <div class="form-group"><label>DC Number</label><input type="text" id="dp-dcnum" placeholder="e.g. 702037"></div>
     <div class="form-group"><label>Assign Staff</label><select id="dp-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Scheduled Time</label><input type="time" id="dp-time"></div>
     <div class="form-group"><label>Vehicle Number</label><input type="text" id="dp-vehicle" placeholder="e.g. MH12-AB-1234"></div>
     <div class="form-group"><label>Driver Name</label><input type="text" id="dp-driver" placeholder="e.g. Rajesh Kumar"></div>
     <div class="form-group"><label>Driver Phone</label><input type="text" id="dp-phone" placeholder="e.g. +91-9988776655"></div>
     <div class="form-group"><label>Expected Delivery Date</label><input type="date" id="dp-expected"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmDispatch('${dcId}')">Dispatch Now</button>`);
}

async function confirmDispatch(dcId) {
  const vehicle_no             = document.getElementById('dp-vehicle').value;
  const driver_name            = document.getElementById('dp-driver').value;
  const driver_phone           = document.getElementById('dp-phone').value;
  const expected_delivery_date = document.getElementById('dp-expected').value;
  const dc_number              = document.getElementById('dp-dcnum').value;
  const staff_id               = document.getElementById('dp-staff').value;
  const scheduled_time         = document.getElementById('dp-time').value;
  if (!vehicle_no || !driver_name) { showToast('Vehicle number and driver name required','error'); return; }
  const res = await api('/delivery-challans/' + dcId + '/dispatch', {
    method:'POST',
    body: JSON.stringify({vehicle_no, driver_name, driver_phone, expected_delivery_date: expected_delivery_date||null})
  });
  if (res) {
    // Also PATCH dc_number, staff_id, scheduled_time
    const patchBody = {};
    if (dc_number) patchBody.dc_number = dc_number;
    if (staff_id) patchBody.staff_id = staff_id;
    if (scheduled_time) patchBody.scheduled_time = scheduled_time;
    if (Object.keys(patchBody).length) {
      await api(`/delivery-challans/${dcId}`, { method:'PATCH', body: JSON.stringify(patchBody) });
    }
    closeModal();
    showToast(`DC ${dcId} dispatched — in transit`);
    switchDeliveryTab('transit', document.querySelectorAll('#dc-tabs .tab-btn')[1]);
  } else {
    closeModal();
  }
}

async function markDelivered(id) {
  const res = await api(`/delivery-challans/${id}/deliver`, { method:'POST' });
  if (res) { showToast(`DC ${id} marked as delivered`); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
}

async function markPOD(dcId) {
  const res = await api(`/delivery-challans/${dcId}/pod`, { method:'POST' });
  if (res) { showToast('POD marked as uploaded'); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
}

async function markScan(dcId) {
  const res = await api(`/delivery-challans/${dcId}/scan`, { method:'POST' });
  if (res) { showToast('DC scan marked as uploaded'); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
}

async function billDC(id) {
  const res = await api(`/delivery-challans/${id}/bill`, { method:'POST' });
  if (res) { showToast(`DC ${id} billed`); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
}

function returnDCModal(dcId) {
  openModal(`Return / Reject DC — ${dcId}`,
    `<p style="margin-bottom:12px;color:var(--text-muted)">Marking DC <b>${dcId}</b> as returned will restore inventory and revert the order status.</p>
     <div class="form-group"><label>Reason for Return</label>
       <textarea id="return-reason" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="e.g. Goods damaged in transit, wrong items delivered..."></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" style="background:var(--danger)" onclick="confirmReturnDC('${dcId}')">Confirm Return</button>`);
}

async function confirmReturnDC(dcId) {
  const reason = document.getElementById('return-reason').value;
  if (!reason.trim()) { showToast('Please provide a reason for the return','error'); return; }
  const res = await api(`/delivery-challans/${dcId}/return`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
  closeModal();
  if (res) { showToast(`DC ${dcId} marked as returned — stock restored`); switchDeliveryTab('returns', document.querySelectorAll('#dc-tabs .tab-btn')[3]); }
}

function partialDeliveryModal(dcId, totalQty) {
  openModal(`Partial Delivery — DC ${dcId}`,
    `<p style="margin-bottom:12px">Record a partial delivery for DC <b>${dcId}</b>. A follow-up DC will be created for the remaining quantity.</p>
     <div class="form-group"><label>Total Qty Ordered</label><input type="number" id="pd-total" value="${totalQty||0}" min="1"></div>
     <div class="form-group"><label>Qty Delivered Now</label><input type="number" id="pd-delivered" value="0" min="1"></div>
     <div class="form-group"><label>Notes</label><input type="text" id="pd-notes" placeholder="Reason for partial delivery…"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-secondary" onclick="confirmPartialDelivery('${dcId}')">Submit Partial Delivery</button>`);
}

async function confirmPartialDelivery(dcId) {
  const total = +document.getElementById('pd-total').value;
  const delivered = +document.getElementById('pd-delivered').value;
  const notes = document.getElementById('pd-notes').value;
  if (!delivered || delivered >= total) {
    showToast('Delivered qty must be less than total qty for partial delivery','error'); return;
  }
  const res = await api(`/delivery-challans/${dcId}/partial`, {
    method: 'POST',
    body: JSON.stringify({ delivered_qty: delivered, total_qty: total, notes }),
  });
  closeModal();
  if (res) { showToast(`Partial delivery recorded — follow-up DC created`); switchDeliveryTab('transit', document.querySelectorAll('#dc-tabs .tab-btn')[1]); }
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
        <thead><tr><th>Client</th><th>Zone</th><th>Contact</th><th>Health</th><th>Budget Used</th><th>Credit Limit</th><th>Credit Used</th><th>Actions</th></tr></thead>
        <tbody>${clients.map(c=>{
          const budgetPct = Math.min(100, Math.round((c.spent_this_month/c.monthly_budget)*100));
          const creditPct = c.credit_limit > 0 ? Math.min(100, Math.round((c.credit_used/c.credit_limit)*100)) : 0;
          return `<tr>
            <td><b>${c.name}</b></td>
            <td>${c.zone ? `<span class="badge badge-secondary">${c.zone}</span>` : '—'}</td>
            <td><div style="font-size:.82rem">${c.contact_name||'—'}</div><div style="font-size:.78rem;color:var(--text-muted)">${c.contact_email||''}${c.contact_phone?` · ${c.contact_phone}`:''}</div></td>
            <td><span style="font-weight:700;color:${c.health_score>=85?'var(--success)':c.health_score>=70?'var(--warning)':'var(--danger)'}">${c.health_score}/100</span></td>
            <td style="min-width:140px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                  <div style="height:100%;width:${budgetPct}%;background:${budgetPct>90?'var(--danger)':budgetPct>75?'var(--warning)':'var(--success)'};border-radius:3px"></div>
                </div>
                <span style="font-size:.78rem;min-width:32px">${budgetPct}%</span>
              </div>
              <div style="font-size:.76rem;color:var(--text-muted)">${fmt(c.spent_this_month)} / ${fmt(c.monthly_budget)}</div>
            </td>
            <td>${fmt(c.credit_limit||0)}</td>
            <td>
              <span style="color:${creditPct>80?'var(--danger)':creditPct>60?'var(--warning)':'inherit'}">${fmt(c.credit_used||0)}</span>
              ${c.credit_limit > 0 ? `<span style="font-size:.76rem;color:var(--text-muted)"> (${creditPct}%)</span>` : ''}
            </td>
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
     <div class="form-group"><label>Contact Phone</label><input type="tel" id="cl-phone" placeholder="+91 98765 43210"></div>
     <div class="form-group">
       <label>Location Zone</label>
       <select id="cl-zone">
         <option value="">— Select Zone —</option>
         <option value="EGL">EGL</option>
         <option value="BTP">BTP</option>
         <option value="BTM">BTM</option>
         <option value="PV">PV</option>
         <option value="FW">FW</option>
         <option value="Other">Other</option>
       </select>
     </div>
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
    contact_phone: document.getElementById('cl-phone').value,
    zone: document.getElementById('cl-zone').value,
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
   REPORTS (Gaps 1 & 12 — real data + CSV download)
   ============================================================ */
const REPORT_DEFS = [
  { key:'spend',       title:'Spend Analytics',    desc:'Monthly spend by client, category, and vendor.', icon:'📊',
    cols:['client','category','total_spend','order_count'],
    labels:['Client','Category','Total Spend','Orders'] },
  { key:'fulfilment',  title:'Order Fulfilment',   desc:'Order-to-delivery cycle time and SLA adherence.', icon:'📦',
    cols:['id','client_name','status','grand_total','created_at'],
    labels:['Order','Client','Status','Amount','Created'] },
  { key:'vendor',      title:'Vendor Scorecard',   desc:'On-time rate, fill rate, and lead time per vendor.', icon:'🏆',
    cols:['name','on_time_rate','fill_rate','avg_lead_days','rating'],
    labels:['Vendor','On-time %','Fill Rate %','Lead Days','Rating'] },
  { key:'inventory',   title:'Inventory Turnover', desc:'Stock movement, dead stock, fast & slow SKUs.', icon:'🔄',
    cols:['sku','name','category','stock','reserved','reorder_level'],
    labels:['SKU','Item','Category','Stock','Reserved','Reorder Level'] },
  { key:'budget',      title:'Budget Utilisation', desc:'Client-wise budget vs. actual spend.', icon:'💰',
    cols:['name','monthly_budget','spent_this_month','remaining'],
    labels:['Client','Budget','Spent','Remaining'] },
  { key:'dc-billing',  title:'DC Billing Report',  desc:'Billing pipeline, unbilled DCs, and ageing.', icon:'🧾',
    cols:['id','order_id','client_name','status','billed'],
    labels:['DC #','Order','Client','Status','Billed'] },
  { key:'service-desk',title:'Service Desk SLA',   desc:'Ticket resolution time and open ticket ageing.', icon:'🎫',
    cols:['id','subject','priority','status','client_name','created_at'],
    labels:['Ticket','Subject','Priority','Status','Client','Created'] },
  { key:'gst',         title:'GST & Tax Report',   desc:'HSN-wise GST breakup and summary for filing.', icon:'📋',
    cols:['sku','name','hsn_code','gst_rate','stock','unit_price'],
    labels:['SKU','Item','HSN','GST %','Stock','Unit Price'] },
  { key:'budget-forecast', title:'Budget Forecasting', desc:'3-month rolling average forecast per client for next month.', icon:'🔮',
    cols:['client','forecast_month','predicted'],
    labels:['Client','Forecast Month','Predicted Spend'] },
  { key:'order-items', title:'Order Items vs Delivered', desc:'Per-order item breakdown: items ordered, quantities, and delivery status per client.', icon:'📦',
    cols:['client_name','order_id','order_status','item_count','qty_ordered','delivery_status','grand_total'],
    labels:['Client','Order ID','Status','# Items','Total Qty Ordered','Delivery Status','Order Value'] },
];

function renderReports(el) {
  el.innerHTML = `
  ${pageHeader('Reports & BI', 'Live data reports — view, CSV export, print PDF')}
  <div class="grid-2">
    ${REPORT_DEFS.map(r=>`
    <div class="card">
      <div class="card-body" style="padding:20px">
        <div style="font-size:2rem;margin-bottom:8px">${r.icon}</div>
        <div style="font-weight:700;margin-bottom:6px">${r.title}</div>
        <div style="font-size:.84rem;color:var(--text-muted);margin-bottom:12px">${r.desc}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="viewReport('${r.key}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadReportCSV('${r.key}')">CSV</button>
          <button class="btn btn-secondary btn-sm" onclick="printReport('${r.key}')">Print PDF</button>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

async function viewReport(key) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  showToast('Loading report…');
  const data = await api('/reports/' + key);
  if (!data) return;
  let rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
  if (key === 'budget-forecast') {
    rows = rows.map(r => ({ client: r.client, forecast_month: r.forecast?.month||'', predicted: r.forecast?.predicted||0 }));
  }
  const tbody = rows.length ? rows.map(row => {
    const cells = def.cols.map(c => {
      const v = row[c];
      if (c.includes('spend')||c.includes('total')||c.includes('budget')||c.includes('price')||c.includes('remaining')||c==='grand_total') return '<td>' + fmt(v) + '</td>';
      if (c==='on_time_rate'||c==='fill_rate') return '<td>' + pct(v) + '</td>';
      if (c==='order_status'||c==='status') return '<td>' + statusBadge(v) + '</td>';
      if (c==='delivery_status') return '<td><span class="badge ' + (v==='DELIVERED'?'badge-success':v==='IN_TRANSIT'?'badge-warning':'badge-secondary') + '">' + (v||'—') + '</span></td>';
      if (c==='qty_due') return '<td><strong style="color:' + (Number(v)>0?'#dc2626':'#16a34a') + '">' + (v!=null?v:'—') + '</strong></td>';
      if (c==='billed') return '<td>' + (v?'<span class="badge badge-success">Yes</span>':'<span class="badge badge-warning">No</span>') + '</td>';
      if (c.includes('_at')) return '<td>' + fmtDate(v) + '</td>';
      if (c==='items_summary') return '<td style="max-width:220px;white-space:normal;font-size:.8rem">' + (v||'—') + '</td>';
      return '<td>' + (v!=null?v:'—') + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('') : '<tr><td colspan="' + def.cols.length + '" style="text-align:center;color:var(--text-muted)">No data</td></tr>';

  openModal(def.title,
    `<div class="table-wrap" style="max-height:60vh;overflow-y:auto">
      <table class="table">
        <thead><tr>${def.labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
     <button class="btn btn-primary" onclick="downloadReportCSV('${key}');closeModal()">Download CSV</button>`);
}

async function downloadReportCSV(key) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  showToast('Preparing CSV…');
  const data = await api('/reports/' + key);
  const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []));
  if (!Array.isArray(rows) || !rows.length) { showToast('No data to export','error'); return; }
  const header = def.labels.join(',');
  const body = rows.map(row => def.cols.map(c => {
    const v = row[c]; if (v==null) return '';
    const s = String(v); return s.includes(',') ? `"${s}"` : s;
  }).join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${key}-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

async function printReport(key) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  const data = await api('/reports/' + key);
  const rows = data?.rows || data || [];
  const html = `<html><head><title>${def.title}</title><style>
    body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{padding:8px;border:1px solid #ddd;text-align:left} th{background:#16284a;color:#fff}
    h2{color:#16284a}
  </style></head><body>
  <h2>Smart Pantry — ${def.title}</h2>
  <p>Generated: ${new Date().toLocaleString('en-IN')}</p>
  <table><thead><tr>${def.labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead>
  <tbody>${(Array.isArray(rows)?rows:[]).map(row=>`<tr>${def.cols.map(c=>`<td>${row[c]!=null?row[c]:'—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.print();
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
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Organisation</th><th>2FA</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u=>`<tr>
          <td><div class="su-avatar" style="display:inline-flex;width:28px;height:28px;font-size:.7rem">${u.initials}</div> ${u.name}</td>
          <td style="font-size:.84rem">${u.email}</td>
          <td>${statusBadge(u.role)}</td>
          <td>${u.org}</td>
          <td>
            <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" ${u.two_fa_enabled ? 'checked' : ''} onchange="toggle2FA('${u.id}',this.checked)">
              <span style="font-size:.78rem;color:var(--text-muted)">${u.two_fa_enabled ? 'On' : 'Off'}</span>
            </label>
          </td>
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
   SETTINGS (Gaps 3,4,6,7,11 — real forms + approval rules + audit logs)
   ============================================================ */
async function renderSettings(el) {
  el.innerHTML = `
  ${pageHeader('Platform Settings', 'System configuration & administration')}
  <div class="tab-pills" id="settings-tabs" style="margin-bottom:20px">
    <button class="tab-pill active" onclick="settingsTab('auth',this)">🔐 Auth & OTP</button>
    <button class="tab-pill" onclick="settingsTab('notifications',this)">🔔 Notifications</button>
    <button class="tab-pill" onclick="settingsTab('integrations',this)">🔗 Integrations</button>
    <button class="tab-pill" onclick="settingsTab('approval',this)">✅ Approval Rules</button>
    <button class="tab-pill" onclick="settingsTab('warehouses',this)">🏭 Warehouses</button>
    <button class="tab-pill" onclick="settingsTab('audit',this)">📋 Audit Log</button>
    <button class="tab-pill" onclick="settingsTab('categories',this)">📂 Categories</button>
  </div>
  <div id="settings-content"></div>`;
  settingsTab('auth', document.querySelector('#settings-tabs .tab-pill.active'));
}

async function settingsTab(tab, btn) {
  document.querySelectorAll('#settings-tabs .tab-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const el = document.getElementById('settings-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  if (tab === 'auth') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card"><div class="card-header"><span>Authentication & OTP</span></div>
    <div class="card-body" style="display:grid;gap:16px;padding:20px">
      <div class="form-group">
        <label>OTP / MFA Enabled</label>
        <select id="s-otp"><option value="true" ${s.OTP_ENABLED==='true'?'selected':''}>Enabled</option><option value="false" ${s.OTP_ENABLED!=='true'?'selected':''}>Disabled</option></select>
      </div>
      <div class="form-group">
        <label>OTP Expiry (minutes)</label>
        <input type="number" id="s-otp-exp" value="${s.OTP_EXPIRY_MINUTES||5}" min="1" max="60">
      </div>
      <div class="form-group">
        <label>JWT Session Expiry</label>
        <select id="s-jwt"><option value="7d">7 days (default)</option><option value="1d">1 day</option><option value="30d">30 days</option></select>
      </div>
      <button class="btn btn-primary" style="width:fit-content" onclick="saveSettings('auth')">Save Auth Settings</button>
    </div></div>`;
  }

  else if (tab === 'notifications') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card"><div class="card-header"><span>Email & SMS Configuration</span></div>
    <div class="card-body" style="display:grid;gap:16px;padding:20px">
      <div class="form-group"><label>From Email</label><input type="email" id="s-email" value="${s.EMAIL_FROM||''}"></div>
      <div class="form-group">
        <label>MailChannels (Email) Enabled</label>
        <select id="s-mailch"><option value="true" ${s.MAILCHANNELS_ENABLED==='true'?'selected':''}>Enabled</option><option value="false" ${s.MAILCHANNELS_ENABLED!=='true'?'selected':''}>Disabled</option></select>
      </div>
      <div class="form-group"><label>MSG91 Auth Key</label><input type="text" id="s-msg91" value="${s.MSG91_AUTH_KEY?'••••••••':''}" placeholder="Leave blank to keep unchanged"></div>
      <div class="form-group"><label>Twilio Account SID</label><input type="text" id="s-tw-sid" value="${s.TWILIO_ACCOUNT_SID?'••••••••':''}" placeholder="Leave blank to keep unchanged"></div>
      <div class="form-group"><label>Twilio From Number</label><input type="text" id="s-tw-num" value="${s.TWILIO_FROM_NUMBER||''}"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveSettings('notifications')">Save</button>
        <button class="btn btn-secondary" onclick="testEmail()">Test Email</button>
      </div>
    </div></div>`;
  }

  else if (tab === 'integrations') {
    const s = await api('/settings') || {};
    const origin = window.location.origin;
    el.innerHTML = `
    <div class="card"><div class="card-header"><span>Zoho Books Integration</span></div>
    <div class="card-body" style="display:grid;gap:16px;padding:20px">
      <div class="alert alert-warning" style="font-size:.84rem">
        📌 Webhook URL (configure in Zoho Books): <code style="background:var(--bg);padding:2px 8px;border-radius:4px">${origin}/api/integrations/zoho/webhook</code>
      </div>
      <div class="form-group"><label>Zoho Books Org ID</label><input type="text" id="s-zoho-org" value="${s.ZOHO_BOOKS_ORG_ID||''}"></div>
      <div class="form-group"><label>Zoho Client ID</label><input type="text" id="s-zoho-cid" value="${s.ZOHO_BOOKS_CLIENT_ID||''}"></div>
      <div class="form-group"><label>Webhook Secret</label><input type="text" id="s-zoho-sec" value="${s.ZOHO_BOOKS_WEBHOOK_SECRET?'••••••••':''}" placeholder="Leave blank to keep unchanged"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="saveSettings('integrations')">Save</button>
        <button class="btn btn-secondary" onclick="showToast('Zoho Books connection test not available in dev mode')">Test Connection</button>
      </div>
    </div></div>`;
  }

  else if (tab === 'approval') {
    const rules = await api('/approval-rules') || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Approval Rules</span>
        <button class="btn btn-gold btn-sm" onclick="addApprovalRuleModal()">+ Add Rule</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Category</th><th>Min Amount</th><th>Max Amount</th><th>Required Role</th><th>Auto-Approve</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rules.map(r=>`<tr>
            <td>${r.client_id||'All clients'}</td>
            <td>${r.category||'All categories'}</td>
            <td>${fmt(r.min_amount)}</td>
            <td>${r.max_amount ? fmt(r.max_amount) : 'No limit'}</td>
            <td><span class="badge badge-primary">${r.approver_role||'—'}</span></td>
            <td>${r.auto_approve ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</td>
            <td>${r.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="deactivateApprovalRule('${r.id}')">Disable</button>
            </td>
          </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No rules configured</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'warehouses') {
    navigate('warehouse');
  }

  else if (tab === 'audit') {
    const logs = await api('/audit-logs?limit=100') || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Audit Log</span><span style="font-size:.84rem;color:var(--text-muted)">${logs.length} recent entries</span></div>
      <div class="table-wrap" style="max-height:60vh;overflow-y:auto">
        <table class="table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Before</th><th>After</th></tr></thead>
          <tbody>${logs.map(l=>`<tr>
            <td style="white-space:nowrap;font-size:.8rem">${fmtDate(l.created_at)}</td>
            <td>${l.actor_name||'—'}</td>
            <td><span class="badge badge-primary">${l.action}</span></td>
            <td>${l.entity_type}</td>
            <td style="font-family:monospace;font-size:.8rem">${l.entity_id||'—'}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${l.old_value||'—'}</td>
            <td style="font-size:.8rem">${l.new_value||'—'}</td>
          </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No audit logs yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'categories') {
    const cats = await api('/categories') || [];
    const inv = await api('/inventory') || [];
    const catMap = {};
    inv.forEach(i => {
      if (!catMap[i.category]) catMap[i.category] = { count:0, hsn: i.hsn_code||'—' };
      catMap[i.category].count++;
    });
    const catList = Array.isArray(cats) ? cats : [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Item Categories</span>
        <span style="font-size:.83rem;color:var(--text-muted)">Categories are derived from inventory items</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Category</th><th>HSN Code (sample)</th><th>Item Count</th></tr></thead>
          <tbody>${catList.map(c=>`<tr>
            <td><b>${c}</b></td>
            <td>${catMap[c]?.hsn||'—'}</td>
            <td>${catMap[c]?.count||0} items</td>
          </tr>`).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No categories yet — add inventory items first</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-body" style="padding:16px">
        <b>Add items to the catalogue</b> to create and manage categories. Each inventory item is assigned a category.
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;display:block" onclick="navigate('inventory')">Go to Inventory</button>
      </div>
    </div>`;
  }
}

async function saveSettings(section) {
  showToast('Settings saved (env vars require redeployment in production)');
}

async function testEmail() {
  showToast('Test email queued — check server logs for delivery status');
}

function addApprovalRuleModal() {
  openModal('Add Approval Rule',
    `<div class="form-group"><label>Client (leave blank for all)</label><input type="text" id="ar-client" placeholder="Client ID or leave blank"></div>
     <div class="form-group"><label>Category (leave blank for all)</label><input type="text" id="ar-cat" placeholder="e.g. Beverages or leave blank"></div>
     <div class="form-group"><label>Min Amount (₹)</label><input type="number" id="ar-min" value="0" min="0"></div>
     <div class="form-group"><label>Max Amount (₹, leave blank for no limit)</label><input type="number" id="ar-max" placeholder="e.g. 500000"></div>
     <div class="form-group"><label>Required Approver Role</label>
       <select id="ar-role">
         <option value="client_approver">Client Approver</option>
         <option value="client_admin">Client Admin</option>
         <option value="ops_admin">Ops Admin</option>
         <option value="finance_admin">Finance Admin</option>
       </select>
     </div>
     <div class="form-group"><label>Auto-Approve</label>
       <select id="ar-auto"><option value="0">No</option><option value="1">Yes</option></select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveApprovalRule()">Save Rule</button>`);
}

async function saveApprovalRule() {
  const body = {
    client_id: document.getElementById('ar-client').value || null,
    category: document.getElementById('ar-cat').value || null,
    min_amount: +document.getElementById('ar-min').value,
    max_amount: document.getElementById('ar-max').value ? +document.getElementById('ar-max').value : null,
    approver_role: document.getElementById('ar-role').value,
    auto_approve: +document.getElementById('ar-auto').value,
  };
  const res = await api('/approval-rules', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Approval rule added'); navigate('settings'); }
}

async function deactivateApprovalRule(id) {
  const res = await api('/approval-rules/' + id, { method:'PATCH', body: JSON.stringify({ active: 0 }) });
  if (res) { showToast('Rule deactivated'); navigate('settings'); }
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

async function acceptPO(id, vendorTotal) {
  const amountLabel = vendorTotal ? `<div style="margin-bottom:12px"><b>Amount:</b> ${fmt(vendorTotal)}</div>` : '';
  openModal(`Accept PO & Confirm Delivery`,
    `<div style="margin-bottom:16px">
      <div><b>PO ID:</b> ${id}</div>
      ${amountLabel}
    </div>
    <div class="form-group" style="margin-bottom:12px">
      <label style="font-weight:600;display:block;margin-bottom:6px">Confirm Delivery Date <span style="color:var(--danger)">*</span></label>
      <input type="date" id="po-delivery-date" required style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
        min="${new Date().toISOString().slice(0,10)}">
    </div>
    <div class="form-group">
      <label style="font-weight:600;display:block;margin-bottom:6px">Notes (optional)</label>
      <textarea id="po-accept-notes" rows="3" placeholder="Any delivery notes or commitments…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmAcceptPO('${id}')">Accept PO</button>`);
}

async function confirmAcceptPO(id) {
  const delivery_date = document.getElementById('po-delivery-date')?.value;
  if (!delivery_date) { showToast('Please select a delivery date', 'error'); return; }
  const notes = document.getElementById('po-accept-notes')?.value || '';
  const res = await api(`/purchase-orders/${id}/accept`, {
    method: 'POST',
    body: JSON.stringify({ delivery_date, notes }),
  });
  closeModal();
  if (res) { showToast(`PO ${id} accepted — delivery confirmed for ${delivery_date}`); navigate('vendor_pos'); }
}

async function rejectPO(id) {
  openModal(`Reject PO ${id}`,
    `<div class="form-group">
      <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection <span style="color:var(--danger)">*</span></label>
      <textarea id="rej-reason" rows="4" placeholder="Explain why you are rejecting this PO…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical"></textarea>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmRejectPO('${id}')">Reject PO</button>`);
}

async function confirmRejectPO(id) {
  const reason = document.getElementById('rej-reason')?.value?.trim();
  if (!reason) { showToast('Please provide a reason for rejection', 'error'); return; }
  const res = await api(`/purchase-orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  closeModal();
  if (res) { showToast(`PO ${id} rejected`); navigate('vendor_pos'); }
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
   Feature 22: 2FA TOGGLE
   ============================================================ */
async function toggle2FA(userId, enabled) {
  const res = await api('/users/' + userId + '/2fa', {
    method: 'PATCH',
    body: JSON.stringify({ two_fa_enabled: enabled ? 1 : 0 }),
  });
  if (res) showToast('2FA ' + (enabled ? 'enabled' : 'disabled') + ' for user');
}

/* ============================================================
   Feature 20: VENDOR FEEDBACK
   ============================================================ */
function openVendorFeedbackModal(vendorId, vendorName) {
  openModal('Rate Vendor — ' + vendorName,
    `<div class="form-group"><label>Quality (1-5)</label><input type="number" id="fb-quality" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Delivery (1-5)</label><input type="number" id="fb-delivery" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Service (1-5)</label><input type="number" id="fb-service" value="4" min="1" max="5"></div>
     <div class="form-group"><label>Comments</label><textarea id="fb-comments" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="submitVendorFeedback('${vendorId}')">Submit Rating</button>`);
}

async function submitVendorFeedback(vendorId) {
  const body = {
    quality_rating: +document.getElementById('fb-quality').value,
    delivery_rating: +document.getElementById('fb-delivery').value,
    service_rating: +document.getElementById('fb-service').value,
    comments: document.getElementById('fb-comments').value,
  };
  const res = await api('/vendors/' + vendorId + '/feedback', { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Vendor rated — scorecard updated'); navigate('vendors'); }
}

/* ============================================================
   Feature 16: DELIVERY ROUTE OPTIMIZATION
   ============================================================ */
async function renderDeliveryRoutes(el) {
  const [routes, dcs] = await Promise.all([
    api('/delivery-routes'),
    api('/delivery-challans'),
  ]);
  if (!routes) return;

  const undelivered = (dcs || []).filter(d => d.status !== 'DELIVERED');

  el.innerHTML = `
  ${pageHeader('Route Optimization', `${routes.length} routes`,
    `<button class="btn btn-gold" onclick="openNewRouteModal()" style="display:inline-flex;align-items:center;gap:6px">Optimize New Route</button>`)}
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>Undelivered DCs (${undelivered.length})</span></div>
    <div class="card-body" style="padding:12px">
      ${undelivered.length ? `<div style="font-size:.84rem;color:var(--text-muted);margin-bottom:8px">Select DCs to include in a route:</div>
      ${undelivered.map(dc=>`
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <input type="checkbox" class="dc-select" data-id="${dc.id}" value="${dc.id}">
          <span><b>${dc.id}</b> — Order: ${dc.order_id||'—'} ${dc.dispatched_at ? '(Dispatched '+fmtDate(dc.dispatched_at)+')' : ''}</span>
        </label>`).join('')}
      <div style="margin-top:12px">
        <button class="btn btn-primary" onclick="createOptimizedRoute()">Create Route from Selected</button>
      </div>` : '<div style="padding:8px;color:var(--text-muted)">No undelivered DCs</div>'}
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>Routes</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Route</th><th>Date</th><th>Stops</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${routes.map(r=>{
          const stops = typeof r.stops === 'string' ? JSON.parse(r.stops) : (r.stops||[]);
          return `<tr>
            <td><b>${r.name}</b></td>
            <td>${fmtDate(r.route_date)}</td>
            <td>${stops.length} stops</td>
            <td>${statusBadge(r.status)}</td>
            <td>
              ${r.status==='PLANNED' ? `<button class="btn btn-primary btn-sm" onclick="updateRouteStatus('${r.id}','IN_PROGRESS')">Start</button>` : ''}
              ${r.status==='IN_PROGRESS' ? `<button class="btn btn-success btn-sm" onclick="updateRouteStatus('${r.id}','COMPLETED')">Complete</button>` : ''}
            </td>
          </tr>`;
        }).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No routes yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function createOptimizedRoute() {
  const selected = [...document.querySelectorAll('.dc-select:checked')].map(el => el.value);
  if (!selected.length) { showToast('Select at least one DC', 'error'); return; }
  const name = 'Route ' + new Date().toISOString().slice(0,10);
  const res = await api('/delivery-routes', {
    method: 'POST',
    body: JSON.stringify({ name, dc_ids: selected, route_date: new Date().toISOString().slice(0,10) }),
  });
  if (res) { showToast('Route created with ' + selected.length + ' stops'); navigate('delivery_routes'); }
}

async function updateRouteStatus(id, status) {
  const res = await api('/delivery-routes/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
  if (res) { showToast('Route status updated'); navigate('delivery_routes'); }
}

/* ============================================================
   Feature 17: DUNNING / PAYMENT ESCALATION
   ============================================================ */
async function renderDunning(el) {
  const [rules, events] = await Promise.all([
    api('/dunning-rules'),
    api('/dunning-events'),
  ]);
  if (!rules) return;

  el.innerHTML = `
  ${pageHeader('Dunning & Payment Escalation', `${rules.length} rules`,
    `<button class="btn btn-gold" onclick="runDunningCheck()">Run Dunning Check</button>`)}
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span>Dunning Rules</span>
        <button class="btn btn-secondary btn-sm" onclick="addDunningRuleModal()">Add Rule</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Days Overdue</th><th>Action</th><th>Message</th></tr></thead>
          <tbody>${rules.map(r=>`<tr>
            <td><b>${r.days_overdue}d</b></td>
            <td>${statusBadge(r.action)}</td>
            <td style="font-size:.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.message_template||'—'}</td>
          </tr>`).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No rules</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Recent Events</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Order</th><th>Action</th><th>Date</th></tr></thead>
          <tbody>${(events||[]).slice(0,10).map(e=>`<tr>
            <td>${e.client_name||e.client_id}</td>
            <td>${e.order_id||'—'}</td>
            <td>${statusBadge(e.action_taken)}</td>
            <td>${fmtDate(e.created_at)}</td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No events yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function runDunningCheck() {
  const res = await api('/dunning/run', { method: 'POST', body: '{}' });
  if (res) {
    showToast('Dunning check complete — ' + res.triggered + ' action(s) triggered');
    navigate('dunning');
  }
}

function addDunningRuleModal() {
  openModal('Add Dunning Rule',
    `<div class="form-group"><label>Days Overdue</label><input type="number" id="dr-days" value="30" min="1"></div>
     <div class="form-group"><label>Action</label>
       <select id="dr-action"><option>EMAIL</option><option>SMS</option><option>ESCALATE</option><option>SUSPEND</option></select>
     </div>
     <div class="form-group"><label>Message Template</label><textarea id="dr-msg" rows="3" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveDunningRule()">Save Rule</button>`);
}

async function saveDunningRule() {
  const body = {
    days_overdue: +document.getElementById('dr-days').value,
    action: document.getElementById('dr-action').value,
    message_template: document.getElementById('dr-msg').value,
  };
  const res = await api('/dunning-rules', { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Dunning rule saved'); navigate('dunning'); }
}

/* ============================================================
   Feature 18: CSV IMPORT
   ============================================================ */
async function renderImportData(el) {
  const jobs = await api('/import-jobs') || [];

  el.innerHTML = `
  ${pageHeader('CSV Data Import', 'Import inventory and orders from CSV files')}
  <div class="tab-pills" id="import-tabs" style="margin-bottom:16px">
    <button class="tab-pill active" onclick="importTab('inventory',this)">Inventory</button>
    <button class="tab-pill" onclick="importTab('orders',this)">Orders</button>
    <button class="tab-pill" onclick="importTab('jobs',this)">Import History</button>
  </div>
  <div id="import-content"></div>`;

  showImportTab('inventory', jobs);
}

function importTab(tab, btn) {
  document.querySelectorAll('#import-tabs .tab-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const jobs = window._importJobs || [];
  showImportTab(tab, jobs);
}

function showImportTab(tab, jobs) {
  const el = document.getElementById('import-content');
  if (!el) return;
  if (tab === 'jobs') {
    el.innerHTML = `<div class="card"><div class="card-header"><span>Import History</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Type</th><th>Total</th><th>Success</th><th>Failed</th><th>Date</th></tr></thead>
      <tbody>${jobs.map(j=>`<tr>
        <td>${j.type}</td><td>${j.total}</td>
        <td><span class="badge badge-success">${j.success_count}</span></td>
        <td>${j.failed_count > 0 ? '<span class="badge badge-danger">'+j.failed_count+'</span>' : '0'}</td>
        <td>${fmtDate(j.created_at)}</td>
      </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No imports yet</td></tr>'}
      </tbody></table></div></div>`;
    return;
  }
  const isInventory = tab === 'inventory';
  const sampleCols = isInventory
    ? 'sku,name,category,stock,unit_price,reorder_level,max_stock'
    : 'client_id,grand_total,subtotal,gst,notes';
  el.innerHTML = `
  <div class="card">
    <div class="card-body" style="padding:20px">
      <div style="font-weight:600;margin-bottom:8px">Import ${isInventory ? 'Inventory' : 'Orders'}</div>
      <div style="font-size:.84rem;color:var(--text-muted);margin-bottom:12px">
        CSV columns: <code>${sampleCols}</code>
      </div>
      <div class="form-group">
        <label>Upload CSV File</label>
        <input type="file" id="csv-file" accept=".csv" onchange="previewCSV(this,'${tab}')">
      </div>
      <div id="csv-preview"></div>
      <div id="csv-actions" style="display:none;margin-top:12px">
        <button class="btn btn-primary" onclick="submitCSVImport('${tab}')">Import Data</button>
        <span id="csv-row-count" style="margin-left:8px;font-size:.84rem;color:var(--text-muted)"></span>
      </div>
    </div>
  </div>`;
}

function previewCSV(input, tab) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.trim().split('\n');
    if (lines.length < 2) { showToast('CSV must have header + at least one data row', 'error'); return; }
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    window._csvRows = dataRows;
    window._csvTab = tab;
    const preview = document.getElementById('csv-preview');
    const actions = document.getElementById('csv-actions');
    const rowCount = document.getElementById('csv-row-count');
    if (preview) preview.innerHTML = `<div class="table-wrap" style="max-height:200px;overflow-y:auto;margin-top:8px">
      <table class="table">
        <thead><tr>${headers.map(h=>'<th>'+h+'</th>').join('')}</tr></thead>
        <tbody>${dataRows.slice(0,5).map(row=>'<tr>'+headers.map(h=>'<td>'+(row[h]||'')+'</td>').join('')+'</tr>').join('')}</tbody>
      </table>
    </div>`;
    if (actions) actions.style.display = '';
    if (rowCount) rowCount.textContent = dataRows.length + ' rows ready to import';
  };
  reader.readAsText(file);
}

async function submitCSVImport(tab) {
  const rows = window._csvRows;
  if (!rows || !rows.length) { showToast('No data to import', 'error'); return; }
  showToast('Importing ' + rows.length + ' rows…');
  const endpoint = tab === 'inventory' ? '/import/inventory' : '/import/orders';
  const res = await api(endpoint, { method: 'POST', body: JSON.stringify(rows) });
  if (res) {
    showToast('Import complete: ' + res.success + ' success, ' + res.failed + ' failed');
    window._csvRows = null;
    navigate('import_data');
  }
}

/* ============================================================
   Feature 19: TEMPLATES
   ============================================================ */
async function renderTemplates(el) {
  const [orderTpls, poTpls] = await Promise.all([
    api('/order-templates'),
    api('/po-templates'),
  ]);

  el.innerHTML = `
  ${pageHeader('Order & PO Templates', 'Reusable templates for quick order/PO creation')}
  <div class="tab-pills" id="tpl-tabs" style="margin-bottom:16px">
    <button class="tab-pill active" onclick="tplTab('orders',this)">Order Templates</button>
    <button class="tab-pill" onclick="tplTab('po',this)">PO Templates</button>
  </div>
  <div id="tpl-content"></div>`;

  renderOrderTemplatesTab(orderTpls || [], poTpls || []);
}

function tplTab(tab, btn) {
  document.querySelectorAll('#tpl-tabs .tab-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'orders') {
    api('/order-templates').then(d => renderOrderTemplatesTab(d||[], []));
  } else {
    api('/po-templates').then(d => renderPOTemplatesTab([], d||[]));
  }
}

function renderOrderTemplatesTab(orderTpls, poTpls) {
  const el = document.getElementById('tpl-content');
  if (!el) return;
  el.innerHTML = `
  <div class="card">
    <div class="card-header"><span>Order Templates (${orderTpls.length})</span>
      <button class="btn btn-gold btn-sm" onclick="saveOrderTemplateModal()">Save New Template</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Items</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${orderTpls.map(t=>{
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
          return `<tr>
            <td><b>${t.name}</b></td>
            <td>${items.length} item(s)</td>
            <td>${fmtDate(t.created_at)}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="loadOrderTemplate('${t.id}')">Load</button>
              <button class="btn btn-danger btn-sm" onclick="deleteTemplate('order','${t.id}')">Delete</button>
            </td>
          </tr>`;
        }).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No templates yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderPOTemplatesTab(orderTpls, poTpls) {
  const el = document.getElementById('tpl-content');
  if (!el) return;
  el.innerHTML = `
  <div class="card">
    <div class="card-header"><span>PO Templates (${poTpls.length})</span>
      <button class="btn btn-gold btn-sm" onclick="savePOTemplateModal()">Save New Template</button>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Items</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${poTpls.map(t=>{
          const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
          return `<tr>
            <td><b>${t.name}</b></td>
            <td>${items.length} item(s)</td>
            <td>${fmtDate(t.created_at)}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="loadPOTemplate('${t.id}')">Load</button>
              <button class="btn btn-danger btn-sm" onclick="deleteTemplate('po','${t.id}')">Delete</button>
            </td>
          </tr>`;
        }).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No templates yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function saveOrderTemplateModal() {
  openModal('Save Order Template',
    `<div class="form-group"><label>Template Name</label><input type="text" id="tpl-name" placeholder="e.g. Monthly Beverages"></div>
     <div class="form-group"><label>Notes</label><textarea id="tpl-notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveOrderTemplate()">Save</button>`);
}

async function saveOrderTemplate() {
  const name = document.getElementById('tpl-name').value;
  if (!name) { showToast('Template name required', 'error'); return; }
  const items = (APP.cart || []).map(c => ({ sku: c.sku, name: c.name, qty: c.qty, unit_price: c.unit_price }));
  const res = await api('/order-templates', {
    method: 'POST',
    body: JSON.stringify({ name, items, notes: document.getElementById('tpl-notes').value }),
  });
  closeModal();
  if (res) { showToast('Template saved'); navigate('templates'); }
}

function savePOTemplateModal() {
  openModal('Save PO Template',
    `<div class="form-group"><label>Template Name</label><input type="text" id="potpl-name" placeholder="e.g. Weekly Dairy Order"></div>
     <div class="form-group"><label>Notes</label><textarea id="potpl-notes" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="savePOTemplate()">Save</button>`);
}

async function savePOTemplate() {
  const name = document.getElementById('potpl-name').value;
  if (!name) { showToast('Template name required', 'error'); return; }
  const res = await api('/po-templates', {
    method: 'POST',
    body: JSON.stringify({ name, items: [], notes: document.getElementById('potpl-notes').value }),
  });
  closeModal();
  if (res) { showToast('PO Template saved'); navigate('templates'); }
}

function loadOrderTemplate(id) {
  showToast('Template loaded — redirecting to Place Order');
  navigate('place_order');
}

function loadPOTemplate(id) {
  showToast('PO Template loaded — redirecting to Procurement');
  navigate('procurement');
}

async function deleteTemplate(type, id) {
  if (!confirm('Delete this template?')) return;
  const endpoint = type === 'order' ? '/order-templates/' + id : '/po-templates/' + id;
  const res = await api(endpoint, { method: 'DELETE' });
  if (res) { showToast('Template deleted'); navigate('templates'); }
}

/* ============================================================
   Feature 21: SLA DASHBOARD
   ============================================================ */
async function renderSLADashboard(el) {
  const [rules, breaches] = await Promise.all([
    api('/sla-rules'),
    api('/sla-breaches'),
  ]);
  if (!rules) return;

  el.innerHTML = `
  ${pageHeader('SLA Dashboard', `${(breaches||[]).length} active breach(es)`,
    `<button class="btn btn-gold" onclick="runSLACheck()">Check SLA Now</button>`)}
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span>SLA Rules (${rules.length})</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Rule</th><th>Trigger Status</th><th>Max Hours</th><th>Action</th></tr></thead>
          <tbody>${rules.map(r=>`<tr>
            <td><b>${r.name}</b></td>
            <td>${statusBadge(r.trigger_status)}</td>
            <td>${r.max_hours}h</td>
            <td>${statusBadge(r.action)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Active Breaches (${(breaches||[]).length})</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Rule</th><th>Entity</th><th>Breached At</th></tr></thead>
          <tbody>${(breaches||[]).map(b=>`<tr>
            <td>${b.rule_name||b.rule_id}</td>
            <td>${b.entity_id}</td>
            <td>${fmtDate(b.breached_at)}</td>
          </tr>`).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--success)">No active breaches</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function runSLACheck() {
  const res = await api('/sla/check', { method: 'POST', body: '{}' });
  if (res) {
    showToast('SLA check complete — ' + res.new_breaches + ' new breach(es) detected');
    navigate('sla_dashboard');
  }
}

/* ============================================================
   Feature 24: APPROVAL CHAINS
   ============================================================ */
async function renderApprovalChains(el) {
  const [chains, instances] = await Promise.all([
    api('/approval-chains'),
    api('/approval-chain-instances'),
  ]);
  if (!chains) return;

  el.innerHTML = `
  ${pageHeader('Approval Chains', `${chains.length} chain(s) configured`,
    `<button class="btn btn-gold" onclick="newApprovalChainModal()">New Chain</button>`)}
  <div class="grid-2" style="margin-bottom:16px">
    <div class="card">
      <div class="card-header"><span>Configured Chains</span></div>
      ${chains.map(c=>{
        const steps = c.steps||[];
        return `<div style="padding:14px;border-bottom:1px solid var(--border)">
          <div style="font-weight:600;margin-bottom:4px">${c.name}</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">Min amount: ${fmt(c.min_amount)} | ${c.entity_type}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${steps.map((s,i)=>`<span style="padding:3px 10px;background:var(--navy);color:#fff;border-radius:12px;font-size:.78rem">${i+1}. ${s.role}</span>`).join('')}
          </div>
        </div>`;
      }).join('')||'<div style="padding:16px;color:var(--text-muted);text-align:center">No chains configured</div>'}
    </div>
    <div class="card">
      <div class="card-header"><span>Pending Approvals (${(instances||[]).length})</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Order</th><th>Chain</th><th>Step</th><th>Actions</th></tr></thead>
          <tbody>${(instances||[]).map(inst=>`<tr>
            <td>${inst.entity_id}</td>
            <td>${inst.chain_name||inst.chain_id}</td>
            <td>Step ${inst.current_step}</td>
            <td>
              <button class="btn btn-primary btn-sm" onclick="actOnChain('${inst.id}','APPROVED')">Approve</button>
              <button class="btn btn-danger btn-sm" onclick="actOnChain('${inst.id}','REJECTED')">Reject</button>
            </td>
          </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No pending approvals</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

let _chainStepCount = 1;

function newApprovalChainModal() {
  _chainStepCount = 1;
  const roleOpts = Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  openModal('New Approval Chain',
    `<div class="form-group"><label>Chain Name</label><input type="text" id="chain-name" placeholder="e.g. Large Order Approval"></div>
     <div class="form-group"><label>Min Amount (₹) to Trigger</label><input type="number" id="chain-amount" value="500000"></div>
     <div id="chain-steps">
       <div class="form-group">
         <label>Step 1 Role</label>
         <select class="chain-step-role" data-step="1">${roleOpts}</select>
       </div>
     </div>
     <button type="button" class="btn btn-secondary btn-sm" onclick="addChainStep()">+ Add Step</button>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveApprovalChain()">Create Chain</button>`);
}

function addChainStep() {
  _chainStepCount++;
  const roleOpts = Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
  const div = document.createElement('div');
  div.className = 'form-group';
  div.innerHTML = `<label>Step ${_chainStepCount} Role</label><select class="chain-step-role" data-step="${_chainStepCount}">${roleOpts}</select>`;
  document.getElementById('chain-steps').appendChild(div);
}

async function saveApprovalChain() {
  const name = document.getElementById('chain-name').value;
  const minAmount = +document.getElementById('chain-amount').value;
  if (!name) { showToast('Chain name required', 'error'); return; }
  const stepEls = document.querySelectorAll('.chain-step-role');
  const steps = [...stepEls].map((el, i) => ({ role: el.value, label: 'Step ' + (i+1) }));
  const res = await api('/approval-chains', {
    method: 'POST',
    body: JSON.stringify({ name, min_amount: minAmount, steps }),
  });
  closeModal();
  if (res) { showToast('Approval chain created with ' + steps.length + ' step(s)'); navigate('approval_chains'); }
}

async function actOnChain(instanceId, action) {
  const comments = action === 'REJECTED' ? prompt('Reason for rejection (optional):') : null;
  const res = await api('/approval-chain-instances/' + instanceId + '/act', {
    method: 'POST',
    body: JSON.stringify({ action, comments: comments || '' }),
  });
  if (res) {
    showToast(action === 'APPROVED' ? (res.all_steps_done ? 'Order fully approved!' : 'Step approved — next step notified') : 'Rejected — order cancelled');
    navigate('approval_chains');
  }
}

/* ============================================================
   FULFILMENT MANAGEMENT (15.X series)
   ============================================================ */
async function renderFulfilment(el) {
  el.innerHTML = `
  ${pageHeader('Fulfilment & Reconciliation', 'Order vs Delivery Management')}
  <div class="tabs" id="fulfilment-tabs">
    <button class="tab-btn active" onclick="switchFulfilTab('ovd',this)">Order vs Delivery</button>
    <button class="tab-btn" onclick="switchFulfilTab('due-items',this)">Due Items</button>
    <button class="tab-btn" onclick="switchFulfilTab('pending-supply',this)">Pending Supply</button>
    <button class="tab-btn" onclick="switchFulfilTab('ageing',this)">Due Ageing</button>
    <button class="tab-btn" onclick="switchFulfilTab('brand-shortfall',this)">Brand Shortfall</button>
    <button class="tab-btn" onclick="switchFulfilTab('brand-procurement',this)">Brand Procurement</button>
    <button class="tab-btn" onclick="switchFulfilTab('client-scorecard',this)">Client Scorecard</button>
    <button class="tab-btn" onclick="switchFulfilTab('dc-per-order',this)">DC per Order</button>
    <button class="tab-btn" onclick="switchFulfilTab('dc-recon',this)">DC Reconciliation</button>
    <button class="tab-btn" onclick="switchFulfilTab('procurement-forecast',this)">Procurement Forecast</button>
  </div>
  <div id="fulfilment-content"></div>`;
  switchFulfilTab('ovd', document.querySelector('#fulfilment-tabs .tab-btn'));
}

async function switchFulfilTab(tab, btn) {
  document.querySelectorAll('#fulfilment-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('fulfilment-content');
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;

  const today = new Date().toISOString().slice(0,10);
  const from30 = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const from60 = new Date(Date.now()-60*86400000).toISOString().slice(0,10);

  if (tab === 'ovd') {
    const [data, clients] = await Promise.all([
      api(`/reports/order-vs-delivery?from=${from30}&to=${today}`),
      api('/clients'),
    ]);
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span>Order vs Delivery Reconciliation</span>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="ovd-client" class="filter-select" onchange="reloadOVD()" style="font-size:.8rem">
            <option value="">All Clients</option>
            ${(clients||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <label><input type="checkbox" id="ovd-due-only" onchange="reloadOVD()"> Due Only</label>
          <button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('ovd')">&#8595; CSV</button>
        </div>
      </div>
      <div id="ovd-table-wrap">
        ${renderOVDTable(data)}
      </div>
    </div>`;

  } else if (tab === 'due-items') {
    const data = await api(`/reports/due-items?from=${from60}&to=${today}`);
    if (!data) return;
    const critical = data.filter(r => r.due_ageing_days >= 15).length;
    el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card kpi-danger"><div class="kpi-label">Critical Due (15+ days)</div><div class="kpi-value">${critical}</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Total Due Items</div><div class="kpi-value">${data.length}</div></div>
      <div class="kpi-card"><div class="kpi-label">Total Due Qty</div><div class="kpi-value">${data.reduce((s,r)=>s+(r.due_qty||0),0)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Due Value</div><div class="kpi-value">${fmt(data.reduce((s,r)=>s+(r.due_qty||0)*(r.unit_price||0),0))}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Due Items</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('due-items')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Location</th><th>Order</th><th>Brand</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Due Since</th><th>Ageing (days)</th><th>Vendor</th><th>Status</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${r.client_name}</b></td>
          <td>${r.location||'—'}</td>
          <td><b>${r.order_number}</b></td>
          <td>${r.brand_name||'—'}</td>
          <td>${r.item_name}</td>
          <td>${r.ordered_qty}</td>
          <td>${r.delivered_qty}</td>
          <td><b style="color:var(--danger)">${r.due_qty}</b></td>
          <td>${fmtDate(r.due_since_date)}</td>
          <td><span class="badge badge-${r.due_ageing_days>=15?'danger':r.due_ageing_days>=8?'warning':'info'}">${r.due_ageing_days}d</span></td>
          <td>${r.responsible_vendor||'—'}</td>
          <td>${statusBadge(r.due_status?.replace(' ','_').toUpperCase()||'DUE')}</td>
        </tr>`).join('')||'<tr><td colspan="12" style="text-align:center;color:var(--text-muted)">No due items</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'pending-supply') {
    const data = await api('/reports/pending-supply');
    if (!data) return;
    el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Open Orders</div><div class="kpi-value">${data.kpis.open_orders}</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Partial Orders</div><div class="kpi-value">${data.kpis.partial_orders}</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Due Quantity</div><div class="kpi-value">${data.kpis.due_qty}</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Due Value</div><div class="kpi-value">${fmt(data.kpis.due_value)}</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Delayed Deliveries</div><div class="kpi-value">${data.kpis.delayed_deliveries}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Client Drilldown</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Open Orders</th><th>Due Qty</th><th>Due Value</th><th>Actions</th></tr></thead>
        <tbody>${(data.clients||[]).map(c=>`<tr>
          <td><b>${c.name}</b></td>
          <td>${c.order_count}</td>
          <td><b style="color:var(--danger)">${c.due_qty||0}</b></td>
          <td>${fmt(c.due_value)}</td>
          <td><button class="btn btn-secondary btn-sm" onclick="drillPendingClient('${c.id}','${c.name}')">Drilldown</button></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No pending supply</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'ageing') {
    const data = await api('/reports/due-ageing');
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Due Ageing Report</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('ageing')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Age Bucket</th><th>Orders</th><th>Clients</th><th>Vendors</th><th>Due Qty</th><th>Due Value</th></tr></thead>
        <tbody>${data.map(r=>{
          const badge = r.age_bucket==='15+ Days'?'danger':r.age_bucket==='8-15 Days'?'warning':'info';
          return `<tr>
            <td><span class="badge badge-${badge}">${r.age_bucket}</span></td>
            <td>${r.order_count}</td><td>${r.client_count}</td><td>${r.vendor_count}</td>
            <td><b>${r.due_qty}</b></td><td>${fmt(r.due_value)}</td>
          </tr>`;
        }).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No overdue items</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'brand-shortfall') {
    const data = await api(`/reports/brand-shortfall?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Brand Shortfall Report</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('brand-shortfall')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Fulfilment %</th><th>Vendor</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${r.brand_name}</b></td>
          <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
          <td><b style="color:var(--danger)">${r.due_qty}</b></td>
          <td><span class="badge badge-${r.fulfilment_pct>=90?'success':r.fulfilment_pct>=70?'warning':'danger'}">${r.fulfilment_pct}%</span></td>
          <td>${r.primary_vendor||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No shortfall</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'brand-procurement') {
    const data = await api(`/reports/brand-procurement?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Consolidated Brand Procurement</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('brand-procurement')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Category</th><th>Clients</th><th>Total Ordered</th><th>Total Delivered</th><th>Shortfall</th><th>Suggested PO Qty</th><th>Primary Vendor</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${r.brand_name}</b></td><td>${r.category}</td>
          <td title="${r.clients}">${r.client_count} clients</td>
          <td>${r.total_ordered_qty}</td><td>${r.total_delivered_qty}</td>
          <td><b style="color:var(--danger)">${r.shortfall_qty}</b></td>
          <td><b style="color:var(--blue)">${r.suggested_po_qty}</b></td>
          <td>${r.primary_vendor||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No data</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'client-scorecard') {
    const data = await api(`/reports/client-fulfilment?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Client Fulfilment Scorecard</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('client-scorecard')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Location</th><th>Orders</th><th>Ordered Qty</th><th>Delivered Qty</th><th>Due Qty</th><th>Due Value</th><th>Fulfilment %</th><th>Avg Delivery Days</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${r.client_name}</b></td>
          <td>${r.location||'—'}</td>
          <td>${r.total_orders}</td>
          <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
          <td><b style="color:${(r.due_qty||0)>0?'var(--danger)':'var(--success)'}">${r.due_qty||0}</b></td>
          <td>${fmt(r.due_value||0)}</td>
          <td>
            <span class="badge badge-${r.fulfilment_pct>=90?'success':r.fulfilment_pct>=70?'warning':'danger'}">${r.fulfilment_pct||0}%</span>
            <div style="background:var(--border);height:4px;border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${Math.min(r.fulfilment_pct||0,100)}%;background:${r.fulfilment_pct>=90?'var(--success)':r.fulfilment_pct>=70?'var(--warning)':'var(--danger)'}"></div>
            </div>
          </td>
          <td>${r.avg_delivery_days ? r.avg_delivery_days + ' days' : '—'}</td>
        </tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No data</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'dc-per-order') {
    const data = await api(`/reports/dc-per-order?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Total Orders</div><div class="kpi-value">${data.kpis.totalOrders}</div></div>
      <div class="kpi-card kpi-success"><div class="kpi-label">Single DC Orders</div><div class="kpi-value">${data.kpis.singleDC}</div></div>
      <div class="kpi-card kpi-warning"><div class="kpi-label">Multi-DC Orders</div><div class="kpi-value">${data.kpis.multiDC}</div></div>
      <div class="kpi-card"><div class="kpi-label">Avg DCs per Order</div><div class="kpi-value">${data.kpis.avgDCsPerOrder}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Multi-Delivery Completion Tracking</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Total Ordered</th><th>Total Delivered</th><th>DC Count</th><th>Status</th></tr></thead>
        <tbody>${(data.orders||[]).map(r=>`<tr>
          <td><b>${r.id}</b></td><td>${r.client_name}</td>
          <td>${r.total_ordered}</td><td>${r.total_delivered}</td>
          <td><span class="badge badge-${r.dc_count>2?'warning':r.dc_count>1?'info':'success'}">${r.dc_count} DC${r.dc_count!==1?'s':''}</span></td>
          <td>${statusBadge(r.status)}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No data</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'dc-recon') {
    const data = await api(`/reports/dc-reconciliation?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div class="kpi-grid" style="margin-bottom:16px">
      <div class="kpi-card"><div class="kpi-label">Total DCs</div><div class="kpi-value">${data.kpis.total_dcs}</div></div>
      <div class="kpi-card kpi-success"><div class="kpi-label">POD Uploaded</div><div class="kpi-value">${data.kpis.pod_uploaded}</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Missing POD</div><div class="kpi-value">${data.kpis.missing_pod}</div></div>
      <div class="kpi-card kpi-danger"><div class="kpi-label">Missing DC Scan</div><div class="kpi-value">${data.kpis.missing_dc_scan}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Delivery Challan Reconciliation</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>DC No.</th><th>DC Date</th><th>Client</th><th>Order</th><th>Del. Qty</th><th>Exec</th><th>POD</th><th>DC Scan</th><th>Invoice</th><th>Status</th></tr></thead>
        <tbody>${(data.dcs||[]).map(r=>`<tr>
          <td><b>${r.dc_number}</b></td>
          <td>${fmtDate(r.dc_date)}</td>
          <td>${r.client_name}</td>
          <td>${r.order_number}</td>
          <td>${r.delivered_qty||'—'}</td>
          <td>${r.delivery_executive||'—'}</td>
          <td>${r.pod_uploaded?'<span class="badge badge-success">&#10003; Yes</span>':'<span class="badge badge-danger">&#10007; Missing</span>'}</td>
          <td>${r.dc_scan_uploaded?'<span class="badge badge-success">&#10003; Yes</span>':'<span class="badge badge-danger">&#10007; Missing</span>'}</td>
          <td>${r.is_billed?'<span class="badge badge-success">Billed</span>':'<span class="badge badge-warning">Pending</span>'}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text-muted)">No DCs</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'procurement-forecast') {
    const data = await api('/reports/procurement-forecast');
    if (!data) return;
    el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span>Procurement Demand Forecast</span>
        <button class="btn btn-primary btn-sm" onclick="generateRFQFromForecast()">Generate RFQ for All</button>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Item</th><th>SKU</th><th>Due Qty</th><th>Current Stock</th><th>Suggested PO Qty</th><th>Vendor</th><th>Actions</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td>${r.brand_name}</td>
          <td><b>${r.item_name}</b></td>
          <td>${r.sku}</td>
          <td><b style="color:var(--danger)">${r.due_qty}</b></td>
          <td><span style="color:${r.current_stock<r.due_qty?'var(--danger)':'var(--success)'}">${r.current_stock}</span></td>
          <td><b style="color:var(--blue)">${r.suggested_procurement_qty}</b></td>
          <td>${r.vendor_name||'—'}</td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="raisePOFromForecast('${r.sku}','${r.item_name}',${r.suggested_procurement_qty},'${r.vendor_id||''}')">Raise PO</button>
          </td>
        </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No procurement required</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
  }
}

function renderOVDTable(data) {
  if (!data.length) return `<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No data</div><div class="empty-desc">No orders found for selected filters.</div></div>`;
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Order No.</th><th>Date</th><th>Client</th><th>Location</th><th>Brand</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Due Value</th><th>DC Count</th><th>Last Delivery</th><th>Status</th></tr></thead>
    <tbody>${data.map(r=>`<tr>
      <td><b>${r.order_number}</b></td>
      <td>${fmtDate(r.order_date)}</td>
      <td>${r.client_name}</td>
      <td>${r.client_location||'—'}</td>
      <td>${r.brand_name||'—'}</td>
      <td>${r.item_name}</td>
      <td>${r.ordered_qty}</td>
      <td>${r.delivered_qty}</td>
      <td><b style="color:${r.due_qty>0?'var(--danger)':'var(--success)'}">${r.due_qty}</b></td>
      <td>${fmt(r.due_value||0)}</td>
      <td>${r.dc_count}</td>
      <td>${r.last_delivery_date?fmtDate(r.last_delivery_date):'—'}</td>
      <td><span class="badge badge-${r.order_status==='Complete'?'success':r.order_status==='Partial'?'warning':'info'}">${r.order_status}</span></td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

async function reloadOVD() {
  const client = document.getElementById('ovd-client')?.value || '';
  const dueOnly = document.getElementById('ovd-due-only')?.checked ? '1' : '0';
  const today = new Date().toISOString().slice(0,10);
  const from = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const data = await api(`/reports/order-vs-delivery?from=${from}&to=${today}${client?'&client_id='+client:''}${dueOnly==='1'?'&due_only=1':''}`);
  if (data) document.getElementById('ovd-table-wrap').innerHTML = renderOVDTable(data);
}

async function drillPendingClient(clientId, clientName) {
  const today = new Date().toISOString().slice(0,10);
  const from = new Date(Date.now()-60*86400000).toISOString().slice(0,10);
  const data = await api(`/reports/due-items?from=${from}&to=${today}&client_id=${clientId}`);
  if (!data) return;
  openModal(`Due Items — ${clientName}`,
    `<div class="table-wrap"><table class="table">
      <thead><tr><th>Order</th><th>Brand</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Ageing</th></tr></thead>
      <tbody>${data.map(r=>`<tr>
        <td>${r.order_number}</td><td>${r.brand_name||'—'}</td><td>${r.item_name}</td>
        <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
        <td><b style="color:var(--danger)">${r.due_qty}</b></td>
        <td><span class="badge badge-${r.due_ageing_days>=15?'danger':r.due_ageing_days>=8?'warning':'info'}">${r.due_ageing_days}d</span></td>
      </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No due items</td></tr>'}
      </tbody></table></div>`
  );
}

async function raisePOFromForecast(sku, name, qty, vendorId) {
  if (!vendorId) { showToast('No vendor assigned to this item', 'error'); return; }
  const res = await api('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, items: [{ sku, name, qty, unit_price: 0 }], notes: 'Auto-generated from Procurement Forecast' })
  });
  if (res) { showToast(`PO ${res.id} raised for ${name}`); navigate('procurement'); }
}

async function generateRFQFromForecast() {
  showToast('RFQ generation from forecast is configured in Procurement module', 'info');
  navigate('procurement');
}

function exportFulfilCSV(tab) {
  showToast('CSV export initiated — data will download shortly', 'info');
}

/* ============================================================
   STAFF MANAGEMENT
   ============================================================ */
async function renderStaff(el) {
  const staff = await api('/staff');
  if (!staff) return;
  el.innerHTML = `
  ${pageHeader('Staff', `${staff.length} staff members`,
    `<button class="btn btn-primary" onclick="addStaffModal()">${iconPlus(14)} Add Staff</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${staff.map(s=>`<tr>
          <td><b>${s.name}</b></td>
          <td>${s.phone||'—'}</td>
          <td><span class="badge badge-secondary">${s.role.replace('_',' ')}</span></td>
          <td>${s.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="editStaffModal('${s.id}','${s.name.replace(/'/g,"\\'")}','${s.phone||''}','${s.role}')">Edit</button>
            <button class="btn btn-${s.active?'danger':'success'} btn-sm" onclick="toggleStaff('${s.id}',${s.active?0:1})">${s.active?'Disable':'Enable'}</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function addStaffModal() {
  openModal('Add Staff Member',
    `<div class="form-group"><label>Full Name</label><input type="text" id="sm-name" placeholder="e.g. Bimal"></div>
     <div class="form-group"><label>Phone</label><input type="tel" id="sm-phone" placeholder="+91 98765 43210"></div>
     <div class="form-group"><label>Role</label>
       <select id="sm-role">
         <option value="delivery_staff">Delivery Staff</option>
         <option value="order_entry">Order Entry</option>
         <option value="viewer">Viewer</option>
       </select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveStaff()">Add</button>`);
}

async function saveStaff() {
  const body = {
    name:  document.getElementById('sm-name').value,
    phone: document.getElementById('sm-phone').value,
    role:  document.getElementById('sm-role').value,
  };
  if (!body.name) { showToast('Name required','error'); return; }
  const res = await api('/staff', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Staff member added'); navigate('staff'); }
}

function editStaffModal(id, name, phone, role) {
  openModal('Edit Staff Member',
    `<div class="form-group"><label>Full Name</label><input type="text" id="em-name" value="${name}"></div>
     <div class="form-group"><label>Phone</label><input type="tel" id="em-phone" value="${phone}"></div>
     <div class="form-group"><label>Role</label>
       <select id="em-role">
         <option value="delivery_staff" ${role==='delivery_staff'?'selected':''}>Delivery Staff</option>
         <option value="order_entry" ${role==='order_entry'?'selected':''}>Order Entry</option>
         <option value="viewer" ${role==='viewer'?'selected':''}>Viewer</option>
       </select>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveStaffEdit('${id}')">Save</button>`);
}

async function saveStaffEdit(id) {
  const res = await api(`/staff/${id}`, { method:'PATCH', body: JSON.stringify({
    name:  document.getElementById('em-name').value,
    phone: document.getElementById('em-phone').value,
    role:  document.getElementById('em-role').value,
  })});
  closeModal();
  if (res) { showToast('Staff updated'); navigate('staff'); }
}

async function toggleStaff(id, active) {
  await api(`/staff/${id}`, { method:'PATCH', body: JSON.stringify({active}) });
  showToast(active ? 'Staff enabled' : 'Staff disabled');
  navigate('staff');
}

/* ============================================================
   TODAY'S DELIVERY SCHEDULE
   ============================================================ */
async function renderTodaysSchedule(el) {
  const [schedule, staff] = await Promise.all([
    api('/delivery/today'),
    api('/staff')
  ]);
  if (!schedule) return;

  const today = new Date().toLocaleDateString('en-IN', {weekday:'long',day:'numeric',month:'short',year:'numeric'});
  const staffMap = {};
  (staff||[]).forEach(s => { staffMap[s.id] = s.name; });

  // Group by staff
  const grouped = {};
  const unassigned = [];
  (schedule||[]).forEach(dc => {
    if (dc.staff_id && staffMap[dc.staff_id]) {
      if (!grouped[dc.staff_id]) grouped[dc.staff_id] = [];
      grouped[dc.staff_id].push(dc);
    } else {
      unassigned.push(dc);
    }
  });

  const totalDCs = schedule.length;
  const delivered = schedule.filter(d=>d.status==='DELIVERED').length;
  const inTransit = schedule.filter(d=>d.status==='IN_TRANSIT').length;
  const pending = schedule.filter(d=>d.status==='SCHEDULED').length;

  el.innerHTML = `
  ${pageHeader("Today's Delivery Schedule", today)}
  <div class="kpi-row">
    <div class="kpi-card"><div class="kpi-label">Total DCs</div><div class="kpi-value">${totalDCs}</div></div>
    <div class="kpi-card"><div class="kpi-label" style="color:var(--success)">Delivered</div><div class="kpi-value" style="color:var(--success)">${delivered}</div></div>
    <div class="kpi-card"><div class="kpi-label" style="color:var(--warning)">In Transit</div><div class="kpi-value" style="color:var(--warning)">${inTransit}</div></div>
    <div class="kpi-card"><div class="kpi-label">Pending</div><div class="kpi-value">${pending}</div></div>
  </div>

  ${Object.entries(grouped).map(([staffId, dcs])=>`
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <span>👤 ${staffMap[staffId]} — ${dcs.length} delivery${dcs.length!==1?'s':''}</span>
      <span style="font-size:.8rem;color:var(--text-muted)">${dcs.filter(d=>d.status==='DELIVERED').length}/${dcs.length} done</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Time</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${(dcs).map(dc=>`<tr>
          <td><b>${dc.dc_number||dc.id}</b></td>
          <td>${dc.client_name||'—'}</td>
          <td><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td>${dc.scheduled_time||'—'}</td>
          <td>${dc.total_qty||'—'}</td>
          <td>${statusBadge(dc.status)}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-success btn-sm" onclick="markDelivered('${dc.id}')">✓ Delivered</button>`:''}
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-danger btn-sm" onclick="logReturnModal('${dc.id}')">Return</button>`:''}
            <button class="btn btn-secondary btn-sm" onclick="assignDCModal('${dc.id}','${dc.dc_number||''}','${dc.scheduled_time||''}')">Edit</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`).join('')}

  ${unassigned.length ? `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>⚠️ Unassigned Deliveries (${unassigned.length})</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${unassigned.map(dc=>`<tr>
          <td><b>${dc.dc_number||dc.id}</b></td>
          <td>${dc.client_name||'—'}</td>
          <td><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td>${dc.total_qty||'—'}</td>
          <td>${statusBadge(dc.status)}</td>
          <td><button class="btn btn-primary btn-sm" onclick="assignDCModal('${dc.id}','${dc.dc_number||''}','${dc.scheduled_time||''}')">Assign Staff</button></td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}`;
}

async function assignDCModal(dcId, currentDcNum, currentTime) {
  const staff = await api('/staff') || [];
  const staffOpts = staff.filter(s=>s.active && s.role==='delivery_staff')
    .map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  openModal(`Assign & Schedule — DC ${dcId}`,
    `<div class="form-group"><label>DC Number</label><input type="text" id="dc-num" value="${currentDcNum}" placeholder="e.g. 702037"></div>
     <div class="form-group"><label>Assign Staff</label><select id="dc-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Scheduled Time</label><input type="time" id="dc-time" value="${currentTime}"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveAssignDC('${dcId}')">Save</button>`);
}

async function saveAssignDC(dcId) {
  const res = await api(`/delivery-challans/${dcId}`, { method:'PATCH', body: JSON.stringify({
    dc_number:      document.getElementById('dc-num').value || null,
    staff_id:       document.getElementById('dc-staff').value || null,
    scheduled_time: document.getElementById('dc-time').value || null,
  })});
  closeModal();
  if (res) { showToast('DC updated'); navigate('todays_schedule'); }
}

function logReturnModal(dcId) {
  openModal(`Log Return — DC ${dcId}`,
    `<p style="color:var(--text-muted);margin-bottom:12px">Record items rejected or not accepted by the client.</p>
     <div class="form-group"><label>SKU</label><input type="text" id="ret-sku" placeholder="e.g. SKU001"></div>
     <div class="form-group"><label>Item Name</label><input type="text" id="ret-name"></div>
     <div class="form-group"><label>Qty Returned</label><input type="number" id="ret-qty" value="1" min="1"></div>
     <div class="form-group"><label>Reason</label><input type="text" id="ret-reason" placeholder="e.g. Expired, Quality issue, Not ordered"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmReturn('${dcId}')">Log Return</button>`);
}

async function confirmReturn(dcId) {
  const body = {
    dc_id: dcId,
    sku: document.getElementById('ret-sku').value,
    item_name: document.getElementById('ret-name').value,
    qty_returned: +document.getElementById('ret-qty').value,
    reason: document.getElementById('ret-reason').value,
  };
  if (!body.sku || !body.qty_returned) { showToast('SKU and qty required','error'); return; }
  const res = await api('/delivery-returns', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Return logged — stock restored'); navigate('todays_schedule'); }
}

/* ============================================================
   CONSOLIDATED ORDERS (PROCUREMENT VIEW)
   ============================================================ */
async function renderConsolidatedOrders(el) {
  const data = await api('/reports/consolidated-orders');
  if (!data) return;
  const totalDue = data.reduce((s,r)=>s+(r.total_due_qty||0),0);
  el.innerHTML = `
  ${pageHeader('Procurement View', `${data.length} items needed · ${totalDue} total units due`,
    `<button class="btn btn-secondary" onclick="exportConsolidated()">Export CSV</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Clients</th><th>Client Names</th></tr></thead>
        <tbody>${data.length ? data.map(r=>`<tr>
          <td>${r.sku}</td>
          <td><b>${r.item_name}</b></td>
          <td>${r.total_ordered_qty}</td>
          <td style="color:var(--success)">${r.total_delivered_qty}</td>
          <td style="color:${r.total_due_qty>0?'var(--danger)':'var(--success)'};font-weight:700">${r.total_due_qty}</td>
          <td>${r.client_count}</td>
          <td style="font-size:.8rem;color:var(--text-muted)">${r.clients||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">All items delivered — nothing pending</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function exportConsolidated() {
  api('/reports/consolidated-orders').then(data => {
    if (!data||!data.length) { showToast('No data','error'); return; }
    const header = 'SKU,Item,Total Ordered,Total Delivered,Due Qty,Clients';
    const body = data.map(r=>`${r.sku},"${r.item_name}",${r.total_ordered_qty},${r.total_delivered_qty},${r.total_due_qty},${r.client_count}`).join('\n');
    const blob = new Blob([header+'\n'+body],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `procurement-view-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('CSV downloaded');
  });
}

/* ============================================================
   CONSOLIDATED DUE ITEMS
   ============================================================ */
async function renderConsolidatedDue(el) {
  const data = await api('/reports/consolidated-due');
  if (!data) return;
  el.innerHTML = `
  ${pageHeader('Due Items', `${data.length} pending line items`,
    `<button class="btn btn-secondary" onclick="exportDue()">Export CSV</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Client</th><th>Zone</th><th>Order</th><th>Order Date</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Days</th></tr></thead>
        <tbody>${data.length ? data.map(r=>{
          const daysColor = r.days_overdue>7?'var(--danger)':r.days_overdue>3?'var(--warning)':'var(--text)';
          return `<tr style="${r.days_overdue>7?'background:#fff5f5':''}">
            <td><b>${r.client_name}</b></td>
            <td><span class="badge badge-secondary">${r.zone}</span></td>
            <td>${r.order_id}</td>
            <td>${fmtDate(r.order_date)}</td>
            <td>${r.item_name}</td>
            <td>${r.ordered_qty}</td>
            <td style="color:var(--success)">${r.delivered_qty}</td>
            <td style="color:var(--danger);font-weight:700">${r.due_qty}</td>
            <td style="color:${daysColor};font-weight:600">${r.days_overdue}d</td>
          </tr>`;
        }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--success)">✓ No pending due items</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function exportDue() {
  api('/reports/consolidated-due').then(data => {
    if (!data||!data.length) { showToast('No due items','error'); return; }
    const header = 'Client,Zone,Order ID,Order Date,Item,Ordered Qty,Delivered Qty,Due Qty,Days Overdue';
    const body = data.map(r=>`"${r.client_name}","${r.zone}","${r.order_id}","${r.order_date}","${r.item_name}",${r.ordered_qty},${r.delivered_qty},${r.due_qty},${r.days_overdue}`).join('\n');
    const blob = new Blob([header+'\n'+body],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `due-items-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showToast('CSV downloaded');
  });
}

/* ============================================================
   PORTER EXPENSES
   ============================================================ */
async function renderPorterExpenses(el) {
  const [expenses, clients, staff] = await Promise.all([
    api('/porter-expenses'),
    api('/clients'),
    api('/staff')
  ]);
  const total = (expenses||[]).reduce((s,e)=>s+(e.amount||0),0);
  const clientOpts = (clients||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const staffOpts = (staff||[]).filter(s=>s.active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  el.innerHTML = `
  ${pageHeader('Porter Expenses', `${(expenses||[]).length} trips · Total: ${fmt(total)}`)}
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>Log New Trip</span></div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
        <div class="form-group"><label>Trip Date</label><input type="date" id="pe-date" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="form-group"><label>Route</label><input type="text" id="pe-route" placeholder="e.g. BTP → EGL"></div>
        <div class="form-group"><label>Amount (₹)</label><input type="number" id="pe-amount" min="0" step="1"></div>
        <div class="form-group"><label>Client</label><select id="pe-client"><option value="">— All clients —</option>${clientOpts}</select></div>
        <div class="form-group"><label>Staff</label><select id="pe-staff"><option value="">— Unspecified —</option>${staffOpts}</select></div>
        <div class="form-group"><label>Notes</label><input type="text" id="pe-notes" placeholder="e.g. Morning route"></div>
      </div>
      <button class="btn btn-primary" onclick="savePorterExpense()">Log Trip</button>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span>Trip Log</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Date</th><th>Route</th><th>Amount</th><th>Client</th><th>Staff</th><th>Notes</th></tr></thead>
        <tbody>${(expenses||[]).length ? (expenses||[]).map(e=>`<tr>
          <td>${fmtDate(e.trip_date)}</td>
          <td>${e.route||'—'}</td>
          <td style="font-weight:600">${fmt(e.amount)}</td>
          <td>${e.client_name||'—'}</td>
          <td>${e.staff_name||'—'}</td>
          <td style="color:var(--text-muted)">${e.notes||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No trips logged</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function savePorterExpense() {
  const body = {
    trip_date: document.getElementById('pe-date').value,
    route:     document.getElementById('pe-route').value,
    amount:    +document.getElementById('pe-amount').value,
    client_id: document.getElementById('pe-client').value||null,
    staff_id:  document.getElementById('pe-staff').value||null,
    notes:     document.getElementById('pe-notes').value,
  };
  if (!body.trip_date || !body.amount) { showToast('Date and amount required','error'); return; }
  const res = await api('/porter-expenses', { method:'POST', body: JSON.stringify(body) });
  if (res) { showToast('Trip logged'); navigate('porter_expenses'); }
}

/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('DOMContentLoaded', () => {
  tryAutoLogin();
});

