import { Env, JWTPayload } from "./types";

// ── JWT ──────────────────────────────────────────────────────────────
async function signJWT(payload: object, secret: string): Promise<string> {
  const enc = (o: object) =>
    btoa(JSON.stringify(o)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const data = `${enc({alg:"HS256",typ:"JWT"})}.${enc(payload)}`;
  const key = await crypto.subtle.importKey("raw",
    new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}`;
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const [h, p, s] = token.split(".");
    const data = `${h}.${p}`;
    const key = await crypto.subtle.importKey("raw",
      new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
    const sigBuf = Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", key, sigBuf, new TextEncoder().encode(data));
    if (!ok) return null;
    const pl = JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/"))) as JWTPayload;
    if (pl.exp < Math.floor(Date.now()/1000)) return null;
    return pl;
  } catch { return null; }
}

async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hex = (b: Uint8Array) => Array.from(b).map(x=>x.toString(16).padStart(2,"0")).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"}, key, 256);
  return `${hex(salt)}:${hex(new Uint8Array(bits))}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b=>parseInt(b,16)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"}, key, 256);
  return Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,"0")).join("") === hashHex;
}

// ── Helpers ──────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status, headers: {"content-type":"application/json","Access-Control-Allow-Origin":"*"},
  });
}
function cors(): Response {
  return new Response(null, { headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  }});
}
function uid(): string { return crypto.randomUUID().replace(/-/g,"").slice(0,16); }

async function getUser(req: Request, env: Env): Promise<JWTPayload | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyJWT(auth.slice(7), env.JWT_SECRET);
}
function requireUser(u: JWTPayload | null): Response | null {
  return u ? null : json({error:"Unauthorized"}, 401);
}

// ── Audit logger ─────────────────────────────────────────────────────
async function audit(env: Env, actor: JWTPayload | null, action: string,
    entityType: string, entityId: string, oldVal?: string, newVal?: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO audit_logs (id,actor_id,actor_name,action,entity_type,entity_id,old_value,new_value)
    VALUES (?,?,?,?,?,?,?,?)`)
    .bind(uid(), actor?.sub||"system", actor?.name||"System", action,
      entityType, entityId, oldVal||null, newVal||null).run().catch(()=>{});
}

// ── Email via MailChannels (Gap 3) ────────────────────────────────────
async function sendEmail(env: Env, to: string, subject: string, text: string, html?: string): Promise<void> {
  if (env.MAILCHANNELS_ENABLED !== "true") {
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    return;
  }
  await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({
      personalizations: [{to:[{email:to}]}],
      from: {email: env.EMAIL_FROM, name: "Smart Pantry"},
      subject,
      content: [{type:"text/plain",value:text}, ...(html?[{type:"text/html",value:html}]:[])],
    }),
  }).catch(e => console.error("Email error:", e));
}

// ── SMS via MSG91 (Gap 3) ─────────────────────────────────────────────
async function sendSMS(env: Env, phone: string, message: string): Promise<void> {
  if (!env.MSG91_AUTH_KEY) { console.log(`[SMS] To: ${phone} | ${message}`); return; }
  await fetch(`https://api.msg91.com/api/v5/flow/`, {
    method: "POST",
    headers: {"authkey": env.MSG91_AUTH_KEY, "content-type": "application/json"},
    body: JSON.stringify({
      flow_id: "smartpantry_otp",
      sender: "SMRTPN",
      mobiles: `91${phone.replace(/\D/g,"")}`,
      OTP: message,
    }),
  }).catch(e => console.error("SMS error:", e));
}

// ── Zoho Books (Gap 4) ────────────────────────────────────────────────
async function syncToZohoBooks(env: Env, invoice: {id:string, clientName:string, amount:number, date:string}): Promise<void> {
  if (!env.ZOHO_BOOKS_ORG_ID || !env.ZOHO_BOOKS_CLIENT_ID) {
    console.log(`[Zoho] Sync invoice ${invoice.id} for ${invoice.clientName} — ₹${invoice.amount}`);
    return;
  }
  // Would use Zoho Books API: POST /invoices with OAuth token
  // Stubbed: log intent and store reference
  console.log(`[Zoho] Would POST to Zoho Books org ${env.ZOHO_BOOKS_ORG_ID}: invoice ${invoice.id}`);
}

// ── Notification helper ───────────────────────────────────────────────
async function pushNotification(env: Env, userRole: string | null, message: string): Promise<void> {
  await env.DB.prepare("INSERT INTO notifications (id,user_role,message) VALUES (?,?,?)")
    .bind(uid(), userRole, message).run().catch(()=>{});
}

// ── Auto-reorder (Gap 8) ──────────────────────────────────────────────
async function checkAutoReorder(env: Env, actor: JWTPayload | null): Promise<void> {
  const { results } = await env.DB.prepare(`
    SELECT * FROM inventory WHERE stock <= reorder_level AND vendor_id IS NOT NULL AND active = 1
  `).all();

  for (const item of results as Record<string,unknown>[]) {
    const existing = await env.DB.prepare(`
      SELECT id FROM purchase_orders WHERE status IN ('SENT','ACCEPTED')
      AND id IN (SELECT po_id FROM po_items WHERE sku = ?)
    `).bind(item.sku).first();
    if (existing) continue; // PO already outstanding

    const reorderQty = Math.max(50, (item.max_stock as number) - (item.stock as number));
    const poId = `PO-AUTO-${Math.floor(Math.random()*9000+1000)}`;
    const total = reorderQty * (item.unit_price as number);
    const gst = Math.round(total * 0.18);

    await env.DB.prepare(`INSERT INTO purchase_orders (id,vendor_id,status,subtotal,gst,grand_total,notes)
      VALUES (?,?,'SENT',?,?,?,'Auto-reorder: stock below reorder level')`)
      .bind(poId, item.vendor_id, total, gst, total+gst).run();
    await env.DB.prepare(`INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total)
      VALUES (?,?,?,?,?,?,?)`)
      .bind(uid(), poId, item.sku, item.name, reorderQty, item.unit_price, total).run();

    await pushNotification(env, "procurement_manager",
      `Auto-reorder PO ${poId} raised for ${item.name} — stock critical (${item.stock} units remaining)`);
    await audit(env, actor, "AUTO_REORDER", "purchase_order", poId, undefined, `sku:${item.sku},qty:${reorderQty}`);
  }
}

// ── ORDER FSM ─────────────────────────────────────────────────────────
const ORDER_FSM: Record<string, string[]> = {
  DRAFT:            ["SUBMITTED","CANCELLED"],
  SUBMITTED:        ["PENDING_APPROVAL","APPROVED","CANCELLED"],
  PENDING_APPROVAL: ["APPROVED","CANCELLED"],
  APPROVED:         ["ACKNOWLEDGED","CANCELLED"],
  ACKNOWLEDGED:     ["INVENTORY_CHECK","CANCELLED"],
  INVENTORY_CHECK:  ["VENDOR_PO_RAISED","CANCELLED"],
  VENDOR_PO_RAISED: ["READY_TO_PICK","CANCELLED"],
  READY_TO_PICK:    ["IN_SHIPMENT"],
  IN_SHIPMENT:      ["PARTIALLY_CLOSED","CLOSED"],
  PARTIALLY_CLOSED: ["CLOSED"],
  CLOSED: [], CANCELLED: [],
};

