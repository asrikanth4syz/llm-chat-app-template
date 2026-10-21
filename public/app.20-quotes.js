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
// Margin % of the taxable (sell) value, as a short display string.
function qMarginPct(marginPaise, taxablePaise) {
  const t = Number(taxablePaise) || 0; if (!t) return '—';
  return ((Number(marginPaise) || 0) / t * 100).toFixed(1) + '%';
}
const QUOTE_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'CONVERTED', 'LOST', 'EXPIRED', 'SUPERSEDED'];
// Map a quote status to one of the app's semantic badge classes + a human label.
const QUOTE_STATUS_META = {
  DRAFT: ['badge-secondary', 'Draft'], PENDING_APPROVAL: ['badge-warning', 'Pending approval'],
  APPROVED: ['badge-info', 'Approved'], SENT: ['badge-primary', 'Sent'],
  ACCEPTED: ['badge-success', 'Accepted'], CONVERTED: ['badge-success', 'Converted'],
  LOST: ['badge-danger', 'Lost'], EXPIRED: ['badge-secondary', 'Expired'], SUPERSEDED: ['badge-secondary', 'Superseded'],
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
          <button class="q-tab ${q.tab === 'pipeline' ? 'active' : ''}" role="tab" ${dataAct('quoteGoTab', 'pipeline')}>Pipeline</button>
          <button class="q-tab ${q.tab === 'today' ? 'active' : ''}" role="tab" ${dataAct('quoteGoTab', 'today')}>Today</button>
        </div>
        ${qCanCreate() ? `<button class="btn btn-gold" ${dataAct('quoteNewEditor')}>${iconPlus(14)} New quote</button>` : ''}
      </div>
    </div>
    <div id="quote-body"><div class="loading-state"><div class="spinner"></div><p>Loading…</p></div></div>`;
  if (q.tab === 'today') return quoteRenderToday();
  if (q.tab === 'pipeline') return quoteRenderPipeline();
  return quoteRenderList();
}
function quoteGoTab(tab) { const q = qState(); q.tab = tab; q.view = 'list'; q.quoteId = null; q.editor = null; renderQuotations(qMain()); }

// ── Pipeline (analytics) ────────────────────────────────────────────────────────
async function quoteRenderPipeline() {
  const body = document.getElementById('quote-body'); if (!body) return;
  const d = await api('/quotes/pipeline');
  if (!d) { body.innerHTML = `<div class="card">Could not load the pipeline.</div>`; return; }
  const byStatus = d.by_status || [];
  const stat = {}; byStatus.forEach(s => { stat[s.status] = { n: s.n, v: s.v }; });
  const sumV = keys => keys.reduce((a, k) => a + ((stat[k] && stat[k].v) || 0), 0);
  const sumN = keys => keys.reduce((a, k) => a + ((stat[k] && stat[k].n) || 0), 0);
  const openKeys = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'];
  const wonKeys = ['ACCEPTED', 'CONVERTED'];
  const openV = sumV(openKeys), wonV = sumV(wonKeys);
  const wonN = sumN(wonKeys), lostN = sumN(['LOST']);
  const decided = wonN + lostN;
  const winRate = decided ? Math.round(wonN * 100 / decided) : 0;
  const totalV = byStatus.reduce((a, s) => a + s.v, 0);
  const totalN = byStatus.reduce((a, s) => a + s.n, 0);
  const stageOrder = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACCEPTED', 'CONVERTED', 'LOST', 'EXPIRED', 'SUPERSEDED'];
  const maxV = Math.max(1, ...byStatus.map(s => s.v));
  const stageRows = stageOrder.filter(k => stat[k]).map(k => {
    const s = stat[k]; const w = Math.max(2, Math.round((s.v / maxV) * 100));
    return `<div class="q-pipe-row q-pipe-click" ${dataAct('quotePipelineStage', k)} title="Open ${h((QUOTE_STATUS_META[k] || [, k])[1])} quotes" role="button" tabindex="0">
      <div class="q-pipe-label">${qBadge(k)} <span class="q-pipe-n">${s.n}</span></div>
      <div class="q-pipe-bar"><div class="q-pipe-fill" style="width:${w}%"></div></div>
      <div class="q-pipe-val">${qMoney(s.v)} <span class="q-pipe-go" aria-hidden="true">›</span></div>
    </div>`;
  }).join('');
  const breakdown = (title, col, rows, labelFn, clickFn) => qCard(title, rows.length
    ? `<div class="table-wrap"><table class="data-table" style="width:100%"><thead><tr>
        <th style="text-align:left;padding:9px 12px">${h(col)}</th>
        <th style="text-align:right;padding:9px 12px">Quotes</th>
        <th style="text-align:right;padding:9px 12px">Value</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${clickFn ? 'q-brow' : ''}"${clickFn ? ` ${dataAct(clickFn, labelFn(r))} title="Find these quotes" role="button" tabindex="0"` : ''} style="border-top:1px solid var(--border)">
        <td style="padding:9px 12px">${h(labelFn(r))}</td>
        <td style="padding:9px 12px;text-align:right">${r.n}</td>
        <td style="padding:9px 12px;text-align:right;font-variant-numeric:tabular-nums">${qMoney(r.v)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="form-hint">No data yet.</div>');
  body.innerHTML = `
    <div class="q-tiles">
      ${tileHtml({ label: 'Total pipeline', value: qMoney(totalV), sub: `${totalN} quotes`, accent: 'var(--navy)' })}
      ${tileHtml({ label: 'Open', value: qMoney(openV), sub: `${sumN(openKeys)} active`, accent: 'var(--gold)' })}
      ${tileHtml({ label: 'Won', value: qMoney(wonV), sub: `${wonN} accepted/converted`, accent: 'var(--success)' })}
      ${tileHtml({ label: 'Win rate', value: winRate + '%', sub: `${wonN} won · ${lostN} lost`, accent: 'var(--navy)' })}
    </div>
    ${qCard('By stage', `<div class="form-hint" style="margin:-2px 0 10px">Click a stage or a row to open those quotes.</div><div class="q-pipe">${stageRows || '<div class="form-hint">No quotes yet.</div>'}</div>`)}
    <div class="q-pipe-cols">
      ${breakdown('By client', 'Client', d.by_client || [], r => r.client_name || r.client_id || '—', 'quotePipelineClient')}
      ${breakdown('By purpose / type', 'Purpose', d.by_type || [], r => r.t || '(untitled)', 'quotePipelinePurpose')}
    </div>`;
}
// Pipeline drill-through → jump to the Quotes list, filtered. A stage filters
// server-side by status; a client / purpose row seeds the client-side search.
function quotePipelineStage(status) { const q = qState(); q.tab = 'list'; q.view = 'list'; q.statusFilter = status || ''; q.listQuery = ''; renderQuotations(qMain()); }
function quotePipelineClient(name) { const q = qState(); q.tab = 'list'; q.view = 'list'; q.statusFilter = ''; q.listQuery = (name === '—' ? '' : name) || ''; renderQuotations(qMain()); }
function quotePipelinePurpose(t) { const q = qState(); q.tab = 'list'; q.view = 'list'; q.statusFilter = ''; q.listQuery = (t === '(untitled)' ? '' : t) || ''; renderQuotations(qMain()); }

// ── List ──────────────────────────────────────────────────────────────────────
async function quoteRenderList() {
  const q = qState();
  const body = document.getElementById('quote-body'); if (!body) return;
  const qs = q.statusFilter ? `?status=${encodeURIComponent(q.statusFilter)}` : '';
  const data = await api('/quotes' + qs);
  if (!data) { body.innerHTML = `<div class="card">Could not load quotes.</div>`; return; }
  q.listRows = (data.quotes || data || []);
  const query = (q.listQuery || '').trim().toLowerCase();
  const rows = quoteSortedRows(quoteFilteredRows());
  const chip = (s, label) => `<button class="btn btn-sm ${q.statusFilter === s ? 'btn-primary' : 'btn-secondary'}" ${dataAct('quoteSetStatus', s)}>${h(label)}</button>`;
  const filterChips = chip('', 'All') + ' ' + QUOTE_STATUSES.map(s => chip(s, (QUOTE_STATUS_META[s] || [, s])[1])).join(' ');
  const emptyMsg = query ? `No quotes match “${h(q.listQuery)}”.` : (q.statusFilter ? `No ${h((QUOTE_STATUS_META[q.statusFilter] || [, q.statusFilter])[1].toLowerCase())} quotes.` : 'No quotes yet.');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${filterChips}</div>
      <div class="q-search">
        <input id="q-list-search" ${dataInputVal('quoteListSearch')} value="${h(q.listQuery || '')}" placeholder="Search quote #, client or purpose…" autocomplete="off">
        <button type="button" class="q-clear" ${dataAct('quoteListClearSearch')} title="Clear search" aria-label="Clear search">✕</button>
      </div>
    </div>
    ${rows.length === 0 ? `<div class="card"><div class="empty-state empty-sm"><div class="empty-icon">📄</div><div class="empty-title">${emptyMsg}</div>${qCanCreate() && !query && !q.statusFilter ? `<div class="empty-desc">Start by creating your first quote.</div><button class="btn btn-gold" ${dataAct('quoteNewEditor')}>${iconPlus(14)} New quote</button>` : ''}</div></div>` : `
    <div class="card" style="padding:0"><div class="table-wrap">
      <table class="data-table q-list-table" style="width:100%;border-collapse:collapse">
        <thead><tr>
          ${quoteSortTh('quote_no', 'Quote #', 'left')}
          ${quoteSortTh('title', 'Purpose', 'left')}
          ${quoteSortTh('client', 'Client', 'left')}
          ${quoteSortTh('status', 'Status', 'left')}
          ${quoteSortTh('grand_total_paise', 'Grand total', 'right')}
          ${quoteSortTh('valid_until', 'Valid until', 'left')}
        </tr></thead>
        <tbody id="q-list-rows">${quoteListRowsHtml(rows)}</tbody>
      </table>
    </div></div>`}`;
}
function quoteSetStatus(s) { const q = qState(); q.statusFilter = s; quoteRenderList(); }
// A quote matches the search across its number, client (name or id) and purpose.
function quoteRowMatches(r, query) {
  if (!query) return true;
  return (r.quote_no || '').toLowerCase().includes(query)
    || (r.client_name || '').toLowerCase().includes(query)
    || (r.client_id || '').toLowerCase().includes(query)
    || (r.title || '').toLowerCase().includes(query);
}
function quoteFilteredRows() {
  const q = qState(); const query = (q.listQuery || '').trim().toLowerCase();
  return (q.listRows || []).filter(r => quoteRowMatches(r, query));
}
// Header sort — toggles asc/desc on the clicked column; purely client-side over
// the loaded page (matches the search model).
function quoteListSort(key) {
  const q = qState(); const s = q.listSort || {};
  q.listSort = { key, dir: (s.key === key && s.dir === 'asc') ? 'desc' : 'asc' };
  quoteRenderList();
}
function quoteSortedRows(rows) {
  const s = qState().listSort; if (!s || !s.key) return rows;
  const dir = s.dir === 'desc' ? -1 : 1;
  const val = (r) => {
    switch (s.key) {
      case 'grand_total_paise': return Number(r.grand_total_paise || 0);
      case 'client': return (r.client_name || r.client_id || '').toLowerCase();
      case 'valid_until': return r.valid_until || '';
      case 'status': return r.status || '';
      case 'title': return (r.title || '').toLowerCase();
      default: return (r.quote_no || '').toLowerCase();
    }
  };
  return [...rows].sort((a, b) => { const av = val(a), bv = val(b); return av < bv ? -dir : av > bv ? dir : 0; });
}
function quoteSortTh(key, label, align) {
  const s = qState().listSort || {};
  const arrow = s.key === key ? (s.dir === 'desc' ? ' ▼' : ' ▲') : '';
  return `<th style="text-align:${align};padding:11px 14px;cursor:pointer;user-select:none;white-space:nowrap" ${dataAct('quoteListSort', key)}>${h(label)}<span style="color:var(--gold)">${arrow}</span></th>`;
}
// Client-side filter over the already-loaded page of quotes (no refetch), so the
// results update as you type. The X button clears the text and the filter.
function quoteListApplyFilter() {
  const host = document.getElementById('q-list-rows');
  if (host) host.innerHTML = quoteListRowsHtml(quoteSortedRows(quoteFilteredRows()));
}
function quoteListSearch(val) { qState().listQuery = val; quoteListApplyFilter(); }
function quoteListClearSearch() {
  const q = qState(); q.listQuery = '';
  const inp = document.getElementById('q-list-search'); if (inp) { inp.value = ''; inp.focus(); }
  quoteRenderList();
}
// Rows only (no <tbody> wrapper) — the caller supplies the tbody so this can be
// dropped straight into tbody.innerHTML on live filter.
// Rows fold by lineage: all revisions of one quote (same root_quote_id, else the
// quote's own id) collapse under their LATEST revision, which carries a ▸ toggle
// that reveals the earlier revisions as indented sub-rows.
function quoteListRowsHtml(rows) {
  if (!rows.length) return `<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted)">No quotes match.</td></tr>`;
  const keyOf = r => r.root_quote_id || r.id;
  const groups = new Map();
  rows.forEach(r => { const k = keyOf(r); const g = groups.get(k) || []; g.push(r); groups.set(k, g); });
  const headIdOf = new Map();
  groups.forEach((g, k) => { headIdOf.set(k, g.reduce((a, b) => ((b.revision || 1) > (a.revision || 1) ? b : a)).id); });
  const subCells = (x, pad) => `
    <td style="padding:${pad};color:var(--text-muted);white-space:nowrap">↳ ${h(x.quote_no || x.id)}${(x.revision || 1) > 1 ? ` <span class="badge badge-secondary" style="font-weight:600">R${x.revision}</span>` : ''}</td>
    <td style="padding:9px 14px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h(x.title || '')}">${h(x.title || '—')}</td>
    <td style="padding:9px 14px">${h(x.client_name || x.client_id || '')}</td>
    <td style="padding:9px 14px">${qBadge(x.status)}</td>
    <td style="padding:9px 14px;text-align:right;font-variant-numeric:tabular-nums">${qMoney(x.grand_total_paise)}</td>
    <td style="padding:9px 14px;white-space:nowrap">${h(x.valid_until || '—')}</td>`;
  const seen = new Set();
  const out = [];
  rows.forEach(r => {
    const k = keyOf(r);
    if (headIdOf.get(k) !== r.id || seen.has(k)) return;   // emit each lineage once, at its head's sorted position
    seen.add(k);
    const tail = groups.get(k).filter(x => x.id !== r.id).sort((a, b) => (b.revision || 1) - (a.revision || 1));
    const gk = String(k).replace(/[^\w-]/g, '');
    const toggle = tail.length ? `<button class="q-rev-toggle" data-group="${gk}" ${dataAct('quoteToggleRevisions', gk)} title="Show ${tail.length} earlier revision${tail.length > 1 ? 's' : ''}" aria-label="Toggle earlier revisions">▸</button> ` : '';
    const count = tail.length ? ` <span class="q-rev-count">${tail.length + 1} revisions</span>` : '';
    out.push(`<tr class="q-trow" ${dataAct('quoteOpenDetail', r.id)}>
      <td style="padding:11px 14px;font-weight:700;color:var(--navy);white-space:nowrap">${toggle}${r.kind === 'GIFTING' ? '🎁 ' : ''}${h(r.quote_no || r.id)}${(r.revision || 1) > 1 ? ` <span class="badge badge-secondary" style="font-weight:600">R${r.revision}</span>` : ''}${count}</td>
      <td style="padding:11px 14px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h(r.title || '')}">${h(r.title || '—')}</td>
      <td style="padding:11px 14px">${h(r.client_name || r.client_id || '')}</td>
      <td style="padding:11px 14px">${qBadge(r.status)}</td>
      <td style="padding:11px 14px;text-align:right;font-variant-numeric:tabular-nums">${qMoney(r.grand_total_paise)}</td>
      <td style="padding:11px 14px;white-space:nowrap">${h(r.valid_until || '—')}</td>
    </tr>`);
    tail.forEach(x => out.push(`<tr class="q-trow q-rev-sub" data-group="${gk}" style="display:none" ${dataAct('quoteOpenDetail', x.id)}>${subCells(x, '9px 14px 9px 34px')}</tr>`));
  });
  return out.join('');
}
// Expand / collapse a lineage's earlier-revision sub-rows.
function quoteToggleRevisions(key) {
  const subs = document.querySelectorAll(`tr.q-rev-sub[data-group="${key}"]`);
  const btn = document.querySelector(`.q-rev-toggle[data-group="${key}"]`);
  let nowShown = false;
  subs.forEach(tr => { const hidden = tr.style.display === 'none'; tr.style.display = hidden ? '' : 'none'; nowShown = hidden; });
  if (btn) btn.textContent = nowShown ? '▾' : '▸';
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
  const t = (d.version && ((d.version.payload && d.version.payload.totals) || d.version.totals)) || {};
  const lines = d.lines || [];
  const charges = d.charges || [];
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
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteDownloadPdf', d.id)}>Download PDF</button>`);
    if (qCanAcceptLost()) {
      actions.push(`<button class="btn btn-success" data-busy="…" ${dataAct('quoteAccept', d.id)}>Mark accepted</button>`);
      actions.push(`<button class="btn btn-danger" ${dataAct('quoteLostPrompt', d.id)}>Mark lost…</button>`);
    }
  }
  if (st === 'ACCEPTED' || st === 'CONVERTED') {
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteViewDocument', d.id)}>View document</button>`);
    actions.push(`<button class="btn btn-secondary" ${dataAct('quoteDownloadPdf', d.id)}>Download PDF</button>`);
    if (st === 'ACCEPTED' && qCanCreate() && !d.converted_order_id) actions.push(`<button class="btn btn-gold" data-busy="Converting…" ${dataAct('quoteConvert', d.id)}>Convert to order</button>`);
  }
  // A revision can be raised off a sent/expired/lost quote that has not already been revised.
  if (['SENT', 'EXPIRED', 'LOST'].includes(st) && qCanCreate() && !d.superseded_by_id) {
    actions.push(`<button class="btn btn-secondary" data-busy="Revising…" ${dataAct('quoteRevise', d.id)}>Revise</button>`);
  }
  actions.push(`<button class="btn btn-secondary" ${dataAct('quoteFollowupPrompt', d.id)}>Log follow-up</button>`);

  // Lineage banner — revision chain + convert-to-order linkage.
  const qlink = (id, label) => `<button class="q-lineage-link" ${dataAct('quoteOpenDetail', id)}>${h(label)}</button>`;
  const lineage = [];
  if ((d.revision || 1) > 1 && d.revised_from_id) lineage.push(`<strong>Revision ${d.revision}</strong> — revised from ${qlink(d.revised_from_id, d.revised_from_no || d.revised_from_id)}`);
  if (d.superseded_by_id) lineage.push(`Superseded by ${qlink(d.superseded_by_id, d.superseded_by_no || d.superseded_by_id)}`);
  if (d.converted_order_id) lineage.push(`Converted to order <strong>${h(d.converted_order_id)}</strong>`);
  const lineageHtml = lineage.length ? `<div class="card q-lineage"><div class="card-body">${lineage.join(' <span class="q-lineage-sep">·</span> ')}</div></div>` : '';

  const taxRows = qTaxRowsHtml(t, qUniformGstPct(lines.map(l => (l.sale_gst_bp || 0) / 100)));

  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-secondary btn-sm" style="margin-bottom:8px" ${dataAct('quoteBackToList')}>← All quotes</button>
        <div class="page-title" style="display:flex;align-items:center;gap:10px">${h(d.quote_no || d.id)} ${qBadge(st)}${d.kind === 'GIFTING' ? ` <span class="q-kind-pill">🎁 Gifting</span>` : ''}</div>
        ${d.title ? `<div class="page-subtitle">${h(d.title)}</div>` : ''}
      </div>
      <div class="page-actions">${actions.join(' ')}</div>
    </div>
    ${lineageHtml}
    ${qCard('Quote details', `<dl class="q-meta">
      ${d.title ? `<div style="grid-column:1/-1"><dt>What this quote is for</dt><dd>${h(d.title)}</dd></div>` : ''}
      <div><dt>Client</dt><dd>${h(d.client_name || d.client_id)}</dd></div>
      <div><dt>Place of supply</dt><dd>${h(d.place_of_supply || '—')}</dd></div>
      <div><dt>Version</dt><dd>v${d.current_version}</dd></div>
      <div><dt>Valid until</dt><dd>${h(d.valid_until || '—')}</dd></div>
      <div><dt>ITC claimable</dt><dd>${d.itc_claimable_all ? 'Yes (all lines)' : 'No'}</dd></div>
      ${d.payment_terms ? `<div style="grid-column:1/-1"><dt>Payment terms</dt><dd>${h(d.payment_terms)}</dd></div>` : ''}
    </dl>`)}
    ${qCard('Line items', `
      <div class="table-wrap">
      <table class="data-table" style="width:100%;border-collapse:collapse;font-size:.84rem">
        <thead><tr>
          <th style="text-align:left;padding:8px 10px">#</th><th style="text-align:left;padding:8px 10px">Item</th>
          <th style="text-align:left;padding:8px 10px">HSN</th><th style="text-align:left;padding:8px 10px">UoM</th>
          <th style="text-align:right;padding:8px 10px">Qty</th><th style="text-align:right;padding:8px 10px">Unit price</th>
          <th style="text-align:right;padding:8px 10px">GST</th><th style="text-align:right;padding:8px 10px">Taxable</th>
          ${showCost ? '<th style="text-align:right;padding:8px 10px">Landed</th><th style="text-align:right;padding:8px 10px">Margin</th>' : ''}
        </tr></thead>
        <tbody>${lines.map((l, i) => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;color:var(--text-muted)">${i + 1}</td>
          <td style="padding:8px 10px;font-weight:600">${h(l.description || l.sku || 'Item')}${(l.line_discount_paise ? `<div style="font-size:.72rem;color:var(--text-muted)">less discount ${qMoney(l.line_discount_paise)}</div>` : '')}</td>
          <td style="padding:8px 10px">${h(l.hsn || '—')}</td>
          <td style="padding:8px 10px">${h(l.uom || '—')}</td>
          <td style="padding:8px 10px;text-align:right">${l.qty}</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(l.unit_price_paise)}</td>
          <td style="padding:8px 10px;text-align:right">${((l.sale_gst_bp || 0) / 100).toFixed(0)}%</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(l.line_taxable_paise)}</td>
          ${showCost ? `<td style="padding:8px 10px;text-align:right">${qMoney(l.landed_cost_paise)}</td><td style="padding:8px 10px;text-align:right;color:${(l.line_margin_paise||0)<0?'var(--danger)':'inherit'}">${qMoney(l.line_margin_paise)}<div style="font-size:.72rem;color:var(--text-muted)">${qMarginPct(l.line_margin_paise, l.line_taxable_paise)}</div></td>` : ''}
        </tr>`).join('')}${charges.map(c => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;color:var(--text-muted)">—</td>
          <td style="padding:8px 10px;font-weight:600">${h(c.label || 'Charge')}<div style="font-size:.72rem;color:var(--text-muted)">Additional charge</div></td>
          <td style="padding:8px 10px">—</td><td style="padding:8px 10px">—</td>
          <td style="padding:8px 10px;text-align:right">1</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(c.amount_paise)}</td>
          <td style="padding:8px 10px;text-align:right">${((c.gst_bp || 0) / 100).toFixed(0)}%</td>
          <td style="padding:8px 10px;text-align:right">${qMoney(c.amount_paise)}</td>
          ${showCost ? '<td style="padding:8px 10px;text-align:right">—</td><td style="padding:8px 10px;text-align:right">—</td>' : ''}
        </tr>`).join('')}</tbody>
      </table></div>
      <div class="q-summary" style="margin-top:14px">
        ${t.discount_total_paise != null ? `<div class="q-row"><span>Line subtotal</span><span class="q-amt">${qMoney(t.gross_subtotal_paise)}</span></div>
        <div class="q-row"><span>Discount</span><span class="q-amt" style="color:var(--danger)">− ${qMoney(t.discount_total_paise)}</span></div>` : ''}
        ${t.charges_total_paise != null ? `<div class="q-row"><span>Charges</span><span class="q-amt">${qMoney(t.charges_total_paise)}</span></div>` : ''}
        <div class="q-row"><span>${(t.discount_total_paise != null || t.charges_total_paise != null) ? 'Taxable value' : 'Subtotal'}</span><span class="q-amt">${qMoney(t.subtotal_paise)}</span></div>
        ${taxRows}
        <div class="q-row"><span>Round off</span><span class="q-amt">${qMoney(t.round_off_paise)}</span></div>
        <div class="q-row q-grand"><span>Grand total</span><span>${qMoney(t.grand_total_paise != null ? t.grand_total_paise : d.grand_total_paise)}</span></div>
        ${showCost ? (() => { const tm = lines.reduce((s, l) => s + (l.line_margin_paise || 0), 0); const pct = t.weighted_margin_bp != null ? (t.weighted_margin_bp / 100) : null; return `<div class="q-row" style="margin-top:6px;border-top:1px dashed var(--border);padding-top:8px"><span>Total margin</span><span class="q-amt" style="color:${tm < 0 ? 'var(--danger)' : 'var(--success)'}">${qMoney(tm)}${pct != null ? ` · ${pct.toFixed(2)}%` : ''}</span></div>`; })() : ''}
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
async function quoteRevise(id) {
  const r = await api('/quotes/' + id + '/revise', { method: 'POST', body: '{}' });
  if (r && r.id) { showToast(`Revision ${r.revision} created as draft`); await quoteOpenDetail(r.id); if (window.quoteRefreshBell) quoteRefreshBell(); }
}
async function quoteConvert(id) {
  const r = await api('/quotes/' + id + '/convert', { method: 'POST', body: '{}' });
  if (r && r.order_id) { showToast(`Converted to draft order ${r.order_id}`); await quoteReload(id); }
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
    <div class="form-field"><label>Next action date (optional)</label><input id="q-fu-date" type="date" max="9999-12-31"></div>`,
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
    `<button class="btn btn-secondary" ${dataAct('quoteDownloadPdf', id)}>Download PDF</button>
     <button class="btn btn-primary" ${dataActClose('noop')}>Close</button>`);
}
function noop() { /* modal cancel */ }
// Download the customer document as a PDF. Workers can't render PDFs server-side
// without the (paid) Browser Rendering binding, so we open the stored, print-styled
// HTML in a new tab and invoke the browser's print dialog → "Save as PDF".
async function quoteDownloadPdf(id) {
  const r = await api('/quotes/' + id + '/document');
  if (!r) return;
  let html = ''; try { html = decodeURIComponent(escape(atob(r.content_b64))); } catch { try { html = atob(r.content_b64); } catch { html = ''; } }
  if (!html) { showToast('Could not load the document', 'error'); return; }
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to download the PDF', 'error'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* user can print manually */ } }, 450);
}

