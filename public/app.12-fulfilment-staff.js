/* ============================================================
   FULFILMENT MANAGEMENT (15.X series)
   ============================================================ */
async function renderFulfilment(el) {
  el.innerHTML = `
  ${pageHeader('Fulfilment & Reconciliation', 'Order vs Delivery Management')}
  <div class="tabs" id="fulfilment-tabs">
    <button class="tab-btn active" ${dataActEl('switchFulfilTab', 'ovd')}>Order vs Delivery</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'due-items')}>Due Items</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'pending-supply')}>Pending Supply</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'ageing')}>Due Ageing</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'brand-shortfall')}>Brand Shortfall</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'brand-procurement')}>Brand Procurement</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'client-scorecard')}>Client Scorecard</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'dc-per-order')}>DC per Order</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'dc-recon')}>DC Reconciliation</button>
    <button class="tab-btn" ${dataActEl('switchFulfilTab', 'procurement-forecast')}>Procurement Forecast</button>
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
          <select id="ovd-client" class="filter-select" ${dataChange('reloadOVD')} style="font-size:.8rem">
            <option value="">All Clients</option>
            ${(clients||[]).map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('')}
          </select>
          <select id="ovd-range" class="filter-select" ${dataChange('reloadOVD')} style="font-size:.8rem">
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <label style="font-size:.82rem;display:flex;align-items:center;gap:5px;white-space:nowrap"><input type="checkbox" id="ovd-due-only" ${dataChange('reloadOVD')}> Due Only</label>
          <button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'ovd')}>&#8595; CSV</button>
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
        <div class="u-label">Critical (15+ days)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical>0?'var(--danger)':'var(--navy)'};line-height:1">${critical}</div>
        <div style="font-size:.75rem;color:${critical>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${critical>0?'immediate action needed':'none critical'}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
        <div class="u-label">Total Due Items</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div class="u-sub">items pending</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.reduce((s,r)=>s+(r.due_qty||0),0)}</div>
        <div class="u-sub">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(data.reduce((s,r)=>s+(r.due_qty||0)*(r.unit_price||0),0))}</div>
        <div class="u-sub">estimated at cost</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Due Items</span><button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'due-items')}>&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Location</th><th>Order</th><th>Brand</th><th>Item</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Due Since</th><th>Ageing (days)</th><th>Vendor</th><th>Status</th></tr></thead>
        <tbody>${data.map(r=>`<tr>
          <td><b>${h(r.client_name)}</b></td>
          <td>${r.location||'—'}</td>
          <td><b>${r.order_number}</b></td>
          <td>${r.brand_name||'—'}</td>
          <td>${h(r.item_name)}</td>
          <td>${r.ordered_qty}</td>
          <td>${r.delivered_qty}</td>
          <td><b class="u-danger">${r.due_qty}</b></td>
          <td>${fmtDate(r.due_since_date)}</td>
          <td><span class="badge badge-${r.due_ageing_days>=15?'danger':r.due_ageing_days>=8?'warning':'info'}">${r.due_ageing_days}d</span></td>
          <td>${r.responsible_vendor||'—'}</td>
          <td>${statusBadge(r.due_status?.replace(' ','_').toUpperCase()||'DUE')}</td>
        </tr>`).join('')||'<tr><td colspan="12" class="u-empty">No due items</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'pending-supply') {
    const data = await api('/reports/pending-supply');
    if (!data) return;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Open Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.open_orders}</div>
        <div class="u-sub">in progress</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
        <div class="u-label">Partial Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--warning);line-height:1">${data.kpis.partial_orders}</div>
        <div class="u-sub">partly delivered</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0">
        <div class="u-label">Due Quantity</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1">${data.kpis.due_qty}</div>
        <div class="u-sub">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0">
        <div class="u-label">Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1">${fmt(data.kpis.due_value)}</div>
        <div class="u-sub">at risk</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.delayed_deliveries>0?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Delayed Deliveries</div>
        <div style="font-size:1.9rem;font-weight:700;color:${data.kpis.delayed_deliveries>0?'var(--warning)':'var(--navy)'};line-height:1">${data.kpis.delayed_deliveries}</div>
        <div class="u-sub">past expected date</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Client Drilldown</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Open Orders</th><th>Due Qty</th><th>Due Value</th><th>Actions</th></tr></thead>
        <tbody>${(data.clients||[]).map(c=>`<tr>
          <td><b>${h(c.name)}</b></td>
          <td>${c.order_count}</td>
          <td><b class="u-danger">${c.due_qty||0}</b></td>
          <td>${fmt(c.due_value)}</td>
          <td><button class="btn btn-secondary btn-sm" ${dataAct('drillPendingClient', c.id, c.name)}>Drilldown</button></td>
        </tr>`).join('')||'<tr><td colspan="5" class="u-empty">No pending supply</td></tr>'}
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
        <div class="u-label">Critical (15+ days)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical?.order_count?'var(--danger)':'var(--navy)'};line-height:1">${critical?.order_count||0}</div>
        <div style="font-size:.75rem;color:${critical?.order_count?'var(--danger)':'var(--text-muted)'};margin-top:6px">${fmt(critical?.due_value||0)} at risk</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Total Due Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalOrders}</div>
        <div class="u-sub">across all buckets</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
        <div class="u-label">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDueQty}</div>
        <div class="u-sub">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Total Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(totalDueValue)}</div>
        <div class="u-sub">estimated at cost</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Due Ageing Report</span><button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'ageing')}>&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Age Bucket</th><th>Orders</th><th>Clients</th><th>Vendors</th><th>Due Qty</th><th>Due Value</th></tr></thead>
        <tbody>${data.map(r=>{
          const badge = r.age_bucket==='15+ Days'?'danger':r.age_bucket==='8-15 Days'?'warning':'info';
          return `<tr>
            <td><span class="badge badge-${badge}">${r.age_bucket}</span></td>
            <td>${r.order_count}</td><td>${r.client_count}</td><td>${r.vendor_count}</td>
            <td><b>${r.due_qty}</b></td><td>${fmt(r.due_value)}</td>
          </tr>`;
        }).join('')||'<tr><td colspan="6" class="u-empty">No overdue items</td></tr>'}
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
        <div class="u-label">Critical Brands (&lt;70%)</div>
        <div style="font-size:1.9rem;font-weight:700;color:${critical>0?'var(--danger)':'var(--navy)'};line-height:1">${critical}</div>
        <div class="u-sub">of ${data.length} brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${avgFill>=90?'var(--success)':avgFill>=70?'var(--warning)':'var(--danger)'};margin-bottom:0">
        <div class="u-label">Avg Fulfilment</div>
        <div style="font-size:1.9rem;font-weight:700;color:${avgFill>=90?'var(--success)':avgFill>=70?'var(--warning)':'var(--danger)'};line-height:1">${avgFill}%</div>
        <div class="u-sub">across all brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDue>0?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Total Due Units</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDue}</div>
        <div class="u-sub">outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Brands Tracked</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div class="u-sub">last 30 days</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Brand Shortfall Report</span><button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'brand-shortfall')}>&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Ordered</th><th>Delivered</th><th>Due</th><th>Fulfilment %</th><th>Vendor</th></tr></thead>
        <tbody>${data.sort((a,b)=>a.fulfilment_pct-b.fulfilment_pct).map(r=>`<tr>
          <td><b>${h(r.brand_name)}</b></td>
          <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
          <td><b class="u-danger">${r.due_qty}</b></td>
          <td>
            <span class="badge badge-${r.fulfilment_pct>=90?'success':r.fulfilment_pct>=70?'warning':'danger'}">${r.fulfilment_pct}%</span>
            <div style="background:var(--border);height:3px;border-radius:2px;margin-top:4px;overflow:hidden"><div style="height:100%;width:${Math.min(r.fulfilment_pct,100)}%;background:${r.fulfilment_pct>=90?'var(--success)':r.fulfilment_pct>=70?'var(--warning)':'var(--danger)'}"></div></div>
          </td>
          <td>${r.primary_vendor||'—'}</td>
        </tr>`).join('')||'<tr><td colspan="6" class="u-empty">No shortfall</td></tr>'}
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
      <div class="card" style="padding:16px 18px;border-top:3px solid ${brandsWithShortfall>0?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Brands w/ Shortfall</div>
        <div style="font-size:1.9rem;font-weight:700;color:${brandsWithShortfall>0?'var(--warning)':'var(--navy)'};line-height:1">${brandsWithShortfall}</div>
        <div class="u-sub">of ${data.length} brands</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalShortfall>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Total Shortfall Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:${totalShortfall>0?'var(--danger)':'var(--navy)'};line-height:1">${totalShortfall}</div>
        <div class="u-sub">units to procure</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Suggested PO Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalSuggestedPO}</div>
        <div class="u-sub">total units to order</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Brands Tracked</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div class="u-sub">last 30 days</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Consolidated Brand Procurement</span><button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'brand-procurement')}>&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Category</th><th>Clients</th><th>Total Ordered</th><th>Total Delivered</th><th>Shortfall</th><th>Suggested PO Qty</th><th>Primary Vendor</th><th>Actions</th></tr></thead>
        <tbody>${data.map((r,i)=>`<tr>
          <td><button class="btn-plain" ${dataAct('toggleBrandDrill', i, String(r.brand_name), from30, today)} style="border:0;background:none;cursor:pointer;font-size:.8rem;color:var(--primary);padding:0 6px 0 0" title="Show products"><span id="bd-caret-${i}">▸</span></button><b>${h(r.brand_name)}</b></td><td>${r.category}</td>
          <td title="${h(r.clients)}">${r.client_count} clients</td>
          <td>${r.total_ordered_qty}</td><td>${r.total_delivered_qty}</td>
          <td><b style="color:${r.shortfall_qty>0?'var(--danger)':'var(--success)'}">${r.shortfall_qty}</b></td>
          <td><b style="color:var(--blue)">${r.suggested_po_qty}</b></td>
          <td>${r.primary_vendor||'—'}</td>
          <td>${r.suggested_po_qty>0?`<button class="btn btn-primary btn-sm" ${dataAct('initiateBrandPO', String(r.brand_name), r.vendor_id||'', from30, today)}>🛒 Initiate PO</button>`:'<span style="color:var(--success);font-size:.8rem">✓ Fulfilled</span>'}</td>
        </tr>
        <tr class="brand-drill" id="bd-${i}" style="display:none"><td colspan="9" style="padding:0;background:var(--surface-2,#f8fafc)"><div id="bd-body-${i}" style="padding:12px 16px"></div></td></tr>`).join('')||'<tr><td colspan="9" class="u-empty">No data</td></tr>'}
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
        <div class="u-label">At-Risk Clients</div>
        <div style="font-size:1.9rem;font-weight:700;color:${atRisk>0?'var(--danger)':'var(--navy)'};line-height:1">${atRisk}</div>
        <div style="font-size:.75rem;color:${atRisk>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">fulfilment &lt;70%</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${avgFill<70?'var(--danger)':avgFill<90?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Avg Fulfilment</div>
        <div style="font-size:1.9rem;font-weight:700;color:${avgFill<70?'var(--danger)':avgFill<90?'var(--warning)':'var(--success)'};line-height:1">${avgFill}%</div>
        <div class="u-sub">across all clients</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDueVal>0?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Total Due Value</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${fmt(totalDueVal)}</div>
        <div class="u-sub">outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Avg Delivery Time</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${avgDelivery!=null?avgDelivery+'d':'—'}</div>
        <div class="u-sub">days from order</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span>Client Fulfilment Scorecard</span><button class="btn btn-secondary btn-sm" ${dataAct('exportFulfilCSV', 'client-scorecard')}>&#8595; CSV</button></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Client</th><th>Location</th><th>Orders</th><th>Ordered Qty</th><th>Delivered Qty</th><th>Due Qty</th><th>Due Value</th><th>Fulfilment %</th><th>Avg Delivery Days</th></tr></thead>
        <tbody>${data.sort((a,b)=>(a.fulfilment_pct||0)-(b.fulfilment_pct||0)).map(r=>`<tr>
          <td><b>${h(r.client_name)}</b></td>
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
        </tr>`).join('')||'<tr><td colspan="9" class="u-empty">No data</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  } else if (tab === 'dc-per-order') {
    const data = await api(`/reports/dc-per-order?from=${from30}&to=${today}`);
    if (!data) return;
    el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:16px">
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Total Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.totalOrders}</div>
        <div class="u-sub">last 30 days</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div class="u-label">Single DC Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.singleDC}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">one-shot delivery</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.multiDC>0?'var(--warning)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Multi-DC Orders</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.multiDC}</div>
        <div class="u-sub">split deliveries</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Avg DCs per Order</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.avgDCsPerOrder}</div>
        <div class="u-sub">delivery challans</div>
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
            <th class="u-right">Ordered Qty</th>
            <th class="u-right">Delivered Qty</th>
            <th class="u-center">DC Count</th>
            <th>Completion Date</th>
            <th>Status</th>
          </tr></thead>
          <tbody>${(data.orders||[]).map(r=>{
            const pct = r.total_ordered>0 ? Math.round((r.total_delivered/r.total_ordered)*100) : 0;
            const complete = r.completion_date ? fmtDate(r.completion_date) : '—';
            const completionColor = r.completion_date ? '#059669' : (r.status==='CLOSED'?'var(--danger)':'var(--text-muted)');
            return `<tr>
              <td><b style="color:var(--navy);cursor:pointer" ${dataAct('viewOrderDrilldown', r.id)}>${r.id}</b></td>
              <td>${h(r.client_name)}</td>
              <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(r.created_at)}</td>
              <td style="text-align:right;font-weight:600">${r.total_ordered}</td>
              <td class="u-right">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
                  <div style="width:60px;height:5px;background:#e5e7eb;border-radius:3px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${pct===100?'var(--success-strong)':pct>50?'var(--amber)':'var(--red)'};border-radius:3px"></div>
                  </div>
                  <span style="font-weight:${r.total_delivered>0?700:400};color:${r.total_delivered>=r.total_ordered?'var(--success-strong)':r.total_delivered>0?'var(--warning)':'var(--text-muted)'}">${r.total_delivered}</span>
                  <span style="font-size:.7rem;color:var(--text-muted)">${pct}%</span>
                </div>
              </td>
              <td class="u-center">
                <span class="badge badge-${r.dc_count>2?'warning':r.dc_count>1?'info':'success'}"
                  style="cursor:pointer" ${dataAct('drillOrderDCs', r.id, r.id)}
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
        <div class="u-label">Total DCs</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.total_dcs}</div>
        <div class="u-sub">last 30 days</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
        <div class="u-label">POD Uploaded</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.kpis.pod_uploaded}</div>
        <div style="font-size:.75rem;color:var(--success);margin-top:6px">proof of delivery</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.missing_pod>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Missing POD</div>
        <div style="font-size:1.9rem;font-weight:700;color:${data.kpis.missing_pod>0?'var(--danger)':'var(--navy)'};line-height:1">${data.kpis.missing_pod}</div>
        <div style="font-size:.75rem;color:${data.kpis.missing_pod>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${data.kpis.missing_pod>0?'upload required':'all clear'}</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid ${data.kpis.missing_dc_scan>0?'var(--danger)':'var(--success)'};margin-bottom:0">
        <div class="u-label">Missing DC Scan</div>
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
          <td>${h(r.client_name)}</td>
          <td>${r.order_number}</td>
          <td>${r.delivered_qty||'—'}</td>
          <td>${r.delivery_executive||'—'}</td>
          <td>${r.pod_uploaded?'<span class="badge badge-success">&#10003; Yes</span>':'<span class="badge badge-danger">&#10007; Missing</span>'}</td>
          <td>${r.dc_scan_uploaded?'<span class="badge badge-success">&#10003; Yes</span>':'<span class="badge badge-danger">&#10007; Missing</span>'}</td>
          <td>${r.is_billed?'<span class="badge badge-success">Billed</span>':'<span class="badge badge-warning">Pending</span>'}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`).join('')||'<tr><td colspan="10" class="u-empty">No DCs</td></tr>'}
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
        <div class="u-label">Stockout Risk</div>
        <div style="font-size:1.9rem;font-weight:700;color:${stockout>0?'var(--danger)':'var(--navy)'};line-height:1">${stockout}</div>
        <div style="font-size:.75rem;color:${stockout>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">stock &lt; due qty</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
        <div class="u-label">Items Needing PO</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${data.length}</div>
        <div class="u-sub">to be procured</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
        <div class="u-label">Total Due Qty</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDue}</div>
        <div class="u-sub">units outstanding</div>
      </div>
      <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
        <div class="u-label">Total PO Qty Needed</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalSuggestedPO}</div>
        <div class="u-sub">suggested order</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <span>Procurement Demand Forecast</span>
        <button class="btn btn-primary btn-sm" ${dataAct('raiseAllPOsFromForecast')}>Raise POs for all</button>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Brand</th><th>Item</th><th>SKU</th><th>Due Qty</th><th>Current Stock</th><th>Suggested PO Qty</th><th>Vendor</th><th>Actions</th></tr></thead>
        <tbody>${data.sort((a,b)=>(b.due_qty||0)-(a.due_qty||0)).map(r=>`<tr style="${r.current_stock<(r.due_qty||0)?'background:#fff5f5':''}">
          <td>${h(r.brand_name)}</td>
          <td><b>${h(r.item_name)}</b></td>
          <td style="font-size:.78rem;color:var(--text-muted)">${r.sku}</td>
          <td><b class="u-danger">${r.due_qty}</b></td>
          <td><span style="color:${r.current_stock<r.due_qty?'var(--danger)':'var(--success)'}${r.current_stock<r.due_qty?';font-weight:700':''}">
            ${r.current_stock}
            ${r.current_stock<r.due_qty?'<span title="Stockout risk" style="margin-left:4px">⚠</span>':''}
          </span></td>
          <td><b style="color:var(--blue)">${r.suggested_procurement_qty}</b></td>
          <td>${r.vendor_name||'—'}</td>
          <td>
            <button class="btn btn-primary btn-sm" ${dataAct('raisePOFromForecast', r.sku, r.item_name, r.suggested_procurement_qty, r.vendor_id||'')}>Raise PO</button>
          </td>
        </tr>`).join('')||'<tr><td colspan="8" class="u-empty">No procurement required</td></tr>'}
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
    Complete: `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--success-soft-bg);color:var(--success-strong)">&#10003; Complete</span>`,
    Partial:  `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--amber-bg);color:var(--warning)">&#9651; Partial</span>`,
    Open:     `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--danger-soft-bg);color:var(--danger)">&#9679; Open</span>`,
  }[s] || `<span style="font-size:.7rem;font-weight:700;padding:3px 9px;border-radius:999px;background:#f3f4f6;color:var(--gray)">${s}</span>`);

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
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--amber);margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Partially Delivered</div>
      <div style="font-size:2rem;font-weight:800;color:var(--warning);line-height:1">${partial}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">balance pending</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${open>0?'var(--danger)':'var(--gray-light)'};margin-bottom:0">
      <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:5px">Not Started</div>
      <div style="font-size:2rem;font-weight:800;color:${open>0?'var(--danger)':'var(--navy)'};line-height:1">${open}</div>
      <div style="font-size:.72rem;color:var(--text-muted);margin-top:5px">no delivery yet</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${totalDue>0?'var(--danger)':'var(--gray-light)'};margin-bottom:0">
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
          <th class="u-center">Status</th>
          <th class="u-right">Lines</th>
          <th class="u-right">Ordered Qty</th>
          <th class="u-right">Delivered</th>
          <th class="u-right">Due Qty</th>
          <th class="u-right">Due Value</th>
          <th class="u-right">DCs</th>
          <th>Last Delivery</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${orders.map(o=>`<tr style="cursor:pointer;border-left:3px solid ${borderColor(o.status)}" ${dataAct('viewOrderDrilldown', o.id)} data-hover>
            <td><b style="color:var(--navy)">${o.id}</b></td>
            <td style="white-space:nowrap">${fmtDate(o.date)}</td>
            <td class="u-b600">${o.client}</td>
            <td style="color:var(--text-muted);font-size:.8rem">${o.location||'—'}</td>
            <td class="u-center">${statusBadgeOVD(o.status)}</td>
            <td class="u-right">
              <span style="font-weight:700">${o.line_count}</span>
              ${o.due_lines>0?`<span style="font-size:.7rem;color:var(--danger);margin-left:4px">(${o.due_lines} due)</span>`:''}
            </td>
            <td style="text-align:right;font-weight:600">${o.total_ordered}</td>
            <td style="text-align:right;color:${o.total_delivered>0?'var(--success-strong)':'var(--text-muted)'};font-weight:${o.total_delivered>0?700:400}">${o.total_delivered}</td>
            <td style="text-align:right;font-weight:700;color:${o.total_due>0?'var(--danger)':'var(--success)'}">${o.total_due}</td>
            <td style="text-align:right;color:${o.total_due_value>0?'var(--danger)':'var(--text-muted)'}">${o.total_due_value>0?fmt(o.total_due_value):'—'}</td>
            <td style="text-align:right;color:var(--text-muted)">${o.dc_count||0}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${o.last_delivery?fmtDate(o.last_delivery):'—'}</td>
            <td><button class="btn btn-secondary btn-sm" ${dataAct('viewOrderDrilldown', o.id)} data-stop>Details ›</button></td>
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
    <div style="background:var(--bg);border-radius:8px;padding:12px;border-top:2px solid var(--violet)">
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
        <th class="u-right">Lines</th>
        <th class="u-right">Qty Dispatched</th>
        <th class="u-right">Qty Delivered</th>
        <th>Driver / Vehicle</th>
      </tr></thead>
      <tbody>
        ${dcs.map((dc,i)=>{
          const sc = statusColor(dc.status);
          const pct = dc.total_qty_ordered>0 ? Math.round((dc.total_qty_delivered/dc.total_qty_ordered)*100) : 0;
          return `<tr>
            <td class="u-muted">${i+1}</td>
            <td><b style="color:var(--navy)">${dc.dc_number}</b></td>
            <td style="white-space:nowrap">${dc.dc_date ? fmtDate(dc.dc_date) : '—'}</td>
            <td style="white-space:nowrap;color:${dc.delivered_at?'var(--success-strong)':'var(--text-muted)'};font-weight:${dc.delivered_at?600:400}">${dc.delivered_at ? fmtDate(dc.delivered_at) : '—'}</td>
            <td><span style="font-size:.7rem;font-weight:700;padding:3px 8px;border-radius:999px;background:${sc}22;color:${sc}">${statusLabel(dc.status)}</span></td>
            <td style="text-align:right;font-weight:700">${dc.line_count||0}</td>
            <td style="text-align:right;font-weight:600">${dc.total_qty_ordered||0}</td>
            <td class="u-right">
              <span style="font-weight:700;color:${pct===100?'var(--success-strong)':pct>0?'var(--warning)':'var(--text-muted)'}">${dc.total_qty_delivered||0}</span>
              ${dc.total_qty_ordered>0?`<span style="font-size:.7rem;color:var(--text-muted);margin-left:4px">${pct}%</span>`:''}
            </td>
            <td style="font-size:.78rem;color:var(--text-muted)">${[dc.driver_name,dc.vehicle_no].filter(Boolean).join(' · ')||'—'}</td>
          </tr>`;
        }).join('')||'<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted)">No delivery challans found</td></tr>'}
      </tbody>
    </table>
  </div>`;

  openModal(`DC Breakdown — ${label}`, body,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
     <button class="btn btn-primary" ${dataActClose('viewOrderDrilldown', orderId)}>Full Line-Item View</button>`
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
        <td>${r.order_number}</td><td>${r.brand_name||'—'}</td><td>${h(r.item_name)}</td>
        <td>${r.ordered_qty}</td><td>${r.delivered_qty}</td>
        <td><b class="u-danger">${r.due_qty}</b></td>
        <td><span class="badge badge-${r.due_ageing_days>=15?'danger':r.due_ageing_days>=8?'warning':'info'}">${r.due_ageing_days}d</span></td>
      </tr>`).join('')||'<tr><td colspan="7" class="u-empty">No due items</td></tr>'}
      </tbody></table></div>`
  );
}

// Raise a PO for one forecast line via the sourcing engine, so it lands with
// the vendor's agreed price and MOQ (not the old unit_price:0 shortcut).
async function raisePOFromForecast(sku, name, qty) {
  const res = await api('/purchase-orders/from-demand', {
    method: 'POST',
    body: JSON.stringify({ items: [{ sku, qty }], source: 'forecast', notes: `Raised from Procurement Forecast — ${name}` })
  });
  if (!res) return;
  const pos = res.pos || [];
  if (!pos.length) {
    showToast((res.unsourced || []).length ? `No vendor resolved for ${name} — set a vendor/price first` : 'No PO created', 'error');
    return;
  }
  showToast(`PO ${pos[0].id} raised for ${name} — ${pos[0].vendor_name}`);
  navigate('procurement');
}

// Bulk: raise POs for the whole forecast. Uses the demand-sourcing engine which
// splits one PO per resolved vendor at agreed prices, applies the approval
// threshold, and notifies vendors — replacing the old no-op "RFQ" stub.
async function raiseAllPOsFromForecast() {
  const data = await api('/reports/procurement-forecast');
  if (!data) return;
  const items = (data || [])
    .filter(r => (r.suggested_procurement_qty || 0) > 0)
    .map(r => ({ sku: r.sku, qty: r.suggested_procurement_qty }));
  if (!items.length) { showToast('Nothing to procure — no suggested quantities.', 'info'); return; }
  const res = await api('/purchase-orders/from-demand', {
    method: 'POST',
    body: JSON.stringify({ items, source: 'forecast', notes: 'Raised from Procurement Forecast', skip_open_po: true })
  });
  if (!res) return;
  const pos = res.pos || [], uns = res.unsourced || [], skipped = res.skipped_open || [];
  const vendors = new Set(pos.map(p => p.vendor_id)).size;
  if (!pos.length && skipped.length) { showToast(`All items already have an open PO — nothing re-raised.`, 'info'); return; }
  showToast(pos.length
    ? `${pos.length} PO${pos.length === 1 ? '' : 's'} raised across ${vendors} vendor${vendors === 1 ? '' : 's'}${skipped.length ? ` · ${skipped.length} already on order` : ''}${uns.length ? ` · ${uns.length} no vendor` : ''}`
    : 'No POs created — items had no resolved vendor/price', pos.length ? 'success' : 'error');
  if (pos.length) navigate('procurement');
}

function exportFulfilCSV(tab) {
  showToast('CSV export initiated — data will download shortly', 'info');
}

/* ── Demand → PO with automatic vendor-split (G4) ──
   Consolidated demand is grouped by each item's sourcing vendor (primary →
   secondary, skipping inactive / un-onboarded / FSSAI-expired), and one PO is
   raised per vendor. Unsourceable items are surfaced, never silently lumped in. */
let _demandItems = [];
async function openDemandPO(items, source, title) {
  items = (items || []).filter(i => i.sku && i.qty > 0);
  if (!items.length) { showToast('No items with demand to procure', 'info'); return; }
  _demandItems = items;
  const q = items.map(i => `${i.sku}:${Math.round(i.qty)}`).join(',');
  const prev = await api(`/sourcing/preview?items=${encodeURIComponent(q)}`);
  if (!prev) return;
  const groups = prev.groups || [], unsourced = prev.unsourced || [];

  const groupsHtml = groups.map(g => `
    <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:10px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;background:var(--surface-2)">
        <b style="font-size:.86rem">🏭 ${h(g.vendor_name)}</b>
        <span style="font-size:.82rem;font-weight:700">${fmt(g.grand_total)} <span style="color:var(--text-muted);font-weight:400;font-size:.72rem">incl GST</span></span>
      </div>
      <table class="table" style="margin:0"><tbody>
        ${g.lines.map(l => `<tr>
          <td style="font-size:.82rem">${h(l.name)} <span class="u-subtiny">${h(l.sku)}</span></td>
          <td class="u-center" style="font-size:.82rem">${l.qty} × ${fmt(l.rate)}</td>
          <td class="u-right" style="font-size:.82rem">${fmt(l.total)}</td>
        </tr>`).join('')}
      </tbody></table>
    </div>`).join('');

  const unsourcedHtml = unsourced.length ? `
    <div style="border:1px dashed var(--danger);border-radius:10px;padding:10px 12px;margin-top:4px">
      <b style="font-size:.82rem;color:var(--danger)">⚠ ${unsourced.length} item(s) can't be sourced</b>
      ${unsourced.map(u => `<div class="u-subtiny">${h(u.name)} (${h(u.sku)}) — ${h(u.reason)}</div>`).join('')}
    </div>` : '';

  openModal(title, `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">Grouped by each item's sourcing vendor — one PO per vendor, GST per line.</div>
    ${groupsHtml || '<div class="u-subtiny" style="color:var(--text-muted)">No sourceable lines.</div>'}
    ${unsourcedHtml}`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     ${groups.length ? `<button class="btn btn-primary" ${dataAct('confirmDemandPO', source)}>Create ${groups.length} PO${groups.length > 1 ? 's' : ''}</button>` : ''}`);
}

