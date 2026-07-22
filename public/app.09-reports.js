/* ============================================================
   REPORTS (Gaps 1 & 12 — real data + CSV download)
   ============================================================ */
const REPORT_DEFS = [
  { key:'spend',       title:'Spend Analytics',    desc:'Monthly spend and order count per client.', icon:'📊', datable:true,
    cols:['client','month','total_spend','order_count'],
    labels:['Client','Month','Total Spend','Orders'] },
  { key:'fulfilment',  title:'Order Fulfilment',   desc:'Order-to-delivery cycle time and SLA adherence.', icon:'📦', datable:true,
    cols:['id','client_name','status','grand_total','created_at'],
    labels:['Order','Client','Status','Amount','Created'] },
  { key:'vendor',      title:'Vendor Scorecard',   desc:'On-time rate, fill rate, and lead time per vendor.', icon:'🏆', datable:true,
    cols:['name','on_time_rate','fill_rate','avg_lead_days','rating'],
    labels:['Vendor','On-time %','Fill Rate %','Lead Days','Rating'] },
  { key:'inventory',   title:'Inventory Turnover', desc:'Stock movement, dead stock, fast & slow SKUs.', icon:'🔄', period:'Live snapshot',
    cols:['sku','name','category','stock','reserved','reorder_level'],
    labels:['SKU','Item','Category','Stock','Reserved','Reorder Level'] },
  { key:'budget',      title:'Budget Utilisation', desc:'Client-wise budget vs. actual spend.', icon:'💰', period:'Current calendar month',
    cols:['name','monthly_budget','spent_this_month','remaining'],
    labels:['Client','Budget','Spent','Remaining'] },
  { key:'dc-billing',  title:'DC Billing Report',  desc:'Billing pipeline, unbilled DCs, and ageing.', icon:'🧾', period:'All time',
    cols:['id','order_id','client_name','status','billed'],
    labels:['DC #','Order','Client','Status','Billed'] },
  { key:'service-desk',title:'Service Desk SLA',   desc:'Ticket resolution time and open ticket ageing.', icon:'🎫', period:'All time',
    cols:['id','subject','priority','status','client_name','created_at'],
    labels:['Ticket','Subject','Priority','Status','Client','Created'] },
  { key:'gst',         title:'GST & Tax Report',   desc:'HSN-wise GST breakup and summary for filing.', icon:'📋', datable:true,
    cols:['sku','name','hsn_code','gst_rate','stock','unit_price'],
    labels:['SKU','Item','HSN','GST %','Stock','Unit Price'] },
  { key:'budget-forecast', title:'Budget Forecasting', desc:'3-month rolling average forecast per client for next month.', icon:'🔮', period:'Next month (3-month rolling average)',
    cols:['client','forecast_month','predicted'],
    labels:['Client','Forecast Month','Predicted Spend'] },
  { key:'order-items', title:'Order Items vs Delivered', desc:'Per-order item breakdown: items ordered, quantities, and delivery status per client.', icon:'📦', period:'All time',
    cols:['client_name','order_id','order_status','item_count','qty_ordered','delivery_status','grand_total'],
    labels:['Client','Order ID','Status','# Items','Total Qty Ordered','Delivery Status','Order Value'] },
  { key:'critical-stock', title:'Critical Stock Report', desc:'All items flagged CRITICAL — shows stock level, reorder status, and vendor details.', icon:'🔴', period:'Live snapshot',
    cols:['sku','name','category','stock','reorder_level','status','vendor_name','avg_lead_days'],
    labels:['SKU','Item','Category','Stock','Reorder Level','Status','Vendor','Lead Days'] },
];

const REPORT_CATEGORIES = [
  { label:'Operations', color:'#1e40af', bg:'#eff6ff', icon:'⚙️',
    keys:['fulfilment','order-items','dc-billing','service-desk'] },
  { label:'Finance', color:'#065f46', bg:'#ecfdf5', icon:'💰',
    keys:['spend','budget','budget-forecast','gst'] },
  { label:'Supply Chain', color:'#92400e', bg:'#fffbeb', icon:'🔗',
    keys:['vendor','inventory','critical-stock'] },
];

/* ============================================================
   EXECUTIVE BI — filter bar + drill: Exec → Client → Order →
   Category → Sub-category → Brand → SKU  (Phase 1)
   ============================================================ */
const EXEC_LEVELS = ['exec','client','order','category','subcat','brand','sku','dc','invoice'];
const EXEC_LEVEL_NAME = { exec:'Executive', client:'Client', order:'Order', category:'Category', subcat:'Sub Category', brand:'Brand', sku:'SKU / Item', dc:'Delivery Challan', invoice:'Invoice' };
let _xbi = null; // { from,to,timeLabel, path:[{level,label,ctx}] }

function xbiPreset(preset) {
  const now = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const map = {
    today:      [ymd(now), ymd(now), 'Today'],
    week:       [ymd(new Date(Date.now()-6*86400000)), ymd(now), 'This Week'],
    month:      [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, ymd(now), 'This Month'],
    quarter:    (()=>{ const m=now.getMonth(); const qs=m>=3&&m<=5?3:m>=6&&m<=8?6:m>=9?9:0; const y=(m<3)?now.getFullYear():now.getFullYear(); return [ymd(new Date(now.getFullYear(),qs,1)), ymd(now), 'Quarter']; })(),
    fy:         (()=>{ const y=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1; return [`${y}-04-01`, ymd(now), 'Financial Year']; })(),
    cy:         [`${now.getFullYear()}-01-01`, ymd(now), 'Calendar Year'],
  };
  return map[preset] || map.month;
}

async function renderExecBI(el) {
  if (!_xbi) { const [f,t,l] = xbiPreset('month'); _xbi = { from:f, to:t, timeLabel:l, preset:'month', path:[{level:'exec',label:'Executive',ctx:{}}] }; }
  el.innerHTML = `
  ${pageHeader('Executive BI', 'Company-wide KPIs — click any client, order, category or item to drill deeper')}
  <div class="card" style="padding:12px 16px;margin-bottom:16px">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      ${[['today','Today'],['week','This Week'],['month','This Month'],['quarter','Quarter'],['fy','Financial Year'],['cy','Calendar Year']]
        .map(([k,l])=>`<button class="btn btn-sm" id="xbi-t-${k}" ${dataAct('xbiSetPreset', k)} style="font-size:.76rem;${_xbi.preset===k?'':''}">${l}</button>`).join('')}
      <div style="width:1px;height:20px;background:var(--border);margin:0 4px"></div>
      <input type="date" id="xbi-from" class="form-control" style="max-width:150px;font-size:.8rem" value="${_xbi.from}">
      <span style="font-size:.8rem;color:var(--text-muted)">to</span>
      <input type="date" id="xbi-to" class="form-control" style="max-width:150px;font-size:.8rem" value="${_xbi.to}">
      <button class="btn btn-primary btn-sm" ${dataAct('xbiApplyCustom')}>Apply</button>
      <span style="margin-left:auto;font-size:.78rem;color:var(--text-muted)">Period: <b id="xbi-period-lbl" style="color:var(--primary-ink,#0f766e)">${_xbi.timeLabel}</b></span>
    </div>
  </div>
  <style>
    #xbi-layout{display:grid;grid-template-columns:210px 1fr;gap:16px;align-items:start}
    @media(max-width:820px){#xbi-layout{grid-template-columns:1fr}#xbi-rail{display:none}}
    #xbi-rail{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 12px;position:sticky;top:16px}
    .xbi-rail-title{font-size:.62rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--text-muted);padding:0 8px 10px}
    .xbi-step{display:flex;align-items:center;gap:11px;padding:7px 8px;border-radius:9px;font-size:.79rem;color:var(--text-muted);position:relative;transition:background .12s}
    .xbi-step[onclick]:hover{background:var(--surface-2)}
    .xbi-step .xbi-idx{width:20px;height:20px;border-radius:50%;background:var(--border-light);color:var(--text-muted);font-size:.64rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;transition:.18s}
    .xbi-step.done{color:var(--navy)} .xbi-step.done .xbi-idx{background:var(--primary-border);color:var(--primary-hover)}
    .xbi-step.active{color:var(--navy);font-weight:700} .xbi-step.active .xbi-idx{background:var(--primary);color:#fff;box-shadow:0 0 0 4px var(--primary-light)}
    .xbi-step::before{content:"";position:absolute;left:17.5px;top:-7px;height:7px;width:2px;background:var(--border)}
    .xbi-step:first-of-type::before{display:none}
    .xbi-step.done::before,.xbi-step.active::before{background:var(--primary-border)}
    .xbi-kpi.clk{cursor:pointer;transition:border-color .12s,transform .12s}
    .xbi-kpi.clk:hover{border-color:var(--primary);transform:translateY(-2px);box-shadow:0 4px 14px -6px rgba(0,0,0,.15)}
    .xbi-row:hover .xbi-chev{transform:translateX(2px);color:var(--primary)}
  </style>
  <div id="xbi-layout">
    <aside id="xbi-rail"></aside>
    <div style="min-width:0">
      <div id="xbi-crumbs" style="margin-bottom:10px"></div>
      <div id="xbi-levelbar" style="margin-bottom:12px"></div>
      <div id="xbi-body"><div style="text-align:center;padding:50px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div></div>
    </div>
  </div>`;
  xbiHighlightPreset();
  xbiRender();
}

function xbiRail() {
  const rail = document.getElementById('xbi-rail');
  if (!rail) return;
  const depth = _xbi.path.length - 1;
  rail.innerHTML = '<div class="xbi-rail-title">Drill path</div>' + EXEC_LEVELS.map((lv,i)=>{
    const cls = i<depth ? 'done' : i===depth ? 'active' : '';
    const visited = i <= depth;
    return `<div class="xbi-step ${cls}" ${visited?`${dataAct('xbiGoTo', i)}`:''}><span class="xbi-idx">${i+1}</span><span>${EXEC_LEVEL_NAME[lv]}</span></div>`;
  }).join('');
}

function xbiHighlightPreset() {
  ['today','week','month','quarter','fy','cy'].forEach(k=>{
    const b=document.getElementById('xbi-t-'+k);
    if (b) b.classList.toggle('btn-primary', _xbi.preset===k);
  });
}
function xbiSyncLabel(){ const lab=document.getElementById('xbi-period-lbl'); if(lab)lab.textContent=_xbi.timeLabel; }
function xbiSetPreset(k){ const [f,t,l]=xbiPreset(k); _xbi.from=f; _xbi.to=t; _xbi.timeLabel=l; _xbi.preset=k;
  const fe=document.getElementById('xbi-from'), te=document.getElementById('xbi-to'); if(fe)fe.value=f; if(te)te.value=t;
  xbiHighlightPreset(); xbiSyncLabel(); xbiRender(); }
function xbiApplyCustom(){ _xbi.from=document.getElementById('xbi-from').value; _xbi.to=document.getElementById('xbi-to').value; _xbi.timeLabel='Custom'; _xbi.preset=''; xbiHighlightPreset(); xbiSyncLabel(); xbiRender(); }

function xbiCrumbs() {
  const c = document.getElementById('xbi-crumbs');
  if (!c) return;
  c.innerHTML = '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:.85rem">' +
    _xbi.path.map((p,i)=>{
      const last = i===_xbi.path.length-1;
      return (i?'<span style="color:var(--text-muted)">›</span>':'')+
        `<button ${dataAct('xbiGoTo', i)} ${last?'disabled':''} style="background:${last?'none':'none'};border:none;cursor:${last?'default':'pointer'};font-size:.85rem;font-weight:${last?'700':'600'};color:${last?'var(--navy)':'var(--blue)'};padding:3px 6px;border-radius:6px">${h(p.label)}</button>`;
    }).join('') + '</div>';
}
function xbiGoTo(i){ _xbi.path = _xbi.path.slice(0,i+1); xbiRender(); }
function xbiPush(level, label, ctx){ _xbi.path.push({level,label,ctx:{..._xbi.path[_xbi.path.length-1].ctx, ...ctx}}); xbiRender(); }

// Build query string for the current context (order_id scopes; else client_id + dates)
function xbiScopeParams(ctx) {
  const p = new URLSearchParams();
  if (ctx.order_id) p.set('order_id', ctx.order_id);
  else {
    if (ctx.client_id) p.set('client_id', ctx.client_id);
    p.set('from', _xbi.from); p.set('to', _xbi.to);
  }
  ['category','subcategory','brand'].forEach(k=>{ if (ctx[k]!=null) p.set(k, ctx[k]); });
  return p;
}

