// ============================================================================
// Smart Paste Order (milestone 004, Group 3) — the paste → review → DRAFT UI.
//
// Backend: POST /api/orders/parse-paste (parse + match) and
//          POST /api/orders/from-paste  (confirm → DRAFT order).
// CSP-safe: no inline JS. Every interactive handler is a top-level global wired
// through the delegation helpers (dataAct / dataInputVal / dataChangeVal), so the
// smoke test's "all delegated targets resolve" check covers this file.
//
// State lives on APP._sp for the lifetime of one paste session:
//   { rootEl, clientId, clients[], sessionId, idemKey, lines[] }
// Each line carries the server's parsed shape plus client-side review overrides
// (chosen_sku, qty, action, merge_group, removed). Editing the product TEXT does
// not re-run matching in V1 — use "🔍 Search" to re-match an unmatched/changed
// line (stated in the PR; the open plan item is resolved this way).
// ============================================================================

// Order statuses the backend counts as history are its concern; the UI only ever
// sends line decisions. Confidence banding for the chip colour.
function _spConfColor(c) {
  if (c >= 85) return 'var(--success, #15803d)';
  if (c >= 60) return 'var(--gold, #b45309)';
  return 'var(--text-muted)';
}

// A line is "resolved" when it is not removed, has a chosen SKU, and a whole-number
// quantity ≥ 1 (R2-C14). Everything else that is not removed is "unresolved".
function _spResolved(l) {
  const q = Number(l.qty);
  return !l.removed && !!l.chosen_sku && Number.isInteger(q) && q >= 1;
}
// The full candidate object currently chosen on a line (for price + confidence).
function _spChosen(l) {
  if (!l.chosen_sku) return null;
  return (l.candidates || []).find(c => c.sku === l.chosen_sku) || null;
}
function _spPrice(l) { const c = _spChosen(l); const p = c ? Number(c.price) : NaN; return Number.isFinite(p) ? p : null; }

// The action verb reported per line, from how it was resolved (R2 api-contracts §2).
function _spAction(l) {
  if (l.removed) return 'removed';
  if (l.merge_group != null) return 'merged';
  if (l._searched) return 'searched';
  if (l.chosen_sku && l.chosen_sku !== l.selected_sku) return 'changed';
  return 'accepted';
}

async function renderSmartPaste(el) {
  const sp = (APP._sp = APP._sp || {});
  sp.rootEl = el;
  // Client list (scoped server-side: a client role gets exactly its own row).
  const clients = await api('/clients');
  if (!clients) return; // api() already toasted / logged out
  sp.clients = clients;
  // Default the client: keep a prior choice, else auto-pick when there is only one
  // (the client-admin case), else leave unchosen so ops explicitly selects.
  if (!sp.clientId || !clients.some(c => c.id === sp.clientId)) {
    sp.clientId = clients.length === 1 ? clients[0].id : '';
  }
  sp.lines = sp.lines || [];

  const picker = clients.length === 1
    ? `<div style="font-weight:700;color:var(--navy)">${h(clients[0].name)}</div>`
    : `<select id="sp-client" class="input" ${dataChangeVal('spSetClient')} style="min-width:240px;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px">
         <option value="">Select a client…</option>
         ${clients.map(c => `<option value="${h(c.id)}"${c.id === sp.clientId ? ' selected' : ''}>${h(c.name)}</option>`).join('')}
       </select>`;

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">📋 Smart Paste Order</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Paste a free-text item + quantity list, review the matches, and create a draft order.</div>
    </div>
    <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'orders')}>Orders</button>
  </div>

  <div class="card" style="margin-bottom:14px"><div class="card-body" style="padding:18px">
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
      <div>
        <label style="display:block;font-size:.75rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Client</label>
        ${picker}
      </div>
    </div>
    <label style="display:block;font-size:.75rem;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px">Paste items</label>
    <textarea id="sp-text" rows="8" placeholder="One item per line, e.g.&#10;Premium Coffee Beans - 4&#10;Green Tea Sachets x 2&#10;Sugar 5 kg"
      style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;outline:none"></textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px;flex-wrap:wrap">
      <div style="font-size:.75rem;color:var(--text-muted)">Up to 200 lines. Quantities are whole numbers; a line with only a measure (e.g. “5 kg”) asks you for a count.</div>
      <button class="btn btn-gold btn-sm" ${dataAct('spRunParse')} data-busy="Parsing…">Parse &amp; match →</button>
    </div>
  </div></div>

  <div id="sp-review">${APP._sp.lines.length ? spReviewHtml() : ''}</div>
  <div style="height:80px"></div>`;
}

// Change the selected client — a fresh client means a fresh parse session.
function spSetClient(value) {
  const sp = APP._sp || {};
  sp.clientId = value || '';
  sp.lines = [];
  sp.sessionId = null;
  const rev = document.getElementById('sp-review');
  if (rev) rev.innerHTML = '';
}

async function spRunParse() {
  const sp = APP._sp || {};
  const text = (document.getElementById('sp-text')?.value || '');
  if (!sp.clientId) { showToast('Pick a client first', 'info'); return; }
  if (!text.trim()) { showToast('Paste at least one line', 'info'); return; }

  const res = await api('/orders/parse-paste', {
    method: 'POST',
    body: JSON.stringify({ client_id: sp.clientId, text }),
  });
  if (!res) return; // api() surfaced the error (400 limits, 403/404, …)

  sp.sessionId = res.parse_session_id;
  // A stable idempotency key for THIS session's Confirm — reused on retry so a
  // network hiccup can never create two drafts.
  sp.idemKey = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : `sp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sp.lines = (res.lines || []).map(l => ({
    ...l,
    chosen_sku: l.selected_sku || '',
    qty: l.quantity != null ? l.quantity : (l.qty_suggested != null ? l.qty_suggested : ''),
    merge_group: null,
    removed: false,
    _searched: false,
  }));
  spRenderReview();
}

