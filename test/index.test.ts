import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";
// Phase 3 Finance (003-finance-ar) Slice 1 — pure foundations under test.
import {
  istToday, daysBetweenIST, overdueDays, toPaise, fromPaise, formatMoney,
  agingBucket, selectTier, computeDSO, ensureArSchema, DEFAULT_TIER_RULES, SEND_CRON,
  BOOKS_SYNC_CRON, runBooksScheduledDelta,
} from "../src/index";
// Slice 1, Group 2 — Books mirror.
import {
  booksFetch, upsertMirror, mapBooksContact, mapBooksInvoice, mapBooksPayment,
  mapBooksCreditNote, runBooksSync,
} from "../src/index";
// Slice 1, Group 4 — Gmail transport.
import { gmailGetToken, gmailSend } from "../src/index";
// Slice 1, Group 5 — dunning engine.
import { buildStatement, sendStatement, runReminderPass, REMINDER_RULE_SEED } from "../src/index";
import { hashStr } from "../src/index";
import { recomputeArBalances, resolveEffectiveDue, computeArKpis, _arLedger, indianFYRange } from "../src/index";
// P3.2 — Payables (AP).
import { mapBooksBill, mapBooksVendorPayment, runBooksBackfillStep } from "../src/index";
// P3.3 — Reconciliation.
import { runReconciliation } from "../src/index";

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

async function put(path: string, body: unknown, token?: string) {
  return SELF.fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
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

  // Warm the Product Intelligence schema (idempotent self-heal that seeds the
  // FSSAI ingredient_dict) here in setup so the seeded dictionary is part of the
  // baseline every test rolls back to. Otherwise the FIRST test to touch a PI
  // endpoint seeds the dict but flips the module-level `_piSchemaReady` guard —
  // and since isolated-storage rolls that test's writes back while the JS flag
  // persists, later PI tests would fast-path past seeding and see an empty dict.
  await get("/api/catalog/products", adminToken);
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
// INVENTORY IMPORT ROUND-TRIP (Download Current Inventory → amend → re-import)
// ════════════════════════════════════════════════════════════════════
describe("Inventory import round-trip", () => {
  const full = {
    sku: "RT-001", name: "Round Trip Tea", category: "Beverages", sub_category: "Healthy",
    brand: "Tata", stock: 42, unit_price: 180, mrp: 220, cost_excl_gst: 140, gst_rate: 12,
    reorder_level: 15, max_stock: 300, uom: "box", pack_size: 12, units_per_case: 24,
    weight_grams: 250, barcode: "BC-RT-001", vendor_sku: "V-RT-01", vendor_lead_days: 5, vendor_moq: 6,
  };

  it("imports a full-template row and persists EVERY column", async () => {
    const res = await post("/api/import/inventory", [full], adminToken);
    expect(ok(res.status)).toBe(true);
    const inv = await (await get("/api/inventory", adminToken)).json() as Array<Record<string, unknown>>;
    const row = inv.find(i => i.sku === "RT-001")!;
    expect(row).toBeTruthy();
    // Columns the OLD import dropped must now round-trip:
    expect(row.sub_category).toBe("Healthy");
    expect(Number(row.mrp)).toBe(220);
    expect(Number(row.cost_excl_gst)).toBe(140);
    expect(row.uom).toBe("box");
    expect(Number(row.pack_size)).toBe(12);
    expect(Number(row.units_per_case)).toBe(24);
    expect(Number(row.weight_grams)).toBe(250);
    expect(row.barcode).toBe("BC-RT-001");
    expect(row.vendor_sku).toBe("V-RT-01");
    expect(Number(row.vendor_lead_days)).toBe(5);
    expect(Number(row.vendor_moq)).toBe(6);
    // …and the columns it always handled:
    expect(Number(row.stock)).toBe(42);
    expect(Number(row.gst_rate)).toBe(12);
  });

  it("is Super Admin only — a non-super-admin gets 403", async () => {
    const res = await post("/api/import/inventory", [full], opsToken);
    expect(res.status).toBe(403);
  });

  it("a partial re-import updates only provided columns and never wipes the rest", async () => {
    // Seed the full row first (tests get isolated storage), then re-import a
    // partial file with only sku + stock — everything else must be preserved.
    await post("/api/import/inventory", [full], adminToken);
    const res = await post("/api/import/inventory", [{ sku: "RT-001", name: "Round Trip Tea", stock: 7 }], adminToken);
    expect(ok(res.status)).toBe(true);
    const inv = await (await get("/api/inventory", adminToken)).json() as Array<Record<string, unknown>>;
    const row = inv.find(i => i.sku === "RT-001")!;
    expect(Number(row.stock)).toBe(7);          // changed
    expect(row.sub_category).toBe("Healthy");    // preserved
    expect(Number(row.mrp)).toBe(220);           // preserved
    expect(row.barcode).toBe("BC-RT-001");       // preserved
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

  it("GET /api/vendors/paged — q searches the directory and returns the match", async () => {
    await post("/api/vendors", { name: "Zephyr Foods Search Co", category: "Snacks", contact_email: "z@search.test" }, adminToken);
    const data = await (await get(`/api/vendors/paged?q=${encodeURIComponent("Zephyr Foods Search")}`, adminToken)).json() as { rows: { name: string }[]; total: number };
    expect(data.total).toBeGreaterThanOrEqual(1);
    expect(data.rows.some(r => r.name === "Zephyr Foods Search Co")).toBe(true);
  });

  it("GET /api/vendors — enriches each vendor with PO aggregates (spend, po_count, delivered_count, last_order)", async () => {
    const vdb = env.DB as D1Database;
    await vdb.prepare("INSERT OR REPLACE INTO vendors (id,name,category,active) VALUES ('VAG-1','Aggregate Vendor','Beverages',1)").run();
    // Two POs: one delivered (RECEIVED), one still SENT.
    await vdb.prepare("INSERT OR REPLACE INTO purchase_orders (id,vendor_id,status,grand_total,created_at) VALUES ('PO-AG1','VAG-1','RECEIVED',12000,'2026-09-01')").run();
    await vdb.prepare("INSERT OR REPLACE INTO purchase_orders (id,vendor_id,status,grand_total,created_at) VALUES ('PO-AG2','VAG-1','SENT',8000,'2026-09-05')").run();
    // Two catalogue products — their names/SKUs feed the directory brand/item search.
    await vdb.prepare("INSERT OR REPLACE INTO vendor_products (id,vendor_id,sku,name) VALUES ('VP-AG1','VAG-1','SKU-RB','Red Bull Energy 250ml')").run();
    await vdb.prepare("INSERT OR REPLACE INTO vendor_products (id,vendor_id,sku,name) VALUES ('VP-AG2','VAG-1',NULL,'Monster Green')").run();
    const list = await (await get("/api/vendors", adminToken)).json() as Array<Record<string, unknown>>;
    const v = list.find(x => x.id === "VAG-1")!;
    expect(v.po_count).toBe(2);
    expect(v.delivered_count).toBe(1);        // only the RECEIVED PO — drives the "New" rule
    expect(v.spend).toBe(20000);              // committed spend across both POs
    expect(v.last_order).toBe("2026-09-05");  // most recent
    expect(String(v.product_names)).toContain("Red Bull Energy 250ml");  // brand/item search index
    expect(String(v.product_names)).toContain("Monster Green");
    expect(String(v.product_skus)).toContain("SKU-RB");

    // A vendor with no POs reports zeros / null (frontend renders these as "New").
    await vdb.prepare("INSERT OR REPLACE INTO vendors (id,name,category,active) VALUES ('VAG-2','No PO Vendor','Beverages',1)").run();
    const list2 = await (await get("/api/vendors", adminToken)).json() as Array<Record<string, unknown>>;
    const v2 = list2.find(x => x.id === "VAG-2")!;
    expect(v2.po_count).toBe(0);
    expect(v2.delivered_count).toBe(0);
    expect(v2.last_order).toBeNull();
  });

  it("GET /api/vendors — unauthenticated returns 401", async () => {
    const res = await get("/api/vendors");
    expect(res.status).toBe(401);
  });

  it("GET /api/vendors/paged — paginates, clamps, searches by brand/item, and returns meta", async () => {
    const vdb = env.DB as D1Database;
    for (let i = 1; i <= 5; i++) {
      await vdb.prepare("INSERT OR REPLACE INTO vendors (id,name,category,active,rating) VALUES (?,?,?,1,?)")
        .bind("VPG-" + i, "PagedVendor " + i, "Beverages", 5 - i * 0.1).run();
    }
    await vdb.prepare("INSERT OR REPLACE INTO vendor_products (id,vendor_id,name) VALUES ('VPGP-1','VPG-3','Zephyr Cola 500ml')").run();

    const p1 = await (await get("/api/vendors/paged?size=2&page=1&sort=name", adminToken)).json() as
      { rows: Array<{id:string}>; total:number; page:number; pages:number; size:number; meta:{total_vendors:number;categories:string[];avg_on_time:number;at_risk:number} };
    expect(p1.size).toBe(2);
    expect(p1.rows.length).toBe(2);                       // only the page, not all
    expect(p1.total).toBeGreaterThanOrEqual(5);
    expect(p1.pages).toBeGreaterThanOrEqual(3);
    expect(p1.meta.total_vendors).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(p1.meta.categories)).toBe(true);

    // Page beyond the last is clamped to the last page.
    const pLast = await (await get("/api/vendors/paged?size=2&page=999", adminToken)).json() as {page:number;pages:number};
    expect(pLast.page).toBe(pLast.pages);

    // Full-text search matches a catalogue item name via vendor_products.
    const s = await (await get("/api/vendors/paged?q=zephyr", adminToken)).json() as {rows:Array<{id:string}>;total:number};
    expect(s.total).toBeGreaterThanOrEqual(1);
    expect(s.rows.some(r => r.id === "VPG-3")).toBe(true);
  });

  it("GET /api/vendors/paged — unauthenticated returns 401", async () => {
    expect((await get("/api/vendors/paged")).status).toBe(401);
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

  it("POST /api/import/vendors — imports compliance columns (GSTIN, PAN, FSSAI, vendor_type, notes) and auto-assigns a vendor_code", async () => {
    const res = await post("/api/import/vendors", { rows: [{
      name: "Import Compliance Co", category: "Beverages", vendor_type: "food",
      registration_type: "registered", gstin: "27aapfu0939f1zv",
      fssai_licence: "12345678901234", fssai_expiry: "2027-03-31",
      payment_terms: "Net 30", contact_email: "imp@compliance.test",
      visit_frequency: "Weekly", notes: "Cold-chain certified",
    }] }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: number; warnings: string[] };
    expect(body.success).toBe(1);
    const v = (await (await get("/api/vendors", adminToken)).json() as Array<Record<string,unknown>>)
      .find(x => x.name === "Import Compliance Co")!;
    expect(v.gstin).toBe("27AAPFU0939F1ZV");
    expect(v.pan).toBe("AAPFU0939F");               // derived from GSTIN
    expect(v.vendor_type).toBe("food");
    expect(v.fssai_licence).toBe("12345678901234");
    expect(v.notes).toBe("Cold-chain certified");
    expect(String(v.vendor_code)).toMatch(/^VDR-\d{4}-\d{5}$/);
  });

  it("POST /api/import/vendors — a bad GSTIN is lenient: vendor imports, field left blank, warning returned", async () => {
    const res = await post("/api/import/vendors", { rows: [{
      name: "Bad GST Import", category: "Grocery", gstin: "NOTAGSTIN",
    }] }, adminToken);
    const body = await res.json() as { success: number; warnings: string[] };
    expect(body.success).toBe(1);
    expect(body.warnings.length).toBeGreaterThanOrEqual(1);
    const v = (await (await get("/api/vendors", adminToken)).json() as Array<Record<string,unknown>>)
      .find(x => x.name === "Bad GST Import")!;
    expect(v.gstin).toBeNull();
  });

  it("POST /api/import/vendors — matches by vendor_code and blank cells never overwrite existing data", async () => {
    const vdb = env.DB as D1Database;
    await vdb.prepare("INSERT OR REPLACE INTO vendors (id,vendor_code,name,category,notes,active) VALUES ('VIMP-1','VDR-2099-00001','Round Trip Co','Grocery','keep me',1)").run();
    // Re-upload with overwrite, same code but blank notes and a new phone.
    const res = await post("/api/import/vendors", { overwrite: true, rows: [{
      vendor_code: "VDR-2099-00001", name: "Round Trip Renamed", category: "Grocery",
      contact_phone: "9000000000", notes: "",
    }] }, adminToken);
    expect(res.status).toBe(200);
    const v = (await (await get("/api/vendors", adminToken)).json() as Array<Record<string,unknown>>)
      .find(x => x.id === "VIMP-1")!;
    expect(v.name).toBe("Round Trip Renamed");   // matched by code, updated in place
    expect(v.contact_phone).toBe("9000000000");  // new value written
    expect(v.notes).toBe("keep me");             // blank cell did NOT wipe existing note
  });
});

describe("Admin — purge all POs (test-data cleanup)", () => {
  it("POST /api/admin/purge-pos — requires confirm, then deletes every PO + line items", async () => {
    const vdb = env.DB as D1Database;
    await vdb.prepare("INSERT OR REPLACE INTO vendors (id,name,category,active) VALUES ('VP-1','Purge Vendor','Beverages',1)").run();
    await vdb.prepare("INSERT OR REPLACE INTO purchase_orders (id,vendor_id,status,grand_total) VALUES ('PO-PURGE1','VP-1','SENT',5000)").run();
    await vdb.prepare("INSERT OR REPLACE INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES ('PI-1','PO-PURGE1','SKU1','Item',2,100,200)").run();

    // Without confirm the destructive action is refused and nothing is deleted.
    const noConfirm = await post("/api/admin/purge-pos", {}, adminToken);
    expect(noConfirm.status).toBe(400);
    const stillThere = await vdb.prepare("SELECT COUNT(*) AS n FROM purchase_orders WHERE id='PO-PURGE1'").first() as {n:number};
    expect(stillThere.n).toBe(1);

    const res = await post("/api/admin/purge-pos", { confirm: true }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: number };
    expect(body.deleted).toBeGreaterThanOrEqual(1);

    const pos = await (await get("/api/purchase-orders", adminToken)).json() as unknown[];
    expect(pos.length).toBe(0);                              // every PO gone
    const items = await vdb.prepare("SELECT COUNT(*) AS n FROM po_items").first() as {n:number};
    expect(items.n).toBe(0);                                 // and their line items
    const seq = await vdb.prepare("SELECT value FROM app_config WHERE key='po_seq'").first() as {value:string}|null;
    expect(seq?.value).toBe("0");                            // numbering reset → next PO is PO-00001
  });
});

describe("Admin — hard-delete orders (test-data cleanup)", () => {
  it("POST /api/orders/purge — super-admin only, cascades children, and guards billed orders", async () => {
    const vdb = env.DB as D1Database;
    // A clean test order with items + a scheduled challan (safe to purge).
    await vdb.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,grand_total,subtotal,gst) VALUES ('ORD-PURGE1','CL-1','tst-admin','DRAFT',1000,900,100)").run();
    await vdb.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('OI-P1','ORD-PURGE1','SKU1','Item',2,450,900)").run();
    await vdb.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('DC-PURGE1','ORD-PURGE1','SCHEDULED',2,'990001')").run();
    await vdb.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('DCI-P1','DC-PURGE1','SKU1','Item',2,0)").run();

    // A protected order — has a billed challan — must NOT be deletable.
    await vdb.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,grand_total) VALUES ('ORD-KEEP1','CL-1','tst-admin','DELIVERED',2000)").run();
    await vdb.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,billed) VALUES ('DC-KEEP1','ORD-KEEP1','DELIVERED',1,1)").run();

    // A client user may not purge.
    const forbidden = await post("/api/orders/purge", { ids: ["ORD-PURGE1"] }, clientToken);
    expect(forbidden.status).toBe(403);
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM orders WHERE id='ORD-PURGE1'").first() as {n:number}).n).toBe(1);

    const res = await post("/api/orders/purge", { ids: ["ORD-PURGE1", "ORD-KEEP1"] }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { deleted: number; blocked: number; results: {id:string;deleted:boolean;reason?:string}[] };
    expect(body.deleted).toBe(1);
    expect(body.blocked).toBe(1);

    // The clean order and every child row are gone.
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM orders WHERE id='ORD-PURGE1'").first() as {n:number}).n).toBe(0);
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM order_items WHERE order_id='ORD-PURGE1'").first() as {n:number}).n).toBe(0);
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM delivery_challans WHERE order_id='ORD-PURGE1'").first() as {n:number}).n).toBe(0);
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM dc_items WHERE dc_id='DC-PURGE1'").first() as {n:number}).n).toBe(0);

    // The protected order survived, with an explanatory reason.
    expect((await vdb.prepare("SELECT COUNT(*) AS n FROM orders WHERE id='ORD-KEEP1'").first() as {n:number}).n).toBe(1);
    const keep = body.results.find(r => r.id === "ORD-KEEP1");
    expect(keep?.deleted).toBe(false);
    expect(keep?.reason).toMatch(/billed/);
  });
});

describe("Document branding config", () => {
  it("GET is open to any authed user; POST is super-admin only and persists fields", async () => {
    // Any authenticated user may read the branding (client-side exports need it).
    const asClient = await get("/api/branding", clientToken);
    expect(asClient.status).toBe(200);

    // A client user may not change it.
    const forbidden = await post("/api/branding", { company_name: "Hacked" }, clientToken);
    expect(forbidden.status).toBe(403);

    // Super admin sets fields and they persist.
    const save = await post("/api/branding", { company_name: "4SYZ Foods", gstin: "29ABCDE1234F1Z5", accent: "#0a3d62" }, adminToken);
    expect(save.status).toBe(200);
    const body = await save.json() as Record<string,string>;
    expect(body.company_name).toBe("4SYZ Foods");
    expect(body.gstin).toBe("29ABCDE1234F1Z5");

    const after = await (await get("/api/branding", adminToken)).json() as Record<string,string>;
    expect(after.company_name).toBe("4SYZ Foods");
    expect(after.accent).toBe("#0a3d62");
  });
});

describe("DC Number Series (Phase 0)", () => {
  it("currentFY + dcClassForCategory map correctly", () => {
    expect(currentFY(new Date("2026-09-12T00:00:00Z"))).toBe("2026-27"); // Apr–Mar FY
    expect(currentFY(new Date("2027-02-15T00:00:00Z"))).toBe("2026-27"); // Jan–Mar → prior FY
    expect(currentFY(new Date("2027-04-01T00:00:00Z"))).toBe("2027-28"); // 1 April rolls over
    expect(dcClassForCategory("Consumables")).toBe("CONSUMABLE");
    expect(dcClassForCategory("Non-Returnable")).toBe("CONSUMABLE");
    expect(dcClassForCategory("Gifting")).toBe("GIFTING");
    expect(dcClassForCategory("Returnable-Sample")).toBe("GIFTING");
    expect(dcClassForCategory("whatever")).toBe("CONSUMABLE"); // fallback
  });

  it("migrateSeedDCSeries seeds the current FY once (guarded), continuing 700932 / 80055", async () => {
    await env.DB.prepare("DELETE FROM dc_series").run();
    await env.DB.prepare("DELETE FROM app_config WHERE key='dc_series_seeded'").run();
    await migrateSeedDCSeries(env);
    const fy = currentFY();
    const rows = await env.DB.prepare("SELECT class,last_no,status FROM dc_series WHERE fy=? ORDER BY class").bind(fy).all();
    expect(rows.results.length).toBe(2);
    const cons = (rows.results as Array<Record<string,unknown>>).find(r => r.class === "CONSUMABLE")!;
    const gift = (rows.results as Array<Record<string,unknown>>).find(r => r.class === "GIFTING")!;
    expect(cons.last_no).toBe(700932);
    expect(gift.last_no).toBe(80055);
    const flag = await env.DB.prepare("SELECT value FROM app_config WHERE key='dc_series_seeded'").first() as {value:string};
    expect(flag.value).toBe("1"); // guard set → won't re-run
  });

  it("GET /api/dc-series lists the active series + allocate issues category-aware numbers", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();

    const list = await (await get("/api/dc-series", adminToken)).json() as {current_fy:string;needs_series:boolean;series:unknown[]};
    expect(list.current_fy).toBe(fy);
    expect(list.needs_series).toBe(false);

    // Consumables + Non-Returnable share the 7xxxxx series and increment together.
    const a1 = await (await post("/api/dc-series/allocate", { category: "Consumables" }, adminToken)).json() as {number:number;class:string};
    expect(a1.number).toBe(700933);
    expect(a1.class).toBe("CONSUMABLE");
    const a2 = await (await post("/api/dc-series/allocate", { category: "Non-Returnable" }, adminToken)).json() as {number:number};
    expect(a2.number).toBe(700934);

    // Gifting + Returnable-Sample share the 8xxxxx series.
    const g1 = await (await post("/api/dc-series/allocate", { category: "Gifting" }, adminToken)).json() as {number:number};
    expect(g1.number).toBe(80056);
    const g2 = await (await post("/api/dc-series/allocate", { category: "Returnable-Sample" }, adminToken)).json() as {number:number};
    expect(g2.number).toBe(80057);
  });

  it("POST /api/dc-series/start-fy validates and (re)opens a series; allocate 409s with no active series", async () => {
    const fy = currentFY();
    const bad = await post("/api/dc-series/start-fy", { fy: "2026", consumable_start: 700001, gifting_start: 80001 }, adminToken);
    expect(bad.status).toBe(400);

    // No series for the current FY → allocate returns 409 (the "start series" prompt).
    await env.DB.prepare("DELETE FROM dc_series").run();
    const none = await post("/api/dc-series/allocate", { category: "Consumables" }, adminToken);
    expect(none.status).toBe(409);

    // Start the FY series, then allocation resumes from the configured start.
    const ok = await post("/api/dc-series/start-fy", { fy, consumable_start: 700001, gifting_start: 80001 }, adminToken);
    expect(ok.status).toBe(200);
    const a = await (await post("/api/dc-series/allocate", { category: "Consumables" }, adminToken)).json() as {number:number};
    expect(a.number).toBe(700001); // first DC of the series
  });
});

describe("Ad-hoc DC (Phase 1)", () => {
  it("creates a challan-first DC numbered from the FY series and lists it", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();

    const res = await post("/api/delivery-challans/ad-hoc",
      { category: "Consumables", client_name: "Indus Foods", items_text: "Water 20L ×40", delivery_person: "Ravi" }, adminToken);
    expect(res.status).toBe(201);
    const dc = await res.json() as { dc_number: string; class: string };
    expect(dc.dc_number).toBe("700933");      // continues the 7xxxxx series
    expect(dc.class).toBe("CONSUMABLE");

    // Returnable-Sample draws from the 8xxxxx series.
    const g = await (await post("/api/delivery-challans/ad-hoc",
      { category: "Returnable-Sample", client_name: "Marina Retail", items_text: "Sampler ×6" }, adminToken)).json() as { dc_number: string; class: string };
    expect(g.dc_number).toBe("80056");
    expect(g.class).toBe("GIFTING");

    const list = await (await get("/api/delivery-challans/ad-hoc", adminToken)).json() as Array<{dc_number:string;client_name:string}>;
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some(d => d.dc_number === "700933" && d.client_name === "Indus Foods")).toBe(true);

    // The row is stored as an ad-hoc challan with no order behind it.
    const row = await env.DB.prepare("SELECT ad_hoc, order_id, dc_class FROM delivery_challans WHERE dc_number='700933'").first() as {ad_hoc:number;order_id:string;dc_class:string};
    expect(row.ad_hoc).toBe(1);
    expect(row.order_id).toBe("");
    expect(row.dc_class).toBe("CONSUMABLE");
  });

  it("requires client + category and 409s when the FY series is not set up", async () => {
    const noClient = await post("/api/delivery-challans/ad-hoc", { category: "Consumables" }, adminToken);
    expect(noClient.status).toBe(400);
    await env.DB.prepare("DELETE FROM dc_series").run();
    const noSeries = await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "X" }, adminToken);
    expect(noSeries.status).toBe(409);
  });
});

describe("DC Billing (Phase 2)", () => {
  it("lists pending (excluding returnables), marks billed, and records reminders", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();

    const c = await (await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "Indus", items_text: "Water" }, adminToken)).json() as { id: string };
    // A returnable sample must NOT appear in pending billing (invoice N/A).
    await post("/api/delivery-challans/ad-hoc", { category: "Returnable-Sample", client_name: "Marina", items_text: "Sampler" }, adminToken);

    const pend = await (await get("/api/dc-billing/pending", adminToken)).json() as { rows: Array<{id:string;dc_number:string;days_pending:number}>; total:number };
    expect(pend.rows.some(r => r.id === c.id)).toBe(true);
    expect(pend.rows.some(r => r.dc_number === "80056")).toBe(false);
    expect(typeof pend.rows.find(r => r.id === c.id)!.days_pending).toBe("number");

    // Mark billed requires an invoice number.
    expect((await post(`/api/dc-billing/${c.id}/bill`, {}, adminToken)).status).toBe(400);
    expect((await post(`/api/dc-billing/${c.id}/bill`, { invoice_no: "INV-2026-1", invoice_date: "2026-09-12" }, adminToken)).status).toBe(200);

    // Now removed from pending; billed flag + invoice recorded.
    const pend2 = await (await get("/api/dc-billing/pending", adminToken)).json() as { rows: Array<{id:string}> };
    expect(pend2.rows.some(r => r.id === c.id)).toBe(false);
    const row = await env.DB.prepare("SELECT billed, invoice_no FROM delivery_challans WHERE id=?").bind(c.id).first() as { billed:number; invoice_no:string };
    expect(row.billed).toBe(1);
    expect(row.invoice_no).toBe("INV-2026-1");

    // Reminder stamps reminder_sent_at.
    const c2 = await (await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "Orbit", items_text: "Tea" }, adminToken)).json() as { id: string };
    expect((await post(`/api/dc-billing/${c2.id}/remind`, {}, adminToken)).status).toBe(200);
    const r2 = await env.DB.prepare("SELECT reminder_sent_at FROM delivery_challans WHERE id=?").bind(c2.id).first() as { reminder_sent_at:string|null };
    expect(r2.reminder_sent_at).toBeTruthy();
  });
});

describe("DC Samples + Recurring (Phase 3)", () => {
  it("tracks returnable samples out → returned", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();
    const s = await (await post("/api/delivery-challans/ad-hoc", { category: "Returnable-Sample", client_name: "Marina", items_text: "Sampler ×6" }, adminToken)).json() as { id: string };

    const before = await (await get("/api/dc-samples", adminToken)).json() as { out:number; rows: Array<{id:string;sample_returned_at:string|null}> };
    expect(before.out).toBeGreaterThanOrEqual(1);
    expect(before.rows.some(r => r.id === s.id && !r.sample_returned_at)).toBe(true);

    expect((await post(`/api/dc-samples/${s.id}/return`, {}, adminToken)).status).toBe(200);
    const after = await (await get("/api/dc-samples", adminToken)).json() as { rows: Array<{id:string;sample_returned_at:string|null}> };
    expect(after.rows.find(r => r.id === s.id)!.sample_returned_at).toBeTruthy();
  });

  it("recurring schedule generates an ad-hoc DC numbered from the series; pause blocks it", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();

    expect((await post("/api/dc-recurring", { client_name: "Indus", category: "Consumables", frequency: "Daily" }, adminToken)).status).toBe(400);
    const c = await (await post("/api/dc-recurring", { client_name: "Indus", category: "Consumables", frequency: "Weekly", items_text: "Water" }, adminToken)).json() as { id: string };

    const gen = await (await post(`/api/dc-recurring/${c.id}/generate`, {}, adminToken)).json() as { dc_number: string };
    expect(gen.dc_number).toBe("700933");
    const row = await env.DB.prepare("SELECT ad_hoc, notes, client_name FROM delivery_challans WHERE dc_number='700933'").first() as { ad_hoc:number; notes:string; client_name:string };
    expect(row.ad_hoc).toBe(1);
    expect(row.notes).toContain("Auto-generated");
    expect(row.client_name).toBe("Indus");

    expect((await patch(`/api/dc-recurring/${c.id}`, { active: false }, adminToken)).status).toBe(200);
    expect((await post(`/api/dc-recurring/${c.id}/generate`, {}, adminToken)).status).toBe(400); // paused
  });
});

describe("DC Route Planner (Phase 4)", () => {
  it("lists out-for-delivery candidates and builds a numbered stop sequence", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    const a = await (await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "Indus Foods", items_text: "Water" }, adminToken)).json() as { id: string; dc_number: string };
    const b = await (await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "Orbit", items_text: "Tea" }, adminToken)).json() as { id: string; dc_number: string };

    const cands = await (await get("/api/dc-routes/candidates", adminToken)).json() as Array<{id:string}>;
    expect(cands.some(c => c.id === a.id)).toBe(true);
    expect(cands.some(c => c.id === b.id)).toBe(true);

    expect((await post("/api/dc-routes", { dc_ids: [] }, adminToken)).status).toBe(400);

    const route = await (await post("/api/dc-routes", { dc_ids: [b.id, a.id], route_date: "2026-09-13", delivery_person: "Ravi" }, adminToken)).json() as
      { id: string; stops: Array<{seq:number;dc_number:string;client:string;maps:string}> };
    expect(route.stops.length).toBe(2);
    expect(route.stops[0].seq).toBe(1);
    expect(route.stops[0].dc_number).toBe(b.dc_number);      // caller's order preserved
    expect(route.stops[1].dc_number).toBe(a.dc_number);
    expect(route.stops[0].maps).toContain("google.com/maps");
    expect(route.stops[0].maps).toContain("Orbit");

    const list = await (await get("/api/dc-routes", adminToken)).json() as Array<{id:string;stops:unknown[]}>;
    const saved = list.find(r => r.id === route.id)!;
    expect(Array.isArray(saved.stops)).toBe(true);
    expect(saved.stops.length).toBe(2);
  });
});

describe("DC historical import (Phase 5)", () => {
  it("imports DCs at their real numbers, advances the series, and skips duplicates", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();

    const res = await post("/api/dc-import", { rows: [
      { dc_number: "700950", category: "Consumables", client_name: "Nimbus", items_text: "Sugar", date: "2026-05-04", billed: "true", invoice_no: "INV-1" },
      { dc_number: "80010", category: "Returnable-Sample", client_name: "Marina" },
      { dc_number: "", category: "Consumables", client_name: "NoNum" },      // error — no dc_number
    ] }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: number; failed: number };
    expect(body.success).toBe(2);
    expect(body.failed).toBe(1);

    const row = await env.DB.prepare("SELECT ad_hoc, dc_class, billed, invoice_no FROM delivery_challans WHERE dc_number='700950'").first() as { ad_hoc:number; dc_class:string; billed:number; invoice_no:string };
    expect(row.ad_hoc).toBe(1);
    expect(row.dc_class).toBe("CONSUMABLE");
    expect(row.billed).toBe(1);
    expect(row.invoice_no).toBe("INV-1");

    // Series advanced past the imported number → next consumable allocation is 700951.
    const a = await (await post("/api/dc-series/allocate", { category: "Consumables" }, adminToken)).json() as { number: number };
    expect(a.number).toBe(700951);

    // A re-import of the same number is skipped (no overwrite).
    const dup = await (await post("/api/dc-import", { rows: [{ dc_number: "700950", category: "Consumables", client_name: "Dup" }] }, adminToken)).json() as { skipped: number };
    expect(dup.skipped).toBe(1);
  });
});

