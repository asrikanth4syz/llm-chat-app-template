// Integration tests for the Zoho Delivery Challans finance register:
//   GET  /api/integrations/zoho-inventory/delivery-challans        (read + filters)
//   POST /api/integrations/zoho-inventory/delivery-challans/sync    (gating + not_configured)
// The live Zoho pull is exercised via the mirror table (seeded here); CI has no
// live Zoho, so the sync endpoint is asserted on its auth gate and not_configured
// path. Covers role gating (finance/ops/super may read; clients may not), the
// customer / month / search filters, and JSON invoice-number round-tripping.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, password: string): Promise<string> {
  return (await (await post("/api/auth/login", { email, password })).json() as { token: string }).token;
}
const db = () => env.DB as D1Database;
const LIST = "/api/integrations/zoho-inventory/delivery-challans";

let superTok: string, finTok: string, cliTok: string;

async function seedDC(row: {
  id: string; number: string; date: string; ym: string; custId: string; custName: string;
  lines: number; qty: number; status: string; invoices: string[]; total: number;
}) {
  await db().prepare(
    `INSERT OR REPLACE INTO zoho_delivery_challans
       (zoho_dc_id,dc_number,dc_date,ym,customer_id,customer_name,line_count,qty_count,invoiced_status,invoice_numbers,total,currency_code,zoho_modified,synced_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(row.id, row.number, row.date, row.ym, row.custId, row.custName, row.lines, row.qty,
    row.status, JSON.stringify(row.invoices), row.total, "INR", row.date + "T00:00:00Z", "2026-11-12T09:14:00Z").run();
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
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cA','LinkedIn India','a@y.z',1)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-sup','sup@sp.test','SEED:pw123','super_admin','Sup','SP','SU',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-fin','fin@sp.test','SEED:pw123','finance_admin','Fin','SP','FN',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli','cli@sp.test','SEED:pw123','client_admin','Cli','SP','CL',1,'cA')").run();
  superTok = await login("sup@sp.test", "pw123");
  finTok = await login("fin@sp.test", "pw123");
  cliTok = await login("cli@sp.test", "pw123");

  await seedDC({ id: "z1", number: "DC-00051", date: "2026-11-10", ym: "2026-11", custId: "cust-li", custName: "LinkedIn India", lines: 6, qty: 1240, status: "invoiced", invoices: ["INV-002841"], total: 290120 });
  await seedDC({ id: "z2", number: "DC-00050", date: "2026-11-08", ym: "2026-11", custId: "cust-li", custName: "LinkedIn India", lines: 9, qty: 25362, status: "not_invoiced", invoices: [], total: 639680 });
  await seedDC({ id: "z3", number: "DC-00049", date: "2026-11-06", ym: "2026-11", custId: "cust-meta", custName: "Meta India", lines: 4, qty: 4200, status: "partially_invoiced", invoices: ["INV-002838"], total: 214500 });
  await seedDC({ id: "z4", number: "DC-00044", date: "2026-10-15", ym: "2026-10", custId: "cust-meta", custName: "Meta India", lines: 8, qty: 6100, status: "invoiced", invoices: ["INV-002818", "INV-002822"], total: 310000 });
});

describe("Zoho Delivery Challans register", () => {
  it("requires authentication", async () => {
    expect((await get(LIST)).status).toBe(401);
  });

  it("forbids client roles from reading", async () => {
    expect((await get(LIST, cliTok)).status).toBe(403);
  });

  it("returns all rows with parsed invoice numbers, customers and months", async () => {
    const res = await get(LIST, finTok);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.rows.length).toBe(4);
    const z4 = body.rows.find((r: any) => r.dc_number === "DC-00044");
    expect(Array.isArray(z4.invoice_numbers)).toBe(true);
    expect(z4.invoice_numbers).toEqual(["INV-002818", "INV-002822"]);
    // Distinct customer + month lists feed the dropdowns.
    expect(body.customers.map((c: any) => c.name).sort()).toEqual(["LinkedIn India", "Meta India"]);
    expect(body.months).toEqual(["2026-11", "2026-10"]);
    expect(body).toHaveProperty("last_synced");
    expect(body).toHaveProperty("configured");
  });

  it("filters by customer", async () => {
    const body = await (await get(`${LIST}?customer=cust-meta`, superTok)).json() as any;
    expect(body.rows.length).toBe(2);
    expect(body.rows.every((r: any) => r.customer_name === "Meta India")).toBe(true);
  });

  it("filters by month", async () => {
    const body = await (await get(`${LIST}?month=2026-10`, superTok)).json() as any;
    expect(body.rows.length).toBe(1);
    expect(body.rows[0].dc_number).toBe("DC-00044");
  });

  it("searches by invoice number", async () => {
    const body = await (await get(`${LIST}?q=INV-002841`, finTok)).json() as any;
    expect(body.rows.length).toBe(1);
    expect(body.rows[0].dc_number).toBe("DC-00051");
  });

  it("forbids client roles from syncing", async () => {
    expect((await post(`${LIST}/sync`, {}, cliTok)).status).toBe(403);
  });

  it("reports not_configured when Zoho secrets are absent", async () => {
    const body = await (await post(`${LIST}/sync`, {}, superTok)).json() as any;
    expect(body.status).toBe("not_configured");
    expect(Array.isArray(body.missing_secrets)).toBe(true);
    expect(body.missing_secrets.length).toBeGreaterThan(0);
  });
});
