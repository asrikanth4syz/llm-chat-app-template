/* ============================================================
   SMART CATALOGUE (client) + PRODUCT INTELLIGENCE (Super Admin / Ops)
   Brand & product intelligence: attributes, ingredients, nutrition,
   certifications, allergens, and a human Fitment Gate. Clients see only
   published (fitment APPROVED/CONDITIONAL) products; Super Admin + Ops review.
   ============================================================ */

let _catCssDone = false;
function injectCatCss() {
  if (_catCssDone) return; _catCssDone = true;
  const css = `
  .sc-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}
  .sc-toolbar input,.sc-toolbar select{padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:.82rem;background:var(--surface);color:var(--text)}
  .sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:14px}
  .sc-card{border:1px solid var(--border);border-radius:13px;background:var(--surface);overflow:hidden;display:flex;flex-direction:column;transition:transform .14s,box-shadow .14s}
  .sc-card:hover{transform:translateY(-2px);box-shadow:var(--shadow,0 6px 20px rgba(16,40,50,.1))}
  .sc-card .img{aspect-ratio:16/10;background:linear-gradient(135deg,var(--surface-2),var(--border));display:grid;place-items:center;font-size:2rem;position:relative}
  .sc-card .vb{position:absolute;top:8px;left:8px}
  .sc-card .cmp{position:absolute;top:8px;right:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:.62rem;font-weight:700;color:var(--text-muted);padding:3px 6px;display:flex;gap:4px;align-items:center;cursor:pointer}
  .sc-card .bd{padding:11px 12px;display:flex;flex-direction:column;gap:5px;flex:1}
  .sc-card .br{font-family:monospace;font-size:.62rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--primary)}
  .sc-card .nm{font-weight:700;font-size:.9rem;color:var(--navy);line-height:1.25}
  .sc-card .tags{display:flex;flex-wrap:wrap;gap:4px}
  .sc-tag{font-size:.62rem;font-weight:700;padding:2px 7px;border-radius:6px;background:var(--primary-light);color:var(--primary-hover)}
  .sc-card .ft{margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--border-light)}
  .sc-price{font-weight:800;color:var(--navy)} .sc-price s{font-weight:500;color:var(--text-light);font-size:.72rem;margin-left:4px}
  .vbadge{display:inline-flex;align-items:center;gap:4px;font-size:.66rem;font-weight:700;padding:3px 8px;border-radius:999px}
  .vb-ver{background:#dcfce7;color:#15803d} .vb-ai{background:#dbeafe;color:#1d4ed8} .vb-rev{background:#fef3c7;color:#b45309}
  .av{font-size:.64rem;font-weight:700;padding:2px 7px;border-radius:6px}
  .av-in{background:#dcfce7;color:#15803d} .av-low{background:#fef3c7;color:#b45309} .av-ord{background:#dbeafe;color:#1d4ed8}
  .prov{display:inline-flex;align-items:center;gap:5px;font-size:.66rem;font-weight:600;padding:2px 8px;border-radius:999px;font-family:monospace}
  .prov .d{width:7px;height:7px;border-radius:50%}
  .prov-4syz{background:#dcfce7;color:#15803d} .prov-4syz .d{background:#16a34a}
  .prov-brand{background:var(--surface-2);color:var(--text-muted)} .prov-brand .d{background:var(--text-light)}
  .pd-sec{border-top:1px solid var(--border-light);padding:14px 0}
  .pd-sec:first-child{border-top:none}
  .pd-sec h4{font-size:.95rem;font-weight:800;color:var(--navy);margin:0 0 6px;display:flex;gap:8px;align-items:center}
  .pd-sec .note{font-size:.74rem;color:var(--text-muted);margin-bottom:8px}
  .attrs{display:flex;flex-wrap:wrap;gap:7px}
  .attr{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border);border-radius:9px;padding:6px 10px;background:var(--surface-2);font-size:.8rem;font-weight:600}
  .attr .d{width:8px;height:8px;border-radius:50%} .attr .d4{background:#16a34a} .attr .db{background:var(--text-light)}
  .nutg{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
  .nutg .n{background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:8px 10px}
  .nutg .n .v{font-weight:800;color:var(--navy)} .nutg .n .l{font-size:.68rem;color:var(--text-muted)}
  .disc{margin-top:14px;background:var(--surface-2);border-left:3px solid var(--amber);border-radius:9px;padding:11px 14px;font-size:.76rem;color:var(--text-muted)}
  .disc b{color:var(--text)}
  .fitbtns{display:flex;gap:8px;flex-wrap:wrap}
  .pi-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--surface)}
  .pi-row .nm{font-weight:700;color:var(--navy);font-size:.88rem} .pi-row .br{font-family:monospace;font-size:.68rem;color:var(--text-muted)}
  .fstate{font-family:var(--font,inherit);font-weight:800;font-size:.68rem;padding:3px 10px;border-radius:999px}
  .fs-APPROVED{background:#dcfce7;color:#15803d}.fs-CONDITIONAL{background:#fef3c7;color:#b45309}.fs-PENDING{background:#e5e7eb;color:#4b5563}
  .fs-BLOCKED{background:#fee2e2;color:#b91c1c}.fs-EXPIRED{background:#fee2e2;color:#b91c1c}.fs-REVIEW{background:#fef3c7;color:#b45309}
  .kpi{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px}
  .kpi .k{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:12px 14px;border-top:3px solid var(--primary)}
  .kpi .k .v{font-size:1.6rem;font-weight:800;color:var(--navy)} .kpi .k .l{font-size:.7rem;color:var(--text-muted)}`;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
}