describe("DC Reports (Phase 6)", () => {
  it("by_client / pending / range / by_month reports over a date range", async () => {
    const fy = currentFY();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'CONSUMABLE',7,700001,700932,'ACTIVE')").bind(fy).run();
    await env.DB.prepare("INSERT OR REPLACE INTO dc_series (fy,class,prefix,start_no,last_no,status) VALUES (?, 'GIFTING',8,80001,80055,'ACTIVE')").bind(fy).run();
    const c1 = await (await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "RepCo", items_text: "Water" }, adminToken)).json() as { id: string };
    await post("/api/delivery-challans/ad-hoc", { category: "Consumables", client_name: "RepCo", items_text: "Sugar" }, adminToken);
    await post("/api/delivery-challans/ad-hoc", { category: "Returnable-Sample", client_name: "RepCo", items_text: "Sampler" }, adminToken);
    await post(`/api/dc-billing/${c1.id}/bill`, { invoice_no: "INV-9" }, adminToken);

    const from = "2000-01-01", to = "2999-12-31";
    const byc = await (await get(`/api/dc-reports?type=by_client&from=${from}&to=${to}`, adminToken)).json() as { rows: Array<Record<string, number|string>> };
    const rep = byc.rows.find(r => r.client_name === "RepCo")!;
    expect(rep.total).toBe(3);
    expect(rep.billed).toBe(1);
    expect(rep.unbilled).toBe(1);   // the unbilled consumable (returnable excluded)
    expect(rep.samples).toBe(1);

    const pend = await (await get(`/api/dc-reports?type=pending&from=${from}&to=${to}`, adminToken)).json() as { rows: Array<{client_name:string}> };
    expect(pend.rows.filter(r => r.client_name === "RepCo").length).toBe(1);

    const range = await (await get(`/api/dc-reports?type=range&from=${from}&to=${to}`, adminToken)).json() as { rows: Array<{client_name:string}> };
    expect(range.rows.filter(r => r.client_name === "RepCo").length).toBe(3);

    const bym = await (await get(`/api/dc-reports?type=by_month&from=${from}&to=${to}`, adminToken)).json() as { rows: Array<{total:number}> };
    expect(bym.rows.reduce((s, r) => s + Number(r.total), 0)).toBeGreaterThanOrEqual(3);
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

  it("POST /api/orders — GST is summed per item across mixed slabs, not a flat 18%", async () => {
    const db = env.DB as D1Database;
    // Two products on different GST slabs (5% and 40%).
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)")
      .bind("GSTA", "GST Item A", "Grocery", 1000, 50, 1, 5).run();
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)")
      .bind("GSTB", "GST Item B", "Beverages", 1000, 50, 1, 40).run();
    const res = await post("/api/orders", {
      client_id: "c1",
      items: [
        { sku: "GSTA", name: "GST Item A", qty: 2, unit_price: 1000 }, // 2000 @ 5%  = 100
        { sku: "GSTB", name: "GST Item B", qty: 1, unit_price: 1000 }, // 1000 @ 40% = 400
      ],
    }, opsToken);
    expect(ok(res.status)).toBe(true);
    const { id } = await res.json() as { id: string };
    const row = await db.prepare("SELECT subtotal,gst,grand_total FROM orders WHERE id=?").bind(id).first() as { subtotal: number; gst: number; grand_total: number };
    expect(Number(row.subtotal)).toBe(3000);
    expect(Number(row.gst)).toBe(500);         // 100 + 400 — NOT a flat 3000*0.18 = 540
    expect(Number(row.grand_total)).toBe(3500);
    await db.prepare("DELETE FROM inventory WHERE sku IN ('GSTA','GSTB')").run();
  });

  it("per-item delivery status — gated by client flag, ops-only, client-visible", async () => {
    const db = env.DB as D1Database;
    // Place an order for c1 with one line.
    const created = await post("/api/orders", {
      client_id: "c1", save_as_draft: true,
      items: [{ sku: "SKU001", name: "Basmati Rice 5kg", qty: 5, unit_price: 450 }],
    }, opsToken);
    const orderId = (await created.json() as { id: string }).id;
    const itemId = (await db.prepare("SELECT id FROM order_items WHERE order_id=? LIMIT 1").bind(orderId).first() as { id: string }).id;
    const delayPath = `/api/orders/${orderId}/items/${itemId}/delay`;
    const payload = { line_status: "delayed", line_eta: "2026-09-30", delay_reason: "Vendor stock delay", line_note: "offering Daawat" };

    // Flag OFF (default): the endpoint refuses.
    await patch("/api/clients/c1", { delay_tracking_enabled: 0 }, adminToken);
    expect((await patch(delayPath, payload, opsToken)).status).toBe(403);

    // Enable for c1, then ops can set the line status.
    await patch("/api/clients/c1", { delay_tracking_enabled: 1 }, adminToken);
    const set = await patch(delayPath, payload, opsToken);
    expect(set.status).toBe(200);

    // Client cannot set their own line status even when enabled.
    expect((await patch(delayPath, payload, clientToken)).status).toBe(403);

    // Stored + surfaced on the order (incl. the client-visible flag).
    const detail = await (await get(`/api/orders/${orderId}`, opsToken)).json() as {
      client_delay_tracking: number; items: Array<{ id: string; line_status: string; line_eta: string; delay_reason: string; line_note: string }>;
    };
    expect(Number(detail.client_delay_tracking)).toBe(1);
    const line = detail.items.find(i => i.id === itemId)!;
    expect(line.line_status).toBe("delayed");
    expect(line.line_eta).toBe("2026-09-30");
    expect(line.delay_reason).toBe("Vendor stock delay");
    expect(line.line_note).toBe("offering Daawat");

    // Restore default so later tests are unaffected.
    await patch("/api/clients/c1", { delay_tracking_enabled: 0 }, adminToken);
  });

  it("dispatch transition is idempotent — a repeated click creates only ONE delivery challan", async () => {
    const db = env.DB as D1Database;
    const oid = "TST-SHIP-DEDUP";
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES (?,?,?,?,?,?,?,?)")
      .bind(oid, "c1", "tst-ops", "QUALITY_CHECK", 2250, 405, 2655, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("tst-ship-oi1", oid, "SKU001", "Basmati Rice 5kg", 5, 450, 2250).run();
    // Fire the same dispatch transition twice at once (double-click / retry).
    await Promise.all([
      post(`/api/orders/${oid}/transition`, { to: "IN_SHIPMENT" }, opsToken),
      post(`/api/orders/${oid}/transition`, { to: "IN_SHIPMENT" }, opsToken),
    ]);
    const dc = await db.prepare("SELECT COUNT(*) c FROM delivery_challans WHERE order_id=?").bind(oid).first() as { c: number };
    expect(Number(dc.c)).toBe(1); // exactly one challan, not two
    await db.prepare("DELETE FROM dc_items WHERE dc_id IN (SELECT id FROM delivery_challans WHERE order_id=?)").bind(oid).run();
    await db.prepare("DELETE FROM delivery_challans WHERE order_id=?").bind(oid).run();
  });

  it("order-status-change notification is private to the actor, not broadcast to every login", async () => {
    const db = env.DB as D1Database;
    const oid = "TST-NOTIF-PRIV";
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES (?,?,?,?,?,?,?,?)")
      .bind(oid, "c1", "tst-ops", "APPROVED", 1000, 180, 1180, "Regular").run();
    // ops moves the order forward — this fires the generic status-change notice.
    const tr = await post(`/api/orders/${oid}/transition`, { to: "ACKNOWLEDGED" }, opsToken);
    expect(tr.status).toBe(200);
    const seenBy = async (token: string) => {
      const r = await get("/api/notifications", token);
      const list = await r.json() as { message: string }[];
      return list.some(n => (n.message || "").includes(oid));
    };
    expect(await seenBy(opsToken)).toBe(true);    // the actor sees their own status change
    expect(await seenBy(adminToken)).toBe(false); // a different login does NOT
    expect(await seenBy(clientToken)).toBe(false);
    await db.prepare("DELETE FROM notifications WHERE message LIKE ?").bind(`%${oid}%`).run();
  });

  it("Zoho merge-apply re-points a client assignment from the seed SKU to the matched Zoho twin", async () => {
    const db = env.DB as D1Database;
    // A seed item (non-Zoho) and its Zoho twin sharing a normalised name, plus a
    // client assignment sitting on the seed SKU.
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,active) VALUES (?,?,?,?,1)")
      .bind("SEED-MRG1", "Widget Alpha MRP 10", "Snacks", 100).run();
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,active,zoho_item_id,zoho_synced_at) VALUES (?,?,?,?,1,?,?)")
      .bind("ZOHO-MRG1", "Widget Alpha", "Snacks", 120, "zid-mrg-1", "2026-09-27T00:00:00Z").run();
    await db.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
      .bind("c1", "SEED-MRG1", "tst").run();

    const res = await post("/api/integrations/zoho-inventory/merge-apply", { dryRun: false, scope: "assigned", minScore: 1 }, adminToken);
    expect(res.status).toBe(200);

    // The client now points at the Zoho SKU; the seed assignment is gone.
    const moved = await db.prepare("SELECT 1 FROM client_catalog WHERE client_id='c1' AND sku='ZOHO-MRG1'").first();
    expect(moved).toBeTruthy();
    const old = await db.prepare("SELECT 1 FROM client_catalog WHERE client_id='c1' AND sku='SEED-MRG1'").first();
    expect(old).toBeFalsy();
    // The seed duplicate is deactivated, the Zoho row untouched.
    const seedRow = await db.prepare("SELECT active FROM inventory WHERE sku='SEED-MRG1'").first() as { active: number };
    expect(Number(seedRow.active)).toBe(0);
    const zohoRow = await db.prepare("SELECT active FROM inventory WHERE sku='ZOHO-MRG1'").first() as { active: number };
    expect(Number(zohoRow.active)).toBe(1);

    await db.prepare("DELETE FROM client_catalog WHERE sku IN ('SEED-MRG1','ZOHO-MRG1')").run();
    await db.prepare("DELETE FROM inventory WHERE sku IN ('SEED-MRG1','ZOHO-MRG1')").run();
  });

  it("bulk import updates existing SKUs beyond the 90-var IN() chunk (upsert regression)", async () => {
    const db = env.DB as D1Database;
    const N = 120; // > D1_IN_CHUNK (90): the existing-SKU lookup must chunk, not throw
    const seed: D1PreparedStatement[] = [];
    for (let i = 0; i < N; i++) seed.push(db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,active) VALUES (?,?,?,?,1)").bind(`BULKUP-${i}`, `Old ${i}`, "Snacks", 10));
    await db.batch(seed);
    const rows = Array.from({ length: N }, (_, i) => ({ sku: `BULKUP-${i}`, name: `New ${i}`, category: "Snacks", unit_price: 20 }));
    const res = await post("/api/import/inventory", rows, adminToken);
    expect(res.status).toBe(200);
    // A row well past the 90th must have been UPDATED, not silently ignored.
    const row = await db.prepare("SELECT name FROM inventory WHERE sku='BULKUP-119'").first() as { name: string };
    expect(row.name).toBe("New 119");
    await db.prepare("DELETE FROM inventory WHERE sku LIKE 'BULKUP-%'").run();
  });

  it("assign-zoho-catalog bulk-assigns active Zoho items to a client", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,active,zoho_synced_at) VALUES (?,?,?,?,1,?)")
      .bind("ZASG-1", "Zoho Assign Item", "Snacks", 50, "2026-09-27T00:00:00Z").run();
    const res = await post("/api/clients/c1/assign-zoho-catalog", {}, adminToken);
    expect(res.status).toBe(200);
    const row = await db.prepare("SELECT 1 FROM client_catalog WHERE client_id='c1' AND sku='ZASG-1'").first();
    expect(row).toBeTruthy();
    await db.prepare("DELETE FROM client_catalog WHERE sku='ZASG-1'").run();
    await db.prepare("DELETE FROM inventory WHERE sku='ZASG-1'").run();
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

describe("Vendor PO linked to a shortage order", () => {
  it("raising a PO with order_id moves the order INVENTORY_CHECK → VENDOR_PO_RAISED", async () => {
    const db = env.DB as D1Database;
    const oid = "TST-PO-LINK-1";
    // Seed an order sitting in INVENTORY_CHECK (the state where Ops raises a PO).
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES (?,?,?,?,?,?,?,?)")
      .bind(oid, "c1", "tst-ops", "INVENTORY_CHECK", 1000, 180, 1180, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("tst-poi-1", oid, "SKU001", "Basmati Rice 5kg", 10, 100, 1000).run();

    const res = await post("/api/purchase-orders", {
      vendor_id: "v1",
      order_id: oid,
      items: [{ sku: "SKU001", name: "Basmati Rice 5kg", qty: 10, unit_price: 90 }],
      expected_delivery: "2026-08-01",
    }, adminToken);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string };
    expect(body.id).toBeTruthy();

    // The linked order is now awaiting the vendor.
    const after = await get(`/api/orders/${oid}`, adminToken).then(r => r.json()) as { status: string };
    expect(after.status).toBe("VENDOR_PO_RAISED");
  });

  it("a standalone PO (no order_id) is still created and touches no order", async () => {
    const res = await post("/api/purchase-orders", {
      vendor_id: "v1",
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 5, unit_price: 120 }],
    }, adminToken);
    expect(res.status).toBe(201);
  });
});

describe("Consolidated order report (by product)", () => {
  // Two clients each ordering 10 Coke in May → Coke: 20 ordered, 2 clients.
  async function seedCoke(db: D1Database) {
    await db.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,?)").bind("c2", "Emerald Global", 1).run();
    for (const [oid, cid] of [["OC-1", "c1"], ["OC-2", "c2"]] as const) {
      await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(oid, cid, "tst-ops", "SUBMITTED", 150, 27, 177, "Regular", "2026-05-15 10:00:00").run();
      await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
        .bind("oi-" + oid, oid, "COKE", "Coca-Cola 300ml", 10, 15, 150).run();
    }
  }

  it("rolls up one product across two clients (10 + 10 = 20 ordered, 2 clients, 2 orders)", async () => {
    await seedCoke(env.DB as D1Database);
    const res = await get("/api/reports/order-consolidation?from=2026-05-01&to=2026-05-31", adminToken);
    expect(res.status).toBe(200);
    const rows = await res.json() as Array<{ sku: string; ordered_qty: number; client_count: number; order_count: number }>;
    const coke = rows.find(r => r.sku === "COKE");
    expect(coke).toBeTruthy();
    expect(coke!.ordered_qty).toBe(20);
    expect(coke!.client_count).toBe(2);
    expect(coke!.order_count).toBe(2);
  });

  it("the date filter excludes orders outside the range", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind("OC-APR", "c1", "tst-ops", "SUBMITTED", 100, 18, 118, "Regular", "2026-04-10 10:00:00").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("oi-apr", "OC-APR", "APRILONLY", "April Item", 7, 10, 70).run();
    const rows = await get("/api/reports/order-consolidation?from=2026-05-01&to=2026-05-31", adminToken).then(r => r.json()) as Array<{ sku: string }>;
    expect(rows.find(r => r.sku === "APRILONLY")).toBeFalsy();
  });

  it("drill returns the per-order / per-client breakdown for a product", async () => {
    await seedCoke(env.DB as D1Database);
    const res = await get("/api/reports/order-consolidation/drill?sku=COKE&from=2026-05-01&to=2026-05-31", adminToken);
    expect(res.status).toBe(200);
    const rows = await res.json() as Array<{ order_id: string; client_name: string; ordered_qty: number }>;
    expect(rows.length).toBe(2);
    expect(rows.every(r => r.ordered_qty === 10)).toBe(true);
    expect(new Set(rows.map(r => r.client_name)).size).toBe(2);
  });

  it("drill without sku returns 400", async () => {
    const res = await get("/api/reports/order-consolidation/drill?from=2026-05-01&to=2026-05-31", adminToken);
    expect(res.status).toBe(400);
  });

  it("client roles cannot see the cross-client consolidation (403)", async () => {
    const res = await get("/api/reports/order-consolidation", clientToken);
    expect(res.status).toBe(403);
  });
});

// ── Zoho Inventory → app sync (milestone 002): one-way pull, Model A ────
// Endpoint gating uses SELF; the core semantics are driven directly through the
// exported runZohoSync with an INJECTED fetch (no live Zoho in CI).
import { runZohoSync, mapZohoItem, migrateHsnTo6Digit, migrateBackfillAeratedHsn } from "../src/index";
import { currentFY, dcClassForCategory, migrateSeedDCSeries } from "../src/index";

// A deterministic Zoho stand-in: token POST + paginated GET items. Records every
// call so a test can assert the app NEVER POSTs to the Zoho items endpoint.
function mockZoho(pages: Record<string, unknown>[][]) {
  const calls: { url: string; method: string }[] = [];
  const flatTotal = pages.reduce((n, p) => n + p.length, 0);
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === "string" ? url : (url as URL).toString();
    const method = (init?.method || "GET").toUpperCase();
    calls.push({ url: u, method });
    if (u.includes("/oauth/v2/token"))
      return new Response(JSON.stringify({ access_token: "tok-abc", expires_in: 3600 }), { status: 200 });
    if (u.includes("/inventory/v1/items")) {
      const page = Number(new URL(u).searchParams.get("page") || "1");
      const items = pages[page - 1] || [];
      return new Response(JSON.stringify({ items, page_context: { has_more_page: page < pages.length, total: flatTotal } }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}
// runZohoSync reads env.ZOHO_* + env.DB; a spread copy supplies secrets while keeping the test DB.
function zohoEnv() {
  return { ...(env as Record<string, unknown>), ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "sec", ZOHO_REFRESH_TOKEN: "ref", ZOHO_INVENTORY_ORG_ID: "org", ZOHO_DC: "in" } as unknown as typeof env;
}
async function setCfg(key: string, value: string) {
  await (env.DB as D1Database).prepare("INSERT INTO app_config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key, value).run();
}
async function getCfg(key: string) {
  const row = await (env.DB as D1Database).prepare("SELECT value FROM app_config WHERE key=?").bind(key).first() as { value: string } | null;
  return row?.value ?? "";
}
async function invRow(sku: string) {
  return (env.DB as D1Database).prepare("SELECT sku,stock,active,zoho_synced_at,zoho_item_id FROM inventory WHERE sku=?").bind(sku).first() as Promise<Record<string, unknown> | null>;
}

describe("Zoho Inventory sync — mapping", () => {
  it("maps documented Zoho fields → app columns (stock ← stock_on_hand)", () => {
    const m = mapZohoItem({ sku: "Z1", item_id: "zi1", name: "Tea", rate: 100, purchase_rate: 70, stock_on_hand: 42, tax_percentage: 12, category_name: "Beverages", status: "active", last_modified_time: "2026-09-05T06:00:00+05:30" });
    expect("row" in m).toBe(true);
    if ("row" in m) {
      expect(m.row.stock).toBe(42);
      expect(m.row.unit_price).toBe(100);
      expect(m.row.cost_excl_gst).toBe(70);
      expect(m.row.gst_rate).toBe(12);
      expect(m.row.active).toBe(1);
      expect(m.row.zoho_item_id).toBe("zi1");
      expect(m.modifiedEpoch).toBe(Math.floor(Date.parse("2026-09-05T06:00:00+05:30") / 1000));
    }
  });
  it("skips a blank sku", () => {
    expect("error" in mapZohoItem({ sku: "  ", name: "x" })).toBe(true);
  });
});

describe("Zoho Inventory sync — endpoint gating", () => {
  it("status returns the pull-model shape", async () => {
    const body = await get("/api/integrations/zoho-inventory/status", adminToken).then(r => r.json()) as Record<string, unknown>;
    expect(body.direction).toContain("zoho→app");
    expect(typeof body.configured).toBe("boolean");
    expect(["dryrun", "live"]).toContain(body.mode);
  });
  it("toggle + manual sync are super-admin only", async () => {
    expect((await post("/api/integrations/zoho-inventory/toggle", { enabled: true }, clientToken)).status).toBe(403);
    expect((await post("/api/integrations/zoho-inventory/toggle", { enabled: true }, opsToken)).status).toBe(403);
    expect((await post("/api/integrations/zoho-inventory/sync", {}, clientToken)).status).toBe(403);
    expect((await post("/api/integrations/zoho-inventory/sync", {}, opsToken)).status).toBe(403);
  });
  it("disabled sync is a no-op (super-admin, still 200)", async () => {
    await setCfg("zoho_sync_enabled", "0");
    const res = await post("/api/integrations/zoho-inventory/sync", {}, adminToken);
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe("disabled");
  });
});

describe("Zoho Inventory sync — core (injected fetch)", () => {
  it("disabled → performs NO network calls", async () => {
    await setCfg("zoho_sync_enabled", "0");
    const { impl, calls } = mockZoho([[{ sku: "SKU001", stock_on_hand: 5, last_modified_time: "2026-01-01T00:00:00Z" }]]);
    const r = await runZohoSync(zohoEnv(), { fetchImpl: impl });
    expect(r.status).toBe("disabled");
    expect(calls.length).toBe(0);
  });

  it("live delta overwrites stock, stamps provenance, advances the cursor", async () => {
    await setCfg("zoho_sync_enabled", "1");
    await setCfg("zoho_sync_mode", "live");
    await setCfg("zoho_sync_cursor", "");
    const mod = "2026-09-05T06:00:00+05:30";
    const { impl, calls } = mockZoho([[{ sku: "SKU001", item_id: "z-sku001", name: "Basmati Rice 5kg", stock_on_hand: 321, last_modified_time: mod }]]);
    const r = await runZohoSync(zohoEnv(), { fetchImpl: impl });
    expect(r.status).toBe("ok");
    expect(r.written).toBe(1);
    const row = await invRow("SKU001");
    expect(Number(row?.stock)).toBe(321);          // stock ← stock_on_hand
    expect(row?.zoho_synced_at).toBeTruthy();       // provenance stamped
    expect(row?.zoho_item_id).toBe("z-sku001");
    // cursor advanced to the max last_modified_time (UTC epoch)
    expect(r.cursor_epoch).toBe(Math.floor(Date.parse(mod) / 1000));
    // NEVER a POST to Zoho items — only token POST + GET items
    expect(calls.some(c => c.url.includes("/inventory/v1/items") && c.method === "POST")).toBe(false);
  });

  it("dry-run writes nothing and does not advance the cursor", async () => {
    await setCfg("zoho_sync_enabled", "1");
    await setCfg("zoho_sync_mode", "dryrun");
    await setCfg("zoho_sync_cursor", "1000");
    // seed a known stock we can prove is untouched
    await (env.DB as D1Database).prepare("UPDATE inventory SET stock=7 WHERE sku='SKU001'").run();
    const { impl } = mockZoho([[{ sku: "SKU001", stock_on_hand: 999, last_modified_time: "2026-09-09T00:00:00Z" }]]);
    const r = await runZohoSync(zohoEnv(), { fetchImpl: impl });
    expect(r.mode).toBe("dryrun");
    expect(Number((await invRow("SKU001"))?.stock)).toBe(7); // unchanged
    expect(await getCfg("zoho_sync_cursor")).toBe("1000");   // not advanced
  });

  it("a fetch failure aborts with no writes and holds the cursor", async () => {
    await setCfg("zoho_sync_enabled", "1");
    await setCfg("zoho_sync_mode", "live");
    await setCfg("zoho_sync_cursor", "500");
    await (env.DB as D1Database).prepare("UPDATE inventory SET stock=11 WHERE sku='SKU001'").run();
    const impl = (async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : (url as URL).toString();
      if (u.includes("/oauth/v2/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      throw new Error("network down"); // non-retryable → immediate abort
    }) as unknown as typeof fetch;
    const r = await runZohoSync(zohoEnv(), { fetchImpl: impl });
    expect(r.status).toBe("error");
    expect(Number((await invRow("SKU001"))?.stock)).toBe(11); // no partial clobber
    expect(await getCfg("zoho_sync_cursor")).toBe("500");     // cursor held
  });

  it("full reconcile soft-deactivates absent Zoho SKUs but never app-native ones", async () => {
    const db = env.DB as D1Database;
    await setCfg("zoho_sync_enabled", "1");
    await setCfg("zoho_sync_mode", "live");
    // Reset provenance so this test's fixture is the ONLY Zoho-origin population
    // (other tests leave zoho_synced_at set) → the 10% valve math is deterministic.
    await db.prepare("UPDATE inventory SET zoho_synced_at=NULL").run();
    // ZINV-OLD: previously from Zoho (old stamp), now absent → should deactivate
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,zoho_synced_at) VALUES ('ZINV-OLD','Old Zoho Item','General',10,5,1,'2000-01-01T00:00:00.000Z')").run();
    // CSV-NATIVE: never from Zoho (NULL provenance) → must stay active
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,zoho_synced_at) VALUES ('CSV-NATIVE','Hand Added','General',10,5,1,NULL)").run();
    // A full page of still-present Zoho items so the 1 stale SKU stays under the 10% valve.
    const keep = Array.from({ length: 10 }, (_, i) => ({ sku: `ZKEEP-${i}`, name: `Keep ${i}`, stock_on_hand: 3, last_modified_time: "2026-09-09T00:00:00Z" }));
    const { impl } = mockZoho([[{ sku: "ZINV-NEW", name: "Fresh", stock_on_hand: 20, last_modified_time: "2026-09-09T00:00:00Z" }, ...keep]]);
    const r = await runZohoSync(zohoEnv(), { full: true, fetchImpl: impl });
    expect(r.status).toBe("ok");
    expect(r.deactivated).toBe(1);
    expect(Number((await invRow("ZINV-OLD"))?.active)).toBe(0);   // deactivated
    expect(Number((await invRow("CSV-NATIVE"))?.active)).toBe(1); // untouched (app-native)
    expect(Number((await invRow("ZKEEP-0"))?.active)).toBe(1);    // present in Zoho → active
  });
});

describe("Server-side draft cart", () => {
  it("GET /api/cart — unauthenticated returns 401", async () => {
    const res = await get("/api/cart");
    expect(res.status).toBe(401);
  });

  it("PUT then GET round-trips the cart, and items are sanitized", async () => {
    const res = await put("/api/cart", {
      items: [
        { sku: "SKU001", name: "Basmati Rice 5kg", qty: 2, unit_price: 450, emoji: "🍚" },
        { sku: "", name: "junk", qty: 5, unit_price: 10 },   // no sku → dropped
        { sku: "SKU002", name: "Oil", qty: 0, unit_price: 150 }, // qty 0 → dropped
      ],
    }, clientToken);
    expect(res.status).toBe(200);
    expect((await res.json() as { count: number }).count).toBe(1);

    const cart = await get("/api/cart", clientToken).then(r => r.json()) as { items: Array<{ sku: string; qty: number }> };
    expect(cart.items.length).toBe(1);
    expect(cart.items[0].sku).toBe("SKU001");
    expect(cart.items[0].qty).toBe(2);
  });

  it("carts are per-user — one user cannot see another's", async () => {
    await put("/api/cart", { items: [{ sku: "SKU001", name: "Rice", qty: 3, unit_price: 450 }] }, clientToken);
    const otherCart = await get("/api/cart", adminToken).then(r => r.json()) as { items: unknown[] };
    expect(otherCart.items.length).toBe(0);
  });

  it("DELETE clears the saved cart", async () => {
    await put("/api/cart", { items: [{ sku: "SKU001", name: "Rice", qty: 1, unit_price: 450 }] }, clientToken);
    const del1 = await del("/api/cart", clientToken);
    expect(del1.status).toBe(200);
    const cart = await get("/api/cart", clientToken).then(r => r.json()) as { items: unknown[] };
    expect(cart.items.length).toBe(0);
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

  it("POST /api/clients/c1/catalog — items with client_price are stored", async () => {
    const res = await post("/api/clients/c1/catalog", {
      items: [{ sku: "SKU003", client_price: 399 }],
    }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { added: number; priced: number };
    expect(body.added).toBe(1);
    expect(body.priced).toBe(1);

    // The per-client price is persisted and returned on the catalog.
    const cat = await get("/api/clients/c1/catalog", adminToken).then(r => r.json()) as Array<{ sku: string; client_price: number | null }>;
    const row = cat.find(r => r.sku === "SKU003");
    expect(row).toBeTruthy();
    expect(row!.client_price).toBe(399);
  });

  it("POST /api/clients/c1/catalog — empty body is rejected (400)", async () => {
    const res = await post("/api/clients/c1/catalog", {}, adminToken);
    expect(res.status).toBe(400);
  });

  it("GET /api/inventory — client user sees only assigned catalog items", async () => {
    const res = await get("/api/inventory", clientToken);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ sku: string }>;
    const skus = body.map(i => i.sku);
    expect(skus).toContain("SKU001");
    expect(skus).toContain("SKU002");
  });

  it("GET /api/inventory + /api/catalog/products — client catalogue > 100 SKUs does not blow D1's bound-variable limit", async () => {
    // Regression: the client filter used to inline one bound param per catalogue
    // SKU (i.sku IN (?,?,…)), which trips D1's ~100 variable cap ("too many SQL
    // variables") once a client's catalogue grows large. Seed 150 SKUs and assert
    // both the ordering inventory endpoint and the PI catalogue endpoint stay 200.
    const db = env.DB as D1Database;
    for (let i = 0; i < 150; i++) {
      const sku = `BULK${String(i).padStart(3, "0")}`;
      await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,?)")
        .bind(sku, `Bulk Item ${i}`, "Grocery", 100 + i, 20, 1).run();
      await db.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
        .bind("c1", sku, "tst-admin").run();
    }

    const inv = await get("/api/inventory", clientToken);
    expect(inv.status).toBe(200);
    const invBody = await inv.json() as Array<{ sku: string }>;
    // Client sees only their (now large) catalogue, and it comes back intact.
    expect(invBody.length).toBeGreaterThanOrEqual(150);
    expect(invBody.map(i => i.sku)).toContain("BULK149");

    const cat = await get("/api/catalog/products", clientToken);
    expect(cat.status).toBe(200);
    const catBody = await cat.json() as { products: Array<{ sku: string }>; total: number };
    expect(catBody.total).toBeGreaterThanOrEqual(100);

    // Restore c1's catalogue to its seeded state so later tests see only SKU001/002.
    await db.prepare("DELETE FROM client_catalog WHERE sku LIKE 'BULK%'").run();
    await db.prepare("DELETE FROM inventory WHERE sku LIKE 'BULK%'").run();
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

describe("Alerts & Exceptions hub", () => {
  it("returns the six exception categories for an internal-ops admin", async () => {
    const res = await get("/api/alerts", adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { total: number; categories: { key: string; count: number; items: unknown[] }[] };
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.categories)).toBe(true);
    const keys = data.categories.map(c => c.key);
    expect(keys).toEqual([
      "overdue_deliveries", "pending_approvals", "sla_breaches",
      "low_stock", "near_expiry", "flagged_invoices", "po_approvals", "overdue_billing", "failed_syncs",
    ]);
    // Every count is a non-negative number and total is their sum.
    for (const c of data.categories) expect(c.count).toBeGreaterThanOrEqual(0);
    expect(data.total).toBe(data.categories.reduce((s, c) => s + c.count, 0));
  });

  it("is forbidden for client-side roles", async () => {
    const res = await get("/api/alerts", clientToken);
    expect(res.status).toBe(403);
  });
});

describe("Receiving spine (line-level GRN + 3-way match)", () => {
  const rdb = env.DB as D1Database;
  const stockOf = async (sku: string) =>
    Number(((await rdb.prepare("SELECT stock FROM inventory WHERE sku=?").bind(sku).first()) as Record<string, number>)?.stock || 0);
  const poStatus = async (id: string) =>
    String(((await rdb.prepare("SELECT status FROM purchase_orders WHERE id=?").bind(id).first()) as Record<string, string>)?.status);

  beforeAll(async () => {
    await rdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,track_batch) VALUES (?,?,?,?,?,?,?)")
      .bind("GRN-SKU", "GRN Test Item", "Grocery", 100, 0, 1, 1).run();
    // PO-A: 100 @ ₹100 (₹11,800 incl GST), DISPATCHED — partial then full receipt + invoice
    await rdb.prepare("INSERT OR IGNORE INTO purchase_orders (id,vendor_id,status,subtotal,gst,grand_total,expected_delivery) VALUES (?,?,?,?,?,?,?)")
      .bind("PO-TST-A", "v1", "DISPATCHED", 10000, 1800, 11800, "2999-01-01").run();
    await rdb.prepare("INSERT OR IGNORE INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("poi-a", "PO-TST-A", "GRN-SKU", "GRN Test Item", 100, 100, 10000).run();
    // PO-B: 50, DISPATCHED — over-receipt + QC reject
    await rdb.prepare("INSERT OR IGNORE INTO purchase_orders (id,vendor_id,status,subtotal,gst,grand_total,expected_delivery) VALUES (?,?,?,?,?,?,?)")
      .bind("PO-TST-B", "v1", "DISPATCHED", 5000, 900, 5900, "2999-01-01").run();
    await rdb.prepare("INSERT OR IGNORE INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("poi-b", "PO-TST-B", "GRN-SKU", "GRN Test Item", 50, 100, 5000).run();
  });

  // Note: vitest-pool-workers resets storage to the post-beforeAll snapshot between
  // tests, so each test drives the full sequence it needs from the seeded baseline.
  it("partial then full receipt: 60 then 40 → PARTIALLY_RECEIVED → RECEIVED, stock +100", async () => {
    const before = await stockOf("GRN-SKU");
    const r1 = await post("/api/grn", { po_id: "PO-TST-A", lines: [{ sku: "GRN-SKU", qty_received: 60 }] }, adminToken);
    expect(r1.status).toBe(201);
    expect((await r1.json() as { po_status: string }).po_status).toBe("PARTIALLY_RECEIVED");
    const r2 = await post("/api/grn", { po_id: "PO-TST-A", lines: [{ sku: "GRN-SKU", qty_received: 40 }] }, adminToken);
    expect((await r2.json() as { po_status: string }).po_status).toBe("RECEIVED");
    expect(await stockOf("GRN-SKU")).toBe(before + 100);
    expect(await poStatus("PO-TST-A")).toBe("RECEIVED");
  });

  it("over-receipt is rejected (400)", async () => {
    const res = await post("/api/grn", { po_id: "PO-TST-B", lines: [{ sku: "GRN-SKU", qty_received: 110 }] }, adminToken);
    expect(res.status).toBe(400);
  });

  it("QC reject + batch: receive 40, reject 10 → stock +40, batch captured", async () => {
    const before = await stockOf("GRN-SKU");
    const res = await post("/api/grn",
      { po_id: "PO-TST-B", lines: [{ sku: "GRN-SKU", qty_received: 40, qty_rejected: 10, batch_no: "B-01", expiry_date: "2999-06-01" }] }, adminToken);
    expect(res.status).toBe(201);
    expect(await stockOf("GRN-SKU")).toBe(before + 40); // rejected 10 excluded from stock
    const rej = await rdb.prepare("SELECT qty_rejected FROM grn_lines WHERE batch_no='B-01'").first() as Record<string, number>;
    expect(Number(rej.qty_rejected)).toBe(10);
    const batch = await rdb.prepare("SELECT qty FROM inventory_batches WHERE batch_no='B-01'").first() as Record<string, number>;
    expect(Number(batch.qty)).toBe(40);
  });

  it("3-way match: wrong amount flags, correct invoice sets INVOICED", async () => {
    await post("/api/grn", { po_id: "PO-TST-A", lines: [{ sku: "GRN-SKU", qty_received: 100 }] }, adminToken);
    expect(await poStatus("PO-TST-A")).toBe("RECEIVED");
    const bad = await post("/api/purchase-orders/PO-TST-A/invoice", { vendor_invoice_no: "INV-9", invoice_amount: 99999 }, adminToken);
    expect((await bad.json() as { match_status: string }).match_status).toBe("FLAGGED");
    expect(await poStatus("PO-TST-A")).toBe("RECEIVED");
    const good = await post("/api/purchase-orders/PO-TST-A/invoice", { vendor_invoice_no: "INV-10", invoice_amount: 11800 }, adminToken);
    expect((await good.json() as { match_status: string }).match_status).toBe("MATCHED");
    expect(await poStatus("PO-TST-A")).toBe("INVOICED");
  });

  it("client role is forbidden from receiving (403)", async () => {
    const res = await post("/api/grn", { po_id: "PO-TST-A", lines: [{ sku: "GRN-SKU", qty_received: 1 }] }, clientToken);
    expect(res.status).toBe(403);
  });
});

describe("Demand → PO vendor-split (G4 sourcing)", () => {
  const sdb = env.DB as D1Database;
  beforeAll(async () => {
    await sdb.prepare("INSERT OR IGNORE INTO vendors (id,name,category,active) VALUES (?,?,?,?)").bind("v2", "Nimble Foods", "Grocery", 1).run();
    await sdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate,vendor_id) VALUES (?,?,?,?,?,?,?,?)").bind("SRC-A", "Src A", "Grocery", 100, 0, 1, 5, "v1").run();
    await sdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate,vendor_id) VALUES (?,?,?,?,?,?,?,?)").bind("SRC-B", "Src B", "Grocery", 100, 0, 1, 18, "v2").run();
    await sdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)").bind("SRC-NONE", "Src None", "Grocery", 100, 0, 1, 5).run();
    // Vendor-specific price + MOQ for SRC-A from v1
    await sdb.prepare("INSERT OR IGNORE INTO vendor_products (id,vendor_id,sku,name,rate,moq) VALUES (?,?,?,?,?,?)").bind("vp1", "v1", "SRC-A", "Src A", 90, 10).run();
  });

  it("splits demand into one PO per resolved vendor, using vendor price + MOQ", async () => {
    const res = await post("/api/purchase-orders/from-demand", { items: [{ sku: "SRC-A", qty: 5 }, { sku: "SRC-B", qty: 20 }], source: "consolidated" }, adminToken);
    expect(res.status).toBe(201);
    const data = await res.json() as { pos: Array<{ id: string; vendor_id: string }>; unsourced: Array<{ sku: string }> };
    expect(data.pos.length).toBe(2);
    expect(data.unsourced.length).toBe(0);
    const v1po = data.pos.find(p => p.vendor_id === "v1")!;
    const items = await sdb.prepare("SELECT qty,unit_price FROM po_items WHERE po_id=?").bind(v1po.id).all() as { results: Record<string, number>[] };
    expect(Number(items.results[0].qty)).toBe(10);        // lifted to MOQ 10
    expect(Number(items.results[0].unit_price)).toBe(90);  // vendor_products rate, not inventory 100
  });

  it("flags items with no usable vendor as unsourced (no PO)", async () => {
    const res = await post("/api/purchase-orders/from-demand", { items: [{ sku: "SRC-NONE", qty: 5 }] }, adminToken);
    const data = await res.json() as { pos: unknown[]; unsourced: Array<{ sku: string }> };
    expect(data.pos.length).toBe(0);
    expect(data.unsourced.map(u => u.sku)).toContain("SRC-NONE");
  });

  it("preview groups by vendor without creating POs", async () => {
    const res = await get("/api/sourcing/preview?items=SRC-A:5,SRC-B:20,SRC-NONE:3", adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { groups: unknown[]; unsourced: unknown[] };
    expect(data.groups.length).toBe(2);
    expect(data.unsourced.length).toBe(1);
  });

  it("is forbidden for client roles", async () => {
    const res = await post("/api/purchase-orders/from-demand", { items: [{ sku: "SRC-A", qty: 5 }] }, clientToken);
    expect(res.status).toBe(403);
  });
});

describe("PO commercials — multi-line + per-line GST slab (G6/G7)", () => {
  const gdb = env.DB as D1Database;
  beforeAll(async () => {
    await gdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)").bind("GST5", "Five Percent", "Grocery", 100, 0, 1, 5).run();
    await gdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)").bind("GST18", "Eighteen Percent", "Grocery", 100, 0, 1, 18).run();
  });

  it("multi-line PO totals GST per slab, not a flat 18%", async () => {
    const res = await post("/api/purchase-orders", { vendor_id: "v1", items: [
      { sku: "GST5",  name: "Five Percent",      qty: 10, unit_price: 100 },
      { sku: "GST18", name: "Eighteen Percent",  qty: 10, unit_price: 100 },
    ] }, adminToken);
    expect(res.status).toBe(201);
    const data = await res.json() as { id: string; grand_total: number };
    // subtotal 2000; GST = 50 (5% of 1000) + 180 (18% of 1000) = 230 → 2230, not a flat 360
    expect(data.grand_total).toBe(2230);
    const items = await gdb.prepare("SELECT COUNT(*) as n FROM po_items WHERE po_id=?").bind(data.id).all() as { results: Record<string, number>[] };
    expect(Number(items.results[0].n)).toBe(2);
  });
});

describe("PO approval + compliance gate (G8/G9)", () => {
  const adb = env.DB as D1Database;
  beforeAll(async () => {
    await adb.prepare("INSERT OR IGNORE INTO vendors (id,name,category,active) VALUES (?,?,?,?)").bind("v-bad", "Lapsed Traders", "Grocery", 0).run();
    await adb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate) VALUES (?,?,?,?,?,?,?)").bind("BIGSKU", "Big Item", "Grocery", 1000, 0, 1, 18).run();
  });

  it("G9: blocks a PO to a non-compliant (inactive) vendor", async () => {
    const res = await post("/api/purchase-orders", { vendor_id: "v-bad", items: [{ sku: "BIGSKU", name: "Big Item", qty: 1, unit_price: 1000 }] }, adminToken);
    expect(res.status).toBe(422);
  });

  it("G8: a high-value PO is held for approval, not sent", async () => {
    const res = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 60, unit_price: 1000 }] }, adminToken);
    expect(res.status).toBe(201);
    expect((await res.json() as { status: string }).status).toBe("PENDING_APPROVAL");
  });

  it("G8: a small PO goes straight to the vendor (SENT)", async () => {
    const res = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken);
    expect((await res.json() as { status: string }).status).toBe("SENT");
  });

  it("G8: only approver roles can approve a held PO", async () => {
    const created = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 60, unit_price: 1000 }] }, adminToken);
    const { id } = await created.json() as { id: string };
    const denied = await patch(`/api/purchase-orders/${id}`, { status: "SENT" }, opsToken); // ops_manager ≠ approver
    expect(denied.status).toBe(403);
    const okd = await patch(`/api/purchase-orders/${id}`, { status: "SENT" }, adminToken);
    expect(okd.status).toBe(200);
    const st = await adb.prepare("SELECT status FROM purchase_orders WHERE id=?").bind(id).first() as Record<string, string>;
    expect(st.status).toBe("SENT");
  });

  it("threshold is configurable and enforced", async () => {
    await patch("/api/po-approval-threshold", { threshold: 1000 }, adminToken);
    const res = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken);
    expect((await res.json() as { status: string }).status).toBe("PENDING_APPROVAL"); // 2360 ≥ 1000
  });
});

