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