// ── Editor (new quote) ─────────────────────────────────────────────────────────
function quoteBlankLine() { return { pricing_mode: 'cost_markup', sku: '', description: '', hsn: '', uom: '', qty: 1, purchase_cost: '', markup_pct: '', net_rate: '', adjust: '', mrp: '', discount_pct: '', purchase_margin: '', freight: '', branding: '', sale_gst_pct: '18', purchase_gst_pct: '', itc_claimable: true }; }
function quoteBlankCharge() { return { label: '', amount: '', gst_pct: '18' }; }
async function quoteNewEditor() {
  const q = qState(); q.view = 'editor';
  q.editor = { editId: null, kind: 'REGULAR', client_id: '', client_q: '', title: '', payment_terms: '', place_of_supply: '', valid_until: '', discount_type: 'pct', discount_value: '', charges: [], lines: [quoteBlankLine()], preview: null };
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
    sku: l.sku || '', description: l.description || '', hsn: l.hsn || '', uom: l.uom || '', qty: l.qty || 1,
    purchase_cost: toRupee(l.purchase_cost_paise), markup_pct: toPct(l.markup_bp),
    net_rate: toRupee(l.net_rate_paise), adjust: toRupee(l.adjust_paise),
    mrp: toRupee(l.mrp_paise), discount_pct: toPct(l.discount_bp), purchase_margin: toPct(l.purchase_margin_bp),
    freight: toRupee(l.freight_alloc_paise), branding: toRupee(l.branding_cost_paise),
    sale_gst_pct: toPct(l.sale_gst_bp) || '0', purchase_gst_pct: toPct(l.purchase_gst_bp),
    itc_claimable: !!l.itc_claimable,
  }));
  // Reconstruct the header discount + charges from the stored quote.
  let discType = 'pct', discVal = '';
  if (d.header_discount_bp) { discType = 'pct'; discVal = Number(d.header_discount_bp) / 100; }
  else if (d.header_discount_paise) { discType = 'amount'; discVal = Number(d.header_discount_paise) / 100; }
  const charges = (d.charges || []).map(c => ({ label: c.label || '', amount: (Number(c.amount_paise) || 0) / 100, gst_pct: (Number(c.gst_bp) || 0) / 100 }));
  q.editor = { editId: id, kind: d.kind || 'REGULAR', quoteNo: d.quote_no, client_id: d.client_id, client_q: d.client_name || d.client_id, place_of_supply: d.place_of_supply || '',
    title: d.title || '', payment_terms: d.payment_terms || '', discount_type: discType, discount_value: discVal, charges,
    valid_until: d.valid_until || '', lines: lines.length ? lines : [quoteBlankLine()], preview: null };
  const clients = await api('/clients');
  q.clients = Array.isArray(clients) ? clients : [];
  quoteRenderEditor();
}
function quoteRenderEditor() {
  const q = qState(); const e = q.editor; const main = qMain(); if (!e) return;
  const editing = !!e.editId;
  const clientName = (q.clients.find(c => c.id === e.client_id) || {}).name || e.client_q || e.client_id || '';
  // Searchable client picker: a text input backed by a <datalist> gives native
  // type-to-filter over client names (CSP-safe, no custom dropdown).
  const clientField = editing
    ? qField('Client', `<input value="${h(clientName)}" disabled>`, 'Client is fixed on an existing quote')
    : qField('Client', `<div class="q-combo">
        <input id="q-client-input" value="${h(e.client_q || '')}" ${dataInputVal('quoteClientFilter')} data-focusact="quoteClientFocus" placeholder="Type to search client…" autocomplete="off">
        <div class="q-combo-menu" id="q-client-menu" style="display:none"></div>
      </div>`, 'Search by client name');
  const gt = e.preview && e.preview.totals ? qMoney(e.preview.totals.grand_total_paise) : '—';
  main.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <button class="btn btn-secondary btn-sm" style="margin-bottom:8px" ${editing ? dataAct('quoteOpenDetail', e.editId) : dataAct('quoteBackToList')}>← ${editing ? 'Back to quote' : 'All quotes'}</button>
        <div class="page-title">${editing ? 'Edit quote ' + h(e.quoteNo || '') : 'New quote'}</div>
        <div class="page-subtitle">${editing ? 'Editing a draft adds a new immutable version.' : 'Add line items, preview the price, then save as a draft.'}</div>
      </div>
    </div>
    ${qCard('Quote details', `
      ${qField('Quote type', `<div class="q-kind">
        <button type="button" class="q-kind-opt ${e.kind !== 'GIFTING' ? 'on' : ''}" ${dataAct('quoteSetKind', 'REGULAR')}>📦 Regular</button>
        <button type="button" class="q-kind-opt ${e.kind === 'GIFTING' ? 'on' : ''}" ${dataAct('quoteSetKind', 'GIFTING')}>🎁 Gifting</button>
      </div>`, e.kind === 'GIFTING'
        ? 'Gifting → converts to a multi-step gifting order: order each item · branding (where applicable) · client sample approval · collect · dispatch.'
        : 'Regular → converts to a standard order: pick · pack · deliver.')}
      ${qField('What this quote is for', `<input value="${h(e.title || '')}" ${dataInputVal('quoteEditHeader', 'title')} placeholder="e.g. Diwali gift hampers — Meta Bangalore" maxlength="200">`, 'Shows in the list and powers search by purpose')}
      <div class="form-row" style="margin-bottom:0">
      ${clientField}
      ${qField('Place of supply', `<div class="q-combo">
        <input id="q-pos-input" value="${h(quoteStateLabel(e.place_of_supply))}" data-code="${h((e.place_of_supply || '').toUpperCase())}" ${dataInputVal('quoteStateType', 'q-pos-input')} data-focusact="quoteStateFocus" placeholder="Search state or code…" autocomplete="off">
        <div class="q-combo-menu" id="q-pos-input-menu" style="display:none"></div>
      </div>`, 'Decides CGST/SGST vs IGST')}
      ${qField('Valid until', `<input type="date" value="${h(e.valid_until)}" max="9999-12-31" ${dataChangeVal('quoteEditHeader', 'valid_until')}>`, 'Optional — defaults from settings')}
      ${qField('Payment terms (optional)', `<input value="${h(e.payment_terms || '')}" ${dataInputVal('quoteEditHeader', 'payment_terms')} placeholder="Overrides the default on this quote" maxlength="1000">`, 'Blank = use the global default')}
    </div>`)}
    ${qCard('Line items', `<div id="q-lines">${e.lines.map((l, i) => quoteLineHtml(l, i)).join('')}</div>`,
      `<button class="btn btn-secondary btn-sm" ${dataAct('quoteEditAddLine')}>${iconPlus(12)} Add line</button>`)}
    ${qCard('Pricing summary', `<div id="q-preview">${e.preview ? quotePreviewHtml(e.preview) : '<div class="empty-state empty-sm"><div class="empty-icon">🧮</div><div class="empty-title">No preview yet</div><div class="empty-desc">Use “Preview price” to compute GST, round-off and margin — each line also shows its cost breakup.</div></div>'}</div>`)}
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
  const mode = l.pricing_mode || 'cost_markup';
  const canRemove = (qState().editor.lines.length > 1);
  let priceFields;
  if (mode === 'cost_markup') {
    priceFields = qField('Buying cost / unit (₹)', `<input type="number" min="0" step="0.01" value="${h(l.purchase_cost)}" ${dataInputVal('quoteEditLine', i, 'purchase_cost')} placeholder="ex-GST">`, 'Ex-GST — drives margin')
      + qField('Markup %', `<input type="number" min="0" step="0.01" value="${h(l.markup_pct)}" ${dataInputVal('quoteEditLine', i, 'markup_pct')}>`, 'On buying cost');
  } else if (mode === 'net_rate') {
    // Buying cost entered GROSS (incl GST), auto-stripped by purchase GST → ex cost.
    priceFields = `<div class="form-field"><label>Buying cost / unit (incl GST)</label><input type="number" min="0" step="0.01" value="${h(l.purchase_cost)}" ${dataInputVal('quoteEditLine', i, 'purchase_cost')} placeholder="gross"><span class="form-hint" id="q-excost-${i}">${quoteExCostHint(l)}</span></div>`
      + `<div class="form-field"><label>Net rate / unit (incl GST)</label><input type="number" min="0" step="0.01" value="${h(l.net_rate)}" ${dataInputVal('quoteEditLine', i, 'net_rate')} placeholder="incl. GST"><span class="form-hint" id="q-exgst-${i}">${quoteExGstHint(l)}</span></div>`
      + qField('Adjust amount (₹)', `<input type="number" min="0" step="0.01" value="${h(l.adjust)}" ${dataInputVal('quoteEditLine', i, 'adjust')} placeholder="0">`, 'Added to the line sale total (≥ 0)');
  } else {
    // MRP mode: buying cost is DERIVED from MRP − purchase margin (shown in the hint).
    priceFields = `<div class="form-field"><label>MRP / unit (incl GST)</label><input type="number" min="0" step="0.01" value="${h(l.mrp)}" ${dataInputVal('quoteEditLine', i, 'mrp')} placeholder="incl. GST"><span class="form-hint" id="q-exgst-${i}">${quoteExGstHint(l)}</span></div>`
      + qField('Purchase margin %', `<input type="number" min="0" step="0.01" value="${h(l.purchase_margin)}" ${dataInputVal('quoteEditLine', i, 'purchase_margin')} placeholder="0">`, 'Off ex-MRP → buying cost')
      + qField('Sale discount %', `<input type="number" min="0" step="0.01" value="${h(l.discount_pct)}" ${dataInputVal('quoteEditLine', i, 'discount_pct')}>`, 'Off ex-MRP → sale price');
  }
  return `<div class="q-line">
    <div class="q-line-head">
      <span class="q-line-no">Line ${i + 1}</span>
      ${canRemove ? `<button class="btn btn-danger btn-sm" ${dataAct('quoteEditRemoveLine', i)}>Remove</button>` : ''}
    </div>
    <div class="form-row">
      ${qField('SKU', `<input value="${h(l.sku)}" ${dataInputVal('quoteEditLine', i, 'sku')} placeholder="optional">`)}
      ${qField('Description', `<input value="${h(l.description)}" ${dataInputVal('quoteEditLine', i, 'description')} placeholder="Item description">`)}
      ${qField('HSN / SAC', `<input value="${h(l.hsn)}" ${dataInputVal('quoteEditLine', i, 'hsn')} placeholder="e.g. 2106" maxlength="12">`, 'GST code')}
      ${qField('UoM', `<input value="${h(l.uom)}" ${dataInputVal('quoteEditLine', i, 'uom')} placeholder="e.g. Nos / Kg / Box" maxlength="16">`)}
      ${qField('Qty', `<input type="number" min="1" step="1" value="${h(l.qty)}" ${dataInputVal('quoteEditLine', i, 'qty')}>`)}
      ${qField('Pricing method', `<select ${dataChangeVal('quoteEditLine', i, 'pricing_mode')}>
        <option value="cost_markup" ${mode === 'cost_markup' ? 'selected' : ''}>Cost + markup</option>
        <option value="net_rate" ${mode === 'net_rate' ? 'selected' : ''}>Net rate</option>
        <option value="mrp_discount" ${mode === 'mrp_discount' ? 'selected' : ''}>MRP − discount</option></select>`)}
      ${priceFields}
      ${qField('Freight / unit (₹)', `<input type="number" min="0" step="0.01" value="${h(l.freight)}" ${dataInputVal('quoteEditLine', i, 'freight')} placeholder="0">`, 'Cost — not added to sale price')}
      ${qField('Branding / unit (₹)', `<input type="number" min="0" step="0.01" value="${h(l.branding)}" ${dataInputVal('quoteEditLine', i, 'branding')} placeholder="0">`, 'Cost — not added to sale price')}
      ${qField('Sale GST %', `<input type="number" min="0" step="1" value="${h(l.sale_gst_pct)}" ${dataInputVal('quoteEditLine', i, 'sale_gst_pct')}>`)}
      ${qField('Purchase GST %', `<input type="number" min="0" step="1" value="${h(l.purchase_gst_pct)}" ${dataInputVal('quoteEditLine', i, 'purchase_gst_pct')} placeholder="= sale">`, 'For ITC — defaults to sale GST')}
      ${qField('ITC', `<label style="display:inline-flex;align-items:center;gap:7px;font-weight:500;font-size:.84rem;padding-top:6px;cursor:pointer">
        <input type="checkbox" style="width:auto" ${l.itc_claimable ? 'checked' : ''} ${dataChangeEl('quoteEditLineItc', i)}> Claimable</label>`)}
    </div>
    ${quoteLineBreakup(l, i)}
  </div>`;
}
// Per-line cost breakup (pre-tax) from the last preview, so the operator can cross-
// check buying cost, branding+transport, sellable cost, sale price and margin.
function quoteLineBreakup(l, i) {
  const e = qState().editor;
  const pv = e && e.preview && e.preview.lines && e.preview.lines[i];
  if (!pv) return '';
  const qty = Math.max(0, Math.round(Number(l.qty || 0)));
  const r = (v) => Math.round(Number(v || 0) * 100);
  // Buying cost comes from the engine (derived for MRP / net rate), not the raw input.
  const buying = (pv.buying_cost_paise != null ? pv.buying_cost_paise : r(l.purchase_cost)) * qty;
  const bt = (r(l.freight) + r(l.branding)) * qty;
  const sellable = (pv.landed_cost_paise != null) ? pv.landed_cost_paise * qty : (buying + bt);
  const sale = pv.line_taxable_paise || 0;
  const margin = pv.line_margin_paise;
  const cell = (label, val, cls) => `<span class="q-bk-cell"><span class="q-bk-l">${label}</span><span class="q-bk-v${cls ? ' ' + cls : ''}">${qMoney(val)}</span></span>`;
  const marginCls = (margin != null && margin < 0) ? 'q-bk-neg' : 'q-bk-pos';
  return `<div class="q-breakup" title="All figures pre-tax, for this line">
    ${cell('Buying cost', buying)}
    ${cell('Branding + transport', bt)}
    ${cell('Sellable cost', sellable)}
    ${cell('Sale price', sale)}
    ${margin != null ? cell('Margin', margin, marginCls) : ''}
  </div>`;
}
// Uniform sale-GST rate (%) across the lines, or null when the quote mixes rates.
function qUniformGstPct(pcts) {
  const set = Array.from(new Set((pcts || []).map(Number).filter(n => !isNaN(n))));
  return set.length === 1 ? set[0] : null;
}
// Tax-summary rows, labelled with the GST % when it is uniform. CGST/SGST each
// carry half the rate; IGST the full rate. A mixed-rate quote shows no %.
function qTaxRowsHtml(t, gstPct) {
  const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  if (t.igst_total) {
    return `<div class="q-row"><span>IGST${gstPct != null ? ` @ ${fmt(gstPct)}%` : ''}</span><span class="q-amt">${qMoney(t.igst_total)}</span></div>`;
  }
  const half = gstPct != null ? gstPct / 2 : null;
  return `<div class="q-row"><span>CGST${half != null ? ` @ ${fmt(half)}%` : ''}</span><span class="q-amt">${qMoney(t.cgst_total)}</span></div>`
    + `<div class="q-row"><span>SGST${half != null ? ` @ ${fmt(half)}%` : ''}</span><span class="q-amt">${qMoney(t.sgst_total)}</span></div>`;
}
function quotePreviewHtml(p) {
  const t = p.totals || {};
  const e = qState().editor;
  const rates = ((e && e.lines) || []).map(l => l.sale_gst_pct).concat(((e && e.charges) || []).map(c => c.gst_pct));
  const taxRows = qTaxRowsHtml(t, qUniformGstPct(rates));
  const hasDisc = t.discount_total_paise != null;
  const hasCharges = t.charges_total_paise != null;
  return `<div class="q-summary">
    ${hasDisc ? `<div class="q-row"><span>Line subtotal</span><span class="q-amt">${qMoney(t.gross_subtotal_paise)}</span></div>
    <div class="q-row"><span>Discount</span><span class="q-amt" style="color:var(--danger)">− ${qMoney(t.discount_total_paise)}</span></div>` : ''}
    ${hasCharges ? `<div class="q-row"><span>Charges</span><span class="q-amt">${qMoney(t.charges_total_paise)}</span></div>` : ''}
    <div class="q-row"><span>${hasDisc || hasCharges ? 'Taxable value' : 'Subtotal'}</span><span class="q-amt">${qMoney(t.subtotal_paise)}</span></div>
    ${taxRows}
    <div class="q-row"><span>Round off</span><span class="q-amt">${qMoney(t.round_off_paise)}</span></div>
    <div class="q-row q-grand"><span>Grand total</span><span>${qMoney(t.grand_total_paise)}</span></div>
    ${(p.lines && p.lines[0] && p.lines[0].line_margin_paise != null) ? (() => {
      const tm = p.lines.reduce((s, l) => s + (l.line_margin_paise || 0), 0);
      const pct = t.weighted_margin_bp != null ? (t.weighted_margin_bp / 100).toFixed(2) + '%' : '';
      return `<div class="q-row" style="margin-top:6px;border-top:1px dashed var(--border);padding-top:8px"><span>Total margin</span><span class="q-amt" style="color:${tm < 0 ? 'var(--danger)' : 'var(--success)'}">${qMoney(tm)}${pct ? ' · ' + pct : ''}</span></div>`;
    })() : ''}
  </div>`;
}
function quoteEditHeader(field, val) { const e = qState().editor; if (e) e[field] = val; }
// Regular ⇆ Gifting fork — drives the convert-to-order workflow. Re-renders the
// editor so the helper text under the toggle updates.
function quoteSetKind(k) { const e = qState().editor; if (!e) return; e.kind = (k === 'GIFTING' ? 'GIFTING' : 'REGULAR'); quoteRenderEditor(); }
// Searchable client combobox (custom, styled). Filtering re-renders the menu;
// selecting a row sets the stored client_id. An outside click closes the menu.
function quoteClientMenuHtml() {
  const e = qState().editor; const q = ((e && e.client_q) || '').trim().toLowerCase();
  const all = qState().clients || [];
  const rows = (q ? all.filter(c => (c.name || '').toLowerCase().includes(q) || (c.id || '').toLowerCase().includes(q)) : all).slice(0, 50);
  if (!rows.length) return `<div class="q-combo-empty">No clients match.</div>`;
  return rows.map(c => `<div class="q-combo-opt" ${dataAct('quoteClientSelect', c.id)}>${h(c.name || c.id)}${c.contact_email ? `<span class="q-combo-sub">${h(c.contact_email)}</span>` : ''}</div>`).join('');
}
function quoteClientShowMenu() {
  const m = document.getElementById('q-client-menu'); if (!m) return;
  m.innerHTML = quoteClientMenuHtml(); m.style.display = '';
}
function quoteClientFocus() { quoteClientShowMenu(); }
function quoteClientFilter(val) {
  const e = qState().editor; if (!e) return;
  e.client_q = val;
  const needle = (val || '').trim().toLowerCase();
  const match = (qState().clients || []).find(c => (c.name || '').toLowerCase() === needle || c.id === val);
  e.client_id = match ? match.id : '';   // exact typed match still resolves; a click is the usual path
  quoteClientShowMenu();
}
function quoteClientSelect(id) {
  const e = qState().editor; if (!e) return;
  const c = (qState().clients || []).find(x => x.id === id);
  e.client_id = id; e.client_q = c ? (c.name || id) : id;
  const inp = document.getElementById('q-client-input'); if (inp) inp.value = e.client_q;
  const m = document.getElementById('q-client-menu'); if (m) m.style.display = 'none';
}
// Close any open combo menu on a click/tap outside its own combo (added once).
if (typeof window !== 'undefined' && !window._qComboInit) {
  window._qComboInit = true;
  document.addEventListener('mousedown', (ev) => {
    document.querySelectorAll('.q-combo-menu').forEach((m) => {
      const combo = m.closest('.q-combo');
      if (m.style.display !== 'none' && !(combo && combo.contains(ev.target))) m.style.display = 'none';
    });
  });
}

