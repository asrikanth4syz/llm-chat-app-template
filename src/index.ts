import { Env, JWTPayload } from "./types";

// ── JWT helpers (Web Crypto, no external deps) ───────────────────────
async function signJWT(payload: object, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sigB64}`;
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [header, payload, sig] = token.split(".");
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBuf = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBuf, new TextEncoder().encode(data));
    if (!valid) return null;
    const p = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as JWTPayload;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch { return null; }
}

// ── Auth helpers ─────────────────────────────────────────────────────
async function getUser(request: Request, env: Env): Promise<JWTPayload | null> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyJWT(auth.slice(7), env.JWT_SECRET);
}

function requireUser(user: JWTPayload | null): Response | null {
  if (!user) return json({ error: "Unauthorized" }, 401);
  return null;
}

// ── Response helpers ──────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function cors(): Response {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
  });
}

function uid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

// ── Main handler ──────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors();

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;

    try {
      // Auth
      if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env);
      if (path === "/api/auth/me" && method === "GET") return handleMe(request, env);

      // Orders
      if (path === "/api/orders" && method === "GET") return handleListOrders(request, env);
      if (path === "/api/orders" && method === "POST") return handleCreateOrder(request, env);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === "GET") return handleGetOrder(request, env, path);
      if (path.match(/^\/api\/orders\/[^/]+\/transition$/) && method === "POST") return handleTransitionOrder(request, env, path);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method === "PATCH") return handlePatchOrder(request, env, path);

      // Inventory
      if (path === "/api/inventory" && method === "GET") return handleListInventory(request, env);
      if (path === "/api/inventory" && method === "POST") return handleAddInventory(request, env);
      if (path.match(/^\/api\/inventory\/[^/]+$/) && method === "PATCH") return handlePatchInventory(request, env, path);

      // Vendors
      if (path === "/api/vendors" && method === "GET") return handleListVendors(request, env);
      if (path === "/api/vendors" && method === "POST") return handleAddVendor(request, env);

      // Purchase Orders
      if (path === "/api/purchase-orders" && method === "GET") return handleListPOs(request, env);
      if (path === "/api/purchase-orders" && method === "POST") return handleCreatePO(request, env);
      if (path.match(/^\/api\/purchase-orders\/[^/]+$/) && method === "PATCH") return handlePatchPO(request, env, path);

      // Delivery Challans
      if (path === "/api/delivery-challans" && method === "GET") return handleListDCs(request, env);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/bill$/) && method === "POST") return handleBillDC(request, env, path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/deliver$/) && method === "POST") return handleDeliverDC(request, env, path);

      // Clients
      if (path === "/api/clients" && method === "GET") return handleListClients(request, env);
      if (path === "/api/clients" && method === "POST") return handleAddClient(request, env);

      // Tickets
      if (path === "/api/tickets" && method === "GET") return handleListTickets(request, env);
      if (path === "/api/tickets" && method === "POST") return handleCreateTicket(request, env);
      if (path.match(/^\/api\/tickets\/[^/]+$/) && method === "PATCH") return handlePatchTicket(request, env, path);

      // Users
      if (path === "/api/users" && method === "GET") return handleListUsers(request, env);
      if (path === "/api/users" && method === "POST") return handleCreateUser(request, env);
      if (path.match(/^\/api\/users\/[^/]+$/) && method === "PATCH") return handlePatchUser(request, env, path);

      // Notifications
      if (path === "/api/notifications" && method === "GET") return handleListNotifications(request, env);
      if (path === "/api/notifications/read-all" && method === "POST") return handleReadAllNotifications(request, env);

      // Dashboard
      if (path === "/api/dashboard" && method === "GET") return handleDashboard(request, env);

      // GRN
      if (path === "/api/grn" && method === "GET") return handleListGRN(request, env);
      if (path === "/api/grn" && method === "POST") return handleCreateGRN(request, env);

      // DB init (dev only)
      if (path === "/api/init-db" && method === "POST") return handleInitDB(request, env);

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal server error" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ═══════════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════════

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json() as { email: string; password: string };
  if (!email || !password) return json({ error: "Email and password required" }, 400);

  const row = await env.DB.prepare("SELECT * FROM users WHERE email = ? AND active = 1").bind(email).first() as Record<string, string> | null;
  if (!row) return json({ error: "Invalid credentials" }, 401);

  // Check password: seed users use "SEED:password" sentinel; real users use "hash:<actual-hash>"
  let valid = false;
  const hash = row.password_hash as string;
  if (hash.startsWith("SEED:")) {
    valid = password === hash.slice(5);
  } else if (hash.startsWith("hash:")) {
    valid = await verifyPassword(password, hash.slice(5));
  }
  if (!valid) return json({ error: "Invalid credentials" }, 401);

  const payload: JWTPayload = {
    sub: row.id as string,
    email: row.email as string,
    role: row.role as string,
    name: row.name as string,
    org: row.org as string,
    initials: row.initials as string,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7,
  };
  const token = await signJWT(payload, env.JWT_SECRET);
  return json({ token, user: payload });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json({ user });
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === hashHex;
}

// ═══════════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════════

const ORDER_FSM: Record<string, string[]> = {
  DRAFT:            ["SUBMITTED", "CANCELLED"],
  SUBMITTED:        ["PENDING_APPROVAL", "APPROVED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
  APPROVED:         ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED:     ["INVENTORY_CHECK", "CANCELLED"],
  INVENTORY_CHECK:  ["VENDOR_PO_RAISED", "CANCELLED"],
  VENDOR_PO_RAISED: ["READY_TO_PICK", "CANCELLED"],
  READY_TO_PICK:    ["IN_SHIPMENT"],
  IN_SHIPMENT:      ["PARTIALLY_CLOSED", "CLOSED"],
  PARTIALLY_CLOSED: ["CLOSED"],
  CLOSED:           [],
  CANCELLED:        [],
};

async function handleListOrders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const clientId = url.searchParams.get("client_id");
  const search = url.searchParams.get("q");

  let query = `
    SELECT o.*, c.name as client_name, u.name as creator_name
    FROM orders o
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.created_by = u.id
    WHERE 1=1
  `;
  const params: string[] = [];

  // Scope by role
  if (user!.role === "client_user" || user!.role === "client_admin" || user!.role === "client_approver") {
    const client = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?")
      .bind(`%${user!.email.split("@")[1]}%`).first() as Record<string, string> | null;
    if (client) { query += " AND o.client_id = ?"; params.push(client.id); }
  } else if (user!.role === "vendor_admin" || user!.role === "vendor_user") {
    // Vendors see orders linked to their POs
    query += ` AND o.id IN (SELECT DISTINCT order_id FROM purchase_orders WHERE vendor_id IN (SELECT id FROM vendors WHERE contact_email LIKE ?))`;
    params.push(`%${user!.email.split("@")[1]}%`);
  }

  if (status) { query += " AND o.status = ?"; params.push(status); }
  if (clientId) { query += " AND o.client_id = ?"; params.push(clientId); }
  if (search) { query += " AND (o.id LIKE ? OR c.name LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  query += " ORDER BY o.created_at DESC LIMIT 100";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleGetOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").pop()!;
  const order = await env.DB.prepare(`
    SELECT o.*, c.name as client_name, u.name as creator_name
    FROM orders o
    LEFT JOIN clients c ON o.client_id = c.id
    LEFT JOIN users u ON o.created_by = u.id
    WHERE o.id = ?
  `).bind(id).first();
  if (!order) return json({ error: "Order not found" }, 404);

  const { results: items } = await env.DB.prepare("SELECT * FROM order_items WHERE order_id = ?").bind(id).all();
  const { results: history } = await env.DB.prepare("SELECT * FROM order_history WHERE order_id = ? ORDER BY created_at").bind(id).all();

  return json({ ...order, items, history });
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as {
    client_id: string;
    items: Array<{ sku: string; name: string; qty: number; unit_price: number }>;
    notes?: string;
  };

  if (!body.client_id || !body.items?.length) return json({ error: "client_id and items required" }, 400);

  const id = `SP-${new Date().toISOString().slice(2, 7).replace("-", "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const subtotal = body.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const gst = Math.round(subtotal * 0.18);
  const grand_total = subtotal + gst;
  const status = grand_total > 100000 ? "PENDING_APPROVAL" : "SUBMITTED";

  await env.DB.prepare(`
    INSERT INTO orders (id, client_id, created_by, status, subtotal, gst, grand_total, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.client_id, user!.sub, status, subtotal, gst, grand_total, body.notes || null).run();

  for (const item of body.items) {
    await env.DB.prepare(`
      INSERT INTO order_items (id, order_id, sku, name, qty, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty * item.unit_price).run();

    // Deduct stock
    await env.DB.prepare("UPDATE inventory SET stock = MAX(0, stock - ?) WHERE sku = ?")
      .bind(item.qty, item.sku).run();
  }

  await env.DB.prepare(`
    INSERT INTO order_history (id, order_id, from_status, to_status, actor_id, actor_name, note)
    VALUES (?, ?, NULL, ?, ?, ?, ?)
  `).bind(uid(), id, status, user!.sub, user!.name, grand_total > 100000 ? "Approval required — amount exceeds threshold" : null).run();

  return json({ id, status, grand_total }, 201);
}

async function handleTransitionOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as { to: string; note?: string };

  const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first() as Record<string, string> | null;
  if (!order) return json({ error: "Order not found" }, 404);

  const allowed = ORDER_FSM[order.status as string] || [];
  if (!allowed.includes(body.to)) {
    return json({ error: `Cannot transition from ${order.status} to ${body.to}` }, 400);
  }

  await env.DB.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.to, id).run();

  await env.DB.prepare(`
    INSERT INTO order_history (id, order_id, from_status, to_status, actor_id, actor_name, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(uid(), id, order.status, body.to, user!.sub, user!.name, body.note || null).run();

  // Auto-create DC when order goes IN_SHIPMENT
  if (body.to === "IN_SHIPMENT") {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO delivery_challans (id, order_id, status)
      VALUES (?, ?, 'SCHEDULED')
    `).bind(`DC-${Math.floor(Math.random() * 9000 + 1000)}`, id).run();
  }

  return json({ id, status: body.to });
}

