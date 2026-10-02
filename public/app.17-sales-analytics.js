// ════════════════════════════════════════════════════════════════════════
// Sales Analytics (app.17) — SUPER-ADMIN ONLY. Sales data is not shown to any
// other role: the page lives only in the platform (super-admin) sidebar and
// every endpoint is gated to super_admin server-side. Built on the invoice
// mirror; no product-line data (Phase 2). Money arrives as INTEGER paise.
// ════════════════════════════════════════════════════════════════════════
const _SA = { period: 90, tab: 'dashboard', excMonth: '', excLookback: 6, c360Id: '', c360Q: '', _clients: null };

// ── Hub shell: one nav entry, tabbed sections ──────────────────────────
async function renderSalesAnalytics(main) {
  if (!main) return;
  const tab = _SA.tab || 'dashboard';
  const tabBtn = (id, label) => `<button class="btn ${tab === id ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetTab', id)}>${h(label)}</button>`;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">Sales Analytics</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${tabBtn('dashboard', 'Dashboard')}${tabBtn('exceptions', 'Billing Exceptions')}${tabBtn('client360', 'Client 360')}${tabBtn('reps', 'Salespeople')}${tabBtn('setup', 'Setup')}</div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 14px">Super-admin only. Figures are billed invoice value from Zoho Books.</p>
    <div id="sa-body"><div class="loading-state"><div class="spinner"></div><p>Loading…</p></div></div>`;
  const body = document.getElementById('sa-body');
  if (tab === 'exceptions') return _saExceptions(body);
  if (tab === 'client360') return _saClient360(body);
  if (tab === 'reps') return _saReps(body);
  if (tab === 'setup') return _saSetup(body);
  return _saDashboard(body);
}
function salesSetTab(id) { _SA.tab = id; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function renderSalesAnalyticsRefresh() { const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }

// ── Tab 1: Executive dashboard ─────────────────────────────────────────
function _saStatusChip(status, pct) {
  const map = {
    new:  ['🟢 New',        'var(--success,#2e6e12)'],
    up:   [`↑ +${pct}%`,    'var(--success,#2e6e12)'],
    down: [`↓ ${pct}%`,     'var(--danger,#b3261e)'],
    lost: ['🔴 No billing', 'var(--danger,#b3261e)'],
    none: ['—',             'var(--muted)'],
  };
  const [label, col] = map[status] || map.none;
  return `<span style="font-weight:600;color:${col};white-space:nowrap">${h(label)}</span>`;
}
function _saTrendChart(trend) {
  const max = Math.max(1, ...trend.map(t => t.net_sales));
  const bars = trend.map(t => {
    const pct = Math.round((t.net_sales / max) * 100);
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0" title="${h(t.month)} · ${h(_fmtPaise(t.net_sales))} · ${h(String(t.invoices))} invoices">
      <div style="width:100%;display:flex;align-items:flex-end;height:120px">
        <div style="width:100%;background:var(--blue,#1d6fa4);border-radius:4px 4px 0 0;height:${Math.max(2, pct)}%;min-height:2px"></div>
      </div>
      <div style="font-size:10px;color:var(--muted)">${h(t.month.slice(5))}</div>
    </div>`;
  }).join('');
  return `<div class="card" style="padding:16px">
    <div style="font-size:13px;font-weight:600;margin-bottom:12px">Monthly sales — last 12 months</div>
    <div style="display:flex;gap:4px;align-items:flex-end">${bars}</div></div>`;
}
function _saKpi(label, value, sub) {
  return `<div class="card" style="flex:1;min-width:150px;padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
    <div style="font-size:1.5rem;font-weight:700;margin-top:4px">${h(value)}</div>
    ${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${h(sub)}</div>` : ''}</div>`;
}
async function _saDashboard(body) {
  const period = _SA.period || 90;
  const data = await api('/analytics/sales/overview?period=' + period);
  if (!data || data.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((data && data.error) || 'Unable to load.')}</div>`; return; }
  const k = data.kpis || {};
  const perf = data.client_performance || [];
  const periodBtn = (n, label) => `<button class="btn ${period === n ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetPeriod', n)}>${h(label)}</button>`;
  const perfRows = perf.slice(0, 100).map(c => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px"><button ${dataAct('salesOpenClient360', c.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(c.name || c.client_id)}</button></td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(c.prev))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${h(_fmtPaise(c.curr))}</td>
    <td style="padding:7px 12px;text-align:right">${_saStatusChip(c.status, c.growth_pct)}</td></tr>`).join('');
  body.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      ${periodBtn(30, '30d')}${periodBtn(90, '90d')}${periodBtn(180, '180d')}${periodBtn(365, '1y')}
      <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')} Refresh</button>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('Sales (' + period + 'd)', _fmtPaise(k.net_sales), 'billed invoice value')}
      ${_saKpi('Invoices', String(k.invoices || 0), 'in period')}
      ${_saKpi('Active clients', String(k.active_clients || 0), 'billed in period')}
      ${_saKpi('Outstanding', _fmtPaise(k.outstanding), 'open balance now')}
    </div>
    ${_saTrendChart(data.trend || [])}
    <div class="card" style="padding:0;margin-top:14px;overflow-x:auto">
      <div style="padding:14px 16px 0;font-size:13px;font-weight:600">Client performance — ${h(data.previous_month || '')} → ${h(data.current_month || '')}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Client</th><th style="padding:8px 12px;text-align:right">Last month</th>
          <th style="padding:8px 12px;text-align:right">This month</th><th style="padding:8px 12px;text-align:right">Movement</th></tr></thead>
        <tbody>${perfRows || `<tr><td colspan="4" style="padding:16px;color:var(--muted)">No billing in the last two months.</td></tr>`}</tbody>
      </table></div>`;
}
function salesSetPeriod(n) { _SA.period = parseInt(n, 10) || 90; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }

