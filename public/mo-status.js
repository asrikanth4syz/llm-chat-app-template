// Client "My Orders" data helper — pure status classification + totals.
//
// Single source of truth for the My Orders page (app.04) and the unit test
// (test/mo_status.test.ts). Authored as an ES module so vitest can import it
// directly; it also attaches its functions to `window` so the classic app
// scripts can call them at render time.

// Resolve the canonical fields from an order row, tolerating either the spec
// field names or our existing API names (handleListOrders).
export function moFields(o) {
  const ordered = Number(o.ordered_units != null ? o.ordered_units : o.total_qty) || 0;
  const delivered = Number(o.delivered_units != null ? o.delivered_units : o.delivered_qty) || 0;
  const dispatched = (o.dispatched != null)
    ? !!o.dispatched
    : (['IN_SHIPMENT', 'PARTIALLY_CLOSED', 'CLOSED', 'DELIVERED'].indexOf(o.status) !== -1
       || delivered > 0 || Number(o.active_dc_count) > 0);
  const value = Number(o.order_value != null ? o.order_value : o.grand_total) || 0;
  const promised = o.promised_date || o.predicted_delivery_date || o.need_by_date || null;
  return { ordered, delivered, dispatched, value, promised };
}

// Mutually exclusive status, evaluated in this order:
//   1. delivered: delivered_units >= ordered_units  (guarded: ordered must be > 0)
//   2. partial:   0 < delivered_units < ordered_units
//   3. transit:   delivered_units == 0 AND dispatched
//   4. active:    everything else
// Late = promised_date < today AND status != delivered.
export function moClassify(o, todayStr) {
  const f = moFields(o);
  let status;
  if (f.ordered > 0 && f.delivered >= f.ordered) status = 'delivered';
  else if (f.delivered > 0 && f.delivered < f.ordered) status = 'partial';
  else if (f.delivered === 0 && f.dispatched) status = 'transit';
  else status = 'active';
  const today = todayStr || new Date().toISOString().slice(0, 10);
  const late = !!f.promised && f.promised < today && status !== 'delivered';
  // Progress %: round(delivered / ordered * 100), divide-by-zero guarded.
  const pct = f.ordered > 0 ? Math.round(f.delivered / f.ordered * 100) : 0;
  return { status, late, pct, ordered: f.ordered, delivered: f.delivered, value: f.value, promised: f.promised };
}

// Aggregate chip counts + spend across a list. The four status counts always
// sum to counts.all by construction (each order lands in exactly one bucket).
//   Open value   = sum(value) where status != delivered
//   Billed value = sum(value) where status == delivered
export function moSummarize(orders, todayStr) {
  const counts = { all: 0, active: 0, transit: 0, partial: 0, delivered: 0 };
  let openValue = 0, billedValue = 0, lateCount = 0;
  const rows = (orders || []).map((o) => {
    const c = moClassify(o, todayStr);
    counts.all++; counts[c.status]++;
    if (c.status === 'delivered') billedValue += c.value; else openValue += c.value;
    if (c.late) lateCount++;
    return Object.assign({}, o, { _mo: c });
  });
  return { rows, counts, openValue, billedValue, lateCount };
}

// Expose to the classic (non-module) app scripts, which call these at render time.
if (typeof window !== 'undefined') {
  window.moFields = moFields;
  window.moClassify = moClassify;
  window.moSummarize = moSummarize;
}