async function handlePatchOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").pop()!;
  const body = await request.json() as { notes?: string };

  await env.DB.prepare("UPDATE orders SET notes = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(body.notes || null, id).run();
  return json({ id });
}

// ═══════════════════════════════════════════════════════════════════
// INVENTORY
// ═══════════════════════════════════════════════════════════════════

async function handleListInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const cat = url.searchParams.get("category");

  let query = "SELECT i.*, v.name as vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id = v.id WHERE i.active = 1";
  const params: string[] = [];
  if (q) { query += " AND (i.name LIKE ? OR i.sku LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }
  if (cat) { query += " AND i.category = ?"; params.push(cat); }
  query += " ORDER BY i.name";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleAddInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as Record<string, unknown>;
  const sku = `SKU${String(Math.floor(Math.random() * 900 + 100)).padStart(3, "0")}`;

  await env.DB.prepare(`
    INSERT INTO inventory (sku, name, category, unit_price, stock, reorder_level, max_stock, vendor_id, hsn_code, gst_rate, emoji)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sku, body.name, body.category, body.unit_price, body.stock || 0,
    body.reorder_level || 20, body.max_stock || 200, body.vendor_id || null,
    body.hsn_code || "2101", body.gst_rate || 18, body.emoji || "📦"
  ).run();

  return json({ sku }, 201);
}

async function handlePatchInventory(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const sku = path.split("/").pop()!;
  const body = await request.json() as Record<string, unknown>;

  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.stock !== undefined) { fields.push("stock = ?"); vals.push(body.stock); }
  if (body.reorder_level !== undefined) { fields.push("reorder_level = ?"); vals.push(body.reorder_level); }
  if (body.unit_price !== undefined) { fields.push("unit_price = ?"); vals.push(body.unit_price); }
  if (body.active !== undefined) { fields.push("active = ?"); vals.push(body.active); }
  if (!fields.length) return json({ error: "Nothing to update" }, 400);

  vals.push(sku);
  await env.DB.prepare(`UPDATE inventory SET ${fields.join(", ")} WHERE sku = ?`).bind(...vals).run();
  return json({ sku });
}

// ═══════════════════════════════════════════════════════════════════
// VENDORS
// ═══════════════════════════════════════════════════════════════════

async function handleListVendors(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare("SELECT * FROM vendors WHERE active = 1 ORDER BY name").all();
  return json(results);
}

async function handleAddVendor(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as Record<string, unknown>;
  const id = `v${uid().slice(0, 6)}`;

  await env.DB.prepare(`
    INSERT INTO vendors (id, name, category, contact_email, contact_phone)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, body.name, body.category, body.contact_email || null, body.contact_phone || null).run();

  return json({ id }, 201);
}

