// 4SYZ Employee Portal — R0 foundation Worker.
// Separate identity realm from SmartPantry. Every employee-data response is
// scoped through the policy engine (src/policy.ts): a login sees strictly its
// own record, a manager its team, HR/Finance/Auditor all, super_admin everything
// — and sensitive fields are masked by default (NFR-03), revealed only on request
// and logged. D1 has no row-level security, so EVERY scope check lives here and is
// unit-tested; access and denials are written to an append-only audit log. 2FA is
// enforced for ALL roles (DEC-02, extended), bank/PAN/Aadhaar are encrypted at rest
// (fieldcrypto.ts), and sessions are revocable within the SLA via a per-user token
// version. FR-01 profile changes to identity/financial fields need HR verification.
import {
  type Actor,
  type EmployeeRecord,
  type Role,
  canReadSensitive,
  canReadEmployee,
  visibleEmployees,
  redactEmployee,
  hasPermission,
  requiresMfa,
  permissionMatrix,
  isSessionCurrent,
  canApproveLeaveFor,
  canApproveAttendanceFor,
  canAssignTaskTo,
  canApprovePayroll,
  toDirectoryEntry,
} from "./policy.ts";
import { signJwt, verifyJwt, checkPassword, verifyOtp } from "./auth.ts";
import { encryptField, decryptField } from "./fieldcrypto.ts";
import { countLeaveDays, canTakeLeave } from "./leave.ts";
import { type AttendanceDay, hhmmToMinutes, dayExceptions, summarize, payrollInput, workingDaysInMonth } from "./attendance.ts";
import { isDelegationActive } from "./approvals.ts";
import { isValidCategory, isValidStatus, slaDueISO, isOverdue, canViewTicket, canHandleTicket } from "./helpdesk.ts";
import { isValidAudience, audienceMatches } from "./announcements.ts";
import { isValidTaskStatus, isValidPriority, taskOverdue } from "./tasks.ts";
import { isValidDocCategory, isValidDocStatus, canViewDocument } from "./documents.ts";
import { monthlyGross, computeLine, aggregatePayLines, resolveSalarySegments, divisorDays, ptForState, tdsMonthly, fyOf, fyMonthsRemaining, type SalaryComponent, type DivisorMode, type PayLine, type SalaryRevision, type PTConfig, type TDSConfig } from "./payroll.ts";
import { suggestLWD, computeFnF, ONBOARDING_ITEMS, OFFBOARDING_ITEMS, type FnFInput } from "./lifecycle.ts";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FIELD_ENC_KEY?: string; // NFR-03 AES-GCM key (base64 of 32 bytes); a Worker secret
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

function uid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// Full employee-master column list (shared by loadEmployee + handleList to avoid drift).
const EMP_COLS = "id,user_id,manager_id,segment,name,work_email,designation,location,photo," +
  "employee_code,first_name,last_name,dob,gender,department,employment_type,employment_status," +
  "phone,personal_email,address,emergency_contact,date_of_joining,date_of_exit," +
  "probation_start,probation_end,confirmed_on,contract_start,contract_end,exit_reason,exit_status," +
  "emergency_contact_2,notice_period_days,bank_payee_name,bank_ifsc,bank_account_type,bank_name,bank_verified," +
  "(bank_proof IS NOT NULL AND bank_proof != '') AS has_bank_proof,pan,bank_account,aadhaar_last4,ctc";
interface EmpRow {
  id: string; user_id: string; manager_id: string | null; segment: string; name: string;
  work_email: string; designation: string | null; location: string | null; photo: string | null;
  employee_code: string | null; first_name: string | null; last_name: string | null; dob: string | null;
  gender: string | null; department: string | null; employment_type: string | null; employment_status: string | null;
  phone: string | null; personal_email: string | null; address: string | null; emergency_contact: string | null;
  date_of_joining: string | null; date_of_exit: string | null;
  probation_start: string | null; probation_end: string | null; confirmed_on: string | null;
  contract_start: string | null; contract_end: string | null; exit_reason: string | null; exit_status: string | null;
  emergency_contact_2: string | null; notice_period_days: number | null;
  bank_payee_name: string | null; bank_ifsc: string | null; bank_account_type: string | null; bank_name: string | null;
  bank_verified: number | null; has_bank_proof: number | null;
  pan: string | null; bank_account: string | null; aadhaar_last4: string | null; ctc: number | null;
}
function rowToEmployee(r: EmpRow): EmployeeRecord {
  return {
    id: r.id, userId: r.user_id, managerId: r.manager_id,
    segment: r.segment === "client_site" ? "client_site" : "office",
    name: r.name, workEmail: r.work_email, designation: r.designation, location: r.location, photo: r.photo,
    employeeCode: r.employee_code, firstName: r.first_name, lastName: r.last_name, dob: r.dob, gender: r.gender,
    department: r.department, employmentType: r.employment_type, employmentStatus: r.employment_status,
    phone: r.phone, personalEmail: r.personal_email, address: r.address, emergencyContact: r.emergency_contact,
    dateOfJoining: r.date_of_joining, dateOfExit: r.date_of_exit,
    probationStart: r.probation_start, probationEnd: r.probation_end, confirmedOn: r.confirmed_on,
    contractStart: r.contract_start, contractEnd: r.contract_end, exitReason: r.exit_reason, exitStatus: r.exit_status,
    emergencyContact2: r.emergency_contact_2, noticePeriodDays: r.notice_period_days,
    bankPayeeName: r.bank_payee_name, bankIfsc: r.bank_ifsc, bankAccountType: r.bank_account_type, bankName: r.bank_name,
    bankVerified: !!r.bank_verified, hasBankProof: !!r.has_bank_proof,
    pan: r.pan, bankAccount: r.bank_account, aadhaarLast4: r.aadhaar_last4, ctc: r.ctc,
  };
}

// NFR-03: decrypt the at-rest sensitive fields into plaintext in memory before the
// policy engine masks/redacts them. Legacy plaintext (scaffold seed) passes through
// unchanged and needs no key.
async function decryptEmployee(env: Env, e: EmployeeRecord): Promise<EmployeeRecord> {
  const key = env.FIELD_ENC_KEY;
  const [pan, bankAccount, aadhaarLast4] = await Promise.all([
    decryptField(e.pan ?? null, key),
    decryptField(e.bankAccount ?? null, key),
    decryptField(e.aadhaarLast4 ?? null, key),
  ]);
  return { ...e, pan, bankAccount, aadhaarLast4 };
}

// reveal-on-click: ?reveal=pan,bankAccount,aadhaarLast4 → fields to return in full
// (and to log, NFR-03). Unknown names are ignored.
const REVEALABLE = new Set(["pan", "bankAccount", "aadhaarLast4"]);
function parseReveal(url: URL): string[] {
  const raw = url.searchParams.get("reveal");
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => REVEALABLE.has(s));
}

// FR-01: profile fields an employee may edit DIRECTLY (self-service). API → column.
const DIRECT_PROFILE_FIELDS: Record<string, string> = {
  phone: "phone", personalEmail: "personal_email", address: "address", emergencyContact: "emergency_contact",
};
// Identity/financial fields that require verification before applying (FR-01). Their
// new value is encrypted at rest (NFR-03). API → column.
const VERIFIED_PROFILE_FIELDS: Record<string, string> = {
  bankAccount: "bank_account", pan: "pan", aadhaarLast4: "aadhaar_last4",
};

async function audit(env: Env, actorUserId: string, action: string, resource: string, resourceId: string | null, detail: string): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, resource, resource_id, detail) VALUES (?,?,?,?,?,?)"
    ).bind(uid(), actorUserId, action, resource, resourceId, detail).run();
  } catch { /* audit must never break the request path */ }
}

// Resolve the bearer token to an Actor (user + role + their employee record id).
// A token is rejected if the user is inactive or its version is stale (revoked).
async function getActor(request: Request, env: Env): Promise<Actor | null> {
  const authz = request.headers.get("Authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || typeof payload.sub !== "string") return null;
  const row = await env.DB.prepare(
    "SELECT id, role, employee_id, active, token_version FROM users WHERE id = ?"
  ).bind(payload.sub).first<{ id: string; role: string; employee_id: string | null; active: number; token_version: number }>();
  if (!row || !row.active) return null;
  if (!isSessionCurrent(payload.tv, row.token_version)) return null; // revoked / role changed
  return { userId: row.id, employeeId: row.employee_id, role: row.role as Role };
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string; otp?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !body.password) return json({ error: "email and password required" }, 400);
  const row = await env.DB.prepare(
    "SELECT id, password_hash, role, employee_id, active, token_version, lang FROM users WHERE lower(email) = ? AND realm = 'employee-portal'"
  ).bind(email).first<{ id: string; password_hash: string; role: string; employee_id: string | null; active: number; token_version: number; lang: string | null }>();
  if (!row || !row.active || !checkPassword(row.password_hash, body.password)) {
    return json({ error: "invalid credentials" }, 401);
  }
  // DEC-02 (extended): every role must present a second factor — 2FA for all users.
  if (requiresMfa(row.role as Role)) {
    if (!body.otp) return json({ error: "mfa required", mfa_required: true }, 401);
    if (!verifyOtp(body.otp)) return json({ error: "invalid mfa code", mfa_required: true }, 401);
  }
  const amr = requiresMfa(row.role as Role) ? ["pwd", "otp"] : ["pwd"];
  const token = await signJwt({ sub: row.id, role: row.role, tv: row.token_version, amr }, env.JWT_SECRET, 8 * 3600);
  await audit(env, row.id, "LOGIN", "session", null, `role ${row.role} amr ${amr.join("+")}`);
  return json({ token, role: row.role, lang: VALID_LANGS.has(row.lang ?? "") ? row.lang : "en" });
}

const VALID_LANGS = new Set(["en", "hi", "kn"]);

// Persist the signed-in user's preferred UI language on their profile (quick win:
// language follows the user across devices/logins, not just the browser).
async function handleSetLang(actor: Actor, env: Env, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as { lang?: string };
  const lang = String(b.lang ?? "").trim();
  if (!VALID_LANGS.has(lang)) return json({ error: "unsupported language" }, 400);
  await env.DB.prepare("UPDATE users SET lang = ? WHERE id = ?").bind(lang, actor.userId).run();
  return json({ ok: true, lang });
}

async function loadEmployee(env: Env, id: string): Promise<EmployeeRecord | null> {
  const r = await env.DB.prepare(
    `SELECT ${EMP_COLS} FROM employees WHERE id = ?`
  ).bind(id).first<EmpRow>();
  return r ? await decryptEmployee(env, rowToEmployee(r)) : null;
}

async function handleMe(actor: Actor, env: Env, reveal: string[]): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const rec = await loadEmployee(env, actor.employeeId);
  if (!rec) return json({ error: "not found" }, 404);
  if (reveal.length && canReadSensitive(actor, rec)) {
    await audit(env, actor.userId, "REVEAL", "employee", rec.id, `revealed ${reveal.join(",")} (own)`);
  }
  // own record: sensitive fields masked by default (NFR-03), revealed on request.
  const lr = await env.DB.prepare("SELECT lang FROM users WHERE id = ?").bind(actor.userId).first<{ lang: string | null }>();
  return json({ employee: redactEmployee(actor, rec, { reveal }), lang: VALID_LANGS.has(lr?.lang ?? "") ? lr!.lang : "en" });
}

async function handleList(actor: Actor, env: Env): Promise<Response> {
  // Load the candidate set by role, THEN filter through the policy engine (never
  // trust the query alone). A plain employee only ever loads their own row.
  const cols = EMP_COLS;
  let rows: EmpRow[] = [];
  if (hasPermission(actor.role, "employee.read_all")) {
    rows = (await env.DB.prepare(`SELECT ${cols} FROM employees`).all<EmpRow>()).results;
  } else if (hasPermission(actor.role, "employee.read_team") && actor.employeeId) {
    rows = (await env.DB.prepare(`SELECT ${cols} FROM employees WHERE id = ? OR manager_id = ?`).bind(actor.employeeId, actor.employeeId).all<EmpRow>()).results;
  } else if (actor.employeeId) {
    rows = (await env.DB.prepare(`SELECT ${cols} FROM employees WHERE id = ?`).bind(actor.employeeId).all<EmpRow>()).results;
  }
  // Decrypt at-rest sensitive fields, then filter + mask through the policy engine.
  const employees = await Promise.all(rows.map((r) => decryptEmployee(env, rowToEmployee(r))));
  const visible = visibleEmployees(actor, employees);
  await audit(env, actor.userId, "LIST", "employee", null, `${visible.length} records`);
  return json({ employees: visible.map((e) => redactEmployee(actor, e)), count: visible.length });
}

async function handleGetOne(actor: Actor, env: Env, id: string, reveal: string[]): Promise<Response> {
  const rec = await loadEmployee(env, id);
  if (!rec) return json({ error: "not found" }, 404);
  if (!canReadEmployee(actor, rec)) {
    await audit(env, actor.userId, "DENY", "employee", id, "read denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  if (canReadSensitive(actor, rec)) {
    if (reveal.length) await audit(env, actor.userId, "REVEAL", "employee", id, `revealed ${reveal.join(",")}`);
    else await audit(env, actor.userId, "READ_SENSITIVE", "employee", id, "sensitive fields (masked by default)");
  } else {
    await audit(env, actor.userId, "READ", "employee", id, "non-sensitive");
  }
  return json({ employee: redactEmployee(actor, rec, { reveal }) });
}

interface DirRow { id: string; name: string; designation: string | null; location: string | null; segment: string; work_email: string | null; manager_name: string | null; photo: string | null; }

// FR-08 Directory — any login may search non-confidential contact/org fields of all
// employees. Sensitive columns (pan/bank/aadhaar/ctc) and personal contact are never
// selected, so there is nothing to redact.
async function handleDirectory(env: Env, q: string): Promise<Response> {
  const base = "SELECT e.id, e.name, e.designation, e.location, e.segment, e.work_email, e.photo, m.name AS manager_name FROM employees e LEFT JOIN employees m ON m.id = e.manager_id";
  const term = q.trim().toLowerCase();
  let rows: DirRow[];
  if (term) {
    const like = `%${term}%`;
    rows = (await env.DB.prepare(base + " WHERE lower(e.name) LIKE ?1 OR lower(e.designation) LIKE ?1 OR lower(e.location) LIKE ?1 ORDER BY e.name LIMIT 500").bind(like).all<DirRow>()).results;
  } else {
    rows = (await env.DB.prepare(base + " ORDER BY e.name LIMIT 500").all<DirRow>()).results;
  }
  const entries = rows.map((r) => toDirectoryEntry({ id: r.id, name: r.name, designation: r.designation, location: r.location, segment: r.segment, workEmail: r.work_email, managerName: r.manager_name, photo: r.photo }));
  return json({ entries, count: entries.length });
}

async function handleAudit(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "audit.read")) return json({ error: "forbidden" }, 403);
  const rows = (await env.DB.prepare("SELECT id,actor_user_id,action,resource,resource_id,detail,at FROM audit_log ORDER BY at DESC LIMIT 200").all()).results;
  return json({ entries: rows });
}

// The role → permission matrix (G1 role-permission-scope artefact), readable by
// roles that administer access or audit it.
async function handleMatrix(actor: Actor, env: Env): Promise<Response> {
  if (!(hasPermission(actor.role, "user.manage") || hasPermission(actor.role, "audit.read"))) {
    return json({ error: "forbidden" }, 403);
  }
  await audit(env, actor.userId, "READ", "policy_matrix", null, "viewed role-permission matrix");
  return json({ matrix: permissionMatrix() });
}

// Access revocation: bump a user's token_version to invalidate every live session
// immediately (exit or role change), and optionally deactivate the login.
async function handleRevoke(actor: Actor, env: Env, targetUserId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "user.manage")) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({})) as { deactivate?: boolean };
  const res = await env.DB.prepare(
    "UPDATE users SET token_version = token_version + 1, active = CASE WHEN ?1 THEN 0 ELSE active END WHERE id = ?2"
  ).bind(body.deactivate ? 1 : 0, targetUserId).run();
  const changed = (res.meta?.changes as number) ?? 0;
  if (!changed) return json({ error: "user not found" }, 404);
  await audit(env, actor.userId, "REVOKE", "user", targetUserId, body.deactivate ? "sessions killed + deactivated" : "sessions killed");
  return json({ ok: true, revoked: targetUserId, deactivated: !!body.deactivate });
}

// FR-01 Profile — viewing own profile is GET /api/me. Here: submit controlled
// changes. Direct self-service fields apply immediately (audited); identity/
// financial fields (bank, PAN, Aadhaar) are stored ENCRYPTED (NFR-03) in a pending
// request and must be verified by HR/super_admin before they apply (step-up auth
// on these arrives in R2/FR-26).
async function handleProfileChange(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const body = await request.json().catch(() => ({})) as { field?: string; value?: string; reason?: string };
  const field = (body.field || "").trim();
  const value = typeof body.value === "string" ? body.value : "";
  if (!field) return json({ error: "field required" }, 400);

  if (field in DIRECT_PROFILE_FIELDS) {
    const col = DIRECT_PROFILE_FIELDS[field];
    // "Enter once" (FR-01): if the field is still blank the employee may fill it directly
    // (onboarding). Once it holds a value, every later change needs admin approval — it is
    // queued as a pending request (plaintext value; these fields are not sensitive).
    const cur = await env.DB.prepare(`SELECT ${col} AS v FROM employees WHERE id = ?`).bind(actor.employeeId).first<{ v: string | null }>();
    const alreadySet = !!(cur && cur.v != null && String(cur.v).trim() !== "");
    if (!alreadySet) {
      await env.DB.prepare(`UPDATE employees SET ${col} = ? WHERE id = ?`).bind(value, actor.employeeId).run();
      await audit(env, actor.userId, "PROFILE_UPDATE", "employee", actor.employeeId, `set ${field} (first entry)`);
      return json({ ok: true, applied: true, field });
    }
    const reqId = uid();
    await env.DB.prepare(
      "INSERT INTO profile_change_requests (id, employee_id, user_id, field, new_value_enc, reason) VALUES (?,?,?,?,?,?)"
    ).bind(reqId, actor.employeeId, actor.userId, field, value, body.reason ?? null).run();
    await audit(env, actor.userId, "PROFILE_CHANGE_REQUEST", "employee", actor.employeeId, `requested ${field} change (pending approval)`);
    return json({ ok: true, applied: false, pending: true, requestId: reqId, field });
  }

  if (field in VERIFIED_PROFILE_FIELDS) {
    if (!env.FIELD_ENC_KEY) return json({ error: "field encryption not configured (set FIELD_ENC_KEY)" }, 501);
    const encrypted = await encryptField(value, env.FIELD_ENC_KEY);
    const reqId = uid();
    await env.DB.prepare(
      "INSERT INTO profile_change_requests (id, employee_id, user_id, field, new_value_enc, reason) VALUES (?,?,?,?,?,?)"
    ).bind(reqId, actor.employeeId, actor.userId, field, encrypted, body.reason ?? null).run();
    await audit(env, actor.userId, "PROFILE_CHANGE_REQUEST", "employee", actor.employeeId, `requested ${field} change (pending verification)`);
    return json({ ok: true, applied: false, pending: true, requestId: reqId, field });
  }

  return json({ error: `field not editable: ${field}` }, 400);
}

// An employee's own change requests. The encrypted new value is never returned.
async function handleProfileChanges(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ changes: [], count: 0 });
  const rows = (await env.DB.prepare(
    "SELECT id, field, status, reason, requested_at, reviewed_by, reviewed_at FROM profile_change_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 100"
  ).bind(actor.employeeId).all()).results;
  return json({ changes: rows, count: rows.length });
}

// The HR/super_admin verify queue: pending identity/financial changes across all
// employees (with the employee's name; the encrypted new value is never returned).
async function handlePendingChanges(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "profile.verify")) return json({ error: "forbidden" }, 403);
  const rows = (await env.DB.prepare(
    "SELECT p.id, p.employee_id, p.field, p.new_value_enc, p.status, p.reason, p.requested_at, e.name AS employee_name " +
    "FROM profile_change_requests p LEFT JOIN employees e ON e.id = p.employee_id " +
    "WHERE p.status = 'pending' ORDER BY p.requested_at ASC LIMIT 200"
  ).all<Record<string, unknown>>()).results;
  // Reveal the proposed value only for non-sensitive direct fields; verified fields
  // (bank/PAN/Aadhaar) keep their ciphertext hidden.
  const pending = rows.map((r) => {
    const newValue = (r.field as string) in DIRECT_PROFILE_FIELDS ? r.new_value_enc : null;
    const { new_value_enc, ...rest } = r;
    return { ...rest, newValue };
  });
  return json({ pending, count: pending.length });
}

