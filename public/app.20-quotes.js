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
function qStatusColor(s) {
  return ({ DRAFT: 'var(--text-muted)', PENDING_APPROVAL: 'var(--gold,#b45309)', APPROVED: 'var(--navy,#1e3a5f)',
    SENT: '#2563eb', ACCEPTED: 'var(--success,#15803d)', LOST: 'var(--danger,#b91c1c)', EXPIRED: '#6b7280' }[s] || 'var(--text-muted)');
}
function qBadge(s) { return `<span class="chip" style="background:${qStatusColor(s)};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">${h(s || '')}</span>`; }
function qRole() { return (APP.quoteAccess && APP.quoteAccess.quoteRole) || null; }
const qCanCreate = () => ['sales', 'commercial_manager'].includes(qRole());
const qCanSend = () => ['sales', 'commercial_manager'].includes(qRole());
const qCanAcceptLost = () => ['sales', 'commercial_manager'].includes(qRole());
// A role approves exactly its own leg (fallback-approver edge handled server-side).
function qMyLeg() { return qRole() === 'commercial_manager' ? 'manager' : (qRole() === 'finance' ? 'finance' : null); }

function qState() { return (APP._q = APP._q || { tab: 'list', view: 'list', statusFilter: '', quoteId: null, editor: null, clients: [] }); }
function qMain() { return document.getElementById('main-content'); }

