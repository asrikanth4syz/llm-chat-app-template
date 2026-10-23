/* ============================================================
   WAREHOUSE — Tabbed view (Section 6 rebuild)
   ============================================================ */
async function renderWarehouse(el) {
  el.innerHTML = `
  <div style="margin-bottom:12px">
    <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'settings')} style="display:inline-flex;align-items:center;gap:5px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
      Back to Settings
    </button>
  </div>
  ${pageHeader('Warehouse', 'Warehouses, bins, GRN, picklist & stock transfers',
    `<button class="btn btn-primary" ${dataAct('addWarehouseModal')}>${iconPlus(14)} Add Warehouse</button>`)}
  <div id="wh-returns-queue"></div>
  <div class="tabs" id="wh-tabs" style="margin-bottom:16px">
    <button class="tab-btn active" ${dataActEl('switchWHTab', 'overview')}>Overview</button>
    <button class="tab-btn" ${dataActEl('switchWHTab', 'grn')}>GRN Records</button>
    <button class="tab-btn" ${dataActEl('switchWHTab', 'bins')}>Bin Locations</button>
    <button class="tab-btn" ${dataActEl('switchWHTab', 'picklist')}>Pick List</button>
    <button class="tab-btn" ${dataActEl('switchWHTab', 'transfers')}>Stock Transfers</button>
    <button class="tab-btn" ${dataActEl('switchWHTab', 'gifting')}>🎁 Gifting</button>
  </div>
  <div id="wh-tab-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading...</div></div>`;

  switchWHTab('overview', document.querySelector('#wh-tabs .tab-btn'));
  loadWarehouseReturnsQueue();
}

/* ── Returns awaiting warehouse check & approval ──
   The approval is a warehouse control: super_admin / ops_admin / warehouse_exec
   verify the returned goods, then approve to restock (server enforces the same set).
   The queue is shown both on the Warehouse page and on the Deliveries page (where the
   RETURN_PENDING challan lives), so it's discoverable wherever the reviewer is. */
