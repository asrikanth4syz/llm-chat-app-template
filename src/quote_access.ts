// ============================================================================
// Quotations (milestone 006) — PURE entitlement / capability decision core.
//
// No DB / no `env`: the "assign the feature to specific users, configurable"
// requirement lives here as deterministic functions the Worker handlers call
// (requireQuoteAccess, the admin quote-access PUT validation, every capability
// check, the GET /api/quotes/access body). Unit-tested in test/quote_access.test.ts.
//
// Authority: plans/active_milestones/006-quotations/{context,api-contracts,data-model}.md.
//
// Fail-closed everywhere (spec r2/r4): malformed config, unknown/typo'd role, or
// an unrecognised capability all resolve to NO ACCESS and FULL redaction.
// ============================================================================

export const QUOTE_ROLES = ["sales", "ops", "commercial_manager", "finance"] as const;
export type QuoteRole = (typeof QUOTE_ROLES)[number];

export const APPROVAL_LEGS = ["manager", "finance"] as const;
export type ApprovalLeg = (typeof APPROVAL_LEGS)[number];

export type QuoteCapability =
  | "view" | "calc" | "create_edit" | "submit" | "send"
  | "accept_lost" | "revise" | "convert" | "followup" | "snooze" | "audit_read" | "sees_cost";

/** Approver roles — the roles that own an approval leg (and may be a fallback). */
export const APPROVER_ROLES: readonly QuoteRole[] = ["commercial_manager", "finance"];

// ── Capability matrix (api-contracts §Capability matrix). Default-deny: a cap is
// granted only if listed here; an unknown role grants nothing. ───────────────
interface RoleCaps { caps: ReadonlySet<QuoteCapability>; approveLegs: readonly ApprovalLeg[]; }
const MATRIX: Record<QuoteRole, RoleCaps> = {
  sales: {
    caps: new Set<QuoteCapability>(["view", "calc", "create_edit", "submit", "send", "accept_lost", "revise", "convert", "followup", "snooze", "audit_read", "sees_cost"]),
    approveLegs: [],
  },
  ops: {
    // view + calc + follow-up/snooze only; NEVER sees cost/margin (always redacted).
    caps: new Set<QuoteCapability>(["view", "calc", "followup", "snooze", "audit_read"]),
    approveLegs: [],
  },
  commercial_manager: {
    caps: new Set<QuoteCapability>(["view", "calc", "create_edit", "submit", "send", "accept_lost", "revise", "convert", "followup", "snooze", "audit_read", "sees_cost"]),
    approveLegs: ["manager"],
  },
  finance: {
    // Finance may author/raise quotes too (product decision). SoD still holds at
    // act-time: a finance user who authored a quote cannot approve its finance leg.
    caps: new Set<QuoteCapability>(["view", "calc", "create_edit", "submit", "send", "accept_lost", "revise", "convert", "followup", "snooze", "audit_read", "sees_cost"]),
    approveLegs: ["finance"],
  },
};

export class QuoteAccessError extends Error {
  code: string;
  status: number;
  field?: string;
  constructor(code: string, message: string, status: number, field?: string) {
    super(message);
    this.name = "QuoteAccessError";
    this.code = code;
    this.status = status;
    this.field = field;
  }
}

export function isQuoteRole(x: unknown): x is QuoteRole {
  return typeof x === "string" && (QUOTE_ROLES as readonly string[]).includes(x);
}

/** Default-deny capability check. Unknown/invalid role → false (fail-closed). */
export function can(role: unknown, cap: QuoteCapability): boolean {
  if (!isQuoteRole(role)) return false;
  return MATRIX[role].caps.has(cap);
}

/** Does this role own the given approval leg? Unknown role → false. */
export function canApproveLeg(role: unknown, leg: ApprovalLeg): boolean {
  if (!isQuoteRole(role)) return false;
  return MATRIX[role].approveLegs.includes(leg);
}

/** True only for roles that see cost/margin. ops (and any unknown role) → false. */
export function seesCost(role: unknown): boolean {
  return can(role, "sees_cost");
}

export interface EnabledUsers {
  ver: number;
  users: Record<string, QuoteRole>;
}

/**
 * Parse the `quote.enabled_users:<account>` config blob, FAIL-CLOSED.
 * Malformed JSON, wrong shape, or an entry whose role is not a valid QuoteRole
 * all resolve to "that user is not entitled" (the whole feature is OFF when the
 * map is empty/unset). Returns the clean map + optimistic-concurrency `ver`.
 * `onWarn` lets the caller surface an admin-visible "config invalid" notice.
 */