// Verify (approve/reject) a pending identity/financial change — HR or super_admin.
// On approve the already-encrypted new value is copied into the employee record (the
// employee column and the request hold the same NFR-03 envelope), so no key is
// needed here. Self-approval is impossible: an employee role lacks profile.verify.
async function handleProfileChangeReview(actor: Actor, env: Env, id: string, action: "approve" | "reject"): Promise<Response> {
  if (!hasPermission(actor.role, "profile.verify")) return json({ error: "forbidden" }, 403);
  const req = await env.DB.prepare(
    "SELECT id, employee_id, field, new_value_enc, status FROM profile_change_requests WHERE id = ?"
  ).bind(id).first<{ id: string; employee_id: string; field: string; new_value_enc: string; status: string }>();
  if (!req) return json({ error: "not found" }, 404);
  if (req.status !== "pending") return json({ error: `already ${req.status}` }, 409);

  if (action === "approve") {
    // Verified fields hold a ciphertext envelope; direct fields hold plaintext — either way
    // the stored value is written straight into the column.
    const col = VERIFIED_PROFILE_FIELDS[req.field] || DIRECT_PROFILE_FIELDS[req.field];
    if (!col) return json({ error: `unknown field ${req.field}` }, 400);
    await env.DB.batch([
      env.DB.prepare(`UPDATE employees SET ${col} = ? WHERE id = ?`).bind(req.new_value_enc, req.employee_id),
      env.DB.prepare("UPDATE profile_change_requests SET status='approved', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?").bind(actor.userId, id),
    ]);
    await audit(env, actor.userId, "PROFILE_CHANGE_APPROVED", "employee", req.employee_id, `approved ${req.field} change`);
    return json({ ok: true, approved: true });
  }
  await env.DB.prepare("UPDATE profile_change_requests SET status='rejected', reviewed_by=?, reviewed_at=datetime('now') WHERE id=?")
    .bind(actor.userId, id).run();
  await audit(env, actor.userId, "PROFILE_CHANGE_REJECTED", "employee", req.employee_id, `rejected ${req.field} change`);
  return json({ ok: true, rejected: true });
}

// ---- FR-03 Leave ----------------------------------------------------------------
const currentYear = (): number => new Date().getUTCFullYear();

interface LeaveTypeRow { id: string; code: string; name: string; default_quota: number; }

// Make sure the employee has a balance row for every leave type this year, seeded
// from each type's default quota. Idempotent.
async function ensureBalances(env: Env, employeeId: string, year: number): Promise<void> {
  const types = (await env.DB.prepare("SELECT id, default_quota FROM leave_types").all<{ id: string; default_quota: number }>()).results;
  const have = (await env.DB.prepare("SELECT leave_type_id FROM leave_balances WHERE employee_id = ? AND year = ?").bind(employeeId, year).all<{ leave_type_id: string }>()).results;
  const haveSet = new Set(have.map((h) => h.leave_type_id));
  const missing = types.filter((t) => !haveSet.has(t.id));
  if (missing.length) {
    await env.DB.batch(missing.map((t) =>
      env.DB.prepare("INSERT OR IGNORE INTO leave_balances (id, employee_id, leave_type_id, year, entitled, used) VALUES (?,?,?,?,?,0)")
        .bind(uid(), employeeId, t.id, year, t.default_quota)));
  }
}

async function handleLeaveTypes(env: Env): Promise<Response> {
  const types = (await env.DB.prepare("SELECT id, code, name, default_quota FROM leave_types ORDER BY code").all<LeaveTypeRow>()).results;
  return json({ types });
}

async function handleLeaveBalances(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ year: currentYear(), balances: [] });
  const year = currentYear();
  await ensureBalances(env, actor.employeeId, year);
  const balances = (await env.DB.prepare(
    "SELECT b.leave_type_id, t.code, t.name, b.entitled, b.used, " +
    "COALESCE((SELECT SUM(r.days) FROM leave_requests r WHERE r.employee_id = b.employee_id AND r.leave_type_id = b.leave_type_id AND r.status = 'pending'), 0) AS pending " +
    "FROM leave_balances b JOIN leave_types t ON t.id = b.leave_type_id WHERE b.employee_id = ? AND b.year = ? ORDER BY t.code"
  ).bind(actor.employeeId, year).all()).results;
  return json({ year, balances });
}

async function handleLeaveRequests(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ requests: [] });
  const requests = (await env.DB.prepare(
    "SELECT r.id, r.leave_type_id, t.code AS type_code, t.name AS type_name, r.start_date, r.end_date, r.days, r.half_day, r.reason, r.status, r.decision_comment, r.decided_at, r.created_at " +
    "FROM leave_requests r JOIN leave_types t ON t.id = r.leave_type_id WHERE r.employee_id = ? ORDER BY r.created_at DESC LIMIT 100"
  ).bind(actor.employeeId).all()).results;
  return json({ requests });
}

async function handleLeaveSubmit(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { leaveTypeId?: string; startDate?: string; endDate?: string; halfDay?: boolean; reason?: string };
  const leaveTypeId = (b.leaveTypeId || "").trim();
  const startDate = (b.startDate || "").trim();
  const endDate = (b.endDate || "").trim() || startDate;
  if (!leaveTypeId || !startDate) return json({ error: "leaveTypeId and startDate required" }, 400);
  const type = await env.DB.prepare("SELECT id FROM leave_types WHERE id = ?").bind(leaveTypeId).first();
  if (!type) return json({ error: "unknown leave type" }, 400);
  const days = countLeaveDays(startDate, endDate, !!b.halfDay);
  if (days <= 0) return json({ error: "invalid date range" }, 400);

  const year = currentYear();
  await ensureBalances(env, actor.employeeId, year);
  const bal = await env.DB.prepare("SELECT entitled, used FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
    .bind(actor.employeeId, leaveTypeId, year).first<{ entitled: number; used: number }>();
  const pend = await env.DB.prepare("SELECT COALESCE(SUM(days),0) AS p FROM leave_requests WHERE employee_id = ? AND leave_type_id = ? AND status = 'pending'")
    .bind(actor.employeeId, leaveTypeId).first<{ p: number }>();
  const entitled = bal?.entitled ?? 0, used = bal?.used ?? 0, pending = pend?.p ?? 0;
  if (!canTakeLeave(entitled, used, pending, days)) {
    return json({ error: "insufficient balance", available: entitled - used - pending, requested: days }, 409);
  }

  const id = uid();
  await env.DB.prepare(
    "INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, days, half_day, reason, status) VALUES (?,?,?,?,?,?,?,?, 'pending')"
  ).bind(id, actor.employeeId, leaveTypeId, startDate, endDate, days, b.halfDay ? 1 : 0, b.reason ?? null).run();
  await audit(env, actor.userId, "LEAVE_REQUEST", "leave", id, `${days}d ${startDate}..${endDate}`);
  return json({ ok: true, id, days, status: "pending" });
}

async function handleLeaveCancel(actor: Actor, env: Env, id: string): Promise<Response> {
  const r = await env.DB.prepare("SELECT employee_id, leave_type_id, days, status FROM leave_requests WHERE id = ?")
    .bind(id).first<{ employee_id: string; leave_type_id: string; days: number; status: string }>();
  if (!r) return json({ error: "not found" }, 404);
  if (r.employee_id !== actor.employeeId) return json({ error: "forbidden" }, 403); // own requests only
  if (r.status !== "pending" && r.status !== "approved") return json({ error: `cannot cancel ${r.status}` }, 409);
  const ops = [env.DB.prepare("UPDATE leave_requests SET status = 'cancelled' WHERE id = ?").bind(id)];
  if (r.status === "approved") {
    // restore the approved days to the balance
    ops.push(env.DB.prepare("UPDATE leave_balances SET used = MAX(0, used - ?) WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
      .bind(r.days, r.employee_id, r.leave_type_id, currentYear()));
  }
  await env.DB.batch(ops);
  await audit(env, actor.userId, "LEAVE_CANCEL", "leave", id, `was ${r.status}`);
  return json({ ok: true, cancelled: true });
}

// The approver's queue: pending requests this actor may decide (team for a manager,
// all for HR), never their own.
async function handleLeaveApprovals(actor: Actor, env: Env): Promise<Response> {
  const cols = "r.id, r.employee_id, e.name AS employee_name, t.code AS type_code, r.start_date, r.end_date, r.days, r.reason, r.status, r.created_at";
  const join = "FROM leave_requests r JOIN employees e ON e.id = r.employee_id JOIN leave_types t ON t.id = r.leave_type_id";
  let approvals: unknown[] = [];
  if (hasPermission(actor.role, "leave.approve_all")) {
    approvals = (await env.DB.prepare(`SELECT ${cols} ${join} WHERE r.status = 'pending' AND r.employee_id != ? ORDER BY r.created_at ASC LIMIT 200`)
      .bind(actor.employeeId ?? "").all()).results;
  } else if (hasPermission(actor.role, "leave.approve_team") && actor.employeeId) {
    approvals = (await env.DB.prepare(`SELECT ${cols} ${join} WHERE r.status = 'pending' AND e.manager_id = ? ORDER BY r.created_at ASC LIMIT 200`)
      .bind(actor.employeeId).all()).results;
  }
  return json({ approvals, count: approvals.length });
}

async function handleLeaveDecide(actor: Actor, env: Env, id: string, action: "approve" | "reject", request: Request): Promise<Response> {
  const r = await env.DB.prepare("SELECT employee_id, leave_type_id, days, status FROM leave_requests WHERE id = ?")
    .bind(id).first<{ employee_id: string; leave_type_id: string; days: number; status: string }>();
  if (!r) return json({ error: "not found" }, 404);
  if (r.status !== "pending") return json({ error: `already ${r.status}` }, 409);
  const target = await loadEmployee(env, r.employee_id);
  if (!target || !(canApproveLeaveFor(actor, target) || await hasDelegatedAuthority(env, actor, target))) {
    await audit(env, actor.userId, "DENY", "leave", id, "approve denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  const body = await request.json().catch(() => ({})) as { comment?: string };

  if (action === "approve") {
    const year = currentYear();
    await ensureBalances(env, r.employee_id, year);
    const bal = await env.DB.prepare("SELECT entitled, used FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
      .bind(r.employee_id, r.leave_type_id, year).first<{ entitled: number; used: number }>();
    const entitled = bal?.entitled ?? 0, used = bal?.used ?? 0;
    if (entitled - used < r.days) return json({ error: "insufficient balance at approval", available: entitled - used, requested: r.days }, 409);
    await env.DB.batch([
      env.DB.prepare("UPDATE leave_requests SET status = 'approved', approver_id = ?, decision_comment = ?, decided_at = datetime('now') WHERE id = ?")
        .bind(actor.userId, body.comment ?? null, id),
      env.DB.prepare("UPDATE leave_balances SET used = used + ? WHERE employee_id = ? AND leave_type_id = ? AND year = ?")
        .bind(r.days, r.employee_id, r.leave_type_id, year),
    ]);
    await audit(env, actor.userId, "LEAVE_APPROVE", "leave", id, `${r.days}d for ${r.employee_id}`);
    return json({ ok: true, approved: true });
  }
  await env.DB.prepare("UPDATE leave_requests SET status = 'rejected', approver_id = ?, decision_comment = ?, decided_at = datetime('now') WHERE id = ?")
    .bind(actor.userId, body.comment ?? null, id).run();
  await audit(env, actor.userId, "LEAVE_REJECT", "leave", id, `for ${r.employee_id}`);
  return json({ ok: true, rejected: true });
}

// FR-01 profile photo — a self-service, non-confidential field. The client downscales
// to ~256px; we cap the stored data URL and accept null to remove it.
async function handleProfilePhoto(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { photo?: string | null };
  const photo = b.photo;
  if (photo == null || photo === "") {
    await env.DB.prepare("UPDATE employees SET photo = NULL WHERE id = ?").bind(actor.employeeId).run();
    await audit(env, actor.userId, "PROFILE_PHOTO", "employee", actor.employeeId, "removed");
    return json({ ok: true, removed: true });
  }
  if (typeof photo !== "string" || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo)) return json({ error: "expected a data:image/* base64 URL" }, 400);
  if (photo.length > 400000) return json({ error: "image too large (max ~300KB after resize)" }, 413);
  await env.DB.prepare("UPDATE employees SET photo = ? WHERE id = ?").bind(photo, actor.employeeId).run();
  await audit(env, actor.userId, "PROFILE_PHOTO", "employee", actor.employeeId, "updated");
  return json({ ok: true });
}

// FR-01 Self-service bank details. The employee submits their own payout account; it is
// stored UNVERIFIED (bank_verified=0) and must be KYC-checked by HR before payroll uses it.
// The account number is field-encrypted like any other sensitive datum.
async function handleProfileBank(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const payee = _s(b.bankPayeeName), ifsc = _ifsc(b.bankIfsc), acct = String(b.bankAccount ?? "").trim();
  const acctType = _acctType(b.bankAccountType), bankName = _s(b.bankName);
  const proof = String(b.bankProof ?? "").trim();
  if (!payee || !ifsc || !acct || !bankName) return json({ error: "payee name, account number, IFSC and bank name are required" }, 400);
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return json({ error: "IFSC must be 11 characters (e.g. HDFC0001234)" }, 400);
  if (!/^\d{6,18}$/.test(acct)) return json({ error: "account number must be 6–18 digits" }, 400);
  if (proof && !validBankProof(proof)) return json({ error: "bank proof must be a PDF/image data URL (max ~1.5MB)" }, 400);
  await env.DB.prepare(
    "UPDATE employees SET bank_payee_name=?, bank_ifsc=?, bank_account_type=?, bank_name=?, bank_account=?, bank_verified=0 WHERE id=?"
  ).bind(payee, ifsc, acctType, bankName, await encIfSet(env, acct), actor.employeeId).run();
  if (proof) await env.DB.prepare("UPDATE employees SET bank_proof=? WHERE id=?").bind(proof, actor.employeeId).run();
  await audit(env, actor.userId, "PROFILE_BANK", "employee", actor.employeeId, "submitted bank details (pending HR verification)");
  return json({ ok: true, verified: false });
}

// Fetch the stored cancelled-cheque / passbook image. Kept out of EMP_COLS so it never
// rides along in list/profile payloads; pulled on demand by the owner or an authorised viewer.
async function fetchBankProof(env: Env, empId: string): Promise<Response> {
  const r = await env.DB.prepare("SELECT bank_proof FROM employees WHERE id = ?").bind(empId).first<{ bank_proof: string | null }>();
  if (!r?.bank_proof) return json({ error: "no bank proof on file" }, 404);
  return json({ proof: r.bank_proof });
}
async function handleMyBankProof(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  return await fetchBankProof(env, actor.employeeId);
}
async function handleAdminBankProof(actor: Actor, env: Env, id: string): Promise<Response> {
  const rec = await loadEmployee(env, id);
  if (!rec) return json({ error: "not found" }, 404);
  if (!canReadSensitive(actor, rec)) return json({ error: "forbidden" }, 403);
  await audit(env, actor.userId, "BANK_PROOF_VIEW", "employee", id, "viewed bank proof");
  return await fetchBankProof(env, id);
}

// ---- Employee master (full data collection) ------------------------------------
function fullName(first: unknown, last: unknown): string {
  return [String(first ?? "").trim(), String(last ?? "").trim()].filter(Boolean).join(" ");
}
async function encIfSet(env: Env, v: unknown): Promise<string | null> {
  const s = String(v ?? "").trim();
  if (!s) return null;
  try { return env.FIELD_ENC_KEY ? await encryptField(s, env.FIELD_ENC_KEY) : s; } catch { return s; }
}
const _s = (v: unknown): string | null => { const s = String(v ?? "").trim(); return s || null; };
const _ifsc = (v: unknown): string | null => { const s = String(v ?? "").trim().toUpperCase(); return s || null; };
const _acctType = (v: unknown): string | null => { const s = String(v ?? "").trim().toLowerCase(); return s === "current" ? "current" : s === "savings" ? "savings" : null; };
function validBankProof(s: string): boolean { return /^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,/.test(s) && s.length <= 2_000_000; }

async function handleEmployeeCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const first = String(b.firstName ?? "").trim(), last = String(b.lastName ?? "").trim();
  const name = fullName(first, last);
  if (!name) return json({ error: "first and/or last name required" }, 400);
  const proof = String(b.bankProof ?? "").trim();
  if (proof && !validBankProof(proof)) return json({ error: "bank proof must be a PDF/image data URL (max ~1.5MB)" }, 400);
  const id = "e_" + uid().replace(/-/g, "").slice(0, 12);
  const seg = b.segment === "client_site" ? "client_site" : "office";
  const [panE, bankE, aadE] = await Promise.all([encIfSet(env, b.pan), encIfSet(env, b.bankAccount), encIfSet(env, b.aadhaarLast4)]);
  await env.DB.prepare(
    "INSERT INTO employees (id,user_id,manager_id,segment,name,work_email,designation,location," +
    "employee_code,first_name,last_name,dob,gender,department,employment_type,employment_status," +
    "phone,personal_email,address,emergency_contact,date_of_joining,date_of_exit," +
    "probation_start,probation_end,confirmed_on,contract_start,contract_end,exit_reason,exit_status," +
    "emergency_contact_2,notice_period_days,bank_payee_name,bank_ifsc,bank_account_type,bank_name,bank_proof,bank_verified," +
    "pan,bank_account,aadhaar_last4,ctc) VALUES (" + "?,".repeat(40) + "?)"
  ).bind(id, null, _s(b.managerId), seg, name, _s(b.workEmail), _s(b.designation), _s(b.location),
    _s(b.employeeCode), first || null, last || null, _s(b.dob), _s(b.gender), _s(b.department), _s(b.employmentType), String(b.employmentStatus || "active"),
    _s(b.phone), _s(b.personalEmail), _s(b.address), _s(b.emergencyContact), _s(b.dateOfJoining), _s(b.dateOfExit),
    _s(b.probationStart), _s(b.probationEnd), _s(b.confirmedOn), _s(b.contractStart), _s(b.contractEnd), _s(b.exitReason), _s(b.exitStatus),
    _s(b.emergencyContact2), b.noticePeriodDays != null && b.noticePeriodDays !== "" ? Math.max(0, Math.round(Number(b.noticePeriodDays))) : null,
    _s(b.bankPayeeName), _ifsc(b.bankIfsc), _acctType(b.bankAccountType), _s(b.bankName), proof || null, b.bankVerified ? 1 : 0,
    panE, bankE, aadE, b.ctc != null && b.ctc !== "" ? Number(b.ctc) : null).run();
  await audit(env, actor.userId, "EMPLOYEE_CREATE", "employee", id, `${name} ${_s(b.employeeCode) ?? ""}`);
  return json({ ok: true, id });
}

async function handleEmployeeUpdate(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  if (!(await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(id).first())) return json({ error: "not found" }, 404);
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const first = String(b.firstName ?? "").trim(), last = String(b.lastName ?? "").trim();
  const name = fullName(first, last);
  const seg = b.segment === "client_site" ? "client_site" : "office";
  const proof = String(b.bankProof ?? "").trim();
  if (proof && !validBankProof(proof)) return json({ error: "bank proof must be a PDF/image data URL (max ~1.5MB)" }, 400);
  await env.DB.prepare(
    "UPDATE employees SET manager_id=?, segment=?, name=COALESCE(NULLIF(?,''),name), work_email=?, designation=?, location=?," +
    "employee_code=?, first_name=?, last_name=?, dob=?, gender=?, department=?, employment_type=?, employment_status=?," +
    "phone=?, personal_email=?, address=?, emergency_contact=?, date_of_joining=?, date_of_exit=?," +
    "probation_start=?, probation_end=?, confirmed_on=?, contract_start=?, contract_end=?, exit_reason=?, exit_status=?," +
    "emergency_contact_2=?, notice_period_days=?, bank_payee_name=?, bank_ifsc=?, bank_account_type=?, bank_name=?, bank_verified=?, ctc=? WHERE id=?"
  ).bind(_s(b.managerId), seg, name, _s(b.workEmail), _s(b.designation), _s(b.location),
    _s(b.employeeCode), first || null, last || null, _s(b.dob), _s(b.gender), _s(b.department), _s(b.employmentType), String(b.employmentStatus || "active"),
    _s(b.phone), _s(b.personalEmail), _s(b.address), _s(b.emergencyContact), _s(b.dateOfJoining), _s(b.dateOfExit),
    _s(b.probationStart), _s(b.probationEnd), _s(b.confirmedOn), _s(b.contractStart), _s(b.contractEnd), _s(b.exitReason), _s(b.exitStatus),
    _s(b.emergencyContact2), b.noticePeriodDays != null && b.noticePeriodDays !== "" ? Math.max(0, Math.round(Number(b.noticePeriodDays))) : null,
    _s(b.bankPayeeName), _ifsc(b.bankIfsc), _acctType(b.bankAccountType), _s(b.bankName), b.bankVerified ? 1 : 0,
    b.ctc != null && b.ctc !== "" ? Number(b.ctc) : null, id).run();
  // bank_proof is kept out of EMP_COLS; replace only when a new one is supplied (blank keeps the existing image).
  if (proof) await env.DB.prepare("UPDATE employees SET bank_proof=? WHERE id=?").bind(proof, id).run();
  for (const [k, col] of [["pan", "pan"], ["bankAccount", "bank_account"], ["aadhaarLast4", "aadhaar_last4"]] as const) {
    const v = String(b[k] ?? "").trim();
    if (v) await env.DB.prepare(`UPDATE employees SET ${col}=? WHERE id=?`).bind(await encIfSet(env, v), id).run();
  }
  await audit(env, actor.userId, "EMPLOYEE_UPDATE", "employee", id, name || "");
  return json({ ok: true });
}

// Role-aware dashboard aggregates (real data). The client merges this with /api/notifications
// for the action centre.
function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
async function handleDashboard(actor: Actor, env: Env): Promise<Response> {
  const out: Record<string, unknown> = {};
  if (actor.employeeId) {
    const month = todayISO().slice(0, 7);
    const att = await env.DB.prepare("SELECT COUNT(*) AS present FROM attendance_days WHERE employee_id = ? AND date LIKE ? AND status = 'P'").bind(actor.employeeId, `${month}-%`).first<{ present: number }>();
    const pay = await env.DB.prepare("SELECT title FROM documents WHERE employee_id = ? AND category = 'payslip' AND status = 'published' ORDER BY published_at DESC LIMIT 1").bind(actor.employeeId).first<{ title: string }>();
    const tasks = await env.DB.prepare("SELECT COUNT(*) AS n FROM tasks WHERE assignee_employee_id = ? AND status IN ('open','in_progress')").bind(actor.employeeId).first<{ n: number }>();
    out.me = { presentThisMonth: att?.present ?? 0, latestPayslip: pay?.title ?? null, openTasks: tasks?.n ?? 0, month };
  }
  if (hasPermission(actor.role, "employee.read_all")) {
    const emp = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN employment_status='active' THEN 1 ELSE 0 END) AS active FROM employees").first<{ total: number; active: number }>();
    const byDept = (await env.DB.prepare("SELECT COALESCE(NULLIF(department,''),'—') AS department, COUNT(*) AS n FROM employees GROUP BY COALESCE(NULLIF(department,''),'—') ORDER BY n DESC").all()).results;
    const today = todayISO();
    const contractAlerts = (await env.DB.prepare("SELECT name, contract_end FROM employees WHERE COALESCE(contract_end,'') <> '' AND contract_end <= ? AND COALESCE(date_of_exit,'')='' ORDER BY contract_end LIMIT 20").bind(addDaysISO(today, 60)).all()).results;
    const probationAlerts = (await env.DB.prepare("SELECT name, probation_end FROM employees WHERE COALESCE(probation_end,'') <> '' AND probation_end <= ? AND COALESCE(confirmed_on,'')='' ORDER BY probation_end LIMIT 20").bind(addDaysISO(today, 30)).all()).results;
    const run = await env.DB.prepare("SELECT ym, status, version FROM payroll_runs WHERE status != 'cancelled' ORDER BY ym DESC, version DESC LIMIT 1").first<{ ym: string; status: string; version: number }>();
    out.org = { totalEmployees: emp?.total ?? 0, activeEmployees: emp?.active ?? 0, byDept, contractAlerts, probationAlerts, payroll: run ?? null };
  }
  return json(out);
}

// ---- FR-02 Attendance ----------------------------------------------------------
const todayISO = (): string => new Date().toISOString().slice(0, 10);
const ymOf = (date: string): string => String(date).slice(0, 7);
const ATT_CORRECTION_TYPES = new Set(["regularisation", "on_duty", "client_visit", "wfh"]);

// Payroll-ready attendance helpers (month cutoff + holiday-calendar counting).
// A month is "locked" once an attendance_periods row for it has status='locked';
// imports, new corrections and correction write-backs into a locked month are refused.
async function isMonthLocked(env: Env, ym: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}$/.test(ym)) return false;
  const row = await env.DB.prepare("SELECT status FROM attendance_periods WHERE ym = ?").bind(ym).first<{ status: string }>();
  return !!row && row.status === "locked";
}

