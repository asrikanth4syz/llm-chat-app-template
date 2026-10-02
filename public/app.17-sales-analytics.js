// ════════════════════════════════════════════════════════════════════════
// Sales Analytics (app.17) — SUPER-ADMIN ONLY. Sales data is not shown to any
// other role: the page lives only in the platform (super-admin) sidebar and
// every endpoint is gated to super_admin server-side. Built on the invoice
// mirror; no product-line data (Phase 2). Money arrives as INTEGER paise.
// ════════════════════════════════════════════════════════════════════════
const _SA = { period: 90 };

// Status chip for a client's month-on-month movement.
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

// A 12-month bar chart drawn with plain divs (CSP-safe, no chart library).
function _saTrendChart(trend) {
  const max = Math.max(1, ...trend.map(t => t.net_sales));
  const bars = trend.map(t => {
    const pct = Math.round((t.net_sales / max) * 100);
    const label = t.month.slice(5); // MM
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0" title="${h(t.month)} · ${h(_fmtPaise(t.net_sales))} · ${h(String(t.invoices))} invoices">
      <div style="width:100%;display:flex;align-items:flex-end;height:120px">
        <div style="width:100%;background:var(--blue,#1d6fa4);border-radius:4px 4px 0 0;height:${Math.max(2, pct)}%;min-height:2px"></div>
      </div>
      <div style="font-size:10px;color:var(--muted)">${h(label)}</div>
    </div>`;
  }).join('');
  return `<div class="card" style="padding:16px">
    <div style="font-size:13px;font-weight:600;margin-bottom:12px">Monthly sales — last 12 months</div>
    <div style="display:flex;gap:4px;align-items:flex-end">${bars}</div>
  </div>`;
}

function _saKpi(label, value, sub) {
  return `<div class="card" style="flex:1;min-width:150px;padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
    <div style="font-size:1.5rem;font-weight:700;margin-top:4px">${h(value)}</div>
    ${sub ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${h(sub)}</div>` : ''}</div>`;
}

async function renderSalesAnalytics(main) {
  if (!main) return;
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading sales analytics…</p></div>`;
  const period = _SA.period || 90;
  const data = await api('/analytics/sales/overview?period=' + period);
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load sales analytics.</div>`; return; }
  if (data.error) { main.innerHTML = `<div class="card" style="padding:20px;color:var(--danger,#b3261e)">${h(data.error)}</div>`; return; }
  const k = data.kpis || {};
  const perf = data.client_performance || [];
  const periodBtn = (n, label) => `<button class="btn ${period === n ? 'btn-primary' : 'btn-secondary'} btn-sm" ${dataAct('salesSetPeriod', n)}>${h(label)}</button>`;
  const perfRows = perf.slice(0, 100).map(c => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:7px 12px">${h(c.name || c.client_id)}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(c.prev))}</td>
    <td style="padding:7px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600">${h(_fmtPaise(c.curr))}</td>
    <td style="padding:7px 12px;text-align:right">${_saStatusChip(c.status, c.growth_pct)}</td></tr>`).join('');
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">Sales Analytics</h2>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${periodBtn(30, '30d')}${periodBtn(90, '90d')}${periodBtn(180, '180d')}${periodBtn(365, '1y')}
        <button class="btn btn-secondary btn-sm" ${dataAct('renderSalesAnalyticsRefresh')}>${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')} Refresh</button>
      </div>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:0 0 14px">Super-admin only. Figures are billed invoice value from Zoho Books over the selected period.</p>
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
          <th style="padding:8px 12px">Client</th>
          <th style="padding:8px 12px;text-align:right">Last month</th>
          <th style="padding:8px 12px;text-align:right">This month</th>
          <th style="padding:8px 12px;text-align:right">Movement</th></tr></thead>
        <tbody>${perfRows || `<tr><td colspan="4" style="padding:16px;color:var(--muted)">No billing in the last two months.</td></tr>`}</tbody>
      </table>
    </div>
    <p style="font-size:12px;color:var(--muted);margin:14px 0 0">Billing Exceptions, Client 360, and salesperson / region / target analytics are coming next.</p>`;
}
// Refresh / period handlers (delegated, CSP-safe).
function renderSalesAnalyticsRefresh() { const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
function salesSetPeriod(n) { _SA.period = parseInt(n, 10) || 90; const m = document.getElementById('main-content'); if (m) renderSalesAnalytics(m); }