// ════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors();
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const path = url.pathname.replace(/\/$/,"");
    const method = request.method;

    try {
      // Auth
      if (path==="/api/auth/login"      && method==="POST") return handleLogin(request,env);
      if (path==="/api/auth/me"         && method==="GET")  return handleMe(request,env);
      if (path==="/api/auth/otp/send"   && method==="POST") return handleOTPSend(request,env);
      if (path==="/api/auth/otp/verify" && method==="POST") return handleOTPVerify(request,env);

      // Orders
      if (path==="/api/orders"          && method==="GET")  return handleListOrders(request,env);
      if (path==="/api/orders"          && method==="POST") return handleCreateOrder(request,env);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="GET")   return handleGetOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="PATCH") return handlePatchOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/transition$/) && method==="POST") return handleTransitionOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)   && method==="GET")  return handleListComments(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)   && method==="POST") return handleAddComment(request,env,path);

      // Inventory
      if (path==="/api/inventory"               && method==="GET")   return handleListInventory(request,env);
      if (path==="/api/inventory"               && method==="POST")  return handleAddInventory(request,env);
      if (path.match(/^\/api\/inventory\/[^/]+$/) && method==="PATCH") return handlePatchInventory(request,env,path);

      // Vendors
      if (path==="/api/vendors"  && method==="GET")  return handleListVendors(request,env);
      if (path==="/api/vendors"  && method==="POST") return handleAddVendor(request,env);

      // Purchase Orders
      if (path==="/api/purchase-orders"               && method==="GET")   return handleListPOs(request,env);
      if (path==="/api/purchase-orders"               && method==="POST")  return handleCreatePO(request,env);
      if (path.match(/^\/api\/purchase-orders\/[^/]+$/) && method==="PATCH") return handlePatchPO(request,env,path);

      // Delivery Challans
      if (path==="/api/delivery-challans"                            && method==="GET")  return handleListDCs(request,env);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/bill$/)     && method==="POST") return handleBillDC(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/deliver$/)  && method==="POST") return handleDeliverDC(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/partial$/)  && method==="POST") return handlePartialDelivery(request,env,path);

      // Clients
      if (path==="/api/clients"  && method==="GET")  return handleListClients(request,env);
      if (path==="/api/clients"  && method==="POST") return handleAddClient(request,env);
      if (path.match(/^\/api\/clients\/[^/]+$/) && method==="PATCH") return handlePatchClient(request,env,path);

      // Tickets
      if (path==="/api/tickets"                     && method==="GET")   return handleListTickets(request,env);
      if (path==="/api/tickets"                     && method==="POST")  return handleCreateTicket(request,env);
      if (path.match(/^\/api\/tickets\/[^/]+$/)     && method==="PATCH") return handlePatchTicket(request,env,path);

      // Users
      if (path==="/api/users"                   && method==="GET")   return handleListUsers(request,env);
      if (path==="/api/users"                   && method==="POST")  return handleCreateUser(request,env);
      if (path.match(/^\/api\/users\/[^/]+$/)   && method==="PATCH") return handlePatchUser(request,env,path);

      // Notifications
      if (path==="/api/notifications"             && method==="GET")  return handleListNotifications(request,env);
      if (path==="/api/notifications/read-all"    && method==="POST") return handleReadAllNotifications(request,env);

      // Dashboard
      if (path==="/api/dashboard"  && method==="GET") return handleDashboard(request,env);

      // GRN
      if (path==="/api/grn"  && method==="GET")  return handleListGRN(request,env);
      if (path==="/api/grn"  && method==="POST") return handleCreateGRN(request,env);

      // Gap 5: Warehouses
      if (path==="/api/warehouses"  && method==="GET")  return handleListWarehouses(request,env);
      if (path==="/api/warehouses"  && method==="POST") return handleAddWarehouse(request,env);
      if (path.match(/^\/api\/warehouses\/[^/]+$/) && method==="PATCH") return handlePatchWarehouse(request,env,path);
      if (path==="/api/bin-locations"  && method==="GET") return handleListBins(request,env);

      // Gap 6: Approval rules
      if (path==="/api/approval-rules"                    && method==="GET")   return handleListApprovalRules(request,env);
      if (path==="/api/approval-rules"                    && method==="POST")  return handleSaveApprovalRule(request,env);
      if (path.match(/^\/api\/approval-rules\/[^/]+$/)   && method==="PATCH") return handlePatchApprovalRule(request,env,path);
      if (path.match(/^\/api\/approval-rules\/[^/]+$/)   && method==="DELETE")return handleDeleteApprovalRule(request,env,path);

      // Gap 7: Audit logs
      if (path==="/api/audit-logs"  && method==="GET") return handleListAuditLogs(request,env);

      // Gap 10: Search
      if (path==="/api/search"  && method==="GET") return handleSearch(request,env);

      // Gap 11: Settings
      if (path==="/api/settings"            && method==="GET")  return handleGetSettings(request,env);
      if (path==="/api/settings"            && method==="POST") return handleSaveSettings(request,env);

      // Gap 4: Zoho Books webhook
      if (path==="/api/integrations/zoho/webhook" && method==="POST") return handleZohoWebhook(request,env);

      // Gap 12: Reports data
      if (path.match(/^\/api\/reports\/[^/]+$/) && method==="GET") return handleReportData(request,env,path);

      // Categories
      if (path==="/api/categories"  && method==="GET") return handleListCategories(request,env);

      return json({error:"Not found"}, 404);
    } catch (err) {
      console.error(err);
      return json({error:"Internal server error"}, 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ════════════════════════════════════════════════════════════════════
// AUTH + OTP (Gap 13)
// ════════════════════════════════════════════════════════════════════

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json() as {email:string;password:string};
  if (!email || !password) return json({error:"Email and password required"}, 400);

  const row = await env.DB.prepare("SELECT * FROM users WHERE email=? AND active=1").bind(email).first() as Record<string,string>|null;
  if (!row) return json({error:"Invalid credentials"}, 401);

  let valid = false;
  const hash = row.password_hash;
  if (hash.startsWith("SEED:"))  valid = password === hash.slice(5);
  else if (hash.startsWith("hash:")) valid = await verifyPassword(password, hash.slice(5));
  if (!valid) return json({error:"Invalid credentials"}, 401);

  // If OTP enabled, issue a partial token and require OTP step
  if (env.OTP_ENABLED === "true") {
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const exp = new Date(Date.now() + parseInt(env.OTP_EXPIRY_MINUTES||"5") * 60000).toISOString();
    await env.DB.prepare("INSERT OR REPLACE INTO otp_store (email,code,expires_at,attempts) VALUES (?,?,?,0)")
      .bind(email, otp, exp).run();
    await sendEmail(env, email, "Smart Pantry OTP",
      `Your login OTP is: ${otp}\nValid for ${env.OTP_EXPIRY_MINUTES||5} minutes.`,
      `<p>Your Smart Pantry login OTP is: <b style="font-size:24px">${otp}</b></p><p>Valid for ${env.OTP_EXPIRY_MINUTES||5} minutes.</p>`);
    return json({otp_required: true, email});
  }

  return issueToken(row, env);
}

async function handleOTPSend(request: Request, env: Env): Promise<Response> {
  const { email } = await request.json() as {email:string};
  if (!email) return json({error:"Email required"}, 400);
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=? AND active=1").bind(email).first() as Record<string,string>|null;
  if (!user) return json({ok:true}); // security: don't reveal user existence

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const exp = new Date(Date.now() + parseInt(env.OTP_EXPIRY_MINUTES||"5") * 60000).toISOString();
  await env.DB.prepare("INSERT OR REPLACE INTO otp_store (email,code,expires_at,attempts) VALUES (?,?,?,0)")
    .bind(email, otp, exp).run();
  await sendEmail(env, email, "Smart Pantry OTP", `Your OTP is: ${otp}`);
  if (user.phone) await sendSMS(env, user.phone, otp);
  return json({ok:true});
}

async function handleOTPVerify(request: Request, env: Env): Promise<Response> {
  const { email, otp } = await request.json() as {email:string;otp:string};
  if (!email || !otp) return json({error:"Email and OTP required"}, 400);

  const record = await env.DB.prepare("SELECT * FROM otp_store WHERE email=?").bind(email).first() as Record<string,string|number>|null;
  if (!record) return json({error:"OTP expired or not found"}, 400);
  if (new Date(record.expires_at as string) < new Date()) {
    await env.DB.prepare("DELETE FROM otp_store WHERE email=?").bind(email).run();
    return json({error:"OTP expired"}, 400);
  }
  if ((record.attempts as number) >= 5) return json({error:"Too many attempts"}, 429);
  if (record.code !== otp) {
    await env.DB.prepare("UPDATE otp_store SET attempts=attempts+1 WHERE email=?").bind(email).run();
    return json({error:"Invalid OTP"}, 400);
  }

  await env.DB.prepare("DELETE FROM otp_store WHERE email=?").bind(email).run();
  const user = await env.DB.prepare("SELECT * FROM users WHERE email=? AND active=1").bind(email).first() as Record<string,string>|null;
  if (!user) return json({error:"User not found"}, 404);
  return issueToken(user, env);
}

async function issueToken(row: Record<string,string>, env: Env): Promise<Response> {
  const payload: JWTPayload = {
    sub: row.id, email: row.email, role: row.role,
    name: row.name, org: row.org, initials: row.initials,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400*7,
  };
  const token = await signJWT(payload, env.JWT_SECRET);
  await audit(env, payload, "LOGIN", "user", row.id);
  return json({token, user: payload});
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  if (!user) return json({error:"Unauthorized"}, 401);
  return json({user});
}

// ════════════════════════════════════════════════════════════════════
// ORDERS (Gap 9 stock reservation, Gap 15 comments)
// ════════════════════════════════════════════════════════════════════

async function handleListOrders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const clientId = url.searchParams.get("client_id");
  const q = url.searchParams.get("q");

  let query = `SELECT o.*,c.name as client_name,u.name as creator_name
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id WHERE 1=1`;
  const params: string[] = [];

  if (["client_admin","client_approver","client_user"].includes(user!.role)) {
    const domain = user!.email.split("@")[1];
    const c = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,string>|null;
    if (c) { query += " AND o.client_id=?"; params.push(c.id); }
  } else if (["vendor_admin","vendor_user"].includes(user!.role)) {
    const domain = user!.email.split("@")[1];
    query += ` AND o.id IN (SELECT DISTINCT order_id FROM purchase_orders WHERE vendor_id IN (SELECT id FROM vendors WHERE contact_email LIKE ?))`;
    params.push(`%${domain}%`);
  }

  if (status) { query += " AND o.status=?"; params.push(status); }
  if (clientId) { query += " AND o.client_id=?"; params.push(clientId); }
  if (q) { query += " AND (o.id LIKE ? OR c.name LIKE ?)"; params.push(`%${q}%`,`%${q}%`); }
  query += " ORDER BY o.created_at DESC LIMIT 100";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleGetOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").pop()!;

  const order = await env.DB.prepare(`SELECT o.*,c.name as client_name,u.name as creator_name
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id WHERE o.id=?`).bind(id).first();
  if (!order) return json({error:"Not found"}, 404);

  const [{results:items},{results:history},{results:comments}] = await Promise.all([
    env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_history WHERE order_id=? ORDER BY created_at").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_comments WHERE order_id=? ORDER BY created_at").bind(id).all(),
  ]);
  return json({...order, items, history, comments});
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as {
    client_id: string;
    items: Array<{sku:string;name:string;qty:number;unit_price:number}>;
    notes?: string;
  };
  if (!body.client_id || !body.items?.length) return json({error:"client_id and items required"}, 400);

  const id = `SP-${new Date().toISOString().slice(2,7).replace("-","")}-${Math.floor(Math.random()*9000+1000)}`;
  const subtotal = body.items.reduce((s,i)=>s+i.qty*i.unit_price, 0);
  const gst = Math.round(subtotal*0.18);
  const grand_total = subtotal+gst;

  // Gap 6: check approval rules
  const rule = await env.DB.prepare(`SELECT * FROM approval_rules WHERE active=1 AND (client_id=? OR client_id IS NULL)
    AND min_amount<=? AND (max_amount IS NULL OR max_amount>?) ORDER BY min_amount DESC LIMIT 1`)
    .bind(body.client_id, grand_total, grand_total).first() as Record<string,unknown>|null;

  let status = "SUBMITTED";
  if (rule?.auto_approve) status = "APPROVED";
  else if (grand_total > (rule?.min_amount as number || 100000)) status = "PENDING_APPROVAL";

  await env.DB.prepare(`INSERT INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(id, body.client_id, user!.sub, status, subtotal, gst, grand_total, body.notes||null).run();

  for (const item of body.items) {
    await env.DB.prepare(`INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)`)
      .bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty*item.unit_price).run();
    // Gap 9: reserve stock
    await env.DB.prepare("UPDATE inventory SET reserved=MIN(stock,reserved+?) WHERE sku=?").bind(item.qty, item.sku).run();
  }

  await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,NULL,?,?,?,?)`)
    .bind(uid(), id, status, user!.sub, user!.name, status==="PENDING_APPROVAL"?"Approval required — amount exceeds threshold":null).run();

  await pushNotification(env, "ops_admin", `New order ${id} submitted — ${status}`);
  await audit(env, user, "CREATE", "order", id, undefined, `status:${status},total:${grand_total}`);
  return json({id, status, grand_total}, 201);
}