// ═══════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════

async function handleListPOs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const vendorId = url.searchParams.get("vendor_id");
  const status = url.searchParams.get("status");

  let query = `
    SELECT p.*, v.name as vendor_name
    FROM purchase_orders p
    LEFT JOIN vendors v ON p.vendor_id = v.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (user!.role === "vendor_admin" || user!.role === "vendor_user") {
    const domain = user!.email.split("@")[1];
    query += " AND v.contact_email LIKE ?";
    params.push(`%${domain}%`);
  }

  if (vendorId) { query += " AND p.vendor_id = ?"; params.push(vendorId); }
  if (status) { query += " AND p.status = ?"; params.push(status); }
  query += " ORDER BY p.created_at DESC LIMIT 50";

  const { results } = await env.DB.prepare(query).bind(...params).all();

  // Attach items
  const withItems = await Promise.all(results.map(async (po: Record<string, unknown>) => {
    const { results: items } = await env.DB.prepare("SELECT * FROM po_items WHERE po_id = ?").bind(po.id).all();
    return { ...po, items };
  }));

  return json(withItems);
}

async function handleCreatePO(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as {
    vendor_id: string;
    order_id?: string;
    items: Array<{ sku: string; name: string; qty: number; unit_price: number }>;
    expected_delivery?: string;
    notes?: string;
  };

  if (!body.vendor_id || !body.items?.length) return json({ error: "vendor_id and items required" }, 400);

  const id = `PO-${Math.floor(Math.random() * 9000 + 1000)}`;
  const subtotal = body.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const gst = Math.round(subtotal * 0.18);
  const grand_total = subtotal + gst;

  await env.DB.prepare(`
    INSERT INTO purchase_orders (id, vendor_id, order_id, status, subtotal, gst, grand_total, expected_delivery, notes)
    VALUES (?, ?, ?, 'SENT', ?, ?, ?, ?, ?)
  `).bind(id, body.vendor_id, body.order_id || null, subtotal, gst, grand_total, body.expected_delivery || null, body.notes || null).run();

  for (const item of body.items) {
    await env.DB.prepare(`
      INSERT INTO po_items (id, po_id, sku, name, qty, unit_price, total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty * item.unit_price).run();
  }

  // If linked to an order, advance order status
  if (body.order_id) {
    await env.DB.prepare("UPDATE orders SET status = 'VENDOR_PO_RAISED', updated_at = datetime('now') WHERE id = ? AND status = 'INVENTORY_CHECK'")
      .bind(body.order_id).run();
  }

  return json({ id, grand_total }, 201);
}

