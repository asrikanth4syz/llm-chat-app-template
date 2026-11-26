import { describe, it, expect } from "vitest";
import {
  periodWindow, nextPeriodStart, floorMinimum, validateBudgetAmount, changeDelta,
  decideRevisionStatus, poBalance, poUsedPct, summarizeLedger, evaluateOrderWarnings,
} from "../src/budget_po";

describe("periodWindow — calendar FY (Jan–Dec)", () => {
  it("monthly", () => {
    expect(periodWindow("Monthly", "2026-11-26")).toMatchObject({ start: "2026-11-01", end: "2026-11-30", label: "Nov 2026" });
  });
  it("quarters follow the calendar year", () => {
    expect(periodWindow("Quarterly", "2026-11-26").label).toBe("Q4 2026 (Oct–Dec)");
    expect(periodWindow("Quarterly", "2026-04-02")).toMatchObject({ start: "2026-04-01", end: "2026-06-30", label: "Q2 2026 (Apr–Jun)" });
    expect(periodWindow("Quarterly", "2026-01-15").label).toBe("Q1 2026 (Jan–Mar)");
  });
  it("yearly is the calendar year", () => {
    expect(periodWindow("Yearly", "2026-11-26")).toMatchObject({ start: "2026-01-01", end: "2026-12-31", label: "FY 2026" });
  });
  it("nextPeriodStart rolls to the next month/quarter/year", () => {
    expect(nextPeriodStart("Monthly", "2026-11-26")).toBe("2026-12-01");
    expect(nextPeriodStart("Quarterly", "2026-11-26")).toBe("2027-01-01");
    expect(nextPeriodStart("Yearly", "2026-11-26")).toBe("2027-01-01");
  });
});

describe("floor rule", () => {
  it("floor = committed + actual", () => {
    expect(floorMinimum(20000, 92000)).toBe(112000);
  });
  it("rejects a budget below the floor with the expected message", () => {
    const r = validateBudgetAmount(100000, 20000, 92000);
    expect(r.ok).toBe(false);
    expect(r.floor).toBe(112000);
    expect(r.error).toContain("Minimum allowed is ₹1,12,000");
  });
  it("accepts a budget at or above the floor", () => {
    expect(validateBudgetAmount(112000, 20000, 92000).ok).toBe(true);
    expect(validateBudgetAmount(180000, 20000, 92000).ok).toBe(true);
  });
});

describe("changeDelta", () => {
  it("computes delta and percent vs the old amount", () => {
    expect(changeDelta(150000, 180000)).toEqual({ delta: 30000, pct: 20 });
    expect(changeDelta(0, 150000)).toEqual({ delta: 150000, pct: 100 });
  });
});

describe("decideRevisionStatus", () => {
  const base = { oldAmount: 150000, newAmount: 180000, effectiveKind: "now" as const };
  it("applies immediately when approval is off", () => {
    expect(decideRevisionStatus(base)).toBe("applied");
  });
  it("effective-from-next-period is always pending", () => {
    expect(decideRevisionStatus({ ...base, effectiveKind: "next" })).toBe("pending");
  });
  it("pending when approval is active and the change meets the threshold", () => {
    expect(decideRevisionStatus({ ...base, approvalEnabled: true, approver: "Anita", thresholdPct: 20 })).toBe("pending");
    expect(decideRevisionStatus({ ...base, approvalEnabled: true, approver: "Anita", thresholdPct: 15 })).toBe("pending");
  });
  it("applies when the change is under the threshold", () => {
    expect(decideRevisionStatus({ oldAmount: 150000, newAmount: 160000, effectiveKind: "now", approvalEnabled: true, approver: "Anita", thresholdPct: 20 })).toBe("applied");
  });
  it("applies when approval is enabled but no approver is nominated", () => {
    expect(decideRevisionStatus({ ...base, approvalEnabled: true, approver: null, thresholdPct: 10 })).toBe("applied");
  });
});

describe("PO balance + ledger", () => {
  it("balance = amount − committed − actual", () => {
    expect(poBalance({ amount: 500000, committed: 20000, actual: 252000 })).toBe(228000);
    expect(poUsedPct({ amount: 500000, committed: 20000, actual: 252000 })).toBe(54);
  });
  it("ledger: commit raises committed; actual moves committed→actual; release lowers committed", () => {
    expect(summarizeLedger([{ type: "commit", amount: 100 }])).toEqual({ committed: 100, actual: 0 });
    expect(summarizeLedger([{ type: "commit", amount: 100 }, { type: "actual", amount: 60 }])).toEqual({ committed: 40, actual: 60 });
    expect(summarizeLedger([{ type: "commit", amount: 100 }, { type: "release", amount: 40 }])).toEqual({ committed: 60, actual: 0 });
    expect(summarizeLedger([{ type: "commit", amount: 100 }, { type: "actual", amount: 100 }])).toEqual({ committed: 0, actual: 100 });
  });
});

describe("evaluateOrderWarnings — warn only", () => {
  const po = { no: "PO-26-0142", from: "2026-10-01", to: "2026-12-31", scope: ["Tea", "Coffee"], amount: 500000, committed: 20000, actual: 252000 };
  it("no warnings when within balance, validity, scope and budget", () => {
    expect(evaluateOrderWarnings({ value: 10000, category: "Tea", today: "2026-11-26", po, budgetRemaining: 50000 })).toEqual([]);
  });
  it("warns when the order exceeds the PO balance", () => {
    const w = evaluateOrderWarnings({ value: 300000, category: "Tea", today: "2026-11-26", po, budgetRemaining: 999999 });
    expect(w.some((x) => /exceeds PO balance by ₹72,000/.test(x))).toBe(true);
  });
  it("warns when the PO is expired and when the category is out of scope", () => {
    const w = evaluateOrderWarnings({ value: 100, category: "Milk", today: "2027-01-02", po, budgetRemaining: 999999 });
    expect(w.some((x) => /has expired/.test(x))).toBe(true);
    expect(w.some((x) => /out of this PO's scope/.test(x))).toBe(true);
  });
  it("warns when the order exceeds the remaining budget", () => {
    const w = evaluateOrderWarnings({ value: 60000, category: "Tea", today: "2026-11-26", po, budgetRemaining: 50000 });
    expect(w.some((x) => /exceeds remaining budget by ₹10,000/.test(x))).toBe(true);
  });
  it("no PO supplied → only budget is checked", () => {
    expect(evaluateOrderWarnings({ value: 100, budgetRemaining: 50 })).toEqual(["Order exceeds remaining budget by ₹50."]);
  });
});
