// Employee lifecycle / tenure domain: last-working-day & notice math, tenure, and the
// Full-and-Final (F&F) settlement ESTIMATE. All money in paise; all dates YYYY-MM-DD.
//
// Everything here is pure and unit-tested. The F&F worksheet is REVIEW-ONLY — it is never
// posted to a payroll run. The exact bases (basic/DA split, leave-encashment policy, the
// gratuity exemption and its wage base) are CA/HR decisions, so the output is explicitly an
// estimate and the handler records which basis it used.
import { roundPaise } from "./payroll.ts";

function epochDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}
/** YYYY-MM-DD shifted by n days (UTC, timezone-independent). */
export function addDaysISO(iso: string, n: number): string {
  const t = new Date((epochDay(iso) + n) * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Suggested last working day = tender date + required notice days. Notice is counted from
 *  the day after tendering, so serving exactly `noticeDays` lands on this LWD. */
export function suggestLWD(resignationDate: string, noticeDays: number): string {
  return addDaysISO(resignationDate, Math.max(0, Math.round(noticeDays || 0)));
}

/** Notice actually served = days between the tender date and the accepted LWD (0 if LWD is
 *  on/before the tender date). */
export function servedNoticeDays(resignationDate: string, acceptedLwd: string): number {
  return Math.max(0, epochDay(acceptedLwd) - epochDay(resignationDate));
}
/** Shortfall = required notice minus notice served (0 when the full notice is served). */
export function noticeShortfallDays(requiredNoticeDays: number, resignationDate: string, acceptedLwd: string): number {
  return Math.max(0, Math.round(requiredNoticeDays || 0) - servedNoticeDays(resignationDate, acceptedLwd));
}

/** Whole completed months of continuous service between two dates. */
export function completedMonths(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) months--;
  return Math.max(0, months);
}
/** Whole completed years of continuous service. */
export function completedYears(fromISO: string, toISO: string): number {
  return Math.floor(completedMonths(fromISO, toISO) / 12);
}
/** Years counted for gratuity: completed years, plus one if the trailing part-year exceeds
 *  six months (Payment of Gratuity Act, s.4(2)). */
export function gratuityYears(doj: string, lwd: string): number {
  const months = completedMonths(doj, lwd);
  const years = Math.floor(months / 12);
  const trailing = months - years * 12;
  return years + (trailing > 6 ? 1 : 0);
}
/** Gratuity applies after 5 years of continuous service (s.4(1)). */
export function gratuityEligible(doj: string, lwd: string): boolean {
  return completedYears(doj, lwd) >= 5;
}
/** Estimated gratuity = (15 / 26) × last-drawn (basic+DA) × gratuity years. 0 if ineligible. */
export function gratuityEstimatePaise(lastDrawnBasicDaPaise: number, doj: string, lwd: string): number {
  if (!gratuityEligible(doj, lwd)) return 0;
  return roundPaise(lastDrawnBasicDaPaise * 15 * gratuityYears(doj, lwd) / 26);
}

/** A per-day amount = monthly basis ÷ divisor days (kept fractional; round at the line). */
export function perDayPaise(monthlyBasisPaise: number, divisor: number): number {
  return divisor > 0 ? monthlyBasisPaise / divisor : 0;
}

export interface FnFInput {
  doj: string | null;             // date of joining (for tenure/gratuity)
  lwd: string;                    // accepted last working day
  resignationDate: string;        // tender date
  requiredNoticeDays: number;     // the employee's notice-period term
  monthlyGrossPaise: number;      // current monthly gross (final-month salary + notice recovery)
  encashBasisPaise: number;       // monthly basis for leave encashment (basic+DA or gross)
  gratuityBasisPaise: number;     // last-drawn monthly basic+DA (or gross) for gratuity
  salaryDivisor: number;          // divisor days for salary proration (payroll divisor)
  encashDivisor: number;          // divisor days for encashment per-day (policy; often 26 or 30)
  finalMonthPayableDays: number;  // days earned & unpaid in the final month (to LWD)
  encashableLeaveDays: number;    // encashable leave balance (e.g. EL available)
  recoverNoticeShortfall: boolean;// recover pay for un-served notice (HR toggle)
}
export interface FnFLine { code: string; label: string; kind: "earning" | "deduction"; amountPaise: number; note?: string; }
export interface FnFWorksheet {
  tenure: { completedYears: number; gratuityYears: number };
  gratuity: { eligible: boolean; years: number; estimatePaise: number };
  noticeShortfallDays: number;
  servedNoticeDays: number;
  lines: FnFLine[];
  earningsPaise: number;
  deductionsPaise: number;
  estimatedNetPaise: number;
  disclaimer: string;
}

/** Assemble the F&F settlement estimate. Pure — all inputs resolved by the caller. */
export function computeFnF(inp: FnFInput): FnFWorksheet {
  const doj = inp.doj || inp.lwd; // no DOJ → zero tenure (lwd..lwd)
  const lines: FnFLine[] = [];

  const finalSalary = roundPaise(perDayPaise(inp.monthlyGrossPaise, inp.salaryDivisor) * Math.max(0, inp.finalMonthPayableDays));
  if (inp.finalMonthPayableDays > 0) {
    lines.push({ code: "FINAL_SALARY", label: "Earned salary — final month to LWD", kind: "earning", amountPaise: finalSalary, note: `${inp.finalMonthPayableDays} day(s) ÷ ${inp.salaryDivisor}` });
  }

  if (inp.encashableLeaveDays > 0) {
    const encash = roundPaise(perDayPaise(inp.encashBasisPaise, inp.encashDivisor) * inp.encashableLeaveDays);
    lines.push({ code: "LEAVE_ENCASH", label: "Leave encashment", kind: "earning", amountPaise: encash, note: `${inp.encashableLeaveDays} day(s) ÷ ${inp.encashDivisor}` });
  }

  const gratuity = gratuityEstimatePaise(inp.gratuityBasisPaise, doj, inp.lwd);
  if (gratuity > 0) {
    lines.push({ code: "GRATUITY", label: "Gratuity (estimate)", kind: "earning", amountPaise: gratuity, note: `${gratuityYears(doj, inp.lwd)} yr × 15/26` });
  }

  const shortfall = noticeShortfallDays(inp.requiredNoticeDays, inp.resignationDate, inp.lwd);
  if (inp.recoverNoticeShortfall && shortfall > 0) {
    const recovery = roundPaise(perDayPaise(inp.monthlyGrossPaise, inp.salaryDivisor) * shortfall);
    lines.push({ code: "NOTICE_RECOVERY", label: "Notice shortfall recovery", kind: "deduction", amountPaise: recovery, note: `${shortfall} day(s) ÷ ${inp.salaryDivisor}` });
  }

  const earningsPaise = lines.filter((l) => l.kind === "earning").reduce((s, l) => s + l.amountPaise, 0);
  const deductionsPaise = lines.filter((l) => l.kind === "deduction").reduce((s, l) => s + l.amountPaise, 0);
  return {
    tenure: { completedYears: completedYears(doj, inp.lwd), gratuityYears: gratuityYears(doj, inp.lwd) },
    gratuity: { eligible: gratuityEligible(doj, inp.lwd), years: gratuityYears(doj, inp.lwd), estimatePaise: gratuity },
    noticeShortfallDays: shortfall,
    servedNoticeDays: servedNoticeDays(inp.resignationDate, inp.lwd),
    lines,
    earningsPaise,
    deductionsPaise,
    estimatedNetPaise: earningsPaise - deductionsPaise,
    disclaimer: "Estimate for HR/finance review — not posted to payroll. Bases (basic/DA, leave-encashment policy, gratuity wage base & exemption) are subject to CA/HR confirmation.",
  };
}

// Default onboarding / offboarding checklist templates. HR seeds these per employee; items
// are then ticked off. item_code is stable; label is the seeded English text (display uses it).
export const ONBOARDING_ITEMS: { code: string; label: string }[] = [
  { code: "collect_pan", label: "Collect PAN" },
  { code: "collect_aadhaar", label: "Collect Aadhaar" },
  { code: "collect_bank", label: "Collect bank details + cancelled cheque" },
  { code: "collect_photo", label: "Collect photo" },
  { code: "collect_education", label: "Collect education & experience certificates" },
  { code: "signed_offer", label: "Signed offer / appointment letter" },
  { code: "emergency_contact", label: "Emergency contact on file" },
  { code: "it_setup", label: "IT setup — email, devices, access" },
  { code: "probation_setup", label: "Probation period & review date set" },
  { code: "induction", label: "Induction / orientation completed" },
];
export const OFFBOARDING_ITEMS: { code: string; label: string }[] = [
  { code: "resignation_accepted", label: "Resignation accepted & LWD set" },
  { code: "handover", label: "Work handover completed" },
  { code: "return_assets", label: "Company assets returned (laptop, ID, SIM)" },
  { code: "revoke_access", label: "Access revoked — email, systems, building" },
  { code: "clearance_finance", label: "Finance clearance (advances, dues)" },
  { code: "clearance_admin", label: "Admin/HR clearance" },
  { code: "fnf_settled", label: "Full & final settlement processed" },
  { code: "exp_relieving_letter", label: "Experience & relieving letter issued" },
];
