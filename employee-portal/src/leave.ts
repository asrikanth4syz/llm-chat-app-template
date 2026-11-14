// FR-03 Leave — pure domain helpers (date math + balance checks). No Worker/D1,
// so these are unit-tested directly. Balances change only after approval; a request
// must fit within entitled − used − still-pending.

const DAY_MS = 86_400_000;

/** Strict YYYY-MM-DD validity (also rejects impossible dates like 2026-02-31). */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Inclusive calendar-day count. A half-day (0.5) is only meaningful for a single
 *  day. Returns 0 for an invalid or inverted range. Weekend/holiday-aware counting
 *  (per-location calendars) is a follow-up. */
export function countLeaveDays(startDate: string, endDate: string, halfDay = false): number {
  if (!isValidDate(startDate) || !isValidDate(endDate)) return 0;
  const s = Date.parse(`${startDate}T00:00:00Z`);
  const e = Date.parse(`${endDate}T00:00:00Z`);
  if (e < s) return 0;
  const days = Math.round((e - s) / DAY_MS) + 1;
  return halfDay && days === 1 ? 0.5 : days;
}

/** Days still available once already-used and still-pending are set aside. */
export function availableAfterPending(entitled: number, used: number, pending: number): number {
  return entitled - used - pending;
}

/** A new request fits only if it is positive and within the available balance. */
export function canTakeLeave(entitled: number, used: number, pending: number, requested: number): boolean {
  return requested > 0 && availableAfterPending(entitled, used, pending) >= requested;
}
