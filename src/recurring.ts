// Recurring-order schedule math — PURE and unit-tested (see test/recurring.test.ts).
// Given a plan and a date window, it returns the delivery dates the plan is due on.
//
// Business rules locked with the product owner:
//  - "Deliver as scheduled": NO holiday/weekend shifting — a date that lands on a
//    Sunday or holiday stays on that date.
//  - Monthly "N times" supports BOTH an explicit list of month-days (5,12,19,26) and
//    a weekday pattern (every selected weekday of the month).
//  - Dates are plain "YYYY-MM-DD" strings; all math is anchored at UTC-noon so a
//    time-zone offset can never roll a date onto the wrong calendar day.

export type RecurrenceFreq = "weekdays" | "weekly" | "monthly" | "custom";

export interface RecurrencePlan {
  freq: RecurrenceFreq;
  days?: string[];                       // ["Mon","Tue",...] for weekdays / weekly / monthly-pattern
  monthly_method?: "pattern" | "dates";  // monthly only
  monthly_dates?: number[];              // [5,12,19,26] for monthly 'dates'
  custom_dates?: string[];               // ISO dates for 'custom'
  start_date: string;                    // YYYY-MM-DD inclusive
  end_date?: string | null;              // YYYY-MM-DD inclusive, optional (open-ended)
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoOf(d: Date): string { return d.toISOString().slice(0, 10); }
function parse(s: string): Date { return new Date(s + "T12:00:00Z"); }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
function dedupeSort(a: string[]): string[] { return [...new Set(a)].sort(); }
const isISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * The delivery dates (YYYY-MM-DD, ascending, de-duplicated) a plan is due on within
 * the inclusive window [fromISO, toISO], clamped to the plan's own [start_date, end_date].
 */
export function recurringOccurrences(plan: RecurrencePlan, fromISO: string, toISO: string): string[] {
  if (!plan || !isISO(plan.start_date) || !isISO(fromISO) || !isISO(toISO)) return [];

  // Clamp the requested window to the plan's active range.
  let from = fromISO;
  let to = toISO;
  if (plan.start_date > from) from = plan.start_date;
  if (plan.end_date && isISO(plan.end_date) && plan.end_date < to) to = plan.end_date;
  if (from > to) return [];

  // Custom: just the listed dates that fall inside the window.
  if (plan.freq === "custom") {
    return dedupeSort((plan.custom_dates || []).filter(d => isISO(d) && d >= from && d <= to));
  }

  // Weekday-driven (weekdays, weekly, and monthly-by-pattern all resolve to
  // "every selected weekday in the window").
  const weekdayDriven =
    plan.freq === "weekdays" ||
    plan.freq === "weekly" ||
    (plan.freq === "monthly" && (plan.monthly_method || "pattern") === "pattern");

  if (weekdayDriven) {
    const set = new Set((plan.days || []).map(x => String(x).slice(0, 3)));
    if (!set.size) return [];
    const out: string[] = [];
    const toD = parse(to);
    for (let d = parse(from); d <= toD; d = addDays(d, 1)) {
      if (set.has(WD[d.getUTCDay()])) out.push(isoOf(d));
    }
    return out;
  }

  // Monthly by explicit day-of-month list.
  if (plan.freq === "monthly") {
    const days = (plan.monthly_dates || []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 31);
    if (!days.length) return [];
    const out: string[] = [];
    const toD = parse(to);
    // Walk month by month from the window start.
    let cursor = new Date(Date.UTC(parse(from).getUTCFullYear(), parse(from).getUTCMonth(), 1, 12));
    while (cursor <= toD) {
      const y = cursor.getUTCFullYear();
      const mo = cursor.getUTCMonth();
      for (const dom of days) {
        const cand = new Date(Date.UTC(y, mo, dom, 12));
        if (cand.getUTCMonth() === mo) {           // drop invalid days (e.g. Feb 30)
          const ci = isoOf(cand);
          if (ci >= from && ci <= to) out.push(ci);
        }
      }
      cursor = new Date(Date.UTC(y, mo + 1, 1, 12)); // next month
    }
    return dedupeSort(out);
  }

  return [];
}

/** Today in IST (Asia/Kolkata, UTC+5:30) as YYYY-MM-DD — the scheduler's "today". */
export function istTodayISO(now: number = Date.now()): string {
  return new Date(now + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD n days after an ISO date (n may be negative). */
export function addDaysISO(iso: string, n: number): string {
  return isoOf(addDays(parse(iso), n));
}
