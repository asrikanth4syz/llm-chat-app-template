// Integration tests for the consolidated same-client, same-month view:
// POST /api/orders/consolidated. Covers the merged per-SKU rollup + totals, the
// min-2 / same-client / same-month guards, and client ownership scoping.
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
const consolidate = (ids: string[], t: string) => post("/api/orders/consolidated", { ids }, t);

let opsTok: string, cliTok: string;

async function mkOrder(id: string, client: string, month: string, total: number,
  items: { sku: string; name: string; qty: number; price: number; delivered: number }[]) {
  const d = db();
  await d.prepare("INSERT OR REPLACE INTO orders (id,client_id,status,created_by,subtotal,gst,grand_total,index_month,created_at) VALUES (?,?, 'IN_SHIPMENT','u-ops',?,0,?,?, ?)")
    .bind(id, client, total, total, month, month + "-02 10:00:00").run();
  const dc = "dc-" + id;
  await d.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number) VALUES (?,?, 'DELIVERED', ?)").bind(dc, id, "N-" + id).run();
  for (const it of items) {
    await d.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind(id + "-" + it.sku, id, it.sku, it.name, it.qty, it.price, it.qty * it.price).run();
    await d.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind(dc + "-" + it.sku, dc, it.sku, it.name, it.qty, it.delivered).run();
  }
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
  for (const sql of ["ALTER TABLE orders ADD COLUMN index_month TEXT", "ALTER TABLE orders ADD COLUMN index_seq INTEGER"]) { try { await d.prepare(sql).run(); } catch { /* exists */ } }
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cA','LinkedIn India','a@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cB','Meta India','b@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','super_admin','Ops','SP','OP',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli','cli@sp.test','SEED:pw123','client_admin','Cli','SP','CL',1,'cA')").run();
  opsTok = await login("ops@sp.test", "pw123");
  cliTok = await login("cli@sp.test", "pw123");

  // cA, Nov 2026: two orders sharing the COFFEE sku.
  await mkOrder("A1", "cA", "2026-11", 25000, [
    { sku: "COF", name: "Coffee", qty: 200, price: 100, delivered: 200 },
    { sku: "CUP", name: "Cups", qty: 500, price: 10, delivered: 500 }]); // fully delivered
  await mkOrder("A2", "cA", "2026-11", 16500, [
    { sku: "COF", name: "Coffee", qty: 150, price: 100, delivered: 100 },
    { sku: "SUG", name: "Sugar", qty: 300, price: 5, delivered: 0 }]);   // partial
  await mkOrder("A3", "cA", "2026-12", 9000, [{ sku: "WAT", name: "Water", qty: 100, price: 90, delivered: 0 }]); // different month
  await mkOrder("B1", "cB", "2026-11", 5000, [{ sku: "COF", name: "Coffee", qty: 50, price: 100, delivered: 0 }]); // different client
});

describe("consolidated view", () => {
  it("merges two same-client, same-month orders: per-SKU rollup + totals", async () => {
    const res = await consolidate(["A1", "A2"], opsTok);
    expect(res.status).toBe(200);
    const d = await res.json() as any;
    expect(d.client_name).toBe("LinkedIn India");
    expect(d.month).toBe("2026-11");
    expect(d.totals.orders).toBe(2);
    expect(d.totals.value).toBe(41500);                 // 25000 + 16500
    expect(d.totals.ordered_units).toBe(1150);          // 700 + 450
    expect(d.totals.delivered_units).toBe(800);         // 700 + (100 capped, sugar 0)
    expect(d.totals.delivered_value).toBe(35000);       // A1 25000 + A2 100*100
    expect(d.totals.fully_delivered).toBe(1);           // A1 only
    const cof = d.skus.find((s: any) => s.sku === "COF");
    expect(cof).toMatchObject({ ordered: 350, delivered: 300, due: 50 }); // merged across A1+A2
    const sug = d.skus.find((s: any) => s.sku === "SUG");
    expect(sug).toMatchObject({ ordered: 300, delivered: 0, due: 300 });
  });

  it("rejects fewer than two orders", async () => {
    const res = await consolidate(["A1"], opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("E_MIN");
  });

  it("rejects orders of different legal companies", async () => {
    const res = await consolidate(["A1", "B1"], opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("E_COMPANY");
  });

  it("allows consolidating sibling client records of the SAME legal company (same PAN)", async () => {
    const d = db();
    await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active,pan) VALUES ('cC1','Acme Bengaluru','x@y.z',1,'AAACA1111A')").run();
    await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active,pan) VALUES ('cC2','Acme Mumbai','x@y.z',1,'AAACA1111A')").run();
    await mkOrder("C1", "cC1", "2026-11", 1000, [{ sku: "X", name: "Item X", qty: 10, price: 100, delivered: 0 }]);
    await mkOrder("C2", "cC2", "2026-11", 2000, [{ sku: "X", name: "Item X", qty: 20, price: 100, delivered: 0 }]);
    const res = await consolidate(["C1", "C2"], opsTok);
    expect(res.status).toBe(200);
    const r = await res.json() as any;
    expect(r.totals.orders).toBe(2);
    expect(r.skus.find((s: any) => s.sku === "X").ordered).toBe(30); // merged across both records
  });

  it("rejects orders in different months", async () => {
    const res = await consolidate(["A1", "A3"], opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("E_MONTH");
  });

  it("a client can consolidate their own orders but not another client's", async () => {
    expect((await consolidate(["A1", "A2"], cliTok)).status).toBe(200);
    const denied = await consolidate(["A1", "B1"], cliTok);
    expect(denied.status).toBe(403);
  });
});