// Weekly-off days (0=Sun … 6=Sat) from the single org policy row; defaults to Sunday.
async function loadWeekOffDays(env: Env): Promise<number[]> {
  const row = await env.DB.prepare("SELECT weekly_off_days FROM attendance_policy WHERE id = 'default'").first<{ weekly_off_days: string }>();
  const csv = row?.weekly_off_days ?? "0";
  const days = csv.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return days.length ? days : [0];
}

// Holiday dates (Set of YYYY-MM-DD) that apply to a location for a given month:
// global ('*') holidays plus any for that specific location.
async function loadHolidaySet(env: Env, location: string | null, ym: string): Promise<Set<string>> {
  const rows = (await env.DB.prepare(
    "SELECT holiday_date FROM holidays WHERE (location = '*' OR location = ?) AND holiday_date LIKE ?"
  ).bind(location ?? "", `${ym}-%`).all<{ holiday_date: string }>()).results;
  return new Set(rows.map((r) => r.holiday_date));
}

interface AttRow {
  id: string; employee_id: string; date: string; in_time: string | null; out_time: string | null;
  work_minutes: number; ot_minutes: number; status: string; source: string;
}

// Admin import of biometric data. Matches each row's biometric code to an employee
// via attendance_code and upserts that day. Unknown codes are reported, not failed.
async function handleAttendanceImport(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.manage")) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({})) as {
    month?: string;
    rows?: Array<{ code?: string; date?: string; in?: string | null; out?: string | null; workMinutes?: number; otMinutes?: number; status?: string }>;
  };
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json({ error: "no rows" }, 400);
  const emps = (await env.DB.prepare("SELECT id, attendance_code FROM employees WHERE attendance_code IS NOT NULL AND attendance_code != ''")
    .all<{ id: string; attendance_code: string }>()).results;
  const byCode = new Map(emps.map((e) => [String(e.attendance_code), e.id]));
  // Refuse to write into a month that has been locked for payroll.
  const yms = [...new Set(rows.map((r) => ymOf(String(r.date ?? ""))).filter((y) => /^\d{4}-\d{2}$/.test(y)))];
  const lockedYms = new Set<string>();
  for (const ym of yms) if (await isMonthLocked(env, ym)) lockedYms.add(ym);
  const ops: D1PreparedStatement[] = [];
  const unmatched = new Set<string>();
  const matched = new Set<string>();
  let lockedSkipped = 0;
  for (const r of rows) {
    const code = String(r.code ?? "").trim();
    const date = String(r.date ?? "").trim();
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (lockedYms.has(ymOf(date))) { lockedSkipped++; continue; }
    const empId = byCode.get(code);
    if (!empId) { unmatched.add(code); continue; }
    matched.add(empId);
    ops.push(env.DB.prepare(
      "INSERT INTO attendance_days (id, employee_id, date, in_time, out_time, work_minutes, ot_minutes, status, source, updated_at) " +
      "VALUES (?,?,?,?,?,?,?,?, 'biometric', datetime('now')) " +
      "ON CONFLICT(employee_id, date) DO UPDATE SET in_time=excluded.in_time, out_time=excluded.out_time, work_minutes=excluded.work_minutes, ot_minutes=excluded.ot_minutes, status=excluded.status, source='biometric', updated_at=datetime('now')"
    ).bind(uid(), empId, date, r.in ?? null, r.out ?? null, Math.max(0, Math.round(Number(r.workMinutes) || 0)), Math.max(0, Math.round(Number(r.otMinutes) || 0)), String(r.status ?? "")));
  }
  for (let i = 0; i < ops.length; i += 50) await env.DB.batch(ops.slice(i, i + 50)); // chunk under the batch cap
  await audit(env, actor.userId, "ATTENDANCE_IMPORT", "attendance", null, `month ${body.month ?? "?"}: ${ops.length} days, ${matched.size} employees, ${unmatched.size} unmatched, ${lockedSkipped} skipped (locked)`);
  return json({ ok: true, imported: ops.length, employees: matched.size, unmatchedCodes: [...unmatched], lockedSkipped, lockedMonths: [...lockedYms] });
}

async function handleAttendanceMonth(actor: Actor, env: Env, monthParam: string): Promise<Response> {
  if (!actor.employeeId) return json({ month: monthParam, days: [], summary: null });
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayISO().slice(0, 7);
  const rows = (await env.DB.prepare(
    "SELECT id, employee_id, date, in_time, out_time, work_minutes, ot_minutes, status, source FROM attendance_days WHERE employee_id = ? AND date LIKE ? ORDER BY date"
  ).bind(actor.employeeId, `${month}-%`).all<AttRow>()).results;
  const today = todayISO();
  const toDay = (r: AttRow): AttendanceDay => ({ date: r.date, inTime: r.in_time, outTime: r.out_time, workMinutes: r.work_minutes, status: r.status, otMinutes: r.ot_minutes });
  const days = rows.map((r) => ({
    date: r.date, in: r.in_time, out: r.out_time, workMinutes: r.work_minutes, otMinutes: r.ot_minutes,
    status: r.status, source: r.source, exceptions: dayExceptions(toDay(r), today),
  }));
  // Payroll-ready view: derive payable days against the employee's holiday calendar,
  // and show whether the month is locked.
  const emp = await env.DB.prepare("SELECT location FROM employees WHERE id = ?").bind(actor.employeeId).first<{ location: string | null }>();
  const [weekOffDays, holidays, locked] = await Promise.all([
    loadWeekOffDays(env),
    loadHolidaySet(env, emp?.location ?? null, month),
    isMonthLocked(env, month),
  ]);
  const payroll = payrollInput(month, rows.map(toDay), holidays, weekOffDays, today);
  const pol = await env.DB.prepare("SELECT weekly_off_days, weekly_target_minutes, reporting_time, grace_minutes FROM attendance_policy WHERE id = 'default'").first<{ weekly_off_days: string; weekly_target_minutes: number; reporting_time: string; grace_minutes: number }>();
  const policy = { weeklyOffDays: weekOffDays, weeklyTargetMinutes: pol?.weekly_target_minutes ?? 2880, reportingTime: pol?.reporting_time ?? "09:30", graceMinutes: pol?.grace_minutes ?? 10 };
  return json({ month, locked, days, summary: summarize(rows.map(toDay), today), payroll, policy });
}

async function handleAttCorrectionSubmit(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { date?: string; type?: string; requestedIn?: string; requestedOut?: string; reason?: string };
  const date = String(b.date ?? "").trim();
  const type = String(b.type ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "valid date required" }, 400);
  if (!ATT_CORRECTION_TYPES.has(type)) return json({ error: "invalid correction type" }, 400);
  if (await isMonthLocked(env, ymOf(date))) return json({ error: "month locked for payroll — corrections are closed" }, 409);
  const id = uid();
  await env.DB.prepare("INSERT INTO attendance_corrections (id, employee_id, date, type, requested_in, requested_out, reason) VALUES (?,?,?,?,?,?,?)")
    .bind(id, actor.employeeId, date, type, b.requestedIn ?? null, b.requestedOut ?? null, b.reason ?? null).run();
  await audit(env, actor.userId, "ATTENDANCE_CORRECTION_REQUEST", "attendance", id, `${type} ${date}`);
  return json({ ok: true, id, status: "pending" });
}

async function handleAttCorrections(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ corrections: [] });
  const corrections = (await env.DB.prepare(
    "SELECT id, date, type, requested_in, requested_out, reason, status, decision_comment, decided_at, created_at FROM attendance_corrections WHERE employee_id = ? ORDER BY created_at DESC LIMIT 100"
  ).bind(actor.employeeId).all()).results;
  return json({ corrections });
}

async function handleAttCorrectionQueue(actor: Actor, env: Env): Promise<Response> {
  const cols = "c.id, c.employee_id, e.name AS employee_name, c.date, c.type, c.requested_in, c.requested_out, c.reason, c.created_at";
  const join = "FROM attendance_corrections c JOIN employees e ON e.id = c.employee_id";
  let corrections: unknown[] = [];
  if (hasPermission(actor.role, "attendance.approve_all")) {
    corrections = (await env.DB.prepare(`SELECT ${cols} ${join} WHERE c.status = 'pending' AND c.employee_id != ? ORDER BY c.created_at ASC LIMIT 200`).bind(actor.employeeId ?? "").all()).results;
  } else if (hasPermission(actor.role, "attendance.approve_team") && actor.employeeId) {
    corrections = (await env.DB.prepare(`SELECT ${cols} ${join} WHERE c.status = 'pending' AND e.manager_id = ? ORDER BY c.created_at ASC LIMIT 200`).bind(actor.employeeId).all()).results;
  }
  return json({ corrections, count: corrections.length });
}

async function handleAttCorrectionDecide(actor: Actor, env: Env, id: string, action: "approve" | "reject", request: Request): Promise<Response> {
  const c = await env.DB.prepare("SELECT employee_id, date, requested_in, requested_out, status FROM attendance_corrections WHERE id = ?")
    .bind(id).first<{ employee_id: string; date: string; requested_in: string | null; requested_out: string | null; status: string }>();
  if (!c) return json({ error: "not found" }, 404);
  if (c.status !== "pending") return json({ error: `already ${c.status}` }, 409);
  const target = await loadEmployee(env, c.employee_id);
  if (!target || !(canApproveAttendanceFor(actor, target) || await hasDelegatedAuthority(env, actor, target))) {
    await audit(env, actor.userId, "DENY", "attendance", id, "correction approve denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  const body = await request.json().catch(() => ({})) as { comment?: string };
  if (action === "approve") {
    if (await isMonthLocked(env, ymOf(c.date))) return json({ error: "month locked for payroll — cannot write back a correction" }, 409);
    const inM = hhmmToMinutes(c.requested_in), outM = hhmmToMinutes(c.requested_out);
    const work = inM != null && outM != null ? Math.max(0, outM - inM) : 0;
    await env.DB.batch([
      env.DB.prepare("UPDATE attendance_corrections SET status = 'approved', approver_id = ?, decision_comment = ?, decided_at = datetime('now') WHERE id = ?")
        .bind(actor.userId, body.comment ?? null, id),
      env.DB.prepare(
        "INSERT INTO attendance_days (id, employee_id, date, in_time, out_time, work_minutes, ot_minutes, status, source, updated_at) VALUES (?,?,?,?,?,?,0,'P','manual', datetime('now')) " +
        "ON CONFLICT(employee_id, date) DO UPDATE SET in_time=excluded.in_time, out_time=excluded.out_time, work_minutes=excluded.work_minutes, status='P', source='manual', updated_at=datetime('now')"
      ).bind(uid(), c.employee_id, c.date, c.requested_in, c.requested_out, work),
    ]);
    await audit(env, actor.userId, "ATTENDANCE_CORRECTION_APPROVE", "attendance", id, `${c.date} for ${c.employee_id}`);
    return json({ ok: true, approved: true });
  }
  await env.DB.prepare("UPDATE attendance_corrections SET status = 'rejected', approver_id = ?, decision_comment = ?, decided_at = datetime('now') WHERE id = ?")
    .bind(actor.userId, body.comment ?? null, id).run();
  await audit(env, actor.userId, "ATTENDANCE_CORRECTION_REJECT", "attendance", id, `${c.date} for ${c.employee_id}`);
  return json({ ok: true, rejected: true });
}

// ---- Payroll-ready attendance: month lock, holiday calendar, payroll input -----

// List month locks + the current/recent months so the UI can show lock state.
async function handleAttPeriods(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock")) return json({ error: "forbidden" }, 403);
  const periods = (await env.DB.prepare(
    "SELECT ym, status, locked_by, locked_at, note FROM attendance_periods ORDER BY ym DESC LIMIT 36"
  ).all()).results;
  return json({ periods });
}

// Lock or unlock a month for payroll. Locking freezes imports/corrections for that
// month; unlocking (reopening) is audited. Only attendance.lock holders (HR/finance).
async function handleAttPeriodSetLock(actor: Actor, env: Env, ym: string, lock: boolean, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock")) return json({ error: "forbidden" }, 403);
  if (!/^\d{4}-\d{2}$/.test(ym)) return json({ error: "valid month (YYYY-MM) required" }, 400);
  const body = await request.json().catch(() => ({})) as { note?: string };
  const status = lock ? "locked" : "open";
  await env.DB.prepare(
    "INSERT INTO attendance_periods (ym, status, locked_by, locked_at, updated_at, note) VALUES (?,?,?,?,datetime('now'),?) " +
    "ON CONFLICT(ym) DO UPDATE SET status=excluded.status, locked_by=excluded.locked_by, locked_at=excluded.locked_at, updated_at=datetime('now'), note=excluded.note"
  ).bind(ym, status, actor.userId, lock ? todayISO() : null, body.note ?? null).run();
  await audit(env, actor.userId, lock ? "ATTENDANCE_MONTH_LOCK" : "ATTENDANCE_MONTH_UNLOCK", "attendance", ym, body.note ?? "");
  return json({ ok: true, ym, status });
}

async function handleHolidaysList(actor: Actor, env: Env, yearParam: string): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock") && !hasPermission(actor.role, "attendance.manage")) return json({ error: "forbidden" }, 403);
  const year = /^\d{4}$/.test(yearParam) ? yearParam : todayISO().slice(0, 4);
  const holidays = (await env.DB.prepare(
    "SELECT id, location, holiday_date, name FROM holidays WHERE holiday_date LIKE ? ORDER BY holiday_date"
  ).bind(`${year}-%`).all()).results;
  return json({ year, holidays });
}

async function handleHolidayCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock") && !hasPermission(actor.role, "attendance.manage")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { date?: string; name?: string; location?: string };
  const date = String(b.date ?? "").trim();
  const name = String(b.name ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "valid date (YYYY-MM-DD) required" }, 400);
  if (!name) return json({ error: "name required" }, 400);
  const location = String(b.location ?? "*").trim() || "*";
  if (await isMonthLocked(env, ymOf(date))) return json({ error: "month locked — reopen it to change its calendar" }, 409);
  const id = uid();
  try {
    await env.DB.prepare("INSERT INTO holidays (id, location, holiday_date, name) VALUES (?,?,?,?)").bind(id, location, date, name).run();
  } catch { return json({ error: "a holiday for that location and date already exists" }, 409); }
  await audit(env, actor.userId, "HOLIDAY_ADD", "attendance", id, `${location} ${date} ${name}`);
  return json({ ok: true, id });
}

async function handleHolidayDelete(actor: Actor, env: Env, id: string): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock") && !hasPermission(actor.role, "attendance.manage")) return json({ error: "forbidden" }, 403);
  const h = await env.DB.prepare("SELECT holiday_date FROM holidays WHERE id = ?").bind(id).first<{ holiday_date: string }>();
  if (!h) return json({ error: "not found" }, 404);
  if (await isMonthLocked(env, ymOf(h.holiday_date))) return json({ error: "month locked — reopen it to change its calendar" }, 409);
  await env.DB.prepare("DELETE FROM holidays WHERE id = ?").bind(id).run();
  await audit(env, actor.userId, "HOLIDAY_REMOVE", "attendance", id, h.holiday_date);
  return json({ ok: true });
}

// The deliverable: a locked, reproducible per-employee payroll input for a month —
// payable days (calendar − LOP), paid leave, LOP, OT minutes, exceptions. This is
// exactly what the payroll engine will consume. Restricted to attendance.lock holders.
async function handleAttPayrollInput(actor: Actor, env: Env, monthParam: string): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock")) return json({ error: "forbidden" }, 403);
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayISO().slice(0, 7);
  const today = todayISO();
  const [weekOffDays, locked] = await Promise.all([loadWeekOffDays(env), isMonthLocked(env, month)]);
  const emps = (await env.DB.prepare(
    "SELECT id, name, location, attendance_code FROM employees ORDER BY name"
  ).all<{ id: string; name: string; location: string | null; attendance_code: string | null }>()).results;
  const rows = (await env.DB.prepare(
    "SELECT employee_id, date, in_time, out_time, work_minutes, ot_minutes, status FROM attendance_days WHERE date LIKE ?"
  ).bind(`${month}-%`).all<AttRow>()).results;
  const byEmp = new Map<string, AttendanceDay[]>();
  for (const r of rows) {
    const list = byEmp.get(r.employee_id) ?? [];
    list.push({ date: r.date, inTime: r.in_time, outTime: r.out_time, workMinutes: r.work_minutes, status: r.status, otMinutes: r.ot_minutes });
    byEmp.set(r.employee_id, list);
  }
  // Holidays per distinct location (so each employee counts against their own calendar).
  const locations = [...new Set(emps.map((e) => e.location ?? ""))];
  const holByLoc = new Map<string, Set<string>>();
  for (const loc of locations) holByLoc.set(loc, await loadHolidaySet(env, loc || null, month));
  const employees = emps.map((e) => ({
    employeeId: e.id, name: e.name, location: e.location, mapped: !!e.attendance_code,
    input: payrollInput(month, byEmp.get(e.id) ?? [], holByLoc.get(e.location ?? "") ?? new Set(), weekOffDays, today),
  }));
  return json({ month, locked, workingDaysBaseline: workingDaysInMonth(month, holByLoc.get("") ?? new Set(), weekOffDays), employees });
}

// Attendance policy editor (quick win): read/update the single org policy row that
// drives working-day counting (weekly-off days, weekly target, full-day threshold).
async function handleAttPolicyGet(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock") && !hasPermission(actor.role, "attendance.manage")) return json({ error: "forbidden" }, 403);
  const row = await env.DB.prepare("SELECT weekly_off_days, weekly_target_minutes, full_day_minutes, reporting_time, grace_minutes FROM attendance_policy WHERE id = 'default'").first<{ weekly_off_days: string; weekly_target_minutes: number; full_day_minutes: number; reporting_time: string; grace_minutes: number }>();
  return json({ policy: row ?? { weekly_off_days: "0", weekly_target_minutes: 2880, full_day_minutes: 240, reporting_time: "09:30", grace_minutes: 10 } });
}

