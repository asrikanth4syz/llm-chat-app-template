// Unit tests for the admin order-view helpers (public/order-recon.js):
// (a) line status + reconciliation totals, (b) list-state round-trip that makes
// Back restore the queue's filters, (c) the cancel-reason guard.
import { describe, it, expect } from "vitest";
import {
  olineStatus, oreconTotals, validateCancelReason, CANCEL_REASONS,
  snapshotListState, applyListState,
} from "../public/order-recon.js";

describe("(a) line status + reconciliation totals", () => {
  it("line status: full / partial / pending", () => {
    expect(olineStatus(10, 10)).toBe("full");
    expect(olineStatus(10, 12)).toBe("full");   // over-delivery still full
    expect(olineStatus(10, 4)).toBe("partial");
    expect(olineStatus(10, 0)).toBe("pending");
  });

  it("reconciliation totals + percentages relative to Ordered", () => {
    const lines = [
      { ordered: 10, delivered: 10 }, // full
      { ordered: 10, delivered: 4 },  // partial
      { ordered: 10, delivered: 0 },  // pending
      { ordered: 20, delivered: 20 }, // full
    ];
    const r = oreconTotals(lines);
    expect(r.ordItems).toBe(4);
    expect(r.ordQty).toBe(50);
    expect(r.delItems).toBe(2);           // two full
    expect(r.delQty).toBe(34);            // 10+4+0+20
    expect(r.dueItems).toBe(2);           // partial + pending
    expect(r.dueQty).toBe(16);            // max(ordered-delivered,0): 0+6+10+0
    expect(r.pctDelItems).toBe(50);       // 2/4
    expect(r.pctDelQty).toBe(68);         // 34/50
    expect(r.pctDueItems).toBe(50);       // 2/4
    expect(r.pctDueQty).toBe(32);         // 16/50
    // delivered items + due items always equal ordered items
    expect(r.delItems + r.dueItems).toBe(r.ordItems);
  });

  it("guards divide-by-zero on an empty order", () => {
    const r = oreconTotals([]);
    expect(r).toMatchObject({ ordItems: 0, ordQty: 0, pctDelItems: 0, pctDelQty: 0, pctDueItems: 0, pctDueQty: 0 });
  });
});

describe("(b) Back restores the list's filters (state round-trip)", () => {
  it("snapshot then re-apply restores every filter field", () => {
    const app: Record<string, unknown> = {
      _oqBucket: "overdue", _oqStatusTab: "phase:fulfilment", _oqMonth: "2026-10",
      _oqClient: "LinkedIn", _oqTypeFilter: "Urgent", _oqTab: "orders", _oqScroll: 640,
      _unrelated: "keep-me",
    };
    const snap = snapshotListState(app);
    // User navigates into an order, state mutates…
    app._oqBucket = null; app._oqStatusTab = "All"; app._oqMonth = ""; app._oqClient = "";
    app._oqTypeFilter = null; app._oqTab = "items"; app._oqScroll = 0;
    // …Back restores it.
    applyListState(app, snap);
    expect(app._oqBucket).toBe("overdue");
    expect(app._oqStatusTab).toBe("phase:fulfilment");
    expect(app._oqMonth).toBe("2026-10");
    expect(app._oqClient).toBe("LinkedIn");
    expect(app._oqTypeFilter).toBe("Urgent");
    expect(app._oqTab).toBe("orders");
    expect(app._oqScroll).toBe(640);
    expect(app._unrelated).toBe("keep-me"); // untouched
  });
});

describe("(c) Cancel requires a reason", () => {
  it("rejects an empty / missing reason", () => {
    expect(validateCancelReason("").ok).toBe(false);
    expect(validateCancelReason("   ").ok).toBe(false);
    expect(validateCancelReason(null).ok).toBe(false);
    expect(validateCancelReason(undefined).ok).toBe(false);
  });
  it("rejects a reason not in the allowed list", () => {
    expect(validateCancelReason("because").ok).toBe(false);
  });
  it("accepts each allowed reason", () => {
    for (const r of CANCEL_REASONS) expect(validateCancelReason(r).ok).toBe(true);
  });
});
