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
export const CLIENT_LINE_LABEL = { full: "Fully delivered", partial: "In progress", pending: "Awaiting dispatch" };

// 4-step client stepper state, derived from line/delivery data (never the raw
// workflow stage). Steps: Submitted | Approved | In Shipment | Delivered.
//   o: { approved, cancelled, orderedQty, deliveredQty,
//        submittedDate, approvedDate, deliveredDate }
export function clientSteps(o) {
  const ord = Number(o.orderedQty) || 0, del = Number(o.deliveredQty) || 0;
  const full = ord > 0 && del >= ord;
  const pct = ord > 0 ? Math.round(del / ord * 100) : 0;
  const labels = ["Submitted", "Approved", "In Shipment", "Delivered"];
  const states = [
    "done",                                        // Submitted — always done
    o.approved ? "done" : "cur",                   // Approved
    !o.approved ? "" : (full ? "done" : "cur"),    // In Shipment
    full ? "done" : "",                            // Delivered
  ];
  const subs = [
    o.submittedDate || "",
    o.approved ? (o.approvedDate || "") : "Under review",
    !o.approved ? "" : (del <= 0 ? "Being prepared" : full ? (o.deliveredDate || "") : `${pct}% delivered`),
    full ? (o.deliveredDate || "") : "",
  ];
  return { labels, states, subs };
}

// The single headline status + one supporting sentence + colour + recon badge.
//   o: { approved, cancelled, orderedQty, deliveredQty,
//        totalItems, fullItems, dueItems, dueUnits }
export function clientHeadline(o) {
  const ord = Number(o.orderedQty) || 0, del = Number(o.deliveredQty) || 0;
  const full = ord > 0 && del >= ord;
  if (o.cancelled) return { status: "Cancelled", detail: "This order was cancelled.", color: "grey", badge: "Cancelled" };
  if (!o.approved) return { status: "Awaiting approval", detail: "We've received your order and it's being reviewed.", color: "grey", badge: "Not Delivered" };
  if (del <= 0) return { status: "Approved · being prepared", detail: "Your order is approved and our team is preparing it for shipment.", color: "grey", badge: "Not Delivered" };
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
