// Integration tests for the Zoho → SmartPantry delivery-challan import (P1):
// GET  /api/orders/:id/zoho-dc-candidates
// POST /api/orders/:id/zoho-dc-import/preview
// POST /api/orders/:id/zoho-dc-import/commit
// Covers super-admin gate, client-name match + dup flag, reconciliation (over +
// unmatched), commit write-through + idempotency + settle, and the duplicate /
// client-mismatch refusals.
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

let saTok: string, cliTok: string;

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
  // Zoho mirror tables (created at runtime by ensureZohoDCTable in prod; seed here).
  await d.prepare("CREATE TABLE IF NOT EXISTS zoho_delivery_challans ( zoho_dc_id TEXT PRIMARY KEY, dc_number TEXT, dc_date TEXT, ym TEXT, customer_id TEXT, customer_name TEXT, line_count INTEGER DEFAULT 0, qty_count REAL DEFAULT 0, invoiced_status TEXT, invoice_numbers TEXT DEFAULT '[]', total REAL DEFAULT 0, currency_code TEXT, zoho_modified TEXT, synced_at TEXT, detail_ok INTEGER DEFAULT 0 )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS zoho_dc_items ( id INTEGER PRIMARY KEY AUTOINCREMENT, zoho_dc_id TEXT NOT NULL, zoho_item_id TEXT, sku TEXT, name TEXT, qty REAL NOT NULL DEFAULT 0 )").run();

  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cZ','Zoho Client','z@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-sa','sa@sp.test','SEED:pw123','super_admin','SA','SP','SA',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cz','cz@sp.test','SEED:pw123','client_admin','CZ','SP','CZ',1,'cZ')").run();

  // Orders + items. OZ: A60/B120/C100 (partial after import). OZ2: A60 (fully settles).
  const mkOrder = async (id: string) =>
    d.prepare("INSERT OR REPLACE INTO orders (id,client_id,status,created_by,subtotal,gst,grand_total,revision,created_at) VALUES (?,?, 'READY_TO_PICK','u-sa',1000,180,1180,1,'2026-11-01 10:00:00')").bind(id, "cZ").run();
  await mkOrder("OZ");
  await mkOrder("OZ2");
  const it = (oid: string, sku: string, name: string, qty: number) =>
    d.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind(`${oid}-${sku}`, oid, sku, name, qty, 10, qty * 10).run();
  await it("OZ", "A", "Rice", 60); await it("OZ", "B", "Oil", 120); await it("OZ", "C", "Dal", 100);
  await it("OZ2", "A", "Rice", 60);

  // Pre-existing SmartPantry challan whose number (DUP-1) collides with z2.
  await d.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,dc_number) VALUES ('pre-dup','OTHERORD','DELIVERED','DUP-1')").run();

  // Zoho DCs + line items.
  const zdc = (id: string, num: string, cust: string) =>
    d.prepare("INSERT OR REPLACE INTO zoho_delivery_challans (zoho_dc_id,dc_number,dc_date,ym,customer_name,line_count,qty_count,detail_ok) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id, num, "2026-11-10", "2026-11", cust, 3, 100).run();
  const zi = (id: string, sku: string, name: string, qty: number) =>
    d.prepare("INSERT INTO zoho_dc_items (zoho_dc_id,sku,name,qty) VALUES (?,?,?,?)").bind(id, sku, name, qty).run();
  await zdc("z1", "DC-5001", "Zoho Client"); await zi("z1", "A", "Rice", 60); await zi("z1", "B", "Oil", 160); await zi("z1", "Z", "Ghost", 10);
  await zdc("z2", "DUP-1", "Zoho Client"); await zi("z2", "A", "Rice", 10);
  await zdc("z3", "DC-5003", "Other Co"); await zi("z3", "A", "Rice", 60);
  await zdc("z5", "DC-5005", "Zoho Client"); await zi("z5", "A", "Rice", 60);
  // OZ3 + z6: an over-delivery on A while C is still due — exercises per-line settlement.
  await mkOrder("OZ3"); await it("OZ3", "A", "Rice", 60); await it("OZ3", "C", "Dal", 100);
  await zdc("z6", "DC-5006", "Zoho Client"); await zi("z6", "A", "Rice", 160);

  saTok = await login("sa@sp.test", "pw123");
  cliTok = await login("cz@sp.test", "pw123");
});

describe("Zoho DC import — candidates", () => {
  it("rejects a non-super-admin", async () => {
    expect((await get("/api/orders/OZ/zoho-dc-candidates", cliTok)).status).toBe(403);
  });
  it("lists client-matched unlinked DCs and flags a number already in SmartPantry", async () => {
    const r = await (await get("/api/orders/OZ/zoho-dc-candidates", saTok)).json() as any;
    const ids = r.candidates.map((c: any) => c.zoho_dc_id);
    expect(ids).toContain("z1");
    expect(ids).toContain("z2");
    expect(ids).not.toContain("z3"); // different customer name
    expect(r.candidates.find((c: any) => c.zoho_dc_id === "z2").already_in_smartpantry).toBe(true);
    expect(r.candidates.find((c: any) => c.zoho_dc_id === "z1").already_in_smartpantry).toBe(false);
  });
});

describe("Zoho DC import — preview", () => {
  it("reconciles with over + unmatched and allows commit", async () => {
    const p = await (await post("/api/orders/OZ/zoho-dc-import/preview", { zoho_dc_id: "z1" }, saTok)).json() as any;
    expect(p.client_match).toBe(true);
    expect(p.duplicate).toBe(false);
    expect(p.verdict).toBe("warn");
    expect(p.totals.over_qty).toBe(40);
    expect(p.totals.unmatched_lines).toBe(1);
    expect(p.can_commit).toBe(true);
    expect(p.lines.find((l: any) => l.sku === "B").status).toBe("over");
    expect(p.lines.find((l: any) => l.sku === "Z").status).toBe("unmatched");
  });
});

