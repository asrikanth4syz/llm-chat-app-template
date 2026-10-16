// ============================================================================
// Quotations (milestone 006, Slice 7) — the entitlement-gated SPA surface.
//
// Backend: /api/quotes/* (list/detail/calc/create/submit/approve/reject/send/
// accept/lost/document/today/bell/followups/snooze) + /api/admin/quote-* (config).
// Entitlement: the nav tile + the `quotations` page appear only when
// /api/quotes/access reports enabled (loadQuoteAccess in core). The admin surface
// `quote_admin` is role-gated (super_admin/ops_admin) and configures entitlement.
//
// CSP-safe: no inline JS — every interactive handler is a top-level global wired
// through the delegation helpers (dataAct / dataChangeVal / dataInputVal), so the
// smoke test's "all delegated targets resolve" check covers this file.
//
// All money is integer paise server-side; this module only formats and collects
// rupee inputs (× 100 → paise, % → basis points) and never does money math.
// ============================================================================

// ── Shared formatting / small helpers ───────────────────────────────────────
function qMoney(paise) {
  const n = Number(paise);
  if (!Number.isFinite(n)) return '—';
  const neg = n < 0, a = Math.abs(Math.round(n));
  return (neg ? '-' : '') + '₹' + Math.floor(a / 100).toLocaleString('en-IN') + '.' + String(a % 100).padStart(2, '0');
}
const QUOTE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'LOST', 'EXPIRED'];
// Map a quote status to one of the app's semantic badge classes + a human label.
const QUOTE_STATUS_META = {
  DRAFT: ['badge-secondary', 'Draft'], PENDING_APPROVAL: ['badge-warning', 'Pending approval'],
  APPROVED: ['badge-info', 'Approved'], SENT: ['badge-primary', 'Sent'],
  ACCEPTED: ['badge-success', 'Accepted'], LOST: ['badge-danger', 'Lost'], EXPIRED: ['badge-secondary', 'Expired'],
};
function qBadge(s) {
  const [cls, label] = QUOTE_STATUS_META[s] || ['badge-secondary', s || '—'];
  return `<span class="badge ${cls}">${h(label)}</span>`;
}
// A titled card with the app's header/body chrome and optional header actions.
function qCard(title, bodyHtml, actionsHtml = '') {
  return `<div class="card">
    <div class="card-header"><span class="card-title">${h(title)}</span>${actionsHtml ? `<div class="page-actions">${actionsHtml}</div>` : ''}</div>
    <div class="card-body">${bodyHtml}</div>
  </div>`;
}
// A single labelled form field (picks up the app's .form-field input styling).
function qField(label, inputHtml, hint = '') {
  return `<div class="form-field"><label>${h(label)}</label>${inputHtml}${hint ? `<span class="form-hint">${h(hint)}</span>` : ''}</div>`;
}
function qRole() { return (APP.quoteAccess && APP.quoteAccess.quoteRole) || null; }
// sales, commercial_manager and finance may author/send/close (super_admin resolves
// to commercial_manager server-side). ops is view + follow-up only.
const qCanCreate = () => ['sales', 'commercial_manager', 'finance'].includes(qRole());
const qCanSend = () => ['sales', 'commercial_manager', 'finance'].includes(qRole());
const qCanAcceptLost = () => ['sales', 'commercial_manager', 'finance'].includes(qRole());
// A role approves exactly its own leg (fallback-approver edge handled server-side).
function qMyLeg() { return qRole() === 'commercial_manager' ? 'manager' : (qRole() === 'finance' ? 'finance' : null); }

function qState() { return (APP._q = APP._q || { tab: 'list', view: 'list', statusFilter: '', quoteId: null, editor: null, clients: [] }); }
function qMain() { return document.getElementById('main-content'); }

