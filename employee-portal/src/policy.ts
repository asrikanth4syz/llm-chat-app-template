// R0 foundation — access-control core (RBAC + policy/PBAC), default deny.
//
// The rule that drives R0: every login sees strictly its OWN employee record;
// a manager additionally sees its team; HR/Finance/Auditor see all records for
// their function; SUPER_ADMIN sees everything. Sensitive fields (PAN, bank,
// Aadhaar, CTC) are shown only to the record's owner and to roles that hold the
// sensitive-read-all permission. Nothing is allowed unless a permission grants it.
//
// This module is PURE (no Worker/D1/network): it is the single source of truth
// for authorisation decisions and is unit-tested in isolation, so the IDOR
// safety net the PRD requires (D1 has no row-level security) lives here and is
// exercised directly.

export type Role =
  | "employee"
  | "manager"
  | "hr_admin"
  | "finance"
  | "it_admin"
  | "auditor"
  | "super_admin";

export type Permission =
  | "employee.read_own"
  | "employee.read_team"
  | "employee.read_all"
  | "employee.sensitive.read_own"
  | "employee.sensitive.read_all"
  | "audit.read"
  | "user.manage"
  | "profile.verify" // approve controlled bank/identity profile changes (FR-01)
  | "leave.approve_team" // approve leave for direct reports (FR-03/FR-04)
  | "leave.approve_all" // approve leave for anyone (HR function)
  | "attendance.manage" // import biometric data, administer attendance (FR-02)
  | "attendance.approve_team" // approve attendance corrections for direct reports
  | "attendance.approve_all" // approve attendance corrections for anyone
  | "helpdesk.agent" // view/handle non-POSH helpdesk tickets (FR-09)
  | "posh.manage"; // configure the POSH Internal Committee (FR-21) — super_admin only

// Role → permissions. Default deny: a role holds only what is listed here.
// super_admin is handled as an allow-all in `hasPermission`, so it never has to
// be enumerated and can never accidentally be under-provisioned.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  employee: ["employee.read_own", "employee.sensitive.read_own"],
  manager: ["employee.read_own", "employee.sensitive.read_own", "employee.read_team", "leave.approve_team", "attendance.approve_team"],
  hr_admin: ["employee.read_own", "employee.sensitive.read_own", "employee.read_all", "employee.sensitive.read_all", "profile.verify", "leave.approve_all", "attendance.manage", "attendance.approve_all", "helpdesk.agent"],
  finance: ["employee.read_own", "employee.sensitive.read_own", "employee.read_all", "employee.sensitive.read_all"],
  it_admin: ["employee.read_own", "employee.sensitive.read_own", "user.manage", "attendance.manage", "helpdesk.agent"],
  auditor: ["employee.read_own", "employee.read_all", "audit.read"],
  super_admin: [], // allow-all via hasPermission
};

// DEC-02 (extended to all users): two-factor auth is mandatory for EVERY role —
// employee and manager included, no exemptions. The second factor is still the dev
// stub (verifyOtp accepts 000000) until the real factor (TOTP / DLT mobile-OTP)
// replaces it; this enforces the 2FA flow for all logins now. To exempt a role
// later, add it to this list (kept empty on purpose: 2FA for all).
const MFA_EXEMPT_ROLES: Role[] = [];

export interface Actor {
  userId: string;
  employeeId: string | null; // the employee record this login maps to (null for pure admins)
  role: Role;
}

export interface EmployeeRecord {
  id: string;
  userId: string;
  managerId: string | null;
  segment: "office" | "client_site";
  name: string;
  workEmail: string;
  designation: string | null;
  location: string | null;
  photo?: string | null; // profile photo data URL; non-confidential, never masked
  // Sensitive — field-level encrypted at rest (NFR-03, R1); masked on read here.
  pan?: string | null;
  bankAccount?: string | null;
  aadhaarLast4?: string | null;
  ctc?: number | null;
}

const SENSITIVE_FIELDS = ["pan", "bankAccount", "aadhaarLast4", "ctc"] as const;
export type PublicEmployee = Omit<EmployeeRecord, (typeof SENSITIVE_FIELDS)[number]>;

// NFR-03: the identity/financial fields that are masked-by-default on display
// (ctc is sensitive but not masked — it is a number shown to those who may see it).
const MASKED_FIELDS = ["pan", "bankAccount", "aadhaarLast4"] as const;

/** Mask a value keeping only the last `keep` characters; a short value (<= keep)
 *  is fully masked so nothing leaks. "ABCDE1234F" → "••••••234F"; "1111" → "••••". */
export function maskValue(v: string, keep = 4): string {
  return v.length > keep ? "•".repeat(v.length - keep) + v.slice(-keep) : "•".repeat(v.length);
}

/** Mask the NFR-03 fields of a record, except any explicitly revealed (reveal-on-
 *  click). Caller must already have confirmed the actor may see the fields. Never
 *  mutates the input. */
export function maskEmployee(rec: EmployeeRecord, reveal: readonly string[] = []): EmployeeRecord {
  const show = new Set(reveal);
  const out: EmployeeRecord = { ...rec };
  for (const f of MASKED_FIELDS) {
    const v = out[f];
    if (!show.has(f) && typeof v === "string" && v.length > 0) out[f] = maskValue(v);
  }
  return out;
}

