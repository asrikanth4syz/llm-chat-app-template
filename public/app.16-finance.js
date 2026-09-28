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
  const fn = { my_statement: renderMyStatement, payables: renderPayables, reminders: renderReminders,
    reconciliation: renderReconciliation, finance_dashboard: renderFinanceDashboard }[APP.page] || renderReceivables;
  fn(main);
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

// ── Payables (finance/ops): per-vendor aging + DPO + bills due ─────────
function _apCurrencyBlock(c) {
  const kpi = (label, val) => `<div class="card" style="flex:1;min-width:150px;padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
    <div style="font-size:1.4rem;font-weight:600;margin-top:4px">${h(val)}</div></div>`;
  const buckets = ['current', '1-30', '31-60', '61-90', '91+'];
  return `<section style="margin-bottom:24px">
    <h3 style="margin:0 0 10px">${h(c.currency)}</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${kpi('Total Payable', _fmtPaise(c.outstanding, c.currency))}
      ${kpi('Overdue', _fmtPaise(c.overdue, c.currency))}
      ${kpi('Due This Week', _fmtPaise(c.due_this_week, c.currency))}
      ${kpi('DPO (days)', String(c.dpo))}</div>
    <div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5)">${buckets.map(b => `<th style="padding:8px 12px;text-align:right;font-weight:600">${h(_AGING_LABEL[b])}</th>`).join('')}</tr></thead>
      <tbody><tr>${buckets.map(b => `<td style="padding:8px 12px;text-align:right">${h(_fmtPaise(c.buckets[b] || 0, c.currency))}</td>`).join('')}</tr></tbody>
    </table></div></section>`;
}
async function renderPayables(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading payables…</p></div>`;
  const [summary, list] = await Promise.all([api('/finance/ap/summary'), api('/finance/ap/bills')]);
  if (!summary || !list) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load payables.</div>`; return; }
  const byCur = summary.by_currency || [];
  const bills = list.bills || [];
  const rows = bills.length ? bills.map(b => {
    const overdue = b.age_bucket && b.age_bucket !== 'current';
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${h(b.number || b.id)}</td>
      <td style="padding:8px 12px">${h(b.vendor_id || '')}</td>
      <td style="padding:8px 12px">${h(b.due_date || '')}${overdue ? ' <span style="color:var(--danger,#b3261e)">⚠ pay before due</span>' : ''}</td>
      <td style="padding:8px 12px;text-align:right">${h(_fmtPaise(b.total, b.currency_code))}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600">${h(_fmtPaise(b.balance, b.currency_code))}</td>
      <td style="padding:8px 12px">${h(b.status || '')}</td>
      <td style="padding:8px 12px">${h(_AGING_LABEL[b.age_bucket] || b.age_bucket || '')}</td></tr>`;
  }).join('') : '';
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">Payables</h2>
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button></div>
    ${byCur.length ? byCur.map(_apCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">No outstanding payables.</div>`}
    <h3 style="margin:18px 0 10px">Open Bills</h3>
    ${rows ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
        <th style="padding:8px 12px">Bill</th><th style="padding:8px 12px">Vendor</th><th style="padding:8px 12px">Due</th>
        <th style="padding:8px 12px;text-align:right">Total</th><th style="padding:8px 12px;text-align:right">Balance</th>
        <th style="padding:8px 12px">Status</th><th style="padding:8px 12px">Aging</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : `<div class="card" style="padding:20px;color:var(--muted)">No open bills.</div>`}`;
}

// ── Reconciliation (finance/ops): exception worklist ───────────────────
async function renderReconciliation(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading exceptions…</p></div>`;
  const data = await api('/finance/reconcile/exceptions');
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load reconciliation.</div>`; return; }
  const ex = data.exceptions || [];
  const rows = ex.map(e => `<tr style="border-top:1px solid var(--border)">
    <td style="padding:8px 12px">${h(e.kind === 'ar_3way' ? 'AR' : 'AP')}</td>
    <td style="padding:8px 12px">${h(e.left_type)} ${h(e.left_id)}</td>
    <td style="padding:8px 12px">${h(e.variance_reason || '')}</td>
    <td style="padding:8px 12px;text-align:right">${e.variance_amount ? _fmtPaise(e.variance_amount) : '—'}</td>
    <td style="padding:8px 12px"><button class="btn btn-secondary" ${dataAct('financeResolveException', e.id)}>Resolve</button></td></tr>`).join('');
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">Reconciliation</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" ${dataAct('financeRunReconcile')}>Run reconciliation</button>
        <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button></div></div>
    <h3 style="margin:0 0 10px">Exceptions (${ex.length})</h3>
    ${ex.length ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
        <th style="padding:8px 12px">Ledger</th><th style="padding:8px 12px">Document</th><th style="padding:8px 12px">Reason</th>
        <th style="padding:8px 12px;text-align:right">Variance</th><th style="padding:8px 12px"></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
      : `<div class="card" style="padding:20px;color:var(--muted)">No open exceptions. Run reconciliation to refresh.</div>`}`;
}
async function financeRunReconcile() {
  const r = await api('/finance/reconcile/run', { method: 'POST', body: JSON.stringify({}) });
  if (r) { showToast(`Reconciliation: ${r.total} exception(s) (AR ${r.ar_exceptions}, AP ${r.ap_exceptions})`, 'info'); renderReconciliation(document.getElementById('main-content')); }
}
async function financeResolveException(id) {
  const note = prompt('Resolution note (optional):') ?? '';
  const r = await api(`/finance/reconcile/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: JSON.stringify({ note }) });
  if (r) { showToast('Exception resolved', 'success'); renderReconciliation(document.getElementById('main-content')); }
}

// ── Finance dashboard (finance/ops): AR vs AP + cash position ──────────
async function renderFinanceDashboard(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading finance dashboard…</p></div>`;
  const d = await api('/finance/dashboard');
  if (!d) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load dashboard.</div>`; return; }
  const cashCards = (d.cash || []).map(c => `
    <div class="card" style="flex:1;min-width:200px;padding:16px">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Net position (${h(c.currency)})</div>
      <div style="font-size:1.5rem;font-weight:600;margin-top:4px;color:${c.net >= 0 ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">${h(_fmtPaise(c.net, c.currency))}</div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">AR ${h(_fmtPaise(c.ar, c.currency))} · AP ${h(_fmtPaise(c.ap, c.currency))}</div>
    </div>`).join('');
  const list = (title, rows, idKey) => `<div class="card" style="flex:1;min-width:260px;padding:0;overflow-x:auto">
    <div style="padding:10px 14px;font-weight:600;border-bottom:1px solid var(--border)">${h(title)}</div>
    ${(rows || []).length ? `<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rows.map(r => `<tr style="border-top:1px solid var(--border)"><td style="padding:8px 12px">${h(r[idKey] || '')}</td><td style="padding:8px 12px;text-align:right">${h(_fmtPaise(r.bal, r.currency_code))}</td></tr>`).join('')}</tbody></table>` : `<div style="padding:16px;color:var(--muted)">None</div>`}
  </div>`;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">Finance Dashboard</h2>
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">${cashCards || '<div class="card" style="padding:16px;color:var(--muted)">No balances yet.</div>'}</div>
    <div class="card" style="padding:12px 16px;margin:8px 0 16px">Open reconciliation exceptions: <strong>${h(String(d.open_exceptions || 0))}</strong></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      ${list('Top Debtors (AR)', d.top_debtors, 'client_id')}
      ${list('Top Creditors (AP)', d.top_creditors, 'vendor_id')}
    </div>`;
}

// ── Reminders (finance/ops): follow-up-due worklist + run log ──────────
// Collector-initiated overdue follow-ups (Send button, gated by min-gap on the
// server) plus the recent reminder_runs audit. Auto tiers are sent by the cron.
async function renderReminders(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading reminders…</p></div>`;
  const [rules, due, runs] = await Promise.all([
    api('/finance/reminders/rules'), api('/finance/reminders/followups-due'), api('/finance/reminders/runs')]);
  if (!rules || !due || !runs) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load reminders.</div>`; return; }
  const mode = rules.mode || 'off';
  const followups = due.followups || [];
  const rows = followups.map(f => {
    const amt = Object.entries(f.total_outstanding || {}).map(([c, v]) => _fmtPaise(v, c)).join(', ');
    const status = f.opt_out ? 'Opted out' : f.hold ? ('Hold: ' + f.hold) : !f.email ? 'No email'
      : f.eligible ? 'Eligible' : ('Eligible in ' + f.eligible_in_days + 'd');
    const btn = f.eligible
      ? `<button class="btn btn-primary" ${dataAct('financeSendFollowup', f.client_id)}>Send follow-up</button>`
      : `<button class="btn btn-secondary" disabled title="${h(status)}">Send follow-up</button>`;
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${h(f.name || f.client_id)}</td>
      <td style="padding:8px 12px">${h(f.tier)}</td>
      <td style="padding:8px 12px;text-align:right">${h(String(f.worst_overdue_days))}</td>
      <td style="padding:8px 12px;text-align:right">${h(amt)}</td>
      <td style="padding:8px 12px">${h(status)}</td>
      <td style="padding:8px 12px">${btn}</td></tr>`;
  }).join('');
  const runRows = (runs.runs || []).slice(0, 50).map(r => `
    <tr style="border-top:1px solid var(--border)">
      <td style="padding:6px 12px">${h((r.run_at || '').replace('T', ' ').slice(0, 16))}</td>
      <td style="padding:6px 12px">${h(r.client_id)}</td>
      <td style="padding:6px 12px">${h(r.tier)}</td>
      <td style="padding:6px 12px">${h(r.status)}${r.suppressed_reason ? ' — ' + h(r.suppressed_reason) : ''}</td>
      <td style="padding:6px 12px">${h(r.actor || '')}${r.forced ? ' (forced)' : ''}</td></tr>`).join('');
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2 style="margin:0">Payment Reminders</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" ${dataAct('financeRunReminders')}>Run auto pass</button>
        <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button>
      </div>
    </div>
    <div class="card" style="padding:12px 16px;margin-bottom:16px">
      Mode: <strong>${h(mode)}</strong> ${mode === 'off' ? '— reminders are disabled (no mail is sent).' : mode === 'dry_run' ? '— dry run: statements are logged, nothing is sent.' : '— live sending.'}
    </div>
    <h3 style="margin:0 0 10px">Follow-ups Due (${followups.length})</h3>
    ${followups.length ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
        <th style="padding:8px 12px">Client</th><th style="padding:8px 12px">Tier</th>
        <th style="padding:8px 12px;text-align:right">Overdue (d)</th><th style="padding:8px 12px;text-align:right">Outstanding</th>
        <th style="padding:8px 12px">Status</th><th style="padding:8px 12px"></th></tr></thead>
      <tbody>${rows}</tbody></table></div>`
      : `<div class="card" style="padding:20px;color:var(--muted)">No overdue customers awaiting a follow-up.</div>`}
    <h3 style="margin:18px 0 10px">Recent Runs</h3>
    ${runRows ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
        <th style="padding:6px 12px">When</th><th style="padding:6px 12px">Client</th><th style="padding:6px 12px">Tier</th>
        <th style="padding:6px 12px">Status</th><th style="padding:6px 12px">By</th></tr></thead>
      <tbody>${runRows}</tbody></table></div>`
      : `<div class="card" style="padding:20px;color:var(--muted)">No reminder runs yet.</div>`}`;
}

// Collector action: send an overdue follow-up (server enforces gap + holds).
async function financeSendFollowup(clientId) {
  if (!confirm('Send a follow-up statement to this customer now?')) return;
  const r = await api('/finance/reminders/send-followup', { method: 'POST', body: JSON.stringify({ client_id: clientId }) });
  if (r) { showToast('Follow-up: ' + (r.status || 'done') + (r.reason ? ' (' + r.reason + ')' : ''), r.status === 'sent' ? 'success' : 'info'); renderReminders(document.getElementById('main-content')); }
}
async function financeRunReminders() {
  if (!confirm('Run the automatic reminder pass now?')) return;
  const r = await api('/finance/reminders/run', { method: 'POST', body: JSON.stringify({}) });
  if (r) { showToast('Auto pass: ' + r.status + ' · sent ' + (r.sent || 0) + ' · suppressed ' + (r.suppressed || 0), 'info'); renderReminders(document.getElementById('main-content')); }
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
