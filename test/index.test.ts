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
let vendorToken: string;

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
  await db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,?)")
    .bind("tst-vendor","vendor@sp.test","SEED:vendor123","vendor_admin","Vendor Admin","Fresh Farms","VA",1).run();
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
  for (const s of ["SKU003","SKU004"]) await db.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)").bind("c1",s,"tst-admin").run();

  adminToken = await login("admin@sp.test", "admin123");
  clientToken = await login("client@sp.test", "client123");
  opsToken    = await login("ops@sp.test",    "ops123");
  vendorToken = await login("vendor@sp.test", "vendor123");
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
describe("Smart Catalogue / Product Intelligence", () => {
  it("catalogue loads with >100 products (no D1 bound-parameter overflow)", async () => {
    const db = env.DB as D1Database;
    for (let i = 0; i < 130; i++) {
      const sku = `BULK-${String(i).padStart(3, "0")}`;
      await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active) VALUES (?,?,?,?,?,1)")
        .bind(sku, `Bulk ${i}`, "Beverages", 10, 5).run();
    }
    const res = await get("/api/catalogue", adminToken);
    expect(res.status).toBe(200); // must not 500 on the IN(...) bind limit
    const cat = await res.json() as { items: unknown[] };
    expect(cat.items.length).toBeGreaterThan(100);
  });

  it("CSV inventory import handles >100 rows (chunked existence lookup)", async () => {
    const rows = Array.from({ length: 130 }, (_, i) => ({
      sku: `IMP-${String(i).padStart(3, "0")}`, name: `Import ${i}`, category: "Beverages", unit_price: 10, stock: 3,
    }));
    const res = await post("/api/import/inventory", rows, adminToken);
    expect(res.status).toBe(200); // must not 500 on the IN(...) existence lookup
    const body = await res.json() as { success: number };
    expect(body.success).toBe(130);
  });

  it("PATCH fitment (Super Admin) publishes a product; catalogue lists it verified", async () => {
    const res = await patch("/api/catalogue/SKU001/fitment", { verification: "verified", fitment_state: "APPROVED", clean_label: "eligible" }, adminToken);
    expect(res.status).toBe(200);
    const cat = await (await get("/api/catalogue", adminToken)).json() as { items: Array<Record<string, string>> };
    const item = cat.items.find(i => i.sku === "SKU001");
    expect(item?.verification).toBe("verified");
    expect(item?.fitment_state).toBe("APPROVED");
  });

  it("clients see only published products", async () => {
    await patch("/api/catalogue/SKU002/fitment", { verification: "needs_review", fitment_state: "PENDING" }, adminToken);
    const cat = await (await get("/api/catalogue", clientToken)).json() as { items: Array<Record<string, string>> };
    expect(cat.items.some(i => i.sku === "SKU001")).toBe(true);   // approved → visible
    expect(cat.items.some(i => i.sku === "SKU002")).toBe(false);  // pending → hidden
  });

  it("GET /api/catalogue/:sku returns full intelligence arrays", async () => {
    const d = await (await get("/api/catalogue/SKU001", adminToken)).json() as { product: Record<string, unknown>; attributes: unknown[]; certifications: unknown[] };
    expect(d.product.sku).toBe("SKU001");
    expect(Array.isArray(d.attributes)).toBe(true);
    expect(Array.isArray(d.certifications)).toBe(true);
  });

  it("clients cannot open an unpublished product", async () => {
    await patch("/api/catalogue/SKU002/fitment", { verification: "needs_review", fitment_state: "BLOCKED" }, adminToken);
    expect((await get("/api/catalogue/SKU002", clientToken)).status).toBe(404);
  });

  it("fitment + intel are forbidden for clients", async () => {
    expect((await patch("/api/catalogue/SKU001/fitment", { fitment_state: "BLOCKED" }, clientToken)).status).toBe(403);
    expect((await put("/api/catalogue/SKU001/intel", { attributes: [] }, clientToken)).status).toBe(403);
  });

  it("PUT intel replaces attributes with their source", async () => {
    await put("/api/catalogue/SKU001/intel", { attributes: [{ grp: "dietary", name: "Vegan", source: "4syz" }, { grp: "formulation", name: "No Added Sugar", source: "brand" }] }, adminToken);
    const d = await (await get("/api/catalogue/SKU001", adminToken)).json() as { attributes: Array<{ name: string; source: string }> };
    expect(d.attributes.length).toBe(2);
    expect(d.attributes.find(a => a.name === "Vegan")?.source).toBe("4syz");
  });

  const ACCEPTANCE_LABEL = "Made with Water, Sugar, Black Salt, Sea Salt, Cumin Powder, Spices & Condiments. It contains Added Colour (E150C), Acidity Regulator (E330), Permitted Class II Preservative (E211). No Added Sugar. No Preservatives.";

  it("AI extraction screens additives, sugar and compound ingredients (mandatory acceptance test)", async () => {
    const res = await post("/api/catalogue/SKU001/extract", { ingredient_text: ACCEPTANCE_LABEL, use_ai: false }, adminToken);
    expect(res.status).toBe(200);
    const out = await res.json() as {
      ingredients: Array<{ ins_code: string; functional_class: string; flags: string }>;
      claims: Array<{ name: string; outcome: string }>;
    };
    const flags = out.ingredients.flatMap(i => String(i.flags || "").split(",").filter(Boolean));
    // E211 preservative + E150C synthetic colour recognised from their INS codes.
    expect(out.ingredients.some(i => i.ins_code === "211")).toBe(true);
    expect(out.ingredients.some(i => i.ins_code === "150c")).toBe(true);
    expect(flags).toContain("preservative");
    expect(flags).toContain("synthetic-colour");
    // Compound "Spices & Condiments" flagged for qualified review.
    expect(flags).toContain("compound");
    // "No Added Sugar" is contradicted because sugar is present.
    expect(out.claims.find(c => c.name === "No Added Sugar")?.outcome).toBe("CONTRADICTED");
    expect(out.claims.find(c => c.name === "No Preservatives")?.outcome).toBe("CONTRADICTED");
  });

  const RICH_LABEL = "INGREDIENTS: Wheat Flour, Milk Solids, Soy Lecithin, Sugar, Cashew. Contains E211, E150C. May contain traces of Peanut. Nutrition per 100g: Energy 480 kcal, Protein 8g, Total Fat 22g, Total Sugars 30g, Sodium 350mg. No Added Sugar.";

  it("AI extraction detects allergens, parses nutrition and derives attributes", async () => {
    const res = await post("/api/catalogue/SKU008/extract", { ingredient_text: RICH_LABEL, use_ai: false }, adminToken);
    expect(res.status).toBe(200);
    const out = await res.json() as {
      allergens: Array<{ allergen: string; contains_state: string; cross_contact_state: string; source: string }>;
      nutrition: Array<{ nutrient: string; value: string; unit: string; source: string }>;
      attributes: Array<{ name: string; source: string }>;
    };
    const alg = out.allergens.map(a => a.allergen);
    expect(alg).toEqual(expect.arrayContaining(["Milk", "Soy", "Wheat / Gluten", "Tree nuts", "Peanut"]));
    // Per-clause classification: declared ingredients are "contains"; only the
    // "may contain traces of Peanut" clause is cross-contact.
    const milk = out.allergens.find(a => a.allergen === "Milk")!;
    expect(milk.contains_state).toBe("contains");
    expect(milk.cross_contact_state).toBe("unknown");
    const peanut = out.allergens.find(a => a.allergen === "Peanut")!;
    expect(peanut.contains_state).toBe("not_declared");
    expect(peanut.cross_contact_state).toBe("possible");
    // Nutrition figures are pulled with units.
    expect(out.nutrition.find(n => n.nutrient === "Energy")?.value).toBe("480");
    expect(out.nutrition.find(n => n.nutrient === "Protein")?.unit).toBe("g");
    // Derived attributes reflect the additive flags, all source 'ai'.
    expect(out.attributes.some(a => a.name === "Contains synthetic colour")).toBe(true);
    expect(out.attributes.every(a => a.source === "ai")).toBe(true);
  });

  it("extraction persists allergen and nutrition drafts as source='ai'", async () => {
    await post("/api/catalogue/SKU009/extract", { ingredient_text: RICH_LABEL, use_ai: false }, adminToken);
    const d = await (await get("/api/catalogue/SKU009", adminToken)).json() as {
      allergens: Array<{ allergen: string; source: string }>; nutrition: Array<{ nutrient: string; source: string }>;
    };
    expect(d.allergens.length).toBeGreaterThan(0);
    expect(d.allergens.every(a => a.source === "ai")).toBe(true);
    expect(d.nutrition.some(n => n.nutrient === "Total Sugars" && n.source === "ai")).toBe(true);
  });

  it("AI extraction writes AI-sourced drafts and marks the product ai_screened (never verified)", async () => {
    await post("/api/catalogue/SKU007/extract", { ingredient_text: ACCEPTANCE_LABEL, use_ai: false }, adminToken);
    const d = await (await get("/api/catalogue/SKU007", adminToken)).json() as {
      product: { verification: string }; ingredients: Array<{ source: string }>;
    };
    expect(d.product.verification).toBe("ai_screened");
    expect(d.ingredients.length).toBeGreaterThan(0);
    expect(d.ingredients.every(i => i.source === "ai")).toBe(true);
  });

  it("extraction requires label text and is forbidden for clients", async () => {
    expect((await post("/api/catalogue/SKU001/extract", { ingredient_text: "" }, adminToken)).status).toBe(400);
    expect((await post("/api/catalogue/SKU001/extract", { ingredient_text: ACCEPTANCE_LABEL }, clientToken)).status).toBe(403);
  });

  it("AI health check is Ops-only and reports a definitive status", async () => {
    expect((await get("/api/ai/health", clientToken)).status).toBe(403);
    const r = await get("/api/ai/health", adminToken);
    expect(r.status).toBe(200);
    const h = await r.json() as { status: string; bound: boolean };
    // enabled (real inference ran), disabled (no binding), or error (bound but
    // the call failed) — never ambiguous.
    expect(["enabled", "disabled", "error"]).toContain(h.status);
  });

  it("vendors (external) see only published products and no internal review fields", async () => {
    // Publish SKU001, block SKU002.
    await patch("/api/catalogue/SKU001/fitment", { verification: "verified", fitment_state: "APPROVED", clean_label: "eligible", notes: "internal: licence checked" }, adminToken);
    await patch("/api/catalogue/SKU002/fitment", { verification: "needs_review", fitment_state: "BLOCKED" }, adminToken);
    // List: only APPROVED/CONDITIONAL products, none carrying reviewer/notes.
    const list = await (await get("/api/catalogue", vendorToken)).json() as { items: Array<Record<string, unknown>> };
    expect(list.items.every(i => ["APPROVED", "CONDITIONAL"].includes(String(i.fitment_state)))).toBe(true);
    expect(list.items.every(i => !("reviewer" in i) && !("notes" in i))).toBe(true);
    // Blocked product is a 404 for the vendor, same as a client.
    expect((await get("/api/catalogue/SKU002", vendorToken)).status).toBe(404);
    // Published detail: internal reviewer/notes are redacted, review date kept.
    const d = await (await get("/api/catalogue/SKU001", vendorToken)).json() as { product: Record<string, unknown> };
    expect(d.product.reviewer).toBeUndefined();
    expect(d.product.notes).toBeUndefined();
  });

  it("fitment gate fails CLOSED on invalid/missing verification & state (never auto-publishes)", async () => {
    // Junk values must not resolve to verified/APPROVED.
    const res = await patch("/api/catalogue/SKU004/fitment", { verification: "totally-bogus", fitment_state: "REJECT", clean_label: "eligible" }, adminToken);
    const out = await res.json() as { verification: string; fitment_state: string };
    expect(out.verification).toBe("needs_review");
    expect(out.fitment_state).toBe("PENDING");
  });

  it("report endpoint is Ops-only and joins allergens / nutrition / additives", async () => {
    expect((await get("/api/catalogue/report", clientToken)).status).toBe(403);
    // Seed rich data on one SKU, then confirm the report carries it.
    await post("/api/catalogue/SKU010/extract", { ingredient_text: RICH_LABEL, use_ai: false }, adminToken);
    const r = await get("/api/catalogue/report", adminToken);
    expect(r.status).toBe(200);
    const out = await r.json() as {
      generated_by: string;
      items: Array<{ sku: string; allergens: unknown[]; nutrition: unknown[]; additives: unknown[]; ingredient_flags: string[]; provenance: Record<string, number> }>;
    };
    expect(out.generated_by).toBeTruthy();
    const row = out.items.find(i => i.sku === "SKU010")!;
    expect(row.allergens.length).toBeGreaterThan(0);
    expect(row.nutrition.length).toBeGreaterThan(0);
    expect(row.additives.length).toBeGreaterThan(0);
    expect(row.ingredient_flags).toContain("synthetic-colour");
  });

  it("AI endpoints are rate-limited per user (OCR: 10/min → 429)", async () => {
    // Ten calls are allowed (each rejected for a bad image, but still counted);
    // the eleventh trips the per-user OCR budget.
    let last = 200;
    for (let i = 0; i < 11; i++) {
      last = (await post("/api/catalogue/SKU001/ocr", { image_base64: "" }, adminToken)).status;
    }
    expect(last).toBe(429);
    // A different user has an independent budget.
    expect((await post("/api/catalogue/SKU001/ocr", { image_base64: "" }, opsToken)).status).not.toBe(429);
  });

  it("OCR is Ops-only and guards SKU / image / Workers-AI availability", async () => {
    // Clients can never run OCR.
    expect((await post("/api/catalogue/SKU001/ocr", { image_base64: "x" }, clientToken)).status).toBe(403);
    // Unknown SKU is rejected before any model call.
    expect((await post("/api/catalogue/NOPE/ocr", { image_base64: "x" }, adminToken)).status).toBe(404);
    // With a valid SKU: either Workers AI is unavailable in the test env (503),
    // or it is bound and the empty/invalid image is rejected (400). Both are
    // correct guardrails — OCR never silently succeeds without a real image.
    const r = await post("/api/catalogue/SKU001/ocr", { image_base64: "" }, adminToken);
    expect([400, 503]).toContain(r.status);
  });
});