async function handleTransitionOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {to:string;note?:string};
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!order) return json({error:"Not found"}, 404);

  const allowed = ORDER_FSM[order.status] || [];
  if (!allowed.includes(body.to)) return json({error:`Cannot transition from ${order.status} to ${body.to}`}, 400);

  await env.DB.prepare("UPDATE orders SET status=?,updated_at=datetime('now') WHERE id=?").bind(body.to, id).run();
  await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)`)
    .bind(uid(), id, order.status, body.to, user!.sub, user!.name, body.note||null).run();

  // Gap 9: release reservation on cancel
  if (body.to === "CANCELLED") {
    const {results:items} = await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all();
    for (const item of items as Record<string,unknown>[]) {
      await env.DB.prepare("UPDATE inventory SET reserved=MAX(0,reserved-?) WHERE sku=?").bind(item.qty, item.sku).run();
    }
  }

  // Auto-create DC when IN_SHIPMENT
  if (body.to === "IN_SHIPMENT") {
    await env.DB.prepare(`INSERT OR IGNORE INTO delivery_challans (id,order_id,status) VALUES (?,?,'SCHEDULED')`)
      .bind(`DC-${Math.floor(Math.random()*9000+1000)}`, id).run();
  }

  await pushNotification(env, null, `Order ${id} → ${body.to.replace(/_/g," ")}`);
  await audit(env, user, "TRANSITION", "order", id, order.status, body.to);
  return json({id, status: body.to});
}

async function handlePatchOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as {notes?:string};
  await env.DB.prepare("UPDATE orders SET notes=?,updated_at=datetime('now') WHERE id=?").bind(body.notes||null, id).run();
  return json({id});
}

// Gap 15: Order comments
async function handleListComments(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const {results} = await env.DB.prepare("SELECT * FROM order_comments WHERE order_id=? ORDER BY created_at").bind(id).all();
  return json(results);
}

async function handleAddComment(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const {message} = await request.json() as {message:string};
  if (!message?.trim()) return json({error:"Message required"}, 400);
  const cid = uid();
  await env.DB.prepare("INSERT INTO order_comments (id,order_id,author_id,author_name,message) VALUES (?,?,?,?,?)")
    .bind(cid, id, user!.sub, user!.name, message.trim()).run();
  await audit(env, user, "COMMENT", "order", id, undefined, message.slice(0,100));
  return json({id:cid}, 201);
}

// ════════════════════════════════════════════════════════════════════
// INVENTORY (Gap 8 auto-reorder on patch, Gap 9 reserved stock)
// ════════════════════════════════════════════════════════════════════

async function handleListInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const cat = url.searchParams.get("category");

  let query = "SELECT i.*,v.name as vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id WHERE i.active=1";
  const params: string[] = [];
  if (q)   { query += " AND (i.name LIKE ? OR i.sku LIKE ?)"; params.push(`%${q}%`,`%${q}%`); }
  if (cat) { query += " AND i.category=?"; params.push(cat); }
  query += " ORDER BY i.name";
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleAddInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const sku = `SKU${String(Math.floor(Math.random()*900+100)).padStart(3,"0")}`;
  await env.DB.prepare(`INSERT INTO inventory (sku,name,category,unit_price,stock,reorder_level,max_stock,vendor_id,hsn_code,gst_rate,emoji)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(sku,body.name,body.category,body.unit_price,body.stock||0,body.reorder_level||20,body.max_stock||200,
      body.vendor_id||null,body.hsn_code||"2101",body.gst_rate||18,body.emoji||"📦").run();
  await audit(env, user, "CREATE", "inventory", sku, undefined, JSON.stringify({name:body.name,stock:body.stock}));
  return json({sku}, 201);
}

