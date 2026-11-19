/* ============================================================
   RECURRING ORDERS (client + ops)
   Plans → scheduled occurrences → generated orders. Three tabs:
   Plans · Delivery calendar · Scheduled deliveries. A plan generates
   a DRAFT order by default (editable via the edit-draft flow) or
   auto-submits where permitted. Backed by /api/recurring-* .
   ============================================================ */
const REC_WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const REC_STATUS_COLOR = {
  'Active': 'var(--success)', 'Paused': 'var(--text-muted)',
  'Planned': 'var(--navy)', 'Overdue': 'var(--danger)', 'Skipped': '#6941c6',
  'Draft generated': 'var(--blue,#2858d7)', 'Submitted': 'var(--amber-text,#996100)',
  'Pending approval': 'var(--amber-text,#996100)', 'Approved': 'var(--success)',
  'Delivered': 'var(--success)', 'Cancelled': 'var(--danger)', 'Generated': 'var(--navy)',
};
function recIsClient() { return ['client_admin', 'client_approver', 'client_user'].includes(APP.user?.role || ''); }
function recBadge(s) {
  const c = REC_STATUS_COLOR[s] || 'var(--text-muted)';
  return `<span class="badge" style="color:${c};border:1px solid ${c};background:transparent;font-weight:700">${h(s)}</span>`;
}

