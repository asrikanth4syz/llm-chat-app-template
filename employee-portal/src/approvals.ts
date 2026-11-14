// FR-04 Approvals — pure helper for delegation windows. A delegation grants the
// delegate the delegator's approval authority only while it is active and today
// falls within its (optional) start/end bounds.
export interface DelegationWindow {
  active: number | boolean;
  startsOn: string | null;
  endsOn: string | null;
}

export function isDelegationActive(d: DelegationWindow, today: string): boolean {
  if (!d.active) return false;
  if (d.startsOn && today < d.startsOn) return false; // not started yet
  if (d.endsOn && today > d.endsOn) return false;     // already ended
  return true;
}