// ── Place-of-supply / seller state: searchable Indian state + GST-code combo ──
// Value stored is the 2-letter state code (e.g. "KL"), which is what the GST engine
// compares against the seller's state code to decide CGST/SGST vs IGST. The same
// combo serves the editor (q-pos-input) and the admin seller field (qs-seller).
const QUOTE_STATES = [
  { code: 'JK', name: 'Jammu & Kashmir', gst: '01' }, { code: 'HP', name: 'Himachal Pradesh', gst: '02' },
  { code: 'PB', name: 'Punjab', gst: '03' }, { code: 'CH', name: 'Chandigarh', gst: '04' },
  { code: 'UK', name: 'Uttarakhand', gst: '05' }, { code: 'HR', name: 'Haryana', gst: '06' },
  { code: 'DL', name: 'Delhi', gst: '07' }, { code: 'RJ', name: 'Rajasthan', gst: '08' },
  { code: 'UP', name: 'Uttar Pradesh', gst: '09' }, { code: 'BR', name: 'Bihar', gst: '10' },
  { code: 'SK', name: 'Sikkim', gst: '11' }, { code: 'AR', name: 'Arunachal Pradesh', gst: '12' },
  { code: 'NL', name: 'Nagaland', gst: '13' }, { code: 'MN', name: 'Manipur', gst: '14' },
  { code: 'MZ', name: 'Mizoram', gst: '15' }, { code: 'TR', name: 'Tripura', gst: '16' },
  { code: 'ML', name: 'Meghalaya', gst: '17' }, { code: 'AS', name: 'Assam', gst: '18' },
  { code: 'WB', name: 'West Bengal', gst: '19' }, { code: 'JH', name: 'Jharkhand', gst: '20' },
  { code: 'OD', name: 'Odisha', gst: '21' }, { code: 'CG', name: 'Chhattisgarh', gst: '22' },
  { code: 'MP', name: 'Madhya Pradesh', gst: '23' }, { code: 'GJ', name: 'Gujarat', gst: '24' },
  { code: 'DN', name: 'Dadra & Nagar Haveli and Daman & Diu', gst: '26' }, { code: 'MH', name: 'Maharashtra', gst: '27' },
  { code: 'KA', name: 'Karnataka', gst: '29' }, { code: 'GA', name: 'Goa', gst: '30' },
  { code: 'LD', name: 'Lakshadweep', gst: '31' }, { code: 'KL', name: 'Kerala', gst: '32' },
  { code: 'TN', name: 'Tamil Nadu', gst: '33' }, { code: 'PY', name: 'Puducherry', gst: '34' },
  { code: 'AN', name: 'Andaman & Nicobar Islands', gst: '35' }, { code: 'TS', name: 'Telangana', gst: '36' },
  { code: 'AP', name: 'Andhra Pradesh', gst: '37' }, { code: 'LA', name: 'Ladakh', gst: '38' },
  { code: 'OT', name: 'Other Territory', gst: '97' },
];
function quoteStateLabel(code) {
  if (!code) return '';
  const s = QUOTE_STATES.find(x => x.code === (code || '').toUpperCase());
  return s ? `${s.name} (${s.code})` : code;
}
// Canonical 2-letter code for an input, preferring an explicit prior selection
// (data-code) before parsing the typed text.
function quoteStateValue(inputId) {
  const inp = document.getElementById(inputId); if (!inp) return '';
  if (inp.dataset && inp.dataset.code) return inp.dataset.code;
  const v = (inp.value || '').trim();
  const m = QUOTE_STATES.find(s => s.code.toLowerCase() === v.toLowerCase() || s.name.toLowerCase() === v.toLowerCase());
  return m ? m.code : v.toUpperCase();
}
function quoteStateOptsHtml(inputId) {
  const inp = document.getElementById(inputId);
  const q = ((inp && inp.value) || '').trim().toLowerCase();
  const rows = (q ? QUOTE_STATES.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.gst.includes(q)) : QUOTE_STATES).slice(0, 60);
  if (!rows.length) return `<div class="q-combo-empty">No states match.</div>`;
  return rows.map(s => `<div class="q-combo-opt" ${dataAct('quoteStatePick', inputId, s.code)}>${h(s.name)}<span class="q-combo-sub">${h(s.code)} · GST ${h(s.gst)}</span></div>`).join('');
}
function quoteStateShow(inputId) {
  const m = document.getElementById(inputId + '-menu'); if (!m) return;
  m.innerHTML = quoteStateOptsHtml(inputId); m.style.display = '';
}
function quoteStateFocus(inputId) { quoteStateShow(inputId); }
function quoteStateType(inputId, val) {
  const inp = document.getElementById(inputId);
  const needle = (val || '').trim().toLowerCase();
  const m = QUOTE_STATES.find(s => s.code.toLowerCase() === needle || s.name.toLowerCase() === needle || s.gst === needle);
  const code = m ? m.code : (val || '').trim().toUpperCase();
  if (inp) inp.dataset.code = code;
  if (inputId === 'q-pos-input') { const e = qState().editor; if (e) e.place_of_supply = code; }
  quoteStateShow(inputId);
}
function quoteStatePick(inputId, code) {
  const s = QUOTE_STATES.find(x => x.code === code);
  const inp = document.getElementById(inputId);
  if (inp) { inp.value = s ? `${s.name} (${s.code})` : code; inp.dataset.code = code; }
  if (inputId === 'q-pos-input') { const e = qState().editor; if (e) e.place_of_supply = code; }
  const m = document.getElementById(inputId + '-menu'); if (m) m.style.display = 'none';
}
function quoteEditLine(i, field, val) {
  const e = qState().editor; if (!e || !e.lines[i]) return;
  e.lines[i][field] = val;
  if (field === 'pricing_mode') { quoteRenderEditor(); return; }   // swap the per-method fields
  // Keep the live ex-GST hints in step as the price / margin / GST rate is typed.
  if (['net_rate', 'mrp', 'sale_gst_pct', 'purchase_margin', 'purchase_gst_pct'].includes(field)) {
    const el = document.getElementById('q-exgst-' + i);
    if (el) el.textContent = quoteExGstHint(e.lines[i]);
  }
  if (['purchase_cost', 'purchase_gst_pct', 'sale_gst_pct'].includes(field)) {
    const el = document.getElementById('q-excost-' + i);
    if (el) el.textContent = quoteExCostHint(e.lines[i]);
  }
}
function quoteEditLineItc(i, el) { const e = qState().editor; if (e && e.lines[i]) e.lines[i].itc_claimable = !!el.checked; }
function quoteEditLineIncl(i, el) { const e = qState().editor; if (e && e.lines[i]) { e.lines[i].price_inclusive_gst = !!el.checked; quoteRenderEditor(); } }
// Display-only ex-GST hints (floats are fine — never stored/hashed; the engine is
// authoritative). Net rate / MRP are GST-inclusive; MRP also shows the DERIVED
// buying cost (ex-MRP less the purchase margin), both ex- and incl-GST.
function quoteExGstHint(l) {
  const mode = l.pricing_mode || 'cost_markup';
  const saleGst = Number(l.sale_gst_pct) || 0;
  if (mode === 'net_rate') {
    const incl = Number(l.net_rate) || 0; if (incl <= 0) return '';
    return `ex-GST ₹${(incl / (1 + saleGst / 100)).toFixed(2)} @ ${saleGst}%`;
  }
  if (mode === 'mrp_discount') {
    const mrp = Number(l.mrp) || 0; if (mrp <= 0) return '';
    const exMrp = mrp / (1 + saleGst / 100);
    const margin = Number(l.purchase_margin) || 0;
    const pg = Number(l.purchase_gst_pct || l.sale_gst_pct) || 0;
    const cost = exMrp * (1 - margin / 100);
    const costIncl = cost * (1 + pg / 100);
    return `ex-MRP ₹${exMrp.toFixed(2)} · buying cost ₹${cost.toFixed(2)} ex / ₹${costIncl.toFixed(2)} incl GST`;
  }
  return '';
}
// Net-rate buying cost is entered GROSS; show its ex-GST value (purchase GST).
function quoteExCostHint(l) {
  if ((l.pricing_mode || 'cost_markup') !== 'net_rate') return '';
  const gross = Number(l.purchase_cost) || 0; if (gross <= 0) return '';
  const pg = Number(l.purchase_gst_pct || l.sale_gst_pct) || 0;
  return `ex-GST ₹${(gross / (1 + pg / 100)).toFixed(2)} @ ${pg}%`;
}
function quoteEditAddLine() { const e = qState().editor; if (e) { e.lines.push(quoteBlankLine()); quoteRenderEditor(); } }
function quoteEditRemoveLine(i) { const e = qState().editor; if (e && e.lines.length > 1) { e.lines.splice(i, 1); quoteRenderEditor(); } }
// Header discount + charges editor rows.
function quoteChargeHtml(c, i) {
  return `<div class="q-charge">
    <div class="form-row" style="margin-bottom:0">
      ${qField('Charge', `<input value="${h(c.label)}" ${dataInputVal('quoteEditCharge', i, 'label')} placeholder="e.g. Installation" maxlength="120">`)}
      ${qField('Amount (₹)', `<input type="number" min="0" step="0.01" value="${h(c.amount)}" ${dataInputVal('quoteEditCharge', i, 'amount')} placeholder="0">`)}
      ${qField('GST %', `<input type="number" min="0" step="1" value="${h(c.gst_pct)}" ${dataInputVal('quoteEditCharge', i, 'gst_pct')}>`)}
      <div class="form-field" style="justify-content:flex-end"><label>&nbsp;</label><button class="btn btn-danger btn-sm" ${dataAct('quoteEditRemoveCharge', i)}>Remove</button></div>
    </div>
  </div>`;
}
function quoteEditDiscount(field, val) { const e = qState().editor; if (!e) return; e[field] = val; if (field === 'discount_type') quoteRenderEditor(); }
function quoteEditCharge(i, field, val) { const e = qState().editor; if (e && e.charges[i]) e.charges[i][field] = val; }
function quoteEditAddCharge() { const e = qState().editor; if (e) { (e.charges = e.charges || []).push(quoteBlankCharge()); quoteRenderEditor(); } }
function quoteEditRemoveCharge(i) { const e = qState().editor; if (e && e.charges) { e.charges.splice(i, 1); quoteRenderEditor(); } }

