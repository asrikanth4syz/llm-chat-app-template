// Billing & Invoice Tracker — pure period/schedule/submission logic.
// No DB or network here, so it unit-tests directly. The backend (src/index.ts)
// wraps these with persistence, reservations and permissions.

// "Fortnightly" is the PRD's "Twice monthly" (1–15 / 16–end). "TwoMonthly" is
// "Every two months"; "AdHoc" has no auto-generated cycles (manual period/task).
export type BillingFrequency = "Weekly" | "Fortnightly" | "Monthly" | "TwoMonthly" | "Quarterly" | "AdHoc";
export const BILLING_FREQUENCIES: BillingFrequency[] = ["Weekly", "Fortnightly", "Monthly", "TwoMonthly", "Quarterly", "AdHoc"];
export const BILLING_FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  Weekly: "Weekly", Fortnightly: "Twice monthly", Monthly: "Monthly",
  TwoMonthly: "Every two months", Quarterly: "Quarterly", AdHoc: "Ad hoc",
};

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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 — rule-driven cycle generation with configurable cut-offs, plus
// deadline (calendar/working-day) and lifecycle helpers.
// ─────────────────────────────────────────────────────────────────────────────

// Per-rule cut-off configuration. All optional; sensible defaults apply.
export interface CycleConfig {
  closingWeekday?: number | null; // Weekly: 0=Sun..6=Sat the week closes on (default 0/Sun)
  cutoffDay?: number | null;      // Monthly: day the cycle closes (default = month end)
  anchorMonth?: number | null;    // TwoMonthly/Quarterly: a 1..12 month that starts a window
}

function addMonthsYM(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = (y * 12 + (m - 1)) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}
function lastOfMonth(y: number, m: number): string { return iso(y, m, daysInMonth(y, m)); }
function labelDM(isoD: string): string { const [y, m, d] = isoD.split("-").map(Number); return `${d} ${MONTHS[m - 1]}`; }
function rangeLabel(start: string, end: string): string {
  const ey = end.split("-")[0];
  return `${labelDM(start)} – ${labelDM(end)} ${ey}`;
}

// A multi-month window [startMonth .. startMonth+len-1], labelled by its span.
function monthWindow(sy: number, sm: number, len: number, keyPrefix: string): BillingPeriod {
  const e = addMonthsYM(sy, sm, len - 1);
  const start = iso(sy, sm, 1), end = lastOfMonth(e.y, e.m);
  const label = len === 1 ? `${MONTHS[sm - 1]} ${sy}`
    : `${MONTHS[sm - 1]} ${sy}${e.y !== sy ? "" : ""} – ${MONTHS[e.m - 1]} ${e.y}`;
  return { key: `${keyPrefix}-${sy}-${String(sm).padStart(2, "0")}`, label, start, end };
}