// ── Page entry + tabs ────────────────────────────────────────────────────────
function renderQuotations(main) {
  const q = qState();
  const roleLabel = (qRole() || '—').replace(/_/g, ' ');
  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Quotations</div>
        <div class="page-subtitle">Create, approve and track customer quotes · your role: <b>${h(roleLabel)}</b></div>
      </div>
      <div class="page-actions">
        <div class="q-tabs" role="tablist">
          <button class="q-tab ${q.tab === 'list' ? 'active' : ''}" role="tab" ${dataAct('quoteGoTab', 'list')}>Quotes</button>
          <button class="q-tab ${q.tab === 'today' ? 'active' : ''}" role="tab" ${dataAct('quoteGoTab', 'today')}>Today</button>
        </div>
        ${qCanCreate() ? `<button class="btn btn-gold" ${dataAct('quoteNewEditor')}>${iconPlus(14)} New quote</button>` : ''}
      </div>
    </div>
    <div id="quote-body"><div class="loading-state"><div class="spinner"></div><p>Loading…</p></div></div>`;
  if (q.tab === 'today') return quoteRenderToday();
  return quoteRenderList();
}
function quoteGoTab(tab) { const q = qState(); q.tab = tab; q.view = 'list'; q.quoteId = null; q.editor = null; renderQuotations(qMain()); }

// ── List ──────────────────────────────────────────────────────────────────────
async function quoteRenderList() {
  const q = qState();
  const body = document.getElementById('quote-body'); if (!body) return;
  const qs = q.statusFilter ? `?status=${encodeURIComponent(q.statusFilter)}` : '';
  const data = await api('/quotes' + qs);
  if (!data) { body.innerHTML = `<div class="card">Could not load quotes.</div>`; return; }
  q.listRows = (data.quotes || data || []);
  const query = (q.listQuery || '').trim().toLowerCase();
  const rows = query ? q.listRows.filter(r =>
    (r.quote_no || '').toLowerCase().includes(query) || (r.client_id || '').toLowerCase().includes(query)) : q.listRows;
  const chip = (s, label) => `<button class="btn btn-sm ${q.statusFilter === s ? 'btn-primary' : 'btn-secondary'}" ${dataAct('quoteSetStatus', s)}>${h(label)}</button>`;
  const filterChips = chip('', 'All') + ' ' + QUOTE_STATUSES.map(s => chip(s, (QUOTE_STATUS_META[s] || [, s])[1])).join(' ');
  const emptyMsg = query ? `No quotes match “${h(q.listQuery)}”.` : (q.statusFilter ? `No ${h((QUOTE_STATUS_META[q.statusFilter] || [, q.statusFilter])[1].toLowerCase())} quotes.` : 'No quotes yet.');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${filterChips}</div>
      <div class="q-search">
        <input id="q-list-search" ${dataInputVal('quoteListSearch')} value="${h(q.listQuery || '')}" placeholder="Search quote # or client…" autocomplete="off">
        <button type="button" class="q-clear" ${dataAct('quoteListClearSearch')} title="Clear search" aria-label="Clear search">✕</button>
      </div>
    </div>
    ${rows.length === 0 ? `<div class="card"><div class="empty-state empty-sm"><div class="empty-icon">📄</div><div class="empty-title">${emptyMsg}</div>${qCanCreate() && !query && !q.statusFilter ? `<div class="empty-desc">Start by creating your first quote.</div><button class="btn btn-gold" ${dataAct('quoteNewEditor')}>${iconPlus(14)} New quote</button>` : ''}</div></div>` : `
    <div class="card" style="padding:0"><div class="table-wrap">
      <table class="data-table" style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:11px 14px">Quote #</th><th style="text-align:left;padding:11px 14px">Client</th>
          <th style="text-align:left;padding:11px 14px">Status</th><th style="text-align:right;padding:11px 14px">Grand total</th>
          <th style="text-align:left;padding:11px 14px">Valid until</th>
        </tr></thead>
        <tbody id="q-list-rows">${quoteListRowsHtml(rows)}</tbody>
      </table>
    </div></div>`}`;
}
function quoteSetStatus(s) { const q = qState(); q.statusFilter = s; quoteRenderList(); }
// Client-side filter over the already-loaded page of quotes (no refetch), so the
// results update as you type. The X button clears the text and the filter.
function quoteListApplyFilter() {
  const q = qState(); const query = (q.listQuery || '').trim().toLowerCase();
  const rows = query ? (q.listRows || []).filter(r =>
    (r.quote_no || '').toLowerCase().includes(query) || (r.client_id || '').toLowerCase().includes(query)) : (q.listRows || []);
  const host = document.getElementById('q-list-rows');
  if (host) host.innerHTML = quoteListRowsHtml(rows);
}
function quoteListSearch(val) { qState().listQuery = val; quoteListApplyFilter(); }
function quoteListClearSearch() {
  const q = qState(); q.listQuery = '';
  const inp = document.getElementById('q-list-search'); if (inp) { inp.value = ''; inp.focus(); }
  quoteRenderList();
}
// Rows only (no <tbody> wrapper) — the caller supplies the tbody so this can be
// dropped straight into tbody.innerHTML on live filter.
function quoteListRowsHtml(rows) {
  if (!rows.length) return `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text-muted)">No quotes match.</td></tr>`;
  return rows.map(r => `
    <tr style="cursor:pointer;border-top:1px solid var(--border)" ${dataAct('quoteOpenDetail', r.id)}>
      <td style="padding:11px 14px;font-weight:700;color:var(--navy)">${h(r.quote_no || r.id)}</td>
      <td style="padding:11px 14px">${h(r.client_id || '')}</td>
      <td style="padding:11px 14px">${qBadge(r.status)}</td>
      <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums">${qMoney(r.grand_total_paise)}</td>
      <td style="padding:11px 14px">${h(r.valid_until || '—')}</td>
    </tr>`).join('');
}

