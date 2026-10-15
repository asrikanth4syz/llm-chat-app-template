// Integration tests for Quotations send + customer document + lifecycle
// (milestone 006, Slice 5): APPROVED → SENT generates a redacted, hash-stamped
// customer document; GET /document returns it; accept/lost transitions; the
// document carries no cost/margin and its stored hash matches the stamped body.
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
const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

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
  await mk("tst-dadmin", "dadmin@sp.test", "super_admin");
  await mk("tst-dsales", "dsales@sp.test", "procurement_manager");
  await mk("tst-dmgr", "dmgr@sp.test", "warehouse_exec");
  await mk("tst-dfin", "dfin@sp.test", "delivery_exec");
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await get("/api/quotes"); // warm schema into the per-test baseline
  adminTok = await login("dadmin@sp.test", "pw123");
  salesTok = await login("dsales@sp.test", "pw123");
  mgrTok = await login("dmgr@sp.test", "pw123");
  finTok = await login("dfin@sp.test", "pw123");
});

async function prep() {
  await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dsales", quoteRole: "sales", _ver: 0 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dmgr", quoteRole: "commercial_manager", _ver: 1 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dfin", quoteRole: "finance", _ver: 2 }, adminTok);
}
const createAs = async (tok: string, itc = true) => (await (await post("/api/quotes", CREATE(itc), tok)).json() as any).id as string;
async function approvedQuote(): Promise<string> {
  const id = await createAs(salesTok);                 // ITC=yes → manager leg only
  await post(`/api/quotes/${id}/submit`, {}, salesTok);
  await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
  return id;
}

describe("send + customer document (Slice 5)", () => {
  it("APPROVED → SENT: stamps sent_at + default valid_until, document hash matches stored + stamped body", async () => {
    await prep();
    const id = await approvedQuote();
    const sent = await post(`/api/quotes/${id}/send`, {}, salesTok);
    expect(sent.status).toBe(200);
    const sb = await sent.json() as any;
    expect(sb.status).toBe("SENT");
    expect(sb.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // default validity = 30 days after sent_at
    const expUntil = new Date(Date.parse(sb.sent_at + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
    expect(sb.valid_until).toBe(expUntil);
    expect(sb.document_hash).toMatch(/^[0-9a-f]{64}$/);

    const doc = await get(`/api/quotes/${id}/document`, salesTok);
    expect(doc.status).toBe(200);
    const d = await doc.json() as any;
    expect(d.content_hash).toBe(sb.document_hash);
    const html = b64decode(d.content_b64);
    // the hash is stamped into the body (placeholder resolved) and matches the stored hash
    expect(html).toContain(sb.document_hash);
    expect(html).not.toContain("__QUOTE_DOC_HASH__");
    // redacted: no cost / margin / ITC leakage to the customer document
    expect(html.toLowerCase()).not.toContain("margin");
    expect(html.toLowerCase()).not.toContain("landed");
    expect(html.toLowerCase()).not.toContain("purchase_cost");
    expect(html).toContain("Grand total");
  });

  it("send is 409 unless APPROVED", async () => {
    await prep();
    const id = await createAs(salesTok);               // still DRAFT
    expect((await post(`/api/quotes/${id}/send`, {}, salesTok)).status).toBe(409);
  });

  it("document is 404 before the quote is sent", async () => {
    await prep();
    const id = await approvedQuote();
    const r = await get(`/api/quotes/${id}/document`, salesTok);
    expect(r.status).toBe(404);
    expect((await r.json() as any).code).toBe("E_NO_DOCUMENT");
  });

  it("SENT → ACCEPTED", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const acc = await post(`/api/quotes/${id}/accept`, {}, salesTok);
    expect(acc.status).toBe(200);
    expect((await acc.json() as any).status).toBe("ACCEPTED");
    expect((await (await get(`/api/quotes/${id}`, salesTok)).json() as any).status).toBe("ACCEPTED");
  });

  it("lost requires a reason (422) then marks LOST and records it", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/lost`, {}, salesTok)).status).toBe(422);
    const lost = await post(`/api/quotes/${id}/lost`, { reason: "chose a competitor" }, salesTok);
    expect(lost.status).toBe(200);
    const lb = await lost.json() as any;
    expect(lb.status).toBe("LOST");
    expect(lb.lost_reason).toBe("chose a competitor");
  });

  it("accept is 409 when not SENT; finance role cannot send (no send capability → 403)", async () => {
    await prep();
    const id = await approvedQuote();
    expect((await post(`/api/quotes/${id}/accept`, {}, salesTok)).status).toBe(409); // still APPROVED
    expect((await post(`/api/quotes/${id}/send`, {}, finTok)).status).toBe(403);      // finance can't send
  });
});