describe("Client price revisions", () => {
  const today = new Date().toISOString().slice(0, 10);

  it("only 4SYZ commercial roles can propose; clients cannot", async () => {
    expect((await post("/api/price-revisions", { client_id: "c1", sku: "SKU001", new_price: 500 }, clientToken)).status).toBe(403);
    const res = await post("/api/price-revisions", { client_id: "c1", sku: "SKU001", new_price: 999, new_mrp: 1200, reason: "Vendor cost increase", effective_date: today }, adminToken);
    expect(res.status).toBe(201);
    const rev = await res.json() as { status: string; direction: string; old_price: number };
    expect(rev.status).toBe("awaiting_client"); // increase needs client approval
    expect(rev.direction).toBe("up");
  });

  it("a no-op revision (unchanged price & MRP) is rejected", async () => {
    const inv = await (await get("/api/inventory", adminToken)).json() as Array<{ sku: string; unit_price: number; mrp: number }>;
    const item = inv.find(i => i.sku === "SKU005")!;
    const res = await post("/api/price-revisions", { client_id: "c1", sku: "SKU005", new_price: item.unit_price, new_mrp: item.mrp, effective_date: today }, adminToken);
    expect(res.status).toBe(400);
  });

  it("an effective date in the past is rejected", async () => {
    const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const res = await post("/api/price-revisions", { client_id: "c1", sku: "SKU006", new_price: 9999, effective_date: past }, adminToken);
    expect(res.status).toBe(400);
  });

  it("proposing a second revision supersedes the pending one (reported back)", async () => {
    await post("/api/price-revisions", { client_id: "c1", sku: "SKU010", new_price: 500, new_mrp: 600, reason: "v1", effective_date: today }, adminToken);
    const second = await (await post("/api/price-revisions", { client_id: "c1", sku: "SKU010", new_price: 520, new_mrp: 600, reason: "v2", effective_date: today }, adminToken)).json() as { superseded: number };
    expect(second.superseded).toBe(1);
    const list = await (await get("/api/price-revisions?client_id=c1", adminToken)).json() as { items: Array<{ sku: string; state: string; new_price: number }> };
    const s10 = list.items.filter(i => i.sku === "SKU010");
    expect(s10.filter(i => i.state === "awaiting_client").length).toBe(1); // only the newest is open
    expect(s10.some(i => i.state === "superseded")).toBe(true);
  });

  it("a price decrease auto-accepts (no client approval needed)", async () => {
    const res = await post("/api/price-revisions", { client_id: "c1", sku: "SKU002", new_price: 1, reason: "Vendor rate drop", effective_date: today }, adminToken);
    const rev = await res.json() as { status: string; direction: string };
    expect(rev.status).toBe("auto_accepted");
    expect(rev.direction).toBe("down");
  });

  it("client accepts an increase; cross-tenant decision is forbidden; catalogue then shows the new price", async () => {
    const created = await (await post("/api/price-revisions", { client_id: "c1", sku: "SKU003", new_price: 777, new_mrp: 900, reason: "Contract revision", effective_date: today }, adminToken)).json() as { id: string };
    // Appears in the client's pending inbox.
    const pend = await (await get("/api/price-revisions/pending", clientToken)).json() as { items: Array<{ id: string; status: string }> };
    expect(pend.items.some(i => i.id === created.id && i.status === "awaiting_client")).toBe(true);
    // A different tenant / a plain vendor cannot decide it.
    expect((await post(`/api/price-revisions/${created.id}/decision`, { decision: "accept" }, vendorToken)).status).toBe(403);
    // The client approver accepts.
    const dec = await post(`/api/price-revisions/${created.id}/decision`, { decision: "accept" }, clientToken);
    expect(dec.status).toBe(200);
    // Effective today → the client catalogue now reflects the new price & MRP.
    const cat = await (await get("/api/clients/c1/catalog", clientToken)).json() as Array<{ sku: string; client_price: number; mrp: number }>;
    const row = cat.find(r => r.sku === "SKU003")!;
    expect(row.client_price).toBe(777);
    expect(row.mrp).toBe(900);
  });

  it("report is period-scoped and carries old/new for both MRP and price", async () => {
    await post("/api/price-revisions", { client_id: "c1", sku: "SKU004", new_price: 610, new_mrp: 800, reason: "FX", effective_date: today }, adminToken);
    const rep = await (await get(`/api/price-revisions/report?client_id=c1&from=${today}&to=${today}`, adminToken)).json() as {
      summary: { total: number; increases: number; decreases: number };
      items: Array<{ sku: string; old_mrp: number; new_mrp: number; old_price: number; new_price: number; direction: string }>;
    };
    expect(rep.summary.total).toBeGreaterThan(0);
    const r = rep.items.find(i => i.sku === "SKU004")!;
    expect(r.new_price).toBe(610);
    expect(r.new_mrp).toBe(800);
    expect(typeof r.old_price).toBe("number");
    // A client only ever sees its own client's report.
    const cRep = await (await get(`/api/price-revisions/report?from=${today}&to=${today}`, clientToken)).json() as { client_id: string };
    expect(cRep.client_id).toBe("c1");
  });
});

