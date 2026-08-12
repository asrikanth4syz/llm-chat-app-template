/* ============================================================
   ORDER PIPELINE — control-tower board + per-order lifecycle timeline.
   Both read the projection endpoints (/api/pipeline, /api/orders/:id/lifecycle)
   assembled from existing order_history / PO / DC timestamps — no new data.
   ============================================================ */

let _pipeCssDone = false;
function injectPipeCss() {
  if (_pipeCssDone) return; _pipeCssDone = true;
  const css = `
  .pipe { --pk:#0C8E6D; --pk2:#1E7FB8; --pw:#B5731A; --pb:#C6472A;
          --pk-s:#E2F3EC; --pk2-s:#E4F0F8; --pw-s:#FBF0DB; --pb-s:#FBE7E1; }
  .pipe-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:14px; }
  @media (max-width:820px){ .pipe-kpis{ grid-template-columns:repeat(2,1fr); } }
  .pipe-kpi { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:12px; padding:13px 15px; }
  .pipe-kpi .n { font-size:1.5rem; font-weight:800; letter-spacing:-.03em; line-height:1.1; }
  .pipe-kpi .l { font-size:.74rem; color:var(--text-muted,#5c7180); margin-top:2px; }
  .pipe-kpi.bad .n{ color:var(--pb); } .pipe-kpi.accent .n{ color:var(--pk); }
  .pipe-flow { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:12px; padding:13px 15px; margin-bottom:18px; }
  .pipe-flow .cap { display:flex; justify-content:space-between; font-size:.72rem; color:var(--text-muted,#5c7180); margin-bottom:8px; }
  .pipe-flow .cap b { color:var(--pw); }
  .pipe-flowbar { display:flex; gap:3px; height:24px; }
  .pipe-flowbar .fs { border-radius:4px; background:var(--pk-s); color:var(--pk); display:grid; place-items:center; font-size:.72rem; font-weight:700; min-width:24px; font-family:ui-monospace,monospace; }
  .pipe-flowbar .fs.hot { background:var(--pw-s); color:var(--pw); box-shadow:inset 0 0 0 1px var(--pw); }
  .pipe-board-scroll { overflow-x:auto; padding-bottom:6px; }
  .pipe-board { display:flex; gap:12px; min-width:1120px; align-items:flex-start; }
  .pipe-col { flex:1 1 0; min-width:158px; }
  .pipe-col h4 { margin:0; font-size:.88rem; font-weight:700; display:flex; align-items:center; gap:6px; }
  .pipe-col .stgno { font-family:ui-monospace,monospace; font-size:.62rem; color:var(--text-muted,#8397a3); font-weight:700; }
  .pipe-col .cnt { margin-left:auto; font-family:ui-monospace,monospace; font-size:.74rem; font-weight:700; background:var(--bg,#f4f7f9); border:1px solid var(--border,#e4eaef); border-radius:6px; padding:0 7px; }
  .pipe-col .cval { font-size:.7rem; color:var(--text-muted,#5c7180); margin:4px 0 7px; }
  .pipe-col .rule { height:3px; border-radius:2px; background:var(--border,#cbd8de); margin-bottom:10px; }
  .pipe-col.hot h4 { color:var(--pw); } .pipe-col.hot .rule { background:var(--pw); }
  .pipe-col.hot .tag { font-size:.58rem; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:var(--pw); background:var(--pw-s); border-radius:5px; padding:1px 6px; }
  .pipe-cards { display:flex; flex-direction:column; gap:8px; }
  .pcard { display:block; text-decoration:none; color:inherit; background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:10px; padding:10px 11px; cursor:pointer; transition:box-shadow .12s,transform .12s; }
  .pcard:hover { box-shadow:0 4px 14px rgba(14,34,51,.1); transform:translateY(-1px); }
  .pcard.flag { border-color:var(--pb); }
  .pcard .pc-top { display:flex; align-items:center; gap:8px; }
  .pcard .pc-id { font-family:ui-monospace,monospace; font-size:.73rem; font-weight:700; }
  .pcard .pc-sla { margin-left:auto; font-size:.63rem; font-weight:700; padding:2px 7px; border-radius:999px; white-space:nowrap; }
  .pc-sla.ok{ background:var(--pk-s); color:var(--pk); } .pc-sla.risk{ background:var(--pw-s); color:var(--pw); } .pc-sla.late{ background:var(--pb-s); color:var(--pb); }
  .pcard .pc-client { font-size:.83rem; font-weight:600; margin:6px 0 2px; }
  .pcard .pc-foot { display:flex; align-items:baseline; gap:8px; font-size:.73rem; color:var(--text-muted,#5c7180); }
  .pcard .pc-foot .v { font-weight:700; color:var(--text,#16303f); }
  .pcard .pc-ref { margin-top:7px; font-family:ui-monospace,monospace; font-size:.64rem; color:var(--pk); background:var(--pk-s); border-radius:5px; padding:2px 6px; display:inline-block; }
  .pipe-empty { font-size:.72rem; color:var(--text-muted,#8397a3); text-align:center; padding:14px 6px; border:1px dashed var(--border,#e4eaef); border-radius:9px; }

  /* timeline (modal) */
  .tl { position:relative; }
  .tl::before { content:""; position:absolute; left:15px; top:10px; bottom:14px; width:2px; background:var(--border,#cbd8de); }
  .tlrow { position:relative; padding-left:44px; padding-bottom:10px; }
  .tlnode { position:absolute; left:0; top:0; width:32px; height:32px; border-radius:50%; display:grid; place-items:center; font-family:ui-monospace,monospace; font-weight:700; font-size:.72rem; background:var(--bg,#f4f7f9); border:2px solid var(--border,#e4eaef); color:var(--text-muted,#8397a3); z-index:1; }
  .tlrow.done .tlnode { background:var(--pk); border-color:var(--pk); color:#fff; }
  .tlrow.current .tlnode { background:var(--card,#fff); border:3px solid var(--pk2); color:var(--pk2); }
  .tlrow.skipped .tlnode { border-style:dashed; }
  .tlcard { border:1px solid var(--border,#e4eaef); border-radius:10px; padding:10px 12px; background:var(--card,#fff); }
  .tlrow.current .tlcard { border-color:var(--pk2); box-shadow:0 0 0 3px var(--pk2-s); }
  .tlrow.skipped .tlcard, .tlrow.pending .tlcard { background:var(--bg,#f7f9fa); border-style:dashed; }
  .tlhead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .tlhead h5 { margin:0; font-size:.98rem; font-weight:700; }
  .tlhead .when { margin-left:auto; font-size:.72rem; color:var(--text-muted,#8397a3); white-space:nowrap; }
  .tl-st { font-size:.62rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:999px; }
  .tl-st.done{ background:var(--pk-s); color:var(--pk); } .tl-st.current{ background:var(--pk2-s); color:var(--pk2); }
  .tl-st.pending{ background:var(--bg,#eef2f4); color:var(--text-muted,#8397a3); border:1px solid var(--border,#e4eaef); }
  .tl-st.skipped{ background:transparent; color:var(--text-muted,#8397a3); border:1px dashed var(--border,#cbd8de); }
  .tl-tag { font-size:.62rem; font-weight:700; padding:2px 7px; border-radius:5px; background:var(--pw-s); color:var(--pw); }
  .tl-tag.branch { background:var(--pk-s); color:var(--pk); }
  .tldesc { font-size:.82rem; color:var(--text-muted,#5c7180); margin:5px 0 0; }
  .tlrefs { display:flex; gap:6px; flex-wrap:wrap; margin-top:7px; }
  .tlref { font-family:ui-monospace,monospace; font-size:.66rem; font-weight:600; color:var(--pk); background:var(--pk-s); border-radius:5px; padding:2px 7px; }
  .tlsubs { margin:9px 0 1px; border-left:2px solid var(--border,#e4eaef); padding-left:12px; display:flex; flex-direction:column; gap:7px; }
  .tlsub { display:flex; gap:8px; align-items:baseline; font-size:.78rem; }
  .tlsub .d { flex:none; width:6px; height:6px; border-radius:50%; background:var(--pk); transform:translateY(-1px); }
  .tlsub.wait .d { background:var(--border,#cbd8de); }
  .tlsub .w { margin-left:auto; font-size:.7rem; color:var(--text-muted,#8397a3); white-space:nowrap; }
  .tl-strip { display:flex; gap:14px; flex-wrap:wrap; background:var(--bg,#f4f7f9); border:1px solid var(--border,#e4eaef); border-radius:10px; padding:11px 14px; margin-bottom:16px; font-size:.8rem; }
  .tl-strip b { font-weight:700; }
  .tl-prog { display:flex; gap:2px; margin-top:6px; }
  .tl-prog i { height:6px; width:14px; border-radius:2px; background:var(--pk); }
  .tl-prog i.pend { background:var(--border,#cbd8de); }`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

async function renderPipeline(el) {
  injectPipeCss();
  el.innerHTML = pageHeader('Order Pipeline', 'Control tower — every in-flight order by stage') +
    '<div class="pipe"><div class="loading-state"><div class="spinner"></div></div></div>';
  const data = await api('/pipeline');
  if (!data) return;
  const k = data.kpis || {};
  const maxCount = Math.max(1, ...(data.buckets || []).map(b => b.count));
  const hotLabel = k.bottleneck ? k.bottleneck.label : null;

  const kpis = `<div class="pipe-kpis">
    ${pipeKpi(k.inflight ?? 0, 'Orders in-flight', 'accent')}
    ${pipeKpi(fmt(k.value || 0), 'Value in pipeline')}
    ${pipeKpi(k.overdue ?? 0, 'Overdue vs SLA', (k.overdue ? 'bad' : ''))}
    ${pipeKpi(k.avg_cycle || '—', 'Avg cycle time')}
    ${pipeKpi(k.bottleneck ? k.bottleneck.label : '—', k.bottleneck ? `Bottleneck · ${k.bottleneck.avg_dwell} avg` : 'Bottleneck')}
  </div>`;

  const flow = `<div class="pipe-flow">
    <div class="cap"><span>Distribution across stages</span>${hotLabel ? `<span><b>${h(hotLabel)}</b> is holding the most work</span>` : ''}</div>
    <div class="pipe-flowbar">
      ${(data.buckets || []).map(b => `<div class="fs ${b.label === hotLabel ? 'hot' : ''}" style="flex:${Math.max(1, b.count)}" title="${h(b.label)}">${b.count || ''}</div>`).join('')}
    </div>
  </div>`;

  const board = `<div class="pipe-board-scroll"><div class="pipe-board">
    ${(data.buckets || []).map(b => pipeColumn(b, b.label === hotLabel)).join('')}
  </div></div>`;

  el.querySelector('.pipe').innerHTML = kpis + flow + board;
}

function pipeKpi(n, l, cls = '') {
  return `<div class="pipe-kpi ${cls}"><div class="n" style="font-variant-numeric:tabular-nums">${n}</div><div class="l">${l}</div></div>`;
}

function pipeColumn(b, hot) {
  const cards = (b.orders || []).length
    ? b.orders.map(pipeCard).join('')
    : '<div class="pipe-empty">Nothing here</div>';
  return `<div class="pipe-col ${hot ? 'hot' : ''}">
    <h4><span class="stgno">${String(b.no).padStart(2, '0')}</span> ${h(b.label)}<span class="cnt">${b.count}</span></h4>
    <div class="cval">${hot ? `<span class="tag">bottleneck</span> ` : ''}${b.value ? fmt(b.value) : '—'} · ${b.avg_dwell} avg</div>
    <div class="rule"></div>
    <div class="pipe-cards">${cards}</div>
  </div>`;
}

function pipeCard(o) {
  const slaText = o.sla === 'late' ? 'overdue' : (o.sla === 'risk' ? o.dwell : o.dwell);
  return `<a class="pcard ${o.flag ? 'flag' : ''}" ${dataAct('orderTimelineModal', o.id)}>
    <div class="pc-top"><span class="pc-id">${h(o.id)}</span><span class="pc-sla ${o.sla}">${h(slaText)}</span></div>
    <div class="pc-client">${h(o.client_name || '—')}</div>
    <div class="pc-foot"><span class="v">${fmt(o.value)}</span><span class="dwell" style="margin-left:auto">${h(o.dwell)} in stage</span></div>
    ${o.po_ref ? `<span class="pc-ref">${h(o.po_ref)}</span>` : ''}
  </a>`;
}

// Per-order lifecycle timeline — opened from a pipeline card or the order detail.
async function orderTimelineModal(id) {
  injectPipeCss();
  openModal('Order ' + id + ' · Timeline', '<div class="loading-state"><div class="spinner"></div></div>',
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  const d = await api('/orders/' + id + '/lifecycle');
  if (!d) return;
  document.getElementById('modal-body').innerHTML = timelineHtml(d);
}

function timelineHtml(d) {
  const o = d.order || {};
  const p = d.progress || { done: 0, total: 10 };
  const prog = Array.from({ length: p.total }, (_, i) => `<i class="${i < p.done ? '' : 'pend'}"></i>`).join('');
  const strip = `<div class="tl-strip">
    <span><b>${h(o.client_name || '—')}</b></span>
    <span>Value <b>${fmt(o.grand_total || 0)}</b></span>
    <span>Stage <b>${p.done}/${p.total}</b></span>
    <span>Elapsed <b>${h(d.elapsed || '—')}</b></span>
    <span style="width:100%"><div class="tl-prog">${prog}</div></span>
  </div>`;
  const rows = (d.stages || []).map(timelineRow).join('');
  return strip + `<div class="tl">${rows}</div>`;
}

function timelineRow(s) {
  const stateCls = s.state; // done | current | pending | skipped
  const nodeTxt = s.state === 'done' ? '✓' : String(s.no).padStart(2, '0');
  const stLabel = s.state === 'current' ? 'Current' : s.state.charAt(0).toUpperCase() + s.state.slice(1);
  const when = s.at ? fmtWhen(s.at) : (s.state === 'current' ? 'in progress' : '');
  const tag = s.tag ? `<span class="tl-tag ${/branch|shortage|challan/i.test(s.tag) ? 'branch' : ''}">${h(s.tag)}</span>` : '';
  const refs = (s.refs && s.refs.length) ? `<div class="tlrefs">${s.refs.map(r => `<span class="tlref">${h(r)}</span>`).join('')}</div>` : '';
  const subs = (s.subs && s.subs.length) ? `<div class="tlsubs">${s.subs.map(su =>
    `<div class="tlsub ${su.wait ? 'wait' : ''}"><span class="d"></span><span class="t">${h(su.text)}</span>${su.at ? `<span class="w">${fmtWhen(su.at)}</span>` : ''}</div>`).join('')}</div>` : '';
  const desc = s.note ? `<p class="tldesc">${h(s.note)}</p>` : '';
  return `<div class="tlrow ${stateCls}">
    <div class="tlnode">${nodeTxt}</div>
    <div class="tlcard">
      <div class="tlhead"><h5>${h(s.label)}</h5><span class="tl-st ${stateCls}">${stLabel}</span>${tag}<span class="when">${h(when)}</span></div>
      ${desc}${refs}${subs}
    </div>
  </div>`;
}

// Compact timestamp: "08 Aug · 15:30" from an ISO/SQLite datetime.
function fmtWhen(v) {
  try {
    const dt = new Date(String(v).replace(' ', 'T') + (String(v).includes('T') || String(v).includes('Z') ? '' : 'Z'));
    if (isNaN(dt.getTime())) return String(v).slice(0, 16);
    const mon = dt.toLocaleString('en-GB', { day: '2-digit', month: 'short' });
    const tm = dt.toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${mon} · ${tm}`;
  } catch (_) { return String(v).slice(0, 16); }
}
