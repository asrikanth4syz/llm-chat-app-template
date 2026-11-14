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
} from "./policy.ts";
import { signJwt, verifyJwt, checkPassword, verifyOtp } from "./auth.ts";
import { encryptField, decryptField } from "./fieldcrypto.ts";

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

interface EmpRow {
  id: string; user_id: string; manager_id: string | null; segment: string; name: string;
  work_email: string; designation: string | null; location: string | null;
  pan: string | null; bank_account: string | null; aadhaar_last4: string | null; ctc: number | null;
}
function rowToEmployee(r: EmpRow): EmployeeRecord {
  return {
    id: r.id, userId: r.user_id, managerId: r.manager_id,
    segment: r.segment === "client_site" ? "client_site" : "office",
    name: r.name, workEmail: r.work_email, designation: r.designation, location: r.location,
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
    "SELECT id, password_hash, role, employee_id, active, token_version FROM users WHERE lower(email) = ? AND realm = 'employee-portal'"
  ).bind(email).first<{ id: string; password_hash: string; role: string; employee_id: string | null; active: number; token_version: number }>();
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
  return json({ token, role: row.role });
}

async function loadEmployee(env: Env, id: string): Promise<EmployeeRecord | null> {
  const r = await env.DB.prepare(
    "SELECT id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc FROM employees WHERE id = ?"
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
  return json({ employee: redactEmployee(actor, rec, { reveal }) });
}

async function handleList(actor: Actor, env: Env): Promise<Response> {
  // Load the candidate set by role, THEN filter through the policy engine (never
  // trust the query alone). A plain employee only ever loads their own row.
  const cols = "id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc";
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
    await env.DB.prepare(`UPDATE employees SET ${DIRECT_PROFILE_FIELDS[field]} = ? WHERE id = ?`)
      .bind(value, actor.employeeId).run();
    await audit(env, actor.userId, "PROFILE_UPDATE", "employee", actor.employeeId, `updated ${field}`);
    return json({ ok: true, applied: true, field });
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
    const col = VERIFIED_PROFILE_FIELDS[req.field];
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
      if (path === "/api/employees" && method === "GET") return await handleList(actor, env);
      const one = path.match(/^\/api\/employees\/([^/]+)$/);
      if (one && method === "GET") return await handleGetOne(actor, env, decodeURIComponent(one[1]), parseReveal(url));
      if (path === "/api/profile/change" && method === "POST") return await handleProfileChange(actor, env, request);
      if (path === "/api/profile/changes" && method === "GET") return await handleProfileChanges(actor, env);
      const pcr = path.match(/^\/api\/admin\/profile\/changes\/([^/]+)\/(approve|reject)$/);
      if (pcr && method === "POST") return await handleProfileChangeReview(actor, env, decodeURIComponent(pcr[1]), pcr[2] as "approve" | "reject");
      if (path === "/api/audit" && method === "GET") return await handleAudit(actor, env);
      if (path === "/api/policy/matrix" && method === "GET") return await handleMatrix(actor, env);
      const rev = path.match(/^\/api\/admin\/users\/([^/]+)\/revoke$/);
      if (rev && method === "POST") return await handleRevoke(actor, env, decodeURIComponent(rev[1]), request);

      return json({ error: "not found" }, 404); // default deny: unknown route
    } catch (e) {
      return json({ error: "internal error", detail: (e as Error).message }, 500);
    }
  },
};