// ── Page entry + tabs ────────────────────────────────────────────────────────
function renderQuotations(main) {
  const q = qState();
  main.innerHTML = `
    <div class="page-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div>
        <h1 style="margin:0">Quotations</h1>
        <div class="text-muted" style="font-size:13px">Role: <b>${h(qRole() || '—')}</b></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm ${q.tab === 'list' ? 'btn-primary' : 'btn-secondary'}" ${dataAct('quoteGoTab', 'list')}>Quotes</button>
        <button class="btn btn-sm ${q.tab === 'today' ? 'btn-primary' : 'btn-secondary'}" ${dataAct('quoteGoTab', 'today')}>Today</button>
        ${qCanCreate() ? `<button class="btn btn-sm btn-gold" ${dataAct('quoteNewEditor')}>${iconPlus(13)} New Quote</button>` : ''}
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
  const rows = (data.quotes || data || []);
  const filterChips = ['', ...QUOTE_STATUSES].map(s =>
    `<button class="btn btn-sm ${q.statusFilter === s ? 'btn-primary' : 'btn-secondary'}" ${dataAct('quoteSetStatus', s)}>${s || 'All'}</button>`).join(' ');
  body.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${filterChips}</div>
    ${rows.length === 0 ? `<div class="card" style="text-align:center;padding:30px">No quotes${q.statusFilter ? ' in ' + h(q.statusFilter) : ''} yet.</div>` : `
    <div class="card" style="overflow-x:auto;padding:0">
      <table class="data-table" style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:10px">Quote #</th><th style="text-align:left;padding:10px">Client</th>
          <th style="text-align:left;padding:10px">Status</th><th style="text-align:right;padding:10px">Grand total</th>
          <th style="text-align:left;padding:10px">Valid until</th>
        </tr></thead>
        <tbody>${rows.map(r => `
          <tr style="cursor:pointer;border-top:1px solid var(--border,#e5e7eb)" ${dataAct('quoteOpenDetail', r.id)}>
            <td style="padding:10px;font-weight:600">${h(r.quote_no || r.id)}</td>
            <td style="padding:10px">${h(r.client_id || '')}</td>
            <td style="padding:10px">${qBadge(r.status)}</td>
            <td style="padding:10px;text-align:right">${qMoney(r.grand_total_paise)}</td>
            <td style="padding:10px">${h(r.valid_until || '—')}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`}`;
}
function quoteSetStatus(s) { const q = qState(); q.statusFilter = s; quoteRenderList(); }

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
  if (st === 'DRAFT' && qCanCreate()) actions.push(`<button class="btn btn-primary btn-sm" data-busy="Submitting…" ${dataAct('quoteSubmit', d.id)}>Submit for approval</button>`);
  if (st === 'PENDING_APPROVAL' && qMyLeg()) {
    actions.push(`<button class="btn btn-primary btn-sm" data-busy="Approving…" ${dataAct('quoteApprove', d.id, qMyLeg())}>Approve (${qMyLeg()} leg)</button>`);
    actions.push(`<button class="btn btn-secondary btn-sm" ${dataAct('quoteRejectPrompt', d.id, qMyLeg())}>Reject…</button>`);
  }
  if (st === 'APPROVED' && qCanSend()) actions.push(`<button class="btn btn-gold btn-sm" data-busy="Sending…" ${dataAct('quoteSend', d.id)}>Send to customer</button>`);
  if (st === 'SENT') {
    actions.push(`<button class="btn btn-secondary btn-sm" ${dataAct('quoteViewDocument', d.id)}>View document</button>`);
    if (qCanAcceptLost()) {
      actions.push(`<button class="btn btn-primary btn-sm" data-busy="…" ${dataAct('quoteAccept', d.id)}>Mark accepted</button>`);
      actions.push(`<button class="btn btn-secondary btn-sm" ${dataAct('quoteLostPrompt', d.id)}>Mark lost…</button>`);
    }
  }
  actions.push(`<button class="btn btn-secondary btn-sm" ${dataAct('quoteFollowupPrompt', d.id)}>Log follow-up</button>`);

  main.innerHTML = `
    <div style="margin-bottom:12px"><button class="btn btn-secondary btn-sm" ${dataAct('quoteBackToList')}>← All quotes</button></div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div><h2 style="margin:0">${h(d.quote_no || d.id)}</h2>
          <div class="text-muted" style="font-size:13px">Client ${h(d.client_id)} · Place of supply ${h(d.place_of_supply || '—')} · v${d.current_version}</div></div>
        <div>${qBadge(st)}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">${actions.join(' ')}</div>
    </div>
    <div class="card" style="overflow-x:auto;margin-bottom:14px">
      <h3 style="margin-top:0">Lines</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr>
          <th style="text-align:left;padding:6px">#</th><th style="text-align:left;padding:6px">Item</th>
          <th style="text-align:right;padding:6px">Qty</th><th style="text-align:right;padding:6px">Unit price</th>
          <th style="text-align:right;padding:6px">GST</th><th style="text-align:right;padding:6px">Taxable</th>
          ${showCost ? '<th style="text-align:right;padding:6px">Landed</th><th style="text-align:right;padding:6px">Margin</th>' : ''}
        </tr></thead>
        <tbody>${lines.map((l, i) => `<tr style="border-top:1px solid var(--border,#eee)">
          <td style="padding:6px">${i + 1}</td>
          <td style="padding:6px">${h(l.description || l.sku || 'Item')}</td>
          <td style="padding:6px;text-align:right">${l.qty}</td>
          <td style="padding:6px;text-align:right">${qMoney(l.unit_price_paise)}</td>
          <td style="padding:6px;text-align:right">${((l.sale_gst_bp || 0) / 100).toFixed(0)}%</td>
          <td style="padding:6px;text-align:right">${qMoney(l.line_taxable_paise)}</td>
          ${showCost ? `<td style="padding:6px;text-align:right">${qMoney(l.landed_cost_paise)}</td><td style="padding:6px;text-align:right">${qMoney(l.line_margin_paise)}</td>` : ''}
        </tr>`).join('')}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <table style="font-size:13px">
          <tr><td style="padding:3px 10px;text-align:right">Subtotal</td><td style="padding:3px 10px;text-align:right">${qMoney(t.subtotal_paise)}</td></tr>
          ${t.igst_total ? `<tr><td style="padding:3px 10px;text-align:right">IGST</td><td style="padding:3px 10px;text-align:right">${qMoney(t.igst_total)}</td></tr>`
            : `<tr><td style="padding:3px 10px;text-align:right">CGST</td><td style="padding:3px 10px;text-align:right">${qMoney(t.cgst_total)}</td></tr><tr><td style="padding:3px 10px;text-align:right">SGST</td><td style="padding:3px 10px;text-align:right">${qMoney(t.sgst_total)}</td></tr>`}
          <tr><td style="padding:3px 10px;text-align:right">Round off</td><td style="padding:3px 10px;text-align:right">${qMoney(t.round_off_paise)}</td></tr>
          <tr style="font-weight:700;border-top:1px solid var(--border,#ddd)"><td style="padding:6px 10px;text-align:right">Grand total</td><td style="padding:6px 10px;text-align:right">${qMoney(t.grand_total_paise != null ? t.grand_total_paise : d.grand_total_paise)}</td></tr>
        </table>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Audit trail</h3>
      <div style="font-size:12px" class="text-muted">Content hash: <code>${h((d.version && d.version.content_hash) || '—')}</code></div>
      <ul style="font-size:13px;margin:8px 0 0;padding-left:18px">
        ${(d.audit || []).map(a => `<li>#${a.seq} <b>${h(a.action)}</b> — ${h(a.actor_id)} <span class="text-muted">${h(a.created_at || '')}</span></li>`).join('')}
      </ul>
    </div>`;
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
  openModal('Reject quote', `<label>Reason / comments (required)</label>
    <textarea id="q-reject-note" rows="3" style="width:100%" placeholder="Why is this rejected?"></textarea>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('quoteRejectDo', id, leg)}>Reject</button>`);
}
async function quoteRejectDo(id, leg) {
  const comments = (document.getElementById('q-reject-note')?.value || '').trim();
  if (!comments) { showToast('A reason is required', 'error'); return; }
  const r = await api('/quotes/' + id + '/reject', { method: 'POST', body: JSON.stringify({ leg, comments }) });
  if (r) { closeModal(); showToast('Rejected — back to DRAFT'); await quoteReload(id); }
}
function quoteLostPrompt(id) {
  openModal('Mark quote lost', `<label>Reason (required)</label>
    <textarea id="q-lost-note" rows="3" style="width:100%" placeholder="Why was this lost?"></textarea>`,
    `<button class="btn btn-secondary" ${dataActClose('noop')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('quoteLostDo', id)}>Mark lost</button>`);
}
async function quoteLostDo(id) {
  const reason = (document.getElementById('q-lost-note')?.value || '').trim();
  if (!reason) { showToast('A reason is required', 'error'); return; }
  const r = await api('/quotes/' + id + '/lost', { method: 'POST', body: JSON.stringify({ reason }) });
  if (r) { closeModal(); showToast('Marked lost'); await quoteReload(id); }
}
function quoteFollowupPrompt(id) {
  openModal('Log follow-up', `
    <label>Channel</label>
    <select id="q-fu-channel" style="width:100%"><option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="note">Note</option></select>
    <label style="margin-top:8px;display:block">Note</label>
    <textarea id="q-fu-note" rows="2" style="width:100%"></textarea>
    <label style="margin-top:8px;display:block">Next action date (optional)</label>
    <input id="q-fu-date" type="date" style="width:100%">`,
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
  q.editor = { client_id: '', place_of_supply: '', valid_until: '', lines: [quoteBlankLine()], preview: null };
  const main = qMain();
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading clients…</p></div>`;
  const clients = await api('/clients');
  q.clients = Array.isArray(clients) ? clients : [];
  quoteRenderEditor();
}
function quoteRenderEditor() {
  const q = qState(); const e = q.editor; const main = qMain(); if (!e) return;
  const clientOpts = ['<option value="">— select client —</option>', ...q.clients.map(c => `<option value="${h(c.id)}" ${e.client_id === c.id ? 'selected' : ''}>${h(c.name || c.id)}</option>`)].join('');
  main.innerHTML = `
    <div style="margin-bottom:12px"><button class="btn btn-secondary btn-sm" ${dataAct('quoteBackToList')}>← Cancel</button></div>
    <div class="card" style="margin-bottom:14px">
      <h2 style="margin-top:0">New quote</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        <div><label>Client</label><select style="width:100%" ${dataChangeVal('quoteEditHeader', 'client_id')}>${clientOpts}</select></div>
        <div><label>Place of supply (state code)</label><input style="width:100%" maxlength="2" value="${h(e.place_of_supply)}" ${dataInputVal('quoteEditHeader', 'place_of_supply')} placeholder="e.g. KL"></div>
        <div><label>Valid until (optional)</label><input type="date" style="width:100%" value="${h(e.valid_until)}" ${dataChangeVal('quoteEditHeader', 'valid_until')}></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Lines</h3>
        <button class="btn btn-secondary btn-sm" ${dataAct('quoteEditAddLine')}>${iconPlus(12)} Add line</button></div>
      <div id="q-lines">${e.lines.map((l, i) => quoteLineHtml(l, i)).join('')}</div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" data-busy="…" ${dataAct('quoteEditPreview')}>Preview price</button>
        <button class="btn btn-gold" data-busy="Saving…" ${dataAct('quoteEditSave')}>Save draft</button>
      </div>
      <div id="q-preview" style="margin-top:12px">${e.preview ? quotePreviewHtml(e.preview) : '<span class="text-muted">Preview to see totals (GST, round-off, margin).</span>'}</div>
    </div>`;
}
function quoteLineHtml(l, i) {
  const cm = l.pricing_mode === 'cost_markup';
  return `<div class="q-line" style="border:1px solid var(--border,#e5e7eb);border-radius:8px;padding:10px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
      <b>Line ${i + 1}</b>
      <button class="btn btn-secondary btn-sm" ${dataAct('quoteEditRemoveLine', i)}>Remove</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
      <div><label>Description</label><input style="width:100%" value="${h(l.description)}" ${dataInputVal('quoteEditLine', i, 'description')}></div>
      <div><label>Qty</label><input type="number" min="1" step="1" style="width:100%" value="${h(l.qty)}" ${dataInputVal('quoteEditLine', i, 'qty')}></div>
      <div><label>Pricing</label><select style="width:100%" ${dataChangeVal('quoteEditLine', i, 'pricing_mode')}>
        <option value="cost_markup" ${cm ? 'selected' : ''}>Cost + markup</option>
        <option value="mrp_discount" ${!cm ? 'selected' : ''}>MRP − discount</option></select></div>
      ${cm ? `
        <div><label>Purchase cost (₹)</label><input type="number" min="0" step="0.01" style="width:100%" value="${h(l.purchase_cost)}" ${dataInputVal('quoteEditLine', i, 'purchase_cost')}></div>
        <div><label>Markup %</label><input type="number" min="0" step="0.01" style="width:100%" value="${h(l.markup_pct)}" ${dataInputVal('quoteEditLine', i, 'markup_pct')}></div>` : `
        <div><label>MRP (₹)</label><input type="number" min="0" step="0.01" style="width:100%" value="${h(l.mrp)}" ${dataInputVal('quoteEditLine', i, 'mrp')}></div>
        <div><label>Discount %</label><input type="number" min="0" step="0.01" style="width:100%" value="${h(l.discount_pct)}" ${dataInputVal('quoteEditLine', i, 'discount_pct')}></div>`}
      <div><label>GST %</label><input type="number" min="0" step="1" style="width:100%" value="${h(l.sale_gst_pct)}" ${dataInputVal('quoteEditLine', i, 'sale_gst_pct')}></div>
      <div><label style="display:block">ITC claimable</label><input type="checkbox" ${l.itc_claimable ? 'checked' : ''} ${dataChangeEl('quoteEditLineItc', i)}></div>
    </div>
  </div>`;
}
function quotePreviewHtml(p) {
  const t = p.totals || {};
  return `<table style="font-size:13px">
    <tr><td style="padding:2px 10px;text-align:right">Subtotal</td><td style="padding:2px 10px;text-align:right">${qMoney(t.subtotal_paise)}</td></tr>
    ${t.igst_total ? `<tr><td style="padding:2px 10px;text-align:right">IGST</td><td style="padding:2px 10px;text-align:right">${qMoney(t.igst_total)}</td></tr>`
      : `<tr><td style="padding:2px 10px;text-align:right">CGST</td><td style="padding:2px 10px;text-align:right">${qMoney(t.cgst_total)}</td></tr><tr><td style="padding:2px 10px;text-align:right">SGST</td><td style="padding:2px 10px;text-align:right">${qMoney(t.sgst_total)}</td></tr>`}
    <tr><td style="padding:2px 10px;text-align:right">Round off</td><td style="padding:2px 10px;text-align:right">${qMoney(t.round_off_paise)}</td></tr>
    <tr style="font-weight:700"><td style="padding:4px 10px;text-align:right">Grand total</td><td style="padding:4px 10px;text-align:right">${qMoney(t.grand_total_paise)}</td></tr>
  </table>`;
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
  if (r) { e.preview = r; const pv = document.getElementById('q-preview'); if (pv) pv.innerHTML = quotePreviewHtml(r); }
}
async function quoteEditSave() {
  const e = qState().editor; if (!e.client_id) { showToast('Pick a client first', 'error'); return; }
  const r = await api('/quotes', { method: 'POST', body: JSON.stringify(quoteBuildPayload()) });
  if (r && r.id) { showToast('Draft saved'); quoteOpenDetail(r.id); }
}

