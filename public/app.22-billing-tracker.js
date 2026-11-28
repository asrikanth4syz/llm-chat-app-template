// Billing & Invoice Tracker (core) — a tab inside the Billing page. Records
// externally-issued invoices against unbilled delivery challans and tracks
// preparation → submission. Backend: /api/billing/*. Finance/Ops only.

const BT_FREQ = ['Monthly', 'Fortnightly', 'Weekly'];

async function renderBillingTracker(el) {
  APP._bt = APP._bt || { tab: 'overview', clientId: '', periodId: '', sel: {} };
  APP._bt.el = el;
  el.innerHTML = `<div class="u-muted" style="padding:16px">Loading…</div>`;
  if (!APP._bt.clients) {
    APP._bt.clients = ((await api('/clients').catch(() => [])) || []).filter(c => c.active !== 0)
      .map(c => ({ id: c.id, name: c.display_name || c.name })).sort((a, b) => a.name.localeCompare(b.name));
    APP._bt.users = ((await api('/users').catch(() => [])) || [])
      .filter(u => u.active !== 0 && ['super_admin', 'ops_admin', 'finance_admin'].includes(u.role))
      .map(u => ({ id: u.id, name: u.name }));
  }
  btRender();
}

function btSubtab(id, label) {
  return `<button type="button" class="tab-btn${APP._bt.tab === id ? ' active' : ''}" ${dataAct('btGo', id)}>${label}</button>`;
}
function btRender() {
  const el = APP._bt.el; if (!el) return;
  el.innerHTML = `
    <div class="tabs" style="margin-bottom:14px">
      ${btSubtab('overview', 'Overview')}
      ${btSubtab('tobill', 'To Be Billed')}
      ${btSubtab('invoices', 'Invoices')}
    </div>
    <div id="bt-body"><div class="u-muted" style="padding:16px">Loading…</div></div>`;
  btBody();
}
function btGo(tab) { APP._bt.tab = tab; btRender(); }

async function btBody() {
  const body = document.getElementById('bt-body'); if (!body) return;
  if (APP._bt.tab === 'overview') return btOverview(body);
  if (APP._bt.tab === 'tobill') return btToBill(body);
  if (APP._bt.tab === 'invoices') return btInvoices(body);
}

// ── Overview ────────────────────────────────────────────────────────────────
async function btOverview(body) {
  const o = await api('/billing/overview'); if (!o) return;
  body.innerHTML = `
    <div class="tile-grid" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr));margin-bottom:18px">
      ${tileHtml({ label: 'Unbilled DCs', value: o.unbilled_dcs, sub: `${fmt(o.unbilled_value)} to bill`, accent: o.unbilled_dcs ? 'var(--warning)' : 'var(--success)', act: dataAct('btGo', 'tobill') })}
      ${tileHtml({ label: 'Drafts', value: o.drafts, sub: `${fmt(o.draft_value)} reserved`, accent: 'var(--navy)', act: dataAct('btGo', 'invoices') })}
      ${tileHtml({ label: 'Pending submission', value: o.pending_submission, sub: `${fmt(o.pending_submission_value)} recorded, not sent`, accent: o.pending_submission ? '#B5731A' : 'var(--success)', act: dataAct('btGo', 'invoices') })}
      ${tileHtml({ label: 'Overdue submission', value: o.overdue_submission, sub: o.overdue_submission ? 'past target date' : 'all on time', accent: o.overdue_submission ? 'var(--danger)' : 'var(--success)' })}
      ${tileHtml({ label: 'Billed this month', value: o.billed_this_month, sub: fmt(o.billed_this_month_value), accent: 'var(--success)' })}
    </div>
    <div class="card"><div class="u-muted" style="font-size:.86rem;line-height:1.6">
      <b style="color:var(--navy)">How this works —</b> pick a client and billing period under <b>To Be Billed</b>, tick the delivered challans to include, and <b>Create Invoice</b> (this reserves those DCs so no one double-bills). Then record the actual invoice number, date and amount from your accounting system, and track each submission channel until it's sent.
    </div></div>`;
}