function canReviewReturns() { return ['super_admin','ops_admin','warehouse_exec'].includes(APP.user && APP.user.role); }
function loadWarehouseReturnsQueue() { return loadReturnsApprovalQueue('wh-returns-queue'); }
async function loadReturnsApprovalQueue(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!canReviewReturns()) { wrap.innerHTML = ''; return; }   // only reviewers see the approval queue
  const returns = await api('/returns').catch(()=>[]) || [];
  const pending = returns.filter(r => r.status === 'PENDING');
  if (!pending.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
  <div class="card" style="border:1.5px solid #fcd34d;margin-bottom:16px;overflow:hidden;padding:0">
    <div style="padding:12px 18px;background:var(--warning-bg);border-bottom:1px solid #fde68a;display:flex;align-items:center;gap:8px">
      <span style="font-size:1.1rem">↩</span>
      <b style="font-size:.9rem;color:var(--amber-text)">Returns Awaiting Check & Approval (${pending.length})</b>
      <span style="font-size:.74rem;color:#b45309">— verify returned goods, then approve to restock</span>
    </div>
    ${pending.map(r => `
    <div style="padding:14px 18px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="min-width:0">
          <div style="font-weight:700;font-size:.88rem;color:var(--navy)">${r.id} · DC ${r.dc_id}${r.client_name?` · ${h(r.client_name)}`:''}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">By ${h(r.created_by_name||'—')} · ${fmtDate(r.created_at)}${r.reason?` · Reason: <i>${h(r.reason)}</i>`:''}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${(r.items||[]).map(i=>`<span style="font-size:.72rem;font-weight:600;background:var(--amber-bg);color:var(--amber-text);border-radius:6px;padding:3px 9px">${h(i.name||i.sku)} × ${i.qty}</span>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" ${dataAct('reviewReturn', r.id, 'approve')}>✓ Checked & Approve</button>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger)" ${dataAct('reviewReturn', r.id, 'reject')}>✕ Reject</button>
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn ${action==='approve'?'btn-primary':'btn-danger'}" ${dataAct('confirmReviewReturn', retId, action)}>${action==='approve'?'✓ Approve & Restock':'✕ Reject Return'}</button>`);
}

async function confirmReviewReturn(retId, action) {
  const note = document.getElementById('ret-review-note')?.value?.trim();
  const res = await api(`/returns/${retId}/${action}`, { method:'POST', body: JSON.stringify({ note }) });
  closeModal();
  if (res) {
    showToast(action==='approve' ? `Return ${retId} approved — stock restored` : `Return ${retId} rejected`);
    // Refresh whichever surface is open: the Warehouse banner, and/or the Deliveries
    // view (the challan just changed status — CANCELLED on approve, reverted on reject).
    loadWarehouseReturnsQueue();
    if (document.getElementById('dc-returns-queue')) {
      if (typeof refreshDeliveryView === 'function') refreshDeliveryView('renderDelivery');
      else loadReturnsApprovalQueue('dc-returns-queue');
    }
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
    } else if (tab === 'gifting') {
      const orders = await api('/gifting-orders');
      renderWHGifting(content, orders||[]);
    }
  } catch(e) {
    content.innerHTML = `<div class="card" style="padding:24px;text-align:center;color:var(--danger)">
      Error loading data. <button class="btn btn-secondary btn-sm" ${dataAct('whGoTab', tab)}>Retry</button>
    </div>`;
  }
}

// ── Gifting orders (milestone 007, Slice 1) ──────────────────────────────────
// A separate pipeline of GIFTING orders (converted from gifting quotes). Each item
// runs its own workflow: pick vendor → order → receive → (branding) → collect →
// dispatch. Branding sample + client approval = Slice 2; delivery wiring = Slice 3.
const GIFT_STAGE_LABEL = { TO_ORDER:'To order', ORDERED:'Ordered', RECEIVED:'Received', BRANDING:'Branding', SAMPLE_SENT:'Sample sent', APPROVED:'Approved', AT_OFFICE:'At office', DISPATCHED:'Dispatched' };
const GIFT_PHASE_LABEL = { PROCURING:'Procuring', BRANDING:'Branding', AWAITING_APPROVAL:'Awaiting approval', CONSOLIDATING:'Consolidating', FULFILLED:'Fulfilled', EMPTY:'—' };
function giftStageChip(s) {
  const cls = (s==='DISPATCHED') ? 'gift-done' : (s==='AT_OFFICE'||s==='APPROVED') ? 'gift-ready' : (s==='SAMPLE_SENT') ? 'gift-wait' : (s==='BRANDING') ? 'gift-brand' : (s==='TO_ORDER') ? 'gift-pending' : 'gift-prog';
  return `<span class="gift-chip ${cls}">${GIFT_STAGE_LABEL[s]||s}</span>`;
}
// Integer paise → ₹ display (Slice 4 gifting cost/margin). Rupees, grouped, no decimals.
function giftMoney(paise) { return '₹' + Math.round((Number(paise) || 0) / 100).toLocaleString('en-IN'); }
// Slice 8: compact PO / GRN line for an ordered-or-later item (PO ref · expected ·
// buying cost · received qty), shown above the stage action.
function giftPoLine(it) {
  const bits = [];
  if (it.po_number) bits.push('PO ' + h(it.po_number));
  if (it.po_expected_date) bits.push('exp ' + h(it.po_expected_date));
  if (Number(it.procurement_cost_paise) > 0) bits.push(giftMoney(it.procurement_cost_paise));
  if (it.received_qty != null && it.stage !== 'ORDERED') bits.push('recd ' + it.received_qty);
  return bits.length ? `<div class="gift-sub">${bits.join(' · ')}</div>` : '';
}
// Sum the order's sale / cost / margin across its items (recomputed client-side as
// costs are edited, so the header rollup stays live without a refetch).
function giftComputeTotals(items) {
  return (items || []).reduce((t, it) => {
    const sale = Number(it.sale_value_paise) || 0;
    const cost = (Number(it.procurement_cost_paise) || 0) + (Number(it.branding_cost_paise) || 0);
    t.sale += sale; t.cost += cost; t.margin += (sale - cost);
    return t;
  }, { sale: 0, cost: 0, margin: 0 });
}
function renderWHGifting(el, orders) {
  if (!orders.length) {
    el.innerHTML = `<div class="card"><div class="empty-state empty-sm"><div class="empty-icon">🎁</div><div class="empty-title">No gifting orders yet</div><div class="empty-desc">Convert a quote marked <b>Gifting</b> to create one.</div></div></div>`;
    return;
  }
  el.innerHTML = `<div class="card" style="padding:0"><div class="table-wrap"><table class="data-table" style="width:100%;border-collapse:collapse">
    <thead><tr>
      <th style="text-align:left;padding:11px 14px">Order</th>
      <th style="text-align:left;padding:11px 14px">Client</th>
      <th style="text-align:left;padding:11px 14px">Phase</th>
      <th style="text-align:left;padding:11px 14px">Ready</th>
      <th style="text-align:right;padding:11px 14px">Value</th>
      <th style="text-align:right;padding:11px 14px">Margin</th>
    </tr></thead>
    <tbody>${orders.map(o => {
      const ready = o.item_count ? Math.round((o.ready_count/o.item_count)*100) : 0;
      const margin = Number(o.margin_paise||0), sale = Number(o.sale_paise||0), hasCost = Number(o.cost_paise||0) > 0;
      const mpct = sale > 0 ? Math.round(margin/sale*100) : 0;
      return `<tr class="q-trow" ${dataAct('giftingOpenBoard', o.id)}>
        <td style="padding:11px 14px;font-weight:700;color:var(--navy);white-space:nowrap">🎁 ${h(o.id)}</td>
        <td style="padding:11px 14px">${h(o.client_name||o.client_id||'')}</td>
        <td style="padding:11px 14px"><span class="gift-chip gift-prog">${GIFT_PHASE_LABEL[o.phase]||o.phase}</span></td>
        <td style="padding:11px 14px;white-space:nowrap"><span style="display:inline-block;width:80px;height:8px;border-radius:999px;background:var(--surface-3,var(--surface-2));vertical-align:middle;overflow:hidden"><i style="display:block;height:100%;width:${ready}%;background:linear-gradient(90deg,var(--navy),var(--teal,var(--navy)))"></i></span> <span style="font-size:.8rem;color:var(--text-muted)">${o.ready_count}/${o.item_count}</span></td>
        <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums">₹${Number(o.grand_total||0).toLocaleString('en-IN')}</td>
        <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums${margin<0?';color:var(--danger)':hasCost?';color:var(--success)':''}">${hasCost ? giftMoney(margin) + (sale>0?` · ${mpct}%`:'') : '<span style="color:var(--text-muted)">—</span>'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div></div>`;
}
async function giftingOpenBoard(orderId) {
  const content = document.getElementById('wh-tab-content');
  if (content) content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';
  const [data, vendors] = await Promise.all([api('/gifting-orders/' + orderId), api('/vendors').catch(()=>[])]);
  if (!data || !data.order) { if (content) content.innerHTML = '<div class="card" style="padding:24px;color:var(--danger)">Could not load the gifting order.</div>'; return; }
  APP._gift = { orderId, order: data.order, items: data.items || [], vendors: vendors || [] };
  giftingRenderBoard();
}
function giftingRenderBoard() {
  const g = APP._gift; const content = document.getElementById('wh-tab-content'); if (!g || !content) return;
  const items = g.items;
  const ready = items.filter(i => i.stage==='AT_OFFICE' || i.stage==='DISPATCHED').length;
  const atOffice = items.filter(i => i.stage==='AT_OFFICE').length;
  const pct = items.length ? Math.round(ready/items.length*100) : 0;
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div>
        <button class="btn btn-secondary btn-sm" ${dataActEl('switchWHTab', 'gifting')} style="margin-bottom:6px">← All gifting orders</button>
        <div style="font-size:1.1rem;font-weight:800;color:var(--navy)">🎁 ${h(g.order.id)}</div>
        <div style="font-size:.84rem;color:var(--text-muted)">${h(g.order.client_name||g.order.client_id||'')}${g.order.source_quote_id?` · from quote ${h(g.order.source_quote_id)}`:''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="min-width:160px">
          <div style="height:10px;border-radius:999px;background:var(--surface-3,var(--surface-2));overflow:hidden;border:1px solid var(--border)"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,var(--navy),var(--teal,var(--navy)))"></i></div>
          <div style="font-size:.78rem;font-weight:700;color:var(--navy);text-align:right;margin-top:4px">${ready} / ${items.length} items ready</div>
        </div>
        <button class="btn btn-secondary" ${dataAct('giftingCopyTrackLink', g.order.id)} title="Share a read-only tracking page with the client">🔗 Client tracking link</button>
        <button class="btn btn-primary" ${dataAct('giftingDispatch', g.order.id)}${atOffice?'':' disabled'}>🚚 Dispatch ready (${atOffice})</button>
      </div>
    </div>
    ${(() => { const t = giftComputeTotals(items); const mcls = t.margin < 0 ? 'gift-m-neg' : 'gift-m-pos';
      return `<div class="gift-rollup">
        <div class="gift-rollup-cell"><span>Sale value</span><b>${giftMoney(t.sale)}</b></div>
        <div class="gift-rollup-cell"><span>Cost (buying + branding)</span><b>${giftMoney(t.cost)}</b></div>
        <div class="gift-rollup-cell"><span>Margin</span><b class="${mcls}">${giftMoney(t.margin)}${t.sale>0?` · ${Math.round(t.margin/t.sale*100)}%`:''}</b></div>
      </div>`; })()}
    <div class="gift-board">${items.map(giftingItemCard).join('')}</div>
    <div class="form-hint" style="margin-top:10px">Partial dispatch is allowed — dispatch items that are at office without waiting for the rest. Enter each item's buying &amp; branding cost to see live margin.</div>`;
}
function giftingItemCard(it) {
  const g = APP._gift;
  const canBrand = ['TO_ORDER','ORDERED','RECEIVED'].includes(it.stage);
  const vendorCell = it.stage === 'TO_ORDER'
    ? `<select class="form-control form-control-sm gift-vendor" ${dataChangeEl('giftingSetVendor', it.id)}><option value="">— select vendor —</option>${(g.vendors||[]).map(v=>`<option value="${h(v.id)}"${it.vendor_id===v.id?' selected':''}>${h(v.name||v.id)}</option>`).join('')}</select>`
    : `<div class="gift-vendor-set">Vendor: <b>${h(it.vendor_name||it.vendor_id||'—')}</b></div>`;
  // action per stage
  let action = '';
  const sm = it.sample;
  if (it.stage === 'DISPATCHED') action = `<span class="gift-chip gift-done">✓ Dispatched</span>`;
  else if (it.stage === 'BRANDING') {
    const rejected = sm && sm.decision === 'REJECTED';
    action = `${rejected ? `<div class="gift-reject">↩ Client requested changes${sm.reject_reason?`: “${h(sm.reject_reason)}”`:''}</div>` : ''}
      <input id="gref-${it.id}" class="form-control form-control-sm gift-ref" placeholder="Sample ref / note">
      <button class="btn btn-primary btn-sm" ${dataAct('giftingSendSample', it.id)}>${rejected ? 'Send new sample' : 'Send sample to client'}</button>`;
  } else if (it.stage === 'SAMPLE_SENT') {
    action = `<span class="gift-chip gift-wait">◷ Awaiting client approval${sm?` · round ${sm.round}`:''}</span>
      ${sm && sm.ref ? `<div class="gift-sub">Sent: ${h(sm.ref)}</div>` : ''}
      ${sm && sm.approval_token ? `<button class="btn btn-secondary btn-sm" ${dataAct('giftingCopyLink', sm.approval_token)}>🔗 Copy approval link</button>` : ''}`;
  } else if (it.stage === 'AT_OFFICE') {
    action = `<span class="gift-chip gift-ready">● At office — ready</span><div class="gift-sub">Dispatch from the header (partial OK)</div>`;
  } else if (it.stage === 'TO_ORDER') {
    // Slice 8: raise a costed PO (vendor required) via the order modal.
    const dis = it.vendor_id ? '' : ' disabled';
    action = `<button class="btn btn-primary btn-sm" ${dataAct('giftingOrderModal', it.id)}${dis}>Place order →</button>`;
  } else if (it.stage === 'ORDERED') {
    // Slice 8: receive against the PO (GRN) via the receive modal.
    action = `${giftPoLine(it)}<button class="btn btn-primary btn-sm" ${dataAct('giftingReceiveModal', it.id)}>Receive →</button>`;
  } else {
    const label = it.stage==='RECEIVED' ? (it.needs_branding?'Start branding':'Collect at office') : it.stage==='APPROVED' ? 'Collect at office' : 'Advance';
    action = `${giftPoLine(it)}<button class="btn btn-primary btn-sm" ${dataAct('giftingAdvance', it.id)}>${label} →</button>`;
  }
  // Slice 4: per-item cost capture + margin. Buying cost always; branding cost only
  // for branded items. Editable until dispatched; margin = sale − (buying + branding).
  const costEditable = it.stage !== 'DISPATCHED';
  const rupees = (p) => ((Number(p) || 0) / 100) || '';
  const sale = Number(it.sale_value_paise) || 0;
  const cost = (Number(it.procurement_cost_paise) || 0) + (Number(it.branding_cost_paise) || 0);
  const margin = sale - cost;
  const costBlock = `<div class="gift-cost">
    <label class="gift-cost-f"><span>Buying cost ₹</span>
      <input type="number" min="0" step="0.01" id="gcost-proc-${it.id}" value="${rupees(it.procurement_cost_paise)}" placeholder="0"${costEditable ? '' : ' disabled'} ${dataChangeEl('giftingSaveCosts', it.id)}></label>
    ${it.needs_branding ? `<label class="gift-cost-f"><span>Branding cost ₹</span>
      <input type="number" min="0" step="0.01" id="gcost-brand-${it.id}" value="${rupees(it.branding_cost_paise)}" placeholder="0"${costEditable ? '' : ' disabled'} ${dataChangeEl('giftingSaveCosts', it.id)}></label>` : ''}
    <div class="gift-cost-margin">Sale <b>${giftMoney(sale)}</b> · Margin <b class="${margin < 0 ? 'gift-m-neg' : 'gift-m-pos'}">${giftMoney(margin)}</b></div>
  </div>`;
  return `<div class="gift-card">
    <div class="gift-id">
      <div class="gift-name">${h(it.name)}</div>
      <div class="gift-sku">SKU ${h(it.sku||'—')} · Qty ${it.qty}</div>
      <label class="gift-brandtog"><input type="checkbox"${it.needs_branding?' checked':''}${canBrand?'':' disabled'} ${dataChangeEl('giftingToggleBranding', it.id)}> Needs branding</label>
    </div>
    <div class="gift-mid">${vendorCell}${costBlock}</div>
    <div class="gift-act">${giftStageChip(it.stage)}${action}${it.sample_rounds > 1 ? `<button class="btn btn-secondary btn-sm gift-hist-btn" ${dataAct('giftingSampleHistory', it.id)}>🕑 Sample history (${it.sample_rounds})</button>` : ''}</div>
  </div>`;
}
async function giftingSetVendor(itemId, el) {
  const r = await api('/gifting-items/' + itemId + '/vendor', { method:'POST', body: JSON.stringify({ vendor_id: el.value }) });
  if (r) { const it = (APP._gift.items||[]).find(x=>x.id===itemId); if (it) it.vendor_id = el.value; giftingRenderBoard(); }
}
async function giftingToggleBranding(itemId, el) {
  const r = await api('/gifting-items/' + itemId + '/branding', { method:'POST', body: JSON.stringify({ needs_branding: !!el.checked }) });
  if (r) { const it = (APP._gift.items||[]).find(x=>x.id===itemId); if (it) it.needs_branding = el.checked ? 1 : 0; giftingRenderBoard(); }
}
// Save a gifting item's buying / branding cost; refresh the margin readout + the
// order rollup (recomputed from the locally-updated items).
async function giftingSaveCosts(itemId, el) {
  const procEl = document.getElementById('gcost-proc-' + itemId);
  const brandEl = document.getElementById('gcost-brand-' + itemId);
  const payload = {};
  if (procEl) payload.procurement_cost = Number(procEl.value) || 0;
  if (brandEl) payload.branding_cost = Number(brandEl.value) || 0;
  const r = await api('/gifting-items/' + itemId + '/costs', { method:'POST', body: JSON.stringify(payload) });
  if (r && r.ok) {
    const it = (APP._gift.items||[]).find(x=>x.id===itemId);
    if (it) { it.procurement_cost_paise = r.procurement_cost_paise; it.branding_cost_paise = r.branding_cost_paise; }
    giftingRenderBoard();
  }
}
async function giftingAdvance(itemId) {
  const r = await api('/gifting-items/' + itemId + '/advance', { method:'POST', body: '{}' });
  if (r && r.stage) { const it = (APP._gift.items||[]).find(x=>x.id===itemId); if (it) it.stage = r.stage; giftingRenderBoard(); }
}
// Slice 8: raise a costed per-item PO (vendor must already be set).
function giftingOrderModal(itemId) {
  const it = (APP._gift.items || []).find(x => x.id === itemId); if (!it) return;
  openModal(`Place order — ${h(it.name)}`,
    `<div class="form-hint" style="margin-bottom:10px">Vendor: <b>${h(it.vendor_name || it.vendor_id || '—')}</b> · Qty ${it.qty}</div>
     <div class="form-group"><label>Buying cost for this item (₹)</label><input type="number" id="go-cost" min="0" step="0.01" value="${(Number(it.procurement_cost_paise) || 0) / 100 || ''}" placeholder="total buying cost"></div>
     <div class="form-group"><label>PO number (optional)</label><input type="text" id="go-po" maxlength="60" placeholder="vendor PO / reference" value="${h(it.po_number || '')}"></div>
     <div class="form-group"><label>Expected delivery (optional)</label><input type="date" id="go-exp" max="9999-12-31" value="${h(it.po_expected_date || '')}"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('giftingSubmitOrder', itemId)}>Place order</button>`);
}
async function giftingSubmitOrder(itemId) {
  const cost = document.getElementById('go-cost')?.value;
  const po_number = document.getElementById('go-po')?.value || '';
  const expected_date = document.getElementById('go-exp')?.value || '';
  const r = await api('/gifting-items/' + itemId + '/order', { method:'POST', body: JSON.stringify({ cost: cost === '' ? undefined : Number(cost), po_number, expected_date }) });
  if (r && r.ok) { closeModal(); showToast('Order placed'); giftingOpenBoard(APP._gift.orderId); }
}
// Slice 8: record the GRN (received qty + actual cost) against the PO.
function giftingReceiveModal(itemId) {
  const it = (APP._gift.items || []).find(x => x.id === itemId); if (!it) return;
  openModal(`Receive — ${h(it.name)}`,
    `<div class="form-hint" style="margin-bottom:10px">Vendor: <b>${h(it.vendor_name || '—')}</b>${it.po_number ? ` · PO ${h(it.po_number)}` : ''} · Ordered qty ${it.qty}</div>
     <div class="form-group"><label>Received qty</label><input type="number" id="gr-qty" min="0" step="1" value="${it.qty}"></div>
     <div class="form-group"><label>Actual buying cost (₹, optional)</label><input type="number" id="gr-cost" min="0" step="0.01" value="${(Number(it.procurement_cost_paise) || 0) / 100 || ''}" placeholder="adjust if different"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('giftingSubmitReceive', itemId)}>Mark received</button>`);
}
async function giftingSubmitReceive(itemId) {
  const received_qty = document.getElementById('gr-qty')?.value;
  const cost = document.getElementById('gr-cost')?.value;
  const r = await api('/gifting-items/' + itemId + '/receive', { method:'POST', body: JSON.stringify({ received_qty: received_qty === '' ? undefined : Number(received_qty), cost: cost === '' ? undefined : Number(cost) }) });
  if (r && r.ok) { closeModal(); showToast(`Received ${r.received_qty} unit(s)`); giftingOpenBoard(APP._gift.orderId); }
}
async function giftingSendSample(itemId) {
  const inp = document.getElementById('gref-' + itemId);
  const ref = inp ? inp.value : '';
  const r = await api('/gifting-items/' + itemId + '/sample', { method:'POST', body: JSON.stringify({ ref }) });
  if (r && r.approval_token) { showToast('Sample sent — share the approval link with the client'); giftingOpenBoard(APP._gift.orderId); }
}
async function giftingDispatch(orderId) {
  const r = await api('/gifting-orders/' + orderId + '/dispatch', { method:'POST', body: '{}' });
  if (r && r.ok) {
    showToast(`Dispatched ${r.dispatched} item${r.dispatched>1?'s':''} · DC ${r.dc_number}${r.all_dispatched?' · order fully dispatched':''}`);
    giftingOpenBoard(orderId);
  }
}
// Slice 5: full sample history for one item — every round, its sample ref, the
// client's decision + reason, and the sent/decided timestamps, oldest first.
async function giftingSampleHistory(itemId) {
  const d = await api('/gifting-items/' + itemId + '/samples');
  if (!d || !d.samples) return;
  const chip = (s) => s.decision === 'APPROVED' ? '<span class="gift-chip gift-done">✓ Approved</span>'
    : s.decision === 'REJECTED' ? '<span class="gift-chip gift-rej">✕ Rejected</span>'
    : '<span class="gift-chip gift-wait">◷ Awaiting client</span>';
  const rows = (d.samples || []).map(s => `<div class="gift-hist-row">
      <div class="gift-hist-round">Round ${s.round}</div>
      <div class="gift-hist-body">
        <div class="gift-hist-head">${chip(s)} <span class="gift-hist-date">sent ${fmtDate(s.sent_at)}${s.decided_at ? ` · decided ${fmtDate(s.decided_at)}` : ''}</span></div>
        ${s.ref ? `<div class="gift-hist-ref">Sample: ${h(s.ref)}</div>` : ''}
        ${s.reject_reason ? `<div class="gift-hist-reason">Client feedback: “${h(s.reject_reason)}”</div>` : ''}
      </div>
    </div>`).join('');
  openModal(`Sample history — ${h(d.item && d.item.name || 'item')}`,
    `<div class="gift-hist">${rows || '<div class="form-hint">No samples sent yet.</div>'}</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}
// Slice 7: mint (once) and copy the client's read-only order-tracking link.
async function giftingCopyTrackLink(orderId) {
  const r = await api('/gifting-orders/' + orderId + '/track-link', { method:'POST', body: '{}' });
  if (!r || !r.link) return;
  const link = r.link;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => showToast('Client tracking link copied'), () => showToast(link, 'info'));
  } else { showToast(link, 'info'); }
}
function giftingCopyLink(token) {
  const link = location.origin + '/gift-approve/' + token;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => showToast('Approval link copied'), () => showToast(link, 'info'));
  } else { showToast(link, 'info'); }
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

  // Canonical tile; the accent dot (borderColor) carries the status signal the
  // old coloured sub-line used to.
  const kpiTile = (label, value, sub, _subColor, borderColor) => tileHtml({ label, value, sub, accent: borderColor });

  el.innerHTML = `
  <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr));margin-bottom:20px">
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
  <div style="background:#fef3cd;border:1px solid var(--amber);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:var(--amber-text);display:flex;gap:10px;align-items:center">
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
            <div style="font-weight:700;font-size:.95rem">${h(w.name)}</div>
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
            <div style="text-align:center;background:${wOOS>0?'var(--danger-soft-bg)':wLow>0?'#fef3cd':'var(--light)'};border-radius:6px;padding:8px 4px">
              <div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Alerts</div>
              <div style="font-weight:700;font-size:.9rem;margin-top:2px;color:${wOOS>0?'var(--danger)':wLow>0?'var(--warning)':'var(--success)'}">${wOOS+wLow||'—'}</div>
            </div>
          </div>
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:4px">
              <span class="u-muted">Bin Utilisation</span>
              <span style="font-weight:700;color:${color}">${utilPct}%</span>
            </div>
            <div style="background:var(--border);height:7px;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${utilPct}%;background:${color};border-radius:4px;transition:width .4s ease"></div>
            </div>
            <div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">${occupied} of ${cap} capacity used</div>
          </div>
          ${wOOS>0||wLow>0 ? `
          <div style="font-size:.75rem;color:${wOOS>0?'var(--danger)':'var(--warning)'};background:${wOOS>0?'var(--danger-soft-bg)':'#fef3cd'};padding:5px 8px;border-radius:4px;margin-bottom:10px">
            ${wOOS>0?`${wOOS} SKU${wOOS>1?'s':''} out of stock`:''}${wOOS>0&&wLow>0?' · ':''}${wLow>0?`${wLow} below reorder level`:''}
          </div>` : ''}
          <div style="display:flex;gap:6px">
            <button class="btn btn-secondary btn-sm" ${dataAct('editWarehouseModal', w.id, w.name||'', w.capacity||1000)}>Edit</button>
            <button class="btn btn-secondary btn-sm" ${dataAct('whGoTab', 'bins')}>View Bins</button>
            <button class="btn btn-primary btn-sm" ${dataAct('addBinModal', w.id)}>${iconPlus(12)} Bin</button>
          </div>
        </div>
      </div>`;
    }).join('')||'<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);grid-column:1/-1">No warehouses configured yet</div>'}
  </div>`;
}