async function handlePatchInventory(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const sku = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;

  const before = await env.DB.prepare("SELECT stock FROM inventory WHERE sku=?").bind(sku).first() as Record<string,number>|null;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.stock !== undefined)         { fields.push("stock=?");         vals.push(body.stock); }
  if (body.reorder_level !== undefined) { fields.push("reorder_level=?"); vals.push(body.reorder_level); }
  if (body.unit_price !== undefined)    { fields.push("unit_price=?");    vals.push(body.unit_price); }
  if (body.active !== undefined)        { fields.push("active=?");        vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(sku);
  await env.DB.prepare(`UPDATE inventory SET ${fields.join(",")} WHERE sku=?`).bind(...vals).run();
  await audit(env, user, "UPDATE", "inventory", sku, `stock:${before?.stock}`, `stock:${body.stock||before?.stock}`);

  // Gap 8: check auto-reorder after stock change
  if (body.stock !== undefined) await checkAutoReorder(env, user);
  return json({sku});
}

// ════════════════════════════════════════════════════════════════════
// VENDORS
// ════════════════════════════════════════════════════════════════════

async function handleListVendors(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM vendors WHERE active=1 ORDER BY name").all();
  return json(results);
}

async function handleAddVendor(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const id = `v${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO vendors (id,name,category,contact_email,contact_phone) VALUES (?,?,?,?,?)")
    .bind(id,body.name,body.category,body.contact_email||null,body.contact_phone||null).run();
  await sendEmail(env, body.contact_email as string, "Welcome to Smart Pantry Vendor Portal",
    `Dear ${body.name},\n\nYou have been registered as a vendor on the Smart Pantry platform.\n\nVendor ID: ${id}\n\nRegards,\n4SYZ Smart Pantry Team`);
  await audit(env, user, "CREATE", "vendor", id, undefined, body.name as string);
  return json({id}, 201);
}

// ════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ════════════════════════════════════════════════════════════════════

async function handleListPOs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);

  let query = `SELECT p.*,v.name as vendor_name FROM purchase_orders p LEFT JOIN vendors v ON p.vendor_id=v.id WHERE 1=1`;
  const params: string[] = [];
  if (["vendor_admin","vendor_user"].includes(user!.role)) {
    const domain = user!.email.split("@")[1];
    query += " AND v.contact_email LIKE ?"; params.push(`%${domain}%`);
  }
  if (url.searchParams.get("vendor_id")) { query += " AND p.vendor_id=?"; params.push(url.searchParams.get("vendor_id")!); }
  if (url.searchParams.get("status"))    { query += " AND p.status=?";    params.push(url.searchParams.get("status")!); }
  query += " ORDER BY p.created_at DESC LIMIT 50";

  const {results} = await env.DB.prepare(query).bind(...params).all();
  const withItems = await Promise.all(results.map(async (po: Record<string,unknown>) => {
    const {results:items} = await env.DB.prepare("SELECT * FROM po_items WHERE po_id=?").bind(po.id).all();
    return {...po, items};
  }));
  return json(withItems);
}

async function handleCreatePO(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as {vendor_id:string;order_id?:string;items:Array<{sku:string;name:string;qty:number;unit_price:number}>;expected_delivery?:string;notes?:string};
  if (!body.vendor_id || !body.items?.length) return json({error:"vendor_id and items required"}, 400);

  const id = `PO-${Math.floor(Math.random()*9000+1000)}`;
  const subtotal = body.items.reduce((s,i)=>s+i.qty*i.unit_price,0);
  const gst = Math.round(subtotal*0.18);
  const grand_total = subtotal+gst;

  await env.DB.prepare(`INSERT INTO purchase_orders (id,vendor_id,order_id,status,subtotal,gst,grand_total,expected_delivery,notes)
    VALUES (?,?,?,'SENT',?,?,?,?,?)`)
    .bind(id,body.vendor_id,body.order_id||null,subtotal,gst,grand_total,body.expected_delivery||null,body.notes||null).run();

  for (const item of body.items) {
    await env.DB.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind(uid(),id,item.sku,item.name,item.qty,item.unit_price,item.qty*item.unit_price).run();
  }

  if (body.order_id) {
    await env.DB.prepare("UPDATE orders SET status='VENDOR_PO_RAISED',updated_at=datetime('now') WHERE id=? AND status='INVENTORY_CHECK'").bind(body.order_id).run();
  }

  const vendor = await env.DB.prepare("SELECT * FROM vendors WHERE id=?").bind(body.vendor_id).first() as Record<string,string>|null;
  if (vendor?.contact_email) {
    await sendEmail(env, vendor.contact_email, `New Purchase Order ${id}`,
      `Dear ${vendor.name},\n\nPO ${id} has been raised for ₹${grand_total.toLocaleString("en-IN")}.\nPlease log in to the vendor portal to accept or reject.\n\nRegards,\n4SYZ Smart Pantry`);
  }
  await pushNotification(env, "vendor_admin", `New PO ${id} received — ₹${grand_total.toLocaleString("en-IN")}`);
  await audit(env, user, "CREATE", "purchase_order", id, undefined, `vendor:${body.vendor_id},total:${grand_total}`);
  return json({id, grand_total}, 201);
}

async function handlePatchPO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as {status?:string;invoice_url?:string};
  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!po) return json({error:"Not found"}, 404);

  const updates = ["updated_at=datetime('now')"];
  const vals: unknown[] = [];
  if (body.status)      { updates.push("status=?");      vals.push(body.status); }
  if (body.invoice_url) { updates.push("invoice_url=?"); vals.push(body.invoice_url); }
  vals.push(id);
  await env.DB.prepare(`UPDATE purchase_orders SET ${updates.join(",")} WHERE id=?`).bind(...vals).run();

  if (body.status === "ACCEPTED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status='READY_TO_PICK',updated_at=datetime('now') WHERE id=? AND status='VENDOR_PO_RAISED'").bind(po.order_id).run();
  }
  if (body.status === "DISPATCHED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status='IN_SHIPMENT',updated_at=datetime('now') WHERE id=? AND status IN ('READY_TO_PICK','VENDOR_PO_RAISED')").bind(po.order_id).run();
    await env.DB.prepare("UPDATE delivery_challans SET status='IN_TRANSIT',dispatched_at=datetime('now') WHERE order_id=?").bind(po.order_id).run();
  }
  if (body.status === "INVOICED" && po.order_id) {
    // Gap 4: sync to Zoho Books
    const order = await env.DB.prepare("SELECT o.*,c.name as client_name FROM orders o JOIN clients c ON o.client_id=c.id WHERE o.id=?").bind(po.order_id).first() as Record<string,unknown>|null;
    if (order) await syncToZohoBooks(env, {id: id, clientName: order.client_name as string, amount: po.grand_total as unknown as number, date: new Date().toISOString().slice(0,10)});
  }

  await audit(env, user, "UPDATE", "purchase_order", id, po.status, body.status||po.status);
  return json({id, status: body.status});
}

// ════════════════════════════════════════════════════════════════════
// DELIVERY CHALLANS (Gap 14: partial delivery)
// ════════════════════════════════════════════════════════════════════

async function handleListDCs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`SELECT dc.*,o.client_id,c.name as client_name,o.grand_total as order_value
    FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
    ORDER BY dc.dispatched_at DESC`).all();
  return json(results);
}

async function handleBillDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET billed=1,billed_at=datetime('now') WHERE id=?").bind(id).run();
  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (dc?.order_id) {
    await env.DB.prepare("UPDATE orders SET status='CLOSED',updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").bind(dc.order_id).run();
    // Gap 9: release any remaining reservations
    const {results:items} = await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(dc.order_id).all();
    for (const item of items as Record<string,unknown>[]) {
      await env.DB.prepare("UPDATE inventory SET reserved=MAX(0,reserved-?) WHERE sku=?").bind(item.qty, item.sku).run();
    }
  }
  await audit(env, user, "BILL", "delivery_challan", id);
  return json({id, billed:true});
}

async function handleDeliverDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET status='DELIVERED',delivered_at=datetime('now') WHERE id=?").bind(id).run();
  await pushNotification(env, "client_admin", `Delivery ${id} marked as delivered`);
  await audit(env, user, "DELIVER", "delivery_challan", id);
  return json({id, status:"DELIVERED"});
}

// Gap 14: Partial delivery
async function handlePartialDelivery(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const {delivered_qty, total_qty, notes} = await request.json() as {delivered_qty:number;total_qty:number;notes?:string};

  await env.DB.prepare("UPDATE delivery_challans SET status='DELIVERED',delivered_qty=?,total_qty=?,delivered_at=datetime('now') WHERE id=?")
    .bind(delivered_qty, total_qty, id).run();

  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (dc?.order_id && delivered_qty < total_qty) {
    await env.DB.prepare("UPDATE orders SET status='PARTIALLY_CLOSED',updated_at=datetime('now') WHERE id=? AND status='IN_SHIPMENT'").bind(dc.order_id).run();
    // Create a new DC for remaining
    const remaining = total_qty - delivered_qty;
    const newDCId = `DC-${Math.floor(Math.random()*9000+1000)}`;
    await env.DB.prepare("INSERT INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,'SCHEDULED',?)").bind(newDCId, dc.order_id, remaining).run();
    await pushNotification(env, "ops_admin", `Partial delivery for DC ${id} — ${remaining} units pending. New DC ${newDCId} created.`);
  }
  await audit(env, user, "PARTIAL_DELIVERY", "delivery_challan", id, undefined, `delivered:${delivered_qty}/${total_qty}`);
  return json({id, delivered_qty, total_qty});
}

// ════════════════════════════════════════════════════════════════════
// CLIENTS
// ════════════════════════════════════════════════════════════════════

async function handleListClients(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM clients WHERE active=1 ORDER BY name").all();
  return json(results);
}

async function handleAddClient(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const id = `c${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO clients (id,name,contact_email,contact_name,monthly_budget,approval_threshold) VALUES (?,?,?,?,?,?)")
    .bind(id,body.name,body.contact_email||null,body.contact_name||null,body.monthly_budget||500000,body.approval_threshold||100000).run();
  await audit(env, user, "CREATE", "client", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handlePatchClient(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.monthly_budget !== undefined)    { fields.push("monthly_budget=?");    vals.push(body.monthly_budget); }
  if (body.approval_threshold !== undefined){ fields.push("approval_threshold=?"); vals.push(body.approval_threshold); }
  if (body.health_score !== undefined)      { fields.push("health_score=?");       vals.push(body.health_score); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE clients SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// TICKETS
// ════════════════════════════════════════════════════════════════════

async function handleListTickets(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`SELECT t.*,c.name as client_name,u.name as raiser_name
    FROM tickets t LEFT JOIN clients c ON t.client_id=c.id LEFT JOIN users u ON t.raised_by=u.id
    ORDER BY t.created_at DESC`).all();
  return json(results);
}

async function handleCreateTicket(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,string>;
  const id = `TKT-${String(Math.floor(Math.random()*900+100)).padStart(3,"0")}`;
  let clientId = body.client_id;
  if (!clientId) {
    const domain = user!.email.split("@")[1];
    const c = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,string>|null;
    clientId = c?.id || "c1";
  }
  await env.DB.prepare("INSERT INTO tickets (id,client_id,raised_by,subject,description,priority,status) VALUES (?,?,?,?,?,?,'OPEN')")
    .bind(id,clientId,user!.sub,body.subject,body.description||null,body.priority||"MEDIUM").run();
  await pushNotification(env, "ops_admin", `New support ticket ${id}: ${body.subject}`);
  await audit(env, user, "CREATE", "ticket", id, undefined, body.subject);
  return json({id}, 201);
}

async function handlePatchTicket(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as {status?:string;priority?:string};
  const updates: string[] = [];
  const vals: unknown[] = [];
  if (body.status) {
    updates.push("status=?"); vals.push(body.status);
    if (body.status==="RESOLVED") updates.push("resolved_at=datetime('now')");
  }
  if (body.priority) { updates.push("priority=?"); vals.push(body.priority); }
  if (!updates.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE tickets SET ${updates.join(",")} WHERE id=?`).bind(...vals).run();
  await audit(env, user, "UPDATE", "ticket", id, undefined, JSON.stringify(body));
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════

async function handleListUsers(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT id,email,role,name,org,initials,active,created_at FROM users ORDER BY name").all();
  return json(results);
}

async function handleCreateUser(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (user!.role !== "super_admin") return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,string>;
  const id = `u${uid().slice(0,6)}`;
  const ph = `hash:${await hashPassword(body.password||"password")}`;
  const initials = body.name.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase();
  await env.DB.prepare("INSERT INTO users (id,email,password_hash,role,name,org,initials) VALUES (?,?,?,?,?,?,?)")
    .bind(id,body.email,ph,body.role,body.name,body.org||"4SYZ Platform",initials).run();
  await sendEmail(env, body.email, "Welcome to Smart Pantry",
    `Dear ${body.name},\n\nYour Smart Pantry account has been created.\n\nEmail: ${body.email}\nTemporary Password: ${body.password||"password"}\n\nPlease log in and change your password immediately.\n\nRegards,\n4SYZ Platform`);
  await audit(env, user, "CREATE", "user", id, undefined, `email:${body.email},role:${body.role}`);
  return json({id}, 201);
}

async function handlePatchUser(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (user!.role !== "super_admin") return json({error:"Forbidden"}, 403);
  const id = path.split("/").pop()!;
  const body = await request.json() as {active?:number;role?:string;password?:string};
  const updates: string[] = [];
  const vals: unknown[] = [];
  if (body.active !== undefined) { updates.push("active=?"); vals.push(body.active); }
  if (body.role)     { updates.push("role=?");          vals.push(body.role); }
  if (body.password) { updates.push("password_hash=?"); vals.push(`hash:${await hashPassword(body.password)}`); }
  if (!updates.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE users SET ${updates.join(",")} WHERE id=?`).bind(...vals).run();
  await audit(env, user, "UPDATE", "user", id, undefined, JSON.stringify({active:body.active,role:body.role}));
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════

async function handleListNotifications(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM notifications WHERE user_role IS NULL OR user_role=? ORDER BY created_at DESC LIMIT 20")
    .bind(user!.role).all();
  return json(results);
}

async function handleReadAllNotifications(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  await env.DB.prepare("UPDATE notifications SET read_flag=1 WHERE user_role IS NULL OR user_role=?").bind(user!.role).run();
  return json({ok:true});
}

// ════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const role = user!.role;

  if (["client_admin","client_approver","client_user"].includes(role)) {
    const domain = user!.email.split("@")[1];
    const client = await env.DB.prepare("SELECT * FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,unknown>|null;
    const cid = client?.id || "c1";
    const [{results:recentOrders}, spend, pendingApproval] = await Promise.all([
      env.DB.prepare("SELECT id,status,grand_total,created_at FROM orders WHERE client_id=? ORDER BY created_at DESC LIMIT 5").bind(cid).all(),
      env.DB.prepare("SELECT SUM(grand_total) as total FROM orders WHERE client_id=? AND status NOT IN ('CANCELLED','DRAFT')").bind(cid).first() as Promise<Record<string,number>|null>,
      env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE client_id=? AND status='PENDING_APPROVAL'").bind(cid).first() as Promise<Record<string,number>|null>,
    ]);
    return json({client, recentOrders, totalSpend:(spend as Record<string,number>|null)?.total||0, pendingApproval:(pendingApproval as Record<string,number>|null)?.cnt||0});
  }

  if (["vendor_admin","vendor_user"].includes(role)) {
    const domain = user!.email.split("@")[1];
    const [vendor, {results:pendingPOs}] = await Promise.all([
      env.DB.prepare("SELECT * FROM vendors WHERE contact_email LIKE ?").bind(`%${domain}%`).first(),
      env.DB.prepare(`SELECT p.*,v.name as vendor_name FROM purchase_orders p JOIN vendors v ON p.vendor_id=v.id
        WHERE v.contact_email LIKE ? AND p.status IN ('SENT','ACCEPTED') ORDER BY p.created_at DESC`).bind(`%${domain}%`).all(),
    ]);
    return json({vendor, pendingPOs});
  }

  const [totalOrders, pendingOrders, lowStock, pendingDCBilling, openTickets, {results:recentOrders}, {results:ordersByStatus}, {results:topClients}] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status NOT IN ('CLOSED','CANCELLED')").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM inventory WHERE stock<=reorder_level AND active=1").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM delivery_challans WHERE status='DELIVERED' AND billed=0").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status!='RESOLVED'").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT o.id,o.status,o.grand_total,o.created_at,c.name as client_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id ORDER BY o.created_at DESC LIMIT 8").all(),
    env.DB.prepare("SELECT status,COUNT(*) as cnt FROM orders GROUP BY status").all(),
    env.DB.prepare("SELECT c.name,SUM(o.grand_total) as total,COUNT(o.id) as order_count FROM orders o JOIN clients c ON o.client_id=c.id WHERE o.status NOT IN ('CANCELLED') GROUP BY c.id ORDER BY total DESC LIMIT 5").all(),
  ]);

  return json({
    totalOrders: (totalOrders as Record<string,number>).cnt, pendingOrders: (pendingOrders as Record<string,number>).cnt,
    lowStock: (lowStock as Record<string,number>).cnt, pendingDCBilling: (pendingDCBilling as Record<string,number>).cnt,
    openTickets: (openTickets as Record<string,number>).cnt,
    recentOrders, ordersByStatus, topClients,
  });
}

