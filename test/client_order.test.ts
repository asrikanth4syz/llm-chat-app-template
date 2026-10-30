// Unit tests for the client order-detail helpers (public/client-order.js):
// (a) reconciliation totals + line status rules, (b) the 4-step client stepper
// state across not-approved / approved / partial / delivered, and (e) the
// pre-filled ticket payload the help buttons use.
import { describe, it, expect } from "vitest";
import { olineStatus, oreconTotals, clientSteps, clientHeadline, ticketPrefill } from "../public/client-order.js";

describe("(a) reconciliation totals + line status", () => {
  it("line status rules", () => {
    expect(olineStatus(10, 10)).toBe("full");
    expect(olineStatus(10, 4)).toBe("partial");
    expect(olineStatus(10, 0)).toBe("pending");
  });
  it("totals, percentages relative to Ordered, items+qty sum to Ordered", () => {
    const lines = [
      { ordered: 10, delivered: 10 }, // full
      { ordered: 10, delivered: 4 },  // partial
      { ordered: 6, delivered: 0 },   // pending
    ];
    const r = oreconTotals(lines);
    expect(r.ordItems).toBe(3);
    expect(r.ordQty).toBe(26);
    expect(r.delItems).toBe(1);
    expect(r.delQty).toBe(14);
    expect(r.dueItems).toBe(2);
    expect(r.dueQty).toBe(12); // 0 + 6 + 6
    expect(r.delItems + r.dueItems).toBe(r.ordItems);
    expect(r.pctDelQty).toBe(54); // 14/26
  });
  it("guards divide-by-zero", () => {
    expect(oreconTotals([]).pctDelQty).toBe(0);
  });
});

describe("(b) client stepper state", () => {
  const base = { submittedDate: "15 Oct", approvedDate: "15 Oct", deliveredDate: "24 Oct" };
  it("not approved: Submitted done, Approved active (Under review)", () => {
    const s = clientSteps({ ...base, approved: false, orderedQty: 46, deliveredQty: 0 });
    expect(s.states).toEqual(["done", "cur", "", ""]);
    expect(s.subs[1]).toBe("Under review");
  });
  it("approved, nothing delivered: In Shipment active, 'Being prepared'", () => {
    const s = clientSteps({ ...base, approved: true, orderedQty: 46, deliveredQty: 0 });
    expect(s.states).toEqual(["done", "done", "cur", ""]);
    expect(s.subs[2]).toBe("Being prepared");
  });
  it("partial: In Shipment active with '<pct>% delivered'", () => {
    const s = clientSteps({ ...base, approved: true, orderedQty: 27033, deliveredQty: 19633 });
    expect(s.states).toEqual(["done", "done", "cur", ""]);
    expect(s.subs[2]).toBe("73% delivered");
  });
  it("delivered: all four done", () => {
    const s = clientSteps({ ...base, approved: true, orderedQty: 46, deliveredQty: 46 });
    expect(s.states).toEqual(["done", "done", "done", "done"]);
  });
  it("out for delivery: stepper sub + headline agree (no 'being prepared')", () => {
    const s = clientSteps({ ...base, approved: true, orderedQty: 46, deliveredQty: 0, outForDelivery: true });
    expect(s.states).toEqual(["done", "done", "cur", ""]);
    expect(s.subs[2]).toBe("Out for delivery");
    const h = clientHeadline({ approved: true, orderedQty: 46, deliveredQty: 0, outForDelivery: true });
    expect(h.status).toBe("Out for delivery");
    expect(h.badge).toBe("Out for delivery");
  });
  it("delivery scheduled (not yet out): 'Scheduled for delivery' everywhere", () => {
    const s = clientSteps({ ...base, approved: true, orderedQty: 46, deliveredQty: 0, scheduled: true });
    expect(s.subs[2]).toBe("Scheduled for delivery");
    expect(clientHeadline({ approved: true, orderedQty: 46, deliveredQty: 0, scheduled: true }).status).toBe("Scheduled for delivery");
  });
  it("out-for-delivery takes precedence over scheduled", () => {
    expect(clientHeadline({ approved: true, orderedQty: 46, deliveredQty: 0, outForDelivery: true, scheduled: true }).status).toBe("Out for delivery");
  });

  it("headline reflects each state", () => {
    expect(clientHeadline({ approved: false, orderedQty: 46, deliveredQty: 0 }).status).toBe("Awaiting approval");
    expect(clientHeadline({ approved: true, orderedQty: 46, deliveredQty: 0 }).status).toBe("Approved · being prepared");
    const partial = clientHeadline({ approved: true, orderedQty: 27033, deliveredQty: 19633, totalItems: 46, fullItems: 25, dueItems: 21, dueUnits: 7400 });
    expect(partial.status).toBe("Partially delivered · 73% of units received");
    expect(partial.detail).toContain("25 of 46 items");
    expect(partial.badge).toBe("Partially Delivered");
    expect(clientHeadline({ approved: true, orderedQty: 46, deliveredQty: 46, totalItems: 46 }).status).toBe("Delivered · all items received");
    expect(clientHeadline({ cancelled: true }).status).toBe("Cancelled");
  });
});

describe("(e) help buttons pre-fill the ticket with the order", () => {
  const order = { id: "SP-2610-4155", order_reference: "PO-99", client_id: "c1" };
  it("Contact support", () => {
    const p = ticketPrefill(order, "support");
    expect(p.order_id).toBe("SP-2610-4155");
    expect(p.client_id).toBe("c1");
    expect(p.subject).toBe("Order PO-99: Support request");
    expect(p.category).toBeNull();
  });
  it("Report an issue pre-selects the Issue category", () => {
    const p = ticketPrefill(order, "issue");
    expect(p.subject).toBe("Order PO-99: Issue report");
    expect(p.category).toBe("Issue");
  });
  it("falls back to order id when no reference", () => {
    expect(ticketPrefill({ id: "SP-1" }, "support").subject).toBe("Order SP-1: Support request");
  });
});