// ── Detail ─────────────────────────────────────────────────────────────────────
async function quoteOpenDetail(id) {
  const q = qState(); q.view = 'detail'; q.quoteId = id;
  const main = qMain();
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;
  const d = await api('/quotes/' + id);
  if (!d) { main.innerHTML = `<div class="card">Could not load the quote.</div>`; return; }
  q.detail = d;
  quoteRenderDetail();
}
function quoteRenderDetail() {
  const q = qState(); const d = q.detail; const main = qMain(); if (!d) return;
  const t = (d.version && d.version.payload && d.version.payload.totals) || {};
  const lines = d.lines || [];
  const showCost = lines.some(l => l.landed_cost_paise != null || l.line_margin_paise != null);
  const actions = [];
  const st = d.status;
  if (st === 'DRAFT' && qCanCreate()) {
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteEditDraft', d.id)}>Edit</button>`);
    actions.push(`<button class="btn btn-primary" data-busy="Submitting…" ${dataAct('quoteSubmit', d.id)}>Submit for approval</button>`);
  }
  if (st === 'PENDING_APPROVAL' && qMyLeg()) {
    actions.push(`<button class="btn btn-success" data-busy="Approving…" ${dataAct('quoteApprove', d.id, qMyLeg())}>Approve ${h(qMyLeg())} leg</button>`);
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteRejectPrompt', d.id, qMyLeg())}>Reject…</button>`);
  }
  if (st === 'APPROVED' && qCanSend()) actions.push(`<button class="btn btn-gold" data-busy="Sending…" ${dataAct('quoteSend', d.id)}>Send to customer</button>`);
  if (st === 'SENT') {
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteViewDocument', d.id)}>View document</button>`);
    if (qCanAcceptLost()) {
      actions.push(`<button class="btn btn-success" data-busy="…" ${dataAct('quoteAccept', d.id)}>Mark accepted</button>`);
      actions.push(`<button class="btn btn-danger" ${dataAct('quoteLostPrompt', d.id)}>Mark lost…</button>`);
    }
  }
  actions.push(`<button class="btn btn-secondary" ${dataAct('quoteFollowupPrompt', d.id)}>Log follow-up</button>`);

  const taxRows = t.igst_total
    ? `<div class="q-row"><span>IGST</span><span class="q-amt">${qMoney(t.igst_total)}</span></div>`
    : `<div class="q-row"><span>CGST</span><span class="q-amt">${qMoney(t.cgst_total)}</span></div><div class="q-row"><span>SGST</span><span class="q-amt">${qMoney(t.sgst_total)}</span></div>`;

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-secondary btn-sm" style="margin-bottom:8px" ${dataAct('quoteBackToList')}>← All quotes</button>
        <div class="page-title" style="display:flex;align-items:center;gap:10px">${h(d.quote_no || d.id)} ${qBadge(st)}</div>
      </div>
      <div class="page-actions">${actions.join(' ')}</div>
    </div>
    ${qCard('Quote details', `<dl class="q-meta">
      <div><dt>Client</dt><dd>${h(d.client_id)}</dd></div>
      <div><dt>Place of supply</dt><dd>${h(d.place_of_supply || '—')}</dd></div>
      <div><dt>Version</dt><dd>v${d.current_version}</dd></div>
      <div><dt>Valid until</dt><dd>${h(d.valid_until || '—')}</dd></div>
      <div><dt>ITC claimable</dt><dd>${d.itc_claimable_all ? 'Yes (all lines)' : 'No'}</dd></div>
    </dl>`)}
    ${qCard('Line items', `
      <div class="table-wrap">
      <table class="data-table" style="width:100%;border-collapse:collapse;font-size:.84rem">
        <thead><tr>
          <th style="text-align:left;padding:8px 10px">#</th><th style="text-align:left;padding:8px 10px">Item</th>
          <th style="text-align:right;padding:8px 10px">Qty</th><th style="text-align:right;padding:8px 10px">Unit price</th>
          <th style="text-align:right;padding:8px 10px">GST</th><th style="text-align:right;padding:8px 10px">Taxable</th>
          ${showCost ? '<th style="text-align:right;padding:8px 10px">Landed</th><th style="text-align:right;padding:8px 10px">Margin</th>' : ''}
        </tr></thead>
        <tbody>${lines.map((l, i) => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;color:var(--text-muted)">${i + 1}</td>
          <td style="padding:8px 10px;font-weight:600">${h(l.description || l.sku || 'Item')}</td>
          <td style="padding:8px 10px;text-align:right">${l.qty}</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(l.unit_price_paise)}</td>
          <td style="padding:8px 10px;text-align:right">${((l.sale_gst_bp || 0) / 100).toFixed(0)}%</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(l.line_taxable_paise)}</td>
          ${showCost ? `<td style="padding:8px 10px;text-align:right">${qMoney(l.landed_cost_paise)}</td><td style="padding:8px 10px;text-align:right">${qMoney(l.line_margin_paise)}</td>` : ''}
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="q-summary" style="margin-top:14px">
        <div class="q-row"><span>Subtotal</span><span class="q-amt">${qMoney(t.subtotal_paise)}</span></div>
        ${taxRows}
        <div class="q-row"><span>Round off</span><span class="q-amt">${qMoney(t.round_off_paise)}</span></div>
        <div class="q-row q-grand"><span>Grand total</span><span>${qMoney(t.grand_total_paise != null ? t.grand_total_paise : d.grand_total_paise)}</span></div>
      </div>`)}
    ${qCard('Activity', `
      <div class="form-hint" style="margin-bottom:10px">Integrity hash: <code style="font-size:.78rem">${h((d.version && d.version.content_hash) || '—')}</code></div>
      ${(d.audit || []).length ? (d.audit || []).map(a => `<div class="q-item-row">
        <div class="q-item-main"><div class="q-item-title">${h(a.action.replace(/_/g, ' '))}</div>
          <div class="q-item-meta"><span>#${a.seq}</span><span>·</span><span>${h(a.actor_id)}</span></div></div>
        <div class="q-item-meta">${h(a.created_at || '')}</div>
      </div>`).join('') : '<div class="form-hint">No activity yet.</div>'}`)}`;
}
function quoteBackToList() { const q = qState(); q.view = 'list'; q.quoteId = null; renderQuotations(qMain()); }

// ── Lifecycle actions (all async → the dispatcher locks the button) ───────────
async function quoteReload(id) { const d = await api('/quotes/' + id); if (d) { qState().detail = d; quoteRenderDetail(); } }
async function quoteSubmit(id) {
  const r = await api('/quotes/' + id + '/submit', { method: 'POST', body: '{}' });
  if (r) { showToast(r.status === 'APPROVED' ? 'Submitted — auto-approved' : 'Submitted for approval'); await quoteReload(id); }
}
async function quoteApprove(id, leg) {
  const r = await api('/quotes/' + id + '/approve', { method: 'POST', body: JSON.stringify({ leg }) });
  if (r) { showToast(r.quote_status === 'APPROVED' ? 'Approved — quote is APPROVED' : 'Leg approved'); await quoteReload(id); if (window.quoteRefreshBell) quoteRefreshBell(); }
}
async function quoteSend(id) {
  const r = await api('/quotes/' + id + '/send', { method: 'POST', body: '{}' });
  if (r) { showToast('Sent to customer'); await quoteReload(id); }
}
async function quoteAccept(id) {
  const r = await api('/quotes/' + id + '/accept', { method: 'POST', body: '{}' });
  if (r) { showToast('Marked accepted'); await quoteReload(id); }
}
function quoteRejectPrompt(id, leg) {
  openModal('Reject quote', `<div class="form-field">
      <label>Reason / comments (required)</label>
      <textarea id="q-reject-note" rows="3" placeholder="Why is this rejected?"></textarea>
    </div>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('quoteRejectDo', id, leg)}>Reject</button>`);
}
async function quoteRejectDo(id, leg) {
  const comments = (document.getElementById('q-reject-note')?.value || '').trim();
  if (!comments) { showToast('A reason is required', 'error'); return; }
  const r = await api('/quotes/' + id + '/reject', { method: 'POST', body: JSON.stringify({ leg, comments }) });
  if (r) { closeModal(); showToast('Rejected — back to DRAFT'); await quoteReload(id); }
}
function quoteLostPrompt(id) {
  openModal('Mark quote lost', `<div class="form-field">
      <label>Reason (required)</label>
      <textarea id="q-lost-note" rows="3" placeholder="Why was this lost?"></textarea>
    </div>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-danger" ${dataAct('quoteLostDo', id)}>Mark lost</button>`);
}
async function quoteLostDo(id) {
  const reason = (document.getElementById('q-lost-note')?.value || '').trim();
  if (!reason) { showToast('A reason is required', 'error'); return; }
  const r = await api('/quotes/' + id + '/lost', { method: 'POST', body: JSON.stringify({ reason }) });
  if (r) { closeModal(); showToast('Marked lost'); await quoteReload(id); }
}
function quoteFollowupPrompt(id) {
  openModal('Log follow-up', `
    <div class="form-field"><label>Channel</label>
      <select id="q-fu-channel"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select></div>
    <div class="form-field"><label>Note</label><textarea id="q-fu-note" rows="2" placeholder="What happened / next step"></textarea></div>
    <div class="form-field"><label>Next action date (optional)</label><input id="q-fu-date" type="date"></div>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('quoteFollowupDo', id)}>Save</button>`);
}
async function quoteFollowupDo(id) {
  const channel = document.getElementById('q-fu-channel')?.value || 'note';
  const note = (document.getElementById('q-fu-note')?.value || '').trim();
  const nad = document.getElementById('q-fu-date')?.value || null;
  const r = await api('/quotes/' + id + '/followups', { method: 'POST', body: JSON.stringify({ channel, note, next_action_date: nad || undefined }) });
  if (r) { closeModal(); showToast('Follow-up logged'); if (qState().tab === 'today') quoteRenderToday(); if (window.quoteRefreshBell) quoteRefreshBell(); }
}
async function quoteViewDocument(id) {
  const r = await api('/quotes/' + id + '/document');
  if (!r) return;
  let html = ''; try { html = decodeURIComponent(escape(atob(r.content_b64))); } catch { try { html = atob(r.content_b64); } catch { html = '<p>Could not decode document.</p>'; } }
  openModal('Customer document', `<div style="max-height:60vh;overflow:auto;border:1px solid var(--border,#ddd);padding:10px">${html}</div>
    <div class="text-muted" style="font-size:11px;margin-top:8px">Integrity hash: <code>${h(r.content_hash || '')}</code></div>`,
    `<button class="btn btn-primary" ${dataActClose('noop')}>Close</button>`);
}
function noop() { /* modal cancel */ }