function _piInternal() { return ['super_admin','ops_admin','ops_manager'].includes(APP.user?.role); }
function verBadge(v) {
  if (v === 'verified')     return '<span class="vbadge vb-ver">✓ 4SYZ Verified</span>';
  if (v === 'ai_screened')  return '<span class="vbadge vb-ai">◐ AI Screened</span>';
  return '<span class="vbadge vb-rev">⚠ Needs Review</span>';
}
function availPill(a) {
  const c = a === 'In stock' ? 'av-in' : a === 'Low stock' ? 'av-low' : 'av-ord';
  return `<span class="av ${c}">${a}</span>`;
}

/* ── Client + internal: Smart Catalogue ─────────────────────────────────── */
async function renderSmartCatalogue(el) {
  injectCatCss();
  APP._cmp = APP._cmp || {};
  const data = await api('/catalogue');
  if (!data) return;
  APP._catItems = data.items || [];
  const brands = [...new Set(APP._catItems.map(i => i.brand).filter(Boolean))].sort();
  const cats = [...new Set(APP._catItems.map(i => i.category).filter(Boolean))].sort();
  el.innerHTML = `
    ${pageHeader('Smart Catalogue', 'Deep product intelligence — choose with confidence')}
    <div class="sc-toolbar">
      <input type="text" id="sc-q" placeholder="Search product or brand…" ${dataInput('scFilter')} style="flex:1;min-width:180px">
      <select id="sc-brand" ${dataChange('scFilter')}><option value="">All brands</option>${brands.map(b=>`<option>${h(b)}</option>`).join('')}</select>
      <select id="sc-cat" ${dataChange('scFilter')}><option value="">All categories</option>${cats.map(c=>`<option>${h(c)}</option>`).join('')}</select>
      <select id="sc-ver" ${dataChange('scFilter')}><option value="">Any verification</option><option value="verified">4SYZ Verified</option><option value="ai_screened">AI Screened</option><option value="needs_review">Needs Review</option></select>
      <button class="btn btn-secondary btn-sm" id="sc-cmpbtn" ${dataAct('openCompare')}>⇄ Compare (0)</button>
    </div>
    <div id="sc-grid" class="sc-grid"></div>`;
  scRenderGrid(APP._catItems);
}

function scRenderGrid(items) {
  const grid = document.getElementById('sc-grid');
  if (!grid) return;
  if (!items.length) { grid.innerHTML = `<div class="u-empty" style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted)">No products match these filters.</div>`; return; }
  grid.innerHTML = items.map(p => {
    const diet = (p.attributes || []).slice(0, 3).map(a => `<span class="sc-tag">${h(a.name)}</span>`).join('');
    const checked = APP._cmp[p.sku] ? 'checked' : '';
    return `<article class="sc-card">
      <div class="img" ${dataAct('viewProduct', p.sku)} style="cursor:pointer">${p.emoji || '📦'}
        <span class="vb">${verBadge(p.verification)}</span>
        <label class="cmp" onclick="event.stopPropagation()"><input type="checkbox" ${checked} ${dataActEl('toggleCompare', p.sku)} style="width:12px;height:12px;margin:0"> Compare</label>
      </div>
      <div class="bd">
        <span class="br">${h(p.brand || '—')}</span>
        <div class="nm" ${dataAct('viewProduct', p.sku)} style="cursor:pointer">${h(p.name)}</div>
        <div class="tags">${diet}</div>
        <div class="ft"><span class="sc-price">${fmt(p.price)}${p.mrp && p.mrp > p.price ? `<s>${fmt(p.mrp)}</s>` : ''}</span>${availPill(p.availability)}</div>
      </div>
    </article>`;
  }).join('');
}

function scFilter() {
  const q = (document.getElementById('sc-q')?.value || '').toLowerCase().trim();
  const b = document.getElementById('sc-brand')?.value || '';
  const c = document.getElementById('sc-cat')?.value || '';
  const v = document.getElementById('sc-ver')?.value || '';
  let items = APP._catItems || [];
  if (q) items = items.filter(i => (i.name + ' ' + i.brand).toLowerCase().includes(q));
  if (b) items = items.filter(i => i.brand === b);
  if (c) items = items.filter(i => i.category === c);
  if (v) items = items.filter(i => i.verification === v);
  scRenderGrid(items);
}

