/* ═══════════════════════════════════════════════════════════════════
   Client Price Revisions — ops workspace, client approvals, report, history.
   Effective-dated changes to a client's MRP & negotiated price.
   ═══════════════════════════════════════════════════════════════════ */

function injectPricingCss() {
  if (document.getElementById('pricing-css')) return;
  const s = document.createElement('style'); s.id = 'pricing-css';
  s.textContent = `
    .pr-price{font-family:ui-monospace,monospace;font-weight:600}
    .pr-arw{color:var(--text-muted);margin:0 5px}
    .pr-delta{font-family:ui-monospace,monospace;font-weight:600;font-size:.82rem}
    .pr-delta.up{color:var(--red)} .pr-delta.down{color:var(--green,#16a34a)}
    .pr-pill{font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;display:inline-block}
    .pr-awaiting{background:#fef3c7;color:#92400e}
    .pr-scheduled{background:#e0e7ff;color:#3730a3}
    .pr-active{background:#dcfce7;color:#15803d}
    .pr-auto_accepted{background:#dcfce7;color:#15803d}
    .pr-rejected{background:#fee2e2;color:#b91c1c}
    .pr-superseded{background:var(--surface-2,#f1f5f9);color:var(--text-muted)}
    .pr-mrp{display:inline-flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:.82rem;padding:7px 10px;border:1px dashed var(--border);border-radius:8px;background:var(--surface-2,#f8fafc)}
    .pr-mrp .t{font-family:ui-monospace,monospace;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
    .pr-mrp.muted{color:var(--text-muted)}
    .pr-seg{display:inline-flex;border:1px solid var(--border);border-radius:9px;overflow:hidden}
    .pr-seg button{border:0;background:var(--surface-2,#f8fafc);color:var(--text-muted);font-family:inherit;font-size:.8rem;font-weight:600;padding:7px 13px;cursor:pointer;border-right:1px solid var(--border)}
    .pr-seg button:last-child{border-right:0}
    .pr-seg button.on{background:var(--primary);color:#fff}
    .pr-acard{border:1px solid var(--border);border-radius:14px;background:var(--surface,#fff);box-shadow:var(--shadow,0 1px 3px rgba(0,0,0,.06));overflow:hidden}
    .pr-pxbox{border:1px solid var(--border);border-radius:10px;padding:9px 13px;min-width:92px}
    .pr-pxbox .l{font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);font-family:ui-monospace,monospace}
    .pr-pxbox .v{font-family:ui-monospace,monospace;font-weight:700;font-size:1.05rem;margin-top:2px}
    .pr-pxbox.new{border-color:var(--primary);background:var(--primary-soft,#dcefe9)}
  `;
  document.head.appendChild(s);
}

function prStateLabel(s) {
  return ({ awaiting_client:'Awaiting client', scheduled:'Scheduled', active:'Active',
    auto_accepted:'Auto-accepted', rejected:'Rejected', superseded:'Superseded' })[s] || s;
}
function prPill(state) { return `<span class="pr-pill pr-${state}">● ${prStateLabel(state)}</span>`; }
function prPct(oldP, newP) { const o = +oldP || 0; if (!o) return 0; return (newP - o) / o * 100; }
function prDelta(oldP, newP) {
  const p = prPct(oldP, newP); const up = p >= 0;
  return `<span class="pr-delta ${up?'up':'down'}">${up?'▲':'▼'} ${up?'+':''}${p.toFixed(1)}%</span>`;
}

