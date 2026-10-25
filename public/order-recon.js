// Admin order-view helpers — pure logic for line status, delivery reconciliation
// totals, the cancel-reason guard, and list-state round-trip.
//
// Single source of truth for the admin full-page order view / quick-view drawer
// (app.04) and the unit tests (test/order_recon.test.ts). Authored as an ES
// module so vitest can import it; also attached to `window` for the classic
// app scripts to call at render time.

// Per-line delivery status. Rule: delivered >= ordered → full;
// 0 < delivered < ordered → partial; delivered == 0 → pending.
export function olineStatus(ordered, delivered) {
  const o = Number(ordered) || 0, d = Number(delivered) || 0;
  if (d <= 0) return 'pending';
  if (d >= o) return 'full';
  return 'partial';
}

// Reconciliation totals across all lines (each {ordered, delivered}).
//   Ordered   = line count / sum(ordered)
//   Delivered = count(full) / sum(delivered)
//   Due       = count(partial+pending) / sum(max(ordered-delivered, 0))
// Percentages are relative to Ordered, items and qty separately, rounded,
// divide-by-zero guarded.
export function oreconTotals(lines) {
  const rows = lines || [];
  let ordQty = 0, delQty = 0, dueQty = 0, delItems = 0, dueItems = 0;
  for (const l of rows) {
    const o = Number(l.ordered) || 0, d = Number(l.delivered) || 0;
    ordQty += o; delQty += d; dueQty += Math.max(0, o - d);
    const st = olineStatus(o, d);
    if (st === 'full') delItems++; else dueItems++; // partial + pending both "due"
  }
  const ordItems = rows.length;
  const pct = (n, dnm) => dnm > 0 ? Math.round(n / dnm * 100) : 0;
  return {
    ordItems, ordQty,
    delItems, delQty,
    dueItems, dueQty,
    pctDelItems: pct(delItems, ordItems), pctDelQty: pct(delQty, ordQty),
    pctDueItems: pct(dueItems, ordItems), pctDueQty: pct(dueQty, ordQty),
  };
}

// Cancel-reason guard for the admin cancel dialog. A reason is required and must
// be one of the allowed options.
export const CANCEL_REASONS = ['Client requested', 'Out of stock', 'Duplicate order', 'Other'];
export function validateCancelReason(reason) {
  const r = (reason == null ? '' : String(reason)).trim();
  if (!r) return { ok: false, error: 'Choose a reason for cancelling.' };
  if (CANCEL_REASONS.indexOf(r) === -1) return { ok: false, error: 'Choose a valid reason.' };
  return { ok: true };
}

// List-state round-trip: the Order Queue keeps its filters/search/month/scroll
// in the app store so Back from an order restores them. These snapshot and
// re-apply that state losslessly.
const LIST_KEYS = ['_oqBucket', '_oqStatusTab', '_oqMonth', '_oqClient', '_oqTypeFilter', '_oqTab', '_oqScroll'];
export function snapshotListState(src) {
  const s = {};
  for (const k of LIST_KEYS) s[k] = src ? src[k] : undefined;
  return s;
}
export function applyListState(dst, snap) {
  if (!dst || !snap) return dst;
  for (const k of LIST_KEYS) if (k in snap) dst[k] = snap[k];
  return dst;
}

if (typeof window !== 'undefined') {
  window.olineStatus = olineStatus;
  window.oreconTotals = oreconTotals;
  window.validateCancelReason = validateCancelReason;
  window.CANCEL_REASONS = CANCEL_REASONS;
  window.snapshotListState = snapshotListState;
  window.applyListState = applyListState;
}