function renderWHGRN(el, grns) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button class="btn btn-primary" ${dataAct('recordGRNModal')}>${iconPlus(14)} Record GRN</button>
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
        </tr>`).join('')||'<tr><td colspan="7" class="u-empty">No GRN records yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderWHBins(el, bins, warehouses) {
  const whMap = {};
  warehouses.forEach(w => { whMap[w.id] = w.name; });

  const whOptions = warehouses.map(w=>`<option value="${w.id}">${h(w.name)}</option>`).join('');

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
    <div style="display:flex;gap:8px;align-items:center">
      <label style="font-size:.875rem;color:var(--text-muted)">Filter by Warehouse:</label>
      <select id="bin-wh-filter" ${dataChange('filterBinsTable')} style="padding:6px 10px;border:1px solid var(--border);border-radius:6px">
        <option value="">All Warehouses</option>
        ${whOptions}
      </select>
    </div>
    <button class="btn btn-primary" ${dataAct('addBinModal')}>${iconPlus(14)} Add Bin</button>
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
              <td>${b.sku||'<em class="u-muted">Unassigned</em>'}</td>
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
                <button class="btn btn-secondary btn-sm" ${dataAct('editBinModal', b.id, b.code||'', b.zone||'', b.capacity||0, b.sku||'')}>Edit</button>
              </td>
            </tr>`;
          }).join('')||'<tr><td colspan="8" class="u-empty">No bins yet</td></tr>'}
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
              <span style="margin-left:8px;color:var(--text-muted)">${h(order.client_name)}</span>
              <span style="margin-left:8px;font-size:.8rem;color:var(--text-muted)">${fmtDate(order.created_at)}</span>
              ${statusBadge(order.status)}
              ${(order.status==='PICKED'||order.status==='QUALITY_CHECK')&&order.picker_name?`<span style="margin-left:6px;font-size:.78rem;color:var(--text-muted)">Picked by ${order.picker_name}</span>`:''}
            </div>
            <div>
              ${order.status==='QUALITY_CHECK'
                ? `<button class="btn btn-success btn-sm" ${dataAct('createDCFromPicklist', order.order_id)}>✓ Pass &rarr; Dispatch</button>
                   <button class="btn btn-warning btn-sm" style="margin-left:4px" ${dataAct('advanceOrder', order.order_id, 'READY_TO_PICK', 'Quality check failed — returned for re-pick')}>↩ Re-Pick</button>`
                : order.status==='PICKED'
                  ? `<button class="btn btn-info btn-sm" ${dataAct('advanceOrder', order.order_id, 'QUALITY_CHECK', 'Items picked — quality check & packing')}>Quality Check</button>`
                  : `<button class="btn btn-primary btn-sm" ${dataAct('pickOrderModal', order.order_id)}>Pick Items</button>`
              }
            </div>
          </div>
          <div class="table-wrap">
            <table class="table" style="margin:0">
              <thead><tr><th>Item Name</th><th>SKU</th><th>Qty Required</th><th>Qty Picked</th><th>Stock Available</th><th>Bin Picked From</th></tr></thead>
              <tbody>${order.items.map(item=>`<tr>
                <td><b>${h(item.item_name)}</b></td>
                <td style="color:var(--text-muted);font-size:.82rem">${item.sku}</td>
                <td>${item.qty}</td>
                <td>${item.picked_qty!=null
                  ? `<b style="color:${item.picked_qty<item.qty?'var(--warning)':'var(--success)'}">${item.picked_qty}</b>${item.picked_qty<item.qty?`<span style="margin-left:4px;font-size:.75rem;color:var(--warning)">(short by ${item.qty-item.picked_qty})</span>`:''}`
                  : '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="color:${item.stock_available<item.qty?'var(--danger)':'var(--success)'}">
                  <b>${item.stock_available}</b>
                  ${item.stock_available<item.qty?`<span style="margin-left:4px;font-size:.75rem">(short by ${item.qty-item.stock_available})</span>`:''}
                </td>
                <td>${item.bin_code||'—'}</td>
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
          <button class="btn btn-primary" ${dataAct('submitStockTransfer')}>Transfer Stock</button>
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
        </tr>`).join('')||'<tr><td colspan="7" class="u-empty">No transfers yet</td></tr>'}
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
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-primary" ${dataAct('saveGRN')}>Record GRN</button>`);
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
    const whOptions = (warehouses||[]).map(w=>`<option value="${w.id}" ${w.id===warehouseId?'selected':''}>${h(w.name)}</option>`).join('');
    openModal('Add Bin Location',
      `<div class="form-group"><label>Warehouse</label>
         <select id="bin-wh">${whOptions}</select></div>
       <div class="form-group"><label>Bin Code</label><input type="text" id="bin-code" placeholder="e.g. A-01-01"></div>
       <div class="form-group"><label>Zone</label><input type="text" id="bin-zone" placeholder="e.g. A, Cold Storage, Dry"></div>
       <div class="form-group"><label>Capacity (units)</label><input type="number" id="bin-cap" value="100" min="1"></div>`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-primary" ${dataAct('saveBin')}>Add Bin</button>`);
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveBinEdit', binId)}>Save Changes</button>`);
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('confirmCreateDCFromPicklist', orderId)}>Confirm Dispatch</button>`);
}

async function confirmCreateDCFromPicklist(orderId) {
  if (APP._dcCreating) return; // guard against a double-click firing two dispatches
  APP._dcCreating = true;
  let res;
  try {
    res = await api(`/orders/${orderId}/transition`, {
      method: 'POST',
      body: JSON.stringify({ to: 'IN_SHIPMENT', note: 'Items picked — dispatched to delivery' })
    });
  } finally { APP._dcCreating = false; }
  closeModal();
  if (!res) return;
  showToast(`Order ${orderId} dispatched — DC created`);
  // Refresh the view the button was clicked from, so the row's status/actions
  // reflect IN_SHIPMENT immediately (otherwise a second click re-fires the same
  // transition and the FSM rejects IN_SHIPMENT→IN_SHIPMENT).
  if (APP.page === 'warehouse') switchWHTab('picklist', document.querySelectorAll('#wh-tabs .tab-btn')[3]);
  else navigate(APP.page);
}

async function pickOrderModal(orderId) {
  const [order, bins, drill] = await Promise.all([
    api(`/orders/${orderId}`),
    api('/bin-locations').catch(()=>[]),
    api(`/orders/${orderId}/drilldown`).catch(()=>null),
  ]);
  // Pick only the OUTSTANDING balance. On a replenishment pick (after a partial
  // delivery) the drilldown gives ordered/delivered/due per line; fall back to
  // the raw order lines (due = ordered) when the drilldown isn't available.
  let lines = (drill && Array.isArray(drill.lines))
    ? drill.lines.filter(l => (parseInt(l.qty_due)||0) > 0)
        .map(l => ({ sku:l.sku, name:l.name, ordered:parseInt(l.qty_ordered)||0, delivered:parseInt(l.qty_delivered)||0, due:parseInt(l.qty_due)||0 }))
    : (order?.items||[]).map(i => ({ sku:i.sku, name:i.name||i.item_name, ordered:parseInt(i.qty)||0, delivered:0, due:parseInt(i.qty)||0 }));
  // Fallback: if the drilldown reported nothing due (e.g. a stale or over-counted
  // delivery left a pickable order with all dues at 0) but the order still has lines,
  // pick against the raw order lines so a picked qty can always be entered.
  if (!lines.length && order && Array.isArray(order.items) && order.items.length) {
    lines = order.items.map(i => ({ sku:i.sku, name:i.name||i.item_name, ordered:parseInt(i.qty)||0, delivered:0, due:parseInt(i.qty)||0 }));
  }
  const anyDelivered = lines.some(l => l.delivered > 0);
  const totalDue = lines.reduce((n,l)=>n+(parseInt(l.due)||0),0);
  const clientName = order?.client_name || '';

  if (!lines.length) {
    openModal(`Pick Items — ${orderId}${clientName?` · ${clientName}`:''}`,
      `<div style="padding:24px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">✅</div>Every ordered quantity has already been delivered — nothing left to pick.</div>`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
    return;
  }

  // Picking context drives the whole modal. Each line's "remaining" (l.due) is the
  // target to pick; `vals` preserves entered qtys across the review ⇆ list swap and
  // `lastBin` remembers the most recent bin so the next line can suggest it.
  APP._pickCtx = {
    lines, bins: bins || [], binSel: {}, lastBin: '', vals: null,
    orderId, clientName, anyDelivered, totalDue,
    canAmend: ['super_admin', 'ops_admin', 'ops_manager', 'procurement_manager'].includes(APP.user && APP.user.role),
  };
  // Default each line's bin so the operator needn't pick one every time: the bin
  // that already stocks the SKU if known, else the first bin location ("bin 1").
  const firstBinCode = (bins && bins[0]) ? bins[0].code : '';
  lines.forEach(l => {
    const stock = (bins || []).find(x => (x.sku || '') === l.sku);
    const def = stock ? stock.code : firstBinCode;
    if (def) APP._pickCtx.binSel[l.sku] = def;
  });
  if (firstBinCode) APP._pickCtx.lastBin = firstBinCode;
  APP._pickScanMode = 'fill';
  openModal(`Pick Items — ${orderId}${clientName ? ` · ${clientName}` : ''}`, pickModalInner(), pickModalFooter());
  updatePickSummary();
  pickApplyFilters();
  const fs = document.getElementById('pick-search'); if (fs) fs.focus();
}

// Roles allowed to pick MORE than the remaining qty (the authorised over-pick
// workflow). Everyone else is capped at the remaining quantity per line.
function pickCanOverpick() { return ['super_admin', 'ops_admin'].includes(APP.user && APP.user.role); }

// The Pick Items body: summary tiles, a live name/SKU search + bin filter + a
// prominent "pick remaining" bulk action, the scanner row, then one card per line.
function pickModalInner() {
  const ctx = APP._pickCtx; if (!ctx) return '';
  const binFilterOpts = (ctx.bins || []).map(b => `<option value="${b.code}">${b.code}${b.zone ? ' — ' + b.zone : ''}</option>`).join('');
  return `
    <div class="pk-kbd" aria-hidden="true">⌨️ <span>Type a quantity and press <kbd>Enter</kbd> to jump to the next item. <kbd>↑</kbd>/<kbd>↓</kbd> move between items; <kbd>+</kbd>/<kbd>−</kbd> step by one.</span></div>
    <div class="pk-prog">
      <div class="pk-prog-track"><i id="pk-prog-bar"></i></div>
      <div id="pk-prog-txt" class="pk-prog-txt">0 of ${ctx.lines.length} items done</div>
    </div>
    <div class="pk-tiles">
      <div class="pk-tile"><b id="pk-t-products">${ctx.lines.length}</b><span>Products</span></div>
      <div class="pk-tile"><b id="pk-t-complete">0 / ${ctx.lines.length}</b><span>Items completed</span></div>
      <div class="pk-tile"><b id="pk-t-picked">0 / ${ctx.totalDue}</b><span>Units picked / to pick</span></div>
      <div class="pk-tile"><b id="pk-t-remaining">${ctx.totalDue}</b><span>Units remaining</span></div>
    </div>
    <div class="pk-controls">
      <input id="pick-search" type="search" autocomplete="off" placeholder="Find product or SKU…" ${dataInputVal('pickSearch')} aria-label="Find product or SKU">
      <select id="pick-binfilter" class="form-control form-control-sm" ${dataChangeVal('pickBinFilter')} aria-label="Filter by storage bin"><option value="">All bins</option>${binFilterOpts}</select>
      <span class="pk-bulk">
        <button type="button" class="btn btn-secondary btn-sm" ${dataAct('pickClearAll')} title="Set Pick now to 0 for every line">Clear all</button>
        <button type="button" class="btn btn-primary btn-sm" ${dataAct('pickFillDue')} title="Set Pick now to the remaining qty for every line">Pick all</button>
      </span>
    </div>
    <div class="pk-scanwrap">
      <div class="pk-scanbar">
        <span class="pk-scan-ic" aria-hidden="true">▣</span>
        <input id="pick-scan" type="text" autocomplete="off" inputmode="text" placeholder="Scan a barcode — hardware scanner or camera" ${dataEnter('pickScan')} aria-label="Scan barcode or SKU">
        <button type="button" class="btn btn-sm btn-secondary" id="pick-cam-btn" ${dataAct('pickCameraOpen')} title="Scan with the device camera">📷 Camera</button>
        <span class="pk-scanmode">
          <button type="button" class="btn btn-sm btn-primary" data-scanmode="fill" ${dataAct('pickSetScanMode', 'fill')} title="Each scan fills the line to its remaining qty">Fill</button>
          <button type="button" class="btn btn-sm btn-secondary" data-scanmode="count" ${dataAct('pickSetScanMode', 'count')} title="Each scan adds 1, counting up to the remaining qty">Count +1</button>
        </span>
      </div>
      <div id="pick-scan-msg" class="pk-scan-msg"></div>
    </div>
    <div id="pick-items-body">${pickBodyHtml()}</div>`;
}
function pickModalFooter() {
  const ctx = APP._pickCtx; if (!ctx) return '';
  return `${ctx.canAmend ? `<button class="btn btn-warning" ${dataActClose('amendOrderModal', ctx.orderId)} style="margin-right:auto" title="Change items — resends the order for approval">✏️ Amend items</button>` : ''}
    <span class="pk-foot-hint">You can pick less than remaining — a short pick is recorded.</span>
    <button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
    <button class="btn btn-primary" ${dataAct('pickReview', ctx.orderId)}>Review &amp; confirm →</button>`;
}

// Status chip for a line given picked (v) vs. remaining (rem).
function pickChip(v, rem) {
  if (v > rem)  return '<span class="pk-chip over">▲ Over</span>';
  if (v >= rem) return '<span class="pk-chip done">✓ Complete</span>';
  if (v > 0)    return '<span class="pk-chip short">Short</span>';
  return '<span class="pk-chip pending">Not picked</span>';
}
// One horizontal row per line (reference design): identity (✓/○ + name + SKU·Unit
// + Ordered/Picked chips) · PICK NOW stepper (Max N · Pick all) · PICK FROM BIN
// (+ suggested) · Still to pick + status chip. Pick-now starts at 0 and counts
// down "Still to pick". Emits .pick-qty + .pick-bin exactly as before, so
// confirmPick is unchanged.
function pickBodyHtml() {
  const ctx = APP._pickCtx; if (!ctx) return '';
  const { lines, bins } = ctx;
  const vals = ctx.vals || lines.map(() => 0);
  const over = pickCanOverpick();
  // Suggested bin: a bin-location that stocks this SKU, else the last-used bin.
  const suggest = (sku) => { const b = (bins || []).find(x => (x.sku || '') === sku); return b ? b.code : (ctx.lastBin || ''); };
  const binSelHtml = (sku) => {
    const cur = (ctx.binSel || {})[sku] || '';
    const opts = (bins || []).map(b => `<option value="${b.code}"${b.code === cur ? ' selected' : ''}>${b.code}${b.zone ? ' — ' + b.zone : ''}</option>`).join('');
    return `<select class="form-control form-control-sm pick-bin" data-sku="${sku}" ${dataChangeEl('pickBinChange')}><option value="">— select bin —</option>${opts}</select>`;
  };
  return `<div class="pk-list">${lines.map((l, i) => {
    const rem = l.due, already = l.delivered || 0, v = vals[i];
    const done = v >= rem, sug = suggest(l.sku), unit = (l.unit || l.uom || '');
    const still = v > rem ? '+' + (v - rem) : Math.max(0, rem - v);
    return `<div class="pk-card2${done ? ' is-complete' : (v > 0 ? ' is-short' : '')}${v > rem ? ' is-over' : ''}" data-i="${i}" data-search="${h((l.name + ' ' + (l.sku || '')).toLowerCase())}">
      <div class="pk-id">
        <span class="pk-mark">${done ? '✓' : '○'}</span>
        <div class="pk-idmain">
          <div class="pk-name">${h(l.name)}</div>
          <div class="pk-sku">SKU: ${h(l.sku) || '—'}${unit ? ' · Unit: ' + h(unit) : ''}</div>
          <div class="pk-idchips"><span class="pk-ic">Ordered ${l.ordered}</span><span class="pk-ic picked">Picked ${already}</span></div>
        </div>
      </div>
      <div class="pk-zpick">
        <div class="pk-zlabel">Pick now</div>
        <div class="pk-step">
          <button type="button" class="pk-pm" ${dataAct('pickDec', i)} aria-label="Decrease"${v <= 0 ? ' disabled' : ''}>−</button>
          <input type="number" inputmode="numeric" class="pick-qty pk-qbox" data-sku="${l.sku}" data-name="${l.name}" data-ordered="${rem}" data-already="${already}" data-selectall value="${v}" min="0"${over ? '' : ` max="${rem}"`} aria-label="Pick now for ${h(l.name)}" ${dataInputEl('onPickQty')} data-keydown="pickKeyNav">
          <button type="button" class="pk-pm" ${dataAct('pickInc', i)} aria-label="Increase"${(!over && v >= rem) ? ' disabled' : ''}>+</button>
        </div>
        <div class="pk-zhelp">Max <b>${rem}</b>${unit ? ' ' + h(unit).toLowerCase() + '(s)' : ''} · <button type="button" class="pk-all" ${dataAct('pickAll', i)}>Pick all ${rem}</button></div>
      </div>
      <div class="pk-zbin">
        <div class="pk-zlabel">Pick from bin</div>
        ${binSelHtml(l.sku)}
        <div class="pk-zhelp">${sug ? 'Suggested: ' + h(sug) : 'Confirm bin before saving'}</div>
      </div>
      <div class="pk-still">
        <div class="pk-still-l">Still to pick</div>
        <div class="pk-still-n">${still}</div>
        <span class="pk-chipwrap">${pickChip(v, rem)}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// Live name/SKU search + bin filter (combined) — hide cards that don't match.
function pickApplyFilters() {
  const q = ((document.getElementById('pick-search') || {}).value || '').trim().toLowerCase();
  const bin = (document.getElementById('pick-binfilter') || {}).value || '';
  document.querySelectorAll('.pk-card2').forEach(c => {
    const okq = !q || (c.getAttribute('data-search') || '').indexOf(q) >= 0;
    const sel = c.querySelector('.pick-bin');
    const okb = !bin || (sel && sel.value === bin);
    c.style.display = (okq && okb) ? '' : 'none';
  });
}
function pickSearch() { pickApplyFilters(); }
function pickBinFilter() { pickApplyFilters(); }
// Keyboard flow: move focus to the next/previous visible line's qty field.
function pickGo(i, dir) {
  const inputs = Array.prototype.slice.call(document.querySelectorAll('.pk-card2 .pick-qty'))
    .filter(inp => { const c = inp.closest('.pk-card2'); return c && c.style.display !== 'none'; });
  const cur = inputs.findIndex(inp => { const c = inp.closest('.pk-card2'); return c && c.getAttribute('data-i') === String(i); });
  const nx = inputs[cur + dir];
  if (nx) { nx.focus(); if (nx.select) nx.select(); const nc = nx.closest('.pk-card2'); if (nc) nc.scrollIntoView({ block: 'nearest' }); }
  else if (dir > 0 && inputs[cur]) inputs[cur].blur();   // past the last item → done
}
// Enter / ↓ → next item, ↑ → previous, + / − → step this line by one.
function pickKeyNav(e) {
  const el = e.target; if (!el || !el.classList || !el.classList.contains('pick-qty')) return;
  const card = el.closest('.pk-card2'); if (!card) return;
  const i = parseInt(card.dataset.i);
  if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); pickGo(i, 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pickGo(i, -1); }
  else if (e.key === '+') { e.preventDefault(); pickStepQty(i, 1); }
  else if (e.key === '-') { e.preventDefault(); pickStepQty(i, -1); }
}
// Remember the last bin chosen so the next line can suggest it.
function pickBinChange(sel) {
  const ctx = APP._pickCtx; if (!ctx || !sel) return;
  if (sel.value) { ctx.binSel[sel.dataset.sku] = sel.value; ctx.lastBin = sel.value; }
  else delete ctx.binSel[sel.dataset.sku];
  const card = sel.closest('.pk-card2');
  if (card) { const inp = card.querySelector('.pick-qty'); const v = inp ? (parseInt(inp.value) || 0) : 0; sel.classList.toggle('need', v > 0 && !sel.value); }
  pickApplyFilters();
}
// Completion summary before submission: reconcile picked vs. remaining, call out
// short/over-pick lines and any picked line left without a bin, then swap the
// footer to a final Submit. Back returns to the (preserved) picking list.
function pickReview(orderId) {
  const ctx = APP._pickCtx; if (!ctx) return;
  ctx.vals = Array.prototype.slice.call(document.querySelectorAll('.pick-qty')).map(i => parseInt(i.value) || 0);
  const bySku = {}, binBySku = {};
  document.querySelectorAll('.pick-qty').forEach(i => { bySku[i.dataset.sku] = parseInt(i.value) || 0; });
  document.querySelectorAll('.pick-bin').forEach(s => { binBySku[s.dataset.sku] = s.value || ''; });
  // Snapshot the entered picks + bins onto the context so confirmPick can submit
  // them even though the review screen has replaced the .pick-qty / .pick-bin DOM.
  ctx.bySku = bySku; ctx.binBySku = binBySku;
  let complete = 0, picked = 0, toPick = 0, noBin = 0; const shorts = [], over = [];
  ctx.lines.forEach(l => {
    const rem = l.due, v = bySku[l.sku] || 0; toPick += rem; picked += v;
    if (v >= rem) complete++; if (v < rem) shorts.push({ name: l.name, rem, v });
    if (v > rem) over.push({ name: l.name, rem, v });
    if (v > 0 && !binBySku[l.sku]) noBin++;
  });
  const body = `<div class="pk-review">
    <div class="pk-tiles">
      <div class="pk-tile"><b>${complete} / ${ctx.lines.length}</b><span>Items complete</span></div>
      <div class="pk-tile"><b>${picked} / ${toPick}</b><span>Units picked</span></div>
      <div class="pk-tile"><b>${Math.max(0, toPick - picked)}</b><span>Units short</span></div>
    </div>
    ${shorts.length ? `<div class="pk-rev-sec pk-rev-warn"><b>⚠ ${shorts.length} line${shorts.length > 1 ? 's' : ''} picked short</b><ul>${shorts.map(s => `<li>${h(s.name)} — picked ${s.v} of ${s.rem}</li>`).join('')}</ul></div>` : `<div class="pk-rev-ok">✓ Every line picked in full.</div>`}
    ${over.length ? `<div class="pk-rev-sec pk-rev-bad"><b>▲ Over-pick on ${over.length} line${over.length > 1 ? 's' : ''}</b><ul>${over.map(s => `<li>${h(s.name)} — ${s.v} vs ${s.rem} remaining</li>`).join('')}</ul></div>` : ''}
    ${noBin ? `<div class="pk-rev-sec pk-rev-warn">${noBin} picked line${noBin > 1 ? 's' : ''} without a storage bin selected.</div>` : ''}
  </div>`;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML =
    `<button class="btn btn-secondary" ${dataAct('pickBackToList')}>← Back to picking</button>
     <button class="btn btn-primary" ${dataAct('confirmPick', orderId)}>Submit pick</button>`;
}
function pickBackToList() {
  const ctx = APP._pickCtx; if (!ctx) return;
  document.getElementById('modal-body').innerHTML = pickModalInner();
  document.getElementById('modal-footer').innerHTML = pickModalFooter();
  updatePickSummary(); pickApplyFilters();
}

// Qty-input handler: clamp over-pick to the remaining qty (unless authorised),
// refresh the row's Still-to-pick number, status chip, ✓/○ mark and stepper
// enabled-state, then update the tiles + progress. An empty field reads as 0
// without being overwritten, so the number stays clearable while typing.
function onPickQty(el) {
  const rem = parseInt(el.dataset.ordered) || 0;
  let v = parseInt(el.value);
  if (!isNaN(v) && !pickCanOverpick() && v > rem) { v = rem; el.value = v; }   // cap at remaining
  if (isNaN(v) || v < 0) v = 0;
  const card = el.closest('.pk-card2');
  if (card) {
    const sn = card.querySelector('.pk-still-n'); if (sn) sn.textContent = (v > rem ? '+' + (v - rem) : Math.max(0, rem - v));
    const cw = card.querySelector('.pk-chipwrap'); if (cw) cw.innerHTML = pickChip(v, rem);
    const mk = card.querySelector('.pk-mark'); if (mk) mk.textContent = (v >= rem ? '✓' : '○');
    card.classList.toggle('is-complete', v >= rem);
    card.classList.toggle('is-short', v > 0 && v < rem);
    card.classList.toggle('is-over', v > rem);
    const dec = card.querySelector('.pk-pm[aria-label="Decrease"]'); if (dec) dec.disabled = v <= 0;
    const inc = card.querySelector('.pk-pm[aria-label="Increase"]'); if (inc) inc.disabled = !pickCanOverpick() && v >= rem;
    const binsel = card.querySelector('.pick-bin'); if (binsel) binsel.classList.toggle('need', v > 0 && !binsel.value);
  }
  updatePickSummary();
}
// Stepper controls for the Pick Items cards — big −/+ and a one-tap "Pick all"
// that drive the i-th .pick-qty field (so the tally + confirm logic are unchanged).
function pickStepQty(i, delta) {
  const inp = document.querySelectorAll('.pick-qty')[i]; if (!inp) return;
  inp.value = Math.max(0, (parseInt(inp.value) || 0) + delta);
  onPickQty(inp);
}
function pickInc(i) { pickStepQty(i, 1); }
function pickDec(i) { pickStepQty(i, -1); }
function pickAll(i) { const inp = document.querySelectorAll('.pick-qty')[i]; if (!inp) return; inp.value = parseInt(inp.dataset.ordered) || 0; onPickQty(inp); }
// Scan-to-fill: a scanned/typed SKU fills that line to its due qty, flashes the row
// and plays a confirming tick; an unknown code plays an error beep (and buzzes on
// mobile). Works in both the card and table layouts (both expose .pick-qty[data-sku]).
// Core: resolve a scanned/typed code against the lines and apply it per the current
// scan mode. Shared by the keyboard field and the camera. Returns {ok, label}.
function pickApplyCode(code) {
  code = (code || '').trim();
  if (!code) return { ok: false, label: '' };
  var inputs = Array.prototype.slice.call(document.querySelectorAll('.pick-qty'));
  var lc = code.toLowerCase();
  var hit = inputs.find(function (i) { return (i.dataset.sku || '').toLowerCase() === lc; });
  // tolerate a scanner that wraps the SKU in a longer barcode payload
  if (!hit) hit = inputs.find(function (i) { var s = (i.dataset.sku || '').toLowerCase(); return s && lc.indexOf(s) >= 0; });
  if (!hit) {
    pickBeep(false);
    if (navigator.vibrate) { try { navigator.vibrate(140); } catch (e) {} }
    return { ok: false, label: code };
  }
  var mode = APP._pickScanMode || 'fill';
  var due = parseInt(hit.dataset.ordered) || 0;
  var cur = parseInt(hit.value) || 0;
  var label = hit.dataset.name || hit.dataset.sku;
  var text;
  if (mode === 'count') {
    if (cur >= due) { pickBeep('full'); return { ok: true, label: label + ' already at ' + due }; }
    hit.value = cur + 1; onPickQty(hit); pickBeep(true);
    text = label + ' — ' + (cur + 1) + '/' + due;
  } else {
    hit.value = due; onPickQty(hit); pickBeep(true);
    text = label + ' — filled ' + due;
  }
  var row = hit.closest('.pk-card2') || hit.closest('.pk-card') || hit.closest('tr');
  if (row) { row.classList.remove('pk-flash'); void row.offsetWidth; row.classList.add('pk-flash'); row.scrollIntoView({ block: 'nearest' }); }
  return { ok: true, label: text };
}
function pickScan() {
  var el = document.getElementById('pick-scan'); if (!el) return;
  var code = (el.value || '').trim(); el.value = '';
  var msg = document.getElementById('pick-scan-msg');
  if (!code) { el.focus(); return; }
  var res = pickApplyCode(code);
  if (msg) { msg.textContent = res.ok ? ('✓ ' + res.label) : ('✕ Not on this order: ' + code); msg.style.color = res.ok ? 'var(--success)' : 'var(--danger)'; }
  el.focus();
}

// ── Camera scanning (iOS / Android / desktop) ────────────────────────────────
// Decodes with html5-qrcode (pure JS, bundles ZXing — no WASM, CSP-safe), loaded
// from jsDelivr on first use. Each decode is routed through pickApplyCode, so the
// Fill/Count mode and short/over tally behave exactly as the keyboard scan.
function pickEnsureScanner(cb) {
  if (window.Html5Qrcode) return cb();
  var btn = document.getElementById('pick-cam-btn'); if (btn) btn.textContent = '📷 Loading…';
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
  s.onload = function () { if (btn) btn.textContent = '📷 Camera'; cb(); };
  s.onerror = function () { if (btn) btn.textContent = '📷 Camera'; showToast('Could not load the camera scanner', 'error'); };
  document.head.appendChild(s);
}
function pickCameraOpen() {
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { showToast('Camera is not available on this device', 'error'); return; }
  if (APP._pickCam) return;
  pickEnsureScanner(pickCameraStart);
}
function pickCameraStart() {
  if (!window.Html5Qrcode) { showToast('Camera scanner is still loading — try again', 'error'); return; }
  var ov = document.createElement('div'); ov.className = 'pk-cam'; ov.id = 'pk-cam';
  ov.innerHTML =
    '<div class="pk-cam-card">' +
      '<div class="pk-cam-head"><span>Scan a barcode · ' + ((APP._pickScanMode || 'fill') === 'count' ? 'Count +1' : 'Fill') + '</span>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="pk-cam-done">Done</button></div>' +
      '<div id="pk-cam-reader" class="pk-cam-reader"></div>' +
      '<div class="pk-cam-msg" id="pk-cam-msg">Point the camera at a product barcode…</div>' +
    '</div>';
  document.body.appendChild(ov);
  document.getElementById('pk-cam-done').addEventListener('click', pickCameraClose);
  var fmts; try { var F = window.Html5QrcodeSupportedFormats; if (F) fmts = [F.QR_CODE, F.CODE_128, F.CODE_39, F.CODE_93, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.CODABAR]; } catch (e) {}
  var reader;
  try { reader = new Html5Qrcode('pk-cam-reader', fmts ? { formatsToSupport: fmts, verbose: false } : { verbose: false }); }
  catch (e) { reader = new Html5Qrcode('pk-cam-reader'); }
  APP._pickCam = { reader: reader, ov: ov, last: '', lastAt: 0 };
  reader.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 270, height: 170 } },
    function (text) {
      var c = APP._pickCam; if (!c) return;
      var now = Date.now();
      if (text === c.last && now - c.lastAt < 1300) return;   // debounce repeat reads of the same code
      c.last = text; c.lastAt = now;
      var res = pickApplyCode(text);
      var m = document.getElementById('pk-cam-msg');
      if (m) { m.textContent = res.ok ? ('✓ ' + res.label) : ('✕ Not on this order: ' + text); m.style.color = res.ok ? 'var(--success)' : 'var(--danger)'; }
    },
    function () { /* per-frame "no code" — ignore */ }
  ).catch(function () {
    var m = document.getElementById('pk-cam-msg');
    if (m) { m.textContent = 'Could not start the camera — allow camera access for this site and try again.'; m.style.color = 'var(--danger)'; }
  });
}
function pickCameraClose() {
  var c = APP._pickCam; if (!c) return;
  var done = function () { if (c.ov && c.ov.parentNode) c.ov.parentNode.removeChild(c.ov); APP._pickCam = null; var el = document.getElementById('pick-scan'); if (el) el.focus(); };
  try { var p = c.reader && c.reader.stop(); if (p && p.then) p.then(done).catch(done); else done(); } catch (e) { done(); }
}
// Switch the scan behaviour. Count builds each line from zero (scan every unit);
// Fill starts from the due qty (scan to confirm a full pick) — so the starting
// quantities are reset to match the chosen mode.
function pickSetScanMode(m) {
  APP._pickScanMode = m;
  document.querySelectorAll('[data-scanmode]').forEach(function (b) {
    var on = b.getAttribute('data-scanmode') === m;
    b.classList.toggle('btn-primary', on); b.classList.toggle('btn-secondary', !on);
  });
  var el = document.getElementById('pick-scan');
  if (el) el.placeholder = m === 'count' ? 'Scan each unit — counts up to the due qty' : 'Scan or type a SKU — fills the line to its due qty';
  if (m === 'count') { pickClearAll(); showToast('Counting from zero — scan each unit', 'info'); }
  else { pickFillDue(); }
  if (el) el.focus();
}
// Short WebAudio tones — a high tick on a match, a low double-buzz on an unknown
// code. Lazily created on the first scan (a keypress is a valid user gesture).
function pickBeep(ok) {
  try {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    APP._pickAudio = APP._pickAudio || new AC();
    var ctx = APP._pickAudio; if (ctx.state === 'suspended') ctx.resume();
    var now = ctx.currentTime;
    var tone = function (freq, start, dur) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, now + start);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.start(now + start); o.stop(now + start + dur + 0.02);
    };
    if (ok === true) tone(880, 0, 0.12);
    else if (ok === 'full') tone(660, 0, 0.1);
    else { tone(200, 0, 0.22); tone(160, 0.18, 0.28); }
  } catch (e) { /* audio unavailable — stay silent */ }
}
// Bulk helpers (used by the Fill/Count scan-mode toggle) — reset every qty and
// route each through onPickQty so badges / complete-state / tiles stay in sync.
function pickClearAll() { document.querySelectorAll('.pick-qty').forEach(inp => { inp.value = 0; onPickQty(inp); }); }
function pickFillDue() { document.querySelectorAll('.pick-qty').forEach(inp => { inp.value = inp.dataset.ordered || 0; onPickQty(inp); }); }

// Recompute the summary tiles (items completed, units picked / to pick, remaining)
// from the live qty inputs.
function updatePickSummary() {
  const ctx = APP._pickCtx;
  const inputs = document.querySelectorAll('.pick-qty');
  if (!inputs.length || !ctx) return;
  let complete = 0, picked = 0;
  inputs.forEach(inp => {
    const v = parseInt(inp.value) || 0;
    const rem = parseInt(inp.dataset.ordered) || 0;
    picked += v;
    if (v >= rem) complete++;
  });
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  set('pk-t-products', ctx.lines.length);
  set('pk-t-complete', complete + ' / ' + ctx.lines.length);
  set('pk-t-picked', picked + ' / ' + ctx.totalDue);
  set('pk-t-remaining', Math.max(0, ctx.totalDue - picked));
  const pct = ctx.totalDue ? Math.round(picked / ctx.totalDue * 100) : 0;
  const bar = document.getElementById('pk-prog-bar'); if (bar) bar.style.width = pct + '%';
  set('pk-prog-txt', complete + ' of ' + ctx.lines.length + ' items done');
}

async function confirmPick(orderId) {
  // Submit is clicked from the review screen, where the .pick-qty / .pick-bin inputs
  // no longer exist — so read the picks from the snapshot pickReview stored on the
  // context (falling back to the live inputs if confirm is somehow called from the
  // list). Send EVERY line with its actual picked qty (blank → 0), so a short/zero
  // pick is recorded against that line instead of defaulting to the full ordered qty.
  const ctx = APP._pickCtx;
  let items, hasPartial;
  if (ctx && ctx.bySku) {
    const bySku = ctx.bySku, binBySku = ctx.binBySku || {};
    items = ctx.lines.map(l => ({
      sku: l.sku, name: l.name,
      qty: parseInt(bySku[l.sku]) || 0,
      bin_code: binBySku[l.sku] || (ctx.binSel || {})[l.sku] || '',
    }));
    hasPartial = ctx.lines.some(l => (parseInt(bySku[l.sku]) || 0) < (parseInt(l.due) || 0));
  } else {
    const qtyInputs = document.querySelectorAll('.pick-qty');
    items = Array.from(qtyInputs).map(inp => {
      const binSel = document.querySelector(`.pick-bin[data-sku="${inp.dataset.sku}"]`);
      const qty = parseInt(inp.value) || 0;
      return { sku: inp.dataset.sku, name: inp.dataset.name, qty, bin_code: binSel?.value || '' };
    });
    hasPartial = Array.from(qtyInputs).some(inp => (parseInt(inp.value) || 0) < +inp.dataset.ordered);
  }
  if (!items.some(i => i.qty > 0)) { showToast('Enter a quantity for at least one item', 'error'); return; }
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
          </tr>`).join('')||'<tr><td colspan="6" class="u-empty">No bins</td></tr>'}
          </tbody>
        </table>
      </div>`,
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  });
}

function addWarehouseModal() {
  openModal('Add Warehouse',
    `<div class="form-group"><label>Warehouse Name</label><input type="text" id="wh-name" placeholder="e.g. Mumbai Central Warehouse"></div>
     <div class="form-group"><label>City</label><input type="text" id="wh-city"></div>
     <div class="form-group"><label>Address</label><textarea id="wh-addr" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px"></textarea></div>
     <div class="form-group"><label>Capacity (units)</label><input type="number" id="wh-cap" value="1000" min="1"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveWarehouse')}>Add Warehouse</button>`);
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
    `<div class="form-group"><label>Warehouse Name</label><input type="text" id="ewh-name" value="${h(name)}"></div>
     <div class="form-group"><label>Capacity (units)</label><input type="number" id="ewh-cap" value="${capacity}" min="1"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveWarehouseEdit', id)}>Save Changes</button>`);
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
// Line count (distinct SKUs on the challan = item_count) + item count (total
// units = total_qty), rendered as a single "N lines · M items" string. Shared by
// the scheduled / transit cards and the delivered table so the counts read the
// same everywhere. Falls back gracefully when a figure is missing.
function dcCountsHtml(dc) {
  const lines = dc.item_count != null ? Number(dc.item_count) : null;
  const units = dc.total_qty != null ? Number(dc.total_qty) : null;
  const parts = [];
  if (lines != null) parts.push(`<span style="font-weight:600;color:var(--text)">${lines}</span> line${lines !== 1 ? 's' : ''}`);
  if (units != null) parts.push(`<span style="font-weight:600;color:var(--text)">${units}</span> item${units !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(' · ') : 'Qty unknown';
}

async function renderDelivery(el) {
  const dcs = await api('/delivery-challans');
  if (!dcs) { el.innerHTML = `${pageHeader('Deliveries','Delivery challans, dispatch, POD & returns')}<div class="card" style="padding:32px;text-align:center;color:var(--danger)">Failed to load delivery challans.</div>`; return; }

  const today = new Date();
  const scheduled = dcs.filter(d => d.status === 'SCHEDULED');
  const transit   = dcs.filter(d => d.status === 'IN_TRANSIT');
  const delivered = dcs.filter(d => d.status === 'DELIVERED');
  const returnPending = dcs.filter(d => d.status === 'RETURN_PENDING');
  const returns   = dcs.filter(d => d.status === 'CANCELLED');
  const overdue   = transit.filter(d => d.expected_delivery_date && new Date(d.expected_delivery_date) < today);
  const pendingPOD  = delivered.filter(d => !d.pod_uploaded).length;
  const pendingBill = delivered.filter(d => !d.billed).length;
  const pendingApproval = dcs.filter(d => d.delivery_approval === 'PENDING').length;

  const kpis = `
  <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:22px">
    ${[
      {label:'Scheduled',value:scheduled.length,sub:'ready to dispatch',accent:scheduled.length?'var(--primary)':'var(--success)'},
      {label:'In Transit',value:transit.length,sub:overdue.length?`${overdue.length} overdue`:'all on time',accent:overdue.length?'var(--danger)':transit.length?'var(--warning)':'var(--success)'},
      {label:'Pending Approval',value:pendingApproval,sub:'short/excess, awaiting review',accent:pendingApproval?'var(--danger)':'var(--success)'},
      {label:'Returns to approve',value:returnPending.length,sub:'awaiting warehouse check',accent:returnPending.length?'var(--danger)':'var(--success)'},
      {label:'Pending POD/Scan',value:pendingPOD,sub:'delivered, docs missing',accent:pendingPOD?'var(--warning)':'var(--success)'},
      {label:'Unbilled',value:pendingBill,sub:'delivered but not billed',accent:pendingBill?'var(--danger)':'var(--success)'},
    ].map(tileHtml).join('')}
  </div>`;

  APP._dcData = dcs;
  APP._dcTab  = APP._dcTab || 'scheduled';

  function tabsHtml(active) {
    const podPending = delivered.filter(d => !d.pod_uploaded || !d.dc_scan_uploaded).length;
    return ['scheduled','transit','delivered','returns','pod','all'].map((t,i)=>{
      const labels = ['Scheduled','In Transit','Delivered','Returns','POD & Scans','All'];
      const counts = [scheduled.length, transit.length, delivered.length, returns.length + returnPending.length, delivered.length, dcs.length];
      const badge  = t === 'pod' && podPending ? `<span style="background:var(--warning);color:#fff;font-size:.65rem;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:4px">${podPending}</span>` : `<span style="font-size:.72rem;opacity:.7">(${counts[i]})</span>`;
      return `<button class="tab-btn${active===t?' active':''}" ${dataActEl('switchDeliveryTab', t)}>${labels[i]} ${badge}</button>`;
    }).join('');
  }

  function dcCardScheduled(dc) {
    const canDispatch = APP.user?.role !== 'delivery_exec';
    return `
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-weight:700;font-size:.95rem">DC ${dc.dc_number||dc.id}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">${dc.client_name||'Unknown Client'}</div>
      </div>
      <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-size:.82rem;color:var(--text-muted)">
          ${dcCountsHtml(dc)}
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>View Items</button>
          ${APP.user?.role === 'super_admin' ? `<button class="btn btn-secondary btn-sm" ${dataAct('cancelDCModal', dc.id, dc.dc_number||dc.id)} title="Void this challan (created in error). It moves to Cancelled — the number stays in the register.">Cancel</button>` : ''}
          ${canDispatch ? `<button class="btn btn-primary btn-sm" ${dataAct('dispatchDCModal', dc.id)}>Dispatch →</button>` : ''}
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
            <span style="font-weight:700;font-size:.95rem">DC ${dc.dc_number||dc.id}</span>
            ${isOverdue ? '<span class="badge badge-danger" style="margin-left:6px">Overdue</span>' : ''}
          </div>
          <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
        </div>
        <div style="font-size:.82rem;font-weight:600;margin-bottom:2px">${dc.client_name||'Unknown Client'}</div>
        <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">${dcCountsHtml(dc)}</div>
        ${dc.driver_name ? `<div style="font-size:.78rem;color:var(--text-muted)">🚚 ${dc.vehicle_no||'—'} · ${dc.driver_name}</div>` : ''}
      </div>
      <div style="padding:0 16px 10px">${typeof _dcDestination==='function'?_dcDestination(dc):''}</div>
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
        <div style="display:flex;gap:6px">${dcTransitActions(dc)}</div>
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
        <td><b>${dc.dc_number||dc.id}</b></td>
        <td>${dc.order_id}</td>
        <td>${dc.client_name||'—'}</td>
        <td style="text-align:center">${dc.item_count != null ? dc.item_count : '—'}</td>
        <td style="color:var(--success);font-weight:600;text-align:center">${dc.delivered_qty||dc.total_qty||'—'}</td>
        <td>${dc.driver_name||'—'}</td>
        <td>${fmtDate(dc.delivered_at)}</td>
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markPOD', dc.id)}>Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markScan', dc.id)}>Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" ${dataAct('billDC', dc.id)}>Bill</button>`}</td>
      </tr>`).join('');
      const tbl = (list) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th style="text-align:center">Lines</th><th style="text-align:center">Items</th><th>Driver</th><th>Delivered At</th><th>POD</th><th>Scan</th><th>Billed</th></tr></thead><tbody>${rows(list)}</tbody></table></div></div>`;
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
      <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
        ${tileHtml({label:'Total Delivered',value:delivered.length,accent:'var(--primary)'})}
        ${tileHtml({label:'POD Uploaded',value:`${podDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span>`,accent:podDone===delivered.length?'var(--success)':'var(--warning)'})}
        ${tileHtml({label:'DC Scanned',value:`${scanDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span>`,accent:scanDone===delivered.length?'var(--success)':'var(--warning)'})}
        ${tileHtml({label:'Pending Action',value:delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length,accent:delivered.length-Math.max(podDone,scanDone)===0?'var(--success)':'var(--danger)'})}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="position:relative;flex:1;max-width:400px">
          <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" id="pod-search-input" placeholder="Search DC #, order, client, driver…" ${dataInputVal('filterPODTable')}
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
      if (!returns.length && !returnPending.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;
      const retRow = (dc, status) => `<tr><td><b>${dc.dc_number||dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td><td>${status}</td></tr>`;
      const tbl = (list, status) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th><th>Status</th></tr></thead><tbody>${list.map(dc=>retRow(dc, status)).join('')}</tbody></table></div></div>`;
      let html = '';
      if (returnPending.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:8px">Awaiting approval (${returnPending.length})${canReviewReturns()?' — approve from the queue above':''}</div>${tbl(returnPending, '<span class="badge badge-warning">Return pending</span>')}<div style="margin-bottom:16px"></div>`;
      if (returns.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">Returned (${returns.length})</div>${tbl(returns, '<span class="badge badge-secondary">Returned</span>')}`;
      return html;
    }
    // all
    return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      ${['','SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s=>`
        <button class="btn btn-secondary btn-sm" ${dataAct('filterDCTable', s)}>${s||'All'}</button>
      `).join('')}
    </div>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Total Qty</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Delivered At</th><th>Billed</th></tr></thead>
      <tbody id="dc-all-tbody">${dcs.map(dc=>{
        const od = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today && dc.status !== 'DELIVERED';
        return `<tr data-status="${dc.status}" style="${od?'background:#fff8e6':''}">
          <td><b>${dc.dc_number||dc.id}</b>${od?'<span class="badge badge-danger" style="margin-left:4px;font-size:.65rem">OD</span>':''}</td>
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
  <div id="dc-returns-queue"></div>
  ${kpis}
  <div class="tabs" id="dc-tabs" style="margin-bottom:16px">${tabsHtml(APP._dcTab)}</div>
  <div id="dc-tab-content">${tabContent(APP._dcTab)}</div>`;
  // Surface the returns-approval queue here too (for reviewers), so a RETURN_PENDING
  // challan can be approved from the Deliveries page, not only the Warehouse page.
  loadReturnsApprovalQueue('dc-returns-queue');
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
    const returnPending = dcs.filter(d => d.status === 'RETURN_PENDING');
    const returns   = dcs.filter(d => d.status === 'CANCELLED');

    const content = document.getElementById('dc-tab-content');
    if (!content) return;

    if (tab === 'scheduled') {
      function dcSched(dc) {
        return `
        <div class="card" style="padding:0;overflow:hidden">
          <div style="padding:14px 16px 10px;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
              <span style="font-weight:700;font-size:.95rem">DC ${dc.dc_number||dc.id}</span>
              <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
            </div>
            <div style="font-size:.82rem;color:var(--text-muted)">${dc.client_name||'Unknown Client'}</div>
          </div>
          <div style="padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div style="font-size:.82rem;color:var(--text-muted)">
              ${dcCountsHtml(dc)}
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>View Items</button>
              ${APP.user?.role === 'super_admin' ? `<button class="btn btn-secondary btn-sm" ${dataAct('cancelDCModal', dc.id, dc.dc_number||dc.id)} title="Void this challan (created in error). It moves to Cancelled — the number stays in the register.">Cancel</button>` : ''}
              <button class="btn btn-primary btn-sm" ${dataAct('dispatchDCModal', dc.id)}>Dispatch →</button>
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
              <div><span style="font-weight:700;font-size:.95rem">DC ${dc.dc_number||dc.id}</span>
                ${isOverdue?'<span class="badge badge-danger" style="margin-left:6px">Overdue</span>':''}</div>
              <span style="font-size:.75rem;color:var(--text-muted)">Order ${dc.order_id}</span>
            </div>
            <div style="font-size:.82rem;font-weight:600;margin-bottom:2px">${dc.client_name||'Unknown Client'}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">${dcCountsHtml(dc)}</div>
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
            <div style="display:flex;gap:6px">${dcTransitActions(dc)}</div>
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
        <td><b>${dc.dc_number||dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td>
        <td style="text-align:center">${dc.item_count != null ? dc.item_count : '—'}</td>
        <td style="color:var(--success);font-weight:600;text-align:center">${dc.delivered_qty||dc.total_qty||'—'}</td>
        <td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.delivered_at)}</td>
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markPOD', dc.id)}>Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markScan', dc.id)}>Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" ${dataAct('billDC', dc.id)}>Bill</button>`}</td>
      </tr>`).join('');
      const tbl = (list) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th style="text-align:center">Lines</th><th style="text-align:center">Items</th><th>Driver</th><th>Delivered At</th><th>POD</th><th>Scan</th><th>Billed</th></tr></thead><tbody>${rows(list)}</tbody></table></div></div>`;
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
        <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
          ${tileHtml({label:'Total Delivered',value:delivered.length,accent:'var(--primary)'})}
          ${tileHtml({label:'POD Uploaded',value:`${podDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span>`,accent:podDone===delivered.length?'var(--success)':'var(--warning)'})}
          ${tileHtml({label:'DC Scanned',value:`${scanDone} <span style="font-size:.9rem;color:var(--text-muted)">/ ${delivered.length}</span>`,accent:scanDone===delivered.length?'var(--success)':'var(--warning)'})}
          ${tileHtml({label:'Pending Action',value:delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length,accent:delivered.filter(d=>!d.pod_uploaded||!d.dc_scan_uploaded).length===0?'var(--success)':'var(--danger)'})}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="position:relative;flex:1;max-width:400px">
            <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="pod-search-input" placeholder="Search DC #, order, client, driver…" ${dataInputVal('filterPODTable')}
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
      if (!returns.length && !returnPending.length) {
        content.innerHTML = `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;
      } else {
        const retRow = (dc, status) => `<tr><td><b>${dc.dc_number||dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td><td>${status}</td></tr>`;
        const tbl = (list, status) => `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th><th>Status</th></tr></thead><tbody>${list.map(dc=>retRow(dc, status)).join('')}</tbody></table></div></div>`;
        let html = '';
        if (returnPending.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warning);font-weight:600;margin-bottom:8px">Awaiting approval (${returnPending.length})${canReviewReturns()?' — approve from the queue above':''}</div>${tbl(returnPending, '<span class="badge badge-warning">Return pending</span>')}<div style="margin-bottom:16px"></div>`;
        if (returns.length) html += `<div style="font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px">Returned (${returns.length})</div>${tbl(returns, '<span class="badge badge-secondary">Returned</span>')}`;
        content.innerHTML = html;
      }

    } else if (tab === 'all') {
      content.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${['','SCHEDULED','IN_TRANSIT','DELIVERED','CANCELLED'].map(s=>`
          <button class="btn btn-secondary btn-sm" ${dataAct('filterDCTable', s)}>${s||'All'}</button>
        `).join('')}
      </div>
      <div class="card"><div class="table-wrap"><table class="table">
        <thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Status</th><th>Total Qty</th><th>Vehicle</th><th>Driver</th><th>Dispatched</th><th>Expected</th><th>Delivered At</th><th>Billed</th></tr></thead>
        <tbody id="dc-all-tbody">${dcs.map(dc=>{
          const od = dc.expected_delivery_date && new Date(dc.expected_delivery_date) < today && dc.status !== 'DELIVERED';
          return `<tr data-status="${dc.status}" style="${od?'background:#fff8e6':''}">
            <td><b>${dc.dc_number||dc.id}</b>${od?'<span class="badge badge-danger" style="margin-left:4px;font-size:.65rem">OD</span>':''}</td>
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
      Error loading data. <button class="btn btn-secondary btn-sm" ${dataAct('switchDeliveryTab', tab, null)}>Retry</button>
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
    ? `<span class="badge badge-success">✓ Uploaded</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" ${dataAct('markPOD', dc.id)}>Re-upload</button>`
    : scanOk
      ? `<span class="badge badge-success" style="background:var(--success-soft-bg);color:#065f46">✓ via Scan</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" ${dataAct('markPOD', dc.id)}>Re-upload</button>`
      : `<button class="btn btn-secondary btn-sm" ${dataAct('markPOD', dc.id)}>Upload POD</button>`;

  const scanCell = scanOk
    ? `<span class="badge badge-success">✓ Scanned</span> <button class="btn btn-secondary btn-sm" style="margin-left:4px" ${dataAct('markScan', dc.id)}>Re-scan</button>`
    : `<button class="btn btn-primary btn-sm" ${dataAct('markScan', dc.id)}>Scan POD</button>`;

  const statusCell = complete
    ? '<span class="badge badge-success">Complete</span>'
    : !podOk && !scanOk
      ? '<span class="badge" style="background:#fef9c3;color:var(--amber-text)">Both pending</span>'
      : '<span class="badge" style="background:#fef9c3;color:var(--amber-text)">Scan missing</span>';

  const docsCell = docCount > 0
    ? `<button class="btn btn-secondary btn-sm" ${dataAct('viewDCDocuments', dc.id)}>📂 ${docCount} page${docCount>1?'s':''}</button>`
    : '<span style="color:var(--text-muted);font-size:.8rem">—</span>';

  return `<tr data-search="${search}">
    <td><b>${dc.dc_number||dc.id}</b></td>
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
  const lineCount = items.length;
  const qtyDispatched = items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0);
  const qtyDelivered = items.reduce((s, i) => s + (Number(i.qty_delivered) || 0), 0);
  const qtyPending = qtyDispatched - qtyDelivered;
  const rows = items.length ? items.map(i => `<tr>
    <td>${i.sku}</td>
    <td><b>${h(i.name)}</b></td>
    <td>${i.qty_ordered}</td>
    <td style="color:${i.qty_delivered>0?'var(--success)':'var(--text-muted)'}">${i.qty_delivered||0}</td>
    <td style="color:${(i.qty_ordered-(i.qty_delivered||0))>0?'var(--danger)':'var(--success)'};font-weight:600">${i.qty_ordered-(i.qty_delivered||0)}</td>
  </tr>`).join('') : '<tr><td colspan="5" class="u-empty">No items</td></tr>';
  const foot = items.length ? `<tfoot><tr style="border-top:2px solid var(--border);font-weight:700">
      <td colspan="2">${lineCount} line${lineCount!==1?'s':''} · ${qtyDispatched} unit${qtyDispatched!==1?'s':''}</td>
      <td>${qtyDispatched}</td><td style="color:var(--success)">${qtyDelivered}</td>
      <td style="color:${qtyPending>0?'var(--danger)':'var(--success)'}">${qtyPending}</td>
    </tr></tfoot>` : '';
  openModal(`DC Items — ${dcId}`,
    `<p style="font-size:.82rem;color:var(--text-muted);margin-bottom:12px">
      "Dispatched" = qty in this DC (picked from warehouse). "Delivered" = confirmed at drop-off. "Pending" = yet to be confirmed delivered.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <span class="badge badge-secondary">${lineCount} line${lineCount!==1?'s':''}</span>
      <span class="badge badge-secondary">${qtyDispatched} unit${qtyDispatched!==1?'s':''} dispatched</span>
      <span class="badge badge-secondary">${qtyPending} pending</span>
    </div>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>SKU</th><th>Item</th><th>Dispatched</th><th>Delivered</th><th>Pending</th></tr></thead>
        <tbody>${rows}</tbody>
        ${foot}
      </table>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}

// Inline (in-order-modal) DC item breakdown — expands within the order window
// instead of opening a separate popup, so closing it never loses the order view.
async function toggleDCItemsInline(dcId, btn) {
  const box = document.getElementById('dcitems-' + dcId);
  if (!box) return;
  if (box.style.display !== 'none') { box.style.display = 'none'; if (btn) btn.textContent = 'View Items'; return; }
  if (!box.dataset.loaded) {
    box.style.display = '';
    box.innerHTML = `<div style="padding:8px 2px;color:var(--text-muted);font-size:.82rem">Loading items…</div>`;
    const items = await api('/delivery-challans/' + dcId + '/items');
    if (!items) { box.innerHTML = `<div style="padding:8px 2px;color:var(--danger);font-size:.82rem">Failed to load items.</div>`; return; }
    const rows = items.length ? items.map(i => `<tr>
        <td style="font-family:monospace;font-size:.78rem;color:var(--text-muted)">${h(i.sku)}</td>
        <td><b>${h(i.name)}</b></td>
        <td class="u-right">${i.qty_ordered}</td>
        <td style="text-align:right;color:${i.qty_delivered>0?'var(--success)':'var(--text-muted)'}">${i.qty_delivered||0}</td>
        <td style="text-align:right;color:${(i.qty_ordered-(i.qty_delivered||0))>0?'var(--danger)':'var(--success)'};font-weight:600">${i.qty_ordered-(i.qty_delivered||0)}</td>
      </tr>`).join('') : `<tr><td colspan="5" class="u-empty">No items</td></tr>`;
    const lc = items.length;
    const qd = items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0);
    const qdel = items.reduce((s, i) => s + (Number(i.qty_delivered) || 0), 0);
    const foot = items.length ? `<tfoot><tr style="border-top:2px solid var(--border);font-weight:700">
        <td colspan="2">${lc} line${lc!==1?'s':''} · ${qd} unit${qd!==1?'s':''}</td>
        <td class="u-right">${qd}</td><td class="u-right" style="color:var(--success)">${qdel}</td>
        <td class="u-right" style="color:${(qd-qdel)>0?'var(--danger)':'var(--success)'}">${qd-qdel}</td>
      </tr></tfoot>` : '';
    box.innerHTML = `<div class="table-wrap" style="margin-top:8px;border:1px solid var(--border);border-radius:8px">
      <table class="table" style="margin:0;font-size:.82rem">
        <thead><tr><th>SKU</th><th>Item</th><th class="u-right">Dispatched</th><th class="u-right">Delivered</th><th class="u-right">Pending</th></tr></thead>
        <tbody>${rows}</tbody>
        ${foot}
      </table></div>`;
    box.dataset.loaded = '1';
  }
  box.style.display = '';
  if (btn) btn.textContent = 'Hide Items';
}

async function dispatchDCModal(dcId) {
  // Single dispatch capture (gate-out): everything is entered once, here. The challan
  // number is system-owned, so it's shown read-only, never typed. Existing values are
  // pre-filled so re-opening never asks for the same detail twice.
  const [staff, dc] = await Promise.all([
    api('/staff').catch(()=>[]),
    api(`/delivery-challans/${dcId}`).catch(()=>null)
  ]);
  const staffOpts = (staff||[]).filter(s=>s.active && s.role==='delivery_staff')
    .map(s=>`<option value="${s.id}" ${dc&&dc.staff_id===s.id?'selected':''}>${h(s.name)}</option>`).join('');
  const dcNumber = (dc && (dc.dc_number||dc.id)) || dcId;
  const v = (x)=> x==null ? '' : String(x);
  // The DC number used in Zoho is set HERE, at dispatch. Back-office warehouse/ops roles may
  // type it; everyone else sees it read-only. (The delivery executive confirms delivery later
  // but never assigns the document number.)
  const DC_NUMBER_EDIT_ROLES = ['super_admin','ops_admin','ops_manager','warehouse_exec'];
  const canEditDcNum = APP.user && DC_NUMBER_EDIT_ROLES.includes(APP.user.role);
  const dcNumField = canEditDcNum
    ? `<div class="form-group"><label>DC Number <span style="color:var(--text-muted);font-weight:400">— the number used in Zoho</span></label>
         <input type="text" id="dp-dcnum" maxlength="40" placeholder="e.g. 425-10272" value="${h(v(dc&&dc.dc_number))}">
         <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">Leave as-is to keep the system number. This becomes the challan's number everywhere.</div></div>`
    : `<div class="form-group"><label>DC Number <span style="color:var(--text-muted);font-weight:400">— system-assigned</span></label>
         <input type="text" value="${h(dcNumber)}" disabled style="background:var(--surface-2);color:var(--text-muted)"></div>`;
  openModal(`Dispatch DC — ${dcNumber}`,
    `<p style="margin-bottom:12px;color:var(--text-muted)">Confirm the vehicle and driver to dispatch this challan. The challan moves to <b>In Transit</b> and the order to <b>In Shipment</b>.</p>
     ${dcNumField}
     <div class="form-group"><label>Assign Staff</label><select id="dp-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Scheduled Time</label><input type="time" id="dp-time" value="${v(dc&&dc.scheduled_time)}"></div>
     <div class="form-group"><label>Vehicle Number</label><input type="text" id="dp-vehicle" placeholder="e.g. MH12-AB-1234" value="${v(dc&&dc.vehicle_no)}"></div>
     <div class="form-group"><label>Driver Name</label><input type="text" id="dp-driver" placeholder="e.g. Rajesh Kumar" value="${v(dc&&dc.driver_name)}"></div>
     <div class="form-group"><label>Driver Phone</label><input type="text" id="dp-phone" placeholder="e.g. +91-9988776655" value="${v(dc&&dc.driver_phone)}"></div>
     <div class="form-group"><label>Expected Delivery Date</label><input type="date" id="dp-expected" value="${v(dc&&dc.expected_delivery_date)}"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" id="dp-confirm-btn" data-busy="Dispatching…" ${dataAct('confirmDispatch', dcId)}>Dispatch Now</button>`);
}

async function confirmDispatch(dcId) {
  const vehicle_no             = document.getElementById('dp-vehicle').value;
  const driver_name            = document.getElementById('dp-driver').value;
  const driver_phone           = document.getElementById('dp-phone').value;
  const expected_delivery_date = document.getElementById('dp-expected').value;
  const staff_id               = document.getElementById('dp-staff').value;
  const scheduled_time         = document.getElementById('dp-time').value;
  const dcNumEl                = document.getElementById('dp-dcnum');
  const dc_number              = dcNumEl ? dcNumEl.value.trim() : '';
  if (!vehicle_no || !driver_name) { showToast('Vehicle number and driver name required','error'); return; }
  if (APP._dcDispatching) return; // guard against a double-click double-dispatching
  APP._dcDispatching = true;
  // Button busy/disabled/gray feedback is handled centrally by the delegated-action
  // dispatcher (the button carries data-busy="Dispatching…").
  // One atomic dispatch call carries every logistics field — no follow-up PATCH.
  let res;
  try {
    res = await api('/delivery-challans/' + dcId + '/dispatch', {
      method:'POST',
      body: JSON.stringify({
        vehicle_no, driver_name, driver_phone,
        staff_id: staff_id||null, scheduled_time: scheduled_time||null,
        expected_delivery_date: expected_delivery_date||null,
        dc_number: dc_number||undefined
      })
    });
  } finally { APP._dcDispatching = false; }
  closeModal();
  if (!res) return;
  showToast(`DC ${dcId} dispatched — in transit`);
  // Refresh whatever view launched this so the "Dispatch" action disappears and the
  // operator is never re-prompted for the same challan.
  if (APP.page === 'deliveries' || APP.page === 'warehouse') navigate(APP.page);
  else switchDeliveryTab('transit', document.querySelectorAll('#dc-tabs .tab-btn')[1]);
}

// Cancel (void) a pre-dispatch challan created in error — super-admin only. ERP-correct
// soft delete: the challan moves to Cancelled, its number stays in the register (auditable),
// nothing is physically removed. A reason is required.
function cancelDCModal(dcId, dcNumber) {
  openModal(`Cancel challan — ${h(dcNumber||dcId)}`,
    `<p style="margin-bottom:10px;color:var(--text-muted);font-size:.86rem">This voids the challan (use for one created in error). It moves to <b>Cancelled</b> — the DC number stays in the register for audit, and nothing is deleted. Only possible before dispatch.</p>
     <div class="form-group"><label>Reason <span style="color:var(--danger)">*</span></label>
       <input type="text" id="cancel-reason" maxlength="200" placeholder="e.g. created in error / duplicate of DCN-00014" autofocus></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Keep it</button>
     <button class="btn btn-danger" data-busy="Cancelling…" ${dataAct('cancelDC', dcId)}>Cancel challan</button>`);
}
async function cancelDC(dcId) {
  const reason = (document.getElementById('cancel-reason')?.value || '').trim();
  if (!reason) { showToast('Enter a reason', 'error'); return; }
  const res = await api('/delivery-challans/' + encodeURIComponent(dcId) + '/cancel', { method:'POST', body: JSON.stringify({ reason }) });
  if (!res) return;
  closeModal();
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast(`Challan ${res.dc_number||dcId} cancelled`, 'success');
  if (APP.page === 'deliveries' || APP.page === 'warehouse') navigate(APP.page);
  else switchDeliveryTab('scheduled', document.querySelectorAll('#dc-tabs .tab-btn')[0]);
}

// Reassign the delivery person AFTER dispatch (wrong driver picked, or the driver
// changed en route). Does not re-dispatch — the challan stays In Transit. Ops /
// warehouse / delivery-manager only (server re-checks the role).
async function reassignDriverModal(dcId) {
  const [staff, dc] = await Promise.all([
    api('/staff').catch(()=>[]),
    api(`/delivery-challans/${dcId}`).catch(()=>null)
  ]);
  if (!dc) { showToast('Delivery not found','error'); return; }
  const v = (x)=> x==null ? '' : String(x);
  const staffOpts = (staff||[]).filter(s=>s.active && s.role==='delivery_staff')
    .map(s=>`<option value="${s.id}" ${dc.staff_id===s.id?'selected':''}>${h(s.name)}</option>`).join('');
  openModal(`Reassign delivery person — ${h(dc.dc_number||dc.id)}`,
    `<p style="margin-bottom:12px;color:var(--text-muted)">Change who is delivering this challan. It stays <b>In Transit</b> — this does not re-dispatch it.</p>
     <div class="form-group"><label>Assign Staff</label><select id="ra-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Driver Name</label><input type="text" id="ra-driver" placeholder="e.g. Rajesh Kumar" value="${h(v(dc.driver_name))}"></div>
     <div class="form-group"><label>Driver Phone</label><input type="tel" id="ra-phone" placeholder="e.g. +91-9988776655" value="${h(v(dc.driver_phone))}"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" data-busy="Saving…" ${dataAct('saveReassignDriver', dcId)}>Save</button>`);
}

async function saveReassignDriver(dcId) {
  const staff_id     = document.getElementById('ra-staff').value;
  const driver_name  = document.getElementById('ra-driver').value.trim();
  const driver_phone = document.getElementById('ra-phone').value.trim();
  if (!staff_id && !driver_name) { showToast('Pick a staff member or type a driver name','error'); return; }
  const res = await api('/delivery-challans/' + encodeURIComponent(dcId) + '/reassign', {
    method:'POST',
    body: JSON.stringify({ staff_id: staff_id||null, driver_name, driver_phone })
  });
  closeModal();
  if (!res) return;
  showToast(`DC ${dcId} reassigned`);
  navigate(APP.page || 'delivery');
}

// Roles allowed to set the DC number (the number used in Zoho) at delivery time.
// Delivery executives confirm the delivery but do not assign the document number.
// DC number is now set at DISPATCH (when the driver is assigned), not here. At delivery we
// only DISPLAY it for context — read-only, no edit.
function dcNumberField(curDcNum) {
  if (!curDcNum) return '';
  return `
    <div style="margin-bottom:14px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg,var(--surface-2))">
      <span style="font-size:.78rem;color:var(--text-muted)">DC number (set at dispatch):</span>
      <span style="font-weight:700;margin-left:6px">${h(curDcNum)}</span>
    </div>`;
}

async function markDelivered(dcId) {
  const [items, dc] = await Promise.all([
    api(`/delivery-challans/${dcId}/items`),
    api(`/delivery-challans/${dcId}`).catch(()=>null)
  ]);
  if (!items) return;
  const curDcNum = (dc && dc.dc_number) || '';
  const titleNum = curDcNum || dcId;
  if (!items.length) {
    // No line items tracked — confirm (and optionally set the Zoho DC number).
    APP._deliveryVoice = null;
    openModal(`Confirm Delivery — ${h(titleNum)}`, `
      <p style="color:var(--text-muted);margin-bottom:12px">No line items are tracked on this challan — confirm the delivery.</p>
      ${dcNumberField(curDcNum)}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
        <button class="btn btn-success" data-busy="Confirming…" ${dataAct('confirmDelivery', dcId)}>Confirm Delivery</button>
      </div>`);
    return;
  }
  const capped = items.some(i => i.order_remaining != null && i.order_remaining < i.qty_ordered);
  APP._deliveryVoice = null; // reset any prior recording
  openModal(`Confirm Delivery — ${h(titleNum)}`, `
    <p style="color:var(--text-muted);margin-bottom:12px">
      Enter the actual qty delivered for each item. If any line is <b>short or excess</b> vs what was dispatched,
      you must enter a written explanation — the delivery is then sent to a manager for approval before it is marked delivered.
      A voice note is optional.
    </p>
    ${dcNumberField(curDcNum)}
    <div id="deliver-summary" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div class="dsum"><b id="dsum-lines">—</b><span>Lines</span></div>
      <div class="dsum"><b id="dsum-sent">—</b><span>Items sent</span></div>
      <div class="dsum"><b id="dsum-delivered">—</b><span>Items delivered</span></div>
      <div class="dsum"><b id="dsum-diff">—</b><span>Difference</span></div>
    </div>
    <table class="table" style="margin-bottom:16px">
      <thead><tr><th>SKU</th><th>Item</th><th class="u-center">Sent</th><th class="u-center">Expected</th><th class="u-center">Delivered</th><th class="u-center">Difference</th></tr></thead>
      <tbody>
        ${items.map(i=>{ const expected = i.order_remaining != null ? i.order_remaining : i.qty_ordered; return `<tr>
          <td><b>${i.sku}</b></td>
          <td>${h(i.name)}</td>
          <td class="u-center">${i.qty_ordered}</td>
          <td style="text-align:center;font-weight:600${expected<i.qty_ordered?';color:var(--warning)':''}">${expected}</td>
          <td class="u-center"><input type="number" class="form-control form-control-sm deliver-qty"
            data-sku="${i.sku}" data-expected="${expected}" data-dispatched="${i.qty_ordered}" value="${expected}" min="0"
            style="width:80px;text-align:center"
            ${dataInputEl('onDeliverQty')}></td>
          <td class="u-center deliver-diff" data-sku="${i.sku}"></td>
        </tr>`;}).join('')}
      </tbody>
    </table>
    ${capped?'<div style="font-size:.76rem;color:var(--amber-text);background:var(--warning-bg);border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠️ Expected qty is capped to the order balance — some quantity was already delivered on earlier DCs.</div>':''}
    <div id="deliver-variance" hidden style="border:1px solid var(--warning);background:var(--warning-bg);border-radius:8px;padding:12px;margin-bottom:12px">
      <div style="font-weight:700;font-size:.85rem;margin-bottom:6px">⚠ Quantity discrepancy — written explanation required</div>
      <label style="display:block;font-size:.8rem;font-weight:600;margin-bottom:4px">Explanation <span style="color:var(--danger)">*</span></label>
      <input type="text" id="variance-note" class="form-control form-control-sm" required
        placeholder="Required — e.g. 2 cases damaged in transit" style="margin-bottom:10px">
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:6px">Voice note (optional)</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary btn-sm" id="voice-btn" ${dataAct('toggleVoiceRecording')}>🎙 Record</button>
        <span id="voice-status" style="font-size:.8rem;color:var(--text-muted)">Not recorded</span>
        <audio id="voice-playback" controls hidden style="height:34px"></audio>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
      <button class="btn btn-success" id="deliver-confirm-btn" data-busy="Confirming…" ${dataAct('confirmDelivery', dcId)}>Confirm Delivery</button>
    </div>
  `);
  onDeliverQty();  // reveal the voice section immediately if the pre-filled qty already differs from dispatched
}

// Recompute delivery discrepancy as quantities are typed; reveal the voice-note
// section and switch the confirm button to "Submit for Approval" when short/excess.
// Baseline = the DISPATCHED qty (qty_ordered), the SAME one the server uses to demand
// a voice note — so the recorder appears in every case the server will require it.
function onDeliverQty(el) {
  const inputs = Array.from(document.querySelectorAll('.deliver-qty'));
  let discrepancy = false, totalSent = 0, totalDelivered = 0;
  inputs.forEach(inp => {
    const v = parseInt(inp.value) || 0;
    const dispatched = parseInt(inp.dataset.dispatched) || 0;
    const diff = v - dispatched;
    totalSent += dispatched; totalDelivered += v;
    inp.style.color = v !== dispatched ? 'var(--warning)' : 'inherit';
    if (v !== dispatched) discrepancy = true;
    // Per-line difference vs what was sent: − short, ＋ excess, ✓ exact.
    const cell = document.querySelector(`.deliver-diff[data-sku="${inp.dataset.sku}"]`);
    if (cell) {
      if (diff === 0) { cell.textContent = '✓'; cell.style.color = 'var(--success)'; }
      else { cell.textContent = (diff > 0 ? '＋' : '−') + Math.abs(diff); cell.style.color = 'var(--warning)'; cell.style.fontWeight = '700'; }
    }
  });
  const totalDiff = totalDelivered - totalSent;
  const set = (id, val, color) => { const e = document.getElementById(id); if (e) { e.textContent = val; if (color) e.style.color = color; } };
  set('dsum-lines', inputs.length);
  set('dsum-sent', totalSent);
  set('dsum-delivered', totalDelivered, totalDiff === 0 ? 'var(--success)' : 'var(--warning)');
  set('dsum-diff', totalDiff === 0 ? '0' : (totalDiff > 0 ? '＋' : '−') + Math.abs(totalDiff), totalDiff === 0 ? 'var(--success)' : 'var(--warning)');
  const section = document.getElementById('deliver-variance');
  const btn = document.getElementById('deliver-confirm-btn');
  if (section) section.hidden = !discrepancy;
  if (btn) btn.textContent = discrepancy ? 'Submit for Approval' : 'Confirm Delivery';
}

async function confirmDelivery(dcId) {
  const inputs = Array.from(document.querySelectorAll('.deliver-qty'));
  const items = inputs.map(inp => ({ sku: inp.dataset.sku, qty_delivered: parseInt(inp.value)||0 }));
  const discrepancy = inputs.some(inp => (parseInt(inp.value)||0) !== (parseInt(inp.dataset.dispatched)||0));
  // DC number is set at dispatch now — not sent from here.
  const dcNumber = '';

  if (discrepancy) {
    // A written explanation is mandatory; the voice note is optional.
    const note = (document.getElementById('variance-note')?.value || '').trim();
    if (!note) {
      showToast('Enter a written explanation for the short/excess delivery', 'error');
      const noteEl = document.getElementById('variance-note'); if (noteEl) noteEl.focus();
      return;
    }
    // Attach the voice recording first only if one was made, then submit for approval
    // (server holds it as PENDING). A failed/absent recording no longer blocks submit.
    if (APP._deliveryVoice) {
      const v = APP._deliveryVoice;
      const up = await api(`/delivery-challans/${dcId}/voice/upload`, { method:'POST', body: JSON.stringify({
        filename: `delivery-note-${dcId}.webm`, mime_type: v.mime, content_b64: v.b64, file_size: v.size
      }) });
      if (!up) return;
    }
    const res = await api(`/delivery-challans/${dcId}/deliver`, { method:'POST', body: JSON.stringify({ items, variance_note: note, dc_number: dcNumber || undefined }) });
    if (!res) return;
    closeModal();
    showToast('Sent to manager for approval — delivery on hold', 'info');
    APP._deliveryVoice = null;
    if (APP.page === 'deliveries' || APP.page === 'warehouse') navigate(APP.page);
    else switchDeliveryTab('transit', document.querySelectorAll('#dc-tabs .tab-btn')[1]);
    return;
  }

  const res = await api(`/delivery-challans/${dcId}/deliver`, { method:'POST', body: JSON.stringify({ items, dc_number: dcNumber || undefined }) });
  if (res) {
    closeModal();
    const msg = res.partial ? `Partial delivery recorded — follow-up DC created` : `DC ${dcNumber||dcId} fully delivered${res.order_closed?' — order closed':''}`;
    showToast(msg);
    switchDeliveryTab('delivered', document.querySelectorAll('#dc-tabs .tab-btn')[2]);
  }
}

// ── Delivery discrepancy: voice recording + manager approval ──────────
// Live in-browser recording via MediaRecorder (works on desktop and mobile web).
// The recorded clip is held on APP._deliveryVoice as base64 for upload on submit.
async function toggleVoiceRecording() {
  const btn = document.getElementById('voice-btn');
  const status = document.getElementById('voice-status');
  const playback = document.getElementById('voice-playback');
  // Stop an in-progress recording.
  if (APP._voiceRecorder && APP._voiceRecorder.state === 'recording') {
    APP._voiceRecorder.stop();
    return;
  }
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast('Voice recording is not supported on this device/browser', 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (APP._voiceTimer) { clearInterval(APP._voiceTimer); APP._voiceTimer = null; }
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = String(reader.result || '');
        const b64 = dataUrl.split(',')[1] || '';
        APP._deliveryVoice = { b64, mime: blob.type, size: blob.size };
        if (playback) { playback.src = dataUrl; playback.hidden = false; }
        if (status) status.innerHTML = `<span style="color:var(--success)">✓ Recorded</span> · ${(blob.size/1024).toFixed(0)} KB`;
      };
      reader.readAsDataURL(blob);
      if (btn) { btn.textContent = '🎙 Re-record'; btn.classList.remove('btn-danger'); }
    };
    APP._voiceRecorder = rec;
    rec.start();
    if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('btn-danger'); }
    // Live "recording in progress" indicator: a pulsing red dot + running timer.
    const started = Date.now();
    const paint = () => {
      if (!status) return;
      const s = Math.floor((Date.now() - started) / 1000);
      const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      status.innerHTML = `<span class="rec-dot"></span> <b style="color:var(--danger)">Recording…</b> <span style="font-variant-numeric:tabular-nums">${mmss}</span> <span style="color:var(--text-muted)">— tap Stop when done</span>`;
    };
    paint();
    if (APP._voiceTimer) clearInterval(APP._voiceTimer);
    APP._voiceTimer = setInterval(paint, 1000);
  } catch {
    showToast('Microphone permission denied — cannot record', 'error');
  }
}