async function xbiRender() {
  xbiCrumbs();
  xbiRail();
  const node = _xbi.path[_xbi.path.length-1];
  const lvlIdx = EXEC_LEVELS.indexOf(node.level);
  const lb = document.getElementById('xbi-levelbar');
  if (lb) lb.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--primary-hover)">◉ Level ${lvlIdx+1} · ${EXEC_LEVEL_NAME[node.level]}</span>
      <span style="font-size:1.15rem;font-weight:800;color:var(--navy)">${h(node.label)}</span>
      <span style="margin-left:auto;font-size:.74rem;color:var(--text-muted)">${_xbi.timeLabel}</span>
    </div>`;
  const body = document.getElementById('xbi-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:22px;height:22px;margin:0 auto"></div></div>';
  const fn = { exec:xbiExec, client:xbiClient, order:xbiOrder, category:xbiGroup, subcat:xbiGroup, brand:xbiGroup, sku:xbiSku, dc:xbiDc, invoice:xbiInvoice }[node.level];
  try { await fn(node, body); } catch(e) { body.innerHTML = `<div class="alert alert-danger">Failed to load: ${h(String(e))}</div>`; }
}

function xbiKpi(lab,val,sub,cls,onclick){
  return `<div class="card xbi-kpi ${onclick?'clk':''}" style="padding:11px 13px;margin-bottom:0;position:relative" ${onclick?`onclick="${onclick}"`:''}>
    <div style="font-size:.62rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)">${lab}</div>
    <div style="font-size:1.28rem;font-weight:800;line-height:1.15;margin-top:3px;color:${cls==='g'?'var(--success)':cls==='w'?'#d97706':cls==='b'?'var(--danger)':'var(--navy)'}">${val}</div>
    ${sub?`<div style="font-size:.68rem;color:var(--text-muted);margin-top:1px">${sub}</div>`:''}
    ${onclick?'<span style="position:absolute;top:9px;right:11px;color:var(--text-muted);font-size:.72rem;font-weight:700">↘</span>':''}
  </div>`;
}
function xbiGrp(title, cards){
  return `<div style="font-size:.64rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted);margin:14px 0 8px">${title}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:9px">${cards.join('')}</div>`;
}
function xbiFillPill(p){ const c=p>=90?['#e7f6ec','var(--success)']:p>=70?['#fdf0dc','#d97706']:['#fdeaea','var(--danger)']; return `<span style="font-size:.66rem;font-weight:800;padding:2px 8px;border-radius:20px;background:${c[0]};color:${c[1]}">${p}% fill</span>`; }
function xbiRow(name, meta, val, opts={}){
  const share = opts.share!=null?`<div style="display:flex;align-items:center;gap:8px;min-width:130px"><div style="flex:1;height:8px;border-radius:5px;background:var(--border);overflow:hidden"><i style="display:block;height:100%;width:${opts.share}%;background:var(--primary)"></i></div><span style="font-size:.74rem;font-weight:700;color:var(--text-muted);width:34px;text-align:right">${opts.share}%</span></div>`:'';
  const pill = opts.fill!=null?`<div style="margin-top:4px">${xbiFillPill(opts.fill)}</div>`:'';
  return `<button class="xbi-row" data-k="${h(opts.key||name)}" style="display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--border);border-radius:10px;background:var(--surface,#fff);cursor:pointer;text-align:left;font-family:inherit;width:100%;transition:border-color .12s,transform .12s" onmouseover="this.style.borderColor='var(--primary)';this.style.transform='translateX(2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--navy);font-size:.87rem">${h(name)}</div><div style="font-size:.72rem;color:var(--text-muted);margin-top:1px">${meta}</div></div>
    ${share}
    <div style="text-align:right;flex-shrink:0"><div style="font-weight:800;font-size:.9rem">${val}</div>${pill}</div>
    <span class="xbi-chev" style="color:var(--text-muted);transition:transform .12s,color .12s">›</span>
  </button>`;
}

