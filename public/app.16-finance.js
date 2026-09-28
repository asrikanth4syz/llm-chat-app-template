/* ============================================================
 * app.16-finance.js — Phase 3 Finance (003-finance-ar), Slice 1
 * Receivables cockpit (finance/ops) + client statement (client_*).
 * Read-only views over the Zoho-Books AR mirror. Money arrives as
 * INTEGER paise from the API and is formatted for display only.
 * dataAct targets here (financeRefresh) are top-level globals so the
 * smoke test's delegated-target check resolves them.
 * ========================================================== */

// Format integer paise → a currency string (display only; never re-stored).
function _fmtPaise(paise, currency) {
  const cur = currency || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format((paise || 0) / 100);
  } catch (_) {
    return cur + ' ' + ((paise || 0) / 100).toFixed(2);
  }
}

const _AGING_LABEL = { current: 'Current', '1-30': '1–30', '31-60': '31–60', '61-90': '61–90', '91+': '90+' };

// Re-render whichever finance page is active (delegated 'financeRefresh' target).
function financeRefresh() {
  const main = document.getElementById('main-content');
  if (!main) return;
  if (APP.page === 'my_statement') renderMyStatement(main);
  else renderReceivables(main);
}

// One per-currency KPI + aging block.
function _financeCurrencyBlock(c) {
  const kpi = (label, val) => `
    <div class="card" style="flex:1;min-width:150px;padding:14px 16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
      <div style="font-size:1.4rem;font-weight:600;margin-top:4px">${h(val)}</div>
    </div>`;
  const buckets = ['current', '1-30', '31-60', '61-90', '91+'];
  const agingCells = buckets.map(b => `
    <td style="padding:8px 12px;text-align:right">${h(_fmtPaise(c.buckets[b] || 0, c.currency))}</td>`).join('');
  return `
    <section style="margin-bottom:24px">
      <h3 style="margin:0 0 10px">${h(c.currency)}</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        ${kpi('Total Outstanding', _fmtPaise(c.outstanding, c.currency))}
        ${kpi('Overdue', _fmtPaise(c.overdue, c.currency))}
        ${kpi('Due This Week', _fmtPaise(c.due_this_week, c.currency))}
        ${kpi('DSO (days)', String(c.dso))}
      </div>
      <div class="card" style="padding:0;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:var(--bg-subtle,#f5f5f5)">
            ${buckets.map(b => `<th style="padding:8px 12px;text-align:right;font-weight:600">${h(_AGING_LABEL[b])}</th>`).join('')}
          </tr></thead>
          <tbody><tr>${agingCells}</tr></tbody>
        </table>
      </div>
    </section>`;
}

// Invoice rows table (shared by cockpit + statement). `showClient` adds a client column.
function _financeInvoiceTable(invoices, showClient) {
  if (!invoices.length) return `<div class="card" style="padding:20px;color:var(--muted)">No open invoices.</div>`;
  const head = `
    <tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
      <th style="padding:8px 12px">Invoice</th>
      ${showClient ? '<th style="padding:8px 12px">Client</th>' : ''}
      <th style="padding:8px 12px">Due</th>
      <th style="padding:8px 12px;text-align:right">Total</th>
      <th style="padding:8px 12px;text-align:right">Balance</th>
      <th style="padding:8px 12px">Status</th>
      <th style="padding:8px 12px">Aging</th>
    </tr>`;
  const rows = invoices.map(inv => `
    <tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${h(inv.number || inv.id)}</td>
      ${showClient ? `<td style="padding:8px 12px">${h(inv.client_id || '')}</td>` : ''}
      <td style="padding:8px 12px">${h(inv.due_date || '')}</td>
      <td style="padding:8px 12px;text-align:right">${h(_fmtPaise(inv.total, inv.currency_code))}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600">${h(_fmtPaise(inv.balance, inv.currency_code))}</td>
      <td style="padding:8px 12px">${h(inv.status || '')}</td>
      <td style="padding:8px 12px">${h(_AGING_LABEL[inv.age_bucket] || inv.age_bucket || '')}</td>
    </tr>`).join('');
  return `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

// Finance/ops cockpit: per-currency KPIs + aging + the open-invoice list.
async function renderReceivables(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading receivables…</p></div>`;
  const [summary, list] = await Promise.all([api('/finance/ar/summary'), api('/finance/ar/invoices')]);
  if (!summary || !list) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load receivables.</div>`; return; }
  const byCur = summary.by_currency || [];
  const invoices = list.invoices || [];
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">Receivables</h2>
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')} Refresh</button>
    </div>
    ${byCur.length ? byCur.map(_financeCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">No outstanding receivables.</div>`}
    <h3 style="margin:18px 0 10px">Open Invoices</h3>
    ${_financeInvoiceTable(invoices, true)}`;
}

// Client statement: the caller's own outstanding invoices (server forces scope).
async function renderMyStatement(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading statement…</p></div>`;
  const cid = APP.user && APP.user.client_id;
  if (!cid) { main.innerHTML = `<div class="card" style="padding:20px">No client account is linked to your login.</div>`; return; }
  const data = await api('/finance/ar/client/' + encodeURIComponent(cid));
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load your statement.</div>`; return; }
  const byCur = data.by_currency || [];
  const invoices = data.invoices || [];
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">My Statement</h2>
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button>
    </div>
    ${byCur.map(_financeCurrencyBlock).join('')}
    <h3 style="margin:18px 0 10px">Open Invoices</h3>
    ${_financeInvoiceTable(invoices, false)}`;
}