// Re-render the whole review section (table + footer).
function spRenderReview() {
  const rev = document.getElementById('sp-review');
  if (rev) rev.innerHTML = spReviewHtml();
}

function spReviewHtml() {
  const sp = APP._sp || {};
  const lines = sp.lines || [];
  if (!lines.length) return '';

  const rows = lines.map(spRowHtml).join('');
  return `
  <div class="card"><div class="card-body" style="padding:0">
    <div class="table-wrap"><table class="table" style="margin:0">
      <thead><tr>
        <th style="width:34px">#</th>
        <th>Item</th>
        <th style="width:96px">Qty</th>
        <th>Match</th>
        <th style="width:110px">Confidence</th>
        <th>Why</th>
        <th style="width:150px">Status</th>
        <th style="width:150px"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div></div>
  <div id="sp-footer">${spFooterHtml()}</div>`;
}

function spRowHtml(l) {
  const chosen = _spChosen(l);
  const conf = chosen ? chosen.confidence : null;
  const resolved = _spResolved(l);
  const tintBg = l.removed ? 'opacity:.5;' : (!resolved ? 'background:rgba(180,83,9,.06);' : '');

  // Match cell: a <select> of candidates (when any) + a Search button that always
  // lets the operator re-match against the client's catalogue.
  const opts = [`<option value="">— none —</option>`]
    .concat((l.candidates || []).map(c =>
      `<option value="${h(c.sku)}"${c.sku === l.chosen_sku ? ' selected' : ''}>${h(c.name)} · ${h(c.sku)}</option>`));
  // A chosen SKU that came from search is already unshifted into candidates, so the
  // select always lists the current choice.
  const matchCell = `
    <select ${dataChangeVal('spPickCandidate', l.line_no)} style="max-width:260px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px"${l.removed ? ' disabled' : ''}>
      ${opts.join('')}
    </select>
    <button class="btn btn-secondary btn-sm" style="margin-left:6px" ${dataAct('spSearchSku', l.line_no)}${l.removed ? ' disabled' : ''}>🔍</button>`;

  const confCell = conf != null
    ? `<span style="font-weight:800;color:${_spConfColor(conf)}">${conf}%</span>`
    : `<span style="color:var(--text-muted)">—</span>`;

  const why = (chosen && chosen.why || []).map(w =>
    `<span style="display:inline-block;background:var(--bg,#f1f5f9);border-radius:999px;padding:2px 8px;font-size:.72rem;margin:1px 2px">${h(w)}</span>`).join('') || '<span style="color:var(--text-muted)">—</span>';

  return `<tr style="${tintBg}">
    <td style="color:var(--text-muted)">${l.line_no}</td>
    <td>
      <div style="font-weight:600;color:var(--navy)">${h(l.product_text || '—')}</div>
      <div class="u-subtiny" style="color:var(--text-muted)">${h(l.raw)}</div>
    </td>
    <td><input type="number" min="1" step="1" value="${l.qty === '' || l.qty == null ? '' : h(String(l.qty))}"
        ${dataInputVal('spSetQty', l.line_no)} ${l.removed ? 'disabled' : ''}
        style="width:72px;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px"></td>
    <td>${matchCell}</td>
    <td>${confCell}</td>
    <td>${why}</td>
    <td id="sp-status-${l.line_no}">${spStatusHtml(l)}</td>
    <td>
      ${l.removed
        ? `<button class="btn btn-secondary btn-sm" ${dataAct('spRestoreLine', l.line_no)}>Restore</button>`
        : `<button class="btn btn-secondary btn-sm" ${dataAct('spRemoveLine', l.line_no)}>Remove</button>`}
    </td>
  </tr>`;
}

