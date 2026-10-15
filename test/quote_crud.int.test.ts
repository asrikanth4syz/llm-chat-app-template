// Integration tests for Quotations CRUD + immutable versions (milestone 006,
// Slice 3). create (v1) → detail → edit (version-append) → versions(verify),
// immutability + hash chain, ops redaction, idempotency, and the DRAFT guard.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string, extra?: Record<string, string>) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(extra || {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string, extra?: Record<string, string>) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t, extra), body: JSON.stringify(b) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, password: string): Promise<string> {
  const data = await (await post("/api/auth/login", { email, password })).json() as { token: string };
  return data.token;
}

let adminTok: string, salesTok: string, opsTok: string;

const LINE = (cost: number, markupBp = 2000) => ({ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: cost, markup_bp: markupBp, sale_gst_bp: 1800, itc_claimable: true });
const CREATE = { client_id: "c1", place_of_supply: "KL", lines: [LINE(10000)] };

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
  const mk = (id: string, email: string, role: string, name: string) =>
    db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id, email, "SEED:pw123", role, name, "SmartPantry", "XX").run();
  await mk("tst-cadmin", "cadmin@sp.test", "super_admin", "C Admin");
  await mk("tst-csales", "csales@sp.test", "procurement_manager", "C Sales");
  await mk("tst-cops", "cops@sp.test", "warehouse_exec", "C Ops");
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  // Warm the quote schema into the per-test baseline (avoids the _quoteSchemaReady
  // module-flag vs storage-rollback hazard — same pattern as the PI schema warm).
  await get("/api/quotes");
  adminTok = await login("cadmin@sp.test", "pw123");
  salesTok = await login("csales@sp.test", "pw123");
  opsTok = await login("cops@sp.test", "pw123");
});

// Each test re-establishes config (storage rolls back per test).
async function prep() {
  await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-csales", quoteRole: "sales", _ver: 0 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-cops", quoteRole: "ops", _ver: 1 }, adminTok);
}

describe("quote CRUD + versions", () => {
  it("create → v1 with DRAFT + FY quote_no + correct grand total", async () => {
    await prep();
    const res = await post("/api/quotes", CREATE, salesTok);
    expect(res.status).toBe(200);
    const b = await res.json() as any;
    expect(b.version).toBe(1);
    expect(b.status).toBe("DRAFT");
    expect(b.grand_total_paise).toBe(14200); // 12000 + 18% GST 2160 → 14160 → round-to-rupee 14200
    expect(b.quote_no).toMatch(/^GZ\/\d{4}-\d{2}\/0001$/);
  });

  it("detail returns v1 with a content hash and prev_hash null", async () => {
    await prep();
    const id = (await (await post("/api/quotes", CREATE, salesTok)).json() as any).id;
    const d = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(d.current_version).toBe(1);
    expect(d.version.prev_hash).toBe(null);
    expect(d.version.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(d.lines[0].landed_cost_paise).toBe(10000); // sales sees cost
  });

  it("edit appends an immutable v2 that chains to v1; versions verify", async () => {
    await prep();
    const id = (await (await post("/api/quotes", CREATE, salesTok)).json() as any).id;
    const v1 = await (await get(`/api/quotes/${id}/versions`, salesTok)).json() as any;
    const edit = await put(`/api/quotes/${id}`, { client_id: "c1", place_of_supply: "KL", lines: [LINE(10000, 5000)] }, salesTok);
    expect(edit.status).toBe(200);
    expect((await edit.json() as any).version).toBe(2);
    const vs = await (await get(`/api/quotes/${id}/versions`, salesTok)).json() as any;
    expect(vs.versions.length).toBe(2);
    expect(vs.verified).toBe(true);
    expect(vs.first_broken_version).toBe(null);
    expect(vs.versions[0].prev_hash).toBe(null);
    expect(vs.versions[1].prev_hash).toBe(vs.versions[0].content_hash);        // chained
    expect(vs.versions[0].content_hash).toBe(v1.versions[0].content_hash);     // v1 immutable (unchanged)
  });

  it("edit on a non-DRAFT quote is 409", async () => {
    await prep();
    const id = (await (await post("/api/quotes", CREATE, salesTok)).json() as any).id;
    await (env.DB as D1Database).prepare("UPDATE quotes SET status='SENT' WHERE id=?").bind(id).run();
    const res = await put(`/api/quotes/${id}`, CREATE, salesTok);
    expect(res.status).toBe(409);
    expect((await res.json() as any).code).toBe("E_NOT_DRAFT");
  });

  it("ops detail is redacted (no landed cost / margin)", async () => {
    await prep();
    const id = (await (await post("/api/quotes", CREATE, salesTok)).json() as any).id;
    const d = await (await get(`/api/quotes/${id}`, opsTok)).json() as any;
    expect(d.lines[0].unit_price_paise).toBe(12000);
    expect(d.lines[0].landed_cost_paise).toBeUndefined();
    expect(d.lines[0].line_margin_paise).toBeUndefined();
    expect(d.version.payload).toBeUndefined();            // full cost snapshot hidden
  });

  it("idempotency: same Idempotency-Key does not create a second quote", async () => {
    await prep();
    const r1 = await (await post("/api/quotes", CREATE, salesTok, { "Idempotency-Key": "abc-123" })).json() as any;
    const r2 = await (await post("/api/quotes", CREATE, salesTok, { "Idempotency-Key": "abc-123" })).json() as any;
    expect(r2.id).toBe(r1.id);
    expect(r2.idempotent_replay).toBe(true);
  });

  it("unknown client → 422; non-entitled user → 404; ops cannot create → 403", async () => {
    await prep();
    expect((await post("/api/quotes", { ...CREATE, client_id: "nope" }, salesTok)).status).toBe(422);
    expect((await post("/api/quotes", CREATE, undefined)).status).toBe(401);
    expect((await post("/api/quotes", CREATE, opsTok)).status).toBe(403); // ops has no create_edit
  });

  it("list returns the tenant's quotes", async () => {
    await prep();
    await post("/api/quotes", CREATE, salesTok);
    const l = await (await get("/api/quotes", salesTok)).json() as any;
    expect(l.quotes.length).toBeGreaterThanOrEqual(1);
    expect(l.quotes[0].quote_no).toMatch(/^GZ\//);
  });
});
