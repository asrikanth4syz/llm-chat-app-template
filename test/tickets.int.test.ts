// Integration tests for the service-desk ticket feature added in Phase 2:
//   (a) file attachments on ticket comments (stored + returned inline),
//   (b) the 48-hour reopen window on a CLOSED ticket (allowed within, 409 after),
//   (c) closed_at is stamped on close and cleared on reopen.
// Boots the real Worker against the per-test D1 (storage rolls back per test), so
// each test drives the full OPEN → RESOLVED → CLOSED → reopen workflow itself.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const patch = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PATCH", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, password: string): Promise<string> {
  const data = await (await post("/api/auth/login", { email, password })).json() as { token: string };
  return data.token;
}

let clientTok: string, opsTok: string;

// Raise an OPEN ticket as the client and return its id.
async function raiseTicket(subject = "Help with my order"): Promise<string> {
  const res = await post("/api/tickets", { subject, description: "Something went wrong", priority: "MEDIUM" }, clientTok);
  expect(res.status).toBe(201);
  return (await res.json() as { id: string }).id;
}

beforeAll(async () => {
  const db = env.DB as D1Database;
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) {
        try { await db.prepare(stmt).run(); break; }
        catch (e: any) { const m = String(e);
          if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
          if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; }
          throw e; }
      }
    }
  }
  // Warm the ticket schema the same way ensureFeatureTables() does in production —
  // the comments table and the closed_at / attachment_* columns live there, not in
  // a migration, and the per-request waitUntil() warm is too late to rely on here.
  for (const sql of [
    `CREATE TABLE IF NOT EXISTS ticket_comments (
       id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, author_id TEXT NOT NULL,
       author_name TEXT NOT NULL, author_role TEXT NOT NULL, message TEXT NOT NULL,
       created_at TEXT DEFAULT (datetime('now')))`,
    "ALTER TABLE tickets ADD COLUMN closed_at TEXT",
    "ALTER TABLE ticket_comments ADD COLUMN attachment_name TEXT",
    "ALTER TABLE ticket_comments ADD COLUMN attachment_type TEXT",
    "ALTER TABLE ticket_comments ADD COLUMN attachment_data TEXT",
  ]) { try { await db.prepare(sql).run(); } catch { /* exists */ } }

  const mk = (id: string, email: string, role: string, name: string, clientId?: string) =>
    db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES (?,?,?,?,?,?,?,1,?)")
      .bind(id, email, "SEED:pw123", role, name, "SmartPantry", "XX", clientId ?? null).run();
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await mk("tst-client", "client@sp.test", "client_admin", "Client Admin", "c1");
  await mk("tst-ops", "ops@sp.test", "super_admin", "Ops Admin");

  clientTok = await login("client@sp.test", "pw123");
  opsTok = await login("ops@sp.test", "pw123");
});

describe("ticket attachments", () => {
  it("stores a comment attachment and returns it inline", async () => {
    const id = await raiseTicket();
    const b64 = "aGVsbG8gd29ybGQ="; // "hello world"
    const res = await post(`/api/tickets/${id}/comments`,
      { message: "See attached", attachment: { name: "note.txt", type: "text/plain", data: b64 } }, clientTok);
    expect(res.status).toBe(201);

    const comments = await (await get(`/api/tickets/${id}/comments`, clientTok)).json() as any[];
    expect(comments).toHaveLength(1);
    expect(comments[0].attachment_name).toBe("note.txt");
    expect(comments[0].attachment_type).toBe("text/plain");
    expect(comments[0].attachment_data).toBe(b64);
    expect(comments[0].message).toBe("See attached");
  });

  it("accepts an attachment-only comment (no message)", async () => {
    const id = await raiseTicket();
    const res = await post(`/api/tickets/${id}/comments`,
      { message: "", attachment: { name: "pic.png", type: "image/png", data: "iVBORw0KGgo=" } }, clientTok);
    expect(res.status).toBe(201);
  });

  it("rejects an empty comment with no attachment", async () => {
    const id = await raiseTicket();
    const res = await post(`/api/tickets/${id}/comments`, { message: "   " }, clientTok);
    expect(res.status).toBe(400);
  });

  it("rejects an oversized attachment", async () => {
    const id = await raiseTicket();
    const huge = "A".repeat(2_200_001);
    const res = await post(`/api/tickets/${id}/comments`,
      { message: "big", attachment: { name: "big.bin", type: "application/octet-stream", data: huge } }, clientTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("E_ATTACH_SIZE");
  });
});

describe("48-hour reopen window", () => {
  // Drive a ticket to CLOSED: client raises → ops resolves → client confirms & closes.
  async function closeTicket(): Promise<string> {
    const id = await raiseTicket();
    expect((await patch(`/api/tickets/${id}`, { status: "RESOLVED" }, opsTok)).status).toBe(200);
    expect((await patch(`/api/tickets/${id}`, { status: "CLOSED" }, clientTok)).status).toBe(200);
    const row = await (env.DB as D1Database).prepare("SELECT closed_at FROM tickets WHERE id=?").bind(id).first() as { closed_at: string | null };
    expect(row.closed_at).toBeTruthy(); // closed_at stamped on close
    return id;
  }

  it("reopens a ticket closed just now (within 48h) and clears closed_at", async () => {
    const id = await closeTicket();
    const res = await patch(`/api/tickets/${id}`, { status: "OPEN" }, clientTok);
    expect(res.status).toBe(200);
    const row = await (env.DB as D1Database).prepare("SELECT status,closed_at,resolved_at FROM tickets WHERE id=?").bind(id).first() as any;
    expect(row.status).toBe("OPEN");
    expect(row.closed_at).toBeNull();
    expect(row.resolved_at).toBeNull();
  });

  it("refuses to reopen a ticket closed more than 48h ago (E_REOPEN_WINDOW)", async () => {
    const id = await closeTicket();
    // Backdate the close to 3 days ago.
    await (env.DB as D1Database).prepare("UPDATE tickets SET closed_at=datetime('now','-3 days') WHERE id=?").bind(id).run();
    const res = await patch(`/api/tickets/${id}`, { status: "OPEN" }, clientTok);
    expect(res.status).toBe(409);
    const body = await res.json() as any;
    expect(body.code).toBe("E_REOPEN_WINDOW");
    // Ticket stays CLOSED — the client must raise a new ticket instead.
    const row = await (env.DB as D1Database).prepare("SELECT status FROM tickets WHERE id=?").bind(id).first() as any;
    expect(row.status).toBe("CLOSED");
  });

  it("reopens a RESOLVED ticket at any time (no window)", async () => {
    const id = await raiseTicket();
    expect((await patch(`/api/tickets/${id}`, { status: "RESOLVED" }, opsTok)).status).toBe(200);
    const res = await patch(`/api/tickets/${id}`, { status: "OPEN" }, clientTok);
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe("OPEN");
  });
});
