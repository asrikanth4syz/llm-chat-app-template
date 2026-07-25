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
      Error loading data. <button class="btn btn-secondary btn-sm" ${dataAct('whGoTab', tab)}>Retry</button>
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
      <div class="u-label">${label}</div>
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
              <thead><tr><th>Item Name</th><th>SKU</th><th>Qty Required</th><th>Stock Available</th>${order.status==='PICKED'?'<th>Bin Picked From</th>':''}</tr></thead>
              <tbody>${order.items.map(item=>`<tr>
                <td><b>${h(item.item_name)}</b></td>
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
  const res = await api(`/orders/${orderId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ to: 'IN_SHIPMENT', note: 'Items picked — dispatched to delivery' })
  });
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
          <td class="u-muted">${item.qty}</td>
          <td>
            <input type="number" class="form-control form-control-sm pick-qty"
              data-sku="${item.sku}" data-name="${item.name||item.item_name}" data-ordered="${item.qty}"
              value="${item.qty}" min="0" max="${item.qty}"
              style="width:72px;text-align:center"
              ${dataInputEl('colorByOrdered')}>
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
      <button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
      <button class="btn btn-primary" ${dataAct('confirmPick', orderId)}>Confirm Pick</button>
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
      return `<button class="tab-btn${active===t?' active':''}" ${dataActEl('switchDeliveryTab', t)}>${labels[i]} ${badge}</button>`;
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
          <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>View Items</button>
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
          <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>Items</button>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger)" ${dataAct('returnDCModal', dc.id)}>Return</button>
          <button class="btn btn-success btn-sm" ${dataAct('markDelivered', dc.id)}>✓ Delivered</button>
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
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markPOD', dc.id)}>Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markScan', dc.id)}>Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" ${dataAct('billDC', dc.id)}>Bill</button>`}</td>
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
      if (!returns.length) return `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;
      return `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th></tr></thead><tbody>
        ${returns.map(dc=>`<tr><td><b>${dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
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
              <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>View Items</button>
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
              <button class="btn btn-secondary btn-sm" ${dataAct('viewDCItems', dc.id)}>Items</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger)" ${dataAct('returnDCModal', dc.id)}>Return</button>
              <button class="btn btn-success btn-sm" ${dataAct('markDelivered', dc.id)}>✓ Delivered</button>
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
        <td>${dc.pod_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markPOD', dc.id)}>Upload POD</button>`}</td>
        <td>${dc.dc_scan_uploaded?'<span class="badge badge-success">✓ Done</span>':`<button class="btn btn-secondary btn-sm" ${dataAct('markScan', dc.id)}>Scan POD</button>`}</td>
        <td>${dc.billed?'<span class="badge badge-success">Billed</span>':`<button class="btn btn-primary btn-sm" ${dataAct('billDC', dc.id)}>Bill</button>`}</td>
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
      content.innerHTML = returns.length
        ? `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th>Order</th><th>Client</th><th>Total Qty</th><th>Driver</th><th>Dispatched At</th></tr></thead><tbody>
            ${returns.map(dc=>`<tr><td><b>${dc.id}</b></td><td>${dc.order_id}</td><td>${dc.client_name||'—'}</td><td>${dc.total_qty||'—'}</td><td>${dc.driver_name||'—'}</td><td>${fmtDate(dc.dispatched_at)}</td></tr>`).join('')}
          </tbody></table></div></div>`
        : `<div class="card" style="padding:40px;text-align:center;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:8px">↩</div>No returns recorded</div>`;

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
    <td><b>${h(i.name)}</b></td>
    <td>${i.qty_ordered}</td>
    <td style="color:${i.qty_delivered>0?'var(--success)':'var(--text-muted)'}">${i.qty_delivered||0}</td>
    <td style="color:${(i.qty_ordered-(i.qty_delivered||0))>0?'var(--danger)':'var(--success)'};font-weight:600">${i.qty_ordered-(i.qty_delivered||0)}</td>
  </tr>`).join('') : '<tr><td colspan="5" class="u-empty">No items</td></tr>';
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
    box.innerHTML = `<div class="table-wrap" style="margin-top:8px;border:1px solid var(--border);border-radius:8px">
      <table class="table" style="margin:0;font-size:.82rem">
        <thead><tr><th>SKU</th><th>Item</th><th class="u-right">Dispatched</th><th class="u-right">Delivered</th><th class="u-right">Pending</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
    box.dataset.loaded = '1';
  }
  box.style.display = '';
  if (btn) btn.textContent = 'Hide Items';
}

async function dispatchDCModal(dcId) {
  const staff = await api('/staff') || [];
  const staffOpts = staff.filter(s=>s.active && s.role==='delivery_staff')
    .map(s=>`<option value="${s.id}">${h(s.name)}</option>`).join('');
  openModal(`Dispatch DC — ${dcId}`,
    `<p style="margin-bottom:12px;color:var(--text-muted)">Enter vehicle and driver details to dispatch DC <b>${dcId}</b>. Order status will advance to IN_SHIPMENT.</p>
     <div class="form-group"><label>DC Number</label><input type="text" id="dp-dcnum" placeholder="e.g. 702037"></div>
     <div class="form-group"><label>Assign Staff</label><select id="dp-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Scheduled Time</label><input type="time" id="dp-time"></div>
     <div class="form-group"><label>Vehicle Number</label><input type="text" id="dp-vehicle" placeholder="e.g. MH12-AB-1234"></div>
     <div class="form-group"><label>Driver Name</label><input type="text" id="dp-driver" placeholder="e.g. Rajesh Kumar"></div>
     <div class="form-group"><label>Driver Phone</label><input type="text" id="dp-phone" placeholder="e.g. +91-9988776655"></div>
     <div class="form-group"><label>Expected Delivery Date</label><input type="date" id="dp-expected"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmDispatch', dcId)}>Dispatch Now</button>`);
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
      <thead><tr><th>SKU</th><th>Item</th><th class="u-center">Dispatched</th><th class="u-center">Outstanding</th><th class="u-center">Delivered</th></tr></thead>
      <tbody>
        ${items.map(i=>{ const maxDeliver = i.order_remaining != null ? i.order_remaining : i.qty_ordered; return `<tr>
          <td><b>${i.sku}</b></td>
          <td>${h(i.name)}</td>
          <td class="u-empty">${i.qty_ordered}</td>
          <td style="text-align:center;font-weight:600${maxDeliver<i.qty_ordered?';color:var(--warning)':''}">${maxDeliver}</td>
          <td class="u-center"><input type="number" class="form-control form-control-sm deliver-qty"
            data-sku="${i.sku}" value="${maxDeliver}" min="0" max="${maxDeliver}"
            style="width:80px;text-align:center"
            ${dataInputEl('clampDeliver', maxDeliver)}></td>
        </tr>`;}).join('')}
      </tbody>
    </table>
    ${capped?'<div style="font-size:.76rem;color:var(--amber-text);background:var(--warning-bg);border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px">⚠️ Deliverable qty is capped to the order balance — some quantity was already delivered on earlier DCs.</div>':''}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
      <button class="btn btn-success" ${dataAct('confirmDelivery', dcId)}>Confirm Delivery</button>
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
