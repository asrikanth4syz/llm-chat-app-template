// Integration tests for the Billing & Invoice Tracker backend: config, period
// generation, unbilled-DC listing, draft reservation, recording (marks DCs billed,
// dedupes invoice numbers), submission tracking and cancel. Server enforces roles.
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
let finTok: string, cuTok: string;
const TODAY = new Date().toISOString().slice(0, 10);
const MONTH = TODAY.slice(0, 7);

beforeAll(async () => {
  const d = db();
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) { try { await d.prepare(stmt).run(); break; } catch (e: any) { const m = String(e);
        if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
        if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; } throw e; } }
    }
  }
  // delivery_challans billing columns (ALTERed at runtime in prod).
  for (const s of [
    "CREATE TABLE IF NOT EXISTS delivery_challans ( id TEXT PRIMARY KEY, order_id TEXT, status TEXT, total_qty REAL, delivered_qty REAL, dc_number TEXT, dc_class TEXT, category TEXT, client_name TEXT, billed INTEGER DEFAULT 0, billed_at TEXT, invoice_no TEXT, invoice_date TEXT, dispatched_at TEXT, delivered_at TEXT, created_at TEXT DEFAULT (datetime('now')) )",
    "ALTER TABLE delivery_challans ADD COLUMN billed INTEGER DEFAULT 0",
    "ALTER TABLE delivery_challans ADD COLUMN billed_at TEXT",
    "ALTER TABLE delivery_challans ADD COLUMN invoice_no TEXT",
    "ALTER TABLE delivery_challans ADD COLUMN invoice_date TEXT",
    "ALTER TABLE delivery_challans ADD COLUMN category TEXT",
    "ALTER TABLE delivery_challans ADD COLUMN client_name TEXT",
    "ALTER TABLE delivery_challans ADD COLUMN delivered_at TEXT",
  ]) await d.prepare(s).run().catch(() => {});
  // Billing tables (ensureBillingSchema's ready flag persists across the isolate).
  for (const s of [
    "CREATE TABLE IF NOT EXISTS billing_configs ( client_id TEXT PRIMARY KEY, frequency TEXT NOT NULL DEFAULT 'Monthly', invoice_target_days INTEGER NOT NULL DEFAULT 2, submission_target_days INTEGER NOT NULL DEFAULT 5, default_owner TEXT, req_email INTEGER NOT NULL DEFAULT 1, req_portal INTEGER NOT NULL DEFAULT 0, req_hardcopy INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')) )",
    "CREATE TABLE IF NOT EXISTS billing_periods ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, frequency TEXT NOT NULL, period_key TEXT NOT NULL, label TEXT, period_start TEXT NOT NULL, period_end TEXT NOT NULL, invoice_target_date TEXT, submission_target_date TEXT, status TEXT NOT NULL DEFAULT 'open', no_billing_reason TEXT, created_at TEXT DEFAULT (datetime('now')), UNIQUE (client_id, period_key) )",
    "CREATE TABLE IF NOT EXISTS billing_invoices ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, period_id TEXT, owner TEXT, owner_name TEXT, status TEXT NOT NULL DEFAULT 'Draft', submission_status TEXT NOT NULL DEFAULT 'Not Ready', invoice_no TEXT, invoice_date TEXT, taxable_amount REAL, gst_amount REAL, total_amount REAL, allocated_value REAL NOT NULL DEFAULT 0, invoice_target_date TEXT, submission_target_date TEXT, submitted_date TEXT, email_date TEXT, portal_date TEXT, hardcopy_date TEXT, req_email INTEGER NOT NULL DEFAULT 0, req_portal INTEGER NOT NULL DEFAULT 0, req_hardcopy INTEGER NOT NULL DEFAULT 0, remarks TEXT, created_by TEXT, created_by_name TEXT, created_at TEXT DEFAULT (datetime('now')), recorded_at TEXT, cancelled_at TEXT, updated_by TEXT, updated_at TEXT )",
    "CREATE TABLE IF NOT EXISTS billing_invoice_dcs ( id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, dc_id TEXT NOT NULL, dc_number TEXT, dc_value REAL NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), UNIQUE (dc_id) )",
  ]) await d.prepare(s).run().catch(() => {});

  await d.prepare("INSERT OR IGNORE INTO clients (id,name,monthly_budget,active) VALUES ('cCh','Chaayos',180000,1)").run();
  await d.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,created_at) VALUES ('o1','cCh','u-fin','DELIVERED',10000,0,10000,datetime('now'))").run();
  await d.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,created_at) VALUES ('o2','cCh','u-fin','DELIVERED',5000,0,5000,datetime('now'))").run();
  // Two delivered, unbilled DCs for Chaayos, delivered today (within the current period).
  await d.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,dc_number,client_name,billed,delivered_at,dispatched_at) VALUES ('dc1','o1','DELIVERED','DC-1','Chaayos',0,?,?)").bind(TODAY, TODAY).run();
  await d.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,dc_number,client_name,billed,delivered_at,dispatched_at) VALUES ('dc2','o2','DELIVERED','DC-2','Chaayos',0,?,?)").bind(TODAY, TODAY).run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-fin','fin@sp.test','SEED:pw123','finance_admin','Meera','SP','M',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cu','cu@sp.test','SEED:pw123','client_user','Sana','Chaayos','S',1,'cCh')").run();
  finTok = await login("fin@sp.test", "pw123"); cuTok = await login("cu@sp.test", "pw123");
});

