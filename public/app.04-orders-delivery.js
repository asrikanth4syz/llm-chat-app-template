/* ============================================================
   ORDERS HUB  (Phase 2 — merged Orders surfaces)
   One addressable-tab surface for the staff order views that used to be three
   separate sidebar pages: the live Queue, the Pipeline board, and Due Items.
   Tabs are deep-linkable as #orders/<tab>; each tab body is rendered by its
   existing page renderer, unchanged.
   ============================================================ */
const ORDERS_TABS = [
  { k:'queue',    label:'Queue',     fn:'renderOrderQueue',      page:'orders' },
  { k:'pipeline', label:'Pipeline',  fn:'renderPipeline',        page:'pipeline' },
  { k:'due',      label:'Due Items', fn:'renderConsolidatedDue', page:'consolidated_due' },
];
function ordersTabsForRole() { return ORDERS_TABS.filter(t => canAccessPage(t.page)); }

let _oqPhaseCssDone = false;
function injectOqPhaseCss() {
  if (_oqPhaseCssDone) return; _oqPhaseCssDone = true;
  const css = `
  .oq-phasebar{display:flex;align-items:center;gap:2px;flex-wrap:wrap}
  .oq-phase{appearance:none;background:none;border:1px solid transparent;border-radius:9px;cursor:pointer;
    display:flex;align-items:center;gap:6px;padding:7px 11px;font-size:.82rem;font-weight:700;color:var(--text-muted)}
  .oq-phase:hover{background:var(--bg,#f4f7f9);color:var(--navy,#15303d)}
  .oq-phase.on{background:color-mix(in srgb,var(--primary) 12%,transparent);border-color:color-mix(in srgb,var(--primary) 32%,transparent);color:var(--primary)}
  .oq-phase-ic{font-size:.9rem;line-height:1}
  .oq-phase-cnt{font-size:.72rem;font-weight:800;background:var(--border);color:var(--navy,#15303d);border-radius:20px;padding:1px 7px;min-width:20px;text-align:center}
  .oq-phase.on .oq-phase-cnt{background:var(--primary);color:#fff}
  .oq-phase--cancel.on{background:color-mix(in srgb,var(--danger,#ef4444) 12%,transparent);border-color:color-mix(in srgb,var(--danger,#ef4444) 32%,transparent);color:var(--danger,#ef4444)}
  .oq-phase--cancel.on .oq-phase-cnt{background:var(--danger,#ef4444)}
  .oq-phase-sep{width:14px;height:2px;background:var(--border);border-radius:2px;flex:0 0 auto}
  @media(max-width:640px){.oq-phase-sep{display:none}.oq-phase{padding:6px 9px;font-size:.78rem}}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

async function renderOrdersHub(el) {
  const tabs = ordersTabsForRole();
  // A single-tab role gets the plain page — no pointless tab bar.
  if (tabs.length <= 1) { await window[(tabs[0] || ORDERS_TABS[0]).fn](el); return; }
  injectHubCss();
  const active = routeTab('orders', tabs.map(t => t.k), tabs[0].k);
  APP._ordersTab = active;
  writeHash('orders', active);
  registerHub('orders', ordersHubTab);
  setHubBreadcrumb('orders', tabs.find(t => t.k === active).label);
  el.innerHTML = `
    <div class="hub-tabs" id="orders-hub-tabs" role="tablist" aria-label="Orders">
      ${tabs.map(t => {
        // Phase 2 (AC15): the Due Items tab carries an overdue-count badge, so the
        // at-a-glance signal that used to live on the sidebar survives the fold.
        const badge = t.k === 'due' ? `<span class="hub-badge" id="orders-due-badge" hidden></span>` : '';
        return `<button class="hub-tab ${t.k===active?'on':''}" role="tab" aria-selected="${t.k===active}" data-k="${t.k}" ${dataAct('ordersHubTab', t.k)}>${h(t.label)}${badge}</button>`;
      }).join('')}
    </div>
    <div id="orders-hub-body"><div class="loading-state"><div class="spinner"></div></div></div>`;
  // Fire-and-forget: the badge populates asynchronously and never blocks the tab body.
  if (tabs.some(t => t.k === 'due')) loadOrdersDueBadge();
  const body = document.getElementById('orders-hub-body');
  await window[tabs.find(t => t.k === active).fn](body);
}

// AC15: populate the Due Items hub-tab badge with the count of OVERDUE due items
// (rows with days_overdue > 0 from /reports/consolidated-due — the same signal the
// Due Items page uses). Uses a raw fetch (not api()) so a background badge never
// triggers api()'s error toast or 401 logout. States: count>0 → "N" (or "99+");
// count 0 → hidden; data unavailable/NaN → a distinct data-badge-state="unknown".
async function loadOrdersDueBadge() {
  let rows = null;
  try {
    const res = await fetch('/api/reports/consolidated-due', {
      headers: APP.token ? { 'Authorization': 'Bearer ' + APP.token } : {},
    });
    if (res.ok) rows = await res.json();
  } catch (_) { /* leave rows null → unknown */ }
  const el = document.getElementById('orders-due-badge');
  if (!el) return; // tab bar gone (navigated away)
  if (!Array.isArray(rows)) {
    el.hidden = true; el.textContent = ''; el.setAttribute('data-badge-state', 'unknown'); return;
  }
  const n = rows.filter(r => Number(r.days_overdue) > 0).length;
  if (!Number.isFinite(n) || n <= 0) {
    el.hidden = true; el.textContent = ''; el.setAttribute('data-badge-state', 'zero'); return;
  }
  el.textContent = n > 99 ? '99+' : String(n);
  el.hidden = false; el.setAttribute('data-badge-state', 'count');
  el.title = `${n} overdue due item${n === 1 ? '' : 's'}`;
}

async function ordersHubTab(k) {
  const tabs = ordersTabsForRole();
  if (!tabs.some(t => t.k === k)) return;
  APP._ordersTab = k;
  writeHash('orders', k);
  setHubBreadcrumb('orders', (ORDERS_TABS.find(t => t.k === k) || {}).label);
  document.querySelectorAll('#orders-hub-tabs .hub-tab').forEach(b => {
    const on = b.dataset.k === k;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const body = document.getElementById('orders-hub-body');
  if (!body) return;
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  await window[ORDERS_TABS.find(t => t.k === k).fn](body);
}

/* ============================================================
   MY ORDERS HUB  (Phase 2 — client order surfaces)
   Merges the client "My Orders" and "Track Delivery" pages into one
   addressable-tab surface (#my_orders/orders · #my_orders/tracking).
   ============================================================ */
const MYORDERS_TABS = [
  { k:'orders',   label:'My Orders',      fn:'renderMyOrders',      page:'my_orders' },
  { k:'tracking', label:'Track Delivery', fn:'renderTrackDelivery', page:'track_delivery' },
];
function myOrdersTabsForRole() { return MYORDERS_TABS.filter(t => canAccessPage(t.page)); }

async function renderMyOrdersHub(el) {
  const tabs = myOrdersTabsForRole();
  if (tabs.length <= 1) { await window[(tabs[0] || MYORDERS_TABS[0]).fn](el); return; }
  injectHubCss();
  const active = routeTab('my_orders', tabs.map(t => t.k), tabs[0].k);
  APP._myOrdersTab = active;
  writeHash('my_orders', active);
  registerHub('my_orders', myOrdersHubTab);
  setHubBreadcrumb('my_orders', tabs.find(t => t.k === active).label);
  el.innerHTML = `
    <div class="hub-tabs" id="myorders-hub-tabs" role="tablist" aria-label="My Orders">
      ${tabs.map(t => `<button class="hub-tab ${t.k===active?'on':''}" role="tab" aria-selected="${t.k===active}" data-k="${t.k}" ${dataAct('myOrdersHubTab', t.k)}>${h(t.label)}</button>`).join('')}
    </div>
    <div id="myorders-hub-body"><div class="loading-state"><div class="spinner"></div></div></div>`;
  const body = document.getElementById('myorders-hub-body');
  await window[tabs.find(t => t.k === active).fn](body);
}

async function myOrdersHubTab(k) {
  const tabs = myOrdersTabsForRole();
  if (!tabs.some(t => t.k === k)) return;
  APP._myOrdersTab = k;
  writeHash('my_orders', k);
  setHubBreadcrumb('my_orders', (MYORDERS_TABS.find(t => t.k === k) || {}).label);
  document.querySelectorAll('#myorders-hub-tabs .hub-tab').forEach(b => {
    const on = b.dataset.k === k;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const body = document.getElementById('myorders-hub-body');
  if (!body) return;
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  await window[MYORDERS_TABS.find(t => t.k === k).fn](body);
}

/* ============================================================
   MY ORDERS
   ============================================================ */
async function renderMyOrders(el) {
  const orders = await api('/orders');
  if (!orders) return;
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role);

  if (isClient) {
    const statuses = ['All','DRAFT','SUBMITTED','PARTIALLY_CLOSED','CLOSED','CANCELLED'];
    // Client-facing buckets: internal pipeline statuses collapse into "Submitted"
    // so an order in progress still appears under a meaningful filter (not only "All").
    const MO_BUCKETS = {
      DRAFT: ['DRAFT'],
      SUBMITTED: ['SUBMITTED','PENDING_APPROVAL','APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','READY_TO_PICK','PICKED','QUALITY_CHECK','VENDOR_PO_RAISED','IN_SHIPMENT'],
      PARTIALLY_CLOSED: ['PARTIALLY_CLOSED'],
      CLOSED: ['CLOSED'],
      CANCELLED: ['CANCELLED'],
    };
    if (!APP._moTab) APP._moTab = 'All';
    if (!APP._moSearch) APP._moSearch = '';

    const STATUS_LABEL = { DRAFT:'Draft', PENDING_PRICING:'Awaiting Pricing', SUBMITTED:'Submitted', PENDING_APPROVAL:'Awaiting Approval', APPROVED:'Approved', ACKNOWLEDGED:'Processing', INVENTORY_CHECK:'Checking Stock', READY_TO_PICK:'Picking', PICKED:'Picked', QUALITY_CHECK:'Quality Check', VENDOR_PO_RAISED:'Procurement', IN_SHIPMENT:'In Shipment', PARTIALLY_CLOSED:'Partially Delivered', CLOSED:'Delivered', CANCELLED:'Cancelled' };
    const STATUS_COLOR = { DRAFT:'#6b7280', PENDING_PRICING:'#d97706', SUBMITTED:'#3b82f6', PENDING_APPROVAL:'#f59e0b', APPROVED:'#3b82f6', ACKNOWLEDGED:'#8b5cf6', INVENTORY_CHECK:'#8b5cf6', READY_TO_PICK:'#0d9488', PICKED:'#0d9488', QUALITY_CHECK:'#06b6d4', VENDOR_PO_RAISED:'#8b5cf6', IN_SHIPMENT:'#06b6d4', PARTIALLY_CLOSED:'#f59e0b', CLOSED:'#10b981', CANCELLED:'#ef4444' };

    function moFiltered() {
      let list;
      if (APP._moTab === 'All') list = orders;
      else { const bucket = MO_BUCKETS[APP._moTab] || [APP._moTab]; list = orders.filter(o => bucket.includes(o.status)); }
      if (APP._moSearch) {
        const q = APP._moSearch.toLowerCase();
        list = list.filter(o => o.id.toLowerCase().includes(q) || (o.notes||'').toLowerCase().includes(q));
      }
      return list;
    }

    function moRender() {
      const filtered = moFiltered();
      document.getElementById('mo-count').textContent = `${filtered.length} order${filtered.length!==1?'s':''}`;
      const container = document.getElementById('mo-cards');

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:56px;text-align:center;background:var(--surface);border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-size:3rem;margin-bottom:12px">📋</div>
          <div style="font-weight:700;font-size:1rem;color:var(--navy)">No orders found</div>
          <div style="font-size:.83rem;color:var(--text-muted);margin-top:6px">Try "All" or clear the search filter</div>
          ${canAccessPage('place_order') ? `<button class="btn btn-gold" style="margin-top:16px" ${dataAct('navigate', 'place_order')}>${iconPlus(13)} Place New Order</button>` : ''}
        </div>`;
        return;
      }

      container.innerHTML = filtered.map(o => {
        const sc = STATUS_COLOR[o.status] || '#6b7280';
        const isCancelled = o.status === 'CANCELLED';
        const isPartial   = o.status === 'PARTIALLY_CLOSED';
        const isDone      = o.status === 'CLOSED';
        const itemNames   = (o.items||[]).slice(0,4).map(i=>i.name||i.item_name||'').filter(Boolean);

        // Phase-based status stepper (shared component, single source of truth).
        const progressBar = `<div style="margin:12px 0 8px">${phaseStepper(o.status, { compact:true })}</div>`;

        return `
        <div style="background:var(--surface);border-radius:14px;box-shadow:0 2px 8px rgba(0,0,0,.07);margin-bottom:12px;overflow:hidden;border:1px solid ${isCancelled?'var(--red-soft-bg)':isDone?'#bbf7d0':'var(--border)'}">
          <!-- Card top bar -->
          <div style="height:3px;background:${sc}"></div>
          <div style="padding:16px 20px">
            <!-- Row 1: ID + amount + status -->
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:40px;height:40px;border-radius:10px;background:${sc}18;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">
                  ${isDone?'✅':isPartial?'🔶':isCancelled?'❌':o.status==='IN_SHIPMENT'?'🚚':o.status==='PENDING_PRICING'?'💰':o.status==='PENDING_APPROVAL'?'⏳':o.status==='DRAFT'?'✏️':'📄'}
                </div>
                <div>
                  <div style="font-weight:800;font-size:.95rem;color:var(--navy)">${o.id}</div>
                  <div class="u-subtiny">${fmtDate(o.created_at)}${(o.items||[]).length?' · '+(o.items||[]).length+' item'+(o.items.length!==1?'s':''):''}</div>
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
              ${itemNames.map(n=>`<span style="background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:.72rem;color:var(--text-muted)">${n}</span>`).join('')}
              ${(o.items||[]).length>4?`<span style="background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:20px;padding:2px 10px;font-size:.72rem;color:var(--text-muted)">+${(o.items||[]).length-4} more</span>`:''}
            </div>` : o.notes ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:12px;padding:8px 12px;background:var(--surface-2);border-radius:8px">📝 ${o.notes}</div>` : ''}

            ${o.need_by_date ? `<div style="padding:6px 12px;background:#fff8f8;border-radius:8px;font-size:.78rem;color:var(--danger);font-weight:600;margin-bottom:8px;border:1px solid var(--red-soft-bg)">🚨 Need By: ${fmtDate(o.need_by_date)}</div>` : ''}
            ${o.predicted_delivery_date && !['CLOSED','DELIVERED','CANCELLED'].includes(o.status) ? (()=>{ const late=o.predicted_delivery_date<new Date().toISOString().slice(0,10); return `<div style="padding:6px 12px;background:${late?'#fff8f8':'var(--success-bg)'};border-radius:8px;font-size:.78rem;color:${late?'var(--danger)':'var(--success)'};font-weight:600;margin-bottom:8px;border:1px solid ${late?'var(--red-soft-bg)':'#bbf7d0'}">📅 Est. Delivery: ${fmtDate(o.predicted_delivery_date)}${late?' — Delayed':''}</div>`; })() : ''}
            ${isPartial?`<div style="padding:8px 12px;background:var(--amber-bg);border-radius:8px;font-size:.78rem;color:var(--amber-text);font-weight:600;margin-bottom:12px">⚠️ Partial delivery received — awaiting balance shipment</div>`:''}

            <!-- Action buttons -->
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.id)}>View Details</button>
              ${o.status==='DRAFT'?`<button class="btn btn-gold btn-sm" ${dataAct('submitDraftOrder', o.id)}>Submit Order</button>`:''}
              ${['IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED'].includes(o.status)?`<button class="btn btn-primary btn-sm" ${dataAct('viewOrderDrilldown', o.id)}>📦 Delivery Breakdown</button>`:''}
              ${o.status==='CLOSED'?`<button class="btn btn-secondary btn-sm" ${dataAct('reorderFromHistory', o.id)}>🔄 Reorder</button>`:''}
              ${(o.status==='DRAFT'||o.status==='SUBMITTED')?`<button class="btn btn-secondary btn-sm" style="color:var(--danger);border-color:var(--danger)" ${dataAct('cancelOrder', o.id)} data-stop>Cancel</button>`:''}
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
      ${canAccessPage('place_order') ? `<button class="btn btn-gold" ${dataAct('navigate', 'place_order')}>${iconPlus(14)} New Order</button>` : ''}
    </div>

    <!-- KPI tiles -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:14px 16px;border-top:3px solid var(--primary);margin-bottom:0;cursor:pointer" ${dataAct('moGoTabByStatus', 'All')}>
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Active</div>
        <div style="font-size:1.8rem;font-weight:800;color:var(--navy);line-height:1.2;margin-top:4px">${active}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">in progress</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid #06b6d4;margin-bottom:0;cursor:pointer" ${dataAct('moGoTab', 'IN_SHIPMENT')}>
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">In Transit</div>
        <div style="font-size:1.8rem;font-weight:800;color:${inShipment?'#0891b2':'var(--navy)'};line-height:1.2;margin-top:4px">${inShipment}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">on the way</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid ${partial>0?'var(--amber)':'var(--gray-light)'};margin-bottom:0;cursor:pointer" ${dataAct('moGoTab', 'PARTIALLY_CLOSED')}>
        <div style="font-size:.65rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Partial</div>
        <div style="font-size:1.8rem;font-weight:800;color:${partial>0?'var(--warning)':'var(--navy)'};line-height:1.2;margin-top:4px">${partial}</div>
        <div style="font-size:.72rem;color:var(--text-muted);margin-top:2px">balance pending</div>
      </div>
      <div class="card" style="padding:14px 16px;border-top:3px solid var(--success);margin-bottom:0;cursor:pointer" ${dataAct('moGoTabByStatus', 'CLOSED')}>
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
    <div style="background:var(--surface);border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.07);margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <input type="search" placeholder="🔍  Search orders…" value="${APP._moSearch||''}"
        style="flex:1;min-width:180px;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;outline:none"
        ${dataInputEl('moSearch')} data-focus>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${statuses.map(s=>`<button ${dataActEl('moGoTabPill', s)} data-s="${s}" class="tab-pill mo-pill${APP._moTab===s?' active':''}" style="font-size:.78rem;padding:5px 12px">${s==='All'?'All orders':STATUS_LABEL[s]||s.replace(/_/g,' ')}</button>`).join('')}
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
    `<button class="btn btn-gold" ${dataAct('navigate', 'place_order')}>${iconPlus(14)} New Order</button>`)}
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
            <button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.id)}>View</button>
            ${o.status==='DRAFT'||o.status==='SUBMITTED'?`<button class="btn btn-danger btn-sm" ${dataAct('cancelOrder', o.id)}>Cancel</button>`:''}
          </td>
        </tr>`).join('') : '<tr><td colspan="7" class="u-empty">No orders found</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// Collapsible section for the order detail (Option B — progressive disclosure).
function orderSection(title, badge, body, open) {
  return `<div class="ord-sec${open ? ' open' : ''}">
    <div class="ord-sec-head" ${dataActEl('toggleParentOpen')}>
      <svg class="ord-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
      <span class="ord-sec-title">${title}</span>
      ${badge ? `<span class="ord-sec-badge">${badge}</span>` : ''}
    </div>
    <div class="ord-sec-body">${body}</div>
  </div>`;
}

// ── Phase 2: ops order stepper + single next-action ──────────────────
// One glanceable stage bar (Placed→…→Closed) and one plain-language button
// for the next move, so non-technical staff never hunt through menus.
let _ostepCssDone = false;
function injectOrderStepperCss() {
  if (_ostepCssDone) return; _ostepCssDone = true;
  const css = `
  .ostepper{display:flex;overflow-x:auto;padding:6px 0 10px;margin:0 0 14px}
  .ostep{flex:1 0 auto;min-width:64px;display:flex;flex-direction:column;align-items:center;position:relative}
  .ostep .od{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:.7rem;font-weight:800;background:var(--bg,#eef2f4);border:2px solid var(--border);color:var(--text-muted);z-index:1}
  .ostep.done .od{background:var(--primary);border-color:var(--primary);color:#fff}
  .ostep.cur .od{background:var(--card,#fff);border:2px solid #1E7FB8;color:#1E7FB8;box-shadow:0 0 0 4px #E4F0F8}
  .ostep .ol{font-size:.63rem;margin-top:5px;color:var(--text-muted);text-align:center;font-weight:600;white-space:nowrap}
  .ostep.cur .ol{color:#1E7FB8}
  .ostep::after{content:"";position:absolute;top:11px;left:50%;width:100%;height:2px;background:var(--border);z-index:0}
  .ostep:last-child::after{display:none}
  .ostep.done::after{background:var(--primary)}
  .onext{display:flex;align-items:center;gap:12px;margin:0 0 16px;padding:12px 14px;border-radius:10px;background:#E4F0F8;border:1px solid #1E7FB8}
  .onext .ol2{font-size:.64rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#1E7FB8}
  .onext .ot{font-size:.9rem;font-weight:700;color:var(--navy,#15303d)}
  .onext .ot .m{font-weight:400;color:var(--text-muted)}
  .onext .obtn{margin-left:auto;white-space:nowrap}
  .odone{margin:0 0 16px;padding:11px 14px;border-radius:10px;background:var(--bg,#f4f7f9);border:1px solid var(--border);font-size:.86rem;color:var(--text-muted)}
  @media (prefers-color-scheme:dark){ .onext{background:#122430;border-color:#57A8DC} .onext .ol2,.onext .ot{color:#cfe6f5} .ostep.cur .od{background:var(--card);border-color:#57A8DC;color:#8fc7ea;box-shadow:0 0 0 4px #122430} }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}
const ORDER_STAGES = ['Placed','Approved','Sourced','Picked','Dispatched','Delivered','Billed','Closed'];
function orderStageIndex(status) {
  const m = { DRAFT:0,PENDING_PRICING:0,SUBMITTED:0,PENDING_APPROVAL:0,
    APPROVED:1,ACKNOWLEDGED:1, INVENTORY_CHECK:2,VENDOR_PO_RAISED:2,
    READY_TO_PICK:3,PICKED:3,QUALITY_CHECK:3, IN_SHIPMENT:4,
    DELIVERED:5, PARTIALLY_CLOSED:5, CLOSED:7 };
  return m[status] ?? 0;
}
// The single most useful next action for the current status, reusing the same
// handlers as the footer buttons. Returns null when the order is done/cancelled.
function opsNextStep(order, orderDCs) {
  const s = order.status, id = order.id;
  const step = (verb, why, owner, act) => ({ verb, why, owner, act });
  switch (s) {
    case 'PENDING_PRICING': return step('Set prices', 'Awaiting pricing before approval', 'Ops desk', dataActClose('repriceOrderModal', id));
    case 'SUBMITTED': case 'PENDING_APPROVAL': {
      const pendingAmend = s==='PENDING_APPROVAL' && Number(order.revision||1)>1
        && order.amendments && order.amendments[0] && Number(order.amendments[0].revision)===Number(order.revision);
      if (pendingAmend) return step('Awaiting client approval', 'Order amended — the client must approve the change before fulfilment resumes', 'Client', '');
      return step('Approve order', 'Waiting for approval before fulfilment', 'Approvals', dataActClose('advanceOrder', id, 'APPROVED', 'Approved via order detail'));
    }
    case 'APPROVED': return step('Acknowledge', 'Approved — start processing', 'Ops desk', dataActClose('advanceOrder', id, 'ACKNOWLEDGED', 'Order acknowledged — processing started'));
    case 'ACKNOWLEDGED': return step('Inventory check', 'Confirm stock availability', 'Ops desk', dataActClose('advanceOrder', id, 'INVENTORY_CHECK', 'Inventory check initiated'));
    case 'INVENTORY_CHECK': return step('Confirm stock', 'Mark stock available, or raise a PO', 'Ops desk', dataActClose('advanceOrder', id, 'READY_TO_PICK', 'Stock available — ready for picking'));
    case 'READY_TO_PICK': return step('Pick items', 'Ready for picking', 'Warehouse', dataActClose('pickOrderModal', id));
    case 'PICKED': return step('Quality check', 'Picked — QC & pack', 'Warehouse', dataActClose('advanceOrder', id, 'QUALITY_CHECK', 'Items picked — quality check & packing'));
    case 'QUALITY_CHECK': return step('Pass → Dispatch', 'Passed QC — create the challan', 'Warehouse', dataActClose('createDCFromPicklist', id));
    case 'VENDOR_PO_RAISED': return step('Track purchase order', 'Awaiting goods from the vendor', 'Procurement', dataAct('navigate', 'procurement'));
    case 'IN_SHIPMENT': {
      const sched = (orderDCs||[]).find(d => d.status === 'SCHEDULED');
      const transit = (orderDCs||[]).find(d => d.status === 'IN_TRANSIT');
      if (sched)   return step('Dispatch challan', 'Ready — challan not yet dispatched', 'Warehouse', dataActClose('dispatchDCModal', sched.id));
      if (transit) return step('Confirm delivery', 'In transit — confirm on arrival', 'Delivery', dataActClose('markDelivered', transit.id));
      return step('Open deliveries', 'In shipment', 'Delivery', dataAct('navigate', 'delivery'));
    }
    case 'PARTIALLY_CLOSED': return step('Dispatch remaining', 'Part delivered — send the rest', 'Warehouse', dataActClose('dispatchRemainingModal', id));
    default: return null; // CLOSED / CANCELLED
  }
}
function orderStepperHtml(order, orderDCs) {
  const curIdx = order.status === 'CLOSED' ? 7 : orderStageIndex(order.status);
  const steps = ORDER_STAGES.map((lab, i) => {
    const cls = i < curIdx ? 'done' : (i === curIdx ? 'cur' : '');
    const mark = i < curIdx ? '✓' : String(i + 1);
    return `<div class="ostep ${cls}"><div class="od">${mark}</div><div class="ol">${lab}</div></div>`;
  }).join('');
  const stepper = `<div class="ostepper">${steps}</div>`;
  const next = opsNextStep(order, orderDCs);
  const banner = next
    ? `<div class="onext">
         <div><div class="ol2">Next step</div><div class="ot">${h(next.verb)} <span class="m">· ${h(next.why)} · owner: ${h(next.owner)}</span></div></div>
         ${next.act
           ? `<button class="btn btn-primary obtn" ${next.act}>${h(next.verb)} →</button>`
           : `<span class="badge badge-warning" style="padding:8px 12px">⏳ ${h(next.verb)}</span>`}
       </div>`
    : (order.status === 'CLOSED' ? `<div class="odone">✓ Order complete — delivered and closed.</div>` : '');
  return stepper + banner;
}

// Renders the "what changed + budget impact" panel for an amended order that is
// awaiting (re-)approval. Visible to ops and to the client approving the change.
function amendmentSummaryHTML(order) {
  const ams = (order && order.amendments) || [];
  if (!ams.length) return '';
  const a = ams[0];
  let before = [], after = [];
  try { before = JSON.parse(a.before_items || '[]'); } catch (_) {}
  try { after = JSON.parse(a.after_items || '[]'); } catch (_) {}
  const bMap = new Map(before.map(i => [i.sku, i]));
  const aMap = new Map(after.map(i => [i.sku, i]));
  const line = (tag, color, name, txt) =>
    `<div style="display:flex;gap:8px;align-items:baseline;font-size:.82rem;padding:3px 0">
      <span style="min-width:64px;font-weight:700;color:${color}">${tag}</span>
      <span style="flex:1">${h(name)}</span><span style="color:var(--text-muted)">${txt}</span></div>`;
  const rows = [];
  before.forEach(i => { if (!aMap.has(i.sku)) rows.push(line('Removed', '#dc2626', i.name, `was qty ${i.qty} @ ${fmt(i.unit_price||0)}`)); });
  after.forEach(i => {
    const b = bMap.get(i.sku);
    if (!b) { rows.push(line('Added', '#0d9488', i.name, `qty ${i.qty} @ ${fmt(i.unit_price||0)}`)); return; }
    const qtyChg = Number(b.qty) !== Number(i.qty);
    const priceChg = Number(b.unit_price||0) !== Number(i.unit_price||0);
    if (qtyChg && priceChg) rows.push(line('Changed', '#d97706', i.name, `qty ${b.qty} → ${i.qty} · price ${fmt(b.unit_price||0)} → ${fmt(i.unit_price||0)}`));
    else if (qtyChg) rows.push(line('Qty', '#d97706', i.name, `${b.qty} → ${i.qty}`));
    else if (priceChg) rows.push(line('Price', '#d97706', i.name, `${fmt(b.unit_price||0)} → ${fmt(i.unit_price||0)}`));
  });
  if (!rows.length) rows.push(line('Changed', '#d97706', 'Line items updated', ''));

  const before_total = Number(a.before_total) || 0;
  const after_total = Number(a.after_total) || 0;
  const delta = after_total - before_total;
  const deltaTxt = delta === 0 ? 'no change in value'
    : `${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'} than the previous version`;

  // Budget impact (if the client has a monthly budget configured).
  let budgetHtml = '';
  const bud = order.budget;
  if (bud && bud.monthly_budget) {
    const monthly = Number(bud.monthly_budget) || 0;
    const usedOther = Number(bud.used_excluding_this) || 0;
    const projected = usedOther + after_total;
    const pct = monthly ? Math.round((projected / monthly) * 100) : 0;
    const over = projected > monthly;
    const barColor = over ? 'var(--danger,#dc2626)' : pct >= 90 ? 'var(--danger,#dc2626)' : pct >= 70 ? 'var(--warning,#d97706)' : 'var(--success,#10b981)';
    budgetHtml = `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)">
      <div style="font-size:.8rem;font-weight:700;color:var(--navy);margin-bottom:6px">Budget impact</div>
      <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px">
        <span class="u-muted">This order after change</span><b>${fmt(after_total)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:.8rem;margin-bottom:5px">
        <span class="u-muted">Month-to-date incl. this order</span><b style="color:${barColor}">${fmt(projected)} / ${fmt(monthly)} (${pct}%)</b></div>
      <div style="height:8px;background:var(--surface-2,#eef1f8);border-radius:5px;overflow:hidden"><div style="height:100%;width:${Math.min(100, pct)}%;background:${barColor}"></div></div>
      ${over ? `<div style="font-size:.76rem;color:var(--danger,#dc2626);margin-top:6px">⚠️ This change puts the client over the monthly budget.</div>` : ''}
    </div>`;
  }

  const body = `
    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">Reason: <b style="color:var(--navy)">${h(a.reason || '')}</b>${a.actor_name ? ` · by ${h(a.actor_name)}` : ''}</div>
    ${rows.join('')}
    <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:.84rem">
      <span>Order value</span><span><span class="u-muted" style="text-decoration:line-through">${fmt(before_total)}</span> → <b>${fmt(after_total)}</b> <span style="color:${delta>0?'#dc2626':delta<0?'#0d9488':'var(--text-muted)'};font-size:.78rem">(${deltaTxt})</span></span>
    </div>
    ${budgetHtml}`;
  const statusNote = a.status === 'REJECTED'
    ? '<span style="background:#fee2e2;color:#b91c1c;border-radius:4px;padding:2px 7px;font-size:.72rem;font-weight:700">✗ rejected — reverted</span>'
    : order.status === 'PENDING_APPROVAL'
      ? '<span style="background:var(--amber-bg,#fef3c7);color:var(--warning,#d97706);border-radius:4px;padding:2px 7px;font-size:.72rem;font-weight:700">⏳ awaiting re-approval</span>' : '';
  return orderSection(`✏️ Amendment (rev ${a.revision}) ${statusNote}`, `${ams.length} change${ams.length>1?'s':''}`, body, true);
}

async function viewOrder(id) {
  const [order, comments, dcRes, allocations, drill] = await Promise.all([
    api('/orders/' + id),
    api('/orders/' + id + '/comments'),
    api('/delivery-challans').catch(()=>null),
    api('/orders/' + id + '/allocations').catch(()=>[]),
    api('/orders/' + id + '/drilldown').catch(()=>null)
  ]);
  if (!order) return;

  // Build allocation map: sku → picked qty
  const allocMap = {};
  (allocations||[]).forEach(a => { allocMap[a.sku] = (allocMap[a.sku]||0) + a.qty; });
  const hasPartialPick = Object.keys(allocMap).length > 0;

  // Delivered qty per sku comes from the delivery-challan breakdown (drilldown).
  // Once an order has been dispatched, show DELIVERED (what the client received)
  // instead of PICKED (what the warehouse pulled).
  const deliveredMap = {};
  (drill?.lines || []).forEach(l => { deliveredMap[l.sku] = { delivered: l.qty_delivered||0, due: l.qty_due||0 }; });
  const showDelivered = ['IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED'].includes(order.status) && (drill?.lines||[]).length > 0;

  // Fulfilment totals for the progress meter (from the delivery breakdown).
  const dLines = drill?.lines || [];
  const orderedUnits   = dLines.length ? dLines.reduce((s,l)=>s+(l.qty_ordered||0),0) : (order.items||[]).reduce((s,i)=>s+(i.qty||0),0);
  const deliveredUnits = dLines.reduce((s,l)=>s+(l.qty_delivered||0),0);
  const dueUnits       = dLines.reduce((s,l)=>s+(l.qty_due||0),0);
  // Delivered can never exceed ordered — cap the meter at 100%. A raw sum above
  // ordered means a duplicate/phantom challan was counted; surface it, don't hide it.
  const overUnits      = drill?.summary?.total_over_delivered || dLines.reduce((s,l)=>s+(l.qty_over_delivered||0),0);
  const fulfilPct      = orderedUnits ? Math.min(100, Math.round(deliveredUnits/orderedUnits*100)) : 0;
  const dueValue       = drill?.summary?.total_due_value || 0;
  const anomalyHtml    = overUnits > 0 ? `
      <div class="ord-meter-warn" style="margin-top:6px;font-size:.8rem;color:var(--danger,#C6472A);background:var(--danger-bg,#FBE7E1);border:1px solid var(--danger,#C6472A);border-radius:8px;padding:7px 10px">
        ⚠ <b>${overUnits} unit${overUnits===1?'':'s'} over-delivered</b> — recorded deliveries exceed the ordered quantity. This usually means a duplicate or phantom delivery challan was counted. Review the DCs below and cancel any that shouldn't have shipped.
      </div>` : '';
  const meterHtml = showDelivered ? `
    <div class="ord-meter">
      <div class="ord-meter-bar"><i class="del" style="width:${fulfilPct}%"></i><i class="due" style="width:${100-fulfilPct}%"></i></div>
      <div class="ord-meter-cap">${fulfilPct}% delivered — <b>${Math.min(deliveredUnits,orderedUnits)} of ${orderedUnits} units</b>${dueUnits>0?` · <b>${dueUnits}</b> due${dueValue?` (${fmt(dueValue)})`:''}`:''}</div>
      ${anomalyHtml}
    </div>` : '';

  const orderDCs = (dcRes||[]).filter(d => d.order_id === id);
  const dcCards = orderDCs.length ? `
    ${orderDCs.map(dc=>`
      <div style="border:1px solid ${dc.status==='SCHEDULED'?'var(--warning)':'var(--border)'};border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><b>${dc.id}</b> — ${statusBadge(dc.status)}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" ${dataActEl('toggleDCItemsInline', dc.id)}>View Items</button>
            ${dc.status==='SCHEDULED'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-primary btn-sm" ${dataActClose('dispatchDCModal', dc.id)}>Dispatch</button>`:''}
            ${dc.status==='IN_TRANSIT'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-success btn-sm" ${dataActClose('markDelivered', dc.id)}>Confirm Delivery</button>`:''}
          </div>
        </div>
        ${dc.driver_name?`<div style="margin-top:6px;font-size:.85rem;color:var(--text-muted)">Driver: ${dc.driver_name} · Vehicle: ${dc.vehicle_no||'—'}</div>`:''}
        ${dc.total_qty?`<div style="margin-top:4px;font-size:.85rem">Dispatched: <b>${dc.total_qty}</b> units · Delivered: <b style="color:${dc.delivered_qty>0?'var(--success)':'var(--text-muted)'}">${dc.delivered_qty||0}</b></div>`:''}
        ${dc.status==='SCHEDULED'?`<div style="margin-top:6px;font-size:.8rem;color:var(--warning)">⏳ Awaiting dispatch — remaining items from partial delivery</div>`:''}
        <div id="dcitems-${dc.id}" style="display:none"></div>
      </div>`).join('')}` : '';

  const qtyMode = showDelivered ? 'delivered' : hasPartialPick ? 'picked' : 'plain';
  const itemsTableHeader = qtyMode === 'delivered'
    ? `<tr><th>Item</th><th>Ordered</th><th>Delivered</th><th>Unit</th><th>Total</th></tr>`
    : qtyMode === 'picked'
    ? `<tr><th>Item</th><th>Ordered</th><th>Picked</th><th>Unit</th><th>Total</th></tr>`
    : `<tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>`;

  const itemsTableRows = (order.items||[]).map(i => {
    const noteHtml = i.item_note ? `<div style="font-size:.72rem;color:#b45309;background:var(--warning-bg);border:1px solid #fde68a;border-radius:5px;padding:2px 8px;margin-top:3px;display:inline-block">💬 ${h(i.item_note)}</div>` : '';
    if (qtyMode === 'delivered') {
      const d = deliveredMap[i.sku] || { delivered: 0, due: Math.max(0, i.qty) };
      const short = d.due > 0;
      return `<tr>
        <td>${h(i.name)}${noteHtml}</td>
        <td class="u-muted">${i.qty}</td>
        <td><b style="color:${short?'var(--warning)':'var(--success)'}">${d.delivered}</b>${short?` <span style="font-size:.75rem;color:var(--warning)">(due ${d.due})</span>`:''}</td>
        <td>${fmt(i.unit_price)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }
    if (qtyMode === 'picked') {
      const picked = allocMap[i.sku];
      const isShort = picked !== undefined && picked < i.qty;
      return `<tr>
        <td>${h(i.name)}${noteHtml}</td>
        <td class="u-muted">${i.qty}</td>
        <td><b style="color:${isShort?'var(--warning)':'inherit'}">${picked !== undefined ? picked : i.qty}</b>${isShort?` <span style="font-size:.75rem;color:var(--warning)">(short ${i.qty-picked})</span>`:''}</td>
        <td>${fmt(i.unit_price)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }
    return `<tr><td>${h(i.name)}${noteHtml}</td><td>${i.qty}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.total)}</td></tr>`;
  }).join('');

  const commentsHtml = `
    <div id="order-comments" style="display:grid;gap:8px;max-height:180px;overflow-y:auto">
      ${(comments||[]).map(c=>`
        <div style="background:var(--bg);border-radius:8px;padding:10px 12px;font-size:.84rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <b>${h(c.author_name)}</b>
            <span class="u-muted">${timeAgo(c.created_at)}</span>
          </div>
          <div>${h(c.message)}</div>
        </div>`).join('') || '<div style="color:var(--text-muted);font-size:.84rem">No comments yet.</div>'}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <input type="text" id="comment-input" placeholder="Add a comment…" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:.875rem">
      <button class="btn btn-primary btn-sm" ${dataAct('addOrderComment', id)}>Post</button>
    </div>`;

  const isOpsRole = !['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  const today = new Date().toISOString().slice(0,10);
  const pdd = order.predicted_delivery_date;
  const pddIsLate = pdd && pdd < today && !['CLOSED','CANCELLED'].includes(order.status);
  const pddLabel = pdd
    ? `<span style="font-weight:700;color:${pddIsLate?'var(--danger)':'var(--success)'}">${fmtDate(pdd)}${pddIsLate?' ⚠ Overdue':''}</span>`
    : `<span style="color:var(--text-muted);font-style:italic">Not set</span>`;

  // Client-facing delivery tracker: collapse the 12-stage FSM into the four
  // milestones a client cares about — Submitted → Approved → In Shipment → Delivered.
  const MILESTONES = [
    { label:'Submitted',   statuses:['DRAFT','PENDING_PRICING','SUBMITTED','PENDING_APPROVAL'] },
    { label:'Approved',    statuses:['APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','PICKED','QUALITY_CHECK'] },
    { label:'In Shipment', statuses:['IN_SHIPMENT','PARTIALLY_CLOSED'] },
    { label:'Delivered',   statuses:['CLOSED','DELIVERED'] },
  ];
  const activeIdx = MILESTONES.findIndex(m => m.statuses.includes(order.status));
  const milestoneDate = (statuses) => {
    const ev = (order.history||[]).find(h => statuses.includes(h.to_status));
    return ev ? fmtDate(ev.created_at) : '';
  };
  const trackerHtml = order.status === 'CANCELLED'
    ? `<div style="margin-bottom:16px;padding:12px 14px;background:var(--danger-soft-bg,#fef2f2);border:1px solid #fecaca;border-radius:10px;color:var(--danger);font-weight:600;font-size:.88rem">❌ This order was cancelled.</div>`
    : `<div class="timeline" style="margin:2px 0 18px">
        ${MILESTONES.map((m,i)=>{
          const reached = activeIdx >= i;
          const isCurrent = activeIdx === i;
          const dt = reached ? milestoneDate(m.statuses) : '';
          return `<div class="timeline-step ${reached?'done':''}">
            <div class="timeline-dot">${reached && !isCurrent ? '✓' : ''}</div>
            <div class="timeline-label" style="${isCurrent?'font-weight:700':''}">${m.label}</div>
            ${dt?`<div style="font-size:.66rem;color:var(--text-muted);margin-top:2px">${dt}</div>`:''}
          </div>`;
        }).join('')}
      </div>`;

  // Ops staff get the full 8-stage stepper + one next-action; clients keep the
  // simpler 4-milestone tracker. Cancelled orders show the cancelled note.
  injectOrderStepperCss();
  const topFlow = order.status === 'CANCELLED'
    ? trackerHtml
    : (isOpsRole ? orderStepperHtml(order, orderDCs) : trackerHtml);

  openModal(`Order ${id}`,
    `<div style="margin-bottom:16px">
      ${topFlow}
      <!-- Row 1: status / type / client / date -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <div><b>Status:</b> ${statusBadge(order.status)}</div>
        <div><b>Type:</b> ${orderTypeBadge(order.order_type||'Regular')}</div>
        <div><b>Client:</b> ${order.client_name||'—'}</div>
        <div><b>Placed:</b> ${fmtDate(order.created_at)}</div>
        <button class="btn btn-secondary btn-sm" style="margin-left:auto" ${dataAct('orderTimelineModal', id)}>🧭 Timeline</button>
        ${order.order_period ? `<div><b>For:</b> ${new Date(order.order_period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</div>` : ''}
      </div>
      <!-- Row 2: dates -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:10px 12px;background:var(--bg,var(--surface-2));border-radius:8px;border:1px solid var(--border)">
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
               <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:.72rem;margin-left:6px" ${dataActEl('pddEditShow')}>
                 ${pdd ? 'Edit' : 'Set date'}
               </button>
               <span id="pdd-edit" style="display:none;align-items:center;gap:4px">
                 <input type="date" id="pdd-input" value="${pdd||''}" style="padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:.82rem">
                 <button class="btn btn-primary btn-sm" style="padding:3px 10px" ${dataAct('savePredictedDelivery', id)}>Save</button>
                 <button class="btn btn-secondary btn-sm" style="padding:3px 8px" ${dataAct('pddEditHide')}>✕</button>
               </span>`
            : pddLabel
          }`
          }
        </div>
      </div>
      ${order.notes ? `<div style="margin-top:10px;padding:10px 12px;background:#fefce8;border-radius:8px;border:1px solid #fef08a;font-size:.875rem"><span style="font-weight:700;color:#854d0e">📝 Client Note:</span> <span style="color:#713f12">${h(order.notes)}</span></div>` : ''}
      ${order.order_image ? `<div style="margin-top:10px"><div style="font-weight:700;font-size:.8rem;color:var(--navy);margin-bottom:6px">📷 Attached Photo</div><a href="${order.order_image}" target="_blank"><img src="${order.order_image}" style="max-height:140px;max-width:100%;border-radius:8px;border:1px solid var(--border);cursor:zoom-in" title="Click to open full size"></a></div>` : ''}
    </div>
    ${meterHtml}
    ${orderSection('Line items',
      qtyMode==='delivered' ? 'delivered qty' : qtyMode==='picked' ? '⚠ picked qty' : `${(order.items||[]).length} items`,
      `<table class="table" style="margin:0">
        <thead>${itemsTableHeader}</thead>
        <tbody>${itemsTableRows}</tbody>
      </table>
      <div class="cart-row cart-total" style="margin-top:12px"><span>Grand Total</span><span>${fmt(order.grand_total)}</span></div>`,
      true)}
    ${amendmentSummaryHTML(order)}
    ${orderDCs.length ? orderSection('Deliveries', `${orderDCs.length} challan${orderDCs.length>1?'s':''}`, dcCards, true) : ''}
    ${order.history?.length ? orderSection('Timeline', `${order.history.length} event${order.history.length>1?'s':''}`,
      `<div style="display:grid;gap:6px">
      ${order.history.map(h=>`<div style="display:flex;gap:8px;font-size:.82rem">
        <span style="color:var(--text-muted);min-width:90px">${fmtDate(h.created_at)}</span>
        <span>${statusBadge(h.to_status)}</span>
        <span class="u-muted">${h.actor_name||''} ${h.note?'— '+h.note:''}</span>
      </div>`).join('')}
      </div>`, false) : ''}
    ${orderSection('Comments', (comments||[]).length ? `${comments.length}` : '', commentsHtml, false)}`,
    (() => {
      const s = order.status;
      const opsRole = !['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
      // A pending amendment must be approved by the client, not ops/admin.
      const isPendingAmend = s==='PENDING_APPROVAL' && Number(order.revision||1)>1
        && order.amendments && order.amendments[0] && Number(order.amendments[0].revision)===Number(order.revision);
      const footer = [`<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`];
      if (isPendingAmend) {
        const canClientApprove = ['client_admin','client_approver'].includes(APP.user?.role||'');
        if (opsRole)
          footer.push(`<span class="badge badge-warning" style="padding:8px 12px">⏳ Awaiting client approval of the change</span>`);
        else if (canClientApprove) {
          footer.push(`<button class="btn btn-success" ${dataActClose('approveOrder', id)}>✓ Approve change</button>`);
          footer.push(`<button class="btn btn-danger" ${dataActClose('rejectAmendment', id)}>✕ Reject change</button>`);
        } else
          footer.push(`<span class="badge badge-warning" style="padding:8px 12px">⏳ Pending your approver's review</span>`);
      }
      if (opsRole) {
        if (['APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','PICKED','QUALITY_CHECK'].includes(s))
          footer.push(`<button class="btn btn-warning" ${dataActClose('amendOrderModal', id)}>✏️ Amend</button>`);
        if (s==='PENDING_PRICING')
          footer.push(`<button class="btn btn-gold" ${dataActClose('repriceOrderModal', id)}>💰 Set Prices</button>`);
        if (s==='SUBMITTED'||(s==='PENDING_APPROVAL'&&!isPendingAmend))
          footer.push(`<button class="btn btn-success" ${dataActClose('advanceOrder', id, 'APPROVED', 'Approved via order detail')}>✓ Approve</button>`);
        if (s==='APPROVED')
          footer.push(`<button class="btn btn-primary" ${dataActClose('advanceOrder', id, 'ACKNOWLEDGED', 'Order acknowledged — processing started')}>Acknowledge</button>`);
        if (s==='ACKNOWLEDGED')
          footer.push(`<button class="btn btn-primary" ${dataActClose('advanceOrder', id, 'INVENTORY_CHECK', 'Inventory check initiated')}>Inventory Check</button>`);
        if (s==='INVENTORY_CHECK') {
          footer.push(`<button class="btn btn-success" ${dataActClose('advanceOrder', id, 'READY_TO_PICK', 'Stock available — ready for picking')}>✓ Stock In</button>`);
          footer.push(`<button class="btn btn-gold" ${dataActClose('inventoryShortageModal', id)}>⚠ Raise PO</button>`);
        }
        if (s==='READY_TO_PICK')
          footer.push(`<button class="btn btn-primary" ${dataActClose('pickOrderModal', id)}>Pick Items</button>`);
        if (s==='PICKED')
          footer.push(`<button class="btn btn-info" ${dataActClose('advanceOrder', id, 'QUALITY_CHECK', 'Items picked — quality check & packing')}>Quality Check</button>`);
        if (s==='QUALITY_CHECK') {
          footer.push(`<button class="btn btn-success" ${dataActClose('createDCFromPicklist', id)}>✓ Pass → Dispatch</button>`);
          footer.push(`<button class="btn btn-warning" ${dataActClose('advanceOrder', id, 'READY_TO_PICK', 'Quality check failed — returned for re-pick')}>↩ Re-Pick</button>`);
        }
        if (s==='VENDOR_PO_RAISED')
          footer.push(`<button class="btn btn-warning" ${dataActClose('advanceOrder', id, 'APPROVED', 'PO rejected — reopened')}>↩ Reopen for Reprocessing</button>`);
        if (s==='PARTIALLY_CLOSED') {
          footer.push(`<button class="btn btn-primary" ${dataActClose('advanceOrder', id, 'READY_TO_PICK', 'Replenishment — next batch ready for picking')}>Replenish</button>`);
          footer.push(`<button class="btn btn-secondary" ${dataActClose('dispatchRemainingModal', id)}>Dispatch Remaining</button>`);
          footer.push(`<button class="btn btn-danger" ${dataActClose('preCloseOrder', id)}>Pre-Close Order</button>`);
        }
        if (!['CLOSED','CANCELLED'].includes(s))
          footer.push(`<button class="btn btn-danger" ${dataActClose('opsRejectOrder', id)}>Cancel Order</button>`);
      } else {
        if (s==='DRAFT')
          footer.push(`<button class="btn btn-gold btn-sm" ${dataActClose('submitDraftOrder', id)}>Submit Order</button>`);
        if (s==='SUBMITTED'||s==='APPROVED')
          footer.push(`<button class="btn btn-danger btn-sm" ${dataActClose('cancelOrder', id)}>Cancel Order</button>`);
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
    div.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:4px"><b>${APP.user.name}</b><span class="u-muted">just now</span></div><div>${msg}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
}

function cancelOrder(id) {
  openModal(`Cancel Order ${id}`,
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to cancel order <b>${id}</b>? This action cannot be undone.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Keep Order</button>
     <button class="btn btn-danger" ${dataAct('confirmCancelOrder', id)}>Cancel Order</button>`);
}

async function confirmCancelOrder(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note:'Cancelled by client' }) });
  closeModal();
  const isClient = ['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  if (res) { showToast(`Order ${id} cancelled`); navigate(isClient ? 'my_orders' : 'orders'); }
}

async function submitDraftOrder(id) {
  openModal(`Submit Order ${id}`,
    `<p class="u-muted">Submit draft order <b>${id}</b> to 4SYZ for processing?</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Not Yet</button>
     <button class="btn btn-gold" ${dataAct('confirmSubmitDraft', id)}>Submit Order</button>`);
}

async function confirmSubmitDraft(id) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'SUBMITTED', note:'Draft submitted by client' }) });
  closeModal();
  if (res) { showToast(`Order ${id} submitted to 4SYZ`); navigate('my_orders'); }
}

/* ── Ad-hoc pricing (Ops): set unit prices on a PENDING_PRICING order ── */
async function repriceOrderModal(id) {
  const order = await api('/orders/' + id);
  if (!order) return;
  const rows = (order.items||[]).map(it => `
    <tr>
      <td>${h(it.name)}<div class="u-subtiny" style="font-family:monospace">${it.sku}</div></td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">
        <input type="number" min="0" step="0.01" class="reprice-input" data-item="${it.id}" value="${it.unit_price>0?it.unit_price:''}"
          placeholder="0.00" ${dataInput('updateRepriceTotal')}
          style="width:120px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:.86rem">
      </td>
    </tr>`).join('');
  openModal(`💰 Price Ad-hoc Order ${id}`,
    `<p class="u-muted" style="margin-top:0;font-size:.85rem">Enter the unit price (₹, ex-GST) for each requested item. On save, 18% GST is added and the order enters the normal approval &amp; delivery flow.</p>
     ${order.notes ? `<div style="margin-bottom:12px;padding:8px 10px;background:#fefce8;border:1px solid #fef08a;border-radius:8px;font-size:.82rem"><b>Client note:</b> ${h(order.notes)}</div>` : ''}
     <table class="table" style="margin:0">
       <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price (₹)</th></tr></thead>
       <tbody>${rows}</tbody>
     </table>
     <div class="cart-row cart-total" style="margin-top:12px"><span>Estimated total (incl. 18% GST)</span><span id="reprice-total">${fmt(0)}</span></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('submitReprice', id)}>Save Prices &amp; Release</button>`);
  updateRepriceTotal();
}

function updateRepriceTotal() {
  const inputs = [...document.querySelectorAll('.reprice-input')];
  let subtotal = 0;
  inputs.forEach(i => {
    const row = i.closest('tr');
    const qty = Number(row?.querySelector('td:nth-child(2)')?.textContent) || 0;
    subtotal += qty * (parseFloat(i.value) || 0);
  });
  const el = document.getElementById('reprice-total');
  if (el) el.textContent = fmt(Math.round(subtotal * 1.18));
}

async function submitReprice(id) {
  const inputs = [...document.querySelectorAll('.reprice-input')];
  const prices = inputs.map(i => ({ id: i.dataset.item, unit_price: parseFloat(i.value) || 0 }));
  if (!prices.some(p => p.unit_price > 0)) { showToast('Enter a price greater than zero for at least one item', 'error'); return; }
  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const res = await api(`/orders/${id}/reprice`, { method:'POST', body: JSON.stringify({ prices }) });
  closeModal();
  if (res) {
    showToast(`Order ${id} priced — ${res.status==='PENDING_APPROVAL'?'sent for approval':res.status==='APPROVED'?'auto-approved':'released to 4SYZ'}`);
    navigate('orders');
  }
}

/* ============================================================
   AMEND ORDER — change line items on an approved (pre-dispatch)
   order. Any change re-opens approval (server resets to
   PENDING_APPROVAL and clears picking).
   ============================================================ */
function amendRowHTML(it) {
  const price = Number(it.unit_price) || 0;
  const delivered = Number(it.delivered) || 0;
  const minQty = delivered > 0 ? delivered : 1;
  const startQty = Math.max(Number(it.qty) || 1, minQty);
  return `<tr class="amend-row" data-sku="${h(it.sku)}" data-name="${h(it.name)}" data-delivered="${delivered}">
    <td>${h(it.name)}<div class="u-subtiny" style="font-family:monospace">${h(it.sku)||'—'}</div>${delivered>0?`<div style="font-size:.68rem;color:var(--success,#0d9488);font-weight:600">${delivered} delivered · min qty ${delivered}</div>`:''}</td>
    <td><input type="number" min="${minQty}" step="1" class="amend-qty" value="${startQty}" ${dataInput('amendRecalc')}
      style="width:66px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:.86rem"></td>
    <td><input type="number" min="0" step="0.01" class="amend-price" value="${price}" ${dataInput('amendRecalc')}
      style="width:92px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:.86rem"></td>
    <td style="text-align:right">${delivered>0
      ? `<span title="Part-delivered — this line can't be removed">🔒</span>`
      : `<button class="btn btn-danger btn-sm" ${dataAct('amendRemoveRow', it.sku)} title="Remove line">×</button>`}</td>
  </tr>`;
}

async function amendOrderModal(id) {
  const [order, inv, drill] = await Promise.all([
    api('/orders/' + id), api('/inventory'),
    api('/orders/' + id + '/drilldown').catch(() => null),
  ]);
  if (!order) return;
  APP._amendInv = (inv || []).map(i => ({ sku: i.sku, name: i.name, unit_price: i.unit_price != null ? i.unit_price : (i.price || 0) }));
  const deliveredMap = {};
  if (drill && Array.isArray(drill.lines)) drill.lines.forEach(l => { deliveredMap[l.sku] = parseInt(l.qty_delivered) || 0; });
  const anyDelivered = Object.values(deliveredMap).some(v => v > 0);
  const rows = (order.items || []).map(it => amendRowHTML({ ...it, delivered: deliveredMap[it.sku] || 0 })).join('');
  openModal(`✏️ Amend Order ${id}`,
    `<div style="margin:0 0 12px;padding:9px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:.82rem;color:#9a3412">
       ⚠️ Any change re-sends this order for <b>approval</b> and resets picking. Current status: <b>${h(order.status||'')}</b>.
       ${anyDelivered?`<div style="margin-top:6px">📦 Part of this order is already delivered — you can only amend the <b>undelivered balance</b>. Delivered quantities are the minimum and their lines can't be removed.</div>`:''}
     </div>
     <table class="table" style="margin:0;table-layout:auto;width:100%">
       <thead><tr><th>Item</th><th style="text-align:right;width:74px">Qty</th><th style="text-align:right;width:100px">Unit ₹</th><th style="width:40px"></th></tr></thead>
       <tbody id="amend-body">${rows}</tbody>
     </table>
     <div style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:10px 12px">
       <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:6px">Add or swap a product</div>
       <input id="amend-add-search" type="search" autocomplete="off" placeholder="Search catalogue by name or SKU…"
         ${dataInput('amendSearchResults')}
         style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.84rem;box-sizing:border-box">
       <div id="amend-search-results" style="display:none;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px;background:var(--surface)"></div>
       <div style="font-size:.72rem;color:var(--text-muted);margin-top:6px">Pick a product to add a line, then set its quantity and unit price.</div>
     </div>
     <label style="display:block;margin-top:12px;font-size:.82rem;font-weight:600">Reason for change <span style="color:var(--danger,#dc2626)">*</span>
       <textarea id="amend-reason" class="input" rows="2" placeholder="e.g. client swapped Product X for Product Y" style="width:100%;margin-top:4px"></textarea>
     </label>
     <div class="cart-row cart-total" style="margin-top:12px"><span>Estimated total (incl. 18% GST)</span><span id="amend-total">${fmt(0)}</span></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('submitAmendOrder', id)}>Save &amp; Re-submit for Approval</button>`);
  amendRecalc();
}

// Substring search over the whole catalogue (name OR SKU) — replaces the native
// <select> whose type-ahead only matched the first character.
function amendSearchResults() {
  const q = (document.getElementById('amend-add-search')?.value || '').trim().toLowerCase();
  const box = document.getElementById('amend-search-results');
  if (!box) return;
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const matches = (APP._amendInv || []).filter(i =>
    (i.name || '').toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q)).slice(0, 12);
  box.style.display = 'block';
  box.innerHTML = matches.length
    ? matches.map(i => `<div ${dataAct('amendAddFromSearch', i.sku)}
        style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px;font-size:.83rem">
        <span>${h(i.name)} <span class="u-subtiny" style="font-family:monospace;color:var(--text-muted)">${h(i.sku)||''}</span></span>
        <span style="color:var(--text-muted)">${fmt(i.unit_price || 0)}</span></div>`).join('')
    : `<div style="padding:8px 12px;font-size:.8rem;color:var(--text-muted)">No product matches "${h(q)}"</div>`;
}

function amendAddFromSearch(sku) {
  const item = (APP._amendInv || []).find(i => i.sku === sku);
  const body = document.getElementById('amend-body');
  if (!item || !body) return;
  const esc = (window.CSS && CSS.escape) ? CSS.escape(sku) : sku;
  const existing = body.querySelector(`.amend-row[data-sku="${esc}"] .amend-qty`);
  if (existing) { existing.value = (parseInt(existing.value, 10) || 0) + 1; existing.focus(); }
  else body.insertAdjacentHTML('beforeend', amendRowHTML({ sku: item.sku, name: item.name, qty: 1, unit_price: item.unit_price }));
  const s = document.getElementById('amend-add-search'); if (s) s.value = '';
  const box = document.getElementById('amend-search-results'); if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  amendRecalc();
}

function amendRemoveRow(sku) {
  const sel = (window.CSS && CSS.escape) ? CSS.escape(sku) : sku;
  const row = document.querySelector(`.amend-row[data-sku="${sel}"]`);
  if (row) row.remove();
  amendRecalc();
}

function amendRecalc() {
  let sub = 0;
  document.querySelectorAll('.amend-row').forEach(r => {
    const q = parseInt(r.querySelector('.amend-qty')?.value, 10) || 0;
    const p = parseFloat(r.querySelector('.amend-price')?.value) || 0;
    sub += q * p;
  });
  const el = document.getElementById('amend-total');
  if (el) el.textContent = fmt(Math.round(sub * 1.18));
}

async function submitAmendOrder(id) {
  const reason = (document.getElementById('amend-reason')?.value || '').trim();
  if (!reason) { showToast('Please enter a reason for the change', 'error'); return; }
  const items = [...document.querySelectorAll('.amend-row')].map(r => ({
    sku: r.dataset.sku, name: r.dataset.name,
    qty: parseInt(r.querySelector('.amend-qty')?.value, 10) || 0,
    unit_price: parseFloat(r.querySelector('.amend-price')?.value) || 0,
  })).filter(i => i.sku && i.qty > 0);
  if (!items.length) { showToast('Add at least one item', 'error'); return; }
  const btn = document.querySelector('#modal-footer .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const res = await api(`/orders/${id}/amend`, { method: 'POST', body: JSON.stringify({ items, reason }) });
  closeModal();
  if (res && !res.error) {
    showToast(`Order ${id} amended (rev ${res.revision}) — sent for re-approval`);
    navigate('orders');
  } else if (res && res.error) {
    showToast(res.error, 'error');
  }
}

/* ============================================================
   ORDER DRILL-DOWN — Delivery Reconciliation
   ============================================================ */
async function viewOrderDrilldown(orderId) {
  openModal(`Loading…`, `<div style="text-align:center;padding:40px;color:var(--text-muted)">Fetching delivery breakdown…</div>`, '');

  const data = await api(`/orders/${orderId}/drilldown`);
  if (!data) return;

  const { order, lines, dcs, summary } = data;

  // Which challans delivered each SKU (for the "Delivered via" column) — only
  // DELIVERED challans that actually recorded a qty for that line.
  const deliveredVia = {};
  (dcs||[]).forEach(dc => {
    if (dc.status !== 'DELIVERED') return;
    (dc.items||[]).forEach(it => {
      const q = Number(it.qty_delivered) || 0;
      if (q <= 0) return;
      (deliveredVia[it.sku] = deliveredVia[it.sku] || []).push({ dc: dc.dc_number||dc.id, qty: q, date: dc.delivered_at });
    });
  });

  // Unit (qty) totals to sit alongside the line-count totals.
  const ordQty = (lines||[]).reduce((s,l)=>s+(Number(l.qty_ordered)||0),0);
  const delQty = (lines||[]).reduce((s,l)=>s+(Number(l.qty_delivered)||0),0);
  // Completion is measured on quantity delivered vs ordered (units), not line count.
  const qtyRate = ordQty > 0 ? Math.round(delQty / ordQty * 100) : 0;
  const rateColor = qtyRate===100 ? '#10b981' : qtyRate>50 ? 'var(--amber)' : 'var(--red)';
  // Most recent delivery date across this order's challans.
  const delivDates = (dcs||[]).map(d=>d.delivered_at).filter(Boolean).sort();
  const lastDeliv = delivDates.length ? delivDates[delivDates.length-1] : null;

  // One header cell: small uppercase label over a value.
  const hdCell = (label, value, last) => `
    <div style="padding:14px 18px;min-width:0;${last?'':'border-right:1px solid var(--border)'}">
      <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">${label}</div>
      <div style="font-weight:800;color:var(--navy);font-size:.98rem;line-height:1.3">${value}</div>
    </div>`;

  // The old "LINES · QTY  6/41 · 454/3458" cell was ambiguous — you couldn't tell which
  // number was lines vs qty, or ordered vs delivered. Split it into two labelled rows.
  const ordDelCell = `
    <div style="padding:14px 18px;min-width:0">
      <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Ordered vs Delivered</div>
      <div style="font-size:.86rem;line-height:1.55">
        <div style="color:var(--navy);font-weight:700"><span style="display:inline-block;min-width:32px;color:var(--text-muted);font-weight:600;font-size:.76rem">Ord</span>${summary.total_lines} lines · ${ordQty} qty</div>
        <div style="color:#10b981;font-weight:700"><span style="display:inline-block;min-width:32px;color:var(--text-muted);font-weight:600;font-size:.76rem">Del</span>${summary.delivered_lines} lines · ${delQty} qty</div>
      </div>
    </div>`;

  // Stash for the By item / By challan toggle and the Excel / PDF exports.
  APP._dd = { orderId, order, lines, dcs, summary, deliveredVia, ordQty, delQty, qtyRate, view: 'item' };

  const body = `
  <!-- Order header strip: client / dates / status / challans / ordered-vs-delivered -->
  <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:18px;background:var(--surface)">
    <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr .7fr 1.3fr">
      ${hdCell('Client', h(order.client_name||'—'))}
      ${hdCell('Ordered Date', order.created_at?fmtDate(order.created_at):'—')}
      ${hdCell('Delivered', lastDeliv?`${fmtDate(lastDeliv)} <span style="font-weight:500;color:var(--text-muted);font-size:.78rem">(last)</span>`:'<span style="color:var(--text-muted);font-weight:500">—</span>')}
      ${hdCell('Status', statusBadge(order.status))}
      ${hdCell('Challans', String((dcs||[]).length))}
      ${ordDelCell}
    </div>
  </div>

  <!-- Delivery completion (measured on units delivered vs ordered) -->
  <div style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-size:.8rem;font-weight:700;color:var(--navy)">Delivery completion</span>
      <span style="font-size:.8rem;font-weight:800;color:${rateColor}">${qtyRate}% · ${delQty} of ${ordQty} units</span>
    </div>
    <div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${qtyRate}%;background:${rateColor};border-radius:4px;transition:width .4s"></div>
    </div>
  </div>

  <!-- Value summary row -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
    <div style="background:var(--bg);border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em">Ordered Value</div>
      <div style="font-size:1.35rem;font-weight:800;color:var(--navy);margin-top:4px">${fmt(summary.total_ordered_value)}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:.7rem;color:#10b981;font-weight:700;text-transform:uppercase;letter-spacing:.05em">Delivered Value</div>
      <div style="font-size:1.35rem;font-weight:800;color:#10b981;margin-top:4px">${fmt(summary.total_delivered_value)}</div>
    </div>
    <div style="background:var(--bg);border-radius:8px;padding:14px;text-align:center">
      <div style="font-size:.7rem;color:${summary.total_due_value>0?'var(--red)':'var(--text-muted)'};font-weight:700;text-transform:uppercase;letter-spacing:.05em">Due Value</div>
      <div style="font-size:1.35rem;font-weight:800;color:${summary.total_due_value>0?'var(--red)':'var(--text-muted)'};margin-top:4px">${fmt(summary.total_due_value)}</div>
    </div>
  </div>

  <!-- Reconciliation with By item / By challan toggle -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap">
    <div style="display:inline-flex;background:var(--bg);border:1px solid var(--border);border-radius:9px;padding:3px;gap:2px">
      <button class="dd-tab" data-ddview="item" ${dataAct('ddSetReconView','item')} style="border:0;border-radius:7px;padding:6px 14px;font-size:.82rem;font-weight:700;cursor:pointer;background:var(--surface);color:var(--navy);box-shadow:0 1px 3px rgba(0,0,0,.12)">By item</button>
      <button class="dd-tab" data-ddview="challan" ${dataAct('ddSetReconView','challan')} style="border:0;border-radius:7px;padding:6px 14px;font-size:.82rem;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted)">By challan</button>
    </div>
    <div id="dd-recon-caption" style="font-weight:700;font-size:.88rem;color:var(--navy)">Line-item reconciliation <span style="font-weight:400;color:var(--text-muted)">— by item</span></div>
  </div>
  <div id="dd-recon" style="margin-bottom:8px">${renderDDByItem()}</div>`;

  openModal(
    `Delivery Breakdown — ${orderId}${order.client_name?` · ${order.client_name}`:''}`,
    body,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
     <button class="btn btn-secondary" ${dataAct('ddExportCSV')}>⬇ Excel</button>
     <button class="btn btn-secondary" ${dataAct('ddExportPDF')}>⬇ PDF</button>
     <button class="btn btn-primary" ${dataActClose('viewOrder', orderId)}>Full Order View</button>`
  );
}

// ---- Delivery Breakdown: view toggle, renderers & exports -------------------
function ddStatusColor(s) { return ({fully_delivered:'#10b981',partial:'#f59e0b',not_delivered:'#ef4444',over_delivered:'#7c3aed'}[s]||'#6b7280'); }
function ddStatusLabel(s) { return ({fully_delivered:'Delivered',partial:'Partial',not_delivered:'Not Delivered',over_delivered:'Over-delivered'}[s]||s); }

function renderDDByItem() {
  const d = APP._dd; if (!d) return '';
  const rows = (d.lines||[]).map(l => {
    const via = d.deliveredVia[l.sku] || [];
    const viaHtml = via.length
      ? via.map(v=>`<div style="white-space:nowrap"><b style="color:var(--navy)">${h(v.dc)}</b> · ${v.qty} · <span style="color:var(--text-muted)">${v.date?fmtDate(v.date):'—'}</span></div>`).join('')
      : '<span style="color:var(--text-muted)">—</span>';
    const sc = ddStatusColor(l.status);
    return `<tr>
      <td><b>${h(l.name||l.sku)}</b><div class="u-subtiny" style="font-family:monospace">${h(l.sku)}</div></td>
      <td class="u-right">${l.qty_ordered}</td>
      <td style="text-align:right;color:${l.qty_delivered>0?'#10b981':'var(--text-muted)'};font-weight:${l.qty_delivered>0?700:400}">${l.qty_delivered}</td>
      <td style="text-align:right;color:${l.qty_due>0?'var(--red)':'var(--text-muted)'};font-weight:${l.qty_due>0?700:400}">${l.qty_due}</td>
      <td class="u-right">${fmt(l.unit_price)}</td>
      <td class="u-right">${fmt(l.value_ordered)}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${fmt(l.value_delivered)}</td>
      <td style="text-align:right;color:${l.value_due>0?'var(--red)':'var(--text-muted)'}">${fmt(l.value_due)}</td>
      <td style="font-size:.78rem">${viaHtml}</td>
      <td><span style="font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${sc}22;color:${sc}">${ddStatusLabel(l.status)}</span></td>
    </tr>`;
  }).join('');
  return `<div style="overflow-x:auto"><table class="table" style="font-size:.82rem;margin:0">
    <thead><tr>
      <th>Item</th>
      <th class="u-right">Ord</th><th class="u-right">Deliv</th><th class="u-right">Due</th>
      <th class="u-right">Unit ₹</th><th class="u-right">Ordered ₹</th><th class="u-right">Delivered ₹</th><th class="u-right">Due ₹</th>
      <th>Delivered via (challan · qty · date)</th><th>Status</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px">No line items found</td></tr>'}</tbody>
  </table></div>`;
}

function renderDDByChallan() {
  const d = APP._dd; if (!d) return '';
  const dcs = d.dcs || [];
  if (!dcs.length) return '<div style="text-align:center;color:var(--text-muted);padding:28px">No delivery challans raised for this order yet.</div>';
  const c = s => ({DELIVERED:'#10b981',IN_TRANSIT:'#06b6d4',SCHEDULED:'#f59e0b',CANCELLED:'#ef4444'}[s]||'#6b7280');
  return dcs.map(dc => {
    const items = dc.items || [];
    const tot = items.reduce((s,i)=>s+(Number(i.qty_delivered)||0),0);
    return `<div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;background:var(--bg);flex-wrap:wrap">
        <div><b style="color:var(--navy)">${h(dc.dc_number||dc.id)}</b>
          <span style="margin-left:8px;font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${c(dc.status)}22;color:${c(dc.status)}">${dc.status}</span>
          ${dc.delivered_at?`<span style="margin-left:8px;font-size:.78rem;color:var(--text-muted)">${fmtDate(dc.delivered_at)}</span>`:''}
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">${dc.driver_name?h(dc.driver_name)+' · ':''}${dc.vehicle_no?h(dc.vehicle_no)+' · ':''}<b style="color:var(--navy)">${tot}</b> units</div>
      </div>
      <div style="overflow-x:auto"><table class="table" style="font-size:.82rem;margin:0">
        <thead><tr><th>Item</th><th>SKU</th><th class="u-right">Ordered</th><th class="u-right">Delivered</th></tr></thead>
        <tbody>${items.map(i=>`<tr>
          <td><b>${h(i.name||i.sku)}</b></td>
          <td style="font-family:monospace;color:var(--text-muted)">${h(i.sku)}</td>
          <td class="u-right">${i.qty_ordered!=null?i.qty_ordered:'—'}</td>
          <td style="text-align:right;color:${Number(i.qty_delivered)>0?'#10b981':'var(--text-muted)'};font-weight:${Number(i.qty_delivered)>0?700:400}">${i.qty_delivered!=null?i.qty_delivered:0}</td>
        </tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:16px">No items recorded on this challan</td></tr>'}</tbody>
      </table></div>
    </div>`;
  }).join('');
}

function ddSetReconView(view) {
  if (APP._dd) APP._dd.view = view;
  const box = document.getElementById('dd-recon');
  if (box) box.innerHTML = view==='challan' ? renderDDByChallan() : renderDDByItem();
  const cap = document.getElementById('dd-recon-caption');
  if (cap) cap.innerHTML = `Line-item reconciliation <span style="font-weight:400;color:var(--text-muted)">— by ${view}</span>`;
  document.querySelectorAll('.dd-tab').forEach(b => {
    const on = b.dataset.ddview === view;
    b.style.background = on ? 'var(--surface)' : 'transparent';
    b.style.color = on ? 'var(--navy)' : 'var(--text-muted)';
    b.style.boxShadow = on ? '0 1px 3px rgba(0,0,0,.12)' : 'none';
    b.style.fontWeight = on ? '700' : '600';
  });
}

function ddExportCSV() {
  const d = APP._dd; if (!d) { showToast('Open an order first', 'error'); return; }
  const esc = v => { const s = String(v==null?'':v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  const head = ['SKU','Item','Ordered','Delivered','Due','Unit Price','Ordered Value','Delivered Value','Due Value','Delivered Via','Status'];
  const body = (d.lines||[]).map(l => {
    const via = (d.deliveredVia[l.sku]||[]).map(v=>`${v.dc} x${v.qty}${v.date?' ('+fmtDate(v.date)+')':''}`).join(' | ');
    return [l.sku,l.name,l.qty_ordered,l.qty_delivered,l.qty_due,l.unit_price,l.value_ordered,l.value_delivered,l.value_due,via,ddStatusLabel(l.status)].map(esc).join(',');
  });
  _downloadCSV(`delivery-breakdown-${d.orderId}`, [head.map(esc).join(','), ...body].join('\n'));
}

function ddLoadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}

async function ddExportPDF() {
  const d = APP._dd; if (!d) { showToast('Open an order first', 'error'); return; }
  showToast('Generating PDF…');
  try {
    if (!window.jspdf) await ddLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const { jsPDF } = window.jspdf;
    if (!(jsPDF.API && jsPDF.API.autoTable)) await ddLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js');
    const rupee = v => 'Rs ' + Number(v||0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.setFontSize(13); pdf.text(`Delivery Breakdown — ${d.orderId}`, 14, 14);
    pdf.setFontSize(9); pdf.setTextColor(90);
    pdf.text(`${d.order.client_name||''}`, 14, 20);
    pdf.text(`Ordered: ${d.summary.total_lines} lines / ${d.ordQty} qty    Delivered: ${d.summary.delivered_lines} lines / ${d.delQty} qty    Completion: ${d.qtyRate}% of units`, 14, 25);
    pdf.setTextColor(0);
    pdf.autoTable({
      startY: 30,
      head: [['Item','SKU','Ord','Deliv','Due','Unit','Ordered','Delivered','Due','Delivered via','Status']],
      body: (d.lines||[]).map(l => {
        const via = (d.deliveredVia[l.sku]||[]).map(v=>`${v.dc} x${v.qty}${v.date?' ('+fmtDate(v.date)+')':''}`).join('\n') || '—';
        return [l.name, l.sku, l.qty_ordered, l.qty_delivered, l.qty_due, rupee(l.unit_price), rupee(l.value_ordered), rupee(l.value_delivered), rupee(l.value_due), via, ddStatusLabel(l.status)];
      }),
      styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: { 0: { cellWidth: 46 }, 9: { cellWidth: 40 } },
    });
    pdf.save(`delivery-breakdown-${d.orderId}.pdf`);
  } catch (e) {
    showToast('PDF generation failed: ' + (e && e.message ? e.message : e), 'error');
  }
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
      ${dc.driver_phone?`<a href="tel:${h(dc.driver_phone)}" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:.75rem;font-weight:600;color:${textColor};text-decoration:none;background:${badgeBg};border-radius:6px;padding:4px 10px">📞 Call Driver</a>`:''}
      ${type!=='DELIVERED'?`<button class="btn btn-secondary btn-sm" style="margin-top:8px;margin-left:6px" ${dataAct('viewOrder', dc.order_id)}>View Order</button>`:''}
    </div>`;
  }

  el.innerHTML = `
  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
    <div style="background:var(--surface);border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue-bright)">
      <div class="u-label2">Scheduled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${scheduledDCs.length}</div>
      <div class="u-subtiny">upcoming deliveries</div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${inTransitDCs.length?'var(--amber)':'var(--gray-light)'}">
      <div class="u-label2">In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:${inTransitDCs.length?'var(--warning)':'var(--navy)'};margin-top:6px">${inTransitDCs.length}</div>
      <div class="u-subtiny">on the way now</div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div class="u-label2">Delivered (Month)</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${deliveredMonth.length}</div>
      <div class="u-subtiny">this month</div>
    </div>
    <div style="background:var(--surface);border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div class="u-label2">Units In Transit</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${itemsInTransit}</div>
      <div class="u-subtiny">units en route</div>
    </div>
  </div>

  <!-- 3-column pipeline -->
  <div style="background:var(--surface);border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
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
  const clientNames = [...new Set(orders.map(o=>o.client_name).filter(Boolean))].sort();
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
    if (APP._oqClient) { const q = APP._oqClient.toLowerCase(); res = res.filter(o=>(o.client_name||'').toLowerCase().includes(q)); }
    return res;
  }


  function oqKpiHtml(fOrders) {
    const allForType = APP._oqMonth ? orders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : orders;
    const active = fOrders.filter(o=>!['CLOSED','CANCELLED'].includes(o.status));
    const byS = s => fOrders.filter(o=>o.status===s);
    const nSubmitted = byS('SUBMITTED').length, nPending = byS('PENDING_APPROVAL').length, nApproved = byS('APPROVED').length;
    const needsAction  = nSubmitted + nPending + nApproved;
    const needsBreakdown = [
      nSubmitted && `${nSubmitted} submitted`,
      nPending   && `${nPending} pending`,
      nApproved  && `${nApproved} approved`,
    ].filter(Boolean).join(' · ') || 'all clear';
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
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--blue);margin-bottom:0;cursor:pointer" ${dataAct('switchOQMainTab', 'orders')}>
        <div class="u-label">Active Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${active.length}</div>
        <div class="u-sub">${fmt(totalValue)}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${needsAction?'var(--warning)':'var(--success)'};margin-bottom:0;cursor:pointer" ${dataAct('oqGoto', 'PENDING_APPROVAL')}>
        <div class="u-label">Needs Attention</div>
        <div style="font-size:1.9rem;font-weight:700;color:${needsAction?'var(--warning)':'var(--navy)'};line-height:1">${needsAction}</div>
        <div class="u-sub">${needsBreakdown}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--violet);margin-bottom:0;cursor:pointer" ${dataAct('oqGoto', 'IN_SHIPMENT')}>
        <div class="u-label">In Shipment</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${inShipment}</div>
        <div class="u-sub">en route to client</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0;cursor:pointer" ${dataAct('oqGoto', 'ACKNOWLEDGED')}>
        <div class="u-label">To Pick</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${toPick}</div>
        <div class="u-sub">in warehouse queue</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
      ${typeCfg.map(({type,color,icon})=>{
        const cnt = byType(type).length;
        const val = byType(type).reduce((s,o)=>s+(o.grand_total||0),0);
        const active = APP._oqTypeFilter===type;
        return `<div class="card" ${dataAct('oqFilterByType', type)}
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
      <select class="filter-select" style="font-size:.82rem" ${dataChangeVal('oqSetMonth')}>
        <option value="" ${!APP._oqMonth?'selected':''}>All time</option>
        ${months.map(m=>`<option value="${m}" ${APP._oqMonth===m?'selected':''}>${m}</option>`).join('')}
      </select>
    </div>`;
  }

  // Phase 2: the flat 14-status strip is replaced by a phase-based status
  // stepper filter. The active filter (APP._oqStatusTab) is 'All', a phase key
  // ('phase:<key>'), or an exact status (kept so KPI-tile deep links like
  // oqGoto('PENDING_APPROVAL') still work — they just light up their phase).
  function oqActivePhaseKey() {
    const t = APP._oqStatusTab || 'All';
    if (t === 'All') return 'All';
    if (t.startsWith('phase:')) return t.slice(6);
    if (['CANCELLED','REJECTED'].includes(t)) return 'cancelled';
    return orderPhaseKey(t) || 'All';
  }
  function oqTabsHtml() {
    injectOqPhaseCss();
    const fOrders = filteredOrders();
    const activeKey = oqActivePhaseKey();
    const cnt = ph => fOrders.filter(o => ph.statuses.includes(o.status)).length;
    const cancelledN = fOrders.filter(o => ['CANCELLED','REJECTED'].includes(o.status)).length;
    const step = (key, on, act, icon, label, count, extraCls='') =>
      `<button class="oq-phase ${on?'on':''} ${extraCls}" role="tab" aria-selected="${on}" ${dataAct('switchOQTab', act)}>
        ${icon?`<span class="oq-phase-ic">${icon}</span>`:''}<span class="oq-phase-lbl">${label}</span><span class="oq-phase-cnt">${count}</span>
      </button>`;
    return `<div class="oq-phasebar" role="tablist" aria-label="Filter orders by phase">
      ${step('All', activeKey==='All', 'All', '', 'All', fOrders.length)}
      ${ORDER_PHASES.map(p => `<span class="oq-phase-sep" aria-hidden="true"></span>${step(p.key, activeKey===p.key, 'phase:'+p.key, p.icon, p.label, cnt(p))}`).join('')}
      ${cancelledN ? `<span class="oq-phase-sep" aria-hidden="true"></span>${step('cancelled', activeKey==='cancelled', 'CANCELLED', '✕', 'Cancelled', cancelledN, 'oq-phase--cancel')}` : ''}
    </div>`;
  }

  function oqTableHtml(tab) {
    const fOrders = filteredOrders();
    let filtered;
    if (!tab || tab === 'All') filtered = fOrders;
    else if (tab.startsWith('phase:')) { const ph = ORDER_PHASES.find(p => p.key === tab.slice(6)); filtered = ph ? fOrders.filter(o => ph.statuses.includes(o.status)) : fOrders; }
    else filtered = fOrders.filter(o=>o.status===tab);
    const sorted   = [...filtered].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return `<tbody id="oq-tbody">${sorted.map(o=>{
      const isUrgent = o.status==='PENDING_APPROVAL';
      const todayStr = new Date().toISOString().slice(0,10);
      return `<tr style="${isUrgent||o.order_type==='Urgent'?'background:var(--warning-bg)':''}">
        <td class="card-title-cell">
          <b>${o.id}</b>
          ${o.need_by_date ? `<div style="font-size:.7rem;color:${o.need_by_date<todayStr?'var(--danger)':'var(--warning)'};font-weight:600;margin-top:2px">🚨 Need by ${fmtDate(o.need_by_date)}</div>` : ''}
          ${o.predicted_delivery_date && !['CLOSED','DELIVERED','CANCELLED'].includes(o.status) ? `<div style="font-size:.7rem;color:${o.predicted_delivery_date<todayStr?'var(--danger)':'var(--success)'};margin-top:1px">📅 Est. ${fmtDate(o.predicted_delivery_date)}</div>` : ''}
        </td>
        <td data-label="Client">${o.client_name||'—'}</td>
        <td data-label="Amount" style="font-weight:700">${fmt(o.grand_total)}</td>
        <td data-label="Status">${statusBadge(o.status)}</td>
        <td data-label="Type">${orderTypeBadge(o.order_type||'Regular')}</td>
        <td data-label="Items" class="u-center">
          <span style="font-weight:700;font-size:.88rem">${o.item_count||0}</span>
          <span style="font-size:.72rem;color:var(--text-muted)"> items</span>
        </td>
        <td data-label="Total Qty" class="u-center">
          <span style="font-weight:700;font-size:.88rem">${o.total_qty||0}</span>
          <span style="font-size:.72rem;color:var(--text-muted)"> units</span>
        </td>
        <td data-label="Created" style="font-size:.82rem;color:var(--text-muted)">${fmtDate(o.created_at)}</td>
        <td data-label="Actions">${orderQueueActions(o)}</td>
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
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <input type="search" list="oq-client-list" id="oq-client-input" class="filter-select"
        placeholder="🔍 Search client…" value="${h(APP._oqClient||'')}" ${dataInputVal('oqSetClient')}
        style="font-size:.82rem;min-width:200px" aria-label="Search orders by client">
      <datalist id="oq-client-list">${clientNames.map(n=>`<option value="${h(n)}"></option>`).join('')}</datalist>
      <div id="oq-month-picker">${monthPickerHtml()}</div>
    </div>
  </div>

  <div id="oq-kpi">${oqKpiHtml(filteredOrders())}</div>

  <div class="tabs" style="margin-bottom:16px">
    <button class="tab-btn${APP._oqTab==='orders'?' active':''}" ${dataAct('switchOQMainTab', 'orders')}>Orders</button>
    <button class="tab-btn${APP._oqTab==='items'?' active':''}" ${dataAct('switchOQMainTab', 'items')}>Line Items</button>
  </div>

  <div id="oq-main-content">
    ${APP._oqTab === 'orders' ? `
    <div class="card" style="overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div id="oq-tabs">${oqTabsHtml()}</div>
      </div>
      <div class="table-wrap">
        <table class="table table-cards" style="margin:0">
          <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Type</th><th class="u-center">Items</th><th class="u-center">Total Qty</th><th>Created</th><th>Actions</th></tr></thead>
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
        <table class="table table-cards" style="margin:0">
          <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Type</th><th class="u-center">Items</th><th class="u-center">Total Qty</th><th>Created</th><th>Actions</th></tr></thead>
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

// Deep-link into the Orders queue focused on all pending-approval orders,
// clearing the default current-month filter so nothing is hidden by month.
// Keeps the Control Tower's all-time approval count in sync with what the
// user actually sees when they click through.
function openPendingApprovals() {
  navigate('orders');
  setTimeout(() => {
    try {
      APP._oqMonthInit = true;   // prevent render from re-defaulting to this month
      oqSetMonth('');            // all time
      switchOQMainTab('orders');
      switchOQTab('PENDING_APPROVAL');
    } catch (_) { /* orders view not ready */ }
  }, 350);
}

// Live client search — filters the queue (table, status tabs, KPI top row and
// count) to one client, on top of the month/type filters.
function oqSetClient(val) {
  APP._oqClient = (val || '').trim();
  const base = APP._oqOrders || [];
  const monthF = APP._oqMonth ? base.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : base;
  const q = APP._oqClient.toLowerCase();
  const clientF = APP._oqClient ? monthF.filter(o=>(o.client_name||'').toLowerCase().includes(q)) : monthF;
  const forKpi = APP._oqTypeFilter ? clientF.filter(o=>(o.order_type||'Regular')===APP._oqTypeFilter) : clientF;
  const kpiEl = document.getElementById('oq-kpi'); if (kpiEl && APP._oqKpiHtml) kpiEl.innerHTML = APP._oqKpiHtml(forKpi);
  const sub = document.getElementById('oq-subtitle'); if (sub) sub.textContent = `${forKpi.filter(o=>!['CLOSED','CANCELLED'].includes(o.status)).length} active orders`;
  const tabsEl = document.getElementById('oq-tabs'); if (tabsEl && APP._oqTabsHtml) tabsEl.innerHTML = APP._oqTabsHtml();
  const tbody = document.getElementById('oq-tbody'); if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab || 'All');
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
      <button class="btn btn-sm ${APP._oqItemView==='brand'?'btn-primary':'btn-secondary'}" ${dataAct('oqSetItemView', 'brand')}>By Brand</button>
      <button class="btn btn-sm ${APP._oqItemView==='vendor'?'btn-primary':'btn-secondary'}" ${dataAct('oqSetItemView', 'vendor')}>By Vendor</button>
      <button class="btn btn-sm ${APP._oqItemView==='all'?'btn-primary':'btn-secondary'}" ${dataAct('oqSetItemView', 'all')}>All Items</button>
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
              const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:var(--warning-bg)':'';
              return `<tr style="${rowBg}">
                <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
                <td><b>${h(r.item_name)}</b></td>
                <td style="font-size:.82rem">${h(r.vendor_name)}</td>
                <td><span style="font-size:.78rem;background:var(--light);padding:2px 6px;border-radius:4px">${r.orders.size} order${r.orders.size!==1?'s':''}</span></td>
                <td><b>${r.ordered_qty}</b></td>
                <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'var(--warning)':'var(--success)'};font-weight:700">${r.stock}</td>
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
            <span style="font-weight:700;font-size:.95rem">${h(vendor_name)}</span>
            <span style="font-size:.75rem;color:var(--text-muted);margin-left:8px">${Object.keys(skuMap).length} SKUs</span>
          </div>
          <div style="display:flex;gap:6px">
            ${needPO.length>0?`<span class="badge badge-danger">${needPO.length} need procurement</span>`:'<span class="badge badge-success">All stocked</span>'}
          </div>
        </div>
        ${needPO.length>0?`
        <div style="padding:10px 16px;background:#fef3cd;border-bottom:1px solid var(--amber);font-size:.8rem;color:var(--amber-text)">
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
              const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:var(--warning-bg)':'';
              return `<tr style="${rowBg}">
                <td style="font-size:.8rem">${r.brand||'—'}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
                <td><b>${h(r.item_name)}</b></td>
                <td><b>${r.ordered_qty}</b></td>
                <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'var(--warning)':'var(--success)'};font-weight:700">${r.stock}</td>
                <td>${gap>0?`<b class="u-danger">${gap}</b>`:'<span style="color:var(--success)">—</span>'}</td>
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
            const rowBg=ss==='oos'?'background:#fff5f5':ss==='short'?'background:var(--warning-bg)':'';
            return `<tr style="${rowBg}">
              <td style="font-size:.8rem">${r.brand||'—'}</td>
              <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
              <td><b>${h(r.item_name)}</b></td>
              <td style="font-size:.8rem"><b>${r.order_id}</b></td>
              <td style="font-size:.8rem">${h(r.client_name)}</td>
              <td>${r.ordered_qty}</td>
              <td style="color:${ss==='oos'?'var(--danger)':ss==='short'?'var(--warning)':'var(--success)'};font-weight:700">${r.stock}</td>
              <td style="color:${gap>0?'var(--danger)':'var(--success)'}">${gap>0?'+'+gap:'—'}</td>
              <td style="font-size:.8rem">${h(r.vendor_name)}</td>
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
        <div class="card" style="padding:10px 16px;border-top:3px solid var(--warning);margin-bottom:0;min-width:100px">
          <div style="font-size:.68rem;font-weight:600;text-transform:uppercase;color:var(--text-muted)">Short Stock</div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--warning)">${shortCount}</div>
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
    return `<div style="display:flex;gap:6px;align-items:center">${statusBadge(o.status)}<button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.id)}>View</button></div>`;
  }
  const btns = [`<button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.id)}>View</button>`];
  switch (o.status) {
    case 'SUBMITTED':
      btns.push(`<button class="btn btn-success btn-sm" ${dataAct('advanceOrder', o.id, 'APPROVED', 'Approved by ops')}>✓ Approve</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" ${dataAct('opsRejectOrder', o.id)}>✕ Reject</button>`);
      break;
    case 'PENDING_APPROVAL':
      if ((o.revision||1) > 1) {
        // An amended order can only be approved by the client — no ops approve.
        btns.push(`<span class="badge badge-warning" style="font-size:.7rem">✏️ Amended · awaiting client</span>`);
      } else {
        btns.push(`<button class="btn btn-success btn-sm" ${dataAct('advanceOrder', o.id, 'APPROVED', 'Client/ops approval')}>✓ Approve</button>`);
        btns.push(`<button class="btn btn-danger btn-sm" ${dataAct('opsRejectOrder', o.id)}>✕ Reject</button>`);
      }
      break;
    case 'APPROVED':
      btns.push(`<button class="btn btn-primary btn-sm" ${dataAct('advanceOrder', o.id, 'ACKNOWLEDGED', 'Order acknowledged — processing started')}>Acknowledge</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" ${dataAct('opsRejectOrder', o.id)}>✕ Cancel</button>`);
      break;
    case 'ACKNOWLEDGED':
      btns.push(`<button class="btn btn-primary btn-sm" ${dataAct('advanceOrder', o.id, 'INVENTORY_CHECK', 'Inventory check initiated')}>Inventory Check</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" ${dataAct('opsRejectOrder', o.id)}>✕ Cancel</button>`);
      break;
    case 'INVENTORY_CHECK':
      btns.push(`<button class="btn btn-success btn-sm" ${dataAct('advanceOrder', o.id, 'READY_TO_PICK', 'Stock available — ready for picking')}>✓ Stock In</button>`);
      btns.push(`<button class="btn btn-gold btn-sm" ${dataAct('inventoryShortageModal', o.id)}>⚠ Raise PO</button>`);
      break;
    case 'VENDOR_PO_RAISED':
      btns.push(`<button class="btn btn-secondary btn-sm" style="cursor:default;opacity:.65" disabled>Awaiting Vendor</button>`);
      btns.push(`<button class="btn btn-warning btn-sm" ${dataAct('advanceOrder', o.id, 'APPROVED', 'PO rejected — reverted for reprocessing')}>↩ Reopen</button>`);
      break;
    case 'READY_TO_PICK':
      btns.push(`<button class="btn btn-primary btn-sm" ${dataAct('pickOrderModal', o.id)}>Pick Items</button>`);
      break;
    case 'PICKED':
      btns.push(`<button class="btn btn-info btn-sm" ${dataAct('advanceOrder', o.id, 'QUALITY_CHECK', 'Items picked — quality check & packing')}>Quality Check</button>`);
      break;
    case 'QUALITY_CHECK':
      btns.push(`<button class="btn btn-success btn-sm" ${dataAct('createDCFromPicklist', o.id)}>✓ Pass &rarr; Dispatch</button>`);
      btns.push(`<button class="btn btn-warning btn-sm" ${dataAct('advanceOrder', o.id, 'READY_TO_PICK', 'Quality check failed — returned for re-pick')}>↩ Re-Pick</button>`);
      break;
    case 'PARTIALLY_CLOSED':
      btns.push(`<button class="btn btn-primary btn-sm" ${dataAct('advanceOrder', o.id, 'READY_TO_PICK', 'Replenishment — next batch ready for picking')}>Replenish</button>`);
      btns.push(`<button class="btn btn-secondary btn-sm" ${dataAct('dispatchRemainingModal', o.id)}>Dispatch Remaining</button>`);
      btns.push(`<button class="btn btn-danger btn-sm" ${dataAct('preCloseOrder', o.id)}>Pre-Close</button>`);
      break;
    case 'IN_SHIPMENT':
      btns.push(`<button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'delivery')}>→ Delivery</button>`);
      break;
  }
  return `<div style="display:flex;gap:4px;flex-wrap:wrap">${btns.join('')}</div>`;
}

// Guided "Raise Vendor PO" — pre-fills the shortage order's line items, lets Ops
// pick a vendor and set quantities/costs, and posts a PO LINKED to the order so
// the backend moves it INVENTORY_CHECK → VENDOR_PO_RAISED in one step.
async function inventoryShortageModal(orderId) {
  const [order, vendors] = await Promise.all([api('/orders/' + orderId), api('/vendors')]);
  if (!order || !vendors) return;
  const activeVendors = (vendors||[]).filter(v => v.active !== 0);
  const vendorOpts = activeVendors.map(v => `<option value="${v.id}">${h(v.name)}${v.category?` · ${h(v.category)}`:''}</option>`).join('');
  const cell = 'padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:.86rem;box-sizing:border-box';
  const itemRows = (order.items||[]).map(it => `
    <tr>
      <td>${h(it.name)}<div class="u-subtiny" style="font-family:monospace">${it.sku}</div></td>
      <td style="text-align:right"><input type="number" class="po-line-qty" data-sku="${h(it.sku)}" data-name="${h(it.name)}" min="0" value="${it.qty}" style="${cell};width:80px;text-align:right"></td>
      <td style="text-align:right"><input type="number" class="po-line-price" min="0" step="0.01" value="${it.unit_price>0?it.unit_price:''}" placeholder="0.00" style="${cell};width:110px;text-align:right"></td>
    </tr>`).join('');

  openModal(`⚠ Raise Vendor PO — Order ${orderId}`,
    `<p style="color:var(--text-muted);margin:0 0 14px;font-size:.87rem">
       Stock is short for this order. Raise a purchase order to a vendor for the items below — the order will move to
       <b>VENDOR PO RAISED</b> automatically, and revert to picking once the vendor accepts.
     </p>
     ${activeVendors.length ? '' : `<div style="padding:10px 12px;background:var(--danger-soft-bg,#fef2f2);border:1px solid #fecaca;border-radius:8px;color:var(--danger);font-size:.84rem;margin-bottom:12px">No active vendors found. Add a vendor first, then raise the PO.</div>`}
     <div style="display:grid;grid-template-columns:1fr 160px;gap:12px;margin-bottom:14px">
       <div>
         <label style="display:block;margin-bottom:6px;font-weight:600;font-size:.85rem">Vendor</label>
         <select id="po-vendor" style="width:100%;${cell}">${vendorOpts || '<option value="">— none —</option>'}</select>
       </div>
       <div>
         <label style="display:block;margin-bottom:6px;font-weight:600;font-size:.85rem">Expected delivery</label>
         <input type="date" id="po-expected" value="${new Date(Date.now()+3*86400000).toISOString().slice(0,10)}" style="width:100%;${cell}">
       </div>
     </div>
     <table class="table" style="margin:0">
       <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit cost (₹)</th></tr></thead>
       <tbody>${itemRows || '<tr><td colspan="3" class="u-empty">No line items on this order</td></tr>'}</tbody>
     </table>
     <div style="margin-top:10px;padding:9px 12px;background:var(--warning-bg,#fffbeb);border:1px solid #fde68a;border-radius:8px;color:#92400e;font-size:.8rem">
       ⚠ Unit costs are pre-filled from the order's list price. Set each line to the <b>vendor's quoted cost</b> before raising the PO.
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('submitLinkedPO', orderId)} ${activeVendors.length?'':'disabled'}>Raise PO &amp; Link Order</button>`);
}

async function submitLinkedPO(orderId) {
  const vendorId = document.getElementById('po-vendor')?.value;
  if (!vendorId) { showToast('Select a vendor', 'error'); return; }
  const expected = document.getElementById('po-expected')?.value || '';
  const qtyInputs   = [...document.querySelectorAll('.po-line-qty')];
  const priceInputs = [...document.querySelectorAll('.po-line-price')];

  // Every ordered line needs a vendor cost — a PO with a ₹0 line is meaningless.
  // Flag the missing-price inputs (for lines that are actually being ordered) in red.
  let hasQty = false, missingPrice = false;
  qtyInputs.forEach((q, i) => {
    const qty = Number(q.value) || 0;
    const priceEl = priceInputs[i];
    const price = Number(priceEl?.value) || 0;
    if (qty > 0) {
      hasQty = true;
      const bad = price <= 0;
      if (priceEl) priceEl.style.borderColor = bad ? 'var(--danger)' : 'var(--border)';
      if (bad) missingPrice = true;
    } else if (priceEl) {
      priceEl.style.borderColor = 'var(--border)';
    }
  });
  if (!hasQty) { showToast('Enter a quantity for at least one item', 'error'); return; }
  if (missingPrice) { showToast('Set a vendor unit cost for every ordered item before raising the PO', 'error'); return; }

  const items = qtyInputs.map((q, i) => ({
    sku: q.dataset.sku,
    name: q.dataset.name,
    qty: Number(q.value) || 0,
    unit_price: Number(priceInputs[i]?.value) || 0,
  })).filter(it => it.qty > 0);

  const btn = document.querySelector('#modal-footer .btn-gold');
  if (btn) { btn.disabled = true; btn.textContent = 'Raising PO…'; }
  const res = await api('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, order_id: orderId, items, ...(expected ? { expected_delivery: expected } : {}) }),
  });
  closeModal();
  if (res) {
    showToast(`PO ${res.id} raised & linked — order ${orderId} moved to Vendor PO Raised`);
    navigate('procurement');
  }
}

async function dispatchRemainingModal(orderId) {
  const dcs = await api('/delivery-challans');
  if (!dcs) return;
  const scheduled = (dcs||[]).filter(d => d.order_id === orderId && d.status === 'SCHEDULED');
  if (!scheduled.length) {
    showToast('No pending DCs — remaining items may already be in transit or delivered.', 'error');
    return;
  }
  // Eligibility is the order's OUTSTANDING balance, not merely a SCHEDULED DC
  // existing: a fully-delivered order can leave a zero-balance phantom challan
  // behind, and dispatching it would over-deliver/over-bill. Keep only challans
  // that still carry something genuinely due against the order.
  const withRemaining = [];
  for (const dc of scheduled) {
    const items = await api(`/delivery-challans/${dc.id}/items`);
    const dispatchable = (items||[]).reduce((s, it) =>
      s + Math.max(0, Math.min(Number(it.qty_ordered)||0, it.order_remaining != null ? Number(it.order_remaining) : Number(it.qty_ordered)||0)), 0);
    if (dispatchable > 0) withRemaining.push({ ...dc, dispatchable });
  }
  const pending = withRemaining;
  if (!pending.length) {
    showToast('Nothing left to dispatch — this order is fully delivered.', 'info');
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
        <div class="u-b600">${dc.id}</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${dc.dispatchable||dc.total_qty||'?'} units due — ready to dispatch</div>
      </div>
      <button class="btn btn-primary btn-sm" ${dataActClose('dispatchDCModal', dc.id)}>Dispatch</button>
    </div>`).join('');
  openModal(`Dispatch Remaining — Order ${orderId}`,
    `<p style="color:var(--text-muted);margin-bottom:12px;font-size:.87rem">Select a pending DC to dispatch:</p>${dcList}`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}

async function preCloseOrder(orderId) {
  openModal('Pre-Close Order',
    `<p>Pre-closing <b>${orderId}</b> will mark it as <b>CLOSED</b> without completing all deliveries.</p>
     <p style="color:var(--warning);margin-top:8px;font-size:.87rem">⚠️ Any remaining scheduled DCs will be left undelivered. This action cannot be undone.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('confirmPreClose', orderId)}>Pre-Close Order</button>`);
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Keep Order</button>
     <button class="btn btn-danger" ${dataAct('confirmOpsReject', id)}>Reject & Cancel</button>`);
}

async function confirmOpsReject(id) {
  const reason = document.getElementById('reject-reason').value.trim() || 'Rejected by operations';
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to:'CANCELLED', note: reason }) });
  closeModal();
  if (res) { showToast(`Order ${id} cancelled`); navigate('orders'); }
}
