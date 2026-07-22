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
  APP._attentionItems = lowStock;
  const cartCount = (APP.cart||[]).reduce((s,i) => s + (i.qty||0), 0);
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
    <button class="btn btn-primary" ${dataAct('navigate', 'place_order')} style="padding:10px 22px;font-weight:700">${iconPlus(15)} Place Order</button>
  </div>

  <!-- ═══ WHAT NEEDS ATTENTION TODAY ═══ -->
  <div style="margin-bottom:18px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:.85rem;font-weight:800;color:var(--navy);text-transform:uppercase;letter-spacing:.05em">⚡ Needs attention today</span>
      ${attentionCount ? `<span style="background:#fee2e2;color:#dc2626;border-radius:20px;padding:1px 9px;font-size:.74rem;font-weight:700">${attentionCount}</span>` : ''}
      ${lowStock.length ? `<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-gold btn-sm" ${dataAct('orderAllAttention')} title="Add every low & out-of-stock item to your order">🛒 Order all (${lowStock.length})</button>
        <button id="attn-review-btn" class="btn btn-primary btn-sm" style="display:${cartCount>0?'inline-flex':'none'}" ${dataAct('reviewPlaceOrder')}>Review order (<span id="attn-review-count">${cartCount}</span>) →</button>
      </div>` : ''}
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
        ${(APP.cart||[]).some(c => c.sku === i.sku)
          ? `<button class="btn btn-secondary btn-sm" style="width:100%;background:#dcfce7;color:#15803d;border-color:#86efac" ${dataAct('reviewPlaceOrder')}>✓ Added — Review</button>`
          : `<button class="btn btn-primary btn-sm" style="width:100%" ${dataActEl('addAttentionItem', i.sku, i.item_name||i.sku)}>Order Now</button>`}
      </div>`).join('')}
      ${pendingApproval > 0 ? `
      <div style="flex:0 0 240px;background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:14px 16px">
        <div style="font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:#ccfbf1;color:#0f766e;display:inline-block;margin-bottom:6px">APPROVAL</div>
        <div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:10px">${pendingApproval} order${pendingApproval>1?'s':''} awaiting sign-off</div>
        <button class="btn btn-secondary btn-sm" style="width:100%" ${dataAct('navigate', 'approvals')}>Review Now</button>
      </div>` : ''}
      ${inTransitDCs.slice(0,2).map(dc => `
      <div style="flex:0 0 240px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px">
        <div style="font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:20px;background:#dbeafe;color:#1d4ed8;display:inline-block;margin-bottom:6px">ARRIVING</div>
        <div style="font-weight:700;font-size:.86rem;color:var(--navy);margin-bottom:2px">${dc.dc_number||dc.id}</div>
        <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">${dc.driver_name?`🧑‍✈️ ${h(dc.driver_name)}`:'🚚 En route'}${dc.scheduled_time?` · ETA ${dc.scheduled_time}`:''}</div>
        ${dc.driver_phone?`<a href="tel:${h(dc.driver_phone)}" class="btn btn-secondary btn-sm" style="width:100%;text-decoration:none;display:block;text-align:center;box-sizing:border-box">📞 Call Driver</a>`:`<button class="btn btn-secondary btn-sm" style="width:100%" ${dataAct('navigate', 'track_delivery')}>Track</button>`}
      </div>`).join('')}
      ${lowStock.length > 6 ? `
      <div style="flex:0 0 140px;display:flex;align-items:center;justify-content:center">
        <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'my_inventory')}>+${lowStock.length-6} more →</button>
      </div>` : ''}
    </div>`}
  </div>

  <!-- ═══ QUICK ACTIONS ═══ -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:18px">
    ${[
      { icon:'🛒', label:'Place Order',   sub:'browse catalogue', act:'quickNav', arg:'place_order' },
      { icon:'📋', label:'Order Sheet',   sub:'export & upload',  act:'quickNavCSV' },
      { icon:'📉', label:'Log Use',       sub:'record consumption', act:'quickNav', arg:'my_inventory' },
      { icon:'🚚', label:'Track',         sub:inTransitDCs.length+' in transit', act:'quickNav', arg:'track_delivery' },
      { icon:'📊', label:'Reports',       sub:'spend & usage',    act:'quickNav', arg:'client_reports' },
    ].map(a=>`
    <button ${a.arg!==undefined?dataAct(a.act,a.arg):dataAct(a.act)} style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px 10px;cursor:pointer;text-align:center;transition:box-shadow .15s,transform .15s" data-hoverlift>
      <div style="font-size:1.5rem;margin-bottom:5px">${a.icon}</div>
      <div style="font-weight:700;font-size:.8rem;color:var(--navy)">${a.label}</div>
      <div style="font-size:.68rem;color:var(--text-muted);margin-top:2px">${a.sub}</div>
    </button>`).join('')}
  </div>

  <!-- ═══ STATUS CHIPS ROW ═══ -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
    <button ${dataAct('navigate', 'my_orders')} style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--border);border-radius:20px;padding:6px 14px;cursor:pointer;font-size:.78rem">
      <b style="color:var(--navy)">${activeOrders}</b> active orders
    </button>
    <button ${dataAct('navigate', 'track_delivery')} style="display:inline-flex;align-items:center;gap:6px;background:${inTransitDCs.length?'#fef3c7':'#fff'};border:1px solid ${inTransitDCs.length?'#fcd34d':'var(--border)'};border-radius:20px;padding:6px 14px;cursor:pointer;font-size:.78rem">
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
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'my_orders')} data-prevent>View All Orders</button>
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
            ${dc.driver_phone?`<a href="tel:${h(dc.driver_phone)}" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:.74rem;font-weight:600;color:#d97706;text-decoration:none;background:#fef3c7;border-radius:6px;padding:3px 8px">📞 Call Driver</a>`:''}
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
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'my_orders')}>View All</button>
    </div>
    <div style="padding:0">
      ${(recentOrders||[]).slice(0,5).map(o=>`
      <div style="display:flex;align-items:center;gap:14px;padding:13px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" data-hover ${dataAct('viewOrder', o.id)}>
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
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--danger);margin-bottom:0;cursor:pointer" ${dataAct('navigate', 'fulfilment')}>
      <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Due Items</div>
      <div style="font-size:1.9rem;font-weight:700;color:var(--danger);line-height:1" id="due-items-count">—</div>
      <div style="font-size:.75rem;color:var(--text-muted);margin-top:6px">items pending delivery</div>
    </div>
    <div class="card" style="padding:16px 18px;border-top:3px solid var(--primary);margin-bottom:0;cursor:pointer" ${dataAct('navigate', 'fulfilment')}>
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
        <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);cursor:pointer" ${dataAct('viewOrder', o.id)}>
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
    { key:'PICKED',           label:'Picked',       color:'#0d9488' },
    { key:'IN_SHIPMENT',      label:'In Transit',   color:'#06b6d4' },
    { key:'PARTIALLY_CLOSED', label:'Partial',      color:'#f59e0b' },
    { key:'CLOSED',           label:'Closed',       color:'#16a34a' },
    { key:'CANCELLED',        label:'Cancelled',    color:'#ef4444' },
  ];
  const pipeTotal = pipeline.reduce((s,p)=>s+(byStatus[p.key]||0),0)||1;

  el.innerHTML = `
  <style>
    .ct-kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px}
    .ct-kpi{position:relative;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:15px 15px 16px;cursor:pointer;overflow:hidden;text-align:left;font-family:inherit;transition:transform .16s cubic-bezier(.2,.7,.2,1),box-shadow .18s,border-color .15s}
    .ct-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ac,var(--primary));opacity:.4;transition:opacity .18s}
    .ct-kpi:hover{transform:translateY(-3px);box-shadow:0 12px 26px -14px rgba(20,26,36,.28);border-color:var(--border-mid)}
    .ct-kpi:hover::before{opacity:.95}
    .ct-kpi:focus-visible{outline:2px solid var(--ac,var(--primary));outline-offset:2px}
    .ct-kpi.ct-flag{background:linear-gradient(180deg,var(--acbg,#f8fafc),var(--surface) 62%)}
    .ct-kpi.ct-flag::before{opacity:1}
    .ct-kpi-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px;min-height:40px}
    .ct-kpi-icon{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.05rem;background:var(--acbg,#eef2f7);color:var(--acic,var(--navy))}
    .ct-kpi-icon svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .ct-kpi-chip{font-size:.58rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 9px;border-radius:100px;background:var(--ac,var(--primary));color:#fff;white-space:nowrap}
    .ct-kpi-val{font-size:1.85rem;font-weight:800;line-height:1;letter-spacing:-.03em;color:var(--navy);font-variant-numeric:tabular-nums}
    .ct-kpi-val.flag{color:var(--acic,var(--navy))}
    .ct-kpi-lbl{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-top:9px}
    .ct-kpi-sub{font-size:.72rem;color:var(--text-light);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ct-delta{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:800;font-variant-numeric:tabular-nums;margin-top:11px}
    .ct-delta.good{color:var(--success)}.ct-delta.bad{color:var(--danger)}.ct-delta.flat{color:var(--text-muted)}
    .ct-delta svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
    .ct-delta .ct-win{color:var(--text-muted);font-weight:600}
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
    /* ── Predictive radar (Phase 1) ── */
    .tw-pulse{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
    .tw-pk{background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:12px 14px;text-align:left;cursor:pointer;font-family:inherit;transition:.15s}
    .tw-pk:hover{border-color:var(--primary);transform:translateY(-1px)}
    .tw-pk .l{font-size:.62rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}
    .tw-pk .v{font-size:1.4rem;font-weight:900;color:var(--navy);margin-top:3px;line-height:1.1}
    .tw-pk .v.g{color:var(--success)}.tw-pk .v.w{color:#d97706}.tw-pk .v.b{color:var(--danger)}
    .tw-pk .t{font-size:.64rem;font-weight:800;margin-top:2px}
    .tw-pk .t.up{color:var(--success)}.tw-pk .t.dn{color:var(--danger)}.tw-pk .t.fl{color:var(--text-muted)}
    .tw-pk .f{font-size:.68rem;color:var(--navy);margin-top:7px;background:var(--primary-light);border-radius:7px;padding:5px 8px;line-height:1.45}
    .tw-pk .f b{color:var(--primary-hover)}
    .tw-fc{display:flex;gap:11px;align-items:flex-start;width:100%;text-align:left;font-family:inherit;border:1px solid var(--border);border-radius:10px;padding:10px 13px;margin-bottom:8px;background:#fff;cursor:pointer;transition:.13s}
    .tw-fc:hover{border-color:var(--primary);transform:translateX(3px)}
    .tw-fc:last-child{margin-bottom:0}
    .tw-fc .ic{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
    .tw-fc .ic.b{background:#fee2e2;color:#dc2626}.tw-fc .ic.w{background:#fef3c7;color:#b45309}
    .tw-fc .m{flex:1;min-width:0}
    .tw-fc .h4{font-size:.84rem;font-weight:700;color:var(--navy);display:block}
    .tw-fc .p{font-size:.72rem;color:var(--text-muted);display:block;margin-top:1px;line-height:1.45}
    .tw-fc .eta{font-size:.62rem;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
    .tw-fc .eta.b{background:#fee2e2;color:#dc2626}.tw-fc .eta.w{background:#fef3c7;color:#b45309}
    .tw-load{border:1px solid var(--border);border-radius:10px;background:var(--surface-2);padding:11px 13px;margin-bottom:10px}
    .tw-load .lt{font-size:.7rem;font-weight:700;color:var(--navy);margin-bottom:8px}
    .tw-bars{display:flex;align-items:flex-end;gap:6px;height:78px;position:relative;padding-top:6px}
    .tw-bars .capline{position:absolute;left:0;right:0;border-top:2px dashed #fca5a5}
    .tw-bar{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%}
    .tw-bar i{display:block;width:100%;border-radius:4px 4px 2px 2px;background:#33475f}
    .tw-bar i.gho{background:repeating-linear-gradient(45deg,#0d9488,#0d9488 3px,transparent 3px,transparent 6px)}
    .tw-bar i.over{background:#dc2626}
    .tw-bar .d{font-size:.58rem;font-weight:700;color:var(--text-muted)}
    .tw-bar .n{font-size:.6rem;font-weight:800;color:var(--text-muted)}
    .tw-bar .n.over{color:#dc2626}
    .tw-hz{border:1px solid var(--border);background:#fff;color:var(--text-muted);font-size:.74rem;font-weight:700;padding:5px 13px;border-radius:20px;cursor:pointer;font-family:inherit;transition:.14s}
    .tw-hz:hover{border-color:var(--primary);color:var(--navy)}
    .tw-hz.on{background:var(--primary);border-color:var(--primary);color:#fff}
    .tw-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:14px;align-items:start}
    @media(max-width:1050px){.tw-grid{grid-template-columns:1fr}}
    .tw-aq{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font-family:inherit;border:1px solid var(--border);border-radius:10px;padding:9px 12px;margin-bottom:7px;background:#fff;cursor:pointer;transition:.13s}
    .tw-aq:hover{border-color:var(--primary);transform:translateX(3px)}
    .tw-aq:last-child{margin-bottom:0}
    .tw-aq .sev{width:5px;align-self:stretch;border-radius:4px;flex-shrink:0}
    .tw-aq .sev.s1{background:#dc2626}.tw-aq .sev.s2{background:#d97706}.tw-aq .sev.s3{background:#33475f}
    .tw-aq .m{flex:1;min-width:0}
    .tw-aq .h4{font-size:.8rem;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
    .tw-aq .p{font-size:.68rem;color:var(--text-muted);display:block}
    .tw-aq .r{font-size:.6rem;font-weight:800;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
    .tw-aq .r.s1{background:#fee2e2;color:#dc2626}.tw-aq .r.s2{background:#fef3c7;color:#b45309}.tw-aq .r.s3{background:#e9eef4;color:#25384d}
    .tw-chg{font-size:.68rem;font-weight:700;padding:3px 10px;border-radius:20px;background:#fff;border:1px solid var(--border);color:var(--navy);white-space:nowrap}
    .tw-chg.g{background:#d1fae5;color:#047857;border-color:transparent}
    .tw-chg.b{background:#fee2e2;color:#dc2626;border-color:transparent}
    .tw-chg.lead{background:var(--surface-2);color:var(--text-muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em;font-size:.6rem}
    .tw-h{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--border-light);font-size:.8rem}
    .tw-h:last-child{border-bottom:none}
    .tw-h .n{flex:1;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tw-h .a{font-size:.95rem;width:18px;text-align:center;flex-shrink:0}
    .tw-h .s{font-weight:900;width:30px;text-align:right;flex-shrink:0}
    .tw-h .pv{font-size:.64rem;color:var(--text-muted);width:52px;text-align:right;flex-shrink:0}
    @media(max-width:1050px){.tw-pulse{grid-template-columns:repeat(2,1fr)}}
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
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'inventory')}>Inventory</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'orders')}>Orders</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'fulfilment')}>Fulfilment</button>
      <button class="btn btn-primary btn-sm" ${dataAct('navigate', 'reports')}>Reports →</button>
    </div>
  </div>

  <!-- ── KPI TILES ── -->
  <div class="ct-kpi-grid">
    ${(() => {
      const TONE = {
        calm: { ac:'#0d9488', bg:'#f0fdfa', ic:'#0f766e' },
        warn: { ac:'#d97706', bg:'#fffbeb', ic:'#b45309' },
        crit: { ac:'#dc2626', bg:'#fef2f2', ic:'#dc2626' },
        info: { ac:'#2563eb', bg:'#eef4ff', ic:'#2563eb' },
      };
      const trends = data.kpiTrends || null;
      const tiles = [
        { icon:CT_ICON.box,     label:'Total Orders',    value:totalOrders||0,     meta:`${pendingOrders||0} active`,                     state:'calm',                       nav:'orders',       trend:'totalOrders',    good:'up' },
        { icon:CT_ICON.clock,   label:'Pending Approval', value:pendingApproval||0, meta:`${pickedPending} picked · ${inShipment} transit`, state:pendingApproval>0?'warn':'calm', nav:'orders', click:'openPendingApprovals', pill:pendingApproval>0?'Action':null, trend:'pendingApproval', good:'down' },
        { icon:CT_ICON.alert,   label:'Due Line Items',   value:dueCount||0,        meta:`${pendingSupply?.kpis?.due_qty||0} units overdue`, state:dueCount>0?'crit':'calm', nav:'fulfilment', pill:dueCount>0?'Overdue':null,  trend:'dueItems',       good:'down' },
        { icon:CT_ICON.receipt, label:'Pending Billing',  value:pendingDCBilling||0,meta:'DCs awaiting invoice',                          state:pendingDCBilling>0?'warn':'calm', nav:'dc_billing', pill:pendingDCBilling>0?'To bill':null, trend:'pendingBilling', good:'down' },
        { icon:CT_ICON.bars,    label:'Low Stock SKUs',   value:lowStock||0,        meta:'reorder required',                              state:lowStock>0?'warn':'calm', nav:'inventory',  pill:lowStock>0?'Reorder':null,  trend:'lowStock',       good:'down' },
        { icon:CT_ICON.life,    label:'Open Tickets',     value:openTickets||0,     meta:'support queue',                                 state:'info',                       nav:'service_desk', trend:'openTickets',    good:'down' },
      ];
      return tiles.map(t => { const c = TONE[t.state]; const flag = t.state==='warn'||t.state==='crit';
        return `<button class="ct-kpi${flag?' ct-flag':''}" style="--ac:${c.ac};--acbg:${c.bg};--acic:${c.ic}" ${t.click?dataAct(t.click):dataAct('navigate',t.nav)}>
          <div class="ct-kpi-top">
            <span class="ct-kpi-icon"><svg viewBox="0 0 24 24">${t.icon}</svg></span>
            ${t.pill ? `<span class="ct-kpi-chip">${t.pill}</span>` : ''}
          </div>
          <div class="ct-kpi-val${flag?' flag':''}">${fmtNum(t.value)}</div>
          <div class="ct-kpi-lbl">${t.label}</div>
          <div class="ct-kpi-sub">${t.meta}</div>
          ${ctDelta(trends, t.trend, t.good)}
        </button>`;
      }).join('');
    })()}
  </div>

  <!-- ── PREDICTIVE RADAR: horizon switch + pulse + radar + queue ── -->
  <div id="tower-radar-wrap" style="display:none;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-size:.62rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--primary-hover)">🕐 Horizon</span>
      <button class="tw-hz" id="tw-hz-today" ${dataAct('setTowerHz', 'today')}>Today</button>
      <button class="tw-hz on" id="tw-hz-week" ${dataAct('setTowerHz', 'week')}>Next 7 days</button>
      <button class="tw-hz" id="tw-hz-month" ${dataAct('setTowerHz', 'month')}>Next 30 days</button>
      <span id="tw-hz-note" style="margin-left:auto;font-size:.7rem;color:var(--text-muted)"></span>
    </div>
    <div id="tw-changes" style="display:none;flex-wrap:wrap;gap:6px;margin:0 0 10px"></div>
    <div class="tw-pulse" id="tower-pulse"></div>
    <div class="tw-grid">
      <div class="ct-card" id="tower-radar"></div>
      <div style="display:flex;flex-direction:column;gap:14px;min-width:0">
        <div class="ct-card" id="tower-queue"></div>
        <div class="ct-card" id="tower-health"></div>
      </div>
    </div>
  </div>

  <!-- ── ORDER PIPELINE ── -->
  <div class="ct-card" style="margin-bottom:16px">
    <div class="ct-card-hd">
      <div>
        <div class="ct-card-title">Order Pipeline</div>
        <div class="ct-card-sub">${totalOrders||0} orders across all stages</div>
      </div>
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'orders')}>View All →</button>
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
      <div id="tower-bneck" style="display:none;margin-top:10px;font-size:.74rem;color:#b45309;background:#fef3c7;border:1px dashed #fcd34d;border-radius:8px;padding:7px 11px"></div>
    </div>
  </div>

  <!-- ── MID GRID: Top Clients + Chart | Action Required ── -->
  <div class="ct-mid" style="margin-bottom:20px">
    <div class="ct-mid-left">

      <!-- Top Clients -->
      <div class="ct-card">
        <div class="ct-card-hd">
          <div class="ct-card-title">Top Clients</div>
          <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'clients')}>View All →</button>
        </div>
        <div style="padding:16px 20px">
          ${(topClients||[]).slice(0,5).map((c,i)=>{
            const cols = ['#2E75B6','#8b5cf6','#0d9488','#06b6d4','#f59e0b'];
            const col  = cols[i];
            const pct  = Math.round((c.total/(topClients[0]?.total||1))*100);
            return `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:13px;cursor:pointer;border-radius:8px;padding:4px 6px;margin-left:-6px;margin-right:-6px;transition:background .15s"
                 data-hover
                 ${dataAct('openClientDetail', c.id)} title="View ${h(c.name)} details">
              <div style="width:24px;height:24px;border-radius:50%;background:${col};color:#fff;font-size:.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
                  <span style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;color:var(--blue)">${h(c.name)}</span>
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
          { label:'Pending Approval',   val:pendingApproval,   color:'#d97706', bg:'#fef3c7', icon:'⏳', page:'orders', click:'openPendingApprovals' },
          { label:'Due Line Items',     val:dueCount,          color:'var(--danger)', bg:'#fee2e2', icon:'🚨', page:'fulfilment' },
          { label:'Overdue Deliveries', val:delayedDel,        color:'var(--danger)', bg:'#fee2e2', icon:'🚚', page:'delivery'   },
          { label:'Orders to Pick',     val:toPickCount,       color:'#8b5cf6', bg:'#f3e8ff', icon:'🏭', page:'warehouse'   },
          { label:'Low Stock SKUs',     val:lowStock||0,       color:'#d97706', bg:'#fef3c7', icon:'📊', page:'inventory'   },
          { label:'Pending Billing',    val:pendingDCBilling||0, color:'#2E75B6', bg:'#dbeafe', icon:'🧾', page:'dc_billing' },
          { label:'Open Tickets',       val:openTickets||0,    color:'#7c3aed', bg:'#f3e8ff', icon:'🎫', page:'service_desk' },
        ].map(a => {
          const hot = a.val > 0;
          return `<div class="ct-action${hot?' hot':''}" ${a.click?dataAct(a.click):dataAct('navigate',a.page)}>
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
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'orders')}>View All →</button>
    </div>
    ${(recentOrders||[]).map(o=>`
    <div class="ct-order-row" ${dataAct('viewOrder', o.id)}>
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
  const colors  = ['#3b82f6','#8b5cf6','#0d9488','#06b6d4','#f59e0b','#16a34a','#ef4444'];
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

  loadTowerRadar(); // predictive layer — fills in when the endpoint responds
}

/* ── Predictive Control Tower: pulse + radar + queue (Phases 1–2) ──
   Run-rate projections over live data. Every card and signal carries its
   arithmetic in the hover title; projected dates are prefixed "~".
   The horizon switch re-aims the radar; the first four KPIs keep their
   identity on every horizon — only their forecast lines change. */
let _tower = null, _towerHz = 'week';

async function loadTowerRadar() {
  const wrap = document.getElementById('tower-radar-wrap');
  if (!wrap) return;
  let d = null;
  try { d = await api('/reports/tower-radar'); } catch(_) { /* endpoint missing */ }
  if (!d || d.error || !document.getElementById('tower-pulse')) return; // stay hidden
  _tower = d; _towerHz = 'week';
  wrap.style.display = '';
  renderTowerRadar();

  // bottleneck note on the pipeline card (30-day stage timings)
  const bn = document.getElementById('tower-bneck');
  if (bn && d.bottleneck && d.bottleneck.worst) {
    const w = d.bottleneck.worst;
    bn.style.display = '';
    bn.title = 'Basis: average time between consecutive order_history transitions, last 30 days';
    bn.innerHTML = `⚠ <b>Bottleneck: ${h(w.stage)}</b> — avg ${w.avg_days} day${w.avg_days===1?'':'s'} per order over the last 30 days${w.ratio && w.ratio>1 ? `, ${w.ratio}× slower than the next stage` : ''}.`;
  }

  // "what changed" strip — vs the last recorded day (favourability-coloured)
  const chEl = document.getElementById('tw-changes');
  if (chEl) {
    const chg = d.changes;
    let chips = '';
    if (chg && chg.prev && chg.cur) {
      const defs = [
        ['at_risk','At-risk', -1], ['dry','Run-outs ≤30d', -1], ['hot','Budget hot', -1],
        ['unbilled','Unbilled DCs', -1], ['stale','Stale approvals', -1], ['ghosts','Unconfirmed cycles', -1],
        ['fulfil','Fulfilment %', 1],
      ];
      chips = defs.map(dd => {
        const a = chg.prev[dd[0]], b2 = chg.cur[dd[0]];
        if (a == null || b2 == null || a === b2) return '';
        const up = b2 > a, good = (up ? 1 : -1) === dd[2];
        return `<span class="tw-chg ${good?'g':'b'}" title="${dd[1]}: ${a} on ${chg.since} → ${b2} now">${dd[1]} ${a} → ${b2} ${up?'▲':'▼'}</span>`;
      }).filter(Boolean).join('');
      if (chips) chips = `<span class="tw-chg lead">Δ since ${new Date(chg.since+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</span>` + chips;
    }
    chEl.innerHTML = chips;
    chEl.style.display = chips ? 'flex' : 'none';
  }

  // client health trajectories (trailing 30d vs prior 30d)
  const hEl = document.getElementById('tower-health');
  if (hEl) {
    const hs = d.health || [];
    hEl.innerHTML = `<div class="ct-card-hd"><div><div class="ct-card-title">♥ Client health</div>
      <div class="ct-card-sub">0.6×fulfilment + 0.4×budget-pace · 30d vs prior 30d</div></div></div>
      <div style="padding:10px 14px">` + (hs.length ? hs.map(x => {
        const arrow = x.dir==='up' ? '↗' : x.dir==='down' ? '↘' : '→';
        const ac = x.dir==='up' ? '#16a34a' : x.dir==='down' ? '#dc2626' : '#94a3b8';
        const sc = x.score>=90 ? '#16a34a' : x.score>=75 ? '#d97706' : '#dc2626';
        return `<div class="tw-h" title="${h(x.why||'')}">
          <span class="n">${h(x.name)}</span>
          <span class="a" style="color:${ac}">${arrow}</span>
          <span class="s" style="color:${sc}">${x.score}</span>
          <span class="pv">${x.prev!=null ? 'was '+x.prev : 'new'}</span></div>`;
      }).join('') : '<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:.8rem">Not enough order history yet — the score needs 30 days of orders.</div>') + `</div>`;
  }
}

function setTowerHz(hz) { _towerHz = hz; renderTowerRadar(); }

function renderTowerRadar() {
  const d = _tower; if (!d || !document.getElementById('tower-pulse')) return;
  const hz = _towerHz;
  ['today','week','month'].forEach(x => document.getElementById('tw-hz-'+x)?.classList.toggle('on', x === hz));
  const noteEl = document.getElementById('tw-hz-note');
  if (noteEl) noteEl.textContent = 'Radar aimed at ' + ({ today:'the rest of today', week:'the coming week', month:'month-end' }[hz]);

  const fmtD = k => { try { return new Date(k+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}); } catch(_) { return k; } };
  const isoOff = off => { const t = new Date(); t.setDate(t.getDate()+off); return t.toISOString().slice(0,10); };
  const lim = hz==='today' ? isoOff(1) : hz==='week' ? isoOff(7) : isoOff(30);
  const winLabel = hz==='today' ? 'by tomorrow' : hz==='week' ? 'within 7 days' : 'within 30 days';

  const f = d.fulfilment, b = d.budget, cap = d.capacity, bill = d.billing;
  const stAll = d.stock || [];
  const stH = stAll.filter(s => s.runout <= lim);
  const ghostsH = (d.ghosts||[]).filter(g => g.date <= lim);
  const hot = (b && b.clients || []).filter(c => c.projected_pct > 100);
  const hotH = hz==='month' ? hot : hot.filter(c => c.crossing && c.crossing <= lim);
  const overH = (cap && cap.over || []).filter(k => k <= lim);

  // ── pulse: 4 stable KPIs; only the forecast line changes with the horizon ──
  const cards = [];
  if (f && f.mtd != null) {
    const projWk = Math.max(0, Math.min(100, Math.round((f.mtd + f.trend_wk) * 10) / 10));
    const proj = f.projected_eom;
    const fc = hz==='today'
      ? `Currently ${f.mtd>=f.target?'above':'<b>below</b>'} the ${f.target}% target`
      : hz==='week'
        ? `Trending to <b>~${projWk}%</b> a week out — ${projWk>=f.target?'above':'<b>below</b>'} target`
        : (proj==null ? 'Not enough recent orders to project'
          : `Projected <b>~${proj}%</b> by month-end — ${proj<f.target?'<b>below</b>':'above'} the ${f.target}% target`);
    cards.push({ l:'Fulfilment MTD', v:f.mtd+'%', c:f.mtd>=f.target?'g':'w',
      t:(f.trend_wk>0?'▲ +':f.trend_wk<0?'▼ −':'▬ ')+Math.abs(f.trend_wk)+'pt/wk', tc:f.trend_wk>0?'up':f.trend_wk<0?'dn':'fl',
      fc, basis:'MTD delivered ÷ ordered; trend = last 7 days vs the 7 before, projected forward', nav:'fulfilment' });
  } else {
    cards.push({ l:'Fulfilment MTD', v:'—', c:'', t:'no orders yet this month', tc:'fl', fc:'Projection starts with the first order of the month', basis:'MTD delivered ÷ ordered', nav:'fulfilment' });
  }
  if (b) {
    const worst = (b.clients||[])[0];
    const fc = !worst ? 'No client budgets set'
      : hz!=='month' && hotH.length
        ? `<b>${h(hotH[0].name)}</b> crosses its budget <b>~${fmtD(hotH[0].crossing)}</b> — ${winLabel}`
        : worst.projected_pct>100
          ? `<b>${h(worst.name)}</b> projected <b>~${worst.projected_pct}%</b>${worst.crossing?` — crosses <b>~${fmtD(worst.crossing)}</b>`:''}`
          : `Highest pace: <b>${h(worst.name)}</b> at ~${worst.projected_pct}% projected`;
    cards.push({ l:'Budget pace', v: b.hot ? b.hot+' hot' : 'all ok', c: b.hot?'b':'g',
      t:(b.total||0)+' budgeted client'+(b.total===1?'':'s'), tc:'fl', fc,
      basis:'Per client: MTD spend ÷ days elapsed × days in month, vs monthly budget', nav:'exec_bi' });
  }
  const sm = d.stock_meta || {};
  const noConsumption = sm.has_consumption === false;   // forecast is blind, not clear
  const belowN = sm.below_reorder || 0;
  cards.push({ l:'Stock cover',
    v: stH.length ? stH.length+' dry' : (noConsumption ? (belowN ? belowN+' low' : 'no data') : 'ok'),
    c: stH.length ? (stH[0].days_cover<=7?'b':'w') : (noConsumption && belowN ? 'w' : 'g'),
    t: stH.length ? winLabel : (noConsumption ? 'no consumption data' : 'no run-outs '+winLabel), tc: stH.length?'up':'fl',
    fc: stH.length ? `<b>${h(stH[0].name)}</b> first — dry <b>~${fmtD(stH[0].runout)}</b> (${stH[0].days_cover}d cover${stH[0].critical?' · must-have':''})`
      : (noConsumption
          ? (belowN ? `No consumption logged in 14 days — can't forecast run-outs. <b>${belowN}</b> SKU${belowN>1?'s':''} below reorder to review.` : `No consumption logged in 14 days — nothing to forecast yet.`)
          : `Every consumed SKU has cover ${hz==='today'?'for today':winLabel.replace('within','beyond')}`),
    basis:'Per SKU: current stock ÷ 14-day average daily consumption (needs consumption logs)', nav:'inventory' });
  if (bill) cards.push({ l:'Billing runway', v: bill.unbilled||0, c: bill.unbilled?'w':'g',
    t: bill.unbilled ? 'oldest '+(bill.oldest_days||0)+'d unbilled' : 'all invoiced', tc: bill.unbilled?'up':'fl',
    fc: bill.unbilled ? `<b>${bill.unbilled} delivered DC${bill.unbilled===1?'':'s'}</b> billable right now` : 'Nothing waiting on an invoice',
    basis:'Delivered challans not yet billed', nav:'dc_billing' });

  document.getElementById('tower-pulse').innerHTML = cards.map(k =>
    `<button class="tw-pk" title="Basis: ${h(k.basis)}" ${dataAct('navigate', k.nav)}>
      <div class="l">${k.l}</div><div class="v ${k.c}">${k.v}</div>
      <div class="t ${k.tc}">${k.t}</div><div class="f">${k.fc}</div></button>`).join('');

  // ── radar signals for this horizon ──
  const sigs = [];
  hotH.slice(0,2).forEach(c => sigs.push({
    tone:'b', ic:'₹',
    h:`${h(c.name)} projected to breach budget${c.crossing?` ~${fmtD(c.crossing)}`:''}`,
    p:`Tracking ~${c.projected_pct}% of ${cdashINR(c.budget)} at the current burn (${cdashINR(Math.round(c.spend/Math.max(1,new Date().getDate())))}/day).`,
    eta: c.crossing ? '~'+fmtD(c.crossing) : '~'+c.projected_pct+'%',
    basis:`MTD spend ${cdashINR(c.spend)} ÷ ${new Date().getDate()} days × month length vs ${cdashINR(c.budget)} budget`, nav:'exec_bi' }));
  if (hz==='month' && f && f.projected_eom != null && f.projected_eom < f.target) sigs.push({
    tone:'b', ic:'📉', h:`Fulfilment projected below target by month-end (~${f.projected_eom}%)`,
    p:`Trend is ${f.trend_wk}pt/week${d.bottleneck && d.bottleneck.worst ? ` — the slow stage is ${d.bottleneck.worst.stage} (${d.bottleneck.worst.avg_days}d avg)` : ''}.`,
    eta:'~'+f.projected_eom+'%', basis:'MTD fill + weekly trend × remaining weeks', nav:'fulfilment' });
  stH.slice(0,2).forEach(s => sigs.push({
    tone: s.days_cover<=7?'b':'w', ic:'☕',
    h:`${h(s.name)} runs out ~${fmtD(s.runout)}${s.critical?' — must-have item':''}`,
    p:`${Math.round(s.stock)} in stock ÷ ${s.draw}/day (14-day average draw) ≈ ${s.days_cover} days of cover.`,
    eta:`${s.days_cover}d cover`, basis:`Stock ${Math.round(s.stock)} ÷ draw ${s.draw}/day`, nav:'inventory' }));
  // Forecast is blind (no consumption logged) but stock is low — say so, don't imply all-clear.
  if (noConsumption && belowN > 0) {
    const t0 = (sm.below_top || [])[0];
    sigs.push({ tone:'w', ic:'📦',
      h:`${belowN} SKU${belowN>1?'s':''} below reorder — can't forecast run-outs`,
      p:`No consumption logged in the last 14 days, so days-of-cover can't be projected.${t0?` Lowest: <b>${h(t0.name)}</b> (${Math.round(t0.stock)} on hand vs reorder ${Math.round(t0.reorder_level)}${t0.critical?' · must-have':''}).`:''} Review the below-reorder list in Inventory.`,
      eta:'Data gap', basis:'Active SKUs with stock ≤ reorder level; forecast needs client_consumption logs', nav:'inventory' });
  }
  if (hz==='month' && overH.length > 1) {
    sigs.push({ tone:'b', ic:'🚚', h:`${overH.length} days over fleet capacity in the next 30`,
      p:`First: ${fmtD(overH[0])}. Reschedule or stagger recurring cycles from the Delivery Calendar.`,
      eta:`${overH.length} days`, basis:'Booked DCs + recurring projections vs the capacity setting', nav:'delivery_calendar' });
  } else overH.slice(0,1).forEach(k => {
    const day = (cap.days||[]).find(x => x.date === k) || { booked:0, projected:0 };
    sigs.push({ tone:'b', ic:'🚚', h:`${fmtD(k)} is over fleet capacity`,
      p:`${day.booked} booked + ${day.projected} projected recurring vs ${cap.cap} slots — reschedule from the Delivery Calendar.`,
      eta:`${day.booked+day.projected}/${cap.cap}`, basis:'Booked DCs + recurring projections vs the capacity setting', nav:'delivery_calendar' });
  });
  if (d.at_risk) sigs.push({ tone:'b', ic:'⚠',
    h:`${d.at_risk} deliver${d.at_risk===1?'y is':'ies are'} past date, undelivered`,
    p:'Live at-risk entries, not projections — reschedule or chase from the Delivery Calendar.',
    eta:'now', basis:'Scheduled date earlier than today and status not delivered', nav:'delivery_calendar' });
  ghostsH.slice(0,2).forEach(g => sigs.push({ tone:'w', ic:'◌',
    h:`Recurring “${h(g.name)}” due ~${fmtD(g.date)} — unconfirmed`,
    p:`${h(g.client||'')} standing order — create the order or skip the cycle before picking day.`,
    eta: fmtD(g.date), basis:'Standing-order cycle in this window with no order or skip recorded', nav:'delivery_calendar' }));

  // ── 7-day load bars (week horizon only) ──
  let loadHtml = '';
  if (hz==='week' && cap && (cap.days||[]).length) {
    const days7 = cap.days.slice(0,7);
    const maxv = Math.max(cap.cap + 2, ...days7.map(x => x.booked + x.projected));
    loadHtml = `<div class="tw-load"><div class="lt">Delivery load, next 7 days — booked ▦ + projected ◌ vs capacity ${cap.cap}/day</div>
      <div class="tw-bars"><span class="capline" style="bottom:${Math.round(cap.cap/maxv*58)+16}px"></span>
      ${days7.map(x => { const tot = x.booked + x.projected, over = tot > cap.cap;
        return `<div class="tw-bar" title="${fmtD(x.date)}: ${x.booked} booked + ${x.projected} projected">
          <span class="n${over?' over':''}">${tot||''}</span>
          ${x.projected?`<i class="gho" style="height:${Math.max(3,Math.round(x.projected/maxv*58))}px"></i>`:''}
          <i class="${over?'over':''}" style="height:${Math.max(2,Math.round(x.booked/maxv*58))}px"></i>
          <span class="d">${new Date(x.date+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span></div>`; }).join('')}
      </div></div>`;
  }

  document.getElementById('tower-radar').innerHTML =
    `<div class="ct-card-hd"><div><div class="ct-card-title">📡 Radar — what's coming</div>
      <div class="ct-card-sub">run-rate projections · hover any signal for its arithmetic</div></div>
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'delivery_calendar')}>Calendar →</button></div>
    <div style="padding:14px 16px">${loadHtml}
      ${sigs.length ? sigs.map(s => `<button class="tw-fc" title="Basis: ${h(s.basis)}" ${dataAct('navigate', s.nav)}>
        <span class="ic ${s.tone}">${s.ic}</span>
        <span class="m"><span class="h4">${s.h}</span><span class="p">${s.p}</span></span>
        <span class="eta ${s.tone}">${s.eta}</span></button>`).join('')
      : `<div style="padding:12px;text-align:center;color:var(--text-muted);font-size:.83rem">Clear skies — nothing projected to break ${winLabel}.</div>`}
    </div>`;

  // ── ranked action queue (always "now" — not horizon dependent) ──
  const q = [];
  if (d.at_risk) q.push({ sev:1, t:`Reschedule ${d.at_risk} overdue deliver${d.at_risk===1?'y':'ies'}`, s:'past date, undelivered', r:'now', nav:'delivery_calendar' });
  stAll.filter(s => s.days_cover <= 3).slice(0,2).forEach(s =>
    q.push({ sev:1, t:`Raise PO: ${h(s.name)}`, s:`${s.days_cover} day${s.days_cover===1?'':'s'} of cover left${s.critical?' · must-have':''}`, r:'~'+fmtD(s.runout), nav:'inventory' }));
  (d.ghosts||[]).filter(g => g.date <= isoOff(3)).slice(0,2).forEach(g =>
    q.push({ sev:2, t:`Confirm “${h(g.name)}” cycle`, s:`${h(g.client||'')} recurring — create or skip`, r:fmtD(g.date), nav:'delivery_calendar' }));
  if (bill && bill.unbilled) q.push({ sev:2, t:`Invoice ${bill.unbilled} delivered DC${bill.unbilled===1?'':'s'}`, s:`oldest ${bill.oldest_days||0} day${bill.oldest_days===1?'':'s'} unbilled`, r:`${bill.oldest_days||0}d idle`, nav:'dc_billing' });
  if (d.approvals_stale && d.approvals_stale.count) q.push({ sev:2, t:`Approve ${d.approvals_stale.count} order${d.approvals_stale.count===1?'':'s'} waiting > 24h`, s:`oldest ~${Math.round((d.approvals_stale.oldest_hours||24)/24)}d in the queue`, r:'> 24h', nav:'orders' });
  hot.slice(0,1).forEach(c => q.push({ sev:3, t:`Review ${h(c.name)} budget pace`, s:`projected ~${c.projected_pct}% of budget`, r:c.crossing?('~'+fmtD(c.crossing)):'month-end', nav:'exec_bi' }));
  q.sort((a,b2) => a.sev - b2.sev);

  document.getElementById('tower-queue').innerHTML =
    `<div class="ct-card-hd"><div><div class="ct-card-title">⚡ Needs you now</div>
      <div class="ct-card-sub">ranked by cost of waiting — the pill is the reason</div></div></div>
    <div style="padding:12px 14px">
      ${q.length ? q.map(x => `<button class="tw-aq" ${dataAct('navigate', x.nav)}>
        <span class="sev s${x.sev}"></span>
        <span class="m"><span class="h4">${x.t}</span><span class="p">${x.s}</span></span>
        <span class="r s${x.sev}">${x.r}</span></button>`).join('')
      : '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:.83rem">Queue clear — nothing needs you right now 🎉</div>'}
    </div>`;
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
      <div class="card" style="padding:16px 18px;border-top:3px solid ${pendingCount>0?'#d97706':'var(--success)'};margin-bottom:0;cursor:pointer" ${dataAct('navigate', 'vendor_pos')}>
        <div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px">Pending POs</div>
        <div style="font-size:1.9rem;font-weight:700;color:${pendingCount>0?'#d97706':'var(--navy)'};line-height:1">${pendingCount}</div>
        <div style="font-size:.75rem;color:${pendingCount>0?'#d97706':'var(--text-muted)'};margin-top:6px">${pendingCount>0?'awaiting action':'all clear'}</div>
      </div>`;
    })()}
  </div>
  <div class="card">
    <div class="card-header"><span>Pending Purchase Orders</span>
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'vendor_pos')}>View All</button>
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
    <button class="btn btn-primary btn-sm" ${dataAct('acceptPO', po.id, po.grand_total||0)}>Accept</button>
    <button class="btn btn-danger btn-sm" ${dataAct('rejectPO', po.id)}>Reject</button>`;
  if (po.status === 'ACCEPTED') return `
    <button class="btn btn-gold btn-sm" ${dataAct('dispatchPO', po.id)}>Mark Dispatched</button>`;
  if (po.status === 'DISPATCHED') return `
    <button class="btn btn-secondary btn-sm" ${dataAct('uploadInvoice', po.id)}>Upload Invoice</button>`;
  return `<span style="color:var(--text-muted);font-size:.8rem">${po.status}</span>`;
}

