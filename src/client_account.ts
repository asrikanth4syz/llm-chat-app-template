// Pure helpers for the Account / Location client model. No env/DB here, so these are
// unit-testable and the single source of truth for how a client+site is labelled.
// Account = the legal/billing entity (clients row); Location = a ship-to site.

export interface AccountLike { name?: unknown; legal_name?: unknown; display_name?: unknown; }
export interface LocationLike { display_name?: unknown; }

// The account's short label: display_name → legal_name → name.
export function accountLabel(a: AccountLike | null | undefined): string {
  const pick = (v: unknown) => (v == null ? "" : String(v).trim());
  return pick(a?.display_name) || pick(a?.legal_name) || pick(a?.name) || "";
}

// The label shown everywhere a client/site appears: "Account · Location". The location
// part is dropped when it is blank or identical to the account label (single default site).
export function clientDisplayLabel(a: AccountLike | null | undefined, loc?: LocationLike | null): string {
  const acc = accountLabel(a);
  const l = loc && loc.display_name != null ? String(loc.display_name).trim() : "";
  if (!l || l === acc) return acc;
  return `${acc} · ${l}`;
}

// Which location id should be default given a set of locations: the one already flagged,
// else the oldest/first. Used to keep exactly one default when seeding or editing.
export function resolveDefaultLocationId(
  locations: Array<{ id: string; is_default?: unknown }>,
): string | null {
  if (!locations || !locations.length) return null;
  const flagged = locations.find(l => Number(l.is_default) === 1);
  return (flagged || locations[0]).id;
}