// ── Editor (new quote) ─────────────────────────────────────────────────────────
function quoteBlankLine() { return { pricing_mode: 'cost_markup', description: '', qty: 1, purchase_cost: '', markup_pct: '', mrp: '', discount_pct: '', sale_gst_pct: '18', itc_claimable: true }; }
async function quoteNewEditor() {
  const q = qState(); q.view = 'editor';
  q.editor = { editId: null, client_id: '', place_of_supply: '', valid_until: '', lines: [quoteBlankLine()], preview: null };
  const main = qMain();
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading clients…</p></div>`;
  const clients = await api('/clients');
  q.clients = Array.isArray(clients) ? clients : [];
  quoteRenderEditor();
}
// Open the editor on an existing DRAFT — maps stored line fields back to the
// rupee/percent form so the operator can amend and re-save (PUT → new version).
async function quoteEditDraft(id) {
  const q = qState(); q.view = 'editor';
  const main = qMain();
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;
  const d = (q.detail && q.detail.id === id) ? q.detail : await api('/quotes/' + id);
  if (!d) { main.innerHTML = `<div class="card"><div class="card-body">Could not load the quote.</div></div>`; return; }
  const toRupee = (p) => (p == null ? '' : (Number(p) / 100));
  const toPct = (bp) => (bp == null ? '' : (Number(bp) / 100));
  const lines = (d.lines || []).map(l => ({
    pricing_mode: l.pricing_mode || 'cost_markup',
    description: l.description || '', qty: l.qty || 1,
    purchase_cost: toRupee(l.purchase_cost_paise), markup_pct: toPct(l.markup_bp),
    mrp: toRupee(l.mrp_paise), discount_pct: toPct(l.discount_bp),
    sale_gst_pct: toPct(l.sale_gst_bp) || '0', itc_claimable: !!l.itc_claimable,
  }));
  q.editor = { editId: id, quoteNo: d.quote_no, client_id: d.client_id, place_of_supply: d.place_of_supply || '',
    valid_until: d.valid_until || '', lines: lines.length ? lines : [quoteBlankLine()], preview: null };
  const clients = await api('/clients');
  q.clients = Array.isArray(clients) ? clients : [];
  quoteRenderEditor();
}
function quoteRenderEditor() {
  const q = qState(); const e = q.editor; const main = qMain(); if (!e) return;
  const editing = !!e.editId;
  const clientOpts = ['<option value="">— select client —</option>', ...q.clients.map(c => `<option value="${h(c.id)}" ${e.client_id === c.id ? 'selected' : ''}>${h(c.name || c.id)}</option>`)].join('');
  const gt = e.preview && e.preview.totals ? qMoney(e.preview.totals.grand_total_paise) : '—';
  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-secondary btn-sm" style="margin-bottom:8px" ${editing ? dataAct('quoteOpenDetail', e.editId) : dataAct('quoteBackToList')}>← ${editing ? 'Back to quote' : 'All quotes'}</button>
        <div class="page-title">${editing ? 'Edit quote ' + h(e.quoteNo || '') : 'New quote'}</div>
        <div class="page-subtitle">${editing ? 'Editing a draft adds a new immutable version.' : 'Add line items, preview the price, then save as a draft.'}</div>
      </div>
    </div>
    ${qCard('Quote details', `<div class="form-row" style="margin-bottom:0">
      ${qField('Client', `<select ${editing ? 'disabled' : ''} ${dataChangeVal('quoteEditHeader', 'client_id')}>${clientOpts}</select>`, editing ? 'Client is fixed on an existing quote' : '')}
      ${qField('Place of supply', `<input maxlength="2" value="${h(e.place_of_supply)}" ${dataInputVal('quoteEditHeader', 'place_of_supply')} placeholder="State code, e.g. KL">`, 'Decides CGST/SGST vs IGST')}
      ${qField('Valid until', `<input type="date" value="${h(e.valid_until)}" ${dataChangeVal('quoteEditHeader', 'valid_until')}>`, 'Optional — defaults from settings')}
    </div>`)}
    ${qCard('Line items', `<div id="q-lines">${e.lines.map((l, i) => quoteLineHtml(l, i)).join('')}</div>`,
      `<button class="btn btn-secondary btn-sm" ${dataAct('quoteEditAddLine')}>${iconPlus(12)} Add line</button>`)}
    ${qCard('Pricing summary', `<div id="q-preview">${e.preview ? quotePreviewHtml(e.preview) : '<div class="empty-state empty-sm"><div class="empty-icon">🧮</div><div class="empty-title">No preview yet</div><div class="empty-desc">Use “Preview price” to compute GST, round-off and margin.</div></div>'}</div>`)}
    <div class="q-actionbar">
      <div class="q-actionbar-total">Grand total <b id="q-actionbar-total">${gt}</b></div>
      <div class="q-actionbar-btns">
        <button class="btn btn-secondary" ${editing ? dataAct('quoteOpenDetail', e.editId) : dataAct('quoteBackToList')}>Cancel</button>
        <button class="btn btn-secondary" data-busy="Pricing…" ${dataAct('quoteEditPreview')}>Preview price</button>
        <button class="btn btn-gold" data-busy="Saving…" ${dataAct('quoteEditSave')}>${editing ? 'Save changes' : 'Save draft'}</button>
      </div>
    </div>`;
}
function quoteLineHtml(l, i) {
  const cm = l.pricing_mode === 'cost_markup';
  const canRemove = (qState().editor.lines.length > 1);
  return `<div class="q-line">
    <div class="q-line-head">
      <span class="q-line-no">Line ${i + 1}</span>
      ${canRemove ? `<button class="btn btn-danger btn-sm" ${dataAct('quoteEditRemoveLine', i)}>Remove</button>` : ''}
    </div>
    <div class="form-row">
      ${qField('Description', `<input value="${h(l.description)}" ${dataInputVal('quoteEditLine', i, 'description')} placeholder="Item description">`)}
      ${qField('Qty', `<input type="number" min="1" step="1" value="${h(l.qty)}" ${dataInputVal('quoteEditLine', i, 'qty')}>`)}
      ${qField('Pricing method', `<select ${dataChangeVal('quoteEditLine', i, 'pricing_mode')}>
        <option value="cost_markup" ${cm ? 'selected' : ''}>Cost + markup</option>
        <option value="mrp_discount" ${!cm ? 'selected' : ''}>MRP − discount</option></select>`)}
      ${cm
        ? qField('Purchase cost (₹)', `<input type="number" min="0" step="0.01" value="${h(l.purchase_cost)}" ${dataInputVal('quoteEditLine', i, 'purchase_cost')}>`) +
          qField('Markup %', `<input type="number" min="0" step="0.01" value="${h(l.markup_pct)}" ${dataInputVal('quoteEditLine', i, 'markup_pct')}>`)
        : qField('MRP (₹)', `<input type="number" min="0" step="0.01" value="${h(l.mrp)}" ${dataInputVal('quoteEditLine', i, 'mrp')}>`) +
          qField('Discount %', `<input type="number" min="0" step="0.01" value="${h(l.discount_pct)}" ${dataInputVal('quoteEditLine', i, 'discount_pct')}>`)}
      ${qField('GST %', `<input type="number" min="0" step="1" value="${h(l.sale_gst_pct)}" ${dataInputVal('quoteEditLine', i, 'sale_gst_pct')}>`)}
      ${qField('ITC', `<label style="display:inline-flex;align-items:center;gap:7px;font-weight:500;font-size:.84rem;padding-top:6px;cursor:pointer">
        <input type="checkbox" style="width:auto" ${l.itc_claimable ? 'checked' : ''} ${dataChangeEl('quoteEditLineItc', i)}> Claimable</label>`)}
    </div>
  </div>`;
}
function quotePreviewHtml(p) {
  const t = p.totals || {};
  const taxRows = t.igst_total
    ? `<div class="q-row"><span>IGST</span><span class="q-amt">${qMoney(t.igst_total)}</span></div>`
    : `<div class="q-row"><span>CGST</span><span class="q-amt">${qMoney(t.cgst_total)}</span></div><div class="q-row"><span>SGST</span><span class="q-amt">${qMoney(t.sgst_total)}</span></div>`;
  return `<div class="q-summary">
    <div class="q-row"><span>Subtotal</span><span class="q-amt">${qMoney(t.subtotal_paise)}</span></div>
    ${taxRows}
    <div class="q-row"><span>Round off</span><span class="q-amt">${qMoney(t.round_off_paise)}</span></div>
    <div class="q-row q-grand"><span>Grand total</span><span>${qMoney(t.grand_total_paise)}</span></div>
  </div>`;
}
function quoteEditHeader(field, val) { const e = qState().editor; if (e) e[field] = val; }
function quoteEditLine(i, field, val) {
  const e = qState().editor; if (!e || !e.lines[i]) return;
  e.lines[i][field] = val;
  if (field === 'pricing_mode') quoteRenderEditor();   // swap the cost/mrp fields
}
function quoteEditLineItc(i, el) { const e = qState().editor; if (e && e.lines[i]) e.lines[i].itc_claimable = !!el.checked; }
function quoteEditAddLine() { const e = qState().editor; if (e) { e.lines.push(quoteBlankLine()); quoteRenderEditor(); } }
function quoteEditRemoveLine(i) { const e = qState().editor; if (e && e.lines.length > 1) { e.lines.splice(i, 1); quoteRenderEditor(); } }