// ── To Be Billed ────────────────────────────────────────────────────────────
async function btToBill(body) {
  const clients = APP._bt.clients || [];
  body.innerHTML = `
    <div class="card" style="margin-bottom:14px"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
      <div><label style="font-size:.72rem;font-weight:700;color:var(--text-muted);display:block;margin-bottom:3px">CLIENT</label>
        <select id="bt-client" style="padding:8px 10px;border:1px solid var(--border);border-radius:7px;min-width:220px;background:var(--surface);color:var(--text)">
          <option value="">Select a client…</option>
          ${clients.map(c => `<option value="${h(c.id)}" ${APP._bt.clientId === c.id ? 'selected' : ''}>${h(c.name)}</option>`).join('')}
        </select></div>
      <div id="bt-period-wrap"></div>
      <div style="margin-left:auto">${APP._bt.clientId ? `<button class="btn btn-secondary btn-sm" ${dataAct('btConfig')}>⚙ Billing setup</button>` : ''}</div>
    </div></div>
    <div id="bt-unbilled"></div>`;
  const sel = document.getElementById('bt-client');
  if (sel) sel.onchange = () => { APP._bt.clientId = sel.value; APP._bt.periodId = ''; APP._bt.sel = {}; btToBill(body); };
  if (APP._bt.clientId) await btLoadPeriods();
}

async function btLoadPeriods() {
  const wrap = document.getElementById('bt-period-wrap'); if (!wrap) return;
  const [cfg, pr] = await Promise.all([
    api(`/billing/clients/${APP._bt.clientId}/config`),
    api(`/billing/clients/${APP._bt.clientId}/periods`),
  ]);
  APP._bt.config = cfg; APP._bt.periods = (pr && pr.periods) || [];
  if (!APP._bt.periodId && pr) { const cur = APP._bt.periods.find(p => p.period_key === pr.current_key); if (cur) APP._bt.periodId = cur.id; }
  wrap.innerHTML = `<label style="font-size:.72rem;font-weight:700;color:var(--text-muted);display:block;margin-bottom:3px">BILLING PERIOD · ${h((cfg && cfg.frequency) || 'Monthly')}</label>
    <select id="bt-period" style="padding:8px 10px;border:1px solid var(--border);border-radius:7px;min-width:200px;background:var(--surface);color:var(--text)">
      ${APP._bt.periods.map(p => `<option value="${h(p.id)}" ${APP._bt.periodId === p.id ? 'selected' : ''}>${h(p.label)}${p.status === 'no_billing' ? ' · No billing' : ''}</option>`).join('')}
    </select>`;
  const psel = document.getElementById('bt-period');
  if (psel) psel.onchange = () => { APP._bt.periodId = psel.value; APP._bt.sel = {}; btUnbilled(); };
  await btUnbilled();
}

async function btUnbilled() {
  const host = document.getElementById('bt-unbilled'); if (!host) return;
  if (!APP._bt.periodId) { host.innerHTML = ''; return; }
  const r = await api(`/billing/clients/${APP._bt.clientId}/unbilled?period_id=${APP._bt.periodId}`);
  if (!r) return;
  APP._bt._unbilled = [...(r.in_period || []), ...(r.carry_forward || [])];
  const rows = (list, tag) => list.map(dc => `<tr>
      <td style="width:34px"><input type="checkbox" data-btdc="${h(dc.id)}" ${APP._bt.sel[dc.id] ? 'checked' : ''}></td>
      <td><b>${h(dc.dc_number || dc.id)}</b>${tag ? ` <span class="badge" style="font-size:.6rem;background:var(--bg);border:1px solid var(--border)">carry-forward</span>` : ''}</td>
      <td>${h(dc.category || '—')}</td>
      <td>${fmtDate(dc.delivered_at || dc.dispatched_at)}</td>
      <td class="u-right" style="font-variant-numeric:tabular-nums">${fmt(dc.dc_value)}</td>
    </tr>`).join('');
  const empty = !(r.in_period || []).length && !(r.carry_forward || []).length;
  host.innerHTML = `
    <div class="card">
      <div class="card-header"><span>Eligible delivery challans</span>
        <span style="font-size:.82rem;color:var(--text-muted)">In period ${fmt(r.in_period_value)}${(r.carry_forward || []).length ? ` · carry-forward ${fmt(r.carry_forward_value)}` : ''}</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th><input type="checkbox" id="bt-all"></th><th>DC #</th><th>Category</th><th>Delivered</th><th class="u-right">Value</th></tr></thead>
        <tbody>
          ${rows(r.in_period || [], false)}
          ${(r.carry_forward || []).length ? `<tr><td colspan="5" style="background:var(--bg);font-size:.72rem;font-weight:700;color:var(--text-muted)">Earlier unbilled (carry-forward)</td></tr>` : ''}
          ${rows(r.carry_forward || [], true)}
          ${empty ? `<tr><td colspan="5" class="u-empty">Nothing unbilled for this period. ${APP._bt.periods.find(p => p.id === APP._bt.periodId)?.status !== 'no_billing' ? `<button class="btn btn-sm btn-secondary" ${dataAct('btNoBilling')} style="margin-left:8px">Mark “No billing required”</button>` : '<b>Marked: No billing required</b>'}</td></tr>` : ''}
        </tbody>
      </table></div>
    </div>
    <div id="bt-selbar"></div>`;
  const all = document.getElementById('bt-all');
  if (all) all.onchange = () => { APP._bt._unbilled.forEach(d => { APP._bt.sel[d.id] = all.checked; }); document.querySelectorAll('[data-btdc]').forEach(cb => { cb.checked = all.checked; }); btSelBar(); };
  document.querySelectorAll('[data-btdc]').forEach(cb => { cb.onchange = () => { APP._bt.sel[cb.dataset.btdc] = cb.checked; btSelBar(); }; });
  btSelBar();
}

