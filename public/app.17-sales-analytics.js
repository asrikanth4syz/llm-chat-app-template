// ════════════════════════════════════════════════════════════════════════
// Sales Analytics (app.17) — SUPER-ADMIN ONLY. Sales data is not shown to any
// other role: the page lives only in the platform (super-admin) sidebar and
// every endpoint is gated to super_admin server-side. Built on the invoice
// mirror; no product-line data (Phase 2). Money arrives as INTEGER paise.
// ════════════════════════════════════════════════════════════════════════
const _SA = { period: 90, tab: 'dashboard', c360Id: '', c360Q: '', _clients: null,
  excGrain: 'month', excYoy: false, excFrom: '', excTo: '',
  kpiFrom: '', kpiTo: '',
  matMode: 'rev', matMonths: 12, matView: 'grid', matFilter: null, wfMonth: '' };

// ── Hub shell: one nav entry, tabbed sections ──────────────────────────
async function renderSalesAnalytics(main) {
  if (!main) return;
  const tab = _SA.tab || 'dashboard';
  const tabBtn = (id, label) => `<button class="btn ${tab === id ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetTab', id)}>${h(label)}</button>`;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">Sales Analytics</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${tabBtn('summary', 'Summary')}${tabBtn('dashboard', 'Dashboard')}${tabBtn('matrix', 'Matrix')}${tabBtn('movement', 'Movement')}${tabBtn('risk', 'Risk')}${tabBtn('retention', 'Retention')}${tabBtn('exceptions', 'Billing Exceptions')}${tabBtn('client360', 'Client 360')}${tabBtn('reps', 'Salespeople')}${tabBtn('setup', 'Setup')}</div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 14px">Super-admin only. Figures are billed invoice value from Zoho Books.</p>
    <div id="sa-body"><div class="loading-state"><div class="spinner"></div><p>Loading…</p></div></div>`;
  const body = document.getElementById('sa-body');
  if (tab === 'summary') return _saSummary(body);
  if (tab === 'matrix') return _saMatrix(body);
  if (tab === 'movement') return _saWaterfall(body);
  if (tab === 'risk') return _saRisk(body);
  if (tab === 'retention') return _saRetention(body);
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
  const custom = _SA.kpiFrom && _SA.kpiTo;
  const data = await api('/analytics/sales/overview?period=' + period + (custom ? '&from=' + encodeURIComponent(_SA.kpiFrom) + '&to=' + encodeURIComponent(_SA.kpiTo) : ''));
  if (!data || data.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((data && data.error) || 'Unable to load.')}</div>`; return; }
  const k = data.kpis || {};
  const perf = data.client_performance || [];
  const periodBtn = (n, label) => `<button class="btn ${!custom && period === n ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetPeriod', n)}>${h(label)}</button>`;
  const kpiRangeLabel = custom ? _SA.kpiFrom + ' → ' + _SA.kpiTo : period + 'd';
  const perfRows = perf.slice(0, 100).map(c => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px"><button ${dataAct('salesDrill', c.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(c.name || c.client_id)}</button></td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(c.prev))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${h(_fmtPaise(c.curr))}</td>
    <td style="padding:7px 12px;text-align:right">${_saStatusChip(c.status, c.growth_pct)}</td></tr>`).join('');
  body.innerHTML = `
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      ${periodBtn(30, '30d')}${periodBtn(90, '90d')}${periodBtn(180, '180d')}${periodBtn(365, '1y')}
      <span style="width:1px;height:20px;background:var(--border);margin:0 2px"></span>
      <input type="date" value="${h(_SA.kpiFrom || '')}" ${dataChangeVal('salesSetKpiFrom')} style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
      <span style="font-size:12px;color:var(--muted)">→</span>
      <input type="date" value="${h(_SA.kpiTo || '')}" ${dataChangeVal('salesSetKpiTo')} style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
      <button class="btn ${custom ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesApplyKpiRange')}>Custom</button>
      ${custom ? `<button class="btn btn-secondary btn-sm" ${dataAct('salesClearKpiRange')}>✕ clear</button>` : ''}
      <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')} Refresh</button>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('Sales (' + kpiRangeLabel + ')', _fmtPaise(k.net_sales), 'billed invoice value')}
      ${_saKpi('Invoices', String(k.invoices || 0), 'in period')}
      ${_saKpi('Active clients', String(k.active_clients || 0), 'billed in period')}
      ${_saKpi('Outstanding', _fmtPaise(k.outstanding), 'open balance now')}
    </div>
    ${_saTrendChart(data.trend || [])}
    <div class="card" style="padding:0;margin-top:14px;overflow-x:auto">
      <div style="padding:14px 16px 0;font-size:13px;font-weight:600">Client performance — last two complete months</div>
      <div style="padding:2px 16px 0;font-size:11px;color:var(--muted)">The current month is excluded until it ends, so an early-month partial never looks like a crash.</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Client</th><th style="padding:8px 12px;text-align:right">${h(data.previous_month || 'Earlier')}</th>
          <th style="padding:8px 12px;text-align:right">${h(data.current_month || 'Latest')}</th><th style="padding:8px 12px;text-align:right">Movement</th></tr></thead>
        <tbody>${perfRows || `<tr><td colspan="4" style="padding:16px;color:var(--muted)">No billing in the last two complete months.</td></tr>`}</tbody>
      </table></div>`;
}
function salesSetPeriod(n) { _SA.period = parseInt(n, 10) || 90; _SA.kpiFrom = ''; _SA.kpiTo = ''; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesSetKpiFrom(v) { _SA.kpiFrom = v || ''; }
function salesSetKpiTo(v) { _SA.kpiTo = v || ''; }
function salesApplyKpiRange() { if (!_SA.kpiFrom || !_SA.kpiTo) { showToast('Pick both from and to dates', 'error'); return; } const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesClearKpiRange() { _SA.kpiFrom = ''; _SA.kpiTo = ''; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }

// ── Tab 2: Billing Exceptions — "who didn't get billed?" ───────────────
function _saSevChip(sev) {
  const map = { critical: ['🔴 Critical', 'var(--danger,#b3261e)'], attention: ['🟠 Attention', 'var(--warning,#8a5a00)'], monitor: ['🟡 Monitor', 'var(--muted)'] };
  const [label, col] = map[sev] || ['—', 'var(--muted)'];
  return `<span style="font-weight:600;color:${col};white-space:nowrap">${h(label)}</span>`;
}
const _SA_REASON = { not_billed: 'No billing in period', below_average: 'Below normal average' };
// Period-filter controls for Billing Exceptions: grain (month/quarter/year), a YoY toggle,
// and a custom from/to range.
function salesExcSetGrain(g) { _SA.excGrain = g; if (g !== 'custom') _SA.excYoy = _SA.excYoy && g !== 'custom'; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesExcToggleYoy() { _SA.excYoy = !_SA.excYoy; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesExcSetFrom(v) { _SA.excFrom = v || ''; }
function salesExcSetTo(v) { _SA.excTo = v || ''; }
function salesExcApplyCustom() {
  if (!_SA.excFrom || !_SA.excTo) { showToast('Pick both from and to dates', 'error'); return; }
  _SA.excGrain = 'custom'; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m);
}
function _saExcControls() {
  const g = _SA.excGrain || 'month';
  const yoy = !!_SA.excYoy;
  const gb = (id, label) => `<button class="btn ${g === id ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesExcSetGrain', id)}>${h(label)}</button>`;
  return `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <span style="font-size:12px;color:var(--muted);font-weight:600">Period:</span>
      ${gb('month', 'Month')}${gb('quarter', 'Quarter')}${gb('year', 'Year')}
      ${g !== 'custom' ? `<button class="btn ${yoy ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesExcToggleYoy')} title="Compare this period to the same period one year earlier">YoY</button>` : ''}
      <span style="width:1px;height:20px;background:var(--border);margin:0 2px"></span>
      <input type="date" value="${h(_SA.excFrom || '')}" ${dataChangeVal('salesExcSetFrom')} style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
      <span style="font-size:12px;color:var(--muted)">→</span>
      <input type="date" value="${h(_SA.excTo || '')}" ${dataChangeVal('salesExcSetTo')} style="padding:6px 8px;border:1px solid var(--border);border-radius:6px;font:inherit;background:var(--bg,#fff);color:inherit">
      <button class="btn ${g === 'custom' ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesExcApplyCustom')}>Custom range</button>
    </div>`;
}
async function _saExceptions(body) {
  const g = _SA.excGrain || 'month';
  let qs;
  if (g === 'custom') qs = '?grain=custom&from=' + encodeURIComponent(_SA.excFrom || '') + '&to=' + encodeURIComponent(_SA.excTo || '');
  else qs = '?grain=' + g + (_SA.excYoy ? '&yoy=1' : '');
  const data = await api('/analytics/billing-exceptions' + qs);
  if (!data) { body.innerHTML = _saExcControls() + `<div class="card" style="padding:20px;color:var(--muted)">Unable to load.</div>`; return; }
  if (data.error) { body.innerHTML = _saExcControls() + `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h(data.error)}</div>`; return; }
  const c = data.counts || {};
  const baseDesc = data.yoy ? 'the same period last year' : `the prior ${data.lookback} ${g === 'year' ? 'years' : g === 'quarter' ? 'quarters' : g === 'custom' ? 'periods' : 'months'}`;
  const rows = (data.exceptions || []).map(e => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px"><button ${dataAct('salesDrill', e.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(e.name || e.client_id)}</button></td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(e.expected))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(e.actual))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;color:var(--danger,#b3261e);font-weight:600">${h(_fmtPaise(e.gap))}</td>
    <td style="padding:7px 12px;font-size:12px;color:var(--muted)">${h(_SA_REASON[e.reason] || e.reason)}</td>
    <td style="padding:7px 12px">${_saSevChip(e.severity)}</td>
    <td style="padding:7px 12px"><button class="btn btn-secondary btn-sm" ${dataAct('salesViewException', e.client_id)}>View ▸</button></td></tr>`).join('');
  body.innerHTML = `
    ${_saExcControls()}
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <span style="font-size:13px;color:var(--muted)">Comparing <b>${h(data.month)}</b> against ${h(baseDesc)}.</span>
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

// ── Tab: Matrix — all clients × month revenue heatmap ──────────────────
function salesMatSetMode(m) { _SA.matMode = m; const el = document.getElementById('main-content'); if (el) renderSalesAnalytics(el); }
function _matShort(ym) { const [y, m] = ym.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m,10)-1] + "'" + y.slice(2); }
function _matMomPct(vals, i) { if (i === 0) return null; const p = vals[i-1], c = vals[i]; if (p <= 0 && c <= 0) return null; if (p <= 0) return 999; if (c <= 0) return -100; return Math.round((c - p) / p * 100); }
// Per-client movement status from the two most recent COMPLETE months (last column is the
// in-progress current month, so compare values[len-2] vs values[len-3]).
const _SA_MSTATUS = { grow: ['Growing', 'var(--success,#2e6e12)'], steady: ['Steady', 'var(--faint,#9a988f)'], soft: ['Softening', 'var(--warning,#8a5a00)'], slip: ['Declining', 'var(--danger,#b3261e)'], lost: ['Lost', 'var(--danger,#b3261e)'], new: ['New', 'var(--blue,#1d6fa4)'] };
function _matStatus(v) {
  const n = v.length, recent = v[n - 2] || 0, prior = v[n - 3] || 0;
  if (prior > 0 && recent <= 0) return 'lost';
  if (prior <= 0 && recent > 0) return 'new';
  if (prior > 0) { const d = (recent - prior) / prior; if (d >= 0.05) return 'grow'; if (d <= -0.25) return 'slip'; if (d <= -0.05) return 'soft'; }
  return 'steady';
}
function salesMatSetView(v) { _SA.matView = v; const el = document.getElementById('main-content'); if (el) renderSalesAnalytics(el); }
function salesMatSetFilter(k) { _SA.matFilter = (_SA.matFilter === k ? null : k); const el = document.getElementById('main-content'); if (el) renderSalesAnalytics(el); }
async function _saMatrix(body) {
  const mode = _SA.matMode || 'rev', view = _SA.matView || 'grid', filter = _SA.matFilter;
  const data = await api('/analytics/sales/matrix?months=' + (_SA.matMonths || 12));
  if (!data || data.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((data && data.error) || 'Unable to load.')}</div>`; return; }
  const months = data.months || [], all = (data.clients || []).map(c => ({ ...c, status: _matStatus(c.values) }));
  const recentIdx = months.length - 2, priorIdx = months.length - 3;
  const recentYm = months[recentIdx], priorYm = months[priorIdx];
  const maxAll = Math.max(1, ...all.flatMap(c => c.values));
  const clients = filter ? all.filter(c => c.status === filter) : all;
  // KPI row (on the last complete month).
  const recSum = all.reduce((s, c) => s + (c.values[recentIdx] || 0), 0);
  const priSum = all.reduce((s, c) => s + (c.values[priorIdx] || 0), 0);
  const mom = priSum > 0 ? Math.round((recSum - priSum) / priSum * 100) : null;
  const counts = { grow: 0, steady: 0, soft: 0, slip: 0, lost: 0, new: 0 }; all.forEach(c => counts[c.status]++);
  const activeN = all.filter(c => (c.values[recentIdx] || 0) > 0).length;
  const needs = counts.soft + counts.slip + counts.lost;
  const kpis = `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
    ${_saKpi(_matShort(recentYm) + ' revenue', _fmtPaise(recSum), mom == null ? 'last complete month' : (mom >= 0 ? '▲ +' : '▼ ') + mom + '% vs ' + _matShort(priorYm))}
    ${_saKpi('Active clients', String(activeN), 'billed in ' + _matShort(recentYm))}
    ${_saKpi('Growing', String(counts.grow), 'up vs prior month')}
    ${_saKpi('Needs attention', String(needs), counts.slip + ' declining · ' + counts.lost + ' lost')}
  </div>`;
  const modeBtn = (id, label) => `<button class="btn ${mode === id ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesMatSetMode', id)}>${h(label)}</button>`;
  const viewBtn = (id, label) => `<button class="btn ${view === id ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesMatSetView', id)}>${h(label)}</button>`;
  const chipRow = `<div style="display:flex;gap:7px;flex-wrap:wrap">${['grow','steady','soft','slip','lost','new'].map(k => {
    const [lbl, col] = _SA_MSTATUS[k]; const on = filter === k;
    return `<button ${dataAct('salesMatSetFilter', k)} style="border:1px solid ${on ? col : 'var(--border)'};${on ? 'box-shadow:inset 0 0 0 1px ' + col + ';' : ''}background:var(--surface,var(--bg,#fff));border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer;color:inherit;display:inline-flex;gap:6px;align-items:center"><span style="width:8px;height:8px;border-radius:50%;background:${col}"></span>${h(lbl)}<span style="color:var(--muted)">${counts[k]}</span></button>`;
  }).join('')}</div>`;
  const cellStyle = (v, pct) => {
    if (mode === 'rev') { const a = v > 0 ? (0.10 + 0.82 * (v / maxAll)) : 0; return `background:rgba(37,99,235,${a.toFixed(3)});color:${a > 0.55 ? '#fff' : 'inherit'}`; }
    if (pct === null) return 'background:transparent';
    const mag = Math.min(1, Math.abs(pct) / 80), a = (0.12 + 0.78 * mag);
    const rgb = pct >= 0 ? '16,122,70' : '192,57,43';
    return `background:rgba(${rgb},${a.toFixed(3)});color:${a > 0.5 ? '#fff' : 'inherit'}`;
  };
  const cellText = (v, pct) => mode === 'rev' ? (v ? _fmtPaise(v) : '') : (pct === null ? '' : (pct > 0 ? '+' : '') + pct + '%');
  const nameCell = c => `<button ${dataAct('salesDrill', c.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:bottom" title="${h(c.name)}"><span style="width:8px;height:8px;border-radius:50%;background:${_SA_MSTATUS[c.status][1]};display:inline-block;margin-right:6px"></span>${h(c.name)}</button>`;
  let table;
  if (view === 'table') {
    table = `<table style="border-collapse:collapse;width:100%;min-width:720px;font-size:12px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5)"><th style="padding:7px 10px;text-align:left;position:sticky;left:0;background:var(--bg-subtle,#f5f5f5)">Client</th>${months.map(m => `<th style="padding:7px 6px;color:var(--muted);font-weight:600;font-size:10.5px;text-align:right;white-space:nowrap">${h(_matShort(m))}</th>`).join('')}</tr></thead>
      <tbody>${clients.map(c => `<tr style="border-top:1px solid var(--border)"><td style="padding:6px 10px;position:sticky;left:0;background:var(--bg,#fff);border-right:1px solid var(--border);white-space:nowrap">${nameCell(c)}</td>${c.values.map(v => `<td style="padding:6px 8px;text-align:right;font-variant-numeric:tabular-nums">${v ? _fmtPaise(v) : '—'}</td>`).join('')}</tr>`).join('') || `<tr><td style="padding:16px;color:var(--muted)">No clients.</td></tr>`}</tbody></table>`;
  } else {
    const rows = clients.map(c => {
      const cells = c.values.map((v, i) => {
        const pct = _matMomPct(c.values, i);
        const title = `${c.name} · ${_matShort(months[i])} · ${_fmtPaise(v)}${pct === null ? '' : ` · ${pct > 0 ? '+' : ''}${pct}% MoM`}`;
        return `<td ${dataAct('salesDrill', c.client_id)} title="${h(title)}" style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;${cellStyle(v, pct)}">${h(cellText(v, pct))}</td>`;
      }).join('');
      return `<tr style="border-top:1px solid var(--border)"><td style="padding:6px 10px;position:sticky;left:0;background:var(--bg,#fff);border-right:1px solid var(--border);white-space:nowrap">${nameCell(c)}</td>${cells}</tr>`;
    }).join('');
    table = `<table style="border-collapse:collapse;width:100%;min-width:720px;font-size:12px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5)"><th style="padding:7px 10px;text-align:left;position:sticky;left:0;background:var(--bg-subtle,#f5f5f5)">Client</th>${months.map(m => `<th style="padding:7px 6px;color:var(--muted);font-weight:600;font-size:10.5px;white-space:nowrap">${h(_matShort(m))}</th>`).join('')}</tr></thead>
      <tbody>${rows || `<tr><td style="padding:16px;color:var(--muted)">No clients.</td></tr>`}</tbody></table>`;
  }
  const legend = view === 'table' ? '' : (mode === 'rev'
    ? `<span style="font-size:11px;color:var(--muted)">Low</span><span style="display:inline-flex;height:11px;border:1px solid var(--border);border-radius:3px;overflow:hidden">${[0.1,0.3,0.5,0.7,0.9].map(a=>`<i style="width:24px;background:rgba(37,99,235,${a})"></i>`).join('')}</span><span style="font-size:11px;color:var(--muted)">High monthly revenue</span>`
    : `<span style="font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:5px"><i style="width:14px;height:11px;border-radius:3px;background:rgba(192,57,43,.8);display:inline-block"></i>Down</span><span style="font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:5px"><i style="width:14px;height:11px;border-radius:3px;background:rgba(16,122,70,.8);display:inline-block"></i>Up vs previous month</span>`);
  body.innerHTML = `
    ${kpis}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <div style="display:inline-flex;gap:4px">${modeBtn('rev','Revenue')}${modeBtn('mom','MoM change')}</div>
      ${chipRow}
      <span style="margin-left:auto;display:inline-flex;gap:4px">${viewBtn('grid','Matrix')}${viewBtn('table','Table')}</span>
    </div>
    <div class="card" style="padding:0;overflow-x:auto">${table}</div>
    ${legend ? `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:10px">${legend}</div>` : ''}
    <p style="font-size:12px;color:var(--muted);margin:8px 2px 0">${clients.length}${filter ? ' of ' + all.length : ''} clients · sorted by latest month · click any client or cell to drill in. Status compares ${h(_matShort(recentYm))} vs ${h(_matShort(priorYm))} (complete months).</p>`;
}

// ── Tab: Movement — MoM waterfall (New + Growth − Decline − Lost) ───────
function _saWfBucketColor(k) { return { new: 'var(--success,#2e6e12)', growth: 'var(--success,#2e6e12)', decline: 'var(--danger,#b3261e)', lost: 'var(--danger,#b3261e)' }[k]; }
async function _saWaterfall(body) {
  const data = await api('/analytics/sales/waterfall' + (_SA.wfMonth ? '?month=' + encodeURIComponent(_SA.wfMonth) : ''));
  if (!data || data.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((data && data.error) || 'Unable to load.')}</div>`; return; }
  const b = data.buckets || {}, H = 180;
  const steps = [
    { label: _matShort(data.prev), val: data.prev_total, from: 0, to: data.prev_total, color: 'var(--muted)', abs: true },
    { label: 'New', val: b.new, color: _saWfBucketColor('new') },
    { label: 'Growth', val: b.growth, color: _saWfBucketColor('growth') },
    { label: 'Decline', val: b.decline, color: _saWfBucketColor('decline') },
    { label: 'Lost', val: b.lost, color: _saWfBucketColor('lost') },
    { label: _matShort(data.target), val: data.curr_total, from: 0, to: data.curr_total, color: 'var(--blue,#1d6fa4)', abs: true },
  ];
  let cum = data.prev_total;
  for (const s of steps) { if (!s.abs) { s.from = cum; s.to = cum + s.val; cum = s.to; } }
  const scale = Math.max(1, data.prev_total, data.curr_total, ...steps.map(s => Math.max(s.from, s.to))) * 1.08;
  const bars = steps.map(s => {
    const lo = Math.min(s.from, s.to), hi = Math.max(s.from, s.to);
    const bottom = (lo / scale) * H, height = Math.max(2, ((hi - lo) / scale) * H);
    const sign = s.abs ? '' : (s.val > 0 ? '+' : s.val < 0 ? '−' : '');
    const amt = s.abs ? _fmtPaise(s.val) : (s.val ? sign + _fmtPaise(Math.abs(s.val)) : '—');
    return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px">
      <div style="font-size:11px;font-weight:700;color:${s.val < 0 && !s.abs ? 'var(--danger,#b3261e)' : s.val > 0 && !s.abs ? 'var(--success,#2e6e12)' : 'var(--text)'};white-space:nowrap">${h(amt)}</div>
      <div style="position:relative;width:100%;height:${H}px">
        <div style="position:absolute;left:14%;right:14%;bottom:${bottom}px;height:${height}px;background:${s.color};border-radius:3px"></div>
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:center;white-space:nowrap">${h(s.label)}</div>
    </div>`;
  }).join('');
  const moverList = (k, title) => {
    const list = (data.movers && data.movers[k]) || [];
    if (!list.length) return '';
    return `<div class="card" style="padding:12px 14px;flex:1;min-width:200px">
      <div style="font-size:12px;font-weight:700;color:${_saWfBucketColor(k)};margin-bottom:6px">${h(title)}</div>
      ${list.map(m => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:3px 0;border-top:1px solid var(--border)">
        <button ${dataAct('salesDrill', m.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(m.name)}</button>
        <span style="font-variant-numeric:tabular-nums;font-weight:600;color:${m.delta >= 0 ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">${m.delta >= 0 ? '+' : '−'}${h(_fmtPaise(Math.abs(m.delta)))}</span></div>`).join('')}
    </div>`;
  };
  const net = data.net || 0;
  body.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <span style="font-size:13px;color:var(--muted)">What moved revenue from <b>${h(_matShort(data.prev))}</b> to <b>${h(_matShort(data.target))}</b></span>
      <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>Refresh</button>
      <span style="margin-left:auto;font-size:13px;font-weight:700;color:${net >= 0 ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">Net ${net >= 0 ? '+' : '−'}${h(_fmtPaise(Math.abs(net)))}</span>
    </div>
    <div class="card" style="padding:18px 16px 14px;margin-bottom:14px">
      <div style="display:flex;gap:4px;align-items:flex-end">${bars}</div>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      ${moverList('growth','▲ Grew most')}${moverList('new','＋ New billing')}${moverList('decline','▼ Declined most')}${moverList('lost','✕ Lost (billed before, nothing now)')}
    </div>`;
}

// ── Sliding drill-down panel (as in the mock) — opens over the current tab ──
// Clicking any client (matrix cell, waterfall mover, dashboard/exception row) slides this
// in from the right without losing the tab's state. Uses the existing Client 360 feed.
function _saEnsureDrill() {
  if (document.getElementById('sa-drill-panel')) return;
  const scrim = document.createElement('div');
  scrim.id = 'sa-drill-scrim';
  scrim.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.34);opacity:0;pointer-events:none;transition:opacity .2s;z-index:3000';
  scrim.addEventListener('click', salesDrillClose);
  const panel = document.createElement('aside');
  panel.id = 'sa-drill-panel';
  panel.setAttribute('aria-label', 'Client detail');
  panel.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:min(440px,94vw);background:var(--surface,var(--bg,#fff));border-left:1px solid var(--border);transform:translateX(100%);transition:transform .22s ease;z-index:3001;overflow-y:auto;padding:20px;box-shadow:-8px 0 24px rgba(0,0,0,.12)';
  document.body.appendChild(scrim);
  document.body.appendChild(panel);
  if (!window._saDrillKey) { window._saDrillKey = true; document.addEventListener('keydown', e => { if (e.key === 'Escape') salesDrillClose(); }); }
}
function salesDrillClose() {
  const p = document.getElementById('sa-drill-panel'), s = document.getElementById('sa-drill-scrim');
  if (p) p.style.transform = 'translateX(100%)';
  if (s) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; }
}
function _saSparkSVG(trend) {
  const arr = trend.map(t => t.net_sales || 0), w = 390, hh = 96, pad = 6, max = Math.max(1, ...arr);
  if (arr.length < 2) return '';
  const pts = arr.map((v, i) => [pad + i * (w - 2 * pad) / (arr.length - 1), hh - pad - (v / max) * (hh - 2 * pad)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = `M${pts[0][0].toFixed(1)} ${hh - pad} ` + pts.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ` L${pts[pts.length - 1][0].toFixed(1)} ${hh - pad} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${hh}" width="100%" height="96" preserveAspectRatio="none" role="img" aria-label="12-month revenue trend">
    <path d="${area}" fill="var(--blue,#1d6fa4)" opacity="0.12"></path>
    <path d="${line}" fill="none" stroke="var(--blue,#1d6fa4)" stroke-width="2.4" stroke-linejoin="round"></path>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5" fill="var(--blue,#1d6fa4)"></circle></svg>`;
}
async function salesDrill(id) {
  _saEnsureDrill();
  const panel = document.getElementById('sa-drill-panel'), scrim = document.getElementById('sa-drill-scrim');
  panel.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading…</p></div>';
  scrim.style.opacity = '1'; scrim.style.pointerEvents = 'auto'; panel.style.transform = 'none';
  const d = await api('/analytics/client/' + encodeURIComponent(id));
  if (!d || d.error) { panel.innerHTML = `<button class="btn btn-secondary btn-sm" ${dataAct('salesDrillClose')}>✕ Close</button><div style="padding:18px 2px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  const m = d.metrics || {}, health = d.health || {};
  const chipMap = { stable: ['🟢 Stable', 'var(--success,#2e6e12)'], attention: ['🟡 Attention', 'var(--warning,#8a5a00)'], at_risk: ['🔴 At risk', 'var(--danger,#b3261e)'] };
  const [hl, hc] = chipMap[health.status] || chipMap.stable;
  const recent = (d.recent_invoices || []).map(i => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:4px 8px">${h(i.number || '')}</td><td style="padding:4px 8px;color:var(--muted)">${h(i.date || '')}</td>
    <td style="padding:4px 8px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(i.total))}</td>
    <td style="padding:4px 8px;color:var(--muted)">${h(i.status || '')}</td></tr>`).join('');
  const stat = (l, v) => `<div style="background:var(--bg-subtle,#f5f5f5);border-radius:9px;padding:9px 11px"><div style="font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)">${h(l)}</div><div style="font-size:1.05rem;font-weight:800;margin-top:2px">${v}</div></div>`;
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${hc}">${h(hl)}</div>
        <div style="font-size:1.15rem;font-weight:800;line-height:1.25;margin-top:2px">${h(d.name || id)}</div></div>
      <button class="btn btn-secondary btn-sm" ${dataAct('salesDrillClose')} aria-label="Close">✕</button>
    </div>
    <div style="margin:12px 0">${_saSparkSVG(d.trend || [])}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
      ${stat('Sales (12m)', _fmtPaise(m.total_12m))}${stat('Avg / month', _fmtPaise(m.avg_monthly))}
      ${stat('Outstanding', _fmtPaise(m.outstanding))}${stat('Last billed', (m.last_billing || '—') + (m.days_since_last != null ? ' · ' + m.days_since_last + 'd' : ''))}
      ${stat('Billing cadence', (m.avg_interval_days || 0) + 'd')}${stat('Active months', (m.active_months_12m || 0) + ' / 12')}
    </div>
    <div style="font-size:12px;font-weight:700;margin:14px 0 4px">Why this status</div>
    <ul style="list-style:none;padding:0;margin:0;font-size:12.5px">${(health.reasons || []).map(r => `<li style="padding:6px 0;border-top:1px solid var(--border)">${h(r)}</li>`).join('')}</ul>
    ${recent ? `<div style="font-size:12px;font-weight:700;margin:14px 0 4px">Recent invoices</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>${recent}</tbody></table>` : ''}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      <button class="btn btn-secondary btn-sm" ${dataAct('financeViewClient', id)}>Open AR statement →</button>
      <button class="btn btn-secondary btn-sm" ${dataAct('salesDrillFull', id)}>Full Client 360 →</button>
    </div>`;
}
function salesDrillFull(id) { salesDrillClose(); salesOpenClient360(id); }

// ── Tab: Summary — exec one-screen (KPIs + trend + top movers + exceptions) ──
async function _saSummary(body) {
  const [ov, wf, exc] = await Promise.all([
    api('/analytics/sales/overview?period=90'),
    api('/analytics/sales/waterfall'),
    api('/analytics/billing-exceptions?grain=month'),
  ]);
  if (!ov || ov.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((ov && ov.error) || 'Unable to load.')}</div>`; return; }
  const k = ov.kpis || {}, c = (exc && exc.counts) || {}, m = (wf && wf.movers) || {};
  const gainers = [...(m.growth || []), ...(m.new || [])].sort((a, b) => b.delta - a.delta).slice(0, 5);
  const losers = [...(m.decline || []), ...(m.lost || [])].sort((a, b) => a.delta - b.delta).slice(0, 5);
  const net = wf ? (wf.net || 0) : 0;
  const moverRow = x => `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid var(--border);font-size:13px">
    <button ${dataAct('salesDrill', x.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h(x.name)}</button>
    <span style="font-variant-numeric:tabular-nums;font-weight:700;color:${x.delta >= 0 ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">${x.delta >= 0 ? '+' : '−'}${h(_fmtPaise(Math.abs(x.delta)))}</span></div>`;
  body.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('Sales (90d)', _fmtPaise(k.net_sales), 'billed invoice value')}
      ${_saKpi('Active clients', String(k.active_clients || 0), 'billed in period')}
      ${_saKpi('Outstanding', _fmtPaise(k.outstanding), 'open balance now')}
      ${_saKpi('Needs attention', String((c.critical || 0) + (c.attention || 0)), (c.critical || 0) + ' critical · billing exceptions')}
    </div>
    ${_saTrendChart(ov.trend || [])}
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:14px">
      <div class="card" style="padding:14px 16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">Last month movement <span style="font-weight:400;color:var(--muted)">(net ${net >= 0 ? '+' : '−'}${h(_fmtPaise(Math.abs(net)))})</span></div>
        <div style="font-size:12px;font-weight:700;color:var(--success,#2e6e12);margin-top:8px">▲ Gained most</div>
        ${gainers.length ? gainers.map(moverRow).join('') : '<div style="font-size:12px;color:var(--muted);padding:4px 0">—</div>'}
        <div style="font-size:12px;font-weight:700;color:var(--danger,#b3261e);margin-top:10px">▼ Lost / declined most</div>
        ${losers.length ? losers.map(moverRow).join('') : '<div style="font-size:12px;color:var(--muted);padding:4px 0">—</div>'}
      </div>
      <div class="card" style="padding:14px 16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Billing exceptions (this month)</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${_saKpi('🔴 Critical', String(c.critical || 0), 'not billed')}
          ${_saKpi('🟠 Attention', String(c.attention || 0), 'drop / not billed')}
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px">Potential gap <b style="color:var(--danger,#b3261e)">${h(_fmtPaise((exc && exc.potential_gap) || 0))}</b></div>
        <button class="btn btn-secondary btn-sm" ${dataAct('salesSetTab', 'exceptions')} style="margin-top:10px">Open Billing Exceptions →</button>
      </div>
    </div>`;
}

// ── Tab: Risk — churn radar (Stable / Attention / At-risk) ─────────────
function _saRiskChip(s) { const map = { at_risk: ['🔴 At risk', 'var(--danger,#b3261e)'], attention: ['🟡 Attention', 'var(--warning,#8a5a00)'], stable: ['🟢 Stable', 'var(--success,#2e6e12)'] }; return map[s] || map.stable; }
async function _saRisk(body) {
  const d = await api('/analytics/sales/health');
  if (!d || d.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  const c = d.counts || {};
  const row = x => { const [lbl, col] = _saRiskChip(x.status); return `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px"><button ${dataAct('salesDrill', x.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer">${h(x.name)}</button></td>
    <td style="padding:7px 12px;white-space:nowrap"><span style="font-weight:700;color:${col}">${h(lbl)}</span></td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(x.total_12m))}</td>
    <td style="padding:7px 12px;text-align:right">${x.days_since_last == null ? '—' : x.days_since_last + 'd'}</td>
    <td style="padding:7px 12px;font-size:12px;color:var(--muted)">${h((x.reasons || [])[0] || '')}</td></tr>`; };
  body.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${_saKpi('🔴 At risk', String(c.at_risk || 0), 'quiet or dropping sharply')}
      ${_saKpi('🟡 Attention', String(c.attention || 0), 'softening / sparse')}
      ${_saKpi('🟢 Stable', String(c.stable || 0), 'steady')}
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 8px">Ranked by risk, then size. Click a client to drill in. Scored on recency + consistency + 3-month trend.</p>
    <div class="card" style="padding:0;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
          <th style="padding:8px 12px">Client</th><th style="padding:8px 12px">Status</th>
          <th style="padding:8px 12px;text-align:right">Sales (12m)</th><th style="padding:8px 12px;text-align:right">Last billed</th>
          <th style="padding:8px 12px">Why</th></tr></thead>
        <tbody>${(d.clients || []).map(row).join('') || `<tr><td colspan="5" style="padding:16px;color:var(--muted)">No client history.</td></tr>`}</tbody>
      </table></div>`;
}

// ── Tab: Retention — new-client cohort grid ────────────────────────────
function _saRetHeat(pct) { if (pct <= 0) return 'background:var(--surface-2,transparent);color:var(--muted)'; const a = 0.12 + 0.8 * (pct / 100); return `background:rgba(16,122,70,${a.toFixed(3)});color:${a > 0.55 ? '#fff' : 'inherit'}`; }
async function _saRetention(body) {
  const d = await api('/analytics/sales/retention');
  if (!d || d.error) { body.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h((d && d.error) || 'Unable to load.')}</div>`; return; }
  const cohorts = (d.cohorts || []);
  const maxLen = Math.max(1, ...cohorts.map(c => c.retention.length));
  const headCols = Array.from({ length: maxLen }, (_, i) => `<th style="padding:6px 8px;color:var(--muted);font-weight:600;font-size:11px">M+${i}</th>`).join('');
  const rows = cohorts.map(c => {
    const cells = Array.from({ length: maxLen }, (_, i) => {
      const r = c.retention[i];
      if (!r) return `<td style="padding:6px 8px"></td>`;
      return `<td title="${h(c.month)} +${i}mo · ${r.active}/${c.size} active" style="padding:6px 8px;text-align:center;font-size:11px;font-weight:600;${_saRetHeat(r.pct)}">${r.pct}%</td>`;
    }).join('');
    return `<tr style="border-top:1px solid var(--border)"><td style="padding:6px 10px;white-space:nowrap;position:sticky;left:0;background:var(--bg,#fff);border-right:1px solid var(--border)"><b>${h(c.month)}</b> <span style="color:var(--muted);font-size:11px">· ${c.size}</span></td>${cells}</tr>`;
  }).join('');
  body.innerHTML = `
    <p style="font-size:12px;color:var(--muted);margin:0 0 10px">Each row is the clients whose <b>first</b> invoice fell in that month (count after the ·). Columns show how many were still billing that many months later — how well new wins stick.</p>
    <div class="card" style="padding:0;overflow-x:auto">
      <table style="border-collapse:collapse;width:100%;min-width:620px;font-size:12px">
        <thead><tr style="background:var(--bg-subtle,#f5f5f5)"><th style="padding:7px 10px;text-align:left;position:sticky;left:0;background:var(--bg-subtle,#f5f5f5)">Cohort · size</th>${headCols}</tr></thead>
        <tbody>${rows || `<tr><td style="padding:16px;color:var(--muted)">No cohort data.</td></tr>`}</tbody>
      </table></div>`;
}