async function xbiExec(node, body) {
  const p = new URLSearchParams({ from:_xbi.from, to:_xbi.to });
  const d = await api('/reports/exec-summary?'+p.toString());
  if (!d) { body.innerHTML='<div class="alert alert-danger">No data</div>'; return; }
  const o=d.orders, dl=d.delivery, f=d.finance, iv=d.inventory;
  const clients = (d.clients||[]).filter(c=>c.spend>0 || c.order_count>0);
  const maxSpend = Math.max(...clients.map(c=>c.spend), 1);
  body.innerHTML = `
    ${xbiGrp('Orders',[
      xbiKpi('Total Orders', o.total, '', null), xbiKpi('Order Value', fmt(o.value), 'gross'),
      xbiKpi('Avg Order', fmt(o.avg), ''), xbiKpi('Completed', o.completed, '', 'g'),
      xbiKpi('Partial', o.partial, '', o.partial?'w':null), xbiKpi('Pending', o.pending, 'in progress', o.pending?'w':null)])}
    ${xbiGrp('Delivery',[
      xbiKpi('Fulfilment %', dl.fill_pct+'%', '', dl.fill_pct>=90?'g':dl.fill_pct>=70?'w':'b'),
      xbiKpi('Due Qty', Math.round(dl.due_qty), 'units', dl.due_qty?'b':null),
      xbiKpi('Due Value', fmt(dl.due_value), '', dl.due_value?'b':null),
      xbiKpi('Awaiting Dispatch', dl.awaiting_dispatch, ''), xbiKpi('Awaiting Procurement', dl.awaiting_procurement, '')])}
    ${xbiGrp('Finance',[
      xbiKpi('Budget', fmt(f.budget), ''), xbiKpi('Spend', fmt(f.spend), f.budget_util+'% used'),
      xbiKpi('Budget Util %', f.budget_util+'%', '', f.budget_util>90?'b':f.budget_util>70?'w':null),
      xbiKpi('Revenue', fmt(f.revenue), ''), xbiKpi('Gross Margin', f.gross_margin!=null?f.gross_margin+'%':'—', f.gross_margin!=null?'':'no cost data', f.gross_margin!=null?'g':null)])}
    ${xbiGrp('Inventory',[
      xbiKpi('Inventory Value', fmt(iv.value), ''), xbiKpi('Stock Availability', iv.availability+'%', '', iv.availability>=90?'g':'w'),
      xbiKpi('Must-Have %', iv.must_have+'%', '', iv.must_have>=95?'g':'w'),
      xbiKpi('Low Stock', iv.low_stock, 'items', iv.low_stock?'w':null), xbiKpi('Stock-Out', iv.stock_out, 'alerts', iv.stock_out?'b':null)])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Clients by spend <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px" id="xbi-rows">
      ${clients.length ? clients.map(c=>xbiRow(c.name, `${c.order_count} orders · ${c.budget_util}% budget`, fmt(c.spend), {share:Math.round(c.spend/maxSpend*100), fill:c.fill_pct, key:c.id})).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No orders in this period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>{
    const c = clients.find(x=>String(x.id)===b.dataset.k); if(!c)return;
    xbiPush('client', c.name, { client_id: c.id });
  });
}

async function xbiClient(node, body) {
  const cid = node.ctx.client_id;
  const [d, orders] = await Promise.all([
    api(`/reports/exec-summary?from=${_xbi.from}&to=${_xbi.to}&client_id=${cid}`),
    api(`/orders?client_id=${cid}`).catch(()=>[]),
  ]);
  const o=d?.orders||{}, dl=d?.delivery||{}, f=d?.finance||{};
  const scoped = (orders||[]).filter(x=>x.created_at>=_xbi.from && x.created_at<=_xbi.to+'T23:59:59' && !['CANCELLED','DRAFT'].includes(x.status));
  body.innerHTML = `
    ${xbiGrp('Client — '+h(node.label),[
      xbiKpi('Orders', o.total||0, ''), xbiKpi('Order Value', fmt(o.value||0), ''),
      xbiKpi('Fulfilment', (dl.fill_pct||0)+'%', '', (dl.fill_pct||0)>=90?'g':'w'),
      xbiKpi('Budget Util', (f.budget_util||0)+'%', '', (f.budget_util||0)>90?'b':(f.budget_util||0)>70?'w':null),
      xbiKpi('Due Value', fmt(dl.due_value||0), '', dl.due_value?'b':null),
      xbiKpi('Pending', o.pending||0, '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Orders <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${scoped.length ? scoped.map(ord=>xbiRow(ord.id, `${fmtDate(ord.created_at)} · ${(ord.status||'').replace(/_/g,' ')}`, fmt(ord.grand_total), {key:ord.id})).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No orders for this client in the period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('order', b.dataset.k, { order_id: b.dataset.k, client_id: cid }));
}

async function xbiOrder(node, body) {
  const oid = node.ctx.order_id;
  const [order, cats] = await Promise.all([
    api('/orders/'+oid).catch(()=>null),
    api('/reports/drill?level=category&order_id='+encodeURIComponent(oid)),
  ]);
  const rows = (cats?.rows||[]).filter(r=>r.ordered_qty>0);
  const totOrd = rows.reduce((s,r)=>s+r.ordered_value,0)||1;
  const fill = order ? null : null;
  body.innerHTML = `
    ${xbiGrp('Order '+h(oid),[
      xbiKpi('Order Value', fmt(order?.grand_total||0), 'incl GST'),
      xbiKpi('Status', (order?.status||'—').replace(/_/g,' '), '', order?.status==='CLOSED'?'g':'w'),
      xbiKpi('Lines', (order?.items||[]).length, ''),
      xbiKpi('Client', order?.client_name||'—', ''),
      xbiKpi('Placed', order?.created_at?fmtDate(order.created_at):'—', ''),
      xbiKpi('For', order?.order_period?new Date(order.order_period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'—', '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Category breakdown <span style="font-weight:400;color:var(--faint)">— click a category to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${rows.length ? rows.map(r=>{ const fillp=r.ordered_qty?Math.round(r.delivered_qty/r.ordered_qty*100):0;
        return xbiRow(r.name, `${Math.round(r.ordered_qty)} ordered`, fmt(r.ordered_value), {share:Math.round(r.ordered_value/totOrd*100), fill:fillp, key:r.name}); }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No line items.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('category', b.dataset.k, { category: b.dataset.k }));
}

// Generic group level: category→subcat→brand→sku
async function xbiGroup(node, body) {
  const levelMap = { category:'subcategory', subcat:'brand', brand:'sku' };
  const nextApiLevel = levelMap[node.level];
  const p = xbiScopeParams(node.ctx); p.set('level', nextApiLevel);
  const d = await api('/reports/drill?'+p.toString());
  const rows = (d?.rows||[]).filter(r=>r.ordered_qty>0);
  const totOrd = rows.reduce((s,r)=>s+r.ordered_value,0)||1;
  const totQ = rows.reduce((s,r)=>s+r.ordered_qty,0), totD = rows.reduce((s,r)=>s+r.delivered_qty,0);
  const label = { category:'Sub-categories', subcat:'Brands', brand:'SKUs / items' }[node.level];
  body.innerHTML = `
    ${xbiGrp(EXEC_LEVEL_NAME[node.level]+' — '+h(node.label),[
      xbiKpi('Qty Ordered', Math.round(totQ), ''), xbiKpi('Delivered', Math.round(totD), totQ?Math.round(totD/totQ*100)+'%':'', totQ&&totD/totQ>=0.9?'g':'w'),
      xbiKpi('Value', fmt(totOrd), ''), xbiKpi('Due', Math.round(Math.max(0,totQ-totD)), 'units', totQ-totD>0?'b':null)])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">${label} <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${rows.length ? rows.map(r=>{ const fillp=r.ordered_qty?Math.round(r.delivered_qty/r.ordered_qty*100):0;
        return xbiRow(r.name, `${Math.round(r.ordered_qty)} ordered${r.sku?' · '+r.sku:''}`, fmt(r.ordered_value), {share:Math.round(r.ordered_value/totOrd*100), fill:fillp, key:(nextApiLevel==='sku'?r.sku:r.name)}); }).join('')
        : '<div style="text-align:center;color:var(--text-muted);padding:24px">No data at this level.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>{
    const key = b.dataset.k;
    if (nextApiLevel==='subcategory') xbiPush('subcat', key, { subcategory:key });
    else if (nextApiLevel==='brand')  xbiPush('brand', key, { brand:key });
    else xbiPush('sku', key, { sku:key });
  });
}

async function xbiSku(node, body) {
  // node.ctx has category/subcategory/brand + sku; pull sku totals + inventory + challans
  const p = xbiScopeParams(node.ctx); p.set('level','sku');
  const cp = xbiScopeParams(node.ctx); cp.set('sku', node.ctx.sku||node.label);
  const [d, inv, ch] = await Promise.all([
    api('/reports/drill?'+p.toString()),
    api('/inventory?q='+encodeURIComponent(node.ctx.sku||node.label)).catch(()=>[]),
    api('/reports/sku-challans?'+cp.toString()).catch(()=>({rows:[]})),
  ]);
  const row = (d?.rows||[]).find(r=>String(r.sku)===String(node.ctx.sku)) || (d?.rows||[])[0] || {};
  const item = Array.isArray(inv) ? inv.find(i=>i.sku===node.ctx.sku) : null;
  const ordQ=Math.round(row.ordered_qty||0), delQ=Math.round(row.delivered_qty||0);
  const challans = ch?.rows||[];
  body.innerHTML = `
    ${xbiGrp('Item — '+h(node.label),[
      xbiKpi('Ordered', ordQ, 'units'), xbiKpi('Delivered', delQ, ordQ?Math.round(delQ/ordQ*100)+'%':'', ordQ&&delQ/ordQ>=0.9?'g':'w'),
      xbiKpi('Due', Math.max(0,ordQ-delQ), 'units', ordQ-delQ>0?'b':null), xbiKpi('Order Value', fmt(row.ordered_value||0), '')])}
    ${xbiGrp('Stock & item',[
      xbiKpi('Current Stock', item?Math.round(item.stock):'—', item?(item.uom||'units'):''),
      xbiKpi('Reserved', item?Math.round(item.reserved||0):'—', ''),
      xbiKpi('Reorder Level', item?Math.round(item.reorder_level||0):'—', ''),
      xbiKpi('SKU', node.ctx.sku||'—', ''),
      xbiKpi('Vendor', item?.vendor_name||'—', ''),
      xbiKpi('Unit Price', item?fmt(item.unit_price):'—', '')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Delivery challans <span style="font-weight:400;color:var(--faint)">— click to drill</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${challans.length ? challans.map(dc=>{
        const st=(dc.status||'').replace(/_/g,' ');
        const stCls = dc.status==='DELIVERED'?'g':dc.status==='CANCELLED'?'b':'w';
        return xbiRow(dc.dc_number||dc.id, `Order ${dc.order_id} · ${dc.delivered_at?fmtDate(dc.delivered_at):st} · ${dc.billed?'billed':'unbilled'}`, `${Math.round(dc.qty_delivered||0)} units`, {fill:null, key:dc.id, share:null});
      }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:20px">No challans carried this item in the period.</div>'}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>{
    b.onclick=()=>{ const dc=challans.find(x=>String(x.id)===b.dataset.k); if(!dc)return; xbiPush('dc', dc.dc_number||dc.id, { dc_id: dc.id, dc }); };
  });
}

async function xbiDc(node, body) {
  const dc = node.ctx.dc || {};
  const items = await api('/delivery-challans/'+encodeURIComponent(node.ctx.dc_id)+'/items').catch(()=>[]) || [];
  const st=(dc.status||'').replace(/_/g,' ');
  body.innerHTML = `
    ${xbiGrp('Challan '+h(dc.dc_number||node.ctx.dc_id),[
      xbiKpi('DC Number', dc.dc_number||node.ctx.dc_id, ''),
      xbiKpi('Linked Order', dc.order_id||'—', ''),
      xbiKpi('Client', dc.client_name||'—', ''),
      xbiKpi('Status', st||'—', '', dc.status==='DELIVERED'?'g':'w'),
      xbiKpi('Delivered', dc.delivered_at?fmtDate(dc.delivered_at):'—', ''),
      xbiKpi('POD', dc.pod_count>0?'Uploaded':'Pending', '', dc.pod_count>0?'g':'w')])}
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:18px 0 8px">Items in this challan</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:14px"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Item</th><th>SKU</th><th style="text-align:right">Dispatched</th><th style="text-align:right">Delivered</th></tr></thead>
      <tbody>${items.length ? items.map(i=>`<tr><td>${h(i.name||i.item_name||i.sku)}</td><td style="color:var(--text-muted)">${h(i.sku)}</td><td style="text-align:right">${i.qty_ordered}</td><td style="text-align:right;font-weight:700">${i.qty_delivered}</td></tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No item detail</td></tr>'}</tbody>
    </table></div></div>
    <div style="font-size:.78rem;font-weight:700;color:var(--navy);margin:6px 0 8px">Billing <span style="font-weight:400;color:var(--faint)">— view the invoice</span></div>
    <div style="display:flex;flex-direction:column;gap:7px">
      ${xbiRow('Invoice for '+(dc.dc_number||node.ctx.dc_id), dc.billed?('Billed '+(dc.billed_at?fmtDate(dc.billed_at):'')):'Not yet billed', fmt(dc.line_value||0), {key:'inv'})}
    </div>`;
  body.querySelectorAll('.xbi-row').forEach(b=>b.onclick=()=>xbiPush('invoice', 'Invoice · '+(dc.dc_number||node.ctx.dc_id), { dc }));
}

async function xbiInvoice(node, body) {
  const dc = node.ctx.dc || {};
  const val = dc.line_value || 0;
  const gst = Math.round(val*0.18);
  body.innerHTML = `
    ${xbiGrp('Invoice',[
      xbiKpi('Invoice #', 'INV-'+(dc.dc_number||dc.id||'—'), ''),
      xbiKpi('Linked Order', dc.order_id||'—', ''),
      xbiKpi('Linked DC', dc.dc_number||dc.id||'—', ''),
      xbiKpi('Invoice Value', fmt(val+gst), 'incl GST'),
      xbiKpi('Payment', dc.billed?'Billed':'Unbilled', '', dc.billed?'g':'w'),
      xbiKpi('Outstanding', dc.billed?fmt(0):fmt(val+gst), '', dc.billed?'g':'b')])}
    <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
      <div style="background:var(--navy);color:#fff;padding:13px 16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
        <span style="font-weight:700">INV-${dc.dc_number||dc.id||'—'}</span><span>${h(dc.client_name||'—')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>${h(node.ctx.sku||'Delivered items')}</span><span class="tnum">${Math.round(dc.qty_delivered||0)} × ${fmt(dc.unit_price||0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>Subtotal</span><span class="tnum">${fmt(val)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:9px 16px;font-size:.84rem;border-bottom:1px solid var(--border)"><span>GST @ 18%</span><span class="tnum">${fmt(gst)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:12px 16px;font-weight:800;color:var(--navy);background:var(--panel,#faf8f4)"><span>Total</span><span class="tnum">${fmt(val+gst)}</span></div>
    </div>
    <div style="margin-top:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;font-size:.8rem;color:#166534">
      🏁 <b>Bottom of the drill.</b> From a portfolio KPI to a single billed line — every hop auditable. This invoice is derived from the DC's billing record; a full invoice ledger (multi-DC invoices, payment dates) can follow once client invoicing is modelled.
    </div>`;
}

function renderReports(el) {
  const byKey = Object.fromEntries(REPORT_DEFS.map(r=>[r.key,r]));
  const usedKeys = new Set(REPORT_CATEGORIES.flatMap(c=>c.keys));
  const otherDefs = REPORT_DEFS.filter(r=>!usedKeys.has(r.key));

  const nowM = new Date();
  const admFrom = new Date(nowM.getFullYear(), nowM.getMonth()-5, 1).toISOString().slice(0,10);
  const admTo = nowM.toISOString().slice(0,10);

  el.innerHTML = `
  ${pageHeader('Reports & BI', 'Live data — view inline, export CSV, or print PDF')}

  <!-- ═══ CLIENT FULFILMENT DRILL-DOWN ═══ -->
  <div class="card" style="padding:16px 20px;margin-bottom:20px;border:1px solid var(--primary)">
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">
      <span style="font-size:1.1rem">🔎</span>
      <span style="font-weight:800;font-size:.95rem;color:var(--navy)">Client Fulfilment Drill-down</span>
      <span style="font-size:.76rem;color:var(--text-muted)">— orders vs delivery by month/quarter/year, then drill into category → sub-category</span>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">
      <select id="adm-fulfil-client" class="form-control" style="max-width:240px" onchange="loadAdminFulfil()">
        <option value="">Loading clients…</option>
      </select>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        ${['month','quarter','year'].map(g=>`<button id="aftab-${g}" ${dataAct('setAdminFulfilGran', g)} style="padding:6px 12px;font-size:.76rem;font-weight:600;background:#fff;border:none;cursor:pointer;color:var(--text-muted)">${g==='month'?'Monthly':g==='quarter'?'Quarterly':'Fiscal Year'}</button>`).join('')}
      </div>
      <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <button id="afmode-chart" ${dataAct('setAdminFulfilMode', 'chart')} style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📊</button>
        <button id="afmode-table" ${dataAct('setAdminFulfilMode', 'table')} style="padding:6px 12px;font-size:.76rem;background:#fff;border:none;cursor:pointer">📋</button>
      </div>
      <input type="date" id="adm-rpt-from" class="form-control" style="max-width:150px;font-size:.8rem" value="${admFrom}">
      <span style="font-size:.8rem;color:var(--text-muted)">to</span>
      <input type="date" id="adm-rpt-to" class="form-control" style="max-width:150px;font-size:.8rem" value="${admTo}">
      <button class="btn btn-primary btn-sm" ${dataAct('loadAdminFulfil')}>Apply</button>
    </div>
    <div id="rpt-fulfil-content"><div style="text-align:center;padding:30px;color:var(--text-muted)">Select a client to view fulfilment.</div></div>
  </div>

  <!-- ═══ ANALYTICS OVERVIEW (Stitch reference) ═══ -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:24px">

    <!-- SLA Performance Gauge -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="font-weight:800;font-size:.92rem;color:var(--navy);margin-bottom:8px">SLA Performance</div>
      <div id="sla-gauge-wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:150px">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>

    <!-- Fulfilment Efficiency -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="font-weight:800;font-size:.92rem;color:var(--navy);margin-bottom:2px">Fulfilment Efficiency</div>
      <div style="font-size:.74rem;color:var(--text-muted);margin-bottom:12px">Orders over the past week</div>
      <div id="fulfilment-bars" style="min-height:120px;display:flex;align-items:center;justify-content:center">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>

    <!-- Open Tickets -->
    <div class="card" style="padding:18px 20px;margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-weight:800;font-size:.92rem;color:var(--navy)">Open Tickets</div>
        <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'service_desk')}>View All →</button>
      </div>
      <div id="open-tickets-list" style="min-height:120px;display:flex;align-items:center;justify-content:center">
        <div class="spinner" style="width:24px;height:24px"></div>
      </div>
    </div>
  </div>
  ${REPORT_CATEGORIES.map(cat=>`
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:1.1rem">${cat.icon}</span>
      <span style="font-weight:700;font-size:1rem;color:${cat.color}">${cat.label} Reports</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${cat.keys.map(k=>{const r=byKey[k];if(!r)return '';return `
      <div style="background:${cat.bg};border:1px solid ${cat.color}22;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:1.6rem;line-height:1">${r.icon}</div>
          <div>
            <div style="font-weight:700;font-size:.92rem;color:${cat.color}">${h(r.title)}</div>
            <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${r.desc}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" ${dataAct('viewReport', r.key)}>View</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('downloadReportCSV', r.key)}>CSV</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('printReport', r.key)}>Print</button>
        </div>
      </div>`;}).join('')}
    </div>
  </div>`).join('')}
  ${otherDefs.length?`
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:1.1rem">📈</span>
      <span style="font-weight:700;font-size:1rem;color:var(--text-muted)">Analytics</span>
      <div style="flex:1;height:1px;background:var(--border);margin-left:8px"></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
      ${otherDefs.map(r=>`
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:1.6rem;line-height:1">${r.icon}</div>
          <div>
            <div style="font-weight:700;font-size:.92rem">${h(r.title)}</div>
            <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${r.desc}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" ${dataAct('viewReport', r.key)}>View</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('downloadReportCSV', r.key)}>CSV</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('printReport', r.key)}>Print</button>
        </div>
      </div>`).join('')}
    </div>
  </div>`:''}`;

  loadReportsOverview();
  populateAdminFulfilClients();
}

/* ── Admin: client fulfilment drill-down (reuses the fulfilment renderer) ── */
async function populateAdminFulfilClients() {
  const sel = document.getElementById('adm-fulfil-client');
  if (!sel) return;
  const clients = (await api('/clients').catch(()=>[]) || []).filter(c=>c.active);
  sel.innerHTML = '<option value="">— Select a client —</option>' +
    clients.map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('');
}

function setAdminFulfilGran(g) { _fulfilGranularity = g; renderFulfilContent(); }
function setAdminFulfilMode(m) { _fulfilMode = m; renderFulfilContent(); }

async function loadAdminFulfil() {
  const clientId = document.getElementById('adm-fulfil-client')?.value || '';
  const wrap = document.getElementById('rpt-fulfil-content');
  if (!clientId) { if(wrap) wrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Select a client to view fulfilment.</div>'; _drillClientId=null; return; }
  if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)"><div class="spinner" style="width:22px;height:22px;margin:0 auto"></div></div>';
  _drillClientId = clientId;                       // makes the drill scope to this client
  if (!_fulfilGranularity) _fulfilGranularity = 'month';
  if (!_fulfilMode) _fulfilMode = 'chart';
  const data = await api(`/reports/order-fulfilment-monthly?client_id=${clientId}`);
  _clientRptData = { ..._clientRptData, fulfil: data?.rows || [] };
  renderFulfilContent();
}

/* ── Analytics overview widgets (SLA gauge, fulfilment bars, tickets) ── */
async function loadReportsOverview() {
  const [orders, tickets, fulfilment] = await Promise.all([
    api('/orders').catch(()=>[]),
    api('/tickets').catch(()=>[]),
    api(`/reports/client-fulfilment?from=${new Date(Date.now()-30*86400000).toISOString().slice(0,10)}&to=${new Date().toISOString().slice(0,10)}`).catch(()=>[]),
  ]);

  // ── SLA gauge: average fulfilment % over 30 days ──
  const gaugeWrap = document.getElementById('sla-gauge-wrap');
  if (gaugeWrap) {
    const pct = (fulfilment||[]).length
      ? Math.round((fulfilment.reduce((s,r)=>s+(r.fulfilment_pct||0),0))/fulfilment.length)
      : 100;
    const angle = -180 + (pct/100)*180;
    gaugeWrap.innerHTML = `
      <svg viewBox="0 0 200 115" style="width:100%;max-width:220px">
        <defs>
          <linearGradient id="slaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#dc2626"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#16a34a"/>
          </linearGradient>
        </defs>
        <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="url(#slaGrad)" stroke-width="16" stroke-linecap="round"/>
        <line x1="100" y1="100" x2="${100+72*Math.cos(angle*Math.PI/180)}" y2="${100+72*Math.sin(angle*Math.PI/180)}" stroke="var(--navy)" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="6" fill="var(--navy)"/>
        <text x="100" y="82" text-anchor="middle" font-size="26" font-weight="800" fill="var(--navy)">${pct}%</text>
      </svg>
      <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">On Target <span style="color:${pct>=80?'#16a34a':pct>=60?'#d97706':'#dc2626'};font-weight:700">· 30-day fulfilment</span></div>`;
  }

  // ── Fulfilment efficiency bars: past week ──
  const barsWrap = document.getElementById('fulfilment-bars');
  if (barsWrap) {
    const weekAgo = Date.now() - 7*86400000;
    const recent = (orders||[]).filter(o => new Date(o.created_at).getTime() >= weekAgo);
    const received  = recent.length;
    const processed = recent.filter(o => !['DRAFT','PENDING_APPROVAL','SUBMITTED'].includes(o.status)).length;
    const delivered = recent.filter(o => ['CLOSED','PARTIALLY_CLOSED','IN_SHIPMENT','DELIVERED'].includes(o.status)).length;
    const max = Math.max(received, processed, delivered, 1);
    const row = (label, val, color) => `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:72px;font-size:.76rem;color:var(--text-muted);text-align:right;flex-shrink:0">${label}</div>
        <div style="flex:1;background:var(--border);border-radius:4px;height:18px;overflow:hidden">
          <div style="height:100%;width:${Math.round(val/max*100)}%;background:${color};border-radius:4px;transition:width .6s"></div>
        </div>
        <div style="width:26px;font-size:.8rem;font-weight:700;color:var(--navy)">${val}</div>
      </div>`;
    barsWrap.innerHTML = `<div style="width:100%">
      ${row('Received', received, 'var(--primary)')}
      ${row('Processed', processed, '#2dd4bf')}
      ${row('Delivered', delivered, '#9ca3af')}
    </div>`;
  }

  // ── Open tickets ──
  const ticketsWrap = document.getElementById('open-tickets-list');
  if (ticketsWrap) {
    const open = (tickets||[]).filter(t => !['RESOLVED','CLOSED'].includes(t.status)).slice(0,4);
    const pillColor = p => p==='HIGH'||p==='URGENT' ? ['#fee2e2','#dc2626'] : p==='MEDIUM' ? ['#fef3c7','#d97706'] : ['#e5e7eb','#6b7280'];
    ticketsWrap.innerHTML = open.length ? `<div style="width:100%">
      ${open.map(t => {
        const [bg,fg] = pillColor(t.priority);
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" ${dataAct('navigate', 'service_desk')}>
          <div style="width:8px;height:8px;border-radius:50%;background:${fg};flex-shrink:0"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8rem;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">#${t.id}: ${h(t.subject||'')}</div>
            <div style="font-size:.7rem;color:var(--text-muted)">${fmtDate(t.created_at)}</div>
          </div>
          <span style="font-size:.68rem;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${fg};white-space:nowrap">${t.priority||'LOW'}</span>
        </div>`;
      }).join('')}
    </div>` : `<div style="text-align:center;color:var(--text-muted);font-size:.82rem;padding:20px">🎉 No open tickets</div>`;
  }
}

function rptPresetDates(preset) {
  const now = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if (preset==='thismonth') return [`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, ymd(now)];
  if (preset==='lastmonth') { const lm=new Date(now.getFullYear(),now.getMonth()-1,1); return [`${lm.getFullYear()}-${String(lm.getMonth()+1).padStart(2,'0')}-01`, ymd(new Date(now.getFullYear(),now.getMonth(),0))]; }
  if (preset==='thisyear')  return [`${now.getFullYear()}-01-01`, ymd(now)];
  return [ymd(new Date(Date.now()-30*86400000)), ymd(now)]; // last 30 days
}

