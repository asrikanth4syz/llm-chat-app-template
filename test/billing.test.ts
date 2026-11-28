import { describe, it, expect } from "vitest";
import {
  periodsForMonth, periodContaining, periodsBetween, daysInMonth,
  addDays, invoiceTargetDate, submissionTargetDate, deriveSubmission,
  isOverdue, invoiceVariance,
} from "../src/billing";

describe("period generation", () => {
  it("Monthly → one period spanning the whole month", () => {
    const p = periodsForMonth("Monthly", 2026, 11);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ key: "2026-11-M", label: "Nov 2026", start: "2026-11-01", end: "2026-11-30" });
  });
  it("Fortnightly → 1–15 and 16–month-end", () => {
    const p = periodsForMonth("Fortnightly", 2026, 11);
    expect(p.map((x) => x.key)).toEqual(["2026-11-F1", "2026-11-F2"]);
    expect(p[0]).toMatchObject({ start: "2026-11-01", end: "2026-11-15", label: "1–15 Nov 2026" });
    expect(p[1]).toMatchObject({ start: "2026-11-16", end: "2026-11-30", label: "16–30 Nov 2026" });
  });
  it("Fortnightly adapts the second window to month length (Feb non-leap = 28)", () => {
    const p = periodsForMonth("Fortnightly", 2027, 2);
    expect(p[1]).toMatchObject({ start: "2027-02-16", end: "2027-02-28" });
  });
  it("Weekly → 7-day windows anchored to the 1st, last runs to month end", () => {
    const p = periodsForMonth("Weekly", 2026, 11); // 30 days → 5 windows
    expect(p.map((x) => [x.start, x.end])).toEqual([
      ["2026-11-01", "2026-11-07"], ["2026-11-08", "2026-11-14"],
      ["2026-11-15", "2026-11-21"], ["2026-11-22", "2026-11-28"],
      ["2026-11-29", "2026-11-30"],
    ]);
    expect(p[4].key).toBe("2026-11-W5");
  });
  it("daysInMonth handles leap February", () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2027, 2)).toBe(28);
  });
});

describe("periodContaining", () => {
  it("Fortnightly: a date in the second half resolves to F2", () => {
    expect(periodContaining("Fortnightly", "2026-11-20").key).toBe("2026-11-F2");
    expect(periodContaining("Fortnightly", "2026-11-03").key).toBe("2026-11-F1");
  });
  it("Weekly: a date resolves to its 7-day window", () => {
    expect(periodContaining("Weekly", "2026-11-23").key).toBe("2026-11-W4");
  });
});

describe("periodsBetween — idempotent seeding across months", () => {
  it("spans the inclusive month range", () => {
    const p = periodsBetween("Monthly", "2026-10-15", "2027-01-05");
    expect(p.map((x) => x.key)).toEqual(["2026-10-M", "2026-11-M", "2026-12-M", "2027-01-M"]);
  });
  it("keys are unique so re-seeding can INSERT OR IGNORE safely", () => {
    const keys = periodsBetween("Fortnightly", "2026-11-01", "2026-12-31").map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("target dates", () => {
  it("adds calendar days across a month boundary", () => {
    expect(addDays("2026-11-30", 2)).toBe("2026-12-02");
    expect(invoiceTargetDate("2026-11-30", 2)).toBe("2026-12-02");
    expect(submissionTargetDate("2026-11-30", 5)).toBe("2026-12-05");
  });
  it("a zero/negative offset clamps to the period end", () => {
    expect(invoiceTargetDate("2026-11-30", 0)).toBe("2026-11-30");
    expect(invoiceTargetDate("2026-11-30", -3)).toBe("2026-11-30");
  });
});

describe("deriveSubmission", () => {
  const req = { email: true, portal: true, hardcopy: false };
  it("a draft (not recorded) is always Not Ready", () => {
    expect(deriveSubmission(false, req, {})).toEqual({ status: "Not Ready", submittedDate: null });
  });
  it("recorded, nothing done yet → Ready", () => {
    expect(deriveSubmission(true, req, {})).toEqual({ status: "Ready", submittedDate: null });
  });
  it("some but not all required channels done → Partially Submitted", () => {
    expect(deriveSubmission(true, req, { email: "2026-12-02" })).toEqual({ status: "Partially Submitted", submittedDate: null });
  });
  it("all required channels done → Submitted, date is the latest", () => {
    expect(deriveSubmission(true, req, { email: "2026-12-02", portal: "2026-12-04" }))
      .toEqual({ status: "Submitted", submittedDate: "2026-12-04" });
  });
  it("hardcopy not required is ignored even if blank", () => {
    expect(deriveSubmission(true, { email: true, portal: false, hardcopy: false }, { email: "2026-12-02" }))
      .toEqual({ status: "Submitted", submittedDate: "2026-12-02" });
  });
  it("no channels required → Submitted only when a manual submitted date is entered", () => {
    expect(deriveSubmission(true, { email: false, portal: false, hardcopy: false }, {}).status).toBe("Ready");
    expect(deriveSubmission(true, { email: false, portal: false, hardcopy: false }, { submitted: "2026-12-03" }))
      .toEqual({ status: "Submitted", submittedDate: "2026-12-03" });
  });
});

describe("isOverdue + variance", () => {
  it("overdue only when target is past and milestone incomplete", () => {
    expect(isOverdue("2026-11-20", false, "2026-11-27")).toBe(true);
    expect(isOverdue("2026-11-20", true, "2026-11-27")).toBe(false);  // done
    expect(isOverdue("2026-12-05", false, "2026-11-27")).toBe(false); // future
    expect(isOverdue(null, false, "2026-11-27")).toBe(false);
  });
  it("invoiceVariance is the absolute 2dp difference", () => {
    expect(invoiceVariance(1000.00, 1000.00)).toBe(0);
    expect(invoiceVariance(1000.50, 1000.00)).toBe(0.5);
    expect(invoiceVariance(999.99, 1000.00)).toBe(0.01);
  });
});