function btSelBar() {
  const bar = document.getElementById('bt-selbar'); if (!bar) return;
  const chosen = (APP._bt._unbilled || []).filter(d => APP._bt.sel[d.id]);
  if (!chosen.length) { bar.innerHTML = ''; return; }
  const val = chosen.reduce((s, d) => s + Number(d.dc_value || 0), 0);
  const owners = APP._bt.users || [];
  const defOwner = (APP._bt.config && APP._bt.config.default_owner) || '';
  bar.innerHTML = `<div style="position:sticky;bottom:10px;margin-top:12px;background:var(--navy);color:#fff;border-radius:12px;padding:12px 14px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
    <span><b>${chosen.length} DC${chosen.length > 1 ? 's' : ''}</b> · ${fmt(val)}</span>
    <span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <select id="bt-owner" style="padding:6px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.4);background:var(--navy);color:#fff;font-size:.82rem">
        <option value="">Owner: unassigned</option>
        ${owners.map(u => `<option value="${h(u.id)}" ${defOwner === u.id ? 'selected' : ''}>${h(u.name)}</option>`).join('')}
      </select>
      <button class="btn btn-sm btn-primary" ${dataAct('btCreateInvoice')}>Create invoice →</button>
    </span></div>`;
}

async function btCreateInvoice() {
  const chosen = (APP._bt._unbilled || []).filter(d => APP._bt.sel[d.id]).map(d => d.id);
  if (!chosen.length) return;
  const owner = document.getElementById('bt-owner')?.value || '';
  const r = await api('/billing/invoices', { method: 'POST', body: JSON.stringify({ client_id: APP._bt.clientId, period_id: APP._bt.periodId, dc_ids: chosen, owner }) });
  if (!r) return;
  APP._bt.sel = {};
  showToast(`Draft invoice created — ${r.dc_count} DC${r.dc_count > 1 ? 's' : ''}, ${fmt(r.allocated_value)}. Record it under Invoices.`);
  APP._bt.tab = 'invoices'; APP._bt.openId = r.id; btRender();
}

function btNoBilling() {
  openModal('Mark “No billing required”',
    `<p class="u-muted" style="font-size:.85rem;margin:0 0 10px">This records that the period was reviewed and nothing needs billing.</p>
     <div class="form-group"><label>Reason <span style="color:var(--danger)">*</span></label><textarea id="bt-nb" rows="2" placeholder="e.g. No deliveries this period"></textarea></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button><button class="btn btn-primary" ${dataAct('btNoBillingSubmit')}>Confirm</button>`);
}
async function btNoBillingSubmit() {
  const reason = (document.getElementById('bt-nb')?.value || '').trim();
  if (!reason) { showToast('A reason is required', 'error'); return; }
  const r = await api(`/billing/periods/${APP._bt.periodId}/no-billing`, { method: 'POST', body: JSON.stringify({ reason }) });
  if (!r) return; closeModal(); showToast('Period marked — No billing required.'); btLoadPeriods();
}

