// Pure finance logic for the per-client-location Budget & PO module.
// No env/DB/network — deterministic helpers the endpoints build on, and the unit
// tests pin: calendar financial year (Jan–Dec), the floor rule, the revision-status
// decision, PO balance/ledger math, and the warn-only order evaluation.

export type PeriodType = "Monthly" | "Quarterly" | "Yearly";

export interface PeriodWindow { type: PeriodType; start: string; end: string; label: string; }

const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function ymd(y: number, m0: number, d: number): string { return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function lastDay(y: number, m0: number): number { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }

// The financial year is the CALENDAR year (Jan–Dec). Quarters: Q1 Jan–Mar, Q2 Apr–Jun,
// Q3 Jul–Sep, Q4 Oct–Dec. `ref` is a Date or YYYY-MM-DD string (UTC); defaults to now.
export function periodWindow(type: PeriodType, ref?: string | Date): PeriodWindow {
  const d = ref == null ? new Date() : (ref instanceof Date ? ref : new Date(ref + "T00:00:00Z"));
  const y = d.getUTCFullYear(), m = d.getUTCMonth();
  if (type === "Quarterly") {
    const q = Math.floor(m / 3), sm = q * 3, em = sm + 2;
    return { type, start: ymd(y, sm, 1), end: ymd(y, em, lastDay(y, em)),
      label: `Q${q + 1} ${y} (${MON[sm]}–${MON[em]})` };
  }
  if (type === "Yearly") {
    return { type, start: ymd(y, 0, 1), end: ymd(y, 11, 31), label: `FY ${y}` };
  }
  return { type: "Monthly", start: ymd(y, m, 1), end: ymd(y, m, lastDay(y, m)), label: `${MON[m]} ${y}` };
}

// The start of the NEXT period after the one containing `ref` (used for "effective
// from start of next period").
export function nextPeriodStart(type: PeriodType, ref?: string | Date): string {
  const w = periodWindow(type, ref);
  const end = new Date(w.end + "T00:00:00Z");
  end.setUTCDate(end.getUTCDate() + 1);
  return ymd(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
}

// Floor rule: a budget can never be set below what is already committed + actual for
// the period. Returns the minimum allowed amount.
export function floorMinimum(committed: number, actual: number): number {
  return Math.max(0, (committed || 0) + (actual || 0));
}

export interface AmountCheck { ok: boolean; floor: number; error?: string; }
export function validateBudgetAmount(newAmount: number, committed: number, actual: number): AmountCheck {
  const floor = floorMinimum(committed, actual);
  if (!(newAmount >= 0)) return { ok: false, floor, error: "Enter a valid amount." };
  if (newAmount < floor) return { ok: false, floor, error: `Minimum allowed is ₹${Math.round(floor).toLocaleString("en-IN")}` };
  return { ok: true, floor };
}

export function changeDelta(oldAmount: number, newAmount: number): { delta: number; pct: number } {
  const delta = (newAmount || 0) - (oldAmount || 0);
  const pct = oldAmount ? Math.round((delta / oldAmount) * 100) : (newAmount ? 100 : 0);
  return { delta, pct };
}

export interface StatusInput {
  oldAmount: number; newAmount: number;
  effectiveKind: "now" | "next";
  approvalEnabled?: boolean; approver?: string | null; thresholdPct?: number;
}
// A revision is Applied immediately, or Pending. It is Pending when it is effective
// from the next period, or when approval is active (enabled + an approver nominated)
// and the change is at/over the threshold. (Statuses are only Applied | Pending.)
export function decideRevisionStatus(i: StatusInput): "applied" | "pending" {
  if (i.effectiveKind === "next") return "pending";
  const active = !!(i.approvalEnabled && i.approver);
  if (!active) return "applied";
  const { delta, pct } = changeDelta(i.oldAmount, i.newAmount);
  if (delta !== 0 && Math.abs(pct) >= (i.thresholdPct || 0)) return "pending";
  return "applied";
}

// ── Purchase orders ──────────────────────────────────────────────────
export interface PoLike { amount: number; committed: number; actual: number; }
export function poBalance(po: PoLike): number { return (po.amount || 0) - (po.committed || 0) - (po.actual || 0); }
export function poUsedPct(po: PoLike): number { return po.amount ? Math.round(((po.committed || 0) + (po.actual || 0)) / po.amount * 100) : 0; }

export type LedgerType = "commit" | "release" | "actual";
export interface LedgerEntry { type: LedgerType; amount: number; }
// The ledger is the source of truth for a PO's balances. A `commit` raises committed;
// a `release` lowers it (order cancelled/edited down); an `actual` moves an amount from
// committed to actual (invoiced/delivered). committed = Σcommit − Σrelease − Σactual.
export function summarizeLedger(entries: LedgerEntry[]): { committed: number; actual: number } {
  let commit = 0, release = 0, actual = 0;
  for (const e of entries || []) {
    if (e.type === "commit") commit += e.amount || 0;
    else if (e.type === "release") release += e.amount || 0;
    else if (e.type === "actual") actual += e.amount || 0;
  }
  return { committed: Math.max(0, commit - release - actual), actual };
}

// ── Order warn-only evaluation ───────────────────────────────────────
export interface OrderCheckInput {
  value: number; category?: string; today?: string | Date;
  po?: { no?: string; from?: string; to?: string; scope?: string[]; amount: number; committed: number; actual: number } | null;
  budgetRemaining?: number | null;
}
// Warnings only — never block. Returns human-readable messages for: order over PO
// balance, PO outside its validity window, category out of PO scope, and order over
// the remaining budget.
export function evaluateOrderWarnings(i: OrderCheckInput): string[] {
  const w: string[] = [];
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const today = i.today == null ? new Date() : (i.today instanceof Date ? i.today : new Date(i.today + "T00:00:00Z"));
  if (i.po) {
    const bal = poBalance(i.po);
    if (i.value > bal) w.push(`Order exceeds PO balance by ${inr(i.value - bal)}.`);
    if (i.po.from && new Date(i.po.from + "T00:00:00Z") > today) w.push(`PO ${i.po.no || ""} is not valid yet (from ${i.po.from}).`.replace("  ", " "));
    if (i.po.to && new Date(i.po.to + "T00:00:00Z") < today) w.push(`PO ${i.po.no || ""} has expired (to ${i.po.to}).`.replace("  ", " "));
    if (i.po.scope && i.po.scope.length && i.category && i.po.scope.indexOf(i.category) < 0)
      w.push(`Category "${i.category}" is out of this PO's scope (${i.po.scope.join(", ")}).`);
  }
  if (i.budgetRemaining != null && i.value > i.budgetRemaining)
    w.push(`Order exceeds remaining budget by ${inr(i.value - i.budgetRemaining)}.`);
  return w;
}