// ════════════════════════════════════════════════════════════════════
// GRN (Gap 8 triggers auto-reorder)
// ════════════════════════════════════════════════════════════════════

async function handleListGRN(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`SELECT g.*,p.vendor_id,v.name as vendor_name,u.name as receiver_name
    FROM grn_records g LEFT JOIN purchase_orders p ON g.po_id=p.id LEFT JOIN vendors v ON p.vendor_id=v.id
    LEFT JOIN users u ON g.received_by=u.id ORDER BY g.received_at DESC LIMIT 20`).all();
  return json(results);
}

async function handleCreateGRN(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as {po_id:string;qty_received:number;notes?:string};
  const id = `GRN-${Math.floor(Math.random()*9000+1000)}`;

  await env.DB.prepare("INSERT INTO grn_records (id,po_id,received_by,qty_received,notes) VALUES (?,?,?,?,?)")
    .bind(id, body.po_id, user!.sub, body.qty_received||0, body.notes||null).run();
  await env.DB.prepare("UPDATE purchase_orders SET status='RECEIVED',updated_at=datetime('now') WHERE id=?").bind(body.po_id).run();

  // Update inventory stock from PO items
  const {results:poItems} = await env.DB.prepare("SELECT * FROM po_items WHERE po_id=?").bind(body.po_id).all();
  for (const item of poItems as Record<string,unknown>[]) {
    await env.DB.prepare("UPDATE inventory SET stock=stock+? WHERE sku=?").bind(item.qty, item.sku).run();
  }

  // Gap 8: run auto-reorder check after stock increase
  await checkAutoReorder(env, user);
  await audit(env, user, "CREATE", "grn", id, undefined, `po:${body.po_id},qty:${body.qty_received}`);
  return json({id}, 201);
}