async function handleAttPolicySet(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "attendance.lock")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { weeklyOffDays?: number[]; weeklyTargetMinutes?: number; fullDayMinutes?: number; reportingTime?: string; graceMinutes?: number };
  const offDays = Array.isArray(b.weeklyOffDays)
    ? [...new Set(b.weeklyOffDays.map((n) => Math.trunc(Number(n))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
    : null;
  if (!offDays || offDays.length > 6) return json({ error: "weeklyOffDays must be 0–6 (0=Sun), at least one working day" }, 400);
  const target = Math.max(0, Math.round(Number(b.weeklyTargetMinutes) || 0));
  const fullDay = Math.max(0, Math.round(Number(b.fullDayMinutes) || 0));
  const reportingTime = /^\d{2}:\d{2}$/.test(String(b.reportingTime ?? "")) ? String(b.reportingTime) : "09:30";
  const grace = Math.max(0, Math.round(Number(b.graceMinutes) || 0));
  await env.DB.prepare(
    "UPDATE attendance_policy SET weekly_off_days = ?, weekly_target_minutes = ?, full_day_minutes = ?, reporting_time = ?, grace_minutes = ?, updated_at = datetime('now') WHERE id = 'default'"
  ).bind(offDays.join(","), target, fullDay, reportingTime, grace).run();
  await audit(env, actor.userId, "ATTENDANCE_POLICY_UPDATE", "attendance", "default", `off=${offDays.join("|")} target=${target} fullDay=${fullDay} report=${reportingTime} grace=${grace}`);
  return json({ ok: true });
}

// ---- Payroll core — P6a: salary component catalog + effective-dated employee salary ----
function dayBefore(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

async function handleSalaryComponents(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const components = (await env.DB.prepare(
    "SELECT code, name, kind, calc_method, base_code, taxable, statutory, prorates, sequence, active FROM salary_components WHERE active = 1 ORDER BY sequence"
  ).all()).results;
  return json({ components });
}

async function handleSalaryComponentUpsert(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { code?: string; name?: string; kind?: string; calcMethod?: string; baseCode?: string; taxable?: boolean; statutory?: boolean; prorates?: boolean; sequence?: number };
  const code = String(b.code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_]{2,20}$/.test(code)) return json({ error: "code must be 2–20 chars A–Z/0–9/_" }, 400);
  const kind = b.kind === "deduction" ? "deduction" : "earning";
  const calc = b.calcMethod === "percent_of_base" ? "percent_of_base" : "fixed";
  await env.DB.prepare(
    "INSERT INTO salary_components (code,name,kind,calc_method,base_code,taxable,statutory,prorates,sequence,active) VALUES (?,?,?,?,?,?,?,?,?,1) " +
    "ON CONFLICT(code) DO UPDATE SET name=excluded.name, kind=excluded.kind, calc_method=excluded.calc_method, base_code=excluded.base_code, taxable=excluded.taxable, statutory=excluded.statutory, prorates=excluded.prorates, sequence=excluded.sequence, active=1"
  ).bind(code, String(b.name ?? code), kind, calc, b.baseCode ? String(b.baseCode).toUpperCase() : null, b.taxable === false ? 0 : 1, b.statutory ? 1 : 0, b.prorates === false ? 0 : 1, Math.round(Number(b.sequence) || 0)).run();
  await audit(env, actor.userId, "SALARY_COMPONENT_UPSERT", "payroll", code, kind);
  return json({ ok: true, code });
}

async function handleEmployeeSalaryGet(actor: Actor, env: Env, employeeId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const salaries = (await env.DB.prepare(
    "SELECT id, effective_from, effective_to, revision_no, monthly_gross_paise, status, created_at FROM employee_salaries WHERE employee_id = ? ORDER BY effective_from DESC"
  ).bind(employeeId).all<{ id: string }>()).results;
  const out = [];
  for (const s of salaries) {
    const components = (await env.DB.prepare(
      "SELECT component_code, name, kind, calc_method, value, base_code, prorates, taxable, statutory, sequence FROM employee_salary_components WHERE employee_salary_id = ? ORDER BY sequence"
    ).bind(s.id).all()).results;
    out.push({ ...s, components });
  }
  return json({ employeeId, salaries: out });
}

async function handleEmployeeSalarySet(actor: Actor, env: Env, employeeId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const emp = await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(employeeId).first();
  if (!emp) return json({ error: "employee not found" }, 404);
  const b = await request.json().catch(() => ({})) as { effectiveFrom?: string; components?: Array<Record<string, unknown>> };
  const effectiveFrom = String(b.effectiveFrom ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return json({ error: "valid effectiveFrom (YYYY-MM-DD) required" }, 400);
  // No overlap / forward-only: a new revision must start after the current open one.
  const open = await env.DB.prepare("SELECT effective_from FROM employee_salaries WHERE employee_id = ? AND effective_to IS NULL").bind(employeeId).first<{ effective_from: string }>();
  if (open && open.effective_from >= effectiveFrom) return json({ error: "effectiveFrom must be after the current salary's start date" }, 400);
  const raw = Array.isArray(b.components) ? b.components : [];
  const comps: SalaryComponent[] = [];
  const dbRows: Array<SalaryComponent & { taxable: number; statutory: number }> = [];
  for (const c of raw) {
    const code = String(c.code ?? "").trim().toUpperCase();
    if (!code) continue;
    const kind = c.kind === "deduction" ? "deduction" : "earning";
    const calcMethod = c.calcMethod === "percent_of_base" ? "percent_of_base" : "fixed";
    const sc: SalaryComponent = {
      code, name: String(c.name ?? code), kind, calcMethod,
      value: Math.max(0, Math.round(Number(c.value) || 0)),
      baseCode: c.baseCode ? String(c.baseCode).toUpperCase() : null,
      prorates: c.prorates !== false, sequence: Math.round(Number(c.sequence) || 0),
    };
    comps.push(sc);
    dbRows.push({ ...sc, taxable: c.taxable === false ? 0 : 1, statutory: c.statutory ? 1 : 0 });
  }
  if (!comps.length) return json({ error: "at least one valid component required" }, 400);
  const gross = monthlyGross(comps);
  const salId = uid();
  const nextNo = ((await env.DB.prepare("SELECT MAX(revision_no) AS n FROM employee_salaries WHERE employee_id = ?").bind(employeeId).first<{ n: number | null }>())?.n ?? 0) + 1;
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE employee_salaries SET effective_to = ?, status = 'superseded' WHERE employee_id = ? AND effective_to IS NULL").bind(dayBefore(effectiveFrom), employeeId),
    env.DB.prepare("INSERT INTO employee_salaries (id, employee_id, effective_from, effective_to, revision_no, monthly_gross_paise, status, created_by) VALUES (?,?,?,NULL,?,?,'active',?)").bind(salId, employeeId, effectiveFrom, nextNo, gross, actor.userId),
  ];
  for (const c of dbRows) {
    stmts.push(env.DB.prepare(
      "INSERT INTO employee_salary_components (id, employee_salary_id, component_code, name, kind, calc_method, value, base_code, prorates, taxable, statutory, sequence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(uid(), salId, c.code, c.name, c.kind, c.calcMethod, c.value, c.baseCode ?? null, c.prorates ? 1 : 0, c.taxable, c.statutory, c.sequence));
  }
  await env.DB.batch(stmts);
  await audit(env, actor.userId, "EMPLOYEE_SALARY_SET", "payroll", employeeId, `rev ${nextNo} from ${effectiveFrom} gross ${gross}`);
  return json({ ok: true, id: salId, revisionNo: nextNo, monthlyGrossPaise: gross });
}

// Per-employee additional pay (variable / retention / performance bonus, incentive, ad-hoc)
// applied to a specific month — not baked into the recurring structure.
const ADDPAY_CODES = new Set(["RETENTION", "PERF_BONUS", "VARIABLE", "INCENTIVE", "ADHOC"]);
async function handleAdditionalPayGet(actor: Actor, env: Env, employeeId: string, month: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const where = /^\d{4}-\d{2}$/.test(month) ? "AND ym = ?" : "";
  const q = env.DB.prepare(`SELECT id, ym, code, name, kind, amount_paise, taxable, note, created_at FROM employee_additional_pay WHERE employee_id = ? ${where} ORDER BY ym DESC, created_at DESC LIMIT 200`);
  const items = (await (where ? q.bind(employeeId, month) : q.bind(employeeId)).all()).results;
  return json({ items });
}
async function handleAdditionalPayCreate(actor: Actor, env: Env, employeeId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  if (!(await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(employeeId).first())) return json({ error: "employee not found" }, 404);
  const b = await request.json().catch(() => ({})) as { ym?: string; code?: string; name?: string; kind?: string; amountRupees?: number; taxable?: boolean; note?: string };
  const ym = String(b.ym ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) return json({ error: "valid month (YYYY-MM) required" }, 400);
  const code = String(b.code ?? "ADHOC").trim().toUpperCase();
  if (!ADDPAY_CODES.has(code)) return json({ error: "invalid code" }, 400);
  if (await isMonthLocked(env, ym)) return json({ error: "month is locked for payroll" }, 409);
  const amount = Math.round(Number(b.amountRupees) * 100 || 0);
  if (!amount) return json({ error: "amount required" }, 400);
  const kind = b.kind === "deduction" ? "deduction" : "earning";
  const id = uid();
  await env.DB.prepare("INSERT INTO employee_additional_pay (id, employee_id, ym, code, name, kind, amount_paise, taxable, note, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id, employeeId, ym, code, String(b.name ?? code), kind, Math.abs(amount), b.taxable === false ? 0 : 1, _s(b.note), actor.userId).run();
  await audit(env, actor.userId, "ADDITIONAL_PAY_ADD", "payroll", id, `${code} ${kind} ${amount} ${ym} → ${employeeId}`);
  return json({ ok: true, id });
}
async function handleAdditionalPayDelete(actor: Actor, env: Env, payId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const row = await env.DB.prepare("SELECT ym FROM employee_additional_pay WHERE id = ?").bind(payId).first<{ ym: string }>();
  if (!row) return json({ error: "not found" }, 404);
  if (await isMonthLocked(env, row.ym)) return json({ error: "month is locked for payroll" }, 409);
  await env.DB.prepare("DELETE FROM employee_additional_pay WHERE id = ?").bind(payId).run();
  await audit(env, actor.userId, "ADDITIONAL_PAY_DELETE", "payroll", payId, row.ym);
  return json({ ok: true });
}

// Statutory config (S7a: Professional Tax). Parameterised + effective-dated; no hardcoded
// rates. Shipped disabled until a CA confirms the slabs and the vectors pass.
const STATUTES = new Set(["pt", "tds"]); // epf | esi added when applicable
async function handleStatutoryConfigGet(actor: Actor, env: Env, statute: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const where = STATUTES.has(statute) ? "WHERE statute = ?" : "";
  const q = env.DB.prepare(`SELECT id, statute, state, fy, effective_from, effective_to, params, enabled FROM statutory_config ${where} ORDER BY statute, state`);
  const rows = (await (where ? q.bind(statute) : q).all<Record<string, unknown>>()).results;
  const configs = rows.map((r) => ({ ...r, enabled: !!r.enabled, params: (() => { try { return JSON.parse(String(r.params || "{}")); } catch { return {}; } })() }));
  return json({ configs });
}

async function handleStatutoryConfigSet(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "statutory.config")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { statute?: string; state?: string; fy?: string; effectiveFrom?: string; params?: unknown; enabled?: boolean };
  const statute = String(b.statute ?? "").trim().toLowerCase();
  if (!STATUTES.has(statute)) return json({ error: "unsupported statute" }, 400);
  // PT is per-state; TDS is national ('*').
  const state = statute === "tds" ? "*" : String(b.state ?? "").trim().toUpperCase();
  if (statute !== "tds" && !/^[A-Z]{2,3}$/.test(state)) return json({ error: "valid state code required" }, 400);
  if (!b.params || typeof b.params !== "object") return json({ error: "params object required" }, 400);
  if (statute === "pt") {
    const slabs = (b.params as { slabs?: unknown }).slabs;
    if (!Array.isArray(slabs) || !slabs.length) return json({ error: "pt params need a non-empty slabs array" }, 400);
  }
  if (statute === "tds") {
    const rg = (b.params as { regimes?: { old?: unknown; new?: unknown } }).regimes;
    if (!rg || !rg.old || !rg.new) return json({ error: "tds params need regimes.old and regimes.new" }, 400);
  }
  const id = `${statute}_${state}`;
  await env.DB.prepare(
    "INSERT INTO statutory_config (id, statute, state, fy, effective_from, params, enabled, updated_by, updated_at) VALUES (?,?,?,?,?,?,?,?, datetime('now')) " +
    "ON CONFLICT(id) DO UPDATE SET fy=excluded.fy, effective_from=excluded.effective_from, params=excluded.params, enabled=excluded.enabled, updated_by=excluded.updated_by, updated_at=datetime('now')"
  ).bind(id, statute, state, String(b.fy ?? ""), String(b.effectiveFrom ?? ""), JSON.stringify(b.params), b.enabled ? 1 : 0, actor.userId).run();
  await audit(env, actor.userId, "STATUTORY_CONFIG_SET", "payroll", id, `${statute}/${state} enabled=${b.enabled ? 1 : 0}`);
  return json({ ok: true, id, enabled: !!b.enabled });
}

// TDS self-service (S7b): an employee elects their regime for the FY and declares
// investments; only VERIFIED declarations reduce TDS (unless the config honours provisional).
const TAX_SECTIONS = new Set(["80C", "80D", "HRA", "HOME_LOAN", "OTHER"]);
async function handleTaxMe(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const fy = fyOf(todayISO().slice(0, 7));
  const prof = await env.DB.prepare("SELECT tax_regime FROM employee_statutory WHERE employee_id = ?").bind(actor.employeeId).first<{ tax_regime: string | null }>();
  const declarations = (await env.DB.prepare(
    "SELECT id, fy, section, amount_paise, status, note, created_at FROM tax_declarations WHERE employee_id = ? AND fy = ? ORDER BY created_at DESC"
  ).bind(actor.employeeId, fy).all()).results;
  return json({ fy, regime: prof?.tax_regime ?? "new", declarations });
}

async function handleTaxRegime(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { regime?: string };
  const regime = b.regime === "old" ? "old" : b.regime === "new" ? "new" : null;
  if (!regime) return json({ error: "regime must be 'old' or 'new'" }, 400);
  await env.DB.prepare(
    "INSERT INTO employee_statutory (employee_id, tax_regime, updated_at) VALUES (?,?, datetime('now')) ON CONFLICT(employee_id) DO UPDATE SET tax_regime=excluded.tax_regime, updated_at=datetime('now')"
  ).bind(actor.employeeId, regime).run();
  await audit(env, actor.userId, "TAX_REGIME_SET", "payroll", actor.employeeId, regime);
  return json({ ok: true, regime });
}

async function handleTaxDeclare(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { section?: string; amountRupees?: number; fy?: string };
  const section = String(b.section ?? "").trim().toUpperCase();
  if (!TAX_SECTIONS.has(section)) return json({ error: "invalid section" }, 400);
  const amount = Math.max(0, Math.round(Number(b.amountRupees) * 100 || 0));
  if (amount <= 0) return json({ error: "amount required" }, 400);
  const fy = /^\d{4}-\d{2}$/.test(String(b.fy ?? "")) ? String(b.fy) : fyOf(todayISO().slice(0, 7));
  const id = uid();
  await env.DB.prepare("INSERT INTO tax_declarations (id, employee_id, fy, section, amount_paise, status) VALUES (?,?,?,?,?, 'declared')")
    .bind(id, actor.employeeId, fy, section, amount).run();
  await audit(env, actor.userId, "TAX_DECLARE", "payroll", id, `${section} ${amount} ${fy}`);
  return json({ ok: true, id });
}

async function handleTaxDeclQueue(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "tax.verify")) return json({ error: "forbidden" }, 403);
  const rows = (await env.DB.prepare(
    "SELECT d.id, d.employee_id, e.name AS employee_name, d.fy, d.section, d.amount_paise, d.status, d.created_at FROM tax_declarations d JOIN employees e ON e.id = d.employee_id ORDER BY (d.status='declared') DESC, d.created_at DESC LIMIT 200"
  ).all()).results;
  return json({ declarations: rows });
}

async function handleTaxDeclDecide(actor: Actor, env: Env, id: string, action: "verify" | "reject", request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "tax.verify")) return json({ error: "forbidden" }, 403);
  const d = await env.DB.prepare("SELECT status FROM tax_declarations WHERE id = ?").bind(id).first<{ status: string }>();
  if (!d) return json({ error: "not found" }, 404);
  const b = await request.json().catch(() => ({})) as { note?: string };
  const status = action === "verify" ? "verified" : "rejected";
  await env.DB.prepare("UPDATE tax_declarations SET status = ?, verified_by = ?, note = ? WHERE id = ?").bind(status, actor.userId, b.note ?? null, id).run();
  await audit(env, actor.userId, action === "verify" ? "TAX_DECL_VERIFY" : "TAX_DECL_REJECT", "payroll", id, b.note ?? "");
  return json({ ok: true, status });
}

// Loss-of-pay working days in [fromISO, toISO]: a working day (not a weekly-off, not a
// holiday) whose attendance status is neither present (P) nor approved leave (LV).
function lopDaysInRange(statusByDate: Map<string, string>, holidays: Set<string>, weekOff: Set<number>, fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split("-").map(Number);
  const [ty, tm, td] = toISO.split("-").map(Number);
  const end = Date.UTC(ty, tm - 1, td);
  let lop = 0;
  for (let cur = Date.UTC(fy, fm - 1, fd); cur <= end; cur += 86400000) {
    const dt = new Date(cur);
    if (weekOff.has(dt.getUTCDay())) continue;
    const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    if (holidays.has(iso)) continue;
    const st = statusByDate.get(iso) || "";
    if (st !== "P" && st !== "LV") lop++;
  }
  return lop;
}

