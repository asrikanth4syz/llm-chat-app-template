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
  const conflicts = tasks.filter(t => String(t.screened_result || '').startsWith('conflict')).length;
  const kpi = (l, n, c) => `<div class="card" style="padding:14px 16px;border-top:3px solid ${c};margin-bottom:0">
      <div class="u-label">${l}</div><div style="font-size:1.9rem;font-weight:800;color:var(--navy);line-height:1">${n}</div></div>`;
  if (!tasks.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Queue clear</div>
      <div class="empty-desc">No claims awaiting verification.</div></div>`;
    return;
  }
  // group by sku
  const bySku = {};
  tasks.forEach(t => { (bySku[t.sku] = bySku[t.sku] || { name: t.product_name, brand: t.brand_name, sku: t.sku, rows: [] }).rows.push(t); });
  body.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:16px">
      ${kpi('Conflicts', conflicts, 'var(--danger)')}${kpi('Open claims', tasks.length, 'var(--warning)')}
    </div>
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
    <div class="card" style="padding:14px 16px;margin-bottom:14px;background:linear-gradient(180deg,#f7fafc,#fff)">
      <div style="font-weight:700;color:var(--navy);margin-bottom:10px;font-size:.9rem">How enrichment works</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
        ${step(1, 'Pick a product', 'Search the master catalogue')}
        ${step(2, 'Paste the label', 'Ingredients & claims — or scan an image')}
        ${step(3, 'AI screens it', 'Advisory only — never auto-published')}
        ${step(4, 'Verify & publish', 'A reviewer approves with evidence')}
      </div>
    </div>
    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <label class="u-label">Step 1 — Find a product</label>
      <input id="pi-sku-q" class="input" placeholder="Search by name or SKU…" ${dataInput('piEnrichSearch')}>
      <div id="pi-sku-results" style="margin-top:8px;display:flex;flex-direction:column;gap:5px"></div>
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
  items = items.slice(0, 10);
  if (!items.length) { box.innerHTML = `<div class="u-subtiny">No product matches “${h(q)}”.</div>`; return; }
  box.innerHTML = items.map(p => `<button class="btn btn-secondary btn-sm" style="justify-content:flex-start;text-align:left" ${dataAct('piEnrichPick', p.sku, p.name)}>
      <b>${h(p.name || p.sku)}</b> <span class="u-subtiny" style="font-family:monospace">${h(p.sku)}</span></button>`).join('');
}
const PI_EXAMPLE = 'Vegan. Gluten free. No added sugar.\nIngredients: Oats, Almonds, Dark chocolate (cocoa solids 55%), Dates, Sea salt.';
function piEnrichPick(sku, name) {
  APP._piSku = sku;
  const panel = document.getElementById('pi-enrich-panel'); if (!panel) return;
  panel.innerHTML = `
    <div class="card" style="padding:15px 17px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="font-weight:700;color:var(--navy)">${h(name)}</div>
        <span class="u-subtiny" style="font-family:monospace">${h(sku)}</span>
        <button class="btn btn-secondary btn-sm" style="margin-left:auto" ${dataAct('catOpenProduct', sku)}>👁 Preview client view</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <label class="u-label">Step 2 — Paste label text</label>
        <button class="linklike u-subtiny" style="background:none;border:none;color:var(--success,#0d9488);cursor:pointer" ${dataAct('piLoadExample')}>Load example</button>
      </div>
      <textarea id="pi-label" class="input" rows="5" placeholder="Paste the pack's ingredient list and any claims.\nExample:\n${h(PI_EXAMPLE)}"></textarea>
      <div class="u-subtiny" style="margin-top:5px">Tip: paste the whole ingredients line — brackets like “(INS 322)” are cleaned automatically. Claims such as “Vegan” or “No added sugar” are detected wherever they appear.</div>
      <div style="display:flex;gap:8px;margin-top:11px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" ${dataAct('piRunExtract', sku)}>🧠 Run AI extract &amp; screen</button>
        <span class="u-subtiny">or</span>
        <button class="btn btn-secondary" ${dataAct('piPickImage')}>📷 Scan a label photo</button>
        <input type="file" id="pi-image" accept="image/*" capture="environment" style="display:none" ${dataChange('piScanImage', sku)} data-el>
      </div>
      <div id="pi-extract-out" style="margin-top:13px"></div>
    </div>`;
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
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:9px 12px;font-size:.8rem;color:#92600e;display:flex;gap:8px">
          <span>🔒</span><span>All results are <b>AI-screened</b>, not published. A reviewer must approve each claim with evidence before clients can see it.</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" ${dataActEl('piSwitchTab', 'queue')}>Review in verification queue →</button>
          <button class="btn btn-secondary btn-sm" ${dataAct('catOpenProduct', sku)}>👁 Preview client view</button>
        </div>
      </div>
    </div>`;
  showToast(nothing ? 'Nothing detected — check the pasted text' : `Screened ${claims.length} claim(s) — sent to verification`, nothing ? 'info' : 'success');
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
  const cols = data.collections || [];
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
    <div style="font-weight:700;color:var(--navy);margin-bottom:8px">Existing collections</div>
    ${cols.length ? `<div style="display:flex;flex-direction:column;gap:9px">${cols.map(piCollectionRow).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🗂️</div><div class="empty-title">No collections yet</div><div class="empty-desc">Create one above.</div></div>`}`;
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

/* ── Client: catalogue + product detail ────────────────────────────────── */
async function renderCatalogClient(el) {
  APP._compare = [];   // fresh selection each time the catalogue is opened
  APP._catCollection = null;
  el.innerHTML = `${pageHeader('Catalogue', 'Browse approved products — with human-verified claims')}
    <div id="cat-collections" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>
    <div class="card" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="cat-q" class="input" placeholder="Search products…" ${dataInput('catFilter')} style="flex:1;min-width:180px">
      <label style="font-size:.85rem;display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" id="cat-verified" ${dataChange('catFilter')}> 4SYZ Verified only</label>
      <select id="cat-attr" class="input" ${dataChange('catFilter')} style="max-width:170px">
        <option value="">All dietary</option><option value="vegan">Vegan</option><option value="vegetarian">Vegetarian</option>
        <option value="gluten free">Gluten Free</option><option value="jain">Jain</option>
      </select>
    </div>
    <div id="cat-grid"><div class="loading-state"><div class="spinner"></div></div></div>
    <div id="cat-compare-bar" style="position:fixed;left:50%;transform:translateX(-50%);bottom:20px;z-index:60;display:none;align-items:center;gap:12px;background:var(--navy,#12324f);color:#fff;border-radius:30px;padding:10px 16px;box-shadow:0 6px 22px rgba(0,0,0,.25);font-size:.85rem"></div>`;
  catFilter();
  catLoadCollections();
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
function catShowAll() { APP._catCollection = null; catFilter(); catLoadCollections(); }
async function catOpenCollection(slug, name) {
  APP._catCollection = slug;
  catLoadCollections();
  const grid = document.getElementById('cat-grid'); if (!grid) return;
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div></div>`;
  const data = await api('/collections/' + encodeURIComponent(slug));
  const items = data?.products || [];
  grid.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-weight:700;color:var(--navy)">${h(name)}</span>
      <span style="font-size:.82rem;color:var(--text-muted)">${items.length} product${items.length !== 1 ? 's' : ''}</span>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto" ${dataAct('catShowAll')}>← All products</button>
    </div>
    ${items.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px">${items.map(catCard).join('')}</div>`
      : `<div class="empty-state"><div class="empty-icon">🗂️</div><div class="empty-title">Nothing in this collection yet</div></div>`}`;
  renderCompareBar();
}
async function catFilter() {
  APP._catCollection = null;   // a manual search/filter exits any active collection
  const grid = document.getElementById('cat-grid'); if (!grid) return;
  const qs = new URLSearchParams();
  const q = document.getElementById('cat-q')?.value || ''; if (q) qs.set('q', q);
  if (document.getElementById('cat-verified')?.checked) qs.set('verified', '1');
  const attr = document.getElementById('cat-attr')?.value || ''; if (attr) qs.set('attribute', attr);
  const data = await api('/catalog/products?' + qs.toString());
  const items = data?.products || [];
  const collBox = document.getElementById('cat-collections'); if (collBox && collBox.innerHTML) catLoadCollections();
  if (!items.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products</div><div class="empty-desc">Try clearing filters.</div></div>`; renderCompareBar(); return; }
  grid.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:.82rem;color:var(--text-muted)">${items.length} product${items.length !== 1 ? 's' : ''}</span>
      <span class="u-subtiny" style="margin-left:auto">Tip: tap ⇄ Compare on 2–3 products</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px">${items.map(catCard).join('')}</div>`;
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
function catClearCompare() { APP._compare = []; catFilter(); }
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
    return {
      sku: p.sku, name: p.name || p.sku, brand: p.brand_name || p.brand || '', emoji: p.emoji || '📦',
      price: pr.client_excl_gst != null ? pr.client_excl_gst : pr.list_excl_gst,
      mrp: p.mrp, pack: p.pack_size,
      verified: (d.claims || []).filter(c => c.status === 'verified').map(c => c.label),
      attrs: (d.attributes || []).filter(a => a.status === 'verified').map(a => a.attribute),
      allergens, nutrition: d.nutrition || {},
    };
  });

  const th = cols.map(c => `<th style="padding:10px 12px;text-align:left;vertical-align:top;min-width:150px;border-left:1px solid var(--border)">
      <div style="font-size:1.5rem">${c.emoji}</div>
      ${c.brand ? `<div style="font-size:.66rem;font-weight:800;color:var(--success,#0d9488);text-transform:uppercase">${h(c.brand)}</div>` : ''}
      <div style="font-weight:700;color:var(--navy);font-size:.86rem;line-height:1.25">${h(c.name)}</div>
    </th>`).join('');
  const row = (label, render, opts = {}) => `<tr style="border-top:1px solid var(--border)">
      <td style="padding:9px 12px;font-size:.76rem;color:var(--text-muted);font-weight:700;white-space:nowrap;vertical-align:top">${label}</td>
      ${cols.map(c => `<td style="padding:9px 12px;font-size:.83rem;color:var(--navy);border-left:1px solid var(--border);vertical-align:top;${opts.td || ''}">${render(c)}</td>`).join('')}
    </tr>`;
  const chips = (arr, bg, fg) => arr.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px">${arr.map(x => `<span class="badge" style="background:${bg};color:${fg}">${h(x)}</span>`).join('')}</div>` : '<span class="u-subtiny">—</span>';
  const nut = (k, unit) => row(k[0], c => c.nutrition[k[1]] != null ? `${c.nutrition[k[1]]}${unit || ''}` : '<span class="u-subtiny">—</span>');

  openModal('Compare products', `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table style="border-collapse:collapse;width:100%">
        <thead><tr><th style="width:96px"></th>${th}</tr></thead>
        <tbody>
          ${row('Price', c => `<b style="font-size:1rem">${fmt(c.price)}</b>${c.mrp ? `<div class="u-subtiny" style="text-decoration:line-through">${fmt(c.mrp)}</div>` : ''}`)}
          ${row('Pack', c => c.pack ? h(c.pack) : '<span class="u-subtiny">—</span>')}
          ${row('✔ Verified claims', c => chips(c.verified, 'var(--verify-bg,#dff3ef)', 'var(--success,#0d9488)'))}
          ${row('Dietary', c => chips(c.attrs, '#eef1f5', '#66738a'))}
          ${row('⚠ Allergens', c => c.allergens.length ? chips(c.allergens, '#fbe4e2', '#dc2626') : '<span class="u-subtiny" style="color:var(--success,#0d9488)">None flagged</span>')}
          ${nut(['Calories', 'calories'], '')}
          ${nut(['Protein', 'protein'], ' g')}
          ${nut(['Carbs', 'carbs'], ' g')}
          ${nut(['Sugar', 'sugar'], ' g')}
          ${nut(['Fat', 'fat'], ' g')}
          ${nut(['Fibre', 'fibre'], ' g')}
          ${nut(['Sodium', 'sodium'], ' mg')}
          ${row('', c => `<button class="btn btn-primary btn-sm" ${dataAct('catAddToOrderFromCompare', c.sku)}>Add to order</button>`)}
        </tbody>
      </table>
    </div>
    <div class="u-subtiny" style="margin-top:8px">Nutrition is per the product's stated basis (usually per 100 g). Allergens are matched against the FSSAI major-allergen list.</div>`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
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
        ${p.verified ? PI_BADGE.verified : ''}
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
    el.innerHTML = cl.length ? cl.map(c => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center"><b>${h(c.label)}</b>${piBadge(c.status)}</div>
      ${c.screened_result ? `<div class="u-subtiny" style="margin-top:5px">${h(c.screened_result)}</div>` : ''}
      ${(c.evidence || []).length ? `<div class="u-subtiny" style="margin-top:4px;color:var(--success,#0d9488)">Evidence: ${c.evidence.map(e => h(e.page_ref || e.doc_id || 'attached')).join(', ')}</div>` : ''}
    </div>`).join('') : '<div class="u-subtiny">No claims yet.</div>';
  } else if (t === 'prc') {
    el.innerHTML = catProcurementHtml(d.procurement || {});
  } else {
    const c = d.content;
    el.innerHTML = `<p style="color:var(--text-muted);line-height:1.6;font-size:.9rem">${c && c.description ? h(c.description) : 'No description yet.'}</p>
      <div class="u-subtiny" style="margin-top:8px">GST ${p_or(d, 'gst_rate')}% · MOQ ${d.product?.moq || '—'}</div>`;
  }
}
function p_or(d, k) { return d.product && d.product[k] != null ? d.product[k] : (d.pricing && d.pricing.gst_rate) || 18; }

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