// Build the server payload from the rupee/percent form (× 100 → paise, % → bp).
function quoteBuildPayload() {
  const e = qState().editor;
  const rupee = (v) => Math.round(Number(v || 0) * 100);
  const bp = (v) => Math.round(Number(v || 0) * 100);
  const lines = e.lines.map(l => {
    const mode = l.pricing_mode || 'cost_markup';
    const base = {
      sku: (l.sku || '').trim() || null, description: l.description || null,
      hsn: (l.hsn || '').trim() || null, uom: (l.uom || '').trim() || null,
      qty: Math.round(Number(l.qty || 0)), pricing_mode: mode,
      freight_alloc_paise: rupee(l.freight), branding_cost_paise: rupee(l.branding),
      sale_gst_bp: bp(l.sale_gst_pct), itc_claimable: !!l.itc_claimable,
    };
    // Purchase GST defaults to sale GST on the server when omitted.
    if (String(l.purchase_gst_pct || '').trim() !== '') base.purchase_gst_bp = bp(l.purchase_gst_pct);
    // cost_markup: ex-GST buying cost. net_rate: GROSS buying cost (server strips).
    // mrp_discount: no cost — server derives it from MRP − purchase margin.
    if (mode === 'cost_markup') return { ...base, purchase_cost_paise: rupee(l.purchase_cost), markup_bp: bp(l.markup_pct) };
    if (mode === 'net_rate') return { ...base, purchase_cost_paise: rupee(l.purchase_cost), net_rate_paise: rupee(l.net_rate), adjust_paise: rupee(l.adjust) };
    return { ...base, mrp_paise: rupee(l.mrp), purchase_margin_bp: bp(l.purchase_margin), discount_bp: bp(l.discount_pct) };
  });
  const payload = {
    client_id: e.client_id, place_of_supply: (e.place_of_supply || '').toUpperCase(),
    valid_until: e.valid_until || undefined,
    title: (e.title || '').trim(), payment_terms: (e.payment_terms || '').trim(),
    kind: e.kind === 'GIFTING' ? 'GIFTING' : 'REGULAR',
    lines, charges: [],
  };
  return payload;
}
async function quoteEditPreview() {
  const e = qState().editor; if (!e.client_id) { showToast('Pick a client first', 'error'); return; }
  const r = await api('/quotes/calc', { method: 'POST', body: JSON.stringify(quoteBuildPayload()) });
  if (r) {
    e.preview = r;
    // Re-render the editor so each line shows its freshly-computed cost breakup.
    quoteRenderEditor();
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
  openModal('Snooze reminder', `<div class="form-field"><label>Snooze until</label><input id="q-snooze-date" type="date" max="9999-12-31"></div>`,
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
      ${qField('Seller state code', `<div class="q-combo">
        <input id="qs-seller" value="${h(quoteStateLabel(s.seller_state_code || ''))}" data-code="${h((s.seller_state_code || '').toUpperCase())}" ${dataInputVal('quoteStateType', 'qs-seller')} data-focusact="quoteStateFocus" placeholder="Search state or code…" autocomplete="off">
        <div class="q-combo-menu" id="qs-seller-menu" style="display:none"></div>
      </div>`, 'Your GST state — decides intra vs inter-state tax')}
      ${qField('Default validity (days)', `<input id="qs-validity" type="number" min="1" value="${s.default_validity_days}">`)}
      ${qField('Approval threshold (₹)', `<input id="qs-threshold" type="number" min="0" value="${Math.round((s.approval_threshold_paise || 0) / 100)}">`, 'Finance leg required at/above this')}
      ${qField('Expiring window (days)', `<input id="qs-expwin" type="number" min="0" value="${s.expiring_window_days}">`)}
      ${qField('Number prefix', `<input id="qs-prefix" value="${h(s.number_prefix || '')}">`)}
      ${qField('Fallback approver (user id)', `<input id="qs-fallback" value="${h(s.fallback_approver_id || '')}" placeholder="optional">`)}
      ${qField('R1 — send + days', `<input id="qs-r1" type="number" min="0" value="${s.reminder_rules.R1_send_plus_days}">`)}
      ${qField('R2 — send + days', `<input id="qs-r2" type="number" min="0" value="${s.reminder_rules.R2_send_plus_days}">`)}
      ${qField('R3 — valid − days', `<input id="qs-r3" type="number" min="0" value="${s.reminder_rules.R3_valid_minus_days}">`)}
    </div>
    <div class="q-doc-terms">
      <div class="form-field"><label>Payment terms (on the customer document)</label>
        <input id="qs-payterms" value="${h(s.payment_terms || '')}" placeholder="e.g. 50% advance with PO, balance before dispatch">
        <span class="form-hint">Printed as the “Payment Terms” line. Leave blank to omit.</span></div>
      <div class="form-field"><label>Terms &amp; conditions (one per line)</label>
        <textarea id="qs-terms" rows="7" placeholder="One condition per line…">${h(s.terms || '')}</textarea>
        <span class="form-hint">Each line becomes a numbered clause on the quote document. Leave blank to omit the section.</span></div>
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
    seller_state_code: quoteStateValue('qs-seller'),
    default_validity_days: num('qs-validity', 30),
    approval_threshold_paise: Math.round(num('qs-threshold', 500000) * 100),
    expiring_window_days: num('qs-expwin', 3),
    number_prefix: document.getElementById('qs-prefix')?.value || 'GZ',
    fallback_approver_id: (document.getElementById('qs-fallback')?.value || '').trim() || null,
    reminder_rules: { R1_send_plus_days: num('qs-r1', 2), R2_send_plus_days: num('qs-r2', 7), R3_valid_minus_days: num('qs-r3', 2) },
    payment_terms: document.getElementById('qs-payterms')?.value || '',
    terms: document.getElementById('qs-terms')?.value || '',
  };
  const r = await api('/admin/quote-settings', { method: 'PUT', body: JSON.stringify(body) });
  if (r) { showToast('Settings saved'); renderQuoteAdmin(qMain()); }
}