describe("Auto-reorder, debit notes, PO numbering (G10/G11/G12)", () => {
  const zdb = env.DB as D1Database;
  beforeAll(async () => {
    // Below-reorder item with a vendor price list carrying an MOQ
    await zdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate,vendor_id,reorder_level,max_stock) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind("AUTO-SKU", "Auto Item", "Grocery", 100, 5, 1, 18, "v1", 20, 50).run();
    await zdb.prepare("INSERT OR IGNORE INTO vendor_products (id,vendor_id,sku,name,rate,moq) VALUES (?,?,?,?,?,?)")
      .bind("vp-auto", "v1", "AUTO-SKU", "Auto Item", 80, 100).run();
    await zdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,gst_rate,vendor_id) VALUES (?,?,?,?,?,?,?,?)")
      .bind("DNSKU", "DN Item", "Grocery", 100, 500, 1, 18, "v1").run();
  });

  it("G10: auto-reorder raises a PO with MOQ-lifted qty and vendor price", async () => {
    const patched = await patch("/api/inventory/AUTO-SKU", { stock: 5 }, adminToken); // triggers checkAutoReorder
    expect(patched.status).toBe(200);
    const row = await zdb.prepare(
      "SELECT pi.qty, pi.unit_price FROM po_items pi JOIN purchase_orders p ON pi.po_id=p.id WHERE pi.sku='AUTO-SKU' ORDER BY p.created_at DESC LIMIT 1"
    ).first() as Record<string, number> | null;
    expect(row).toBeTruthy();
    expect(Number(row!.qty)).toBe(100);        // base 45 lifted to MOQ 100
    expect(Number(row!.unit_price)).toBe(80);   // vendor_products rate
  });

  it("G12: PO numbers are sequential and gap-free", async () => {
    const r1 = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "DNSKU", name: "DN Item", qty: 1, unit_price: 100 }] }, adminToken);
    const r2 = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "DNSKU", name: "DN Item", qty: 1, unit_price: 100 }] }, adminToken);
    const id1 = (await r1.json() as { id: string }).id;
    const id2 = (await r2.json() as { id: string }).id;
    expect(id1).toMatch(/^PO-\d{5}$/);
    expect(Number(id2.slice(3))).toBe(Number(id1.slice(3)) + 1);
  });

  it("G11: a debit note is raised against a PO with amount from the line price", async () => {
    const created = await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "DNSKU", name: "DN Item", qty: 5, unit_price: 100 }] }, adminToken);
    const { id } = await created.json() as { id: string };
    const dn = await post(`/api/purchase-orders/${id}/debit-note`, { sku: "DNSKU", qty: 2, reason: "damaged" }, adminToken);
    expect(dn.status).toBe(201);
    expect((await dn.json() as { amount: number }).amount).toBe(200); // 2 × ₹100
    const list = await get(`/api/purchase-orders/${id}/debit-notes`, adminToken);
    expect((await list.json() as unknown[]).length).toBe(1);
  });

  it("G11: debit notes are gated to internal-ops roles", async () => {
    const res = await post("/api/purchase-orders/PO-00001/debit-note", { sku: "DNSKU", qty: 1 }, clientToken);
    expect(res.status).toBe(403);
  });
});

describe("Client consumption report (received / consumed / stock / low-stock)", () => {
  const cdb = env.DB as D1Database;
  beforeAll(async () => {
    // client_inventory carries a STALE category; the master (inventory) is the fresh one.
    await cdb.prepare("INSERT OR IGNORE INTO client_inventory (client_id,sku,item_name,category,qty_on_hand,reorder_level) VALUES (?,?,?,?,?,?)").bind("c1", "CONS1", "Coffee", "StaleCat", 3, 5).run();
    await cdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,?)").bind("CONS1", "Coffee", "Beverages", 100, 100, 1).run();
    // Orphan: stock-only leftover, not in the client's catalogue, no orders/consumption.
    await cdb.prepare("INSERT OR IGNORE INTO client_inventory (client_id,sku,item_name,category,qty_on_hand,reorder_level) VALUES (?,?,?,?,?,?)").bind("c1", "ORPHAN1", "Ghost Register", "Misc", 1, 0).run();
    await cdb.prepare("INSERT INTO client_consumption (client_id,sku,item_name,qty,consumed_at) VALUES (?,?,?,?,?)").bind("c1", "CONS1", "Coffee", 10, "2026-07-15 10:00:00").run();
    await cdb.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,grand_total) VALUES (?,?,?,?,?)").bind("O-C1", "c1", "tst-ops", "CLOSED", 1000).run();
    await cdb.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,delivered_at) VALUES (?,?,?,?)").bind("DC-C1", "O-C1", "DELIVERED", "2026-07-15 09:00:00").run();
    await cdb.prepare("INSERT OR IGNORE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)").bind("dci-c1", "DC-C1", "CONS1", "Coffee", 20, 20).run();
  });

  it("returns received, consumed, in-stock and low-stock per item, scoped to the client", async () => {
    const res = await get("/api/reports/client-consumption?from=2026-07-01&to=2026-07-31", clientToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { rows: Record<string, unknown>[]; totals: Record<string, number> };
    const row = data.rows.find(r => r.sku === "CONS1")!;
    expect(row).toBeTruthy();
    expect(row.received).toBe(20);
    expect(row.consumed).toBe(10);
    expect(row.in_stock).toBe(3);
    expect(row.low_stock).toBe(true);   // 3 ≤ reorder 5
    expect(row.category).toBe("Beverages"); // live from master, not the stale client copy
    expect(data.totals.low_stock).toBeGreaterThanOrEqual(1);
  });

  it("hides orphan stock-only rows not in the client's catalogue", async () => {
    const res = await get("/api/reports/client-consumption?from=2026-07-01&to=2026-07-31", clientToken);
    const data = await res.json() as { rows: Record<string, unknown>[] };
    expect(data.rows.find(r => r.sku === "ORPHAN1")).toBeFalsy();  // orphan trail hidden
    expect(data.rows.find(r => r.sku === "CONS1")).toBeTruthy();   // real activity still shown
  });

  it("period filter excludes out-of-range received/consumed (stock stays point-in-time)", async () => {
    const res = await get("/api/reports/client-consumption?from=2026-01-01&to=2026-01-31", clientToken);
    const data = await res.json() as { rows: Record<string, number>[] };
    const row = data.rows.find(r => r.sku === "CONS1");
    expect(row ? row.consumed : 0).toBe(0);
    expect(row ? row.received : 0).toBe(0);
  });
});

// ── HSN-driven GST slab ──────────────────────────────────────────────
// A product's GST must come from its HSN code (0/5/12/18/28%), never a flat 18%.
describe("HSN → GST slab", () => {
  it("GET /api/hsn-gst resolves the seeded 6-digit slab", async () => {
    const res = await get("/api/hsn-gst?hsn=220210", adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(40); // aerated beverages — GST 2.0 40% demerit slab
  });

  it("GET /api/hsn-gst falls back from an 8-digit code to its 6-digit subheading", async () => {
    const data = await (await get("/api/hsn-gst?hsn=09012100", adminToken)).json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(5); // coffee, subheading 090121
  });

  it("GET /api/hsn-gst reports no match for an unmapped code", async () => {
    const data = await (await get("/api/hsn-gst?hsn=999999", adminToken)).json() as { matched: boolean };
    expect(data.matched).toBe(false);
  });

  it("POST /api/inventory derives GST from the HSN code, ignoring a wrong supplied rate", async () => {
    const res = await post("/api/inventory", { name: "Fizzy Cola", category: "Beverages", unit_price: 40, hsn_code: "220210", gst_rate: 18 }, adminToken);
    expect(res.status).toBe(201);
    const { sku } = await res.json() as { sku: string };
    const row = await (env.DB as D1Database).prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(sku).first() as { gst_rate: number };
    expect(row.gst_rate).toBe(40); // aerated → 40% demerit slab
  });

  it("PATCH /api/inventory re-derives GST when the HSN code changes", async () => {
    const created = await post("/api/inventory", { name: "Mystery Item", category: "Grocery", unit_price: 10, hsn_code: "090121" }, adminToken);
    const { sku } = await created.json() as { sku: string };
    // starts at 5% (coffee); move it to a 12%-subheading and expect GST to follow
    await patch(`/api/inventory/${sku}`, { hsn_code: "200989" }, adminToken); // juices → 12
    const row = await (env.DB as D1Database).prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(sku).first() as { gst_rate: number };
    expect(row.gst_rate).toBe(12);
  });

  it("POST /api/inventory/recalc-gst backfills a wrong stored rate from the HSN", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES (?,?,?,?,?,?,?,?)")
      .bind("HSNFIX", "Wrongly 18", "Beverages", 50, 0, 1, "220210", 18).run(); // aerated → should be 40
    const res = await post("/api/inventory/recalc-gst", {}, adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { updated: number };
    expect(data.updated).toBeGreaterThanOrEqual(1);
    const row = await db.prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind("HSNFIX").first() as { gst_rate: number };
    expect(row.gst_rate).toBe(40);
  });

  it("POST /api/inventory/assign-hsn stamps 220210 on 40% items missing an HSN and reports counts", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES ('AHN1','Monster No HSN','Beverages',125,0,1,'',40)").run();
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES ('AHN2','Tagged 40','Beverages',30,0,1,'240220',40)").run();
    const res = await post("/api/inventory/assign-hsn", {}, adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { updated: number; gst40_total: number };
    expect(data.updated).toBeGreaterThanOrEqual(1);
    expect(data.gst40_total).toBeGreaterThanOrEqual(2);
    const filled = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='AHN1'").first() as { hsn_code: string };
    expect(filled.hsn_code).toBe("220210");
    const kept = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='AHN2'").first() as { hsn_code: string };
    expect(kept.hsn_code).toBe("240220"); // explicit HSN left untouched
  });

  it("POST /api/inventory/assign-hsn is forbidden to non-privileged roles", async () => {
    const res = await post("/api/inventory/assign-hsn", {}, clientToken);
    expect(res.status).toBe(403);
  });

  it("POST /api/hsn-gst-rates upserts a 6-digit mapping that the lookup then resolves", async () => {
    const res = await post("/api/hsn-gst-rates", { hsn: "330510", gst_rate: 18, description: "Shampoo / hair preparations" }, adminToken);
    expect(res.status).toBe(200);
    const data = await (await get("/api/hsn-gst?hsn=330510", adminToken)).json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(18);
  });

  it("POST /api/hsn-gst-rates rejects a non-6-digit HSN code", async () => {
    expect((await post("/api/hsn-gst-rates", { hsn: "4901", gst_rate: 12 }, adminToken)).status).toBe(400);   // 4-digit
    expect((await post("/api/hsn-gst-rates", { hsn: "49", gst_rate: 12 }, adminToken)).status).toBe(400);     // 2-digit
  });

  it("POST /api/hsn-gst-rates rejects a rate outside the legal slabs", async () => {
    const res = await post("/api/hsn-gst-rates", { hsn: "490100", gst_rate: 7 }, adminToken);
    expect(res.status).toBe(400);
  });

  it("POST /api/hsn-gst-rates accepts the GST 2.0 40% demerit slab", async () => {
    const res = await post("/api/hsn-gst-rates", { hsn: "240220", gst_rate: 40, description: "Cigarettes" }, adminToken);
    expect(res.status).toBe(200);
    const data = await (await get("/api/hsn-gst?hsn=240220", adminToken)).json() as { gst_rate: number; matched: boolean };
    expect(data.gst_rate).toBe(40);
  });

  // Production runs on the self-heal path (deploy does NOT apply migrations/*.sql),
  // so the 4-digit→6-digit standardisation must also work at runtime, once.
  it("runtime migrateHsnTo6Digit replaces 4-digit rows/codes and is guarded to run once", async () => {
    const db = env.DB as D1Database;
    // Simulate a pre-migration DB: a 4-digit map row, an item on that code, a 2101 default.
    await db.prepare("INSERT OR REPLACE INTO hsn_gst_rates (hsn,gst_rate,description) VALUES ('2202',28,'legacy 4-digit')").run();
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code) VALUES ('HSN4','Legacy Cola','Beverages',30,0,1,'2202')").run();
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code) VALUES ('HSNDEF','Defaulted','Grocery',10,0,1,'2101')").run();
    await db.prepare("DELETE FROM app_config WHERE key='hsn_6digit_migrated'").run();

    await migrateHsnTo6Digit(env);

    expect(await getCfg("hsn_6digit_migrated")).toBe("1");
    expect(await (db.prepare("SELECT 1 FROM hsn_gst_rates WHERE hsn='2202'").first())).toBeNull(); // 4-digit row gone
    const item = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='HSN4'").first() as { hsn_code: string };
    expect(item.hsn_code).toBe("220210"); // remapped to 6-digit
    const def = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='HSNDEF'").first() as { hsn_code: string };
    expect(def.hsn_code).toBe(""); // 2101 default retired

    // Guard: re-adding a 4-digit code and re-running must NOT touch it (flag set).
    await db.prepare("INSERT OR REPLACE INTO hsn_gst_rates (hsn,gst_rate,description) VALUES ('0901',5,'re-added by admin')").run();
    await migrateHsnTo6Digit(env);
    expect(await (db.prepare("SELECT 1 FROM hsn_gst_rates WHERE hsn='0901'").first())).not.toBeNull();
  });

  // GST 2.0: aerated drinks reconciled to 40% often carried no HSN, so GST showed
  // without a matching HSN code. Backfill stamps 220210 onto 40% items missing one.
  it("runtime migrateBackfillAeratedHsn tags 40% items lacking an HSN with 220210, guarded once", async () => {
    const db = env.DB as D1Database;
    // A 40% item with no HSN (the reported "Monster" case), and one with an explicit HSN.
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES ('AER1','Monster Energy','Beverages',125,0,1,'',40)").run();
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES ('AER2','Tagged Cola','Beverages',30,0,1,'220120',40)").run();
    await db.prepare("DELETE FROM app_config WHERE key='aerated_hsn_backfilled'").run();

    await migrateBackfillAeratedHsn(env);

    expect(await getCfg("aerated_hsn_backfilled")).toBe("1");
    const filled = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='AER1'").first() as { hsn_code: string };
    expect(filled.hsn_code).toBe("220210"); // blank HSN backfilled
    const kept = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='AER2'").first() as { hsn_code: string };
    expect(kept.hsn_code).toBe("220120"); // explicit HSN left untouched

    // Guard: a new 40%-without-HSN item added later is NOT retagged (flag is set).
    await db.prepare("INSERT OR REPLACE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES ('AER3','Later Fizz','Beverages',20,0,1,'',40)").run();
    await migrateBackfillAeratedHsn(env);
    const later = await db.prepare("SELECT hsn_code FROM inventory WHERE sku='AER3'").first() as { hsn_code: string };
    expect(later.hsn_code).toBe("");
  });
});

// ── Order lifecycle & pipeline (projection endpoints) ────────────────
describe("Order lifecycle & pipeline board", () => {
  const pdb = env.DB as D1Database;
  beforeAll(async () => {
    await pdb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,1)").bind("PIPE-CL", "Pipeline Co").run();
    await pdb.prepare("INSERT OR IGNORE INTO vendors (id,name,category,active) VALUES (?,?,?,1)").bind("PIPE-V", "PipeVendor", "Grocery").run();
    await pdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-6 day'))`).bind("PIPE-1", "PIPE-CL", "seed-user", "IN_SHIPMENT", 120000, 22360, 142360, "Regular").run();
    // status transitions
    const hist: [string, string, string][] = [
      ["SUBMITTED", "Rahul", "-6 day"], ["PENDING_APPROVAL", "Rahul", "-6 day"], ["APPROVED", "Priya", "-6 day"],
      ["INVENTORY_CHECK", "Desk", "-6 day"], ["VENDOR_PO_RAISED", "Anand", "-6 day"], ["IN_SHIPMENT", "Desk", "-4 day"],
    ];
    for (let i = 0; i < hist.length; i++) {
      await pdb.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note,created_at)
        VALUES (?,?,?,?,?,?,?,datetime('now',?))`).bind(`H-PIPE-${i}`, "PIPE-1", null, hist[i][0], "u", hist[i][1], hist[i][0]==="PENDING_APPROVAL"?"₹1.42L over ₹1.00L":null, hist[i][2]).run();
    }
    // shortage → vendor PO
    await pdb.prepare(`INSERT INTO purchase_orders (id,vendor_id,order_id,status,grand_total,created_at)
      VALUES (?,?,?,?,?,datetime('now','-6 day'))`).bind("PO-PIPE", "PIPE-V", "PIPE-1", "RECEIVED", 30000).run();
    // partial multi-DC delivery: one delivered+POD, one still in transit
    await pdb.prepare(`INSERT INTO delivery_challans (id,order_id,dc_number,status,dispatched_at,delivered_at,pod_uploaded,billed,total_qty,delivered_qty)
      VALUES (?,?,?,?,datetime('now','-4 day'),datetime('now','-4 day'),1,0,9,9)`).bind("DC-PIPE-1", "PIPE-1", "DC-PIPE-1", "DELIVERED").run();
    await pdb.prepare(`INSERT INTO delivery_challans (id,order_id,dc_number,status,dispatched_at,delivered_at,pod_uploaded,billed,total_qty,delivered_qty)
      VALUES (?,?,?,?,datetime('now','-4 day'),NULL,0,0,3,0)`).bind("DC-PIPE-2", "PIPE-1", "DC-PIPE-2", "IN_TRANSIT").run();
  });

  it("GET /api/orders/:id/lifecycle returns all 10 stages with derived states", async () => {
    const res = await get("/api/orders/PIPE-1/lifecycle", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { stages: Array<{key:string;state:string}>; current_key: string; progress: {total:number} };
    expect(d.stages.length).toBe(10);
    const st = (k: string) => d.stages.find(s => s.key === k)!.state;
    expect(st("client")).toBe("done");
    expect(st("vendor_po")).toBe("done");   // a PO exists (shortage branch)
    expect(st("dispatch")).toBe("done");
    expect(st("delivery")).toBe("current");  // 1 of 2 challans delivered
    expect(st("pod")).toBe("current");       // 1 of 2 PODs captured
    expect(st("billing")).toBe("pending");
    expect(d.current_key).toBe("delivery");
  });

  it("lifecycle marks Vendor PO as skipped when the order was filled from stock", async () => {
    await pdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-1 day'))`).bind("PIPE-2", "PIPE-CL", "seed-user", "READY_TO_PICK", 5000, 900, 5900, "Regular").run();
    await pdb.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,created_at)
      VALUES (?,?,?,?,?,?,datetime('now','-1 day'))`).bind("H-PIPE2-0", "PIPE-2", null, "INVENTORY_CHECK", "u", "Desk").run();
    const d = await (await get("/api/orders/PIPE-2/lifecycle", adminToken)).json() as { stages: Array<{key:string;state:string}> };
    expect(d.stages.find(s => s.key === "vendor_po")!.state).toBe("skipped");
  });

  it("GET /api/pipeline buckets in-flight orders by stage with KPIs", async () => {
    const res = await get("/api/pipeline", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { kpis: {inflight:number}; buckets: Array<{key:string;count:number;orders:Array<{id:string}>}> };
    expect(d.kpis.inflight).toBeGreaterThanOrEqual(1);
    expect(d.buckets.length).toBe(7);
    const delivery = d.buckets.find(b => b.key === "delivery")!;
    expect(delivery.orders.some(o => o.id === "PIPE-1")).toBe(true);
  });

  it("GET /api/pipeline is forbidden for external (client) roles", async () => {
    const res = await get("/api/pipeline", clientToken);
    expect(res.status).toBe(403);
  });

  it("GET /api/pipeline returns a newest-first recent list for the Home widget", async () => {
    const d = await (await get("/api/pipeline", adminToken)).json() as { recent: Array<{id:string;stage_key:string;stage_no:number}> };
    expect(Array.isArray(d.recent)).toBe(true);
    const row = d.recent.find(r => r.id === "PIPE-1");
    expect(row).toBeTruthy();
    expect(row!.stage_key).toBe("delivery");
    expect(row!.stage_no).toBe(8);
  });

  it("GET /api/pipeline/sla returns defaults when unset", async () => {
    const d = await (await get("/api/pipeline/sla", adminToken)).json() as { targets: Record<string,number>; risk_pace: number };
    expect(d.targets.vendor_po).toBe(2);
    expect(d.risk_pace).toBe(0.6);
  });

  it("POST /api/pipeline/sla saves targets that the GET then reflects", async () => {
    const res = await post("/api/pipeline/sla", { targets: { vendor_po: 5, delivery: 3 }, risk_pace: 0.5 }, adminToken);
    expect(res.status).toBe(200);
    const d = await (await get("/api/pipeline/sla", adminToken)).json() as { targets: Record<string,number>; risk_pace: number };
    expect(d.targets.vendor_po).toBe(5);
    expect(d.targets.delivery).toBe(3);
    expect(d.targets.approval).toBe(1); // untouched → default
    expect(d.risk_pace).toBe(0.5);
  });

  it("POST /api/pipeline/sla clamps out-of-range values back to defaults", async () => {
    await post("/api/pipeline/sla", { targets: { vendor_po: 999, dispatch: -4 }, risk_pace: 5 }, adminToken);
    const d = await (await get("/api/pipeline/sla", adminToken)).json() as { targets: Record<string,number>; risk_pace: number };
    expect(d.targets.vendor_po).toBe(2);   // 999 > 60 → default
    expect(d.targets.dispatch).toBe(1);    // negative → default
    expect(d.risk_pace).toBe(0.6);         // 5 out of (0,1) → default
  });

  it("POST /api/pipeline/sla is forbidden for external (client) roles", async () => {
    const res = await post("/api/pipeline/sla", { targets: { vendor_po: 3 } }, clientToken);
    expect(res.status).toBe(403);
  });
});

// ── Over-delivery guard (dispatch) + Next Best Action ────────────────
describe("Over-delivery guard & Next Best Action", () => {
  const gdb = env.DB as D1Database;
  beforeAll(async () => {
    await gdb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,1)").bind("OD-CL", "OverDeliver Co").run();

    // Order fully delivered (8/8), but a phantom SCHEDULED challan lingers.
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-3 day'))`).bind("OD-1", "OD-CL", "seed", "IN_SHIPMENT", 8000, 0, 8000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-OD-1", "OD-1", "SKU-OD", "Widget", 8, 1000, 8000).run();
    // DC1 delivered all 8
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,dispatched_at,delivered_at)
      VALUES (?,?,?,?,?,datetime('now','-2 day'),datetime('now','-2 day'))`).bind("OD-DC1", "OD-1", "DELIVERED", 8, 8).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-OD-1", "OD-DC1", "SKU-OD", "Widget", 8, 8).run();
    // Phantom DC2 still SCHEDULED — nothing left due against the order
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty)
      VALUES (?,?,?,?,?)`).bind("OD-DC2", "OD-1", "SCHEDULED", 8, 0).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-OD-2", "OD-DC2", "SKU-OD", "Widget", 8, 0).run();

    // A legitimately pending order: nothing delivered yet, one SCHEDULED DC.
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-1 day'))`).bind("OD-2", "OD-CL", "seed", "READY_TO_PICK", 5000, 0, 5000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-OD-2", "OD-2", "SKU-OD2", "Gadget", 5, 1000, 5000).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty) VALUES (?,?,?,?,?)`)
      .bind("OD-DC3", "OD-2", "SCHEDULED", 5, 0).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-OD-3", "OD-DC3", "SKU-OD2", "Gadget", 5, 0).run();
  });

  it("blocks dispatch of a phantom challan on a fully-delivered order (409 OVER_DELIVERY)", async () => {
    const res = await post("/api/delivery-challans/OD-DC2/dispatch", { vehicle_no: "KA01AB1234", driver_name: "Ravi" }, adminToken);
    expect(res.status).toBe(409);
    const body = await res.json() as { code:string; dc_cancelled:boolean; order_closed:boolean };
    expect(body.code).toBe("OVER_DELIVERY");
    expect(body.dc_cancelled).toBe(true);

    // The phantom challan is cancelled and never flips to IN_TRANSIT …
    const dc = await gdb.prepare("SELECT status FROM delivery_challans WHERE id=?").bind("OD-DC2").first() as {status:string};
    expect(dc.status).toBe("CANCELLED");
    // … and the settled order is auto-closed.
    const ord = await gdb.prepare("SELECT status FROM orders WHERE id=?").bind("OD-1").first() as {status:string};
    expect(ord.status).toBe("CLOSED");
  });

  it("still allows dispatch when the order genuinely has units outstanding", async () => {
    const res = await post("/api/delivery-challans/OD-DC3/dispatch", { vehicle_no: "KA02CD5678", driver_name: "Anil" }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { status:string };
    expect(body.status).toBe("IN_TRANSIT");
  });

  it("GET /api/pipeline/next-actions returns one ranked next step per in-flight order", async () => {
    const res = await get("/api/pipeline/next-actions", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as {
      counts:{total:number;overdue:number;at_risk:number;on_track:number};
      actions:Array<{id:string;action:string;owner:string;sla:string;page:string;stage_key:string}>;
      focus:{id:string}|null;
    };
    expect(Array.isArray(d.actions)).toBe(true);
    expect(d.counts.total).toBe(d.actions.length);
    // OD-2 (ready to pick) surfaces a "Dispatch challan" step owned by the warehouse.
    const od2 = d.actions.find(a => a.id === "OD-2");
    expect(od2).toBeTruthy();
    expect(od2!.stage_key).toBe("dispatch");
    expect(od2!.action).toBe("Dispatch challan");
    // Every open action carries an owner and a target page to act on.
    expect(od2!.owner).toBe("Warehouse");
    expect(od2!.page).toBe("fulfilment");
    // Ranking: the focus is the first action and is the most urgent (late before ok).
    if (d.focus) expect(d.focus.id).toBe(d.actions[0].id);
  });

  it("GET /api/pipeline/next-actions is forbidden for external (client) roles", async () => {
    const res = await get("/api/pipeline/next-actions", clientToken);
    expect(res.status).toBe(403);
  });

  it("drilldown clamps delivered to ordered and flags over-delivery instead of showing >100%", async () => {
    // Reproduce the SP-2608-7410 shape: 582 ordered, but a full DC + a phantom
    // follow-up DC both marked DELIVERED sum to 960 (165%).
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-2 day'))`).bind("OD-165", "OD-CL", "seed", "CLOSED", 582000, 0, 582000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-165", "OD-165", "SKU-165", "Rice 25kg", 582, 1000, 582000).run();
    // DC-A delivered the full 582
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("DC-165A", "OD-165", "DELIVERED", 582, 582).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-165A", "DC-165A", "SKU-165", "Rice 25kg", 582, 582).run();
    // DC-B: phantom follow-up, also marked DELIVERED, adding 378 more (582+378=960)
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("DC-165B", "OD-165", "DELIVERED", 378, 378).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-165B", "DC-165B", "SKU-165", "Rice 25kg", 378, 378).run();

    const d = await (await get("/api/orders/OD-165/drilldown", adminToken)).json() as {
      lines: Array<{qty_ordered:number;qty_delivered:number;qty_delivered_raw:number;qty_over_delivered:number;qty_due:number;status:string}>;
      summary: {has_anomaly:boolean;total_over_delivered:number;over_delivered_lines:number;total_delivered_value:number;total_ordered_value:number};
    };
    const line = d.lines.find(l => true)!;
    expect(line.qty_ordered).toBe(582);
    expect(line.qty_delivered_raw).toBe(960);      // the raw over-count is preserved for diagnosis
    expect(line.qty_delivered).toBe(582);          // …but reported delivered is clamped to ordered
    expect(line.qty_over_delivered).toBe(378);     // surplus surfaced as an anomaly
    expect(line.qty_due).toBe(0);
    expect(line.status).toBe("over_delivered");
    expect(d.summary.has_anomaly).toBe(true);
    expect(d.summary.total_over_delivered).toBe(378);
    // Value delivered never exceeds value ordered.
    expect(d.summary.total_delivered_value).toBeLessThanOrEqual(d.summary.total_ordered_value);
  });

  it("over-delivery audit (read-only) finds the offending order + names the challans", async () => {
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-2 day'))`).bind("AUD-1", "OD-CL", "seed", "CLOSED", 582000, 0, 582000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-AUD", "AUD-1", "SKU-AUD", "Rice 25kg", 582, 1000, 582000).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("AUD-DCA", "AUD-1", "DELIVERED", 582, 582).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("AUDI-A", "AUD-DCA", "SKU-AUD", "Rice 25kg", 582, 582).run();
    // Phantom follow-up marked DELIVERED with qty_delivered=0 → counted at full 378 via fallback.
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("AUD-DCB", "AUD-1", "DELIVERED", 378, 0).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("AUDI-B", "AUD-DCB", "SKU-AUD", "Rice 25kg", 378, 0).run();

    const res = await get("/api/reports/over-delivery-audit", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as {
      read_only:boolean;
      summary:{orders_affected:number;lines_affected:number;total_over_units:number};
      anomalies:Array<{order_id:string;sku:string;ordered:number;delivered_effective:number;over_units:number;
        challans:Array<{dc_id:string;status:string;suspect:boolean;counted_as:number}>}>;
    };
    expect(d.read_only).toBe(true);
    const a = d.anomalies.find(x => x.order_id === "AUD-1");
    expect(a).toBeTruthy();
    expect(a!.ordered).toBe(582);
    expect(a!.delivered_effective).toBe(960);   // 582 + 378 counted via the fallback
    expect(a!.over_units).toBe(378);
    // The phantom challan is named and flagged as the suspect (delivered, qty not recorded).
    const phantom = a!.challans.find(dc => dc.dc_id === "AUD-DCB");
    expect(phantom!.suspect).toBe(true);
    expect(phantom!.counted_as).toBe(378);
  });

  it("over-delivery audit is forbidden for external (client) roles", async () => {
    const res = await get("/api/reports/over-delivery-audit", clientToken);
    expect(res.status).toBe(403);
  });

  // Repair scenario: 582 ordered; DC-R-A delivered the real 582; DC-R-B is a
  // phantom (DELIVERED, qty_delivered=0) adding 378 via the fallback.
  async function seedRepairOrder() {
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-2 day'))`).bind("REP-1", "OD-CL", "seed", "IN_SHIPMENT", 582000, 0, 582000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-REP", "REP-1", "SKU-REP", "Rice 25kg", 582, 1000, 582000).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("DC-R-A", "REP-1", "DELIVERED", 582, 582).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-R-A", "DC-R-A", "SKU-REP", "Rice 25kg", 582, 582).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("DC-R-B", "REP-1", "DELIVERED", 378, 0).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DI-R-B", "DC-R-B", "SKU-REP", "Rice 25kg", 378, 0).run();
  }

  it("repair dry-run flags the phantom eligible, protects the real challan, and writes nothing", async () => {
    await seedRepairOrder();
    // Dry-run defaults to true even without the flag.
    const res = await post("/api/reports/over-delivery-audit/repair", { dc_ids: ["DC-R-B", "DC-R-A"] }, adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { dry_run:boolean; eligible:number; applied:number;
      results:Array<{dc_id:string;eligible:boolean;reason:string;skus:Array<{delivered_after:number;ordered:number}>}> };
    expect(d.dry_run).toBe(true);
    expect(d.applied).toBe(0);
    const b = d.results.find(r => r.dc_id === "DC-R-B")!;
    expect(b.eligible).toBe(true);                 // phantom: no stock, pure surplus
    expect(b.skus[0].delivered_after).toBe(582);   // order still fully satisfied after removal
    const a = d.results.find(r => r.dc_id === "DC-R-A")!;
    expect(a.eligible).toBe(false);                // real challan: removing it would cause a shortfall
    // Nothing mutated on a dry run.
    const stillThere = await gdb.prepare("SELECT status FROM delivery_challans WHERE id=?").bind("DC-R-B").first() as {status:string};
    expect(stillThere.status).toBe("DELIVERED");
  });

  it("repair apply cancels only the phantom, closes the reconciled order, and leaves the real challan", async () => {
    await seedRepairOrder();
    const res = await post("/api/reports/over-delivery-audit/repair", { dry_run: false, dc_ids: ["DC-R-A", "DC-R-B"] }, adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { applied:number; orders_closed:string[] };
    expect(d.applied).toBe(1);                     // only DC-R-B
    const b = await gdb.prepare("SELECT status FROM delivery_challans WHERE id=?").bind("DC-R-B").first() as {status:string};
    expect(b.status).toBe("CANCELLED");
    const a = await gdb.prepare("SELECT status FROM delivery_challans WHERE id=?").bind("DC-R-A").first() as {status:string};
    expect(a.status).toBe("DELIVERED");            // real challan untouched
    // Order is now exactly satisfied (582/582) → closed, and audit shows no anomaly.
    const drill = await (await get("/api/orders/REP-1/drilldown", adminToken)).json() as { summary:{has_anomaly:boolean}; lines:Array<{qty_delivered:number;qty_over_delivered:number}> };
    expect(drill.summary.has_anomaly).toBe(false);
    expect(drill.lines[0].qty_delivered).toBe(582);
    expect(drill.lines[0].qty_over_delivered).toBe(0);
  });

  it("repair is forbidden for external (client) roles", async () => {
    const res = await post("/api/reports/over-delivery-audit/repair", { dc_ids: ["DC-R-B"] }, clientToken);
    expect(res.status).toBe(403);
  });

  // A surplus challan that RECORDED a delivery (moved stock): plain repair refuses
  // it; reverse_stock voids it and adds the units back to inventory.
  async function seedStockOrder() {
    await gdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,1)")
      .bind("SKU-STK", "Sugar", "Grocery", 50, 200).run();
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-2 day'))`).bind("STK-1", "OD-CL", "seed", "IN_SHIPMENT", 5000, 0, 5000, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("OI-STK", "STK-1", "SKU-STK", "Sugar", 100, 50, 5000).run();
    // Real DC delivered the full 100 (recorded)
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("STK-DCA", "STK-1", "DELIVERED", 100, 100).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("STKI-A", "STK-DCA", "SKU-STK", "Sugar", 100, 100).run();
    // Surplus DC that ALSO recorded 40 delivered (over-delivered → 140/100)
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`)
      .bind("STK-DCB", "STK-1", "DELIVERED", 40, 40).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("STKI-B", "STK-DCB", "SKU-STK", "Sugar", 40, 40).run();
  }

  it("a partial multi-challan delivery is NOT a false over-delivery (SP-2608-7410 shape)", async () => {
    // Two SKUs, each ordered 96. DC-1 delivers SKU-A (96) and 0 of SKU-B;
    // DC-2 delivers SKU-B (96) and 0 of SKU-A. Both DELIVERED → 96/96 each,
    // fully but partially split. The old per-line fallback wrongly counted the
    // 0 lines at full ordered load (192/192); the per-challan fallback must not.
    await gdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now','-2 day'))`).bind("MC-1", "OD-CL", "seed", "CLOSED", 9600, 0, 9600, "Regular").run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind("OI-MCA", "MC-1", "MC-A", "Noodles A", 96, 50, 4800).run();
    await gdb.prepare("INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind("OI-MCB", "MC-1", "MC-B", "Noodles B", 96, 50, 4800).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`).bind("MC-DC1", "MC-1", "DELIVERED", 192, 96).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)").bind("MCI-1A", "MC-DC1", "MC-A", "Noodles A", 96, 96).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)").bind("MCI-1B", "MC-DC1", "MC-B", "Noodles B", 96, 0).run();
    await gdb.prepare(`INSERT INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,delivered_at) VALUES (?,?,?,?,?,datetime('now','-1 day'))`).bind("MC-DC2", "MC-1", "DELIVERED", 192, 96).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)").bind("MCI-2A", "MC-DC2", "MC-A", "Noodles A", 96, 0).run();
    await gdb.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)").bind("MCI-2B", "MC-DC2", "MC-B", "Noodles B", 96, 96).run();

    // Drilldown shows exactly 96/96 per line, no anomaly.
    const drill = await (await get("/api/orders/MC-1/drilldown", adminToken)).json() as {
      summary:{has_anomaly:boolean;total_over_delivered:number};
      lines:Array<{sku:string;qty_delivered:number;qty_over_delivered:number}> };
    expect(drill.summary.has_anomaly).toBe(false);
    expect(drill.summary.total_over_delivered).toBe(0);
    for (const l of drill.lines) { expect(l.qty_delivered).toBe(96); expect(l.qty_over_delivered).toBe(0); }

    // The audit does not flag it as over-delivered.
    const audit = await (await get("/api/reports/over-delivery-audit", adminToken)).json() as { anomalies:Array<{order_id:string}> };
    expect(audit.anomalies.some(a => a.order_id === "MC-1")).toBe(false);
  });

  it("plain repair refuses a stock-moving surplus challan and points to reverse_stock", async () => {
    await seedStockOrder();
    const res = await post("/api/reports/over-delivery-audit/repair", { dc_ids: ["STK-DCB"] }, adminToken);
    const d = await res.json() as { eligible:number; results:Array<{eligible:boolean;reason:string}> };
    expect(d.eligible).toBe(0);
    expect(d.results[0].eligible).toBe(false);
    expect(d.results[0].reason).toContain("reverse_stock");
  });

  it("reverse_stock voids the surplus challan and adds the units back to inventory", async () => {
    await seedStockOrder();
    // Preview
    const prev = await (await post("/api/reports/over-delivery-audit/repair", { dry_run:true, reverse_stock:true, dc_ids:["STK-DCB"] }, adminToken)).json() as {
      results:Array<{eligible:boolean;reverses_stock:boolean;skus:Array<{stock_reversal:number}>}> };
    expect(prev.results[0].eligible).toBe(true);
    expect(prev.results[0].reverses_stock).toBe(true);
    expect(prev.results[0].skus[0].stock_reversal).toBe(40);

    const before = await gdb.prepare("SELECT stock FROM inventory WHERE sku=?").bind("SKU-STK").first() as {stock:number};
    const res = await post("/api/reports/over-delivery-audit/repair", { dry_run:false, reverse_stock:true, dc_ids:["STK-DCB"] }, adminToken);
    const d = await res.json() as { applied:number; stock_reversed:number };
    expect(d.applied).toBe(1);
    expect(d.stock_reversed).toBe(40);
    const after = await gdb.prepare("SELECT stock FROM inventory WHERE sku=?").bind("SKU-STK").first() as {stock:number};
    expect(after.stock - before.stock).toBe(40);            // stock added back
    const dc = await gdb.prepare("SELECT status FROM delivery_challans WHERE id=?").bind("STK-DCB").first() as {status:string};
    expect(dc.status).toBe("CANCELLED");
    // Order reconciled to exactly 100/100 → no anomaly.
    const drill = await (await get("/api/orders/STK-1/drilldown", adminToken)).json() as { summary:{has_anomaly:boolean} };
    expect(drill.summary.has_anomaly).toBe(false);
    // A reversing stock movement is recorded.
    const mv = await gdb.prepare("SELECT COUNT(*) c FROM stock_movements WHERE reference_id=? AND type='DELIVERY_REVERSAL'").bind("STK-DCB").first() as {c:number};
    expect(mv.c).toBeGreaterThanOrEqual(1);
  });
});

