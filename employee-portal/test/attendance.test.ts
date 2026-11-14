// FR-02 Attendance domain proof. Run: npm test (node --test, strips TS types).
import { test } from "node:test";
import assert from "node:assert/strict";
import { hhmmToMinutes, minutesToHHMM, dayExceptions, summarize } from "../src/attendance.ts";

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

test("summarize rolls up statuses, work minutes and exception days", () => {
  const days = [
    { date: "2026-11-02", inTime: "09:00", outTime: "18:00", workMinutes: 480, status: "P" },
    { date: "2026-11-03", inTime: "09:00", outTime: "--:--", workMinutes: 0, status: "P" }, // missing out
    { date: "2026-11-04", inTime: null, outTime: null, workMinutes: 0, status: "A" },        // absent
    { date: "2026-11-08", inTime: null, outTime: null, workMinutes: 0, status: "WO" },
  ];
  const s = summarize(days, "2026-11-30");
  assert.equal(s.present, 2);
  assert.equal(s.absent, 1);
  assert.equal(s.weekoff, 1);
  assert.equal(s.workMinutes, 480);
  assert.equal(s.exceptionDays, 2); // the missing-out day and the absent day
});
