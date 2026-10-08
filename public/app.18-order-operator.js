// ============================================================================
// Order Queue · Operator tab
// ----------------------------------------------------------------------------
// A client-first worklist built for non-technical warehouse operators. Where the
// Orders tab is a status-first board for ops staff, this tab answers one question
// for each client: "what do I work next, and what's the single next step?"
//
// It reuses the shared top of the Order Queue (the Pending/Due Today/Overdue/
// Ready/Partial buckets and the Regular/Urgent/Ad-Hoc type tiles in #oq-kpi, and
// the month + client search in the header) as its filters, then lays out:
//   • left  — clients (expandable) → their open orders, with priority + a plain
//             "N SKUs · M units pending · <status>" summary
//   • right — a detail panel: lifecycle stepper (5 plain stages mapped from the
//             real 12-status FSM), order KPIs, the single Next Best Action wired
//             to the real workflow for that status, and item-level pending qtys
//             (fetched on demand from /orders/:id/drilldown).
//
// CSP: no inline handlers — every interaction goes through the delegated
// data-act / data-input / data-change helpers, and every target below is a
// top-level global in this file (or an existing global in app.04).
// ============================================================================

// Plain 5-stage lifecycle shown to operators, mapped from the real status FSM.
const OP_STAGES = ['Approved', 'Procured', 'Picking', 'Dispatch', 'Delivery'];
const OP_STAGE_OF = {
  SUBMITTED: 0, PENDING_APPROVAL: 0, APPROVED: 0,
  ACKNOWLEDGED: 1, INVENTORY_CHECK: 1, VENDOR_PO_RAISED: 1,
  READY_TO_PICK: 2, PICKED: 2, QUALITY_CHECK: 2,
  IN_SHIPMENT: 3,
  PARTIALLY_CLOSED: 4, DELIVERED: 4, CLOSED: 4, RECEIVED: 4,
};
function opStageIndex(status) { return OP_STAGE_OF[status] ?? 0; }
function opIsComplete(status) { return ['DELIVERED', 'CLOSED', 'RECEIVED'].includes(status); }

// order_type → operator priority. Urgent is the only real escalation signal we
// have; everything else is Normal. Kept deliberately simple (no invented tiers).
function opPrio(o) { return (o.order_type || 'Regular') === 'Urgent' ? 'High' : 'Normal'; }

// A short, plain status line for an order row.
function opStatusLabel(o) {
  const base = (typeof statusLabel === 'function' ? statusLabel(o.status) : (o.status || '').replace(/_/g, ' ').toLowerCase());
  const today = new Date().toISOString().slice(0, 10);
  const due = oqDueDate(o);
  if (oqIsOpen(o) && due && due < today) return base + ' · overdue';
  if (oqIsOpen(o) && due && due === today) return base + ' · due today';
  return base;
}

// The single Next Best Action for an order: human sentence + the real action
// button (reusing the exact workflow functions the Orders board uses). Returns
// { text, btn } where btn is ready-to-insert HTML (or '' when nothing to do).
function opNextAction(o) {
  const id = o.id;
  const primary = (label, act) => `<button class="op-btn primary" ${act}>${label}</button>`;
  switch (o.status) {
    case 'SUBMITTED':
      return { text: 'Review and approve this order to release it to the warehouse.',
        btn: primary('✓ Approve order', dataAct('advanceOrder', id, 'APPROVED', 'Approved by ops')) };
    case 'PENDING_APPROVAL':
      if ((o.revision || 1) > 1)
        return { text: 'Amended — waiting for the client to re-approve. Nothing to do here yet.', btn: '' };
      return { text: 'Review and approve this order to release it to the warehouse.',
        btn: primary('✓ Approve order', dataAct('advanceOrder', id, 'APPROVED', 'Client/ops approval')) };
    case 'APPROVED':
      return { text: 'Acknowledge the order so processing can start.',
        btn: primary('Acknowledge', dataAct('advanceOrder', id, 'ACKNOWLEDGED', 'Order acknowledged — processing started')) };
    case 'ACKNOWLEDGED':
      return { text: 'Run the inventory check to confirm stock before picking.',
        btn: primary('Inventory check', dataAct('advanceOrder', id, 'INVENTORY_CHECK', 'Inventory check initiated')) };
    case 'INVENTORY_CHECK':
      return { text: 'Confirm stock is available, or raise a purchase order for what is short.',
        btn: primary('✓ Stock in — ready to pick', dataAct('advanceOrder', id, 'READY_TO_PICK', 'Stock available — ready for picking'))
          + `<button class="op-btn ghost" ${dataAct('inventoryShortageModal', id)}>⚠ Raise PO</button>` };
    case 'VENDOR_PO_RAISED':
      return { text: 'Waiting on the vendor to supply. Nothing to pick yet.', btn: '' };
    case 'READY_TO_PICK':
      return { text: 'Open the pick list — the items are ready to be picked.',
        btn: primary('Open pick list', dataAct('pickOrderModal', id)) };
    case 'PICKED':
      return { text: 'Items are picked — run the quality check before dispatch.',
        btn: primary('Quality check', dataAct('advanceOrder', id, 'QUALITY_CHECK', 'Items picked — quality check & packing')) };
    case 'QUALITY_CHECK':
      return { text: 'All picked and checked — create the delivery challan now.',
        btn: primary('✓ Pass → create delivery', dataAct('createDCFromPicklist', id)) };
    case 'PARTIALLY_CLOSED':
      return { text: 'Some lines delivered — dispatch the remaining pending units (or short-close).',
        btn: primary('Dispatch remaining', dataAct('dispatchRemainingModal', id)) };
    case 'IN_SHIPMENT':
      return { text: 'In transit — confirm delivery from the Delivery screen when it arrives.',
        btn: `<button class="op-btn ghost" ${dataAct('navigate', 'delivery')}>→ Delivery screen</button>` };
    default:
      return { text: 'Completed — no action needed.', btn: '' };
  }
}

