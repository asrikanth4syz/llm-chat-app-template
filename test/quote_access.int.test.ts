// Integration tests for the Quotations entitlement gate (milestone 006, Slice 2).
// Exercises the wired Worker routes end-to-end over D1: the admin allowlist PUT,
// the exempt /access endpoint, the guarded /calc route, redaction for the ops
// quote-role, and the admin guards. Storage is isolated per-test (vitest-pool-
// workers), so each test grants + acts within itself.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (token?: string) => ({ "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, password: string): Promise<string> {
  const res = await post("/api/auth/login", { email, password });
  const data = await res.json() as { token: string };
  return data.token;
}

let adminTok: string, salesTok: string, opsTok: string, noneTok: string;

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
  const mk = (id: string, email: string, role: string, name: string) =>
    db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id, email, "SEED:pw123", role, name, "SmartPantry", "XX").run();
  await mk("tst-qadmin", "qadmin@sp.test", "super_admin", "Q Admin");
  await mk("tst-qsales", "qsales@sp.test", "procurement_manager", "Q Sales");
  await mk("tst-qops", "qops@sp.test", "warehouse_exec", "Q Ops");
  await mk("tst-qnone", "qnone@sp.test", "delivery_exec", "Q None");
  adminTok = await login("qadmin@sp.test", "pw123");
  salesTok = await login("qsales@sp.test", "pw123");
  opsTok = await login("qops@sp.test", "pw123");
  noneTok = await login("qnone@sp.test", "pw123");
});

const grant = (userId: string, quoteRole: string | null, ver: number, tok = adminTok) =>
  put("/api/admin/quote-access", { userId, quoteRole, _ver: ver }, tok);
const setSellerState = (code: string, ver = 0) =>
  put("/api/admin/quote-settings", { _ver: ver, seller_state_code: code }, adminTok);

const CALC_BODY = {
  place_of_supply: "KL",
  lines: [{ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: true }],
};

describe("quote entitlement gate — admin + /access", () => {
  it("admin GET lists candidate users with empty allowlist + _ver 0", async () => {
    const res = await get("/api/admin/quote-access", adminTok);
    expect(res.status).toBe(200);
    const b = await res.json() as any;
    expect(b._ver).toBe(0);
    expect(b.enabled).toEqual({});
    expect(b.users.some((u: any) => u.id === "tst-qsales")).toBe(true);
  });

  it("non-admin cannot read admin access (403)", async () => {
    expect((await get("/api/admin/quote-access", salesTok)).status).toBe(403);
  });

  it("unauthenticated /access is 401; entitled/non-entitled resolve correctly", async () => {
    expect((await get("/api/quotes/access")).status).toBe(401);
    expect(await (await get("/api/quotes/access", noneTok)).json()).toEqual({ enabled: false, quoteRole: null });
    const g = await grant("tst-qsales", "sales", 0);
    expect(g.status).toBe(200);
    expect((await g.json() as any)._ver).toBe(1);
    expect(await (await get("/api/quotes/access", salesTok)).json()).toEqual({ enabled: true, quoteRole: "sales" });
  });

  it("stale _ver → 409; invalid role → 422; self-grant of approver role → 403", async () => {
    await grant("tst-qsales", "sales", 0);
    expect((await grant("tst-qsales", "finance", 0)).status).toBe(409);         // stale _ver (now 1)
    expect((await grant("tst-qsales", "boss", 1)).status).toBe(422);            // invalid role
    expect((await grant("tst-qadmin", "finance", 1)).status).toBe(403);         // admin grants self an approver role
    expect((await grant("tst-qadmin", "sales", 1)).status).toBe(200);           // non-approver self-grant ok
  });
});

describe("quote entitlement gate — guarded /calc", () => {
  it("entitled sales user gets a full calc; non-entitled user is 404-hidden", async () => {
    await setSellerState("KL");
    await grant("tst-qsales", "sales", 0);
    const ok = await post("/api/quotes/calc", CALC_BODY, salesTok);
    expect(ok.status).toBe(200);
    const b = await ok.json() as any;
    expect(b.totals.grand_total_paise).toBe(14200);        // 12000 + 18% GST 2160, round-to-rupee
    expect(b.lines[0].landed_cost_paise).toBe(10000);       // sales sees cost
    expect((await post("/api/quotes/calc", CALC_BODY, noneTok)).status).toBe(404);
  });

  it("ops quote-role calc is redacted (no cost/margin fields)", async () => {
    await setSellerState("KL");
    await grant("tst-qops", "ops", 0);
    const res = await post("/api/quotes/calc", CALC_BODY, opsTok);
    expect(res.status).toBe(200);
    const b = await res.json() as any;
    expect(b.lines[0].unit_price_paise).toBe(12000);        // price visible
    expect(b.lines[0].landed_cost_paise).toBeUndefined();   // cost hidden
    expect(b.lines[0].line_margin_paise).toBeUndefined();   // margin hidden
    expect(b.totals.weighted_margin_bp).toBeUndefined();
    expect(b.totals.grand_total_paise).toBe(14200);
  });

  it("calc with no seller_state_code configured → 422 E_SELLER_STATE_UNSET", async () => {
    await grant("tst-qsales", "sales", 0);
    const res = await post("/api/quotes/calc", CALC_BODY, salesTok);
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe("E_SELLER_STATE_UNSET");
  });

  it("calc validation error surfaces as 422 (bad GST slab)", async () => {
    await setSellerState("KL");
    await grant("tst-qsales", "sales", 0);
    const bad = { ...CALC_BODY, lines: [{ ...CALC_BODY.lines[0], sale_gst_bp: 300 }] };
    const res = await post("/api/quotes/calc", bad, salesTok);
    expect(res.status).toBe(422);
    expect((await res.json() as any).code).toBe("E_UNSUPPORTED_GST_SLAB");
  });
});

describe("quote settings — fallback + validation", () => {
  it("PUT settings rejects a fallback that is not an entitled approver (422)", async () => {
    const res = await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL", fallback_approver_id: "tst-qsales" }, adminTok);
    expect(res.status).toBe(422); // tst-qsales not entitled as an approver role
  });
  it("PUT settings accepts a fallback that holds an approver role", async () => {
    await grant("tst-qops", "finance", 0); // make tst-qops a finance approver
    const res = await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL", fallback_approver_id: "tst-qops" }, adminTok);
    expect(res.status).toBe(200);
  });
});