// ── Live sidebar badge counts (#6) ───────────────────────────────────
describe("Nav badge counts", () => {
  const ndb = env.DB as D1Database;
  beforeAll(async () => {
    await ndb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,1)").bind("NB-CL", "Badge Co").run();
    await ndb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'))`).bind("NB-APPR", "NB-CL", "seed", "PENDING_APPROVAL", 1000, 0, 1000, "Regular").run();
    await ndb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'))`).bind("NB-PICK", "NB-CL", "seed", "READY_TO_PICK", 1000, 0, 1000, "Regular").run();
    // A delivered-but-unbilled challan → billing badge
    await ndb.prepare(`INSERT INTO delivery_challans (id,order_id,status,billed,total_qty,delivered_qty,delivered_at)
      VALUES (?,?,?,0,5,5,datetime('now'))`).bind("NB-DC", "NB-PICK", "DELIVERED").run();
  });

  it("returns live counts keyed by nav page id for internal roles", async () => {
    const res = await get("/api/nav-badges", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as Record<string, number>;
    // Keys present and numeric
    for (const k of ["next_actions","orders","consolidated_due","fulfilment","dc_billing","sla_dashboard","alerts"]) {
      expect(typeof d[k]).toBe("number");
    }
    // Seeded rows are reflected (≥, since the base seed may add more).
    expect(d.orders).toBeGreaterThanOrEqual(1);       // NB-APPR pending approval
    expect(d.fulfilment).toBeGreaterThanOrEqual(1);   // NB-PICK ready to pick
    expect(d.dc_billing).toBeGreaterThanOrEqual(1);   // NB-DC delivered unbilled
    expect(d.next_actions).toBeGreaterThanOrEqual(1); // includes pending approvals
  });

  it("returns an empty object for external (client) roles — no badged menus", async () => {
    const res = await get("/api/nav-badges", clientToken);
    expect(res.status).toBe(200);
    const d = await res.json() as Record<string, number>;
    expect(Object.keys(d).length).toBe(0);
  });
});

// ── Picking: a 0/blank line records as 0, never the ordered total ─────
describe("Pick — zero/blank line records its actual qty", () => {
  const pdb = env.DB as D1Database;
  beforeAll(async () => {
    await pdb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,1)").bind("PK-CL", "Pick Co").run();
    await pdb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'))`).bind("PK-1", "PK-CL", "seed", "READY_TO_PICK", 1000, 0, 1000, "Regular").run();
    await pdb.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind("PK-OI-A", "PK-1", "PK-A", "Item A", 10, 10, 100).run();
    await pdb.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind("PK-OI-B", "PK-1", "PK-B", "Item B", 5, 10, 50).run();
  });

  it("records a 0-qty line as 0 (not the ordered total) and the picklist surfaces it", async () => {
    const res = await post("/api/orders/PK-1/pick", { items: [
      { sku: "PK-A", name: "Item A", qty: 10, bin_code: "" },
      { sku: "PK-B", name: "Item B", qty: 0,  bin_code: "" },
    ], partial: true }, adminToken);
    expect(res.status).toBe(200);

    // Allocations record the actual picked qty per line, 0 included.
    const { results } = await pdb.prepare("SELECT sku, qty FROM order_allocations WHERE order_id='PK-1'").all() as { results: {sku:string; qty:number}[] };
    const bySku = Object.fromEntries(results.map(r => [r.sku, r.qty]));
    expect(bySku["PK-A"]).toBe(10);
    expect(bySku["PK-B"]).toBe(0); // recorded as 0 — NOT defaulted to the ordered 5

    // ...and the picklist exposes picked_qty so a short/zero pick is visible.
    const rows = await (await get("/api/orders/picklist", adminToken)).json() as { order_id:string; sku:string; picked_qty:number|null }[];
    const mine = rows.filter(r => r.order_id === "PK-1");
    expect(mine.find(r => r.sku === "PK-A")?.picked_qty).toBe(10);
    expect(mine.find(r => r.sku === "PK-B")?.picked_qty).toBe(0);
  });
});