async function renderRecurring(el) {
  el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:48px"><span class="u-muted">Loading recurring orders…</span></div>`;
  const [plans, occ] = await Promise.all([
    api('/recurring-plans').catch(() => []),
    api('/recurring-occurrences').catch(() => []),
  ]);
  APP._recPlans = plans || [];
  APP._recOcc = occ || [];
  if (!APP._recTab) APP._recTab = 'plans';
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const activeN = APP._recPlans.filter(p => p.status === 'Active').length;
  const pausedN = APP._recPlans.filter(p => p.status === 'Paused').length;
  const upcoming7 = APP._recOcc.filter(o => o.date >= today && o.date <= in7 && o.status !== 'Skipped').length;
  const attention = APP._recOcc.filter(o => o.status === 'Overdue' || o.status === 'Draft generated' || o.status === 'Pending approval').length;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px">
      <div>
        <div style="font-size:1.3rem;font-weight:800;color:var(--navy)">Recurring Orders</div>
        <div style="font-size:.84rem;color:var(--text-muted);margin-top:2px">Plan repeat pantry requirements and track each scheduled delivery.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-gold" ${dataAct('recOpenCreate')}>＋ Create recurring plan</button>
      </div>
    </div>

    <div class="rec-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px">
      ${recTile('Active plans', activeN, 'Currently generating orders')}
      ${recTile('Upcoming deliveries', upcoming7, 'Next 7 days')}
      ${recTile('Awaiting action', attention, 'Drafts, approvals or overdue', attention > 0 ? 'var(--danger)' : null)}
      ${recTile('Paused plans', pausedN, 'Resume any time')}
    </div>

    <div class="tab-pills" style="margin-bottom:16px">
      ${recTabBtn('plans', 'Plans')}
      ${recTabBtn('calendar', 'Delivery calendar')}
      ${recTabBtn('occ', 'Scheduled deliveries')}
    </div>
    <div id="rec-body"></div>`;
  recRenderBody();
}

function recTile(label, value, sub, accent) {
  return `<div class="card" style="padding:15px 16px;margin:0">
    <div style="font-size:.78rem;color:var(--text-muted)">${h(label)}</div>
    <div style="font-size:1.7rem;font-weight:800;margin:4px 0;color:${accent || 'var(--navy)'}">${value}</div>
    <div style="font-size:.72rem;color:var(--text-muted)">${h(sub)}</div>
  </div>`;
}
function recTabBtn(id, label) {
  return `<button class="tab-pill${APP._recTab === id ? ' active' : ''}" ${dataAct('recView', id)}>${h(label)}</button>`;
}
function recView(id) { APP._recTab = id; document.querySelectorAll('.tab-pill').forEach(b => b.classList.remove('active')); const t = document.querySelector(`[data-act="recView"][data-args*="${id}"]`); if (t) t.classList.add('active'); recRenderBody(); }

function recRenderBody() {
  const body = document.getElementById('rec-body'); if (!body) return;
  if (APP._recTab === 'calendar') return recRenderCalendar(body);
  if (APP._recTab === 'occ') return recRenderOcc(body);
  return recRenderPlans(body);
}

/* ── Plans tab ─────────────────────────────────────────────── */
function recRenderPlans(body) {
  const plans = APP._recPlans || [];
  if (!plans.length) {
    body.innerHTML = `<div class="card" style="padding:40px;text-align:center">
      <div style="font-size:2.2rem">🔁</div>
      <div style="font-weight:800;color:var(--navy);margin-top:8px">No recurring plans yet</div>
      <div style="color:var(--text-muted);font-size:.86rem;margin-top:4px">Create a plan to auto-generate repeat orders on a schedule.</div>
      <button class="btn btn-gold" style="margin-top:16px" ${dataAct('recOpenCreate')}>＋ Create recurring plan</button>
    </div>`;
    return;
  }
  const q = (APP._recSearch || '').toLowerCase();
  const sf = APP._recStatusF || '';
  const list = plans.filter(p =>
    (!q || (`${p.name} ${p.product_name} ${p.id}`).toLowerCase().includes(q)) &&
    (!sf || p.status === sf));
  const rows = list.map(p => `
    <tr style="cursor:pointer" ${dataAct('recDetail', p.id)}>
      <td><div style="font-weight:700;color:var(--navy)">${h(p.name)}</div><div class="u-muted-xs">${h(p.id)} · ${h(p.product_name || '')}</div></td>
      <td>${h(p.schedule_label || '')}</td>
      <td>${h(p.site || '—')}</td>
      <td><b>${p.next_date ? fmtDate(p.next_date) : '—'}</b><div class="u-muted-xs">${h(String(p.qty || ''))} ${h(p.unit || '')}</div></td>
      <td>${h(p.mode || 'Draft')}</td>
      <td>${recBadge(p.status)}</td>
      <td class="u-right" ${dataAct('recNoop')} data-stop>
        <button class="btn btn-secondary btn-sm" ${dataAct('recDetail', p.id)}>View →</button>
        <button class="btn btn-secondary btn-sm" ${dataAct('recTogglePause', p.id)}>${p.status === 'Active' ? 'Pause' : 'Resume'}</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No plans match these filters.</td></tr>`;
  body.innerHTML = `
    <div class="card" style="padding:0;margin:0">
      <div style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--border)">
        <input type="search" placeholder="🔍 Search plan or product…" value="${h(APP._recSearch || '')}" ${dataInputVal('recSearch')}
          style="flex:1;min-width:200px;padding:8px 11px;border:1.5px solid var(--border);border-radius:8px;font-size:.86rem">
        <select ${dataChangeVal('recStatusF')} style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.86rem">
          ${['', 'Active', 'Paused'].map(v => `<option value="${v}"${APP._recStatusF === v ? ' selected' : ''}>${v || 'All statuses'}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap" style="overflow:auto">
        <table class="table" style="margin:0;min-width:820px">
          <thead><tr><th>Plan / Product</th><th>Schedule</th><th>Location</th><th>Next delivery</th><th>Mode</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <p class="u-muted-xs" style="margin-top:10px">Generated orders follow the normal approval, budget and validation rules. Drafts can be edited before submission.</p>`;
}
function recSearch(v) { APP._recSearch = v; recRenderBody(); }
function recStatusF(v) { APP._recStatusF = v; recRenderBody(); }
function recNoop() {}

/* ── Scheduled deliveries tab ──────────────────────────────── */
function recRenderOcc(body) {
  const occ = APP._recOcc || [];
  const f = APP._recOccF || '';
  const list = occ.filter(o => !f || o.status === f);
  const rows = list.map(o => `
    <tr>
      <td>${fmtDate(o.date)}</td>
      <td>${h(o.plan_name || '')}<div class="u-muted-xs">${h(o.product_name || '')}</div></td>
      <td>${h(String(o.qty || ''))} ${h(o.unit || '')}</td>
      <td>${h(o.site || '—')}</td>
      <td>${o.order_id ? `<button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.order_id)}>${h(o.order_id)}</button>` : '—'}</td>
      <td>${recBadge(o.status)}</td>
      <td class="u-right">
        <button class="btn btn-secondary btn-sm" ${dataAct('recDetail', o.plan_id)}>Plan</button>
        ${(o.status === 'Planned' || o.status === 'Overdue') ? `<button class="btn btn-gold btn-sm" ${dataAct('recGenerate', o.plan_id, o.date)}>Generate</button>` : ''}
        ${(o.status === 'Planned' || o.status === 'Overdue') ? `<button class="btn btn-secondary btn-sm" ${dataAct('recSkip', o.plan_id, o.date)}>Skip</button>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No scheduled deliveries in this window.</td></tr>`;
  const statuses = ['', 'Planned', 'Overdue', 'Draft generated', 'Pending approval', 'Approved', 'Skipped'];
  body.innerHTML = `
    <div class="card" style="padding:0;margin:0">
      <div style="padding:12px 14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--border)">
        <div><b>Scheduled deliveries</b><div class="u-muted-xs">Planned occurrences and generated-order status</div></div>
        <select ${dataChangeVal('recOccF')} style="padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.86rem">
          ${statuses.map(v => `<option value="${v}"${APP._recOccF === v ? ' selected' : ''}>${v || 'All statuses'}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap" style="overflow:auto">
        <table class="table" style="margin:0;min-width:820px">
          <thead><tr><th>Date</th><th>Plan / product</th><th>Qty</th><th>Location</th><th>Order</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}
function recOccF(v) { APP._recOccF = v; recRenderBody(); }

/* ── Delivery calendar tab ─────────────────────────────────── */
function recRenderCalendar(body) {
  const now = new Date();
  if (APP._recCalM == null) { APP._recCalM = now.getMonth(); APP._recCalY = now.getFullYear(); }
  const m = APP._recCalM, y = APP._recCalY;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const title = first.toLocaleString('en', { month: 'long', year: 'numeric' });
  const byDate = {};
  (APP._recOcc || []).forEach(o => { (byDate[o.date] = byDate[o.date] || []).push(o); });
  const startPad = (first.getDay() + 6) % 7; // Monday-first
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += `<div style="min-height:84px;background:var(--surface-2);border-right:1px solid var(--border);border-bottom:1px solid var(--border)"></div>`;
  for (let d = 1; d <= last.getDate(); d++) {
    const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = (byDate[iso] || []).slice(0, 3).map(o => {
      const c = REC_STATUS_COLOR[o.status] || 'var(--navy)';
      return `<div title="${h(o.plan_name)} · ${h(o.status)}" style="font-size:.64rem;margin-top:3px;padding:2px 4px;border-radius:4px;background:color-mix(in srgb,${c} 14%,var(--surface));color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(o.product_name || o.plan_name || '')}</div>`;
    }).join('');
    const more = (byDate[iso] || []).length > 3 ? `<div style="font-size:.6rem;color:var(--text-muted);margin-top:2px">+${byDate[iso].length - 3} more</div>` : '';
    cells += `<div style="min-height:84px;padding:5px 6px;border-right:1px solid var(--border);border-bottom:1px solid var(--border)">
      <div style="font-size:.7rem;color:var(--text-muted)">${d}</div>${evs}${more}</div>`;
  }
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div style="text-align:center;padding:8px;font-size:.68rem;color:var(--text-muted);border-bottom:1px solid var(--border);font-weight:700">${d}</div>`).join('');
  body.innerHTML = `
    <div class="card" style="padding:0;margin:0">
      <div style="padding:13px 15px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)">
        <div><b>${h(title)}</b><div class="u-muted-xs">Scheduled occurrences across your plans</div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-secondary btn-sm" ${dataAct('recCalMove', -1)}>‹</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('recCalToday')}>Today</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('recCalMove', 1)}>›</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr)">${dayNames}${cells}</div>
    </div>`;
}
function recCalMove(n) { let m = APP._recCalM + n, y = APP._recCalY; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } APP._recCalM = m; APP._recCalY = y; recRenderBody(); }
function recCalToday() { const n = new Date(); APP._recCalM = n.getMonth(); APP._recCalY = n.getFullYear(); recRenderBody(); }

/* ── Plan detail ───────────────────────────────────────────── */
async function recDetail(id) {
  const main = document.getElementById('main-content') || document.querySelector('.content');
  if (main) main.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:48px"><span class="u-muted">Loading plan…</span></div>`;
  const p = await api('/recurring-plans/' + id).catch(() => null);
  if (!p || p.error) { showToast('Could not load plan', 'error'); navigate('recurring'); return; }
  APP._recDetailData = p;
  const occRows = (p.occurrences || []).map(o => `
    <tr>
      <td>${fmtDate(o.date)}</td>
      <td>${recBadge(o.status)}</td>
      <td>${o.order_id ? `<button class="btn btn-secondary btn-sm" ${dataAct('viewOrder', o.order_id)}>${h(o.order_id)}</button>` : '—'}</td>
      <td class="u-right">
        ${(o.status === 'Planned' || o.status === 'Overdue') ? `<button class="btn btn-gold btn-sm" ${dataAct('recGenerate', p.id, o.date)}>Generate</button>` : ''}
        ${(o.status === 'Planned' || o.status === 'Overdue') ? `<button class="btn btn-secondary btn-sm" ${dataAct('recSkip', p.id, o.date)}>Skip</button>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">No occurrences in this window.</td></tr>`;
  const kv = (k, v) => `<div><div class="u-muted-xs">${h(k)}</div><div style="font-weight:650;margin-top:2px">${v}</div></div>`;
  main.innerHTML = `
    <div style="max-width:1040px;margin:0 auto">
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'recurring')}>← Back to plans</button>
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;margin:14px 0">
        <div>
          <div style="font-size:1.25rem;font-weight:800;color:var(--navy)">${h(p.name)}</div>
          <div class="u-muted-xs">${h(p.id)} · ${h(p.client_name || '')} ${recBadge(p.status)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" ${dataAct('recEditModal', p.id)}>Edit plan</button>
          <button class="btn btn-gold" ${dataAct('recGenerate', p.id)}>Generate next now</button>
          <button class="btn btn-secondary" ${dataAct('recTogglePause', p.id)}>${p.status === 'Active' ? 'Pause plan' : 'Resume plan'}</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px" class="rec-detailgrid">
        <div class="card" style="padding:16px;margin:0">
          <div style="font-weight:750;margin-bottom:12px;color:var(--navy)">Plan configuration</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
            ${kv('Product', h(p.product_name || ''))}
            ${kv('Quantity / delivery', `${h(String(p.qty || ''))} ${h(p.unit || '')}`)}
            ${kv('Schedule', h(p.schedule_label || ''))}
            ${kv('Location', h(p.site || '—'))}
            ${kv('Generation mode', h(p.mode || 'Draft'))}
            ${kv('Start', p.start_date ? fmtDate(p.start_date) : '—')}
            ${kv('End', p.end_date ? fmtDate(p.end_date) : 'Open-ended')}
          </div>
          ${p.notes ? `<p class="u-muted-xs" style="margin-top:12px">Instructions: ${h(p.notes)}</p>` : ''}
        </div>
        <div class="card" style="padding:16px;margin:0">
          <div style="font-weight:750;margin-bottom:8px;color:var(--navy)">Plan controls</div>
          <p class="u-muted-xs" style="margin:0 0 12px">Edits apply to future occurrences only. Already-generated orders are unchanged.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" ${dataAct('recEditModal', p.id)}>Edit schedule</button>
            <button class="btn btn-secondary btn-sm" ${dataAct('recGenerate', p.id)}>Generate next occurrence</button>
          </div>
          <div style="font-weight:700;margin-top:16px;font-size:.84rem;color:var(--navy)">Mode</div>
          <div class="u-muted-xs">${p.mode === 'Auto-submit' ? 'Orders submit automatically where approval & budget allow.' : 'Orders are created as drafts for review before submission.'}</div>
        </div>
      </div>
      <div style="font-weight:750;margin:20px 0 10px;color:var(--navy)">Upcoming & recent occurrences</div>
      <div class="card" style="padding:0;margin:0"><div class="table-wrap" style="overflow:auto">
        <table class="table" style="margin:0"><thead><tr><th>Date</th><th>Status</th><th>Order</th><th></th></tr></thead><tbody>${occRows}</tbody></table>
      </div></div>
    </div>`;
}

