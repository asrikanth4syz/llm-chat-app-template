import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

// Load all migration SQL files at Vite build time (sorted by filename)
const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, sql]) => sql);

// ── Helpers ───────────────────────────────────────────────────────────
const BASE = "http://localhost";

async function post(path: string, body: unknown, token?: string) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string) {
  return SELF.fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function patch(path: string, body: unknown, token?: string) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function del(path: string, token?: string) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function login(email: string, password: string): Promise<string> {
  const res = await post("/api/auth/login", { email, password });
  const data = await res.json() as { token: string };
  return data.token;
}

function ok(status: number) {
  return status >= 200 && status < 300;
}

// ── Setup: apply all migrations then seed ─────────────────────────────
let adminToken: string;
let clientToken: string;
let opsToken: string;

beforeAll(async () => {
  const db = env.DB as D1Database;

  // Apply all migration files in order (loaded at build time by Vite)
  // Run each statement individually — D1 batch rejects mixing DDL + DML
  for (const sql of migrations) {
    const stmts = sql
      .split(";")
      .map(s => s.replace(/--[^\n]*/g, "").trim())
      .filter(s => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s));
    for (const stmt of stmts) {
      // The local D1 simulator occasionally throws a transient "internal error"
      // during cold-start replay — retry a few times before giving up.
      for (let attempt = 0; ; attempt++) {
        try {
          await db.prepare(stmt).run();
          break;
        } catch (e: unknown) {
          const msg = String(e);
          // Ignore expected re-run errors
          if (msg.includes("duplicate column") || msg.includes("already exists") || msg.includes("UNIQUE constraint")) break;
          // Retry transient simulator faults
          if (msg.includes("internal error") && attempt < 4) {
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
    }
  }

  // Seed test-only users with IDs that don't conflict with migration seed (u1-u12)
  // Use individual .run() calls — batch() may not persist in vitest-pool-workers
  await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,?)")
    .bind("tst-admin","admin@sp.test","SEED:admin123","super_admin","Admin User","SmartPantry","AU",1).run();
  await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,client_id,active) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind("tst-client","client@sp.test","SEED:client123","client_admin","Rahul Verma","Meta India","RV","c1",1).run();
  await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,?)")
    .bind("tst-ops","ops@sp.test","SEED:ops123","ops_manager","Ops Manager","SmartPantry","OM",1).run();
  // c1 already seeded by migration; INSERT OR IGNORE is a no-op when it exists
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES (?,?,?,?)")
    .bind("c1","Meta India","client@sp.test",1).run();
  await db.prepare("INSERT OR IGNORE INTO vendors (id,name,category,active) VALUES (?,?,?,?)")
    .bind("v1","Fresh Farms","Grocery",1).run();
  await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,?)")
    .bind("SKU001","Basmati Rice 5kg","Grocery",450,100,1).run();
  await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,?)")
    .bind("SKU002","Refined Oil 1L","Grocery",150,50,1).run();
  // Seed a known DRAFT order for deterministic single-order tests
  await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes,order_type) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind("TST-ORDER-001","c1","tst-ops","DRAFT",2250,405,2655,"Test order","Regular").run();
  await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
    .bind("tst-oi-001","TST-ORDER-001","SKU001","Basmati Rice 5kg",5,450,2250).run();
  // Seed catalog for client c1
  await db.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
    .bind("c1","SKU001","tst-admin").run();
  await db.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
    .bind("c1","SKU002","tst-admin").run();

  adminToken = await login("admin@sp.test", "admin123");
  clientToken = await login("client@sp.test", "client123");
  opsToken    = await login("ops@sp.test",    "ops123");
});

