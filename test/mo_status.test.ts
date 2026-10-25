// Unit tests for the client "My Orders" data helper (public/mo-status.js):
// the mutually-exclusive status rules, the late flag, progress %, and the
// summary totals — including the invariant that the four status counts sum to All.
import { describe, it, expect } from "vitest";
import { moClassify, moSummarize } from "../public/mo-status.js";

const TODAY = "2026-10-25";

describe("moClassify — status rules (evaluated in order)", () => {
  it("delivered when delivered_units >= ordered_units", () => {
    expect(moClassify({ ordered_units: 10, delivered_units: 10, dispatched: true }, TODAY).status).toBe("delivered");
    expect(moClassify({ ordered_units: 10, delivered_units: 12, dispatched: true }, TODAY).status).toBe("delivered");
  });
  it("partial when 0 < delivered_units < ordered_units", () => {
    expect(moClassify({ ordered_units: 10, delivered_units: 4, dispatched: true }, TODAY).status).toBe("partial");
  });
  it("transit when nothing delivered but dispatched", () => {
    expect(moClassify({ ordered_units: 10, delivered_units: 0, dispatched: true }, TODAY).status).toBe("transit");
  });
  it("active otherwise (and for zero-unit orders)", () => {
    expect(moClassify({ ordered_units: 10, delivered_units: 0, dispatched: false }, TODAY).status).toBe("active");
    expect(moClassify({ ordered_units: 0, delivered_units: 0, dispatched: false }, TODAY).status).toBe("active");
  });
  it("late = promised_date < today AND status != delivered", () => {
    expect(moClassify({ ordered_units: 10, delivered_units: 0, dispatched: true, promised_date: "2026-10-01" }, TODAY).late).toBe(true);
    // delivered is never late, even if the promised date has passed
    expect(moClassify({ ordered_units: 10, delivered_units: 10, dispatched: true, promised_date: "2026-10-01" }, TODAY).late).toBe(false);
    // future promise is not late
    expect(moClassify({ ordered_units: 10, delivered_units: 0, dispatched: true, promised_date: "2026-12-01" }, TODAY).late).toBe(false);
  });
  it("progress % is rounded and divide-by-zero guarded", () => {
    expect(moClassify({ ordered_units: 8, delivered_units: 2 }, TODAY).pct).toBe(25);
    expect(moClassify({ ordered_units: 3, delivered_units: 1 }, TODAY).pct).toBe(33);
    expect(moClassify({ ordered_units: 0, delivered_units: 0 }, TODAY).pct).toBe(0);
  });
});

describe("moSummarize — totals and the sum invariant", () => {
  const orders = [
    { id: "A", ordered_units: 10, delivered_units: 10, dispatched: true,  order_value: 1000 }, // delivered
    { id: "B", ordered_units: 10, delivered_units: 4,  dispatched: true,  order_value: 2000, promised_date: "2026-10-01" }, // partial + late
    { id: "C", ordered_units: 10, delivered_units: 0,  dispatched: true,  order_value: 3000 }, // transit
    { id: "D", ordered_units: 10, delivered_units: 0,  dispatched: false, order_value: 4000 }, // active
    { id: "E", ordered_units: 5,  delivered_units: 5,  dispatched: true,  order_value: 500  }, // delivered
  ];
  const s = moSummarize(orders, TODAY);

  it("counts each status correctly", () => {
    expect(s.counts).toEqual({ all: 5, active: 1, transit: 1, partial: 1, delivered: 2 });
  });
  it("the four statuses sum to All", () => {
    expect(s.counts.active + s.counts.transit + s.counts.partial + s.counts.delivered).toBe(s.counts.all);
  });
  it("open value = sum(value) where status != delivered", () => {
    expect(s.openValue).toBe(2000 + 3000 + 4000); // B + C + D
  });
  it("billed value = sum(value) where status == delivered", () => {
    expect(s.billedValue).toBe(1000 + 500); // A + E
  });
  it("counts overdue non-delivered orders", () => {
    expect(s.lateCount).toBe(1); // only B
  });
  it("handles an empty list", () => {
    const e = moSummarize([], TODAY);
    expect(e.counts).toEqual({ all: 0, active: 0, transit: 0, partial: 0, delivered: 0 });
    expect(e.openValue).toBe(0);
    expect(e.billedValue).toBe(0);
  });
});
