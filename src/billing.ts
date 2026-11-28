// Billing & Invoice Tracker — pure period/schedule/submission logic.
// No DB or network here, so it unit-tests directly. The backend (src/index.ts)
// wraps these with persistence, reservations and permissions.

export type BillingFrequency = "Monthly" | "Fortnightly" | "Weekly";
export const BILLING_FREQUENCIES: BillingFrequency[] = ["Monthly", "Fortnightly", "Weekly"];

export interface BillingPeriod {
  key: string;        // stable, idempotent id suffix within a client (e.g. "2026-11-F1")
  label: string;      // human label (e.g. "1–15 Nov 2026")
  start: string;      // ISO date (inclusive)
  end: string;        // ISO date (inclusive)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Days in a given month. month is 1-based.
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// All billing periods that fall within one calendar month for a frequency.
// Deterministic and non-overlapping, so re-running generation never duplicates.
export function periodsForMonth(freq: BillingFrequency, year: number, month: number): BillingPeriod[] {
  const last = daysInMonth(year, month);
  const mon = MONTHS[month - 1];
  if (freq === "Monthly") {
    return [{ key: `${year}-${String(month).padStart(2, "0")}-M`, label: `${mon} ${year}`, start: iso(year, month, 1), end: iso(year, month, last) }];
  }
  if (freq === "Fortnightly") {
    return [
      { key: `${year}-${String(month).padStart(2, "0")}-F1`, label: `1–15 ${mon} ${year}`, start: iso(year, month, 1), end: iso(year, month, 15) },
      { key: `${year}-${String(month).padStart(2, "0")}-F2`, label: `16–${last} ${mon} ${year}`, start: iso(year, month, 16), end: iso(year, month, last) },
    ];
  }
  // Weekly — seven-day windows anchored to the 1st; the final window runs to month end.
  const out: BillingPeriod[] = [];
  let w = 0;
  for (let d = 1; d <= last; d += 7) {
    w++;
    const endDay = Math.min(d + 6, last);
    out.push({ key: `${year}-${String(month).padStart(2, "0")}-W${w}`, label: `${d}–${endDay} ${mon} ${year}`, start: iso(year, month, d), end: iso(year, month, endDay) });
  }
  return out;
}

// The single period that contains a given date (used to default to "current period").
export function periodContaining(freq: BillingFrequency, refISO: string): BillingPeriod {
  const [y, m, d] = refISO.split("-").map(Number);
  const periods = periodsForMonth(freq, y, m);
  const day = d;
  return periods.find((p) => {
    const sd = Number(p.start.split("-")[2]);
    const ed = Number(p.end.split("-")[2]);
    return day >= sd && day <= ed;
  }) || periods[periods.length - 1];
}

// Generate the periods to seed for a client: the months spanning [fromISO..toISO],
// each expanded by frequency. Idempotent via the stable period keys.
export function periodsBetween(freq: BillingFrequency, fromISO: string, toISO: string): BillingPeriod[] {
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);
  const out: BillingPeriod[] = [];
  let y = fy, m = fm;
  for (let guard = 0; guard < 240; guard++) {        // guard against runaway loops
    out.push(...periodsForMonth(freq, y, m));
    if (y === ty && m === tm) break;
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

// Add whole days to an ISO date, returning an ISO date. Timezone-stable (UTC math).
export function addDays(iso0: string, days: number): string {
  const [y, m, d] = iso0.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// Target dates derive from the period end plus a configured offset (business days
// handling is a later enhancement; v1 uses calendar days).
export function invoiceTargetDate(periodEnd: string, offsetDays: number): string {
  return addDays(periodEnd, Math.max(0, offsetDays || 0));
}
export function submissionTargetDate(periodEnd: string, offsetDays: number): string {
  return addDays(periodEnd, Math.max(0, offsetDays || 0));
}

export type SubmissionStatus = "Not Ready" | "Ready" | "Partially Submitted" | "Submitted";

export interface SubmissionChannels { email: boolean; portal: boolean; hardcopy: boolean; }
export interface SubmissionDates { email?: string | null; portal?: string | null; hardcopy?: string | null; submitted?: string | null; }

// Derive the submission status + effective submitted date from the required channels
// and the recorded completion dates. `recorded` is whether the invoice itself is
// recorded (a draft is always "Not Ready"). submittedDate is the latest required
// channel completion (or the manual submitted date when no channels are required).
export function deriveSubmission(recorded: boolean, req: SubmissionChannels, dates: SubmissionDates): { status: SubmissionStatus; submittedDate: string | null } {
  if (!recorded) return { status: "Not Ready", submittedDate: null };
  const required: Array<keyof SubmissionChannels> = [];
  if (req.email) required.push("email");
  if (req.portal) required.push("portal");
  if (req.hardcopy) required.push("hardcopy");
  if (required.length === 0) {
    const sd = dates.submitted || null;
    return { status: sd ? "Submitted" : "Ready", submittedDate: sd };
  }
  const got = required.map((c) => dates[c as keyof SubmissionDates] || null).filter(Boolean) as string[];
  if (got.length === 0) return { status: "Ready", submittedDate: null };
  if (got.length < required.length) return { status: "Partially Submitted", submittedDate: null };
  const latest = got.slice().sort().pop() as string;    // ISO dates sort lexically
  return { status: "Submitted", submittedDate: latest };
}

// An overdue milestone: a target date in the past with the milestone still incomplete.
export function isOverdue(targetDate: string | null | undefined, done: boolean, todayISO: string): boolean {
  if (!targetDate || done) return false;
  return targetDate < todayISO;
}

// Round money to 2dp to avoid float drift when summing DC values.
export function money(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }

// Does the recorded invoice total reconcile with the allocated DC value? Returns the
// absolute variance; the caller decides whether an (authorised) explanation is needed.
export function invoiceVariance(invoiceTotal: number, allocatedValue: number): number {
  return money(Math.abs(money(invoiceTotal) - money(allocatedValue)));
}