// ── Today ────────────────────────────────────────────────────────────────────
async function quoteRenderToday() {
  const body = document.getElementById('quote-body'); if (!body) return;
  const d = await api('/quotes/today');
  if (!d) { body.innerHTML = `<div class="card">Could not load Today.</div>`; return; }
  const sec = (title, items, render) => `<div class="card" style="margin-bottom:14px"><h3 style="margin-top:0">${title} <span class="text-muted">(${items.length})</span></h3>
    ${items.length ? items.map(render).join('') : '<div class="text-muted">Nothing here.</div>'}</div>`;
  body.innerHTML =
    sec('Due reminders', d.due_reminders || [], r => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border,#eee)">
        <span><b>${h(r.quote_no || r.quote_id)}</b> · ${h(r.rule)} · due ${h(r.due_date)}</span>
        <span><button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', r.quote_id)}>Open</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('quoteSnoozePrompt', r.quote_id, r.id)}>Snooze</button></span></div>`) +
    sec('Follow-ups due', d.followups_due || [], f => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border,#eee)">
        <span><b>${h(f.quote_no || f.quote_id)}</b> · ${h(f.channel)} · ${h(f.next_action_date)}${f.note ? ' · ' + h(f.note) : ''}</span>
        <button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', f.quote_id)}>Open</button></div>`) +
    sec('Expiring soon', d.expiring || [], q => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--border,#eee)">
        <span><b>${h(q.quote_no || q.id)}</b> · valid until ${h(q.valid_until)}</span>
        <button class="btn btn-secondary btn-sm" ${dataAct('quoteOpenDetail', q.id)}>Open</button></div>`);
}
function quoteSnoozePrompt(id, rid) {
  openModal('Snooze reminder', `<label>Snooze until</label><input id="q-snooze-date" type="date" style="width:100%">`,
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
  APP._qadmin = { ver: acc._ver, settings };
  const roleOpts = (cur) => ['', 'sales', 'ops', 'commercial_manager', 'finance'].map(r =>
    `<option value="${r}" ${cur === r ? 'selected' : ''}>${r || '— none —'}</option>`).join('');
  const users = acc.users || [];
  const enabled = acc.enabled || {};
  const s = settings;
  main.innerHTML = `
    <div class="page-head" style="margin-bottom:14px"><h1 style="margin:0">Quote Access & Settings</h1>
      <div class="text-muted" style="font-size:13px">Assign who can use Quotations and their quote-role. ${acc.fallback_valid === false ? '<b style="color:var(--danger,#b91c1c)">Fallback approver is no longer entitled — fix it below.</b>' : ''}</div></div>
    <div class="card" style="margin-bottom:14px">
      <h3 style="margin-top:0">Entitled users</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr><th style="text-align:left;padding:6px">User</th><th style="text-align:left;padding:6px">App role</th><th style="text-align:left;padding:6px">Quote role</th></tr></thead>
        <tbody>${users.map(u => `<tr style="border-top:1px solid var(--border,#eee)">
          <td style="padding:6px">${h(u.name || u.id)}<div class="text-muted" style="font-size:11px">${h(u.email || '')}</div></td>
          <td style="padding:6px">${h(u.role || '')}</td>
          <td style="padding:6px"><select ${dataChangeVal('quoteAdminSetRole', u.id)}>${roleOpts(enabled[u.id] || '')}</select></td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="card">
      <h3 style="margin-top:0">Settings</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        <div><label>Seller state code</label><input id="qs-seller" maxlength="2" style="width:100%" value="${h(s.seller_state_code || '')}"></div>
        <div><label>Default validity (days)</label><input id="qs-validity" type="number" min="1" style="width:100%" value="${s.default_validity_days}"></div>
        <div><label>Approval threshold (₹)</label><input id="qs-threshold" type="number" min="0" style="width:100%" value="${Math.round((s.approval_threshold_paise || 0) / 100)}"></div>
        <div><label>Expiring window (days)</label><input id="qs-expwin" type="number" min="0" style="width:100%" value="${s.expiring_window_days}"></div>
        <div><label>Number prefix</label><input id="qs-prefix" style="width:100%" value="${h(s.number_prefix || '')}"></div>
        <div><label>Fallback approver (user id)</label><input id="qs-fallback" style="width:100%" value="${h(s.fallback_approver_id || '')}" placeholder="optional"></div>
        <div><label>R1 send + days</label><input id="qs-r1" type="number" min="0" style="width:100%" value="${s.reminder_rules.R1_send_plus_days}"></div>
        <div><label>R2 send + days</label><input id="qs-r2" type="number" min="0" style="width:100%" value="${s.reminder_rules.R2_send_plus_days}"></div>
        <div><label>R3 valid − days</label><input id="qs-r3" type="number" min="0" style="width:100%" value="${s.reminder_rules.R3_valid_minus_days}"></div>
      </div>
      <div style="margin-top:12px"><button class="btn btn-gold" data-busy="Saving…" ${dataAct('quoteAdminSaveSettings')}>Save settings</button></div>
    </div>`;
}
async function quoteAdminSetRole(userId, role) {
  const st = APP._qadmin || {};
  const r = await api('/admin/quote-access', { method: 'PUT', body: JSON.stringify({ userId, quoteRole: role || null, _ver: st.ver }) });
  if (r) { st.ver = r._ver; showToast('Access updated'); }
  else { renderQuoteAdmin(qMain()); }   // reload to resync _ver on conflict
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