function spStatusHtml(l) {
  if (l.removed) return `<span class="badge" style="background:#e2e8f0;color:#475569">Removed</span>`;
  if (!l.chosen_sku) return `<span class="badge" style="background:#fee2e2;color:#b91c1c">Unmatched</span>`;
  const q = Number(l.qty);
  if (!(Number.isInteger(q) && q >= 1)) return `<span class="badge" style="background:#fef3c7;color:#92400e">Needs qty</span>`;
  if (l.merge_group != null) return `<span class="badge" style="background:#dbeafe;color:#1e40af">Merged</span>`;
  return `<span class="badge" style="background:#dcfce7;color:#166534">Ready</span>`;
}

function spFooterHtml() {
  const sp = APP._sp || {};
  const lines = (sp.lines || []);
  const active = lines.filter(l => !l.removed);
  const resolved = active.filter(_spResolved);
  const unresolved = active.filter(l => !_spResolved(l));
  const dupGroupsExist = spDuplicateSkus(resolved).length > 0;

  // Subtotal over resolved lines that have a price; count the unpriced ones aside.
  let subtotal = 0, unpriced = 0;
  for (const l of resolved) {
    const p = _spPrice(l);
    if (p == null || p === 0) unpriced++;
    else subtotal += p * Number(l.qty);
  }

  const canConfirm = resolved.length >= 1 && unresolved.length === 0;
  const hint = unresolved.length
    ? `${unresolved.length} line${unresolved.length > 1 ? 's' : ''} still need a match or quantity — resolve or remove ${unresolved.length > 1 ? 'them' : 'it'} to confirm.`
    : (resolved.length ? 'All lines resolved — ready to create the draft.' : 'Nothing to order yet.');

  const tiles = [
    tileHtml({ label: 'Resolved', value: `${resolved.length} of ${active.length}`, accent: 'var(--navy)' }),
    tileHtml({ label: 'Subtotal', value: fmt(subtotal), sub: unpriced ? `excludes ${unpriced} unpriced` : '', accent: 'var(--gold,#b45309)' }),
  ].join('');

  return `
  <div class="card" style="margin-top:14px;position:sticky;bottom:0;z-index:5"><div class="card-body" style="padding:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">${tiles}</div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:.8rem;color:var(--text-muted);max-width:340px">${hint}</div>
      ${dupGroupsExist
        ? `<button class="btn btn-secondary btn-sm" ${dataAct('spToggleMerge')}>${spAnyMerged() ? 'Unmerge duplicates' : 'Merge duplicate SKUs'}</button>`
        : ''}
      <button class="btn btn-gold" ${dataAct('spConfirm')} data-busy="Creating…" ${canConfirm ? '' : 'disabled'}>Create draft order</button>
    </div>
  </div></div>`;
}

// Lines sharing a chosen SKU — candidates for an operator-confirmed merge (R2-D3).
function spDuplicateSkus(resolvedLines) {
  const bySku = {};
  for (const l of resolvedLines) (bySku[l.chosen_sku] = bySku[l.chosen_sku] || []).push(l);
  return Object.keys(bySku).filter(sku => bySku[sku].length > 1);
}
function spAnyMerged() { return (APP._sp.lines || []).some(l => l.merge_group != null); }

function spSetQty(lineNo, value) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  const n = parseInt(value, 10);
  l.qty = (value === '' || isNaN(n)) ? '' : n;
  // Refresh only the footer + this row's status cell so the number input keeps focus.
  const st = document.getElementById('sp-status-' + lineNo);
  if (st) st.innerHTML = spStatusHtml(l);
  const ft = document.getElementById('sp-footer');
  if (ft) ft.innerHTML = spFooterHtml();
}

function spPickCandidate(lineNo, value) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.chosen_sku = value || '';
  if (l.chosen_sku) l._searched = false; // chosen from the ranked list, not a search
  spRenderReview();
}

