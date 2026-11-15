// Payroll core engine — PURE (no Worker/D1), unit-tested in isolation like policy.ts /
// attendance.ts. Money is INTEGER PAISE throughout; percent values are basis points (bps).
// Rounding is half-up, applied once per component, so a line reconciles to its breakdown.
//
// Scope (P6a): component expansion, loss-of-pay proration with a configurable divisor,
// effective-dated salary resolution incl. day-weighted mid-month revisions, net + exception
// detection. Statutory math and OT pay are NOT here (deferred phases) — the model leaves
// deduction components (zero-valued) and an OT hook for them.

import { daysInMonth } from "./attendance.ts";

/** Half-up rounding to the nearest integer paisa. */
export function roundPaise(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

export type DivisorMode = "calendar" | "fixed_30" | "fixed_26";

/** The denominator LOP/partial-month proration divides by. `calendar` = actual days in the
 *  month (reconciles with M1's payable_days = calendar − LOP); fixed_30 / fixed_26 are the
 *  common India conventions. */
export function divisorDays(ym: string, mode: DivisorMode): number {
  if (mode === "fixed_30") return 30;
  if (mode === "fixed_26") return 26;
  return daysInMonth(ym);
}

export interface SalaryComponent {
  code: string;
  name: string;
  kind: "earning" | "deduction";
  calcMethod: "fixed" | "percent_of_base";
  value: number;            // paise (fixed) | basis points (percent_of_base)
  baseCode?: string | null; // for percent_of_base
  prorates: boolean;        // reduce for loss-of-pay days?
  sequence: number;
}

export interface ExpandedComponent extends SalaryComponent {
  full: number; // full monthly amount in paise
}

/** Expand each component to its full monthly paise amount. percent_of_base resolves against
 *  the already-expanded earning named by baseCode, so base components must sort earlier
 *  (by `sequence`). Pure and order-stable. */
export function expandComponents(comps: SalaryComponent[]): ExpandedComponent[] {
  const ordered = [...comps].sort((a, b) => a.sequence - b.sequence);
  const byCode = new Map<string, number>();
  const out: ExpandedComponent[] = [];
  for (const c of ordered) {
    let full = 0;
    if (c.calcMethod === "percent_of_base") {
      const base = c.baseCode ? (byCode.get(c.baseCode) ?? 0) : 0;
      full = roundPaise((base * c.value) / 10000); // value is basis points
    } else {
      full = Math.max(0, Math.round(c.value));
    }
    byCode.set(c.code, full);
    out.push({ ...c, full });
  }
  return out;
}

/** Σ of the full earning components (the gross before proration). */
export function monthlyGross(comps: SalaryComponent[]): number {
  return expandComponents(comps).filter((c) => c.kind === "earning").reduce((s, c) => s + c.full, 0);
}

export interface LineComponent { code: string; name: string; kind: "earning" | "deduction" | "info"; amount: number; }
export type PayException = "negative_net" | "zero_pay" | null;

export interface PayLine {
  grossFull: number;      // Σ full earnings (nominal, before proration)
  grossPaid: number;      // Σ earnings actually earned after proration
  lopReduction: number;   // grossFull − grossPaid (loss-of-pay + unworked days)
  deductions: number;     // Σ deduction components (excl. the informational LOP line)
  net: number;            // grossPaid − deductions
  components: LineComponent[]; // earnings at PAID, deductions, + an informational LOP line
  exception: PayException;
}

export interface ProrationInput {
  employedDays: number;   // calendar days in the period within [joining, exit]
  lopDays: number;        // loss-of-pay (absent working) days within employment
  divisor: number;        // from divisorDays()
}

/** Compute one pay line for a SINGLE salary over the period. Earnings are shown at FULL and a
 *  single "Loss of pay" deduction captures the reduction, so the line stays transparent and
 *  still nets correctly. A prorating earning is reduced for both LOP and unworked days; a
 *  non-prorating earning (e.g. a fixed reimbursement) is reduced only for unworked days. */
export function computeLine(comps: SalaryComponent[], p: ProrationInput): PayLine {
  const exp = expandComponents(comps);
  const paidDays = Math.max(0, p.employedDays - p.lopDays);
  const div = p.divisor > 0 ? p.divisor : 1;
  const components: LineComponent[] = [];
  let grossFull = 0, grossPaid = 0, deductions = 0;
  for (const c of exp) {
    if (c.kind === "earning") {
      grossFull += c.full;
      // prorating earnings reduce for LOP + unworked; others only for unworked (employedDays).
      const num = c.prorates ? paidDays : p.employedDays;
      const paid = Math.min(c.full, roundPaise((c.full * num) / div));
      grossPaid += paid;
      components.push({ code: c.code, name: c.name, kind: "earning", amount: paid });
    } else {
      deductions += c.full;
      if (c.full !== 0) components.push({ code: c.code, name: c.name, kind: "deduction", amount: c.full });
    }
  }
  const lopReduction = Math.max(0, grossFull - grossPaid);
  if (lopReduction > 0) components.push({ code: "LOP", name: "Loss of pay", kind: "info", amount: lopReduction });
  const net = grossPaid - deductions;
  const exception: PayException = net < 0 ? "negative_net" : (paidDays <= 0 ? "zero_pay" : null);
  return { grossFull, grossPaid, lopReduction, deductions, net, components, exception };
}

/** Combine the per-segment pay lines of one employee-month (day-weighted mid-month
 *  revisions) into a single line. Earnings/deductions aggregate by code; totals sum; the
 *  exception is re-derived from the combined totals. Pure. */
export function aggregatePayLines(parts: PayLine[]): PayLine {
  const byCode = new Map<string, LineComponent>();
  let grossFull = 0, grossPaid = 0, deductions = 0;
  for (const pl of parts) {
    grossFull += pl.grossFull; grossPaid += pl.grossPaid; deductions += pl.deductions;
    for (const c of pl.components) {
      const prev = byCode.get(c.code);
      if (prev) prev.amount += c.amount;
      else byCode.set(c.code, { ...c });
    }
  }
  const lopReduction = Math.max(0, grossFull - grossPaid);
  const net = grossPaid - deductions;
  const exception: PayException = net < 0 ? "negative_net" : (grossPaid <= 0 ? "zero_pay" : null);
  // keep a stable order: earnings, deductions, then the info LOP line
  const order = { earning: 0, deduction: 1, info: 2 } as const;
  const components = [...byCode.values()].sort((a, b) => order[a.kind] - order[b.kind]);
  return { grossFull, grossPaid, lopReduction, deductions, net, components, exception };
}

// ---- Effective-dated salary resolution (incl. day-weighted mid-month revision) ---------

export interface SalaryRevision { id: string; effectiveFrom: string; effectiveTo: string | null; }

/** YYYY-MM-DD → UTC epoch day number (timezone-independent). */
function epochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
/** Inclusive day count between two YYYY-MM-DD dates (0 if from > to). */
export function daysInclusive(fromISO: string, toISO: string): number {
  return Math.max(0, epochDay(toISO) - epochDay(fromISO) + 1);
}
function maxISO(a: string, b: string): string { return a >= b ? a : b; }
function minISO(a: string, b: string): string { return a <= b ? a : b; }

export interface SalarySegment { id: string; fromISO: string; toISO: string; days: number; }

/** Resolve which salary revision(s) apply across [periodStart, periodEnd], each clipped to
 *  the period AND to the employment window. One segment in the common case; two (or more)
 *  when a revision takes effect mid-period — enabling day-weighted proration. Pure. */
export function resolveSalarySegments(
  revisions: SalaryRevision[],
  periodStart: string,
  periodEnd: string,
  joining: string | null,
  exit: string | null,
): SalarySegment[] {
  const winStart = joining ? maxISO(periodStart, joining) : periodStart;
  const winEnd = exit ? minISO(periodEnd, exit) : periodEnd;
  if (winStart > winEnd) return []; // not employed during the period
  const segs: SalarySegment[] = [];
  for (const r of revisions) {
    const from = maxISO(winStart, r.effectiveFrom);
    const to = r.effectiveTo ? minISO(winEnd, r.effectiveTo) : winEnd;
    if (from > to) continue;
    segs.push({ id: r.id, fromISO: from, toISO: to, days: daysInclusive(from, to) });
  }
  return segs.sort((a, b) => (a.fromISO < b.fromISO ? -1 : 1));
}
