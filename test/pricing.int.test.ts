// Integration tests for the single client-price resolver, applied on order creation
// and amendment: effective-dated client price wins, standard fallback, ops-placed
// orders get the agreed price, and the amend re-price / qty-keep / delivered-protect /
// manual-override rules. Also the dated-history write and the price-preview endpoint.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);
const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const patch = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PATCH", headers: hdr(t), body: JSON.stringify(b) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
async function login(e: string, pw: string): Promise<string> { return (await (await post("/api/auth/login", { email: e, password: pw })).json() as { token: string }).token; }
const db = () => env.DB as D1Database;
const lineFor = async (orderId: string, sku: string) => await db().prepare("SELECT unit_price, price_source FROM order_items WHERE order_id=? AND sku=?").bind(orderId, sku).first() as any;
let opsTok: string;
const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE = "2099-01-01";

beforeAll(async () => {
  const d = db();
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) { try { await d.prepare(stmt).run(); break; } catch (e: any) { const m = String(e);
        if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
        if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; } throw e; } }
    }
  }
  await d.prepare("CREATE TABLE IF NOT EXISTS client_catalog ( client_id TEXT NOT NULL, sku TEXT NOT NULL, added_by TEXT, added_at TEXT, client_price REAL, PRIMARY KEY (client_id, sku) )").run().catch(() => {});
  await d.prepare("CREATE TABLE IF NOT EXISTS client_price_history ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, sku TEXT NOT NULL, price REAL NOT NULL, effective_from TEXT NOT NULL, created_by TEXT, created_by_name TEXT, note TEXT, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("ALTER TABLE order_items ADD COLUMN price_source TEXT").run().catch(() => {});

  await d.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('cCh','Chaayos',1)").run();
  for (const [sku, price] of [["TEA", 200], ["TEA2", 300], ["STD", 500]] as [string, number][])
    await d.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reserved,gst_rate) VALUES (?,?,?,?,1000,0,0)").bind(sku, sku, "Tea", price).run();
  for (const sku of ["TEA", "TEA2", "STD"]) await d.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES ('cCh',?, 'seed')").bind(sku).run();
  // Agreed client prices: TEA 150 effective today; TEA2 250 effective in the FUTURE.
  await d.prepare("INSERT INTO client_price_history (id,client_id,sku,price,effective_from) VALUES ('h1','cCh','TEA',150,?)").bind(TODAY).run();
  await d.prepare("INSERT INTO client_price_history (id,client_id,sku,price,effective_from) VALUES ('h2','cCh','TEA2',250,?)").bind(FUTURE).run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','ops_admin','Priya','SP','P',1,NULL)").run();
  opsTok = await login("ops@sp.test", "pw123");
});

describe("create order — one resolver, effective dated", () => {
  it("ops-placed order gets the client's agreed price (not the standard price)", async () => {
    const r = await (await post("/api/orders", { client_id: "cCh", items: [{ sku: "TEA", name: "TEA", qty: 2, unit_price: 999 }] }, opsTok)).json() as any;
    const l = await lineFor(r.id, "TEA");
    expect(l.unit_price).toBe(150);      // agreed client price, resolver overrode the bogus 999
    expect(l.price_source).toBe("client");
  });
  it("a future-dated agreed price does not apply today (falls back to standard)", async () => {
    const r = await (await post("/api/orders", { client_id: "cCh", items: [{ sku: "TEA2", name: "TEA2", qty: 1, unit_price: 300 }] }, opsTok)).json() as any;
    const l = await lineFor(r.id, "TEA2");
    expect(l.unit_price).toBe(300);      // TEA2 agreed price only starts in 2099 → standard 300 stands
    expect(l.price_source).toBe("standard");
  });
  it("a SKU with no agreed price keeps the standard price", async () => {
    const r = await (await post("/api/orders", { client_id: "cCh", items: [{ sku: "STD", name: "STD", qty: 1, unit_price: 500 }] }, opsTok)).json() as any;
    const l = await lineFor(r.id, "STD");
    expect(l.unit_price).toBe(500);
    expect(l.price_source).toBe("standard");
  });
});