async function confirmDemandPO(source) {
  const res = await api('/purchase-orders/from-demand', { method:'POST', body: JSON.stringify({ items: _demandItems, source }) });
  closeModal();
  if (!res) return;
  const pos = res.pos || [], u = (res.unsourced || []).length;
  const held = pos.filter(p => p.status === 'PENDING_APPROVAL').length;
  showToast(`Created ${pos.length} PO${pos.length === 1 ? '' : 's'}${held ? ` · ${held} awaiting approval` : ''}${u ? ` · ${u} unsourced` : ''}`);
  navigate('procurement');
}

// Brand Procurement → PO (Operations › Fulfilment › Brand Procurement tab)
async function initiateBrandPO(brand, _vendorId, from, to) {
  const items = await api(`/reports/brand-procurement-items?brand=${encodeURIComponent(brand)}&from=${from}&to=${to}`);
  if (!items || !items.length) { showToast('No shortfall items for this brand', 'error'); return; }
  openDemandPO(items.map(it => ({ sku: it.sku, qty: Math.round(it.shortfall_qty) })), 'brand', `Initiate PO — ${brand}`);
}

// Expand a brand to its product-level breakdown, with an editable suggested PO qty.
async function toggleBrandDrill(i, brand, from, to) {
  const row = document.getElementById('bd-' + i); if (!row) return;
  const caret = document.getElementById('bd-caret-' + i);
  if (row.style.display !== 'none') { row.style.display = 'none'; if (caret) caret.textContent = '▸'; return; }
  row.style.display = ''; if (caret) caret.textContent = '▾';
  const body = document.getElementById('bd-body-' + i); if (!body) return;
  body.innerHTML = '<div class="loading-state" style="padding:12px"><div class="spinner"></div></div>';
  const items = (await api(`/reports/brand-procurement-items?brand=${encodeURIComponent(brand)}&from=${from}&to=${to}`)) || [];
  APP._brandDrill = APP._brandDrill || {};
  APP._brandDrill[i] = { brand, from, to, items };
  if (!items.length) { body.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">No shortfall products for this brand.</div>'; return; }
  body.innerHTML = `
    <div style="font-weight:700;font-size:.82rem;color:var(--navy);margin-bottom:8px">Products — ${h(brand)} <span style="color:var(--text-muted);font-weight:400">(edit the PO qty before raising)</span></div>
    <div class="table-wrap"><table class="table" style="margin:0;background:#fff">
      <thead><tr><th>Product</th><th>SKU</th><th>Unit ₹</th><th>Shortfall</th><th style="width:120px">PO Qty</th></tr></thead>
      <tbody>${items.map((it,j)=>`<tr>
        <td><b>${h(it.name||it.sku)}</b></td>
        <td style="color:var(--text-muted);font-size:.8rem">${it.sku}</td>
        <td>${it.unit_price!=null?fmt(it.unit_price):'—'}</td>
        <td>${Math.round(it.shortfall_qty)}</td>
        <td><input type="number" min="0" step="1" value="${Math.round(it.shortfall_qty)}" id="bdq-${i}-${j}"
              style="width:100px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:.85rem" aria-label="PO quantity for ${h(it.name||it.sku)}"></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary btn-sm" ${dataAct('initiateBrandPOEdited', i)}>🛒 Initiate PO with these quantities</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('resetBrandDrillQty', i)}>↺ Reset to suggested</button>
    </div>`;
}
function resetBrandDrillQty(i) {
  const d = (APP._brandDrill||{})[i]; if (!d) return;
  d.items.forEach((it,j)=>{ const el = document.getElementById(`bdq-${i}-${j}`); if (el) el.value = Math.round(it.shortfall_qty); });
}
function initiateBrandPOEdited(i) {
  const d = (APP._brandDrill||{})[i]; if (!d) { showToast('Expand the brand first', 'error'); return; }
  const items = d.items.map((it,j)=>({ sku: it.sku, qty: parseInt((document.getElementById(`bdq-${i}-${j}`)||{}).value, 10) || 0 })).filter(x => x.qty > 0);
  if (!items.length) { showToast('Enter at least one quantity', 'error'); return; }
  openDemandPO(items, 'brand', `Initiate PO — ${d.brand}`);
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
      <div class="u-flex1">
        <div style="font-weight:700;font-size:.9rem;color:var(--navy)">${h(s.name)}
          ${!s.active?'<span style="font-size:.66rem;font-weight:700;background:var(--danger-soft-bg);color:var(--danger);border-radius:4px;padding:1px 5px;margin-left:5px">INACTIVE</span>':''}
        </div>
        ${s.phone?`<div style="font-size:.75rem;color:var(--text-muted);margin-top:2px"><a href="tel:${h(s.phone)}" style="color:inherit">📞 ${s.phone}</a></div>`:''}
        <div style="margin-top:5px">
          <span style="font-size:.68rem;font-weight:700;background:${rc}1a;color:${rc};border-radius:4px;padding:2px 7px">${STAFF_ROLE_LABEL[s.role]||s.role}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="btn btn-secondary btn-sm" ${dataAct('editStaffModal', s.id, s.name, s.phone||'', s.role)} style="font-size:.7rem;padding:3px 8px">Edit</button>
        <button class="btn btn-${s.active?'danger':'success'} btn-sm" ${dataAct('toggleStaff', s.id, s.active?0:1)} style="font-size:.7rem;padding:3px 8px">${s.active?'Disable':'Enable'}</button>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Staff</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${staff.length} total · ${activeStaff.length} active</div>
    </div>
    <button class="btn btn-primary" ${dataAct('addStaffModal')}>${iconPlus(14)} Add Staff</button>
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveStaff')}>Add</button>`);
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
    `<div class="form-group"><label>Full Name</label><input type="text" id="em-name" value="${h(name)}"></div>
     <div class="form-group"><label>Phone</label><input type="tel" id="em-phone" value="${phone}"></div>
     <div class="form-group"><label>Role</label>
       <select id="em-role">
         <option value="delivery_staff" ${role==='delivery_staff'?'selected':''}>Delivery Staff</option>
         <option value="order_entry" ${role==='order_entry'?'selected':''}>Order Entry</option>
         <option value="viewer" ${role==='viewer'?'selected':''}>Viewer</option>
       </select>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveStaffEdit', id)}>Save</button>`);
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
    `<button class="btn btn-secondary" ${dataAct('refreshDeliveryView', 'renderTodaysSchedule')}>&#8635; Refresh</button>`)}

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:14px;margin-bottom:16px">
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--navy);margin-bottom:0">
      <div class="u-label">Total DCs</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${totalDCs}</div>
      <div class="u-sub">${staffCount} staff on route</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div class="u-label">Delivered</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--success);line-height:1">${delivered}</div>
      <div style="font-size:.75rem;color:var(--success);margin-top:6px">${donePct}% complete</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--warning);margin-bottom:0">
      <div class="u-label">In Transit</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--warning);line-height:1">${inTransit}</div>
      <div class="u-sub">out for delivery</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
      <div class="u-label">Scheduled</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${pending}</div>
      <div class="u-sub">not yet started</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${unassigned.length>0?'var(--warning)':'var(--success)'};margin-bottom:0">
      <div class="u-label">Unassigned</div>
      <div style="font-size:1.9rem;font-weight:700;color:${unassigned.length>0?'var(--warning)':'var(--navy)'};line-height:1">${unassigned.length}</div>
      <div style="font-size:.75rem;color:${unassigned.length>0?'var(--warning)':'var(--text-muted)'};margin-top:6px">${unassigned.length?'needs staff':'all assigned'}</div>
    </div>
  </div>

  <div style="margin:12px 0 20px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
    <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:6px">
      <span class="u-b600">Overall Progress</span>
      <span style="color:${donePct===100?'var(--success)':donePct>60?'var(--warning)':'var(--text-muted)'}"><b>${delivered}</b> of ${totalDCs} delivered</span>
    </div>
    <div style="background:var(--border);height:10px;border-radius:5px;overflow:hidden">
      <div style="height:100%;width:${donePct}%;background:${donePct===100?'var(--success)':donePct>60?'var(--warning)':'var(--primary)'};border-radius:5px;transition:width .4s"></div>
    </div>
    <div style="display:flex;gap:16px;margin-top:8px;font-size:.76rem;color:var(--text-muted);flex-wrap:wrap">
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
        <div class="u-right">
          <div style="font-size:.75rem;color:var(--text-muted)">${staffDone}/${dcs.length} done</div>
          <div style="background:var(--border);height:4px;border-radius:2px;width:80px;margin-top:4px;overflow:hidden">
            <div style="height:100%;width:${staffPct}%;background:${staffPct===100?'var(--success)':'var(--primary)'};border-radius:2px"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="table table-cards">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Time</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${dcs.sort((a,b)=>(a.scheduled_time||'').localeCompare(b.scheduled_time||'')).map(dc=>`<tr ${dc.status==='DELIVERED'?'style="opacity:.7"':''}>
          <td class="card-title-cell" data-label="DC #"><b>${dc.dc_number||dc.id}</b></td>
          <td data-label="Client"><b>${dc.client_name||'—'}</b></td>
          <td data-label="Zone"><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td class="u-b600" data-label="Time">${dc.scheduled_time||'—'}</td>
          <td data-label="Items">${dc.total_qty||'—'}</td>
          <td data-label="Status">${statusBadge(dc.status)}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-success btn-sm" ${dataAct('markDelivered', dc.id)}>✓ Deliver</button>`:''}
            ${dc.status==='IN_TRANSIT'?`<button class="btn btn-danger btn-sm" ${dataAct('logReturnModal', dc.id)}>Return</button>`:''}
            <button class="btn btn-secondary btn-sm" ${dataAct('assignDCModal', dc.id, dc.dc_number||'', dc.scheduled_time||'')}>Edit</button>
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
      <table class="table table-cards">
        <thead><tr><th>DC #</th><th>Client</th><th>Zone</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${unassigned.map(dc=>`<tr>
          <td class="card-title-cell" data-label="DC #"><b>${dc.dc_number||dc.id}</b></td>
          <td data-label="Client"><b>${dc.client_name||'—'}</b></td>
          <td data-label="Zone"><span class="badge badge-secondary">${dc.zone||'—'}</span></td>
          <td data-label="Items">${dc.total_qty||'—'}</td>
          <td data-label="Status">${statusBadge(dc.status)}</td>
          <td><button class="btn btn-primary btn-sm" ${dataAct('assignDCModal', dc.id, dc.dc_number||'', dc.scheduled_time||'')}>Assign Staff</button></td>
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
    .map(s=>`<option value="${s.id}">${h(s.name)}</option>`).join('');
  openModal(`Assign & Schedule — DC ${dcId}`,
    `<div class="form-group"><label>DC Number</label><input type="text" id="dc-num" value="${currentDcNum}" placeholder="e.g. 702037"></div>
     <div class="form-group"><label>Assign Staff</label><select id="dc-staff"><option value="">— Unassigned —</option>${staffOpts}</select></div>
     <div class="form-group"><label>Scheduled Time</label><input type="time" id="dc-time" value="${currentTime}"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveAssignDC', dcId)}>Save</button>`);
}