function toggleCompare(sku, elBox) {
  if (elBox.checked) { if (Object.keys(APP._cmp).length >= 4) { showToast('Compare up to 4 products', 'info'); elBox.checked = false; return; } APP._cmp[sku] = true; }
  else delete APP._cmp[sku];
  const btn = document.getElementById('sc-cmpbtn');
  if (btn) btn.textContent = `⇄ Compare (${Object.keys(APP._cmp).length})`;
}

/* ── Product detail (client-facing intelligence) ────────────────────────── */
async function viewProduct(sku) {
  injectCatCss();
  openModal('Loading…', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const d = await api(`/catalogue/${encodeURIComponent(sku)}`);
  if (!d) return;
  const p = d.product;
  const attrHtml = (d.attributes || []).length
    ? `<div class="attrs">${d.attributes.map(a => `<span class="attr"><span class="d ${a.source === '4syz' ? 'd4' : 'db'}"></span>${h(a.name)}</span>`).join('')}</div>`
    : `<div class="note">No attributes captured yet.</div>`;
  const certHtml = (d.certifications || []).length
    ? d.certifications.map(c => `<div class="certrow" style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border-light);flex-wrap:wrap">
        <div style="flex:1;min-width:150px"><b style="color:var(--navy)">${h(c.cert_type)}</b> ${c.number ? `<span class="mono" style="color:var(--text-muted);font-size:.76rem">${h(c.number)}</span>` : ''}
          <div style="font-size:.74rem;color:var(--text-muted)">${[c.issuer, c.status, c.expiry_date ? 'valid to ' + fmtDate(c.expiry_date) : ''].filter(Boolean).join(' · ')}</div></div>
        <span class="prov ${c.source === '4syz' ? 'prov-4syz' : 'prov-brand'}"><span class="d"></span>${c.source === '4syz' ? 'Checked 4SYZ' : 'Brand-declared'}</span>
      </div>`).join('')
    : `<div class="note">No certifications on file.</div>`;
  const nutHtml = (d.nutrition || []).length
    ? `<div class="nutg">${d.nutrition.map(n => `<div class="n"><div class="v">${h(n.value)}${n.unit ? ' ' + h(n.unit) : ''}</div><div class="l">${h(n.nutrient)}</div></div>`).join('')}</div>`
    : `<div class="note">Nutrition not captured yet.</div>`;
  const allerg = d.allergens || [];
  const contains = allerg.filter(a => a.contains_state === 'contains').map(a => a.allergen);
  const may = allerg.filter(a => a.cross_contact_state === 'declared' || a.contains_state === 'may_contain').map(a => a.allergen);

  const body = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-bottom:6px">
      <div style="font-size:3rem;background:var(--surface-2);border:1px solid var(--border);border-radius:14px;width:110px;height:96px;display:grid;place-items:center">${p.emoji || '📦'}</div>
      <div style="flex:1;min-width:200px">
        <div style="font-family:monospace;font-size:.7rem;text-transform:uppercase;color:var(--primary);font-weight:700">${h(p.brand || '—')}</div>
        <h3 style="font-size:1.3rem;font-weight:800;color:var(--navy);margin:3px 0">${h(p.name)}</h3>
        <div style="color:var(--text-muted);font-size:.82rem">${h(p.sub_category || p.category || '')} · <span class="mono">${h(p.sku)}</span></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:8px 12px;margin:10px 0">
          ${verBadge(p.verification)}
          <span style="font-size:.76rem;color:var(--text)">Submitted by the brand · <b style="color:#15803d">checked by 4SYZ</b>${p.reviewed_at ? ' · ' + fmtDate(p.reviewed_at) : ''}${p.expiry_date ? ' · valid to ' + fmtDate(p.expiry_date) : ''}</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:10px"><span style="font-size:1.5rem;font-weight:800;color:var(--navy)">${fmt(p.price)}</span>${p.mrp && p.mrp > p.price ? `<s style="color:var(--text-light)">${fmt(p.mrp)}</s>` : ''} ${availPill(p.availability)}</div>
      </div>
    </div>

    <div class="pd-sec"><h4>Attributes</h4>
      <div class="note">Dot shows the source — <span class="prov prov-4syz"><span class="d"></span>4SYZ-checked</span> or <span class="prov prov-brand"><span class="d"></span>brand-declared</span>.</div>
      ${attrHtml}
    </div>
    <div class="pd-sec"><h4>Certifications &amp; licence</h4>
      <div class="note">Evidence submitted by the brand and checked by 4SYZ — not an official regulatory approval.</div>
      ${certHtml}
    </div>
    <div class="pd-sec"><h4>Nutrition</h4>${nutHtml}</div>
    <div class="pd-sec"><h4>Allergens</h4>
      <div class="note">Absence of a detection is never shown as an "allergen-free" claim.</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div><div class="note" style="margin:0 0 4px">Contains</div>${contains.length ? contains.map(a => `<span class="sc-tag">${h(a)}</span>`).join(' ') : '<span class="note">None declared</span>'}</div>
        <div><div class="note" style="margin:0 0 4px">May contain</div>${may.length ? may.map(a => `<span class="sc-tag" style="background:#fef3c7;color:#b45309">${h(a)}</span>`).join(' ') : '<span class="note">None declared</span>'}</div>
      </div>
    </div>
    <div class="disc"><b>How to read this page.</b> Product information is submitted by the brand and checked by 4SYZ. Badges reflect 4SYZ's internal review, not a regulatory approval, certification, or a guarantee of legal compliance. Verify against the pack for any critical dietary or allergen decision.</div>`;

  const footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>
    ${_piInternal() ? `<button class="btn btn-primary" ${dataActClose('reviewProduct', p.sku)}>Review &amp; Fitment</button>` : `<button class="btn btn-primary">＋ Add to order</button>`}`;
  openModal(`${h(p.name)}`, body, footer);
  enableModalExpand();
}

/* ── Compare (client) ───────────────────────────────────────────────────── */
async function openCompare() {
  const skus = Object.keys(APP._cmp || {});
  if (skus.length < 2) { showToast('Pick 2–4 products to compare', 'info'); return; }
  openModal('Compare', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const details = await Promise.all(skus.map(s => api(`/catalogue/${encodeURIComponent(s)}`).catch(() => null)));
  const prods = details.filter(Boolean);
  const row = (label, fn) => `<tr><th style="text-align:left;font-family:monospace;font-size:.64rem;text-transform:uppercase;color:var(--text-muted);padding:9px 11px;background:var(--surface-2);white-space:nowrap">${label}</th>${prods.map(d => `<td style="padding:9px 11px;border-bottom:1px solid var(--border-light)">${fn(d)}</td>`).join('')}</tr>`;
  const body = `<div class="table-wrap"><table class="table" style="min-width:${140 + prods.length * 160}px">
    <thead><tr><th></th>${prods.map(d => `<th><div style="font-family:monospace;font-size:.62rem;text-transform:uppercase;color:var(--primary)">${h(d.product.brand)}</div><div style="font-weight:800;color:var(--navy)">${h(d.product.name)}</div></th>`).join('')}</tr></thead>
    <tbody>
      ${row('Price', d => `<b>${fmt(d.product.price)}</b>${d.product.mrp > d.product.price ? ` <s style="color:var(--text-light)">${fmt(d.product.mrp)}</s>` : ''}`)}
      ${row('Verification', d => verBadge(d.product.verification))}
      ${row('Attributes', d => (d.attributes || []).map(a => a.name).join(' · ') || '—')}
      ${row('Certifications', d => (d.certifications || []).map(c => c.cert_type).join(' · ') || '—')}
      ${row('Clean Label', d => d.product.clean_label === 'eligible' ? '<span class="sc-tag">Eligible</span>' : '<span class="sc-tag" style="background:#fef3c7;color:#b45309">Review</span>')}
      ${row('Availability', d => availPill(d.product.availability))}
    </tbody></table></div>`;
  openModal('Compare products', body, `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
  enableModalExpand();
}

/* ── Product Intelligence (Super Admin / Ops): review + Fitment Gate ─────── */
async function renderProductIntel(el) {
  injectCatCss();
  const data = await api('/catalogue');
  if (!data) return;
  const items = data.items || [];
  const pending = items.filter(i => i.fitment_state !== 'APPROVED' || i.verification !== 'verified');
  const list = (arr) => arr.map(p => `
    <div class="pi-row">
      <div style="font-size:1.4rem">${p.emoji || '📦'}</div>
      <div style="flex:1"><div class="nm">${h(p.name)}</div><div class="br">${h(p.brand || '—')} · ${h(p.sku)}</div></div>
      ${verBadge(p.verification)}
      <span class="fstate fs-${p.fitment_state}">${p.fitment_state}</span>
      <button class="btn btn-primary btn-sm" ${dataAct('reviewProduct', p.sku)}>Review</button>
    </div>`).join('') || `<div class="u-empty" style="padding:24px;text-align:center;color:var(--text-muted)">Nothing waiting.</div>`;
  el.innerHTML = `
    ${pageHeader('Product Intelligence', 'Review evidence and sign off the Fitment Gate before products go client-visible')}
    <div class="kpi">
      <div class="k"><div class="v">${items.filter(i => i.verification === 'verified').length}</div><div class="l">4SYZ Verified</div></div>
      <div class="k"><div class="v">${items.filter(i => i.verification === 'ai_screened').length}</div><div class="l">AI Screened</div></div>
      <div class="k"><div class="v">${items.filter(i => i.verification === 'needs_review').length}</div><div class="l">Needs Review</div></div>
      <div class="k"><div class="v">${pending.length}</div><div class="l">In review queue</div></div>
    </div>
    <div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 10px"><h3 style="font-weight:800;color:var(--navy);font-size:1rem">Review queue</h3><span style="color:var(--text-muted);font-size:.82rem">${pending.length} product${pending.length===1?'':'s'}</span></div>
    ${list(pending)}
    <div style="display:flex;align-items:baseline;gap:10px;margin:18px 0 10px"><h3 style="font-weight:800;color:var(--navy);font-size:1rem">Published</h3></div>
    ${list(items.filter(i => i.fitment_state === 'APPROVED' && i.verification === 'verified'))}`;
}

async function reviewProduct(sku) {
  injectCatCss();
  openModal('Loading…', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const d = await api(`/catalogue/${encodeURIComponent(sku)}`);
  if (!d) return;
  const p = d.product;
  APP._revAttrs = (d.attributes || []).map(a => ({ grp: a.grp, name: a.name, source: a.source }));
  const opt = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v}</option>`;
  const body = `
    <div class="aiflag" style="background:#dbeafe;color:#1d4ed8;border-radius:8px;padding:9px 12px;font-size:.76rem;margin-bottom:14px">
      ◐ <b>AI is Phase 2.</b> For now every field is entered and verified by a human. Nothing here is a regulatory approval.
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div style="font-size:1.6rem">${p.emoji || '📦'}</div>
      <div style="flex:1"><div style="font-family:monospace;font-size:.66rem;text-transform:uppercase;color:var(--primary)">${h(p.brand || '—')}</div><h3 style="font-weight:800;color:var(--navy)">${h(p.name)} <span class="mono" style="font-size:.78rem;color:var(--text-muted)">${h(p.sku)}</span></h3></div>
      <span class="fstate fs-${p.fitment_state}">${p.fitment_state}</span>
    </div>

    <div class="form-group"><label>Attributes <span style="color:var(--text-muted);font-weight:400">(name : group : source)</span></label>
      <div id="rev-attrs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <input type="text" id="rev-attr-name" placeholder="e.g. Vegan" style="flex:1;min-width:120px;padding:7px;border:1px solid var(--border);border-radius:6px">
        <select id="rev-attr-grp" style="padding:7px;border:1px solid var(--border);border-radius:6px"><option value="dietary">Dietary</option><option value="formulation">Formulation</option><option value="processing">Processing</option><option value="origin">Origin</option><option value="sustainability">Sustainability</option></select>
        <select id="rev-attr-src" style="padding:7px;border:1px solid var(--border);border-radius:6px"><option value="4syz">4SYZ-checked</option><option value="brand">Brand-declared</option></select>
        <button class="btn btn-secondary btn-sm" ${dataAct('revAddAttr')}>＋ Add</button>
      </div>
    </div>

    <div class="ai-panel" style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px;background:var(--bg-subtle,#f8fafc)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:1rem">◐</span>
        <b style="font-size:.82rem;color:var(--navy)">AI draft extraction <span style="font-weight:400;color:var(--text-muted)">(Phase 2)</span></b>
        <span class="attr" style="margin-left:auto"><span class="d db"></span>AI-drafted — needs human accept</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0">📷 Photo → OCR<input type="file" accept="image/*" capture="environment" style="display:none" ${dataChangeEl('ocrLabel', sku)}></label>
        <span id="rev-ocr-status" style="font-size:.7rem;color:var(--text-muted)">Photograph the label and Workers AI transcribes it into the box below. You confirm before extracting.</span>
      </div>
      <textarea id="rev-label" rows="3" placeholder="Paste the label ingredient / declaration text here — or use Photo → OCR above…" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:.78rem;resize:vertical"></textarea>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px">
        <button class="btn btn-secondary btn-sm" ${dataAct('runExtraction', sku)}>⚙ Run extraction</button>
        <span style="font-size:.7rem;color:var(--text-muted)">Screens additives, sugar &amp; compound ingredients and checks label claims. Never states legality.</span>
      </div>
      <div id="rev-extract" style="margin-top:10px"></div>
    </div>

    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Verification</label><select id="rev-ver" class="form-control">${opt('needs_review', p.verification)}${opt('ai_screened', p.verification)}${opt('verified', p.verification)}</select></div>
      <div class="form-group"><label>Fitment state</label><select id="rev-state" class="form-control">${['PENDING','REVIEW','APPROVED','CONDITIONAL','BLOCKED','EXPIRED'].map(s => opt(s, p.fitment_state)).join('')}</select></div>
      <div class="form-group"><label>Clean Label</label><select id="rev-clean" class="form-control">${['pending','eligible','not_eligible'].map(s => opt(s, p.clean_label)).join('')}</select></div>
      <div class="form-group"><label>Review / expiry date</label><input type="date" id="rev-exp" class="form-control" value="${p.expiry_date || ''}"></div>
    </div>
    <div class="form-group"><label>Reviewer notes</label><input type="text" id="rev-notes" class="form-control" value="${h(p.notes || '')}" placeholder="e.g. FSSAI licence verified against evidence"></div>`;

  const footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
    <button class="btn btn-secondary" ${dataAct('saveReviewIntel', sku)}>Save attributes</button>
    <button class="btn btn-primary" ${dataAct('saveFitment', sku)}>Save fitment decision</button>`;
  openModal(`Review — ${h(p.name)}`, body, footer);
  enableModalExpand();
  revRenderAttrs();
}

function revRenderAttrs() {
  const box = document.getElementById('rev-attrs'); if (!box) return;
  box.innerHTML = (APP._revAttrs || []).map((a, i) => `<span class="attr"><span class="d ${a.source === '4syz' ? 'd4' : 'db'}"></span>${h(a.name)} <span style="color:var(--text-light);font-size:.66rem">${h(a.grp)}</span> <b style="cursor:pointer;color:var(--red)" ${dataAct('revDelAttr', i)}>✕</b></span>`).join('') || '<span class="note" style="color:var(--text-muted);font-size:.76rem">No attributes yet.</span>';
}
function revAddAttr() {
  const name = document.getElementById('rev-attr-name')?.value.trim(); if (!name) return;
  APP._revAttrs.push({ name, grp: document.getElementById('rev-attr-grp').value, source: document.getElementById('rev-attr-src').value });
  document.getElementById('rev-attr-name').value = '';
  revRenderAttrs();
}
function revDelAttr(i) { APP._revAttrs.splice(i, 1); revRenderAttrs(); }

function ocrLabel(sku, input) {
  const f = input.files && input.files[0]; if (!f) { return; }
  const status = document.getElementById('rev-ocr-status');
  if (f.size > 4200000) { if (status) { status.textContent = 'Image too large — keep it under ~4 MB.'; status.style.color = 'var(--red)'; } input.value = ''; return; }
  if (status) { status.innerHTML = '<span class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle"></span> Transcribing label with Workers AI…'; status.style.color = 'var(--text-muted)'; }
  const r = new FileReader();
  r.onload = async () => {
    const res = await api(`/catalogue/${encodeURIComponent(sku)}/ocr`, { method: 'POST', body: JSON.stringify({ image_base64: r.result }) });
    input.value = '';
    if (!res || !res.text) {
      if (status) { status.textContent = (res && res.error) || 'OCR returned no text — paste the label text instead.'; status.style.color = 'var(--red)'; }
      return;
    }
    const box = document.getElementById('rev-label');
    if (box) { box.value = res.text; box.focus(); }
    if (status) { status.textContent = `Transcribed ${res.text.length} chars — review the text, then run extraction.`; status.style.color = 'var(--green,#16a34a)'; }
  };
  r.readAsDataURL(f);
}

async function runExtraction(sku) {
  const text = document.getElementById('rev-label')?.value.trim();
  const out = document.getElementById('rev-extract');
  if (!text) { if (out) out.innerHTML = '<span class="note" style="color:var(--red);font-size:.74rem">Paste the label text first.</span>'; return; }
  if (out) out.innerHTML = '<div class="loading-state" style="padding:12px"><div class="spinner"></div></div>';
  const res = await api(`/catalogue/${encodeURIComponent(sku)}/extract`, { method: 'POST', body: JSON.stringify({ ingredient_text: text }) });
  if (!res) { if (out) out.innerHTML = '<span class="note" style="color:var(--red);font-size:.74rem">Extraction failed.</span>'; return; }
  renderExtract(res);
  // Reflect the AI-screened state the backend just set.
  const ver = document.getElementById('rev-ver'); if (ver && ver.value === 'needs_review') ver.value = 'ai_screened';
  const st = document.getElementById('rev-state'); if (st && st.value === 'PENDING') st.value = 'REVIEW';
}

function renderExtract(res) {
  const out = document.getElementById('rev-extract'); if (!out) return;
  const badge = res.ai_used
    ? '<span class="attr"><span class="d d4"></span>Workers AI + rules</span>'
    : '<span class="attr"><span class="d db"></span>Rules engine</span>';
  const ing = (res.ingredients || []).map(g => {
    const conf = Math.round((g.confidence || 0) * 100);
    const flags = String(g.flags || '').split(',').filter(Boolean).map(f => `<span style="background:#fee2e2;color:#b91c1c;border-radius:4px;padding:1px 5px;font-size:.62rem;margin-left:4px">${h(f)}</span>`).join('');
    return `<tr><td style="padding:4px 6px">${h(g.normalized || g.raw_text)}${g.ins_code ? ` <span class="mono" style="color:var(--text-muted);font-size:.66rem">E${h(g.ins_code)}</span>` : ''}</td><td style="padding:4px 6px;font-size:.72rem;color:var(--text-muted)">${h(g.functional_class || '—')}${flags}</td><td style="padding:4px 6px;text-align:right;font-size:.7rem;color:${conf >= 80 ? 'var(--green,#16a34a)' : conf >= 60 ? '#b45309' : 'var(--red)'}">${conf}%</td></tr>`;
  }).join('');
  const claims = (res.claims || []).map(c => {
    const col = c.outcome === 'CONTRADICTED' ? '#b91c1c' : c.outcome === 'NEEDS_REVIEW' ? '#b45309' : '#16a34a';
    const bg = c.outcome === 'CONTRADICTED' ? '#fee2e2' : c.outcome === 'NEEDS_REVIEW' ? '#fef3c7' : '#dcfce7';
    return `<div style="display:flex;gap:8px;align-items:baseline;padding:4px 0"><span style="background:${bg};color:${col};border-radius:5px;padding:1px 7px;font-size:.64rem;font-weight:700;white-space:nowrap">${h(c.outcome)}</span><b style="font-size:.76rem">${h(c.name)}</b><span style="font-size:.72rem;color:var(--text-muted)">— ${h(c.why)}</span></div>`;
  }).join('');
  out.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin:4px 0 8px"><b style="font-size:.76rem;color:var(--navy)">Extracted ingredients</b> ${badge}</div>
    <table style="width:100%;border-collapse:collapse;font-size:.78rem;background:#fff;border:1px solid var(--border);border-radius:6px;overflow:hidden">
      <thead><tr style="background:var(--bg-subtle,#f1f5f9);text-align:left"><th style="padding:4px 6px;font-size:.66rem;text-transform:uppercase;color:var(--text-muted)">Ingredient</th><th style="padding:4px 6px;font-size:.66rem;text-transform:uppercase;color:var(--text-muted)">Class / flags</th><th style="padding:4px 6px;font-size:.66rem;text-transform:uppercase;color:var(--text-muted);text-align:right">Conf.</th></tr></thead>
      <tbody>${ing || '<tr><td colspan="3" style="padding:8px;color:var(--text-muted)">Nothing recognised.</td></tr>'}</tbody>
    </table>
    <div style="margin-top:10px"><b style="font-size:.76rem;color:var(--navy)">Label claim checks</b>${claims || '<div style="font-size:.74rem;color:var(--text-muted)">No claims checked.</div>'}</div>
    <div class="aiflag" style="background:#fef3c7;color:#92400e;border-radius:6px;padding:7px 10px;font-size:.7rem;margin-top:10px">These are AI drafts stored as <b>brand-unverified</b>. Confirm against evidence, then set Verification → <b>verified</b> to publish.</div>`;
}

async function saveReviewIntel(sku) {
  const res = await api(`/catalogue/${encodeURIComponent(sku)}/intel`, { method: 'PUT', body: JSON.stringify({ attributes: APP._revAttrs || [] }) });
  if (res) showToast('Attributes saved');
}
async function saveFitment(sku) {
  const body = {
    verification: document.getElementById('rev-ver').value,
    fitment_state: document.getElementById('rev-state').value,
    clean_label: document.getElementById('rev-clean').value,
    expiry_date: document.getElementById('rev-exp').value || null,
    notes: document.getElementById('rev-notes').value.trim(),
  };
  await api(`/catalogue/${encodeURIComponent(sku)}/intel`, { method: 'PUT', body: JSON.stringify({ attributes: APP._revAttrs || [] }) }).catch(() => {});
  const res = await api(`/catalogue/${encodeURIComponent(sku)}/fitment`, { method: 'PATCH', body: JSON.stringify(body) });
  if (res) { closeModal(); showToast(`Fitment set — ${res.fitment_state}`); navigate('product_review'); }
}

/* ── Reports (Super Admin / Ops): filter → PDF / Excel ──────────────────── */
async function renderProductReports(el) {
  injectCatCss();
  const data = await api('/catalogue');
  if (!data) return;
  APP._repItems = data.items || [];
  const cats = [...new Set(APP._repItems.map(i => i.category).filter(Boolean))].sort();
  el.innerHTML = `
    ${pageHeader('Product Reports', 'Filter the catalogue and export as PDF or Excel')}
    <div class="sc-toolbar">
      <select id="rp-ver" ${dataChange('rpFilter')}><option value="">All verification</option><option value="verified">4SYZ Verified</option><option value="ai_screened">AI Screened</option><option value="needs_review">Needs Review</option></select>
      <select id="rp-cat" ${dataChange('rpFilter')}><option value="">All categories</option>${cats.map(c => `<option>${h(c)}</option>`).join('')}</select>
      <select id="rp-exp" ${dataChange('rpFilter')}><option value="">Any expiry</option><option value="30">Licence expiring ≤ 30 days</option><option value="60">≤ 60 days</option><option value="past">Expired</option></select>
      <span style="flex:1"></span>
      <button class="btn btn-primary btn-sm" ${dataAct('exportProductReport', 'pdf')}>⬇ PDF</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('exportProductReport', 'xlsx')}>⬇ Excel</button>
    </div>
    <div id="rp-body"></div>`;
  rpFilter();
}

function rpFilteredRows() {
  const ver = document.getElementById('rp-ver')?.value || '';
  const cat = document.getElementById('rp-cat')?.value || '';
  const exp = document.getElementById('rp-exp')?.value || '';
  const now = Date.now();
  return (APP._repItems || []).filter(i => {
    if (ver && i.verification !== ver) return false;
    if (cat && i.category !== cat) return false;
    if (exp) {
      if (!i.expiry_date) return false;
      const days = (new Date(i.expiry_date).getTime() - now) / 86400000;
      if (exp === 'past' && days >= 0) return false;
      if (exp === '30' && !(days >= 0 && days <= 30)) return false;
      if (exp === '60' && !(days >= 0 && days <= 60)) return false;
    }
    return true;
  });
}
function rpFilter() {
  const rows = rpFilteredRows();
  const box = document.getElementById('rp-body'); if (!box) return;
  const verN = v => rows.filter(r => r.verification === v).length;
  box.innerHTML = `
    <div class="kpi">
      <div class="k"><div class="v">${verN('verified')}</div><div class="l">4SYZ Verified</div></div>
      <div class="k"><div class="v">${verN('ai_screened')}</div><div class="l">AI Screened</div></div>
      <div class="k"><div class="v">${verN('needs_review')}</div><div class="l">Needs Review</div></div>
      <div class="k"><div class="v">${rows.length}</div><div class="l">Products in report</div></div>
    </div>
    <div class="table-wrap"><table class="table" style="min-width:720px">
      <thead><tr><th>Brand</th><th>Product</th><th>Category</th><th>Attributes</th><th>Fitment</th><th>Verification</th><th>Valid to</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${h(r.brand || '—')}</td><td><b>${h(r.name)}</b><div class="mono" style="font-size:.7rem;color:var(--text-muted)">${h(r.sku)}</div></td>
        <td>${h(r.category || '—')}</td><td style="font-size:.78rem">${(r.attributes || []).map(a => h(a.name)).join(', ') || '—'}</td>
        <td><span class="fstate fs-${r.fitment_state}">${r.fitment_state}</span></td><td>${verBadge(r.verification)}</td>
        <td class="mono">${r.expiry_date ? fmtDate(r.expiry_date) : '—'}</td></tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px">No products match.</td></tr>'}</tbody>
    </table></div>`;
}

async function exportProductReport(kind) {
  const rows = rpFilteredRows();
  if (!rows.length) { showToast('No products to export', 'error'); return; }
  const head = ['Brand', 'Product', 'SKU', 'Category', 'Attributes', 'Fitment', 'Verification', 'Valid to'];
  const body = rows.map(r => [r.brand || '', r.name, r.sku, r.category || '', (r.attributes || []).map(a => a.name).join(', '),
    r.fitment_state, r.verification, r.expiry_date ? fmtDate(r.expiry_date) : '']);
  const disclaimer = 'Submitted by brand, checked by 4SYZ — not a regulatory approval. Super Admin / Ops only.';
  if (kind === 'xlsx') {
    if (!(typeof ensureXLSX === 'function' && await ensureXLSX())) { showToast('Excel library failed to load', 'error'); return; }
    const aoa = [['Smart Pantry — Product Report'], [disclaimer], [], head, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 13 }, { wch: 12 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'Smart-Pantry-Product-Report.xlsx');
  } else {
    if (!(typeof ensureJsPDF === 'function' && await ensureJsPDF())) { showToast('PDF library failed to load', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14); doc.setTextColor(30, 58, 95); doc.text('Smart Pantry — Product Report', 14, 15);
    doc.setFontSize(8); doc.setTextColor(120); doc.text(disclaimer, 14, 21);
    const auto = (o) => { if (typeof doc.autoTable === 'function') doc.autoTable(o); else if (window.jspdf.autoTable) window.jspdf.autoTable(doc, o); };
    auto({ startY: 26, head: [head], body, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [13, 148, 136] } });
    doc.save('Smart-Pantry-Product-Report.pdf');
  }
}