// P6b: prepare (or recompute) a payroll run for a LOCKED attendance month. Computes one line
// per employee from their effective-dated salary (day-weighted across mid-month revisions) +
// the locked attendance. Idempotent: re-preparing a draft/in_review run recomputes in place.
async function handlePayrollRunPrepare(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { ym?: string };
  const ym = String(b.ym ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) return json({ error: "valid month (YYYY-MM) required" }, 400);
  if (!(await isMonthLocked(env, ym))) return json({ error: "attendance for this month must be locked before payroll" }, 409);
  const existing = await env.DB.prepare("SELECT id, version, status FROM payroll_runs WHERE ym = ? AND status != 'cancelled' ORDER BY version DESC LIMIT 1").bind(ym).first<{ id: string; version: number; status: string }>();
  if (existing && (existing.status === "approved" || existing.status === "locked")) {
    return json({ error: `run v${existing.version} is ${existing.status}; reopen it for a new version` }, 409);
  }
  const runId = existing ? existing.id : uid();
  const version = existing ? existing.version : 1;

  const calDays = divisorDays(ym, "calendar");
  const monthStart = `${ym}-01`, monthEnd = `${ym}-${String(calDays).padStart(2, "0")}`;
  const modeRow = await env.DB.prepare("SELECT value FROM portal_config WHERE key = 'payroll_divisor'").first<{ value: string }>();
  const mode: DivisorMode = modeRow?.value === "fixed_30" ? "fixed_30" : modeRow?.value === "fixed_26" ? "fixed_26" : "calendar";
  const divisor = divisorDays(ym, mode);
  const weekOff = new Set(await loadWeekOffDays(env));

  const emps = (await env.DB.prepare(
    "SELECT id, name, location, date_of_joining, date_of_exit, (bank_account IS NOT NULL AND bank_account != '') AS has_bank, (pan IS NOT NULL AND pan != '') AS has_pan FROM employees"
  ).all<{ id: string; name: string; location: string | null; date_of_joining: string | null; date_of_exit: string | null; has_bank: number; has_pan: number }>()).results;

  const attRows = (await env.DB.prepare("SELECT employee_id, date, status, ot_minutes FROM attendance_days WHERE date LIKE ?").bind(`${ym}-%`).all<{ employee_id: string; date: string; status: string; ot_minutes: number }>()).results;
  const attByEmp = new Map<string, { status: Map<string, string>; ot: number }>();
  for (const r of attRows) {
    const e = attByEmp.get(r.employee_id) ?? { status: new Map<string, string>(), ot: 0 };
    e.status.set(r.date, r.status); e.ot += r.ot_minutes || 0; attByEmp.set(r.employee_id, e);
  }

  const salRows = (await env.DB.prepare(
    "SELECT id, employee_id, effective_from, effective_to FROM employee_salaries WHERE effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)"
  ).bind(monthEnd, monthStart).all<{ id: string; employee_id: string; effective_from: string; effective_to: string | null }>()).results;
  const salByEmp = new Map<string, SalaryRevision[]>();
  for (const s of salRows) {
    const a = salByEmp.get(s.employee_id) ?? []; a.push({ id: s.id, effectiveFrom: s.effective_from, effectiveTo: s.effective_to }); salByEmp.set(s.employee_id, a);
  }
  const compBySal = new Map<string, SalaryComponent[]>();
  const salIds = salRows.map((s) => s.id);
  for (let i = 0; i < salIds.length; i += 50) {
    const part = salIds.slice(i, i + 50);
    const cr = (await env.DB.prepare(
      `SELECT employee_salary_id, component_code, name, kind, calc_method, value, base_code, prorates, sequence FROM employee_salary_components WHERE employee_salary_id IN (${part.map(() => "?").join(",")})`
    ).bind(...part).all<{ employee_salary_id: string; component_code: string; name: string; kind: string; calc_method: string; value: number; base_code: string | null; prorates: number; sequence: number }>()).results;
    for (const c of cr) {
      const a = compBySal.get(c.employee_salary_id) ?? [];
      a.push({ code: c.component_code, name: c.name, kind: c.kind as "earning" | "deduction", calcMethod: c.calc_method as "fixed" | "percent_of_base", value: c.value, baseCode: c.base_code, prorates: !!c.prorates, sequence: c.sequence });
      compBySal.set(c.employee_salary_id, a);
    }
  }

  const holByLoc = new Map<string, Set<string>>();
  for (const loc of [...new Set(emps.map((e) => e.location ?? ""))]) holByLoc.set(loc, await loadHolidaySet(env, loc || null, ym));

  // Statutory (S7a): Professional Tax config per state + each employee's PT state. PT only
  // applies where a config exists AND is enabled (0 otherwise), so it is inert until CA sign-off.
  const month = parseInt(ym.slice(5, 7), 10);
  const ptConfigByState = new Map<string, PTConfig>();
  for (const r of (await env.DB.prepare("SELECT state, params, enabled FROM statutory_config WHERE statute = 'pt'").all<{ state: string; params: string; enabled: number }>()).results) {
    try { ptConfigByState.set(r.state, { ...(JSON.parse(r.params) as PTConfig), enabled: !!r.enabled }); } catch { /* skip malformed config */ }
  }
  const empPtState = new Map<string, string>();
  const empRegime = new Map<string, string>();
  for (const r of (await env.DB.prepare("SELECT employee_id, pt_state, tax_regime FROM employee_statutory").all<{ employee_id: string; pt_state: string | null; tax_regime: string | null }>()).results) {
    if (r.pt_state) empPtState.set(r.employee_id, r.pt_state);
    if (r.tax_regime) empRegime.set(r.employee_id, r.tax_regime);
  }

  // TDS (S7b): national config, FY projection, verified declarations and YTD true-up —
  // all inert unless the TDS config is enabled.
  const fy = fyOf(ym);
  const monthsRemaining = fyMonthsRemaining(ym);
  let tdsConfig: TDSConfig | null = null;
  const tdsRow = await env.DB.prepare("SELECT params, enabled FROM statutory_config WHERE statute = 'tds' AND state = '*'").first<{ params: string; enabled: number }>();
  if (tdsRow) { try { tdsConfig = { ...(JSON.parse(tdsRow.params) as TDSConfig), enabled: !!tdsRow.enabled }; } catch { /* malformed */ } }
  const declByEmp = new Map<string, number>(), ytdGross = new Map<string, number>(), ytdTds = new Map<string, number>();
  if (tdsConfig?.enabled) {
    const statusClause = tdsConfig.honourProvisional ? "status IN ('declared','verified')" : "status = 'verified'";
    for (const r of (await env.DB.prepare(`SELECT employee_id, SUM(amount_paise) AS total FROM tax_declarations WHERE fy = ? AND ${statusClause} GROUP BY employee_id`).bind(fy).all<{ employee_id: string; total: number }>()).results) declByEmp.set(r.employee_id, Number(r.total) || 0);
    const locked = (await env.DB.prepare("SELECT l.id AS line_id, l.employee_id, l.gross_paise, r.ym FROM payroll_lines l JOIN payroll_runs r ON r.id = l.run_id WHERE r.status = 'locked'").all<{ line_id: string; employee_id: string; gross_paise: number; ym: string }>()).results;
    const lineEmp = new Map<string, string>(); const priorIds: string[] = [];
    for (const row of locked) if (fyOf(row.ym) === fy && row.ym < ym) { ytdGross.set(row.employee_id, (ytdGross.get(row.employee_id) || 0) + Number(row.gross_paise || 0)); lineEmp.set(row.line_id, row.employee_id); priorIds.push(row.line_id); }
    for (let i = 0; i < priorIds.length; i += 50) {
      const part = priorIds.slice(i, i + 50);
      for (const c of (await env.DB.prepare(`SELECT line_id, amount_paise FROM payroll_line_components WHERE code = 'TDS' AND line_id IN (${part.map(() => "?").join(",")})`).bind(...part).all<{ line_id: string; amount_paise: number }>()).results) {
        const emp = lineEmp.get(c.line_id); if (emp) ytdTds.set(emp, (ytdTds.get(emp) || 0) + Number(c.amount_paise || 0));
      }
    }
  }

  // Additional pay (bonuses/incentives/ad-hoc) for this month, grouped by employee.
  const addPayByEmp = new Map<string, Array<{ code: string; name: string; kind: string; amount: number }>>();
  for (const r of (await env.DB.prepare("SELECT employee_id, code, name, kind, amount_paise FROM employee_additional_pay WHERE ym = ?").bind(ym).all<{ employee_id: string; code: string; name: string; kind: string; amount_paise: number }>()).results) {
    const a = addPayByEmp.get(r.employee_id) ?? []; a.push({ code: r.code, name: r.name, kind: r.kind, amount: Number(r.amount_paise) || 0 }); addPayByEmp.set(r.employee_id, a);
  }

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM payroll_line_components WHERE line_id IN (SELECT id FROM payroll_lines WHERE run_id = ?)").bind(runId),
    env.DB.prepare("DELETE FROM payroll_lines WHERE run_id = ?").bind(runId),
  ];
  let totGross = 0, totNet = 0, totExc = 0;
  for (const e of emps) {
    const att = attByEmp.get(e.id) ?? { status: new Map<string, string>(), ot: 0 };
    const hol = holByLoc.get(e.location ?? "") ?? new Set<string>();
    const segments = resolveSalarySegments(salByEmp.get(e.id) ?? [], monthStart, monthEnd, e.date_of_joining, e.date_of_exit);
    const lineId = uid();
    let line: PayLine | null = null; let employedDays = 0, lopDays = 0; const usedSal: string[] = [];
    if (segments.length) {
      const parts: PayLine[] = [];
      for (const seg of segments) {
        const segLop = lopDaysInRange(att.status, hol, weekOff, seg.fromISO, seg.toISO);
        employedDays += seg.days; lopDays += segLop; usedSal.push(seg.id);
        parts.push(computeLine(compBySal.get(seg.id) ?? [], { employedDays: seg.days, lopDays: segLop, divisor }));
      }
      line = aggregatePayLines(parts);
      // Additional pay (variable / retention / performance bonus, incentive, ad-hoc) for the
      // month — applied BEFORE statutory so PT/TDS see the bonus in gross.
      for (const ap of (addPayByEmp.get(e.id) ?? [])) {
        line.components.push({ code: ap.code, name: ap.name, kind: ap.kind === "deduction" ? "deduction" : "earning", amount: ap.amount });
        if (ap.kind === "deduction") line.deductions += ap.amount; else line.grossPaid += ap.amount;
      }
      line.net = line.grossPaid - line.deductions;
      // Statutory deduction: Professional Tax on the earned gross (inert unless enabled).
      const pt = ptForState(line.grossPaid, ptConfigByState.get(empPtState.get(e.id) ?? ""), month);
      if (pt > 0) {
        line.components.push({ code: "PT", name: "Professional Tax", kind: "deduction", amount: pt });
        line.deductions += pt;
        line.net = line.grossPaid - line.deductions;
      }
      // Statutory deduction: TDS (inert unless the TDS config is enabled).
      if (tdsConfig?.enabled) {
        const regime = empRegime.get(e.id) === "old" ? "old" : "new";
        const projected = (ytdGross.get(e.id) || 0) + line.grossPaid * monthsRemaining;
        const decls = regime === "old" ? (declByEmp.get(e.id) || 0) : 0;
        const tds = tdsMonthly({ projectedAnnualGross: projected, regime, declarations: decls, ytdTds: ytdTds.get(e.id) || 0, monthsRemaining, hasPan: !!e.has_pan }, tdsConfig).monthlyTds;
        if (tds > 0) {
          line.components.push({ code: "TDS", name: "TDS", kind: "deduction", amount: tds });
          line.deductions += tds;
          line.net = line.grossPaid - line.deductions;
        }
      }
      if (line.net < 0) line.exception = "negative_net";
    }
    const exception = !line ? "no_salary" : (line.exception || (!e.has_bank ? "missing_bank" : null));
    const gross = line?.grossPaid ?? 0, ded = line?.deductions ?? 0, lop = line?.lopReduction ?? 0, net = line?.net ?? 0;
    totGross += gross; totNet += net; if (exception) totExc++;
    stmts.push(env.DB.prepare(
      "INSERT INTO payroll_lines (id,run_id,employee_id,employee_name,salary_ids,calendar_days,employed_days,lop_days,ot_minutes,gross_paise,deductions_paise,lop_paise,net_paise,exception) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    ).bind(lineId, runId, e.id, e.name, JSON.stringify(usedSal), calDays, employedDays, lopDays, att.ot, gross, ded, lop, net, exception));
    if (line) line.components.forEach((c, i) => stmts.push(env.DB.prepare(
      "INSERT INTO payroll_line_components (id,line_id,code,name,kind,amount_paise,sequence) VALUES (?,?,?,?,?,?,?)"
    ).bind(uid(), lineId, c.code, c.name, c.kind, c.amount, i)));
  }
  stmts.unshift(env.DB.prepare(
    "INSERT INTO payroll_runs (id,ym,version,status,divisor,employees,gross_paise,net_paise,exceptions,prepared_by,prepared_at) VALUES (?,?,?,'draft',?,?,?,?,?,?,datetime('now')) " +
    "ON CONFLICT(id) DO UPDATE SET status='draft', divisor=excluded.divisor, employees=excluded.employees, gross_paise=excluded.gross_paise, net_paise=excluded.net_paise, exceptions=excluded.exceptions, prepared_by=excluded.prepared_by, prepared_at=datetime('now')"
  ).bind(runId, ym, version, mode, emps.length, totGross, totNet, totExc, actor.userId));
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await audit(env, actor.userId, "PAYROLL_RUN_PREPARE", "payroll", runId, `${ym} v${version}: ${emps.length} emp, net ${totNet}, ${totExc} exc, divisor ${mode}`);
  return json({ ok: true, runId, ym, version, employees: emps.length, grossPaise: totGross, netPaise: totNet, exceptions: totExc });
}

async function handlePayrollRuns(actor: Actor, env: Env, ym: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const where = /^\d{4}-\d{2}$/.test(ym) ? "WHERE ym = ?" : "";
  const q = env.DB.prepare(`SELECT id,ym,version,status,divisor,employees,gross_paise,net_paise,exceptions,prepared_at,approved_at,locked_at FROM payroll_runs ${where} ORDER BY ym DESC, version DESC LIMIT 60`);
  const runs = (await (where ? q.bind(ym) : q).all()).results;
  return json({ runs });
}

async function handlePayrollRunGet(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT id,ym,version,status,divisor,employees,gross_paise,net_paise,exceptions,prepared_by,prepared_at,approved_by,approved_at,locked_at,note FROM payroll_runs WHERE id = ?").bind(runId).first();
  if (!run) return json({ error: "not found" }, 404);
  const lines = (await env.DB.prepare("SELECT id,employee_id,employee_name,employed_days,lop_days,ot_minutes,gross_paise,deductions_paise,lop_paise,net_paise,exception FROM payroll_lines WHERE run_id = ? ORDER BY employee_name").bind(runId).all<{ id: string }>()).results;
  const comps = (await env.DB.prepare("SELECT line_id,code,name,kind,amount_paise FROM payroll_line_components WHERE line_id IN (SELECT id FROM payroll_lines WHERE run_id = ?) ORDER BY sequence").bind(runId).all<{ line_id: string }>()).results;
  const byLine = new Map<string, unknown[]>();
  for (const c of comps) { const a = byLine.get(c.line_id) ?? []; a.push(c); byLine.set(c.line_id, a); }
  return json({ run, lines: lines.map((l) => ({ ...l, components: byLine.get(l.id) ?? [] })) });
}

async function handlePayrollRegister(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT ym,version FROM payroll_runs WHERE id = ?").bind(runId).first<{ ym: string; version: number }>();
  if (!run) return json({ error: "not found" }, 404);
  const lines = (await env.DB.prepare("SELECT employee_name,employed_days,lop_days,ot_minutes,gross_paise,deductions_paise,lop_paise,net_paise,exception FROM payroll_lines WHERE run_id = ? ORDER BY employee_name").bind(runId).all<Record<string, unknown>>()).results;
  const esc = (s: unknown) => { const v = String(s ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const rupee = (p: unknown) => (Number(p) / 100).toFixed(2);
  const head = ["employee", "employed_days", "lop_days", "ot_minutes", "gross", "deductions", "lop", "net", "exception"];
  const rows = [head.join(",")];
  for (const l of lines) rows.push([esc(l.employee_name), l.employed_days, l.lop_days, l.ot_minutes, rupee(l.gross_paise), rupee(l.deductions_paise), rupee(l.lop_paise), rupee(l.net_paise), esc(l.exception)].join(","));
  await audit(env, actor.userId, "PAYROLL_REGISTER_EXPORT", "payroll", runId, `${run.ym} v${run.version}`);
  return new Response(rows.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="payroll-register-${run.ym}.csv"` } });
}

// ---- Payroll core — P6c: maker-checker controls, payslips, bank advice ----------
const PAYROLL_BLOCKING = ["negative_net", "no_salary", "zero_pay"]; // block lock; missing_bank only warns
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function payslipMonth(ym: string): string { const [y, m] = ym.split("-").map(Number); return `${MONTH_ABBR[m - 1]} ${y}`; }
const inrPaise = (p: unknown): string => "₹" + (Number(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function buildPayslipText(ym: string, l: Record<string, unknown>, comps: Array<{ name: string; kind: string; amount_paise: number }>): string {
  const paid = Number(l.employed_days) - Number(l.lop_days);
  const L: string[] = [`Payslip — ${payslipMonth(ym)}`, String(l.employee_name ?? ""), ""];
  L.push(`Paid days: ${paid} of ${l.calendar_days} · LOP: ${l.lop_days}${Number(l.ot_minutes) ? ` · OT: ${Math.round(Number(l.ot_minutes) / 6) / 10}h` : ""}`, "");
  L.push("Earnings:");
  for (const c of comps.filter((c) => c.kind === "earning")) L.push(`  ${c.name}: ${inrPaise(c.amount_paise)}`);
  const ded = comps.filter((c) => c.kind === "deduction");
  if (ded.length) { L.push("Deductions:"); for (const c of ded) L.push(`  ${c.name}: ${inrPaise(c.amount_paise)}`); }
  for (const c of comps.filter((c) => c.kind === "info")) L.push(`  (${c.name}: ${inrPaise(c.amount_paise)})`);
  L.push("", `Gross: ${inrPaise(l.gross_paise)}`, `Deductions: ${inrPaise(l.deductions_paise)}`);
  L.push(`Net pay: ₹${Math.round(Number(l.net_paise) / 100).toLocaleString("en-IN")} (exact ${inrPaise(l.net_paise)})`, "");
  L.push("4SYZ Infotech Solutions Pvt. Ltd. — computer-generated payslip.");
  return L.join("\n");
}

async function handlePayrollSubmitReview(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.prepare")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT status FROM payroll_runs WHERE id = ?").bind(runId).first<{ status: string }>();
  if (!run) return json({ error: "not found" }, 404);
  if (run.status !== "draft") return json({ error: `run is ${run.status}, not draft` }, 409);
  await env.DB.prepare("UPDATE payroll_runs SET status = 'in_review', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?").bind(actor.userId, runId).run();
  await audit(env, actor.userId, "PAYROLL_SUBMIT_REVIEW", "payroll", runId, "");
  return json({ ok: true, status: "in_review" });
}

async function handlePayrollReject(actor: Actor, env: Env, runId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.approve") && !hasPermission(actor.role, "payroll.review")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT status FROM payroll_runs WHERE id = ?").bind(runId).first<{ status: string }>();
  if (!run) return json({ error: "not found" }, 404);
  if (run.status !== "in_review") return json({ error: `run is ${run.status}, not in_review` }, 409);
  const b = await request.json().catch(() => ({})) as { comment?: string };
  await env.DB.prepare("UPDATE payroll_runs SET status = 'draft', note = ? WHERE id = ?").bind(b.comment ?? null, runId).run();
  await audit(env, actor.userId, "PAYROLL_REJECT", "payroll", runId, b.comment ?? "");
  return json({ ok: true, status: "draft" });
}

// Approve + lock + generate payslips. Enforces separation of duties (approver ≠ preparer)
// and blocks on unresolved blocking exceptions. Payslips for the month are regenerated
// (any prior month's payslips are superseded) and published to employees via Documents.
async function handlePayrollApprove(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.approve")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT ym, version, status, prepared_by FROM payroll_runs WHERE id = ?").bind(runId).first<{ ym: string; version: number; status: string; prepared_by: string | null }>();
  if (!run) return json({ error: "not found" }, 404);
  if (run.status !== "in_review") return json({ error: `run is ${run.status}, not in_review` }, 409);
  if (!canApprovePayroll(actor, run.prepared_by)) return json({ error: "separation of duties: the approver cannot be the person who prepared this run" }, 403);
  const blk = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM payroll_lines WHERE run_id = ? AND exception IN (${PAYROLL_BLOCKING.map(() => "?").join(",")})`).bind(runId, ...PAYROLL_BLOCKING).first<{ n: number }>())?.n ?? 0;
  if (blk > 0) return json({ error: `${blk} line(s) have blocking exceptions (negative net / no salary / no paid days); resolve them before approving` }, 409);
  const lines = (await env.DB.prepare("SELECT id, employee_id, employee_name, calendar_days, employed_days, lop_days, ot_minutes, gross_paise, deductions_paise, lop_paise, net_paise FROM payroll_lines WHERE run_id = ?").bind(runId).all<Record<string, unknown>>()).results;
  const compRows = (await env.DB.prepare("SELECT line_id, name, kind, amount_paise FROM payroll_line_components WHERE line_id IN (SELECT id FROM payroll_lines WHERE run_id = ?) ORDER BY sequence").bind(runId).all<{ line_id: string; name: string; kind: string; amount_paise: number }>()).results;
  const byLine = new Map<string, Array<{ name: string; kind: string; amount_paise: number }>>();
  for (const c of compRows) { const a = byLine.get(c.line_id) ?? []; a.push(c); byLine.set(c.line_id, a); }
  const title = `Payslip ${payslipMonth(run.ym)}`;
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE payroll_runs SET status = 'locked', approved_by = ?, approved_at = datetime('now'), locked_at = datetime('now') WHERE id = ?").bind(actor.userId, runId),
    // supersede any existing payslips for this month (and their documents), then regenerate
    env.DB.prepare("DELETE FROM documents WHERE id IN (SELECT document_id FROM payslips WHERE ym = ?)").bind(run.ym),
    env.DB.prepare("DELETE FROM payslips WHERE ym = ?").bind(run.ym),
  ];
  for (const l of lines) {
    const body = buildPayslipText(run.ym, l, byLine.get(String(l.id)) ?? []);
    const docId = uid();
    stmts.push(env.DB.prepare("INSERT INTO documents (id, employee_id, title, category, file, body, status, created_by, published_at) VALUES (?,?,?,?,NULL,?, 'published', ?, datetime('now'))").bind(docId, l.employee_id, title, "payslip", body, actor.userId));
    stmts.push(env.DB.prepare("INSERT INTO payslips (id, run_id, line_id, employee_id, ym, document_id) VALUES (?,?,?,?,?,?)").bind(uid(), runId, l.id, l.employee_id, run.ym, docId));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  await audit(env, actor.userId, "PAYROLL_APPROVE_LOCK", "payroll", runId, `${run.ym} v${run.version}: locked, ${lines.length} payslips`);
  return json({ ok: true, status: "locked", payslips: lines.length });
}

// Reopen a locked run for correction: creates a NEW draft version (locked version + its
// payslips are retained). The next Prepare recomputes the new version.
async function handlePayrollReopen(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.approve")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT ym, version, status FROM payroll_runs WHERE id = ?").bind(runId).first<{ ym: string; version: number; status: string }>();
  if (!run) return json({ error: "not found" }, 404);
  if (run.status !== "locked" && run.status !== "approved") return json({ error: `only a locked run can be reopened (this is ${run.status})` }, 409);
  const nextV = ((await env.DB.prepare("SELECT MAX(version) AS v FROM payroll_runs WHERE ym = ?").bind(run.ym).first<{ v: number }>())?.v ?? run.version) + 1;
  const newId = uid();
  await env.DB.prepare("INSERT INTO payroll_runs (id, ym, version, status, note) VALUES (?,?,?, 'draft', ?)").bind(newId, run.ym, nextV, `reopened from v${run.version}`).run();
  await audit(env, actor.userId, "PAYROLL_REOPEN", "payroll", newId, `${run.ym} v${run.version} → v${nextV}`);
  return json({ ok: true, runId: newId, version: nextV, status: "draft" });
}

// Bank/NEFT advice CSV (audited): decrypts bank accounts (finance only). Excludes lines
// with no bank or non-positive net, listed at the end.
async function handlePayrollBank(actor: Actor, env: Env, runId: string): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const run = await env.DB.prepare("SELECT ym, version FROM payroll_runs WHERE id = ?").bind(runId).first<{ ym: string; version: number }>();
  if (!run) return json({ error: "not found" }, 404);
  const lines = (await env.DB.prepare("SELECT employee_id, employee_name, net_paise, exception FROM payroll_lines WHERE run_id = ? ORDER BY employee_name").bind(runId).all<{ employee_id: string; employee_name: string; net_paise: number; exception: string | null }>()).results;
  type BankInfo = { account: string | null; payee: string | null; ifsc: string | null; type: string | null; bankName: string | null; verified: number | null };
  const bankById = new Map<string, BankInfo>();
  for (const r of (await env.DB.prepare("SELECT id, bank_account, bank_payee_name, bank_ifsc, bank_account_type, bank_name, bank_verified FROM employees").all<{ id: string; bank_account: string | null; bank_payee_name: string | null; bank_ifsc: string | null; bank_account_type: string | null; bank_name: string | null; bank_verified: number | null }>()).results) {
    bankById.set(r.id, { account: await decryptField(r.bank_account, env.FIELD_ENC_KEY), payee: r.bank_payee_name, ifsc: r.bank_ifsc, type: r.bank_account_type, bankName: r.bank_name, verified: r.bank_verified });
  }
  const esc = (s: unknown) => { const v = String(s ?? ""); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const rupee = (p: unknown) => (Number(p) / 100).toFixed(2);
  const rows = ["employee,payee_name,account_number,ifsc,account_type,bank_name,net,kyc_verified"];
  const skipped: string[] = []; const unverified: string[] = [];
  for (const l of lines) {
    const b = bankById.get(l.employee_id);
    if (!b?.account || Number(l.net_paise) <= 0) { skipped.push(l.employee_name); continue; }
    if (!b.verified) unverified.push(l.employee_name);
    rows.push([esc(l.employee_name), esc(b.payee), esc(b.account), esc(b.ifsc), esc(b.type), esc(b.bankName), rupee(l.net_paise), b.verified ? "yes" : "no"].join(","));
  }
  if (skipped.length) rows.push(`# excluded (no account / non-positive net): ${skipped.join("; ")}`);
  if (unverified.length) rows.push(`# WARNING — KYC not verified (verify before release): ${unverified.join("; ")}`);
  await audit(env, actor.userId, "PAYROLL_BANK_EXPORT", "payroll", runId, `${run.ym} v${run.version}, ${skipped.length} excluded, ${unverified.length} unverified`);
  return new Response(rows.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bank-advice-${run.ym}.csv"` } });
}

// ---- Lifecycle / tenure: resignation → notice → LWD → F&F + checklists ----------

// Submit a resignation. An employee tenders their own; HR (employee.manage) may record one
// on an employee's behalf by passing employeeId. The notice term is snapshotted at tender.
async function handleResignSubmit(actor: Actor, env: Env, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const onBehalf = _s(b.employeeId);
  const empId = onBehalf && onBehalf !== actor.employeeId ? onBehalf : actor.employeeId;
  if (!empId) return json({ error: "no employee record linked to this login" }, 404);
  if (empId !== actor.employeeId && !hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  const emp = await env.DB.prepare("SELECT notice_period_days FROM employees WHERE id = ?").bind(empId).first<{ notice_period_days: number | null }>();
  if (!emp) return json({ error: "employee not found" }, 404);
  const resignationDate = _s(b.resignationDate) || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resignationDate)) return json({ error: "valid resignationDate (YYYY-MM-DD) required" }, 400);
  const active = await env.DB.prepare("SELECT id FROM resignations WHERE employee_id = ? AND status IN ('submitted','accepted')").bind(empId).first();
  if (active) return json({ error: "an open resignation already exists for this employee" }, 409);
  const noticeDays = emp.notice_period_days ?? 30;
  const requestedLwd = _s(b.requestedLwd) || suggestLWD(resignationDate, noticeDays);
  const id = "rsg_" + uid().replace(/-/g, "").slice(0, 12);
  await env.DB.prepare(
    "INSERT INTO resignations (id, employee_id, submitted_by, resignation_date, reason, notice_days, requested_lwd, status) VALUES (?,?,?,?,?,?,?,'submitted')"
  ).bind(id, empId, actor.userId, resignationDate, _s(b.reason), noticeDays, requestedLwd).run();
  await audit(env, actor.userId, "RESIGNATION_SUBMIT", "employee", empId, `resignation tendered ${resignationDate}, suggested LWD ${requestedLwd}`);
  return json({ ok: true, id, suggestedLwd: requestedLwd, noticeDays });
}

// Resignations list: an employee sees their own; employee.manage sees all with names.
async function handleResignList(actor: Actor, env: Env): Promise<Response> {
  if (hasPermission(actor.role, "employee.manage")) {
    const rows = (await env.DB.prepare(
      "SELECT r.*, e.name AS employee_name FROM resignations r LEFT JOIN employees e ON e.id = r.employee_id ORDER BY r.created_at DESC LIMIT 300"
    ).all()).results;
    return json({ resignations: rows, manage: true });
  }
  if (!actor.employeeId) return json({ resignations: [] });
  const rows = (await env.DB.prepare("SELECT * FROM resignations WHERE employee_id = ? ORDER BY created_at DESC").bind(actor.employeeId).all()).results;
  return json({ resignations: rows, manage: false });
}

// Employee withdraws their own resignation while it is still only submitted (not yet accepted).
async function handleResignWithdraw(actor: Actor, env: Env, id: string): Promise<Response> {
  const r = await env.DB.prepare("SELECT employee_id, status FROM resignations WHERE id = ?").bind(id).first<{ employee_id: string; status: string }>();
  if (!r) return json({ error: "not found" }, 404);
  if (r.employee_id !== actor.employeeId) return json({ error: "forbidden" }, 403);
  if (r.status !== "submitted") return json({ error: `cannot withdraw a ${r.status} resignation` }, 409);
  await env.DB.prepare("UPDATE resignations SET status='withdrawn', decided_by=?, decided_at=datetime('now') WHERE id=?").bind(actor.userId, id).run();
  await audit(env, actor.userId, "RESIGNATION_WITHDRAW", "employee", r.employee_id, `withdrew resignation ${id}`);
  return json({ ok: true });
}

// HR decides a resignation: accept (set LWD, move to notice), reject, or complete (exit).
async function handleResignDecide(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  const r = await env.DB.prepare("SELECT employee_id, status, resignation_date, notice_days FROM resignations WHERE id = ?").bind(id).first<{ employee_id: string; status: string; resignation_date: string; notice_days: number | null }>();
  if (!r) return json({ error: "not found" }, 404);
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = _s(b.action);
  const hrNotes = _s(b.hrNotes);
  if (action === "accept") {
    if (r.status !== "submitted" && r.status !== "accepted") return json({ error: `cannot accept a ${r.status} resignation` }, 409);
    const lwd = _s(b.acceptedLwd) || suggestLWD(r.resignation_date, r.notice_days ?? 30);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lwd)) return json({ error: "valid acceptedLwd (YYYY-MM-DD) required" }, 400);
    await env.DB.batch([
      env.DB.prepare("UPDATE resignations SET status='accepted', accepted_lwd=?, hr_notes=?, decided_by=?, decided_at=datetime('now') WHERE id=?").bind(lwd, hrNotes, actor.userId, id),
      env.DB.prepare("UPDATE employees SET employment_status='notice' WHERE id=?").bind(r.employee_id),
    ]);
    await audit(env, actor.userId, "RESIGNATION_ACCEPT", "employee", r.employee_id, `accepted; LWD ${lwd}`);
    return json({ ok: true, acceptedLwd: lwd });
  }
  if (action === "reject") {
    await env.DB.prepare("UPDATE resignations SET status='rejected', hr_notes=?, decided_by=?, decided_at=datetime('now') WHERE id=?").bind(hrNotes, actor.userId, id).run();
    await audit(env, actor.userId, "RESIGNATION_REJECT", "employee", r.employee_id, "rejected");
    return json({ ok: true });
  }
  if (action === "complete") {
    if (r.status !== "accepted") return json({ error: "accept and set the LWD before completing exit" }, 409);
    const row = await env.DB.prepare("SELECT accepted_lwd FROM resignations WHERE id=?").bind(id).first<{ accepted_lwd: string | null }>();
    const lwd = row?.accepted_lwd;
    if (!lwd) return json({ error: "no accepted LWD on file" }, 409);
    await env.DB.batch([
      env.DB.prepare("UPDATE resignations SET status='completed', hr_notes=COALESCE(?,hr_notes), decided_by=?, decided_at=datetime('now') WHERE id=?").bind(hrNotes, actor.userId, id),
      env.DB.prepare("UPDATE employees SET employment_status='exited', date_of_exit=?, exit_reason=COALESCE(NULLIF(exit_reason,''),'Resignation'), exit_status='relieved' WHERE id=?").bind(lwd, r.employee_id),
    ]);
    await audit(env, actor.userId, "RESIGNATION_COMPLETE", "employee", r.employee_id, `exit completed; date of exit ${lwd}`);
    return json({ ok: true, dateOfExit: lwd });
  }
  return json({ error: "action must be accept, reject or complete" }, 400);
}

