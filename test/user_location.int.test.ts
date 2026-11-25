// Integration tests for binding users to a specific client LOCATION (not just the
// client): the /api/client-locations picker feed, create/patch user by location_id,
// location display-name uniqueness within a client, the one-time backfill, and that
// login/me carries the location display name.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const patch = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PATCH", headers: hdr(t), body: JSON.stringify(b) });
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
  for (const sql of [
    "ALTER TABLE clients ADD COLUMN display_name TEXT", "ALTER TABLE clients ADD COLUMN legal_name TEXT",
    "ALTER TABLE users ADD COLUMN location_id TEXT",
  ]) await d.prepare(sql).run().catch(() => {});
  await d.prepare("CREATE TABLE IF NOT EXISTS client_locations ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, display_name TEXT NOT NULL, shipping_address TEXT, contact_name TEXT, contact_phone TEXT, zoho_address_id TEXT, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) )").run();

  // Chaayos with two locations; the first is the default.
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,address,active) VALUES ('cCh','Chaayos','Bengaluru',1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,is_default,active) VALUES ('locInd','cCh','Chaayos - Indiranagar','Indiranagar',1,1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,shipping_address,is_default,active) VALUES ('locKor','cCh','Chaayos - Koramangala','Koramangala',0,1)").run();
  // A legacy client user linked by client only (no location) — exercises the backfill.
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,address,active) VALUES ('cLeg','Legacy Co','Pune',1)").run();
  await d.prepare("INSERT OR IGNORE INTO client_locations (id,client_id,display_name,is_default,active) VALUES ('locLeg','cLeg','Legacy Co - HQ',1,1)").run();

  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-sa','sa@sp.test','SEED:pw123','super_admin','SA','SP','SA',1,NULL)").run();
  // Ravi at Chaayos - Indiranagar (for the login/me assertion).
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id,location_id) VALUES ('u-ravi','ravi@chaayos.test','SEED:pw123','client_admin','Ravi','Chaayos','R',1,'cCh','locInd')").run();
  // Legacy user with client but no location.
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-leg','leg@legacy.test','SEED:pw123','client_user','Leg','Legacy Co','L',1,'cLeg')").run();
  saTok = await login("sa@sp.test", "pw123");
  cliTok = await login("ravi@chaayos.test", "pw123");
});

describe("client-locations picker feed", () => {
  it("lists active locations across clients with the client name (admin)", async () => {
    const r = await (await get("/api/client-locations", saTok)).json() as any;
    const ind = r.locations.find((l: any) => l.id === "locInd");
    expect(ind.client_name).toBe("Chaayos");
    expect(ind.display_name).toBe("Chaayos - Indiranagar");
    expect(r.locations.some((l: any) => l.id === "locKor")).toBe(true);
  });
  it("is forbidden to a client-role user", async () => {
    expect((await get("/api/client-locations", cliTok)).status).toBe(403);
  });
});

describe("create user by location", () => {
  it("saves the user against the specific location + derives client and org", async () => {
    const r = await (await post("/api/users", { name: "Asha", email: "asha@chaayos.test", role: "client_user", location_id: "locKor", password: "x" }, saTok)).json() as any;
    const u = await db().prepare("SELECT client_id, location_id, org FROM users WHERE id=?").bind(r.id).first() as any;
    expect(u.location_id).toBe("locKor");
    expect(u.client_id).toBe("cCh");
    expect(u.org).toBe("Chaayos");
  });
  it("rejects a client-role user with no location", async () => {
    const res = await post("/api/users", { name: "NoLoc", email: "noloc@chaayos.test", role: "client_user", password: "x" }, saTok);
    expect(res.status).toBe(400);
  });
  it("links a legacy client_id-only create to the client's default location", async () => {
    const r = await (await post("/api/users", { name: "Legacy2", email: "l2@legacy.test", role: "client_user", client_id: "cLeg", password: "x" }, saTok)).json() as any;
    const u = await db().prepare("SELECT location_id FROM users WHERE id=?").bind(r.id).first() as any;
    expect(u.location_id).toBe("locLeg");
  });
});

describe("reassign + uniqueness + backfill", () => {
  it("patches a user to a different location (client + org follow)", async () => {
    await post("/api/users", { name: "Mover", email: "mover@chaayos.test", role: "client_user", location_id: "locInd", password: "x" }, saTok);
    const id = (await db().prepare("SELECT id FROM users WHERE email='mover@chaayos.test'").first() as any).id;
    await patch(`/api/users/${id}`, { location_id: "locKor" }, saTok);
    const u = await db().prepare("SELECT location_id, client_id FROM users WHERE id=?").bind(id).first() as any;
    expect(u.location_id).toBe("locKor");
    expect(u.client_id).toBe("cCh");
  });
  it("blocks two locations of the same client sharing a display name", async () => {
    const res = await post("/api/clients/cCh/locations", { display_name: "Chaayos - Indiranagar" }, saTok);
    expect(res.status).toBe(409);
  });
  it("backfills location_id for a legacy client user on the users list", async () => {
    await get("/api/users", saTok); // triggers the one-time backfill
    const u = await db().prepare("SELECT location_id FROM users WHERE id='u-leg'").first() as any;
    expect(u.location_id).toBe("locLeg");
  });
});

describe("login carries the location name", () => {
  it("auth/me returns the location display name for a located user", async () => {
    const r = await (await get("/api/auth/me", cliTok)).json() as any;
    expect(r.user.location_id).toBe("locInd");
    expect(r.user.location_name).toBe("Chaayos - Indiranagar");
  });
  it("the users list exposes location_name + client_name", async () => {
    const list = await (await get("/api/users", saTok)).json() as any[];
    const ravi = list.find((u) => u.id === "u-ravi");
    expect(ravi.location_name).toBe("Chaayos - Indiranagar");
    expect(ravi.client_name).toBe("Chaayos");
  });
});
