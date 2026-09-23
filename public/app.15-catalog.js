/* ============================================================
   Product Intelligence & Brand Catalogue (P0.3 internal + P0.4 client)
   - Ops/super_admin: verification queue + product enrichment (AI extract).
   - Client roles: browse approved catalogue + product detail with badges.
   Every dataAct target here is a real global (smoke-test enforced).
   ============================================================ */

function renderCatalog(el) {
  return ['super_admin', 'ops_admin'].includes(APP.user?.role) ? renderPIInternal(el) : renderCatalogClient(el);
}

const PI_BADGE = {
  verified: '<span class="badge" style="background:var(--verify-bg,#dff3ef);color:var(--success,#0d9488)">✔ 4SYZ Verified</span>',
  ai_screened: '<span class="badge" style="background:#fdf0dc;color:#b45309">◔ AI Screened</span>',
  ai_extracted: '<span class="badge" style="background:#eef1f5;color:#66738a">AI Extracted</span>',
  evidence_requested: '<span class="badge" style="background:#fcecd6;color:#d97706">Evidence requested</span>',
  expired: '<span class="badge" style="background:#f3f4f6;color:#9aa6b8">Verification expired</span>',
  rejected: '<span class="badge" style="background:#fbe4e2;color:#dc2626">Rejected</span>',
};
function piBadge(s) { return PI_BADGE[s] || `<span class="badge">${h(s || '')}</span>`; }

/* ── Internal: verification queue + enrich ─────────────────────────────── */
async function renderPIInternal(el) {
  el.innerHTML = `${pageHeader('Product Intelligence', 'AI-assisted extraction · human-verified claims')}
    <div class="tabs" id="pi-tabs" role="tablist">
      <button class="tab-btn active" ${dataActEl('piSwitchTab', 'queue')}>Verification queue</button>
      <button class="tab-btn" ${dataActEl('piSwitchTab', 'enrich')}>Enrich a product</button>
      <button class="tab-btn" ${dataActEl('piSwitchTab', 'collections')}>Collections</button>
    </div>
    <div id="pi-body"><div class="loading-state"><div class="spinner"></div></div></div>`;
  piSwitchTab('queue', el.querySelector('#pi-tabs .tab-btn'));
}

function piSwitchTab(tab, btn) {
  document.querySelectorAll('#pi-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const body = document.getElementById('pi-body'); if (!body) return;
  if (tab === 'enrich') return piRenderEnrich(body);
  if (tab === 'collections') return loadPICollections(body);
  return loadPIQueue(body);
}

async function loadPIQueue(body) {
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await api('/verification/queue'); if (!data) return;
  const tasks = data.tasks || [];
  const counts = data.counts || {};
  const conflicts = counts.conflicts != null ? counts.conflicts : tasks.filter(t => String(t.screened_result || '').startsWith('conflict')).length;
  const kpi = (l, n, c) => `<div class="card" style="padding:14px 16px;border-top:3px solid ${c};margin-bottom:0">
      <div class="u-label">${l}</div><div style="font-size:1.9rem;font-weight:800;color:var(--navy);line-height:1">${n}</div></div>`;
  const kpiRow = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:16px">
      ${kpi('Conflicts', conflicts, 'var(--danger,#dc2626)')}
      ${kpi('Open claims', counts.open != null ? counts.open : tasks.length, 'var(--warning,#d97706)')}
      ${kpi('Evidence requested', counts.evidence_requested || 0, '#0d9488')}
      ${kpi('Verified · 7 days', counts.verified_this_week || 0, 'var(--success,#0d9488)')}
    </div>`;
  if (!tasks.length) {
    body.innerHTML = `${kpiRow}<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Queue clear</div>
      <div class="empty-desc">No claims awaiting verification.</div></div>`;
    return;
  }
  // group by sku
  const bySku = {};
  tasks.forEach(t => { (bySku[t.sku] = bySku[t.sku] || { name: t.product_name, brand: t.brand_name, sku: t.sku, rows: [] }).rows.push(t); });
  body.innerHTML = `
    ${kpiRow}
    <div class="note" style="background:#fdf0dc;color:#b45309;border-radius:11px;padding:11px 14px;font-size:.82rem;margin-bottom:14px">
      ℹ AI extracts &amp; screens. A claim shows <b>4SYZ Verified</b> only after you approve the evidence — AI never publishes a verification.
    </div>
    ${Object.values(bySku).map(g => `
      <div class="card" style="padding:15px 17px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
          <b style="color:var(--navy);font-size:.95rem">${h(g.name || g.sku)}</b>
          <span class="u-subtiny" style="font-family:monospace">${h(g.sku)}</span>
          ${g.brand ? `<span class="u-subtiny">· ${h(g.brand)}</span>` : ''}
          <button class="btn btn-secondary btn-sm" style="margin-left:auto" ${dataAct('catOpenProduct', g.sku)}>View product</button>
        </div>
        ${g.rows.map(r => piTaskRow(r)).join('')}
      </div>`).join('')}`;
}

function piTaskRow(r) {
  const conflict = String(r.screened_result || '').startsWith('conflict');
  const conf = r.ai_confidence != null ? `AI ${Math.round(r.ai_confidence * 100)}%` : '';
  return `<div style="border-top:1px solid var(--border);padding:11px 0">
    <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
      <b style="color:var(--ink)">${h(r.label)}</b>
      <span class="u-subtiny" style="text-transform:capitalize">${h(r.category)}</span>
      ${conflict ? '<span class="badge" style="background:#fbe4e2;color:#dc2626">⚑ conflict</span>' : '<span class="badge" style="background:#fcecd6;color:#d97706">review</span>'}
      <span style="margin-left:auto;font-size:.76rem;color:var(--text-muted);font-weight:700">${conf}</span>
    </div>
    <div style="font-size:.82rem;color:var(--text-muted);margin-top:5px">${h(r.screened_result || '')}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">
      <button class="btn btn-success btn-sm" ${dataAct('piApprove', r.claim_id)}>✔ Approve</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('piAddEvidence', r.claim_id)}>📎 Add evidence</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('piRequestEvidence', r.claim_id)}>✉ Request evidence</button>
      <button class="btn btn-danger btn-sm" ${dataAct('piReject', r.claim_id)}>✕ Reject</button>
    </div>
  </div>`;
}

function piReload() { const b = document.getElementById('pi-body'); if (b) loadPIQueue(b); }

async function piApprove(claimId) {
  openModal('Approve claim', `
    <p style="color:var(--text-muted);font-size:.86rem;margin-bottom:10px">Publishing needs at least one piece of evidence. Set an optional review expiry.</p>
    <label class="u-label">Review expires</label>
    <input type="date" id="pi-expiry" class="input" style="margin-bottom:10px">
    <label style="display:flex;gap:7px;align-items:center;font-size:.84rem;margin-bottom:6px"><input type="checkbox" id="pi-na"> No evidence required for this attribute</label>
    <textarea id="pi-note" class="input" rows="2" placeholder="Reviewer note (optional)"></textarea>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-success" ${dataAct('piApproveConfirm', claimId)}>Publish as 4SYZ Verified</button>`);
}
async function piApproveConfirm(claimId) {
  const body = {
    expiry_date: document.getElementById('pi-expiry')?.value || null,
    evidence_not_applicable: !!document.getElementById('pi-na')?.checked,
    note: document.getElementById('pi-note')?.value || '',
  };
  const res = await api(`/claims/${claimId}/approve`, { method: 'POST', body: JSON.stringify(body) });
  closeModal();
  if (res) { showToast('Claim published as 4SYZ Verified'); piReload(); }
}
async function piReject(claimId) {
  const res = await api(`/claims/${claimId}/reject`, { method: 'POST', body: JSON.stringify({ note: 'Rejected by reviewer' }) });
  if (res) { showToast('Claim rejected'); piReload(); }
}
async function piRequestEvidence(claimId) {
  const res = await api(`/claims/${claimId}/request-evidence`, { method: 'POST', body: JSON.stringify({}) });
  if (res) { showToast('Evidence requested'); piReload(); }
}
function piAddEvidence(claimId) {
  openModal('Add evidence', `
    <label class="u-label">Document / page reference</label>
    <input id="pi-ev-page" class="input" placeholder="e.g. label-back.jpg · p.1" style="margin-bottom:10px">
    <label class="u-label">Extracted text / note</label>
    <textarea id="pi-ev-text" class="input" rows="3" placeholder="What the evidence shows"></textarea>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('piAddEvidenceConfirm', claimId)}>Attach evidence</button>`);
}
async function piAddEvidenceConfirm(claimId) {
  const res = await api(`/claims/${claimId}/evidence`, {
    method: 'POST',
    body: JSON.stringify({ page_ref: document.getElementById('pi-ev-page')?.value || '', extracted_text: document.getElementById('pi-ev-text')?.value || '' }),
  });
  closeModal();
  if (res) showToast('Evidence attached — you can now approve');
}