/* ── Actions ───────────────────────────────────────────────── */
async function recTogglePause(id) {
  const p = (APP._recPlans || []).find(x => x.id === id) || APP._recDetailData;
  const toActive = p && p.status !== 'Active';
  const r = await api('/recurring-plans/' + id, { method: 'PATCH', body: JSON.stringify({ status: toActive ? 'Active' : 'Paused' }) });
  if (r && !r.error) { showToast(`Plan ${toActive ? 'resumed' : 'paused'}`); (APP._recDetailData && APP._recDetailData.id === id) ? recDetail(id) : navigate('recurring'); }
}
async function recSkip(id, date) {
  openModal('Skip this delivery?',
    `<p class="u-muted">Skip the <b>${fmtDate(date)}</b> occurrence of this plan? No order will be generated for that date. Future deliveries are unaffected.</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('recSkipConfirm', id, date)}>Skip delivery</button>`);
}
async function recSkipConfirm(id, date) {
  const r = await api('/recurring-plans/' + id + '/skip', { method: 'POST', body: JSON.stringify({ date }) });
  closeModal();
  if (r && !r.error) { showToast(`Delivery on ${fmtDate(date)} skipped`); (APP._recDetailData && APP._recDetailData.id === id) ? recDetail(id) : navigate('recurring'); }
  else if (r && r.error) showToast(r.error, 'error');
}
async function recGenerate(id, date) {
  const when = date ? `the <b>${fmtDate(date)}</b> occurrence` : 'the next occurrence';
  openModal('Generate order now',
    `<p class="u-muted">Generate the order for ${when} of this plan now? It uses the current catalogue price and follows the plan's generation mode (draft or auto-submit).</p>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('recGenerateConfirm', id, date || '')}>Generate order</button>`);
}
async function recGenerateConfirm(id, date) {
  const body = date ? { date } : {};
  const r = await api('/recurring-plans/' + id + '/generate', { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (r && r.ok) { showToast(`Order ${r.order_id} created (${r.order_status === 'DRAFT' ? 'draft' : 'submitted'})`); (APP._recDetailData && APP._recDetailData.id === id) ? recDetail(id) : navigate('recurring'); }
  else if (r && r.error) showToast(r.error, 'error');
}

/* ── Create / edit modal ───────────────────────────────────── */
async function recOpenCreate() {
  if (!Array.isArray(APP._catalog) || !APP._catalog.length) APP._catalog = await api('/inventory').catch(() => []) || [];
  let clientRow = '';
  if (!recIsClient()) {
    const clients = await api('/clients').catch(() => []);
    const opts = (clients || []).map(c => `<option value="${c.id}">${h(c.name)}</option>`).join('');
    clientRow = `<div class="rec-f"><label>Delivery client *</label><select id="rec-client">${opts}</select></div>`;
  }
  const prodOpts = (APP._catalog || []).map(it => `<option value="${h(it.sku)}" data-unit="${h(it.unit || '')}">${h(it.name)}</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);
  const mayAuto = ['super_admin', 'ops_admin', 'ops_manager', 'client_admin'].includes(APP.user?.role || '');
  openModal('Create recurring plan', `
    <div class="rec-form">
      <div class="rec-f rec-full"><label>Plan name *</label><input id="rec-name" placeholder="e.g. Daily milk – EGL pantry"></div>
      ${clientRow}
      <div class="rec-f"><label>Product *</label><select id="rec-product" ${dataChangeEl('recProductChange')}>${prodOpts}</select></div>
      <div class="rec-f"><label>Quantity / delivery *</label><input id="rec-qty" type="number" min="1" value="10" ${dataInput('recPreview')}></div>
      <div class="rec-f"><label>Unit</label><input id="rec-unit" placeholder="e.g. Litres, Kg, Packets"></div>
      <div class="rec-f"><label>Delivery location</label><input id="rec-site" placeholder="e.g. BLR – EGL pantry"></div>
      <div class="rec-f rec-full"><label>Frequency *</label>
        <div class="rec-choices">
          ${['weekdays', 'weekly', 'monthly', 'custom'].map((f, i) => `<label><input type="radio" name="rec-freq" value="${f}"${i === 0 ? ' checked' : ''} ${dataChange('recFreqChange')}> ${['Selected weekdays', 'Weekly', 'Monthly', 'Custom dates'][i]}</label>`).join('')}
        </div>
      </div>
      <div class="rec-f rec-full" id="rec-weekdays"><label>Repeat on</label>
        <div class="rec-choices">${REC_WD.map(d => `<label><input type="checkbox" class="rec-day" value="${d}"${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d) ? ' checked' : ''} ${dataChange('recPreview')}> ${d}</label>`).join('')}</div>
      </div>
      <div class="rec-f rec-full" id="rec-monthly" style="display:none">
        <label>Scheduling method</label>
        <select id="rec-method" ${dataChangeEl('recMethodChange')}><option value="pattern">Repeat on selected weekdays</option><option value="dates">Specific dates of month</option></select>
        <div id="rec-monthly-dates" style="display:none;margin-top:8px"><label>Dates of month</label><input id="rec-mdates" placeholder="e.g. 5, 12, 19, 26" ${dataInput('recPreview')}></div>
        <div id="rec-monthly-pattern" style="margin-top:8px"><label>On weekdays</label>
          <div class="rec-choices">${REC_WD.map(d => `<label><input type="checkbox" class="rec-mday" value="${d}"${d === 'Mon' ? ' checked' : ''} ${dataChange('recPreview')}> ${d}</label>`).join('')}</div></div>
      </div>
      <div class="rec-f rec-full" id="rec-custom" style="display:none"><label>Custom delivery dates (YYYY-MM-DD, comma-separated)</label><input id="rec-cdates" placeholder="e.g. 2026-12-05, 2026-12-19" ${dataInput('recPreview')}></div>
      <div class="rec-f"><label>Start date *</label><input id="rec-start" type="date" value="${today}" ${dataChange('recPreview')}></div>
      <div class="rec-f"><label>End date</label><input id="rec-end" type="date"></div>
      <div class="rec-f rec-full"><label>Order generation mode</label>
        <select id="rec-mode"><option value="Draft">Generate draft for review (recommended)</option>${mayAuto ? '<option value="Auto-submit">Submit automatically where permitted</option>' : ''}</select>
        <div class="u-muted-xs" style="margin-top:4px">All generated orders still follow validation, approval and budget controls.</div>
      </div>
      <div class="rec-f rec-full"><label>Special instructions</label><input id="rec-notes" placeholder="Delivery window, brand preference, handling…"></div>
    </div>
    <div id="rec-preview" style="background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:11px 13px;margin-top:12px;font-size:.82rem;color:var(--text-muted)"></div>
    <style>
      .rec-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}
      .rec-f label{display:block;font-size:.8rem;font-weight:650;margin-bottom:5px;color:var(--navy)}
      .rec-f input,.rec-f select{width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.86rem;box-sizing:border-box;background:var(--surface);color:var(--text)}
      .rec-full{grid-column:1/-1}
      .rec-choices{display:flex;gap:8px;flex-wrap:wrap}
      .rec-choices label{border:1px solid var(--border);border-radius:7px;padding:6px 9px;font-size:.82rem;font-weight:600;display:inline-flex;gap:5px;align-items:center}
      @media(max-width:560px){.rec-form{grid-template-columns:1fr}.rec-full{grid-column:auto}}
    </style>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('recSavePlan')}>Save recurring plan</button>`);
  recProductChange();
  recPreview();
}
function recProductChange() {
  const sel = document.getElementById('rec-product'); if (!sel) return;
  const opt = sel.selectedOptions[0];
  const unitEl = document.getElementById('rec-unit');
  if (unitEl && !unitEl.value && opt && opt.dataset.unit) unitEl.value = opt.dataset.unit;
  recPreview();
}
function recFreqChange() {
  const f = (document.querySelector('[name=rec-freq]:checked') || {}).value || 'weekdays';
  const show = (id, on) => { const e = document.getElementById(id); if (e) e.style.display = on ? 'block' : 'none'; };
  show('rec-weekdays', f === 'weekdays' || f === 'weekly');
  show('rec-monthly', f === 'monthly');
  show('rec-custom', f === 'custom');
  recPreview();
}
function recMethodChange() {
  const m = (document.getElementById('rec-method') || {}).value || 'pattern';
  const d = document.getElementById('rec-monthly-dates'), p = document.getElementById('rec-monthly-pattern');
  if (d) d.style.display = m === 'dates' ? 'block' : 'none';
  if (p) p.style.display = m === 'pattern' ? 'block' : 'none';
  recPreview();
}
function recCollectPlan() {
  const freq = (document.querySelector('[name=rec-freq]:checked') || {}).value || 'weekdays';
  const sel = document.getElementById('rec-product');
  const opt = sel && sel.selectedOptions[0];
  const plan = {
    name: (document.getElementById('rec-name') || {}).value || '',
    product_sku: sel ? sel.value : '',
    product_name: opt ? opt.textContent : '',
    qty: Number((document.getElementById('rec-qty') || {}).value) || 0,
    unit: (document.getElementById('rec-unit') || {}).value || '',
    site: (document.getElementById('rec-site') || {}).value || '',
    freq,
    start_date: (document.getElementById('rec-start') || {}).value || '',
    end_date: (document.getElementById('rec-end') || {}).value || '',
    mode: (document.getElementById('rec-mode') || {}).value || 'Draft',
    notes: (document.getElementById('rec-notes') || {}).value || '',
  };
  const cl = document.getElementById('rec-client'); if (cl) plan.client_id = cl.value;
  if (freq === 'weekdays' || freq === 'weekly') plan.days = [...document.querySelectorAll('.rec-day:checked')].map(x => x.value);
  if (freq === 'monthly') {
    const method = (document.getElementById('rec-method') || {}).value || 'pattern';
    plan.monthly_method = method;
    if (method === 'dates') plan.monthly_dates = ((document.getElementById('rec-mdates') || {}).value || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= 31);
    else plan.days = [...document.querySelectorAll('.rec-mday:checked')].map(x => x.value);
  }
  if (freq === 'custom') plan.custom_dates = ((document.getElementById('rec-cdates') || {}).value || '').split(',').map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s));
  return plan;
}
function recPreview() {
  const el = document.getElementById('rec-preview'); if (!el) return;
  const p = recCollectPlan();
  let sch = 'selected weekdays';
  if (p.freq === 'weekly') sch = 'weekly on ' + ((p.days || []).join(', ') || '—');
  else if (p.freq === 'weekdays') sch = (p.days || []).join(', ') || 'no days selected';
  else if (p.freq === 'monthly') sch = p.monthly_method === 'dates' ? 'monthly on day ' + ((p.monthly_dates || []).join(', ') || '—') : 'monthly on ' + ((p.days || []).join(', ') || '—');
  else if (p.freq === 'custom') sch = (p.custom_dates || []).length + ' custom date(s)';
  el.innerHTML = `<b>Preview:</b> ${p.qty || 0} ${h(p.unit || 'units')} of ${h(p.product_name || '—')}, ${h(sch)}. ${p.mode === 'Auto-submit' ? 'Submitted automatically (subject to controls).' : 'Draft orders for review.'}`;
}
async function recSavePlan() {
  const plan = recCollectPlan();
  if (!plan.name.trim()) { showToast('Enter a plan name', 'error'); return; }
  if (!plan.product_sku) { showToast('Select a product', 'error'); return; }
  if (!plan.qty || plan.qty < 1) { showToast('Enter a valid quantity', 'error'); return; }
  const btn = document.querySelector('#modal-footer .btn-gold'); if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const r = await api('/recurring-plans', { method: 'POST', body: JSON.stringify(plan) });
  if (r && r.id) {
    closeModal();
    showToast(`Recurring plan ${r.id} created${r.mode_downgraded ? ' (auto-submit not permitted — set to Draft)' : ''}`);
    navigate('recurring');
  } else { if (btn) { btn.disabled = false; btn.textContent = 'Save recurring plan'; } if (r && r.error) showToast(r.error, 'error'); }
}

/* ── Edit modal (schedule-light: scalars + mode + end date) ──── */
async function recEditModal(id) {
  const p = APP._recDetailData && APP._recDetailData.id === id ? APP._recDetailData : await api('/recurring-plans/' + id).catch(() => null);
  if (!p) { showToast('Could not load plan', 'error'); return; }
  const mayAuto = ['super_admin', 'ops_admin', 'ops_manager', 'client_admin'].includes(APP.user?.role || '');
  openModal(`Edit plan ${h(p.id)}`, `
    <div class="rec-form">
      <div class="rec-f rec-full"><label>Plan name</label><input id="rec-e-name" value="${h(p.name || '')}"></div>
      <div class="rec-f"><label>Quantity / delivery</label><input id="rec-e-qty" type="number" min="1" value="${h(String(p.qty || ''))}"></div>
      <div class="rec-f"><label>Unit</label><input id="rec-e-unit" value="${h(p.unit || '')}"></div>
      <div class="rec-f"><label>Delivery location</label><input id="rec-e-site" value="${h(p.site || '')}"></div>
      <div class="rec-f"><label>End date</label><input id="rec-e-end" type="date" value="${h(p.end_date || '')}"></div>
      <div class="rec-f rec-full"><label>Generation mode</label><select id="rec-e-mode"><option value="Draft"${p.mode !== 'Auto-submit' ? ' selected' : ''}>Draft for review</option>${mayAuto ? `<option value="Auto-submit"${p.mode === 'Auto-submit' ? ' selected' : ''}>Submit automatically where permitted</option>` : ''}</select></div>
      <div class="rec-f rec-full"><label>Special instructions</label><input id="rec-e-notes" value="${h(p.notes || '')}"></div>
    </div>
    <p class="u-muted-xs" style="margin-top:10px">Changes apply to future occurrences only. Already-generated orders are unchanged.</p>
    <style>.rec-form{display:grid;grid-template-columns:1fr 1fr;gap:13px}.rec-f label{display:block;font-size:.8rem;font-weight:650;margin-bottom:5px;color:var(--navy)}.rec-f input,.rec-f select{width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:.86rem;box-sizing:border-box;background:var(--surface);color:var(--text)}.rec-full{grid-column:1/-1}@media(max-width:560px){.rec-form{grid-template-columns:1fr}.rec-full{grid-column:auto}}</style>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-gold" ${dataAct('recSaveEdit', id)}>Save changes</button>`);
}
async function recSaveEdit(id) {
  const body = {
    name: (document.getElementById('rec-e-name') || {}).value || '',
    qty: Number((document.getElementById('rec-e-qty') || {}).value) || 0,
    unit: (document.getElementById('rec-e-unit') || {}).value || '',
    site: (document.getElementById('rec-e-site') || {}).value || '',
    end_date: (document.getElementById('rec-e-end') || {}).value || '',
    mode: (document.getElementById('rec-e-mode') || {}).value || 'Draft',
    notes: (document.getElementById('rec-e-notes') || {}).value || '',
  };
  if (!body.name.trim()) { showToast('Enter a plan name', 'error'); return; }
  if (!body.qty || body.qty < 1) { showToast('Enter a valid quantity', 'error'); return; }
  const r = await api('/recurring-plans/' + id, { method: 'PATCH', body: JSON.stringify(body) });
  closeModal();
  if (r && r.ok) { showToast('Plan updated'); recDetail(id); }
  else if (r && r.error) showToast(r.error, 'error');
}