describe("Brand procurement — unassigned items", () => {
  it("items with no brand group under 'Unassigned' and the drilldown works (no 'brand required')", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,brand) VALUES ('NOBRAND-1','No Brand Item','',10,5,1,'')").run();
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type,created_at) VALUES ('NB-ORD','c1','tst-ops','APPROVED',70,13,83,'Regular',datetime('now'))").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('nb-oi','NB-ORD','NOBRAND-1','No Brand Item',7,10,70)").run();
    const bp = await (await get("/api/reports/brand-procurement", adminToken)).json() as Array<{ brand_name: string }>;
    expect(bp.some(r => r.brand_name === "Unassigned")).toBe(true);
    // The drilldown that previously 400'd now resolves the Unassigned bucket.
    const res = await get("/api/reports/brand-procurement-items?brand=Unassigned", adminToken);
    expect(res.status).toBe(200);
    const items = await res.json() as Array<{ sku: string }>;
    expect(items.some(x => x.sku === "NOBRAND-1")).toBe(true);
  });

  it("unbranded worklist lists no-brand SKUs (staff-only) and assigning a brand clears it", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,brand) VALUES ('UB-1','Widget','Snacks',10,3,1,'')").run();
    expect((await get("/api/inventory/unbranded", clientToken)).status).toBe(403); // staff only
    const before = await (await get("/api/inventory/unbranded", adminToken)).json() as { items: Array<{ sku: string }>; brands: string[] };
    expect(before.items.some(i => i.sku === "UB-1")).toBe(true);
    // Assign a brand via the inventory PATCH the UI uses.
    expect((await patch("/api/inventory/UB-1", { brand: "Acme" }, adminToken)).status).toBe(200);
    const after = await (await get("/api/inventory/unbranded", adminToken)).json() as { items: Array<{ sku: string }> };
    expect(after.items.some(i => i.sku === "UB-1")).toBe(false); // no longer unbranded
  });
});

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

  it("GET /api/barcode-map — returns sku/name/barcode for the scanner", async () => {
    const res = await get("/api/barcode-map", opsToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { items: Array<{ sku: string; name: string; barcode: string }> };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items[0]).toHaveProperty("sku");
    expect(body.items[0]).toHaveProperty("barcode");
  });

  it("GET /api/barcode-map — unauthenticated returns 401", async () => {
    const res = await get("/api/barcode-map");
    expect(res.status).toBe(401);
  });

  it("POST /api/inventory/barcodes — bulk sets barcodes and reflects in the map", async () => {
    const res = await post("/api/inventory/barcodes", {
      items: [{ sku: "SKU001", barcode: "8901234567890" }, { sku: "NOPE-SKU", barcode: "111" }],
    }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { updated: number; unknown: string[] };
    expect(body.updated).toBe(1);
    expect(body.unknown).toContain("NOPE-SKU");
    const map = await (await get("/api/barcode-map", adminToken)).json() as { items: Array<{ sku: string; barcode: string }> };
    expect(map.items.find(i => i.sku === "SKU001")?.barcode).toBe("8901234567890");
  });

  it("POST /api/inventory/barcodes — client role is forbidden", async () => {
    const res = await post("/api/inventory/barcodes", { items: [{ sku: "SKU001", barcode: "9" }] }, clientToken);
    expect(res.status).toBe(403);
  });

  it("Settings: dc_barcode_capture flag round-trips and defaults off", async () => {
    const before = await (await get("/api/settings", adminToken)).json() as { dc_barcode_capture: boolean };
    expect(before.dc_barcode_capture).toBe(false);
    const save = await post("/api/settings", { dc_barcode_capture: true }, adminToken);
    expect(ok(save.status)).toBe(true);
    const after = await (await get("/api/settings", adminToken)).json() as { dc_barcode_capture: boolean };
    expect(after.dc_barcode_capture).toBe(true);
    await post("/api/settings", { dc_barcode_capture: false }, adminToken); // reset
  });

  it("Settings: non-super-admin cannot change settings", async () => {
    const res = await post("/api/settings", { dc_barcode_capture: true }, clientToken);
    expect(res.status).toBe(403);
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
      products: [{ name: "Bru Coffee 200g", pack: "Carton·24", moq: 2, rate: 185, lead_days: 3, sku: "SKU001", mrp: 250, margin_pct: 26 },
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

    const prods = await (await get(`/api/vendors/${id}/products`, adminToken)).json() as Array<{name:string;status:string;mrp:number;margin_pct:number}>;
    expect(prods.length).toBe(2);
    const bru = prods.find(p => p.name === "Bru Coffee 200g");
    expect(bru?.status).toBe("linked"); // has SKU
    expect(bru?.mrp).toBe(250);
    expect(bru?.margin_pct).toBe(26);
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

describe("Order-to-delivery authorization", () => {
  const knownOrderId = "TST-ORDER-001"; // client c1, created_by tst-ops, DRAFT

  it("external (vendor) roles cannot drive fulfillment / procurement", async () => {
    // Vendor has no client_id, so is out of scope for every order.
    expect((await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "SKU001", name: "x", qty: 1, unit_price: 10 }] }, vendorToken)).status).toBe(403);
    expect((await post(`/api/orders/${knownOrderId}/pick`, { items: [] }, vendorToken)).status).toBe(403);
    expect((await post("/api/delivery-challans/DC-9999/deliver", {}, vendorToken)).status).toBe(403);
    expect((await post("/api/delivery-challans/DC-9999/partial", { delivered_qty: 1, total_qty: 2 }, vendorToken)).status).toBe(403);
    expect((await post("/api/delivery-challans/DC-9999/bill", {}, vendorToken)).status).toBe(403);
    // Fulfillment-state transition is staff-only.
    expect((await post(`/api/orders/${knownOrderId}/transition`, { to: "PICKED" }, vendorToken)).status).toBe(403);
  });

  it("a client cannot read, patch, comment on or transition another client's order (IDOR)", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES (?,?,?,?,?,?,?,?)")
      .bind("OTHER-CLIENT-ORD", "c2", "tst-ops", "DRAFT", 100, 18, 118, "Regular").run();
    expect((await get("/api/orders/OTHER-CLIENT-ORD", clientToken)).status).toBe(403);
    expect((await get("/api/orders/OTHER-CLIENT-ORD/comments", clientToken)).status).toBe(403);
    expect((await post("/api/orders/OTHER-CLIENT-ORD/comments", { message: "peek" }, clientToken)).status).toBe(403);
    expect((await patch("/api/orders/OTHER-CLIENT-ORD", { notes: "tamper" }, clientToken)).status).toBe(403);
    expect((await post("/api/orders/OTHER-CLIENT-ORD/transition", { to: "CANCELLED" }, clientToken)).status).toBe(403);
    // Own client's order remains readable.
    expect((await get(`/api/orders/${knownOrderId}`, clientToken)).status).toBe(200);
  });

  it("the order raiser cannot self-approve; a separate approver / admin can", async () => {
    const db = env.DB as D1Database;
    // Order raised by the client_admin (tst-client), sitting at PENDING_APPROVAL.
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES (?,?,?,?,?,?,?,?)")
      .bind("SELF-APPROVE-ORD", "c1", "tst-client", "PENDING_APPROVAL", 100, 18, 118, "Regular").run();
    // Creator approving their own order is blocked (segregation of duties).
    expect((await post("/api/orders/SELF-APPROVE-ORD/transition", { to: "APPROVED" }, clientToken)).status).toBe(403);
    // An elevated admin (not the raiser) can approve.
    expect((await post("/api/orders/SELF-APPROVE-ORD/transition", { to: "APPROVED" }, adminToken)).status).toBe(200);
  });

  it("client-scoped endpoints reject cross-tenant access (budget / credit / catalog)", async () => {
    // Own client (c1) is allowed; another client (c2) is forbidden.
    expect((await get("/api/clients/c1/budget", clientToken)).status).toBe(200);
    expect((await get("/api/clients/c2/budget", clientToken)).status).toBe(403);
    expect((await get("/api/clients/c2/credit", clientToken)).status).toBe(403);
    expect((await get("/api/clients/c2/catalog", clientToken)).status).toBe(403);
  });

  it("client master data (PATCH /clients/:id) is staff-only", async () => {
    expect((await patch("/api/clients/c1", { monthly_budget: 999999 }, clientToken)).status).toBe(403);
    expect((await patch("/api/clients/c1", { monthly_budget: 999999 }, vendorToken)).status).toBe(403);
  });

  it("health is public; observability is staff-only", async () => {
    const hres = await get("/api/health");
    expect(hres.status).toBe(200);
    const health = await hres.json() as { status: string; db: string };
    expect(health.status).toBe("ok");
    expect(health.db).toBe("ok");
    // Observability: clients/vendors blocked, staff allowed with error + metric shape.
    expect((await get("/api/observability", clientToken)).status).toBe(403);
    expect((await get("/api/observability", vendorToken)).status).toBe(403);
    const obs = await (await get("/api/observability", adminToken)).json() as {
      errors: { last_hour: number; recent: unknown[] }; metrics: Record<string, unknown>;
    };
    expect(typeof obs.errors.last_hour).toBe("number");
    expect(Array.isArray(obs.errors.recent)).toBe(true);
    expect(obs.metrics).toHaveProperty("pending_deliveries");
  });

  it("front-end errors are captured and surface in observability", async () => {
    const msg = "TypeError: capture-test-" + Date.now();
    const res = await post("/api/client-errors", { message: msg, stack: "at renderWHPickList (app.07.js:352)", page: "warehouse" }, clientToken);
    expect(res.status).toBe(204);
    const obs = await (await get("/api/observability", adminToken)).json() as { errors: { recent: Array<{ method: string; message: string }> } };
    expect(obs.errors.recent.some(e => e.method === "CLIENT" && e.message === msg)).toBe(true);
  });

  it("central guard blocks external roles from back-office endpoints", async () => {
    for (const p of ["/api/users", "/api/staff", "/api/audit-logs", "/api/warehouses", "/api/approval-rules"]) {
      expect((await get(p, clientToken)).status).toBe(403);
      expect((await get(p, vendorToken)).status).toBe(403);
    }
    // Staff still reach them.
    expect((await get("/api/users", adminToken)).status).toBe(200);
  });

  it("reports: clients are denied internal analytics but allowed self-scoping reports", async () => {
    // Internal, all-client analytics → blocked for clients and vendors.
    expect((await get("/api/reports/procurement-forecast", clientToken)).status).toBe(403);
    expect((await get("/api/reports/brand-shortfall", clientToken)).status).toBe(403);
    expect((await get("/api/reports/procurement-forecast", vendorToken)).status).toBe(403);
    // Client-safe, self-scoping reports remain reachable by clients.
    expect((await get("/api/reports/client-consumption", clientToken)).status).toBe(200);
    expect((await get("/api/reports/client-fulfilment", clientToken)).status).toBe(200);
    // Staff reach everything.
    expect((await get("/api/reports/procurement-forecast", adminToken)).status).toBe(200);
  });

  it("vendor data is not exposed to clients; vendors cannot be edited by clients", async () => {
    // Clients get no supplier list.
    const vlist = await (await get("/api/vendors", clientToken)).json() as unknown[];
    expect(Array.isArray(vlist) && vlist.length === 0).toBe(true);
    // Clients cannot edit a vendor record.
    expect((await patch("/api/vendors/v1", { name: "hijack" }, clientToken)).status).toBe(403);
  });

  it("delivery confirmation is idempotent — a settled challan cannot be re-delivered", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,total_qty,delivered_qty) VALUES (?,?,?,?,?)")
      .bind("DC-SETTLED", knownOrderId, "DELIVERED", 5, 5).run();
    expect((await post("/api/delivery-challans/DC-SETTLED/deliver", {}, adminToken)).status).toBe(409);
    expect((await post("/api/delivery-challans/DC-SETTLED/partial", { delivered_qty: 1, total_qty: 5 }, adminToken)).status).toBe(409);
  });

  it("stock deduction is applied exactly once per movement key (no double-spend on replay)", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,reserved,active) VALUES ('ATOM-1','Atom Test','Beverages',10,100,10,1)").run();
    await db.prepare("INSERT OR IGNORE INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,order_type) VALUES ('ATOM-ORD','c1','tst-ops','IN_SHIPMENT',100,18,118,'Regular')").run();
    await db.prepare("INSERT OR IGNORE INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES ('atom-oi','ATOM-ORD','ATOM-1','Atom Test',10,10,100)").run();
    await db.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,total_qty) VALUES ('DC-ATOM','ATOM-ORD','SCHEDULED',10)").run();
    await db.prepare("INSERT OR IGNORE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES ('atom-di','DC-ATOM','ATOM-1','Atom Test',10,0)").run();

    // First delivery deducts 10 → 90.
    expect((await post("/api/delivery-challans/DC-ATOM/deliver", {}, adminToken)).status).toBe(200);
    let stock = (await db.prepare("SELECT stock FROM inventory WHERE sku='ATOM-1'").first() as { stock: number }).stock;
    expect(stock).toBe(90);

    // Force the challan back to a deliverable state to bypass the status guard —
    // simulating a concurrent/replayed apply. The movement key must still stop a
    // second deduction, so stock stays 90 (not 80).
    await db.prepare("UPDATE delivery_challans SET status='SCHEDULED' WHERE id='DC-ATOM'").run();
    expect((await post("/api/delivery-challans/DC-ATOM/deliver", {}, adminToken)).status).toBe(200);
    stock = (await db.prepare("SELECT stock FROM inventory WHERE sku='ATOM-1'").first() as { stock: number }).stock;
    expect(stock).toBe(90);
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

