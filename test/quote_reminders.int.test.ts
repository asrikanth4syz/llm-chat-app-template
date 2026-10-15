// Integration + cron tests for Quotations reminders / follow-ups / Today / bell
// (milestone 006, Slice 6): send seeds the 3-step cadence inside the open
// (sent, valid) window; snooze only from PENDING and never onto/after expiry;
// follow-ups feed Today + bell; the cron fires due reminders then sweeps
// SENT→EXPIRED (frozen clock).
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
import { runQuoteReminderPass, quoteReminderSeeds } from "../src/index";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, pw: string) { return (await (await post("/api/auth/login", { email, password: pw })).json() as any).token as string; }
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const istTodayStr = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

let adminTok: string, salesTok: string, mgrTok: string, finTok: string;

const line = (itc: boolean) => ({ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: itc });
const CREATE = (itc = true, valid_until?: string) => ({ client_id: "c1", place_of_supply: "KL", valid_until, lines: [line(itc)] });

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
  await mk("tst-radmin", "radmin@sp.test", "super_admin");
  await mk("tst-rsales", "rsales@sp.test", "procurement_manager");
  await mk("tst-rmgr", "rmgr@sp.test", "warehouse_exec");
  await mk("tst-rfin", "rfin@sp.test", "delivery_exec");
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await get("/api/quotes"); // warm schema into the per-test baseline
  adminTok = await login("radmin@sp.test", "pw123");
  salesTok = await login("rsales@sp.test", "pw123");
  mgrTok = await login("rmgr@sp.test", "pw123");
  finTok = await login("rfin@sp.test", "pw123");
});

async function prep() {
  await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-rsales", quoteRole: "sales", _ver: 0 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-rmgr", quoteRole: "commercial_manager", _ver: 1 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-rfin", quoteRole: "finance", _ver: 2 }, adminTok);
}
const createAs = async (tok: string, itc = true, valid_until?: string) => (await (await post("/api/quotes", CREATE(itc, valid_until), tok)).json() as any).id as string;
async function sentQuote(valid_until?: string): Promise<{ id: string; send: any }> {
  const id = await createAs(salesTok, true, valid_until);
  await post(`/api/quotes/${id}/submit`, {}, salesTok);
  await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
  const send = await (await post(`/api/quotes/${id}/send`, {}, salesTok)).json() as any;
  return { id, send };
}

describe("reminder seeding (pure helper)", () => {
  it("seeds only rules strictly inside (sent, valid_until)", () => {
    const rules = { R1_send_plus_days: 2, R2_send_plus_days: 7, R3_valid_minus_days: 2 };
    expect(quoteReminderSeeds("2026-01-01", "2026-02-01", rules).map((r) => r.rule)).toEqual(["R1", "R2", "R3"]);
    // short validity: every rule collapses outside the open window → none
    expect(quoteReminderSeeds("2026-01-01", "2026-01-02", rules)).toEqual([]);
    // no valid_until → nothing to anchor R3 → none
    expect(quoteReminderSeeds("2026-01-01", null, rules)).toEqual([]);
    // R3 exactly on valid_until is excluded (strict upper bound)
    expect(quoteReminderSeeds("2026-01-01", "2026-01-03", { ...rules, R3_valid_minus_days: 0 }).some((r) => r.rule === "R3")).toBe(false);
  });
});

describe("send seeds reminders", () => {
  it("send returns R1/R2/R3 at the configured offsets (default 30d validity)", async () => {
    await prep();
    const { send } = await sentQuote();
    const s = send.sent_at as string;
    const byRule = Object.fromEntries((send.reminders as any[]).map((r) => [r.rule, r.due_date]));
    expect(Object.keys(byRule).sort()).toEqual(["R1", "R2", "R3"]);
    expect(byRule.R1).toBe(addDays(s, 2));
    expect(byRule.R2).toBe(addDays(s, 7));
    expect(byRule.R3).toBe(addDays(send.valid_until, -2));
  });

  it("a short-validity quote seeds no reminders", async () => {
    await prep();
    const { send } = await sentQuote(addDays(istTodayStr(), 1)); // valid tomorrow
    expect(send.reminders).toEqual([]);
  });
});

