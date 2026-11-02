// Integration tests for the post-delivery ordered-quantity adjustment
// (POST /api/orders/:id/adjust-quantity) — correcting the ordered qty on an
// in-fulfilment order (which the normal pre-dispatch amend refuses), e.g. to
// align an order to an accepted over-delivery. Covers the happy path (qty +
// totals + amendment record, order stays CLOSED), the reason/role/stage guards,
// and the downward move back to PARTIALLY_CLOSED.
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
const adjust = (id: string, body: unknown, tok: string) => post(`/api/orders/${id}/adjust-quantity`, body, tok);

let opsTok: string, clientTok: string;

// Fresh order + DELIVERED challan 705641, seeded per test (rolled back after).
async function seed(opts: { ordered?: number; delivered?: number; orderStatus?: string } = {}) {
  const ordered = opts.ordered ?? 200, delivered = opts.delivered ?? 288, dispatched = 288;
  const d = db();
  await d.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,reserved,gst_rate) VALUES ('YB-PROT','Yogabar Protein Bar','Snacks',100,1000,0,18)").run();
  await d.prepare("INSERT OR REPLACE INTO orders (id,client_id,status,created_by,subtotal,gst,grand_total,revision,closed_at,created_at) VALUES ('O1','c1',?, 'u-ops', ?, ?, ?, 1, datetime('now'), datetime('now'))")
    .bind(opts.orderStatus ?? "CLOSED", ordered * 100, ordered * 18, ordered * 118).run();
  await d.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('oi1','O1','YB-PROT','Yogabar Protein Bar',?,100,?)").bind(ordered, ordered * 100).run();
  await d.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,delivered_qty,delivered_at) VALUES ('dc1','O1','DELIVERED','705641',?, datetime('now'))").bind(delivered).run();
  await d.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('di1','dc1','YB-PROT','Yogabar Protein Bar',?,?)").bind(dispatched, delivered).run();
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
  await seed();
});

describe("post-delivery ordered-qty adjustment", () => {
  it("aligns ordered 200→288 to the delivered qty, re-prices, keeps the order CLOSED, records an amendment", async () => {
    const res = await adjust("O1", { items: [{ sku: "YB-PROT", qty: 288 }], reason: "client accepted over-delivery" }, opsTok);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(body.applied[0]).toMatchObject({ sku: "YB-PROT", old: 200, new: 288 });
    expect(body.status).toBe("CLOSED");
    expect(body.revision).toBe(2);

    const oi = await db().prepare("SELECT qty,total FROM order_items WHERE id='oi1'").first() as any;
    expect(oi.qty).toBe(288);
    expect(oi.total).toBe(28800); // 288 * 100
    const ord = await db().prepare("SELECT status,subtotal,grand_total FROM orders WHERE id='O1'").first() as any;
    expect(ord.status).toBe("CLOSED");
    expect(ord.subtotal).toBe(28800);
    expect(ord.grand_total).toBeGreaterThan(28800); // subtotal + GST
    const am = await db().prepare("SELECT COUNT(*) c FROM order_amendments WHERE order_id='O1'").first() as any;
    expect(am.c).toBe(1);
  });

  it("requires a written reason", async () => {
    const res = await adjust("O1", { items: [{ sku: "YB-PROT", qty: 288 }] }, opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("REASON_REQUIRED");
  });

  it("is blocked for a client role", async () => {
    const res = await adjust("O1", { items: [{ sku: "YB-PROT", qty: 288 }], reason: "x" }, clientTok);
    expect(res.status).toBe(403);
  });

  it("refuses a pre-dispatch order (points to Amend instead)", async () => {
    await db().prepare("UPDATE orders SET status='APPROVED' WHERE id='O1'").run();
    const res = await adjust("O1", { items: [{ sku: "YB-PROT", qty: 288 }], reason: "x" }, opsTok);
    expect(res.status).toBe(400);
    expect((await res.json() as any).code).toBe("USE_AMEND");
  });

  it("raising ordered above delivered re-opens CLOSED → PARTIALLY_CLOSED and clears closed_at", async () => {
    await seed({ ordered: 200, delivered: 200, orderStatus: "CLOSED" }); // fully delivered at 200
    const res = await adjust("O1", { items: [{ sku: "YB-PROT", qty: 300 }], reason: "line under-ordered" }, opsTok);
    expect(res.status).toBe(200);
    expect((await res.json() as any).status).toBe("PARTIALLY_CLOSED");
    const ord = await db().prepare("SELECT status,closed_at FROM orders WHERE id='O1'").first() as any;
    expect(ord.status).toBe("PARTIALLY_CLOSED");
    expect(ord.closed_at).toBeNull();
  });
});