describe("Zoho Inventory sync", () => {
  it("status reports configured/enabled flags and an item count", async () => {
    const res = await get("/api/integrations/zoho-inventory/status", adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean; enabled: boolean; item_count: number };
    expect(typeof body.configured).toBe("boolean");
    expect(typeof body.enabled).toBe("boolean");
    expect(body.item_count).toBeGreaterThanOrEqual(0);
  });

  it("sync is blocked until enabled, then runs and logs (simulated mode)", async () => {
    // Disabled by default → 400
    const off = await post("/api/integrations/zoho-inventory/sync", {}, adminToken);
    expect(off.status).toBe(400);

    // Enable, then sync succeeds
    const en = await post("/api/integrations/zoho-inventory/toggle", { enabled: true }, adminToken);
    expect(en.status).toBe(200);
    expect((await en.json() as { enabled: boolean }).enabled).toBe(true);

    const run = await post("/api/integrations/zoho-inventory/sync", {}, adminToken);
    expect(run.status).toBe(200);
    const body = await run.json() as { ok: boolean; items: number; simulated: number; simulated_mode: boolean };
    expect(body.ok).toBe(true);
    expect(body.items).toBeGreaterThanOrEqual(1);       // seeded inventory
    expect(body.simulated_mode).toBe(true);             // no ZOHO_ACCESS_TOKEN in tests
    expect(body.simulated).toBe(body.items);

    // Status now reflects enabled + a last sync + a log row
    const st = await get("/api/integrations/zoho-inventory/status", adminToken).then(r => r.json()) as { enabled: boolean; last_sync_at: string | null; recent_log: unknown[] };
    expect(st.enabled).toBe(true);
    expect(st.last_sync_at).toBeTruthy();
    expect(st.recent_log.length).toBeGreaterThanOrEqual(1);
  });

  it("only ops/admin can toggle or sync (client 403)", async () => {
    expect((await post("/api/integrations/zoho-inventory/toggle", { enabled: true }, clientToken)).status).toBe(403);
    expect((await post("/api/integrations/zoho-inventory/sync", {}, clientToken)).status).toBe(403);
  });

  it("inbound webhook updates our stock from Zoho", async () => {
    const res = await post("/api/integrations/zoho-inventory/webhook", {
      items: [{ sku: "SKU001", stock: 777 }, { sku: "NON_EXISTENT", stock: 5 }],
    }, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; updated: number };
    expect(body.updated).toBe(1); // only the real SKU is updated

    const inv = await get("/api/inventory", adminToken).then(r => r.json()) as Array<{ sku: string; stock: number }>;
    expect(inv.find(i => i.sku === "SKU001")?.stock).toBe(777);
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

  it("PUT amends a SENT PO — recomputes totals, keeps SENT below threshold", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken)).json() as { id: string; grand_total: number };
    const res = await put(`/api/purchase-orders/${c.id}`, { items: [{ sku: "BIGSKU", name: "Big Item", qty: 4, unit_price: 1000 }] }, adminToken);
    expect(res.status).toBe(200);
    const b = await res.json() as { status: string; grand_total: number };
    expect(b.status).toBe("SENT");
    expect(b.grand_total).toBe(c.grand_total * 2);           // qty doubled, price same
    const recv = await (await get(`/api/purchase-orders/${c.id}/receivable`, adminToken)).json() as { lines: Array<{ qty: number }> };
    expect(recv.lines[0].qty).toBe(4);
  });

  it("PUT amend above threshold re-enters PENDING_APPROVAL", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken)).json() as { id: string };
    const res = await put(`/api/purchase-orders/${c.id}`, { items: [{ sku: "BIGSKU", name: "Big Item", qty: 60, unit_price: 1000 }] }, adminToken);
    expect((await res.json() as { status: string }).status).toBe("PENDING_APPROVAL");
  });

  it("PUT amend is forbidden for non-approver roles", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken)).json() as { id: string };
    const res = await put(`/api/purchase-orders/${c.id}`, { items: [{ sku: "BIGSKU", name: "Big Item", qty: 3, unit_price: 1000 }] }, clientToken);
    expect(res.status).toBe(403);
  });

  it("amend can't drop a line below the quantity already received", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 10, unit_price: 100 }] }, adminToken)).json() as { id: string };
    await adb.prepare("UPDATE po_items SET qty_received=6 WHERE po_id=?").bind(c.id).run();
    const res = await put(`/api/purchase-orders/${c.id}`, { items: [{ sku: "BIGSKU", name: "Big Item", qty: 4, unit_price: 100 }] }, adminToken);
    expect(res.status).toBe(400);
  });

  it("cancel is allowed while SENT", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken)).json() as { id: string };
    const res = await patch(`/api/purchase-orders/${c.id}`, { status: "CANCELLED" }, adminToken);
    expect(res.status).toBe(200);
    const st = await adb.prepare("SELECT status FROM purchase_orders WHERE id=?").bind(c.id).first() as Record<string, string>;
    expect(st.status).toBe("CANCELLED");
  });

  it("cancel is blocked once the PO has moved (DISPATCHED)", async () => {
    const c = await (await post("/api/purchase-orders", { vendor_id: "v1", items: [{ sku: "BIGSKU", name: "Big Item", qty: 2, unit_price: 1000 }] }, adminToken)).json() as { id: string };
    await adb.prepare("UPDATE purchase_orders SET status='DISPATCHED' WHERE id=?").bind(c.id).run();
    const res = await patch(`/api/purchase-orders/${c.id}`, { status: "CANCELLED" }, adminToken);
    expect(res.status).toBe(400);
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
  it("GET /api/hsn-gst resolves the seeded slab for a known heading", async () => {
    const res = await get("/api/hsn-gst?hsn=2202", adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(28); // aerated/flavoured beverages
  });

  it("GET /api/hsn-gst falls back from an 8-digit code to its 4-digit heading", async () => {
    const data = await (await get("/api/hsn-gst?hsn=09011100", adminToken)).json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(5); // coffee, heading 0901
  });

  it("GET /api/hsn-gst reports no match for an unmapped code", async () => {
    const data = await (await get("/api/hsn-gst?hsn=9999", adminToken)).json() as { matched: boolean };
    expect(data.matched).toBe(false);
  });

  it("POST /api/inventory derives GST from the HSN code, ignoring a wrong supplied rate", async () => {
    const res = await post("/api/inventory", { name: "Fizzy Cola", category: "Beverages", unit_price: 40, hsn_code: "2202", gst_rate: 18 }, adminToken);
    expect(res.status).toBe(201);
    const { sku } = await res.json() as { sku: string };
    const row = await (env.DB as D1Database).prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(sku).first() as { gst_rate: number };
    expect(row.gst_rate).toBe(28);
  });

  it("PATCH /api/inventory re-derives GST when the HSN code changes", async () => {
    const created = await post("/api/inventory", { name: "Mystery Item", category: "Grocery", unit_price: 10, hsn_code: "0901" }, adminToken);
    const { sku } = await created.json() as { sku: string };
    // starts at 5% (coffee); move it to a 12%-heading and expect GST to follow
    await patch(`/api/inventory/${sku}`, { hsn_code: "2009" }, adminToken); // juices → 12
    const row = await (env.DB as D1Database).prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(sku).first() as { gst_rate: number };
    expect(row.gst_rate).toBe(12);
  });

  it("POST /api/inventory/recalc-gst backfills a wrong stored rate from the HSN", async () => {
    const db = env.DB as D1Database;
    await db.prepare("INSERT OR IGNORE INTO inventory (sku,name,category,unit_price,stock,active,hsn_code,gst_rate) VALUES (?,?,?,?,?,?,?,?)")
      .bind("HSNFIX", "Wrongly 18", "Beverages", 50, 0, 1, "2202", 18).run(); // should be 28
    const res = await post("/api/inventory/recalc-gst", {}, adminToken);
    expect(res.status).toBe(200);
    const data = await res.json() as { updated: number };
    expect(data.updated).toBeGreaterThanOrEqual(1);
    const row = await db.prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind("HSNFIX").first() as { gst_rate: number };
    expect(row.gst_rate).toBe(28);
  });

  it("POST /api/hsn-gst-rates upserts a mapping that the lookup then resolves", async () => {
    const res = await post("/api/hsn-gst-rates", { hsn: "3305", gst_rate: 18, description: "Hair preparations" }, adminToken);
    expect(res.status).toBe(200);
    const data = await (await get("/api/hsn-gst?hsn=3305", adminToken)).json() as { gst_rate: number; matched: boolean };
    expect(data.matched).toBe(true);
    expect(data.gst_rate).toBe(18);
  });

  it("POST /api/hsn-gst-rates rejects a rate outside the legal slabs", async () => {
    const res = await post("/api/hsn-gst-rates", { hsn: "4901", gst_rate: 7 }, adminToken);
    expect(res.status).toBe(400);
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
