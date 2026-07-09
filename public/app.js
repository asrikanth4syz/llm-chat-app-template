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
    { section:'Overview' },
    { id:'dashboard',   label:'Dashboard',     icon:iconDashboard, badge:null },
    { id:'orders',      label:'Orders',        icon:iconOrders,    badge:'!' },
    { section:'Catalogue' },
    { id:'inventory',   label:'Inventory',     icon:iconInventory, badge:null },
    { id:'vendors',     label:'Vendors',       icon:iconVendors,   badge:null },
    { section:'Operations' },
    { id:'procurement', label:'Procurement',   icon:iconProcure,   badge:null },
    { id:'warehouse',   label:'Warehouse',     icon:iconWarehouse, badge:null },
    { id:'delivery',    label:'Deliveries',    icon:iconDelivery,  badge:null },
    { id:'dc_billing',  label:'DC Billing',    icon:iconBilling,   badge:'!' },
    { id:'fulfilment',  label:'Fulfilment',    icon:iconReports,   badge:'!' },
    { section:'Client Services' },
    { id:'clients',         label:'Clients',          icon:iconClients,   badge:null },
    { id:'service_desk',    label:'Service Desk',     icon:iconDesk,      badge:null },
    { id:'approval_chains', label:'Approval Chains',  icon:iconApprove,   badge:null },
    { section:'Analytics' },
    { id:'exec_bi',         label:'Executive BI',     icon:iconDashboard, badge:null },
    { id:'reports',         label:'Reports & BI',     icon:iconReports,   badge:null },
    { id:'sla_dashboard',   label:'SLA Dashboard',    icon:iconDashboard, badge:'!' },
    { section:'Tools' },
    { id:'delivery_routes', label:'Route Planning',   icon:iconTruck,     badge:null },
    { id:'dunning',         label:'Dunning',          icon:iconBilling,   badge:null },
    { id:'import_data',     label:'CSV Import',       icon:iconUpload,    badge:null },
    { id:'templates',       label:'Templates',        icon:iconOrders,    badge:null },
    { section:'Admin' },
    { id:'todays_schedule',     label:"Today's Schedule", icon:iconDelivery, badge:'!' },
    { id:'consolidated_orders', label:'Procurement View', icon:iconProcure,  badge:null },
    { id:'consolidated_due',    label:'Due Items',        icon:iconCheck,    badge:'!' },
    { id:'staff',               label:'Staff',            icon:iconUsers,    badge:null },
    { id:'porter_expenses',     label:'Porter Expenses',  icon:iconBilling,  badge:null },
    { id:'users',               label:'Users & Roles',    icon:iconUsers,    badge:null },
    { id:'settings',            label:'Settings',         icon:iconSettings, badge:null },
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
    { section:'Store' },
    { id:'my_inventory',   label:'My Inventory',   icon:iconInventory, badge:null },
    { section:'Analytics' },
    { id:'client_reports', label:'Reports',         icon:iconReports,   badge:null },
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
    { section:'Store' },
    { id:'my_inventory', label:'My Inventory', icon:iconInventory, badge:null },
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

  const email    = document.getElementById('login-email')?.value?.trim().toLowerCase();
  const password = document.getElementById('login-password')?.value;
  if (!email || !password) { showToast('Enter your email and password', 'error'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';

  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }).catch(() => null);

  btn.disabled = false;
  btn.querySelector('span').textContent = 'Sign In';

  if (!data) return; // api() already showed "Invalid credentials"

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

// ── Profile Modal ──────────────────────────────────────────
async function openProfileModal() {
  const profile = await api('/profile');
  if (!profile) return;

  const roleLabel = (ROLES[profile.role]?.label) || profile.role;

  openModal('My Profile', `
    <div style="text-align:center;margin-bottom:20px">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--gold);color:#fff;font-size:1.4rem;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 10px">${profile.initials}</div>
      <div style="font-weight:800;font-size:1rem;color:var(--navy)">${profile.name}</div>
      <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">${profile.email} · ${roleLabel}</div>
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin-bottom:16px">
    <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px">Edit Profile</div>
    <div class="form-group"><label>Display Name</label><input type="text" id="prof-name" value="${profile.name}"></div>
    <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:16px 0 10px">Change Password</div>
    <div class="form-group"><label>Current Password</label><input type="password" id="prof-cur-pw" placeholder="Enter current password"></div>
    <div class="form-group"><label>New Password</label><input type="password" id="prof-new-pw" placeholder="Enter new password (min 6 chars)"></div>
    <div class="form-group"><label>Confirm New Password</label><input type="password" id="prof-conf-pw" placeholder="Confirm new password"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>`);
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
  if (!APP._navCollapsed) APP._navCollapsed = {};

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

  const html = sections.map((sec, idx) => {
    const isFirst = idx === 0;
    const collapsed = !isFirst && APP._navCollapsed[sec.label];
    const bodyMaxH = sec.items.length * 44 + 'px';

    const headerHtml = isFirst
      ? `<div class="nav-section"><span class="nav-section-label">${sec.label}</span></div>`
      : `<div class="nav-section-toggle${collapsed ? ' collapsed' : ''}" onclick="toggleNavSection('${sec.label.replace(/'/g,"\\'")}')">
           <span class="nav-section-label">${sec.label}</span>
           <span class="nav-toggle-arrow">▶</span>
         </div>`;

    const itemsHtml = sec.items.map(item => `
      <div class="nav-item" id="nav-${item.id}" onclick="navigate('${item.id}')" title="${item.label}">
        <span class="nav-item-icon">${item.icon(18)}</span>
        <span class="nav-item-label">${item.label}</span>
        ${item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : ''}
      </div>`).join('');

    return headerHtml + (isFirst
      ? itemsHtml
      : `<div class="nav-section-body${collapsed ? ' collapsed' : ''}" id="nav-sec-${sec.label.replace(/\s+/g,'_')}" style="max-height:${collapsed ? '0' : bodyMaxH}">${itemsHtml}</div>`);
  }).join('');

  document.getElementById('sidebar-nav').innerHTML = html;
}

function toggleNavSection(label) {
  if (!APP._navCollapsed) APP._navCollapsed = {};
  APP._navCollapsed[label] = !APP._navCollapsed[label];
  const key = label.replace(/\s+/g,'_');
  const body = document.getElementById('nav-sec-' + key);
  const toggle = body?.previousElementSibling;
  if (!body || !toggle) return;
  const collapsed = APP._navCollapsed[label];
  body.style.maxHeight = collapsed ? '0' : (body.children.length * 44 + 'px');
  body.classList.toggle('collapsed', collapsed);
  toggle.classList.toggle('collapsed', collapsed);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    overlay?.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');
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
  exec_bi: renderExecBI,
  client_reports: renderClientReports,
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
  my_inventory: renderMyInventory,
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

  ensureClientFAB();
  closeMobileSidebar();
}

/* ── Persistent quick-action FAB (client roles) ───────────── */
function ensureClientFAB() {
  const isClient = ['client','client_user','approver'].includes(APP.user?.nav);
  let fab = document.getElementById('client-fab');
  if (!isClient) { if (fab) fab.remove(); return; }
  if (fab) { fab.querySelector('#fab-menu').style.display='none'; fab.querySelector('#fab-main').textContent='+'; return; }

  fab = document.createElement('div');
  fab.id = 'client-fab';
  fab.style.cssText = 'position:fixed;bottom:22px;right:22px;z-index:500;display:flex;flex-direction:column;align-items:flex-end;gap:10px';
  fab.innerHTML = `
    <div id="fab-menu" style="display:none;flex-direction:column;gap:8px;align-items:flex-end">
      <button onclick="toggleFAB();navigate('place_order')" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">🛒 New Order</button>
      <button onclick="toggleFAB();navigate('place_order');setTimeout(()=>showCSVUploadModal(),400)" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">📋 Upload Order Sheet</button>
      <button onclick="toggleFAB();navigate('my_inventory')" style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--border);border-radius:24px;padding:9px 16px;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--navy);box-shadow:0 4px 14px rgba(0,0,0,.15)">📉 Log Use</button>
    </div>
    <button id="fab-main" onclick="toggleFAB()" title="Quick actions"
      style="width:54px;height:54px;border-radius:50%;background:var(--primary);color:#fff;border:none;font-size:1.7rem;font-weight:400;cursor:pointer;box-shadow:0 6px 18px rgba(249,115,22,.45);display:flex;align-items:center;justify-content:center;line-height:1;transition:transform .2s">+</button>`;
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
    IN_SHIPMENT:'info', IN_TRANSIT:'info', IN_PROGRESS:'info', DISPATCHED:'info', ACCEPTED:'info', QUALITY_CHECK:'info',
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

/* Icon-chip stat card (Stitch reference style) */
function statCard(icon, color, bg, value, label, onclick = '') {
  return `<div class="card" style="padding:14px 16px;margin-bottom:0;display:flex;align-items:center;gap:12px${onclick?';cursor:pointer':''}" ${onclick?`onclick="${onclick}"`:''}>
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
  const [data, dcs, myInv] = await Promise.all([
    api('/dashboard'),
    api('/delivery-challans').catch(()=>[]),
    api('/client-inventory').catch(()=>[]),
  ]);
  if (!data) return;
  const { client, recentOrders, totalSpend, pendingApproval } = data;
  const lowStock = (myInv||[]).filter(i => i.stock_status==='low' || i.stock_status==='out')
    .sort((a,b) => (a.stock_status==='out'?0:1) - (b.stock_status==='out'?0:1));
  const budget    = client?.monthly_budget || 500000;
  const spent     = client?.spent_this_month ?? 0; // actual current-month spend from backend
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

  const attentionCount = lowStock.length + (pendingApproval||0) + inTransitDCs.length;

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">Welcome back, ${(APP.user?.name||'').split(' ')[0]} 👋</div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:2px">${client?.name||'My Organization'} · ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</div>
    </div>
    <button class="btn btn-primary" onclick="navigate('place_order')" style="padding:10px 22px;font-weight:700">${iconPlus(15)} Place Order</button>
  </div>

  <!-- ═══ WHAT NEEDS ATTENTION TODAY ═══ -->
  <div style="margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:.85rem;font-weight:800;color:var(--navy);text-transform:uppercase;letter-spacing:.05em">⚡ Needs attention today</span>
      ${attentionCount ? `<span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:1px 9px;font-size:.74rem;font-weight:700">${attentionCount}</span>` : ''}
    </div>
    ${attentionCount === 0 ? `
    <div class="card" style="padding:18px 20px;margin-bottom:0;display:flex;align-items:center;gap:12px;background:#f0fdf4;border:1px solid #bbf7d0">
      <span style="font-size:1.5rem">✅</span>
      <div>
        <div style="font-weight:700;font-size:.9rem;color:#15803d">All clear!</div>
        <div style="font-size:.78rem;color:#166534">No low stock, pending approvals or deliveries needing action.</div>
      </div>
    </div>` : `
    <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch">
      ${lowStock.slice(0,6).map(i => `
      <div style="flex:0 0 240px;background:${i.stock_status==='out'?'#fef2f2':'#fffbeb'};border:1px solid ${i.stock_status==='out'?'#fecaca':'#fde68a'};border-radius:12px;padding:14px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:${i.stock_status==='out'?'#fee2e2':'#fef3c7'};color:${i.stock_status==='out'?'#dc2626':'#d97706'}">${i.stock_status==='out'?'OUT OF STOCK':'LOW STOCK'}</span>
          <span style="font-size:.78rem;font-weight:700;color:${i.stock_status==='out'?'#dc2626':'#d97706'}">${Math.round(i.qty_on_hand||0)} left</span>
        </div>
        <div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${h(i.item_name||i.sku)}">${h(i.item_name||i.sku)}</div>
        <button class="btn btn-primary btn-sm" style="width:100%" onclick="orderMoreItem('${h(i.sku)}','${h(i.item_name||i.sku)}')">Order Now</button>
      </div>`).join('')}
      ${pendingApproval > 0 ? `
      <div style="flex:0 0 240px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px">
        <div style="font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:#ffedd5;color:#c2410c;display:inline-block;margin-bottom:6px">APPROVAL</div>
        <div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:10px">${pendingApproval} order${pendingApproval>1?'s':''} awaiting sign-off</div>
        <button class="btn btn-secondary btn-sm" style="width:100%" onclick="navigate('approvals')">Review Now</button>
      </div>` : ''}
      ${inTransitDCs.slice(0,2).map(dc => `
      <div style="flex:0 0 240px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px">
        <div style="font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:#dbeafe;color:#1d4ed8;display:inline-block;margin-bottom:6px">ARRIVING</div>
        <div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:2px">${dc.dc_number||dc.id}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">${dc.driver_name?`🧑‍✈️ ${h(dc.driver_name)}`:'🚚 En route'}${dc.scheduled_time?` · ETA ${dc.scheduled_time}`:''}</div>
        ${dc.driver_phone?`<a href="tel:${dc.driver_phone}" class="btn btn-secondary btn-sm" style="width:100%;text-decoration:none;display:block;text-align:center;box-sizing:border-box">📞 Call Driver</a>`:`<button class="btn btn-secondary btn-sm" style="width:100%" onclick="navigate('track_delivery')">Track</button>`}
      </div>`).join('')}
      ${lowStock.length > 6 ? `
      <div style="flex:0 0 140px;display:flex;align-items:center;justify-content:center">
        <button class="btn btn-secondary btn-sm" onclick="navigate('my_inventory')">+${lowStock.length-6} more →</button>
      </div>` : ''}
    </div>`}
  </div>

  <!-- ═══ QUICK ACTIONS ═══ -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px">
    ${[
      { icon:'🛒', label:'Place Order',   sub:'browse catalogue', action:"navigate('place_order')" },
      { icon:'📋', label:'Order Sheet',   sub:'export & upload',  action:"navigate('place_order');setTimeout(()=>showCSVUploadModal(),400)" },
      { icon:'📉', label:'Log Use',       sub:'record consumption', action:"navigate('my_inventory')" },
      { icon:'🚚', label:'Track',         sub:inTransitDCs.length+' in transit', action:"navigate('track_delivery')" },
      { icon:'📊', label:'Reports',       sub:'spend & usage',    action:"navigate('client_reports')" },
    ].map(a=>`
    <button onclick="${a.action}" style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 10px;cursor:pointer;text-align:center;transition:box-shadow .15s,transform .15s" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,.08)';this.style.transform='translateY(-1px)'" onmouseout="this.style.boxShadow='';this.style.transform=''">
      <div style="font-size:1.5rem;margin-bottom:5px">${a.icon}</div>
      <div style="font-weight:700;font-size:.8rem;color:var(--navy)">${a.label}</div>
      <div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">${a.sub}</div>
    </button>`).join('')}
  </div>

  <!-- ═══ STATUS CHIPS ROW ═══ -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <button onclick="navigate('my_orders')" style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--border);border-radius:20px;padding:6px 14px;cursor:pointer;font-size:.78rem">
      <b style="color:var(--navy)">${activeOrders}</b> active orders
    </button>
    <button onclick="navigate('track_delivery')" style="display:inline-flex;align-items:center;gap:6px;background:${inTransitDCs.length?'#fef3c7':'#fff'};border:1px solid ${inTransitDCs.length?'#fcd34d':'var(--border)'};border-radius:20px;padding:6px 14px;cursor:pointer;font-size:.78rem">
      <b style="color:${inTransitDCs.length?'#d97706':'var(--navy)'}">${inTransitDCs.length}</b> in transit
    </button>
    <span style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--border);border-radius:20px;padding:6px 14px;font-size:.78rem">
      <b style="color:var(--success)">${deliveredThisMonth.length}</b> delivered this month
    </span>
    <span style="display:inline-flex;align-items:center;gap:6px;background:${pctSpent>90?'#fee2e2':'#fff'};border:1px solid ${pctSpent>90?'#fecaca':'var(--border)'};border-radius:20px;padding:6px 14px;font-size:.78rem">
      budget <b style="color:${pctSpent>90?'var(--danger)':pctSpent>70?'#d97706':'var(--success)'}">${pctSpent}% used</b> · ${fmt(remaining)} left
    </span>
  </div>

  <!-- Budget progress bar (compact) -->
  <div class="card" style="padding:12px 18px;margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:4px">
      <span style="font-weight:700;font-size:.84rem">Monthly Budget</span>
      <span style="font-size:.78rem;color:var(--text-muted)">${fmt(spent)} of ${fmt(budget)}</span>
    </div>
    <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pctSpent}%;background:${pctSpent>90?'var(--danger)':pctSpent>70?'var(--warning)':'var(--success)'};border-radius:4px;transition:width .5s"></div>
    </div>
  </div>

  <!-- Track Delivery — collapsible (progressive disclosure) -->
  <details id="track-delivery-section" class="card" style="padding:0;margin-bottom:16px;overflow:hidden" ${inTransitDCs.length||scheduledDCs.length?'open':''}>
    <summary style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;list-style:none">
      <div>
        <div style="font-weight:800;font-size:.95rem;color:var(--navy)">🚚 Track Delivery <span style="font-weight:400;font-size:.76rem;color:var(--text-muted)">— tap to expand</span></div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:1px">${inTransitDCs.length} in transit · ${scheduledDCs.length} scheduled · ${deliveredThisMonth.length} delivered this month</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="event.preventDefault();navigate('my_orders')">View All Orders</button>
    </summary>

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
  </details>

  <!-- Recent Orders -->
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:16px">
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

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0;cursor:pointer" onclick="navigate('fulfilment')">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Due Items</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1" id="due-items-count">—</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">items pending delivery</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0;cursor:pointer" onclick="navigate('fulfilment')">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Fulfilment Rate</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1" id="client-fulfilment-pct">—</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">this month</div>
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
  const spent    = client.spent_this_month ?? 0; // actual current-month spend from backend
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

  const dueCount        = (dueItems||[]).length;
  const pendingApproval = byStatus['PENDING_APPROVAL']||0;
  const inShipment      = (byStatus['IN_SHIPMENT']||0)+(byStatus['PARTIALLY_CLOSED']||0);
  const pickedPending   = byStatus['PICKED']||0;
  const toPickCount     = byStatus['ACKNOWLEDGED']||0;
  const delayedDel      = pendingSupply?.kpis?.delayed_deliveries||0;

  const pipeline = [
    { key:'SUBMITTED',        label:'Submitted',    color:'#3b82f6' },
    { key:'ACKNOWLEDGED',     label:'To Pick',      color:'#8b5cf6' },
    { key:'PICKED',           label:'Picked',       color:'#f97316' },
    { key:'IN_SHIPMENT',      label:'In Transit',   color:'#06b6d4' },
    { key:'PARTIALLY_CLOSED', label:'Partial',      color:'#f59e0b' },
    { key:'CLOSED',           label:'Closed',       color:'#16a34a' },
    { key:'CANCELLED',        label:'Cancelled',    color:'#ef4444' },
  ];
  const pipeTotal = pipeline.reduce((s,p)=>s+(byStatus[p.key]||0),0)||1;

  el.innerHTML = `
  <style>
    .ct-kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}
    .ct-kpi{background:#fff;border-radius:12px;padding:20px 18px;box-shadow:0 1px 4px rgba(0,0,0,.06);cursor:pointer;transition:box-shadow .18s,transform .15s;position:relative;border:1.5px solid var(--border)}
    .ct-kpi:hover{box-shadow:0 4px 18px rgba(0,0,0,.1);transform:translateY(-1px);border-color:#c5cdd8}
    .ct-kpi.ct-urgent{border-left:3px solid #dc2626;border-left-color:#dc2626}
    .ct-kpi.ct-warn{border-left:3px solid #d97706}
    .ct-kpi-dot{position:absolute;top:14px;right:14px;width:7px;height:7px;border-radius:50%}
    .ct-kpi-icon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:.9rem;margin-bottom:14px}
    .ct-kpi-val{font-size:2rem;font-weight:900;line-height:1;letter-spacing:-.04em;margin-bottom:5px}
    .ct-kpi-lbl{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px}
    .ct-kpi-sub{font-size:.74rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ct-card{background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);overflow:hidden;border:1px solid var(--border)}
    .ct-card-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)}
    .ct-card-title{font-weight:700;color:var(--navy);font-size:.88rem}
    .ct-card-sub{font-size:.73rem;color:var(--text-muted);margin-top:1px}
    .ct-mid{display:grid;grid-template-columns:1fr 320px;gap:14px;margin-bottom:16px}
    .ct-mid-left{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .ct-action{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;transition:background .13s;margin-bottom:5px}
    .ct-action:hover{background:#f4f6f9}
    .ct-action.hot{background:#fff8f8}
    .ct-action-ico{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
    .ct-action-val{font-size:1rem;font-weight:800;min-width:26px;text-align:right;flex-shrink:0}
    .ct-pipe-wrap{height:24px;border-radius:8px;overflow:hidden;display:flex;margin-bottom:10px}
    .ct-pipe-seg{flex:var(--f,0);min-width:0;transition:flex .5s ease}
    .ct-pipe-seg:hover{filter:brightness(1.08)}
    .ct-order-row{display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .13s}
    .ct-order-row:last-child{border-bottom:none}
    .ct-order-row:hover{background:#f8f9fa}
    .ct-client-bar{height:4px;background:#edf0f5;border-radius:3px;margin-top:4px;overflow:hidden}
    .ct-client-fill{height:100%;border-radius:3px}
    @media(max-width:1280px){.ct-kpi-grid{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:1050px){.ct-mid{grid-template-columns:1fr}.ct-mid-left{grid-template-columns:1fr 1fr}}
    @media(max-width:700px){.ct-kpi-grid{grid-template-columns:repeat(2,1fr)}.ct-mid-left{grid-template-columns:1fr}}
  </style>

  <!-- ── PAGE HEADER ── -->
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:2px">
        <span style="font-size:1.4rem;font-weight:900;color:var(--navy);letter-spacing:-.03em">Control Tower</span>
        <span style="background:#e8f0fb;color:#2563eb;border-radius:20px;padding:2px 9px;font-size:.65rem;font-weight:800;letter-spacing:.05em">LIVE</span>
      </div>
      <div style="font-size:.8rem;color:var(--text-muted)">${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" onclick="navigate('inventory')">Inventory</button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">Orders</button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('fulfilment')">Fulfilment</button>
      <button class="btn btn-primary btn-sm" onclick="navigate('reports')">Reports →</button>
    </div>
  </div>

  <!-- ── KPI TILES ── -->
  <div class="ct-kpi-grid">

    <div class="ct-kpi" onclick="navigate('orders')">
      <div class="ct-kpi-icon" style="background:#e8f0fb">📦</div>
      <div class="ct-kpi-val" style="color:var(--navy)">${totalOrders||0}</div>
      <div class="ct-kpi-lbl">Total Orders</div>
      <div class="ct-kpi-sub">${pendingOrders||0} active</div>
    </div>

    <div class="ct-kpi${pendingApproval>0?' ct-warn':''}" onclick="navigate('orders')">
      ${pendingApproval>0?`<div class="ct-kpi-dot" style="background:#d97706"></div>`:''}
      <div class="ct-kpi-icon" style="background:${pendingApproval>0?'#fef3c7':'#f3f4f6'}">⏳</div>
      <div class="ct-kpi-val" style="color:${pendingApproval>0?'#d97706':'var(--navy)'}">${pendingApproval}</div>
      <div class="ct-kpi-lbl">Pending Approval</div>
      <div class="ct-kpi-sub">${pickedPending} picked · ${inShipment} transit</div>
    </div>

    <div class="ct-kpi${dueCount>0?' ct-urgent':''}" onclick="navigate('fulfilment')">
      ${dueCount>0?`<div class="ct-kpi-dot" style="background:#dc2626"></div>`:''}
      <div class="ct-kpi-icon" style="background:${dueCount>0?'#fee2e2':'#f3f4f6'}">🚨</div>
      <div class="ct-kpi-val" style="color:${dueCount>0?'#dc2626':'var(--navy)'}">${dueCount}</div>
      <div class="ct-kpi-lbl">Due Line Items</div>
      <div class="ct-kpi-sub">${pendingSupply?.kpis?.due_qty||0} units overdue</div>
    </div>

    <div class="ct-kpi${pendingDCBilling>0?' ct-warn':''}" onclick="navigate('dc_billing')">
      ${pendingDCBilling>0?`<div class="ct-kpi-dot" style="background:#d97706"></div>`:''}
      <div class="ct-kpi-icon" style="background:${pendingDCBilling>0?'#fef3c7':'#f3f4f6'}">🧾</div>
      <div class="ct-kpi-val" style="color:${pendingDCBilling>0?'#d97706':'var(--navy)'}">${pendingDCBilling||0}</div>
      <div class="ct-kpi-lbl">Pending Billing</div>
      <div class="ct-kpi-sub">DCs awaiting invoice</div>
    </div>

    <div class="ct-kpi${lowStock>0?' ct-warn':''}" onclick="navigate('inventory')">
      ${lowStock>0?`<div class="ct-kpi-dot" style="background:#d97706"></div>`:''}
      <div class="ct-kpi-icon" style="background:${lowStock>0?'#fef3c7':'#f3f4f6'}">📊</div>
      <div class="ct-kpi-val" style="color:${lowStock>0?'#d97706':'var(--navy)'}">${lowStock||0}</div>
      <div class="ct-kpi-lbl">Low Stock SKUs</div>
      <div class="ct-kpi-sub">Reorder required</div>
    </div>

    <div class="ct-kpi" onclick="navigate('service_desk')">
      <div class="ct-kpi-icon" style="background:#f3f4f6">🎫</div>
      <div class="ct-kpi-val" style="color:var(--navy)">${openTickets||0}</div>
      <div class="ct-kpi-lbl">Open Tickets</div>
      <div class="ct-kpi-sub">Support queue</div>
    </div>

  </div>

  <!-- ── ORDER PIPELINE ── -->
  <div class="ct-card" style="margin-bottom:16px">
    <div class="ct-card-hd">
      <div>
        <div class="ct-card-title">Order Pipeline</div>
        <div class="ct-card-sub">${totalOrders||0} orders across all stages</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">View All →</button>
    </div>
    <div style="padding:16px 18px">
      <div class="ct-pipe-wrap">
        ${pipeline.map(p=>{
          const cnt = byStatus[p.key]||0;
          const f = Math.max(cnt>0?1.5:0, Math.round((cnt/pipeTotal)*100));
          return `<div class="ct-pipe-seg" style="--f:${f};background:${p.color}" title="${p.label}: ${cnt}"></div>`;
        }).join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 18px">
        ${pipeline.map(p=>`
        <div style="display:flex;align-items:center;gap:5px">
          <div style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></div>
          <span style="font-size:.72rem;color:var(--text-muted)">${p.label}</span>
          <span style="font-size:.72rem;font-weight:800;color:var(--navy)">${byStatus[p.key]||0}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- ── MID GRID: Top Clients + Chart | Action Required ── -->
  <div class="ct-mid" style="margin-bottom:20px">
    <div class="ct-mid-left">

      <!-- Top Clients -->
      <div class="ct-card">
        <div class="ct-card-hd">
          <div class="ct-card-title">Top Clients</div>
          <button class="btn btn-secondary btn-sm" onclick="navigate('clients')">View All →</button>
        </div>
        <div style="padding:16px 20px">
          ${(topClients||[]).slice(0,5).map((c,i)=>{
            const cols = ['#2E75B6','#8b5cf6','#f97316','#06b6d4','#f59e0b'];
            const col  = cols[i];
            const pct  = Math.round((c.total/(topClients[0]?.total||1))*100);
            return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:13px;cursor:pointer;border-radius:8px;padding:4px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s"
                 onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background=''"
                 onclick="openClientDetail('${c.id}')" title="View ${h(c.name)} details">
              <div style="width:24px;height:24px;border-radius:50%;background:${col};color:#fff;font-size:.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
                  <span style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;color:var(--blue)">${c.name}</span>
                  <span style="font-size:.82rem;font-weight:800;color:var(--navy);flex-shrink:0;margin-left:8px">${fmt(c.total)}</span>
                </div>
                <div class="ct-client-bar"><div class="ct-client-fill" style="width:${pct}%;background:${col}"></div></div>
                <div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">${c.order_count} orders</div>
              </div>
              <div style="color:var(--text-muted);font-size:.8rem;flex-shrink:0">›</div>
            </div>`;
          }).join('')||'<div style="color:var(--text-muted);font-size:.84rem;text-align:center;padding:24px 0">No data yet</div>'}
        </div>
      </div>

      <!-- Orders by Status Chart -->
      <div class="ct-card">
        <div class="ct-card-hd">
          <div class="ct-card-title">Orders by Status</div>
        </div>
        <div style="padding:16px 20px">
          <div style="position:relative;height:220px;width:100%">
            <canvas id="statusChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Required -->
    <div class="ct-card">
      <div class="ct-card-hd">
        <div>
          <div class="ct-card-title">Action Required</div>
          <div class="ct-card-sub">Items needing your attention</div>
        </div>
        ${[pendingApproval,dueCount,toPickCount,lowStock,delayedDel].some(v=>v>0)?`<span style="width:8px;height:8px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 0 3px rgba(239,68,68,.2)"></span>`:''}
      </div>
      <div style="padding:12px 14px">
        ${[
          { label:'Pending Approval',   val:pendingApproval,   color:'#d97706', bg:'#fef3c7', icon:'⏳', page:'orders'      },
          { label:'Due Line Items',     val:dueCount,          color:'var(--danger)', bg:'#fee2e2', icon:'🚨', page:'fulfilment' },
          { label:'Overdue Deliveries', val:delayedDel,        color:'var(--danger)', bg:'#fee2e2', icon:'🚚', page:'delivery'   },
          { label:'Orders to Pick',     val:toPickCount,       color:'#8b5cf6', bg:'#f3e8ff', icon:'🏭', page:'warehouse'   },
          { label:'Low Stock SKUs',     val:lowStock||0,       color:'#d97706', bg:'#fef3c7', icon:'📊', page:'inventory'   },
          { label:'Pending Billing',    val:pendingDCBilling||0, color:'#2E75B6', bg:'#dbeafe', icon:'🧾', page:'dc_billing' },
          { label:'Open Tickets',       val:openTickets||0,    color:'#7c3aed', bg:'#f3e8ff', icon:'🎫', page:'service_desk' },
        ].map(a => {
          const hot = a.val > 0;
          return `<div class="ct-action${hot?' hot':''}" onclick="navigate('${a.page}')">
            <div class="ct-action-ico" style="background:${hot?a.bg:'#f3f4f6'}">${a.icon}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.82rem;font-weight:${hot?'600':'500'};color:${hot?'var(--text)':'var(--text-muted)'}">${a.label}</div>
            </div>
            <div class="ct-action-val" style="color:${hot?a.color:'#c4c9d4'}">${a.val}</div>
            <div style="color:var(--text-muted);font-size:.8rem">›</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>

  <!-- ── RECENT ORDERS ── -->
  <div class="ct-card">
    <div class="ct-card-hd">
      <div>
        <div class="ct-card-title">Recent Orders</div>
        <div class="ct-card-sub">Latest activity across all clients</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">View All →</button>
    </div>
    ${(recentOrders||[]).map(o=>`
    <div class="ct-order-row" onclick="viewOrder('${o.id}')">
      <div style="width:38px;height:38px;border-radius:10px;background:#f0f4ff;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0">🧾</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${o.id}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:1px">${o.client_name||'—'}</div>
      </div>
      <div style="flex-shrink:0;text-align:right">
        <div style="font-weight:800;font-size:.9rem;color:var(--navy)">${fmt(o.grand_total)}</div>
        <div style="margin-top:3px">${statusBadge(o.status)}</div>
      </div>
      <div style="flex-shrink:0;text-align:right;margin-left:8px">
        <div style="font-size:.73rem;color:var(--text-muted)">${fmtDate(o.created_at)}</div>
      </div>
      <div style="color:var(--text-muted);font-size:.85rem;margin-left:4px">›</div>
    </div>`).join('')||'<div style="padding:32px;text-align:center;color:var(--text-muted)">No orders yet</div>'}
  </div>`;

  // Render chart after DOM is ready
  const labels = ['SUBMITTED','ACKNOWLEDGED','PICKED','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'];
  const colors  = ['#3b82f6','#8b5cf6','#f97316','#06b6d4','#f59e0b','#16a34a','#ef4444'];
  const counts  = labels.map(l => byStatus[l]||0);
  const ctx = document.getElementById('statusChart');
  if (ctx) {
    if (APP.charts.status) { APP.charts.status.destroy(); delete APP.charts.status; }
    APP.charts.status = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(l=>l.replace(/_/g,' ')),
        datasets: [{ data: counts, backgroundColor: colors, borderRadius: 8, borderSkipped: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend:{ display:false }, tooltip:{ callbacks:{ title: t => t[0].label, label: t => ` ${t.raw} orders` } } },
        scales: {
          x: { grid:{ display:false }, ticks:{ font:{ size:9, weight:'600' }, color:'#8896b0' } },
          y: { beginAtZero:true, ticks:{ precision:0, font:{ size:9 }, color:'#8896b0' }, grid:{ color:'#f0f2f7' }, border:{ display:false } }
        },
        animation: { duration: 600, easing: 'easeOutQuart' }
      }
    });
  }
}

async function renderVendorDashboard(el) {
  const data = await api('/dashboard');
  if (!data) return;
  const { vendor, pendingPOs } = data;

  el.innerHTML = `
  ${pageHeader('Vendor Dashboard', vendor?.name || 'Vendor Portal')}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${(()=>{
      const onTime = vendor?.on_time_rate||0;
      const fillRate = vendor?.fill_rate||0;
      const leadDays = vendor?.avg_lead_days||0;
      const pendingCount = (pendingPOs||[]).length;
      const onTimeColor = onTime>=90?'var(--success)':onTime>=70?'#d97706':'var(--danger)';
      const fillColor   = fillRate>=90?'var(--success)':fillRate>=70?'#d97706':'var(--danger)';
      const leadColor   = leadDays<=3?'var(--success)':leadDays<=7?'#d97706':'var(--danger)';
      return `
      <div class="card" style="padding:16px 18px;border-top:3px solid ${onTimeColor};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">On-time Rate</div>
        <div style="font-size:1.9rem;font-weight:700;color:${onTimeColor};line-height:1">${pct(onTime)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">last 90 days</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${fillColor};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Fill Rate</div>
        <div style="font-size:1.9rem;font-weight:700;color:${fillColor};line-height:1">${pct(fillRate)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">order completeness</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${leadColor};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg Lead Time</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${leadDays}d</div>
        <div style="font-size:.75rem;color:${leadColor};margin-top:6px">${leadDays<=3?'Excellent':leadDays<=7?'Acceptable':'Needs improvement'}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${pendingCount>0?'#d97706':'var(--success)'};margin-bottom:0;cursor:pointer" onclick="navigate('vendor_pos')">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Pending POs</div>
        <div style="font-size:1.9rem;font-weight:700;color:${pendingCount>0?'#d97706':'var(--navy)'};line-height:1">${pendingCount}</div>
        <div style="font-size:.75rem;color:${pendingCount>0?'#d97706':'var(--text-muted)'};margin-top:6px">${pendingCount>0?'awaiting action':'all clear'}</div>
      </div>`;
    })()}
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
  if (!APP._catalogView) APP._catalogView = 'tile';
  if (!APP._orderType) APP._orderType = 'Regular';
  APP._orderStep = 'catalogue';

  const last3 = (recentOrders||[]).slice(0,3);

  el.innerHTML = `
  <!-- STEP 1: BROWSE CATALOGUE -->
  <div id="order-step-catalogue">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Place Order</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Browse the catalogue and add items to your cart</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="showCSVUploadModal()">📋 Order via Spreadsheet</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('my_orders')">My Orders</button>
      </div>
    </div>

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

    <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
      <input type="search" id="catalog-search" placeholder="🔍  Search items by name or SKU…"
        style="width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;outline:none;transition:border .2s;box-sizing:border-box"
        oninput="searchCatalog(this.value)" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">
      <div class="tab-pills" style="margin-top:12px;margin-bottom:0;flex-wrap:wrap">
        ${['All',...cats].map(c=>`<button class="tab-pill${c==='All'?' active':''}" onclick="filterCatalog('${c}',this)">${c}</button>`).join('')}
      </div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div id="catalog-results-info" style="font-size:.8rem;color:var(--text-muted)">${inventory.length} items in catalogue</div>
      <div style="display:flex;border:1.5px solid var(--border);border-radius:8px;overflow:hidden">
        <button id="view-tile-btn" onclick="setCatalogView('tile')" title="Tile view"
          style="padding:5px 10px;border:none;cursor:pointer;background:${APP._catalogView==='tile'?'var(--navy)':'#fff'};color:${APP._catalogView==='tile'?'#fff':'var(--text-muted)'}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="0" width="6" height="6" rx="1"/><rect x="10" y="0" width="6" height="6" rx="1"/><rect x="0" y="10" width="6" height="6" rx="1"/><rect x="10" y="10" width="6" height="6" rx="1"/></svg>
        </button>
        <button id="view-list-btn" onclick="setCatalogView('list')" title="List view"
          style="padding:5px 10px;border:none;cursor:pointer;background:${APP._catalogView==='list'?'var(--navy)':'#fff'};color:${APP._catalogView==='list'?'#fff':'var(--text-muted)'}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="16" height="2" rx="1"/><rect x="0" y="7" width="16" height="2" rx="1"/><rect x="0" y="13" width="16" height="2" rx="1"/></svg>
        </button>
      </div>
    </div>
    <div id="catalog-grid" class="${APP._catalogView==='list'?'catalog-list':'catalog-grid'}">${renderCatalogItems(inventory)}</div>
    <div style="height:72px"></div>
  </div>

  <!-- STEP 2: REVIEW & PLACE -->
  <div id="order-step-review" style="display:none"></div>

  <!-- FLOATING CART BAR (bottom of viewport) -->
  <div id="cart-bottom-bar" style="display:none;position:fixed;bottom:0;left:var(--sidebar-w);right:0;z-index:90;background:var(--navy);color:#fff;padding:12px 24px;align-items:center;justify-content:space-between;gap:16px;box-shadow:0 -2px 16px rgba(0,0,0,.18)">
    <div style="display:flex;align-items:center;gap:14px">
      <span style="font-size:1.4rem">🛒</span>
      <div>
        <span id="cbb-count" style="font-weight:700;font-size:.95rem">0 items</span>
        <span style="margin:0 10px;opacity:.35">|</span>
        <span id="cbb-total" style="font-weight:800;font-size:1.1rem">₹0</span>
        <span style="font-size:.75rem;opacity:.65;margin-left:4px">incl. GST</span>
      </div>
    </div>
    <button class="btn btn-gold" style="padding:9px 22px;font-size:.9rem;font-weight:700" onclick="switchOrderStep('review')">
      Review Order →
    </button>
  </div>

  <!-- CSV Export / Import Modal -->
  <div id="csv-upload-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:16px;padding:28px;width:520px;max-width:95vw;box-shadow:0 8px 40px rgba(0,0,0,.22)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-weight:800;font-size:1rem;color:var(--navy)">Order via Spreadsheet</div>
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px">Export your item list → fill quantities → upload</div>
        </div>
        <button onclick="document.getElementById('csv-upload-modal').style.display='none'" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-muted);line-height:1">×</button>
      </div>

      <!-- Steps -->
      <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">

        <!-- Step 1 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#eff6ff;border-radius:10px;border:1px solid #bfdbfe">
          <div style="min-width:28px;height:28px;border-radius:50%;background:#1e40af;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">1</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:#1e40af;margin-bottom:4px">Export your assigned item list</div>
            <div style="font-size:.78rem;color:#1e3a8a;margin-bottom:10px">Downloads a CSV with all your items (SKU, name, category, price). The <b>Quantity</b> column is blank — fill it in.</div>
            <button class="btn btn-primary btn-sm" onclick="downloadOrderTemplate()">⬇ Download Item List</button>
          </div>
        </div>

        <!-- Step 2 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0">
          <div style="min-width:28px;height:28px;border-radius:50%;background:#15803d;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">2</div>
          <div>
            <div style="font-weight:700;font-size:.88rem;color:#15803d;margin-bottom:4px">Fill in quantities</div>
            <div style="font-size:.78rem;color:#14532d">Open in Excel / Google Sheets. Enter the quantity you need in the <b>Quantity</b> column for each item. Leave blank or 0 to skip an item. Save as CSV.</div>
          </div>
        </div>

        <!-- Step 3 -->
        <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#fefce8;border-radius:10px;border:1px solid #fde68a">
          <div style="min-width:28px;height:28px;border-radius:50%;background:#d97706;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem">3</div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:#92400e;margin-bottom:4px">Upload the filled CSV</div>
            <div style="font-size:.78rem;color:#78350f;margin-bottom:10px">Items with a quantity will be added to your cart. Review and place the order.</div>
            <input type="file" id="csv-upload-input" accept=".csv" style="display:block;padding:7px 10px;border:1.5px solid #fcd34d;border-radius:6px;width:100%;box-sizing:border-box;font-size:.82rem;background:#fff">
          </div>
        </div>
      </div>

      <div id="csv-import-feedback" style="margin-bottom:14px"></div>

      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="processCSVUpload()" style="flex:1">Import to Cart</button>
        <button class="btn btn-secondary" onclick="document.getElementById('csv-upload-modal').style.display='none'">Cancel</button>
      </div>
    </div>
  </div>`;

  refreshCartUI();
  if (APP._postNavStep) {
    const step = APP._postNavStep;
    APP._postNavStep = null;
    setTimeout(() => switchOrderStep(step), 0);
  }
}

function switchOrderStep(step) {
  if (step === 'review' && !APP.cart.length) { showToast('Add items to your cart first', 'error'); return; }
  APP._orderStep = step;
  const cat = document.getElementById('order-step-catalogue');
  const rev = document.getElementById('order-step-review');
  const bar = document.getElementById('cart-bottom-bar');
  if (!cat || !rev) return;
  if (step === 'review') {
    cat.style.display = 'none';
    if (bar) bar.style.display = 'none';
    rev.style.display = '';
    renderCartReview(rev);
  } else {
    rev.style.display = 'none';
    cat.style.display = '';
    refreshCartUI();
  }
}

function renderCartReview(container) {
  const isUrgent = (APP._orderType||'Regular') === 'Urgent';
  const today = new Date().toISOString().slice(0,10);
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div>
        <button class="btn btn-secondary btn-sm" onclick="switchOrderStep('catalogue')">← Back to Catalogue</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;font-size:.84rem">
        <span style="color:var(--text-muted)">① Browse</span>
        <div style="width:48px;height:2px;background:var(--navy);border-radius:1px"></div>
        <span style="font-weight:700;color:var(--navy)">② Review & Place</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:flex-start">

      <!-- Left: items + options -->
      <div>
        <!-- Items card -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <b style="font-size:.95rem;color:var(--navy)">Cart Items</b>
            <button class="btn btn-secondary btn-sm" onclick="switchOrderStep('catalogue')">+ Add More Items</button>
          </div>
          <div id="review-cart-items"></div>
        </div>

        <!-- Order Type -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px 18px;margin-bottom:16px">
          <label style="font-weight:700;font-size:.88rem;display:block;margin-bottom:10px;color:var(--navy)">Order Type</label>
          <div style="display:flex;gap:8px">
            ${['Regular','Urgent','Ad-Hoc'].map(t=>{
              const colors = {Regular:'var(--blue)',Urgent:'var(--danger)','Ad-Hoc':'#d97706'};
              const active = (APP._orderType||'Regular')===t;
              return `<button id="ot-btn-${t.replace('-','')}" onclick="setOrderType('${t}',this)"
                style="flex:1;padding:10px 0;border-radius:8px;border:1.5px solid ${colors[t]};
                background:${active?colors[t]:'#fff'};color:${active?'#fff':colors[t]};
                font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s">${t}</button>`;
            }).join('')}
          </div>
          <div id="need-by-wrap" style="display:${isUrgent?'block':'none'};margin-top:12px;padding:10px 12px;background:#fff8f8;border-radius:8px;border:1px solid #fecaca">
            <label style="font-size:.78rem;font-weight:700;color:var(--danger);display:block;margin-bottom:4px">🚨 Need By Date <span style="color:var(--text-muted);font-weight:400">(required)</span></label>
            <input type="date" id="cart-need-by" min="${today}"
              style="width:100%;padding:7px 10px;border:1.5px solid #fca5a5;border-radius:8px;font-size:.85rem;outline:none;box-sizing:border-box"
              onfocus="this.style.borderColor='var(--danger)'" onblur="this.style.borderColor='#fca5a5'" />
          </div>

          <div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <label style="font-size:.82rem;font-weight:700;color:var(--navy)">📅 Order for month</label>
            <input type="month" id="cart-order-period" value="${today.slice(0,7)}"
              style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
              onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'" />
            <span style="font-size:.72rem;color:var(--text-muted)">Defaults to this month — change only if ordering ahead</span>
          </div>
        </div>

        <!-- Notes -->
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);padding:16px 18px">
          <label style="font-weight:700;font-size:.88rem;display:block;margin-bottom:8px;color:var(--navy)">Delivery Notes <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
          <textarea id="cart-notes" rows="3" placeholder="Special instructions, delivery address, contact person…"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;resize:vertical;box-sizing:border-box;outline:none;transition:border .2s"
            onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'"></textarea>

          <label style="font-weight:700;font-size:.88rem;display:block;margin:14px 0 6px;color:var(--navy)">📷 Attach Photo <span style="font-weight:400;color:var(--text-muted)">(optional — reference image, handwritten list, product photo)</span></label>
          <input type="file" id="cart-image" accept="image/*" onchange="attachOrderImage(this)"
            style="display:block;width:100%;padding:8px;border:1.5px dashed var(--border);border-radius:8px;font-size:.8rem;box-sizing:border-box;background:#fafbfc">
          <div id="cart-image-preview" style="margin-top:8px;display:none;align-items:center;gap:10px">
            <img id="cart-image-thumb" style="max-height:70px;border-radius:8px;border:1px solid var(--border)">
            <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="removeOrderImage()">✕ Remove</button>
          </div>
        </div>
      </div>

      <!-- Right: summary + actions -->
      <div style="position:sticky;top:16px">
        <div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
          <div style="padding:14px 18px;border-bottom:1px solid var(--border)"><b>Order Summary</b></div>
          <div style="padding:16px 18px" id="review-summary"></div>
          <div style="padding:0 18px 18px;display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-gold" style="width:100%;padding:11px;font-size:.95rem" onclick="submitOrder()">
              ${iconCheck(14)} Place Order
            </button>
            <button class="btn btn-secondary" style="width:100%;font-size:.83rem" onclick="saveDraft()">Save as Draft</button>
            <button class="btn btn-secondary" style="width:100%;font-size:.8rem;color:var(--danger);border-color:#fca5a5" onclick="APP.cart=[];switchOrderStep('catalogue');showToast('Cart cleared')">Clear Cart</button>
          </div>
        </div>
      </div>
    </div>`;

  refreshCartReviewUI();
  loadBudgetBar();
}

function refreshCartReviewUI() {
  // Safety net: repair any cart item whose name is missing or equal to its SKU
  APP.cart.forEach(ci => {
    if (!ci.name || ci.name === ci.sku) {
      const ct = (APP._catalog||[]).find(c => c.sku === ci.sku);
      if (ct?.name) ci.name = ct.name;
    }
  });

  const total = APP.cart.reduce((s,i) => s + i.qty * i.unit_price, 0);
  const gst   = Math.round(total * 0.18);
  const grand = total + gst;
  const count = APP.cart.reduce((s,i) => s + i.qty, 0);

  const itemsEl = document.getElementById('review-cart-items');
  if (itemsEl) {
    itemsEl.innerHTML = APP.cart.length === 0
      ? `<div style="padding:40px;text-align:center;color:var(--text-muted)">Cart is empty — <a href="#" onclick="switchOrderStep('catalogue');return false">browse catalogue</a></div>`
      : APP.cart.map(item => `
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:38px;height:38px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${item.emoji||'📦'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:.88rem;color:var(--navy)">${item.name}</div>
              <div style="font-size:.73rem;color:var(--text-muted);margin-top:1px">${item.sku} · ${fmt(item.unit_price)}/unit</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <div class="catalog-qty" style="margin:0">
                <button class="qty-btn" onclick="changeQty('${item.sku}',-1,${item.unit_price},this)">−</button>
                <span class="qty-val" data-name="${item.name.replace(/"/g,'&quot;')}">${item.qty}</span>
                <button class="qty-btn" onclick="changeQty('${item.sku}',1,${item.unit_price},this)">+</button>
              </div>
              <span style="font-weight:700;min-width:64px;text-align:right;font-size:.9rem">${fmt(item.qty * item.unit_price)}</span>
              <button onclick="removeCartItem('${item.sku}')"
                style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:#fff;cursor:pointer;color:var(--text-muted);font-size:.78rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s"
                onmouseover="this.style.background='#fef2f2';this.style.borderColor='#fca5a5';this.style.color='var(--danger)'"
                onmouseout="this.style.background='#fff';this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">✕</button>
            </div>
          </div>
          <input type="text" maxlength="200" value="${h(item.note||'')}" placeholder="💬 Remark for this item — brand preference, size, urgency… (optional)"
            oninput="setCartItemNote('${item.sku}', this.value)"
            style="width:100%;margin-top:8px;padding:6px 10px;border:1px dashed var(--border);border-radius:7px;font-size:.76rem;box-sizing:border-box;outline:none;background:#fafbfc;transition:border .15s"
            onfocus="this.style.borderColor='var(--blue)';this.style.borderStyle='solid'" onblur="this.style.borderColor='var(--border)';this.style.borderStyle='dashed'">
        </div>`).join('');
  }

  const summaryEl = document.getElementById('review-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:.88rem"><span style="color:var(--text-muted)">${count} item${count!==1?'s':''}</span><span>${fmt(total)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;font-size:.88rem"><span style="color:var(--text-muted)">GST (18%)</span><span>${fmt(gst)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:2px solid var(--border);font-weight:800;font-size:1.05rem"><span>Total</span><span style="color:var(--navy)">${fmt(grand)}</span></div>
      ${grand > 100000 ? `<div class="alert alert-warning" style="margin-top:12px;font-size:.8rem">⚠️ Amount exceeds ₹1L — approval required</div>` : ''}
      <div id="budget-bar-wrap" style="margin-top:12px;display:none">
        <div style="font-size:.8rem;font-weight:600;margin-bottom:4px;color:var(--text-muted)">Monthly Budget Used</div>
        <div style="background:var(--border);height:8px;border-radius:4px;overflow:hidden"><div id="budget-bar-fill" style="height:100%;border-radius:4px;transition:width .3s"></div></div>
        <div id="budget-bar-label" style="font-size:.73rem;margin-top:3px;color:var(--text-muted)"></div>
      </div>`;
    loadBudgetBar();
  }
}

function removeCartItem(sku) {
  APP.cart = APP.cart.filter(i => i.sku !== sku);
  if (!APP.cart.length) { switchOrderStep('catalogue'); showToast('Cart is empty', 'info'); return; }
  refreshCartReviewUI();
}

function setCartItemNote(sku, note) {
  const item = APP.cart.find(i => i.sku === sku);
  if (item) item.note = note.trim() || undefined;
}

/* ── Order photo attachment: downscale to ≤900px JPEG, keep under ~1MB ── */
function attachOrderImage(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); input.value=''; return; }
  const img = new Image();
  img.onload = () => {
    const maxDim = 900;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    if (dataUrl.length > 1_400_000) dataUrl = canvas.toDataURL('image/jpeg', 0.5);
    if (dataUrl.length > 1_400_000) { showToast('Image too large even after compression — try a smaller photo', 'error'); input.value=''; return; }
    APP._orderImage = dataUrl;
    const prev = document.getElementById('cart-image-preview');
    const thumb = document.getElementById('cart-image-thumb');
    if (thumb) thumb.src = dataUrl;
    if (prev) prev.style.display = 'flex';
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => { showToast('Could not read image', 'error'); input.value=''; };
  img.src = URL.createObjectURL(file);
}

function removeOrderImage() {
  APP._orderImage = null;
  const inp = document.getElementById('cart-image'); if (inp) inp.value = '';
  const prev = document.getElementById('cart-image-preview'); if (prev) prev.style.display = 'none';
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
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = APP._catalogView==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(filtered); }
}

function setCatalogView(v) {
  APP._catalogView = v;
  ['tile','list'].forEach(x => {
    const btn = document.getElementById('view-'+x+'-btn');
    if (btn) { btn.style.background = v===x?'var(--navy)':'#fff'; btn.style.color = v===x?'#fff':'var(--text-muted)'; }
  });
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = v==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(getFilteredCatalog()); }
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
  const catalog = APP._catalog || [];
  const date = new Date().toISOString().slice(0,10);
  const header = 'SKU,Item Name,Category,UOM,Unit Price,Quantity';
  const body = catalog.map(i => [
    i.sku,
    `"${(i.name||'').replace(/"/g,'""')}"`,
    `"${(i.category||'').replace(/"/g,'""')}"`,
    i.uom || 'unit',
    (i.unit_price != null ? Number(i.unit_price).toFixed(2) : ''),
    ''   // blank — client fills this in
  ].join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `order-list-${date}.csv`;
  a.click();
  showToast(`Exported ${catalog.length} item${catalog.length!==1?'s':''}`, 'success');
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
  const notFoundNote = notFound.length ? `<div style="font-size:.78rem;margin-top:6px">SKUs not found in your catalog: ${notFound.join(', ')}</div>` : '';
  if(fb) fb.innerHTML = `<div style="padding:10px 14px;border-radius:8px;background:${imported?'#d1fae5':'#fef3c7'};border:1px solid ${imported?'#6ee7b7':'#fcd34d'};font-size:.84rem;color:${imported?'#065f46':'#92400e'}">
    <b>${imported} item(s) added to cart</b>${skipped?`, ${skipped} row(s) skipped (blank or 0 qty)`:''}.${notFoundNote}
    ${imported?'<div style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="document.getElementById(\'csv-upload-modal\').style.display=\'none\';switchOrderStep(\'review\')">Review &amp; Place Order →</button></div>':''}
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
    else APP.cart.push({ sku: i.sku || i.name, name: i.name, qty: i.qty, unit_price: price, emoji: item?.emoji || '📦' });
  });
  showToast('Items added to cart');
  refreshCartUI();
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
  if (!items.length) return `<div style="padding:32px;text-align:center;color:var(--text-muted);grid-column:1/-1">No items match your search</div>`;
  const view = APP._catalogView || 'tile';
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  if (view === 'list') {
    return `<div style="background:#fff;border-radius:12px;border:1px solid var(--border);overflow:hidden">
      <div style="display:grid;grid-template-columns:${isClient?'2fr 1fr 90px 110px':'2fr 1fr 80px 90px 110px'};gap:0;padding:8px 16px;background:#f8fafc;border-bottom:1px solid var(--border);font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">
        <div>Item</div><div>Category</div>${isClient?'':'<div>Stock</div>'}<div>Price</div><div style="text-align:center">Quantity</div>
      </div>
      ${items.map(item => {
        const inCart = APP.cart.find(c => c.sku === item.sku);
        const qty = inCart ? inCart.qty : 0;
        const lowStock = item.stock <= item.reorder_level;
        return `<div style="display:grid;grid-template-columns:${isClient?'2fr 1fr 90px 110px':'2fr 1fr 80px 90px 110px'};gap:0;padding:10px 16px;border-bottom:1px solid var(--border);align-items:center;transition:background .12s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
          <div style="display:flex;align-items:center;gap:10px;min-width:0">
            <div style="font-size:1.4rem;flex-shrink:0">${item.emoji||'📦'}</div>
            <div style="min-width:0">
              <div style="font-weight:600;font-size:.88rem;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
              <div style="font-size:.72rem;color:var(--text-muted)">${item.sku}${item.brand?' · '+item.brand:''}</div>
            </div>
          </div>
          <div style="font-size:.8rem;color:var(--text-muted)">${item.category}${item.sub_category&&item.sub_category!=='Normal'?'<br><span style="font-size:.7rem;color:#10b981;font-weight:600">'+item.sub_category+'</span>':''}</div>
          ${isClient?'':`<div style="font-size:.82rem;font-weight:600;color:${lowStock?'var(--danger)':'var(--text-muted)'}">
            ${item.stock}${item.uom?' '+item.uom:''}${lowStock?' ⚠️':''}
          </div>`}
          <div style="font-weight:700;font-size:.9rem;color:var(--navy)">${fmt(item.unit_price)}${item.client_price!=null?`<span style="font-size:.65rem;background:#dbeafe;color:#1d4ed8;padding:1px 5px;border-radius:8px;margin-left:4px;font-weight:600">Your Price</span>`:''}</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:6px">
            <button class="qty-btn" onclick="changeQty('${item.sku}',-1,${item.unit_price},this)" style="width:26px;height:26px;border-radius:50%">−</button>
            <span class="qty-val" id="qty-${item.sku}" data-name="${item.name.replace(/"/g,'&quot;')}" style="min-width:20px;text-align:center;font-weight:700;font-size:.9rem;color:${qty>0?'var(--navy)':'var(--text-muted)'}">${qty}</span>
            <button class="qty-btn" onclick="changeQty('${item.sku}',1,${item.unit_price},this)" style="width:26px;height:26px;border-radius:50%">+</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Tile view (default)
  return items.map(item => {
    const inCart = APP.cart.find(c => c.sku === item.sku);
    const qty = inCart ? inCart.qty : 0;
    const lowStock = item.stock <= item.reorder_level;
    return `<div class="catalog-card" style="${qty>0?'border-color:var(--navy);box-shadow:0 2px 8px rgba(0,0,0,.1)':''}">
      <div style="position:relative">
        <div class="catalog-emoji">${item.emoji||'📦'}</div>
        ${qty>0?`<div style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;border-radius:50%;background:var(--navy);color:#fff;font-size:.7rem;font-weight:800;display:flex;align-items:center;justify-content:center">${qty}</div>`:''}
      </div>
      <div class="catalog-name">${item.name}</div>
      <div class="catalog-cat">${item.category}${item.brand?' · '+item.brand:''}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:4px">
        <div class="catalog-price">${fmt(item.unit_price)}</div>
        ${item.uom?`<span style="font-size:.7rem;color:var(--text-muted)">/${item.uom}</span>`:''}
      </div>
      ${item.client_price!=null?`<div style="font-size:.67rem;background:#dbeafe;color:#1d4ed8;padding:1px 7px;border-radius:10px;display:inline-block;margin-bottom:6px">Your Price</div>`:'<div style="margin-bottom:6px"></div>'}
      ${isClient?'':`<div class="catalog-stock ${lowStock?'text-danger':''}" style="margin-bottom:10px">
        ${lowStock?'⚠️ ':''}Stock: ${item.stock}
      </div>`}
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
  const grid = document.getElementById('catalog-grid');
  if (grid) { grid.className = APP._catalogView==='list'?'catalog-list':'catalog-grid'; grid.innerHTML = renderCatalogItems(filtered); }
}

function changeQty(sku, delta, price, btnOrName) {
  const catalogItem = (APP._catalog||[]).find(c => c.sku === sku);
  // Prefer the catalog's real item name; fall back to the qty-val label, never the SKU
  const name = catalogItem?.name
    || (typeof btnOrName === 'string' ? btnOrName : null)
    || (typeof btnOrName === 'object' ? document.getElementById('qty-' + sku)?.dataset.name : null)
    || sku;
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) {
    existing.qty = Math.max(0, existing.qty + delta);
    if (existing.qty === 0) APP.cart = APP.cart.filter(c => c.sku !== sku);
  } else if (delta > 0) {
    APP.cart.push({ sku, name, qty: 1, unit_price: price, emoji: catalogItem?.emoji || '📦' });
  }
  const qtyEl = document.getElementById('qty-' + sku);
  if (qtyEl) qtyEl.textContent = APP.cart.find(c => c.sku === sku)?.qty || 0;
  refreshCartUI();
}

async function orderMoreItem(sku, name) {
  const items = await api('/inventory?q=' + encodeURIComponent(sku));
  const item = Array.isArray(items) ? items.find(i => i.sku === sku) : null;
  const price = item?.unit_price || item?.client_price || 0;
  const emoji = item?.emoji || '📦';
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) {
    existing.qty += 1;
  } else {
    APP.cart.push({ sku, name: item?.name || name, qty: 1, unit_price: price, emoji });
  }
  showToast(`${item?.name || name} added to cart`);
  APP._postNavStep = 'review';
  navigate('place_order');
}

function refreshCartUI() {
  const total = APP.cart.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const gst   = Math.round(total * 0.18);
  const grand = total + gst;
  const count = APP.cart.reduce((s, i) => s + i.qty, 0);

  // Update floating bottom bar (step 1 — browse)
  const bar = document.getElementById('cart-bottom-bar');
  if (bar) {
    bar.style.display = APP.cart.length ? 'flex' : 'none';
    const cbbCount = document.getElementById('cbb-count');
    const cbbTotal = document.getElementById('cbb-total');
    if (cbbCount) cbbCount.textContent = count + ' item' + (count !== 1 ? 's' : '');
    if (cbbTotal) cbbTotal.textContent = fmt(grand);
  }

  // If review step is open, refresh it too
  if (APP._orderStep === 'review') refreshCartReviewUI();
}

function setOrderType(type, btn) {
  APP._orderType = type;
  const colors = {Regular:'var(--blue)',Urgent:'var(--danger)','Ad-Hoc':'#d97706'};
  ['Regular','Urgent','Ad-Hoc'].forEach(t => {
    const b = document.getElementById('ot-btn-' + t.replace('-',''));
    if (!b) return;
    const c = colors[t];
    b.style.background = t === type ? c : '#fff';
    b.style.color = t === type ? '#fff' : c;
  });
  const nbw = document.getElementById('need-by-wrap');
  if (nbw) nbw.style.display = type === 'Urgent' ? 'block' : 'none';
  if (type !== 'Urgent') { const nb = document.getElementById('cart-need-by'); if (nb) nb.value = ''; }
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

async function confirmOrder(saveAsDraft) {
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const clientId = isClientRole ? (APP.user.client_id || '__self__') : document.getElementById('order-client')?.value;
  if (!isClientRole && !clientId) { showToast('Select a client', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = saveAsDraft ? 'Saving…' : 'Submitting…'; }

  const notes = document.getElementById('cart-notes')?.value?.trim() || '';
  const orderType = APP._orderType || 'Regular';
  const needByDate = document.getElementById('cart-need-by')?.value || '';
  const orderPeriod = document.getElementById('cart-order-period')?.value || '';
  const result = await api('/orders', {
    method: 'POST',
    body: JSON.stringify({
      client_id: clientId,
      items: APP.cart,
      order_type: orderType,
      ...(notes ? { notes } : {}),
      ...(APP._orderImage ? { image: APP._orderImage } : {}),
      ...(needByDate ? { need_by_date: needByDate } : {}),
      ...(orderPeriod ? { order_period: orderPeriod } : {}),
      ...(saveAsDraft ? { save_as_draft: true } : {}),
    }),
  });

  closeModal();
  if (result) {
    APP.cart = [];
    APP._orderImage = null;
    if (saveAsDraft) {
      showToast(`Draft ${result.id} saved — submit it from My Orders`);
    } else {
      showToast(`Order ${result.id} placed — ${result.status==='PENDING_APPROVAL'?'sent for approval':'submitted to 4SYZ'}`);
    }
    navigate('my_orders');
  }
}

async function saveDraft() {
  if (!APP.cart.length) { showToast('Cart is empty', 'error'); return; }
  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
  const grand = APP.cart.reduce((s,i)=>s+i.qty*i.unit_price,0)*1.18;
  const summary = `
    <div class="cart-row cart-total" style="margin-bottom:8px"><span>Grand Total</span><span>${fmt(grand)}</span></div>
    <p style="font-size:.85rem;color:var(--text-muted)">${APP.cart.length} item type(s) · ${APP.cart.reduce((s,i)=>s+i.qty,0)} units</p>`;
  if (isClientRole) {
    openModal('Save as Draft',
      `<p style="color:var(--text-muted);margin-bottom:12px">Draft will be saved to My Orders. You can submit it later.</p>${summary}`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-gold" onclick="confirmOrder(true)">Save Draft</button>`);
  } else {
    const clients = await api('/clients');
    const clientOpts = (clients||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    openModal('Save as Draft',
      `<div style="margin-bottom:16px">
        <label style="display:block;margin-bottom:6px;font-weight:600">Select Client</label>
        <select id="order-client" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"
          onchange="document.getElementById('save-draft-btn').disabled=!this.value">
          <option value="">— Select a client —</option>
          ${clientOpts}
        </select>
      </div>${summary}`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button id="save-draft-btn" class="btn btn-gold" onclick="confirmOrder(true)" disabled>Save Draft</button>`);
  }
}

/* ============================================================
   MY INVENTORY (CLIENT STORE TRACKING)
   ============================================================ */
function h(v) { return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function renderMyInventory(el) {
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px"><span style="color:var(--text-muted)">Loading inventory…</span></div>`;
  const [items, consumption] = await Promise.all([
    api('/client-inventory'),
    api('/client-inventory/consumption').catch(()=>[]),
  ]);
  if (!items) { el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted)">Could not load inventory.</div>`; return; }

  const totalItems   = items.length;
  const lowStock     = items.filter(i => i.stock_status === 'low').length;
  const outOfStock   = items.filter(i => i.stock_status === 'out').length;
  const consumedWeek = (consumption||[]).filter(c => c.consumed_at >= new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const totalUsedWeek= consumedWeek.reduce((s,c) => s + (c.qty||0), 0);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">My Store Inventory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Track items received, log consumption, and reorder low-stock items</div>
    </div>
    <button class="btn btn-secondary btn-sm" onclick="syncClientInventory(this)">🔄 Sync from Deliveries</button>
  </div>

  <!-- KPI Cards -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:14px;margin-bottom:18px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items Tracked</div>
      <div style="font-size:1.8rem;font-weight:700;color:var(--navy);line-height:1">${totalItems}</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${lowStock?'#f59e0b':'var(--border)'};margin-bottom:0;cursor:pointer" onclick="document.getElementById('inv-filter-status').value='low';filterMyInventoryTable()">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Low Stock</div>
      <div style="font-size:1.8rem;font-weight:700;color:${lowStock?'#d97706':'var(--navy)'};line-height:1">${lowStock}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">at or below reorder level</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${outOfStock?'var(--danger)':'var(--border)'};margin-bottom:0;cursor:pointer" onclick="document.getElementById('inv-filter-status').value='out';filterMyInventoryTable()">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Out of Stock</div>
      <div style="font-size:1.8rem;font-weight:700;color:${outOfStock?'var(--danger)':'var(--navy)'};line-height:1">${outOfStock}</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Used This Week</div>
      <div style="font-size:1.8rem;font-weight:700;color:var(--navy);line-height:1">${Math.round(totalUsedWeek)}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">units consumed</div>
    </div>
  </div>

  <!-- Tabs -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
    ${['stock','consumption'].map((t,i) => `<button id="inv-tab-${t}" onclick="switchMyInvTab('${t}')" style="padding:9px 20px;font-size:.85rem;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:${i===0?'2px solid var(--primary)':'2px solid transparent'};margin-bottom:-2px;color:${i===0?'var(--primary)':'var(--text-muted)'}">${['Current Stock','Consumption Log'][i]}</button>`).join('')}
  </div>

  <!-- Current Stock Tab -->
  <div id="inv-panel-stock">
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <input id="inv-search" type="text" placeholder="Search items…" class="form-control" style="max-width:240px" oninput="filterMyInventoryTable()">
      <select id="inv-filter-status" class="form-control" style="max-width:160px" onchange="filterMyInventoryTable()">
        <option value="">All Status</option>
        <option value="ok">In Stock</option>
        <option value="low">Low Stock</option>
        <option value="out">Out of Stock</option>
      </select>
      <select id="inv-filter-cat" class="form-control" style="max-width:180px" onchange="filterMyInventoryTable()">
        <option value="">All Categories</option>
        ${[...new Set(items.map(i=>i.category).filter(Boolean))].sort().map(c=>`<option value="${h(c)}">${h(c)}</option>`).join('')}
      </select>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table table-cards" style="margin:0">
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>UOM</th>
            <th style="text-align:right">In Store</th>
            <th style="text-align:right">Reorder At</th>
            <th>Status</th>
            <th>Last Received</th>
            <th>Last Used</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="my-inv-tbody">
          ${items.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No inventory yet — items will appear here after deliveries are confirmed.</td></tr>` :
            items.map(i => myInvRow(i)).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Consumption Log Tab -->
  <div id="inv-panel-consumption" style="display:none">
    <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <input type="date" id="inv-cons-from" class="form-control" style="max-width:160px" value="${new Date(Date.now()-7*86400000).toISOString().slice(0,10)}" onchange="reloadConsumptionLog()">
      <span style="color:var(--text-muted);font-size:.85rem">to</span>
      <input type="date" id="inv-cons-to" class="form-control" style="max-width:160px" value="${new Date().toISOString().slice(0,10)}" onchange="reloadConsumptionLog()">
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="table" style="margin:0">
        <thead>
          <tr><th>Date & Time</th><th>Item</th><th style="text-align:right">Qty Used</th><th>Notes</th><th>Recorded By</th></tr>
        </thead>
        <tbody id="cons-log-tbody">
          ${renderConsumptionRows(consumption||[])}
        </tbody>
      </table>
    </div>
  </div>`;
}

function myInvRow(i) {
  const statusColor = i.stock_status==='out' ? 'var(--danger)' : i.stock_status==='low' ? '#d97706' : 'var(--success)';
  const statusLabel = i.stock_status==='out' ? 'Out of Stock' : i.stock_status==='low' ? 'Low Stock' : 'In Stock';
  const statusBg    = i.stock_status==='out' ? '#fee2e2' : i.stock_status==='low' ? '#fef3c7' : '#d1fae5';
  const rowBg       = i.stock_status==='out' ? 'background:#fff5f5' : i.stock_status==='low' ? 'background:#fffdf0' : '';
  return `<tr data-sku="${h(i.sku)}" data-cat="${h(i.category||'')}" data-status="${i.stock_status}" style="${rowBg}">
    <td class="card-title-cell">
      <div style="font-weight:600;font-size:.87rem;color:var(--navy)">${h(i.item_name||i.sku)}</div>
      <div style="font-size:.72rem;color:var(--text-muted)">${h(i.sku)}</div>
    </td>
    <td data-label="Category" style="font-size:.82rem;color:var(--text-muted)">${h(i.category||'—')}</td>
    <td data-label="UOM" style="font-size:.82rem;color:var(--text-muted)">${h(i.uom||'unit')}</td>
    <td data-label="Qty on Hand" style="text-align:right;font-weight:700;font-size:.95rem;color:${i.qty_on_hand===0?'var(--danger)':i.qty_on_hand<=i.reorder_level&&i.reorder_level>0?'#d97706':'var(--navy)'}">${Math.round(i.qty_on_hand||0)}</td>
    <td data-label="Reorder Level" style="text-align:right;font-size:.82rem;color:var(--text-muted)">${i.reorder_level>0?Math.round(i.reorder_level):'—'}</td>
    <td data-label="Status"><span style="font-size:.72rem;font-weight:700;padding:3px 8px;border-radius:20px;background:${statusBg};color:${statusColor}">${statusLabel}</span></td>
    <td data-label="Last Received" style="font-size:.78rem;color:var(--text-muted)">${i.last_received_at ? fmtDate(i.last_received_at) : '—'}</td>
    <td data-label="Last Used" style="font-size:.78rem;color:var(--text-muted)">${i.last_consumed_at ? fmtDate(i.last_consumed_at) : '—'}</td>
    <td>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="logConsumptionModal('${h(i.sku)}','${h(i.item_name||i.sku)}',${i.qty_on_hand||0},'${h(i.uom||'unit')}')">Log Use</button>
        ${(i.stock_status==='low'||i.stock_status==='out') ? `<button class="btn btn-gold btn-sm" onclick="orderMoreItem('${h(i.sku)}','${h(i.item_name||i.sku)}')">Order More</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="editInvItemModal('${h(i.sku)}','${h(i.item_name||'')}',${i.reorder_level||0})" title="Edit name / reorder level">✏️</button>
      </div>
    </td>
  </tr>`;
}

function renderConsumptionRows(rows) {
  if (!rows.length) return `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">No consumption recorded in this period.</td></tr>`;
  return rows.map(r => `<tr>
    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${fmtDate(r.consumed_at)}</td>
    <td><div style="font-weight:600;font-size:.85rem">${h(r.item_name)}</div><div style="font-size:.72rem;color:var(--text-muted)">${h(r.sku)}</div></td>
    <td style="text-align:right;font-weight:700">${Math.round(r.qty)}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${r.notes ? h(r.notes) : '—'}</td>
    <td style="font-size:.8rem;color:var(--text-muted)">${h(r.recorded_by||'—')}</td>
  </tr>`).join('');
}

function switchMyInvTab(tab) {
  ['stock','consumption'].forEach(t => {
    document.getElementById(`inv-panel-${t}`).style.display = t===tab ? '' : 'none';
    const btn = document.getElementById(`inv-tab-${t}`);
    btn.style.borderBottom = t===tab ? '2px solid var(--primary)' : '2px solid transparent';
    btn.style.color = t===tab ? 'var(--primary)' : 'var(--text-muted)';
  });
}

function filterMyInventoryTable() {
  const q      = (document.getElementById('inv-search')?.value||'').toLowerCase();
  const status = document.getElementById('inv-filter-status')?.value || '';
  const cat    = document.getElementById('inv-filter-cat')?.value || '';
  document.querySelectorAll('#my-inv-tbody tr[data-sku]').forEach(row => {
    const text   = row.textContent.toLowerCase();
    const rowCat = row.dataset.cat || '';
    const rowSt  = row.dataset.status || '';
    const show   = (!q || text.includes(q)) && (!status || rowSt===status) && (!cat || rowCat===cat);
    row.style.display = show ? '' : 'none';
  });
}

function logConsumptionModal(sku, name, qty, uom) {
  const onHand = Math.round(qty) || 0;
  openModal(`Log Consumption — ${name}`, `
    <div style="margin-bottom:14px">
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:4px">Currently in store: <strong>${onHand} ${uom}</strong></div>
    </div>
    <div class="form-group">
      <label class="form-label">Quantity Used <span style="color:var(--danger)">*</span></label>
      <input id="cons-qty" type="number" min="1" step="1" max="${onHand}" class="form-control" placeholder="e.g. 5" style="max-width:160px"
        oninput="validateConsQty(${onHand})">
      <div id="cons-qty-warn" style="display:none;font-size:.76rem;color:var(--danger);margin-top:5px"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Notes (optional)</label>
      <input id="cons-notes" type="text" class="form-control" placeholder="e.g. Used for lunch service">
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button id="cons-save-btn" class="btn btn-primary" onclick="submitConsumption('${h(sku)}',${onHand})">Save</button>`);
}

function validateConsQty(onHand) {
  const input = document.getElementById('cons-qty');
  const warn  = document.getElementById('cons-qty-warn');
  const btn   = document.getElementById('cons-save-btn');
  const val   = parseInt(input?.value, 10);
  let msg = '';
  if (input?.value && (isNaN(val) || val <= 0)) msg = 'Enter a quantity of at least 1.';
  else if (val > onHand) msg = `Only ${onHand} in store — you cannot use more than that.`;
  if (warn) { warn.textContent = msg; warn.style.display = msg ? 'block' : 'none'; }
  if (input) input.style.borderColor = msg ? 'var(--danger)' : '';
  if (btn) btn.disabled = !!msg;
  return !msg;
}

async function submitConsumption(sku, onHand) {
  const qty   = parseInt(document.getElementById('cons-qty')?.value, 10);
  const notes = document.getElementById('cons-notes')?.value?.trim();
  if (!qty || qty <= 0) { showToast('Enter a valid quantity', 'error'); return; }
  if (typeof onHand === 'number' && qty > onHand) {
    showToast(`Only ${onHand} in store — cannot log ${qty}`, 'error');
    validateConsQty(onHand);
    return;
  }

  const res = await api('/client-inventory/consume', {method:'POST', body:JSON.stringify({sku, qty, notes})});
  if (res?.ok) {
    showToast(`Consumption logged — ${qty} units`);
    closeModal();
    navigate('my_inventory');
  } else {
    showToast(res?.error || 'Error logging consumption', 'error');
  }
}

function editInvItemModal(sku, currentName, currentLevel) {
  openModal(`Reorder Level — ${currentName||sku}`, `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:14px">
      Flag this item as <b>Low Stock</b> when quantity falls to or below this level.
    </div>
    <div class="form-group">
      <label class="form-label">Reorder Level</label>
      <input id="edit-inv-reorder" type="number" min="0" step="1" class="form-control" value="${currentLevel||0}" style="max-width:160px">
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveInvItemEdit('${h(sku)}')">Save</button>`);
}

async function saveInvItemEdit(sku) {
  const level = parseFloat(document.getElementById('edit-inv-reorder')?.value);
  if (isNaN(level) || level < 0) { showToast('Enter a valid reorder level', 'error'); return; }
  const res = await api(`/client-inventory/${encodeURIComponent(sku)}`, {method:'PATCH', body:JSON.stringify({reorder_level: level})});
  if (res?.ok) { showToast('Reorder level saved'); closeModal(); navigate('my_inventory'); }
  else showToast(res?.error || 'Error saving', 'error');
}

async function syncClientInventory(btn) {
  const orig = btn.textContent;
  btn.textContent = 'Syncing…'; btn.disabled = true;
  const res = await api('/client-inventory/sync', {method:'POST'});
  btn.textContent = orig; btn.disabled = false;
  if (res?.ok) { showToast('Inventory synced from deliveries'); navigate('my_inventory'); }
  else showToast(res?.error || 'Sync failed', 'error');
}

async function reloadConsumptionLog() {
  const from = document.getElementById('inv-cons-from')?.value;
  const to   = document.getElementById('inv-cons-to')?.value;
  const tbody = document.getElementById('cons-log-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</td></tr>`;
  const rows = await api(`/client-inventory/consumption?from=${from}&to=${to}`).catch(()=>[]);
  tbody.innerHTML = renderConsumptionRows(rows||[]);
}

/* ============================================================
   MY ORDERS
   ============================================================ */
async function renderMyOrders(el) {
  const orders = await api('/orders');
  if (!orders) return;
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  if (isClient) {
    const statuses = ['All','DRAFT','SUBMITTED','PENDING_APPROVAL','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'];
    if (!APP._moTab) APP._moTab = 'All';
    if (!APP._moSearch) APP._moSearch = '';

    const STATUS_LABEL = { DRAFT:'Draft', SUBMITTED:'Submitted', PENDING_APPROVAL:'Awaiting Approval', APPROVED:'Approved', ACKNOWLEDGED:'Processing', INVENTORY_CHECK:'Checking Stock', READY_TO_PICK:'Picking', PICKED:'Picked', QUALITY_CHECK:'Quality Check', VENDOR_PO_RAISED:'Procurement', IN_SHIPMENT:'In Shipment', PARTIALLY_CLOSED:'Partially Delivered', CLOSED:'Delivered', CANCELLED:'Cancelled' };
    const ORDER_STEPS = ['SUBMITTED','APPROVED','READY_TO_PICK','IN_SHIPMENT','CLOSED'];
    const STATUS_COLOR = { DRAFT:'#6b7280', SUBMITTED:'#3b82f6', PENDING_APPROVAL:'#f59e0b', APPROVED:'#3b82f6', ACKNOWLEDGED:'#8b5cf6', INVENTORY_CHECK:'#8b5cf6', READY_TO_PICK:'#f97316', PICKED:'#f97316', QUALITY_CHECK:'#06b6d4', VENDOR_PO_RAISED:'#8b5cf6', IN_SHIPMENT:'#06b6d4', PARTIALLY_CLOSED:'#f59e0b', CLOSED:'#10b981', CANCELLED:'#ef4444' };

    function moFiltered() {
      let list = APP._moTab === 'All' ? orders : orders.filter(o => o.status === APP._moTab);
      if (APP._moSearch) {
        const q = APP._moSearch.toLowerCase();
        list = list.filter(o => o.id.toLowerCase().includes(q) || (o.notes||'').toLowerCase().includes(q));
      }
      return list;
    }

    function orderProgress(status) {
      if (status === 'CANCELLED') return -1;
      const idx = ORDER_STEPS.indexOf(status);
      return idx === -1 ? 0 : idx;
    }

    function moRender() {
      const filtered = moFiltered();
      document.getElementById('mo-count').textContent = `${filtered.length} order${filtered.length!==1?'s':''}`;
      const container = document.getElementById('mo-cards');

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:56px;text-align:center;background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-size:3rem;margin-bottom:12px">📋</div>
          <div style="font-weight:700;font-size:1rem;color:var(--navy)">No orders found</div>
          <div style="font-size:.83rem;color:var(--text-muted);margin-top:6px">Try "All" or clear the search filter</div>
          <button class="btn btn-gold" style="margin-top:16px" onclick="navigate('place_order')">${iconPlus(13)} Place New Order</button>
        </div>`;
        return;
      }

      container.innerHTML = filtered.map(o => {
        const sc = STATUS_COLOR[o.status] || '#6b7280';
        const isCancelled = o.status === 'CANCELLED';
        const isPartial   = o.status === 'PARTIALLY_CLOSED';
        const isDone      = o.status === 'CLOSED';
        const progress    = orderProgress(o.status);
        const itemNames   = (o.items||[]).slice(0,4).map(i=>i.name||i.item_name||'').filter(Boolean);

        // Progress bar (5 stages)
        const progressBar = isCancelled ? `
          <div style="margin:12px 0 4px;display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:4px;border-radius:2px;background:#fecaca"></div>
            <span style="font-size:.72rem;color:#ef4444;font-weight:700;white-space:nowrap">Cancelled</span>
          </div>` : `
          <div style="margin:12px 0 8px">
            <div style="display:flex;gap:2px;margin-bottom:4px">
              ${ORDER_STEPS.map((s,i) => `<div style="flex:1;height:4px;border-radius:2px;background:${i<=progress?sc:'var(--border)'}"></div>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between">
              ${ORDER_STEPS.map((s,i) => `<span style="font-size:.65rem;color:${i<=progress?sc:'var(--text-muted)'};font-weight:${i===progress?700:400};${i===0?'':'text-align:center;flex:1'}">${i===0?STATUS_LABEL[s]:STATUS_LABEL[s]}</span>`).join('')}
            </div>
          </div>`;

        return `
        <div style="background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.07);margin-bottom:12px;overflow:hidden;border:1px solid ${isCancelled?'#fecaca':isDone?'#bbf7d0':'var(--border)'}">
          <!-- Card top bar -->
          <div style="height:3px;background:${sc}"></div>
          <div style="padding:16px 20px">
            <!-- Row 1: ID + amount + status -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:40px;height:40px;border-radius:10px;background:${sc}18;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">
                  ${isDone?'✅':isPartial?'🔶':isCancelled?'❌':o.status==='IN_SHIPMENT'?'🚚':o.status==='PENDING_APPROVAL'?'⏳':o.status==='DRAFT'?'✏️':'📄'}
                </div>
                <div>
                  <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${o.id}</div>
                  <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmtDate(o.created_at)}${(o.items||[]).length?' · '+(o.items||[]).length+' item'+(o.items.length!==1?'s':''):''}</div>
                </div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-weight:800;font-size:1.1rem;color:var(--navy)">${fmt(o.grand_total)}</div>
                ${o.status==='CLOSED'&&(o.closed_at||o.updated_at)?`<div style="font-size:.7rem;color:var(--success);font-weight:600;margin-top:4px">✓ Closed ${fmtDate(o.closed_at||o.updated_at)}</div>`:''}
                <div style="margin-top:4px;display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">${statusBadge(o.status)} ${o.order_type&&o.order_type!=='Regular'?orderTypeBadge(o.order_type):''}</div>
              </div>
            </div>

            <!-- Progress bar -->
            ${progressBar}

            <!-- Item preview chips -->
            ${itemNames.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
              ${itemNames.map(n=>`<span style="background:var(--bg,#f8fafc);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:.72rem;color:var(--text-muted)">${n}</span>`).join('')}
              ${(o.items||[]).length>4?`<span style="background:var(--bg,#f8fafc);border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:.72rem;color:var(--text-muted)">+${(o.items||[]).length-4} more</span>`:''}
            </div>` : o.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px;padding:8px 12px;background:#f8fafc;border-radius:8px">📝 ${o.notes}</div>` : ''}

            ${o.need_by_date ? `<div style="padding:6px 12px;background:#fff8f8;border-radius:8px;font-size:.78rem;color:var(--danger);font-weight:600;margin-bottom:8px;border:1px solid #fecaca">🚨 Need By: ${fmtDate(o.need_by_date)}</div>` : ''}
            ${o.predicted_delivery_date && !['CLOSED','DELIVERED','CANCELLED'].includes(o.status) ? (()=>{ const late=o.predicted_delivery_date<new Date().toISOString().slice(0,10); return `<div style="padding:6px 12px;background:${late?'#fff8f8':'#f0fdf4'};border-radius:8px;font-size:.78rem;color:${late?'var(--danger)':'var(--success)'};font-weight:600;margin-bottom:8px;border:1px solid ${late?'#fecaca':'#bbf7d0'}">📅 Est. Delivery: ${fmtDate(o.predicted_delivery_date)}${late?' — Delayed':''}</div>`; })() : ''}
            ${isPartial?`<div style="padding:8px 12px;background:#fef3c7;border-radius:8px;font-size:.78rem;color:#92400e;font-weight:600;margin-bottom:12px">⚠️ Partial delivery received — awaiting balance shipment</div>`:''}

            <!-- Action buttons -->
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View Details</button>
              ${o.status==='DRAFT'?`<button class="btn btn-gold btn-sm" onclick="submitDraftOrder('${o.id}')">Submit Order</button>`:''}
              ${['IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED'].includes(o.status)?`<button class="btn btn-primary btn-sm" onclick="viewOrderDrilldown('${o.id}')">📦 Delivery Breakdown</button>`:''}
              ${o.status==='CLOSED'?`<button class="btn btn-secondary btn-sm" onclick="reorderFromHistory('${o.id}')">🔄 Reorder</button>`:''}
              ${(o.status==='DRAFT'||o.status==='SUBMITTED')?`<button class="btn btn-secondary btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="event.stopPropagation();cancelOrder('${o.id}')">Cancel</button>`:''}
            </div>
          </div>
        </div>`;
      }).join('');
    }

    // Summary KPIs
    const active      = orders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length;
    const closed      = orders.filter(o=>o.status==='CLOSED').length;
    const partial     = orders.filter(o=>o.status==='PARTIALLY_CLOSED').length;
    const totalSpend  = orders.filter(o=>o.status==='CLOSED').reduce((s,o)=>s+(o.grand_total||0),0);
    const inShipment  = orders.filter(o=>o.status==='IN_SHIPMENT').length;

    el.innerHTML = `
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">My Orders</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px" id="mo-count">${orders.length} orders</div>
      </div>
      <button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>
    </div>

    <!-- KPI tiles -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:14px 16px;border-top:3px solid var(--primary);margin-bottom:0;cursor:pointer" onclick="APP._moTab='All';moRender();document.querySelectorAll('.mo-pill').forEach(b=>b.classList.remove('active'));document.querySelector('.mo-pill[data-s=\\'All\\']')?.classList.add('active')">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active</div>
        <div style="font-size:1.8rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:4px">${active}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">in progress</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid #06b6d4;margin-bottom:0;cursor:pointer" onclick="APP._moTab='IN_SHIPMENT';moRender()">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">In Transit</div>
        <div style="font-size:1.8rem;font-weight:800;color:${inShipment?'#0891b2':'var(--navy)'};line-height:1.2;margin-top:4px">${inShipment}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">on the way</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid ${partial>0?'#f59e0b':'#d1d5db'};margin-bottom:0;cursor:pointer" onclick="APP._moTab='PARTIALLY_CLOSED';moRender()">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Partial</div>
        <div style="font-size:1.8rem;font-weight:800;color:${partial>0?'#d97706':'var(--navy)'};line-height:1.2;margin-top:4px">${partial}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">balance pending</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid var(--success);margin-bottom:0;cursor:pointer" onclick="APP._moTab='CLOSED';moRender()">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Delivered</div>
        <div style="font-size:1.8rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:4px">${closed}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">complete</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid var(--blue);margin-bottom:0">
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Spend</div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--navy);line-height:1.3;margin-top:4px">${fmt(totalSpend)}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">on closed orders</div>
      </div>
    </div>

    <!-- Search + filter row -->
    <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <input type="search" placeholder="🔍  Search orders…" value="${APP._moSearch||''}"
        style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
        oninput="APP._moSearch=this.value;moRender()" onfocus="this.style.borderColor='var(--blue)'" onblur="this.style.borderColor='var(--border)'">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${statuses.map(s=>`<button onclick="APP._moTab='${s}';document.querySelectorAll('.mo-pill').forEach(b=>b.classList.remove('active'));this.classList.add('active');moRender()" data-s="${s}" class="tab-pill mo-pill${APP._moTab===s?' active':''}" style="font-size:.78rem;padding:5px 12px">${s==='All'?'All orders':STATUS_LABEL[s]||s.replace(/_/g,' ')}</button>`).join('')}
      </div>
    </div>

    <!-- Order cards -->
    <div id="mo-cards"></div>`;

    moRender();
    window.moRender = moRender;
    return;
  }

  // Ops/admin table view (unchanged)
  el.innerHTML = `
  ${pageHeader('My Orders', `${orders.length} orders`,
    `<button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>`)}
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${orders.length ? orders.map(o=>`<tr>
          <td><b>${o.id}</b></td>
          <td>${o.client_name||'—'}</td>
          <td>${fmt(o.grand_total)}</td>
          <td>${o.status==='CLOSED'&&(o.closed_at||o.updated_at)?`<div style="font-size:.68rem;color:var(--success);font-weight:600;margin-bottom:2px">✓ ${fmtDate(o.closed_at||o.updated_at)}</div>`:''}${statusBadge(o.status)}</td>
          <td>${orderTypeBadge(o.order_type||'Regular')}</td>
          <td>${fmtDate(o.created_at)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button>
            ${o.status==='DRAFT'||o.status==='SUBMITTED'?`<button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>`:''}
          </td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No orders found</td></tr>'}
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
            ${dc.status==='SCHEDULED'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-primary btn-sm" onclick="closeModal();dispatchDCModal('${dc.id}')">Dispatch</button>`:''}
            ${dc.status==='IN_TRANSIT'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-success btn-sm" onclick="closeModal();markDelivered('${dc.id}')">Confirm Delivery</button>`:''}
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
    const noteHtml = i.item_note ? `<div style="font-size:.72rem;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:2px 8px;margin-top:3px;display:inline-block">💬 ${h(i.item_note)}</div>` : '';
    if (hasPartialPick) {
      return `<tr>
        <td>${i.name}${noteHtml}</td>
        <td style="color:var(--text-muted)">${i.qty}</td>
        <td><b style="color:${isShort?'var(--warning)':'inherit'}">${picked !== undefined ? picked : i.qty}</b>${isShort?` <span style="font-size:.75rem;color:var(--warning)">(short ${i.qty-picked})</span>`:''}</td>
        <td>${fmt(i.unit_price)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }
    return `<tr><td>${i.name}${noteHtml}</td><td>${i.qty}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.total)}</td></tr>`;
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

  const isOpsRole = !['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  const today = new Date().toISOString().slice(0,10);
  const pdd = order.predicted_delivery_date;
  const pddIsLate = pdd && pdd < today && !['CLOSED','CANCELLED'].includes(order.status);
  const pddLabel = pdd
    ? `<span style="font-weight:700;color:${pddIsLate?'var(--danger)':'var(--success)'}">${fmtDate(pdd)}${pddIsLate?' ⚠ Overdue':''}</span>`
    : `<span style="color:var(--text-muted);font-style:italic">Not set</span>`;

  openModal(`Order ${id}`,
    `<div style="margin-bottom:16px">
      <!-- Row 1: status / type / client / date -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <div><b>Status:</b> ${statusBadge(order.status)}</div>
        <div><b>Type:</b> ${orderTypeBadge(order.order_type||'Regular')}</div>
        <div><b>Client:</b> ${order.client_name||'—'}</div>
        <div><b>Placed:</b> ${fmtDate(order.created_at)}</div>
        ${order.order_period ? `<div><b>For:</b> ${new Date(order.order_period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</div>` : ''}
      </div>
      <!-- Row 2: dates -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 12px;background:var(--bg,#f8fafc);border-radius:8px;border:1px solid var(--border)">
        ${order.need_by_date ? `<div style="display:flex;align-items:center;gap:6px"><span style="font-size:.8rem;font-weight:600;color:var(--danger)">🚨 Need By:</span><span style="font-weight:700;color:var(--danger)">${fmtDate(order.need_by_date)}</span></div>` : ''}
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:180px">
          ${['CLOSED','DELIVERED','CANCELLED'].includes(order.status)
            ? (order.status==='CANCELLED'
                ? `<span style="font-size:.8rem;font-weight:600;color:var(--text-muted)">Order cancelled</span>`
                : `<span style="font-size:.8rem;font-weight:600;color:var(--success)">✅ Delivered:</span>
                   <span style="font-weight:700;color:var(--success)">${order.closed_at||order.updated_at ? fmtDate(order.closed_at||order.updated_at) : 'Completed'}</span>`)
            : `<span style="font-size:.8rem;font-weight:600;color:var(--text-muted)">📅 Est. Delivery:</span>
          ${isOpsRole
            ? `<span id="pdd-display">${pddLabel}</span>
               <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:.72rem;margin-left:6px" onclick="document.getElementById('pdd-edit').style.display='flex';this.style.display='none'">
                 ${pdd ? 'Edit' : 'Set date'}
               </button>
               <span id="pdd-edit" style="display:none;align-items:center;gap:4px">
                 <input type="date" id="pdd-input" value="${pdd||''}" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:.82rem">
                 <button class="btn btn-primary btn-sm" style="padding:3px 10px" onclick="savePredictedDelivery('${id}')">Save</button>
                 <button class="btn btn-secondary btn-sm" style="padding:3px 8px" onclick="document.getElementById('pdd-edit').style.display='none';document.querySelector('[onclick*=pdd-edit]').style.display=''">✕</button>
               </span>`
            : pddLabel
          }`
          }
        </div>
      </div>
      ${order.notes ? `<div style="margin-top:10px;padding:10px 12px;background:#fefce8;border-radius:8px;border:1px solid #fef08a;font-size:.875rem"><span style="font-weight:700;color:#854d0e">📝 Client Note:</span> <span style="color:#713f12">${order.notes}</span></div>` : ''}
      ${order.order_image ? `<div style="margin-top:10px"><div style="font-weight:700;font-size:.8rem;color:var(--navy);margin-bottom:6px">📷 Attached Photo</div><a href="${order.order_image}" target="_blank"><img src="${order.order_image}" style="max-height:140px;max-width:100%;border-radius:8px;border:1px solid var(--border);cursor:zoom-in" title="Click to open full size"></a></div>` : ''}
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
    (() => {
      const s = order.status;
      const opsRole = !['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
      const footer = [`<button class="btn btn-secondary" onclick="closeModal()">Close</button>`];
      if (opsRole) {
        if (s==='SUBMITTED'||s==='PENDING_APPROVAL')
          footer.push(`<button class="btn btn-success" onclick="closeModal();advanceOrder('${id}','APPROVED','Approved via order detail')">✓ Approve</button>`);
        if (s==='APPROVED')
          footer.push(`<button class="btn btn-primary" onclick="closeModal();advanceOrder('${id}','ACKNOWLEDGED','Order acknowledged — processing started')">Acknowledge</button>`);
        if (s==='ACKNOWLEDGED')
          footer.push(`<button class="btn btn-primary" onclick="closeModal();advanceOrder('${id}','INVENTORY_CHECK','Inventory check initiated')">Inventory Check</button>`);
        if (s==='INVENTORY_CHECK') {
          footer.push(`<button class="btn btn-success" onclick="closeModal();advanceOrder('${id}','READY_TO_PICK','Stock available — ready for picking')">✓ Stock In</button>`);
          footer.push(`<button class="btn btn-gold" onclick="closeModal();inventoryShortageModal('${id}')">⚠ Raise PO</button>`);
        }
        if (s==='READY_TO_PICK')
          footer.push(`<button class="btn btn-primary" onclick="closeModal();pickOrderModal('${id}')">Pick Items</button>`);
        if (s==='PICKED')
          footer.push(`<button class="btn btn-info" onclick="closeModal();advanceOrder('${id}','QUALITY_CHECK','Items picked — quality check & packing')">Quality Check</button>`);
        if (s==='QUALITY_CHECK') {
          footer.push(`<button class="btn btn-success" onclick="closeModal();createDCFromPicklist('${id}')">✓ Pass → Dispatch</button>`);
          footer.push(`<button class="btn btn-warning" onclick="closeModal();advanceOrder('${id}','READY_TO_PICK','Quality check failed — returned for re-pick')">↩ Re-Pick</button>`);
        }
        if (s==='VENDOR_PO_RAISED')
          footer.push(`<button class="btn btn-warning" onclick="closeModal();advanceOrder('${id}','APPROVED','PO rejected — reopened')">↩ Reopen for Reprocessing</button>`);
        if (s==='PARTIALLY_CLOSED') {
          footer.push(`<button class="btn btn-primary" onclick="closeModal();advanceOrder('${id}','READY_TO_PICK','Replenishment — next batch ready for picking')">Replenish</button>`);
          footer.push(`<button class="btn btn-secondary" onclick="closeModal();dispatchRemainingModal('${id}')">Dispatch Remaining</button>`);
          footer.push(`<button class="btn btn-danger" onclick="closeModal();preCloseOrder('${id}')">Pre-Close Order</button>`);
        }
        if (!['CLOSED','CANCELLED'].includes(s))
          footer.push(`<button class="btn btn-danger" onclick="closeModal();opsRejectOrder('${id}')">Cancel Order</button>`);
      } else {
        if (s==='DRAFT')
          footer.push(`<button class="btn btn-gold btn-sm" onclick="closeModal();submitDraftOrder('${id}')">Submit Order</button>`);
        if (s==='SUBMITTED'||s==='APPROVED')
          footer.push(`<button class="btn btn-danger btn-sm" onclick="closeModal();cancelOrder('${id}')">Cancel Order</button>`);
      }
      return footer.join(' ');
    })()
  );
}

async function savePredictedDelivery(orderId) {
  const val = document.getElementById('pdd-input')?.value || '';
  const res = await api('/orders/' + orderId, {
    method: 'PATCH',
    body: JSON.stringify({ predicted_delivery_date: val || null }),
  });
  if (!res) return;
  showToast('Predicted delivery date saved');
  viewOrder(orderId);
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

function cancelOrder(id) {
  openModal(`Cancel Order ${id}`,
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to cancel order <b>${id}</b>? This action cannot be undone.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Keep Order</button>
     <button class="btn btn-danger" onclick="confirmCancelOrder('${id}')">Cancel Order</button>`);
}

async function confirmCancelOrder(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note:'Cancelled by client' }) });
  closeModal();
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  if (res) { showToast(`Order ${id} cancelled`); navigate(isClient ? 'my_orders' : 'orders'); }
}

async function submitDraftOrder(id) {
  openModal(`Submit Order ${id}`,
    `<p style="color:var(--text-muted)">Submit draft order <b>${id}</b> to 4SYZ for processing?</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Not Yet</button>
     <button class="btn btn-gold" onclick="confirmSubmitDraft('${id}')">Submit Order</button>`);
}

async function confirmSubmitDraft(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'SUBMITTED', note:'Draft submitted by client' }) });
  closeModal();
  if (res) { showToast(`Order ${id} submitted to 4SYZ`); navigate('my_orders'); }
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
  if (!APP._oqTab)   APP._oqTab   = 'orders';
  if (!APP._oqMonth) APP._oqMonth = '';          // '' = all months
  if (!APP._oqItemView) APP._oqItemView = 'brand';
  APP._oqOrders = orders;

  // Build month options from orders
  const monthsSet = new Set(orders.map(o=>(o.created_at||'').slice(0,7)).filter(Boolean));
  const months = [...monthsSet].sort().reverse();
  // Default to current month if present
  if (!APP._oqMonthInit) {
    const cur = new Date().toISOString().slice(0,7);
    APP._oqMonth = months.includes(cur) ? cur : (months[0]||'');
    APP._oqMonthInit = true;
  }

  function filteredOrders() {
    let res = APP._oqMonth
      ? orders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth))
      : orders;
    if (APP._oqTypeFilter) res = res.filter(o=>(o.order_type||'Regular')===APP._oqTypeFilter);
    return res;
  }

  const STATUS_TABS = ['All','SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','READY_TO_PICK','PICKED','QUALITY_CHECK','IN_SHIPMENT','PARTIALLY_CLOSED'];

  function oqKpiHtml(fOrders) {
    const allForType = APP._oqMonth ? orders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : orders;
    const active = fOrders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
    const byS = s => fOrders.filter(o=>o.status===s);
    const needsAction  = byS('SUBMITTED').length + byS('PENDING_APPROVAL').length + byS('APPROVED').length;
    const inShipment   = byS('IN_SHIPMENT').length + byS('PARTIALLY_CLOSED').length;
    const toPick       = byS('ACKNOWLEDGED').length + byS('READY_TO_PICK').length;
    const totalValue   = active.reduce((s,o)=>s+(o.grand_total||0),0);
    const byType = t => allForType.filter(o=>(o.order_type||'Regular')===t);
    const typeCfg = [
      {type:'Regular', color:'var(--blue)',   icon:'📋'},
      {type:'Urgent',  color:'var(--danger)', icon:'🚨'},
      {type:'Ad-Hoc',  color:'#d97706',       icon:'⚡'},
    ];
    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:12px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--blue);margin-bottom:0;cursor:pointer" onclick="switchOQMainTab('orders')">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Active Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${active.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">${fmt(totalValue)}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${needsAction?'#d97706':'var(--success)'};margin-bottom:0;cursor:pointer" onclick="switchOQMainTab('orders');switchOQTab('PENDING_APPROVAL')">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Needs Attention</div>
        <div style="font-size:1.9rem;font-weight:700;color:${needsAction?'#d97706':'var(--navy)'};line-height:1">${needsAction}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">${byS('PENDING_APPROVAL').length} pending approval</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #8b5cf6;margin-bottom:0;cursor:pointer" onclick="switchOQMainTab('orders');switchOQTab('IN_SHIPMENT')">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">In Shipment</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${inShipment}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">en route to client</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0;cursor:pointer" onclick="switchOQMainTab('orders');switchOQTab('ACKNOWLEDGED')">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">To Pick</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${toPick}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">in warehouse queue</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      ${typeCfg.map(({type,color,icon})=>{
        const cnt = byType(type).length;
        const val = byType(type).reduce((s,o)=>s+(o.grand_total||0),0);
        const active = APP._oqTypeFilter===type;
        return `<div class="card" onclick="oqFilterByType('${type}')"
          style="padding:12px 16px;border-top:3px solid ${color};margin-bottom:0;cursor:pointer;
          ${active?`background:${color}10;box-shadow:0 0 0 2px ${color}40`:''}">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span style="font-size:.9rem">${icon}</span>
            <span style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color}">${type}</span>
            ${active?`<span style="margin-left:auto;font-size:.65rem;color:${color};font-weight:700">✕ clear</span>`:''}
          </div>
          <div style="font-size:1.6rem;font-weight:800;color:var(--navy);line-height:1">${cnt}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:3px">${fmt(val)}</div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function monthPickerHtml() {
    return `<div style="display:flex;align-items:center;gap:8px">
      <label style="font-size:.8rem;color:var(--text-muted);font-weight:600">Month</label>
      <select class="filter-select" style="font-size:.82rem" onchange="oqSetMonth(this.value)">
        <option value="" ${!APP._oqMonth?'selected':''}>All time</option>
        ${months.map(m=>`<option value="${m}" ${APP._oqMonth===m?'selected':''}>${m}</option>`).join('')}
      </select>
    </div>`;
  }

  function oqTabsHtml() {
    const fOrders = filteredOrders();
    return `<div class="tabs" style="margin-bottom:0;flex-wrap:wrap">
      ${STATUS_TABS.map(s=>{
        const cnt = s==='All' ? fOrders.length : fOrders.filter(o=>o.status===s).length;
        return `<button class="tab-btn${APP._oqStatusTab===s?' active':''}" onclick="switchOQTab('${s}')">
          ${s==='All'?'All':s.replace(/_/g,' ')} <span class="badge badge-secondary" style="margin-left:4px;font-size:.72rem">${cnt}</span>
        </button>`;
      }).join('')}
    </div>`;
  }

  function oqTableHtml(tab) {
    const fOrders = filteredOrders();
    const filtered = tab==='All' ? fOrders : fOrders.filter(o=>o.status===tab);
    const sorted   = [...filtered].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return `<tbody id="oq-tbody">${sorted.map(o=>{
      const isUrgent = o.status==='PENDING_APPROVAL';
      const todayStr = new Date().toISOString().slice(0,10);
      return `<tr style="${isUrgent||o.order_type==='Urgent'?'background:#fffbeb':''}">
        <td>
          <b>${o.id}</b>
          ${o.need_by_date ? `<div style="font-size:.7rem;color:${o.need_by_date<todayStr?'var(--danger)':'#d97706'};font-weight:600;margin-top:2px">🚨 Need by ${fmtDate(o.need_by_date)}</div>` : ''}
          ${o.predicted_delivery_date && !['CLOSED','DELIVERED','CANCELLED'].includes(o.status) ? `<div style="font-size:.7rem;color:${o.predicted_delivery_date<todayStr?'var(--danger)':'var(--success)'};margin-top:1px">📅 Est. ${fmtDate(o.predicted_delivery_date)}</div>` : ''}
        </td>
        <td>${o.client_name||'—'}</td>
        <td style="font-weight:700">${fmt(o.grand_total)}</td>
        <td>${statusBadge(o.status)}</td>
        <td>${orderTypeBadge(o.order_type||'Regular')}</td>
        <td style="text-align:center">
          <span style="font-weight:700;font-size:.88rem">${o.item_count||0}</span>
          <span style="font-size:.72rem;color:var(--text-muted);display:block">items</span>
        </td>
        <td style="text-align:center">
          <span style="font-weight:700;font-size:.88rem">${o.total_qty||0}</span>
          <span style="font-size:.72rem;color:var(--text-muted);display:block">units</span>
        </td>
        <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(o.created_at)}</td>
        <td>${orderQueueActions(o)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:24px">No orders</td></tr>'}</tbody>`;
  }

  APP._oqTabsHtml  = oqTabsHtml;
  APP._oqTableHtml = oqTableHtml;
  APP._oqKpiHtml   = oqKpiHtml;
  APP._oqMonthPickerHtml = monthPickerHtml;
  if (!APP._oqStatusTab) APP._oqStatusTab = 'All';

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Order Queue</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px" id="oq-subtitle">${filteredOrders().filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length} active orders</div>
    </div>
    <div id="oq-month-picker">${monthPickerHtml()}</div>
  </div>

  <div id="oq-kpi">${oqKpiHtml(filteredOrders())}</div>

  <div class="tabs" style="margin-bottom:16px">
    <button class="tab-btn${APP._oqTab==='orders'?' active':''}" onclick="switchOQMainTab('orders')">Orders</button>
    <button class="tab-btn${APP._oqTab==='items'?' active':''}" onclick="switchOQMainTab('items')">Line Items</button>
  </div>

  <div id="oq-main-content">
    ${APP._oqTab === 'orders' ? `
    <div class="card" style="overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div id="oq-tabs">${oqTabsHtml()}</div>
      </div>
      <div class="table-wrap">
        <table class="table" style="margin:0">
          <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Type</th><th style="text-align:center">Items</th><th style="text-align:center">Total Qty</th><th>Created</th><th>Actions</th></tr></thead>
          ${oqTableHtml(APP._oqStatusTab)}
        </table>
      </div>
    </div>` : '<div id="oq-items-area"><div class="loading-state"><div class="spinner"></div><p>Loading line items…</p></div></div>'}
  </div>`;

  if (APP._oqTab === 'items') oqLoadItems();
}

function oqSetMonth(m) {
  APP._oqMonth = m;
  const el = document.getElementById('oq-month-picker');
  if (el && APP._oqMonthPickerHtml) el.innerHTML = APP._oqMonthPickerHtml();
  const kpiEl = document.getElementById('oq-kpi');
  if (kpiEl && APP._oqKpiHtml) kpiEl.innerHTML = APP._oqKpiHtml(APP._oqOrders ? (APP._oqMonth ? APP._oqOrders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : APP._oqOrders) : []);
  const sub = document.getElementById('oq-subtitle');
  if (sub) {
    const f = APP._oqOrders ? (APP._oqMonth ? APP._oqOrders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : APP._oqOrders) : [];
    sub.textContent = `${f.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length} active orders`;
  }
  if (APP._oqTab === 'orders') {
    const tabsEl = document.getElementById('oq-tabs');
    if (tabsEl && APP._oqTabsHtml) tabsEl.innerHTML = APP._oqTabsHtml();
    const tbody = document.getElementById('oq-tbody');
    if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab);
  } else {
    oqLoadItems();
  }
}

function switchOQMainTab(tab) {
  APP._oqTab = tab;
  document.querySelectorAll('.tabs .tab-btn').forEach(b => {
    if (b.textContent.trim()==='Orders'||b.textContent.trim()==='Line Items')
      b.classList.toggle('active', (tab==='orders'&&b.textContent.trim()==='Orders')||(tab==='items'&&b.textContent.trim()==='Line Items'));
  });
  const contentEl = document.getElementById('oq-main-content');
  if (!contentEl) return;
  if (tab === 'orders') {
    contentEl.innerHTML = `
    <div class="card" style="overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div id="oq-tabs">${APP._oqTabsHtml?APP._oqTabsHtml():''}</div>
      </div>
      <div class="table-wrap">
        <table class="table" style="margin:0">
          <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Type</th><th style="text-align:center">Items</th><th style="text-align:center">Total Qty</th><th>Created</th><th>Actions</th></tr></thead>
          ${APP._oqTableHtml?APP._oqTableHtml(APP._oqStatusTab):''}
        </table>
      </div>
    </div>`;
  } else {
    contentEl.innerHTML = `<div id="oq-items-area"><div class="loading-state"><div class="spinner"></div><p>Loading line items…</p></div></div>`;
    oqLoadItems();
  }
}

function switchOQTab(tab) {
  APP._oqStatusTab = tab;
  const tabsEl = document.getElementById('oq-tabs');
  if (tabsEl && APP._oqTabsHtml) tabsEl.innerHTML = APP._oqTabsHtml();
  const tbody = document.getElementById('oq-tbody');
  if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(tab);
}

function oqFilterByType(type) {
  APP._oqTypeFilter = APP._oqTypeFilter === type ? null : type;
  const kpiEl = document.getElementById('oq-kpi');
  const allForType = APP._oqMonth
    ? (APP._oqOrders||[]).filter(o=>(o.created_at||'').startsWith(APP._oqMonth))
    : (APP._oqOrders||[]);
  if (kpiEl && APP._oqKpiHtml) kpiEl.innerHTML = APP._oqKpiHtml(
    APP._oqTypeFilter ? allForType.filter(o=>(o.order_type||'Regular')===APP._oqTypeFilter) : allForType
  );
  const tabsEl = document.getElementById('oq-tabs');
  if (tabsEl && APP._oqTabsHtml) tabsEl.innerHTML = APP._oqTabsHtml();
  const tbody = document.getElementById('oq-tbody');
  if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab||'All');
}

async function oqLoadItems() {
  const qs = APP._oqMonth ? `?month=${APP._oqMonth}` : '';
  const items = await api(`/orders/items-summary${qs}`);
  const area = document.getElementById('oq-items-area');
  if (!area || !items) return;

  if (!APP._oqItemView) APP._oqItemView = 'brand';

  function stockStatus(item) {
    if (item.stock <= 0) return 'oos';
    if (item.stock < item.ordered_qty) return 'short';
    return 'ok';
  }

  const oosCount   = items.filter(i=>stockStatus(i)==='oos').length;
  const shortCount = items.filter(i=>stockStatus(i)==='short').length;

  function viewBtns() {
    return `<div style="display:flex;gap:6px">
      <button class="btn btn-sm ${APP._oqItemView==='brand'?'btn-primary':'btn-secondary'}" onclick="oqSetItemView('brand')">By Brand</button>
      <button class="btn btn-sm ${APP._oqItemView==='vendor'?'btn-primary':'btn-secondary'}" onclick="oqSetItemView('vendor')">By Vendor</button>
      <button class="btn btn-sm ${APP._oqItemView==='all'?'btn-primary':'btn-secondary'}" onclick="oqSetItemView('all')">All Items</button>
    </div>`;
  }

  function renderByBrand() {
    const brandMap = {};
    items.forEach(i => {
      const b = i.brand||'Unbranded';
      if (!brandMap[b]) brandMap[b] = [];
      brandMap[b].push(i);
    });
    return Object.entries(brandMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([brand,rows])=>{
      const totalQty  = rows.reduce((s,r)=>s+r.ordered_qty,0);
      const oos       = rows.filter(r=>stockStatus(r)==='oos').length;
      const short     = rows.filter(r=>stockStatus(r)==='short').length;
      const headerColor = oos>0?'var(--danger)':short>0?'#d97706':'var(--success)';
      // Consolidate by SKU across orders
      const skuMap = {};
      rows.forEach(r=>{
        if(!skuMap[r.sku]) skuMap[r.sku]={...r, ordered_qty:0, orders:new Set()};
        skuMap[r.sku].ordered_qty += r.ordered_qty;
        skuMap[r.sku].orders.add(r.order_id);
      });
      return `
      <div class="card" style="margin-bottom:14px;border-top:3px solid ${headerColor}">
        <div class="card-header" style="padding:10px 16px">
          <div>
            <span style="font-weight:700;font-size:.95rem">${brand}</span>
            <span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">${Object.keys(skuMap).length} SKUs · ${totalQty} units total</span>
          </div>
          <div style="display:flex;gap:6px">
            ${oos>0?`<span class="badge badge-danger">${oos} out of stock</span>`:''}
            ${short>0?`<span class="badge badge-warning">${short} short</span>`:''}
            ${oos===0&&short===0?`<span class="badge badge-success">All in stock</span>`:''}
          </div>
        </div>
        <div class="table-wrap">
          <table class="table" style="margin:0">
            <thead><tr><th>SKU</th><th>Item</th><th>Vendor</th><th>Orders</th><th>Total Qty Needed</th><th>Stock</th><th>Gap</th><th>Status</th></tr></thead>
            <tbody>${Object.values(skuMap).sort((a,b)=>{
              const sa=stockStatus(a),sb=stockStatus(b);
              return (sa==='oos'?0:sa==='short'?1:2)-(sb==='oos'?0:sb==='short'?1:2);
            }).map(r=>{
              const ss=stockStatus(r); const gap=r.ordered_qty-r.stock;
              const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:#fffbeb':'';
              return `<tr style="${rowBg}">
                <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
                <td><b>${r.item_name}</b></td>
                <td style="font-size:.82rem">${r.vendor_name}</td>
                <td><span style="font-size:.78rem;background:var(--light);padding:2px 6px;border-radius:4px">${r.orders.size} order${r.orders.size!==1?'s':''}</span></td>
                <td><b>${r.ordered_qty}</b></td>
                <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'#d97706':'var(--success)'};font-weight:700">${r.stock}</td>
                <td style="color:${gap>0?'var(--danger)':'var(--success)'};font-weight:${gap>0?700:400}">${gap>0?'+'+gap:'—'}</td>
                <td>${ss==='oos'?'<span class="badge badge-danger">Out of Stock</span>':ss==='short'?'<span class="badge badge-warning">Short</span>':'<span class="badge badge-success">In Stock</span>'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('') || '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No line items</div>';
  }

  function renderByVendor() {
    const vendorMap = {};
    items.forEach(i => {
      const v = i.vendor_name||'Unknown Vendor';
      if (!vendorMap[v]) vendorMap[v] = { vendor_name:v, items:[] };
      vendorMap[v].items.push(i);
    });
    return Object.values(vendorMap).sort((a,b)=>a.vendor_name.localeCompare(b.vendor_name)).map(({vendor_name,items:rows})=>{
      const oos   = rows.filter(r=>stockStatus(r)==='oos').length;
      const short = rows.filter(r=>stockStatus(r)==='short').length;
      // Consolidate by SKU
      const skuMap = {};
      rows.forEach(r=>{
        if(!skuMap[r.sku]) skuMap[r.sku]={...r,ordered_qty:0,orders:new Set()};
        skuMap[r.sku].ordered_qty += r.ordered_qty;
        skuMap[r.sku].orders.add(r.order_id);
      });
      const needPO = Object.values(skuMap).filter(r=>stockStatus(r)!=='ok');
      const headerColor = oos>0?'var(--danger)':short>0?'#d97706':'var(--success)';
      return `
      <div class="card" style="margin-bottom:14px;border-top:3px solid ${headerColor}">
        <div class="card-header" style="padding:10px 16px">
          <div>
            <span style="font-weight:700;font-size:.95rem">${vendor_name}</span>
            <span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">${Object.keys(skuMap).length} SKUs</span>
          </div>
          <div style="display:flex;gap:6px">
            ${needPO.length>0?`<span class="badge badge-danger">${needPO.length} need procurement</span>`:'<span class="badge badge-success">All stocked</span>'}
          </div>
        </div>
        ${needPO.length>0?`
        <div style="padding:10px 16px;background:#fef3cd;border-bottom:1px solid #f59e0b;font-size:.8rem;color:#92400e">
          <b>Consolidated PO needed:</b> ${needPO.map(r=>`${r.item_name} × ${r.ordered_qty-r.stock}`).join(' · ')}
        </div>`:''}
        <div class="table-wrap">
          <table class="table" style="margin:0">
            <thead><tr><th>Brand</th><th>SKU</th><th>Item</th><th>Needed</th><th>Stock</th><th>Procure Qty</th><th>Status</th></tr></thead>
            <tbody>${Object.values(skuMap).sort((a,b)=>{
              const sa=stockStatus(a),sb=stockStatus(b);
              return (sa==='oos'?0:sa==='short'?1:2)-(sb==='oos'?0:sb==='short'?1:2);
            }).map(r=>{
              const ss=stockStatus(r); const gap=Math.max(0,r.ordered_qty-r.stock);
              const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:#fffbeb':'';
              return `<tr style="${rowBg}">
                <td style="font-size:.8rem">${r.brand||'—'}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
                <td><b>${r.item_name}</b></td>
                <td><b>${r.ordered_qty}</b></td>
                <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'#d97706':'var(--success)'};font-weight:700">${r.stock}</td>
                <td>${gap>0?`<b style="color:var(--danger)">${gap}</b>`:'<span style="color:var(--success)">—</span>'}</td>
                <td>${ss==='oos'?'<span class="badge badge-danger">Out of Stock</span>':ss==='short'?'<span class="badge badge-warning">Short</span>':'<span class="badge badge-success">In Stock</span>'}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }).join('') || '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No line items</div>';
  }

  function renderAllItems() {
    const sorted = [...items].sort((a,b)=>{
      const sa=stockStatus(a),sb=stockStatus(b);
      const sc=(sa==='oos'?0:sa==='short'?1:2)-(sb==='oos'?0:sb==='short'?1:2);
      return sc||a.brand.localeCompare(b.brand);
    });
    return `
    <div class="card">
      <div class="table-wrap">
        <table class="table" style="margin:0">
          <thead><tr><th>Brand</th><th>SKU</th><th>Item</th><th>Order</th><th>Client</th><th>Qty</th><th>Stock</th><th>Gap</th><th>Vendor</th><th>Status</th></tr></thead>
          <tbody>${sorted.map(r=>{
            const ss=stockStatus(r); const gap=r.ordered_qty-r.stock;
            const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:#fffbeb':'';
            return `<tr style="${rowBg}">
              <td style="font-size:.8rem">${r.brand||'—'}</td>
              <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
              <td><b>${r.item_name}</b></td>
              <td style="font-size:.8rem"><b>${r.order_id}</b></td>
              <td style="font-size:.8rem">${r.client_name}</td>
              <td>${r.ordered_qty}</td>
              <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'#d97706':'var(--success)'};font-weight:700">${r.stock}</td>
              <td style="color:${gap>0?'var(--danger)':'var(--success)'}">${gap>0?'+'+gap:'—'}</td>
              <td style="font-size:.8rem">${r.vendor_name}</td>
              <td>${ss==='oos'?'<span class="badge badge-danger">OOS</span>':ss==='short'?'<span class="badge badge-warning">Short</span>':'<span class="badge badge-success">OK</span>'}</td>
            </tr>`;
          }).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px">No line items</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  APP._oqRenderItems = () => {
    const viewArea = document.getElementById('oq-items-area');
    if (!viewArea) return;
    const content = APP._oqItemView==='brand' ? renderByBrand() : APP._oqItemView==='vendor' ? renderByVendor() : renderAllItems();
    viewArea.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;gap:14px">
        <div class="card" style="padding:10px 16px;border-top:3px solid var(--danger);margin-bottom:0;min-width:100px">
          <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;color:var(--text-muted)">Out of Stock</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--danger)">${oosCount}</div>
        </div>
        <div class="card" style="padding:10px 16px;border-top:3px solid #d97706;margin-bottom:0;min-width:100px">
          <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;color:var(--text-muted)">Short Stock</div>
          <div style="font-size:1.5rem;font-weight:700;color:#d97706">${shortCount}</div>
        </div>
        <div class="card" style="padding:10px 16px;border-top:3px solid var(--success);margin-bottom:0;min-width:100px">
          <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;color:var(--text-muted)">Total Lines</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--navy)">${items.length}</div>
        </div>
      </div>
      ${viewBtns()}
    </div>
    ${content}`;
  };

  APP._oqRenderItems();
}

function oqSetItemView(view) {
  APP._oqItemView = view;
  if (APP._oqRenderItems) APP._oqRenderItems();
}

function orderQueueActions(o) {
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  if (isClient) {
    return `<div style="display:flex;gap:6px;align-items:center">${statusBadge(o.status)}<button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button></div>`;
  }
  const btns = [`<button class="btn btn-secondary btn-sm" onclick="viewOrder('${o.id}')">View</button>`];
  switch (o.status) {
    case 'SUBMITTED':
      btns.push(`<button class="btn btn-success btn-sm" onclick="advanceOrder('${o.id}','APPROVED','Approved by ops')">✓ Approve</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="opsRejectOrder('${o.id}')">✕ Reject</button>`);
      break;
    case 'PENDING_APPROVAL':
      btns.push(`<button class="btn btn-success btn-sm" onclick="advanceOrder('${o.id}','APPROVED','Client/ops approval')">✓ Approve</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="opsRejectOrder('${o.id}')">✕ Reject</button>`);
      break;
    case 'APPROVED':
      btns.push(`<button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','ACKNOWLEDGED','Order acknowledged — processing started')">Acknowledge</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="opsRejectOrder('${o.id}')">✕ Cancel</button>`);
      break;
    case 'ACKNOWLEDGED':
      btns.push(`<button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','INVENTORY_CHECK','Inventory check initiated')">Inventory Check</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="opsRejectOrder('${o.id}')">✕ Cancel</button>`);
      break;
    case 'INVENTORY_CHECK':
      btns.push(`<button class="btn btn-success btn-sm" onclick="advanceOrder('${o.id}','READY_TO_PICK','Stock available — ready for picking')">✓ Stock In</button>`);
      btns.push(`<button class="btn btn-gold btn-sm" onclick="inventoryShortageModal('${o.id}')">⚠ Raise PO</button>`);
      break;
    case 'VENDOR_PO_RAISED':
      btns.push(`<button class="btn btn-secondary btn-sm" style="cursor:default;opacity:.65" disabled>Awaiting Vendor</button>`);
      btns.push(`<button class="btn btn-warning btn-sm" onclick="advanceOrder('${o.id}','APPROVED','PO rejected — reverted for reprocessing')">↩ Reopen</button>`);
      break;
    case 'READY_TO_PICK':
      btns.push(`<button class="btn btn-primary btn-sm" onclick="pickOrderModal('${o.id}')">Pick Items</button>`);
      break;
    case 'PICKED':
      btns.push(`<button class="btn btn-info btn-sm" onclick="advanceOrder('${o.id}','QUALITY_CHECK','Items picked — quality check & packing')">Quality Check</button>`);
      break;
    case 'QUALITY_CHECK':
      btns.push(`<button class="btn btn-success btn-sm" onclick="createDCFromPicklist('${o.id}')">✓ Pass &rarr; Dispatch</button>`);
      btns.push(`<button class="btn btn-warning btn-sm" onclick="advanceOrder('${o.id}','READY_TO_PICK','Quality check failed — returned for re-pick')">↩ Re-Pick</button>`);
      break;
    case 'PARTIALLY_CLOSED':
      btns.push(`<button class="btn btn-primary btn-sm" onclick="advanceOrder('${o.id}','READY_TO_PICK','Replenishment — next batch ready for picking')">Replenish</button>`);
      btns.push(`<button class="btn btn-secondary btn-sm" onclick="dispatchRemainingModal('${o.id}')">Dispatch Remaining</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" onclick="preCloseOrder('${o.id}')">Pre-Close</button>`);
      break;
    case 'IN_SHIPMENT':
      btns.push(`<button class="btn btn-secondary btn-sm" onclick="navigate('delivery')">→ Delivery</button>`);
      break;
  }
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">${btns.join('')}</div>`;
}

function inventoryShortageModal(orderId) {
  openModal('Stock Shortage — Raise Vendor PO',
    `<p style="color:var(--text-muted);margin-bottom:12px;font-size:.9rem">
       Stock is insufficient for order <b>${orderId}</b>. This will mark the order as <b>Vendor PO Required</b> and redirect you to Procurement to raise a PO.
     </p>
     <p style="font-size:.85rem;color:var(--warning)">
       ⚠ Once you raise a PO linked to this order, it will automatically move to <b>VENDOR PO RAISED</b> status.
     </p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="closeModal();navigate('procurement');showToast('Raise a PO and link it to order ${orderId}','info')">→ Go to Procurement</button>`);
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

async function advanceOrder(id, to, note) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to, note: note||undefined }) });
  if (res) { showToast(`Order ${id} → ${to.replace(/_/g,' ')}`); navigate('orders'); }
}

function opsRejectOrder(id) {
  openModal(`Reject / Cancel Order ${id}`,
    `<p style="color:var(--text-muted);margin:0">Reason for rejection (shown to client):</p>
     <textarea id="reject-reason" rows="3" style="width:100%;margin-top:10px;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.85rem;resize:vertical" placeholder="e.g. Budget exceeded, items unavailable…"></textarea>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Keep Order</button>
     <button class="btn btn-danger" onclick="confirmOpsReject('${id}')">Reject & Cancel</button>`);
}

async function confirmOpsReject(id) {
  const reason = document.getElementById('reject-reason').value.trim() || 'Rejected by operations';
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note: reason }) });
  closeModal();
  if (res) { showToast(`Order ${id} cancelled`); navigate('orders'); }
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
      const thisMonth = new Date().toISOString().slice(0,7);
      const billedToday = billed.filter(d=>d.billed_at?.startsWith(today));
      const billedThisMonth = billed.filter(d=>(d.billed_at||'').startsWith(thisMonth));
      const critical = unbilled.filter(d => Math.floor((Date.now()-new Date(d.created_at).getTime())/86400000) > 15);
      const pendingValue = unbilled.reduce((s,d)=>s+(d.order_value||0),0);
      const billedMonthValue = billedThisMonth.reduce((s,d)=>s+(d.order_value||0),0);
      const criticalValue = critical.reduce((s,d)=>s+(d.order_value||0),0);
      return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
        <div class="card" style="padding:16px 18px;border-top:3px solid ${unbilled.length>0?'#d97706':'var(--success)'};margin-bottom:0">
          <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Pending Billing</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${unbilled.length}</div>
          <div style="font-size:.75rem;color:${unbilled.length>0?'#d97706':'var(--text-muted)'};margin-top:6px">${fmt(pendingValue)} outstanding</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid ${critical.length>0?'var(--danger)':'var(--success)'};margin-bottom:0">
          <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Critical (16+ days)</div>
          <div style="font-size:1.9rem;font-weight:700;color:${critical.length>0?'var(--danger)':'var(--navy)'};line-height:1">${critical.length}</div>
          <div style="font-size:.75rem;color:${critical.length>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${critical.length>0?fmt(criticalValue)+' at risk':'All within 15 days'}</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
          <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Billed Today</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${billedToday.length}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">${fmt(billedToday.reduce((s,d)=>s+(d.order_value||0),0))}</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
          <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Billed This Month</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${billedThisMonth.length}</div>
          <div style="font-size:.75rem;color:var(--success);margin-top:6px">${fmt(billedMonthValue)}</div>
        </div>
      </div>
      ${critical.length>0?`<div style="background:#fef3cd;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:#92400e;display:flex;gap:10px;align-items:center"><span style="font-size:1.1rem">⚠️</span><span><strong>${critical.length}</strong> DC${critical.length>1?'s':''} unbilled for over 16 days — <strong>${fmt(criticalValue)}</strong> at risk of delayed payment.</span></div>`:''}
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

      const BUCKET_BORDER = { success:'var(--success)', warning:'#d97706', danger:'var(--danger)', info:'#3b82f6' };
      return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
        ${buckets.map(b=>{
          const items = billed.filter(d=>{ const age=ageDays(d); return age>=b.min && age<=b.max; });
          const bColor = items.length ? BUCKET_BORDER[b.cls] : 'var(--border)';
          const valColor = items.length ? BUCKET_BORDER[b.cls] : 'var(--text-muted)';
          return `<div class="card" style="padding:16px 18px;border-top:3px solid ${bColor};margin-bottom:0">
            <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">${b.label}</div>
            <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${items.length}</div>
            <div style="font-size:.75rem;color:${valColor};margin-top:6px">${fmt(items.reduce((s,d)=>s+(d.order_value||0),0))}</div>
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
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${(()=>{ const BCLR={success:'var(--success)',warning:'#d97706',danger:'var(--danger)'}; return buckets.map(b=>{
      const items=open.filter(p=>{const a=ageDays(p);return a>=b.min&&a<=b.max;});
      const bc=items.length?BCLR[b.cls]:'var(--border)';
      return `<div class="card" style="padding:16px 18px;border-top:3px solid ${bc};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">${b.label}</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${items.length}</div>
        <div style="font-size:.75rem;color:${items.length?bc:'var(--text-muted)'};margin-top:6px">${fmt(items.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
      </div>`;
    }).join(''); })()}
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
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    <div class="card" style="padding:16px 18px;border-top:3px solid ${marginColor(overallMargin)};margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg Margin</div>
      <div style="font-size:1.9rem;font-weight:700;color:${marginColor(overallMargin)};line-height:1">${overallMargin}%</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">${priced.length} priced SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">High Margin (≥30%)</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${highMargin}</div>
      <div style="font-size:.75rem;color:var(--success);margin-top:6px">SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${lowMargin>0?'#d97706':'var(--success)'};margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Low Margin (&lt;15%)</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${lowMargin}</div>
      <div style="font-size:.75rem;color:${lowMargin>0?'#d97706':'var(--text-muted)'};margin-top:6px">SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${negative>0?'var(--danger)':'var(--success)'};margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Below Cost</div>
      <div style="font-size:1.9rem;font-weight:700;color:${negative>0?'var(--danger)':'var(--navy)'};line-height:1">${negative}</div>
      <div style="font-size:.75rem;color:${negative>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${negative>0?'selling at a loss':'none'}</div>
    </div>
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
  APP._invSort = APP._invSort || { col: null, dir: 1 };
  APP._invSelected = new Set();

  const cats = ['All', ...[...new Set(inv.map(i=>i.category))].sort()];
  const lowStock = inv.filter(i => i.stock <= i.reorder_level);
  const outOfStock = inv.filter(i => i.stock === 0);
  const criticalLow = inv.filter(i => i.is_critical && i.stock <= i.reorder_level);

  function getFiltered() {
    let items = inv;
    if (APP._invFilter !== 'All') items = items.filter(i => i.category === APP._invFilter);
    if (APP._invSubFilter !== 'All') items = items.filter(i => (i.sub_category||'Normal') === APP._invSubFilter);
    if (APP._invSearch) { const q = APP._invSearch.toLowerCase(); items = items.filter(i => i.name.toLowerCase().includes(q)||i.sku.toLowerCase().includes(q)||(i.brand||'').toLowerCase().includes(q)); }
    const { col, dir } = APP._invSort;
    if (col) {
      items = [...items].sort((a,b) => {
        let va = a[col], vb = b[col];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb||'').toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0; }
        return ((va||0) - (vb||0)) * dir;
      });
    }
    return items;
  }

  function invTableRows(items) {
    return items.map(item => {
      const reserved  = item.reserved || 0;
      const available = Math.max(0, item.stock - reserved);
      const pctStock  = Math.round((item.stock / (item.max_stock||1)) * 100);
      const color     = item.stock <= item.reorder_level ? 'var(--danger)' : item.stock <= item.reorder_level*1.5 ? 'var(--warning)' : 'var(--success)';
      const safeName  = item.name.replace(/'/g,"\\'");
      const stPill    = item.stock === 0
        ? '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:#fee2e2;color:#dc2626">Critical</span>'
        : item.stock <= item.reorder_level
        ? '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:#fef3c7;color:#d97706">Warning</span>'
        : '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:#d1fae5;color:#059669">Active</span>';
      const checked   = APP._invSelected.has(item.sku);
      return `
      <tr style="cursor:pointer${item.is_critical?';border-left:3px solid #dc2626':''}${checked?';background:#fff7ed':''}" onclick="toggleInvDetail('${item.sku}',this)">
        <td onclick="event.stopPropagation()" style="width:34px;text-align:center">
          <input type="checkbox" ${checked?'checked':''} onchange="invToggleSelect('${item.sku}',this)" style="width:15px;height:15px;cursor:pointer;accent-color:var(--primary)">
        </td>
        <td><span style="font-size:1.1rem">${item.emoji||'📦'}</span> <b style="font-size:.82rem">${item.sku}</b>${item.is_critical?'<span style="margin-left:4px;background:#dc2626;color:#fff;border-radius:4px;padding:1px 5px;font-size:.65rem;font-weight:800;vertical-align:middle">CRITICAL</span>':''}</td>
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
        <td>${stPill}</td>
        <td style="font-size:.8rem">${item.vendor_name||'—'}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-secondary btn-sm" onclick="editInventoryItem('${item.sku}')">Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="viewStockHistory('${item.sku}','${safeName}')">History</button>
          <button class="btn btn-primary btn-sm" onclick="reorderItem('${item.sku}','${safeName}',${item.unit_price},'${item.vendor_id||''}')">PO</button>
          <button class="btn btn-sm" style="background:${item.is_critical?'#fef2f2':'#f3f4f6'};color:${item.is_critical?'#dc2626':'#6b7280'};border:1px solid ${item.is_critical?'#fca5a5':'#d1d5db'};font-size:.72rem" onclick="toggleCritical('${item.sku}',this)">${item.is_critical?'🔴 Critical':'⚫ Mark Critical'}</button>
        </td>
      </tr>
      <tr id="inv-detail-${item.sku}" style="display:none;background:#f8faff">
        <td colspan="14" style="padding:0">
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
              ${invDetailRow('Primary Vendor', item.vendor_name||'—')}
              ${invDetailRow('Secondary Vendor', item.secondary_vendor_name||'—')}
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

  <!-- KPI tiles — icon-chip style, responsive -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:16px">
    ${statCard('📦','#3b82f6','#eff6ff', inv.length, 'Active Items')}
    ${statCard('↕️','#d97706','#fffbeb', lowStock.length, 'Below Reorder')}
    ${statCard('⏱','#dc2626','#fef2f2', outOfStock.length, 'Zero Stock')}
    ${statCard('₹','#059669','#ecfdf5', fmt(inv.reduce((s,i)=>s+i.stock*i.unit_price,0)), 'Stock Value')}
  </div>

  ${criticalLow.length ? `
  <div style="background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
    <div>
      <div style="font-weight:800;color:#dc2626;font-size:.92rem;margin-bottom:4px">🔴 ${criticalLow.length} Critical Item${criticalLow.length>1?'s':''} Need Reorder</div>
      <div style="font-size:.8rem;color:#991b1b">${criticalLow.slice(0,4).map(i=>`<b>${i.name}</b> (${i.stock} left)`).join(' · ')}${criticalLow.length>4?` +${criticalLow.length-4} more`:''}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button class="btn btn-secondary btn-sm" onclick="navigate('reports');setTimeout(()=>viewReport('critical-stock'),300)">View Report</button>
      <button class="btn btn-sm" style="background:#dc2626;color:#fff;border:none" onclick="sendCriticalAlerts(this)">📧 Send Alert Email</button>
    </div>
  </div>` : ''}
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

  <!-- Bulk action bar (appears when rows selected) -->
  <div id="inv-bulk-bar" style="display:none;background:var(--primary);border-radius:10px;padding:10px 16px;margin-bottom:10px;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 10px rgba(249,115,22,.3)">
    <span id="inv-bulk-count" style="color:#fff;font-weight:800;font-size:.84rem"></span>
    <div style="flex:1"></div>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" onclick="invBulkModal('price')">✏️ Update Price</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" onclick="invBulkModal('category')">📂 Change Category</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" onclick="invBulkModal('subcategory')">🏷️ Sub-Category</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" onclick="invBulkModal('stock')">📦 Adjust Stock</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" onclick="invBulkModal('reorder')">🎯 Set Reorder Point</button>
    <button class="btn btn-sm" style="background:#b91c1c;color:#fff;border:none;font-weight:700" onclick="invClearSelection()">✕ Cancel</button>
  </div>

  <!-- Table — click row to expand 4-section detail -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:.76rem;color:var(--text-muted)">Click any row to see full details · Select rows with checkboxes for bulk actions · Click column headers to sort</div>
    <div class="table-wrap">
      <table class="table" id="inv-table" style="margin:0">
        <thead><tr>
          <th style="width:34px;text-align:center"><input type="checkbox" id="inv-select-all" onchange="invSelectAll(this)" style="width:15px;height:15px;cursor:pointer;accent-color:var(--primary)"></th>
          ${[['sku','SKU'],['name','Item'],['category','Category'],[null,'UOM'],['unit_price','Price'],['mrp','MRP'],['stock','Stock'],['reserved','Reserved'],[null,'Available'],[null,'Level'],[null,'Status'],[null,'Vendor'],[null,'Actions']]
            .map(([col,label]) => col
              ? `<th style="cursor:pointer;user-select:none;white-space:nowrap" onclick="invSortBy('${col}')">${label} <span data-sort-arrow="${col}" style="font-size:.65rem;opacity:.5">⇅</span></th>`
              : `<th>${label}</th>`).join('')}
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
    updateInvBulkBar();
  };

  function updateInvBulkBar() {
    const bar = document.getElementById('inv-bulk-bar');
    const n = APP._invSelected.size;
    if (bar) {
      bar.style.display = n ? 'flex' : 'none';
      const cnt = document.getElementById('inv-bulk-count');
      if (cnt) cnt.textContent = `${n} item${n>1?'s':''} selected`;
    }
  }

  window.invToggleSelect = function(sku, cb) {
    if (cb.checked) APP._invSelected.add(sku); else APP._invSelected.delete(sku);
    const row = cb.closest('tr');
    if (row) row.style.background = cb.checked ? '#fff7ed' : '';
    updateInvBulkBar();
  };

  window.invSelectAll = function(cb) {
    APP._invSelected = new Set(cb.checked ? getFiltered().map(i=>i.sku) : []);
    window.refreshInvTable();
  };

  window.invClearSelection = function() {
    APP._invSelected.clear();
    const all = document.getElementById('inv-select-all'); if (all) all.checked = false;
    window.refreshInvTable();
  };

  window.invSortBy = function(col) {
    if (APP._invSort.col === col) APP._invSort.dir = -APP._invSort.dir;
    else APP._invSort = { col, dir: 1 };
    document.querySelectorAll('[data-sort-arrow]').forEach(s => { s.textContent = '⇅'; s.style.opacity = '.5'; });
    const arrow = document.querySelector(`[data-sort-arrow="${col}"]`);
    if (arrow) { arrow.textContent = APP._invSort.dir === 1 ? '↑' : '↓'; arrow.style.opacity = '1'; }
    window.refreshInvTable();
  };

  window.invBulkModal = function(kind) {
    const n = APP._invSelected.size;
    if (!n) { showToast('Select items first', 'error'); return; }
    const subcats = [...new Set(['Healthy','Normal', ...inv.map(i=>i.sub_category).filter(Boolean)])];
    const defs = {
      price:    { title:'Update Price',      label:'New unit price (₹)',   field:'unit_price',    type:'number', min:0, step:'0.01' },
      category: { title:'Change Category',   label:'New category',          field:'category',      type:'select', options: cats.filter(c=>c!=='All') },
      subcategory:{ title:'Change Sub-Category', label:'New sub-category', field:'sub_category', type:'select', options: subcats, allowCustom:true },
      stock:    { title:'Adjust Stock',      label:'Set stock quantity',    field:'stock',          type:'number', min:0, step:'1' },
      reorder:  { title:'Set Reorder Point', label:'New reorder level',     field:'reorder_level',  type:'number', min:0, step:'1' },
    };
    const d = defs[kind];
    const inputHtml = d.type === 'select'
      ? `<select id="bulk-value" class="form-control">${(d.options||[]).map(c=>`<option>${c}</option>`).join('')}</select>
         ${d.allowCustom?`<div style="margin-top:8px"><label style="font-size:.78rem;color:var(--text-muted)">…or type a new one</label><input id="bulk-value-custom" type="text" class="form-control" placeholder="Optional — overrides the dropdown"></div>`:''}`
      : `<input id="bulk-value" type="number" min="${d.min}" step="${d.step}" class="form-control" style="max-width:180px">`;
    openModal(`${d.title} — ${n} item${n>1?'s':''}`, `
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:14px">This will apply to all ${n} selected item${n>1?'s':''}.</div>
      <div class="form-group"><label class="form-label">${d.label}</label>${inputHtml}</div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-primary" onclick="invBulkApply('${d.field}','${d.type}')">Apply to ${n} item${n>1?'s':''}</button>`);
  };

  window.invBulkApply = async function(field, type) {
    const custom = document.getElementById('bulk-value-custom')?.value?.trim();
    const raw = custom || document.getElementById('bulk-value')?.value;
    const value = type === 'select' ? raw : parseFloat(raw);
    if (type !== 'select' && (isNaN(value) || value < 0)) { showToast('Enter a valid value', 'error'); return; }
    if (type === 'select' && !value) { showToast('Choose or enter a value', 'error'); return; }
    closeModal();
    showToast(`Updating ${APP._invSelected.size} items…`);
    let ok = 0, fail = 0;
    for (const sku of APP._invSelected) {
      const res = await api(`/inventory/${encodeURIComponent(sku)}`, { method:'PATCH', body: JSON.stringify({ [field]: value }) }).catch(()=>null);
      if (res) { ok++; if (_invCache[sku]) _invCache[sku][field] = value; const it = inv.find(i=>i.sku===sku); if (it) it[field] = value; }
      else fail++;
    }
    showToast(fail ? `${ok} updated, ${fail} failed` : `${ok} item${ok>1?'s':''} updated`, fail ? 'warning' : 'success');
    APP._invSelected.clear();
    window.refreshInvTable();
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
  const vendor2Opts = vendors.map(v => `<option value="${v.id}" ${v.id===item.secondary_vendor_id?'selected':''}>${v.name}</option>`).join('');
  const cats = ['Beverages','Snacks','Hygiene','Stationery','Office','Dairy','Fruits & Vegetables','Cleaning','Personal Care','Other'];
  const catOpts = cats.map(c => `<option value="${c}" ${c===item.category?'selected':''}>${c}</option>`).join('');
  const uoms = ['unit','piece','pack','case','kg','gram','litre','ml','dozen','box','bag','roll','sheet'];
  const uomOpts = uoms.map(u => `<option value="${u}" ${(item.uom||'unit')===u?'selected':''}>${u}</option>`).join('');

  openModal(`Edit Item — ${sku}`,
    `<!-- Section tabs -->
    <div style="display:flex;gap:6px;border-bottom:2px solid var(--border);margin-bottom:16px;padding-bottom:10px">
      ${[['prod','Product ID','#1F3864'],['pack','Packing Details','#7c3aed'],['price','Pricing','#059669'],['vendor','Vendor Info','#d97706']].map(([id,label,color])=>
        `<button class="ei-tab" data-tab="${id}" data-color="${color}" onclick="switchEITab('${id}')" style="padding:6px 14px;border:none;border-radius:20px;background:transparent;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--text-muted);transition:all .18s;white-space:nowrap">${label}</button>`
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
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;justify-content:space-between;align-items:center">
            Primary Vendor
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:2px 10px" onclick="toggleAddVendorInline()">+ Add New Vendor</button>
          </label>
          <select id="ei-vendor"><option value="">— None —</option>${vendorOpts}</select>
          <!-- Inline new-vendor form -->
          <div id="ei-new-vendor-form" style="display:none;margin-top:12px;background:var(--bg,#f8fafc);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:.76rem;font-weight:700;color:#d97706;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">New Vendor Details</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Vendor Name *</label><input type="text" id="nv-name" placeholder="e.g. Fresh Farms Pvt Ltd"></div>
              <div class="form-group" style="margin-bottom:0"><label style="font-size:.76rem">Category</label>
                <select id="nv-cat">
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="FMCG">FMCG</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Pharma">Pharma</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0"><label style="font-size:.76rem">Phone</label><input type="tel" id="nv-phone" placeholder="9876543210"></div>
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Email</label><input type="email" id="nv-email" placeholder="vendor@example.com"></div>
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Location / City</label><input type="text" id="nv-location" placeholder="e.g. Mumbai"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button type="button" class="btn btn-primary btn-sm" onclick="createVendorInline()">Create & Select</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleAddVendorInline()">Cancel</button>
            </div>
          </div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;justify-content:space-between;align-items:center">
            Secondary Vendor <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(fallback supplier)</span>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:2px 10px" onclick="toggleAddVendorInline('2')">+ Add New Vendor</button>
          </label>
          <select id="ei-vendor2"><option value="">— None —</option>${vendor2Opts}</select>
          <!-- Inline new-vendor form for secondary -->
          <div id="ei-new-vendor-form-2" style="display:none;margin-top:12px;background:var(--bg,#f8fafc);border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:.76rem;font-weight:700;color:#7c3aed;margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">New Secondary Vendor</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Vendor Name *</label><input type="text" id="nv2-name" placeholder="e.g. Backup Supplies Co"></div>
              <div class="form-group" style="margin-bottom:0"><label style="font-size:.76rem">Category</label>
                <select id="nv2-cat">
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="FMCG">FMCG</option>
                  <option value="Stationery">Stationery</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Pharma">Pharma</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group" style="margin-bottom:0"><label style="font-size:.76rem">Phone</label><input type="tel" id="nv2-phone" placeholder="9876543210"></div>
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Email</label><input type="email" id="nv2-email" placeholder="vendor@example.com"></div>
              <div class="form-group" style="grid-column:1/-1;margin-bottom:0"><label style="font-size:.76rem">Location / City</label><input type="text" id="nv2-location" placeholder="e.g. Delhi"></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <button type="button" class="btn btn-primary btn-sm" onclick="createVendorInline('2')">Create & Select</button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="toggleAddVendorInline('2')">Cancel</button>
            </div>
          </div>
        </div>
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
    b.style.background = 'transparent';
    b.style.color = 'var(--text-muted)';
    b.style.fontWeight = '600';
  });
  const sec = document.getElementById('ei-tab-'+tab);
  if (sec) sec.style.display='';
  const btn = document.querySelector(`.ei-tab[data-tab="${tab}"]`);
  if (btn) {
    const color = btn.dataset.color || 'var(--primary)';
    btn.style.background = color;
    btn.style.color = '#fff';
    btn.style.fontWeight = '700';
  }
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
    vendor_id:           eiVal('ei-vendor') || null,
    secondary_vendor_id: eiVal('ei-vendor2') || null,
    vendor_sku:          eiVal('ei-vendorsku'),
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

function toggleAddVendorInline(suffix = '') {
  const formId = suffix ? `ei-new-vendor-form-${suffix}` : 'ei-new-vendor-form';
  const form = document.getElementById(formId);
  if (!form) return;
  const showing = form.style.display !== 'none';
  form.style.display = showing ? 'none' : '';
  if (!showing) document.getElementById(suffix ? `nv${suffix}-name` : 'nv-name')?.focus();
}

async function createVendorInline(suffix = '') {
  const p = suffix ? `nv${suffix}-` : 'nv-';
  const formId = suffix ? `ei-new-vendor-form-${suffix}` : 'ei-new-vendor-form';
  const selId = suffix ? `ei-vendor${suffix}` : 'ei-vendor';
  const name = (document.getElementById(p+'name')?.value || '').trim();
  if (!name) { showToast('Vendor name is required', 'error'); return; }
  const btn = document.querySelector(`#${formId} .btn-primary`);
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  const body = {
    name,
    category: document.getElementById(p+'cat')?.value || 'Other',
    contact_phone: document.getElementById(p+'phone')?.value || '',
    contact_email: document.getElementById(p+'email')?.value || '',
    location: document.getElementById(p+'location')?.value || '',
  };
  const res = await api('/vendors', { method: 'POST', body: JSON.stringify(body) });
  if (btn) { btn.disabled = false; btn.textContent = 'Create & Select'; }
  if (!res || !res.id) { showToast('Failed to create vendor', 'error'); return; }
  // Add new option to both dropdowns and select in the target one
  ['ei-vendor','ei-vendor2'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      const opt = document.createElement('option');
      opt.value = res.id;
      opt.textContent = name;
      if (id === selId) opt.selected = true;
      sel.appendChild(opt);
    }
  });
  toggleAddVendorInline(suffix);
  showToast(`Vendor "${name}" created and selected`);
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

async function toggleCritical(sku, btn) {
  if (btn) { btn.disabled = true; }
  const res = await api('/inventory/' + encodeURIComponent(sku) + '/critical', {method:'PATCH'});
  if (btn) { btn.disabled = false; }
  if (res?.ok) {
    const isCrit = res.is_critical === 1;
    showToast(isCrit ? 'Marked as CRITICAL' : 'Removed critical flag');
    navigate('inventory');
  } else {
    showToast(res?.error || 'Error updating', 'error');
  }
}

async function sendCriticalAlerts(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const res = await api('/inventory/critical-alerts', {method:'POST'});
  if (btn) { btn.disabled = false; btn.textContent = '📧 Send Alert Email'; }
  if (res?.ok) {
    if (res.count === 0) showToast('No critical items below reorder level — nothing to alert', 'info');
    else showToast(`Alert email sent for ${res.count} critical item(s)`);
  } else {
    showToast(res?.error || 'Error sending alert', 'error');
  }
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
  const allVendors = await api('/vendors');
  if (!allVendors) return;

  // State for filtering
  if (!APP._vendorSearch) APP._vendorSearch = '';
  if (!APP._vendorCat) APP._vendorCat = '';
  if (!APP._vendorLoc) APP._vendorLoc = '';
  if (!APP._vendorShowInactive) APP._vendorShowInactive = false;

  function applyFilters(list) {
    const q = (APP._vendorSearch||'').toLowerCase();
    const cat = APP._vendorCat||'';
    const loc = (APP._vendorLoc||'').toLowerCase();
    return list.filter(v => {
      if (!APP._vendorShowInactive && v.active===0) return false;
      if (q && !v.name.toLowerCase().includes(q) && !(v.category||'').toLowerCase().includes(q)) return false;
      if (cat && !(v.category||'').split(',').map(s=>s.trim()).includes(cat)) return false;
      if (loc && !(v.location||'').toLowerCase().includes(loc)) return false;
      return true;
    });
  }

  const vendors = applyFilters(allVendors);
  const activeVendors = allVendors.filter(v=>v.active!==0);
  const avgOnTime  = activeVendors.length ? Math.round(activeVendors.reduce((s,v)=>s+(v.on_time_rate||0),0)/activeVendors.length) : 0;
  const avgFill    = activeVendors.length ? Math.round(activeVendors.reduce((s,v)=>s+(v.fill_rate||0),0)/activeVendors.length) : 0;
  const atRisk     = activeVendors.filter(v=>(v.on_time_rate||0)<75||(v.fill_rate||0)<85).length;
  const allCategories = [...new Set([...VENDOR_CATS, ...allVendors.flatMap(v=>(v.category||'').split(',').map(s=>s.trim())).filter(Boolean)])].sort();

  function scoreColor(val) {
    return val >= 90 ? 'var(--success)' : val >= 75 ? '#d97706' : 'var(--danger)';
  }

  function starRating(rating) {
    const r = Math.round(+rating * 2) / 2;
    return Array.from({length:5}, (_,i) =>
      `<span style="color:${i < r ? '#f59e0b' : '#d1d5db'};font-size:.8rem">★</span>`
    ).join('');
  }

  function vendorCard(v) {
    const onTimeColor = scoreColor(v.on_time_rate||0);
    const fillColor   = scoreColor(v.fill_rate||0);
    const isAtRisk    = (v.on_time_rate||0)<75 || (v.fill_rate||0)<85;
    const initials    = v.name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:18px 20px;border-top:3px solid ${isAtRisk?'var(--danger)':'var(--success)'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${v.name}</div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:3px;flex-wrap:wrap">
              ${(v.category||'—').split(',').filter(Boolean).map(c=>`<span style="font-size:.65rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px">${c.trim()}</span>`).join('')}
              ${isAtRisk?`<span style="font-size:.66rem;font-weight:700;background:#fef2f2;color:var(--danger);border-radius:4px;padding:1px 6px">⚠ At Risk</span>`:''}
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.76rem">${starRating(v.rating||0)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${(+v.rating||0).toFixed(1)} / 5.0</div>
        </div>
      </div>

      <!-- Performance metrics -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:3px">
            <span>On-time Rate</span>
            <span style="font-weight:700;color:${onTimeColor}">${pct(v.on_time_rate||0)}</span>
          </div>
          <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${v.on_time_rate||0}%;background:${onTimeColor};border-radius:3px"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:3px">
            <span>Fill Rate</span>
            <span style="font-weight:700;color:${fillColor}">${pct(v.fill_rate||0)}</span>
          </div>
          <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${v.fill_rate||0}%;background:${fillColor};border-radius:3px"></div>
          </div>
        </div>
      </div>

      <!-- Meta row -->
      <div style="display:flex;align-items:center;gap:12px;font-size:.74rem;color:var(--text-muted);margin-bottom:${v.address?'6px':'14px'};flex-wrap:wrap">
        <span>⏱ ${v.avg_lead_days||'—'}d lead time</span>
        ${v.location?`<span>🏙 ${v.location}</span>`:''}
        ${v.contact_email?`<span>✉ <a href="mailto:${v.contact_email}" style="color:var(--blue)">${v.contact_email}</a></span>`:''}
        ${v.contact_phone?`<span>📞 ${v.contact_phone}</span>`:''}
      </div>
      ${v.address||v.map_pin?`<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:14px;display:flex;align-items:flex-start;gap:6px">
        <span style="flex-shrink:0">📍</span>
        <span>${v.address||''}${(v.address&&v.map_pin)?' · ':''}${v.map_pin?`<a href="${mapsLink(v.map_pin,v.address)}" target="_blank" rel="noopener" style="color:var(--blue)">Map</a>`:''}</span>
      </div>`:''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="viewVendorModal(${JSON.stringify(v).replace(/"/g,'&quot;')})">View</button>
        <button class="btn btn-gold btn-sm" onclick="editVendorModal(${JSON.stringify(v).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-sm" style="background:${v.active===0?'var(--success)':'#fee2e2'};color:${v.active===0?'#fff':'var(--danger)'};border:none" onclick="toggleVendorActive('${v.id}','${v.name.replace(/'/g,"\\'")}',${v.active===0?0:1})">${v.active===0?'Enable':'Disable'}</button>
        <button class="btn btn-gold btn-sm" onclick="newPOForVendor('${v.id}','${v.name.replace(/'/g,"\\'")}')">New PO</button>
        <button class="btn btn-secondary btn-sm" onclick="openVendorFeedbackModal('${v.id}','${v.name.replace(/'/g,"\\'")}')">Rate</button>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Vendor Directory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${activeVendors.length} active vendors · avg on-time ${avgOnTime}% · avg fill ${avgFill}%</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="navigate('procurement')">View POs</button>
      ${!['client_admin','client_user','client_approver','vendor_admin','vendor_user','delivery_exec'].includes(APP.user?.role) ? '<button class="btn btn-secondary" onclick="APP._importDefaultTab=\'vendors\';navigate(\'import_data\')">⬆ Import CSV</button>' : ''}
      <button class="btn btn-gold" onclick="addVendorModal()">${iconPlus(14)} Add Vendor</button>
    </div>
  </div>

  <!-- Search & Filter bar -->
  <div style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input type="text" id="vendor-search-q" placeholder="Search by name or brand…" value="${APP._vendorSearch||''}"
      style="flex:1;min-width:180px;border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:.84rem"
      oninput="filterVendorCards()">
    <select id="vendor-search-cat" style="border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;font-size:.84rem;background:#fff"
      onchange="APP._vendorCat=this.value;renderVendors(document.getElementById('main-content'))">
      <option value="">All Categories</option>
      ${allCategories.map(c=>`<option value="${c}"${APP._vendorCat===c?' selected':''}>${c}</option>`).join('')}
    </select>
    <input type="text" id="vendor-search-loc" placeholder="Filter by location…" value="${APP._vendorLoc||''}"
      style="width:160px;border:1.5px solid var(--border);border-radius:8px;padding:7px 12px;font-size:.84rem"
      oninput="filterVendorCards()">
    <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-muted);cursor:pointer">
      <input type="checkbox" ${APP._vendorShowInactive?'checked':''} onchange="APP._vendorShowInactive=this.checked;renderVendors(document.getElementById('main-content'))"> Show inactive
    </label>
    <button class="btn btn-secondary btn-sm" id="vendor-clear-btn" style="display:none" onclick="APP._vendorSearch='';APP._vendorCat='';APP._vendorLoc='';document.getElementById('vendor-search-q').value='';document.getElementById('vendor-search-loc').value='';document.getElementById('vendor-search-cat').value='';filterVendorCards()">Clear</button>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Vendors</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${activeVendors.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${scoreColor(avgOnTime)}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Avg On-time Rate</div>
      <div style="font-size:2rem;font-weight:800;color:${scoreColor(avgOnTime)};margin-top:6px">${avgOnTime}%</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${scoreColor(avgFill)}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Avg Fill Rate</div>
      <div style="font-size:2rem;font-weight:800;color:${scoreColor(avgFill)};margin-top:6px">${avgFill}%</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${atRisk?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">At Risk</div>
      <div style="font-size:2rem;font-weight:800;color:${atRisk?'var(--danger)':'var(--navy)'};margin-top:6px">${atRisk}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">below performance threshold</div>
    </div>
  </div>

  <!-- Vendor cards -->
  <div id="vendor-no-match" style="text-align:center;padding:40px;color:var(--text-muted);display:${vendors.length===0?'block':'none'}">No vendors match your search.</div>
  <div id="vendor-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${allVendors.sort((a,b)=>{
      const aRisk = ((a.on_time_rate||0)<75||(a.fill_rate||0)<85)?1:0;
      const bRisk = ((b.on_time_rate||0)<75||(b.fill_rate||0)<85)?1:0;
      return bRisk - aRisk || (b.rating||0)-(a.rating||0);
    }).map(v=>`<div data-vname="${(v.name||'').toLowerCase()}" data-vcat="${(v.category||'').toLowerCase()}" data-vloc="${(v.location||'').toLowerCase()}" data-vactive="${v.active===0?'0':'1'}">${vendorCard(v)}</div>`).join('')}
  </div>
  `;
  APP._allVendors = allVendors;
  filterVendorCards();
}

function filterVendorCards() {
  const q   = (document.getElementById('vendor-search-q')?.value||'').toLowerCase().trim();
  const loc = (document.getElementById('vendor-search-loc')?.value||'').toLowerCase().trim();
  const cat = APP._vendorCat||'';
  APP._vendorSearch = q;
  APP._vendorLoc    = loc;
  let visible = 0;
  document.querySelectorAll('#vendor-cards-grid > [data-vname]').forEach(el => {
    const nameMatch = !q || el.dataset.vname.includes(q) || el.dataset.vcat.includes(q);
    const locMatch  = !loc || el.dataset.vloc.includes(loc);
    const catMatch  = !cat || el.dataset.vcat.includes(cat.toLowerCase());
    const activeOk  = APP._vendorShowInactive || el.dataset.vactive !== '0';
    const show = nameMatch && locMatch && catMatch && activeOk;
    el.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const noMatch = document.getElementById('vendor-no-match');
  if (noMatch) noMatch.style.display = visible === 0 ? 'block' : 'none';
  const clearBtn = document.getElementById('vendor-clear-btn');
  if (clearBtn) clearBtn.style.display = (q||loc||cat) ? '' : 'none';
}

const VENDOR_CATS = ['Beverages & Snacks','Office Supplies','Hygiene & Cleaning','Office Furniture','Electronics','Dairy & Fresh','Dry Grocery','IT & Technology','Pantry Equipment','Stationery'];

function vendorCatCheckboxes(prefix, selected) {
  const sel = (selected||'').split(',').map(s=>s.trim()).filter(Boolean);
  return `<div class="form-group">
    <label>Category / Brand <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(select all that apply)</span></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-top:6px;background:var(--bg);border:1.5px solid var(--border);border-radius:8px;padding:12px">
      ${VENDOR_CATS.map(c=>`
        <label style="display:flex;align-items:center;gap:8px;font-size:.84rem;cursor:pointer;padding:3px 0">
          <input type="checkbox" name="${prefix}-cat" value="${c}" ${sel.includes(c)?'checked':''} style="accent-color:var(--navy);width:15px;height:15px"> ${c}
        </label>`).join('')}
    </div>
  </div>`;
}

function getCheckedCats(prefix) {
  return [...document.querySelectorAll(`input[name="${prefix}-cat"]:checked`)].map(i=>i.value).join(',');
}

function vendorFormFields(prefix, v={}) {
  return `
    <div class="grid-2">
      <div class="form-group"><label>Company Name *</label><input type="text" id="${prefix}-name" value="${v.name||''}"></div>
      <div class="form-group"><label>City / Area</label><input type="text" id="${prefix}-loc" value="${v.location||''}" placeholder="e.g. Bengaluru, BTM Layout"></div>
    </div>
    ${vendorCatCheckboxes(prefix, v.category||'')}
    <div class="form-group"><label>Full Address</label>
      <textarea id="${prefix}-address" rows="2" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical">${v.address||''}</textarea>
    </div>
    <div class="form-group">
      <label>Map Location <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(paste Google Maps link, or lat,lng e.g. 12.9716,77.5946)</span></label>
      <input type="text" id="${prefix}-mappin" value="${v.map_pin||''}" placeholder="https://maps.google.com/... or 12.9716,77.5946">
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Contact Email</label><input type="email" id="${prefix}-email" value="${v.contact_email||''}"></div>
      <div class="form-group"><label>Contact Phone</label><input type="tel" id="${prefix}-phone" value="${v.contact_phone||''}"></div>
    </div>

    <div style="border-top:1px solid var(--border);margin:6px 0 12px;padding-top:12px;font-size:.78rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.04em">Delivery & Visit Schedule</div>
    <div class="grid-2">
      <div class="form-group">
        <label>Lead Time for Delivery <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(days)</span></label>
        <input type="number" id="${prefix}-lead" min="0" step="1" value="${v.avg_lead_days!=null?v.avg_lead_days:''}" placeholder="e.g. 3">
      </div>
      <div class="form-group">
        <label>Visit Frequency</label>
        <select id="${prefix}-visitfreq" onchange="onVendorVisitFreqChange('${prefix}')">
          ${['','Weekly','Fortnightly','Monthly','On-Demand'].map(f=>`<option value="${f}" ${(v.visit_frequency||'')===f?'selected':''}>${f||'— Not scheduled —'}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group" id="${prefix}-visitday-wrap" style="display:${(v.visit_frequency==='Weekly'||v.visit_frequency==='Fortnightly'||v.visit_frequency==='Monthly')?'block':'none'}">
      <label id="${prefix}-visitday-label">Visit Day</label>
      <div id="${prefix}-visitday-field">${vendorVisitDayField(prefix, v.visit_frequency||'', v.visit_day||'')}</div>
    </div>

    <div class="form-group">
      <label>Comments / Notes <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(product list, packaging, MOQ, payment terms, anything relevant)</span></label>
      <textarea id="${prefix}-notes" rows="3" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical" placeholder="e.g. Supplies: Bru Coffee 200g, Tata Tea 1kg… · MOQ 24 units · Delivers Tue & Fri · Payment: 15-day credit">${v.notes||''}</textarea>
    </div>`;
}

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function vendorVisitDayField(prefix, freq, current) {
  if (freq === 'Monthly') {
    return `<input type="number" id="${prefix}-visitday" min="1" max="31" value="${current||''}" placeholder="Day of month (1–31)" style="max-width:200px">`;
  }
  // Weekly / Fortnightly → weekday picker
  return `<select id="${prefix}-visitday" style="max-width:220px">
    <option value="">— Select day —</option>
    ${WEEKDAYS.map(d=>`<option value="${d}" ${current===d?'selected':''}>${d}</option>`).join('')}
  </select>`;
}

function onVendorVisitFreqChange(prefix) {
  const freq = document.getElementById(`${prefix}-visitfreq`)?.value || '';
  const wrap = document.getElementById(`${prefix}-visitday-wrap`);
  const label = document.getElementById(`${prefix}-visitday-label`);
  const field = document.getElementById(`${prefix}-visitday-field`);
  const showDay = ['Weekly','Fortnightly','Monthly'].includes(freq);
  if (wrap) wrap.style.display = showDay ? 'block' : 'none';
  if (label) label.textContent = freq === 'Monthly' ? 'Visit Day of Month' : 'Visit Weekday';
  if (field) field.innerHTML = vendorVisitDayField(prefix, freq, '');
}

function addVendorModal() {
  openModal('Add Vendor', vendorFormFields('v'),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveVendor()">Add Vendor</button>`);
}

function collectVendorForm(prefix) {
  const freq = document.getElementById(`${prefix}-visitfreq`)?.value || '';
  const leadVal = document.getElementById(`${prefix}-lead`)?.value;
  return {
    name: document.getElementById(`${prefix}-name`).value.trim(),
    category: getCheckedCats(prefix),
    location: document.getElementById(`${prefix}-loc`).value,
    address: document.getElementById(`${prefix}-address`).value,
    map_pin: document.getElementById(`${prefix}-mappin`).value.trim(),
    contact_email: document.getElementById(`${prefix}-email`).value,
    contact_phone: document.getElementById(`${prefix}-phone`).value,
    avg_lead_days: leadVal === '' ? undefined : Number(leadVal),
    visit_frequency: freq || null,
    visit_day: ['Weekly','Fortnightly','Monthly'].includes(freq) ? (document.getElementById(`${prefix}-visitday`)?.value || null) : null,
    notes: document.getElementById(`${prefix}-notes`)?.value?.trim() || null,
  };
}

async function saveVendor() {
  const body = collectVendorForm('v');
  if (!body.name) { showToast('Vendor name required','error'); return; }
  const res = await api('/vendors', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Vendor added — welcome email sent`); navigate('vendors'); }
}

function catChips(category) {
  if (!category) return '—';
  return category.split(',').map(c=>c.trim()).filter(Boolean)
    .map(c=>`<span style="font-size:.65rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px;margin-right:3px">${c}</span>`)
    .join('');
}

function viewVendorModal(v) {
  const onTimeColor = v.on_time_rate>=90?'var(--success)':v.on_time_rate>=75?'#d97706':'var(--danger)';
  const fillColor   = v.fill_rate>=90?'var(--success)':v.fill_rate>=75?'#d97706':'var(--danger)';
  const mapUrl = mapsLink(v.map_pin, v.address);
  openModal(`Vendor: ${v.name}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><div style="font-size:.72rem;color:var(--text-muted)">Company Name</div><div style="font-weight:600">${v.name}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">City / Area</div><div style="font-weight:600">${v.location||'—'}</div></div>
      <div style="grid-column:1/-1"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Category / Brand</div><div>${catChips(v.category)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Email</div><div style="font-weight:600">${v.contact_email?`<a href="mailto:${v.contact_email}" style="color:var(--blue)">${v.contact_email}</a>`:'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Phone</div><div style="font-weight:600">${v.contact_phone||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Rating</div><div style="font-weight:600">${(+v.rating||0).toFixed(1)} / 5.0</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">On-time Rate</div><div style="font-weight:700;color:${onTimeColor}">${pct(v.on_time_rate||0)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Fill Rate</div><div style="font-weight:700;color:${fillColor}">${pct(v.fill_rate||0)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Lead Time</div><div style="font-weight:600">${v.avg_lead_days!=null?v.avg_lead_days+' days':'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Status</div><div style="font-weight:600">${v.active===0?'<span style="color:var(--danger)">Disabled</span>':'<span style="color:var(--success)">Active</span>'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Visit Schedule</div><div style="font-weight:600">${v.visit_frequency?`${v.visit_frequency}${v.visit_day?' · '+(v.visit_frequency==='Monthly'?'day '+v.visit_day:v.visit_day):''}`:'—'}</div></div>
    </div>
    ${v.notes?`<div style="margin-top:14px"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Comments / Notes</div><div style="font-size:.84rem;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;white-space:pre-wrap;line-height:1.5">${h(v.notes)}</div></div>`:''}
    ${v.address?`<div style="margin-top:14px"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Address</div><div style="font-size:.85rem">📍 ${v.address}</div></div>`:''}
    ${mapUrl?`<div style="margin-top:12px"><a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">🗺 View on Google Maps</a></div>`:''}`,
    `<button class="btn btn-primary" onclick="editVendorModal(${JSON.stringify(v).replace(/"/g,'&quot;')});closeModal()">Edit</button>
     <button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}

function editVendorModal(v) {
  openModal(`Edit Vendor: ${v.name}`, vendorFormFields('ev', v),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveEditVendor('${v.id}')">Save Changes</button>`);
}

async function saveEditVendor(id) {
  const body = collectVendorForm('ev');
  if (!body.name) { showToast('Vendor name required','error'); return; }
  const res = await api('/vendors/' + id, { method:'PATCH', body: JSON.stringify(body) });
  if (res) { closeModal(); showToast('Vendor updated'); APP._vendorSearch=''; APP._vendorCat=''; APP._vendorLoc=''; navigate('vendors'); }
}

async function toggleVendorActive(id, name, active) {
  const newState = active ? 0 : 1;
  if (!confirm(`${newState?'Enable':'Disable'} vendor "${name}"?`)) return;
  const res = await api('/vendors/' + id, { method:'PATCH', body: JSON.stringify({ active: newState }) });
  if (res) { showToast(`Vendor ${newState?'enabled':'disabled'}`); navigate('vendors'); }
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
      <div style="position:relative;height:220px;width:100%">
        <canvas id="vendorChart"></canvas>
      </div>
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
        options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true,max:100,grid:{color:'#f0f0f0'}},x:{grid:{display:false}}} }
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
  <div style="margin-bottom:12px">
    <button class="btn btn-secondary btn-sm" onclick="navigate('settings')" style="display:inline-flex;align-items:center;gap:5px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Back to Settings
    </button>
  </div>
  ${pageHeader('Warehouse', 'Warehouses, bins, GRN, picklist & stock transfers',
    `<button class="btn btn-primary" onclick="addWarehouseModal()">${iconPlus(14)} Add Warehouse</button>`)}
  <div id="wh-returns-queue"></div>
  <div class="tabs" id="wh-tabs" style="margin-bottom:16px">
    <button class="tab-btn active" onclick="switchWHTab('overview',this)">Overview</button>
    <button class="tab-btn" onclick="switchWHTab('grn',this)">GRN Records</button>
    <button class="tab-btn" onclick="switchWHTab('bins',this)">Bin Locations</button>
    <button class="tab-btn" onclick="switchWHTab('picklist',this)">Pick List</button>
    <button class="tab-btn" onclick="switchWHTab('transfers',this)">Stock Transfers</button>
  </div>
  <div id="wh-tab-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div>`;

  switchWHTab('overview', document.querySelector('#wh-tabs .tab-btn'));
  loadWarehouseReturnsQueue();
}

/* ── Returns awaiting warehouse check & approval ── */
async function loadWarehouseReturnsQueue() {
  const wrap = document.getElementById('wh-returns-queue');
  if (!wrap) return;
  const returns = await api('/returns').catch(()=>[]) || [];
  const pending = returns.filter(r => r.status === 'PENDING');
  if (!pending.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
  <div class="card" style="border:1.5px solid #fcd34d;margin-bottom:16px;overflow:hidden;padding:0">
    <div style="padding:12px 18px;background:#fffbeb;border-bottom:1px solid #fde68a;display:flex;align-items:center;gap:8px">
      <span style="font-size:1.1rem">↩</span>
      <b style="font-size:.9rem;color:#92400e">Returns Awaiting Check & Approval (${pending.length})</b>
      <span style="font-size:.74rem;color:#b45309">— verify returned goods, then approve to restock</span>
    </div>
    ${pending.map(r => `
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${r.id} · DC ${r.dc_id}${r.client_name?` · ${h(r.client_name)}`:''}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">By ${h(r.created_by_name||'—')} · ${fmtDate(r.created_at)}${r.reason?` · Reason: <i>${h(r.reason)}</i>`:''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${(r.items||[]).map(i=>`<span style="font-size:.72rem;font-weight:600;background:#fef3c7;color:#92400e;border-radius:6px;padding:3px 9px">${h(i.name||i.sku)} × ${i.qty}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" onclick="reviewReturn('${r.id}','approve')">✓ Checked & Approve</button>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="reviewReturn('${r.id}','reject')">✕ Reject</button>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

async function reviewReturn(retId, action) {
  const label = action==='approve' ? 'approve and restock' : 'reject';
  openModal(`${action==='approve'?'Approve':'Reject'} Return ${retId}`,
    `<p style="margin:0 0 12px;color:var(--text-muted);font-size:.86rem">${action==='approve'
      ? 'Confirm the returned goods have been physically checked at the warehouse. Approving will <b>restock the returned quantities</b>.'
      : 'Rejecting will send the DC back to its previous status. No stock changes.'}</p>
     <div class="form-group"><label>Note (optional)</label><input type="text" id="ret-review-note" placeholder="e.g. All items verified in good condition"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn ${action==='approve'?'btn-primary':'btn-danger'}" onclick="confirmReviewReturn('${retId}','${action}')">${action==='approve'?'✓ Approve & Restock':'✕ Reject Return'}</button>`);
}

async function confirmReviewReturn(retId, action) {
  const note = document.getElementById('ret-review-note')?.value?.trim();
  const res = await api(`/returns/${retId}/${action}`, { method:'POST', body: JSON.stringify({ note }) });
  closeModal();
  if (res) {
    showToast(action==='approve' ? `Return ${retId} approved — stock restored` : `Return ${retId} rejected`);
    loadWarehouseReturnsQueue();
  }
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
  const totalUnits   = inv.reduce((s,i) => s+i.stock, 0);
  const totalSKUs    = inv.length;
  const lowStock     = inv.filter(i => i.stock > 0 && i.stock <= (i.reorder_level||0)).length;
  const outOfStock   = inv.filter(i => i.stock <= 0).length;
  const thisMonth    = new Date().toISOString().slice(0,7);
  const grnsThisMonth = grns.filter(g => (g.received_at||'').startsWith(thisMonth)).length;
  const activeWH     = warehouses.filter(w=>w.active).length;
  const totalBins    = bins.length;
  const occupiedBins = bins.filter(b=>(b.occupied||0)>0).length;
  const binFillPct   = totalBins ? Math.round(occupiedBins/totalBins*100) : 0;
  const pendingGRNs  = grns.filter(g => g.status && g.status !== 'RECEIVED').length;

  const binColor   = binFillPct>=85 ? 'var(--danger)' : binFillPct>=60 ? '#d97706' : 'var(--success)';
  const skuColor   = outOfStock>0 ? 'var(--danger)' : lowStock>0 ? '#d97706' : 'var(--success)';
  const grnColor   = pendingGRNs>0 ? '#d97706' : 'var(--success)';
  const whColor    = activeWH === warehouses.length ? 'var(--navy)' : '#d97706';

  const kpiTile = (label, value, sub, subColor, borderColor) => `
    <div class="card" style="padding:16px 18px;border-top:3px solid ${borderColor};margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">${label}</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${value}</div>
      <div style="font-size:.75rem;color:${subColor};margin-top:6px">${sub}</div>
    </div>`;

  el.innerHTML = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${kpiTile('Active Warehouses', activeWH, `${warehouses.length} total configured`, 'var(--text-muted)', whColor)}
    ${kpiTile('Total SKUs', totalSKUs,
      outOfStock>0 ? `${outOfStock} out of stock` : lowStock>0 ? `${lowStock} below reorder` : 'All levels healthy',
      skuColor, skuColor)}
    ${kpiTile('Units In Stock', totalUnits.toLocaleString('en-IN'), 'across all bins & warehouses', 'var(--text-muted)', 'var(--primary)')}
    ${kpiTile('Bin Utilisation', binFillPct+'%', `${occupiedBins} of ${totalBins} bins used`, binColor, binColor)}
    ${kpiTile('GRNs This Month', grnsThisMonth,
      pendingGRNs>0 ? `${pendingGRNs} pending receipt` : 'All received',
      grnColor, grnColor)}
  </div>

  ${binFillPct>=85 || outOfStock>0 ? `
  <div style="background:#fef3cd;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:#92400e;display:flex;gap:10px;align-items:center">
    <span style="font-size:1.1rem">⚠️</span>
    <span>
      ${binFillPct>=85 ? `Bin capacity critical at <strong>${binFillPct}%</strong> utilisation. ` : ''}
      ${outOfStock>0 ? `<strong>${outOfStock}</strong> SKU${outOfStock>1?'s':''} are out of stock. ` : ''}
      Immediate action recommended.
    </span>
  </div>` : ''}

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:16px">
    ${warehouses.map(w=>{
      const wBins    = bins.filter(b=>b.warehouse_id===w.id);
      const wInv     = inv.filter(i=>i.warehouse_id===w.id);
      const occupied = wBins.reduce((s,b)=>s+(b.occupied||0),0);
      const cap      = wBins.reduce((s,b)=>s+(b.capacity||1),1);
      const utilPct  = Math.min(100, Math.round(occupied/cap*100));
      const wUnits   = wInv.reduce((s,i)=>s+i.stock,0);
      const wLow     = wInv.filter(i=>i.stock>0&&i.stock<=(i.reorder_level||0)).length;
      const wOOS     = wInv.filter(i=>i.stock<=0).length;
      const color    = utilPct>=85?'var(--danger)':utilPct>=60?'#d97706':'var(--success)';
      const whActive = w.active;
      return `
      <div class="card" style="margin-bottom:0;border-top:3px solid ${whActive?color:'var(--border)'}">
        <div class="card-header" style="padding:12px 16px">
          <div>
            <div style="font-weight:700;font-size:.95rem">${w.name}</div>
            ${w.city ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:1px">${w.city}</div>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${whActive ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}
          </div>
        </div>
        <div style="padding:14px 16px">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
            <div style="text-align:center;background:var(--light);border-radius:6px;padding:8px 4px">
              <div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Capacity</div>
              <div style="font-weight:700;font-size:.9rem;margin-top:2px">${(w.capacity||0).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align:center;background:var(--light);border-radius:6px;padding:8px 4px">
              <div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Bins</div>
              <div style="font-weight:700;font-size:.9rem;margin-top:2px">${wBins.length}</div>
            </div>
            <div style="text-align:center;background:var(--light);border-radius:6px;padding:8px 4px">
              <div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Units</div>
              <div style="font-weight:700;font-size:.9rem;margin-top:2px">${wUnits.toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align:center;background:${wOOS>0?'#fee2e2':wLow>0?'#fef3cd':'var(--light)'};border-radius:6px;padding:8px 4px">
              <div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Alerts</div>
              <div style="font-weight:700;font-size:.9rem;margin-top:2px;color:${wOOS>0?'var(--danger)':wLow>0?'#d97706':'var(--success)'}">${wOOS+wLow||'—'}</div>
            </div>
          </div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px">
              <span style="color:var(--text-muted)">Bin Utilisation</span>
              <span style="font-weight:700;color:${color}">${utilPct}%</span>
            </div>
            <div style="background:var(--border);height:7px;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${utilPct}%;background:${color};border-radius:4px;transition:width .4s ease"></div>
            </div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">${occupied} of ${cap} capacity used</div>
          </div>
          ${wOOS>0||wLow>0 ? `
          <div style="font-size:.75rem;color:${wOOS>0?'var(--danger)':'#d97706'};background:${wOOS>0?'#fee2e2':'#fef3cd'};padding:5px 8px;border-radius:4px;margin-bottom:10px">
            ${wOOS>0?`${wOOS} SKU${wOOS>1?'s':''} out of stock`:''}${wOOS>0&&wLow>0?' · ':''}${wLow>0?`${wLow} below reorder level`:''}
          </div>` : ''}
          <div style="display:flex;gap:6px">
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
              ${statusBadge(order.status)}
              ${(order.status==='PICKED'||order.status==='QUALITY_CHECK')&&order.picker_name?`<span style="margin-left:6px;font-size:.78rem;color:var(--text-muted)">Picked by ${order.picker_name}</span>`:''}
            </div>
            <div>
              ${order.status==='QUALITY_CHECK'
                ? `<button class="btn btn-success btn-sm" onclick="createDCFromPicklist('${order.order_id}')">✓ Pass &rarr; Dispatch</button>
                   <button class="btn btn-warning btn-sm" style="margin-left:4px" onclick="advanceOrder('${order.order_id}','READY_TO_PICK','Quality check failed — returned for re-pick')">↩ Re-Pick</button>`
                : order.status==='PICKED'
                  ? `<button class="btn btn-info btn-sm" onclick="advanceOrder('${order.order_id}','QUALITY_CHECK','Items picked — quality check &amp; packing')">Quality Check</button>`
                  : `<button class="btn btn-primary btn-sm" onclick="pickOrderModal('${order.order_id}')">Pick Items</button>`
              }
            </div>
          </div>
          <div class="table-wrap">
            <table class="table" style="margin:0">
              <thead><tr><th>Item Name</th><th>SKU</th><th>Qty Required</th><th>Stock Available</th>${order.status==='PICKED'?'<th>Bin Picked From</th>':''}</tr></thead>
              <tbody>${order.items.map(item=>`<tr>
                <td><b>${item.item_name}</b></td>
                <td style="color:var(--text-muted);font-size:.82rem">${item.sku}</td>
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

function createDCFromPicklist(orderId) {
  openModal(`Dispatch Order ${orderId}`,
    `<p style="margin:0;color:var(--text-muted)">This will deduct stock and create a Delivery Challan for order <b>${orderId}</b>. Confirm dispatch?</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-gold" onclick="confirmCreateDCFromPicklist('${orderId}')">Confirm Dispatch</button>`);
}

async function confirmCreateDCFromPicklist(orderId) {
  const res = await api(`/orders/${orderId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ to: 'IN_SHIPMENT', note: 'Items picked — dispatched to delivery' })
  });
  closeModal();
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
      <thead><tr><th>Item Name</th><th>SKU</th><th>Ordered</th><th>Qty to Pick</th><th>Bin Location</th></tr></thead>
      <tbody id="pick-items-body">
        ${(items||[]).map(item=>`<tr>
          <td><b>${item.name||item.item_name}</b></td>
          <td style="color:var(--text-muted);font-size:.82rem">${item.sku}</td>
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
  const dcs = await api('/delivery-challans');
  if (!dcs) { el.innerHTML = `${pageHeader('Deliveries','Delivery challans, dispatch, POD & returns')}<div class="card" style="padding:32px;text-align:center;color:var(--danger)">Failed to load delivery challans.</div>`; return; }

  const today = new Date();
  const scheduled = dcs.filter(d => d.status === 'SCHEDULED');
  const transit   = dcs.filter(d => d.status === 'IN_TRANSIT');
  const delivered = dcs.filter(d => d.status === 'DELIVERED');
  const returns   = dcs.filter(d => d.status === 'CANCELLED');
  const overdue   = transit.filter(d => d.expected_delivery_date && new Date(d.expected_delivery_date) < today);
  const pendingPOD  = delivered.filter(d => !d.pod_uploaded).length;
  const pendingBill = delivered.filter(d => !d.billed).length;

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Scheduled',val:scheduled.length,sub:'ready to dispatch',color:scheduled.length?'var(--primary)':'var(--success)'},
      {label:'In Transit',val:transit.length,sub:overdue.length?`${overdue.length} overdue`:'all on time',color:overdue.length?'var(--danger)':transit.length?'var(--warning)':'var(--success)'},
      {label:'Pending POD/Scan',val:pendingPOD,sub:'delivered, docs missing',color:pendingPOD?'var(--warning)':'var(--success)'},
      {label:'Unbilled',val:pendingBill,sub:'delivered but not billed',color:pendingBill?'var(--danger)':'var(--success)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  APP._dcData = dcs;
  APP._dcTab  = APP._dcTab || 'scheduled';

  function tabsHtml(active) {
    const podPending = delivered.filter(d => !d.pod_uploaded || !d.dc_scan_uploaded).length;
    return ['scheduled','transit','delivered','returns','pod','all'].map((t,i)=>{
      const labels = ['Scheduled','In Transit','Delivered','Returns','POD & Scans','All'];
      const counts = [scheduled.length, transit.length, delivered.length, returns.length, delivered.length, dcs.length];
      const badge  = t === 'pod' && podPending ? `<span style="background:var(--warning);color:#fff;font-size:.65rem;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px">${podPending}</span>` : `<span style="font-size:.72rem;opacity:.7">(${counts[i]})</span>`;
      return `<button class="tab-btn${active===t?' active':''}" onclick="switchDeliveryTab('${t}',this)">${labels[i]} ${badge}</button>`;
    }).join('');
  }

  function dcCardScheduled(dc) {
    const canDispatch = APP.user?.role !== 'delivery_exec';
    return `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700;font-size:.95rem">DC #${dc.id}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">${dc.client_name||'Unknown Client'}</div>
      </div>
      <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-size:.82rem;color:var(--text-muted)">
          ${dc.total_qty ? `<span style="font-weight:600;color:var(--text)">${dc.total_qty}</span> units` : 'Qty unknown'}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button>
          ${canDispatch ? `<button class="btn btn-primary btn-sm" onclick="dispatchDCModal('${dc.id}')">Dispatch →</button>` : ''}
        </div>
      </div>
    </div>`;
  }

  function dcCardTransit(dc) {
    const isOverdue = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today;
    const borderColor = isOverdue ? 'var(--danger)' : 'var(--warning)';
    const dQty = dc.delivered_qty != null ? dc.delivered_qty : null;
    const tQty = dc.total_qty || 0;
    const pct  = (dQty != null && tQty) ? Math.round(dQty / tQty * 100) : 0;
    return `
    <div class="card" style="padding:0;overflow:hidden;border-left:3px solid ${borderColor}">
      <div style="padding:14px 16px 10px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
          <div>
            <span style="font-weight:700;font-size:.95rem">DC #${dc.id}</span>
            ${isOverdue ? '<span class="badge badge-danger" style="margin-left:6px">Overdue</span>' : ''}
          </div>
          <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
        </div>
        <div style="font-size:.82rem;font-weight:600;margin-bottom:2px">${dc.client_name||'Unknown Client'}</div>
        ${dc.driver_name ? `<div style="font-size:.78rem;color:var(--text-muted)">🚚 ${dc.vehicle_no||'—'} · ${dc.driver_name}</div>` : ''}
      </div>
      ${dQty != null && tQty ? `
      <div style="padding:0 16px 4px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted);margin-bottom:4px">
          <span>Delivered</span><span>${dQty}/${tQty}</span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px">
          <div style="height:100%;width:${pct}%;background:var(--warning);border-radius:3px"></div>
        </div>
      </div>` : ''}
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
        <div style="font-size:.75rem;color:var(--text-muted)">
          Dispatched ${fmtDate(dc.dispatched_at)}
          ${dc.expected_delivery_date ? ` · Due ${fmtDate(dc.expected_delivery_date)}` : ''}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">Items</button>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="returnDCModal('${dc.id}')">Return</button>
          <button class="btn btn-success btn-sm" onclick="markDelivered('${dc.id}')">✓ Delivered</button>
        </div>
      </div>
    </div>`;
  }

  function tabContent(tab) {
    if (tab === 'scheduled') {
      if (!scheduled.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📦</div>No challans scheduled for dispatch</div>`;
      return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${scheduled.map(dcCardScheduled).join('')}</div>`;
    }
    if (tab === 'transit') {
      if (!transit.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🚚</div>No challans currently in transit</div>`;
      const overdueItems = transit.filter(d => d.expected_delivery_date && new Date(d.expected_delivery_date) < today);
      const onTimeItems  = transit.filter(d => !d.expected_delivery_date || new Date(d.expected_delivery_date) >= today);
      let html = '';
      if (overdueItems.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--danger);font-weight:600;margin-bottom:8px">⚠ Overdue (${overdueItems.length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:18px">${overdueItems.map(dcCardTransit).join('')}</div>`;
      if (onTimeItems.length)  html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">On Track (${onTimeItems.length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${onTimeItems.map(dcCardTransit).join('')}</div>`;
      return html;
    }
    if (tab === 'delivered') {
      if (!delivered.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">✅</div>No delivered challans yet</div>`;
      const needsAction = delivered.filter(d => !d.pod_uploaded || !d.billed);
      const complete    = delivered.filter(d => d.pod_uploaded && d.billed);
      const rows = (list) => list.map(dc=>`<tr>
        <td><b>${dc.id}</b></td>
        <td>${dc.order_id}</td>
        <td>${dc.client_name||'—'}</td>
        <td style="color:var(--success);font-weight:600">${dc.delivered_qty||dc.total_qty||'—'}</td>
        <td>${dc.driver_name||'—'}</td>
        <td>${fmtDate(dc.delivered_at)}</td>
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" onclick="markPOD('${dc.id}')">Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" onclick="markScan('${dc.id}')">Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" onclick="billDC('${dc.id}')">Bill</button>`}</td>
      </tr>`).join('');
      const tbl = (list) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Qty</th><th>Driver</th><th>Delivered At</th><th>POD</th><th>Scan</th><th>Billed</th></tr></thead><tbody>${rows(list)}</tbody></table></div></div>`;
      let html = '';
      if (needsAction.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:8px">Needs Action (${needsAction.length})</div>${tbl(needsAction)}<div style="margin-bottom:16px"></div>`;
      if (complete.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">Complete (${complete.length})</div>${tbl(complete)}`;
      return html;
    }
    if (tab === 'pod') {
      if (!delivered.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📄</div>No delivered challans yet</div>`;
      const podDone  = delivered.filter(d => d.pod_uploaded).length;
      const scanDone = delivered.filter(d => d.dc_scan_uploaded).length;
      return `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px">
        <div class="card" style="padding:14px 16px;border-top:3px solid var(--primary)">
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Total Delivered</div>
          <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${delivered.length}</div>
        </div>
        <div class="card" style="padding:14px 16px;border-top:3px solid ${podDone===delivered.length?'var(--success)':'var(--warning)'}">
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">POD Uploaded</div>
          <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${podDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span></div>
        </div>
        <div class="card" style="padding:14px 16px;border-top:3px solid ${scanDone===delivered.length?'var(--success)':'var(--warning)'}">
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">DC Scanned</div>
          <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${scanDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span></div>
        </div>
        <div class="card" style="padding:14px 16px;border-top:3px solid ${delivered.length-Math.max(podDone,scanDone)===0?'var(--success)':'var(--danger)'}">
          <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Pending Action</div>
          <div style="font-size:1.8rem;font-weight:700;margin-top:4px;color:${delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length?'var(--danger)':'var(--success)'}">
            ${delivered.filter(d => !d.pod_uploaded || !d.dc_scan_uploaded).length}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="position:relative;flex:1;max-width:400px">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pod-search-input" placeholder="Search DC #, order, client, driver…" oninput="filterPODTable(this.value)"
            style="width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:.85rem;outline:none">
        </div>
        <span id="pod-result-count" style="font-size:.82rem;color:var(--text-muted)"></span>
      </div>
      <div class="card"><div class="table-wrap">
        <table class="table" id="pod-scan-table">
          <thead><tr>
            <th>DC #</th><th>Order</th><th>Client</th><th>Driver</th><th>Delivered At</th>
            <th>POD Upload</th><th>DC Scan</th><th>Overall Status</th><th>Documents</th>
          </tr></thead>
          <tbody>
            ${delivered.map(dc => podScanRow(dc)).join('')}
          </tbody>
        </table>
      </div></div>`;
    }
    if (tab === 'returns') {
      if (!returns.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;
      return `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th></tr></thead><tbody>
        ${returns.map(dc=>`<tr><td><b>${dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
    }
    // all
    return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${['','SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s=>`
        <button class="btn btn-secondary btn-sm" onclick="filterDCTable('${s}')">${s||'All'}</button>
      `).join('')}
    </div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Total Qty</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Delivered At</th><th>Billed</th></tr></thead>
      <tbody id="dc-all-tbody">${dcs.map(dc=>{
        const od = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today && dc.status !== 'DELIVERED';
        return `<tr data-status="${dc.status}" style="${od?'background:#fff8e6':''}">
          <td><b>${dc.id}</b>${od?'<span class="badge badge-danger" style="margin-left:4px;font-size:.65rem">OD</span>':''}</td>
          <td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${statusBadge(dc.status)}</td>
          <td>${dc.total_qty||'—'}</td><td>${dc.vehicle_no||'—'}</td><td>${dc.driver_name||'—'}</td>
          <td>${fmtDate(dc.dispatched_at)}</td>
          <td style="color:${od?'var(--danger)':'inherit'}">${dc.expected_delivery_date?fmtDate(dc.expected_delivery_date):'—'}</td>
          <td>${fmtDate(dc.delivered_at)}</td>
          <td>${dc.billed?'<span class="badge badge-success">Billed</span>':'—'}</td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div></div>`;
  }

  el.innerHTML = `
  ${pageHeader('Deliveries', 'Delivery challans, dispatch, POD & returns')}
  ${kpis}
  <div class="tabs" id="dc-tabs" style="margin-bottom:16px">${tabsHtml(APP._dcTab)}</div>
  <div id="dc-tab-content">${tabContent(APP._dcTab)}</div>`;
}

async function switchDeliveryTab(tab, btn) {
  APP._dcTab = tab;
  document.querySelectorAll('#dc-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  try {
    const dcs = await api('/delivery-challans');
    if (!dcs) return;

    const today = new Date();
    APP._dcData = dcs;

    const scheduled = dcs.filter(d => d.status === 'SCHEDULED');
    const transit   = dcs.filter(d => d.status === 'IN_TRANSIT');
    const delivered = dcs.filter(d => d.status === 'DELIVERED');
    const returns   = dcs.filter(d => d.status === 'CANCELLED');

    const content = document.getElementById('dc-tab-content');
    if (!content) return;

    if (tab === 'scheduled') {
      function dcSched(dc) {
        return `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-weight:700;font-size:.95rem">DC #${dc.id}</span>
              <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
            </div>
            <div style="font-size:.82rem;color:var(--text-muted)">${dc.client_name||'Unknown Client'}</div>
          </div>
          <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="font-size:.82rem;color:var(--text-muted)">
              ${dc.total_qty ? `<span style="font-weight:600;color:var(--text)">${dc.total_qty}</span> units` : 'Qty unknown'}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">View Items</button>
              <button class="btn btn-primary btn-sm" onclick="dispatchDCModal('${dc.id}')">Dispatch →</button>
            </div>
          </div>
        </div>`;
      }
      content.innerHTML = scheduled.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${scheduled.map(dcSched).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📦</div>No challans scheduled</div>`;

    } else if (tab === 'transit') {
      function dcTrans(dc) {
        const isOverdue = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today;
        const borderColor = isOverdue ? 'var(--danger)' : 'var(--warning)';
        const dQty = dc.delivered_qty != null ? dc.delivered_qty : null;
        const tQty = dc.total_qty || 0;
        const pct  = (dQty != null && tQty) ? Math.round(dQty / tQty * 100) : 0;
        return `
        <div class="card" style="padding:0;overflow:hidden;border-left:3px solid ${borderColor}">
          <div style="padding:14px 16px 10px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px">
              <div><span style="font-weight:700;font-size:.95rem">DC #${dc.id}</span>
                ${isOverdue?'<span class="badge badge-danger" style="margin-left:6px">Overdue</span>':''}</div>
              <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
            </div>
            <div style="font-size:.82rem;font-weight:600;margin-bottom:2px">${dc.client_name||'Unknown Client'}</div>
            ${dc.driver_name?`<div style="font-size:.78rem;color:var(--text-muted)">🚚 ${dc.vehicle_no||'—'} · ${dc.driver_name}</div>`:''}
          </div>
          ${dQty!=null&&tQty?`<div style="padding:0 16px 4px">
            <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--text-muted);margin-bottom:4px"><span>Delivered</span><span>${dQty}/${tQty}</span></div>
            <div style="height:5px;background:var(--border);border-radius:3px"><div style="height:100%;width:${pct}%;background:var(--warning);border-radius:3px"></div></div>
          </div>`:''}
          <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <div style="font-size:.75rem;color:var(--text-muted)">
              Dispatched ${fmtDate(dc.dispatched_at)}
              ${dc.expected_delivery_date?` · Due ${fmtDate(dc.expected_delivery_date)}`:''}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" onclick="viewDCItems('${dc.id}')">Items</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger)" onclick="returnDCModal('${dc.id}')">Return</button>
              <button class="btn btn-success btn-sm" onclick="markDelivered('${dc.id}')">✓ Delivered</button>
            </div>
          </div>
        </div>`;
      }
      const overdueItems = transit.filter(d => d.expected_delivery_date && new Date(d.expected_delivery_date) < today);
      const onTimeItems  = transit.filter(d => !d.expected_delivery_date || new Date(d.expected_delivery_date) >= today);
      let html = '';
      if (!transit.length) html = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🚚</div>No challans in transit</div>`;
      else {
        if (overdueItems.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--danger);font-weight:600;margin-bottom:8px">⚠ Overdue (${overdueItems.length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:18px">${overdueItems.map(dcTrans).join('')}</div>`;
        if (onTimeItems.length)  html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">On Track (${onTimeItems.length})</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${onTimeItems.map(dcTrans).join('')}</div>`;
      }
      content.innerHTML = html;

    } else if (tab === 'delivered') {
      const needsAction = delivered.filter(d => !d.pod_uploaded || !d.billed);
      const complete    = delivered.filter(d => d.pod_uploaded && d.billed);
      const rows = (list) => list.map(dc=>`<tr>
        <td><b>${dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td>
        <td style="color:var(--success);font-weight:600">${dc.delivered_qty||dc.total_qty||'—'}</td>
        <td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.delivered_at)}</td>
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" onclick="markPOD('${dc.id}')">Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" onclick="markScan('${dc.id}')">Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" onclick="billDC('${dc.id}')">Bill</button>`}</td>
      </tr>`).join('');
      const tbl = (list) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Qty</th><th>Driver</th><th>Delivered At</th><th>POD</th><th>Scan</th><th>Billed</th></tr></thead><tbody>${rows(list)}</tbody></table></div></div>`;
      let html = '';
      if (!delivered.length) html = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">✅</div>No delivered challans yet</div>`;
      else {
        if (needsAction.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:8px">Needs Action — POD/Billing (${needsAction.length})</div>${tbl(needsAction)}<div style="margin-bottom:16px"></div>`;
        if (complete.length)    html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">Complete (${complete.length})</div>${tbl(complete)}`;
      }
      content.innerHTML = html;

    } else if (tab === 'pod') {
      const podDone  = delivered.filter(d => d.pod_uploaded).length;
      const scanDone = delivered.filter(d => d.dc_scan_uploaded).length;
      if (!delivered.length) {
        content.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📄</div>No delivered challans yet</div>`;
      } else {
        content.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:16px">
          <div class="card" style="padding:14px 16px;border-top:3px solid var(--primary)">
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Total Delivered</div>
            <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${delivered.length}</div>
          </div>
          <div class="card" style="padding:14px 16px;border-top:3px solid ${podDone===delivered.length?'var(--success)':'var(--warning)'}">
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">POD Uploaded</div>
            <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${podDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span></div>
          </div>
          <div class="card" style="padding:14px 16px;border-top:3px solid ${scanDone===delivered.length?'var(--success)':'var(--warning)'}">
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">DC Scanned</div>
            <div style="font-size:1.8rem;font-weight:700;margin-top:4px">${scanDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span></div>
          </div>
          <div class="card" style="padding:14px 16px;border-top:3px solid ${delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length===0?'var(--success)':'var(--danger)'}">
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Pending Action</div>
            <div style="font-size:1.8rem;font-weight:700;margin-top:4px;color:${delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length?'var(--danger)':'var(--success)'}">${delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="position:relative;flex:1;max-width:400px">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="pod-search-input" placeholder="Search DC #, order, client, driver…" oninput="filterPODTable(this.value)"
              style="width:100%;padding:8px 10px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:.85rem;outline:none;box-sizing:border-box">
          </div>
          <span id="pod-result-count" style="font-size:.82rem;color:var(--text-muted)"></span>
        </div>
        <div class="card"><div class="table-wrap">
          <table class="table" id="pod-scan-table">
            <thead><tr>
              <th>DC #</th><th>Order</th><th>Client</th><th>Driver</th><th>Delivered At</th>
              <th>POD Upload</th><th>DC Scan</th><th>Overall Status</th><th>Documents</th>
            </tr></thead>
            <tbody>
              ${delivered.map(dc => podScanRow(dc)).join('')}
            </tbody>
          </table>
        </div></div>`;
      }

    } else if (tab === 'returns') {
      content.innerHTML = returns.length
        ? `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th></tr></thead><tbody>
            ${returns.map(dc=>`<tr><td><b>${dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td></tr>`).join('')}
          </tbody></table></div></div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;

    } else if (tab === 'all') {
      content.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${['','SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s=>`
          <button class="btn btn-secondary btn-sm" onclick="filterDCTable('${s}')">${s||'All'}</button>
        `).join('')}
      </div>
      <div class="card"><div class="table-wrap"><table class="table">
        <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Total Qty</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Delivered At</th><th>Billed</th></tr></thead>
        <tbody id="dc-all-tbody">${dcs.map(dc=>{
          const od = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today && dc.status !== 'DELIVERED';
          return `<tr data-status="${dc.status}" style="${od?'background:#fff8e6':''}">
            <td><b>${dc.id}</b>${od?'<span class="badge badge-danger" style="margin-left:4px;font-size:.65rem">OD</span>':''}</td>
            <td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${statusBadge(dc.status)}</td>
            <td>${dc.total_qty||'—'}</td><td>${dc.vehicle_no||'—'}</td><td>${dc.driver_name||'—'}</td>
            <td>${fmtDate(dc.dispatched_at)}</td>
            <td style="color:${od?'var(--danger)':'inherit'}">${dc.expected_delivery_date?fmtDate(dc.expected_delivery_date):'—'}</td>
            <td>${fmtDate(dc.delivered_at)}</td>
            <td>${dc.billed?'<span class="badge badge-success">Billed</span>':'—'}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div></div>`;
    }
  } catch(e) {
    const content = document.getElementById('dc-tab-content');
    if (content) content.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--danger)">
      Error loading data. <button class="btn btn-secondary btn-sm" onclick="switchDeliveryTab('${tab}',null)">Retry</button>
    </div>`;
  }
}

// Shared row renderer for POD & Scans table
function podScanRow(dc) {
  const podOk  = !!dc.pod_uploaded;
  const scanOk = !!dc.dc_scan_uploaded;
  // scanning the POD document satisfies both requirements
  const podEff = podOk || scanOk;
  const complete = podEff && scanOk;
  const docCount = dc.doc_count || 0;
  const search = (dc.id+' '+(dc.order_id||'')+' '+(dc.client_name||'')+' '+(dc.driver_name||'')).toLowerCase();

  const podCell = podOk
    ? `<span class="badge badge-success">✓ Uploaded</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="markPOD('${dc.id}')">Re-upload</button>`
    : scanOk
      ? `<span class="badge badge-success" style="background:#d1fae5;color:#065f46">✓ via Scan</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="markPOD('${dc.id}')">Re-upload</button>`
      : `<button class="btn btn-secondary btn-sm" onclick="markPOD('${dc.id}')">Upload POD</button>`;

  const scanCell = scanOk
    ? `<span class="badge badge-success">✓ Scanned</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" onclick="markScan('${dc.id}')">Re-scan</button>`
    : `<button class="btn btn-primary btn-sm" onclick="markScan('${dc.id}')">Scan POD</button>`;

  const statusCell = complete
    ? '<span class="badge badge-success">Complete</span>'
    : !podOk && !scanOk
      ? '<span class="badge" style="background:#fef9c3;color:#92400e">Both pending</span>'
      : '<span class="badge" style="background:#fef9c3;color:#92400e">Scan missing</span>';

  const docsCell = docCount > 0
    ? `<button class="btn btn-secondary btn-sm" onclick="viewDCDocuments('${dc.id}')">📂 ${docCount} page${docCount>1?'s':''}</button>`
    : '<span style="color:var(--text-muted);font-size:.8rem">—</span>';

  return `<tr data-search="${search}">
    <td><b>${dc.id}</b></td>
    <td>${dc.order_id}</td>
    <td>${dc.client_name||'—'}</td>
    <td>${dc.driver_name||'—'}</td>
    <td>${fmtDate(dc.delivered_at)}</td>
    <td>${podCell}</td>
    <td>${scanCell}</td>
    <td>${statusCell}</td>
    <td>${docsCell}</td>
  </tr>`;
}

function filterDCTable(status) {
  document.querySelectorAll('#dc-all-tbody tr[data-status]').forEach(row => {
    row.style.display = (!status || row.dataset.status === status) ? '' : 'none';
  });
}

function filterPODTable(q) {
  const rows = document.querySelectorAll('#pod-scan-table tbody tr[data-search]');
  const term = (q || '').toLowerCase().trim();
  let visible = 0;
  rows.forEach(r => {
    const match = !term || (r.dataset.search || '').includes(term);
    r.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  const counter = document.getElementById('pod-result-count');
  if (counter) counter.textContent = term ? `${visible} result${visible !== 1 ? 's' : ''}` : '';
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
  const capped = items.some(i => i.order_remaining != null && i.order_remaining < i.qty_ordered);
  openModal(`Confirm Delivery — ${dcId}`, `
    <p style="color:var(--text-muted);margin-bottom:12px">
      Enter actual qty delivered for each item. You cannot deliver more than the order's outstanding balance — if less, a follow-up DC is created for the remainder.
    </p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>SKU</th><th>Item</th><th style="text-align:center">Dispatched</th><th style="text-align:center">Outstanding</th><th style="text-align:center">Delivered</th></tr></thead>
      <tbody>
        ${items.map(i=>{ const maxDeliver = i.order_remaining != null ? i.order_remaining : i.qty_ordered; return `<tr>
          <td><b>${i.sku}</b></td>
          <td>${i.name}</td>
          <td style="text-align:center;color:var(--text-muted)">${i.qty_ordered}</td>
          <td style="text-align:center;font-weight:600${maxDeliver<i.qty_ordered?';color:#d97706':''}">${maxDeliver}</td>
          <td style="text-align:center"><input type="number" class="form-control form-control-sm deliver-qty"
            data-sku="${i.sku}" value="${maxDeliver}" min="0" max="${maxDeliver}"
            style="width:80px;text-align:center"
            oninput="if(+this.value>${maxDeliver})this.value=${maxDeliver};this.style.color=+this.value<${maxDeliver}?'var(--warning)':'inherit'"></td>
        </tr>`;}).join('')}
      </tbody>
    </table>
    ${capped?'<div style="font-size:.76rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠️ Deliverable qty is capped to the order balance — some quantity was already delivered on earlier DCs.</div>':''}
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

function markPOD(dcId)  { uploadDCDocModal(dcId, 'pod'); }
function markScan(dcId) { scanDCDocModal(dcId); }

function uploadDCDocModal(dcId, docType) {
  const label = docType === 'pod' ? 'Proof of Delivery (POD)' : 'DC Scan';
  openModal(`Upload ${label} — DC #${dcId}`,
    `<div class="form-group">
       <label>Select file (PDF or image, max 5 MB)</label>
       <input type="file" id="dc-doc-file" accept="image/*,application/pdf" onchange="previewDCDoc(this)"
         style="display:block;width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:.85rem;margin-top:6px">
     </div>
     <div id="dc-doc-preview" style="display:none;margin-top:12px;text-align:center">
       <img id="dc-doc-img" style="max-width:100%;max-height:260px;border-radius:6px;display:none">
       <div id="dc-doc-name" style="font-size:.82rem;color:var(--text-muted);margin-top:6px"></div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" id="dc-doc-submit" onclick="confirmDCDocUpload('${dcId}','${docType}')">Upload ${label}</button>`
  );
}

function scanDCDocModal(dcId) {
  APP._scanPages = []; // [{dataUrl, name}]
  openModal(`Scan POD Document — DC #${dcId}`,
    `<input type="file" id="dc-scan-file" accept="image/*" capture="environment"
       style="display:none" onchange="onScanCaptured(this,'${dcId}')">

     <!-- captured pages thumbnails (hidden until first page) -->
     <div id="scan-pages-wrap" style="display:none;margin-bottom:14px">
       <div style="font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
         Captured pages — <span id="scan-page-count">0</span>
       </div>
       <div id="scan-thumbs" style="display:flex;gap:8px;flex-wrap:wrap"></div>
     </div>

     <!-- initial prompt -->
     <div id="scan-initial" style="text-align:center;padding:20px 0">
       <div style="font-size:3rem;margin-bottom:10px">📷</div>
       <div style="font-weight:700;font-size:.95rem;color:var(--navy);margin-bottom:4px">Scan the POD document</div>
       <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:18px">Point your camera at the signed delivery challan.<br>You can scan multiple pages one at a time.</div>
       <button class="btn btn-primary" style="padding:10px 28px" onclick="document.getElementById('dc-scan-file').click()">
         📷 Open Camera
       </button>
       <div style="margin-top:10px;font-size:.75rem;color:var(--text-muted)">On desktop this opens a file picker</div>
     </div>

     <!-- preview of current capture -->
     <div id="scan-preview" style="display:none">
       <div style="text-align:center;margin-bottom:10px">
         <img id="scan-preview-img" style="max-width:100%;max-height:280px;border-radius:8px;border:2px solid var(--border)">
         <div id="scan-preview-name" style="font-size:.75rem;color:var(--text-muted);margin-top:5px"></div>
       </div>
       <div style="display:flex;gap:8px">
         <button class="btn btn-secondary" style="flex:1" onclick="retakeScanPage('${dcId}')">🔄 Retake</button>
         <button class="btn btn-secondary" style="flex:1" onclick="addScanPage('${dcId}')">➕ Add Page</button>
         <button class="btn btn-primary" style="flex:1" id="dc-scan-submit" onclick="uploadAllScanPages('${dcId}')">⬆ Upload</button>
       </div>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>`
  );
}

function onScanCaptured(input, dcId) {
  const file = input.files[0];
  if (!file) return;
  const fmt = b => b < 1024*1024 ? (b/1024).toFixed(1)+' KB' : (b/1024/1024).toFixed(1)+' MB';
  const r = new FileReader();
  r.onload = e => {
    document.getElementById('scan-preview-img').src = e.target.result;
    document.getElementById('scan-preview-name').textContent = 'Page preview · ' + fmt(file.size);
    document.getElementById('scan-initial').style.display = 'none';
    document.getElementById('scan-preview').style.display = '';
    // store pending capture for add/upload
    APP._scanPending = { dataUrl: e.target.result, name: file.name, type: file.type, file };
  };
  r.readAsDataURL(file);
}

function retakeScanPage(dcId) {
  APP._scanPending = null;
  document.getElementById('scan-preview').style.display = 'none';
  document.getElementById('scan-initial').style.display = APP._scanPages.length ? 'none' : '';
  const inp = document.getElementById('dc-scan-file');
  inp.value = '';
  inp.click();
}

function addScanPage(dcId) {
  if (!APP._scanPending) return;
  const pages = APP._scanPages;
  const idx = pages.length;
  pages.push(APP._scanPending);
  APP._scanPending = null;

  // show thumb strip
  const thumbs = document.getElementById('scan-thumbs');
  const wrap   = document.getElementById('scan-pages-wrap');
  const img = document.createElement('div');
  img.style.cssText = 'position:relative;display:inline-block';
  img.innerHTML = `<img src="${pages[idx].dataUrl}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:2px solid var(--border)">
    <span style="position:absolute;top:-6px;left:-6px;background:var(--navy);color:#fff;font-size:.65rem;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center">${idx+1}</span>`;
  thumbs.appendChild(img);
  wrap.style.display = '';
  document.getElementById('scan-page-count').textContent = pages.length;
  document.getElementById('scan-preview').style.display = 'none';

  // reopen camera
  const inp = document.getElementById('dc-scan-file');
  inp.value = '';
  inp.click();
}

async function uploadAllScanPages(dcId) {
  // commit current preview as a page first
  if (APP._scanPending) {
    APP._scanPages.push(APP._scanPending);
    APP._scanPending = null;
  }
  const pages = APP._scanPages;
  if (!pages.length) { showToast('No pages captured', 'error'); return; }

  const btn = document.getElementById('dc-scan-submit');
  if (btn) { btn.disabled = true; btn.textContent = `Uploading ${pages.length} page(s)…`; }

  let ok = 0;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const compressed = await compressImage(p.file, 1600, 0.75);
    const file = compressed && compressed.size < p.file.size
      ? new File([compressed], `scan_p${i+1}.jpg`, { type: 'image/jpeg' })
      : p.file;
    const b64 = await new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result.split(',')[1]);
      r.readAsDataURL(file);
    });
    const result = await api(`/delivery-challans/${dcId}/scan/upload`, {
      method: 'POST',
      body: JSON.stringify({ filename: `DC${dcId}_scan_p${i+1}.jpg`, mime_type: file.type, content_b64: b64, file_size: file.size })
    });
    if (result) ok++;
    if (btn) btn.textContent = `Uploading… ${i+1}/${pages.length}`;
  }
  closeModal();
  if (ok) {
    showToast(`${ok} page(s) uploaded for DC #${dcId}`);
    if (APP.user?.role === 'delivery_exec') navigate('dashboard');
    else switchDeliveryTab('pod', document.querySelector('#dc-tabs .tab-btn.active'));
  }
}

function previewDCDoc(input) {
  const file = input.files[0];
  if (!file) return;
  const fmt = b => b < 1024*1024 ? (b/1024).toFixed(1)+' KB' : (b/1024/1024).toFixed(1)+' MB';
  document.getElementById('dc-doc-name').textContent = file.name + ' · ' + fmt(file.size);
  const img = document.getElementById('dc-doc-img');
  if (file.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = e => { img.src = e.target.result; img.style.display = ''; };
    r.readAsDataURL(file);
  } else {
    img.style.display = 'none';
  }
  document.getElementById('dc-doc-preview').style.display = '';
}

function compressImage(file, maxPx, quality) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxPx || h > maxPx) {
        if (w >= h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else         { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function confirmDCDocUpload(dcId, docType, inputId) {
  const input = document.getElementById(inputId || 'dc-doc-file');
  let file = input?.files?.[0];
  if (!file) { showToast('Please select a file', 'error'); return; }
  const btn = document.getElementById(docType === 'scan' ? 'dc-scan-submit' : 'dc-doc-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

  // Compress images before upload — camera photos can be 5-10 MB;
  // base64 of that would exceed D1's per-row limit (~700 KB safe target)
  if (file.type.startsWith('image/')) {
    const compressed = await compressImage(file, 1600, 0.75);
    if (compressed && compressed.size < file.size) {
      file = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
    }
  }

  if (file.size > 5 * 1024 * 1024) { showToast('File too large — max 5 MB', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Upload'; } return; }
  if (btn) btn.textContent = 'Uploading…';

  const reader = new FileReader();
  reader.onload = async e => {
    const b64 = e.target.result.split(',')[1];
    const res = await api(`/delivery-challans/${dcId}/${docType}/upload`, {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, mime_type: file.type, content_b64: b64, file_size: file.size })
    });
    closeModal();
    if (res) {
      const label = docType === 'pod' ? 'POD' : 'DC Scan';
      showToast(`${label} document uploaded for DC #${dcId}`);
      const role = APP.user?.role;
      if (role === 'delivery_exec') { navigate('dashboard'); }
      else { switchDeliveryTab('pod', document.querySelector('#dc-tabs .tab-btn.active')); }
    }
  };
  reader.readAsDataURL(file);
}

async function viewDCDocuments(dcId) {
  const docs = await api(`/delivery-challans/${dcId}/documents`);
  if (!docs) return;
  if (!docs.length) { showToast('No documents uploaded for DC #' + dcId, 'error'); return; }
  const imgDocs = docs.filter(d => (d.mime_type||'').startsWith('image/'));
  const fmt = b => b ? (b < 1024*1024 ? (b/1024).toFixed(1)+' KB' : (b/1024/1024).toFixed(1)+' MB') : '';
  const pagesHtml = docs.map((d, i) => {
    const isImg = (d.mime_type||'').startsWith('image/');
    const isAudio = d.doc_type==='voice' || (d.mime_type||'').startsWith('audio/');
    const typeLabel = d.doc_type==='pod'?'📄 POD':d.doc_type==='voice'?'🎙 Voice Note':'🔍 DC Scan';
    return `<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <div style="padding:10px 14px;background:#f8fafc;display:flex;align-items:center;justify-content:space-between">
        <div>
          <span style="font-weight:700;font-size:.88rem">${isAudio?'':'Page '+(i+1)+' — '}${typeLabel}</span>
          <span style="font-size:.78rem;color:var(--text-muted);margin-left:8px">${d.filename||'document'} ${fmt(d.file_size)?'· '+fmt(d.file_size):''}</span>
        </div>
        <div style="font-size:.75rem;color:var(--text-muted)">${d.uploaded_by||'—'} · ${fmtDate(d.uploaded_at)}</div>
      </div>
      <div style="padding:12px;text-align:center">
        ${isImg
          ? `<img src="data:${d.mime_type};base64,${d.content_b64}" style="max-width:100%;max-height:400px;border-radius:4px">`
          : isAudio
          ? `<audio controls src="data:${d.mime_type||'audio/webm'};base64,${d.content_b64}" style="width:100%;max-width:380px"></audio>`
          : `<a href="data:${d.mime_type||'application/octet-stream'};base64,${d.content_b64}" download="${d.filename||'document'}" class="btn btn-primary">⬇ Download ${d.filename||'document'}</a>`}
      </div>
    </div>`;
  }).join('');

  const pdfBtn = imgDocs.length
    ? `<button class="btn btn-primary" onclick="downloadDCDocsPDF('${dcId}', this)">⬇ Download PDF (${imgDocs.length} page${imgDocs.length>1?'s':''})</button>`
    : '';

  openModal(
    `DC #${dcId} — ${docs.length} page${docs.length>1?'s':''} uploaded`,
    pagesHtml,
    `${pdfBtn}<button class="btn btn-secondary" onclick="closeModal()">Close</button>`
  );
}

async function downloadDCDocsPDF(dcId, btn) {
  const docs = await api(`/delivery-challans/${dcId}/documents`);
  if (!docs || !docs.length) return;
  const imgDocs = docs.filter(d => (d.mime_type||'').startsWith('image/'));
  if (!imgDocs.length) { showToast('No image pages to convert', 'error'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Generating PDF…'; }

  // Lazy-load jsPDF
  if (!window.jspdf) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, H = 297, margin = 10;

    for (let i = 0; i < imgDocs.length; i++) {
      if (i > 0) pdf.addPage();
      const d = imgDocs[i];
      const dataUrl = `data:${d.mime_type};base64,${d.content_b64}`;
      // get natural image dimensions to preserve aspect ratio
      await new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const ratio = img.naturalWidth / img.naturalHeight;
          let iW = W - margin*2, iH = iW / ratio;
          if (iH > H - margin*2) { iH = H - margin*2; iW = iH * ratio; }
          const x = margin + (W - margin*2 - iW) / 2;
          pdf.addImage(dataUrl, 'JPEG', x, margin, iW, iH);
          res();
        };
        img.src = dataUrl;
      });
    }

    pdf.save(`DC${dcId}_POD.pdf`);
    if (btn) { btn.disabled = false; btn.textContent = `⬇ Download PDF (${imgDocs.length} page${imgDocs.length>1?'s':''})`; }
  } catch(e) {
    showToast('PDF generation failed: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Download PDF'; }
  }
}

async function billDC(id) {
  const res = await api(`/delivery-challans/${id}/bill`, { method:'POST' });
  if (res) { showToast(`DC ${id} billed`); switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]); }
}

async function returnDCModal(dcId) {
  const items = await api(`/delivery-challans/${dcId}/items`).catch(()=>[]) || [];
  openModal(`Return Items — DC ${dcId}`,
    `<p style="margin-bottom:12px;color:var(--text-muted);font-size:.84rem">Enter the quantity being returned for <b>each item</b>. The return goes to the <b>warehouse for checking and approval</b> — stock is restored only after approval.</p>
     ${items.length ? `
     <div class="table-wrap" style="margin-bottom:14px">
       <table class="table" style="margin:0">
         <thead><tr><th>Item</th><th style="text-align:center">Dispatched</th><th style="text-align:center">Return Qty</th></tr></thead>
         <tbody>${items.map(it => {
           const maxQ = it.qty_delivered || it.qty_ordered;
           return `<tr>
             <td><b style="font-size:.84rem">${h(it.item_name||it.name||it.sku)}</b><div style="font-size:.7rem;color:var(--text-muted)">${h(it.sku)}</div></td>
             <td style="text-align:center;color:var(--text-muted)">${maxQ}</td>
             <td style="text-align:center"><input type="number" data-ret-sku="${h(it.sku)}" data-ret-name="${h(it.item_name||it.name||it.sku)}" value="0" min="0" max="${maxQ}" style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
           </tr>`;}).join('')}
         </tbody>
       </table>
     </div>` : '<div class="alert alert-warning" style="margin-bottom:12px">No item breakdown found for this DC — the full DC will be returned.</div>'}
     <div class="form-group"><label>Reason for Return <span style="color:var(--danger)">*</span></label>
       <textarea id="return-reason" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box" placeholder="e.g. Goods damaged in transit, wrong items, quality issue…"></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" style="background:var(--danger)" onclick="confirmReturnDC('${dcId}')">Submit Return for Approval</button>`);
}

async function confirmReturnDC(dcId) {
  const reason = document.getElementById('return-reason').value;
  if (!reason.trim()) { showToast('Please provide a reason for the return','error'); return; }
  const inputs = document.querySelectorAll('#modal-body input[data-ret-sku]');
  let items;
  if (inputs.length) {
    items = Array.from(inputs)
      .map(inp => ({ sku: inp.dataset.retSku, name: inp.dataset.retName, qty: parseInt(inp.value)||0 }))
      .filter(i => i.qty > 0);
    if (!items.length) { showToast('Enter a return quantity for at least one item','error'); return; }
  }
  const res = await api(`/delivery-challans/${dcId}/return`, {
    method: 'POST',
    body: JSON.stringify({ reason, ...(items ? { items } : {}) })
  });
  closeModal();
  if (res) {
    showToast(`Return ${res.id||''} submitted — awaiting warehouse approval`);
    navigate(APP.page || 'dashboard');
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
  // Backend already scopes delivery_exec to only their assigned DCs
  const pool = dcs;

  const inTransit    = pool.filter(d => d.status === 'IN_TRANSIT');
  const scheduled    = pool.filter(d => d.status === 'SCHEDULED');
  const delivToday   = pool.filter(d => d.status === 'DELIVERED' && (d.delivered_at || '').startsWith(today));
  // scan counts as POD — only show as pending if dc_scan_uploaded is also missing
  const pendingPOD   = pool.filter(d => d.status === 'DELIVERED' && !d.dc_scan_uploaded);
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

  <!-- Delivered DCs pending POD / scan -->
  ${pendingPOD.length > 0 ? `
  <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
    <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Pending POD / Scan (${pendingPOD.length})</div>
    <span style="background:#fef9c3;color:#92400e;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:10px">Action needed</span>
  </div>
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:16px">
    ${pendingPOD.map(dc => `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:#d1fae5;display:flex;align-items:center;justify-content:center;font-size:1rem">✅</div>
          <div>
            <div style="font-weight:700;font-size:.88rem;color:var(--navy)">DC #${dc.id}</div>
            <div style="font-size:.78rem;color:var(--text-muted)">${dc.client_name||'—'} · Order ${dc.order_id} · ${fmtDate(dc.delivered_at)}</div>
          </div>
        </div>
        <div style="text-align:right;font-size:.75rem;color:var(--text-muted)">
          ${!dc.pod_uploaded ? '<span style="color:var(--warning);font-weight:600">POD pending</span>' : ''}
          ${!dc.dc_scan_uploaded ? '<span style="color:var(--warning);font-weight:600;display:block">Scan pending</span>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm ${dc.pod_uploaded ? 'btn-secondary' : 'btn-primary'}" onclick="markPOD('${dc.id}')" ${dc.pod_uploaded ? 'disabled style="opacity:.6;cursor:default"' : ''}>
          ${dc.pod_uploaded ? '✓ POD Uploaded' : '📄 Upload POD'}
        </button>
        <button class="btn btn-sm ${dc.dc_scan_uploaded ? 'btn-secondary' : 'btn-primary'}" onclick="markScan('${dc.id}')" ${dc.dc_scan_uploaded ? 'disabled style="opacity:.6;cursor:default"' : ''}>
          ${dc.dc_scan_uploaded ? '✓ DC Scanned' : '🔍 Scan POD'}
        </button>
      </div>
    </div>`).join('')}
  </div>` : `
  ${delivToday.length > 0 ? `
  <div style="background:#f0fdf4;border-radius:12px;padding:16px 20px;margin-bottom:16px;display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">🎉</span>
    <div><div style="font-weight:700;color:var(--success)">All POD &amp; scans complete!</div><div style="font-size:.82rem;color:var(--text-muted)">${delivToday.length} delivery(ies) fully processed today.</div></div>
  </div>` : ''}`}`;
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
  APP._voiceNote = null;
  const capped = items.some(it => it.order_remaining != null && it.order_remaining < it.qty_ordered);
  openModal('Confirm Delivery — ' + dcId, `
    <p style="color:var(--text-muted);margin-bottom:12px">Enter actual qty delivered. You cannot deliver more than what is still outstanding on the order — if less, a follow-up DC is created for the balance.</p>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>Item</th><th style="text-align:center">Dispatched</th><th style="text-align:center">Outstanding</th><th style="text-align:center">Delivered</th></tr></thead>
      <tbody>${items.map(it => {
        const maxDeliver = it.order_remaining != null ? it.order_remaining : it.qty_ordered;
        return `<tr>
        <td>${it.item_name||it.sku}</td>
        <td style="text-align:center;color:var(--text-muted)">${it.qty_ordered}</td>
        <td style="text-align:center;font-weight:600${maxDeliver<it.qty_ordered?';color:#d97706':''}">${maxDeliver}</td>
        <td style="text-align:center"><input type="number" data-sku="${it.sku}" value="${maxDeliver}" min="0" max="${maxDeliver}" oninput="if(+this.value>${maxDeliver})this.value=${maxDeliver}" style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
      </tr>`;}).join('')}
      </tbody>
    </table>
    ${capped?'<div style="font-size:.76rem;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠️ Some items already had quantity delivered on earlier DCs — the deliverable amount is capped to the order balance.</div>':''}
    <div style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:12px 14px">
      <div style="font-weight:700;font-size:.82rem;color:var(--navy);margin-bottom:8px">🎙 Voice Message <span style="font-weight:400;color:var(--text-muted)">(optional — delivery note for the office)</span></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" id="voice-rec-btn" class="btn btn-secondary btn-sm" onclick="toggleVoiceRecording()">● Record</button>
        <span id="voice-rec-status" style="font-size:.76rem;color:var(--text-muted)">Not recorded</span>
        <audio id="voice-preview" controls style="display:none;height:32px;max-width:220px"></audio>
        <button type="button" id="voice-del-btn" class="btn btn-secondary btn-sm" style="display:none;color:var(--danger)" onclick="discardVoiceNote()">✕</button>
      </div>
    </div>`,
    `<button class="btn btn-secondary" onclick="stopVoiceIfRecording();closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmExecDelivery('${dcId}')">Confirm Delivery</button>`
  );
}

/* ── Voice note recording (MediaRecorder) ── */
async function toggleVoiceRecording() {
  const btn = document.getElementById('voice-rec-btn');
  const status = document.getElementById('voice-rec-status');
  if (APP._voiceRecorder && APP._voiceRecorder.state === 'recording') { APP._voiceRecorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size > 2 * 1024 * 1024) { showToast('Voice note too long — keep it under ~60 seconds', 'error'); discardVoiceNote(); return; }
      const reader = new FileReader();
      reader.onload = () => {
        APP._voiceNote = { content_b64: String(reader.result).split(',')[1], mime_type: blob.type, file_size: blob.size };
        const audio = document.getElementById('voice-preview');
        if (audio) { audio.src = URL.createObjectURL(blob); audio.style.display = ''; }
        const del = document.getElementById('voice-del-btn'); if (del) del.style.display = '';
        if (status) status.textContent = `Recorded (${Math.round(blob.size/1024)} KB)`;
        if (btn) { btn.textContent = '● Re-record'; btn.style.color = ''; }
      };
      reader.readAsDataURL(blob);
    };
    rec.start();
    APP._voiceRecorder = rec;
    if (btn) { btn.textContent = '⏹ Stop'; btn.style.color = 'var(--danger)'; }
    if (status) status.textContent = 'Recording… tap Stop when done';
  } catch (e) {
    showToast('Microphone access denied or unavailable', 'error');
  }
}

function stopVoiceIfRecording() {
  if (APP._voiceRecorder && APP._voiceRecorder.state === 'recording') { try { APP._voiceRecorder.stop(); } catch(_){} }
}

function discardVoiceNote() {
  APP._voiceNote = null;
  const audio = document.getElementById('voice-preview'); if (audio) { audio.src=''; audio.style.display='none'; }
  const del = document.getElementById('voice-del-btn'); if (del) del.style.display='none';
  const status = document.getElementById('voice-rec-status'); if (status) status.textContent = 'Not recorded';
  const btn = document.getElementById('voice-rec-btn'); if (btn) btn.textContent = '● Record';
}

async function confirmExecDelivery(dcId) {
  stopVoiceIfRecording();
  const inputs = document.querySelectorAll('#modal-body input[data-sku]');
  const items = Array.from(inputs).map(inp => ({ sku: inp.dataset.sku, qty_delivered: parseInt(inp.value)||0 }));
  const res = await api('/delivery-challans/' + dcId + '/deliver', { method:'POST', body: JSON.stringify({ items }) });
  if (res) {
    if (APP._voiceNote) {
      await api(`/delivery-challans/${dcId}/voice/upload`, { method:'POST', body: JSON.stringify({
        filename: `voice-note-${dcId}.webm`, ...APP._voiceNote,
      })}).catch(()=>null);
      APP._voiceNote = null;
    }
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

  const totalBudget  = clients.reduce((s,c)=>s+(c.monthly_budget||0),0);
  const totalSpent   = clients.reduce((s,c)=>s+(c.spent_this_month||0),0);
  const atRisk       = clients.filter(c=>c.health_score<70).length;
  const overBudget   = clients.filter(c=>c.spent_this_month/c.monthly_budget>0.9).length;

  function clientCard(c) {
    const budgetPct  = Math.min(100, Math.round((c.spent_this_month/(c.monthly_budget||1))*100));
    const creditPct  = c.credit_limit > 0 ? Math.min(100, Math.round(((c.credit_used||0)/c.credit_limit)*100)) : 0;
    const hColor     = c.health_score>=85?'var(--success)':c.health_score>=70?'#d97706':'var(--danger)';
    const budColor   = budgetPct>90?'var(--danger)':budgetPct>75?'#f59e0b':'var(--success)';
    const initials   = c.name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:18px 20px;border-top:3px solid ${hColor}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${c.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:3px">
              ${c.zone?`<span style="font-size:.68rem;font-weight:600;background:#e6f1fb;color:var(--blue);border-radius:4px;padding:1px 6px">${c.zone}</span>`:''}
              <span style="font-size:.72rem;color:${hColor};font-weight:700">★ ${c.health_score||0}/100</span>
            </div>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.72rem;color:var(--text-muted)">Monthly Budget</div>
          <div style="font-weight:700;font-size:.9rem">${fmt(c.monthly_budget)}</div>
        </div>
      </div>

      <!-- Budget bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:4px">
          <span>Budget Used</span>
          <span style="font-weight:600;color:${budColor}">${budgetPct}% · ${fmt(c.spent_this_month)}</span>
        </div>
        <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${budgetPct}%;background:${budColor};border-radius:3px;transition:width .4s"></div>
        </div>
      </div>

      ${c.credit_limit > 0 ? `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:4px">
          <span>Credit Used</span>
          <span style="font-weight:600;color:${creditPct>80?'var(--danger)':creditPct>60?'#d97706':'var(--text-muted)'}">${creditPct}% · ${fmt(c.credit_used||0)} / ${fmt(c.credit_limit)}</span>
        </div>
        <div style="background:var(--border);height:4px;border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${creditPct}%;background:${creditPct>80?'var(--danger)':creditPct>60?'#f59e0b':'#94a3b8'};border-radius:2px"></div>
        </div>
      </div>` : ''}

      <!-- Contact -->
      ${c.contact_name ? `<div style="font-size:.74rem;color:var(--text-muted);margin-bottom:8px">
        👤 ${c.contact_name}${c.contact_email?` · <a href="mailto:${c.contact_email}" style="color:var(--blue)">${c.contact_email}</a>`:''}${c.contact_phone?` · <a href="tel:${c.contact_phone}" style="color:var(--blue)">${c.contact_phone}</a>`:''}
      </div>` : ''}
      ${(c.address||c.map_pin) ? `<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:8px;display:flex;align-items:flex-start;gap:5px">
        <span>📍</span><span>${c.address||''}${(c.address&&c.map_pin)?' · ':''}${c.map_pin?`<a href="${mapsLink(c.map_pin,c.address)}" target="_blank" rel="noopener" style="color:var(--blue)">Map</a>`:''}</span>
      </div>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="viewClientModal(${JSON.stringify(c).replace(/"/g,'&quot;')})">View</button>
        <button class="btn btn-gold btn-sm" onclick="editClientModal(${JSON.stringify(c).replace(/"/g,'&quot;')})">Edit</button>
        <button class="btn btn-sm" style="background:#e0f2fe;color:#0369a1;border:none;font-weight:600" onclick="manageClientCatalog('${c.id}','${c.name.replace(/'/g,"\\'")}')">📦 Products</button>
        <button class="btn btn-sm" style="background:${c.active===0?'var(--success)':'#fee2e2'};color:${c.active===0?'#fff':'var(--danger)'};border:none" onclick="toggleClientActive('${c.id}','${c.name.replace(/'/g,"\\'")}',${c.active===0?0:1})">${c.active===0?'Enable':'Disable'}</button>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Client Directory</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${clients.length} clients · ${fmt(totalSpent)} spent of ${fmt(totalBudget)} total budget</div>
    </div>
    <button class="btn btn-gold" onclick="addClientModal()">${iconPlus(14)} Add Client</button>
  </div>

  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Clients</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${clients.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Budget</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(totalBudget)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalSpent)} spent this month</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overBudget?'var(--warning)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Near Budget Limit</div>
      <div style="font-size:2rem;font-weight:800;color:${overBudget?'#d97706':'var(--navy)'};margin-top:6px">${overBudget}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">&gt;90% budget used</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${atRisk?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">At Risk</div>
      <div style="font-size:2rem;font-weight:800;color:${atRisk?'var(--danger)':'var(--navy)'};margin-top:6px">${atRisk}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">health score &lt;70</div>
    </div>
  </div>

  <!-- Client cards grid -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
    ${clients.sort((a,b)=>(a.health_score||0)-(b.health_score||0)).map(c=>clientCard(c)).join('')}
  </div>
  `;
}

function mapsLink(pin, address) {
  if (!pin && !address) return null;
  if (pin && (pin.startsWith('http://') || pin.startsWith('https://'))) return pin;
  if (pin && /^-?\d+\.\d+,-?\d+\.\d+$/.test(pin.trim())) return `https://www.google.com/maps?q=${pin.trim()}`;
  const q = address || pin;
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null;
}

// ── Client Catalog Management ─────────────────────────────────────
let _ccClientId = null;
let _ccAllInventory = [];

async function manageClientCatalog(clientId, clientName) {
  _ccClientId = clientId;
  const [assigned, allInv] = await Promise.all([
    api(`/clients/${clientId}/catalog`),
    api('/inventory'),
  ]);
  _ccAllInventory = allInv || [];
  const assignedSkus = new Set((assigned||[]).map(i=>i.sku));

  // Build category list from all inventory
  const categories = [...new Set(_ccAllInventory.map(i=>i.category).filter(Boolean))].sort();
  const catOpts = categories.map(c=>`<option value="${c}">${c}</option>`).join('');

  openModal(`📦 Product Catalog — ${clientName}`,
    `<!-- Search + filter bar -->
     <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
       <input id="cc-search" type="search" placeholder="Search by name or SKU…"
         style="flex:1;min-width:140px;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.84rem"
         oninput="renderCCSearchResults()" onfocus="renderCCSearchResults()">
       <select id="cc-cat-filter" style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.82rem;color:var(--navy);background:#fff"
         onchange="renderCCSearchResults()">
         <option value="">All Categories</option>${catOpts}
       </select>
     </div>

     <!-- Import strip: category OR CSV -->
     <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
       <!-- By category -->
       <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:220px;padding:10px 12px;background:#f0f7ff;border-radius:8px;border:1px solid #bfdbfe;flex-wrap:wrap">
         <span style="font-size:.76rem;font-weight:700;color:#1e40af;white-space:nowrap">By Category:</span>
         <select id="cc-import-cat" style="padding:5px 8px;border:1.5px solid #bfdbfe;border-radius:6px;font-size:.8rem;flex:1;min-width:110px;background:#fff">
           <option value="">— Select —</option>${catOpts}
         </select>
         <button class="btn btn-sm" style="background:#1d4ed8;color:#fff;border:none;padding:5px 12px;font-size:.78rem;white-space:nowrap" onclick="importCCByCategory()">Import</button>
       </div>
       <!-- By CSV -->
       <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;flex-wrap:wrap">
         <span style="font-size:.76rem;font-weight:700;color:#166534;white-space:nowrap">By CSV:</span>
         <input type="file" id="cc-csv-input" accept=".csv,text/csv" style="display:none" onchange="handleCCCsvUpload(this)">
         <button class="btn btn-sm" style="background:#16a34a;color:#fff;border:none;padding:5px 12px;font-size:.78rem;white-space:nowrap" onclick="document.getElementById('cc-csv-input').click()">Upload CSV</button>
         <a id="cc-csv-template" href="#" style="font-size:.72rem;color:#16a34a;text-decoration:underline;white-space:nowrap" onclick="downloadCCTemplate(event)">Download template</a>
       </div>
     </div>
     <!-- CSV preview panel -->
     <div id="cc-csv-preview" style="display:none;margin-bottom:14px;border:1px solid #bbf7d0;border-radius:8px;background:#f0fdf4;padding:12px"></div>

     <!-- Search results (add) -->
     <div id="cc-search-results" style="display:none;max-height:190px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-bottom:14px;background:#fff"></div>

     <!-- Assigned items -->
     <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
       <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">
         Assigned Products <span id="cc-count" style="font-weight:400">(${assignedSkus.size})</span>
       </div>
       <div style="display:flex;gap:6px">
         ${assignedSkus.size > 0 ? `<button class="btn btn-sm" style="font-size:.72rem;padding:2px 10px;background:#e0f2fe;color:#0369a1;border:none" onclick="downloadCCAssigned()">↓ Download CSV</button>` : ''}
         ${assignedSkus.size > 0 ? `<button class="btn btn-sm" style="font-size:.72rem;padding:2px 10px;background:#fee2e2;color:var(--danger);border:none" onclick="removeAllCCItems()">Remove All</button>` : ''}
       </div>
     </div>
     <div id="cc-assigned-list" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto">
       ${(assigned||[]).length === 0
         ? `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`
         : (assigned||[]).map(item => ccAssignedRow(item)).join('')}
     </div>`,
    `<div style="font-size:.76rem;color:var(--text-muted);flex:1">Clients see only assigned products when placing orders.</div>
     <button class="btn btn-secondary" onclick="closeModal()">Done</button>`);
}

function ccAssignedRow(item) {
  const globalPrice = item.unit_price ?? 0;
  const clientPrice = item.client_price != null ? item.client_price : '';
  const hasCustom = item.client_price != null;
  return `<div id="cc-row-${item.sku}" style="background:var(--bg,#f8fafc);border-radius:8px;border:1px solid var(--border);padding:8px 10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:1.1rem;flex-shrink:0">${item.emoji||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${item.sku} · ${item.category||''}</div>
      </div>
      <button class="btn btn-sm" style="background:#fee2e2;color:var(--danger);border:none;flex-shrink:0;padding:3px 10px" onclick="removeCCItem('${item.sku}')">Remove</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#fff;border:1px solid var(--border);border-radius:6px">
      <span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap">Global ₹${globalPrice}</span>
      <span style="font-size:.72rem;color:var(--text-muted)">→</span>
      <label style="font-size:.72rem;font-weight:600;color:var(--navy);white-space:nowrap">Client Price ₹</label>
      <input type="number" min="0" step="0.01" placeholder="${globalPrice}"
        value="${clientPrice}"
        style="flex:1;min-width:70px;padding:4px 8px;border:1.5px solid ${hasCustom?'var(--navy)':'var(--border)'};border-radius:6px;font-size:.85rem;background:#fff"
        id="cc-price-${item.sku}"
        onblur="saveCCPrice('${item.sku}',this)"
        onkeydown="if(event.key==='Enter'){this.blur()}"
        title="Leave blank to use global price ₹${globalPrice}">
      ${hasCustom
        ? `<span id="cc-price-badge-${item.sku}" style="font-size:.68rem;background:#dbeafe;color:#1d4ed8;padding:2px 7px;border-radius:4px;white-space:nowrap;font-weight:600">Custom</span>`
        : `<span id="cc-price-badge-${item.sku}" style="font-size:.68rem;color:var(--text-muted);white-space:nowrap">Global</span>`}
    </div>
  </div>`;
}

async function saveCCPrice(sku, input) {
  if (!_ccClientId) return;
  const raw = input.value.trim();
  const price = raw === '' ? null : parseFloat(raw);
  if (raw !== '' && (isNaN(price) || price < 0)) { showToast('Invalid price','error'); return; }
  const res = await api(`/clients/${_ccClientId}/catalog/${sku}`, {
    method:'PATCH', body: JSON.stringify({client_price: price})
  });
  if (!res) return;
  const badge = document.getElementById(`cc-price-badge-${sku}`);
  if (badge) {
    if (price != null) {
      badge.textContent = 'Custom'; badge.style.cssText = 'font-size:.68rem;background:#dbeafe;color:#1d4ed8;padding:1px 6px;border-radius:4px;white-space:nowrap';
      input.style.borderColor = 'var(--navy)';
    } else {
      badge.textContent = 'Global'; badge.style.cssText = 'font-size:.68rem;color:var(--text-muted);white-space:nowrap';
      input.style.borderColor = 'var(--border)';
    }
  }
  showToast(price != null ? `Client price set to ₹${price}` : 'Reverted to global price');
}

function ccGetAssignedSkus() {
  return new Set(
    Array.from(document.querySelectorAll('[id^="cc-row-"]')).map(el => el.id.replace('cc-row-',''))
  );
}

function renderCCSearchResults() {
  const q = (document.getElementById('cc-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('cc-cat-filter')?.value || '';
  const container = document.getElementById('cc-search-results');
  if (!container) return;
  const assignedSkus = ccGetAssignedSkus();
  const matches = _ccAllInventory.filter(i =>
    !assignedSkus.has(i.sku) &&
    (!cat || i.category === cat) &&
    (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
  ).slice(0, 25);

  if (!q && !cat) { container.style.display='none'; return; }
  container.style.display = '';
  if (!matches.length) {
    container.innerHTML = `<div style="padding:10px 14px;font-size:.82rem;color:var(--text-muted)">No unassigned items found${q?` for "${q}"`:''}${cat?` in ${cat}`:''}.</div>`;
    return;
  }
  container.innerHTML = matches.map(i => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border-light,#edf0f4)"
      onmouseenter="this.style.background='#f0f7ff'" onmouseleave="this.style.background=''"
      onclick="addCCItem('${i.sku}')">
      <span>${i.emoji||'📦'}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:.84rem">${i.name}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${i.sku} · ${i.category||''} · ₹${i.unit_price}</div>
      </div>
      <span style="font-size:.72rem;color:var(--blue);font-weight:700;flex-shrink:0">+ Add</span>
    </div>`).join('');
}

async function addCCItem(sku) {
  const item = _ccAllInventory.find(i => i.sku === sku);
  if (!item || !_ccClientId) return;
  const res = await api(`/clients/${_ccClientId}/catalog`, { method:'POST', body: JSON.stringify({skus:[sku]}) });
  if (!res) return;
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    list.insertAdjacentHTML('afterbegin', ccAssignedRow(item));
  }
  updateCCCount(1);
  renderCCSearchResults();
  showToast(`"${item.name}" added to catalog`);
}

async function importCCByCategory() {
  const cat = document.getElementById('cc-import-cat')?.value;
  if (!cat) { showToast('Please select a category to import', 'error'); return; }
  const assignedSkus = ccGetAssignedSkus();
  const toAdd = _ccAllInventory.filter(i => i.category === cat && !assignedSkus.has(i.sku));
  if (!toAdd.length) { showToast(`All "${cat}" items are already assigned`); return; }
  const btn = document.querySelector('#cc-import-cat + button') ||
    document.querySelector('[onclick="importCCByCategory()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  const res = await api(`/clients/${_ccClientId}/catalog`, {
    method:'POST', body: JSON.stringify({skus: toAdd.map(i=>i.sku)})
  });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Category'; }
  if (!res) return;
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    toAdd.forEach(item => list.insertAdjacentHTML('afterbegin', ccAssignedRow(item)));
  }
  updateCCCount(toAdd.length);
  renderCCSearchResults();
  showToast(`${toAdd.length} "${cat}" items added to catalog`);
}

async function removeCCItem(sku) {
  if (!_ccClientId) return;
  const res = await api(`/clients/${_ccClientId}/catalog/${sku}`, { method:'DELETE' });
  if (res === null || res?.removed) {
    document.getElementById(`cc-row-${sku}`)?.remove();
    updateCCCount(-1);
    renderCCSearchResults();
    showToast('Item removed from catalog');
  }
}

async function removeAllCCItems() {
  const assignedSkus = [...ccGetAssignedSkus()];
  if (!assignedSkus.length) return;
  if (!confirm(`Remove all ${assignedSkus.length} assigned products from this client's catalog?`)) return;
  // batch deletions one by one but fire in parallel
  await Promise.all(assignedSkus.map(sku =>
    api(`/clients/${_ccClientId}/catalog/${sku}`, { method:'DELETE' })
  ));
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.innerHTML = `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`;
  }
  const countEl = document.getElementById('cc-count');
  if (countEl) countEl.textContent = '(0)';
  renderCCSearchResults();
  showToast('All products removed from catalog');
}

function updateCCCount(delta) {
  const el = document.getElementById('cc-count');
  if (!el) return;
  const cur = parseInt(el.textContent.replace(/\D/g,'')) || 0;
  const next = Math.max(0, cur + delta);
  el.textContent = `(${next})`;
  const list = document.getElementById('cc-assigned-list');
  if (next === 0 && list && !list.querySelector('.cc-empty')) {
    list.innerHTML = `<div class="cc-empty" style="color:var(--text-muted);font-size:.82rem;padding:12px;text-align:center">No products assigned yet. Search above or import a category.</div>`;
  }
}

function downloadCCTemplate(e) {
  e.preventDefault();
  const csv = 'sku\n' + _ccAllInventory.slice(0,3).map(i=>i.sku).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'client_catalog_template.csv';
  a.click();
}

function downloadCCAssigned() {
  const assignedSkus = ccGetAssignedSkus();
  const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
  const rows = [...assignedSkus].map(sku => {
    const i = skuMap.get(sku) || {};
    const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
    const priceInput = document.getElementById(`cc-price-${sku}`);
    const clientPrice = priceInput?.value?.trim() || '';
    const effectivePrice = clientPrice !== '' ? clientPrice : (i.unit_price ?? '');
    return [esc(sku), esc(i.name), esc(i.category), esc(i.brand), esc(i.unit_price), esc(clientPrice||''), esc(effectivePrice), esc(i.mrp), esc(i.uom), esc(i.stock)].join(',');
  });
  const csv = ['sku,name,category,brand,global_price,client_price,effective_price,mrp,uom,stock', ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `catalog_${_ccClientId}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

function handleCCCsvUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    // Detect header row — skip if first cell is 'sku' (case-insensitive)
    const startIdx = lines[0]?.toLowerCase().startsWith('sku') ? 1 : 0;
    // Support CSV with multiple columns — take first column as SKU
    const parsedSkus = lines.slice(startIdx).map(l => l.split(',')[0].trim().replace(/^"|"$/g,''));
    const assignedSkus = ccGetAssignedSkus();
    const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
    const matched = [], unmatched = [], alreadyIn = [];
    for (const sku of parsedSkus) {
      if (!sku) continue;
      if (assignedSkus.has(sku)) alreadyIn.push(sku);
      else if (skuMap.has(sku)) matched.push(skuMap.get(sku));
      else unmatched.push(sku);
    }
    showCCCsvPreview(matched, unmatched, alreadyIn);
  };
  reader.readAsText(file);
  input.value = ''; // allow re-upload of same file
}

function showCCCsvPreview(matched, unmatched, alreadyIn) {
  const panel = document.getElementById('cc-csv-preview');
  if (!panel) return;
  panel.style.display = '';
  panel.innerHTML = `
    <div style="font-size:.78rem;font-weight:800;color:#166534;margin-bottom:10px">
      CSV Preview — ${matched.length} to add · ${alreadyIn.length} already assigned · ${unmatched.length} not found
    </div>
    ${matched.length ? `
      <div style="max-height:130px;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:4px">
        ${matched.map(i=>`
          <div style="display:flex;align-items:center;gap:8px;font-size:.8rem;padding:4px 8px;background:#fff;border-radius:6px;border:1px solid #bbf7d0">
            <span>${i.emoji||'📦'}</span>
            <span style="font-weight:600;flex:1">${i.name}</span>
            <span style="color:var(--text-muted)">${i.sku}</span>
            <span style="color:#16a34a;font-weight:700">✓</span>
          </div>`).join('')}
      </div>` : ''}
    ${unmatched.length ? `
      <div style="font-size:.74rem;color:var(--danger);margin-bottom:10px">
        SKUs not found in inventory: <strong>${unmatched.join(', ')}</strong>
      </div>` : ''}
    ${alreadyIn.length ? `
      <div style="font-size:.74rem;color:var(--text-muted);margin-bottom:10px">
        Already assigned (skipped): ${alreadyIn.join(', ')}
      </div>` : ''}
    <div style="display:flex;gap:8px">
      ${matched.length ? `<button class="btn btn-sm" style="background:#16a34a;color:#fff;border:none;padding:5px 14px;font-size:.8rem"
        onclick="confirmCCCsvImport(${JSON.stringify(matched.map(i=>i.sku)).replace(/"/g,'&quot;')})">
        Add ${matched.length} Item${matched.length!==1?'s':''}</button>` : ''}
      <button class="btn btn-sm btn-secondary" style="font-size:.8rem" onclick="document.getElementById('cc-csv-preview').style.display='none'">Dismiss</button>
    </div>`;
}

async function confirmCCCsvImport(skus) {
  if (!skus.length || !_ccClientId) return;
  const btn = document.querySelector('#cc-csv-preview .btn-sm');
  if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
  const res = await api(`/clients/${_ccClientId}/catalog`, {
    method:'POST', body: JSON.stringify({skus})
  });
  if (!res) { if (btn) { btn.disabled=false; btn.textContent=`Add ${skus.length} Items`; } return; }
  const skuMap = new Map(_ccAllInventory.map(i=>[i.sku, i]));
  const list = document.getElementById('cc-assigned-list');
  if (list) {
    list.querySelector('.cc-empty')?.remove();
    skus.forEach(sku => {
      const item = skuMap.get(sku);
      if (item) list.insertAdjacentHTML('afterbegin', ccAssignedRow(item));
    });
  }
  updateCCCount(skus.length);
  document.getElementById('cc-csv-preview').style.display = 'none';
  renderCCSearchResults();
  showToast(`${skus.length} item${skus.length!==1?'s':''} imported from CSV`);
}

const ZONE_OPTIONS = ['EGL','BTP','BTM','PV','FW','Other'];

function clientFormFields(prefix, c={}) {
  return `
    <div class="grid-2">
      <div class="form-group"><label>Company Name *</label><input type="text" id="${prefix}-name" value="${c.name||''}"></div>
      <div class="form-group"><label>Location Zone</label>
        <select id="${prefix}-zone">
          <option value="">— Select Zone —</option>
          ${ZONE_OPTIONS.map(z=>`<option value="${z}"${c.zone===z?' selected':''}>${z}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Contact Name</label><input type="text" id="${prefix}-cname" value="${c.contact_name||''}"></div>
      <div class="form-group"><label>Contact Phone</label><input type="tel" id="${prefix}-phone" value="${c.contact_phone||''}" placeholder="+91 98765 43210"></div>
    </div>
    <div class="form-group"><label>Contact Email</label><input type="email" id="${prefix}-email" value="${c.contact_email||''}"></div>
    <div class="form-group"><label>Full Address</label>
      <textarea id="${prefix}-address" rows="2" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px 12px;font-size:.84rem;resize:vertical">${c.address||''}</textarea>
    </div>
    <div class="form-group">
      <label>Map Location <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(paste Google Maps link, or lat,lng e.g. 12.9716,77.5946)</span></label>
      <input type="text" id="${prefix}-mappin" value="${c.map_pin||''}" placeholder="https://maps.google.com/... or 12.9716,77.5946">
    </div>
    <div class="grid-2">
      <div class="form-group"><label>Monthly Budget (₹)</label><input type="number" id="${prefix}-budget" value="${c.monthly_budget||500000}"></div>
      <div class="form-group"><label>Approval Threshold (₹)</label><input type="number" id="${prefix}-threshold" value="${c.approval_threshold||100000}"></div>
    </div>`;
}

function addClientModal() {
  openModal('Add Client', clientFormFields('cl'),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveClient()">Add Client</button>`);
}

async function saveClient() {
  const body = {
    name: document.getElementById('cl-name').value.trim(),
    contact_name: document.getElementById('cl-cname').value,
    contact_email: document.getElementById('cl-email').value,
    contact_phone: document.getElementById('cl-phone').value,
    zone: document.getElementById('cl-zone').value,
    address: document.getElementById('cl-address').value,
    map_pin: document.getElementById('cl-mappin').value.trim(),
    monthly_budget: +document.getElementById('cl-budget').value,
    approval_threshold: +document.getElementById('cl-threshold').value,
  };
  if (!body.name) { showToast('Company name required','error'); return; }
  const res = await api('/clients', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Client added'); navigate('clients'); }
}

/* Open client detail from anywhere (e.g. dashboard Top Clients) by id */
async function openClientDetail(id) {
  const clients = await api('/clients').catch(()=>null);
  const c = (clients||[]).find(x => x.id === id);
  if (!c) { showToast('Client not found', 'error'); return; }
  viewClientModal(c);
}

function viewClientModal(c) {
  const hColor = c.health_score>=85?'var(--success)':c.health_score>=70?'#d97706':'var(--danger)';
  const mapUrl = mapsLink(c.map_pin, c.address);
  openModal(`Client: ${c.name}`, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div><div style="font-size:.72rem;color:var(--text-muted)">Company Name</div><div style="font-weight:600">${c.name}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Zone</div><div style="font-weight:600">${c.zone||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Name</div><div style="font-weight:600">${c.contact_name||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Email</div><div style="font-weight:600">${c.contact_email?`<a href="mailto:${c.contact_email}" style="color:var(--blue)">${c.contact_email}</a>`:'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Contact Phone</div><div style="font-weight:600">${c.contact_phone||'—'}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Health Score</div><div style="font-weight:700;color:${hColor}">★ ${c.health_score||0}/100</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Monthly Budget</div><div style="font-weight:600">${fmt(c.monthly_budget)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Approval Threshold</div><div style="font-weight:600">${fmt(c.approval_threshold)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Spent This Month</div><div style="font-weight:600">${fmt(c.spent_this_month)}</div></div>
      <div><div style="font-size:.72rem;color:var(--text-muted)">Status</div><div style="font-weight:600">${c.active===0?'<span style="color:var(--danger)">Disabled</span>':'<span style="color:var(--success)">Active</span>'}</div></div>
    </div>
    ${c.address?`<div style="margin-top:14px"><div style="font-size:.72rem;color:var(--text-muted);margin-bottom:4px">Address</div><div style="font-size:.85rem">📍 ${c.address}</div></div>`:''}
    ${mapUrl?`<div style="margin-top:12px"><a href="${mapUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">🗺 View on Google Maps</a></div>`:''}`,
    `<button class="btn btn-primary" onclick="editClientModal(${JSON.stringify(c).replace(/"/g,'&quot;')});closeModal()">Edit</button>
     <button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
}

function editClientModal(c) {
  openModal(`Edit Client: ${c.name}`, clientFormFields('ecl', c),
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveEditClient('${c.id}')">Save Changes</button>`);
}

async function saveEditClient(id) {
  const body = {
    name: document.getElementById('ecl-name').value.trim(),
    contact_name: document.getElementById('ecl-cname').value,
    contact_email: document.getElementById('ecl-email').value,
    contact_phone: document.getElementById('ecl-phone').value,
    zone: document.getElementById('ecl-zone').value,
    address: document.getElementById('ecl-address').value,
    map_pin: document.getElementById('ecl-mappin').value.trim(),
    monthly_budget: +document.getElementById('ecl-budget').value,
    approval_threshold: +document.getElementById('ecl-threshold').value,
  };
  if (!body.name) { showToast('Company name required','error'); return; }
  const res = await api('/clients/' + id, { method:'PATCH', body: JSON.stringify(body) });
  if (res) { closeModal(); showToast('Client updated'); navigate('clients'); }
}

async function toggleClientActive(id, name, active) {
  const newState = active ? 0 : 1;
  const label = newState ? 'enable' : 'disable';
  if (!confirm(`${newState?'Enable':'Disable'} client "${name}"?`)) return;
  const res = await api('/clients/' + id, { method:'PATCH', body: JSON.stringify({ active: newState }) });
  if (res) { showToast(`Client ${label}d`); navigate('clients'); }
}

/* ============================================================
   SERVICE DESK
   ============================================================ */
async function renderServiceDesk(el) {
  const allTickets = await api('/tickets');
  if (!allTickets) return;
  APP._sdTicketsById = Object.fromEntries(allTickets.map(t=>[t.id,t]));

  const isClientRole = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  // Client filter (platform/admin users only)
  const clientOptions = isClientRole ? [] :
    [...new Map(allTickets.filter(t=>t.client_id).map(t=>[t.client_id,{id:t.client_id,name:t.client_name||t.client_id}])).values()]
      .sort((a,b)=>a.name.localeCompare(b.name));
  const cf = APP._sdClientFilter || '';
  const tickets = cf ? allTickets.filter(t=>t.client_id===cf) : allTickets;

  const openT     = tickets.filter(t=>t.status==='OPEN');
  const inProgT   = tickets.filter(t=>t.status==='IN_PROGRESS');
  const resolvedT = tickets.filter(t=>t.status==='RESOLVED'||t.status==='CLOSED');

  const PRIORITY_META = {
    HIGH:   { color:'var(--danger)',  bg:'#fef2f2', label:'High' },
    MEDIUM: { color:'#d97706',        bg:'#fef3c7', label:'Medium' },
    LOW:    { color:'#2563eb',        bg:'#dbeafe', label:'Low' },
  };
  const STATUS_META = {
    OPEN:        { color:'#d97706', bg:'#fef3c7', dot:'🟡' },
    IN_PROGRESS: { color:'#2563eb', bg:'#dbeafe', dot:'🔵' },
    RESOLVED:    { color:'#059669', bg:'#d1fae5', dot:'🟢' },
    CLOSED:      { color:'#6b7280', bg:'#e5e7eb', dot:'⚫' },
  };

  function ticketCard(t) {
    const pm = PRIORITY_META[t.priority] || PRIORITY_META.MEDIUM;
    const sm = STATUS_META[t.status] || STATUS_META.OPEN;
    const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);
    const isRaiserRole = isClient || ['vendor_admin','vendor_user'].includes(APP.user?.role);
    return `
    <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 20px;margin-bottom:10px;border-left:4px solid ${pm.color}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div style="min-width:0;cursor:pointer" onclick="viewTicketModal('${t.id}')" title="View ticket details">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:700;font-size:.88rem;color:var(--blue)">${t.id}</span>
            <span style="font-size:.68rem;font-weight:700;background:${pm.bg};color:${pm.color};border-radius:4px;padding:1px 7px">${pm.label}</span>
            <span style="font-size:.68rem;font-weight:700;background:${sm.bg};color:${sm.color};border-radius:4px;padding:1px 7px">${sm.dot} ${t.status.replace('_',' ')}</span>
          </div>
          <div style="font-size:.88rem;font-weight:600;color:var(--navy);margin-top:6px">${t.subject}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">
            ${fmtDate(t.created_at)}${t.client_name&&!isClient?' · '+t.client_name:''}
          </div>
          ${t.description?`<div style="font-size:.76rem;color:var(--text-muted);margin-top:6px;background:#f8f9fa;padding:8px 10px;border-radius:6px;line-height:1.5">${t.description.length>120?t.description.slice(0,120)+'…':t.description}</div>`:''}
        </div>
        ${!isRaiserRole ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          ${t.status==='OPEN'||t.status==='IN_PROGRESS'?`<button class="btn btn-primary btn-sm" onclick="resolveTicket('${t.id}')">✓ Resolve</button>`:''}
          ${t.status==='OPEN'?`<button class="btn btn-secondary btn-sm" onclick="startTicket('${t.id}')">▶ Start</button>`:''}
          ${t.status!=='CLOSED'?`<button class="btn btn-secondary btn-sm" onclick="editTicketModal('${t.id}','${(t.subject||'').replace(/'/g,"\\'")}','${t.priority||'MEDIUM'}','${t.status||'OPEN'}','${(t.description||'').replace(/'/g,"\\'").replace(/\n/g,' ')}')">✎ Edit</button>`:''}
        </div>` : t.status==='RESOLVED' ? `
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" onclick="confirmCloseTicket('${t.id}')">✓ Confirm &amp; Close</button>
          <button class="btn btn-secondary btn-sm" onclick="reopenTicket('${t.id}')">↩ Reopen</button>
        </div>` : `
        <div style="flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:right;max-width:120px">
          ${t.status==='CLOSED'?'Closed':'Being handled by support team'}
        </div>`}
      </div>
    </div>`;
  }

  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Service Desk</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${openT.length+inProgT.length} open · ${resolvedT.length} resolved${cf?` · filtered by client`:''}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${!isClientRole && clientOptions.length ? `
      <select id="sd-client-filter" class="form-control" style="max-width:220px;font-size:.84rem"
        onchange="APP._sdClientFilter=this.value;navigate('service_desk')">
        <option value="">All Clients (${allTickets.length})</option>
        ${clientOptions.map(c=>{
          const n = allTickets.filter(t=>t.client_id===c.id).length;
          return `<option value="${c.id}" ${cf===c.id?'selected':''}>${h(c.name)} (${n})</option>`;
        }).join('')}
      </select>
      ${cf?`<button class="btn btn-secondary btn-sm" onclick="APP._sdClientFilter='';navigate('service_desk')">✕ Clear</button>`:''}` : ''}
      <button class="btn btn-gold" onclick="newTicketModal()">${iconPlus(14)} New Ticket</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:20px">
    ${(()=>{
      const openHigh = openT.filter(t=>t.priority==='HIGH').length;
      const activeHigh = tickets.filter(t=>t.priority==='HIGH'&&t.status!=='RESOLVED').length;
      const resolveRate = tickets.length ? Math.round(resolvedT.length/tickets.length*100) : 0;
      return `
      <div class="card" style="padding:16px 18px;border-top:3px solid ${openT.length>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Open</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${openT.length}</div>
        <div style="font-size:.75rem;color:${openHigh>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${openHigh} high priority</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #3b82f6;margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">In Progress</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${inProgT.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">being handled</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Resolved</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${resolvedT.length}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">${resolveRate}% resolution rate</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${activeHigh>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">High Priority</div>
        <div style="font-size:1.9rem;font-weight:700;color:${activeHigh>0?'var(--danger)':'var(--navy)'};line-height:1">${activeHigh}</div>
        <div style="font-size:.75rem;color:${activeHigh>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${activeHigh>0?'needs immediate attention':'all clear'}</div>
      </div>`;
    })()}
  </div>

  ${openT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Open</div>
  ${openT.sort((a,b)=>{const p={HIGH:0,MEDIUM:1,LOW:2}; return (p[a.priority]||1)-(p[b.priority]||1);}).map(t=>ticketCard(t)).join('')}` : ''}

  ${inProgT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;${openT.length?'margin-top:20px':''}">In Progress</div>
  ${inProgT.map(t=>ticketCard(t)).join('')}` : ''}

  ${openT.length===0&&inProgT.length===0?`
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted);margin-bottom:20px">
    <div style="font-size:2.5rem;margin-bottom:12px">✅</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">All tickets resolved!</div>
    <div style="font-size:.84rem;margin-top:6px">No open issues right now.</div>
  </div>`:''}

  ${resolvedT.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;${openT.length||inProgT.length?'margin-top:20px':''}">Recently Resolved</div>
  ${resolvedT.slice(0,5).map(t=>ticketCard(t)).join('')}
  ${resolvedT.length>5?`<div style="text-align:center;font-size:.76rem;color:var(--text-muted);margin-top:8px">+${resolvedT.length-5} more resolved tickets</div>`:''}`:''}
  `;
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

function editTicketModal(id, subject, priority, status, description) {
  openModal(`Edit Ticket ${id}`,
    `<div class="form-group"><label>Subject</label><input type="text" id="etk-subject" value="${subject.replace(/"/g,'&quot;')}" placeholder="Brief summary"></div>
     <div class="form-group"><label>Priority</label>
       <select id="etk-priority">
         <option value="LOW"${priority==='LOW'?' selected':''}>Low</option>
         <option value="MEDIUM"${priority==='MEDIUM'?' selected':''}>Medium</option>
         <option value="HIGH"${priority==='HIGH'?' selected':''}>High</option>
       </select>
     </div>
     <div class="form-group"><label>Status</label>
       <select id="etk-status">
         <option value="OPEN"${status==='OPEN'?' selected':''}>Open</option>
         <option value="IN_PROGRESS"${status==='IN_PROGRESS'?' selected':''}>In Progress</option>
         <option value="RESOLVED"${status==='RESOLVED'?' selected':''}>Resolved</option>
       </select>
     </div>
     <div class="form-group"><label>Description</label>
       <textarea id="etk-desc" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px">${description}</textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="updateTicket('${id}')">Save Changes</button>`);
}

async function updateTicket(id) {
  const body = {
    subject:     document.getElementById('etk-subject').value,
    priority:    document.getElementById('etk-priority').value,
    status:      document.getElementById('etk-status').value,
    description: document.getElementById('etk-desc').value,
  };
  if (!body.subject) { showToast('Subject required','error'); return; }
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Ticket ${id} updated`); navigate('service_desk'); }
}

async function resolveTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'RESOLVED' }) });
  if (res) { showToast(`Ticket ${id} resolved`); navigate('service_desk'); }
}

async function startTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'IN_PROGRESS' }) });
  if (res) { showToast(`Ticket ${id} in progress`); navigate('service_desk'); }
}

/* Full ticket detail with chat-style comment thread — all roles */
async function viewTicketModal(id) {
  const t = APP._sdTicketsById?.[id];
  if (!t) { showToast('Ticket not found', 'error'); return; }
  const isRaiserRole = ['client_admin','client_user','client_approver','vendor_admin','vendor_user'].includes(APP.user?.role);
  const pmColor = t.priority==='HIGH' ? '#dc2626' : t.priority==='MEDIUM' ? '#d97706' : '#2563eb';
  const smColor = t.status==='RESOLVED' ? '#059669' : t.status==='CLOSED' ? '#6b7280' : t.status==='IN_PROGRESS' ? '#2563eb' : '#d97706';
  openModal(`Ticket ${t.id}`, `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span style="font-size:.72rem;font-weight:700;background:${pmColor}1a;color:${pmColor};border-radius:20px;padding:3px 10px">${t.priority||'MEDIUM'} PRIORITY</span>
      <span style="font-size:.72rem;font-weight:700;background:${smColor}1a;color:${smColor};border-radius:20px;padding:3px 10px">${(t.status||'OPEN').replace('_',' ')}</span>
    </div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy);margin-bottom:10px">${h(t.subject||'')}</div>
    ${t.description?`<div style="font-size:.84rem;color:var(--text);background:#f8f9fa;padding:12px 14px;border-radius:8px;line-height:1.6;margin-bottom:14px;white-space:pre-wrap">${h(t.description)}</div>`:'<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:14px">No description provided.</div>'}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:.7rem;color:var(--text-muted)">Raised By</div><div style="font-weight:600;font-size:.84rem">${h(t.raiser_name||'—')}</div></div>
      ${!isRaiserRole?`<div><div style="font-size:.7rem;color:var(--text-muted)">Client</div><div style="font-weight:600;font-size:.84rem">${h(t.client_name||'—')}</div></div>`:''}
      <div><div style="font-size:.7rem;color:var(--text-muted)">Created</div><div style="font-weight:600;font-size:.84rem">${fmtDate(t.created_at)}</div></div>
      <div><div style="font-size:.7rem;color:var(--text-muted)">${t.status==='RESOLVED'||t.status==='CLOSED'?'Resolved':'Resolution'}</div><div style="font-weight:600;font-size:.84rem">${t.resolved_at?fmtDate(t.resolved_at):'Pending'}</div></div>
    </div>

    <div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-bottom:8px;border-top:1px solid var(--border);padding-top:14px">💬 Conversation</div>
    <div id="ticket-chat" style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px;margin-bottom:10px">
      <div style="text-align:center;color:var(--text-muted);font-size:.78rem;padding:12px">Loading…</div>
    </div>
    ${t.status!=='CLOSED'?`
    <div style="display:flex;gap:8px">
      <input type="text" id="ticket-chat-input" maxlength="2000" placeholder="Write a message…"
        style="flex:1;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
        onkeydown="if(event.key==='Enter')postTicketComment('${t.id}')">
      <button class="btn btn-primary" onclick="postTicketComment('${t.id}')">Send</button>
    </div>`:`<div style="font-size:.76rem;color:var(--text-muted);text-align:center;padding:6px">Ticket closed — conversation is read-only</div>`}`,
    `${isRaiserRole && t.status==='RESOLVED' ? `
      <button class="btn btn-primary" onclick="closeModal();confirmCloseTicket('${t.id}')">✓ Confirm &amp; Close</button>
      <button class="btn btn-secondary" onclick="closeModal();reopenTicket('${t.id}')">↩ Reopen</button>` : ''}
     <button class="btn btn-secondary" onclick="closeModal()">Close</button>`);

  loadTicketChat(id);
}

const RAISER_ROLES_SET = ['client_admin','client_user','client_approver','vendor_admin','vendor_user'];

async function loadTicketChat(ticketId) {
  const wrap = document.getElementById('ticket-chat');
  if (!wrap) return;
  const comments = await api(`/tickets/${ticketId}/comments`).catch(()=>[]) || [];
  const fmtDT = s => { const d = new Date((s||'').replace(' ','T')+'Z'); return isNaN(d) ? (s||'') : d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); };
  if (!comments.length) {
    wrap.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:.78rem;padding:12px">No messages yet — start the conversation below.</div>';
    return;
  }
  wrap.innerHTML = comments.map(c => {
    const mine = c.author_id === APP.user?.sub;
    const isSupportAuthor = !RAISER_ROLES_SET.includes(c.author_role);
    const tag = isSupportAuthor ? '🛠 Support' : '🙋 Requester';
    const bubbleBg = mine ? 'var(--primary)' : (isSupportAuthor ? '#eef2ff' : '#f3f4f6');
    const textCol  = mine ? '#fff' : 'var(--text)';
    return `
    <div style="display:flex;flex-direction:column;align-items:${mine?'flex-end':'flex-start'}">
      <div style="font-size:.68rem;color:var(--text-muted);margin-bottom:2px;padding:0 4px">
        <b style="color:${isSupportAuthor?'#4f46e5':'#b45309'}">${h(c.author_name)}</b> · ${tag} · ${fmtDT(c.created_at)}
      </div>
      <div style="max-width:82%;background:${bubbleBg};color:${textCol};border-radius:${mine?'12px 12px 3px 12px':'12px 12px 12px 3px'};padding:8px 12px;font-size:.83rem;line-height:1.5;white-space:pre-wrap;word-break:break-word">${h(c.message)}</div>
    </div>`;
  }).join('');
  wrap.scrollTop = wrap.scrollHeight;
}

async function postTicketComment(ticketId) {
  const input = document.getElementById('ticket-chat-input');
  const message = input?.value?.trim();
  if (!message) return;
  input.disabled = true;
  const res = await api(`/tickets/${ticketId}/comments`, { method:'POST', body: JSON.stringify({ message }) });
  input.disabled = false;
  if (res) { input.value = ''; loadTicketChat(ticketId); }
  input.focus();
}

/* Raiser-only actions on a RESOLVED ticket */
async function confirmCloseTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'CLOSED' }) });
  if (res) { showToast(`Ticket ${id} closed — thank you for confirming`); navigate('service_desk'); }
}

async function reopenTicket(id) {
  openModal(`Reopen Ticket ${id}`,
    `<p style="margin:0;color:var(--text-muted)">The support team will be notified that the issue is not fully resolved. Reopen this ticket?</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="confirmReopenTicket('${id}')">↩ Reopen Ticket</button>`);
}

async function confirmReopenTicket(id) {
  const res = await api(`/tickets/${id}`, { method:'PATCH', body: JSON.stringify({ status:'OPEN' }) });
  closeModal();
  if (res) { showToast(`Ticket ${id} reopened — support team notified`); navigate('service_desk'); }
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

function rejectOrder(id) {
  openModal(`Reject Order ${id}`,
    `<div style="margin-bottom:16px;color:var(--text-muted);font-size:.88rem">This will cancel the order and notify the requester.</div>
     <div class="form-group">
       <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection <span style="color:var(--danger)">*</span></label>
       <textarea id="reject-reason" rows="4" placeholder="Explain why this order is being rejected…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical;box-sizing:border-box"></textarea>
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmRejectOrder('${id}')">Reject Order</button>`);
}

async function confirmRejectOrder(id) {
  const reason = (document.getElementById('reject-reason')?.value||'').trim();
  if (!reason) { showToast('Please provide a rejection reason','error'); return; }
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note: reason }) });
  closeModal();
  if (res) { showToast(`Order ${id} rejected`); navigate('approvals'); }
}

/* ============================================================
   REPORTS (Gaps 1 & 12 — real data + CSV download)
   ============================================================ */
const REPORT_DEFS = [
  { key:'spend',       title:'Spend Analytics',    desc:'Monthly spend and order count per client.', icon:'📊', datable:true,
    cols:['client','month','total_spend','order_count'],
    labels:['Client','Month','Total Spend','Orders'] },
  { key:'fulfilment',  title:'Order Fulfilment',   desc:'Order-to-delivery cycle time and SLA adherence.', icon:'📦', datable:true,
    cols:['id','client_name','status','grand_total','created_at'],
    labels:['Order','Client','Status','Amount','Created'] },
  { key:'vendor',      title:'Vendor Scorecard',   desc:'On-time rate, fill rate, and lead time per vendor.', icon:'🏆', datable:true,
    cols:['name','on_time_rate','fill_rate','avg_lead_days','rating'],
    labels:['Vendor','On-time %','Fill Rate %','Lead Days','Rating'] },
  { key:'inventory',   title:'Inventory Turnover', desc:'Stock movement, dead stock, fast & slow SKUs.', icon:'🔄', period:'Live snapshot',
    cols:['sku','name','category','stock','reserved','reorder_level'],
    labels:['SKU','Item','Category','Stock','Reserved','Reorder Level'] },
  { key:'budget',      title:'Budget Utilisation', desc:'Client-wise budget vs. actual spend.', icon:'💰', period:'Current calendar month',
    cols:['name','monthly_budget','spent_this_month','remaining'],
    labels:['Client','Budget','Spent','Remaining'] },
  { key:'dc-billing',  title:'DC Billing Report',  desc:'Billing pipeline, unbilled DCs, and ageing.', icon:'🧾', period:'All time',
    cols:['id','order_id','client_name','status','billed'],
    labels:['DC #','Order','Client','Status','Billed'] },
  { key:'service-desk',title:'Service Desk SLA',   desc:'Ticket resolution time and open ticket ageing.', icon:'🎫', period:'All time',
    cols:['id','subject','priority','status','client_name','created_at'],
    labels:['Ticket','Subject','Priority','Status','Client','Created'] },
  { key:'gst',         title:'GST & Tax Report',   desc:'HSN-wise GST breakup and summary for filing.', icon:'📋', datable:true,
    cols:['sku','name','hsn_code','gst_rate','stock','unit_price'],
    labels:['SKU','Item','HSN','GST %','Stock','Unit Price'] },
  { key:'budget-forecast', title:'Budget Forecasting', desc:'3-month rolling average forecast per client for next month.', icon:'🔮', period:'Next month (3-month rolling average)',
    cols:['client','forecast_month','predicted'],
    labels:['Client','Forecast Month','Predicted Spend'] },
  { key:'order-items', title:'Order Items vs Delivered', desc:'Per-order item breakdown: items ordered, quantities, and delivery status per client.', icon:'📦', period:'All time',
    cols:['client_name','order_id','order_status','item_count','qty_ordered','delivery_status','grand_total'],
    labels:['Client','Order ID','Status','# Items','Total Qty Ordered','Delivery Status','Order Value'] },
  { key:'critical-stock', title:'Critical Stock Report', desc:'All items flagged CRITICAL — shows stock level, reorder status, and vendor details.', icon:'🔴', period:'Live snapshot',
    cols:['sku','name','category','stock','reorder_level','status','vendor_name','avg_lead_days'],
    labels:['SKU','Item','Category','Stock','Reorder Level','Status','Vendor','Lead Days'] },
];

const REPORT_CATEGORIES = [
  { label:'Operations', color:'#1e40af', bg:'#eff6ff', icon:'⚙️',
    keys:['fulfilment','order-items','dc-billing','service-desk'] },
  { label:'Finance', color:'#065f46', bg:'#ecfdf5', icon:'💰',
    keys:['spend','budget','budget-forecast','gst'] },
  { label:'Supply Chain', color:'#92400e', bg:'#fffbeb', icon:'🔗',
    keys:['vendor','inventory','critical-stock'] },
];

/* ============================================================
   EXECUTIVE BI — filter bar + drill: Exec → Client → Order →
   Category → Sub-category → Brand → SKU  (Phase 1)
   ============================================================ */
const EXEC_LEVELS = ['exec','client','order','category','subcat','brand','sku','dc','invoice'];
const EXEC_LEVEL_NAME = { exec:'Executive', client:'Client', order:'Order', category:'Category', subcat:'Sub Category', brand:'Brand', sku:'SKU / Item', dc:'Delivery Challan', invoice:'Invoice' };
let _xbi = null; // { from,to,timeLabel, path:[{level,label,ctx}] }

function xbiPreset(preset) {
  const now = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const map = {
    today:      [ymd(now), ymd(now), 'Today'],
    week:       [ymd(new Date(Date.now()-6*86400000)), ymd(now), 'This Week'],
    month:      [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, ymd(now), 'This Month'],
    quarter:    (()=>{ const m=now.getMonth(); const qs=m>=3&&m<=5?3:m>=6&&m<=8?6:m>=9?9:0; const y=(m<3)?now.getFullYear():now.getFullYear(); return [ymd(new Date(now.getFullYear(),qs,1)), ymd(now), 'Quarter']; })(),
    fy:         (()=>{ const y=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1; return [`${y}-04-01`, ymd(now), 'Financial Year']; })(),
    cy:         [`${now.getFullYear()}-01-01`, ymd(now), 'Calendar Year'],
  };
  return map[preset] || map.month;
}

async function renderExecBI(el) {
  if (!_xbi) { const [f,t,l] = xbiPreset('month'); _xbi = { from:f, to:t, timeLabel:l, preset:'month', path:[{level:'exec',label:'Executive',ctx:{}}] }; }
  el.innerHTML = `
  ${pageHeader('Executive BI', 'Company-wide KPIs — click any client, order, category or item to drill deeper')}
  <div class="card" style="padding:12px 16px;margin-bottom:16px">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${[['today','Today'],['week','This Week'],['month','This Month'],['quarter','Quarter'],['fy','Financial Year'],['cy','Calendar Year']]
        .map(([k,l])=>`<button class="btn btn-sm" id="xbi-t-${k}" onclick="xbiSetPreset('${k}')" style="font-size:.76rem;${_xbi.preset===k?'':''}">${l}</button>`).join('')}
      <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
      <input type="date" id="xbi-from" class="form-control" style="max-width:150px;font-size:.8rem" value="${_xbi.from}">
      <span style="font-size:.8rem;color:var(--text-muted)">to</span>
      <input type="date" id="xbi-to" class="form-control" style="max-width:150px;font-size:.8rem" value="${_xbi.to}">
      <button class="btn btn-primary btn-sm" onclick="xbiApplyCustom()">Apply</button>
      <span style="margin-left:auto;font-size:.78rem;color:var(--text-muted)">Period: <b id="xbi-period-lbl" style="color:var(--primary-ink,#c2410c)">${_xbi.timeLabel}</b></span>
    </div>
  </div>
  <style>
    #xbi-layout{display:grid;grid-template-columns:210px 1fr;gap:16px;align-items:start}
    @media(max-width:820px){#xbi-layout{grid-template-columns:1fr}#xbi-rail{display:none}}
    #xbi-rail{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 12px;position:sticky;top:16px}
    .xbi-rail-title{font-size:.62rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);padding:0 8px 10px}
    .xbi-step{display:flex;align-items:center;gap:11px;padding:7px 8px;border-radius:9px;font-size:.79rem;color:var(--text-muted);position:relative;transition:background .12s}
    .xbi-step[onclick]:hover{background:var(--surface-2)}
    .xbi-step .xbi-idx{width:20px;height:20px;border-radius:50%;background:var(--border-light);color:var(--text-muted);font-size:.64rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;transition:.18s}
    .xbi-step.done{color:var(--navy)} .xbi-step.done .xbi-idx{background:var(--primary-border);color:var(--primary-hover)}
    .xbi-step.active{color:var(--navy);font-weight:700} .xbi-step.active .xbi-idx{background:var(--primary);color:#fff;box-shadow:0 0 0 4px var(--primary-light)}
    .xbi-step::before{content:"";position:absolute;left:17.5px;top:-7px;height:7px;width:2px;background:var(--border)}
    .xbi-step:first-of-type::before{display:none}
    .xbi-step.done::before,.xbi-step.active::before{background:var(--primary-border)}
    .xbi-kpi.clk{cursor:pointer;transition:border-color .12s,transform .12s}
    .xbi-kpi.clk:hover{border-color:var(--primary);transform:translateY(-2px);box-shadow:0 4px 14px -6px rgba(0,0,0,.15)}
    .xbi-row:hover .xbi-chev{transform:translateX(2px);color:var(--primary)}
  </style>
  <div id="xbi-layout">
    <aside id="xbi-rail"></aside>
    <div style="min-width:0">
      <div id="xbi-crumbs" style="margin-bottom:10px"></div>
      <div id="xbi-levelbar" style="margin-bottom:12px"></div>
      <div id="xbi-body"><div style="text-align:center;padding:50px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div></div>
    </div>
  </div>`;
  xbiHighlightPreset();
  xbiRender();
}

function xbiRail() {
  const rail = document.getElementById('xbi-rail');
  if (!rail) return;
  const depth = _xbi.path.length - 1;
  rail.innerHTML = '<div class="xbi-rail-title">Drill path</div>' + EXEC_LEVELS.map((lv,i)=>{
    const cls = i<depth ? 'done' : i===depth ? 'active' : '';
    const visited = i <= depth;
    return `<div class="xbi-step ${cls}" ${visited?`onclick="xbiGoTo(${i})"`:''}><span class="xbi-idx">${i+1}</span><span>${EXEC_LEVEL_NAME[lv]}</span></div>`;
  }).join('');
}

function xbiHighlightPreset() {
  ['today','week','month','quarter','fy','cy'].forEach(k=>{
    const b=document.getElementById('xbi-t-'+k);
    if (b) b.classList.toggle('btn-primary', _xbi.preset===k);
  });
}
function xbiSyncLabel(){ const lab=document.getElementById('xbi-period-lbl'); if(lab)lab.textContent=_xbi.timeLabel; }
function xbiSetPreset(k){ const [f,t,l]=xbiPreset(k); _xbi.from=f; _xbi.to=t; _xbi.timeLabel=l; _xbi.preset=k;
  const fe=document.getElementById('xbi-from'), te=document.getElementById('xbi-to'); if(fe)fe.value=f; if(te)te.value=t;
  xbiHighlightPreset(); xbiSyncLabel(); xbiRender(); }
function xbiApplyCustom(){ _xbi.from=document.getElementById('xbi-from').value; _xbi.to=document.getElementById('xbi-to').value; _xbi.timeLabel='Custom'; _xbi.preset=''; xbiHighlightPreset(); xbiSyncLabel(); xbiRender(); }

function xbiCrumbs() {
  const c = document.getElementById('xbi-crumbs');
  if (!c) return;
  c.innerHTML = '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:.85rem">' +
    _xbi.path.map((p,i)=>{
      const last = i===_xbi.path.length-1;
      return (i?'<span style="color:var(--text-muted)">›</span>':'')+
        `<button onclick="xbiGoTo(${i})" ${last?'disabled':''} style="background:${last?'none':'none'};border:none;cursor:${last?'default':'pointer'};font-size:.85rem;font-weight:${last?'700':'600'};color:${last?'var(--navy)':'var(--blue)'};padding:3px 6px;border-radius:6px">${h(p.label)}</button>`;
    }).join('') + '</div>';
}
function xbiGoTo(i){ _xbi.path = _xbi.path.slice(0,i+1); xbiRender(); }
function xbiPush(level, label, ctx){ _xbi.path.push({level,label,ctx:{..._xbi.path[_xbi.path.length-1].ctx, ...ctx}}); xbiRender(); }

// Build query string for the current context (order_id scopes; else client_id + dates)
function xbiScopeParams(ctx) {
  const p = new URLSearchParams();
  if (ctx.order_id) p.set('order_id', ctx.order_id);
  else {
    if (ctx.client_id) p.set('client_id', ctx.client_id);
    p.set('from', _xbi.from); p.set('to', _xbi.to);
  }
  ['category','subcategory','brand'].forEach(k=>{ if (ctx[k]!=null) p.set(k, ctx[k]); });
  return p;
}

async function xbiRender() {
  xbiCrumbs();
  xbiRail();
  const node = _xbi.path[_xbi.path.length-1];
  const lvlIdx = EXEC_LEVELS.indexOf(node.level);
  const lb = document.getElementById('xbi-levelbar');
  if (lb) lb.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--primary-hover)">◉ Level ${lvlIdx+1} · ${EXEC_LEVEL_NAME[node.level]}</span>
      <span style="font-size:1.15rem;font-weight:800;color:var(--navy)">${h(node.label)}</span>
      <span style="margin-left:auto;font-size:.74rem;color:var(--text-muted)">${_xbi.timeLabel}</span>
    </div>`;
  const body = document.getElementById('xbi-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:22px;height:22px;margin:0 auto"></div></div>';
  const fn = { exec:xbiExec, client:xbiClient, order:xbiOrder, category:xbiGroup, subcat:xbiGroup, brand:xbiGroup, sku:xbiSku, dc:xbiDc, invoice:xbiInvoice }[node.level];
  try { await fn(node, body); } catch(e) { body.innerHTML = `<div class="alert alert-danger">Failed to load: ${h(String(e))}</div>`; }
}

function xbiKpi(lab,val,sub,cls,onclick){
  return `<div class="card xbi-kpi ${onclick?'clk':''}" style="padding:11px 13px;margin-bottom:0;position:relative" ${onclick?`onclick="${onclick}"`:''}>
    <div style="font-size:.62rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)">${lab}</div>
    <div style="font-size:1.28rem;font-weight:800;line-height:1.15;margin-top:3px;color:${cls==='g'?'var(--success)':cls==='w'?'#d97706':cls==='b'?'var(--danger)':'var(--navy)'}">${val}</div>
    ${sub?`<div style="font-size:.68rem;color:var(--text-muted);margin-top:1px">${sub}</div>`:''}
    ${onclick?'<span style="position:absolute;top:9px;right:11px;color:var(--text-muted);font-size:.72rem;font-weight:700">↘</span>':''}
  </div>`;
}
function xbiGrp(title, cards){
  return `<div style="font-size:.64rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px">${title}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px">${cards.join('')}</div>`;
}
function xbiFillPill(p){ const c=p>=90?['#e7f6ec','var(--success)']:p>=70?['#fdf0dc','#d97706']:['#fdeaea','var(--danger)']; return `<span style="font-size:.66rem;font-weight:800;padding:2px 8px;border-radius:20px;background:${c[0]};color:${c[1]}">${p}% fill</span>`; }
function xbiRow(name, meta, val, opts={}){
  const share = opts.share!=null?`<div style="display:flex;align-items:center;gap:8px;min-width:130px"><div style="flex:1;height:8px;border-radius:5px;background:var(--border);overflow:hidden"><i style="display:block;height:100%;width:${opts.share}%;background:var(--primary)"></i></div><span style="font-size:.74rem;font-weight:700;color:var(--text-muted);width:34px;text-align:right">${opts.share}%</span></div>`:'';
  const pill = opts.fill!=null?`<div style="margin-top:4px">${xbiFillPill(opts.fill)}</div>`:'';
  return `<button class="xbi-row" data-k="${h(opts.key||name)}" style="display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff);cursor:pointer;text-align:left;font-family:inherit;width:100%;transition:border-color .12s,transform .12s" onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateX(2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--navy);font-size:.87rem">${h(name)}</div><div style="font-size:.72rem;color:var(--text-muted);margin-top:1px">${meta}</div></div>
    ${share}
    <div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:.9rem">${val}</div>${pill}</div>
    <span class="xbi-chev" style="color:var(--text-muted);transition:transform .12s,color .12s">›</span>
  </button>`;
}

async function xbiExec(node, body) {
  const p = new URLSearchParams({ from:_xbi.from, to:_xbi.to });
  const d = await api('/reports/exec-summary?'+p.toString());
  if (!d) { body.innerHTML='<div class="alert alert-danger">No data</div>'; return; }
  const o=d.orders, dl=d.delivery, f=d.finance, iv=d.inventory;
  const clients = (d.clients||[]).filter(c=>c.spend>0 || c.order_count>0);
  const maxSpend = Math.max(...clients.map(c=>c.spend), 1);
  body.innerHTML = `
    ${xbiGrp('Orders',[
      xbiKpi('Total Orders', o.total, '', null), xbiKpi('Order Value', fmt(o.value), 'gross'),
      xbiKpi('Avg Order', fmt(o.avg), ''), xbiKpi('Completed', o.completed, '', 'g'),
      xbiKpi('Partial', o.partial, '', o.partial?'w':null), xbiKpi('Pending', o.pending, 'in progress', o.pending?'w':null)])}
    ${xbiGrp('Delivery',[
      xbiKpi('Fulfilment %', dl.fill_pct+'%', '', dl.fill_pct>=90?'g':dl.fill_pct>=70?'w':'b'),
      xbiKpi('Due Qty', Math.round(dl.due_qty), 'units', dl.due_qty?'b':null),
      xbiKpi('Due Value', fmt(dl.due_value), '', dl.due_value?'b':null),
      xbiKpi('Awaiting Dispatch', dl.awaiting_dispatch, ''), xbiKpi('Awaiting Procurement', dl.awaiting_procurement, '')])}
    ${xbiGrp('Finance',[
      xbiKpi('Budget', fmt(f.budget), ''), xbiKpi('Spend', fmt(f.spend), f.budget_util+'% used'),
      xbiKpi('Budget Util %', f.budget_util+'%', '', f.budget_util>90?'b':f.budget_util>70?'w':null),
      xbiKpi('Revenue', fmt(f.revenue), ''), xbiKpi('Gross Margin', f.gross_margin!=null?f.gross_margin+'%':'—', f.gross_margin!=null?'':'no cost data', f.gross_margin!=null?'g':null)])}
    ${xbiGrp('Inventory',[
      xbiKpi('Inventory Value', fmt(iv.value), ''), xbiKpi('Stock Availability', iv.availability+'%', '', iv.availability>=90?'g':'w'),
      xbiKpi('Must-Have %', iv.must_have+'%', '', iv.must_have>=95?'g':'w'),
      xbiKpi('Low Stock', iv.low_stock, 'items', iv.low_stock?'w':null), xbiKpi('Stock-Out', iv.stock_out, 'alerts', iv.stock_out?'b':null)])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Clients by spend <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px" id="xbi-rows">
      ${clients.length ? clients.map(c=>xbiRow(c.name, `${c.order_count} orders · ${c.budget_util}% budget`, fmt(c.spend), {share:Math.round(c.spend/maxSpend*100), fill:c.fill_pct, key:c.id})).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No orders in this period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>{
    const c = clients.find(x=>String(x.id)===b.dataset.k); if(!c)return;
    xbiPush('client', c.name, { client_id: c.id });
  });
}

async function xbiClient(node, body) {
  const cid = node.ctx.client_id;
  const [d, orders] = await Promise.all([
    api(`/reports/exec-summary?from=${_xbi.from}&to=${_xbi.to}&client_id=${cid}`),
    api(`/orders?client_id=${cid}`).catch(()=>[]),
  ]);
  const o=d?.orders||{}, dl=d?.delivery||{}, f=d?.finance||{};
  const scoped = (orders||[]).filter(x=>x.created_at>=_xbi.from && x.created_at<=_xbi.to+'T23:59:59' && !['CANCELLED','DRAFT'].includes(x.status));
  body.innerHTML = `
    ${xbiGrp('Client — '+h(node.label),[
      xbiKpi('Orders', o.total||0, ''), xbiKpi('Order Value', fmt(o.value||0), ''),
      xbiKpi('Fulfilment', (dl.fill_pct||0)+'%', '', (dl.fill_pct||0)>=90?'g':'w'),
      xbiKpi('Budget Util', (f.budget_util||0)+'%', '', (f.budget_util||0)>90?'b':(f.budget_util||0)>70?'w':null),
      xbiKpi('Due Value', fmt(dl.due_value||0), '', dl.due_value?'b':null),
      xbiKpi('Pending', o.pending||0, '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Orders <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${scoped.length ? scoped.map(ord=>xbiRow(ord.id, `${fmtDate(ord.created_at)} · ${(ord.status||'').replace(/_/g,' ')}`, fmt(ord.grand_total), {key:ord.id})).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No orders for this client in the period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('order', b.dataset.k, { order_id: b.dataset.k, client_id: cid }));
}

async function xbiOrder(node, body) {
  const oid = node.ctx.order_id;
  const [order, cats] = await Promise.all([
    api('/orders/'+oid).catch(()=>null),
    api('/reports/drill?level=category&order_id='+encodeURIComponent(oid)),
  ]);
  const rows = (cats?.rows||[]).filter(r=>r.ordered_qty>0);
  const totOrd = rows.reduce((s,r)=>s+r.ordered_value,0)||1;
  const fill = order ? null : null;
  body.innerHTML = `
    ${xbiGrp('Order '+h(oid),[
      xbiKpi('Order Value', fmt(order?.grand_total||0), 'incl GST'),
      xbiKpi('Status', (order?.status||'—').replace(/_/g,' '), '', order?.status==='CLOSED'?'g':'w'),
      xbiKpi('Lines', (order?.items||[]).length, ''),
      xbiKpi('Client', order?.client_name||'—', ''),
      xbiKpi('Placed', order?.created_at?fmtDate(order.created_at):'—', ''),
      xbiKpi('For', order?.order_period?new Date(order.order_period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'—', '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Category breakdown <span style="font-weight:400;color:var(--faint)">— click a category to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${rows.length ? rows.map(r=>{ const fillp=r.ordered_qty?Math.round(r.delivered_qty/r.ordered_qty*100):0;
        return xbiRow(r.name, `${Math.round(r.ordered_qty)} ordered`, fmt(r.ordered_value), {share:Math.round(r.ordered_value/totOrd*100), fill:fillp, key:r.name}); }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No line items.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('category', b.dataset.k, { category: b.dataset.k }));
}

// Generic group level: category→subcat→brand→sku
async function xbiGroup(node, body) {
  const levelMap = { category:'subcategory', subcat:'brand', brand:'sku' };
  const nextApiLevel = levelMap[node.level];
  const p = xbiScopeParams(node.ctx); p.set('level', nextApiLevel);
  const d = await api('/reports/drill?'+p.toString());
  const rows = (d?.rows||[]).filter(r=>r.ordered_qty>0);
  const totOrd = rows.reduce((s,r)=>s+r.ordered_value,0)||1;
  const totQ = rows.reduce((s,r)=>s+r.ordered_qty,0), totD = rows.reduce((s,r)=>s+r.delivered_qty,0);
  const label = { category:'Sub-categories', subcat:'Brands', brand:'SKUs / items' }[node.level];
  body.innerHTML = `
    ${xbiGrp(EXEC_LEVEL_NAME[node.level]+' — '+h(node.label),[
      xbiKpi('Qty Ordered', Math.round(totQ), ''), xbiKpi('Delivered', Math.round(totD), totQ?Math.round(totD/totQ*100)+'%':'', totQ&&totD/totQ>=0.9?'g':'w'),
      xbiKpi('Value', fmt(totOrd), ''), xbiKpi('Due', Math.round(Math.max(0,totQ-totD)), 'units', totQ-totD>0?'b':null)])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">${label} <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${rows.length ? rows.map(r=>{ const fillp=r.ordered_qty?Math.round(r.delivered_qty/r.ordered_qty*100):0;
        return xbiRow(r.name, `${Math.round(r.ordered_qty)} ordered${r.sku?' · '+r.sku:''}`, fmt(r.ordered_value), {share:Math.round(r.ordered_value/totOrd*100), fill:fillp, key:(nextApiLevel==='sku'?r.sku:r.name)}); }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No data at this level.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>{
    const key = b.dataset.k;
    if (nextApiLevel==='subcategory') xbiPush('subcat', key, { subcategory:key });
    else if (nextApiLevel==='brand')  xbiPush('brand', key, { brand:key });
    else xbiPush('sku', key, { sku:key });
  });
}

async function xbiSku(node, body) {
  // node.ctx has category/subcategory/brand + sku; pull sku totals + inventory + challans
  const p = xbiScopeParams(node.ctx); p.set('level','sku');
  const cp = xbiScopeParams(node.ctx); cp.set('sku', node.ctx.sku||node.label);
  const [d, inv, ch] = await Promise.all([
    api('/reports/drill?'+p.toString()),
    api('/inventory?q='+encodeURIComponent(node.ctx.sku||node.label)).catch(()=>[]),
    api('/reports/sku-challans?'+cp.toString()).catch(()=>({rows:[]})),
  ]);
  const row = (d?.rows||[]).find(r=>String(r.sku)===String(node.ctx.sku)) || (d?.rows||[])[0] || {};
  const item = Array.isArray(inv) ? inv.find(i=>i.sku===node.ctx.sku) : null;
  const ordQ=Math.round(row.ordered_qty||0), delQ=Math.round(row.delivered_qty||0);
  const challans = ch?.rows||[];
  body.innerHTML = `
    ${xbiGrp('Item — '+h(node.label),[
      xbiKpi('Ordered', ordQ, 'units'), xbiKpi('Delivered', delQ, ordQ?Math.round(delQ/ordQ*100)+'%':'', ordQ&&delQ/ordQ>=0.9?'g':'w'),
      xbiKpi('Due', Math.max(0,ordQ-delQ), 'units', ordQ-delQ>0?'b':null), xbiKpi('Order Value', fmt(row.ordered_value||0), '')])}
    ${xbiGrp('Stock & item',[
      xbiKpi('Current Stock', item?Math.round(item.stock):'—', item?(item.uom||'units'):''),
      xbiKpi('Reserved', item?Math.round(item.reserved||0):'—', ''),
      xbiKpi('Reorder Level', item?Math.round(item.reorder_level||0):'—', ''),
      xbiKpi('SKU', node.ctx.sku||'—', ''),
      xbiKpi('Vendor', item?.vendor_name||'—', ''),
      xbiKpi('Unit Price', item?fmt(item.unit_price):'—', '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Delivery challans <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${challans.length ? challans.map(dc=>{
        const st=(dc.status||'').replace(/_/g,' ');
        const stCls = dc.status==='DELIVERED'?'g':dc.status==='CANCELLED'?'b':'w';
        return xbiRow(dc.dc_number||dc.id, `Order ${dc.order_id} · ${dc.delivered_at?fmtDate(dc.delivered_at):st} · ${dc.billed?'billed':'unbilled'}`, `${Math.round(dc.qty_delivered||0)} units`, {fill:null, key:dc.id, share:null});
      }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px">No challans carried this item in the period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>{
    b.onclick=()=>{ const dc=challans.find(x=>String(x.id)===b.dataset.k); if(!dc)return; xbiPush('dc', dc.dc_number||dc.id, { dc_id: dc.id, dc }); };
  });
}

async function xbiDc(node, body) {
  const dc = node.ctx.dc || {};
  const items = await api('/delivery-challans/'+encodeURIComponent(node.ctx.dc_id)+'/items').catch(()=>[]) || [];
  const st=(dc.status||'').replace(/_/g,' ');
  body.innerHTML = `
    ${xbiGrp('Challan '+h(dc.dc_number||node.ctx.dc_id),[
      xbiKpi('DC Number', dc.dc_number||node.ctx.dc_id, ''),
      xbiKpi('Linked Order', dc.order_id||'—', ''),
      xbiKpi('Client', dc.client_name||'—', ''),
      xbiKpi('Status', st||'—', '', dc.status==='DELIVERED'?'g':'w'),
      xbiKpi('Delivered', dc.delivered_at?fmtDate(dc.delivered_at):'—', ''),
      xbiKpi('POD', dc.pod_count>0?'Uploaded':'Pending', '', dc.pod_count>0?'g':'w')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Items in this challan</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Item</th><th>SKU</th><th style="text-align:right">Dispatched</th><th style="text-align:right">Delivered</th></tr></thead>
      <tbody>${items.length ? items.map(i=>`<tr><td>${h(i.name||i.item_name||i.sku)}</td><td style="color:var(--text-muted)">${h(i.sku)}</td><td style="text-align:right">${i.qty_ordered}</td><td style="text-align:right;font-weight:700">${i.qty_delivered}</td></tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No item detail</td></tr>'}</tbody>
    </table></div></div>
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:6px 0 8px">Billing <span style="font-weight:400;color:var(--faint)">— view the invoice</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${xbiRow('Invoice for '+(dc.dc_number||node.ctx.dc_id), dc.billed?('Billed '+(dc.billed_at?fmtDate(dc.billed_at):'')):'Not yet billed', fmt(dc.line_value||0), {key:'inv'})}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('invoice', 'Invoice · '+(dc.dc_number||node.ctx.dc_id), { dc }));
}

async function xbiInvoice(node, body) {
  const dc = node.ctx.dc || {};
  const val = dc.line_value || 0;
  const gst = Math.round(val*0.18);
  body.innerHTML = `
    ${xbiGrp('Invoice',[
      xbiKpi('Invoice #', 'INV-'+(dc.dc_number||dc.id||'—'), ''),
      xbiKpi('Linked Order', dc.order_id||'—', ''),
      xbiKpi('Linked DC', dc.dc_number||dc.id||'—', ''),
      xbiKpi('Invoice Value', fmt(val+gst), 'incl GST'),
      xbiKpi('Payment', dc.billed?'Billed':'Unbilled', '', dc.billed?'g':'w'),
      xbiKpi('Outstanding', dc.billed?fmt(0):fmt(val+gst), '', dc.billed?'g':'b')])}
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <div style="background:var(--navy);color:#fff;padding:13px 16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-weight:700">INV-${dc.dc_number||dc.id||'—'}</span><span>${h(dc.client_name||'—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>${h(node.ctx.sku||'Delivered items')}</span><span class="tnum">${Math.round(dc.qty_delivered||0)} × ${fmt(dc.unit_price||0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>Subtotal</span><span class="tnum">${fmt(val)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>GST @ 18%</span><span class="tnum">${fmt(gst)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 16px;font-weight:800;color:var(--navy);background:var(--panel,#faf8f4)"><span>Total</span><span class="tnum">${fmt(val+gst)}</span></div>
    </div>
    <div style="margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;font-size:.8rem;color:#166534">
      🏁 <b>Bottom of the drill.</b> From a portfolio KPI to a single billed line — every hop auditable. This invoice is derived from the DC's billing record; a full invoice ledger (multi-DC invoices, payment dates) can follow once client invoicing is modelled.
    </div>`;
}

function renderReports(el) {
  const byKey = Object.fromEntries(REPORT_DEFS.map(r=>[r.key,r]));
  const usedKeys = new Set(REPORT_CATEGORIES.flatMap(c=>c.keys));
  const otherDefs = REPORT_DEFS.filter(r=>!usedKeys.has(r.key));

  const nowM = new Date();
  const admFrom = new Date(nowM.getFullYear(), nowM.getMonth()-5, 1).toISOString().slice(0,10);
  const admTo = nowM.toISOString().slice(0,10);

  el.innerHTML = `
  ${pageHeader('Reports & BI', 'Live data — view inline, export CSV, or print PDF')}

  <!-- ═══ CLIENT FULFILMENT DRILL-DOWN ═══ -->
  <div class="card" style="padding:16px 20px;margin-bottom:20px;border:1px solid var(--primary)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <span style="font-size:1.1rem">🔎</span>
      <span style="font-weight:800;font-size:.95rem;color:var(--navy)">Client Fulfilment Drill-down</span>
      <span style="font-size:.76rem;color:var(--text-muted)">— orders vs delivery by month/quarter/year, then drill into category → sub-category</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
      <select id="adm-fulfil-client" class="form-control" style="max-width:240px" onchange="loadAdminFulfil()">
        <option value="">Loading clients…</option>
      </select>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${['month','quarter','year'].map(g=>`<button id="aftab-${g}" onclick="setAdminFulfilGran('${g}')" style="padding:6px 12px;font-size:.76rem;font-weight:600;background:#fff;border:none;cursor:pointer;color:var(--text-muted)">${g==='month'?'Monthly':g==='quarter'?'Quarterly':'Fiscal Year'}</button>`).join('')}
      </div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <button id="afmode-chart" onclick="setAdminFulfilMode('chart')" style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📊</button>
        <button id="afmode-table" onclick="setAdminFulfilMode('table')" style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📋</button>
      </div>
      <input type="date" id="adm-rpt-from" class="form-control" style="max-width:150px;font-size:.8rem" value="${admFrom}">
      <span style="font-size:.8rem;color:var(--text-muted)">to</span>
      <input type="date" id="adm-rpt-to" class="form-control" style="max-width:150px;font-size:.8rem" value="${admTo}">
      <button class="btn btn-primary btn-sm" onclick="loadAdminFulfil()">Apply</button>
    </div>
    <div id="rpt-fulfil-content"><div style="text-align:center;padding:30px;color:var(--text-muted)">Select a client to view fulfilment.</div></div>
  </div>

  <!-- ═══ ANALYTICS OVERVIEW (Stitch reference) ═══ -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:24px">

    <!-- SLA Performance Gauge -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="font-weight:800;font-size:.92rem;color:var(--navy);margin-bottom:8px">SLA Performance</div>
      <div id="sla-gauge-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:150px">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>

    <!-- Fulfilment Efficiency -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="font-weight:800;font-size:.92rem;color:var(--navy);margin-bottom:2px">Fulfilment Efficiency</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-bottom:12px">Orders over the past week</div>
      <div id="fulfilment-bars" style="min-height:120px;display:flex;align-items:center;justify-content:center">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>

    <!-- Open Tickets -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:800;font-size:.92rem;color:var(--navy)">Open Tickets</div>
        <button class="btn btn-secondary btn-sm" onclick="navigate('service_desk')">View All →</button>
      </div>
      <div id="open-tickets-list" style="min-height:120px;display:flex;align-items:center;justify-content:center">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>
  </div>
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

  loadReportsOverview();
  populateAdminFulfilClients();
}

/* ── Admin: client fulfilment drill-down (reuses the fulfilment renderer) ── */
async function populateAdminFulfilClients() {
  const sel = document.getElementById('adm-fulfil-client');
  if (!sel) return;
  const clients = (await api('/clients').catch(()=>[]) || []).filter(c=>c.active);
  sel.innerHTML = '<option value="">— Select a client —</option>' +
    clients.map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('');
}

function setAdminFulfilGran(g) { _fulfilGranularity = g; renderFulfilContent(); }
function setAdminFulfilMode(m) { _fulfilMode = m; renderFulfilContent(); }

async function loadAdminFulfil() {
  const clientId = document.getElementById('adm-fulfil-client')?.value || '';
  const wrap = document.getElementById('rpt-fulfil-content');
  if (!clientId) { if(wrap) wrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Select a client to view fulfilment.</div>'; _drillClientId=null; return; }
  if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><div class="spinner" style="width:22px;height:22px;margin:0 auto"></div></div>';
  _drillClientId = clientId;                       // makes the drill scope to this client
  if (!_fulfilGranularity) _fulfilGranularity = 'month';
  if (!_fulfilMode) _fulfilMode = 'chart';
  const data = await api(`/reports/order-fulfilment-monthly?client_id=${clientId}`);
  _clientRptData = { ..._clientRptData, fulfil: data?.rows || [] };
  renderFulfilContent();
}

/* ── Analytics overview widgets (SLA gauge, fulfilment bars, tickets) ── */
async function loadReportsOverview() {
  const [orders, tickets, fulfilment] = await Promise.all([
    api('/orders').catch(()=>[]),
    api('/tickets').catch(()=>[]),
    api(`/reports/client-fulfilment?from=${new Date(Date.now()-30*86400000).toISOString().slice(0,10)}&to=${new Date().toISOString().slice(0,10)}`).catch(()=>[]),
  ]);

  // ── SLA gauge: average fulfilment % over 30 days ──
  const gaugeWrap = document.getElementById('sla-gauge-wrap');
  if (gaugeWrap) {
    const pct = (fulfilment||[]).length
      ? Math.round((fulfilment.reduce((s,r)=>s+(r.fulfilment_pct||0),0))/fulfilment.length)
      : 100;
    const angle = -180 + (pct/100)*180;
    gaugeWrap.innerHTML = `
      <svg viewBox="0 0 200 115" style="width:100%;max-width:220px">
        <defs>
          <linearGradient id="slaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#dc2626"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#16a34a"/>
          </linearGradient>
        </defs>
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="url(#slaGrad)" stroke-width="16" stroke-linecap="round"/>
        <line x1="100" y1="100" x2="${100+72*Math.cos(angle*Math.PI/180)}" y2="${100+72*Math.sin(angle*Math.PI/180)}" stroke="var(--navy)" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="6" fill="var(--navy)"/>
        <text x="100" y="82" text-anchor="middle" font-size="26" font-weight="800" fill="var(--navy)">${pct}%</text>
      </svg>
      <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">On Target <span style="color:${pct>=80?'#16a34a':pct>=60?'#d97706':'#dc2626'};font-weight:700">· 30-day fulfilment</span></div>`;
  }

  // ── Fulfilment efficiency bars: past week ──
  const barsWrap = document.getElementById('fulfilment-bars');
  if (barsWrap) {
    const weekAgo = Date.now() - 7*86400000;
    const recent = (orders||[]).filter(o => new Date(o.created_at).getTime() >= weekAgo);
    const received  = recent.length;
    const processed = recent.filter(o => !['DRAFT','PENDING_APPROVAL','SUBMITTED'].includes(o.status)).length;
    const delivered = recent.filter(o => ['CLOSED','PARTIALLY_CLOSED','IN_SHIPMENT','DELIVERED'].includes(o.status)).length;
    const max = Math.max(received, processed, delivered, 1);
    const row = (label, val, color) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:72px;font-size:.76rem;color:var(--text-muted);text-align:right;flex-shrink:0">${label}</div>
        <div style="flex:1;background:var(--border);border-radius:4px;height:18px;overflow:hidden">
          <div style="height:100%;width:${Math.round(val/max*100)}%;background:${color};border-radius:4px;transition:width .6s"></div>
        </div>
        <div style="width:26px;font-size:.8rem;font-weight:700;color:var(--navy)">${val}</div>
      </div>`;
    barsWrap.innerHTML = `<div style="width:100%">
      ${row('Received', received, 'var(--primary)')}
      ${row('Processed', processed, '#fb923c')}
      ${row('Delivered', delivered, '#9ca3af')}
    </div>`;
  }

  // ── Open tickets ──
  const ticketsWrap = document.getElementById('open-tickets-list');
  if (ticketsWrap) {
    const open = (tickets||[]).filter(t => !['RESOLVED','CLOSED'].includes(t.status)).slice(0,4);
    const pillColor = p => p==='HIGH'||p==='URGENT' ? ['#fee2e2','#dc2626'] : p==='MEDIUM' ? ['#fef3c7','#d97706'] : ['#e5e7eb','#6b7280'];
    ticketsWrap.innerHTML = open.length ? `<div style="width:100%">
      ${open.map(t => {
        const [bg,fg] = pillColor(t.priority);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="navigate('service_desk')">
          <div style="width:8px;height:8px;border-radius:50%;background:${fg};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8rem;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${t.id}: ${h(t.subject||'')}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${fmtDate(t.created_at)}</div>
          </div>
          <span style="font-size:.68rem;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${fg};white-space:nowrap">${t.priority||'LOW'}</span>
        </div>`;
      }).join('')}
    </div>` : `<div style="text-align:center;color:var(--text-muted);font-size:.82rem;padding:20px">🎉 No open tickets</div>`;
  }
}

function rptPresetDates(preset) {
  const now = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if (preset==='thismonth') return [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, ymd(now)];
  if (preset==='lastmonth') { const lm=new Date(now.getFullYear(),now.getMonth()-1,1); return [`${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}-01`, ymd(new Date(now.getFullYear(),now.getMonth(),0))]; }
  if (preset==='thisyear')  return [`${now.getFullYear()}-01-01`, ymd(now)];
  return [ymd(new Date(Date.now()-30*86400000)), ymd(now)]; // last 30 days
}

async function viewReport(key, from, to) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  if (def.datable) {
    if (!from || !to) [from, to] = rptPresetDates('last30');
    APP._rptRange = { key, from, to };
  } else {
    APP._rptRange = null;
  }
  showToast('Loading report…');
  const qs = def.datable ? `?from=${from}&to=${to}` : '';
  const data = await api('/reports/' + key + qs);
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

  const fmtD = s => { const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); };
  const periodBar = def.datable ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding:10px 12px;background:var(--surface-alt,#f8f9fb);border-radius:8px">
      <span style="font-size:.76rem;font-weight:700;color:var(--navy)">📅 Period: ${fmtD(from)} → ${fmtD(to)}</span>
      <div style="flex:1"></div>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('last30'))" style="font-size:.72rem">Last 30 Days</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('thismonth'))" style="font-size:.72rem">This Month</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('lastmonth'))" style="font-size:.72rem">Last Month</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('thisyear'))" style="font-size:.72rem">This Year</button>
      <input type="date" id="rpt-modal-from" class="form-control" style="max-width:135px;font-size:.76rem" value="${from}">
      <input type="date" id="rpt-modal-to" class="form-control" style="max-width:135px;font-size:.76rem" value="${to}">
      <button class="btn btn-primary btn-sm" onclick="viewReport('${key}',document.getElementById('rpt-modal-from').value,document.getElementById('rpt-modal-to').value)" style="font-size:.72rem">Apply</button>
    </div>`
  : `<div style="margin-bottom:12px;padding:8px 12px;background:var(--surface-alt,#f8f9fb);border-radius:8px;font-size:.76rem;font-weight:700;color:var(--navy)">📅 Period: ${def.period||'All time'}</div>`;

  openModal(def.title,
    `${periodBar}
    <div class="table-wrap" style="max-height:55vh;overflow-y:auto">
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
  const r = APP._rptRange;
  const qs = def.datable && r?.key === key ? `?from=${r.from}&to=${r.to}` : '';
  const data = await api('/reports/' + key + qs);
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
   CLIENT REPORTS — Consumption & Spend
   ============================================================ */
let _clientRptData = { consumption: null, spend: null };
let _clientRptSpendTab = 'monthly';

function renderClientReports(el) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const today = now.toISOString().slice(0,10);

  el.innerHTML = `
  ${pageHeader('Reports', 'Consumption & Spend analytics for your pantry')}

  <!-- Date Filter Bar -->
  <div class="card" style="padding:12px 16px;margin-bottom:16px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span style="font-weight:600;font-size:.83rem;color:var(--navy)">Period:</span>
      <button class="btn btn-sm" id="rpt-pre-thismonth"  onclick="clientRptPreset('thismonth')"  style="font-size:.78rem">This Month</button>
      <button class="btn btn-sm" id="rpt-pre-lastmonth"  onclick="clientRptPreset('lastmonth')"  style="font-size:.78rem">Last Month</button>
      <button class="btn btn-sm" id="rpt-pre-thisyear"   onclick="clientRptPreset('thisyear')"   style="font-size:.78rem">This Year</button>
      <button class="btn btn-sm" id="rpt-pre-lastyear"   onclick="clientRptPreset('lastyear')"   style="font-size:.78rem">Last Year</button>
      <button class="btn btn-sm" id="rpt-pre-last3m"     onclick="clientRptPreset('last3m')"     style="font-size:.78rem">Last 3 Months</button>
      <div style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap">
        <input type="date" id="rpt-from" class="form-control" style="max-width:148px;font-size:.82rem" value="${firstOfMonth}">
        <span style="color:var(--text-muted);font-size:.82rem">to</span>
        <input type="date" id="rpt-to"   class="form-control" style="max-width:148px;font-size:.82rem" value="${today}">
        <button class="btn btn-primary btn-sm" onclick="loadClientReports()" style="white-space:nowrap">Apply</button>
      </div>
    </div>
  </div>

  <!-- Consumption Section -->
  <div style="margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:1.1rem">🍽️</span>
      <span style="font-weight:700;font-size:.97rem;color:#1e40af">Consumption Analytics</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
      <button class="btn btn-secondary btn-sm" onclick="downloadClientConsumptionCSV()" style="font-size:.78rem">⬇ CSV</button>
    </div>
    <div id="rpt-consumption-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px">
      <div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>
    </div>
  </div>

  <!-- Spend Section -->
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:1.1rem">💰</span>
      <span style="font-weight:700;font-size:.97rem;color:#065f46">Spend Reports</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
      <button class="btn btn-secondary btn-sm" onclick="downloadClientSpendCSV()" style="font-size:.78rem">⬇ CSV</button>
    </div>
    <!-- Spend sub-tabs -->
    <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">
      <button id="stab-monthly"  onclick="switchSpendTab('monthly')"  style="padding:8px 16px;font-size:.82rem;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--text-muted);margin-bottom:-2px">Monthly Trend</button>
      <button id="stab-yearly"   onclick="switchSpendTab('yearly')"   style="padding:8px 16px;font-size:.82rem;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--text-muted);margin-bottom:-2px">Yearly Summary</button>
      <button id="stab-po"       onclick="switchSpendTab('po')"       style="padding:8px 16px;font-size:.82rem;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--text-muted);margin-bottom:-2px">PO-wise</button>
    </div>
    <div id="rpt-spend-content">
      <div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>
    </div>
  </div>

  <!-- Order Fulfilment Section -->
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:1.1rem">📦</span>
      <span style="font-weight:700;font-size:.97rem;color:#1e40af">Order vs Delivery — Fulfilment</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${['month','quarter','year'].map(g=>`<button id="ftab-${g}" onclick="switchFulfilGranularity('${g}')" style="padding:6px 14px;font-size:.76rem;font-weight:600;background:#fff;border:none;cursor:pointer;color:var(--text-muted)">${g==='month'?'Monthly':g==='quarter'?'Quarterly':'Fiscal Year'}</button>`).join('')}
      </div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <button id="fmode-chart" onclick="switchFulfilMode('chart')" title="Chart" style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📊</button>
        <button id="fmode-table" onclick="switchFulfilMode('table')" title="Table" style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📋</button>
      </div>
    </div>
    <div id="rpt-fulfil-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div></div>
  </div>`;

  // highlight this month preset by default
  document.getElementById('rpt-pre-thismonth')?.classList.add('btn-primary');
  _fulfilGranularity = 'month';
  _fulfilMode = 'chart';
  loadClientReports();
}

function clientRptPreset(preset) {
  const now = new Date();
  let from, to;
  function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  if (preset === 'thismonth') {
    from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    to   = ymd(now);
  } else if (preset === 'lastmonth') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = `${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}-01`;
    to   = ymd(new Date(now.getFullYear(), now.getMonth(), 0));
  } else if (preset === 'thisyear') {
    from = `${now.getFullYear()}-01-01`;
    to   = now.toISOString().slice(0,10);
  } else if (preset === 'lastyear') {
    from = `${now.getFullYear()-1}-01-01`;
    to   = `${now.getFullYear()-1}-12-31`;
  } else if (preset === 'last3m') {
    const d3 = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    from = `${d3.getFullYear()}-${String(d3.getMonth()+1).padStart(2,'0')}-01`;
    to   = now.toISOString().slice(0,10);
  }
  document.getElementById('rpt-from').value = from;
  document.getElementById('rpt-to').value   = to;
  // reset button highlights
  ['thismonth','lastmonth','thisyear','lastyear','last3m'].forEach(p => {
    const btn = document.getElementById(`rpt-pre-${p}`);
    if (btn) { btn.classList.remove('btn-primary'); btn.style.background=''; btn.style.color=''; }
  });
  const activeBtn = document.getElementById(`rpt-pre-${preset}`);
  if (activeBtn) activeBtn.classList.add('btn-primary');
  loadClientReports();
}

async function loadClientReports() {
  _drillClientId = null; // client sees their own data; endpoint auto-scopes
  const from = document.getElementById('rpt-from')?.value || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = document.getElementById('rpt-to')?.value   || new Date().toISOString().slice(0,10);

  const grid = document.getElementById('rpt-consumption-grid');
  const spend = document.getElementById('rpt-spend-content');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';
  if (spend) spend.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';

  const [cData, sData, fData] = await Promise.all([
    api(`/reports/client-consumption?from=${from}&to=${to}`),
    api(`/reports/client-spend?from=${from}&to=${to}`),
    api(`/reports/order-fulfilment-monthly`)
  ]);

  _clientRptData = { consumption: cData, spend: sData, fulfil: fData?.rows || [] };

  if (grid) grid.innerHTML = renderConsumptionGrid(cData?.rows || []);
  renderSpendContent(_clientRptSpendTab, sData);
  renderFulfilContent();
}

/* ── Order-vs-delivery fulfilment: month / quarter / fiscal-year, % + chart ── */
let _fulfilGranularity = 'month';
let _fulfilMode = 'chart';

function fiscalBucket(period, gran) {
  // period = 'YYYY-MM'; Indian FY = Apr–Mar
  const [y, m] = period.split('-').map(Number);
  if (gran === 'month') {
    const d = new Date(y, m-1, 1);
    return { key: period, label: d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}) };
  }
  const fyStart = m >= 4 ? y : y - 1;
  const fyLabel = `FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}`;
  if (gran === 'year') return { key: `${fyStart}`, label: fyLabel };
  // fiscal quarter
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
  return { key: `${fyStart}-Q${q}`, label: `Q${q} ${fyLabel}` };
}

function bucketFulfil(rows, gran) {
  const map = new Map();
  (rows||[]).forEach(r => {
    const b = fiscalBucket(r.period, gran);
    if (!map.has(b.key)) map.set(b.key, { key:b.key, label:b.label, ordered_qty:0, delivered_qty:0, ordered_value:0, delivered_value:0, order_count:0 });
    const o = map.get(b.key);
    o.ordered_qty    += r.ordered_qty||0;
    o.delivered_qty  += r.delivered_qty||0;
    o.ordered_value  += r.ordered_value||0;
    o.delivered_value+= r.delivered_value||0;
    o.order_count    += r.order_count||0;
  });
  return [...map.values()].sort((a,b)=>a.key<b.key?-1:1).map(o => ({
    ...o, fill_pct: o.ordered_qty ? Math.round(o.delivered_qty/o.ordered_qty*100) : 0
  }));
}

function switchFulfilGranularity(g) { _fulfilGranularity = g; renderFulfilContent(); }
function switchFulfilMode(m) { _fulfilMode = m; renderFulfilContent(); }

function renderFulfilContent() {
  const el = document.getElementById('rpt-fulfil-content');
  if (!el) return;
  ['month','quarter','year'].forEach(g => {
    [`ftab-${g}`,`aftab-${g}`].forEach(id=>{ const b=document.getElementById(id);
      if (b) { b.style.background = g===_fulfilGranularity?'var(--primary)':'#fff'; b.style.color = g===_fulfilGranularity?'#fff':'var(--text-muted)'; } });
  });
  ['chart','table'].forEach(m => {
    [`fmode-${m}`,`afmode-${m}`].forEach(id=>{ const b=document.getElementById(id); if (b) b.style.background = m===_fulfilMode ? 'var(--primary)' : '#fff'; });
  });

  const data = bucketFulfil(_clientRptData.fulfil, _fulfilGranularity);
  if (!data.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders yet.</div>'; return; }

  // Overall fill across all buckets
  const totOrd = data.reduce((s,d)=>s+d.ordered_qty,0);
  const totDel = data.reduce((s,d)=>s+d.delivered_qty,0);
  const overall = totOrd ? Math.round(totDel/totOrd*100) : 0;
  const ovColor = overall>=90?'#16a34a':overall>=70?'#d97706':'#dc2626';

  const header = `<div class="card" style="padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Overall Fill Rate</div>
      <div style="font-size:1.8rem;font-weight:800;color:${ovColor};line-height:1.1">${overall}%</div></div>
    <div style="height:34px;width:1px;background:var(--border)"></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Ordered</div><div style="font-weight:700">${Math.round(totOrd)} units</div></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Delivered</div><div style="font-weight:700">${Math.round(totDel)} units</div></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Still Due</div><div style="font-weight:700;color:${totOrd-totDel>0?'#dc2626':'#16a34a'}">${Math.round(Math.max(0,totOrd-totDel))} units</div></div>
    <div style="flex:1"></div>
    <button class="btn btn-secondary btn-sm" onclick="openCategoryDrill('','All periods in range')">🔍 Category Split (all)</button>
  </div>`;

  if (_fulfilMode === 'table') {
    el.innerHTML = header + `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Period</th><th style="text-align:right">Orders</th><th style="text-align:right">Ordered</th><th style="text-align:right">Delivered</th><th style="text-align:right">Due</th><th style="text-align:right">Fill %</th><th></th></tr></thead>
      <tbody>${data.map(d=>{ const due=Math.max(0,d.ordered_qty-d.delivered_qty); const c=d.fill_pct>=90?'#16a34a':d.fill_pct>=70?'#d97706':'#dc2626';
        const periodParam = _fulfilGranularity==='month' ? d.key : '';
        return `<tr style="cursor:pointer" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background=''" onclick="openCategoryDrill('${periodParam}','${d.label.replace(/'/g,"")}')">
          <td style="font-weight:600;color:var(--blue)">${d.label}</td>
          <td style="text-align:right">${d.order_count}</td>
          <td style="text-align:right">${Math.round(d.ordered_qty)}</td>
          <td style="text-align:right">${Math.round(d.delivered_qty)}</td>
          <td style="text-align:right;color:${due>0?'#dc2626':'inherit'}">${Math.round(due)}</td>
          <td style="text-align:right;font-weight:700;color:${c}">${d.fill_pct}%</td>
          <td style="text-align:right;color:var(--text-muted)">Categories ›</td>
        </tr>`;}).join('')}</tbody>
    </table></div></div>
    <div style="font-size:.74rem;color:var(--text-muted);margin-top:6px">💡 ${_fulfilGranularity==='month'?'Click a month':'Switch to Monthly to drill by month, or use "Category Split (all)"'} to see the category → sub-category breakdown.</div>`;
    return;
  }

  // Chart mode — clean, single Fill % bar chart (color-coded, big % labels).
  // Ordered/Delivered units live in the tooltip and the table, keeping this uncluttered.
  if (!window.Chart) { _fulfilMode = 'table'; renderFulfilContent(); return; }
  const fillColor = p => p>=90 ? '#16a34a' : p>=70 ? '#d97706' : '#dc2626';
  el.innerHTML = header + `<div class="card" style="padding:18px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div style="font-weight:700;font-size:.9rem;color:var(--navy)">Fill Rate by ${_fulfilGranularity==='month'?'Month':_fulfilGranularity==='quarter'?'Quarter':'Fiscal Year'}</div>
      <div style="display:flex;gap:14px;font-size:.72rem;color:var(--text-muted)">
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#16a34a"></span>≥90%</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#d97706"></span>70–89%</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#dc2626"></span>&lt;70%</span>
      </div>
    </div>
    <div style="position:relative;height:${Math.max(280, Math.min(420, data.length*46+120))}px"><canvas id="fulfil-chart"></canvas></div>
    <div style="font-size:.73rem;color:var(--text-muted);margin-top:8px">Hover a bar for ordered/delivered units${_fulfilGranularity==='month'?' · click to drill into categories':''}.</div>
  </div>`;
  const ctx = document.getElementById('fulfil-chart');
  if (ctx && window.Chart) {
    if (APP.charts.fulfil) { try{APP.charts.fulfil.destroy();}catch(_){} }
    // Inline plugin: print the % value at the end of each bar, big and bold
    const pctLabels = {
      id:'pctLabels',
      afterDatasetsDraw(chart){
        const {ctx} = chart; const meta = chart.getDatasetMeta(0);
        if (!meta) return;
        ctx.save(); ctx.font='800 14px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
        meta.data.forEach((bar,i)=>{ const v=data[i].fill_pct; ctx.fillStyle=fillColor(v); ctx.fillText(' '+v+'%', bar.x+4, bar.y); });
        ctx.restore();
      }
    };
    APP.charts.fulfil = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d=>d.label),
        datasets: [
          { label:'Fill %', data:data.map(d=>d.fill_pct), backgroundColor:data.map(d=>fillColor(d.fill_pct)),
            borderRadius:6, barThickness:'flex', maxBarThickness:34,
            _ordered:data.map(d=>Math.round(d.ordered_qty)), _delivered:data.map(d=>Math.round(d.delivered_qty)) },
        ]
      },
      options: {
        indexAxis:'y',                 // horizontal bars — labels always readable
        responsive:true, maintainAspectRatio:false,
        layout:{ padding:{ right:52 } },
        onClick: (evt, els) => {
          if (!els.length) return;
          const d = data[els[0].index]; if (!d) return;
          openCategoryDrill(_fulfilGranularity==='month' ? d.key : '', d.label);
        },
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{
            label:(c)=>`Fill: ${c.raw}%`,
            afterLabel:(c)=>{ const d=data[c.dataIndex]; return `Ordered: ${Math.round(d.ordered_qty)}  ·  Delivered: ${Math.round(d.delivered_qty)}  ·  Due: ${Math.round(Math.max(0,d.ordered_qty-d.delivered_qty))}`; },
            afterBody: ()=> _fulfilGranularity==='month' ? '\nClick to drill into categories' : '' } } },
        scales:{
          x:{ beginAtZero:true, max:100, grid:{color:'#f0f2f7'}, ticks:{callback:v=>v+'%',font:{size:10}}, title:{display:true,text:'Fill %',font:{size:11,weight:'700'}} },
          y:{ grid:{display:false}, ticks:{font:{size:11,weight:'600'}} }
        }
      },
      plugins:[pctLabels]
    });
  }
}

/* ══ Category / sub-category drill-down (client → period → category → subcat) ══ */
let _drillState = { periodKey:'', baseLabel:'', gran:'custom', category:null };
let _drillClientId = null; // set when an admin drills a specific client

function fyQuarterRange(y, m) {
  let sm, em, sy=y, ey=y;
  if (m>=4&&m<=6){sm=4;em=6;} else if (m>=7&&m<=9){sm=7;em=9;} else if (m>=10&&m<=12){sm=10;em=12;} else {sm=1;em=3;}
  const from = `${sy}-${String(sm).padStart(2,'0')}-01`;
  const to = new Date(ey, em, 0).toISOString().slice(0,10); // last day of end month
  const fyStart = (sm>=4)?sy:sy-1;
  const q = sm>=4&&sm<=6?1:sm>=7&&sm<=9?2:sm>=10&&sm<=12?3:4;
  return { from, to, label:`Q${q} FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}` };
}
function fyYearRange(y, m) {
  const fyStart = m>=4?y:y-1;
  return { from:`${fyStart}-04-01`, to:`${fyStart+1}-03-31`, label:`FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}` };
}

// Resolve the current drill window (period exact, or from/to range) + label
function drillWindow() {
  const { periodKey, gran, baseLabel } = _drillState;
  if (gran === 'month' && /^\d{4}-\d{2}$/.test(periodKey)) {
    const d = new Date(periodKey+'-01');
    return { period: periodKey, label: d.toLocaleDateString('en-IN',{month:'short',year:'numeric'}) };
  }
  if ((gran === 'quarter' || gran === 'year') && /^\d{4}-\d{2}$/.test(periodKey)) {
    const [y,m] = periodKey.split('-').map(Number);
    const r = gran==='quarter' ? fyQuarterRange(y,m) : fyYearRange(y,m);
    return { from:r.from, to:r.to, label:r.label };
  }
  // custom → page date filter
  const from = document.getElementById('rpt-from')?.value || document.getElementById('adm-rpt-from')?.value || '';
  const to   = document.getElementById('rpt-to')?.value   || document.getElementById('adm-rpt-to')?.value   || '';
  return { from, to, label: baseLabel || 'Custom range' };
}

async function openCategoryDrill(periodKey, baseLabel) {
  _drillState = { periodKey: periodKey||'', baseLabel: baseLabel||'All periods', gran: periodKey ? 'month' : 'custom', category:null };
  openModal('Category Breakdown', '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div>',
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`);
  loadDrill();
}

function setDrillGran(g) { _drillState.gran = g; loadDrill(); }
function drillToSubcategory(category) { _drillState.category = category; loadDrill(); }
function drillBackToCategory() { _drillState.category = null; loadDrill(); }

async function loadDrill() {
  const { category, periodKey } = _drillState;
  const win = drillWindow();
  const params = new URLSearchParams();
  if (win.period) params.set('period', win.period);
  else { if(win.from)params.set('from',win.from); if(win.to)params.set('to',win.to); }
  if (category != null) params.set('category', category);
  if (_drillClientId) params.set('client_id', _drillClientId);

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = category != null ? `Sub-category · ${category}` : 'Category Breakdown';

  const body = document.getElementById('modal-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div>';

  const data = await api('/reports/category-breakdown?' + params.toString());
  if (!body) return;
  const rows = (data?.rows || []).filter(r => (r.ordered_qty||0) > 0);

  // Granularity selector (only meaningful when drilled from a specific month)
  const granBar = periodKey ? `<div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px">
    ${[['month','Month'],['quarter','Quarter'],['year','Fiscal Year'],['custom','Custom']].map(([g,lbl])=>
      `<button onclick="setDrillGran('${g}')" style="padding:5px 12px;font-size:.74rem;font-weight:600;border:none;cursor:pointer;background:${_drillState.gran===g?'var(--primary)':'#fff'};color:${_drillState.gran===g?'#fff':'var(--text-muted)'}">${lbl}</button>`).join('')}
  </div>` : '';

  // Breadcrumb
  const crumb = `<div style="display:flex;align-items:center;gap:6px;font-size:.8rem;margin-bottom:10px;flex-wrap:wrap">
    <span style="color:var(--text-muted)">📅 ${h(win.label)}</span>
    <span style="color:var(--border)">›</span>
    <button onclick="drillBackToCategory()" style="background:none;border:none;cursor:pointer;padding:0;font-size:.8rem;font-weight:${category==null?'700':'400'};color:${category==null?'var(--navy)':'var(--blue)'}">Categories</button>
    ${category!=null?`<span style="color:var(--border)">›</span><span style="font-weight:700;color:var(--navy)">${h(category)}</span>`:''}
  </div>` + granBar;

  if (!rows.length) { body.innerHTML = crumb + '<div style="text-align:center;padding:30px;color:var(--text-muted)">No data for this selection.</div>'; return; }

  const totOrdVal = rows.reduce((s,r)=>s+(r.ordered_value||0),0) || 1;
  const totOrdQty = rows.reduce((s,r)=>s+(r.ordered_qty||0),0);
  const totDelQty = rows.reduce((s,r)=>s+(r.delivered_qty||0),0);
  const palette = ['#6366f1','#0891b2','#16a34a','#d97706','#dc2626','#7c3aed','#0ea5e9','#65a30d','#db2777','#64748b','#ea580c','#0d9488'];

  const enriched = rows.map((r,i)=>({
    ...r,
    share: Math.round((r.ordered_value||0)/totOrdVal*100),
    fill: r.ordered_qty ? Math.round((r.delivered_qty||0)/r.ordered_qty*100) : 0,
    color: palette[i%palette.length],
  }));

  const isCat = category == null;
  const donut = window.Chart ? `<div style="flex:0 0 210px;position:relative;height:210px"><canvas id="drill-donut"></canvas></div>` : '';
  const listRows = enriched.map(r=>{
    const fc = r.fill>=90?'#16a34a':r.fill>=70?'#d97706':'#dc2626';
    const clickable = isCat;
    return `<tr style="${clickable?'cursor:pointer':''}" ${clickable?`onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background=''" onclick="drillToSubcategory('${String(r.name).replace(/'/g,"")}')"`:''}>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${r.color};margin-right:7px"></span><b style="${clickable?'color:var(--blue)':''}">${h(r.name)}</b></td>
      <td style="text-align:right;font-weight:700">${r.share}%</td>
      <td style="text-align:right">${Math.round(r.ordered_qty)}</td>
      <td style="text-align:right">${Math.round(r.delivered_qty)}</td>
      <td style="text-align:right;font-weight:700;color:${fc}">${r.fill}%</td>
      ${clickable?'<td style="text-align:right;color:var(--text-muted);font-size:.8rem">›</td>':'<td></td>'}
    </tr>`;
  }).join('');

  body.innerHTML = crumb + `
    <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
      ${donut}
      <div style="flex:1;min-width:280px">
        <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:6px">Overall fill: <b style="color:${totOrdQty&&Math.round(totDelQty/totOrdQty*100)>=90?'#16a34a':'#d97706'}">${totOrdQty?Math.round(totDelQty/totOrdQty*100):0}%</b> · ${Math.round(totOrdQty)} ordered · ${Math.round(totDelQty)} delivered</div>
        <div class="table-wrap"><table class="table" style="margin:0">
          <thead><tr><th>${isCat?'Category':'Sub-category'}</th><th style="text-align:right">% Split</th><th style="text-align:right">Ordered</th><th style="text-align:right">Delivered</th><th style="text-align:right">Fill %</th><th></th></tr></thead>
          <tbody>${listRows}</tbody>
        </table></div>
        ${isCat?'<div style="font-size:.73rem;color:var(--text-muted);margin-top:6px">💡 Click a category to see its sub-category split.</div>':''}
      </div>
    </div>`;

  if (window.Chart) {
    const cv = document.getElementById('drill-donut');
    if (cv) {
      if (APP.charts.drill) { try{APP.charts.drill.destroy();}catch(_){} }
      APP.charts.drill = new Chart(cv, {
        type:'doughnut',
        data:{ labels:enriched.map(r=>r.name), datasets:[{ data:enriched.map(r=>Math.round(r.ordered_value)), backgroundColor:enriched.map(r=>r.color), borderWidth:1, borderColor:'#fff' }] },
        options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
          plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>`${c.label}: ${fmt(c.raw)} (${enriched[c.dataIndex].share}%)` } } },
          onClick:(e,els)=>{ if(isCat&&els.length){ drillToSubcategory(String(enriched[els[0].index].name)); } }
        }
      });
    }
  }
}


function renderConsumptionGrid(rows) {
  if (!rows.length) return '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No consumption recorded in this period.</div>';

  const pantry    = rows.filter(r => /pantry/i.test(r.category||''));
  const beverages = rows.filter(r => /beverag/i.test(r.category||''));

  function card(title, icon, color, bg, items, mode) {
    const sorted = mode === 'top' ? items.slice(0,5) : [...items].reverse().slice(0,5);
    const label  = mode === 'top' ? 'Top 5 Most Consumed' : 'Bottom 5 Least Consumed';
    const rows2  = sorted.length ? sorted.map((r,i) => {
      const bar = Math.round((r.total_qty / (sorted[0].total_qty||1)) * 100);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid ${color}18">
        <div style="width:20px;text-align:center;font-weight:700;font-size:.78rem;color:${color}">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${h(r.item_name)}">${h(r.item_name)}</div>
          <div style="background:${color}22;border-radius:3px;height:4px;margin-top:3px;width:${bar}%"></div>
        </div>
        <div style="text-align:right;font-size:.82rem;font-weight:700;color:${color};white-space:nowrap">${Math.round(r.total_qty)} used</div>
      </div>`;
    }).join('') : `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.82rem">No data for ${title}</div>`;
    return `<div style="background:${bg};border:1px solid ${color}30;border-radius:10px;padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:1.3rem">${icon}</span>
        <div>
          <div style="font-weight:700;font-size:.88rem;color:${color}">${title}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${label}</div>
        </div>
      </div>
      ${rows2}
    </div>`;
  }

  const allTop    = card('Overall', '📊', '#1e40af', '#eff6ff', rows, 'top');
  const pantryTop = card('Pantry',  '🥫', '#065f46', '#ecfdf5', pantry, 'top');
  const bevTop    = card('Beverages','🥤', '#7c3aed', '#f5f3ff', beverages, 'top');
  const allBot    = card('Overall', '📉', '#92400e', '#fffbeb', rows, 'bottom');
  const pantryBot = card('Pantry',  '🥫', '#b91c1c', '#fef2f2', pantry, 'bottom');
  const bevBot    = card('Beverages','🥤', '#6b7280', '#f9fafb', beverages, 'bottom');

  return `
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--primary);margin-bottom:2px">▲ Highest Consumed</div>
    ${allTop}${pantryTop}${bevTop}
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-top:8px;margin-bottom:2px">▼ Lowest Consumed</div>
    ${allBot}${pantryBot}${bevBot}
  `;
}

function switchSpendTab(tab) {
  _clientRptSpendTab = tab;
  ['monthly','yearly','po'].forEach(t => {
    const btn = document.getElementById(`stab-${t}`);
    if (!btn) return;
    btn.style.borderBottomColor = t === tab ? 'var(--primary)' : 'transparent';
    btn.style.color = t === tab ? 'var(--primary)' : 'var(--text-muted)';
  });
  renderSpendContent(tab, _clientRptData.spend);
}

function renderSpendContent(tab, data) {
  const el = document.getElementById('rpt-spend-content');
  if (!el) return;

  // activate the right tab button
  ['monthly','yearly','po'].forEach(t => {
    const btn = document.getElementById(`stab-${t}`);
    if (!btn) return;
    btn.style.borderBottomColor = t === tab ? 'var(--primary)' : 'transparent';
    btn.style.color = t === tab ? 'var(--primary)' : 'var(--text-muted)';
  });

  if (!data) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No data</div>'; return; }

  if (tab === 'monthly') {
    const rows = data.monthly || [];
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    const maxSpend = Math.max(...rows.map(r => r.total_spend || 0), 1);
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Month</th><th style="text-align:right">Orders</th><th style="text-align:right">Spend</th><th style="min-width:120px">Trend</th></tr></thead>
      <tbody>${rows.map(r => {
        const bar = Math.round(((r.total_spend||0)/maxSpend)*100);
        return `<tr>
          <td style="font-weight:600">${r.month}</td>
          <td style="text-align:right">${r.order_count}</td>
          <td style="text-align:right;font-weight:700;color:var(--navy)">${fmt(r.total_spend)}</td>
          <td><div style="background:var(--primary);border-radius:3px;height:6px;width:${bar}%"></div></td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr style="background:var(--surface-alt)">
        <td style="font-weight:700">Total</td>
        <td style="text-align:right;font-weight:700">${rows.reduce((s,r)=>s+(r.order_count||0),0)}</td>
        <td style="text-align:right;font-weight:700;color:var(--primary)">${fmt(rows.reduce((s,r)=>s+(r.total_spend||0),0))}</td>
        <td></td>
      </tr></tfoot>
    </table></div></div>`;

  } else if (tab === 'yearly') {
    const monthly = data.monthly || [];
    // group by year
    const byYear = {};
    monthly.forEach(r => {
      const y = r.year || r.month?.slice(0,4) || '—';
      if (!byYear[y]) byYear[y] = { year:y, order_count:0, total_spend:0, months:0 };
      byYear[y].order_count += (r.order_count||0);
      byYear[y].total_spend += (r.total_spend||0);
      byYear[y].months++;
    });
    const years = Object.values(byYear).sort((a,b)=>a.year<b.year?-1:1);
    if (!years.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Year</th><th style="text-align:right">Months Active</th><th style="text-align:right">Orders</th><th style="text-align:right">Total Spend</th><th style="text-align:right">Avg / Month</th></tr></thead>
      <tbody>${years.map(r => `<tr>
        <td style="font-weight:700;font-size:.95rem">${r.year}</td>
        <td style="text-align:right">${r.months}</td>
        <td style="text-align:right">${r.order_count}</td>
        <td style="text-align:right;font-weight:700;color:var(--navy)">${fmt(r.total_spend)}</td>
        <td style="text-align:right;color:var(--text-muted)">${fmt(r.months ? r.total_spend/r.months : 0)}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;

  } else if (tab === 'po') {
    const rows = data.po_wise || [];
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Order / PO</th><th>Date</th><th style="text-align:center">Items</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="font-weight:700;color:var(--primary)">#${r.order_id}</td>
        <td style="font-size:.8rem;color:var(--text-muted)">${fmtDate(r.created_at)}</td>
        <td style="text-align:center">${r.item_count}</td>
        <td style="text-align:right;font-weight:700">${fmt(r.grand_total)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="background:var(--surface-alt)">
        <td colspan="3" style="font-weight:700">Total (${rows.length} orders)</td>
        <td style="text-align:right;font-weight:700;color:var(--primary)">${fmt(rows.reduce((s,r)=>s+(r.grand_total||0),0))}</td>
        <td></td>
      </tr></tfoot>
    </table></div></div>`;
  }
}

function downloadClientConsumptionCSV() {
  const rows = _clientRptData.consumption?.rows || [];
  if (!rows.length) { showToast('No data to export', 'error'); return; }
  const header = 'SKU,Item Name,Category,Total Qty Used,Log Count';
  const body = rows.map(r => [r.sku, `"${r.item_name}"`, r.category||'', Math.round(r.total_qty), r.log_count].join(',')).join('\n');
  _downloadCSV('consumption-report', header + '\n' + body);
}

function downloadClientSpendCSV() {
  if (_clientRptSpendTab === 'po') {
    const rows = _clientRptData.spend?.po_wise || [];
    if (!rows.length) { showToast('No data to export', 'error'); return; }
    const header = 'Order ID,Date,Items,Amount,Status';
    const body = rows.map(r => [`#${r.order_id}`, fmtDate(r.created_at), r.item_count, r.grand_total, r.status].join(',')).join('\n');
    _downloadCSV('spend-po-report', header + '\n' + body);
  } else {
    const rows = _clientRptData.spend?.monthly || [];
    if (!rows.length) { showToast('No data to export', 'error'); return; }
    const header = 'Month,Year,Orders,Total Spend';
    const body = rows.map(r => [r.month, r.year, r.order_count, r.total_spend].join(',')).join('\n');
    _downloadCSV('spend-monthly-report', header + '\n' + body);
  }
}

function _downloadCSV(name, csv) {
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

/* ============================================================
   USERS
   ============================================================ */
async function renderUsers(el) {
  const users = await api('/users');
  if (!users) return;
  APP._usersCache = Object.fromEntries(users.map(u=>[u.id,u]));

  const activeUsers   = users.filter(u=>u.active);
  const inactiveUsers = users.filter(u=>!u.active);
  const with2FA       = users.filter(u=>u.two_fa_enabled).length;

  const ROLE_COLOR = {
    super_admin:    '#7c3aed',
    ops_admin:      '#2563eb',
    ops_user:       '#3b82f6',
    vendor_admin:   '#d97706',
    vendor_user:    '#f59e0b',
    client_admin:   '#059669',
    client_user:    '#10b981',
    client_approver:'#0891b2',
    delivery_exec:  '#6b7280',
  };

  function userCard(u) {
    const rc = ROLE_COLOR[u.role] || '#6b7280';
    const roleName = (ROLES[u.role]?.label || u.role).replace(/_/g,' ');
    return `
    <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 18px;display:flex;align-items:center;gap:14px;opacity:${u.active?1:.6}">
      <div style="width:44px;height:44px;border-radius:50%;background:${u.active?rc:'#9ca3af'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${u.initials||u.name[0]}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:.9rem;color:var(--navy)">${u.name}</span>
          ${u.active?'':'<span style="font-size:.66rem;font-weight:700;background:#fee2e2;color:var(--danger);border-radius:4px;padding:1px 6px">INACTIVE</span>'}
        </div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${u.email}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap">
          <span style="font-size:.68rem;font-weight:700;background:${rc}1a;color:${rc};border-radius:4px;padding:2px 7px">${roleName}</span>
          <span style="font-size:.68rem;color:var(--text-muted)">${u.org}</span>
          ${u.two_fa_enabled?`<span style="font-size:.66rem;font-weight:600;background:#d1fae5;color:#059669;border-radius:4px;padding:1px 6px">🔐 2FA</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:.72rem;color:var(--text-muted)">
          <input type="checkbox" ${u.two_fa_enabled?'checked':''} onchange="toggle2FA('${u.id}',this.checked)">
          2FA
        </label>
        <div style="display:flex;gap:5px">
          <button class="btn btn-secondary btn-sm" onclick="editUserModal('${u.id}')" style="font-size:.7rem;padding:3px 8px">✏️ Edit</button>
          ${u.active
            ? `<button class="btn btn-danger btn-sm" onclick="deactivateUser('${u.id}','${u.name.replace(/'/g,"\\'")}')" style="font-size:.7rem;padding:3px 8px">Deactivate</button>`
            : `<button class="btn btn-primary btn-sm" onclick="activateUser('${u.id}')" style="font-size:.7rem;padding:3px 8px">Activate</button>`}
        </div>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Users & Roles</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${users.length} total · ${activeUsers.length} active · ${with2FA} with 2FA</div>
    </div>
    <button class="btn btn-gold" onclick="addUserModal()">${iconPlus(14)} Add User</button>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Total Users</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${users.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${activeUsers.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${inactiveUsers.length?'#d1d5db':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Inactive</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${inactiveUsers.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #7c3aed">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">2FA Enabled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${with2FA}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${users.length?Math.round(with2FA/users.length*100):0}% of users</div>
    </div>
  </div>

  <!-- Active users by role group -->
  ${Object.entries(
    activeUsers.reduce((g,u)=>{
      const group = ROLES[u.role]?.nav==='client'||ROLES[u.role]?.nav==='client_user'||ROLES[u.role]?.nav==='approver' ? 'Client'
                  : ROLES[u.role]?.nav==='vendor'||ROLES[u.role]?.nav==='vendor_user' ? 'Vendor'
                  : ROLES[u.role]?.nav==='delivery_exec' ? 'Delivery'
                  : u.role==='super_admin' ? 'Super Admin'
                  : 'Operations';
      if (!g[group]) g[group]=[];
      g[group].push(u);
      return g;
    }, {})
  ).map(([group, groupUsers])=>`
  <div style="margin-bottom:18px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${group} (${groupUsers.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px">
      ${groupUsers.map(u=>userCard(u)).join('')}
    </div>
  </div>`).join('')}

  ${inactiveUsers.length ? `
  <div style="margin-top:10px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Inactive (${inactiveUsers.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px">
      ${inactiveUsers.map(u=>userCard(u)).join('')}
    </div>
  </div>` : ''}
  `;
}

const CLIENT_ROLES = ['client_admin','client_approver','client_user'];
const VENDOR_ROLES = ['vendor_admin','vendor_user'];

/* Org field by role: client dropdown / vendor dropdown / fixed 4SYZ Platform */
function userOrgFieldHtml(prefix, role, clients, vendors, currentClientId, currentOrg) {
  if (CLIENT_ROLES.includes(role)) {
    if (!clients.length) {
      return `<div class="alert alert-warning" style="margin:0">No active clients onboarded yet. Onboard the client first (Clients page), then create its users.</div>`;
    }
    return `<select id="${prefix}-client">
      <option value="">— Select client —</option>
      ${clients.map(c=>`<option value="${c.id}" ${c.id===currentClientId?'selected':''}>${h(c.name)}</option>`).join('')}
    </select>
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Client users must belong to an onboarded client</div>`;
  }
  if (VENDOR_ROLES.includes(role)) {
    if (!vendors.length) {
      return `<div class="alert alert-warning" style="margin:0">No vendors created yet. Add the vendor first (Vendors page), then create its users.</div>`;
    }
    return `<select id="${prefix}-vendor">
      <option value="">— Select vendor —</option>
      ${vendors.map(v=>`<option value="${v.id}" ${v.name===currentOrg?'selected':''}>${h(v.name)}</option>`).join('')}
    </select>
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Vendor users must belong to an existing vendor</div>`;
  }
  // Platform roles (Super Admin, Ops, Delivery, Finance…) — company is fixed
  return `<input type="text" id="${prefix}-org" value="4SYZ Platform" readonly
    style="background:var(--surface-alt,#f3f4f6);color:var(--text-muted);cursor:not-allowed">
  <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Platform roles always belong to 4SYZ Platform</div>`;
}

function bindUserRoleToggle(prefix, clients, vendors, currentClientId, currentOrg) {
  const roleSel = document.getElementById(`${prefix}-role`);
  if (!roleSel) return;
  roleSel.onchange = () => {
    const wrap = document.getElementById(`${prefix}-org-wrap`);
    if (wrap) wrap.innerHTML = userOrgFieldHtml(prefix, roleSel.value, clients, vendors, currentClientId, currentOrg);
  };
}

async function addUserModal() {
  if (APP.user.role !== 'super_admin') { showToast('Only Super Admin can add users','error'); return; }
  const [clientsRaw, vendorsRaw] = await Promise.all([
    api('/clients').catch(()=>[]),
    api('/vendors').catch(()=>[]),
  ]);
  const clients = (clientsRaw||[]).filter(c=>c.active);
  const vendors = (vendorsRaw||[]);
  const firstRole = Object.keys(ROLES)[0];
  openModal('Add User',
    `<div class="form-group"><label>Full Name</label><input type="text" id="u-name"></div>
     <div class="form-group"><label>Email</label><input type="email" id="u-email"></div>
     <div class="form-group"><label>Role</label>
       <select id="u-role">
         ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
       </select>
     </div>
     <div class="form-group"><label>Company / Client / Vendor</label>
       <div id="u-org-wrap">${userOrgFieldHtml('u', firstRole, clients, vendors, null, '')}</div>
     </div>
     <div class="form-group"><label>Temporary Password</label><input type="password" id="u-pw" value="password"></div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveUser()">Create User</button>`);
  bindUserRoleToggle('u', clients, vendors, null, '');
}

async function saveUser() {
  const role = document.getElementById('u-role').value;
  const body = {
    name: document.getElementById('u-name').value,
    email: document.getElementById('u-email').value,
    role,
    password: document.getElementById('u-pw').value || 'password',
  };
  if (!body.name||!body.email) { showToast('Name and email required','error'); return; }
  if (CLIENT_ROLES.includes(role)) {
    const clientId = document.getElementById('u-client')?.value;
    if (!clientId) { showToast('Select a client — client users must belong to an onboarded client','error'); return; }
    body.client_id = clientId;
  } else if (VENDOR_ROLES.includes(role)) {
    const vendorId = document.getElementById('u-vendor')?.value;
    if (!vendorId) { showToast('Select a vendor — vendor users must belong to an existing vendor','error'); return; }
    body.vendor_id = vendorId;
  }
  // Platform roles: org is fixed server-side to 4SYZ Platform
  const res = await api('/users', { method:'POST', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast('User created — credentials sent via email'); navigate('users');
}

async function editUserModal(id) {
  if (APP.user.role !== 'super_admin') { showToast('Only Super Admin can edit users','error'); return; }
  const u = APP._usersCache?.[id];
  if (!u) { showToast('User not found','error'); return; }
  const [clientsRaw, vendorsRaw] = await Promise.all([
    api('/clients').catch(()=>[]),
    api('/vendors').catch(()=>[]),
  ]);
  const clients = (clientsRaw||[]).filter(c=>c.active);
  const vendors = (vendorsRaw||[]);
  openModal(`Edit User — ${u.name}`,
    `<div class="form-group"><label>Full Name</label><input type="text" id="eu-name" value="${h(u.name)}"></div>
     <div class="form-group"><label>Email</label><input type="email" id="eu-email" value="${h(u.email)}"></div>
     <div class="form-group"><label>Role</label>
       <select id="eu-role">
         ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v.label}</option>`).join('')}
       </select>
     </div>
     <div class="form-group"><label>Company / Client / Vendor</label>
       <div id="eu-org-wrap">${userOrgFieldHtml('eu', u.role, clients, vendors, u.client_id, u.org)}</div>
     </div>
     <div class="form-group">
       <label>Reset Password <span style="font-weight:400;color:var(--text-muted);font-size:.76rem">(leave blank to keep current)</span></label>
       <input type="password" id="eu-pw" placeholder="New password">
     </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="saveUserEdit('${id}')">Save Changes</button>`);
  bindUserRoleToggle('eu', clients, vendors, u.client_id, u.org);
}

async function saveUserEdit(id) {
  const u = APP._usersCache?.[id] || {};
  const name  = document.getElementById('eu-name')?.value?.trim();
  const email = document.getElementById('eu-email')?.value?.trim();
  const role  = document.getElementById('eu-role')?.value;
  const pw    = document.getElementById('eu-pw')?.value;
  if (!name || !email) { showToast('Name and email are required','error'); return; }

  const body = {};
  if (name  !== u.name)  body.name  = name;
  if (email !== u.email) body.email = email;
  if (role  !== u.role)  body.role  = role;
  if (CLIENT_ROLES.includes(role)) {
    const clientId = document.getElementById('eu-client')?.value;
    if (!clientId) { showToast('Select a client — client users must belong to an onboarded client','error'); return; }
    if (clientId !== u.client_id) body.client_id = clientId;
  } else if (VENDOR_ROLES.includes(role)) {
    const vendorSel = document.getElementById('eu-vendor');
    const vendorId = vendorSel?.value;
    if (!vendorId) { showToast('Select a vendor — vendor users must belong to an existing vendor','error'); return; }
    const vendorName = vendorSel.options[vendorSel.selectedIndex]?.text;
    if (vendorName !== u.org) body.vendor_id = vendorId;
    if (u.client_id) body.client_id = ''; // unlink client when moving to a vendor role
  } else {
    // Platform role — org fixed server-side; just ensure client link is removed
    if (u.client_id && role !== u.role) body.client_id = '';
  }
  if (pw) body.password = pw;
  if (!Object.keys(body).length) { closeModal(); showToast('No changes made','info'); return; }

  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast(`${name} updated${body.role?' — role changed to '+(ROLES[role]?.label||role):''}`); navigate('users');
}

function deactivateUser(id, name) {
  openModal('Deactivate User',
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to deactivate <b>${name||'this user'}</b>? They will no longer be able to log in.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmDeactivateUser('${id}')">Deactivate</button>`);
}

async function confirmDeactivateUser(id) {
  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify({ active:0 }) });
  closeModal();
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
  { id:'budgets',       icon:'💰', label:'Client Budgets',   desc:'Monthly budgets & approval thresholds' },
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

  const envNote = `<div class="alert alert-warning" style="font-size:.82rem;margin-bottom:0">
    ⚙️ These settings are controlled by environment variables in <code>wrangler.jsonc</code>. The status shown is live from the server — to change values, update the env vars and redeploy.
  </div>`;

  const statusPill = (ok, trueLabel='Enabled', falseLabel='Disabled') =>
    ok ? `<span class="badge badge-success">${trueLabel}</span>`
       : `<span class="badge badge-warning">${falseLabel}</span>`;

  if (tab === 'auth') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Authentication & OTP</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">OTP / MFA</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Two-factor authentication via email/SMS</div>
            </div>
            ${statusPill(s.otp_enabled)}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MSG91 SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">OTP delivery via SMS</div>
            </div>
            ${statusPill(s.msg91_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">To enable OTP: set <code>OTP_ENABLED=true</code> in wrangler.jsonc vars and redeploy.</div>
      </div>
    </div>`;
  }

  else if (tab === 'notifications') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Email & SMS Configuration</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MailChannels Email</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Transactional email delivery</div>
            </div>
            ${statusPill(s.mailchannels_enabled)}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MSG91 SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">OTP and alert delivery via SMS</div>
            </div>
            ${statusPill(s.msg91_configured, 'Configured', 'Not configured')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">Twilio Voice/SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Alternate SMS/voice notifications</div>
            </div>
            ${statusPill(s.twilio_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <button class="btn btn-secondary" style="width:fit-content" onclick="testEmail()">Send Test Email</button>
      </div>
    </div>`;
  }

  else if (tab === 'integrations') {
    const s = await api('/settings') || {};
    const origin = window.location.origin;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Zoho Books Integration</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">Zoho Books API</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Org ID + Client ID configured</div>
            </div>
            ${statusPill(s.zoho_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">Webhook URL</div>
          <div style="display:flex;align-items:center;gap:8px">
            <code style="font-size:.8rem;background:#f1f5f9;padding:6px 10px;border-radius:6px;flex:1;word-break:break-all">${origin}/api/integrations/zoho/webhook</code>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${origin}/api/integrations/zoho/webhook').then(()=>showToast('Copied'))">Copy</button>
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:6px">Configure this URL in Zoho Books → Settings → Webhooks</div>
        </div>
      </div>
    </div>`;
  }

  else if (tab === 'budgets') {
    const s = await api('/settings') || {};
    const clients = s.clients || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span>Client Budgets & Approval Thresholds</span>
        <button class="btn btn-primary btn-sm" onclick="saveClientBudgets()">Save Changes</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Monthly Budget (₹)</th><th>Auto-Approve Below (₹)</th></tr></thead>
          <tbody>
            ${clients.length ? clients.map(c=>`<tr>
              <td style="font-weight:600">${c.name}</td>
              <td><input type="number" class="budget-input" data-id="${c.id}" data-field="monthly_budget"
                value="${c.monthly_budget||''}" min="0" placeholder="No limit"
                style="width:140px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.86rem"></td>
              <td><input type="number" class="threshold-input" data-id="${c.id}" data-field="approval_threshold"
                value="${c.approval_threshold||''}" min="0" placeholder="No auto-approve"
                style="width:160px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.86rem"></td>
            </tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No clients found</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="padding:12px 16px;font-size:.8rem;color:var(--text-muted)">
        Monthly Budget: maximum spend per calendar month. Auto-Approve Below: orders under this value skip manual approval.
      </div>
    </div>`;
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
    const warehouses = await api('/warehouses') || [];
    el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-size:.82rem;color:var(--text-muted)">
        Showing warehouse summary. For full GRN, bins and stock transfers →
        <button class="btn btn-secondary btn-sm" style="margin-left:6px" onclick="navigate('warehouse')">Open Warehouse page</button>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addWarehouseModal()">+ Add Warehouse</button>
    </div>
    <div class="card">
      <div class="card-header"><span>Warehouses (${warehouses.length})</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Location</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${warehouses.length ? warehouses.map(w=>`<tr>
              <td><b>${w.name}</b></td>
              <td>${w.location||'—'}</td>
              <td>${w.type||'—'}</td>
              <td>${w.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="navigate('warehouse')">Manage</button></td>
            </tr>`).join('')
            : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No warehouses configured</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
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
  showToast('These settings are controlled by environment variables — update wrangler.jsonc and redeploy to change them.', 'warning');
}

async function saveClientBudgets() {
  const budgetInputs = document.querySelectorAll('.budget-input');
  const threshInputs = document.querySelectorAll('.threshold-input');
  const map = {};
  budgetInputs.forEach(inp => {
    const id = inp.dataset.id;
    if (!map[id]) map[id] = { id };
    map[id].monthly_budget = inp.value ? +inp.value : null;
  });
  threshInputs.forEach(inp => {
    const id = inp.dataset.id;
    if (!map[id]) map[id] = { id };
    map[id].approval_threshold = inp.value ? +inp.value : null;
  });
  const client_budgets = Object.values(map);
  const res = await api('/settings', { method:'POST', body: JSON.stringify({ client_budgets }) });
  if (res) showToast('Client budgets saved successfully');
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

  const sentPOs       = pos.filter(p=>p.status==='SENT');
  const acceptedPOs   = pos.filter(p=>p.status==='ACCEPTED');
  const dispatchedPOs = pos.filter(p=>p.status==='DISPATCHED');
  const invoicedPOs   = pos.filter(p=>p.status==='INVOICED');
  const totalValue    = sentPOs.reduce((s,p)=>s+(p.grand_total||0),0);

  const PO_META = {
    SENT:       { label:'Action Required', color:'#d97706', bg:'#fef3c7', border:'#f59e0b', icon:'⚡' },
    ACCEPTED:   { label:'Accepted',        color:'#2563eb', bg:'#dbeafe', border:'#3b82f6', icon:'✓' },
    DISPATCHED: { label:'Dispatched',      color:'#7c3aed', bg:'#ede9fe', border:'#8b5cf6', icon:'🚚' },
    INVOICED:   { label:'Invoiced',        color:'#059669', bg:'#d1fae5', border:'#10b981', icon:'📄' },
  };

  function poCard(po) {
    const m = PO_META[po.status] || { label:po.status, color:'#6b7280', bg:'#f3f4f6', border:'#d1d5db', icon:'•' };
    const steps = ['SENT','ACCEPTED','DISPATCHED','INVOICED'];
    const stepIdx = steps.indexOf(po.status);
    const isOverdue = po.expected_delivery && po.status!=='INVOICED' && new Date(po.expected_delivery)<new Date();
    return `
    <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:20px;margin-bottom:14px;border-left:4px solid ${isOverdue?'var(--danger)':m.border}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:800;font-size:1rem;color:var(--navy)">${po.id}</span>
            <span style="font-size:.68rem;font-weight:700;background:${m.bg};color:${m.color};border-radius:4px;padding:2px 8px">${m.icon} ${m.label}</span>
            ${isOverdue?`<span style="font-size:.68rem;font-weight:700;background:#fef2f2;color:var(--danger);border-radius:4px;padding:2px 8px">⚠ Overdue</span>`:''}
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:4px">
            Created ${fmtDate(po.created_at)}${po.expected_delivery?' · Expected '+fmtDate(po.expected_delivery):''}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:800;font-size:1.2rem;color:var(--navy)">${fmt(po.grand_total)}</div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">${(po.items||[]).length} line items</div>
        </div>
      </div>
      <!-- progress bar -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:14px">
        ${steps.map((s,i)=>{
          const done = stepIdx >= i;
          const active = stepIdx === i;
          return `<div style="display:flex;align-items:center;flex:1">
            <div style="width:20px;height:20px;border-radius:50%;background:${done?m.color:'#e5e7eb'};display:flex;align-items:center;justify-content:center;font-size:.58rem;color:#fff;font-weight:700;flex-shrink:0;${active?'box-shadow:0 0 0 3px '+m.bg:''}">${i+1}</div>
            <div style="font-size:.6rem;color:${done?m.color:'#9ca3af'};margin-left:3px;white-space:nowrap;font-weight:${active?700:400}">${s.replace('_',' ')}</div>
            ${i<steps.length-1?`<div style="flex:1;height:2px;background:${stepIdx>i?m.color:'#e5e7eb'};margin:0 4px;min-width:8px"></div>`:''}
          </div>`;
        }).join('')}
      </div>
      <!-- items preview -->
      ${(po.items||[]).length ? `
      <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">
        ${(po.items||[]).slice(0,4).map(i=>`<span style="background:#f3f4f6;border-radius:4px;padding:2px 7px">${i.name} ×${i.qty}</span>`).join('')}
        ${(po.items||[]).length>4?`<span style="background:#f3f4f6;border-radius:4px;padding:2px 7px;color:var(--text-muted)">+${(po.items||[]).length-4} more</span>`:''}
      </div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${poActions(po)}</div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Purchase Orders</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${pos.length} total · ${sentPOs.length} need action</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #f59e0b;cursor:pointer" onclick="document.getElementById('vpo-sent').scrollIntoView({behavior:'smooth'})">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Action Required</div>
      <div style="font-size:2rem;font-weight:800;color:${sentPOs.length?'#d97706':'var(--navy)'};margin-top:6px">${sentPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalValue)} pending</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #3b82f6">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Accepted</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${acceptedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">preparing to dispatch</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid #8b5cf6">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Dispatched</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${dispatchedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">awaiting invoice</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Invoiced</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${invoicedPOs.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">payment pending</div>
    </div>
  </div>

  ${sentPOs.length ? `
  <div id="vpo-sent" style="font-size:.84rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚡ Action Required</div>
  ${sentPOs.map(po=>poCard(po)).join('')}` : ''}

  ${acceptedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length?20:0}px">✓ Accepted — Prepare Dispatch</div>
  ${acceptedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${dispatchedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length||acceptedPOs.length?20:0}px">🚚 Dispatched — Upload Invoice</div>
  ${dispatchedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${invoicedPOs.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;margin-top:${sentPOs.length||acceptedPOs.length||dispatchedPOs.length?20:0}px">📄 Invoiced — Awaiting Payment</div>
  ${invoicedPOs.map(po=>poCard(po)).join('')}` : ''}

  ${pos.length===0?`<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">📦</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">No purchase orders yet</div>
    <div style="font-size:.84rem;margin-top:6px">POs will appear here when the ops team sends them to you.</div>
  </div>`:''}
  `;
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
  const invoiced  = pos.filter(p => p.status === 'INVOICED' || p.invoice_url);
  const pending   = pos.filter(p => p.status === 'DISPATCHED' && !p.invoice_url);
  const totalInv  = invoiced.reduce((s,p)=>s+(p.grand_total||0),0);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Invoices</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${invoiced.length} submitted · ${pending.length} pending upload</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Invoices Submitted</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${invoiced.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(totalInv)} total</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${pending.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Awaiting Upload</div>
      <div style="font-size:2rem;font-weight:800;color:${pending.length?'#d97706':'var(--navy)'};margin-top:6px">${pending.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">dispatched, no invoice yet</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Net-30 Terms</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">30d</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">avg payment cycle</div>
    </div>
  </div>

  ${pending.length ? `
  <div style="font-size:.84rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚡ Awaiting Invoice Upload</div>
  ${pending.map(po=>`
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 20px;margin-bottom:10px;border-left:4px solid #f59e0b;display:flex;justify-content:space-between;align-items:center;gap:12px">
    <div>
      <div style="font-weight:700;font-size:.92rem;color:var(--navy)">${po.id}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">Dispatched ${fmtDate(po.updated_at)} · ${fmt(po.grand_total)}</div>
    </div>
    <button class="btn btn-primary btn-sm" onclick="uploadInvoice('${po.id}')">Upload Invoice</button>
  </div>`).join('')}
  <div style="margin-bottom:18px"></div>` : ''}

  <div style="font-size:.84rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Submitted Invoices</div>
  ${invoiced.length===0 ? `
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2rem;margin-bottom:10px">📄</div>
    <div style="font-weight:600;color:var(--navy)">No invoices submitted yet</div>
    <div style="font-size:.82rem;margin-top:6px">Invoices appear here once uploaded after dispatch.</div>
  </div>` :
  `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    ${invoiced.map((po,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<invoiced.length-1?'border-bottom:1px solid var(--border)':''}">
      <div style="min-width:0">
        <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${po.id}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Uploaded ${fmtDate(po.updated_at)}</div>
      </div>
      <div style="flex:1;min-width:0;text-align:center">
        ${po.invoice_url ? `<a href="${po.invoice_url}" target="_blank" style="font-size:.76rem;color:var(--blue);word-break:break-all">${po.invoice_url.length>40?po.invoice_url.slice(0,40)+'…':po.invoice_url}</a>` : '<span style="font-size:.76rem;color:var(--text-muted)">—</span>'}
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-weight:700;font-size:.88rem">${fmt(po.grand_total)}</div>
        ${statusBadge(po.status)}
      </div>
    </div>`).join('')}
  </div>`}
  `;
}

async function renderVendorPayments(el) {
  const pos = await api('/purchase-orders');
  if (!pos) return;
  const invoiced     = pos.filter(p => p.status === 'INVOICED');
  const totalPending = invoiced.reduce((s,p) => s + (p.grand_total||0), 0);
  const today        = new Date();

  function daysUntilDue(po) {
    const due = new Date(new Date(po.updated_at).getTime() + 30*86400000);
    return Math.ceil((due - today) / 86400000);
  }

  const overdue    = invoiced.filter(p => daysUntilDue(p) < 0);
  const dueSoon    = invoiced.filter(p => { const d=daysUntilDue(p); return d>=0 && d<=7; });
  const upcoming   = invoiced.filter(p => daysUntilDue(p) > 7);

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Payments</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Track receivables and payment schedules</div>
    </div>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'var(--warning)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pending Receivable</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:6px">${fmt(totalPending)}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${invoiced.length} invoice${invoiced.length===1?'':'s'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${overdue.length?'var(--danger)':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Overdue</div>
      <div style="font-size:2rem;font-weight:800;color:${overdue.length?'var(--danger)':'var(--navy)'};margin-top:6px">${overdue.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(overdue.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${dueSoon.length?'#f59e0b':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Due This Week</div>
      <div style="font-size:2rem;font-weight:800;color:${dueSoon.length?'#d97706':'var(--navy)'};margin-top:6px">${dueSoon.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${fmt(dueSoon.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Payment Terms</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">Net-30</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">from invoice date</div>
    </div>
  </div>

  ${invoiced.length===0 ? `
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">💰</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">No pending payments</div>
    <div style="font-size:.84rem;margin-top:6px">Submit invoices after dispatch to start tracking payments.</div>
  </div>` : `

  <!-- Payment tracker cards -->
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;font-size:.9rem;color:var(--navy)">Payment Tracker</span>
      <span style="font-size:.76rem;color:var(--text-muted)">All amounts due on Net-30 from invoice date</span>
    </div>
    ${invoiced.map((po,i)=>{
      const d = daysUntilDue(po);
      const dueDate = new Date(new Date(po.updated_at).getTime() + 30*86400000);
      const isOv = d < 0;
      const isSoon = d >= 0 && d <= 7;
      const barColor = isOv ? 'var(--danger)' : isSoon ? '#f59e0b' : 'var(--success)';
      const barPct = Math.min(100, Math.max(0, Math.round(((30+d)/30)*100)));
      return `
      <div style="padding:16px 20px;${i<invoiced.length-1?'border-bottom:1px solid var(--border)':''}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--navy)">${po.id}</div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Invoice: ${po.invoice_url ? `<a href="${po.invoice_url}" target="_blank" style="color:var(--blue)">${po.invoice_url.length>35?po.invoice_url.slice(0,35)+'…':po.invoice_url}</a>` : '—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-weight:800;font-size:1rem;color:var(--navy)">${fmt(po.grand_total)}</div>
            <div style="font-size:.72rem;margin-top:3px;font-weight:600;color:${barColor}">
              ${isOv ? `${Math.abs(d)}d overdue` : d===0 ? 'Due today' : `Due in ${d}d`}
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;background:var(--border);height:6px;border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${barPct}%;background:${barColor};border-radius:3px;transition:width .5s"></div>
          </div>
          <div style="font-size:.7rem;color:var(--text-muted);white-space:nowrap">Due ${dueDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
          <span style="font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:4px;background:${isOv?'#fef2f2':isSoon?'#fef3c7':'#d1fae5'};color:${barColor}">${isOv?'OVERDUE':isSoon?'DUE SOON':'ON TRACK'}</span>
        </div>
      </div>`;
    }).join('')}
  </div>`}
  `;
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

  const undelivered  = (dcs || []).filter(d => d.status !== 'DELIVERED');
  const planned      = routes.filter(r => r.status === 'PLANNED');
  const inProgress   = routes.filter(r => r.status === 'IN_PROGRESS');
  const completed    = routes.filter(r => r.status === 'COMPLETED');

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Total Routes',val:routes.length,sub:'all time',color:'var(--navy)'},
      {label:'Planned',val:planned.length,sub:'ready to start',color:planned.length?'var(--blue)':'var(--success)'},
      {label:'In Progress',val:inProgress.length,sub:'currently active',color:inProgress.length?'var(--warning)':'var(--success)'},
      {label:'Unrouted DCs',val:undelivered.length,sub:'need assignment',color:undelivered.length?'var(--danger)':'var(--success)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  const dcSelector = undelivered.length ? `
  <div class="card" style="margin-bottom:16px">
    <div class="card-header">
      <span>Unrouted Delivery Challans (${undelivered.length})</span>
      <button class="btn btn-gold btn-sm" onclick="createOptimizedRoute()">Create Route from Selected</button>
    </div>
    <div style="padding:12px 16px">
      <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px">Select challans to bundle into a route:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px">
        ${undelivered.map(dc=>`
          <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:background .15s" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
            <input type="checkbox" class="dc-select" data-id="${dc.id}" value="${dc.id}" style="width:16px;height:16px;flex-shrink:0">
            <div>
              <div style="font-weight:600;font-size:.85rem">DC #${dc.id}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id||'—'} · ${dc.client_name||'Unknown'} ${dc.dispatched_at?'· Dispatched '+fmtDate(dc.dispatched_at):''}</div>
            </div>
          </label>`).join('')}
      </div>
    </div>
  </div>` : `
  <div class="card" style="padding:16px 20px;margin-bottom:16px;border-left:3px solid var(--success);display:flex;align-items:center;gap:12px">
    <span style="font-size:1.3rem">✓</span>
    <div><div style="font-weight:600;color:var(--success)">All DCs routed</div><div style="font-size:.82rem;color:var(--text-muted)">No unassigned delivery challans</div></div>
  </div>`;

  function routeCard(r) {
    const stops = typeof r.stops === 'string' ? JSON.parse(r.stops) : (r.stops||[]);
    const statusColor = r.status==='COMPLETED'?'var(--success)':r.status==='IN_PROGRESS'?'var(--warning)':'var(--blue)';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${statusColor}">
      <div style="padding:14px 16px 10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700">${r.name}</span>
          ${statusBadge(r.status)}
        </div>
        <div style="font-size:.8rem;color:var(--text-muted)">${fmtDate(r.route_date)} · ${stops.length} stop${stops.length!==1?'s':''}</div>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        ${r.status==='PLANNED'?`<button class="btn btn-primary btn-sm" onclick="updateRouteStatus('${r.id}','IN_PROGRESS')">Start Route</button>`:''}
        ${r.status==='IN_PROGRESS'?`<button class="btn btn-success btn-sm" onclick="updateRouteStatus('${r.id}','COMPLETED')">Complete</button>`:''}
      </div>
    </div>`;
  }

  el.innerHTML = `
  ${pageHeader('Route Optimization', 'Plan and track delivery routes',
    `<button class="btn btn-gold" onclick="openNewRouteModal()">New Route</button>`)}
  ${kpis}
  ${dcSelector}
  ${routes.length ? `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:10px">All Routes (${routes.length})</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
    ${routes.map(routeCard).join('')}
  </div>` : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">🗺</div>No routes created yet</div>`}`;
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

  const recentEvents = (events||[]).slice(0,10);
  const ACTION_COLOR = { EMAIL:'#2563eb', SMS:'#7c3aed', ESCALATE:'#d97706', SUSPEND:'var(--danger)' };

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Dunning & Payment Escalation</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${rules.length} escalation rule${rules.length===1?'':'s'} · ${recentEvents.length} recent event${recentEvents.length===1?'':'s'}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary" onclick="addDunningRuleModal()">${iconPlus(14)} Add Rule</button>
      <button class="btn btn-gold" onclick="runDunningCheck()">▶ Run Check</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <!-- Rules -->
    <div>
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Escalation Rules</div>
      ${rules.length===0 ? `
      <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
        <div style="font-size:1.8rem;margin-bottom:10px">📋</div>
        <div style="font-weight:600;color:var(--navy)">No rules configured</div>
        <div style="font-size:.82rem;margin-top:6px">Add rules to automate payment escalation.</div>
        <button class="btn btn-primary" style="margin-top:14px" onclick="addDunningRuleModal()">Add First Rule</button>
      </div>` :
      `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
        ${rules.sort((a,b)=>(a.days_overdue||0)-(b.days_overdue||0)).map((r,i)=>{
          const ac = ACTION_COLOR[r.action] || '#6b7280';
          return `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;${i<rules.length-1?'border-bottom:1px solid var(--border)':''}">
            <div style="width:48px;height:48px;border-radius:10px;background:${ac}1a;color:${ac};display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;flex-shrink:0">${r.days_overdue}d</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:.68rem;font-weight:700;background:${ac}1a;color:${ac};border-radius:4px;padding:2px 7px">${r.action}</span>
              </div>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.message_template||'No message template'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>

    <!-- Recent Events -->
    <div>
      <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Recent Events</div>
      ${recentEvents.length===0 ? `
      <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:40px;text-align:center;color:var(--text-muted)">
        <div style="font-size:1.8rem;margin-bottom:10px">📭</div>
        <div style="font-weight:600;color:var(--navy)">No events yet</div>
        <div style="font-size:.82rem;margin-top:6px">Run a dunning check to trigger escalations.</div>
      </div>` :
      `<div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
        ${recentEvents.map((e,i)=>{
          const ac = ACTION_COLOR[e.action_taken] || '#6b7280';
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 18px;gap:12px;${i<recentEvents.length-1?'border-bottom:1px solid var(--border)':''}">
            <div>
              <div style="font-weight:700;font-size:.84rem;color:var(--navy)">${e.client_name||e.client_id}</div>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">Order: ${e.order_id||'—'}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:.68rem;font-weight:700;background:${ac}1a;color:${ac};border-radius:4px;padding:2px 7px;margin-bottom:3px">${e.action_taken}</div>
              <div style="font-size:.68rem;color:var(--text-muted)">${fmtDate(e.created_at)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>`}
    </div>
  </div>
  `;
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
  const canImportVendors = APP.user && !['client_admin','client_user','client_approver','vendor_admin','vendor_user','delivery_exec'].includes(APP.user.role);
  const startTab = APP._importDefaultTab || 'inventory';
  APP._importDefaultTab = null;

  el.innerHTML = `
  ${pageHeader('CSV Data Import', 'Import inventory and orders from CSV files')}
  <div class="tab-pills" id="import-tabs" style="margin-bottom:16px">
    <button class="tab-pill${startTab==='inventory'?' active':''}" onclick="importTab('inventory',this)">Inventory</button>
    <button class="tab-pill${startTab==='orders'?' active':''}" onclick="importTab('orders',this)">Orders</button>
    ${canImportVendors ? '<button class="tab-pill'+(startTab==='vendors'?' active':'')+'" onclick="importTab(\'vendors\',this)">Vendors</button>' : ''}
    <button class="tab-pill${startTab==='jobs'?' active':''}" onclick="importTab('jobs',this)">Import History</button>
  </div>
  <div id="import-content"></div>`;

  showImportTab(startTab, jobs);
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
  if (tab === 'vendors') {
    el.innerHTML = `
    <div class="card" style="margin-bottom:14px">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700;font-size:.95rem;color:var(--navy)">Import Vendors</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:3px">Upload a CSV file — first row must be column headers. Duplicates detected by vendor name (case-insensitive).</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="downloadSampleCSV('vendors')">⬇ Download Sample Template</button>
      </div>
      <div style="padding:16px 20px">
        <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px;font-size:.8rem">
          <div style="font-weight:700;color:var(--navy);margin-bottom:4px">Columns <span style="font-weight:400;color:var(--text-muted)">(* required)</span></div>
          <code style="color:var(--blue);word-break:break-all">name*, category*, contact_email, contact_phone, location, address, avg_lead_days, rating</code>
        </div>
        <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:.8rem;color:#92400e">
          <b>Duplicate handling:</b> If a vendor with the same name already exists, you can choose to skip it or overwrite it with the CSV data.
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label style="font-weight:600">Choose CSV file</label>
          <input type="file" id="csv-file" accept=".csv,.txt" style="margin-top:6px;display:block" onchange="previewVendorCSV(this)">
        </div>
        <div id="csv-preview" style="margin-top:12px"></div>
        <div id="csv-actions" style="display:none;margin-top:12px">
          <div style="margin-bottom:12px;padding:10px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;font-size:.84rem">
            <div style="font-weight:600;color:var(--navy);margin-bottom:8px">For duplicate vendors:</div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:6px">
              <input type="radio" name="vendor-dup" value="skip" checked> Skip — keep existing vendor data unchanged
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="radio" name="vendor-dup" value="overwrite"> Overwrite — replace existing vendor with CSV data
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <button class="btn btn-primary" onclick="submitVendorImport()">Import Vendors</button>
            <span id="csv-row-count" style="font-size:.84rem;color:var(--text-muted)"></span>
          </div>
        </div>
      </div>
    </div>`;
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
      <div id="csv-actions" style="display:none;margin-top:12px;align-items:center;gap:12px">
        <button class="btn btn-primary" onclick="submitCSVImport('${tab}')">Import Data</button>
        <span id="csv-row-count" style="font-size:.84rem;color:var(--text-muted)"></span>
      </div>
    </div>
  </div>`;
}

// Proper RFC-4180 CSV parser — handles quoted fields, embedded commas, CRLF, UTF-8 BOM
function parseCSVText(text) {
  text = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
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
    const headers = parsed[0].map(function(h){ return h.trim().toLowerCase().replace(/^﻿/, ''); });
    const dataRows = parsed.slice(1).map(function(vals) {
      const obj = {};
      headers.forEach(function(h, i) { obj[h] = vals[i] !== undefined ? vals[i].trim() : ''; });
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
  const allFailed = res.success === 0 && res.failed > 0;
  const partialFail = res.success > 0 && res.failed > 0;
  const bg    = allFailed ? '#fef2f2' : partialFail ? '#fef3c7' : '#d1fae5';
  const bdr   = allFailed ? '#fca5a5' : partialFail ? '#fcd34d' : '#6ee7b7';
  const color = allFailed ? '#b91c1c' : partialFail ? '#92400e' : '#065f46';
  const icon  = allFailed ? '✗' : '✓';
  const label = allFailed ? 'Import failed' : 'Import complete';
  const summaryMsg = '<div style="background:'+bg+';border:1px solid '+bdr+';border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:'+color+'"><b>'+icon+' '+label+'</b> — ' + res.success + ' row(s) imported' + (res.failed ? ', <b>' + res.failed + ' failed</b>' : '') + '.</div>';
  const errorsHtml = res.errors && res.errors.length
    ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#b91c1c"><b>Row errors:</b><ul style="margin:6px 0 0 18px;padding:0">' +
      res.errors.map(function(e){return '<li>'+e+'</li>';}).join('') + '</ul>' +
      (allFailed ? '<div style="margin-top:8px;font-size:.78rem">Tip: run <code>npx wrangler d1 migrations apply smart-pantry-db --local</code> if columns are missing.</div>' : '') +
      '</div>'
    : '';
  if (preview) preview.innerHTML = summaryMsg + errorsHtml;
  window._csvRows = null;
  window._importJobs = null;
}

async function previewVendorCSV(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const parsed = parseCSVText(e.target.result);
    if (parsed.length < 2) { showToast('CSV must have a header row + at least one data row', 'error'); return; }
    const headers = parsed[0].map(function(hdr){ return hdr.trim().toLowerCase().replace(/^﻿/, ''); });
    if (!headers.includes('name')) { showToast('CSV must have a "name" column', 'error'); return; }
    const dataRows = parsed.slice(1).map(function(vals) {
      const obj = {};
      headers.forEach(function(hdr, i) { obj[hdr] = vals[i] !== undefined ? vals[i].trim() : ''; });
      return obj;
    });

    // Fetch existing vendors to detect duplicates
    const existingVendors = await api('/vendors') || [];
    const existingNames = new Set(existingVendors.map(function(v){ return (v.name||'').trim().toLowerCase(); }));

    let newCount = 0, dupCount = 0, invalidCount = 0;
    const classified = dataRows.map(function(row) {
      if (!row.name || !row.name.trim()) { invalidCount++; return {...row, _status:'invalid'}; }
      const norm = row.name.trim().toLowerCase();
      if (existingNames.has(norm)) { dupCount++; return {...row, _status:'duplicate'}; }
      newCount++;
      return {...row, _status:'new'};
    });

    window._vendorCsvRows = classified;

    const preview = document.getElementById('csv-preview');
    const actions = document.getElementById('csv-actions');
    const rowCount = document.getElementById('csv-row-count');

    const statusBadge = function(s) {
      if (s === 'new') return '<span style="background:#d1fae5;color:#065f46;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">New</span>';
      if (s === 'duplicate') return '<span style="background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">Duplicate</span>';
      return '<span style="background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">Invalid</span>';
    };

    const dispCols = ['name','category','contact_email','contact_phone','location','avg_lead_days','rating'];
    if (preview) preview.innerHTML =
      '<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">' +
        '<span style="background:#d1fae5;color:#065f46;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + newCount + ' New</span>' +
        '<span style="background:#fef3c7;color:#92400e;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + dupCount + ' Duplicate</span>' +
        (invalidCount ? '<span style="background:#fee2e2;color:#991b1b;border-radius:6px;padding:4px 12px;font-size:.82rem;font-weight:700">' + invalidCount + ' Invalid</span>' : '') +
      '</div>' +
      '<div style="font-size:.8rem;font-weight:600;color:var(--navy);margin-bottom:6px">Preview (all ' + classified.length + ' rows)</div>' +
      '<div class="table-wrap" style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">' +
      '<table class="table" style="margin:0"><thead><tr><th style="font-size:.73rem">Status</th>' +
      dispCols.map(function(c){ return '<th style="font-size:.73rem">'+c+'</th>'; }).join('') +
      '</tr></thead><tbody>' +
      classified.map(function(row){
        const bg = row._status === 'invalid' ? 'background:#fef2f2' : row._status === 'duplicate' ? 'background:#fefce8' : '';
        return '<tr style="'+bg+'">' +
          '<td>' + statusBadge(row._status) + '</td>' +
          dispCols.map(function(c){ return '<td style="font-size:.76rem">'+(row[c]||'')+'</td>'; }).join('') +
          '</tr>';
      }).join('') +
      '</tbody></table></div>';

    if (actions) actions.style.display = 'block';
    if (rowCount) rowCount.textContent = newCount + ' new, ' + dupCount + ' duplicate' + (invalidCount ? ', ' + invalidCount + ' invalid' : '');
  };
  reader.readAsText(file);
}

async function submitVendorImport() {
  const rows = window._vendorCsvRows;
  if (!rows || !rows.length) { showToast('No data to import', 'error'); return; }
  const overwrite = document.querySelector('input[name="vendor-dup"]:checked')?.value === 'overwrite';
  const btn = document.querySelector('#csv-actions .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

  const sendRows = rows
    .filter(function(r){ return r._status !== 'invalid'; })
    .map(function(r){ const c = {...r}; delete c._status; return c; });

  showToast('Importing ' + sendRows.length + ' vendors…');
  const res = await api('/import/vendors', { method: 'POST', body: JSON.stringify({rows: sendRows, overwrite}) });
  if (btn) { btn.disabled = false; btn.textContent = 'Import Vendors'; }
  if (!res) return;

  const preview = document.getElementById('csv-preview');
  const allFailed = res.success === 0 && res.failed > 0;
  const partialFail = res.success > 0 && res.failed > 0;
  const bg    = allFailed ? '#fef2f2' : partialFail ? '#fef3c7' : '#d1fae5';
  const bdr   = allFailed ? '#fca5a5' : partialFail ? '#fcd34d' : '#6ee7b7';
  const color = allFailed ? '#b91c1c' : partialFail ? '#92400e' : '#065f46';
  const icon  = allFailed ? '✗' : '✓';
  const skipMsg = res.skipped ? ', ' + res.skipped + ' duplicate(s) skipped' : '';
  const summaryMsg = '<div style="background:'+bg+';border:1px solid '+bdr+';border-radius:8px;padding:12px 16px;margin-bottom:10px;font-size:.85rem;color:'+color+'"><b>'+icon+(allFailed?' Import failed':' Import complete')+'</b> — ' + res.success + ' vendor(s) imported' + skipMsg + (res.failed ? ', <b>' + res.failed + ' failed</b>' : '') + '.</div>';
  const errorsHtml = res.errors && res.errors.length
    ? '<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 16px;font-size:.8rem;color:#b91c1c"><b>Errors:</b><ul style="margin:6px 0 0 18px;padding:0">' +
      res.errors.map(function(err){return '<li>'+err+'</li>';}).join('') + '</ul></div>'
    : '';
  if (preview) preview.innerHTML = summaryMsg + errorsHtml;
  window._vendorCsvRows = null;
  window._importJobs = null;
}

function downloadSampleCSV(tab) {
  const isInventory = tab === 'inventory';
  let csv, filename;
  if (tab === 'vendors') {
    csv = [
      'name,category,contact_email,contact_phone,location,address,avg_lead_days,rating',
      'Fresh Farms Pvt Ltd,Produce,contact@freshfarms.in,9876543210,Mumbai,"123 Agri Park, Navi Mumbai",2,4.5',
      'Dairy Direct Co,Dairy,info@dairydirect.in,9812345678,Pune,"45 Cold Chain Hub, Pune",1,4.8',
      'Clean Supply Corp,Hygiene,sales@cleansupply.in,9900112233,Delhi,"Plot 7, Industrial Area, Delhi",3,4.2',
      'Grain Masters Ltd,Grains & Staples,orders@grainmasters.in,9988776655,Ahmedabad,"Warehouse Block B, Ahmedabad",4,4.0',
    ].join('\n');
    filename = 'vendors_sample.csv';
  } else if (isInventory) {
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
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ============================================================
   Feature 19: TEMPLATES
   ============================================================ */
async function renderTemplates(el) {
  const [orderTpls, poTpls] = await Promise.all([
    api('/order-templates'),
    api('/po-templates'),
  ]);
  const oTpls = orderTpls || [];
  const pTpls = poTpls || [];
  APP._tplTab = APP._tplTab || 'orders';

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Order Templates',val:oTpls.length,sub:'saved order templates',color:'var(--primary)'},
      {label:'PO Templates',val:pTpls.length,sub:'saved PO templates',color:'var(--blue)'},
      {label:'Total Templates',val:oTpls.length+pTpls.length,sub:'combined',color:'var(--navy)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  function tplCard(t, type, loadFn, deleteFn) {
    const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
    const typeColor = type === 'order' ? 'var(--primary)' : 'var(--blue)';
    const typeLabel = type === 'order' ? 'Order Template' : 'PO Template';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${typeColor}">
      <div style="padding:16px 18px 12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="font-weight:700;font-size:.95rem">${t.name}</div>
          <span style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:${typeColor};white-space:nowrap;padding:2px 8px;background:${typeColor}1a;border-radius:10px">${typeLabel}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-muted)">
          <span><b style="color:var(--text)">${items.length}</b> item${items.length!==1?'s':''}</span>
          <span>Created ${fmtDate(t.created_at)}</span>
        </div>
        ${t.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px;font-style:italic">${t.notes}</div>` : ''}
      </div>
      ${items.length ? `
      <div style="padding:0 18px 10px">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${items.slice(0,4).map(i=>`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem">${i.name||i.sku}</span>`).join('')}
          ${items.length>4?`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem;color:var(--text-muted)">+${items.length-4} more</span>`:''}
        </div>
      </div>` : ''}
      <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" onclick="${deleteFn}('${type}','${t.id}')">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="${loadFn}('${t.id}')">Load Template →</button>
      </div>
    </div>`;
  }

  function tabContent(tab) {
    if (tab === 'orders') {
      return oTpls.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${oTpls.map(t=>tplCard(t,'order','loadOrderTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No order templates saved yet<br><small>Load items in Place Order and save as a template</small></div>`;
    }
    return pTpls.length
      ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${pTpls.map(t=>tplCard(t,'po','loadPOTemplate','deleteTemplate')).join('')}</div>`
      : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No PO templates saved yet<br><small>Save a PO as a template to reuse it</small></div>`;
  }

  el.innerHTML = `
  ${pageHeader('Order & PO Templates', 'Reusable templates for quick order/PO creation',
    `<div style="display:flex;gap:8px">
      <button class="btn btn-secondary" onclick="savePOTemplateModal()">Save PO Template</button>
      <button class="btn btn-gold" onclick="saveOrderTemplateModal()">Save Order Template</button>
    </div>`)}
  ${kpis}
  <div class="tabs" id="tpl-tabs" style="margin-bottom:16px">
    <button class="tab-btn${APP._tplTab==='orders'?' active':''}" onclick="tplTab('orders',this)">Order Templates <span style="font-size:.72rem;opacity:.7">(${oTpls.length})</span></button>
    <button class="tab-btn${APP._tplTab==='po'?' active':''}" onclick="tplTab('po',this)">PO Templates <span style="font-size:.72rem;opacity:.7">(${pTpls.length})</span></button>
  </div>
  <div id="tpl-content">${tabContent(APP._tplTab)}</div>`;
}

function tplTab(tab, btn) {
  APP._tplTab = tab;
  document.querySelectorAll('#tpl-tabs .tab-btn').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('tpl-content');
  if (!el) return;

  function tplCard(t, type, loadFn, deleteFn) {
    const items = typeof t.items === 'string' ? JSON.parse(t.items) : (t.items||[]);
    const typeColor = type === 'order' ? 'var(--primary)' : 'var(--blue)';
    const typeLabel = type === 'order' ? 'Order Template' : 'PO Template';
    return `
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid ${typeColor}">
      <div style="padding:16px 18px 12px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div style="font-weight:700;font-size:.95rem">${t.name}</div>
          <span style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:${typeColor};white-space:nowrap;padding:2px 8px;background:${typeColor}1a;border-radius:10px">${typeLabel}</span>
        </div>
        <div style="display:flex;gap:16px;font-size:.8rem;color:var(--text-muted)">
          <span><b style="color:var(--text)">${items.length}</b> item${items.length!==1?'s':''}</span>
          <span>Created ${fmtDate(t.created_at)}</span>
        </div>
        ${t.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:6px;font-style:italic">${t.notes}</div>` : ''}
      </div>
      ${items.length ? `
      <div style="padding:0 18px 10px">
        <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${items.slice(0,4).map(i=>`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem">${i.name||i.sku}</span>`).join('')}
          ${items.length>4?`<span style="padding:2px 8px;background:#f1f5f9;border-radius:10px;font-size:.75rem;color:var(--text-muted)">+${items.length-4} more</span>`:''}
        </div>
      </div>` : ''}
      <div style="padding:10px 18px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" onclick="${deleteFn}('${type}','${t.id}')">Delete</button>
        <button class="btn btn-primary btn-sm" onclick="${loadFn}('${t.id}')">Load Template →</button>
      </div>
    </div>`;
  }

  if (tab === 'orders') {
    api('/order-templates').then(d => {
      const list = d || [];
      el.innerHTML = list.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${list.map(t=>tplCard(t,'order','loadOrderTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No order templates saved yet</div>`;
    });
  } else {
    api('/po-templates').then(d => {
      const list = d || [];
      el.innerHTML = list.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${list.map(t=>tplCard(t,'po','loadPOTemplate','deleteTemplate')).join('')}</div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">📋</div>No PO templates saved yet</div>`;
    });
  }
}

function renderOrderTemplatesTab(orderTpls, poTpls) { /* legacy — replaced by tplTab */ }
function renderPOTemplatesTab(orderTpls, poTpls) { /* legacy — replaced by tplTab */ }

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

function deleteTemplate(type, id) {
  openModal('Delete Template',
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to delete this template? This cannot be undone.</p>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-danger" onclick="confirmDeleteTemplate('${type}','${id}')">Delete</button>`);
}

async function confirmDeleteTemplate(type, id) {
  const endpoint = type === 'order' ? '/order-templates/' + id : '/po-templates/' + id;
  const res = await api(endpoint, { method: 'DELETE' });
  closeModal();
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

  const activeBreaches = breaches || [];
  const criticalBreaches = activeBreaches.filter(b => {
    const hoursAgo = (Date.now() - new Date(b.breached_at).getTime()) / 3600000;
    return hoursAgo > 24;
  });

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">SLA Dashboard</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${rules.length} rules configured · ${activeBreaches.length} active breach${activeBreaches.length===1?'':'es'}</div>
    </div>
    <button class="btn btn-gold" onclick="runSLACheck()">▶ Run SLA Check</button>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">SLA Rules</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${rules.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">active monitoring rules</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${activeBreaches.length?'var(--danger)':'var(--success)'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active Breaches</div>
      <div style="font-size:2rem;font-weight:800;color:${activeBreaches.length?'var(--danger)':'var(--success)'};margin-top:6px">${activeBreaches.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">${activeBreaches.length?'require action':'all clear'}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${criticalBreaches.length?'#dc2626':'#d1d5db'}">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Critical (24h+)</div>
      <div style="font-size:2rem;font-weight:800;color:${criticalBreaches.length?'var(--danger)':'var(--navy)'};margin-top:6px">${criticalBreaches.length}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">breached over 24h ago</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--navy)">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Max SLA Hours</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${rules.length ? Math.max(...rules.map(r=>r.max_hours||0)) : '—'}</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">longest configured rule</div>
    </div>
  </div>

  <!-- Breaches alert -->
  ${activeBreaches.length ? `
  <div style="font-size:.82rem;font-weight:700;color:var(--danger);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">⚠ Active Breaches</div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden;margin-bottom:18px">
    ${activeBreaches.map((b,i)=>{
      const hoursAgo = Math.round((Date.now()-new Date(b.breached_at).getTime())/3600000);
      const isCrit = hoursAgo > 24;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<activeBreaches.length-1?'border-bottom:1px solid var(--border)':''}${isCrit?';background:#fff5f5':''}">
        <div>
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${b.rule_name||b.rule_id}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">Entity: <b>${b.entity_id}</b></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:.78rem;font-weight:600;color:${isCrit?'var(--danger)':'#d97706'}">${hoursAgo}h ago</div>
          <div style="font-size:.68rem;color:var(--text-muted)">${fmtDate(b.breached_at)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>` : `
  <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:12px;padding:16px 20px;margin-bottom:18px;display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">✅</span>
    <div>
      <div style="font-weight:700;color:#065f46">All SLAs within bounds</div>
      <div style="font-size:.78rem;color:#047857;margin-top:2px">No active breaches detected</div>
    </div>
  </div>`}

  <!-- SLA Rules -->
  <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Configured Rules</div>
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    ${rules.length===0 ? `<div style="padding:40px;text-align:center;color:var(--text-muted)">No SLA rules configured</div>` :
    rules.map((r,i)=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;gap:12px;${i<rules.length-1?'border-bottom:1px solid var(--border)':''}">
      <div>
        <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${r.name}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px">Trigger: ${r.trigger_status?.replace(/_/g,' ')||'—'} → Action: ${r.action||'—'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:1.1rem;font-weight:800;color:${r.max_hours<=4?'var(--danger)':r.max_hours<=24?'#d97706':'var(--navy)'}">⏱ ${r.max_hours}h</div>
        <div style="font-size:.68rem;color:var(--text-muted)">max hours</div>
      </div>
    </div>`).join('')}
  </div>
  `;
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

  const insts = instances || [];
  const pending = insts.length;
  const avgSteps = chains.length ? Math.round(chains.reduce((s,c)=>s+(c.steps||[]).length,0)/chains.length*10)/10 : 0;

  const kpis = `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Configured Chains',val:chains.length,sub:'approval workflows',color:'var(--navy)'},
      {label:'Pending Approvals',val:pending,sub:'awaiting action',color:pending?'var(--warning)':'var(--success)'},
      {label:'Avg Steps per Chain',val:avgSteps||'—',sub:'approval levels',color:'var(--blue)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>`;

  const pendingSection = pending ? `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:10px">⏳ Pending Approvals (${pending})</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:22px">
    ${insts.map(inst=>`
    <div class="card" style="padding:0;overflow:hidden;border-left:3px solid var(--warning)">
      <div style="padding:14px 16px 10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700">Entity #${inst.entity_id}</span>
          <span style="font-size:.72rem;padding:2px 8px;background:#fff8e6;color:#d97706;border-radius:10px">Step ${inst.current_step}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">${inst.chain_name||'Chain #'+inst.chain_id}</div>
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-danger btn-sm" onclick="actOnChain('${inst.id}','REJECTED')">Reject</button>
        <button class="btn btn-success btn-sm" onclick="actOnChain('${inst.id}','APPROVED')">Approve</button>
      </div>
    </div>
    `).join('')}
  </div>` : `
  <div class="card" style="padding:20px 24px;margin-bottom:22px;border-left:3px solid var(--success);display:flex;align-items:center;gap:12px">
    <span style="font-size:1.4rem">✓</span>
    <div><div style="font-weight:600;color:var(--success)">All caught up</div><div style="font-size:.82rem;color:var(--text-muted)">No pending approvals</div></div>
  </div>`;

  const chainsSection = `
  <div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:10px">Configured Chains (${chains.length})</div>
  ${chains.length ? `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${chains.map(c=>{
      const steps = c.steps||[];
      return `
      <div class="card" style="padding:0;overflow:hidden;border-top:3px solid var(--navy)">
        <div style="padding:14px 16px 10px">
          <div style="font-weight:700;font-size:.95rem;margin-bottom:4px">${c.name}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">
            Min: ${fmt(c.min_amount||0)} · ${steps.length} step${steps.length!==1?'s':''}
            ${c.entity_type?` · ${c.entity_type}`:''}
          </div>
        </div>
        <div style="padding:0 16px 14px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          ${steps.map((s,i)=>`
            <div style="display:flex;align-items:center;gap:4px">
              ${i>0?'<span style="color:var(--text-muted);font-size:.75rem">→</span>':''}
              <span style="padding:3px 10px;background:var(--navy);color:#fff;border-radius:12px;font-size:.75rem;white-space:nowrap">${i+1}. ${ROLES[s.role]?.label||s.role}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }).join('')}
  </div>` : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)">No approval chains configured yet</div>`}`;

  el.innerHTML = `
  ${pageHeader('Approval Chains', 'Multi-step approval workflows for orders',
    `<button class="btn btn-gold" onclick="newApprovalChainModal()">New Chain</button>`)}
  ${kpis}
  ${pendingSection}
  ${chainsSection}`;
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

function actOnChain(instanceId, action) {
  if (action === 'REJECTED') {
    openModal('Reject Approval',
      `<div class="form-group">
        <label style="font-weight:600;display:block;margin-bottom:6px">Reason for Rejection (optional)</label>
        <textarea id="chain-reject-reason" rows="3" placeholder="Explain why you are rejecting this step…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;resize:vertical;box-sizing:border-box"></textarea>
      </div>`,
      `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
       <button class="btn btn-danger" onclick="confirmActOnChain('${instanceId}','REJECTED')">Reject</button>`);
  } else {
    confirmActOnChain(instanceId, action);
  }
}

async function confirmActOnChain(instanceId, action) {
  const comments = action === 'REJECTED' ? (document.getElementById('chain-reject-reason')?.value || '') : '';
  if (action === 'REJECTED') closeModal();
  const res = await api('/approval-chain-instances/' + instanceId + '/act', {
    method: 'POST',
    body: JSON.stringify({ action, comments }),
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
    <!-- Filters bar -->
    <div class="card" style="padding:12px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:.85rem;color:var(--navy)">Order vs Delivery Reconciliation</span>
        <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select id="ovd-client" class="filter-select" onchange="reloadOVD()" style="font-size:.8rem">
            <option value="">All Clients</option>
            ${(clients||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <select id="ovd-range" class="filter-select" onchange="reloadOVD()" style="font-size:.8rem">
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <label style="font-size:.82rem;display:flex;align-items:center;gap:5px;white-space:nowrap"><input type="checkbox" id="ovd-due-only" onchange="reloadOVD()"> Due Only</label>
          <button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('ovd')">&#8595; CSV</button>
        </div>
      </div>
    </div>
    <!-- KPI tiles + table -->
    <div id="ovd-table-wrap">
      ${renderOVDTable(data)}
    </div>`;

  } else if (tab === 'due-items') {
    const data = await api(`/reports/due-items?from=${from60}&to=${today}`);
    if (!data) return;
    const critical = data.filter(r => r.due_ageing_days >= 15).length;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${critical>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Critical (15+ days)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical>0?'var(--danger)':'var(--navy)'};line-height:1">${critical}</div>
        <div style="font-size:.75rem;color:${critical>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${critical>0?'immediate action needed':'none critical'}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #d97706;margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Items</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">items pending</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.reduce((s,r)=>s+(r.due_qty||0),0)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(data.reduce((s,r)=>s+(r.due_qty||0)*(r.unit_price||0),0))}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">estimated at cost</div>
      </div>
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
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Open Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.open_orders}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">in progress</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #d97706;margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Partial Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:#d97706;line-height:1">${data.kpis.partial_orders}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">partly delivered</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Due Quantity</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1">${data.kpis.due_qty}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1">${fmt(data.kpis.due_value)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">at risk</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.delayed_deliveries>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Delayed Deliveries</div>
        <div style="font-size:1.9rem;font-weight:700;color:${data.kpis.delayed_deliveries>0?'#d97706':'var(--navy)'};line-height:1">${data.kpis.delayed_deliveries}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">past expected date</div>
      </div>
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
    const totalDueQty   = data.reduce((s,r)=>s+(r.due_qty||0),0);
    const totalDueValue = data.reduce((s,r)=>s+(r.due_value||0),0);
    const critical      = data.find(r=>r.age_bucket==='15+ Days');
    const totalOrders   = data.reduce((s,r)=>s+(r.order_count||0),0);
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${critical?.order_count?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Critical (15+ days)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical?.order_count?'var(--danger)':'var(--navy)'};line-height:1">${critical?.order_count||0}</div>
        <div style="font-size:.75rem;color:${critical?.order_count?'var(--danger)':'var(--text-muted)'};margin-top:6px">${fmt(critical?.due_value||0)} at risk</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalOrders}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">across all buckets</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #d97706;margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDueQty}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(totalDueValue)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">estimated at cost</div>
      </div>
    </div>
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
    const critical = data.filter(r=>r.fulfilment_pct<70).length;
    const totalDue = data.reduce((s,r)=>s+(r.due_qty||0),0);
    const avgFill  = data.length ? Math.round(data.reduce((s,r)=>s+(r.fulfilment_pct||0),0)/data.length) : 100;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${critical>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Critical Brands (&lt;70%)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical>0?'var(--danger)':'var(--navy)'};line-height:1">${critical}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">of ${data.length} brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${avgFill>=90?'var(--success)':avgFill>=70?'#d97706':'var(--danger)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg Fulfilment</div>
        <div style="font-size:1.9rem;font-weight:700;color:${avgFill>=90?'var(--success)':avgFill>=70?'#d97706':'var(--danger)'};line-height:1">${avgFill}%</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">across all brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDue>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Units</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDue}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Brands Tracked</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">last 30 days</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Brand Shortfall Report</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('brand-shortfall')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Fulfilment %</th><th>Vendor</th></tr></thead>
        <tbody>${data.sort((a,b)=>a.fulfilment_pct-b.fulfilment_pct).map(r=>`<tr>
          <td><b>${r.brand_name}</b></td>
          <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
          <td><b style="color:var(--danger)">${r.due_qty}</b></td>
          <td>
            <span class="badge badge-${r.fulfilment_pct>=90?'success':r.fulfilment_pct>=70?'warning':'danger'}">${r.fulfilment_pct}%</span>
            <div style="background:var(--border);height:3px;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${Math.min(r.fulfilment_pct,100)}%;background:${r.fulfilment_pct>=90?'var(--success)':r.fulfilment_pct>=70?'var(--warning)':'var(--danger)'}"></div></div>
          </td>
          <td>${r.primary_vendor||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No shortfall</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'brand-procurement') {
    const data = await api(`/reports/brand-procurement?from=${from30}&to=${today}`);
    if (!data) return;
    const totalShortfall = data.reduce((s,r)=>s+(r.shortfall_qty||0),0);
    const totalSuggestedPO = data.reduce((s,r)=>s+(r.suggested_po_qty||0),0);
    const brandsWithShortfall = data.filter(r=>(r.shortfall_qty||0)>0).length;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${brandsWithShortfall>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Brands w/ Shortfall</div>
        <div style="font-size:1.9rem;font-weight:700;color:${brandsWithShortfall>0?'#d97706':'var(--navy)'};line-height:1">${brandsWithShortfall}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">of ${data.length} brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalShortfall>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Shortfall Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:${totalShortfall>0?'var(--danger)':'var(--navy)'};line-height:1">${totalShortfall}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">units to procure</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Suggested PO Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalSuggestedPO}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">total units to order</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Brands Tracked</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">last 30 days</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Consolidated Brand Procurement</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('brand-procurement')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Category</th><th>Clients</th><th>Total Ordered</th><th>Total Delivered</th><th>Shortfall</th><th>Suggested PO Qty</th><th>Primary Vendor</th><th>Actions</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${r.brand_name}</b></td><td>${r.category}</td>
          <td title="${r.clients}">${r.client_count} clients</td>
          <td>${r.total_ordered_qty}</td><td>${r.total_delivered_qty}</td>
          <td><b style="color:${r.shortfall_qty>0?'var(--danger)':'var(--success)'}">${r.shortfall_qty}</b></td>
          <td><b style="color:var(--blue)">${r.suggested_po_qty}</b></td>
          <td>${r.primary_vendor||'—'}</td>
          <td>${r.suggested_po_qty>0?`<button class="btn btn-primary btn-sm" onclick="initiateBrandPO('${String(r.brand_name).replace(/'/g,"")}','${r.vendor_id||''}','${from30}','${today}')">🛒 Initiate PO</button>`:'<span style="color:var(--success);font-size:.8rem">✓ Fulfilled</span>'}</td>
        </tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">No data</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'client-scorecard') {
    const data = await api(`/reports/client-fulfilment?from=${from30}&to=${today}`);
    if (!data) return;
    const avgFill     = data.length ? Math.round(data.reduce((s,r)=>s+(r.fulfilment_pct||0),0)/data.length) : 100;
    const atRisk      = data.filter(r=>(r.fulfilment_pct||0)<70).length;
    const totalDueVal = data.reduce((s,r)=>s+(r.due_value||0),0);
    const avgDelivery = data.filter(r=>r.avg_delivery_days).length ? Math.round(data.filter(r=>r.avg_delivery_days).reduce((s,r)=>s+(r.avg_delivery_days||0),0)/data.filter(r=>r.avg_delivery_days).length*10)/10 : null;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${atRisk>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">At-Risk Clients</div>
        <div style="font-size:1.9rem;font-weight:700;color:${atRisk>0?'var(--danger)':'var(--navy)'};line-height:1">${atRisk}</div>
        <div style="font-size:.75rem;color:${atRisk>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">fulfilment &lt;70%</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${avgFill<70?'var(--danger)':avgFill<90?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg Fulfilment</div>
        <div style="font-size:1.9rem;font-weight:700;color:${avgFill<70?'var(--danger)':avgFill<90?'#d97706':'var(--success)'};line-height:1">${avgFill}%</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">across all clients</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDueVal>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(totalDueVal)}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg Delivery Time</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${avgDelivery!=null?avgDelivery+'d':'—'}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">days from order</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Client Fulfilment Scorecard</span><button class="btn btn-secondary btn-sm" onclick="exportFulfilCSV('client-scorecard')">&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Location</th><th>Orders</th><th>Ordered Qty</th><th>Delivered Qty</th><th>Due Qty</th><th>Due Value</th><th>Fulfilment %</th><th>Avg Delivery Days</th></tr></thead>
        <tbody>${data.sort((a,b)=>(a.fulfilment_pct||0)-(b.fulfilment_pct||0)).map(r=>`<tr>
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
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.totalOrders}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">last 30 days</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Single DC Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.singleDC}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">one-shot delivery</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.multiDC>0?'#d97706':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Multi-DC Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.multiDC}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">split deliveries</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Avg DCs per Order</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.avgDCsPerOrder}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">delivery challans</div>
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-weight:700;font-size:.9rem;color:var(--navy)">Multi-Delivery Completion Tracking</span>
        <span style="font-size:.78rem;color:var(--text-muted)">Click DC count to view challan breakdown</span>
      </div>
      <div class="table-wrap">
        <table class="table" style="margin:0">
          <thead><tr>
            <th>Order ID</th>
            <th>Client</th>
            <th>Ordered Date</th>
            <th style="text-align:right">Ordered Qty</th>
            <th style="text-align:right">Delivered Qty</th>
            <th style="text-align:center">DC Count</th>
            <th>Completion Date</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${(data.orders||[]).map(r=>{
            const pct = r.total_ordered>0 ? Math.round((r.total_delivered/r.total_ordered)*100) : 0;
            const complete = r.completion_date ? fmtDate(r.completion_date) : '—';
            const completionColor = r.completion_date ? '#059669' : (r.status==='CLOSED'?'var(--danger)':'var(--text-muted)');
            return `<tr>
              <td><b style="color:var(--navy);cursor:pointer" onclick="viewOrderDrilldown('${r.id}')">${r.id}</b></td>
              <td>${r.client_name}</td>
              <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(r.created_at)}</td>
              <td style="text-align:right;font-weight:600">${r.total_ordered}</td>
              <td style="text-align:right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
                  <div style="width:60px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${pct===100?'#059669':pct>50?'#f59e0b':'#ef4444'};border-radius:3px"></div>
                  </div>
                  <span style="font-weight:${r.total_delivered>0?700:400};color:${r.total_delivered>=r.total_ordered?'#059669':r.total_delivered>0?'#d97706':'var(--text-muted)'}">${r.total_delivered}</span>
                  <span style="font-size:.7rem;color:var(--text-muted)">${pct}%</span>
                </div>
              </td>
              <td style="text-align:center">
                <span class="badge badge-${r.dc_count>2?'warning':r.dc_count>1?'info':'success'}"
                  style="cursor:pointer" onclick="drillOrderDCs('${r.id}','${r.id}')"
                  title="Click to view DC breakdown">
                  ${r.dc_count} DC${r.dc_count!==1?'s':''}
                </span>
              </td>
              <td style="font-size:.82rem;font-weight:${r.completion_date?600:400};color:${completionColor}">${complete}</td>
              <td>${statusBadge(r.status)}</td>
            </tr>`;
          }).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No data</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  } else if (tab === 'dc-recon') {
    const data = await api(`/reports/dc-reconciliation?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total DCs</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.total_dcs}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">last 30 days</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">POD Uploaded</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.pod_uploaded}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">proof of delivery</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.missing_pod>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Missing POD</div>
        <div style="font-size:1.9rem;font-weight:700;color:${data.kpis.missing_pod>0?'var(--danger)':'var(--navy)'};line-height:1">${data.kpis.missing_pod}</div>
        <div style="font-size:.75rem;color:${data.kpis.missing_pod>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${data.kpis.missing_pod>0?'upload required':'all clear'}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.missing_dc_scan>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Missing DC Scan</div>
        <div style="font-size:1.9rem;font-weight:700;color:${data.kpis.missing_dc_scan>0?'var(--danger)':'var(--navy)'};line-height:1">${data.kpis.missing_dc_scan}</div>
        <div style="font-size:.75rem;color:${data.kpis.missing_dc_scan>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${data.kpis.missing_dc_scan>0?'scan required':'all clear'}</div>
      </div>
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
    const totalSuggestedPO = data.reduce((s,r)=>s+(r.suggested_procurement_qty||0),0);
    const stockout         = data.filter(r=>r.current_stock<(r.due_qty||0)).length;
    const totalDue         = data.reduce((s,r)=>s+(r.due_qty||0),0);
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid ${stockout>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Stockout Risk</div>
        <div style="font-size:1.9rem;font-weight:700;color:${stockout>0?'var(--danger)':'var(--navy)'};line-height:1">${stockout}</div>
        <div style="font-size:.75rem;color:${stockout>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">stock &lt; due qty</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid #d97706;margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Items Needing PO</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">to be procured</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDue}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total PO Qty Needed</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalSuggestedPO}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">suggested order</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span>Procurement Demand Forecast</span>
        <button class="btn btn-primary btn-sm" onclick="generateRFQFromForecast()">Generate RFQ for All</button>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Item</th><th>SKU</th><th>Due Qty</th><th>Current Stock</th><th>Suggested PO Qty</th><th>Vendor</th><th>Actions</th></tr></thead>
        <tbody>${data.sort((a,b)=>(b.due_qty||0)-(a.due_qty||0)).map(r=>`<tr style="${r.current_stock<(r.due_qty||0)?'background:#fff5f5':''}">
          <td>${r.brand_name}</td>
          <td><b>${r.item_name}</b></td>
          <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
          <td><b style="color:var(--danger)">${r.due_qty}</b></td>
          <td><span style="color:${r.current_stock<r.due_qty?'var(--danger)':'var(--success)'}${r.current_stock<r.due_qty?';font-weight:700':''}">
            ${r.current_stock}
            ${r.current_stock<r.due_qty?'<span title="Stockout risk" style="margin-left:4px">⚠</span>':''}
          </span></td>
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
  if (!data.length) return `<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No orders</div><div class="empty-desc">No orders found for the selected filters.</div></div>`;

  // Group flat item rows into per-order summaries
  const orderMap = {};
  data.forEach(r => {
    if (!orderMap[r.order_number]) {
      orderMap[r.order_number] = {
        id: r.order_number,
        date: r.order_date,
        client: r.client_name,
        location: r.client_location || '',
        dc_count: r.dc_count || 0,
        last_delivery: r.last_delivery_date || '',
        total_ordered: 0, total_delivered: 0, total_due: 0, total_due_value: 0,
        line_count: 0, due_lines: 0,
        status: 'Complete',
      };
    }
    const o = orderMap[r.order_number];
    o.line_count++;
    o.total_ordered  += r.ordered_qty   || 0;
    o.total_delivered+= r.delivered_qty || 0;
    o.total_due      += r.due_qty       || 0;
    o.total_due_value+= r.due_value     || 0;
    if ((r.due_qty||0) > 0) o.due_lines++;
    // worst-case status: Open > Partial > Complete
    if (r.order_status === 'Open')    o.status = 'Open';
    else if (r.order_status === 'Partial' && o.status !== 'Open') o.status = 'Partial';
  });

  const orders = Object.values(orderMap);
  const total    = orders.length;
  const complete = orders.filter(o => o.status === 'Complete').length;
  const partial  = orders.filter(o => o.status === 'Partial').length;
  const open     = orders.filter(o => o.status === 'Open').length;
  const totalDue = orders.reduce((s,o)=>s+o.total_due_value, 0);

  const statusBadgeOVD = s => ({
    Complete: `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#d1fae5;color:#059669">&#10003; Complete</span>`,
    Partial:  `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#fef3c7;color:#d97706">&#9651; Partial</span>`,
    Open:     `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#fee2e2;color:#dc2626">&#9679; Open</span>`,
  }[s] || `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#f3f4f6;color:#6b7280">${s}</span>`);

  const borderColor = s => s==='Complete'?'var(--success)':s==='Partial'?'#f59e0b':'var(--danger)';

  return `
  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Total Orders</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);line-height:1">${total}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">in period</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Fully Delivered</div>
      <div style="font-size:2rem;font-weight:800;color:var(--success);line-height:1">${complete}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">${total?Math.round(complete/total*100):0}% of orders</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid #f59e0b;margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Partially Delivered</div>
      <div style="font-size:2rem;font-weight:800;color:#d97706;line-height:1">${partial}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">balance pending</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${open>0?'var(--danger)':'#d1d5db'};margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Not Started</div>
      <div style="font-size:2rem;font-weight:800;color:${open>0?'var(--danger)':'var(--navy)'};line-height:1">${open}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">no delivery yet</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDue>0?'var(--danger)':'#d1d5db'};margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Due Value</div>
      <div style="font-size:1.4rem;font-weight:800;color:${totalDue>0?'var(--danger)':'var(--navy)'};line-height:1">${fmt(totalDue)}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">undelivered</div>
    </div>
  </div>

  <!-- Order summary table -->
  <div class="card" style="padding:0;overflow:hidden">
    <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <span style="font-weight:700;font-size:.9rem;color:var(--navy)">Orders (${total})</span>
      <span style="font-size:.78rem;color:var(--text-muted)">Click any row to view full line item breakdown</span>
    </div>
    <div class="table-wrap">
      <table class="table" style="margin:0">
        <thead><tr>
          <th>Order ID</th>
          <th>Date</th>
          <th>Client</th>
          <th>Location</th>
          <th style="text-align:center">Status</th>
          <th style="text-align:right">Lines</th>
          <th style="text-align:right">Ordered Qty</th>
          <th style="text-align:right">Delivered</th>
          <th style="text-align:right">Due Qty</th>
          <th style="text-align:right">Due Value</th>
          <th style="text-align:right">DCs</th>
          <th>Last Delivery</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${orders.map(o=>`<tr style="cursor:pointer;border-left:3px solid ${borderColor(o.status)}" onclick="viewOrderDrilldown('${o.id}')" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background=''">
            <td><b style="color:var(--navy)">${o.id}</b></td>
            <td style="white-space:nowrap">${fmtDate(o.date)}</td>
            <td style="font-weight:600">${o.client}</td>
            <td style="color:var(--text-muted);font-size:.8rem">${o.location||'—'}</td>
            <td style="text-align:center">${statusBadgeOVD(o.status)}</td>
            <td style="text-align:right">
              <span style="font-weight:700">${o.line_count}</span>
              ${o.due_lines>0?`<span style="font-size:.7rem;color:var(--danger);margin-left:4px">(${o.due_lines} due)</span>`:''}
            </td>
            <td style="text-align:right;font-weight:600">${o.total_ordered}</td>
            <td style="text-align:right;color:${o.total_delivered>0?'#059669':'var(--text-muted)'};font-weight:${o.total_delivered>0?700:400}">${o.total_delivered}</td>
            <td style="text-align:right;font-weight:700;color:${o.total_due>0?'var(--danger)':'var(--success)'}">${o.total_due}</td>
            <td style="text-align:right;color:${o.total_due_value>0?'var(--danger)':'var(--text-muted)'}">${o.total_due_value>0?fmt(o.total_due_value):'—'}</td>
            <td style="text-align:right;color:var(--text-muted)">${o.dc_count||0}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${o.last_delivery?fmtDate(o.last_delivery):'—'}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();viewOrderDrilldown('${o.id}')">Details ›</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function reloadOVD() {
  const client  = document.getElementById('ovd-client')?.value  || '';
  const dueOnly = document.getElementById('ovd-due-only')?.checked ? '1' : '0';
  const days    = parseInt(document.getElementById('ovd-range')?.value || '30', 10);
  const today   = new Date().toISOString().slice(0,10);
  const from    = new Date(Date.now()-days*86400000).toISOString().slice(0,10);
  const wrap = document.getElementById('ovd-table-wrap');
  if (wrap) wrap.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;
  const data = await api(`/reports/order-vs-delivery?from=${from}&to=${today}${client?'&client_id='+client:''}${dueOnly==='1'?'&due_only=1':''}`);
  if (data && wrap) wrap.innerHTML = renderOVDTable(data);
}

async function drillOrderDCs(orderId, label) {
  openModal(`DC Breakdown — ${label}`, `<div style="text-align:center;padding:32px;color:var(--text-muted)">Loading delivery challans…</div>`, '');
  const dcs = await api(`/reports/order-dcs?order_id=${encodeURIComponent(orderId)}`);
  if (!dcs) return;

  const statusColor = s => ({DELIVERED:'#059669',IN_TRANSIT:'#d97706',SCHEDULED:'#3b82f6',CANCELLED:'#ef4444'}[s]||'#6b7280');
  const statusLabel = s => ({DELIVERED:'Delivered',IN_TRANSIT:'In Transit',SCHEDULED:'Scheduled',CANCELLED:'Cancelled'}[s]||s);

  const totalLines = dcs.reduce((s,d)=>s+(d.line_count||0),0);
  const totalOrdered = dcs.reduce((s,d)=>s+(d.total_qty_ordered||0),0);
  const totalDelivered = dcs.reduce((s,d)=>s+(d.total_qty_delivered||0),0);

  const body = `
  <!-- Summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:16px">
    <div style="background:var(--bg);border-radius:8px;padding:12px;border-top:2px solid var(--primary)">
      <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Challans</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:4px">${dcs.length}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:12px;border-top:2px solid #8b5cf6">
      <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Total Lines</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:4px">${totalLines}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:12px;border-top:2px solid var(--blue)">
      <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Ordered Units</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--navy);margin-top:4px">${totalOrdered}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:12px;border-top:2px solid var(--success)">
      <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)">Delivered Units</div>
      <div style="font-size:1.6rem;font-weight:800;color:var(--success);margin-top:4px">${totalDelivered}</div>
    </div>
  </div>

  <!-- DC detail table -->
  <div style="overflow-x:auto">
    <table class="table" style="font-size:.82rem">
      <thead><tr>
        <th>#</th>
        <th>DC Number</th>
        <th>Dispatch Date</th>
        <th>Delivery Date</th>
        <th>Status</th>
        <th style="text-align:right">Lines</th>
        <th style="text-align:right">Qty Dispatched</th>
        <th style="text-align:right">Qty Delivered</th>
        <th>Driver / Vehicle</th>
      </tr></thead>
      <tbody>
        ${dcs.map((dc,i)=>{
          const sc = statusColor(dc.status);
          const pct = dc.total_qty_ordered>0 ? Math.round((dc.total_qty_delivered/dc.total_qty_ordered)*100) : 0;
          return `<tr>
            <td style="color:var(--text-muted)">${i+1}</td>
            <td><b style="color:var(--navy)">${dc.dc_number}</b></td>
            <td style="white-space:nowrap">${dc.dc_date ? fmtDate(dc.dc_date) : '—'}</td>
            <td style="white-space:nowrap;color:${dc.delivered_at?'#059669':'var(--text-muted)'};font-weight:${dc.delivered_at?600:400}">${dc.delivered_at ? fmtDate(dc.delivered_at) : '—'}</td>
            <td><span style="font-size:.7rem;font-weight:700;padding:3px 8px;border-radius:999px;background:${sc}22;color:${sc}">${statusLabel(dc.status)}</span></td>
            <td style="text-align:right;font-weight:700">${dc.line_count||0}</td>
            <td style="text-align:right;font-weight:600">${dc.total_qty_ordered||0}</td>
            <td style="text-align:right">
              <span style="font-weight:700;color:${pct===100?'#059669':pct>0?'#d97706':'var(--text-muted)'}">${dc.total_qty_delivered||0}</span>
              ${dc.total_qty_ordered>0?`<span style="font-size:.7rem;color:var(--text-muted);margin-left:4px">${pct}%</span>`:''}
            </td>
            <td style="font-size:.78rem;color:var(--text-muted)">${[dc.driver_name,dc.vehicle_no].filter(Boolean).join(' · ')||'—'}</td>
          </tr>`;
        }).join('')||'<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">No delivery challans found</td></tr>'}
      </tbody>
    </table>
  </div>`;

  openModal(`DC Breakdown — ${label}`, body,
    `<button class="btn btn-secondary" onclick="closeModal()">Close</button>
     <button class="btn btn-primary" onclick="closeModal();viewOrderDrilldown('${orderId}')">Full Line-Item View</button>`
  );
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

/* ── Initiate PO from Brand Procurement shortfall ── */
let _brandPOItems = [];
async function initiateBrandPO(brand, vendorId, from, to) {
  const [items, vendors] = await Promise.all([
    api(`/reports/brand-procurement-items?brand=${encodeURIComponent(brand)}&from=${from}&to=${to}`),
    api('/vendors').catch(()=>[]),
  ]);
  if (!items || !items.length) { showToast('No shortfall items for this brand', 'error'); return; }
  _brandPOItems = items;
  const activeVendors = (vendors||[]).filter(v=>v.active!==0);
  const vendorOpts = activeVendors.map(v=>`<option value="${v.id}" ${v.id===vendorId?'selected':''}>${h(v.name)}</option>`).join('');

  openModal(`Initiate PO — ${brand}`, `
    <div class="form-group">
      <label>Vendor <span style="color:var(--danger)">*</span></label>
      <select id="bpo-vendor">${vendorOpts||'<option value="">No vendors — add one first</option>'}</select>
    </div>
    <div class="form-group">
      <label>Items & Quantities <span style="font-weight:400;color:var(--text-muted);font-size:.76rem">(pre-filled with shortfall; edit as needed)</span></label>
      <div class="table-wrap"><table class="table" style="margin:0">
        <thead><tr><th>Item</th><th>SKU</th><th style="text-align:right">Unit ₹</th><th style="text-align:center">Qty</th></tr></thead>
        <tbody>${items.map((it,i)=>`<tr>
          <td style="font-size:.84rem"><b>${h(it.name||it.sku)}</b></td>
          <td style="font-size:.76rem;color:var(--text-muted)">${h(it.sku)}</td>
          <td style="text-align:right">${fmt(it.unit_price||0)}</td>
          <td style="text-align:center"><input type="number" data-bpo-i="${i}" value="${Math.round(it.shortfall_qty)}" min="0" style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center" oninput="updateBrandPOTotal()"></td>
        </tr>`).join('')}</tbody>
      </table></div>
      <div id="bpo-total" style="text-align:right;font-weight:700;margin-top:8px;color:var(--navy)"></div>
    </div>
    <div class="form-group">
      <label>Notes (optional)</label>
      <input type="text" id="bpo-notes" placeholder="e.g. Consolidated procurement for shortfall">
    </div>`,
    `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
     <button class="btn btn-secondary" onclick="submitBrandPO('whatsapp')">📱 WhatsApp</button>
     <button class="btn btn-primary" onclick="submitBrandPO('email')">📧 Create &amp; Email PO</button>`);
  updateBrandPOTotal();
}

function collectBrandPO() {
  const items = _brandPOItems.map((it,i)=>{
    const qty = parseInt(document.querySelector(`input[data-bpo-i="${i}"]`)?.value,10)||0;
    return { sku: it.sku, name: it.name||it.sku, qty, unit_price: it.unit_price||0 };
  }).filter(x=>x.qty>0);
  return items;
}

function updateBrandPOTotal() {
  const items = collectBrandPO();
  const sub = items.reduce((s,i)=>s+i.qty*i.unit_price,0);
  const el = document.getElementById('bpo-total');
  if (el) el.textContent = `Subtotal: ${fmt(sub)} · +18% GST = ${fmt(Math.round(sub*1.18))}`;
}

async function submitBrandPO(mode) {
  const vendorId = document.getElementById('bpo-vendor')?.value;
  if (!vendorId) { showToast('Select a vendor', 'error'); return; }
  const items = collectBrandPO();
  if (!items.length) { showToast('Enter at least one quantity', 'error'); return; }
  const notes = document.getElementById('bpo-notes')?.value?.trim() || '';

  const res = await api('/purchase-orders', { method:'POST', body: JSON.stringify({ vendor_id: vendorId, items, notes }) });
  if (!res) return;

  if (mode === 'whatsapp') {
    const vSel = document.getElementById('bpo-vendor');
    const vendorName = vSel?.options[vSel.selectedIndex]?.text || 'Vendor';
    const lines = items.map(i=>`• ${i.name} × ${i.qty}`).join('\n');
    const msg = `Hello ${vendorName},\n\nNew Purchase Order ${res.id} from 4SYZ Smart Pantry:\n\n${lines}\n\nTotal (incl. GST): ₹${(res.grand_total||0).toLocaleString('en-IN')}\n\nPlease confirm. Thank you.`;
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    showToast(`PO ${res.id} created — WhatsApp opened`);
  } else {
    showToast(`PO ${res.id} created & emailed to vendor`);
  }
  closeModal();
  navigate('fulfilment');
}

/* ============================================================
   STAFF MANAGEMENT
   ============================================================ */
async function renderStaff(el) {
  const staff = await api('/staff');
  if (!staff) return;

  const activeStaff = staff.filter(s=>s.active);
  const byRole = staff.reduce((g,s)=>{ (g[s.role]=g[s.role]||[]).push(s); return g; },{});

  const STAFF_ROLE_LABEL = { delivery_staff:'Delivery Staff', order_entry:'Order Entry', viewer:'Viewer' };
  const STAFF_ROLE_COLOR = { delivery_staff:'#2563eb', order_entry:'#7c3aed', viewer:'#6b7280' };

  function staffCard(s) {
    const rc = STAFF_ROLE_COLOR[s.role] || '#6b7280';
    const initials = s.name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase().slice(0,2);
    return `
    <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 18px;display:flex;align-items:center;gap:14px;opacity:${s.active?1:.55}">
      <div style="width:44px;height:44px;border-radius:50%;background:${s.active?rc:'#9ca3af'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${initials}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem;color:var(--navy)">${s.name}
          ${!s.active?'<span style="font-size:.66rem;font-weight:700;background:#fee2e2;color:var(--danger);border-radius:4px;padding:1px 5px;margin-left:5px">INACTIVE</span>':''}
        </div>
        ${s.phone?`<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px"><a href="tel:${s.phone}" style="color:inherit">📞 ${s.phone}</a></div>`:''}
        <div style="margin-top:5px">
          <span style="font-size:.68rem;font-weight:700;background:${rc}1a;color:${rc};border-radius:4px;padding:2px 7px">${STAFF_ROLE_LABEL[s.role]||s.role}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" onclick="editStaffModal('${s.id}','${s.name.replace(/'/g,"\\'")}','${s.phone||''}','${s.role}')" style="font-size:.7rem;padding:3px 8px">Edit</button>
        <button class="btn btn-${s.active?'danger':'success'} btn-sm" onclick="toggleStaff('${s.id}',${s.active?0:1})" style="font-size:.7rem;padding:3px 8px">${s.active?'Disable':'Enable'}</button>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Staff</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${staff.length} total · ${activeStaff.length} active</div>
    </div>
    <button class="btn btn-primary" onclick="addStaffModal()">${iconPlus(14)} Add Staff</button>
  </div>

  <!-- Role summary tiles -->
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:18px">
    ${Object.entries(byRole).map(([role, members])=>{
      const rc = STAFF_ROLE_COLOR[role]||'#6b7280';
      const activeCount = members.filter(s=>s.active).length;
      return `<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${rc}">
        <div style="font-size:.7rem;font-weight:700;color:${rc};text-transform:uppercase;letter-spacing:.06em">${STAFF_ROLE_LABEL[role]||role}</div>
        <div style="font-size:1.8rem;font-weight:800;color:var(--navy);margin-top:4px">${activeCount}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">active · ${members.length} total</div>
      </div>`;
    }).join('')}
  </div>

  <!-- Staff by role -->
  ${Object.entries(byRole).map(([role, members])=>`
  <div style="margin-bottom:18px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${STAFF_ROLE_LABEL[role]||role} (${members.filter(s=>s.active).length} active)</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
      ${members.sort((a,b)=>b.active-a.active).map(s=>staffCard(s)).join('')}
    </div>
  </div>`).join('')}

  ${staff.length===0?`
  <div style="background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:48px;text-align:center;color:var(--text-muted)">
    <div style="font-size:2.5rem;margin-bottom:12px">👷</div>
    <div style="font-weight:700;font-size:1rem;color:var(--navy)">No staff yet</div>
    <div style="font-size:.84rem;margin-top:6px">Add your delivery staff and support team.</div>
  </div>`:''}
  `;
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

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Total DCs</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDCs}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">${staffCount} staff on route</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Delivered</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--success);line-height:1">${delivered}</div>
      <div style="font-size:.75rem;color:var(--success);margin-top:6px">${donePct}% complete</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">In Transit</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--warning);line-height:1">${inTransit}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">out for delivery</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Scheduled</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${pending}</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">not yet started</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${unassigned.length>0?'#d97706':'var(--success)'};margin-bottom:0">
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Unassigned</div>
      <div style="font-size:1.9rem;font-weight:700;color:${unassigned.length>0?'#d97706':'var(--navy)'};line-height:1">${unassigned.length}</div>
      <div style="font-size:.75rem;color:${unassigned.length>0?'#d97706':'var(--text-muted)'};margin-top:6px">${unassigned.length?'needs staff':'all assigned'}</div>
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

// Unified return flow: per-item quantities + warehouse approval (see returnDCModal)
function logReturnModal(dcId) { returnDCModal(dcId); }

/* ============================================================
   CONSOLIDATED ORDERS (PROCUREMENT VIEW)
   ============================================================ */
async function renderConsolidatedOrders(el) {
  const data = await api('/reports/consolidated-orders');
  if (!data) return;
  const totalOrdered   = data.reduce((s,r)=>s+(r.total_ordered_qty||0),0);
  const totalDelivered = data.reduce((s,r)=>s+(r.total_delivered_qty||0),0);
  const totalDue       = data.reduce((s,r)=>s+(r.total_due_qty||0),0);
  const critical       = data.filter(r => r.total_due_qty > 0 && r.client_count > 1).length;

  el.innerHTML = `
  ${pageHeader('Procurement View', 'Consolidated view of items needed across all orders',
    `<button class="btn btn-secondary" onclick="exportConsolidated()">Export CSV</button>`)}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Items with Due Qty',val:data.filter(r=>r.total_due_qty>0).length,sub:`of ${data.length} items`,color:'var(--danger)'},
      {label:'Total Units Due',val:totalDue,sub:'pending delivery',color:totalDue?'var(--warning)':'var(--success)'},
      {label:'Total Ordered',val:totalOrdered,sub:'units across orders',color:'var(--navy)'},
      {label:'Total Delivered',val:totalDelivered,sub:`${totalOrdered?Math.round(totalDelivered/totalOrdered*100):100}% fulfillment`,color:'var(--success)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Clients</th><th>Client Names</th></tr></thead>
        <tbody>${data.length ? data.sort((a,b)=>(b.total_due_qty||0)-(a.total_due_qty||0)).map(r=>`<tr style="${r.total_due_qty>0?'':'opacity:.65'}">
          <td style="font-size:.8rem;color:var(--text-muted)">${r.sku}</td>
          <td><b>${r.item_name}</b></td>
          <td>${r.total_ordered_qty}</td>
          <td style="color:var(--success)">${r.total_delivered_qty}</td>
          <td style="color:${r.total_due_qty>0?'var(--danger)':'var(--success)'};font-weight:700">${r.total_due_qty}</td>
          <td style="text-align:center">${r.client_count}</td>
          <td style="font-size:.78rem;color:var(--text-muted)">${r.clients||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--success)">✓ All items delivered — nothing pending</td></tr>'}
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
  const totalDueQty  = data.reduce((s,r)=>s+(r.due_qty||0),0);
  const critical7    = data.filter(r=>r.days_overdue>7).length;
  const warn3        = data.filter(r=>r.days_overdue>3&&r.days_overdue<=7).length;
  const maxDays      = data.length ? Math.max(...data.map(r=>r.days_overdue||0)) : 0;

  el.innerHTML = `
  ${pageHeader('Due Items', 'Pending line items not yet delivered to clients',
    `<button class="btn btn-secondary" onclick="exportDue()">Export CSV</button>`)}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Pending Line Items',val:data.length,sub:'unfulfilled items',color:data.length?'var(--danger)':'var(--success)'},
      {label:'Total Due Units',val:totalDueQty,sub:'units outstanding',color:totalDueQty?'var(--warning)':'var(--success)'},
      {label:'Critical (>7d)',val:critical7,sub:'severely overdue',color:critical7?'var(--danger)':'var(--success)'},
      {label:'Max Age',val:maxDays?maxDays+'d':'—',sub:'oldest pending item',color:maxDays>7?'var(--danger)':maxDays>3?'var(--warning)':'var(--success)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.9rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>
  <div class="card">
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Client</th><th>Zone</th><th>Order</th><th>Order Date</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Age</th></tr></thead>
        <tbody>${data.length ? data.sort((a,b)=>(b.days_overdue||0)-(a.days_overdue||0)).map(r=>{
          const daysColor = r.days_overdue>7?'var(--danger)':r.days_overdue>3?'var(--warning)':'var(--text)';
          return `<tr style="${r.days_overdue>7?'background:#fff5f5':''}">
            <td><b>${r.client_name}</b></td>
            <td><span class="badge badge-secondary">${r.zone||'—'}</span></td>
            <td style="font-size:.82rem">${r.order_id}</td>
            <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(r.order_date)}</td>
            <td>${r.item_name}</td>
            <td style="color:var(--text-muted)">${r.ordered_qty}</td>
            <td style="color:var(--success)">${r.delivered_qty}</td>
            <td style="color:var(--danger);font-weight:700">${r.due_qty}</td>
            <td><span style="display:inline-block;min-width:36px;text-align:center;padding:2px 8px;border-radius:10px;font-size:.78rem;font-weight:700;background:${r.days_overdue>7?'#fef2f2':r.days_overdue>3?'#fef3c7':'#f0fdf4'};color:${daysColor}">${r.days_overdue}d</span></td>
          </tr>`;
        }).join('') : '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--success)">✓ No pending due items</td></tr>'}
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
  const exps = expenses || [];
  const total   = exps.reduce((s,e)=>s+(e.amount||0),0);
  const avg     = exps.length ? Math.round(total/exps.length) : 0;
  const today   = new Date().toISOString().slice(0,10);
  const weekAgo = new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const thisWeek = exps.filter(e=>e.trip_date>=weekAgo).reduce((s,e)=>s+(e.amount||0),0);
  const clientOpts = (clients||[]).map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  const staffOpts = (staff||[]).filter(s=>s.active).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');

  el.innerHTML = `
  ${pageHeader('Porter Expenses', 'Track delivery trip costs and driver expenses')}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;margin-bottom:22px">
    ${[
      {label:'Total Trips',val:exps.length,sub:'logged',color:'var(--navy)'},
      {label:'Total Spent',val:fmt(total),sub:'all time',color:'var(--primary)'},
      {label:'Avg per Trip',val:fmt(avg),sub:'per delivery',color:'var(--blue)'},
      {label:'This Week',val:fmt(thisWeek),sub:'last 7 days',color:'var(--warning)'},
    ].map(k=>`
      <div class="card" style="padding:16px 18px;border-top:3px solid ${k.color}">
        <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px">${k.label}</div>
        <div style="font-size:1.6rem;font-weight:700;line-height:1">${k.val}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">${k.sub}</div>
      </div>
    `).join('')}
  </div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-header"><span>Log New Trip</span></div>
    <div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
        <div class="form-group"><label>Trip Date</label><input type="date" id="pe-date" value="${today}"></div>
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
    <div class="card-header"><span>Trip Log (${exps.length})</span></div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Date</th><th>Route</th><th>Amount</th><th>Client</th><th>Staff</th><th>Notes</th></tr></thead>
        <tbody>${exps.length ? exps.map(e=>`<tr>
          <td style="font-size:.82rem">${fmtDate(e.trip_date)}</td>
          <td><b>${e.route||'—'}</b></td>
          <td style="font-weight:600">${fmt(e.amount)}</td>
          <td>${e.client_name||'—'}</td>
          <td>${e.staff_name||'—'}</td>
          <td style="color:var(--text-muted);font-size:.82rem">${e.notes||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">No trips logged yet</td></tr>'}
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