async function currentPeriodId(): Promise<string> {
  const r = await (await get("/api/billing/clients/cCh/periods", finTok)).json() as any;
  return r.periods.find((p: any) => p.period_key === r.current_key).id;
}

describe("billing config", () => {
  it("returns defaults, then accepts an update", async () => {
    const c = await (await get("/api/billing/clients/cCh/config", finTok)).json() as any;
    expect(c.frequency).toBe("Monthly");
    const u = await (await put("/api/billing/clients/cCh/config", { frequency: "Fortnightly", submission_target_days: 7, req_portal: true }, finTok)).json() as any;
    expect(u.frequency).toBe("Fortnightly");
    expect(u.submission_target_days).toBe(7);
    expect(u.req_portal).toBe(1);
  });
  it("a client user cannot touch billing", async () => {
    expect((await get("/api/billing/clients/cCh/config", cuTok)).status).toBe(403);
  });
});

describe("periods + unbilled DCs", () => {
  it("generates the current month's period(s) and flags the current one", async () => {
    const r = await (await get("/api/billing/clients/cCh/periods", finTok)).json() as any;
    expect(r.periods.length).toBeGreaterThan(0);
    expect(r.periods.some((p: any) => p.period_key === r.current_key)).toBe(true);
  });
  it("lists the two delivered, unbilled DCs in the current period", async () => {
    const pid = await currentPeriodId();
    const r = await (await get(`/api/billing/clients/cCh/unbilled?period_id=${pid}`, finTok)).json() as any;
    const ids = r.in_period.map((x: any) => x.id).sort();
    expect(ids).toEqual(["dc1", "dc2"]);
    expect(r.in_period_value).toBe(15000);
  });
});