// Full & Final settlement ESTIMATE (review-only; never posted). Gated on payroll.read_all
// since it exposes compensation. Resolves salary, tenure and leave balance, then runs the
// pure engine. The caller can disable notice recovery with ?recover=0.
async function handleFnF(actor: Actor, env: Env, employeeId: string, url: URL): Promise<Response> {
  if (!hasPermission(actor.role, "payroll.read_all")) return json({ error: "forbidden" }, 403);
  const emp = await env.DB.prepare("SELECT name, date_of_joining FROM employees WHERE id = ?").bind(employeeId).first<{ name: string; date_of_joining: string | null }>();
  if (!emp) return json({ error: "employee not found" }, 404);
  const rsg = await env.DB.prepare(
    "SELECT resignation_date, accepted_lwd, notice_days, status FROM resignations WHERE employee_id = ? AND status IN ('accepted','completed') ORDER BY created_at DESC LIMIT 1"
  ).bind(employeeId).first<{ resignation_date: string; accepted_lwd: string | null; notice_days: number | null; status: string }>();
  if (!rsg || !rsg.accepted_lwd) return json({ error: "no accepted resignation with a last working day for this employee" }, 409);
  const lwd = rsg.accepted_lwd;

  // Current (open) salary; basic+DA basis from its fixed components, else fall back to gross.
  const sal = await env.DB.prepare("SELECT id, monthly_gross_paise FROM employee_salaries WHERE employee_id = ? AND effective_to IS NULL ORDER BY effective_from DESC LIMIT 1").bind(employeeId).first<{ id: string; monthly_gross_paise: number }>();
  const monthlyGrossPaise = sal?.monthly_gross_paise ?? 0;
  let basicDaPaise = 0;
  if (sal) {
    const comps = (await env.DB.prepare("SELECT value FROM employee_salary_components WHERE employee_salary_id = ? AND calc_method = 'fixed' AND component_code IN ('BASIC','DA')").bind(sal.id).all<{ value: number }>()).results;
    basicDaPaise = comps.reduce((s, c) => s + (Number(c.value) || 0), 0);
  }
  const basisLabel = basicDaPaise > 0 ? "basic+DA" : "gross (no basic split on file)";
  const basis = basicDaPaise > 0 ? basicDaPaise : monthlyGrossPaise;

  const modeRow = await env.DB.prepare("SELECT value FROM portal_config WHERE key = 'payroll_divisor'").first<{ value: string }>();
  const mode: DivisorMode = modeRow?.value === "fixed_30" ? "fixed_30" : modeRow?.value === "fixed_26" ? "fixed_26" : "calendar";
  const salaryDivisor = divisorDays(lwd.slice(0, 7), mode);
  const encDivRow = await env.DB.prepare("SELECT value FROM portal_config WHERE key = 'fnf_encash_divisor'").first<{ value: string }>();
  const encashDivisor = Number(encDivRow?.value) > 0 ? Number(encDivRow!.value) : 30;
  const encCodeRow = await env.DB.prepare("SELECT value FROM portal_config WHERE key = 'fnf_encash_leave_code'").first<{ value: string }>();
  const encashCode = encCodeRow?.value || "EL";

  // Encashable leave = available balance of the configured leave type, current year.
  const year = new Date().getUTCFullYear();
  const lt = await env.DB.prepare("SELECT id FROM leave_types WHERE code = ?").bind(encashCode).first<{ id: string }>();
  let encashableLeaveDays = 0;
  if (lt) {
    const bal = await env.DB.prepare("SELECT entitled, used FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?").bind(employeeId, lt.id, year).first<{ entitled: number; used: number }>();
    if (bal) encashableLeaveDays = Math.max(0, (bal.entitled || 0) - (bal.used || 0));
  }

  const recoverNoticeShortfall = url.searchParams.get("recover") !== "0";
  const input: FnFInput = {
    doj: emp.date_of_joining, lwd, resignationDate: rsg.resignation_date, requiredNoticeDays: rsg.notice_days ?? 30,
    monthlyGrossPaise, encashBasisPaise: basis, gratuityBasisPaise: basis,
    salaryDivisor, encashDivisor, finalMonthPayableDays: Number(lwd.slice(8, 10)),
    encashableLeaveDays, recoverNoticeShortfall,
  };
  const worksheet = computeFnF(input);
  await audit(env, actor.userId, "FNF_VIEW", "employee", employeeId, `viewed F&F estimate (LWD ${lwd})`);
  return json({
    employee: { id: employeeId, name: emp.name, dateOfJoining: emp.date_of_joining },
    lwd, resignationDate: rsg.resignation_date, status: rsg.status,
    monthlyGrossPaise, basisPaise: basis, basisLabel, encashCode, salaryDivisor, encashDivisor,
    worksheet,
  });
}

// Checklists: seed a default onboarding/offboarding list, read it, and tick items off.
async function handleChecklistInit(actor: Actor, env: Env, employeeId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  if (!(await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(employeeId).first())) return json({ error: "employee not found" }, 404);
  const b = await request.json().catch(() => ({})) as { kind?: string };
  const kind = b.kind === "offboarding" ? "offboarding" : "onboarding";
  const items = kind === "offboarding" ? OFFBOARDING_ITEMS : ONBOARDING_ITEMS;
  await env.DB.batch(items.map((it, i) =>
    env.DB.prepare("INSERT OR IGNORE INTO lifecycle_tasks (id, employee_id, kind, item_code, label, sort_order) VALUES (?,?,?,?,?,?)")
      .bind("lct_" + uid().replace(/-/g, "").slice(0, 12), employeeId, kind, it.code, it.label, i)));
  await audit(env, actor.userId, "CHECKLIST_INIT", "employee", employeeId, `seeded ${kind} checklist`);
  return json({ ok: true, kind, seeded: items.length });
}
async function handleChecklistGet(actor: Actor, env: Env, employeeId: string, url: URL): Promise<Response> {
  const own = actor.employeeId === employeeId;
  if (!own && !hasPermission(actor.role, "employee.read_all") && !hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  const kind = url.searchParams.get("kind") === "offboarding" ? "offboarding" : "onboarding";
  const items = (await env.DB.prepare("SELECT id, kind, item_code, label, status, note, done_at FROM lifecycle_tasks WHERE employee_id = ? AND kind = ? ORDER BY sort_order").bind(employeeId, kind).all()).results;
  const done = items.filter((i) => (i as { status: string }).status === "done").length;
  return json({ kind, items, done, total: items.length });
}
async function handleChecklistUpdate(actor: Actor, env: Env, itemId: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "employee.manage")) return json({ error: "forbidden" }, 403);
  const it = await env.DB.prepare("SELECT employee_id FROM lifecycle_tasks WHERE id = ?").bind(itemId).first<{ employee_id: string }>();
  if (!it) return json({ error: "not found" }, 404);
  const b = await request.json().catch(() => ({})) as { status?: string; note?: string };
  const status = ["pending", "done", "na"].includes(String(b.status)) ? String(b.status) : "pending";
  await env.DB.prepare("UPDATE lifecycle_tasks SET status=?, note=?, done_by=CASE WHEN ?='done' THEN ? ELSE done_by END, done_at=CASE WHEN ?='done' THEN datetime('now') ELSE NULL END WHERE id=?")
    .bind(status, _s(b.note), status, actor.userId, status, itemId).run();
  await audit(env, actor.userId, "CHECKLIST_UPDATE", "employee", it.employee_id, `${itemId} → ${status}`);
  return json({ ok: true, status });
}

// ---- FR-04 Approvals (unified inbox + delegation) ------------------------------
function isApprover(actor: Actor): boolean {
  return hasPermission(actor.role, "leave.approve_team") || hasPermission(actor.role, "leave.approve_all")
    || hasPermission(actor.role, "attendance.approve_team") || hasPermission(actor.role, "attendance.approve_all");
}

// Employee ids of people who have delegated active approval authority to this employee.
async function activeDelegatorIds(env: Env, delegateEmployeeId: string): Promise<string[]> {
  const today = todayISO();
  const rows = (await env.DB.prepare("SELECT delegator_employee_id, starts_on, ends_on, active FROM approval_delegations WHERE delegate_employee_id = ?")
    .bind(delegateEmployeeId).all<{ delegator_employee_id: string; starts_on: string | null; ends_on: string | null; active: number }>()).results;
  return rows.filter((r) => isDelegationActive({ active: r.active, startsOn: r.starts_on, endsOn: r.ends_on }, today)).map((r) => r.delegator_employee_id);
}

// Whose requests this actor may approve: "ALL" for HR/super, else own direct reports
// plus the direct reports of anyone who has delegated to them.
async function approvableEmployeeIds(env: Env, actor: Actor): Promise<"ALL" | string[]> {
  if (hasPermission(actor.role, "leave.approve_all") || hasPermission(actor.role, "attendance.approve_all")) return "ALL";
  const ids = new Set<string>();
  if (actor.employeeId) {
    const managers = [actor.employeeId, ...await activeDelegatorIds(env, actor.employeeId)];
    for (const mgr of managers) {
      const reports = (await env.DB.prepare("SELECT id FROM employees WHERE manager_id = ?").bind(mgr).all<{ id: string }>()).results;
      for (const r of reports) ids.add(r.id);
    }
  }
  return [...ids];
}

// Does this actor hold delegated authority over this specific employee right now?
async function hasDelegatedAuthority(env: Env, actor: Actor, target: EmployeeRecord): Promise<boolean> {
  if (!actor.employeeId || !target.managerId) return false;
  return (await activeDelegatorIds(env, actor.employeeId)).includes(target.managerId);
}

async function handleApprovals(actor: Actor, env: Env): Promise<Response> {
  const scope = await approvableEmployeeIds(env, actor);
  const items: Array<Record<string, unknown>> = [];
  const placeholders = (ids: string[]) => ids.map(() => "?").join(",");

  const pendingLeave = async (where: string, binds: unknown[]): Promise<any[]> => (await env.DB.prepare(
    `SELECT r.id, r.employee_id, e.name AS employee_name, t.code AS type_code, r.start_date, r.end_date, r.days, r.reason, r.created_at FROM leave_requests r JOIN employees e ON e.id=r.employee_id JOIN leave_types t ON t.id=r.leave_type_id WHERE r.status='pending' AND ${where} ORDER BY r.created_at ASC LIMIT 200`
  ).bind(...binds).all()).results as any[];
  const pendingAtt = async (where: string, binds: unknown[]): Promise<any[]> => (await env.DB.prepare(
    `SELECT c.id, c.employee_id, e.name AS employee_name, c.date, c.type, c.requested_in, c.requested_out, c.reason, c.created_at FROM attendance_corrections c JOIN employees e ON e.id=c.employee_id WHERE c.status='pending' AND ${where} ORDER BY c.created_at ASC LIMIT 200`
  ).bind(...binds).all()).results as any[];

  let leaveRows: any[] = [], attRows: any[] = [];
  if (scope === "ALL") {
    leaveRows = await pendingLeave("r.employee_id != ?", [actor.employeeId ?? ""]);
    attRows = await pendingAtt("c.employee_id != ?", [actor.employeeId ?? ""]);
  } else if (scope.length) {
    leaveRows = await pendingLeave(`r.employee_id IN (${placeholders(scope)})`, scope);
    attRows = await pendingAtt(`c.employee_id IN (${placeholders(scope)})`, scope);
  }
  for (const r of leaveRows) items.push({ kind: "leave", id: r.id, employeeName: r.employee_name, title: `${r.type_code} · ${r.days}d`, detail: `${r.start_date} → ${r.end_date}${r.reason ? " · " + r.reason : ""}`, createdAt: r.created_at, decideBase: `/api/leave/requests/${r.id}` });
  for (const r of attRows) items.push({ kind: "attendance", id: r.id, employeeName: r.employee_name, title: `${r.type} · ${r.date}`, detail: `${r.requested_in || "--:--"} → ${r.requested_out || "--:--"}${r.reason ? " · " + r.reason : ""}`, createdAt: r.created_at, decideBase: `/api/attendance/corrections/${r.id}` });

  if (hasPermission(actor.role, "profile.verify")) {
    const pcs = (await env.DB.prepare("SELECT p.id, p.employee_id, e.name AS employee_name, p.field, p.requested_at FROM profile_change_requests p LEFT JOIN employees e ON e.id=p.employee_id WHERE p.status='pending' ORDER BY p.requested_at ASC LIMIT 200").all()).results as any[];
    for (const r of pcs) items.push({ kind: "profile", id: r.id, employeeName: r.employee_name || r.employee_id, title: `profile · ${r.field}`, detail: "identity/financial change", createdAt: r.requested_at, decideBase: `/api/admin/profile/changes/${r.id}` });
  }
  items.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return json({ approvals: items, count: items.length });
}

async function handleDelegationList(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ delegatedOut: [], delegatedToMe: [] });
  const delegatedOut = (await env.DB.prepare("SELECT d.id, d.delegate_employee_id, e.name AS delegate_name, d.starts_on, d.ends_on, d.active FROM approval_delegations d LEFT JOIN employees e ON e.id=d.delegate_employee_id WHERE d.delegator_employee_id=? ORDER BY d.created_at DESC").bind(actor.employeeId).all()).results;
  const delegatedToMe = (await env.DB.prepare("SELECT d.id, d.delegator_employee_id, e.name AS delegator_name, d.starts_on, d.ends_on, d.active FROM approval_delegations d LEFT JOIN employees e ON e.id=d.delegator_employee_id WHERE d.delegate_employee_id=? ORDER BY d.created_at DESC").bind(actor.employeeId).all()).results;
  return json({ delegatedOut, delegatedToMe });
}

