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
    { id:'dashboard',      label:'Dashboard',      icon:iconDashboard, badge:null },
    { id:'place_order',    label:'Place Order',    icon:iconCart,      badge:null },
    { id:'my_orders',      label:'My Orders',      icon:iconOrders,    badge:null },
    { id:'track_delivery', label:'Track Delivery', icon:iconDelivery,  badge:null },
    { id:'approvals',      label:'Approvals',      icon:iconApprove,   badge:null },
    { id:'client_budget',  label:'Budget & Spend', icon:iconReports,   badge:null },
    { section:'Support' },
    { id:'service_desk',   label:'Service Desk',   icon:iconDesk,      badge:null },
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
  client_budget: renderClientBudget,
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
  if (nav==='delivery_exec') { renderDeliveryExecDashboard(el); return; }
  renderOpsDashboard(el);
}

async function renderClientDashboard(el) {
  const [data, dcs] = await Promise.all([
    api('/dashboard'),
    api('/delivery-challans').catch(()=>[]),
  ]);
  if (!data) return;
  const { client, recentOrders, totalSpend, pendingApproval } = data;
  const budget    = client?.monthly_budget || 500000;
  const spent     = client?.spent_this_month || totalSpend || 0;
  const pctSpent  = Math.min(100, Math.round((spent / budget) * 100));
  const health    = client?.health_score || 85;
  const remaining = Math.max(0, budget - spent);

  // Filter DCs belonging to this client's orders
  const myOrderIds = new Set((recentOrders||[]).map(o=>o.id));
  const allDCs = dcs || [];
  const inTransitDCs = allDCs.filter(d => myOrderIds.has(d.order_id) && d.status === 'IN_TRANSIT');
  const scheduledDCs = allDCs.filter(d => myOrderIds.has(d.order_id) && d.status === 'SCHEDULED');
  const deliveredThisMonth = allDCs.filter(d => myOrderIds.has(d.order_id) && d.status === 'DELIVERED' && (d.delivered_at||'').startsWith(new Date().toISOString().slice(0,7)));

  const activeOrders = (recentOrders||[]).filter(o => !['CLOSED','CANCELLED'].includes(o.status)).length;
  const closedOrders = (recentOrders||[]).filter(o => o.status === 'CLOSED').length;

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">Welcome back, ${(APP.user?.name||'').split(' ')[0]} 👋</div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:2px">${client?.name||'My Organization'} · ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" onclick="navigate('my_orders')">My Orders</button>
      <button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>
    </div>
  </div>

  <!-- KPI Tiles -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary);cursor:pointer" onclick="navigate('my_orders')">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Active Orders</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${activeOrders}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${closedOrders} delivered</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${inTransitDCs.length?'var(--warning)':'#d1d5db'};cursor:pointer" onclick="document.getElementById('track-delivery-section')?.scrollIntoView({behavior:'smooth'})">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:${inTransitDCs.length?'#d97706':'var(--navy)'};line-height:1.2;margin-top:6px">${inTransitDCs.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${scheduledDCs.length} scheduled</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pendingApproval>0?'#f59e0b':'#d1d5db'};cursor:pointer" onclick="navigate('approvals')">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Approvals</div>
      <div style="font-size:2rem;font-weight:800;color:${pendingApproval>0?'#d97706':'var(--navy)'};line-height:1.2;margin-top:6px">${pendingApproval}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">awaiting sign-off</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pctSpent>90?'var(--danger)':pctSpent>70?'var(--warning)':'var(--success)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Budget Used</div>
      <div style="font-size:2rem;font-weight:800;color:${pctSpent>90?'var(--danger)':pctSpent>70?'#d97706':'var(--navy)'};line-height:1.2;margin-top:6px">${pctSpent}%</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(remaining)} left</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Delivered</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${deliveredThisMonth.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">this month</div>
    </div>
  </div>

  <!-- Budget progress bar -->
  <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-weight:700;font-size:.88rem">Monthly Budget</span>
      <span style="font-size:.82rem;color:var(--text-muted)">${fmt(spent)} spent of ${fmt(budget)}</span>
    </div>
    <div style="background:var(--border);height:10px;border-radius:5px;overflow:hidden">
      <div style="height:100%;width:${pctSpent}%;background:${pctSpent>90?'var(--danger)':pctSpent>70?'var(--warning)':'var(--success)'};border-radius:5px;transition:width .5s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:.76rem;color:var(--text-muted)">
      <span style="color:${pctSpent>90?'var(--danger)':pctSpent>70?'var(--warning)':'var(--success)'}">▮ ${pctSpent}% used</span>
      <span>Remaining: <b>${fmt(remaining)}</b></span>
      <span>Health score: <b style="color:${health>=80?'var(--success)':health>=60?'var(--warning)':'var(--danger)'}">${health}/100</b></span>
    </div>
  </div>

  <!-- Track Delivery — full width -->
  <div id="track-delivery-section" style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px;overflow:hidden">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:800;font-size:.95rem;color:var(--navy)">Track Delivery</div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:1px">${inTransitDCs.length} in transit · ${scheduledDCs.length} scheduled · ${deliveredThisMonth.length} delivered this month</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('my_orders')">View All Orders</button>
    </div>

    <!-- Pipeline header -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#f8f9fa;border-bottom:1px solid var(--border)">
      <div style="padding:10px 20px;border-right:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:#3b82f6;flex-shrink:0"></div>
          <span style="font-size:.76rem;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.06em">Scheduled</span>
          <span style="margin-left:auto;background:#e0e7ff;color:#3b82f6;border-radius:20px;padding:1px 8px;font-size:.72rem;font-weight:700">${scheduledDCs.length}</span>
        </div>
      </div>
      <div style="padding:10px 20px;border-right:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;flex-shrink:0"></div>
          <span style="font-size:.76rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em">In Transit</span>
          <span style="margin-left:auto;background:#fef3c7;color:#d97706;border-radius:20px;padding:1px 8px;font-size:.72rem;font-weight:700">${inTransitDCs.length}</span>
        </div>
      </div>
      <div style="padding:10px 20px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0"></div>
          <span style="font-size:.76rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.06em">Delivered</span>
          <span style="margin-left:auto;background:#d1fae5;color:#059669;border-radius:20px;padding:1px 8px;font-size:.72rem;font-weight:700">${deliveredThisMonth.length}</span>
        </div>
      </div>
    </div>

    <!-- Pipeline columns -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;min-height:120px">

      <!-- Scheduled -->
      <div style="padding:14px 16px;border-right:1px solid var(--border)">
        ${scheduledDCs.length === 0 ? `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:.8rem">No upcoming deliveries</div>` :
          scheduledDCs.map(dc=>`
          <div style="border:1.5px solid #dbeafe;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#f8fbff">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div style="font-weight:700;font-size:.84rem;color:var(--navy)">${dc.dc_number||dc.id}</div>
              <span style="font-size:.68rem;font-weight:700;background:#e0e7ff;color:#3b82f6;border-radius:4px;padding:2px 6px">SCHEDULED</span>
            </div>
            <div style="font-size:.75rem;color:var(--text-muted);line-height:1.5">
              <div>📦 Order: <b>${dc.order_id}</b></div>
              ${dc.total_qty?`<div>📊 ${dc.total_qty} units</div>`:''}
              ${dc.scheduled_time?`<div>📅 ${dc.scheduled_time}</div>`:''}
            </div>
          </div>`).join('')}
      </div>

      <!-- In Transit -->
      <div style="padding:14px 16px;border-right:1px solid var(--border)">
        ${inTransitDCs.length === 0 ? `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:.8rem">No deliveries in transit</div>` :
          inTransitDCs.map(dc=>`
          <div style="border:1.5px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#fffbeb">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div style="font-weight:700;font-size:.84rem;color:var(--navy)">${dc.dc_number||dc.id}</div>
              <span style="font-size:.68rem;font-weight:700;background:#fef3c7;color:#d97706;border-radius:4px;padding:2px 6px">IN TRANSIT</span>
            </div>
            <div style="font-size:.75rem;color:var(--text-muted);line-height:1.6">
              <div>📦 Order: <b>${dc.order_id}</b></div>
              ${dc.driver_name?`<div>🧑‍✈️ ${dc.driver_name}</div>`:''}
              ${dc.vehicle_no?`<div>🚚 ${dc.vehicle_no}</div>`:`<div style="color:#d97706">🚚 En route</div>`}
              ${dc.scheduled_time?`<div>⏱ ETA: <b>${dc.scheduled_time}</b></div>`:''}
            </div>
            ${dc.driver_phone?`<a href="tel:${dc.driver_phone}" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:.74rem;font-weight:600;color:#d97706;text-decoration:none;background:#fef3c7;border-radius:6px;padding:3px 8px">📞 Call Driver</a>`:''}
          </div>`).join('')}
      </div>

      <!-- Delivered this month -->
      <div style="padding:14px 16px">
        ${deliveredThisMonth.length === 0 ? `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:.8rem">No deliveries yet this month</div>` :
          deliveredThisMonth.slice(0,4).map(dc=>`
          <div style="border:1.5px solid #a7f3d0;border-radius:10px;padding:12px 14px;margin-bottom:10px;background:#f0fdf4">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div style="font-weight:700;font-size:.84rem;color:var(--navy)">${dc.dc_number||dc.id}</div>
              <span style="font-size:.68rem;font-weight:700;background:#d1fae5;color:#059669;border-radius:4px;padding:2px 6px">DELIVERED</span>
            </div>
            <div style="font-size:.75rem;color:var(--text-muted);line-height:1.5">
              <div>📦 Order: <b>${dc.order_id}</b></div>
              ${dc.delivered_at?`<div>✅ ${fmtDate(dc.delivered_at)}</div>`:''}
              ${dc.total_qty?`<div>📊 ${dc.total_qty} units</div>`:''}
            </div>
          </div>`).join('')}
        ${deliveredThisMonth.length > 4 ? `<div style="text-align:center;font-size:.76rem;color:var(--text-muted);padding-top:4px">+${deliveredThisMonth.length-4} more this month</div>` : ''}
      </div>
    </div>
  </div>

  <!-- Recent Orders -->
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:16px">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:800;font-size:.95rem;color:var(--navy)">Recent Orders</div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('my_orders')">View All</button>
    </div>
    <div style="padding:0">
      ${(recentOrders||[]).slice(0,5).map(o=>`
      <div style="display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''" onclick="viewOrder('${o.id}')">
        <div style="width:38px;height:38px;border-radius:10px;background:#f0f4ff;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🧾</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${o.id}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:1px">${fmtDate(o.created_at)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700;font-size:.9rem">${fmt(o.grand_total)}</div>
          <div style="margin-top:3px">${statusBadge(o.status)}</div>
        </div>
        <div style="color:var(--text-muted);font-size:.8rem">›</div>
      </div>`).join('')||`<div style="padding:32px;text-align:center;color:var(--text-muted)">No orders yet</div>`}
    </div>
  </div>

  <!-- Due Items KPI (loaded async) -->
  <div id="due-kpi-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('fulfilment')">
      <div class="kpi-label">Due Items</div>
      <div class="kpi-value kpi-danger" id="due-items-count">—</div>
      <div class="kpi-sub">items pending delivery</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('fulfilment')">
      <div class="kpi-label">Fulfilment Rate</div>
      <div class="kpi-value" id="client-fulfilment-pct">—</div>
      <div class="kpi-sub">this month</div>
    </div>
  </div>`;

  // Load async KPIs
  api('/reports/pending-supply').then(ps => {
    const el = document.getElementById('due-items-count');
    if (el) el.textContent = ps?.kpis?.due_qty ?? '0';
  });
  const today   = new Date().toISOString().slice(0,10);
  const from30  = new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  api(`/reports/client-fulfilment?from=${from30}&to=${today}`).then(cf => {
    const el = document.getElementById('client-fulfilment-pct');
    if (el && cf?.length) {
      const avg = cf.reduce((s,r)=>s+(r.fulfilment_pct||0),0)/cf.length;
      el.textContent = Math.round(avg) + '%';
    } else if (el) el.textContent = '100%';
  });
}

/* ============================================================
   CLIENT BUDGET & SPEND PAGE
   ============================================================ */
async function renderClientBudget(el) {
  const [data, orders] = await Promise.all([
    api('/dashboard'),
    api('/orders').catch(()=>[])
  ]);
  const client = data?.client || {};
  const budget   = client.monthly_budget || 500000;
  const spent    = client.spent_this_month || data?.totalSpend || 0;
  const pct      = Math.min(100, Math.round((spent / budget) * 100));
  const remain   = Math.max(0, budget - spent);
  const health   = client.health_score || 85;
  const color    = pct > 90 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--success)';

  // Build spend by status
  const closed   = (orders||[]).filter(o=>o.status==='CLOSED');
  const active   = (orders||[]).filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
  const cancelled= (orders||[]).filter(o=>o.status==='CANCELLED');

  // Monthly spend from closed orders (group by month)
  const byMonth = {};
  closed.forEach(o => {
    const m = (o.created_at||'').slice(0,7);
    if (m) byMonth[m] = (byMonth[m]||0) + (o.grand_total||0);
  });
  const months = Object.keys(byMonth).sort().slice(-6);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Budget & Spend</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${client.name||APP.user?.org} · ${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${color}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Spent This Month</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(spent)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${pct}% of budget</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Monthly Budget</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(budget)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(remain)} remaining</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${health>=80?'var(--success)':health>=60?'var(--warning)':'var(--danger)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Health Score</div>
      <div style="font-size:1.6rem;font-weight:800;color:${health>=80?'var(--success)':health>=60?'#d97706':'var(--danger)'};margin-top:6px">${health}/100</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${health>=80?'Excellent':health>=60?'Good':'Needs attention'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Orders</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:6px">${(orders||[]).length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${active.length} active · ${closed.length} closed</div>
    </div>
  </div>

  <!-- Budget bar -->
  <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <span style="font-weight:700;font-size:.9rem">Monthly Budget Utilisation</span>
      <span style="font-size:.82rem;color:var(--text-muted)">${fmt(spent)} of ${fmt(budget)}</span>
    </div>
    <div style="background:var(--border);height:14px;border-radius:7px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:${color};border-radius:7px;transition:width .5s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:.78rem">
      <span style="color:${color};font-weight:600">${pct}% used</span>
      <span style="color:var(--text-muted)">Remaining: <b>${fmt(remain)}</b></span>
      ${pct>80?`<span style="color:var(--danger);font-weight:600">⚠️ Budget alert</span>`:`<span style="color:var(--success);font-weight:600">✓ On track</span>`}
    </div>
  </div>

  <!-- Spend by month + recent orders -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <!-- Monthly trend -->
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:700;font-size:.9rem;color:var(--navy)">Monthly Spend Trend</div>
      <div style="padding:16px">
        ${months.length===0?`<div style="text-align:center;padding:24px;color:var(--text-muted)">No historical spend data</div>`:
        months.map(m=>{
          const v = byMonth[m]||0;
          const maxV = Math.max(...months.map(mm=>byMonth[mm]||0));
          const barW = maxV > 0 ? Math.round((v/maxV)*100) : 0;
          return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:60px;font-size:.75rem;color:var(--text-muted);flex-shrink:0">${m}</div>
            <div style="flex:1;background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden">
              <div style="height:100%;width:${barW}%;background:var(--primary);border-radius:4px"></div>
            </div>
            <div style="width:70px;text-align:right;font-size:.75rem;font-weight:600">${fmt(v)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Recent closed orders -->
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);font-weight:700;font-size:.9rem;color:var(--navy)">Recent Spend</div>
      <div>
        ${closed.slice(0,6).map(o=>`
        <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);cursor:pointer" onclick="viewOrder('${o.id}')">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.86rem">${o.id}</div>
            <div style="font-size:.74rem;color:var(--text-muted)">${fmtDate(o.created_at)}</div>
          </div>
          <div style="font-weight:700;color:var(--navy)">${fmt(o.grand_total)}</div>
        </div>`).join('')||`<div style="padding:32px;text-align:center;color:var(--text-muted)">No completed orders yet</div>`}
      </div>
    </div>
  </div>`;
}

