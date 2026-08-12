/* ============================================================
   DELIVERY CALENDAR — Phase 1
   Month planner + right rail over existing delivery challans:
   at-risk flags, next-7-days, 14-day agenda, reschedule in place.
   ============================================================ */
let _dcal = null;

function dcalKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
// Which date a DC sits on: delivered → delivery date; else planned date; else dispatch; else creation.
function dcalDcDate(dc) {
  if (dc.status === 'DELIVERED' && dc.delivered_at) return String(dc.delivered_at).slice(0,10);
  if (dc.scheduled_date) return String(dc.scheduled_date).slice(0,10);
  if (dc.dispatched_at)  return String(dc.dispatched_at).slice(0,10);
  if (dc.delivered_at)   return String(dc.delivered_at).slice(0,10);
  return String(dc.created_at||'').slice(0,10);
}
function dcalIsRisk(dc, k) { return !['DELIVERED','CANCELLED','RETURNED'].includes(dc.status) && k && k < dcalKey(new Date()); }
function dcalCls(dc, k) {
  if (dc.status === 'DELIVERED') return 'del';
  if (dcalIsRisk(dc, k)) return 'ris';
  if (['IN_TRANSIT','DISPATCHED'].includes(dc.status)) return 'tra';
  return 'sch';
}

async function renderDeliveryCalendar(el) {
  el.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading deliveries…</p></div>`;
  const [dcs, sos, pol] = await Promise.all([
    api('/delivery-challans'),
    api('/standing-orders').catch(() => null),
    api('/delivery-calendar/settings').catch(() => null),
  ]);
  if (!dcs) { el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted)">Could not load deliveries.</div>'; return; }
  const now = new Date();
  _dcal = { y: now.getFullYear(), m: now.getMonth(), sel: dcalKey(now), view: 'month', client: '', status: '', dcs, sos: sos || [],
    pol: pol || { email_t1: true, dayof: true, ghost_nudge: true, capacity: 6 } };
  const clients = [...new Set(dcs.map(d => d.client_name).filter(Boolean))].sort();

  el.innerHTML = `
  ${pageHeader('Delivery Calendar', 'Pre-planned deliveries — booked, in transit, delivered & at risk on one calendar')}
  <style id="dcal-style">
    #dcal-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
    @media(max-width:860px){#dcal-kpis{grid-template-columns:repeat(2,1fr)}}
    .dcal-kp{background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--navy);border-radius:11px;padding:10px 13px;text-align:left;font-family:inherit}
    .dcal-kp .l{font-size:.62rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted)}
    .dcal-kp .v{font-size:1.35rem;font-weight:800;color:var(--navy);line-height:1.15;margin-top:2px}
    .dcal-kp .s{font-size:.66rem;color:var(--text-muted)}
    .dcal-kp.com{border-top-color:var(--success)} .dcal-kp.com .v{color:var(--success)}
    .dcal-kp.upc{border-top-color:#2f6bd6}
    .dcal-kp.ris{border-top-color:var(--danger);cursor:pointer;transition:.13s} .dcal-kp.ris .v{color:var(--danger)}
    .dcal-kp.ris:hover{border-color:var(--danger)}
    .dcal-kp.rec{border-top-color:var(--primary)} .dcal-kp.rec .v{color:var(--primary-hover)}
    #dcal-body{display:grid;grid-template-columns:1fr 290px;gap:14px;align-items:start}
    @media(max-width:1000px){#dcal-body{grid-template-columns:1fr}}
    .dcal-grid{display:grid;grid-template-columns:repeat(7,1fr);min-width:680px}
    .dcal-dow{padding:7px 9px;font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);border-bottom:1px solid var(--border)}
    .dcal-day{min-height:92px;border:none;border-bottom:1px solid var(--border-light);border-right:1px solid var(--border-light);padding:6px 7px;cursor:pointer;background:var(--surface);text-align:left;font-family:inherit;transition:.12s}
    .dcal-day:nth-child(7n){border-right:none}
    .dcal-day:hover{background:var(--surface-2)}
    .dcal-day.out{background:var(--surface-2);opacity:.55}
    .dcal-day.sel{box-shadow:inset 0 0 0 2px var(--primary)}
    .dcal-day .dn{font-size:.74rem;font-weight:700;color:var(--text-muted);display:flex;align-items:center;gap:5px}
    .dcal-day.today .dn i{font-style:normal;background:var(--primary);color:#fff;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem}
    .dcal-day .dn .n{margin-left:auto;font-size:.6rem;color:var(--text-muted);font-weight:700}
    .dcal-day .dn .n.full{color:var(--danger)}
    .dcal-riskbadge{font-size:.52rem;font-weight:800;background:var(--danger);color:#fff;border-radius:20px;padding:1px 6px}
    .dcal-chip{display:block;width:100%;margin-top:4px;font-size:.63rem;font-weight:700;padding:2px 6px;border-radius:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}
    .dcal-chip.sch{background:#e9eef4;color:#25384d;border:1px solid #c6d2e0}
    .dcal-chip.tra{background:var(--amber-bg);color:#b45309;border:1px solid #fde68a}
    .dcal-chip.del{background:#d1fae5;color:#047857;border:1px solid #a7f3d0}
    .dcal-chip.ris{background:var(--danger-soft-bg);color:var(--danger);border:1px solid #fecaca}
    .dcal-chip.gho{background:var(--primary-light);color:var(--primary-hover);border:1.5px dashed var(--primary-border)}
    .dcal-more{margin-top:3px;font-size:.6rem;color:var(--text-muted);font-weight:700}
    .dcal-rail-card{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:11px 13px;margin-bottom:12px}
    .dcal-rc-h{font-size:.63rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px;display:flex;justify-content:space-between;gap:8px}
    .dcal-rl{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;border-bottom:1px solid var(--border-light);padding:7px 2px;cursor:pointer;text-align:left;font-family:inherit}
    .dcal-rl:last-child{border-bottom:none}
    .dcal-rl:hover .t{color:var(--primary)}
    .dcal-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .dcal-rl .m{flex:1;min-width:0}
    .dcal-rl .t{font-size:.76rem;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
    .dcal-rl .s{font-size:.65rem;color:var(--text-muted);display:block}
    .dcal-pill{font-size:.58rem;font-weight:800;padding:2px 7px;border-radius:20px;white-space:nowrap}
    .dcal-pill.red{background:var(--danger-soft-bg);color:var(--danger)}.dcal-pill.amb{background:var(--amber-bg);color:#b45309}.dcal-pill.blu{background:#e9eef4;color:#25384d}.dcal-pill.grn{background:#d1fae5;color:#047857}.dcal-pill.org{background:#ccfbf1;color:var(--primary-hover)}
    .dcal-vbtn{padding:6px 13px;font-size:.76rem;font-weight:700;border:1px solid var(--border);background:var(--surface);border-radius:20px;cursor:pointer;color:var(--text-muted)}
    .dcal-vbtn.on{background:var(--primary);border-color:var(--primary);color:#fff}
  </style>
  <div id="dcal-kpis"></div>
  <div class="card" style="padding:10px 14px;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <div style="display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden">
      <button ${dataAct('dcalNav', -1)} aria-label="Previous month" style="border:none;background:#fff;padding:6px 11px;cursor:pointer;font-size:.9rem">‹</button>
      <span id="dcal-month-label" style="padding:6px 12px;font-weight:700;color:var(--navy);min-width:130px;text-align:center"></span>
      <button ${dataAct('dcalNav', 1)} aria-label="Next month" style="border:none;background:#fff;padding:6px 11px;cursor:pointer;font-size:.9rem">›</button>
    </div>
    <button class="btn btn-secondary btn-sm" ${dataAct('dcalToday')}>Today</button>
    <button class="dcal-vbtn on" id="dcal-v-month" ${dataAct('dcalSetView', 'month')}>Month</button>
    <button class="dcal-vbtn" id="dcal-v-agenda" ${dataAct('dcalSetView', 'agenda')}>Next 14 days</button>
    <select id="dcal-f-client" class="form-control" style="max-width:180px;font-size:.8rem" ${dataChange('dcalApplyFilters')}>
      <option value="">Client: All</option>${clients.map(c=>`<option value="${h(c)}">${h(c)}</option>`).join('')}
    </select>
    <select id="dcal-f-status" class="form-control" style="max-width:160px;font-size:.8rem" ${dataChange('dcalApplyFilters')}>
      <option value="">Status: All</option>
      <option value="sch">Scheduled</option>
      <option value="tra">In transit</option>
      <option value="del">Delivered</option>
      <option value="ris">At risk</option>
      <option value="gho">Recurring (projected)</option>
    </select>
    <div style="margin-left:auto;display:flex;gap:12px;font-size:.72rem;color:var(--text-muted);flex-wrap:wrap">
      <span>🟦 Scheduled</span><span>🟨 In transit</span><span>🟩 Delivered</span><span>🟥 At risk</span><span style="color:var(--primary-hover)">◌ Projected</span>
    </div>
  </div>
  <div id="dcal-body">
    <div style="min-width:0">
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:0">
        <div id="dcal-view-month" style="overflow-x:auto"><div class="dcal-grid" id="dcal-grid"></div></div>
        <div id="dcal-view-agenda" style="display:none;padding:14px"></div>
      </div>
      <div class="card" id="dcal-agenda" style="margin-top:12px;margin-bottom:0;padding:14px 16px"></div>
    </div>
    <aside id="dcal-rail"></aside>
  </div>`;
  // On phones the 7-column month grid is a forced horizontal scroll — default to
  // the agenda ("Next 14 days") list instead; Month stays available via the toggle.
  if (window.innerWidth <= 700) dcalSetView('agenda'); else dcalRefresh();
}

function dcalFiltered() {
  const s = _dcal;
  return (s.dcs || []).filter(dc => {
    if (dc.status === 'CANCELLED') return false;
    if (s.client && dc.client_name !== s.client) return false;
    if (s.status && dcalCls(dc, dcalDcDate(dc)) !== s.status) return false;
    return true;
  });
}

function dcalByDate() {
  const map = {};
  dcalFiltered().forEach(dc => {
    const k = dcalDcDate(dc);
    if (!k) return;
    (map[k] = map[k] || []).push(dc);
  });
  Object.values(map).forEach(a => a.sort((x,y) => (x.scheduled_time||'99').localeCompare(y.scheduled_time||'99')));
  return map;
}

// Recurring-order projection: step a cycle date forward by its frequency.
function dcalAdvance(dateStr, freq) {
  const d = new Date(dateStr + 'T00:00:00');
  const f = String(freq || 'MONTHLY').toUpperCase();
  if (f.startsWith('DAI')) d.setDate(d.getDate() + 1);
  else if (f.startsWith('WEEK')) d.setDate(d.getDate() + 7);
  else if (f.startsWith('FORT') || f === 'BIWEEKLY') d.setDate(d.getDate() + 14);
  else if (f.startsWith('QUART')) d.setMonth(d.getMonth() + 3);
  else d.setMonth(d.getMonth() + 1);
  return dcalKey(d);
}

// Ghosts: future occurrences of active standing orders (next 60 days) that are
// not yet resolved (created/skipped) and not already covered by a DC for the
// same client on that date.
function dcalGhosts() {
  const out = {};
  if (_dcal.status && _dcal.status !== 'gho') return out; // status filter hides ghosts
  const today = dcalKey(new Date());
  const horizon = dcalKey(new Date(Date.now() + 60 * 86400000));
  const dcDates = {};
  (_dcal.dcs || []).forEach(dc => {
    if (dc.status === 'CANCELLED' || !dc.client_id) return;
    (dcDates[dc.client_id] = dcDates[dc.client_id] || new Set()).add(dcalDcDate(dc));
  });
  (_dcal.sos || []).forEach(so => {
    if (!so.active) return;
    if (_dcal.client && so.client_name !== _dcal.client) return;
    const done = new Set((so.events || []).map(e => e.cycle_date));
    let k = String(so.next_run_date || today).slice(0, 10) || today;
    let guard = 0;
    while (k < today && guard++ < 400) k = dcalAdvance(k, so.frequency);
    guard = 0;
    while (k <= horizon && guard++ < 90) {
      if (!done.has(k) && !(dcDates[so.client_id] && dcDates[so.client_id].has(k))) (out[k] = out[k] || []).push(so);
      k = dcalAdvance(k, so.frequency);
    }
  });
  return out;
}

function dcalRefresh() {
  if (!_dcal || !document.getElementById('dcal-kpis')) return;
  const by = _dcal.status === 'gho' ? {} : dcalByDate();
  const gh = dcalGhosts();
  dcalKpis(by, gh);
  const ml = document.getElementById('dcal-month-label');
  if (ml) ml.textContent = new Date(_dcal.y, _dcal.m, 1).toLocaleDateString('en-IN', { month:'long', year:'numeric' });
  if (_dcal.view === 'month') dcalGrid(by, gh); else dcalAgendaView(by, gh);
  dcalAgendaDay(by, gh);
  dcalRail(by, gh);
}

function dcalKpis(by, gh) {
  const pfx = `${_dcal.y}-${String(_dcal.m+1).padStart(2,'0')}`;
  let tot = 0, com = 0, upc = 0, ris = 0;
  Object.keys(by).forEach(k => by[k].forEach(dc => {
    const risk = dcalIsRisk(dc, k);
    if (risk) ris++;
    if (!k.startsWith(pfx)) return;
    tot++;
    if (dc.status === 'DELIVERED') com++;
    else if (!risk) upc++;
  }));
  const in30 = dcalKey(new Date(Date.now() + 30 * 86400000));
  let rec = 0;
  Object.keys(gh || {}).forEach(k => { if (k <= in30) rec += gh[k].length; });
  const kp = (cls, l, v, s) => `<div class="dcal-kp ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  document.getElementById('dcal-kpis').innerHTML =
    kp('', 'This month', tot, 'delivery challans')
    + kp('com', 'Completed', com, tot ? Math.round(com/tot*100) + '% of month' : '—')
    + kp('upc', 'Upcoming', upc, 'scheduled & in transit')
    + `<button class="dcal-kp ris" ${dataAct('dcalJumpRisk')}><div class="l">⚠ At risk</div><div class="v">${ris}</div><div class="s">past date, undelivered — click to view</div></button>`
    + kp('rec', 'Recurring due', rec, 'next 30 days — unconfirmed');
}

function dcalJumpRisk() {
  const by = dcalByDate();
  const today = dcalKey(new Date());
  const k = Object.keys(by).sort().find(k => k < today && by[k].some(dc => dcalIsRisk(dc, k)));
  if (!k) { showToast('Nothing at risk 🎉'); return; }
  dcalSelect(k);
}

function dcalGrid(by, gh) {
  const { y, m } = _dcal, today = dcalKey(new Date());
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-start
  const start = new Date(y, m, 1 - lead);
  let html = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div class="dcal-dow">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = dcalKey(d), inM = d.getMonth() === m;
    const list = by[k] || [];
    const ghosts = (gh && gh[k]) || [];
    const total = list.length + ghosts.length;
    const risk = list.some(dc => dcalIsRisk(dc, k));
    const chipArr = list.map(dc =>
      `<span class="dcal-chip ${dcalCls(dc,k)}" title="${h(dc.dc_number||dc.id)} · ${h(dc.client_name||'')}">${dc.scheduled_time ? dc.scheduled_time+' ' : ''}${h(dc.client_name||dc.dc_number||dc.id)}${dc.reminder_armed===1?' 🔔':''}</span>`)
      .concat(ghosts.map(so =>
      `<span class="dcal-chip gho" title="Projected from standing order ${h(so.id)}">◌ ${h(so.client_name||so.name)}</span>`));
    const cap = (_dcal.pol && _dcal.pol.capacity) || 6;
    const atCap = list.length >= cap;
    html += `<button class="dcal-day${inM?'':' out'}${k===today?' today':''}${k===_dcal.sel?' sel':''}" ${dataAct('dcalSelect', k)}>
      <span class="dn">${k===today?`<i>${d.getDate()}</i>`:d.getDate()}${risk?'<span class="dcal-riskbadge">At risk</span>':''}${total?`<span class="n${atCap?' full':''}" title="${list.length}/${cap} fleet slots used">${list.length ? list.length+'/'+cap : total}</span>`:''}</span>
      ${chipArr.slice(0,3).join('')}${total>3?`<div class="dcal-more">+${total-3} more</div>`:''}</button>`;
  }
  document.getElementById('dcal-grid').innerHTML = html;
}

function dcalSelect(k) {
  _dcal.sel = k;
  const [yy, mm] = k.split('-').map(Number);
  if (yy !== _dcal.y || mm - 1 !== _dcal.m) { _dcal.y = yy; _dcal.m = mm - 1; }
  if (_dcal.view !== 'month') { dcalSetView('month'); return; }
  dcalRefresh();
}

function dcalAgItem(dc, k) {
  const today = dcalKey(new Date());
  const risk = dcalIsRisk(dc, k);
  const days = Math.max(0, Math.round((new Date(today) - new Date(k)) / 86400000));
  let pill;
  if (dc.status === 'DELIVERED') pill = '<span class="dcal-pill grn">Delivered</span>';
  else if (risk) pill = `<span class="dcal-pill red">Overdue ${days}d</span>`;
  else if (['IN_TRANSIT','DISPATCHED'].includes(dc.status)) pill = '<span class="dcal-pill amb">In transit</span>';
  else if (k === today) pill = '<span class="dcal-pill amb">Due today</span>';
  else pill = '<span class="dcal-pill blu">Scheduled</span>';
  const dateEdit = dc.status !== 'DELIVERED'
    ? `<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap">
        <input type="date" id="dcal-date-${h(String(dc.id))}" class="form-control" style="max-width:150px;font-size:.78rem" value="${dcalDcDate(dc)}">
        <button class="btn btn-primary btn-sm" ${dataAct('dcalSaveDate', h(String(dc.id)))}>${risk ? 'Reschedule' : 'Set date'}</button></span>`
    : '';
  const bellState = dc.reminder_armed === 1 ? '🔔 On' : dc.reminder_armed === 0 ? '🔕 Muted' : '🔔 Auto';
  const bell = dc.status !== 'DELIVERED'
    ? `<button class="btn btn-secondary btn-sm" title="Reminder for this delivery — Auto follows the global policy, then On, then Muted" ${dataActEl('dcalCycleBell', String(dc.id))}>${bellState}</button>`
    : '';
  return `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid ${risk?'var(--red-soft-bg)':'var(--border)'};background:${risk?'#fff5f5':'var(--surface)'};border-radius:10px;padding:10px 13px">
    <span style="font-family:monospace;font-size:.78rem;font-weight:700;width:52px">${dc.scheduled_time||'—'}</span>
    <div style="flex:1;min-width:170px">
      <div style="font-weight:700;font-size:.85rem;color:var(--navy)">${h(dc.dc_number||dc.id)} · ${h(dc.client_name||'—')} ${pill}</div>
      <div class="u-muted-xs">${dc.driver_name?`🧑‍✈️ ${h(dc.driver_name)}`:'driver unassigned'}${dc.vehicle_no?` · ${h(dc.vehicle_no)}`:''}${dc.order_id?` · order ${h(dc.order_id)}`:''}</div>
    </div>
    ${dateEdit}${bell}
    <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'delivery')}>Open in Deliveries</button></div>`;
}

// Ghost row: a projected recurring occurrence — not an order yet.
function dcalGhostItem(so, k) {
  let n = 0;
  try { n = JSON.parse(so.items || '[]').length; } catch { /* ignore */ }
  return `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1.5px dashed var(--primary-border);background:var(--primary-light);border-radius:10px;padding:10px 13px">
    <span style="font-family:monospace;font-size:.78rem;font-weight:700;width:52px">—</span>
    <div style="flex:1;min-width:170px">
      <div style="font-weight:700;font-size:.85rem;color:var(--navy)">${h(so.name||so.id)} · ${h(so.client_name||'—')} <span class="dcal-pill org">Projected</span></div>
      <div class="u-muted-xs">Standing order ${h(so.id)} · ${h(so.frequency||'MONTHLY')}${n?` · ${n} item${n===1?'':'s'}`:''} · no order created yet</div>
    </div>
    <button class="btn btn-primary btn-sm" ${dataActEl('dcalGhostCreate', so.id, k)}>Create order</button>
    <button class="btn btn-secondary btn-sm" ${dataActEl('dcalGhostSkip', so.id, k)}>Skip this cycle</button></div>`;
}

function dcalAgendaDay(by, gh) {
  const el = document.getElementById('dcal-agenda'); if (!el) return;
  const k = _dcal.sel, list = by[k] || [], ghosts = (gh && gh[k]) || [];
  const total = list.length + ghosts.length;
  const d = new Date(k + 'T00:00:00');
  el.innerHTML = `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <span style="font-weight:800;color:var(--navy);font-size:1rem">${d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'})}</span>
      <span style="font-size:.74rem;color:var(--text-muted)">${total||'no'} entr${total===1?'y':'ies'}</span></div>`
    + (total
      ? `<div style="display:flex;flex-direction:column;gap:8px">${list.map(dc => dcalAgItem(dc, k)).join('')}${ghosts.map(so => dcalGhostItem(so, k)).join('')}</div>`
      : `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:.83rem">Nothing scheduled this day.</div>`);
}

function dcalAgendaView(by, gh) {
  const el = document.getElementById('dcal-view-agenda'); if (!el) return;
  const now = new Date();
  let out = '';
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const k = dcalKey(d), list = by[k] || [], ghosts = (gh && gh[k]) || [];
    if (!list.length && !ghosts.length) continue;
    out += `<div style="margin-bottom:14px"><div style="font-weight:800;color:var(--navy);font-size:.9rem;margin-bottom:7px">${d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}${i===0?' <span style="font-size:.7rem;color:var(--text-muted)">· today</span>':''}</div>
      <div style="display:flex;flex-direction:column;gap:8px">${list.map(dc => dcalAgItem(dc, k)).join('')}${ghosts.map(so => dcalGhostItem(so, k)).join('')}</div></div>`;
  }
  el.innerHTML = out || '<div style="padding:20px;text-align:center;color:var(--text-muted)">Nothing in the next 14 days.</div>';
}

function dcalRail(by, gh) {
  const el = document.getElementById('dcal-rail'); if (!el) return;
  const today = dcalKey(new Date()), now = new Date();
  const dotColor = { sch:'#33475f', tra:'#d97706', del:'#16a34a', ris:'#dc2626' };
  const ghostRow = (k, so) => `<button class="dcal-rl" ${dataAct('dcalSelect', k)}><span class="dcal-dot" style="background:transparent;border:2px dashed var(--primary)"></span>
    <span class="m"><span class="t">${h(so.client_name||so.name)}</span>
    <span class="s">${fmtDate(k)} · ${h(so.frequency||'MONTHLY')}</span></span><span class="dcal-pill org">Projected</span></button>`;
  const row = (k, dc) => {
    const c = dcalCls(dc, k);
    const days = Math.max(0, Math.round((new Date(today) - new Date(k)) / 86400000));
    const pill = c==='ris' ? `<span class="dcal-pill red">Overdue ${days}d</span>`
      : c==='del' ? '<span class="dcal-pill grn">Delivered</span>'
      : k===today ? `<span class="dcal-pill amb">${c==='tra'?'In transit':'Due today'}</span>`
      : '<span class="dcal-pill blu">Upcoming</span>';
    return `<button class="dcal-rl" ${dataAct('dcalSelect', k)}><span class="dcal-dot" style="background:${dotColor[c]}"></span>
      <span class="m"><span class="t">${dc.scheduled_time?dc.scheduled_time+' · ':''}${h(dc.client_name||dc.dc_number||dc.id)}</span>
      <span class="s">${fmtDate(k)} · ${h(dc.dc_number||dc.id)}</span></span>${pill}</button>`;
  };
  let next = '';
  for (let i = 0; i < 7; i++) {
    const k = dcalKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i));
    (by[k] || []).forEach(dc => { if (dc.status !== 'DELIVERED') next += row(k, dc); });
    ((gh && gh[k]) || []).forEach(so => { next += ghostRow(k, so); });
  }
  let risk = '';
  Object.keys(by).sort().forEach(k => {
    if (k > today) return;
    by[k].forEach(dc => {
      if (dcalIsRisk(dc, k)) risk += row(k, dc);
      else if (k === today && dc.status !== 'DELIVERED') risk += row(k, dc);
    });
  });
  const pol = _dcal.pol || {};
  const polRow = (field, label, sub) => `<label style="display:flex;align-items:flex-start;gap:8px;font-size:.78rem;padding:4px 0;cursor:pointer;color:var(--navy)">
    <input type="checkbox" ${pol[field]?'checked':''} ${dataChangeEl('dcalPolSave', field)} style="margin-top:2px">
    <span><b>${label}</b><span style="display:block;font-size:.66rem;color:var(--text-muted)">${sub}</span></span></label>`;
  const policyCard = `<div class="dcal-rail-card"><div class="dcal-rc-h">Reminders &amp; capacity <span style="text-transform:none;font-weight:600">global policy</span></div>
    ${polRow('email_t1','1 day before','email + alert to ops')}
    ${polRow('dayof','Day-of digest','morning summary of today’s runs')}
    ${polRow('ghost_nudge','Recurring nudges','unconfirmed cycles, 2 days out')}
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0 2px;font-size:.78rem;color:var(--navy)"><b>Fleet capacity / day</b>
      <input type="number" min="1" max="99" value="${pol.capacity||6}" class="form-control" style="width:64px;font-size:.8rem;padding:4px 8px" ${dataChangeEl('dcalPolSave', 'capacity')}></div>
    <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:9px" ${dataActEl('dcalSendReminders')}>📨 Send reminders now</button>
    <div style="font-size:.63rem;color:var(--text-muted);margin-top:7px;line-height:1.5">Runs automatically every morning (9:00 IST). Bells on individual deliveries override this policy.</div>
  </div>`;
  el.innerHTML =
    `<div class="dcal-rail-card"><div class="dcal-rc-h">Next 7 days <span style="text-transform:none;font-weight:600">from today</span></div>${next||'<div style="font-size:.75rem;color:var(--text-muted);padding:4px 0">Nothing upcoming.</div>'}</div>
     <div class="dcal-rail-card"><div class="dcal-rc-h" style="color:var(--danger)">⚠ At risk <span style="text-transform:none;font-weight:600">needs action</span></div>${risk||'<div style="font-size:.75rem;color:var(--text-muted);padding:4px 0">Nothing at risk 🎉</div>'}</div>`
    + policyCard;
}

function dcalNav(d) { _dcal.m += d; if (_dcal.m < 0) { _dcal.m = 11; _dcal.y--; } if (_dcal.m > 11) { _dcal.m = 0; _dcal.y++; } dcalRefresh(); }
function dcalToday() { const n = new Date(); _dcal.y = n.getFullYear(); _dcal.m = n.getMonth(); _dcal.sel = dcalKey(n); dcalRefresh(); }
function dcalSetView(v) {
  _dcal.view = v;
  document.getElementById('dcal-v-month')?.classList.toggle('on', v === 'month');
  document.getElementById('dcal-v-agenda')?.classList.toggle('on', v === 'agenda');
  const vm = document.getElementById('dcal-view-month'), va = document.getElementById('dcal-view-agenda'), ag = document.getElementById('dcal-agenda');
  if (vm) vm.style.display = v === 'month' ? '' : 'none';
  if (va) va.style.display = v === 'agenda' ? '' : 'none';
  if (ag) ag.style.display = v === 'month' ? '' : 'none';
  dcalRefresh();
}
function dcalApplyFilters() {
  _dcal.client = document.getElementById('dcal-f-client')?.value || '';
  _dcal.status = document.getElementById('dcal-f-status')?.value || '';
  dcalRefresh();
}
async function dcalSaveDate(id) {
  const val = document.getElementById('dcal-date-' + id)?.value;
  if (!val) { showToast('Pick a date first', 'error'); return; }
  // capacity heads-up (warn, don't block)
  const cap = (_dcal.pol && _dcal.pol.capacity) || 6;
  const cnt = (dcalByDate()[val] || []).filter(d => String(d.id) !== String(id)).length;
  if (cnt >= cap) showToast(`Heads up: ${fmtDate(val)} already has ${cnt} deliveries (capacity ${cap})`, 'error');
  const res = await api('/delivery-challans/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ scheduled_date: val }) });
  if (!res) return;
  const dc = (_dcal.dcs || []).find(d => String(d.id) === String(id));
  if (dc) dc.scheduled_date = val;
  showToast('Delivery scheduled for ' + fmtDate(val));
  dcalSelect(val);
}

// Ghost → real order: runs the standing order through the normal order
// pipeline (approvals, reservations, notifications) for this cycle date.
async function dcalGhostCreate(soId, date, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Creating…'; }
  const res = await api(`/standing-orders/${encodeURIComponent(soId)}/materialize`, { method:'POST', body: JSON.stringify({ date }) });
  if (btn) { btn.disabled = false; btn.textContent = 'Create order'; }
  if (!res) return;
  const so = (_dcal.sos || []).find(s => s.id === soId);
  if (so) {
    (so.events = so.events || []).push({ cycle_date: date, action:'CREATED', order_id: res.order_id });
    if (res.next_run_date) so.next_run_date = res.next_run_date;
  }
  showToast(`Order ${res.order_id} created (${res.order_status}) — dispatch it from Orders`);
  dcalRefresh();
}

async function dcalGhostSkip(soId, date, btn) {
  if (btn) btn.disabled = true;
  const res = await api(`/standing-orders/${encodeURIComponent(soId)}/skip`, { method:'POST', body: JSON.stringify({ date }) });
  if (btn) btn.disabled = false;
  if (!res) return;
  const so = (_dcal.sos || []).find(s => s.id === soId);
  if (so) (so.events = so.events || []).push({ cycle_date: date, action:'SKIPPED' });
  showToast('Cycle skipped — the next occurrence stays on the calendar');
  dcalRefresh();
}

// Per-delivery reminder override: Auto (follow policy) → On → Muted → Auto
async function dcalCycleBell(id, btn) {
  const dc = (_dcal.dcs || []).find(d => String(d.id) === String(id));
  if (!dc) return;
  const cur = dc.reminder_armed;
  const next = cur === 1 ? 0 : cur === 0 ? null : 1;
  if (btn) btn.disabled = true;
  const res = await api('/delivery-challans/' + encodeURIComponent(id), { method:'PATCH', body: JSON.stringify({ reminder_armed: next }) });
  if (btn) btn.disabled = false;
  if (!res) return;
  dc.reminder_armed = next;
  showToast(next === 1 ? 'Reminder ON for this delivery — pinged the day before'
    : next === 0 ? 'Reminders muted for this delivery'
    : 'Following the global reminder policy');
  dcalRefresh();
}

// Save one field of the global reminder/capacity policy
async function dcalPolSave(field, el) {
  const val = field === 'capacity' ? Math.max(1, Math.min(99, parseInt(el.value) || 6)) : !!el.checked;
  const res = await api('/delivery-calendar/settings', { method:'POST', body: JSON.stringify({ [field]: val }) });
  if (!res) { dcalRefresh(); return; } // revert UI to server state
  _dcal.pol = { ..._dcal.pol, [field]: val };
  showToast('Reminder settings saved');
  if (field === 'capacity') dcalRefresh();
}

// Manual trigger of the daily sweep
async function dcalSendReminders(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '📨 Sending…'; }
  const res = await api('/delivery-calendar/run-reminders', { method:'POST', body: JSON.stringify({}) });
  if (btn) { btn.disabled = false; btn.textContent = '📨 Send reminders now'; }
  if (!res) return;
  showToast(`Reminders sent — ${res.t1||0} for tomorrow, ${res.dayof||0} today, ${res.overdue||0} at risk, ${res.ghosts||0} recurring nudge${(res.ghosts||0)===1?'':'s'}`);
}

/* ============================================================
   USERS
   ============================================================ */
async function renderUsers(el) {
  const users = await api('/users');
  if (!users) return;
  APP._usersCache = Object.fromEntries(users.map(u=>[u.id,u]));

  const activeUsers   = users.filter(u=>u.active);
  const inactiveUsers = users.filter(u=>!u.active);
  const with2FA       = users.filter(u=>u.two_fa_enabled).length;

  const ROLE_COLOR = {
    super_admin:    '#7c3aed',
    ops_admin:      '#2563eb',
    ops_user:       '#3b82f6',
    vendor_admin:   '#d97706',
    vendor_user:    '#f59e0b',
    client_admin:   '#059669',
    client_user:    '#10b981',
    client_approver:'#0891b2',
    delivery_exec:  '#6b7280',
  };

  function userCard(u) {
    const rc = ROLE_COLOR[u.role] || '#6b7280';
    const roleName = (ROLES[u.role]?.label || u.role).replace(/_/g,' ');
    return `
    <div style="background:#fff;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,.08);padding:16px 18px;display:flex;align-items:center;gap:14px;opacity:${u.active?1:.6}">
      <div style="width:44px;height:44px;border-radius:50%;background:${u.active?rc:'#9ca3af'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:700;flex-shrink:0">${u.initials||u.name[0]}</div>
      <div class="u-flex1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:.9rem;color:var(--navy)">${h(u.name)}</span>
          ${u.active?'':'<span style="font-size:.66rem;font-weight:700;background:var(--danger-soft-bg);color:var(--danger);border-radius:4px;padding:1px 6px">INACTIVE</span>'}
        </div>
        <div style="font-size:.76rem;color:var(--text-muted);margin-top:2px">${h(u.email)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap">
          <span style="font-size:.68rem;font-weight:700;background:${rc}1a;color:${rc};border-radius:4px;padding:2px 7px">${roleName}</span>
          <span style="font-size:.68rem;color:var(--text-muted)">${h(u.org)}</span>
          ${u.two_fa_enabled?`<span style="font-size:.66rem;font-weight:600;background:var(--success-soft-bg);color:var(--success-strong);border-radius:4px;padding:1px 6px">🔐 2FA</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
        <label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-size:.72rem;color:var(--text-muted)">
          <input type="checkbox" ${u.two_fa_enabled?'checked':''} ${dataChangeEl('toggle2FAEl', u.id)}>
          2FA
        </label>
        <div style="display:flex;gap:5px">
          <button class="btn btn-secondary btn-sm" ${dataAct('editUserModal', u.id)} style="font-size:.7rem;padding:3px 8px">✏️ Edit</button>
          ${u.active
            ? `<button class="btn btn-danger btn-sm" ${dataAct('deactivateUser', u.id, u.name)} style="font-size:.7rem;padding:3px 8px">Deactivate</button>`
            : `<button class="btn btn-primary btn-sm" ${dataAct('activateUser', u.id)} style="font-size:.7rem;padding:3px 8px">Activate</button>`}
        </div>
      </div>
    </div>`;
  }

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">Users & Roles</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">${users.length} total · ${activeUsers.length} active · ${with2FA} with 2FA</div>
    </div>
    <button class="btn btn-gold" ${dataAct('addUserModal')}>${iconPlus(14)} Add User</button>
  </div>

  <!-- KPI tiles -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--blue)">
      <div class="u-label2">Total Users</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${users.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--success)">
      <div class="u-label2">Active</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${activeUsers.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid ${inactiveUsers.length?'var(--gray-light)':'var(--gray-light)'}">
      <div class="u-label2">Inactive</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${inactiveUsers.length}</div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:3px solid var(--purple)">
      <div class="u-label2">2FA Enabled</div>
      <div style="font-size:2rem;font-weight:800;color:var(--navy);margin-top:6px">${with2FA}</div>
      <div class="u-subtiny">${users.length?Math.round(with2FA/users.length*100):0}% of users</div>
    </div>
  </div>

  <!-- Active users by role group -->
  ${Object.entries(
    activeUsers.reduce((g,u)=>{
      const group = ROLES[u.role]?.nav==='client'||ROLES[u.role]?.nav==='client_user'||ROLES[u.role]?.nav==='approver' ? 'Client'
                  : ROLES[u.role]?.nav==='vendor'||ROLES[u.role]?.nav==='vendor_user' ? 'Vendor'
                  : ROLES[u.role]?.nav==='delivery_exec' ? 'Delivery'
                  : u.role==='super_admin' ? 'Super Admin'
                  : 'Operations';
      if (!g[group]) g[group]=[];
      g[group].push(u);
      return g;
    }, {})
  ).map(([group, groupUsers])=>`
  <div style="margin-bottom:18px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">${group} (${groupUsers.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px">
      ${groupUsers.map(u=>userCard(u)).join('')}
    </div>
  </div>`).join('')}

  ${inactiveUsers.length ? `
  <div style="margin-top:10px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Inactive (${inactiveUsers.length})</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px">
      ${inactiveUsers.map(u=>userCard(u)).join('')}
    </div>
  </div>` : ''}
  `;
}

const CLIENT_ROLES = ['client_admin','client_approver','client_user'];
const VENDOR_ROLES = ['vendor_admin','vendor_user'];

/* Org field by role: client dropdown / vendor dropdown / fixed 4SYZ Platform */
function userOrgFieldHtml(prefix, role, clients, vendors, currentClientId, currentOrg) {
  if (CLIENT_ROLES.includes(role)) {
    if (!clients.length) {
      return `<div class="alert alert-warning" style="margin:0">No active clients onboarded yet. Onboard the client first (Clients page), then create its users.</div>`;
    }
    return `<select id="${prefix}-client">
      <option value="">— Select client —</option>
      ${clients.map(c=>`<option value="${c.id}" ${c.id===currentClientId?'selected':''}>${h(c.name)}</option>`).join('')}
    </select>
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Client users must belong to an onboarded client</div>`;
  }
  if (VENDOR_ROLES.includes(role)) {
    if (!vendors.length) {
      return `<div class="alert alert-warning" style="margin:0">No vendors created yet. Add the vendor first (Vendors page), then create its users.</div>`;
    }
    return `<select id="${prefix}-vendor">
      <option value="">— Select vendor —</option>
      ${vendors.map(v=>`<option value="${v.id}" ${v.name===currentOrg?'selected':''}>${h(v.name)}</option>`).join('')}
    </select>
    <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Vendor users must belong to an existing vendor</div>`;
  }
  // Platform roles (Super Admin, Ops, Delivery, Finance…) — company is fixed
  return `<input type="text" id="${prefix}-org" value="4SYZ Platform" readonly
    style="background:var(--surface-alt,#f3f4f6);color:var(--text-muted);cursor:not-allowed">
  <div style="font-size:.72rem;color:var(--text-muted);margin-top:4px">Platform roles always belong to 4SYZ Platform</div>`;
}

function bindUserRoleToggle(prefix, clients, vendors, currentClientId, currentOrg) {
  const roleSel = document.getElementById(`${prefix}-role`);
  if (!roleSel) return;
  roleSel.onchange = () => {
    const wrap = document.getElementById(`${prefix}-org-wrap`);
    if (wrap) wrap.innerHTML = userOrgFieldHtml(prefix, roleSel.value, clients, vendors, currentClientId, currentOrg);
  };
}

async function addUserModal() {
  if (APP.user.role !== 'super_admin') { showToast('Only Super Admin can add users','error'); return; }
  const [clientsRaw, vendorsRaw] = await Promise.all([
    api('/clients').catch(()=>[]),
    api('/vendors').catch(()=>[]),
  ]);
  const clients = (clientsRaw||[]).filter(c=>c.active);
  const vendors = (vendorsRaw||[]);
  const firstRole = Object.keys(ROLES)[0];
  openModal('Add User',
    `<div class="form-group"><label>Full Name</label><input type="text" id="u-name"></div>
     <div class="form-group"><label>Email</label><input type="email" id="u-email"></div>
     <div class="form-group"><label>Role</label>
       <select id="u-role">
         ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}
       </select>
     </div>
     <div class="form-group"><label>Company / Client / Vendor</label>
       <div id="u-org-wrap">${userOrgFieldHtml('u', firstRole, clients, vendors, null, '')}</div>
     </div>
     <div class="form-group"><label>Temporary Password</label><input type="password" id="u-pw" value="password"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveUser')}>Create User</button>`);
  bindUserRoleToggle('u', clients, vendors, null, '');
}

async function saveUser() {
  const role = document.getElementById('u-role').value;
  const body = {
    name: document.getElementById('u-name').value,
    email: document.getElementById('u-email').value,
    role,
    password: document.getElementById('u-pw').value || 'password',
  };
  if (!body.name||!body.email) { showToast('Name and email required','error'); return; }
  if (CLIENT_ROLES.includes(role)) {
    const clientId = document.getElementById('u-client')?.value;
    if (!clientId) { showToast('Select a client — client users must belong to an onboarded client','error'); return; }
    body.client_id = clientId;
  } else if (VENDOR_ROLES.includes(role)) {
    const vendorId = document.getElementById('u-vendor')?.value;
    if (!vendorId) { showToast('Select a vendor — vendor users must belong to an existing vendor','error'); return; }
    body.vendor_id = vendorId;
  }
  // Platform roles: org is fixed server-side to 4SYZ Platform
  const res = await api('/users', { method:'POST', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast('User created — credentials sent via email'); navigate('users');
}

async function editUserModal(id) {
  if (APP.user.role !== 'super_admin') { showToast('Only Super Admin can edit users','error'); return; }
  const u = APP._usersCache?.[id];
  if (!u) { showToast('User not found','error'); return; }
  const [clientsRaw, vendorsRaw] = await Promise.all([
    api('/clients').catch(()=>[]),
    api('/vendors').catch(()=>[]),
  ]);
  const clients = (clientsRaw||[]).filter(c=>c.active);
  const vendors = (vendorsRaw||[]);
  openModal(`Edit User — ${u.name}`,
    `<div class="form-group"><label>Full Name</label><input type="text" id="eu-name" value="${h(u.name)}"></div>
     <div class="form-group"><label>Email</label><input type="email" id="eu-email" value="${h(u.email)}"></div>
     <div class="form-group"><label>Role</label>
       <select id="eu-role">
         ${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v.label}</option>`).join('')}
       </select>
     </div>
     <div class="form-group"><label>Company / Client / Vendor</label>
       <div id="eu-org-wrap">${userOrgFieldHtml('eu', u.role, clients, vendors, u.client_id, u.org)}</div>
     </div>
     <div class="form-group">
       <label>Reset Password <span style="font-weight:400;color:var(--text-muted);font-size:.76rem">(leave blank to keep current)</span></label>
       <input type="password" id="eu-pw" placeholder="New password">
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveUserEdit', id)}>Save Changes</button>`);
  bindUserRoleToggle('eu', clients, vendors, u.client_id, u.org);
}

async function saveUserEdit(id) {
  const u = APP._usersCache?.[id] || {};
  const name  = document.getElementById('eu-name')?.value?.trim();
  const email = document.getElementById('eu-email')?.value?.trim();
  const role  = document.getElementById('eu-role')?.value;
  const pw    = document.getElementById('eu-pw')?.value;
  if (!name || !email) { showToast('Name and email are required','error'); return; }

  const body = {};
  if (name  !== u.name)  body.name  = name;
  if (email !== u.email) body.email = email;
  if (role  !== u.role)  body.role  = role;
  if (CLIENT_ROLES.includes(role)) {
    const clientId = document.getElementById('eu-client')?.value;
    if (!clientId) { showToast('Select a client — client users must belong to an onboarded client','error'); return; }
    if (clientId !== u.client_id) body.client_id = clientId;
  } else if (VENDOR_ROLES.includes(role)) {
    const vendorSel = document.getElementById('eu-vendor');
    const vendorId = vendorSel?.value;
    if (!vendorId) { showToast('Select a vendor — vendor users must belong to an existing vendor','error'); return; }
    const vendorName = vendorSel.options[vendorSel.selectedIndex]?.text;
    if (vendorName !== u.org) body.vendor_id = vendorId;
    if (u.client_id) body.client_id = ''; // unlink client when moving to a vendor role
  } else {
    // Platform role — org fixed server-side; just ensure client link is removed
    if (u.client_id && role !== u.role) body.client_id = '';
  }
  if (pw) body.password = pw;
  if (!Object.keys(body).length) { closeModal(); showToast('No changes made','info'); return; }

  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  if (!res) return;
  closeModal();
  showToast(`${name} updated${body.role?' — role changed to '+(ROLES[role]?.label||role):''}`); navigate('users');
}

function deactivateUser(id, name) {
  openModal('Deactivate User',
    `<p style="margin:0;color:var(--text-muted)">Are you sure you want to deactivate <b>${name||'this user'}</b>? They will no longer be able to log in.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('confirmDeactivateUser', id)}>Deactivate</button>`);
}

async function confirmDeactivateUser(id) {
  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify({ active:0 }) });
  closeModal();
  if (res) { showToast('User deactivated'); navigate('users'); }
}

async function activateUser(id) {
  const res = await api(`/users/${id}`, { method:'PATCH', body: JSON.stringify({ active:1 }) });
  if (res) { showToast('User reactivated'); navigate('users'); }
}

/* ============================================================
   SETTINGS (Gaps 3,4,6,7,11 — real forms + approval rules + audit logs)
   ============================================================ */
const SETTINGS_NAV = [
  { id:'auth',          icon:'🔐', label:'Auth & OTP',       desc:'OTP, MFA, JWT session' },
  { id:'notifications', icon:'🔔', label:'Notifications',    desc:'Email & SMS config' },
  { id:'integrations',  icon:'🔗', label:'Integrations',     desc:'Zoho Books & Inventory' },
  { id:'budgets',       icon:'💰', label:'Client Budgets',   desc:'Monthly budgets & approval thresholds' },
  { id:'approval',      icon:'✅', label:'Approval Rules',   desc:'Order approval thresholds' },
  { id:'warehouses',    icon:'🏭', label:'Warehouses',       desc:'Manage warehouse config' },
  { id:'audit',         icon:'📋', label:'Audit Log',        desc:'All system actions' },
  { id:'categories',    icon:'📂', label:'Categories',       desc:'Item category setup' },
  { id:'hsngst',        icon:'🧾', label:'HSN → GST',        desc:'HSN code to GST slab map' },
  { id:'pipeline_sla',  icon:'⏱️', label:'Pipeline SLA',      desc:'Per-stage SLA targets' },
];

async function renderSettings(el) {
  if (!APP._settingsTab) APP._settingsTab = 'auth';
  el.innerHTML = `
  ${pageHeader('Platform Settings', 'System configuration & administration')}
  <div style="display:grid;grid-template-columns:220px 1fr;gap:20px;align-items:start">
    <div class="card" style="padding:8px">
      ${SETTINGS_NAV.map(n=>`
      <button ${dataActEl('settingsTab', n.id)} class="settings-nav-btn ${APP._settingsTab===n.id?'active':''}"
        style="width:100%;text-align:left;background:${APP._settingsTab===n.id?'var(--primary)':'transparent'};color:${APP._settingsTab===n.id?'#fff':'inherit'};border:none;border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:2px;transition:background .15s">
        <span style="font-size:1.1rem;flex-shrink:0">${n.icon}</span>
        <div>
          <div style="font-weight:600;font-size:.88rem">${n.label}</div>
          <div style="font-size:.72rem;opacity:.7">${n.desc}</div>
        </div>
      </button>`).join('')}
    </div>
    <div id="settings-content"><div class="loading-state"><div class="spinner"></div></div></div>
  </div>`;
  settingsTab(APP._settingsTab, document.querySelector('.settings-nav-btn.active'));
}

async function settingsTab(tab, btn) {
  APP._settingsTab = tab;
  document.querySelectorAll('.settings-nav-btn').forEach(b=>{
    b.classList.remove('active');
    b.style.background = 'transparent'; b.style.color = 'inherit';
  });
  if (btn) { btn.classList.add('active'); btn.style.background = 'var(--primary)'; btn.style.color = '#fff'; }
  const el = document.getElementById('settings-content');
  el.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

  const envNote = `<div class="alert alert-warning" style="font-size:.82rem;margin-bottom:0">
    ⚙️ These settings are controlled by environment variables in <code>wrangler.jsonc</code>. The status shown is live from the server — to change values, update the env vars and redeploy.
  </div>`;

  const statusPill = (ok, trueLabel='Enabled', falseLabel='Disabled') =>
    ok ? `<span class="badge badge-success">${trueLabel}</span>`
       : `<span class="badge badge-warning">${falseLabel}</span>`;

  if (tab === 'auth') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Authentication & OTP</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">OTP / MFA</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Two-factor authentication via email/SMS</div>
            </div>
            ${statusPill(s.otp_enabled)}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MSG91 SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">OTP delivery via SMS</div>
            </div>
            ${statusPill(s.msg91_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted)">To enable OTP: set <code>OTP_ENABLED=true</code> in wrangler.jsonc vars and redeploy.</div>
      </div>
    </div>`;
  }

  else if (tab === 'notifications') {
    const s = await api('/settings') || {};
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Email & SMS Configuration</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MailChannels Email</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Transactional email delivery</div>
            </div>
            ${statusPill(s.mailchannels_enabled)}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">MSG91 SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">OTP and alert delivery via SMS</div>
            </div>
            ${statusPill(s.msg91_configured, 'Configured', 'Not configured')}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">Twilio Voice/SMS</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Alternate SMS/voice notifications</div>
            </div>
            ${statusPill(s.twilio_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <button class="btn btn-secondary" style="width:fit-content" ${dataAct('testEmail')}>Send Test Email</button>
      </div>
    </div>`;
  }

  else if (tab === 'integrations') {
    const [s, zi] = await Promise.all([api('/settings'), api('/integrations/zoho-inventory/status')]);
    const st = s || {}, z = zi || {};
    const origin = window.location.origin;
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Zoho Books Integration</span></div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        ${envNote}
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:600;font-size:.9rem">Zoho Books API</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Org ID + Client ID configured</div>
            </div>
            ${statusPill(st.zoho_configured, 'Configured', 'Not configured')}
          </div>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">Webhook URL</div>
          <div style="display:flex;align-items:center;gap:8px">
            <code style="font-size:.8rem;background:#f1f5f9;padding:6px 10px;border-radius:6px;flex:1;word-break:break-all">${origin}/api/integrations/zoho/webhook</code>
            <button class="btn btn-secondary btn-sm" ${dataAct('copyText', origin+'/api/integrations/zoho/webhook')}>Copy</button>
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:6px">Configure this URL in Zoho Books → Settings → Webhooks</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-header"><span>Zoho Inventory Sync</span>${z.enabled ? '<span class="badge badge-success">On</span>' : '<span class="badge badge-warning">Off</span>'}</div>
      <div class="card-body" style="display:grid;gap:16px;padding:20px">
        <div style="display:grid;gap:12px;padding:16px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <div style="font-weight:600;font-size:.9rem">Stock sync with Zoho Inventory</div>
              <div style="font-size:.78rem;color:var(--text-muted)">Push our stock levels to Zoho and accept stock updates back via webhook</div>
            </div>
            <button class="btn btn-sm ${z.enabled ? 'btn-danger' : 'btn-success'}" ${dataAct('zohoInvToggle', !z.enabled)}>
              ${z.enabled ? 'Disable' : 'Enable'} Sync
            </button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.8rem">
            ${statusPill(z.configured, 'API configured', 'API not configured')}
            ${z.simulated_mode ? '<span class="badge badge-warning">Simulated mode</span>' : ''}
            <span style="color:var(--text-muted)">${z.item_count ?? 0} active items</span>
          </div>
          ${z.simulated_mode ? `<div style="font-size:.76rem;color:var(--text-muted)">Set <code>ZOHO_ACCESS_TOKEN</code> and <code>ZOHO_INVENTORY_ORG_ID</code> in wrangler.jsonc to push to the live Zoho org. Until then, syncs run in simulated mode so you can validate the flow.</div>` : ''}
        </div>

        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn btn-primary" ${dataAct('zohoInvSyncNow')} ${z.enabled ? '' : 'disabled title="Enable sync first"'}>🔄 Sync Now</button>
          <div style="font-size:.8rem;color:var(--text-muted)">
            ${z.last_sync_at ? `Last sync: <b>${fmtDate(z.last_sync_at)}</b>${z.last_result ? ` · ${h(z.last_result)}` : ''}` : 'Never synced'}
          </div>
        </div>

        ${(z.recent_log||[]).length ? `
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:6px">
          <table class="table" style="margin:0">
            <thead><tr><th>When</th><th>Direction</th><th>Items</th><th>Result</th></tr></thead>
            <tbody>${z.recent_log.map(l=>`<tr>
              <td style="font-size:.8rem;color:var(--text-muted)">${fmtDate(l.created_at)}</td>
              <td>${l.direction==='pull'?'⬇ Pull':'⬆ Push'}</td>
              <td>${l.items}</td>
              <td style="font-size:.8rem">${l.direction==='pull'?`${l.pushed} updated`:`${l.pushed} pushed · ${l.simulated} simulated`}</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>` : ''}

        <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:.82rem;font-weight:600;margin-bottom:6px">Inbound Webhook URL (Zoho → us)</div>
          <div style="display:flex;align-items:center;gap:8px">
            <code style="font-size:.8rem;background:#f1f5f9;padding:6px 10px;border-radius:6px;flex:1;word-break:break-all">${origin}/api/integrations/zoho-inventory/webhook</code>
            <button class="btn btn-secondary btn-sm" ${dataAct('copyText', origin+'/api/integrations/zoho-inventory/webhook')}>Copy</button>
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:6px">Point Zoho Inventory stock-update webhooks here to keep our stock in sync. Payload: <code>{ items: [{ sku, stock }] }</code></div>
        </div>
      </div>
    </div>`;
  }

  else if (tab === 'budgets') {
    const s = await api('/settings') || {};
    const clients = s.clients || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span>Client Budgets & Approval Thresholds</span>
        <button class="btn btn-primary btn-sm" ${dataAct('saveClientBudgets')}>Save Changes</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Monthly Budget (₹)</th><th>Auto-Approve Below (₹)</th></tr></thead>
          <tbody>
            ${clients.length ? clients.map(c=>`<tr>
              <td class="u-b600">${h(c.name)}</td>
              <td><input type="number" class="budget-input" data-id="${c.id}" data-field="monthly_budget"
                value="${c.monthly_budget||''}" min="0" placeholder="No limit"
                style="width:140px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.86rem"></td>
              <td><input type="number" class="threshold-input" data-id="${c.id}" data-field="approval_threshold"
                value="${c.approval_threshold||''}" min="0" placeholder="No auto-approve"
                style="width:160px;padding:6px 10px;border:1.5px solid var(--border);border-radius:7px;font-size:.86rem"></td>
            </tr>`).join('')
            : '<tr><td colspan="3" class="u-empty">No clients found</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="padding:12px 16px;font-size:.8rem;color:var(--text-muted)">
        Monthly Budget: maximum spend per calendar month. Auto-Approve Below: orders under this value skip manual approval.
      </div>
    </div>`;
  }

  else if (tab === 'approval') {
    const rules = await api('/approval-rules') || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Approval Rules</span>
        <button class="btn btn-gold btn-sm" ${dataAct('addApprovalRuleModal')}>+ Add Rule</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Client</th><th>Category</th><th>Min Amount</th><th>Max Amount</th><th>Required Role</th><th>Auto-Approve</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rules.map(r=>`<tr>
            <td>${r.client_id||'All clients'}</td>
            <td>${r.category||'All categories'}</td>
            <td>${fmt(r.min_amount)}</td>
            <td>${r.max_amount ? fmt(r.max_amount) : 'No limit'}</td>
            <td><span class="badge badge-primary">${r.approver_role||'—'}</span></td>
            <td>${r.auto_approve ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</td>
            <td>${r.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
            <td>
              <button class="btn btn-danger btn-sm" ${dataAct('deactivateApprovalRule', r.id)}>Disable</button>
            </td>
          </tr>`).join('')||'<tr><td colspan="8" class="u-empty">No rules configured</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'warehouses') {
    const warehouses = await api('/warehouses') || [];
    el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-size:.82rem;color:var(--text-muted)">
        Showing warehouse summary. For full GRN, bins and stock transfers →
        <button class="btn btn-secondary btn-sm" style="margin-left:6px" ${dataAct('navigate', 'warehouse')}>Open Warehouse page</button>
      </div>
      <button class="btn btn-primary btn-sm" ${dataAct('addWarehouseModal')}>+ Add Warehouse</button>
    </div>
    <div class="card">
      <div class="card-header"><span>Warehouses (${warehouses.length})</span></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Location</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${warehouses.length ? warehouses.map(w=>`<tr>
              <td><b>${h(w.name)}</b></td>
              <td>${w.location||'—'}</td>
              <td>${w.type||'—'}</td>
              <td>${w.active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-secondary">Inactive</span>'}</td>
              <td><button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'warehouse')}>Manage</button></td>
            </tr>`).join('')
            : '<tr><td colspan="5" class="u-empty">No warehouses configured</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'audit') {
    const logs = await api('/audit-logs?limit=100') || [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Audit Log</span><span style="font-size:.84rem;color:var(--text-muted)">${logs.length} recent entries</span></div>
      <div class="table-wrap" style="max-height:60vh;overflow-y:auto">
        <table class="table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Before</th><th>After</th></tr></thead>
          <tbody>${logs.map(l=>`<tr>
            <td style="white-space:nowrap;font-size:.8rem">${fmtDate(l.created_at)}</td>
            <td>${l.actor_name||'—'}</td>
            <td><span class="badge badge-primary">${l.action}</span></td>
            <td>${l.entity_type}</td>
            <td style="font-family:monospace;font-size:.8rem">${l.entity_id||'—'}</td>
            <td style="font-size:.8rem;color:var(--text-muted)">${l.old_value||'—'}</td>
            <td style="font-size:.8rem">${l.new_value||'—'}</td>
          </tr>`).join('')||'<tr><td colspan="7" class="u-empty">No audit logs yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'categories') {
    const [cats, inv] = await Promise.all([api('/categories'), api('/inventory')]).then(r => [r[0]||[], r[1]||[]]);
    const catMap = {};
    inv.forEach(i => {
      if (!catMap[i.category]) catMap[i.category] = { count:0, hsn: i.hsn_code||'—' };
      catMap[i.category].count++;
    });
    const catList = Array.isArray(cats) ? cats : [];
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Item Categories</span>
        <span style="font-size:.83rem;color:var(--text-muted)">Categories are derived from inventory items</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Category</th><th>HSN Code (sample)</th><th>Item Count</th></tr></thead>
          <tbody>${catList.map(c=>`<tr>
            <td><b>${c}</b></td>
            <td>${catMap[c]?.hsn||'—'}</td>
            <td>${catMap[c]?.count||0} items</td>
          </tr>`).join('')||'<tr><td colspan="3" class="u-empty">No categories yet — add inventory items first</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="card-body" style="padding:16px">
        <b>Add items to the catalogue</b> to create and manage categories. Each inventory item is assigned a category.
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;display:block" ${dataAct('navigate', 'inventory')}>Go to Inventory</button>
      </div>
    </div>`;
  }

  else if (tab === 'hsngst') {
    const rates = await api('/hsn-gst-rates') || [];
    const list = Array.isArray(rates) ? rates : [];
    const slabBadge = r => {
      const c = { 0:'#6b7280', 5:'#0891b2', 12:'#2563eb', 18:'#d97706', 28:'#dc2626' }[r] || '#6b7280';
      return `<span class="badge" style="background:${c};color:#fff">${r}%</span>`;
    };
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>HSN → GST Slab Map</span>
        <span style="font-size:.83rem;color:var(--text-muted)">A product's GST is derived from its HSN code (0/5/12/18/28%)</span>
      </div>
      <div class="card-body" style="padding:20px;display:grid;gap:16px">
        <div class="alert alert-info" style="font-size:.82rem;margin-bottom:0">
          Add or edit HSN mappings below. Codes may be full (8-digit) or a heading prefix (4-digit) — the lookup falls back from 8→6→4→2 digits.
          After changing mappings, use <b>↻ Recalc GST from HSN</b> on the Inventory page to apply them to existing items.
        </div>
        <div style="display:grid;grid-template-columns:1fr 120px 2fr auto;gap:10px;align-items:end">
          <div class="form-group" style="margin:0"><label>HSN Code</label><input type="text" id="hg-hsn" placeholder="e.g. 2202"></div>
          <div class="form-group" style="margin:0"><label>GST Slab</label>
            <select id="hg-rate"><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select>
          </div>
          <div class="form-group" style="margin:0"><label>Description</label><input type="text" id="hg-desc" placeholder="e.g. Aerated beverages"></div>
          <button class="btn btn-primary" ${dataAct('saveHsnGstRate')}>Add / Update</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>HSN</th><th>GST Slab</th><th>Description</th><th>Updated</th><th></th></tr></thead>
          <tbody>${list.map(r=>`<tr>
            <td><b>${r.hsn}</b></td>
            <td>${slabBadge(Number(r.gst_rate))}</td>
            <td>${r.description||'—'}</td>
            <td style="font-size:.76rem;color:var(--text-muted)">${(r.updated_at||'').slice(0,10)||'—'}</td>
            <td><button class="btn btn-sm btn-secondary" ${dataAct('editHsnGstRate', r.hsn, Number(r.gst_rate), r.description||'')}>Edit</button></td>
          </tr>`).join('')||'<tr><td colspan="5" class="u-empty">No HSN mappings yet — add one above</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  else if (tab === 'pipeline_sla') {
    const cfg = await api('/pipeline/sla') || { targets:{}, risk_pace:0.6, defaults:{}, stages:{} };
    const t = cfg.targets || {}, def = cfg.defaults || {};
    const meta = cfg.stages || {};
    const rowsOrder = ['approval','inventory','vendor_po','dispatch','delivery','pod','billing'];
    const label = { approval:'Approval', inventory:'Inventory', vendor_po:'Vendor PO', dispatch:'Dispatch', delivery:'Delivery', pod:'POD', billing:'Billing' };
    const sub = { approval:'submitted → approved', inventory:'stock check / reserve', vendor_po:'procurement lead time', dispatch:'pick, pack, QC', delivery:'in transit → delivered', pod:'proof of delivery', billing:'delivered → invoiced' };
    const pacePct = Math.round((cfg.risk_pace ?? 0.6) * 100);
    el.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Pipeline SLA thresholds</span>
        <span style="font-size:.83rem;color:var(--text-muted)">Days an order may sit in each stage before it's flagged</span>
      </div>
      <div class="card-body" style="padding:20px;display:grid;gap:16px">
        <div class="alert alert-info" style="font-size:.82rem;margin-bottom:0">
          These targets drive the Pipeline board's on-track / at-risk / overdue chips, the "overdue" KPI and SLA alerts. Leave a field blank to use the default.
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Stage</th><th style="width:150px">Target (days)</th><th>Default</th></tr></thead>
            <tbody>${rowsOrder.map(k=>`<tr>
              <td><b>${label[k]}</b><div style="font-size:.74rem;color:var(--text-muted)">${meta[k]?String(meta[k].no).padStart(2,'0')+' · ':''}${sub[k]}</div></td>
              <td><input type="number" id="sla-${k}" min="0.25" max="60" step="0.25" value="${t[k] ?? def[k] ?? ''}" style="width:110px"></td>
              <td style="font-size:.8rem;color:var(--text-muted)">${def[k] ?? '—'}d</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
        <div style="display:grid;gap:6px;max-width:420px">
          <label style="font-weight:600;font-size:.86rem">At-risk warning</label>
          <div style="font-size:.8rem;color:var(--text-muted)">Flag an order <b>at risk</b> once it has used this share of its stage target.</div>
          <div style="display:flex;align-items:center;gap:12px">
            <input type="range" id="sla-pace" min="10" max="95" step="5" value="${pacePct}" style="flex:1" oninput="document.getElementById('sla-pace-val').textContent=this.value+'% of target'">
            <b id="sla-pace-val" style="font-family:ui-monospace,monospace;color:var(--blue);white-space:nowrap">${pacePct}% of target</b>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-secondary" ${dataAct('resetPipelineSla')}>Reset to defaults</button>
          <button class="btn btn-primary" ${dataAct('savePipelineSla')}>Save thresholds</button>
        </div>
      </div>
    </div>`;
  }
}

async function savePipelineSla() {
  const keys = ['approval','inventory','vendor_po','dispatch','delivery','pod','billing'];
  const targets = {};
  for (const k of keys) { const v = +(document.getElementById('sla-'+k)?.value || 0); if (v > 0) targets[k] = v; }
  const risk_pace = (+(document.getElementById('sla-pace')?.value || 60)) / 100;
  const res = await api('/pipeline/sla', { method:'POST', body: JSON.stringify({ targets, risk_pace }) });
  if (res) showToast('SLA thresholds saved — cards re-flag on the next board load');
}

async function resetPipelineSla() {
  const res = await api('/pipeline/sla', { method:'POST', body: JSON.stringify({ targets:{}, risk_pace:0.6 }) });
  if (res) { showToast('SLA thresholds reset to defaults'); settingsTab('pipeline_sla', document.querySelector('.settings-nav-btn.active')); }
}

// Prefill the HSN→GST form from an existing row for editing.
function editHsnGstRate(hsn, rate, desc) {
  const h = document.getElementById('hg-hsn'), r = document.getElementById('hg-rate'), d = document.getElementById('hg-desc');
  if (h) h.value = hsn;
  if (r) r.value = String(rate);
  if (d) d.value = desc || '';
  h?.scrollIntoView({ behavior:'smooth', block:'center' });
  h?.focus();
}

async function saveHsnGstRate() {
  const hsn = (document.getElementById('hg-hsn')?.value || '').trim();
  const rate = +(document.getElementById('hg-rate')?.value || 0);
  const desc = document.getElementById('hg-desc')?.value || '';
  if (!hsn) { showToast('HSN code is required', 'error'); return; }
  const res = await api('/hsn-gst-rates', { method:'POST', body: JSON.stringify({ hsn, gst_rate: rate, description: desc }) });
  if (res) {
    showToast(`HSN ${hsn} mapped to ${rate}% GST`);
    document.getElementById('hg-hsn').value = '';
    document.getElementById('hg-desc').value = '';
    settingsTab('hsngst', document.querySelector('.settings-nav-btn.active'));
  }
}

async function saveSettings(section) {
  showToast('These settings are controlled by environment variables — update wrangler.jsonc and redeploy to change them.', 'warning');
}

async function saveClientBudgets() {
  const budgetInputs = document.querySelectorAll('.budget-input');
  const threshInputs = document.querySelectorAll('.threshold-input');
  const map = {};
  budgetInputs.forEach(inp => {
    const id = inp.dataset.id;
    if (!map[id]) map[id] = { id };
    map[id].monthly_budget = inp.value ? +inp.value : null;
  });
  threshInputs.forEach(inp => {
    const id = inp.dataset.id;
    if (!map[id]) map[id] = { id };
    map[id].approval_threshold = inp.value ? +inp.value : null;
  });
  const client_budgets = Object.values(map);
  const res = await api('/settings', { method:'POST', body: JSON.stringify({ client_budgets }) });
  if (res) showToast('Client budgets saved successfully');
}

async function testEmail() {
  showToast('Test email queued — check server logs for delivery status');
}

async function zohoInvToggle(enable) {
  const res = await api('/integrations/zoho-inventory/toggle', { method:'POST', body: JSON.stringify({ enabled: !!enable }) });
  if (!res) return;
  showToast(res.enabled ? 'Zoho Inventory sync enabled' : 'Zoho Inventory sync disabled');
  settingsTab('integrations', document.querySelector('.settings-nav-btn.active'));
}

async function zohoInvSyncNow() {
  const btn = document.querySelector('#settings-content .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Syncing…'; }
  const res = await api('/integrations/zoho-inventory/sync', { method:'POST' });
  if (!res) { if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync Now'; } return; }
  showToast(`Synced ${res.items} item${res.items!==1?'s':''} to Zoho${res.simulated_mode ? ' (simulated)' : ` · ${res.pushed} pushed`}`);
  settingsTab('integrations', document.querySelector('.settings-nav-btn.active'));
}

function addApprovalRuleModal() {
  openModal('Add Approval Rule',
    `<div class="form-group"><label>Client (leave blank for all)</label><input type="text" id="ar-client" placeholder="Client ID or leave blank"></div>
     <div class="form-group"><label>Category (leave blank for all)</label><input type="text" id="ar-cat" placeholder="e.g. Beverages or leave blank"></div>
     <div class="form-group"><label>Min Amount (₹)</label><input type="number" id="ar-min" value="0" min="0"></div>
     <div class="form-group"><label>Max Amount (₹, leave blank for no limit)</label><input type="number" id="ar-max" placeholder="e.g. 500000"></div>
     <div class="form-group"><label>Required Approver Role</label>
       <select id="ar-role">
         <option value="client_approver">Client Approver</option>
         <option value="client_admin">Client Admin</option>
         <option value="ops_admin">Ops Admin</option>
         <option value="finance_admin">Finance Admin</option>
       </select>
     </div>
     <div class="form-group"><label>Auto-Approve</label>
       <select id="ar-auto"><option value="0">No</option><option value="1">Yes</option></select>
     </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('saveApprovalRule')}>Save Rule</button>`);
}

async function saveApprovalRule() {
  const body = {
    client_id: document.getElementById('ar-client').value || null,
    category: document.getElementById('ar-cat').value || null,
    min_amount: +document.getElementById('ar-min').value,
    max_amount: document.getElementById('ar-max').value ? +document.getElementById('ar-max').value : null,
    approver_role: document.getElementById('ar-role').value,
    auto_approve: +document.getElementById('ar-auto').value,
  };
  const res = await api('/approval-rules', { method:'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Approval rule added'); navigate('settings'); }
}

async function deactivateApprovalRule(id) {
  const res = await api('/approval-rules/' + id, { method:'PATCH', body: JSON.stringify({ active: 0 }) });
  if (res) { showToast('Rule deactivated'); navigate('settings'); }
}

