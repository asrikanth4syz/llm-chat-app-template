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
//   { rootEl, clientId, clients[], sessionId, idemKey, text, lines[] }
// and is MIRRORED to localStorage (SP_LS_KEY) after every change, so a review
// in progress survives navigation and reloads until the operator clears it or a
// draft is created. Each line carries the server's parsed shape plus client-side
// review overrides (chosen_sku, qty, action, merge_group, removed). Editing the
// product TEXT does not re-run matching in V1 — use "🔍 Search" to re-match.
// ============================================================================

const SP_LS_KEY = 'sp_draft_v1';

// ── Persistence (per-viewer convenience; never the source of truth) ──────────
// localStorage can throw (private mode / blocked) or be absent — every access is
// guarded and the page renders correctly with nothing saved.
function spPersist() {
  const sp = APP._sp || {};
  try {
    localStorage.setItem(SP_LS_KEY, JSON.stringify({
      clientId: sp.clientId || '', sessionId: sp.sessionId || null,
      idemKey: sp.idemKey || null, text: sp.text || '', lines: sp.lines || [],
    }));
  } catch { /* storage unavailable — in-memory state still works */ }
}
function spLoadDraft() {
  try { const raw = localStorage.getItem(SP_LS_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
function spForget() { try { localStorage.removeItem(SP_LS_KEY); } catch { /* ignore */ } }

// Confidence banding for the chip colour.
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

// ── Reconciliation counts: pasted vs mapped, for items AND quantity ──────────
// pasted   = every line the paste produced (what the operator handed us)
// mapped   = non-removed lines now tied to a catalogue SKU
// qtyPasted= Σ parsed quantity across all lines (needs-qty lines count 0)
// qtyMapped= Σ current quantity across resolved lines (what the order will carry)
function spCounts() {
  const lines = (APP._sp.lines || []);
  let pasted = lines.length, mapped = 0, removed = 0, unresolved = 0, qtyPasted = 0, qtyMapped = 0;
  for (const l of lines) {
    const q0 = Number(l.quantity); if (Number.isFinite(q0)) qtyPasted += q0;
    if (l.removed) { removed++; continue; }
    if (l.chosen_sku) mapped++;
    if (_spResolved(l)) qtyMapped += Number(l.qty); else unresolved++;
  }
  return { pasted, mapped, removed, unresolved, qtyPasted, qtyMapped, active: pasted - removed };
}

async function renderSmartPaste(el) {
  const sp = (APP._sp = APP._sp || {});
  sp.rootEl = el;

  // Restore an in-progress draft (survives navigation / reload until cleared).
  if (!sp._restored) {
    const saved = spLoadDraft();
    if (saved) {
      sp.clientId = saved.clientId || sp.clientId || '';
      sp.sessionId = saved.sessionId || null;
      sp.idemKey = saved.idemKey || null;
      sp.text = saved.text || '';
      sp.lines = Array.isArray(saved.lines) ? saved.lines : [];
    }
    sp._restored = true;
  }

  // Client list (scoped server-side: a client role gets exactly its own row).
  const clients = await api('/clients');
  if (!clients) return; // api() already toasted / logged out
  sp.clients = clients;
  // Default the client: keep the restored/prior choice if still valid, else
  // auto-pick when there is only one (the client-admin case), else leave unchosen.
  if (!sp.clientId || !clients.some(c => c.id === sp.clientId)) {
    sp.clientId = clients.length === 1 ? clients[0].id : '';
  }
  sp.lines = sp.lines || [];
  sp.text = sp.text || '';

  const picker = clients.length === 1
    ? `<div style="font-weight:700;color:var(--navy)">${h(clients[0].name)}</div>`
    : `<select id="sp-client" class="input" ${dataChangeVal('spSetClient')} style="min-width:240px;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px">
         <option value="">Select a client…</option>
         ${clients.map(c => `<option value="${h(c.id)}"${c.id === sp.clientId ? ' selected' : ''}>${h(c.name)}</option>`).join('')}
       </select>`;

  const hasDraft = sp.lines.length > 0 || !!sp.text.trim();

  el.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:var(--navy)">📋 Smart Paste Order</div>
      <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">Paste a free-text item + quantity list, review the matches, and create a draft order.</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      ${hasDraft ? `<button class="btn btn-secondary btn-sm" ${dataAct('spClear')}>Clear draft</button>` : ''}
      <button class="btn btn-secondary btn-sm" ${dataAct('navigate', 'orders')}>Orders</button>
    </div>
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
      style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:.9rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;outline:none">${h(sp.text)}</textarea>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px;flex-wrap:wrap">
      <div style="font-size:.75rem;color:var(--text-muted)">Up to 200 lines. Quantities are whole numbers; a line with only a measure (e.g. “5 kg”) asks you for a count.${hasDraft ? ' <span style="color:var(--success,#15803d)">· Draft saved — it stays here until you clear it.</span>' : ''}</div>
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
  spPersist();
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

  sp.text = text;
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
  spPersist();
  // Re-render the whole page so the header (Clear button + "saved" hint) appears.
  renderSmartPaste(sp.rootEl);
}

// Clear the whole session — the only thing that discards a saved draft.
function spClear() {
  const sp = APP._sp || {};
  sp.lines = []; sp.text = ''; sp.sessionId = null; sp.idemKey = null;
  spForget();
  // Clear the review instantly; renderSmartPaste rebuilds the rest after /clients.
  const rev = document.getElementById('sp-review'); if (rev) rev.innerHTML = '';
  renderSmartPaste(sp.rootEl);
}

// Re-render just the review section (table + footer).
function spRenderReview() {
  const rev = document.getElementById('sp-review');
  if (rev) rev.innerHTML = spReviewHtml();
}

function spReviewHtml() {
  const sp = APP._sp || {};
  const lines = sp.lines || [];
  if (!lines.length) return '';
  const c = spCounts();

  // Reconciliation strip above the table — pasted vs mapped at a glance.
  const recon = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="font-weight:800;color:var(--navy)">Review matches</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem;color:var(--text-muted)">
        <span><b style="color:var(--navy)">${c.mapped}</b> of <b style="color:var(--navy)">${c.pasted}</b> items mapped</span>
        <span>Qty <b style="color:var(--navy)">${c.qtyMapped}</b> of <b style="color:var(--navy)">${c.qtyPasted}</b> mapped</span>
        ${c.unresolved ? `<span style="color:var(--gold,#b45309)">${c.unresolved} to resolve</span>` : ''}
        ${c.removed ? `<span>${c.removed} removed</span>` : ''}
      </div>
    </div>`;

  const rows = lines.map(spRowHtml).join('');
  return `
  <div class="card"><div class="card-body" style="padding:0">
    ${recon}
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
  const c = spCounts();

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

  // Pasted-vs-mapped KPI tiles (same tileHtml component as the rest of the app).
  const tiles = [
    tileHtml({ label: 'Items (mapped / pasted)', value: `${c.mapped} / ${c.pasted}`, sub: c.removed ? `${c.removed} removed` : '', accent: 'var(--navy)' }),
    tileHtml({ label: 'Qty (mapped / pasted)', value: `${c.qtyMapped} / ${c.qtyPasted}`, accent: 'var(--navy)' }),
    tileHtml({ label: 'Subtotal', value: fmt(subtotal), sub: unpriced ? `excludes ${unpriced} unpriced` : '', accent: 'var(--gold,#b45309)' }),
  ].join('');

  return `
  <div class="card" style="margin-top:14px;position:sticky;bottom:0;z-index:5"><div class="card-body" style="padding:16px">
    <div class="tile-grid" style="margin:0 0 12px 0">${tiles}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div style="font-size:.8rem;color:var(--text-muted);max-width:420px">${hint}</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${dupGroupsExist
          ? `<button class="btn btn-secondary btn-sm" ${dataAct('spToggleMerge')}>${spAnyMerged() ? 'Unmerge duplicates' : 'Merge duplicate SKUs'}</button>`
          : ''}
        <button class="btn btn-gold" ${dataAct('spConfirm')} data-busy="Creating…" ${canConfirm ? '' : 'disabled style="opacity:.5;cursor:not-allowed"'}>Create draft order</button>
      </div>
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
  spPersist();
  // Refresh the footer + reconciliation + this row's status, keeping input focus.
  const st = document.getElementById('sp-status-' + lineNo);
  if (st) st.innerHTML = spStatusHtml(l);
  const ft = document.getElementById('sp-footer');
  if (ft) ft.innerHTML = spFooterHtml();
  spRefreshRecon();
}

// Update just the reconciliation numbers in place (no full re-render → keeps focus).
function spRefreshRecon() {
  const rev = document.getElementById('sp-review');
  const strip = rev && rev.querySelector('.card .card-body > div:first-child');
  if (!strip) return;
  const c = spCounts();
  const nums = strip.querySelector('div:last-child');
  if (nums) nums.innerHTML = `
    <span><b style="color:var(--navy)">${c.mapped}</b> of <b style="color:var(--navy)">${c.pasted}</b> items mapped</span>
    <span>Qty <b style="color:var(--navy)">${c.qtyMapped}</b> of <b style="color:var(--navy)">${c.qtyPasted}</b> mapped</span>
    ${c.unresolved ? `<span style="color:var(--gold,#b45309)">${c.unresolved} to resolve</span>` : ''}
    ${c.removed ? `<span>${c.removed} removed</span>` : ''}`;
}

function spPickCandidate(lineNo, value) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.chosen_sku = value || '';
  if (l.chosen_sku) l._searched = false; // chosen from the ranked list, not a search
  spPersist();
  spRenderReview();
}

function spRemoveLine(lineNo) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.removed = true; l.merge_group = null;
  spPersist();
  spRenderReview();
}
function spRestoreLine(lineNo) {
  const l = (APP._sp.lines || []).find(x => x.line_no === lineNo);
  if (!l) return;
  l.removed = false;
  spPersist();
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
  spPersist();
  spRenderReview();
}

// Inline SKU search — reuses parse-paste on a single search term so the candidate
// list is scored by the exact same client-scoped matcher.
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
  APP._sp._searchCands = cands;
}

function spSearchPick(lineNo, sku) {
  const sp = APP._sp || {};
  const l = (sp.lines || []).find(x => x.line_no === lineNo);
  const cand = (sp._searchCands || []).find(c => c.sku === sku);
  if (!l || !cand) return;
  l.candidates = [cand, ...(l.candidates || []).filter(c => c.sku !== sku)];
  l.chosen_sku = sku;
  l._searched = true;
  sp._searchCands = null;
  spPersist();
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
  // The draft became an order — discard the saved session and jump to it.
  sp.lines = []; sp.text = ''; sp.sessionId = null; sp.idemKey = null;
  spForget();
  navigate('orders', { tab: 'all' });
}