// ════════════════════════════════════════════════════════════════════
// Gap 5: WAREHOUSES
// ════════════════════════════════════════════════════════════════════

async function handleListWarehouses(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT w.*,(SELECT COUNT(*) FROM bin_locations WHERE warehouse_id=w.id) as bin_count FROM warehouses w WHERE w.active=1 ORDER BY w.name").all();
  return json(results);
}

async function handleAddWarehouse(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const id = `wh${uid().slice(0,4)}`;
  await env.DB.prepare("INSERT INTO warehouses (id,name,city,address,capacity) VALUES (?,?,?,?,?)")
    .bind(id,body.name,body.city||null,body.address||null,body.capacity||1000).run();
  await audit(env, user, "CREATE", "warehouse", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handlePatchWarehouse(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.name)     { fields.push("name=?");     vals.push(body.name); }
  if (body.capacity) { fields.push("capacity=?"); vals.push(body.capacity); }
  if (body.active !== undefined) { fields.push("active=?"); vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE warehouses SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

async function handleListBins(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const warehouseId = url.searchParams.get("warehouse_id");
  let query = "SELECT b.*,w.name as warehouse_name FROM bin_locations b LEFT JOIN warehouses w ON b.warehouse_id=w.id WHERE 1=1";
  const params: string[] = [];
  if (warehouseId) { query += " AND b.warehouse_id=?"; params.push(warehouseId); }
  query += " ORDER BY b.code";
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════
// Gap 6: APPROVAL RULES
// ════════════════════════════════════════════════════════════════════

async function handleListApprovalRules(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`SELECT r.*,c.name as client_name FROM approval_rules r LEFT JOIN clients c ON r.client_id=c.id WHERE r.active=1 ORDER BY r.min_amount`).all();
  return json(results);
}

async function handleSaveApprovalRule(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  const id = `ar${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO approval_rules (id,client_id,category,min_amount,max_amount,approver_role,auto_approve) VALUES (?,?,?,?,?,?,?)")
    .bind(id,body.client_id||null,body.category||null,body.min_amount||0,body.max_amount||null,body.approver_role||"client_approver",body.auto_approve?1:0).run();
  await audit(env, user, "CREATE", "approval_rule", id, undefined, JSON.stringify(body));
  return json({id}, 201);
}

async function handlePatchApprovalRule(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.min_amount !== undefined)  { fields.push("min_amount=?");  vals.push(body.min_amount); }
  if (body.max_amount !== undefined)  { fields.push("max_amount=?");  vals.push(body.max_amount); }
  if (body.auto_approve !== undefined){ fields.push("auto_approve=?"); vals.push(body.auto_approve?1:0); }
  if (body.approver_role)             { fields.push("approver_role=?"); vals.push(body.approver_role); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE approval_rules SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

async function handleDeleteApprovalRule(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  await env.DB.prepare("UPDATE approval_rules SET active=0 WHERE id=?").bind(id).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// Gap 7: AUDIT LOGS
// ════════════════════════════════════════════════════════════════════

async function handleListAuditLogs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","finance_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const url = new URL(request.url);
  const entity = url.searchParams.get("entity_type");
  const entityId = url.searchParams.get("entity_id");
  let query = "SELECT * FROM audit_logs WHERE 1=1";
  const params: string[] = [];
  if (entity)   { query += " AND entity_type=?"; params.push(entity); }
  if (entityId) { query += " AND entity_id=?";   params.push(entityId); }
  query += " ORDER BY created_at DESC LIMIT 100";
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════
// Gap 10: GLOBAL SEARCH
// ════════════════════════════════════════════════════════════════════

async function handleSearch(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return json({results:[]});

  const like = `%${q}%`;
  const [
    {results:orders}, {results:inventory}, {results:vendors},
    {results:clients}, {results:tickets}
  ] = await Promise.all([
    env.DB.prepare("SELECT id,'order' as type,id as title,status as subtitle FROM orders WHERE id LIKE ? OR status LIKE ? LIMIT 5").bind(like,like).all(),
    env.DB.prepare("SELECT sku as id,'inventory' as type,name as title,category as subtitle FROM inventory WHERE name LIKE ? OR sku LIKE ? LIMIT 5").bind(like,like).all(),
    env.DB.prepare("SELECT id,'vendor' as type,name as title,category as subtitle FROM vendors WHERE name LIKE ? OR category LIKE ? LIMIT 5").bind(like,like).all(),
    env.DB.prepare("SELECT id,'client' as type,name as title,contact_email as subtitle FROM clients WHERE name LIKE ? OR contact_email LIKE ? LIMIT 5").bind(like,like).all(),
    env.DB.prepare("SELECT id,'ticket' as type,subject as title,status as subtitle FROM tickets WHERE subject LIKE ? OR id LIKE ? LIMIT 5").bind(like,like).all(),
  ]);

  return json({results:[...orders,...inventory,...vendors,...clients,...tickets]});
}

// ════════════════════════════════════════════════════════════════════
// Gap 11: SETTINGS
// ════════════════════════════════════════════════════════════════════

async function handleGetSettings(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  // Return current config (from env vars + DB)
  const clients = await env.DB.prepare("SELECT id,name,monthly_budget,approval_threshold FROM clients WHERE active=1").all();
  const rules = await env.DB.prepare("SELECT * FROM approval_rules WHERE active=1 ORDER BY min_amount").all();
  const warehouses = await env.DB.prepare("SELECT * FROM warehouses WHERE active=1").all();

  return json({
    otp_enabled: env.OTP_ENABLED === "true",
    mailchannels_enabled: env.MAILCHANNELS_ENABLED === "true",
    zoho_configured: !!(env.ZOHO_BOOKS_ORG_ID && env.ZOHO_BOOKS_CLIENT_ID),
    twilio_configured: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
    msg91_configured: !!env.MSG91_AUTH_KEY,
    clients: clients.results,
    approval_rules: rules.results,
    warehouses: warehouses.results,
  });
}

async function handleSaveSettings(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (user!.role !== "super_admin") return json({error:"Forbidden"}, 403);

  // Settings that go into DB (env vars require re-deploy, handled via wrangler.jsonc)
  const body = await request.json() as Record<string,unknown>;

  if (body.client_budgets && Array.isArray(body.client_budgets)) {
    for (const cb of body.client_budgets as Array<{id:string;monthly_budget:number;approval_threshold:number}>) {
      await env.DB.prepare("UPDATE clients SET monthly_budget=?,approval_threshold=? WHERE id=?")
        .bind(cb.monthly_budget, cb.approval_threshold, cb.id).run();
    }
  }
  await audit(env, user, "UPDATE", "settings", "global", undefined, JSON.stringify(Object.keys(body)));
  return json({ok:true, message:"Settings saved. Env var changes require a re-deploy."});
}

// ════════════════════════════════════════════════════════════════════
// Gap 4: ZOHO BOOKS WEBHOOK
// ════════════════════════════════════════════════════════════════════

async function handleZohoWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Zoho-Webhook-Secret");
  if (env.ZOHO_BOOKS_WEBHOOK_SECRET && secret !== env.ZOHO_BOOKS_WEBHOOK_SECRET) {
    return json({error:"Invalid webhook secret"}, 401);
  }
  const body = await request.json() as Record<string,unknown>;
  const event = body.event_type as string;

  if (event === "invoice.payment_received") {
    const invoiceId = (body.data as Record<string,string>)?.invoice_number;
    if (invoiceId) {
      await env.DB.prepare("UPDATE purchase_orders SET status='PAID',updated_at=datetime('now') WHERE id=?").bind(invoiceId).run();
      await pushNotification(env, "finance_admin", `Payment received for invoice ${invoiceId} via Zoho Books`);
      await audit(env, null, "ZOHO_PAYMENT", "purchase_order", invoiceId, "INVOICED", "PAID");
    }
  }
  return json({ok:true});
}

// ════════════════════════════════════════════════════════════════════
// Gap 12: REPORT DATA
// ════════════════════════════════════════════════════════════════════

async function handleReportData(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const type = path.split("/").pop()!;
  const url = new URL(request.url);
  const from = url.searchParams.get("from") || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get("to")   || new Date().toISOString().slice(0,10);

  switch (type) {
    case "spend": {
      const {results} = await env.DB.prepare(`SELECT c.name as client, strftime('%Y-%m',o.created_at) as month,
        SUM(o.grand_total) as total FROM orders o JOIN clients c ON o.client_id=c.id
        WHERE o.created_at>=? AND o.created_at<=? AND o.status NOT IN ('CANCELLED')
        GROUP BY c.id,month ORDER BY month DESC`).bind(from,to).all();
      return json({type,from,to,data:results});
    }
    case "fulfilment": {
      const {results} = await env.DB.prepare(`SELECT o.id,o.status,o.created_at,dc.delivered_at,
        ROUND((julianday(dc.delivered_at)-julianday(o.created_at)),1) as days_to_deliver
        FROM orders o LEFT JOIN delivery_challans dc ON o.id=dc.order_id
        WHERE o.created_at>=? AND o.status NOT IN ('CANCELLED')
        ORDER BY o.created_at DESC LIMIT 100`).bind(from).all();
      return json({type,from,to,data:results});
    }
    case "vendor": {
      const {results} = await env.DB.prepare(`SELECT v.name,v.on_time_rate,v.fill_rate,v.avg_lead_days,
        COUNT(p.id) as total_pos, SUM(p.grand_total) as total_value
        FROM vendors v LEFT JOIN purchase_orders p ON v.id=p.vendor_id
        WHERE (p.created_at>=? OR p.created_at IS NULL)
        GROUP BY v.id ORDER BY v.name`).bind(from).all();
      return json({type,from,to,data:results});
    }
    case "inventory": {
      const {results} = await env.DB.prepare(`SELECT sku,name,category,stock,reorder_level,max_stock,
        ROUND(stock*100.0/max_stock,1) as utilisation_pct,
        CASE WHEN stock<=reorder_level THEN 'LOW' WHEN stock<=reorder_level*1.5 THEN 'MEDIUM' ELSE 'OK' END as stock_health
        FROM inventory WHERE active=1 ORDER BY utilisation_pct ASC`).all();
      return json({type,from,to,data:results});
    }
    case "budget": {
      const {results} = await env.DB.prepare(`SELECT c.name,c.monthly_budget,c.spent_this_month,
        ROUND(c.spent_this_month*100.0/c.monthly_budget,1) as utilisation_pct,
        c.approval_threshold FROM clients WHERE c.active=1 ORDER BY utilisation_pct DESC`).all();
      return json({type,from,to,data:results});
    }
    case "dc-billing": {
      const {results} = await env.DB.prepare(`SELECT dc.id,dc.status,dc.billed,dc.dispatched_at,dc.billed_at,
        ROUND(julianday(COALESCE(dc.billed_at,datetime('now')))-julianday(dc.dispatched_at),0) as days_outstanding,
        c.name as client_name, o.grand_total as order_value
        FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
        ORDER BY days_outstanding DESC`).all();
      return json({type,from,to,data:results});
    }
    case "service-desk": {
      const {results} = await env.DB.prepare(`SELECT t.id,t.subject,t.priority,t.status,t.created_at,t.resolved_at,
        c.name as client_name,
        ROUND(julianday(COALESCE(t.resolved_at,datetime('now')))-julianday(t.created_at),1) as resolution_days
        FROM tickets t LEFT JOIN clients c ON t.client_id=c.id ORDER BY t.created_at DESC`).all();
      return json({type,from,to,data:results});
    }
    case "gst": {
      const {results} = await env.DB.prepare(`SELECT i.hsn_code,i.name,i.gst_rate,
        SUM(oi.qty) as total_qty, SUM(oi.total) as subtotal,
        ROUND(SUM(oi.total)*i.gst_rate/100,2) as gst_amount
        FROM order_items oi JOIN inventory i ON oi.sku=i.sku
        JOIN orders o ON oi.order_id=o.id
        WHERE o.created_at>=? AND o.status NOT IN ('CANCELLED')
        GROUP BY i.hsn_code,i.name ORDER BY gst_amount DESC`).bind(from).all();
      return json({type,from,to,data:results});
    }
    default: return json({error:"Unknown report type"}, 400);
  }
}

// ════════════════════════════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════════════════════════════

async function handleListCategories(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT DISTINCT category FROM inventory WHERE active=1 ORDER BY category").all();
  return json(results.map((r: Record<string,unknown>)=>r.category));
}
