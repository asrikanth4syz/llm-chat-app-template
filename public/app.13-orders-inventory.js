/* ============================================================
   ORDERS & INVENTORY — unified client hub (built from the mock)
   One shared orderer + approver view · quick-reorder led · warm voice.
   Additive: reuses existing endpoints (/orders, /client-inventory,
   /inventory) and existing actions (reorder, viewOrder, place_order).
   ============================================================ */
const OI_COPY = {
  title: 'Orders & Inventory',
  desc: "Reorder pantry essentials in a tap — and see exactly what's in stock, what's on the way, and when it lands.",
  tip: 'Reorder in a tap and track every delivery, live.',
  emptyH: "Let's stock your pantry",
  emptyB: 'Add your essentials once — then reorder anytime and track every delivery, live.',
};

// Client-facing milestones — collapse the internal FSM into four steps.
const OI_MILESTONES = [
  { label:'Submitted',   statuses:['DRAFT','PENDING_PRICING','SUBMITTED','PENDING_APPROVAL'] },
  { label:'Approved',    statuses:['APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','PICKED','QUALITY_CHECK'] },
  { label:'In shipment', statuses:['IN_SHIPMENT','PARTIALLY_CLOSED'] },
  { label:'Delivered',   statuses:['CLOSED','DELIVERED'] },
];
const OI_INPROGRESS = ['SUBMITTED','PENDING_APPROVAL','PENDING_PRICING','APPROVED','ACKNOWLEDGED','INVENTORY_CHECK','VENDOR_PO_RAISED','READY_TO_PICK','PICKED','QUALITY_CHECK','IN_SHIPMENT','PARTIALLY_CLOSED'];

async function renderOrdersInventory(el) {
  if (!APP._oiTab) APP._oiTab = 'order';
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:48px"><span class="u-muted">Loading your pantry…</span></div>`;
  const [orders, inv, catalog] = await Promise.all([
    api('/orders').catch(() => []),
    api('/client-inventory').catch(() => []),
    api('/inventory').catch(() => []),
  ]);
  APP._oiOrders = orders || [];
  APP._oiInv = inv || [];
  APP._catalog = catalog || [];

  el.innerHTML = `
  <div class="oi-head">
    <div style="min-width:0">
      <div style="font-size:1.25rem;font-weight:800;color:var(--navy)">${OI_COPY.title}</div>
      <div style="font-size:.85rem;color:var(--text-muted);margin-top:3px;max-width:48ch">${OI_COPY.desc}</div>
    </div>
    <div class="oi-seg" role="tablist">
      <button role="tab" class="${APP._oiTab==='order'?'active':''}" ${dataAct('oiSetTab','order')}>Order</button>
      <button role="tab" class="${APP._oiTab==='inventory'?'active':''}" ${dataAct('oiSetTab','inventory')}>Inventory</button>
    </div>
    ${canAccessPage('place_order') ? `<button class="btn btn-primary" ${dataAct('navigate','place_order')} style="font-weight:700;flex-shrink:0">${iconPlus(15)} Place order</button>` : ''}
  </div>
  <div id="oi-content"></div>`;
  oiRenderContent();
}

function oiSetTab(tab) {
  APP._oiTab = tab;
  const btns = document.querySelectorAll('.oi-seg button');
  btns.forEach(b => b.classList.remove('active'));
  btns[tab === 'inventory' ? 1 : 0]?.classList.add('active');
  oiRenderContent();
}

function oiRenderContent() {
  const wrap = document.getElementById('oi-content');
  if (!wrap) return;
  wrap.innerHTML = APP._oiTab === 'inventory' ? oiInventoryView() : oiOrderView();
}