// Transit-card action buttons — shared by both transit renderers so a
// pending-approval challan is handled identically. A held (discrepancy) delivery
// shows a manager "Review" action instead of the driver "Delivered" button.
const DC_ASSIGN_ROLES = ['super_admin','ops_admin','warehouse_exec','delivery_manager'];
function dcTransitActions(dc) {
  const canReassign = DC_ASSIGN_ROLES.includes(APP.user?.role);
  const reassign = canReassign ? ` <button class="btn btn-secondary btn-sm" ${dataAct('reassignDriverModal', dc.id)} title="Change the assigned delivery person">Reassign</button>` : '';
  const base = `<button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>Items</button>${reassign}
     <button class="btn btn-secondary btn-sm" style="color:var(--danger)" ${dataAct('returnDCModal', dc.id)}>Return</button>`;
  if (dc.delivery_approval === 'PENDING') {
    return base + (['super_admin','ops_admin'].includes(APP.user?.role)
      ? ` <button class="btn btn-warning btn-sm" ${dataAct('reviewDeliveryModal', dc.id)}>⚠ Review discrepancy</button>`
      : ` <span class="badge badge-warning" title="A short/excess delivery is awaiting manager approval">⏳ Awaiting approval</span>`);
  }
  return base + ` <button class="btn btn-success btn-sm" ${dataAct('markDelivered', dc.id)}>✓ Delivered</button>`;
}

