/* ============================================================
   Smart Pantry — App Core (State, Data, Nav)
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const APP = {
  user: null,
  page: 'dashboard',
  cart: [],
  charts: {},
  notifications: [
    { id:1, text:'New order SP-2406-0891 submitted by Meta Bangalore', time:'2 min ago', read:false },
    { id:2, text:'PO #PO-0234 accepted by Fresh Farms — delivery confirmed for Jun 23', time:'18 min ago', read:false },
    { id:3, text:'Low stock alert: Premium Coffee Beans (12 units remaining)', time:'1 hr ago', read:false },
    { id:4, text:'DC #DC-1182 pending billing — 3 days overdue', time:'3 hr ago', read:true },
  ]
};

// ── Role Config ────────────────────────────────────────────
const ROLES = {
  super_admin:          { label:'Super Admin',            org:'4SYZ Platform',   initials:'SA', nav:'platform' },
  ops_admin:            { label:'Operations Admin',       org:'4SYZ Platform',   initials:'OA', nav:'ops' },
  procurement_manager:  { label:'Procurement Manager',    org:'4SYZ Platform',   initials:'PM', nav:'procurement' },
  warehouse_exec:       { label:'Warehouse Executive',    org:'4SYZ Platform',   initials:'WE', nav:'warehouse' },
  delivery_manager:     { label:'Delivery Manager',       org:'4SYZ Platform',   initials:'DM', nav:'delivery' },
  delivery_exec:        { label:'Delivery Executive',     org:'4SYZ Platform',   initials:'DE', nav:'delivery_exec' },
  finance_admin:        { label:'Finance Admin',          org:'4SYZ Platform',   initials:'FA', nav:'finance' },
  client_admin:         { label:'Client Admin',           org:'Corporate Client',initials:'CA', nav:'client' },
  client_approver:      { label:'Client Approver',        org:'Corporate Client',initials:'AP', nav:'approver' },
  client_user:          { label:'Client User',            org:'Corporate Client',initials:'CU', nav:'client_user' },
  vendor_admin:         { label:'Vendor Admin',           org:'Supplier/Vendor', initials:'VA', nav:'vendor' },
  vendor_user:          { label:'Vendor User',            org:'Supplier/Vendor', initials:'VU', nav:'vendor_user' },
};

// ── Navigation per surface ─────────────────────────────────
const NAV = {
  platform: [
    { section:'Control Tower' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'orders',         label:'Orders',           icon:iconOrders,     badge:'18' },
    { id:'inventory',      label:'Inventory',        icon:iconInventory,  badge:null },
    { id:'vendors',        label:'Vendors',          icon:iconVendors,    badge:null },
    { section:'Operations' },
    { id:'procurement',    label:'Procurement',      icon:iconProcure,    badge:null },
    { id:'warehouse',      label:'Warehouse',        icon:iconWarehouse,  badge:null },
    { id:'delivery',       label:'Deliveries',       icon:iconDelivery,   badge:'5' },
    { id:'dc_billing',     label:'DC Billing',       icon:iconBilling,    badge:'27' },
    { section:'Management' },
    { id:'clients',        label:'Clients',          icon:iconClients,    badge:null },
    { id:'service_desk',   label:'Service Desk',     icon:iconDesk,       badge:'3' },
    { id:'reports',        label:'Reports & BI',     icon:iconReports,    badge:null },
    { section:'Admin' },
    { id:'users',          label:'Users & Roles',    icon:iconUsers,      badge:null },
    { id:'settings',       label:'Settings',         icon:iconSettings,   badge:null },
  ],
  ops: [
    { section:'Operations' },
    { id:'dashboard',      label:'Control Tower',    icon:iconDashboard,  badge:null },
    { id:'orders',         label:'Orders',           icon:iconOrders,     badge:'18' },
    { id:'delivery',       label:'Deliveries',       icon:iconDelivery,   badge:'5' },
    { id:'dc_billing',     label:'DC Billing',       icon:iconBilling,    badge:'27' },
    { id:'clients',        label:'Clients',          icon:iconClients,    badge:null },
    { id:'service_desk',   label:'Service Desk',     icon:iconDesk,       badge:'3' },
    { id:'reports',        label:'Reports',          icon:iconReports,    badge:null },
  ],
  procurement: [
    { section:'Procurement' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'procurement',    label:'Procurement',      icon:iconProcure,    badge:null },
    { id:'vendors',        label:'Vendors',          icon:iconVendors,    badge:null },
    { id:'inventory',      label:'Inventory',        icon:iconInventory,  badge:null },
    { id:'reports',        label:'Reports',          icon:iconReports,    badge:null },
  ],
  warehouse: [
    { section:'Warehouse' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'warehouse',      label:'Warehouse',        icon:iconWarehouse,  badge:null },
    { id:'inventory',      label:'Inventory',        icon:iconInventory,  badge:null },
  ],
  delivery: [
    { section:'Delivery' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'delivery',       label:'Deliveries',       icon:iconDelivery,   badge:'5' },
    { id:'dc_billing',     label:'DC Billing',       icon:iconBilling,    badge:null },
  ],
  delivery_exec: [
    { section:'My Tasks' },
    { id:'delivery',       label:'My Deliveries',    icon:iconDelivery,   badge:'3' },
  ],
  finance: [
    { section:'Finance' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'dc_billing',     label:'DC Billing',       icon:iconBilling,    badge:'27' },
    { id:'reports',        label:'Reports',          icon:iconReports,    badge:null },
  ],
  client: [
    { section:'Client Portal' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'place_order',    label:'Place Order',      icon:iconOrders,     badge:null },
    { id:'my_orders',      label:'My Orders',        icon:iconInventory,  badge:null },
    { id:'track_delivery', label:'Track Delivery',   icon:iconDelivery,   badge:null },
    { id:'reports',        label:'Reports',          icon:iconReports,    badge:null },
    { id:'service_desk',   label:'Service Desk',     icon:iconDesk,       badge:null },
    { id:'users',          label:'Users',            icon:iconUsers,      badge:null },
  ],
  approver: [
    { section:'Approvals' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'approvals',      label:'Pending Approvals',icon:iconOrders,     badge:'4' },
    { id:'my_orders',      label:'All Orders',       icon:iconInventory,  badge:null },
  ],
  client_user: [
    { section:'Client Portal' },
    { id:'dashboard',      label:'Dashboard',        icon:iconDashboard,  badge:null },
    { id:'place_order',    label:'Place Order',      icon:iconOrders,     badge:null },
    { id:'my_orders',      label:'My Orders',        icon:iconInventory,  badge:null },
    { id:'track_delivery', label:'Track Delivery',   icon:iconDelivery,   badge:null },
    { id:'service_desk',   label:'Service Desk',     icon:iconDesk,       badge:null },
  ],
  vendor: [
    { section:'Vendor Portal' },
    { id:'dashboard',      label:'PO Inbox',         icon:iconDashboard,  badge:'5' },
    { id:'vendor_pos',     label:'Confirmed POs',    icon:iconOrders,     badge:null },
    { id:'vendor_invoices',label:'Invoices',         icon:iconBilling,    badge:null },
    { id:'vendor_payments',label:'Payments',         icon:iconReports,    badge:null },
  ],
  vendor_user: [
    { section:'Vendor Portal' },
    { id:'vendor_pos',     label:'View POs',         icon:iconOrders,     badge:null },
  ],
};

// ── Mock Data ──────────────────────────────────────────────
const DATA = {
  orders: [
    { id:'SP-2406-0891', client:'Meta Bangalore HQ',     type:'Standard',  status:'SUBMITTED',     date:'2026-06-21', amount:142600, items:24, priority:'normal' },
    { id:'SP-2406-0890', client:'LinkedIn Pune Office',  type:'Recurring', status:'ACKNOWLEDGED',  date:'2026-06-21', amount:87400,  items:18, priority:'normal' },
    { id:'SP-2406-0889', client:'ServiceNow Delhi',      type:'Emergency', status:'VENDOR_PO_RAISED',date:'2026-06-20',amount:54200, items:9,  priority:'high' },
    { id:'SP-2406-0888', client:'Sodexo Hyderabad',      type:'Standard',  status:'IN_SHIPMENT',   date:'2026-06-20', amount:218900, items:42, priority:'normal' },
    { id:'SP-2406-0887', client:'Meta Bangalore HQ',     type:'Standing',  status:'CLOSED',        date:'2026-06-19', amount:195000, items:36, priority:'normal' },
    { id:'SP-2406-0886', client:'LinkedIn Mumbai',       type:'Bulk Import',status:'PARTIALLY_CLOSED',date:'2026-06-19',amount:312000,items:58,priority:'normal' },
    { id:'SP-2406-0885', client:'ServiceNow Bangalore',  type:'Event',     status:'PENDING_APPROVAL',date:'2026-06-18',amount:89500, items:15, priority:'high' },
    { id:'SP-2406-0884', client:'Sodexo Chennai',        type:'Standard',  status:'CANCELLED',     date:'2026-06-18', amount:42100,  items:8,  priority:'normal' },
  ],
  vendors: [
    { id:'V-001', name:'Fresh Farms India',     category:'Fruits & Vegetables', ontime:94, leadtime:2.4, fillrate:96, pos:12, pending:2,  contact:'Ravi Kumar',    email:'ravi@freshfarms.in' },
    { id:'V-002', name:'Brewmaster Supplies',   category:'Beverages',           ontime:88, leadtime:3.1, fillrate:91, pos:8,  pending:1,  contact:'Priya Sharma',  email:'priya@brewmaster.in' },
    { id:'V-003', name:'CleanPro Solutions',    category:'Cleaning & Hygiene',  ontime:97, leadtime:1.8, fillrate:99, pos:6,  pending:0,  contact:'Ankit Mehta',   email:'ankit@cleanpro.in' },
    { id:'V-004', name:'Pantry Plus',           category:'Snacks & Dry Goods',  ontime:82, leadtime:4.2, fillrate:87, pos:15, pending:3,  contact:'Sunita Reddy',  email:'sunita@pantryplus.in' },
    { id:'V-005', name:'Dairy Delight',         category:'Dairy & Chilled',     ontime:91, leadtime:1.2, fillrate:94, pos:9,  pending:1,  contact:'Mohan Das',     email:'mohan@dairydelight.in' },
  ],
  inventory: [
    { sku:'SP-001', name:'Premium Coffee Beans',     cat:'Beverages',   brand:'Blue Tokai',    stock:12,  reorder:25, cost:850,  price:1100, status:'low' },
    { sku:'SP-002', name:'Assorted Nuts Mix (500g)', cat:'Snacks',      brand:'Happilo',       stock:142, reorder:50, cost:320,  price:450,  status:'ok'  },
    { sku:'SP-003', name:'Green Tea Sachets (50pk)', cat:'Beverages',   brand:'Tetley',        stock:67,  reorder:30, cost:180,  price:250,  status:'ok'  },
    { sku:'SP-004', name:'Hand Sanitiser 500ml',     cat:'Cleaning',    brand:'Dettol',        stock:0,   reorder:40, cost:120,  price:175,  status:'out' },
    { sku:'SP-005', name:'Instant Oats (1kg)',       cat:'Dry Goods',   brand:'Quaker',        stock:89,  reorder:20, cost:110,  price:160,  status:'ok'  },
    { sku:'SP-006', name:'Mineral Water 1L (case)',  cat:'Beverages',   brand:'Bisleri',       stock:230, reorder:100,cost:200,  price:280,  status:'ok'  },
    { sku:'SP-007', name:'Tissue Box (3-ply)',       cat:'Housekeeping',brand:'Kleenex',       stock:8,   reorder:30, cost:90,   price:130,  status:'low' },
    { sku:'SP-008', name:'Dark Chocolate Bar',       cat:'Snacks',      brand:'Amul',          stock:315, reorder:50, cost:45,   price:70,   status:'ok'  },
  ],
  catalog: [
    { sku:'SP-001', name:'Premium Coffee Beans',     cat:'Pantry',       emoji:'☕', stock:12,  price:1100, max:10 },
    { sku:'SP-002', name:'Assorted Nuts Mix',        cat:'Pantry',       emoji:'🥜', stock:142, price:450,  max:50 },
    { sku:'SP-003', name:'Green Tea Sachets',        cat:'Pantry',       emoji:'🍵', stock:67,  price:250,  max:100 },
    { sku:'SP-005', name:'Instant Oats 1kg',         cat:'Pantry',       emoji:'🥣', stock:89,  price:160,  max:30 },
    { sku:'SP-006', name:'Mineral Water 1L (case)',  cat:'Pantry',       emoji:'💧', stock:230, price:280,  max:200 },
    { sku:'SP-008', name:'Dark Chocolate Bar',       cat:'Pantry',       emoji:'🍫', stock:315, price:70,   max:100 },
    { sku:'HK-001', name:'Toilet Rolls (12-pack)',   cat:'Housekeeping', emoji:'🧻', stock:180, price:220,  max:50 },
    { sku:'HK-002', name:'Hand Sanitiser 500ml',     cat:'Housekeeping', emoji:'🧴', stock:0,   price:175,  max:20 },
    { sku:'HK-003', name:'Dish Soap 1L',             cat:'Housekeeping', emoji:'🫧', stock:95,  price:90,   max:30 },
    { sku:'ST-001', name:'Sticky Notes (5-pack)',    cat:'Stationery',   emoji:'📝', stock:210, price:120,  max:20 },
    { sku:'ST-002', name:'Ballpen Set (10-pack)',    cat:'Stationery',   emoji:'✏️', stock:340, price:80,   max:20 },
    { sku:'GF-001', name:'Assorted Gift Hamper',     cat:'Gifting',      emoji:'🎁', stock:15,  price:2500, max:5  },
  ],
  dcs: [
    { id:'DC-1185', order:'SP-2406-0888', client:'Sodexo Hyderabad',    date:'2026-06-21', amount:218900, status:'DELIVERED',        billing:'PENDING' },
    { id:'DC-1184', order:'SP-2406-0887', client:'Meta Bangalore HQ',   date:'2026-06-20', amount:195000, status:'DELIVERED',        billing:'BILLED'  },
    { id:'DC-1183', order:'SP-2406-0886', client:'LinkedIn Mumbai',      date:'2026-06-19', amount:156000, status:'PARTIAL_DELIVERY', billing:'PENDING' },
    { id:'DC-1182', order:'SP-2406-0884', client:'Sodexo Chennai',       date:'2026-06-16', amount:42100,  status:'DELIVERED',        billing:'OVERDUE' },
    { id:'DC-1181', order:'SP-2406-0883', client:'Meta Pune',            date:'2026-06-18', amount:98400,  status:'DELIVERED',        billing:'INVOICED' },
  ],
  pos: [
    { id:'PO-0238', vendor:'Fresh Farms India',   items:6, amount:48000, required:'2026-06-23', status:'PENDING_ACCEPTANCE', order:'SP-2406-0889' },
    { id:'PO-0237', vendor:'Brewmaster Supplies', items:4, amount:32400, required:'2026-06-24', status:'PENDING_ACCEPTANCE', order:'SP-2406-0890' },
    { id:'PO-0236', vendor:'Dairy Delight',       items:3, amount:18900, required:'2026-06-22', status:'ACCEPTED',           order:'SP-2406-0888' },
    { id:'PO-0235', vendor:'CleanPro Solutions',  items:8, amount:52000, required:'2026-06-25', status:'DISPATCHED',         order:'SP-2406-0887' },
    { id:'PO-0234', vendor:'Pantry Plus',         items:5, amount:27500, required:'2026-06-23', status:'PENDING_ACCEPTANCE', order:'SP-2406-0891' },
  ],
};

// ── SVG Icons ──────────────────────────────────────────────
function icon(path, size=16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
function iconDashboard(s=16) { return icon('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',s); }
function iconOrders(s=16)    { return icon('<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',s); }
function iconInventory(s=16) { return icon('<path d="M20 7H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/><path d="M16 7V5a2 2 0 0 0-4 0v2M12 12v4M10 14h4"/>',s); }
function iconVendors(s=16)   { return icon('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',s); }
function iconProcure(s=16)   { return icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',s); }
function iconWarehouse(s=16) { return icon('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',s); }
function iconDelivery(s=16)  { return icon('<path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>',s); }
function iconBilling(s=16)   { return icon('<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',s); }
function iconClients(s=16)   { return icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',s); }
function iconDesk(s=16)      { return icon('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',s); }
function iconReports(s=16)   { return icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',s); }
function iconUsers(s=16)     { return icon('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',s); }
function iconSettings(s=16)  { return icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',s); }
function iconX(s=16)         { return icon('<path d="M18 6L6 18M6 6l12 12"/>',s); }
function iconCheck(s=16)     { return icon('<polyline points="20 6 9 17 4 12"/>',s); }
function iconPlus(s=16)      { return icon('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',s); }
function iconSearch(s=16)    { return icon('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',s); }
function iconDownload(s=16)  { return icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',s); }
function iconFilter(s=16)    { return icon('<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',s); }
function iconEye(s=16)       { return icon('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',s); }
function iconArrow(s=16)     { return icon('<path d="M5 12h14M12 5l7 7-7 7"/>',s); }
function iconTruck(s=16)     { return icon('<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',s); }
function iconUpload(s=16)    { return icon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',s); }
function iconCart(s=16)      { return icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',s); }
function iconBell(s=16)      { return icon('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',s); }

// ── Helpers ────────────────────────────────────────────────
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
function pct(n) { return n + '%'; }
function badge(text, type='secondary') { return `<span class="badge badge-${type}">${text}</span>`; }

function orderStatusBadge(s) {
  const map = {
    DRAFT:'secondary', SUBMITTED:'info', PENDING_APPROVAL:'warning',
    APPROVED:'primary', ACKNOWLEDGED:'primary', INVENTORY_CHECK:'info',
    VENDOR_PO_RAISED:'warning', READY_TO_PICK:'info', IN_SHIPMENT:'gold',
    PARTIALLY_CLOSED:'warning', CLOSED:'success', CANCELLED:'danger',
  };
  const label = s.replace(/_/g,' ');
  return badge(label, map[s]||'secondary');
}

function poStatusBadge(s) {
  const map = { PENDING_ACCEPTANCE:'warning', ACCEPTED:'info', DISPATCHED:'gold', DELIVERED:'success', REJECTED:'danger' };
  return badge(s.replace(/_/g,' '), map[s]||'secondary');
}

function stockBadge(s) {
  if(s==='out') return badge('Out of Stock','danger');
  if(s==='low') return badge('Low Stock','warning');
  return badge('In Stock','success');
}

// ── Login / Logout ─────────────────────────────────────────
function togglePw() {
  const i = document.getElementById('login-password');
  i.type = i.type === 'password' ? 'text' : 'password';
}

function doLogin() {
  const role = document.getElementById('demo-role').value;
  APP.user = { role, ...ROLES[role] };
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp();
}

function doLogout() {
  APP.user = null;
  APP.cart = [];
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(e){} });
  APP.charts = {};
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── App Init ───────────────────────────────────────────────
function initApp() {
  const r = APP.user;
  document.getElementById('user-avatar').textContent  = r.initials;
  document.getElementById('topbar-avatar').textContent = r.initials;
  document.getElementById('user-name').textContent    = r.label;
  document.getElementById('user-role').textContent    = r.org;
  buildNav();
  populateNotifications();
  navigate(getDefaultPage());
}

function getDefaultPage() {
  const nav = APP.user.nav;
  if(nav==='vendor' || nav==='vendor_user') return 'dashboard';
  if(nav==='approver') return 'approvals';
  if(nav==='client_user') return 'dashboard';
  return 'dashboard';
}

// ── Navigation ─────────────────────────────────────────────
function buildNav() {
  const items = NAV[APP.user.nav] || NAV.platform;
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = items.map(item => {
    if(item.section) return `<div class="nav-section"><div class="nav-section-label">${item.section}</div></div>`;
    return `<div class="nav-item" id="nav-${item.id}" onclick="navigate('${item.id}')">
      ${item.icon(16)}
      <span class="nav-item-label">${item.label}</span>
      ${item.badge ? `<span class="nav-item-badge">${item.badge}</span>` : ''}
    </div>`;
  }).join('');
}

function navigate(page) {
  APP.page = page;

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if(navEl) navEl.classList.add('active');

  // Update breadcrumb
  const allItems = NAV[APP.user.nav] || NAV.platform;
  const item = allItems.find(i => i.id === page);
  document.getElementById('breadcrumb').textContent = item ? item.label : page.replace(/_/g,' ');

  // Close notifications
  document.getElementById('notif-panel').classList.add('hidden');

  // Destroy old charts
  Object.values(APP.charts).forEach(c => { try { c.destroy(); } catch(e){} });
  APP.charts = {};

  // Render
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  main.className = 'content fade-in';

  const pages = {
    dashboard:       renderDashboard,
    place_order:     renderPlaceOrder,
    my_orders:       renderMyOrders,
    track_delivery:  renderTrackDelivery,
    orders:          renderOrderQueue,
    approvals:       renderApprovals,
    inventory:       renderInventory,
    warehouse:       renderWarehouse,
    vendors:         renderVendors,
    procurement:     renderProcurement,
    delivery:        renderDelivery,
    dc_billing:      renderDCBilling,
    clients:         renderClients,
    service_desk:    renderServiceDesk,
    reports:         renderReports,
    users:           renderUsers,
    settings:        renderSettings,
    vendor_pos:      renderVendorPOs,
    vendor_invoices: renderVendorInvoices,
    vendor_payments: renderVendorPayments,
  };

  const fn = pages[page];
  if(fn) { fn(main); } else { main.innerHTML = notImplemented(page); }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

// ── Notifications ──────────────────────────────────────────
function populateNotifications() {
  const list = document.getElementById('notif-list');
  list.innerHTML = APP.notifications.map(n => `
    <div class="notif-item">
      <div class="notif-dot ${n.read?'read':''}"></div>
      <div class="notif-text">
        <p>${n.text}</p>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

function toggleNotifications() {
  document.getElementById('notif-panel').classList.toggle('hidden');
}
function closeNotifications() {
  document.getElementById('notif-panel').classList.add('hidden');
}

// ── Modal ──────────────────────────────────────────────────
function openModal(title, body, footer='') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer || `<button class="btn btn-secondary" onclick="closeModal()">Close</button>`;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function notImplemented(page) {
  return `<div class="empty-state">
    <div class="empty-icon">🚧</div>
    <div class="empty-title">${page.replace(/_/g,' ')} — Coming Soon</div>
    <div class="empty-desc">This module is part of the Smart Pantry platform</div>
  </div>`;
}

// ── Page Header Helper ─────────────────────────────────────
function pageHeader(title, sub, actions='') {
  return `<div class="page-header">
    <div class="page-header-left">
      <div class="page-title">${title}</div>
      ${sub ? `<div class="page-subtitle">${sub}</div>` : ''}
    </div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;
}

/* ============================================================
   SCREEN 1.1 — Dashboard (role-aware)
   ============================================================ */
