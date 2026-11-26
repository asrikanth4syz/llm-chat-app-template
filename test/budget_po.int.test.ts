// Integration tests for the Budget & PO backend: budget auto-seed, revisions with the
// floor rule / on-behalf PO / approval-pending, settings permissions, PO create/list,
// and that an order against a PO writes a committed ledger entry. Server enforces roles.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);
const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
async function login(e: string, pw: string): Promise<string> { return (await (await post("/api/auth/login", { email: e, password: pw })).json() as { token: string }).token; }
const db = () => env.DB as D1Database;
let opsTok: string, caTok: string, cuTok: string;

beforeAll(async () => {
  const d = db();
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) { try { await d.prepare(stmt).run(); break; } catch (e: any) { const m = String(e);
        if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
        if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; } throw e; } }
    }
  }
  for (const s of ["ALTER TABLE clients ADD COLUMN display_name TEXT", "ALTER TABLE orders ADD COLUMN location_id TEXT", "ALTER TABLE orders ADD COLUMN po_id TEXT", "ALTER TABLE orders ADD COLUMN po_override_reason TEXT"]) await d.prepare(s).run().catch(() => {});
  await d.prepare("CREATE TABLE IF NOT EXISTS client_locations ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, display_name TEXT NOT NULL, shipping_address TEXT, contact_name TEXT, contact_phone TEXT, zoho_address_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();
  // Budget/PO tables (created at runtime in prod by ensureBudgetPoSchema, whose ready
  // flag persists across the isolate while test storage resets — so seed them here).
  await d.prepare("CREATE TABLE IF NOT EXISTS location_budgets ( id TEXT PRIMARY KEY, location_id TEXT NOT NULL, client_id TEXT NOT NULL, period_type TEXT NOT NULL DEFAULT 'Monthly', period_label TEXT, period_start TEXT, period_end TEXT, amount REAL NOT NULL DEFAULT 0, created_by_type TEXT NOT NULL DEFAULT 'client', active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS budget_revisions ( id TEXT PRIMARY KEY, budget_id TEXT, location_id TEXT NOT NULL, old_amount REAL, new_amount REAL, period_type TEXT, period_label TEXT, effective_kind TEXT, effective_from TEXT, po_ref TEXT, reason TEXT, note TEXT, attachment_name TEXT, changed_by TEXT, changed_by_name TEXT, changed_role TEXT, source TEXT, status TEXT NOT NULL DEFAULT 'applied', approver TEXT, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS budget_settings ( client_id TEXT PRIMARY KEY, approval_required INTEGER NOT NULL DEFAULT 0, threshold_pct INTEGER NOT NULL DEFAULT 20, approver_user_id TEXT, po_mandatory INTEGER NOT NULL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS client_pos ( id TEXT PRIMARY KEY, po_number TEXT NOT NULL, client_location_id TEXT NOT NULL, budget_id TEXT, type TEXT NOT NULL DEFAULT 'Blanket', valid_from TEXT, valid_to TEXT, amount REAL NOT NULL DEFAULT 0, category_scope TEXT, document_name TEXT, status TEXT NOT NULL DEFAULT 'Active', version INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS client_po_ledger ( id TEXT PRIMARY KEY, po_id TEXT NOT NULL, order_id TEXT, type TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS client_po_amendments ( id TEXT PRIMARY KEY, po_id TEXT NOT NULL, old_amount REAL, new_amount REAL, reason TEXT, changed_by TEXT, changed_by_name TEXT, changed_at TEXT DEFAULT (datetime('now')) )").run();

  await d.prepare("INSERT OR IGNORE INTO clients (id,name,monthly_budget,active) VALUES ('cCh','Chaayos',180000,1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,is_default,active) VALUES ('locInd','cCh','Chaayos - Indiranagar',1,1)").run();
  await d.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reserved,gst_rate) VALUES ('BW','Brew','Tea',100,1000,0,0)").run();
  // committed = 20000 (open), actual = 92000 (delivered) this month → floor 112000
  await d.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,location_id,status,subtotal,gst,grand_total,created_at) VALUES ('o-del','cCh','u-ops','locInd','DELIVERED',92000,0,92000,datetime('now'))").run();
  await d.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,location_id,status,subtotal,gst,grand_total,created_at) VALUES ('o-open','cCh','u-ops','locInd','SUBMITTED',20000,0,20000,datetime('now'))").run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','ops_admin','Priya','SP','P',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ca','ca@sp.test','SEED:pw123','client_admin','Ravi','Chaayos','R',1,'cCh')").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cu','cu@sp.test','SEED:pw123','client_user','Sana','Chaayos','S',1,'cCh')").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-appr','appr@sp.test','SEED:pw123','client_approver','Anita','Chaayos','A',1,'cCh')").run();
  opsTok = await login("ops@sp.test", "pw123"); caTok = await login("ca@sp.test", "pw123"); cuTok = await login("cu@sp.test", "pw123");
});

describe("budget read + floor", () => {
  it("auto-seeds the active budget from the client's monthly_budget and derives committed/actual/floor", async () => {
    const r = await (await get("/api/locations/locInd/budget", caTok)).json() as any;
    expect(r.budget.amount).toBe(180000);
    expect(r.committed).toBe(20000);
    expect(r.actual).toBe(92000);
    expect(r.floor).toBe(112000);
    expect(r.remaining).toBe(68000);
  });
});