// Manager review of a held delivery: proposed vs dispatched, the driver's voice
// note, then Approve (finalize) or Reject (send back for re-delivery).
async function reviewDeliveryModal(dcId) {
  const [dc, items, docs] = await Promise.all([
    api(`/delivery-challans/${dcId}`).catch(()=>null),
    api(`/delivery-challans/${dcId}/items`).catch(()=>[]),
    api(`/delivery-challans/${dcId}/documents`).catch(()=>[])
  ]);
  if (!dc) { showToast('Delivery not found', 'error'); return; }
  let proposed = [];
  try { proposed = JSON.parse(dc.variance_payload || '[]'); } catch { proposed = []; }
  const propBySku = Object.fromEntries((proposed||[]).map(p => [p.sku, p.qty_delivered]));
  const rows = (items||[]).map(i => {
    const dispatched = i.qty_ordered;
    const delivered = propBySku[i.sku] != null ? propBySku[i.sku] : dispatched;
    const delta = delivered - dispatched;
    const col = delta === 0 ? 'inherit' : (delta < 0 ? 'var(--warning)' : 'var(--danger)');
    return `<tr><td><b>${i.sku}</b></td><td>${h(i.name)}</td>
      <td class="u-center">${dispatched}</td>
      <td class="u-center"><b>${delivered}</b></td>
      <td class="u-center" style="color:${col};font-weight:600">${delta>0?'+':''}${delta}</td></tr>`;
  }).join('');
  const voice = (docs||[]).filter(d => d.doc_type === 'voice');
  const players = voice.length ? voice.map(d => {
    const src = String(d.content_b64||'').startsWith('data:') ? d.content_b64 : `data:${d.mime_type||'audio/webm'};base64,${d.content_b64}`;
    return `<audio controls src="${src}" style="width:100%;height:38px;margin-top:6px"></audio>`;
  }).join('') : '<div style="color:var(--text-muted);font-size:.82rem">No voice note attached</div>';
  openModal(`Review Delivery — ${dc.dc_number||dcId}`, `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">
      ${h(dc.client_name||'')} · Order ${dc.order_id||'—'} · submitted by ${h(dc.variance_by||'—')}
    </div>
    <table class="table" style="margin-bottom:12px">
      <thead><tr><th>SKU</th><th>Item</th><th class="u-center">Dispatched</th><th class="u-center">Delivered</th><th class="u-center">Δ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${dc.variance_note?`<div style="font-size:.85rem;margin-bottom:8px"><b>Note:</b> ${h(dc.variance_note)}</div>`:''}
    <div style="font-weight:600;font-size:.8rem;margin-bottom:2px">🎙 Driver's voice explanation</div>
    ${players}
  `,
  `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
   <button class="btn btn-danger" data-busy="Rejecting…" ${dataAct('confirmDeliveryDecision', dcId, 'reject')}>Reject</button>
   <button class="btn btn-success" data-busy="Approving…" ${dataAct('confirmDeliveryDecision', dcId, 'approve')}>Approve &amp; Deliver</button>`);
}