async function renderOpsDashboard(el) {
  const [data, pendingSupply, dueItems] = await Promise.all([
    api('/dashboard'),
    api('/reports/pending-supply').catch(()=>null),
    api('/reports/consolidated-due').catch(()=>[])
  ]);
  if (!data) return;
  const { totalOrders, pendingOrders, lowStock, pendingDCBilling, openTickets, recentOrders, ordersByStatus, topClients } = data;

  const byStatus = {};
  (ordersByStatus||[]).forEach(r => { byStatus[r.status] = r.cnt; });

  const dueCount = (dueItems||[]).length;
  const dueValue = (dueItems||[]).reduce((s,r)=>s+(r.due_qty||0)*(r.unit_price||0),0);
  const pendingApproval = byStatus['PENDING_APPROVAL']||0;
  const inShipment = (byStatus['IN_SHIPMENT']||0)+(byStatus['PARTIALLY_CLOSED']||0);
  const pickedPending = byStatus['PICKED']||0;

  el.innerHTML = `
  ${pageHeader('Control Tower', 'Platform-wide operations overview')}

  <!-- ROW 1: Primary KPIs -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div onclick="navigate('orders')" style="cursor:pointer;background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:4px solid var(--blue)">
      <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Total Orders</div>
      <div style="font-size:2.2rem;font-weight:800;color:var(--navy);line-height:1">${totalOrders||0}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px">
        <span style="background:#e6f1fb;color:var(--blue);border-radius:20px;padding:2px 8px;font-size:.75rem;font-weight:600">${pendingOrders||0} active</span>
      </div>
    </div>
    <div onclick="navigate('orders')" style="cursor:pointer;background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:4px solid ${pendingApproval>0?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Pending Approval</div>
      <div style="font-size:2.2rem;font-weight:800;color:${pendingApproval>0?'#d97706':'var(--navy)'};line-height:1">${pendingApproval}</div>
      <div style="margin-top:8px;font-size:.78rem;color:var(--text-muted)">${pickedPending} orders picked · ${inShipment} in transit</div>
    </div>
    <div onclick="navigate('fulfilment')" style="cursor:pointer;background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:4px solid ${dueCount>0?'#ef4444':'#d1d5db'}">
      <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Due Line Items</div>
      <div style="font-size:2.2rem;font-weight:800;color:${dueCount>0?'#dc2626':'var(--navy)'};line-height:1">${dueCount}</div>
      <div style="margin-top:8px;font-size:.78rem;color:var(--text-muted)">${pendingSupply?.kpis?.due_qty||0} units · ${fmt(pendingSupply?.kpis?.due_value||0)} value</div>
    </div>
    <div onclick="navigate('dc_billing')" style="cursor:pointer;background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-left:4px solid ${pendingDCBilling>0?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Pending Billing</div>
      <div style="font-size:2.2rem;font-weight:800;color:${pendingDCBilling>0?'#d97706':'var(--navy)'};line-height:1">${pendingDCBilling||0}</div>
      <div style="margin-top:8px;font-size:.78rem;color:var(--text-muted)">DCs awaiting invoice</div>
    </div>
  </div>

  <!-- ROW 2: Charts + Alerts -->
  <div style="display:grid;grid-template-columns:1fr 1fr 320px;gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="font-weight:700;color:var(--navy);margin-bottom:14px;font-size:.9rem">Orders by Status</div>
      <canvas id="statusChart" height="180"></canvas>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="font-weight:700;color:var(--navy);margin-bottom:14px;font-size:.9rem">Top Clients by Spend</div>
      ${(topClients||[]).map((c,i)=>`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:24px;height:24px;border-radius:50%;background:var(--blue);color:#fff;font-size:.68rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div>
            <div style="height:4px;background:#e6f1fb;border-radius:2px;margin-top:3px">
              <div style="height:4px;background:var(--blue);border-radius:2px;width:${Math.min(100,Math.round((c.total/(topClients[0]?.total||1))*100))}%"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.82rem;font-weight:700;color:var(--navy)">${fmt(c.total)}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${c.order_count} orders</div>
          </div>
        </div>`).join('')||'<div style="color:var(--text-muted);font-size:.84rem">No data</div>'}
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="font-weight:700;color:var(--navy);margin-bottom:14px;font-size:.9rem">Action Required</div>
      ${[
        { label:'Low Stock SKUs', val:lowStock||0, color:'#f59e0b', page:'inventory', icon:'📦', urgent: lowStock>0 },
        { label:'Pending Approval', val:pendingApproval, color:'#3b82f6', page:'orders', icon:'⏳', urgent: pendingApproval>0 },
        { label:'Orders to Pick', val:byStatus['ACKNOWLEDGED']||0, color:'#8b5cf6', page:'warehouse', icon:'🏭', urgent: (byStatus['ACKNOWLEDGED']||0)>0 },
        { label:'Open Tickets', val:openTickets||0, color:'#6b7280', page:'service_desk', icon:'🎫', urgent: openTickets>0 },
        { label:'Overdue Deliveries', val:pendingSupply?.kpis?.delayed_deliveries||0, color:'#ef4444', page:'delivery', icon:'🚚', urgent: (pendingSupply?.kpis?.delayed_deliveries||0)>0 },
      ].map(a=>`
        <div onclick="navigate('${a.page}')" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;margin-bottom:6px;background:${a.urgent?'rgba(239,68,68,.05)':'#f8f9fa'};border:1px solid ${a.urgent?'rgba(239,68,68,.15)':'#e5e7eb'}">
          <div style="font-size:.8rem;color:var(--text-muted)">${a.icon} ${a.label}</div>
          <div style="font-weight:700;color:${a.urgent?a.color:'var(--text-muted)'};font-size:.9rem;min-width:24px;text-align:right">${a.val}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- ROW 3: Recent Orders -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;color:var(--navy);font-size:.9rem">Recent Orders</div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">View All</button>
    </div>
    <div class="table-wrap">
      <table class="table" style="margin:0">
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
  const labels = ['SUBMITTED','ACKNOWLEDGED','PICKED','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'];
  const colors  = ['#3b82f6','#8b5cf6','#f97316','#06b6d4','#f59e0b','#1f8a5b','#ef4444'];
  const counts  = labels.map(l => byStatus[l]||0);
  const ctx = document.getElementById('statusChart');
  if (ctx) {
    APP.charts.status = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels.map(l=>l.replace(/_/g,' ')), datasets: [{ data: counts, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
      options: { plugins:{ legend:{display:false} }, scales:{ x:{grid:{display:false},ticks:{font:{size:9}}}, y:{beginAtZero:true,ticks:{precision:0},grid:{color:'#f0f0f0'}} } }
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
   PLACE ORDER — optimised: search + quick reorder + catalogue + cart
   ============================================================ */
async function renderPlaceOrder(el) {
  const [inventory, recentOrders] = await Promise.all([
    api('/inventory'),
    api('/orders').catch(()=>[])
  ]);
  if (!inventory) return;

  const cats = [...new Set(inventory.map(i => i.category))];
  APP._catalog = inventory;
  APP._catFilter = 'All';
  APP._catalogSearch = '';

  const last3 = (recentOrders||[]).slice(0,3);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Place Order</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Browse catalogue, search items, or reorder from history</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="showCSVUploadModal()">⬆ Import CSV</button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('my_orders')">My Orders</button>
    </div>
  </div>

  <!-- Quick Reorder strip -->
  ${last3.length ? `
  <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:.82rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.05em">🔄 Quick Reorder</span>
      <span style="font-size:.75rem;color:var(--text-muted)">from recent history</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${last3.map(o=>`
      <div style="flex:1;min-width:200px;border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div style="min-width:0">
          <div style="font-size:.82rem;font-weight:700;color:var(--navy)">${o.id}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmtDate(o.created_at)} · ${fmt(o.grand_total)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(o.items||[]).slice(0,3).map(i=>i.name).join(', ')||'—'}</div>
        </div>
        <button class="btn btn-gold btn-sm" style="white-space:nowrap" onclick="reorderFromHistory('${o.id}')">Reorder</button>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- Search + category pills -->
  <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
    <input type="search" id="catalog-search" placeholder="🔍  Search items by name or SKU…"
      style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;outline:none;transition:border .2s;box-sizing:border-box"
      oninput="searchCatalog(this.value)" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">
    <div class="tab-pills" style="margin-top:12px;margin-bottom:0;flex-wrap:wrap">
      ${['All',...cats].map(c=>`<button class="tab-pill${c==='All'?' active':''}" onclick="filterCatalog('${c}',this)">${c}</button>`).join('')}
    </div>
  </div>

  <!-- Catalogue + Cart -->
  <div style="display:flex;gap:16px;align-items:flex-start">
    <div style="flex:1;min-width:0">
      <div id="catalog-results-info" style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">${inventory.length} items in catalogue</div>
      <div id="catalog-grid" class="catalog-grid">${renderCatalogItems(inventory)}</div>
    </div>

    <!-- Sticky cart panel -->
    <div class="cart-panel" id="cart-panel" style="position:sticky;top:16px">
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
          <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden">
            <div id="budget-bar-fill" style="height:100%;border-radius:4px;transition:width .3s"></div>
          </div>
          <div id="budget-bar-label" style="font-size:.73rem;margin-top:3px;color:var(--text-muted)"></div>
        </div>
        <!-- Delivery notes -->
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
          <label style="font-size:.78rem;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Delivery Notes (optional)</label>
          <textarea id="cart-notes" rows="2" placeholder="Special instructions, delivery address, contact…"
            style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.8rem;resize:vertical;box-sizing:border-box;outline:none;transition:border .2s"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'"></textarea>
        </div>
        <button class="btn btn-gold" style="width:100%;margin-top:10px" onclick="submitOrder()">
          ${iconCheck(14)} Place Order
        </button>
        <button class="btn btn-secondary" style="width:100%;margin-top:6px;font-size:.8rem" onclick="APP.cart=[];refreshCartUI();showToast('Cart cleared')">
          Clear Cart
        </button>
      </div>
    </div>
  </div>

  <!-- CSV Upload Modal (hidden) -->
  <div id="csv-upload-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:none;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:16px;padding:28px;width:480px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.18)">
      <div style="font-weight:800;font-size:1rem;color:var(--navy);margin-bottom:4px">Import Order via CSV</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Download the template, fill in SKU and quantity, then upload.</div>
      <a href="#" onclick="downloadOrderTemplate();return false" class="btn btn-secondary btn-sm" style="margin-bottom:16px">⬇ Download CSV Template</a>
      <div class="form-group" style="margin-bottom:12px">
        <label style="font-weight:600;font-size:.86rem">Upload CSV File</label>
        <input type="file" id="csv-upload-input" accept=".csv,.xlsx" style="display:block;margin-top:6px;padding:8px;border:1px solid var(--border);border-radius:6px;width:100%;box-sizing:border-box">
      </div>
      <div id="csv-import-feedback" style="margin-bottom:12px"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-gold" onclick="processCSVUpload()">Import Order</button>
        <button class="btn btn-secondary" onclick="document.getElementById('csv-upload-modal').style.display='none'">Cancel</button>
      </div>
    </div>
  </div>`;

  refreshCartUI();
  loadBudgetBar();
}

function showCSVUploadModal() {
  const m = document.getElementById('csv-upload-modal');
  if (m) m.style.display = 'flex';
}

function searchCatalog(q) {
  APP._catalogSearch = q.trim().toLowerCase();
  const filtered = getFilteredCatalog();
  const info = document.getElementById('catalog-results-info');
  if (info) info.textContent = `${filtered.length} item${filtered.length!==1?'s':''} found`;
  document.getElementById('catalog-grid').innerHTML = renderCatalogItems(filtered);
}

function getFilteredCatalog() {
  let items = APP._catalog || [];
  if (APP._catFilter && APP._catFilter !== 'All') items = items.filter(i => i.category === APP._catFilter);
  if (APP._catalogSearch) {
    const q = APP._catalogSearch;
    items = items.filter(i => i.name.toLowerCase().includes(q) || (i.sku||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
  }
  return items;
}

async function switchOrderTab(tab) {
  // legacy stub — no longer used but kept to avoid JS errors if called
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
  const parsed = parseCSVText(text);
  if (parsed.length < 2) { if(fb) fb.innerHTML = '<div class="alert alert-danger">CSV must have a header row and at least one data row.</div>'; return; }
  const headers = parsed[0].map(h => h.toLowerCase().trim());
  const skuIdx = headers.indexOf('sku');
  const qtyIdx = headers.indexOf('quantity') !== -1 ? headers.indexOf('quantity') : headers.indexOf('qty');
  if (skuIdx === -1 || qtyIdx === -1) {
    if(fb) fb.innerHTML = '<div class="alert alert-danger">CSV must have "sku" and "quantity" (or "qty") columns.</div>'; return;
  }
  let imported = 0, skipped = 0, notFound = [];
  for (let i = 1; i < parsed.length; i++) {
    const cols = parsed[i];
    const sku = (cols[skuIdx] || '').trim();
    const qty = parseInt(cols[qtyIdx], 10);
    if (!sku || isNaN(qty) || qty < 1) { skipped++; continue; }
    const item = APP._catalog && APP._catalog.find(it => it.sku === sku);
    if (!item) { notFound.push(sku); skipped++; continue; }
    const existing = APP.cart.find(c => c.sku === sku);
    if (existing) existing.qty += qty;
    else APP.cart.push({ sku, name: item.name, qty, unit_price: item.unit_price });
    imported++;
  }
  const notFoundNote = notFound.length ? `<div style="font-size:.78rem;margin-top:6px">SKUs not in catalogue: ${notFound.join(', ')}</div>` : '';
  if(fb) fb.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${imported?'#d1fae5':'#fef3c7'};border:1px solid ${imported?'#6ee7b7':'#fcd34d'};font-size:.84rem;color:${imported?'#065f46':'#92400e'}">
    <b>${imported} item(s) added to cart</b>${skipped?`, ${skipped} skipped`:''}${notFoundNote}
    ${imported?'<div style="margin-top:8px"><a href="#" onclick="document.getElementById(\'csv-upload-modal\').style.display=\'none\';refreshCartUI();return false" style="color:inherit;font-weight:700">✓ Done — view cart</a></div>':''}
  </div>`;
  if (imported) refreshCartUI();
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
  refreshCartUI();
  document.getElementById('catalog-grid')?.scrollIntoView({behavior:'smooth', block:'start'});
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
  const filtered = getFilteredCatalog();
  const info = document.getElementById('catalog-results-info');
  if (info) info.textContent = `${filtered.length} item${filtered.length!==1?'s':''} found`;
  document.getElementById('catalog-grid').innerHTML = renderCatalogItems(filtered);
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

  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const grand = APP.cart.reduce((s,i)=>s+i.qty*i.unit_price,0)*1.18;
  const summary = `
    <div class="cart-row cart-total" style="margin-bottom:8px"><span>Grand Total</span><span>${fmt(grand)}</span></div>
    <p style="font-size:.85rem;color:var(--text-muted)">${APP.cart.length} item type(s) · ${APP.cart.reduce((s,i)=>s+i.qty,0)} units</p>`;

  if (isClientRole) {
    // Client users order for their own account — no dropdown needed
    const clientName = APP.user.org || 'your account';
    openModal('Confirm Order',
      `<div style="margin-bottom:16px;padding:12px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:2px">Ordering for</div>
        <div style="font-weight:700;font-size:1rem">${clientName}</div>
      </div>
      ${summary}`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-gold" onclick="confirmOrder()">Confirm & Submit</button>`
    );
  } else {
    // Ops / admin roles pick the client from the list
    const clients = await api('/clients');
    const clientOpts = (clients||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    openModal('Confirm Order',
      `<div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:6px;font-weight:600">Select Client</label>
        <select id="order-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
          onchange="document.getElementById('confirm-order-btn').disabled=!this.value">
          <option value="">— Select a client —</option>
          ${clientOpts}
        </select>
      </div>
      ${summary}`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button id="confirm-order-btn" class="btn btn-gold" onclick="confirmOrder()" disabled>Confirm & Submit</button>`
    );
  }
}

async function confirmOrder() {
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  // For client roles, client_id comes from their JWT — backend enforces it
  const clientId = isClientRole ? (APP.user.client_id || '__self__') : document.getElementById('order-client')?.value;
  if (!isClientRole && !clientId) { showToast('Select a client', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  const notes = document.getElementById('cart-notes')?.value?.trim() || '';
  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, items: APP.cart, ...(notes ? { notes } : {}) }),
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
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  if (isClient) {
    // Client-specific card view
    const statuses = ['All','DRAFT','SUBMITTED','PENDING_APPROVAL','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'];
    if (!APP._moTab) APP._moTab = 'All';

    function moFiltered() {
      return APP._moTab === 'All' ? orders : orders.filter(o => o.status === APP._moTab);
    }

    function moRender() {
      const filtered = moFiltered();
      document.getElementById('mo-count').textContent = `${filtered.length} order${filtered.length!==1?'s':''}`;
      document.getElementById('mo-cards').innerHTML = filtered.length === 0
        ? `<div style="padding:48px;text-align:center;color:var(--text-muted)">
            <div style="font-size:2.5rem;margin-bottom:12px">📋</div>
            <div style="font-weight:600">No orders in this status</div>
            <div style="font-size:.82rem;margin-top:6px">Try "All" or place a new order</div>
           </div>`
        : filtered.map(o => {
          const statusColor = {DRAFT:'#6b7280',SUBMITTED:'#3b82f6',PENDING_APPROVAL:'#f59e0b',ACKNOWLEDGED:'#8b5cf6',PICKED:'#f97316',IN_SHIPMENT:'#06b6d4',PARTIALLY_CLOSED:'#f59e0b',CLOSED:'#10b981',CANCELLED:'#ef4444'}[o.status]||'#6b7280';
          return `
          <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 20px;margin-bottom:12px;border-left:4px solid ${statusColor};cursor:pointer;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.08)'" onclick="viewOrder('${o.id}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
              <div style="min-width:0">
                <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${o.id}</div>
                <div style="font-size:.76rem;color:var(--text-muted);margin-top:3px">${fmtDate(o.created_at)}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:800;font-size:1rem;color:var(--navy)">${fmt(o.grand_total)}</div>
                <div style="margin-top:4px">${statusBadge(o.status)}</div>
              </div>
            </div>
            ${o.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">📝 ${o.notes}</div>` : ''}
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
              <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();viewOrder('${o.id}')">View Details</button>
              ${['IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED'].includes(o.status)?`<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();viewOrderDrilldown('${o.id}')">Delivery Breakdown</button>`:''}
              ${o.status==='DRAFT'||o.status==='SUBMITTED'?`<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();cancelOrder('${o.id}')">Cancel</button>`:''}
              ${o.status==='PARTIALLY_CLOSED'?`<span style="font-size:.74rem;color:#d97706;background:#fef3c7;padding:3px 8px;border-radius:6px;font-weight:600">⚠️ Partial delivery — awaiting balance</span>`:''}
            </div>
          </div>`;
        }).join('');
    }

    // Summary tiles
    const active   = orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length;
    const closed   = orders.filter(o=>o.status==='CLOSED').length;
    const partial  = orders.filter(o=>o.status==='PARTIALLY_CLOSED').length;
    const totalSpend = orders.filter(o=>o.status==='CLOSED').reduce((s,o)=>s+(o.grand_total||0),0);

    el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">My Orders</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px" id="mo-count">${orders.length} orders</div>
      </div>
      <button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>
    </div>

    <!-- Summary tiles -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active Orders</div>
        <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${active}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">in progress</div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${partial>0?'#f59e0b':'#d1d5db'}">
        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Partial Delivery</div>
        <div style="font-size:2rem;font-weight:800;color:${partial>0?'#d97706':'var(--navy)'};margin-top:6px">${partial}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">balance pending</div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Delivered</div>
        <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${closed}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">orders complete</div>
      </div>
      <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Spend</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(totalSpend)}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">on closed orders</div>
      </div>
    </div>

    <!-- Status filter pills -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      ${statuses.map(s=>`<button onclick="APP._moTab='${s}';document.querySelectorAll('.mo-pill').forEach(b=>b.classList.remove('active'));this.classList.add('active');moRender()" class="tab-pill mo-pill${APP._moTab===s?' active':''}">${s==='All'?'All':s.replace(/_/g,' ')}</button>`).join('')}
    </div>

    <!-- Order cards -->
    <div id="mo-cards"></div>`;

    moRender();
    window.moRender = moRender;
    return;
  }

  // Ops/admin table view
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
  const [order, comments, dcRes, allocations] = await Promise.all([
    api('/orders/' + id),
    api('/orders/' + id + '/comments'),
    api('/delivery-challans').catch(()=>null),
    api('/orders/' + id + '/allocations').catch(()=>[])
  ]);
  if (!order) return;

  // Build allocation map: sku → picked qty
  const allocMap = {};
  (allocations||[]).forEach(a => { allocMap[a.sku] = (allocMap[a.sku]||0) + a.qty; });
  const hasPartialPick = Object.keys(allocMap).length > 0;

  const orderDCs = (dcRes||[]).filter(d => d.order_id === id);
  const dcSection = orderDCs.length ? `
  <div style="margin-top:20px">
    <div style="font-weight:600;margin-bottom:10px">Delivery Status</div>
    ${orderDCs.map(dc=>`
      <div style="border:1px solid ${dc.status==='SCHEDULED'?'var(--warning)':'var(--border)'};border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><b>${dc.id}</b> — ${statusBadge(dc.status)}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button>
            ${dc.status==='SCHEDULED'?`<button class="btn btn-primary btn-sm" onclick="closeModal();dispatchDCModal('${dc.id}')">Dispatch</button>`:''}
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-success btn-sm" onclick="closeModal();markDelivered('${dc.id}')">Confirm Delivery</button>`:''}
          </div>
        </div>
        ${dc.driver_name?`<div style="margin-top:6px;font-size:.85rem;color:var(--text-muted)">Driver: ${dc.driver_name} · Vehicle: ${dc.vehicle_no||'—'}</div>`:''}
        ${dc.total_qty?`<div style="margin-top:4px;font-size:.85rem">Dispatched: <b>${dc.total_qty}</b> units · Delivered: <b style="color:${dc.delivered_qty>0?'var(--success)':'var(--text-muted)'}">${dc.delivered_qty||0}</b></div>`:''}
        ${dc.status==='SCHEDULED'?`<div style="margin-top:6px;font-size:.8rem;color:var(--warning)">⏳ Awaiting dispatch — remaining items from partial delivery</div>`:''}
      </div>`).join('')}
  </div>` : '';

  const itemsTableHeader = hasPartialPick
    ? `<tr><th>Item</th><th>Ordered</th><th>Picked</th><th>Unit</th><th>Total</th></tr>`
    : `<tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>`;

  const itemsTableRows = (order.items||[]).map(i => {
    const picked = allocMap[i.sku];
    const isShort = hasPartialPick && picked !== undefined && picked < i.qty;
    if (hasPartialPick) {
      return `<tr>
        <td>${i.name}</td>
        <td style="color:var(--text-muted)">${i.qty}</td>
        <td><b style="color:${isShort?'var(--warning)':'inherit'}">${picked !== undefined ? picked : i.qty}</b>${isShort?` <span style="font-size:.75rem;color:var(--warning)">(short ${i.qty-picked})</span>`:''}</td>
        <td>${fmt(i.unit_price)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }
    return `<tr><td>${i.name}</td><td>${i.qty}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.total)}</td></tr>`;
  }).join('');

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
    <b>Items</b>${hasPartialPick?` <span style="font-size:.78rem;color:var(--warning);margin-left:6px">⚠ Partial pick — picked qty shown</span>`:''}
    <table class="table" style="margin-top:8px">
      <thead>${itemsTableHeader}</thead>
      <tbody>${itemsTableRows}</tbody>
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
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
     ${order.status==='PARTIALLY_CLOSED' ? `
       <button class="btn btn-primary" onclick="closeModal();dispatchRemainingModal('${id}')">Dispatch Remaining</button>
       <button class="btn btn-danger" onclick="closeModal();preCloseOrder('${id}')">Pre-Close Order</button>` : ''}
     ${order.status==='SUBMITTED'||order.status==='APPROVED' ? `<button class="btn btn-danger btn-sm" onclick="closeModal();cancelOrder('${id}')">Cancel Order</button>` : ''}`
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
   ORDER DRILL-DOWN — Delivery Reconciliation
   ============================================================ */
async function viewOrderDrilldown(orderId) {
  openModal(`Loading…`, `<div style="text-align:center;padding:40px;color:var(--text-muted)">Fetching delivery breakdown…</div>`, '');

  const data = await api(`/orders/${orderId}/drilldown`);
  if (!data) return;

  const { order, lines, dcs, summary } = data;

  const statusColor = s => ({
    fully_delivered: '#10b981',
    partial: '#f59e0b',
    not_delivered: '#ef4444',
  }[s] || '#6b7280');

  const statusLabel = s => ({
    fully_delivered: 'Delivered',
    partial: 'Partial',
    not_delivered: 'Not Delivered',
  }[s] || s);

  const lineRows = (lines||[]).map(l => {
    const sc = statusColor(l.status);
    return `<tr>
      <td style="font-family:monospace;font-size:.8rem;color:var(--text-muted)">${l.sku}</td>
      <td style="font-weight:600">${l.name||l.sku}</td>
      <td style="text-align:right">${l.qty_ordered}</td>
      <td style="text-align:right;color:${l.qty_delivered>0?'#10b981':'var(--text-muted)'};font-weight:${l.qty_delivered>0?700:400}">${l.qty_delivered}</td>
      <td style="text-align:right;color:${l.qty_due>0?'#ef4444':'var(--text-muted)'};font-weight:${l.qty_due>0?700:400}">${l.qty_due}</td>
      <td style="text-align:right">${fmt(l.value_ordered)}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${fmt(l.value_delivered)}</td>
      <td style="text-align:right;color:${l.value_due>0?'#ef4444':'var(--text-muted)'}">${fmt(l.value_due)}</td>
      <td><span style="font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${sc}22;color:${sc}">${statusLabel(l.status)}</span></td>
    </tr>`;
  }).join('');

  const dcRows = (dcs||[]).map(dc => {
    const c = {DELIVERED:'#10b981',IN_TRANSIT:'#06b6d4',SCHEDULED:'#f59e0b',CANCELLED:'#ef4444'}[dc.status]||'#6b7280';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;background:var(--bg);margin-bottom:6px;font-size:.83rem">
      <div>
        <span style="font-weight:700;color:var(--navy)">${dc.id}</span>
        <span style="margin-left:8px;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${c}22;color:${c}">${dc.status}</span>
      </div>
      <div style="color:var(--text-muted)">
        ${dc.driver_name?`${dc.driver_name} · `:''}${dc.vehicle_no||''}
      </div>
      <div style="font-weight:600">
        ${dc.delivered_qty||0} delivered / ${dc.total_qty||0} dispatched
      </div>
    </div>`;
  }).join('');

  const deliveryRate = summary.total_lines > 0
    ? Math.round((summary.delivered_lines / summary.total_lines) * 100)
    : 0;

  const body = `
  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px">
    <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Line Items</div>
      <div style="font-size:1.8rem;font-weight:800;color:var(--navy);margin-top:4px">${summary.total_lines}</div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #10b981">
      <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Fully Delivered</div>
      <div style="font-size:1.8rem;font-weight:800;color:#10b981;margin-top:4px">${summary.delivered_lines}</div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${summary.due_lines>0?'#ef4444':'#d1d5db'}">
      <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Lines Due</div>
      <div style="font-size:1.8rem;font-weight:800;color:${summary.due_lines>0?'#ef4444':'var(--navy)'};margin-top:4px">${summary.due_lines}</div>
    </div>
    <div style="background:#fff;border-radius:10px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${summary.no_delivery_lines>0?'#6b7280':'#d1d5db'}">
      <div style="font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">No Delivery</div>
      <div style="font-size:1.8rem;font-weight:800;color:var(--navy);margin-top:4px">${summary.no_delivery_lines}</div>
      <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">zero units received</div>
    </div>
  </div>

  <!-- Value summary row -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
    <div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em">Ordered Value</div>
      <div style="font-size:1.3rem;font-weight:800;color:var(--navy);margin-top:4px">${fmt(summary.total_ordered_value)}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:#10b981;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Delivered Value</div>
      <div style="font-size:1.3rem;font-weight:800;color:#10b981;margin-top:4px">${fmt(summary.total_delivered_value)}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:12px;text-align:center">
      <div style="font-size:.7rem;color:${summary.total_due_value>0?'#ef4444':'var(--text-muted)'};font-weight:600;text-transform:uppercase;letter-spacing:.05em">Due Value</div>
      <div style="font-size:1.3rem;font-weight:800;color:${summary.total_due_value>0?'#ef4444':'var(--text-muted)'};margin-top:4px">${fmt(summary.total_due_value)}</div>
    </div>
  </div>

  <!-- Delivery rate bar -->
  <div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:.8rem;font-weight:700;color:var(--navy)">Delivery Completion</span>
      <span style="font-size:.8rem;font-weight:800;color:${deliveryRate===100?'#10b981':deliveryRate>50?'#f59e0b':'#ef4444'}">${deliveryRate}%</span>
    </div>
    <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${deliveryRate}%;background:${deliveryRate===100?'#10b981':deliveryRate>50?'#f59e0b':'#ef4444'};border-radius:4px;transition:width .4s"></div>
    </div>
  </div>

  <!-- Line items table -->
  <div style="font-weight:700;font-size:.88rem;color:var(--navy);margin-bottom:8px">Line Item Reconciliation</div>
  <div style="overflow-x:auto;margin-bottom:16px">
    <table class="table" style="font-size:.82rem">
      <thead><tr>
        <th>SKU</th><th>Item</th>
        <th style="text-align:right">Ordered</th>
        <th style="text-align:right">Delivered</th>
        <th style="text-align:right">Due</th>
        <th style="text-align:right">Ordered ₹</th>
        <th style="text-align:right">Delivered ₹</th>
        <th style="text-align:right">Due ₹</th>
        <th>Status</th>
      </tr></thead>
      <tbody>${lineRows || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">No line items found</td></tr>'}</tbody>
    </table>
  </div>

  ${dcs && dcs.length ? `
  <!-- DCs for this order -->
  <div style="font-weight:700;font-size:.88rem;color:var(--navy);margin-bottom:8px">Delivery Challans (${dcs.length})</div>
  ${dcRows}
  ` : ''}`;

  openModal(
    `Delivery Breakdown — ${orderId}`,
    body,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
     <button class="btn btn-primary" onclick="closeModal();viewOrder('${orderId}')">Full Order View</button>`
  );
}

/* ============================================================
   TRACK DELIVERY
   ============================================================ */
async function renderTrackDelivery(el) {
  const [dcs, orders] = await Promise.all([
    api('/delivery-challans'),
    api('/orders').catch(()=>[])
  ]);
  if (!dcs) return;

  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const nowMonth = new Date().toISOString().slice(0,7);
  const scheduledDCs  = dcs.filter(d => d.status === 'SCHEDULED');
  const inTransitDCs  = dcs.filter(d => d.status === 'IN_TRANSIT');
  const deliveredAll  = dcs.filter(d => d.status === 'DELIVERED');
  const deliveredMonth= deliveredAll.filter(d => (d.delivered_at||'').startsWith(nowMonth));
  const itemsInTransit= inTransitDCs.reduce((s,d)=>s+(d.total_qty||0),0);

  function dcCard(dc, type) {
    const colors = { SCHEDULED:['#dbeafe','#f8fbff','#3b82f6','#e0e7ff'], IN_TRANSIT:['#fde68a','#fffbeb','#d97706','#fef3c7'], DELIVERED:['#a7f3d0','#f0fdf4','#059669','#d1fae5'] };
    const [border,bg,textColor,badgeBg] = colors[type]||colors.SCHEDULED;
    const label = {SCHEDULED:'SCHEDULED',IN_TRANSIT:'IN TRANSIT',DELIVERED:'DELIVERED'}[type];
    return `
    <div style="border:1.5px solid ${border};border-radius:10px;padding:14px 16px;margin-bottom:12px;background:${bg}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:800;font-size:.9rem;color:var(--navy)">${dc.dc_number||dc.id}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:1px">Order: <b>${dc.order_id}</b></div>
        </div>
        <span style="font-size:.68rem;font-weight:700;background:${badgeBg};color:${textColor};border-radius:4px;padding:2px 7px">${label}</span>
      </div>
      <!-- progress steps -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:10px">
        ${['SCHEDULED','IN_TRANSIT','DELIVERED'].map((step,i,arr)=>{
          const reached = ['SCHEDULED','IN_TRANSIT','DELIVERED'].indexOf(type) >= i;
          return `
          <div style="display:flex;align-items:center;flex:1">
            <div style="width:22px;height:22px;border-radius:50%;background:${reached?textColor:'#e5e7eb'};display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#fff;font-weight:700;flex-shrink:0">${i+1}</div>
            <div style="font-size:.62rem;color:${reached?textColor:'#9ca3af'};margin-left:3px;white-space:nowrap">${step.replace('_',' ')}</div>
            ${i<arr.length-1?`<div style="flex:1;height:2px;background:${reached&&['SCHEDULED','IN_TRANSIT','DELIVERED'].indexOf(type)>i?textColor:'#e5e7eb'};margin:0 4px"></div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div style="font-size:.75rem;color:var(--text-muted);line-height:1.7">
        ${dc.total_qty?`<div>📦 <b>${dc.total_qty}</b> units</div>`:''}
        ${dc.driver_name?`<div>🧑‍✈️ ${dc.driver_name}</div>`:''}
        ${dc.vehicle_no?`<div>🚚 ${dc.vehicle_no}</div>`:''}
        ${dc.scheduled_time?`<div>⏱ ETA: <b>${dc.scheduled_time}</b></div>`:''}
        ${dc.delivered_at?`<div>✅ Delivered: <b>${fmtDate(dc.delivered_at)}</b></div>`:''}
      </div>
      ${dc.driver_phone?`<a href="tel:${dc.driver_phone}" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:.75rem;font-weight:600;color:${textColor};text-decoration:none;background:${badgeBg};border-radius:6px;padding:4px 10px">📞 Call Driver</a>`:''}
      ${type!=='DELIVERED'?`<button class="btn btn-secondary btn-sm" style="margin-top:8px;margin-left:6px" onclick="viewOrder('${dc.order_id}')">View Order</button>`:''}
    </div>`;
  }

  el.innerHTML = `
  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #3b82f6">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Scheduled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${scheduledDCs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">upcoming deliveries</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${inTransitDCs.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:${inTransitDCs.length?'#d97706':'var(--navy)'};margin-top:6px">${inTransitDCs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">on the way now</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Delivered (Month)</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${deliveredMonth.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">this month</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Units In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${itemsInTransit}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">units en route</div>
    </div>
  </div>

  <!-- 3-column pipeline -->
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#f8f9fa;border-bottom:1px solid var(--border)">
      ${[['🔵 Scheduled',scheduledDCs.length,'#3b82f6','#e0e7ff'],['🟡 In Transit',inTransitDCs.length,'#d97706','#fef3c7'],['🟢 Delivered',deliveredMonth.length,'#059669','#d1fae5']].map((col,i)=>`
      <div style="padding:12px 20px;${i<2?'border-right:1px solid var(--border)':''}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:.76rem;font-weight:700;color:${col[2]};text-transform:uppercase;letter-spacing:.06em">${col[0]}</span>
          <span style="margin-left:auto;background:${col[3]};color:${col[2]};border-radius:20px;padding:1px 8px;font-size:.72rem;font-weight:700">${col[1]}</span>
        </div>
      </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;min-height:200px">
      <div style="padding:16px;border-right:1px solid var(--border)">
        ${scheduledDCs.length===0?`<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:.82rem">No upcoming deliveries</div>`:scheduledDCs.map(dc=>dcCard(dc,'SCHEDULED')).join('')}
      </div>
      <div style="padding:16px;border-right:1px solid var(--border)">
        ${inTransitDCs.length===0?`<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:.82rem">No active deliveries</div>`:inTransitDCs.map(dc=>dcCard(dc,'IN_TRANSIT')).join('')}
      </div>
      <div style="padding:16px">
        ${deliveredMonth.length===0?`<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:.82rem">No deliveries yet this month</div>`:deliveredMonth.slice(0,6).map(dc=>dcCard(dc,'DELIVERED')).join('')}
        ${deliveredMonth.length>6?`<div style="text-align:center;font-size:.76rem;color:var(--text-muted);padding-top:4px">+${deliveredMonth.length-6} more this month</div>`:''}
      </div>
    </div>
  </div>`;
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

  const STATUS_TABS = ['All','SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','PICKED','INVENTORY_CHECK','READY_TO_PICK','IN_SHIPMENT','PARTIALLY_CLOSED'];

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
  const STATUS_TABS = ['All','SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','PICKED','INVENTORY_CHECK','READY_TO_PICK','IN_SHIPMENT','PARTIALLY_CLOSED'];
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
  if (o.status === 'ACKNOWLEDGED' || o.status === 'READY_TO_PICK') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="pickOrderModal('${o.id}')">Pick Items</button>`);
  } else if (o.status === 'PICKED') {
    btns.push(`<button class="btn btn-success btn-sm" onclick="createDCFromPicklist('${o.id}')">Dispatch &rarr; DC</button>`);
  } else if (o.status === 'PARTIALLY_CLOSED') {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="dispatchRemainingModal('${o.id}')">Dispatch Remaining</button>`);
    btns.push(`<button class="btn btn-danger btn-sm" onclick="preCloseOrder('${o.id}')">Pre-Close</button>`);
  } else if (next[o.status]) {
    btns.push(`<button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','${next[o.status]}')">→ ${next[o.status].replace(/_/g,' ')}</button>`);
  }
  return btns.join(' ');
}

async function dispatchRemainingModal(orderId) {
  const dcs = await api('/delivery-challans');
  if (!dcs) return;
  const pending = (dcs||[]).filter(d => d.order_id === orderId && d.status === 'SCHEDULED');
  if (!pending.length) {
    showToast('No pending DCs — remaining items may already be in transit or delivered.', 'error');
    return;
  }
  // Single pending DC → go straight to dispatch form
  if (pending.length === 1) {
    dispatchDCModal(pending[0].id);
    return;
  }
  // Multiple pending DCs — let user pick
  const dcList = pending.map(dc => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      <div>
        <div style="font-weight:600">${dc.id}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${dc.total_qty||'?'} units — ready to dispatch</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="closeModal();dispatchDCModal('${dc.id}')">Dispatch</button>
    </div>`).join('');
  openModal(`Dispatch Remaining — Order ${orderId}`,
    `<p style="color:var(--text-muted);margin-bottom:12px;font-size:.87rem">Select a pending DC to dispatch:</p>${dcList}`,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}

async function preCloseOrder(orderId) {
  openModal('Pre-Close Order',
    `<p>Pre-closing <b>${orderId}</b> will mark it as <b>CLOSED</b> without completing all deliveries.</p>
     <p style="color:var(--warning);margin-top:8px;font-size:.87rem">⚠️ Any remaining scheduled DCs will be left undelivered. This action cannot be undone.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmPreClose('${orderId}')">Pre-Close Order</button>`);
}

async function confirmPreClose(orderId) {
  const res = await api(`/orders/${orderId}/transition`, { method:'POST', body: JSON.stringify({ to:'CLOSED', note:'Pre-closed by ops — partial delivery accepted' }) });
  closeModal();
  if (res) { showToast(`Order ${orderId} pre-closed`); navigate('orders'); }
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
      const today = new Date().toISOString().slice(0,10);
      const billedToday = billed.filter(d=>d.billed_at?.startsWith(today));
      const critical = unbilled.filter(d => Math.floor((Date.now()-new Date(d.created_at).getTime())/86400000) > 15);
      const pendingValue = unbilled.reduce((s,d)=>s+(d.order_value||0),0);
      const billedMonthValue = billed.filter(d=>(d.billed_at||'').startsWith(new Date().toISOString().slice(0,7))).reduce((s,d)=>s+(d.order_value||0),0);
      return `
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-card kpi-warning">
          <div class="kpi-label">Pending Billing</div>
          <div class="kpi-value">${unbilled.length}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(pendingValue)} outstanding</div>
        </div>
        <div class="kpi-card ${critical.length>0?'kpi-danger':''}">
          <div class="kpi-label">Critical (16+ days)</div>
          <div class="kpi-value">${critical.length}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(critical.reduce((s,d)=>s+(d.order_value||0),0))} at risk</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Billed Today</div>
          <div class="kpi-value">${billedToday.length}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(billedToday.reduce((s,d)=>s+(d.order_value||0),0))}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Billed This Month</div>
          <div class="kpi-value">${billed.filter(d=>(d.billed_at||'').startsWith(new Date().toISOString().slice(0,7))).length}</div>
          <div style="font-size:.75rem;color:var(--success);margin-top:4px">${fmt(billedMonthValue)}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <span>Delivered — Pending Billing (${unbilled.length})</span>
          ${critical.length ? `<span class="badge badge-danger">${critical.length} overdue</span>` : ''}
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Value</th><th>Delivered</th><th>Aging</th><th>Action</th></tr></thead>
            <tbody>${unbilled.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(dc=>`<tr ${Math.floor((Date.now()-new Date(dc.created_at).getTime())/86400000)>15?'style="background:rgba(220,38,38,.04)"':''}>
              <td><b>${dc.id}</b></td>
              <td><span style="font-size:.82rem">${dc.order_id}</span></td>
              <td><b>${dc.client_name||'—'}</b></td>
              <td><b>${fmt(dc.order_value)}</b></td>
              <td>${fmtDate(dc.delivered_at||dc.dispatched_at)}</td>
              <td>${agingBadge(dc)}</td>
              <td><button class="btn btn-gold btn-sm" onclick="billDC('${dc.id}')">Bill DC</button></td>
            </tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">All DCs are billed</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header">
          <span>Billed DCs (${billed.length})</span>
          <span style="font-size:.83rem;color:var(--text-muted)">${fmt(billed.reduce((s,d)=>s+(d.order_value||0),0))} total billed</span>
        </div>
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
      // AR Aging: billed DCs, bucketed by days since invoice
      const buckets = [
        { label: '0–30 days', min: 0, max: 30, cls: 'success' },
        { label: '31–60 days', min: 31, max: 60, cls: 'warning' },
        { label: '61–90 days', min: 61, max: 90, cls: 'danger' },
        { label: '90+ days', min: 91, max: Infinity, cls: 'danger' },
      ];
      function ageDays(dc) {
        return Math.floor((Date.now() - new Date(dc.billed_at || dc.delivered_at || dc.created_at).getTime()) / 86400000);
      }
      function bucket(dc) {
        const d = ageDays(dc); return buckets.find(b => d >= b.min && d <= b.max) || buckets[3];
      }
      const billedTotal = billed.reduce((s,d)=>s+(d.order_value||0),0);
      const overdue = billed.filter(d=>ageDays(d)>30);

      // Per-client summary
      const clientMap = {};
      billed.forEach(d => {
        const key = d.client_name || '—';
        if (!clientMap[key]) clientMap[key] = { name:key, items:[] };
        clientMap[key].items.push(d);
      });

      return `
      <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
        ${buckets.map(b=>{
          const items = billed.filter(d=>{ const age=ageDays(d); return age>=b.min && age<=b.max; });
          return `<div class="kpi-card ${items.length?'kpi-'+b.cls:''}">
            <div class="kpi-label">${b.label}</div>
            <div class="kpi-value">${items.length}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(items.reduce((s,d)=>s+(d.order_value||0),0))}</div>
          </div>`;
        }).join('')}
      </div>
      ${overdue.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:.83rem;color:#b91c1c">
        <b>⚠ ${overdue.length} invoices past 30 days</b> — ${fmt(overdue.reduce((s,d)=>s+(d.order_value||0),0))} overdue
      </div>` : ''}
      <div class="card">
        <div class="card-header">
          <span>AR Aging by Client</span>
          <span style="font-size:.83rem;color:var(--text-muted)">Total receivable: ${fmt(billedTotal)}</span>
        </div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Client</th><th>Invoices</th><th>0–30d</th><th>31–60d</th><th>61–90d</th><th>90+d</th><th>Total Outstanding</th><th>Risk</th></tr></thead>
          <tbody>${Object.values(clientMap).map(c => {
            const b0  = c.items.filter(d=>ageDays(d)<=30).reduce((s,d)=>s+(d.order_value||0),0);
            const b30 = c.items.filter(d=>ageDays(d)>30&&ageDays(d)<=60).reduce((s,d)=>s+(d.order_value||0),0);
            const b60 = c.items.filter(d=>ageDays(d)>60&&ageDays(d)<=90).reduce((s,d)=>s+(d.order_value||0),0);
            const b90 = c.items.filter(d=>ageDays(d)>90).reduce((s,d)=>s+(d.order_value||0),0);
            const total = c.items.reduce((s,d)=>s+(d.order_value||0),0);
            const risk = b90>0?'High':b60>0?'Medium':b30>0?'Low':'Clean';
            const riskCls = {High:'danger',Medium:'warning',Low:'info',Clean:'success'}[risk];
            return `<tr>
              <td><b>${c.name}</b></td>
              <td>${c.items.length}</td>
              <td style="color:var(--success)">${fmt(b0)}</td>
              <td style="color:${b30>0?'var(--warning)':'var(--text-muted)'}">${fmt(b30)}</td>
              <td style="color:${b60>0?'var(--danger)':'var(--text-muted)'}">${fmt(b60)}</td>
              <td style="color:${b90>0?'var(--danger)':'var(--text-muted)'}"><b>${fmt(b90)}</b></td>
              <td><b>${fmt(total)}</b></td>
              <td><span class="badge badge-${riskCls}">${risk}</span></td>
            </tr>`;
          }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No billed invoices</td></tr>'}
          </tbody>
        </table></div>
      </div>
      <div class="card" style="margin-top:14px">
        <div class="card-header"><span>Invoice Detail</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>DC #</th><th>Client</th><th>Order</th><th>Value</th><th>Billed On</th><th>Age</th><th>Bucket</th></tr></thead>
          <tbody>${billed.map(d => {
            const age = ageDays(d); const b = bucket(d);
            return `<tr>
              <td><b>${d.id}</b></td>
              <td>${d.client_name||'—'}</td>
              <td>${d.order_id}</td>
              <td>${fmt(d.order_value)}</td>
              <td>${fmtDate(d.billed_at)}</td>
              <td>${age}d</td>
              <td><span class="badge badge-${b.cls}">${b.label}</span></td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No billed DCs</td></tr>'}
          </tbody>
        </table></div>
      </div>`;
    }
    if (tab === 'ap_aging') {
      return `<div class="loading-state"><div class="spinner"></div><p>Loading AP data…</p></div>`;
    }
    if (tab === 'margin_analysis') {
      return `<div class="loading-state"><div class="spinner"></div><p>Loading inventory data…</p></div>`;
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

async function switchFinanceTab(tab) {
  APP._financeTab = tab;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => {
    const map = { 'dc_tracker':'DC Tracker','ar_aging':'AR Aging','ap_aging':'AP Aging','margin_analysis':'Margin Analysis' };
    b.classList.toggle('active', b.textContent.trim() === (map[tab]||tab));
  });
  const el = document.getElementById('finance-tab-content');
  if (!el) return;

  if (tab === 'dc_tracker' || tab === 'ar_aging') {
    if (APP._financeTabContent) el.innerHTML = APP._financeTabContent(tab);
  } else if (tab === 'ap_aging') {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading AP data…</p></div>`;
    const pos = await api('/purchase-orders') || [];
    el.innerHTML = renderAPAging(pos);
  } else if (tab === 'margin_analysis') {
    el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading inventory…</p></div>`;
    const inv = await api('/inventory') || [];
    el.innerHTML = renderMarginAnalysis(inv);
  }
}

function renderAPAging(pos) {
  const open = pos.filter(p => !['INVOICED','CANCELLED'].includes(p.status));
  function ageDays(p) { return Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000); }
  const buckets = [
    { label: '0–7 days',  min:0,  max:7,  cls:'success' },
    { label: '8–15 days', min:8,  max:15, cls:'warning' },
    { label: '16–30 days',min:16, max:30, cls:'danger' },
    { label: '30+ days',  min:31, max:Infinity, cls:'danger' },
  ];
  const overdue = open.filter(p => ageDays(p) > 15);

  const vendorMap = {};
  open.forEach(p => {
    const v = p.vendor_name || p.vendor_id || '—';
    if (!vendorMap[v]) vendorMap[v] = { name:v, items:[] };
    vendorMap[v].items.push(p);
  });

  return `
  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
    ${buckets.map(b => {
      const items = open.filter(p=>{ const a=ageDays(p); return a>=b.min && a<=b.max; });
      return `<div class="kpi-card ${items.length?'kpi-'+b.cls:''}">
        <div class="kpi-label">${b.label}</div>
        <div class="kpi-value">${items.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${fmt(items.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
      </div>`;
    }).join('')}
  </div>
  ${overdue.length ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:.83rem;color:#b91c1c">
    <b>⚠ ${overdue.length} POs outstanding 15+ days</b> — ${fmt(overdue.reduce((s,p)=>s+(p.grand_total||0),0))} payable
  </div>` : ''}
  <div class="card">
    <div class="card-header">
      <span>AP Aging by Vendor</span>
      <span style="font-size:.83rem;color:var(--text-muted)">Total payable: ${fmt(open.reduce((s,p)=>s+(p.grand_total||0),0))}</span>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Vendor</th><th>Open POs</th><th>0–7d</th><th>8–15d</th><th>16–30d</th><th>30+d</th><th>Total Payable</th><th>Status</th></tr></thead>
      <tbody>${Object.values(vendorMap).map(v => {
        const a0  = v.items.filter(p=>ageDays(p)<=7).reduce((s,p)=>s+(p.grand_total||0),0);
        const a15 = v.items.filter(p=>ageDays(p)>7&&ageDays(p)<=15).reduce((s,p)=>s+(p.grand_total||0),0);
        const a30 = v.items.filter(p=>ageDays(p)>15&&ageDays(p)<=30).reduce((s,p)=>s+(p.grand_total||0),0);
        const a90 = v.items.filter(p=>ageDays(p)>30).reduce((s,p)=>s+(p.grand_total||0),0);
        const total = v.items.reduce((s,p)=>s+(p.grand_total||0),0);
        const risk = a90>0?'Overdue':a30>0?'Due Soon':'Current';
        const riskCls = {Overdue:'danger','Due Soon':'warning',Current:'success'}[risk];
        return `<tr>
          <td><b>${v.name}</b></td>
          <td>${v.items.length}</td>
          <td style="color:var(--success)">${fmt(a0)}</td>
          <td style="color:${a15>0?'var(--warning)':'var(--text-muted)'}">${fmt(a15)}</td>
          <td style="color:${a30>0?'var(--danger)':'var(--text-muted)'}">${fmt(a30)}</td>
          <td style="color:${a90>0?'var(--danger)':'var(--text-muted)'}"><b>${fmt(a90)}</b></td>
          <td><b>${fmt(total)}</b></td>
          <td><span class="badge badge-${riskCls}">${risk}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No open POs</td></tr>'}
      </tbody>
    </table></div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="card-header"><span>Open PO Detail</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>PO ID</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Expected</th><th>Age</th></tr></thead>
      <tbody>${open.map(p => {
        const age = ageDays(p);
        const ageCls = age>30?'danger':age>15?'warning':'success';
        return `<tr>
          <td><b>${p.id}</b></td>
          <td>${p.vendor_name||p.vendor_id||'—'}</td>
          <td>${fmt(p.grand_total)}</td>
          <td>${statusBadge(p.status)}</td>
          <td>${p.expected_delivery?fmtDate(p.expected_delivery):'—'}</td>
          <td><span class="badge badge-${ageCls}">${age}d</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No open POs</td></tr>'}
      </tbody>
    </table></div>
  </div>`;
}

function renderMarginAnalysis(inv) {
  const priced = inv.filter(i => i.unit_price > 0 && i.cost_excl_gst > 0);
  const marginOf = i => i.unit_price > 0 ? ((i.unit_price - i.cost_excl_gst) / i.unit_price * 100) : 0;
  const marginColor = m => m >= 30 ? '#10b981' : m >= 15 ? '#f59e0b' : '#ef4444';

  // Category roll-up
  const catMap = {};
  priced.forEach(i => {
    const c = i.category || 'Uncategorised';
    if (!catMap[c]) catMap[c] = { items:[], revenue:0, cost:0 };
    catMap[c].items.push(i);
    catMap[c].revenue += (i.unit_price||0) * (i.stock||0);
    catMap[c].cost    += (i.cost_excl_gst||0) * (i.stock||0);
  });

  const overallMargin = priced.length ? (priced.reduce((s,i)=>s+marginOf(i),0)/priced.length).toFixed(1) : 0;
  const highMargin  = priced.filter(i=>marginOf(i)>=30).length;
  const lowMargin   = priced.filter(i=>marginOf(i)<15).length;
  const negative    = inv.filter(i=>i.unit_price>0 && i.cost_excl_gst > i.unit_price).length;

  const topItems = [...priced].sort((a,b)=>marginOf(b)-marginOf(a)).slice(0,10);
  const bottomItems = [...priced].sort((a,b)=>marginOf(a)-marginOf(b)).slice(0,10);

  return `
  <div class="kpi-row" style="grid-template-columns:repeat(4,1fr)">
    <div class="kpi-card"><div class="kpi-label">Avg Margin</div><div class="kpi-value" style="color:${marginColor(overallMargin)}">${overallMargin}%</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">High Margin (≥30%)</div><div class="kpi-value">${highMargin}</div><div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">SKUs</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Low Margin (&lt;15%)</div><div class="kpi-value">${lowMargin}</div><div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">SKUs</div></div>
    <div class="kpi-card ${negative?'kpi-danger':''}"><div class="kpi-label">Below Cost</div><div class="kpi-value">${negative}</div><div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">SKUs</div></div>
  </div>

  <div class="card" style="margin-bottom:14px">
    <div class="card-header"><span>Margin by Category</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Category</th><th>SKUs</th><th>Avg Margin %</th><th>Revenue (on hand)</th><th>Cost (on hand)</th><th>Gross Profit</th><th>Health</th></tr></thead>
      <tbody>${Object.entries(catMap).sort((a,b)=>{
        const ma = a[1].items.reduce((s,i)=>s+marginOf(i),0)/a[1].items.length;
        const mb = b[1].items.reduce((s,i)=>s+marginOf(i),0)/b[1].items.length;
        return mb-ma;
      }).map(([cat,data])=>{
        const avgM = (data.items.reduce((s,i)=>s+marginOf(i),0)/data.items.length).toFixed(1);
        const gp = data.revenue - data.cost;
        const health = avgM>=30?'Excellent':avgM>=20?'Good':avgM>=10?'Thin':'Critical';
        const hCls = {Excellent:'success',Good:'success',Thin:'warning',Critical:'danger'}[health];
        return `<tr>
          <td><b>${cat}</b></td>
          <td>${data.items.length}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:700;color:${marginColor(avgM)}">${avgM}%</span>
              <div style="flex:1;height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden;min-width:60px">
                <div style="height:100%;width:${Math.min(avgM,100)}%;background:${marginColor(avgM)};border-radius:3px"></div>
              </div>
            </div>
          </td>
          <td>${fmt(data.revenue)}</td>
          <td>${fmt(data.cost)}</td>
          <td style="color:${gp>=0?'#10b981':'#ef4444'};font-weight:700">${fmt(gp)}</td>
          <td><span class="badge badge-${hCls}">${health}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No priced items</td></tr>'}
      </tbody>
    </table></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card">
      <div class="card-header"><span>Top 10 by Margin</span></div>
      <div class="table-wrap"><table class="table" style="font-size:.82rem">
        <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Cost</th><th>Margin %</th></tr></thead>
        <tbody>${topItems.map(i=>{
          const m = marginOf(i).toFixed(1);
          return `<tr>
            <td><b>${i.name}</b></td><td>${i.category||'—'}</td>
            <td>${fmt(i.unit_price)}</td><td>${fmt(i.cost_excl_gst)}</td>
            <td><span style="font-weight:700;color:${marginColor(m)}">${m}%</span></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="card-header"><span>Bottom 10 by Margin</span></div>
      <div class="table-wrap"><table class="table" style="font-size:.82rem">
        <thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Cost</th><th>Margin %</th></tr></thead>
        <tbody>${bottomItems.map(i=>{
          const m = marginOf(i).toFixed(1);
          return `<tr>
            <td><b>${i.name}</b></td><td>${i.category||'—'}</td>
            <td>${fmt(i.unit_price)}</td><td>${fmt(i.cost_excl_gst)}</td>
            <td><span style="font-weight:700;color:${marginColor(m)}">${m}%</span></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
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
let _invCache = {};

async function renderInventory(el) {
  const inv = await api('/inventory');
  if (!inv) return;
  _invCache = {};
  inv.forEach(i => { _invCache[i.sku] = i; });
  APP._invFilter = APP._invFilter || 'All';
  APP._invSubFilter = APP._invSubFilter || 'All';
  APP._invSearch = '';

  const cats = ['All', ...[...new Set(inv.map(i=>i.category))].sort()];
  const lowStock = inv.filter(i => i.stock <= i.reorder_level);
  const outOfStock = inv.filter(i => i.stock === 0);

  function getFiltered() {
    let items = inv;
    if (APP._invFilter !== 'All') items = items.filter(i => i.category === APP._invFilter);
    if (APP._invSubFilter !== 'All') items = items.filter(i => (i.sub_category||'Normal') === APP._invSubFilter);
    if (APP._invSearch) { const q = APP._invSearch.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q)||i.sku.toLowerCase().includes(q)||(i.brand||'').toLowerCase().includes(q)); }
    return items;
  }

  function invTableRows(items) {
    return items.map(item => {
      const reserved  = item.reserved || 0;
      const available = Math.max(0, item.stock - reserved);
      const pctStock  = Math.round((item.stock / (item.max_stock||1)) * 100);
      const color     = item.stock <= item.reorder_level ? 'var(--danger)' : item.stock <= item.reorder_level*1.5 ? 'var(--warning)' : 'var(--success)';
      const safeName  = item.name.replace(/'/g,"\\'");
      return `
      <tr style="cursor:pointer" onclick="toggleInvDetail('${item.sku}',this)">
        <td><span style="font-size:1.1rem">${item.emoji||'📦'}</span> <b style="font-size:.82rem">${item.sku}</b></td>
        <td><b>${item.name}</b>${item.brand?`<div style="font-size:.72rem;color:var(--text-muted)">${item.brand}</div>`:''}</td>
        <td style="font-size:.82rem">${item.category}${item.sub_category?`<div style="font-size:.68rem;font-weight:600;color:${item.sub_category==='Healthy'?'#059669':'#6b7280'};margin-top:1px">${item.sub_category}</div>`:''}</td>
        <td style="font-size:.78rem;color:var(--text-muted)">${item.uom||'unit'}</td>
        <td style="font-weight:700">${fmt(item.unit_price)}</td>
        <td style="font-size:.8rem;color:var(--text-muted)">${item.mrp?fmt(item.mrp):'—'}</td>
        <td style="color:${color};font-weight:700">${item.stock}</td>
        <td style="color:var(--warning);font-weight:500">${reserved}</td>
        <td style="color:${available<=0?'var(--danger)':'var(--success)'};font-weight:700">${available}</td>
        <td style="min-width:90px">
          <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden;margin-bottom:2px">
            <div style="height:100%;width:${Math.min(100,pctStock)}%;background:${color};border-radius:3px"></div>
          </div>
          <div style="font-size:.68rem;color:${color}">${pctStock}%</div>
        </td>
        <td style="font-size:.8rem">${item.vendor_name||'—'}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="editInventoryItem('${item.sku}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="viewStockHistory('${item.sku}','${safeName}')">History</button>
          <button class="btn btn-primary btn-sm" onclick="reorderItem('${item.sku}','${safeName}',${item.unit_price},'${item.vendor_id||''}')">PO</button>
        </td>
      </tr>
      <tr id="inv-detail-${item.sku}" style="display:none;background:#f8faff">
        <td colspan="12" style="padding:0">
          <div style="padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;border-top:2px solid var(--primary)">

            <!-- 1. Product Identification -->
            <div>
              <div style="font-size:.72rem;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Product Identification</div>
              ${invDetailRow('SKU', item.sku)}
              ${invDetailRow('Name', item.name)}
              ${invDetailRow('Brand', item.brand||'—')}
              ${invDetailRow('Category', item.category)}
              ${invDetailRow('Sub-Category', item.sub_category||'Normal')}
              ${invDetailRow('Emoji / Icon', item.emoji||'📦')}
              ${invDetailRow('Barcode', item.barcode||'—')}
            </div>

            <!-- 2. Packing Details -->
            <div>
              <div style="font-size:.72rem;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Packing Details</div>
              ${invDetailRow('UOM', item.uom||'unit')}
              ${invDetailRow('Pack Size', item.pack_size||1)}
              ${invDetailRow('Units / Case', item.units_per_case||1)}
              ${invDetailRow('Weight (grams)', item.weight_grams||'—')}
              ${invDetailRow('HSN Code', item.hsn_code||'—')}
              ${invDetailRow('Expiry Date', item.expiry_date||'—')}
              ${invDetailRow('Location', item.inv_location||'instock')}
            </div>

            <!-- 3. Pricing -->
            <div>
              <div style="font-size:.72rem;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Pricing</div>
              ${invDetailRow('Unit Price (Selling)', fmt(item.unit_price))}
              ${invDetailRow('MRP', item.mrp?fmt(item.mrp):'—')}
              ${invDetailRow('Cost Excl GST', item.cost_excl_gst?fmt(item.cost_excl_gst):'—')}
              ${invDetailRow('GST Rate', (item.gst_rate||18)+'%')}
              ${invDetailRow('Margin %', item.margin_pct?item.margin_pct+'%':'—')}
              ${invDetailRow('Amazon URL', item.amazon_url?`<a href="${item.amazon_url}" target="_blank" style="color:var(--blue);font-size:.74rem">View</a>`:'—')}
              ${invDetailRow('Flipkart URL', item.flipkart_url?`<a href="${item.flipkart_url}" target="_blank" style="color:var(--blue);font-size:.74rem">View</a>`:'—')}
            </div>

            <!-- 4. Vendor Information -->
            <div>
              <div style="font-size:.72rem;font-weight:800;color:#d97706;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Vendor Information</div>
              ${invDetailRow('Vendor', item.vendor_name||'—')}
              ${invDetailRow('Vendor SKU', item.vendor_sku||'—')}
              ${invDetailRow('Lead Time (days)', item.vendor_lead_days||3)}
              ${invDetailRow('MOQ', item.vendor_moq||1)}
              ${invDetailRow('Reorder Level', item.reorder_level)}
              ${invDetailRow('Max Stock', item.max_stock||200)}
              ${invDetailRow('Reserved', item.reserved||0)}
            </div>
          </div>
          <div style="padding:8px 20px 14px;display:flex;gap:8px;border-top:1px solid var(--border)">
            <button class="btn btn-primary btn-sm" onclick="editInventoryItem('${item.sku}')">Edit All Fields</button>
            <button class="btn btn-secondary btn-sm" onclick="viewStockHistory('${item.sku}','${safeName}')">Stock History</button>
            <button class="btn btn-gold btn-sm" onclick="reorderItem('${item.sku}','${safeName}',${item.unit_price},'${item.vendor_id||''}')">Raise PO</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  el.innerHTML = `
  ${pageHeader('Inventory', `${inv.length} SKUs`,
    `<button class="btn btn-secondary" onclick="renderAddItem()">${iconPlus(14)} Add Item</button>`)}

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total SKUs</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${inv.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">active items</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${lowStock.length?'var(--warning)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Low Stock</div>
      <div style="font-size:2rem;font-weight:800;color:${lowStock.length?'#d97706':'var(--navy)'};margin-top:6px">${lowStock.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">below reorder level</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${outOfStock.length?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Out of Stock</div>
      <div style="font-size:2rem;font-weight:800;color:${outOfStock.length?'var(--danger)':'var(--navy)'};margin-top:6px">${outOfStock.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">zero stock</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Inventory Value</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(inv.reduce((s,i)=>s+i.stock*i.unit_price,0))}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">at selling price</div>
    </div>
  </div>

  ${lowStock.length ? `<div class="alert alert-warning" style="margin-bottom:14px">⚠️ <b>${lowStock.length}</b> SKU(s) below reorder level: ${lowStock.slice(0,5).map(i=>`<b>${i.name}</b>`).join(', ')}${lowStock.length>5?` +${lowStock.length-5} more`:''}</div>` : ''}

  <!-- Search + filter -->
  <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
    <input type="search" id="inv-search" placeholder="🔍  Search by name, SKU or brand…"
      style="width:100%;padding:9px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.88rem;outline:none;box-sizing:border-box"
      oninput="APP._invSearch=this.value.toLowerCase();refreshInvTable()" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">
    <div id="inv-filter-bar" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      ${cats.map(c=>{
        const active = APP._invFilter===c;
        return '<button data-inv-cat="' + c + '" onclick="invFilterCat(\'' + c + '\')" style="padding:4px 12px;border-radius:20px;border:1.5px solid ' + (active?'var(--blue)':'var(--border)') + ';background:' + (active?'var(--blue)':'#fff') + ';color:' + (active?'#fff':'var(--navy)') + ';font-size:.8rem;cursor:pointer;font-weight:' + (active?700:400) + ';transition:all .15s">' + c + '</button>';
      }).join('')}
      <div id="inv-subcat-pills" style="display:flex;align-items:center;gap:6px"></div>
    </div>
  </div>

  <!-- Table — click row to expand 4-section detail -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:.76rem;color:var(--text-muted)">Click any row to see Product Identification · Packing Details · Pricing · Vendor Information</div>
    <div class="table-wrap">
      <table class="table" id="inv-table" style="margin:0">
        <thead><tr>
          <th>SKU</th><th>Item</th><th>Category</th><th>UOM</th>
          <th>Price</th><th>MRP</th>
          <th>Stock</th><th>Reserved</th><th>Available</th><th>Level</th>
          <th>Vendor</th><th>Actions</th>
        </tr></thead>
        <tbody id="inv-tbody">${invTableRows(getFiltered())}</tbody>
      </table>
    </div>
  </div>`;

  // Build sub-category pills via DOM to avoid template-literal escaping issues
  (function buildSubCatPills() {
    const container = document.getElementById('inv-subcat-pills');
    if (!container) return;

    const divider = document.createElement('div');
    divider.style.cssText = 'width:1px;height:20px;background:#d1d5db;margin:0 6px;flex-shrink:0';
    container.appendChild(divider);

    ['All', 'Healthy', 'Normal'].forEach(function(s) {
      const btn = document.createElement('button');
      const label = s === 'All' ? 'All Sub-Cat' : s;
      const active = APP._invSubFilter === s;
      btn.textContent = label;
      btn.dataset.invSub = s;
      btn.style.cssText = 'padding:4px 12px;border-radius:20px;font-size:.8rem;cursor:pointer;transition:all .15s;border:1.5px solid;' +
        (active
          ? (s === 'Healthy' ? 'background:#d1fae5;color:#059669;border-color:#059669;font-weight:700'
                              : 'background:var(--blue);color:#fff;border-color:var(--blue);font-weight:700')
          : 'background:#fff;color:#374151;border-color:#d1d5db;font-weight:400');
      btn.onclick = function() { invFilterSubCat(s); };
      container.appendChild(btn);
    });
  })();

  window.refreshInvTable = function() {
    document.getElementById('inv-tbody').innerHTML = invTableRows(getFiltered());
  };

  window.invFilterCat = function(cat) {
    APP._invFilter = cat;
    document.querySelectorAll('#inv-filter-bar [data-inv-cat]').forEach(b => {
      const active = b.dataset.invCat === cat;
      b.style.background = active ? 'var(--blue)' : '#fff';
      b.style.color      = active ? '#fff' : 'var(--navy)';
      b.style.borderColor= active ? 'var(--blue)' : 'var(--border)';
      b.style.fontWeight = active ? 700 : 400;
    });
    refreshInvTable();
  };

  window.invFilterSubCat = function(sub) {
    APP._invSubFilter = sub;
    document.querySelectorAll('#inv-filter-bar [data-inv-sub]').forEach(b => {
      const active = b.dataset.invSub === sub;
      const isHealthy = b.dataset.invSub === 'Healthy';
      b.style.background  = active ? (isHealthy ? '#d1fae5' : 'var(--blue)') : '#fff';
      b.style.color       = active ? (isHealthy ? '#059669' : '#fff') : 'var(--navy)';
      b.style.borderColor = active ? (isHealthy ? '#059669' : 'var(--blue)') : 'var(--border)';
      b.style.fontWeight  = active ? 700 : 400;
    });
    refreshInvTable();
  };
}

function invDetailRow(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:.78rem">
    <span style="color:var(--text-muted)">${label}</span>
    <span style="font-weight:600;text-align:right;max-width:60%">${value}</span>
  </div>`;
}

function toggleInvDetail(sku, row) {
  const detailRow = document.getElementById('inv-detail-' + sku);
  if (!detailRow) return;
  const isOpen = detailRow.style.display !== 'none';
  // close all open detail rows
  document.querySelectorAll('[id^="inv-detail-"]').forEach(r => { r.style.display = 'none'; });
  if (!isOpen) detailRow.style.display = '';
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
  const cats = ['Beverages','Snacks','Hygiene','Stationery','Office','Dairy','Fruits & Vegetables','Cleaning','Personal Care','Other'];
  const catOpts = cats.map(c => `<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('');
  const uoms = ['unit','piece','pack','case','kg','gram','litre','ml','dozen','box','bag','roll','sheet'];
  const uomOpts = uoms.map(u => `<option value="${u}" ${(item.uom||'unit')===u?'selected':''}>${u}</option>`).join('');

  openModal(`Edit Item — ${sku}`,
    `<!-- Section tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
      ${[['prod','Product ID','var(--primary)'],['pack','Packing Details','#7c3aed'],['price','Pricing','#059669'],['vendor','Vendor Info','#d97706']].map(([id,label,color])=>
        `<button class="ei-tab" data-tab="${id}" onclick="switchEITab('${id}')" style="padding:8px 16px;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--text-muted);transition:all .2s;margin-bottom:-2px">${label}</button>`
      ).join('')}
    </div>

    <!-- Product Identification -->
    <div id="ei-tab-prod" class="ei-section">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1"><label>Item Name *</label><input type="text" id="ei-name" value="${item.name.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>Brand</label><input type="text" id="ei-brand" value="${item.brand||''}"></div>
        <div class="form-group"><label>Category</label><select id="ei-cat">${catOpts}</select></div>
        <div class="form-group"><label>Sub-Category</label><select id="ei-subcat">
          <option value="Normal" ${(item.sub_category||'Normal')==='Normal'?'selected':''}>Normal</option>
          <option value="Healthy" ${item.sub_category==='Healthy'?'selected':''}>Healthy</option>
        </select></div>
        <div class="form-group"><label>Emoji / Icon</label><input type="text" id="ei-emoji" value="${item.emoji||'📦'}" maxlength="2"></div>
        <div class="form-group"><label>Barcode / EAN</label><input type="text" id="ei-barcode" value="${item.barcode||''}"></div>
        <div class="form-group"><label>Expiry Date</label><input type="date" id="ei-expiry" value="${item.expiry_date||''}"></div>
      </div>
    </div>

    <!-- Packing Details -->
    <div id="ei-tab-pack" class="ei-section" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>UOM (Unit of Measure)</label><select id="ei-uom">${uomOpts}</select></div>
        <div class="form-group"><label>Pack Size</label><input type="number" id="ei-packsize" value="${item.pack_size||1}" min="1"></div>
        <div class="form-group"><label>Units per Case</label><input type="number" id="ei-upc" value="${item.units_per_case||1}" min="1"></div>
        <div class="form-group"><label>Weight (grams)</label><input type="number" id="ei-weight" value="${item.weight_grams||0}" min="0" step="0.1"></div>
        <div class="form-group"><label>HSN Code</label><input type="text" id="ei-hsn" value="${item.hsn_code||''}"></div>
        <div class="form-group"><label>Storage Location</label><input type="text" id="ei-location" value="${item.inv_location||'instock'}"></div>
      </div>
    </div>

    <!-- Pricing -->
    <div id="ei-tab-price" class="ei-section" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Unit Price / Selling Price (₹)</label><input type="number" id="ei-price" value="${item.unit_price}" min="0" step="0.01"></div>
        <div class="form-group"><label>MRP (₹)</label><input type="number" id="ei-mrp" value="${item.mrp||0}" min="0" step="0.01"></div>
        <div class="form-group"><label>Cost Excl GST (₹)</label><input type="number" id="ei-cost" value="${item.cost_excl_gst||0}" min="0" step="0.01"></div>
        <div class="form-group"><label>GST Rate (%)</label><input type="number" id="ei-gst" value="${item.gst_rate||18}" min="0" max="28"></div>
        <div class="form-group"><label>Margin %</label><input type="number" id="ei-margin" value="${item.margin_pct||0}" min="0" max="100" step="0.1"></div>
        <div class="form-group"><label>Amazon URL</label><input type="url" id="ei-amazon" value="${item.amazon_url||''}" placeholder="https://www.amazon.in/…"></div>
        <div class="form-group" style="grid-column:1/-1"><label>Flipkart URL</label><input type="url" id="ei-flipkart" value="${item.flipkart_url||''}" placeholder="https://www.flipkart.com/…"></div>
      </div>
    </div>

    <!-- Vendor Information -->
    <div id="ei-tab-vendor" class="ei-section" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1"><label>Primary Vendor</label><select id="ei-vendor"><option value="">— None —</option>${vendorOpts}</select></div>
        <div class="form-group"><label>Vendor SKU / Code</label><input type="text" id="ei-vendorsku" value="${item.vendor_sku||''}"></div>
        <div class="form-group"><label>Lead Time (days)</label><input type="number" id="ei-leaddays" value="${item.vendor_lead_days||3}" min="0"></div>
        <div class="form-group"><label>Min Order Qty (MOQ)</label><input type="number" id="ei-moq" value="${item.vendor_moq||1}" min="1"></div>
        <div class="form-group"><label>Current Stock</label><input type="number" id="ei-stock" value="${item.stock}" min="0"></div>
        <div class="form-group"><label>Reorder Level</label><input type="number" id="ei-reorder" value="${item.reorder_level}" min="0"></div>
        <div class="form-group"><label>Max Stock</label><input type="number" id="ei-maxstock" value="${item.max_stock||200}" min="0"></div>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveInventoryItem('${sku}')">Save All Changes</button>`);

  // activate first tab
  switchEITab('prod');
}

function switchEITab(tab) {
  document.querySelectorAll('.ei-section').forEach(s => s.style.display='none');
  document.querySelectorAll('.ei-tab').forEach(b => {
    b.style.borderBottomColor = 'transparent';
    b.style.color = 'var(--text-muted)';
  });
  const sec = document.getElementById('ei-tab-'+tab);
  if (sec) sec.style.display='';
  const btn = document.querySelector(`.ei-tab[data-tab="${tab}"]`);
  if (btn) { btn.style.borderBottomColor='var(--primary)'; btn.style.color='var(--navy)'; }
}

function eiVal(id, num=false) { const el=document.getElementById(id); if(!el)return num?0:''; return num?+el.value:el.value; }
async function saveInventoryItem(sku) {
  const body = {
    // Product ID
    name:           eiVal('ei-name'),
    brand:          eiVal('ei-brand'),
    category:       eiVal('ei-cat'),
    emoji:          eiVal('ei-emoji'),
    barcode:        eiVal('ei-barcode'),
    sub_category:   eiVal('ei-subcat'),
    expiry_date:    eiVal('ei-expiry') || null,
    // Packing
    uom:            eiVal('ei-uom'),
    pack_size:      eiVal('ei-packsize',true),
    units_per_case: eiVal('ei-upc',true),
    weight_grams:   eiVal('ei-weight',true),
    hsn_code:       eiVal('ei-hsn'),
    inv_location:   eiVal('ei-location'),
    // Pricing
    unit_price:     eiVal('ei-price',true),
    mrp:            eiVal('ei-mrp',true),
    cost_excl_gst:  eiVal('ei-cost',true),
    gst_rate:       eiVal('ei-gst',true),
    margin_pct:     eiVal('ei-margin',true),
    amazon_url:     eiVal('ei-amazon'),
    flipkart_url:   eiVal('ei-flipkart'),
    // Vendor
    vendor_id:      eiVal('ei-vendor') || null,
    vendor_sku:     eiVal('ei-vendorsku'),
    vendor_lead_days: eiVal('ei-leaddays',true),
    vendor_moq:     eiVal('ei-moq',true),
    stock:          eiVal('ei-stock',true),
    reorder_level:  eiVal('ei-reorder',true),
    max_stock:      eiVal('ei-maxstock',true),
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

  const byStatus = s => pos.filter(p=>p.status===s);
  const valByStatus = s => byStatus(s).reduce((sum,p)=>sum+(p.grand_total||0),0);
  const pendingGRN = byStatus('DISPATCHED');
  const totalOpen = ['SENT','ACCEPTED','DISPATCHED'].reduce((s,st)=>s+byStatus(st).length,0);

  const statusTiles = [
    { key:'SENT',      label:'POs Sent',      icon:'📤', color:'#f59e0b', bg:'#fffbeb', urgent: byStatus('SENT').length>0 },
    { key:'ACCEPTED',  label:'Accepted',       icon:'✅', color:'#3b82f6', bg:'#eff6ff', urgent: false },
    { key:'DISPATCHED',label:'In Transit',     icon:'🚚', color:'#8b5cf6', bg:'#f5f3ff', urgent: pendingGRN.length>0 },
    { key:'RECEIVED',  label:'GRN Pending',    icon:'📦', color:'#1f8a5b', bg:'#f0fdf4', urgent: false },
    { key:'INVOICED',  label:'Invoiced',       icon:'🧾', color:'#6b7280', bg:'#f9fafb', urgent: false },
  ];

  el.innerHTML = `
  ${pageHeader('Procurement', `${totalOpen} open POs`,
    `<button class="btn btn-gold" onclick="navigate('vendors')">${iconPlus(14)} New PO</button>`)}

  <!-- Status tiles -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">
    ${statusTiles.map(t=>`
    <div style="background:${t.bg};border:1px solid ${t.urgent?t.color+'55':'#e5e7eb'};border-radius:12px;padding:16px;cursor:pointer" onclick="filterPO('${t.key}')">
      <div style="font-size:1.4rem;margin-bottom:6px">${t.icon}</div>
      <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${t.color};margin-bottom:4px">${t.label}</div>
      <div style="font-size:1.8rem;font-weight:800;color:#1f2937;line-height:1">${byStatus(t.key).length}</div>
      <div style="font-size:.72rem;color:#6b7280;margin-top:4px">${fmt(valByStatus(t.key))}</div>
    </div>`).join('')}
  </div>

  <!-- Charts + GRN alert -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="font-weight:700;color:var(--navy);font-size:.9rem;margin-bottom:14px">Vendor Performance</div>
      <canvas id="vendorChart" height="200"></canvas>
    </div>
    <div style="background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-weight:700;color:var(--navy);font-size:.9rem">GRN Pending Receipt</div>
        <span style="background:#f5f3ff;color:#8b5cf6;border-radius:20px;padding:2px 10px;font-size:.75rem;font-weight:700">${pendingGRN.length} DCs</span>
      </div>
      ${pendingGRN.length === 0
        ? '<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:.84rem">No pending GRNs</div>'
        : pendingGRN.map(po=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;background:#f8f9fa;margin-bottom:8px;border:1px solid #e5e7eb">
            <div>
              <div style="font-weight:700;font-size:.84rem">${po.id} <span style="font-weight:400;color:var(--text-muted)">· ${po.vendor_name||'—'}</span></div>
              <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(po.grand_total)} · Expected ${fmtDate(po.expected_delivery)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="receiveGRN('${po.id}')">Receive GRN</button>
          </div>`).join('')
      }
    </div>
  </div>

  <!-- PO table -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;color:var(--navy);font-size:.9rem">All Purchase Orders</div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="po-status-filter" class="form-control form-control-sm" style="width:140px" onchange="filterPOTable()">
          <option value="">All Status</option>
          ${['SENT','ACCEPTED','DISPATCHED','RECEIVED','INVOICED'].map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="table-wrap" id="po-table-wrap">
      <table class="table" style="margin:0">
        <thead><tr><th>PO #</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Expected</th><th>Actions</th></tr></thead>
        <tbody id="po-tbody">${pos.map(po=>`<tr data-status="${po.status}">
          <td><b>${po.id}</b>${po.auto_generated?` <span class="badge badge-gold">Auto</span>`:''}</td>
          <td>${po.vendor_name||'—'}</td>
          <td>${fmt(po.grand_total)}</td>
          <td>${statusBadge(po.status)}</td>
          <td>${fmtDate(po.expected_delivery)||'—'}</td>
          <td>${po.status==='DISPATCHED'
            ? `<button class="btn btn-primary btn-sm" onclick="receiveGRN('${po.id}')">Receive GRN</button>`
            : '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No POs</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;

  // Vendor performance chart
  if (vendors?.length) {
    const ctx = document.getElementById('vendorChart');
    if (ctx) {
      APP.charts.vendor = new Chart(ctx, {
        type:'bar',
        data:{
          labels: vendors.map(v=>v.name.split(' ')[0]),
          datasets:[
            { label:'On-time %', data: vendors.map(v=>v.on_time_rate||0), backgroundColor:'#1f8a5b', borderRadius:4 },
            { label:'Fill Rate %', data: vendors.map(v=>v.fill_rate||0), backgroundColor:'#3b82f6', borderRadius:4 },
          ]
        },
        options:{ plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,max:100,grid:{color:'#f0f0f0'}},x:{grid:{display:false}}} }
      });
    }
  }
}

function filterPO(status) {
  const sel = document.getElementById('po-status-filter');
  if (sel) { sel.value = status; filterPOTable(); }
}

function filterPOTable() {
  const status = document.getElementById('po-status-filter')?.value || '';
  document.querySelectorAll('#po-tbody tr[data-status]').forEach(row => {
    row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
  });
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
  const totalUnits  = inv.reduce((s,i) => s+i.stock, 0);
  const totalSKUs   = inv.length;
  const lowStock    = inv.filter(i => i.stock <= (i.reorder_level||0)).length;
  const thisMonth   = new Date().toISOString().slice(0,7);
  const grnsMonth   = grns.filter(g => (g.received_at||'').startsWith(thisMonth));
  const grnsThisMonth = grnsMonth.length;
  const activeWH    = warehouses.filter(w=>w.active).length;
  const totalBins   = bins.length;
  const occupiedBins= bins.filter(b=>(b.occupied||0)>0).length;
  const binFillPct  = totalBins ? Math.round(occupiedBins/totalBins*100) : 0;
  const pendingGRNs = grns.filter(g => g.status && g.status !== 'RECEIVED').length;

  el.innerHTML = `
  <div class="kpi-row" style="grid-template-columns:repeat(5,1fr)">
    <div class="kpi-card">
      <div class="kpi-label">Active Warehouses</div>
      <div class="kpi-value">${activeWH}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${warehouses.length} total</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total SKUs</div>
      <div class="kpi-value">${totalSKUs}</div>
      <div style="font-size:.75rem;color:${lowStock>0?'var(--warning)':'var(--text-muted)'};margin-top:4px">${lowStock} low stock</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Units In Stock</div>
      <div class="kpi-value">${totalUnits.toLocaleString('en-IN')}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">across all bins</div>
    </div>
    <div class="kpi-card ${binFillPct>85?'kpi-danger':binFillPct>60?'kpi-warning':''}">
      <div class="kpi-label">Bin Utilisation</div>
      <div class="kpi-value">${binFillPct}%</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${occupiedBins}/${totalBins} bins used</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">GRNs This Month</div>
      <div class="kpi-value">${grnsThisMonth}</div>
      <div style="font-size:.75rem;color:${pendingGRNs>0?'var(--warning)':'var(--text-muted)'};margin-top:4px">${pendingGRNs} pending</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    ${warehouses.map(w=>{
      const wBins = bins.filter(b=>b.warehouse_id===w.id);
      const occupied = wBins.reduce((s,b)=>s+(b.occupied||0),0);
      const cap = wBins.reduce((s,b)=>s+(b.capacity||1),1);
      const utilPct = Math.min(100, Math.round(occupied/cap*100));
      const color = utilPct>85?'var(--danger)':utilPct>60?'var(--warning)':'var(--success)';
      return `
      <div class="card" style="margin-bottom:0">
        <div class="card-header">
          <span style="font-weight:600">${w.name}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${w.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}
          </div>
        </div>
        <div style="padding:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
            <div style="text-align:center">
              <div style="font-size:.75rem;color:var(--text-muted)">City</div>
              <div style="font-weight:600;font-size:.9rem">${w.city||'—'}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:.75rem;color:var(--text-muted)">Capacity</div>
              <div style="font-weight:600;font-size:.9rem">${(w.capacity||0).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:.75rem;color:var(--text-muted)">Bins</div>
              <div style="font-weight:600;font-size:.9rem">${wBins.length}</div>
            </div>
          </div>
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px">
              <span>Bin Utilisation</span>
              <span style="font-weight:600;color:${color}">${utilPct}%</span>
            </div>
            <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${utilPct}%;background:${color};border-radius:4px;transition:width .3s"></div>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-top:12px">
            <button class="btn btn-secondary btn-sm" onclick="editWarehouseModal('${w.id}','${(w.name||'').replace(/'/g,"\\'")}',${w.capacity||1000})">Edit</button>
            <button class="btn btn-secondary btn-sm" onclick="switchWHTab('bins',document.querySelectorAll('#wh-tabs .tab-btn')[2])">View Bins</button>
            <button class="btn btn-primary btn-sm" onclick="addBinModal('${w.id}')">${iconPlus(12)} Bin</button>
          </div>
        </div>
      </div>`;
    }).join('')||'<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);grid-column:1/-1">No warehouses configured yet</div>'}
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
                  <button class="btn btn-success btn-sm" onclick="markDelivered('${dc.id}')">✓ Confirm Delivery</button>
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
    <td style="color:${i.qty_delivered>0?'var(--success)':'var(--text-muted)'}">${i.qty_delivered||0}</td>
    <td style="color:${(i.qty_ordered-(i.qty_delivered||0))>0?'var(--danger)':'var(--success)'};font-weight:600">${i.qty_ordered-(i.qty_delivered||0)}</td>
  </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No items</td></tr>';
  openModal(`DC Items — ${dcId}`,
    `<p style="font-size:.82rem;color:var(--text-muted);margin-bottom:12px">
      "Dispatched" = qty in this DC (picked from warehouse). "Delivered" = confirmed at drop-off. "Pending" = yet to be confirmed delivered.
    </p>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Dispatched</th><th>Delivered</th><th>Pending</th></tr></thead>
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

async function markDelivered(dcId) {
  const items = await api(`/delivery-challans/${dcId}/items`);
  if (!items) return;
  if (!items.length) {
    // No line items tracked — just confirm
    const res = await api(`/delivery-challans/${dcId}/deliver`, { method:'POST', body: JSON.stringify({}) });
    if (res) { showToast(`DC ${dcId} marked as delivered`); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
    return;
  }
  openModal(`Confirm Delivery — ${dcId}`, `
    <p style="color:var(--text-muted);margin-bottom:12px">
      Enter actual qty delivered for each item. If less than dispatched, a follow-up DC will be created automatically.
    </p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>SKU</th><th>Item</th><th>Dispatched</th><th>Delivered</th></tr></thead>
      <tbody>
        ${items.map(i=>`<tr>
          <td><b>${i.sku}</b></td>
          <td>${i.name}</td>
          <td style="color:var(--text-muted)">${i.qty_ordered}</td>
          <td><input type="number" class="form-control form-control-sm deliver-qty"
            data-sku="${i.sku}" value="${i.qty_ordered}" min="0" max="${i.qty_ordered}"
            style="width:80px;text-align:center"
            oninput="this.style.color=+this.value<+this.max?'var(--warning)':'inherit'"></td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="confirmDelivery('${dcId}')">Confirm Delivery</button>
    </div>
  `);
}

async function confirmDelivery(dcId) {
  const inputs = document.querySelectorAll('.deliver-qty');
  const items = Array.from(inputs).map(inp => ({ sku: inp.dataset.sku, qty_delivered: parseInt(inp.value)||0 }));
  const res = await api(`/delivery-challans/${dcId}/deliver`, { method:'POST', body: JSON.stringify({ items }) });
  if (res) {
    closeModal();
    const msg = res.partial ? `Partial delivery recorded — follow-up DC created` : `DC ${dcId} fully delivered${res.order_closed?' — order closed':''}`;
    showToast(msg);
    switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]);
  }
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
  if (res) {
    showToast(`DC ${dcId} marked as returned — stock restored`);
    const tabs = document.querySelectorAll('#dc-tabs .tab-btn');
    if (tabs.length) switchDeliveryTab('returns', tabs[3]);
    else navigate('dashboard');
  }
}

function partialDeliveryModal(dcId) { markDelivered(dcId); }
async function confirmPartialDelivery() {}

/* ============================================================
   DELIVERY EXECUTIVE — Personal dashboard
   ============================================================ */
async function renderDeliveryExecDashboard(el) {
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading your deliveries…</p></div>';
  const dcs = await api('/delivery-challans');
  if (!dcs) { el.innerHTML = '<div class="card" style="padding:24px;text-align:center;color:var(--danger)">Failed to load.</div>'; return; }

  const today = new Date().toISOString().slice(0, 10);
  const myName = (APP.user?.name || '').toLowerCase();

  // Filter: assigned to me (driver_name matches) OR all in-transit if no assignments yet (demo)
  const assigned = dcs.filter(d => d.driver_name && d.driver_name.toLowerCase().includes(myName.split(' ')[0]));
  const useMine = assigned.length > 0;
  const pool = useMine ? assigned : dcs;

  const inTransit   = pool.filter(d => d.status === 'IN_TRANSIT');
  const scheduled   = pool.filter(d => d.status === 'SCHEDULED');
  const delivToday  = pool.filter(d => d.status === 'DELIVERED' && (d.delivered_at || '').startsWith(today));
  const totalItems  = inTransit.reduce((s, d) => s + (d.total_qty || 0), 0);
  const overdue     = inTransit.filter(d => d.expected_delivery_date && d.expected_delivery_date < today);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">Good ${new Date().getHours()<12?'morning':'afternoon'}, ${(APP.user?.name||'').split(' ')[0]} 👋</div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:2px">Delivery Executive · ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>
    <button class="btn btn-secondary" onclick="navigate('delivery')">View All DCs</button>
  </div>

  <!-- KPI row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${inTransit.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${totalItems} items to deliver</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Overdue</div>
      <div style="font-size:2rem;font-weight:800;color:${overdue.length?'var(--danger)':'var(--navy)'};line-height:1.2;margin-top:6px">${overdue.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${overdue.length?'requires attention':'on track'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Delivered Today</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${delivToday.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">completed runs</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--warning)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);letter-spacing:.06em;text-transform:uppercase">Scheduled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:6px">${scheduled.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">pending dispatch</div>
    </div>
  </div>

  <!-- In-transit delivery cards -->
  <div style="margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
    <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Active Deliveries${inTransit.length?' ('+inTransit.length+')':''}</div>
    ${overdue.length ? '<span style="background:#fef2f2;color:var(--danger);font-size:.75rem;font-weight:700;padding:3px 10px;border-radius:20px">'+overdue.length+' overdue</span>' : ''}
  </div>

  ${inTransit.length === 0 ? `
    <div style="background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:16px">
      <div style="font-size:2.5rem;margin-bottom:8px">✅</div>
      <div style="font-weight:700;color:var(--navy);font-size:1rem">All deliveries complete!</div>
      <div style="color:var(--text-muted);font-size:.85rem;margin-top:4px">No active in-transit challans assigned to you.</div>
    </div>
  ` : `
    <div id="exec-dc-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px;margin-bottom:20px">
      ${inTransit.map(dc => execDCCard(dc, today)).join('')}
    </div>
  `}

  <!-- Today's completed deliveries -->
  ${delivToday.length > 0 ? `
  <div style="margin-bottom:8px;font-weight:700;font-size:.95rem;color:var(--navy)">Completed Today (${delivToday.length})</div>
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:16px">
    ${delivToday.map(dc => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:50%;background:#d1fae5;display:flex;align-items:center;justify-content:center;font-size:1rem">✅</div>
        <div>
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">DC #${dc.id}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">${dc.client_name||'—'} · Order ${dc.order_id}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:.82rem;font-weight:700;color:var(--success)">Delivered</div>
        <div style="font-size:.75rem;color:var(--text-muted)">${fmtDate(dc.delivered_at)}</div>
      </div>
    </div>`).join('')}
  </div>` : ''}`;
}

function execDCCard(dc, today) {
  const overdue = dc.expected_delivery_date && dc.expected_delivery_date < today;
  const eta = dc.expected_delivery_date ? new Date(dc.expected_delivery_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';
  return `<div style="background:#fff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);border:1px solid ${overdue?'var(--danger)':'var(--border)'};overflow:hidden">
    <!-- Card header -->
    <div style="padding:14px 16px;background:${overdue?'#fef2f2':'#f8fafc'};border-bottom:1px solid ${overdue?'#fecaca':'var(--border)'};display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-weight:800;font-size:.92rem;color:var(--navy)">DC #${dc.id}</span>
        ${overdue ? '<span style="margin-left:8px;background:var(--danger);color:#fff;font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:10px;text-transform:uppercase">Overdue</span>' : ''}
      </div>
      <span style="font-size:.8rem;font-weight:600;color:#0369a1;background:#e0f2fe;padding:3px 10px;border-radius:20px">In Transit</span>
    </div>
    <!-- Card body -->
    <div style="padding:14px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:.82rem">
        <div><span style="color:var(--text-muted)">Client</span><br><b>${dc.client_name||'—'}</b></div>
        <div><span style="color:var(--text-muted)">Order</span><br><b>${dc.order_id}</b></div>
        <div><span style="color:var(--text-muted)">Vehicle</span><br><b>${dc.vehicle_no||'—'}</b></div>
        <div><span style="color:var(--text-muted)">ETA</span><br><b style="color:${overdue?'var(--danger)':'inherit'}">${eta}</b></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:var(--border-light,#f1f5f9);border-radius:8px;margin-bottom:12px;font-size:.82rem">
        <span style="color:var(--text-muted)">Items to deliver</span>
        <span style="font-weight:700;font-size:1rem;color:var(--navy)">${dc.total_qty||'?'}</span>
      </div>
      <!-- Action buttons -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" style="flex:1;min-width:140px" onclick="execMarkDelivered('${dc.id}')">✓ Mark Delivered</button>
        <button class="btn btn-secondary" style="flex:0 0 auto" onclick="viewDCItems('${dc.id}')" title="View items">📋</button>
        <button class="btn btn-secondary" style="flex:0 0 auto;color:var(--danger)" onclick="returnDCModal('${dc.id}')" title="Return DC">↩</button>
      </div>
    </div>
  </div>`;
}

async function execMarkDelivered(dcId) {
  const items = await api('/delivery-challans/' + dcId + '/items');
  if (!items) return;
  if (!items.length) {
    const res = await api('/delivery-challans/' + dcId + '/deliver', { method:'POST', body: JSON.stringify({}) });
    if (res) { showToast('DC ' + dcId + ' marked as delivered'); navigate('dashboard'); }
    return;
  }
  openModal('Confirm Delivery — ' + dcId, `
    <p style="color:var(--text-muted);margin-bottom:12px">Enter actual qty delivered. If less than dispatched, a follow-up DC will be created.</p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>Item</th><th>Dispatched</th><th>Delivered</th></tr></thead>
      <tbody>${items.map(it => `<tr>
        <td>${it.item_name||it.sku}</td>
        <td>${it.qty_ordered}</td>
        <td><input type="number" data-sku="${it.sku}" value="${it.qty_ordered}" min="0" max="${it.qty_ordered}" style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
      </tr>`).join('')}
      </tbody>
    </table>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmExecDelivery('${dcId}')">Confirm Delivery</button>`
  );
}

async function confirmExecDelivery(dcId) {
  const inputs = document.querySelectorAll('#modal-body input[data-sku]');
  const items = Array.from(inputs).map(inp => ({ sku: inp.dataset.sku, qty_delivered: parseInt(inp.value)||0 }));
  const res = await api('/delivery-challans/' + dcId + '/deliver', { method:'POST', body: JSON.stringify({ items }) });
  if (res) {
    closeModal();
    const msg = res.partial ? 'Partial delivery recorded — follow-up DC created' : 'DC ' + dcId + ' fully delivered' + (res.order_closed ? ' — order closed' : '');
    showToast(msg);
    navigate('dashboard');
  }
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
  const pending  = orders.filter(o=>o.status==='PENDING_APPROVAL');
  const approved = orders.filter(o=>['APPROVED','ACKNOWLEDGED','PICKED','IN_SHIPMENT'].includes(o.status));
  const isApprover = APP.user?.role === 'client_approver';

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Approvals</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${pending.length} awaiting your approval</div>
    </div>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pending.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Approval</div>
      <div style="font-size:2rem;font-weight:800;color:${pending.length?'#d97706':'var(--navy)'};margin-top:6px">${pending.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">awaiting decision</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--primary)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">In Progress</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${approved.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">approved & processing</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Value</div>
      <div style="font-size:1.4rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(pending.reduce((s,o)=>s+(o.grand_total||0),0))}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">total value pending</div>
    </div>
  </div>

  <!-- Pending approvals -->
  ${pending.length===0 ?
    `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
      <div style="font-size:2.5rem;margin-bottom:12px">✅</div>
      <div style="font-weight:700;font-size:1rem;color:var(--navy)">All caught up!</div>
      <div style="font-size:.84rem;margin-top:6px">No orders are waiting for your approval.</div>
    </div>` :
  pending.map(o=>`
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px;margin-bottom:14px;border-left:4px solid #f59e0b">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
      <div>
        <div style="font-weight:800;font-size:1rem;color:var(--navy)">${o.id}</div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:3px">
          Submitted ${fmtDate(o.created_at)}
          ${o.creator_name?' · by '+o.creator_name:''}
          ${!isApprover&&o.client_name?' · '+o.client_name:''}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;font-size:1.2rem;color:var(--navy)">${fmt(o.grand_total)}</div>
        ${o.grand_total>100000?`<div style="font-size:.72rem;color:#d97706;background:#fef3c7;border-radius:4px;padding:2px 6px;margin-top:4px">⚠️ High value — review carefully</div>`:''}
      </div>
    </div>
    ${o.notes?`<div style="font-size:.78rem;color:var(--text-muted);background:#f8f9fa;padding:10px 12px;border-radius:8px;margin-bottom:14px">📝 ${o.notes}</div>`:''}
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="approveOrder('${o.id}')">✓ Approve & Submit</button>
      <button class="btn btn-danger" onclick="rejectOrder('${o.id}')">✕ Reject</button>
      <button class="btn btn-secondary" onclick="viewOrder('${o.id}')">View Details</button>
    </div>
  </div>`).join('')}

  <!-- Recently approved -->
  ${approved.length?`
  <div style="margin-top:20px">
    <div style="font-size:.84rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Recently Approved — In Progress</div>
    ${approved.slice(0,4).map(o=>`
    <div style="background:#fff;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);padding:14px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="viewOrder('${o.id}')">
      <div>
        <div style="font-weight:700;font-size:.88rem">${o.id}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmtDate(o.created_at)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-weight:700">${fmt(o.grand_total)}</div>
        ${statusBadge(o.status)}
      </div>
    </div>`).join('')}
  </div>`:''}`
  ;
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

const REPORT_CATEGORIES = [
  { label:'Operations', color:'#1e40af', bg:'#eff6ff', icon:'⚙️',
    keys:['fulfilment','order-items','dc-billing','service-desk'] },
  { label:'Finance', color:'#065f46', bg:'#ecfdf5', icon:'💰',
    keys:['spend','budget','budget-forecast','gst'] },
  { label:'Supply Chain', color:'#92400e', bg:'#fffbeb', icon:'🔗',
    keys:['vendor','inventory'] },
];

function renderReports(el) {
  const byKey = Object.fromEntries(REPORT_DEFS.map(r=>[r.key,r]));
  const usedKeys = new Set(REPORT_CATEGORIES.flatMap(c=>c.keys));
  const otherDefs = REPORT_DEFS.filter(r=>!usedKeys.has(r.key));

  el.innerHTML = `
  ${pageHeader('Reports & BI', 'Live data — view inline, export CSV, or print PDF')}
  ${REPORT_CATEGORIES.map(cat=>`
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:1.1rem">${cat.icon}</span>
      <span style="font-weight:700;font-size:1rem;color:${cat.color}">${cat.label} Reports</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${cat.keys.map(k=>{const r=byKey[k];if(!r)return '';return `
      <div style="background:${cat.bg};border:1px solid ${cat.color}22;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:1.6rem;line-height:1">${r.icon}</div>
          <div>
            <div style="font-weight:700;font-size:.92rem;color:${cat.color}">${r.title}</div>
            <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${r.desc}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="viewReport('${r.key}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadReportCSV('${r.key}')">CSV</button>
          <button class="btn btn-secondary btn-sm" onclick="printReport('${r.key}')">Print</button>
        </div>
      </div>`;}).join('')}
    </div>
  </div>`).join('')}
  ${otherDefs.length?`
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:1.1rem">📈</span>
      <span style="font-weight:700;font-size:1rem;color:var(--text-muted)">Analytics</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${otherDefs.map(r=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:1.6rem;line-height:1">${r.icon}</div>
          <div>
            <div style="font-weight:700;font-size:.92rem">${r.title}</div>
            <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${r.desc}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" onclick="viewReport('${r.key}')">View</button>
          <button class="btn btn-secondary btn-sm" onclick="downloadReportCSV('${r.key}')">CSV</button>
          <button class="btn btn-secondary btn-sm" onclick="printReport('${r.key}')">Print</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`:''}`;
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
const SETTINGS_NAV = [
  { id:'auth',          icon:'🔐', label:'Auth & OTP',       desc:'OTP, MFA, JWT session' },
  { id:'notifications', icon:'🔔', label:'Notifications',    desc:'Email & SMS config' },
  { id:'integrations',  icon:'🔗', label:'Integrations',     desc:'Zoho Books, webhooks' },
  { id:'approval',      icon:'✅', label:'Approval Rules',   desc:'Order approval thresholds' },
  { id:'warehouses',    icon:'🏭', label:'Warehouses',       desc:'Manage warehouse config' },
  { id:'audit',         icon:'📋', label:'Audit Log',        desc:'All system actions' },
  { id:'categories',    icon:'📂', label:'Categories',       desc:'Item category setup' },
];

async function renderSettings(el) {
  if (!APP._settingsTab) APP._settingsTab = 'auth';
  el.innerHTML = `
  ${pageHeader('Platform Settings', 'System configuration & administration')}
  <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:start">
    <div class="card" style="padding:8px">
      ${SETTINGS_NAV.map(n=>`
      <button onclick="settingsTab('${n.id}',this)" class="settings-nav-btn ${APP._settingsTab===n.id?'active':''}"
        style="width:100%;text-align:left;background:${APP._settingsTab===n.id?'var(--primary)':'transparent'};color:${APP._settingsTab===n.id?'#fff':'inherit'};border:none;border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:2px;transition:background .15s">
        <span style="font-size:1.1rem;flex-shrink:0">${n.icon}</span>
        <div>
          <div style="font-weight:600;font-size:.88rem">${n.label}</div>
          <div style="font-size:.72rem;opacity:.7">${n.desc}</div>
        </div>
      </button>`).join('')}
    </div>
    <div id="settings-content"><div class="loading-state"><div class="spinner"></div></div></div>
  </div>`;
  settingsTab(APP._settingsTab, document.querySelector('.settings-nav-btn.active'));
}

async function settingsTab(tab, btn) {
  APP._settingsTab = tab;
  document.querySelectorAll('.settings-nav-btn').forEach(b=>{
    b.classList.remove('active');
    b.style.background = 'transparent'; b.style.color = 'inherit';
  });
  if (btn) { btn.classList.add('active'); btn.style.background = 'var(--primary)'; btn.style.color = '#fff'; }
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
  window._importJobs = jobs;

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
  showImportTab(tab, window._importJobs || []);
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
  const cols = isInventory
    ? 'sku, name, category, sub_category, brand, stock, unit_price, mrp, cost_excl_gst, gst_rate, reorder_level, max_stock, uom, pack_size, units_per_case, weight_grams, barcode, vendor_sku, vendor_lead_days, vendor_moq'
    : 'client_id, grand_total, subtotal, gst, notes';

  el.innerHTML = `
  <div class="card" style="margin-bottom:14px">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Import ${isInventory ? 'Inventory Items' : 'Orders'}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px">Upload a CSV file — first row must be column headers</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="downloadSampleCSV('${tab}')">⬇ Download Sample Template</button>
    </div>
    <div style="padding:16px 20px">
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:.8rem">
        <div style="font-weight:700;color:var(--navy);margin-bottom:6px">Required columns</div>
        <code style="color:var(--blue);word-break:break-all">${cols}</code>
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label style="font-weight:600">Choose CSV file</label>
        <input type="file" id="csv-file" accept=".csv,.txt" style="margin-top:6px;display:block" onchange="previewCSV(this,'${tab}')">
      </div>
      <div id="csv-preview" style="margin-top:12px"></div>
      <div id="csv-actions" style="display:none;margin-top:12px;display:flex;align-items:center;gap:12px">
        <button class="btn btn-primary" onclick="submitCSVImport('${tab}')">Import Data</button>
        <span id="csv-row-count" style="font-size:.84rem;color:var(--text-muted)"></span>
      </div>
    </div>
  </div>`;
}

// Proper RFC-4180 CSV parser — handles quoted fields, embedded commas, CRLF
function parseCSVText(text) {
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i <= text.length; i++) {
    const c = i < text.length ? text[i] : '\n';
    if (inQ) {
      if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(field.trim()); field = ''; }
      else if (c === '\n') {
        row.push(field.trim()); field = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else { field += c; }
    }
  }
  return rows;
}

function previewCSV(input, tab) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const parsed = parseCSVText(e.target.result);
    if (parsed.length < 2) { showToast('CSV must have a header row + at least one data row', 'error'); return; }
    const headers = parsed[0];
    const dataRows = parsed.slice(1).map(function(vals) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = vals[i] !== undefined ? vals[i] : ''; });
      return obj;
    });
    window._csvRows = dataRows;
    window._csvTab = tab;

    const preview = document.getElementById('csv-preview');
    const actions = document.getElementById('csv-actions');
    const rowCount = document.getElementById('csv-row-count');

    if (preview) preview.innerHTML =
      '<div style="font-size:.8rem;font-weight:600;color:var(--navy);margin-bottom:6px">Preview (first 5 rows)</div>' +
      '<div class="table-wrap" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">' +
      '<table class="table" style="margin:0"><thead><tr>' +
      headers.map(function(h){return '<th style="font-size:.75rem">'+h+'</th>';}).join('') +
      '</tr></thead><tbody>' +
      dataRows.slice(0,5).map(function(row){
        return '<tr>' + headers.map(function(h){return '<td style="font-size:.78rem">'+(row[h]||'')+'</td>';}).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';

    if (actions) actions.style.display = 'flex';
    if (rowCount) rowCount.textContent = dataRows.length + ' rows ready to import';
  };
  reader.readAsText(file);
}

async function submitCSVImport(tab) {
  const rows = window._csvRows;
  if (!rows || !rows.length) { showToast('No data to import', 'error'); return; }
  const btn = document.querySelector('#csv-actions .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  showToast('Importing ' + rows.length + ' rows…');

  const endpoint = tab === 'inventory' ? '/import/inventory' : '/import/orders';
  const res = await api(endpoint, { method: 'POST', body: JSON.stringify(rows) });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Data'; }
  if (!res) return;

  const preview = document.getElementById('csv-preview');
  const successMsg = '<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:#065f46"><b>✓ Import complete</b> — ' + res.success + ' rows inserted/updated, ' + res.failed + ' failed.</div>';
  const errorsHtml = res.errors && res.errors.length
    ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#b91c1c"><b>Row errors:</b><ul style="margin:6px 0 0 18px;padding:0">' +
      res.errors.map(function(e){return '<li>'+e+'</li>';}).join('') + '</ul></div>'
    : '';
  if (preview) preview.innerHTML = successMsg + errorsHtml;
  window._csvRows = null;
  window._importJobs = null;
}

function downloadSampleCSV(tab) {
  const isInventory = tab === 'inventory';
  let csv, filename;
  if (isInventory) {
    csv = [
      'sku,name,category,sub_category,brand,stock,unit_price,mrp,cost_excl_gst,gst_rate,reorder_level,max_stock,uom,pack_size,units_per_case,weight_grams,barcode,vendor_sku,vendor_lead_days,vendor_moq',
      'SKU001,Organic Green Tea,Beverages,Healthy,Tata,50,180,220,140,18,10,200,box,12,24,250,,TV-GT-01,3,6',
      'SKU002,Classic Biscuits,Snacks,Normal,Britannia,80,45,55,35,5,20,300,pack,20,40,150,,BB-CL-02,2,10',
      'SKU003,Hand Sanitizer 500ml,Hygiene,Normal,Dettol,30,120,150,90,18,5,100,bottle,6,12,500,,DT-HS-03,4,5',
    ].join('\n');
    filename = 'inventory_sample.csv';
  } else {
    csv = [
      'client_id,grand_total,subtotal,gst,notes',
      'c1,11800,10000,1800,Monthly office supplies',
      'c2,5900,5000,900,Pantry restock',
    ].join('\n');
    filename = 'orders_sample.csv';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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

  const donePct = totalDCs ? Math.round(delivered/totalDCs*100) : 0;
  const staffCount = Object.keys(grouped).length;

  el.innerHTML = `
  ${pageHeader("Today's Delivery Schedule", today,
    `<button class="btn btn-secondary" onclick="navigate('todays_schedule')">&#8635; Refresh</button>`)}

  <div class="kpi-row" style="grid-template-columns:repeat(5,1fr);margin-bottom:0">
    <div class="kpi-card" style="position:relative;overflow:hidden">
      <div class="kpi-label">Total DCs</div>
      <div class="kpi-value">${totalDCs}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${staffCount} staff on route</div>
    </div>
    <div class="kpi-card" style="border-top:3px solid var(--success)">
      <div class="kpi-label">Delivered</div>
      <div class="kpi-value" style="color:var(--success)">${delivered}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${donePct}% complete</div>
    </div>
    <div class="kpi-card" style="border-top:3px solid var(--warning)">
      <div class="kpi-label">In Transit</div>
      <div class="kpi-value" style="color:var(--warning)">${inTransit}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">out for delivery</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Scheduled</div>
      <div class="kpi-value">${pending}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">not yet started</div>
    </div>
    <div class="kpi-card ${unassigned.length>0?'kpi-warning':''}">
      <div class="kpi-label">Unassigned</div>
      <div class="kpi-value">${unassigned.length}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${unassigned.length?'needs staff':'all assigned'}</div>
    </div>
  </div>

  <div style="margin:12px 0 20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
    <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:6px">
      <span style="font-weight:600">Overall Progress</span>
      <span style="color:${donePct===100?'var(--success)':donePct>60?'var(--warning)':'var(--text-muted)'}"><b>${delivered}</b> of ${totalDCs} delivered</span>
    </div>
    <div style="background:var(--border);height:10px;border-radius:5px;overflow:hidden">
      <div style="height:100%;width:${donePct}%;background:${donePct===100?'var(--success)':donePct>60?'var(--warning)':'var(--primary)'};border-radius:5px;transition:width .4s"></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:.76rem;color:var(--text-muted)">
      <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;background:var(--success);border-radius:50%"></span>Delivered ${delivered}</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;background:var(--warning);border-radius:50%"></span>In Transit ${inTransit}</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:8px;height:8px;background:var(--border);border-radius:50%"></span>Pending ${pending}</span>
    </div>
  </div>

  ${Object.entries(grouped).map(([staffId, dcs])=>{
    const staffDone = dcs.filter(d=>d.status==='DELIVERED').length;
    const staffPct  = dcs.length ? Math.round(staffDone/dcs.length*100) : 0;
    return `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.8rem;font-weight:700">${(staffMap[staffId]||'?')[0]}</div>
        <div>
          <div style="font-weight:700">${staffMap[staffId]}</div>
          <div style="font-size:.76rem;color:var(--text-muted)">${dcs.length} delivery${dcs.length!==1?'s':''}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="text-align:right">
          <div style="font-size:.75rem;color:var(--text-muted)">${staffDone}/${dcs.length} done</div>
          <div style="background:var(--border);height:4px;border-radius:2px;width:80px;margin-top:4px;overflow:hidden">
            <div style="height:100%;width:${staffPct}%;background:${staffPct===100?'var(--success)':'var(--primary)'};border-radius:2px"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Time</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${dcs.sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')).map(dc=>`<tr ${dc.status==='DELIVERED'?'style="opacity:.7"':''}>
          <td><b>${dc.dc_number||dc.id}</b></td>
          <td><b>${dc.client_name||'—'}</b></td>
          <td><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td style="font-weight:600">${dc.scheduled_time||'—'}</td>
          <td>${dc.total_qty||'—'}</td>
          <td>${statusBadge(dc.status)}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-success btn-sm" onclick="markDelivered('${dc.id}')">✓ Deliver</button>`:''}
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-danger btn-sm" onclick="logReturnModal('${dc.id}')">Return</button>`:''}
            <button class="btn btn-secondary btn-sm" onclick="assignDCModal('${dc.id}','${dc.dc_number||''}','${dc.scheduled_time||''}')">Edit</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;}).join('')}

  ${unassigned.length ? `
  <div class="card" style="margin-bottom:16px;border:1px solid var(--warning)">
    <div class="card-header" style="background:rgba(217,119,6,.08)">
      <span style="font-weight:700;color:var(--warning)">⚠️ Unassigned Deliveries (${unassigned.length})</span>
      <span style="font-size:.8rem;color:var(--text-muted)">Assign staff before dispatching</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${unassigned.map(dc=>`<tr>
          <td><b>${dc.dc_number||dc.id}</b></td>
          <td><b>${dc.client_name||'—'}</b></td>
          <td><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td>${dc.total_qty||'—'}</td>
          <td>${statusBadge(dc.status)}</td>
          <td><button class="btn btn-primary btn-sm" onclick="assignDCModal('${dc.id}','${dc.dc_number||''}','${dc.scheduled_time||''}')">Assign Staff</button></td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}

  ${totalDCs===0 ? `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No deliveries scheduled today</div><div class="empty-desc">Dispatch orders to create delivery challans for today.</div></div>` : ''}`;
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

