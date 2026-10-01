/* ============================================================
 * app.16-finance.js — Phase 3 Finance (003-finance-ar)
 * Receivables/Payables cockpits (finance/ops) + client statement,
 * reminders worklist, reconciliation, dashboard, and the go-live
 * Finance Setup panel. Read views over the Zoho-Books mirror; money
 * arrives as INTEGER paise and is formatted for display only.
 *
 * Non-technical usability layer (built as follow-ups):
 *   • human names (not Zoho ids) everywhere,
 *   • "Data synced …" freshness line on the cockpits,
 *   • in-cockpit search box (delegated data-input),
 *   • click-a-name to drill into that customer's / vendor's statement,
 *   • one-click CSV export of the aging list,
 *   • plain-language tooltips on DSO / DPO.
 * dataAct / data-input targets are top-level globals so the smoke test's
 * delegated-target check resolves them.
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

const _AGING_LABEL = { current: 'Current', '1-30': '1–30', '31-60': '31–60', '61-90': '61–90', '91+': '91+' };

// In-memory cache of the last-loaded lists + active search text, so the search
// box and the CSV export both work off the same data without a re-fetch.
const _FIN = { ar: [], ap: [], followups: [], arQ: '', apQ: '', foQ: '', arSort: null, apSort: null, arPage: 1, apPage: 1,
  customers: [], custQ: '', custSort: { col: 'total_due_now', dir: 'desc' }, custPage: 1, asOf: '', kpiPeriod: 90 };

// Print the given HTML as a PDF via the browser (Ctrl/Cmd+P → Save as PDF). CSP-safe:
// a print-only container + @media print stylesheet, then window.print().
function financePrint(title, innerHtml) {
  document.getElementById('fin-print')?.remove();
  document.getElementById('fin-print-style')?.remove();
  const style = document.createElement('style');
  style.id = 'fin-print-style';
  style.textContent = '@media print{body>*{display:none!important}#fin-print{display:block!important}}#fin-print{font-family:Arial,Helvetica,sans-serif;color:#111}#fin-print table{border-collapse:collapse;width:100%;font-size:12px}#fin-print th,#fin-print td{border:1px solid #ccc;padding:5px 8px;text-align:left}#fin-print td.n,#fin-print th.n{text-align:right}';
  const div = document.createElement('div');
  div.id = 'fin-print'; div.style.display = 'none';
  div.innerHTML = `<h2 style="margin:0 0 4px">${h(title)}</h2><div style="font-size:12px;color:#555;margin-bottom:10px">Generated ${h(new Date().toLocaleString())}</div>${innerHtml}`;
  document.body.appendChild(style); document.body.appendChild(div);
  window.print();
  setTimeout(() => { div.remove(); style.remove(); }, 800);
}

// Cap how many rows get built into the DOM at once — a few thousand <tr> via
// innerHTML is what makes the cockpit janky. Sort/filter/export still operate on
// the full cached list; only the render is capped, with a footer note.
const _FIN_RENDER_CAP = 250;
function _finCapNote(total) {
  if (total <= _FIN_RENDER_CAP) return '';
  return `<div style="padding:8px 12px;font-size:12px;color:var(--muted);border-top:1px solid var(--border)">Showing the first ${_FIN_RENDER_CAP} of ${total} rows. Use search or a column sort to narrow, or Export CSV for the full list.</div>`;
}
// Prev/Next pager footer for a paginated cockpit table.
function _finPager(kind, page, total) {
  const pages = Math.max(1, Math.ceil(total / _FIN_RENDER_CAP));
  if (pages <= 1) return `<div style="padding:8px 12px;font-size:12px;color:var(--muted);border-top:1px solid var(--border)">${total} row${total === 1 ? '' : 's'}</div>`;
  const start = (page - 1) * _FIN_RENDER_CAP;
  const end = Math.min(total, start + _FIN_RENDER_CAP);
  const btn = (delta, label, disabled) => `<button class="btn btn-secondary btn-sm" ${disabled ? 'disabled' : dataAct('financePage', kind, delta)} style="${disabled ? 'opacity:.5;cursor:default' : ''}">${label}</button>`;
  return `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">
    <span>Showing ${start + 1}–${end} of ${total}</span>
    <span style="display:flex;align-items:center;gap:8px">${btn(-1, '◀ Prev', page <= 1)}<span>Page ${page} of ${pages}</span>${btn(1, 'Next ▶', page >= pages)}</span></div>`;
}
function financePage(kind, delta) {
  if (kind === 'ar') { _FIN.arPage = Math.max(1, (_FIN.arPage || 1) + delta); _renderArTable(); }
  else if (kind === 'ap') { _FIN.apPage = Math.max(1, (_FIN.apPage || 1) + delta); _renderApTable(); }
  else if (kind === 'cust') { _FIN.custPage = Math.max(1, (_FIN.custPage || 1) + delta); _renderCustTable(); }
}
// Colored, theme-safe status pill (bordered, text-colored). open = fully due → red.
function _finStatusPill(status) {
  const s = String(status || '').toLowerCase();
  const c = s === 'paid' ? 'var(--success,#2e6e12)' : s === 'partial' ? 'var(--warning,#8a5a00)'
    : s === 'void' ? 'var(--muted,#777)' : 'var(--danger,#b3261e)';
  return `<span style="display:inline-block;padding:1px 9px;border:1px solid ${c};border-radius:10px;font-size:11px;font-weight:600;color:${c};text-transform:capitalize">${h(status || '—')}</span>`;
}

// Where the effective due date came from (PRD §15 precedence). Small chip next to the
// due date so an operator can see whether it's the Zoho date, a credit-period derivation,
// the workspace default, or a manual override.
const _DUE_SRC = {
  zoho:    { t: 'Zoho',    c: 'var(--blue,#1d6fa4)' },
  client:  { t: 'Client',  c: 'var(--purple,#6b4fa1)' },
  default: { t: 'Default', c: 'var(--muted,#777)' },
  manual:  { t: 'Manual',  c: 'var(--warning,#8a5a00)' },
};
function _finDueBadge(src) {
  const m = _DUE_SRC[String(src || '').toLowerCase()];
  if (!m) return '';
  return ` <span title="Due date source: ${m.t}" style="display:inline-block;padding:0 6px;border:1px solid ${m.c};border-radius:8px;font-size:10px;font-weight:600;color:${m.c};vertical-align:middle">${m.t}</span>`;
}

// ── Sortable-column helpers (client-side, over the cached list) ─────────
const _AGING_ORDER = { current: 0, '1-30': 1, '31-60': 2, '61-90': 3, '91+': 4 };
const _FIN_NUMERIC = new Set(['total', 'balance', 'worst_overdue_days', 'billed', 'paid', 'outstanding', 'overdue', 'invoices', 'open_invoices']);
function _finSortVal(row, col) {
  if (col === 'age_bucket') return _AGING_ORDER[row[col]] ?? 99;
  if (_FIN_NUMERIC.has(col)) return Number(row[col] || 0);
  return String(row[col] == null ? '' : row[col]).toLowerCase();
}
function _finSortRows(rows, sort) {
  if (!sort || !sort.col) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const va = _finSortVal(a, sort.col), vb = _finSortVal(b, sort.col);
    if (va < vb) return -1 * dir; if (va > vb) return 1 * dir; return 0;
  });
}
function _finToggleSort(cur, col) {
  if (cur && cur.col === col) return { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' };
  return { col, dir: 'asc' };
}
// A clickable, sort-aware header cell. `sortKind` null → a plain header.
function _sortableTh(sortKind, col, label, alignRight) {
  const style = `padding:8px 12px;${alignRight ? 'text-align:right' : 'text-align:left'}`;
  if (!sortKind) return `<th style="${style}">${h(label)}</th>`;
  const cur = sortKind === 'ar' ? _FIN.arSort : _FIN.apSort;
  const arrow = cur && cur.col === col ? (cur.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th style="${style}"><button ${dataAct('financeSort', sortKind, col)} title="Sort by ${h(label)}"
    style="background:none;border:none;padding:0;font:inherit;font-weight:600;cursor:pointer;color:inherit;${alignRight ? '' : ''}">${h(label)}<span style="color:var(--blue,#1d6fa4)">${arrow}</span></button></th>`;
}
function financeSort(kind, col) {
  if (kind === 'ar') { _FIN.arSort = _finToggleSort(_FIN.arSort, col); _FIN.arPage = 1; _renderArTable(); }
  else if (kind === 'ap') { _FIN.apSort = _finToggleSort(_FIN.apSort, col); _FIN.apPage = 1; _renderApTable(); }
  else if (kind === 'cust') { _FIN.custSort = _finToggleSort(_FIN.custSort, col); _FIN.custPage = 1; _renderCustTable(); }
}
function _renderArTable() {
  const host = document.getElementById('ar-table-host'); if (!host) return;
  const rows = _finSortRows(_FIN.ar.filter(i => _finRowMatch(i, _FIN.arQ)), _FIN.arSort);
  const pages = Math.max(1, Math.ceil(rows.length / _FIN_RENDER_CAP));
  _FIN.arPage = Math.min(Math.max(1, _FIN.arPage || 1), pages);
  host.innerHTML = _financeInvoiceTable(rows, true, 'ar', _FIN.arPage);
}
function _renderApTable() {
  const host = document.getElementById('ap-table-host'); if (!host) return;
  const rows = _finSortRows(_FIN.ap.filter(b => _finRowMatch(b, _FIN.apQ)), _FIN.apSort);
  const pages = Math.max(1, Math.ceil(rows.length / _FIN_RENDER_CAP));
  _FIN.apPage = Math.min(Math.max(1, _FIN.apPage || 1), pages);
  host.innerHTML = _apBillTable(rows, _FIN.apPage);
}

// Human-friendly "how long ago" for the last-synced line (falls back to the date).
function _finAgo(iso) {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (isNaN(t)) return String(iso);
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) { const m = Math.floor(s / 60); return m + ' minute' + (m === 1 ? '' : 's') + ' ago'; }
  if (s < 86400) { const hh = Math.floor(s / 3600); return hh + ' hour' + (hh === 1 ? '' : 's') + ' ago'; }
  const d = Math.floor(s / 86400);
  if (d < 30) return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  try { return new Date(t).toLocaleDateString(); } catch (_) { return iso.slice(0, 10); }
}
// A muted "Data synced …" line for a cockpit header.
function _finSyncedLine(iso) {
  return `<div style="font-size:12px;color:var(--muted);margin:-8px 0 14px">Data synced ${h(_finAgo(iso))}${iso ? ' · from Zoho Books' : ' — an admin can turn on the sync under Finance Setup'}</div>`;
}

// A search + export toolbar. `kind` drives which filter/export target fires.
function _finToolbar(kind, placeholder, withExport) {
  const q = kind === 'ar' ? _FIN.arQ : kind === 'ap' ? _FIN.apQ : kind === 'cust' ? _FIN.custQ : _FIN.foQ;
  const filterFn = kind === 'ar' ? 'financeFilterAr' : kind === 'ap' ? 'financeFilterAp' : kind === 'cust' ? 'financeFilterCust' : 'financeFilterFollowups';
  const exportBtn = withExport
    ? `<button class="btn btn-secondary" ${dataAct('financeExportCsv', kind)} title="Download this list as a CSV spreadsheet">Export CSV</button>`
    : '';
  return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
    <input type="search" data-input="${filterFn}" data-val value="${h(q || '')}" placeholder="${h(placeholder)}"
      aria-label="${h(placeholder)}"
      style="flex:1;min-width:180px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font:inherit;background:var(--bg,#fff);color:inherit">
    ${exportBtn}</div>`;
}

// Case-insensitive match across a row's display-relevant fields.
function _finRowMatch(obj, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return Object.values(obj).some(v => v != null && typeof v !== 'object' && String(v).toLowerCase().includes(s));
}

// ── CSV export helpers (client-side Blob download; CSP-safe) ────────────
function _csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function _downloadCsv(filename, rows) {
  const csv = rows.map(r => r.map(_csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch (_) {} }, 0);
}
function financeExportCsv(kind) {
  const today = new Date().toISOString().slice(0, 10);
  if (kind === 'ap') {
    const rows = (_FIN.ap || []).filter(b => _finRowMatch(b, _FIN.apQ));
    const out = [['Bill', 'Vendor', 'Vendor ID', 'Date', 'Due', 'Total', 'Balance', 'Currency', 'Status', 'Aging']];
    for (const b of rows) out.push([b.number || b.id, b.vendor_name || '', b.vendor_id || '', b.date || '', b.due_date || '',
      ((b.total || 0) / 100).toFixed(2), ((b.balance || 0) / 100).toFixed(2), b.currency_code || 'INR', b.status || '', _AGING_LABEL[b.age_bucket] || b.age_bucket || '']);
    _downloadCsv('payables-' + today + '.csv', out);
    showToast('Exported ' + rows.length + ' bill' + (rows.length === 1 ? '' : 's') + ' to CSV', 'success');
  } else {
    const rows = (_FIN.ar || []).filter(i => _finRowMatch(i, _FIN.arQ));
    const out = [['Invoice', 'Client', 'Client ID', 'Date', 'Due', 'Total', 'Balance', 'Currency', 'Status', 'Aging']];
    for (const i of rows) out.push([i.number || i.id, i.client_name || '', i.client_id || '', i.date || '', i.due_date || '',
      ((i.total || 0) / 100).toFixed(2), ((i.balance || 0) / 100).toFixed(2), i.currency_code || 'INR', i.status || '', _AGING_LABEL[i.age_bucket] || i.age_bucket || '']);
    _downloadCsv('receivables-' + today + '.csv', out);
    showToast('Exported ' + rows.length + ' invoice' + (rows.length === 1 ? '' : 's') + ' to CSV', 'success');
  }
}

// Re-render whichever finance page is active (delegated 'financeRefresh' target).
function financeRefresh() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const fn = { my_statement: renderMyStatement, payables: renderPayables, reminders: renderReminders,
    reconciliation: renderReconciliation, finance_dashboard: renderFinanceDashboard, finance_setup: renderFinanceSetup }[APP.page] || renderReceivables;
  fn(main);
}

// One per-currency KPI + aging block. DSO carries a plain-language tooltip.
function _financeCurrencyBlock(c) {
  const kpi = (label, val, hint) => `
    <div class="card" style="flex:1;min-width:150px;padding:14px 16px"${hint ? ` title="${h(hint)}"` : ''}>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}${hint ? ' <span style="cursor:help">ⓘ</span>' : ''}</div>
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
        ${kpi('DSO (days)', String(c.dso), 'Days Sales Outstanding — the average number of days it takes to collect payment after a sale. Lower is better.')}
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

// Invoice rows table (shared by cockpit + statement). `showClient` adds a client
// column whose name is a click-to-drill button (finance/ops cockpit only).
function _financeInvoiceTable(invoices, showClient, sortKind, page) {
  if (!invoices.length) return `<div class="card" style="padding:20px;color:var(--muted)">No matching invoices.</div>`;
  const head = `
    <tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
      ${_sortableTh(sortKind, 'number', 'Invoice')}
      ${showClient ? _sortableTh(sortKind, 'client_name', 'Client') : ''}
      ${_sortableTh(sortKind, 'date', 'Date')}
      ${_sortableTh(sortKind, 'due_date', 'Due')}
      ${_sortableTh(sortKind, 'total', 'Total', true)}
      ${_sortableTh(sortKind, 'balance', 'Balance', true)}
      ${_sortableTh(sortKind, 'status', 'Status')}
      ${_sortableTh(sortKind, 'age_bucket', 'Aging')}
    </tr>`;
  const clientCell = inv => {
    const label = inv.client_name || inv.client_id || '';
    if (!inv.client_id) return `<td style="padding:8px 12px">${h(label)}</td>`;
    return `<td style="padding:8px 12px"><button ${dataAct('financeViewClient', inv.client_id)} title="View this customer's statement"
      style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(label)}</button></td>`;
  };
  // page>0 → paginated cockpit; else → statement (cap-with-note).
  const start = page ? (page - 1) * _FIN_RENDER_CAP : 0;
  const shown = page ? invoices.slice(start, start + _FIN_RENDER_CAP)
    : (invoices.length > _FIN_RENDER_CAP ? invoices.slice(0, _FIN_RENDER_CAP) : invoices);
  const rows = shown.map(inv => `
    <tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${h(inv.number || inv.id)}</td>
      ${showClient ? clientCell(inv) : ''}
      <td style="padding:8px 12px">${h(inv.date || '')}</td>
      <td style="padding:8px 12px;white-space:nowrap">${h(inv.effective_due_date || inv.due_date || '')}${_finDueBadge(inv.due_source)}</td>
      <td style="padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(inv.total, inv.currency_code))}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${h(_fmtPaise(inv.balance, inv.currency_code))}</td>
      <td style="padding:8px 12px">${_finStatusPill(inv.status)}</td>
      <td style="padding:8px 12px">${h(_AGING_LABEL[inv.age_bucket] || inv.age_bucket || '')}</td>
    </tr>`).join('');
  const footer = page ? _finPager('ar', page, invoices.length) : _finCapNote(invoices.length);
  return `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead>${head}</thead><tbody>${rows}</tbody></table>${footer}</div>`;
}

// Finance/ops cockpit: per-currency KPIs + aging + the searchable, exportable,
// drillable open-invoice list.
async function renderReceivables(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading receivables…</p></div>`;
  const period = _FIN.kpiPeriod || 90;
  const [summary, list, kpis] = await Promise.all([api('/finance/ar/summary'), api('/finance/ar/invoices'), api('/finance/kpis?period=' + period)]);
  if (!summary || !list) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load receivables.</div>`; return; }
  const byCur = summary.by_currency || [];
  _FIN.ar = list.invoices || []; _FIN.arPage = 1;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0">Receivables</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" ${dataAct('renderArCustomers')}>By customer ▸</button>
        <button class="btn btn-secondary" ${dataAct('financeRefresh')}>${svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>')} Refresh</button>
      </div>
    </div>
    ${_finSyncedLine(summary.last_sync_at)}
    ${_finStaleBanner(kpis && kpis.stale)}
    ${byCur.length ? byCur.map(_financeCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">No receivables data yet. If that's unexpected, an admin can turn on the Zoho Books sync under <strong>Finance Setup</strong>.</div>`}
    ${kpis ? _finKpiSection(kpis) : ''}
    <h3 style="margin:18px 0 10px">Open Invoices</h3>
    ${_finToolbar('ar', 'Search invoices by number, customer, status…', true)}
    <div id="ar-table-host">${_financeInvoiceTable(_finSortRows(_FIN.ar.filter(i => _finRowMatch(i, _FIN.arQ)), _FIN.arSort), true, 'ar', (_FIN.arPage || 1))}</div>`;
}
// Live filter for the receivables table (delegated data-input target).
function financeFilterAr(q) {
  _FIN.arQ = q || ''; _FIN.arPage = 1;
  _renderArTable();
}

// ── Customer-wise Receivables summary ──────────────────────────────────
function _custSortVal(r, col) {
  if (col === 'name') return String(r.name || r.client_id || '').toLowerCase();
  if (col === 'oldest_due') return String(r.oldest_due || '9999');
  return Number(r[col] || 0);
}
function _custView() {
  let rows = (_FIN.customers || []).filter(c => _finRowMatch(c, _FIN.custQ));
  const s = _FIN.custSort;
  if (s && s.col) {
    const dir = s.dir === 'desc' ? -1 : 1;
    rows = rows.slice().sort((a, b) => { const va = _custSortVal(a, s.col), vb = _custSortVal(b, s.col); return va < vb ? -dir : va > vb ? dir : 0; });
  }
  return rows;
}
function _custTable(rows, page) {
  if (!rows.length) return `<div class="card" style="padding:20px;color:var(--muted)">No customers with receivables.</div>`;
  const th = (col, label, r) => _sortableThKind('cust', col, label, r);
  const start = (page - 1) * _FIN_RENDER_CAP;
  const shown = rows.slice(start, start + _FIN_RENDER_CAP);
  const body = shown.map(c => {
    const nameBtn = c.client_id
      ? `<button ${dataAct('financeViewClient', c.client_id)} style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(c.name || c.client_id)}</button>`
      : h(c.name || '');
    const num = (v, bold, danger) => `<td style="padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums;${bold ? 'font-weight:700;' : ''}${danger && (v || 0) > 0 ? 'color:var(--danger,#b3261e)' : ''}">${h(_fmtPaise(v, c.currency_code))}</td>`;
    const credit = (c.credit_days && c.credit_days > 0) ? `${c.credit_days}d` : '30 (default)';
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${nameBtn}</td>
      <td style="padding:8px 12px;color:var(--muted);font-size:12px">${h(credit)}</td>
      ${num(c.due_today)}
      ${num(c.overdue, false, true)}
      ${num(c.total_due_now, true, true)}
      ${num(c.upcoming)}
      <td style="padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(c.outstanding, c.currency_code))}</td>
      <td style="padding:8px 12px;text-align:right">${(c.oldest_dpd || 0) > 0 ? `<span style="color:var(--danger,#b3261e);font-weight:600">${h(String(c.oldest_dpd))}d</span>` : '—'}</td>
      <td style="padding:8px 12px"><button class="btn btn-secondary btn-sm" ${dataAct('financeViewClient', c.client_id)}>Open ▸</button></td></tr>`;
  }).join('');
  return `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
      ${th('name', 'Customer')}<th style="padding:8px 12px">Credit</th>${th('due_today', 'Due today', true)}${th('overdue', 'Overdue', true)}
      ${th('total_due_now', 'Total due now', true)}${th('upcoming', 'Upcoming', true)}${th('outstanding', 'Outstanding', true)}${th('oldest_dpd', 'Oldest DPD', true)}<th></th></tr></thead>
    <tbody>${body}</tbody></table>${_finPager('cust', page, rows.length)}</div>`;
}
// A sort header that dispatches financeSort(kind,col) with a kind-specific arrow.
function _sortableThKind(kind, col, label, alignRight) {
  const cur = kind === 'cust' ? _FIN.custSort : null;
  const arrow = cur && cur.col === col ? (cur.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const style = `padding:8px 12px;${alignRight ? 'text-align:right' : 'text-align:left'}`;
  return `<th style="${style}"><button ${dataAct('financeSort', kind, col)} title="Sort by ${h(label)}" style="background:none;border:none;padding:0;font:inherit;font-weight:600;cursor:pointer;color:inherit">${h(label)}<span style="color:var(--blue,#1d6fa4)">${arrow}</span></button></th>`;
}
function _renderCustTable() {
  const host = document.getElementById('cust-table-host'); if (!host) return;
  const rows = _custView();
  const pages = Math.max(1, Math.ceil(rows.length / _FIN_RENDER_CAP));
  _FIN.custPage = Math.min(Math.max(1, _FIN.custPage || 1), pages);
  host.innerHTML = _custTable(rows, _FIN.custPage);
}
function financeFilterCust(q) { _FIN.custQ = q || ''; _FIN.custPage = 1; _renderCustTable(); }
// Stale-data banner: a snapshot older than the threshold blocks automated sends and
// means today's DPD/aging are computed off an old book. Shown across the dues cockpits.
function _finStaleBanner(stale) {
  if (!stale || !stale.stale) return '';
  const age = stale.age_days == null ? 'never synced' : `${stale.age_days} day${stale.age_days === 1 ? '' : 's'} old`;
  return `<div class="card" style="padding:12px 16px;margin-bottom:14px;border-left:4px solid var(--warning,#8a5a00);background:var(--warning-bg,#fff8e6)">
    ⚠ <strong>Data is ${h(age)}</strong> (threshold ${h(String(stale.threshold_days))}d). Figures may be out of date, and automated reminders are paused until a fresh Zoho sync. Run <strong>Sync now</strong> under Finance Setup.</div>`;
}
function financeSetAsOf(v) { _FIN.asOf = v || ''; renderArCustomers(); }
function financeSetKpiPeriod(n) { _FIN.kpiPeriod = parseInt(n, 10) || 90; const m = document.getElementById('main-content'); if (m) renderReceivables(m); }
// One KPI tile: value vs target, coloured by on/off-track (grey when n/a).
function _finKpiCard(label, value, suffix, ok, targetText) {
  const col = ok === null ? 'var(--muted)' : ok ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)';
  const val = (value === null || value === undefined) ? 'n/a' : (value + (suffix || ''));
  return `<div class="card" style="flex:1;min-width:150px;padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
    <div style="font-size:1.5rem;font-weight:700;margin-top:4px;color:${col}">${h(val)}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${ok === null ? '—' : (ok ? '✓ On track' : '✗ Off track')} · ${h(targetText)}</div></div>`;
}
function _finKpiSection(kpis) {
  const rows = kpis.by_currency || [];
  if (!rows.length) return '';
  const t = kpis.targets || {};
  const cur = kpis.period_days || 90;
  const periodBtns = [30, 60, 90, 365].map(n =>
    `<button ${dataAct('financeSetKpiPeriod', n)} style="padding:3px 10px;border:1px solid var(--border);border-radius:6px;font:inherit;cursor:pointer;background:${n === cur ? 'var(--blue,#1d6fa4)' : 'transparent'};color:${n === cur ? '#fff' : 'inherit'}">${n}d</button>`).join(' ');
  const blocks = rows.map(k => {
    const dsoOk = k.dso == null ? null : (k.dso <= t.dso);
    const ceiOk = k.cei == null ? null : (k.cei >= t.cei);
    const acpOk = k.acp == null ? null : (k.acp <= t.acp);
    const ovOk = (k.overdue_pct == null) ? null : (k.overdue_pct <= t.overdue_pct);
    return `<div style="margin-top:8px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${h(k.currency)} · AR ${h(_fmtPaise(k.ar, k.currency))} · credit sales (period) ${h(_fmtPaise(k.credit_sales, k.currency))}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${_finKpiCard('DSO', k.dso, 'd', dsoOk, 'target ≤ ' + t.dso + 'd')}
        ${_finKpiCard('CEI', k.cei, '%', ceiOk, 'target ≥ ' + t.cei + '%')}
        ${_finKpiCard('Avg collection', k.acp, 'd', acpOk, 'target ≤ ' + t.acp + 'd')}
        ${_finKpiCard('Overdue', k.overdue_pct, '%', ovOk, (k.overdue_count || 0) + ' inv · ≤ ' + t.overdue_pct + '%')}
      </div></div>`;
  }).join('');
  return `<div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 4px;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0">Collection KPIs</h3>
      <div style="display:flex;gap:4px;align-items:center"><span style="font-size:12px;color:var(--muted);margin-right:4px">Period</span>${periodBtns}</div>
    </div>${blocks}`;
}
async function renderArCustomers() {
  const main = document.getElementById('main-content'); if (!main) return;
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading customer summary…</p></div>`;
  const qs = _FIN.asOf ? ('?as_of=' + encodeURIComponent(_FIN.asOf)) : '';
  const data = await api('/finance/ar/by-customer' + qs);
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load customer summary.</div>`; return; }
  _FIN.customers = data.customers || []; _FIN.custPage = 1;
  const asOf = data.as_of || '';
  const withDue = _FIN.customers.filter(c => (c.total_due_now || 0) > 0).length;
  const dueToday = _FIN.customers.reduce((s, c) => s + (c.due_today || 0), 0);
  const totalDueNow = _FIN.customers.reduce((s, c) => s + (c.total_due_now || 0), 0);
  const upcoming = _FIN.customers.reduce((s, c) => s + (c.upcoming || 0), 0);
  const totalOut = _FIN.customers.reduce((s, c) => s + (c.outstanding || 0), 0);
  const kpi = (label, val, danger) => `<div class="card" style="flex:1;min-width:140px;padding:14px 16px">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}</div>
    <div style="font-size:1.4rem;font-weight:600;margin-top:4px;${danger ? 'color:var(--danger,#b3261e)' : ''}">${h(val)}</div></div>`;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">Client Dues</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="font-size:12px;color:var(--muted)">As of
          <input type="date" value="${h(asOf)}" ${dataInputVal('financeSetAsOf')} style="margin-left:6px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font:inherit"></label>
        <button class="btn btn-secondary" ${dataAct('financeExportCustomersCsv')}>Export CSV</button>
        <button class="btn btn-secondary" ${dataAct('financePrintCustomers')}>Print / PDF</button>
        <button class="btn btn-secondary" ${dataAct('financeRefresh')}>← Back to invoices</button>
      </div>
    </div>
    ${_finStaleBanner(data.stale)}
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${kpi('Clients with dues', String(withDue))}
      ${kpi('Due today', _fmtPaise(dueToday))}
      ${kpi('Total due now', _fmtPaise(totalDueNow), true)}
      ${kpi('Upcoming 7 days', _fmtPaise(upcoming))}
      ${kpi('Total outstanding', _fmtPaise(totalOut))}
    </div>
    ${_finToolbar('cust', 'Search customers…', false)}
    <div id="cust-table-host">${_custTable(_custView(), _FIN.custPage)}</div>`;
}
function financeExportCustomersCsv() {
  const rows = _custView();
  const out = [['Customer', 'Client ID', 'Currency', 'Credit days', 'Due today', 'Overdue', 'Total due now', 'Upcoming 7d', 'Outstanding', 'Oldest DPD', 'Open invoices']];
  for (const c of rows) out.push([c.name || '', c.client_id || '', c.currency_code || 'INR', String(c.credit_days || ''),
    ((c.due_today || 0) / 100).toFixed(2), ((c.overdue || 0) / 100).toFixed(2), ((c.total_due_now || 0) / 100).toFixed(2),
    ((c.upcoming || 0) / 100).toFixed(2), ((c.outstanding || 0) / 100).toFixed(2), String(c.oldest_dpd || 0), String(c.open_invoices || 0)]);
  _downloadCsv('client-dues-' + (_FIN.asOf || new Date().toISOString().slice(0, 10)) + '.csv', out);
  showToast('Exported ' + rows.length + ' customer' + (rows.length === 1 ? '' : 's') + ' to CSV', 'success');
}
function financePrintCustomers() {
  const rows = _custView();
  const cell = v => `<td class="n">${h(_fmtPaise(v))}</td>`;
  const body = rows.map(c => `<tr><td>${h(c.name || c.client_id || '')}</td>${cell(c.due_today)}${cell(c.overdue)}${cell(c.total_due_now)}${cell(c.upcoming)}${cell(c.outstanding)}<td class="n">${h(String(c.oldest_dpd || 0))}d</td></tr>`).join('');
  financePrint('Client Dues' + (_FIN.asOf ? ' — as of ' + _FIN.asOf : ''), `<table><thead><tr><th>Customer</th><th class="n">Due today</th><th class="n">Overdue</th><th class="n">Total due now</th><th class="n">Upcoming</th><th class="n">Outstanding</th><th class="n">Oldest DPD</th></tr></thead><tbody>${body}</tbody></table>`);
}

// Drill-in: a finance/ops user views any one customer's full statement.
async function financeViewClient(clientId) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading statement…</p></div>`;
  const data = await api('/finance/ar/client/' + encodeURIComponent(clientId));
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load statement.</div>`; return; }
  const name = (_FIN.customers.find(c => c.client_id === clientId) || {}).name
    || (_FIN.ar.find(i => i.client_id === clientId) || {}).client_name || clientId;
  const byCur = data.by_currency || [];
  const invoices = data.invoices || [];
  const open = invoices.filter(i => (i.balance || 0) > 0);
  const paid = invoices.filter(i => (i.balance || 0) <= 0);
  APP._finStmt = { clientId, name };
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>← Back to Receivables</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" ${dataAct('financeEmailStatement', clientId)}>✉ Email statement</button>
        <button class="btn btn-secondary" ${dataAct('financePrintStatement')}>Print / PDF</button>
        <button class="btn btn-secondary" ${dataAct('financeViewClient', clientId)}>Refresh</button>
      </div>
    </div>
    <h2 style="margin:0 0 12px">${h(name)} — Statement</h2>
    ${byCur.length ? byCur.map(_financeCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">Nothing outstanding for this customer.</div>`}
    <h3 style="margin:18px 0 10px">Open invoices (${open.length})</h3>
    ${_financeInvoiceTable(open, false)}
    <h3 style="margin:22px 0 10px;color:var(--muted)">Paid / settled (${paid.length})</h3>
    ${paid.length ? _financeInvoiceTable(paid, false) : `<div class="card" style="padding:16px;color:var(--muted)">No settled invoices on record.</div>`}`;
}
// Email the currently-open customer's statement (explicit collector action).
async function financeEmailStatement(clientId) {
  if (!confirm('Email this customer their statement of outstanding invoices now?')) return;
  const r = await api('/finance/ar/client/' + encodeURIComponent(clientId) + '/email-statement', { method: 'POST', body: JSON.stringify({}) });
  if (r && r.ok) showToast('Statement emailed to ' + r.to, 'success');
  else if (r) showToast('Could not email: ' + (r.error || 'unknown error'), 'error');
}
// Print the on-screen statement (the open-invoice table) as PDF.
function financePrintStatement() {
  const st = APP._finStmt || {};
  const host = document.getElementById('main-content');
  const table = host ? host.querySelector('table') : null;
  financePrint((st.name || 'Customer') + ' — Statement', table ? `<table>${table.innerHTML}</table>` : '<p>No invoices to print.</p>');
}

// ── Payables (finance/ops): per-vendor aging + DPO + bills due ─────────
function _apCurrencyBlock(c) {
  const kpi = (label, val, hint) => `<div class="card" style="flex:1;min-width:150px;padding:14px 16px"${hint ? ` title="${h(hint)}"` : ''}>
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${h(label)}${hint ? ' <span style="cursor:help">ⓘ</span>' : ''}</div>
    <div style="font-size:1.4rem;font-weight:600;margin-top:4px">${h(val)}</div></div>`;
  const buckets = ['current', '1-30', '31-60', '61-90', '91+'];
  return `<section style="margin-bottom:24px">
    <h3 style="margin:0 0 10px">${h(c.currency)}</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      ${kpi('Total Payable', _fmtPaise(c.outstanding, c.currency))}
      ${kpi('Overdue', _fmtPaise(c.overdue, c.currency))}
      ${kpi('Due This Week', _fmtPaise(c.due_this_week, c.currency))}
      ${kpi('DPO (days)', String(c.dpo), 'Days Payable Outstanding — the average number of days you take to pay suppliers after a bill is raised. Higher preserves cash, but paying past the due date risks the relationship.')}</div>
    <div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5)">${buckets.map(b => `<th style="padding:8px 12px;text-align:right;font-weight:600">${h(_AGING_LABEL[b])}</th>`).join('')}</tr></thead>
      <tbody><tr>${buckets.map(b => `<td style="padding:8px 12px;text-align:right">${h(_fmtPaise(c.buckets[b] || 0, c.currency))}</td>`).join('')}</tr></tbody>
    </table></div></section>`;
}
// Open-bills table (shared by cockpit filter re-render). Vendor name drills in.
function _apBillTable(bills, page) {
  if (!bills.length) return `<div class="card" style="padding:20px;color:var(--muted)">No matching bills.</div>`;
  const vendorCell = b => {
    const label = b.vendor_name || b.vendor_id || '';
    if (!b.vendor_id) return `<td style="padding:8px 12px">${h(label)}</td>`;
    return `<td style="padding:8px 12px"><button ${dataAct('financeViewVendor', b.vendor_id)} title="View this vendor's statement"
      style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(label)}</button></td>`;
  };
  const start = page ? (page - 1) * _FIN_RENDER_CAP : 0;
  const shown = page ? bills.slice(start, start + _FIN_RENDER_CAP)
    : (bills.length > _FIN_RENDER_CAP ? bills.slice(0, _FIN_RENDER_CAP) : bills);
  const rows = shown.map(b => {
    const overdue = b.age_bucket && b.age_bucket !== 'current' && (b.balance || 0) > 0;
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${h(b.number || b.id)}</td>
      ${vendorCell(b)}
      <td style="padding:8px 12px">${h(b.date || '')}</td>
      <td style="padding:8px 12px;white-space:nowrap">${h(b.effective_due_date || b.due_date || '')}${_finDueBadge(b.due_source)}${overdue ? ' <span style="color:var(--danger,#b3261e)">⚠ pay before due</span>' : ''}</td>
      <td style="padding:8px 12px;text-align:right;font-variant-numeric:tabular-nums">${h(_fmtPaise(b.total, b.currency_code))}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${h(_fmtPaise(b.balance, b.currency_code))}</td>
      <td style="padding:8px 12px">${_finStatusPill(b.status)}</td>
      <td style="padding:8px 12px">${h(_AGING_LABEL[b.age_bucket] || b.age_bucket || '')}</td></tr>`;
  }).join('');
  const footer = page ? _finPager('ap', page, bills.length) : _finCapNote(bills.length);
  return `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
      ${_sortableTh('ap', 'number', 'Bill')}${_sortableTh('ap', 'vendor_name', 'Vendor')}${_sortableTh('ap', 'date', 'Date')}${_sortableTh('ap', 'due_date', 'Due')}
      ${_sortableTh('ap', 'total', 'Total', true)}${_sortableTh('ap', 'balance', 'Balance', true)}
      ${_sortableTh('ap', 'status', 'Status')}${_sortableTh('ap', 'age_bucket', 'Aging')}</tr></thead>
    <tbody>${rows}</tbody></table>${footer}</div>`;
}
async function renderPayables(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading payables…</p></div>`;
  const [summary, list] = await Promise.all([api('/finance/ap/summary'), api('/finance/ap/bills')]);
  if (!summary || !list) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load payables.</div>`; return; }
  const byCur = summary.by_currency || [];
  _FIN.ap = list.bills || []; _FIN.apPage = 1;
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <h2 style="margin:0">Payables</h2>
      <button class="btn btn-secondary" ${dataAct('financeRefresh')}>Refresh</button></div>
    ${_finSyncedLine(summary.last_sync_at)}
    ${byCur.length ? byCur.map(_apCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">No payables data yet. If that's unexpected, an admin can turn on the Zoho Books sync under <strong>Finance Setup</strong>.</div>`}
    <h3 style="margin:18px 0 10px">Open Bills</h3>
    ${_finToolbar('ap', 'Search bills by number, vendor, status…', true)}
    <div id="ap-table-host">${_apBillTable(_finSortRows(_FIN.ap.filter(b => _finRowMatch(b, _FIN.apQ)), _FIN.apSort), (_FIN.apPage || 1))}</div>`;
}
function financeFilterAp(q) {
  _FIN.apQ = q || ''; _FIN.apPage = 1;
  _renderApTable();
}
// Drill-in: any one vendor's full statement (finance/ops only).
async function financeViewVendor(vendorId) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading vendor statement…</p></div>`;
  const data = await api('/finance/ap/vendor/' + encodeURIComponent(vendorId));
  if (!data) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load vendor statement.</div>`; return; }
  const name = (_FIN.ap.find(b => b.vendor_id === vendorId) || {}).vendor_name || vendorId;
  const byCur = data.by_currency || [];
  const bills = data.bills || [];
  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div><button class="btn btn-secondary" ${dataAct('financeRefresh')}>← Back to Payables</button></div>
      <button class="btn btn-secondary" ${dataAct('financeViewVendor', vendorId)}>Refresh</button>
    </div>
    <h2 style="margin:0 0 12px">${h(name)} — Statement</h2>
    ${byCur.length ? byCur.map(_apCurrencyBlock).join('') : `<div class="card" style="padding:20px;color:var(--muted)">Nothing outstanding for this vendor.</div>`}
    <h3 style="margin:18px 0 10px">Open Bills</h3>
    ${_apBillTable(bills)}`;
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

// ── Finance Setup (super admin): guided go-live control panel ──────────
// Designed for non-technical staff: status chips, plain-language mode choices,
// and buttons disabled with a reason until each safety step is done.
function _chip(ok, label) {
  const c = ok ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)';
  return `<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:${c}"><span style="width:9px;height:9px;border-radius:50%;background:${c};display:inline-block"></span>${h(label)}</span>`;
}
async function renderFinanceSetup(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading finance setup…</p></div>`;
  const s = await api('/finance/status');
  if (!s) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load finance setup.</div>`; return; }
  const modeBtn = (val, title, desc) => {
    const active = s.reminders_mode === val;
    const liveLocked = val === 'live' && (!s.backfill_complete || !s.had_dry_run);
    const why = liveLocked ? (!s.backfill_complete ? 'Run a full Books sync first' : 'Do a Dry run first') : '';
    return `<button class="btn ${active ? 'btn-primary' : 'btn-secondary'}" style="flex:1;min-width:150px;flex-direction:column;align-items:flex-start;padding:12px 14px;text-align:left;${liveLocked ? 'opacity:.5;cursor:not-allowed' : ''}"
      ${liveLocked ? `disabled title="${h(why)}"` : dataAct('financeSetReminderMode', val)}>
      <span style="font-weight:600">${h(title)}${active ? ' ✓' : ''}</span>
      <span style="font-size:12px;color:var(--muted);font-weight:400;margin-top:2px">${h(desc)}${liveLocked ? ' — ' + h(why) : ''}</span></button>`;
  };
  main.innerHTML = `
    <h2 style="margin:0 0 4px">Finance Setup</h2>
    <p style="color:var(--muted);margin:0 0 18px">Turn on the Zoho Books sync and payment-reminder emails. Follow the steps top to bottom.</p>

    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:10px">Connections</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div>${_chip(s.zoho.configured, s.zoho.configured ? 'Zoho Books connected' : 'Zoho Books not connected')}${s.zoho.configured ? '' : `<div style="font-size:12px;color:var(--muted);margin-top:2px">Ask IT to add: ${h((s.zoho.missing || []).join(', '))}</div>`}</div>
        <div>${_chip(s.gmail.configured, s.gmail.configured ? 'Email sending connected (Gmail)' : 'Email sending not connected')}${s.gmail.configured ? '' : `<div style="font-size:12px;color:var(--muted);margin-top:2px">Ask IT to add: ${h((s.gmail.missing || []).join(', '))}</div>`}</div>
      </div>
    </div>

    <div class="card" style="padding:16px;margin-bottom:16px">
      <div style="font-weight:600;margin-bottom:6px">Step 1 · Sync invoices &amp; bills from Zoho Books</div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 12px">Pulls invoices, bills, payments and credit notes from Zoho Books into SmartPantry. Safe to run repeatedly — it only reads from Books.</p>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn ${s.books_sync_enabled ? 'btn-primary' : 'btn-secondary'}" ${dataAct('financeToggleBooksSync', !s.books_sync_enabled)}>${s.books_sync_enabled ? 'Sync is ON — turn off' : 'Turn sync ON'}</button>
        <button class="btn btn-secondary" ${s.books_sync_enabled && s.zoho.configured ? dataAct('financeRunBooksSync') : 'disabled'} title="${s.books_sync_enabled && s.zoho.configured ? 'Runs a full sync now (may take a few minutes)' : 'Turn sync on and connect Zoho first'}">Run full sync now</button>
        <button class="btn btn-secondary" ${s.books_sync_enabled && s.zoho.configured ? dataAct('financeResyncAll') : 'disabled'} title="Rebuild everything from Books — re-pulls every invoice/bill and refreshes paid/due status. Use if paid documents still show as due.">Rebuild from Books</button>
        <span style="font-size:13px;color:var(--muted)">Synced: <strong>${h(String(s.counts.invoices))}</strong> invoices · <strong>${h(String(s.counts.bills))}</strong> bills · <strong>${h(String(s.counts.customers))}</strong> customers · Backfill ${s.backfill_complete ? '<strong style="color:var(--success,#2e6e12)">complete</strong>' : 'pending'}</span>
      </div>
      <div id="fin-sync-progress" style="font-size:12px;color:var(--blue,#1d6fa4);margin-top:8px"></div>
      <div style="font-size:12px;color:var(--muted);margin-top:8px">Last synced: <strong>${h(_finAgo(s.last_sync_at))}</strong></div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Zoho login: <strong>${s.zoho_token_source === 'connect' ? 'in-app Connect token' : s.zoho_token_source === 'secret' ? 'Worker secret (ZOHO_REFRESH_TOKEN)' : 'not set'}</strong>
        · <button class="btn btn-secondary btn-sm" ${dataAct('financeConnectZoho')} title="Paste a Zoho authorization code to mint a fresh token with this app's own credentials">Connect Zoho…</button>
        · <button class="btn btn-secondary btn-sm" ${dataAct('financeTestZoho')} title="Check the Zoho connection step by step (token refresh, then a Books read)">Test connection</button>${s.zoho_token_source === 'connect' ? ` · <button class="btn btn-secondary btn-sm" ${dataAct('financeZohoUseSecret')} title="Clear the stored Connect token so the ZOHO_REFRESH_TOKEN secret is used instead">Use Worker secret instead</button>` : ''}</div>
      <div id="fin-zoho-test" style="margin-top:8px"></div>
      ${s.last_sync_error ? `<div style="margin-top:12px;padding:12px 14px;border:1px solid var(--danger,#b3261e);background:var(--danger-bg,#fdecea);border-radius:8px">
        <div style="font-weight:700;color:var(--danger,#b3261e);font-size:13px;margin-bottom:4px">⚠ Last sync failed</div>
        ${s.last_sync_hint ? `<div style="font-size:13px;margin-bottom:6px">${h(s.last_sync_hint)}</div>` : ''}
        <div style="font-size:11px;color:var(--muted);font-family:monospace;word-break:break-word">${h(s.last_sync_error)}</div>
      </div>` : ''}
    </div>

    <div class="card" style="padding:16px">
      <div style="font-weight:600;margin-bottom:6px">Step 2 · Payment-reminder emails</div>
      <p style="font-size:13px;color:var(--muted);margin:0 0 12px">Choose how reminders behave. Always try <strong>Dry run</strong> first and review the results before going Live.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${modeBtn('off', 'Off', 'No emails are sent at all.')}
        ${modeBtn('dry_run', 'Dry run', 'Prepares statements and logs them — sends nothing.')}
        ${modeBtn('live', 'Live', 'Really emails customers (pre-due & on-due automatically).')}
      </div>
      <p style="font-size:12px;color:var(--muted);margin:12px 0 0">Overdue follow-ups are never automatic — a person sends them from the <a href="#reminders" style="color:var(--blue,#1d6fa4)">Payment Reminders</a> worklist.</p>
    </div>`;
}
async function financeToggleBooksSync(on) {
  const r = await api('/finance/settings', { method: 'POST', body: JSON.stringify({ books_sync_enabled: !!on }) });
  if (r) { showToast('Books sync ' + (on ? 'enabled' : 'disabled'), 'info'); renderFinanceSetup(document.getElementById('main-content')); }
}
// Full rebuild: reset the backfill server-side, then run it. Corrects rows synced
// before the balance-mirror fix (paid documents that still show as due).
async function financeResyncAll() {
  if (!confirm('Rebuild all finance data from Zoho Books?\n\nThis re-pulls every invoice and bill and refreshes their paid/due status. It only reads from Books, and runs in the background — leave the page open until it finishes.')) return;
  const r = await api('/finance/books/resync', { method: 'POST', body: JSON.stringify({}) });
  if (!r) return;
  showToast('Rebuild started — pulling everything from Books…', 'info');
  await financeRunBooksSync();
}
async function financeRunBooksSync() {
  showToast('Syncing from Zoho Books…', 'info');
  const prog = document.getElementById('fin-sync-progress');
  const totals = {};
  // The initial backfill is chunked server-side; keep calling until it reports
  // complete (or a normal delta returns 'ok'). Each call is one bounded run.
  for (let i = 0; i < 200; i++) {
    const r = await api('/integrations/zoho-books/sync', { method: 'POST', body: JSON.stringify({ full: true }) });
    if (!r) { break; }
    if (r.status === 'disabled') { showToast('Turn the sync ON first.', 'error'); break; }
    if (r.status === 'not_configured') { showToast('Zoho Books is not connected yet — ask IT to finish the connection.', 'error'); break; }
    if (r.status === 'error') { showToast('Sync failed: ' + (r.hint || (r.errors && r.errors[0]) || 'error') + ' — see the details below.', 'error'); break; }
    for (const [k, v] of Object.entries(r.entity_counts || {})) totals[k] = (totals[k] || 0) + v;
    if (r.backfill_complete || (r.status === 'ok' && !('entity_counts' in r))) {
      showToast('Sync complete.', 'success'); break;
    }
    // in_progress → show running totals and continue
    if (prog) prog.textContent = 'Backfilling… ' + Object.entries(totals).map(([k, v]) => `${k}: ${v}`).join(' · ');
  }
  renderFinanceSetup(document.getElementById('main-content'));
}
// Paste a Zoho authorization code → exchanged server-side with THIS app's own
// client id/secret + region, so the resulting refresh token can never mismatch
// (the invalid_code trap). Use a code scoped for BOTH Books and Inventory.
async function financeTestZoho() {
  const box = document.getElementById('fin-zoho-test');
  if (box) box.innerHTML = '<span style="font-size:12px;color:var(--muted)">Testing…</span>';
  const r = await api('/finance/zoho/test');
  if (!r) { if (box) box.innerHTML = ''; return; }
  const row = (ok, label, detail) => `<div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-top:3px">
    <span style="color:${ok ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">${ok ? '✓' : '✗'}</span>
    <span>${h(label)}${detail ? ' — <span style="color:var(--muted)">' + h(detail) + '</span>' : ''}</span></div>`;
  const parts = [];
  parts.push(row(true, `Using ${r.token_source === 'connect' ? 'in-app Connect token' : r.token_source === 'secret' ? 'Worker secret' : 'no token'} · region ${r.dc} · Books org id ${r.books_org_id_present ? 'set' : 'MISSING'}`, ''));
  parts.push(row(!!r.token_ok, 'Token refresh', r.token_ok ? 'ok' : ('failed: ' + (r.token_error || '?'))));
  if (r.token_ok) parts.push(row(!!r.books_ok, 'Books read', r.books_ok ? 'ok' : ('HTTP ' + (r.books_status || '?') + ' ' + (r.books_error || ''))));
  const allOk = r.token_ok && r.books_ok;
  if (box) box.innerHTML = `<div style="padding:10px 12px;border:1px solid ${allOk ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'};border-radius:8px;background:var(--surface-2,#f8fafc)">
    <div style="font-weight:700;font-size:12px;margin-bottom:2px;color:${allOk ? 'var(--success,#2e6e12)' : 'var(--danger,#b3261e)'}">${allOk ? 'Connection OK — you can run the sync' : 'Connection problem'}</div>${parts.join('')}</div>`;
}
function financeConnectZoho() {
  openModal('Connect Zoho (for Books + Inventory)',
    `<div style="font-size:.85rem;line-height:1.5;color:var(--text-muted);margin-bottom:12px">
       <ol style="margin:0 0 0 18px;padding:0">
         <li>Open your Zoho API console: <code>api-console.zoho.&lt;your region&gt;</code> (e.g. <code>.in</code> or <code>.com</code>) → your <b>Self Client</b>.</li>
         <li><b>Generate Code</b> with scope:<br><code style="user-select:all">ZohoBooks.fullaccess.all,ZohoInventory.fullaccess.all</code></li>
         <li>Pick a short duration, copy the code, and paste it below <b>immediately</b> (it expires in ~10 minutes).</li>
       </ol>
       <div style="margin-top:8px">The code is exchanged using this app's own ZOHO_CLIENT_ID/SECRET and ZOHO_DC, so it always matches.</div>
     </div>
     <input id="fin-zoho-code" type="text" placeholder="Paste authorization code (1000.xxxx…)" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font:inherit">`,
    `<button class="btn btn-secondary" ${dataAct('closeModal')}>Cancel</button>
     <button class="btn btn-primary" ${dataAct('financeConnectZohoSubmit')}>Connect</button>`);
}
async function financeConnectZohoSubmit() {
  const code = (document.getElementById('fin-zoho-code').value || '').trim();
  if (!code) { showToast('Paste the authorization code first', 'error'); return; }
  const r = await api('/integrations/zoho-inventory/connect', { method: 'POST', body: JSON.stringify({ code }) });
  if (r && r.ok) { closeModal(); showToast('Zoho connected — now click Run full sync now.', 'success'); renderFinanceSetup(document.getElementById('main-content')); }
  else showToast('Connect failed: ' + ((r && r.error) || 'unknown error') + (r && r.dc ? ' (region ' + r.dc + ')' : ''), 'error');
}
async function financeZohoUseSecret() {
  if (!confirm('Switch Zoho to the Worker ZOHO_REFRESH_TOKEN secret?\n\nUse this if you re-minted the token with Books scope. The stored in-app Connect token will be cleared and the Worker secret used instead.')) return;
  const r = await api('/finance/zoho/use-secret', { method: 'POST', body: JSON.stringify({}) });
  if (r) { showToast('Now using the Worker ZOHO_REFRESH_TOKEN — run the full sync again.', 'success'); renderFinanceSetup(document.getElementById('main-content')); }
}
async function financeSetReminderMode(mode) {
  if (mode === 'live' && !confirm('Go LIVE? Real reminder emails will start going to customers.')) return;
  const r = await api('/finance/settings', { method: 'POST', body: JSON.stringify({ reminders_mode: mode }) });
  if (r) { showToast('Reminder mode: ' + mode, mode === 'live' ? 'success' : 'info'); renderFinanceSetup(document.getElementById('main-content')); }
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
  // Top lists: click a name to drill into that party's statement.
  const drill = (idKey, id) => idKey === 'client_id' ? dataAct('financeViewClient', id) : dataAct('financeViewVendor', id);
  const list = (title, rows, idKey) => `<div class="card" style="flex:1;min-width:260px;padding:0;overflow-x:auto">
    <div style="padding:10px 14px;font-weight:600;border-bottom:1px solid var(--border)">${h(title)}</div>
    ${(rows || []).length ? `<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${rows.map(r => {
      const id = r[idKey]; const label = r.name || id || '';
      const nameCell = id
        ? `<button ${drill(idKey, id)} title="View statement" style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(label)}</button>`
        : h(label);
      return `<tr style="border-top:1px solid var(--border)"><td style="padding:8px 12px">${nameCell}</td><td style="padding:8px 12px;text-align:right">${h(_fmtPaise(r.bal, r.currency_code))}</td></tr>`;
    }).join('')}</tbody></table>` : `<div style="padding:16px;color:var(--muted)">None</div>`}
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
function _followupTable(followups) {
  if (!followups.length) return `<div class="card" style="padding:20px;color:var(--muted)">No matching customers awaiting a follow-up.</div>`;
  const rows = followups.map(f => {
    const amt = Object.entries(f.total_outstanding || {}).map(([c, v]) => _fmtPaise(v, c)).join(', ');
    const status = f.opt_out ? 'Opted out' : f.hold ? ('Hold: ' + f.hold) : !f.email ? 'No email'
      : f.eligible ? 'Eligible' : ('Eligible in ' + f.eligible_in_days + 'd');
    const btn = f.eligible
      ? `<button class="btn btn-primary" ${dataAct('financeSendFollowup', f.client_id)}>Send follow-up</button>`
      : `<button class="btn btn-secondary" disabled title="${h(status)}">Send follow-up</button>`;
    const nameCell = f.client_id
      ? `<button ${dataAct('financeViewClient', f.client_id)} title="View this customer's statement" style="background:none;border:none;padding:0;font:inherit;color:var(--blue,#1d6fa4);cursor:pointer;text-decoration:underline">${h(f.name || f.client_id)}</button>`
      : h(f.name || f.client_id);
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:8px 12px">${nameCell}</td>
      <td style="padding:8px 12px">${h(f.tier)}</td>
      <td style="padding:8px 12px;text-align:right">${h(String(f.worst_overdue_days))}</td>
      <td style="padding:8px 12px;text-align:right">${h(amt)}</td>
      <td style="padding:8px 12px">${h(status)}</td>
      <td style="padding:8px 12px">${btn}</td></tr>`;
  }).join('');
  return `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
      <th style="padding:8px 12px">Client</th><th style="padding:8px 12px">Tier</th>
      <th style="padding:8px 12px;text-align:right">Overdue (d)</th><th style="padding:8px 12px;text-align:right">Outstanding</th>
      <th style="padding:8px 12px">Status</th><th style="padding:8px 12px"></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}
async function renderReminders(main) {
  main.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading reminders…</p></div>`;
  const [rules, due, runs] = await Promise.all([
    api('/finance/reminders/rules'), api('/finance/reminders/followups-due'), api('/finance/reminders/runs')]);
  if (!rules || !due || !runs) { main.innerHTML = `<div class="card" style="padding:20px">Unable to load reminders.</div>`; return; }
  const mode = rules.mode || 'off';
  _FIN.followups = due.followups || [];
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
    <h3 style="margin:0 0 10px">Follow-ups Due (${_FIN.followups.length})</h3>
    ${_FIN.followups.length ? _finToolbar('followups', 'Search customers by name, tier, status…', false) : ''}
    <div id="followup-table-host">${_FIN.followups.length ? _followupTable(_FIN.followups.filter(f => _finRowMatch(f, _FIN.foQ))) : `<div class="card" style="padding:20px;color:var(--muted)">No overdue customers awaiting a follow-up.</div>`}</div>
    <h3 style="margin:18px 0 10px">Recent Runs</h3>
    ${runRows ? `<div class="card" style="padding:0;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:var(--bg-subtle,#f5f5f5);text-align:left">
        <th style="padding:6px 12px">When</th><th style="padding:6px 12px">Client</th><th style="padding:6px 12px">Tier</th>
        <th style="padding:6px 12px">Status</th><th style="padding:6px 12px">By</th></tr></thead>
      <tbody>${runRows}</tbody></table></div>`
      : `<div class="card" style="padding:20px;color:var(--muted)">No reminder runs yet.</div>`}`;
}
function financeFilterFollowups(q) {
  _FIN.foQ = q || '';
  const host = document.getElementById('followup-table-host');
  if (host) host.innerHTML = _followupTable(_FIN.followups.filter(f => _finRowMatch(f, _FIN.foQ)));
}

// Collector action: send an overdue follow-up (server enforces gap + holds).
async function financeSendFollowup(clientId) {
  // Show the clerk what will go out (tier + amount in the subject, invoice count) before sending.
  const p = await api('/finance/reminders/preview?client_id=' + encodeURIComponent(clientId));
  if (!p) return;
  if (p.nothing_due) { showToast('Nothing is currently due for this customer.', 'info'); renderReminders(document.getElementById('main-content')); return; }
  const n = (p.invoice_ids || []).length;
  if (!confirm(`Send this reminder now?\n\n${p.subject || ''}\n\nCovers ${n} open invoice${n === 1 ? '' : 's'}.`)) return;
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