describe("budget revise", () => {
  it("client admin edit applies and updates the active amount", async () => {
    const r = await (await post("/api/locations/locInd/budget/revise", { new_amount: 200000, reason: "New outlet volume" }, caTok)).json() as any;
    expect(r.status).toBe("applied");
    expect((await (await get("/api/locations/locInd/budget", caTok)).json() as any).budget.amount).toBe(200000);
  });
  it("rejects an amount below the floor", async () => {
    const res = await post("/api/locations/locInd/budget/revise", { new_amount: 100000, reason: "x" }, caTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).floor).toBe(112000);
  });
  it("requires a reason", async () => {
    expect((await post("/api/locations/locInd/budget/revise", { new_amount: 200000 }, caTok)).status).toBe(400);
  });
  it("Our Admin must supply a PO reference (on behalf), then it applies tagged behalf", async () => {
    expect((await post("/api/locations/locInd/budget/revise", { new_amount: 200000, reason: "x" }, opsTok)).status).toBe(400);
    const r = await (await post("/api/locations/locInd/budget/revise", { new_amount: 200000, reason: "x", po_ref: "PO-26-0142" }, opsTok)).json() as any;
    expect(r.status).toBe("applied");
    const rev = await db().prepare("SELECT source,po_ref FROM budget_revisions WHERE location_id='locInd' ORDER BY created_at DESC LIMIT 1").first() as any;
    expect(rev.source).toBe("behalf"); expect(rev.po_ref).toBe("PO-26-0142");
  });
  it("effective-from-next-period is pending and does not change the active amount", async () => {
    const r = await (await post("/api/locations/locInd/budget/revise", { new_amount: 250000, reason: "x", effective_kind: "next" }, caTok)).json() as any;
    expect(r.status).toBe("pending");
    expect((await (await get("/api/locations/locInd/budget", caTok)).json() as any).budget.amount).toBe(180000);
  });
  it("a change over the approval threshold is pending", async () => {
    await put("/api/clients/cCh/budget-settings", { approval_required: true, threshold_pct: 15, approver_user_id: "u-appr" }, caTok);
    const r = await (await post("/api/locations/locInd/budget/revise", { new_amount: 230000, reason: "x" }, caTok)).json() as any; // +27%
    expect(r.status).toBe("pending");
  });
  it("client user cannot revise", async () => {
    expect((await post("/api/locations/locInd/budget/revise", { new_amount: 200000, reason: "x" }, cuTok)).status).toBe(403);
  });
});

describe("budget settings permissions", () => {
  it("only the client admin can turn on approval; Our Admin is forbidden", async () => {
    expect((await put("/api/clients/cCh/budget-settings", { approval_required: true, approver_user_id: "u-appr" }, opsTok)).status).toBe(403);
    expect((await put("/api/clients/cCh/budget-settings", { approval_required: true, threshold_pct: 20, approver_user_id: "u-appr" }, caTok)).status).toBe(200);
  });
  it("approval without an approver stays off", async () => {
    await put("/api/clients/cCh/budget-settings", { approval_required: true, threshold_pct: 20, approver_user_id: "" }, caTok);
    const s = await (await get("/api/clients/cCh/budget-settings", caTok)).json() as any;
    expect(s.approval_required).toBe(0);
  });
  it("po_mandatory defaults to 0 (optional)", async () => {
    const s = await (await get("/api/clients/cCh/budget-settings", caTok)).json() as any;
    expect(s.po_mandatory).toBe(0);
  });
});

describe("purchase orders + ledger", () => {
  it("Our Admin creates a PO; client admin cannot; list returns the balance", async () => {
    expect((await post("/api/locations/locInd/pos", { po_number: "PO-X1", amount: 100000, type: "Blanket" }, caTok)).status).toBe(403);
    const c = await (await post("/api/locations/locInd/pos", { po_number: "PO-26-0160", amount: 500000, type: "Blanket", category_scope: ["Tea"] }, opsTok)).json() as any;
    expect(c.ok).toBe(true);
    const list = await (await get("/api/locations/locInd/pos", opsTok)).json() as any;
    const po = list.pos.find((p: any) => p.id === c.id);
    expect(po.balance).toBe(500000);
    expect(po.category_scope).toEqual(["Tea"]);
  });
  it("an order against a PO writes a committed ledger entry (PO committed rises)", async () => {
    const c = await (await post("/api/locations/locInd/pos", { po_number: "PO-26-0161", amount: 500000, type: "Blanket" }, opsTok)).json() as any;
    const o = await (await post("/api/orders", { client_id: "cCh", location_id: "locInd", po_id: c.id, items: [{ sku: "BW", name: "Brew", qty: 2, unit_price: 100 }] }, opsTok)).json() as any;
    const grand = (await db().prepare("SELECT grand_total FROM orders WHERE id=?").bind(o.id).first() as any).grand_total;
    expect(grand).toBe(200);
    const list = await (await get("/api/locations/locInd/pos", opsTok)).json() as any;
    const po = list.pos.find((p: any) => p.id === c.id);
    expect(po.committed).toBe(200);
    expect(po.balance).toBe(499800);
  });
});