async function handlePatchPO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").pop()!;
  const body = await request.json() as { status?: string; invoice_url?: string };

  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id = ?").bind(id).first() as Record<string, string> | null;
  if (!po) return json({ error: "PO not found" }, 404);

  const updates: string[] = ["updated_at = datetime('now')"];
  const vals: unknown[] = [];

  if (body.status) { updates.push("status = ?"); vals.push(body.status); }
  if (body.invoice_url) { updates.push("invoice_url = ?"); vals.push(body.invoice_url); }
  vals.push(id);

  await env.DB.prepare(`UPDATE purchase_orders SET ${updates.join(", ")} WHERE id = ?`).bind(...vals).run();

  // If vendor accepted PO, advance linked order to READY_TO_PICK
  if (body.status === "ACCEPTED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status = 'READY_TO_PICK', updated_at = datetime('now') WHERE id = ? AND status = 'VENDOR_PO_RAISED'")
      .bind(po.order_id).run();
  }

  // If vendor dispatched, update DC and order
  if (body.status === "DISPATCHED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status = 'IN_SHIPMENT', updated_at = datetime('now') WHERE id = ? AND status IN ('READY_TO_PICK','VENDOR_PO_RAISED')")
      .bind(po.order_id).run();
    await env.DB.prepare("UPDATE delivery_challans SET status = 'IN_TRANSIT', dispatched_at = datetime('now') WHERE order_id = ?")
      .bind(po.order_id).run();
  }

  return json({ id, status: body.status });
}

