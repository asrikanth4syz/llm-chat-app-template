/* ============================================================
   HSN → GST helpers
   GST is a fixed slab (0/5/12/18/28%) driven by the item's HSN
   code, never a free-typed number. The dropdown is read-only to
   the user; typing an HSN auto-selects the matching slab.
   ============================================================ */
const GST_SLABS = [0, 5, 12, 18, 28];
function gstSlabSelect(id, current) {
  const cur = current != null ? Number(current) : null;
  const opts = ['<option value="">— (no HSN match)</option>']
    .concat(GST_SLABS.map(r => `<option value="${r}"${cur===r?' selected':''}>${r}%</option>`))
    .join('');
  return `<select id="${id}">${opts}</select>`;
}
async function hsnAutoGst(hsnId, gstId) {
  const hsn = (document.getElementById(hsnId)?.value || '').trim();
  const hint = document.getElementById(hsnId + '-hint');
  const gstSel = document.getElementById(gstId);
  if (!hsn) { if (hint) hint.textContent=''; return; }
  try {
    const res = await api('/hsn-gst?hsn=' + encodeURIComponent(hsn));
    if (res && res.matched && gstSel) {
      gstSel.value = String(res.gst_rate);
      if (hint) { hint.textContent = `GST set to ${res.gst_rate}% for HSN ${hsn}.`; hint.style.color = 'var(--success-strong)'; }
    } else if (hint) {
      hint.textContent = `No GST slab mapped for HSN ${hsn} — pick one, or add the mapping in Settings → HSN → GST.`;
      hint.style.color = 'var(--warning-strong, #b45309)';
    }
  } catch { /* offline / non-fatal */ }
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
        <div class="card" style="padding:16px 18px;border-top:3px solid ${unbilled.length>0?'var(--warning)':'var(--success)'};margin-bottom:0">
          <div class="u-label">Pending Billing</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${unbilled.length}</div>
          <div style="font-size:.75rem;color:${unbilled.length>0?'var(--warning)':'var(--text-muted)'};margin-top:6px">${fmt(pendingValue)} outstanding</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid ${critical.length>0?'var(--danger)':'var(--success)'};margin-bottom:0">
          <div class="u-label">Critical (16+ days)</div>
          <div style="font-size:1.9rem;font-weight:700;color:${critical.length>0?'var(--danger)':'var(--navy)'};line-height:1">${critical.length}</div>
          <div style="font-size:.75rem;color:${critical.length>0?'var(--danger)':'var(--text-muted)'};margin-top:6px">${critical.length>0?fmt(criticalValue)+' at risk':'All within 15 days'}</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0">
          <div class="u-label">Billed Today</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${billedToday.length}</div>
          <div class="u-sub">${fmt(billedToday.reduce((s,d)=>s+(d.order_value||0),0))}</div>
        </div>
        <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
          <div class="u-label">Billed This Month</div>
          <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${billedThisMonth.length}</div>
          <div style="font-size:.75rem;color:var(--success);margin-top:6px">${fmt(billedMonthValue)}</div>
        </div>
      </div>
      ${critical.length>0?`<div style="background:#fef3cd;border:1px solid var(--amber);border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:.82rem;color:var(--amber-text);display:flex;gap:10px;align-items:center"><span style="font-size:1.1rem">⚠️</span><span><strong>${critical.length}</strong> DC${critical.length>1?'s':''} unbilled for over 16 days — <strong>${fmt(criticalValue)}</strong> at risk of delayed payment.</span></div>`:''}
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
              <td><button class="btn btn-gold btn-sm" ${dataAct('billDC', dc.id)}>Bill DC</button></td>
            </tr>`).join('')||'<tr><td colspan="7" class="u-empty">All DCs are billed</td></tr>'}
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
            </tr>`).join('')||'<tr><td colspan="6" class="u-empty">None yet</td></tr>'}
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
            <div class="u-label">${b.label}</div>
            <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${items.length}</div>
            <div style="font-size:.75rem;color:${valColor};margin-top:6px">${fmt(items.reduce((s,d)=>s+(d.order_value||0),0))}</div>
          </div>`;
        }).join('')}
      </div>
      ${overdue.length ? `<div style="background:var(--danger-bg);border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:.83rem;color:#b91c1c">
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
              <td><b>${h(c.name)}</b></td>
              <td>${c.items.length}</td>
              <td style="color:var(--success)">${fmt(b0)}</td>
              <td style="color:${b30>0?'var(--warning)':'var(--text-muted)'}">${fmt(b30)}</td>
              <td style="color:${b60>0?'var(--danger)':'var(--text-muted)'}">${fmt(b60)}</td>
              <td style="color:${b90>0?'var(--danger)':'var(--text-muted)'}"><b>${fmt(b90)}</b></td>
              <td><b>${fmt(total)}</b></td>
              <td><span class="badge badge-${riskCls}">${risk}</span></td>
            </tr>`;
          }).join('') || '<tr><td colspan="8" class="u-empty">No billed invoices</td></tr>'}
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
          }).join('') || '<tr><td colspan="7" class="u-empty">No billed DCs</td></tr>'}
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
    ${FINANCE_TABS.map(t=>`<button class="tab-btn${APP._financeTab===t.id?' active':''}" ${dataAct('switchFinanceTab', t.id)}>${t.label}</button>`).join('')}
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
        <div class="u-label">${b.label}</div>
        <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${items.length}</div>
        <div style="font-size:.75rem;color:${items.length?bc:'var(--text-muted)'};margin-top:6px">${fmt(items.reduce((s,p)=>s+(p.grand_total||0),0))}</div>
      </div>`;
    }).join(''); })()}
  </div>
  ${overdue.length ? `<div style="background:var(--danger-bg);border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:.83rem;color:#b91c1c">
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
          <td><b>${h(v.name)}</b></td>
          <td>${v.items.length}</td>
          <td style="color:var(--success)">${fmt(a0)}</td>
          <td style="color:${a15>0?'var(--warning)':'var(--text-muted)'}">${fmt(a15)}</td>
          <td style="color:${a30>0?'var(--danger)':'var(--text-muted)'}">${fmt(a30)}</td>
          <td style="color:${a90>0?'var(--danger)':'var(--text-muted)'}"><b>${fmt(a90)}</b></td>
          <td><b>${fmt(total)}</b></td>
          <td><span class="badge badge-${riskCls}">${risk}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="u-empty">No open POs</td></tr>'}
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
      }).join('') || '<tr><td colspan="6" class="u-empty">No open POs</td></tr>'}
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
      <div class="u-label">Avg Margin</div>
      <div style="font-size:1.9rem;font-weight:700;color:${marginColor(overallMargin)};line-height:1">${overallMargin}%</div>
      <div class="u-sub">${priced.length} priced SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--success);margin-bottom:0">
      <div class="u-label">High Margin (≥30%)</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${highMargin}</div>
      <div style="font-size:.75rem;color:var(--success);margin-top:6px">SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${lowMargin>0?'var(--warning)':'var(--success)'};margin-bottom:0">
      <div class="u-label">Low Margin (&lt;15%)</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--navy);line-height:1">${lowMargin}</div>
      <div style="font-size:.75rem;color:${lowMargin>0?'var(--warning)':'var(--text-muted)'};margin-top:6px">SKUs</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid ${negative>0?'var(--danger)':'var(--success)'};margin-bottom:0">
      <div class="u-label">Below Cost</div>
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
          <td style="color:${gp>=0?'#10b981':'var(--red)'};font-weight:700">${fmt(gp)}</td>
          <td><span class="badge badge-${hCls}">${health}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="7" class="u-empty">No priced items</td></tr>'}
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
            <td><b>${h(i.name)}</b></td><td>${i.category||'—'}</td>
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
            <td><b>${h(i.name)}</b></td><td>${i.category||'—'}</td>
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('confirmBillDC', id)}>Confirm Billing</button>`);
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

