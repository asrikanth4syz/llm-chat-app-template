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

// Delivery-progress badge for an order row: shows the REAL fulfilment state derived
// from delivered units (handleListOrders supplies delivered_qty = Σ qty_delivered over
// DELIVERED challans), independent of the workflow status which can lag behind.
function oqDeliveryBadge(o) {
  const d = Number(o.delivered_qty) || 0, t = Number(o.total_qty) || 0;
  if (d <= 0 || o.status === 'CANCELLED') return '';
  if (d >= t && t > 0) {
    if (['CLOSED','DELIVERED'].includes(o.status)) return '';          // status already says Delivered
    return `<div style="margin-top:3px;font-size:.66rem;font-weight:800;color:#0C8E6D">✅ Fully Delivered</div>`;
  }
  return `<div style="margin-top:3px;font-size:.66rem;font-weight:800;color:#B5731A">📦 Partially Delivered</div>`;
}

// Delivered/Due sub-line under the Total Qty cell, so ordered vs delivered vs due is
// visible at a glance in the list — not only after opening the order.
function oqQtyBreakdown(o) {
  const d = Number(o.delivered_qty) || 0, t = Number(o.total_qty) || 0;
  if (d <= 0) return '';
  const delivered = Math.min(d, t), due = Math.max(0, t - delivered);
  return `<div style="margin-top:2px;font-size:.68rem;color:var(--text-muted);line-height:1.4">
    <span style="color:#0C8E6D;font-weight:700">${delivered.toLocaleString('en-IN')}</span> delivered${due>0?` · <span style="color:#B5731A;font-weight:700">${due.toLocaleString('en-IN')}</span> due`:''}
  </div>`;
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
    injectMyOrdersCss();
    if (APP._moSearch == null)  APP._moSearch = '';
    if (APP._moType == null)    APP._moType = 'all';
    if (APP._moStatusF == null) APP._moStatusF = 'all';
    if (APP._moPeriod == null)  APP._moPeriod = 'all';
    if (APP._moSort == null)    APP._moSort = { key: 'date', dir: 'desc' };

    // One enriched row per order: delivery classification (_mo, from mo-status.js)
    // plus client-safe lifecycle and approval labels (_lc, _ap). No internal codes
    // are shown; the API response and all figures are used exactly as returned.
    const rows = orders.map(o => Object.assign({}, o, {
      _mo: window.moClassify(o), _lc: moLifecycle(o.status), _ap: moApproval(o.status),
    }));
    const counts = { total: rows.length, awaiting: 0, progress: 0, partial: 0, delivered: 0 };
    let openValue = 0, billedValue = 0, lateCount = 0;
    rows.forEach(r => {
      if (counts[r._lc.bucket] != null) counts[r._lc.bucket]++;
      if (r._mo.status === 'delivered') billedValue += r._mo.value;
      else if (r.status !== 'CANCELLED') openValue += r._mo.value;
      if (r._mo.late) lateCount++;
    });
    const SUMMARY = [
      { key: 'all',       label: 'Total Orders',        n: counts.total,     color: 'var(--navy)' },
      { key: 'awaiting',  label: 'Awaiting Approval',   n: counts.awaiting,  color: '#d97706' },
      { key: 'progress',  label: 'In Progress',         n: counts.progress,  color: '#3b82f6' },
      { key: 'partial',   label: 'Partially Delivered', n: counts.partial,   color: '#f59e0b' },
      { key: 'delivered', label: 'Delivered / Closed',  n: counts.delivered, color: '#10b981' },
    ];

    function moVisible() {
      let list = rows.slice();
      if (APP._moStatusF === 'overdue') list = list.filter(r => r._mo.late);
      else if (APP._moStatusF !== 'all') list = list.filter(r => r._lc.bucket === APP._moStatusF);
      if (APP._moType !== 'all') list = list.filter(r => (r.order_type || 'Regular') === APP._moType);
      if (APP._moPeriod === 'month') { const ym = new Date().toISOString().slice(0,7); list = list.filter(r => String(r.created_at||'').slice(0,7) === ym); }
      else if (APP._moPeriod === '30' || APP._moPeriod === '90') { const cut = new Date(Date.now() - Number(APP._moPeriod)*86400000).toISOString().slice(0,10); list = list.filter(r => String(r.created_at||'').slice(0,10) >= cut); }
      if (APP._moSearch) { const qq = APP._moSearch.toLowerCase(); list = list.filter(r => r.id.toLowerCase().includes(qq) || String(r.order_reference||'').toLowerCase().includes(qq)); }
      const { key, dir } = APP._moSort, s = dir === 'asc' ? 1 : -1;
      const kv = r => key==='value' ? Number(r.grand_total||0) : key==='progress' ? (r._mo.pct||0)
        : key==='updated' ? String(r.updated_at||r.created_at||'') : key==='status' ? r._lc.label : String(r.created_at||'');
      list.sort((a,b) => { const va=kv(a), vb=kv(b); return va<vb?-s : va>vb?s : 0; });
      return list;
    }

    const prog = r => {
      const ord = r._mo.ordered, del = r._mo.delivered, pct = Math.min(100, r._mo.pct);
      if (!ord) return '<span class="u-muted">—</span>';
      return `<div class="mo-prog"><div class="mo-prog-bar"><i style="width:${pct}%;background:${r._lc.color}"></i></div><span class="mo-prog-t num">${del.toLocaleString('en-IN')}/${ord.toLocaleString('en-IN')}</span></div>`;
    };
    const badge = (lbl, color) => lbl === '—'
      ? '<span class="u-muted">—</span>'
      : `<span class="mo-badge" style="color:${color};border-color:${color}">${h(lbl)}</span>`;

    function rowHtml(r) {
      const items = r.item_count!=null ? r.item_count : (r.items||[]).length;
      return `<tr ${dataAct('viewOrder', r.id)} style="cursor:pointer">
        <td><span class="mo-id">${h(r.id)}</span></td>
        <td class="num">${fmtDate(r.created_at)}</td>
        <td>${h(r.order_type||'Regular')}</td>
        <td class="num">${items}</td>
        <td class="num">${fmt(r.grand_total)}</td>
        <td>${badge(r._ap.label, r._ap.color)}</td>
        <td>${badge(r._lc.label, r._lc.color)}</td>
        <td class="col-prog">${prog(r)}</td>
        <td class="num col-updated u-muted">${r.updated_at?fmtDate(r.updated_at):'—'}</td>
        <td class="col-act"><div class="mo-acts">
          <button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', r.id)}>View</button>
          ${r.status==='DRAFT'?`<button class="btn btn-gold btn-sm" ${dataAct('submitDraftOrder', r.id)}>Submit</button>`:''}
          ${(r.status==='DRAFT'||r.status==='SUBMITTED')?`<button class="btn btn-secondary btn-sm mo-cancel" ${dataAct('cancelOrder', r.id)}>Cancel</button>`:''}
        </div></td>
      </tr>`;
    }

    function cardHtml(r) {
      const items = r.item_count!=null ? r.item_count : (r.items||[]).length;
      const acts = [
        `<button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', r.id)}>View</button>`,
        r.status==='DRAFT' ? `<button class="btn btn-gold btn-sm" ${dataAct('submitDraftOrder', r.id)}>Submit</button>` : '',
        (r.status==='DRAFT'||r.status==='SUBMITTED') ? `<button class="btn btn-secondary btn-sm mo-cancel" ${dataAct('cancelOrder', r.id)}>Cancel</button>` : '',
        (r.status!=='DRAFT'&&r.status!=='CANCELLED') ? `<button class="btn btn-secondary btn-sm" ${dataAct('reorderFromHistory', r.id)}>Reorder</button>` : '',
      ].filter(Boolean).join('');
      // Clickable card (opens the order); inner buttons win via closest() delegation.
      return `<div class="mo-card" ${dataAct('viewOrder', r.id)}>
        <div class="mo-card-top"><span class="mo-id">${h(r.id)}</span>${badge(r._lc.label, r._lc.color)}</div>
        <div class="mo-card-meta">${fmtDate(r.created_at)} · ${h(r.order_type||'Regular')} · ${items} item${items!==1?'s':''}</div>
        <div>${prog(r)}</div>
        <div class="mo-card-foot"><span class="mo-val num">${fmt(r.grand_total)}</span>${badge(r._ap.label, r._ap.color)}</div>
        <div class="mo-acts mo-card-acts">${acts}</div>
      </div>`;
    }

    function summaryHtml() {
      return SUMMARY.map(c => {
        const active = c.key==='all' ? APP._moStatusF==='all' : APP._moStatusF===c.key;
        return `<button type="button" class="mo-sum${active?' on':''}" ${dataAct('moCardFilter', c.key)} aria-pressed="${active}">
          <span class="mo-sum-k"><span class="mo-sum-dot" style="background:${c.color}"></span>${c.label}</span>
          <span class="mo-sum-v num">${c.n}</span></button>`;
      }).join('');
    }

    function moRender() {
      const list = moVisible();
      const countEl = document.getElementById('mo-count'); if (countEl) countEl.textContent = `${list.length} of ${counts.total} order${counts.total!==1?'s':''}`;
      const sumEl = document.getElementById('mo-summary'); if (sumEl) sumEl.innerHTML = summaryHtml();
      document.querySelectorAll('#mo-table th[data-sort]').forEach(th => {
        const k = th.getAttribute('data-sort'), on = APP._moSort.key===k;
        th.setAttribute('aria-sort', on ? (APP._moSort.dir==='asc'?'ascending':'descending') : 'none');
        th.innerHTML = (th.getAttribute('data-label')||'') + (on ? (APP._moSort.dir==='asc'?' ▲':' ▼') : '');
      });
      const tb = document.getElementById('mo-tbody'), cards = document.getElementById('mo-cards');
      if (list.length === 0) {
        const empty = `<div class="mo-empty"><div style="font-size:2.4rem">📋</div><div>No orders match these filters.</div><button class="btn btn-secondary btn-sm" style="margin-top:12px" ${dataAct('moClearFilters')}>Clear filters</button></div>`;
        if (tb) tb.innerHTML = `<tr><td colspan="10" style="padding:0;border:0">${empty}</td></tr>`;
        if (cards) cards.innerHTML = empty;
        return;
      }
      if (tb) tb.innerHTML = list.map(rowHtml).join('');
      if (cards) cards.innerHTML = list.map(cardHtml).join('');
    }

    const sortTh = (key, label, extra) => `<th class="num ${extra||''}" data-sort="${key}" data-label="${label}" ${dataAct('moSortBy', key)} style="cursor:pointer">${label}</th>`;
    el.innerHTML = `
    <div class="mo-head">
      <div>
        <h1 class="mo-title">My Orders</h1>
        <div class="mo-sub" id="mo-count"></div>
        <div class="mo-sub2">View order progress, approvals and deliveries.</div>
      </div>
      ${canAccessPage('place_order') ? `<button class="btn btn-gold" ${dataAct('navigate','place_order')}>${iconPlus(14)} New Order</button>` : ''}
    </div>

    <div class="mo-summary" id="mo-summary">${summaryHtml()}</div>

    ${lateCount>0 ? `<div class="mo-late"><span>⚠️</span><span><b>${lateCount}</b> order${lateCount!==1?'s':''} past the expected delivery date</span>
      <button type="button" class="btn btn-sm" ${dataAct('moCardFilter','overdue')} style="margin-left:auto;background:var(--danger);color:#fff;border:0">Show</button></div>` : ''}

    <div class="mo-filters">
      <input type="search" id="mo-search" class="mo-f-search" placeholder="🔍  Search order number…" value="${h(APP._moSearch||'')}" ${dataInputEl('moSearchInput')} data-focus>
      <select id="mo-type-sel" class="mo-f-sel" aria-label="Order type" ${dataChangeEl('moTypeFilter')}>
        ${['all','Regular','Urgent','Ad-Hoc'].map(t=>`<option value="${t}"${APP._moType===t?' selected':''}>${t==='all'?'All types':t}</option>`).join('')}
      </select>
      <select id="mo-status-sel" class="mo-f-sel" aria-label="Order status" ${dataChangeEl('moStatusFilter')}>
        ${[['all','All statuses'],['awaiting','Awaiting approval'],['progress','In progress'],['partial','Partially delivered'],['delivered','Delivered / closed'],['draft','Draft'],['cancelled','Cancelled']].map(([v,l])=>`<option value="${v}"${APP._moStatusF===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <select id="mo-period-sel" class="mo-f-sel" aria-label="Period" ${dataChangeEl('moPeriodFilter')}>
        ${[['all','All time'],['month','This month'],['30','Last 30 days'],['90','Last 90 days']].map(([v,l])=>`<option value="${v}"${APP._moPeriod===v?' selected':''}>${l}</option>`).join('')}
      </select>
      <button class="btn btn-secondary btn-sm mo-f-clear" ${dataAct('moClearFilters')}>Clear</button>
    </div>

    <div class="mo-table-wrap">
      <table class="mo-table" id="mo-table">
        <thead><tr>
          <th>Order #</th>
          ${sortTh('date','Order Date')}
          <th>Type</th>
          <th class="num">Items</th>
          ${sortTh('value','Value')}
          <th>Approval</th>
          ${sortTh('status','Status')}
          ${sortTh('progress','Delivery','col-prog')}
          ${sortTh('updated','Updated','col-updated')}
          <th class="col-act">Action</th>
        </tr></thead>
        <tbody id="mo-tbody"></tbody>
      </table>
    </div>
    <div class="mo-cards" id="mo-cards"></div>`;

    moRender();
    window.moRender = moRender;
    if (APP._moScroll) { const y = APP._moScroll; APP._moScroll = 0; requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (_) {} }); }
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
  /* Delivery reconciliation: stack the ORDERED|DELIVERED|DUE columns on mobile. */
  @media (max-width:560px){
    .recon-cols{flex-direction:column}
    .recon-cols>div{border-right:0!important;border-bottom:1px solid var(--border);width:100%;text-align:left}
    .recon-cols>div:last-child{border-bottom:0}
  }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}
// Filter the Order View line-item table by reconciliation status (full/partial/
// pending). Toggles row visibility only — it does not rebuild the table — and the
// same status click again clears the filter. Legend chips reflect the active state.
function ddReconFilter(status) {
  const tbl = document.getElementById('order-items-table');
  if (!tbl) return;
  const cur = tbl.getAttribute('data-recon-filter') || '';
  const next = cur === status ? '' : status;
  tbl.setAttribute('data-recon-filter', next);
  tbl.querySelectorAll('tbody tr[data-recon]').forEach(tr => {
    tr.style.display = (!next || tr.getAttribute('data-recon') === next) ? '' : 'none';
  });
  document.querySelectorAll('[data-recon-legend]').forEach(b => {
    const on = b.getAttribute('data-recon-legend') === next;
    b.style.outline = on ? '2px solid var(--navy)' : '';
    b.style.outlineOffset = on ? '1px' : '';
  });
}
// ── Client "My Orders" filter handlers (new status-chip model) ───────────────
// All filter the list client-side via window.moRender (set up by renderMyOrders).
let _moSearchTimer = null;
// Client-safe lifecycle + approval labels derived from the internal status code.
// These never change or expose the backend status; they only translate it into
// plain language for the client, and bucket it for the summary cards / filter.
function moLifecycle(status) {
  if (status === 'DRAFT') return { bucket:'draft', label:'Draft', color:'#6b7280' };
  if (status === 'SUBMITTED' || status === 'PENDING_PRICING') return { bucket:'awaiting', label:'Submitted', color:'#6b7280' };
  if (status === 'PENDING_APPROVAL') return { bucket:'awaiting', label:'Awaiting approval', color:'#d97706' };
  if (['APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','PICKED','QUALITY_CHECK'].includes(status)) return { bucket:'progress', label:'Being prepared', color:'#3b82f6' };
  if (status === 'IN_SHIPMENT') return { bucket:'progress', label:'In shipment', color:'#3b82f6' };
  if (status === 'PARTIALLY_CLOSED') return { bucket:'partial', label:'Partially delivered', color:'#f59e0b' };
  if (status === 'CLOSED' || status === 'DELIVERED') return { bucket:'delivered', label:'Delivered', color:'#10b981' };
  if (status === 'CANCELLED') return { bucket:'cancelled', label:'Cancelled', color:'#6b7280' };
  return { bucket:'other', label:String(status||'—'), color:'#6b7280' };
}
function moApproval(status) {
  if (status === 'DRAFT' || status === 'CANCELLED') return { label:'—', color:'var(--text-muted)' };
  if (['SUBMITTED','PENDING_PRICING','PENDING_APPROVAL'].includes(status)) return { label:'Pending', color:'#d97706' };
  return { label:'Approved', color:'#10b981' };
}
function moSearchInput(el) {               // debounced 250ms
  const v = el.value;
  clearTimeout(_moSearchTimer);
  _moSearchTimer = setTimeout(() => { APP._moSearch = v.trim(); if (window.moRender) window.moRender(); }, 250);
}
function moTypeFilter(el)   { APP._moType = el.value;    if (window.moRender) window.moRender(); }
function moStatusFilter(el) { APP._moStatusF = el.value; if (window.moRender) window.moRender(); }
function moPeriodFilter(el) { APP._moPeriod = el.value;  if (window.moRender) window.moRender(); }
function moCardFilter(key) {
  APP._moStatusF = (APP._moStatusF === key && key !== 'all') ? 'all' : key;
  const sel = document.getElementById('mo-status-sel');
  if (sel) sel.value = ['all','awaiting','progress','partial','delivered','draft','cancelled'].includes(APP._moStatusF) ? APP._moStatusF : 'all';
  if (window.moRender) window.moRender();
}
function moSortBy(key) {
  const s = APP._moSort || { key:'date', dir:'desc' };
  APP._moSort = s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir:'desc' };
  if (window.moRender) window.moRender();
}
function moClearFilters() {
  APP._moSearch=''; APP._moType='all'; APP._moStatusF='all'; APP._moPeriod='all'; APP._moSort={ key:'date', dir:'desc' };
  const s = document.getElementById('mo-search'); if (s) s.value='';
  ['mo-type-sel','mo-status-sel','mo-period-sel'].forEach(idd => { const e=document.getElementById(idd); if (e) e.value='all'; });
  if (window.moRender) window.moRender();
}
let _moCssDone = false;
function injectMyOrdersCss() {
  if (_moCssDone) return; _moCssDone = true;
  const css = `
  .mo-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}
  .mo-title{font-size:1.3rem;font-weight:800;color:var(--navy);margin:0;line-height:1.2}
  .mo-sub{font-size:.82rem;color:var(--text-muted);margin-top:4px}
  .mo-sub2{font-size:.8rem;color:var(--text-muted);margin-top:1px}
  .mo-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
  .mo-sum{display:flex;flex-direction:column;gap:7px;align-items:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;cursor:pointer;text-align:left}
  .mo-sum:hover{border-color:var(--border-mid)}
  .mo-sum.on{border-color:var(--navy);box-shadow:inset 0 0 0 1px var(--navy)}
  .mo-sum-k{display:flex;align-items:center;gap:7px;font-size:.75rem;font-weight:600;color:var(--text-muted)}
  .mo-sum-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
  .mo-sum-v{font-size:1.5rem;font-weight:800;color:var(--navy);font-variant-numeric:tabular-nums;line-height:1}
  .mo-late{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--danger-bg);border:1px solid var(--danger);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.86rem;color:var(--danger);font-weight:600}
  .mo-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:14px}
  .mo-f-search{flex:1;min-width:190px;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;background:var(--surface);color:var(--text);outline:none}
  .mo-f-sel{padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.85rem;background:var(--surface);color:var(--text)}
  .mo-f-clear{white-space:nowrap}
  .mo-table-wrap{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:auto}
  .mo-table{width:100%;border-collapse:collapse;font-size:.85rem}
  .mo-table th,.mo-table td{padding:11px 14px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
  .mo-table thead th{font-size:.69rem;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);font-weight:700;background:var(--surface-2);position:sticky;top:0;z-index:1}
  .mo-table thead th[aria-sort="ascending"],.mo-table thead th[aria-sort="descending"]{color:var(--navy)}
  .mo-table tbody tr:last-child td{border-bottom:0}
  .mo-table tbody tr:hover{background:var(--surface-2)}
  .mo-table .num{text-align:right;font-variant-numeric:tabular-nums}
  .mo-id{color:var(--navy);font-weight:700}
  .mo-badge{display:inline-block;font-size:.72rem;font-weight:700;border:1px solid;border-radius:999px;padding:2px 9px;white-space:nowrap}
  .mo-prog{display:flex;align-items:center;gap:8px;min-width:112px}
  .mo-prog-bar{flex:1;min-width:48px;height:6px;background:var(--surface-3,var(--surface-2));border-radius:4px;overflow:hidden}
  .mo-prog-bar i{display:block;height:100%}
  .mo-prog-t{font-size:.72rem;color:var(--text-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
  .mo-empty{padding:46px 20px;text-align:center;color:var(--text-muted);font-size:.9rem;display:flex;flex-direction:column;align-items:center;gap:6px}
  .mo-cards{display:none;flex-direction:column;gap:10px}
  .mo-card{display:flex;flex-direction:column;gap:9px;text-align:left;width:100%;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 15px;cursor:pointer}
  .mo-card:hover{border-color:var(--border-mid)}
  .mo-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .mo-card-top .mo-id{font-size:.92rem}
  .mo-card-meta{font-size:.76rem;color:var(--text-muted)}
  .mo-card-foot{display:flex;justify-content:space-between;align-items:center;gap:8px}
  .mo-val{font-weight:800;color:var(--navy);font-size:1.02rem}
  .mo-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .mo-cancel{color:var(--danger);border-color:var(--danger)}
  .mo-card-acts{margin-top:2px;padding-top:10px;border-top:1px solid var(--border)}
  @media (max-width:1040px){ .mo-table .col-updated{display:none} }
  @media (max-width:860px){ .mo-summary{grid-template-columns:repeat(3,1fr)} }
  @media (max-width:768px){ .mo-table-wrap{display:none} .mo-cards{display:flex} }
  @media (max-width:560px){ .mo-summary{grid-template-columns:repeat(2,1fr)} .mo-sum-v{font-size:1.25rem} .mo-f-sel{flex:1 1 44%} }
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
  // Identity for before/after matching. Keying on SKU alone collapses lines
  // that share a blank or duplicated SKU (legacy/ad-hoc orders), which makes
  // every untouched line diff against one arbitrary entry and hides removals.
  // A SKU+name composite keeps distinct lines distinct in every real case.
  const keyOf = i => `${String(i.sku || '').trim()}\u001f${String(i.name || '').trim().toLowerCase()}`;
  const bMap = new Map(before.map(i => [keyOf(i), i]));
  const aMap = new Map(after.map(i => [keyOf(i), i]));
  const line = (tag, color, name, txt) =>
    `<div style="display:flex;gap:8px;align-items:baseline;font-size:.82rem;padding:3px 0">
      <span style="min-width:64px;font-weight:700;color:${color}">${tag}</span>
      <span style="flex:1">${h(name)}</span><span style="color:var(--text-muted)">${txt}</span></div>`;
  const rows = [];
  before.forEach(i => { if (!aMap.has(keyOf(i))) rows.push(line('Removed', '#dc2626', i.name, `was qty ${i.qty} @ ${fmt(i.unit_price||0)}`)); });
  after.forEach(i => {
    const b = bMap.get(keyOf(i));
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

  // Totals before → after, so the change is clear at a glance (counts + value).
  const bLines = before.length, aLines = after.length;
  const bQty = before.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const aQty = after.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const chg = (b, a2) => b === a2 ? `<b>${a2}</b>` : `<span class="u-muted" style="text-decoration:line-through">${b}</span> → <b>${a2}</b>`;
  const body = `
    <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">Reason: <b style="color:var(--navy)">${h(a.reason || '')}</b>${a.actor_name ? ` · by ${h(a.actor_name)}` : ''}</div>
    ${rows.join('')}
    <div style="display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:.84rem">
      <span>Items &amp; qty</span><span>${chg(bLines, aLines)} items · ${chg(bQty, aQty)} qty</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:.84rem">
      <span>Order value</span><span><span class="u-muted" style="text-decoration:line-through">${fmt(before_total)}</span> → <b>${fmt(after_total)}</b> <span style="color:${delta>0?'#dc2626':delta<0?'#0d9488':'var(--text-muted)'};font-size:.78rem">(${deltaTxt})</span></span>
    </div>
    ${budgetHtml}`;
  const statusNote = a.status === 'REJECTED'
    ? '<span style="background:#fee2e2;color:#b91c1c;border-radius:4px;padding:2px 7px;font-size:.72rem;font-weight:700">✗ rejected — reverted</span>'
    : order.status === 'PENDING_APPROVAL'
      ? '<span style="background:var(--amber-bg,#fef3c7);color:var(--warning,#d97706);border-radius:4px;padding:2px 7px;font-size:.72rem;font-weight:700">⏳ awaiting re-approval</span>' : '';
  return orderSection(`✏️ Amendment (rev ${a.revision}) ${statusNote}`, `${ams.length} change${ams.length>1?'s':''}`, body, true);
}

// Read-only per-item delivery chip (shown to ops AND client). Nothing renders for
// an unset or on-track line, so it's invisible unless a real delay is flagged.
function lineDelayChip(i) {
  const s = i && i.line_status;
  if (!s || s === 'on_track') return '';
  const map = {
    delayed:     ['🟠 Delayed',     'var(--danger)',       'var(--danger-bg)'],
    partial:     ['🟡 Partial',     'var(--amber-text)',   'var(--amber-bg)'],
    substituted: ['🟣 Substituted', 'var(--purple,#7c3aed)','var(--purple-bg,#ede9fe)'],
  };
  const m = map[s]; if (!m) return '';
  const [label, color, bg] = m;
  const eta = i.line_eta ? ` · ETA ${fmtDate(i.line_eta)}` : '';
  const detail = (i.delay_reason || i.line_note)
    ? `<div style="font-size:.7rem;color:var(--amber-text);margin-top:2px">${[i.delay_reason, i.line_note].filter(Boolean).map(h).join(' — ')}</div>`
    : '';
  return `<div style="margin-top:3px"><span style="display:inline-block;font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:${bg};color:${color}">${label}${eta}</span>${detail}</div>`;
}

// Ops modal to set a line's delivery status / ETA / reason (client-visible).
function orderItemDelayModal(itemId) {
  const order = APP._viewOrder; if (!order) return;
  const it = (order.items || []).find(x => String(x.id) === String(itemId)); if (!it) return;
  const st = it.line_status || 'on_track';
  const seg = (val, lbl) => `<button type="button" class="oid-seg${st===val?' on':''}" data-val="${val}" ${dataActEl('oidPickStatus', val)}>${lbl}</button>`;
  const reasons = ['Vendor stock delay','Logistics','Quality re-check','Substitution offered','Other'];
  openModal(`Delivery status — ${h(it.name)}`,
    `<input type="hidden" id="oid-status" value="${st}">
     <div class="form-group"><label>Line status</label>
       <div style="display:flex;flex-wrap:wrap;gap:6px">
         ${seg('on_track','🟢 On track')}${seg('delayed','🟠 Delayed')}${seg('partial','🟡 Partial')}${seg('substituted','🟣 Substituted')}
       </div>
     </div>
     <div class="form-group"><label>New ETA for this item</label><input type="date" id="oid-eta" value="${it.line_eta||''}"></div>
     <div class="form-group"><label>Reason (shown to client)</label>
       <select id="oid-reason"><option value="">— none —</option>${reasons.map(r=>`<option ${it.delay_reason===r?'selected':''}>${r}</option>`).join('')}</select></div>
     <div class="form-group"><label>Short note to client (optional)</label>
       <input type="text" id="oid-note" maxlength="200" value="${(it.line_note||'').replace(/"/g,'&quot;')}" placeholder="e.g. India Gate short; offering Daawat"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveOrderItemDelay', itemId)}>Save · client sees it</button>`);
}
function oidPickStatus(val) {
  const inp = document.getElementById('oid-status'); if (inp) inp.value = val;
  document.querySelectorAll('.oid-seg').forEach(b => b.classList.toggle('on', b.dataset.val === val));
}
async function saveOrderItemDelay(itemId) {
  const order = APP._viewOrder; if (!order) return;
  const body = {
    line_status:  document.getElementById('oid-status')?.value || 'on_track',
    line_eta:     document.getElementById('oid-eta')?.value || null,
    delay_reason: document.getElementById('oid-reason')?.value || null,
    line_note:    document.getElementById('oid-note')?.value?.trim() || null,
  };
  const res = await api(`/orders/${order.id}/items/${itemId}/delay`, { method:'PATCH', body: JSON.stringify(body) });
  if (res) { closeModal(); showToast('Delivery status updated — client can see it'); viewOrder(order.id); }
}

async function viewOrder(id) {
  // Clients get the dedicated client-safe order page, not this (shared) modal.
  if (['client_admin','client_user','client_approver'].includes(APP.user?.role||'')) { openClientOrder(id); return; }
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
  // Show the Ordered/Delivered/Due reconciliation whenever ANY delivery has actually
  // been recorded — never gate it on order.status, which can lag behind the challans
  // (a part-delivered order can still sit at READY_TO_PICK/PICKED until recomputed).
  const anyDelivered = (drill?.lines || []).some(l => (l.qty_delivered||0) > 0);
  const showDelivered = anyDelivered && (drill?.lines||[]).length > 0;

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
  // Line-item reconciliation counts to sit alongside the quantity totals.
  // Rule: delivered_qty == 0 → pending; 0 < delivered < ordered → partial;
  // delivered >= ordered → full.
  let itFull = 0, itPartial = 0, itPending = 0;
  dLines.forEach(l => {
    const ord = Number(l.qty_ordered) || 0;
    const del = Number(l.qty_delivered) || 0;
    if (del <= 0) itPending++;
    else if (del < ord) itPartial++;
    else itFull++;
  });
  const itOrdered = dLines.length;
  const anomalyHtml    = overUnits > 0 ? `
      <div class="ord-meter-warn" style="margin-top:6px;font-size:.8rem;color:var(--danger,#C6472A);background:var(--danger-bg,#FBE7E1);border:1px solid var(--danger,#C6472A);border-radius:8px;padding:7px 10px">
        ⚠ <b>${overUnits} unit${overUnits===1?'':'s'} over-delivered</b> — recorded deliveries exceed the ordered quantity. This usually means a duplicate or phantom delivery challan was counted. Review the DCs below and cancel any that shouldn't have shipped.
      </div>` : '';
  // ---- Delivery reconciliation card (shared staff + client) -------------------
  // Figures straight from the per-line ordered/delivered qty; counts from the
  // full/partial/pending split above. Percentages are relative to Ordered, items
  // and qty computed separately, rounded, divide-by-zero guarded.
  const isClientView = ['client_admin','client_user','client_approver'].includes(APP.user?.role||'');
  const ordItems = dLines.length;
  const ordQty   = dLines.reduce((s,l)=>s+(Number(l.qty_ordered)||0),0) || orderedUnits;
  const delItems = itFull;                                              // count of FULL items
  const delQty   = dLines.reduce((s,l)=>s+(Number(l.qty_delivered)||0),0);
  const dueItems = itPartial + itPending;
  const dueQty   = dLines.reduce((s,l)=>s+Math.max(0,(Number(l.qty_ordered)||0)-(Number(l.qty_delivered)||0)),0);
  const rpct = (n,d) => d>0 ? Math.round(n/d*100) : 0;                  // guard /0
  const delPctItems = rpct(delItems, ordItems), delPctQty = rpct(delQty, ordQty);
  const duePctItems = rpct(dueItems, ordItems), duePctQty = rpct(dueQty, ordQty);
  const segFull = rpct(itFull, ordItems), segPart = rpct(itPartial, ordItems), segPend = rpct(itPending, ordItems);
  const nfIn = n => Number(n||0).toLocaleString('en-IN');
  // Plain-language status (grey when nothing delivered — red is reserved for overdue).
  const reconStatus = ((ordItems>0 && delItems>=ordItems) || (ordQty>0 && delQty>=ordQty))
    ? { label:'Delivered', icon:'✅', fg:'#0C8E6D', bg:'#E4F5EF' }
    : (delItems===0 && delQty===0)
      ? { label:'Not Delivered', icon:'•', fg:'#5c7180', bg:'var(--bg,#eef2f5)' }
      : { label:'Partially Delivered', icon:'📦', fg:'#B5731A', bg:'#FBF0DB' };
  // If delivery has started but the workflow status hasn't caught up, say so plainly.
  const statusLagged = showDelivered && !['IN_SHIPMENT','PARTIALLY_CLOSED','CLOSED','DELIVERED'].includes(order.status);
  const workflowNote = statusLagged
    ? `<div style="margin-top:10px;font-size:.76rem;color:var(--text-muted)">Workflow stage still shows ${statusBadge(order.status)} — a super-admin can run <b>Recompute order statuses</b> to align it.</div>`
    : '';
  const legend = isClientView
    ? { full:'Fully delivered', partial:'In progress', pending:'Awaiting dispatch' }
    : { full:'Full', partial:'Partial', pending:'Pending' };
  const DEF_DEL = 'Delivered % = fully delivered items (and delivered qty) ÷ ordered, rounded.';
  const DEF_DUE = 'Due % = outstanding items (partial + pending) and qty ÷ ordered, rounded.';
  // One ORDERED | DELIVERED | DUE column: bold "items / qty", optional pct + mini bar.
  const reconCol = (label, items, qty, color, last, pItems, pQty, barPct, barColor, def) => `
    <div style="flex:1;min-width:0;padding:6px 12px;text-align:center;${last?'':'border-right:1px solid var(--border)'}">
      <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:4px">${label}</div>
      <div style="font-size:1.2rem;font-weight:800;color:${color};font-variant-numeric:tabular-nums;line-height:1.2">${nfIn(items)} <span style="color:var(--text-muted);font-weight:600">/</span> ${nfIn(qty)}</div>
      <div style="font-size:.58rem;color:var(--text-muted);margin-top:2px;text-transform:uppercase;letter-spacing:.04em">items / qty</div>
      ${def!=null ? `
        <div title="${def}" style="margin-top:7px;font-size:.7rem;font-weight:600;color:var(--text-muted);cursor:help;border-bottom:1px dotted var(--border);display:inline-block">${pItems}% items · ${pQty}% qty</div>
        <div style="height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden;margin-top:5px"><i style="display:block;height:100%;width:${Math.min(100,barPct)}%;background:${barColor}"></i></div>` : ''}
    </div>`;
  const legendChip = (key, color, label, count) => `
    <button type="button" data-recon-legend="${key}" ${dataAct('ddReconFilter', key)} title="Click to filter the item list below by this status" style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);background:var(--surface);border-radius:999px;padding:3px 11px;font-size:.76rem;font-weight:600;color:var(--navy);cursor:pointer">
      <span style="width:9px;height:9px;border-radius:2px;background:${color};display:inline-block"></span>${label} <b style="font-variant-numeric:tabular-nums">${count}</b>
    </button>`;
  const meterHtml = showDelivered ? `
    <div style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:18px;background:var(--surface)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div style="font-weight:800;color:var(--navy);font-size:.95rem">📦 Delivery reconciliation</div>
        <span style="font-size:.72rem;font-weight:800;color:${reconStatus.fg};background:${reconStatus.bg};border:1px solid ${reconStatus.fg};border-radius:999px;padding:3px 11px">${reconStatus.icon} ${reconStatus.label}</span>
      </div>
      <div class="recon-cols" style="display:flex;align-items:flex-start;gap:0;flex-wrap:wrap;margin-bottom:12px">
        ${reconCol('Ordered', ordItems, ordQty, 'var(--navy)', false)}
        ${reconCol('Delivered', delItems, delQty, '#0C8E6D', false, delPctItems, delPctQty, delPctQty, '#0C8E6D', DEF_DEL)}
        ${reconCol('Due', dueItems, dueQty, dueItems>0?'#B5731A':'var(--text-muted)', true, duePctItems, duePctQty, duePctQty, '#B5731A', DEF_DUE)}
      </div>
      <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:#e5e7eb">
        <i title="${legend.full}" style="width:${segFull}%;background:#0C8E6D"></i>
        <i title="${legend.partial}" style="width:${segPart}%;background:#B5731A"></i>
        <i title="${legend.pending}" style="width:${segPend}%;background:#9aa7b2"></i>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:9px">
        ${legendChip('full', '#0C8E6D', legend.full, itFull)}
        ${legendChip('partial', '#B5731A', legend.partial, itPartial)}
        ${legendChip('pending', '#9aa7b2', legend.pending, itPending)}
      </div>
      ${workflowNote}
      ${anomalyHtml}
    </div>` : '';

  const orderDCs = (dcRes||[]).filter(d => d.order_id === id);
  const dcCards = orderDCs.length ? `
    ${orderDCs.map(dc=>`
      <div style="border:1px solid ${dc.status==='SCHEDULED'?'var(--warning)':'var(--border)'};border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div><b>${dc.dc_number||dc.id}</b> — ${statusBadge(dc.status)}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" ${dataActEl('toggleDCItemsInline', dc.id)}>View Items</button>
            ${dc.status==='SCHEDULED'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-primary btn-sm" ${dataActClose('dispatchDCModal', dc.id)}>Dispatch</button>`:''}
            ${dc.status==='IN_TRANSIT'&&!['client_admin','client_user','client_approver'].includes(APP.user?.role||'')?`<button class="btn btn-success btn-sm" ${dataActClose('markDelivered', dc.id)}>Confirm Delivery</button>`:''}
          </div>
        </div>
        ${dc.driver_name?`<div style="margin-top:6px;font-size:.85rem;color:var(--text-muted)">Driver: ${dc.driver_name} · Vehicle: ${dc.vehicle_no||'—'}</div>`:''}
        ${dc.total_qty?`<div style="margin-top:4px;font-size:.85rem">${dc.item_count?`<b>${dc.item_count}</b> item${dc.item_count!=1?'s':''} · `:''}Dispatched: <b>${dc.total_qty}</b> units · Delivered: <b style="color:${dc.delivered_qty>0?'var(--success)':'var(--text-muted)'}">${dc.delivered_qty||0}</b></div>`:''}
        ${dc.status==='SCHEDULED'?`<div style="margin-top:6px;font-size:.8rem;color:var(--warning)">⏳ Awaiting dispatch${(dc.delivered_qty>0||orderDCs.some(x=>x.status==='DELIVERED'))?' — remaining items after an earlier partial delivery':''}</div>`:''}
        <div id="dcitems-${dc.id}" style="display:none"></div>
      </div>`).join('')}` : '';

  const qtyMode = showDelivered ? 'delivered' : hasPartialPick ? 'picked' : 'plain';
  const itemsTableHeader = qtyMode === 'delivered'
    ? `<tr><th>Item</th><th>Ordered</th><th>Delivered</th><th>Unit</th><th>Total</th></tr>`
    : qtyMode === 'picked'
    ? `<tr><th>Item</th><th>Ordered</th><th>Picked</th><th>Unit</th><th>Total</th></tr>`
    : `<tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>`;

  // Per-item delivery status (opt-in per client). Ops (with the client enabled)
  // can flag a line; the chip that results is visible to everyone incl. the client.
  const canFlagDelay = !['client_admin','client_user','client_approver'].includes(APP.user?.role||'') && Number(order.client_delay_tracking) === 1;
  const delayCell = (i) => {
    let out = lineDelayChip(i);
    if (canFlagDelay) out += `<div style="margin-top:4px"><button class="btn btn-secondary btn-sm" style="padding:3px 9px;font-size:.7rem" ${dataAct('orderItemDelayModal', i.id)}>⏱ ${i.line_status && i.line_status!=='on_track' ? 'Edit status' : 'Flag / ETA'}</button></div>`;
    return out;
  };
  const itemsTableRows = (order.items||[]).map(i => {
    const noteHtml = i.item_note ? `<div style="font-size:.72rem;color:var(--amber-text);background:var(--amber-bg);border:1px solid var(--gold-border);border-radius:5px;padding:2px 8px;margin-top:3px;display:inline-block">💬 ${h(i.item_note)}</div>` : '';
    if (qtyMode === 'delivered') {
      const d = deliveredMap[i.sku] || { delivered: 0, due: Math.max(0, i.qty) };
      const short = d.due > 0;
      // Same full/partial/pending rule as the reconciliation card, for legend filtering.
      const rstat = (d.delivered||0) <= 0 ? 'pending' : ((d.delivered||0) < (Number(i.qty)||0) ? 'partial' : 'full');
      return `<tr data-recon="${rstat}">
        <td>${h(i.name)}${noteHtml}${delayCell(i)}</td>
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
        <td>${h(i.name)}${noteHtml}${delayCell(i)}</td>
        <td class="u-muted">${i.qty}</td>
        <td><b style="color:${isShort?'var(--warning)':'inherit'}">${picked !== undefined ? picked : i.qty}</b>${isShort?` <span style="font-size:.75rem;color:var(--warning)">(short ${i.qty-picked})</span>`:''}</td>
        <td>${fmt(i.unit_price)}</td>
        <td>${fmt(i.total)}</td>
      </tr>`;
    }
    return `<tr><td>${h(i.name)}${noteHtml}${delayCell(i)}</td><td>${i.qty}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.total)}</td></tr>`;
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

  APP._viewOrder = order; // available to the per-item delay modal
  // Order summary figures for the header subtitle and the totals block.
  const lineCount   = (order.items||[]).length;
  const totalQty    = (order.items||[]).reduce((s,i)=>s+(Number(i.qty)||0),0);
  const subtotalAmt = order.subtotal != null ? Number(order.subtotal) : (order.items||[]).reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.unit_price)||0),0);
  const grandAmt    = order.grand_total != null ? Number(order.grand_total) : subtotalAmt;
  const gstAmt      = order.gst != null ? Number(order.gst) : Math.max(0, grandAmt - subtotalAmt);

  openModal(`Order ${id}${order.client_name ? ' · ' + order.client_name : ''}`,
    `<div style="margin-bottom:16px">
      ${topFlow}
      <!-- Row 1: status / type / client / date -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <div><b>Status:</b> ${statusBadge(order.status)}</div>
        <div><b>Type:</b> ${orderTypeBadge(order.order_type||'Regular')}</div>
        <div><b>Client:</b> ${order.client_name||'—'}</div>
        ${order.order_reference && order.order_reference !== order.id ? `<div><b>Ref:</b> ${h(order.order_reference)}</div>` : ''}
        <div><b>Placed:</b> ${fmtDate(order.created_at)}</div>
        <button class="btn btn-secondary btn-sm" style="margin-left:auto" ${dataAct('orderTimelineModal', id)}>🧭 Timeline</button>
        <div><b>For:</b> <span>${order.order_period ? new Date(order.order_period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'}</span>${['super_admin','ops_manager'].includes(APP.user?.role) ? ` <button class="btn btn-secondary btn-sm" style="padding:2px 8px" ${dataAct('editOrderPeriodModal', id, order.order_period||'')} title="Correct the order month">✏️</button>` : ''}</div>
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
      ${order.notes ? `<div style="margin-top:10px;padding:10px 12px;background:var(--amber-bg);border-radius:8px;border:1px solid var(--gold-border);font-size:.875rem;color:var(--amber-text)"><span style="font-weight:700">📝 Client Note:</span> <span>${h(order.notes)}</span></div>` : ''}
      ${order.order_image ? `<div style="margin-top:10px"><div style="font-weight:700;font-size:.8rem;color:var(--navy);margin-bottom:6px">📷 Attached Photo</div><a href="${order.order_image}" target="_blank"><img src="${order.order_image}" style="max-height:140px;max-width:100%;border-radius:8px;border:1px solid var(--border);cursor:zoom-in" title="Click to open full size"></a></div>` : ''}
    </div>
    ${meterHtml}
    ${orderSection('Line items',
      `${lineCount} item${lineCount!==1?'s':''} · ${totalQty} qty${qtyMode==='delivered'?' · delivered view':qtyMode==='picked'?' · ⚠ picked view':''}`,
      `<table class="table" id="order-items-table" style="margin:0">
        <thead>${itemsTableHeader}</thead>
        <tbody>${itemsTableRows}</tbody>
      </table>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;font-size:.88rem;color:var(--text-muted)"><span>Subtotal (before tax)</span><span>${fmt(subtotalAmt)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:.88rem;color:var(--text-muted)"><span>GST</span><span>${fmt(gstAmt)}</span></div>
        <div class="cart-row cart-total" style="display:flex;justify-content:space-between;border-top:2px solid var(--border);padding-top:8px;font-weight:800"><span>Grand Total (incl. tax)</span><span>${fmt(grandAmt)}</span></div>
      </div>`,
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
        if (!['DRAFT','CANCELLED'].includes(s))
          footer.push(`<button class="btn btn-secondary" ${dataActClose('viewOrderDrilldown', id)}>⬇ Download</button>`);
        // Admins can edit the picked allocation after picking (and up to QC).
        if (['super_admin','ops_admin'].includes(APP.user?.role||'') && ['PICKED','QUALITY_CHECK'].includes(s))
          footer.push(`<button class="btn btn-secondary" ${dataActClose('pickOrderModal', id)}>✏️ Edit picks</button>`);
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

/* ============================================================
   ADMIN FULL-PAGE ORDER VIEW (#order_view/<id>) + quick-view drawer
   Admin/ops only. Reuses the existing /orders endpoints and action
   handlers; the client keeps the modal viewOrder. See order-recon.js
   for the pure line-status / reconciliation / cancel-reason helpers.
   ============================================================ */
let _ofCssDone = false;
function injectOrderFullCss() {
  if (_ofCssDone) return; _ofCssDone = true;
  const css = `
  .ofbar{position:sticky;top:0;z-index:12;background:var(--surface);border-bottom:1px solid var(--border)}
  .ofbar .in{padding:10px 0;max-width:1100px;margin:0 auto}
  .ofbt{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px}
  .ofbt .oft{font-weight:800;font-size:1rem;color:var(--navy)}
  .oftabs{display:flex;gap:2px;overflow-x:auto;margin-top:8px}
  .ofcrumb{background:none;border:0;color:var(--primary);font-weight:700;cursor:pointer;padding:0;font-size:.86rem;display:inline-block}
  .ofcrumb:hover{text-decoration:underline}
  .ofbar .oft{font-weight:800;font-size:1rem;color:var(--navy)}
  .ofsp{flex:1}
  .ofmenu{position:relative}
  .ofpop{position:absolute;right:0;top:112%;background:var(--surface);border:1px solid var(--border);border-radius:10px;min-width:180px;padding:4px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:20}
  .ofpop.on{display:block}
  .ofpop button{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 11px;border-radius:7px;cursor:pointer;font-size:.86rem;color:var(--text)}
  .ofpop button:hover,.ofpop button:focus-visible{background:var(--bg,var(--surface-2))}
  .ofpop .d{color:var(--danger);font-weight:700}
  .ofgrid{display:grid;grid-template-columns:1fr 320px;gap:14px;margin-top:14px;align-items:start}
  .ofstack>*+*{margin-top:14px}
  .oftw{overflow-x:auto}
  .oftw.scroll{max-height:520px;overflow:auto}
  .oftable{width:100%;border-collapse:collapse;min-width:520px}
  .oftable th,.oftable td{padding:7px 9px;border-bottom:1px solid var(--border);text-align:left;font-size:.84rem}
  .oftable th{color:var(--text-muted);font-size:.74rem;font-weight:700;position:sticky;top:0;background:var(--surface);z-index:1}
  .oftable .u-right{text-align:right;font-variant-numeric:tabular-nums}
  .ofmini{height:6px;background:var(--bg,var(--surface-2));border-radius:3px;overflow:hidden;margin-top:10px}
  .ofmini i{display:block;height:100%;background:var(--success)}
  .oftot div{display:flex;justify-content:space-between;padding:3px 0;font-variant-numeric:tabular-nums}
  .oftot .g{font-weight:800;font-size:1rem;border-top:1px solid var(--border);margin-top:4px;padding-top:8px}
  .ofsec{border-top:1px solid var(--border);padding:10px 0}
  .ofsec summary{cursor:pointer;font-weight:700}
  .odscrim{position:fixed;inset:0;background:rgba(10,16,30,.45);opacity:0;pointer-events:none;transition:opacity .15s;z-index:1200}
  .odscrim.on{opacity:1;pointer-events:auto}
  .odrawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,100%);background:var(--surface);border-left:1px solid var(--border);transform:translateX(100%);transition:transform .18s;z-index:1201;display:flex;flex-direction:column}
  .odrawer.on{transform:none}
  .odrawer .in{padding:18px;overflow:auto;flex:1}
  .odkv{display:grid;grid-template-columns:110px 1fr;gap:6px 10px;margin:14px 0;font-size:.84rem}
  .odkv span:nth-child(odd){color:var(--text-muted)}
  @media (max-width:800px){ .ofgrid{grid-template-columns:1fr} }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

// 3-cell reconciliation card from pure totals (order-recon.js). Green delivered,
// amber due; no red (red is reserved for overdue elsewhere).
function ofReconCardHtml(r) {
  const n = v => Number(v||0).toLocaleString('en-IN');
  return `<div class="rc" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
    <div><div style="font-size:.7rem;font-weight:700;color:var(--text-muted)">ORDERED</div><div style="font-weight:800;font-variant-numeric:tabular-nums">${r.ordItems} / ${n(r.ordQty)}</div><small style="color:var(--text-muted)">items / qty</small></div>
    <div><div style="font-size:.7rem;font-weight:700;color:var(--success)">DELIVERED</div><div style="font-weight:800;color:var(--success);font-variant-numeric:tabular-nums">${r.delItems} / ${n(r.delQty)}</div><small style="color:var(--text-muted)">${r.pctDelItems}% items · ${r.pctDelQty}% qty</small></div>
    <div><div style="font-size:.7rem;font-weight:700;color:#B5731A">DUE</div><div style="font-weight:800;color:#B5731A;font-variant-numeric:tabular-nums">${r.dueItems} / ${n(r.dueQty)}</div><small style="color:var(--text-muted)">${r.pctDueItems}% items · ${r.pctDueQty}% qty</small></div>
  </div>
  <div class="ofmini" role="img" aria-label="${r.pctDelQty}% delivered by quantity"><i style="width:${Math.min(100,r.pctDelQty)}%"></i></div>`;
}

// Stepper-only (8 stages) for the main column; the one primary action lives in the bar.
function ofStepperHtml(order) {
  injectOrderStepperCss();
  const curIdx = order.status === 'CLOSED' ? 7 : orderStageIndex(order.status);
  const steps = ORDER_STAGES.map((lab, i) => {
    const cls = i < curIdx ? 'done' : (i === curIdx ? 'cur' : '');
    return `<div class="ostep ${cls}"><div class="od">${i < curIdx ? '✓' : String(i + 1)}</div><div class="ol">${lab}</div></div>`;
  }).join('');
  return `<div class="ostepper">${steps}</div>`;
}

// The one primary next-action, reusing opsNextStep (+ a DRAFT submit). Returns
// {label, act} (act '' = waiting badge) or null when no action applies.
function ofPrimaryAction(order, orderDCs) {
  if (order.status === 'DRAFT') return { label: 'Submit for approval', act: dataAct('advanceOrder', order.id, 'SUBMITTED', 'Submitted for approval') };
  const n = opsNextStep(order, orderDCs);
  if (!n) return null;
  return { label: n.verb, act: n.act || '' };
}

// Build the delivered/due map + reconciliation + line rows shared by page & drawer.
function ofComputeLines(order, drill) {
  const deliveredMap = {};
  (drill?.lines || []).forEach(l => { deliveredMap[l.sku] = { delivered: Number(l.qty_delivered) || 0 }; });
  const reconLines = (order.items || []).map(i => ({
    ordered: Number(i.qty) || 0,
    delivered: Number((deliveredMap[i.sku] || {}).delivered) || 0,
  }));
  return { deliveredMap, recon: window.oreconTotals(reconLines) };
}

const OF_TABS = ['overview', 'delivery', 'challans', 'amend', 'timeline'];
async function renderOrderFull(el) {
  injectOrderFullCss();
  registerHub('order_view', ofApplyToken);   // back/forward flips the tab in place
  const token = APP._navTab || parseHash().tab || '';
  const parts = String(token).split('.');
  const id = parts[0] || '';
  let tab = parts[1] || 'overview';
  const view0 = parts[2] || '';
  if (!id) { el.innerHTML = notImplemented('order_view'); return; }
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading ${h(id)}…</p></div>`;
  const [order, comments, dcRes, drill] = await Promise.all([
    api('/orders/' + id),
    api('/orders/' + id + '/comments').catch(() => []),
    api('/delivery-challans').catch(() => null),
    api('/orders/' + id + '/drilldown').catch(() => null),
  ]);
  if (!order) {
    el.innerHTML = `<div class="card" style="padding:40px;text-align:center">
      <div style="font-size:2.4rem">🔍</div>
      <div style="font-weight:800;color:var(--navy);margin-top:8px">Order not found</div>
      <div style="color:var(--text-muted);font-size:.86rem;margin-top:4px">${h(id)} doesn't exist or you don't have access to it.</div>
      <button class="btn btn-secondary" style="margin-top:16px" ${dataAct('ofBackToOrders')}>← Back to Orders</button>
    </div>`;
    return;
  }
  APP._viewOrder = order;
  const orderDCs = (dcRes || []).filter(d => d.order_id === id);
  const { recon } = ofComputeLines(order, drill);

  // Build the shared Delivery-breakdown read-model (APP._dd) so the existing
  // By item / By challan / Due renderers and the Excel/PDF exports work inline.
  const deliveredVia = {};
  (drill?.dcs || []).forEach(dc => { if (dc.status !== 'DELIVERED') return; (dc.items || []).forEach(it => { const q = Number(it.qty_delivered) || 0; if (q <= 0) return; (deliveredVia[it.sku] = deliveredVia[it.sku] || []).push({ dc: dc.dc_number || dc.id, qty: q, date: dc.delivered_at }); }); });
  const ddOrdQty = (drill?.lines || []).reduce((s, l) => s + (Number(l.qty_ordered) || 0), 0);
  const ddDelQty = (drill?.lines || []).reduce((s, l) => s + (Number(l.qty_delivered) || 0), 0);
  APP._dd = { orderId: id, order: (drill && drill.order) || order, lines: (drill && drill.lines) || [], dcs: (drill && drill.dcs) || [], summary: (drill && drill.summary) || {}, deliveredVia, ordQty: ddOrdQty, delQty: ddDelQty, qtyRate: ddOrdQty > 0 ? Math.round(ddDelQty / ddOrdQty * 100) : 0, view: 'item' };

  const dueLines = (drill?.lines || []).filter(l => (Number(l.qty_due) || 0) > 0);
  const dueQty = dueLines.reduce((s, l) => s + Math.max(0, Number(l.qty_due) || 0), 0);
  if (!OF_TABS.includes(tab)) tab = 'overview';
  const view = view0 || (tab === 'delivery' ? (dueQty > 0 ? 'due' : 'item') : '');
  APP._ofCtx = { id, order, comments, orderDCs, drill, recon, dueQty, dueLines, tab, view, sel: {} };

  el.innerHTML = ofShellHtml();
  ofRenderBody();
  try { window.scrollTo(0, 0); } catch (_) {}
}

// Sticky header (back, title, status, one primary, More menu) + the tab bar.
function ofShellHtml() {
  const c = APP._ofCtx, order = c.order, id = c.id, s = order.status;
  const pa = ofPrimaryAction(order, c.orderDCs);
  const primaryHtml = (pa && pa.act && c.dueQty > 0)
    ? `<button class="btn btn-primary" ${pa.act}>${h(pa.label)} →</button>`
    : (pa && pa.act ? `<button class="btn btn-primary" ${pa.act}>${h(pa.label)} →</button>` : `<span class="u-muted" style="font-size:.84rem">No further action</span>`);
  const canExport = !['DRAFT', 'CANCELLED'].includes(s);
  const canPreClose = ['IN_SHIPMENT', 'PARTIALLY_CLOSED'].includes(s);
  const canCancel = !['CLOSED', 'CANCELLED'].includes(s);
  const moreItems = [
    canExport ? `<button ${dataAct('ofMoreExcel', id)}>⬇ Export Excel</button>` : '',
    canExport ? `<button ${dataAct('ofMorePDF', id)}>⬇ Export PDF</button>` : '',
    canPreClose ? `<button ${dataAct('preCloseOrder', id)}>Pre-close order…</button>` : '',
    canCancel ? `<button class="d" ${dataAct('orderCancelDialog', id)}>Cancel order…</button>` : '',
  ].filter(Boolean).join('');
  return `
  <div class="ofbar"><div class="in">
    <button class="ofcrumb" ${dataAct('ofBackToOrders')}>← Back to Orders</button>
    <div class="ofbt">
      <span class="oft">${h(order.id)}</span><span class="u-muted" style="font-size:.84rem">${h((order.client_name || '').slice(0, 42))}</span>${statusBadge(order.status)}
      <span class="ofsp"></span>
      ${primaryHtml}
      ${moreItems ? `<div class="ofmenu"><button class="btn" id="of-more-btn" aria-haspopup="true" aria-expanded="false" ${dataActEl('orderMoreToggle')}>⋯ More</button>
        <div class="ofpop" id="of-more-pop" role="menu">${moreItems}</div></div>` : ''}
    </div>
    <div id="of-tabs" class="oftabs" role="tablist">${ofTabsHtml()}</div>
  </div></div>
  <div style="max-width:1100px;margin:0 auto"><div id="of-body" style="margin-top:4px"></div></div>`;
}
function ofTabsHtml() {
  const c = APP._ofCtx;
  const labels = { overview: 'Overview', delivery: `Delivery${c.dueQty > 0 ? ` · ${c.dueLines.length} due` : ''}`, challans: `Challans (${(c.drill && c.drill.dcs || []).length})`, amend: 'Amendments', timeline: 'Timeline' };
  return OF_TABS.map(t => `<button role="tab" aria-selected="${c.tab === t}" ${dataAct('ofGoTab', t)}
    style="background:none;border:0;border-bottom:3px solid ${c.tab === t ? 'var(--primary)' : 'transparent'};padding:8px 14px;font-weight:600;color:${c.tab === t ? 'var(--primary)' : 'var(--text-muted)'};cursor:pointer;white-space:nowrap">${labels[t]}</button>`).join('');
}
function ofGoTab(tab, view) {
  const c = APP._ofCtx; if (!c) return;
  if (!OF_TABS.includes(tab)) tab = 'overview';
  c.tab = tab;
  c.view = view || (tab === 'delivery' ? (c.dueQty > 0 ? 'due' : 'item') : '');
  c.sel = {};
  APP._navTab = c.id + '.' + tab + (c.view ? '.' + c.view : '');
  writeHash('order_view', APP._navTab);
  const tabsEl = document.getElementById('of-tabs'); if (tabsEl) tabsEl.innerHTML = ofTabsHtml();
  ofRenderBody();
}
// Back/forward (real hash change) re-applies the token: same order → swap tab in
// place; different order → full reload.
function ofApplyToken(token) {
  const parts = String(token || '').split('.');
  const id = parts[0], tab = parts[1] || 'overview', view = parts[2] || '';
  const c = APP._ofCtx;
  if (c && c.id === id) {
    c.tab = OF_TABS.includes(tab) ? tab : 'overview';
    c.view = view || (c.tab === 'delivery' ? (c.dueQty > 0 ? 'due' : 'item') : '');
    c.sel = {};
    const tabsEl = document.getElementById('of-tabs'); if (tabsEl) tabsEl.innerHTML = ofTabsHtml();
    ofRenderBody();
  } else {
    APP._navTab = token; renderOrderFull(document.getElementById('main-content'));
  }
}
function ofRenderBody() {
  const c = APP._ofCtx; const body = document.getElementById('of-body'); if (!c || !body) return;
  body.innerHTML = c.tab === 'delivery' ? ofTabDelivery()
    : c.tab === 'challans' ? ofTabChallans()
    : c.tab === 'amend' ? ofTabAmend()
    : c.tab === 'timeline' ? ofTabTimeline()
    : ofTabOverview();
  if (c.tab === 'delivery' && c.view === 'due') ofBindDueList();
}

function ofTotals(order) {
  const sub = order.subtotal != null ? Number(order.subtotal) : (order.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0), 0);
  const grand = order.grand_total != null ? Number(order.grand_total) : sub;
  return { sub, grand, gst: order.gst != null ? Number(order.gst) : Math.max(0, grand - sub) };
}
function ofReconBoxesHtml(r) {
  const n = v => Number(v || 0).toLocaleString('en-IN');
  const box = (label, val, color, view) => `<button type="button" ${dataAct('ofGoTab', 'delivery', view)} aria-label="${label} — open the Delivery tab"
    style="border:1px solid var(--border);background:var(--bg,var(--surface-2));border-radius:12px;padding:12px 14px;text-align:left;cursor:pointer;width:100%">
    <span style="font-size:.72rem;font-weight:700;color:${color}">${label}</span><div style="font-size:1.25rem;font-weight:800;color:${color};font-variant-numeric:tabular-nums">${val}</div></button>`;
  return `<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
    <span style="font-size:2rem;font-weight:800;color:#0C8E6D">${r.pctDelQty}%</span>
    <div style="flex:1;min-width:140px"><div style="height:10px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(100, r.pctDelQty)}%;background:#0C8E6D"></i></div>
    <div class="u-muted" style="margin-top:4px"><b>${n(r.delQty)} of ${n(r.ordQty)}</b> units</div></div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
      ${box('ORDERED', r.ordItems + ' / ' + n(r.ordQty), 'var(--navy)', 'item')}
      ${box('DELIVERED', r.delItems + ' / ' + n(r.delQty), '#0C8E6D', 'item')}
      ${box('DUE', r.dueItems + ' / ' + n(r.dueQty), '#B5731A', 'due')}
    </div>`;
}
function ofTabOverview() {
  const c = APP._ofCtx, order = c.order, t = ofTotals(order);
  const isFinance = ['super_admin', 'ops_admin', 'finance_admin'].includes(APP.user?.role || '');
  const amend = amendmentSummaryHTML(order);
  let budgetCard = '';
  if (isFinance && order.budget && Number(order.budget.monthly_budget) > 0) {
    const used = Number(order.budget.used_excluding_this || 0) + t.grand;
    const pct = Math.min(100, Math.round(used / Number(order.budget.monthly_budget) * 100));
    budgetCard = `<div class="card"><h2 style="font-size:.95rem;margin:0 0 6px;color:var(--navy)">Budget impact <span class="badge" style="font-size:.66rem">Finance</span></h2>
      <div class="u-muted" style="font-size:.82rem">Month-to-date including this order</div>
      <div style="font-size:1.15rem;font-weight:800;margin:4px 0">${fmt(used)} <span class="u-muted" style="font-weight:600">of ${fmt(order.budget.monthly_budget)}</span></div>
      <div style="height:10px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${pct > 90 ? 'var(--danger)' : 'var(--blue,#3b82f6)'}"></i></div>
      <div class="u-muted" style="font-size:.78rem;margin-top:4px">${pct}% used · committed value</div></div>`;
  }
  // Estimated-delivery card — ops sets the date the client sees on their order
  // page. Hidden on terminal states (delivered/closed/cancelled).
  const today = new Date().toISOString().slice(0, 10);
  const pdd = order.predicted_delivery_date;
  const pddTerminal = ['CLOSED', 'DELIVERED', 'CANCELLED'].includes(order.status);
  const pddLate = pdd && pdd < today && !pddTerminal;
  const estCard = pddTerminal ? '' : `<div class="card"><h2 style="font-size:.95rem;margin:0 0 8px;color:var(--navy)">📅 Estimated delivery</h2>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <input type="date" id="of-pdd-input" value="${pdd || ''}" min="${today}" aria-label="Estimated delivery date"
        style="padding:7px 10px;border:1px solid var(--border);border-radius:7px;font-size:.85rem;background:var(--surface);color:var(--text)">
      <button class="btn btn-primary btn-sm" ${dataAct('savePredictedDelivery', order.id)}>Save</button>
      ${pdd ? `<button class="btn btn-secondary btn-sm" ${dataAct('clearPredictedDelivery', order.id)}>Clear</button>` : ''}
    </div>
    <div class="u-muted" style="font-size:.78rem;margin-top:8px">${pdd
      ? `Set to <b style="color:${pddLate ? 'var(--danger)' : 'var(--success)'}">${fmtDate(pdd)}${pddLate ? ' · overdue' : ''}</b>. `
      : 'Not set — the client sees “We’ll confirm the date shortly”. '}This is shown to the client as their estimated delivery date.</div>
  </div>`;
  const commentsBody = `<div id="order-comments" style="display:grid;gap:8px">${(c.comments || []).length
    ? c.comments.map(cm => `<div style="background:var(--bg,var(--surface-2));border-radius:8px;padding:9px 11px;font-size:.84rem"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><b>${h(cm.author_name)}</b><span class="u-muted">${timeAgo(cm.created_at)}</span></div><div>${h(cm.message)}</div></div>`).join('')
    : `<p class="u-muted" style="font-size:.84rem;margin:0">No comments yet.</p>`}</div>`;
  return `<div class="sub" style="color:var(--text-muted);font-size:.84rem;margin:12px 2px 0">${h(order.client_name || '—')} · Placed ${fmtDate(order.created_at)} · ${h(order.order_type || 'Regular')}${order.order_period ? ' · For ' + new Date(order.order_period + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : ''}${order.order_reference && order.order_reference !== order.id ? ' · Ref ' + h(order.order_reference) : ''}</div>
  <div class="ofgrid">
    <div class="ofstack">
      <div class="card">${ofStepperHtml(order)}</div>
      <div class="card"><h2 style="font-size:.95rem;margin:0 0 10px;color:var(--navy)">Delivery reconciliation <span class="u-muted" style="font-weight:600">· click a box for the detail</span></h2>${ofReconBoxesHtml(c.recon)}</div>
      ${amend ? `<div class="card"><h2 style="font-size:.95rem;margin:0 0 10px;color:var(--navy)">Amendments</h2>${amend}</div>` : ''}
    </div>
    <div class="ofstack">
      <div class="card oftot"><h2 style="font-size:.95rem;margin:0 0 10px;color:var(--navy)">Totals</h2>
        <div><span>Subtotal (before tax)</span><span>${fmt(t.sub)}</span></div>
        <div><span>GST</span><span>${fmt(t.gst)}</span></div>
        <div class="g"><span>Grand total</span><span>${fmt(t.grand)}</span></div></div>
      ${estCard}
      ${budgetCard}
      <div class="card"><h2 style="font-size:.95rem;margin:0 0 8px;color:var(--navy)">Comments</h2>${commentsBody}
        <div style="display:flex;gap:8px;margin-top:10px"><input type="text" id="comment-input" placeholder="Add a comment…" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:.85rem"><button class="btn btn-primary btn-sm" ${dataAct('addOrderComment', c.id)}>Post</button></div></div>
    </div>
  </div>`;
}
function ofTabDelivery() {
  const c = APP._ofCtx, r = c.recon, view = c.view || 'item';
  const header = `<div class="card"><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span style="font-size:2rem;font-weight:800;color:#0C8E6D">${r.pctDelQty}%</span>
    <div style="flex:1;min-width:160px"><div style="height:10px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:${Math.min(100, r.pctDelQty)}%;background:#0C8E6D"></i></div>
    <div class="u-muted" style="margin-top:4px"><b>${r.delQty.toLocaleString('en-IN')} of ${r.ordQty.toLocaleString('en-IN')}</b> units · ${r.delItems} of ${r.ordItems} items</div></div></div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button type="button" ${dataAct('ofGoTab', 'delivery', 'item')} aria-pressed="${view === 'item'}" style="border:1px solid ${view === 'item' ? 'var(--navy)' : 'var(--border)'};background:${view === 'item' ? 'var(--navy)' : 'var(--surface)'};color:${view === 'item' ? '#fff' : 'var(--text)'};border-radius:999px;padding:5px 13px;font-weight:600;font-size:.82rem;cursor:pointer">By item</button>
      <button type="button" ${dataAct('ofGoTab', 'delivery', 'due')} aria-pressed="${view === 'due'}" style="border:1px solid ${view === 'due' ? 'var(--navy)' : 'var(--border)'};background:${view === 'due' ? 'var(--navy)' : 'var(--surface)'};color:${view === 'due' ? '#fff' : 'var(--text)'};border-radius:999px;padding:5px 13px;font-weight:600;font-size:.82rem;cursor:pointer">Due list (${c.dueLines.length})</button>
    </div></div>`;
  const body = view === 'due' ? ofDueListHtml() : `<div class="card">${renderDDByItem()}</div>`;
  return header + body;
}
function ofDueListHtml() {
  const c = APP._ofCtx, due = c.dueLines;
  if (!due.length) return `<div class="card" style="text-align:center;color:#0C8E6D;font-weight:600;padding:28px">✓ Nothing is waiting to be delivered on this order.</div>`;
  const rows = due.map(l => `<tr>
    <td><input type="checkbox" data-ofdue="${h(l.sku)}" ${c.sel[l.sku] ? 'checked' : ''} aria-label="Select ${h(l.name || l.sku)}"></td>
    <td><b>${h(l.name || l.sku)}</b><div class="u-subtiny" style="font-family:monospace">${h(l.sku)}</div></td>
    <td class="u-right" style="color:var(--red);font-weight:800">${Number(l.qty_due).toLocaleString('en-IN')}</td>
    <td class="u-right" style="color:var(--red)">${fmt(l.value_due)}</td>
    <td class="u-right">${Number(l.qty_delivered).toLocaleString('en-IN')}</td></tr>`).join('');
  return `<div class="card"><div class="oftw"><table class="oftable">
      <thead><tr><th style="width:34px"><input type="checkbox" id="of-due-all" aria-label="Select all"></th><th>Item</th><th class="u-right">Still due</th><th class="u-right">Due ₹</th><th class="u-right">Delivered so far</th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>
    <div id="of-duebar"></div>`;
}
function ofBindDueList() {
  const c = APP._ofCtx;
  const all = document.getElementById('of-due-all');
  if (all) all.onchange = () => { c.dueLines.forEach(l => { c.sel[l.sku] = all.checked; }); document.querySelectorAll('[data-ofdue]').forEach(cb => { cb.checked = all.checked; }); ofDueBar(); };
  document.querySelectorAll('[data-ofdue]').forEach(cb => { cb.onchange = () => { c.sel[cb.dataset.ofdue] = cb.checked; ofDueBar(); }; });
  ofDueBar();
}
function ofDueBar() {
  const c = APP._ofCtx, bar = document.getElementById('of-duebar'); if (!bar) return;
  let n = 0, u = 0, v = 0;
  c.dueLines.forEach(l => { if (c.sel[l.sku]) { n++; u += Number(l.qty_due) || 0; v += Number(l.value_due) || 0; } });
  if (!n) { bar.innerHTML = ''; return; }
  bar.innerHTML = `<div style="position:sticky;bottom:10px;background:var(--navy);color:#fff;border-radius:12px;padding:10px 14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:12px">
    <span><b>${n} item${n > 1 ? 's' : ''} selected</b> · ${u.toLocaleString('en-IN')} units · ${fmt(v)}</span>
    <span style="display:flex;gap:8px"><button class="btn btn-sm" ${dataAct('ofClearDue')} style="border-color:#fff;background:transparent;color:#fff">Clear</button>
    <button class="btn btn-sm btn-primary" ${dataAct('ofPickSelected', c.id)}>Pick &amp; dispatch selected →</button></span></div>`;
}
function ofClearDue() { const c = APP._ofCtx; if (!c) return; c.sel = {}; ofRenderBody(); }
// Carry the selected due lines into the pick screen, prefilled to their full due qty.
function ofPickSelected(id) {
  const c = APP._ofCtx;
  const sel = c ? Object.keys(c.sel).filter(sku => c.sel[sku]) : [];
  pickOrderModal(id, sel);
}
const OF_DC_TONE = { DELIVERED: '#0C8E6D', IN_TRANSIT: '#06b6d4', SCHEDULED: '#B5731A', CANCELLED: '#ef4444' };
function ofChallanValue(dc, priceMap) {
  const useDel = dc.status === 'DELIVERED';
  return (dc.items || []).reduce((s, it) => s + (useDel ? (Number(it.qty_delivered) || 0) : (Number(it.qty_ordered) || 0)) * (Number(priceMap[it.sku]) || 0), 0);
}
function ofTabChallans() {
  const c = APP._ofCtx, dcs = (c.drill && c.drill.dcs) || [];
  if (!dcs.length) return `<div class="card" style="margin-top:12px;text-align:center;color:var(--text-muted);padding:28px">No challans yet. Use "Dispatch remaining" to pick items and create the first one.</div>`;
  const priceMap = {}; ((c.drill && c.drill.lines) || []).forEach(l => { priceMap[l.sku] = Number(l.unit_price) || 0; });
  c.openDc = c.openDc || {};
  const tone = s => OF_DC_TONE[s] || '#6b7280';
  const rows = dcs.slice().reverse().map(dc => {
    const ref = dc.dc_number || dc.id, items = dc.items || [], nItems = items.length, useDel = dc.status === 'DELIVERED';
    const units = items.reduce((s, it) => s + (useDel ? (Number(it.qty_delivered) || 0) : (Number(it.qty_ordered) || 0)), 0);
    const shortUnits = useDel ? items.reduce((s, it) => s + Math.max(0, (Number(it.qty_ordered) || 0) - (Number(it.qty_delivered) || 0)), 0) : 0;
    const val = ofChallanValue(dc, priceMap), open = !!c.openDc[ref], pv = items.slice(0, 3);
    const expand = open ? `<div style="grid-column:1/-1;background:var(--bg,var(--surface-2));border-radius:10px;padding:10px 12px;margin-top:8px">
      <table class="table" style="font-size:.8rem;margin:0"><thead><tr><th>Item</th><th>SKU</th><th class="u-right">Qty</th></tr></thead>
        <tbody>${pv.map(x => `<tr><td>${h(x.name || x.sku)}</td><td style="font-family:monospace;color:var(--text-muted)">${h(x.sku)}</td><td class="u-right">${Number((useDel ? x.qty_delivered : x.qty_ordered) || 0).toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;gap:8px;flex-wrap:wrap"><span class="u-muted" style="font-size:.78rem">Showing ${pv.length} of ${nItems} items</span>${nItems > 3 ? `<button class="btn btn-primary btn-sm" ${dataAct('ofChallanPanel', ref)}>View all ${nItems} items →</button>` : ''}</div></div>` : '';
    return `<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px 14px;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
      <div><b style="color:var(--navy)">${h(ref)}</b>
        <span style="margin-left:6px;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${tone(dc.status)}22;color:${tone(dc.status)}">${dc.status}</span>
        ${shortUnits > 0 ? `<span style="margin-left:4px;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:999px;background:#B5731A22;color:#B5731A">${shortUnits.toLocaleString('en-IN')} short</span>` : ''}
        <div class="u-muted" style="font-size:.78rem;margin-top:2px">${dc.delivered_at ? fmtDate(dc.delivered_at) + ' · ' : dc.dispatched_at ? fmtDate(dc.dispatched_at) + ' · ' : ''}${nItems} item${nItems !== 1 ? 's' : ''} · ${units.toLocaleString('en-IN')} units</div></div>
      <b style="text-align:right;font-variant-numeric:tabular-nums">${fmt(val)}</b>
      <button class="btn btn-secondary btn-sm" ${dataActEl('ofChallanToggle', ref)} aria-expanded="${open}">${open ? 'Hide items' : 'View items'}</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('ofChallanPDF', ref)}>PDF</button>
      ${expand}
    </div>`;
  }).join('');
  return `<div class="card" style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px"><h2 style="font-size:.95rem;margin:0;color:var(--navy)">Delivery challans (${dcs.length})</h2>
      <button class="btn btn-secondary btn-sm" ${dataAct('ofChallanPanel', '*')}>View all items across challans</button></div>
    ${rows}</div>`;
}
function ofChallanToggle(ref) {
  const c = APP._ofCtx; if (!c) return; c.openDc = c.openDc || {};
  c.openDc[ref] = !c.openDc[ref];
  const y = window.scrollY; ofRenderBody(); try { window.scrollTo(0, y); } catch (_) {}
}
function ofChallanPDF() { ddExportPDF(); }   // per-challan PDF not available — reuse the order breakdown PDF
// Searchable item panel (reuses the order drawer). ref '*' = all challans.
function ofChallanPanel(ref) {
  injectOrderFullCss(); ensureOrderDrawer();
  _odTrigger = document.activeElement;
  APP._ofPanel = { ref, q: '' };
  document.getElementById('od-drawer').classList.add('on');
  document.getElementById('od-scrim').classList.add('on');
  document.addEventListener('keydown', _odKeydown, true);
  ofRenderPanel();
  const x = document.getElementById('ofp-x'); if (x) x.focus();
}
function ofRenderPanel() {
  const p = APP._ofPanel, d = APP._dd, dr = document.getElementById('od-drawer'); if (!p || !d || !dr) return;
  const multi = p.ref === '*';
  const all = [];
  (d.dcs || []).forEach(dc => { if (!multi && (dc.dc_number || dc.id) !== p.ref) return; const useDel = dc.status === 'DELIVERED'; (dc.items || []).forEach(it => all.push({ name: it.name, sku: it.sku, qty: Number((useDel ? it.qty_delivered : it.qty_ordered)) || 0, ref: dc.dc_number || dc.id })); });
  const q = (p.q || '').toLowerCase();
  const matched = all.filter(x => !q || (`${x.name || ''} ${x.sku || ''} ${x.ref}`).toLowerCase().includes(q));
  const capped = matched.slice(0, 200), totU = matched.reduce((s, x) => s + x.qty, 0);
  dr.innerHTML = `<div class="in"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><h2 style="margin:0;font-size:1rem">${multi ? 'All challans' : h(p.ref)} · items</h2><button class="btn" id="ofp-x" ${dataAct('closeOrderDrawer')} aria-label="Close">✕</button></div>
    <div class="u-muted" style="font-size:.82rem;margin:4px 0 10px">${all.length} line${all.length === 1 ? '' : 's'}${multi ? ` across ${(d.dcs || []).length} challans` : ''}</div>
    <input type="text" id="ofp-q" placeholder="Search item, SKU${multi ? ' or challan' : ''}" value="${(p.q || '').replace(/"/g, '&quot;')}" aria-label="Search items" style="width:100%;margin-bottom:8px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:7px 10px">
    <div style="overflow:auto;max-height:58vh"><table class="table" style="font-size:.82rem;margin:0"><thead><tr><th>Item</th><th>SKU</th>${multi ? '<th>Challan</th>' : ''}<th class="u-right">Qty</th></tr></thead>
      <tbody>${capped.length ? capped.map(x => `<tr><td>${h(x.name || x.sku)}</td><td style="font-family:monospace;color:var(--text-muted)">${h(x.sku)}</td>${multi ? `<td class="u-muted">${h(x.ref)}</td>` : ''}<td class="u-right">${x.qty.toLocaleString('en-IN')}</td></tr>`).join('') : `<tr><td colspan="${multi ? 4 : 3}" class="u-muted" style="padding:14px">No items match.</td></tr>`}</tbody></table></div>
    ${matched.length > 200 ? `<div class="u-muted" style="font-size:.76rem;margin-top:6px">Showing first 200 of ${matched.length.toLocaleString('en-IN')} — refine your search to narrow the list.</div>` : ''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap;gap:8px"><b>${matched.length.toLocaleString('en-IN')} item${matched.length === 1 ? '' : 's'} · ${totU.toLocaleString('en-IN')} units</b><span style="display:flex;gap:8px"><button class="btn btn-secondary btn-sm" ${dataAct('ddExportCSV')}>⬇ Excel</button><button class="btn btn-secondary btn-sm" ${dataAct('ddExportPDF')}>⬇ PDF</button></span></div></div>`;
  const qi = document.getElementById('ofp-q');
  if (qi) qi.oninput = function () { const pos = this.selectionStart; APP._ofPanel.q = this.value; ofRenderPanel(); const z = document.getElementById('ofp-q'); if (z) { z.focus(); try { z.setSelectionRange(pos, pos); } catch (_) {} } };
}
function ofTabAmend() {
  const c = APP._ofCtx, amend = amendmentSummaryHTML(c.order);
  return amend ? `<div class="card" style="margin-top:12px"><h2 style="font-size:.95rem;margin:0 0 10px;color:var(--navy)">Amendments</h2>${amend}</div>`
    : `<div class="card" style="margin-top:12px;text-align:center;color:var(--text-muted);padding:28px">No amendments on this order.</div>`;
}
function ofTabTimeline() {
  const c = APP._ofCtx, hist = c.order.history || [];
  return `<div class="card" style="margin-top:12px"><h2 style="font-size:.95rem;margin:0 0 10px;color:var(--navy)">Timeline</h2>${hist.length
    ? `<div style="display:grid;gap:6px">${hist.slice().reverse().map(ev => `<div style="display:flex;gap:10px;font-size:.84rem"><span style="color:var(--text-muted);min-width:96px">${fmtDate(ev.created_at)}</span><span>${statusBadge(ev.to_status)}</span><span class="u-muted">${h(ev.actor_name || '')}${ev.note ? ' — ' + h(ev.note) : ''}</span></div>`).join('')}</div>`
    : `<p class="u-muted" style="font-size:.84rem;margin:0">No events yet.</p>`}</div>`;
}

// Navigate to the full-page order view (admin), remembering the queue scroll.
function openOrderFull(id) {
  try { APP._oqScroll = window.scrollY || 0; } catch (_) { APP._oqScroll = 0; }
  navigate('order_view', { tab: id });
}
function ofBackToOrders() { navigate('orders', { tab: 'queue' }); }
// Export handlers reuse the drilldown read-model (APP._dd) set by renderOrderFull.
function ofMoreExcel(id) { const p = document.getElementById('of-more-pop'); if (p) p.classList.remove('on'); ddExportCSV(); }
function ofMorePDF(id) { const p = document.getElementById('of-more-pop'); if (p) p.classList.remove('on'); ddExportPDF(); }

// ⋯ More menu open/close (keyboard + outside-click aware).
function orderMoreToggle(el) {
  const pop = document.getElementById('of-more-pop'); if (!pop) return;
  const open = !pop.classList.contains('on');
  pop.classList.toggle('on', open);
  el.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return;
      if (e.type === 'click' && (pop.contains(e.target) || el.contains(e.target))) return;
      pop.classList.remove('on'); el.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', close, true); document.removeEventListener('keydown', close, true);
      if (e.type === 'keydown') el.focus();
    };
    setTimeout(() => { document.addEventListener('click', close, true); document.addEventListener('keydown', close, true); }, 0);
    const first = pop.querySelector('button'); if (first) first.focus();
  }
}
function ofMoreDownload(id) { const p = document.getElementById('of-more-pop'); if (p) p.classList.remove('on'); viewOrderDrilldown(id); }
function ofMoreAmend(id) { const p = document.getElementById('of-more-pop'); if (p) p.classList.remove('on'); amendOrderModal(id); }

/* ── Cancel dialog with a required reason (maps to the transition note) ── */
function orderCancelDialog(id) {
  const p = document.getElementById('of-more-pop'); if (p) p.classList.remove('on');
  const opts = (window.CANCEL_REASONS || ['Client requested', 'Out of stock', 'Duplicate order', 'Other'])
    .map(r => `<option value="${h(r)}">${h(r)}</option>`).join('');
  openModal(`Cancel order ${id}?`,
    `<div class="u-muted" style="margin:0 0 4px">This can't be undone. Choose a reason so the client sees an explanation.</div>
     <label for="oc-reason" style="display:block;font-size:.82rem;font-weight:600;margin-top:10px">Reason</label>
     <select id="oc-reason" style="width:100%;margin-top:6px;padding:8px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface)">
       <option value="">— select a reason —</option>${opts}
     </select>
     <div id="oc-err" style="color:var(--danger);font-size:.8rem;margin-top:6px;display:none"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Keep order</button>
     <button class="btn btn-danger" ${dataAct('confirmOrderCancel', id)}>Cancel order</button>`);
}
async function confirmOrderCancel(id) {
  const reason = (document.getElementById('oc-reason') || {}).value || '';
  const v = window.validateCancelReason(reason);
  if (!v.ok) { const e = document.getElementById('oc-err'); if (e) { e.textContent = v.error; e.style.display = 'block'; } return; }
  const res = await api(`/orders/${id}/transition`, { method: 'POST', body: JSON.stringify({ to: 'CANCELLED', note: `Cancelled — ${reason}` }) });
  closeModal();
  if (res) { showToast(`Order ${id} cancelled`); navigate('orders', { tab: 'queue' }); }
}

/* ── Quick-view drawer (from the list View button) ───────────── */
let _odTrigger = null;
function ensureOrderDrawer() {
  if (document.getElementById('od-scrim')) return;
  const scrim = document.createElement('div'); scrim.id = 'od-scrim'; scrim.className = 'odscrim';
  scrim.addEventListener('click', closeOrderDrawer);
  const aside = document.createElement('aside'); aside.id = 'od-drawer'; aside.className = 'odrawer';
  aside.setAttribute('aria-label', 'Order quick view'); aside.setAttribute('role', 'dialog'); aside.setAttribute('aria-modal', 'true');
  document.body.appendChild(scrim); document.body.appendChild(aside);
}
function closeOrderDrawer() {
  const sc = document.getElementById('od-scrim'), dr = document.getElementById('od-drawer');
  if (sc) sc.classList.remove('on'); if (dr) dr.classList.remove('on');
  document.removeEventListener('keydown', _odKeydown, true);
  if (_odTrigger && document.contains(_odTrigger)) { try { _odTrigger.focus(); } catch (_) {} }
  _odTrigger = null;
}
function _odKeydown(e) {
  if (e.key === 'Escape') { e.stopPropagation(); closeOrderDrawer(); return; }
  if (e.key === 'Tab') { // simple focus trap
    const dr = document.getElementById('od-drawer'); if (!dr) return;
    const f = dr.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
async function openOrderDrawer(id, triggerEl) {
  injectOrderFullCss(); ensureOrderDrawer();
  _odTrigger = triggerEl || document.activeElement;
  const dr = document.getElementById('od-drawer'), sc = document.getElementById('od-scrim');
  dr.innerHTML = `<div class="in"><div class="loading-state"><div class="spinner"></div><p>Loading ${h(id)}…</p></div></div>`;
  sc.classList.add('on'); dr.classList.add('on');
  document.addEventListener('keydown', _odKeydown, true);
  const [order, dcRes, drill] = await Promise.all([
    api('/orders/' + id),
    api('/delivery-challans').catch(() => null),
    api('/orders/' + id + '/drilldown').catch(() => null),
  ]);
  if (!document.getElementById('od-drawer') || !dr.classList.contains('on')) return; // closed while loading
  if (!order) { dr.innerHTML = `<div class="in"><div class="dh" style="display:flex;justify-content:space-between"><h2>Order not found</h2><button class="btn" ${dataAct('closeOrderDrawer')} aria-label="Close">✕</button></div></div>`; return; }
  const orderDCs = (dcRes || []).filter(d => d.order_id === id);
  const { recon } = ofComputeLines(order, drill);
  const lineCount = (order.items || []).length;
  const totalQty = (order.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const pa = ofPrimaryAction(order, orderDCs);
  const naBtn = pa && pa.act ? `<button class="btn" ${pa.act}>${h(pa.label)} →</button>` : '';
  dr.innerHTML = `<div class="in">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
      <div><div style="font-size:1.1rem;font-weight:800;color:var(--navy)">${h(order.id)}</div><div class="u-muted" style="font-size:.84rem">${h(order.client_name || '—')}</div></div>
      <button class="btn" id="od-x" ${dataAct('closeOrderDrawer')} aria-label="Close preview">✕</button>
    </div>
    <div style="margin-top:10px">${statusBadge(order.status)}</div>
    <div class="odkv">
      <span>Placed</span><span>${fmtDate(order.created_at)}</span>
      <span>Type</span><span>${h(order.order_type || 'Regular')}</span>
      <span>Value</span><span style="font-weight:700">${fmt(order.grand_total)}</span>
      <span>Lines</span><span>${lineCount} item${lineCount !== 1 ? 's' : ''} · ${totalQty.toLocaleString('en-IN')} units</span>
    </div>
    <div class="card" style="padding:12px">${ofReconCardHtml(recon)}</div>
    <div style="margin-top:14px">${ofStepperHtml(order)}</div>
    <div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">
      <button class="btn btn-primary" ${dataAct('ofDrawerOpenFull', id)}>Open full order →</button>
      ${naBtn}
    </div>
  </div>`;
  const x = document.getElementById('od-x'); if (x) x.focus();
}
function ofDrawerOpenFull(id) { closeOrderDrawer(); openOrderFull(id); }

/* ============================================================
   CLIENT ORDER DETAIL (#client_order/<id>)
   Client-facing, client-safe. Data from /orders/:id/client-view
   (ownership-enforced, no internal fields). Stepper/headline/recon from
   client-order.js. Help card raises tickets via the existing /tickets
   endpoint (order-linked).
   ============================================================ */
let _coCssDone = false;
function injectClientOrderCss() {
  if (_coCssDone) return; _coCssDone = true;
  const css = `
  /* Centred, document-width container so the order reads like an ERP record
     page on wide screens (matches the admin order view's 1040–1100px band). */
  .co-wrap{max-width:1040px;margin:0 auto}
  .co-wrap > *{margin-top:12px}
  .co-wrap > :first-child{margin-top:0}
  .co-h2{font-size:.95rem;margin:0 0 10px;color:var(--navy);display:flex;align-items:center;gap:7px;font-weight:800}
  /* header */
  .co-crumb{margin-bottom:12px}
  .co-head{display:flex;justify-content:space-between;gap:12px 16px;flex-wrap:wrap;align-items:flex-start}
  .co-title h1{font-size:1.35rem;line-height:1.2;font-weight:800;color:var(--navy);margin:0}
  .co-sub{color:var(--text-muted);font-size:.84rem;margin-top:4px}
  .co-head-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .co-hbadge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 12px;font-size:.74rem;font-weight:700;border:1px solid currentColor;white-space:nowrap}
  /* hero */
  .cohero{border-left:4px solid var(--co-c,var(--text-muted))}
  .cohero-status{font-size:1.15rem;font-weight:800;line-height:1.25}
  .cohero-detail{color:var(--text-muted);font-size:.9rem;margin-top:4px}
  .co-est{display:flex;gap:8px;align-items:center;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:.86rem;margin-top:12px}
  .co-cancel{padding:12px 14px;background:var(--danger-bg);border:1px solid var(--danger);border-radius:var(--radius);color:var(--danger);font-weight:700;font-size:.9rem}
  /* stepper */
  .costepper{display:flex;gap:4px}
  .costep{flex:1;min-width:66px;text-align:center;position:relative;font-size:.78rem;color:var(--text-muted)}
  .costep ic{display:flex;width:28px;height:28px;border-radius:50%;margin:0 auto 5px;align-items:center;justify-content:center;font-weight:700;font-size:.8rem;background:var(--surface-2);border:2px solid var(--border);position:relative;z-index:1}
  .costep::before{content:"";position:absolute;top:13px;left:-50%;width:100%;height:3px;background:var(--border)}
  .costep:first-child::before{display:none}
  .costep.done ic{background:var(--success);border-color:var(--success);color:#fff}
  .costep.done::before,.costep.cur::before{background:var(--success)}
  .costep.cur ic{border-color:var(--warning);color:var(--warning);background:var(--surface)}
  .costep b{display:block;color:var(--text-muted);font-weight:700}
  .costep.done b{color:var(--success)}.costep.cur b{color:var(--navy)}
  .costep small{display:block;font-size:.68rem;color:var(--text-muted);margin-top:1px}
  /* reconciliation */
  .co-recon-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
  .cocols{display:grid;grid-template-columns:repeat(3,1fr);margin-top:14px}
  .cocol{padding:0 16px;border-left:1px solid var(--border)}
  .cocol:first-child{border:0;padding-left:0}
  .cocol-k{font-size:.72rem;font-weight:700;letter-spacing:.3px;color:var(--text-muted)}
  .cocol-v{font-size:1.4rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:2px}
  .cocol-s{color:var(--text-muted);font-size:.76rem;margin-top:3px}
  .cocol-bar{height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden;margin-top:6px}
  .cocol-bar i{display:block;height:100%}
  .coseg{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-top:16px;background:var(--surface-2)}
  .coseg button{border:0;padding:0;cursor:pointer;height:100%}
  .cotabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .cotab{border:1px solid var(--border);background:var(--surface-2);color:var(--text);border-radius:999px;padding:5px 12px;font-size:.82rem;cursor:pointer;display:inline-flex;gap:7px;align-items:center}
  .cotab[aria-pressed="true"]{border-color:var(--navy);font-weight:700}
  .cotw{overflow-x:auto;margin-top:12px;border:1px solid var(--border);border-radius:var(--radius)}
  .cotw.scroll{max-height:520px;overflow:auto}
  .cotable{width:100%;border-collapse:collapse;min-width:460px}
  .cotable th,.cotable td{padding:9px 12px;border-bottom:1px solid var(--border);text-align:left;font-size:.84rem}
  .cotable tr:last-child td{border-bottom:0}
  .cotable th{color:var(--text-muted);font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.3px;position:sticky;top:0;background:var(--surface);z-index:1}
  .cotable .n{text-align:right;font-variant-numeric:tabular-nums}
  @media (max-width:700px){
    .co-title h1{font-size:1.15rem}
    .cocols{grid-template-columns:1fr}
    .cocol{border:0;border-top:1px solid var(--border);padding:12px 0 0}
    .cocol:first-child{border-top:0;padding-top:0}
    .costepper{overflow-x:auto;padding-bottom:4px}
    .costep small{display:none}
  }`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}
const CO_COLORVAR = { grey: 'var(--text-muted)', amber: 'var(--warning)', green: 'var(--success)' };

function openClientOrder(id) {
  try { APP._moScroll = window.scrollY || 0; } catch (_) { APP._moScroll = 0; }
  navigate('client_order', { tab: id });
}
function clientBackToOrders() { navigate('my_orders', { tab: 'orders' }); }

async function renderClientOrder(el) {
  injectClientOrderCss();
  const id = APP._navTab || parseHash().tab || '';
  if (!id) { el.innerHTML = notImplemented('client_order'); return; }
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading ${h(id)}…</p></div>`;
  const o = await api('/orders/' + id + '/client-view').catch(() => null);
  if (!o || o.error) {
    el.innerHTML = `<div class="card" style="padding:40px;text-align:center">
      <div style="font-size:2.4rem">🔍</div>
      <div style="font-weight:800;color:var(--navy);margin-top:8px">Order not found</div>
      <div style="color:var(--text-muted);font-size:.86rem;margin-top:4px">We couldn't find ${h(id)} on your account.</div>
      <button class="btn btn-secondary" style="margin-top:16px" ${dataAct('clientBackToOrders')}>← Back to My Orders</button>
    </div>`;
    return;
  }
  APP._coOrder = o;

  const lines = (o.items || []).map(i => ({ name: i.name, ordered: Number(i.ordered) || 0, delivered: Number(i.delivered) || 0, due: Number(i.due) || 0 }));
  const recon = window.oreconTotals(lines);
  let cFull = 0, cPart = 0, cPend = 0;
  lines.forEach(l => { const s = window.olineStatus(l.ordered, l.delivered); if (s === 'full') cFull++; else if (s === 'partial') cPart++; else cPend++; });

  const headline = window.clientHeadline({
    approved: o.approved, cancelled: o.cancelled,
    orderedQty: recon.ordQty, deliveredQty: recon.delQty,
    totalItems: recon.ordItems, fullItems: recon.delItems, dueItems: recon.dueItems, dueUnits: recon.dueQty,
  });
  const submittedDate = o.created_at ? fmtDate(o.created_at) : '';
  const approvedDate = o.approved_at ? fmtDate(o.approved_at) : '';
  const deliveredDate = o.delivered_on ? fmtDate(o.delivered_on) : '';
  const steps = window.clientSteps({
    approved: o.approved, cancelled: o.cancelled, orderedQty: recon.ordQty, deliveredQty: recon.delQty,
    submittedDate, approvedDate, deliveredDate,
  });
  const colorVar = CO_COLORVAR[headline.color] || 'var(--text-muted)';

  // Estimated delivery line.
  const full = recon.ordQty > 0 && recon.delQty >= recon.ordQty;
  const estText = o.cancelled ? ''
    : full ? `Delivered${deliveredDate ? ' on ' + deliveredDate : ''}`
    : o.predicted_delivery_date ? fmtDate(o.predicted_delivery_date)
    : o.approved ? "We'll confirm the date shortly"
    : "We'll confirm the date after approval";

  const period = o.order_period ? new Date(o.order_period + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
  const reconBadgeColor = headline.badge === 'Delivered' ? 'var(--success)' : headline.badge === 'Partially Delivered' ? 'var(--warning)' : 'var(--text-muted)';

  // Ticket help card: list open tickets (don't encourage duplicates), else raise buttons.
  const tickets = o.tickets || [];
  const helpBody = tickets.length
    ? `<div class="u-muted" style="margin:4px 0 10px">You already have ${tickets.length === 1 ? 'a support request' : 'support requests'} open for this order:</div>
       <div style="display:grid;gap:8px;margin-bottom:10px">${tickets.map(t => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:8px;padding:9px 12px">
         <div><button type="button" ${dataAct('navigate', 'service_desk')} style="background:none;border:0;padding:0;color:var(--primary);font-weight:700;cursor:pointer">${h(t.id)}</button> <span class="u-muted" style="font-size:.82rem">${h(t.subject || '')}</span></div>
         <span class="badge" style="font-size:.7rem">${h(t.status || 'OPEN')}</span></div>`).join('')}</div>
       <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" ${dataAct('clientOrderTicket', id, 'support')}>Contact support</button><button class="btn btn-secondary btn-sm" ${dataAct('reorderFromHistory', id)}>🔄 Reorder</button></div>`
    : `<div class="u-muted" style="margin:4px 0 10px">Questions about a late or missing item? Your account team can check it.</div>
       <div class="row" style="display:flex;gap:8px;flex-wrap:wrap">
         <button class="btn btn-primary" ${dataAct('clientOrderTicket', id, 'support')}>Contact support</button>
         <button class="btn btn-secondary" ${dataAct('clientOrderTicket', id, 'issue')}>Report an issue</button>
         <button class="btn btn-secondary" ${dataAct('reorderFromHistory', id)}>🔄 Reorder</button>
       </div>`;

  // Delivery notes: existing delivery breakdown when there's something delivered.
  const deliveryNotesBtn = recon.delQty > 0
    ? `<button class="btn btn-secondary btn-sm" ${dataAct('viewOrderDrilldown', id)}>📄 Delivery notes</button>`
    : `<button class="btn btn-secondary btn-sm" disabled title="Available once your order ships">📄 Delivery notes</button>`;

  const stepperHtml = o.cancelled
    ? `<div class="co-cancel">❌ This order was cancelled.</div>`
    : `<div class="costepper">${steps.labels.map((lab, i) => {
        const c = steps.states[i];
        return `<div class="costep ${c}"><ic>${c === 'done' ? '✓' : (i + 1)}</ic><b>${lab}</b><small>${h(steps.subs[i] || '')}</small></div>`;
      }).join('')}</div>`;

  // A change our team made that is waiting for THIS client to approve.
  const isApprover = ['client_admin', 'client_approver'].includes(APP.user?.role || '');
  const amendReviewHtml = o.awaiting_amendment_approval ? `
  <section class="card" style="margin-top:12px;border:1px solid var(--gold-border);background:var(--amber-bg)" aria-label="Changes awaiting your approval">
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:1.1rem">✏️</span>
      <h2 style="font-size:1rem;margin:0;color:var(--amber-text)">Changes awaiting your approval</h2></div>
    <div style="font-size:.86rem;margin:6px 0 10px;color:var(--amber-text)">Our team updated this order${o.amendment && o.amendment.reason ? ' — ' + h(o.amendment.reason) : ''}. Review the change, then approve to resume fulfilment or reject to keep the previous version.</div>
    ${amendmentSummaryHTML({ amendments: [o.amendment] })}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      ${isApprover
        ? `<button class="btn btn-primary" ${dataAct('approveOrder', o.id)}>✓ Approve changes</button>
           <button class="btn btn-secondary" style="color:var(--danger);border-color:var(--danger)" ${dataAct('rejectAmendment', o.id)}>✕ Reject changes</button>`
        : `<span class="badge badge-warning" style="padding:8px 12px">⏳ Pending your approver's review</span>`}
    </div>
  </section>` : '';

  APP._coFilter = 'all';
  el.innerHTML = `
  <div class="co-wrap">
    <div class="co-crumb"><button class="btn btn-secondary btn-sm" ${dataAct('clientBackToOrders')}>← Back to My Orders</button></div>

    <div class="co-head">
      <div class="co-title">
        <h1>Order ${h(o.id)}</h1>
        <div class="co-sub">${h(o.order_type || 'Regular')} · Placed ${fmtDate(o.created_at)}${period ? ' · For ' + period : ''}${o.client_name ? ' · ' + h(o.client_name) : ''}${o.order_reference && o.order_reference !== o.id ? ' · Ref ' + h(o.order_reference) : ''}</div>
      </div>
      <div class="co-head-actions">
        ${o.cancelled ? '' : `<span class="co-hbadge" style="color:${reconBadgeColor}">📦 ${h(headline.badge)}</span>`}
        <button class="btn btn-secondary btn-sm" id="co-tl-btn" aria-expanded="false" ${dataActEl('clientOrderToggleTimeline')}>🧭 Timeline</button>
        ${deliveryNotesBtn}
      </div>
    </div>

    ${amendReviewHtml}

    <section class="card" id="co-tlp" hidden aria-label="Timeline">
      <h2 class="co-h2">🧭 Timeline</h2>
      ${(o.timeline || []).length
        ? `<ul style="margin:0;padding:0;list-style:none">${o.timeline.map(ev => `<li style="display:flex;gap:12px;padding:5px 0;font-size:.84rem"><time style="color:var(--text-muted);min-width:96px">${fmtDate(ev.at)}</time><span>${h(ev.label)}</span></li>`).join('')}</ul>`
        : `<div class="u-muted" style="font-size:.84rem">No updates yet.</div>`}
    </section>

    <section class="card cohero" style="--co-c:${colorVar}" aria-live="polite">
      <div class="cohero-status" style="color:${colorVar}">${h(headline.status)}</div>
      <div class="cohero-detail">${h(headline.detail)}</div>
      ${estText ? `<div class="co-est">📅 <b>Est. delivery:</b> <span>${h(estText)}</span></div>` : ''}
    </section>

    <section class="card" aria-label="Progress">${stepperHtml}</section>

    <section class="card" aria-label="Delivery reconciliation">
      <div class="co-recon-head"><h2 class="co-h2" style="margin:0">📦 Delivery reconciliation</h2>
        <span class="co-hbadge" style="color:${reconBadgeColor}">${h(headline.badge)}</span></div>
      <div class="cocols">
        <div class="cocol"><div class="cocol-k">ORDERED</div><div class="cocol-v">${recon.ordItems} / ${recon.ordQty.toLocaleString('en-IN')}</div><div class="cocol-s">items / qty</div></div>
        <div class="cocol"><div class="cocol-k" style="color:var(--success)">DELIVERED</div><div class="cocol-v" style="color:var(--success)">${recon.delItems} / ${recon.delQty.toLocaleString('en-IN')}</div><div class="cocol-s"><b>${recon.pctDelItems}%</b> items · <b>${recon.pctDelQty}%</b> qty</div><div class="cocol-bar"><i style="width:${Math.min(100, recon.pctDelQty)}%;background:var(--success)"></i></div></div>
        <div class="cocol"><div class="cocol-k" style="color:var(--warning)">DUE</div><div class="cocol-v" style="color:var(--warning)">${recon.dueItems} / ${recon.dueQty.toLocaleString('en-IN')}</div><div class="cocol-s"><b>${recon.pctDueItems}%</b> items · <b>${recon.pctDueQty}%</b> qty</div><div class="cocol-bar"><i style="width:${Math.min(100, recon.pctDueQty)}%;background:var(--warning)"></i></div></div>
      </div>
      <div class="coseg" id="co-seg"></div>
      <div class="cotabs" id="co-tabs" role="group" aria-label="Filter items by status"></div>
      <div class="cotw${lines.length > 20 ? ' scroll' : ''}"><table class="cotable">
        <thead><tr><th>Item</th><th class="n">Ordered</th><th class="n">Delivered</th><th class="n">Due</th><th>Status</th></tr></thead>
        <tbody id="co-rows"></tbody>
      </table></div>
    </section>

    <section class="card"><h2 class="co-h2">Need help?</h2>${helpBody}</section>
  </div>`;

  // Store what the table/chip renderer needs, then draw.
  APP._coLines = lines;
  APP._coCounts = { full: cFull, partial: cPart, pending: cPend, all: lines.length };
  coRenderItems();
  window.coRenderItems = coRenderItems;

  try { window.scrollTo(0, 0); } catch (_) {}
}

// Render the item table body + chips + segmented bar for the current filter.
function coRenderItems() {
  const lines = APP._coLines || [], counts = APP._coCounts || { all: 0 }, flt = APP._coFilter || 'all';
  const LB = { full: ['Fully delivered', 'var(--success)'], partial: ['In progress', 'var(--warning)'], pending: ['Awaiting dispatch', 'var(--text-muted)'] };
  const seg = document.getElementById('co-seg');
  if (seg) seg.innerHTML = ['full', 'partial', 'pending'].map(k => counts[k]
    ? `<button data-cof="${k}" ${dataAct('clientOrderFilter', k)} style="width:${Math.round(counts[k] / (counts.all || 1) * 100)}%;background:${LB[k][1]}" aria-label="${LB[k][0]} ${counts[k]}"></button>` : '').join('');
  const tabs = document.getElementById('co-tabs');
  if (tabs) tabs.innerHTML = `<button class="cotab" ${dataAct('clientOrderFilter', 'all')} aria-pressed="${flt === 'all'}">All ${counts.all}</button>`
    + ['full', 'partial', 'pending'].map(k => counts[k]
      ? `<button class="cotab" ${dataAct('clientOrderFilter', k)} aria-pressed="${flt === k}"><span style="width:9px;height:9px;border-radius:50%;background:${LB[k][1]};display:inline-block"></span>${LB[k][0]} <b>${counts[k]}</b></button>` : '').join('');
  const body = document.getElementById('co-rows');
  if (!body) return;
  const rows = lines.filter(l => flt === 'all' || window.olineStatus(l.ordered, l.delivered) === flt).map(l => {
    const s = window.olineStatus(l.ordered, l.delivered);
    const c = LB[s][1], lbl = LB[s][0];
    return `<tr><td>${h(l.name)}</td><td class="n">${l.ordered.toLocaleString('en-IN')}</td><td class="n">${l.delivered.toLocaleString('en-IN')}</td><td class="n">${l.due.toLocaleString('en-IN')}</td><td><b style="color:${c}">${lbl}</b></td></tr>`;
  }).join('');
  body.innerHTML = rows || `<tr><td colspan="5" class="u-muted" style="padding:14px">No items in this status.</td></tr>`;
}
function clientOrderFilter(k) {
  APP._coFilter = (APP._coFilter === k && k !== 'all') ? 'all' : k;  // click active chip clears
  coRenderItems();
}
function clientOrderToggleTimeline(el) {
  const p = document.getElementById('co-tlp'); if (!p) return;
  const open = p.hidden; p.hidden = !open; el.setAttribute('aria-expanded', open ? 'true' : 'false');
}

// Raise a ticket pre-filled with this order (reuses the existing /tickets endpoint,
// order-linked). kind: 'support' | 'issue'.
function clientOrderTicket(orderId, kind) {
  const o = APP._coOrder || { id: orderId };
  const pre = window.ticketPrefill(o, kind);
  openModal(kind === 'issue' ? 'Report an issue' : 'Contact support',
    `<div class="form-group"><label>Subject</label><input type="text" id="co-tk-subject" value="${pre.subject.replace(/"/g, '&quot;')}"></div>
     <div class="form-group"><label>Priority</label>
       <select id="co-tk-priority"><option value="LOW">Low</option><option value="MEDIUM" selected>Medium</option><option value="HIGH">High</option></select></div>
     <div class="form-group"><label>Describe it (optional)</label>
       <textarea id="co-tk-desc" rows="4" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px" placeholder="Tell us what's wrong or what you need…"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('clientOrderSubmitTicket', orderId, kind)}>Send to support</button>`);
}
async function clientOrderSubmitTicket(orderId, kind) {
  const subject = (document.getElementById('co-tk-subject') || {}).value || '';
  if (!subject.trim()) { showToast('Subject required', 'error'); return; }
  const o = APP._coOrder || { id: orderId };
  const pre = window.ticketPrefill(o, kind);
  const res = await api('/tickets', { method: 'POST', body: JSON.stringify({
    subject,
    priority: (document.getElementById('co-tk-priority') || {}).value || 'MEDIUM',
    description: (document.getElementById('co-tk-desc') || {}).value || '',
    order_id: orderId, category: pre.category || undefined,
  }) });
  closeModal();
  if (res && res.id) {
    showToast(`Ticket ${res.id} raised`);
    const main = document.getElementById('main-content');
    if (main && APP.page === 'client_order') renderClientOrder(main);
  }
}

async function savePredictedDelivery(orderId) {
  // Works from the full order page (#of-pdd-input) and the quick-view drawer (#pdd-input).
  const el = document.getElementById('of-pdd-input') || document.getElementById('pdd-input');
  const val = el ? (el.value || '') : '';
  const res = await api('/orders/' + orderId, {
    method: 'PATCH',
    body: JSON.stringify({ predicted_delivery_date: val || null }),
  });
  if (!res) return;
  showToast(val ? 'Estimated delivery date saved — the client can now see it' : 'Estimated delivery date cleared');
  // Re-render whichever view the setter was used from.
  if (APP.page === 'order_view' && APP._ofCtx && String(APP._ofCtx.id) === String(orderId)) {
    renderOrderFull(document.getElementById('main-content'));
  } else {
    viewOrder(orderId);
  }
}
async function clearPredictedDelivery(orderId) {
  const el = document.getElementById('of-pdd-input'); if (el) el.value = '';
  await savePredictedDelivery(orderId);
}

// Ops-manager / super-admin correction of the order's business month (YYYY-MM).
function editOrderPeriodModal(orderId, current) {
  openModal('Correct order month',
    `<div class="form-group"><label>Order is for (month)</label>
       <input type="month" id="ord-period-input" value="${h(current || '')}" max="9999-12" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></div>
     <div style="font-size:.78rem;color:var(--text-muted)">The business month this order counts against. Changing it is logged on the order history.</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveOrderPeriod', orderId)}>Save month</button>`);
}
async function saveOrderPeriod(orderId) {
  const val = document.getElementById('ord-period-input')?.value || '';
  if (!/^\d{4}-\d{2}$/.test(val)) { showToast('Pick a valid month', 'error'); return; }
  const res = await api('/orders/' + orderId + '/period', { method: 'POST', body: JSON.stringify({ order_period: val }) });
  if (!res || !res.ok) return;
  closeModal();
  showToast('Order month updated');
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
     ${order.notes ? `<div style="margin-bottom:12px;padding:8px 10px;background:var(--amber-bg);border:1px solid var(--gold-border);border-radius:8px;font-size:.82rem;color:var(--amber-text)"><b>Client note:</b> ${h(order.notes)}</div>` : ''}
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
    afterOrderAction(id, 'orders');
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
  // A per-row id independent of SKU: order lines can share a blank or duplicated
  // SKU, so remove/merge must target the exact row the user clicked, not the
  // first row that happens to match a SKU.
  const rid = 'ar' + (APP._amendRid = (APP._amendRid || 0) + 1);
  return `<tr class="amend-row" data-rid="${rid}" data-sku="${h(it.sku)}" data-name="${h(it.name)}" data-delivered="${delivered}">
    <td>${h(it.name)}<div class="u-subtiny" style="font-family:monospace">${h(it.sku)||'—'}</div>${delivered>0?`<div style="font-size:.68rem;color:var(--success,#0d9488);font-weight:600">${delivered} delivered · min qty ${delivered}</div>`:''}</td>
    <td><input type="number" min="${minQty}" step="1" class="amend-qty" value="${startQty}" ${dataInput('amendRecalc')}
      style="width:66px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:.86rem"></td>
    <td><input type="number" min="0" step="0.01" class="amend-price" value="${price}" ${dataInput('amendRecalc')}
      style="width:92px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;text-align:right;font-size:.86rem"></td>
    <td style="text-align:right">${delivered>0
      ? `<span title="Part-delivered — this line can't be removed">🔒</span>`
      : `<button class="btn btn-danger btn-sm" ${dataAct('amendRemoveRow', rid)} title="Remove line">×</button>`}</td>
  </tr>`;
}

async function amendOrderModal(id) {
  const [order, inv, drill] = await Promise.all([
    api('/orders/' + id), api('/inventory'),
    api('/orders/' + id + '/drilldown').catch(() => null),
  ]);
  if (!order) return;
  APP._amendInv = (inv || []).map(i => ({ sku: i.sku, name: i.name, unit_price: i.unit_price != null ? i.unit_price : (i.price || 0) }));
  // Catalogue price fallback so every already-assigned line shows a price, even if
  // the stored order line was created without one (ad-hoc / pre-pricing orders).
  const invPrice = {}; APP._amendInv.forEach(i => { invPrice[i.sku] = Number(i.unit_price) || 0; });
  const deliveredMap = {};
  if (drill && Array.isArray(drill.lines)) drill.lines.forEach(l => { deliveredMap[l.sku] = parseInt(l.qty_delivered) || 0; });
  const anyDelivered = Object.values(deliveredMap).some(v => v > 0);
  const rows = (order.items || []).map(it => amendRowHTML({
    ...it,
    unit_price: (Number(it.unit_price) || 0) || invPrice[it.sku] || 0,
    delivered: deliveredMap[it.sku] || 0,
  })).join('');
  // "Before" totals (effective prices, incl. GST) for the before → after summary.
  const amendBeforeItems = (order.items || []);
  const amendBeforeLines = amendBeforeItems.length;
  const amendBeforeQty = amendBeforeItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const amendBeforeTotal = Math.round(amendBeforeItems.reduce((s, i) => s + (Number(i.qty) || 0) * ((Number(i.unit_price) || 0) || invPrice[i.sku] || 0), 0) * 1.18);
  openModal(`✏️ Amend Order ${id}`,
    `<div style="margin:0 0 12px;padding:9px 12px;background:var(--amber-bg);border:1px solid var(--gold-border);border-radius:8px;font-size:.82rem;color:var(--amber-text)">
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
     <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;font-size:.86rem">
       <div style="display:flex;justify-content:space-between;color:var(--text-muted)"><span>Before</span><span><b>${amendBeforeLines}</b> items · <b>${amendBeforeQty}</b> qty · ${fmt(amendBeforeTotal)}</span></div>
       <div style="display:flex;justify-content:space-between;margin-top:5px;font-weight:700;color:var(--navy)"><span>After</span><span><span id="amend-counts">0 items · 0 qty</span> · <span id="amend-total">${fmt(0)}</span></span></div>
     </div>`,
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
  const matches = (APP._amendInv || []).filter(i => itemSearchMatch(q, i.name, i.sku)).slice(0, 12);
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

function amendRemoveRow(rid) {
  const sel = (window.CSS && CSS.escape) ? CSS.escape(rid) : rid;
  const row = document.querySelector(`.amend-row[data-rid="${sel}"]`);
  if (row) row.remove();
  amendRecalc();
}

function amendRecalc() {
  let sub = 0, qty = 0, lines = 0;
  document.querySelectorAll('.amend-row').forEach(r => {
    const q = parseInt(r.querySelector('.amend-qty')?.value, 10) || 0;
    const p = parseFloat(r.querySelector('.amend-price')?.value) || 0;
    sub += q * p; qty += q; lines += 1;
  });
  const el = document.getElementById('amend-total');
  if (el) el.textContent = fmt(Math.round(sub * 1.18));
  const c = document.getElementById('amend-counts');
  if (c) c.textContent = `${lines} items · ${qty} qty`;
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
    afterOrderAction(id, 'orders');
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
  // Still-due = lines with a positive outstanding qty (clamped; over-delivery never goes negative).
  const dueLines = (lines||[]).filter(l=>(Number(l.qty_due)||0)>0).length;
  const dueQty = (lines||[]).reduce((s,l)=>s+Math.max(0,Number(l.qty_due)||0),0);
  const ordDelCell = `
    <div style="padding:14px 18px;min-width:0">
      <div style="font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Ordered vs Delivered</div>
      <div style="font-size:.86rem;line-height:1.55">
        <div style="color:var(--navy);font-weight:700"><span style="display:inline-block;min-width:32px;color:var(--text-muted);font-weight:600;font-size:.76rem">Ord</span>${summary.total_lines} items · ${ordQty} qty</div>
        <div style="color:#10b981;font-weight:700"><span style="display:inline-block;min-width:32px;color:var(--text-muted);font-weight:600;font-size:.76rem">Del</span>${summary.delivered_lines} items · ${delQty} qty</div>
        <div style="color:${dueQty>0?'var(--red)':'var(--text-muted)'};font-weight:700"><span style="display:inline-block;min-width:32px;color:var(--text-muted);font-weight:600;font-size:.76rem">Due</span>${dueLines} items · ${dueQty} qty</div>
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
      <button class="dd-tab" data-ddview="due" ${dataAct('ddSetReconView','due')} style="border:0;border-radius:7px;padding:6px 14px;font-size:.82rem;font-weight:600;cursor:pointer;background:transparent;color:var(--text-muted)">Due list${dueQty>0?` <span style="background:var(--red);color:#fff;border-radius:999px;padding:0 6px;font-size:.68rem;margin-left:2px">${dueLines}</span>`:''}</button>
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

// Due list: only the items still outstanding (qty_due > 0) — "what's left to deliver".
function renderDDByDue() {
  const d = APP._dd; if (!d) return '';
  const due = (d.lines||[]).filter(l => (Number(l.qty_due)||0) > 0)
    .sort((a,b)=>(Number(b.qty_due)||0)-(Number(a.qty_due)||0));
  if (!due.length) return '<div style="text-align:center;color:#10b981;font-weight:600;padding:28px">✓ Nothing due — every ordered item has been fully delivered.</div>';
  const rows = due.map(l => `<tr>
      <td><b>${h(l.name||l.sku)}</b><div class="u-subtiny" style="font-family:monospace">${h(l.sku)}</div></td>
      <td class="u-right">${l.qty_ordered}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${l.qty_delivered}</td>
      <td style="text-align:right;color:var(--red);font-weight:800">${l.qty_due}</td>
      <td class="u-right">${fmt(l.unit_price)}</td>
      <td style="text-align:right;color:var(--red);font-weight:700">${fmt(l.value_due)}</td>
    </tr>`).join('');
  const totQty = due.reduce((s,l)=>s+(Number(l.qty_due)||0),0);
  const totVal = due.reduce((s,l)=>s+(Number(l.value_due)||0),0);
  return `<div style="overflow-x:auto"><table class="table" style="font-size:.82rem;margin:0">
    <thead><tr><th>Item still due</th><th class="u-right">Ord</th><th class="u-right">Deliv</th><th class="u-right">Due</th><th class="u-right">Unit ₹</th><th class="u-right">Due ₹</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="border-top:2px solid var(--border);font-weight:800">
      <td>Total due · ${due.length} item${due.length===1?'':'s'}</td><td></td><td></td>
      <td style="text-align:right;color:var(--red)">${totQty}</td><td></td>
      <td style="text-align:right;color:var(--red)">${fmt(totVal)}</td></tr></tfoot>
  </table></div>`;
}

function ddSetReconView(view) {
  if (APP._dd) APP._dd.view = view;
  const box = document.getElementById('dd-recon');
  if (box) box.innerHTML = view==='challan' ? renderDDByChallan() : view==='due' ? renderDDByDue() : renderDDByItem();
  const cap = document.getElementById('dd-recon-caption');
  const capText = view==='due' ? 'Items still due' : `Line-item reconciliation <span style="font-weight:400;color:var(--text-muted)">— by ${view}</span>`;
  if (cap) cap.innerHTML = capText;
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
  const s = d.summary || {};
  const dueQty = Math.max(0, (d.ordQty || 0) - (d.delQty || 0));
  const dueLines = (s.due_lines != null) ? s.due_lines : ((s.total_lines || 0) - (s.delivered_lines || 0));
  const statusLabel = d.qtyRate >= 100 ? 'Fully delivered' : (d.delQty > 0 ? 'Partially delivered' : 'Not delivered');
  // Order summary on top, then the line reconciliation — no SKU/item-id column.
  const summary = [
    ['Delivery Breakdown', d.orderId],
    ['Client', d.order.client_name || ''],
    ['Status', statusLabel, '', 'Completion', `${d.qtyRate}% of units`],
    ['Ordered', `${s.total_lines || 0} items / ${d.ordQty || 0} qty`, '', 'Ordered value', s.total_ordered_value || 0],
    ['Delivered', `${s.delivered_lines || 0} items / ${d.delQty || 0} qty`, '', 'Delivered value', s.total_delivered_value || 0],
    ['Due', `${dueLines} items / ${dueQty} qty`, '', 'Due value', s.total_due_value || 0],
    [],
  ].map(r => r.map(esc).join(','));
  const head = ['Item','Ordered','Delivered','Due','Unit Price','Ordered Value','Delivered Value','Due Value','Delivered Via','Status'];
  const body = (d.lines||[]).map(l => {
    const via = (d.deliveredVia[l.sku]||[]).map(v=>`${v.dc} x${v.qty}${v.date?' ('+fmtDate(v.date)+')':''}`).join(' | ');
    return [l.name,l.qty_ordered,l.qty_delivered,l.qty_due,l.unit_price,l.value_ordered,l.value_delivered,l.value_due,via,ddStatusLabel(l.status)].map(esc).join(',');
  });
  _downloadCSV(`delivery-breakdown-${d.orderId}`, [...summary, head.map(esc).join(','), ...body].join('\n'));
}

function ddLoadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}

// Delivery breakdown PDF — rendered as a branded HTML document (print → Save as PDF) so it
// matches the agreed mock: navy letterhead band, gold rule, order-summary band, status
// chips, a line table with NO item-id column, and a faint per-page watermark.
function ddExportPDF() {
  const d = APP._dd; if (!d) { showToast('Open an order first', 'error'); return; }
  const b = (typeof brandInfo === 'function') ? brandInfo() : { company_name: '4SYZ', accent: '#16284a' };
  const rupee = v => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const s = d.summary || {};
  const ov = s.total_ordered_value || 0, dv = s.total_delivered_value || 0, duev = s.total_due_value || 0;
  const dueQty = Math.max(0, (d.ordQty || 0) - (d.delQty || 0));
  const dueLines = (s.due_lines != null) ? s.due_lines : ((s.total_lines || 0) - (s.delivered_lines || 0));
  const statusLabel = d.qtyRate >= 100 ? 'Fully delivered' : (d.delQty > 0 ? 'Partially delivered' : 'Not delivered');
  const dcs = d.dcs || [];
  const delDc = dcs.filter(x => x.status === 'DELIVERED').length;
  const transitDc = dcs.filter(x => x.status === 'IN_TRANSIT').length;
  const dcSub = [delDc ? delDc + ' delivered' : '', transitDc ? transitDc + ' in transit' : ''].filter(Boolean).join(' · ');
  const chipClass = st => ({ fully_delivered: 'ok', partial: 'part', not_delivered: 'no', over_delivered: 'over' }[st] || 'no');

  const ids = [b.gstin ? 'GSTIN ' + b.gstin : '', b.cin ? 'CIN ' + b.cin : '', b.pan ? 'PAN ' + b.pan : ''].filter(Boolean).join(' · ');
  const brandBlock = b.logo_url
    ? `<img class="ddp-logo" src="${h(b.logo_url)}" alt="">`
    : `<div class="ddp-word">${h(b.company_name || '4SYZ')}</div>`;
  const wm = b.logo_url
    ? `<div class="ddp-wm"><img src="${h(b.logo_url)}" alt=""></div>`
    : `<div class="ddp-wm ddp-wm-text">${h(b.company_name || '4SYZ')}</div>`;

  const rows = (d.lines || []).map(l => {
    const via = (d.deliveredVia[l.sku] || []).map(v => `<div><b>${h(v.dc)}</b> ×${v.qty}${v.date ? ' · ' + fmtDate(v.date) : ''}</div>`).join('') || '<span class="muted">—</span>';
    return `<tr>
      <td class="item">${h(l.name || l.sku)}</td>
      <td class="n">${l.qty_ordered}</td>
      <td class="n">${l.qty_delivered || '—'}</td>
      <td class="n">${l.qty_due || '—'}</td>
      <td class="n">${rupee(l.unit_price)}</td>
      <td class="n">${rupee(l.value_ordered)}</td>
      <td class="n">${rupee(l.value_delivered)}</td>
      <td class="n">${rupee(l.value_due)}</td>
      <td class="via">${via}</td>
      <td class="c"><span class="chip ${chipClass(l.status)}">${h(ddStatusLabel(l.status))}</span></td>
    </tr>`;
  }).join('');

  const acc = h(b.accent || '#16284a');
  const doc = `
  <div class="ddp-wrap">
    ${wm}
    <div class="ddp-head">
      <div class="ddp-brand">
        ${brandBlock}
        <div class="ddp-legal">${h(b.legal_name || b.company_name || '4SYZ')}</div>
        ${b.tagline ? `<div class="ddp-tag">${h(b.tagline)}</div>` : ''}
      </div>
      <div class="ddp-co">
        ${b.address ? h(b.address) + '<br>' : ''}
        ${ids ? ids + '<br>' : ''}
        ${[b.contact, b.website].filter(Boolean).map(h).join(' · ')}
      </div>
    </div>
    <div class="ddp-rule"></div>

    <div class="ddp-title">
      <div><span>Order fulfilment</span>Delivery Breakdown</div>
      <div class="ddp-meta">
        <div><em>Order</em> ${h(d.orderId)}</div>
        <div><em>Ordered</em> ${d.order.created_at ? fmtDate(d.order.created_at) : '—'}</div>
        <div><em>Generated</em> ${fmtDate(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="ddp-sum">
      <div class="ddp-sumhead">
        <div class="cell"><div class="k">Client</div><div class="v">${h(d.order.client_name || '—')}</div></div>
        <div class="cell"><div class="k">Order</div><div class="v">${h(d.orderId)}</div></div>
        <div class="cell"><div class="k">Challans</div><div class="v">${dcs.length}${dcSub ? ` <span class="muted">(${dcSub})</span>` : ''}</div></div>
        <div class="cell"><div class="k">Status</div><div class="v"><span class="status">${h(statusLabel)}</span></div></div>
      </div>
      <div class="ddp-sumbody">
        <div class="odd">
          <div class="r ord"><span class="lab">Ord</span><b>${s.total_lines || 0} items · ${d.ordQty || 0} qty</b></div>
          <div class="r del"><span class="lab">Del</span><b>${s.delivered_lines || 0} items · ${d.delQty || 0} qty</b></div>
          <div class="r due"><span class="lab">Due</span><b>${dueLines} items · ${dueQty} qty</b></div>
          <div class="vals">
            <div class="val ord"><div class="k">Ordered value</div><div class="n">${rupee(ov)}</div></div>
            <div class="val del"><div class="k">Delivered</div><div class="n">${rupee(dv)}</div></div>
            <div class="val due"><div class="k">Due</div><div class="n">${rupee(duev)}</div></div>
          </div>
        </div>
        <div class="comp">
          <div class="top"><span class="k">Delivery completion</span><span class="pct">${d.qtyRate}%</span></div>
          <div class="track"><div class="fill" style="width:${d.qtyRate}%"></div></div>
          <div class="cap">${d.delQty || 0} of ${d.ordQty || 0} units delivered. Measured on quantity, not line count.</div>
        </div>
      </div>
    </div>

    <div class="ddp-sech"><h2>Line reconciliation</h2><div class="hr"></div></div>
    <table class="ddp-tbl">
      <thead><tr>
        <th>Item</th><th class="n">Ordered</th><th class="n">Delivered</th><th class="n">Due</th>
        <th class="n">Unit price</th><th class="n">Ordered value</th><th class="n">Delivered value</th><th class="n">Due value</th>
        <th>Delivered via</th><th class="c">Status</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="10" class="muted" style="padding:14px">No lines.</td></tr>'}</tbody>
      <tfoot><tr>
        <td class="lbl">Totals</td><td class="n">${d.ordQty || 0}</td><td class="n">${d.delQty || 0}</td><td class="n">${dueQty}</td>
        <td></td><td class="n">${rupee(ov)}</td><td class="n">${rupee(dv)}</td><td class="n">${rupee(duev)}</td><td></td><td></td>
      </tr></tfoot>
    </table>

    <div class="ddp-foot">
      <span>${h(b.legal_name || b.company_name || '4SYZ')}${b.contact ? ' · ' + h(b.contact) : ''}</span>
      <span class="gold">Confidential</span>
      <span>Generated ${fmtDate(new Date().toISOString())}</span>
    </div>
  </div>`;

  // All selectors are scoped under #dd-print so nothing bleeds into the live app UI while
  // the (hidden) print container is mounted.
  const css = `
  @media print{body>*{display:none!important}#dd-print{display:block!important}@page{size:A4 landscape;margin:12mm}}
  #dd-print{font-family:'Space Grotesk','Schibsted Grotesk',-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2433;position:relative}
  #dd-print *{box-sizing:border-box}
  #dd-print .ddp-wrap{position:relative}
  #dd-print .ddp-wrap>*{position:relative;z-index:1}
  #dd-print .ddp-wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
  #dd-print .ddp-wm img{width:55%;max-width:460px;filter:grayscale(1);opacity:.05}
  #dd-print .ddp-wm-text{font-weight:800;font-size:150px;color:#16284a;opacity:.045;transform:rotate(-26deg);letter-spacing:.04em}
  #dd-print .ddp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;background:linear-gradient(155deg,#16284a,#0f1c33);color:#fff;padding:22px 26px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #dd-print .ddp-brand .ddp-logo{height:40px;max-width:170px;object-fit:contain;filter:brightness(0) invert(1)}
  #dd-print .ddp-brand .ddp-word{font-size:24px;font-weight:800;letter-spacing:.22em;color:#c79a4b;text-transform:uppercase}
  #dd-print .ddp-legal{margin-top:6px;font-size:14px;font-weight:700}
  #dd-print .ddp-tag{margin-top:2px;font-size:11px;color:#aeb8cc}
  #dd-print .ddp-co{text-align:right;font-size:10.5px;line-height:1.6;color:#c6cfde;max-width:300px}
  #dd-print .ddp-rule{height:3px;background:linear-gradient(90deg,#c79a4b 0 62%,transparent 62%);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #dd-print .ddp-title{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:16px 26px 0}
  #dd-print .ddp-title>div:first-child{font:700 20px/1 'Space Grotesk',sans-serif;color:#16284a;text-transform:uppercase}
  #dd-print .ddp-title span{display:block;font-size:10.5px;letter-spacing:.16em;color:#c79a4b;text-transform:uppercase;margin-bottom:3px;font-weight:600}
  #dd-print .ddp-meta{display:flex;gap:16px;font-size:11px;color:#6b7488;flex-wrap:wrap}
  #dd-print .ddp-meta em{font-style:normal;color:#99a0ad;margin-right:5px}
  #dd-print .ddp-meta div{font-variant-numeric:tabular-nums}
  #dd-print .ddp-sum{margin:14px 26px 0;border:1px solid #e6e4dc;border-radius:8px;overflow:hidden}
  #dd-print .ddp-sumhead{display:grid;grid-template-columns:repeat(4,1fr);background:#f7f6f1;border-bottom:1px solid #e6e4dc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #dd-print .ddp-sumhead .cell{padding:10px 14px;border-right:1px solid #e6e4dc}
  #dd-print .ddp-sumhead .cell:last-child{border-right:0}
  #dd-print .cell .k{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#99a0ad;font-weight:600}
  #dd-print .cell .v{margin-top:4px;font-weight:700;color:#16284a;font-size:13px}
  #dd-print .status{display:inline-block;font-weight:700;font-size:11px;padding:3px 10px;border-radius:100px;background:#f6ecd6;color:#9a6a12}
  #dd-print .ddp-sumbody{display:grid;grid-template-columns:1.25fr 1fr}
  #dd-print .odd{padding:12px 14px;border-right:1px solid #e6e4dc}
  #dd-print .odd .r{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:2px 0}
  #dd-print .odd .r .lab{width:40px;font-size:10px;font-weight:600;color:#99a0ad;text-transform:uppercase}
  #dd-print .odd .r b{font-variant-numeric:tabular-nums}
  #dd-print .odd .r.ord b{color:#16284a}#dd-print .odd .r.del b{color:#1f8a5b}#dd-print .odd .r.due b{color:#b3261e}
  #dd-print .vals{display:flex;gap:8px;margin-top:7px}
  #dd-print .vals .val{flex:1;text-align:center;background:#faf9f5;border:1px solid #eceae3;border-radius:6px;padding:7px 4px}
  #dd-print .vals .val .k{font-size:9px;letter-spacing:.05em;text-transform:uppercase;color:#99a0ad;font-weight:600}
  #dd-print .vals .val .n{margin-top:3px;font-weight:700;font-size:12.5px;font-variant-numeric:tabular-nums}
  #dd-print .vals .val.ord .n{color:#16284a}#dd-print .vals .val.del .n{color:#1f8a5b}#dd-print .vals .val.due .n{color:#b3261e}
  #dd-print .comp{padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:8px}
  #dd-print .comp .top{display:flex;justify-content:space-between;align-items:baseline}
  #dd-print .comp .k{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#99a0ad;font-weight:600}
  #dd-print .comp .pct{font-weight:700;font-size:22px;color:#1f8a5b;font-variant-numeric:tabular-nums}
  #dd-print .track{height:8px;background:#eceae3;border-radius:6px;overflow:hidden}
  #dd-print .fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#2fa36b,#1f8a5b);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #dd-print .comp .cap{font-size:11px;color:#6b7488}
  #dd-print .ddp-sech{display:flex;align-items:center;gap:10px;padding:18px 26px 0}
  #dd-print .ddp-sech h2{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#16284a;margin:0;font-weight:600}
  #dd-print .ddp-sech .hr{flex:1;height:1px;background:#e6e4dc}
  #dd-print .ddp-tbl{border-collapse:collapse;font-size:11.5px;margin:8px 26px 0;width:calc(100% - 52px)}
  #dd-print .ddp-tbl thead th{font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#6b7488;text-align:left;padding:8px 8px;border-bottom:2px solid #16284a;font-weight:600}
  #dd-print .ddp-tbl th.n,#dd-print .ddp-tbl td.n{text-align:right;font-variant-numeric:tabular-nums}
  #dd-print .ddp-tbl th.c,#dd-print .ddp-tbl td.c{text-align:center}
  #dd-print .ddp-tbl tbody td{padding:7px 8px;border-bottom:1px solid #eceae3;vertical-align:top}
  #dd-print .ddp-tbl .item{font-weight:600}
  #dd-print .ddp-tbl .via{font-size:10px;color:#6b7488;line-height:1.5}
  #dd-print .ddp-tbl .via b{color:#16284a}
  #dd-print .muted{color:#99a0ad}
  #dd-print .chip{display:inline-block;font-weight:700;font-size:10px;padding:2px 9px;border-radius:100px;white-space:nowrap}
  #dd-print .chip.ok{color:#1f8a5b;background:#e4f3ea}#dd-print .chip.part{color:#9a6a12;background:#f6ecd6}
  #dd-print .chip.no{color:#b3261e;background:#f7e2e0}#dd-print .chip.over{color:#6b4ea8;background:#efeaf7}
  #dd-print .ddp-tbl tfoot td{padding:9px 8px;border-top:2px solid #16284a;font-weight:700;color:#16284a;font-variant-numeric:tabular-nums}
  #dd-print .ddp-tbl tfoot td.lbl{text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#6b7488}
  #dd-print .ddp-foot{margin:18px 26px 0;background:#f7f6f1;border-top:1px solid #e6e4dc;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;font-size:10.5px;color:#6b7488}
  #dd-print .ddp-foot .gold{color:#c79a4b;font-weight:600;letter-spacing:.1em;text-transform:uppercase}`;

  // Load Space Grotesk once (best-effort; falls back to system font if it hasn't loaded).
  if (!document.getElementById('ddp-font')) {
    const lk = document.createElement('link'); lk.id = 'ddp-font'; lk.rel = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap';
    document.head.appendChild(lk);
  }
  document.getElementById('dd-print')?.remove();
  document.getElementById('dd-print-style')?.remove();
  const style = document.createElement('style'); style.id = 'dd-print-style'; style.textContent = css;
  const div = document.createElement('div'); div.id = 'dd-print'; div.style.display = 'none'; div.innerHTML = doc;
  document.body.appendChild(style); document.body.appendChild(div);
  showToast('Opening print — choose "Save as PDF"');
  setTimeout(() => { window.print(); setTimeout(() => { div.remove(); style.remove(); }, 800); }, 250);
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
// ── Order Queue buckets (shared by the Orders-tab top tiles and the Operator tab) ──
// Plain, outcome-based names a non-technical operator reads instantly. Defined on real
// statuses/dates so the counts are trustworthy.
const OQ_CLOSED = ['CLOSED', 'CANCELLED', 'DELIVERED', 'RECEIVED', 'REJECTED'];
function oqIsOpen(o) { return !OQ_CLOSED.includes(o.status); }
function oqDueDate(o) { return (o.need_by_date || o.predicted_delivery_date || '').slice(0, 10); }
function oqBucketMatch(o, key) {
  const today = new Date().toISOString().slice(0, 10);
  const due = oqDueDate(o);
  switch (key) {
    case 'pending':  return oqIsOpen(o);
    case 'duetoday': return oqIsOpen(o) && !!due && due === today;
    case 'overdue':  return oqIsOpen(o) && !!due && due < today;
    case 'ready':    return ['READY_TO_PICK', 'PICKED', 'QUALITY_CHECK'].includes(o.status);
    case 'partial':  return o.status === 'PARTIALLY_CLOSED';
    default:         return true;
  }
}
// [key, label, hint, dot-colour]
const OQ_BUCKETS = [
  ['pending',  'Pending',   'all open',         'var(--navy)'],
  ['duetoday', 'Due Today', 'deliver by today', 'var(--blue)'],
  ['overdue',  'Overdue',   'past the date',    'var(--danger)'],
  ['ready',    'Ready',     'picked & checked', 'var(--success)'],
  ['partial',  'Partial',   'some delivered',   'var(--warning)'],
];
// The month/type/client-filtered order set (the common base for the top tiles and both tabs).
function oqBase() {
  let res = APP._oqOrders || [];
  if (APP._oqMonth) res = res.filter(o => (o.created_at || '').startsWith(APP._oqMonth));
  if (APP._oqTypeFilter) res = res.filter(o => (o.order_type || 'Regular') === APP._oqTypeFilter);
  if (APP._oqClient) { const q = APP._oqClient.toLowerCase(); res = res.filter(o => (o.client_name || '').toLowerCase().includes(q)); }
  return res;
}
// The Order Queue buckets/type tiles now render through the app-wide canonical
// tile (tileHtml in app.01-core). Thin shim keeps the two call sites unchanged.
function oqTileHtml(dot, label, count, hint, act, on) {
  return tileHtml({ label, value: count, sub: hint, accent: dot, active: on, act });
}

// ── Order Queue: per-order delivery progress (column + filter chips) ─────────
// Uses handleListOrders fields: total_qty, delivered_qty, item_count,
// delivered_items (count of fully-delivered lines).
function oqDeliv(o) {
  const tot = Number(o.total_qty) || 0, del = Number(o.delivered_qty) || 0;
  const items = Number(o.item_count) || 0, delItems = Number(o.delivered_items) || 0;
  const dueItems = Math.max(0, items - delItems);
  const pct = tot > 0 ? Math.min(100, Math.round(del / tot * 100)) : 0;
  return { pct, dueItems, started: del > 0, complete: items > 0 && dueItems === 0, del, tot };
}
function oqProgressCell(o) {
  const d = oqDeliv(o);
  const barColor = d.complete ? '#0C8E6D' : d.started ? '#B5731A' : 'var(--text-light,#9aa7b2)';
  const text = !d.started ? '<span class="u-muted">Not started</span>'
    : d.complete ? '<b>100%</b> <span class="u-muted">· Complete</span>'
    : `<b>${d.pct}%</b> <span class="u-muted">· ${d.dueItems} due</span>`;
  return `<button type="button" ${dataAct('openOrderDelivery', o.id, d.dueItems > 0 ? 'due' : 'item')} title="Open delivery for ${o.id}" aria-label="Delivery progress for ${o.id}"
    style="background:none;border:1px solid transparent;border-radius:8px;padding:4px 6px;margin:-4px -6px;cursor:pointer;text-align:left;display:block;width:100%;min-width:120px">
    <span style="display:block;height:7px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:4px"><i style="display:block;height:100%;width:${d.pct}%;background:${barColor}"></i></span>
    <span style="font-size:.8rem">${text}</span>
  </button>`;
}
function oqDelivChipsHtml() {
  const base = oqBase();
  const n = { all: base.length, due: 0, done: 0, new: 0 };
  base.forEach(o => { const d = oqDeliv(o); if (!d.started) n.new++; else if (d.complete) n.done++; else if (d.dueItems > 0) n.due++; });
  const cur = APP._oqDelivFilter || 'all';
  const chip = (k, label) => `<button type="button" ${dataAct('oqSetDelivFilter', k)} aria-pressed="${cur === k}"
    style="border:1px solid ${cur === k ? 'var(--navy)' : 'var(--border)'};background:${cur === k ? 'var(--navy)' : 'var(--surface)'};color:${cur === k ? '#fff' : 'var(--text)'};border-radius:999px;padding:5px 13px;font-weight:600;font-size:.82rem;cursor:pointer">${label} <b>${n[k]}</b></button>`;
  return `<div style="font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin:0 2px 6px">By delivery</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${chip('all', 'All')}${chip('due', 'Due deliveries')}${chip('done', 'Delivered')}${chip('new', 'Not started')}</div>`;
}
function oqSetDelivFilter(k) {
  APP._oqDelivFilter = k;
  const chipsEl = document.getElementById('oq-deliv-chips');
  if (chipsEl) chipsEl.innerHTML = oqDelivChipsHtml();
  const sub = document.getElementById('oq-subtitle');
  const tbody = document.getElementById('oq-tbody');
  if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab || 'All');
}
// Progress cell → the order page's Delivery tab (By item / Due list), deep-linked.
function openOrderDelivery(id, view) {
  try { APP._oqScroll = window.scrollY || 0; } catch (_) { APP._oqScroll = 0; }
  navigate('order_view', { tab: id + '.delivery' + (view ? '.' + view : '') });
}

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
    const df = APP._oqDelivFilter;
    if (df && df !== 'all') res = res.filter(o => { const d = oqDeliv(o);
      return df === 'due' ? (d.started && d.dueItems > 0) : df === 'done' ? d.complete : df === 'new' ? !d.started : true; });
    return res;
  }


  function oqKpiHtml(fOrders) {
    const allForType = APP._oqMonth ? orders.filter(o=>(o.created_at||'').startsWith(APP._oqMonth)) : orders;
    const bucket = APP._oqBucket || null;
    const bcount = k => fOrders.filter(o => oqBucketMatch(o, k)).length;
    const buckets = OQ_BUCKETS
      .map(([k, label, hint, dot]) => oqTileHtml(dot, label, bcount(k), hint, dataAct('oqSetBucket', k), bucket === k))
      .join('');
    const typeCfg = [['Regular', 'var(--blue)'], ['Urgent', 'var(--danger)'], ['Ad-Hoc', '#d97706']];
    const types = typeCfg.map(([type, color]) => {
      const grp = allForType.filter(o => (o.order_type || 'Regular') === type);
      return oqTileHtml(color, type, grp.length, fmt(grp.reduce((s, o) => s + (o.grand_total || 0), 0)),
        dataAct('oqFilterByType', type), APP._oqTypeFilter === type);
    }).join('');
    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:12px">${buckets}</div>
    <div style="font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin:2px 2px 6px">By order type</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px">${types}</div>`;
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
    if (APP._oqBucket) filtered = filtered.filter(o => oqBucketMatch(o, APP._oqBucket));
    const sorted   = [...filtered].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    return `<tbody id="oq-tbody">${sorted.map(o=>{
      const isUrgent = o.status==='PENDING_APPROVAL';
      const todayStr = new Date().toISOString().slice(0,10);
      // Status-keyed accent bar (mobile card view) — adopted from the concept:
      // a quick colour cue per lifecycle phase, using theme tokens so it works
      // in light and dark.
      const accent = ['CANCELLED','REJECTED'].includes(o.status) ? 'var(--text-light)'
        : ['PENDING_APPROVAL','SUBMITTED'].includes(o.status) ? 'var(--warning)'
        : ['IN_SHIPMENT','PARTIALLY_CLOSED'].includes(o.status) ? 'var(--violet)'
        : ['CLOSED','DELIVERED'].includes(o.status) ? 'var(--success)'
        : 'var(--blue)';
      return `<tr style="--accent:${accent};${isUrgent||o.order_type==='Urgent'?'background:var(--warning-bg)':''}">
        <td class="card-title-cell">
          <button type="button" class="oq-id-link" ${dataAct('openOrderFull', o.id)} title="Open full order view" style="background:none;border:0;padding:0;cursor:pointer;font-weight:700;color:var(--primary);font-size:inherit">${o.id}</button>
          ${o.need_by_date ? `<div style="font-size:.7rem;color:${o.need_by_date<todayStr?'var(--danger)':'var(--warning)'};font-weight:600;margin-top:2px">🚨 Need by ${fmtDate(o.need_by_date)}</div>` : ''}
          ${o.predicted_delivery_date && !['CLOSED','DELIVERED','CANCELLED'].includes(o.status) ? `<div style="font-size:.7rem;color:${o.predicted_delivery_date<todayStr?'var(--danger)':'var(--success)'};margin-top:1px">📅 Est. ${fmtDate(o.predicted_delivery_date)}</div>` : ''}
        </td>
        <td data-label="Client">${o.client_name||'—'}</td>
        <td data-label="Amount" style="font-weight:700">${fmt(o.grand_total)}</td>
        <td data-label="Status">${statusBadge(o.status)}${oqDeliveryBadge(o)}</td>
        <td data-label="Delivery">${oqProgressCell(o)}</td>
        <td data-label="Type">${orderTypeBadge(o.order_type||'Regular')}</td>
        <td data-label="Items" class="u-center">
          <span class="oq-numunit"><b>${o.item_count||0}</b> items</span>
        </td>
        <td data-label="Total Qty" class="u-center">
          <span class="oq-numunit"><b>${o.total_qty||0}</b> qty</span>
          ${oqQtyBreakdown(o)}
        </td>
        <td data-label="Created" style="font-size:.82rem;color:var(--text-muted)">${fmtDate(o.created_at)}</td>
        <td data-label="Actions">${orderQueueActions(o)}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="10" style="text-align:center;color:var(--text-muted);padding:24px">No orders</td></tr>'}</tbody>`;
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

  <div id="oq-deliv-chips" style="margin-bottom:14px">${oqDelivChipsHtml()}</div>

  <div class="tabs" style="margin-bottom:16px">
    <button class="tab-btn${APP._oqTab==='orders'?' active':''}" data-oqtab="orders" ${dataAct('switchOQMainTab', 'orders')}>Orders</button>
    <button class="tab-btn${APP._oqTab==='items'?' active':''}" data-oqtab="items" ${dataAct('switchOQMainTab', 'items')}>Line Items</button>
    <button class="tab-btn${APP._oqTab==='operator'?' active':''}" data-oqtab="operator" ${dataAct('switchOQMainTab', 'operator')}>👤 Operator</button>
  </div>

  <div id="oq-main-content">${oqMainContentHtml(APP._oqTab)}</div>`;

  if (APP._oqTab === 'items') oqLoadItems();
  else if (APP._oqTab === 'operator') renderOperatorTab();

  // Restore the scroll position saved when an order was opened from the queue,
  // so Back (browser or the "← Back to Orders" link) returns you where you were.
  if (APP._oqScroll) {
    const y = APP._oqScroll; APP._oqScroll = 0;
    requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (_) {} });
  }
}

// The orders table card (phase stepper + table). Shared by the first render and
// tab switching so the two never drift.
function oqOrdersTableHtml() {
  return `
    <div class="card" style="overflow:hidden">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
        <div id="oq-tabs">${APP._oqTabsHtml ? APP._oqTabsHtml() : ''}</div>
      </div>
      <div class="table-wrap">
        <table class="table table-cards table-cards-2up" style="margin:0">
          <thead><tr><th>Order ID</th><th>Client</th><th>Amount</th><th>Status</th><th>Delivery progress</th><th>Type</th><th class="u-center">Items</th><th class="u-center">Total Qty</th><th>Created</th><th>Actions</th></tr></thead>
          ${APP._oqTableHtml ? APP._oqTableHtml(APP._oqStatusTab) : ''}
        </table>
      </div>
    </div>`;
}

// Body for #oq-main-content for the given main tab.
function oqMainContentHtml(tab) {
  if (tab === 'items')    return '<div id="oq-items-area"><div class="loading-state"><div class="spinner"></div><p>Loading line items…</p></div></div>';
  if (tab === 'operator') return '<div id="oq-operator-area"><div class="loading-state"><div class="spinner"></div><p>Loading worklist…</p></div></div>';
  return oqOrdersTableHtml();
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
  if (APP._oqTab === 'operator') {
    renderOperatorTab();
  } else if (APP._oqTab === 'items') {
    oqLoadItems();
  } else {
    const tabsEl = document.getElementById('oq-tabs');
    if (tabsEl && APP._oqTabsHtml) tabsEl.innerHTML = APP._oqTabsHtml();
    const tbody = document.getElementById('oq-tbody');
    if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab);
  }
}

function switchOQMainTab(tab) {
  APP._oqTab = tab;
  document.querySelectorAll('.tabs .tab-btn[data-oqtab]').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-oqtab') === tab));
  const contentEl = document.getElementById('oq-main-content');
  if (!contentEl) return;
  contentEl.innerHTML = oqMainContentHtml(tab);
  if (tab === 'items') oqLoadItems();
  else if (tab === 'operator') renderOperatorTab();
}

// Top-tile bucket filter (Pending / Due Today / Overdue / Ready / Partial).
// Clicking the active bucket again clears it. Refreshes the tiles and whichever
// main tab is open so the Orders table and the Operator worklist stay in sync.
function oqSetBucket(key) {
  APP._oqBucket = APP._oqBucket === key ? null : key;
  const kpiEl = document.getElementById('oq-kpi');
  if (kpiEl && APP._oqKpiHtml) kpiEl.innerHTML = APP._oqKpiHtml(oqBase());
  if (APP._oqTab === 'operator') { renderOperatorTab(); return; }
  if (APP._oqTab === 'items') return;
  const tbody = document.getElementById('oq-tbody');
  if (tbody && APP._oqTableHtml) tbody.outerHTML = APP._oqTableHtml(APP._oqStatusTab || 'All');
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
  if (APP._oqTab === 'operator') { renderOperatorTab(); return; }
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
  if (APP._oqTab === 'operator') { renderOperatorTab(); return; }
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
              const rowBg=ss==='oos'?'background:var(--danger-bg)':ss==='short'?'background:var(--warning-bg)':'';
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
        <div style="padding:10px 16px;background:var(--amber-bg);border-bottom:1px solid var(--amber);font-size:.8rem;color:var(--amber-text)">
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
              const rowBg=ss==='oos'?'background:var(--danger-bg)':ss==='short'?'background:var(--warning-bg)':'';
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
            const rowBg=ss==='oos'?'background:var(--danger-bg)':ss==='short'?'background:var(--warning-bg)':'';
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
  const btns = [`<button class="btn btn-secondary btn-sm" ${dataActEl('openOrderDrawer', o.id)}>View</button>`];
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
     <div style="margin-top:10px;padding:9px 12px;background:var(--amber-bg);border:1px solid var(--gold-border);border-radius:8px;color:var(--amber-text);font-size:.8rem">
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
        <div class="u-b600">${dc.dc_number||dc.id}</div>
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
  if (res) { showToast(`Order ${orderId} pre-closed`); afterOrderAction(orderId, 'orders'); }
}

// After a workflow action, stay on whichever order page the user is viewing
// (admin order_view or the client order detail) and re-render it in place, so
// the new status and next action show without a trip back to the list. Falls
// back to the list only when the action was taken from somewhere else.
function afterOrderAction(id, fallback) {
  const main = document.getElementById('main-content');
  if (main && APP.page === 'order_view' && APP._ofCtx && String(APP._ofCtx.id) === String(id)) {
    renderOrderFull(main); try { updateNavBadges(); } catch (_) {} return;
  }
  if (main && APP.page === 'client_order' && String(APP._navTab || parseHash().tab || '') === String(id)) {
    renderClientOrder(main); try { updateNavBadges(); } catch (_) {} return;
  }
  navigate(fallback || 'orders');
}

async function advanceOrder(id, to, note) {
  const res = await api(`/orders/${id}/transition`, { method:'POST', body: JSON.stringify({ to, note: note||undefined }) });
  if (res) { showToast(`Order ${id} → ${to.replace(/_/g,' ')}`); afterOrderAction(id, 'orders'); }
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
  if (res) { showToast(`Order ${id} cancelled`); afterOrderAction(id, 'orders'); }
}
