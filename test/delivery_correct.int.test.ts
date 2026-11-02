// Integration tests for the delivered-quantity correction endpoint
// (POST /api/delivery-challans/:id/correct) — the audited data-fix tool for a
// mis-keyed delivered qty on a DELIVERED challan. Covers the happy path (qty +
// stock + client inventory + audit + order close), the dispatched/ordered caps,
// the mandatory reason, the role gate, the delivered-only guard, and the
// downward re-open of a CLOSED order.
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
const correct = (dcId: string, body: unknown, tok: string) => post(`/api/delivery-challans/${dcId}/correct`, body, tok);

let opsTok: string, clientTok: string;

// Seed a fresh order + a DELIVERED challan 705641 with one line, per test.
async function seed(opts: { ordered?: number; dispatched?: number; delivered?: number; status?: string; orderStatus?: string } = {}) {
  const ordered = opts.ordered ?? 288, dispatched = opts.dispatched ?? 288, delivered = opts.delivered ?? 200;
  const d = db();
  await d.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,reserved) VALUES ('YB-PROT','Yogabar Protein Bar','Snacks',100,1000,500)").run();
  await d.prepare("INSERT OR REPLACE INTO orders (id,client_id,status,created_by,created_at) VALUES ('O1','c1',?, 'u-ops', datetime('now'))").bind(opts.orderStatus ?? "IN_SHIPMENT").run();
  await d.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('oi1','O1','YB-PROT','Yogabar Protein Bar',?,100,?)").bind(ordered, ordered * 100).run();
  await d.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,delivered_qty,delivered_at) VALUES ('dc1','O1',?, '705641',?, datetime('now'))").bind(opts.status ?? "DELIVERED", delivered).run();
  await d.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('di1','dc1','YB-PROT','Yogabar Protein Bar',?,?)").bind(dispatched, delivered).run();
  await d.prepare("INSERT OR REPLACE INTO client_inventory (client_id,sku,item_name,qty_on_hand) VALUES ('c1','YB-PROT','Yogabar Protein Bar',?)").bind(delivered).run();
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
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops','ops@sp.test','SEED:pw123','super_admin','Ops','SP','OP',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli','cli@sp.test','SEED:pw123','client_admin','Cli','SP','CL',1,'c1')").run();
  opsTok = await login("ops@sp.test", "pw123");
  clientTok = await login("cli@sp.test", "pw123");
  await seed(); // baseline order + DELIVERED challan 705641; each test rolls back to it
});

describe("delivered-qty correction — happy path", () => {
  it("corrects 200→288, moves stock & client inventory, logs it, closes the order", async () => {
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 288 }], reason: "mis-keyed at confirmation" }, opsTok);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.applied[0]).toMatchObject({ sku: "YB-PROT", old: 200, new: 288, delta: 88 });
    expect(body.order_status).toBe("CLOSED");

    const di = await db().prepare("SELECT qty_delivered FROM dc_items WHERE id='di1'").first() as any;
    expect(di.qty_delivered).toBe(288);
    const inv = await db().prepare("SELECT stock,reserved FROM inventory WHERE sku='YB-PROT'").first() as any;
    expect(inv.stock).toBe(912);    // 1000 - 88
    expect(inv.reserved).toBe(412); // 500 - 88
    const ci = await db().prepare("SELECT qty_on_hand FROM client_inventory WHERE client_id='c1' AND sku='YB-PROT'").first() as any;
    expect(ci.qty_on_hand).toBe(288);
    const mv = await db().prepare("SELECT type,qty_change FROM stock_movements WHERE reference_id='dc1' AND type='DELIVERY_CORRECTION'").first() as any;
    expect(mv).toBeTruthy();
    expect(mv.qty_change).toBe(-88);
    const ord = await db().prepare("SELECT status FROM orders WHERE id='O1'").first() as any;
    expect(ord.status).toBe("CLOSED");
  });
});

describe("delivered-qty correction — guards", () => {
  it("rejects a qty above what was dispatched on the challan", async () => {
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 300 }], reason: "x" }, opsTok); // dispatched 288
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("EXCEEDS_DISPATCHED");
  });

  it("allows an over-delivery beyond ordered, as long as it is within dispatched", async () => {
    await db().prepare("UPDATE order_items SET qty=200 WHERE id='oi1'").run(); // ordered 200, dispatched 288
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 288 }], reason: "over-delivery accepted by client" }, opsTok);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.applied[0]).toMatchObject({ old: 200, new: 288, delta: 88 });
    const di = await db().prepare("SELECT qty_delivered FROM dc_items WHERE id='di1'").first() as any;
    expect(di.qty_delivered).toBe(288); // recorded in full even though ordered was 200
  });

  it("requires a written reason", async () => {
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 288 }] }, opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("REASON_REQUIRED");
  });

  it("is blocked for a client role", async () => {
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 288 }], reason: "x" }, clientTok);
    expect(res.status).toBe(403);
  });

  it("only applies to a DELIVERED challan", async () => {
    await db().prepare("UPDATE delivery_challans SET status='DISPATCHED' WHERE id='dc1'").run();
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 288 }], reason: "x" }, opsTok);
    expect(res.status).toBe(409);
    expect((await res.json() as any).code).toBe("NOT_DELIVERED");
  });
});

describe("delivered-qty correction — downward re-opens a closed order", () => {
  it("lowering delivered below ordered moves CLOSED → PARTIALLY_CLOSED and clears closed_at", async () => {
    await seed({ delivered: 288, orderStatus: "CLOSED" });
    await db().prepare("UPDATE orders SET closed_at=datetime('now') WHERE id='O1'").run();
    const res = await correct("dc1", { items: [{ sku: "YB-PROT", qty_delivered: 200 }], reason: "over-counted" }, opsTok);
    expect(res.status).toBe(200);
    expect((await res.json() as any).order_status).toBe("PARTIALLY_CLOSED");
    const ord = await db().prepare("SELECT status,closed_at FROM orders WHERE id='O1'").first() as any;
    expect(ord.status).toBe("PARTIALLY_CLOSED");
    expect(ord.closed_at).toBeNull();
    const inv = await db().prepare("SELECT stock FROM inventory WHERE sku='YB-PROT'").first() as any;
    expect(inv.stock).toBe(1088); // 1000 - (200-288) = 1000 + 88 back
  });
});