async function viewReport(key, from, to) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  if (def.datable) {
    if (!from || !to) [from, to] = rptPresetDates('last30');
    APP._rptRange = { key, from, to };
  } else {
    APP._rptRange = null;
  }
  showToast('Loading report…');
  const qs = def.datable ? `?from=${from}&to=${to}` : '';
  const data = await api('/reports/' + key + qs);
  if (!data) return;
  let rows = Array.isArray(data.rows) ? data.rows : Array.isArray(data) ? data : (Array.isArray(data.data) ? data.data : []);
  if (key === 'budget-forecast') {
    rows = rows.map(r => ({ client: r.client, forecast_month: r.forecast?.month||'', predicted: r.forecast?.predicted||0 }));
  }
  const tbody = rows.length ? rows.map(row => {
    const cells = def.cols.map(c => {
      const v = row[c];
      if (c.includes('spend')||c.includes('total')||c.includes('budget')||c.includes('price')||c.includes('remaining')||c==='grand_total') return '<td>' + fmt(v) + '</td>';
      if (c==='on_time_rate'||c==='fill_rate') return '<td>' + pct(v) + '</td>';
      if (c==='order_status'||c==='status') return '<td>' + statusBadge(v) + '</td>';
      if (c==='delivery_status') return '<td><span class="badge ' + (v==='DELIVERED'?'badge-success':v==='IN_TRANSIT'?'badge-warning':'badge-secondary') + '">' + (v||'—') + '</span></td>';
      if (c==='qty_due') return '<td><strong style="color:' + (Number(v)>0?'#dc2626':'#16a34a') + '">' + (v!=null?v:'—') + '</strong></td>';
      if (c==='billed') return '<td>' + (v?'<span class="badge badge-success">Yes</span>':'<span class="badge badge-warning">No</span>') + '</td>';
      if (c.includes('_at')) return '<td>' + fmtDate(v) + '</td>';
      if (c==='items_summary') return '<td style="max-width:220px;white-space:normal;font-size:.8rem">' + (v||'—') + '</td>';
      return '<td>' + (v!=null?v:'—') + '</td>';
    }).join('');
    return '<tr>' + cells + '</tr>';
  }).join('') : '<tr><td colspan="' + def.cols.length + '" style="text-align:center;color:var(--text-muted)">No data</td></tr>';

  const fmtD = s => { const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); };
  const periodBar = def.datable ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px;padding:10px 12px;background:var(--surface-alt,#f8f9fb);border-radius:8px">
      <span style="font-size:.76rem;font-weight:700;color:var(--navy)">📅 Period: ${fmtD(from)} → ${fmtD(to)}</span>
      <div style="flex:1"></div>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('last30'))" style="font-size:.72rem">Last 30 Days</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('thismonth'))" style="font-size:.72rem">This Month</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('lastmonth'))" style="font-size:.72rem">Last Month</button>
      <button class="btn btn-secondary btn-sm" onclick="viewReport('${key}',...rptPresetDates('thisyear'))" style="font-size:.72rem">This Year</button>
      <input type="date" id="rpt-modal-from" class="form-control" style="max-width:135px;font-size:.76rem" value="${from}">
      <input type="date" id="rpt-modal-to" class="form-control" style="max-width:135px;font-size:.76rem" value="${to}">
      <button class="btn btn-primary btn-sm" onclick="viewReport('${key}',document.getElementById('rpt-modal-from').value,document.getElementById('rpt-modal-to').value)" style="font-size:.72rem">Apply</button>
    </div>`
  : `<div style="margin-bottom:12px;padding:8px 12px;background:var(--surface-alt,#f8f9fb);border-radius:8px;font-size:.76rem;font-weight:700;color:var(--navy)">📅 Period: ${def.period||'All time'}</div>`;

  openModal(def.title,
    `${periodBar}
    <div class="table-wrap" style="max-height:55vh;overflow-y:auto">
      <table class="table">
        <thead><tr>${def.labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
     <button class="btn btn-primary" ${dataActClose('downloadReportCSV', key)}>Download CSV</button>`);
}

async function downloadReportCSV(key) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  showToast('Preparing CSV…');
  const r = APP._rptRange;
  const qs = def.datable && r?.key === key ? `?from=${r.from}&to=${r.to}` : '';
  const data = await api('/reports/' + key + qs);
  const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []));
  if (!Array.isArray(rows) || !rows.length) { showToast('No data to export','error'); return; }
  const header = def.labels.join(',');
  const body = rows.map(row => def.cols.map(c => {
    const v = row[c]; if (v==null) return '';
    const s = String(v); return s.includes(',') ? `"${s}"` : s;
  }).join(',')).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${key}-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

async function printReport(key) {
  const def = REPORT_DEFS.find(r=>r.key===key);
  if (!def) return;
  const data = await api('/reports/' + key);
  const rows = data?.rows || data || [];
  const html = `<html><head><title>${def.title}</title><style>
    body{font-family:sans-serif;padding:20px} table{width:100%;border-collapse:collapse;font-size:.85rem}
    th,td{padding:8px;border:1px solid #ddd;text-align:left} th{background:#16284a;color:#fff}
    h2{color:#16284a}
  </style></head><body>
  <h2>Smart Pantry — ${def.title}</h2>
  <p>Generated: ${new Date().toLocaleString('en-IN')}</p>
  <table><thead><tr>${def.labels.map(l=>`<th>${l}</th>`).join('')}</tr></thead>
  <tbody>${(Array.isArray(rows)?rows:[]).map(row=>`<tr>${def.cols.map(c=>`<td>${row[c]!=null?row[c]:'—'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}

/* ============================================================
   CLIENT REPORTS — Consumption & Spend
   ============================================================ */
let _clientRptData = { consumption: null, spend: null };
let _clientRptSpendTab = 'monthly';

/* ── Client Executive Dashboard — Time is the primary controller ── */
let _cdashCompare = false, _cdashTab = 'overview', _cdashExec = null, _cdashPrev = null;

function renderClientReports(el) {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const today = now.toISOString().slice(0,10);

  const presets = [['today','Today'],['thisweek','This Week'],['thismonth','This Month'],['quarter','Quarter'],['fy','Financial Year']];
  const tabs = [['overview','Overview'],['orders','Orders'],['spend','Spend'],['consumption','Consumption'],['inventory','Inventory'],['downloads','Downloads']];
  const spendSubtab = (id,label)=>`<button id="stab-${id}" ${dataAct('switchSpendTab', id)} style="padding:8px 16px;font-size:.82rem;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--text-muted);margin-bottom:-2px">${label}</button>`;

  el.innerHTML = `
  ${pageHeader('Executive Dashboard', 'Your pantry — budget, orders & consumption, driven by the period you pick')}
  <style id="cdash-style">
    #cdash-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
    @media(max-width:900px){#cdash-kpis{grid-template-columns:repeat(2,1fr)}}
    .cdash-kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 14px;cursor:pointer;transition:.15s;position:relative}
    .cdash-kpi:hover{border-color:var(--primary);transform:translateY(-2px);box-shadow:0 6px 16px -8px rgba(30,58,95,.25)}
    .cdash-kpi::after{content:"↘";position:absolute;top:10px;right:12px;color:var(--border);font-weight:700;font-size:.8rem}
    .cdash-kpi:hover::after{color:var(--primary)}
    .cdash-kpi .kl{font-size:.63rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted)}
    .cdash-kpi .kv{font-size:1.4rem;font-weight:800;color:var(--navy);line-height:1.1;margin-top:5px}
    .cdash-kpi .kv.g{color:var(--success)}.cdash-kpi .kv.w{color:#d97706}.cdash-kpi .kv.b{color:var(--danger)}
    .cdash-kpi .ks{font-size:.67rem;color:var(--text-muted);margin-top:3px}
    .cdash-delta{display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:.67rem;font-weight:700}
    .cdash-delta.up{color:var(--success)}.cdash-delta.down{color:var(--danger)}.cdash-delta.neu{color:var(--text-muted)}
    .cdash-delta .cap{color:var(--text-muted);font-weight:500}
    .cdash-tabs{display:flex;gap:2px;flex-wrap:wrap;border-bottom:2px solid var(--border);margin-bottom:16px}
    .cdash-tab{padding:9px 14px;font-size:.84rem;font-weight:600;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;cursor:pointer;color:var(--text-muted)}
    .cdash-tab:hover{color:var(--navy)}
    .cdash-tab.on{color:var(--primary);border-bottom-color:var(--primary)}
    .cdash-chip{padding:6px 13px;font-size:.77rem;font-weight:600;border:1px solid var(--border);background:var(--surface);border-radius:100px;cursor:pointer;color:var(--text-muted)}
    .cdash-chip:hover{border-color:var(--primary);color:var(--navy)}
    .cdash-chip.on{background:var(--primary);border-color:var(--primary);color:#fff}
    .cdash-qgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    @media(max-width:680px){.cdash-qgrid{grid-template-columns:1fr}}
    .cdash-q{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--navy);border-radius:10px;padding:14px 15px}
    .cdash-q.ok{border-left-color:var(--success)}.cdash-q.warn{border-left-color:#d97706}.cdash-q.bad{border-left-color:var(--danger)}
    .cdash-q .qq{font-size:.77rem;color:var(--text-muted);font-weight:600}
    .cdash-q .qa{font-size:1rem;color:var(--navy);font-weight:700;margin-top:6px;line-height:1.35}
    .cdash-q .qa b{color:var(--primary)}
  </style>

  <!-- GLOBAL TIME BAR — the controller -->
  <div class="card" style="padding:11px 15px;margin-bottom:14px">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <span style="font-weight:700;font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;color:var(--primary);display:inline-flex;align-items:center;gap:5px">🕐 Period</span>
      ${presets.map(p=>`<button class="cdash-chip" id="cdash-pre-${p[0]}" ${dataAct('clientRptPreset', p[0])}>${p[1]}</button>`).join('')}
      <span style="width:1px;height:20px;background:var(--border)"></span>
      <input type="date" id="rpt-from" class="form-control" style="max-width:140px;font-size:.8rem" value="${firstOfMonth}" onchange="cdashClearPreset()">
      <span style="color:var(--text-muted);font-size:.8rem">to</span>
      <input type="date" id="rpt-to" class="form-control" style="max-width:140px;font-size:.8rem" value="${today}" onchange="cdashClearPreset()">
      <button class="btn btn-primary btn-sm" ${dataAct('loadClientReports')}>Apply</button>
      <div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="cdash-chip" id="cdash-cmp" ${dataAct('cdashToggleCompare')}>⇄ Compare</button>
        <button class="btn btn-secondary btn-sm" id="cdash-refresh" ${dataAct('cdashRefresh')}>↻ Refresh</button>
        <span id="cdash-period-badge" style="font-size:.74rem;font-weight:700;color:var(--primary);background:var(--primary-light);border:1px solid var(--primary-border);padding:4px 10px;border-radius:100px">This Month</span>
      </div>
    </div>
  </div>

  <!-- KPI WALL -->
  <div id="cdash-kpis"><div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--text-muted)">Loading…</div></div>

  <!-- SMART INSIGHTS -->
  <div id="cdash-insights" class="card" style="display:none;padding:13px 16px;margin-bottom:16px;border-left:3px solid var(--primary);background:var(--primary-light)"></div>

  <!-- TABS -->
  <div class="cdash-tabs">
    ${tabs.map((t,i)=>`<button class="cdash-tab ${i===0?'on':''}" id="cdash-tab-${t[0]}" ${dataAct('cdashSwitchTab', t[0])}>${t[1]}</button>`).join('')}
  </div>
  <div id="cdash-tabpane">
    <div class="cdash-pane" data-pane="overview"><div id="cdash-overview"></div></div>

    <div class="cdash-pane" data-pane="orders" style="display:none">
      <div id="cdash-orders-status"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span style="font-weight:700;font-size:.9rem;color:var(--navy)">Order vs Delivery</span>
        <div style="flex:1;height:1px;background:var(--border);margin-left:4px"></div>
        <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden">${['month','quarter','year'].map(g=>`<button id="ftab-${g}" ${dataAct('switchFulfilGranularity', g)} style="padding:6px 13px;font-size:.75rem;font-weight:600;background:#fff;border:none;cursor:pointer;color:var(--text-muted)">${g==='month'?'Monthly':g==='quarter'?'Quarterly':'Fiscal Year'}</button>`).join('')}</div>
        <div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden"><button id="fmode-chart" ${dataAct('switchFulfilMode', 'chart')} title="Chart" style="padding:6px 11px;font-size:.75rem;background:#fff;border:none;cursor:pointer">📊</button><button id="fmode-table" ${dataAct('switchFulfilMode', 'table')} title="Table" style="padding:6px 11px;font-size:.75rem;background:#fff;border:none;cursor:pointer">📋</button></div>
      </div>
      <div id="rpt-fulfil-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div></div>
    </div>

    <div class="cdash-pane" data-pane="spend" style="display:none">
      <div id="cdash-spend-gauge"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-weight:700;font-size:.9rem;color:var(--navy)">Spend detail</span><div style="flex:1;height:1px;background:var(--border);margin-left:4px"></div><button class="btn btn-secondary btn-sm" ${dataAct('downloadClientSpendCSV')}>⬇ CSV</button></div>
      <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:16px">${spendSubtab('monthly','Monthly Trend')}${spendSubtab('yearly','Yearly Summary')}${spendSubtab('po','PO-wise')}</div>
      <div id="rpt-spend-content"><div style="text-align:center;padding:40px;color:var(--text-muted)">Loading…</div></div>
    </div>

    <div class="cdash-pane" data-pane="consumption" style="display:none">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-weight:700;font-size:.9rem;color:var(--navy)">Consumption analytics</span><div style="flex:1;height:1px;background:var(--border);margin-left:4px"></div><button class="btn btn-secondary btn-sm" ${dataAct('downloadClientConsumptionCSV')}>⬇ CSV</button></div>
      <div id="rpt-consumption-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px"><div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Loading…</div></div>
    </div>

    <div class="cdash-pane" data-pane="inventory" style="display:none"><div id="cdash-inventory"></div></div>

    <div class="cdash-pane" data-pane="downloads" style="display:none">
      <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:14px">Export the current period (<b id="cdash-dl-period" style="color:var(--navy)">this month</b>) and scope.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
        <button class="card" style="padding:16px;text-align:center;cursor:pointer;border:1px solid var(--border)" ${dataAct('downloadClientSpendCSV')}><div style="font-size:1.3rem">💰</div><div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-top:6px">Spend CSV</div><div style="font-size:.7rem;color:var(--text-muted)">monthly / PO-wise</div></button>
        <button class="card" style="padding:16px;text-align:center;cursor:pointer;border:1px solid var(--border)" ${dataAct('downloadClientConsumptionCSV')}><div style="font-size:1.3rem">🍽️</div><div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-top:6px">Consumption CSV</div><div style="font-size:.7rem;color:var(--text-muted)">items used</div></button>
        <button class="card" style="padding:16px;text-align:center;cursor:pointer;border:1px solid var(--border)" onclick="window.print()"><div style="font-size:1.3rem">🖨️</div><div style="font-weight:700;font-size:.85rem;color:var(--navy);margin-top:6px">Print / PDF</div><div style="font-size:.7rem;color:var(--text-muted)">current view</div></button>
      </div>
      <div class="card" style="padding:12px 15px;margin-top:14px;font-size:.78rem;color:var(--text-muted);background:var(--surface-2)">Scheduled email delivery (monthly executive summary) is planned — exports today are on-demand.</div>
    </div>
  </div>`;

  document.getElementById('cdash-pre-thismonth')?.classList.add('on');
  _fulfilGranularity = 'month';
  _fulfilMode = 'chart';
  _cdashTab = 'overview';
  loadClientReports();
}

function clientRptPreset(preset) {
  const now = new Date();
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let from, to = ymd(now);
  if (preset === 'today') { from = ymd(now); }
  else if (preset === 'thisweek') { const dow = (now.getDay()+6)%7; const mon = new Date(now); mon.setDate(now.getDate()-dow); from = ymd(mon); }
  else if (preset === 'thismonth') { from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; }
  else if (preset === 'quarter') { const m = now.getMonth(); const qs = (m>=3&&m<=5)?3:(m>=6&&m<=8)?6:(m>=9)?9:0; from = `${now.getFullYear()}-${String(qs+1).padStart(2,'0')}-01`; }
  else if (preset === 'fy') { const y = now.getMonth()>=3 ? now.getFullYear() : now.getFullYear()-1; from = `${y}-04-01`; }
  else return;
  document.getElementById('rpt-from').value = from;
  document.getElementById('rpt-to').value   = to;
  ['today','thisweek','thismonth','quarter','fy'].forEach(p => {
    const b = document.getElementById('cdash-pre-'+p);
    if (b) b.classList.toggle('on', p === preset);
  });
  loadClientReports();
}

function cdashClearPreset() {
  ['today','thisweek','thismonth','quarter','fy'].forEach(p => document.getElementById('cdash-pre-'+p)?.classList.remove('on'));
}

function cdashToggleCompare() {
  _cdashCompare = !_cdashCompare;
  document.getElementById('cdash-cmp')?.classList.toggle('on', _cdashCompare);
  loadClientReports();
}

function cdashRefresh() {
  const b = document.getElementById('cdash-refresh');
  if (b) { b.disabled = true; b.textContent = '↻ …'; }
  loadClientReports().finally(() => { if (b) { b.disabled = false; b.textContent = '↻ Refresh'; } });
}

function cdashSwitchTab(tab) {
  _cdashTab = tab;
  document.querySelectorAll('#cdash-tabpane .cdash-pane').forEach(p => { p.style.display = p.dataset.pane === tab ? '' : 'none'; });
  ['overview','orders','spend','consumption','inventory','downloads'].forEach(t => document.getElementById('cdash-tab-'+t)?.classList.toggle('on', t === tab));
}

function cdashINR(n) {
  n = Number(n||0);
  if (n >= 1e7) return '₹' + (n/1e7).toFixed(2).replace(/\.?0+$/,'') + 'Cr';
  if (n >= 1e5) return '₹' + (n/1e5).toFixed(2).replace(/\.?0+$/,'') + 'L';
  if (n >= 1e3) return '₹' + (n/1e3).toFixed(1).replace(/\.?0+$/,'') + 'k';
  return '₹' + Math.round(n);
}

function cdashPrevRange(from, to) {
  const f = new Date(from+'T00:00:00'), t = new Date(to+'T00:00:00');
  const days = Math.max(0, Math.round((t-f)/86400000));
  const pt = new Date(f); pt.setDate(pt.getDate()-1);
  const pf = new Date(pt); pf.setDate(pf.getDate()-days);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { from: ymd(pf), to: ymd(pt) };
}

async function loadClientReports() {
  _drillClientId = null; // client sees their own data; endpoint auto-scopes
  const from = document.getElementById('rpt-from')?.value || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = document.getElementById('rpt-to')?.value   || new Date().toISOString().slice(0,10);

  const kpiEl = document.getElementById('cdash-kpis');
  if (kpiEl) kpiEl.innerHTML = '<div style="grid-column:1/-1;padding:30px;text-align:center;color:var(--text-muted)">Loading…</div>';
  const grid = document.getElementById('rpt-consumption-grid');
  if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">Loading…</div>';

  // period badge
  const activeChip = ['today','thisweek','thismonth','quarter','fy'].map(p => document.getElementById('cdash-pre-'+p)).find(b => b && b.classList.contains('on'));
  const badgeTxt = activeChip ? activeChip.textContent : 'Custom range';
  const pb = document.getElementById('cdash-period-badge'); if (pb) pb.textContent = badgeTxt;
  const dlp = document.getElementById('cdash-dl-period'); if (dlp) dlp.textContent = badgeTxt.toLowerCase();

  let prevProm = Promise.resolve(null);
  if (_cdashCompare) { const pr = cdashPrevRange(from, to); prevProm = api(`/reports/exec-summary?from=${pr.from}&to=${pr.to}`); }

  const [cData, sData, fData, exec, prev] = await Promise.all([
    api(`/reports/client-consumption?from=${from}&to=${to}`),
    api(`/reports/client-spend?from=${from}&to=${to}`),
    api(`/reports/order-fulfilment-monthly`),
    api(`/reports/exec-summary?from=${from}&to=${to}`),
    prevProm
  ]);

  _clientRptData = { consumption: cData, spend: sData, fulfil: fData?.rows || [] };
  _cdashExec = exec; _cdashPrev = prev;

  renderCdashKpis();
  renderCdashInsights();
  renderCdashOverview();
  renderCdashOrdersStatus();
  renderCdashSpendGauge();
  renderCdashInventory();

  if (grid) grid.innerHTML = renderConsumptionGrid(cData?.rows || []);
  renderSpendContent(_clientRptSpendTab, sData);
  renderFulfilContent();
}

function renderCdashKpis() {
  const el = document.getElementById('cdash-kpis'); if (!el) return;
  const ex = _cdashExec;
  if (!ex || ex.error) { el.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--danger)">Couldn’t load KPIs.</div>'; return; }
  const f = ex.finance, o = ex.orders, d = ex.delivery;
  const dueOrders = (o.partial||0) + (o.pending||0);
  const pv = (_cdashCompare && _cdashPrev && !_cdashPrev.error) ? _cdashPrev : null;

  function chip(cur, prev, mode, goodDir) {
    if (!pv || prev == null) return '';
    let diff, txt;
    if (mode === 'pt') { diff = Math.round((cur-prev)*10)/10; txt = (diff>0?'+':'') + diff + 'pt'; }
    else { if (prev === 0) return ''; diff = Math.round((cur-prev)/Math.abs(prev)*1000)/10; txt = (diff>0?'+':'') + diff + '%'; }
    let tone = 'neu';
    if (diff !== 0) { if (goodDir==='up') tone = diff>0?'up':'down'; else if (goodDir==='down') tone = diff>0?'down':'up'; }
    const arrow = diff>0?'▲':diff<0?'▼':'▬';
    return `<div class="cdash-delta ${tone}"><span>${arrow} ${txt}</span><span class="cap">vs prev</span></div>`;
  }

  const utilTone = f.budget_util>100?'b':f.budget_util>90?'w':'g';
  const fillTone = d.fill_pct>=97?'g':d.fill_pct>=90?'w':'b';
  const dueOTone = dueOrders===0?'g':dueOrders>12?'b':'w';
  const dueVTone = d.due_value===0?'g':d.due_value>500000?'b':'w';

  const cards = [
    { tab:'spend',  l:'Budget',             v:cdashINR(f.budget), s:'allocated',                       c:'',        d:'' },
    { tab:'spend',  l:'Actual Spend',       v:cdashINR(f.spend),  s:(f.budget_util||0)+'% of budget',  c:'',        d:chip(f.spend, pv && pv.finance.spend, 'pct','down') },
    { tab:'spend',  l:'Budget Utilization', v:(f.budget_util||0)+'%', s:cdashINR(Math.max(0,(f.budget||0)-(f.spend||0)))+' left', c:utilTone, d:chip(f.budget_util, pv && pv.finance.budget_util, 'pt','down') },
    { tab:'orders', l:'Orders',             v:String(o.total||0), s:(o.completed||0)+' completed',      c:'',        d:chip(o.total, pv && pv.orders.total, 'pct','up') },
    { tab:'orders', l:'Fulfilment',         v:(d.fill_pct||0)+'%', s:(o.partial||0)+' partial · '+(o.pending||0)+' pending', c:fillTone, d:chip(d.fill_pct, pv && pv.delivery.fill_pct, 'pt','up') },
    { tab:'orders', l:'Due Orders',         v:String(dueOrders),  s:'awaiting delivery',               c:dueOTone,  d:chip(dueOrders, pv && ((pv.orders.partial||0)+(pv.orders.pending||0)), 'pct','down') },
    { tab:'orders', l:'Due Value',          v:cdashINR(d.due_value), s:'not yet received',             c:dueVTone,  d:chip(d.due_value, pv && pv.delivery.due_value, 'pct','down') },
    { tab:'spend',  l:'Avg Order',          v:cdashINR(o.avg),    s:'per order',                        c:'',        d:chip(o.avg, pv && pv.orders.avg, 'pct','neu') },
  ];
  el.innerHTML = cards.map(k => `<div class="cdash-kpi" ${dataAct('cdashSwitchTab', k.tab)}><div class="kl">${k.l}</div><div class="kv ${k.c}">${k.v}</div><div class="ks">${k.s}</div>${k.d}</div>`).join('');
}

function renderCdashInsights() {
  const el = document.getElementById('cdash-insights'); const ex = _cdashExec;
  if (!el || !ex || ex.error) { if (el) el.style.display = 'none'; return; }
  const f = ex.finance, o = ex.orders, d = ex.delivery;
  const ins = [];
  if (f.budget) {
    if (f.budget_util>100) ins.push(['b', `Over budget — ${f.budget_util}% used (${cdashINR(f.spend)} of ${cdashINR(f.budget)}).`]);
    else if (f.budget_util>90) ins.push(['w', `Nearing budget — ${f.budget_util}% used, ${cdashINR(Math.max(0,f.budget-f.spend))} left.`]);
    else ins.push(['g', `On budget — ${f.budget_util||0}% used, ${cdashINR(Math.max(0,f.budget-f.spend))} still available.`]);
  }
  if (o.total) {
    if (d.fill_pct<90) ins.push(['w', `Fulfilment at ${d.fill_pct}% — ${d.due_qty} units still due (${cdashINR(d.due_value)}).`]);
    else ins.push(['g', `Strong fulfilment at ${d.fill_pct}% across ${o.total} orders.`]);
  }
  if (d.due_value>0) { const dueOrders=(o.partial||0)+(o.pending||0); ins.push(['i', `${cdashINR(d.due_value)} awaiting delivery across ${dueOrders} open order${dueOrders===1?'':'s'}.`]); }
  if (_cdashCompare && _cdashPrev && !_cdashPrev.error) {
    const p = _cdashPrev;
    if (p.finance.spend) { const dp = Math.round((f.spend-p.finance.spend)/Math.abs(p.finance.spend)*1000)/10; if (dp) ins.push([dp>0?'w':'g', `Spend ${dp>0?'up':'down'} ${Math.abs(dp)}% vs previous period.`]); }
    const fd = Math.round((d.fill_pct-p.delivery.fill_pct)*10)/10; if (fd) ins.push([fd>0?'g':'w', `Fulfilment ${fd>0?'up':'down'} ${Math.abs(fd)}pt vs previous period.`]);
  }
  const crows = _clientRptData?.consumption?.rows || [];
  if (crows.length) ins.push(['i', `Most consumed: ${h(crows[0].item_name)} (${Math.round(crows[0].total_qty)} used).`]);

  if (!ins.length) { el.style.display = 'none'; return; }
  const dot = t => t==='g'?'var(--success)':t==='w'?'#d97706':t==='b'?'var(--danger)':'var(--navy)';
  el.style.display = '';
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px"><span style="font-size:.9rem">✦</span><span style="font-weight:700;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--primary)">Smart Insights</span></div>`
    + `<div style="display:flex;flex-direction:column;gap:7px">`
    + ins.slice(0,4).map(x => `<div style="display:flex;gap:9px;align-items:flex-start;font-size:.85rem;color:var(--navy)"><span style="width:7px;height:7px;border-radius:50%;background:${dot(x[0])};margin-top:6px;flex-shrink:0"></span><span>${x[1]}</span></div>`).join('')
    + `</div>`;
}

function renderCdashOverview() {
  const el = document.getElementById('cdash-overview'); const ex = _cdashExec;
  if (!el) return;
  if (!ex || ex.error) { el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No data for this period.</div>'; return; }
  const f = ex.finance, o = ex.orders, d = ex.delivery;
  const dueOrders = (o.partial||0) + (o.pending||0);
  const q1 = f.budget_util>100?'bad':f.budget_util>90?'warn':'ok';
  const q2 = d.fill_pct>=97?'ok':d.fill_pct>=90?'warn':'bad';
  const top = (_clientRptData?.consumption?.rows || [])[0];
  const cards = [
    ['1', q1, 'Are we within budget?', f.budget ? `<b>${f.budget_util}%</b> used — ${cdashINR(f.spend)} of ${cdashINR(f.budget)}. ${cdashINR(Math.max(0,f.budget-f.spend))} left.` : 'No budget set for this period.'],
    ['2', q2, 'Did we receive what we ordered?', o.total ? `<b>${d.fill_pct}%</b> fulfilled across ${o.total} orders. ${d.due_qty>0 ? `${d.due_qty} units (${cdashINR(d.due_value)}) still due.` : 'Nothing outstanding.'}` : 'No orders in this period.'],
    ['3', '', 'What are people consuming?', top ? `Top item <b>${h(top.item_name)}</b> — ${Math.round(top.total_qty)} used. See the Consumption tab.` : 'No consumption logged yet.'],
    ['4', dueOrders>5?'warn':'ok', 'What needs attention?', dueOrders>5 ? `<b>${dueOrders}</b> open orders to chase — see the Orders tab.` : 'Nothing urgent — deliveries are on track.'],
  ];
  el.innerHTML = `<div class="cdash-qgrid">` + cards.map(c => `<div class="cdash-q ${c[1]}"><div class="qq">${c[0]}. ${c[2]}</div><div class="qa">${c[3]}</div></div>`).join('') + `</div>`;
}

function renderCdashOrdersStatus() {
  const el = document.getElementById('cdash-orders-status'); const ex = _cdashExec;
  if (!el || !ex || ex.error) { if (el) el.innerHTML = ''; return; }
  const o = ex.orders, d = ex.delivery; const tot = o.total || 0;
  const barrow = (l,v,c) => { const p = tot ? Math.round(v/tot*100) : 0; return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px"><span style="width:96px;font-size:.82rem;color:var(--text-muted)">${l}</span><div style="flex:1;height:16px;border-radius:6px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${p}%;background:${c};border-radius:6px"></div></div><span style="width:34px;text-align:right;font-weight:700">${v}</span></div>`; };
  el.innerHTML = `<div class="card" style="padding:15px 17px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px"><span style="font-weight:700;font-size:.88rem;color:var(--navy)">Order status</span><span style="font-size:.76rem;color:var(--text-muted)">${tot} orders · ${d.fill_pct}% fulfilled</span></div>`
    + barrow('Completed', o.completed||0, 'var(--success)')
    + barrow('Partial', o.partial||0, '#d97706')
    + barrow('Pending', o.pending||0, 'var(--danger)')
    + `</div>`;
}

function renderCdashSpendGauge() {
  const el = document.getElementById('cdash-spend-gauge'); const ex = _cdashExec;
  if (!el || !ex || ex.error) { if (el) el.innerHTML = ''; return; }
  const f = ex.finance; const u = Math.min(f.budget_util||0, 100);
  const c = f.budget_util>100?'var(--danger)':f.budget_util>90?'#d97706':'var(--primary)';
  el.innerHTML = `<div class="card" style="padding:15px 17px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:8px"><span style="font-weight:700;color:var(--navy)">Budget utilization</span><span style="color:var(--text-muted)">${f.budget_util||0}% of ${cdashINR(f.budget)}</span></div><div style="height:20px;border-radius:7px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${u}%;background:${c};border-radius:7px"></div></div><div style="display:flex;justify-content:space-between;font-size:.76rem;color:var(--text-muted);margin-top:7px"><span><b style="color:var(--navy)">${cdashINR(f.spend)}</b> spent</span><span><b style="color:var(--navy)">${cdashINR(Math.max(0,(f.budget||0)-(f.spend||0)))}</b> headroom</span></div></div>`;
}

function renderCdashInventory() {
  const el = document.getElementById('cdash-inventory'); const ex = _cdashExec;
  if (!el || !ex || ex.error) { if (el) el.innerHTML = ''; return; }
  const inv = ex.inventory;
  const stat = (l,v,c,s) => `<div class="card" style="padding:14px 15px"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)">${l}</div><div style="font-size:1.3rem;font-weight:800;color:${c||'var(--navy)'};margin-top:4px">${v}</div><div style="font-size:.69rem;color:var(--text-muted);margin-top:2px">${s}</div></div>`;
  el.innerHTML = `<div style="font-size:.76rem;color:var(--text-muted);margin-bottom:10px">Warehouse stock levels (shared catalogue).</div>`
    + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">`
    + stat('Stock availability', (inv.availability||0)+'%', inv.availability>=90?'var(--success)':'#d97706', 'on-hand vs catalogue')
    + stat('Must-have items', (inv.must_have||0)+'%', inv.must_have>=95?'var(--success)':'#d97706', 'critical SKUs in stock')
    + stat('Low stock', inv.low_stock||0, inv.low_stock>0?'#d97706':'var(--navy)', 'below reorder level')
    + stat('Stock-out', inv.stock_out||0, inv.stock_out>0?'var(--danger)':'var(--success)', 'need action')
    + stat('Inventory value', cdashINR(inv.value||0), 'var(--navy)', 'at unit price')
    + `</div>`;
}

/* ── Order-vs-delivery fulfilment: month / quarter / fiscal-year, % + chart ── */
let _fulfilGranularity = 'month';
let _fulfilMode = 'chart';

function fiscalBucket(period, gran) {
  // period = 'YYYY-MM'; Indian FY = Apr–Mar
  const [y, m] = period.split('-').map(Number);
  if (gran === 'month') {
    const d = new Date(y, m-1, 1);
    return { key: period, label: d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'}) };
  }
  const fyStart = m >= 4 ? y : y - 1;
  const fyLabel = `FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}`;
  if (gran === 'year') return { key: `${fyStart}`, label: fyLabel };
  // fiscal quarter
  const q = m >= 4 && m <= 6 ? 1 : m >= 7 && m <= 9 ? 2 : m >= 10 && m <= 12 ? 3 : 4;
  return { key: `${fyStart}-Q${q}`, label: `Q${q} ${fyLabel}` };
}

function bucketFulfil(rows, gran) {
  const map = new Map();
  (rows||[]).forEach(r => {
    const b = fiscalBucket(r.period, gran);
    if (!map.has(b.key)) map.set(b.key, { key:b.key, label:b.label, ordered_qty:0, delivered_qty:0, ordered_value:0, delivered_value:0, order_count:0 });
    const o = map.get(b.key);
    o.ordered_qty    += r.ordered_qty||0;
    o.delivered_qty  += r.delivered_qty||0;
    o.ordered_value  += r.ordered_value||0;
    o.delivered_value+= r.delivered_value||0;
    o.order_count    += r.order_count||0;
  });
  return [...map.values()].sort((a,b)=>a.key<b.key?-1:1).map(o => ({
    ...o, fill_pct: o.ordered_qty ? Math.round(o.delivered_qty/o.ordered_qty*100) : 0
  }));
}

function switchFulfilGranularity(g) { _fulfilGranularity = g; renderFulfilContent(); }
function switchFulfilMode(m) { _fulfilMode = m; renderFulfilContent(); }

function renderFulfilContent() {
  const el = document.getElementById('rpt-fulfil-content');
  if (!el) return;
  ['month','quarter','year'].forEach(g => {
    [`ftab-${g}`,`aftab-${g}`].forEach(id=>{ const b=document.getElementById(id);
      if (b) { b.style.background = g===_fulfilGranularity?'var(--primary)':'#fff'; b.style.color = g===_fulfilGranularity?'#fff':'var(--text-muted)'; } });
  });
  ['chart','table'].forEach(m => {
    [`fmode-${m}`,`afmode-${m}`].forEach(id=>{ const b=document.getElementById(id); if (b) b.style.background = m===_fulfilMode ? 'var(--primary)' : '#fff'; });
  });

  const data = bucketFulfil(_clientRptData.fulfil, _fulfilGranularity);
  if (!data.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders yet.</div>'; return; }

  // Overall fill across all buckets
  const totOrd = data.reduce((s,d)=>s+d.ordered_qty,0);
  const totDel = data.reduce((s,d)=>s+d.delivered_qty,0);
  const overall = totOrd ? Math.round(totDel/totOrd*100) : 0;
  const ovColor = overall>=90?'#16a34a':overall>=70?'#d97706':'#dc2626';

  const header = `<div class="card" style="padding:14px 18px;margin-bottom:14px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div><div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Overall Fill Rate</div>
      <div style="font-size:1.8rem;font-weight:800;color:${ovColor};line-height:1.1">${overall}%</div></div>
    <div style="height:34px;width:1px;background:var(--border)"></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Ordered</div><div style="font-weight:700">${Math.round(totOrd)} units</div></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Delivered</div><div style="font-weight:700">${Math.round(totDel)} units</div></div>
    <div><div style="font-size:.72rem;color:var(--text-muted)">Still Due</div><div style="font-weight:700;color:${totOrd-totDel>0?'#dc2626':'#16a34a'}">${Math.round(Math.max(0,totOrd-totDel))} units</div></div>
    <div style="flex:1"></div>
    <button class="btn btn-secondary btn-sm" ${dataAct('openCategoryDrill', '', 'All periods in range')}>🔍 Category Split (all)</button>
  </div>`;

  if (_fulfilMode === 'table') {
    el.innerHTML = header + `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Period</th><th style="text-align:right">Orders</th><th style="text-align:right">Ordered</th><th style="text-align:right">Delivered</th><th style="text-align:right">Due</th><th style="text-align:right">Fill %</th><th></th></tr></thead>
      <tbody>${data.map(d=>{ const due=Math.max(0,d.ordered_qty-d.delivered_qty); const c=d.fill_pct>=90?'#16a34a':d.fill_pct>=70?'#d97706':'#dc2626';
        const periodParam = _fulfilGranularity==='month' ? d.key : '';
        return `<tr style="cursor:pointer" onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background=''" onclick="openCategoryDrill('${periodParam}','${d.label.replace(/'/g,"")}')">
          <td style="font-weight:600;color:var(--blue)">${d.label}</td>
          <td style="text-align:right">${d.order_count}</td>
          <td style="text-align:right">${Math.round(d.ordered_qty)}</td>
          <td style="text-align:right">${Math.round(d.delivered_qty)}</td>
          <td style="text-align:right;color:${due>0?'#dc2626':'inherit'}">${Math.round(due)}</td>
          <td style="text-align:right;font-weight:700;color:${c}">${d.fill_pct}%</td>
          <td style="text-align:right;color:var(--text-muted)">Categories ›</td>
        </tr>`;}).join('')}</tbody>
    </table></div></div>
    <div style="font-size:.74rem;color:var(--text-muted);margin-top:6px">💡 ${_fulfilGranularity==='month'?'Click a month':'Switch to Monthly to drill by month, or use "Category Split (all)"'} to see the category → sub-category breakdown.</div>`;
    return;
  }

  // Chart mode — clean, single Fill % bar chart (color-coded, big % labels).
  // Ordered/Delivered units live in the tooltip and the table, keeping this uncluttered.
  if (!window.Chart) { _fulfilMode = 'table'; renderFulfilContent(); return; }
  const fillColor = p => p>=90 ? '#16a34a' : p>=70 ? '#d97706' : '#dc2626';
  el.innerHTML = header + `<div class="card" style="padding:18px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div style="font-weight:700;font-size:.9rem;color:var(--navy)">Fill Rate by ${_fulfilGranularity==='month'?'Month':_fulfilGranularity==='quarter'?'Quarter':'Fiscal Year'}</div>
      <div style="display:flex;gap:14px;font-size:.72rem;color:var(--text-muted)">
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#16a34a"></span>≥90%</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#d97706"></span>70–89%</span>
        <span style="display:inline-flex;align-items:center;gap:5px"><span style="width:11px;height:11px;border-radius:3px;background:#dc2626"></span>&lt;70%</span>
      </div>
    </div>
    <div style="position:relative;height:${Math.max(280, Math.min(420, data.length*46+120))}px"><canvas id="fulfil-chart"></canvas></div>
    <div style="font-size:.73rem;color:var(--text-muted);margin-top:8px">Hover a bar for ordered/delivered units${_fulfilGranularity==='month'?' · click to drill into categories':''}.</div>
  </div>`;
  const ctx = document.getElementById('fulfil-chart');
  if (ctx && window.Chart) {
    if (APP.charts.fulfil) { try{APP.charts.fulfil.destroy();}catch(_){} }
    // Inline plugin: print the % value at the end of each bar, big and bold
    const pctLabels = {
      id:'pctLabels',
      afterDatasetsDraw(chart){
        const {ctx} = chart; const meta = chart.getDatasetMeta(0);
        if (!meta) return;
        ctx.save(); ctx.font='800 14px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
        meta.data.forEach((bar,i)=>{ const v=data[i].fill_pct; ctx.fillStyle=fillColor(v); ctx.fillText(' '+v+'%', bar.x+4, bar.y); });
        ctx.restore();
      }
    };
    APP.charts.fulfil = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d=>d.label),
        datasets: [
          { label:'Fill %', data:data.map(d=>d.fill_pct), backgroundColor:data.map(d=>fillColor(d.fill_pct)),
            borderRadius:6, barThickness:'flex', maxBarThickness:34,
            _ordered:data.map(d=>Math.round(d.ordered_qty)), _delivered:data.map(d=>Math.round(d.delivered_qty)) },
        ]
      },
      options: {
        indexAxis:'y',                 // horizontal bars — labels always readable
        responsive:true, maintainAspectRatio:false,
        layout:{ padding:{ right:52 } },
        onClick: (evt, els) => {
          if (!els.length) return;
          const d = data[els[0].index]; if (!d) return;
          openCategoryDrill(_fulfilGranularity==='month' ? d.key : '', d.label);
        },
        plugins:{ legend:{ display:false },
          tooltip:{ callbacks:{
            label:(c)=>`Fill: ${c.raw}%`,
            afterLabel:(c)=>{ const d=data[c.dataIndex]; return `Ordered: ${Math.round(d.ordered_qty)}  ·  Delivered: ${Math.round(d.delivered_qty)}  ·  Due: ${Math.round(Math.max(0,d.ordered_qty-d.delivered_qty))}`; },
            afterBody: ()=> _fulfilGranularity==='month' ? '\nClick to drill into categories' : '' } } },
        scales:{
          x:{ beginAtZero:true, max:100, grid:{color:'#f0f2f7'}, ticks:{callback:v=>v+'%',font:{size:10}}, title:{display:true,text:'Fill %',font:{size:11,weight:'700'}} },
          y:{ grid:{display:false}, ticks:{font:{size:11,weight:'600'}} }
        }
      },
      plugins:[pctLabels]
    });
  }
}

/* ══ Category / sub-category drill-down (client → period → category → subcat) ══ */
let _drillState = { periodKey:'', baseLabel:'', gran:'custom', category:null };
let _drillClientId = null; // set when an admin drills a specific client

function fyQuarterRange(y, m) {
  let sm, em, sy=y, ey=y;
  if (m>=4&&m<=6){sm=4;em=6;} else if (m>=7&&m<=9){sm=7;em=9;} else if (m>=10&&m<=12){sm=10;em=12;} else {sm=1;em=3;}
  const from = `${sy}-${String(sm).padStart(2,'0')}-01`;
  const to = new Date(ey, em, 0).toISOString().slice(0,10); // last day of end month
  const fyStart = (sm>=4)?sy:sy-1;
  const q = sm>=4&&sm<=6?1:sm>=7&&sm<=9?2:sm>=10&&sm<=12?3:4;
  return { from, to, label:`Q${q} FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}` };
}
function fyYearRange(y, m) {
  const fyStart = m>=4?y:y-1;
  return { from:`${fyStart}-04-01`, to:`${fyStart+1}-03-31`, label:`FY${String(fyStart).slice(2)}-${String(fyStart+1).slice(2)}` };
}

// Resolve the current drill window (period exact, or from/to range) + label
function drillWindow() {
  const { periodKey, gran, baseLabel } = _drillState;
  if (gran === 'month' && /^\d{4}-\d{2}$/.test(periodKey)) {
    const d = new Date(periodKey+'-01');
    return { period: periodKey, label: d.toLocaleDateString('en-IN',{month:'short',year:'numeric'}) };
  }
  if ((gran === 'quarter' || gran === 'year') && /^\d{4}-\d{2}$/.test(periodKey)) {
    const [y,m] = periodKey.split('-').map(Number);
    const r = gran==='quarter' ? fyQuarterRange(y,m) : fyYearRange(y,m);
    return { from:r.from, to:r.to, label:r.label };
  }
  // custom → page date filter
  const from = document.getElementById('rpt-from')?.value || document.getElementById('adm-rpt-from')?.value || '';
  const to   = document.getElementById('rpt-to')?.value   || document.getElementById('adm-rpt-to')?.value   || '';
  return { from, to, label: baseLabel || 'Custom range' };
}

async function openCategoryDrill(periodKey, baseLabel) {
  _drillState = { periodKey: periodKey||'', baseLabel: baseLabel||'All periods', gran: periodKey ? 'month' : 'custom', category:null };
  openModal('Category Breakdown', '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div>',
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  loadDrill();
}

function setDrillGran(g) { _drillState.gran = g; loadDrill(); }
function drillToSubcategory(category) { _drillState.category = category; loadDrill(); }
function drillBackToCategory() { _drillState.category = null; loadDrill(); }

async function loadDrill() {
  const { category, periodKey } = _drillState;
  const win = drillWindow();
  const params = new URLSearchParams();
  if (win.period) params.set('period', win.period);
  else { if(win.from)params.set('from',win.from); if(win.to)params.set('to',win.to); }
  if (category != null) params.set('category', category);
  if (_drillClientId) params.set('client_id', _drillClientId);

  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = category != null ? `Sub-category · ${category}` : 'Category Breakdown';

  const body = document.getElementById('modal-body');
  if (body) body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;margin:0 auto"></div></div>';

  const data = await api('/reports/category-breakdown?' + params.toString());
  if (!body) return;
  const rows = (data?.rows || []).filter(r => (r.ordered_qty||0) > 0);

  // Granularity selector (only meaningful when drilled from a specific month)
  const granBar = periodKey ? `<div style="display:inline-flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:12px">
    ${[['month','Month'],['quarter','Quarter'],['year','Fiscal Year'],['custom','Custom']].map(([g,lbl])=>
      `<button ${dataAct('setDrillGran', g)} style="padding:5px 12px;font-size:.74rem;font-weight:600;border:none;cursor:pointer;background:${_drillState.gran===g?'var(--primary)':'#fff'};color:${_drillState.gran===g?'#fff':'var(--text-muted)'}">${lbl}</button>`).join('')}
  </div>` : '';

  // Breadcrumb
  const crumb = `<div style="display:flex;align-items:center;gap:6px;font-size:.8rem;margin-bottom:10px;flex-wrap:wrap">
    <span style="color:var(--text-muted)">📅 ${h(win.label)}</span>
    <span style="color:var(--border)">›</span>
    <button ${dataAct('drillBackToCategory')} style="background:none;border:none;cursor:pointer;padding:0;font-size:.8rem;font-weight:${category==null?'700':'400'};color:${category==null?'var(--navy)':'var(--blue)'}">Categories</button>
    ${category!=null?`<span style="color:var(--border)">›</span><span style="font-weight:700;color:var(--navy)">${h(category)}</span>`:''}
  </div>` + granBar;

  if (!rows.length) { body.innerHTML = crumb + '<div style="text-align:center;padding:30px;color:var(--text-muted)">No data for this selection.</div>'; return; }

  const totOrdVal = rows.reduce((s,r)=>s+(r.ordered_value||0),0) || 1;
  const totOrdQty = rows.reduce((s,r)=>s+(r.ordered_qty||0),0);
  const totDelQty = rows.reduce((s,r)=>s+(r.delivered_qty||0),0);
  const palette = ['#6366f1','#0891b2','#16a34a','#d97706','#dc2626','#7c3aed','#0ea5e9','#65a30d','#db2777','#64748b','#ea580c','#0d9488'];

  const enriched = rows.map((r,i)=>({
    ...r,
    share: Math.round((r.ordered_value||0)/totOrdVal*100),
    fill: r.ordered_qty ? Math.round((r.delivered_qty||0)/r.ordered_qty*100) : 0,
    color: palette[i%palette.length],
  }));

  const isCat = category == null;
  const donut = window.Chart ? `<div style="flex:0 0 210px;position:relative;height:210px"><canvas id="drill-donut"></canvas></div>` : '';
  const listRows = enriched.map(r=>{
    const fc = r.fill>=90?'#16a34a':r.fill>=70?'#d97706':'#dc2626';
    const clickable = isCat;
    return `<tr style="${clickable?'cursor:pointer':''}" ${clickable?`onmouseover="this.style.background='#f8f9fb'" onmouseout="this.style.background=''" onclick="drillToSubcategory('${String(r.name).replace(/'/g,"")}')"`:''}>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${r.color};margin-right:7px"></span><b style="${clickable?'color:var(--blue)':''}">${h(r.name)}</b></td>
      <td style="text-align:right;font-weight:700">${r.share}%</td>
      <td style="text-align:right">${Math.round(r.ordered_qty)}</td>
      <td style="text-align:right">${Math.round(r.delivered_qty)}</td>
      <td style="text-align:right;font-weight:700;color:${fc}">${r.fill}%</td>
      ${clickable?'<td style="text-align:right;color:var(--text-muted);font-size:.8rem">›</td>':'<td></td>'}
    </tr>`;
  }).join('');

  body.innerHTML = crumb + `
    <div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap">
      ${donut}
      <div style="flex:1;min-width:280px">
        <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:6px">Overall fill: <b style="color:${totOrdQty&&Math.round(totDelQty/totOrdQty*100)>=90?'#16a34a':'#d97706'}">${totOrdQty?Math.round(totDelQty/totOrdQty*100):0}%</b> · ${Math.round(totOrdQty)} ordered · ${Math.round(totDelQty)} delivered</div>
        <div class="table-wrap"><table class="table" style="margin:0">
          <thead><tr><th>${isCat?'Category':'Sub-category'}</th><th style="text-align:right">% Split</th><th style="text-align:right">Ordered</th><th style="text-align:right">Delivered</th><th style="text-align:right">Fill %</th><th></th></tr></thead>
          <tbody>${listRows}</tbody>
        </table></div>
        ${isCat?'<div style="font-size:.73rem;color:var(--text-muted);margin-top:6px">💡 Click a category to see its sub-category split.</div>':''}
      </div>
    </div>`;

  if (window.Chart) {
    const cv = document.getElementById('drill-donut');
    if (cv) {
      if (APP.charts.drill) { try{APP.charts.drill.destroy();}catch(_){} }
      APP.charts.drill = new Chart(cv, {
        type:'doughnut',
        data:{ labels:enriched.map(r=>r.name), datasets:[{ data:enriched.map(r=>Math.round(r.ordered_value)), backgroundColor:enriched.map(r=>r.color), borderWidth:1, borderColor:'#fff' }] },
        options:{ responsive:true, maintainAspectRatio:false, cutout:'58%',
          plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c)=>`${c.label}: ${fmt(c.raw)} (${enriched[c.dataIndex].share}%)` } } },
          onClick:(e,els)=>{ if(isCat&&els.length){ drillToSubcategory(String(enriched[els[0].index].name)); } }
        }
      });
    }
  }
}