/* ── Ops workspace ──────────────────────────────────────────────────── */
async function renderPriceRevisions(el) {
  injectPricingCss();
  const data = await api('/price-revisions');
  if (!data) return;
  APP._prItems = data.items || [];
  const n = (st) => APP._prItems.filter(i => i.state === st).length;
  const rows = APP._prItems.map(r => `
    <tr>
      <td class="prod"><b>${h(r.item_name || r.sku)}</b><div class="mono" style="font-size:.68rem;color:var(--text-muted)">${h(r.client_name||'')} · ${h(r.sku)}</div></td>
      <td><span class="pr-price">${fmt(r.old_price)}</span><span class="pr-arw">→</span><span class="pr-price">${fmt(r.new_price)}</span></td>
      <td>${r.new_mrp != null && r.old_mrp != null && r.new_mrp !== r.old_mrp
            ? `<span class="pr-price">${fmt(r.old_mrp)}</span><span class="pr-arw">→</span><span class="pr-price">${fmt(r.new_mrp)}</span>`
            : `<span class="pr-price">${fmt(r.new_mrp ?? r.old_mrp ?? 0)}</span><span style="color:var(--text-muted);font-size:.72rem"> · unchanged</span>`}</td>
      <td>${prDelta(r.old_price, r.new_price)}</td>
      <td class="mono" style="font-size:.8rem">${r.effective_date ? fmtDate(r.effective_date) : '—'}</td>
      <td style="font-size:.82rem">${h(r.reason || '—')}</td>
      <td>${prPill(r.state)}</td>
      <td><button class="btn btn-secondary btn-sm" ${dataAct('viewPriceHistory', r.client_id + '|' + r.sku)}>History</button></td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No revisions yet.</td></tr>';
  el.innerHTML = `
    ${pageHeader('Price Revisions', 'Propose an MRP / price change, then send it to the client for approval', `<button class="btn btn-primary" ${dataAct('openProposeRevision')}>+ New revision</button>`)}
    <div class="kpi">
      <div class="k"><div class="v" style="color:#b45309">${n('awaiting_client')}</div><div class="l">Awaiting client</div></div>
      <div class="k"><div class="v" style="color:#3730a3">${n('scheduled')}</div><div class="l">Scheduled</div></div>
      <div class="k"><div class="v" style="color:var(--green,#16a34a)">${n('active')+n('auto_accepted')}</div><div class="l">Active</div></div>
      <div class="k"><div class="v">${APP._prItems.length}</div><div class="l">Total revisions</div></div>
    </div>
    <div class="table-wrap"><table class="table" style="min-width:900px">
      <thead><tr><th>Item</th><th>Client price</th><th>MRP</th><th>Change</th><th>Effective</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

async function openProposeRevision(preClient, preSku) {
  injectPricingCss();
  const clients = (await api('/clients').catch(()=>[])) || [];
  const clientOpts = clients.map(c => `<option value="${c.id}" ${c.id===preClient?'selected':''}>${h(c.name)}</option>`).join('');
  const body = `
    <div class="form-group"><label>1 · Client</label>
      <select id="pr-client" class="form-control" ${dataChange('prLoadClientProducts')}>
        <option value="">Select a client…</option>${clientOpts}</select></div>
    <div class="form-group"><label>2 · Product <span style="color:var(--text-muted);font-weight:400">(from this client's assigned list)</span></label>
      <select id="pr-sku" class="form-control" ${dataChange('prFillCurrent')}><option value="">Select a client first…</option></select></div>
    <div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Current MRP</label><input id="pr-oldmrp" class="form-control" disabled></div>
      <div class="form-group"><label>New MRP</label><input id="pr-newmrp" class="form-control" type="number" step="0.01"></div>
      <div class="form-group"><label>Current price for this client</label><input id="pr-oldprice" class="form-control" disabled></div>
      <div class="form-group"><label>New client price</label><input id="pr-newprice" class="form-control" type="number" step="0.01"></div>
      <div class="form-group"><label>Effective from</label><input id="pr-eff" class="form-control" type="date"></div>
      <div class="form-group"><label>Reason</label><select id="pr-reason" class="form-control"><option>Vendor cost increase</option><option>Contract revision</option><option>FX / import duty</option><option>Vendor rate drop</option><option>Promotional</option></select></div>
    </div>
    <div class="form-group"><label>Note to client (optional)</label><input id="pr-note" class="form-control" placeholder="e.g. Supplier revised base rate; passing through at cost."></div>
    <div id="pr-supersede" style="display:none;background:#fef3c7;color:#92400e;border-radius:8px;padding:9px 12px;font-size:.78rem;margin-bottom:8px"></div>
    <div class="aiflag" style="background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:9px 12px;font-size:.78rem">3 · Change the price, then <b>Share with client</b>. Price <b>decreases</b> apply automatically; <b>increases</b> are sent to the client approver for consent.</div>`;
  const footer = `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
    <button class="btn btn-primary" ${dataAct('submitRevision')}>Share with client</button>`;
  openModal('Propose price revision', body, footer);
  const eff = document.getElementById('pr-eff'); const today = new Date().toISOString().slice(0,10);
  if (eff) { eff.value = today; eff.min = today; } // never let an effective date fall in the past
  if (preClient) await prLoadClientProducts(preSku);
}
// Populate the product dropdown from the SELECTED client's assigned catalogue,
// carrying that client's own current price + MRP into each option.
async function prLoadClientProducts(preSku) {
  const clientId = document.getElementById('pr-client')?.value;
  const sel = document.getElementById('pr-sku'); if (!sel) return;
  if (!clientId) { sel.innerHTML = '<option value="">Select a client first…</option>'; prFillCurrent(); return; }
  sel.innerHTML = '<option>Loading…</option>';
  const items = (await api(`/clients/${encodeURIComponent(clientId)}/catalog`).catch(()=>[])) || [];
  if (!items.length) { sel.innerHTML = '<option value="">No products assigned to this client</option>'; prFillCurrent(); return; }
  sel.innerHTML = items.map(i => {
    const price = i.effective_price ?? i.client_price ?? i.unit_price ?? 0;
    const sku = typeof preSku === 'string' ? preSku : '';
    return `<option value="${i.sku}" data-price="${price}" data-mrp="${i.mrp||0}" ${i.sku===sku?'selected':''}>${h(i.name)} — ${i.sku} · ${fmt(price)}</option>`;
  }).join('');
  // Note any still-pending revisions for this client, so we can warn the user
  // that proposing a new one will replace the old one.
  APP._prPending = {};
  try {
    const rev = await api('/price-revisions?client_id=' + encodeURIComponent(clientId));
    for (const r of (rev?.items || [])) if (r.state === 'awaiting_client') APP._prPending[r.sku] = r;
  } catch (e) { /* non-fatal */ }
  prFillCurrent();
}
function prFillCurrent() {
  const sel = document.getElementById('pr-sku'); if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const has = opt && opt.value;
  const price = has ? (opt.getAttribute('data-price') || '0') : '';
  const mrp = has ? (opt.getAttribute('data-mrp') || '0') : '';
  const set = (id, v, keep) => { const e = document.getElementById(id); if (e && (!keep || !e.value)) e.value = v; };
  set('pr-oldprice', price); set('pr-oldmrp', mrp);
  set('pr-newprice', price, true); set('pr-newmrp', mrp, true);
  // Surface an existing pending revision for this product.
  const note = document.getElementById('pr-supersede');
  const pending = has && APP._prPending ? APP._prPending[opt.value] : null;
  if (note) {
    if (pending) { note.style.display = 'block'; note.innerHTML = `⚠ A revision to <b>${fmt(pending.new_price)}</b> is already awaiting this client's approval (effective ${pending.effective_date ? fmtDate(pending.effective_date) : '—'}). Submitting will <b>replace</b> it.`; }
    else note.style.display = 'none';
  }
}
async function submitRevision() {
  const body = {
    client_id: document.getElementById('pr-client').value,
    sku: document.getElementById('pr-sku').value,
    new_price: parseFloat(document.getElementById('pr-newprice').value),
    new_mrp: parseFloat(document.getElementById('pr-newmrp').value),
    reason: document.getElementById('pr-reason').value,
    note: document.getElementById('pr-note').value.trim(),
    effective_date: document.getElementById('pr-eff').value,
  };
  if (!body.client_id || !body.sku) { showToast('Select a client and a product', 'error'); return; }
  if (!(body.new_price > 0)) { showToast('Enter a valid new price', 'error'); return; }
  // Block a no-op: at least one of price / MRP must actually change.
  const oldPrice = parseFloat(document.getElementById('pr-oldprice').value) || 0;
  const oldMrp = parseFloat(document.getElementById('pr-oldmrp').value) || 0;
  const priceSame = Math.abs(body.new_price - oldPrice) < 0.005;
  const mrpSame = !(body.new_mrp > 0) || Math.abs(body.new_mrp - oldMrp) < 0.005;
  if (priceSame && mrpSame) { showToast('No change to submit — the price and MRP match the current values', 'error'); return; }
  if (body.effective_date && body.effective_date < new Date().toISOString().slice(0,10)) { showToast('Effective date can\'t be in the past', 'error'); return; }
  const res = await api('/price-revisions', { method: 'POST', body: JSON.stringify(body) });
  if (res) {
    closeModal();
    const base = res.status === 'auto_accepted' ? 'Decrease applied automatically' : 'Sent to client for approval';
    showToast(res.superseded ? base + ' — replaced the pending revision' : base);
    navigate('price_revisions');
  }
}

/* ── Client approvals inbox ─────────────────────────────────────────── */
async function renderPriceApprovals(el) {
  injectPricingCss();
  const data = await api('/price-revisions/pending');
  if (!data) return;
  const items = data.items || [];
  const pending = items.filter(i => i.state === 'awaiting_client');
  const card = (r) => {
    const mrpChanged = r.new_mrp != null && r.old_mrp != null && r.new_mrp !== r.old_mrp;
    const up = (r.new_price - r.old_price) >= 0;
    const mrp = mrpChanged
      ? `<div class="pr-mrp"><span class="t">MRP</span><span class="pr-price">${fmt(r.old_mrp)}</span>→<span class="pr-price">${fmt(r.new_mrp)}</span>${prDelta(r.old_mrp, r.new_mrp)}</div>`
      : `<div class="pr-mrp muted"><span class="t">MRP</span>unchanged · ${fmt(r.new_mrp ?? r.old_mrp ?? 0)}</div>`;
    const actionable = r.state === 'awaiting_client';
    return `
      <div class="pr-acard">
        <div style="padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border)">
          <span style="font-size:1.6rem">${r.emoji || '📦'}</span>
          <div><b>${h(r.item_name || r.sku)}</b><div class="mono" style="font-size:.7rem;color:var(--text-muted)">${h(r.sku)} · proposed ${r.proposed_at ? fmtDate(r.proposed_at) : ''}</div></div>
          <span style="margin-left:auto">${prPill(r.state)}</span>
        </div>
        <div style="padding:15px 16px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;align-items:center;gap:11px;flex-wrap:wrap">
            <div class="pr-pxbox"><div class="l">Current</div><div class="v">${fmt(r.old_price)}</div></div>
            <span class="pr-arw" style="font-size:1.2rem">→</span>
            <div class="pr-pxbox new"><div class="l">New price</div><div class="v">${fmt(r.new_price)}</div></div>
            <span style="font-size:.95rem;margin-left:2px">${prDelta(r.old_price, r.new_price)}</span>
          </div>
          ${mrp}
          ${r.reason ? `<div style="background:var(--surface-2,#f8fafc);border-radius:8px;padding:9px 11px;font-size:.82rem;color:var(--text-muted)"><b style="color:var(--text)">Reason:</b> ${h(r.reason)}${r.note ? ` — “${h(r.note)}”` : ''}</div>` : ''}
          <div style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.76rem;color:var(--text-muted)"><span><b>Effective</b> ${r.effective_date ? fmtDate(r.effective_date) : '—'}</span><span><b>Proposed by</b> ${h(r.proposed_by_name||'4SYZ')}</span></div>
          ${actionable ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" ${dataAct('decideRevision', r.id + '|accept')}>✓ Accept</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red)" ${dataAct('decideRevision', r.id + '|reject')}>Reject</button>
          </div>` : (r.state === 'auto_accepted' ? `<div style="background:#dcfce7;color:#15803d;border-radius:8px;padding:9px 11px;font-size:.8rem;font-weight:600">✓ Price reduction — applied automatically in your favour.</div>` : '')}
        </div>
      </div>`;
  };
  el.innerHTML = `
    ${pageHeader('Price Change Approvals', 'Your supplier has proposed the changes below — nothing takes effect until you accept')}
    <div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 12px"><h3 style="font-weight:800;color:var(--navy);font-size:1rem">Needs your decision</h3><span style="color:var(--text-muted);font-size:.82rem">${pending.length}</span></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">${pending.map(card).join('') || '<div class="u-empty" style="padding:24px;color:var(--text-muted)">Nothing awaiting your approval 🎉</div>'}</div>
    <div style="display:flex;align-items:baseline;gap:10px;margin:22px 0 12px"><h3 style="font-weight:800;color:var(--navy);font-size:1rem">Recent</h3></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">${items.filter(i => i.state !== 'awaiting_client').slice(0,8).map(card).join('') || '<div style="color:var(--text-muted);font-size:.85rem">No recent changes.</div>'}</div>`;
}
async function decideRevision(arg) {
  const [id, decision] = String(arg).split('|');
  if (decision === 'reject' && !confirm('Reject this price change? Your current price stays in place.')) return;
  const res = await api(`/price-revisions/${encodeURIComponent(id)}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
  if (res) { showToast(decision === 'accept' ? 'Price change accepted' : 'Price change rejected'); navigate('price_approvals'); }
}

/* ── Report (Ops / Finance / Client) ────────────────────────────────── */
async function renderPriceReport(el) {
  injectPricingCss();
  APP._prReport = APP._prReport || { period: 'quarter', client: '' };
  const isClient = ['client_admin','client_approver','client_user'].includes(APP.user?.role);
  const clients = isClient ? [] : (await api('/clients').catch(()=>[])) || [];
  const clientSel = isClient ? '' : `<select id="rpr-client" ${dataChange('prReportReload')}><option value="">All clients</option>${clients.map(c=>`<option value="${c.id}">${h(c.name)}</option>`).join('')}</select>`;
  el.innerHTML = `
    ${pageHeader('Price Change Report', 'Every MRP & price change in the selected period, old → new for both', `<button class="btn btn-secondary btn-sm" ${dataAct('exportPriceReport','pdf')}>⬇ PDF</button> <button class="btn btn-secondary btn-sm" ${dataAct('exportPriceReport','xlsx')}>⬇ Excel</button>`)}
    <div class="sc-toolbar" style="align-items:center">
      ${clientSel}
      <span class="pr-seg" id="rpr-seg">
        ${['month','quarter','year','custom'].map(p=>`<button data-per="${p}" class="${APP._prReport.period===p?'on':''}" ${dataActEl('prReportPeriod', p)}>${p[0].toUpperCase()+p.slice(1)}</button>`).join('')}
      </span>
      <span id="rpr-custom" style="display:${APP._prReport.period==='custom'?'inline-flex':'none'};gap:6px;align-items:center">
        <input type="date" id="rpr-from" ${dataChange('prReportReload')}><span style="color:var(--text-muted)">→</span><input type="date" id="rpr-to" ${dataChange('prReportReload')}>
      </span>
    </div>
    <div id="rpr-body"><div class="loading-state" style="padding:24px"><div class="spinner"></div></div></div>`;
  prReportReload();
}
function prPeriodRange() {
  const p = APP._prReport.period, now = new Date(), iso = d => d.toISOString().slice(0,10);
  if (p === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  if (p === 'quarter') { const q = Math.floor(now.getMonth()/3); return { from: iso(new Date(now.getFullYear(), q*3, 1)), to: iso(now) }; }
  if (p === 'year') return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
  return { from: document.getElementById('rpr-from')?.value || iso(new Date(now.getFullYear(),0,1)), to: document.getElementById('rpr-to')?.value || iso(now) };
}
function prReportPeriod(p) {
  APP._prReport.period = p;
  document.querySelectorAll('#rpr-seg button').forEach(b => b.classList.toggle('on', b.getAttribute('data-per') === p));
  const c = document.getElementById('rpr-custom'); if (c) c.style.display = p === 'custom' ? 'inline-flex' : 'none';
  if (p !== 'custom') prReportReload();
}
async function prReportReload() {
  const box = document.getElementById('rpr-body'); if (!box) return;
  const { from, to } = prPeriodRange();
  const client = document.getElementById('rpr-client')?.value || '';
  const qs = new URLSearchParams({ from, to }); if (client) qs.set('client_id', client);
  const data = await api('/price-revisions/report?' + qs.toString());
  if (!data) return;
  APP._prReportData = data;
  const s = data.summary || {};
  const rows = (data.items || []).map(r => `<tr>
      <td class="prod"><b>${h(r.item_name || r.sku)}</b><div class="mono" style="font-size:.68rem;color:var(--text-muted)">${h(r.client_name||'')} · ${h(r.sku)}</div></td>
      <td>${r.new_mrp != null && r.old_mrp != null && r.new_mrp !== r.old_mrp ? `<span class="pr-price">${fmt(r.old_mrp)}</span><span class="pr-arw">→</span><span class="pr-price">${fmt(r.new_mrp)}</span>` : `<span class="pr-price">${fmt(r.new_mrp ?? r.old_mrp ?? 0)}</span><span style="color:var(--text-muted);font-size:.72rem"> · unchanged</span>`}</td>
      <td><span class="pr-price">${fmt(r.old_price)}</span><span class="pr-arw">→</span><span class="pr-price">${fmt(r.new_price)}</span></td>
      <td>${prDelta(r.old_price, r.new_price)}</td>
      <td class="mono" style="font-size:.8rem">${r.effective_date ? fmtDate(r.effective_date) : '—'}</td>
      <td style="font-size:.82rem">${h(r.reason||'—')}</td>
      <td>${prPill(r.state)}</td>
      <td style="font-size:.82rem">${h(r.decided_by_name || '—')}</td>
    </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:24px">No price changes in this period.</td></tr>';
  box.innerHTML = `
    <div class="kpi">
      <div class="k"><div class="v">${s.total||0}</div><div class="l">Changes in period</div></div>
      <div class="k"><div class="v" style="color:var(--red)">${s.increases||0} ▲</div><div class="l">Increases · avg +${(s.avg_increase_pct||0)}%</div></div>
      <div class="k"><div class="v" style="color:var(--green,#16a34a)">${s.decreases||0} ▼</div><div class="l">Decreases · avg ${(s.avg_decrease_pct||0)}%</div></div>
      <div class="k"><div class="v mono" style="font-size:.9rem">${fmtDate(from)} – ${fmtDate(to)}</div><div class="l">Window</div></div>
    </div>
    <div class="table-wrap"><table class="table" style="min-width:940px">
      <thead><tr><th>Item</th><th>Old MRP → New MRP</th><th>Old price → New price</th><th>Δ price</th><th>Effective</th><th>Reason</th><th>Status</th><th>Approved by</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
async function exportPriceReport(kind) {
  const data = APP._prReportData; if (!data || !(data.items||[]).length) { showToast('Nothing to export', 'error'); return; }
  const head = ['Client','Item','SKU','Old MRP','New MRP','Old price','New price','Δ%','Effective','Reason','Status','Approved by'];
  const body = data.items.map(r => [r.client_name||'', r.item_name||r.sku, r.sku, r.old_mrp??'', r.new_mrp??'', r.old_price??'', r.new_price??'',
    prPct(r.old_price, r.new_price).toFixed(1)+'%', r.effective_date?fmtDate(r.effective_date):'', r.reason||'', prStateLabel(r.state), r.decided_by_name||'']);
  const title = 'Smart Pantry — Price Change Report';
  if (kind === 'xlsx') {
    if (!(typeof ensureXLSX === 'function' && await ensureXLSX())) { showToast('Excel library failed to load', 'error'); return; }
    const ws = XLSX.utils.aoa_to_sheet([[title], [`${fmtDate(data.from)} – ${fmtDate(data.to)}`], [], head, ...body]);
    ws['!cols'] = [{wch:22},{wch:28},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:8},{wch:12},{wch:20},{wch:14},{wch:16}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Price changes');
    XLSX.writeFile(wb, 'Smart-Pantry-Price-Changes.xlsx');
  } else {
    if (!(typeof ensureJsPDF === 'function' && await ensureJsPDF())) { showToast('PDF library failed to load', 'error'); return; }
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    const auto = (o) => { if (typeof doc.autoTable === 'function') doc.autoTable(o); else if (window.jspdf.autoTable) window.jspdf.autoTable(doc, o); };
    if (typeof doc.autoTable !== 'function' && typeof window.jspdf.autoTable !== 'function') { showToast('PDF table plugin failed to load', 'error'); return; }
    doc.setFontSize(14); doc.setTextColor(30,58,95); doc.text(title, 14, 15);
    doc.setFontSize(8); doc.setTextColor(120); doc.text(`${fmtDate(data.from)} – ${fmtDate(data.to)}`, 14, 21);
    auto({ startY: 26, head: [head], body, styles:{fontSize:7,cellPadding:1.5}, headStyles:{fillColor:[13,148,136]} });
    doc.save('Smart-Pantry-Price-Changes.pdf');
  }
}

/* ── Price history (per client + SKU) ───────────────────────────────── */
async function viewPriceHistory(arg) {
  injectPricingCss();
  const [clientId, sku] = String(arg).split('|');
  openModal('Price history', `<div class="loading-state"><div class="spinner"></div></div>`, '');
  const data = await api(`/price-revisions/history?client_id=${encodeURIComponent(clientId)}&sku=${encodeURIComponent(sku)}`);
  if (!data) return;
  const items = data.items || [];
  const body = `
    <div style="font-family:ui-monospace,monospace;font-size:.72rem;color:var(--text-muted);margin-bottom:12px">${h(sku)} · client ${h(clientId)}</div>
    ${items.length ? items.map(r => `
      <div style="display:flex;gap:12px;padding:12px 0;border-top:1px solid var(--border)">
        <div style="flex:none;width:8px;height:8px;border-radius:50%;background:${r.state==='active'||r.state==='auto_accepted'?'var(--green,#16a34a)':r.state==='rejected'?'var(--red)':'var(--text-muted)'};margin-top:6px"></div>
        <div style="flex:1">
          <div style="font-size:.72rem;color:var(--text-muted);font-family:ui-monospace,monospace">${r.effective_date?fmtDate(r.effective_date):''} · ${prStateLabel(r.state)}</div>
          <div style="font-weight:700;margin-top:2px">${fmt(r.old_price)} <span class="pr-arw">→</span> ${fmt(r.new_price)} ${prDelta(r.old_price, r.new_price)}
            ${r.new_mrp!=null&&r.old_mrp!=null&&r.new_mrp!==r.old_mrp?`<span style="color:var(--text-muted);font-weight:400;font-size:.8rem"> · MRP ${fmt(r.old_mrp)}→${fmt(r.new_mrp)}</span>`:''}</div>
          <div style="font-size:.82rem;color:var(--text-muted);margin-top:3px">${h(r.reason||'')}${r.decided_by_name?` · ${r.state==='rejected'?'rejected':'decided'} by ${h(r.decided_by_name)}`:''}</div>
        </div>
      </div>`).join('') : '<div style="color:var(--text-muted);padding:12px 0">No revisions for this item.</div>'}`;
  openModal(`Price history — ${h(sku)}`, body, `<button class="btn btn-secondary" ${dataAct('closeModal')}>Close</button>`);
}