// Build the server payload from the rupee/percent form (× 100 → paise, % → bp).
function quoteBuildPayload() {
  const e = qState().editor;
  const rupee = (v) => Math.round(Number(v || 0) * 100);
  const bp = (v) => Math.round(Number(v || 0) * 100);
  const lines = e.lines.map(l => {
    const base = { description: l.description || null, qty: Math.round(Number(l.qty || 0)), pricing_mode: l.pricing_mode, sale_gst_bp: bp(l.sale_gst_pct), itc_claimable: !!l.itc_claimable };
    if (l.pricing_mode === 'cost_markup') return { ...base, purchase_cost_paise: rupee(l.purchase_cost), markup_bp: bp(l.markup_pct) };
    return { ...base, mrp_paise: rupee(l.mrp), discount_bp: bp(l.discount_pct) };
  });
  return { client_id: e.client_id, place_of_supply: (e.place_of_supply || '').toUpperCase(), valid_until: e.valid_until || undefined, lines };
}
async function quoteEditPreview() {
  const e = qState().editor; if (!e.client_id) { showToast('Pick a client first', 'error'); return; }
  const r = await api('/quotes/calc', { method: 'POST', body: JSON.stringify(quoteBuildPayload()) });
  if (r) {
    e.preview = r;
    const pv = document.getElementById('q-preview'); if (pv) pv.innerHTML = quotePreviewHtml(r);
    const bt = document.getElementById('q-actionbar-total'); if (bt) bt.textContent = qMoney(r.totals.grand_total_paise);
  }
}
async function quoteEditSave() {
  const e = qState().editor; if (!e.client_id) { showToast('Pick a client first', 'error'); return; }
  const r = e.editId
    ? await api('/quotes/' + e.editId, { method: 'PUT', body: JSON.stringify(quoteBuildPayload()) })
    : await api('/quotes', { method: 'POST', body: JSON.stringify(quoteBuildPayload()) });
  if (r && (r.id || e.editId)) { showToast(e.editId ? 'Changes saved' : 'Draft saved'); quoteOpenDetail(e.editId || r.id); }
}