// Worst-case status pill for a group of orders (drives the per-client badge).
function opWorstPill(orders) {
  const today = new Date().toISOString().slice(0, 10);
  const anyOverdue = orders.some(o => oqIsOpen(o) && oqDueDate(o) && oqDueDate(o) < today);
  const anyDue     = orders.some(o => oqIsOpen(o) && oqDueDate(o) === today);
  const anyReady   = orders.some(o => ['READY_TO_PICK', 'PICKED', 'QUALITY_CHECK'].includes(o.status));
  const anyPartial = orders.some(o => o.status === 'PARTIALLY_CLOSED');
  if (anyOverdue) return ['danger', 'Overdue'];
  if (anyDue)     return ['info', 'Due today'];
  if (anyReady)   return ['ok', 'Ready'];
  if (anyPartial) return ['warn', 'Partial'];
  return ['navy', 'Pending'];
}

// Scoped CSS for the operator tab, using the app's theme tokens so it tracks
// light/dark automatically. Injected once.
function injectOpCss() {
  if (document.getElementById('op-css')) return;
  const s = document.createElement('style');
  s.id = 'op-css';
  s.textContent = `
  .op-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
  .op-search{flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--border);border-radius:10px;padding:0 12px}
  .op-search input{border:0;background:transparent;color:var(--text);font:inherit;padding:10px 0;width:100%;outline:none}
  .op-pane{display:grid;grid-template-columns:1fr 420px;gap:16px;align-items:start}
  @media (max-width:900px){.op-pane{grid-template-columns:1fr}}
  .op-list{display:flex;flex-direction:column;gap:10px;min-width:0}
  .op-client{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .op-chead{display:flex;align-items:center;gap:12px;padding:13px 15px;cursor:pointer;width:100%;border:0;background:none;color:inherit;text-align:left;font:inherit}
  .op-chead:hover{background:var(--surface-2)}
  .op-chev{width:16px;flex:none;color:var(--text-light);transition:transform .15s}
  .op-client.open .op-chev{transform:rotate(90deg)}
  .op-cname{font-weight:700;font-size:.95rem;color:var(--navy)}
  .op-cmeta{font-size:.76rem;color:var(--text-muted);margin-top:1px}
  .op-cspacer{flex:1}
  .op-cstat{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
  .op-pill{font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap}
  .op-pill.ok{background:var(--success-bg);color:var(--success)} .op-pill.warn{background:var(--warning-bg);color:var(--warning)}
  .op-pill.danger{background:var(--danger-bg);color:var(--danger)} .op-pill.info{background:var(--info-bg);color:var(--info)}
  .op-pill.navy{background:color-mix(in srgb,var(--navy) 12%,transparent);color:var(--navy)}
  .op-cval{font-weight:800;font-size:.9rem;color:var(--navy);text-align:right;font-variant-numeric:tabular-nums}
  .op-orders{display:none;border-top:1px solid var(--border);padding:6px}
  .op-client.open .op-orders{display:block}
  .op-order{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:9px;cursor:pointer;width:100%;border:0;background:none;color:inherit;text-align:left;font:inherit}
  .op-order:hover{background:var(--surface-2)}
  .op-order.sel{background:color-mix(in srgb,var(--navy) 8%,transparent);outline:1.5px solid color-mix(in srgb,var(--navy) 30%,transparent)}
  .op-owner{flex:1;min-width:0}
  .op-oid{font-weight:800;font-size:.82rem;color:var(--navy)}
  .op-odesc{font-size:.74rem;color:var(--text-muted);margin-top:2px}
  .op-prio{font-size:.6rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:5px;margin-left:7px;vertical-align:middle}
  .op-prio.high{background:var(--danger-bg);color:var(--danger)} .op-prio.normal{background:var(--surface-2);color:var(--text-muted)}
  .op-empty{background:var(--surface);border:1px dashed var(--border);border-radius:12px;padding:40px 20px;text-align:center;color:var(--text-muted)}
  .op-panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;position:sticky;top:16px}
  .op-phead{background:linear-gradient(155deg,var(--navy),#0f1c33);color:#fff;padding:16px 18px}
  .op-ptop{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .op-pid{font-weight:800;font-size:1.05rem}
  .op-pclient{font-size:.8rem;color:#c6cfde;margin-top:2px}
  .op-pclose{background:rgba(255,255,255,.15);border:0;color:#fff;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:1rem;flex:none;line-height:1}
  .op-pkpis{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border)}
  .op-pkpi{background:var(--surface);padding:12px 14px}
  .op-pkpi .k{font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-light);font-weight:700}
  .op-pkpi .v{font-weight:800;font-size:1rem;color:var(--navy);margin-top:4px;font-variant-numeric:tabular-nums}
  .op-psec{padding:16px 18px;border-bottom:1px solid var(--border)}
  .op-psec:last-child{border-bottom:0}
  .op-psec h3{font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin:0 0 12px}
  .op-steps{display:flex;gap:0}
  .op-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;font-size:.64rem;color:var(--text-light);text-align:center}
  .op-step .bub{width:26px;height:26px;border-radius:50%;background:var(--border);color:var(--text-light);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.72rem;z-index:1}
  .op-step.done .bub{background:var(--success);color:#fff} .op-step.cur .bub{background:var(--navy);color:#fff;box-shadow:0 0 0 4px color-mix(in srgb,var(--navy) 18%,transparent)}
  .op-step .slab{margin-top:6px;font-weight:600}
  .op-step.done .slab,.op-step.cur .slab{color:var(--text)}
  .op-step::before{content:"";position:absolute;top:13px;left:-50%;width:100%;height:2px;background:var(--border)}
  .op-step:first-child::before{display:none}
  .op-step.done::before,.op-step.cur::before{background:var(--success)}
  .op-nba{background:color-mix(in srgb,var(--gold) 14%,transparent);border:1px solid color-mix(in srgb,var(--gold) 45%,transparent);border-radius:11px;padding:13px 15px}
  .op-nba .k{display:flex;align-items:center;gap:7px;font-size:.66rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}
  .op-nba .txt{font-size:.85rem;font-weight:600;color:var(--text);margin:6px 0 11px}
  .op-acts{display:flex;gap:9px;flex-wrap:wrap}
  .op-btn{font-size:.82rem;font-weight:600;border-radius:9px;padding:9px 14px;cursor:pointer;border:1.5px solid transparent}
  .op-btn.primary{background:var(--navy);color:#fff}
  .op-btn.ghost{background:var(--surface);border-color:var(--border);color:var(--text)}
  .op-items{width:100%;border-collapse:collapse;font-size:.78rem}
  .op-items th{text-align:left;font-size:.62rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--text-light);padding:0 8px 7px;border-bottom:1px solid var(--border)}
  .op-items th.n,.op-items td.n{text-align:right;font-variant-numeric:tabular-nums}
  .op-items td{padding:8px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text)}
  .op-items .inm{font-weight:600}
  .op-items .isku{font-size:.66rem;color:var(--text-light);font-family:monospace}
  .op-items .pend{font-weight:800;color:var(--danger)} .op-items .pend0{color:var(--success);font-weight:700}
  .op-panelmsg{padding:30px 18px;color:var(--text-muted);font-size:.86rem;text-align:center}
  `;
  document.head.appendChild(s);
}