function renderDashboard(el) {
  const nav = APP.user.nav;
  if(nav==='client'||nav==='client_user'||nav==='approver') { renderClientDashboard(el); return; }
  if(nav==='vendor'||nav==='vendor_user') { renderVendorDashboard(el); return; }
  renderOpsDashboard(el);
}

/* Client Dashboard (screen 1.1) */
function renderClientDashboard(el) {
  el.innerHTML = `
  ${pageHeader('Client Dashboard','Meta Bangalore HQ · June 2026',`
    <select class="filter-select" style="font-size:.82rem">
      <option>This Month</option><option>This Quarter</option><option>This Year</option><option>Custom Range</option>
    </select>
    <button class="btn btn-gold">${iconPlus(14)} Place Order</button>
  `)}

  <!-- TOP: Health Score + KPIs -->
  <div style="display:flex;gap:14px;margin-bottom:16px;flex-wrap:wrap">
    <!-- Service Health Score ring -->
    <div class="card" style="flex:none;width:190px;padding:20px;display:flex;flex-direction:column;align-items:center">
      <div style="font-size:.7rem;font-weight:700;color:var(--text-label);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Service Health</div>
      <div style="position:relative;width:104px;height:104px">
        <svg width="104" height="104" class="donut-svg" viewBox="0 0 104 104">
          <circle cx="52" cy="52" r="42" fill="none" stroke="var(--border)" stroke-width="10"/>
          <circle cx="52" cy="52" r="42" fill="none" stroke="var(--success)" stroke-width="10"
            stroke-dasharray="${2*Math.PI*42*86/100} ${2*Math.PI*42*(1-86/100)}"
            stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
          <div style="font-size:1.6rem;font-weight:800;color:var(--navy)">86</div>
          <div style="font-size:.65rem;color:var(--text-muted)">/ 100</div>
        </div>
      </div>
      <div class="progress" style="width:100%;margin-top:12px">
        <div class="progress-fill prog-green" style="width:86%"></div>
      </div>
      <div style="font-size:.7rem;color:var(--success);margin-top:5px;font-weight:600">▲ +3 vs last month</div>
    </div>

    <!-- KPI cards grid -->
    <div style="flex:1;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;min-width:280px">
      <div class="kpi-card">
        <div class="kpi-label">Spend MTD</div>
        <div class="kpi-value">₹14.2L</div>
        <div class="kpi-change up">▲ 8% vs last month</div>
        <div class="kpi-trend"><div class="kpi-trend-fill prog-navy" style="width:71%"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Orders MTD</div>
        <div class="kpi-value">38</div>
        <div class="kpi-change up">▲ 12% vs last month</div>
        <div class="kpi-trend"><div class="kpi-trend-fill prog-navy" style="width:63%"></div></div>
      </div>
      <div class="kpi-card kpi-warning">
        <div class="kpi-label">Pending Items</div>
        <div class="kpi-value">14</div>
        <div class="kpi-sub">Across 3 open orders</div>
        <div class="kpi-trend"><div class="kpi-trend-fill prog-gold" style="width:28%"></div></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Budget Used</div>
        <div class="kpi-value">71%</div>
        <div class="kpi-sub">₹14.2L of ₹20L</div>
        <div class="kpi-trend"><div class="kpi-trend-fill prog-navy" style="width:71%"></div></div>
      </div>
    </div>
  </div>

  <!-- BOTTOM: Pending Deliveries + Spend by Category -->
  <div class="grid-2" style="margin-bottom:16px">
    <!-- Pending Deliveries Widget -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Pending Deliveries</span>
        <button class="btn btn-secondary btn-sm" onclick="navigate('track_delivery')">View All</button>
      </div>
      <div class="card-body" style="padding:16px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          ${[['Total Orders','38','secondary'],['Fully Delivered','24','success'],['Partially Delivered','8','warning'],
             ['Pending Items','14','warning'],['Pending Value','₹2.1L','warning'],['Delayed (3d+)','3','danger']].map(([l,v,t])=>`
          <div style="background:${t==='secondary'?'var(--bg)':t==='success'?'var(--success-bg)':t==='warning'?'var(--warning-bg)':'var(--danger-bg)'};border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:1.1rem;font-weight:800;color:var(--navy)">${v}</div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">${l}</div>
          </div>`).join('')}
        </div>
        <div style="font-size:.78rem;font-weight:600;color:var(--text-label);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Pending by Order</div>
        ${[['SP-2406-0890','LinkedIn Pune','18 Jun','6 items',false],
           ['SP-2406-0888','Sodexo Hyd','20 Jun','5 items',true],
           ['SP-2406-0886','LinkedIn Mumbai','19 Jun','3 items',true]].map(([id,c,d,i,delayed])=>`
        <div class="data-row">
          <div>
            <div style="font-size:.83rem;font-weight:600">${id}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${c} · ${d}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:.78rem;font-weight:600;color:var(--warning)">${i}</span>
            ${delayed ? badge('Delayed','danger') : ''}
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Spend by Category Chart -->
    <div class="chart-card">
      <div class="chart-title">
        Spend by Category
        <select class="filter-select" style="font-size:.78rem;padding:4px 8px">
          <option>This Month</option><option>Last 3 Months</option>
        </select>
      </div>
      <div class="chart-wrap" id="spend-cat-chart"></div>
      <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px">
        ${[['Pantry','#16284a',42],['Beverages','#c79a4b',28],['Housekeeping','#1f8a5b',18],['Stationery','#9aa9c4',12]].map(([l,c,p])=>`
        <div style="display:flex;align-items:center;gap:5px;font-size:.78rem">
          <span style="width:10px;height:10px;border-radius:2px;background:${c};flex-shrink:0"></span>
          <span>${l} ${p}%</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Top & Slow Moving Items -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Top 5 Fast-Moving Items</span></div>
      <div class="card-body" style="padding:0">
        <table><tbody>
          ${[['Premium Coffee Beans','Beverages',142,'☕'],['Mineral Water 1L','Beverages',230,'💧'],
             ['Assorted Nuts','Snacks',118,'🥜'],['Toilet Rolls','Housekeeping',95,'🧻'],['Dark Chocolate','Snacks',88,'🍫']
          ].map(([n,c,qty,e],i)=>`<tr>
            <td><span style="font-weight:700;color:var(--text-label);font-size:.8rem">#${i+1}</span></td>
            <td>${e} <span style="font-weight:600;font-size:.85rem">${n}</span></td>
            <td><span class="badge badge-secondary">${c}</span></td>
            <td style="text-align:right;font-weight:700;font-size:.88rem">${qty} units</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Top 5 Slow-Moving Items</span></div>
      <div class="card-body" style="padding:0">
        <table><tbody>
          ${[['Gift Hamper (Premium)','Gifting',2,'🎁'],['Whiteboard Markers','Stationery',4,'✏️'],
             ['Herbal Tea Mix','Beverages',6,'🍵'],['Sticky Notes Pack','Stationery',8,'📝'],['Hand Cream 50ml','Housekeeping',9,'🧴']
          ].map(([n,c,qty,e],i)=>`<tr>
            <td><span style="font-weight:700;color:var(--text-label);font-size:.8rem">#${i+1}</span></td>
            <td>${e} <span style="font-weight:600;font-size:.85rem">${n}</span></td>
            <td><span class="badge badge-secondary">${c}</span></td>
            <td style="text-align:right;font-weight:700;color:var(--warning);font-size:.88rem">${qty} units</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>`;

  // Donut chart
  setTimeout(()=>{
    const wrap = document.getElementById('spend-cat-chart');
    if(!wrap) return;
    const c = document.createElement('canvas');
    c.style.height = '180px';
    wrap.appendChild(c);
    APP.charts.spendCat = new Chart(c, {
      type:'doughnut',
      data:{
        labels:['Pantry','Beverages','Housekeeping','Stationery'],
        datasets:[{data:[42,28,18,12],backgroundColor:['#16284a','#c79a4b','#1f8a5b','#9aa9c4'],borderWidth:0,hoverOffset:4}]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw}%`}}},cutout:'68%'}
    });
  },50);
}

/* Ops Dashboard (screen 2.1) */
function renderOpsDashboard(el) {
  const isFinance = APP.user.nav==='finance';
  el.innerHTML = `
  ${pageHeader('Operations Control Tower','Real-time operational KPIs · 4SYZ Platform',`
    <select class="filter-select" style="font-size:.82rem">
      <option>All Clients</option><option>Meta</option><option>LinkedIn</option><option>ServiceNow</option><option>Sodexo</option>
    </select>
    <button class="btn btn-secondary">${iconDownload(14)} Export</button>
  `)}

  <!-- 4 KPI counters -->
  <div class="grid-4" style="margin-bottom:16px">
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('orders')">
      <div class="kpi-label">Pending Acknowledgement</div>
      <div class="kpi-value">18</div>
      <div class="kpi-sub">Orders awaiting ops review</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('delivery')">
      <div class="kpi-label">Deliveries Today</div>
      <div class="kpi-value">42</div>
      <div class="kpi-sub">5 delayed · 37 on track</div>
    </div>
    <div class="kpi-card kpi-warning" style="cursor:pointer" onclick="navigate('dc_billing')">
      <div class="kpi-label">DC Pending Billing</div>
      <div class="kpi-value">27</div>
      <div class="kpi-sub">₹38.2L outstanding</div>
    </div>
    <div class="kpi-card" style="cursor:pointer" onclick="navigate('dc_billing')">
      <div class="kpi-label">Billing → Invoice</div>
      <div class="kpi-value">11</div>
      <div class="kpi-sub">Awaiting invoice generation</div>
    </div>
  </div>

  <!-- Charts row -->
  <div class="charts-grid" style="margin-bottom:16px">
    <div class="chart-card">
      <div class="chart-title">Order vs Delivery — Last 6 Weeks
        <div style="display:flex;gap:12px">
          <div style="display:flex;align-items:center;gap:5px;font-size:.75rem;font-weight:500">
            <span style="width:10px;height:10px;background:var(--navy);border-radius:2px"></span>Ordered
          </div>
          <div style="display:flex;align-items:center;gap:5px;font-size:.75rem;font-weight:500">
            <span style="width:10px;height:10px;background:var(--gold);border-radius:2px"></span>Delivered
          </div>
        </div>
      </div>
      <div class="chart-wrap"><canvas id="order-delivery-chart"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Fulfilment Rate <span style="font-size:.75rem;color:var(--text-muted);font-weight:400">On-time delivery</span></div>
      <div style="display:flex;align-items:center;gap:20px">
        <div style="position:relative;width:120px;height:120px;flex-shrink:0">
          <svg width="120" height="120" class="donut-svg" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" stroke-width="12"/>
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--success)" stroke-width="12"
              stroke-dasharray="${2*Math.PI*48*88/100} ${2*Math.PI*48*12/100}" stroke-linecap="round"/>
            <circle cx="60" cy="60" r="48" fill="none" stroke="#c0392b" stroke-width="12" stroke-dashoffset="${-(2*Math.PI*48*88/100)}"
              stroke-dasharray="${2*Math.PI*48*12/100} ${2*Math.PI*48*88/100}"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-size:1.5rem;font-weight:800;color:var(--navy)">88%</div>
            <div style="font-size:.65rem;color:var(--text-muted)">on time</div>
          </div>
        </div>
        <div style="flex:1">
          ${[['On-time Deliveries','88%','success'],['Delayed Deliveries','12%','danger'],['Fill Rate','94%','success'],['Avg Lead Time','2.8d','info']].map(([l,v,t])=>`
          <div class="data-row"><span class="data-label">${l}</span><span class="data-value" style="color:var(--${t==='success'?'success':t==='danger'?'danger':'navy'})">${v}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </div>

  <!-- Revenue KPIs (for Super Admin / Finance) -->
  ${['platform','finance'].includes(APP.user.nav)?`
  <div class="grid-4" style="margin-bottom:16px">
    <div class="kpi-card kpi-success">
      <div class="kpi-label">Revenue MTD</div>
      <div class="kpi-value">₹84.6L</div>
      <div class="kpi-change up">▲ 14% vs May</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Revenue YTD</div>
      <div class="kpi-value">₹4.8Cr</div>
      <div class="kpi-change up">▲ 22% vs FY25</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Gross Margin</div>
      <div class="kpi-value">28.4%</div>
      <div class="kpi-change up">▲ 1.2pp vs May</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Active Clients</div>
      <div class="kpi-value">47</div>
      <div class="kpi-sub">3 new this month</div>
    </div>
  </div>`:''}

  <!-- Top Clients + Recent Orders -->
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Top 5 Clients by Revenue</span></div>
      <div class="card-body" style="padding:0">
        <table><tbody>
          ${[['Meta India','₹24.2L',28.6],['LinkedIn India','₹18.9L',22.3],
             ['ServiceNow','₹14.1L',16.7],['Sodexo','₹11.8L',13.9],['Others','₹15.6L',18.5]
          ].map(([c,r,p],i)=>`<tr>
            <td style="font-weight:700;color:var(--text-label);font-size:.8rem;width:24px">#${i+1}</td>
            <td><span style="font-weight:600;font-size:.85rem">${c}</span></td>
            <td style="width:100px">
              <div class="progress"><div class="progress-fill prog-navy" style="width:${p}%"></div></div>
            </td>
            <td style="text-align:right;font-weight:700;font-size:.88rem;color:var(--navy)">${r}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">Recent Orders</span>
        <button class="btn btn-secondary btn-sm" onclick="navigate('orders')">View All</button>
      </div>
      <div class="card-body" style="padding:0">
        <table><tbody>
          ${DATA.orders.slice(0,5).map(o=>`<tr>
            <td><span style="font-weight:600;font-size:.82rem">${o.id}</span></td>
            <td style="font-size:.82rem;color:var(--text-muted)">${o.client.split(' ').slice(0,2).join(' ')}</span></td>
            <td>${orderStatusBadge(o.status)}</td>
            <td style="text-align:right;font-weight:700;font-size:.82rem">${fmt(o.amount)}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>`;

  setTimeout(()=>{
    const ctx = document.getElementById('order-delivery-chart');
    if(!ctx) return;
    APP.charts.ordDel = new Chart(ctx, {
      type:'bar',
      data:{
        labels:['May 12','May 19','May 26','Jun 2','Jun 9','Jun 16'],
        datasets:[
          {label:'Ordered', data:[148,196,162,218,184,224], backgroundColor:'rgba(22,40,74,.85)', borderRadius:3},
          {label:'Delivered',data:[128,176,154,198,168,198], backgroundColor:'#c79a4b', borderRadius:3},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{grid:{color:'rgba(0,0,0,.05)'},beginAtZero:true}}}
    });
  },50);
}

/* Vendor Dashboard */
function renderVendorDashboard(el) {
  el.innerHTML = `
  ${pageHeader('PO Inbox','Fresh Farms India · Vendor Portal','')}
  <div class="grid-3" style="margin-bottom:16px">
    <div class="kpi-card kpi-warning">
      <div class="kpi-label">Awaiting Acceptance</div>
      <div class="kpi-value">5</div>
      <div class="kpi-sub">POs pending your action</div>
    </div>
    <div class="kpi-card kpi-success">
      <div class="kpi-label">On-Time Rate</div>
      <div class="kpi-value">94%</div>
      <div class="kpi-change up">▲ 2pp vs last month</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Lead Time</div>
      <div class="kpi-value">2.4d</div>
      <div class="kpi-sub">Target: ≤ 3 days</div>
    </div>
  </div>

  <!-- PO Table -->
  <div class="card">
    <div class="card-header">
      <span class="card-title">Purchase Orders</span>
      <div class="page-actions">
        <select class="filter-select" style="font-size:.82rem">
          <option>All Status</option><option>Pending Acceptance</option><option>Accepted</option><option>Dispatched</option>
        </select>
      </div>
    </div>
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>PO No.</th><th>Order Ref</th><th>Lines</th><th>Value</th><th>Required By</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${DATA.pos.map(po=>`<tr>
              <td><span style="font-weight:700;color:var(--navy)">${po.id}</span></td>
              <td style="font-size:.82rem;color:var(--text-muted)">${po.order}</td>
              <td>${po.items}</td>
              <td style="font-weight:600">${fmt(po.amount)}</td>
              <td style="font-size:.82rem">${po.required}</td>
              <td>${poStatusBadge(po.status)}</td>
              <td>
                <div style="display:flex;gap:6px">
                  ${po.status==='PENDING_ACCEPTANCE'?`
                    <button class="btn btn-primary btn-sm" onclick="acceptPO('${po.id}')">${iconCheck(13)} Accept</button>
                    <button class="btn btn-secondary btn-sm" onclick="rejectPO('${po.id}')">${iconX(13)} Reject</button>
                  `:''}
                  ${po.status==='ACCEPTED'?`
                    <button class="btn btn-gold btn-sm" onclick="dispatchPO('${po.id}')">${iconTruck(13)} Dispatch</button>
                    <button class="btn btn-secondary btn-sm" onclick="uploadInvoice('${po.id}')">${iconUpload(13)} Invoice</button>
                  `:''}
                  ${po.status==='DISPATCHED'?`<span class="badge badge-gold">In Transit</span>`:''}
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="viewPO('${po.id}')" title="View">${iconEye(13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function acceptPO(id) {
  openModal('Accept Purchase Order',`
    <div class="alert alert-info">You are accepting PO <strong>${id}</strong>. Please confirm your delivery date commitment.</div>
    <div class="form-row">
      <div class="form-field">
        <label>Committed Delivery Date *</label>
        <input type="date" value="2026-06-23" />
      </div>
      <div class="form-field">
        <label>Fill Quantity Confirmation</label>
        <select><option>Full Fill — 100% of PO qty</option><option>Partial Fill — specify below</option></select>
      </div>
    </div>
    <div class="form-field" style="margin-top:8px">
      <label>Notes (optional)</label>
      <textarea placeholder="Any notes to 4SYZ Procurement Manager..."></textarea>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('PO ${id} accepted — delivery committed for Jun 23')">${iconCheck(14)} Confirm Acceptance</button>`);
}

function rejectPO(id) {
  openModal('Reject Purchase Order',`
    <div class="alert alert-warning">Please provide a reason for rejecting <strong>${id}</strong>. 4SYZ Procurement Manager will be notified immediately.</div>
    <div class="form-field" style="margin-top:4px">
      <label>Rejection Reason *</label>
      <select>
        <option>Out of stock for required date</option>
        <option>Insufficient lead time</option>
        <option>Pricing discrepancy</option>
        <option>MOQ not met</option>
        <option>Other — specify below</option>
      </select>
    </div>
    <div class="form-field" style="margin-top:8px">
      <label>Details</label>
      <textarea placeholder="Additional details..."></textarea>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-danger" onclick="closeModal();showToast('PO ${id} rejected — Procurement Manager notified')">${iconX(14)} Reject PO</button>`);
}

function dispatchPO(id) {
  openModal('Mark as Dispatched',`
    <div class="alert alert-info">Update dispatch details for <strong>${id}</strong>. Warehouse Executive will be notified.</div>
    <div class="form-row">
      <div class="form-field"><label>Dispatch Date *</label><input type="date" value="2026-06-21"/></div>
      <div class="form-field"><label>Vehicle Number *</label><input placeholder="MH12AB3456"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Consignment / LR Number</label><input placeholder="LR-2024-XXXX"/></div>
      <div class="form-field"><label>Driver Contact</label><input placeholder="+91 9XXXXXXXXX"/></div>
    </div>
    <div class="form-field"><label>E-Way Bill (PDF)</label><input type="file" accept=".pdf"/></div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('PO ${id} marked dispatched — warehouse notified')">${iconTruck(14)} Confirm Dispatch</button>`);
}

function viewPO(id) {
  const po = DATA.pos.find(p=>p.id===id);
  if(!po) return;
  openModal(`PO Detail — ${id}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      ${[['PO Number',po.id],['Order Reference',po.order],['Vendor',po.vendor],['Required By',po.required],
         ['Total Value',fmt(po.amount)],['Status',po.status.replace(/_/g,' ')]
      ].map(([l,v])=>`<div class="data-row"><span class="data-label">${l}</span><span class="data-value">${v}</span></div>`).join('')}
    </div>
    <div class="form-section-title">Line Items</div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Premium Coffee Beans</td><td>10</td><td>Kg</td><td>₹850</td><td>₹8,500</td></tr>
      <tr><td>Assorted Nuts Mix</td><td>20</td><td>Pkt</td><td>₹320</td><td>₹6,400</td></tr>
      <tr><td>Green Tea Sachets</td><td>30</td><td>Box</td><td>₹180</td><td>₹5,400</td></tr>
    </tbody></table>`);
}

function uploadInvoice(id) {
  openModal('Upload Invoice',`
    <div class="alert alert-info">Upload invoice against <strong>${id}</strong>. Invoice will be linked to the order and DC in the system.</div>
    <div class="form-row">
      <div class="form-field"><label>Invoice Number *</label><input placeholder="INV-2026-XXXX"/></div>
      <div class="form-field"><label>Invoice Date *</label><input type="date" value="2026-06-21"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Invoice Amount (incl. GST) *</label><input type="number" placeholder="0.00"/></div>
      <div class="form-field"><label>GST Amount</label><input type="number" placeholder="0.00"/></div>
    </div>
    <div class="form-field"><label>Invoice PDF *</label><input type="file" accept=".pdf"/></div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('Invoice uploaded for PO ${id}')">${iconUpload(14)} Upload Invoice</button>`);
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--navy);color:white;padding:10px 20px;border-radius:8px;font-size:.85rem;font-weight:500;z-index:9999;box-shadow:var(--shadow-panel);transition:opacity .3s';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 3000);
}

/* ============================================================
   SCREEN 1.2 — Place Order (Catalogue & Cart)
   ============================================================ */
function renderPlaceOrder(el) {
  el.innerHTML = `
  ${pageHeader('Place Order','Your agreed catalogue · Meta Bangalore HQ',`
    <button class="btn btn-secondary">${iconDownload(14)} Download Template</button>
    <button class="btn btn-gold" onclick="openCart()">${iconCart(14)} Cart <span id="cart-count" style="background:var(--navy);color:white;border-radius:20px;padding:1px 7px;font-size:.72rem;margin-left:4px">${APP.cart.length}</span></button>
  `)}

  <!-- Category + Search filters -->
  <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
    <div class="search-bar" style="min-width:240px;background:var(--surface);border:1.4px solid var(--border-mid)">
      ${iconSearch(15)}<input type="text" placeholder="Search items..." id="catalog-search" oninput="filterCatalog()" />
    </div>
    <div class="catalog-filters" style="margin-bottom:0">
      ${['All','Pantry','Housekeeping','Stationery','Gifting'].map((c,i)=>
        `<span class="cat-pill ${i===0?'active':''}" onclick="setCatFilter(this,'${c}')">${c}</span>`
      ).join('')}
      <span class="cat-pill new" onclick="setCatFilter(this,'New')">★ New Items</span>
    </div>
  </div>

  <!-- Quick Reorder Banner -->
  <div class="alert alert-info" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">
    <div>${iconOrders(15)} <strong>Quick Reorder</strong> — Repeat your last order (SP-2406-0887) with one click</div>
    <button class="btn btn-primary btn-sm" onclick="quickReorder()">Load Last Order</button>
  </div>

  <!-- Catalogue Grid -->
  <div class="catalog-grid" id="catalog-grid">
    ${DATA.catalog.map(item => renderCatalogCard(item)).join('')}
  </div>

  <!-- Cart Panel -->
  <div class="cart-overlay" id="cart-overlay" onclick="closeCart()"></div>
  <div class="cart-panel" id="cart-panel">
    <div class="cart-header">
      <h3>${iconCart(16)} Order Cart</h3>
      <button class="cart-close" onclick="closeCart()">${iconX(18)}</button>
    </div>
    <div class="cart-items" id="cart-items-list">
      <div class="cart-empty">Your cart is empty.<br>Add items from the catalogue.</div>
    </div>
    <div class="cart-footer">
      <div class="cart-approval-hint" id="approval-hint">
        ⚠ Order value exceeds ₹1L — will require Client Approver sign-off before submission to 4SYZ.
      </div>
      <div class="cart-summary" id="cart-summary"></div>
      <button class="btn btn-primary" style="width:100%" onclick="submitOrder()" id="submit-order-btn" disabled>
        Submit Order →
      </button>
      <div style="font-size:.75rem;color:var(--text-muted);text-align:center;margin-top:6px">
        Orders submitted before 2 PM processed same day
      </div>
    </div>
  </div>`;

  refreshCartUI();
}

let _catFilter = 'All';

function setCatFilter(el, cat) {
  _catFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  filterCatalog();
}

function filterCatalog() {
  const q = (document.getElementById('catalog-search')?.value||'').toLowerCase();
  const grid = document.getElementById('catalog-grid');
  if(!grid) return;
  const filtered = DATA.catalog.filter(item => {
    const matchCat = _catFilter==='All' || item.cat===_catFilter;
    const matchQ   = !q || item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  grid.innerHTML = filtered.length
    ? filtered.map(item => renderCatalogCard(item)).join('')
    : `<div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-title">No items found</div></div>`;
}

function renderCatalogCard(item) {
  const inCart = APP.cart.find(c=>c.sku===item.sku);
  const qty = inCart ? inCart.qty : 0;
  const isOut = item.stock===0;
  return `<div class="catalog-card" id="card-${item.sku}">
    <div class="catalog-img">${item.emoji}</div>
    <div class="catalog-name">${item.name}</div>
    <div class="catalog-sku">${item.sku}</div>
    <div class="catalog-price-row">
      <div class="catalog-price">${fmt(item.price)}</div>
      <div class="${isOut?'catalog-stock-low':'item.stock<20?catalog-stock-low:catalog-stock-ok'}">
        ${isOut?'Out of stock':item.stock<20?`Low: ${item.stock}u`:`${item.stock} in stock`}
      </div>
    </div>
    ${isOut?`<button class="btn btn-secondary" style="width:100%;font-size:.8rem;cursor:not-allowed;opacity:.5" disabled>Out of Stock</button>`:`
    <div class="catalog-qty">
      <button class="qty-btn" onclick="changeQty('${item.sku}',-1)">−</button>
      <span class="qty-val" id="qty-${item.sku}">${qty}</span>
      <button class="qty-btn" onclick="changeQty('${item.sku}',1)">+</button>
      <button class="add-btn ${qty>0?'added':''}" id="add-${item.sku}" onclick="addToCart('${item.sku}')" title="${qty>0?'In cart':'Add to cart'}">
        ${qty>0?iconCheck(12):iconPlus(12)}
      </button>
    </div>`}
  </div>`;
}

function changeQty(sku, delta) {
  const item = DATA.catalog.find(i=>i.sku===sku);
  if(!item) return;
  const existing = APP.cart.find(c=>c.sku===sku);
  const cur = existing ? existing.qty : 0;
  const newQty = Math.max(0, Math.min(cur+delta, item.max));
  if(newQty===0) {
    APP.cart = APP.cart.filter(c=>c.sku!==sku);
  } else if(existing) {
    existing.qty = newQty;
  } else if(newQty>0) {
    APP.cart.push({sku, name:item.name, emoji:item.emoji, price:item.price, qty:newQty});
  }
  const qEl = document.getElementById('qty-'+sku);
  if(qEl) qEl.textContent = newQty;
  const addEl = document.getElementById('add-'+sku);
  if(addEl) { addEl.className = `add-btn ${newQty>0?'added':''}`;addEl.innerHTML = newQty>0?iconCheck(12):iconPlus(12); }
  refreshCartUI();
}

function addToCart(sku) {
  const item = DATA.catalog.find(i=>i.sku===sku);
  if(!item || item.stock===0) return;
  const existing = APP.cart.find(c=>c.sku===sku);
  if(!existing) changeQty(sku,1);
  openCart();
}

function openCart() {
  document.getElementById('cart-panel').classList.add('open');
  document.getElementById('cart-overlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cart-panel').classList.remove('open');
  document.getElementById('cart-overlay').classList.remove('open');
}

function refreshCartUI() {
  const countEl = document.getElementById('cart-count');
  if(countEl) countEl.textContent = APP.cart.reduce((s,i)=>s+i.qty,0);

  const listEl = document.getElementById('cart-items-list');
  const submitBtn = document.getElementById('submit-order-btn');
  const summaryEl = document.getElementById('cart-summary');

  if(!listEl) return;

  if(APP.cart.length===0) {
    listEl.innerHTML = `<div class="cart-empty">Your cart is empty.<br>Add items from the catalogue.</div>`;
    if(submitBtn) submitBtn.disabled = true;
    if(summaryEl) summaryEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = APP.cart.map(c=>`
    <div class="cart-item">
      <div class="cart-item-emoji">${c.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-price">${fmt(c.price)} / unit</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" style="width:22px;height:22px;font-size:.8rem" onclick="changeQty('${c.sku}',-1)">−</button>
        <span>${c.qty}</span>
        <button class="qty-btn" style="width:22px;height:22px;font-size:.8rem" onclick="changeQty('${c.sku}',1)">+</button>
      </div>
      <div class="cart-item-total">${fmt(c.price*c.qty)}</div>
    </div>`).join('');

  const subtotal = APP.cart.reduce((s,c)=>s+(c.price*c.qty),0);
  const gst = Math.round(subtotal*0.18);
  const total = subtotal+gst;

  if(summaryEl) summaryEl.innerHTML = `
    <div class="cart-row"><span>Subtotal (${APP.cart.reduce((s,c)=>s+c.qty,0)} items)</span><span>${fmt(subtotal)}</span></div>
    <div class="cart-row"><span>GST (18%)</span><span>${fmt(gst)}</span></div>
    <div class="cart-row total"><span>Total</span><span>${fmt(total)}</span></div>`;

  const hintEl = document.getElementById('approval-hint');
  if(hintEl) hintEl.className = `cart-approval-hint ${total>100000?'show':''}`;
  if(submitBtn) submitBtn.disabled = false;
}

function quickReorder() {
  APP.cart = [
    {sku:'SP-001',name:'Premium Coffee Beans',  emoji:'☕',price:1100,qty:5},
    {sku:'SP-002',name:'Assorted Nuts Mix',      emoji:'🥜',price:450, qty:10},
    {sku:'SP-006',name:'Mineral Water 1L (case)',emoji:'💧',price:280, qty:20},
  ];
  document.querySelectorAll('.catalog-grid').forEach(()=>{});
  filterCatalog();
  refreshCartUI();
  openCart();
  showToast('Last order items loaded into cart');
}

function submitOrder() {
  if(APP.cart.length===0) return;
  const total = APP.cart.reduce((s,c)=>s+(c.price*c.qty),0)*1.18;
  const needsApproval = total > 100000;
  closeCart();
  openModal('Confirm Order Submission',`
    <div class="alert ${needsApproval?'alert-warning':'alert-success'}">
      ${needsApproval
        ? `⚠ Order value (${fmt(Math.round(total))}) exceeds threshold — this order will be routed to your Client Approver before submission to 4SYZ.`
        : `✓ Order will be submitted directly to 4SYZ for acknowledgement.`}
    </div>
    <div class="form-section-title">Order Summary</div>
    ${APP.cart.map(c=>`<div class="data-row"><span>${c.emoji} ${c.name} × ${c.qty}</span><span>${fmt(c.price*c.qty)}</span></div>`).join('')}
    <div class="data-row" style="font-weight:700;font-size:.95rem;margin-top:4px;border-top:2px solid var(--border)"><span>Total (incl. GST)</span><span style="color:var(--navy)">${fmt(Math.round(total))}</span></div>
    <div class="form-field" style="margin-top:14px"><label>Delivery Note (optional)</label><textarea placeholder="Special instructions for this order..."></textarea></div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Back to Cart</button>
   <button class="btn btn-primary" onclick="confirmSubmit()">${needsApproval?'Submit for Approval →':'Submit Order →'}</button>`);
}

function confirmSubmit() {
  APP.cart = [];
  closeModal();
  showToast('Order SP-2406-0892 submitted successfully');
  navigate('my_orders');
}

/* ============================================================
   SCREEN 1.3 — My Orders & Order Tracking
   ============================================================ */
function renderMyOrders(el) {
  el.innerHTML = `
  ${pageHeader('My Orders','All orders for Meta Bangalore HQ',`
    <button class="btn btn-secondary">${iconDownload(14)} Export</button>
    <button class="btn btn-gold" onclick="navigate('place_order')">${iconPlus(14)} New Order</button>
  `)}
  <div class="filters-bar">
    <input class="filter-input" placeholder="Search order ID..." style="width:200px"/>
    <select class="filter-select"><option>All Status</option>
      ${['SUBMITTED','ACKNOWLEDGED','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'].map(s=>`<option>${s}</option>`).join('')}
    </select>
    <select class="filter-select"><option>All Types</option><option>Standard</option><option>Recurring</option><option>Emergency</option></select>
    <input class="filter-input" type="date" style="width:160px"/>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Order ID</th><th>Client</th><th>Type</th><th>Items</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${DATA.orders.map(o=>`<tr>
              <td><span style="font-weight:700;color:var(--navy);cursor:pointer" onclick="viewOrder('${o.id}')">${o.id}</span></td>
              <td style="font-size:.82rem">${o.client}</td>
              <td>${badge(o.type, o.type==='Emergency'?'danger':o.type==='Event'?'purple':'secondary')}</td>
              <td style="text-align:center">${o.items}</td>
              <td style="font-weight:600">${fmt(o.amount)}</td>
              <td style="font-size:.82rem;color:var(--text-muted)">${o.date}</td>
              <td>${orderStatusBadge(o.status)}</td>
              <td>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="viewOrder('${o.id}')" title="View">${iconEye(13)}</button>
                  ${o.status==='SUBMITTED'?`<button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">Cancel</button>`:''}
                  <button class="btn btn-secondary btn-sm btn-icon" title="Download">${iconDownload(13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.82rem;color:var(--text-muted)">Showing ${DATA.orders.length} orders</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm">← Prev</button>
        <button class="btn btn-primary btn-sm">1</button>
        <button class="btn btn-secondary btn-sm">2</button>
        <button class="btn btn-secondary btn-sm">Next →</button>
      </div>
    </div>
  </div>`;
}

function viewOrder(id) {
  const o = DATA.orders.find(x=>x.id===id);
  if(!o) return;
  const steps = ['SUBMITTED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','IN_SHIPMENT','CLOSED'];
  const cur = steps.indexOf(o.status);
  openModal(`Order Detail — ${id}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      ${[['Order ID',o.id],['Client',o.client],['Type',o.type],['Date',o.date],['Items',o.items],['Amount',fmt(o.amount)]
      ].map(([l,v])=>`<div class="data-row"><span class="data-label">${l}</span><span class="data-value">${v}</span></div>`).join('')}
    </div>
    <div class="form-section-title">Order Status</div>
    <div style="display:flex;align-items:center;margin:12px 0;overflow-x:auto;gap:0">
      ${steps.map((s,i)=>{
        const done = cur>i, active=cur===i;
        return `<div style="display:flex;align-items:center;flex:1;min-width:70px">
          <div style="display:flex;flex-direction:column;align-items:center;flex:1">
            <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:white;background:${done?'var(--success)':active?'var(--navy)':'var(--border-mid)'}">${done?'✓':i+1}</div>
            <div style="font-size:.63rem;color:var(--text-muted);text-align:center;margin-top:4px;line-height:1.2">${s.replace(/_/g,' ')}</div>
          </div>
          ${i<steps.length-1?`<div style="height:2px;width:100%;background:${cur>i?'var(--success)':'var(--border)'};margin-top:-12px"></div>`:''}
        </div>`;
      }).join('')}
    </div>
    <div class="form-section-title">Line Items (sample)</div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>☕ Premium Coffee Beans</td><td>5</td><td>Kg</td><td>₹1,100</td><td>₹5,500</td><td>${badge('Delivered','success')}</td></tr>
      <tr><td>🥜 Assorted Nuts Mix</td><td>10</td><td>Pkt</td><td>₹450</td><td>₹4,500</td><td>${badge('In Shipment','gold')}</td></tr>
      <tr><td>💧 Mineral Water 1L</td><td>50</td><td>Cases</td><td>₹280</td><td>₹14,000</td><td>${badge('Pending','warning')}</td></tr>
    </tbody></table>`);
}

function cancelOrder(id) {
  openModal('Cancel Order',`
    <div class="alert alert-warning">You are cancelling order <strong>${id}</strong>. This action cannot be undone.</div>
    <div class="form-field"><label>Reason for Cancellation *</label>
      <select><option>Order placed by mistake</option><option>Items no longer needed</option><option>Duplicate order</option><option>Other</option></select>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Keep Order</button>
   <button class="btn btn-danger" onclick="closeModal();showToast('Order ${id} cancelled')">${iconX(14)} Cancel Order</button>`);
}

function renderTrackDelivery(el) {
  el.innerHTML = `
  ${pageHeader('Track Delivery','Live delivery status for your orders','')}
  ${DATA.orders.filter(o=>['IN_SHIPMENT','PARTIALLY_CLOSED','ACKNOWLEDGED','VENDOR_PO_RAISED'].includes(o.status)).map(o=>`
  <div class="card" style="margin-bottom:14px">
    <div class="card-header">
      <div>
        <span style="font-weight:700;color:var(--navy)">${o.id}</span>
        <span style="font-size:.82rem;color:var(--text-muted);margin-left:10px">${o.client}</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        ${orderStatusBadge(o.status)}
        <span style="font-size:.82rem;font-weight:600">${fmt(o.amount)}</span>
      </div>
    </div>
    <div class="card-body">
      <div style="display:flex;align-items:center;overflow-x:auto;gap:0;margin-bottom:14px">
        ${['Submitted','Acknowledged','PO Raised','Dispatched','Delivered'].map((s,i)=>{
          const prog = {'ACKNOWLEDGED':1,'VENDOR_PO_RAISED':2,'IN_SHIPMENT':3,'PARTIALLY_CLOSED':3,'CLOSED':4}[o.status]||0;
          const done=prog>i, active=prog===i;
          return `<div style="display:flex;align-items:center;flex:1;min-width:60px">
            <div style="display:flex;flex-direction:column;align-items:center;flex:1">
              <div style="width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:700;color:white;background:${done?'var(--success)':active?'var(--navy)':'var(--border-mid)'}">${done?'✓':i+1}</div>
              <div style="font-size:.65rem;color:var(--text-muted);text-align:center;margin-top:3px">${s}</div>
            </div>
            ${i<4?`<div style="height:2px;flex:1;background:${done?'var(--success)':'var(--border)'};margin-top:-8px"></div>`:''}
          </div>`;
        }).join('')}
      </div>
      <div class="grid-3" style="gap:10px">
        <div class="data-row"><span class="data-label">Est. Delivery</span><span class="data-value">Jun 23, 2026</span></div>
        <div class="data-row"><span class="data-label">Driver</span><span class="data-value">Ramesh K. · +91 9812345678</span></div>
        <div class="data-row"><span class="data-label">Vehicle</span><span class="data-value">KA01MX4521</span></div>
      </div>
    </div>
  </div>`).join('')}`;
}

/* ============================================================
   SCREEN 2.2 — Order Management Queue (Ops)
   ============================================================ */
function renderOrderQueue(el) {
  el.innerHTML = `
  ${pageHeader('Order Management','All orders across clients',`
    <button class="btn btn-secondary">${iconDownload(14)} Export CSV</button>
    <button class="btn btn-secondary">${iconFilter(14)} Filter</button>
    <button class="btn btn-gold" onclick="navigate('procurement')">${iconProcure(14)} Raise PO</button>
  `)}
  <div class="filters-bar">
    <input class="filter-input" placeholder="Search order / client..." style="width:220px"/>
    <select class="filter-select">
      <option>All Status</option>
      ${['SUBMITTED','ACKNOWLEDGED','PENDING_APPROVAL','APPROVED','IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','CANCELLED'].map(s=>`<option value="${s}">${s.replace(/_/g,' ')}</option>`).join('')}
    </select>
    <select class="filter-select"><option>All Clients</option><option>Meta</option><option>LinkedIn</option><option>ServiceNow</option><option>Sodexo</option></select>
    <select class="filter-select"><option>All Types</option><option>Standard</option><option>Emergency</option><option>Event</option></select>
    <input class="filter-input" type="date" style="width:145px"/>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th><input type="checkbox" /></th>
            <th>Order ID</th><th>Client</th><th>Type</th><th>Items</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${DATA.orders.map(o=>`<tr>
              <td><input type="checkbox"/></td>
              <td><span style="font-weight:700;color:var(--navy);cursor:pointer" onclick="viewOrder('${o.id}')">${o.id}</span></td>
              <td><div style="font-size:.84rem;font-weight:500">${o.client}</div></td>
              <td>${badge(o.type,o.type==='Emergency'?'danger':o.type==='Event'?'purple':'secondary')}</td>
              <td style="text-align:center;font-weight:500">${o.items}</td>
              <td style="font-weight:600">${fmt(o.amount)}</td>
              <td style="font-size:.82rem;color:var(--text-muted)">${o.date}</td>
              <td>${orderStatusBadge(o.status)}</td>
              <td>
                <div style="display:flex;gap:5px">
                  ${o.status==='SUBMITTED'?`<button class="btn btn-primary btn-sm" onclick="acknowledgeOrder('${o.id}')">Acknowledge</button>`:''}
                  ${o.status==='ACKNOWLEDGED'?`<button class="btn btn-gold btn-sm">Raise PO</button>`:''}
                  ${o.status==='IN_SHIPMENT'?`<button class="btn btn-success btn-sm">Close</button>`:''}
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="viewOrder('${o.id}')">${iconEye(13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.82rem;color:var(--text-muted)">${DATA.orders.length} orders · ${DATA.orders.filter(o=>o.status==='SUBMITTED').length} need action</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm">← Prev</button>
        <button class="btn btn-primary btn-sm">1</button>
        <button class="btn btn-secondary btn-sm">2</button>
        <button class="btn btn-secondary btn-sm">Next →</button>
      </div>
    </div>
  </div>`;
}

function acknowledgeOrder(id) {
  openModal(`Acknowledge Order ${id}`,`
    <div class="alert alert-info">Acknowledging this order triggers an automatic inventory check and notifies the client.</div>
    <div class="form-row">
      <div class="form-field"><label>Estimated Delivery Date *</label><input type="date" value="2026-06-23"/></div>
      <div class="form-field"><label>Assigned Warehouse</label><select><option>Bangalore WH-1</option><option>Hyderabad WH-2</option></select></div>
    </div>
    <div class="form-field"><label>Internal Notes</label><textarea placeholder="Notes for warehouse / procurement team..."></textarea></div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('Order ${id} acknowledged — inventory check triggered')">${iconCheck(14)} Acknowledge</button>`);
}

/* ============================================================
   SCREEN 2.3 — DC Billing Tracker
   ============================================================ */
function renderDCBilling(el) {
  el.innerHTML = `
  ${pageHeader('DC Billing Tracker','Delivery Challans · Billing Pipeline',`
    <button class="btn btn-secondary">${iconDownload(14)} Export</button>
    <button class="btn btn-gold">${iconPlus(14)} Generate Invoice</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card kpi-warning"><div class="kpi-label">DC Pending Billing</div><div class="kpi-value">27</div><div class="kpi-sub">₹38.2L outstanding</div></div>
    <div class="kpi-card"><div class="kpi-label">Billed This Month</div><div class="kpi-value">₹84.6L</div><div class="kpi-change up">▲ 14%</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Overdue DCs</div><div class="kpi-value">4</div><div class="kpi-sub">Beyond 3 days</div></div>
    <div class="kpi-card"><div class="kpi-label">Invoices Pending</div><div class="kpi-value">11</div><div class="kpi-sub">Awaiting issue</div></div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr><th>DC No.</th><th>Order Ref</th><th>Client</th><th>Delivery Date</th><th>DC Amount</th><th>DC Status</th><th>Billing Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${DATA.dcs.map(dc=>`<tr>
              <td><span style="font-weight:700;color:var(--navy)">${dc.id}</span></td>
              <td style="font-size:.82rem;color:var(--text-muted)">${dc.order}</td>
              <td style="font-size:.84rem">${dc.client}</td>
              <td style="font-size:.82rem">${dc.date}</td>
              <td style="font-weight:600">${fmt(dc.amount)}</td>
              <td>${badge(dc.status.replace(/_/g,' '),dc.status==='DELIVERED'?'success':'warning')}</td>
              <td>${badge(dc.billing,dc.billing==='BILLED'?'primary':dc.billing==='INVOICED'?'success':dc.billing==='OVERDUE'?'danger':'warning')}</td>
              <td>
                <div style="display:flex;gap:5px">
                  ${dc.billing==='PENDING'||dc.billing==='OVERDUE'?`<button class="btn btn-gold btn-sm" onclick="billDC('${dc.id}')">Bill DC</button>`:''}
                  ${dc.billing==='BILLED'?`<button class="btn btn-primary btn-sm">Generate Invoice</button>`:''}
                  <button class="btn btn-secondary btn-sm btn-icon">${iconEye(13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function billDC(id) {
  openModal(`Bill DC ${id}`,`
    <div class="form-row">
      <div class="form-field"><label>Bill Date *</label><input type="date" value="2026-06-21"/></div>
      <div class="form-field"><label>Billing Period</label><input value="June 2026"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>DC Amount</label><input value="₹2,18,900" readonly style="background:var(--bg)"/></div>
      <div class="form-field"><label>GST Amount (18%)</label><input value="₹39,402" readonly style="background:var(--bg)"/></div>
    </div>
    <div class="form-field"><label>Notes</label><textarea placeholder="Billing notes..."></textarea></div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('DC ${id} billed successfully')">${iconCheck(14)} Confirm Billing</button>`);
}

/* ============================================================
   Inventory Management
   ============================================================ */
function renderInventory(el) {
  el.innerHTML = `
  ${pageHeader('Inventory Management','Stock levels across all warehouses',`
    <button class="btn btn-secondary">${iconDownload(14)} Export</button>
    <button class="btn btn-secondary">${iconUpload(14)} Bulk Import</button>
    <button class="btn btn-gold" onclick="addItem()">${iconPlus(14)} Add Item</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Total SKUs</div><div class="kpi-value">1,284</div><div class="kpi-sub">Across 3 warehouses</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Low Stock</div><div class="kpi-value">18</div><div class="kpi-sub">Below reorder level</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Out of Stock</div><div class="kpi-value">3</div><div class="kpi-sub">Need urgent PO</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Healthy Stock</div><div class="kpi-value">1,263</div><div class="kpi-sub">Above reorder level</div></div>
  </div>
  <div class="filters-bar">
    <input class="filter-input" placeholder="Search SKU / item name..." style="width:220px"/>
    <select class="filter-select"><option>All Categories</option><option>Beverages</option><option>Snacks</option><option>Cleaning</option><option>Dry Goods</option><option>Housekeeping</option></select>
    <select class="filter-select"><option>All Status</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select>
    <select class="filter-select"><option>All Warehouses</option><option>Bangalore WH-1</option><option>Hyderabad WH-2</option><option>Mumbai WH-3</option></select>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>SKU</th><th>Item Name</th><th>Category</th><th>Brand</th>
            <th>Current Stock</th><th>Reorder Level</th><th>Stock Level</th>
            <th>Cost Price</th><th>Selling Price</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${DATA.inventory.map(item=>{
              const pct = item.stock===0?0:Math.min(100,Math.round(item.stock/item.reorder*50));
              const col = item.status==='out'?'prog-red':item.status==='low'?'prog-gold':'prog-green';
              return `<tr>
                <td><span style="font-size:.8rem;color:var(--text-muted)">${item.sku}</span></td>
                <td><span style="font-weight:600;font-size:.85rem">${item.name}</span></td>
                <td><span class="badge badge-secondary">${item.cat}</span></td>
                <td style="font-size:.82rem">${item.brand}</td>
                <td style="font-weight:700;font-size:.9rem;color:${item.status==='out'?'var(--danger)':item.status==='low'?'var(--warning)':'var(--navy)'}">${item.stock}</td>
                <td style="font-size:.82rem;color:var(--text-muted)">${item.reorder}</td>
                <td style="min-width:80px">
                  <div class="progress"><div class="progress-fill ${col}" style="width:${pct}%"></div></div>
                </td>
                <td style="font-size:.82rem">${fmt(item.cost)}</td>
                <td style="font-size:.82rem;font-weight:600">${fmt(item.price)}</td>
                <td>${stockBadge(item.status)}</td>
                <td>
                  <div style="display:flex;gap:5px">
                    ${item.status!=='ok'?`<button class="btn btn-gold btn-sm" onclick="reorderItem('${item.sku}')">Reorder</button>`:''}
                    <button class="btn btn-secondary btn-sm btn-icon" onclick="editItem('${item.sku}')">${iconSettings(13)}</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function addItem() {
  openModal('Add New Item',`
    <div class="tabs" style="margin-bottom:16px">
      ${['Product Info','Identification','Pricing','Inventory','Vendors','Compliance'].map((t,i)=>`
        <button class="tab-btn ${i===0?'active':''}" onclick="this.parentElement.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">${t}</button>
      `).join('')}
    </div>
    <div class="form-row">
      <div class="form-field"><label>Item Name *</label><input placeholder="e.g. Premium Coffee Beans"/></div>
      <div class="form-field"><label>Brand *</label><input placeholder="e.g. Blue Tokai"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Category *</label>
        <select><option>Beverages</option><option>Snacks</option><option>Cleaning</option><option>Dry Goods</option><option>Housekeeping</option><option>Stationery</option></select>
      </div>
      <div class="form-field"><label>Sub-Category *</label>
        <select><option>Healthy</option><option>Normal</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>SKU / Item Code *</label><input placeholder="SP-XXX"/></div>
      <div class="form-field"><label>EAN Code</label><input placeholder="13-digit barcode"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Unit of Measure *</label>
        <select><option>Kg</option><option>Litre</option><option>Packet</option><option>Box</option><option>Bottle</option><option>Unit</option></select>
      </div>
      <div class="form-field"><label>Status</label>
        <select><option>Active</option><option>Inactive</option></select>
      </div>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('Item saved to Item Master')">${iconCheck(14)} Save Item</button>`);
}

function reorderItem(sku) {
  const item = DATA.inventory.find(i=>i.sku===sku);
  openModal(`Raise PO — ${item?.name||sku}`,`
    <div class="alert alert-warning">Stock is ${item?.status==='out'?'OUT OF STOCK':'LOW'}. Select vendor and confirm reorder quantity.</div>
    <div class="form-row">
      <div class="form-field"><label>Primary Vendor</label><select>${DATA.vendors.map(v=>`<option>${v.name}</option>`).join('')}</select></div>
      <div class="form-field"><label>Reorder Quantity *</label><input type="number" value="${item?.reorder||50}"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Required By Date *</label><input type="date" value="2026-06-24"/></div>
      <div class="form-field"><label>Delivery Warehouse</label><select><option>Bangalore WH-1</option><option>Hyderabad WH-2</option></select></div>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('PO raised for ${item?.name||sku}')">${iconCheck(14)} Raise PO</button>`);
}

function editItem(sku) { addItem(); }

/* ============================================================
   Vendors
   ============================================================ */
function renderVendors(el) {
  el.innerHTML = `
  ${pageHeader('Vendor Management','Supplier directory & performance',`
    <button class="btn btn-secondary">${iconDownload(14)} Export</button>
    <button class="btn btn-gold" onclick="addVendor()">${iconPlus(14)} Add Vendor</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Active Vendors</div><div class="kpi-value">24</div><div class="kpi-sub">Across 8 categories</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Avg On-Time Rate</div><div class="kpi-value">91.2%</div><div class="kpi-change up">▲ 2.1pp</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Lead Time</div><div class="kpi-value">2.8d</div><div class="kpi-sub">Target: ≤ 3 days</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">POs Pending</div><div class="kpi-value">7</div><div class="kpi-sub">Awaiting acceptance</div></div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Vendor</th><th>Category</th><th>Contact</th>
            <th>On-Time Rate</th><th>Avg Lead Time</th><th>Fill Rate</th>
            <th>Active POs</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${DATA.vendors.map(v=>`<tr>
              <td>
                <div style="font-weight:700;font-size:.88rem">${v.name}</div>
                <div style="font-size:.74rem;color:var(--text-muted)">${v.id}</div>
              </td>
              <td><span class="badge badge-secondary">${v.category}</span></td>
              <td>
                <div style="font-size:.82rem">${v.contact}</div>
                <div style="font-size:.74rem;color:var(--text-muted)">${v.email}</div>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div class="progress" style="width:60px"><div class="progress-fill ${v.ontime>=90?'prog-green':v.ontime>=80?'prog-gold':'prog-red'}" style="width:${v.ontime}%"></div></div>
                  <span style="font-weight:700;font-size:.85rem;color:${v.ontime>=90?'var(--success)':v.ontime>=80?'var(--warning)':'var(--danger)'}">${v.ontime}%</span>
                </div>
              </td>
              <td style="font-weight:600">${v.leadtime}d</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div class="progress" style="width:60px"><div class="progress-fill prog-green" style="width:${v.fillrate}%"></div></div>
                  <span style="font-size:.85rem;font-weight:700">${v.fillrate}%</span>
                </div>
              </td>
              <td style="text-align:center">
                <span style="font-weight:700">${v.pos}</span>
                ${v.pending>0?`<span class="badge badge-warning" style="margin-left:4px">${v.pending} pending</span>`:''}
              </td>
              <td>
                <div style="display:flex;gap:5px">
                  <button class="btn btn-primary btn-sm" onclick="newPO('${v.id}')">New PO</button>
                  <button class="btn btn-secondary btn-sm btn-icon" onclick="viewVendor('${v.id}')">${iconEye(13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function addVendor() {
  openModal('Add New Vendor',`
    <div class="form-row">
      <div class="form-field"><label>Company Name *</label><input placeholder="Vendor company name"/></div>
      <div class="form-field"><label>Category *</label><select>${['Fruits & Vegetables','Beverages','Snacks','Cleaning','Dairy','Dry Goods'].map(c=>`<option>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Contact Person *</label><input placeholder="Account manager name"/></div>
      <div class="form-field"><label>Contact Phone *</label><input placeholder="+91 XXXXXXXXXX"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>Email *</label><input type="email" placeholder="vendor@company.com"/></div>
      <div class="form-field"><label>WhatsApp</label><input placeholder="+91 XXXXXXXXXX"/></div>
    </div>
    <div class="form-row">
      <div class="form-field"><label>GST Number *</label><input placeholder="22AAAAA0000A1Z5"/></div>
      <div class="form-field"><label>Avg Lead Time (days)</label><input type="number" placeholder="3"/></div>
    </div>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('Vendor added — welcome email sent with credentials')">${iconCheck(14)} Add Vendor</button>`);
}

function viewVendor(id) {
  const v = DATA.vendors.find(x=>x.id===id);
  if(!v) return;
  openModal(`Vendor Profile — ${v.name}`,`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      ${[['Vendor ID',v.id],['Category',v.category],['Contact',v.contact],['Email',v.email],
         ['On-Time Rate',v.ontime+'%'],['Avg Lead Time',v.leadtime+'d'],['Fill Rate',v.fillrate+'%'],['Active POs',v.pos]
      ].map(([l,val])=>`<div class="data-row"><span class="data-label">${l}</span><span class="data-value">${val}</span></div>`).join('')}
    </div>
    <div class="form-section-title">Performance Scorecard</div>
    ${[['On-Time Delivery Rate',v.ontime],['PO Fill Rate',v.fillrate],['Response Time Score',88],['Invoice Accuracy',96]].map(([l,val])=>`
    <div class="score-component">
      <span class="score-label">${l}</span>
      <div class="progress" style="flex:1"><div class="progress-fill ${val>=90?'prog-green':val>=80?'prog-gold':'prog-red'}" style="width:${val}%"></div></div>
      <span class="score-val">${val}%</span>
    </div>`).join('')}`);
}

function newPO(vendorId) {
  const v = DATA.vendors.find(x=>x.id===vendorId);
  openModal(`New Purchase Order — ${v?.name||vendorId}`,`
    <div class="form-row">
      <div class="form-field"><label>Order Reference</label><select>${DATA.orders.filter(o=>['ACKNOWLEDGED','VENDOR_PO_RAISED'].includes(o.status)).map(o=>`<option>${o.id} — ${o.client}</option>`).join('')}</select></div>
      <div class="form-field"><label>Required Delivery Date *</label><input type="date" value="2026-06-24"/></div>
    </div>
    <div class="form-section-title">Line Items</div>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Rate (₹)</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td><select style="font-size:.82rem;border:1px solid var(--border);border-radius:4px;padding:3px">${DATA.inventory.map(i=>`<option>${i.name}</option>`).join('')}</select></td>
      <td><input type="number" value="10" style="width:60px;border:1px solid var(--border);border-radius:4px;padding:3px"/></td>
      <td>Kg</td><td><input type="number" value="850" style="width:70px;border:1px solid var(--border);border-radius:4px;padding:3px"/></td>
      <td style="font-weight:600">₹8,500</td></tr>
    </tbody></table>
    <button class="btn btn-secondary btn-sm" style="margin-top:8px">${iconPlus(12)} Add Line</button>`,
  `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="closeModal();showToast('PO raised — vendor notified via portal & email')">${iconCheck(14)} Send PO to Vendor</button>`);
}

/* ============================================================
   Procurement
   ============================================================ */
function renderProcurement(el) {
  el.innerHTML = `
  ${pageHeader('Procurement Dashboard','Vendor POs & RFQ management',`
    <button class="btn btn-gold" onclick="newPO('V-001')">${iconPlus(14)} New PO</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Vendor POs</div><div class="kpi-value">7</div><div class="kpi-sub">Awaiting acceptance</div></div>
    <div class="kpi-card"><div class="kpi-label">Active POs</div><div class="kpi-value">31</div><div class="kpi-sub">In progress</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Fill Rate (MTD)</div><div class="kpi-value">94.2%</div><div class="kpi-change up">▲ 1.8pp</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Stock-Out Incidents</div><div class="kpi-value">3</div><div class="kpi-sub">This month</div></div>
  </div>
  <div class="charts-grid" style="margin-bottom:16px">
    <div class="chart-card">
      <div class="chart-title">Vendor On-Time Delivery Rate</div>
      <div class="chart-wrap"><canvas id="vendor-perf-chart"></canvas></div>
    </div>
    <div class="chart-card">
      <div class="chart-title">PO Aging
        <div style="display:flex;gap:10px;font-size:.75rem">
          <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--success);border-radius:2px"></span>0-3d</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--gold);border-radius:2px"></span>3-7d</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:var(--danger);border-radius:2px"></span>7d+</span>
        </div>
      </div>
      <div class="chart-wrap"><canvas id="po-aging-chart"></canvas></div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Purchase Orders</span></div>
    <div class="card-body" style="padding:0">
      <div class="table-wrap">
        <table>
          <thead><tr><th>PO No.</th><th>Vendor</th><th>Order Ref</th><th>Lines</th><th>Value</th><th>Required By</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${DATA.pos.map(po=>`<tr>
              <td><span style="font-weight:700;color:var(--navy)">${po.id}</span></td>
              <td style="font-size:.84rem">${po.vendor}</td>
              <td style="font-size:.82rem;color:var(--text-muted)">${po.order}</td>
              <td style="text-align:center">${po.items}</td>
              <td style="font-weight:600">${fmt(po.amount)}</td>
              <td style="font-size:.82rem">${po.required}</td>
              <td>${poStatusBadge(po.status)}</td>
              <td><div style="display:flex;gap:5px">
                <button class="btn btn-secondary btn-sm btn-icon" onclick="viewPO('${po.id}')">${iconEye(13)}</button>
                ${po.status==='ACCEPTED'?`<button class="btn btn-gold btn-sm">${iconTruck(13)} Track</button>`:''}
              </div></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;

  setTimeout(()=>{
    const ctx1 = document.getElementById('vendor-perf-chart');
    if(ctx1) APP.charts.vendPerf = new Chart(ctx1,{type:'bar',data:{
      labels:DATA.vendors.map(v=>v.name.split(' ')[0]+' '+v.name.split(' ')[1]),
      datasets:[{label:'On-Time %',data:DATA.vendors.map(v=>v.ontime),
        backgroundColor:DATA.vendors.map(v=>v.ontime>=90?'#1f8a5b':v.ontime>=80?'#c79a4b':'#c0392b'),borderRadius:4}]
    },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:70,max:100,grid:{color:'rgba(0,0,0,.05)'}},x:{grid:{display:false}}}}});

    const ctx2 = document.getElementById('po-aging-chart');
    if(ctx2) APP.charts.poAging = new Chart(ctx2,{type:'bar',data:{
      labels:DATA.vendors.map(v=>v.name.split(' ')[0]),
      datasets:[
        {label:'0-3d',data:[3,2,1,4,2],backgroundColor:'#1f8a5b',borderRadius:3},
        {label:'3-7d',data:[1,1,0,2,1],backgroundColor:'#c79a4b',borderRadius:3},
        {label:'7d+', data:[0,0,0,1,0],backgroundColor:'#c0392b',borderRadius:3},
      ]
    },options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'rgba(0,0,0,.05)'}}}}});
  },50);
}

/* ============================================================
   Remaining Screens
   ============================================================ */
function renderWarehouse(el) {
  el.innerHTML = `
  ${pageHeader('Warehouse Management','GRN, Stock Movement & Bin Management',`
    <button class="btn btn-gold">${iconPlus(14)} Record GRN</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Today's GRNs</div><div class="kpi-value">8</div><div class="kpi-sub">Goods received today</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending GRNs</div><div class="kpi-value">3</div><div class="kpi-sub">Dispatched, not received</div></div>
    <div class="kpi-card"><div class="kpi-label">Items Near Expiry</div><div class="kpi-value">12</div><div class="kpi-sub">Within 30 days</div></div>
    <div class="kpi-card"><div class="kpi-label">Stock Transfers</div><div class="kpi-value">2</div><div class="kpi-sub">Inter-warehouse today</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><span class="card-title">Recent GRNs</span><button class="btn btn-primary btn-sm">${iconPlus(13)} New GRN</button></div>
      <div class="card-body" style="padding:0">
        <table><thead><tr><th>GRN No.</th><th>PO Ref</th><th>Vendor</th><th>Items</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          ${[['GRN-0042','PO-0235','CleanPro','8 items','Jun 21',true],['GRN-0041','PO-0233','Fresh Farms','6 items','Jun 20',true],
             ['GRN-0040','PO-0232','Dairy Delight','4 items','Jun 20',true],['GRN-0039','PO-0230','Pantry Plus','5 items','Jun 19',false]
          ].map(([g,p,v,i,d,ok])=>`<tr>
            <td><span style="font-weight:700;font-size:.84rem;color:var(--navy)">${g}</span></td>
            <td style="font-size:.8rem;color:var(--text-muted)">${p}</td>
            <td style="font-size:.82rem">${v}</td>
            <td style="font-size:.82rem">${i}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${d}</td>
            <td>${badge(ok?'Received':'Partial',ok?'success':'warning')}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Warehouse Stock Summary</span></div>
      <div class="card-body">
        ${[['Bangalore WH-1',540,87],['Hyderabad WH-2',380,72],['Mumbai WH-3',220,61]].map(([w,items,util])=>`
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-weight:600;font-size:.88rem">${w}</span>
            <span style="font-size:.82rem;color:var(--text-muted)">${items} SKUs · ${util}% capacity</span>
          </div>
          <div class="progress"><div class="progress-fill ${util>80?'prog-gold':util>60?'prog-navy':'prog-green'}" style="width:${util}%"></div></div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderDelivery(el) {
  el.innerHTML = `
  ${pageHeader('Delivery Operations','Route planning & live tracking',`
    <button class="btn btn-secondary">${iconDownload(14)} Export Route Sheet</button>
    <button class="btn btn-gold">${iconPlus(14)} Add Delivery</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Deliveries Today</div><div class="kpi-value">42</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Completed</div><div class="kpi-value">37</div><div class="kpi-change up">88%</div></div>
    <div class="kpi-card kpi-danger"><div class="kpi-label">Delayed</div><div class="kpi-value">5</div></div>
    <div class="kpi-card"><div class="kpi-label">Drivers On Route</div><div class="kpi-value">8</div></div>
  </div>
  <div class="card">
    <div class="card-header"><span class="card-title">Today's Deliveries</span></div>
    <div class="card-body" style="padding:0">
      <table><thead><tr><th>DC No.</th><th>Order</th><th>Client / Location</th><th>Driver</th><th>Vehicle</th><th>ETA</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${[['DC-1185','SP-2406-0888','Sodexo Hyderabad','Ramesh K.','KA01MX4521','2:30 PM','DELIVERED'],
           ['DC-1183','SP-2406-0886','LinkedIn Mumbai','Suresh P.','MH02CX7823','4:00 PM','IN_TRANSIT'],
           ['DC-1186','SP-2406-0891','Meta Bangalore','Arjun M.','KA03AB1234','5:30 PM','DELAYED'],
           ['DC-1187','SP-2406-0890','LinkedIn Pune','Vikram S.','MH04DE5678','6:00 PM','PENDING']
        ].map(([dc,order,client,driver,vehicle,eta,status])=>`<tr>
          <td><span style="font-weight:700;color:var(--navy)">${dc}</span></td>
          <td style="font-size:.82rem;color:var(--text-muted)">${order}</td>
          <td style="font-size:.84rem">${client}</td>
          <td style="font-size:.82rem">${driver}</td>
          <td style="font-size:.8rem;color:var(--text-muted)">${vehicle}</td>
          <td style="font-weight:600;font-size:.85rem">${eta}</td>
          <td>${badge(status.replace(/_/g,' '),status==='DELIVERED'?'success':status==='DELAYED'?'danger':status==='IN_TRANSIT'?'gold':'secondary')}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn btn-secondary btn-sm btn-icon">${iconEye(13)}</button>
            ${status!=='DELIVERED'?`<button class="btn btn-primary btn-sm">${iconTruck(13)} Update</button>`:''}
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function renderClients(el) {
  el.innerHTML = `
  ${pageHeader('Client Management','Corporate client directory',`
    <button class="btn btn-gold">${iconPlus(14)} Onboard Client</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Active Clients</div><div class="kpi-value">47</div><div class="kpi-sub">3 new this month</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Onboarding</div><div class="kpi-value">5</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Avg Health Score</div><div class="kpi-value">84</div></div>
    <div class="kpi-card"><div class="kpi-label">Revenue MTD</div><div class="kpi-value">₹84.6L</div></div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table><thead><tr><th>Client</th><th>Locations</th><th>Monthly Budget</th><th>Spend MTD</th><th>Health Score</th><th>Orders MTD</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${[['Meta India','Bangalore, Pune, Mumbai','₹25L','₹18.4L',92,38],
           ['LinkedIn India','Pune, Mumbai, Delhi','₹18L','₹14.2L',86,29],
           ['ServiceNow','Bangalore, Delhi','₹12L','₹9.8L',78,21],
           ['Sodexo','Hyderabad, Chennai','₹10L','₹8.1L',88,18],
           ['Freshworks','Chennai, Bangalore','₹8L','₹5.4L',73,14],
        ].map(([name,locs,budget,spend,score,orders])=>`<tr>
          <td><div style="font-weight:700;font-size:.88rem">${name}</div><div style="font-size:.74rem;color:var(--text-muted)">${locs}</div></td>
          <td style="font-size:.82rem">${locs.split(',').length}</td>
          <td style="font-weight:600">${budget}</td>
          <td style="font-weight:600">${spend}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="progress" style="width:50px"><div class="progress-fill ${score>=85?'prog-green':score>=75?'prog-gold':'prog-red'}" style="width:${score}%"></div></div>
              <span style="font-weight:700;font-size:.85rem">${score}</span>
            </div>
          </td>
          <td style="text-align:center;font-weight:600">${orders}</td>
          <td>${badge('Active','success')}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn btn-secondary btn-sm btn-icon">${iconEye(13)}</button>
            <button class="btn btn-primary btn-sm">Manage</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function renderServiceDesk(el) {
  el.innerHTML = `
  ${pageHeader('Service Desk','Support tickets & escalations',`
    <button class="btn btn-gold">${iconPlus(14)} New Ticket</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card kpi-danger"><div class="kpi-label">Open Tickets</div><div class="kpi-value">12</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">In Progress</div><div class="kpi-value">8</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Resolved Today</div><div class="kpi-value">6</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Resolution</div><div class="kpi-value">4.2h</div></div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table><thead><tr><th>Ticket ID</th><th>Subject</th><th>Client</th><th>Priority</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${[['TK-0512','Missing items in delivery SP-2406-0886','LinkedIn Mumbai','High','Jun 21','Open'],
           ['TK-0511','Invoice discrepancy for DC-1184','Meta Bangalore','Medium','Jun 20','In Progress'],
           ['TK-0510','Standing order date change request','ServiceNow Delhi','Low','Jun 20','Open'],
           ['TK-0509','New location add request — Pune 2','LinkedIn India','Medium','Jun 19','Resolved'],
        ].map(([id,sub,client,pri,date,status])=>`<tr>
          <td><span style="font-weight:700;color:var(--navy)">${id}</span></td>
          <td style="font-size:.84rem;max-width:240px">${sub}</td>
          <td style="font-size:.82rem">${client}</td>
          <td>${badge(pri,pri==='High'?'danger':pri==='Medium'?'warning':'secondary')}</td>
          <td style="font-size:.8rem;color:var(--text-muted)">${date}</td>
          <td>${badge(status,status==='Resolved'?'success':status==='In Progress'?'gold':'danger')}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn btn-secondary btn-sm btn-icon">${iconEye(13)}</button>
            ${status!=='Resolved'?`<button class="btn btn-primary btn-sm">Respond</button>`:''}
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function renderReports(el) {
  el.innerHTML = `
  ${pageHeader('Reports & Analytics','Business intelligence & exports',`
    <button class="btn btn-secondary">${iconDownload(14)} Export All</button>
  `)}
  <div class="grid-auto" style="margin-bottom:16px">
    ${[
      ['📊','Spend vs Budget','Client-wise spend analysis vs configured budgets','reports'],
      ['📦','Order vs Delivery Reconciliation','Ordered qty vs delivered qty per order','reports'],
      ['🏭','Vendor Performance Report','On-time rate, lead time, fill rate by vendor','reports'],
      ['📈','Revenue & Margin Analysis','Revenue, cost, and margin by category and period','reports'],
      ['🔄','Stock Movement Report','GRN, dispatch, and transfers by item and warehouse','reports'],
      ['🎯','Client Service Health','Service health score trend for all clients','reports'],
      ['💳','DC & Billing Summary','DC status, billing amounts, and overdue analysis','reports'],
      ['🚚','Delivery Performance','On-time delivery, delays, and route analysis','reports'],
    ].map(([icon,title,desc])=>`
    <div class="card" style="cursor:pointer;transition:box-shadow .2s" onmouseenter="this.style.boxShadow='var(--shadow-panel)'" onmouseleave="this.style.boxShadow=''">
      <div class="card-body" style="padding:18px">
        <div style="font-size:1.8rem;margin-bottom:10px">${icon}</div>
        <div style="font-weight:700;font-size:.9rem;margin-bottom:4px">${title}</div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:14px">${desc}</div>
        <button class="btn btn-secondary btn-sm">${iconDownload(13)} Export</button>
        <button class="btn btn-primary btn-sm" style="margin-left:6px">${iconEye(13)} View</button>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderApprovals(el) {
  el.innerHTML = `
  ${pageHeader('Pending Approvals','Orders awaiting your sign-off','')}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card kpi-warning"><div class="kpi-label">Awaiting Approval</div><div class="kpi-value">4</div></div>
    <div class="kpi-card"><div class="kpi-label">Approved Today</div><div class="kpi-value">7</div></div>
    <div class="kpi-card"><div class="kpi-label">Rejected Today</div><div class="kpi-value">1</div></div>
    <div class="kpi-card"><div class="kpi-label">Avg Approval Time</div><div class="kpi-value">18m</div></div>
  </div>
  ${DATA.orders.filter(o=>['SUBMITTED','PENDING_APPROVAL'].includes(o.status)).map(o=>`
  <div class="card" style="margin-bottom:12px">
    <div class="card-header">
      <div>
        <span style="font-weight:700;color:var(--navy)">${o.id}</span>
        <span style="font-size:.82rem;color:var(--text-muted);margin-left:10px">${o.client}</span>
        ${o.priority==='high'?badge('URGENT','danger'):''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-weight:700;font-size:.95rem">${fmt(o.amount)}</span>
        <span style="font-size:.8rem;color:var(--text-muted)">${o.items} items</span>
      </div>
    </div>
    <div class="card-body">
      <div class="approval-trail">
        <div class="approval-node">
          <div class="approval-icon appr-done">${iconCheck(13)}</div>
          <div class="approval-body">
            <div class="approval-role">Submitted by Client User</div>
            <div class="approval-info">${o.date} · Order placed via Client Portal</div>
          </div>
        </div>
        <div class="approval-node">
          <div class="approval-icon appr-pending">?</div>
          <div class="approval-body">
            <div class="approval-role">Client Approver Sign-off <span style="color:var(--warning);font-size:.75rem">(You)</span></div>
            <div class="approval-info">Awaiting your action · SLA: 4 hours remaining</div>
          </div>
        </div>
        <div class="approval-node">
          <div class="approval-icon appr-waiting">3</div>
          <div class="approval-body">
            <div class="approval-role">4SYZ Ops Acknowledgement</div>
            <div class="approval-info">Will be notified once you approve</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;justify-content:flex-end">
        <button class="btn btn-secondary" onclick="viewOrder('${o.id}')">${iconEye(14)} Review Order</button>
        <button class="btn btn-danger" onclick="showToast('Order ${o.id} rejected')">${iconX(14)} Reject</button>
        <button class="btn btn-primary" onclick="showToast('Order ${o.id} approved — submitted to 4SYZ')">${iconCheck(14)} Approve</button>
      </div>
    </div>
  </div>`).join('')}`;
}

function renderUsers(el) {
  el.innerHTML = `
  ${pageHeader('Users & Roles','Access control & user management',`
    <button class="btn btn-gold">${iconPlus(14)} Invite User</button>
  `)}
  <div class="kpi-grid" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-label">Total Users</div><div class="kpi-value">186</div></div>
    <div class="kpi-card kpi-success"><div class="kpi-label">Active</div><div class="kpi-value">172</div></div>
    <div class="kpi-card kpi-warning"><div class="kpi-label">Pending Invite</div><div class="kpi-value">8</div></div>
    <div class="kpi-card"><div class="kpi-label">Roles</div><div class="kpi-value">12</div></div>
  </div>
  <div class="card">
    <div class="card-body" style="padding:0">
      <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Organisation</th><th>Last Login</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        ${Object.entries(ROLES).map(([key,r])=>`<tr>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="width:28px;height:28px;border-radius:50%;background:var(--navy);color:var(--gold);font-size:.7rem;font-weight:800;display:flex;align-items:center;justify-content:center">${r.initials}</div>
              <span style="font-weight:600;font-size:.85rem">${r.label}</span>
            </div>
          </td>
          <td style="font-size:.82rem;color:var(--text-muted)">${key.replace(/_/g,'.')}@4syz.com</td>
          <td>${badge(r.label,'primary')}</td>
          <td style="font-size:.82rem">${r.org}</td>
          <td style="font-size:.8rem;color:var(--text-muted)">Jun 21, 2026</td>
          <td>${badge('Active','success')}</td>
          <td><div style="display:flex;gap:5px">
            <button class="btn btn-secondary btn-sm btn-icon">${iconSettings(13)}</button>
            <button class="btn btn-danger btn-sm btn-icon">${iconX(13)}</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table>
    </div>
  </div>`;
}

function renderSettings(el) {
  el.innerHTML = `
  ${pageHeader('Platform Settings','System configuration & preferences','')}
  <div class="grid-2">
    ${[
      ['Authentication','Configure MFA, SSO providers, OTP settings, and session policies.','auth'],
      ['Client Tenants','Manage client tenant configurations, budgets, and approval thresholds.','tenants'],
      ['Notifications','Configure email, SMS, and in-app notification rules and triggers.','notif'],
      ['Integrations','Zoho Books, SMS providers (Twilio/MSG91), and webhook settings.','integrations'],
      ['Warehouses','Add or edit warehouses, zones, bin locations, and capacity settings.','warehouses'],
      ['Item Categories','Manage product categories, HSN codes, and GST rates.','categories'],
    ].map(([t,d,id])=>`
    <div class="card" style="cursor:pointer">
      <div class="card-body" style="padding:20px">
        <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${t}</div>
        <div style="font-size:.84rem;color:var(--text-muted);margin-bottom:14px">${d}</div>
        <button class="btn btn-secondary btn-sm">Configure →</button>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderVendorPOs(el) { el.innerHTML = notImplemented('Confirmed POs'); }
function renderVendorInvoices(el) { el.innerHTML = notImplemented('Invoices'); }
function renderVendorPayments(el) { el.innerHTML = notImplemented('Payments'); }
