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
    </div>
    <div id="pi-body"><div class="loading-state"><div class="spinner"></div></div></div>`;
  piSwitchTab('queue', el.querySelector('#pi-tabs .tab-btn'));
}

function piSwitchTab(tab, btn) {
  document.querySelectorAll('#pi-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const body = document.getElementById('pi-body'); if (!body) return;
  if (tab === 'enrich') return piRenderEnrich(body);
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
  body.innerHTML = `
    <div class="card" style="padding:14px 16px;margin-bottom:14px">
      <label class="u-label">Find a product</label>
      <input id="pi-sku-q" class="input" placeholder="Search by name or SKU…" ${dataInput('piEnrichSearch')}>
      <div id="pi-sku-results" style="margin-top:8px;display:flex;flex-direction:column;gap:5px"></div>
    </div>
    <div id="pi-enrich-panel"></div>`;
}
async function piEnrichSearch() {
  const q = document.getElementById('pi-sku-q')?.value || '';
  const box = document.getElementById('pi-sku-results'); if (!box) return;
  if (q.trim().length < 2) { box.innerHTML = ''; return; }
  const data = await api('/catalog/products?q=' + encodeURIComponent(q));
  const items = (data?.products || []).slice(0, 8);
  box.innerHTML = items.map(p => `<button class="btn btn-secondary btn-sm" style="justify-content:flex-start;text-align:left" ${dataAct('piEnrichPick', p.sku, p.name)}>
      <b>${h(p.name)}</b> <span class="u-subtiny" style="font-family:monospace">${h(p.sku)}</span></button>`).join('')
    || '<div class="u-subtiny">No match.</div>';
}
function piEnrichPick(sku, name) {
  APP._piSku = sku;
  const panel = document.getElementById('pi-enrich-panel'); if (!panel) return;
  panel.innerHTML = `
    <div class="card" style="padding:15px 17px">
      <div style="font-weight:700;color:var(--navy);margin-bottom:8px">${h(name)} <span class="u-subtiny" style="font-family:monospace">${h(sku)}</span></div>
      <label class="u-label">Paste label text (ingredients + claims). Own OCR reads an image where available.</label>
      <textarea id="pi-label" class="input" rows="4" placeholder="Vegan. Ingredients: Oats, Almonds, Dark chocolate… No added sugar."></textarea>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary" ${dataAct('piRunExtract', sku)}>🧠 Run AI extract &amp; screen</button>
        <button class="btn btn-secondary" ${dataAct('catOpenProduct', sku)}>View product</button>
      </div>
      <div id="pi-extract-out" style="margin-top:12px"></div>
    </div>`;
}
async function piRunExtract(sku) {
  const text = document.getElementById('pi-label')?.value || '';
  if (!text.trim()) { showToast('Paste some label text first', 'error'); return; }
  const res = await api(`/catalog/products/${sku}/ai/extract`, { method: 'POST', body: JSON.stringify({ text }) });
  const out = document.getElementById('pi-extract-out'); if (!out) return;
  if (!res) return;
  out.innerHTML = `<div class="note" style="background:#eef7f5;border-radius:10px;padding:10px 12px;font-size:.83rem">
      Extracted <b>${res.ingredients}</b> ingredient(s), screened <b>${(res.claims || []).length}</b> claim(s) — all at <b>AI Screened</b>, none published.</div>
    ${(res.claims || []).map(c => `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;font-size:.85rem">
      <b>${h(c.label)}</b>${c.conflict ? '<span class="badge" style="background:#fbe4e2;color:#dc2626">conflict</span>' : '<span class="badge" style="background:#fcecd6;color:#d97706">review</span>'}
      <span class="u-subtiny">${h(c.result)}</span></div>`).join('')}
    <div style="margin-top:8px"><button class="btn btn-secondary btn-sm" ${dataActEl('piSwitchTab', 'queue')}>Go to verification queue →</button></div>`;
  showToast('Screened — sent to the verification queue');
}

/* ── Client: catalogue + product detail ────────────────────────────────── */
async function renderCatalogClient(el) {
  el.innerHTML = `${pageHeader('Catalogue', 'Browse approved products — with human-verified claims')}
    <div class="card" style="padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <input id="cat-q" class="input" placeholder="Search products…" ${dataInput('catFilter')} style="flex:1;min-width:180px">
      <label style="font-size:.85rem;display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" id="cat-verified" ${dataChange('catFilter')}> 4SYZ Verified only</label>
      <select id="cat-attr" class="input" ${dataChange('catFilter')} style="max-width:170px">
        <option value="">All dietary</option><option value="vegan">Vegan</option><option value="vegetarian">Vegetarian</option>
        <option value="gluten free">Gluten Free</option><option value="jain">Jain</option>
      </select>
    </div>
    <div id="cat-grid"><div class="loading-state"><div class="spinner"></div></div></div>`;
  catFilter();
}
async function catFilter() {
  const grid = document.getElementById('cat-grid'); if (!grid) return;
  const qs = new URLSearchParams();
  const q = document.getElementById('cat-q')?.value || ''; if (q) qs.set('q', q);
  if (document.getElementById('cat-verified')?.checked) qs.set('verified', '1');
  const attr = document.getElementById('cat-attr')?.value || ''; if (attr) qs.set('attribute', attr);
  const data = await api('/catalog/products?' + qs.toString());
  const items = data?.products || [];
  if (!items.length) { grid.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-title">No products</div><div class="empty-desc">Try clearing filters.</div></div>`; return; }
  grid.innerHTML = `<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">${items.length} product${items.length !== 1 ? 's' : ''}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px">${items.map(catCard).join('')}</div>`;
}
function catCard(p) {
  const price = p.client_price != null ? p.client_price : p.list_price;
  const av = { in: ['var(--success,#0d9488)', 'In stock'], low: ['#d97706', 'Low stock'], out: ['var(--danger,#dc2626)', 'On order'] }[p.availability] || ['var(--text-muted)', ''];
  return `<div class="card" style="padding:0;overflow:hidden;cursor:pointer" ${dataAct('catOpenProduct', p.sku)}>
    <div style="aspect-ratio:16/10;display:grid;place-items:center;font-size:2.2rem;background:var(--surface-2,#f0f2f5)">${p.emoji || '📦'}</div>
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
  const d = await api(`/catalog/products/${sku}`); if (!d) return;
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
  } else {
    const c = d.content;
    el.innerHTML = `<p style="color:var(--text-muted);line-height:1.6;font-size:.9rem">${c && c.description ? h(c.description) : 'No description yet.'}</p>
      <div class="u-subtiny" style="margin-top:8px">GST ${p_or(d, 'gst_rate')}% · MOQ ${d.product?.moq || '—'}</div>`;
  }
}
function p_or(d, k) { return d.product && d.product[k] != null ? d.product[k] : (d.pricing && d.pricing.gst_rate) || 18; }

function catAddToOrder(sku) {
  if (typeof addToCart === 'function') { addToCart(sku); showToast('Added to order'); }
  else showToast('Open “Place Order” to add this product', 'info');
}