describe("draft → record → submission", () => {
  it("creates a draft reserving a DC; a second draft cannot reserve the same DC", async () => {
    const pid = await currentPeriodId();
    const c = await (await post("/api/billing/invoices", { client_id: "cCh", period_id: pid, dc_ids: ["dc1"] }, finTok)).json() as any;
    expect(c.status).toBe("Draft");
    expect(c.allocated_value).toBe(10000);
    // dc1 no longer appears in unbilled (reserved)
    const un = await (await get(`/api/billing/clients/cCh/unbilled?period_id=${pid}`, finTok)).json() as any;
    expect(un.in_period.map((x: any) => x.id)).toEqual(["dc2"]);
    // second draft with dc1 is rejected
    expect((await post("/api/billing/invoices", { client_id: "cCh", period_id: pid, dc_ids: ["dc1"] }, finTok)).status).toBe(409);
  });
  it("records the invoice (marks the DC billed), dedupes the invoice number, then tracks submission", async () => {
    const pid = await currentPeriodId();
    // Require both email and portal so the draft snapshots both channels.
    await put("/api/billing/clients/cCh/config", { req_email: true, req_portal: true }, finTok);
    const c = await (await post("/api/billing/invoices", { client_id: "cCh", period_id: pid, dc_ids: ["dc1", "dc2"] }, finTok)).json() as any;
    // record
    const rec = await post(`/api/billing/invoices/${c.id}/record`, { invoice_no: "INV-100", invoice_date: TODAY, taxable_amount: 15000, gst_amount: 0, total_amount: 15000 }, finTok);
    expect(rec.status).toBe(200);
    expect((await rec.json() as any).status).toBe("Recorded");
    // the DCs are now billed and leave the unbilled list
    const un = await (await get(`/api/billing/clients/cCh/unbilled?period_id=${pid}`, finTok)).json() as any;
    expect(un.in_period.length).toBe(0);
    expect((await db().prepare("SELECT billed,invoice_no FROM delivery_challans WHERE id='dc1'").first() as any).invoice_no).toBe("INV-100");
    // a second draft recorded with the same invoice number is rejected
    await db().prepare("INSERT INTO delivery_challans (id,order_id,status,dc_number,client_name,billed,delivered_at) VALUES ('dc3','o1','DELIVERED','DC-3','Chaayos',0,?)").bind(TODAY).run();
    const c2 = await (await post("/api/billing/invoices", { client_id: "cCh", period_id: pid, dc_ids: ["dc3"] }, finTok)).json() as any;
    expect((await post(`/api/billing/invoices/${c2.id}/record`, { invoice_no: "INV-100", invoice_date: TODAY, total_amount: 500 }, finTok)).status).toBe(409);
    // submission: config requires email (default) + portal (set earlier) → email only = Partially
    const s1 = await (await post(`/api/billing/invoices/${c.id}/submission`, { email_date: TODAY }, finTok)).json() as any;
    expect(s1.submission_status).toBe("Partially Submitted");
    const s2 = await (await post(`/api/billing/invoices/${c.id}/submission`, { portal_date: TODAY }, finTok)).json() as any;
    expect(s2.submission_status).toBe("Submitted");
    expect(s2.submitted_date).toBe(TODAY);
  });
  it("cancelling a draft releases its DCs back to unbilled", async () => {
    const pid = await currentPeriodId();
    await db().prepare("INSERT INTO delivery_challans (id,order_id,status,dc_number,client_name,billed,delivered_at) VALUES ('dc4','o2','DELIVERED','DC-4','Chaayos',0,?)").bind(TODAY).run();
    const c = await (await post("/api/billing/invoices", { client_id: "cCh", period_id: pid, dc_ids: ["dc4"] }, finTok)).json() as any;
    const reserved = await (await get(`/api/billing/clients/cCh/unbilled?period_id=${pid}`, finTok)).json() as any;
    expect(reserved.in_period.some((y: any) => y.id === "dc4")).toBe(false); // reserved → hidden
    const cancel = await post(`/api/billing/invoices/${c.id}/cancel`, {}, finTok);
    expect((await cancel.json() as any).status).toBe("Cancelled");
    const un = await (await get(`/api/billing/clients/cCh/unbilled?period_id=${pid}`, finTok)).json() as any;
    expect(un.in_period.some((x: any) => x.id === "dc4")).toBe(true);
  });
});

describe("overview", () => {
  it("reports KPIs for the finance user", async () => {
    const r = await (await get("/api/billing/overview", finTok)).json() as any;
    expect(typeof r.unbilled_dcs).toBe("number");
    expect(typeof r.pending_submission).toBe("number");
    expect((await get("/api/billing/overview", cuTok)).status).toBe(403);
  });
});
