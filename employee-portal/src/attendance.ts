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
  workMinutes: number; exceptionDays: number;
}

/** Monthly rollup. `today` bounds exception counting to days already worked. */
export function summarize(days: AttendanceDay[], today?: string): AttendanceSummary {
  const s: AttendanceSummary = { present: 0, absent: 0, weekoff: 0, holiday: 0, leave: 0, workMinutes: 0, exceptionDays: 0 };
  for (const d of days) {
    if (d.status === "P") s.present++;
    else if (d.status === "A") s.absent++;
    else if (d.status === "WO") s.weekoff++;
    else if (d.status === "HL") s.holiday++;
    else if (d.status === "LV") s.leave++;
    s.workMinutes += d.workMinutes || 0;
    if (dayExceptions(d, today).length) s.exceptionDays++;
  }
  return s;
}