// ═══════════════════════════════════════════════════════════════════
// DELIVERY CHALLANS
// ═══════════════════════════════════════════════════════════════════

async function handleListDCs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare(`
    SELECT dc.*, o.client_id, c.name as client_name, o.grand_total as order_value
    FROM delivery_challans dc
    LEFT JOIN orders o ON dc.order_id = o.id
    LEFT JOIN clients c ON o.client_id = c.id
    ORDER BY dc.dispatched_at DESC
  `).all();
  return json(results);
}

async function handleBillDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET billed = 1, billed_at = datetime('now') WHERE id = ?").bind(id).run();

  // Close the linked order
  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id = ?").bind(id).first() as Record<string, string> | null;
  if (dc?.order_id) {
    await env.DB.prepare("UPDATE orders SET status = 'CLOSED', updated_at = datetime('now') WHERE id = ? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED','DELIVERED')")
      .bind(dc.order_id).run();
  }
  return json({ id, billed: true });
}

async function handleDeliverDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET status = 'DELIVERED', delivered_at = datetime('now') WHERE id = ?").bind(id).run();
  return json({ id, status: "DELIVERED" });
}

// ═══════════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════════

async function handleListClients(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare("SELECT * FROM clients WHERE active = 1 ORDER BY name").all();
  return json(results);
}