// ── Today ────────────────────────────────────────────────────────────────────
async function quoteRenderToday() {
  const body = document.getElementById('quote-body'); if (!body) return;
  const d = await api('/quotes/today');
  if (!d) { body.innerHTML = `<div class="card"><div class="card-body">Could not load Today.</div></div>`; return; }
  // A section card: title + count badge in the header, item rows (or an empty state) in the body.
  const sec = (title, icon, items, emptyText, render) => `<div class="card">
    <div class="card-header"><span class="card-title">${icon} ${h(title)}</span><span class="badge ${items.length ? 'badge-primary' : 'badge-secondary'}">${items.length}</span></div>
    <div class="card-body" style="padding-top:4px;padding-bottom:4px">
      ${items.length ? items.map(render).join('') : `<div class="empty-state empty-sm"><div class="empty-title" style="font-weight:500;color:var(--text-muted)">${h(emptyText)}</div></div>`}
    </div></div>`;
  const row = (title, metaHtml, actionsHtml) => `<div class="q-item-row">
    <div class="q-item-main"><div class="q-item-title">${title}</div><div class="q-item-meta">${metaHtml}</div></div>
    <div class="q-item-actions">${actionsHtml}</div></div>`;
  body.innerHTML =
    sec('Due reminders', '⏰', d.due_reminders || [], 'No reminders due today.', r =>
      row(h(r.quote_no || r.quote_id),
        `<span class="badge badge-warning">${h(r.rule)}</span><span>due ${h(r.due_date)}</span>`,
        `<button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', r.quote_id)}>Open</button>
         <button class="btn btn-secondary btn-sm" ${dataAct('quoteSnoozePrompt', r.quote_id, r.id)}>Snooze</button>`)) +
    sec('Follow-ups due', '📞', d.followups_due || [], 'No follow-ups due today.', f =>
      row(h(f.quote_no || f.quote_id),
        `<span class="badge badge-info">${h(f.channel)}</span><span>${h(f.next_action_date)}</span>${f.note ? `<span>· ${h(f.note)}</span>` : ''}`,
        `<button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', f.quote_id)}>Open</button>`)) +
    sec('Expiring soon', '⌛', d.expiring || [], 'Nothing expiring in the window.', qq =>
      row(h(qq.quote_no || qq.id),
        `<span>valid until ${h(qq.valid_until)}</span>`,
        `<button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', qq.id)}>Open</button>`));
}
function quoteSnoozePrompt(id, rid) {
  openModal('Snooze reminder', `<div class="form-field"><label>Snooze until</label><input id="q-snooze-date" type="date"></div>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('quoteSnoozeDo', id, rid)}>Snooze</button>`);
}
async function quoteSnoozeDo(id, rid) {
  const until = document.getElementById('q-snooze-date')?.value;
  if (!until) { showToast('Pick a date', 'error'); return; }
  const r = await api('/quotes/' + id + '/reminders/' + rid + '/snooze', { method: 'POST', body: JSON.stringify({ until }) });
  if (r) { closeModal(); showToast('Snoozed'); quoteRenderToday(); }
}