async function saveAssignDC(dcId) {
  const res = await api(`/delivery-challans/${dcId}`, { method:'PATCH', body: JSON.stringify({
    dc_number:      document.getElementById('dc-num').value || null,
    staff_id:       document.getElementById('dc-staff').value || null,
    scheduled_time: document.getElementById('dc-time').value || null,
  })});
  closeModal();
  if (res) { showToast('DC updated'); refreshDeliveryView('renderTodaysSchedule'); }
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
    `${totalDue > 0 ? `<button class="btn btn-gold" ${dataAct('raisePOFromConsolidated')}>${iconPlus(14)} Raise PO from demand</button>` : ''}
     <button class="btn btn-secondary" ${dataAct('exportConsolidated')}>Export CSV</button>`)}
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
          <td><b>${h(r.item_name)}</b></td>
          <td>${r.total_ordered_qty}</td>
          <td style="color:var(--success)">${r.total_delivered_qty}</td>
          <td style="color:${r.total_due_qty>0?'var(--danger)':'var(--success)'};font-weight:700">${r.total_due_qty}</td>
          <td class="u-center">${r.client_count}</td>
          <td style="font-size:.78rem;color:var(--text-muted)">${r.clients||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--success)">✓ All items delivered — nothing pending</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function raisePOFromConsolidated() {
  const data = await api('/reports/consolidated-orders');
  if (!data) return;
  const items = data.filter(r => (r.total_due_qty || 0) > 0).map(r => ({ sku: r.sku, qty: r.total_due_qty }));
  openDemandPO(items, 'consolidated', 'Raise PO from consolidated demand');
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
    `<button class="btn btn-secondary" ${dataAct('exportDue')}>Export CSV</button>`)}
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
            <td><b>${h(r.client_name)}</b></td>
            <td><span class="badge badge-secondary">${r.zone||'—'}</span></td>
            <td style="font-size:.82rem">${r.order_id}</td>
            <td style="font-size:.82rem;color:var(--text-muted)">${fmtDate(r.order_date)}</td>
            <td>${h(r.item_name)}</td>
            <td class="u-muted">${r.ordered_qty}</td>
            <td style="color:var(--success)">${r.delivered_qty}</td>
            <td style="color:var(--danger);font-weight:700">${r.due_qty}</td>
            <td><span style="display:inline-block;min-width:36px;text-align:center;padding:2px 8px;border-radius:10px;font-size:.78rem;font-weight:700;background:${r.days_overdue>7?'var(--danger-bg)':r.days_overdue>3?'var(--amber-bg)':'var(--success-bg)'};color:${daysColor}">${r.days_overdue}d</span></td>
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
  const clientOpts = (clients||[]).map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('');
  const staffOpts = (staff||[]).filter(s=>s.active).map(s=>`<option value="${s.id}">${h(s.name)}</option>`).join('');

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
      <button class="btn btn-primary" ${dataAct('savePorterExpense')}>Log Trip</button>
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
          <td class="u-b600">${fmt(e.amount)}</td>
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