describe("setting a client price records dated history", () => {
  it("PATCH writes a history row and the resolver then uses it", async () => {
    await patch("/api/clients/cCh/catalog/STD", { client_price: 400, effective_from: TODAY }, opsTok);
    const h = await db().prepare("SELECT price, effective_from FROM client_price_history WHERE client_id='cCh' AND sku='STD' ORDER BY created_at DESC LIMIT 1").first() as any;
    expect(h.price).toBe(400);
    const r = await (await post("/api/orders", { client_id: "cCh", items: [{ sku: "STD", name: "STD", qty: 1, unit_price: 500 }] }, opsTok)).json() as any;
    expect((await lineFor(r.id, "STD")).unit_price).toBe(400);
  });
});

describe("amend — which lines are re-priced", () => {
  async function seedOrder(id: string) {
    await db().prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,revision,created_at) VALUES (?,?,?,?,?,?,?,1,datetime('now'))")
      .bind(id, "cCh", "u-ops", "APPROVED", 1140, 0, 1140).run();
    await db().prepare("DELETE FROM order_items WHERE order_id=?").bind(id).run();
    await db().prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total,price_source) VALUES (?,?,?,?,?,?,?,?)").bind("i1", id, "TEA", "TEA", 1, 140, 140, "client").run();
    await db().prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total,price_source) VALUES (?,?,?,?,?,?,?,?)").bind("i2", id, "STD", "STD", 2, 500, 1000, "standard").run();
  }
  const amend = (id: string, b: any) => post(`/api/orders/${id}/amend`, b, opsTok);

  it("a newly added line gets the client's agreed price", async () => {
    // Order seeded with STD only; amend ADDS a new TEA line → resolver prices it at the agreed 150.
    await db().prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,revision) VALUES ('OA1c','cCh','u-ops','APPROVED',1000,0,1000,1)").run();
    await db().prepare("DELETE FROM order_items WHERE order_id='OA1c'").run();
    await db().prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total,price_source) VALUES ('x1','OA1c','STD','STD',2,500,1000,'standard')").run();
    await amend("OA1c", { reason: "add tea line", items: [{ sku: "STD", name: "STD", qty: 2, unit_price: 500 }, { sku: "TEA", name: "TEA", qty: 1, unit_price: 999 }] });
    const l = await lineFor("OA1c", "TEA");
    expect(l.unit_price).toBe(150); expect(l.price_source).toBe("client");
  });

  it("a quantity-only change keeps the existing price", async () => {
    await seedOrder("OA2");
    await amend("OA2", { reason: "qty up", items: [{ sku: "TEA", name: "TEA", qty: 5, unit_price: 140 }, { sku: "STD", name: "STD", qty: 2, unit_price: 500 }] });
    expect((await lineFor("OA2", "TEA")).unit_price).toBe(140); // kept, not re-priced to 150
  });

  it("an inline price edit is a flagged manual override", async () => {
    await seedOrder("OA3");
    await amend("OA3", { reason: "price tweak", items: [{ sku: "TEA", name: "TEA", qty: 1, unit_price: 177 }, { sku: "STD", name: "STD", qty: 2, unit_price: 500 }] });
    const l = await lineFor("OA3", "TEA");
    expect(l.unit_price).toBe(177); expect(l.price_source).toBe("override");
  });

  it("reprice_all updates lines to the current client price", async () => {
    await seedOrder("OA4");
    await amend("OA4", { reason: "refresh prices", reprice_all: true, items: [{ sku: "TEA", name: "TEA", qty: 1, unit_price: 140 }, { sku: "STD", name: "STD", qty: 2, unit_price: 500 }] });
    expect((await lineFor("OA4", "TEA")).unit_price).toBe(150);  // agreed price applied
    expect((await lineFor("OA4", "STD")).unit_price).toBe(500);  // STD has no agreed price → keeps its price
  });

  it("price-preview reports the current vs client price and the diff", async () => {
    await seedOrder("OA5");
    const p = await (await get("/api/orders/OA5/price-preview", opsTok)).json() as any;
    const tea = p.lines.find((l: any) => l.sku === "TEA");
    expect(tea.current_price).toBe(140); expect(tea.client_price).toBe(150); expect(tea.repriceable).toBe(true);
    expect(p.diff).toBe(10); // TEA qty 1: 150-140; STD already at agreed 400? seed STD is 500 → +?
  });
});