// ── Tab 2: Billing Exceptions — "who didn't get billed?" ───────────────
function _saSevChip(sev) {
  const map = { critical: ['🔴 Critical', 'var(--danger,#b3261e)'], attention: ['🟠 Attention', 'var(--warning,#8a5a00)'], monitor: ['🟡 Monitor', 'var(--muted)'] };
  const [label, col] = map[sev] || ['—', 'var(--muted)'];
  return `<span style="font-weight:600;color:${col};white-space:nowrap">${h(label)}</span>`;
}
const _SA_REASON = { not_billed: 'No invoice this month', below_average: 'Below normal average' };
async function _saExceptions(body) {
  const month = _SA.excMonth || '';
  const qs = '?lookback=' + (_SA.excLookback || 6) + (month ? '&month=' + encodeURIComponent(month) : '');
  const data = await api('/analytics/billing-exceptions' + qs);
  if (!data || data.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((data && data.error) || 'Unable to load.')}</div>`; return; }
  const c = data.counts || {};
  const rows = (data.exceptions || []).map(e => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px"><button ${dataAct('salesOpenClient360', e.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(e.name || e.client_id)}</button></td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(e.expected))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(e.actual))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--danger,#b3261e);font-weight:600">${h(_fmtPaise(e.gap))}</td>
    <td style="padding:7px 12px;font-size:12px;color:var(--muted)">${h(_SA_REASON[e.reason] || e.reason)}</td>
    <td style="padding:7px 12px">${_saSevChip(e.severity)}</td>
    <td style="padding:7px 12px"><button class="btn btn-secondary btn-sm" ${dataAct('salesViewException', e.client_id)}>View ▸</button></td></tr>`).join('');
  body.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <span style="font-size:13px;color:var(--muted)">Comparing <b>${h(data.month)}</b> against the prior <b>${h(String(data.lookback))}</b> months.</span>
      <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>Refresh</button>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('Potential gap', _fmtPaise(data.potential_gap), 'expected − actual')}
      ${_saKpi('🔴 Critical', String(c.critical || 0), 'high value, not billed')}
      ${_saKpi('🟠 Attention', String(c.attention || 0), 'not billed / big drop')}
      ${_saKpi('🟡 Monitor', String(c.monitor || 0), 'below average')}
    </div>
    <div id="sa-exc-detail"></div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Client</th><th style="padding:8px 12px;text-align:right">Expected</th>
          <th style="padding:8px 12px;text-align:right">Actual</th><th style="padding:8px 12px;text-align:right">Gap</th>
          <th style="padding:8px 12px">Reason</th><th style="padding:8px 12px">Severity</th><th style="padding:8px 12px"></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" style="padding:16px;color:var(--muted)">No billing exceptions — every regular buyer billed as expected. 🎉</td></tr>`}</tbody>
      </table></div>`;
}
// Drill-down: why was this client flagged + their 12-month history.
async function salesViewException(clientId) {
  const box = document.getElementById('sa-exc-detail');
  if (box) box.innerHTML = `<div class="card" style="padding:12px 14px"><span style="font-size:13px;color:var(--muted)">Loading…</span></div>`;
  const month = _SA.excMonth || '';
  const d = await api('/analytics/billing-exceptions/' + encodeURIComponent(clientId) + (month ? '?month=' + encodeURIComponent(month) : ''));
  if (!box) return;
  if (!d || d.error) { box.innerHTML = `<div class="card" style="padding:12px 14px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  const e = d.exception || {};
  const hist = d.history || [];
  const max = Math.max(1, ...hist.map(x => x.net_sales));
  const bars = hist.map(x => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0" title="${h(x.month)} · ${h(_fmtPaise(x.net_sales))}">
    <div style="width:100%;display:flex;align-items:flex-end;height:70px"><div style="width:100%;background:${x.net_sales ? 'var(--blue,#1d6fa4)' : 'var(--border)'};border-radius:3px 3px 0 0;height:${Math.max(2, Math.round((x.net_sales / max) * 100))}%"></div></div>
    <div style="font-size:9px;color:var(--muted)">${h(x.month.slice(5))}</div></div>`).join('');
  const recent = (d.recent_invoices || []).map(i => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:4px 10px">${h(i.number || '')}</td><td style="padding:4px 10px;color:var(--muted)">${h(i.date || '')}</td>
    <td style="padding:4px 10px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(i.total))}</td>
    <td style="padding:4px 10px;color:var(--muted)">${h(i.status || '')}</td></tr>`).join('');
  box.innerHTML = `
    <div class="card" style="padding:14px 16px;margin-bottom:14px;border-left:4px solid var(--danger,#b3261e)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="font-weight:800">${h(d.name || clientId)} — billing exception</div>
        <button class="btn btn-secondary btn-sm" ${dataAct('salesCloseException')}>✕ Close</button>
      </div>
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin:10px 0">
        <div><div style="font-size:11px;color:var(--muted)">Expected</div><div style="font-size:1.2rem;font-weight:700">${h(_fmtPaise(e.expected || 0))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Actual (${h(d.month)})</div><div style="font-size:1.2rem;font-weight:700">${h(_fmtPaise(e.actual || 0))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Gap</div><div style="font-size:1.2rem;font-weight:700;color:var(--danger,#b3261e)">${h(_fmtPaise(e.gap || 0))}</div></div>
        <div><div style="font-size:11px;color:var(--muted)">Months active (of lookback)</div><div style="font-size:1.2rem;font-weight:700">${h(String(e.months_active || 0))}</div></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">Last billing: <b>${h(e.last_billing || '—')}</b> · Reason: <b>${h(_SA_REASON[e.reason] || e.reason || '—')}</b></div>
      <div style="font-size:12px;font-weight:600;margin:12px 0 6px">12-month billing history</div>
      <div style="display:flex;gap:3px;align-items:flex-end">${bars}</div>
      ${recent ? `<div style="font-size:12px;font-weight:600;margin:14px 0 4px">Recent invoices</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>${recent}</tbody></table>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn btn-secondary btn-sm" ${dataAct('financeViewClient', clientId)}>Open statement ▸</button>
      </div>
    </div>`;
}
function salesCloseException() { const b = document.getElementById('sa-exc-detail'); if (b) b.innerHTML = ''; }

// ── Tab 3: Client 360 — a sales-lens profile of one client ─────────────
function salesOpenClient360(id) { _SA.c360Id = id; _SA.tab = 'client360'; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesClearClient360() { _SA.c360Id = ''; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesClient360Search(q) {
  _SA.c360Q = q || '';
  const host = document.getElementById('sa-c360-list'); if (!host) return;
  host.innerHTML = _saClient360ListHtml();
}
function _saHealthChip(status) {
  const map = { stable: ['🟢 Stable', 'var(--success,#2e6e12)'], attention: ['🟡 Attention', 'var(--warning,#8a5a00)'], at_risk: ['🔴 At risk', 'var(--danger,#b3261e)'] };
  const [label, col] = map[status] || map.stable;
  return `<span style="font-weight:700;color:${col}">${h(label)}</span>`;
}
function _saClient360ListHtml() {
  const q = (_SA.c360Q || '').toLowerCase();
  const list = (_SA._clients || []).filter(c => !q || String(c.name || c.client_id).toLowerCase().includes(q)).slice(0, 60);
  if (!list.length) return `<div style="padding:16px;color:var(--muted)">No matching clients.</div>`;
  return list.map(c => `<button ${dataAct('salesOpenClient360', c.client_id)} style="display:flex;justify-content:space-between;width:100%;text-align:left;background:none;border:none;border-top:1px solid var(--border);padding:9px 12px;font:inherit;cursor:pointer;color:inherit">
    <span>${h(c.name || c.client_id)}</span>
    <span style="color:var(--muted);font-variant-numeric:tabular-nums">${h(_fmtPaise(c.outstanding || 0))} open</span></button>`).join('');
}
async function _saClient360(body) {
  // Detail view when a client is picked.
  if (_SA.c360Id) return _saClient360Detail(body, _SA.c360Id);
  // Otherwise a searchable picker (client list reused from the AR by-customer feed).
  if (!_SA._clients) {
    const d = await api('/finance/ar/by-customer');
    _SA._clients = (d && d.customers) ? d.customers.slice().sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0)) : [];
  }
  body.innerHTML = `
    <div style="margin-bottom:10px">
      <div style="position:relative;display:flex;align-items:center;max-width:420px">
        <span aria-hidden="true" style="position:absolute;left:12px;font-size:15px;color:var(--muted);pointer-events:none">🔍</span>
        <input type="search" data-input="salesClient360Search" data-val value="${h(_SA.c360Q || '')}" placeholder="Search a client to open their 360…"
          aria-label="Search clients" style="width:100%;padding:10px 12px 10px 36px;border:2px solid var(--border);border-radius:8px;font:inherit;background:var(--bg,#fff);color:inherit">
      </div>
    </div>
    <div class="card" style="padding:0;overflow:hidden"><div id="sa-c360-list">${_saClient360ListHtml()}</div></div>`;
}
async function _saClient360Detail(body, id) {
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading client 360…</p></div>`;
  const d = await api('/analytics/client/' + encodeURIComponent(id));
  if (!d || d.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  const m = d.metrics || {};
  const trend = d.trend || [];
  const max = Math.max(1, ...trend.map(t => t.net_sales));
  const bars = trend.map(t => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0" title="${h(t.month)} · ${h(_fmtPaise(t.net_sales))}">
    <div style="width:100%;display:flex;align-items:flex-end;height:90px"><div style="width:100%;background:${t.net_sales ? 'var(--blue,#1d6fa4)' : 'var(--border)'};border-radius:3px 3px 0 0;height:${Math.max(2, Math.round((t.net_sales / max) * 100))}%"></div></div>
    <div style="font-size:9px;color:var(--muted)">${h(t.month.slice(5))}</div></div>`).join('');
  const recent = (d.recent_invoices || []).map(i => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:5px 10px">${h(i.number || '')}</td><td style="padding:5px 10px;color:var(--muted)">${h(i.date || '')}</td>
    <td style="padding:5px 10px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(i.total))}</td>
    <td style="padding:5px 10px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(i.balance))}</td>
    <td style="padding:5px 10px;color:var(--muted)">${h(i.status || '')}</td></tr>`).join('');
  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <button class="btn btn-secondary btn-sm" ${dataAct('salesClearClient360')}>← All clients</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('financeViewClient', id)}>Open AR statement ▸</button>
    </div>
    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="font-size:1.2rem;font-weight:800">${h(d.name || id)}</div>${_saHealthChip((d.health || {}).status)}
      </div>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:var(--muted)">${((d.health || {}).reasons || []).map(r => `<li>${h(r)}</li>`).join('')}</ul>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('Sales (12m)', _fmtPaise(m.total_12m), 'billed last 12 months')}
      ${_saKpi('Avg / month', _fmtPaise(m.avg_monthly), `${m.active_months_12m || 0} active months`)}
      ${_saKpi('Avg invoice', _fmtPaise(m.avg_invoice), `${m.invoices || 0} invoices total`)}
      ${_saKpi('Billing cadence', (m.avg_interval_days || 0) + 'd', 'avg gap between invoices')}
      ${_saKpi('Outstanding', _fmtPaise(m.outstanding), 'open balance now')}
      ${_saKpi('Last billed', m.last_billing || '—', (m.days_since_last != null ? m.days_since_last + ' days ago' : ''))}
    </div>
    <div class="card" style="padding:16px;margin-bottom:14px">
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">12-month sales</div>
      <div style="display:flex;gap:3px;align-items:flex-end">${bars}</div></div>
    <div class="card" style="padding:0;overflow-x:auto">
      <div style="padding:14px 16px 0;font-size:13px;font-weight:600">Recent invoices</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:6px 10px">Invoice</th><th style="padding:6px 10px">Date</th>
          <th style="padding:6px 10px;text-align:right">Total</th><th style="padding:6px 10px;text-align:right">Balance</th><th style="padding:6px 10px">Status</th></tr></thead>
        <tbody>${recent || `<tr><td colspan="5" style="padding:14px;color:var(--muted)">No invoices.</td></tr>`}</tbody>
      </table></div>`;
}

// ── Tab 4: Salespeople — revenue attributed by client owner + region split ──
async function _saReps(body) {
  const period = _SA.period || 90;
  const [byRep, byRegion] = await Promise.all([
    api('/analytics/sales/by-rep?period=' + period),
    api('/analytics/sales/by-region?period=' + period),
  ]);
  if (!byRep || byRep.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((byRep && byRep.error) || 'Unable to load.')}</div>`; return; }
  const periodBtn = (n, label) => `<button class="btn ${period === n ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetPeriod', n)}>${h(label)}</button>`;
  const repRows = (byRep.reps || []).map(r => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px">${h(r.name)}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${h(_fmtPaise(r.net_sales))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(String(r.invoices || 0))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(String(r.clients_billed || 0))} / ${h(String(r.clients || 0))}</td></tr>`).join('');
  const regionRows = ((byRegion && byRegion.regions) || []).map(r => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px">${h(r.region)}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${h(_fmtPaise(r.net))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(String(r.invoices || 0))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(String(r.clients || 0))}</td></tr>`).join('');
  const unassignedRep = (byRep.reps || []).find(r => !r.rep_id);
  body.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      ${periodBtn(30, '30d')}${periodBtn(90, '90d')}${periodBtn(180, '180d')}${periodBtn(365, '1y')}
      <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>Refresh</button>
    </div>
    ${(unassignedRep && unassignedRep.net_sales > 0) ? `<div class="card" style="padding:10px 14px;margin-bottom:12px;border-left:4px solid var(--warning,#8a5a00);font-size:13px">
      <b>${h(_fmtPaise(unassignedRep.net_sales))}</b> of sales is from clients with no salesperson assigned. Assign owners under <b>Setup</b> for full attribution.</div>` : ''}
    <div class="card" style="padding:0;overflow-x:auto;margin-bottom:16px">
      <div style="padding:14px 16px 0;font-size:13px;font-weight:600">By salesperson — last ${h(String(period))} days</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Salesperson</th><th style="padding:8px 12px;text-align:right">Sales</th>
          <th style="padding:8px 12px;text-align:right">Invoices</th><th style="padding:8px 12px;text-align:right">Clients billed / owned</th></tr></thead>
        <tbody>${repRows || `<tr><td colspan="4" style="padding:16px;color:var(--muted)">No salespeople yet — add them under Setup.</td></tr>`}</tbody>
      </table></div>
    <div class="card" style="padding:0;overflow-x:auto">
      <div style="padding:14px 16px 0;font-size:13px;font-weight:600">By region — last ${h(String(period))} days</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Region</th><th style="padding:8px 12px;text-align:right">Sales</th>
          <th style="padding:8px 12px;text-align:right">Invoices</th><th style="padding:8px 12px;text-align:right">Clients</th></tr></thead>
        <tbody>${regionRows || `<tr><td colspan="4" style="padding:16px;color:var(--muted)">No region data.</td></tr>`}</tbody>
      </table></div>`;
}

// ── Tab 5: Setup — manage salespeople + assign clients (owner + region) ──
async function _saSetup(body) {
  const d = await api('/analytics/assignments');
  if (!d || d.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  _SA._setup = d;
  const repsData = await api('/analytics/reps');
  const reps = (repsData && repsData.reps) || [];
  const repList = reps.map(r => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:6px 12px">${h(r.name)}${r.active ? '' : ' <span style="color:var(--muted)">(inactive)</span>'}</td>
    <td style="padding:6px 12px;color:var(--muted)">${h(r.email || '')}</td>
    <td style="padding:6px 12px;text-align:right"><button class="btn btn-secondary btn-sm" ${dataAct('salesToggleRep', r.id, r.active ? 0 : 1)}>${r.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>`).join('');
  body.innerHTML = `
    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:8px">Salespeople</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input id="sa-rep-name" placeholder="Name" style="flex:1;min-width:160px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
        <input id="sa-rep-email" placeholder="Email (optional)" style="flex:1;min-width:160px;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
        <button class="btn btn-primary btn-sm" ${dataAct('salesAddRep')}>+ Add</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${repList || `<tr><td style="padding:8px 12px;color:var(--muted)">No salespeople yet.</td></tr>`}</tbody></table>
    </div>
    <div class="card" style="padding:16px">
      <div style="font-weight:600;margin-bottom:4px">Assign clients</div>
      <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Set each client's owning salesperson and region. Changes save immediately and are preserved across Zoho syncs.</p>
      <div style="position:relative;display:flex;align-items:center;max-width:360px;margin-bottom:10px">
        <span aria-hidden="true" style="position:absolute;left:12px;color:var(--muted)">🔍</span>
        <input type="search" data-input="salesSetupSearch" data-val value="${h(_SA.setupQ || '')}" placeholder="Search clients…" style="width:100%;padding:9px 12px 9px 34px;border:2px solid var(--border);border-radius:8px;font:inherit;background:var(--bg,#fff);color:inherit">
      </div>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Client</th><th style="padding:8px 12px">Salesperson</th><th style="padding:8px 12px">Region</th></tr></thead>
        <tbody id="sa-assign-rows">${_saAssignRowsHtml()}</tbody></table></div>
    </div>`;
}
function _saAssignRowsHtml() {
  const d = _SA._setup; if (!d) return '';
  const q = (_SA.setupQ || '').toLowerCase();
  const reps = d.reps || [];
  const clients = (d.clients || []).filter(c => !q || String(c.name || c.client_id).toLowerCase().includes(q)).slice(0, 100);
  return clients.map(c => {
    const opts = `<option value="">— Unassigned —</option>` + reps.map(r => `<option value="${h(r.id)}" ${c.salesperson_id === r.id ? 'selected' : ''}>${h(r.name)}</option>`).join('');
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 12px">${h(c.name || c.client_id)}</td>
      <td style="padding:6px 12px"><select ${dataChangeVal('salesAssignRep', c.client_id)} style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit;max-width:200px">${opts}</select></td>
      <td style="padding:6px 12px"><input data-change="salesAssignRegion" data-args="${h(JSON.stringify([c.client_id]))}" data-val value="${h(c.region || '')}" placeholder="Region" style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit;max-width:160px"></td></tr>`;
  }).join('');
}
function salesSetupSearch(q) { _SA.setupQ = q || ''; const host = document.getElementById('sa-assign-rows'); if (host) host.innerHTML = _saAssignRowsHtml(); }
async function salesAddRep() {
  const name = (document.getElementById('sa-rep-name') || {}).value || '';
  const email = (document.getElementById('sa-rep-email') || {}).value || '';
  if (!name.trim()) { showToast('Enter a name', 'error'); return; }
  const r = await api('/analytics/reps', { method: 'POST', body: JSON.stringify({ name: name.trim(), email: email.trim() }) });
  if (r && r.ok) { showToast('Salesperson added', 'success'); const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
}
async function salesToggleRep(id, active) {
  const r = await api('/analytics/reps/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify({ active: !!active }) });
  if (r && r.ok) { showToast('Updated', 'info'); const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
}
async function salesAssignRep(clientId, repId) {
  const r = await api('/analytics/client-assignment', { method: 'POST', body: JSON.stringify({ client_id: clientId, salesperson_id: repId || null }) });
  if (r && r.ok) { showToast('Owner updated', 'success'); if (_SA._setup) { const c = (_SA._setup.clients || []).find(x => x.client_id === clientId); if (c) c.salesperson_id = repId || null; } }
}
async function salesAssignRegion(clientId, region) {
  const r = await api('/analytics/client-assignment', { method: 'POST', body: JSON.stringify({ client_id: clientId, region: region || null }) });
  if (r && r.ok) { showToast('Region updated', 'success'); if (_SA._setup) { const c = (_SA._setup.clients || []).find(x => x.client_id === clientId); if (c) c.region = region || null; } }
}