// ── Billing setup (per client) ──────────────────────────────────────────────
function btConfig() {
  const c = APP._bt.config || {};
  const owners = APP._bt.users || [];
  openModal('Billing setup',
    `<div class="form-group"><label>Billing frequency</label>
       <select id="bc-freq">${BT_FREQ.map(f => `<option value="${f}" ${c.frequency === f ? 'selected' : ''}>${f}${f === 'Fortnightly' ? ' (1–15 / 16–end)' : f === 'Weekly' ? ' (7-day windows)' : ''}</option>`).join('')}</select></div>
     <div style="display:flex;gap:10px"><div class="form-group" style="flex:1"><label>Invoice target (days after period end)</label><input type="number" id="bc-itd" min="0" value="${Number(c.invoice_target_days ?? 2)}"></div>
       <div class="form-group" style="flex:1"><label>Submission target (days after period end)</label><input type="number" id="bc-std" min="0" value="${Number(c.submission_target_days ?? 5)}"></div></div>
     <div class="form-group"><label>Default owner</label><select id="bc-owner"><option value="">Unassigned</option>${owners.map(u => `<option value="${h(u.id)}" ${c.default_owner === u.id ? 'selected' : ''}>${h(u.name)}</option>`).join('')}</select></div>
     <div class="form-group"><label>Required submission channels</label>
       <label style="display:block;font-weight:400;font-size:.86rem"><input type="checkbox" id="bc-email" ${Number(c.req_email) ? 'checked' : ''}> Email</label>
       <label style="display:block;font-weight:400;font-size:.86rem"><input type="checkbox" id="bc-portal" ${Number(c.req_portal) ? 'checked' : ''}> Portal</label>
       <label style="display:block;font-weight:400;font-size:.86rem"><input type="checkbox" id="bc-hard" ${Number(c.req_hardcopy) ? 'checked' : ''}> Hard copy</label></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button><button class="btn btn-primary" ${dataAct('btConfigSave')}>Save setup</button>`);
}
async function btConfigSave() {
  const body = {
    frequency: document.getElementById('bc-freq').value,
    invoice_target_days: Number(document.getElementById('bc-itd').value) || 0,
    submission_target_days: Number(document.getElementById('bc-std').value) || 0,
    default_owner: document.getElementById('bc-owner').value || null,
    req_email: document.getElementById('bc-email').checked,
    req_portal: document.getElementById('bc-portal').checked,
    req_hardcopy: document.getElementById('bc-hard').checked,
  };
  const r = await api(`/billing/clients/${APP._bt.clientId}/config`, { method: 'PUT', body: JSON.stringify(body) });
  if (!r) return; closeModal(); showToast('Billing setup saved.'); APP._bt.periodId = ''; btRender();
}

// ── Invoices register ───────────────────────────────────────────────────────
function btSubBadge(s) {
  const map = { 'Not Ready': 'var(--text-muted)', 'Ready': '#3b82f6', 'Partially Submitted': '#B5731A', 'Submitted': 'var(--success)', 'Acknowledged': 'var(--success)' };
  return `<span class="badge" style="background:var(--bg);border:1px solid var(--border);color:${map[s] || 'var(--text-muted)'}">${h(s || '—')}</span>`;
}
function btStatusBadge(s) {
  const map = { Draft: 'var(--text-muted)', Recorded: 'var(--success)', Cancelled: 'var(--danger)' };
  return `<span class="badge" style="background:var(--bg);border:1px solid var(--border);color:${map[s] || 'var(--text-muted)'}">${h(s)}</span>`;
}
async function btInvoices(body) {
  const r = await api('/billing/invoices');
  if (!r) return;
  const today = new Date().toISOString().slice(0, 10);
  const inv = r.invoices || [];
  body.innerHTML = `
    <div class="card"><div class="card-header"><span>Invoice register (${inv.length})</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Owner</th><th>Client</th><th>Invoice No.</th><th>Date</th><th class="u-right">Amount</th><th>Submission</th><th>Target</th><th>Status</th><th></th></tr></thead>
      <tbody>${inv.map(i => {
        const overdue = i.status === 'Recorded' && i.submission_status !== 'Submitted' && i.submission_target_date && i.submission_target_date < today;
        return `<tr>
          <td>${h(i.owner_name || '—')}</td>
          <td><b>${h(i.client_name || '—')}</b>${i.period_label ? `<div class="u-subtiny">${h(i.period_label)}</div>` : ''}</td>
          <td>${i.invoice_no ? `<b>${h(i.invoice_no)}</b>` : '<span class="u-muted">Not yet invoiced</span>'}</td>
          <td>${i.invoice_date ? fmtDate(i.invoice_date) : '—'}</td>
          <td class="u-right" style="font-variant-numeric:tabular-nums">${i.total_amount != null ? fmt(i.total_amount) : fmt(i.allocated_value)}</td>
          <td>${i.status === 'Recorded' ? btSubBadge(i.submission_status) : '—'}${overdue ? ' <span class="badge badge-danger" style="font-size:.6rem">overdue</span>' : ''}</td>
          <td>${i.submission_target_date ? fmtDate(i.submission_target_date) : '—'}</td>
          <td>${btStatusBadge(i.status)}</td>
          <td><button class="btn btn-sm btn-secondary" ${dataAct('btOpen', i.id)}>Open</button></td>
        </tr>`;
      }).join('') || '<tr><td colspan="9" class="u-empty">No invoices yet — create one under To Be Billed.</td></tr>'}
      </tbody></table></div></div>`;
  if (APP._bt.openId) { const id = APP._bt.openId; APP._bt.openId = null; btOpen(id); }
}