async function confirmDeliveryDecision(dcId, decision) {
  const res = await api(`/delivery-challans/${dcId}/deliver-decision`, { method:'POST', body: JSON.stringify({ decision }) });
  if (!res) return;
  closeModal();
  showToast(decision === 'approve' ? `Delivery approved${res.order_closed?' — order closed':''}` : 'Delivery rejected — sent back for re-delivery', decision === 'approve' ? 'success' : 'info');
  if (APP.page === 'deliveries' || APP.page === 'warehouse') navigate(APP.page);
  else switchDeliveryTab('transit', document.querySelectorAll('#dc-tabs .tab-btn')[1]);
}

function markPOD(dcId)  { uploadDCDocModal(dcId, 'pod'); }
function markScan(dcId) { scanDCDocModal(dcId); }

function uploadDCDocModal(dcId, docType) {
  const label = docType === 'pod' ? 'Proof of Delivery (POD)' : 'DC Scan';
  openModal(`Upload ${label} — DC #${dcId}`,
    `<div class="form-group">
       <label>Select file (PDF or image, max 5 MB)</label>
       <input type="file" id="dc-doc-file" accept="image/*,application/pdf" ${dataChangeEl('previewDCDoc')}
         style="display:block;width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:.85rem;margin-top:6px">
     </div>
     <div id="dc-doc-preview" style="display:none;margin-top:12px;text-align:center">
       <img id="dc-doc-img" style="max-width:100%;max-height:260px;border-radius:6px;display:none">
       <div id="dc-doc-name" style="font-size:.82rem;color:var(--text-muted);margin-top:6px"></div>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" id="dc-doc-submit" ${dataAct('confirmDCDocUpload', dcId, docType)}>Upload ${label}</button>`
  );
}