/* ── Bulk barcode / EAN entry — populate codes fast for the scanner ──────── */
async function bulkBarcodeModal() {
  const inv = await api('/inventory');
  if (!inv) return;
  const items = [...inv].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  const withBc = items.filter(i=>i.barcode).length;
  const rows = items.map(it => `
    <tr class="bc-row" data-bc-text="${h((it.sku+' '+(it.name||'')).toLowerCase())}">
      <td style="font-size:.82rem"><b>${h(it.name||it.sku)}</b></td>
      <td style="font-family:monospace;font-size:.78rem;color:var(--text-muted)">${h(it.sku)}</td>
      <td><input type="text" class="bc-input" data-bc-sku="${h(it.sku)}" data-bc-orig="${h(it.barcode||'')}"
        value="${h(it.barcode||'')}" placeholder="scan or type EAN/UPC"
        autocomplete="off" spellcheck="false"
        style="width:100%;min-width:150px;padding:6px 9px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.82rem"></td>
    </tr>`).join('');
  openModal('Bulk Barcodes', `
    <p style="color:var(--text-muted);margin-bottom:12px;font-size:.9rem">
      Add or update each item's barcode / EAN so the scanner can match it during pick &amp; receive.
      <b>${withBc}</b> of <b>${items.length}</b> items have a code. Click a field and scan with a barcode gun, type it, or paste a list below.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <input type="text" id="bc-search" class="filter-input" placeholder="Filter by name or SKU…" ${dataInputEl('bulkBarcodeFilter')} style="flex:1 1 220px">
      <details style="flex:1 1 260px">
        <summary style="cursor:pointer;font-size:.82rem;color:var(--primary);font-weight:600">Paste a list (SKU,barcode per line)</summary>
        <div style="margin-top:8px">
          <textarea id="bc-csv" rows="4" placeholder="SKU001,8901234567890&#10;100548,8904567890123" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-family:monospace;font-size:.8rem"></textarea>
          <button class="btn btn-secondary btn-sm" ${dataAct('applyBarcodeCsv')} style="margin-top:6px">Apply to fields</button>
        </div>
      </details>
    </div>
    <div style="max-height:none;overflow-x:auto">
      <table class="table" style="margin:0">
        <thead><tr><th>Item</th><th>SKU</th><th style="width:38%">Barcode / EAN</th></tr></thead>
        <tbody id="bc-tbody">${rows}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveBulkBarcodes')}>Save Barcodes</button>`);
  enableModalExpand();
}