export function parseEnabledUsers(raw: string | null | undefined, onWarn?: (msg: string) => void): EnabledUsers {
  const empty: EnabledUsers = { ver: 0, users: {} };
  if (!raw) return empty;
  let obj: any;
  try { obj = JSON.parse(raw); } catch { onWarn?.("quote.enabled_users is not valid JSON — feature treated as OFF"); return empty; }
  if (!obj || typeof obj !== "object" || typeof obj.users !== "object" || obj.users === null) {
    onWarn?.("quote.enabled_users has an unexpected shape — feature treated as OFF");
    return empty;
  }
  const ver = Number.isInteger(obj._ver) ? obj._ver : 0;
  const users: Record<string, QuoteRole> = {};
  for (const [uid, role] of Object.entries(obj.users)) {
    if (typeof uid === "string" && uid && isQuoteRole(role)) users[uid] = role;
    else onWarn?.(`quote.enabled_users: dropped invalid entry for "${uid}" (role=${String(role)})`);
  }
  return { ver, users };
}

/** The user's quote-role, or null if not entitled (fail-closed). */
export function resolveQuoteRole(enabled: EnabledUsers, userId: string): QuoteRole | null {
  const r = enabled.users[userId];
  return isQuoteRole(r) ? r : null;
}

/** Body of GET /api/quotes/access (exempt route): drives nav tile visibility. */
export function accessDecision(enabled: EnabledUsers, userId: string): { enabled: boolean; quoteRole: QuoteRole | null } {
  const quoteRole = resolveQuoteRole(enabled, userId);
  return { enabled: quoteRole !== null, quoteRole };
}

/**
 * The requireQuoteAccess decision for a guarded /api/quotes/* route. Returns the
 * caller's quoteRole, or throws a 404 (host hide-convention) when not entitled.
 */
export function requireQuoteAccessDecision(enabled: EnabledUsers, userId: string): { quoteRole: QuoteRole } {
  const quoteRole = resolveQuoteRole(enabled, userId);
  if (!quoteRole) throw new QuoteAccessError("E_NOT_ENTITLED", "quotations not enabled for this user", 404);
  return { quoteRole };
}

/**
 * Validate an admin PUT /api/admin/quote-access change (pure), returning the next
 * enabled-users map to persist. Enforces: role enum (422), optimistic `_ver`
 * (409), and "an admin may not grant an approver role to their OWN userId" (403).
 */
export function applyAccessChange(
  current: EnabledUsers,
  change: { userId: string; quoteRole: QuoteRole | null; expectedVer: number },
  actingUserId: string,
): EnabledUsers {
  if (!change.userId || typeof change.userId !== "string") {
    throw new QuoteAccessError("E_VALIDATION", "userId required", 422, "userId");
  }
  if (change.quoteRole !== null && !isQuoteRole(change.quoteRole)) {
    throw new QuoteAccessError("E_VALIDATION", `quoteRole must be null or one of ${QUOTE_ROLES.join("/")}`, 422, "quoteRole");
  }
  if (change.expectedVer !== current.ver) {
    throw new QuoteAccessError("E_VER_CONFLICT", `version conflict: expected ${current.ver}`, 409, "_ver");
  }
  // SoD-at-config: an admin cannot grant an approver role to themselves.
  if (change.userId === actingUserId && change.quoteRole !== null && APPROVER_ROLES.includes(change.quoteRole)) {
    throw new QuoteAccessError("E_SELF_GRANT", "an admin may not grant an approver role to their own account", 403, "userId");
  }
  const users = { ...current.users };
  if (change.quoteRole === null) delete users[change.userId];
  else users[change.userId] = change.quoteRole;
  return { ver: current.ver + 1, users };
}

/**
 * Validate a fallback approver id against the entitled set (api-contracts): it
 * must be an entitled user holding an approver role, else 422. `null` clears it.
 */
export function validateFallbackApprover(enabled: EnabledUsers, fallbackId: string | null): void {
  if (fallbackId === null || fallbackId === "") return;
  const role = resolveQuoteRole(enabled, fallbackId);
  if (!role || !APPROVER_ROLES.includes(role)) {
    throw new QuoteAccessError("E_VALIDATION", "fallback_approver_id must be an entitled user holding an approver role", 422, "fallback_approver_id");
  }
}

/** True if removing/demoting `targetUserId` would invalidate the current fallback. */
export function revokeBreaksFallback(fallbackId: string | null, next: EnabledUsers, targetUserId: string): boolean {
  if (!fallbackId || fallbackId !== targetUserId) return false;
  const role = resolveQuoteRole(next, targetUserId);
  return !role || !APPROVER_ROLES.includes(role);
}