function scanDCDocModal(dcId) {
  APP._scanPages = []; // [{dataUrl, name}]
  openModal(`Scan POD Document — DC #${dcId}`,
    `<input type="file" id="dc-scan-file" accept="image/*" capture="environment"
       style="display:none" ${dataChangeEl('onScanCapturedEl', dcId)}>

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
       <button class="btn btn-primary" style="padding:10px 28px" ${dataAct('clickEl', 'dc-scan-file')}>
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
         <button class="btn btn-secondary" style="flex:1" ${dataAct('retakeScanPage', dcId)}>🔄 Retake</button>
         <button class="btn btn-secondary" style="flex:1" ${dataAct('addScanPage', dcId)}>➕ Add Page</button>
         <button class="btn btn-primary" style="flex:1" id="dc-scan-submit" ${dataAct('uploadAllScanPages', dcId)}>⬆ Upload</button>
       </div>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>`
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
      <div style="padding:10px 14px;background:var(--surface-2);display:flex;align-items:center;justify-content:space-between">
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
    ? `<button class="btn btn-primary" ${dataActEl('downloadDCDocsPDF', dcId)}>⬇ Download PDF (${imgDocs.length} page${imgDocs.length>1?'s':''})</button>`
    : '';

  openModal(
    `DC #${dcId} — ${docs.length} page${docs.length>1?'s':''} uploaded`,
    pagesHtml,
    `${pdfBtn}<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`
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
         <thead><tr><th>Item</th><th class="u-center">Dispatched</th><th class="u-center">Return Qty</th></tr></thead>
         <tbody>${items.map(it => {
           const maxQ = it.qty_delivered || it.qty_ordered;
           return `<tr>
             <td><b style="font-size:.84rem">${h(it.item_name||it.name||it.sku)}</b><div style="font-size:.7rem;color:var(--text-muted)">${h(it.sku)}</div></td>
             <td class="u-empty">${maxQ}</td>
             <td class="u-center"><input type="number" data-ret-sku="${h(it.sku)}" data-ret-name="${h(it.item_name||it.name||it.sku)}" value="0" min="0" max="${maxQ}" style="width:70px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;text-align:center"></td>
           </tr>`;}).join('')}
         </tbody>
       </table>
     </div>` : '<div class="alert alert-warning" style="margin-bottom:12px">No item breakdown found for this DC — the full DC will be returned.</div>'}
     <div class="form-group"><label>Reason for Return <span class="u-danger">*</span></label>
       <textarea id="return-reason" rows="2" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;box-sizing:border-box" placeholder="e.g. Goods damaged in transit, wrong items, quality issue…"></textarea>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" style="background:var(--danger)" ${dataAct('confirmReturnDC', dcId)}>Submit Return for Approval</button>`);
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
   PHASE 3 — DELIVERIES HUB. One predictable "Deliveries" home that
   hosts the day's runs, the challan list, the calendar and routes as
   TABS, instead of four separate menus. Each tab mounts its existing
   render function into the hub body — same data, same APIs, no new
   pages. Tabs are gated to match each role's prior access.
   ============================================================ */
let _delivHubCssDone = false;
function injectDelivHubCss() {
  if (_delivHubCssDone) return; _delivHubCssDone = true;
  const css = `
  .dhub-tabs{display:flex;gap:4px;flex-wrap:wrap;border-bottom:1px solid var(--border);margin-bottom:16px;padding-bottom:0}
  .dhub-tab{appearance:none;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;
    font-size:.9rem;font-weight:700;color:var(--text-muted);padding:9px 14px;border-radius:8px 8px 0 0;white-space:nowrap}
  .dhub-tab:hover{color:var(--text,#15303d);background:var(--bg,#f4f7f9)}
  .dhub-tab.on{color:var(--primary);border-bottom-color:var(--primary)}
  .dhub-tab:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

const DELIV_TABS = [
  { k:'today',    label:"Today's Runs", fn:'renderTodaysSchedule' },
  { k:'list',     label:'Deliveries',   fn:'renderDelivery' },
  { k:'calendar', label:'Calendar',     fn:'renderDeliveryCalendar' },
  { k:'routes',   label:'Routes',       fn:'renderDeliveryRoutes' },
];
// Match each role's prior menu access so the hub never widens permissions:
// super_admin kept all four (incl. Routes); ops/delivery managers had Today +
// List + Calendar; delivery execs only saw the challan list.
function delivTabsForRole(role) {
  // Roles that cannot open the Deliveries hub get no tabs — keeps the tab set
  // consistent with canAccessPage for all roles, not just hub-accessible ones
  // (the hub never renders for them; this hardens the dead path).
  const navProfile = (typeof ROLES !== 'undefined' && ROLES[role]) ? ROLES[role].nav : null;
  if (!(NAV[navProfile] || []).some(i => i.id === 'delivery')) return [];
  if (role === 'delivery_exec') return DELIV_TABS.filter(t => t.k === 'list');
  if (role === 'super_admin')   return DELIV_TABS;
  return DELIV_TABS.filter(t => t.k !== 'routes');
}

async function renderDeliveriesHub(el) {
  const tabs = delivTabsForRole(APP.user?.role);
  // A single-tab role (delivery exec) gets the plain page — no pointless tab bar.
  if (tabs.length <= 1) { await window[(tabs[0] || DELIV_TABS[1]).fn](el); return; }
  injectDelivHubCss();
  // Phase 2: the active tab is addressable as #delivery/<k>. The hash wins on a
  // deep link / refresh; otherwise fall back to the last-used tab.
  if (!tabs.some(t => t.k === APP._delivTab)) APP._delivTab = tabs[0].k;
  const active = routeTab('delivery', tabs.map(t => t.k), APP._delivTab);
  APP._delivTab = active;
  writeHash('delivery', active);
  registerHub('delivery', delivHubTab);
  setHubBreadcrumb('delivery', (tabs.find(t => t.k === active) || {}).label);
  el.innerHTML = `
    <div class="dhub-tabs" role="tablist" aria-label="Deliveries">
      ${tabs.map(t => `<button class="dhub-tab ${t.k===active?'on':''}" role="tab" aria-selected="${t.k===active}" data-k="${t.k}" ${dataAct('delivHubTab', t.k)}>${h(t.label)}</button>`).join('')}
    </div>
    <div id="dhub-body"><div class="loading-state"><div class="spinner"></div></div></div>`;
  const body = document.getElementById('dhub-body');
  const fn = tabs.find(t => t.k === active).fn;
  await window[fn](body);
}

// Re-render a delivery view IN PLACE — into the Deliveries-hub body if we're in
// the hub, else the main content when the page is open standalone. Used by the
// in-page Refresh / post-action redraws so they no longer jump to the standalone
// page (which dropped the hub's tab bar).
function refreshDeliveryView(fnName) {
  const host = document.getElementById('dhub-body') || document.getElementById('main-content');
  if (host && typeof window[fnName] === 'function') window[fnName](host);
}

async function delivHubTab(k) {
  const tabs = delivTabsForRole(APP.user?.role);
  if (!tabs.some(t => t.k === k)) return;
  APP._delivTab = k;
  writeHash('delivery', k);
  setHubBreadcrumb('delivery', (DELIV_TABS.find(t => t.k === k) || {}).label);
  document.querySelectorAll('.dhub-tab').forEach(b => {
    const on = b.dataset.k === k;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const body = document.getElementById('dhub-body');
  if (!body) return;
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const fn = DELIV_TABS.find(t => t.k === k).fn;
  if (window[fn]) await window[fn](body);
}
