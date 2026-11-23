// Integration tests for the Zoho client sync (P2): review + apply against a seeded
// mirror. The live Zoho pull (runZohoContactSync) is covered structurally; here we test
// the review proposals and the apply (rename / create / location upsert) logic.
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
let saTok: string, opsTok: string;

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
  // Account columns + locations + mirror tables (created at runtime in prod; seed here).
  for (const sql of [
    "ALTER TABLE clients ADD COLUMN display_name TEXT", "ALTER TABLE clients ADD COLUMN legal_name TEXT",
    "ALTER TABLE clients ADD COLUMN zoho_contact_id TEXT", "ALTER TABLE clients ADD COLUMN address TEXT",
  ]) await d.prepare(sql).run().catch(() => {});
  await d.prepare("CREATE TABLE IF NOT EXISTS client_locations ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, display_name TEXT NOT NULL, shipping_address TEXT, contact_name TEXT, contact_phone TEXT, zoho_address_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS zoho_contacts ( zoho_contact_id TEXT PRIMARY KEY, name TEXT, gstin TEXT, billing_address TEXT, status TEXT, synced_at TEXT )").run();
  await d.prepare("CREATE TABLE IF NOT EXISTS zoho_contact_addresses ( id INTEGER PRIMARY KEY AUTOINCREMENT, zoho_contact_id TEXT NOT NULL, zoho_address_id TEXT, label TEXT, address_text TEXT )").run();

  await d.prepare("INSERT OR IGNORE INTO clients (id,name,address,zoho_contact_id,active) VALUES ('cS','ServiceNow India','Manyata, Bengaluru','z-sn',1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,zoho_address_id,is_default,active) VALUES ('loc-a1','cS','ServiceNow · Manyata EGL','Manyata','a1',1,1)").run();
  await d.prepare("INSERT OR IGNORE INTO zoho_contacts (zoho_contact_id,name,gstin,billing_address) VALUES ('z-sn','ServiceNow Software Development India Pvt Ltd','29AAA','Manyata EGL, Bengaluru')").run();
  await d.prepare("INSERT OR IGNORE INTO zoho_contacts (zoho_contact_id,name,gstin,billing_address) VALUES ('z-new','Globex Technologies LLP','29BBB','Globex HQ')").run();
  await d.prepare("INSERT INTO zoho_contact_addresses (zoho_contact_id,zoho_address_id,label,address_text) VALUES ('z-sn','a1','Manyata','Manyata, Bengaluru')").run();
  await d.prepare("INSERT INTO zoho_contact_addresses (zoho_contact_id,zoho_address_id,label,address_text) VALUES ('z-sn','a2','Bagmane','Bagmane, Bengaluru')").run();
  await d.prepare("INSERT INTO zoho_contact_addresses (zoho_contact_id,zoho_address_id,label,address_text) VALUES ('z-new','a9','HQ','Globex HQ, Bengaluru')").run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-sa3','sa3@sp.test','SEED:pw123','super_admin','SA','SP','SA',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-op3','op3@sp.test','SEED:pw123','ops_admin','OP','SP','OP',1,NULL)").run();
  saTok = await login("sa3@sp.test", "pw123");
  opsTok = await login("op3@sp.test", "pw123");
});

describe("client sync — review", () => {
  it("rejects a non-super-admin", async () => {
    expect((await get("/api/client-sync/review", opsTok)).status).toBe(403);
  });
  it("proposes a name change and matched/new locations", async () => {
    const r = await (await get("/api/client-sync/review", saTok)).json() as any;
    const sn = r.proposals.find((p: any) => p.zoho_contact_id === "z-sn");
    expect(sn.status).toBe("matched");
    expect(sn.client_id).toBe("cS");
    expect(sn.name_differs).toBe(true);
    expect(sn.current_name).toBe("ServiceNow India");
    expect(sn.locations.find((l: any) => l.zoho_address_id === "a1").state).toBe("existing");
    expect(sn.locations.find((l: any) => l.zoho_address_id === "a2").state).toBe("new");
    const nw = r.proposals.find((p: any) => p.zoho_contact_id === "z-new");
    expect(nw.status).toBe("new");
    expect(nw.client_id).toBe(null);
  });
});

