// Client order detail — pure helpers for the 4-step client stepper, the single
// headline status, and the pre-filled ticket payload. Reconciliation + line
// status are reused from order-recon.js so the client and admin views never
// diverge; client-facing labels are applied at render time.
//
// ES module so vitest can import it; also attached to `window` for the classic
// app scripts to call at render time.
import { olineStatus, oreconTotals } from "./order-recon.js";

export { olineStatus, oreconTotals };

// Client-facing line-status labels (map order-recon's full/partial/pending).
export const CLIENT_LINE_LABEL = { full: "Fully delivered", partial: "Partly delivered", pending: "Awaiting delivery" };

// 4-step client stepper state, derived from line/delivery data (never the raw
// workflow stage). Steps: Submitted | Approved | In Shipment | Delivered.
//   o: { approved, cancelled, orderedQty, deliveredQty, outForDelivery, scheduled,
//        submittedDate, approvedDate, deliveredDate }
// outForDelivery / scheduled come from the order's live challans, so the "In
// Shipment" sub-label matches the headline and the Deliveries list exactly.
export function clientSteps(o) {
  const ord = Number(o.orderedQty) || 0, del = Number(o.deliveredQty) || 0;
  const full = ord > 0 && del >= ord;
  const pct = ord > 0 ? Math.round(del / ord * 100) : 0;
  // "shipped" = the order has reached the out-for-delivery phase (a challan is in
  // transit, or something has already been delivered). Being prepared / scheduled
  // still sit at the Approved stage, so the current stage always matches the
  // single status headline and never reads two different phases at once.
  const shipped = del > 0 || !!o.outForDelivery;
  const labels = ["Submitted", "Approved", "Out for delivery", "Delivered"];
  const states = [
    "done",                                                         // Submitted
    !o.approved ? "cur" : (shipped ? "done" : "cur"),               // Approved (cur while preparing/scheduled)
    !o.approved ? "" : (full || del > 0 ? "done" : o.outForDelivery ? "cur" : ""), // Out for delivery
    full ? "done" : (del > 0 ? "cur" : ""),                         // Delivered
  ];
  const approvedSub = !o.approved ? "Under review"
    : shipped ? (o.approvedDate || "")
    : o.scheduled ? "Scheduled for delivery"
    : "Being prepared";
  const subs = [
    o.submittedDate || "",
    approvedSub,
    "",                                                             // the stage label is self-describing
    full ? (o.deliveredDate || "") : (del > 0 ? `${pct}% received` : ""),
  ];
  return { labels, states, subs };
}

// The single headline status + one supporting sentence + colour + recon badge.
//   o: { approved, cancelled, orderedQty, deliveredQty, outForDelivery, scheduled,
//        totalItems, fullItems, dueItems, dueUnits }
export function clientHeadline(o) {
  const ord = Number(o.orderedQty) || 0, del = Number(o.deliveredQty) || 0;
  const full = ord > 0 && del >= ord;
  if (o.cancelled) return { status: "Cancelled", detail: "This order was cancelled.", color: "grey", badge: "Cancelled" };
  if (!o.approved) return { status: "Awaiting approval", detail: "We've received your order and it's being reviewed.", color: "grey", badge: "Not Delivered" };
  if (del <= 0) {
    if (o.outForDelivery) return { status: "Out for delivery", detail: "Your order has been dispatched and is on its way.", color: "blue", badge: "Out for delivery" };
    if (o.scheduled)      return { status: "Scheduled for delivery", detail: "A delivery has been scheduled for your order.", color: "grey", badge: "Scheduled" };
    return { status: "Approved · being prepared", detail: "Your order is approved and our team is preparing it for shipment.", color: "grey", badge: "Not Delivered" };
  }
  if (!full) {
    const pq = ord > 0 ? Math.round(del / ord * 100) : 0;
    return {
      status: `Partially delivered · ${pq}% of units received`,
      detail: `${o.fullItems} of ${o.totalItems} items are complete. The remaining ${o.dueItems} items (${Number(o.dueUnits || 0).toLocaleString("en-IN")} units) will follow.`,
      color: "amber", badge: "Partially Delivered",
    };
  }
  return { status: "Delivered · all items received", detail: `All ${o.totalItems} items (${ord.toLocaleString("en-IN")} units) have been delivered.`, color: "green", badge: "Delivered" };
}

// Pre-filled ticket payload for the "Need help" buttons. kind: 'support' | 'issue'.
export function ticketPrefill(order, kind) {
  const ref = (order && (order.order_reference || order.id)) || "";
  const isIssue = kind === "issue";
  return {
    order_id: order ? order.id : null,
    order_reference: order ? (order.order_reference || null) : null,
    client_id: order ? (order.client_id || null) : null,
    subject: `Order ${ref}: ${isIssue ? "Issue report" : "Support request"}`,
    category: isIssue ? "Issue" : null,
  };
}

if (typeof window !== "undefined") {
  window.clientSteps = clientSteps;
  window.clientHeadline = clientHeadline;
  window.ticketPrefill = ticketPrefill;
  window.CLIENT_LINE_LABEL = CLIENT_LINE_LABEL;
}