// ── Bell badge (quotations tile) ───────────────────────────────────────────────
async function quoteRefreshBell() {
  if (!(APP.quoteAccess && APP.quoteAccess.enabled)) return;
  const r = await api('/quotes/bell').catch(() => null);
  const el = document.getElementById('nav-quotations'); if (!el) return;
  let badge = el.querySelector('.nav-item-badge');
  const n = r && r.count ? r.count : 0;
  if (n > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'nav-item-badge'; badge.setAttribute('aria-hidden', 'true'); el.appendChild(badge); }
    badge.textContent = n > 99 ? '99+' : String(n);
  } else if (badge) { badge.remove(); }
}

// ── Admin: entitlement + settings (role-gated: super_admin / ops_admin) ─────────
async function renderQuoteAdmin(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>`;
  const [acc, settings] = await Promise.all([api('/admin/quote-access'), api('/admin/quote-settings')]);
  if (!acc || !settings) { main.innerHTML = `<div class="card">Could not load quote configuration.</div>`; return; }
  APP._qadmin = { ver: acc._ver, settings, users: acc.users || [], enabled: acc.enabled || {}, q: '' };
  const s = settings;
  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <div class="page-title">Quote Access &amp; Settings</div>
        <div class="page-subtitle">Assign who can use Quotations and their quote-role.</div>
      </div>
    </div>
    ${acc.fallback_valid === false ? `<div class="card" style="border-left:3px solid var(--danger)"><div class="card-body" style="color:var(--danger);font-weight:600;font-size:.85rem">⚠ The configured fallback approver is no longer an entitled approver — update it in Settings below.</div></div>` : ''}
    <div class="card">
      <div class="card-header"><span class="card-title">Entitled users</span>
        <div class="q-search">
          <input id="qa-search" ${dataInputVal('quoteAdminSearch')} placeholder="Find a user by name or email…" autocomplete="off">
          <button type="button" class="q-clear" ${dataAct('quoteAdminClearSearch')} title="Clear search" aria-label="Clear search">✕</button>
        </div>
      </div>
      <div class="card-body" style="padding:0"><div id="qa-users">${quoteAdminUsersHtml()}</div></div>
    </div>
    ${qCard('Settings', `<div class="form-row">
      ${qField('Seller state code', `<input id="qs-seller" maxlength="2" value="${h(s.seller_state_code || '')}" placeholder="e.g. KL">`)}
      ${qField('Default validity (days)', `<input id="qs-validity" type="number" min="1" value="${s.default_validity_days}">`)}
      ${qField('Approval threshold (₹)', `<input id="qs-threshold" type="number" min="0" value="${Math.round((s.approval_threshold_paise || 0) / 100)}">`, 'Finance leg required at/above this')}
      ${qField('Expiring window (days)', `<input id="qs-expwin" type="number" min="0" value="${s.expiring_window_days}">`)}
      ${qField('Number prefix', `<input id="qs-prefix" value="${h(s.number_prefix || '')}">`)}
      ${qField('Fallback approver (user id)', `<input id="qs-fallback" value="${h(s.fallback_approver_id || '')}" placeholder="optional">`)}
      ${qField('R1 — send + days', `<input id="qs-r1" type="number" min="0" value="${s.reminder_rules.R1_send_plus_days}">`)}
      ${qField('R2 — send + days', `<input id="qs-r2" type="number" min="0" value="${s.reminder_rules.R2_send_plus_days}">`)}
      ${qField('R3 — valid − days', `<input id="qs-r3" type="number" min="0" value="${s.reminder_rules.R3_valid_minus_days}">`)}
    </div>
    <div style="margin-top:4px"><button class="btn btn-gold" data-busy="Saving…" ${dataAct('quoteAdminSaveSettings')}>Save settings</button></div>`)}`;
}
// Users table, filtered by the live search query (name / email / id).
function quoteAdminUsersHtml() {
  const st = APP._qadmin || {}; const q = (st.q || '').trim().toLowerCase();
  const enabled = st.enabled || {};
  const roleOpts = (cur) => ['', 'sales', 'ops', 'commercial_manager', 'finance'].map(r =>
    `<option value="${r}" ${cur === r ? 'selected' : ''}>${r || '— none —'}</option>`).join('');
  const users = (st.users || []).filter(u => !q ||
    (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q));
  if (!users.length) return `<div class="empty-state empty-sm"><div class="empty-title" style="font-weight:500;color:var(--text-muted)">No users match “${h(st.q || '')}”.</div></div>`;
  return `<div class="table-wrap"><table class="data-table" style="width:100%;border-collapse:collapse;font-size:.84rem">
    <thead><tr>
      <th style="text-align:left;padding:10px 14px">User</th><th style="text-align:left;padding:10px 14px">App role</th><th style="text-align:left;padding:10px 14px;width:200px">Quote role</th>
    </tr></thead>
    <tbody>${users.map(u => `<tr style="border-top:1px solid var(--border)">
      <td style="padding:10px 14px"><div style="font-weight:600;color:var(--navy)">${h(u.name || u.id)}</div><div class="form-hint">${h(u.email || '')}</div></td>
      <td style="padding:10px 14px">${h(u.role || '')}</td>
      <td style="padding:8px 14px"><div class="form-field" style="gap:0"><select ${dataChangeVal('quoteAdminSetRole', u.id)}>${roleOpts(enabled[u.id] || '')}</select></div></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}
