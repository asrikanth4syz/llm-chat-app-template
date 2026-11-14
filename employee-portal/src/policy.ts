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
  | "audit.read";

// Role → permissions. Default deny: a role holds only what is listed here.
// super_admin is handled as an allow-all in `hasPermission`, so it never has to
// be enumerated and can never accidentally be under-provisioned.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  employee: ["employee.read_own", "employee.sensitive.read_own"],
  manager: ["employee.read_own", "employee.sensitive.read_own", "employee.read_team"],
  hr_admin: ["employee.read_own", "employee.sensitive.read_own", "employee.read_all", "employee.sensitive.read_all"],
  finance: ["employee.read_own", "employee.sensitive.read_own", "employee.read_all", "employee.sensitive.read_all"],
  it_admin: ["employee.read_own", "employee.sensitive.read_own"],
  auditor: ["employee.read_own", "employee.read_all", "audit.read"],
  super_admin: [], // allow-all via hasPermission
};

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
  // Sensitive — field-level encrypted at rest (NFR-03, R1); masked on read here.
  pan?: string | null;
  bankAccount?: string | null;
  aadhaarLast4?: string | null;
  ctc?: number | null;
}

const SENSITIVE_FIELDS = ["pan", "bankAccount", "aadhaarLast4", "ctc"] as const;
export type PublicEmployee = Omit<EmployeeRecord, (typeof SENSITIVE_FIELDS)[number]>;

export function hasPermission(role: Role, perm: Permission): boolean {
  if (role === "super_admin") return true; // sees all details, by rule
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
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

/** The subset of records this actor may list — self only for a plain employee,
 *  team for a manager, everything for super_admin / all-readers. */
export function visibleEmployees(actor: Actor, all: EmployeeRecord[]): EmployeeRecord[] {
  return all.filter((e) => canReadEmployee(actor, e));
}

/** Strip sensitive fields unless the actor may see them. Never mutates the input. */
export function redactEmployee(actor: Actor, rec: EmployeeRecord): PublicEmployee | EmployeeRecord {
  if (canReadSensitive(actor, rec)) return { ...rec };
  const out: Record<string, unknown> = { ...rec };
  for (const f of SENSITIVE_FIELDS) delete out[f];
  return out as PublicEmployee;
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