async function handleDelegationCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!isApprover(actor) || !actor.employeeId) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { delegateEmployeeId?: string; startsOn?: string; endsOn?: string };
  const delegate = String(b.delegateEmployeeId ?? "").trim();
  if (!delegate) return json({ error: "delegateEmployeeId required" }, 400);
  if (delegate === actor.employeeId) return json({ error: "cannot delegate to yourself" }, 400);
  const emp = await env.DB.prepare("SELECT id FROM employees WHERE id=?").bind(delegate).first();
  if (!emp) return json({ error: "unknown delegate" }, 404);
  const id = uid();
  await env.DB.prepare("INSERT INTO approval_delegations (id, delegator_employee_id, delegate_employee_id, starts_on, ends_on, created_by) VALUES (?,?,?,?,?,?)")
    .bind(id, actor.employeeId, delegate, b.startsOn || null, b.endsOn || null, actor.userId).run();
  await audit(env, actor.userId, "DELEGATION_CREATE", "approval", id, `to ${delegate} ${b.startsOn || ""}..${b.endsOn || ""}`);
  return json({ ok: true, id });
}

async function handleDelegationRevoke(actor: Actor, env: Env, id: string): Promise<Response> {
  const d = await env.DB.prepare("SELECT delegator_employee_id FROM approval_delegations WHERE id=?").bind(id).first<{ delegator_employee_id: string }>();
  if (!d) return json({ error: "not found" }, 404);
  const canRevoke = d.delegator_employee_id === actor.employeeId || hasPermission(actor.role, "user.manage") || actor.role === "super_admin";
  if (!canRevoke) return json({ error: "forbidden" }, 403);
  await env.DB.prepare("UPDATE approval_delegations SET active=0 WHERE id=?").bind(id).run();
  await audit(env, actor.userId, "DELEGATION_REVOKE", "approval", id, "");
  return json({ ok: true, revoked: true });
}

// ---- FR-09 Helpdesk + FR-21 POSH -----------------------------------------------
async function isPoshCommittee(env: Env, actor: Actor): Promise<boolean> {
  if (!actor.employeeId) return false;
  return !!(await env.DB.prepare("SELECT 1 FROM posh_committee WHERE employee_id = ?").bind(actor.employeeId).first());
}
function ticketFlags(actor: Actor, committee: boolean) {
  return { isAgent: hasPermission(actor.role, "helpdesk.agent"), isCommittee: committee };
}

async function handleTicketCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const b = await request.json().catch(() => ({})) as { category?: string; subject?: string; description?: string };
  const category = String(b.category ?? "").trim();
  const subject = String(b.subject ?? "").trim();
  if (!isValidCategory(category)) return json({ error: "invalid category" }, 400);
  if (!subject) return json({ error: "subject required" }, 400);
  const id = uid();
  await env.DB.prepare("INSERT INTO tickets (id, employee_id, category, subject, description) VALUES (?,?,?,?,?)")
    .bind(id, actor.employeeId, category, subject, String(b.description ?? "")).run();
  // POSH subjects are confidential — keep them out of the audit detail.
  await audit(env, actor.userId, "TICKET_CREATE", "ticket", id, category === "posh" ? "posh complaint filed" : `${category}: ${subject.slice(0, 40)}`);
  return json({ ok: true, id, status: "open" });
}

async function handleMyTickets(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ tickets: [] });
  const now = new Date().toISOString();
  const rows = (await env.DB.prepare("SELECT id, category, subject, status, created_at, updated_at FROM tickets WHERE employee_id = ? ORDER BY updated_at DESC LIMIT 100").bind(actor.employeeId).all()).results as any[];
  const tickets = rows.map((r) => ({ ...r, slaDue: slaDueISO(r.created_at, r.category), overdue: isOverdue(r.created_at, r.category, r.status, now) }));
  return json({ tickets });
}

async function handleTicketQueue(actor: Actor, env: Env): Promise<Response> {
  const isAgent = hasPermission(actor.role, "helpdesk.agent");
  const committee = await isPoshCommittee(env, actor);
  if (!isAgent && !committee) return json({ tickets: [], count: 0 });
  const conds: string[] = [];
  if (isAgent) conds.push("t.category != 'posh'");
  if (committee) conds.push("t.category = 'posh'");
  const now = new Date().toISOString();
  const rows = (await env.DB.prepare(
    `SELECT t.id, t.employee_id, e.name AS employee_name, t.category, t.subject, t.status, t.created_at FROM tickets t JOIN employees e ON e.id = t.employee_id WHERE (${conds.join(" OR ")}) AND t.status IN ('open','in_progress') AND t.employee_id != ? ORDER BY t.created_at ASC LIMIT 200`
  ).bind(actor.employeeId ?? "").all()).results as any[];
  const tickets = rows.map((r) => ({ ...r, slaDue: slaDueISO(r.created_at, r.category), overdue: isOverdue(r.created_at, r.category, r.status, now) }));
  return json({ tickets, count: tickets.length });
}

async function handleTicketDetail(actor: Actor, env: Env, id: string): Promise<Response> {
  const t = await env.DB.prepare("SELECT id, employee_id, category, subject, description, status, assignee_user_id, created_at, updated_at, resolved_at FROM tickets WHERE id = ?").bind(id).first<any>();
  if (!t) return json({ error: "not found" }, 404);
  const flags = ticketFlags(actor, await isPoshCommittee(env, actor));
  if (!canViewTicket(actor.employeeId, { employeeId: t.employee_id, category: t.category }, flags)) {
    await audit(env, actor.userId, "DENY", "ticket", id, "view denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  if (t.category === "posh" && actor.employeeId !== t.employee_id) await audit(env, actor.userId, "POSH_VIEW", "ticket", id, "committee viewed POSH complaint");
  const comments = (await env.DB.prepare("SELECT c.id, c.body, c.created_at, e.name AS author_name, u.role AS author_role FROM ticket_comments c LEFT JOIN users u ON u.id = c.author_user_id LEFT JOIN employees e ON e.id = u.employee_id WHERE c.ticket_id = ? ORDER BY c.created_at ASC").bind(id).all()).results;
  const now = new Date().toISOString();
  return json({ ticket: { ...t, slaDue: slaDueISO(t.created_at, t.category), overdue: isOverdue(t.created_at, t.category, t.status, now) }, comments, canHandle: canHandleTicket({ employeeId: t.employee_id, category: t.category }, flags) });
}

async function handleTicketComment(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  const t = await env.DB.prepare("SELECT employee_id, category FROM tickets WHERE id = ?").bind(id).first<{ employee_id: string; category: string }>();
  if (!t) return json({ error: "not found" }, 404);
  const flags = ticketFlags(actor, await isPoshCommittee(env, actor));
  if (!canViewTicket(actor.employeeId, { employeeId: t.employee_id, category: t.category }, flags)) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { body?: string };
  const body = String(b.body ?? "").trim();
  if (!body) return json({ error: "comment body required" }, 400);
  const cid = uid();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ticket_comments (id, ticket_id, author_user_id, body) VALUES (?,?,?,?)").bind(cid, id, actor.userId, body),
    env.DB.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").bind(id),
  ]);
  await audit(env, actor.userId, "TICKET_COMMENT", "ticket", id, "");
  return json({ ok: true, id: cid });
}

async function handleTicketStatus(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  const t = await env.DB.prepare("SELECT employee_id, category FROM tickets WHERE id = ?").bind(id).first<{ employee_id: string; category: string }>();
  if (!t) return json({ error: "not found" }, 404);
  const flags = ticketFlags(actor, await isPoshCommittee(env, actor));
  if (!canHandleTicket({ employeeId: t.employee_id, category: t.category }, flags)) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { status?: string; assigneeUserId?: string };
  const status = String(b.status ?? "").trim();
  if (!isValidStatus(status)) return json({ error: "invalid status" }, 400);
  const resolvedExpr = status === "resolved" || status === "closed" ? "datetime('now')" : "resolved_at";
  await env.DB.prepare(`UPDATE tickets SET status = ?, assignee_user_id = COALESCE(?, assignee_user_id), updated_at = datetime('now'), resolved_at = ${resolvedExpr} WHERE id = ?`)
    .bind(status, b.assigneeUserId ?? null, id).run();
  await audit(env, actor.userId, "TICKET_STATUS", "ticket", id, status);
  return json({ ok: true, status });
}

async function handlePoshCommitteeList(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "posh.manage")) return json({ error: "forbidden" }, 403);
  const members = (await env.DB.prepare("SELECT p.employee_id, e.name FROM posh_committee p LEFT JOIN employees e ON e.id = p.employee_id ORDER BY e.name").all()).results;
  return json({ members });
}
async function handlePoshCommitteeAdd(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "posh.manage")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { employeeId?: string };
  const eid = String(b.employeeId ?? "").trim();
  if (!eid) return json({ error: "employeeId required" }, 400);
  if (!(await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(eid).first())) return json({ error: "unknown employee" }, 404);
  await env.DB.prepare("INSERT OR IGNORE INTO posh_committee (employee_id, added_by) VALUES (?,?)").bind(eid, actor.userId).run();
  await audit(env, actor.userId, "POSH_COMMITTEE_ADD", "posh", eid, "");
  return json({ ok: true });
}
async function handlePoshCommitteeRemove(actor: Actor, env: Env, eid: string): Promise<Response> {
  if (!hasPermission(actor.role, "posh.manage")) return json({ error: "forbidden" }, 403);
  await env.DB.prepare("DELETE FROM posh_committee WHERE employee_id = ?").bind(eid).run();
  await audit(env, actor.userId, "POSH_COMMITTEE_REMOVE", "posh", eid, "");
  return json({ ok: true });
}

// ---- FR-07 Announcements -------------------------------------------------------
async function employeeSegment(env: Env, actor: Actor): Promise<string | null> {
  if (!actor.employeeId) return null;
  const r = await env.DB.prepare("SELECT segment FROM employees WHERE id = ?").bind(actor.employeeId).first<{ segment: string }>();
  return r ? r.segment : null;
}

async function handleAnnouncementsFeed(actor: Actor, env: Env): Promise<Response> {
  const segment = await employeeSegment(env, actor);
  const rows = (await env.DB.prepare(
    "SELECT a.id, a.title, a.body, a.audience, a.requires_ack, a.version, a.published_at, " +
    "EXISTS(SELECT 1 FROM announcement_acks k WHERE k.announcement_id = a.id AND k.employee_id = ? AND k.version = a.version) AS acked " +
    "FROM announcements a WHERE a.active = 1 AND (a.audience = 'all' OR a.audience = ?) ORDER BY a.published_at DESC LIMIT 100"
  ).bind(actor.employeeId ?? "", segment ?? "").all()).results as any[];
  const announcements = rows.map((r) => ({ id: r.id, title: r.title, body: r.body, audience: r.audience, requiresAck: !!r.requires_ack, version: r.version, publishedAt: r.published_at, acked: !!r.acked }));
  return json({ announcements });
}

async function handleAnnouncementAck(actor: Actor, env: Env, id: string): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const a = await env.DB.prepare("SELECT audience, version, active FROM announcements WHERE id = ?").bind(id).first<{ audience: string; version: number; active: number }>();
  if (!a || !a.active) return json({ error: "not found" }, 404);
  const segment = await employeeSegment(env, actor);
  if (!audienceMatches(a.audience, segment)) return json({ error: "not targeted to you" }, 403);
  await env.DB.prepare("INSERT OR IGNORE INTO announcement_acks (id, announcement_id, employee_id, version) VALUES (?,?,?,?)").bind(uid(), id, actor.employeeId, a.version).run();
  await audit(env, actor.userId, "ANNOUNCEMENT_ACK", "announcement", id, `v${a.version}`);
  return json({ ok: true });
}

async function handleAnnouncementCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "announcement.publish")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { title?: string; body?: string; audience?: string; requiresAck?: boolean };
  const title = String(b.title ?? "").trim();
  const audience = String(b.audience ?? "all").trim();
  if (!title) return json({ error: "title required" }, 400);
  if (!isValidAudience(audience)) return json({ error: "invalid audience" }, 400);
  const id = uid();
  await env.DB.prepare("INSERT INTO announcements (id, title, body, audience, requires_ack, published_by) VALUES (?,?,?,?,?,?)")
    .bind(id, title, String(b.body ?? ""), audience, b.requiresAck ? 1 : 0, actor.userId).run();
  await audit(env, actor.userId, "ANNOUNCEMENT_CREATE", "announcement", id, `${audience}${b.requiresAck ? " (ack)" : ""}`);
  return json({ ok: true, id });
}

async function handleAnnouncementAdminList(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "announcement.publish")) return json({ error: "forbidden" }, 403);
  const rows = (await env.DB.prepare("SELECT a.id, a.title, a.audience, a.requires_ack, a.version, a.active, a.published_at, (SELECT COUNT(*) FROM announcement_acks k WHERE k.announcement_id = a.id AND k.version = a.version) AS ack_count FROM announcements a ORDER BY a.published_at DESC LIMIT 200").all()).results as any[];
  const announcements = rows.map((r) => ({ id: r.id, title: r.title, audience: r.audience, requiresAck: !!r.requires_ack, version: r.version, active: !!r.active, publishedAt: r.published_at, ackCount: r.ack_count }));
  return json({ announcements });
}

async function handleAnnouncementUpdate(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "announcement.publish")) return json({ error: "forbidden" }, 403);
  if (!(await env.DB.prepare("SELECT id FROM announcements WHERE id = ?").bind(id).first())) return json({ error: "not found" }, 404);
  const b = await request.json().catch(() => ({})) as { title?: string; body?: string; audience?: string; requiresAck?: boolean };
  const title = String(b.title ?? "").trim();
  const audience = String(b.audience ?? "all").trim();
  if (!title) return json({ error: "title required" }, 400);
  if (!isValidAudience(audience)) return json({ error: "invalid audience" }, 400);
  // Bump the version — prior acknowledgements no longer count, so people re-ack.
  await env.DB.prepare("UPDATE announcements SET title=?, body=?, audience=?, requires_ack=?, version=version+1, updated_at=datetime('now') WHERE id=?")
    .bind(title, String(b.body ?? ""), audience, b.requiresAck ? 1 : 0, id).run();
  await audit(env, actor.userId, "ANNOUNCEMENT_UPDATE", "announcement", id, "re-published (version bumped)");
  return json({ ok: true });
}

async function handleAnnouncementActive(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "announcement.publish")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { active?: boolean };
  await env.DB.prepare("UPDATE announcements SET active=?, updated_at=datetime('now') WHERE id=?").bind(b.active ? 1 : 0, id).run();
  await audit(env, actor.userId, "ANNOUNCEMENT_ACTIVE", "announcement", id, b.active ? "activated" : "retired");
  return json({ ok: true });
}

async function handleAnnouncementAcks(actor: Actor, env: Env, id: string): Promise<Response> {
  if (!hasPermission(actor.role, "announcement.publish")) return json({ error: "forbidden" }, 403);
  const a = await env.DB.prepare("SELECT version FROM announcements WHERE id = ?").bind(id).first<{ version: number }>();
  if (!a) return json({ error: "not found" }, 404);
  const acks = (await env.DB.prepare("SELECT k.employee_id, e.name, k.acked_at FROM announcement_acks k LEFT JOIN employees e ON e.id = k.employee_id WHERE k.announcement_id = ? AND k.version = ? ORDER BY k.acked_at DESC").bind(id, a.version).all()).results;
  return json({ version: a.version, acks });
}

// ---- FR-05 Tasks ----------------------------------------------------------------
async function handleMyTasks(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ tasks: [] });
  const today = todayISO();
  const rows = (await env.DB.prepare(
    "SELECT t.id, t.title, t.description, t.due_date, t.priority, t.status, t.evidence, t.created_at, t.completed_at, be.name AS assigned_by_name " +
    "FROM tasks t LEFT JOIN users u ON u.id = t.assigned_by_user_id LEFT JOIN employees be ON be.id = u.employee_id " +
    "WHERE t.assignee_employee_id = ? ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, t.due_date IS NULL, t.due_date ASC LIMIT 200"
  ).bind(actor.employeeId).all()).results as any[];
  const tasks = rows.map((r) => ({ id: r.id, title: r.title, description: r.description, dueDate: r.due_date, priority: r.priority, status: r.status, evidence: r.evidence, assignedByName: r.assigned_by_name, overdue: taskOverdue(r.due_date, r.status, today) }));
  return json({ tasks });
}

async function handleAssignedTasks(actor: Actor, env: Env): Promise<Response> {
  const today = todayISO();
  const rows = (await env.DB.prepare(
    "SELECT t.id, t.title, t.due_date, t.priority, t.status, e.name AS assignee_name FROM tasks t LEFT JOIN employees e ON e.id = t.assignee_employee_id WHERE t.assigned_by_user_id = ? ORDER BY t.created_at DESC LIMIT 200"
  ).bind(actor.userId).all()).results as any[];
  const tasks = rows.map((r) => ({ id: r.id, title: r.title, dueDate: r.due_date, priority: r.priority, status: r.status, assigneeName: r.assignee_name, overdue: taskOverdue(r.due_date, r.status, today) }));
  return json({ tasks });
}

async function handleTaskCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  const b = await request.json().catch(() => ({})) as { assigneeEmployeeId?: string; title?: string; description?: string; dueDate?: string; priority?: string };
  const title = String(b.title ?? "").trim();
  const assignee = String(b.assigneeEmployeeId ?? "").trim() || actor.employeeId || "";
  const priority = String(b.priority ?? "medium").trim();
  if (!title) return json({ error: "title required" }, 400);
  if (!assignee) return json({ error: "no assignee" }, 400);
  if (!isValidPriority(priority)) return json({ error: "invalid priority" }, 400);
  const target = await loadEmployee(env, assignee);
  if (!target) return json({ error: "unknown assignee" }, 404);
  if (!canAssignTaskTo(actor, target)) return json({ error: "forbidden" }, 403);
  const id = uid();
  await env.DB.prepare("INSERT INTO tasks (id, title, description, assignee_employee_id, assigned_by_user_id, due_date, priority) VALUES (?,?,?,?,?,?,?)")
    .bind(id, title, String(b.description ?? ""), assignee, actor.userId, b.dueDate || null, priority).run();
  await audit(env, actor.userId, "TASK_CREATE", "task", id, `assigned to ${assignee}`);
  return json({ ok: true, id });
}

async function handleTaskUpdate(actor: Actor, env: Env, id: string, request: Request): Promise<Response> {
  const t = await env.DB.prepare("SELECT assignee_employee_id, assigned_by_user_id FROM tasks WHERE id = ?").bind(id).first<{ assignee_employee_id: string; assigned_by_user_id: string }>();
  if (!t) return json({ error: "not found" }, 404);
  const isAssignee = !!actor.employeeId && actor.employeeId === t.assignee_employee_id;
  const isAssigner = actor.userId === t.assigned_by_user_id;
  if (!isAssignee && !isAssigner) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { status?: string; evidence?: string };
  const sets: string[] = []; const binds: unknown[] = [];
  if (typeof b.status === "string") {
    if (!isValidTaskStatus(b.status)) return json({ error: "invalid status" }, 400);
    sets.push("status = ?"); binds.push(b.status);
    sets.push(`completed_at = ${b.status === "done" ? "datetime('now')" : "NULL"}`);
  }
  if (typeof b.evidence === "string") { sets.push("evidence = ?"); binds.push(b.evidence); }
  if (!sets.length) return json({ error: "nothing to update" }, 400);
  sets.push("updated_at = datetime('now')"); binds.push(id);
  await env.DB.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  await audit(env, actor.userId, "TASK_UPDATE", "task", id, b.status || "evidence");
  return json({ ok: true });
}

// ---- FR-13 Notifications (computed in-app reminders) ----------------------------
async function handleNotifications(actor: Actor, env: Env): Promise<Response> {
  const today = todayISO();
  const items: Array<Record<string, unknown>> = [];
  const cnt = async (sql: string, binds: unknown[]) => Number(((await env.DB.prepare(sql).bind(...binds).first()) as { n?: number } | null)?.n ?? 0);

  const scope = await approvableEmployeeIds(env, actor);
  let ap = 0;
  if (scope === "ALL") {
    ap += await cnt("SELECT COUNT(*) AS n FROM leave_requests WHERE status='pending' AND employee_id != ?", [actor.employeeId ?? ""]);
    ap += await cnt("SELECT COUNT(*) AS n FROM attendance_corrections WHERE status='pending' AND employee_id != ?", [actor.employeeId ?? ""]);
  } else if (scope.length) {
    const ph = scope.map(() => "?").join(",");
    ap += await cnt(`SELECT COUNT(*) AS n FROM leave_requests WHERE status='pending' AND employee_id IN (${ph})`, scope);
    ap += await cnt(`SELECT COUNT(*) AS n FROM attendance_corrections WHERE status='pending' AND employee_id IN (${ph})`, scope);
  }
  if (hasPermission(actor.role, "profile.verify")) ap += await cnt("SELECT COUNT(*) AS n FROM profile_change_requests WHERE status='pending'", []);
  if (ap) items.push({ kind: "approvals", view: "approvals", count: ap });

  if (actor.employeeId) {
    const seg = await employeeSegment(env, actor);
    const unack = await cnt("SELECT COUNT(*) AS n FROM announcements a WHERE a.active=1 AND a.requires_ack=1 AND (a.audience='all' OR a.audience=?) AND NOT EXISTS (SELECT 1 FROM announcement_acks k WHERE k.announcement_id=a.id AND k.employee_id=? AND k.version=a.version)", [seg ?? "", actor.employeeId]);
    if (unack) items.push({ kind: "announcements", view: "announcements", count: unack });
    const tasks = await cnt("SELECT COUNT(*) AS n FROM tasks WHERE assignee_employee_id=? AND status IN ('open','in_progress')", [actor.employeeId]);
    if (tasks) items.push({ kind: "tasks", view: "tasks", count: tasks, overdue: await cnt("SELECT COUNT(*) AS n FROM tasks WHERE assignee_employee_id=? AND status IN ('open','in_progress') AND due_date IS NOT NULL AND due_date < ?", [actor.employeeId, today]) });
  }

  const isAgent = hasPermission(actor.role, "helpdesk.agent");
  const committee = await isPoshCommittee(env, actor);
  if (isAgent || committee) {
    const conds: string[] = [];
    if (isAgent) conds.push("category != 'posh'");
    if (committee) conds.push("category = 'posh'");
    const hq = await cnt(`SELECT COUNT(*) AS n FROM tickets WHERE (${conds.join(" OR ")}) AND status IN ('open','in_progress') AND employee_id != ?`, [actor.employeeId ?? ""]);
    if (hq) items.push({ kind: "helpdesk", view: "helpdesk", count: hq });
  }

  return json({ items, total: items.reduce((s, i) => s + (i.count as number), 0) });
}