// The filtered operator order set: shared base (month/type/header-client) ∩ the
// active top bucket (defaulting to Pending/open) ∩ priority ∩ local search.
function opFilteredOrders() {
  let list = (typeof oqBase === 'function') ? oqBase() : (APP._oqOrders || []);
  const bucket = APP._oqBucket || 'pending';
  list = list.filter(o => oqBucketMatch(o, bucket));
  if (APP._opPrio) list = list.filter(o => opPrio(o) === APP._opPrio);
  if (APP._opQ) {
    const q = APP._opQ.toLowerCase();
    list = list.filter(o => (o.id || '').toLowerCase().includes(q) || (o.client_name || '').toLowerCase().includes(q));
  }
  return list;
}

function opListHtml() {
  const orders = opFilteredOrders();
  const byClient = {};
  orders.forEach(o => { (byClient[o.client_name || '—'] = byClient[o.client_name || '—'] || []).push(o); });
  const names = Object.keys(byClient).sort();
  if (!names.length)
    return `<div class="op-empty">No orders match. Try a different bucket, priority or search — or clear the filters.</div>`;
  return names.map(name => {
    const os = byClient[name];
    const val = os.reduce((s, o) => s + (o.grand_total || 0), 0);
    const [pc, pl] = opWorstPill(os);
    const open = APP._opOpen && APP._opOpen[name];
    return `<div class="op-client ${open ? 'open' : ''}">
      <button class="op-chead" ${dataAct('opToggleClient', name)}>
        <span class="op-chev">▶</span>
        <span style="min-width:0">
          <div class="op-cname">${h(name)}</div>
          <div class="op-cmeta">${os.length} order${os.length > 1 ? 's' : ''}</div>
        </span>
        <span class="op-cspacer"></span>
        <span class="op-cstat">
          <span class="op-pill ${pc}">${pl}</span>
          <span class="op-cval">${fmt(val)}</span>
        </span>
      </button>
      <div class="op-orders">
        ${os.map(o => {
          const p = opPrio(o);
          const pend = Math.max(0, (o.total_qty || 0) - (o.delivered_qty || 0));
          return `<button class="op-order ${APP._opSel === o.id ? 'sel' : ''}" ${dataAct('opSelectOrder', o.id)}>
            <span class="op-owner">
              <span class="op-oid">${h(o.id)}</span>
              <span class="op-prio ${p.toLowerCase()}">${p}</span>
              <div class="op-odesc">${o.item_count || 0} SKUs · ${pend} units pending · ${h(opStatusLabel(o))}</div>
            </span>
            <span class="op-cval">${fmt(o.grand_total)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

function opPanelHtml() {
  const id = APP._opSel;
  if (!id)
    return `<div class="op-panelmsg">Select an order to see its lifecycle, pending items and the next best action.</div>`;
  const o = (APP._oqOrders || []).find(x => x.id === id);
  if (!o) return `<div class="op-panelmsg">Order not in the current view.</div>`;

  const stage = opStageIndex(o.status);
  const complete = opIsComplete(o.status);
  const stepCls = i => complete ? 'done' : (i < stage ? 'done' : (i === stage ? 'cur' : ''));
  const steps = OP_STAGES.map((s, i) => {
    const cls = stepCls(i);
    const bub = (cls === 'done') ? '✓' : (i + 1);
    return `<div class="op-step ${cls}"><div class="bub">${bub}</div><div class="slab">${s}</div></div>`;
  }).join('');

  const nba = opNextAction(o);
  const prio = opPrio(o);

  // Pending quantities come from the per-order drilldown (fetched on select).
  const drill = APP._opDrill && APP._opDrill[id];
  let itemsHtml;
  if (!drill) {
    itemsHtml = `<div style="color:var(--text-muted);font-size:.82rem;display:flex;align-items:center;gap:8px"><span class="spinner" style="width:16px;height:16px"></span>Loading items…</div>`;
  } else {
    const lines = drill.lines || [];
    itemsHtml = `<table class="op-items"><thead><tr><th>Item</th><th class="n">Ordered</th><th class="n">Delivered</th><th class="n">Pending</th></tr></thead>
      <tbody>${lines.map(l => {
        const pd = Math.max(0, Number(l.qty_due) || 0);
        return `<tr>
          <td><div class="inm">${h(l.name || l.sku)}</div><div class="isku">${h(l.sku || '')}</div></td>
          <td class="n">${l.qty_ordered || 0}</td>
          <td class="n">${l.qty_delivered || '—'}</td>
          <td class="n ${pd > 0 ? 'pend' : 'pend0'}">${pd > 0 ? pd : '✓'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="4" style="color:var(--text-muted)">No line items.</td></tr>'}</tbody></table>`;
  }

  return `
    <div class="op-phead">
      <div class="op-ptop">
        <div><div class="op-pid">${h(o.id)}</div><div class="op-pclient">${h(o.client_name || '—')}</div></div>
        <button class="op-pclose" ${dataAct('opClosePanel')} aria-label="Close">✕</button>
      </div>
    </div>
    <div class="op-pkpis">
      <div class="op-pkpi"><div class="k">Order value</div><div class="v">${fmt(o.grand_total)}</div></div>
      <div class="op-pkpi"><div class="k">SKUs</div><div class="v">${o.item_count || 0}</div></div>
      <div class="op-pkpi"><div class="k">Priority</div><div class="v" style="${prio === 'High' ? 'color:var(--danger)' : ''}">${prio}</div></div>
    </div>
    <div class="op-psec">
      <h3>Lifecycle · <span style="color:var(--text)">${h(opStatusLabel(o))}</span></h3>
      <div class="op-steps">${steps}</div>
    </div>
    <div class="op-psec">
      <div class="op-nba">
        <div class="k">★ Next best action</div>
        <div class="txt">${h(nba.text)}</div>
        <div class="op-acts">
          ${nba.btn}
          <button class="op-btn ghost" ${dataAct('viewOrderDrilldown', o.id)}>View full details</button>
        </div>
      </div>
    </div>
    <div class="op-psec">
      <h3>Pending quantities</h3>
      ${itemsHtml}
    </div>`;
}

// Top-level render entry — rebuilds #oq-operator-area (toolbar + two-pane).
// Called by the Order Queue when the Operator tab is shown or its shared
// filters change.
function renderOperatorTab() {
  injectOpCss();
  const host = document.getElementById('oq-operator-area');
  if (!host) return;
  if (!APP._opOpen) APP._opOpen = {};

  // Drop a stale selection that's no longer in the filtered view.
  const visible = opFilteredOrders();
  if (APP._opSel && !visible.some(o => o.id === APP._opSel)) APP._opSel = null;

  // Open the first client by default so the operator lands on real work.
  const firstClient = visible.length ? (visible[0].client_name || '—') : null;
  if (firstClient && Object.keys(APP._opOpen).length === 0) APP._opOpen[firstClient] = true;

  host.innerHTML = `
    <div class="op-toolbar">
      <label class="op-search">🔍 <input type="text" placeholder="Search order # or client…" value="${h(APP._opQ || '')}" ${dataInputVal('opSetQ')} aria-label="Search operator worklist"></label>
      <select class="filter-select" ${dataChangeVal('opSetPrio')} aria-label="Filter by priority">
        <option value="" ${!APP._opPrio ? 'selected' : ''}>All priorities</option>
        <option value="High" ${APP._opPrio === 'High' ? 'selected' : ''}>High (Urgent)</option>
        <option value="Normal" ${APP._opPrio === 'Normal' ? 'selected' : ''}>Normal</option>
      </select>
      <button class="btn btn-secondary btn-sm" ${dataAct('opClearFilters')}>Clear</button>
    </div>
    <div class="op-pane">
      <div class="op-list" id="op-list">${opListHtml()}</div>
      <aside class="op-panel" id="op-panel">${opPanelHtml()}</aside>
    </div>`;

  // Kick off the drilldown fetch if a selected order has no cached items yet.
  if (APP._opSel && !(APP._opDrill && APP._opDrill[APP._opSel])) opLoadDrill(APP._opSel);
}

// Lightweight refreshers that avoid rebuilding the whole tab on every click.
function opRefreshList() { const el = document.getElementById('op-list'); if (el) el.innerHTML = opListHtml(); }
function opRefreshPanel() { const el = document.getElementById('op-panel'); if (el) el.innerHTML = opPanelHtml(); }

async function opLoadDrill(orderId) {
  if (!APP._opDrill) APP._opDrill = {};
  if (APP._opDrill[orderId]) { opRefreshPanel(); return; }
  const d = await api(`/orders/${orderId}/drilldown`);
  if (d) APP._opDrill[orderId] = d;
  if (APP._opSel === orderId) opRefreshPanel();
}

// ── Delegated handlers (all global) ────────────────────────────────────────
function opToggleClient(name) {
  if (!APP._opOpen) APP._opOpen = {};
  APP._opOpen[name] = !APP._opOpen[name];
  opRefreshList();
}
function opSelectOrder(orderId) {
  APP._opSel = (APP._opSel === orderId) ? null : orderId;
  opRefreshList();
  opRefreshPanel();
  if (APP._opSel) opLoadDrill(APP._opSel);
}
function opClosePanel() { APP._opSel = null; opRefreshList(); opRefreshPanel(); }
function opSetQ(val) { APP._opQ = (val || '').trim(); opRefreshList(); }
function opSetPrio(val) { APP._opPrio = val || ''; opRefreshList(); }
function opClearFilters() {
  APP._opQ = ''; APP._opPrio = '';
  renderOperatorTab();
}
