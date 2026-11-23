// Integration tests for P2c — choosing the ship-to location when creating an order.
// Covers the order-locations read endpoint (role scope) and that handleCreateOrder
// honours an explicit location_id, falls back to the client's default location, and
// ignores a location_id that doesn't belong to the client.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
async function login(email: string, password: string): Promise<string> {
  return (await (await post("/api/auth/login", { email, password })).json() as { token: string }).token;
}
const db = () => env.DB as D1Database;
const items = [{ sku: "LOC-WIDGET", name: "Widget", qty: 2, unit_price: 100 }];
let opsTok: string, cliTok: string, cli2Tok: string;

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
  for (const sql of ["ALTER TABLE orders ADD COLUMN location_id TEXT"]) await d.prepare(sql).run().catch(() => {});
  await d.prepare("CREATE TABLE IF NOT EXISTS client_locations ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, display_name TEXT NOT NULL, shipping_address TEXT, contact_name TEXT, contact_phone TEXT, zoho_address_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();

  await d.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reserved,gst_rate) VALUES ('LOC-WIDGET','Widget','Misc',100,1000,0,18)").run();
  // Multi-location client cM (EGL default + Bagmane); single-location client is seeded by the server default.
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,address,active) VALUES ('cM','ServiceNow India','Manyata EGL',1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,is_default,active) VALUES ('locEGL','cM','ServiceNow · EGL','Manyata EGL',1,1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,is_default,active) VALUES ('locBAG','cM','ServiceNow · Bagmane','Bagmane',0,1)").run();
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,address,active) VALUES ('cOther','Globex','HQ',1)").run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','super_admin','Ops','SP','OP',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli','cli@sp.test','SEED:pw123','client_admin','Cli','ServiceNow India','CL',1,'cM')").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli2','cli2@sp.test','SEED:pw123','client_admin','Cli2','Globex','C2',1,'cOther')").run();
  opsTok = await login("ops@sp.test", "pw123");
  cliTok = await login("cli@sp.test", "pw123");
  cli2Tok = await login("cli2@sp.test", "pw123");
});

describe("order-locations endpoint (P2c)", () => {
  it("lists a client's active ship-to locations, default first", async () => {
    const r = await (await get("/api/clients/cM/order-locations", opsTok)).json() as any;
    expect(r.locations.length).toBe(2);
    expect(r.locations[0].id).toBe("locEGL");       // default ordered first
    expect(r.locations[0].is_default).toBe(1);
  });
  it("a client user may read their own client's locations", async () => {
    const res = await get("/api/clients/cM/order-locations", cliTok);
    expect(res.status).toBe(200);
  });
  it("a client user may NOT read another client's locations", async () => {
    const res = await get("/api/clients/cM/order-locations", cli2Tok);
    expect(res.status).toBe(403);
  });
});

describe("create order with a chosen location (P2c)", () => {
  it("honours an explicit location_id", async () => {
    const r = await (await post("/api/orders", { client_id: "cM", items, location_id: "locBAG" }, opsTok)).json() as any;
    const o = await db().prepare("SELECT location_id FROM orders WHERE id=?").bind(r.id).first() as any;
    expect(o.location_id).toBe("locBAG");
  });
  it("falls back to the default location when none is given", async () => {
    const r = await (await post("/api/orders", { client_id: "cM", items }, opsTok)).json() as any;
    const o = await db().prepare("SELECT location_id FROM orders WHERE id=?").bind(r.id).first() as any;
    expect(o.location_id).toBe("locEGL");
  });
  it("ignores a location_id that is not this client's (falls back to default)", async () => {
    const r = await (await post("/api/orders", { client_id: "cM", items, location_id: "locELSEWHERE" }, opsTok)).json() as any;
    const o = await db().prepare("SELECT location_id FROM orders WHERE id=?").bind(r.id).first() as any;
    expect(o.location_id).toBe("locEGL");
  });
  it("tags a draft order with the chosen location too", async () => {
    const r = await (await post("/api/orders", { client_id: "cM", items, location_id: "locBAG", save_as_draft: true }, opsTok)).json() as any;
    expect(r.status).toBe("DRAFT");
    const o = await db().prepare("SELECT location_id FROM orders WHERE id=?").bind(r.id).first() as any;
    expect(o.location_id).toBe("locBAG");
  });
});
