// FR-02 Attendance — pure helpers (time math + exception rules). No Worker/D1, so
// unit-tested directly. Daily punches/hours come from the biometric system; these
// rules surface the days that need attention (missing punch, absence, short hours).

/** "HH:MM" → minutes since midnight; null for "--:--", blank, or malformed.
 *  Hours may exceed 24 in some reports (overnight), so allow up to 47. */
export function hhmmToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 47 || mi > 59) return null;
  return h * 60 + mi;
}

/** minutes → "H:MM" for display. */
export function minutesToHHMM(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}

export interface AttendanceDay {
  date: string;              // YYYY-MM-DD
  inTime: string | null;
  outTime: string | null;
  workMinutes: number;
  status: string;            // P | A | WO | HL | LV
  otMinutes?: number;        // overtime for the day (from the biometric OT row)
}

export type AttendanceException = "missing_out" | "missing_in" | "absent" | "short_hours";

const NON_WORKING = new Set(["WO", "HL", "LV"]); // not expected to be at work
const FULL_DAY_MIN = 4 * 60;                       // under 4h on a present day → short

function present(v: string | null): boolean {
  return !!v && v !== "--:--";
}

/** Rule-based exceptions for one day. A future day (date > today) is never flagged.
 *  Pure. */
export function dayExceptions(d: AttendanceDay, today?: string): AttendanceException[] {
  if (today && d.date > today) return []; // nothing to flag for a day not yet worked
  const ex: AttendanceException[] = [];
  const hasIn = present(d.inTime), hasOut = present(d.outTime);
  if (hasIn && !hasOut) ex.push("missing_out");
  if (!hasIn && hasOut) ex.push("missing_in");
  if (d.status === "A" && !NON_WORKING.has(d.status)) ex.push("absent");
  if (d.status === "P" && hasIn && hasOut && d.workMinutes > 0 && d.workMinutes < FULL_DAY_MIN) ex.push("short_hours");
  return ex;
}

export interface AttendanceSummary {
  present: number; absent: number; weekoff: number; holiday: number; leave: number;
  workMinutes: number; otMinutes: number; exceptionDays: number;
}

/** Monthly rollup. `today` bounds exception counting to days already worked. */
export function summarize(days: AttendanceDay[], today?: string): AttendanceSummary {
  const s: AttendanceSummary = { present: 0, absent: 0, weekoff: 0, holiday: 0, leave: 0, workMinutes: 0, otMinutes: 0, exceptionDays: 0 };
  for (const d of days) {
    if (d.status === "P") s.present++;
    else if (d.status === "A") s.absent++;
    else if (d.status === "WO") s.weekoff++;
    else if (d.status === "HL") s.holiday++;
    else if (d.status === "LV") s.leave++;
    s.workMinutes += d.workMinutes || 0;
    s.otMinutes += d.otMinutes || 0;
    if (dayExceptions(d, today).length) s.exceptionDays++;
  }
  return s;
}

// ---- Payroll-ready attendance (month cutoff + holiday-calendar day counting) --------

/** Day-of-week (0=Sun … 6=Sat) for a YYYY-MM-DD string, computed in UTC so it is
 *  deterministic regardless of the host timezone. */
export function dayOfWeekUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Number of calendar days in a YYYY-MM month. */
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Working days in the month = calendar days that are neither a weekly-off nor a
 *  holiday. `weekOffDays` are day-of-week ints (0=Sun); `holidays` is a set of
 *  YYYY-MM-DD. Pure — the reproducible denominator for payable-day counting. */
export function workingDaysInMonth(ym: string, holidays: Set<string>, weekOffDays: number[]): number {
  const wo = new Set(weekOffDays);
  const n = daysInMonth(ym);
  let count = 0;
  for (let d = 1; d <= n; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    if (wo.has(dayOfWeekUTC(date))) continue;
    if (holidays.has(date)) continue;
    count++;
  }
  return count;
}

export interface PayrollInput {
  ym: string;
  calendarDays: number;   // days in the month
  workingDays: number;    // calendar − weekly-off − holiday
  present: number;        // working days marked present (P)
  paidLeave: number;      // working days on approved leave (LV) — paid
  lop: number;            // working days absent / unrecorded (past) — loss of pay
  pending: number;        // working days after `today` with no record yet (preview only)
  weekoff: number;
  holiday: number;
  payableDays: number;    // calendarDays − lop (India convention: pay all days less LOP)
  otMinutes: number;      // overtime across the whole month
  exceptionDays: number;  // recorded days with an attendance exception
  recordedDays: number;   // days that have an attendance_days row
}

/** Derive the payroll input for one employee-month from their days + the calendar.
 *  This is a DERIVED, REPRODUCIBLE record (blueprint §2.4): same days + same rules →
 *  same numbers. A working day that is absent or (in the past) has no record counts as
 *  loss-of-pay; future working days in an open month are `pending`, not LOP. Pure. */
export function payrollInput(
  ym: string,
  days: AttendanceDay[],
  holidays: Set<string>,
  weekOffDays: number[],
  today?: string,
): PayrollInput {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const wo = new Set(weekOffDays);
  const n = daysInMonth(ym);
  const r: PayrollInput = {
    ym, calendarDays: n, workingDays: 0, present: 0, paidLeave: 0, lop: 0, pending: 0,
    weekoff: 0, holiday: 0, payableDays: 0, otMinutes: 0, exceptionDays: 0, recordedDays: days.length,
  };
  for (let d = 1; d <= n; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    const rec = byDate.get(date);
    r.otMinutes += rec?.otMinutes || 0;
    if (rec && dayExceptions(rec, today).length) r.exceptionDays++;
    if (wo.has(dayOfWeekUTC(date))) { r.weekoff++; continue; }
    if (holidays.has(date)) { r.holiday++; continue; }
    r.workingDays++;
    if (today && date > today) { r.pending++; continue; } // not yet worked
    const st = rec?.status || "";
    if (st === "P") r.present++;
    else if (st === "LV") r.paidLeave++;
    else r.lop++; // A, blank, or no record on a past working day → loss of pay
  }
  r.payableDays = r.calendarDays - r.lop;
  return r;
}
