// Integration tests for the Account / Location model (P1):
// GET/POST/PATCH /api/clients/:id/locations and POST /api/clients/:id/rename.
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
let saTok: string, opsTok: string, cliTok: string;

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
  await d.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('cL','Loco Foods','l@y.z',1)").run();
  await d.prepare("ALTER TABLE clients ADD COLUMN address TEXT").run().catch(() => {});
  await d.prepare("UPDATE clients SET address='12 Main Rd, Bengaluru' WHERE id='cL'").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-sa2','sa2@sp.test','SEED:pw123','super_admin','SA','SP','SA',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-ops2','ops2@sp.test','SEED:pw123','ops_admin','OP','SP','OP',1,NULL)").run();
  await d.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active,client_id) VALUES ('u-cli3','cli3@sp.test','SEED:pw123','client_admin','CL','SP','CL',1,'cL')").run();
  saTok = await login("sa2@sp.test", "pw123");
  opsTok = await login("ops2@sp.test", "pw123");
  cliTok = await login("cli3@sp.test", "pw123");
});

describe("client locations", () => {
  it("rejects a client role", async () => {
    expect((await get("/api/clients/cL/locations", cliTok)).status).toBe(403);
  });

  it("seeds a default location from the client address on first read, idempotently", async () => {
    const r1 = await (await get("/api/clients/cL/locations", opsTok)).json() as any;
    expect(r1.locations.length).toBe(1);
    expect(r1.locations[0].is_default).toBe(1);
    expect(r1.locations[0].shipping_address).toBe("12 Main Rd, Bengaluru");
    const r2 = await (await get("/api/clients/cL/locations", opsTok)).json() as any;
    expect(r2.locations.length).toBe(1); // no duplicate seed
  });

  it("adds a location as default and clears the previous default (exactly one)", async () => {
    await get("/api/clients/cL/locations", opsTok); // seed default
    const add = await (await post("/api/clients/cL/locations", { display_name: "Site B", shipping_address: "Addr B", is_default: true }, opsTok)).json() as any;
    expect(add.is_default).toBe(1);
    const r = await (await get("/api/clients/cL/locations", opsTok)).json() as any;
    const defaults = r.locations.filter((l: any) => l.is_default === 1);
    expect(defaults.length).toBe(1);
    expect(defaults[0].display_name).toBe("Site B");
  });

  it("swaps the default via PATCH", async () => {
    await get("/api/clients/cL/locations", opsTok);
    await post("/api/clients/cL/locations", { display_name: "Site B", shipping_address: "Addr B" }, opsTok);
    const r = await (await get("/api/clients/cL/locations", opsTok)).json() as any;
    const seeded = r.locations.find((l: any) => l.display_name !== "Site B");
    const siteB = r.locations.find((l: any) => l.display_name === "Site B");
    expect(seeded.is_default).toBe(1);
    await patch(`/api/clients/cL/locations/${siteB.id}`, { is_default: true }, opsTok);
    const r2 = await (await get("/api/clients/cL/locations", opsTok)).json() as any;
    expect(r2.locations.find((l: any) => l.id === siteB.id).is_default).toBe(1);
    expect(r2.locations.filter((l: any) => l.is_default === 1).length).toBe(1);
  });
});

describe("client rename", () => {
  it("requires a reason", async () => {
    expect((await post("/api/clients/cL/rename", { name: "Loco Foods Pvt Ltd" }, saTok)).status).toBe(400);
  });
  it("rejects a non-super-admin", async () => {
    expect((await post("/api/clients/cL/rename", { name: "X", reason: "r" }, opsTok)).status).toBe(403);
  });
  it("renames, preserves the old name in legal_name, and audits", async () => {
    const r = await (await post("/api/clients/cL/rename", { name: "Loco Foods Pvt Ltd", reason: "Legal name correction" }, saTok)).json() as any;
    expect(r.name).toBe("Loco Foods Pvt Ltd");
    expect(r.previous).toBe("Loco Foods");
    const row = await db().prepare("SELECT name, legal_name FROM clients WHERE id='cL'").first() as any;
    expect(row.name).toBe("Loco Foods Pvt Ltd");
    expect(row.legal_name).toBe("Loco Foods");
    const aud = await db().prepare("SELECT COUNT(*) c FROM audit_logs WHERE action='RENAME_CLIENT' AND entity_id='cL'").first() as any;
    expect(aud.c).toBeGreaterThan(0);
  });
});
