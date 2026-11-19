// Unit tests for the recurring-order schedule math (src/recurring.ts).
// Locked rules: no holiday/weekend shifting; monthly supports both explicit dates
// and a weekday pattern; window is clamped to the plan's [start_date, end_date].
import { describe, it, expect } from "vitest";
import { recurringOccurrences, istTodayISO, addDaysISO, type RecurrencePlan } from "../src/recurring.ts";

const base = (p: Partial<RecurrencePlan>): RecurrencePlan =>
  ({ freq: "weekdays", start_date: "2026-11-01", ...p } as RecurrencePlan);

describe("weekdays / weekly", () => {
  it("every selected weekday in the window", () => {
    // 2026-11-23 is a Monday. Mon/Wed/Fri across one week.
    const r = recurringOccurrences(base({ freq: "weekdays", days: ["Mon", "Wed", "Fri"] }), "2026-11-23", "2026-11-29");
    expect(r).toEqual(["2026-11-23", "2026-11-25", "2026-11-27"]);
  });
  it("Mon–Fri business week excludes Sat/Sun", () => {
    const r = recurringOccurrences(base({ freq: "weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] }), "2026-11-23", "2026-11-29");
    expect(r).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
  });
  it("no days selected → nothing", () => {
    expect(recurringOccurrences(base({ freq: "weekly", days: [] }), "2026-11-01", "2026-11-30")).toEqual([]);
  });
  it("deliver as scheduled: a Sunday stays a Sunday (no shift)", () => {
    // 2026-11-29 is a Sunday.
    const r = recurringOccurrences(base({ freq: "weekly", days: ["Sun"] }), "2026-11-23", "2026-11-30");
    expect(r).toEqual(["2026-11-29"]);
  });
});

describe("monthly — explicit dates", () => {
  it("lists the given days of each month in range", () => {
    const r = recurringOccurrences(
      base({ freq: "monthly", monthly_method: "dates", monthly_dates: [5, 12, 19, 26] }),
      "2026-11-01", "2026-12-31");
    expect(r).toEqual([
      "2026-11-05", "2026-11-12", "2026-11-19", "2026-11-26",
      "2026-12-05", "2026-12-12", "2026-12-19", "2026-12-26",
    ]);
  });
  it("drops impossible days (no 30 Feb)", () => {
    const r = recurringOccurrences(
      base({ freq: "monthly", monthly_method: "dates", monthly_dates: [30], start_date: "2027-02-01" }),
      "2027-02-01", "2027-03-31");
    expect(r).toEqual(["2027-03-30"]); // Feb has no 30th
  });
  it("partial window only returns dates inside it", () => {
    const r = recurringOccurrences(
      base({ freq: "monthly", monthly_method: "dates", monthly_dates: [5, 26] }),
      "2026-11-10", "2026-11-30");
    expect(r).toEqual(["2026-11-26"]);
  });
});

describe("monthly — weekday pattern", () => {
  it("every selected weekday across the month(s)", () => {
    // Every Monday of November 2026: 2,9,16,23,30.
    const r = recurringOccurrences(
      base({ freq: "monthly", monthly_method: "pattern", days: ["Mon"] }),
      "2026-11-01", "2026-11-30");
    expect(r).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  });
});

describe("custom dates", () => {
  it("only the listed dates inside the window", () => {
    const r = recurringOccurrences(
      base({ freq: "custom", custom_dates: ["2026-12-05", "2026-12-12", "2027-01-02"] }),
      "2026-12-01", "2026-12-31");
    expect(r).toEqual(["2026-12-05", "2026-12-12"]);
  });
  it("de-duplicates and sorts", () => {
    const r = recurringOccurrences(
      base({ freq: "custom", custom_dates: ["2026-12-12", "2026-12-05", "2026-12-12"] }),
      "2026-12-01", "2026-12-31");
    expect(r).toEqual(["2026-12-05", "2026-12-12"]);
  });
});

describe("window clamping to the plan range", () => {
  it("never returns dates before start_date", () => {
    const r = recurringOccurrences(
      base({ freq: "weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start_date: "2026-11-25" }),
      "2026-11-23", "2026-11-27");
    expect(r).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
  });
  it("never returns dates after end_date", () => {
    const r = recurringOccurrences(
      base({ freq: "weekdays", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], start_date: "2026-11-01", end_date: "2026-11-25" }),
      "2026-11-23", "2026-11-30");
    expect(r).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
  });
  it("start after end → nothing", () => {
    expect(recurringOccurrences(base({ freq: "weekly", days: ["Mon"] }), "2026-12-10", "2026-12-01")).toEqual([]);
  });
});

describe("guards", () => {
  it("bad dates / missing start → empty", () => {
    expect(recurringOccurrences({ freq: "weekly", days: ["Mon"] } as RecurrencePlan, "2026-11-01", "2026-11-30")).toEqual([]);
    expect(recurringOccurrences(base({ freq: "weekly", days: ["Mon"] }), "bad", "2026-11-30")).toEqual([]);
  });
});

describe("date helpers", () => {
  it("istTodayISO shifts into IST", () => {
    // 2026-11-18T20:00:00Z is 2026-11-19 01:30 IST.
    expect(istTodayISO(Date.parse("2026-11-18T20:00:00Z"))).toBe("2026-11-19");
  });
  it("addDaysISO adds and subtracts", () => {
    expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysISO("2026-01-01", -1)).toBe("2025-12-31");
  });
});