// ── Dispatch: one capture, system-owned DC number ────────────────────
describe("Dispatch — single capture with a system DC number", () => {
  const ddb = env.DB as D1Database;
  beforeAll(async () => {
    await ddb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('DSP-CL','Dispatch Co',1)").run();
    await ddb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES ('DSP-1','DSP-CL','seed','PICKED',1000,0,1000,'Regular',datetime('now'))`).run();
    await ddb.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('DSP-OI','DSP-1','DSP-A','Item A',4,10,40)").run();
  });

  it("auto-numbers the challan on IN_SHIPMENT and dispatches staff+time in one call", async () => {
    const t = await post("/api/orders/DSP-1/transition", { to: "IN_SHIPMENT", note: "dispatch" }, adminToken);
    expect(t.status).toBe(200);
    const dc = await ddb.prepare("SELECT id, dc_number, status FROM delivery_challans WHERE order_id='DSP-1'").first() as { id:string; dc_number:string; status:string } | null;
    expect(dc).toBeTruthy();
    expect(String(dc!.dc_number)).toMatch(/^DCN-\d{5}$/); // system-assigned, never typed
    expect(dc!.status).toBe("SCHEDULED");

    // A single dispatch call carries staff_id + scheduled_time — no follow-up PATCH.
    const d = await post(`/api/delivery-challans/${dc!.id}/dispatch`, {
      vehicle_no: "MH12-AB-1234", driver_name: "Rajesh", staff_id: "stf-1", scheduled_time: "09:30",
    }, adminToken);
    expect(d.status).toBe(200);
    const after = await ddb.prepare("SELECT status, vehicle_no, staff_id, scheduled_time FROM delivery_challans WHERE id=?").bind(dc!.id).first() as { status:string; vehicle_no:string; staff_id:string; scheduled_time:string };
    expect(after.status).toBe("IN_TRANSIT");
    expect(after.vehicle_no).toBe("MH12-AB-1234");
    expect(after.staff_id).toBe("stf-1");
    expect(after.scheduled_time).toBe("09:30");
  });

  it("GET /api/delivery-challans/:id returns the single challan for pre-fill", async () => {
    await ddb.prepare(`INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES ('DSP-2','DSP-CL','seed','PICKED',500,0,500,'Regular',datetime('now'))`).run();
    await ddb.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('DSP-OI2','DSP-2','DSP-B','Item B',2,10,20)").run();
    await post("/api/orders/DSP-2/transition", { to: "IN_SHIPMENT", note: "x" }, adminToken);
    const dc = await ddb.prepare("SELECT id FROM delivery_challans WHERE order_id='DSP-2'").first() as { id:string };
    const res = await get(`/api/delivery-challans/${dc.id}`, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { id:string; dc_number:string };
    expect(body.id).toBe(dc.id);
    expect(String(body.dc_number)).toMatch(/^DCN-/);
  });
});

// ── Delivery discrepancy: voice + manager approval before DELIVERED ───
describe("Delivery discrepancy approval", () => {
  const vdb = env.DB as D1Database;
  beforeAll(async () => {
    await vdb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('VC-CL','Variance Co',1)").run();
    await vdb.prepare(`INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at)
      VALUES ('VD-1','VC-CL','seed','IN_SHIPMENT',1000,0,1000,'Regular',datetime('now'))`).run();
    await vdb.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('VD-OIA','VD-1','VD-A','Item A',10,10,100)").run();
    await vdb.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('VD-OIB','VD-1','VD-B','Item B',5,10,50)").run();
    await vdb.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('VDC-1','VD-1','IN_TRANSIT',15,'DCN-90001')").run();
    await vdb.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('VDI-A','VDC-1','VD-A','Item A',10,0)").run();
    await vdb.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('VDI-B','VDC-1','VD-B','Item B',5,0)").run();
  });
  const addVoice = () => vdb.prepare("INSERT INTO dc_documents (dc_id,doc_type,filename,mime_type,content_b64,file_size,uploaded_by) VALUES ('VDC-1','voice','n.webm','audio/webm','AAAA',4,'driver')").run();

  it("an exact delivery finalizes immediately (no approval needed)", async () => {
    const res = await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:10},{sku:'VD-B',qty_delivered:5}] }, adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { status:string };
    expect(d.status).toBe("DELIVERED");
  });

  it("a short delivery is blocked without a voice note, then held for approval with one", async () => {
    const noVoice = await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:8},{sku:'VD-B',qty_delivered:5}] }, adminToken);
    expect(noVoice.status).toBe(400);
    expect((await noVoice.json() as {code:string}).code).toBe("VOICE_REQUIRED");

    await addVoice();
    const held = await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:8},{sku:'VD-B',qty_delivered:5}], variance_note:'2 damaged' }, adminToken);
    expect(held.status).toBe(200);
    expect((await held.json() as {pending_approval:boolean}).pending_approval).toBe(true);
    const dc = await vdb.prepare("SELECT status, delivery_approval FROM delivery_challans WHERE id='VDC-1'").first() as { status:string; delivery_approval:string };
    expect(dc.status).toBe("IN_TRANSIT");           // NOT delivered yet
    expect(dc.delivery_approval).toBe("PENDING");
  });

  it("approving a held delivery finalizes with the proposed quantities", async () => {
    await addVoice();
    await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:8},{sku:'VD-B',qty_delivered:5}], variance_note:'x' }, adminToken);
    const res = await post("/api/delivery-challans/VDC-1/deliver-decision", { decision:'approve' }, adminToken);
    expect(res.status).toBe(200);
    const dc = await vdb.prepare("SELECT status, delivery_approval FROM delivery_challans WHERE id='VDC-1'").first() as { status:string; delivery_approval:string };
    expect(dc.status).toBe("DELIVERED");
    expect(dc.delivery_approval).toBe("APPROVED");
    const a = await vdb.prepare("SELECT qty_delivered FROM dc_items WHERE id='VDI-A'").first() as { qty_delivered:number };
    expect(a.qty_delivered).toBe(8); // the approved (short) quantity, not the dispatched 10
  });

  it("rejecting a held delivery leaves it in transit for re-delivery", async () => {
    await addVoice();
    await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:8},{sku:'VD-B',qty_delivered:5}], variance_note:'x' }, adminToken);
    const res = await post("/api/delivery-challans/VDC-1/deliver-decision", { decision:'reject' }, adminToken);
    expect(res.status).toBe(200);
    const dc = await vdb.prepare("SELECT status, delivery_approval FROM delivery_challans WHERE id='VDC-1'").first() as { status:string; delivery_approval:string };
    expect(dc.status).toBe("IN_TRANSIT");
    expect(dc.delivery_approval).toBe("REJECTED");
  });

  it("only super_admin/ops_admin can decide a held delivery", async () => {
    await addVoice();
    await post("/api/delivery-challans/VDC-1/deliver", { items:[{sku:'VD-A',qty_delivered:8},{sku:'VD-B',qty_delivered:5}], variance_note:'x' }, adminToken);
    const res = await post("/api/delivery-challans/VDC-1/deliver-decision", { decision:'approve' }, clientToken);
    expect(res.status).toBe(403);
  });
});

// ── Reorder skip-open-PO guard ───────────────────────────────────────
describe("from-demand skip_open_po guard", () => {
  const rdb = env.DB as D1Database;
  beforeAll(async () => {
    await rdb.prepare("INSERT OR IGNORE INTO vendors (id,name,category,active) VALUES (?,?,?,1)").bind("RV1", "ReVendor", "Grocery").run();
    await rdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,1)").bind("RSK-1", "ReItem", "Grocery", 10, 0).run();
    // An open (SENT) PO already covers RSK-1.
    await rdb.prepare("INSERT INTO purchase_orders (id,vendor_id,status,grand_total) VALUES (?,?,?,?)").bind("RPO-1", "RV1", "SENT", 100).run();
    await rdb.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)").bind("RPI-1", "RPO-1", "RSK-1", "ReItem", 10, 10, 100).run();
  });

  it("skips a SKU that already has an open PO (no duplicate re-order)", async () => {
    const res = await post("/api/purchase-orders/from-demand", { items: [{ sku: "RSK-1", qty: 10 }], skip_open_po: true, source: "reorder" }, adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { pos: unknown[]; skipped_open: string[] };
    expect(d.skipped_open).toContain("RSK-1");
    expect(d.pos.length).toBe(0);
  });

  it("without the flag it does not report skips (manual override path)", async () => {
    const res = await post("/api/purchase-orders/from-demand", { items: [{ sku: "RSK-1", qty: 10 }], source: "reorder" }, adminToken);
    const d = await res.json() as { skipped_open?: string[] };
    expect((d.skipped_open || []).length).toBe(0);
  });
});

// ── Location zones (admin-managed) ───────────────────────────────────
describe("Location zones", () => {
  it("GET /api/zones returns the default set when unset", async () => {
    const z = await (await get("/api/zones", adminToken)).json() as Array<{code:string}>;
    expect(z.map(x => x.code)).toContain("EGL");
  });

  it("POST /api/zones adds a zone that the list then includes", async () => {
    const res = await post("/api/zones", { code: "wfd", label: "Whitefield" }, adminToken);
    expect(res.status).toBe(200);
    const z = await (await get("/api/zones", adminToken)).json() as Array<{code:string;label:string}>;
    const wfd = z.find(x => x.code === "WFD");  // normalised to upper-case
    expect(wfd).toBeTruthy();
    expect(wfd!.label).toBe("Whitefield");
  });

  it("DELETE /api/zones/:code removes it", async () => {
    await post("/api/zones", { code: "TMP", label: "Temp" }, adminToken);
    const res = await del("/api/zones/TMP", adminToken);
    expect(res.status).toBe(200);
    const z = await (await get("/api/zones", adminToken)).json() as Array<{code:string}>;
    expect(z.find(x => x.code === "TMP")).toBeFalsy();
  });

  it("POST /api/zones rejects an empty code and forbids client roles", async () => {
    expect((await post("/api/zones", { code: "" }, adminToken)).status).toBe(400);
    expect((await post("/api/zones", { code: "X" }, clientToken)).status).toBe(403);
  });
});

// ── Standing order → materialize (Delivery Calendar "Create order") ──
describe("Standing order materialize", () => {
  const sdb = env.DB as D1Database;
  beforeAll(async () => {
    await sdb.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES (?,?,1)").bind("SO-CL", "Standing Co").run();
    await sdb.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,1)")
      .bind("SO-SKU", "Recurring Item", "Grocery", 50, 500).run();
    await sdb.prepare(`INSERT OR IGNORE INTO standing_orders (id,client_id,name,frequency,items,active)
      VALUES (?,?,?,?,?,1)`).bind("SO-1", "SO-CL", "Monthly pantry", "MONTHLY", JSON.stringify([{ sku: "SO-SKU", qty: 3 }])).run();
  });

  it("POST /standing-orders/:id/materialize creates a real order (regression: client_price column)", async () => {
    const res = await post("/api/standing-orders/SO-1/materialize", { date: "2026-09-01" }, adminToken);
    expect(res.status).toBe(201);
    const d = await res.json() as { ok: boolean; order_id: string };
    expect(d.ok).toBe(true);
    expect(d.order_id).toBeTruthy();
  });

  it("materializing the same cycle twice is rejected (409)", async () => {
    await post("/api/standing-orders/SO-1/materialize", { date: "2026-10-01" }, adminToken);
    const dup = await post("/api/standing-orders/SO-1/materialize", { date: "2026-10-01" }, adminToken);
    expect(dup.status).toBe(409);
  });
});

describe("Contact / Book-a-demo lead capture", () => {
  it("POST /api/contact is public and stores a lead (no auth needed)", async () => {
    const res = await post("/api/contact", {
      name: "Asha Rao", company: "Acme Foods", email: "asha@acme.test",
      phone: "+91 90000 00000", scale: "1,000+ vendors", message: "Keen on DC numbering",
    });
    expect(res.status).toBe(200);
    const d = await res.json() as { ok: boolean; id: string };
    expect(d.ok).toBe(true);
    expect(d.id).toBeTruthy();
  });

  it("POST /api/contact rejects a missing/invalid email (400)", async () => {
    const noEmail = await post("/api/contact", { name: "No Email", company: "X" });
    expect(noEmail.status).toBe(400);
    const badEmail = await post("/api/contact", { name: "Bad", email: "not-an-email" });
    expect(badEmail.status).toBe(400);
  });

  it("POST /api/contact rejects a missing name (400)", async () => {
    const res = await post("/api/contact", { email: "someone@x.test" });
    expect(res.status).toBe(400);
  });

  it("GET /api/contact returns leads for an admin", async () => {
    await post("/api/contact", { name: "Lead Two", company: "Beta", email: "lead2@beta.test" });
    const res = await get("/api/contact", adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { submissions: Array<{ email: string }> };
    expect(Array.isArray(d.submissions)).toBe(true);
    expect(d.submissions.some(s => s.email === "lead2@beta.test")).toBe(true);
  });

  it("GET /api/contact is forbidden for a non-admin (403)", async () => {
    const res = await get("/api/contact", clientToken);
    expect(res.status).toBe(403);
  });
});

describe("Order amendment (post-approval change + re-approval)", () => {
  const seedApproved = async (oid: string, status = "APPROVED") => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind(oid, "c1", "tst-admin", status, 450, 81, 531, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind(oid + "-oi", oid, "SKU001", "Basmati Rice 5kg", 1, 450, 450).run();
  };

  it("amends an approved order, recomputes totals and re-opens approval", async () => {
    await seedApproved("AMD-1");
    const res = await post("/api/orders/AMD-1/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 2, unit_price: 150 }],
      reason: "Client swapped rice for oil",
    }, adminToken);
    expect(res.status).toBe(200);
    const d = await res.json() as { status: string; revision: number; grand_total: number };
    expect(d.status).toBe("PENDING_APPROVAL");
    expect(d.revision).toBe(2);
    expect(d.grand_total).toBe(354); // 300 + 18% GST

    const hist = await get("/api/orders/AMD-1/amendments", adminToken);
    const h = await hist.json() as { amendments: Array<{ reason: string; after_total: number }> };
    expect(h.amendments.length).toBe(1);
    expect(h.amendments[0].reason).toContain("swapped");
  });

  it("requires a reason (400)", async () => {
    await seedApproved("AMD-2");
    const res = await post("/api/orders/AMD-2/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 1, unit_price: 150 }],
    }, adminToken);
    expect(res.status).toBe(400);
  });

  it("blocks amendment once dispatch has started (400)", async () => {
    await seedApproved("AMD-3", "IN_SHIPMENT");
    const res = await post("/api/orders/AMD-3/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 1, unit_price: 150 }],
      reason: "too late",
    }, adminToken);
    expect(res.status).toBe(400);
  });

  it("is forbidden for a client role (403)", async () => {
    await seedApproved("AMD-4");
    const res = await post("/api/orders/AMD-4/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 1, unit_price: 150 }],
      reason: "client cannot do this",
    }, clientToken);
    expect(res.status).toBe(403);
  });
});

describe("Order amendment — client-visible diff & budget", () => {
  it("order detail exposes amendments and budget impact", async () => {
    const db = env.DB as D1Database;
    await db.prepare("UPDATE clients SET monthly_budget=? WHERE id=?").bind(500000, "c1").run();
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind("AMD-5", "c1", "tst-admin", "APPROVED", 450, 81, 531, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("AMD-5-oi", "AMD-5", "SKU001", "Basmati Rice 5kg", 1, 450, 450).run();

    const amend = await post("/api/orders/AMD-5/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 3, unit_price: 150 }],
      reason: "swapped for oil",
    }, adminToken);
    expect(amend.status).toBe(200);

    const res = await get("/api/orders/AMD-5", adminToken);
    const d = await res.json() as { revision: number; amendments: Array<{ reason: string }>; budget: { monthly_budget: number } };
    expect(d.revision).toBe(2);
    expect(d.amendments.length).toBe(1);
    expect(d.amendments[0].reason).toContain("oil");
    expect(d.budget.monthly_budget).toBe(500000);
  });
});

describe("Order amendment — only the client may approve the change", () => {
  it("blocks ops/admin from approving an amended order, but lets the client approve", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind("AMD-6", "c1", "tst-admin", "APPROVED", 450, 81, 531, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("AMD-6-oi", "AMD-6", "SKU001", "Basmati Rice 5kg", 1, 450, 450).run();

    // Ops amends -> order goes to PENDING_APPROVAL (rev 2)
    const amend = await post("/api/orders/AMD-6/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 2, unit_price: 150 }],
      reason: "swap",
    }, adminToken);
    expect(amend.status).toBe(200);

    // Admin (super_admin) trying to approve the change is forbidden
    const adminApprove = await post("/api/orders/AMD-6/transition", { to: "APPROVED", note: "admin self-approve" }, adminToken);
    expect(adminApprove.status).toBe(403);

    // The client (client_admin for c1) can approve the change
    const clientApprove = await post("/api/orders/AMD-6/transition", { to: "APPROVED", note: "client approves change" }, clientToken);
    expect(clientApprove.status).toBe(200);
  });

  it("still lets ops approve a normal (non-amended) pending order", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind("PA-1", "c1", "tst-admin", "PENDING_APPROVAL", 450, 81, 531, "Regular").run();
    const res = await post("/api/orders/PA-1/transition", { to: "APPROVED", note: "ops approves above-threshold order" }, adminToken);
    expect(res.status).toBe(200);
  });
});

describe("Vendor GST filing frequency", () => {
  it("persists on create and can be updated", async () => {
    const create = await post("/api/vendors", {
      name: "GST Freq Vendor", category: "Grocery",
      registration_type: "unregistered", vendor_type: "non_food",
      gst_filing_frequency: "Monthly",
    }, adminToken);
    expect(create.status).toBe(201);
    const { id } = await create.json() as { id: string };

    const list = await get("/api/vendors", adminToken);
    const vendors = await list.json() as Array<{ id: string; gst_filing_frequency: string }>;
    expect(vendors.find(v => v.id === id)?.gst_filing_frequency).toBe("Monthly");

    const upd = await patch(`/api/vendors/${id}`, { gst_filing_frequency: "Quarterly" }, adminToken);
    expect(upd.status).toBe(200);
    const list2 = await get("/api/vendors", adminToken);
    const vendors2 = await list2.json() as Array<{ id: string; gst_filing_frequency: string }>;
    expect(vendors2.find(v => v.id === id)?.gst_filing_frequency).toBe("Quarterly");

    // An invalid value is rejected/normalised to null.
    await patch(`/api/vendors/${id}`, { gst_filing_frequency: "Yearly" }, adminToken);
    const list3 = await get("/api/vendors", adminToken);
    const vendors3 = await list3.json() as Array<{ id: string; gst_filing_frequency: string | null }>;
    expect(vendors3.find(v => v.id === id)?.gst_filing_frequency).toBeNull();
  });
});

describe("Order amendment — reject reverts to previous version", () => {
  it("client rejecting an amendment restores the prior line-set, total and status", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind("AMD-7", "c1", "tst-admin", "APPROVED", 450, 81, 531, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("AMD-7-oi", "AMD-7", "SKU001", "Basmati Rice 5kg", 1, 450, 450).run();

    // Ops amends: swap to oil @150 x2 -> total 354, PENDING_APPROVAL rev2
    const amend = await post("/api/orders/AMD-7/amend", {
      items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 2, unit_price: 150 }],
      reason: "price/product change",
    }, adminToken);
    expect(amend.status).toBe(200);

    // Ops/admin cannot reject the change either
    const adminReject = await post("/api/orders/AMD-7/amend-reject", {}, adminToken);
    expect(adminReject.status).toBe(403);

    // Client rejects -> reverts to previous version
    const clientReject = await post("/api/orders/AMD-7/amend-reject", {}, clientToken);
    expect(clientReject.status).toBe(200);
    const rj = await clientReject.json() as { status: string; reverted: boolean };
    expect(rj.status).toBe("APPROVED");
    expect(rj.reverted).toBe(true);

    const detail = await get("/api/orders/AMD-7", adminToken);
    const d = await detail.json() as {
      status: string; grand_total: number;
      items: Array<{ sku: string; qty: number }>;
      amendments: Array<{ status: string }>;
    };
    expect(d.status).toBe("APPROVED");
    expect(d.grand_total).toBe(531);            // restored original total
    expect(d.items.length).toBe(1);
    expect(d.items[0].sku).toBe("SKU001");       // original item restored
    expect(d.items[0].qty).toBe(1);
    expect(d.amendments[0].status).toBe("REJECTED");
  });
});

describe("Amend restricted to the undelivered remainder", () => {
  it("blocks reducing below / removing a part-delivered line, allows amending the balance", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,revision) VALUES (?,?,?,?,?,?,?,?,1)")
      .bind("AMD-8", "c1", "tst-admin", "PARTIALLY_CLOSED", 4500, 810, 5310, "Regular").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind("AMD-8-oi", "AMD-8", "SKU001", "Basmati Rice 5kg", 10, 450, 4500).run();
    await db.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,?,?)")
      .bind("DC-8", "AMD-8", "DELIVERED", 4).run();
    await db.prepare("INSERT OR IGNORE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,?)")
      .bind("DC-8-i", "DC-8", "SKU001", "Basmati Rice 5kg", 10, 4).run();

    // reduce below delivered (3 < 4) -> blocked
    const below = await post("/api/orders/AMD-8/amend", { items: [{ sku: "SKU001", name: "Basmati Rice 5kg", qty: 3, unit_price: 450 }], reason: "reduce" }, adminToken);
    expect(below.status).toBe(400);

    // remove the part-delivered line -> blocked
    const removed = await post("/api/orders/AMD-8/amend", { items: [{ sku: "SKU002", name: "Refined Oil 1L", qty: 2, unit_price: 150 }], reason: "swap out" }, adminToken);
    expect(removed.status).toBe(400);

    // amend at/above delivered (6 >= 4) -> allowed
    const ok = await post("/api/orders/AMD-8/amend", { items: [{ sku: "SKU001", name: "Basmati Rice 5kg", qty: 6, unit_price: 450 }], reason: "trim to 6" }, adminToken);
    expect(ok.status).toBe(200);
  });
});

// ── Product Intelligence & Brand Catalogue (P0.0 — schema) ────────────
describe("Product Intelligence schema (P0.0)", () => {
  it("creates the brand/claim/attribute tables and inventory enrichment columns", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT INTO brands (id,name,status) VALUES (?,?,?)").bind("BR-PI-1", "Yogabar", "approved").run();
    await db.prepare("INSERT INTO claims (id,sku,category,label,status,ai_confidence) VALUES (?,?,?,?,?,?)")
      .bind("CLM-PI-1", "SKU001", "dietary", "Vegan", "ai_screened", 0.94).run();
    await db.prepare("INSERT INTO product_attributes (id,sku,attribute,status) VALUES (?,?,?,?)")
      .bind("ATTR-PI-1", "SKU001", "vegan", "ai_extracted").run();
    await db.prepare("INSERT INTO pi_rule_dict (id,dict,term) VALUES (?,?,?)").bind("RD-1", "animal_derived", "honey").run();

    const brand = await db.prepare("SELECT name FROM brands WHERE id=?").bind("BR-PI-1").first<{ name: string }>();
    expect(brand?.name).toBe("Yogabar");
    const claim = await db.prepare("SELECT status FROM claims WHERE id=?").bind("CLM-PI-1").first<{ status: string }>();
    expect(claim?.status).toBe("ai_screened");

    // inventory enrichment columns exist (write + read back)
    await db.prepare("UPDATE inventory SET brand_id=?, pack_size=?, moq=?, lifecycle_status=? WHERE sku=?")
      .bind("BR-PI-1", "6 x 38g", 4, "published", "SKU001").run();
    const inv = await db.prepare("SELECT brand_id, moq, lifecycle_status FROM inventory WHERE sku=?")
      .bind("SKU001").first<{ brand_id: string; moq: number; lifecycle_status: string }>();
    expect(inv?.brand_id).toBe("BR-PI-1");
    expect(inv?.moq).toBe(4);
    expect(inv?.lifecycle_status).toBe("published");
  });
});

// ── Product Intelligence catalog + enrich (P0.1) ──────────────────────
describe("Product Intelligence catalog + enrich (P0.1)", () => {
  it("upserts a brand, enriches a product, and returns role-filtered detail", async () => {
    const br = await post("/api/brands", { name: "TestBrand PI", brand_type: "Indian Brand", status: "approved" }, adminToken);
    expect(br.status).toBe(200);
    const brandId = (await br.json() as { id: string }).id;

    const enrich = await post("/api/catalog/products/SKU001/enrich", {
      pack: { brand_id: brandId, moq: 6, pack_size: "5 kg", lifecycle_status: "published" },
      nutrition: { basis: "per 100g", protein: 8, sugar: 1 },
      ingredients: ["Rice", "Water"],
      attributes: [{ attribute: "Vegan" }, { attribute: "Gluten Free" }],
    }, adminToken);
    expect(enrich.status).toBe(200);

    // client cannot enrich
    const forbidden = await post("/api/catalog/products/SKU001/enrich", { pack: { moq: 1 } }, clientToken);
    expect(forbidden.status).toBe(403);

    // admin detail exposes cost; verified attributes present
    const adminDet = await (await get("/api/catalog/products/SKU001", adminToken)).json() as {
      pricing: Record<string, unknown>; attributes: { attribute: string; status: string }[]; nutrition: { protein: number };
    };
    expect(adminDet.pricing.cost_excl_gst).toBeDefined();
    expect(adminDet.attributes.some(a => a.attribute === "vegan" && a.status === "verified")).toBe(true);
    expect(adminDet.nutrition.protein).toBe(8);

    // client detail hides cost & vendor
    const cliDet = await (await get("/api/catalog/products/SKU001", clientToken)).json() as {
      pricing: Record<string, unknown>; product: Record<string, unknown>;
    };
    expect(cliDet.pricing.cost_excl_gst).toBeUndefined();
    expect(cliDet.product.cost_excl_gst).toBeUndefined();
    expect(cliDet.pricing.client_excl_gst).toBeDefined();
  });

  it("lists catalogue with facets and filters by a verified attribute", async () => {
    // Self-contained: create an active product (the server assigns the SKU) so the
    // active=1 catalogue filter can't flake on a SKU an earlier test deactivated.
    const created = await post("/api/inventory", { name: "PI Vegan Test", category: "Snacks", unit_price: 120, stock: 50 }, adminToken);
    const newSku = (await created.json() as { sku: string }).sku;
    await post(`/api/catalog/products/${newSku}/enrich`, { attributes: [{ attribute: "Vegan" }] }, adminToken);
    const list = await (await get("/api/catalog/products?attribute=vegan", adminToken)).json() as {
      products: { sku: string; attributes: string[]; cost_excl_gst?: number }[]; facets: Record<string, unknown>;
    };
    expect(Array.isArray(list.products)).toBe(true);
    const row = list.products.find(p => p.sku === newSku);
    expect(row).toBeDefined();
    expect(row!.attributes).toContain("vegan");
    expect(row!.cost_excl_gst).toBeDefined();   // admin sees cost (0 when unset)
    expect(list.facets).toHaveProperty("category");
  });

  it("admin q-search returns a product by name (enrich search path)", async () => {
    const c = await post("/api/inventory", { name: "ZZ Quicksearch Widget", category: "Snacks", unit_price: 55, stock: 9 }, adminToken);
    const sku = (await c.json() as { sku: string }).sku;
    const r = await get("/api/catalog/products?q=Quicksearch", adminToken);
    expect(r.status).toBe(200);
    const body = await r.json() as { products: { sku: string }[] };
    expect(body.products.some(p => p.sku === sku)).toBe(true);
  });
});

// ── Product Intelligence AI extract + screening (P0.2) ────────────────
describe("Product Intelligence AI extract + screening (P0.2)", () => {
  it("screens a Vegan claim against animal-derived ingredients and never publishes verified", async () => {
    const created = await post("/api/inventory", { name: "PI Screen Test", category: "Snacks", unit_price: 100, stock: 20 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    const res = await post(`/api/catalog/products/${sku}/ai/extract`, {
      text: "Vegan. Ingredients: Oats, Milk solids, Sugar, Honey. High Protein.",
    }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { claims: { label: string; conflict: boolean; status: string }[]; ingredients: number };
    expect(body.ingredients).toBeGreaterThan(0);
    const vegan = body.claims.find(c => c.label === "Vegan");
    expect(vegan).toBeDefined();
    expect(vegan!.conflict).toBe(true);              // milk solids / honey → conflict
    expect(vegan!.status).toBe("ai_screened");

    // detail: claims exist but NONE is verified; attributes screened, not verified
    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as {
      claims: { label: string; status: string }[]; attributes: { attribute: string; status: string }[];
    };
    expect(det.claims.length).toBeGreaterThan(0);
    expect(det.claims.every(c => c.status !== "verified")).toBe(true);
    expect(det.attributes.every(a => a.status !== "verified")).toBe(true);

    // catalogue list flags the product as AI-screened (not verified) — powers the
    // faceted-catalogue verification facet.
    const listed = await (await get(`/api/catalog/products?q=${encodeURIComponent("PI Screen Test")}`, adminToken)).json() as { products: { sku: string; verified: boolean; screened: boolean }[] };
    const row = listed.products.find(p => p.sku === sku);
    expect(row?.screened).toBe(true);
    expect(row?.verified).toBe(false);

    // client cannot run extraction
    const forbidden = await post(`/api/catalog/products/${sku}/ai/extract`, { text: "Vegan" }, clientToken);
    expect(forbidden.status).toBe(403);
  });

  it("transcribeOnly returns a preview without persisting anything", async () => {
    const created = await post("/api/inventory", { name: "PI Transcribe Test", category: "Snacks", unit_price: 50, stock: 10 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    const res = await post(`/api/catalog/products/${sku}/ai/extract`, { text: "Vegan. Ingredients: Oats, Milk solids.", transcribeOnly: true }, adminToken);
    const body = await res.json() as { transcribed: boolean; claims: unknown[] };
    expect(body.transcribed).toBe(true);
    expect(body.claims.length).toBeGreaterThan(0);   // preview shows the screened claim

    // ...but nothing was saved: the product has no claims yet.
    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { claims: unknown[]; ingredients: unknown[] };
    expect(det.claims.length).toBe(0);
    expect(det.ingredients.length).toBe(0);
  });

  it("re-running extract REPLACES prior AI claims instead of accumulating", async () => {
    const created = await post("/api/inventory", { name: "PI Rerun Test", category: "Snacks", unit_price: 50, stock: 10 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    await post(`/api/catalog/products/${sku}/ai/extract`, { text: "Vegan. Ingredients: Oats." }, adminToken);
    let det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { claims: { label: string }[] };
    expect(det.claims.map(c => c.label)).toContain("Vegan");

    // Re-scan with different content — the stale "Vegan" claim must be gone.
    await post(`/api/catalog/products/${sku}/ai/extract`, { text: "High Protein. Ingredients: Almonds." }, adminToken);
    det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { claims: { label: string }[] };
    expect(det.claims.map(c => c.label)).toContain("High Protein");
    expect(det.claims.map(c => c.label)).not.toContain("Vegan");
  });

  it("image OCR degrades gracefully when no AI binding is present", async () => {
    const created = await post("/api/inventory", { name: "PI OCR Test", category: "Snacks", unit_price: 20, stock: 5 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;
    // 1x1 png; the test worker has no AI binding, so OCR should report a clear,
    // actionable error rather than a generic crash.
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = await post(`/api/catalog/products/${sku}/ai/extract`, { imageBase64: png }, adminToken);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/OCR/i);
  });

  it("extracts a bare comma-list with no 'Ingredients:' keyword and strips ()/[] annotations", async () => {
    const created = await post("/api/inventory", { name: "PI Bare List", category: "Snacks", unit_price: 50, stock: 10 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    // The exact shape a user pastes off a pack — no keyword, bracketed E-numbers.
    const res = await post(`/api/catalog/products/${sku}/ai/extract`, {
      text: "Emulsifier (INS 322 and INS 471), Raising Agent [INS 500(ii)], Rosemary Extract (INS 392)",
    }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { ingredients: number; ingredientList: string[] };
    expect(body.ingredients).toBe(3);
    expect(body.ingredientList).toEqual(["Emulsifier", "Raising Agent", "Rosemary Extract"]);

    // and the detail view returns those captured ingredients
    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { ingredients: { raw_text: string }[] };
    expect(det.ingredients.map(i => i.raw_text)).toEqual(["Emulsifier", "Raising Agent", "Rosemary Extract"]);
  });

  it("validates ingredients against the FSSAI allergen dictionary (synonym match)", async () => {
    const created = await post("/api/inventory", { name: "PI Allergen Test", category: "Snacks", unit_price: 60, stock: 10 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    await post(`/api/catalog/products/${sku}/ai/extract`, {
      text: "Oats, Milk Solids, Maida, Sugar, Cashew, Sea salt",
    }, adminToken);

    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { ingredients: { raw_text: string; allergen: number }[] };
    const flag = (name: string) => det.ingredients.find(i => i.raw_text === name)?.allergen;
    // milk (via "Milk Solids"), gluten (via "Maida"), tree nut (via "Cashew"), gluten (Oats)
    expect(flag("Milk Solids")).toBe(1);
    expect(flag("Maida")).toBe(1);
    expect(flag("Cashew")).toBe(1);
    expect(flag("Oats")).toBe(1);
    // plain, non-allergen items are not flagged
    expect(flag("Sugar")).toBe(0);
    expect(flag("Sea salt")).toBe(0);
  });
});

// ── Product Intelligence rule-driven collections (P1) ─────────────────
describe("Product Intelligence collections (P1)", () => {
  it("creates a rule-driven collection, resolves it, and gates publish + role", async () => {
    const cat = "CollCat" + Math.random().toString(36).slice(2, 7);
    const a = await post("/api/inventory", { name: "Coll A", category: cat, unit_price: 30, stock: 5 }, adminToken);
    const b = await post("/api/inventory", { name: "Coll B", category: cat, unit_price: 40, stock: 5 }, adminToken);
    const skuA = (await a.json() as { sku: string }).sku;
    const skuB = (await b.json() as { sku: string }).sku;

    // client cannot create collections
    expect((await post("/api/collections", { name: "x", rule: { category: cat } }, clientToken)).status).toBe(403);

    // ops creates a published, rule-driven collection
    const made = await post("/api/collections", { name: "Cat Shelf", rule: { category: cat, pmax: 35 }, published: true }, adminToken);
    expect(made.status).toBe(200);
    const { slug } = await made.json() as { slug: string };

    // resolve → only the ≤35 product matches the rule
    const resolved = await (await get(`/api/collections/${slug}`, adminToken)).json() as { products: { sku: string }[] };
    const skus = resolved.products.map(p => p.sku);
    expect(skus).toContain(skuA);
    expect(skus).not.toContain(skuB);   // 40 > pmax 35

    // list includes it with a resolved count
    const list = await (await get("/api/collections", adminToken)).json() as { collections: { slug: string; count: number; published: boolean }[] };
    const row = list.collections.find(c => c.slug === slug);
    expect(row?.count).toBe(1);
    expect(row?.published).toBe(true);
  });
});

// ── Product Intelligence product type (P1) ────────────────────────────
describe("Product Intelligence product type (P1)", () => {
  it("suggests a type, saves a valid one (rejects junk), and exposes it on the catalogue", async () => {
    const created = await post("/api/inventory", { name: "Choco Protein Bar", category: "Snacks", unit_price: 60, stock: 10 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    // ops detail carries a suggestion + the vocabulary; not set yet
    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as {
      type_meta: { product_type: string | null; suggested_type: string | null; type_vocab: string[] };
    };
    expect(det.type_meta.product_type).toBeNull();
    expect(det.type_meta.suggested_type).toBe("Bars & Energy");   // "bar" in the name
    expect(det.type_meta.type_vocab).toContain("Bars & Energy");

    // junk type is ignored (stays unset)
    await post(`/api/catalog/products/${sku}/enrich`, { product_type: "Not A Real Type" }, adminToken);
    let d2 = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { type_meta: { product_type: string | null } };
    expect(d2.type_meta.product_type).toBeNull();

    // a valid type saves and shows on the catalogue list
    expect((await post(`/api/catalog/products/${sku}/enrich`, { product_type: "Bars & Energy" }, adminToken)).status).toBe(200);
    d2 = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { type_meta: { product_type: string | null } };
    expect(d2.type_meta.product_type).toBe("Bars & Energy");

    const listed = await (await get(`/api/catalog/products?q=${encodeURIComponent("Choco Protein Bar")}`, adminToken)).json() as { products: { sku: string; product_type: string }[] };
    expect(listed.products.find(p => p.sku === sku)?.product_type).toBe("Bars & Energy");
  });
});

// ── Product Intelligence procurement view (P1) ────────────────────────
describe("Product Intelligence procurement view (P1)", () => {
  it("returns an ops-only procurement block with cost + margin", async () => {
    const created = await post("/api/inventory", { name: "PI Procure Test", category: "Snacks", unit_price: 100, cost_excl_gst: 60, mrp: 150, stock: 20 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;

    const det = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as {
      procurement: { cost_excl_gst: number; list_excl_gst: number; margin_pct: number; vendors: unknown[] } | null;
    };
    expect(det.procurement).not.toBeNull();
    expect(det.procurement!.cost_excl_gst).toBe(60);
    expect(det.procurement!.list_excl_gst).toBe(100);
    expect(det.procurement!.margin_pct).toBe(40);   // (100-60)/100
    expect(Array.isArray(det.procurement!.vendors)).toBe(true);
  });
});

// ── Product Intelligence verification workflow (P0.3) ─────────────────
describe("Product Intelligence verification workflow (P0.3)", () => {
  it("requires evidence to verify, projects verified attribute, expires, and closes the task", async () => {
    const created = await post("/api/inventory", { name: "PI Verify Test", category: "Snacks", unit_price: 100, stock: 20 }, adminToken);
    const sku = (await created.json() as { sku: string }).sku;
    // High Protein → a review task (low confidence); Vegan (clean) → verifiable attribute
    await post(`/api/catalog/products/${sku}/ai/extract`, { text: "High Protein. Vegan. Ingredients: Oats, Almonds." }, adminToken);
    const det1 = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as { claims: { id: string; label: string }[] };
    const hp = det1.claims.find(c => c.label === "High Protein")!;
    const vg = det1.claims.find(c => c.label === "Vegan")!;

    // approve without evidence → blocked
    expect((await post(`/api/claims/${hp.id}/approve`, {}, adminToken)).status).toBe(400);
    // client cannot approve
    expect((await post(`/api/claims/${hp.id}/approve`, { evidence_not_applicable: true }, clientToken)).status).toBe(403);

    // add evidence + approve with a PAST expiry → published then rendered expired
    await post(`/api/claims/${hp.id}/evidence`, { extracted_text: "10 g protein/bar", page_ref: "label-back p1" }, adminToken);
    expect((await post(`/api/claims/${hp.id}/approve`, { expiry_date: "2000-01-01", note: "meets threshold" }, adminToken)).status).toBe(200);

    // Vegan: evidence_not_applicable path → verified attribute projection
    expect((await post(`/api/claims/${vg.id}/approve`, { evidence_not_applicable: true }, adminToken)).status).toBe(200);

    const det2 = await (await get(`/api/catalog/products/${sku}`, adminToken)).json() as {
      claims: { id: string; status: string }[]; attributes: { attribute: string; status: string }[];
    };
    expect(det2.claims.find(c => c.id === hp.id)!.status).toBe("expired");           // past-expiry verified → expired
    expect(det2.attributes.some(a => a.attribute === "vegan" && a.status === "verified")).toBe(true); // projection

    // both tasks closed → not in the open queue; KPI counts are present
    const queue = await (await get("/api/verification/queue", adminToken)).json() as {
      tasks: { claim_id: string }[]; counts: { verified_this_week: number; evidence_requested: number };
    };
    expect(queue.tasks.some(t => t.claim_id === hp.id)).toBe(false);
    expect(typeof queue.counts.evidence_requested).toBe("number");
    expect(queue.counts.verified_this_week).toBeGreaterThanOrEqual(1);  // Vegan just verified now
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance (003-finance-ar) — Slice 1, Group 1 (foundations)
// Pure functions + schema self-heal. Encodes the PRD §15 pinned rules.
// ══════════════════════════════════════════════════════════════════════
describe("finance-ar/1.C ist date helpers", () => {
  it("istToday returns the IST civil date, crossing the 18:30 UTC boundary", () => {
    // 18:45 UTC → 00:15 IST next day
    expect(istToday(new Date("2026-03-10T18:45:00Z"))).toBe("2026-03-11");
    // 18:15 UTC → 23:45 IST same day
    expect(istToday(new Date("2026-03-10T18:15:00Z"))).toBe("2026-03-10");
    // exactly midnight UTC → 05:30 IST same day
    expect(istToday(new Date("2026-03-10T00:00:00Z"))).toBe("2026-03-10");
  });
  it("daysBetweenIST counts whole civil days (signed)", () => {
    expect(daysBetweenIST("2026-03-01", "2026-03-31")).toBe(30);
    expect(daysBetweenIST("2026-03-31", "2026-03-01")).toBe(-30);
    expect(daysBetweenIST("2026-03-10", "2026-03-10")).toBe(0);
  });
  it("overdueDays is due→today (positive when overdue)", () => {
    expect(overdueDays("2026-03-10", "2026-03-10")).toBe(0);
    expect(overdueDays("2026-03-10", "2026-03-11")).toBe(1);
    expect(overdueDays("2026-03-10", "2026-03-05")).toBe(-5);
  });
});

describe("finance-ar/1.B money helpers", () => {
  it("toPaise parses rupee strings/numbers to integer paise, no drift", () => {
    expect(toPaise("1234.56")).toBe(123456);
    expect(toPaise("1234")).toBe(123400);
    expect(toPaise("0.05")).toBe(5);
    expect(toPaise("₹1,234.56")).toBe(123456);
    expect(toPaise(1234.5)).toBe(123450);
    expect(toPaise("-10.10")).toBe(-1010);
    expect(toPaise(null)).toBe(0);
    expect(toPaise("")).toBe(0);
    expect(Number.isInteger(toPaise("99.99"))).toBe(true);
  });
  it("fromPaise round-trips and pads", () => {
    expect(fromPaise(123456)).toBe("1234.56");
    expect(fromPaise(5)).toBe("0.05");
    expect(fromPaise(-1010)).toBe("-10.10");
    expect(fromPaise(toPaise("789.00"))).toBe("789.00");
  });
  it("summing 10k paise amounts is exact (no float drift)", () => {
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += toPaise("0.01");
    expect(sum).toBe(10000);             // 10000 × ₹0.01 = ₹100.00 exactly
    expect(fromPaise(sum)).toBe("100.00");
  });
  it("formatMoney renders a currency string without re-entering storage", () => {
    expect(typeof formatMoney(123456, "INR")).toBe("string");
    expect(formatMoney(123456, "INR")).toContain("1,234.56");
  });
});

describe("finance-ar/1.A aging + tier + DSO", () => {
  const T = "2026-06-30"; // today
  it("aging buckets are disjoint half-open from due_date", () => {
    expect(agingBucket(T, T)).toBe("current");                 // due today = current
    expect(agingBucket("2026-07-05", T)).toBe("current");      // not yet due
    expect(agingBucket("2026-06-29", T)).toBe("1-30");         // 1 overdue
    expect(agingBucket("2026-05-31", T)).toBe("1-30");         // 30 overdue
    expect(agingBucket("2026-05-30", T)).toBe("31-60");        // 31 overdue
    expect(agingBucket("2026-04-30", T)).toBe("61-90");        // 61 overdue
    expect(agingBucket("2026-03-31", T)).toBe("91+");          // 91 overdue
  });
  it("bucket boundaries: 30→1-30, 31→31-60, 60→31-60, 61→61-90, 90→61-90, 91→91+", () => {
    const day = (od: number) => { const d = new Date(Date.parse(T + "T00:00:00Z") - od * 86400000); return d.toISOString().slice(0, 10); };
    expect(agingBucket(day(30), T)).toBe("1-30");
    expect(agingBucket(day(31), T)).toBe("31-60");
    expect(agingBucket(day(60), T)).toBe("31-60");
    expect(agingBucket(day(61), T)).toBe("61-90");
    expect(agingBucket(day(90), T)).toBe("61-90");
    expect(agingBucket(day(91), T)).toBe("91+");
  });
  it("selectTier picks the highest tier whose min_overdue_days ≤ worst", () => {
    expect(selectTier(-8)).toBeNull();          // further out than pre-due window
    expect(selectTier(-3)).toBe("pre-due");
    expect(selectTier(-1)).toBe("pre-due");
    expect(selectTier(0)).toBe("on-due");
    expect(selectTier(1)).toBe("overdue-1");
    expect(selectTier(15)).toBe("overdue-1");
    expect(selectTier(16)).toBe("overdue-2");
    expect(selectTier(30)).toBe("overdue-2");
    expect(selectTier(31)).toBe("final");
    expect(selectTier(400)).toBe("final");
  });
  it("DEFAULT_TIER_RULES matches the PRD §7 ladder", () => {
    expect(DEFAULT_TIER_RULES.map(r => r.tier)).toEqual(["pre-due", "on-due", "overdue-1", "overdue-2", "final"]);
  });
  it("computeDSO = (openAR/creditSales)*days, guarded against divide-by-zero", () => {
    expect(computeDSO(90000, 90000, 90)).toBe(90);   // one full window's sales outstanding
    expect(computeDSO(45000, 90000, 90)).toBe(45);
    expect(computeDSO(10000, 0, 90)).toBe(0);        // no sales → 0, no NaN
    expect(computeDSO(0, 90000, 90)).toBe(0);
  });
});

describe("finance-ar/1.D schema self-heal", () => {
  it("SEND_CRON is the 08:00 IST (02:30 UTC) daily expression", () => {
    expect(SEND_CRON).toBe("30 2 * * *");
  });
  it("BOOKS_SYNC_CRON is the 23:00 IST (17:30 UTC) nightly expression", () => {
    expect(BOOKS_SYNC_CRON).toBe("30 17 * * *");
  });
  it("nightly Books delta no-ops while disabled or backfill-pending (no network, no error written)", async () => {
    await ensureArSchema(env);
    // Sentinel we can prove the no-op path never overwrites.
    await setCfg("books_last_sync_error", "SENTINEL");

    // (1) Sync disabled → returns before any Zoho call, sentinel untouched.
    await setCfg("books_sync_enabled", "0");
    await setCfg("initial_backfill_complete", "1");
    await runBooksScheduledDelta(env);
    expect(await getCfg("books_last_sync_error")).toBe("SENTINEL");

    // (2) Enabled but no completed rebuild → still a no-op (never auto-rebuilds).
    await setCfg("books_sync_enabled", "1");
    await setCfg("initial_backfill_complete", "0");
    await runBooksScheduledDelta(env);
    expect(await getCfg("books_last_sync_error")).toBe("SENTINEL");
  });
  it("ensureArSchema creates the AR + reminder tables idempotently", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await ensureArSchema(env); // re-run must be a no-op (no throw)
    const names = ["ar_clients", "ar_invoices", "ar_credit_notes", "fin_payments",
      "fin_allocations", "credit_allocations", "reminder_rules", "reminder_templates",
      "reminder_runs", "reminder_holds"];
    for (const n of names) {
      const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(n).first();
      expect(row, `table ${n} should exist`).toBeTruthy();
    }
  });
  it("reminder_runs carries cycle_batch + audit columns and money columns are INTEGER", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    const cols = (await db.prepare("PRAGMA table_info(reminder_runs)").all()).results as Array<{ name: string }>;
    const colNames = cols.map(c => c.name);
    for (const c of ["cycle_batch", "actor", "workflow", "forced", "recipient_email"]) {
      expect(colNames, `reminder_runs.${c}`).toContain(c);
    }
    const invCols = (await db.prepare("PRAGMA table_info(ar_invoices)").all()).results as Array<{ name: string; type: string }>;
    for (const money of ["subtotal", "gst", "total", "amount_paid", "credited", "late_fee", "balance"]) {
      const col = invCols.find(c => c.name === money)!;
      expect(col.type.toUpperCase(), `ar_invoices.${money} affinity`).toBe("INTEGER");
    }
  });
  it("enforces the reminder_runs (client_id,tier,cycle_batch) unique index", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status) VALUES ('rr1','cX','final','b1','sent')").run();
    let threw = false;
    try {
      await db.prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status) VALUES ('rr2','cX','final','b1','sent')").run();
    } catch { threw = true; }
    expect(threw, "duplicate (client_id,tier,cycle_batch) must violate the unique index").toBe(true);
  });
  it("defaults reminders to OFF and backfill-incomplete", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    const mode = await db.prepare("SELECT value FROM app_config WHERE key='reminders_mode'").first() as { value: string } | null;
    const bf = await db.prepare("SELECT value FROM app_config WHERE key='initial_backfill_complete'").first() as { value: string } | null;
    expect(mode?.value).toBe("off");
    expect(bf?.value).toBe("0");
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — Slice 1, Group 2 (Zoho Books mirror)
// ══════════════════════════════════════════════════════════════════════
function booksEnv() {
  return { ...(env as Record<string, unknown>), ZOHO_CLIENT_ID: "cid", ZOHO_CLIENT_SECRET: "sec",
    ZOHO_REFRESH_TOKEN: "ref", ZOHO_BOOKS_ORG_ID: "borg", ZOHO_DC: "in" } as unknown as typeof env;
}
// Deterministic Books stand-in: token POST + /books/v3/<entity> GET. `data` maps
// an entity name → its list of raw records (single page).
function mockBooks(data: Record<string, Record<string, unknown>[]>) {
  const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === "string" ? url : (url as URL).toString();
    calls.push({ url: u, method: (init?.method || "GET").toUpperCase(), headers: (init?.headers || {}) as Record<string, string> });
    if (u.includes("/oauth/v2/token")) return new Response(JSON.stringify({ access_token: "tok-b", expires_in: 3600 }), { status: 200 });
    const m = u.match(/\/books\/v3\/([a-z]+)\b/);
    if (m) { const ent = m[1]; return new Response(JSON.stringify({ [ent]: data[ent] || [], page_context: { has_more_page: false, total: (data[ent] || []).length } }), { status: 200 }); }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("finance-ar/2.C Books entity mappers", () => {
  it("mapBooksInvoice → paise, cycle_token, mirrored status", () => {
    const m = mapBooksInvoice({ invoice_id: "inv1", invoice_number: "INV-1", customer_id: "cust1", date: "2026-06-01", due_date: "2026-06-30", sub_total: 1000, tax_total: 180, total: 1180, currency_code: "INR", status: "partially_paid", exchange_rate: 1 });
    expect("row" in m).toBe(true);
    if (!("row" in m)) return;
    expect(m.row.total).toBe(118000);
    expect(m.row.gst).toBe(18000);
    expect(m.row.status).toBe("partial");
    expect(typeof m.row.cycle_token).toBe("string");
    // cycle_token changes when total/due_date change (ladder restart on edit)
    const m2 = mapBooksInvoice({ invoice_id: "inv1", due_date: "2026-06-30", total: 1181 });
    if ("row" in m2) expect(m2.row.cycle_token).not.toBe(m.row.cycle_token);
  });
  it("mapBooksInvoice void + missing id", () => {
    const v = mapBooksInvoice({ invoice_id: "inv2", total: 500, status: "void", due_date: "2026-01-01" });
    if ("row" in v) expect(v.row.status).toBe("void");
    expect("error" in mapBooksInvoice({ total: 5 })).toBe(true);
  });
  it("mapBooksPayment allocations satisfy Σ(applied)+unapplied == amount", () => {
    const m = mapBooksPayment({ payment_id: "pay1", customer_id: "cust1", amount: 500, unused_amount: 100, date: "2026-07-01", invoices: [{ invoice_id: "inv1", amount_applied: 300 }, { invoice_id: "inv2", amount_applied: 100 }] });
    expect("payment" in m).toBe(true);
    if (!("payment" in m)) return;
    const allocSum = m.allocations.reduce((n, a) => n + (a.amount as number), 0);
    expect(allocSum + (m.payment.unapplied_amount as number)).toBe(m.payment.amount as number); // 30000+10000+10000 == 50000
    expect(m.allocations.length).toBe(2);
    expect(m.allocations[0].id).toBe("pay1:inv1");
  });
  it("mapBooksCreditNote on-account (no invoices) yields note, no allocations", () => {
    const m = mapBooksCreditNote({ creditnote_id: "cn1", customer_id: "cust1", total: 250, date: "2026-07-02" });
    if (!("note" in m)) throw new Error("expected note");
    expect(m.note.amount).toBe(25000);
    expect(m.allocations.length).toBe(0);
  });
  it("mapBooksContact reads credit_days and never sets dunning_opt_out", () => {
    const m = mapBooksContact({ contact_id: "cust1", contact_name: "Acme", email: "a@acme.test", payment_terms: 30, currency_code: "INR" });
    if (!("row" in m)) throw new Error("expected row");
    expect(m.row.credit_days).toBe(30);
    expect("dunning_opt_out" in m.row).toBe(false);
  });
});

describe("finance-ar/2.B upsertMirror", () => {
  it("inserts new, updates existing, and handles > 90 keys without a SQL-var error", async () => {
    await ensureArSchema(env);
    const rows = Array.from({ length: 100 }, (_, i) => ({ client_id: `um${i}`, name: `N${i}` }));
    const a = await upsertMirror(env, "ar_clients", "client_id", rows);
    expect(a.inserted).toBe(100);
    const rows2 = rows.map(r => ({ ...r, name: `${r.name}-v2` }));
    const b = await upsertMirror(env, "ar_clients", "client_id", rows2); // 100 keys → 2 chunks (90+10)
    expect(b.updated).toBe(100);
    const chk = await (env.DB as D1Database).prepare("SELECT name FROM ar_clients WHERE client_id='um50'").first() as { name: string };
    expect(chk.name).toBe("N50-v2");
  });
  it("dedupes duplicate keys within one batched call (no PRIMARY KEY violation)", async () => {
    await ensureArSchema(env);
    // Two rows share a key in a single call (e.g. two bills for the same vendor).
    const res = await upsertMirror(env, "ar_clients", "client_id", [
      { client_id: "dup1", name: "First" },
      { client_id: "dup1", name: "Second" }, // same key → 2nd becomes an UPDATE, not a 2nd INSERT
      { client_id: "dup2", name: "Other" },
    ]);
    expect(res.inserted).toBe(2);
    expect(res.updated).toBe(1);
    const row = await (env.DB as D1Database).prepare("SELECT name FROM ar_clients WHERE client_id='dup1'").first() as { name: string };
    expect(row.name).toBe("Second"); // last write wins
  });
  it("a partial payload never blanks an app-owned column (dunning_opt_out)", async () => {
    await ensureArSchema(env);
    await upsertMirror(env, "ar_clients", "client_id", [{ client_id: "cP", name: "Orig", dunning_opt_out: 1 }]);
    const m = mapBooksContact({ contact_id: "cP", contact_name: "Renamed", email: "x@y.test" });
    if (!("row" in m)) throw new Error("map failed");
    await upsertMirror(env, "ar_clients", "client_id", [m.row]); // no dunning_opt_out in payload
    const row = await (env.DB as D1Database).prepare("SELECT name, dunning_opt_out FROM ar_clients WHERE client_id='cP'").first() as { name: string; dunning_opt_out: number };
    expect(row.dunning_opt_out).toBe(1); // preserved
    expect(row.name).toBe("Renamed");   // updated
  });
});

describe("finance-ar/2.A booksFetch", () => {
  it("parses the entity array + page_context and sends If-Modified-Since when delta", async () => {
    const { impl, calls } = mockBooks({ invoices: [{ invoice_id: "i1" }, { invoice_id: "i2" }] });
    const res = await booksFetch(booksEnv(), "tok", "invoices", { page: 1, modifiedSinceEpoch: 1_700_000_000 }, impl);
    expect(res.items.length).toBe(2);
    expect(res.hasMore).toBe(false);
    const invCall = calls.find(c => c.url.includes("/books/v3/invoices"))!;
    expect(invCall.headers["If-Modified-Since"]).toBeTruthy();
  });
  it("retries a 429 then succeeds", async () => {
    let n = 0;
    const impl = (async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/books/v3/contacts")) { n++; if (n === 1) return new Response("{}", { status: 429, headers: { "Retry-After": "0" } }); return new Response(JSON.stringify({ contacts: [{ contact_id: "c1" }], page_context: { has_more_page: false } }), { status: 200 }); }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const res = await booksFetch(booksEnv(), "tok", "contacts", { page: 1 }, impl);
    expect(n).toBe(2);
    expect(res.items.length).toBe(1);
  });
});

describe("finance-ar/2.D runBooksSync orchestrator", () => {
  it("mirrors contacts/invoices/payments/credit-notes and derives correct balances", async () => {
    await ensureArSchema(env);
    const { impl } = mockBooks({
      contacts: [{ contact_id: "custA", contact_name: "Acme", email: "a@acme.test", payment_terms: 30 }],
      invoices: [{ invoice_id: "invA", invoice_number: "INV-A", customer_id: "custA", date: "2026-06-01", due_date: "2026-06-30", sub_total: 1000, tax_total: 0, total: 1000, balance: 500, status: "sent" }],
      creditnotes: [{ creditnote_id: "cnA", customer_id: "custA", total: 100, date: "2026-07-01", invoices_credited: [{ invoice_id: "invA", amount_applied: 100 }] }],
      customerpayments: [{ payment_id: "payA", customer_id: "custA", amount: 400, unused_amount: 0, date: "2026-07-02", invoices: [{ invoice_id: "invA", amount_applied: 400 }] }],
    });
    const r = await runBooksSync(booksEnv(), { full: true }, impl);
    expect(r.status).toBe("ok");
    expect(r.invoices).toBe(1);
    expect(r.backfill_complete).toBe(true);
    const inv = await (env.DB as D1Database).prepare("SELECT total, amount_paid, credited, balance, status FROM ar_invoices WHERE id='invA'").first() as { total: number; amount_paid: number; credited: number; balance: number; status: string };
    expect(inv.total).toBe(100000);       // ₹1000.00
    expect(inv.amount_paid).toBe(40000);  // ₹400 applied
    expect(inv.credited).toBe(10000);     // ₹100 credited
    expect(inv.balance).toBe(50000);      // 100000 − 40000 − 10000
    expect(inv.status).toBe("partial");
    // backfill flag persisted; re-run is a no-op (no duplicate invoice rows)
    await runBooksSync(booksEnv(), { full: true }, impl);
    const cnt = await (env.DB as D1Database).prepare("SELECT COUNT(*) AS n FROM ar_invoices WHERE id='invA'").first() as { n: number };
    expect(cnt.n).toBe(1);
    const bf = await (env.DB as D1Database).prepare("SELECT value FROM app_config WHERE key='initial_backfill_complete'").first() as { value: string };
    expect(bf.value).toBe("1");
  });
  it("returns not_configured when Books org id is absent", async () => {
    const r = await runBooksSync(env, { full: true }, (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch);
    expect(r.status).toBe("not_configured");
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — Slice 1, Group 3 (AR read API + webhook AR-routing)
// ══════════════════════════════════════════════════════════════════════
describe("finance-ar/3.A AR read endpoints + IDOR scoping", () => {
  beforeAll(async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    // Two clients' invoices — tst-client's client_id is 'c1'.
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,amount_paid,credited,balance,currency_code,status,age_bucket) VALUES ('ai-c1','ai-c1','INV-C1','c1','2026-06-01','2026-06-30',100000,0,0,100000,'INR','open','1-30')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,amount_paid,credited,balance,currency_code,status,age_bucket) VALUES ('ai-c2','ai-c2','INV-C2','c2','2026-06-01','2026-06-30',200000,0,0,200000,'INR','open','1-30')").run();
  });
  it("finance/super can list all invoices; a client_* token is 403 on /ar/invoices", async () => {
    expect((await get("/api/finance/ar/invoices", adminToken)).status).toBe(200);
    expect((await get("/api/finance/ar/invoices", opsToken)).status).toBe(403);   // ops_manager is unprivileged in this app
    expect((await get("/api/finance/ar/invoices", clientToken)).status).toBe(403);
    const body = await (await get("/api/finance/ar/invoices", adminToken)).json() as { invoices: { id: string }[] };
    expect(body.invoices.some(i => i.id === "ai-c1")).toBe(true);
    expect(body.invoices.some(i => i.id === "ai-c2")).toBe(true);
  });
  it("a client sees ONLY its own statement and is 403 (no data) on another client's", async () => {
    const own = await get("/api/finance/ar/client/c1", clientToken);
    expect(own.status).toBe(200);
    const ob = await own.json() as { invoices: { client_id?: string; id: string }[] };
    expect(ob.invoices.every(i => i.id === "ai-c1")).toBe(true);   // only c1's invoice
    const other = await get("/api/finance/ar/client/c2", clientToken);
    expect(other.status).toBe(403);
    const otherBody = await other.json() as { invoices?: unknown };
    expect(otherBody.invoices).toBeUndefined();                    // no data leaked in the body
  });
  it("finance can read any client's statement; summary is per-currency with DSO", async () => {
    expect((await get("/api/finance/ar/client/c2", adminToken)).status).toBe(200);
    const sum = await (await get("/api/finance/ar/summary", adminToken)).json() as { by_currency: { currency: string; outstanding: number; dso: number }[] };
    const inr = sum.by_currency.find(c => c.currency === "INR")!;
    expect(inr).toBeTruthy();
    expect(inr.outstanding).toBeGreaterThanOrEqual(300000);        // c1 + c2 outstanding
    expect(typeof inr.dso).toBe("number");
    expect((await get("/api/finance/ar/summary", clientToken)).status).toBe(403);
  });
});

describe("finance-ar/3 books sync endpoint gating", () => {
  it("is finance/super only and ships disabled (no-op)", async () => {
    expect((await post("/api/integrations/zoho-books/sync", {}, clientToken)).status).toBe(403);
    expect((await post("/api/integrations/zoho-books/sync", {}, opsToken)).status).toBe(403); // sync is super/finance only
    const res = await post("/api/integrations/zoho-books/sync", {}, adminToken);
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe("disabled");
  });
});

describe("finance-ar/3.B webhook routes customer payment to AR, not purchase_orders", () => {
  it("a matching AR invoice is handled and the AP purchase_order is left untouched", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    // An AR invoice AND a same-id purchase_order (the exact collision the old bug hit).
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,due_date,total,balance,currency_code,status) VALUES ('INV-W','INV-W','INV-W','c1','2026-06-30',50000,50000,'INR','open')").run();
    await db.prepare("INSERT OR REPLACE INTO purchase_orders (id,vendor_id,status) VALUES ('INV-W','v1','OPEN')").run();
    const res = await post("/api/integrations/zoho/webhook", { event_type: "invoice.payment_received", data: { invoice_number: "INV-W" } });
    expect(res.status).toBe(200);
    const po = await db.prepare("SELECT status FROM purchase_orders WHERE id='INV-W'").first() as { status: string };
    expect(po.status).toBe("OPEN"); // NOT flipped to PAID — the AP row is untouched
  });
  it("an unknown invoice is a safe no-op", async () => {
    const res = await post("/api/integrations/zoho/webhook", { event_type: "invoice.payment_received", data: { invoice_number: "does-not-exist" } });
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — Slice 1, Group 4 (Gmail transport)
// Uses a REAL generated RSA key so the PEM→DER + RS256 sign path is exercised
// (the plan-validation `gmail-rs256-pem-decode-omitted` first-domino finding).
// ══════════════════════════════════════════════════════════════════════
let _testPem = "";
let _testPubKey: CryptoKey;
beforeAll(async () => {
  const kp = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let bin = ""; for (let i = 0; i < pkcs8.length; i++) bin += String.fromCharCode(pkcs8[i]);
  _testPem = "-----BEGIN PRIVATE KEY-----\n" + btoa(bin).replace(/(.{64})/g, "$1\n") + "\n-----END PRIVATE KEY-----\n";
  _testPubKey = kp.publicKey;
});
function gmailEnv(pem = _testPem) {
  return { ...(env as Record<string, unknown>), GOOGLE_SA_EMAIL: "sa@proj.iam.gserviceaccount.com", GOOGLE_SA_PRIVATE_KEY: pem, GMAIL_SENDER: "accounts@4syz.com" } as unknown as typeof env;
}
async function clearGmailTokenCache() {
  await (env.DB as D1Database).prepare("DELETE FROM app_config WHERE key IN ('gmail_token','gmail_token_exp')").run();
}
function b64urlDecode(s: string): string { return atob(s.replace(/-/g, "+").replace(/_/g, "/")); }

describe("finance-ar/4.A gmailGetToken (RS256 SA JWT)", () => {
  it("signs a valid RS256 JWT from a real PEM and returns the access token", async () => {
    await clearGmailTokenCache();
    let captured = "";
    let tokenCalls = 0;
    const impl = (async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        tokenCalls++;
        captured = new URLSearchParams(String(init?.body)).get("assertion") || "";
        return new Response(JSON.stringify({ access_token: "gtok-1", expires_in: 3600 }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const tok = await gmailGetToken(gmailEnv(), impl);
    expect(tok).toBe("gtok-1");
    // The JWT verifies against the generated public key, and carries the right claims.
    const [h64, c64, s64] = captured.split(".");
    const sig = Uint8Array.from(b64urlDecode(s64), c => c.charCodeAt(0));
    const okSig = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", _testPubKey, sig, new TextEncoder().encode(`${h64}.${c64}`));
    expect(okSig).toBe(true);
    const claims = JSON.parse(b64urlDecode(c64));
    expect(claims.sub).toBe("accounts@4syz.com");
    expect(claims.scope).toContain("gmail.send");
    // Second call is served from cache — no new token exchange.
    await gmailGetToken(gmailEnv(), impl);
    expect(tokenCalls).toBe(1);
  });
  it("throws a distinct auth error for a bad key (not a per-recipient failure)", async () => {
    await clearGmailTokenCache();
    let threw = false;
    try { await gmailGetToken(gmailEnv("-----BEGIN PRIVATE KEY-----\nnot-base64!!\n-----END PRIVATE KEY-----"), (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch); }
    catch { threw = true; }
    expect(threw).toBe(true);
  });
});

describe("finance-ar/4.B gmailSend", () => {
  function sendMock(sendStatus: number, sendBody: unknown, opts: { first401?: boolean } = {}) {
    const state = { rawSent: "", tokenCalls: 0, sendCalls: 0 };
    const impl = (async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token")) { state.tokenCalls++; return new Response(JSON.stringify({ access_token: `gtok-${state.tokenCalls}`, expires_in: 3600 }), { status: 200 }); }
      if (u.includes("gmail.googleapis.com")) {
        state.sendCalls++;
        state.rawSent = (JSON.parse(String(init?.body)) as { raw: string }).raw;
        if (opts.first401 && state.sendCalls === 1) return new Response("{}", { status: 401 });
        return new Response(JSON.stringify(sendBody), { status: sendStatus });
      }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    return { impl, state };
  }
  it("sends an HTML message and returns the Gmail messageId", async () => {
    await clearGmailTokenCache();
    const { impl, state } = sendMock(200, { id: "msg-1" });
    const r = await gmailSend(gmailEnv(), { to: "x@y.test", subject: "Statement", html: "<b>Due &amp; owing</b>" }, impl);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messageId).toBe("msg-1");
    const raw = b64urlDecode(state.rawSent);
    expect(raw).toContain("To: x@y.test");
    expect(raw).toContain("Subject: Statement");
    expect(raw).toContain("From: accounts@4syz.com");
  });
  it("attaches a PDF as multipart/mixed", async () => {
    await clearGmailTokenCache();
    const { impl, state } = sendMock(200, { id: "msg-2" });
    const r = await gmailSend(gmailEnv(), { to: "x@y.test", subject: "Inv", text: "see attached", attachment: { filename: "INV-1.pdf", contentType: "application/pdf", contentBase64: btoa("PDFDATA") } }, impl);
    expect(r.ok).toBe(true);
    const raw = b64urlDecode(state.rawSent);
    expect(raw).toContain("multipart/mixed");
    expect(raw).toContain('filename="INV-1.pdf"');
  });
  it("re-mints the token once on a 401 then succeeds", async () => {
    await clearGmailTokenCache();
    const { impl, state } = sendMock(200, { id: "msg-3" }, { first401: true });
    const r = await gmailSend(gmailEnv(), { to: "x@y.test", subject: "Hi", text: "hi" }, impl);
    expect(r.ok).toBe(true);
    expect(state.tokenCalls).toBe(2);  // initial + forced re-mint
    expect(state.sendCalls).toBe(2);
  });
  it("returns kind:'send' on a non-2xx and kind:'auth' when unconfigured", async () => {
    await clearGmailTokenCache();
    const { impl } = sendMock(400, { error: { message: "Bad Request" } });
    const bad = await gmailSend(gmailEnv(), { to: "x@y.test", subject: "Hi", text: "hi" }, impl);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.kind).toBe("send");
    // Missing GMAIL secrets → auth kind, and NO send call is attempted.
    await clearGmailTokenCache(); // drop any token cached by the case above (cache short-circuits config)
    let sendAttempted = false;
    const impl2 = (async (url: string | URL) => { if (String(url).includes("gmail.googleapis.com")) sendAttempted = true; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const noAuth = await gmailSend(env, { to: "x@y.test", subject: "Hi", text: "hi" }, impl2);
    expect(noAuth.ok).toBe(false);
    if (!noAuth.ok) expect(noAuth.kind).toBe("auth");
    expect(sendAttempted).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — Slice 1, Group 5 (consolidated dunning engine)
// ══════════════════════════════════════════════════════════════════════
const TIER_RULES = REMINDER_RULE_SEED.map(x => ({ tier: x.tier, min_overdue_days: x.min }));
function daysAgoISO(n: number) { return new Date(Date.parse(istToday() + "T00:00:00Z") - n * 86400000).toISOString(); }
function dueDaysAgo(n: number) { return new Date(Date.parse(istToday() + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10); }
async function seedDunClient(id: string, email: string | null, invoices: Array<{ id: string; due: string; total: number; balance: number; currency?: string; status?: string; tok?: string }>) {
  const db = env.DB as D1Database;
  await ensureArSchema(env);
  await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email,dunning_opt_out) VALUES (?,?,?,0)").bind(id, "Name " + id, email).run();
  await db.prepare("DELETE FROM ar_invoices WHERE client_id=?").bind(id).run();
  await db.prepare("DELETE FROM reminder_runs WHERE client_id=?").bind(id).run();
  await db.prepare("DELETE FROM reminder_holds WHERE client_id=?").bind(id).run();
  for (const iv of invoices)
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,due_date,total,balance,currency_code,status,cycle_token) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(iv.id, iv.id, iv.id, id, iv.due, iv.total, iv.balance, iv.currency || "INR", iv.status || "open", iv.tok || ("tok-" + iv.id)).run();
}
function gmailStub(sendId = "m1") {
  const st = { sends: 0, tokens: 0 };
  const impl = (async (url: string | URL) => {
    const u = String(url);
    if (u.includes("oauth2.googleapis.com/token")) { st.tokens++; return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 }); }
    if (u.includes("gmail.googleapis.com")) { st.sends++; return new Response(JSON.stringify({ id: sendId }), { status: 200 }); }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  return { impl, st };
}

describe("finance-ar/5.B buildStatement", () => {
  it("groups per currency, picks the tier, and derives cycle_batch", () => {
    const inv = [
      { id: "i1", balance: 50000, due_date: dueDaysAgo(5), currency_code: "INR", cycle_token: "a", status: "open" },
      { id: "i2", balance: 20000, due_date: dueDaysAgo(2), currency_code: "USD", cycle_token: "b", status: "open" },
      { id: "i3", balance: 0, due_date: dueDaysAgo(1), currency_code: "INR", cycle_token: "c", status: "open" }, // settled, excluded
    ];
    const s = buildStatement(inv, TIER_RULES, istToday())!;
    expect(s.tier).toBe("overdue-1");                 // worst overdue is 5 days
    expect(s.by_currency.length).toBe(2);             // INR + USD, no blended total
    expect(s.invoice_ids.sort()).toEqual(["i1", "i2"]);
    expect(s.cycle_batch).toBe(hashStr(["a", "b"].sort().join("|")));
  });
  it("returns null when nothing is due", () => {
    expect(buildStatement([{ id: "x", balance: 0, due_date: dueDaysAgo(1), cycle_token: "z", status: "open" }], TIER_RULES, istToday())).toBeNull();
  });
});

describe("finance-ar/5.C sendStatement", () => {
  it("dry_run logs a row and sends zero email", async () => {
    await seedDunClient("dc-dry", "a@x.test", [{ id: "di1", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    const { impl, st } = gmailStub();
    const r = await sendStatement(gmailEnv(), { client_id: "dc-dry", email: "a@x.test", name: "A" }, { mode: "dry_run" }, impl);
    expect(r.status).toBe("dry_run");
    expect(st.sends).toBe(0);
    const row = await (env.DB as D1Database).prepare("SELECT status FROM reminder_runs WHERE client_id='dc-dry' AND status='dry_run'").first();
    expect(row).toBeTruthy();
  });
  it("live sends once; a second same-day send never double-sends (gap guards it)", async () => {
    await clearGmailTokenCache();
    await seedDunClient("dc-idem", "a@x.test", [{ id: "ii1", due: dueDaysAgo(3), total: 50000, balance: 50000, tok: "T1" }]);
    const { impl, st } = gmailStub("mid-1");
    const r1 = await sendStatement(gmailEnv(), { client_id: "dc-idem", email: "a@x.test" }, { mode: "live" }, impl);
    expect(r1.status).toBe("sent");
    if (r1.status === "sent") expect(r1.messageId).toBe("mid-1");
    // Sequential re-send is blocked by the min-gap (the unique-key 'duplicate' path is the
    // concurrent/crash case, covered by the reserve-before-send test below).
    const r2 = await sendStatement(gmailEnv(), { client_id: "dc-idem", email: "a@x.test" }, { mode: "live" }, impl);
    expect(r2.status).toBe("suppressed");
    if (r2.status === "suppressed") expect(r2.reason).toBe("gap-not-elapsed");
    expect(st.sends).toBe(1); // never double-sends
  });
  it("reserve-before-send: a stale 'sending' row blocks a re-send (crash recovery)", async () => {
    await seedDunClient("dc-crash", "a@x.test", [{ id: "ic1", due: dueDaysAgo(3), total: 50000, balance: 50000, tok: "ONLY" }]);
    const batch = hashStr(["ONLY"].join("|"));
    await (env.DB as D1Database).prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status) VALUES ('pre','dc-crash','overdue-1',?, 'sending')").bind(batch).run();
    const { impl, st } = gmailStub();
    const r = await sendStatement(gmailEnv(), { client_id: "dc-crash", email: "a@x.test" }, { mode: "live" }, impl);
    expect(r.status).toBe("duplicate");
    expect(st.sends).toBe(0);
  });
  it("suppresses opt-out and an active PTP hold (force never overrides holds)", async () => {
    await seedDunClient("dc-opt", "a@x.test", [{ id: "io1", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    const { impl, st } = gmailStub();
    const r = await sendStatement(gmailEnv(), { client_id: "dc-opt", email: "a@x.test", dunning_opt_out: 1 }, { mode: "live", force: true }, impl);
    expect(r.status).toBe("suppressed");
    if (r.status === "suppressed") expect(r.reason).toBe("opt_out");
    // Active future PTP
    await seedDunClient("dc-ptp", "a@x.test", [{ id: "ip1", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    await (env.DB as D1Database).prepare("INSERT INTO reminder_holds (id,client_id,kind,ptp_date) VALUES ('h1','dc-ptp','ptp',?)").bind(dueDaysAgo(-10)).run();
    const r2 = await sendStatement(gmailEnv(), { client_id: "dc-ptp", email: "a@x.test" }, { mode: "live", force: true }, impl);
    expect(r2.status).toBe("suppressed");
    if (r2.status === "suppressed") expect(r2.reason).toBe("ptp");
    expect(st.sends).toBe(0);
  });
  it("suppresses a customer with no email (flagged, not silent)", async () => {
    await seedDunClient("dc-noemail", null, [{ id: "in1", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    const { impl } = gmailStub();
    const r = await sendStatement(gmailEnv(), { client_id: "dc-noemail", email: undefined }, { mode: "live" }, impl);
    expect(r.status).toBe("suppressed");
    if (r.status === "suppressed") expect(r.reason).toBe("no-email");
    const row = await (env.DB as D1Database).prepare("SELECT suppressed_reason FROM reminder_runs WHERE client_id='dc-noemail'").first() as { suppressed_reason: string };
    expect(row.suppressed_reason).toBe("no-email");
  });
  it("min-gap blocks a re-send; force overrides the gap (above the 24h floor)", async () => {
    await seedDunClient("dc-gap", "a@x.test", [{ id: "ig1", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    await (env.DB as D1Database).prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status,run_at) VALUES ('g0','dc-gap','overdue-1','prevbatch','sent',?)").bind(daysAgoISO(2)).run();
    const { impl, st } = gmailStub("mid-gap");
    const blocked = await sendStatement(gmailEnv(), { client_id: "dc-gap", email: "a@x.test" }, { mode: "live" }, impl);
    expect(blocked.status).toBe("suppressed");
    if (blocked.status === "suppressed") expect(blocked.reason).toBe("gap-not-elapsed");
    expect(st.sends).toBe(0);
    const forced = await sendStatement(gmailEnv(), { client_id: "dc-gap", email: "a@x.test" }, { mode: "live", force: true }, impl);
    expect(forced.status).toBe("sent"); // 2 days ago > 24h floor
    expect(st.sends).toBe(1);
  });
});

describe("finance-ar/5.D runReminderPass", () => {
  async function setCfg2(k: string, v: string) { await (env.DB as D1Database).prepare("INSERT INTO app_config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run(); }
  it("no-ops on the wrong cron, when off, and when backfill is pending", async () => {
    await ensureArSchema(env);
    await setCfg2("reminders_mode", "dry_run"); await setCfg2("initial_backfill_complete", "1");
    expect((await runReminderPass(env, "0 */3 * * *")).status).toBe("disabled"); // wrong tick
    await setCfg2("reminders_mode", "off");
    expect((await runReminderPass(env, "30 2 * * *")).status).toBe("disabled");
    await setCfg2("reminders_mode", "dry_run"); await setCfg2("initial_backfill_complete", "0");
    expect((await runReminderPass(env, "30 2 * * *")).status).toBe("backfill_pending");
  });
  it("auto-sends only pre-due/on-due; overdue customers are left to the worklist", async () => {
    await setCfg2("reminders_mode", "dry_run"); await setCfg2("initial_backfill_complete", "1");
    await seedDunClient("dp-auto", "a@x.test", [{ id: "pa1", due: istToday(), total: 50000, balance: 50000 }]);   // on-due → auto
    await seedDunClient("dp-manual", "b@x.test", [{ id: "pm1", due: dueDaysAgo(20), total: 50000, balance: 50000 }]); // overdue-2 → manual
    const r = await runReminderPass(env, "30 2 * * *");
    expect(r.status).toBe("ok");
    const autoRow = await (env.DB as D1Database).prepare("SELECT COUNT(*) AS n FROM reminder_runs WHERE client_id='dp-auto' AND status='dry_run'").first() as { n: number };
    expect(autoRow.n).toBeGreaterThanOrEqual(1);  // auto tier considered
    const manRow = await (env.DB as D1Database).prepare("SELECT COUNT(*) AS n FROM reminder_runs WHERE client_id='dp-manual'").first() as { n: number };
    expect(manRow.n).toBe(0);                      // manual tier NOT auto-sent
  });
});

describe("finance-ar/5.E reminder endpoints", () => {
  it("rules/runs/followups are finance-gated; send-followup + hold are super/finance", async () => {
    await ensureArSchema(env);
    expect((await get("/api/finance/reminders/rules", adminToken)).status).toBe(200);
    expect((await get("/api/finance/reminders/rules", clientToken)).status).toBe(403);
    const rules = await (await get("/api/finance/reminders/rules", adminToken)).json() as { rules: unknown[] };
    expect(rules.rules.length).toBe(5);
    expect((await get("/api/finance/reminders/followups-due", adminToken)).status).toBe(200);
    expect((await post("/api/finance/reminders/send-followup", { client_id: "x" }, clientToken)).status).toBe(403);
    expect((await post("/api/finance/reminders/run", {}, opsToken)).status).toBe(403);
  });
  it("send-followup respects mode=off (no send)", async () => {
    await seedDunClient("ep-1", "a@x.test", [{ id: "ep1i", due: dueDaysAgo(20), total: 50000, balance: 50000 }]);
    await (env.DB as D1Database).prepare("INSERT INTO app_config (key,value) VALUES ('reminders_mode','off') ON CONFLICT(key) DO UPDATE SET value='off'").run();
    const res = await post("/api/finance/reminders/send-followup", { client_id: "ep-1" }, adminToken);
    expect(res.status).toBe(200);
    expect((await res.json() as { status: string }).status).toBe("off");
  });
  it("hold endpoint validates kind and PTP horizon", async () => {
    await seedDunClient("ep-hold", "a@x.test", [{ id: "eph", due: dueDaysAgo(3), total: 50000, balance: 50000 }]);
    expect((await post("/api/finance/ar/ep-hold/hold", { kind: "bogus" }, adminToken)).status).toBe(400);
    expect((await post("/api/finance/ar/ep-hold/hold", { kind: "ptp", ptp_date: dueDaysAgo(90) }, adminToken)).status).toBe(400); // >60d out? actually past → invalid
    expect((await post("/api/finance/ar/ep-hold/hold", { kind: "negotiation" }, adminToken)).status).toBe(200);
    expect((await post("/api/finance/ar/ep-hold/hold", { kind: "negotiation" }, clientToken)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — P3.2 Payables (AP)
// ══════════════════════════════════════════════════════════════════════
describe("finance-ap/mappers", () => {
  it("mapBooksBill → paise, vendor, mirrored status, cycle_token", () => {
    const m = mapBooksBill({ bill_id: "b1", bill_number: "BILL-1", vendor_id: "v1", vendor_name: "Acme Supply", date: "2026-06-01", due_date: "2026-06-30", sub_total: 1000, tax_total: 180, total: 1180, currency_code: "INR", status: "partially_paid" });
    if (!("bill" in m)) throw new Error("expected bill");
    expect(m.bill.total).toBe(118000);
    expect(m.bill.status).toBe("partial");
    expect(m.vendor && m.vendor.vendor_id).toBe("v1");
    expect(typeof m.bill.cycle_token).toBe("string");
  });
  it("mapBooksVendorPayment allocations are direction out / doc_type bill", () => {
    const m = mapBooksVendorPayment({ payment_id: "vp1", vendor_id: "v1", amount: 600, unused_amount: 0, date: "2026-07-01", bills: [{ bill_id: "b1", amount_applied: 600 }] });
    if (!("payment" in m)) throw new Error("expected payment");
    expect(m.payment.direction).toBe("out");
    expect(m.allocations[0].doc_type).toBe("bill");
    expect(m.allocations[0].amount).toBe(60000);
  });
});

describe("finance-ap/runBooksSync mirrors bills + derives balances", () => {
  it("bill balance = total − applied vendor payment", async () => {
    await ensureArSchema(env);
    const { impl } = mockBooks({
      bills: [{ bill_id: "abB", bill_number: "BILL-B", vendor_id: "vB", vendor_name: "Vend B", date: "2026-06-01", due_date: "2026-06-30", sub_total: 1000, tax_total: 0, total: 1000, balance: 400, status: "open" }],
      vendorpayments: [{ payment_id: "vpB", vendor_id: "vB", amount: 600, unused_amount: 0, date: "2026-07-01", bills: [{ bill_id: "abB", amount_applied: 600 }] }],
    });
    const r = await runBooksSync(booksEnv(), { full: true }, impl);
    expect(r.status).toBe("ok");
    expect(r.bills).toBe(1);
    expect(r.vendorpayments).toBe(1);
    const bill = await (env.DB as D1Database).prepare("SELECT total, amount_paid, balance, status FROM ap_bills WHERE id='abB'").first() as { total: number; amount_paid: number; balance: number; status: string };
    expect(bill.total).toBe(100000);
    expect(bill.amount_paid).toBe(60000);
    expect(bill.balance).toBe(40000);
    expect(bill.status).toBe("partial");
    const ven = await (env.DB as D1Database).prepare("SELECT name FROM ap_vendors WHERE vendor_id='vB'").first() as { name: string };
    expect(ven.name).toBe("Vend B");
  });
});

describe("finance-ap/read endpoints — finance-only, never client", () => {
  beforeAll(async () => {
    await ensureArSchema(env);
    await (env.DB as D1Database).prepare("INSERT OR REPLACE INTO ap_bills (id,zoho_bill_id,number,vendor_id,date,due_date,total,amount_paid,balance,currency_code,status,age_bucket) VALUES ('apb1','apb1','B-1','vX','2026-06-01','2026-06-30',100000,0,100000,'INR','open','1-30')").run();
  });
  it("finance/super read bills/summary/vendor; client is 403 on all AP", async () => {
    expect((await get("/api/finance/ap/bills", adminToken)).status).toBe(200);
    expect((await get("/api/finance/ap/summary", adminToken)).status).toBe(200);
    expect((await get("/api/finance/ap/vendor/vX", adminToken)).status).toBe(200);
    expect((await get("/api/finance/ap/bills", clientToken)).status).toBe(403);
    expect((await get("/api/finance/ap/summary", clientToken)).status).toBe(403);
    expect((await get("/api/finance/ap/vendor/vX", clientToken)).status).toBe(403);
  });
  it("summary is per-currency with a DPO number", async () => {
    const sum = await (await get("/api/finance/ap/summary", adminToken)).json() as { by_currency: { currency: string; outstanding: number; dpo: number }[] };
    const inr = sum.by_currency.find(c => c.currency === "INR")!;
    expect(inr.outstanding).toBeGreaterThanOrEqual(100000);
    expect(typeof inr.dpo).toBe("number");
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — P3.3 Reconciliation + P3.5 Dashboard
// ══════════════════════════════════════════════════════════════════════
describe("finance/3way reconciliation", () => {
  it("flags over-application on AR/AP; a manual resolution is not re-flagged; unlinked is NOT noise", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("DELETE FROM reconciliations").run();
    await db.prepare("DELETE FROM ar_invoices WHERE client_id='rc'").run();
    await db.prepare("DELETE FROM ap_bills WHERE vendor_id='rv'").run();
    // Overpaid AR invoice (applied 120000 > total 100000) and a clean direct invoice (unlinked, NOT flagged).
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,client_id,order_id,total,amount_paid,credited,balance,status) VALUES ('rc-over','rc','o1',100000,120000,0,-20000,'paid')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,client_id,total,amount_paid,credited,balance,status) VALUES ('rc-direct','rc',100000,0,0,100000,'open')").run();
    // Overpaid AP bill.
    await db.prepare("INSERT OR REPLACE INTO ap_bills (id,vendor_id,total,amount_paid,balance,status) VALUES ('rv-over','rv',50000,60000,-10000,'paid')").run();
    const r = await runReconciliation(env);
    expect(r.ar_exceptions).toBe(1);   // only the overpayment; the direct invoice is NOT flagged (no unlinked noise)
    expect(r.ap_exceptions).toBe(1);   // the AP overpayment
    const directFlagged = await db.prepare("SELECT COUNT(*) AS n FROM reconciliations WHERE left_id='rc-direct'").first() as { n: number };
    expect(directFlagged.n).toBe(0);
    // Resolve the AR overpayment, then re-run: it must not reappear.
    const exRow = await db.prepare("SELECT id FROM reconciliations WHERE left_id='rc-over' AND status='exception' LIMIT 1").first() as { id: string };
    await db.prepare("UPDATE reconciliations SET status='manual', matched_by='tester' WHERE id=?").bind(exRow.id).run();
    await runReconciliation(env);
    const stillThere = await db.prepare("SELECT COUNT(*) AS n FROM reconciliations WHERE left_id='rc-over' AND status='exception'").first() as { n: number };
    expect(stillThere.n).toBe(0);      // resolved → suppressed
  });
  it("endpoints: run/resolve are super/finance, exceptions/dashboard finance-only", async () => {
    expect((await post("/api/finance/reconcile/run", {}, clientToken)).status).toBe(403);
    expect((await post("/api/finance/reconcile/run", {}, opsToken)).status).toBe(403);
    expect((await post("/api/finance/reconcile/run", {}, adminToken)).status).toBe(200);
    expect((await get("/api/finance/reconcile/exceptions", adminToken)).status).toBe(200);
    expect((await get("/api/finance/reconcile/exceptions", clientToken)).status).toBe(403);
    expect((await post("/api/finance/reconcile/does-not-exist/resolve", { note: "x" }, adminToken)).status).toBe(404);
    const dash = await get("/api/finance/dashboard", adminToken);
    expect(dash.status).toBe(200);
    const body = await dash.json() as { cash: unknown[]; open_exceptions: number };
    expect(Array.isArray(body.cash)).toBe(true);
    expect(typeof body.open_exceptions).toBe("number");
    expect((await get("/api/finance/dashboard", clientToken)).status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — code-review fixes (regression coverage)
// ══════════════════════════════════════════════════════════════════════
describe("finance/cr-fix retry + opt-out clear + ptp validation", () => {
  it("a failed send is retryable next pass (does not block on the unique key)", async () => {
    await clearGmailTokenCache();
    await seedDunClient("cr-retry", "a@x.test", [{ id: "cr1", due: dueDaysAgo(3), total: 50000, balance: 50000, tok: "RT" }]);
    let gmailCalls = 0;
    const impl = (async (url: string | URL) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (u.includes("gmail.googleapis.com")) { gmailCalls++; return gmailCalls === 1 ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ id: "ok-2" }), { status: 200 }); }
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    const r1 = await sendStatement(gmailEnv(), { client_id: "cr-retry", email: "a@x.test" }, { mode: "live" }, impl);
    expect(r1.status).toBe("failed");
    const r2 = await sendStatement(gmailEnv(), { client_id: "cr-retry", email: "a@x.test" }, { mode: "live" }, impl);
    expect(r2.status).toBe("sent");        // NOT 'duplicate' — the failed row freed the cycle_batch
    expect(gmailCalls).toBe(2);
  });
  it("clearing a hold re-enables dunning_opt_out", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email,dunning_opt_out) VALUES ('cr-opt','X','x@y.test',1)").run();
    await db.prepare("INSERT INTO reminder_holds (id,client_id,kind) VALUES ('crh','cr-opt','opt_out')").run();
    const res = await post("/api/finance/ar/cr-opt/hold", { clear: true }, adminToken);
    expect(res.status).toBe(200);
    const row = await db.prepare("SELECT dunning_opt_out FROM ar_clients WHERE client_id='cr-opt'").first() as { dunning_opt_out: number };
    expect(row.dunning_opt_out).toBe(0);   // re-enabled
  });
  it("a PTP hold without a date is rejected (400)", async () => {
    await ensureArSchema(env);
    await (env.DB as D1Database).prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email) VALUES ('cr-ptp','X','x@y.test')").run();
    expect((await post("/api/finance/ar/cr-ptp/hold", { kind: "ptp" }, adminToken)).status).toBe(400);
    expect((await post("/api/finance/ar/cr-ptp/hold", { kind: "ptp", ptp_date: dueDaysAgo(-10) }, adminToken)).status).toBe(200); // 10 days out
  });
});

// ══════════════════════════════════════════════════════════════════════
// Phase 3 Finance — Finance Setup control panel (go-live)
// ══════════════════════════════════════════════════════════════════════
describe("finance/finance-setup control panel", () => {
  async function cfg(k: string, v: string) {
    await (env.DB as D1Database).prepare("INSERT INTO app_config (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(k, v).run();
  }
  it("status is finance-readable; settings are super-admin only", async () => {
    await ensureArSchema(env);
    const st = await get("/api/finance/status", adminToken);
    expect(st.status).toBe(200);
    const body = await st.json() as { books_sync_enabled: boolean; zoho: unknown; counts: unknown };
    expect(typeof body.books_sync_enabled).toBe("boolean");
    expect(body.zoho).toBeTruthy();
    expect(body.counts).toBeTruthy();
    expect((await get("/api/finance/status", clientToken)).status).toBe(403);
    expect((await post("/api/finance/settings", { books_sync_enabled: true }, clientToken)).status).toBe(403);
    expect((await post("/api/finance/settings", { books_sync_enabled: true }, opsToken)).status).toBe(403); // not super
  });
  it("toggling Books sync persists", async () => {
    const r = await (await post("/api/finance/settings", { books_sync_enabled: true }, adminToken)).json() as { books_sync_enabled: boolean };
    expect(r.books_sync_enabled).toBe(true);
    const r2 = await (await post("/api/finance/settings", { books_sync_enabled: false }, adminToken)).json() as { books_sync_enabled: boolean };
    expect(r2.books_sync_enabled).toBe(false);
  });
  it("Live is guarded until backfill is complete AND a dry run exists", async () => {
    const db = env.DB as D1Database;
    await cfg("initial_backfill_complete", "0");
    expect((await post("/api/finance/settings", { reminders_mode: "live" }, adminToken)).status).toBe(400); // no backfill
    await cfg("initial_backfill_complete", "1");
    await db.prepare("DELETE FROM reminder_runs WHERE status='dry_run'").run();
    expect((await post("/api/finance/settings", { reminders_mode: "live" }, adminToken)).status).toBe(400); // no dry run
    await db.prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status) VALUES ('fs-dry','cX','on-due','fsb','dry_run')").run();
    const ok = await post("/api/finance/settings", { reminders_mode: "live" }, adminToken);
    expect(ok.status).toBe(200);
    expect((await ok.json() as { reminders_mode: string }).reminders_mode).toBe("live");
    await post("/api/finance/settings", { reminders_mode: "off" }, adminToken); // reset
  });
  it("rejects an invalid reminder mode", async () => {
    expect((await post("/api/finance/settings", { reminders_mode: "banana" }, adminToken)).status).toBe(400);
  });
});

describe("finance/usability — names surface instead of Zoho ids", () => {
  it("AR invoices, AP bills, and dashboard top-lists carry human names", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email) VALUES ('nm-c','Acme Foods Pvt Ltd','ap@acme.test')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,due_date,total,balance,currency_code,status,age_bucket) VALUES ('nm-inv','nm-inv','NM-1','nm-c','2026-06-30',100000,100000,'INR','open','1-30')").run();
    await db.prepare("INSERT OR REPLACE INTO ap_vendors (vendor_id,name) VALUES ('nm-v','Sunrise Supply Co')").run();
    await db.prepare("INSERT OR REPLACE INTO ap_bills (id,zoho_bill_id,number,vendor_id,due_date,total,balance,currency_code,status,age_bucket) VALUES ('nm-bill','nm-bill','NB-1','nm-v','2026-06-30',50000,50000,'INR','open','1-30')").run();
    const inv = await (await get("/api/finance/ar/invoices", adminToken)).json() as { invoices: { id: string; client_name?: string }[] };
    expect(inv.invoices.find(i => i.id === "nm-inv")?.client_name).toBe("Acme Foods Pvt Ltd");
    const bills = await (await get("/api/finance/ap/bills", adminToken)).json() as { bills: { id: string; vendor_name?: string }[] };
    expect(bills.bills.find(b => b.id === "nm-bill")?.vendor_name).toBe("Sunrise Supply Co");
    const dash = await (await get("/api/finance/dashboard", adminToken)).json() as { top_debtors: { name?: string; client_id: string }[] };
    expect(dash.top_debtors.some(d => d.name === "Acme Foods Pvt Ltd")).toBe(true);
  });
});

describe("finance/usability — last-synced freshness surfaces", () => {
  it("status, AR summary, and AP summary all report books_last_sync_at", async () => {
    await ensureArSchema(env);
    await setCfg("books_last_sync_at", "2026-09-20T10:00:00.000Z");
    const st = await (await get("/api/finance/status", adminToken)).json() as { last_sync_at: string | null };
    expect(st.last_sync_at).toBe("2026-09-20T10:00:00.000Z");
    const ar = await (await get("/api/finance/ar/summary", adminToken)).json() as { last_sync_at: string | null };
    expect(ar.last_sync_at).toBe("2026-09-20T10:00:00.000Z");
    const ap = await (await get("/api/finance/ap/summary", adminToken)).json() as { last_sync_at: string | null };
    expect(ap.last_sync_at).toBe("2026-09-20T10:00:00.000Z");
  });
});

describe("delivery — destination details + driver reassignment", () => {
  it("delivery-challan list carries the client's address, map pin, and receiving contact", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO clients (id,name,active,address,contact_name,contact_phone,map_pin) VALUES ('DEL-CL','Harbour Foods',1,'12 MG Road, Bengaluru','Priya Nair','+91-9800011122','12.9716,77.5946')").run();
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,grand_total,order_type) VALUES ('DEL-ORD','DEL-CL','tst-ops','IN_SHIPMENT',1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,dc_number,status,total_qty) VALUES ('DEL-DC','DEL-ORD','DEL-DC-1','IN_TRANSIT',5)").run();
    const list = await (await get("/api/delivery-challans", adminToken)).json() as Array<Record<string, unknown>>;
    const dc = list.find(d => d.id === "DEL-DC")!;
    expect(dc.client_address).toBe("12 MG Road, Bengaluru");
    expect(dc.client_contact_name).toBe("Priya Nair");
    expect(dc.client_contact_phone).toBe("+91-9800011122");
    expect(dc.client_map_pin).toBe("12.9716,77.5946");
    const one = await (await get("/api/delivery-challans/DEL-DC", adminToken)).json() as Record<string, unknown>;
    expect(one.client_address).toBe("12 MG Road, Bengaluru");
    expect(one.client_contact_phone).toBe("+91-9800011122");
  });

  it("reassign changes the delivery person after dispatch; super/ops-admin only; blocked once delivered", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO clients (id,name,active) VALUES ('RA-CL','Reassign Co',1)").run();
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,grand_total,order_type) VALUES ('RA-ORD','RA-CL','tst-ops','IN_SHIPMENT',500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,dc_number,status,driver_name) VALUES ('RA-DC','RA-ORD','RA-DC-1','IN_TRANSIT','Old Driver')").run();
    await db.prepare("INSERT OR REPLACE INTO staff (id,name,phone,role,active) VALUES ('RA-STF','Ravi Kumar','+91-9900011122','delivery_staff',1)").run();

    // A client user cannot reassign.
    expect((await post("/api/delivery-challans/RA-DC/reassign", { driver_name: "X" }, clientToken)).status).toBe(403);
    // ops_manager (seeded, unprivileged) cannot reassign.
    expect((await post("/api/delivery-challans/RA-DC/reassign", { driver_name: "X" }, opsToken)).status).toBe(403);

    // Super admin reassigns by staff — the staff name becomes the driver_name so the
    // delivery_exec name-match keeps resolving the DC.
    const ok = await post("/api/delivery-challans/RA-DC/reassign", { staff_id: "RA-STF" }, adminToken);
    expect(ok.status).toBe(200);
    let row = await db.prepare("SELECT staff_id,driver_name FROM delivery_challans WHERE id='RA-DC'").first() as { staff_id: string; driver_name: string };
    expect(row.staff_id).toBe("RA-STF");
    expect(row.driver_name).toBe("Ravi Kumar");

    // An explicit driver name overrides.
    await post("/api/delivery-challans/RA-DC/reassign", { driver_name: "Direct Driver", driver_phone: "+91-9000000000" }, adminToken);
    row = await db.prepare("SELECT driver_name FROM delivery_challans WHERE id='RA-DC'").first() as { staff_id: string; driver_name: string };
    expect(row.driver_name).toBe("Direct Driver");

    // Once delivered, reassignment is refused.
    await db.prepare("UPDATE delivery_challans SET status='DELIVERED' WHERE id='RA-DC'").run();
    expect((await post("/api/delivery-challans/RA-DC/reassign", { driver_name: "Too Late" }, adminToken)).status).toBe(409);
  });
});

describe("finance/finance-setup — sync error is surfaced with a hint", () => {
  it("status exposes last_sync_error and maps a 401 to a Books-scope hint", async () => {
    await ensureArSchema(env);
    await setCfg("books_last_sync_error", "error: ZohoAuthError: 401 on Books contacts page 1");
    const st = await (await get("/api/finance/status", adminToken)).json() as { last_sync_error: string | null; last_sync_hint: string };
    expect(st.last_sync_error).toContain("401");
    expect(st.last_sync_hint).toMatch(/ZohoBooks\.fullaccess|Books permission/i);
    // A clean state reports no error.
    await setCfg("books_last_sync_error", "");
    const clean = await (await get("/api/finance/status", adminToken)).json() as { last_sync_error: string | null; last_sync_hint: string };
    expect(clean.last_sync_error).toBe(null);
    expect(clean.last_sync_hint).toBe("");
  });
});

describe("finance/books-sync — rebuild from Books mints a fresh Zoho token", () => {
  it("clears the cached Zoho access token at rebuild start so a rotated token takes effect", async () => {
    await ensureArSchema(env);
    await setCfg("books_sync_enabled", "1");
    await setCfg("zoho_token", "stale-cached-token");
    await setCfg("zoho_token_exp", String(Math.floor(Date.now() / 1000) + 3600)); // not yet expired
    // A rebuild START (a prior backfill was complete) must invalidate the cache up-front
    // so a just-rotated refresh token / new scope takes effect (regardless of the sync's
    // own outcome, which is not_configured in the test env). It clears ONCE here, not on
    // every stepped iteration — see the "cleared once, not per step" test.
    await setCfg("initial_backfill_complete", "1");
    await post("/api/integrations/zoho-books/sync", { full: true }, adminToken);
    expect(await getCfg("zoho_token")).toBe("");
    expect(await getCfg("zoho_token_exp")).toBe("0");
  });
});

describe("finance/zoho — use Worker secret over stored Connect token", () => {
  it("reports token source and clears the stored Connect token on switch (super-admin only)", async () => {
    await ensureArSchema(env);
    await setCfg("zoho_refresh_token", "stored-connect-token-inventory-only");
    await setCfg("zoho_token", "cached-access");
    await setCfg("zoho_token_exp", String(Math.floor(Date.now() / 1000) + 3600));
    const st = await (await get("/api/finance/status", adminToken)).json() as { zoho_token_source: string };
    expect(st.zoho_token_source).toBe("connect");
    // A non-super role cannot switch.
    expect((await post("/api/finance/zoho/use-secret", {}, opsToken)).status).toBe(403);
    // No ZOHO_REFRESH_TOKEN secret in the test env → guarded 400, stored token untouched.
    const noSecret = await post("/api/finance/zoho/use-secret", {}, adminToken);
    expect(noSecret.status).toBe(400);
    expect(await getCfg("zoho_refresh_token")).toBe("stored-connect-token-inventory-only");
  });
});

describe("finance/finance-setup — sync-error hints classify invalid_code vs 401 vs org", () => {
  it("maps invalid_code (refresh-token rejection) to the token/region hint, not the org hint", async () => {
    await ensureArSchema(env);
    await setCfg("books_last_sync_error", "error: auth: Error: invalid_code");
    const a = await (await get("/api/finance/status", adminToken)).json() as { last_sync_hint: string };
    expect(a.last_sync_hint).toMatch(/invalid_code|refresh token/i);
    expect(a.last_sync_hint).not.toMatch(/rejected the organization/i);
    // A genuine 401 still maps to the Books-scope hint.
    await setCfg("books_last_sync_error", "error: Error: 401 on Books contacts page 1");
    const b = await (await get("/api/finance/status", adminToken)).json() as { last_sync_hint: string };
    expect(b.last_sync_hint).toMatch(/Books permission/i);
    // An organization rejection still maps to the org hint.
    await setCfg("books_last_sync_error", "error: Error: CompanyID or CompanyName is invalid");
    const c = await (await get("/api/finance/status", adminToken)).json() as { last_sync_hint: string };
    expect(c.last_sync_hint).toMatch(/rejected the organization/i);
  });
});

describe("finance/zoho — connection self-test probe", () => {
  it("reports token source/region/org and is finance-gated (token refresh fails cleanly with no network)", async () => {
    await ensureArSchema(env);
    await setCfg("zoho_refresh_token", "some-stored-token");
    await setCfg("zoho_token", ""); await setCfg("zoho_token_exp", "0");
    const r = await (await get("/api/finance/zoho/test", adminToken)).json() as { token_source: string; dc: string; token_ok: boolean };
    expect(r.token_source).toBe("connect");
    expect(typeof r.dc).toBe("string");
    expect(r.token_ok).toBe(false); // no outbound network in the test env → refresh fails, reported cleanly
    // client_* role cannot probe.
    expect((await get("/api/finance/zoho/test", clientToken)).status).toBe(403);
  });
});

describe("finance/books — resumable backfill stepper", () => {
  it("advances entity-by-entity across calls, then finalizes and marks backfill complete", async () => {
    await ensureArSchema(env);
    const db = env.DB as D1Database;
    // Clean slate for the backfill state machine.
    await setCfg("books_bf_stage", "0");
    await setCfg("initial_backfill_complete", "0");
    for (const e of ["contacts","invoices","creditnotes","customerpayments","bills","vendorpayments"]) await setCfg(`books_bf_page_${e}`, "1");
    const { impl } = mockBooks({
      contacts: [{ contact_id: "bf-c1", contact_name: "BF Cust", email: "bf@x.test" }],
      invoices: [{ invoice_id: "bf-i1", invoice_number: "BF-1", customer_id: "bf-c1", date: "2026-06-01", due_date: "2026-06-30", total: 1180, sub_total: 1000, tax_total: 180, currency_code: "INR", status: "open", exchange_rate: 1 }],
    });
    // First call: pulls all 6 single-page entities (budget 8 > 6), returns in_progress.
    const s1 = await runBooksBackfillStep(booksEnv(), impl);
    expect(s1.status).toBe("in_progress");
    expect(s1.backfill_complete).toBe(false);
    expect(await getCfg("initial_backfill_complete")).toBe("0");
    // Second call: stage past the last entity → finalize (recompute + mark complete).
    const s2 = await runBooksBackfillStep(booksEnv(), impl);
    expect(s2.status).toBe("ok");
    expect(s2.backfill_complete).toBe(true);
    expect(await getCfg("initial_backfill_complete")).toBe("1");
    // Data landed and balances were recomputed (age bucket set on the open invoice).
    const inv = await db.prepare("SELECT balance, age_bucket FROM ar_invoices WHERE id='bf-i1'").first() as { balance: number; age_bucket: string } | null;
    expect(inv?.balance).toBe(118000);
    expect(typeof inv?.age_bucket).toBe("string");
  });
});

describe("finance-ar/paid-in-books shows paid (not due) even without a synced payment", () => {
  it("mirrors Books balance=0 → status paid; a fully-open invoice stays due", async () => {
    await ensureArSchema(env);
    const { impl } = mockBooks({
      contacts: [{ contact_id: "pc1", contact_name: "PaidCo", email: "p@paid.test" }],
      invoices: [
        // Paid in Books (balance 0), but NO customerpayments/allocations are synced.
        { invoice_id: "426-00437", invoice_number: "426-00437", customer_id: "pc1", date: "2026-05-01", due_date: "2026-05-31", sub_total: 1000, tax_total: 0, total: 1000, balance: 0, status: "paid" },
        // Genuinely outstanding.
        { invoice_id: "open-1", invoice_number: "OPEN-1", customer_id: "pc1", date: "2026-06-01", due_date: "2026-06-30", sub_total: 500, tax_total: 0, total: 500, balance: 500, status: "sent" },
      ],
    });
    const r = await runBooksSync(booksEnv(), { full: true }, impl);
    expect(r.status).toBe("ok");
    const db = env.DB as D1Database;
    const paid = await db.prepare("SELECT balance, status FROM ar_invoices WHERE id='426-00437'").first() as { balance: number; status: string };
    expect(paid.balance).toBe(0);
    expect(paid.status).toBe("paid");   // ← the reported bug: was showing 'open'/due
    const open = await db.prepare("SELECT balance, status FROM ar_invoices WHERE id='open-1'").first() as { balance: number; status: string };
    expect(open.balance).toBe(50000);
    expect(open.status).toBe("open");
  });
});

describe("finance/books — full rebuild resets the backfill state machine", () => {
  it("resync clears initial_backfill_complete + cursors (super-admin only)", async () => {
    await ensureArSchema(env);
    await setCfg("initial_backfill_complete", "1");
    await setCfg("books_bf_stage", "6");
    await setCfg("books_cursor_invoices", "1700000000");
    // A client user cannot rebuild.
    expect((await post("/api/finance/books/resync", {}, clientToken)).status).toBe(403);
    // ops_manager (unprivileged seed) cannot rebuild.
    expect((await post("/api/finance/books/resync", {}, opsToken)).status).toBe(403);
    // Super admin resets the machine.
    const r = await post("/api/finance/books/resync", {}, adminToken);
    expect(r.status).toBe(200);
    expect(await getCfg("initial_backfill_complete")).toBe("0");
    expect(await getCfg("books_bf_stage")).toBe("0");
    expect(await getCfg("books_cursor_invoices")).toBe("0");
  });
});

describe("finance-ar/books_status='paid' forces paid even if balance is missing", () => {
  it("a Books-paid invoice with balance omitted in the payload resolves to paid/0", async () => {
    await ensureArSchema(env);
    const { impl } = mockBooks({
      contacts: [{ contact_id: "bs1", contact_name: "BS Co", email: "b@bs.test" }],
      // NOTE: no `balance` field at all, but Books status = paid.
      invoices: [{ invoice_id: "PAID-NOBAL", invoice_number: "PAID-NOBAL", customer_id: "bs1", date: "2026-04-01", due_date: "2026-04-30", sub_total: 5000, tax_total: 0, total: 5000, status: "paid" }],
    });
    const r = await runBooksSync(booksEnv(), { full: true }, impl);
    expect(r.status).toBe("ok");
    const inv = await (env.DB as D1Database).prepare("SELECT balance, status, books_status FROM ar_invoices WHERE id='PAID-NOBAL'").first() as { balance: number; status: string; books_status: string };
    expect(inv.books_status).toBe("paid");
    expect(inv.balance).toBe(0);      // forced to 0 by books_status, not left at total
    expect(inv.status).toBe("paid");  // ← the reported bug: was showing due
  });
});

describe("finance-ar/by-customer summary + email statement", () => {
  it("aggregates billed/paid/outstanding/overdue per customer and gates email", async () => {
    await ensureArSchema(env);
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email) VALUES ('bc-c1','Bagora Foods','bagora@x.test')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email) VALUES ('bc-c2','No Email Co',NULL)").run();
    // c1: one open (bal 40000, overdue) + one paid (bal 0)
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,age_bucket,books_status) VALUES ('bc-i1','bc-i1','BC-1','bc-c1','2026-04-01','2026-04-30',100000,40000,'INR','partial','1-30','partial')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,age_bucket,books_status) VALUES ('bc-i2','bc-i2','BC-2','bc-c1','2026-03-01','2026-03-31',60000,0,'INR','paid','current','paid')").run();
    const data = await (await get("/api/finance/ar/by-customer", adminToken)).json() as { customers: Array<Record<string, number & string>> };
    const c1 = data.customers.find(c => c.client_id === "bc-c1")!;
    expect(c1.billed).toBe(160000);
    expect(c1.outstanding).toBe(40000);
    expect(c1.paid).toBe(120000);      // billed − outstanding
    expect(c1.overdue).toBe(40000);    // the 1-30 open one
    expect(Number(c1.open_invoices)).toBe(1);
    // Email: a client role is forbidden; a customer with no email is a 400.
    expect((await post("/api/finance/ar/client/bc-c1/email-statement", {}, clientToken)).status).toBe(403);
    expect((await post("/api/finance/ar/client/bc-c2/email-statement", {}, adminToken)).status).toBe(400); // no email on file
  });
});

describe("delivery → order status advances from any non-terminal status (client visibility)", () => {
  it("a delivered DC moves its order to PARTIALLY_CLOSED then CLOSED even if never IN_SHIPMENT", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DLV','c1','tst-ops','READY_TO_PICK',1000,0,1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-dlv-i1','OD-DLV','SKU001','Rice',10,100,1000)").run();
    // DC dispatched only 6 of 10; delivering exactly 6 is NOT a discrepancy (no voice gate).
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODV-DC','OD-DLV','IN_TRANSIT',6,'ODV-1')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odv-di1','ODV-DC','SKU001','Rice',6,0)").run();
    const r1 = await post("/api/delivery-challans/ODV-DC/deliver", { items: [{ sku: "SKU001", qty_delivered: 6 }] }, adminToken);
    expect(r1.status).toBe(200);
    let o = await db.prepare("SELECT status FROM orders WHERE id='OD-DLV'").first() as { status: string };
    expect(o.status).toBe("PARTIALLY_CLOSED"); // was READY_TO_PICK — previously would NOT advance
    // The finalize created a follow-up DC for the remaining 4 — deliver it → CLOSED.
    const follow = await db.prepare("SELECT id FROM delivery_challans WHERE order_id='OD-DLV' AND status='SCHEDULED'").first() as { id: string };
    expect(follow?.id).toBeTruthy();
    await db.prepare("UPDATE delivery_challans SET status='IN_TRANSIT' WHERE id=?").bind(follow.id).run();
    const r2 = await post(`/api/delivery-challans/${follow.id}/deliver`, { items: [{ sku: "SKU001", qty_delivered: 4 }] }, adminToken);
    expect(r2.status).toBe(200);
    o = await db.prepare("SELECT status FROM orders WHERE id='OD-DLV'").first() as { status: string };
    expect(o.status).toBe("CLOSED");
  });
});

describe("recompute order statuses from deliveries (one-time repair)", () => {
  it("advances an order stuck at a pre-delivery status whose DC is already DELIVERED", async () => {
    const db = env.DB as D1Database;
    // Order stuck at PICKED (delivered before the advance-on-delivery fix): DC is
    // DELIVERED with 6 of 10 recorded, but the order status never moved.
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-STUCK','c1','tst-ops','PICKED',1000,0,1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-stk-i1','OD-STUCK','SKU001','Rice',10,100,1000)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,delivered_qty,dc_number) VALUES ('ODS-DC','OD-STUCK','DELIVERED',6,6,'ODS-1')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('ods-di1','ODS-DC','SKU001','Rice',6,6)").run();

    // Dry run reports the change without applying it.
    const dry = await post("/api/orders/recompute-status", { dry_run: true }, adminToken);
    expect(dry.status).toBe(200);
    const dryBody = await dry.json() as { would_change: number; applied: number; results: Array<{order_id:string;to:string;changed:boolean}> };
    expect(dryBody.applied).toBe(0);
    expect(dryBody.results.find(r => r.order_id === "OD-STUCK")).toMatchObject({ to: "PARTIALLY_CLOSED", changed: true });
    let o = await db.prepare("SELECT status FROM orders WHERE id='OD-STUCK'").first() as { status: string };
    expect(o.status).toBe("PICKED"); // unchanged on dry run

    // Apply → order advances to PARTIALLY_CLOSED (6 of 10 delivered).
    const run = await post("/api/orders/recompute-status", { dry_run: false }, adminToken);
    expect(run.status).toBe(200);
    o = await db.prepare("SELECT status FROM orders WHERE id='OD-STUCK'").first() as { status: string };
    expect(o.status).toBe("PARTIALLY_CLOSED");

    // Idempotent: a second apply changes nothing.
    const again = await post("/api/orders/recompute-status", { dry_run: false }, adminToken);
    const againBody = await again.json() as { applied: number };
    expect(againBody.applied).toBe(0);
  });

  it("is forbidden for unprivileged roles", async () => {
    const r = await post("/api/orders/recompute-status", { dry_run: true }, opsToken);
    expect(r.status).toBe(403);
  });
});

describe("orders list surfaces delivered_qty for reconciliation", () => {
  it("returns delivered_qty summed over DELIVERED challans (feeds the Ordered/Delivered/Due view)", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-RECON','c1','tst-ops','READY_TO_PICK',1000,0,1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-recon-i1','OD-RECON','SKU001','Rice',10,100,1000)").run();
    // One DELIVERED challan (3 units) and one still SCHEDULED (must NOT count).
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODR-DC1','OD-RECON','DELIVERED',3,'ODR-1')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odr-di1','ODR-DC1','SKU001','Rice',3,3)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODR-DC2','OD-RECON','SCHEDULED',7,'ODR-2')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odr-di2','ODR-DC2','SKU001','Rice',7,0)").run();

    const r = await get("/api/orders?q=OD-RECON", adminToken);
    expect(r.status).toBe(200);
    const rows = await r.json() as Array<{ id:string; total_qty:number; delivered_qty:number }>;
    const row = rows.find(x => x.id === "OD-RECON")!;
    expect(row.total_qty).toBe(10);
    expect(row.delivered_qty).toBe(3); // only the DELIVERED challan counts — order is partial even though status is READY_TO_PICK
  });
});

describe("delivery-workflow hardening (risks 1-5)", () => {
  it("R3: dispatch advances the order to IN_SHIPMENT from PICKED (symmetric guard)", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DISP','c1','tst-ops','PICKED',1000,0,1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-disp-i1','OD-DISP','SKU001','Rice',10,100,1000)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODP-DC','OD-DISP','SCHEDULED',10,'ODP-1')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odp-di1','ODP-DC','SKU001','Rice',10,0)").run();
    const r = await post("/api/delivery-challans/ODP-DC/dispatch", { vehicle_no: "KA01AB1234", driver_name: "Ravi" }, adminToken);
    expect(r.status).toBe(200);
    const o = await db.prepare("SELECT status FROM orders WHERE id='OD-DISP'").first() as { status: string };
    expect(o.status).toBe("IN_SHIPMENT"); // previously stayed PICKED (guard only matched READY_TO_PICK/PARTIALLY_CLOSED)
  });

  it("R2: the follow-up (back-order) challan gets a collision-free id and its own dc_number", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-BACK','c1','tst-ops','IN_SHIPMENT',1000,0,1000,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-back-i1','OD-BACK','SKU001','Rice',10,100,1000)").run();
    // Dispatch 6, deliver 6 → remainder 4 spins up a follow-up SCHEDULED challan.
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODB-DC','OD-BACK','IN_TRANSIT',6,'ODB-1')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odb-di1','ODB-DC','SKU001','Rice',6,0)").run();
    const r = await post("/api/delivery-challans/ODB-DC/deliver", { items: [{ sku: "SKU001", qty_delivered: 6 }] }, adminToken);
    expect(r.status).toBe(200);
    const follow = await db.prepare("SELECT id, dc_number FROM delivery_challans WHERE order_id='OD-BACK' AND status='SCHEDULED'").first() as { id: string; dc_number: string };
    expect(follow?.id).toBeTruthy();
    expect(follow.id).not.toMatch(/^DC-\d+$/); // no longer the collision-prone random DC-#### id
    expect(follow.dc_number).toBeTruthy();      // carries a proper series number for display
  });

  it("R1: the retired /partial endpoint is gone (404, not a handler)", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODX-DC','OD-BACK','IN_TRANSIT',6,'ODX-1')").run();
    const r = await post("/api/delivery-challans/ODX-DC/partial", { delivered_qty: 3, total_qty: 6 }, adminToken);
    expect(r.status).toBe(404);
  });
});

describe("DC number entry at delivery (the number used in Zoho)", () => {
  it("warehouse/ops may set the DC number at delivery — it replaces the series number", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DCN','c1','tst-ops','IN_SHIPMENT',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-dcn-i1','OD-DCN','SKU001','Rice',5,100,500)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number) VALUES ('ODN-DC','OD-DCN','IN_TRANSIT',5,'DCN-00001')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odn-di1','ODN-DC','SKU001','Rice',5,0)").run();
    // ops_manager is a back-office role → allowed to set the number.
    const r = await post("/api/delivery-challans/ODN-DC/deliver", { items: [{ sku: "SKU001", qty_delivered: 5 }], dc_number: "ZB/2026/00917" }, opsToken);
    expect(r.status).toBe(200);
    const row = await db.prepare("SELECT dc_number FROM delivery_challans WHERE id='ODN-DC'").first() as { dc_number: string };
    expect(row.dc_number).toBe("ZB/2026/00917"); // Zoho number replaced the auto series number
  });

  it("delivery executives cannot set the DC number — delivery still succeeds, number unchanged", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES ('tst-dex','dex@sp.test','SEED:dex123','delivery_exec','Dex Rider','SmartPantry','DX',1)").run();
    const execToken = await login("dex@sp.test", "dex123");
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DCN2','c1','tst-ops','IN_SHIPMENT',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-dcn2-i1','OD-DCN2','SKU001','Rice',5,100,500)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,total_qty,dc_number,driver_name) VALUES ('ODN-DC2','OD-DCN2','IN_TRANSIT',5,'DCN-00002','Dex Rider')").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('odn2-di1','ODN-DC2','SKU001','Rice',5,0)").run();
    const r = await post("/api/delivery-challans/ODN-DC2/deliver", { items: [{ sku: "SKU001", qty_delivered: 5 }], dc_number: "HACK-001" }, execToken);
    expect(r.status).toBe(200); // the delivery itself is allowed
    const row = await db.prepare("SELECT dc_number, status FROM delivery_challans WHERE id='ODN-DC2'").first() as { dc_number: string; status: string };
    expect(row.status).toBe("DELIVERED");
    expect(row.dc_number).toBe("DCN-00002"); // exec's dc_number was ignored
  });
});

describe("DC number entry at DISPATCH (when the driver is assigned)", () => {
  it("warehouse/ops may set the DC number at dispatch — it replaces the series number", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DSP1','c1','tst-ops','PICKED',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-dsp1-i1','OD-DSP1','SKU001','Rice',5,100,500)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,total_qty) VALUES ('DSP-DCN','OD-DSP1','SCHEDULED','DCN-00050',5)").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('dsp1-di1','DSP-DCN','SKU001','Rice',5,0)").run();
    const r = await post("/api/delivery-challans/DSP-DCN/dispatch", { vehicle_no: "KA01AB1234", driver_name: "Ravi", dc_number: "ZB/2026/5001" }, opsToken);
    expect(r.status).toBe(200);
    const row = await db.prepare("SELECT dc_number, status FROM delivery_challans WHERE id='DSP-DCN'").first() as { dc_number: string; status: string };
    expect(row.status).toBe("IN_TRANSIT");
    expect(row.dc_number).toBe("ZB/2026/5001"); // Zoho number set at dispatch replaced the series number
  });

  it("delivery executives cannot set the DC number at dispatch — dispatch still succeeds, number unchanged", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES ('tst-dex2','dex2@sp.test','SEED:dex123','delivery_exec','Dex Two','SmartPantry','DX',1)").run();
    const execToken = await login("dex2@sp.test", "dex123");
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-DSP2','c1','tst-ops','PICKED',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-dsp2-i1','OD-DSP2','SKU001','Rice',5,100,500)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,total_qty) VALUES ('DSP-DCN2','OD-DSP2','SCHEDULED','DCN-00051',5)").run();
    await db.prepare("INSERT OR REPLACE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('dsp2-di1','DSP-DCN2','SKU001','Rice',5,0)").run();
    const r = await post("/api/delivery-challans/DSP-DCN2/dispatch", { vehicle_no: "KA02CD5678", driver_name: "Anil", dc_number: "HACK-001" }, execToken);
    expect(r.status).toBe(200);
    const row = await db.prepare("SELECT dc_number FROM delivery_challans WHERE id='DSP-DCN2'").first() as { dc_number: string };
    expect(row.dc_number).toBe("DCN-00051"); // exec's dc_number was ignored
  });
});

describe("Cancel (void) a pre-dispatch challan — super-admin only", () => {
  it("voids a SCHEDULED challan with a reason; role-gated, reason-required, status-guarded", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-CAN','c1','tst-ops','READY_TO_PICK',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('od-can-i1','OD-CAN','SKU001','Rice',5,100,500)").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,total_qty) VALUES ('CAN-DC','OD-CAN','SCHEDULED','DCN-00015',5)").run();

    expect((await post("/api/delivery-challans/CAN-DC/cancel", { reason: "dup" }, opsToken)).status).toBe(403); // non-super forbidden
    expect((await post("/api/delivery-challans/CAN-DC/cancel", {}, adminToken)).status).toBe(400); // reason required

    const r = await post("/api/delivery-challans/CAN-DC/cancel", { reason: "created in error" }, adminToken);
    expect(r.status).toBe(200);
    const row = await db.prepare("SELECT status, cancel_reason FROM delivery_challans WHERE id='CAN-DC'").first() as { status: string; cancel_reason: string };
    expect(row.status).toBe("CANCELLED");
    expect(row.cancel_reason).toBe("created in error"); // number stays in the register, auditable

    // already cancelled → not cancellable again
    expect((await post("/api/delivery-challans/CAN-DC/cancel", { reason: "again" }, adminToken)).status).toBe(409);
  });

  it("refuses to cancel a challan that has already been dispatched", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR REPLACE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('OD-CAN2','c1','tst-ops','IN_SHIPMENT',500,0,500,'Regular')").run();
    await db.prepare("INSERT OR REPLACE INTO delivery_challans (id,order_id,status,dc_number,total_qty) VALUES ('CAN-DC2','OD-CAN2','IN_TRANSIT','DCN-00017',5)").run();
    const r = await post("/api/delivery-challans/CAN-DC2/cancel", { reason: "too late" }, adminToken);
    expect(r.status).toBe(409); // goods are moving — must not void
  });
});

describe("Tier 1 dues logic — effective due date, dust cutoff, as-of, staleness", () => {
  it("resolveEffectiveDue applies manual → Zoho → client → default precedence", () => {
    expect(resolveEffectiveDue({ invoiceDate: "2026-01-01", zohoDue: "2026-01-20", overrideDate: "2026-02-02", defaultCreditDays: 30 }))
      .toEqual({ due: "2026-02-02", source: "manual" });
    expect(resolveEffectiveDue({ invoiceDate: "2026-01-01", zohoDue: "2026-01-20", defaultCreditDays: 30 }))
      .toEqual({ due: "2026-01-20", source: "zoho" });
    expect(resolveEffectiveDue({ invoiceDate: "2026-01-01", zohoDue: "", clientCreditDays: 45, defaultCreditDays: 30 }))
      .toEqual({ due: "2026-02-15", source: "client" });
    expect(resolveEffectiveDue({ invoiceDate: "2026-01-01", zohoDue: "", defaultCreditDays: 30 }))
      .toEqual({ due: "2026-01-31", source: "default" });
    // A Zoho due date earlier than the invoice date counts as "not set" → falls through.
    expect(resolveEffectiveDue({ invoiceDate: "2026-01-10", zohoDue: "2026-01-01", defaultCreditDays: 30 }).source).toBe("default");
  });

  it("by-customer excludes dust, derives effective due date, and buckets by as-of", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email,credit_days,currency_code) VALUES ('T1C','T1 Client','t1@x.com',0,'INR')").run();
    const mk = (id: string, date: string, due: string, total: number, bal: number) =>
      db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(id, id, id, "T1C", date, due, total, bal, "INR", "open", "open").run();
    await mk("T1-I1", "2026-01-01", "2026-01-31", 100000, 100000); // Zoho due
    await mk("T1-I2", "2026-01-01", "2026-01-31", 42, 42);          // dust (≤ ₹1)
    await mk("T1-I3", "2026-01-01", "", 100000, 100000);            // no Zoho due → default 30 → 2026-01-31
    await recomputeArBalances(env);

    const li = await (await get("/api/finance/ar/invoices?client=T1C", adminToken)).json() as { invoices: Array<Record<string, unknown>> };
    const i3 = li.invoices.find(x => x.id === "T1-I3")!;
    expect(i3.effective_due_date).toBe("2026-01-31");
    expect(i3.due_source).toBe("default");
    expect(li.invoices.find(x => x.id === "T1-I2")).toBeFalsy(); // dust excluded from the default list

    const bc = await (await get("/api/finance/ar/by-customer?as_of=2026-01-31", adminToken)).json() as { customers: Array<Record<string, number>> };
    const row = bc.customers.find((c: Record<string, unknown>) => c.client_id === "T1C")!;
    expect(row.outstanding).toBe(200000);   // 2×₹1000; the ₹0.42 dust is excluded
    expect(row.due_today).toBe(200000);
    expect(row.overdue).toBe(0);
    expect(row.total_due_now).toBe(200000);

    const bc2 = await (await get("/api/finance/ar/by-customer?as_of=2026-03-01", adminToken)).json() as { customers: Array<Record<string, number>> };
    const row2 = bc2.customers.find((c: Record<string, unknown>) => c.client_id === "T1C")!;
    expect(row2.overdue).toBe(200000);
    expect(row2.due_today).toBe(0);
    expect(row2.oldest_dpd).toBeGreaterThan(0);
  });

  it("a stale snapshot blocks the live auto-send pass", async () => {
    await ensureArSchema(env);
    await setCfg("reminders_mode", "live");
    await setCfg("initial_backfill_complete", "1");
    await setCfg("fin_stale_days", "3");
    await setCfg("books_last_sync_at", new Date(Date.now() - 10 * 86400000).toISOString());
    const r = await runReminderPass(env, SEND_CRON);
    expect(r.status).toBe("stale");
  });
});

describe("Tier 2 KPI suite — DSO / CEI / Avg collection / Overdue%", () => {
  it("computeArKpis derives each KPI from reconstructed AR", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    // One ₹1000 invoice dated inside the 90-day period, unpaid and overdue at the as-of.
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('K1','K1','K1','KC','2026-02-01','2026-03-01',100000,100000,'INR','open','open')").run();
    const k = await computeArKpis(env, { asOf: "2026-04-01", periodDays: 90 }) as { by_currency: Array<Record<string, number>> };
    const row = k.by_currency.find(r => r.currency as unknown as string === "INR")!;
    expect(row.ar).toBe(100000);
    expect(row.credit_sales).toBe(100000);
    expect(row.dso).toBe(90);         // (AR ÷ sales) × 90 = 90
    expect(row.acp).toBe(45);         // avg AR (50000) ÷ sales × 90
    expect(row.cei).toBe(0);          // nothing collected in the period
    expect(row.overdue).toBe(100000);
    expect(row.overdue_count).toBe(1);
    expect(row.overdue_pct).toBe(100);
  });

  it("GET /finance/kpis returns targets + per-currency rows for finance roles", async () => {
    const r = await get("/api/finance/kpis?period=90", adminToken);
    expect(r.status).toBe(200);
    const body = await r.json() as { period_days: number; targets: Record<string, number>; by_currency: unknown[] };
    expect(body.period_days).toBe(90);
    expect(body.targets.dso).toBe(45);
    expect(Array.isArray(body.by_currency)).toBe(true);
    const forbidden = await get("/api/finance/kpis", clientToken);
    expect(forbidden.status).toBe(403);
  });
});

describe("Tier 2 full ledger statement", () => {
  it("indianFYRange wraps the April–March year", () => {
    expect(indianFYRange("2026-07-15")).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(indianFYRange("2026-02-15")).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });

  it("_arLedger carries opening balance and runs debits/credits to closing", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    const mkInv = (id: string, date: string, total: number) =>
      db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,currency_code,status,books_status) VALUES (?,?,?,?,?,?,?,?,?,?)")
        .bind(id, id, id, "LC", date, total, 0, "INR", "open", "open").run();
    await mkInv("OLD", "2026-01-01", 50000);   // before period
    await mkInv("IN", "2026-05-01", 100000);   // in period
    await db.prepare("INSERT OR REPLACE INTO fin_payments (id,direction,party_type,party_id,amount,date,ref) VALUES ('P0','in','client','LC',20000,'2026-02-01','adv')").run();
    await db.prepare("INSERT OR REPLACE INTO fin_payments (id,direction,party_type,party_id,amount,date,ref) VALUES ('P1','in','client','LC',40000,'2026-06-01','neft')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_credit_notes (id,zoho_creditnote_id,number,client_id,amount,date) VALUES ('CN1','CN1','CN1','LC',10000,'2026-07-01')").run();
    const led = await _arLedger(env, "LC", { from: "2026-04-01", to: "2027-03-31" }) as {
      opening: number; closing: number; total_debit: number; total_credit: number; lines: Array<{ balance: number }>;
    };
    expect(led.opening).toBe(30000);        // 50000 invoice − 20000 payment, both before the period
    expect(led.total_debit).toBe(100000);   // the in-period invoice
    expect(led.total_credit).toBe(50000);   // 40000 payment + 10000 credit note
    expect(led.closing).toBe(80000);
    expect(led.lines.length).toBe(3);
    expect(led.lines[led.lines.length - 1].balance).toBe(80000);
  });

  it("GET ledger enforces the client IDOR rule", async () => {
    const r = await get("/api/finance/ar/client/LC/ledger?period=fy", adminToken);
    expect(r.status).toBe(200);
    // a client token may only read its OWN ledger (seeded client is c1, not LC)
    const forbidden = await get("/api/finance/ar/client/LC/ledger", clientToken);
    expect(forbidden.status).toBe(403);
  });
});

describe("Tier 2 dunning hardening — weekly throttle + overdue auto-send opt-in", () => {
  it("suppresses a send that would exceed the weekly cap", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await setCfg("fin_max_reminders_per_week", "1");
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email,credit_days,currency_code) VALUES ('WC','WC Client','wc@x.com',0,'INR')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('WC-I','WC-I','WC-I','WC','2026-01-01','2026-01-10',100000,100000,'INR','open','open')").run();
    // A successful send 6 days ago: past the 5-day min-gap, but still inside the 7-day cap window.
    const sixAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    await db.prepare("INSERT INTO reminder_runs (id,client_id,tier,cycle_batch,status,run_at,recipient_email) VALUES (?,?,?,?,?,?,?)")
      .bind("wc-prev", "WC", "overdue-1", "b-prev", "sent", sixAgo + " 10:00:00", "wc@x.com").run();
    const out = await sendStatement(env, { client_id: "WC", name: "WC Client", email: "wc@x.com" }, { mode: "dry_run" });
    expect(out.status).toBe("suppressed");
    expect((out as { reason: string }).reason).toBe("weekly-cap");
  });

  it("auto-sends overdue tiers only when the opt-in is on", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await setCfg("reminders_mode", "dry_run");
    await setCfg("initial_backfill_complete", "1");
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,email,credit_days,currency_code) VALUES ('OA','OA Client','oa@x.com',0,'INR')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('OA-I','OA-I','OA-I','OA','2026-01-01','2026-01-10',100000,100000,'INR','open','open')").run();
    const dryCount = async () => ((await db.prepare("SELECT COUNT(*) AS n FROM reminder_runs WHERE client_id='OA' AND status='dry_run'").first()) as { n: number }).n;

    await setCfg("fin_overdue_autosend", "0");
    await runReminderPass(env, SEND_CRON);
    expect(await dryCount()).toBe(0);           // overdue tier is a manual worklist by default

    await setCfg("fin_overdue_autosend", "1");
    await runReminderPass(env, SEND_CRON);
    expect(await dryCount()).toBeGreaterThan(0); // opt-in extends auto-send to overdue tiers
  });
});

describe("Books sync stamps last-synced as data lands", () => {
  it("a backfill run to completion updates books_last_sync_at", async () => {
    await ensureArSchema(env);
    // Fresh backfill state + cleared timestamp.
    await setCfg("books_bf_stage", "0");
    await setCfg("books_last_sync_at", "");
    for (const e of ["contacts", "invoices", "creditnotes", "customerpayments", "bills", "vendorpayments"]) {
      await setCfg(`books_bf_page_${e}`, "1"); await setCfg(`books_cursor_${e}`, "0");
    }
    const be = booksEnv();
    const { impl } = mockBooks({ contacts: [{ contact_id: "c1", contact_name: "X" }], invoices: [{ invoice_id: "i1", total: 100, date: "2026-01-01" }] });
    let done = false;
    for (let i = 0; i < 20 && !done; i++) { const r = await runBooksBackfillStep(be, impl); done = r.backfill_complete; }
    expect(done).toBe(true);
    const stamp = await getCfg("books_last_sync_at");
    expect(stamp).toBeTruthy();
    expect(Date.parse(String(stamp))).toBeGreaterThan(Date.now() - 60000); // stamped ~now, not stale
  });
});

import { mapBooksVendorContact, isVendorContact } from "../src/index";

describe("AP vendor sync — vendor contacts mirror into ap_vendors", () => {
  it("isVendorContact + mapBooksVendorContact route by contact_type", () => {
    expect(isVendorContact({ contact_type: "vendor" })).toBe(true);
    expect(isVendorContact({ contact_type: "customer" })).toBe(false);
    const v = mapBooksVendorContact({ contact_id: "V9", contact_name: "CHHAVI MERCHANDISE", email: "c@x.com" });
    expect("vendor" in v && v.vendor.vendor_id).toBe("V9");
    expect("vendor" in v && v.vendor.name).toBe("CHHAVI MERCHANDISE");
  });

  it("a vendor contact lands in ap_vendors, a customer in ar_clients", async () => {
    const be = booksEnv();
    const { impl } = mockBooks({
      contacts: [
        { contact_id: "VEND1", contact_name: "CHHAVI MERCHANDISE", contact_type: "vendor", email: "c@x.com" },
        { contact_id: "CUST1", contact_name: "Acme Foods", contact_type: "customer" },
      ],
    });
    await runBooksSync(be, { full: true }, impl);
    const db = env.DB as D1Database;
    const vend = await db.prepare("SELECT name FROM ap_vendors WHERE vendor_id='VEND1'").first() as { name: string } | null;
    expect(vend?.name).toBe("CHHAVI MERCHANDISE");                       // vendor appears in Payables even with no bills
    const misfiled = await db.prepare("SELECT 1 FROM ar_clients WHERE client_id='VEND1'").first();
    expect(misfiled).toBeFalsy();                                        // and is NOT mis-filed as an AR customer
    const cust = await db.prepare("SELECT name FROM ar_clients WHERE client_id='CUST1'").first() as { name: string } | null;
    expect(cust?.name).toBe("Acme Foods");
  });
});

describe("AP vendor pull + sync cross-check", () => {
  it("booksFetch('vendors') calls /contacts?contact_type=vendor and reads the contacts key", async () => {
    const { impl, calls } = mockBooks({ contacts: [{ contact_id: "V1", contact_name: "Vend Co", contact_type: "vendor" }] });
    const res = await booksFetch(booksEnv(), "tok", "vendors", { page: 1 }, impl);
    expect(res.items.length).toBe(1);
    const url = calls.find(c => c.url.includes("/books/v3/contacts"))?.url || "";
    expect(url).toContain("contact_type=vendor"); // Zoho contact_type filter is the SINGULAR value
  });

  it("a backfill run mirrors a vendor contact into ap_vendors", async () => {
    await ensureArSchema(env);
    await setCfg("books_bf_stage", "0");
    for (const e of ["contacts", "vendors", "invoices", "creditnotes", "customerpayments", "bills", "vendorpayments"]) {
      await setCfg(`books_bf_page_${e}`, "1"); await setCfg(`books_cursor_${e}`, "0");
    }
    const { impl } = mockBooks({ contacts: [{ contact_id: "VX", contact_name: "CHHAVI TEST", contact_type: "vendor", email: "v@x.com" }] });
    let done = false;
    for (let i = 0; i < 20 && !done; i++) { const r = await runBooksBackfillStep(booksEnv(), impl); done = r.backfill_complete; }
    const v = await (env.DB as D1Database).prepare("SELECT name FROM ap_vendors WHERE vendor_id='VX'").first() as { name: string } | null;
    expect(v?.name).toBe("CHHAVI TEST");
  });

  it("GET /finance/books/counts gates roles (and needs Zoho configured)", async () => {
    const r = await get("/api/finance/books/counts", adminToken);
    expect([400, 502]).toContain(r.status);         // test env has no Zoho org id → "not connected"
    const forbidden = await get("/api/finance/books/counts", clientToken);
    expect(forbidden.status).toBe(403);
  });
});

describe("Books find diagnostic endpoint", () => {
  it("gates roles, requires a query, and needs Zoho configured", async () => {
    const forbidden = await get("/api/finance/books/find?q=x", clientToken);
    expect(forbidden.status).toBe(403);
    const r = await get("/api/finance/books/find?q=CHHAVI", adminToken);
    expect([400, 502]).toContain(r.status); // test env has no Zoho org id → "not connected"
  });
});

describe("AR per-customer reconcile with Zoho", () => {
  it("gates to finance roles and requires Zoho to be configured", async () => {
    const forbidden = await get("/api/finance/ar/client/C1/reconcile", clientToken);
    expect(forbidden.status).toBe(403);
    const r = await get("/api/finance/ar/client/C1/reconcile", adminToken);
    expect([400, 502]).toContain(r.status); // test env has no Zoho org id → "not connected"
  });
});

describe("Opening balance — optional inclusion in outstanding", () => {
  it("is excluded by default and folded into total_due_now/outstanding when enabled", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code,opening_balance) VALUES ('COB','Opening Co','INR',1810665)").run();
    // one open invoice so the client appears in the by-customer aggregation
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,effective_due_date,total,balance,currency_code,status,books_status) VALUES ('IOB','IOB','IOB','COB','2026-01-01','2099-12-31','2099-12-31',500000,500000,'INR','open','open')").run();

    await setCfg("fin_include_opening_balance", "0");
    const off = await (await get("/api/finance/ar/by-customer", adminToken)).json() as { include_opening_balance: boolean; customers: Array<Record<string, number>> };
    expect(off.include_opening_balance).toBe(false);
    const cOff = off.customers.find(c => (c.client_id as unknown as string) === "COB")!;
    expect(cOff.outstanding).toBe(500000);        // opening balance NOT included
    expect(cOff.opening_balance).toBe(0);

    await setCfg("fin_include_opening_balance", "1");
    const on = await (await get("/api/finance/ar/by-customer", adminToken)).json() as { include_opening_balance: boolean; customers: Array<Record<string, number>> };
    expect(on.include_opening_balance).toBe(true);
    const cOn = on.customers.find(c => (c.client_id as unknown as string) === "COB")!;
    expect(cOn.opening_balance).toBe(1810665);
    expect(cOn.outstanding).toBe(500000 + 1810665); // folded into outstanding
    expect(cOn.total_due_now).toBe(1810665);        // the invoice is not yet due → only opening balance is "due now"
    await setCfg("fin_include_opening_balance", "0");
  });
});

describe("Sales Analytics — super-admin only overview", () => {
  it("is forbidden to non-super-admins and returns KPIs + trend + client performance for super admin", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('SAC','Sales Client','INR')").run();
    // Comparison uses the two most recent COMPLETE months: recent = M-1, prior = M-2.
    const ymBack = (n: number) => { const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
    const prior = ymBack(2), recent = ymBack(1);
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('SI1','SI1','SI1','SAC',?,?,100000,0,'INR','paid','paid')").bind(prior + "-10", prior + "-25").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('SI2','SI2','SI2','SAC',?,?,150000,150000,'INR','open','open')").bind(recent + "-05", recent + "-20").run();

    // ops_manager (finance-capable) must NOT see sales data — super-admin only.
    const forbidden = await get("/api/analytics/sales/overview", opsToken);
    expect(forbidden.status).toBe(403);
    const clientForbidden = await get("/api/analytics/sales/overview", clientToken);
    expect(clientForbidden.status).toBe(403);

    const r = await get("/api/analytics/sales/overview?period=365", adminToken);
    expect(r.status).toBe(200);
    const body = await r.json() as { kpis: Record<string, number>; trend: Array<{ month: string; net_sales: number }>; client_performance: Array<Record<string, unknown>> };
    expect(body.kpis.net_sales).toBe(250000);        // both invoices billed in the last year
    expect(body.kpis.active_clients).toBe(1);
    expect(body.trend.length).toBe(12);               // always a full 12-month window
    const row = body.client_performance.find(c => (c.client_id as string) === "SAC")!;
    expect(row.prev).toBe(100000);
    expect(row.curr).toBe(150000);
    expect(row.status).toBe("up");
    expect(row.growth_pct).toBe(50);                  // (150k-100k)/100k
  });
});

describe("Books prune — reconcile deletions (orphans)", () => {
  it("removes mirror documents not re-seen by the last full rebuild, super-admin only", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await setCfg("initial_backfill_complete", "1");
    await setCfg("books_bf_started_at", "2026-06-01T00:00:00.000Z");
    // ORPH's stamp predates the rebuild start → deleted in Zoho. LIVE's is after → still exists.
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status,zoho_synced_at) VALUES ('ORPH','ORPH','ORPH','PX','2026-01-01',500000,0,'paid','paid','2026-05-01T00:00:00.000Z')").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status,zoho_synced_at) VALUES ('LIVE','LIVE','LIVE','PX','2026-01-01',500000,0,'paid','paid','2026-07-01T00:00:00.000Z')").run();

    expect((await post("/api/finance/books/prune", { dry_run: true }, opsToken)).status).toBe(403);

    const dry = await (await post("/api/finance/books/prune", { dry_run: true }, adminToken)).json() as { dry_run: boolean; counts: Record<string, number>; total: number };
    expect(dry.dry_run).toBe(true);
    expect(dry.counts.ar_invoices).toBeGreaterThanOrEqual(1);
    // dry-run must NOT delete
    expect(await db.prepare("SELECT id FROM ar_invoices WHERE id='ORPH'").first()).toBeTruthy();

    const done = await (await post("/api/finance/books/prune", { dry_run: false }, adminToken)).json() as { dry_run: boolean; total: number };
    expect(done.dry_run).toBe(false);
    expect(await db.prepare("SELECT id FROM ar_invoices WHERE id='ORPH'").first()).toBeFalsy(); // orphan removed
    expect(await db.prepare("SELECT id FROM ar_invoices WHERE id='LIVE'").first()).toBeTruthy(); // live kept
  });
});

describe("Books rebuild — access-token cache cleared once, not per step", () => {
  it("clears the cache on rebuild start but leaves it intact on continuation steps", async () => {
    await ensureArSchema(env);
    await setCfg("books_sync_enabled", "1");
    // Prime a valid, unexpired cached access token.
    await setCfg("zoho_token", "CACHED");
    await setCfg("zoho_token_exp", String(Math.floor(Date.now() / 1000) + 3600));

    // Continuation step (backfill already in progress, complete=0): the SPA re-sends
    // full:true, but it must NOT clear the cache — re-minting every chunk is what tripped
    // Zoho's token-generation limit ("Access Denied"). (Books org is unset in the test
    // env, so the stepper returns not_configured without any network call.)
    await setCfg("initial_backfill_complete", "0");
    await post("/api/integrations/zoho-books/sync", { full: true }, adminToken);
    expect(await getCfg("zoho_token")).toBe("CACHED");

    // Rebuild start (a prior backfill was complete=1): full:true clears the cache ONCE
    // and resets the backfill (flipping complete back to 0).
    await setCfg("initial_backfill_complete", "1");
    await post("/api/integrations/zoho-books/sync", { full: true }, adminToken);
    expect(await getCfg("zoho_token")).toBe("");
    expect(await getCfg("initial_backfill_complete")).toBe("0");
  });
});

describe("Sales Analytics — matrix + waterfall", () => {
  it("matrix returns a month grid and a client row; super-admin only", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('MX','Matrix Co','INR')").run();
    const ym = (n: number) => { const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('MX1','MX1','MX1','MX',?,400000,0,'paid','paid')").bind(ym(1) + "-10").run();
    expect((await get("/api/analytics/sales/matrix", opsToken)).status).toBe(403);
    const r = await (await get("/api/analytics/sales/matrix?months=12", adminToken)).json() as { months: string[]; clients: Array<Record<string, unknown>> };
    expect(r.months.length).toBe(12);
    const row = r.clients.find(c => (c.client_id as string) === "MX")!;
    expect(row).toBeTruthy();
    expect((row.values as number[]).length).toBe(12);
    expect((row.values as number[]).reduce((s, v) => s + v, 0)).toBe(400000);
  });

  it("waterfall decomposition sums to the net change", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    const target = "2025-11", prev = "2025-10";
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('WG','Grower','INR'),('WN','Newbie','INR'),('WL','Lostone','INR')").run();
    // grower: 100k → 150k; new: 0 → 80k; lost: 60k → 0
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('WG0','WG0','WG0','WG',?,100000,0,'paid','paid')").bind(prev + "-10").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('WG1','WG1','WG1','WG',?,150000,0,'paid','paid')").bind(target + "-10").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('WN1','WN1','WN1','WN',?,80000,0,'paid','paid')").bind(target + "-10").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('WL0','WL0','WL0','WL',?,60000,0,'paid','paid')").bind(prev + "-10").run();
    const r = await (await get("/api/analytics/sales/waterfall?month=" + target, adminToken)).json() as { prev_total: number; curr_total: number; net: number; buckets: Record<string, number> };
    const b = r.buckets;
    expect(b.new + b.growth + b.decline + b.lost).toBe(r.net);     // decomposition is exact
    expect(r.curr_total - r.prev_total).toBe(r.net);
    expect(b.growth).toBeGreaterThanOrEqual(50000);                 // grower contributed +50k
    expect(b.new).toBeGreaterThanOrEqual(80000);                    // newbie contributed +80k
  });
});

describe("Sales Analytics — churn radar + retention", () => {
  it("health flags a client quiet for >60 days as at_risk; super-admin only", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('HR','Risky Co','INR')").run();
    const d = new Date(); d.setUTCDate(d.getUTCDate() - 95);
    const old = d.toISOString().slice(0, 10);
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('HR1','HR1','HR1','HR',?,300000,0,'paid','paid')").bind(old).run();
    expect((await get("/api/analytics/sales/health", opsToken)).status).toBe(403);
    const r = await (await get("/api/analytics/sales/health", adminToken)).json() as { counts: Record<string, number>; clients: Array<Record<string, unknown>> };
    const row = r.clients.find(x => (x.client_id as string) === "HR")!;
    expect(row).toBeTruthy();
    expect(row.status).toBe("at_risk");
    expect((row.days_since_last as number)).toBeGreaterThan(60);
  });

  it("retention groups clients by first-billed month with offset-0 at 100%", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('RET','Cohort Co','INR')").run();
    const ym = (n: number) => { const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
    const firstM = ym(4);
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('RET1','RET1','RET1','RET',?,100000,0,'paid','paid')").bind(firstM + "-10").run();
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('RET2','RET2','RET2','RET',?,100000,0,'paid','paid')").bind(ym(3) + "-10").run();
    const r = await (await get("/api/analytics/sales/retention", adminToken)).json() as { cohorts: Array<{ month: string; size: number; retention: Array<{ offset: number; pct: number }> }> };
    const coh = r.cohorts.find(c => c.month === firstM)!;
    expect(coh).toBeTruthy();
    expect(coh.size).toBeGreaterThanOrEqual(1);
    expect(coh.retention[0].pct).toBe(100);        // everyone active in their first month
    expect(coh.retention[1].pct).toBe(100);        // and the next month too (RET billed again)
  });
});

describe("Billing Exceptions — period grains (quarter / YoY / custom)", () => {
  it("grain=quarter&yoy flags a client that billed the same quarter last year but not this quarter", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('QY','Quarter YoY Co','INR')").run();
    const d = new Date();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dateLastYear = `${d.getUTCFullYear() - 1}-${mm}-15`; // same month/quarter, one year ago
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,total,balance,status,books_status) VALUES ('QY1','QY1','QY1','QY',?,900000,0,'paid','paid')").bind(dateLastYear).run();
    const r = await (await get("/api/analytics/billing-exceptions?grain=quarter&yoy=1", adminToken)).json() as { grain: string; yoy: boolean; exceptions: Array<Record<string, unknown>> };
    expect(r.grain).toBe("quarter");
    expect(r.yoy).toBe(true);
    const row = r.exceptions.find(e => (e.client_id as string) === "QY")!;
    expect(row).toBeTruthy();
    expect(row.reason).toBe("not_billed"); // billed that quarter last year, nothing this quarter
  });

  it("grain=custom validates the date range", async () => {
    const bad = await get("/api/analytics/billing-exceptions?grain=custom&from=2026-05-01&to=2026-01-01", adminToken);
    expect(bad.status).toBe(400); // from must be <= to
  });
});

describe("Sales Analytics — draft invoices are excluded", () => {
  it("does not count Zoho drafts in sales KPIs or client performance", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('DRC','Draft Co','INR')").run();
    // Put them in the most recent COMPLETE month (M-1), which the comparison labels "curr".
    const recent = (() => { const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - 1, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; })();
    // One REAL (overdue→open) invoice and three DRAFT versions of the same supply.
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('DR_REAL','DR_REAL','426-00644','DRC',?,?,15438362,15438362,'INR','open','overdue')").bind(recent + "-15", recent + "-30").run();
    for (let i = 0; i < 3; i++) {
      await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES (?,?,?,'DRC',?,?,18636233,18636233,'INR','open','draft')")
        .bind("DR_D" + i, "DR_D" + i, "425-" + i, recent + "-26", recent + "-30").run();
    }
    const r = await (await get("/api/analytics/sales/overview?period=365", adminToken)).json() as { client_performance: Array<Record<string, number>> };
    const row = r.client_performance.find(c => (c.client_id as unknown as string) === "DRC")!;
    // Only the single real invoice counts — the three drafts (₹1.86L each) are excluded.
    expect(row.curr).toBe(15438362);
  });
});

describe("Billing Exceptions — regular buyer went quiet", () => {
  it("is super-admin only and flags a monthly buyer with no billing this month", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('BEX','Regular Buyer','INR')").run();
    const today = new Date().toISOString().slice(0, 10);
    const ym = (back: number) => { const [y, m] = today.slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - back, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
    // Billed each of the prior 4 months, then nothing in the current month.
    for (let i = 1; i <= 4; i++) {
      await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES (?,?,?,'BEX',?,?,8000000,0,'INR','paid','paid')")
        .bind("BX" + i, "BX" + i, "BX" + i, ym(i) + "-10", ym(i) + "-25").run();
    }
    const forbidden = await get("/api/analytics/billing-exceptions", opsToken);
    expect(forbidden.status).toBe(403);
    const r = await get("/api/analytics/billing-exceptions?lookback=6", adminToken);
    expect(r.status).toBe(200);
    const body = await r.json() as { counts: Record<string, number>; exceptions: Array<Record<string, unknown>> };
    const row = body.exceptions.find(e => (e.client_id as string) === "BEX")!;
    expect(row).toBeTruthy();
    expect(row.reason).toBe("not_billed");
    expect(row.severity).toBe("critical");       // avg ₹80k ≥ ₹50k critical threshold
    expect(row.actual).toBe(0);
    expect(row.expected).toBe(8000000);          // average of the active months
    // drill-down resolves and carries the 12-month history
    const d = await (await get("/api/analytics/billing-exceptions/BEX", adminToken)).json() as { history: unknown[]; exception: Record<string, unknown> | null };
    expect(d.history.length).toBe(12);
    expect(d.exception && d.exception.reason).toBe("not_billed");
  });
});

describe("Client 360 analytics", () => {
  it("is super-admin only and returns metrics, health, trend and recent invoices", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('C360','Profile Co','INR')").run();
    const ym = (back: number) => { const [y, m] = new Date().toISOString().slice(0, 7).split("-").map(Number); const d = new Date(Date.UTC(y, (m - 1) - back, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
    for (let i = 0; i < 3; i++) {
      await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES (?,?,?,'C360',?,?,100000,?,'INR',?,?)")
        .bind("P" + i, "P" + i, "P" + i, ym(i) + "-12", ym(i) + "-27", i === 0 ? 100000 : 0, i === 0 ? "open" : "paid", i === 0 ? "open" : "paid").run();
    }
    const forbidden = await get("/api/analytics/client/C360", opsToken);
    expect(forbidden.status).toBe(403);
    const r = await get("/api/analytics/client/C360", adminToken);
    expect(r.status).toBe(200);
    const b = await r.json() as { metrics: Record<string, number>; health: { status: string; reasons: string[] }; trend: unknown[]; recent_invoices: unknown[] };
    expect(b.metrics.invoices).toBe(3);
    expect(b.metrics.total_lifetime).toBe(300000);
    expect(b.metrics.outstanding).toBe(100000);        // only the current-month invoice is open
    expect(b.trend.length).toBe(12);
    expect(b.recent_invoices.length).toBe(3);
    expect(["stable", "attention", "at_risk"]).toContain(b.health.status);
    expect(b.health.reasons.length).toBeGreaterThan(0);
  });
});

describe("Sales Analytics — salespeople + regions (super-admin only)", () => {
  it("creates a rep, assigns a client, and attributes revenue by owner and region", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ar_clients (client_id,name,currency_code) VALUES ('RC1','Rep Client','INR')").run();
    const today = new Date().toISOString().slice(0, 10);
    await db.prepare("INSERT OR REPLACE INTO ar_invoices (id,zoho_invoice_id,number,client_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('RI1','RI1','RI1','RC1',?,?,120000,0,'INR','paid','paid')").bind(today, today).run();

    // gating
    expect((await get("/api/analytics/sales/by-rep", opsToken)).status).toBe(403);
    expect((await post("/api/analytics/reps", { name: "Raj" }, opsToken)).status).toBe(403);

    // create rep (super-admin)
    const created = await (await post("/api/analytics/reps", { name: "Raj", email: "raj@x.com" }, adminToken)).json() as { ok: boolean; id: string };
    expect(created.ok).toBe(true);
    const repId = created.id;

    // before assignment: revenue sits under "Unassigned"
    let byRep = await (await get("/api/analytics/sales/by-rep?period=365", adminToken)).json() as { reps: Array<Record<string, unknown>> };
    const unassigned = byRep.reps.find(r => r.rep_id === null)!;
    expect(unassigned.net_sales).toBeGreaterThanOrEqual(120000);

    // assign owner + region
    const asg = await post("/api/analytics/client-assignment", { client_id: "RC1", salesperson_id: repId, region: "Bangalore" }, adminToken);
    expect(asg.status).toBe(200);

    byRep = await (await get("/api/analytics/sales/by-rep?period=365", adminToken)).json() as { reps: Array<Record<string, unknown>> };
    const raj = byRep.reps.find(r => r.rep_id === repId)!;
    expect(raj.name).toBe("Raj");
    expect(raj.net_sales).toBe(120000);
    expect(raj.clients).toBe(1);

    const byRegion = await (await get("/api/analytics/sales/by-region?period=365", adminToken)).json() as { regions: Array<Record<string, unknown>> };
    const blr = byRegion.regions.find(r => r.region === "Bangalore")!;
    expect(blr).toBeTruthy();
    expect(blr.net).toBe(120000);
  });
});

describe("Books sync resilience — vendor pull failure is non-fatal", () => {
  it("a 400 on the vendors stage is skipped and the backfill still completes", async () => {
    await ensureArSchema(env);
    await setCfg("books_bf_stage", "0");
    for (const e of ["contacts", "vendors", "invoices", "creditnotes", "customerpayments", "bills", "vendorpayments"]) {
      await setCfg(`books_bf_page_${e}`, "1"); await setCfg(`books_cursor_${e}`, "0");
    }
    // Zoho stand-in: the vendors stage (/contacts?contact_type=vendor) returns HTTP 400;
    // every other entity returns an empty page (200).
    const impl = (async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : (url as URL).toString();
      if (u.includes("/oauth/v2/token")) return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
      if (u.includes("contact_type=vendor")) return new Response("bad request", { status: 400 });
      const m = u.match(/\/books\/v3\/([a-z]+)\b/);
      if (m) return new Response(JSON.stringify({ [m[1]]: [], page_context: { has_more_page: false, total: 0 } }), { status: 200 });
      return new Response("{}", { status: 404 });
    }) as unknown as typeof fetch;
    let done = false;
    for (let i = 0; i < 20 && !done; i++) { const r = await runBooksBackfillStep(booksEnv(), impl); done = r.backfill_complete; }
    expect(done).toBe(true); // backfill finalized despite the vendor-stage 400
  });
});

describe("AP by-vendor — vendors with no bills still appear", () => {
  it("lists a zero-bill vendor and aggregates a billed vendor", async () => {
    const db = env.DB as D1Database;
    await ensureArSchema(env);
    await db.prepare("INSERT OR REPLACE INTO ap_vendors (vendor_id,name,email,currency_code) VALUES ('VNB','No Bills Vendor','nb@x.com','INR')").run();
    await db.prepare("INSERT OR REPLACE INTO ap_vendors (vendor_id,name,currency_code) VALUES ('VWB','Has Bills','INR')").run();
    await db.prepare("INSERT OR REPLACE INTO ap_bills (id,zoho_bill_id,number,vendor_id,date,due_date,total,balance,currency_code,status,books_status) VALUES ('BWB','BWB','BWB','VWB','2026-01-01','2026-01-31',50000,50000,'INR','open','open')").run();
    const r = await get("/api/finance/ap/by-vendor", adminToken);
    expect(r.status).toBe(200);
    const body = await r.json() as { vendors: Array<Record<string, number>> };
    const nb = body.vendors.find(v => v.vendor_id as unknown as string === "VNB")!;
    expect(nb).toBeTruthy();                 // a vendor with NO bills is still listed
    expect(nb.billed).toBe(0); expect(nb.outstanding).toBe(0); expect(nb.bills).toBe(0);
    const wb = body.vendors.find(v => v.vendor_id as unknown as string === "VWB")!;
    expect(wb.billed).toBe(50000); expect(wb.outstanding).toBe(50000); expect(wb.bills).toBe(1);
    const forbidden = await get("/api/finance/ap/by-vendor", clientToken);
    expect(forbidden.status).toBe(403);
  });
});