function bulkBarcodeFilter(el) {
  const q = (el.value||'').trim().toLowerCase();
  document.querySelectorAll('#bc-tbody .bc-row').forEach(tr => {
    tr.style.display = !q || (tr.dataset.bcText||'').includes(q) ? '' : 'none';
  });
}

function applyBarcodeCsv() {
  const raw = document.getElementById('bc-csv')?.value || '';
  const map = {};
  raw.split(/\r?\n/).forEach(line => {
    const parts = line.split(/[,\t;]/).map(s=>s.trim());
    if (parts.length >= 2 && parts[0]) map[parts[0].toUpperCase()] = parts.slice(1).join('').trim();
  });
  let matched = 0, unmatched = 0;
  document.querySelectorAll('.bc-input').forEach(inp => {
    const key = String(inp.dataset.bcSku||'').toUpperCase();
    if (key in map) { inp.value = map[key]; matched++; }
  });
  Object.keys(map).forEach(k => {
    if (!document.querySelector(`.bc-input[data-bc-sku="${cssAttr(k)}" i]`)) unmatched++;
  });
  showToast(`Applied ${matched} barcode${matched===1?'':'s'}${unmatched?` · ${unmatched} SKU(s) not found`:''}`, matched?'success':'warning');
}

async function saveBulkBarcodes() {
  const changed = Array.from(document.querySelectorAll('.bc-input'))
    .filter(inp => (inp.value||'').trim() !== (inp.dataset.bcOrig||'').trim())
    .map(inp => ({ sku: inp.dataset.bcSku, barcode: (inp.value||'').trim() }));
  if (!changed.length) { showToast('No barcode changes to save', 'info'); return; }
  const res = await api('/inventory/barcodes', { method:'POST', body: JSON.stringify({ items: changed }) });
  if (!res) return;
  closeModal();
  const unknownNote = res.unknown && res.unknown.length ? ` · ${res.unknown.length} SKU(s) skipped` : '';
  showToast(`Saved ${res.updated} barcode${res.updated===1?'':'s'}${unknownNote}`);
  APP._barcodeMap = null;   // invalidate the scanner's cached map
  navigate('inventory');
}

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
  APP._invShowAll = false;

  const cats = ['All', ...[...new Set(inv.map(i=>i.category))].sort()];
  // "Below reorder" counts only SKUs actually in use (ever ordered/consumed) —
  // never-used catalogue rows would otherwise dominate the count.
  const lowStock = inv.filter(i => i.stock <= i.reorder_level && i.used);
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

  // Render window: cap DOM rows for large catalogues; KPIs, filters, search,
  // sort and bulk-select all still operate over the full filtered set.
  const INV_ROW_CAP = 200;

  function renderInvBody() {
    const filtered = getFiltered();
    const capped = !APP._invShowAll && filtered.length > INV_ROW_CAP;
    const shown = capped ? filtered.slice(0, INV_ROW_CAP) : filtered;
    let html = invTableRows(shown);
    if (filtered.length === 0) {
      html = `<tr><td colspan="14" style="padding:28px;text-align:center;color:var(--text-muted)">No items match your filters.</td></tr>`;
    } else if (capped) {
      html += `<tr><td colspan="14" style="padding:12px 16px;text-align:center;background:var(--surface-2);color:var(--text-muted);font-size:.82rem">
        Showing first <b>${INV_ROW_CAP}</b> of <b>${filtered.length}</b> items — refine your search or category to narrow down,
        or <button class="btn btn-secondary btn-sm" style="margin-left:6px" ${dataAct('invShowAll')}>Show all ${filtered.length}</button>
      </td></tr>`;
    }
    document.getElementById('inv-tbody').innerHTML = html;
  }

  function invTableRows(items) {
    return items.map(item => {
      const reserved  = item.reserved || 0;
      const available = Math.max(0, item.stock - reserved);
      const pctStock  = Math.round((item.stock / (item.max_stock||1)) * 100);
      const color     = item.stock <= item.reorder_level ? 'var(--danger)' : item.stock <= item.reorder_level*1.5 ? 'var(--warning)' : 'var(--success)';
      const safeName  = item.name; // raw — dataAct() handles escaping for delegated handlers
      const stPill    = item.stock === 0
        ? '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--danger-soft-bg);color:var(--danger)">Critical</span>'
        : item.stock <= item.reorder_level
        ? '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--amber-bg);color:var(--warning)">Warning</span>'
        : '<span style="font-size:.7rem;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--success-soft-bg);color:var(--success-strong)">Active</span>';
      const checked   = APP._invSelected.has(item.sku);
      return `
      <tr style="cursor:pointer${item.is_critical?';border-left:3px solid var(--danger)':''}${checked?';background:#f0fdfa':''}" ${dataActEl('toggleInvDetail', item.sku)}>
        <td ${dataAct('_noop')} data-stop style="width:34px;text-align:center">
          <input type="checkbox" ${checked?'checked':''} ${dataChangeEl('invToggleSelect', item.sku)} style="width:15px;height:15px;cursor:pointer;accent-color:var(--primary)">
        </td>
        <td><span style="font-size:1.1rem">${item.emoji||'📦'}</span> <b style="font-size:.82rem">${item.sku}</b>${item.is_critical?'<span style="margin-left:4px;background:var(--danger);color:#fff;border-radius:4px;padding:1px 5px;font-size:.65rem;font-weight:800;vertical-align:middle">CRITICAL</span>':''}</td>
        <td><b>${h(item.name)}</b>${item.brand?`<div class="u-muted-xs">${h(item.brand)}</div>`:''}</td>
        <td style="font-size:.82rem">${item.category}${item.sub_category?`<div style="font-size:.68rem;font-weight:600;color:${item.sub_category==='Healthy'?'var(--success-strong)':'var(--gray)'};margin-top:1px">${item.sub_category}</div>`:''}</td>
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
        <td ${dataAct('_noop')} data-stop>
          <button class="btn btn-secondary btn-sm" ${dataAct('editInventoryItem', item.sku)}>Edit</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('viewStockHistory', item.sku, safeName)}>History</button>
          <button class="btn btn-primary btn-sm" ${dataAct('reorderItem', item.sku, safeName, item.unit_price, item.vendor_id||'')}>PO</button>
          <button class="btn btn-sm" style="background:${item.is_critical?'var(--danger-bg)':'#f3f4f6'};color:${item.is_critical?'var(--danger)':'var(--gray)'};border:1px solid ${item.is_critical?'#fca5a5':'var(--gray-light)'};font-size:.72rem" ${dataActEl('toggleCritical', item.sku)}>${item.is_critical?'🔴 Critical':'⚫ Mark Critical'}</button>
        </td>
      </tr>
      <tr id="inv-detail-${item.sku}" style="display:none;background:#f8faff"><td colspan="14" style="padding:0"></td></tr>`;
    }).join('');
  }

  el.innerHTML = `
  ${pageHeader('Inventory', `${inv.length} SKUs`,
    `${['super_admin','ops_admin','ops_manager','procurement_manager'].includes(APP.user?.role)
        ? `<button class="btn btn-secondary" ${dataAct('bulkBarcodeModal')} title="Add or update barcodes / EANs in bulk for the scanner">▥ Bulk Barcodes</button>` : ''}
     ${['super_admin','ops_admin','finance_admin','procurement_manager'].includes(APP.user?.role)
        ? `<button class="btn btn-secondary" ${dataAct('recalcGstFromHsn')} title="Recompute every item's GST slab from its HSN code">↻ Recalc GST from HSN</button>` : ''}
     <button class="btn btn-secondary" ${dataAct('renderAddItem')}>${iconPlus(14)} Add Item</button>`)}

  <!-- KPI tiles — icon-chip style, responsive -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:16px">
    ${statCard('📦','#3b82f6','#eff6ff', inv.length, 'Active Items')}
    ${statCard('↕️','#d97706','#fffbeb', lowStock.length, 'Below Reorder')}
    ${statCard('⏱','#dc2626','#fef2f2', outOfStock.length, 'Zero Stock')}
    ${statCard('₹','#059669','#ecfdf5', fmt(inv.reduce((s,i)=>s+i.stock*i.unit_price,0)), 'Stock Value')}
  </div>

  ${criticalLow.length ? `
  <div style="background:var(--danger-bg);border:1.5px solid #fca5a5;border-radius:10px;padding:14px 18px;margin-bottom:14px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap">
    <div>
      <div style="font-weight:800;color:var(--danger);font-size:.92rem;margin-bottom:4px">🔴 ${criticalLow.length} Critical Item${criticalLow.length>1?'s':''} Need Reorder</div>
      <div style="font-size:.8rem;color:#991b1b">${criticalLow.slice(0,4).map(i=>`<b>${h(i.name)}</b> (${i.stock} left)`).join(' · ')}${criticalLow.length>4?` +${criticalLow.length-4} more`:''}</div>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button class="btn btn-secondary btn-sm" ${dataAct('goCriticalStockReport')}>View Report</button>
      <button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none" ${dataActEl('sendCriticalAlerts')}>📧 Send Alert Email</button>
    </div>
  </div>` : ''}
  ${lowStock.length ? `<div class="alert alert-warning" style="margin-bottom:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span style="flex:1;min-width:220px">⚠️ <b>${lowStock.length}</b> SKU(s) below reorder level: ${lowStock.slice(0,5).map(i=>`<b>${h(i.name)}</b>`).join(', ')}${lowStock.length>5?` +${lowStock.length-5} more`:''}</span>
    ${['super_admin','ops_admin','procurement_manager'].includes(APP.user?.role) ? `<button class="btn btn-primary btn-sm" style="flex-shrink:0" ${dataAct('raiseAllReorderPOs')}>Raise POs for all</button>` : ''}
  </div>` : ''}

  <!-- Search + filter -->
  <div style="background:#fff;border-radius:12px;padding:14px 18px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:14px">
    <input type="search" id="inv-search" placeholder="🔍  Search by name, SKU or brand…"
      style="width:100%;padding:9px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.88rem;outline:none;box-sizing:border-box"
      ${dataInputEl('invSearch')} data-focus>
    <div id="inv-filter-bar" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px">
      ${cats.map(c=>{
        const active = APP._invFilter===c;
        return '<button data-inv-cat="' + c + '" ' + dataAct('invFilterCat', c) + ' style="padding:4px 12px;border-radius:20px;border:1.5px solid ' + (active?'var(--blue)':'var(--border)') + ';background:' + (active?'var(--blue)':'#fff') + ';color:' + (active?'#fff':'var(--navy)') + ';font-size:.8rem;cursor:pointer;font-weight:' + (active?700:400) + ';transition:all .15s">' + c + '</button>';
      }).join('')}
      <div id="inv-subcat-pills" style="display:flex;align-items:center;gap:6px"></div>
    </div>
  </div>

  <!-- Bulk action bar (appears when rows selected) -->
  <div id="inv-bulk-bar" style="display:none;background:var(--primary);border-radius:10px;padding:10px 16px;margin-bottom:10px;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 2px 10px rgba(13,148,136,.3)">
    <span id="inv-bulk-count" style="color:#fff;font-weight:800;font-size:.84rem"></span>
    <div style="flex:1"></div>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" ${dataAct('invBulkModal', 'price')}>✏️ Update Price</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" ${dataAct('invBulkModal', 'category')}>📂 Change Category</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" ${dataAct('invBulkModal', 'subcategory')}>🏷️ Sub-Category</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" ${dataAct('invBulkModal', 'stock')}>📦 Adjust Stock</button>
    <button class="btn btn-sm" style="background:rgba(255,255,255,.92);color:var(--primary);border:none;font-weight:700" ${dataAct('invBulkModal', 'reorder')}>🎯 Set Reorder Point</button>
    <button class="btn btn-sm" style="background:#b91c1c;color:#fff;border:none;font-weight:700" ${dataAct('invClearSelection')}>✕ Cancel</button>
  </div>

  <!-- Table — click row to expand 4-section detail -->
  <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);overflow:hidden">
    <div style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:.76rem;color:var(--text-muted)">Click any row to see full details · Select rows with checkboxes for bulk actions · Click column headers to sort</div>
    <div class="table-wrap">
      <table class="table" id="inv-table" style="margin:0">
        <thead><tr>
          <th style="width:34px;text-align:center"><input type="checkbox" id="inv-select-all" ${dataChangeEl('invSelectAll')} style="width:15px;height:15px;cursor:pointer;accent-color:var(--primary)"></th>
          ${[['sku','SKU'],['name','Item'],['category','Category'],[null,'UOM'],['unit_price','Price'],['mrp','MRP'],['stock','Stock'],['reserved','Reserved'],[null,'Available'],[null,'Level'],[null,'Status'],[null,'Vendor'],[null,'Actions']]
            .map(([col,label]) => col
              ? `<th style="cursor:pointer;user-select:none;white-space:nowrap" ${dataAct('invSortBy', col)}>${label} <span data-sort-arrow="${col}" style="font-size:.65rem;opacity:.5">⇅</span></th>`
              : `<th>${label}</th>`).join('')}
        </tr></thead>
        <tbody id="inv-tbody"></tbody>
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
          ? (s === 'Healthy' ? 'background:#d1fae5;color:var(--success-strong);border-color:var(--success-strong);font-weight:700'
                              : 'background:var(--blue);color:#fff;border-color:var(--blue);font-weight:700')
          : 'background:#fff;color:#374151;border-color:#d1d5db;font-weight:400');
      btn.onclick = function() { invFilterSubCat(s); };
      container.appendChild(btn);
    });
  })();

  window.refreshInvTable = function() {
    renderInvBody();
    updateInvBulkBar();
  };
  renderInvBody(); // initial paint

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
    if (row) row.style.background = cb.checked ? '#f0fdfa' : '';
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
      `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
       <button class="btn btn-primary" ${dataAct('invBulkApply', d.field, d.type)}>Apply to ${n} item${n>1?'s':''}</button>`);
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
    APP._invShowAll = false;
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
    APP._invShowAll = false;
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
    <span class="u-muted">${label}</span>
    <span style="font-weight:600;text-align:right;max-width:60%">${value}</span>
  </div>`;
}