describe("snooze state machine", () => {
  it("PENDING → SNOOZED; SENT rule → 409; snooze onto/after expiry → 422", async () => {
    await prep();
    const { id, send } = await sentQuote();
    const r3 = await (env.DB as D1Database).prepare("SELECT id FROM quote_reminders WHERE quote_id=? AND rule='R3'").bind(id).first() as any;
    // onto/after expiry is rejected
    const past = await post(`/api/quotes/${id}/reminders/${r3.id}/snooze`, { until: send.valid_until }, salesTok);
    expect(past.status).toBe(422);
    // a valid future snooze before expiry
    const until = addDays(istTodayStr(), 3);
    const ok = await post(`/api/quotes/${id}/reminders/${r3.id}/snooze`, { until }, salesTok);
    expect(ok.status).toBe(200);
    expect((await ok.json() as any).status).toBe("SNOOZED");
    // mark a rule SENT then try to snooze it → 409
    const r1 = await (env.DB as D1Database).prepare("SELECT id FROM quote_reminders WHERE quote_id=? AND rule='R1'").bind(id).first() as any;
    await (env.DB as D1Database).prepare("UPDATE quote_reminders SET status='SENT' WHERE id=?").bind(r1.id).run();
    expect((await post(`/api/quotes/${id}/reminders/${r1.id}/snooze`, { until }, salesTok)).status).toBe(409);
  });
});

describe("follow-ups + Today + bell", () => {
  it("follow-up due today shows in Today + counts in bell; expiring bucket lists the SENT quote", async () => {
    await prep();
    const { id } = await sentQuote(addDays(istTodayStr(), 2)); // inside the 3-day expiring window
    const today = istTodayStr();
    const fu = await post(`/api/quotes/${id}/followups`, { channel: "call", note: "left a voicemail", next_action_date: today }, salesTok);
    expect(fu.status).toBe(200);
    const t = await (await get("/api/quotes/today", salesTok)).json() as any;
    expect(t.followups_due.some((f: any) => f.quote_id === id)).toBe(true);
    expect(t.expiring.some((q: any) => q.id === id)).toBe(true);
    const bell = await (await get("/api/quotes/bell", salesTok)).json() as any;
    expect(bell.followups).toBeGreaterThanOrEqual(1);
    expect(bell.count).toBeGreaterThanOrEqual(1);
    // bad channel is rejected
    expect((await post(`/api/quotes/${id}/followups`, { channel: "carrier-pigeon" }, salesTok)).status).toBe(422);
  });

  it("bell counts a PENDING approval leg assigned to me", async () => {
    await prep();
    const id = await createAs(salesTok, false); // ITC=No → finance + manager legs
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    const mgrBell = await (await get("/api/quotes/bell", mgrTok)).json() as any;
    expect(mgrBell.approvals).toBeGreaterThanOrEqual(1);
    const finBell = await (await get("/api/quotes/bell", finTok)).json() as any;
    expect(finBell.approvals).toBeGreaterThanOrEqual(1);
  });
});

describe("cron reminder pass (frozen clock)", () => {
  it("fires due reminders, then sweeps SENT→EXPIRED past validity", async () => {
    await prep();
    const { id, send } = await sentQuote(); // valid ~30d out; R1=+2, R2=+7
    const s = send.sent_at as string;
    // 10 days after send: R1 and R2 are due, quote still valid → both fire
    const fired = await runQuoteReminderPass(env as any, new Date(Date.parse(addDays(s, 10) + "T06:00:00Z")));
    expect(fired.fired).toBe(2);
    expect(fired.expired).toBe(0);
    const sentRules = await (env.DB as D1Database).prepare("SELECT rule FROM quote_reminders WHERE quote_id=? AND status='SENT' ORDER BY rule").bind(id).all();
    expect((sentRules.results as any[]).map((r) => r.rule)).toEqual(["R1", "R2"]);
    // re-running the same day does not re-fire SENT rules (dedup)
    expect((await runQuoteReminderPass(env as any, new Date(Date.parse(addDays(s, 10) + "T06:00:00Z")))).fired).toBe(0);
    // 40 days after send: past valid_until → quote EXPIRES, remaining reminders cancelled, nothing fires
    const sweep = await runQuoteReminderPass(env as any, new Date(Date.parse(addDays(s, 40) + "T06:00:00Z")));
    expect(sweep.fired).toBe(0);
    expect(sweep.expired).toBe(1);
    expect((await (await get(`/api/quotes/${id}`, salesTok)).json() as any).status).toBe("EXPIRED");
    const live = await (env.DB as D1Database).prepare("SELECT COUNT(*) AS n FROM quote_reminders WHERE quote_id=? AND status IN ('PENDING','SNOOZED')").bind(id).first() as any;
    expect(live.n).toBe(0);
  });
});
