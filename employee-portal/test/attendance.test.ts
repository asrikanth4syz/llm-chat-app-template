// FR-02 Attendance domain proof. Run: npm test (node --test, strips TS types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hhmmToMinutes, minutesToHHMM, dayExceptions, summarize, dayOfWeekUTC, daysInMonth, workingDaysInMonth, payrollInput } from "../src/attendance.ts";

test("hhmmToMinutes parses times and rejects placeholders/garbage", () => {
  assert.equal(hhmmToMinutes("09:30"), 570);
  assert.equal(hhmmToMinutes("18:45"), 1125);
  assert.equal(hhmmToMinutes("--:--"), null);
  assert.equal(hhmmToMinutes(""), null);
  assert.equal(hhmmToMinutes(null), null);
  assert.equal(hhmmToMinutes("9:5"), null); // minutes not zero-padded
});

test("minutesToHHMM formats H:MM", () => {
  assert.equal(minutesToHHMM(570), "9:30");
  assert.equal(minutesToHHMM(0), "0:00");
  assert.equal(minutesToHHMM(605), "10:05");
});

test("dayExceptions flags missing punch, absence and short hours; future days stay clear", () => {
  const base = { date: "2026-11-10", inTime: "09:00", outTime: "18:00", workMinutes: 480, status: "P" };
  assert.deepEqual(dayExceptions(base, "2026-11-30"), []);
  assert.deepEqual(dayExceptions({ ...base, outTime: "--:--" }, "2026-11-30"), ["missing_out"]);
  assert.deepEqual(dayExceptions({ ...base, inTime: "--:--" }, "2026-11-30"), ["missing_in"]);
  assert.deepEqual(dayExceptions({ ...base, inTime: null, outTime: null, workMinutes: 0, status: "A" }, "2026-11-30"), ["absent"]);
  assert.deepEqual(dayExceptions({ ...base, workMinutes: 120 }, "2026-11-30"), ["short_hours"]);
  // a day not yet worked (after `today`) is never flagged
  assert.deepEqual(dayExceptions({ ...base, outTime: "--:--", date: "2026-11-30" }, "2026-11-14"), []);
  // week-off is not a working day → no absent flag
  assert.deepEqual(dayExceptions({ date: "2026-11-08", inTime: null, outTime: null, workMinutes: 0, status: "WO" }, "2026-11-30"), []);
});

test("summarize rolls up statuses, work minutes, OT and exception days", () => {
  const days = [
    { date: "2026-11-02", inTime: "09:00", outTime: "18:00", workMinutes: 480, status: "P", otMinutes: 60 },
    { date: "2026-11-03", inTime: "09:00", outTime: "--:--", workMinutes: 0, status: "P" }, // missing out
    { date: "2026-11-04", inTime: null, outTime: null, workMinutes: 0, status: "A" },        // absent
    { date: "2026-11-08", inTime: null, outTime: null, workMinutes: 0, status: "WO", otMinutes: 30 },
  ];
  const s = summarize(days, "2026-11-30");
  assert.equal(s.present, 2);
  assert.equal(s.absent, 1);
  assert.equal(s.weekoff, 1);
  assert.equal(s.workMinutes, 480);
  assert.equal(s.otMinutes, 90); // 60 on the present day + 30 on the week-off
  assert.equal(s.exceptionDays, 2); // the missing-out day and the absent day
});

test("date helpers are timezone-independent (computed in UTC)", () => {
  assert.equal(dayOfWeekUTC("2026-11-01"), 0); // Sunday
  assert.equal(dayOfWeekUTC("2026-11-02"), 1); // Monday
  assert.equal(daysInMonth("2026-11"), 30);
  assert.equal(daysInMonth("2026-02"), 28);
  assert.equal(daysInMonth("2024-02"), 29); // leap year
});

test("workingDaysInMonth excludes weekly-offs and holidays", () => {
  // Nov 2026: 30 days, 5 Sundays (1,8,15,22,29). Sunday-off → 25 working days.
  assert.equal(workingDaysInMonth("2026-11", new Set(), [0]), 25);
  // Minus two holidays that fall on working days (Nov 2 Mon, Nov 26 Thu).
  assert.equal(workingDaysInMonth("2026-11", new Set(["2026-11-02", "2026-11-26"]), [0]), 23);
  // A holiday that lands on a Sunday doesn't double-count.
  assert.equal(workingDaysInMonth("2026-11", new Set(["2026-11-01"]), [0]), 25);
});

test("payrollInput derives payable days = calendar − LOP, with holiday calendar", () => {
  // A completed month: Sundays off, one holiday (Nov 2). Build 30 days, present on
  // every working day except Nov 4 (absent → LOP) and Nov 5 (approved leave → paid).
  const holidays = new Set(["2026-11-02"]);
  const days = [];
  for (let d = 1; d <= 30; d++) {
    const date = `2026-11-${String(d).padStart(2, "0")}`;
    const dow = dayOfWeekUTC(date);
    let status = "P", otMinutes = 0;
    if (dow === 0) status = "WO";
    else if (date === "2026-11-02") status = "HL";
    else if (date === "2026-11-04") status = "A";   // unpaid absence
    else if (date === "2026-11-05") status = "LV";  // approved (paid) leave
    if (date === "2026-11-06") otMinutes = 90;       // overtime
    days.push({ date, inTime: status === "P" ? "09:30" : null, outTime: status === "P" ? "18:00" : null, workMinutes: status === "P" ? 480 : 0, status, otMinutes });
  }
  const p = payrollInput("2026-11", days, holidays, [0], "2026-11-30");
  assert.equal(p.calendarDays, 30);
  assert.equal(p.workingDays, 24);   // 25 non-Sundays − 1 holiday (Nov 2)
  assert.equal(p.weekoff, 5);        // 5 Sundays
  assert.equal(p.holiday, 1);
  assert.equal(p.paidLeave, 1);      // Nov 5
  assert.equal(p.lop, 1);            // Nov 4
  assert.equal(p.present, 22);       // 24 working − 1 leave − 1 absent
  assert.equal(p.payableDays, 29);   // 30 − 1 LOP
  assert.equal(p.otMinutes, 90);
  assert.equal(p.pending, 0);        // month complete relative to today
});

test("payrollInput: future working days in an open month are pending, not LOP", () => {
  // As of mid-month, days after `today` with no record must not inflate loss-of-pay.
  const days = [
    { date: "2026-11-02", inTime: "09:30", outTime: "18:00", workMinutes: 480, status: "P" },
    { date: "2026-11-03", inTime: "09:30", outTime: "18:00", workMinutes: 480, status: "P" },
  ];
  const p = payrollInput("2026-11", days, new Set(), [0], "2026-11-03");
  assert.equal(p.present, 2);
  assert.equal(p.lop, 0);                 // nothing past-due is absent
  assert.equal(p.pending > 0, true);      // the rest of November is pending
  assert.equal(p.payableDays, 30);        // optimistic until absences land
});