async function btOpen(id) {
  const inv = await api(`/billing/invoices/${id}`);
  if (!inv) return;
  const dcs = inv.dcs || [];
  const dcList = dcs.map(d => `<tr><td><b>${h(d.dc_number || d.dc_id)}</b></td><td class="u-right">${fmt(d.dc_value)}</td></tr>`).join('');
  const isDraft = inv.status === 'Draft', isRec = inv.status === 'Recorded';
  const reqChips = [inv.req_email && 'Email', inv.req_portal && 'Portal', inv.req_hardcopy && 'Hard copy'].filter(Boolean).join(' · ') || 'None required';
  const body = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">${btStatusBadge(inv.status)} ${isRec ? btSubBadge(inv.submission_status) : ''}
      <span class="u-muted" style="font-size:.82rem">${h(inv.client_name || '')}${inv.period_label ? ' · ' + h(inv.period_label) : ''}</span></div>
    <div class="card" style="margin-bottom:10px"><div class="card-header"><span>Delivery challans (${dcs.length})</span><span class="u-muted" style="font-size:.82rem">Allocated ${fmt(inv.allocated_value)}</span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>DC #</th><th class="u-right">Value</th></tr></thead><tbody>${dcList || '<tr><td colspan="2" class="u-empty">None</td></tr>'}</tbody></table></div></div>
    ${isRec ? `<div class="card" style="margin-bottom:10px;font-size:.86rem"><b>Invoice ${h(inv.invoice_no)}</b> · ${fmtDate(inv.invoice_date)} · Taxable ${fmt(inv.taxable_amount)} + GST ${fmt(inv.gst_amount)} = <b>${fmt(inv.total_amount)}</b>${Math.abs(Number(inv.total_amount || 0) - Number(inv.allocated_value || 0)) > 0.5 ? `<div style="color:var(--danger);font-size:.78rem;margin-top:3px">⚠ Differs from allocated DC value (${fmt(inv.allocated_value)}) by ${fmt(Math.abs(Number(inv.total_amount) - Number(inv.allocated_value)))}</div>` : ''}</div>` : ''}
    ${isRec ? `<div class="card"><div class="card-header"><span>Submission</span><span class="u-muted" style="font-size:.78rem">Required: ${reqChips}</span></div>
      <div style="display:grid;gap:8px">
        ${inv.req_email ? btDateRow('se-email', 'Email sent', inv.email_date) : ''}
        ${inv.req_portal ? btDateRow('se-portal', 'Portal uploaded', inv.portal_date) : ''}
        ${inv.req_hardcopy ? btDateRow('se-hard', 'Hard copy delivered', inv.hardcopy_date) : ''}
        ${!inv.req_email && !inv.req_portal && !inv.req_hardcopy ? btDateRow('se-sub', 'Submitted on', inv.submitted_date) : ''}
        <div><label style="font-size:.72rem;font-weight:700;color:var(--text-muted)">Remarks</label><input type="text" id="se-remarks" value="${h(inv.remarks || '')}" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px"></div>
      </div></div>` : ''}`;
  const footer = isDraft
    ? `<button class="btn btn-secondary" ${dataAct('btCancelInvoice', id)}>Cancel draft</button><button class="btn btn-primary" ${dataAct('btRecordForm', id)}>Record invoice →</button>`
    : isRec
      ? `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button><button class="btn btn-primary" ${dataAct('btSubmissionSave', id)}>Save submission</button>`
      : `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`;
  openModal(isDraft ? 'Draft invoice' : `Invoice ${inv.invoice_no || ''}`, body, footer);
}
function btDateRow(id, label, val) {
  return `<div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
    <label for="${id}" style="font-size:.84rem">${label}</label>
    <input type="date" id="${id}" value="${val || ''}" style="padding:6px 9px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text)"></div>`;
}

function btRecordForm(id) {
  openModal('Record invoice',
    `<p class="u-muted" style="font-size:.84rem;margin:0 0 10px">Enter the actual invoice details from your accounting system. This marks the selected DCs as billed.</p>
     <div class="form-group"><label>Invoice number <span style="color:var(--danger)">*</span></label><input type="text" id="ri-no" placeholder="e.g. INV-2026-0142"></div>
     <div class="form-group"><label>Invoice date <span style="color:var(--danger)">*</span></label><input type="date" id="ri-date" value="${new Date().toISOString().slice(0, 10)}"></div>
     <div style="display:flex;gap:10px">
       <div class="form-group" style="flex:1"><label>Taxable amount</label><input type="number" id="ri-tax" step="0.01" oninput="btRecalc()"></div>
       <div class="form-group" style="flex:1"><label>GST</label><input type="number" id="ri-gst" step="0.01" oninput="btRecalc()"></div></div>
     <div class="form-group"><label>Amount with tax <span style="color:var(--danger)">*</span></label><input type="number" id="ri-total" step="0.01"></div>`,
    `<button class="btn btn-secondary" ${dataAct('btOpen', id)}>Back</button><button class="btn btn-primary" ${dataAct('btRecordSubmit', id)}>Record</button>`);
}
function btRecalc() {
  const t = Number(document.getElementById('ri-tax')?.value) || 0;
  const g = Number(document.getElementById('ri-gst')?.value) || 0;
  const tot = document.getElementById('ri-total'); if (tot && (t || g)) tot.value = (Math.round((t + g) * 100) / 100);
}
async function btRecordSubmit(id) {
  const invoice_no = (document.getElementById('ri-no')?.value || '').trim();
  const invoice_date = document.getElementById('ri-date')?.value || '';
  const taxable_amount = Number(document.getElementById('ri-tax')?.value) || 0;
  const gst_amount = Number(document.getElementById('ri-gst')?.value) || 0;
  const total_amount = Number(document.getElementById('ri-total')?.value) || 0;
  if (!invoice_no) { showToast('Invoice number is required', 'error'); return; }
  if (!invoice_date) { showToast('Invoice date is required', 'error'); return; }
  if (!(total_amount > 0)) { showToast('Amount with tax is required', 'error'); return; }
  const r = await api(`/billing/invoices/${id}/record`, { method: 'POST', body: JSON.stringify({ invoice_no, invoice_date, taxable_amount, gst_amount, total_amount }) });
  if (!r) return; closeModal(); showToast(`Invoice ${invoice_no} recorded — DCs billed.`); btRender();
}
async function btSubmissionSave(id) {
  const g = x => document.getElementById(x)?.value || null;
  const r = await api(`/billing/invoices/${id}/submission`, { method: 'POST', body: JSON.stringify({
    email_date: g('se-email'), portal_date: g('se-portal'), hardcopy_date: g('se-hard'), submitted_date: g('se-sub'), remarks: g('se-remarks'),
  }) });
  if (!r) return; closeModal(); showToast(`Submission updated — ${r.submission_status}.`); btRender();
}
async function btCancelInvoice(id) {
  const r = await api(`/billing/invoices/${id}/cancel`, { method: 'POST', body: '{}' });
  if (!r) return; closeModal(); showToast('Draft cancelled — DCs released.'); btRender();
}
