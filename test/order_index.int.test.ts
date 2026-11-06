// Integration tests for the monthly order index, assigned at approval:
// POST /api/orders/:id/transition (to APPROVED) and POST /api/orders/:id/index.
// Covers per-client sequencing, gaps-on-cancel, advance-month (need-by) default,
// staff override + duplicate guard, the client-approval auto path, and role gate.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, password: string): Promise<string> {
  return (await (await post("/api/auth/login", { email, password })).json() as { token: string }).token;
}
const db = () => env.DB as D1Database;
const approve = (id: string, body: unknown, t: string) => post(`/api/orders/${id}/transition`, { to: "APPROVED", ...(body as object) }, t);
const setIndex = (id: string, body: unknown, t: string) => post(`/api/orders/${id}/index`, body, t);

let opsTok: string, clientTok: string;
let N = 0;
// Seed a PENDING_APPROVAL order. created/need-by control the default index month.
async function mkOrder(client: string, created: string, needBy?: string): Promise<string> {
  const id = `O-${++N}`;
  await db().prepare("INSERT OR REPLACE INTO orders (id,client_id,status,created_by,subtotal,gst,grand_total,revision,need_by_date,created_at) VALUES (?,?, 'PENDING_APPROVAL','u-ops',1000,180,1180,1,?, ?)")
    .bind(id, client, needBy ?? null, created).run();
  return id;
}

beforeAll(async () => {
  const d = db();
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) {
        try { await d.prepare(stmt).run(); break; }
        catch (e: any) { const m = String(e);
          if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
          if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; }
          throw e; }
      }
    }
  }
  // Monthly index columns live in ensureFeatureTables; warm them like production.
  for (const sql of ["ALTER TABLE orders ADD COLUMN index_month TEXT", "ALTER TABLE orders ADD COLUMN index_seq INTEGER", "ALTER TABLE orders ADD COLUMN index_manual INTEGER DEFAULT 0"]) {
    try { await d.prepare(sql).run(); } catch { /* exists */ }
  }
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cA','Client A','a@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cB','Client B','b@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','super_admin','Ops','SP','OP',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli','cli@sp.test','SEED:pw123','client_admin','Cli','SP','CL',1,'cA')").run();
  opsTok = await login("ops@sp.test", "pw123");
  clientTok = await login("cli@sp.test", "pw123");
});

describe("monthly index at approval", () => {
  it("auto-assigns per client, sequentially, from the created month", async () => {
    const a1 = await mkOrder("cA", "2026-11-02 10:00:00");
    const a2 = await mkOrder("cA", "2026-11-03 10:00:00");
    const b1 = await mkOrder("cB", "2026-11-04 10:00:00");
    expect(await (await approve(a1, {}, opsTok)).json()).toMatchObject({ index_month: "2026-11", index_seq: 1 });
    expect(await (await approve(a2, {}, opsTok)).json()).toMatchObject({ index_month: "2026-11", index_seq: 2 });
    expect(await (await approve(b1, {}, opsTok)).json()).toMatchObject({ index_month: "2026-11", index_seq: 1 }); // B resets to #1
  });

  it("leaves a gap when an order is cancelled — the number is not reused", async () => {
    const x1 = await mkOrder("cB", "2026-12-01 10:00:00");
    const x2 = await mkOrder("cB", "2026-12-02 10:00:00");
    expect((await (await approve(x1, {}, opsTok)).json() as any).index_seq).toBe(1);
    expect((await (await approve(x2, {}, opsTok)).json() as any).index_seq).toBe(2);
    await post(`/api/orders/${x2}/transition`, { to: "CANCELLED", note: "void" }, opsTok); // #2 cancelled, keeps its slot
    const x3 = await mkOrder("cB", "2026-12-03 10:00:00");
    expect((await (await approve(x3, {}, opsTok)).json() as any).index_seq).toBe(3); // not 2
    const row = await db().prepare("SELECT index_seq,status FROM orders WHERE id=?").bind(x2).first() as any;
    expect(row.index_seq).toBe(2); // cancelled order still holds #2
  });

  it("defaults an advance order (need-by next month) to the later month", async () => {
    const adv = await mkOrder("cA", "2026-11-20 10:00:00", "2026-12-05"); // created Nov, needed Dec
    const r = await (await approve(adv, {}, opsTok)).json() as any;
    expect(r.index_month).toBe("2026-12");
    expect(r.index_seq).toBe(1);
    expect(r.index_manual).toBe(0); // need-by-driven, not a manual override
  });

  it("lets staff override the month at approval, flagged manual", async () => {
    const o = await mkOrder("cA", "2027-01-05 10:00:00");
    const r = await (await approve(o, { index_month: "2027-02" }, opsTok)).json() as any;
    expect(r.index_month).toBe("2027-02");
    expect(r.index_manual).toBe(1);
  });

  it("rejects a duplicate override number and does not change the status", async () => {
    const o1 = await mkOrder("cB", "2027-03-01 10:00:00");
    await approve(o1, {}, opsTok); // cB 2027-03 #1
    const o2 = await mkOrder("cB", "2027-03-02 10:00:00");
    const res = await approve(o2, { index_seq: 1 }, opsTok); // collide with #1
    expect(res.status).toBe(409);
    expect((await res.json() as any).code).toBe("E_INDEX_TAKEN");
    const row = await db().prepare("SELECT status,index_seq FROM orders WHERE id=?").bind(o2).first() as any;
    expect(row.status).toBe("PENDING_APPROVAL"); // not approved
    expect(row.index_seq).toBeNull();
  });

  it("auto-assigns even when a client approves (no override honoured)", async () => {
    const o = await mkOrder("cA", "2027-04-10 10:00:00");
    const r = await (await approve(o, { index_seq: 99 }, clientTok)).json() as any; // client cannot force 99
    expect(r.index_month).toBe("2027-04");
    expect(r.index_seq).toBe(1);
    expect(r.index_manual).toBe(0);
  });
});

describe("adjust index after approval", () => {
  it("re-derives for a new month and blocks a client", async () => {
    const o = await mkOrder("cA", "2027-05-01 10:00:00");
    await approve(o, {}, opsTok); // cA 2027-05 #1
    const r = await (await setIndex(o, { index_month: "2027-06" }, opsTok)).json() as any;
    expect(r.index_month).toBe("2027-06");
    expect(r.index_seq).toBe(1);
    const denied = await setIndex(o, { index_month: "2027-07" }, clientTok);
    expect(denied.status).toBe(403);
  });
});
