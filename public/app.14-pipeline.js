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
  @media (max-width:1100px){ .pipe-kpis{ grid-template-columns:repeat(3,1fr); } }
  @media (max-width:620px){ .pipe-kpis{ grid-template-columns:repeat(2,1fr); gap:10px; } }
  @media (max-width:620px){ .pipe-kpi .n{ font-size:1.3rem; } }
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
  .pipe-board-scroll { overflow-x:auto; overflow-y:hidden; padding-bottom:8px; -webkit-overflow-scrolling:touch; scrollbar-width:thin; scroll-snap-type:x proximity; }
  .pipe-board-scroll::-webkit-scrollbar { height:8px; }
  .pipe-board-scroll::-webkit-scrollbar-thumb { background:var(--border,#cbd8de); border-radius:6px; }
  .pipe-board { display:flex; gap:12px; min-width:1120px; align-items:flex-start; }
  .pipe-col { flex:1 1 0; min-width:158px; scroll-snap-align:start; }
  /* Tablet/phone: fixed comfortable column width so the board swipes cleanly. */
  @media (max-width:900px){ .pipe-board{ min-width:0; } .pipe-col{ flex:0 0 78vw; max-width:300px; min-width:220px; } }
  @media (max-width:520px){ .pipe-col{ flex:0 0 84vw; } }
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
  .tl-prog i.pend { background:var(--border,#cbd8de); }

  /* home widget */
  .rpw { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:14px; overflow:hidden; }
  .rpw-head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 11px; }
  .rpw-head h3 { margin:0; font-size:.98rem; font-weight:700; display:flex; align-items:center; gap:8px; }
  .rpw-head .ico { width:24px; height:24px; border-radius:7px; background:var(--pk-s); color:var(--pk); display:grid; place-items:center; font-size:.85rem; }
  .rpw-head a { font-size:.78rem; font-weight:600; color:var(--pk); text-decoration:none; cursor:pointer; }
  .rpw-row { display:grid; grid-template-columns:1fr auto; gap:5px 12px; padding:11px 16px; border-top:1px solid var(--border,#e4eaef); cursor:pointer; text-decoration:none; color:inherit; transition:background .12s; }
  .rpw-row:hover { background:var(--bg,#f5f8f9); }
  .rpw-top { display:flex; align-items:center; gap:8px; min-width:0; }
  .rpw-id { font-family:ui-monospace,monospace; font-size:.73rem; font-weight:700; flex:none; }
  .rpw-client { font-size:.81rem; color:var(--text-muted,#5c7180); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rpw-val { font-family:ui-monospace,monospace; font-size:.77rem; font-weight:700; text-align:right; white-space:nowrap; }
  .rpw-line { grid-column:1/-1; display:flex; align-items:center; gap:9px; }
  .rpw-prog { display:flex; gap:2px; flex:none; }
  .rpw-prog i { width:10px; height:5px; border-radius:2px; background:var(--pk); }
  .rpw-prog i.cur { background:var(--pk2); } .rpw-prog i.pend { background:var(--border,#cbd8de); }
  .rpw-stg { font-size:.72rem; color:var(--text-muted,#5c7180); } .rpw-stg b { color:var(--text,#16303f); }
  .rpw-sla { margin-left:auto; display:inline-flex; align-items:center; gap:5px; font-size:.68rem; font-weight:700; }
  .rpw-sla i { width:8px; height:8px; border-radius:50%; }
  .rpw-sla.ok { color:var(--pk); } .rpw-sla.ok i { background:var(--pk); }
  .rpw-sla.risk { color:var(--pw); } .rpw-sla.risk i { background:var(--pw); }
  .rpw-sla.late { color:var(--pb); } .rpw-sla.late i { background:var(--pb); }
  .rpw-foot { padding:10px 16px; border-top:1px solid var(--border,#e4eaef); font-size:.73rem; color:var(--text-muted,#8397a3); background:var(--bg,#f5f8f9); }`;
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

// Home-dashboard widget: recent orders with their pipeline position; each row
// opens the order's Timeline. Fills #ops-recent-pipeline if present (no-op else).
async function mountRecentPipeline() {
  const host = document.getElementById('ops-recent-pipeline');
  if (!host) return;
  injectPipeCss();
  const data = await api('/pipeline').catch(() => null);
  const recent = (data && data.recent) || [];
  if (!recent.length) { host.innerHTML = ''; return; }
  const rows = recent.map(o => {
    const pips = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      return `<i class="${n < o.stage_no ? '' : (n === o.stage_no ? 'cur' : 'pend')}"></i>`;
    }).join('');
    const slaText = o.sla === 'late' ? 'overdue' : (o.sla === 'ok' ? 'on track' : o.dwell);
    return `<a class="rpw-row" ${dataAct('orderTimelineModal', o.id)}>
      <div class="rpw-top"><span class="rpw-id">${h(o.id)}</span><span class="rpw-client">${h(o.client_name || '—')}</span></div>
      <div class="rpw-val">${fmt(o.value)}</div>
      <div class="rpw-line">
        <span class="rpw-prog">${pips}</span>
        <span class="rpw-stg"><b>${h(o.stage_label)}</b> · ${o.stage_no}/10</span>
        <span class="rpw-sla ${o.sla}"><i></i>${h(slaText)}</span>
      </div>
    </a>`;
  }).join('');
  host.innerHTML = `<div class="rpw">
    <div class="rpw-head"><h3><span class="ico">🧭</span> Recent orders</h3><a ${dataAct('navigate', 'pipeline')}>Open Pipeline →</a></div>
    ${rows}
    <div class="rpw-foot">Showing ${recent.length} of ${data.kpis ? data.kpis.inflight : recent.length} in-flight · newest first</div>
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

/* ============================================================
   NEXT BEST ACTION — every in-flight order reduced to its single
   blocking next step, ranked by SLA urgency. Reads /api/pipeline/
   next-actions (order_history / PO / DC read-model — no new data).
   ============================================================ */
let _nbaCssDone = false;
function injectNbaCss() {
  if (_nbaCssDone) return; _nbaCssDone = true;
  const css = `
  .nba { --nk:#0C8E6D; --nw:#B5731A; --nb:#C6472A;
         --nk-s:#E2F3EC; --nw-s:#FBF0DB; --nb-s:#FBE7E1; }
  .nba-chips { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:16px; }
  @media (max-width:720px){ .nba-chips{ grid-template-columns:repeat(2,1fr); } }
  .nba-chip { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:12px; padding:12px 15px; }
  .nba-chip .n { font-size:1.5rem; font-weight:800; letter-spacing:-.03em; line-height:1.1; font-variant-numeric:tabular-nums; }
  .nba-chip .l { font-size:.74rem; color:var(--text-muted,#5c7180); margin-top:2px; }
  .nba-chip.bad .n{ color:var(--nb); } .nba-chip.warn .n{ color:var(--nw); } .nba-chip.good .n{ color:var(--nk); }
  .nba-focus { background:linear-gradient(180deg,var(--card,#fff),var(--nk-s)); border:1px solid var(--nk); border-radius:14px; padding:16px 18px; margin-bottom:20px; box-shadow:0 4px 16px rgba(12,142,109,.1); }
  .nba-focus.late { background:linear-gradient(180deg,var(--card,#fff),var(--nb-s)); border-color:var(--nb); box-shadow:0 4px 16px rgba(198,71,42,.12); }
  .nba-focus .eyebrow { font-size:.66rem; font-weight:800; letter-spacing:.09em; text-transform:uppercase; color:var(--nk); }
  .nba-focus.late .eyebrow { color:var(--nb); }
  .nba-focus .fx-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:6px 0 4px; }
  .nba-focus .fx-verb { font-size:1.35rem; font-weight:800; letter-spacing:-.02em; color:var(--text,#16303f); }
  .nba-focus .fx-meta { font-size:.86rem; color:var(--text-muted,#5c7180); margin-bottom:12px; }
  .nba-focus .fx-meta b { color:var(--text,#16303f); }
  .nba-focus .fx-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .nba-sla { font-size:.66rem; font-weight:800; padding:3px 9px; border-radius:999px; white-space:nowrap; }
  .nba-sla.ok{ background:var(--nk-s); color:var(--nk); } .nba-sla.risk{ background:var(--nw-s); color:var(--nw); } .nba-sla.late{ background:var(--nb-s); color:var(--nb); }
  .nba-owner { font-size:.68rem; font-weight:700; color:var(--text-muted,#5c7180); background:var(--bg,#f4f7f9); border:1px solid var(--border,#e4eaef); border-radius:6px; padding:2px 8px; }
  .nba-list { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:14px; overflow:hidden; }
  .nba-list-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border,#e4eaef); }
  .nba-list-head h3 { margin:0; font-size:.95rem; font-weight:700; }
  .nba-list-head .sub { font-size:.72rem; color:var(--text-muted,#8397a3); }
  .nba-row { display:grid; grid-template-columns:34px 1.4fr 1.3fr auto auto; gap:14px; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border,#eef2f4); }
  .nba-row:last-child { border-bottom:none; }
  .nba-row:hover { background:var(--bg,#f7fafb); }
  .nba-rank { font-family:ui-monospace,monospace; font-size:.8rem; font-weight:800; color:var(--text-muted,#8397a3); text-align:center; }
  .nba-order .oid { font-family:ui-monospace,monospace; font-size:.78rem; font-weight:700; color:var(--nk); cursor:pointer; text-decoration:none; }
  .nba-order .oid:hover { text-decoration:underline; }
  .nba-order .ocl { font-size:.84rem; font-weight:600; color:var(--text,#16303f); margin-top:1px; }
  .nba-order .ostg { font-size:.7rem; color:var(--text-muted,#8397a3); margin-top:1px; }
  .nba-what .verb { font-size:.86rem; font-weight:700; color:var(--text,#16303f); }
  .nba-what .why { font-size:.72rem; color:var(--text-muted,#5c7180); margin-top:1px; }
  .nba-meta { display:flex; flex-direction:column; align-items:flex-end; gap:5px; }
  .nba-btn { border:none; border-radius:8px; background:var(--nk); color:#fff; font-size:.78rem; font-weight:700; padding:8px 14px; cursor:pointer; white-space:nowrap; transition:filter .12s; }
  .nba-btn:hover { filter:brightness(1.07); }
  .nba-btn.late { background:var(--nb); }
  .nba-empty { padding:40px 16px; text-align:center; color:var(--text-muted,#8397a3); }
  .nba-empty .big { font-size:2rem; }
  .nba-note { font-size:.72rem; color:var(--text-muted,#8397a3); margin-top:12px; text-align:center; }
  @media (max-width:720px){
    .nba-row { grid-template-columns:26px 1fr auto; column-gap:10px; }
    /* Hide the whole meta column (not just the SLA pill) so the row has exactly
       three cells — otherwise the empty meta box took a column and pushed the
       action button (e.g. "Raise invoice →") partly off-screen. */
    .nba-what, .nba-meta { display:none; }
    /* Let the order cell shrink and ellipsis instead of shoving the button out. */
    .nba-order { min-width:0; }
    .nba-order .oid, .nba-order .ocl, .nba-order .ostg { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .nba-btn { padding:8px 12px; }
  }`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

async function renderNextActions(el) {
  injectNbaCss();
  el.innerHTML = pageHeader('Next Best Action', 'Every in-flight order → its single blocking next step, ranked by urgency') +
    '<div class="nba"><div class="loading-state"><div class="spinner"></div></div></div>';
  const data = await api('/pipeline/next-actions');
  if (!data) return;
  const c = data.counts || {};
  const actions = data.actions || [];

  const chips = `<div class="nba-chips">
    ${nbaChip(c.overdue ?? 0, 'Overdue vs SLA', (c.overdue ? 'bad' : ''))}
    ${nbaChip(c.at_risk ?? 0, 'At risk', (c.at_risk ? 'warn' : ''))}
    ${nbaChip(c.on_track ?? 0, 'On track', 'good')}
    ${nbaChip(c.total ?? 0, 'Open actions')}
  </div>`;

  const focus = data.focus ? nbaFocus(data.focus) : '';

  const rest = actions.slice(data.focus ? 1 : 0);
  const rows = rest.length
    ? rest.map((a, i) => nbaRow(a, i + (data.focus ? 2 : 1))).join('')
    : `<div class="nba-empty"><div class="big">✅</div><p style="margin:8px 0 0">Nothing else waiting — the pipeline is clear.</p></div>`;

  const list = `<div class="nba-list">
    <div class="nba-list-head"><h3>Action queue</h3><span class="sub">${rest.length} more · sorted by SLA urgency</span></div>
    ${rows}
  </div>`;

  el.querySelector('.nba').innerHTML = chips + focus + list +
    `<p class="nba-note">Fed by the live pipeline read-model (approvals, POs, delivery challans). Acting on a step moves the order forward and refreshes here.</p>`;
}

function nbaChip(n, l, cls = '') {
  return `<div class="nba-chip ${cls}"><div class="n">${n}</div><div class="l">${h(l)}</div></div>`;
}

function nbaFocus(a) {
  const slaTxt = a.sla === 'late' ? `Overdue by ${fmtDwell(a.over_h)}` : (a.sla === 'risk' ? `Due soon · ${h(a.dwell)} in stage` : `${h(a.dwell)} in stage`);
  return `<div class="nba-focus ${a.sla === 'late' ? 'late' : ''}">
    <div class="eyebrow">${a.sla === 'late' ? '⚠ Do this first' : '➜ Do this first'}</div>
    <div class="fx-head">
      <span class="fx-verb">${h(a.action)}</span>
      <span class="nba-sla ${a.sla}">${slaTxt}</span>
    </div>
    <div class="fx-meta"><a class="nba-order" style="cursor:pointer;color:inherit" ${dataAct('orderTimelineModal', a.id)}><b>${h(a.id)}</b></a> · <b>${h(a.client_name || '—')}</b> · ${fmt(a.value)} · Stage ${a.stage_no}/10 ${h(a.stage_label)}<br>${h(a.why)}</div>
    <div class="fx-row">
      <button class="nba-btn ${a.sla === 'late' ? 'late' : ''}" ${dataAct('navigate', a.page)}>${h(a.action)} →</button>
      <span class="nba-owner">Owner · ${h(a.owner)}</span>
    </div>
  </div>`;
}

function nbaRow(a, rank) {
  const slaTxt = a.sla === 'late' ? `Overdue ${fmtDwell(a.over_h)}` : (a.sla === 'risk' ? 'At risk' : 'On track');
  return `<div class="nba-row">
    <div class="nba-rank">${rank}</div>
    <div class="nba-order">
      <a class="oid" ${dataAct('orderTimelineModal', a.id)}>${h(a.id)}</a>
      <div class="ocl">${h(a.client_name || '—')}</div>
      <div class="ostg">Stage ${a.stage_no}/10 · ${h(a.stage_label)} · ${fmt(a.value)}</div>
    </div>
    <div class="nba-what">
      <div class="verb">${h(a.action)}</div>
      <div class="why">${h(a.why)} · ${h(a.owner)}</div>
    </div>
    <div class="nba-meta">
      <span class="nba-sla ${a.sla}">${slaTxt}</span>
    </div>
    <button class="nba-btn ${a.sla === 'late' ? 'late' : ''}" ${dataAct('navigate', a.page)}>${h(a.action)} →</button>
  </div>`;
}

// Hours → compact "3d 4h" / "5h" for SLA overage display.
function fmtDwell(hrs) {
  const hh = Math.max(0, Math.round(Number(hrs) || 0));
  if (hh < 24) return hh + 'h';
  const d = Math.floor(hh / 24), r = hh % 24;
  return r ? `${d}d ${r}h` : `${d}d`;
}

/* ============================================================
   OVER-DELIVERY AUDIT — READ-ONLY. Lists orders where recorded
   deliveries exceed the ordered qty (SP-2608-7410 class) and names
   the challans responsible. No actions here — surfacing only.
   ============================================================ */
async function renderOverDeliveryAudit(el) {
  injectNbaCss();
  el.innerHTML = pageHeader('Over-Delivery Audit', 'Read-only — orders where recorded deliveries exceed what was ordered') +
    '<div class="nba"><div class="loading-state"><div class="spinner"></div></div></div>';
  const data = await api('/reports/over-delivery-audit');
  if (!data) return;
  const s = data.summary || {};
  const anomalies = data.anomalies || [];

  const chips = `<div class="nba-chips" style="grid-template-columns:repeat(3,1fr)">
    ${nbaChip(s.orders_affected ?? 0, 'Orders affected', (s.orders_affected ? 'bad' : 'good'))}
    ${nbaChip(s.lines_affected ?? 0, 'Line items affected', (s.lines_affected ? 'warn' : 'good'))}
    ${nbaChip(s.total_over_units ?? 0, 'Units over-delivered', (s.total_over_units ? 'bad' : 'good'))}
  </div>`;

  const body = anomalies.length
    ? anomalies.map(a => {
        const rows = (a.challans || []).map(dc => `
          <tr class="${dc.suspect ? 'aud-suspect' : ''}">
            <td class="tnum">${h(dc.dc_number || dc.dc_id)}</td>
            <td>${statusBadge ? statusBadge(dc.status) : h(dc.status)}</td>
            <td class="u-right">${dc.qty_ordered}</td>
            <td class="u-right">${dc.qty_delivered}</td>
            <td class="u-right"><b>${dc.counted_as}</b></td>
            <td>${dc.delivered_at ? fmtWhen(dc.delivered_at) : '—'}</td>
            <td>${dc.suspect ? `<span class="aud-flag">⚠ likely phantom</span> <button class="btn btn-sm btn-danger" ${dataAct('repairPreview', dc.dc_id)} style="margin-left:6px">Cancel…</button>` : ''}</td>
          </tr>`).join('');
        return `<div class="aud-card">
          <div class="aud-head">
            <div>
              <a class="oid" style="font-size:.9rem" ${dataAct('orderTimelineModal', a.order_id)}>${h(a.order_id)}</a>
              <span class="aud-cl">${h(a.client_name || '—')}</span>
              <span class="aud-sku">${h(a.item_name || a.sku)} · ${h(a.sku)}</span>
            </div>
            <div class="aud-nums">
              <span>Ordered <b>${a.ordered}</b></span>
              <span>Counted delivered <b class="over">${a.delivered_effective}</b></span>
              <span>Recorded <b>${a.delivered_recorded}</b></span>
              <span class="aud-over">+${a.over_units} over</span>
            </div>
          </div>
          <div style="overflow-x:auto">
            <table class="aud-table">
              <thead><tr><th>Challan</th><th>Status</th><th class="u-right">DC qty</th><th class="u-right">Recorded</th><th class="u-right">Counted as</th><th>Delivered</th><th></th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      }).join('')
    : `<div class="nba-empty" style="background:var(--card);border:1px solid var(--border);border-radius:14px"><div class="big">✅</div><p style="margin:8px 0 0">No over-delivered orders found — every order is within its ordered quantity.</p></div>`;

  el.querySelector('.nba').innerHTML = chips + body +
    `<p class="nba-note">Read-only audit. A row flagged <b>⚠ likely phantom</b> is a DELIVERED challan whose line quantity was never recorded, so it was counted at its full ordered load. Cancelling/correcting such a challan is a separate, explicit action.</p>`;
}

(function injectAuditCss(){
  const css = `
  .aud-card { background:var(--card,#fff); border:1px solid var(--border,#e4eaef); border-radius:12px; padding:14px 16px; margin-bottom:14px; }
  .aud-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .aud-head .aud-cl { font-weight:600; margin-left:8px; }
  .aud-head .aud-sku { display:block; font-size:.75rem; color:var(--text-muted,#5c7180); margin-top:2px; }
  .aud-nums { display:flex; gap:14px; flex-wrap:wrap; font-size:.78rem; color:var(--text-muted,#5c7180); align-items:center; }
  .aud-nums b { color:var(--text,#16303f); } .aud-nums b.over { color:#C6472A; }
  .aud-over { font-weight:800; color:#C6472A; background:#FBE7E1; border-radius:999px; padding:2px 10px; }
  .aud-table { width:100%; border-collapse:collapse; font-size:.8rem; }
  .aud-table th { text-align:left; font-size:.68rem; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted,#8397a3); padding:6px 8px; border-bottom:1px solid var(--border,#e4eaef); }
  .aud-table td { padding:7px 8px; border-bottom:1px solid var(--border,#eef2f4); }
  .aud-table .u-right { text-align:right; font-variant-numeric:tabular-nums; }
  .aud-table tr.aud-suspect { background:#FBE7E1; }
  .aud-flag { font-size:.68rem; font-weight:800; color:#C6472A; white-space:nowrap; }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

// Repair preview (dry-run) → shows exactly what cancelling a phantom challan
// would do, then lets the operator apply it. Nothing mutates until "Apply".
async function repairPreview(dcId, reverse) {
  openModal((reverse ? 'Void challan & reverse stock · ' : 'Cancel phantom challan · ') + dcId,
    '<div class="loading-state"><div class="spinner"></div></div>',
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  const d = await api('/reports/over-delivery-audit/repair', { method:'POST', body: JSON.stringify({ dry_run:true, reverse_stock: !!reverse, dc_ids:[dcId] }) });
  if (!d) return;
  const r = (d.results || []).find(x => x.dc_id === dcId) || {};
  const eligible = !!r.eligible;
  const showStock = !!reverse;
  const skuRows = (r.skus || []).map(s => `
    <tr><td>${h(s.name || s.sku)}</td><td class="u-right">${s.ordered}</td>
      <td class="u-right">${s.delivered_before}</td><td class="u-right"><b>${s.delivered_after}</b></td>
      ${showStock ? `<td class="u-right" style="color:var(--success,#0C8E6D);font-weight:700">${s.stock_reversal>0?'+'+s.stock_reversal:'—'}</td>` : ''}</tr>`).join('');
  // When a plain cancel is refused only because the challan moved stock, offer
  // the explicit stock-reversing void.
  const offerReverse = !eligible && String(r.reason||'').includes('reverse_stock');
  const bodyHtml = `
    <div style="font-size:.86rem;margin-bottom:10px">
      ${eligible
        ? `<div style="color:var(--success,#0C8E6D)">✔ <b>${reverse?'Safe to void.':'Safe to cancel.'}</b> ${h(r.reason||'')}</div>`
        : `<div style="color:var(--danger,#C6472A)">✖ <b>Not eligible.</b> ${h(r.reason||'')}</div>`}
      ${reverse ? `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--warning-bg,#FBF0DB);border:1px solid var(--warning,#B5731A);color:#8a5a12;font-size:.8rem">⚠ Use this only if the goods did <b>not</b> physically ship. It adds the delivered units back into inventory and undoes the client-store receipt.</div>` : ''}
    </div>
    <table class="aud-table"><thead><tr><th>Item</th><th class="u-right">Ordered</th><th class="u-right">Delivered now</th><th class="u-right">After</th>${showStock?'<th class="u-right">Back to stock</th>':''}</tr></thead>
      <tbody>${skuRows || `<tr><td colspan="${showStock?5:4}">No line items</td></tr>`}</tbody></table>
    <p class="nba-note" style="text-align:left;margin-top:10px">Order <b>${h(r.order_id||'')}</b>. Dry-run preview — nothing has changed yet.</p>`;
  let footer;
  if (eligible && reverse) footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button> <button class="btn btn-danger" ${dataAct('repairApply', dcId, true)}>Void challan &amp; reverse stock</button>`;
  else if (eligible)       footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button> <button class="btn btn-danger" ${dataAct('repairApply', dcId)}>Cancel this challan</button>`;
  else if (offerReverse)   footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button> <button class="btn btn-warning" ${dataAct('repairPreview', dcId, true)}>Void &amp; reverse stock…</button>`;
  else                     footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const mf = document.getElementById('modal-footer'); if (mf) mf.innerHTML = footer;
}

async function repairApply(dcId, reverse) {
  const d = await api('/reports/over-delivery-audit/repair', { method:'POST', body: JSON.stringify({ dry_run:false, reverse_stock: !!reverse, dc_ids:[dcId] }) });
  if (!d) return;
  closeModal();
  if (d.applied > 0) {
    const rev = d.stock_reversed ? ` · ${d.stock_reversed} units returned to stock` : '';
    showToast(`Challan ${dcId} ${reverse?'voided':'cancelled'} — order reconciled${(d.orders_closed||[]).length?' and closed':''}${rev}.`);
    if (typeof navigate === 'function') navigate('over_delivery_audit');
  } else {
    showToast('Nothing changed — challan was not eligible.', 'error');
  }
}