// Build the 4-section detail panel on demand (lazy — keeps the table light)
function invDetailHTML(item) {
  const safeName = (item.name||'').replace(/'/g,"\\'");
  return `<div style="padding:16px 20px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;border-top:2px solid var(--primary)">
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
      <div>
        <div style="font-size:.72rem;font-weight:800;color:var(--purple);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Packing Details</div>
        ${invDetailRow('UOM', item.uom||'unit')}
        ${invDetailRow('Pack Size', item.pack_size||1)}
        ${invDetailRow('Units / Case', item.units_per_case||1)}
        ${invDetailRow('Weight (grams)', item.weight_grams||'—')}
        ${invDetailRow('HSN Code', item.hsn_code||'—')}
        ${invDetailRow('Expiry Date', item.expiry_date||'—')}
        ${invDetailRow('Location', item.inv_location||'instock')}
      </div>
      <div>
        <div style="font-size:.72rem;font-weight:800;color:var(--success-strong);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Pricing</div>
        ${invDetailRow('Unit Price (Selling)', fmt(item.unit_price))}
        ${invDetailRow('MRP', item.mrp?fmt(item.mrp):'—')}
        ${invDetailRow('Cost Excl GST', item.cost_excl_gst?fmt(item.cost_excl_gst):'—')}
        ${invDetailRow('GST Rate', (item.gst_rate!=null?item.gst_rate:'—')+'%')}
        ${invDetailRow('Margin %', item.margin_pct?item.margin_pct+'%':'—')}
        ${invDetailRow('Amazon URL', item.amazon_url?`<a href="${item.amazon_url}" target="_blank" style="color:var(--blue);font-size:.74rem">View</a>`:'—')}
        ${invDetailRow('Flipkart URL', item.flipkart_url?`<a href="${item.flipkart_url}" target="_blank" style="color:var(--blue);font-size:.74rem">View</a>`:'—')}
      </div>
      <div>
        <div style="font-size:.72rem;font-weight:800;color:var(--warning);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Vendor Information</div>
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
      <button class="btn btn-primary btn-sm" ${dataAct('editInventoryItem', item.sku)}>Edit All Fields</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('viewStockHistory', item.sku, safeName)}>Stock History</button>
      <button class="btn btn-gold btn-sm" ${dataAct('reorderItem', item.sku, safeName, item.unit_price, item.vendor_id||'')}>Raise PO</button>
    </div>`;
}

function toggleInvDetail(sku, row) {
  const detailRow = document.getElementById('inv-detail-' + sku);
  if (!detailRow) return;
  const isOpen = detailRow.style.display !== 'none';
  // close all open detail rows
  document.querySelectorAll('[id^="inv-detail-"]').forEach(r => { r.style.display = 'none'; });
  if (!isOpen) {
    // Build the panel the first time it's opened
    const cell = detailRow.firstElementChild;
    if (cell && !cell.innerHTML) {
      const item = (typeof _invCache !== 'undefined' && _invCache[sku]) ? _invCache[sku] : null;
      if (item) cell.innerHTML = invDetailHTML(item);
    }
    detailRow.style.display = '';
  }
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
  </tr>`).join('') : '<tr><td colspan="6" class="u-empty">No movements recorded</td></tr>';
  openModal(`Stock History — ${itemName}`,
    `<div class="table-wrap" style="max-height:50vh;overflow-y:auto">
      <table class="table">
        <thead><tr><th>Date</th><th>Type</th><th>Qty Change</th><th>Reference</th><th>Note</th><th>By</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}

async function editInventoryItem(sku) {
  const item = _invCache[sku];
  if (!item) return;
  const vendors = await api('/vendors') || [];
  const vendorOpts = vendors.map(v => `<option value="${v.id}" ${v.id===item.vendor_id?'selected':''}>${h(v.name)}</option>`).join('');
  const vendor2Opts = vendors.map(v => `<option value="${v.id}" ${v.id===item.secondary_vendor_id?'selected':''}>${h(v.name)}</option>`).join('');
  // Categories: everything actually in the catalogue + standard defaults +
  // this item's own value — so no existing category can ever go missing (or
  // get silently overwritten because it wasn't in a hardcoded list).
  const liveCats = Object.values(_invCache||{}).map(i => i.category).filter(Boolean);
  const cats = [...new Set([...liveCats, 'Beverages','Snacks','Hygiene','Stationery','Office','Dairy','Fruits & Vegetables','Cleaning','Personal Care','DryFruits','Other', item.category].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const catOpts = cats.map(c => `<option value="${h(c)}" ${c===item.category?'selected':''}>${h(c)}</option>`).join('');
  const liveSubs = Object.values(_invCache||{}).map(i => i.sub_category).filter(Boolean);
  const subs = [...new Set([...liveSubs, 'Normal','Healthy', item.sub_category].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const subOpts = subs.map(s => `<option value="${h(s)}" ${s===(item.sub_category||'Normal')?'selected':''}>${h(s)}</option>`).join('');
  const uoms = ['unit','piece','pack','case','kg','gram','litre','ml','dozen','box','bag','roll','sheet'];
  const uomOpts = uoms.map(u => `<option value="${u}" ${(item.uom||'unit')===u?'selected':''}>${u}</option>`).join('');

  openModal(`Edit Item — ${sku}`,
    `<!-- Section tabs -->
    <div style="display:flex;gap:6px;border-bottom:2px solid var(--border);margin-bottom:16px;padding-bottom:10px">
      ${[['prod','Product ID','#1F3864'],['pack','Packing Details','#7c3aed'],['price','Pricing','#059669'],['vendor','Vendor Info','#d97706']].map(([id,label,color])=>
        `<button class="ei-tab" data-tab="${id}" data-color="${color}" ${dataAct('switchEITab', id)} style="padding:6px 14px;border:none;border-radius:20px;background:transparent;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--text-muted);transition:all .18s;white-space:nowrap">${label}</button>`
      ).join('')}
    </div>

    <!-- Product Identification -->
    <div id="ei-tab-prod" class="ei-section">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group" style="grid-column:1/-1"><label>Item Name *</label><input type="text" id="ei-name" value="${item.name.replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>Brand</label><input type="text" id="ei-brand" value="${item.brand||''}"></div>
        <div class="form-group"><label>Category</label>
          <select id="ei-cat" ${dataChange('eiNewToggle', 'cat')}>${catOpts}<option value="__new__">➕ Add new category…</option></select>
          <input type="text" id="ei-cat-new" placeholder="Type the new category name" style="display:none;margin-top:6px"></div>
        <div class="form-group"><label>Sub-Category</label>
          <select id="ei-subcat" ${dataChange('eiNewToggle', 'subcat')}>${subOpts}<option value="__new__">➕ Add new sub-category…</option></select>
          <input type="text" id="ei-subcat-new" placeholder="Type the new sub-category name" style="display:none;margin-top:6px"></div>
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
        <div class="form-group"><label>HSN Code</label><input type="text" id="ei-hsn" value="${item.hsn_code||''}" oninput="hsnAutoGst('ei-hsn','ei-gst')"><small id="ei-hsn-hint" style="color:var(--muted);font-size:.7rem"></small></div>
        <div class="form-group"><label>Storage Location</label><input type="text" id="ei-location" value="${item.inv_location||'instock'}"></div>
      </div>
    </div>

    <!-- Pricing -->
    <div id="ei-tab-price" class="ei-section" style="display:none">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label>Unit Price / Selling Price (₹)</label><input type="number" id="ei-price" value="${item.unit_price}" min="0" step="0.01"></div>
        <div class="form-group"><label>MRP (₹)</label><input type="number" id="ei-mrp" value="${item.mrp||0}" min="0" step="0.01"></div>
        <div class="form-group"><label>Cost Excl GST (₹)</label><input type="number" id="ei-cost" value="${item.cost_excl_gst||0}" min="0" step="0.01"></div>
        <div class="form-group"><label>GST Rate (%) <span style="color:var(--muted);font-weight:400">— set by HSN</span></label>${gstSlabSelect('ei-gst', item.gst_rate)}</div>
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
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:2px 10px" ${dataAct('toggleAddVendorInline')}>+ Add New Vendor</button>
          </label>
          <select id="ei-vendor"><option value="">— None —</option>${vendorOpts}</select>
          <!-- Inline new-vendor form -->
          <div id="ei-new-vendor-form" style="display:none;margin-top:12px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:.76rem;font-weight:700;color:var(--warning);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">New Vendor Details</div>
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
              <button type="button" class="btn btn-primary btn-sm" ${dataAct('createVendorInline')}>Create & Select</button>
              <button type="button" class="btn btn-secondary btn-sm" ${dataAct('toggleAddVendorInline')}>Cancel</button>
            </div>
          </div>
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="display:flex;justify-content:space-between;align-items:center">
            Secondary Vendor <span style="font-size:.72rem;color:var(--text-muted);font-weight:400">(fallback supplier)</span>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:2px 10px" ${dataAct('toggleAddVendorInline', '2')}>+ Add New Vendor</button>
          </label>
          <select id="ei-vendor2"><option value="">— None —</option>${vendor2Opts}</select>
          <!-- Inline new-vendor form for secondary -->
          <div id="ei-new-vendor-form-2" style="display:none;margin-top:12px;background:var(--bg,var(--surface-2));border:1px solid var(--border);border-radius:8px;padding:14px">
            <div style="font-size:.76rem;font-weight:700;color:var(--purple);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em">New Secondary Vendor</div>
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
              <button type="button" class="btn btn-primary btn-sm" ${dataAct('createVendorInline', '2')}>Create & Select</button>
              <button type="button" class="btn btn-secondary btn-sm" ${dataAct('toggleAddVendorInline', '2')}>Cancel</button>
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
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveInventoryItem', sku)}>Save All Changes</button>`);

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
// "➕ Add new…" on the category selects: reveal the free-text input
function eiNewToggle(kind) {
  const sel = document.getElementById('ei-'+kind), inp = document.getElementById('ei-'+kind+'-new');
  if (!sel || !inp) return;
  const on = sel.value === '__new__';
  inp.style.display = on ? '' : 'none';
  if (on) inp.focus();
}
function eiCatVal(kind) {
  const v = eiVal('ei-'+kind);
  if (v !== '__new__') return v;
  return (document.getElementById('ei-'+kind+'-new')?.value || '').trim();
}
async function saveInventoryItem(sku) {
  if (eiVal('ei-cat') === '__new__' && !eiCatVal('cat')) { showToast('Type the new category name first', 'error'); return; }
  if (eiVal('ei-subcat') === '__new__' && !eiCatVal('subcat')) { showToast('Type the new sub-category name first', 'error'); return; }
  const body = {
    // Product ID
    name:           eiVal('ei-name'),
    brand:          eiVal('ei-brand'),
    category:       eiCatVal('cat'),
    emoji:          eiVal('ei-emoji'),
    barcode:        eiVal('ei-barcode'),
    sub_category:   eiCatVal('subcat'),
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
  // GST slab: only send when explicitly selected. The backend re-derives it
  // from hsn_code anyway; sending an empty select would wrongly wipe the rate.
  const gstSel = document.getElementById('ei-gst');
  if (gstSel && gstSel.value !== '') body.gst_rate = +gstSel.value;
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
  const vendorOpts = (vendors||[]).map(v=>`<option value="${v.id}" ${v.id===vendorId?'selected':''}>${h(v.name)}</option>`).join('');
  openModal('Raise PO — ' + name,
    `<div class="form-group"><label>Vendor</label><select id="po-vendor">${vendorOpts}</select></div>
     <div class="form-group"><label>Quantity</label><input type="number" id="po-qty" value="100" min="1"></div>
     <div class="form-group"><label>Unit Price</label><input type="number" id="po-price" value="${price}" min="0" step="0.01"></div>
     <div class="form-group"><label>Expected Delivery</label><input type="date" id="po-delivery" value="${new Date(Date.now()+3*86400000).toISOString().slice(0,10)}"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('confirmReorder', sku, name)}>Raise PO</button>`);
}

// Open the Raise-PO modal for a SKU straight from a shortcut (e.g. the Home
// "Raise PO: X" nudge), pre-filling its price/vendor from the inventory record —
// instead of dumping the user on the Inventory list to hunt for it.
async function raisePOForSku(sku, name) {
  const inv = await api('/inventory');
  const item = (inv || []).find(i => i.sku === sku) || {};
  reorderItem(sku, name || item.name || sku, item.unit_price || 0, item.vendor_id || '');
}

// Bulk reorder: raise POs for every below-reorder SKU via the sourcing engine
// (one PO per resolved vendor at agreed prices), so the below-reorder highlight
// is actionable rather than a dead-end list.
async function raiseAllReorderPOs() {
  const inv = await api('/inventory');
  const low = (inv || []).filter(i => i.stock <= i.reorder_level && (i.used || i.is_critical));
  const items = low.map(i => ({ sku: i.sku, qty: Math.max(1, (i.reorder_level * 2) - i.stock) }));
  if (!items.length) { showToast('Nothing below reorder level.', 'info'); return; }
  const res = await api('/purchase-orders/from-demand', {
    method: 'POST',
    body: JSON.stringify({ items, source: 'reorder', notes: 'Reorder — SKUs below reorder level', skip_open_po: true })
  });
  if (!res) return;
  const pos = res.pos || [], uns = res.unsourced || [], skipped = res.skipped_open || [];
  const vendors = new Set(pos.map(p => p.vendor_id)).size;
  if (!pos.length && skipped.length) { showToast(`All below-reorder items already have an open PO — nothing re-raised.`, 'info'); return; }
  showToast(pos.length
    ? `${pos.length} PO${pos.length === 1 ? '' : 's'} raised across ${vendors} vendor${vendors === 1 ? '' : 's'}${skipped.length ? ` · ${skipped.length} already on order` : ''}${uns.length ? ` · ${uns.length} no vendor` : ''}`
    : 'No POs created — items had no resolved vendor/price', pos.length ? 'success' : 'error');
  if (pos.length) navigate('procurement');
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
     <div class="form-group"><label>HSN Code</label><input type="text" id="item-hsn" value="" placeholder="e.g. 2202" oninput="hsnAutoGst('item-hsn','item-gst')"><small id="item-hsn-hint" style="color:var(--muted);font-size:.7rem"></small></div>
     <div class="form-group"><label>GST Rate (%) <span style="color:var(--muted);font-weight:400">— set by HSN</span></label>${gstSlabSelect('item-gst', null)}</div>
     <div class="form-group"><label>Emoji</label><input type="text" id="item-emoji" value="📦" maxlength="2"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveNewItem')}>Add Item</button>`);
}

async function saveNewItem() {
  const body = {
    name: document.getElementById('item-name').value,
    category: document.getElementById('item-cat').value,
    unit_price: +document.getElementById('item-price').value,
    stock: +document.getElementById('item-stock').value,
    hsn_code: document.getElementById('item-hsn').value,
    gst_rate: +document.getElementById('item-gst').value,
    emoji: document.getElementById('item-emoji').value,
  };
  if (!body.name || !body.unit_price) { showToast('Name and price required','error'); return; }
  const res = await api('/inventory', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast(`Item ${res.sku} added`); navigate('inventory'); }
}

// Admin backfill: recompute every item's GST slab from its HSN code, fixing the
// historical data where products defaulted to 18%.
async function recalcGstFromHsn() {
  if (!confirm("Recompute GST for every catalogue item from its HSN code?\n\nItems whose HSN maps to a different slab (0/5/12/18/28%) will be updated. Items with an unmapped HSN are left unchanged.")) return;
  const res = await api('/inventory/recalc-gst', { method:'POST', body: '{}' });
  if (!res) return;
  let msg = `GST recalculated — ${res.updated} item(s) updated`;
  if (res.unmatched) msg += `, ${res.unmatched} left unchanged (unmapped HSN)`;
  showToast(msg, res.updated ? 'success' : 'info');
  if (res.unmatched_hsns && res.unmatched_hsns.length)
    console.warn('Unmapped HSN codes (left unchanged — add them in Settings → HSN → GST):', res.unmatched_hsns);
  navigate('inventory');
}