// Generate the cycles for a rule's frequency that fall within [fromISO..toISO]
// (by period end). Deterministic + idempotent via stable keys. AdHoc yields none.
export function cyclesBetween(freq: BillingFrequency, cfg: CycleConfig, fromISO: string, toISO: string): BillingPeriod[] {
  if (freq === "AdHoc") return [];
  const out = new Map<string, BillingPeriod>();
  const [fy, fm] = fromISO.split("-").map(Number);
  const [ty, tm] = toISO.split("-").map(Number);

  if (freq === "Weekly") {
    const cw = ((Number(cfg.closingWeekday ?? 0)) % 7 + 7) % 7;
    // Walk day-by-day from a little before `from` to `to`, emitting a week whenever
    // we hit the closing weekday (period = the 7 days ending that day).
    const startScan = new Date(Date.UTC(fy, fm - 1, 1));
    const endScan = new Date(Date.UTC(ty, tm - 1, daysInMonth(ty, tm)));
    for (const d = new Date(startScan); d <= endScan; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() !== cw) continue;
      const end = d.toISOString().slice(0, 10);
      const start = addDays(end, -6);
      if (end < fromISO || start > toISO) continue;
      out.set(`W${cw}-${end}`, { key: `W${cw}-${end}`, label: rangeLabel(start, end), start, end });
    }
    return [...out.values()].sort((a, b) => a.start.localeCompare(b.start));
  }

  if (freq === "Fortnightly" || freq === "Monthly") {
    const cut = freq === "Monthly" ? Number(cfg.cutoffDay ?? 0) : 0;
    let { y, m } = addMonthsYM(fy, fm, -1);
    const stop = addMonthsYM(ty, tm, 0);
    for (let guard = 0; guard < 300; guard++) {
      if (freq === "Fortnightly") {
        for (const p of periodsForMonth("Fortnightly", y, m)) if (p.end >= fromISO && p.start <= toISO) out.set(p.key, p);
      } else if (cut && cut >= 1 && cut <= 28) {
        // Cut-off cycle: [day after previous cut-off .. cut-off of this month].
        const prev = addMonthsYM(y, m, -1);
        const start = addDays(iso(prev.y, prev.m, Math.min(cut, daysInMonth(prev.y, prev.m))), 1);
        const end = iso(y, m, Math.min(cut, daysInMonth(y, m)));
        if (end >= fromISO && start <= toISO) out.set(`${y}-${String(m).padStart(2, "0")}-MC`, { key: `${y}-${String(m).padStart(2, "0")}-MC`, label: rangeLabel(start, end), start, end });
      } else {
        for (const p of periodsForMonth("Monthly", y, m)) if (p.end >= fromISO && p.start <= toISO) out.set(p.key, p);
      }
      if (y === stop.y && m === stop.m) break;
      ({ y, m } = addMonthsYM(y, m, 1));
    }
    return [...out.values()].sort((a, b) => a.start.localeCompare(b.start));
  }

  // TwoMonthly / Quarterly — fixed-length windows aligned to an anchor month.
  const len = freq === "Quarterly" ? 3 : 2;
  const anchor = Number(cfg.anchorMonth ?? 1);
  const prefix = freq === "Quarterly" ? "Q" : "2M";
  let { y, m } = addMonthsYM(fy, fm, -len);
  const stop = addMonthsYM(ty, tm, 0);
  for (let guard = 0; guard < 300; guard++) {
    // Window start for the month (y,m): step back to the anchor-aligned start month.
    const back = ((m - anchor) % len + len) % len;
    const s = addMonthsYM(y, m, -back);
    const win = monthWindow(s.y, s.m, len, prefix);
    if (win.end >= fromISO && win.start <= toISO) out.set(win.key, win);
    if (y === stop.y && m === stop.m) break;
    ({ y, m } = addMonthsYM(y, m, 1));
  }
  return [...out.values()].sort((a, b) => a.start.localeCompare(b.start));
}

// The cycle containing a reference date for a rule (used to default to "current").
export function cycleContaining(freq: BillingFrequency, cfg: CycleConfig, refISO: string): BillingPeriod | null {
  if (freq === "AdHoc") return null;
  const found = cyclesBetween(freq, cfg, addDays(refISO, -95), addDays(refISO, 95))
    .find((p) => refISO >= p.start && refISO <= p.end);
  return found || null;
}

// Add N working days (Mon–Fri) to an ISO date. Saturdays/Sundays are skipped.
export function addBusinessDays(iso0: string, n: number): string {
  let d = iso0, left = Math.max(0, n || 0);
  while (left > 0) { d = addDays(d, 1); const wd = new Date(d + "T00:00:00Z").getUTCDay(); if (wd !== 0 && wd !== 6) left--; }
  return d;
}
// A deadline computed from a cycle end plus an offset, in calendar or working days.
export function deadlineFrom(periodEnd: string, offsetDays: number, useWorkingDays: boolean): string {
  return useWorkingDays ? addBusinessDays(periodEnd, offsetDays) : addDays(periodEnd, Math.max(0, offsetDays || 0));
}

// Billing-task lifecycle (billing state). Submission state is tracked separately
// via deriveSubmission. "Overdue" is an independent flag, never a status here.
export type BillingLifecycle =
  | "Scheduled" | "To Be Billed" | "Under Preparation" | "Pending Verification"
  | "Invoice Generated" | "Pending Submission" | "Partially Submitted" | "Submitted";
export type BillingException = "On Hold" | "No DCs Available" | "Cancelled" | "Correction Required";
export const BILLING_LIFECYCLE: BillingLifecycle[] = [
  "Scheduled", "To Be Billed", "Under Preparation", "Pending Verification",
  "Invoice Generated", "Pending Submission", "Partially Submitted", "Submitted",
];
export const BILLING_EXCEPTIONS: BillingException[] = ["On Hold", "No DCs Available", "Cancelled", "Correction Required"];
