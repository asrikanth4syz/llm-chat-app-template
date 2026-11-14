// 4SYZ Employee Portal — R0 foundation Worker.
// Separate identity realm from SmartPantry. Every employee-data response is
// scoped through the policy engine (src/policy.ts): a login sees strictly its
// own record, a manager its team, HR/Finance/Auditor all, super_admin everything
// — and sensitive fields are redacted unless the actor may see them. D1 has no
// row-level security, so EVERY scope check lives here and is unit-tested; access
// and denials are written to an append-only audit log.
import {
  type Actor,
  type EmployeeRecord,
  type Role,
  canReadSensitive,
  canReadEmployee,
  visibleEmployees,
  redactEmployee,
  hasPermission,
} from "./policy.ts";
import { signJwt, verifyJwt, checkPassword } from "./auth.ts";

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
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

async function audit(env: Env, actorUserId: string, action: string, resource: string, resourceId: string | null, detail: string): Promise<void> {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_log (id, actor_user_id, action, resource, resource_id, detail) VALUES (?,?,?,?,?,?)"
    ).bind(uid(), actorUserId, action, resource, resourceId, detail).run();
  } catch { /* audit must never break the request path */ }
}

// Resolve the bearer token to an Actor (user + role + their employee record id).
async function getActor(request: Request, env: Env): Promise<Actor | null> {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || typeof payload.sub !== "string") return null;
  const row = await env.DB.prepare(
    "SELECT id, role, employee_id, active FROM users WHERE id = ?"
  ).bind(payload.sub).first<{ id: string; role: string; employee_id: string | null; active: number }>();
  if (!row || !row.active) return null;
  return { userId: row.id, employeeId: row.employee_id, role: row.role as Role };
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { email?: string; password?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !body.password) return json({ error: "email and password required" }, 400);
  const row = await env.DB.prepare(
    "SELECT id, password_hash, role, employee_id, active FROM users WHERE lower(email) = ? AND realm = 'employee-portal'"
  ).bind(email).first<{ id: string; password_hash: string; role: string; employee_id: string | null; active: number }>();
  if (!row || !row.active || !checkPassword(row.password_hash, body.password)) {
    return json({ error: "invalid credentials" }, 401);
  }
  const token = await signJwt({ sub: row.id, role: row.role }, env.JWT_SECRET, 8 * 3600);
  await audit(env, row.id, "LOGIN", "session", null, `role ${row.role}`);
  return json({ token, role: row.role });
}

async function loadEmployee(env: Env, id: string): Promise<EmployeeRecord | null> {
  const r = await env.DB.prepare(
    "SELECT id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc FROM employees WHERE id = ?"
  ).bind(id).first<EmpRow>();
  return r ? rowToEmployee(r) : null;
}

async function handleMe(actor: Actor, env: Env): Promise<Response> {
  if (!actor.employeeId) return json({ error: "no employee record linked to this login" }, 404);
  const rec = await loadEmployee(env, actor.employeeId);
  if (!rec) return json({ error: "not found" }, 404);
  return json({ employee: redactEmployee(actor, rec) }); // own record → full detail
}

async function handleList(actor: Actor, env: Env): Promise<Response> {
  // Load the candidate set by role, THEN filter through the policy engine (never
  // trust the query alone). A plain employee only ever loads their own row.
  let rows: EmpRow[] = [];
  if (hasPermission(actor.role, "employee.read_all")) {
    rows = (await env.DB.prepare("SELECT id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc FROM employees").all<EmpRow>()).results;
  } else if (hasPermission(actor.role, "employee.read_team") && actor.employeeId) {
    rows = (await env.DB.prepare("SELECT id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc FROM employees WHERE id = ? OR manager_id = ?").bind(actor.employeeId, actor.employeeId).all<EmpRow>()).results;
  } else if (actor.employeeId) {
    rows = (await env.DB.prepare("SELECT id,user_id,manager_id,segment,name,work_email,designation,location,pan,bank_account,aadhaar_last4,ctc FROM employees WHERE id = ?").bind(actor.employeeId).all<EmpRow>()).results;
  }
  const visible = visibleEmployees(actor, rows.map(rowToEmployee));
  await audit(env, actor.userId, "LIST", "employee", null, `${visible.length} records`);
  return json({ employees: visible.map((e) => redactEmployee(actor, e)), count: visible.length });
}

async function handleGetOne(actor: Actor, env: Env, id: string): Promise<Response> {
  const rec = await loadEmployee(env, id);
  if (!rec) return json({ error: "not found" }, 404);
  if (!canReadEmployee(actor, rec)) {
    await audit(env, actor.userId, "DENY", "employee", id, "read denied by policy");
    return json({ error: "forbidden" }, 403);
  }
  if (canReadSensitive(actor, rec)) {
    await audit(env, actor.userId, "READ_SENSITIVE", "employee", id, "sensitive fields revealed");
  } else {
    await audit(env, actor.userId, "READ", "employee", id, "non-sensitive");
  }
  return json({ employee: redactEmployee(actor, rec) });
}

async function handleAudit(actor: Actor, env: Env): Promise<Response> {
  if (!hasPermission(actor.role, "audit.read")) return json({ error: "forbidden" }, 403);
  const rows = (await env.DB.prepare("SELECT id,actor_user_id,action,resource,resource_id,detail,at FROM audit_log ORDER BY at DESC LIMIT 200").all()).results;
  return json({ entries: rows });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;
    try {
      if (path === "/api/auth/login" && method === "POST") return await handleLogin(request, env);

      // Everything below requires a valid session.
      const actor = await getActor(request, env);
      if (!actor) return json({ error: "unauthenticated" }, 401);

      if (path === "/api/me" && method === "GET") return await handleMe(actor, env);
      if (path === "/api/employees" && method === "GET") return await handleList(actor, env);
      const one = path.match(/^\/api\/employees\/([^/]+)$/);
      if (one && method === "GET") return await handleGetOne(actor, env, decodeURIComponent(one[1]));
      if (path === "/api/audit" && method === "GET") return await handleAudit(actor, env);

      return json({ error: "not found" }, 404); // default deny: unknown route
    } catch (e) {
      return json({ error: "internal error", detail: (e as Error).message }, 500);
    }
  },
};