/* ── Internal: enrich (search a SKU → paste label → AI extract) ─────────── */
async function piRenderEnrich(body) {
  const step = (n, t, d) => `<div style="display:flex;gap:9px;align-items:flex-start">
      <div style="flex:none;width:22px;height:22px;border-radius:50%;background:var(--navy,#12324f);color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center">${n}</div>
      <div><div style="font-weight:700;font-size:.82rem;color:var(--navy)">${t}</div><div class="u-subtiny">${d}</div></div>
    </div>`;
  body.innerHTML = `
    <div class="card" style="padding:14px 16px;margin-bottom:14px;background:linear-gradient(180deg,var(--surface-2,#f7fafc),var(--surface,#fff))">
      <div style="font-weight:700;color:var(--navy);margin-bottom:10px;font-size:.9rem">How enrichment works</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px" id="pi-steps">
        ${step(1, 'Pick a product', 'Search the master catalogue')}
        ${step(2, 'Paste the label', 'Ingredients & claims — or scan an image')}
        ${step(3, 'AI screens it', 'Advisory only — never auto-published')}
        ${step(4, 'Verify & publish', 'A reviewer approves with evidence')}
      </div>
    </div>
    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <label class="u-label" style="display:block;margin-bottom:6px">Step 1 — Find a product</label>
      <div style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:10px;padding:9px 12px;background:var(--surface)">
        <span style="opacity:.6">🔎</span>
        <input id="pi-sku-q" placeholder="Search by product name or SKU…" ${dataInput('piEnrichSearch')} autocomplete="off"
          style="border:0;outline:0;background:transparent;flex:1;font-size:.9rem;color:var(--ink)">
      </div>
      <div id="pi-sku-results" style="margin-top:9px;display:flex;flex-direction:column;gap:6px"></div>
    </div>
    <div id="pi-enrich-panel"></div>`;
}
async function piEnrichSearch() {
  const q = document.getElementById('pi-sku-q')?.value || '';
  const box = document.getElementById('pi-sku-results'); if (!box) return;
  if (q.trim().length < 2) { box.innerHTML = ''; return; }
  box.innerHTML = '<div class="u-subtiny">Searching…</div>';
  // Prefer the catalogue endpoint; fall back to the core inventory search so the
  // picker works even if the catalogue overlay is unavailable.
  let items = [];
  const cat = await api('/catalog/products?q=' + encodeURIComponent(q));
  if (cat && Array.isArray(cat.products) && cat.products.length) items = cat.products;
  else {
    const inv = await api('/inventory?q=' + encodeURIComponent(q));
    if (Array.isArray(inv)) items = inv;
  }
  items = items.slice(0, 12);
  if (!items.length) { box.innerHTML = `<div class="u-subtiny">No product matches “${h(q)}”.</div>`; return; }
  const sel = APP._piSku;
  box.innerHTML = items.map(p => {
    const on = String(p.sku) === String(sel);
    return `<button ${dataAct('piEnrichPick', p.sku, p.name)}
      style="display:flex;align-items:center;gap:10px;text-align:left;width:100%;border:1px solid ${on ? 'var(--success,#0d9488)' : 'var(--border,#e5e8ee)'};background:${on ? 'var(--verify-bg,#dff3ef)' : 'var(--surface,#fff)'};border-radius:9px;padding:10px 12px;cursor:pointer">
      <span style="font-size:1.1rem">${p.emoji || '📦'}</span>
      <span style="flex:1"><b style="color:var(--navy)">${h(p.name || p.sku)}</b> <span class="u-subtiny" style="font-family:monospace">${h(p.sku)}</span></span>
      <span style="color:var(--success,#0d9488);font-weight:800;font-size:.8rem;white-space:nowrap">${on ? '✓ Selected' : 'Select →'}</span>
    </button>`;
  }).join('');
}
const PI_EXAMPLE = 'Vegan. Gluten free. No added sugar.\nIngredients: Oats, Almonds, Dark chocolate (cocoa solids 55%), Dates, Sea salt.';
function piEnrichReset() {
  APP._piSku = null;
  const panel = document.getElementById('pi-enrich-panel'); if (panel) panel.innerHTML = '';
  const box = document.getElementById('pi-sku-results'); if (box) box.innerHTML = '';
  const q = document.getElementById('pi-sku-q'); if (q) { q.value = ''; q.focus(); }
}
function piEnrichPick(sku, name) {
  APP._piSku = sku; APP._piName = name;
  // Collapse the results list into a clear "selected" state, so it's obvious what
  // was chosen and the long list gets out of the way.
  const box = document.getElementById('pi-sku-results');
  if (box) box.innerHTML = `<div style="display:flex;align-items:center;gap:10px;border:1.5px solid var(--success,#0d9488);background:var(--verify-bg,#dff3ef);border-radius:9px;padding:10px 12px">
      <span style="color:var(--success,#0d9488);font-weight:800;white-space:nowrap">✓ Selected</span>
      <span style="flex:1"><b style="color:var(--navy)">${h(name)}</b> <span class="u-subtiny" style="font-family:monospace">${h(sku)}</span></span>
      <button class="btn btn-secondary btn-sm" ${dataAct('piEnrichReset')}>Change</button>
    </div>`;
  const panel = document.getElementById('pi-enrich-panel'); if (!panel) return;
  panel.innerHTML = `
    <div class="card" style="padding:15px 17px;border-top:3px solid var(--success,#0d9488)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
        <label class="u-label" style="margin:0">Step 2 — Paste label text for <span style="color:var(--navy)">${h(name)}</span></label>
        <div style="display:flex;gap:12px;align-items:baseline">
          <button class="linklike u-subtiny" style="background:none;border:none;color:var(--success,#0d9488);cursor:pointer;padding:0" ${dataAct('piLoadExample')}>Load example</button>
          <button class="linklike u-subtiny" style="background:none;border:none;color:var(--success,#0d9488);cursor:pointer;padding:0" ${dataAct('catOpenProduct', sku)}>👁 Preview</button>
        </div>
      </div>
      <textarea id="pi-label" class="input" rows="5" style="margin-top:6px" placeholder="Paste the pack's ingredient list and any claims.\nExample:\n${h(PI_EXAMPLE)}"></textarea>
      <div class="u-subtiny" style="margin-top:5px">Tip: paste the whole ingredients line — brackets like “(INS 322)” are cleaned automatically. Claims such as “Vegan” or “No added sugar” are detected wherever they appear.</div>
      <div style="display:flex;gap:8px;margin-top:11px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" ${dataAct('piRunExtract', sku)}>🧠 Run AI extract &amp; screen</button>
        <span class="u-subtiny">or</span>
        <button class="btn btn-secondary" ${dataAct('piPickImage')}>📷 Scan a label photo</button>
        <input type="file" id="pi-image" accept="image/*" capture="environment" style="display:none" ${dataChange('piScanImage', sku)} data-el>
      </div>
      <div id="pi-extract-out" style="margin-top:13px"></div>
    </div>`;
  // Bring Step 2 into view so the next action is visible without scrolling.
  try { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch { panel.scrollIntoView(); }
  try { document.getElementById('pi-label')?.focus({ preventScroll: true }); } catch { /* older browsers */ }
}
function piPickImage() { document.getElementById('pi-image')?.click(); }
async function piScanImage(sku, el) {
  const file = el?.files?.[0]; if (!file) return;
  const out = document.getElementById('pi-extract-out');
  if (out) out.innerHTML = `<div class="u-subtiny">📷 Scanning label with on-platform OCR… this can take a few seconds.</div>`;
  let dataUrl;
  try { dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
  catch { if (out) out.innerHTML = ''; showToast('Could not read that image', 'error'); return; }
  const imageBase64 = String(dataUrl).replace(/^data:[^;]+;base64,/, '');
  const res = await api(`/catalog/products/${sku}/ai/extract`, { method: 'POST', body: JSON.stringify({ imageBase64 }) });
  el.value = '';   // allow re-selecting the same file
  if (!res) { if (out) out.innerHTML = ''; return; }
  // Show the transcription in the textarea so the user can review/correct it.
  const ta = document.getElementById('pi-label');
  if (ta && res.ocrText) ta.value = res.ocrText;
  piShowExtract(sku, res, true);
}
function piLoadExample() {
  const ta = document.getElementById('pi-label'); if (ta) { ta.value = PI_EXAMPLE; ta.focus(); }
}
async function piRunExtract(sku) {
  const text = document.getElementById('pi-label')?.value || '';
  if (!text.trim()) { showToast('Paste some label text first', 'error'); return; }
  const out = document.getElementById('pi-extract-out');
  if (out) out.innerHTML = `<div class="u-subtiny">🧠 Reading label…</div>`;
  const res = await api(`/catalog/products/${sku}/ai/extract`, { method: 'POST', body: JSON.stringify({ text }) });
  if (!res) { if (out) out.innerHTML = ''; return; }
  piShowExtract(sku, res, false);
}
function piShowExtract(sku, res, fromImage) {
  const out = document.getElementById('pi-extract-out'); if (!out) return;
  const ings = res.ingredientList || [];
  const claims = res.claims || [];
  const clr = c => c.conflict ? ['#fbe4e2', '#dc2626', 'Conflict'] : (c.confidence >= 0.75 ? ['#fcecd6', '#d97706', 'Review'] : ['#fcecd6', '#d97706', 'Needs review']);
  const nothing = !ings.length && !claims.length;
  const header = nothing ? '⚠ Nothing detected' : (fromImage ? '✓ Scanned from photo — here’s what AI read' : '✓ Step 3 — Here’s what AI read');

  out.innerHTML = `
    <div style="border:1px solid var(--border,#e5e8ee);border-radius:13px;overflow:hidden">
      <div style="background:${nothing ? '#fef3c7' : '#eef7f5'};padding:10px 14px;font-weight:700;color:var(--navy);font-size:.9rem;display:flex;align-items:center;gap:8px">
        ${header}
      </div>
      <div style="padding:13px 15px;display:flex;flex-direction:column;gap:14px">
        ${fromImage && res.ocrText ? `<div style="background:var(--surface-2,#f0f2f5);border-radius:9px;padding:9px 12px;font-size:.8rem;color:var(--navy)"><b>Transcribed text</b> (edit above &amp; re-run if needed):<div class="u-subtiny" style="margin-top:4px;white-space:pre-wrap">${h(res.ocrText)}</div></div>` : ''}
        ${nothing ? `<div class="u-subtiny">We couldn’t find an ingredient list or a recognised claim. ${fromImage ? 'Try a sharper, well-lit photo of the ingredients panel, or paste the text above.' : 'Paste the pack’s ingredient line (comma-separated) and claim words like “Vegan”, “Gluten free” or “No added sugar”, then try again.'}</div>` : `
          <div>
            <div class="u-label">Ingredients &nbsp;<span style="color:var(--success,#0d9488)">${ings.length}</span></div>
            ${ings.length ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${ings.map(i => `<span style="background:var(--surface-2,#f0f2f5);border-radius:8px;padding:4px 9px;font-size:.78rem;color:var(--navy)">${h(i)}</span>`).join('')}</div>` : '<div class="u-subtiny" style="margin-top:4px">None found in this text.</div>'}
          </div>
          <div>
            <div class="u-label">Screened claims &nbsp;<span style="color:var(--success,#0d9488)">${claims.length}</span></div>
            ${claims.length ? `<div style="margin-top:6px;display:flex;flex-direction:column;gap:6px">${claims.map(c => { const [bg, fg, lbl] = clr(c); return `<div style="display:flex;gap:9px;align-items:center;font-size:.85rem">
                <b style="color:var(--navy)">${h(c.label)}</b>
                <span class="badge" style="background:${bg};color:${fg}">${lbl}</span>
                <span class="u-subtiny">${h(c.result)}</span></div>`; }).join('')}</div>` : '<div class="u-subtiny" style="margin-top:4px">No recognised claims in this text.</div>'}
          </div>`}
        ${nothing ? '' : (claims.length
          ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px 12px;font-size:.8rem;color:#92600e;display:flex;gap:8px">
              <span>🔒</span><span>The ${claims.length} claim${claims.length !== 1 ? 's are' : ' is'} <b>AI-screened</b>, not published — sent to the verification queue. A reviewer must approve each with evidence before clients can see it.</span>
            </div>`
          : `<div style="background:var(--surface-2,#f0f2f5);border-radius:9px;padding:9px 12px;font-size:.8rem;color:var(--navy);display:flex;gap:8px">
              <span>✓</span><span>Ingredients saved. <b>No marketing claims</b> (e.g. “Vegan”, “No added sugar”, “High protein”) were found to screen — add any the pack makes to the text above and re-run.</span>
            </div>`)}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${claims.length ? `<button class="btn btn-primary btn-sm" ${dataActEl('piSwitchTab', 'queue')}>Review in verification queue →</button>` : ''}
          <button class="btn btn-secondary btn-sm" ${dataAct('catOpenProduct', sku)}>👁 Preview client view</button>
        </div>
      </div>
    </div>`;
  const toast = nothing
    ? ['Nothing detected — check the pasted text', 'info']
    : (claims.length
      ? [`Screened ${claims.length} claim${claims.length !== 1 ? 's' : ''} — sent to verification`, 'success']
      : [`Captured ${ings.length} ingredient${ings.length !== 1 ? 's' : ''} — no claims to screen`, 'success']);
  showToast(toast[0], toast[1]);
}

/* ── Internal: rule-driven collections (auto-curated shelves) ───────────── */
const PI_DIET_OPTS = ['', 'vegan', 'vegetarian', 'gluten free', 'jain'];
function piRuleSummary(rule) {
  const bits = [];
  if (rule.attribute) bits.push(rule.attribute);
  if (rule.verified) bits.push('4SYZ Verified');
  if (rule.category) bits.push(rule.category);
  if (rule.pmax) bits.push('≤ ' + fmt(rule.pmax));
  if (rule.pmin) bits.push('≥ ' + fmt(rule.pmin));
  if (rule.q) bits.push('“' + rule.q + '”');
  return bits.length ? bits.join(' · ') : 'All products';
}
async function loadPICollections(body) {
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await api('/collections'); if (!data) return;
  APP._piCollections = data.collections || [];
  const dietSel = PI_DIET_OPTS.map(o => `<option value="${o}">${o ? o.replace(/\b\w/g, m => m.toUpperCase()) : 'Any dietary'}</option>`).join('');
  body.innerHTML = `
    <div class="card" style="padding:15px 17px;margin-bottom:14px">
      <div style="font-weight:700;color:var(--navy);margin-bottom:4px">New collection</div>
      <div class="u-subtiny" style="margin-bottom:10px">A collection is a live shelf — products are matched by rule, so it stays current as the catalogue changes.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
        <div><label class="u-label">Name</label><input id="col-name" class="input" placeholder="e.g. Vegan snacks"></div>
        <div><label class="u-label">Dietary</label><select id="col-attr" class="input">${dietSel}</select></div>
        <div><label class="u-label">Category</label><input id="col-cat" class="input" placeholder="optional"></div>
        <div><label class="u-label">Max price (₹)</label><input id="col-pmax" class="input" type="number" min="0" placeholder="optional"></div>
      </div>
      <label style="display:flex;gap:7px;align-items:center;font-size:.85rem;margin-top:10px"><input type="checkbox" id="col-verified"> 4SYZ Verified only</label>
      <label style="display:flex;gap:7px;align-items:center;font-size:.85rem;margin-top:6px"><input type="checkbox" id="col-published" checked> Published (visible to clients)</label>
      <div style="margin-top:11px"><button class="btn btn-primary" ${dataAct('piSaveCollection')}>Create collection</button></div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <div style="font-weight:700;color:var(--navy)">Existing collections</div>
      <div style="margin-left:auto;flex:0 1 260px;display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:10px;padding:7px 11px;background:var(--surface)">
        <span style="opacity:.6">🔎</span>
        <input id="pi-col-q" placeholder="Search collections…" ${dataInput('piCollectionSearch')} autocomplete="off" style="border:0;outline:0;background:transparent;flex:1;font-size:.86rem;color:var(--ink)">
        <button id="pi-col-clear" ${dataAct('piCollectionClearSearch')} title="Clear" style="display:none;border:0;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.95rem;padding:0">✕</button>
      </div>
    </div>
    <div id="pi-col-list"></div>`;
  piRenderCollectionList('');
}
function piRenderCollectionList(q) {
  const wrap = document.getElementById('pi-col-list'); if (!wrap) return;
  const all = APP._piCollections || [];
  const term = (q || '').trim().toLowerCase();
  const cols = term ? all.filter(c => String(c.name || '').toLowerCase().includes(term)) : all;
  wrap.innerHTML = cols.length
    ? `<div style="display:flex;flex-direction:column;gap:9px">${cols.map(piCollectionRow).join('')}</div>`
    : (all.length
      ? `<div class="u-subtiny" style="padding:12px 0">No collection matches “${h(q)}”.</div>`
      : `<div class="empty-state"><div class="empty-icon">🗂️</div><div class="empty-title">No collections yet</div><div class="empty-desc">Create one above.</div></div>`);
}
function piCollectionSearch() {
  const q = document.getElementById('pi-col-q')?.value || '';
  const x = document.getElementById('pi-col-clear'); if (x) x.style.display = q ? '' : 'none';
  piRenderCollectionList(q);
}
function piCollectionClearSearch() {
  const q = document.getElementById('pi-col-q'); if (q) { q.value = ''; q.focus(); }
  piCollectionSearch();
}
function piCollectionRow(c) {
  return `<div class="card" style="padding:12px 15px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <div style="flex:1;min-width:160px">
      <div style="font-weight:700;color:var(--navy)">${h(c.name)} <span class="u-subtiny" style="font-weight:600">· ${c.count} product${c.count !== 1 ? 's' : ''}</span></div>
      <div class="u-subtiny">${h(piRuleSummary(c.rule || {}))}</div>
    </div>
    <span class="badge" style="background:${c.published ? 'var(--verify-bg,#dff3ef)' : '#eef1f5'};color:${c.published ? 'var(--success,#0d9488)' : '#66738a'}">${c.published ? 'Published' : 'Draft'}</span>
    <button class="btn btn-secondary btn-sm" ${dataAct('piToggleCollectionPublish', c.id, c.name, c.published ? 0 : 1, c.rule || {})}>${c.published ? 'Unpublish' : 'Publish'}</button>
  </div>`;
}
async function piSaveCollection() {
  const name = document.getElementById('col-name')?.value?.trim();
  if (!name) { showToast('Give the collection a name', 'error'); return; }
  const rule = {};
  const attr = document.getElementById('col-attr')?.value; if (attr) rule.attribute = attr;
  const cat = document.getElementById('col-cat')?.value?.trim(); if (cat) rule.category = cat;
  const pmax = document.getElementById('col-pmax')?.value; if (pmax) rule.pmax = Number(pmax);
  if (document.getElementById('col-verified')?.checked) rule.verified = true;
  const published = !!document.getElementById('col-published')?.checked;
  const res = await api('/collections', { method: 'POST', body: JSON.stringify({ name, rule, published }) });
  if (!res) return;
  showToast('Collection created', 'success');
  loadPICollections(document.getElementById('pi-body'));
}
async function piToggleCollectionPublish(id, name, published, rule) {
  // Carry the existing rule so the upsert doesn't wipe it.
  const res = await api('/collections', { method: 'POST', body: JSON.stringify({ id, name, rule: rule || {}, published: !!published }) });
  if (!res) return;
  showToast(published ? 'Published' : 'Unpublished', 'success');
  loadPICollections(document.getElementById('pi-body'));
}

/* ── Client: faceted catalogue (B5) ─────────────────────────────────────
   A base set is fetched once per search/collection; facets, sort and counts
   are then applied client-side over that set (≤ 500 rows), so toggling a facet
   never refetches. Counts are facet-aware (each option holds its own group out).
   ──────────────────────────────────────────────────────────────────────── */
const CAT_DIET = [['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'], ['gluten free', 'Gluten Free'], ['jain', 'Jain'], ['no added sugar', 'No Added Sugar'], ['no artificial colours', 'No Artificial Colours']];
const CAT_VER = [['verified', '4SYZ Verified'], ['ai', 'AI Screened'], ['none', 'Not yet verified']];
const CAT_AVAIL = [['in', 'In stock'], ['low', 'Low stock'], ['out', 'On order']];
function catPrice(p) { return Number(p.client_price != null ? p.client_price : p.list_price) || 0; }
function catNewFacet() { return { ver: new Set(), diet: new Set(), avail: new Set(), pmin: null, pmax: null }; }
// Does product p satisfy a single facet option? Shared by sidebar + counts.
function catOptTest(group, value, p) {
  if (group === 'ver') return value === 'verified' ? !!p.verified : value === 'ai' ? (p.screened && !p.verified) : (!p.verified && !p.screened);
  if (group === 'avail') return p.availability === value;
  return (p.attributes || []).includes(value);   // diet
}
function catInjectStyle() {
  if (document.getElementById('cat-b5-style')) return;
  const s = document.createElement('style'); s.id = 'cat-b5-style';
  s.textContent = `
    #cat-layout{display:grid;grid-template-columns:232px 1fr;gap:16px;align-items:start}
    #cat-side{position:sticky;top:70px;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 1px 3px rgba(16,24,40,.08);padding:13px 14px}
    #cat-side h5{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin:14px 0 6px}
    #cat-side h5:first-of-type{margin-top:0}
    .cat-fopt{display:flex;align-items:center;gap:9px;font-size:.83rem;color:var(--navy);padding:3px 0;cursor:pointer}
    .cat-fopt input{accent-color:var(--success,#0d9488);width:15px;height:15px;flex:none}
    .cat-fopt .ct{margin-left:auto;color:var(--text-muted);font-size:.76rem;font-variant-numeric:tabular-nums}
    .cat-fclose{display:none}
    #cat-scrim{display:none}
    @media(max-width:860px){
      #cat-layout{grid-template-columns:1fr}
      #cat-side{position:fixed;top:0;left:0;bottom:0;width:82%;max-width:320px;z-index:120;transform:translateX(-105%);transition:transform .25s ease;overflow:auto;border-radius:0}
      #cat-side.open{transform:none}
      .cat-fclose{display:block;width:100%;margin-bottom:10px;border:0;background:var(--surface-2,#f0f2f5);color:var(--navy);border-radius:9px;padding:9px;font-weight:800;cursor:pointer}
      #cat-scrim.open{display:block;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:115}
      #cat-filterbtn{display:inline-flex!important}
    }`;
  document.head.appendChild(s);
}
async function renderCatalogClient(el) {
  APP._compare = [];
  APP._catCollection = null;
  APP._catFacet = catNewFacet();
  APP._catSort = 'rec';
  APP._catBase = [];
  catInjectStyle();
  el.innerHTML = `${pageHeader('Catalogue', 'Browse approved products — with human-verified claims')}
    <div id="cat-collections" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
    <div id="cat-layout">
      <aside id="cat-side"></aside>
      <div>
        <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:12px">
          <button id="cat-filterbtn" class="btn btn-secondary btn-sm" style="display:none" ${dataAct('catToggleFilters')}>⚙ Filters</button>
          <div style="flex:1;min-width:170px;display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:10px;padding:8px 12px;background:var(--surface)">
            <span style="opacity:.6">🔎</span>
            <input id="cat-q" placeholder="Search products…" ${dataInput('catSearch')} autocomplete="off" style="border:0;outline:0;background:transparent;flex:1;font-size:.9rem;color:var(--ink)">
            <button id="cat-q-clear" ${dataAct('catClearSearch')} title="Clear search" style="display:none;border:0;background:transparent;color:var(--text-muted);cursor:pointer;font-size:1rem;line-height:1;padding:0">✕</button>
          </div>
          <select id="cat-sort" class="input" ${dataChange('catSortChange')} style="max-width:190px">
            <option value="rec">Sort: Recommended</option>
            <option value="p_asc">Price: Low → High</option>
            <option value="p_desc">Price: High → Low</option>
            <option value="name">Name: A → Z</option>
          </select>
        </div>
        <div id="cat-chips" style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-bottom:12px"></div>
        <div id="cat-grid"><div class="loading-state"><div class="spinner"></div></div></div>
      </div>
    </div>
    <div id="cat-scrim" ${dataAct('catCloseFilters')}></div>
    <div id="cat-compare-bar" style="position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:130;display:none;align-items:center;gap:12px;background:var(--navy,#12324f);color:#fff;border-radius:30px;padding:10px 16px;box-shadow:0 6px 22px rgba(0,0,0,.25);font-size:.85rem"></div>`;
  catLoadCollections();
  await catLoadBase();
}
// Chip helper: on = active shelf.
function catShelfChip(label, on, act, ...args) {
  return `<button ${dataAct(act, ...args)} style="border:1px solid ${on ? 'var(--success,#0d9488)' : 'var(--border,#e5e8ee)'};background:${on ? 'var(--success,#0d9488)' : 'var(--surface,#fff)'};color:${on ? '#fff' : 'var(--navy)'};border-radius:20px;padding:6px 13px;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap">${label}</button>`;
}
async function catLoadCollections() {
  const box = document.getElementById('cat-collections'); if (!box) return;
  const data = await api('/collections');
  const cols = (data?.collections || []).filter(c => c.count > 0);
  if (!cols.length) { box.innerHTML = ''; return; }
  box.innerHTML = catShelfChip('All products', !APP._catCollection, 'catShowAll')
    + cols.map(c => catShelfChip(`${h(c.name)} <span style="opacity:.7">${c.count}</span>`, APP._catCollection === c.slug, 'catOpenCollection', c.slug, c.name)).join('');
}
function catShowAll() { APP._catCollection = null; catLoadCollections(); catLoadBase(); }
async function catOpenCollection(slug) { APP._catCollection = slug; catLoadCollections(); catLoadBase(); }
// Fetch the base set (a collection's products, or the search results) once.
async function catLoadBase() {
  const grid = document.getElementById('cat-grid'); if (grid) grid.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  let items = [];
  if (APP._catCollection) {
    const data = await api('/collections/' + encodeURIComponent(APP._catCollection));
    items = data?.products || [];
  } else {
    const q = document.getElementById('cat-q')?.value || '';
    const data = await api('/catalog/products?' + (q ? 'q=' + encodeURIComponent(q) : ''));
    items = data?.products || [];
  }
  APP._catBase = items;
  catRenderSidebar();
  catApply();
}
// A product matches the active facets, optionally ignoring one group (for counts).
function catMatches(p, ignore) {
  const f = APP._catFacet;
  if (ignore !== 'ver' && f.ver.size) {
    const state = p.verified ? 'verified' : (p.screened ? 'ai' : 'none');
    if (!f.ver.has(state)) return false;
  }
  if (ignore !== 'diet' && f.diet.size && ![...f.diet].every(d => (p.attributes || []).includes(d))) return false;
  if (ignore !== 'avail' && f.avail.size && !f.avail.has(p.availability)) return false;
  if (ignore !== 'price') { const pr = catPrice(p); if (f.pmin != null && pr < f.pmin) return false; if (f.pmax != null && pr > f.pmax) return false; }
  return true;
}
function catRenderSidebar() {
  const side = document.getElementById('cat-side'); if (!side) return;
  const base = APP._catBase || [];
  const cnt = (group, value) => base.filter(p => catMatches(p, group) && catOptTest(group, value, p)).length;
  const opt = (group, value, label) => {
    if (!base.some(p => catOptTest(group, value, p))) return '';   // hide options nothing has
    const checked = APP._catFacet[group].has(value) ? 'checked' : '';
    return `<label class="cat-fopt"><input type="checkbox" class="cat-facet" data-group="${group}" value="${h(value)}" ${checked} ${dataChange('catFacetChange')}> ${label} <span class="ct" data-cc="${group}:${h(value)}">${cnt(group, value)}</span></label>`;
  };
  const grp = (title, rows) => rows.filter(Boolean).length ? `<h5>${title}</h5>${rows.filter(Boolean).join('')}` : '';
  side.innerHTML = `
    <button class="cat-fclose" ${dataAct('catCloseFilters')}>✕ Close filters</button>
    ${grp('Verification', CAT_VER.map(([v, l]) => opt('ver', v, l)))}
    ${grp('Dietary &amp; formulation', CAT_DIET.map(([v, l]) => opt('diet', v, l)))}
    ${grp('Availability', CAT_AVAIL.map(([v, l]) => opt('avail', v, l)))}
    <h5>Price (₹ / pack)</h5>
    <div style="display:flex;gap:7px;align-items:center">
      <input id="cat-pmin" class="input" type="number" min="0" placeholder="min" value="${APP._catFacet.pmin ?? ''}" ${dataInput('catPriceChange')} style="width:100%">
      <span style="color:var(--text-muted)">–</span>
      <input id="cat-pmax" class="input" type="number" min="0" placeholder="max" value="${APP._catFacet.pmax ?? ''}" ${dataInput('catPriceChange')} style="width:100%">
    </div>
    <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:14px" ${dataAct('catClearFilters')}>Clear all filters</button>`;
}
// Recompute facet counts in place (no rebuild) — used after a price keystroke so
// the number inputs keep focus.
function catUpdateCounts() {
  const base = APP._catBase || [];
  document.querySelectorAll('#cat-side .ct[data-cc]').forEach(span => {
    const [group, value] = span.getAttribute('data-cc').split(':');
    span.textContent = base.filter(p => catMatches(p, group) && catOptTest(group, value, p)).length;
  });
}
function catPriceChange() {
  const pmin = document.getElementById('cat-pmin')?.value; APP._catFacet.pmin = pmin === '' || pmin == null ? null : Number(pmin);
  const pmax = document.getElementById('cat-pmax')?.value; APP._catFacet.pmax = pmax === '' || pmax == null ? null : Number(pmax);
  catUpdateCounts();
  catApply();
}
// Re-read facet state from the DOM, then re-render (called on any facet change).
function catFacetChange() {
  const f = catNewFacet();
  document.querySelectorAll('.cat-facet:checked').forEach(i => f[i.dataset.group].add(i.value));
  const pmin = document.getElementById('cat-pmin')?.value; f.pmin = pmin === '' || pmin == null ? null : Number(pmin);
  const pmax = document.getElementById('cat-pmax')?.value; f.pmax = pmax === '' || pmax == null ? null : Number(pmax);
  APP._catFacet = f;
  catRenderSidebar();
  catApply();
}
function catSortChange(el) { APP._catSort = (el && el.value) || document.getElementById('cat-sort')?.value || 'rec'; catApply(); }
function catSearch() {
  const q = document.getElementById('cat-q')?.value || '';
  const x = document.getElementById('cat-q-clear'); if (x) x.style.display = q ? '' : 'none';
  APP._catCollection = null; catLoadCollections(); catLoadBase();
}
function catClearSearch() {
  const q = document.getElementById('cat-q'); if (q) { q.value = ''; q.focus(); }
  catSearch();
}
function catClearFilters() {
  APP._catFacet = catNewFacet();
  catRenderSidebar(); catApply();
}
function catRemoveChip(group, value) {
  const f = APP._catFacet;
  if (group === 'price') { f.pmin = f.pmax = null; }
  else f[group].delete(value);
  catRenderSidebar(); catApply();
}
function catToggleFilters() { document.getElementById('cat-side')?.classList.add('open'); document.getElementById('cat-scrim')?.classList.add('open'); }
function catCloseFilters() { document.getElementById('cat-side')?.classList.remove('open'); document.getElementById('cat-scrim')?.classList.remove('open'); }
// Apply facets + sort to the base set and render grid + active-filter chips.
function catApply() {
  const grid = document.getElementById('cat-grid'); if (!grid) return;
  const f = APP._catFacet;
  let list = (APP._catBase || []).filter(p => catMatches(p));
  const s = APP._catSort;
  if (s === 'p_asc') list = list.slice().sort((a, b) => catPrice(a) - catPrice(b));
  else if (s === 'p_desc') list = list.slice().sort((a, b) => catPrice(b) - catPrice(a));
  else if (s === 'name') list = list.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));

  // active-filter chips
  const chips = [];
  const verL = { verified: '4SYZ Verified', ai: 'AI Screened', none: 'Not verified' };
  f.ver.forEach(v => chips.push(['ver', v, verL[v]]));
  f.diet.forEach(v => chips.push(['diet', v, (CAT_DIET.find(d => d[0] === v) || [v, v])[1]]));
  f.avail.forEach(v => chips.push(['avail', v, (CAT_AVAIL.find(a => a[0] === v) || [v, v])[1]]));
  if (f.pmin != null || f.pmax != null) chips.push(['price', '', `₹${f.pmin ?? 0}–${f.pmax ?? '∞'}`]);
  const chipBox = document.getElementById('cat-chips');
  if (chipBox) chipBox.innerHTML = chips.map(([g, v, l]) =>
    `<button ${dataAct('catRemoveChip', g, v)} style="background:var(--verify-bg,#dff3ef);color:var(--success,#0d9488);border:0;border-radius:999px;padding:5px 11px;font-size:.74rem;font-weight:800;cursor:pointer">${h(l)} ✕</button>`).join('')
    + `<span style="margin-left:auto;color:var(--text-muted);font-size:.82rem;font-weight:700">${list.length} product${list.length !== 1 ? 's' : ''}</span>`;

  grid.innerHTML = list.length
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">${list.map(catCard).join('')}</div>`
    : `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products match</div><div class="empty-desc">Try clearing some filters.</div></div>`;
  renderCompareBar();
}

/* ── Product comparison (client) ───────────────────────────────────────── */
function catToggleCompare(sku, el) {
  APP._compare = APP._compare || [];
  const i = APP._compare.indexOf(sku);
  let on;
  if (i >= 0) { APP._compare.splice(i, 1); on = false; }
  else {
    if (APP._compare.length >= 3) { showToast('Compare up to 3 products', 'info'); return; }
    APP._compare.push(sku); on = true;
  }
  // Update just this button in place (no refetch) + refresh the bar.
  if (el) {
    el.innerHTML = `⇄ ${on ? 'Added' : 'Compare'}`;
    el.style.border = `1px solid ${on ? 'var(--success,#0d9488)' : 'var(--border,#e5e8ee)'}`;
    el.style.background = on ? 'var(--success,#0d9488)' : 'rgba(255,255,255,.92)';
    el.style.color = on ? '#fff' : 'var(--navy)';
  }
  renderCompareBar();
}
function catClearCompare() { APP._compare = []; if (typeof catApply === 'function') catApply(); renderCompareBar(); }
function renderCompareBar() {
  const bar = document.getElementById('cat-compare-bar'); if (!bar) return;
  const n = (APP._compare || []).length;
  if (n < 2) { bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  bar.innerHTML = `<span><b>${n}</b> selected</span>
    <button class="btn btn-sm" style="background:#fff;color:var(--navy);font-weight:700" ${dataAct('catCompare')}>Compare →</button>
    <button class="btn btn-sm" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,.5)" ${dataAct('catClearCompare')}>Clear</button>`;
}
async function catCompare() {
  const skus = (APP._compare || []).slice(0, 3);
  if (skus.length < 2) { showToast('Select at least 2 products', 'info'); return; }
  openModal('Compare products', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const details = (await Promise.all(skus.map(s => api('/catalog/products/' + encodeURIComponent(s))))).filter(Boolean);
  if (details.length < 2) { closeModal(); showToast('Could not load products to compare', 'error'); return; }
  APP._compareDetails = details;   // cache so "Add to order" keeps real name/price

  const cols = details.map(d => {
    const p = d.product || {}, pr = d.pricing || {};
    const allergens = [...new Set((d.ingredients || []).filter(i => i.allergen).map(i => i.raw_text))];
    const price = pr.client_excl_gst != null ? pr.client_excl_gst : pr.list_excl_gst;
    const pk = catParsePack(p.pack_size);
    return {
      sku: p.sku, name: p.name || p.sku, brand: p.brand_name || p.brand || '', emoji: p.emoji || '📦',
      price, mrp: p.mrp, pack: p.pack_size,
      per100: (pk.qty && Number(price)) ? Number(price) * 100 / pk.qty : null, unit: pk.unit,
      verified: (d.claims || []).filter(c => c.status === 'verified').map(c => c.label),
      attrs: (d.attributes || []).filter(a => a.status === 'verified').map(a => a.attribute),
      allergens, nutrition: d.nutrition || {},
    };
  });
  // Majority pack unit (for the per-100 row label); default grams.
  const unitCounts = {}; cols.forEach(c => { if (c.unit) unitCounts[c.unit] = (unitCounts[c.unit] || 0) + 1; });
  const majUnit = Object.keys(unitCounts).sort((a, b) => unitCounts[b] - unitCounts[a])[0] || 'g';
  const anyPer100 = cols.some(c => c.per100 != null);

  const th = cols.map(c => `<th style="padding:10px 12px;text-align:left;vertical-align:top;min-width:150px;border-left:1px solid var(--border)">
      <div style="font-size:1.5rem">${c.emoji}</div>
      ${c.brand ? `<div style="font-size:.66rem;font-weight:800;color:var(--success,#0d9488);text-transform:uppercase">${h(c.brand)}</div>` : ''}
      <div style="font-weight:700;color:var(--navy);font-size:.86rem;line-height:1.25">${h(c.name)}</div>
    </th>`).join('');
  // A row with optional "best value" highlighting. valFn returns a comparable
  // number (or null) per column; dir picks whether min or max wins. The winning
  // cell(s) are highlighted only when 2+ columns are comparable.
  const bestOf = (valFn, dir) => {
    const nums = cols.map(valFn).filter(v => v != null && isFinite(v));
    if (nums.length < 2) return null;
    return dir === 'max' ? Math.max(...nums) : Math.min(...nums);
  };
  const row = (label, render, valFn, dir) => {
    const target = valFn ? bestOf(valFn, dir) : null;
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:9px 12px;font-size:.76rem;color:var(--text-muted);font-weight:700;white-space:nowrap;vertical-align:top">${label}</td>
      ${cols.map(c => {
        const v = valFn ? valFn(c) : null;
        const win = target != null && v != null && isFinite(v) && v === target;
        const winCss = win ? 'background:var(--verify-bg,#dff3ef);color:var(--success,#0d9488);font-weight:800' : '';
        return `<td style="padding:9px 12px;font-size:.83rem;color:var(--navy);border-left:1px solid var(--border);vertical-align:top;${winCss}">${render(c)}${win ? ' ✓' : ''}</td>`;
      }).join('')}
    </tr>`;
  };
  const chips = (arr, bg, fg) => arr.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${arr.map(x => `<span class="badge" style="background:${bg};color:${fg}">${h(x)}</span>`).join('')}</div>` : '<span class="u-subtiny">—</span>';
  const num = (c, k) => (c.nutrition[k] != null && isFinite(Number(c.nutrition[k]))) ? Number(c.nutrition[k]) : null;
  const nut = (label, key, unit, dir) => row(label, c => c.nutrition[key] != null ? `${c.nutrition[key]}${unit || ''}` : '<span class="u-subtiny">—</span>', dir ? (c => num(c, key)) : null, dir);

  openModal('Compare products', `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="width:96px"></th>${th}</tr></thead>
        <tbody>
          ${row('Price', c => `<b style="font-size:1rem">${fmt(c.price)}</b>${c.mrp ? `<div class="u-subtiny" style="text-decoration:line-through">${fmt(c.mrp)}</div>` : ''}`, c => Number(c.price) || null, 'min')}
          ${row('Pack', c => c.pack ? h(c.pack) : '<span class="u-subtiny">—</span>')}
          ${anyPer100 ? row(`Price / 100 ${majUnit}`, c => c.per100 != null ? fmt(Math.round(c.per100 * 100) / 100) : '<span class="u-subtiny">—</span>', c => c.per100, 'min') : ''}
          ${row('✔ Verified claims', c => chips(c.verified, 'var(--verify-bg,#dff3ef)', 'var(--success,#0d9488)'))}
          ${row('Dietary', c => chips(c.attrs, '#eef1f5', '#66738a'))}
          ${row('⚠ Allergens', c => c.allergens.length ? chips(c.allergens, '#fbe4e2', '#dc2626') : '<span class="u-subtiny" style="color:var(--success,#0d9488)">None flagged</span>')}
          ${nut('Calories', 'calories', '')}
          ${nut('Protein', 'protein', ' g', 'max')}
          ${nut('Carbs', 'carbs', ' g')}
          ${nut('Sugar', 'sugar', ' g', 'min')}
          ${nut('Fat', 'fat', ' g')}
          ${nut('Fibre', 'fibre', ' g', 'max')}
          ${nut('Sodium', 'sodium', ' mg', 'min')}
          ${row('', c => `<button class="btn btn-primary btn-sm" ${dataAct('catAddToOrderFromCompare', c.sku)}>Add to order</button>`)}
        </tbody>
      </table>
    </div>
    <div class="u-subtiny" style="margin-top:8px">✓ marks the best value in a row (lowest price/sugar/sodium, highest protein/fibre). Per-100${majUnit === 'ml' ? ' ml' : ' g'} needs a parseable pack size. Nutrition is per the product's stated basis. Allergens use the FSSAI major-allergen list.</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}
// Parse a pack-size string into a total quantity + unit, e.g. "6 × 38 g" → 228 g,
// "Pack 150 g" → 150 g, "1 kg" → 1000 g. Returns {qty:null} when not parseable.
function catParsePack(s) {
  if (!s) return { qty: null, unit: null };
  const str = String(s).toLowerCase();
  const norm = (q, u) => { if (u === 'kg') return { qty: q * 1000, unit: 'g' }; if (u === 'l') return { qty: q * 1000, unit: 'ml' }; return { qty: q, unit: u }; };
  let m = str.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (m) return norm(parseFloat(m[1]) * parseFloat(m[2]), m[3]);
  m = str.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (m) return norm(parseFloat(m[1]), m[2]);
  return { qty: null, unit: null };
}
function catAddToOrderFromCompare(sku) {
  // Reuse the single-product add, sourcing name/price from the compare cache.
  const d = (APP._compareDetails || []).find(x => String(x.product?.sku) === String(sku));
  if (d) APP._catDetail = d;
  catAddToOrder(sku);
}
function catCard(p) {
  const price = p.client_price != null ? p.client_price : p.list_price;
  const av = { in: ['var(--success,#0d9488)', 'In stock'], low: ['#d97706', 'Low stock'], out: ['var(--danger,#dc2626)', 'On order'] }[p.availability] || ['var(--text-muted)', ''];
  const cmp = (APP._compare || []).includes(p.sku);
  return `<div class="card" style="padding:0;overflow:hidden;cursor:pointer" ${dataAct('catOpenProduct', p.sku)}>
    <div style="position:relative">
      <div style="aspect-ratio:16/10;display:grid;place-items:center;font-size:2.2rem;background:var(--surface-2,#f0f2f5)">${p.emoji || '📦'}</div>
      <button ${dataActEl('catToggleCompare', p.sku)} data-stop title="Add to compare"
        style="position:absolute;top:7px;right:7px;border:1px solid ${cmp ? 'var(--success,#0d9488)' : 'var(--border,#e5e8ee)'};background:${cmp ? 'var(--success,#0d9488)' : 'rgba(255,255,255,.92)'};color:${cmp ? '#fff' : 'var(--navy)'};border-radius:7px;font-size:.68rem;font-weight:800;padding:3px 7px;cursor:pointer;display:flex;align-items:center;gap:4px">⇄ ${cmp ? 'Added' : 'Compare'}</button>
    </div>
    <div style="padding:11px 12px;display:flex;flex-direction:column;gap:5px">
      ${p.brand ? `<div style="font-size:.7rem;font-weight:800;letter-spacing:.03em;color:var(--success,#0d9488);text-transform:uppercase">${h(p.brand)}</div>` : ''}
      <div style="font-weight:700;font-size:.9rem;color:var(--navy);line-height:1.25">${h(p.name)}</div>
      ${p.pack_size ? `<div style="font-size:.75rem;color:var(--text-muted)">${h(p.pack_size)}</div>` : ''}
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${p.verified ? PI_BADGE.verified : (p.screened ? PI_BADGE.ai_screened : '')}
        ${(p.attributes || []).slice(0, 2).map(a => `<span class="badge" style="background:#eef1f5;color:#66738a">${h(a)}</span>`).join('')}
      </div>
      <div style="display:flex;align-items:baseline;gap:7px;margin-top:2px">
        <span style="font-weight:800;font-size:1.05rem;color:var(--navy)">${fmt(price)}</span>
        ${p.mrp ? `<span style="font-size:.76rem;color:var(--text-muted);text-decoration:line-through">${fmt(p.mrp)}</span>` : ''}
        <span style="margin-left:auto;font-size:.72rem;font-weight:700;color:${av[0]}">● ${av[1]}</span>
      </div>
    </div></div>`;
}

async function catOpenProduct(sku) {
  openModal('Loading…', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const d = await api(`/catalog/products/${encodeURIComponent(sku)}`);
  if (!d) { closeModal(); return; }   // api() already surfaced the error toast
  const p = d.product || {}, pr = d.pricing || {};
  const price = pr.client_excl_gst != null ? pr.client_excl_gst : pr.list_excl_gst;
  const attrs = (d.attributes || []).filter(a => a.status === 'verified');
  const badges = `${(d.claims || []).some(c => c.status === 'verified') ? PI_BADGE.verified : ''}
    ${attrs.map(a => `<span class="badge" style="background:#eef1f5;color:#66738a">${h(a.attribute)}</span>`).join('')}`;
  APP._catDetail = d;
  openModal(`${p.emoji || '📦'} ${h(p.name || sku)}`, `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      ${p.brand_name ? `<span style="font-size:.72rem;font-weight:800;color:var(--success,#0d9488);text-transform:uppercase">${h(p.brand_name)}</span>` : ''}
      ${p.pack_size ? `<span class="u-subtiny">${h(p.pack_size)}</span>` : ''}
      <span style="margin-left:auto;font-weight:800;font-size:1.2rem;color:var(--navy)">${fmt(price)}</span>
      ${p.mrp ? `<span class="u-subtiny" style="text-decoration:line-through">${fmt(p.mrp)}</span>` : ''}
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">${badges || '<span class="u-subtiny">No verified claims yet</span>'}</div>
    <div class="tabs" id="cat-tabs">
      <button class="tab-btn active" ${dataActEl('catTab', 'ov')}>Overview</button>
      <button class="tab-btn" ${dataActEl('catTab', 'nut')}>Nutrition</button>
      <button class="tab-btn" ${dataActEl('catTab', 'ing')}>Ingredients</button>
      <button class="tab-btn" ${dataActEl('catTab', 'clm')}>Claims</button>
      ${(d.certifications || []).length ? `<button class="tab-btn" ${dataActEl('catTab', 'cert')}>Certifications</button>` : ''}
      ${d.procurement ? `<button class="tab-btn" ${dataActEl('catTab', 'prc')}>Procurement</button>` : ''}
    </div>
    <div id="cat-tab-body" style="min-height:80px"></div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
     <button class="btn btn-primary" ${dataAct('catAddToOrder', sku)}>Add to Order</button>`);
  catTab('ov', document.querySelector('#cat-tabs .tab-btn'));
}
function catTab(t, btn) {
  document.querySelectorAll('#cat-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const el = document.getElementById('cat-tab-body'); const d = APP._catDetail; if (!el || !d) return;
  if (t === 'nut') {
    const n = d.nutrition;
    el.innerHTML = n ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:9px">
      ${[['Calories', n.calories], ['Protein', n.protein], ['Carbs', n.carbs], ['Sugar', n.sugar], ['Fat', n.fat], ['Fibre', n.fibre], ['Sodium', n.sodium]]
        .map(([l, v]) => `<div style="background:var(--surface-2,#f0f2f5);border-radius:10px;padding:10px 12px"><div style="font-size:1.1rem;font-weight:800;color:var(--navy)">${v ?? '—'}</div><div class="u-subtiny">${l}</div></div>`).join('')}
      </div><div class="u-subtiny" style="margin-top:8px">Basis: ${h(n.basis || '')}</div>` : '<div class="u-subtiny">No nutrition data yet.</div>';
  } else if (t === 'ing') {
    const ing = d.ingredients || [];
    el.innerHTML = ing.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${ing.map(i => `<span style="background:var(--surface-2,#f0f2f5);border-radius:8px;padding:5px 10px;font-size:.8rem;${i.allergen ? 'color:var(--danger,#dc2626);font-weight:700' : ''}">${i.allergen ? '⚠ ' : ''}${h(i.raw_text)}</span>`).join('')}</div>` : '<div class="u-subtiny">No ingredients captured yet.</div>';
  } else if (t === 'clm') {
    const cl = d.claims || [];
    el.innerHTML = cl.length ? cl.map(c => {
      const evid = (c.evidence || []).length
        ? `<div class="u-subtiny" style="margin-top:4px;color:var(--success,#0d9488)">Evidence: ${c.evidence.map(e => h(e.page_ref || e.doc_id || 'attached')).join(', ')}</div>` : '';
      // Provenance line for a human-reviewed claim: who approved it, when, and
      // when the verification lapses (expired claims are flagged).
      const prov = [];
      if (c.reviewer_name) prov.push('Approved by <b>' + h(c.reviewer_name) + '</b>');
      if (c.reviewed_at) prov.push(h(String(c.reviewed_at).slice(0, 10)));
      const provLine = prov.length ? `<div class="u-subtiny" style="margin-top:4px">${prov.join(' · ')}</div>` : '';
      let expiry = '';
      if (c.expiry_date) {
        const expired = c.status === 'expired' || String(c.expiry_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
        expiry = `<div class="u-subtiny" style="margin-top:4px;color:${expired ? 'var(--danger,#dc2626)' : 'var(--text-muted)'}">${expired ? '⚠ Verification expired' : 'Valid until'} ${h(String(c.expiry_date).slice(0, 10))}</div>`;
      }
      return `<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center"><b>${h(c.label)}</b>${piBadge(c.status)}</div>
      ${c.screened_result ? `<div class="u-subtiny" style="margin-top:5px">${h(c.screened_result)}</div>` : ''}
      ${evid}${provLine}${expiry}
    </div>`;
    }).join('') : '<div class="u-subtiny">No claims yet.</div>';
  } else if (t === 'cert') {
    el.innerHTML = catCertHtml(d.certifications || []);
  } else if (t === 'prc') {
    el.innerHTML = catProcurementHtml(d.procurement || {});
  } else {
    const c = d.content;
    el.innerHTML = `<p style="color:var(--text-muted);line-height:1.6;font-size:.9rem">${c && c.description ? h(c.description) : 'No description yet.'}</p>
      <div class="u-subtiny" style="margin-top:8px">GST ${p_or(d, 'gst_rate')}% · MOQ ${d.product?.moq || '—'}</div>`;
  }
}
function p_or(d, k) { return d.product && d.product[k] != null ? d.product[k] : (d.pricing && d.pricing.gst_rate) || 18; }

// Certifications & documents (FSSAI / ISO / organic etc.) with a validity badge.
function catCertHtml(certs) {
  if (!certs.length) return '<div class="u-subtiny">No certifications on file for this product yet.</div>';
  const today = new Date().toISOString().slice(0, 10);
  return certs.map(c => {
    const to = c.valid_to ? String(c.valid_to).slice(0, 10) : '';
    const expired = to && to < today;
    const badge = expired
      ? '<span class="badge" style="background:#fbe4e2;color:#dc2626">expired</span>'
      : (c.status === 'verified'
        ? '<span class="badge" style="background:var(--verify-bg,#dff3ef);color:var(--success,#0d9488)">✔ verified</span>'
        : '<span class="badge" style="background:#eef1f5;color:#66738a">on file</span>');
    const span = [c.valid_from ? String(c.valid_from).slice(0, 10) : '', to].filter(Boolean).join(' → ');
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:11px 13px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <b style="color:var(--navy)">${h(c.kind || 'Certificate')}</b>${badge}
        ${c.number ? `<span class="u-subtiny" style="font-family:monospace">${h(c.number)}</span>` : ''}
      </div>
      <div class="u-subtiny" style="margin-top:4px">
        ${c.issuer ? 'Issuer: ' + h(c.issuer) : ''}${c.issuer && span ? ' · ' : ''}${span ? 'Valid ' + h(span) : ''}
      </div>
    </div>`;
  }).join('');
}

// Ops-only procurement view: cost/margin tiles + who supplies this SKU and at
// what rate (primary/secondary/cheapest flagged).
function catProcurementHtml(prc) {
  const tile = (label, val, color) => `<div style="background:var(--surface-2,#f0f2f5);border-radius:10px;padding:10px 12px">
      <div style="font-size:1.05rem;font-weight:800;color:${color || 'var(--navy)'}">${val}</div><div class="u-subtiny">${label}</div></div>`;
  const marginColor = prc.margin_pct == null ? 'var(--text-muted)' : (prc.margin_pct >= 0 ? 'var(--success,#0d9488)' : 'var(--danger,#dc2626)');
  const vendors = prc.vendors || [];
  const flag = (v) => [
    v.primary ? '<span class="badge" style="background:var(--verify-bg,#dff3ef);color:var(--success,#0d9488)">Primary</span>' : '',
    v.secondary ? '<span class="badge" style="background:#eef1f5;color:#66738a">Secondary</span>' : '',
    v.cheapest && vendors.length > 1 ? '<span class="badge" style="background:#fcecd6;color:#b45309">Lowest rate</span>' : '',
  ].join(' ');
  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px;margin-bottom:14px">
      ${tile('Cost (excl GST)', fmt(prc.cost_excl_gst || 0))}
      ${tile('List (excl GST)', fmt(prc.list_excl_gst || 0))}
      ${tile('MRP', prc.mrp ? fmt(prc.mrp) : '—')}
      ${tile('Margin', prc.margin_pct == null ? '—' : prc.margin_pct + '%', marginColor)}
    </div>
    <div class="u-label" style="margin-bottom:6px">Vendor rates ${vendors.length ? `<span style="color:var(--text-muted)">${vendors.length}</span>` : ''}</div>
    ${vendors.length ? `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:.83rem">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:.72rem;font-weight:700">Vendor</th>
        <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-size:.72rem;font-weight:700">Rate</th>
        <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-size:.72rem;font-weight:700">MOQ</th>
        <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-size:.72rem;font-weight:700">Lead</th>
      </tr></thead>
      <tbody>${vendors.map(v => `<tr style="border-top:1px solid var(--border)">
        <td style="padding:7px 8px;color:var(--navy)"><b>${h(v.vendor_name || '—')}</b> ${flag(v)}</td>
        <td style="padding:7px 8px;text-align:right;font-weight:700;color:var(--navy)">${v.rate ? fmt(v.rate) : '—'}</td>
        <td style="padding:7px 8px;text-align:right">${v.moq != null ? v.moq : '—'}</td>
        <td style="padding:7px 8px;text-align:right">${v.lead_days != null ? v.lead_days + 'd' : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`
      : `<div class="u-subtiny">No vendor rates on file for this product yet. Map vendors under Vendors → Products, or run a purchase order to populate rates.</div>`}
    <div class="u-subtiny" style="margin-top:10px">Cost &amp; margin are from the product master; vendor rates from the vendor catalogue. Prices exclude GST.</div>`;
}

function catAddToOrder(sku) {
  // Use the product detail already loaded into the modal for name/price/emoji.
  const d = APP._catDetail || {};
  const p = d.product || {}, pr = d.pricing || {};
  if (String(p.sku || sku) !== String(sku)) { /* stale detail */ }
  const price = pr.client_excl_gst != null ? pr.client_excl_gst : (pr.list_excl_gst != null ? pr.list_excl_gst : (p.unit_price || 0));
  const name = p.name || sku;
  APP.cart = APP.cart || [];
  const existing = APP.cart.find(c => c.sku === sku);
  if (existing) existing.qty += 1;
  else APP.cart.push({ sku, name, qty: 1, unit_price: price, emoji: p.emoji || '📦' });
  if (typeof persistCart === 'function') persistCart();
  if (typeof closeModal === 'function') closeModal();
  showToast(`${name} added to your order`, 'success');
}