/* ---- shared: 4-step tracker for one order ---- */
function oiTrackerHTML(order) {
  const activeIdx = OI_MILESTONES.findIndex(m => m.statuses.includes(order.status));
  if (order.status === 'CANCELLED') {
    return `<div style="padding:10px 12px;background:var(--danger-soft-bg,#fef2f2);border:1px solid #fecaca;border-radius:10px;color:var(--danger);font-weight:600;font-size:.85rem">This order was cancelled.</div>`;
  }
  return `<div class="timeline" style="margin:6px 0 2px">
    ${OI_MILESTONES.map((m,i) => {
      const reached = activeIdx >= i, now = activeIdx === i;
      return `<div class="timeline-step ${reached?'done':''}">
        <div class="timeline-dot">${reached && !now ? '✓' : ''}</div>
        <div class="timeline-label" style="${now?'font-weight:700':''}">${m.label}</div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ---- ORDER lens ---- */
function oiOrderView() {
  const orders = APP._oiOrders || [];
  const inv = APP._oiInv || [];
  const catalog = APP._catalog || [];
  const activeOrders = orders.filter(o => o.status !== 'DRAFT');
  const latest = orders.find(o => OI_INPROGRESS.includes(o.status)) || activeOrders[0] || null;
  const lastDelivered = orders.find(o => ['CLOSED','DELIVERED'].includes(o.status)) || activeOrders[0] || null;
  const low = inv.filter(i => i.stock_status === 'low' || i.stock_status === 'out');
  const usuals = catalog.slice(0, 6);

  // First-run: nothing ordered yet
  if (!activeOrders.length && !APP.cart.length) {
    return `<div class="card" style="text-align:center;padding:48px 20px;max-width:460px;margin:8px auto">
      <div style="font-size:2.4rem;margin-bottom:12px">🧺</div>
      <div style="font-size:1.35rem;font-weight:850;color:var(--navy);margin-bottom:8px">${OI_COPY.emptyH}</div>
      <div style="color:var(--text-muted);max-width:38ch;margin:0 auto 20px">${OI_COPY.emptyB}</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${canAccessPage('place_order') ? `<button class="btn btn-primary" ${dataAct('navigate','place_order')}>Place your first order</button>` : ''}
        <button class="btn btn-secondary" ${dataAct('navigate','place_order')}>Browse catalogue</button>
      </div>
    </div>`;
  }

  const trackerCard = latest ? `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div><div class="u-label2">Latest order</div><div style="font-weight:800;color:var(--navy)">${latest.id} · ${latest.item_count||0} items</div></div>
        ${statusBadge(latest.status)}
      </div>
      ${oiTrackerHTML(latest)}
      ${latest.predicted_delivery_date && OI_INPROGRESS.includes(latest.status)
        ? `<div style="margin-top:10px;font-size:.82rem;color:var(--primary);background:var(--primary-light,#e2f2f0);border-radius:9px;padding:8px 11px">🚚 Arriving <b>${fmtDate(latest.predicted_delivery_date)}</b></div>`
        : ''}
      <div style="margin-top:12px"><button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', latest.id)}>View order</button></div>
    </div>` : '';

  const reorderHero = lastDelivered ? `
    <div style="display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,var(--primary-light,#e2f2f0),transparent);border:1px solid var(--primary-border,#99f6e4);border-radius:12px;padding:14px;margin-top:14px">
      <div style="width:44px;height:44px;border-radius:11px;background:var(--primary);color:#fff;display:grid;place-items:center;font-size:1.3rem;flex-shrink:0">↻</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;color:var(--navy)">Reorder your last order</div>
        <div style="font-size:.8rem;color:var(--text-muted)">${lastDelivered.item_count||0} items · ${fmt(lastDelivered.grand_total)} · ${fmtDate(lastDelivered.created_at)}</div>
      </div>
      <button class="btn btn-gold" ${dataAct('reorderToCart', lastDelivered.id)}>Reorder all</button>
    </div>` : '';

  const usualTiles = usuals.length ? `
    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <div style="font-weight:800;color:var(--navy);font-size:.95rem">Your usuals</div>
        <span class="u-subtiny">Tap + to add to your order</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px">
        ${usuals.map(it => `
          <div style="border:1px solid var(--border);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px">
            <div style="width:40px;height:40px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;font-size:1.2rem">${it.emoji||'📦'}</div>
            <div style="font-weight:700;font-size:.84rem;line-height:1.25">${h(it.name)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;gap:8px">
              <span style="font-weight:800;font-size:.88rem">${fmt(it.unit_price)}</span>
              <div class="oi-stepper">
                <button ${dataAct('oiDecUsual', it.sku)} aria-label="Decrease quantity">−</button>
                <input class="oi-qty" type="number" min="0" inputmode="numeric" value="${oiCartQty(it.sku)}" data-sku="${it.sku}" ${dataChangeEl('oiSetUsualQty')} aria-label="Quantity">
                <button ${dataAct('oiIncUsual', it.sku)} aria-label="Increase quantity">+</button>
              </div>
            </div>
          </div>`).join('')}
      </div>
    </div>` : '';

  const lowCard = low.length ? `
    <div class="card" style="margin-top:14px;background:var(--surface-2)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:800;color:var(--navy);font-size:.92rem">Running low — reorder before you run out</div>
        <span class="badge badge-warning">${low.length} item${low.length!==1?'s':''}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
        ${low.slice(0,5).map(i => `
          <div style="display:flex;align-items:center;gap:11px;border:1px solid var(--border);border-radius:11px;padding:9px 12px;background:#fff">
            <div style="flex:1;min-width:0"><b style="font-size:.86rem">${h(i.item_name)}</b><small style="display:block;color:var(--text-muted);font-size:.74rem" class="tnum">${i.qty_on_hand||0} left · reorder point ${i.reorder_level||0}</small></div>
            <span class="badge ${i.stock_status==='out'?'badge-danger':'badge-warning'}">${i.stock_status==='out'?'Out soon':'Low'}</span>
            <button class="btn btn-secondary btn-sm" ${dataAct('oiAddUsual', i.sku)}>Add</button>
          </div>`).join('')}
      </div>
    </div>` : '';

  return `<div style="display:grid;grid-template-columns:1fr;gap:16px" class="oi-grid">
    <div>
      ${trackerCard}
      ${reorderHero}
      ${usualTiles}
      ${lowCard}
    </div>
    <div><div id="oi-rail">${oiRailHTML()}</div></div>
  </div>`;
}

/* ---- order summary rail (reflects APP.cart) ---- */
function oiRailHTML() {
  const cart = APP.cart || [];
  const subtotal = cart.reduce((s,i) => s + i.qty * i.unit_price, 0);
  const gst = Math.round(subtotal * 0.18);
  return `<div class="card" style="position:sticky;top:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <div style="font-weight:800;color:var(--navy);font-size:.95rem">Your order</div>
      <span title="${OI_COPY.tip}" style="width:16px;height:16px;border:1px solid var(--border);border-radius:50%;display:inline-grid;place-items:center;font-size:.66rem;color:var(--text-muted);cursor:help">i</span>
    </div>
    ${cart.length ? cart.map(i => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--border)">
        <div style="width:30px;height:30px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center">${i.emoji||'📦'}</div>
        <div style="flex:1;min-width:0"><b style="font-size:.82rem;font-weight:650">${h(i.name)}</b><small style="display:block;color:var(--text-muted);font-size:.72rem" class="tnum">${i.qty} × ${fmt(i.unit_price)}</small></div>
        <span style="font-weight:700;font-size:.84rem" class="tnum">${fmt(i.qty*i.unit_price)}</span>
      </div>`).join('') + `
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:.85rem">
        <div style="display:flex;justify-content:space-between;color:var(--text-muted)"><span>Subtotal</span><span class="tnum">${fmt(subtotal)}</span></div>
        <div style="display:flex;justify-content:space-between;color:var(--text-muted)"><span>GST (18%)</span><span class="tnum">${fmt(gst)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:850;font-size:1.05rem;border-top:1px solid var(--border);padding-top:10px;margin-top:4px"><span>Total</span><span class="tnum">${fmt(subtotal+gst)}</span></div>
      </div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px" ${dataAct('reviewPlaceOrder')}>Review &amp; place order</button>
      <div style="font-size:.72rem;color:var(--text-muted);text-align:center;margin-top:9px">We'll notify you at each step.</div>`
    : `<div style="text-align:center;padding:20px 8px;color:var(--text-muted);font-size:.84rem">
        Your order is empty. Add your usuals or reorder your last order to get started.
      </div>`}
  </div>`;
}

function oiRefreshRail() {
  persistCart();
  const rail = document.getElementById('oi-rail');
  if (rail) rail.innerHTML = oiRailHTML();
}

// Quantity for a SKU currently in the cart (0 if not added).
function oiCartQty(sku) { const c = (APP.cart || []).find(x => x.sku === sku); return c ? c.qty : 0; }

// Set the cart quantity for a usual directly (0 removes it). Updates that tile's
// input + the order rail without a full re-render, so typing stays smooth.
function oiSetCartQty(sku, qty) {
  qty = Math.max(0, Math.floor(Number(qty) || 0));
  const item = (APP._catalog || []).find(i => i.sku === sku);
  APP.cart = APP.cart || [];
  const idx = APP.cart.findIndex(c => c.sku === sku);
  if (qty === 0) { if (idx >= 0) APP.cart.splice(idx, 1); }
  else if (idx >= 0) APP.cart[idx].qty = qty;
  else APP.cart.push({ sku, name: item ? item.name : sku, qty, unit_price: item ? item.unit_price : 0, emoji: item?.emoji || '📦' });
  const inp = document.querySelector(`.oi-qty[data-sku="${sku}"]`);
  if (inp) inp.value = qty;
  oiRefreshRail();
}
function oiIncUsual(sku) { oiSetCartQty(sku, oiCartQty(sku) + 1); }
function oiDecUsual(sku) { oiSetCartQty(sku, oiCartQty(sku) - 1); }
function oiSetUsualQty(el) { oiSetCartQty(el.dataset.sku, el.value); }

function oiAddUsual(sku) {
  const item = (APP._catalog || []).find(i => i.sku === sku);
  const name = item ? item.name : sku;
  const price = item ? item.unit_price : 0;
  const existing = (APP.cart = APP.cart || []).find(c => c.sku === sku);
  if (existing) existing.qty += 1;
  else APP.cart.push({ sku, name, qty: 1, unit_price: price, emoji: item?.emoji || '📦' });
  showToast(`Added ${name} to your order`);
  oiRefreshRail();
}

async function reorderToCart(orderId) {
  const order = await api('/orders/' + orderId);
  if (!order || !order.items) { showToast('Could not load that order', 'error'); return; }
  APP.cart = APP.cart || [];
  order.items.forEach(i => {
    const item = (APP._catalog || []).find(it => it.sku === i.sku || it.name === i.name);
    const price = item ? item.unit_price : (i.unit_price || 0);
    const key = i.sku || i.name;
    const ex = APP.cart.find(c => c.sku === key);
    if (ex) ex.qty += i.qty;
    else APP.cart.push({ sku: key, name: i.name, qty: i.qty, unit_price: price, emoji: item?.emoji || '📦' });
  });
  showToast("Your last order's in the cart — adjust and place");
  oiRefreshRail();
}

/* ---- INVENTORY lens ---- */
function oiInventoryView() {
  const inv = APP._oiInv || [];
  const orders = APP._oiOrders || [];
  const inStock = inv.filter(i => i.stock_status !== 'low' && i.stock_status !== 'out').length;
  const low = inv.filter(i => i.stock_status === 'low').length;
  const out = inv.filter(i => i.stock_status === 'out').length;
  const dueOrders = orders.filter(o => OI_INPROGRESS.includes(o.status));
  const onTheWay = dueOrders.reduce((s,o) => s + (o.total_qty || 0), 0);

  if (!inv.length) {
    return `<div class="card" style="text-align:center;padding:44px 20px;max-width:460px;margin:8px auto">
      <div style="font-size:2.2rem;margin-bottom:12px">📦</div>
      <div style="font-size:1.15rem;font-weight:800;color:var(--navy);margin-bottom:6px">Nothing to track yet</div>
      <div style="color:var(--text-muted);max-width:40ch;margin:0 auto 18px">Place an order and your stock shows up here — with live counts and low-stock alerts.</div>
      ${canAccessPage('place_order') ? `<button class="btn btn-primary" ${dataAct('navigate','place_order')}>Place an order</button>` : ''}
    </div>`;
  }

  const kpi = (label, val, sub, color) => `
    <div class="card" style="padding:14px 16px;border-top:3px solid ${color};margin:0">
      <div class="u-label2">${label}</div>
      <div style="font-size:1.7rem;font-weight:850;color:var(--navy);line-height:1;margin-top:4px" class="tnum">${val}</div>
      <div class="u-subtiny">${sub}</div>
    </div>`;

  const skuCard = i => {
    const onHand = i.qty_on_hand || 0;
    const reorder = i.reorder_level || 0;
    // Target stock level ("par") derived from the reorder point so the bar stays
    // meaningful and doesn't just equal on-hand for well-stocked items.
    const par = Math.max(reorder * 3, reorder + 10, 1);
    const pct = Math.max(3, Math.min(100, Math.round(onHand / par * 100)));
    const fill = i.stock_status === 'out' ? 'var(--danger)' : i.stock_status === 'low' ? 'var(--warning)' : 'var(--success)';
    const pill = i.stock_status === 'out' ? 'badge-danger' : i.stock_status === 'low' ? 'badge-warning' : 'badge-success';
    const pillTxt = i.stock_status === 'out' ? 'Out' : i.stock_status === 'low' ? 'Low' : 'In stock';
    return `<div class="card" style="margin:0">
      <div style="display:flex;align-items:center;gap:11px;margin-bottom:11px">
        <div style="width:42px;height:42px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;font-size:1.2rem;flex-shrink:0">${i.emoji||'📦'}</div>
        <div style="min-width:0;flex:1"><div class="oi-sku-name" style="font-weight:750;font-size:.9rem" title="${h(i.item_name)}">${h(i.item_name)}</div><div class="u-subtiny oi-sku-name">${h(i.category||'—')}${i.uom?` · ${h(i.uom)}`:''}</div></div>
        <div class="oi-sku-onhand"><b class="tnum">${onHand}</b><small style="display:block;font-size:.66rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">on hand</small></div>
      </div>
      <div style="height:8px;border-radius:99px;background:var(--surface-3,#e6edeb);overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${fill}"></i></div>
      <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-top:6px"><span>Reorder at ${reorder}</span><span>Par ${par}</span></div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:11px;font-size:.76rem;flex-wrap:wrap">
        <span class="badge ${pill}">${pillTxt}</span>
        ${i.last_received_at ? `<span style="color:var(--text-muted)">Last received ${fmtDate(i.last_received_at)}</span>` : ''}
        ${(i.stock_status==='low'||i.stock_status==='out')
          ? `<a role="button" tabindex="0" style="margin-left:auto;color:var(--primary);font-weight:700;cursor:pointer" ${dataAct('oiAddUsual', i.sku)}>Reorder now →</a>`
          : (i.last_consumed_at ? `<span style="margin-left:auto;color:var(--text-muted)">Last used ${fmtDate(i.last_consumed_at)}</span>` : '')}
      </div>
    </div>`;
  };

  const dueHTML = dueOrders.length ? `
    <div class="card" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:800;color:var(--navy);font-size:.95rem">Due items — ordered, not yet delivered</div>
        <span class="badge badge-info">${dueOrders.length} order${dueOrders.length!==1?'s':''}</span>
      </div>
      ${dueOrders.slice(0,6).map(o => `
        <div style="display:flex;align-items:center;gap:14px;border:1px solid var(--border);border-radius:11px;padding:11px 13px;margin-top:9px;flex-wrap:wrap;cursor:pointer" ${dataAct('viewOrder', o.id)}>
          <div style="min-width:140px"><b style="font-size:.86rem">${o.id}</b><small style="display:block;color:var(--text-muted);font-size:.74rem" class="tnum">${o.item_count||0} items · ${fmtDate(o.created_at)}</small></div>
          <div style="flex:1;min-width:160px">${statusBadge(o.status)}</div>
          <span class="btn btn-secondary btn-sm">View</span>
        </div>`).join('')}
    </div>` : '';

  return `
    <div class="oi-kpis">
      ${kpi('In stock', inStock, 'healthy levels', 'var(--success)')}
      ${kpi('Running low', low, 'below reorder point', low?'var(--warning)':'var(--border)')}
      ${kpi('Out', out, 'needs ordering', out?'var(--danger)':'var(--border)')}
      ${kpi('On the way', onTheWay, `${dueOrders.length} deliveries`, 'var(--primary)')}
    </div>
    <div class="oi-inv-grid">
      ${inv.slice(0,12).map(skuCard).join('')}
    </div>
    ${dueHTML}`;
}
