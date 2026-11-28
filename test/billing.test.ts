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

import { cyclesBetween, cycleContaining, addBusinessDays, deadlineFrom, BILLING_LIFECYCLE, BILLING_FREQUENCY_LABELS } from "../src/billing";

describe("cyclesBetween — rule-driven generation", () => {
  it("Monthly (no cut-off) → calendar month", () => {
    const c = cyclesBetween("Monthly", {}, "2026-11-01", "2026-11-30");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ start: "2026-11-01", end: "2026-11-30" });
  });
  it("Monthly with a cut-off day → window from day-after-prev-cutoff to this cut-off", () => {
    const c = cyclesBetween("Monthly", { cutoffDay: 25 }, "2026-11-01", "2026-11-30");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ start: "2026-10-26", end: "2026-11-25" });
  });
  it("Fortnightly → the two halves of the month", () => {
    const c = cyclesBetween("Fortnightly", {}, "2026-11-01", "2026-11-30");
    expect(c.map((x) => [x.start, x.end])).toEqual([["2026-11-01", "2026-11-15"], ["2026-11-16", "2026-11-30"]]);
  });
  it("Weekly closing on Sunday → 7-day windows ending on a Sunday", () => {
    const c = cyclesBetween("Weekly", { closingWeekday: 0 }, "2026-11-01", "2026-11-30");
    expect(c.length).toBeGreaterThan(0);
    for (const p of c) {
      expect(new Date(p.end + "T00:00:00Z").getUTCDay()).toBe(0); // Sunday
      expect(p.start).toBe(addDays(p.end, -6));
    }
  });
  it("TwoMonthly anchored to January → Nov–Dec window contains November", () => {
    const c = cyclesBetween("TwoMonthly", { anchorMonth: 1 }, "2026-11-10", "2026-11-20");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ key: "2M-2026-11", start: "2026-11-01", end: "2026-12-31" });
  });
  it("Quarterly anchored to January → Oct–Dec window contains November", () => {
    const c = cyclesBetween("Quarterly", { anchorMonth: 1 }, "2026-11-10", "2026-11-20");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ key: "Q-2026-10", start: "2026-10-01", end: "2026-12-31" });
  });
  it("AdHoc generates nothing", () => {
    expect(cyclesBetween("AdHoc", {}, "2026-01-01", "2026-12-31")).toEqual([]);
  });
  it("keys are unique across a long range (safe to INSERT OR IGNORE)", () => {
    const keys = cyclesBetween("Weekly", { closingWeekday: 3 }, "2026-01-01", "2026-06-30").map((x) => x.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("cycleContaining", () => {
  it("resolves the cycle around a date, null for AdHoc", () => {
    expect(cycleContaining("Monthly", {}, "2026-11-15")?.start).toBe("2026-11-01");
    expect(cycleContaining("Quarterly", { anchorMonth: 1 }, "2026-11-15")?.key).toBe("Q-2026-10");
    expect(cycleContaining("AdHoc", {}, "2026-11-15")).toBeNull();
  });
});

describe("working-day deadlines", () => {
  it("calendar mode equals plain addDays; working mode never lands on a weekend and is >= calendar", () => {
    expect(deadlineFrom("2026-11-30", 5, false)).toBe("2026-12-05");
    for (const base of ["2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30"]) {
      const wd = deadlineFrom(base, 5, true);
      const day = new Date(wd + "T00:00:00Z").getUTCDay();
      expect(day).not.toBe(0); expect(day).not.toBe(6);
      expect(wd >= deadlineFrom(base, 5, false)).toBe(true);
    }
    expect(addBusinessDays("2026-11-30", 0)).toBe("2026-11-30");
  });
});

describe("labels + lifecycle", () => {
  it("frequency labels map the PRD wording", () => {
    expect(BILLING_FREQUENCY_LABELS.Fortnightly).toBe("Twice monthly");
    expect(BILLING_FREQUENCY_LABELS.TwoMonthly).toBe("Every two months");
  });
  it("lifecycle is ordered Scheduled → Submitted", () => {
    expect(BILLING_LIFECYCLE[0]).toBe("Scheduled");
    expect(BILLING_LIFECYCLE[BILLING_LIFECYCLE.length - 1]).toBe("Submitted");
  });
});