describe("client sync — apply", () => {
  it("replace renames (legal_name kept) and upserts locations", async () => {
    const r = await (await post("/api/client-sync/apply", { decisions: [{
      zoho_contact_id: "z-sn", action: "replace", client_id: "cS",
      name: "ServiceNow Software Development India Pvt Ltd", reason: "Legal name correction",
      locations: [
        { zoho_address_id: "a1", display_name: "ServiceNow · Manyata EGL", shipping_address: "Manyata, Bengaluru" },
        { zoho_address_id: "a2", display_name: "ServiceNow · Bagmane", shipping_address: "Bagmane, Bengaluru" },
      ],
    }] }, saTok)).json() as any;
    expect(r.results[0].outcome).toBe("renamed");
    const c = await db().prepare("SELECT name, legal_name, zoho_contact_id FROM clients WHERE id='cS'").first() as any;
    expect(c.name).toBe("ServiceNow Software Development India Pvt Ltd");
    expect(c.legal_name).toBe("ServiceNow India");
    expect(c.zoho_contact_id).toBe("z-sn");
    const locs = await db().prepare("SELECT COUNT(*) n FROM client_locations WHERE client_id='cS'").first() as any;
    expect(locs.n).toBe(2); // a1 updated + a2 created
  });

  it("replace without a reason is skipped", async () => {
    const r = await (await post("/api/client-sync/apply", { decisions: [{
      zoho_contact_id: "z-sn", action: "replace", client_id: "cS", name: "X",
    }] }, saTok)).json() as any;
    expect(r.results[0].outcome).toBe("skipped");
    expect(r.results[0].reason).toBe("reason required");
  });

  it("create makes a new client with a default location", async () => {
    const r = await (await post("/api/client-sync/apply", { decisions: [{
      zoho_contact_id: "z-new", action: "create", name: "Globex Technologies LLP", display_name: "Globex",
      locations: [{ zoho_address_id: "a9", display_name: "Globex · HQ", shipping_address: "Globex HQ" }],
    }] }, saTok)).json() as any;
    expect(r.results[0].outcome).toBe("created");
    const cid = r.results[0].client_id;
    const c = await db().prepare("SELECT zoho_contact_id, display_name FROM clients WHERE id=?").bind(cid).first() as any;
    expect(c.zoho_contact_id).toBe("z-new");
    const loc = await db().prepare("SELECT COUNT(*) n, SUM(is_default) d FROM client_locations WHERE client_id=?").bind(cid).first() as any;
    expect(loc.n).toBe(1);
    expect(loc.d).toBe(1);
  });

  it("manual map: a 'new' contact linked to an existing client (keep) links it + upserts locations", async () => {
    // Isolated storage: seed a fresh unlinked client inside this test and map z-new onto it.
    await db().prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('cMap','Globex Manual',1)").run();
    const r = await (await post("/api/client-sync/apply", { decisions: [{
      zoho_contact_id: "z-new", action: "keep", client_id: "cMap",
      name: "Globex Technologies LLP", display_name: "Globex Technologies LLP",
      locations: [{ zoho_address_id: "a9", display_name: "Globex · HQ", shipping_address: "Globex HQ" }],
    }] }, saTok)).json() as any;
    expect(r.results[0].outcome).toBe("linked");
    expect(r.results[0].client_id).toBe("cMap");
    const c = await db().prepare("SELECT name, zoho_contact_id FROM clients WHERE id='cMap'").first() as any;
    expect(c.name).toBe("Globex Manual");        // keep leaves the name as-is
    expect(c.zoho_contact_id).toBe("z-new");     // but links the Zoho contact
    const loc = await db().prepare("SELECT COUNT(*) n FROM client_locations WHERE client_id='cMap'").first() as any;
    expect(loc.n).toBe(1);
  });

  it("manual map: a 'new' contact mapped with replace renames the existing client", async () => {
    await db().prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('cMap2','Globex Old',1)").run();
    const r = await (await post("/api/client-sync/apply", { decisions: [{
      zoho_contact_id: "z-new", action: "replace", client_id: "cMap2",
      name: "Globex Technologies LLP", reason: "Merge duplicate records",
      locations: [{ zoho_address_id: "a9", display_name: "Globex · HQ", shipping_address: "Globex HQ" }],
    }] }, saTok)).json() as any;
    expect(r.results[0].outcome).toBe("renamed");
    const c = await db().prepare("SELECT name, legal_name, zoho_contact_id FROM clients WHERE id='cMap2'").first() as any;
    expect(c.name).toBe("Globex Technologies LLP");
    expect(c.legal_name).toBe("Globex Old");
    expect(c.zoho_contact_id).toBe("z-new");
  });

  it("rejects apply by a non-super-admin", async () => {
    expect((await post("/api/client-sync/apply", { decisions: [] }, opsTok)).status).toBe(403);
  });
});

describe("zoho contacts dropdown + add client", () => {
  it("lists mirrored contacts flagged if already a client", async () => {
    const r = await (await get("/api/zoho-contacts", opsTok)).json() as any;
    const sn = r.contacts.find((c: any) => c.zoho_contact_id === "z-sn");
    const nw = r.contacts.find((c: any) => c.zoho_contact_id === "z-new");
    expect(sn.already_client).toBe(true);   // cS is linked to z-sn
    expect(nw.already_client).toBe(false);
  });
  it("creates a client carrying display_name + zoho_contact_id", async () => {
    const r = await (await post("/api/clients", { name: "Globex Technologies LLP", display_name: "Globex", zoho_contact_id: "z-new" }, saTok)).json() as any;
    expect(r.id).toBeTruthy();
    const c = await db().prepare("SELECT name, display_name, zoho_contact_id FROM clients WHERE id=?").bind(r.id).first() as any;
    expect(c.display_name).toBe("Globex");
    expect(c.zoho_contact_id).toBe("z-new");
  });
});