function renderConsumptionGrid(rows) {
  if (!rows.length) return '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">No consumption recorded in this period.</div>';

  const beverages = rows.filter(r => /beverag/i.test(r.category||''));
  const pantry    = rows.filter(r => !/beverag/i.test(r.category||'')); // everything that isn't a beverage (snacks, dry fruits, pantry…)

  function card(title, icon, color, bg, items, mode) {
    const sorted = mode === 'top' ? items.slice(0,5) : [...items].reverse().slice(0,5);
    const label  = mode === 'top' ? 'Top 5 Most Consumed' : 'Bottom 5 Least Consumed';
    const rows2  = sorted.length ? sorted.map((r,i) => {
      const bar = Math.round((r.total_qty / (sorted[0].total_qty||1)) * 100);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid ${color}18">
        <div style="width:20px;text-align:center;font-weight:700;font-size:.78rem;color:${color}">${i+1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${h(r.item_name)}">${h(r.item_name)}</div>
          <div style="background:${color}22;border-radius:3px;height:4px;margin-top:3px;width:${bar}%"></div>
        </div>
        <div style="text-align:right;font-size:.82rem;font-weight:700;color:${color};white-space:nowrap">${Math.round(r.total_qty)} used</div>
      </div>`;
    }).join('') : `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.82rem">No data for ${title}</div>`;
    return `<div style="background:${bg};border:1px solid ${color}30;border-radius:10px;padding:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:1.3rem">${icon}</span>
        <div>
          <div style="font-weight:700;font-size:.88rem;color:${color}">${title}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">${label}</div>
        </div>
      </div>
      ${rows2}
    </div>`;
  }

  const allTop    = card('Overall', '📊', '#1e40af', '#eff6ff', rows, 'top');
  const pantryTop = card('Pantry & Snacks',  '🥫', '#065f46', '#ecfdf5', pantry, 'top');
  const bevTop    = card('Beverages','🥤', '#7c3aed', '#f5f3ff', beverages, 'top');
  const allBot    = card('Overall', '📉', '#92400e', '#fffbeb', rows, 'bottom');
  const pantryBot = card('Pantry & Snacks',  '🥫', '#b91c1c', '#fef2f2', pantry, 'bottom');
  const bevBot    = card('Beverages','🥤', '#6b7280', '#f9fafb', beverages, 'bottom');

  return `
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--primary);margin-bottom:2px">▲ Highest Consumed</div>
    ${allTop}${pantryTop}${bevTop}
    <div style="grid-column:1/-1;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-top:8px;margin-bottom:2px">▼ Lowest Consumed</div>
    ${allBot}${pantryBot}${bevBot}
  `;
}

function switchSpendTab(tab) {
  _clientRptSpendTab = tab;
  ['monthly','yearly','po'].forEach(t => {
    const btn = document.getElementById(`stab-${t}`);
    if (!btn) return;
    btn.style.borderBottomColor = t === tab ? 'var(--primary)' : 'transparent';
    btn.style.color = t === tab ? 'var(--primary)' : 'var(--text-muted)';
  });
  renderSpendContent(tab, _clientRptData.spend);
}

function renderSpendContent(tab, data) {
  const el = document.getElementById('rpt-spend-content');
  if (!el) return;

  // activate the right tab button
  ['monthly','yearly','po'].forEach(t => {
    const btn = document.getElementById(`stab-${t}`);
    if (!btn) return;
    btn.style.borderBottomColor = t === tab ? 'var(--primary)' : 'transparent';
    btn.style.color = t === tab ? 'var(--primary)' : 'var(--text-muted)';
  });

  if (!data) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No data</div>'; return; }

  if (tab === 'monthly') {
    const rows = data.monthly || [];
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    const maxSpend = Math.max(...rows.map(r => r.total_spend || 0), 1);
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Month</th><th style="text-align:right">Orders</th><th style="text-align:right">Spend</th><th style="min-width:120px">Trend</th></tr></thead>
      <tbody>${rows.map(r => {
        const bar = Math.round(((r.total_spend||0)/maxSpend)*100);
        return `<tr>
          <td style="font-weight:600">${r.month}</td>
          <td style="text-align:right">${r.order_count}</td>
          <td style="text-align:right;font-weight:700;color:var(--navy)">${fmt(r.total_spend)}</td>
          <td><div style="background:var(--primary);border-radius:3px;height:6px;width:${bar}%"></div></td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr style="background:var(--surface-alt)">
        <td style="font-weight:700">Total</td>
        <td style="text-align:right;font-weight:700">${rows.reduce((s,r)=>s+(r.order_count||0),0)}</td>
        <td style="text-align:right;font-weight:700;color:var(--primary)">${fmt(rows.reduce((s,r)=>s+(r.total_spend||0),0))}</td>
        <td></td>
      </tr></tfoot>
    </table></div></div>`;

  } else if (tab === 'yearly') {
    const monthly = data.monthly || [];
    // group by year
    const byYear = {};
    monthly.forEach(r => {
      const y = r.year || r.month?.slice(0,4) || '—';
      if (!byYear[y]) byYear[y] = { year:y, order_count:0, total_spend:0, months:0 };
      byYear[y].order_count += (r.order_count||0);
      byYear[y].total_spend += (r.total_spend||0);
      byYear[y].months++;
    });
    const years = Object.values(byYear).sort((a,b)=>a.year<b.year?-1:1);
    if (!years.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Year</th><th style="text-align:right">Months Active</th><th style="text-align:right">Orders</th><th style="text-align:right">Total Spend</th><th style="text-align:right">Avg / Month</th></tr></thead>
      <tbody>${years.map(r => `<tr>
        <td style="font-weight:700;font-size:.95rem">${r.year}</td>
        <td style="text-align:right">${r.months}</td>
        <td style="text-align:right">${r.order_count}</td>
        <td style="text-align:right;font-weight:700;color:var(--navy)">${fmt(r.total_spend)}</td>
        <td style="text-align:right;color:var(--text-muted)">${fmt(r.months ? r.total_spend/r.months : 0)}</td>
      </tr>`).join('')}</tbody>
    </table></div></div>`;

  } else if (tab === 'po') {
    const rows = data.po_wise || [];
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">No orders in this period.</div>'; return; }
    el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr><th>Order / PO</th><th>Date</th><th style="text-align:center">Items</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td style="font-weight:700;color:var(--primary)">#${r.order_id}</td>
        <td style="font-size:.8rem;color:var(--text-muted)">${fmtDate(r.created_at)}</td>
        <td style="text-align:center">${r.item_count}</td>
        <td style="text-align:right;font-weight:700">${fmt(r.grand_total)}</td>
        <td>${statusBadge(r.status)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="background:var(--surface-alt)">
        <td colspan="3" style="font-weight:700">Total (${rows.length} orders)</td>
        <td style="text-align:right;font-weight:700;color:var(--primary)">${fmt(rows.reduce((s,r)=>s+(r.grand_total||0),0))}</td>
        <td></td>
      </tr></tfoot>
    </table></div></div>`;
  }
}

function downloadClientConsumptionCSV() {
  const rows = _clientRptData.consumption?.rows || [];
  if (!rows.length) { showToast('No data to export', 'error'); return; }
  const header = 'SKU,Item Name,Category,Total Qty Used,Log Count';
  const body = rows.map(r => [r.sku, `"${r.item_name}"`, r.category||'', Math.round(r.total_qty), r.log_count].join(',')).join('\n');
  _downloadCSV('consumption-report', header + '\n' + body);
}

function downloadClientSpendCSV() {
  if (_clientRptSpendTab === 'po') {
    const rows = _clientRptData.spend?.po_wise || [];
    if (!rows.length) { showToast('No data to export', 'error'); return; }
    const header = 'Order ID,Date,Items,Amount,Status';
    const body = rows.map(r => [`#${r.order_id}`, fmtDate(r.created_at), r.item_count, r.grand_total, r.status].join(',')).join('\n');
    _downloadCSV('spend-po-report', header + '\n' + body);
  } else {
    const rows = _clientRptData.spend?.monthly || [];
    if (!rows.length) { showToast('No data to export', 'error'); return; }
    const header = 'Month,Year,Orders,Total Spend';
    const body = rows.map(r => [r.month, r.year, r.order_count, r.total_spend].join(',')).join('\n');
    _downloadCSV('spend-monthly-report', header + '\n' + body);
  }
}

function _downloadCSV(name, csv) {
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `${name}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}