// ---- FR-06 Documents ------------------------------------------------------------
async function handleMyDocuments(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ documents: [] });
  const documents = (await env.DB.prepare("SELECT id, title, category, published_at FROM documents WHERE employee_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 200").bind(actor.employeeId).all()).results;
  return json({ documents });
}

async function handleDocumentGet(actor: Actor, env: Env, id: string): Promise<Response> {
  const d = await env.DB.prepare("SELECT id, employee_id, title, category, file, body, status, published_at FROM documents WHERE id = ?").bind(id).first<any>();
  if (!d) return json({ error: "not found" }, 404);
  const isManager = hasPermission(actor.role, "document.manage");
  if (!canViewDocument(actor.employeeId, { employeeId: d.employee_id, status: d.status }, isManager)) {
    await audit(env, actor.userId, "DENY", "document", id, "view denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  await audit(env, actor.userId, "DOCUMENT_VIEW", "document", id, String(d.category));
  return json({ document: d });
}

async function handleDocAdminList(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "document.manage")) return json({ error: "forbidden" }, 403);
  const documents = (await env.DB.prepare("SELECT d.id, d.title, d.category, d.status, d.employee_id, e.name AS employee_name, d.published_at, d.created_at FROM documents d LEFT JOIN employees e ON e.id = d.employee_id ORDER BY d.created_at DESC LIMIT 300").all()).results;
  return json({ documents });
}

async function handleDocCreate(actor: Actor, env: Env, request: Request): Promise<Response> {
  if (!hasPermission(actor.role, "document.manage")) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({})) as { employeeId?: string; title?: string; category?: string; file?: string | null; body?: string; status?: string };
  const employeeId = String(b.employeeId ?? "").trim();
  const title = String(b.title ?? "").trim();
  const category = String(b.category ?? "other").trim();
  const status = String(b.status ?? "draft").trim();
  if (!employeeId) return json({ error: "employeeId required" }, 400);
  if (!title) return json({ error: "title required" }, 400);
  if (!isValidDocCategory(category)) return json({ error: "invalid category" }, 400);
  if (!isValidDocStatus(status)) return json({ error: "invalid status" }, 400);
  if (!(await env.DB.prepare("SELECT id FROM employees WHERE id = ?").bind(employeeId).first())) return json({ error: "unknown employee" }, 404);
  const file = b.file;
  if (file != null && file !== "") {
    if (typeof file !== "string" || !/^data:(application\/pdf|image\/(png|jpeg|jpg|webp));base64,/.test(file)) return json({ error: "file must be a PDF or image data URL" }, 400);
    if (file.length > 2_000_000) return json({ error: "file too large (max ~1.5MB)" }, 413);
  }
  const id = uid();
  const pub = status === "published" ? "datetime('now')" : "NULL";
  await env.DB.prepare(`INSERT INTO documents (id, employee_id, title, category, file, body, status, created_by, published_at) VALUES (?,?,?,?,?,?,?,?, ${pub})`)
    .bind(id, employeeId, title, category, file || null, String(b.body ?? "") || null, status, actor.userId).run();
  await audit(env, actor.userId, "DOCUMENT_CREATE", "document", id, `${category} → ${employeeId} (${status})`);
  return json({ ok: true, id });
}

async function handleDocPublish(actor: Actor, env: Env, id: string): Promise<Response> {
  if (!hasPermission(actor.role, "document.manage")) return json({ error: "forbidden" }, 403);
  const res = await env.DB.prepare("UPDATE documents SET status='published', published_at=datetime('now') WHERE id = ?").bind(id).run();
  if (!(((res.meta?.changes as number) ?? 0))) return json({ error: "not found" }, 404);
  await audit(env, actor.userId, "DOCUMENT_PUBLISH", "document", id, "");
  return json({ ok: true });
}

async function handleDocDelete(actor: Actor, env: Env, id: string): Promise<Response> {
  if (!hasPermission(actor.role, "document.manage")) return json({ error: "forbidden" }, 403);
  await env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(id).run();
  await audit(env, actor.userId, "DOCUMENT_DELETE", "document", id, "");
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;
    try {
      if (path === "/api/auth/login" && method === "POST") return await handleLogin(request, env);

      // Everything below requires a valid (non-revoked) session.
      const actor = await getActor(request, env);
      if (!actor) return json({ error: "unauthenticated" }, 401);

      if (path === "/api/me" && method === "GET") return await handleMe(actor, env, parseReveal(url));
      if (path === "/api/me/lang" && method === "POST") return await handleSetLang(actor, env, request);
      if (path === "/api/dashboard" && method === "GET") return await handleDashboard(actor, env);
      if (path === "/api/employees" && method === "GET") return await handleList(actor, env);
      if (path === "/api/admin/employees" && method === "POST") return await handleEmployeeCreate(actor, env, request);
      const empu = path.match(/^\/api\/admin\/employees\/([^/]+)\/update$/);
      if (empu && method === "POST") return await handleEmployeeUpdate(actor, env, decodeURIComponent(empu[1]), request);
      const one = path.match(/^\/api\/employees\/([^/]+)$/);
      if (one && method === "GET") return await handleGetOne(actor, env, decodeURIComponent(one[1]), parseReveal(url));
      if (path === "/api/directory" && method === "GET") return await handleDirectory(env, url.searchParams.get("q") || "");
      if (path === "/api/profile/change" && method === "POST") return await handleProfileChange(actor, env, request);
      if (path === "/api/profile/changes" && method === "GET") return await handleProfileChanges(actor, env);
      if (path === "/api/profile/photo" && method === "POST") return await handleProfilePhoto(actor, env, request);
      if (path === "/api/profile/bank" && method === "POST") return await handleProfileBank(actor, env, request);
      if (path === "/api/me/bank-proof" && method === "GET") return await handleMyBankProof(actor, env);
      const bankp = path.match(/^\/api\/admin\/employees\/([^/]+)\/bank-proof$/);
      if (bankp && method === "GET") return await handleAdminBankProof(actor, env, decodeURIComponent(bankp[1]));
      if (path === "/api/admin/profile/changes" && method === "GET") return await handlePendingChanges(actor, env);
      const pcr = path.match(/^\/api\/admin\/profile\/changes\/([^/]+)\/(approve|reject)$/);
      if (pcr && method === "POST") return await handleProfileChangeReview(actor, env, decodeURIComponent(pcr[1]), pcr[2] as "approve" | "reject");
      // Lifecycle / tenure: resignation → notice → LWD → F&F + checklists
      if (path === "/api/lifecycle/resign" && method === "POST") return await handleResignSubmit(actor, env, request);
      if (path === "/api/lifecycle/resignations" && method === "GET") return await handleResignList(actor, env);
      const rwd = path.match(/^\/api\/lifecycle\/resignations\/([^/]+)\/withdraw$/);
      if (rwd && method === "POST") return await handleResignWithdraw(actor, env, decodeURIComponent(rwd[1]));
      const rdec = path.match(/^\/api\/admin\/lifecycle\/resignations\/([^/]+)\/decide$/);
      if (rdec && method === "POST") return await handleResignDecide(actor, env, decodeURIComponent(rdec[1]), request);
      const fnf = path.match(/^\/api\/admin\/lifecycle\/employees\/([^/]+)\/fnf$/);
      if (fnf && method === "GET") return await handleFnF(actor, env, decodeURIComponent(fnf[1]), url);
      const ckinit = path.match(/^\/api\/admin\/lifecycle\/employees\/([^/]+)\/checklist$/);
      if (ckinit && method === "POST") return await handleChecklistInit(actor, env, decodeURIComponent(ckinit[1]), request);
      const ckget = path.match(/^\/api\/lifecycle\/employees\/([^/]+)\/checklist$/);
      if (ckget && method === "GET") return await handleChecklistGet(actor, env, decodeURIComponent(ckget[1]), url);
      const ckupd = path.match(/^\/api\/admin\/lifecycle\/checklist\/([^/]+)$/);
      if (ckupd && method === "POST") return await handleChecklistUpdate(actor, env, decodeURIComponent(ckupd[1]), request);

      if (path === "/api/audit" && method === "GET") return await handleAudit(actor, env);
      if (path === "/api/policy/matrix" && method === "GET") return await handleMatrix(actor, env);
      const rev = path.match(/^\/api\/admin\/users\/([^/]+)\/revoke$/);
      if (rev && method === "POST") return await handleRevoke(actor, env, decodeURIComponent(rev[1]), request);

      // FR-03 Leave
      if (path === "/api/leave/types" && method === "GET") return await handleLeaveTypes(env);
      if (path === "/api/leave/balances" && method === "GET") return await handleLeaveBalances(actor, env);
      if (path === "/api/leave/requests" && method === "GET") return await handleLeaveRequests(actor, env);
      if (path === "/api/leave/requests" && method === "POST") return await handleLeaveSubmit(actor, env, request);
      const lcancel = path.match(/^\/api\/leave\/requests\/([^/]+)\/cancel$/);
      if (lcancel && method === "POST") return await handleLeaveCancel(actor, env, decodeURIComponent(lcancel[1]));
      if (path === "/api/leave/approvals" && method === "GET") return await handleLeaveApprovals(actor, env);
      const ldecide = path.match(/^\/api\/leave\/requests\/([^/]+)\/(approve|reject)$/);
      if (ldecide && method === "POST") return await handleLeaveDecide(actor, env, decodeURIComponent(ldecide[1]), ldecide[2] as "approve" | "reject", request);

      // FR-02 Attendance
      if (path === "/api/admin/attendance/import" && method === "POST") return await handleAttendanceImport(actor, env, request);
      if (path === "/api/attendance" && method === "GET") return await handleAttendanceMonth(actor, env, url.searchParams.get("month") || "");
      if (path === "/api/attendance/corrections" && method === "POST") return await handleAttCorrectionSubmit(actor, env, request);
      if (path === "/api/attendance/corrections" && method === "GET") return await handleAttCorrections(actor, env);
      if (path === "/api/attendance/corrections/approvals" && method === "GET") return await handleAttCorrectionQueue(actor, env);
      const acd = path.match(/^\/api\/attendance\/corrections\/([^/]+)\/(approve|reject)$/);
      if (acd && method === "POST") return await handleAttCorrectionDecide(actor, env, decodeURIComponent(acd[1]), acd[2] as "approve" | "reject", request);
      // Payroll-ready attendance: month lock, holiday calendar, payroll input
      if (path === "/api/admin/attendance/periods" && method === "GET") return await handleAttPeriods(actor, env);
      const aplk = path.match(/^\/api\/admin\/attendance\/periods\/(\d{4}-\d{2})\/(lock|unlock)$/);
      if (aplk && method === "POST") return await handleAttPeriodSetLock(actor, env, aplk[1], aplk[2] === "lock", request);
      if (path === "/api/admin/attendance/payroll-input" && method === "GET") return await handleAttPayrollInput(actor, env, url.searchParams.get("month") || "");
      if (path === "/api/admin/attendance/policy" && method === "GET") return await handleAttPolicyGet(actor, env);
      if (path === "/api/admin/attendance/policy" && method === "POST") return await handleAttPolicySet(actor, env, request);

      // Payroll core — P6a: salary setup
      if (path === "/api/admin/salary/components" && method === "GET") return await handleSalaryComponents(actor, env);
      if (path === "/api/admin/salary/components" && method === "POST") return await handleSalaryComponentUpsert(actor, env, request);
      const esg = path.match(/^\/api\/admin\/employees\/([^/]+)\/salary$/);
      if (esg && method === "GET") return await handleEmployeeSalaryGet(actor, env, decodeURIComponent(esg[1]));
      if (esg && method === "POST") return await handleEmployeeSalarySet(actor, env, decodeURIComponent(esg[1]), request);
      const eap = path.match(/^\/api\/admin\/employees\/([^/]+)\/additional-pay$/);
      if (eap && method === "GET") return await handleAdditionalPayGet(actor, env, decodeURIComponent(eap[1]), url.searchParams.get("month") || "");
      if (eap && method === "POST") return await handleAdditionalPayCreate(actor, env, decodeURIComponent(eap[1]), request);
      const eapd = path.match(/^\/api\/admin\/additional-pay\/([^/]+)\/delete$/);
      if (eapd && method === "POST") return await handleAdditionalPayDelete(actor, env, decodeURIComponent(eapd[1]));
      // Statutory config (S7a PT, S7b TDS)
      if (path === "/api/admin/statutory/config" && method === "GET") return await handleStatutoryConfigGet(actor, env, url.searchParams.get("statute") || "pt");
      if (path === "/api/admin/statutory/config" && method === "POST") return await handleStatutoryConfigSet(actor, env, request);
      // TDS self-service (S7b): regime election + investment declarations
      if (path === "/api/tax/me" && method === "GET") return await handleTaxMe(actor, env);
      if (path === "/api/tax/regime" && method === "POST") return await handleTaxRegime(actor, env, request);
      if (path === "/api/tax/declarations" && method === "POST") return await handleTaxDeclare(actor, env, request);
      if (path === "/api/admin/tax/declarations" && method === "GET") return await handleTaxDeclQueue(actor, env);
      const txd = path.match(/^\/api\/admin\/tax\/declarations\/([^/]+)\/(verify|reject)$/);
      if (txd && method === "POST") return await handleTaxDeclDecide(actor, env, decodeURIComponent(txd[1]), txd[2] as "verify" | "reject", request);
      // Payroll run (P6b)
      if (path === "/api/admin/payroll/runs" && method === "GET") return await handlePayrollRuns(actor, env, url.searchParams.get("month") || "");
      if (path === "/api/admin/payroll/runs" && method === "POST") return await handlePayrollRunPrepare(actor, env, request);
      const prun = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)$/);
      if (prun && method === "GET") return await handlePayrollRunGet(actor, env, decodeURIComponent(prun[1]));
      const preg = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/register$/);
      if (preg && method === "GET") return await handlePayrollRegister(actor, env, decodeURIComponent(preg[1]));
      const pbank = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/bank$/);
      if (pbank && method === "GET") return await handlePayrollBank(actor, env, decodeURIComponent(pbank[1]));
      const psub = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/submit-review$/);
      if (psub && method === "POST") return await handlePayrollSubmitReview(actor, env, decodeURIComponent(psub[1]));
      const prej = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/reject$/);
      if (prej && method === "POST") return await handlePayrollReject(actor, env, decodeURIComponent(prej[1]), request);
      const papp = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/approve$/);
      if (papp && method === "POST") return await handlePayrollApprove(actor, env, decodeURIComponent(papp[1]));
      const prop = path.match(/^\/api\/admin\/payroll\/runs\/([^/]+)\/reopen$/);
      if (prop && method === "POST") return await handlePayrollReopen(actor, env, decodeURIComponent(prop[1]));
      if (path === "/api/admin/holidays" && method === "GET") return await handleHolidaysList(actor, env, url.searchParams.get("year") || "");
      if (path === "/api/admin/holidays" && method === "POST") return await handleHolidayCreate(actor, env, request);
      const hdel = path.match(/^\/api\/admin\/holidays\/([^/]+)\/delete$/);
      if (hdel && method === "POST") return await handleHolidayDelete(actor, env, decodeURIComponent(hdel[1]));

      // FR-04 Approvals (unified inbox + delegation)
      if (path === "/api/approvals" && method === "GET") return await handleApprovals(actor, env);
      if (path === "/api/approvals/delegations" && method === "GET") return await handleDelegationList(actor, env);
      if (path === "/api/approvals/delegations" && method === "POST") return await handleDelegationCreate(actor, env, request);
      const drev = path.match(/^\/api\/approvals\/delegations\/([^/]+)\/revoke$/);
      if (drev && method === "POST") return await handleDelegationRevoke(actor, env, decodeURIComponent(drev[1]));

      // FR-09 Helpdesk + FR-21 POSH
      if (path === "/api/helpdesk/tickets" && method === "POST") return await handleTicketCreate(actor, env, request);
      if (path === "/api/helpdesk/tickets" && method === "GET") return await handleMyTickets(actor, env);
      if (path === "/api/helpdesk/queue" && method === "GET") return await handleTicketQueue(actor, env);
      const tcom = path.match(/^\/api\/helpdesk\/tickets\/([^/]+)\/comment$/);
      if (tcom && method === "POST") return await handleTicketComment(actor, env, decodeURIComponent(tcom[1]), request);
      const tst = path.match(/^\/api\/helpdesk\/tickets\/([^/]+)\/status$/);
      if (tst && method === "POST") return await handleTicketStatus(actor, env, decodeURIComponent(tst[1]), request);
      const tdet = path.match(/^\/api\/helpdesk\/tickets\/([^/]+)$/);
      if (tdet && method === "GET") return await handleTicketDetail(actor, env, decodeURIComponent(tdet[1]));
      if (path === "/api/admin/posh/committee" && method === "GET") return await handlePoshCommitteeList(actor, env);
      if (path === "/api/admin/posh/committee" && method === "POST") return await handlePoshCommitteeAdd(actor, env, request);
      const prem = path.match(/^\/api\/admin\/posh\/committee\/([^/]+)\/remove$/);
      if (prem && method === "POST") return await handlePoshCommitteeRemove(actor, env, decodeURIComponent(prem[1]));

      // FR-07 Announcements
      if (path === "/api/announcements" && method === "GET") return await handleAnnouncementsFeed(actor, env);
      const aack = path.match(/^\/api\/announcements\/([^/]+)\/ack$/);
      if (aack && method === "POST") return await handleAnnouncementAck(actor, env, decodeURIComponent(aack[1]));
      if (path === "/api/admin/announcements" && method === "GET") return await handleAnnouncementAdminList(actor, env);
      if (path === "/api/admin/announcements" && method === "POST") return await handleAnnouncementCreate(actor, env, request);
      const aacks = path.match(/^\/api\/admin\/announcements\/([^/]+)\/acks$/);
      if (aacks && method === "GET") return await handleAnnouncementAcks(actor, env, decodeURIComponent(aacks[1]));
      const aact = path.match(/^\/api\/admin\/announcements\/([^/]+)\/active$/);
      if (aact && method === "POST") return await handleAnnouncementActive(actor, env, decodeURIComponent(aact[1]), request);
      const aupd = path.match(/^\/api\/admin\/announcements\/([^/]+)$/);
      if (aupd && method === "POST") return await handleAnnouncementUpdate(actor, env, decodeURIComponent(aupd[1]), request);

      // FR-05 Tasks
      if (path === "/api/tasks" && method === "GET") return await handleMyTasks(actor, env);
      if (path === "/api/tasks/assigned" && method === "GET") return await handleAssignedTasks(actor, env);
      if (path === "/api/tasks" && method === "POST") return await handleTaskCreate(actor, env, request);
      const tupd = path.match(/^\/api\/tasks\/([^/]+)$/);
      if (tupd && method === "POST") return await handleTaskUpdate(actor, env, decodeURIComponent(tupd[1]), request);

      // FR-13 Notifications
      if (path === "/api/notifications" && method === "GET") return await handleNotifications(actor, env);

      // FR-06 Documents
      if (path === "/api/documents" && method === "GET") return await handleMyDocuments(actor, env);
      const dget = path.match(/^\/api\/documents\/([^/]+)$/);
      if (dget && method === "GET") return await handleDocumentGet(actor, env, decodeURIComponent(dget[1]));
      if (path === "/api/admin/documents" && method === "GET") return await handleDocAdminList(actor, env);
      if (path === "/api/admin/documents" && method === "POST") return await handleDocCreate(actor, env, request);
      const dpub = path.match(/^\/api\/admin\/documents\/([^/]+)\/publish$/);
      if (dpub && method === "POST") return await handleDocPublish(actor, env, decodeURIComponent(dpub[1]));
      const ddel = path.match(/^\/api\/admin\/documents\/([^/]+)\/delete$/);
      if (ddel && method === "POST") return await handleDocDelete(actor, env, decodeURIComponent(ddel[1]));

      return json({ error: "not found" }, 404); // default deny: unknown route
    } catch (e) {
      return json({ error: "internal error", detail: (e as Error).message }, 500);
    }
  },
};