function spRemoveLine(lineNo) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.removed = true; l.merge_group = null;
  spRenderReview();
}
function spRestoreLine(lineNo) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.removed = false;
  spRenderReview();
}

// Operator-confirmed merge: group every set of resolved lines that share a SKU
// under one merge_group so the backend sums their quantities into one order line.
function spToggleMerge() {
  const sp = APP._sp;
  if (spAnyMerged()) {
    for (const l of sp.lines) l.merge_group = null;
  } else {
    const resolved = sp.lines.filter(l => !l.removed && _spResolved(l));
    const dups = spDuplicateSkus(resolved);
    for (const sku of dups) for (const l of resolved) if (l.chosen_sku === sku) l.merge_group = 'm:' + sku;
  }
  spRenderReview();
}

// Inline SKU search — reuses parse-paste on a single search term so the candidate
// list is scored by the exact same client-scoped matcher. Lets an operator resolve
// an unmatched line or override a match.
function spSearchSku(lineNo) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  openModal('Find a catalogue item',
    `<div>
      <input type="text" id="sp-search-q" placeholder="Type a product name…" value="${h(l.product_text || '')}"
        ${dataEnter('spSearchRun', lineNo)} data-focus
        style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem">
      <div id="sp-search-results" style="margin-top:12px;max-height:320px;overflow:auto"></div>
    </div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
     <button class="btn btn-gold" ${dataAct('spSearchRun', lineNo)}>Search</button>`);
}

async function spSearchRun(lineNo) {
  const sp = APP._sp || {};
  const q = (document.getElementById('sp-search-q')?.value || '').trim();
  const box = document.getElementById('sp-search-results');
  if (!q) { if (box) box.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">Type a product name to search.</div>'; return; }
  if (box) box.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">Searching…</div>';
  const res = await api('/orders/parse-paste', { method: 'POST', body: JSON.stringify({ client_id: sp.clientId, text: q }) });
  if (!res) return;
  const cands = (res.lines && res.lines[0] && res.lines[0].candidates) || [];
  if (!box) return;
  if (!cands.length) { box.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">No catalogue items matched. Try a different name.</div>'; return; }
  box.innerHTML = cands.map(c => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
      <div style="min-width:0">
        <div style="font-weight:600;color:var(--navy)">${h(c.name)}</div>
        <div class="u-subtiny" style="color:var(--text-muted)">${h(c.sku)} · ${fmt(Number(c.price) || 0)} · ${c.confidence}%</div>
      </div>
      <button class="btn btn-gold btn-sm" ${dataActClose('spSearchPick', lineNo, h(c.sku))}>Choose</button>
    </div>`).join('');
  // Register the candidate objects so the pick can attach price/why to the line.
  APP._sp._searchCands = cands;
}

function spSearchPick(lineNo, sku) {
  const sp = APP._sp || {};
  const l = (sp.lines || []).find(x => x.line_no === lineNo);
  const cand = (sp._searchCands || []).find(c => c.sku === sku);
  if (!l || !cand) return;
  // Put the chosen candidate at the front of the line's candidate list so the
  // Match <select>, price, and confidence all resolve to it.
  l.candidates = [cand, ...(l.candidates || []).filter(c => c.sku !== sku)];
  l.chosen_sku = sku;
  l._searched = true;
  sp._searchCands = null;
  spRenderReview();
}

async function spConfirm() {
  const sp = APP._sp || {};
  const active = (sp.lines || []).filter(l => !l.removed);
  const resolved = active.filter(_spResolved);
  if (!resolved.length || active.some(l => !_spResolved(l))) {
    showToast('Resolve or remove every line before creating the draft', 'info');
    return;
  }
  // Send every non-removed line plus any removed ones (logged, not ordered).
  const payloadLines = (sp.lines || []).map(l => ({
    line_no: l.line_no,
    chosen_sku: l.removed ? null : l.chosen_sku,
    quantity: l.removed ? null : Number(l.qty),
    action: _spAction(l),
    merge_group: l.merge_group,
  }));

  const res = await api('/orders/from-paste', {
    method: 'POST',
    body: JSON.stringify({
      client_id: sp.clientId,
      parse_session_id: sp.sessionId,
      idempotency_key: sp.idemKey,
      lines: payloadLines,
    }),
  });
  if (!res || !res.id) return; // api() surfaced any 422/400

  showToast(`Draft order ${res.id} created`, 'success');
  // Fresh session for the next paste; then jump to the order the operator submits.
  APP._sp.lines = [];
  APP._sp.sessionId = null;
  navigate('orders', { tab: 'all' });
}