describe("Zoho DC import — commit", () => {
  it("writes the DC + matched items, settles to PARTIALLY_CLOSED, and is idempotent", async () => {
    const r = await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z1", confirm: true }, saTok);
    expect(r.status).toBe(201);
    const body = await r.json() as any;
    expect(body.imported_lines).toBe(2);   // A + B; Z skipped
    expect(body.over_qty).toBe(40);
    expect(body.order_status).toBe("PARTIALLY_CLOSED");

    const dc = await db().prepare("SELECT id, status, zoho_dc_id FROM delivery_challans WHERE zoho_dc_id='z1'").first() as any;
    expect(dc).toBeTruthy();
    expect(dc.status).toBe("DELIVERED");
    const n = await db().prepare("SELECT COUNT(*) c FROM dc_items WHERE dc_id=?").bind(dc.id).first() as any;
    expect(n.c).toBe(2);

    const again = await (await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z1", confirm: true }, saTok)).json() as any;
    expect(again.deduped).toBe(true);
    const cnt = await db().prepare("SELECT COUNT(*) c FROM delivery_challans WHERE zoho_dc_id='z1'").first() as any;
    expect(cnt.c).toBe(1); // no second copy
  });

  it("refuses a DC whose number already exists in SmartPantry (409)", async () => {
    expect((await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z2", confirm: true }, saTok)).status).toBe(409);
  });

  it("refuses a client-name mismatch (422)", async () => {
    expect((await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z3", confirm: true }, saTok)).status).toBe(422);
  });

  it("closes the order when the import fully settles it", async () => {
    const body = await (await post("/api/orders/OZ2/zoho-dc-import/commit", { zoho_dc_id: "z5", confirm: true }, saTok)).json() as any;
    expect(body.order_status).toBe("CLOSED");
    expect(body.closed).toBe(true);
  });
});

describe("Zoho DC import — bulk worklist", () => {
  it("rejects a non-super-admin", async () => {
    expect((await get("/api/zoho-dc-worklist", cliTok)).status).toBe(403);
  });
  it("lists unlinked client-matched DCs, excluding linked and mismatched ones", async () => {
    // Storage is isolated per test, so link z1 here, then it must drop off the worklist.
    await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z1", confirm: true }, saTok);
    const r = await (await get("/api/zoho-dc-worklist", saTok)).json() as any;
    const ids = (r.rows || []).map((x: any) => x.zoho_dc_id);
    expect(ids).toContain("z2");
    expect(ids).not.toContain("z1"); // just linked → excluded
    expect(ids).not.toContain("z3"); // client name mismatch → excluded
    const z2 = r.rows.find((x: any) => x.zoho_dc_id === "z2");
    expect(z2.matched_client_name).toBe("Zoho Client");
    expect(z2.already_in_smartpantry).toBe(true);
    expect(z2.suggested_order_id).toBeTruthy(); // an open order exists for the client
  });
});

describe("Zoho DC import — location resolution (P2b)", () => {
  it("resolves the ship-to location by Zoho address id and tags the DC + order", async () => {
    const d = db();
    for (const sql of [
      "ALTER TABLE zoho_delivery_challans ADD COLUMN ship_address TEXT",
      "ALTER TABLE zoho_delivery_challans ADD COLUMN ship_address_id TEXT",
      "ALTER TABLE orders ADD COLUMN location_id TEXT",
      "ALTER TABLE delivery_challans ADD COLUMN location_id TEXT",
    ]) await d.prepare(sql).run().catch(() => {});
    await d.prepare("CREATE TABLE IF NOT EXISTS client_locations ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, display_name TEXT NOT NULL, shipping_address TEXT, contact_name TEXT, contact_phone TEXT, zoho_address_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();
    await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,zoho_address_id,is_default,active) VALUES ('loc-m','cZ','ServiceNow · Manyata','Manyata','addr-m',1,1)").run();
    await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,zoho_address_id,is_default,active) VALUES ('loc-b','cZ','ServiceNow · Bagmane','Bagmane','addr-b',0,1)").run();
    await d.prepare("UPDATE zoho_delivery_challans SET ship_address='Bagmane', ship_address_id='addr-b' WHERE zoho_dc_id='z1'").run();

    const r = await (await post("/api/orders/OZ/zoho-dc-import/commit", { zoho_dc_id: "z1", confirm: true }, saTok)).json() as any;
    expect(r.location.id).toBe("loc-b"); // not the default (loc-m)
    const dc = await d.prepare("SELECT location_id FROM delivery_challans WHERE zoho_dc_id='z1'").first() as any;
    expect(dc.location_id).toBe("loc-b");
    const ord = await d.prepare("SELECT location_id FROM orders WHERE id='OZ'").first() as any;
    expect(ord.location_id).toBe("loc-b");
  });
});

describe("Zoho DC import — per-line settlement", () => {
  it("keeps the order PARTIALLY_CLOSED when an over-delivery on one SKU leaves another due", async () => {
    // OZ3 ordered A60 + C100; z6 delivers A160 (over). Order-total would read settled
    // (160 ≥ 160), but C is still due, so per-line settlement must NOT close it.
    const body = await (await post("/api/orders/OZ3/zoho-dc-import/commit", { zoho_dc_id: "z6", confirm: true }, saTok)).json() as any;
    expect(body.order_status).toBe("PARTIALLY_CLOSED");
    expect(body.closed).toBe(false);
  });
});