export function hasPermission(role: Role, perm: Permission): boolean {
  if (role === "super_admin") return true; // sees all details, by rule
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function requiresMfa(role: Role): boolean {
  return !MFA_EXEMPT_ROLES.includes(role); // every role requires a second factor (2FA for all)
}

function isSelf(actor: Actor, target: EmployeeRecord): boolean {
  return actor.employeeId != null && actor.employeeId === target.id;
}

function managesTarget(actor: Actor, target: EmployeeRecord): boolean {
  return actor.employeeId != null && target.managerId === actor.employeeId;
}

/** Can this actor read this employee's (non-sensitive) record at all? Default deny. */
export function canReadEmployee(actor: Actor, target: EmployeeRecord): boolean {
  if (isSelf(actor, target) && hasPermission(actor.role, "employee.read_own")) return true;
  if (hasPermission(actor.role, "employee.read_all")) return true;
  if (hasPermission(actor.role, "employee.read_team") && managesTarget(actor, target)) return true;
  return false;
}

/** Can this actor see the sensitive fields (PAN, bank, Aadhaar, CTC) of this record? */
export function canReadSensitive(actor: Actor, target: EmployeeRecord): boolean {
  if (isSelf(actor, target) && hasPermission(actor.role, "employee.sensitive.read_own")) return true;
  if (hasPermission(actor.role, "employee.sensitive.read_all")) return true;
  return false;
}

/** Can this actor approve/reject a leave request for this employee? Self-approval is
 *  always blocked (FR-04). HR (leave.approve_all) covers anyone; a manager
 *  (leave.approve_team) covers only direct reports. */
export function canApproveLeaveFor(actor: Actor, target: EmployeeRecord): boolean {
  if (actor.employeeId != null && actor.employeeId === target.id) return false; // no self-approval
  if (hasPermission(actor.role, "leave.approve_all")) return true;
  if (hasPermission(actor.role, "leave.approve_team") && managesTarget(actor, target)) return true;
  return false;
}

/** Can this actor approve/reject an attendance correction for this employee? Same
 *  shape as leave: team for a manager, all for HR, never self (FR-02/FR-04). */
export function canApproveAttendanceFor(actor: Actor, target: EmployeeRecord): boolean {
  if (actor.employeeId != null && actor.employeeId === target.id) return false; // no self-approval
  if (hasPermission(actor.role, "attendance.approve_all")) return true;
  if (hasPermission(actor.role, "attendance.approve_team") && managesTarget(actor, target)) return true;
  return false;
}

/** The subset of records this actor may list — self only for a plain employee,
 *  team for a manager, everything for super_admin / all-readers. */
export function visibleEmployees(actor: Actor, all: EmployeeRecord[]): EmployeeRecord[] {
  return all.filter((e) => canReadEmployee(actor, e));
}

/** Shape a record for display. An actor who may NOT see sensitive fields gets them
 *  stripped. An actor who MAY see them gets them masked by default (NFR-03); fields
 *  named in `opts.reveal` are returned in full (reveal-on-click — logged by the
 *  caller). Never mutates the input. */
export function redactEmployee(
  actor: Actor,
  rec: EmployeeRecord,
  opts: { reveal?: readonly string[] } = {},
): PublicEmployee | EmployeeRecord {
  if (canReadSensitive(actor, rec)) return maskEmployee(rec, opts.reveal ?? []);
  const out: Record<string, unknown> = { ...rec };
  for (const f of SENSITIVE_FIELDS) delete out[f];
  return out as PublicEmployee;
}

/** Machine-readable role → permissions (the G1 role-permission-scope artefact). */
export function permissionMatrix(): { role: Role; permissions: string[]; mfa: boolean }[] {
  return (Object.keys(ROLE_PERMISSIONS) as Role[]).map((r) => ({
    role: r,
    permissions: r === "super_admin" ? ["*"] : ROLE_PERMISSIONS[r],
    mfa: requiresMfa(r),
  }));
}

/** Access revocation: a token is valid only while its version matches the user's
 *  current token_version. Bumping the user's version kills every live session
 *  (exit or role change), giving an immediate revocation SLA. */
export function isSessionCurrent(tokenTokenVersion: unknown, userTokenVersion: number): boolean {
  return typeof tokenTokenVersion === "number" && tokenTokenVersion === userTokenVersion;
}

// FR-08 Directory — the public, non-confidential view of an employee, visible to any
// authenticated login. Salary, bank, PAN, Aadhaar and personal contact (phone,
// personal email, address) are excluded BY CONSTRUCTION here, not by redaction.
export interface DirectoryEntry {
  id: string; name: string; designation: string | null; location: string | null;
  segment: string; workEmail: string | null; managerName: string | null; photo: string | null;
}
export function toDirectoryEntry(e: {
  id: string; name: string; designation?: string | null; location?: string | null;
  segment?: string | null; workEmail?: string | null; managerName?: string | null; photo?: string | null;
}): DirectoryEntry {
  return {
    id: e.id, name: e.name, designation: e.designation ?? null, location: e.location ?? null,
    segment: e.segment ?? "office", workEmail: e.workEmail ?? null, managerName: e.managerName ?? null,
    photo: e.photo ?? null,
  };
}

export class ForbiddenError extends Error {
  action: string;
  constructor(action: string) {
    super(`forbidden: ${action}`);
    this.name = "ForbiddenError";
    this.action = action;
  }
}

/** Guard for a handler: throw ForbiddenError (→ 403 + audit) unless allowed. */
export function assertCanReadEmployee(actor: Actor, target: EmployeeRecord): void {
  if (!canReadEmployee(actor, target)) throw new ForbiddenError(`read employee ${target.id}`);
}
