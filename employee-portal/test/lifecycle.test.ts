// Lifecycle / F&F engine proof. Run: npm test (node --test, strips TS types).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysISO, suggestLWD, servedNoticeDays, noticeShortfallDays,
  completedMonths, completedYears, gratuityYears, gratuityEligible, gratuityEstimatePaise,
  perDayPaise, computeFnF, type FnFInput,
} from "../src/lifecycle.ts";

test("addDaysISO crosses month and year boundaries", () => {
  assert.equal(addDaysISO("2026-01-31", 1), "2026-02-01");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28");
});

test("suggestLWD = tender + notice days", () => {
  assert.equal(suggestLWD("2026-11-01", 30), "2026-12-01");
  assert.equal(suggestLWD("2026-11-01", 0), "2026-11-01");
});

test("served notice and shortfall", () => {
  // full notice served → no shortfall
  assert.equal(servedNoticeDays("2026-11-01", "2026-12-01"), 30);
  assert.equal(noticeShortfallDays(30, "2026-11-01", "2026-12-01"), 0);
  // left early → shortfall is the un-served remainder
  assert.equal(servedNoticeDays("2026-11-01", "2026-11-16"), 15);
  assert.equal(noticeShortfallDays(30, "2026-11-01", "2026-11-16"), 15);
  // served more than required → still 0
  assert.equal(noticeShortfallDays(30, "2026-11-01", "2027-01-01"), 0);
});

test("tenure months/years", () => {
  assert.equal(completedMonths("2020-01-10", "2026-01-09"), 71); // one day short of 6 years
  assert.equal(completedMonths("2020-01-10", "2026-01-10"), 72);
  assert.equal(completedYears("2020-01-10", "2026-01-10"), 6);
  assert.equal(completedYears("2021-06-01", "2026-05-31"), 4); // anniversary not reached
});

test("gratuity eligibility + >6-month rounding", () => {
  assert.equal(gratuityEligible("2021-06-01", "2026-05-31"), false); // 4 completed years
  assert.equal(gratuityEligible("2020-01-01", "2026-01-01"), true);  // 6 years
  // 5 years + 7 months → 6 years for the formula
  assert.equal(gratuityYears("2020-01-01", "2025-08-05"), 6);
  // 5 years + 6 months exactly → stays 5 (not "in excess of" six months)
  assert.equal(gratuityYears("2020-01-01", "2025-07-01"), 5);
});

test("gratuity estimate = 15/26 x basic x years; 0 when ineligible", () => {
  // basic+DA ₹26,000 = 2,600,000 paise, 6 years → 15/26 * 2,600,000 * 6 = 9,000,000 paise
  assert.equal(gratuityEstimatePaise(2600000, "2020-01-01", "2026-01-01"), 9000000);
  assert.equal(gratuityEstimatePaise(2600000, "2023-01-01", "2026-01-01"), 0); // 3 years → ineligible
});

test("perDayPaise guards divisor 0", () => {
  assert.equal(perDayPaise(3000000, 30), 100000);
  assert.equal(perDayPaise(3000000, 0), 0);
});

test("computeFnF assembles earnings, deductions and net (estimate)", () => {
  const inp: FnFInput = {
    doj: "2020-01-01", lwd: "2026-11-16", resignationDate: "2026-11-01", requiredNoticeDays: 30,
    monthlyGrossPaise: 3000000,      // ₹30,000
    encashBasisPaise: 3000000, gratuityBasisPaise: 1500000, // basic+DA ₹15,000
    salaryDivisor: 30, encashDivisor: 30,
    finalMonthPayableDays: 16,       // 1..16 Nov
    encashableLeaveDays: 10,
    recoverNoticeShortfall: true,
  };
  const w = computeFnF(inp);
  // final salary: 30,000/30 * 16 = 16,000
  const final = w.lines.find((l) => l.code === "FINAL_SALARY");
  assert.equal(final?.amountPaise, 1600000);
  // leave encashment: 30,000/30 * 10 = 10,000
  assert.equal(w.lines.find((l) => l.code === "LEAVE_ENCASH")?.amountPaise, 1000000);
  // gratuity: 15/26 * 15,000 * 7yr (6y10.5m → >6 months → 7) ... check years
  assert.equal(w.tenure.completedYears, 6);
  assert.equal(w.gratuity.eligible, true);
  // notice: tendered 11-01, LWD 11-16 → served 15, shortfall 15 → recovery 30,000/30*15 = 15,000
  assert.equal(w.noticeShortfallDays, 15);
  assert.equal(w.lines.find((l) => l.code === "NOTICE_RECOVERY")?.amountPaise, 1500000);
  assert.equal(w.deductionsPaise, 1500000);
  assert.equal(w.estimatedNetPaise, w.earningsPaise - w.deductionsPaise);
});

test("computeFnF: no gratuity under 5 years, no recovery when full notice served", () => {
  const w = computeFnF({
    doj: "2024-01-01", lwd: "2026-12-01", resignationDate: "2026-11-01", requiredNoticeDays: 30,
    monthlyGrossPaise: 3000000, encashBasisPaise: 3000000, gratuityBasisPaise: 1500000,
    salaryDivisor: 30, encashDivisor: 30, finalMonthPayableDays: 0, encashableLeaveDays: 0,
    recoverNoticeShortfall: true,
  });
  assert.equal(w.gratuity.eligible, false);
  assert.equal(w.lines.find((l) => l.code === "GRATUITY"), undefined);
  assert.equal(w.noticeShortfallDays, 0);
  assert.equal(w.lines.find((l) => l.code === "NOTICE_RECOVERY"), undefined);
  assert.equal(w.estimatedNetPaise, 0);
});
