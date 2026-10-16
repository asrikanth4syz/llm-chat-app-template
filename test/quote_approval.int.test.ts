// Integration tests for Quotations approvals / SoD (milestone 006, Slice 4):
// submit routing, Manager-auto-satisfy → direct APPROVED, two-leg (ITC=No)
// approve by distinct users, wrong-leg 403, reject → DRAFT, sole-approver 409.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, pw: string) { return (await (await post("/api/auth/login", { email, password: pw })).json() as any).token as string; }

let adminTok: string, salesTok: string, mgrTok: string, finTok: string;

const line = (itc: boolean) => ({ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: itc });
const CREATE = (itc = true) => ({ client_id: "c1", place_of_supply: "KL", lines: [line(itc)] });

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
  const mk = (id: string, email: string, role: string) =>
    db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id, email, "SEED:pw123", role, id, "SmartPantry", "XX").run();
  await mk("tst-aadmin", "aadmin@sp.test", "super_admin");
  await mk("tst-asales", "asales@sp.test", "procurement_manager");
  await mk("tst-amgr", "amgr@sp.test", "warehouse_exec");
  await mk("tst-afin", "afin@sp.test", "delivery_exec");
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await get("/api/quotes"); // warm schema into the per-test baseline
  adminTok = await login("aadmin@sp.test", "pw123");
  salesTok = await login("asales@sp.test", "pw123");
  mgrTok = await login("amgr@sp.test", "pw123");
  finTok = await login("afin@sp.test", "pw123");
});

// Grant the three quote-roles + seller state (config rolls back per test).
async function prep() {
  await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-asales", quoteRole: "sales", _ver: 0 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-amgr", quoteRole: "commercial_manager", _ver: 1 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-afin", quoteRole: "finance", _ver: 2 }, adminTok);
}
const createAs = async (tok: string, itc = true) => (await (await post("/api/quotes", CREATE(itc), tok)).json() as any).id as string;

describe("approvals — super_admin override", () => {
  it("super_admin submit auto-approves every leg even with no eligible finance approver", async () => {
    await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
    // No quote-roles granted → a normal author would hit 409 on the finance leg.
    const id = await createAs(adminTok, false);   // super_admin authors; ITC=No → finance leg required
    const sub = await post(`/api/quotes/${id}/submit`, {}, adminTok);
    expect(sub.status).toBe(200);
    const b = await sub.json() as any;
    expect(b.status).toBe("APPROVED");
    expect(b.legs.every((l: any) => l.status === "AUTO_SATISFIED")).toBe(true);
  });
});

describe("approvals — manager leg", () => {
  it("sales authors → submit needs the manager leg; a distinct manager approves → APPROVED", async () => {
    await prep();
    const id = await createAs(salesTok);
    const sub = await post(`/api/quotes/${id}/submit`, {}, salesTok);
    expect(sub.status).toBe(200);
    const sb = await sub.json() as any;
    expect(sb.status).toBe("PENDING_APPROVAL");
    expect(sb.legs).toEqual([{ leg: "manager", status: "PENDING", assigned_to: "tst-amgr", assigned_as_fallback: false }]);
    const ap = await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
    expect(ap.status).toBe(200);
    expect((await ap.json() as any).quote_status).toBe("APPROVED");
  });

  it("manager authors → manager leg auto-satisfies → submit lands directly in APPROVED", async () => {
    await prep();
    const id = await createAs(mgrTok);           // commercial_manager can author
    const sub = await post(`/api/quotes/${id}/submit`, {}, mgrTok);
    const sb = await sub.json() as any;
    expect(sb.status).toBe("APPROVED");
    expect(sb.legs[0]).toMatchObject({ leg: "manager", status: "AUTO_SATISFIED", assigned_to: "tst-amgr" });
  });

  it("sole-approver: no manager enabled → submit 409 E_NO_ELIGIBLE_APPROVER (manager)", async () => {
    await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
    await put("/api/admin/quote-access", { userId: "tst-asales", quoteRole: "sales", _ver: 0 }, adminTok);
    const id = await createAs(salesTok);
    const sub = await post(`/api/quotes/${id}/submit`, {}, salesTok);
    expect(sub.status).toBe(409);
    const b = await sub.json() as any;
    expect(b.code).toBe("E_NO_ELIGIBLE_APPROVER");
    expect(b.leg).toBe("manager");
  });
});

describe("approvals — finance leg (ITC=No)", () => {
  it("two legs: manager + finance approved by distinct users → APPROVED; wrong-leg is 403", async () => {
    await prep();
    const id = await createAs(salesTok, false);   // ITC=No → finance leg required
    const sb = await (await post(`/api/quotes/${id}/submit`, {}, salesTok)).json() as any;
    expect(sb.status).toBe("PENDING_APPROVAL");
    expect(sb.legs.map((l: any) => l.leg).sort()).toEqual(["finance", "manager"]);
    // manager cannot act on the finance leg (role mismatch) → 403
    expect((await post(`/api/quotes/${id}/approve`, { leg: "finance" }, mgrTok)).status).toBe(403);
    expect((await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok)).status).toBe(200);
    // still pending finance
    expect((await (await get(`/api/quotes/${id}`, salesTok)).json() as any).status).toBe("PENDING_APPROVAL");
    const fin = await post(`/api/quotes/${id}/approve`, { leg: "finance" }, finTok);
    expect((await fin.json() as any).quote_status).toBe("APPROVED");
  });

  it("reject (with comments) sends it back to DRAFT and supersedes rows; no-comments → 422", async () => {
    await prep();
    const id = await createAs(salesTok, false);
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/reject`, { leg: "finance" }, finTok)).status).toBe(422); // comments required
    const rej = await post(`/api/quotes/${id}/reject`, { leg: "finance", comments: "margin too thin" }, finTok);
    expect(rej.status).toBe(200);
    expect((await rej.json() as any).status).toBe("DRAFT");
    const d = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(d.status).toBe("DRAFT");
    // superseded rows no longer count — resubmit creates a fresh set
    expect((await post(`/api/quotes/${id}/submit`, {}, salesTok)).status).toBe(200);
  });

  it("cannot approve a quote that is not PENDING_APPROVAL (409)", async () => {
    await prep();
    const id = await createAs(salesTok);
    expect((await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok)).status).toBe(409); // still DRAFT
  });

  it("reject → resubmit → re-approve both legs reaches APPROVED (superseded rows don't block)", async () => {
    await prep();
    const id = await createAs(salesTok, false);                 // ITC=No → both legs
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok); // one leg approved
    await post(`/api/quotes/${id}/reject`, { leg: "finance", comments: "redo" }, finTok); // back to DRAFT, all superseded
    await post(`/api/quotes/${id}/submit`, {}, salesTok);       // fresh PENDING legs
    expect((await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok)).status).toBe(200);
    const fin = await post(`/api/quotes/${id}/approve`, { leg: "finance" }, finTok);
    expect((await fin.json() as any).quote_status).toBe("APPROVED");
  });
});