// ════════════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ════════════════════════════════════════════════════════════════════
describe("Security headers", () => {
  it("responses carry a strict CSP (no 'unsafe-inline' in script-src) + XFO/nosniff", async () => {
    const res = await post("/api/auth/login", { email: "admin@sp.test", password: "admin123" });
    const csp = res.headers.get("content-security-policy") || "";
    expect(csp).toContain("script-src 'self'");
    const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src")) || "";
    expect(scriptSrc).not.toContain("unsafe-inline"); // inline handlers removed → strict
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

// ════════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════════
describe("Auth", () => {
  it("POST /api/auth/login — valid credentials returns token", async () => {
    const res = await post("/api/auth/login", { email: "admin@sp.test", password: "admin123" });
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: { role: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe("super_admin");
  });

  it("POST /api/auth/login — wrong password returns 401", async () => {
    const res = await post("/api/auth/login", { email: "admin@sp.test", password: "wrong" });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it("POST /api/auth/login — unknown email returns 401", async () => {
    const res = await post("/api/auth/login", { email: "nobody@sp.test", password: "test" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/login — missing fields returns 400", async () => {
    const res = await post("/api/auth/login", { email: "admin@sp.test" });
    expect(res.status).toBe(400);
  });

  it("vendor documents round-trip through R2 storage (stored as pointer, resolved on read)", async () => {
    const db = env.DB as D1Database;
    const b64 = "aGVsbG8gcGRmIGJsb2I=";  // "hello pdf blob"
    const res = await post("/api/vendors", {
      name: "Doc R2 Vendor", category: "Beverages",
      documents: [{ kind: "pan", filename: "pan.pdf", mime: "application/pdf", size: 12, data: b64 }],
    }, adminToken);
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    // stored value in D1 is an r2: pointer (blob moved out of the row)
    const raw = await db.prepare("SELECT data FROM vendor_documents WHERE vendor_id=?").bind(id).first() as { data: string };
    expect(raw.data.startsWith("r2:")).toBe(true);
    // the list endpoint resolves it back to the original base64
    const list = await (await get(`/api/vendors/${id}/documents`, adminToken)).json() as Array<{ data: string }>;
    expect(list[0].data).toBe(b64);
  });

  it("GET /api/import-jobs — returns an array (import history)", async () => {
    const res = await get("/api/import-jobs", adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it("feature-table endpoints all respond 200 (self-healed schema, no 500 on missing table)", async () => {
    const paths = ["/api/audit-logs", "/api/delivery-routes", "/api/order-templates",
      "/api/sla-rules", "/api/approval-chains", "/api/staff"];
    for (const p of paths) {
      const res = await get(p, adminToken);
      expect(res.status, `${p} should not 500`).toBe(200);
    }
  });

  it("POST /api/auth/login — a plaintext SEED account is upgraded to a hash on login", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,?)")
      .bind("tst-seedup", "seedup@sp.test", "SEED:seedpass", "ops_manager", "Seed Up", "SmartPantry", "SU", 1).run();
    const res = await post("/api/auth/login", { email: "seedup@sp.test", password: "seedpass" });
    expect(res.status).toBe(200);
    const row = await db.prepare("SELECT password_hash FROM users WHERE id='tst-seedup'").first() as { password_hash: string };
    expect(row.password_hash.startsWith("hash:")).toBe(true);  // plaintext removed
    expect(row.password_hash.startsWith("SEED:")).toBe(false);
    // still logs in via the hashed path
    const res2 = await post("/api/auth/login", { email: "seedup@sp.test", password: "seedpass" });
    expect(res2.status).toBe(200);
  });

  it("POST /api/auth/login — locks out after repeated failures", async () => {
    const email = "bruteforce@sp.test"; // unique email so it can't affect other tests
    for (let i = 0; i < 5; i++) {
      const r = await post("/api/auth/login", { email, password: "x" });
      expect(r.status).toBe(401); // first five failures are rejected but allowed
    }
    const locked = await post("/api/auth/login", { email, password: "x" });
    expect(locked.status).toBe(429); // sixth attempt is throttled
    expect((await locked.json() as { error: string }).error).toMatch(/too many/i);
  });

  it("GET /api/auth/me — valid token returns user info", async () => {
    const res = await get("/api/auth/me", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string; role: string } };
    expect(body.user.email).toBe("admin@sp.test");
    expect(body.user.role).toBe("super_admin");
  });

  it("GET /api/auth/me — no token returns 401", async () => {
    const res = await get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me — invalid token returns 401", async () => {
    const res = await get("/api/auth/me", "bad.token.value");
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════════
describe("Inventory", () => {
  it("GET /api/inventory — ops user sees all items", async () => {
    const res = await get("/api/inventory", opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/inventory — unauthenticated returns 401", async () => {
    const res = await get("/api/inventory");
    expect(res.status).toBe(401);
  });

  it("GET /api/inventory — client with no catalog assignments sees all items (fallback)", async () => {
    const res = await get("/api/inventory", clientToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("POST /api/inventory — adds new item", async () => {
    const res = await post("/api/inventory", {
      sku: "SKU-NEW",
      name: "Test Product",
      category: "Grocery",
      unit_price: 99,
      stock: 10,
    }, adminToken);
    expect(ok(res.status)).toBe(true);
    const body = await res.json() as { ok?: boolean; sku?: string };
    expect(body.ok || body.sku).toBeTruthy();
  });

  it("PATCH /api/inventory/:sku — updates item fields", async () => {
    const res = await patch("/api/inventory/SKU001", { stock: 150, unit_price: 460 }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { sku: string };
    expect(body.sku).toBe("SKU001");
  });

  it("PATCH /api/inventory/:sku — unauthenticated returns 401", async () => {
    const res = await patch("/api/inventory/SKU001", { stock: 50 });
    expect(res.status).toBe(401);
  });

  it("GET /api/inventory — rows carry a `used` flag; low-stock KPI counts only used SKUs", async () => {
    const db = env.DB as D1Database;
    const before = (await (await get("/api/dashboard", adminToken)).json() as { lowStock: number }).lowStock;
    // below reorder AND used (has an order line)
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reorder_level,active) VALUES ('USED-LOW','Used Low','Grocery',10,0,10,1)").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('oi-usedlow','TST-ORDER-001','USED-LOW','Used Low',1,10,10)").run();
    // below reorder but never used (dead catalogue row)
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reorder_level,active) VALUES ('DEAD-LOW','Dead Low','Grocery',10,0,10,1)").run();

    const inv = await (await get("/api/inventory", adminToken)).json() as Array<{ sku: string; used: number }>;
    expect(inv.find(i => i.sku === "USED-LOW")?.used).toBe(1);
    expect(inv.find(i => i.sku === "DEAD-LOW")?.used).toBe(0);

    const after = (await (await get("/api/dashboard", adminToken)).json() as { lowStock: number }).lowStock;
    expect(after - before).toBe(1); // only the used below-reorder SKU is counted
  });
});

// ════════════════════════════════════════════════════════════════════
// VENDORS
// ════════════════════════════════════════════════════════════════════
describe("Vendors", () => {
  it("GET /api/vendors — returns list", async () => {
    const res = await get("/api/vendors", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/vendors — creates vendor", async () => {
    const res = await post("/api/vendors", {
      name: "New Vendor Co",
      category: "Beverages",
      contact_email: "vendor@new.test",
    }, adminToken);
    expect(ok(res.status)).toBe(true);
  });

  it("GET /api/vendors — unauthenticated returns 401", async () => {
    const res = await get("/api/vendors");
    expect(res.status).toBe(401);
  });

  it("POST /api/vendors — assigns a unique VDR-YYYY-NNNNN vendor code that increments", async () => {
    const r1 = await post("/api/vendors", { name: "Code Vendor A", category: "Beverages" }, adminToken);
    const r2 = await post("/api/vendors", { name: "Code Vendor B", category: "Beverages" }, adminToken);
    const { id: id1 } = await r1.json() as { id: string };
    const { id: id2 } = await r2.json() as { id: string };
    const list = await (await get("/api/vendors", adminToken)).json() as Array<{id:string;vendor_code:string}>;
    const c1 = list.find(x => x.id === id1)?.vendor_code || "";
    const c2 = list.find(x => x.id === id2)?.vendor_code || "";
    expect(c1).toMatch(/^VDR-\d{4}-\d{5}$/);
    expect(c2).toMatch(/^VDR-\d{4}-\d{5}$/);
    expect(c1).not.toBe(c2);
    const n1 = parseInt(c1.split("-").pop() as string, 10);
    const n2 = parseInt(c2.split("-").pop() as string, 10);
    expect(n2).toBe(n1 + 1);
  });

  it("POST /api/vendors — registered vendor stores validated GSTIN + derived PAN", async () => {
    const res = await post("/api/vendors", { name: "Reg Vendor", category: "Grocery",
      registration_type: "registered", gstin: "27aapfu0939f1zv" }, adminToken);
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    const list = await (await get("/api/vendors", adminToken)).json() as Array<{id:string;gstin:string;pan:string}>;
    const v = list.find(x => x.id === id);
    expect(v?.gstin).toBe("27AAPFU0939F1ZV");
    expect(v?.pan).toBe("AAPFU0939F");
  });

  it("POST /api/vendors — registered vendor without a GSTIN is rejected", async () => {
    const res = await post("/api/vendors", { name: "No GST Vendor", registration_type: "registered" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/vendors — unregistered vendor needs no GSTIN", async () => {
    const res = await post("/api/vendors", { name: "Unreg Vendor", category: "Grocery", registration_type: "unregistered" }, adminToken);
    expect(res.status).toBe(201);
  });

  it("POST /api/vendors — onboarding payload stores bank, documents and products", async () => {
    const res = await post("/api/vendors", {
      name: "Onboard Co", category: "Grocery", registration_type: "unregistered",
      onboarding_status: "pending",
      bank_account_name: "Onboard Co", bank_account_no: "50100245678", bank_ifsc: "HDFC0001234",
      bank_name: "HDFC Bank", bank_branch: "BTM",
      documents: [{ kind: "cancelled_cheque", filename: "cheque.jpg", mime: "image/jpeg", size: 2048, data: "data:image/jpeg;base64,AAAA" }],
      products: [{ name: "Bru Coffee 200g", pack: "Carton·24", moq: 2, rate: 185, lead_days: 3, sku: "SKU001" },
                 { name: "New Item", moq: 1, rate: 50, lead_days: 2 }],
    }, adminToken);
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };

    const v = (await (await get("/api/vendors", adminToken)).json() as Array<Record<string,unknown>>).find(x => x.id === id);
    expect(v?.onboarding_status).toBe("pending");
    expect(v?.bank_ifsc).toBe("HDFC0001234");

    const docs = await (await get(`/api/vendors/${id}/documents`, adminToken)).json() as Array<{kind:string}>;
    expect(docs.length).toBe(1);
    expect(docs[0].kind).toBe("cancelled_cheque");

    const prods = await (await get(`/api/vendors/${id}/products`, adminToken)).json() as Array<{name:string;status:string}>;
    expect(prods.length).toBe(2);
    expect(prods.find(p => p.name === "Bru Coffee 200g")?.status).toBe("linked"); // has SKU
    expect(prods.find(p => p.name === "New Item")?.status).toBe("new_sku");
  });

  it("PATCH /api/vendors/:id — approve flips onboarding_status to active", async () => {
    const { id } = await (await post("/api/vendors", { name: "Approve Co", category: "Grocery", onboarding_status: "pending" }, adminToken)).json() as { id: string };
    const res = await patch(`/api/vendors/${id}`, { onboarding_status: "active" }, adminToken);
    expect(ok(res.status)).toBe(true);
    const v = (await (await get("/api/vendors", adminToken)).json() as Array<Record<string,unknown>>).find(x => x.id === id);
    expect(v?.onboarding_status).toBe("active");
  });

  it("POST /api/vendors — food vendor requires a 14-digit FSSAI licence + expiry", async () => {
    const bad = await post("/api/vendors", { name: "Food Bad", category: "Grocery", registration_type: "unregistered",
      vendor_type: "food", fssai_licence: "123", fssai_expiry: "2027-01-01" }, adminToken);
    expect(bad.status).toBe(400);
    const noExp = await post("/api/vendors", { name: "Food NoExp", category: "Grocery", registration_type: "unregistered",
      vendor_type: "food", fssai_licence: "10012345000123" }, adminToken);
    expect(noExp.status).toBe(400);
    const ok = await post("/api/vendors", { name: "Food Good", category: "Grocery", registration_type: "unregistered",
      vendor_type: "food", fssai_licence: "10012345000123", fssai_expiry: "2027-01-01" }, adminToken);
    expect(ok.status).toBe(201);
  });
});

// ════════════════════════════════════════════════════════════════════
// CLIENTS — GST number (optional, 15 chars when present)
// ════════════════════════════════════════════════════════════════════
describe("Client inventory / catalogue scoping", () => {
  it("GET /api/client-inventory — only returns items in the client's allocated catalogue", async () => {
    const db = env.DB as D1Database;
    // c1's catalogue holds SKU001 & SKU002 (seeded). Add a client_inventory row
    // for an assigned SKU and one for an UNASSIGNED SKU (as the DC backfill would).
    await db.prepare("INSERT OR IGNORE INTO client_inventory (client_id,sku,item_name,qty_on_hand,reorder_level) VALUES (?,?,?,?,?)")
      .bind("c1","SKU001","Basmati Rice 5kg",0,5).run();
    await db.prepare("INSERT OR IGNORE INTO client_inventory (client_id,sku,item_name,qty_on_hand,reorder_level) VALUES (?,?,?,?,?)")
      .bind("c1","SKU-UNASSIGNED","Sister Aruba Cranberry Lemonade",3,10).run();

    const res = await get("/api/client-inventory", clientToken);
    expect(res.status).toBe(200);
    const rows = await res.json() as Array<{ sku: string }>;
    const skus = rows.map(r => r.sku);
    expect(skus).toContain("SKU001");           // allocated → shown
    expect(skus).not.toContain("SKU-UNASSIGNED"); // not allocated → hidden
  });
});

describe("Clients / rename propagation", () => {
  it("PATCH /api/clients/:id name — /auth/me for that client's user shows the new org live", async () => {
    // clientToken belongs to client c1 (seeded as "Meta India")
    const before = await (await get("/api/auth/me", clientToken)).json() as { user: { org: string; client_id: string } };
    expect(before.user.client_id).toBe("c1");

    const rename = await patch("/api/clients/c1", { name: "Meta Platforms India" }, adminToken);
    expect(ok(rename.status)).toBe(true);

    const after = await (await get("/api/auth/me", clientToken)).json() as { user: { org: string } };
    expect(after.user.org).toBe("Meta Platforms India");
  });
});

describe("Clients / GSTIN + PAN", () => {
  it("POST /api/clients — accepts a checksum-valid GSTIN, stores it upper-cased and derives the PAN", async () => {
    const res = await post("/api/clients", { name: "GST Valid Co", gstin: "27aapfu0939f1zv" }, adminToken);
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    const list = await (await get("/api/clients", adminToken)).json() as Array<{id:string; gstin:string; pan:string}>;
    const c = list.find(x => x.id === id);
    expect(c?.gstin).toBe("27AAPFU0939F1ZV");
    expect(c?.pan).toBe("AAPFU0939F"); // derived from chars 3–12 of the GSTIN
  });

  it("POST /api/clients — rejects a well-formed GSTIN with a wrong checksum digit", async () => {
    const res = await post("/api/clients", { name: "GST Checksum Co", gstin: "27AAPFU0939F1ZX" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/clients — no tax ids is allowed (both optional)", async () => {
    const res = await post("/api/clients", { name: "No GST Co" }, adminToken);
    expect(res.status).toBe(201);
  });

  it("POST /api/clients — accepts a standalone valid PAN", async () => {
    const res = await post("/api/clients", { name: "PAN Only Co", pan: "abcde1234f" }, adminToken);
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    const list = await (await get("/api/clients", adminToken)).json() as Array<{id:string; pan:string}>;
    expect(list.find(x => x.id === id)?.pan).toBe("ABCDE1234F");
  });

  it("POST /api/clients — rejects a wrong-length GSTIN", async () => {
    const res = await post("/api/clients", { name: "GST Short Co", gstin: "29ABCDE1234F1Z" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/clients — rejects a structurally invalid GSTIN (15 alnum but wrong layout)", async () => {
    const res = await post("/api/clients", { name: "GST Layout Co", gstin: "ABCDE1234F1Z529" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/clients — rejects a malformed PAN", async () => {
    const res = await post("/api/clients", { name: "PAN Bad Co", pan: "ABCD12345F" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/clients — rejects a GSTIN whose embedded PAN disagrees with the PAN field", async () => {
    const res = await post("/api/clients", { name: "Mismatch Co", gstin: "27AAPFU0939F1ZV", pan: "ZZZZZ9999Z" }, adminToken);
    expect(res.status).toBe(400);
  });

  it("PATCH /api/clients/:id — rejects an invalid GSTIN on update", async () => {
    const created = await (await post("/api/clients", { name: "GST Patch Co" }, adminToken)).json() as { id: string };
    const res = await patch(`/api/clients/${created.id}`, { gstin: "TOOSHORT" }, adminToken);
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════
// ORDERS
// ════════════════════════════════════════════════════════════════════
describe("Orders", () => {
  // Use a seeded order (TST-ORDER-001, DRAFT) for deterministic single-order tests
  const knownOrderId = "TST-ORDER-001";

  it("POST /api/orders — creates order and returns id", async () => {
    const res = await post("/api/orders", {
      client_id: "c1",
      save_as_draft: true,
      notes: "Test order",
      items: [{ sku: "SKU001", name: "Basmati Rice 5kg", qty: 5, unit_price: 450, total: 2250 }],
    }, opsToken);
    expect(ok(res.status)).toBe(true);
    const body = await res.json() as { id: string; status: string };
    expect(body.id).toBeTruthy();
    expect(body.status).toBe("DRAFT");
  });

  it("GET /api/orders — returns order list", async () => {
    const res = await get("/api/orders", opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/orders/:id — returns seeded DRAFT order", async () => {
    const res = await get(`/api/orders/${knownOrderId}`, opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; status: string };
    expect(body.id).toBe(knownOrderId);
    expect(body.status).toBe("DRAFT");
  });

  it("POST /api/orders/:id/transition — DRAFT→SUBMITTED, verify status persists", async () => {
    const res = await post(`/api/orders/${knownOrderId}/transition`, {
      to: "SUBMITTED",
      note: "Submitting test order",
    }, opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; status: string };
    expect(body.status).toBe("SUBMITTED");

    // Verify the DB update persists within the same test
    const check = await get(`/api/orders/${knownOrderId}`, opsToken);
    expect(check.status).toBe(200);
    const checkBody = await check.json() as { status: string };
    expect(checkBody.status).toBe("SUBMITTED");
  });

  it("POST /api/orders/:id/transition — invalid FSM transition returns 400", async () => {
    const res = await post(`/api/orders/${knownOrderId}/transition`, {
      to: "CLOSED",
      note: "Invalid jump from DRAFT",
    }, opsToken);
    expect(res.status).toBe(400);
  });

  it("GET /api/orders — unauthenticated returns 401", async () => {
    const res = await get("/api/orders");
    expect(res.status).toBe(401);
  });

  it("GET /api/orders/:id/comments — returns array", async () => {
    const res = await get(`/api/orders/${knownOrderId}/comments`, opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("POST /api/orders/:id/comments — adds a comment", async () => {
    const res = await post(`/api/orders/${knownOrderId}/comments`, { message: "Test comment" }, opsToken);
    expect(ok(res.status)).toBe(true);
  });
});

describe("Ad-hoc orders (no catalogue selection)", () => {
  // NB: vitest-pool-workers isolates D1 per test, so each test creates its own order.
  const adhocBody = {
    client_id: "__self__",                // overridden server-side to the client's own id
    order_type: "Ad-Hoc",
    notes: "Need 2 crates of imported sparkling water for an event",
    items: [
      { sku: "ADHOC-AAA111", name: "Imported sparkling water 750ml (crate)", qty: 2, unit_price: 0 },
      { sku: "ADHOC-BBB222", name: "Compostable serving cups", qty: 500, unit_price: 0 },
    ],
  };

  it("client places an ad-hoc order without prices → status PENDING_PRICING, total 0", async () => {
    const res = await post("/api/orders", adhocBody, clientToken);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; status: string; grand_total: number };
    expect(body.status).toBe("PENDING_PRICING");
    expect(body.grand_total).toBe(0);
  });

  it("a client role cannot price an ad-hoc order (403)", async () => {
    const id = await post("/api/orders", adhocBody, clientToken).then(r => r.json()).then((b: { id:string }) => b.id);
    const items = await get(`/api/orders/${id}`, clientToken).then(r => r.json()) as { items: Array<{id:string}> };
    const res = await post(`/api/orders/${id}/reprice`, {
      prices: items.items.map(i => ({ id: i.id, unit_price: 100 })),
    }, clientToken);
    expect(res.status).toBe(403);
  });

  it("Ops prices the ad-hoc order → it enters the normal flow with a real total", async () => {
    const id = await post("/api/orders", adhocBody, clientToken).then(r => r.json()).then((b: { id:string }) => b.id);
    const detail = await get(`/api/orders/${id}`, opsToken).then(r => r.json()) as { items: Array<{id:string; qty:number}> };
    const prices = detail.items.map(i => ({ id: i.id, unit_price: 120 }));
    // Priced by an ops_manager — proves the role is authorised to set prices.
    const res = await post(`/api/orders/${id}/reprice`, { prices }, opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; grand_total: number };
    // 2*120 + 500*120 = 60240 subtotal; below the 100000 default threshold → SUBMITTED
    expect(["SUBMITTED", "APPROVED", "PENDING_APPROVAL"]).toContain(body.status);
    expect(body.grand_total).toBeGreaterThan(0);

    // Persisted: no longer awaiting pricing, prices written to line items
    const after = await get(`/api/orders/${id}`, adminToken).then(r => r.json()) as { status: string; items: Array<{unit_price:number}> };
    expect(after.status).not.toBe("PENDING_PRICING");
    expect(after.items.every(i => i.unit_price > 0)).toBe(true);
  });

  it("re-pricing an order that is no longer PENDING_PRICING returns 400", async () => {
    const id = await post("/api/orders", adhocBody, clientToken).then(r => r.json()).then((b: { id:string }) => b.id);
    const detail = await get(`/api/orders/${id}`, adminToken).then(r => r.json()) as { items: Array<{id:string}> };
    // First pricing moves it out of PENDING_PRICING …
    await post(`/api/orders/${id}/reprice`, { prices: detail.items.map(i => ({ id: i.id, unit_price: 120 })) }, adminToken);
    // … so a second attempt is rejected.
    const res = await post(`/api/orders/${id}/reprice`, { prices: detail.items.map(i => ({ id: i.id, unit_price: 130 })) }, adminToken);
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════
// CLIENT CATALOG
// ════════════════════════════════════════════════════════════════════
describe("Client Catalog", () => {
  // c1 catalog is pre-seeded with SKU001+SKU002 in beforeAll

  it("GET /api/clients/c1/catalog — returns seeded items", async () => {
    const res = await get("/api/clients/c1/catalog", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ sku: string }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
    const skus = body.map(i => i.sku);
    expect(skus).toContain("SKU001");
    expect(skus).toContain("SKU002");
  });

  it("POST /api/clients/c1/catalog — returns added count for new SKUs", async () => {
    // Add a new SKU (not yet in catalog)
    const res = await post("/api/clients/c1/catalog", { skus: ["SKU003"] }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { added: number };
    expect(body.added).toBe(1);
  });

  it("GET /api/inventory — client user sees only assigned catalog items", async () => {
    const res = await get("/api/inventory", clientToken);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ sku: string }>;
    const skus = body.map(i => i.sku);
    expect(skus).toContain("SKU001");
    expect(skus).toContain("SKU002");
  });

  it("DELETE /api/clients/c1/catalog/SKU002 — removes SKU and verifies absence", async () => {
    const res = await del("/api/clients/c1/catalog/SKU002", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { removed: string };
    expect(body.removed).toBe("SKU002");

    // Verify removal persists within the same test
    const check = await get("/api/clients/c1/catalog", adminToken);
    expect(check.status).toBe(200);
    const checkBody = await check.json() as Array<{ sku: string }>;
    const skus = checkBody.map(i => i.sku);
    expect(skus).not.toContain("SKU002");
    expect(skus).toContain("SKU001");
  });

  it("POST /api/clients/c1/catalog — client role is forbidden (403)", async () => {
    const res = await post("/api/clients/c1/catalog", { skus: ["SKU002"] }, clientToken);
    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════
// CLIENTS
// ════════════════════════════════════════════════════════════════════
describe("Clients", () => {
  it("GET /api/clients — returns list", async () => {
    const res = await get("/api/clients", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/clients — creates new client", async () => {
    const res = await post("/api/clients", {
      name: "New Client Ltd",
      contact_email: "new@client.test",
    }, adminToken);
    expect(ok(res.status)).toBe(true);
    const body = await res.json() as { id: string };
    expect(body.id).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════
describe("Notifications", () => {
  it("GET /api/notifications — returns array", async () => {
    const res = await get("/api/notifications", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/notifications — unauthenticated returns 401", async () => {
    const res = await get("/api/notifications");
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════
describe("Dashboard", () => {
  it("GET /api/dashboard — ops/admin returns stats object", async () => {
    const res = await get("/api/dashboard", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.totalOrders).toBe("number");
    expect(typeof body.pendingOrders).toBe("number");
    expect(typeof body.lowStock).toBe("number");
  });

  it("GET /api/dashboard — client returns client-specific stats", async () => {
    const res = await get("/api/dashboard", clientToken);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect("recentOrders" in body || "totalSpend" in body).toBe(true);
  });

  it("GET /api/dashboard — unauthenticated returns 401", async () => {
    const res = await get("/api/dashboard");
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════
// CORS & ROUTING
// ════════════════════════════════════════════════════════════════════
describe("CORS & Routing", () => {
  it("OPTIONS returns CORS headers", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/login`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("Unknown /api/ route returns 404", async () => {
    const res = await get("/api/does-not-exist", adminToken);
    expect(res.status).toBe(404);
  });
});