async function handleAddClient(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as Record<string, unknown>;
  const id = `c${uid().slice(0, 6)}`;

  await env.DB.prepare(`
    INSERT INTO clients (id, name, contact_email, contact_name, monthly_budget, approval_threshold)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, body.name, body.contact_email || null, body.contact_name || null,
    body.monthly_budget || 500000, body.approval_threshold || 100000).run();

  return json({ id }, 201);
}

// ═══════════════════════════════════════════════════════════════════
// TICKETS
// ═══════════════════════════════════════════════════════════════════

async function handleListTickets(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare(`
    SELECT t.*, c.name as client_name, u.name as raiser_name
    FROM tickets t
    LEFT JOIN clients c ON t.client_id = c.id
    LEFT JOIN users u ON t.raised_by = u.id
    ORDER BY t.created_at DESC
  `).all();
  return json(results);
}

async function handleCreateTicket(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as Record<string, unknown>;
  const id = `TKT-${Math.floor(Math.random() * 900 + 100).toString().padStart(3, "0")}`;

  // Resolve client_id from user's domain if not provided
  let clientId = body.client_id as string;
  if (!clientId) {
    const domain = user!.email.split("@")[1];
    const c = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string, string> | null;
    clientId = c?.id || "c1";
  }

  await env.DB.prepare(`
    INSERT INTO tickets (id, client_id, raised_by, subject, description, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
  `).bind(id, clientId, user!.sub, body.subject, body.description || null, body.priority || "MEDIUM").run();

  return json({ id }, 201);
}

async function handlePatchTicket(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").pop()!;
  const body = await request.json() as { status?: string; priority?: string };

  const updates: string[] = [];
  const vals: unknown[] = [];
  if (body.status) {
    updates.push("status = ?"); vals.push(body.status);
    if (body.status === "RESOLVED") { updates.push("resolved_at = datetime('now')"); }
  }
  if (body.priority) { updates.push("priority = ?"); vals.push(body.priority); }
  if (!updates.length) return json({ error: "Nothing to update" }, 400);

  vals.push(id);
  await env.DB.prepare(`UPDATE tickets SET ${updates.join(", ")} WHERE id = ?`).bind(...vals).run();
  return json({ id });
}

// ═══════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════

async function handleListUsers(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    "SELECT id, email, role, name, org, initials, active, created_at FROM users ORDER BY name"
  ).all();
  return json(results);
}

async function handleCreateUser(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  if (user!.role !== "super_admin") return json({ error: "Forbidden" }, 403);

  const body = await request.json() as Record<string, string>;
  const id = `u${uid().slice(0, 6)}`;
  const passwordHash = `hash:${await hashPassword(body.password || "password")}`;
  const initials = body.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  await env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, role, name, org, initials)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, body.email, passwordHash, body.role, body.name, body.org || "4SYZ Platform", initials).run();

  return json({ id }, 201);
}

async function handlePatchUser(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  if (user!.role !== "super_admin") return json({ error: "Forbidden" }, 403);

  const id = path.split("/").pop()!;
  const body = await request.json() as { active?: number; role?: string };

  const updates: string[] = [];
  const vals: unknown[] = [];
  if (body.active !== undefined) { updates.push("active = ?"); vals.push(body.active); }
  if (body.role) { updates.push("role = ?"); vals.push(body.role); }
  if (!updates.length) return json({ error: "Nothing to update" }, 400);

  vals.push(id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...vals).run();
  return json({ id });
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════

async function handleListNotifications(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare(
    "SELECT * FROM notifications WHERE user_role IS NULL OR user_role = ? ORDER BY created_at DESC LIMIT 20"
  ).bind(user!.role).all();
  return json(results);
}

async function handleReadAllNotifications(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  await env.DB.prepare("UPDATE notifications SET read_flag = 1 WHERE user_role IS NULL OR user_role = ?").bind(user!.role).run();
  return json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const role = user!.role;

  if (role === "client_admin" || role === "client_approver" || role === "client_user") {
    // Client dashboard
    const domain = user!.email.split("@")[1];
    const client = await env.DB.prepare("SELECT * FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string, unknown> | null;

    const { results: recentOrders } = await env.DB.prepare(`
      SELECT id, status, grand_total, created_at FROM orders
      WHERE client_id = ? ORDER BY created_at DESC LIMIT 5
    `).bind(client?.id || "c1").all();

    const spend = await env.DB.prepare(`
      SELECT SUM(grand_total) as total FROM orders WHERE client_id = ? AND status NOT IN ('CANCELLED','DRAFT')
    `).bind(client?.id || "c1").first() as Record<string, number> | null;

    const pendingApproval = await env.DB.prepare(`
      SELECT COUNT(*) as cnt FROM orders WHERE client_id = ? AND status = 'PENDING_APPROVAL'
    `).bind(client?.id || "c1").first() as Record<string, number> | null;

    return json({ client, recentOrders, totalSpend: spend?.total || 0, pendingApproval: pendingApproval?.cnt || 0 });
  }

  if (role === "vendor_admin" || role === "vendor_user") {
    const domain = user!.email.split("@")[1];
    const vendor = await env.DB.prepare("SELECT * FROM vendors WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string, unknown> | null;

    const { results: pendingPOs } = await env.DB.prepare(`
      SELECT p.*, v.name as vendor_name FROM purchase_orders p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE v.contact_email LIKE ? AND p.status IN ('SENT','ACCEPTED')
      ORDER BY p.created_at DESC
    `).bind(`%${domain}%`).all();

    return json({ vendor, pendingPOs });
  }

  // Ops / platform dashboard
  const totalOrders = await env.DB.prepare("SELECT COUNT(*) as cnt FROM orders").first() as Record<string, number>;
  const pendingOrders = await env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status NOT IN ('CLOSED','CANCELLED')").first() as Record<string, number>;
  const { results: recentOrders } = await env.DB.prepare(`
    SELECT o.id, o.status, o.grand_total, o.created_at, c.name as client_name
    FROM orders o LEFT JOIN clients c ON o.client_id = c.id
    ORDER BY o.created_at DESC LIMIT 8
  `).all();

  const lowStock = await env.DB.prepare("SELECT COUNT(*) as cnt FROM inventory WHERE stock <= reorder_level").first() as Record<string, number>;
  const pendingDCBilling = await env.DB.prepare("SELECT COUNT(*) as cnt FROM delivery_challans WHERE status = 'DELIVERED' AND billed = 0").first() as Record<string, number>;
  const openTickets = await env.DB.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status != 'RESOLVED'").first() as Record<string, number>;

  const { results: ordersByStatus } = await env.DB.prepare(`
    SELECT status, COUNT(*) as cnt FROM orders GROUP BY status
  `).all();

  const { results: topClients } = await env.DB.prepare(`
    SELECT c.name, SUM(o.grand_total) as total, COUNT(o.id) as order_count
    FROM orders o JOIN clients c ON o.client_id = c.id
    WHERE o.status NOT IN ('CANCELLED')
    GROUP BY c.id ORDER BY total DESC LIMIT 5
  `).all();

  return json({
    totalOrders: totalOrders.cnt,
    pendingOrders: pendingOrders.cnt,
    lowStock: lowStock.cnt,
    pendingDCBilling: pendingDCBilling.cnt,
    openTickets: openTickets.cnt,
    recentOrders,
    ordersByStatus,
    topClients,
  });
}

// ═══════════════════════════════════════════════════════════════════
// GRN
// ═══════════════════════════════════════════════════════════════════

async function handleListGRN(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const { results } = await env.DB.prepare(`
    SELECT g.*, p.vendor_id, v.name as vendor_name, u.name as receiver_name
    FROM grn_records g
    LEFT JOIN purchase_orders p ON g.po_id = p.id
    LEFT JOIN vendors v ON p.vendor_id = v.id
    LEFT JOIN users u ON g.received_by = u.id
    ORDER BY g.received_at DESC LIMIT 20
  `).all();
  return json(results);
}

async function handleCreateGRN(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as { po_id: string; qty_received: number; notes?: string };
  const id = `GRN-${Math.floor(Math.random() * 9000 + 1000)}`;

  await env.DB.prepare(`
    INSERT INTO grn_records (id, po_id, received_by, qty_received, notes)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, body.po_id, user!.sub, body.qty_received || 0, body.notes || null).run();

  await env.DB.prepare("UPDATE purchase_orders SET status = 'RECEIVED', updated_at = datetime('now') WHERE id = ?")
    .bind(body.po_id).run();

  return json({ id }, 201);
}

// ═══════════════════════════════════════════════════════════════════
// DB INIT (applies migrations for local dev)
// ═══════════════════════════════════════════════════════════════════

async function handleInitDB(request: Request, env: Env): Promise<Response> {
  // Only usable when no users exist yet (first-time setup)
  const existing = await env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first().catch(() => null) as Record<string, number> | null;
  if (existing && existing.cnt > 0) return json({ ok: false, message: "DB already initialized" });

  // The migration is applied separately via wrangler d1 migrations apply
  return json({ ok: true, message: "Run: wrangler d1 migrations apply smart-pantry-db --local" });
}