function quoteAdminSearch(val) {
  const st = APP._qadmin; if (!st) return; st.q = val;
  const host = document.getElementById('qa-users'); if (host) host.innerHTML = quoteAdminUsersHtml();
}
function quoteAdminClearSearch() {
  const st = APP._qadmin; if (!st) return; st.q = '';
  const inp = document.getElementById('qa-search'); if (inp) { inp.value = ''; inp.focus(); }
  const host = document.getElementById('qa-users'); if (host) host.innerHTML = quoteAdminUsersHtml();
}
async function quoteAdminSetRole(userId, role) {
  const st = APP._qadmin || {};
  const r = await api('/admin/quote-access', { method: 'PUT', body: JSON.stringify({ userId, quoteRole: role || null, _ver: st.ver }) });
  if (r) {
    st.ver = r._ver;
    st.enabled = st.enabled || {};
    if (role) st.enabled[userId] = role; else delete st.enabled[userId];
    showToast('Access updated');
  } else { renderQuoteAdmin(qMain()); }   // reload to resync _ver on conflict
}
async function quoteAdminSaveSettings() {
  const st = APP._qadmin || {}; const s = st.settings || {};
  const num = (id, d) => { const v = Number(document.getElementById(id)?.value); return Number.isFinite(v) ? v : d; };
  const body = {
    _ver: s._ver || 0,
    seller_state_code: (document.getElementById('qs-seller')?.value || '').toUpperCase(),
    default_validity_days: num('qs-validity', 30),
    approval_threshold_paise: Math.round(num('qs-threshold', 500000) * 100),
    expiring_window_days: num('qs-expwin', 3),
    number_prefix: document.getElementById('qs-prefix')?.value || 'GZ',
    fallback_approver_id: (document.getElementById('qs-fallback')?.value || '').trim() || null,
    reminder_rules: { R1_send_plus_days: num('qs-r1', 2), R2_send_plus_days: num('qs-r2', 7), R3_valid_minus_days: num('qs-r3', 2) },
  };
  const r = await api('/admin/quote-settings', { method: 'PUT', body: JSON.stringify(body) });
  if (r) { showToast('Settings saved'); renderQuoteAdmin(qMain()); }
}
