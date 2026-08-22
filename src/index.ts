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

// Defense-in-depth response headers applied to every response (API + static assets).
// The CSP allowlists the two CDNs the shell actually loads (Google Fonts, Chart.js).
// script-src is now strict — no 'unsafe-inline' — because every inline event handler
// and inline <script> has been removed in favour of event delegation, so injected
// markup cannot execute script. style-src keeps 'unsafe-inline' (the UI relies on
// inline style attributes, which cannot run JS).
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "media-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  // camera=(self) enables the in-app barcode scanner (scan-to-pick / scan-to-receive)
  // for our own origin only; geolocation and microphone stay fully disabled.
  h.set("Permissions-Policy", "geolocation=(), microphone=(), camera=(self)");
  h.set("Content-Security-Policy", CSP);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
function uid(): string { return crypto.randomUUID().replace(/-/g,"").slice(0,16); }

// The dev/test default that ships in wrangler.jsonc. Production MUST override
// JWT_SECRET with a real secret (`wrangler secret put JWT_SECRET`); a secret of
// the same name takes precedence over the plain var at runtime.
const DEV_JWT_SECRET = "smart-pantry-dev-secret-change-in-prod";
function isProd(env: Env): boolean { return String(env.APP_ENV || "").toLowerCase() === "production"; }
// A missing, default, or too-short signing key means anyone can forge a token
// for any user/role. In production we refuse to serve rather than run weak.
function insecureSecret(env: Env): boolean {
  const s = env.JWT_SECRET || "";
  return !s || s === DEV_JWT_SECRET || s.length < 32;
}

async function getUser(req: Request, env: Env): Promise<JWTPayload | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  return verifyJWT(auth.slice(7), env.JWT_SECRET);
}
function requireUser(u: JWTPayload | null): Response | null {
  return u ? null : json({error:"Unauthorized"}, 401);
}

// Client- and vendor-side roles — never the internal 4SYZ ops surfaces.
const EXTERNAL_ROLES = ["client_admin","client_approver","client_user","vendor_admin","vendor_user"];
function isExternalRole(role: string): boolean { return EXTERNAL_ROLES.includes(role); }

// Roles that may approve/reject a purchase order held for approval (G8).
const PO_APPROVER_ROLES = ["super_admin","ops_admin","procurement_manager","finance_admin"];
// Product Intelligence reviewers — fitment sign-off sits with Super Admin + Ops.
const PI_ROLES = ["super_admin","ops_admin","ops_manager"];
const CLIENT_ROLES = ["client_admin","client_user","client_approver"];

// ── Order-to-delivery authorization helpers ─────────────────────────────────
// 4SYZ staff = anyone who is NOT an external client/vendor account.
function isInternalRole(role: string): boolean { return !isExternalRole(role); }
// Who may move an order into APPROVED (segregation of duties — a plain
// client_user who raised the order cannot self-approve it).
const ORDER_APPROVER_ROLES = ["super_admin","ops_admin","ops_manager","client_admin","client_approver"];
// Operational states only 4SYZ staff may drive an order into.
const FULFILLMENT_STATES = new Set(["ACKNOWLEDGED","INVENTORY_CHECK","VENDOR_PO_RAISED","READY_TO_PICK","PICKED","QUALITY_CHECK","IN_SHIPMENT","PARTIALLY_CLOSED","CLOSED"]);
// 403 unless the caller may act on this order: staff act on any; an external
// user only on their own client's order. `order` must carry client_id.
function orderScopeDenied(user: JWTPayload, order: { client_id?: unknown }): Response | null {
  if (isExternalRole(user.role) && (!user.client_id || String(order.client_id) !== String(user.client_id)))
    return json({ error: "Forbidden" }, 403);
  return null;
}
// 403 unless the caller is internal 4SYZ staff (fulfillment / procurement).
function requireInternal(user: JWTPayload): Response | null {
  return isExternalRole(user.role) ? json({ error: "Forbidden — 4SYZ staff only" }, 403) : null;
}
// 403 unless the caller may act for this client id: staff → any; an external
// user → only their own client. Guards /api/clients/:id/* against cross-tenant reads.
function clientScopeDenied(user: JWTPayload, clientId: string): Response | null {
  if (isExternalRole(user.role) && String(user.client_id || "") !== String(clientId))
    return json({ error: "Forbidden" }, 403);
  return null;
}

// Defence in depth: back-office surfaces denied to external client/vendor
// accounts centrally, before routing. [method ("*"=any), path-regex]. None of
// these is reachable from the client/vendor UI (verified against the frontend),
// so blocking them server-side closes the "external hits an admin endpoint"
// class in one place, on top of per-handler role checks.
const STAFF_ONLY_API: Array<[string, RegExp]> = [
  ["*", /^\/api\/users(\/|$)/], ["*", /^\/api\/staff(\/|$)/],
  ["*", /^\/api\/audit-logs$/], ["*", /^\/api\/integrations\//],
  ["*", /^\/api\/import(\/|-jobs)/], ["*", /^\/api\/approval-rules(\/|$)/],
  ["*", /^\/api\/approval-chains(\/|$)/], ["*", /^\/api\/approval-chain-instances(\/|$)/],
  ["*", /^\/api\/sla-rules(\/|$)/], ["*", /^\/api\/sla-breaches$/], ["*", /^\/api\/sla\/check$/],
  ["*", /^\/api\/dunning/], ["*", /^\/api\/warehouses(\/|$)/],
  ["*", /^\/api\/bin-locations(\/|$)/], ["*", /^\/api\/stock-transfers$/],
  ["*", /^\/api\/stock-movements$/], ["*", /^\/api\/porter-expenses(\/|$)/],
  ["*", /^\/api\/delivery-routes(\/|$)/], ["*", /^\/api\/po-templates(\/|$)/],
  ["*", /^\/api\/po-approval-threshold$/], ["*", /^\/api\/sourcing\//],
  ["POST", /^\/api\/hsn-gst-rates$/],
  ["POST", /^\/api\/settings$/],
  ["POST", /^\/api\/zones(\/|$)/], ["DELETE", /^\/api\/zones(\/|$)/],
];
// The only /api/reports/* keys a client may call — each self-scopes to the
// caller's own client_id. Every other report is internal analytics (all-client
// / all-vendor) and is denied to external accounts by the central guard.
const CLIENT_SAFE_REPORTS = new Set([
  "exec-summary", "drill", "sku-challans", "order-fulfilment-monthly",
  "client-fulfilment", "client-consumption", "client-spend",
]);
function staffOnlyApiMatch(method: string, path: string): boolean {
  if (/^\/api\/reports\//.test(path)) {
    const key = path.split("/")[3] || "";
    return !CLIENT_SAFE_REPORTS.has(key); // all reports staff-only except the client-safe set
  }
  return STAFF_ONLY_API.some(([m, re]) => (m === "*" || m === method) && re.test(path));
}
// External viewers may only touch a delivery challan tied to their own client's
// order. Resolves DC → order → client_id, then applies the client scope.
async function dcScopeDenied(env: Env, user: JWTPayload, dcId: string): Promise<Response | null> {
  if (!isExternalRole(user.role)) return null; // staff: any
  const row = await env.DB.prepare(
    "SELECT o.client_id AS client_id FROM delivery_challans d LEFT JOIN orders o ON d.order_id=o.id WHERE d.id=?"
  ).bind(dcId).first() as { client_id?: unknown } | null;
  if (!row) return json({ error: "Not found" }, 404);
  return clientScopeDenied(user, String(row.client_id || ""));
}
// A vendor user is scoped to vendors whose contact email shares their domain
// (the app's vendor↔PO linkage). Staff pass; clients are denied vendor data.
function vendorEmailDomain(user: JWTPayload): string { return String(user.email || "").split("@")[1] || "\0"; }

// G9: return a reason a PO must not be raised to this vendor, or null if clear.
async function vendorComplianceIssue(env: Env, vendorId: string): Promise<string | null> {
  const v = await env.DB.prepare("SELECT active,onboarding_status,fssai_expiry,fssai_licence,vendor_type FROM vendors WHERE id=?").bind(vendorId).first() as Record<string,unknown> | null;
  if (!v) return "Vendor not found";
  if (Number(v.active) === 0) return "vendor is inactive";
  if (v.onboarding_status && v.onboarding_status !== "active") return `vendor onboarding is ${v.onboarding_status}`;
  const today = new Date().toISOString().slice(0,10);
  if (v.fssai_expiry && String(v.fssai_expiry) < today) return `FSSAI licence expired on ${v.fssai_expiry}`;
  if (v.vendor_type === "food" && !v.fssai_licence) return "food vendor has no FSSAI licence on file";
  return null;
}

// G8: POs at or above this value are held in PENDING_APPROVAL before going to
// the vendor. Configurable via app_config; 0 disables the gate.
async function poApprovalThreshold(env: Env): Promise<number> {
  return Number(await getConfig(env, "po_approval_threshold", "50000")) || 0;
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

// ── App config (DB key/value — toggles that must not require a redeploy) ──
async function getConfig(env: Env, key: string, dflt = ""): Promise<string> {
  try {
    const row = await env.DB.prepare("SELECT value FROM app_config WHERE key=?").bind(key).first() as {value:string}|null;
    return row?.value ?? dflt;
  } catch { return dflt; }
}
async function setConfig(env: Env, key: string, value: string, actor?: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO app_config (key,value,updated_by) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now'), updated_by=excluded.updated_by"
  ).bind(key, value, actor ?? null).run();
}

// GST slab for an HSN code, from the hsn_gst_rates map. Tries the exact code
// then falls back to shorter headings (8→6→4→2 digits), since GST is usually
// set at chapter/heading level. Returns null when nothing matches.
async function gstRateForHsn(env: Env, hsn: string | null | undefined): Promise<number | null> {
  const code = String(hsn || "").replace(/\D/g, "");
  if (!code) return null;
  const tries = [code];
  for (const n of [8, 6, 4, 2]) if (code.length > n) tries.push(code.slice(0, n));
  for (const t of tries) {
    try {
      const row = await env.DB.prepare("SELECT gst_rate FROM hsn_gst_rates WHERE hsn=?").bind(t).first() as { gst_rate: number } | null;
      if (row && row.gst_rate != null) return Number(row.gst_rate);
    } catch { return null; }
  }
  return null;
}

// G12: gap-free, sequential PO numbers (e.g. PO-00042) from an app_config
// counter — replaces the old collision-prone PO-<random> ids.
async function nextPONumber(env: Env): Promise<string> {
  await env.DB.prepare("INSERT INTO app_config (key,value) VALUES ('po_seq','0') ON CONFLICT(key) DO NOTHING").run();
  await env.DB.prepare("UPDATE app_config SET value = CAST(value AS INTEGER)+1, updated_at=datetime('now') WHERE key='po_seq'").run();
  const row = await env.DB.prepare("SELECT value FROM app_config WHERE key='po_seq'").first() as {value:string}|null;
  const n = Number(row?.value) || 1;
  return `PO-${String(n).padStart(5, "0")}`;
}

// ── Zoho Inventory sync (Gap 4b) ──────────────────────────────────────
// Push our stock levels to Zoho Inventory ("Sync now"), and accept Zoho's
// stock updates back via a webhook. Real API calls fire when an OAuth access
// token is configured; otherwise the push is simulated so the whole flow —
// toggle, sync, log, webhook — is exercisable before credentials are wired in.
function zohoInvConfigured(env: Env): boolean {
  return !!((env.ZOHO_INVENTORY_ORG_ID || env.ZOHO_BOOKS_ORG_ID) && env.ZOHO_ACCESS_TOKEN);
}

async function pushItemToZoho(env: Env, item: {sku:string; name:string; stock:number}): Promise<"pushed"|"simulated"> {
  const orgId = env.ZOHO_INVENTORY_ORG_ID || env.ZOHO_BOOKS_ORG_ID;
  if (!env.ZOHO_ACCESS_TOKEN || !orgId) {
    console.log(`[ZohoInv] (simulated) ${item.sku} → stock ${item.stock}`);
    return "simulated";
  }
  try {
    await fetch(`https://www.zohoapis.in/inventory/v1/items?organization_id=${orgId}`, {
      method: "POST",
      headers: { "Authorization": `Zoho-oauthtoken ${env.ZOHO_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sku: item.sku, name: item.name, initial_stock: item.stock }),
    });
    return "pushed";
  } catch (e) {
    console.log(`[ZohoInv] push failed for ${item.sku}: ${String(e)}`);
    return "simulated";
  }
}

async function runZohoInventorySync(env: Env, actor?: string): Promise<{items:number; pushed:number; simulated:number; at:string}> {
  const { results } = await env.DB.prepare(
    "SELECT sku, name, COALESCE(stock,0) as stock FROM inventory WHERE active=1"
  ).all() as {results: Array<{sku:string;name:string;stock:number}>};
  let pushed = 0, simulated = 0;
  for (const it of results) {
    const r = await pushItemToZoho(env, it);
    if (r === "pushed") pushed++; else simulated++;
  }
  const at = new Date().toISOString();
  await setConfig(env, "zoho_inv_last_sync_at", at, actor);
  await setConfig(env, "zoho_inv_last_result", `${pushed} pushed · ${simulated} simulated · ${results.length} items`);
  try {
    await env.DB.prepare("INSERT INTO zoho_sync_log (id,direction,items,pushed,simulated,status,actor) VALUES (?,?,?,?,?,?,?)")
      .bind(uid(), "push", results.length, pushed, simulated, "OK", actor ?? null).run();
  } catch { /* non-fatal */ }
  return { items: results.length, pushed, simulated, at };
}

async function handleZohoInvStatus(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const enabled = (await getConfig(env, "zoho_inv_sync_enabled", "false")) === "true";
  const lastSync = await getConfig(env, "zoho_inv_last_sync_at", "");
  const lastResult = await getConfig(env, "zoho_inv_last_result", "");
  const itemCount = await env.DB.prepare("SELECT COUNT(*) as n FROM inventory WHERE active=1").first() as {n:number}|null;
  let log: unknown[] = [];
  try { const { results } = await env.DB.prepare("SELECT * FROM zoho_sync_log ORDER BY created_at DESC LIMIT 5").all(); log = results; } catch { /* table pending */ }
  return json({
    configured: zohoInvConfigured(env),
    enabled,
    simulated_mode: !zohoInvConfigured(env),
    last_sync_at: lastSync || null,
    last_result: lastResult || null,
    item_count: itemCount?.n || 0,
    recent_log: log,
  });
}

async function handleZohoInvToggle(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as { enabled?: boolean };
  const enabled = !!body.enabled;
  await setConfig(env, "zoho_inv_sync_enabled", enabled ? "true" : "false", user!.sub);
  await audit(env, user, "UPDATE", "integration", "zoho_inventory", undefined, `enabled:${enabled}`);
  return json({ enabled });
}

async function handleZohoInvSync(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const enabled = (await getConfig(env, "zoho_inv_sync_enabled", "false")) === "true";
  if (!enabled) return json({error:"Zoho Inventory sync is disabled — enable it first"}, 400);
  const result = await runZohoInventorySync(env, user!.sub);
  await audit(env, user, "SYNC", "integration", "zoho_inventory", undefined, `${result.pushed} pushed, ${result.simulated} simulated`);
  return json({ ok: true, ...result, simulated_mode: !zohoInvConfigured(env) });
}

// Inbound: Zoho pushes stock changes → update our inventory stock levels.
async function handleZohoInvWebhook(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-Zoho-Webhook-Secret");
  if (env.ZOHO_INVENTORY_WEBHOOK_SECRET && secret !== env.ZOHO_INVENTORY_WEBHOOK_SECRET) {
    return json({error:"Invalid webhook secret"}, 401);
  }
  const body = await request.json() as { items?: Array<{sku:string; stock:number}> };
  const items = Array.isArray(body.items) ? body.items : [];
  let updated = 0;
  for (const it of items) {
    if (!it || !it.sku || typeof it.stock !== "number") continue;
    const res = await env.DB.prepare("UPDATE inventory SET stock=? WHERE sku=?")
      .bind(Math.max(0, Math.round(it.stock)), it.sku).run();
    updated += (res.meta?.changes as number) || 0;
  }
  try {
    await env.DB.prepare("INSERT INTO zoho_sync_log (id,direction,items,pushed,status,note) VALUES (?,?,?,?,?,?)")
      .bind(uid(), "pull", items.length, updated, "OK", "webhook stock update").run();
  } catch { /* non-fatal */ }
  return json({ ok: true, updated });
}

// ── Notification helper ───────────────────────────────────────────────
async function pushNotification(env: Env, userRole: string | null, message: string): Promise<void> {
  await env.DB.prepare("INSERT INTO notifications (id,user_role,message) VALUES (?,?,?)")
    .bind(uid(), userRole, message).run().catch(()=>{});
}

// ── Auto-reorder (Gap 8) ──────────────────────────────────────────────
async function checkAutoReorder(env: Env, actor: JWTPayload | null): Promise<void> {
  // Items at/below reorder level that have at least one vendor to source from.
  const { results } = await env.DB.prepare(`
    SELECT sku, name, stock, max_stock FROM inventory
    WHERE stock <= reorder_level AND (vendor_id IS NOT NULL OR secondary_vendor_id IS NOT NULL) AND active = 1
  `).all();

  // Skip SKUs that already have an outstanding PO, then build the reorder demand.
  const demand: Array<{sku:string; qty:number}> = [];
  for (const item of results as Record<string,unknown>[]) {
    const existing = await env.DB.prepare(`
      SELECT id FROM purchase_orders WHERE status IN ('PENDING_APPROVAL','SENT','ACCEPTED','DISPATCHED','PARTIALLY_RECEIVED')
      AND id IN (SELECT po_id FROM po_items WHERE sku = ?)
    `).bind(item.sku).first();
    if (existing) continue; // PO already outstanding
    const toMax = (Number(item.max_stock) || 200) - (Number(item.stock) || 0);
    demand.push({ sku: String(item.sku), qty: Math.max(1, toMax) });
  }
  if (!demand.length) return;

  // resolveSourcing gives compliant vendor selection (primary→secondary failover),
  // vendor-specific price, MOQ-lifted qty, and per-line GST for free (G10).
  const { groups } = await resolveSourcing(env, demand);
  const threshold = await poApprovalThreshold(env);

  for (const g of groups) {
    const poId = await nextPONumber(env);
    const needsApproval = threshold > 0 && g.grand_total >= threshold;
    const status = needsApproval ? "PENDING_APPROVAL" : "SENT";
    const v = await env.DB.prepare("SELECT avg_lead_days FROM vendors WHERE id=?").bind(g.vendor_id).first() as Record<string,number>|null;
    const lead = Number(v?.avg_lead_days) || 3;
    const expected = new Date(Date.now() + lead * 86400000).toISOString().slice(0,10);

    await env.DB.prepare(`INSERT INTO purchase_orders (id,vendor_id,status,subtotal,gst,grand_total,expected_delivery,notes)
      VALUES (?,?,?,?,?,?,?,'Auto-reorder: stock below reorder level')`)
      .bind(poId, g.vendor_id, status, g.subtotal, g.gst, g.grand_total, expected).run();
    for (const ln of g.lines) {
      await env.DB.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
        .bind(uid(), poId, ln.sku, ln.name, ln.qty, ln.rate, ln.total).run();
    }
    await pushNotification(env, "procurement_manager",
      `Auto-reorder ${poId} raised for ${g.vendor_name} — ${g.lines.length} item(s)${needsApproval ? " (needs approval)" : ""}`);
    await audit(env, actor, "AUTO_REORDER", "purchase_order", poId, undefined, `vendor:${g.vendor_id},lines:${g.lines.length},status:${status}`);
  }
}

// ── ORDER FSM ─────────────────────────────────────────────────────────
const ORDER_FSM: Record<string, string[]> = {
  DRAFT:            ["SUBMITTED","CANCELLED"],
  PENDING_PRICING:  ["SUBMITTED","PENDING_APPROVAL","APPROVED","CANCELLED"],
  SUBMITTED:        ["PENDING_APPROVAL","APPROVED","CANCELLED"],
  PENDING_APPROVAL: ["APPROVED","CANCELLED"],
  APPROVED:         ["ACKNOWLEDGED","CANCELLED"],
  ACKNOWLEDGED:     ["INVENTORY_CHECK","CANCELLED"],
  INVENTORY_CHECK:  ["READY_TO_PICK","VENDOR_PO_RAISED","CANCELLED"],
  VENDOR_PO_RAISED: ["APPROVED","READY_TO_PICK","CANCELLED"],
  READY_TO_PICK:    ["PICKED","CANCELLED"],
  PICKED:           ["QUALITY_CHECK","IN_SHIPMENT","CANCELLED"],
  QUALITY_CHECK:    ["IN_SHIPMENT","READY_TO_PICK","CANCELLED"],
  IN_SHIPMENT:      ["PARTIALLY_CLOSED","CLOSED"],
  PARTIALLY_CLOSED: ["READY_TO_PICK","CLOSED","CANCELLED"],
  CLOSED: [], CANCELLED: [],
};

// ════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════
let _categoryFixApplied = false;
// Feature-table schema, kept in sync with migrations 0002+ so the runtime is
// self-sufficient even when those migrations were never applied (the import_jobs
// bug was exactly this). All idempotent CREATE TABLE IF NOT EXISTS.
async function ensureFeatureTables(env: Env): Promise<void> {
  const stmts: string[] = [
    `CREATE TABLE IF NOT EXISTS approval_chain_actions ( id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, step_order INTEGER NOT NULL, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL, comments TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS approval_chain_instances ( id TEXT PRIMARY KEY, chain_id TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'order', current_step INTEGER DEFAULT 1, status TEXT NOT NULL DEFAULT 'PENDING', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS approval_chain_steps ( id TEXT PRIMARY KEY, chain_id TEXT NOT NULL, step_order INTEGER NOT NULL, role TEXT NOT NULL, label TEXT );`,
    `CREATE TABLE IF NOT EXISTS approval_chains ( id TEXT PRIMARY KEY, name TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'order', min_amount REAL DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS approval_rules ( id TEXT PRIMARY KEY, client_id TEXT, category TEXT, min_amount REAL DEFAULT 0, max_amount REAL, approver_role TEXT DEFAULT 'client_approver', auto_approve INTEGER DEFAULT 0, active INTEGER DEFAULT 1 );`,
    `CREATE TABLE IF NOT EXISTS audit_logs ( id TEXT PRIMARY KEY, actor_id TEXT, actor_name TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT, old_value TEXT, new_value TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS bin_locations ( id TEXT PRIMARY KEY, warehouse_id TEXT NOT NULL, code TEXT NOT NULL, zone TEXT, sku TEXT, capacity INTEGER DEFAULT 100, occupied INTEGER DEFAULT 0 );`,
    `CREATE TABLE IF NOT EXISTS client_catalog ( client_id TEXT NOT NULL, sku TEXT NOT NULL, added_by TEXT, added_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (client_id, sku) );`,
    `CREATE TABLE IF NOT EXISTS client_consumption ( id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT NOT NULL, sku TEXT NOT NULL, item_name TEXT NOT NULL, qty REAL NOT NULL, consumed_at TEXT DEFAULT (datetime('now')), notes TEXT, recorded_by TEXT );`,
    `CREATE TABLE IF NOT EXISTS client_inventory ( id INTEGER PRIMARY KEY AUTOINCREMENT, client_id TEXT NOT NULL, sku TEXT NOT NULL, item_name TEXT NOT NULL, category TEXT DEFAULT '', uom TEXT DEFAULT 'unit', qty_on_hand REAL DEFAULT 0, reorder_level REAL DEFAULT 0, last_received_qty REAL DEFAULT 0, last_received_at TEXT, last_consumed_at TEXT, updated_at TEXT DEFAULT (datetime('now')), UNIQUE(client_id, sku) );`,
    `CREATE TABLE IF NOT EXISTS dc_documents ( id INTEGER PRIMARY KEY AUTOINCREMENT, dc_id TEXT NOT NULL, doc_type TEXT NOT NULL, filename TEXT, mime_type TEXT, content_b64 TEXT NOT NULL, file_size INTEGER, uploaded_at TEXT DEFAULT (datetime('now')), uploaded_by TEXT );`,
    `CREATE TABLE IF NOT EXISTS dc_items ( id TEXT PRIMARY KEY, dc_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, qty_ordered INTEGER NOT NULL DEFAULT 0, qty_delivered INTEGER NOT NULL DEFAULT 0 );`,
    `CREATE TABLE IF NOT EXISTS delivery_returns ( id TEXT PRIMARY KEY, dc_id TEXT NOT NULL, sku TEXT NOT NULL, item_name TEXT, qty_returned INTEGER NOT NULL DEFAULT 0, reason TEXT, staff_id TEXT, returned_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS delivery_routes ( id TEXT PRIMARY KEY, name TEXT NOT NULL, route_date TEXT NOT NULL, stops TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'PLANNED', created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS dunning_events ( id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, client_id TEXT NOT NULL, order_id TEXT, action_taken TEXT NOT NULL, notes TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS dunning_rules ( id TEXT PRIMARY KEY, days_overdue INTEGER NOT NULL, action TEXT NOT NULL, message_template TEXT, active INTEGER DEFAULT 1 );`,
    `CREATE TABLE IF NOT EXISTS order_allocations ( id TEXT PRIMARY KEY, order_id TEXT NOT NULL, sku TEXT NOT NULL, item_name TEXT, qty INTEGER NOT NULL, bin_code TEXT, picked_by TEXT, picked_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS order_comments ( id TEXT PRIMARY KEY, order_id TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS order_templates ( id TEXT PRIMARY KEY, name TEXT NOT NULL, client_id TEXT, items TEXT NOT NULL DEFAULT '[]', notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS otp_store ( email TEXT PRIMARY KEY, code TEXT NOT NULL, expires_at TEXT NOT NULL, attempts INTEGER DEFAULT 0 );`,
    `CREATE TABLE IF NOT EXISTS po_templates ( id TEXT PRIMARY KEY, name TEXT NOT NULL, vendor_id TEXT, items TEXT NOT NULL DEFAULT '[]', notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS porter_expenses ( id TEXT PRIMARY KEY, trip_date TEXT NOT NULL, route TEXT, amount REAL NOT NULL, client_id TEXT, staff_id TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS sla_breaches ( id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, entity_id TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'order', breached_at TEXT DEFAULT (datetime('now')), resolved_at TEXT, status TEXT NOT NULL DEFAULT 'OPEN' );`,
    `CREATE TABLE IF NOT EXISTS sla_rules ( id TEXT PRIMARY KEY, name TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'order', trigger_status TEXT NOT NULL, max_hours INTEGER NOT NULL, action TEXT NOT NULL DEFAULT 'NOTIFY', active INTEGER DEFAULT 1 );`,
    `CREATE TABLE IF NOT EXISTS staff ( id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, role TEXT NOT NULL DEFAULT 'delivery_staff', active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS standing_orders ( id TEXT PRIMARY KEY, client_id TEXT NOT NULL, name TEXT NOT NULL, frequency TEXT NOT NULL DEFAULT 'MONTHLY', next_run_date TEXT, last_run_date TEXT, items TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS stock_movements ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, type TEXT NOT NULL, qty_change INTEGER NOT NULL, reference_id TEXT, reference_type TEXT, note TEXT, actor TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS vendor_feedback ( id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL, po_id TEXT, grn_id TEXT, quality_rating INTEGER NOT NULL DEFAULT 3, delivery_rating INTEGER NOT NULL DEFAULT 3, service_rating INTEGER NOT NULL DEFAULT 3, comments TEXT, submitted_by TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS warehouses ( id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT, address TEXT, capacity INTEGER DEFAULT 1000, active INTEGER DEFAULT 1 );`,
    `CREATE TABLE IF NOT EXISTS app_config ( key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT (datetime('now')), updated_by TEXT );`,
    `CREATE TABLE IF NOT EXISTS zoho_sync_log ( id TEXT PRIMARY KEY, direction TEXT NOT NULL, items INTEGER DEFAULT 0, pushed INTEGER DEFAULT 0, simulated INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'OK', note TEXT, actor TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS draft_carts ( user_id TEXT PRIMARY KEY, items TEXT NOT NULL DEFAULT '[]', updated_at TEXT DEFAULT (datetime('now')) );`,
    // PR-1: receiving spine (G1–G3)
    `CREATE TABLE IF NOT EXISTS grn_lines ( id TEXT PRIMARY KEY, grn_id TEXT NOT NULL, sku TEXT NOT NULL, name TEXT NOT NULL, qty_received INTEGER NOT NULL DEFAULT 0, qty_rejected INTEGER NOT NULL DEFAULT 0, batch_no TEXT, mfg_date TEXT, expiry_date TEXT, qc_status TEXT DEFAULT 'ACCEPTED', note TEXT );`,
    `CREATE TABLE IF NOT EXISTS inventory_batches ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, batch_no TEXT, mfg_date TEXT, expiry_date TEXT, qty REAL NOT NULL DEFAULT 0, grn_line_id TEXT, received_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS po_invoices ( id TEXT PRIMARY KEY, po_id TEXT NOT NULL, vendor_invoice_no TEXT, invoice_amount REAL DEFAULT 0, invoice_date TEXT, match_status TEXT DEFAULT 'PENDING', qty_variance REAL DEFAULT 0, amount_variance REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS vendor_debit_notes ( id TEXT PRIMARY KEY, po_id TEXT NOT NULL, vendor_id TEXT NOT NULL, sku TEXT, name TEXT, qty REAL NOT NULL DEFAULT 0, amount REAL NOT NULL DEFAULT 0, reason TEXT, status TEXT DEFAULT 'OPEN', created_by TEXT, created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS hsn_gst_rates ( hsn TEXT PRIMARY KEY, gst_rate REAL NOT NULL, description TEXT, updated_at TEXT DEFAULT (datetime('now')), updated_by TEXT );`,
    // Brand & Product Intelligence (Smart Catalogue + Product Intelligence)
    `CREATE TABLE IF NOT EXISTS brands ( id TEXT PRIMARY KEY, name TEXT NOT NULL, origin TEXT, emoji TEXT DEFAULT '🏷️', description TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS product_fitment ( sku TEXT PRIMARY KEY, verification TEXT DEFAULT 'needs_review', fitment_state TEXT DEFAULT 'PENDING', clean_label TEXT DEFAULT 'pending', reviewer TEXT, reviewed_at TEXT, expiry_date TEXT, notes TEXT, updated_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS product_attributes ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, grp TEXT NOT NULL, name TEXT NOT NULL, source TEXT DEFAULT 'brand', created_at TEXT DEFAULT (datetime('now')) );`,
    `CREATE TABLE IF NOT EXISTS product_nutrition ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, nutrient TEXT NOT NULL, value TEXT, unit TEXT, basis TEXT DEFAULT 'per 100g', source TEXT DEFAULT 'brand' );`,
    `CREATE TABLE IF NOT EXISTS product_ingredients ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, raw_text TEXT, normalized TEXT, ins_code TEXT, functional_class TEXT, flags TEXT, state TEXT DEFAULT 'detected', source TEXT DEFAULT 'brand' );`,
    `CREATE TABLE IF NOT EXISTS product_certifications ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, cert_type TEXT NOT NULL, issuer TEXT, number TEXT, scope TEXT, issue_date TEXT, expiry_date TEXT, status TEXT DEFAULT 'active', source TEXT DEFAULT 'brand', reviewer TEXT, reviewed_at TEXT );`,
    `CREATE TABLE IF NOT EXISTS product_allergens ( id TEXT PRIMARY KEY, sku TEXT NOT NULL, allergen TEXT NOT NULL, contains_state TEXT DEFAULT 'not_declared', cross_contact_state TEXT DEFAULT 'unknown', source TEXT DEFAULT 'brand' );`,
  ];
  // Column adds for the receiving spine — idempotent (errors swallowed if present).
  const alters: string[] = [
    `ALTER TABLE po_items ADD COLUMN qty_received INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE grn_records ADD COLUMN status TEXT DEFAULT 'POSTED'`,
    `ALTER TABLE grn_records ADD COLUMN received_by_name TEXT`,
    `ALTER TABLE inventory ADD COLUMN track_batch INTEGER DEFAULT 0`,
  ];
  for (const sql of [...stmts, ...alters]) { try { await env.DB.prepare(sql).run(); } catch { /* exists / non-fatal */ } }
  // Seed the HSN→GST slab map when empty (mirrors migration 0037 so the mapping
  // exists even on DBs where later migrations were never applied). INSERT OR
  // IGNORE keeps any admin-managed edits intact.
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO hsn_gst_rates (hsn,gst_rate,description) VALUES
        ('0401',0,'Milk, fresh'),('0402',5,'Milk powder / concentrated milk'),
        ('0901',5,'Coffee'),('0902',5,'Tea'),('1701',5,'Sugar'),
        ('1704',18,'Sugar confectionery'),('1806',18,'Chocolate & cocoa preparations'),
        ('1905',18,'Biscuits, bread, cakes'),('2009',12,'Fruit & vegetable juices'),
        ('2106',12,'Food preparations n.e.s. (namkeen/snacks)'),
        ('2201',18,'Water, incl. mineral (unsweetened)'),
        ('2202',28,'Aerated / sweetened / flavoured beverages'),
        ('3401',18,'Soap'),('3402',18,'Detergents & cleaning preparations'),
        ('3808',18,'Disinfectants / sanitizers'),('3924',18,'Plastic tableware / kitchenware'),
        ('4802',12,'Paper'),('4817',18,'Envelopes'),
        ('4820',12,'Registers, notebooks, exercise books'),
        ('4823',18,'Paper articles (napkins, tissues)'),('9608',18,'Pens')`
    ).run();
  } catch { /* table missing / non-fatal */ }
}

// Seed accounts carry a well-known password ("password"). In development/test we
// upgrade them to PBKDF2 in place (convenient demo logins). In PRODUCTION we must
// never launder a known credential into a real-looking hash — instead we disable
// every seed account outright and provision a real admin from secrets, so the
// well-known login can never be used against a live deployment.
async function migrateSeedPasswords(env: Env): Promise<void> {
  try {
    if (isProd(env)) {
      await env.DB.prepare(
        "UPDATE users SET password_hash='disabled:'||lower(hex(randomblob(16))), active=0 WHERE password_hash LIKE 'SEED:%'"
      ).run();
      await provisionBootstrapAdmin(env);
      return;
    }
    const { results } = await env.DB.prepare(
      "SELECT id, password_hash FROM users WHERE password_hash LIKE 'SEED:%'").all();
    for (const r of (results || []) as Array<{ id: string; password_hash: string }>) {
      const pw = String(r.password_hash).slice(5);
      await env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?")
        .bind("hash:" + await hashPassword(pw), r.id).run();
    }
  } catch { /* non-fatal */ }
}

// Production bootstrap: if BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD
// secrets are set, (re)provision exactly one active super_admin with a strong
// PBKDF2 hash so the operator has a real, rotatable way in after seed accounts
// are disabled. No-op unless both are supplied and the password is reasonable.
async function provisionBootstrapAdmin(env: Env): Promise<void> {
  const email = String(env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const pw = String(env.BOOTSTRAP_ADMIN_PASSWORD || "");
  if (!email || pw.length < 10) return;
  const hash = "hash:" + await hashPassword(pw);
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first() as { id?: string } | null;
  if (existing?.id) {
    await env.DB.prepare("UPDATE users SET password_hash=?, role='super_admin', active=1 WHERE email=?").bind(hash, email).run();
  } else {
    await env.DB.prepare("INSERT INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,1)")
      .bind(uid(), email, hash, "super_admin", "Administrator", "4SYZ Platform", "AD").run();
  }
}

async function fixCategoryNames(env: Env): Promise<void> {
  if (_categoryFixApplied) return;
  _categoryFixApplied = true;
  await ensureFeatureTables(env); // create feature tables missing when later migrations were not applied
  await migrateSeedPasswords(env); // retire plaintext SEED: credentials
  try {
    const renames: [string, string][] = [
      ['Beverage',   'Beverages'],
      ['Snack',      'Snacks'],
      ['Stationary', 'Stationery'],
      ['DryFruit',   'DryFruits'],
    ];
    for (const [from, to] of renames) {
      await env.DB.prepare("UPDATE inventory        SET category=? WHERE category=?").bind(to, from).run();
      await env.DB.prepare("UPDATE client_inventory SET category=? WHERE category=?").bind(to, from).run();
      await env.DB.prepare("UPDATE order_items      SET category=? WHERE category=?").bind(to, from).run();
    }
    // Self-heal: sync each client's stored category from the master catalogue so
    // per-product category edits (not just the blanket renames above) propagate.
    await env.DB.prepare(`UPDATE client_inventory
      SET category = (SELECT inv.category FROM inventory inv WHERE inv.sku = client_inventory.sku)
      WHERE EXISTS (SELECT 1 FROM inventory inv WHERE inv.sku = client_inventory.sku
        AND COALESCE(inv.category,'') <> ''
        AND COALESCE(inv.category,'') <> COALESCE(client_inventory.category,''))`).run();
  } catch { /* non-fatal — tables may not exist yet */ }
  try {
    // One-time client identity rename: the seed/demo client "Meta" →
    // "EMERALDE GLOBAL SOLUTIONS PRIVATE LIMITED". Idempotent — the WHERE/REPLACE
    // clauses only match the old strings, so re-runs are no-ops.
    const NEW_CLIENT_NAME = 'EMERALDE GLOBAL SOLUTIONS PRIVATE LIMITED';
    const OLD_CLIENT_NAMES = ['Meta India', 'Meta Bangalore'];
    for (const old of OLD_CLIENT_NAMES) {
      await env.DB.prepare("UPDATE clients SET name=? WHERE name=?").bind(NEW_CLIENT_NAME, old).run();
      await env.DB.prepare("UPDATE users   SET org=?  WHERE org=?").bind(NEW_CLIENT_NAME, old).run();
      await env.DB.prepare("UPDATE notifications  SET message=REPLACE(message,?,?) WHERE message LIKE ?").bind(old, NEW_CLIENT_NAME, `%${old}%`).run();
    }
    // Standing-order label carrying just the "Meta" prefix (e.g. "Meta Monthly …").
    await env.DB.prepare("UPDATE standing_orders SET name=REPLACE(name,'Meta ',?) WHERE name LIKE 'Meta %'").bind(NEW_CLIENT_NAME + ' ').run();
    // Migrate the client's login/contact emails off the old @meta.com domain
    // to @emeralde.in (e.g. user@meta.com → user@emeralde.in). Idempotent — only
    // rows still on the old domain match. These are login IDs, so affected users
    // sign in with the new address; the password is unchanged.
    await env.DB.prepare("UPDATE users   SET email=REPLACE(email,'@meta.com','@emeralde.in') WHERE email LIKE '%@meta.com'").run();
    await env.DB.prepare("UPDATE clients SET contact_email=REPLACE(contact_email,'@meta.com','@emeralde.in') WHERE contact_email LIKE '%@meta.com'").run();
    // Repair login: a client user's org IS its client's name, so mirror the live
    // client name onto every client-linked user. This fixes any stale login
    // snapshot (the reported "logged in still shows Meta" case) in one pass.
    await env.DB.prepare(`UPDATE users SET org=(SELECT c.name FROM clients c WHERE c.id=users.client_id)
      WHERE client_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM clients c WHERE c.id=users.client_id
          AND COALESCE(c.name,'') <> '' AND c.name <> COALESCE(users.org,''))`).run();
  } catch { /* non-fatal — tables may not exist yet */ }
  try {
    // Seed a demonstrable Smart Catalogue off existing inventory (idempotent):
    // brands, fitment (first 5 approved+verified, rest pending → review queue),
    // a couple of attributes and an FSSAI certificate per approved product.
    const { results: prods } = await env.DB.prepare(
      "SELECT sku, name, COALESCE(brand,'') AS brand FROM inventory WHERE active=1 ORDER BY sku LIMIT 10"
    ).all() as { results: Array<Record<string,string>> };
    const today = new Date().toISOString().slice(0,10);
    const plusYear = new Date(Date.now() + 330*86400000).toISOString().slice(0,10);
    for (let i = 0; i < prods.length; i++) {
      const sku = String(prods[i].sku);
      const brandName = (prods[i].brand && prods[i].brand.trim()) ? prods[i].brand.trim() : String(prods[i].name).split(" ").slice(0,2).join(" ");
      const brandId = "br-" + brandName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16);
      await env.DB.prepare("INSERT OR IGNORE INTO brands (id,name,emoji) VALUES (?,?,?)").bind(brandId, brandName, "🏷️").run();
      const approved = i < 5;
      await env.DB.prepare("INSERT OR IGNORE INTO product_fitment (sku,verification,fitment_state,clean_label,reviewer,reviewed_at,expiry_date) VALUES (?,?,?,?,?,?,?)")
        .bind(sku, approved?"verified":"needs_review", approved?"APPROVED":"PENDING", approved?"eligible":"pending", approved?"Ops · Seed":null, approved?today:null, approved?plusYear:null).run();
      if (approved) {
        await env.DB.prepare("INSERT OR IGNORE INTO product_attributes (id,sku,grp,name,source) VALUES (?,?,?,?,?)").bind("pa-"+sku+"-vegan", sku, "dietary", "Vegan", "4syz").run();
        await env.DB.prepare("INSERT OR IGNORE INTO product_attributes (id,sku,grp,name,source) VALUES (?,?,?,?,?)").bind("pa-"+sku+"-nas", sku, "formulation", "No Added Sugar", "brand").run();
        await env.DB.prepare("INSERT OR IGNORE INTO product_certifications (id,sku,cert_type,issuer,number,status,expiry_date,source,reviewer,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
          .bind("pc-"+sku+"-fssai", sku, "FSSAI licence", "FSSAI", "100"+sku, "active", plusYear, "4syz", "Ops · Seed", today).run();
      }
    }
  } catch { /* non-fatal — inventory may be empty */ }
  try {
    await env.DB.prepare("ALTER TABLE order_items ADD COLUMN item_note TEXT").run();
  } catch { /* column already exists */ }
  try {
    await env.DB.prepare("ALTER TABLE client_inventory ADD COLUMN is_critical INTEGER DEFAULT 0").run();
  } catch { /* column already exists */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS standing_order_events (
      id TEXT PRIMARY KEY, so_id TEXT NOT NULL, cycle_date TEXT NOT NULL,
      action TEXT NOT NULL, order_id TEXT, actor_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(so_id, cycle_date))`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT)").run();
  } catch { /* ignore */ }
  try {
    // import_jobs powers the CSV "Import History" tab. It was only ever created by
    // migration 0003, so on any DB where that migration wasn't applied the history
    // query 500s and the tab shows empty — self-heal it like the other tables.
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DONE',
      total INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
      errors TEXT DEFAULT '[]', created_by TEXT, created_at TEXT DEFAULT (datetime('now')))`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_throttle (
      email TEXT PRIMARY KEY, fails INTEGER DEFAULT 0, first_fail TEXT, locked_until TEXT)`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tower_snapshots (
      day TEXT PRIMARY KEY, data TEXT, created_at TEXT DEFAULT (datetime('now')))`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS kpi_daily (
      day TEXT PRIMARY KEY, data TEXT, created_at TEXT DEFAULT (datetime('now')))`).run();
  } catch { /* ignore */ }
  for (const col of ["reminder_armed INTEGER", "reminder_sent_at TEXT", "scan_barcode TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE delivery_challans ADD COLUMN ${col}`).run(); } catch { /* exists */ }
  }
  try {
    await env.DB.prepare("ALTER TABLE delivery_challans ADD COLUMN scheduled_date TEXT").run();
  } catch { /* column already exists */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL, author_id TEXT NOT NULL,
      author_name TEXT NOT NULL, author_role TEXT NOT NULL, message TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')))`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY, dc_id TEXT NOT NULL, order_id TEXT, client_id TEXT,
      reason TEXT, items TEXT NOT NULL, prev_dc_status TEXT,
      status TEXT DEFAULT 'PENDING', created_by TEXT, created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      reviewed_by TEXT, reviewed_at TEXT, review_note TEXT)`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare("ALTER TABLE orders ADD COLUMN order_image TEXT").run();
  } catch { /* column already exists */ }
  try {
    await env.DB.prepare("ALTER TABLE orders ADD COLUMN closed_at TEXT").run();
  } catch { /* column already exists */ }
  for (const col of ["notes TEXT","visit_frequency TEXT","visit_day TEXT",
    "registration_type TEXT DEFAULT 'unregistered'","gstin TEXT","pan TEXT",
    "vendor_type TEXT DEFAULT 'non_food'","fssai_licence TEXT","fssai_expiry TEXT",
    "onboarding_status TEXT DEFAULT 'active'","vendor_code TEXT",
    "bank_account_name TEXT","bank_account_no TEXT","bank_ifsc TEXT","bank_name TEXT",
    "bank_branch TEXT","upi_id TEXT","payment_terms TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE vendors ADD COLUMN ${col}`).run(); } catch { /* exists */ }
  }
  // Backfill a human-readable vendor code (VDR-YYYY-NNNNN) for any vendor missing one.
  try {
    const { results } = await env.DB.prepare(
      "SELECT id FROM vendors WHERE vendor_code IS NULL OR vendor_code='' ORDER BY rowid").all();
    if (results && results.length) {
      let seq = await nextVendorSeq(env);
      const year = new Date().getFullYear();
      for (const r of results as Array<{id:string}>) {
        await env.DB.prepare("UPDATE vendors SET vendor_code=? WHERE id=?")
          .bind(formatVendorCode(year, seq++), r.id).run();
      }
    }
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vendor_documents (
      id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL, kind TEXT NOT NULL,
      filename TEXT, mime TEXT, size INTEGER, data TEXT, expiry_date TEXT,
      uploaded_at TEXT DEFAULT (datetime('now')))`).run();
  } catch { /* ignore */ }
  try {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vendor_products (
      id TEXT PRIMARY KEY, vendor_id TEXT NOT NULL, sku TEXT, name TEXT NOT NULL,
      pack TEXT, moq REAL DEFAULT 1, rate REAL DEFAULT 0, lead_days INTEGER DEFAULT 3,
      mrp REAL, margin_pct REAL, status TEXT DEFAULT 'new_sku')`).run();
  } catch { /* ignore */ }
  // mrp / margin_pct added later — backfill columns on existing DBs (Super-Admin
  // captures MRP and margin-on-MRP when adding a vendor's product).
  for (const col of ["mrp REAL", "margin_pct REAL"]) {
    try { await env.DB.prepare(`ALTER TABLE vendor_products ADD COLUMN ${col}`).run(); } catch { /* exists */ }
  }
  try {
    await env.DB.prepare("ALTER TABLE orders ADD COLUMN order_period TEXT").run();
  } catch { /* column already exists */ }
  for (const col of ["gstin TEXT", "pan TEXT"]) {
    try { await env.DB.prepare(`ALTER TABLE clients ADD COLUMN ${col}`).run(); } catch { /* exists */ }
  }
}

// Human-readable vendor code: VDR-<year>-<5-digit running number>, globally
// sequential so it stays unique even across years.
function formatVendorCode(year: number, seq: number): string {
  return `VDR-${year}-${String(seq).padStart(5, '0')}`;
}
async function nextVendorSeq(env: Env): Promise<number> {
  try {
    const { results } = await env.DB.prepare(
      "SELECT vendor_code FROM vendors WHERE vendor_code LIKE 'VDR-%'").all();
    let max = 0;
    for (const r of (results||[]) as Array<{vendor_code:string}>) {
      const n = parseInt(String(r.vendor_code).split('-').pop() || '', 10);
      if (!isNaN(n) && n > max) max = n;
    }
    return max + 1;
  } catch { return 1; }
}

// Indian PAN: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum (e.g. 29ABCDE1234F1ZW).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// GSTIN 15th-character checksum (GSTN mod-36 algorithm): weight the first 14
// code points by an alternating 2/1 factor from the right, digit-sum each, and
// the 36-complement of the total mod 36 must equal the final character.
const GSTIN_CP = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function gstinChecksumOk(g: string): boolean {
  let factor = 2, sum = 0; const m = GSTIN_CP.length;
  for (let i = 13; i >= 0; i--) {
    let d = factor * GSTIN_CP.indexOf(g[i]);
    factor = factor === 2 ? 1 : 2;
    d = Math.floor(d / m) + (d % m);
    sum += d;
  }
  return GSTIN_CP[(m - (sum % m)) % m] === g[14];
}

// PAN is optional; when supplied it must match the canonical PAN format.
function normalizePan(raw: unknown): { pan: string | null; error?: string } {
  if (raw === undefined || raw === null) return { pan: null };
  const v = String(raw).trim().toUpperCase();
  if (v === "") return { pan: null };
  if (!PAN_RE.test(v))
    return { pan: null, error: "PAN must be 10 characters: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)" };
  return { pan: v };
}

// GSTIN is optional; when supplied it must be a valid 15-char GSTIN.
function normalizeGstin(raw: unknown): { gstin: string | null; error?: string } {
  if (raw === undefined || raw === null) return { gstin: null };
  const v = String(raw).trim().toUpperCase();
  if (v === "") return { gstin: null };
  if (!GSTIN_RE.test(v))
    return { gstin: null, error: "GST number must be a valid 15-character GSTIN (e.g. 29ABCDE1234F1ZW)" };
  if (!gstinChecksumOk(v))
    return { gstin: null, error: "GST number checksum is invalid — check for a typo" };
  return { gstin: v };
}

// Validate + reconcile a client's GSTIN and PAN. The GSTIN embeds the PAN at
// characters 3–12, so when both are present they must agree; when only the
// GSTIN is present the PAN is derived from it.
function resolveTaxIds(rawGstin: unknown, rawPan: unknown):
  { gstin: string | null; pan: string | null; error?: string } {
  const g = normalizeGstin(rawGstin); if (g.error) return { gstin: null, pan: null, error: g.error };
  const p = normalizePan(rawPan);     if (p.error) return { gstin: null, pan: null, error: p.error };
  let pan = p.pan;
  if (g.gstin) {
    const embedded = g.gstin.slice(2, 12);
    if (pan && pan !== embedded)
      return { gstin: null, pan: null, error: "GST number does not match the PAN (PAN is embedded in the GSTIN)" };
    pan = pan || embedded;
  }
  return { gstin: g.gstin, pan };
}

export default {
  // Daily cron (wrangler.jsonc triggers): delivery reminders + recurring-order nudges
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      await fixCategoryNames(env); // make sure columns/tables exist first
      await runDeliveryReminders(env);
    })());
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return withSecurityHeaders(cors());
    if (!url.pathname.startsWith("/api/")) return withSecurityHeaders(await env.ASSETS.fetch(request));
    // Fail closed: never serve the API in production on a weak/default JWT secret.
    if (isProd(env) && insecureSecret(env))
      return withSecurityHeaders(json({error:"Server misconfigured — a strong JWT_SECRET must be set via `wrangler secret put JWT_SECRET`."}, 503));
    ctx.waitUntil(fixCategoryNames(env)); // guaranteed to complete even after response

    const path = url.pathname.replace(/\/$/,"");
    const method = request.method;

    // Central defence-in-depth: external client/vendor accounts can never reach
    // back-office endpoints, regardless of per-handler checks.
    if (staffOnlyApiMatch(method, path)) {
      const u = await getUser(request, env);
      if (!u) return withSecurityHeaders(json({error:"Unauthorized"}, 401));
      if (isExternalRole(u.role)) return withSecurityHeaders(json({error:"Forbidden — 4SYZ staff only"}, 403));
    }

    const route = async (): Promise<Response> => {
      // Auth
      if (path==="/api/auth/login"      && method==="POST") return handleLogin(request,env);
      if (path==="/api/auth/me"         && method==="GET")  return handleMe(request,env);
      if (path==="/api/auth/otp/send"   && method==="POST") return handleOTPSend(request,env);
      if (path==="/api/auth/otp/verify" && method==="POST") return handleOTPVerify(request,env);

      // Orders — specific paths must come before the wildcard /:id routes
      if (path==="/api/cart"                   && method==="GET")    return handleGetCart(request,env);
      if (path==="/api/cart"                   && method==="PUT")    return handleSaveCart(request,env);
      if (path==="/api/cart"                   && method==="DELETE") return handleClearCart(request,env);
      if (path==="/api/orders"                 && method==="GET")  return handleListOrders(request,env);
      if (path==="/api/orders"                 && method==="POST") return handleCreateOrder(request,env);
      if (path==="/api/orders/picklist"        && method==="GET")  return handlePickList(request,env);
      if (path==="/api/orders/items-summary"   && method==="GET")  return handleOrderItemsSummary(request,env);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="GET")   return handleGetOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="PATCH") return handlePatchOrder(request,env,path);
      if (path==="/api/pipeline"               && method==="GET")  return handlePipeline(request,env);
      if (path==="/api/pipeline/next-actions"  && method==="GET")  return handleNextActions(request,env);
      if (path==="/api/pipeline/sla"           && method==="GET")  return handleGetSla(request,env);
      if (path==="/api/pipeline/sla"           && method==="POST") return handleSaveSla(request,env);
      if (path.match(/^\/api\/orders\/[^/]+\/lifecycle$/)    && method==="GET")  return handleOrderLifecycle(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/drilldown$/)    && method==="GET")  return handleOrderDrilldown(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/reprice$/)      && method==="POST") return handleRepriceOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/transition$/)   && method==="POST") return handleTransitionOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/pick$/)         && method==="POST") return handlePickOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/allocations$/)  && method==="GET")  return handleGetAllocations(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)     && method==="GET")  return handleListComments(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)     && method==="POST") return handleAddComment(request,env,path);

      // Inventory
      if (path==="/api/barcode-map"             && method==="GET")   return handleBarcodeMap(request,env);
      if (path==="/api/brands"                  && method==="GET")   return handleListBrands(request,env);
      if (path==="/api/brands"                  && method==="POST")  return handleUpsertBrand(request,env);
      if (path==="/api/catalogue"               && method==="GET")   return handleListCatalogue(request,env);
      if (path==="/api/catalogue/report"        && method==="GET")   return handleCatalogueReport(request,env);
      if (path.match(/^\/api\/catalogue\/[^/]+\/fitment$/) && method==="PATCH") return handleSetFitment(request,env,path);
      if (path.match(/^\/api\/catalogue\/[^/]+\/intel$/)   && method==="PUT")   return handlePutIntel(request,env,path);
      if (path.match(/^\/api\/catalogue\/[^/]+\/extract$/) && method==="POST")  return handleExtractIntel(request,env,path);
      if (path.match(/^\/api\/catalogue\/[^/]+\/ocr$/)     && method==="POST")  return handleOcrLabel(request,env,path);
      if (path==="/api/ai/health"               && method==="GET")   return handleAiHealth(request,env);
      if (path.match(/^\/api\/catalogue\/[^/]+$/)          && method==="GET")   return handleGetCatalogueItem(request,env,path);
      if (path==="/api/inventory/barcodes"      && method==="POST")  return handleBulkBarcodes(request,env);
      if (path==="/api/inventory"               && method==="GET")   return handleListInventory(request,env);
      if (path==="/api/inventory"               && method==="POST")  return handleAddInventory(request,env);
      if (path==="/api/inventory/critical-alerts" && method==="POST") return handleSendCriticalAlerts(request,env);
      if (path==="/api/inventory/recalc-gst"    && method==="POST")  return handleRecalcGst(request,env);
      if (path==="/api/hsn-gst"                 && method==="GET")   return handleHsnGstLookup(request,env);
      if (path==="/api/hsn-gst-rates"           && method==="GET")   return handleListHsnGstRates(request,env);
      if (path==="/api/hsn-gst-rates"           && method==="POST")  return handleUpsertHsnGstRate(request,env);
      if (path==="/api/zones"                   && method==="GET")   return handleListZones(request,env);
      if (path==="/api/zones"                   && method==="POST")  return handleUpsertZone(request,env);
      if (path.match(/^\/api\/zones\/[^/]+$/)   && method==="DELETE") return handleDeleteZone(request,env,path);
      if (path.match(/^\/api\/inventory\/[^/]+\/critical$/) && method==="PATCH") return handleToggleCritical(request,env,path);
      if (path.match(/^\/api\/inventory\/[^/]+$/) && method==="PATCH") return handlePatchInventory(request,env,path);

      // Vendors
      if (path==="/api/vendors"  && method==="GET")  return handleListVendors(request,env);
      if (path==="/api/vendors"  && method==="POST") return handleAddVendor(request,env);
      if (path.match(/^\/api\/vendors\/[^/]+\/documents$/) && method==="GET") return handleListVendorDocuments(request,env,path);
      if (path.match(/^\/api\/vendors\/[^/]+\/products$/)  && method==="GET") return handleListVendorProducts(request,env,path);
      if (path.match(/^\/api\/vendors\/[^/]+$/) && method==="PATCH") return handlePatchVendor(request,env,path);

      // Purchase Orders
      if (path==="/api/purchase-orders"               && method==="GET")   return handleListPOs(request,env);
      if (path==="/api/purchase-orders"               && method==="POST")  return handleCreatePO(request,env);
      if (path==="/api/purchase-orders/from-demand"   && method==="POST")  return handlePOFromDemand(request,env);
      if (path==="/api/sourcing/preview"              && method==="GET")   return handleSourcingPreview(request,env);
      if (path==="/api/po-approval-threshold"         && method==="GET")   return handlePOApprovalThreshold(request,env,"GET");
      if (path==="/api/po-approval-threshold"         && method==="PATCH") return handlePOApprovalThreshold(request,env,"PATCH");
      if (path.match(/^\/api\/purchase-orders\/[^/]+$/) && method==="PATCH") return handlePatchPO(request,env,path);
      if (path.match(/^\/api\/purchase-orders\/[^/]+$/) && method==="PUT")   return handleAmendPO(request,env,path);
      if (path.match(/^\/api\/purchase-orders\/[^/]+\/receivable$/)   && method==="GET")  return handleReceivablePO(request,env,path);
      if (path.match(/^\/api\/purchase-orders\/[^/]+\/invoice$/)      && method==="POST") return handleInvoicePO(request,env,path);
      if (path.match(/^\/api\/purchase-orders\/[^/]+\/debit-note$/)   && method==="POST") return handleCreateDebitNote(request,env,path);
      if (path.match(/^\/api\/purchase-orders\/[^/]+\/debit-notes$/)  && method==="GET")  return handleListDebitNotes(request,env,path);

      // Delivery Challans
      if (path==="/api/delivery-calendar/settings"                   && method==="GET")  return handleGetDcalSettings(request,env);
      if (path==="/api/delivery-calendar/settings"                   && method==="POST") return handleSaveDcalSettings(request,env);
      if (path==="/api/delivery-calendar/run-reminders"              && method==="POST") return handleRunDcalReminders(request,env);
      if (path==="/api/standing-orders"                              && method==="GET")  return handleListStandingOrders(request,env);
      if (path.match(/^\/api\/standing-orders\/[^/]+\/skip$/)        && method==="POST") return handleSkipStandingOrder(request,env,path);
      if (path.match(/^\/api\/standing-orders\/[^/]+\/materialize$/) && method==="POST") return handleMaterializeStandingOrder(request,env,path);
      if (path==="/api/delivery-challans"                            && method==="GET")  return handleListDCs(request,env);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/bill$/)     && method==="POST") return handleBillDC(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/deliver$/)  && method==="POST") return handleDeliverDC(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/partial$/)  && method==="POST") return handlePartialDelivery(request,env,path);

      // Clients
      if (path==="/api/clients"  && method==="GET")  return handleListClients(request,env);
      if (path==="/api/clients"  && method==="POST") return handleAddClient(request,env);
      if (path.match(/^\/api\/clients\/[^/]+\/budget$/) && method==="GET") return handleClientBudget(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+\/catalog$/) && method==="GET")    return handleGetClientCatalog(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+\/catalog$/) && method==="POST")   return handleAddClientCatalogItems(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+\/catalog\/[^/]+$/) && method==="PATCH")  return handlePatchClientCatalogItem(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+\/catalog\/[^/]+$/) && method==="DELETE") return handleRemoveClientCatalogItem(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+$/) && method==="PATCH") return handlePatchClient(request,env,path);

      // Tickets
      if (path==="/api/tickets"                     && method==="GET")   return handleListTickets(request,env);
      if (path==="/api/tickets"                     && method==="POST")  return handleCreateTicket(request,env);
      if (path.match(/^\/api\/tickets\/[^/]+$/)     && method==="PATCH") return handlePatchTicket(request,env,path);
      if (path.match(/^\/api\/tickets\/[^/]+\/comments$/) && method==="GET")  return handleListTicketComments(request,env,path);
      if (path.match(/^\/api\/tickets\/[^/]+\/comments$/) && method==="POST") return handleAddTicketComment(request,env,path);

      // Users
      if (path==="/api/users"                   && method==="GET")   return handleListUsers(request,env);
      if (path==="/api/users"                   && method==="POST")  return handleCreateUser(request,env);
      if (path.match(/^\/api\/users\/[^/]+$/)   && method==="PATCH") return handlePatchUser(request,env,path);

      // Profile (self)
      if (path==="/api/profile" && method==="GET")   return handleGetProfile(request,env);
      if (path==="/api/profile" && method==="PATCH") return handlePatchProfile(request,env);

      // Notifications
      if (path==="/api/notifications"             && method==="GET")  return handleListNotifications(request,env);
      if (path==="/api/notifications/read-all"    && method==="POST") return handleReadAllNotifications(request,env);

      // Dashboard
      if (path==="/api/dashboard"  && method==="GET") return handleDashboard(request,env);
      if (path==="/api/alerts"     && method==="GET") return handleAlerts(request,env);
      if (path==="/api/nav-badges" && method==="GET") return handleNavBadges(request,env);

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
      // Gap 4b: Zoho Inventory sync
      if (path==="/api/integrations/zoho-inventory/status"  && method==="GET")  return handleZohoInvStatus(request,env);
      if (path==="/api/integrations/zoho-inventory/toggle"  && method==="POST") return handleZohoInvToggle(request,env);
      if (path==="/api/integrations/zoho-inventory/sync"    && method==="POST") return handleZohoInvSync(request,env);
      if (path==="/api/integrations/zoho-inventory/webhook" && method==="POST") return handleZohoInvWebhook(request,env);

      // Feature 15.X: Fulfilment & Reconciliation reports (must be before generic reports regex)
      if (path==="/api/reports/order-vs-delivery"    && method==="GET") return handleRptOrderVsDelivery(request,env);
      if (path==="/api/reports/brand-procurement"    && method==="GET") return handleRptBrandProcurement(request,env);
      if (path==="/api/reports/brand-procurement-items" && method==="GET") return handleRptBrandProcurementItems(request,env);
      if (path==="/api/reports/due-items"            && method==="GET") return handleRptDueItems(request,env);
      if (path==="/api/reports/dc-per-order"         && method==="GET") return handleRptDCPerOrder(request,env);
      if (path==="/api/reports/order-dcs"             && method==="GET") return handleRptOrderDCs(request,env);
      if (path==="/api/reports/dc-reconciliation"    && method==="GET") return handleRptDCReconciliation(request,env);
      if (path==="/api/reports/over-delivery-audit"  && method==="GET") return handleRptOverDeliveryAudit(request,env);
      if (path==="/api/reports/over-delivery-audit/repair" && method==="POST") return handleRepairOverDelivery(request,env);
      if (path==="/api/reports/pending-supply"       && method==="GET") return handleRptPendingSupply(request,env);
      if (path==="/api/reports/due-ageing"           && method==="GET") return handleRptDueAgeing(request,env);
      if (path==="/api/reports/brand-shortfall"      && method==="GET") return handleRptBrandShortfall(request,env);
      if (path==="/api/reports/client-fulfilment"    && method==="GET") return handleRptClientFulfilment(request,env);
      if (path==="/api/reports/procurement-forecast" && method==="GET") return handleRptProcurementForecast(request,env);
      if (path==="/api/reports/consolidated-orders"  && method==="GET") return handleRptConsolidatedOrders(request,env);
      if (path==="/api/reports/order-consolidation"       && method==="GET") return handleRptOrderConsolidation(request,env);
      if (path==="/api/reports/order-consolidation/drill" && method==="GET") return handleRptOrderConsolidationDrill(request,env);
      if (path==="/api/reports/consolidated-due"     && method==="GET") return handleRptConsolidatedDue(request,env);
      if (path==="/api/reports/client-summary"       && method==="GET") return handleRptClientSummary(request,env);
      if (path==="/api/reports/client-consumption"  && method==="GET") return handleRptClientConsumption(request,env);
      if (path==="/api/reports/client-spend"        && method==="GET") return handleRptClientSpend(request,env);
      if (path==="/api/reports/order-fulfilment-monthly" && method==="GET") return handleRptOrderFulfilmentMonthly(request,env);
      if (path==="/api/reports/category-breakdown"  && method==="GET") return handleRptCategoryBreakdown(request,env);
      if (path==="/api/reports/exec-summary"        && method==="GET") return handleRptExecSummary(request,env);
      if (path==="/api/reports/tower-radar"         && method==="GET") return handleTowerRadar(request,env);
      if (path==="/api/reports/drill"               && method==="GET") return handleRptDrill(request,env);
      if (path==="/api/reports/sku-challans"        && method==="GET") return handleRptSkuChallans(request,env);

      // Gap 12: Reports data
      if (path.match(/^\/api\/reports\/[^/]+$/) && method==="GET") return handleReportData(request,env,path);

      // Categories
      if (path==="/api/categories"  && method==="GET") return handleListCategories(request,env);

      // Feature 16: Delivery routes
      if (path==="/api/delivery-routes"                         && method==="GET")   return handleListDeliveryRoutes(request,env);
      if (path==="/api/delivery-routes"                         && method==="POST")  return handleCreateDeliveryRoute(request,env);
      if (path.match(/^\/api\/delivery-routes\/[^/]+$/)         && method==="PATCH") return handlePatchDeliveryRoute(request,env,path);

      // Feature 17: Dunning
      if (path==="/api/dunning-rules"                           && method==="GET")   return handleListDunningRules(request,env);
      if (path==="/api/dunning-rules"                           && method==="POST")  return handleCreateDunningRule(request,env);
      if (path==="/api/dunning/run"                             && method==="POST")  return handleRunDunning(request,env);
      if (path==="/api/dunning-events"                          && method==="GET")   return handleListDunningEvents(request,env);

      // Feature 18: CSV Import
      if (path==="/api/import/inventory"                        && method==="POST")  return handleImportInventory(request,env);
      if (path==="/api/import/orders"                           && method==="POST")  return handleImportOrders(request,env);
      if (path==="/api/import/vendors"                          && method==="POST")  return handleImportVendors(request,env);
      if (path==="/api/import-jobs"                             && method==="GET")   return handleListImportJobs(request,env);

      // Feature 19: Templates
      if (path==="/api/order-templates"                         && method==="GET")   return handleListOrderTemplates(request,env);
      if (path==="/api/order-templates"                         && method==="POST")  return handleCreateOrderTemplate(request,env);
      if (path.match(/^\/api\/order-templates\/[^/]+$/)         && method==="DELETE") return handleDeleteOrderTemplate(request,env,path);
      if (path==="/api/po-templates"                            && method==="GET")   return handleListPOTemplates(request,env);
      if (path==="/api/po-templates"                            && method==="POST")  return handleCreatePOTemplate(request,env);
      if (path.match(/^\/api\/po-templates\/[^/]+$/)            && method==="DELETE") return handleDeletePOTemplate(request,env,path);

      // Feature 20: Vendor feedback
      if (path.match(/^\/api\/vendors\/[^/]+\/feedback$/)       && method==="GET")   return handleListVendorFeedback(request,env,path);
      if (path.match(/^\/api\/vendors\/[^/]+\/feedback$/)       && method==="POST")  return handleCreateVendorFeedback(request,env,path);

      // Feature 21: SLA
      if (path==="/api/sla-rules"                               && method==="GET")   return handleListSLARules(request,env);
      if (path==="/api/sla-rules"                               && method==="POST")  return handleCreateSLARule(request,env);
      if (path==="/api/sla-breaches"                            && method==="GET")   return handleListSLABreaches(request,env);
      if (path==="/api/sla/check"                               && method==="POST")  return handleSLACheck(request,env);

      // Feature 22: 2FA
      if (path.match(/^\/api\/users\/[^/]+\/2fa$/)              && method==="PATCH") return handleToggle2FA(request,env,path);

      // Feature 23: Credit
      if (path.match(/^\/api\/clients\/[^/]+\/credit$/)         && method==="GET")   return handleGetClientCredit(request,env,path);
      if (path.match(/^\/api\/clients\/[^/]+\/credit-adjust$/)  && method==="POST")  return handleCreditAdjust(request,env,path);

      // Feature 24: Approval chains
      if (path==="/api/approval-chains"                         && method==="GET")   return handleListApprovalChains(request,env);
      if (path==="/api/approval-chains"                         && method==="POST")  return handleCreateApprovalChain(request,env);
      if (path==="/api/approval-chain-instances"                && method==="GET")   return handleListApprovalChainInstances(request,env);
      if (path.match(/^\/api\/approval-chain-instances\/[^/]+\/act$/) && method==="POST") return handleApprovalChainAct(request,env,path);

      if (path.match(/^\/api\/delivery-challans\/[^/]+\/dispatch$/) && method==="POST") return handleDispatchDC(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/items$/) && method==="GET") return handleListDCItems(request,env,path);
      if (path==="/api/stock-movements" && method==="GET") return handleListStockMovements(request,env);

      // New bin-location routes
      if (path==="/api/bin-locations" && method==="POST") return handleAddBin(request,env);
      if (path.match(/^\/api\/bin-locations\/[^/]+$/) && method==="PATCH") return handlePatchBin(request,env,path);

      // New delivery-challan routes
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/pod$/) && method==="POST") return handleMarkPOD(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/scan$/) && method==="POST") return handleMarkScan(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/pod\/upload$/) && method==="POST") return handleUploadDCDoc(request,env,path,"pod");
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/scan\/upload$/) && method==="POST") return handleUploadDCDoc(request,env,path,"scan");
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/voice\/upload$/) && method==="POST") return handleUploadDCDoc(request,env,path,"voice");
      if (path==="/api/returns"                                  && method==="GET")  return handleListReturns(request,env);
      if (path.match(/^\/api\/returns\/[^/]+\/approve$/)        && method==="POST") return handleReviewReturn(request,env,path,"APPROVED");
      if (path.match(/^\/api\/returns\/[^/]+\/reject$/)         && method==="POST") return handleReviewReturn(request,env,path,"REJECTED");
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/documents$/) && method==="GET") return handleListDCDocs(request,env,path);
      if (path.match(/^\/api\/delivery-challans\/[^/]+\/return$/) && method==="POST") return handleReturnDC(request,env,path);

      // Stock transfers
      if (path==="/api/stock-transfers"       && method==="POST") return handleStockTransfer(request,env);

      // Staff master
      if (path==="/api/staff"                              && method==="GET")   return handleListStaff(request,env);
      if (path==="/api/staff"                              && method==="POST")  return handleAddStaff(request,env);
      if (path.match(/^\/api\/staff\/[^/]+$/)              && method==="PATCH") return handlePatchStaff(request,env,path);

      // Delivery schedule
      if (path==="/api/delivery/today"                     && method==="GET")   return handleTodaySchedule(request,env);
      if (path.match(/^\/api\/delivery-challans\/[^/]+$/)  && method==="PATCH") return handlePatchDC(request,env,path);

      // Porter expenses
      if (path==="/api/porter-expenses"                    && method==="GET")   return handleListPorterExpenses(request,env);
      if (path==="/api/porter-expenses"                    && method==="POST")  return handleAddPorterExpense(request,env);

      // Delivery returns
      if (path==="/api/delivery-returns"                   && method==="GET")   return handleListDeliveryReturns(request,env);
      if (path==="/api/delivery-returns"                   && method==="POST")  return handleAddDeliveryReturn(request,env);

      // Feature 25: Client store inventory tracking
      if (path==="/api/client-inventory"                   && method==="GET")   return handleListClientInventory(request,env);
      if (path==="/api/client-inventory/sync"              && method==="POST")  return handleSyncClientInventory(request,env);
      if (path==="/api/client-inventory/consume"           && method==="POST")  return handleClientConsume(request,env);
      if (path==="/api/client-inventory/consumption"       && method==="GET")   return handleListClientConsumption(request,env);
      if (path.match(/^\/api\/client-inventory\/[^/]+$/)  && method==="PATCH") return handlePatchClientInventory(request,env,path);

      return json({error:"Not found"}, 404);
    };

    try {
      return withSecurityHeaders(await route());
    } catch (err) {
      console.error(err);
      return withSecurityHeaders(json({error:"Internal server error"}, 500));
    }
  },
} satisfies ExportedHandler<Env>;

// ════════════════════════════════════════════════════════════════════
// AUTH + OTP (Gap 13)
// ════════════════════════════════════════════════════════════════════

// ---- Login brute-force throttle (per email) ----
const LOGIN_MAX_FAILS = 5;      // attempts before lockout
const LOGIN_WINDOW_MIN = 15;    // rolling window for counting failures
const LOGIN_LOCKOUT_MIN = 15;   // lockout duration once tripped

async function loginLockedFor(env: Env, email: string): Promise<number> {
  try {
    const row = await env.DB.prepare("SELECT locked_until FROM login_throttle WHERE email=?")
      .bind(email).first() as { locked_until?: string } | null;
    if (row?.locked_until) {
      const ms = Date.parse(row.locked_until) - Date.now();
      if (ms > 0) return Math.ceil(ms / 1000); // seconds remaining
    }
  } catch { /* table missing — treat as unlocked */ }
  return 0;
}
async function loginRecordFail(env: Env, email: string): Promise<void> {
  const now = Date.now();
  try {
    const row = await env.DB.prepare("SELECT fails, first_fail FROM login_throttle WHERE email=?")
      .bind(email).first() as { fails?: number; first_fail?: string } | null;
    const firstMs = row?.first_fail ? Date.parse(row.first_fail) : now;
    const withinWindow = row && (now - firstMs) <= LOGIN_WINDOW_MIN * 60000;
    const fails = withinWindow ? (Number(row?.fails) || 0) + 1 : 1;
    const firstFail = withinWindow ? (row?.first_fail as string) : new Date(now).toISOString();
    const lockedUntil = fails >= LOGIN_MAX_FAILS ? new Date(now + LOGIN_LOCKOUT_MIN * 60000).toISOString() : null;
    await env.DB.prepare("INSERT OR REPLACE INTO login_throttle (email, fails, first_fail, locked_until) VALUES (?,?,?,?)")
      .bind(email, fails, firstFail, lockedUntil).run();
  } catch { /* non-fatal */ }
}
async function loginClearFails(env: Env, email: string): Promise<void> {
  try { await env.DB.prepare("DELETE FROM login_throttle WHERE email=?").bind(email).run(); } catch { /* ignore */ }
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const { email, password } = await request.json() as {email:string;password:string};
  if (!email || !password) return json({error:"Email and password required"}, 400);
  const emailKey = String(email).toLowerCase();

  const locked = await loginLockedFor(env, emailKey);
  if (locked > 0) {
    return json({ error: `Too many failed attempts. Try again in about ${Math.ceil(locked/60)} minute(s).` }, 429);
  }

  const row = await env.DB.prepare("SELECT * FROM users WHERE email=? AND active=1").bind(email).first() as Record<string,string>|null;
  if (!row) { await loginRecordFail(env, emailKey); return json({error:"Invalid credentials"}, 401); }

  let valid = false, wasSeed = false;
  const hash = row.password_hash;
  if (hash.startsWith("hash:")) valid = await verifyPassword(password, hash.slice(5));
  // Legacy demo/seed accounts stored the password in plaintext (SEED:). Still
  // accept them during the transition, but upgrade to PBKDF2 on the spot below so
  // plaintext is removed. Startup migration handles accounts that never log in.
  // Seed accounts use a well-known password — never accept them in production,
  // even if the startup migration has not yet disabled them on this isolate.
  else if (hash.startsWith("SEED:") && !isProd(env)) { valid = password === hash.slice(5); wasSeed = valid; }
  if (!valid) { await loginRecordFail(env, emailKey); return json({error:"Invalid credentials"}, 401); }

  await loginClearFails(env, emailKey); // successful credentials — reset the counter
  if (wasSeed) {
    try { await env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?")
      .bind("hash:" + await hashPassword(password), row.id).run(); } catch { /* non-fatal */ }
  }

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
    ...(row.client_id ? { client_id: row.client_id } : {}),
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 86400*7,
  };
  const token = await signJWT(payload, env.JWT_SECRET);
  await audit(env, payload, "LOGIN", "user", row.id);
  return json({token, user: payload});
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  if (!user) return json({error:"Unauthorized"}, 401);
  // The JWT's `org` is a snapshot from login; for client users keep it in sync
  // with the live client name so a rename shows everywhere without re-login.
  if (user.client_id) {
    try {
      const c = await env.DB.prepare("SELECT name FROM clients WHERE id=?").bind(user.client_id).first() as {name?:string}|null;
      if (c?.name) user.org = c.name;
    } catch { /* clients row missing — keep token value */ }
  }
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

  let query = `SELECT o.*,c.name as client_name,u.name as creator_name,
    (SELECT COUNT(*) FROM order_items WHERE order_id=o.id) AS item_count,
    (SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id=o.id) AS total_qty
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id WHERE 1=1`;
  const params: string[] = [];

  if (["client_admin","client_approver","client_user"].includes(user!.role)) {
    if (user!.client_id) {
      query += " AND o.client_id=?"; params.push(user!.client_id);
    } else {
      // fallback: match by email domain
      const domain = user!.email.split("@")[1];
      const c = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,string>|null;
      if (c) { query += " AND o.client_id=?"; params.push(c.id); }
    }
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
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id WHERE o.id=?`).bind(id).first() as Record<string,unknown>|null;
  if (!order) return json({error:"Not found"}, 404);
  const scoped = orderScopeDenied(user!, order); if (scoped) return scoped;

  const [{results:items},{results:history},{results:comments}] = await Promise.all([
    env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_history WHERE order_id=? ORDER BY created_at").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_comments WHERE order_id=? ORDER BY created_at").bind(id).all(),
  ]);
  return json({...order, items, history, comments});
}

// ── Order lifecycle & pipeline (single-order timeline + control-tower board) ──
// Both are read-model PROJECTIONS assembled from timestamps that already exist
// (orders, order_history, purchase_orders, delivery_challans) — no new writes.

// Canonical stage an order's status is "sitting in" — the board buckets.
type StageKey = "approval"|"inventory"|"vendor_po"|"dispatch"|"delivery"|"pod"|"billing"|"done";
const STAGE_META: Record<StageKey,{no:number;label:string}> = {
  approval:{no:3,label:"Approval"}, inventory:{no:4,label:"Inventory"}, vendor_po:{no:5,label:"Vendor PO"},
  dispatch:{no:6,label:"Dispatch"}, delivery:{no:8,label:"Delivery"}, pod:{no:9,label:"POD"},
  billing:{no:10,label:"Billing"}, done:{no:11,label:"Closed"},
};
function stageFromStatus(status: string): StageKey {
  switch (status) {
    case "DRAFT": case "PENDING_PRICING": case "SUBMITTED": case "PENDING_APPROVAL": return "approval";
    case "APPROVED": case "ACKNOWLEDGED": case "INVENTORY_CHECK": return "inventory";
    case "VENDOR_PO_RAISED": return "vendor_po";
    case "READY_TO_PICK": case "PICKED": case "QUALITY_CHECK": return "dispatch";
    case "IN_SHIPMENT": case "PARTIALLY_CLOSED": return "delivery";
    default: return "done"; // CLOSED etc. refined by DC state
  }
}
// Per-stage SLA targets (days) — dwell beyond this flags a card overdue.
// Admin-editable via /api/pipeline/sla; these are the fallback defaults.
const SLA_DEFAULTS: Record<string,number> = { approval:1, inventory:1, vendor_po:2, dispatch:1, delivery:2, pod:1, billing:2 };
const SLA_RISK_PACE_DEFAULT = 0.6; // flag "at risk" once this share of target is used
type SlaConfig = { targets: Record<string,number>; risk_pace: number };
async function getSlaConfig(env: Env): Promise<SlaConfig> {
  try {
    const raw = await getConfig(env, "pipeline_sla", "");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SlaConfig>;
      return {
        targets: { ...SLA_DEFAULTS, ...(parsed.targets || {}) },
        risk_pace: typeof parsed.risk_pace === "number" ? parsed.risk_pace : SLA_RISK_PACE_DEFAULT,
      };
    }
  } catch { /* fall through to defaults */ }
  return { targets: { ...SLA_DEFAULTS }, risk_pace: SLA_RISK_PACE_DEFAULT };
}
const hoursBetween = (a: string, b: number) => (b - new Date(String(a).replace(" ","T")+"Z").getTime()) / 3600000;
function fmtDwell(hrs: number): string {
  if (!isFinite(hrs) || hrs < 0) return "—";
  if (hrs < 24) return `${Math.max(1,Math.round(hrs))}h`;
  const d = Math.floor(hrs/24), h = Math.round(hrs%24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

// GET /api/orders/:id/lifecycle — the 10-stage timeline for one order.
async function handleOrderLifecycle(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];

  const order = await env.DB.prepare(`SELECT o.*, c.name AS client_name, c.zone AS client_zone, c.gstin AS client_gstin,
      u.name AS creator_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id
      WHERE o.id=?`).bind(id).first() as Record<string,unknown> | null;
  if (!order) return json({error:"Not found"}, 404);
  // External roles only see their own client's orders.
  if (isExternalRole(user!.role) && user!.client_id && order.client_id !== user!.client_id) return json({error:"Forbidden"}, 403);

  const [{results:history},{results:pos},{results:dcs}] = await Promise.all([
    env.DB.prepare("SELECT from_status,to_status,actor_name,note,created_at FROM order_history WHERE order_id=? ORDER BY created_at").bind(id).all(),
    env.DB.prepare(`SELECT p.id,p.status,p.created_at,p.grand_total,v.name AS vendor_name
      FROM purchase_orders p LEFT JOIN vendors v ON p.vendor_id=v.id WHERE p.order_id=? ORDER BY p.created_at`).bind(id).all().catch(()=>({results:[]})),
    env.DB.prepare(`SELECT dc_number,status,dispatched_at,delivered_at,pod_uploaded,billed,billed_at,total_qty,delivered_qty,driver_name,vehicle_no
      FROM delivery_challans WHERE order_id=? ORDER BY dispatched_at`).bind(id).all().catch(()=>({results:[]})),
  ]);
  const H = history as Array<Record<string,string>>;
  const POs = pos as Array<Record<string,unknown>>;
  const DCs = dcs as Array<Record<string,unknown>>;
  const hasTo = (s: string) => H.some(h => h.to_status === s);
  const histAt = (s: string) => H.find(h => h.to_status === s)?.created_at || null;
  const nowMs = Date.now();
  const reached = (st: string) => hasTo(st) || false;

  type Sub = { text: string; at: string|null; wait?: boolean };
  type Stage = { key: string; no: number; label: string; state: "done"|"current"|"pending"|"skipped";
    at: string|null; actor?: string|null; note?: string; refs?: string[]; subs?: Sub[]; tag?: string };
  const stages: Stage[] = [];

  // 01 Client (context)
  stages.push({ key:"client", no:1, label:"Client", state:"done", at:null,
    note:`${order.client_name||"—"}${order.client_zone?` · ${order.client_zone} zone`:""}${order.client_gstin?` · GSTIN ${order.client_gstin}`:""}` });

  // 02 Budget (advisory, at order time)
  stages.push({ key:"budget", no:2, label:"Budget", state:"done", at:String(order.created_at||""), tag:"Advisory",
    note:"Checked at order time — advisory, not enforced." });

  // 03 Order
  const orderSubs: Sub[] = H.filter(h => ["SUBMITTED","PENDING_APPROVAL","APPROVED"].includes(h.to_status)).map(h => ({
    text: h.to_status==="PENDING_APPROVAL" ? `Held for approval${h.note?` — ${h.note}`:""}`
        : h.to_status==="APPROVED" ? `Approved${h.actor_name?` by ${h.actor_name}`:""}`
        : `Submitted${h.actor_name?` by ${h.actor_name}`:""}`,
    at: h.created_at }));
  stages.push({ key:"order", no:3, label:"Order", state:"done", at:String(order.created_at||""),
    actor:String(order.creator_name||""), note:`${order.grand_total?`₹${Number(order.grand_total).toLocaleString("en-IN")}`:""}`.trim(),
    subs: orderSubs.length?orderSubs:undefined });

  // 04 Inventory
  const invReached = reached("INVENTORY_CHECK") || reached("READY_TO_PICK") || reached("VENDOR_PO_RAISED") || DCs.length>0;
  stages.push({ key:"inventory", no:4, label:"Inventory",
    state: invReached ? (order.status==="INVENTORY_CHECK"?"current":"done") : (order.status==="INVENTORY_CHECK"?"current":"pending"),
    at: histAt("INVENTORY_CHECK"),
    note: POs.length ? `Shortage → ${POs.length} line(s) routed to procurement` : (invReached?"Stock checked & reserved":"Awaiting stock check"),
    tag: POs.length?"Shortage → branch":undefined });

  // 05 Vendor PO (skipped when in stock)
  if (POs.length) {
    const poSubs: Sub[] = POs.map(p => ({ text:`${p.po_number||p.id} → ${p.vendor_name||"vendor"} · ${p.status}`, at:String(p.created_at||"") }));
    const poDone = POs.every(p => ["RECEIVED","INVOICED","CLOSED"].includes(String(p.status)));
    stages.push({ key:"vendor_po", no:5, label:"Vendor PO",
      state: order.status==="VENDOR_PO_RAISED" && !poDone ? "current" : (invReached?"done":"pending"),
      at:String(POs[0].created_at||""), subs:poSubs, refs:POs.map(p=>String(p.po_number||p.id)) });
  } else {
    stages.push({ key:"vendor_po", no:5, label:"Vendor PO", state:"skipped", at:null, note:"Not required — fulfilled from stock." });
  }

  const dispatched = DCs.filter(d => d.dispatched_at);
  const delivered  = DCs.filter(d => d.delivered_at);
  const podDone    = DCs.filter(d => Number(d.pod_uploaded)===1);
  const billed     = DCs.filter(d => Number(d.billed)===1);
  const dcState = (haveAll: boolean, haveSome: boolean, activeStatuses: string[]): Stage["state"] =>
    haveAll ? "done" : (haveSome || activeStatuses.includes(String(order.status)) ? "current" : "pending");

  // 06 Dispatch
  stages.push({ key:"dispatch", no:6, label:"Dispatch",
    state: dcState(dispatched.length>0 && dispatched.length===Math.max(DCs.length,1) && DCs.length>0, dispatched.length>0, ["READY_TO_PICK","PICKED","QUALITY_CHECK"]),
    at: dispatched[0]?String(dispatched[0].dispatched_at):null,
    subs: dispatched.length?dispatched.map(d=>({text:`${d.dc_number||"DC"} dispatched — ${d.total_qty||0} units${d.vehicle_no?` · ${d.vehicle_no}`:""}${d.driver_name?` · ${d.driver_name}`:""}`, at:String(d.dispatched_at)})):undefined });

  // 07 Delivery Challan
  stages.push({ key:"dc", no:7, label:"Delivery Challan",
    state: DCs.length ? "done" : "pending",
    at: dispatched[0]?String(dispatched[0].dispatched_at):null,
    tag: DCs.length>1?`${DCs.length} challans`:undefined,
    refs: DCs.map(d=>`${d.dc_number||"DC"}${d.total_qty?` · ${d.total_qty}`:""}`) });

  // 08 Delivery
  const allDelivered = DCs.length>0 && delivered.length===DCs.length;
  stages.push({ key:"delivery", no:8, label:"Delivery",
    state: dcState(allDelivered, delivered.length>0, ["IN_SHIPMENT","PARTIALLY_CLOSED"]),
    at: delivered[0]?String(delivered[0].delivered_at):null,
    subs: DCs.length?DCs.map(d=>({ text: d.delivered_at?`${d.dc_number||"DC"} delivered — ${d.delivered_qty||d.total_qty||0} received`:`${d.dc_number||"DC"} in transit`, at: d.delivered_at?String(d.delivered_at):null, wait: !d.delivered_at })):undefined });

  // 09 POD
  const allPod = DCs.length>0 && podDone.length===DCs.length;
  stages.push({ key:"pod", no:9, label:"POD",
    state: allPod ? "done" : (podDone.length>0 ? "current" : "pending"),
    at: null, tag: DCs.length>1?`${podDone.length} of ${DCs.length}`:undefined,
    subs: DCs.length?DCs.map(d=>({ text:`${d.dc_number||"DC"} POD ${Number(d.pod_uploaded)===1?"uploaded":"pending"}`, at:null, wait: Number(d.pod_uploaded)!==1 })):undefined,
    note: DCs.length?undefined:"Awaiting delivery." });

  // 10 Billing
  const allBilled = DCs.length>0 && billed.length===DCs.length;
  stages.push({ key:"billing", no:10, label:"Billing",
    state: allBilled ? "done" : "pending",
    at: billed[0]?String(billed[0].billed_at):null,
    note: allBilled?"Billed.":"Awaiting full delivery & POD before billing." });

  // Current = first non-terminal stage that isn't done/skipped.
  const current = stages.find(s => s.state==="current") || stages.find(s => s.state==="pending");
  const doneCount = stages.filter(s => s.state==="done").length;

  return json({
    order: { id: order.id, client_name: order.client_name, grand_total: order.grand_total,
      status: order.status, created_at: order.created_at, creator_name: order.creator_name },
    stages, current_key: current?current.key:"billing",
    progress: { done: doneCount, total: stages.length },
    elapsed: fmtDwell(hoursBetween(String(order.created_at||new Date().toISOString()), nowMs)),
  });
}

// GET /api/pipeline — control-tower board: in-flight orders bucketed by stage + KPIs.
async function handlePipeline(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);

  const { results: orders } = await env.DB.prepare(`SELECT o.id,o.status,o.grand_total,o.created_at,c.name AS client_name
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT') ORDER BY o.created_at DESC LIMIT 400`).all();

  // DC roll-up per order (delivered / POD / billed counts) to refine the tail stages.
  const dcAgg: Record<string,{n:number;deliv:number;pod:number;billed:number;po:string|null}> = {};
  try {
    const { results } = await env.DB.prepare(`SELECT order_id,
      COUNT(*) n, SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) deliv,
      SUM(COALESCE(pod_uploaded,0)) pod, SUM(COALESCE(billed,0)) billed
      FROM delivery_challans WHERE order_id IS NOT NULL GROUP BY order_id`).all();
    for (const r of results as Array<Record<string,unknown>>) dcAgg[String(r.order_id)] = { n:Number(r.n), deliv:Number(r.deliv), pod:Number(r.pod), billed:Number(r.billed), po:null };
  } catch { /* table pending */ }
  // Last activity per order (for stage dwell).
  const lastAt: Record<string,string> = {};
  try {
    const { results } = await env.DB.prepare(`SELECT order_id, MAX(created_at) t FROM order_history GROUP BY order_id`).all();
    for (const r of results as Array<Record<string,unknown>>) lastAt[String(r.order_id)] = String(r.t);
  } catch { /* */ }
  // PO ref per order (first PO) for card display.
  const poRef: Record<string,string> = {};
  try {
    const { results } = await env.DB.prepare(`SELECT order_id, MIN(id) p FROM purchase_orders WHERE order_id IS NOT NULL GROUP BY order_id`).all();
    for (const r of results as Array<Record<string,unknown>>) if (r.p) poRef[String(r.order_id)] = String(r.p);
  } catch { /* */ }

  const nowMs = Date.now();
  const slaCfg = await getSlaConfig(env);
  const order: StageKey[] = ["approval","inventory","vendor_po","dispatch","delivery","pod","billing"];
  const buckets: Record<string,{ key:string; no:number; label:string; count:number; value:number; dwellSum:number; orders:Array<Record<string,unknown>> }> = {};
  for (const k of order) buckets[k] = { key:k, no:STAGE_META[k].no, label:STAGE_META[k].label, count:0, value:0, dwellSum:0, orders:[] };
  const recent: Array<Record<string,unknown>> = []; // newest-first, for the Home widget

  let inflight=0, value=0, overdue=0;
  for (const o of orders as Array<Record<string,unknown>>) {
    const oid = String(o.id); const status = String(o.status);
    let key = stageFromStatus(status);
    const agg = dcAgg[oid];
    // Refine the tail: a delivered/closed order still sits in POD or Billing until those clear.
    if (key==="done" || status==="PARTIALLY_CLOSED" || status==="CLOSED") {
      if (agg && agg.n>0) {
        if (agg.deliv < agg.n) key = "delivery";
        else if (agg.pod < agg.n) key = "pod";
        else if (agg.billed < agg.n) key = "billing";
        else key = "done";
      } else if (status==="CLOSED") key = "done";
    }
    if (key==="done" || !buckets[key]) continue; // fully complete — off the board
    const dwellH = hoursBetween(lastAt[oid] || String(o.created_at), nowMs);
    const target = slaCfg.targets[key] ?? 2;
    const isLate = dwellH > target*24;
    const slaState = isLate ? "late" : (dwellH > target*24*slaCfg.risk_pace ? "risk" : "ok");
    const b = buckets[key];
    inflight++; value += Number(o.grand_total)||0; if (isLate) overdue++;
    b.count++; b.value += Number(o.grand_total)||0; b.dwellSum += dwellH;
    if (b.orders.length < 25) b.orders.push({
      id: oid, client_name: o.client_name, value: Number(o.grand_total)||0,
      dwell: fmtDwell(dwellH), dwell_h: Math.round(dwellH),
      sla: slaState, po_ref: poRef[oid] || null,
      flag: isLate || (key==="inventory" && !!poRef[oid]),
    });
    // orders arrive newest-first (ORDER BY created_at DESC) — take the first few.
    if (recent.length < 6) recent.push({
      id: oid, client_name: o.client_name, value: Number(o.grand_total)||0,
      stage_key: key, stage_no: STAGE_META[key].no, stage_label: STAGE_META[key].label,
      dwell: fmtDwell(dwellH), sla: slaState,
    });
  }

  const bucketList = order.map(k => ({ ...buckets[k], avg_dwell: buckets[k].count?fmtDwell(buckets[k].dwellSum/buckets[k].count):"—",
    orders: buckets[k].orders.sort((a,b)=>Number(b.dwell_h)-Number(a.dwell_h)) }));
  const busiest = [...bucketList].filter(b=>b.count>0).sort((a,b)=>b.dwellSum/(b.count||1) - a.dwellSum/(a.count||1))[0];

  // Avg cycle time: created → last delivery, over the last 30 days.
  let avgCycle = "—";
  try {
    const row = await env.DB.prepare(`SELECT ROUND(AVG(julianday(dc.delivered_at)-julianday(o.created_at)),1) d
      FROM orders o JOIN delivery_challans dc ON dc.order_id=o.id
      WHERE dc.delivered_at IS NOT NULL AND dc.delivered_at >= datetime('now','-30 day')`).first() as {d:number}|null;
    if (row && row.d != null) avgCycle = `${row.d}d`;
  } catch { /* */ }

  return json({
    kpis: { inflight, value, overdue, avg_cycle: avgCycle,
      bottleneck: busiest ? { label: busiest.label, avg_dwell: busiest.avg_dwell } : null },
    buckets: bucketList.map(({dwellSum, ...b})=>b),
    recent,
  });
}

// Each pipeline stage reduces to ONE blocking next step — the verb, the owning
// desk, why it's blocking, and where to act. Powers the "Next Best Action" queue.
const ACTION_MAP: Record<StageKey,{verb:string;owner:string;why:string;page:string}> = {
  approval:  { verb:"Approve order",       owner:"Approvals",   why:"Awaiting approval before fulfilment can start", page:"orders" },
  inventory: { verb:"Confirm stock",       owner:"Ops desk",    why:"Stock not yet confirmed — allocate or raise a PO", page:"orders" },
  vendor_po: { verb:"Progress vendor PO",  owner:"Procurement", why:"Waiting on goods from the vendor", page:"procurement" },
  dispatch:  { verb:"Dispatch challan",    owner:"Warehouse",   why:"Picked & ready — challan not yet dispatched", page:"fulfilment" },
  delivery:  { verb:"Confirm delivery",    owner:"Delivery",    why:"In transit — confirm delivery on arrival", page:"delivery" },
  pod:       { verb:"Capture POD",         owner:"Delivery",    why:"Delivered — proof of delivery still pending", page:"delivery" },
  billing:   { verb:"Raise invoice",       owner:"Finance",     why:"Delivered — invoice not yet raised", page:"dc_billing" },
  done:      { verb:"—",                   owner:"—",           why:"", page:"orders" },
};

// GET /api/pipeline/next-actions — every in-flight order reduced to its single
// blocking next step, ranked by SLA urgency. Reuses the /api/pipeline read-model
// (order_history / PO / DC timestamps) — no new tables, no writes.
async function handleNextActions(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);

  const { results: orders } = await env.DB.prepare(`SELECT o.id,o.status,o.grand_total,o.created_at,c.name AS client_name
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT','CLOSED') ORDER BY o.created_at DESC LIMIT 400`).all();

  const dcAgg: Record<string,{n:number;deliv:number;pod:number;billed:number}> = {};
  try {
    const { results } = await env.DB.prepare(`SELECT order_id,
      COUNT(*) n, SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) deliv,
      SUM(COALESCE(pod_uploaded,0)) pod, SUM(COALESCE(billed,0)) billed
      FROM delivery_challans WHERE order_id IS NOT NULL AND status!='CANCELLED' GROUP BY order_id`).all();
    for (const r of results as Array<Record<string,unknown>>) dcAgg[String(r.order_id)] = { n:Number(r.n), deliv:Number(r.deliv), pod:Number(r.pod), billed:Number(r.billed) };
  } catch { /* table pending */ }
  const lastAt: Record<string,string> = {};
  try {
    const { results } = await env.DB.prepare(`SELECT order_id, MAX(created_at) t FROM order_history GROUP BY order_id`).all();
    for (const r of results as Array<Record<string,unknown>>) lastAt[String(r.order_id)] = String(r.t);
  } catch { /* */ }

  const nowMs = Date.now();
  const slaCfg = await getSlaConfig(env);
  const rank = { late:0, risk:1, ok:2 } as const;
  const actions: Array<Record<string,unknown>> = [];
  let overdue = 0, atRisk = 0;

  for (const o of orders as Array<Record<string,unknown>>) {
    const oid = String(o.id); const status = String(o.status);
    let key = stageFromStatus(status);
    const agg = dcAgg[oid];
    if (key==="done" || status==="PARTIALLY_CLOSED") {
      if (agg && agg.n>0) {
        if (agg.deliv < agg.n) key = "delivery";
        else if (agg.pod < agg.n) key = "pod";
        else if (agg.billed < agg.n) key = "billing";
        else key = "done";
      }
    }
    if (key==="done" || !ACTION_MAP[key]) continue;
    const dwellH = hoursBetween(lastAt[oid] || String(o.created_at), nowMs);
    const target = slaCfg.targets[key] ?? 2;
    const isLate = dwellH > target*24;
    const sla = isLate ? "late" : (dwellH > target*24*slaCfg.risk_pace ? "risk" : "ok");
    if (sla==="late") overdue++; else if (sla==="risk") atRisk++;
    const a = ACTION_MAP[key];
    actions.push({
      id: oid, client_name: o.client_name, value: Number(o.grand_total)||0,
      stage_key: key, stage_no: STAGE_META[key].no, stage_label: STAGE_META[key].label,
      action: a.verb, owner: a.owner, why: a.why, page: a.page,
      sla, dwell: fmtDwell(dwellH), dwell_h: Math.round(dwellH),
      sla_target_h: target*24, over_h: Math.max(0, Math.round(dwellH - target*24)),
    });
  }

  // Rank: overdue first, then most overdue by hours, then longest dwell.
  actions.sort((a,b) =>
    rank[a.sla as keyof typeof rank] - rank[b.sla as keyof typeof rank]
    || Number(b.over_h) - Number(a.over_h)
    || Number(b.dwell_h) - Number(a.dwell_h));

  return json({
    counts: { total: actions.length, overdue, at_risk: atRisk, on_track: actions.length - overdue - atRisk },
    focus: actions[0] || null,
    actions,
    generated_at: new Date().toISOString(),
  });
}

// GET /api/pipeline/sla — current SLA targets + at-risk pace (defaults if unset).
async function handleGetSla(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const cfg = await getSlaConfig(env);
  return json({ ...cfg, defaults: SLA_DEFAULTS, stages: STAGE_META });
}

// POST /api/pipeline/sla — save SLA targets. Ops/admin only; values are days.
async function handleSaveSla(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as { targets?: Record<string,unknown>; risk_pace?: unknown };
  const targets: Record<string,number> = {};
  for (const k of Object.keys(SLA_DEFAULTS)) {
    const v = Number((body.targets || {})[k]);
    targets[k] = (isFinite(v) && v > 0 && v <= 60) ? v : SLA_DEFAULTS[k];
  }
  let pace = Number(body.risk_pace);
  if (!isFinite(pace) || pace <= 0 || pace >= 1) pace = SLA_RISK_PACE_DEFAULT;
  const cfg: SlaConfig = { targets, risk_pace: Math.round(pace * 100) / 100 };
  await setConfig(env, "pipeline_sla", JSON.stringify(cfg), user!.sub);
  await audit(env, user, "UPDATE", "config", "pipeline_sla", undefined, JSON.stringify(cfg));
  return json({ ok: true, ...cfg });
}

// ── Location zones (admin-managed, config-backed) ────────────────────
type Zone = { code: string; label: string };
const ZONE_DEFAULTS: Zone[] = [
  { code:"EGL", label:"EGL" }, { code:"BTP", label:"BTP" }, { code:"BTM", label:"BTM" },
  { code:"PV", label:"PV" }, { code:"FW", label:"FW" }, { code:"Other", label:"Other" },
];
async function getZones(env: Env): Promise<Zone[]> {
  try {
    const raw = await getConfig(env, "location_zones", "");
    if (raw) {
      const arr = JSON.parse(raw) as Zone[];
      if (Array.isArray(arr) && arr.length) return arr.filter(z => z && z.code);
    }
  } catch { /* fall through */ }
  return [...ZONE_DEFAULTS];
}
const normZoneCode = (s: unknown) => String(s || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12);

async function handleListZones(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  return json(await getZones(env));
}

async function handleUpsertZone(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as { code?: unknown; label?: unknown };
  const code = normZoneCode(body.code);
  if (!code) return json({error:"Zone code required (letters/digits)"}, 400);
  const label = String(body.label || code).trim().slice(0, 40) || code;
  const zones = await getZones(env);
  const i = zones.findIndex(z => z.code === code);
  if (i >= 0) zones[i] = { code, label }; else zones.push({ code, label });
  await setConfig(env, "location_zones", JSON.stringify(zones), user!.sub);
  await audit(env, user, "UPSERT", "config", "location_zones", undefined, code);
  return json({ ok: true, zones });
}

async function handleDeleteZone(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const code = normZoneCode(decodeURIComponent(path.split("/").pop()!));
  const zones = (await getZones(env)).filter(z => z.code !== code);
  await setConfig(env, "location_zones", JSON.stringify(zones), user!.sub);
  await audit(env, user, "DELETE", "config", "location_zones", code, undefined);
  return json({ ok: true, zones });
}

// GET /api/orders/:id/drilldown — full line-item reconciliation (ordered vs delivered vs due)
async function handleOrderDrilldown(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];

  const [order, {results: orderItems}, {results: dcs}] = await Promise.all([
    env.DB.prepare(`SELECT o.*,c.name as client_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id WHERE o.id=?`).bind(id).first(),
    env.DB.prepare("SELECT * FROM order_items WHERE order_id=? ORDER BY name").bind(id).all(),
    env.DB.prepare(`SELECT dc.id, dc.status, dc.dc_number, dc.dispatched_at, dc.delivered_at,
      dc.total_qty, dc.delivered_qty, dc.driver_name, dc.vehicle_no
      FROM delivery_challans dc WHERE dc.order_id=? ORDER BY dc.dispatched_at`).bind(id).all(),
  ]);
  if (!order) return json({error:"Not found"}, 404);

  // Aggregate delivered qty per SKU across all DELIVERED DCs
  const deliveredBySku: Record<string, number> = {};
  const dcMap: Record<string, {id:string;status:string;dc_number:string|null;delivered_at:string|null;items:Record<string,unknown>[]}> = {};

  for (const dc of dcs as Record<string,string>[]) {
    const {results: dcItems} = await env.DB.prepare(
      "SELECT sku, name, qty_ordered, qty_delivered FROM dc_items WHERE dc_id=?"
    ).bind(dc.id).all();
    dcMap[dc.id] = { ...dc as unknown as {id:string;status:string;dc_number:string|null;delivered_at:string|null}, items: dcItems as Record<string,unknown>[] };

    if (dc.status === 'DELIVERED') {
      // Only fall back to ordered qty when the WHOLE challan recorded nothing
      // (legacy). On a partial challan, a 0 line means 0 — another challan carried it.
      const dcRecorded = (dcItems as Record<string,number>[]).reduce((s, i) => s + (Number(i.qty_delivered) || 0), 0);
      for (const item of dcItems as Record<string,number>[]) {
        const delivered = dcRecorded > 0 ? (Number(item.qty_delivered) || 0) : (Number(item.qty_ordered) || 0);
        deliveredBySku[item.sku as unknown as string] = (deliveredBySku[item.sku as unknown as string] || 0) + delivered;
      }
    }
  }

  // Build line-level reconciliation.
  // INVARIANT: a client can never receive more than was ordered, so reported
  // delivered is clamped to the ordered qty. The raw sum across all DELIVERED
  // challans is kept so a genuine over-delivery (e.g. a duplicate/phantom
  // challan that slipped through) is SURFACED as an anomaly rather than shown
  // as a silent 165% or hidden behind a clamp.
  const lines = (orderItems as Record<string,unknown>[]).map(item => {
    const ordered      = Number(item.qty) || 0;
    const deliveredRaw = deliveredBySku[item.sku as string] || 0;
    const delivered    = Math.min(ordered, deliveredRaw);   // never exceeds ordered
    const over         = Math.max(0, deliveredRaw - ordered); // >0 ⇒ data anomaly
    const due          = Math.max(0, ordered - delivered);
    return {
      sku:       item.sku,
      name:      item.name,
      unit_price: item.unit_price,
      qty_ordered:       ordered,
      qty_delivered:     delivered,
      qty_delivered_raw: deliveredRaw,
      qty_over_delivered: over,
      qty_due:       due,
      value_ordered:   ordered   * Number(item.unit_price),
      value_delivered: delivered * Number(item.unit_price),
      value_due:       due       * Number(item.unit_price),
      status: over > 0 ? 'over_delivered' : delivered === 0 ? 'not_delivered' : due === 0 ? 'fully_delivered' : 'partial',
    };
  });

  // Summary. A line that reached its ordered qty counts as fully delivered even
  // if the raw sum over-shot it (that surplus is reported separately as an anomaly).
  const totalLines     = lines.length;
  const deliveredLines = lines.filter(l => l.qty_due === 0 && l.qty_delivered > 0).length;
  const partialLines   = lines.filter(l => l.status === 'partial').length;
  const dueLines       = lines.filter(l => l.qty_due > 0).length;
  const noDeliveryLines= lines.filter(l => l.status === 'not_delivered').length;
  const overDeliveredLines = lines.filter(l => l.qty_over_delivered > 0).length;
  const totalOverDelivered = lines.reduce((s,l)=>s+l.qty_over_delivered,0);

  return json({
    order,
    lines,
    dcs: Object.values(dcMap),
    summary: {
      total_lines: totalLines,
      delivered_lines: deliveredLines,
      partial_lines: partialLines,
      due_lines: dueLines,
      no_delivery_lines: noDeliveryLines,
      over_delivered_lines: overDeliveredLines,
      total_over_delivered: totalOverDelivered,
      has_anomaly: totalOverDelivered > 0,
      total_ordered_value:   lines.reduce((s,l)=>s+l.value_ordered,0),
      total_delivered_value: lines.reduce((s,l)=>s+l.value_delivered,0),
      total_due_value:       lines.reduce((s,l)=>s+l.value_due,0),
    },
  });
}

// GET /api/reports/over-delivery-audit — READ-ONLY. Finds every order line
// where recorded deliveries exceed the ordered quantity (the SP-2608-7410
// class of bug) and names the exact challans responsible. Performs NO writes;
// it only surfaces anomalies so an operator can decide what to cancel/correct.
async function handleRptOverDeliveryAudit(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","finance_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  // Per (order, sku): effective delivered replicates the reporting fallback
  // (a DELIVERED challan with no recorded line qty is counted at its full
  // ordered load), which is exactly what inflated the numbers. delivered_recorded
  // is the pure SUM(qty_delivered) for comparison.
  const { results: rows } = await env.DB.prepare(`
    SELECT o.id AS order_id, o.status AS order_status, o.created_at AS order_created_at,
           COALESCE(c.name,'') AS client_name,
           oi.sku, oi.name AS item_name, oi.qty AS ordered,
           COALESCE(SUM(CASE WHEN dc.status='DELIVERED' AND (SELECT COALESCE(SUM(x.qty_delivered),0) FROM dc_items x WHERE x.dc_id=dc.id)=0 THEN di.qty_ordered
                             WHEN dc.status='DELIVERED' THEN di.qty_delivered ELSE 0 END),0) AS delivered_effective,
           COALESCE(SUM(CASE WHEN dc.status='DELIVERED' THEN di.qty_delivered ELSE 0 END),0) AS delivered_recorded
    FROM order_items oi
    JOIN orders o ON o.id=oi.order_id
    LEFT JOIN clients c ON c.id=o.client_id
    LEFT JOIN delivery_challans dc ON dc.order_id=o.id
    LEFT JOIN dc_items di ON di.dc_id=dc.id AND di.sku=oi.sku
    WHERE o.status NOT IN ('CANCELLED','DRAFT')
    GROUP BY o.id, oi.sku
    HAVING delivered_effective > oi.qty
    ORDER BY (delivered_effective - oi.qty) DESC
    LIMIT 500`).all() as { results: Record<string,unknown>[] };

  const anomalies: Array<Record<string,unknown>> = [];
  for (const r of rows) {
    const { results: challans } = await env.DB.prepare(`
      SELECT dc.id AS dc_id, dc.dc_number, dc.status, dc.dispatched_at, dc.delivered_at,
             di.qty_ordered, di.qty_delivered,
             (SELECT COALESCE(SUM(x.qty_delivered),0) FROM dc_items x WHERE x.dc_id=dc.id) AS dc_recorded
      FROM delivery_challans dc JOIN dc_items di ON di.dc_id=dc.id
      WHERE dc.order_id=? AND di.sku=? ORDER BY dc.dispatched_at, dc.id`).bind(r.order_id, r.sku).all() as { results: Record<string,unknown>[] };
    const challanList = challans.map(dc => {
      const isDelivered = dc.status === 'DELIVERED';
      const dcRecorded = Number(dc.dc_recorded) || 0;
      // A line only counts at full ordered load when the WHOLE challan recorded
      // nothing (legacy). If the challan recorded other lines, a 0 here means 0.
      const countedAs = isDelivered ? (dcRecorded > 0 ? Number(dc.qty_delivered) : Number(dc.qty_ordered)) : 0;
      return {
        dc_id: dc.dc_id, dc_number: dc.dc_number, status: dc.status,
        dispatched_at: dc.dispatched_at, delivered_at: dc.delivered_at,
        qty_ordered: Number(dc.qty_ordered)||0, qty_delivered: Number(dc.qty_delivered)||0,
        counted_as: countedAs,
        // The real culprit is a DELIVERED challan that recorded NOTHING at all,
        // so the fallback counts its full load — not a 0 line on a partial challan.
        suspect: isDelivered && dcRecorded === 0,
      };
    });
    anomalies.push({
      order_id: r.order_id, client_name: r.client_name, order_status: r.order_status,
      order_created_at: r.order_created_at, sku: r.sku, item_name: r.item_name,
      ordered: Number(r.ordered)||0,
      delivered_effective: Number(r.delivered_effective)||0,
      delivered_recorded: Number(r.delivered_recorded)||0,
      over_units: Math.max(0, (Number(r.delivered_effective)||0) - (Number(r.ordered)||0)),
      challans: challanList,
    });
  }

  const ordersAffected = new Set(anomalies.map(a => a.order_id)).size;
  const totalOverUnits = anomalies.reduce((s,a)=>s+(a.over_units as number),0);
  return json({
    generated_at: new Date().toISOString(),
    read_only: true,
    summary: { orders_affected: ordersAffected, lines_affected: anomalies.length, total_over_units: totalOverUnits },
    anomalies,
  });
}

// Effective delivered for one order+SKU, replicating the reporting fallback
// (a DELIVERED challan with no recorded line qty counts at its full ordered load).
// Optionally excludes one challan to model "what if this DC were cancelled".
async function effectiveDeliveredForSku(env: Env, orderId: string, sku: string, excludeDcId?: string): Promise<number> {
  const sql = `SELECT COALESCE(SUM(CASE WHEN dc.status='DELIVERED' AND (SELECT COALESCE(SUM(x.qty_delivered),0) FROM dc_items x WHERE x.dc_id=dc.id)=0 THEN di.qty_ordered
                                        WHEN dc.status='DELIVERED' THEN di.qty_delivered ELSE 0 END),0) eff
    FROM dc_items di JOIN delivery_challans dc ON dc.id=di.dc_id
    WHERE dc.order_id=? AND di.sku=?` + (excludeDcId ? ` AND dc.id!=?` : ``);
  const binds: unknown[] = excludeDcId ? [orderId, sku, excludeDcId] : [orderId, sku];
  const row = await env.DB.prepare(sql).bind(...binds).first() as {eff:number}|null;
  return row?.eff || 0;
}

// POST /api/reports/over-delivery-audit/repair — corrects over-delivered orders
// by cancelling the surplus challans the audit surfaced. SAFE BY CONSTRUCTION:
// dry-run unless dry_run:false is passed explicitly, and a challan is never
// eligible if removing it would drop an order line below its ordered qty (the
// shortfall guard). Two cases:
//   • Zero-stock phantom (recorded no delivery) → cancel, no stock touched.
//   • Recorded a stock movement → refused by default; only voided when the
//     caller opts in with reverse_stock:true, which ALSO adds the delivered
//     units back to inventory and reverses the client-store receipt. Use it
//     only when the goods did not physically move (a duplicate/mis-record).
async function handleRepairOverDelivery(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const body = await request.json().catch(()=>({})) as { dry_run?: boolean; dc_ids?: string[]; reverse_stock?: boolean };
  const dryRun = body.dry_run !== false; // default true — apply only on explicit false
  const reverseStock = body.reverse_stock === true; // opt-in: void a stock-moving challan and add the stock back
  const dcIds = Array.from(new Set((body.dc_ids || []).filter(x => typeof x === "string"))).slice(0, 200);
  if (!dcIds.length) return json({error:"dc_ids (array of challan IDs to cancel) is required"}, 400);

  const results: Array<Record<string,unknown>> = [];
  for (const dcId of dcIds) {
    const dc = await env.DB.prepare("SELECT id, order_id, status FROM delivery_challans WHERE id=?").bind(dcId).first() as {id:string;order_id?:string;status?:string}|null;
    if (!dc)                        { results.push({ dc_id: dcId, eligible:false, reason:"challan not found" }); continue; }
    if (dc.status === "CANCELLED")  { results.push({ dc_id: dcId, order_id: dc.order_id, eligible:false, reason:"already cancelled" }); continue; }
    if (!dc.order_id)               { results.push({ dc_id: dcId, eligible:false, reason:"challan has no order" }); continue; }

    const rec = await env.DB.prepare("SELECT COALESCE(SUM(qty_delivered),0) q FROM dc_items WHERE dc_id=?").bind(dcId).first() as {q:number}|null;
    const recordedDelivered = rec?.q || 0;
    const { results: items } = await env.DB.prepare("SELECT sku, name, qty_ordered, qty_delivered FROM dc_items WHERE dc_id=?").bind(dcId).all() as { results: Record<string,unknown>[] };

    const skuImpact: Array<Record<string,unknown>> = [];
    let wouldShortfall = false;
    for (const it of items) {
      const sku = it.sku as string;
      const qtyDel = Number(it.qty_delivered) || 0;
      const oi = await env.DB.prepare("SELECT COALESCE(SUM(qty),0) q FROM order_items WHERE order_id=? AND sku=?").bind(dc.order_id, sku).first() as {q:number}|null;
      const ordered = oi?.q || 0;
      const before = await effectiveDeliveredForSku(env, dc.order_id, sku);
      const after  = await effectiveDeliveredForSku(env, dc.order_id, sku, dcId);
      if (ordered > 0 && after < ordered) wouldShortfall = true;
      skuImpact.push({ sku, name: it.name, ordered, delivered_before: before, delivered_after: after,
        stock_reversal: (reverseStock && qtyDel > 0) ? qtyDel : 0 });
    }

    // The shortfall guard is absolute — a challan carrying still-needed units is
    // never voidable, even with reverse_stock.
    let eligible = true, reversesStock = false, reason = "pure surplus phantom — moved no stock, safe to cancel";
    if (wouldShortfall) {
      eligible = false; reason = "cancelling would drop an order line below its ordered qty — carried needed units";
    } else if (recordedDelivered > 0) {
      if (reverseStock) { eligible = true; reversesStock = true; reason = `voids the challan and reverses ${recordedDelivered} delivered unit(s) back into stock`; }
      else { eligible = false; reason = "challan recorded a stock movement — re-run with reverse_stock to void it and add the stock back"; }
    }

    results.push({ dc_id: dcId, order_id: dc.order_id, status: dc.status, recorded_delivered: recordedDelivered,
      eligible, reverses_stock: reversesStock, reason, skus: skuImpact });
  }

  const eligibleRows = results.filter(r => r.eligible);
  let applied = 0;
  const ordersClosed: string[] = [];
  let stockReversed = 0;
  if (!dryRun && eligibleRows.length) {
    for (const r of eligibleRows) {
      await env.DB.prepare("UPDATE delivery_challans SET status='CANCELLED' WHERE id=? AND status!='CANCELLED'").bind(r.dc_id as string).run();
      if (r.reverses_stock) {
        // Void that physically didn't happen: add the delivered units back to
        // inventory, log a reversing movement, and undo the client-store receipt.
        const order = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(r.order_id as string).first() as {client_id?:string}|null;
        const { results: delItems } = await env.DB.prepare("SELECT sku, qty_delivered FROM dc_items WHERE dc_id=? AND qty_delivered>0").bind(r.dc_id as string).all() as { results: Record<string,unknown>[] };
        for (const it of delItems) {
          const q = Number(it.qty_delivered) || 0; if (q <= 0) continue;
          await env.DB.prepare("UPDATE inventory SET stock=stock+? WHERE sku=?").bind(q, it.sku).run();
          await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
            .bind(uid(), it.sku as string, 'DELIVERY_REVERSAL', q, r.dc_id as string, 'delivery_challan', `Over-delivery void — DC ${r.dc_id} cancelled`, user!.name).run();
          if (order?.client_id) {
            await env.DB.prepare("UPDATE client_inventory SET qty_on_hand=MAX(0,qty_on_hand-?), updated_at=datetime('now') WHERE client_id=? AND sku=?")
              .bind(q, order.client_id, it.sku).run().catch(()=>{});
          }
          stockReversed += q;
        }
        await audit(env, user, "VOID_REVERSE_STOCK", "delivery_challan", r.dc_id as string, undefined, `over-delivery repair — voided and reversed ${r.recorded_delivered} unit(s) to stock`);
      } else {
        await audit(env, user, "CANCEL", "delivery_challan", r.dc_id as string, undefined, "over-delivery repair — phantom challan cancelled");
      }
      applied++;
    }
    for (const oid of Array.from(new Set(eligibleRows.map(r => r.order_id as string)))) {
      if (await closeOrderIfSettled(env, oid, user, "over-delivery repair — order reconciled after cancelling surplus challan(s)")) ordersClosed.push(oid);
    }
  }

  return json({
    dry_run: dryRun,
    requested: dcIds.length,
    eligible: eligibleRows.length,
    applied,                                   // 0 on a dry run
    stock_reversed: stockReversed,
    orders_closed: ordersClosed,
    note: dryRun
      ? "Dry run — nothing was changed. Re-send with dry_run:false to apply."
      : `Cancelled ${applied} challan(s)${stockReversed ? `, reversed ${stockReversed} unit(s) to stock` : ''}.`,
    results,
  });
}

// ── Server-side draft cart (per user, follows them across devices) ──────
type CartItem = { sku: string; name: string; qty: number; unit_price: number; emoji?: string };

function sanitizeCartItems(raw: unknown): CartItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.slice(0, 300).map((r) => {
    const i = (r || {}) as Record<string, unknown>;
    return {
      sku: String(i.sku ?? "").slice(0, 80),
      name: String(i.name ?? "").slice(0, 200),
      qty: Math.max(0, Math.min(100000, Number(i.qty) || 0)),
      unit_price: Math.max(0, Number(i.unit_price) || 0),
      emoji: String(i.emoji ?? "").slice(0, 8) || undefined,
    };
  }).filter((i) => i.sku && i.qty > 0);
}

async function handleGetCart(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const row = await env.DB.prepare("SELECT items, updated_at FROM draft_carts WHERE user_id=?").bind(user!.sub).first() as { items?: string; updated_at?: string } | null;
  let items: CartItem[] = [];
  try { items = row?.items ? sanitizeCartItems(JSON.parse(row.items)) : []; } catch { items = []; }
  return json({ items, updated_at: row?.updated_at ?? null });
}

async function handleSaveCart(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as { items?: unknown };
  const items = sanitizeCartItems(body.items);
  await env.DB.prepare(
    "INSERT INTO draft_carts (user_id, items, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET items=excluded.items, updated_at=datetime('now')"
  ).bind(user!.sub, JSON.stringify(items)).run();
  return json({ ok: true, count: items.length });
}

async function handleClearCart(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  await env.DB.prepare("DELETE FROM draft_carts WHERE user_id=?").bind(user!.sub).run();
  return json({ ok: true });
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as {
    client_id: string;
    items: Array<{sku:string;name:string;qty:number;unit_price:number;note?:string}>;
    notes?: string;
    order_type?: string;
    need_by_date?: string;
    save_as_draft?: boolean;
    image?: string;
    order_period?: string;
  };
  const orderImage = body.image && body.image.startsWith("data:image/") && body.image.length <= 1_500_000 ? body.image : null;
  // Order period (YYYY-MM) — the business month this order is FOR; default to current month
  const orderPeriod = /^\d{4}-\d{2}$/.test(body.order_period||"") ? body.order_period! : new Date().toISOString().slice(0,7);
  // Client roles must order for their own linked client only
  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (isClientRole) {
    if (!user!.client_id) return json({error:"Your account is not linked to a client. Contact your administrator."}, 400);
    body.client_id = user!.client_id;
  }
  if (!body.client_id || !body.items?.length) return json({error:"client_id and items required"}, 400);

  const id = `SP-${new Date().toISOString().slice(2,7).replace("-","")}-${Math.floor(Math.random()*9000+1000)}`;
  const subtotal = body.items.reduce((s,i)=>s+i.qty*i.unit_price, 0);
  const gst = Math.round(subtotal*0.18);
  const grand_total = subtotal+gst;

  // Save as draft — skip approval rules, return early status
  if (body.save_as_draft) {
    const validTypes = ['Regular','Urgent','Ad-Hoc'];
    const orderType = validTypes.includes(body.order_type||'') ? body.order_type! : 'Regular';
    const needByDate = body.need_by_date || null;
    await env.DB.prepare(`INSERT INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes,order_type,need_by_date,order_image,order_period) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, body.client_id, user!.sub, "DRAFT", subtotal, gst, grand_total, body.notes||null, orderType, needByDate, orderImage, orderPeriod).run();
    for (const item of body.items) {
      await env.DB.prepare(`INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total,item_note) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty*item.unit_price, item.note||null).run();
    }
    await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,NULL,?,?,?,?)`)
      .bind(uid(), id, "DRAFT", user!.sub, user!.name, "Saved as draft").run();
    await audit(env, user, "CREATE", "order", id, undefined, `status:DRAFT,total:${grand_total}`);
    return json({id, status:"DRAFT", grand_total}, 201);
  }

  // Gap 6: check approval rules
  const rule = await env.DB.prepare(`SELECT * FROM approval_rules WHERE active=1 AND (client_id=? OR client_id IS NULL)
    AND min_amount<=? AND (max_amount IS NULL OR max_amount>?) ORDER BY min_amount DESC LIMIT 1`)
    .bind(body.client_id, grand_total, grand_total).first() as Record<string,unknown>|null;

  const validTypes = ['Regular','Urgent','Ad-Hoc'];
  const orderType = validTypes.includes(body.order_type||'') ? body.order_type! : 'Regular';
  const needByDate = body.need_by_date || null;

  // Ad-hoc requests placed without catalogue prices (subtotal 0) go to Ops for
  // pricing first; only then do they enter the normal approval flow. This keeps
  // ad-hoc orders in the same pipeline as catalogue orders — just with an extra
  // "awaiting pricing" gate at the front.
  const awaitingPricing = orderType === 'Ad-Hoc' && subtotal === 0;

  let status = "SUBMITTED";
  if (awaitingPricing) status = "PENDING_PRICING";
  else if (rule?.auto_approve) status = "APPROVED";
  else if (grand_total > (rule?.min_amount as number || 100000)) status = "PENDING_APPROVAL";

  await env.DB.prepare(`INSERT INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes,order_type,need_by_date,order_image,order_period) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, body.client_id, user!.sub, status, subtotal, gst, grand_total, body.notes||null, orderType, needByDate, orderImage, orderPeriod).run();

  for (const item of body.items) {
    await env.DB.prepare(`INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total,item_note) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty*item.unit_price, item.note||null).run();
    // Gap 9: reserve stock — skipped for un-priced ad-hoc lines (placeholder SKUs
    // aren't real inventory yet; reservation happens when Ops prices the order).
    if (!awaitingPricing)
      await env.DB.prepare("UPDATE inventory SET reserved=MIN(stock,reserved+?) WHERE sku=?").bind(item.qty, item.sku).run();
  }

  const histNote = awaitingPricing ? "Ad-hoc request — awaiting pricing by 4SYZ"
    : status==="PENDING_APPROVAL" ? "Approval required — amount exceeds threshold" : null;
  await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,NULL,?,?,?,?)`)
    .bind(uid(), id, status, user!.sub, user!.name, histNote).run();

  await pushNotification(env, "ops_admin", awaitingPricing ? `New ad-hoc order ${id} needs pricing` : `New order ${id} submitted — ${status}`);
  await audit(env, user, "CREATE", "order", id, undefined, `status:${status},total:${grand_total}`);
  return json({id, status, grand_total}, 201);
}

// POST /api/orders/:id/reprice — Ops sets unit prices on an ad-hoc order that
// was submitted without catalogue prices, then releases it into the normal flow.
async function handleRepriceOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  // Pricing is an internal task — only 4SYZ ops/procurement roles may set prices.
  if (!["super_admin","ops_admin","ops_manager","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as { prices: Array<{id:string; unit_price:number}> };
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!order) return json({error:"Not found"}, 404);
  if (order.status !== "PENDING_PRICING") return json({error:"Order is not awaiting pricing"}, 400);
  if (!body.prices?.length) return json({error:"prices required"}, 400);

  const priceMap = new Map(body.prices.map(p => [p.id, Math.max(0, Number(p.unit_price) || 0)]));
  const {results: items} = await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all() as {results: Record<string,unknown>[]};
  let subtotal = 0;
  for (const it of items) {
    const price = priceMap.has(it.id as string) ? priceMap.get(it.id as string)! : (it.unit_price as number);
    const total = (it.qty as number) * price;
    subtotal += total;
    await env.DB.prepare("UPDATE order_items SET unit_price=?, total=? WHERE id=?").bind(price, total, it.id).run();
  }
  if (subtotal <= 0) return json({error:"Enter a price greater than zero for at least one line"}, 400);
  const gst = Math.round(subtotal * 0.18);
  const grand_total = subtotal + gst;

  // Now that the order has a value, run the same approval rules a catalogue order sees.
  const rule = await env.DB.prepare(`SELECT * FROM approval_rules WHERE active=1 AND (client_id=? OR client_id IS NULL)
    AND min_amount<=? AND (max_amount IS NULL OR max_amount>?) ORDER BY min_amount DESC LIMIT 1`)
    .bind(order.client_id, grand_total, grand_total).first() as Record<string,unknown>|null;
  let status = "SUBMITTED";
  if (rule?.auto_approve) status = "APPROVED";
  else if (grand_total > (rule?.min_amount as number || 100000)) status = "PENDING_APPROVAL";

  await env.DB.prepare("UPDATE orders SET subtotal=?, gst=?, grand_total=?, status=?, updated_at=datetime('now') WHERE id=?")
    .bind(subtotal, gst, grand_total, status, id).run();
  // Reserve stock for any priced lines that map to real inventory SKUs (no-op for placeholders).
  for (const it of items) {
    await env.DB.prepare("UPDATE inventory SET reserved=MIN(stock,reserved+?) WHERE sku=?").bind(it.qty, it.sku).run();
  }
  await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)`)
    .bind(uid(), id, "PENDING_PRICING", status, user!.sub, user!.name, `Priced by 4SYZ — grand total ${grand_total}`).run();
  await pushNotification(env, null, `Ad-hoc order ${id} priced → ${status.replace(/_/g," ")}`);
  await audit(env, user, "REPRICE", "order", id, "PENDING_PRICING", `status:${status},total:${grand_total}`);
  return json({id, status, grand_total});
}

async function handleTransitionOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {to:string;note?:string};
  const order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!order) return json({error:"Not found"}, 404);
  // Cross-client protection: an external user may only touch their own orders.
  const scoped = orderScopeDenied(user!, order); if (scoped) return scoped;
  // Operational states are 4SYZ-staff only — a client can't mark its own order PICKED/IN_SHIPMENT/CLOSED.
  if (FULFILLMENT_STATES.has(body.to) && requireInternal(user!)) return json({error:"Forbidden — 4SYZ staff only"}, 403);
  // Approval needs an approver role, and the person who raised the order cannot
  // self-approve it (segregation of duties); elevated staff may override.
  if (body.to === "APPROVED") {
    if (!ORDER_APPROVER_ROLES.includes(user!.role)) return json({error:"Forbidden — approver role required"}, 403);
    if (order.created_by === user!.sub && !["super_admin","ops_admin"].includes(user!.role))
      return json({error:"You cannot approve an order you raised"}, 403);
  }

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

  // Auto-create DC when IN_SHIPMENT — use picked allocations if available, else order items
  if (body.to === "IN_SHIPMENT") {
    const {results: allocations} = await env.DB.prepare(
      "SELECT sku, item_name as name, SUM(qty) as qty FROM order_allocations WHERE order_id=? GROUP BY sku"
    ).bind(id).all() as {results: Record<string,unknown>[]};
    const {results: orderItems} = await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all() as {results: Record<string,unknown>[]};

    // Use allocations if pick was done, otherwise fall back to order quantities
    const dispatchItems = allocations.length > 0 ? allocations : orderItems;
    const totalQty = dispatchItems.reduce((s, i) => s + (i.qty as number), 0);
    const dcId = `DC-${Math.floor(Math.random()*9000+1000)}`;
    await env.DB.prepare("INSERT OR IGNORE INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,'SCHEDULED',?)")
      .bind(dcId, id, totalQty).run();
    for (const item of dispatchItems) {
      await env.DB.prepare("INSERT OR IGNORE INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,0)")
        .bind(uid(), dcId, item.sku, item.name, item.qty).run();
    }

    // If partial pick, release the reservation for un-dispatched qty now
    if (allocations.length > 0) {
      for (const oi of orderItems) {
        const alloc = allocations.find(a => a.sku === oi.sku);
        const pickedQty = alloc ? (alloc.qty as number) : 0;
        const remaining = (oi.qty as number) - pickedQty;
        if (remaining > 0) {
          await env.DB.prepare("UPDATE inventory SET reserved=MAX(0,reserved-?) WHERE sku=?").bind(remaining, oi.sku).run();
        }
      }
    }
  }

  await pushNotification(env, null, `Order ${id} → ${body.to.replace(/_/g," ")}`);
  await audit(env, user, "TRANSITION", "order", id, order.status, body.to);
  return json({id, status: body.to});
}

// POST /api/orders/:id/pick — save allocations, transition to PICKED, consume no stock yet
async function handlePickOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly;
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {items: {sku:string;name:string;qty:number;bin_code:string}[];partial?:boolean};

  const order = await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!order) return json({error:"Not found"}, 404);
  if (!["ACKNOWLEDGED","READY_TO_PICK"].includes(order.status))
    return json({error:`Cannot pick from status ${order.status}`}, 400);

  // Save allocation records
  await env.DB.prepare("DELETE FROM order_allocations WHERE order_id=?").bind(id).run();
  for (const item of body.items) {
    await env.DB.prepare(
      "INSERT INTO order_allocations (id,order_id,sku,item_name,qty,bin_code,picked_by,picked_at) VALUES (?,?,?,?,?,?,?,datetime('now'))"
    ).bind(uid(), id, item.sku, item.name, item.qty, item.bin_code||null, user!.name).run();
  }

  // Transition order to PICKED
  await env.DB.prepare(
    "UPDATE orders SET status='PICKED',picker_id=?,picker_name=?,picked_at=datetime('now'),updated_at=datetime('now') WHERE id=?"
  ).bind(user!.sub, user!.name, id).run();
  const pickNote = body.partial
    ? `Partial pick by ${user!.name} — ${body.items.map(i=>`${i.sku}:${i.qty}`).join(', ')}`
    : `Picked by ${user!.name}`;
  await env.DB.prepare(
    "INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)"
  ).bind(uid(), id, order.status, "PICKED", user!.sub, user!.name, pickNote).run();

  await audit(env, user, "PICKED", "order", id, order.status, "PICKED");
  return json({id, status:"PICKED"});
}

// GET /api/orders/:id/allocations — fetch allocation records for an order
async function handleGetAllocations(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const order = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!order) return json({error:"Not found"}, 404);
  const scoped = orderScopeDenied(user!, order); if (scoped) return scoped;
  const {results} = await env.DB.prepare("SELECT * FROM order_allocations WHERE order_id=? ORDER BY sku").bind(id).all();
  return json(results);
}

async function handlePatchOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").pop()!;
  const scopeRow = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!scopeRow) return json({error:"Not found"}, 404);
  const scoped = orderScopeDenied(user!, scopeRow); if (scoped) return scoped;
  const body = await request.json() as {notes?:string; predicted_delivery_date?:string; need_by_date?:string};
  const fields: string[] = [];
  const vals: unknown[] = [];
  if ('notes' in body)                   { fields.push("notes=?");                   vals.push(body.notes||null); }
  if ('predicted_delivery_date' in body) { fields.push("predicted_delivery_date=?"); vals.push(body.predicted_delivery_date||null); }
  if ('need_by_date' in body)            { fields.push("need_by_date=?");            vals.push(body.need_by_date||null); }
  if (!fields.length) return json({id});
  fields.push("updated_at=datetime('now')");
  vals.push(id);
  await env.DB.prepare(`UPDATE orders SET ${fields.join(',')} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// Gap 15: Order comments
async function handleListComments(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const cScope = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!cScope) return json({error:"Not found"}, 404);
  const cDenied = orderScopeDenied(user!, cScope); if (cDenied) return cDenied;
  const {results} = await env.DB.prepare("SELECT * FROM order_comments WHERE order_id=? ORDER BY created_at").bind(id).all();
  return json(results);
}

async function handleAddComment(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const cScope = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!cScope) return json({error:"Not found"}, 404);
  const cDenied = orderScopeDenied(user!, cScope); if (cDenied) return cDenied;
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

// GET /api/barcode-map — lightweight sku/name/barcode list that powers the
// in-app barcode scanner (scan-to-pick / scan-to-receive). Small payload so the
// pick/GRN modals can resolve a scanned code → SKU without pulling full inventory.
async function handleBarcodeMap(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const { results } = await env.DB.prepare(
    "SELECT sku, name, COALESCE(barcode,'') AS barcode FROM inventory WHERE active=1"
  ).all();
  return json({ items: results || [] });
}

async function handleListInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const cat = url.searchParams.get("category");

  const params: string[] = [];
  let baseFilter = " WHERE i.active=1";
  if (q)   { baseFilter += " AND (i.name LIKE ? OR i.sku LIKE ?)"; params.push(`%${q}%`,`%${q}%`); }
  if (cat) { baseFilter += " AND i.category=?"; params.push(cat); }

  // Client-role users see only their assigned catalog, with per-client prices applied
  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (isClientRole && user!.client_id) {
    try {
      const {results: catalogRows} = await env.DB.prepare(
        "SELECT sku, client_price FROM client_catalog WHERE client_id=?"
      ).bind(user!.client_id).all() as {results: {sku:string; client_price:number|null}[]};
      if (catalogRows.length > 0) {
        const catalogSkus = catalogRows.map(r => r.sku);
        const ph = catalogSkus.map(() => '?').join(',');
        baseFilter += ` AND i.sku IN (${ph})`;
        params.push(...catalogSkus);

        // After fetching, overlay per-client prices onto the results
        const priceMap = Object.fromEntries(catalogRows.map(r => [r.sku, r.client_price]));

        let results: unknown[];
        try {
          const {results: r} = await env.DB.prepare(
            `SELECT i.*,v.name as vendor_name,v2.name as secondary_vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id LEFT JOIN vendors v2 ON i.secondary_vendor_id=v2.id${baseFilter} ORDER BY i.name`
          ).bind(...params).all();
          results = r;
        } catch {
          const {results: r} = await env.DB.prepare(
            `SELECT i.*,v.name as vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id${baseFilter} ORDER BY i.name`
          ).bind(...params).all();
          results = r;
        }
        // Replace unit_price with client-specific price where set, overlay is_critical + used
        const [critSet2, usedSet2] = await Promise.all([getCriticalSet(env), getUsedSkuSet(env)]);
        results = (results as Record<string,unknown>[]).map(item => {
          const cp = priceMap[item.sku as string];
          return { ...(cp != null ? {...item, unit_price: cp, client_price: cp} : item),
            is_critical: critSet2.has(item.sku as string) ? 1 : 0, used: usedSet2.has(item.sku as string) ? 1 : 0 };
        });
        return json(results);
      }
    } catch { /* client_catalog table not yet created — show all */ }
  }

  // Non-client roles or no catalog assignments — return full inventory
  let results: unknown[];
  try {
    const {results: r} = await env.DB.prepare(
      `SELECT i.*,v.name as vendor_name,v2.name as secondary_vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id LEFT JOIN vendors v2 ON i.secondary_vendor_id=v2.id${baseFilter} ORDER BY i.name`
    ).bind(...params).all();
    results = r;
  } catch {
    const {results: r} = await env.DB.prepare(
      `SELECT i.*,v.name as vendor_name FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id${baseFilter} ORDER BY i.name`
    ).bind(...params).all();
    results = r;
  }
  // Overlay is_critical + used (no migration required)
  const [critSet, usedSet] = await Promise.all([getCriticalSet(env), getUsedSkuSet(env)]);
  results = (results as Record<string,unknown>[]).map(item => ({
    ...item,
    is_critical: critSet.has(item.sku as string) ? 1 : 0,
    used: usedSet.has(item.sku as string) ? 1 : 0
  }));
  return json(results);
}

async function handleAddInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const sku = `SKU${String(Math.floor(Math.random()*900+100)).padStart(3,"0")}`;
  // GST comes from the HSN slab when the code maps; otherwise honour a supplied
  // rate, falling back to 18 only as a last resort.
  const hsnVal = body.hsn_code ? String(body.hsn_code) : "2101";
  const derivedGst = await gstRateForHsn(env, hsnVal);
  const gstVal = derivedGst != null ? derivedGst : (body.gst_rate != null ? Number(body.gst_rate) : 18);
  await env.DB.prepare(`INSERT INTO inventory
    (sku,name,category,unit_price,stock,reorder_level,max_stock,vendor_id,hsn_code,gst_rate,emoji,
     uom,pack_size,units_per_case,weight_grams,barcode,sub_category,vendor_sku,vendor_lead_days,vendor_moq,
     mrp,cost_excl_gst,margin_pct,brand)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(sku,body.name,body.category,body.unit_price,body.stock||0,body.reorder_level||20,body.max_stock||200,
      body.vendor_id||null,hsnVal,gstVal,body.emoji||"📦",
      body.uom||"unit",body.pack_size||1,body.units_per_case||1,body.weight_grams||0,
      body.barcode||"",body.sub_category||"Normal",body.vendor_sku||"",body.vendor_lead_days||3,body.vendor_moq||1,
      body.mrp||0,body.cost_excl_gst||0,body.margin_pct||0,body.brand||"").run();
  await audit(env, user, "CREATE", "inventory", sku, undefined, JSON.stringify({name:body.name,stock:body.stock}));
  return json({sku}, 201);
}

// Look up the GST slab for a single HSN code (used by the item editor to
// auto-fill the rate the moment an HSN is typed).
async function handleHsnGstLookup(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const hsn = new URL(request.url).searchParams.get("hsn") || "";
  const rate = await gstRateForHsn(env, hsn);
  return json({ hsn, gst_rate: rate, matched: rate != null });
}

// List the HSN→GST reference table (rate management screen).
async function handleListHsnGstRates(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  try {
    const {results} = await env.DB.prepare(
      "SELECT hsn, gst_rate, description, updated_at, updated_by FROM hsn_gst_rates ORDER BY hsn"
    ).all();
    return json(results);
  } catch { return json([]); }
}

// Add or update a single HSN→GST mapping.
async function handleUpsertHsnGstRate(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","finance_admin","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  const hsn = String(body.hsn||"").replace(/\D/g,"");
  const rate = Number(body.gst_rate);
  if (!hsn) return json({error:"HSN code required"}, 400);
  if (![0,5,12,18,28].includes(rate)) return json({error:"GST rate must be one of 0, 5, 12, 18, 28"}, 400);
  await env.DB.prepare(
    `INSERT INTO hsn_gst_rates (hsn, gst_rate, description, updated_at, updated_by)
     VALUES (?,?,?,datetime('now'),?)
     ON CONFLICT(hsn) DO UPDATE SET gst_rate=excluded.gst_rate, description=excluded.description,
       updated_at=excluded.updated_at, updated_by=excluded.updated_by`
  ).bind(hsn, rate, String(body.description||""), user!.email||user!.role).run();
  await audit(env, user, "UPSERT", "hsn_gst_rates", hsn, undefined, `gst:${rate}`);
  return json({ok:true, hsn, gst_rate:rate});
}

// Backfill: recompute gst_rate for every inventory item from its HSN code.
// Fixes the historical data where every product defaulted to 18%.
async function handleRecalcGst(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","finance_admin","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  let updated = 0, unmatched = 0;
  const unmatchedHsns = new Set<string>();
  try {
    const {results} = await env.DB.prepare(
      "SELECT sku, hsn_code, gst_rate FROM inventory WHERE hsn_code IS NOT NULL AND hsn_code != ''"
    ).all() as { results: {sku:string; hsn_code:string; gst_rate:number}[] };
    for (const row of results) {
      const rate = await gstRateForHsn(env, row.hsn_code);
      if (rate == null) { unmatched++; unmatchedHsns.add(row.hsn_code); continue; }
      if (Number(row.gst_rate) !== rate) {
        await env.DB.prepare("UPDATE inventory SET gst_rate=? WHERE sku=?").bind(rate, row.sku).run();
        updated++;
      }
    }
  } catch (e) { return json({error:"Recalc failed: "+String(e)}, 500); }
  await audit(env, user, "RECALC", "inventory", "gst", undefined, `updated:${updated}`);
  return json({ok:true, updated, unmatched, unmatched_hsns:[...unmatchedHsns]});
}

let _criticalTableReady = false;
async function ensureCriticalTable(env: Env): Promise<void> {
  if (_criticalTableReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS critical_skus (sku TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')))`
  ).run();
  _criticalTableReady = true;
}

async function getCriticalSet(env: Env): Promise<Set<string>> {
  try {
    await ensureCriticalTable(env);
    const {results} = await env.DB.prepare("SELECT sku FROM critical_skus").all();
    return new Set((results as {sku:string}[]).map(r => r.sku));
  } catch { return new Set(); }
}

// SKUs that are actually in use — ever ordered or consumed. Lets the UI scope
// "below reorder" alerts to real items, not never-used catalogue rows.
async function getUsedSkuSet(env: Env): Promise<Set<string>> {
  try {
    const {results} = await env.DB.prepare("SELECT sku FROM order_items UNION SELECT sku FROM client_consumption").all();
    return new Set((results as {sku:string}[]).map(r => r.sku));
  } catch { return new Set(); }
}

async function handleToggleCritical(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const sku = decodeURIComponent(path.split("/")[3]);
  const item = await env.DB.prepare("SELECT sku FROM inventory WHERE sku=?").bind(sku).first();
  if (!item) return json({error:"Not found"}, 404);
  await ensureCriticalTable(env);
  const existing = await env.DB.prepare("SELECT sku FROM critical_skus WHERE sku=?").bind(sku).first();
  if (existing) {
    await env.DB.prepare("DELETE FROM critical_skus WHERE sku=?").bind(sku).run();
    return json({ok:true, is_critical: 0});
  } else {
    await env.DB.prepare("INSERT OR IGNORE INTO critical_skus (sku) VALUES (?)").bind(sku).run();
    return json({ok:true, is_critical: 1});
  }
}

async function handleSendCriticalAlerts(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  let results: Record<string,unknown>[];
  try {
    await ensureCriticalTable(env);
    const res = await env.DB.prepare(`
      SELECT i.sku, i.name, i.stock, i.reorder_level, v.name as vendor_name, v.contact_email as vendor_email
      FROM inventory i
      JOIN critical_skus cs ON cs.sku = i.sku
      LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.stock <= i.reorder_level AND i.active = 1
      ORDER BY i.stock ASC
    `).all();
    results = res.results as Record<string,unknown>[];
  } catch {
    return json({error:"Error querying critical items"}, 500);
  }

  if (!results.length) return json({ok:true, count:0, message:"No critical items below reorder level"});

  const itemLines = results.map(r =>
    `  • ${r.sku} — ${r.name}: ${r.stock} units (reorder level: ${r.reorder_level})${r.vendor_name ? ` | Vendor: ${r.vendor_name}` : ''}`
  ).join("\n");

  const subject = `🔴 Critical Stock Alert — ${results.length} item(s) need immediate reorder`;
  const html = `<h2 style="color:#dc2626">Critical Stock Alert</h2>
<p><strong>${results.length} critical item(s)</strong> are at or below reorder level:</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
  <thead style="background:#fef2f2"><tr><th>SKU</th><th>Item</th><th>Stock</th><th>Reorder Level</th><th>Vendor</th></tr></thead>
  <tbody>${results.map(r=>`<tr><td>${r.sku}</td><td><strong>${r.name}</strong></td><td style="color:#dc2626;font-weight:bold">${r.stock}</td><td>${r.reorder_level}</td><td>${r.vendor_name||'—'}</td></tr>`).join('')}</tbody>
</table>
<p style="margin-top:16px">Please raise purchase orders immediately from the <a href="#">Smart Pantry Procurement</a> module.</p>`;

  await sendEmail(env, user!.email, subject, `Critical Stock Alert\n\n${results.length} item(s) need reorder:\n\n${itemLines}\n\nRaise POs immediately.`, html);
  return json({ok:true, count:results.length});
}

// POST /api/inventory/barcodes — bulk set/clear barcodes in one request, for the
// inventory page's "Bulk Barcodes" helper. Body: { items:[{sku, barcode}] }.
async function handleBulkBarcodes(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","ops_manager","procurement_manager"].includes(user!.role))
    return json({error:"Forbidden"}, 403);
  const body = await request.json() as { items?: Array<{sku:string; barcode:string}> };
  const items = (body.items || []).filter(i => i && i.sku);
  if (!items.length) return json({error:"No items to update"}, 400);
  let updated = 0; const unknown: string[] = [];
  for (const it of items) {
    const bc = String(it.barcode ?? "").trim();
    const r = await env.DB.prepare("UPDATE inventory SET barcode=? WHERE sku=?")
      .bind(bc || null, String(it.sku).trim()).run();
    if (Number((r.meta && (r.meta as Record<string,unknown>).changes) || 0) > 0) updated++;
    else unknown.push(String(it.sku));
  }
  await audit(env, user, "UPDATE", "inventory", "barcodes", undefined, `bulk_barcode:${updated}`);
  return json({ updated, unknown });
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
  const patchFields: [string, string][] = [
    ["stock","stock"],["reorder_level","reorder_level"],["max_stock","max_stock"],
    ["unit_price","unit_price"],["name","name"],["category","category"],["emoji","emoji"],
    ["hsn_code","hsn_code"],["gst_rate","gst_rate"],["active","active"],
    ["uom","uom"],["pack_size","pack_size"],["units_per_case","units_per_case"],
    ["weight_grams","weight_grams"],["barcode","barcode"],["sub_category","sub_category"],
    ["vendor_sku","vendor_sku"],["vendor_lead_days","vendor_lead_days"],["vendor_moq","vendor_moq"],
    ["mrp","mrp"],["cost_excl_gst","cost_excl_gst"],["margin_pct","margin_pct"],["brand","brand"],
    ["expiry_date","expiry_date"],["inv_location","inv_location"],["amazon_url","amazon_url"],["flipkart_url","flipkart_url"],
  ];
  for (const [col, key] of patchFields) {
    if (body[key] !== undefined) { fields.push(`${col}=?`); vals.push(body[key] === "" ? null : body[key]); }
  }
  // HSN drives the GST slab: when the HSN code is edited, re-derive gst_rate from
  // the hsn_gst_rates map (0/5/12/18/28%) so it can never drift to a stale value.
  if (body.hsn_code !== undefined) {
    const derivedGst = await gstRateForHsn(env, body.hsn_code as string);
    if (derivedGst != null) {
      const gi = fields.indexOf("gst_rate=?");
      if (gi >= 0) { vals[gi] = derivedGst; }
      else { fields.push("gst_rate=?"); vals.push(derivedGst); }
    }
  }
  // vendor_id allows null
  if (body.vendor_id !== undefined) { fields.push("vendor_id=?"); vals.push(body.vendor_id || null); }
  if (!fields.length && body.secondary_vendor_id === undefined) return json({error:"Nothing to update"}, 400);
  if (fields.length) {
    vals.push(sku);
    await env.DB.prepare(`UPDATE inventory SET ${fields.join(",")} WHERE sku=?`).bind(...vals).run();
  }
  // secondary_vendor_id is in a newer migration — apply separately so older DBs don't 500
  if (body.secondary_vendor_id !== undefined) {
    try {
      await env.DB.prepare("UPDATE inventory SET secondary_vendor_id=? WHERE sku=?")
        .bind(body.secondary_vendor_id || null, sku).run();
    } catch { /* column not yet migrated — ignore */ }
  }
  await audit(env, user, "UPDATE", "inventory", sku, `stock:${before?.stock}`, `stock:${body.stock||before?.stock}`);

  // Gap 8: check auto-reorder after stock change
  if (body.stock !== undefined) await checkAutoReorder(env, user);
  return json({sku});
}

// ════════════════════════════════════════════════════════════════════
// BRAND & PRODUCT INTELLIGENCE — Smart Catalogue + Product Intelligence
// Clients see only published (fitment APPROVED/CONDITIONAL) products; Super
// Admin + Ops review and sign off. AI is Phase 2 — nothing here auto-approves.
// ════════════════════════════════════════════════════════════════════

function availabilityOf(stock: number, reorder: number): string {
  if (stock <= 0) return "On order";
  if (stock <= (reorder || 0)) return "Low stock";
  return "In stock";
}

async function handleListBrands(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const { results } = await env.DB.prepare("SELECT id,name,origin,emoji,description,status FROM brands WHERE status='active' ORDER BY name").all();
  return json({ brands: results || [] });
}

async function handleUpsertBrand(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Forbidden"}, 403);
  const b = await request.json() as { id?:string; name:string; origin?:string; emoji?:string; description?:string };
  if (!b.name?.trim()) return json({error:"Brand name required"}, 400);
  const id = b.id || ("br-" + b.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,16) + "-" + uid().slice(0,4));
  await env.DB.prepare("INSERT INTO brands (id,name,origin,emoji,description) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,origin=excluded.origin,emoji=excluded.emoji,description=excluded.description")
    .bind(id, b.name.trim(), b.origin||null, b.emoji||"🏷️", b.description||null).run();
  await audit(env, user, "UPSERT", "brand", id, undefined, b.name);
  return json({ id });
}

// GET /api/catalogue — product cards with fitment + attribute summary.
async function handleListCatalogue(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // Any external viewer (client OR vendor) sees only published products — never
  // unpublished items or the internal reviewer/notes fields.
  const isClient = isExternalRole(user!.role);
  const url = new URL(request.url);
  const q       = (url.searchParams.get("q") || "").trim().toLowerCase();
  const fBrand  = (url.searchParams.get("brand") || "").trim();
  const fCat    = (url.searchParams.get("category") || "").trim();
  const fVer    = (url.searchParams.get("verification") || "").trim();

  const visClause = isClient ? " AND COALESCE(f.fitment_state,'PENDING') IN ('APPROVED','CONDITIONAL')" : "";
  const { results: rows } = await env.DB.prepare(
    `SELECT i.sku,i.name,COALESCE(i.brand,'') AS brand,COALESCE(i.category,'') AS category,COALESCE(i.sub_category,'') AS sub_category,
            i.unit_price,i.mrp,COALESCE(i.stock,0) AS stock,COALESCE(i.reorder_level,0) AS reorder_level,COALESCE(i.emoji,'📦') AS emoji,
            COALESCE(f.verification,'needs_review') AS verification, COALESCE(f.fitment_state,'PENDING') AS fitment_state,
            COALESCE(f.clean_label,'pending') AS clean_label, f.expiry_date, f.reviewed_at
     FROM inventory i LEFT JOIN product_fitment f ON f.sku=i.sku
     WHERE i.active=1${visClause} ORDER BY i.name`
  ).all() as { results: Array<Record<string,unknown>> };

  // Fetch attributes only for the products actually returned (never hidden ones).
  const attrBySku: Record<string, Array<Record<string,unknown>>> = {};
  if (rows.length) {
    const ph = rows.map(() => "?").join(",");
    const { results: attrs } = await env.DB.prepare(`SELECT sku,grp,name,source FROM product_attributes WHERE sku IN (${ph})`)
      .bind(...rows.map(r => r.sku)).all() as { results: Array<Record<string,unknown>> };
    for (const a of attrs) (attrBySku[String(a.sku)] = attrBySku[String(a.sku)] || []).push(a);
  }

  let items: Array<Record<string,unknown>> = rows.map(r => ({
    ...r,
    price: r.unit_price,
    availability: availabilityOf(Number(r.stock), Number(r.reorder_level)),
    attributes: (attrBySku[String(r.sku)] || []).map(a => ({ grp:a.grp, name:a.name, source:a.source })),
  }));
  if (q)      items = items.filter(i => (String(i.name)+" "+String(i.brand)).toLowerCase().includes(q));
  if (fBrand) items = items.filter(i => String(i.brand) === fBrand);
  if (fCat)   items = items.filter(i => String(i.category) === fCat);
  if (fVer)   items = items.filter(i => String(i.verification) === fVer);
  return json({ items });
}

// GET /api/catalogue/report — rich, joined dataset for Product Reports
// (Super Admin / Ops only): base fitment + attributes, allergens, nutrition,
// additive flags, certificate status and a provenance breakdown per SKU. One
// query set instead of N+1 detail fetches from the client.
async function handleCatalogueReport(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can run reports"}, 403);

  const { results: rows } = await env.DB.prepare(
    `SELECT i.sku,i.name,COALESCE(i.brand,'') AS brand,COALESCE(i.category,'') AS category,
            COALESCE(f.verification,'needs_review') AS verification, COALESCE(f.fitment_state,'PENDING') AS fitment_state,
            COALESCE(f.clean_label,'pending') AS clean_label, f.expiry_date, f.reviewed_at, f.reviewer
     FROM inventory i LEFT JOIN product_fitment f ON f.sku=i.sku WHERE i.active=1 ORDER BY i.name`
  ).all() as { results: Array<Record<string,unknown>> };

  const group = async (sql: string) => {
    const { results } = await env.DB.prepare(sql).all() as { results: Array<Record<string,unknown>> };
    const by: Record<string, Array<Record<string,unknown>>> = {};
    for (const r of results) (by[String(r.sku)] = by[String(r.sku)] || []).push(r);
    return by;
  };
  const [attrBy, algBy, nutBy, ingBy, certBy] = await Promise.all([
    group("SELECT sku,grp,name,source FROM product_attributes"),
    group("SELECT sku,allergen,contains_state,cross_contact_state,source FROM product_allergens"),
    group("SELECT sku,nutrient,value,unit,basis,source FROM product_nutrition"),
    group("SELECT sku,normalized,ins_code,functional_class,flags,source FROM product_ingredients"),
    group("SELECT sku,cert_type,status,expiry_date,source FROM product_certifications"),
  ]);

  const items = rows.map(r => {
    const sku = String(r.sku);
    const ings = ingBy[sku] || [];
    const flags = [...new Set(ings.flatMap(g => String(g.flags||"").split(",").filter(Boolean)))];
    const provCount = { brand: 0, ai: 0, "4syz": 0 };
    for (const a of (attrBy[sku]||[])) { const s = String(a.source); if (s in provCount) (provCount as Record<string,number>)[s]++; }
    return {
      ...r,
      attributes: attrBy[sku] || [],
      allergens: algBy[sku] || [],
      nutrition: nutBy[sku] || [],
      additives: ings.filter(g => g.ins_code).map(g => ({ code: String(g.ins_code).toUpperCase(), class: g.functional_class })),
      ingredient_flags: flags,
      certifications: certBy[sku] || [],
      provenance: provCount,
    };
  });
  return json({ items, generated_at: new Date().toISOString(), generated_by: user!.name });
}

// GET /api/catalogue/:sku — full product intelligence.
async function handleGetCatalogueItem(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const sku = decodeURIComponent(path.split("/").pop()!);
  const product = await env.DB.prepare(
    `SELECT i.sku,i.name,COALESCE(i.brand,'') AS brand,COALESCE(i.category,'') AS category,COALESCE(i.sub_category,'') AS sub_category,
            i.unit_price AS price,i.mrp,COALESCE(i.stock,0) AS stock,COALESCE(i.reorder_level,0) AS reorder_level,COALESCE(i.emoji,'📦') AS emoji,COALESCE(i.barcode,'') AS barcode,
            COALESCE(f.verification,'needs_review') AS verification,COALESCE(f.fitment_state,'PENDING') AS fitment_state,
            COALESCE(f.clean_label,'pending') AS clean_label,f.expiry_date,f.reviewer,f.reviewed_at,f.notes
     FROM inventory i LEFT JOIN product_fitment f ON f.sku=i.sku WHERE i.sku=?`).bind(sku).first() as Record<string,unknown> | null;
  if (!product) return json({error:"Not found"}, 404);
  if (isExternalRole(user!.role) && !["APPROVED","CONDITIONAL"].includes(String(product.fitment_state)))
    return json({error:"Not available"}, 404);

  const [attrs, nutrition, ingredients, certs, allergens] = await Promise.all([
    env.DB.prepare("SELECT grp,name,source FROM product_attributes WHERE sku=? ORDER BY grp,name").bind(sku).all(),
    env.DB.prepare("SELECT nutrient,value,unit,basis,source FROM product_nutrition WHERE sku=?").bind(sku).all(),
    env.DB.prepare("SELECT raw_text,normalized,ins_code,functional_class,flags,state,source FROM product_ingredients WHERE sku=?").bind(sku).all(),
    env.DB.prepare("SELECT cert_type,issuer,number,scope,issue_date,expiry_date,status,source,reviewer,reviewed_at FROM product_certifications WHERE sku=? ORDER BY cert_type").bind(sku).all(),
    env.DB.prepare("SELECT allergen,contains_state,cross_contact_state,source FROM product_allergens WHERE sku=?").bind(sku).all(),
  ]);
  // Redact internal review fields from external viewers even on published items.
  // reviewed_at is kept — it is a client-facing "checked by 4SYZ" trust signal.
  if (isExternalRole(user!.role)) { delete product.reviewer; delete product.notes; }
  return json({
    product: { ...product, availability: availabilityOf(Number(product.stock), Number(product.reorder_level)) },
    attributes: attrs.results || [], nutrition: nutrition.results || [], ingredients: ingredients.results || [],
    certifications: certs.results || [], allergens: allergens.results || [],
  });
}

// PATCH /api/catalogue/:sku/fitment — the Fitment Gate (Super Admin / Ops sign-off).
async function handleSetFitment(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can review products"}, 403);
  const sku = decodeURIComponent(path.split("/").slice(-2)[0]);
  const b = await request.json() as { verification?:string; fitment_state?:string; clean_label?:string; expiry_date?:string; notes?:string };
  const exists = await env.DB.prepare("SELECT sku FROM inventory WHERE sku=?").bind(sku).first();
  if (!exists) return json({error:"Unknown SKU"}, 404);
  const VER = ["needs_review","ai_screened","verified"];
  const STATE = ["DRAFT","SUBMITTED","AI_SCREENED","REVIEW","APPROVED","CONDITIONAL","PENDING","BLOCKED","EXPIRED"];
  // Validation fails CLOSED: an invalid/missing value must not publish a product.
  const verification = VER.includes(String(b.verification)) ? b.verification! : "needs_review";
  const fitment = STATE.includes(String(b.fitment_state)) ? b.fitment_state! : "PENDING";
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO product_fitment (sku,verification,fitment_state,clean_label,reviewer,reviewed_at,expiry_date,notes,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(sku) DO UPDATE SET verification=excluded.verification,fitment_state=excluded.fitment_state,clean_label=excluded.clean_label,
       reviewer=excluded.reviewer,reviewed_at=excluded.reviewed_at,expiry_date=excluded.expiry_date,notes=excluded.notes,updated_at=excluded.updated_at`
  ).bind(sku, verification, fitment, b.clean_label || "pending", user!.name, now, b.expiry_date || null, b.notes || null, now).run();
  await audit(env, user, "FITMENT", "product", sku, undefined, `${fitment}/${verification}`);
  return json({ sku, verification, fitment_state: fitment });
}

// PUT /api/catalogue/:sku/intel — replace attributes / nutrition / ingredients /
// certifications / allergens (Super Admin / Ops manual entry & verification).
async function handlePutIntel(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can edit product data"}, 403);
  const sku = decodeURIComponent(path.split("/").slice(-2)[0]);
  const b = await request.json() as {
    attributes?: Array<{grp:string;name:string;source?:string}>;
    nutrition?: Array<{nutrient:string;value:string;unit?:string;basis?:string;source?:string}>;
    ingredients?: Array<{raw_text?:string;normalized?:string;ins_code?:string;functional_class?:string;flags?:string;state?:string;source?:string}>;
    certifications?: Array<{cert_type:string;issuer?:string;number?:string;scope?:string;issue_date?:string;expiry_date?:string;status?:string;source?:string}>;
    allergens?: Array<{allergen:string;contains_state?:string;cross_contact_state?:string;source?:string}>;
  };
  if (Array.isArray(b.attributes)) {
    await env.DB.prepare("DELETE FROM product_attributes WHERE sku=?").bind(sku).run();
    for (const a of b.attributes) if (a.name) await env.DB.prepare("INSERT INTO product_attributes (id,sku,grp,name,source) VALUES (?,?,?,?,?)").bind(uid(), sku, a.grp||"attribute", a.name, a.source||"brand").run();
  }
  if (Array.isArray(b.nutrition)) {
    await env.DB.prepare("DELETE FROM product_nutrition WHERE sku=?").bind(sku).run();
    for (const n of b.nutrition) if (n.nutrient) await env.DB.prepare("INSERT INTO product_nutrition (id,sku,nutrient,value,unit,basis,source) VALUES (?,?,?,?,?,?,?)").bind(uid(), sku, n.nutrient, n.value||"", n.unit||"", n.basis||"per 100g", n.source||"brand").run();
  }
  if (Array.isArray(b.ingredients)) {
    await env.DB.prepare("DELETE FROM product_ingredients WHERE sku=?").bind(sku).run();
    for (const g of b.ingredients) await env.DB.prepare("INSERT INTO product_ingredients (id,sku,raw_text,normalized,ins_code,functional_class,flags,state,source) VALUES (?,?,?,?,?,?,?,?,?)").bind(uid(), sku, g.raw_text||"", g.normalized||"", g.ins_code||"", g.functional_class||"", g.flags||"", g.state||"detected", g.source||"brand").run();
  }
  if (Array.isArray(b.certifications)) {
    await env.DB.prepare("DELETE FROM product_certifications WHERE sku=?").bind(sku).run();
    for (const c of b.certifications) if (c.cert_type) await env.DB.prepare("INSERT INTO product_certifications (id,sku,cert_type,issuer,number,scope,issue_date,expiry_date,status,source,reviewer,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid(), sku, c.cert_type, c.issuer||"", c.number||"", c.scope||"", c.issue_date||"", c.expiry_date||"", c.status||"active", c.source||"brand", c.source==="4syz"?user!.name:null, c.source==="4syz"?new Date().toISOString():null).run();
  }
  if (Array.isArray(b.allergens)) {
    await env.DB.prepare("DELETE FROM product_allergens WHERE sku=?").bind(sku).run();
    for (const al of b.allergens) if (al.allergen) await env.DB.prepare("INSERT INTO product_allergens (id,sku,allergen,contains_state,cross_contact_state,source) VALUES (?,?,?,?,?,?)").bind(uid(), sku, al.allergen, al.contains_state||"not_declared", al.cross_contact_state||"unknown", al.source||"brand").run();
  }
  await audit(env, user, "UPDATE", "product_intel", sku);
  return json({ sku, ok: true });
}

// ── Phase 2: AI draft extraction ────────────────────────────────────────────
// Deterministic normalization + claim engine (the mandatory acceptance test):
// recognises INS/E-numbers, functional class & flags, added sugar, compound
// ingredients, and runs claim contradiction checks. Rules ≠ model — this is
// deterministic and testable; Workers AI (env.AI) assists OCR/free-text when
// available, but never drives a legal conclusion.
const INS_MAP: Record<string, { cls: string; flags: string[] }> = {
  "102":{cls:"Colour",flags:["synthetic-colour"]}, "110":{cls:"Colour",flags:["synthetic-colour"]},
  "122":{cls:"Colour",flags:["synthetic-colour"]}, "129":{cls:"Colour",flags:["synthetic-colour"]},
  "150c":{cls:"Colour",flags:["synthetic-colour"]}, "150d":{cls:"Colour",flags:["synthetic-colour"]},
  "202":{cls:"Preservative",flags:["preservative"]}, "211":{cls:"Preservative",flags:["preservative"]},
  "223":{cls:"Preservative",flags:["preservative"]},
  "296":{cls:"Acidity Regulator",flags:[]}, "330":{cls:"Acidity Regulator",flags:[]}, "331":{cls:"Acidity Regulator",flags:[]},
  "621":{cls:"Flavour Enhancer",flags:["msg"]}, "635":{cls:"Flavour Enhancer",flags:["msg"]},
  "951":{cls:"Sweetener",flags:["artificial-sweetener"]}, "950":{cls:"Sweetener",flags:["artificial-sweetener"]},
};
// Big-8 (+ India FSSAI) allergen lexicon → declaration matcher. Each hit is a
// draft the reviewer confirms; "may contain / traces" is recorded as cross-contact.
const ALLERGEN_MAP: Array<{ allergen: string; re: RegExp }> = [
  { allergen: "Milk",       re: /\b(milk|dairy|whey|casein|lactose|butter|ghee|paneer|cheese|curd|khoya)\b/i },
  { allergen: "Egg",        re: /\b(egg|albumen|ovalbumin)\b/i },
  { allergen: "Peanut",     re: /\b(peanut|groundnut)\b/i },
  { allergen: "Tree nuts",  re: /\b(almond|cashew|walnut|pistachio|hazelnut|pecan|tree ?nut)\b/i },
  { allergen: "Soy",        re: /\b(soy|soya|soybean|soja)\b/i },
  { allergen: "Wheat / Gluten", re: /\b(wheat|gluten|barley|rye|maida|atta|semolina|suji|rava)\b/i },
  { allergen: "Fish",       re: /\b(fish|anchovy|cod|tuna)\b/i },
  { allergen: "Crustacean", re: /\b(shrimp|prawn|crab|lobster|crustacean)\b/i },
  { allergen: "Sesame",     re: /\b(sesame|til|tahini)\b/i },
  { allergen: "Mustard",    re: /\b(mustard|sarson)\b/i },
  { allergen: "Sulphites",  re: /\b(sulphite|sulfite|e ?22[0-8])\b/i },
];
const NUTRIENT_MAP: Array<{ nutrient: string; unit: string; re: RegExp }> = [
  { nutrient: "Energy",        unit: "kcal", re: /\benergy\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*(?:kcal|cal)/i },
  { nutrient: "Protein",       unit: "g",    re: /\bprotein\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
  { nutrient: "Total Fat",     unit: "g",    re: /\b(?:total\s+)?fat\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
  { nutrient: "Saturated Fat", unit: "g",    re: /\bsaturated\s+fat\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
  { nutrient: "Carbohydrate",  unit: "g",    re: /\b(?:total\s+)?carbohydrate?s?\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
  { nutrient: "Total Sugars",  unit: "g",    re: /\b(?:total\s+)?sugars?\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
  { nutrient: "Sodium",        unit: "mg",   re: /\bsodium\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*mg/i },
  { nutrient: "Salt",          unit: "g",    re: /\bsalt\b[^0-9]{0,20}(\d+(?:\.\d+)?)\s*g/i },
];
function extractProductIntel(text: string): { ingredients: Array<Record<string,unknown>>; claims: Array<Record<string,string>>; allergens: Array<Record<string,unknown>>; nutrition: Array<Record<string,unknown>>; attributes: Array<Record<string,unknown>> } {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const ingredients: Array<Record<string,unknown>> = [];
  const seen = new Set<string>();
  const reg = /\b[ei]\s?-?\s?(\d{3,4})\s?([a-d])?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = reg.exec(raw))) {
    const code = m[1] + (m[2] ? m[2].toLowerCase() : "");
    if (seen.has(code)) continue; seen.add(code);
    const info = INS_MAP[code] || INS_MAP[m[1]] || { cls: "Additive", flags: [] };
    ingredients.push({ raw_text: m[0].trim(), normalized: "E" + code.toUpperCase(), ins_code: code,
      functional_class: info.cls, flags: info.flags.join(","), state: "detected", source: "ai", confidence: 0.9 });
  }
  const hasSugar = /\bsugar\b|\bsucrose\b|\bglucose\b|\bfructose\b|\bjaggery\b/.test(lower);
  if (hasSugar) ingredients.push({ raw_text: "sugar", normalized: "Added sugar", ins_code: "", functional_class: "Sweetener", flags: "added-sugar", state: "detected", source: "ai", confidence: 0.85 });
  const compound = /\bspices?\b|\bcondiments?\b|\bflavou?rs?\b/.test(lower);
  if (compound) ingredients.push({ raw_text: "spices & condiments / flavours", normalized: "Compound ingredient", ins_code: "", functional_class: "Compound", flags: "compound,unspecified", state: "detected", source: "ai", confidence: 0.55 });

  const flags = new Set(ingredients.flatMap(i => String(i.flags || "").split(",").filter(Boolean)));
  const claim = (name: string, bad: boolean, why: string, review = false) => ({ name, outcome: bad ? "CONTRADICTED" : (review ? "NEEDS_REVIEW" : "NO_CONFLICT"), why });
  const claims = [
    claim("No Added Sugar", hasSugar, hasSugar ? "sugar found in ingredients" : "no sugar found"),
    claim("No Preservatives", flags.has("preservative"), flags.has("preservative") ? "preservative additive detected" : "none detected"),
    claim("No Artificial / Synthetic Colours", flags.has("synthetic-colour"), flags.has("synthetic-colour") ? "synthetic colour detected" : "none detected"),
  ];
  if (compound) claims.push(claim("Ingredient transparency", false, "compound / unspecified ingredient — qualified review needed", true));

  // Allergens — split the declaration so each allergen is classified per its own
  // clause: those in the "may contain / traces / same line" segment are recorded
  // as cross-contact (not a hard "contains"), the rest as declared ingredients.
  const allergens: Array<Record<string,unknown>> = [];
  const traceMarker = raw.search(/\b(may contain|traces of|manufactured (?:in|on)|same (?:line|facility|equipment))\b/i);
  const declaredSeg = traceMarker >= 0 ? raw.slice(0, traceMarker) : raw;
  const traceSeg    = traceMarker >= 0 ? raw.slice(traceMarker) : "";
  for (const a of ALLERGEN_MAP) {
    const inDeclared = a.re.test(declaredSeg);
    const inTrace    = a.re.test(traceSeg);
    if (!inDeclared && !inTrace) continue;
    if (inDeclared)
      allergens.push({ allergen: a.allergen, contains_state: "contains", cross_contact_state: "unknown", source: "ai", confidence: 0.8 });
    else // trace-only mention
      allergens.push({ allergen: a.allergen, contains_state: "not_declared", cross_contact_state: "possible", source: "ai", confidence: 0.7 });
  }

  // Nutrition panel — pull declared per-serving/100g figures where present.
  const nutrition: Array<Record<string,unknown>> = [];
  const basis = /\bper\s*100\s*g\b/i.test(raw) ? "per 100g" : (/\bper\s*serv/i.test(raw) ? "per serving" : "per 100g");
  for (const n of NUTRIENT_MAP) {
    const mm = raw.match(n.re);
    if (mm) nutrition.push({ nutrient: n.nutrient, value: mm[1], unit: n.unit, basis, source: "ai", confidence: 0.75 });
  }

  // Derived dietary/formulation attributes the reviewer can accept into the editor.
  const attributes: Array<Record<string,unknown>> = [];
  const addAttr = (name: string, grp: string) => attributes.push({ name, grp, source: "ai" });
  if (flags.has("synthetic-colour"))    addAttr("Contains synthetic colour", "formulation");
  if (flags.has("preservative"))        addAttr("Contains preservatives", "formulation");
  if (flags.has("msg"))                 addAttr("Contains added MSG", "formulation");
  if (flags.has("artificial-sweetener"))addAttr("Contains artificial sweetener", "formulation");
  if (hasSugar)                         addAttr("Contains added sugar", "formulation");
  if (!flags.has("synthetic-colour") && !flags.has("preservative") && !flags.has("msg") && !flags.has("artificial-sweetener"))
    addAttr("No synthetic colour/preservative detected", "formulation");

  return { ingredients, claims, allergens, nutrition, attributes };
}

// GET /api/ai/health — is Workers AI actually callable on this account? Does a
// tiny real inference so the answer reflects entitlement, not just the binding.
async function handleAiHealth(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can check AI status"}, 403);
  if (!env.AI) return json({ status:"disabled", bound:false, detail:"No Workers AI binding on this deployment." });
  const t0 = Date.now();
  try {
    const out = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [{ role:"user", content:"Reply with the single word: ok" }], max_tokens: 5,
    }) as { response?: string } | string;
    const reply = (typeof out === "string" ? out : (out.response || "")).trim();
    return json({ status:"enabled", bound:true, model:"@cf/meta/llama-3.3-70b-instruct-fp8-fast", latency_ms: Date.now()-t0, sample: reply.slice(0,40) });
  } catch (e) {
    return json({ status:"error", bound:true, detail:String(e).slice(0,200), latency_ms: Date.now()-t0 });
  }
}

// POST /api/catalogue/:sku/ocr — transcribe a label photo with a Workers AI
// vision model. OCR needs a model (no deterministic fallback), so this is the
// one Product-Intelligence action that requires env.AI. It only returns text —
// the reviewer confirms it, then runs /extract. Images stay on-platform.
async function handleOcrLabel(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can run OCR"}, 403);
  const sku = decodeURIComponent(path.split("/").slice(-2)[0]);
  const exists = await env.DB.prepare("SELECT sku FROM inventory WHERE sku=?").bind(sku).first();
  if (!exists) return json({error:"Unknown SKU"}, 404);
  if (!env.AI) return json({error:"OCR needs Workers AI, which isn't enabled on this account. Paste the label text instead."}, 503);

  const body = await request.json() as { image_base64?: string };
  let b64 = String(body.image_base64 || "").trim();
  const comma = b64.indexOf(",");
  if (b64.startsWith("data:") && comma >= 0) b64 = b64.slice(comma + 1); // strip data: URL prefix
  if (!b64) return json({error:"Attach a label image to transcribe"}, 400);
  // Reject oversized payloads BEFORE decoding — base64 is ~4/3 the byte size, so
  // a ~4 MB image encodes to ~5.6 MB. Cap the encoded string to avoid decoding
  // and allocating an arbitrarily large buffer in the isolate.
  if (b64.length > 5_600_000) return json({error:"Image too large — keep it under ~4 MB"}, 413);

  let bytes: number[];
  try {
    const bin = atob(b64);
    bytes = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch { return json({error:"Could not read the image data"}, 400); }

  let text = "";
  try {
    const out = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      image: bytes,
      prompt: "Transcribe ALL text printed on this food product label exactly as written — especially the ingredients list, additive / INS / E-numbers, allergen declarations and any claims (e.g. 'No Added Sugar'). Output only the transcribed text, no commentary.",
      max_tokens: 800,
    }) as { response?: string; description?: string; text?: string } | string;
    text = typeof out === "string" ? out : (out.response || out.description || out.text || "");
  } catch (e) {
    return json({error:"OCR failed — the vision model was unavailable. Paste the label text instead.", detail:String(e).slice(0,200)}, 502);
  }
  text = text.trim();
  await audit(env, user, "OCR_LABEL", "product", sku, undefined, `${text.length} chars transcribed`);
  return json({ sku, text });
}

async function handleExtractIntel(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!PI_ROLES.includes(user!.role)) return json({error:"Only Super Admin or Ops can run extraction"}, 403);
  const sku = decodeURIComponent(path.split("/").slice(-2)[0]);
  const exists = await env.DB.prepare("SELECT sku FROM inventory WHERE sku=?").bind(sku).first();
  if (!exists) return json({error:"Unknown SKU"}, 404);
  const body = await request.json() as { ingredient_text?: string; use_ai?: boolean };
  const text = String(body.ingredient_text || "").trim();
  if (!text) return json({error:"Paste the label ingredient text to extract from"}, 400);

  // Best-effort Workers AI pass — proves the binding and (later) does OCR. The
  // deterministic engine remains the source of truth, so a failure is non-fatal.
  let aiUsed = false;
  if (body.use_ai !== false && env.AI) {
    try {
      await env.AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        { messages: [
          { role: "system", content: "You extract food-label facts. Reply with a short JSON object {\"additives\":[],\"has_added_sugar\":false}. Never state legality." },
          { role: "user", content: text.slice(0, 2000) },
        ], max_tokens: 300 });
      aiUsed = true;
    } catch { aiUsed = false; }
  }

  const result = extractProductIntel(text);
  // Replace only AI-sourced drafts across the tables (keep anything human-entered).
  await env.DB.prepare("DELETE FROM product_ingredients WHERE sku=? AND source='ai'").bind(sku).run();
  for (const g of result.ingredients) {
    await env.DB.prepare("INSERT INTO product_ingredients (id,sku,raw_text,normalized,ins_code,functional_class,flags,state,source) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(uid(), sku, g.raw_text, g.normalized, g.ins_code, g.functional_class, g.flags, g.state, "ai").run();
  }
  await env.DB.prepare("DELETE FROM product_allergens WHERE sku=? AND source='ai'").bind(sku).run();
  for (const a of result.allergens) {
    await env.DB.prepare("INSERT INTO product_allergens (id,sku,allergen,contains_state,cross_contact_state,source) VALUES (?,?,?,?,?,?)")
      .bind(uid(), sku, a.allergen, a.contains_state, a.cross_contact_state, "ai").run();
  }
  await env.DB.prepare("DELETE FROM product_nutrition WHERE sku=? AND source='ai'").bind(sku).run();
  for (const n of result.nutrition) {
    await env.DB.prepare("INSERT INTO product_nutrition (id,sku,nutrient,value,unit,basis,source) VALUES (?,?,?,?,?,?,?)")
      .bind(uid(), sku, n.nutrient, n.value, n.unit, n.basis, "ai").run();
  }
  // Mark the product AI-screened (never verified — that stays a human action).
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO product_fitment (sku,verification,fitment_state,updated_at) VALUES (?, 'ai_screened', 'REVIEW', ?)
     ON CONFLICT(sku) DO UPDATE SET verification=CASE WHEN product_fitment.verification='verified' THEN 'verified' ELSE 'ai_screened' END, updated_at=excluded.updated_at`
  ).bind(sku, now).run();
  await audit(env, user, "AI_EXTRACT", "product", sku, undefined,
    `${result.ingredients.length} ing · ${result.allergens.length} allergen · ${result.nutrition.length} nutrient${aiUsed ? " · AI" : " · rules"}`);
  return json({ sku, ai_used: aiUsed, ingredients: result.ingredients, claims: result.claims,
    allergens: result.allergens, nutrition: result.nutrition, attributes: result.attributes });
}

// ════════════════════════════════════════════════════════════════════
// VENDORS
// ════════════════════════════════════════════════════════════════════

async function handleListVendors(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // Clients have no business seeing the supplier list; vendors see only themselves.
  if (["client_admin","client_approver","client_user"].includes(user!.role)) return json([]);
  if (["vendor_admin","vendor_user"].includes(user!.role)) {
    const {results} = await env.DB.prepare("SELECT * FROM vendors WHERE contact_email LIKE ? ORDER BY name")
      .bind(`%${vendorEmailDomain(user!)}%`).all();
    return json(results);
  }
  const {results} = await env.DB.prepare("SELECT * FROM vendors ORDER BY name").all();
  return json(results);
}

// Validate a vendor's registration + food-safety compliance.
// registered ⇒ a valid GSTIN (PAN derived/checked); food ⇒ 14-digit FSSAI + expiry.
type VendorCompliance = { registration_type: string; gstin: string|null; pan: string|null;
  vendor_type: string; fssai_licence: string|null; fssai_expiry: string|null; error?: string };
function resolveVendorCompliance(body: Record<string,unknown>): VendorCompliance {
  const reg = body.registration_type === 'registered' ? 'registered' : 'unregistered';
  const vtype = body.vendor_type === 'food' ? 'food' : 'non_food';
  let gstin: string|null = null, pan: string|null = null;
  if (reg === 'registered') {
    const t = resolveTaxIds(body.gstin, body.pan);
    if (t.error) return { registration_type: reg, gstin:null, pan:null, vendor_type: vtype, fssai_licence:null, fssai_expiry:null, error: t.error };
    if (!t.gstin) return { registration_type: reg, gstin:null, pan:null, vendor_type: vtype, fssai_licence:null, fssai_expiry:null, error: "GST number is required for a registered vendor" };
    gstin = t.gstin; pan = t.pan;
  }
  let fssai: string|null = null, fssaiExp: string|null = null;
  if (vtype === 'food') {
    const lic = String(body.fssai_licence || '').trim();
    if (!/^\d{14}$/.test(lic)) return { registration_type: reg, gstin, pan, vendor_type: vtype, fssai_licence:null, fssai_expiry:null, error: "A valid 14-digit FSSAI licence number is required for a food vendor" };
    const exp = String(body.fssai_expiry || '').trim();
    if (!exp) return { registration_type: reg, gstin, pan, vendor_type: vtype, fssai_licence:null, fssai_expiry:null, error: "FSSAI expiry date is required for a food vendor" };
    fssai = lic; fssaiExp = exp;
  }
  return { registration_type: reg, gstin, pan, vendor_type: vtype, fssai_licence: fssai, fssai_expiry: fssaiExp };
}

const VENDOR_ONB_STATES = ['draft','pending','active','rejected'];
// Persist a vendor's onboarding sub-resources (documents & products) — replace-all
// semantics, so the wizard's step lists are the source of truth. Each document is
// stored as a base64 data URL (MVP; move to R2 later). Capped to keep D1 lean.
const MAX_DOC_BYTES = 1_200_000; // ~1.2 MB per file

// ── Document storage (#9) ────────────────────────────────────────────────────
// R2 when the DOCS bucket is bound, else base64 inline in D1 (legacy fallback).
// The DB column holds either the base64 itself or an "r2:<key>" pointer; docGet
// resolves either form transparently, so old base64 rows keep working after R2
// is enabled. Base64 is stored verbatim as the R2 object for an exact round-trip.
// Accessed via a cast so the code compiles whether or not the binding is present
// in the generated Env (uncomment the r2_buckets block in wrangler.jsonc + run
// `wrangler types` to make it a first-class binding).
function docsBucket(env: Env): R2Bucket | undefined {
  return (env as unknown as { DOCS?: R2Bucket }).DOCS;
}
async function docPut(env: Env, prefix: string, b64: string): Promise<string> {
  const bucket = docsBucket(env);
  if (bucket && b64) {
    const key = `${prefix}/${uid()}`;
    await bucket.put(key, b64);
    return `r2:${key}`;
  }
  return b64; // fallback: keep the base64 inline in D1
}
async function docGet(env: Env, stored: string | null): Promise<string> {
  if (stored && stored.startsWith("r2:")) {
    const bucket = docsBucket(env);
    if (!bucket) return ""; // pointer exists but bucket unbound
    try { const obj = await bucket.get(stored.slice(3)); return obj ? await obj.text() : ""; }
    catch { return ""; }
  }
  return stored || "";
}
async function docDelete(env: Env, stored: string | null): Promise<void> {
  const bucket = docsBucket(env);
  if (stored && stored.startsWith("r2:") && bucket) {
    try { await bucket.delete(stored.slice(3)); } catch { /* ignore */ }
  }
}
async function saveVendorSubResources(env: Env, vendorId: string, body: Record<string,unknown>): Promise<string|undefined> {
  if (Array.isArray(body.documents)) {
    // documents are replace-all — free any R2 objects backing the old rows first
    try {
      const { results } = await env.DB.prepare("SELECT data FROM vendor_documents WHERE vendor_id=?").bind(vendorId).all();
      for (const r of (results || []) as Array<{ data: string }>) await docDelete(env, r.data);
    } catch { /* ignore */ }
    await env.DB.prepare("DELETE FROM vendor_documents WHERE vendor_id=?").bind(vendorId).run();
    for (const d of body.documents as Array<Record<string,unknown>>) {
      const data = String(d.data || '');
      if (data && data.length > MAX_DOC_BYTES) return `${d.kind || 'A document'} is too large — keep uploads under 1 MB`;
      const storedData = data ? await docPut(env, `vendor/${vendorId}`, data) : null;
      await env.DB.prepare("INSERT INTO vendor_documents (id,vendor_id,kind,filename,mime,size,data,expiry_date) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), vendorId, String(d.kind||'other'), String(d.filename||''), String(d.mime||''), Number(d.size)||0, storedData, d.expiry_date?String(d.expiry_date):null).run();
    }
  }
  if (Array.isArray(body.products)) {
    await env.DB.prepare("DELETE FROM vendor_products WHERE vendor_id=?").bind(vendorId).run();
    for (const pr of body.products as Array<Record<string,unknown>>) {
      if (!pr.name) continue;
      await env.DB.prepare("INSERT INTO vendor_products (id,vendor_id,sku,name,pack,moq,rate,lead_days,mrp,margin_pct,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        .bind(uid(), vendorId, pr.sku?String(pr.sku):null, String(pr.name), pr.pack?String(pr.pack):null,
          Number(pr.moq)||1, Number(pr.rate)||0, Number(pr.lead_days)||3,
          pr.mrp!=null&&pr.mrp!==''?Number(pr.mrp):null, pr.margin_pct!=null&&pr.margin_pct!==''?Number(pr.margin_pct):null,
          pr.sku?'linked':'new_sku').run();
    }
  }
  return undefined;
}

async function handleAddVendor(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const comp = resolveVendorCompliance(body);
  if (comp.error) return json({ error: comp.error }, 400);
  const status = VENDOR_ONB_STATES.includes(String(body.onboarding_status)) ? String(body.onboarding_status) : 'active';
  const id = `v${uid().slice(0,6)}`;
  const vendorCode = formatVendorCode(new Date().getFullYear(), await nextVendorSeq(env));
  const leadDays = body.avg_lead_days != null && body.avg_lead_days !== '' ? Number(body.avg_lead_days) : 3;
  await env.DB.prepare("INSERT INTO vendors (id,vendor_code,name,category,location,address,map_pin,contact_email,contact_phone,avg_lead_days,notes,visit_frequency,visit_day,registration_type,gstin,pan,vendor_type,fssai_licence,fssai_expiry,onboarding_status,bank_account_name,bank_account_no,bank_ifsc,bank_name,bank_branch,upi_id,payment_terms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,vendorCode,body.name,body.category,body.location||'',body.address||'',body.map_pin||'',body.contact_email||null,body.contact_phone||null,
      isNaN(leadDays)?3:leadDays, body.notes||null, body.visit_frequency||null, body.visit_day||null,
      comp.registration_type, comp.gstin, comp.pan, comp.vendor_type, comp.fssai_licence, comp.fssai_expiry,
      status, body.bank_account_name||null, body.bank_account_no||null, body.bank_ifsc||null, body.bank_name||null,
      body.bank_branch||null, body.upi_id||null, body.payment_terms||null).run();
  const subErr = await saveVendorSubResources(env, id, body);
  if (subErr) return json({ error: subErr }, 400);
  await sendEmail(env, body.contact_email as string, "Welcome to Smart Pantry Vendor Portal",
    `Dear ${body.name},\n\nYou have been registered as a vendor on the Smart Pantry platform.\n\nVendor Code: ${vendorCode}\n\nRegards,\n4SYZ Smart Pantry Team`);
  await audit(env, user, "CREATE", "vendor", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handlePatchVendor(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  // Clients cannot edit vendors; a vendor may edit only its own record.
  if (isExternalRole(user!.role)) {
    if (!["vendor_admin","vendor_user"].includes(user!.role)) return json({error:"Forbidden"}, 403);
    const v = await env.DB.prepare("SELECT contact_email FROM vendors WHERE id=?").bind(id).first() as {contact_email?:string}|null;
    if (!v || !String(v.contact_email||"").includes(vendorEmailDomain(user!))) return json({error:"Forbidden"}, 403);
  }
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.name          !== undefined) { fields.push("name=?");          vals.push(body.name||''); }
  if (body.category      !== undefined) { fields.push("category=?");      vals.push(body.category||''); }
  if (body.contact_email !== undefined) { fields.push("contact_email=?"); vals.push(body.contact_email||null); }
  if (body.contact_phone !== undefined) { fields.push("contact_phone=?"); vals.push(body.contact_phone||null); }
  if (body.location      !== undefined) { fields.push("location=?");      vals.push(body.location||''); }
  if (body.address       !== undefined) { fields.push("address=?");       vals.push(body.address||''); }
  if (body.map_pin       !== undefined) { fields.push("map_pin=?");       vals.push(body.map_pin||''); }
  if (body.avg_lead_days !== undefined) { const n=Number(body.avg_lead_days); fields.push("avg_lead_days=?"); vals.push(isNaN(n)?3:n); }
  if (body.notes         !== undefined) { fields.push("notes=?");           vals.push(body.notes||null); }
  if (body.visit_frequency !== undefined) { fields.push("visit_frequency=?"); vals.push(body.visit_frequency||null); }
  if (body.visit_day     !== undefined) { fields.push("visit_day=?");       vals.push(body.visit_day||null); }
  if (body.registration_type !== undefined || body.vendor_type !== undefined) {
    const comp = resolveVendorCompliance(body);
    if (comp.error) return json({ error: comp.error }, 400);
    fields.push("registration_type=?"); vals.push(comp.registration_type);
    fields.push("gstin=?");             vals.push(comp.gstin);
    fields.push("pan=?");               vals.push(comp.pan);
    fields.push("vendor_type=?");       vals.push(comp.vendor_type);
    fields.push("fssai_licence=?");     vals.push(comp.fssai_licence);
    fields.push("fssai_expiry=?");      vals.push(comp.fssai_expiry);
  }
  for (const c of ["bank_account_name","bank_account_no","bank_ifsc","bank_name","bank_branch","upi_id","payment_terms"]) {
    if (body[c] !== undefined) { fields.push(`${c}=?`); vals.push(body[c]||null); }
  }
  if (body.onboarding_status !== undefined && VENDOR_ONB_STATES.includes(String(body.onboarding_status))) {
    fields.push("onboarding_status=?"); vals.push(String(body.onboarding_status));
  }
  if (body.active        !== undefined) { fields.push("active=?");        vals.push(body.active); }
  const subErr = await saveVendorSubResources(env, id, body);
  if (subErr) return json({ error: subErr }, 400);
  if (!fields.length) return json({id}); // sub-resources may be all that changed
  vals.push(id);
  await env.DB.prepare(`UPDATE vendors SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

async function handleListVendorDocuments(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const vid = path.split("/")[3];
  const { results } = await env.DB.prepare("SELECT id,kind,filename,mime,size,data,expiry_date,uploaded_at FROM vendor_documents WHERE vendor_id=? ORDER BY uploaded_at").bind(vid).all();
  for (const r of (results || []) as Array<Record<string, unknown>>) r.data = await docGet(env, r.data as string | null);
  return json(results);
}

async function handleListVendorProducts(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const vid = path.split("/")[3];
  const { results } = await env.DB.prepare("SELECT id,sku,name,pack,moq,rate,lead_days,mrp,margin_pct,status FROM vendor_products WHERE vendor_id=? ORDER BY name").bind(vid).all();
  return json(results);
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
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // procurement is 4SYZ-only
  const body = await request.json() as {vendor_id:string;order_id?:string;items:Array<{sku:string;name:string;qty:number;unit_price:number}>;expected_delivery?:string;notes?:string};
  if (!body.vendor_id || !body.items?.length) return json({error:"vendor_id and items required"}, 400);

  // G9: don't raise a PO to a non-compliant vendor.
  const issue = await vendorComplianceIssue(env, body.vendor_id);
  if (issue) return json({error:`Cannot raise PO — ${issue}`}, 422);

  const id = await nextPONumber(env);
  // Per-line GST from each item's slab (inventory.gst_rate) — supports mixed-slab POs.
  let subtotal = 0, gst = 0;
  for (const it of body.items) {
    const lt = it.qty * it.unit_price;
    const inv = await env.DB.prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(it.sku).first() as Record<string,number>|null;
    const rate = inv && inv.gst_rate != null ? Number(inv.gst_rate) : 18;
    subtotal += lt;
    gst += Math.round(lt * rate / 100);
  }
  const grand_total = subtotal + gst;

  // G8: hold high-value POs for approval before they reach the vendor.
  const threshold = await poApprovalThreshold(env);
  const needsApproval = threshold > 0 && grand_total >= threshold;
  const status = needsApproval ? "PENDING_APPROVAL" : "SENT";

  await env.DB.prepare(`INSERT INTO purchase_orders (id,vendor_id,order_id,status,subtotal,gst,grand_total,expected_delivery,notes)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(id,body.vendor_id,body.order_id||null,status,subtotal,gst,grand_total,body.expected_delivery||null,body.notes||null).run();

  for (const item of body.items) {
    await env.DB.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
      .bind(uid(),id,item.sku,item.name,item.qty,item.unit_price,item.qty*item.unit_price).run();
  }

  if (body.order_id) {
    await env.DB.prepare("UPDATE orders SET status='VENDOR_PO_RAISED',updated_at=datetime('now') WHERE id=? AND status='INVENTORY_CHECK'").bind(body.order_id).run();
  }

  if (needsApproval) {
    await pushNotification(env, "procurement_manager", `PO ${id} needs approval — ₹${grand_total.toLocaleString("en-IN")}`);
  } else {
    const vendor = await env.DB.prepare("SELECT * FROM vendors WHERE id=?").bind(body.vendor_id).first() as Record<string,string>|null;
    if (vendor?.contact_email) {
      await sendEmail(env, vendor.contact_email, `New Purchase Order ${id}`,
        `Dear ${vendor.name},\n\nPO ${id} has been raised for ₹${grand_total.toLocaleString("en-IN")}.\nPlease log in to the vendor portal to accept or reject.\n\nRegards,\n4SYZ Smart Pantry`);
    }
    await pushNotification(env, "vendor_admin", `New PO ${id} received — ₹${grand_total.toLocaleString("en-IN")}`);
  }
  await audit(env, user, "CREATE", "purchase_order", id, undefined, `vendor:${body.vendor_id},total:${grand_total},status:${status}`);
  return json({id, grand_total, status}, 201);
}

// ── Sourcing (G4): resolve each SKU to a usable vendor + price, group by vendor ──
// Vendor selection = primary (inventory.vendor_id) then secondary, skipping any
// vendor that is inactive, not fully onboarded, or with an expired FSSAI licence.
// Price = vendor-specific rate (vendor_products) else the inventory cost; qty is
// lifted to the vendor MOQ; GST is per-line from the item's gst_rate.
type SourceLine = { sku:string; name:string; qty:number; rate:number; gst_rate:number; total:number };
type SourceGroup = { vendor_id:string; vendor_name:string; lines:SourceLine[]; subtotal:number; gst:number; grand_total:number };
async function resolveSourcing(env: Env, items: Array<{sku:string; qty:number}>): Promise<{groups:SourceGroup[]; unsourced:Array<{sku:string;name:string;qty:number;reason:string}>}> {
  const today = new Date().toISOString().slice(0,10);
  const groups = new Map<string, SourceGroup>();
  const unsourced: Array<{sku:string;name:string;qty:number;reason:string}> = [];

  for (const it of items) {
    const qtyReq = Number(it.qty) || 0;
    if (qtyReq <= 0) continue;
    const inv = await env.DB.prepare("SELECT sku,name,unit_price,gst_rate,vendor_id,secondary_vendor_id FROM inventory WHERE sku=?").bind(it.sku).first() as Record<string,unknown>|null;
    if (!inv) { unsourced.push({sku:it.sku, name:it.sku, qty:qtyReq, reason:"Unknown SKU"}); continue; }

    let chosen: Record<string,unknown>|null = null;
    for (const vid of [inv.vendor_id, inv.secondary_vendor_id]) {
      if (!vid) continue;
      const v = await env.DB.prepare("SELECT id,name,active,onboarding_status,fssai_expiry FROM vendors WHERE id=?").bind(vid).first() as Record<string,unknown>|null;
      if (!v) continue;
      if (Number(v.active) === 0) continue;
      if (v.onboarding_status && v.onboarding_status !== "active") continue;
      if (v.fssai_expiry && String(v.fssai_expiry) < today) continue;
      chosen = v; break;
    }
    if (!chosen) {
      unsourced.push({sku:it.sku, name:String(inv.name), qty:qtyReq,
        reason: inv.vendor_id ? "No usable vendor (inactive / not onboarded / FSSAI expired)" : "No vendor mapped"});
      continue;
    }

    const vp = await env.DB.prepare("SELECT rate,moq FROM vendor_products WHERE vendor_id=? AND sku=?").bind(chosen.id, it.sku).first() as Record<string,number>|null;
    const rate = vp && Number(vp.rate) > 0 ? Number(vp.rate) : Number(inv.unit_price || 0);
    const moq  = vp && Number(vp.moq)  > 0 ? Number(vp.moq)  : 1;
    const qty  = Math.max(qtyReq, moq);
    const gstRate = inv.gst_rate != null ? Number(inv.gst_rate) : 18;
    const total = qty * rate;

    const vid = String(chosen.id);
    if (!groups.has(vid)) groups.set(vid, {vendor_id:vid, vendor_name:String(chosen.name), lines:[], subtotal:0, gst:0, grand_total:0});
    const g = groups.get(vid)!;
    g.lines.push({sku:it.sku, name:String(inv.name), qty, rate, gst_rate:gstRate, total});
    g.subtotal += total;
    g.gst += Math.round(total * gstRate / 100);
  }
  const groupArr = [...groups.values()].map(g => ({...g, grand_total: g.subtotal + g.gst}));
  return {groups: groupArr, unsourced};
}

function parseItemsParam(raw: string | null): Array<{sku:string; qty:number}> {
  if (!raw) return [];
  return raw.split(",").map(pair => {
    const [sku, qty] = pair.split(":");
    return {sku: (sku||"").trim(), qty: Number(qty)||0};
  }).filter(x => x.sku && x.qty > 0).slice(0, 200);
}

// GET /api/sourcing/preview?items=sku:qty,sku:qty — the vendor-split preview.
async function handleSourcingPreview(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const url = new URL(request.url);
  const items = parseItemsParam(url.searchParams.get("items"));
  if (!items.length) return json({error:"items required (sku:qty,sku:qty)"}, 400);
  return json(await resolveSourcing(env, items));
}

// POST /api/purchase-orders/from-demand — one PO per resolved vendor.
async function handlePOFromDemand(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as {items:Array<{sku:string;qty:number}>; source?:string; notes?:string; skip_open_po?:boolean};
  if (!body.items?.length) return json({error:"items required"}, 400);

  // Replenishment guard (skip_open_po): never re-raise for a SKU that already has
  // an open, unreceived PO — otherwise repeated "Raise POs for all" clicks
  // duplicate-order the same items. Same open-status set as the auto-reorder.
  let items = body.items;
  const skippedOpen: string[] = [];
  if (body.skip_open_po) {
    const { results: openRows } = await env.DB.prepare(
      `SELECT DISTINCT pi.sku FROM po_items pi JOIN purchase_orders p ON p.id=pi.po_id
       WHERE p.status IN ('PENDING_APPROVAL','SENT','ACCEPTED','DISPATCHED','PARTIALLY_RECEIVED')`
    ).all() as { results: Array<{sku:string}> };
    const openSet = new Set(openRows.map(r => String(r.sku)));
    items = items.filter(it => { if (openSet.has(it.sku)) { skippedOpen.push(it.sku); return false; } return true; });
    if (!items.length) {
      return json({ pos: [], unsourced: [], skipped_open: skippedOpen,
        note: "All requested items already have an open PO — nothing raised." }, 200);
    }
  }

  const {groups, unsourced} = await resolveSourcing(env, items);  // non-compliant vendors already excluded (G9)
  const label = body.source === "brand" ? "brand consolidation" : "consolidated demand";
  const threshold = await poApprovalThreshold(env);
  const pos: Array<{id:string; vendor_id:string; vendor_name:string; grand_total:number; line_count:number; status:string}> = [];

  for (const g of groups) {
    const id = await nextPONumber(env);
    const needsApproval = threshold > 0 && g.grand_total >= threshold;
    const status = needsApproval ? "PENDING_APPROVAL" : "SENT";
    await env.DB.prepare(`INSERT INTO purchase_orders (id,vendor_id,status,subtotal,gst,grand_total,notes)
      VALUES (?,?,?,?,?,?,?)`)
      .bind(id, g.vendor_id, status, g.subtotal, g.gst, g.grand_total, body.notes || `Auto-split from ${label}`).run();
    for (const ln of g.lines) {
      await env.DB.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)")
        .bind(uid(), id, ln.sku, ln.name, ln.qty, ln.rate, ln.total).run();
    }
    if (needsApproval) {
      await pushNotification(env, "procurement_manager", `PO ${id} needs approval — ₹${g.grand_total.toLocaleString("en-IN")}`);
    } else {
      const vendor = await env.DB.prepare("SELECT contact_email,name FROM vendors WHERE id=?").bind(g.vendor_id).first() as Record<string,string>|null;
      if (vendor?.contact_email) {
        await sendEmail(env, vendor.contact_email, `New Purchase Order ${id}`,
          `Dear ${vendor.name},\n\nPO ${id} has been raised for ₹${g.grand_total.toLocaleString("en-IN")} (${g.lines.length} items).\nPlease log in to the vendor portal to accept or reject.\n\nRegards,\n4SYZ Smart Pantry`);
      }
      await pushNotification(env, "vendor_admin", `New PO ${id} received — ₹${g.grand_total.toLocaleString("en-IN")}`);
    }
    await audit(env, user, "CREATE", "purchase_order", id, undefined, `from_demand vendor:${g.vendor_id} total:${g.grand_total} status:${status}`);
    pos.push({id, vendor_id:g.vendor_id, vendor_name:g.vendor_name, grand_total:g.grand_total, line_count:g.lines.length, status});
  }
  return json({pos, unsourced, skipped_open: skippedOpen}, 201);
}

// GET/PATCH /api/po-approval-threshold — the value (₹) above which POs are held.
async function handlePOApprovalThreshold(request: Request, env: Env, method: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  if (method === "GET") return json({threshold: await poApprovalThreshold(env)});
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as {threshold:number};
  const t = Math.max(0, Number(body.threshold) || 0);
  await setConfig(env, "po_approval_threshold", String(t), user!.sub);
  await audit(env, user, "UPDATE", "config", "po_approval_threshold", undefined, String(t));
  return json({threshold: t});
}

async function handlePatchPO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as {status?:string;invoice_url?:string};
  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!po) return json({error:"Not found"}, 404);

  // External scope: clients never touch POs; a vendor may act only on its OWN PO
  // (email-domain link) and only to acknowledge / dispatch / attach an invoice —
  // never to approve or cancel (those stay gated to procurement below).
  if (isExternalRole(user!.role)) {
    if (!["vendor_admin","vendor_user"].includes(user!.role)) return json({error:"Forbidden"}, 403);
    const v = await env.DB.prepare("SELECT contact_email FROM vendors WHERE id=?").bind(po.vendor_id).first() as {contact_email?:string}|null;
    if (!v || !String(v.contact_email||"").includes(vendorEmailDomain(user!))) return json({error:"Forbidden"}, 403);
    if (!["ACCEPTED","DISPATCHED"].includes(body.status||"") && body.invoice_url===undefined)
      return json({error:"Vendors can only acknowledge, dispatch or attach an invoice"}, 403);
  }

  // Cancellation policy: only before goods move (PENDING_APPROVAL / SENT / ACCEPTED),
  // and only by procurement/finance leads (or super_admin). Once a PO is DISPATCHED,
  // PARTIALLY_RECEIVED, RECEIVED or INVOICED, goods are in transit or received, so a
  // cancel would desync stock — blocked here.
  if (body.status === "CANCELLED") {
    if (!["PENDING_APPROVAL","SENT","ACCEPTED"].includes(po.status))
      return json({error:`Cannot cancel a PO once it is ${String(po.status).replace(/_/g," ")} — goods have moved. Raise a debit note instead.`}, 400);
    if (!PO_APPROVER_ROLES.includes(user!.role))
      return json({error:"Only procurement or finance leads can cancel a PO"}, 403);
    await audit(env, user, "CANCEL", "purchase_order", id, po.status, "CANCELLED");
  }

  // G8: approving/rejecting a held PO is restricted to procurement/finance leads.
  if (po.status === "PENDING_APPROVAL") {
    if (!PO_APPROVER_ROLES.includes(user!.role))
      return json({error:"Only procurement or finance leads can approve or reject a PO"}, 403);
    if (!["SENT","REJECTED","CANCELLED"].includes(body.status || ""))
      return json({error:"A held PO can only be approved (SENT) or rejected"}, 400);
    if (body.status === "SENT") {
      // Approved — the PO now goes to the vendor.
      const vendor = await env.DB.prepare("SELECT contact_email,name FROM vendors WHERE id=?").bind(po.vendor_id).first() as Record<string,string>|null;
      if (vendor?.contact_email) {
        await sendEmail(env, vendor.contact_email, `New Purchase Order ${id}`,
          `Dear ${vendor.name},\n\nPO ${id} has been approved and raised for ₹${Number(po.grand_total).toLocaleString("en-IN")}.\nPlease log in to the vendor portal to accept or reject.\n\nRegards,\n4SYZ Smart Pantry`);
      }
      await pushNotification(env, "vendor_admin", `New PO ${id} received — ₹${Number(po.grand_total).toLocaleString("en-IN")}`);
    }
    await audit(env, user, body.status === "SENT" ? "APPROVE" : "REJECT", "purchase_order", id, po.status, body.status || po.status);
  }

  const updates = ["updated_at=datetime('now')"];
  const vals: unknown[] = [];
  if (body.status)      { updates.push("status=?");      vals.push(body.status); }
  if (body.invoice_url) { updates.push("invoice_url=?"); vals.push(body.invoice_url); }
  vals.push(id);
  await env.DB.prepare(`UPDATE purchase_orders SET ${updates.join(",")} WHERE id=?`).bind(...vals).run();

  if (body.status === "ACCEPTED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status='READY_TO_PICK',updated_at=datetime('now') WHERE id=? AND status='VENDOR_PO_RAISED'").bind(po.order_id).run();
    await pushNotification(env, "ops_admin", `PO ${id} accepted by vendor — order ${po.order_id} ready to pick`);
  }
  if ((body.status === "REJECTED" || body.status === "CANCELLED") && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status='APPROVED',updated_at=datetime('now') WHERE id=? AND status='VENDOR_PO_RAISED'").bind(po.order_id).run();
    await pushNotification(env, "ops_admin", `PO ${id} ${body.status.toLowerCase()} — order ${po.order_id} reverted to APPROVED for reprocessing`);
  }
  if (body.status === "DISPATCHED" && po.order_id) {
    await env.DB.prepare("UPDATE orders SET status='IN_SHIPMENT',updated_at=datetime('now') WHERE id=? AND status IN ('READY_TO_PICK','VENDOR_PO_RAISED')").bind(po.order_id).run();
    await env.DB.prepare("UPDATE delivery_challans SET status='IN_TRANSIT',dispatched_at=datetime('now') WHERE order_id=?").bind(po.order_id).run();
  }
  // Note: INVOICED is now reached via POST /purchase-orders/:id/invoice (3-way
  // match + Zoho sync), not by a raw status PATCH — see handleInvoicePO.

  await audit(env, user, "UPDATE", "purchase_order", id, po.status, body.status||po.status);
  return json({id, status: body.status});
}

// PUT /api/purchase-orders/:id — amend a PO's lines/qty/price/vendor/date/notes.
// Policy: super_admin may amend any active PO; other procurement/finance leads only
// while the vendor hasn't acted (PENDING_APPROVAL / SENT). Terminal or billed POs
// (CANCELLED / REJECTED / PAID / INVOICED) are never amendable. Already-received
// quantities can't be reduced below what was received. Totals + GST are recomputed;
// if the value crosses the approval threshold the PO re-enters PENDING_APPROVAL.
async function handleAmendPO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as { items:Array<{sku:string;name:string;qty:number;unit_price:number}>; expected_delivery?:string; notes?:string; vendor_id?:string };
  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!po) return json({error:"Not found"}, 404);
  const status = String(po.status);

  if (!PO_APPROVER_ROLES.includes(user!.role))
    return json({error:"Only procurement or finance leads can amend a PO"}, 403);
  if (["CANCELLED","REJECTED","PAID","INVOICED"].includes(status))
    return json({error:`A ${status.replace(/_/g," ")} PO cannot be amended`}, 400);
  if (user!.role !== "super_admin" && !["PENDING_APPROVAL","SENT"].includes(status))
    return json({error:`This PO is ${status.replace(/_/g," ")} — only a super admin can amend it after the vendor has accepted`}, 403);
  if (!body.items?.length) return json({error:"At least one line item is required"}, 400);

  // Preserve receipt progress; block reducing a line below what's already received.
  const { results: existing } = await env.DB.prepare("SELECT sku, qty_received FROM po_items WHERE po_id=?").bind(id).all() as { results: Array<Record<string,unknown>> };
  const recvBySku: Record<string, number> = {};
  for (const r of existing) recvBySku[String(r.sku)] = Number(r.qty_received) || 0;
  for (const it of body.items) {
    const recv = recvBySku[it.sku] || 0;
    if (Number(it.qty) < recv)
      return json({error:`${it.name || it.sku}: quantity (${it.qty}) can't be below the ${recv} already received`}, 400);
  }

  const vendorId = body.vendor_id || String(po.vendor_id);
  if (body.vendor_id && body.vendor_id !== po.vendor_id) {
    const issue = await vendorComplianceIssue(env, vendorId);
    if (issue) return json({error:`Cannot switch vendor — ${issue}`}, 422);
  }

  // Recompute totals with per-line GST (mirrors handleCreatePO).
  let subtotal = 0, gst = 0;
  for (const it of body.items) {
    const lt = Number(it.qty) * Number(it.unit_price);
    const inv = await env.DB.prepare("SELECT gst_rate FROM inventory WHERE sku=?").bind(it.sku).first() as Record<string,number>|null;
    const rate = inv && inv.gst_rate != null ? Number(inv.gst_rate) : 18;
    subtotal += lt; gst += Math.round(lt * rate / 100);
  }
  const grand_total = subtotal + gst;

  // Replace line items, carrying receipt progress forward.
  await env.DB.prepare("DELETE FROM po_items WHERE po_id=?").bind(id).run();
  for (const it of body.items) {
    await env.DB.prepare("INSERT INTO po_items (id,po_id,sku,name,qty,unit_price,total,qty_received) VALUES (?,?,?,?,?,?,?,?)")
      .bind(uid(), id, it.sku, it.name, Number(it.qty), Number(it.unit_price), Number(it.qty)*Number(it.unit_price), recvBySku[it.sku] || 0).run();
  }

  // Re-approval only re-applies while the PO is still pre-vendor.
  let newStatus = status;
  if (["PENDING_APPROVAL","SENT"].includes(status)) {
    const threshold = await poApprovalThreshold(env);
    newStatus = (threshold > 0 && grand_total >= threshold) ? "PENDING_APPROVAL" : "SENT";
  }

  await env.DB.prepare("UPDATE purchase_orders SET vendor_id=?,subtotal=?,gst=?,grand_total=?,expected_delivery=?,notes=?,status=?,updated_at=datetime('now') WHERE id=?")
    .bind(vendorId, subtotal, gst, grand_total, body.expected_delivery || po.expected_delivery || null, body.notes != null ? body.notes : (po.notes || null), newStatus, id).run();

  await audit(env, user, "AMEND", "purchase_order", id, `total:${po.grand_total}`, `total:${grand_total},status:${newStatus}`);
  if (newStatus === "PENDING_APPROVAL" && status !== "PENDING_APPROVAL")
    await pushNotification(env, "procurement_manager", `PO ${id} amended above threshold — needs re-approval (₹${grand_total.toLocaleString("en-IN")})`);
  else
    await pushNotification(env, "vendor_admin", `PO ${id} amended — new total ₹${grand_total.toLocaleString("en-IN")}`);

  return json({ id, status: newStatus, grand_total });
}

// ════════════════════════════════════════════════════════════════════
// DELIVERY CHALLANS (Gap 14: partial delivery)
// ════════════════════════════════════════════════════════════════════

async function handleListDCs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const isClient = ["client_admin","client_approver","client_user"].includes(user!.role);
  let query = `SELECT dc.*,o.client_id,c.name as client_name,o.grand_total as order_value,
    COALESCE((SELECT COUNT(*) FROM dc_documents d WHERE d.dc_id=dc.id),0) AS doc_count
    FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
    WHERE 1=1`;
  const params: string[] = [];

  if (isClient) {
    if (user!.client_id) {
      query += " AND o.client_id=?"; params.push(user!.client_id);
    } else {
      const domain = user!.email.split("@")[1];
      const cl = await env.DB.prepare("SELECT id FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,string>|null;
      if (cl) { query += " AND o.client_id=?"; params.push(cl.id); }
    }
  } else if (user!.role === "delivery_exec") {
    // Delivery executives see only deliveries assigned to them
    query += " AND (LOWER(dc.driver_name)=LOWER(?) OR dc.staff_id IN (SELECT id FROM staff WHERE LOWER(name)=LOWER(?)))";
    params.push(user!.name, user!.name);
  }

  query += " ORDER BY dc.dispatched_at DESC";
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleBillDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // billing is 4SYZ-only
  const id = path.split("/").slice(-2)[0];
  const existing = await env.DB.prepare("SELECT billed FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!existing) return json({error:"Not found"}, 404);
  if (Number(existing.billed) === 1) return json({error:"Delivery challan already billed"}, 409); // idempotency
  await env.DB.prepare("UPDATE delivery_challans SET billed=1,billed_at=datetime('now') WHERE id=?").bind(id).run();
  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (dc?.order_id) {
    await env.DB.prepare("UPDATE orders SET status='CLOSED',closed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").bind(dc.order_id).run();
    // Gap 9: release any remaining reservations
    const {results:items} = await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(dc.order_id).all();
    for (const item of items as Record<string,unknown>[]) {
      await env.DB.prepare("UPDATE inventory SET reserved=MAX(0,reserved-?) WHERE sku=?").bind(item.qty, item.sku).run();
    }
  }
  await audit(env, user, "BILL", "delivery_challan", id);
  return json({id, billed:true});
}

// ── Over-delivery guard helpers ──────────────────────────────────────
// Net units still due on an order = Σ ordered − Σ delivered (across ALL DCs),
// never below zero. A value of 0 means the order is fully satisfied and nothing
// more may be dispatched, delivered or scheduled against it.
async function orderOutstanding(env: Env, orderId: string): Promise<number> {
  const ord = await env.DB.prepare("SELECT COALESCE(SUM(qty),0) q FROM order_items WHERE order_id=?").bind(orderId).first() as {q:number}|null;
  const del = await env.DB.prepare(
    "SELECT COALESCE(SUM(di.qty_delivered),0) q FROM dc_items di JOIN delivery_challans dc ON di.dc_id=dc.id WHERE dc.order_id=?"
  ).bind(orderId).first() as {q:number}|null;
  return Math.max(0, (ord?.q||0) - (del?.q||0));
}

// Units THIS challan can still legitimately deliver, each SKU capped by its
// order-wide outstanding balance. Zero means the DC is a phantom (everything it
// carries has already been delivered on other challans) and must never be
// dispatched — that path over-delivers and over-bills the client.
async function dcDispatchableQty(env: Env, dcId: string, orderId: string): Promise<number> {
  const {results: items} = await env.DB.prepare("SELECT sku, qty_ordered FROM dc_items WHERE dc_id=?").bind(dcId).all() as {results: Record<string,unknown>[]};
  let total = 0;
  for (const it of items) {
    const oi = await env.DB.prepare("SELECT COALESCE(SUM(qty),0) q FROM order_items WHERE order_id=? AND sku=?").bind(orderId, it.sku).first() as {q:number}|null;
    const del = await env.DB.prepare(
      "SELECT COALESCE(SUM(di.qty_delivered),0) q FROM dc_items di JOIN delivery_challans dc2 ON di.dc_id=dc2.id WHERE dc2.order_id=? AND di.sku=? AND di.dc_id!=?"
    ).bind(orderId, it.sku, dcId).first() as {q:number}|null;
    total += Math.max(0, Math.min(Number(it.qty_ordered)||0, (oi?.q||0) - (del?.q||0)));
  }
  return total;
}

// Close an order the moment its outstanding balance hits zero, so no stale
// SCHEDULED challan lingers as "dispatchable". Idempotent; records history once.
async function closeOrderIfSettled(env: Env, orderId: string, user: {sub:string;name:string}|null, note: string): Promise<boolean> {
  if (await orderOutstanding(env, orderId) > 0) return false;
  const cur = await env.DB.prepare("SELECT status FROM orders WHERE id=?").bind(orderId).first() as {status?:string}|null;
  if (!cur || cur.status === "CLOSED" || cur.status === "CANCELLED") return false;
  await env.DB.prepare("UPDATE orders SET status='CLOSED',closed_at=datetime('now'),updated_at=datetime('now') WHERE id=?").bind(orderId).run();
  await env.DB.prepare("INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)")
    .bind(uid(), orderId, cur.status||null, "CLOSED", user?.sub||"system", user?.name||"system", note).run().catch(()=>{});
  return true;
}

async function handleDeliverDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // delivery confirmation is 4SYZ-only
  const id = path.split("/").slice(-2)[0];

  const body = await request.json().catch(()=>({})) as {items?:{sku:string;qty_delivered:number}[]};
  const {results: dcItems} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=?").bind(id).all() as {results: Record<string,unknown>[]};
  const dc = await env.DB.prepare("SELECT * FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!dc) return json({error:"Not found"}, 404);
  // Idempotency: a DC already marked DELIVERED/CANCELLED must not re-deduct stock on replay/double-click.
  if (["DELIVERED","CANCELLED"].includes(String(dc.status))) return json({error:`Delivery challan already ${String(dc.status).toLowerCase()}`}, 409);

  // Order-wide caps: total ordered per sku and what's already delivered on OTHER DCs.
  // Cumulative delivered across all DCs must never exceed the ordered qty.
  const orderCap: Record<string, number> = {};
  const deliveredElsewhere: Record<string, number> = {};
  if (dc.order_id) {
    const {results: oItems} = await env.DB.prepare("SELECT sku, qty FROM order_items WHERE order_id=?").bind(dc.order_id).all() as {results: Record<string,unknown>[]};
    for (const oi of oItems) orderCap[oi.sku as string] = oi.qty as number;
    const {results: delRows} = await env.DB.prepare(
      "SELECT di.sku, COALESCE(SUM(di.qty_delivered),0) as del FROM dc_items di JOIN delivery_challans dc2 ON di.dc_id=dc2.id WHERE dc2.order_id=? AND di.dc_id!=? GROUP BY di.sku"
    ).bind(dc.order_id, id).all() as {results: Record<string,unknown>[]};
    for (const r of delRows) deliveredElsewhere[r.sku as string] = r.del as number;
  }

  // Merge per-item delivered qtys, clamped to min(dispatched, order remaining)
  const deliveries = dcItems.map(di => {
    const override = body.items?.find(i => i.sku === di.sku);
    const dispatched = di.qty_ordered as number;
    const cap = orderCap[di.sku as string] != null
      ? Math.max(0, orderCap[di.sku as string] - (deliveredElsewhere[di.sku as string] || 0))
      : dispatched;
    const requested = override !== undefined ? override.qty_delivered : dispatched;
    const qty_delivered = Math.max(0, Math.min(requested, dispatched, cap));
    // Outstanding for the whole order after this delivery (never negative)
    const order_remaining = orderCap[di.sku as string] != null
      ? Math.max(0, orderCap[di.sku as string] - (deliveredElsewhere[di.sku as string] || 0) - qty_delivered)
      : Math.max(0, dispatched - qty_delivered);
    return { sku: di.sku as string, name: di.name as string, qty_delivered, qty_dispatched: dispatched, order_remaining };
  });

  const totalDelivered = deliveries.reduce((s, i) => s + i.qty_delivered, 0);

  // Update dc_items and deduct stock for actually delivered quantities
  for (const item of deliveries) {
    await env.DB.prepare("UPDATE dc_items SET qty_delivered=? WHERE dc_id=? AND sku=?")
      .bind(item.qty_delivered, id, item.sku).run();
    if (item.qty_delivered > 0) {
      await env.DB.prepare("UPDATE inventory SET stock=MAX(0,stock-?), reserved=MAX(0,reserved-?) WHERE sku=?")
        .bind(item.qty_delivered, item.qty_delivered, item.sku).run();
      await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), item.sku, 'DELIVERY', -item.qty_delivered, id, 'delivery_challan', `Delivered via DC ${id}`, user!.name).run();
    }
  }

  // Mark this DC as delivered
  await env.DB.prepare("UPDATE delivery_challans SET status='DELIVERED',delivered_qty=?,delivered_at=datetime('now') WHERE id=?")
    .bind(totalDelivered, id).run();

  // Create follow-up DC only for items still OUTSTANDING against the order
  // (based on order remaining, so we never schedule more than was ordered).
  const shortItems = deliveries.filter(i => i.order_remaining > 0);
  if (shortItems.length > 0 && dc.order_id) {
    const newDCId = `DC-${Math.floor(Math.random()*9000+1000)}`;
    const remainingTotal = shortItems.reduce((s, i) => s + i.order_remaining, 0);
    await env.DB.prepare("INSERT INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,'SCHEDULED',?)")
      .bind(newDCId, dc.order_id, remainingTotal).run();
    for (const r of shortItems) {
      await env.DB.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,0)")
        .bind(uid(), newDCId, r.sku, r.name, r.order_remaining).run();
    }
    await pushNotification(env, "ops_admin", `DC ${id} partial delivery — follow-up DC ${newDCId} created for ${remainingTotal} units`);
  }

  // Check if order is fully delivered across ALL DCs (sum of qty_delivered >= order_items.qty for each SKU)
  let orderFullyClosed = false;
  if (dc.order_id) {
    const {results: orderItems} = await env.DB.prepare("SELECT sku, qty FROM order_items WHERE order_id=?").bind(dc.order_id).all() as {results: Record<string,unknown>[]};
    let allDelivered = true;
    for (const oi of orderItems) {
      const row = await env.DB.prepare(
        "SELECT COALESCE(SUM(di.qty_delivered),0) as total FROM dc_items di JOIN delivery_challans dc2 ON di.dc_id=dc2.id WHERE dc2.order_id=? AND di.sku=?"
      ).bind(dc.order_id, oi.sku).first() as Record<string,unknown>|null;
      if ((row?.total as number || 0) < (oi.qty as number)) { allDelivered = false; break; }
    }
    if (allDelivered) {
      await env.DB.prepare("UPDATE orders SET status='CLOSED',closed_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").bind(dc.order_id).run();
      await env.DB.prepare("INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)")
        .bind(uid(), dc.order_id, 'IN_SHIPMENT', 'CLOSED', user!.sub, user!.name, `Fully delivered — DC ${id}`).run();
      // Suppress any lingering SCHEDULED challan so it can never be dispatched again.
      await env.DB.prepare("UPDATE delivery_challans SET status='CANCELLED' WHERE order_id=? AND status='SCHEDULED'").bind(dc.order_id).run();
      orderFullyClosed = true;
    } else {
      await env.DB.prepare("UPDATE orders SET status='PARTIALLY_CLOSED',updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").bind(dc.order_id).run();
    }
  }

  // Auto-populate client store inventory with delivered items
  if (dc.order_id) {
    const order = await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(dc.order_id).first() as Record<string,string>|null;
    if (order?.client_id) {
      for (const item of deliveries) {
        if (item.qty_delivered > 0) {
          const inv = await env.DB.prepare("SELECT i.name, i.category, i.uom FROM inventory i WHERE i.sku=?").bind(item.sku).first() as Record<string,string>|null;
          const itemName = item.name || inv?.name || item.sku;
          await env.DB.prepare(`
            INSERT INTO client_inventory (client_id, sku, item_name, category, uom, qty_on_hand, last_received_qty, last_received_at, updated_at)
            VALUES (?,?,?,?,?,?,?,datetime('now'),datetime('now'))
            ON CONFLICT(client_id, sku) DO UPDATE SET
              qty_on_hand = qty_on_hand + excluded.qty_on_hand,
              last_received_qty = excluded.last_received_qty,
              last_received_at = excluded.last_received_at,
              item_name = COALESCE(NULLIF(excluded.item_name,''), client_inventory.item_name),
              updated_at = datetime('now')
          `).bind(order.client_id, item.sku, itemName, inv?.category||'', inv?.uom||'unit', item.qty_delivered, item.qty_delivered).run().catch(()=>{});
        }
      }
    }
  }

  await pushNotification(env, "client_admin", `Delivery ${id} confirmed — ${totalDelivered} units`);
  await audit(env, user, "DELIVER", "delivery_challan", id);
  return json({id, status:"DELIVERED", delivered: totalDelivered, order_closed: orderFullyClosed, partial: shortItems.length > 0});
}

// Gap 14: Partial delivery
async function handlePartialDelivery(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // delivery confirmation is 4SYZ-only
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {delivered_qty:number;total_qty:number;notes?:string;items?:{sku:string;qty_delivered:number}[]};
  const {delivered_qty, total_qty, notes} = body;

  if (!delivered_qty || delivered_qty >= total_qty) {
    return json({error:"delivered_qty must be less than total_qty"}, 400);
  }

  const dc = await env.DB.prepare("SELECT order_id,status FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (!dc) return json({error:"Not found"}, 404);
  // Idempotency: never re-deduct stock against an already-settled challan.
  if (["DELIVERED","CANCELLED"].includes(String(dc.status))) return json({error:`Delivery challan already ${String(dc.status).toLowerCase()}`}, 409);
  const {results: dcItems} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=?").bind(id).all() as {results: Record<string,unknown>[]};

  // Update this DC's delivered qty
  await env.DB.prepare("UPDATE delivery_challans SET status='DELIVERED',delivered_qty=?,total_qty=?,delivered_at=datetime('now') WHERE id=?")
    .bind(delivered_qty, total_qty, id).run();

  // Proportionally deduct stock for delivered items
  const ratio = delivered_qty / total_qty;
  for (const item of dcItems) {
    const deliveredNow = Math.floor((item.qty_ordered as number) * ratio);
    const pendingQty = (item.qty_ordered as number) - deliveredNow;
    await env.DB.prepare("UPDATE dc_items SET qty_delivered=? WHERE dc_id=? AND sku=?").bind(deliveredNow, id, item.sku).run();
    if (deliveredNow > 0) {
      await env.DB.prepare("UPDATE inventory SET stock=MAX(0,stock-?), reserved=MAX(0,reserved-?) WHERE sku=?")
        .bind(deliveredNow, deliveredNow, item.sku).run();
      await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), item.sku as string, 'DELIVERY', -deliveredNow, id, 'delivery_challan', `Partial delivery via DC ${id}`, user!.name).run();
    }
  }

  // Create new DC for remaining
  if (dc?.order_id) {
    await env.DB.prepare("UPDATE orders SET status='PARTIALLY_CLOSED',updated_at=datetime('now') WHERE id=? AND status='IN_SHIPMENT'").bind(dc.order_id).run();
    const remaining = total_qty - delivered_qty;
    const newDCId = `DC-${Math.floor(Math.random()*9000+1000)}`;
    await env.DB.prepare("INSERT INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,'SCHEDULED',?)").bind(newDCId, dc.order_id, remaining).run();
    // Create dc_items for the new DC with remaining qtys
    for (const item of dcItems) {
      const pendingQty = (item.qty_ordered as number) - Math.floor((item.qty_ordered as number) * ratio);
      if (pendingQty > 0) {
        await env.DB.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,0)")
          .bind(uid(), newDCId, item.sku, item.name, pendingQty).run();
      }
    }
    await pushNotification(env, "ops_admin", `Partial delivery for DC ${id} — ${remaining} units pending. New DC ${newDCId} created.`);
  }

  await audit(env, user, "PARTIAL_DELIVERY", "delivery_challan", id, undefined, `delivered:${delivered_qty}/${total_qty}`);
  return json({id, delivered_qty, total_qty});
}

async function handleDispatchDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // dispatch is 4SYZ-only
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {vehicle_no?:string;driver_name?:string;driver_phone?:string;expected_delivery_date?:string};

  const dc = await env.DB.prepare("SELECT order_id, status FROM delivery_challans WHERE id=?").bind(id).first() as {order_id?:string;status?:string}|null;
  if (!dc) return json({error:"Delivery challan not found"}, 404);
  if (dc.status === "IN_TRANSIT" || dc.status === "DELIVERED") {
    return json({error:`Challan already ${dc.status.toLowerCase().replace('_',' ')}`, code:"ALREADY_DISPATCHED"}, 409);
  }
  // Over-delivery guard: never dispatch a challan whose contents are already fully
  // delivered against the order. Such a phantom is cancelled and the order is
  // closed if its balance is settled — dispatching it would over-deliver/over-bill.
  if (dc.order_id) {
    const dispatchable = await dcDispatchableQty(env, id, dc.order_id);
    if (dispatchable <= 0) {
      await env.DB.prepare("UPDATE delivery_challans SET status='CANCELLED' WHERE id=? AND status IN ('SCHEDULED','READY')").bind(id).run();
      const closed = await closeOrderIfSettled(env, dc.order_id, user, `Order fully delivered — phantom challan ${id} cancelled on dispatch`);
      await audit(env, user, "DISPATCH_BLOCKED", "delivery_challan", id, undefined, "nothing outstanding — challan cancelled");
      return json({
        error: "Order fully delivered — nothing left to dispatch. This challan has been cancelled.",
        code: "OVER_DELIVERY", outstanding: 0, dc_cancelled: true, order_closed: closed,
      }, 409);
    }
  }

  await env.DB.prepare("UPDATE delivery_challans SET status='IN_TRANSIT',vehicle_no=?,driver_name=?,driver_phone=?,dispatched_at=datetime('now'),expected_delivery_date=? WHERE id=?")
    .bind(body.vehicle_no||null, body.driver_name||null, body.driver_phone||null, body.expected_delivery_date||null, id).run();
  if (dc.order_id) {
    await env.DB.prepare("UPDATE orders SET status='IN_SHIPMENT',updated_at=datetime('now') WHERE id=? AND status IN ('READY_TO_PICK','PARTIALLY_CLOSED')")
      .bind(dc.order_id).run();
  }
  await pushNotification(env, "client_admin", `DC ${id} dispatched — vehicle ${body.vehicle_no||'TBD'}`);
  await audit(env, user, "DISPATCH", "delivery_challan", id, undefined, JSON.stringify({vehicle:body.vehicle_no,driver:body.driver_name}));
  return json({id, status:"IN_TRANSIT"});
}

async function handleListDCItems(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const scoped = await dcScopeDenied(env, user!, id); if (scoped) return scoped;
  const {results} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=? ORDER BY name").bind(id).all() as {results: Record<string,unknown>[]};

  // Enrich each item with the order-wide remaining balance so the UI can cap
  // deliverable qty to what's still outstanding across ALL DCs, never > ordered.
  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as {order_id?:string}|null;
  if (dc?.order_id) {
    for (const it of results) {
      const oi = await env.DB.prepare("SELECT qty FROM order_items WHERE order_id=? AND sku=?").bind(dc.order_id, it.sku).first() as {qty:number}|null;
      const del = await env.DB.prepare(
        "SELECT COALESCE(SUM(di.qty_delivered),0) as del FROM dc_items di JOIN delivery_challans dc2 ON di.dc_id=dc2.id WHERE dc2.order_id=? AND di.sku=? AND di.dc_id!=?"
      ).bind(dc.order_id, it.sku, id).first() as {del:number}|null;
      const ordered = oi?.qty ?? (it.qty_ordered as number);
      const deliveredElsewhere = del?.del || 0;
      it.order_ordered_qty = ordered;
      it.delivered_elsewhere = deliveredElsewhere;
      // Max that may be delivered on THIS dc = min(dispatched, order remaining)
      it.order_remaining = Math.max(0, Math.min(it.qty_ordered as number, ordered - deliveredElsewhere));
    }
  }
  return json(results);
}

async function handleListStockMovements(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");
  const type = url.searchParams.get("type");
  let query = "SELECT sm.*, i.name as item_name FROM stock_movements sm LEFT JOIN inventory i ON sm.sku=i.sku WHERE 1=1";
  const params: string[] = [];
  if (sku)  { query += " AND sm.sku=?";  params.push(sku); }
  if (type) { query += " AND sm.type=?"; params.push(type); }
  query += " ORDER BY sm.created_at DESC LIMIT 100";
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════
// NEW BIN-LOCATION HANDLERS
// ════════════════════════════════════════════════════════════════════

async function handleAddBin(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as {warehouse_id:string;code:string;zone?:string;capacity?:number;sku?:string};
  if (!body.warehouse_id || !body.code) return json({error:"warehouse_id and code required"}, 400);
  const id = `bin${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO bin_locations (id,warehouse_id,code,zone,sku,capacity,occupied) VALUES (?,?,?,?,?,?,0)")
    .bind(id, body.warehouse_id, body.code, body.zone||null, body.sku||null, body.capacity||100).run();
  await audit(env, user, "CREATE", "bin_location", id, undefined, `${body.code} in ${body.warehouse_id}`);
  return json({id}, 201);
}

async function handlePatchBin(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as {sku?:string|null;capacity?:number;zone?:string;occupied?:number};
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.sku !== undefined)      { fields.push("sku=?");      vals.push(body.sku||null); }
  if (body.capacity !== undefined) { fields.push("capacity=?"); vals.push(body.capacity); }
  if (body.zone !== undefined)     { fields.push("zone=?");     vals.push(body.zone||null); }
  if (body.occupied !== undefined) { fields.push("occupied=?"); vals.push(body.occupied); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE bin_locations SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  await audit(env, user, "UPDATE", "bin_location", id, undefined, JSON.stringify(body));
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// NEW DELIVERY-CHALLAN HANDLERS (POD, Scan, Return)
// ════════════════════════════════════════════════════════════════════

async function handleMarkPOD(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // POD is captured by delivery staff
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET pod_uploaded=1 WHERE id=?").bind(id).run();
  await audit(env, user, "POD_UPLOAD", "delivery_challan", id);
  return json({id, pod_uploaded:true});
}

async function handleMarkScan(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // DC scan is captured by delivery staff
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET dc_scan_uploaded=1 WHERE id=?").bind(id).run();
  await audit(env, user, "DC_SCAN_UPLOAD", "delivery_challan", id);
  return json({id, dc_scan_uploaded:true});
}

async function handleUploadDCDoc(request: Request, env: Env, path: string, docType: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/")[3];
  const body = await request.json() as { filename?: string; mime_type?: string; content_b64: string; file_size?: number; barcode?: string };
  if (!body.content_b64) return json({ error: "content_b64 required" }, 400);
  if (body.file_size && body.file_size > 5 * 1024 * 1024) return json({ error: "File too large (max 5 MB)" }, 400);

  try {
    const storedContent = await docPut(env, `dc/${id}`, body.content_b64);
    await env.DB.prepare(
      `INSERT INTO dc_documents (dc_id, doc_type, filename, mime_type, content_b64, file_size, uploaded_by)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(id, docType, body.filename||null, body.mime_type||null, storedContent, body.file_size||null, user?.name||null).run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("no such table")) {
      return json({ error: "Database migration pending — run: wrangler d1 migrations apply smart-pantry-db --remote" }, 503);
    }
    return json({ error: "Failed to store document: " + msg }, 500);
  }

  // scanning the POD document satisfies both flags — it's the same physical document
  const updateSql = docType === "scan"
    ? "UPDATE delivery_challans SET dc_scan_uploaded=1, pod_uploaded=1 WHERE id=?"
    : "UPDATE delivery_challans SET pod_uploaded=1 WHERE id=?";
  await env.DB.prepare(updateSql).bind(id).run();
  // Optional scanned DC barcode (feature-flagged in the UI) — record when sent.
  const bc = String(body.barcode || "").trim();
  if (bc) { try { await env.DB.prepare("UPDATE delivery_challans SET scan_barcode=? WHERE id=?").bind(bc, id).run(); } catch { /* column not yet migrated */ } }
  await audit(env, user, docType === "pod" ? "POD_UPLOAD" : "DC_SCAN_UPLOAD", "delivery_challan", id, undefined, body.filename||"file");
  return json({ id, doc_type: docType, uploaded: true });
}

async function handleListDCDocs(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/")[3];
  const scoped = await dcScopeDenied(env, user!, id); if (scoped) return scoped;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, dc_id, doc_type, filename, mime_type, content_b64, file_size, uploaded_at, uploaded_by
       FROM dc_documents WHERE dc_id=? ORDER BY uploaded_at DESC`
    ).bind(id).all();
    for (const r of (results || []) as Array<Record<string, unknown>>) r.content_b64 = await docGet(env, r.content_b64 as string | null);
    return json(results);
  } catch {
    return json([]); // table not yet created — return empty list gracefully
  }
}

async function handleReturnDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const scoped = await dcScopeDenied(env, user!, id); if (scoped) return scoped; // clients may only return their own deliveries
  const body = await request.json() as {reason?:string; items?:{sku:string;name?:string;qty:number}[]};

  const dc = await env.DB.prepare("SELECT * FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!dc) return json({error:"DC not found"}, 404);

  const {results: dcItems} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=?").bind(id).all() as {results: Record<string,unknown>[]};

  // Per-item return quantities: use provided items, clamp to dispatched qty; default full qty
  const returnItems = (body.items?.length
    ? body.items
    : dcItems.map(di => ({ sku: di.sku as string, name: di.name as string, qty: (di.qty_delivered as number) || (di.qty_ordered as number) }))
  ).map(ri => {
    const di = dcItems.find(d => d.sku === ri.sku);
    const maxQty = di ? ((di.qty_delivered as number) || (di.qty_ordered as number)) : 0;
    return { sku: ri.sku, name: ri.name || (di?.name as string) || ri.sku, qty: Math.max(0, Math.min(ri.qty, maxQty)) };
  }).filter(ri => ri.qty > 0);

  if (!returnItems.length) return json({error:"No return quantities specified"}, 400);

  // Create a PENDING return — stock is restored only after warehouse approval
  const retId = `RET-${uid().slice(0,6).toUpperCase()}`;
  const ord = dc.order_id ? await env.DB.prepare("SELECT client_id FROM orders WHERE id=?").bind(dc.order_id as string).first() as {client_id:string}|null : null;
  await env.DB.prepare(`INSERT INTO returns (id,dc_id,order_id,client_id,reason,items,prev_dc_status,status,created_by,created_by_name)
    VALUES (?,?,?,?,?,?,?,'PENDING',?,?)`)
    .bind(retId, id, dc.order_id||null, ord?.client_id||null, body.reason||null,
      JSON.stringify(returnItems), dc.status as string, user!.sub, user!.name).run();

  await env.DB.prepare("UPDATE delivery_challans SET status='RETURN_PENDING' WHERE id=?").bind(id).run();

  await pushNotification(env, "warehouse_exec", `Return ${retId} for DC ${id} awaiting warehouse check — ${returnItems.length} item(s)`);
  await pushNotification(env, "ops_admin", `Return ${retId} logged for DC ${id} by ${user!.name}`);
  await audit(env, user, "RETURN_REQUEST", "delivery_challan", id, dc.status as string, "RETURN_PENDING");
  return json({id: retId, dc_id: id, status:'PENDING'}, 201);
}

async function handleListReturns(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  try {
    const {results} = await env.DB.prepare(`SELECT r.*, c.name as client_name
      FROM returns r LEFT JOIN clients c ON r.client_id=c.id
      ORDER BY CASE r.status WHEN 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100`).all();
    return json((results as Record<string,unknown>[]).map(r => ({...r, items: JSON.parse((r.items as string)||'[]')})));
  } catch { return json([]); }
}

async function handleReviewReturn(request: Request, env: Env, path: string, verdict: "APPROVED"|"REJECTED"): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec"].includes(user!.role)) return json({error:"Only warehouse/ops can review returns"}, 403);
  const retId = path.split("/")[3];
  const body = await request.json().catch(()=>({})) as {note?:string};

  const ret = await env.DB.prepare("SELECT * FROM returns WHERE id=?").bind(retId).first() as Record<string,unknown>|null;
  if (!ret) return json({error:"Return not found"}, 404);
  if (ret.status !== "PENDING") return json({error:"Return already reviewed"}, 400);

  const items = JSON.parse((ret.items as string)||'[]') as {sku:string;name:string;qty:number}[];

  if (verdict === "APPROVED") {
    // Restock checked quantities and record movements
    for (const item of items) {
      await env.DB.prepare("UPDATE inventory SET stock=stock+?,reserved=MAX(0,reserved-?) WHERE sku=?")
        .bind(item.qty, item.qty, item.sku).run();
      await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), item.sku, 'RETURN', item.qty, ret.dc_id as string, 'return',
          `Return ${retId} approved${ret.reason ? ': ' + ret.reason : ''}`, user!.name).run();
    }
    await env.DB.prepare("UPDATE delivery_challans SET status='CANCELLED' WHERE id=?").bind(ret.dc_id as string).run();
    if (ret.order_id) {
      await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,NULL,'RETURN_APPROVED',?,?,?)`)
        .bind(uid(), ret.order_id as string, user!.sub, user!.name, `Return ${retId} approved — ${items.length} item(s) restocked`).run();
    }
  } else {
    // Rejected — DC goes back to its previous status, no restock
    await env.DB.prepare("UPDATE delivery_challans SET status=? WHERE id=?").bind((ret.prev_dc_status as string)||'DELIVERED', ret.dc_id as string).run();
  }

  await env.DB.prepare("UPDATE returns SET status=?, reviewed_by=?, reviewed_at=datetime('now'), review_note=? WHERE id=?")
    .bind(verdict, user!.name, body.note||null, retId).run();
  await pushNotification(env, "ops_admin", `Return ${retId} ${verdict.toLowerCase()} by ${user!.name}${verdict==='APPROVED'?' — stock restored':''}`);
  await audit(env, user, `RETURN_${verdict}`, "return", retId, "PENDING", verdict);
  return json({id: retId, status: verdict});
}

// ════════════════════════════════════════════════════════════════════
// PICK LIST
// ════════════════════════════════════════════════════════════════════

async function handlePickList(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT o.id as order_id, c.name as client_name, o.status, o.created_at,
      o.picker_name, o.picked_at,
      oi.sku, oi.name as item_name, oi.qty,
      COALESCE(i.stock,0) as stock_available,
      oa.bin_code
    FROM orders o JOIN clients c ON o.client_id=c.id
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN order_allocations oa ON oa.order_id=o.id AND oa.sku=oi.sku
    WHERE o.status IN ('ACKNOWLEDGED','READY_TO_PICK','PICKED','QUALITY_CHECK')
    ORDER BY o.created_at ASC
  `).all();
  return json(results);
}

// GET /api/orders/items-summary — all active order line-items with stock & vendor context
async function handleOrderItemsSummary(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const url = new URL(request.url);
  const month = url.searchParams.get("month"); // YYYY-MM

  let where = `o.status NOT IN ('CLOSED','CANCELLED')`;
  const params: string[] = [];
  if (month) { where += ` AND strftime('%Y-%m', o.created_at) = ?`; params.push(month); }

  // Scope to client if client role
  if (["client_admin","client_approver","client_user"].includes(user!.role) && user!.client_id) {
    where += ` AND o.client_id = ?`; params.push(user!.client_id);
  }

  const { results } = await env.DB.prepare(`
    SELECT
      o.id            AS order_id,
      o.status        AS order_status,
      strftime('%Y-%m', o.created_at) AS order_month,
      o.created_at,
      c.name          AS client_name,
      oi.sku,
      oi.name         AS item_name,
      oi.qty          AS ordered_qty,
      oi.unit_price,
      COALESCE(oi.brand, i.brand, i.category, '') AS brand,
      COALESCE(i.stock, 0)         AS stock,
      COALESCE(i.reorder_level, 0) AS reorder_level,
      COALESCE(i.vendor_id, '')    AS vendor_id,
      COALESCE(v.name, 'Unknown Vendor') AS vendor_name
    FROM orders o
    JOIN clients c ON o.client_id = c.id
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN inventory i ON i.sku = oi.sku
    LEFT JOIN vendors v ON v.id = i.vendor_id
    WHERE ${where}
    ORDER BY brand, oi.name
  `).bind(...params).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════
// STOCK TRANSFERS
// ════════════════════════════════════════════════════════════════════

async function handleStockTransfer(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as {sku:string;from_bin_id:string;to_bin_id:string;qty:number;note?:string};
  if (!body.sku || !body.from_bin_id || !body.to_bin_id || !body.qty) {
    return json({error:"sku, from_bin_id, to_bin_id, and qty are required"}, 400);
  }

  const fromBin = await env.DB.prepare("SELECT * FROM bin_locations WHERE id=?").bind(body.from_bin_id).first() as Record<string,number>|null;
  if (!fromBin) return json({error:"Source bin not found"}, 404);
  if ((fromBin.occupied||0) < body.qty) return json({error:"Insufficient stock in source bin"}, 400);

  // Deduct from source bin
  await env.DB.prepare("UPDATE bin_locations SET occupied=MAX(0,occupied-?) WHERE id=?").bind(body.qty, body.from_bin_id).run();
  // Add to destination bin
  await env.DB.prepare("UPDATE bin_locations SET occupied=occupied+? WHERE id=?").bind(body.qty, body.to_bin_id).run();

  // Record movement
  const movId = uid();
  await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
    .bind(movId, body.sku, 'TRANSFER', body.qty, body.from_bin_id, 'bin_location',
      body.note || `Transfer from bin ${body.from_bin_id} to ${body.to_bin_id}`, user!.name).run();

  await audit(env, user, "STOCK_TRANSFER", "bin_location", body.from_bin_id, undefined,
    `sku:${body.sku},qty:${body.qty},to:${body.to_bin_id}`);
  return json({id: movId, sku: body.sku, qty: body.qty}, 201);
}

// ════════════════════════════════════════════════════════════════════
// CLIENTS
// ════════════════════════════════════════════════════════════════════

async function handleListClients(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // spent_this_month computed live from orders — the stored column is stale seed data
  const {results} = await env.DB.prepare(`
    SELECT c.*,
      COALESCE((SELECT SUM(o.grand_total) FROM orders o
        WHERE o.client_id=c.id AND o.status NOT IN ('CANCELLED','DRAFT')
        AND strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now')),0) AS spent_this_month
    FROM clients c WHERE c.active=1 ORDER BY c.name`).all();
  return json(results);
}

async function handleAddClient(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const { gstin, pan, error: taxErr } = resolveTaxIds(body.gstin, body.pan);
  if (taxErr) return json({ error: taxErr }, 400);
  const id = `c${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO clients (id,name,contact_email,contact_name,monthly_budget,approval_threshold,zone,contact_phone,map_pin,address,gstin,pan) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,body.name,body.contact_email||null,body.contact_name||null,body.monthly_budget||500000,body.approval_threshold||100000,body.zone||'',body.contact_phone||'',body.map_pin||'',body.address||'',gstin,pan).run();
  await audit(env, user, "CREATE", "client", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handleClientBudget(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const cs = clientScopeDenied(user!, id); if (cs) return cs;
  const client = await env.DB.prepare(`
    SELECT monthly_budget, approval_threshold,
      COALESCE((SELECT SUM(o.grand_total) FROM orders o
        WHERE o.client_id=clients.id AND o.status NOT IN ('CANCELLED','DRAFT')
        AND strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now')),0) AS spent_this_month
    FROM clients WHERE id=?`).bind(id).first() as Record<string,number>|null;
  if (!client) return json({error:"Client not found"}, 404);
  return json({ monthly_budget: client.monthly_budget, used: client.spent_this_month, approval_threshold: client.approval_threshold });
}

async function handlePatchClient(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // client master data (budget/credit) is 4SYZ-only
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.name               !== undefined) { fields.push("name=?");               vals.push(body.name||''); }
  if (body.contact_name       !== undefined) { fields.push("contact_name=?");       vals.push(body.contact_name||''); }
  if (body.contact_email      !== undefined) { fields.push("contact_email=?");      vals.push(body.contact_email||''); }
  if (body.monthly_budget     !== undefined) { fields.push("monthly_budget=?");     vals.push(body.monthly_budget); }
  if (body.approval_threshold !== undefined) { fields.push("approval_threshold=?"); vals.push(body.approval_threshold); }
  if (body.health_score       !== undefined) { fields.push("health_score=?");       vals.push(body.health_score); }
  if (body.zone               !== undefined) { fields.push("zone=?");               vals.push(body.zone||''); }
  if (body.contact_phone      !== undefined) { fields.push("contact_phone=?");      vals.push(body.contact_phone||''); }
  if (body.map_pin            !== undefined) { fields.push("map_pin=?");            vals.push(body.map_pin||''); }
  if (body.address            !== undefined) { fields.push("address=?");            vals.push(body.address||''); }
  if (body.gstin !== undefined || body.pan !== undefined) {
    const { gstin, pan, error: taxErr } = resolveTaxIds(body.gstin, body.pan);
    if (taxErr) return json({ error: taxErr }, 400);
    fields.push("gstin=?"); vals.push(gstin);
    fields.push("pan=?");   vals.push(pan);
  }
  if (body.active             !== undefined) { fields.push("active=?");             vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE clients SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  // Keep the denormalised org name on this client's users in sync with the rename.
  if (body.name !== undefined) {
    await env.DB.prepare("UPDATE users SET org=? WHERE client_id=?").bind(body.name||'', id).run();
  }
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// CLIENT CATALOG (per-client product assignments)
// ════════════════════════════════════════════════════════════════════

async function handleGetClientCatalog(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const clientId = path.split("/")[3];
  const cs = clientScopeDenied(user!, clientId); if (cs) return cs;
  let results: unknown[];
  try {
    ({results} = await env.DB.prepare(
      `SELECT i.*,v.name as vendor_name,cc.added_at,
              cc.client_price,
              COALESCE(cc.client_price, i.unit_price) AS effective_price
       FROM client_catalog cc
       JOIN inventory i ON cc.sku=i.sku
       LEFT JOIN vendors v ON i.vendor_id=v.id
       WHERE cc.client_id=? AND i.active=1
       ORDER BY i.name`
    ).bind(clientId).all());
  } catch {
    // client_price column not yet migrated — fall back to query without it
    ({results} = await env.DB.prepare(
      `SELECT i.*,v.name as vendor_name,cc.added_at,
              i.unit_price AS effective_price
       FROM client_catalog cc
       JOIN inventory i ON cc.sku=i.sku
       LEFT JOIN vendors v ON i.vendor_id=v.id
       WHERE cc.client_id=? AND i.active=1
       ORDER BY i.name`
    ).bind(clientId).all());
  }
  return json(results);
}

async function handlePatchClientCatalogItem(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const parts = path.split("/");
  const clientId = parts[3];
  const sku = parts[5];
  const body = await request.json() as { client_price?: number | null };
  await env.DB.prepare("UPDATE client_catalog SET client_price=? WHERE client_id=? AND sku=?")
    .bind(body.client_price ?? null, clientId, sku).run();
  await audit(env, user, "UPDATE", "client_catalog", clientId, sku, `client_price:${body.client_price}`);
  return json({ok: true, client_price: body.client_price ?? null});
}

async function handleAddClientCatalogItems(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const clientId = path.split("/")[3];
  const body = await request.json() as { skus?: string[]; items?: Array<{sku:string; client_price?:number|null}> };
  // Accept either a plain list of SKUs (add at global price) or items carrying a
  // per-client price (used by the CSV import, which lets Ops set client pricing).
  let entries: Array<{sku:string; client_price:number|null}>;
  if (Array.isArray(body.items) && body.items.length) {
    entries = body.items
      .filter(i => i && i.sku)
      .map(i => {
        const p = i.client_price;
        const price = (p == null || p === undefined || isNaN(Number(p)) || Number(p) < 0) ? null : Number(p);
        return { sku: String(i.sku), client_price: price };
      });
  } else if (Array.isArray(body.skus) && body.skus.length) {
    entries = body.skus.map(sku => ({ sku, client_price: null }));
  } else {
    return json({error:"skus or items array required"}, 400);
  }
  if (!entries.length) return json({error:"no valid items"}, 400);

  await env.DB.batch(entries.map(e =>
    env.DB.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
      .bind(clientId, e.sku, user!.sub)
  ));
  // Apply any per-item client prices (best-effort — ignore if column not migrated).
  const priced = entries.filter(e => e.client_price != null);
  if (priced.length) {
    try {
      await env.DB.batch(priced.map(e =>
        env.DB.prepare("UPDATE client_catalog SET client_price=? WHERE client_id=? AND sku=?")
          .bind(e.client_price, clientId, e.sku)
      ));
    } catch { /* client_price column not yet migrated */ }
  }
  await audit(env, user, "UPDATE", "client_catalog", clientId, undefined, `added ${entries.length} items (${priced.length} priced)`);
  return json({added: entries.length, priced: priced.length});
}

async function handleRemoveClientCatalogItem(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const parts = path.split("/");
  const clientId = parts[3];
  const sku = parts[5];
  await env.DB.prepare("DELETE FROM client_catalog WHERE client_id=? AND sku=?").bind(clientId, sku).run();
  await audit(env, user, "UPDATE", "client_catalog", clientId, sku, "removed");
  return json({removed: sku});
}

// ════════════════════════════════════════════════════════════════════
// TICKETS
// ════════════════════════════════════════════════════════════════════

async function handleListTickets(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  let where = "";
  const binds: string[] = [];
  if (["client_admin","client_approver","client_user"].includes(user!.role)) {
    // Clients see only their own client's tickets
    if (user!.client_id) { where = "WHERE t.client_id=?"; binds.push(user!.client_id); }
    else {
      const domain = user!.email.split("@")[1];
      where = "WHERE t.client_id IN (SELECT id FROM clients WHERE contact_email LIKE ?)";
      binds.push(`%${domain}%`);
    }
  } else if (["vendor_admin","vendor_user"].includes(user!.role)) {
    // Vendors see only tickets they raised themselves
    where = "WHERE t.raised_by=?"; binds.push(user!.sub);
  }
  // Platform roles (super_admin, ops, finance, delivery…) see all tickets

  const {results} = await env.DB.prepare(`SELECT t.*,c.name as client_name,u.name as raiser_name
    FROM tickets t LEFT JOIN clients c ON t.client_id=c.id LEFT JOIN users u ON t.raised_by=u.id
    ${where} ORDER BY t.created_at DESC`).bind(...binds).all();
  return json(results);
}

async function handleCreateTicket(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,string>;
  const id = `TKT-${String(Math.floor(Math.random()*900+100)).padStart(3,"0")}`;
  let clientId = body.client_id;
  const isClientRole = ["client_admin","client_approver","client_user"].includes(user!.role);
  if (isClientRole) clientId = user!.client_id || clientId; // clients always file under their own client
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

// Shared ownership check: may this user access this ticket?
async function canAccessTicket(env: Env, user: JWTPayload, ticketId: string): Promise<boolean> {
  if (["client_admin","client_approver","client_user"].includes(user.role)) {
    const t = await env.DB.prepare("SELECT client_id,raised_by FROM tickets WHERE id=?").bind(ticketId).first() as {client_id:string;raised_by:string}|null;
    if (!t) return false;
    return user.client_id ? t.client_id === user.client_id : t.raised_by === user.sub;
  }
  if (["vendor_admin","vendor_user"].includes(user.role)) {
    const t = await env.DB.prepare("SELECT raised_by FROM tickets WHERE id=?").bind(ticketId).first() as {raised_by:string}|null;
    return !!t && t.raised_by === user.sub;
  }
  return true; // platform roles
}

async function handleListTicketComments(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const ticketId = path.split("/")[3];
  if (!await canAccessTicket(env, user!, ticketId)) return json({error:"Forbidden"}, 403);
  try {
    const {results} = await env.DB.prepare("SELECT * FROM ticket_comments WHERE ticket_id=? ORDER BY created_at ASC").bind(ticketId).all();
    return json(results);
  } catch { return json([]); }
}

async function handleAddTicketComment(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const ticketId = path.split("/")[3];
  if (!await canAccessTicket(env, user!, ticketId)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as {message?:string};
  const message = (body.message||"").trim();
  if (!message) return json({error:"Message required"}, 400);
  if (message.length > 2000) return json({error:"Message too long"}, 400);

  const cid = uid();
  await env.DB.prepare("INSERT INTO ticket_comments (id,ticket_id,author_id,author_name,author_role,message) VALUES (?,?,?,?,?,?)")
    .bind(cid, ticketId, user!.sub, user!.name, user!.role, message).run();

  // Notify the other party
  const isRaiserSide = ["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(user!.role);
  if (isRaiserSide) await pushNotification(env, "ops_admin", `New comment on ticket ${ticketId} from ${user!.name}`);

  const row = await env.DB.prepare("SELECT * FROM ticket_comments WHERE id=?").bind(cid).first();
  return json(row, 201);
}

async function handlePatchTicket(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;

  const body = await request.json() as {status?:string;priority?:string};

  // Ticket workflow belongs to the ops team. Controlled exception for raisers
  // (clients/vendors): on their OWN ticket in RESOLVED state they may either
  // confirm resolution (→ CLOSED) or reopen it (→ OPEN). Nothing else.
  const isRaiserRole = ["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(user!.role);
  if (isRaiserRole) {
    const t = await env.DB.prepare("SELECT client_id,raised_by,status FROM tickets WHERE id=?").bind(id).first() as {client_id:string;raised_by:string;status:string}|null;
    if (!t) return json({error:"Ticket not found"}, 404);
    const ownsTicket = ["vendor_admin","vendor_user"].includes(user!.role)
      ? t.raised_by === user!.sub
      : (user!.client_id ? t.client_id === user!.client_id : t.raised_by === user!.sub);
    if (!ownsTicket) return json({error:"Forbidden"}, 403);
    if (t.status !== "RESOLVED" || body.priority || !["CLOSED","OPEN"].includes(body.status||"")) {
      return json({error:"You can only confirm or reopen a resolved ticket"}, 403);
    }
    if (body.status === "OPEN") {
      await env.DB.prepare("UPDATE tickets SET status='OPEN', resolved_at=NULL WHERE id=?").bind(id).run();
      await pushNotification(env, "ops_admin", `Ticket ${id} was REOPENED by ${user!.name} — resolution disputed`);
    } else {
      await env.DB.prepare("UPDATE tickets SET status='CLOSED' WHERE id=?").bind(id).run();
    }
    await audit(env, user, "UPDATE", "ticket", id, undefined, `raiser:${body.status}`);
    return json({id, status: body.status});
  }
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
  const {results} = await env.DB.prepare("SELECT id,email,role,name,org,initials,active,created_at,client_id FROM users ORDER BY name").all();
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

  // Org rules: client roles → onboarded client; vendor roles → existing vendor; platform roles → fixed "4SYZ Platform"
  const isClientRole = ["client_admin","client_approver","client_user"].includes(body.role);
  const isVendorRole = ["vendor_admin","vendor_user"].includes(body.role);
  let clientId: string | null = null;
  let org = "4SYZ Platform";
  if (isClientRole) {
    if (!body.client_id) return json({error:"Select a client — client users must belong to an onboarded client"}, 400);
    const client = await env.DB.prepare("SELECT id,name FROM clients WHERE id=? AND active=1").bind(body.client_id).first() as {id:string;name:string}|null;
    if (!client) return json({error:"Client not found or inactive"}, 400);
    clientId = client.id;
    org = client.name;
  } else if (isVendorRole) {
    if (!body.vendor_id) return json({error:"Select a vendor — vendor users must belong to an existing vendor"}, 400);
    const vendor = await env.DB.prepare("SELECT id,name FROM vendors WHERE id=?").bind(body.vendor_id).first() as {id:string;name:string}|null;
    if (!vendor) return json({error:"Vendor not found"}, 400);
    org = vendor.name;
  }

  await env.DB.prepare("INSERT INTO users (id,email,password_hash,role,name,org,initials,client_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,body.email,ph,body.role,body.name,org,initials,clientId).run();
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
  const body = await request.json() as {active?:number;role?:string;password?:string;name?:string;email?:string;org?:string;client_id?:string;vendor_id?:string};
  const updates: string[] = [];
  const vals: unknown[] = [];
  if (body.active !== undefined) { updates.push("active=?"); vals.push(body.active); }
  if (body.role)     { updates.push("role=?");          vals.push(body.role); }
  if (body.client_id !== undefined) {
    if (body.client_id) {
      const client = await env.DB.prepare("SELECT id,name FROM clients WHERE id=? AND active=1").bind(body.client_id).first() as {id:string;name:string}|null;
      if (!client) return json({error:"Client not found or inactive"}, 400);
      updates.push("client_id=?"); vals.push(client.id);
      updates.push("org=?");        vals.push(client.name);
      body.org = undefined; // org comes from the client record
    } else {
      updates.push("client_id=?"); vals.push(null);
    }
  }
  if (body.vendor_id) {
    const vendor = await env.DB.prepare("SELECT id,name FROM vendors WHERE id=?").bind(body.vendor_id).first() as {id:string;name:string}|null;
    if (!vendor) return json({error:"Vendor not found"}, 400);
    updates.push("org=?"); vals.push(vendor.name);
    body.org = undefined;
  }
  // Platform (non-client, non-vendor) roles always belong to 4SYZ Platform
  if (body.role && !["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(body.role)) {
    updates.push("org=?"); vals.push("4SYZ Platform");
    if (body.client_id === undefined) { updates.push("client_id=?"); vals.push(null); }
    body.org = undefined;
  }
  if (body.name)     { updates.push("name=?");           vals.push(body.name);
                       updates.push("initials=?");       vals.push(body.name.split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase()); }
  if (body.email)    { updates.push("email=?");          vals.push(body.email.toLowerCase().trim()); }
  if (body.org)      { updates.push("org=?");            vals.push(body.org); }
  if (body.password) { updates.push("password_hash=?"); vals.push(`hash:${await hashPassword(body.password)}`); }
  if (!updates.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  try {
    await env.DB.prepare(`UPDATE users SET ${updates.join(",")} WHERE id=?`).bind(...vals).run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) return json({error:"Email already in use by another user"}, 409);
    throw e;
  }
  await audit(env, user, "UPDATE", "user", id, undefined, JSON.stringify({active:body.active,role:body.role,name:body.name,email:body.email,org:body.org,password_reset:!!body.password}));
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// PROFILE (self-service)
// ════════════════════════════════════════════════════════════════════

async function handleGetProfile(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const row = await env.DB.prepare("SELECT id,name,email,role,org,initials FROM users WHERE id=?")
    .bind(user!.sub).first() as Record<string,string>|null;
  if (!row) return json({error:"User not found"}, 404);
  return json(row);
}

async function handlePatchProfile(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as {name?:string; current_password?:string; new_password?:string};
  const fields: string[] = [];
  const vals: unknown[] = [];

  if (body.name && body.name.trim()) {
    const initials = body.name.trim().split(/\s+/).map((w:string)=>w[0]||'').join('').toUpperCase().slice(0,2);
    fields.push("name=?"); vals.push(body.name.trim());
    fields.push("initials=?"); vals.push(initials);
  }

  if (body.new_password) {
    if (!body.current_password) return json({error:"Current password required"}, 400);
    const row = await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(user!.sub).first() as {password_hash:string}|null;
    if (!row) return json({error:"User not found"}, 404);
    const hash = row.password_hash;
    let valid = false;
    if (hash.startsWith("hash:"))      valid = await verifyPassword(body.current_password, hash.slice(5));
    else if (hash.startsWith("SEED:")) valid = body.current_password === hash.slice(5);
    else                                valid = body.current_password === hash;
    if (!valid) return json({error:"Current password is incorrect"}, 400);
    fields.push("password_hash=?"); vals.push(`hash:${await hashPassword(body.new_password)}`);
  }

  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(user!.sub);
  await env.DB.prepare(`UPDATE users SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  const updated = await env.DB.prepare("SELECT id,name,email,role,org,initials FROM users WHERE id=?").bind(user!.sub).first();
  return json(updated);
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

// Record today's KPI snapshot (first write of the day wins, so intraday reloads
// don't erase the morning baseline) and return the delta of each current value
// vs the most recent prior day. Returns null keys until history exists.
type KpiDiff = { prev: number; delta: number };
async function recordKpiSnapshotAndDiff(
  env: Env, kpis: Record<string, number>
): Promise<Record<string, KpiDiff> | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const prevRow = await env.DB.prepare(
      "SELECT day, data FROM kpi_daily WHERE day < ? ORDER BY day DESC LIMIT 1"
    ).bind(today).first() as Record<string, string> | null;

    // First write of the day wins; ignore if today's row already exists.
    await env.DB.prepare("INSERT OR IGNORE INTO kpi_daily (day, data) VALUES (?, ?)")
      .bind(today, JSON.stringify(kpis)).run();

    if (!prevRow?.data) return null;
    let prev: Record<string, number>;
    try { prev = JSON.parse(prevRow.data); } catch { return null; }
    const out: Record<string, KpiDiff> = {};
    for (const k of Object.keys(kpis)) {
      if (typeof prev[k] === "number") out[k] = { prev: prev[k], delta: kpis[k] - prev[k] };
    }
    return out;
  } catch { return null; }
}

async function handleDashboard(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const role = user!.role;

  if (["client_admin","client_approver","client_user"].includes(role)) {
    // Resolve the user's client: explicit link first, email-domain fallback — never another client's record
    let client: Record<string,unknown>|null = null;
    if (user!.client_id) {
      client = await env.DB.prepare("SELECT * FROM clients WHERE id=?").bind(user!.client_id).first() as Record<string,unknown>|null;
    }
    if (!client) {
      const domain = user!.email.split("@")[1];
      client = await env.DB.prepare("SELECT * FROM clients WHERE contact_email LIKE ?").bind(`%${domain}%`).first() as Record<string,unknown>|null;
    }
    if (!client) return json({client:null, recentOrders:[], totalSpend:0, pendingApproval:0});
    const cid = client.id as string;
    const [{results:recentOrders}, spend, monthSpend, pendingApproval] = await Promise.all([
      env.DB.prepare("SELECT id,status,grand_total,created_at FROM orders WHERE client_id=? ORDER BY created_at DESC LIMIT 5").bind(cid).all(),
      env.DB.prepare("SELECT SUM(grand_total) as total FROM orders WHERE client_id=? AND status NOT IN ('CANCELLED','DRAFT')").bind(cid).first() as Promise<Record<string,number>|null>,
      env.DB.prepare("SELECT SUM(grand_total) as total FROM orders WHERE client_id=? AND status NOT IN ('CANCELLED','DRAFT') AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").bind(cid).first() as Promise<Record<string,number>|null>,
      env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE client_id=? AND status='PENDING_APPROVAL'").bind(cid).first() as Promise<Record<string,number>|null>,
    ]);
    // Always report actual current-month spend, never the stale seeded column
    client.spent_this_month = (monthSpend as Record<string,number>|null)?.total || 0;
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

  const [totalOrders, pendingOrders, lowStock, pendingDCBilling, openTickets, dueItems, {results:recentOrders}, {results:ordersByStatus}, {results:topClients}] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status NOT IN ('CLOSED','CANCELLED')").first() as Promise<Record<string,number>>,
    // Low stock = below reorder AND actually in use (ever ordered or consumed) —
    // excludes never-used catalogue rows that would otherwise dominate the count.
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM inventory i WHERE i.stock<=i.reorder_level AND i.active=1
      AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku=i.sku)
        OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku=i.sku))`).first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM delivery_challans WHERE status='DELIVERED' AND billed=0").first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status!='RESOLVED'").first() as Promise<Record<string,number>>,
    // Due line items: undelivered order lines across open orders (same rule as consolidated-due)
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM order_items oi JOIN orders o ON oi.order_id=o.id
      WHERE o.status NOT IN ('CANCELLED','CLOSED','DRAFT')
        AND oi.qty > COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
          JOIN delivery_challans dc ON dci.dc_id=dc.id WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)`).first() as Promise<Record<string,number>>,
    env.DB.prepare("SELECT o.id,o.status,o.grand_total,o.created_at,c.name as client_name FROM orders o LEFT JOIN clients c ON o.client_id=c.id ORDER BY o.created_at DESC LIMIT 8").all(),
    env.DB.prepare("SELECT status,COUNT(*) as cnt FROM orders GROUP BY status").all(),
    env.DB.prepare("SELECT c.id,c.name,SUM(o.grand_total) as total,COUNT(o.id) as order_count FROM orders o JOIN clients c ON o.client_id=c.id WHERE o.status NOT IN ('CANCELLED') GROUP BY c.id ORDER BY total DESC LIMIT 5").all(),
  ]);

  const byStatus: Record<string,number> = {};
  (ordersByStatus as Record<string,number>[]).forEach(r => { byStatus[String(r.status)] = Number(r.cnt); });

  const kpis = {
    totalOrders:    (totalOrders as Record<string,number>).cnt,
    pendingApproval: byStatus['PENDING_APPROVAL'] || 0,
    dueItems:       (dueItems as Record<string,number>).cnt,
    pendingBilling: (pendingDCBilling as Record<string,number>).cnt,
    lowStock:       (lowStock as Record<string,number>).cnt,
    openTickets:    (openTickets as Record<string,number>).cnt,
  };
  const kpiTrends = await recordKpiSnapshotAndDiff(env, kpis);

  return json({
    totalOrders: kpis.totalOrders, pendingOrders: (pendingOrders as Record<string,number>).cnt,
    lowStock: kpis.lowStock, pendingDCBilling: kpis.pendingBilling,
    openTickets: kpis.openTickets, dueItems: kpis.dueItems,
    recentOrders, ordersByStatus, topClients, kpiTrends,
  });
}

// ════════════════════════════════════════════════════════════════════
// Alerts & Exceptions hub — every "needs action" signal in one place.
// Each category returns a live count plus a few representative rows and the
// page a staff user should jump to. Internal-ops roles only.
// ════════════════════════════════════════════════════════════════════

// GET /api/nav-badges — live counts for the sidebar badges, keyed by nav page
// id. Cheap COUNT queries only; internal-ops roles only (external roles have no
// badged menus). Lets the sidebar show real numbers instead of a generic "!".
async function handleNavBadges(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({}, 200); // clients/vendors: no badged menus

  const cnt = (r: unknown) => Number((r as { c?: number } | null)?.c || 0);
  const [orders, dueDeliv, fulfil, unbilled, overdueDeliv, pendingAppr, openTickets, lowStock] = await Promise.all([
    // Orders needing an ops decision: pricing / approval
    env.DB.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('PENDING_PRICING','SUBMITTED','PENDING_APPROVAL')").first(),
    // Deliveries still due (in shipment / partially delivered)
    env.DB.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").first(),
    // Warehouse: waiting to be picked / QC'd
    env.DB.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('READY_TO_PICK','PICKED','QUALITY_CHECK')").first(),
    // Finance: delivered but not yet billed
    env.DB.prepare("SELECT COUNT(*) c FROM delivery_challans WHERE status='DELIVERED' AND COALESCE(billed,0)=0").first(),
    // SLA: challans past their expected delivery date
    env.DB.prepare("SELECT COUNT(*) c FROM delivery_challans WHERE status NOT IN ('DELIVERED','CANCELLED') AND expected_delivery_date IS NOT NULL AND expected_delivery_date < date('now')").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM orders WHERE status='PENDING_APPROVAL'").first(),
    env.DB.prepare("SELECT COUNT(*) c FROM tickets WHERE status!='RESOLVED'").first().catch(() => null),
    env.DB.prepare(`SELECT COUNT(*) c FROM inventory i WHERE i.stock<=i.reorder_level AND i.active=1
      AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku=i.sku) OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku=i.sku))`).first().catch(() => null),
  ]);

  const overdue = cnt(overdueDeliv), appr = cnt(pendingAppr);
  const alertsTotal = overdue + appr + cnt(openTickets) + cnt(lowStock) + cnt(unbilled);

  // Keyed by nav page id → the sidebar updates #nav-<id>'s badge in place.
  return json({
    next_actions:     overdue + appr,   // "Today" — the act-now set
    orders:           cnt(orders),
    consolidated_due: cnt(dueDeliv),
    fulfilment:       cnt(fulfil),
    dc_billing:       cnt(unbilled),
    sla_dashboard:    overdue,
    alerts:           alertsTotal,
  });
}

async function handleAlerts(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // Aggregation is org-wide; only internal-ops roles reach this page (nav-gated).
  if (["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(user!.role))
    return json({ error: "Not available for your role" }, 403);

  const cnt = (r: unknown) => Number((r as Record<string, number> | null)?.cnt || 0);
  const rows = (r: unknown) => ((r as { results?: Record<string, unknown>[] })?.results || []);

  const [
    overdueCnt, overdueRows,
    approvalCnt, approvalRows,
    ticketCnt, ticketRows,
    stockCnt, stockRows,
    billingCnt, billingRows,
  ] = await Promise.all([
    // Overdue deliveries — dispatched/pending challans past their expected date
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM delivery_challans
      WHERE status NOT IN ('DELIVERED','CANCELLED') AND expected_delivery_date IS NOT NULL
        AND expected_delivery_date < date('now')`).first(),
    env.DB.prepare(`SELECT dc.id, dc.order_id, dc.expected_delivery_date, c.name as client_name
      FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
      WHERE dc.status NOT IN ('DELIVERED','CANCELLED') AND dc.expected_delivery_date IS NOT NULL
        AND dc.expected_delivery_date < date('now')
      ORDER BY dc.expected_delivery_date ASC LIMIT 5`).all(),
    // Pending approvals — orders awaiting a client/finance approver
    env.DB.prepare("SELECT COUNT(*) as cnt FROM orders WHERE status='PENDING_APPROVAL'").first(),
    env.DB.prepare(`SELECT o.id, o.grand_total, o.created_at, c.name as client_name
      FROM orders o LEFT JOIN clients c ON o.client_id=c.id
      WHERE o.status='PENDING_APPROVAL' ORDER BY o.created_at ASC LIMIT 5`).all(),
    // SLA — open tickets, oldest first (longest-waiting are the breaches)
    env.DB.prepare("SELECT COUNT(*) as cnt FROM tickets WHERE status!='RESOLVED'").first(),
    env.DB.prepare(`SELECT t.id, t.subject, t.priority, t.created_at, c.name as client_name
      FROM tickets t LEFT JOIN clients c ON t.client_id=c.id
      WHERE t.status!='RESOLVED' ORDER BY t.created_at ASC LIMIT 5`).all(),
    // Low / out of stock — in-use SKUs at or below reorder level
    env.DB.prepare(`SELECT COUNT(*) as cnt FROM inventory i WHERE i.stock<=i.reorder_level AND i.active=1
      AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku=i.sku)
        OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku=i.sku))`).first(),
    env.DB.prepare(`SELECT i.sku, i.name, i.stock, i.reorder_level FROM inventory i
      WHERE i.stock<=i.reorder_level AND i.active=1
        AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.sku=i.sku)
          OR EXISTS(SELECT 1 FROM client_consumption cc WHERE cc.sku=i.sku))
      ORDER BY (i.stock*1.0/NULLIF(i.reorder_level,0)) ASC LIMIT 5`).all(),
    // Overdue billing — delivered challans not yet billed
    env.DB.prepare("SELECT COUNT(*) as cnt FROM delivery_challans WHERE status='DELIVERED' AND billed=0").first(),
    env.DB.prepare(`SELECT dc.id, dc.order_id, dc.delivered_at, c.name as client_name
      FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
      WHERE dc.status='DELIVERED' AND dc.billed=0 ORDER BY dc.delivered_at ASC LIMIT 5`).all(),
  ]);

  // Failed integrations — zoho_sync_log may not exist until the integration runs.
  let syncCnt = 0; let syncRows: Record<string, unknown>[] = [];
  try {
    const [c, r] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as cnt FROM zoho_sync_log WHERE status!='OK' AND created_at >= datetime('now','-7 days')").first(),
      env.DB.prepare(`SELECT id, direction, note, created_at FROM zoho_sync_log
        WHERE status!='OK' AND created_at >= datetime('now','-7 days') ORDER BY created_at DESC LIMIT 5`).all(),
    ]);
    syncCnt = cnt(c); syncRows = rows(r);
  } catch { /* table absent — treat as no failures */ }

  // Near-expiry batches (G3 payoff) — batches expiring within 30 days with stock left.
  let expCnt = 0; let expRows: Record<string, unknown>[] = [];
  try {
    const [c, r] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as cnt FROM inventory_batches WHERE qty>0 AND expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days')").first(),
      env.DB.prepare(`SELECT b.sku, i.name, b.batch_no, b.expiry_date, b.qty
        FROM inventory_batches b LEFT JOIN inventory i ON i.sku=b.sku
        WHERE b.qty>0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= date('now','+30 days')
        ORDER BY b.expiry_date ASC LIMIT 5`).all(),
    ]);
    expCnt = cnt(c); expRows = rows(r);
  } catch { /* table new — none */ }

  // Flagged invoices (G1 payoff) — 3-way match variances awaiting resolution.
  let flagCnt = 0; let flagRows: Record<string, unknown>[] = [];
  try {
    const [c, r] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as cnt FROM po_invoices WHERE match_status='FLAGGED'").first(),
      env.DB.prepare(`SELECT po_id, vendor_invoice_no, qty_variance, amount_variance FROM po_invoices
        WHERE match_status='FLAGGED' ORDER BY created_at DESC LIMIT 5`).all(),
    ]);
    flagCnt = cnt(c); flagRows = rows(r);
  } catch { /* table new — none */ }

  // POs awaiting approval (G8) — high-value POs held before reaching the vendor.
  const [poApprCnt, poApprRows] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as cnt FROM purchase_orders WHERE status='PENDING_APPROVAL'").first(),
    env.DB.prepare(`SELECT p.id, p.grand_total, v.name as vendor_name FROM purchase_orders p
      LEFT JOIN vendors v ON p.vendor_id=v.id WHERE p.status='PENDING_APPROVAL' ORDER BY p.grand_total DESC LIMIT 5`).all(),
  ]);

  const money = (n: unknown) => "₹" + Number(n || 0).toLocaleString("en-IN");

  const categories = [
    {
      key: "overdue_deliveries", label: "Overdue deliveries", icon: "🚚", tone: "crit", page: "delivery",
      action: "Chase", count: cnt(overdueCnt),
      items: rows(overdueRows).map(r => ({
        title: `${r.id} · ${r.client_name || "—"}`, meta: `Expected ${r.expected_delivery_date}` })),
    },
    {
      key: "pending_approvals", label: "Pending approvals", icon: "⏳", tone: "warn", page: "orders",
      action: "Review", count: cnt(approvalCnt),
      items: rows(approvalRows).map(r => ({
        title: `${money(r.grand_total)} · ${r.client_name || "—"}`, meta: `Order ${r.id}` })),
    },
    {
      key: "sla_breaches", label: "SLA — open tickets", icon: "⏱️", tone: "crit", page: "service_desk",
      action: "Open", count: cnt(ticketCnt),
      items: rows(ticketRows).map(r => ({
        title: String(r.subject || "Ticket"), meta: `${r.priority || "—"} · ${r.client_name || "—"}` })),
    },
    {
      key: "low_stock", label: "Low / out of stock", icon: "📦", tone: "warn", page: "inventory",
      action: "Reorder", count: cnt(stockCnt),
      items: rows(stockRows).map(r => ({
        title: `${r.name} (${r.sku})`, meta: Number(r.stock) <= 0 ? "Out of stock" : `${r.stock} left · reorder at ${r.reorder_level}` })),
    },
    {
      key: "near_expiry", label: "Near-expiry stock", icon: "⌛", tone: "warn", page: "inventory",
      action: "View", count: expCnt,
      items: expRows.map(r => ({
        title: `${r.name || r.sku}${r.batch_no ? ` · ${r.batch_no}` : ""}`, meta: `${r.qty} left · expires ${r.expiry_date}` })),
    },
    {
      key: "flagged_invoices", label: "Flagged invoices", icon: "🧾", tone: "crit", page: "procurement",
      action: "Resolve", count: flagCnt,
      items: flagRows.map(r => ({
        title: `PO ${r.po_id}${r.vendor_invoice_no ? ` · ${r.vendor_invoice_no}` : ""}`,
        meta: `qty Δ ${r.qty_variance} · amount Δ ${money(r.amount_variance)}` })),
    },
    {
      key: "po_approvals", label: "POs awaiting approval", icon: "🖋️", tone: "warn", page: "procurement",
      action: "Approve", count: cnt(poApprCnt),
      items: rows(poApprRows).map(r => ({
        title: `PO ${r.id} · ${r.vendor_name || "—"}`, meta: money(r.grand_total) })),
    },
    {
      key: "overdue_billing", label: "Overdue billing", icon: "💳", tone: "brand", page: "dc_billing",
      action: "Bill", count: cnt(billingCnt),
      items: rows(billingRows).map(r => ({
        title: `${r.id} · ${r.client_name || "—"}`, meta: r.delivered_at ? `Delivered ${String(r.delivered_at).slice(0,10)}` : "Delivered" })),
    },
    {
      key: "failed_syncs", label: "Failed integrations", icon: "🔌", tone: "crit", page: "settings",
      action: "Fix", count: syncCnt,
      items: syncRows.map(r => ({
        title: `Zoho ${r.direction || "sync"}`, meta: String(r.note || "Sync error") })),
    },
  ];

  const total = categories.reduce((s, c) => s + c.count, 0);
  return json({ generated_at: new Date().toISOString(), total, categories });
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

// GET /api/purchase-orders/:id/receivable — per-line ordered / received / remaining,
// for the line-level GRN grid.
async function handleReceivablePO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const id = path.split("/")[3];
  const po = await env.DB.prepare("SELECT p.*,v.name as vendor_name FROM purchase_orders p LEFT JOIN vendors v ON p.vendor_id=v.id WHERE p.id=?").bind(id).first() as Record<string,unknown>|null;
  if (!po) return json({error:"Not found"}, 404);
  const {results} = await env.DB.prepare(
    "SELECT pi.id, pi.sku, pi.name, pi.qty, pi.unit_price, pi.total, COALESCE(pi.qty_received,0) as qty_received, i.track_batch FROM po_items pi LEFT JOIN inventory i ON i.sku=pi.sku WHERE pi.po_id=?"
  ).bind(id).all();
  const lines = results.map(r => ({
    ...r, remaining: Math.max(0, Number(r.qty) - Number(r.qty_received || 0)),
  }));
  return json({ po, lines });
}

// POST /api/grn — line-level goods receipt. Validates against remaining ordered
// qty, routes only QC-accepted qty into stock (+ a batch row when tracked), and
// derives the PO status (PARTIALLY_RECEIVED / RECEIVED) from the lines.
async function handleCreateGRN(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as {
    po_id:string; notes?:string;
    // Legacy single-line shape is still accepted and normalised into `lines`.
    sku?:string; qty_received?:number;
    lines?: Array<{sku:string; qty_received:number; qty_rejected?:number; batch_no?:string; mfg_date?:string; expiry_date?:string; qc_status?:string; note?:string}>;
  };
  const po_id = body.po_id;
  const lines = body.lines?.length ? body.lines
    : (body.sku && body.qty_received ? [{sku:body.sku, qty_received:body.qty_received}] : []);
  if (!po_id || !lines.length) return json({error:"po_id and at least one line required"}, 400);

  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(po_id).first() as Record<string,unknown>|null;
  if (!po) return json({error:"PO not found"}, 404);

  // Load ordered/received per sku to validate against over-receipt.
  const {results: poItems} = await env.DB.prepare("SELECT sku,name,qty,COALESCE(qty_received,0) as qty_received FROM po_items WHERE po_id=?").bind(po_id).all();
  const bySku = new Map(poItems.map(r => [String(r.sku), r]));
  for (const ln of lines) {
    const it = bySku.get(ln.sku);
    if (!it) return json({error:`SKU ${ln.sku} is not on PO ${po_id}`}, 400);
    const movement = Number(ln.qty_received||0) + Number(ln.qty_rejected||0);
    const remaining = Number(it.qty) - Number(it.qty_received);
    if (movement <= 0) return json({error:`Line ${ln.sku}: quantity must be positive`}, 400);
    if (movement > remaining) return json({error:`Line ${ln.sku}: receiving ${movement} exceeds remaining ${remaining}`}, 400);
  }

  const grnId = uid();
  const totalReceived = lines.reduce((s,l)=>s+Number(l.qty_received||0),0);
  await env.DB.prepare("INSERT INTO grn_records (id,po_id,received_at,received_by,received_by_name,qty_received,notes,status) VALUES (?,?,datetime('now'),?,?,?,?, 'POSTED')")
    .bind(grnId, po_id, user!.sub, user!.name, totalReceived, body.notes||null).run();

  for (const ln of lines) {
    const it = bySku.get(ln.sku)!;
    const accepted = Number(ln.qty_received||0);
    const rejected = Number(ln.qty_rejected||0);
    const qc = ln.qc_status || (rejected > 0 ? 'HOLD' : 'ACCEPTED');
    const lineId = uid();
    await env.DB.prepare("INSERT INTO grn_lines (id,grn_id,sku,name,qty_received,qty_rejected,batch_no,mfg_date,expiry_date,qc_status,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(lineId, grnId, ln.sku, String(it.name), accepted, rejected, ln.batch_no||null, ln.mfg_date||null, ln.expiry_date||null, qc, ln.note||null).run();

    if (accepted > 0) {
      await env.DB.prepare("UPDATE inventory SET stock=stock+? WHERE sku=?").bind(accepted, ln.sku).run();
      await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), ln.sku, 'GRN', accepted, grnId, 'grn', `Received via GRN for PO ${po_id}`, user!.name).run();
      // Record a batch row whenever a batch or expiry was captured (FEFO foundation).
      if (ln.batch_no || ln.expiry_date) {
        await env.DB.prepare("INSERT INTO inventory_batches (id,sku,batch_no,mfg_date,expiry_date,qty,grn_line_id) VALUES (?,?,?,?,?,?,?)")
          .bind(uid(), ln.sku, ln.batch_no||null, ln.mfg_date||null, ln.expiry_date||null, accepted, lineId).run();
      }
    }
    // Advance the per-line running receipt (accepted qty only counts toward fulfilment).
    await env.DB.prepare("UPDATE po_items SET qty_received=COALESCE(qty_received,0)+? WHERE po_id=? AND sku=?")
      .bind(accepted, po_id, ln.sku).run();
  }

  // Derive PO status from the lines: fully received on every line → RECEIVED.
  const {results: afterItems} = await env.DB.prepare("SELECT qty, COALESCE(qty_received,0) as qty_received FROM po_items WHERE po_id=?").bind(po_id).all();
  const allReceived = afterItems.every(r => Number(r.qty_received) >= Number(r.qty));
  const anyReceived = afterItems.some(r => Number(r.qty_received) > 0);
  const newStatus = allReceived ? 'RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : String(po.status));
  await env.DB.prepare("UPDATE purchase_orders SET status=?,updated_at=datetime('now') WHERE id=?").bind(newStatus, po_id).run();

  // Vendor performance from recent receipts (on-time vs expected, avg lead).
  const {results: recentGRNs} = await env.DB.prepare(`
    SELECT p.expected_delivery, g.received_at, julianday(g.received_at)-julianday(p.created_at) as lead
    FROM grn_records g JOIN purchase_orders p ON g.po_id=p.id
    WHERE p.vendor_id=? ORDER BY g.received_at DESC LIMIT 10`).bind(po.vendor_id).all() as {results: Record<string,unknown>[]};
  const onTimeCount = recentGRNs.filter(g => !g.expected_delivery || new Date(g.received_at as string) <= new Date(g.expected_delivery as string)).length;
  const avgLead = recentGRNs.reduce((s, g) => s + (Number(g.lead) || 3), 0) / (recentGRNs.length || 1);
  const onTimeRate = Math.round((onTimeCount / (recentGRNs.length || 1)) * 100);
  await env.DB.prepare("UPDATE vendors SET on_time_rate=?,avg_lead_days=? WHERE id=?")
    .bind(onTimeRate, Math.round(avgLead), po.vendor_id).run();

  await checkAutoReorder(env, user);
  await audit(env, user, "GRN", "purchase_order", po_id, String(po.status), newStatus);
  return json({id: grnId, po_status: newStatus, received: totalReceived}, 201);
}

// POST /api/purchase-orders/:id/invoice — record the vendor invoice and run a
// 3-way match (ordered vs received vs invoiced). Matched → PO INVOICED + Zoho
// sync; otherwise the PO stays RECEIVED and the invoice is FLAGGED.
async function handleInvoicePO(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const id = path.split("/")[3];
  const body = await request.json() as {vendor_invoice_no?:string; invoice_amount:number; invoice_date?:string};
  const po = await env.DB.prepare("SELECT p.*,c.name as client_name FROM purchase_orders p LEFT JOIN orders o ON p.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id WHERE p.id=?").bind(id).first() as Record<string,unknown>|null;
  if (!po) return json({error:"Not found"}, 404);
  if (!body.invoice_amount) return json({error:"invoice_amount required"}, 400);

  const received = await env.DB.prepare("SELECT COALESCE(SUM(qty_received),0) as r FROM po_items WHERE po_id=?").bind(id).first() as Record<string,number>|null;
  const ordered = await env.DB.prepare("SELECT COALESCE(SUM(qty),0) as q FROM po_items WHERE po_id=?").bind(id).first() as Record<string,number>|null;
  const receivedQty = Number(received?.r || 0);
  const orderedQty = Number(ordered?.q || 0);
  const grand = Number(po.grand_total || 0);
  const qtyVariance = receivedQty - orderedQty;                 // 0 = full receipt
  const amountVariance = Number(body.invoice_amount) - grand;   // 0 = billed as ordered
  // Matched when goods are fully received and the invoice equals the PO (₹1 tolerance).
  const matched = qtyVariance === 0 && Math.abs(amountVariance) <= 1;
  const matchStatus = matched ? 'MATCHED' : 'FLAGGED';

  await env.DB.prepare("INSERT INTO po_invoices (id,po_id,vendor_invoice_no,invoice_amount,invoice_date,match_status,qty_variance,amount_variance) VALUES (?,?,?,?,?,?,?,?)")
    .bind(uid(), id, body.vendor_invoice_no||null, body.invoice_amount, body.invoice_date||new Date().toISOString().slice(0,10), matchStatus, qtyVariance, amountVariance).run();

  if (matched) {
    await env.DB.prepare("UPDATE purchase_orders SET status='INVOICED',updated_at=datetime('now') WHERE id=?").bind(id).run();
    await syncToZohoBooks(env, {id, clientName: String(po.client_name || 'Vendor PO'), amount: grand, date: new Date().toISOString().slice(0,10)});
  } else {
    await pushNotification(env, "procurement_manager", `Invoice for PO ${id} FLAGGED — qty Δ ${qtyVariance}, amount Δ ₹${amountVariance.toLocaleString("en-IN")}`);
  }
  await audit(env, user, "INVOICE", "purchase_order", id, String(po.status), matchStatus);
  return json({id, match_status: matchStatus, qty_variance: qtyVariance, amount_variance: amountVariance});
}

// ── Vendor debit notes (G11) — claim value back for rejected/short/damaged goods ──
// POST /api/purchase-orders/:id/debit-note
async function handleCreateDebitNote(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const poId = path.split("/")[3];
  const po = await env.DB.prepare("SELECT id,vendor_id FROM purchase_orders WHERE id=?").bind(poId).first() as Record<string,string>|null;
  if (!po) return json({error:"PO not found"}, 404);
  const body = await request.json() as {sku?:string; qty:number; amount?:number; reason?:string};
  if (!body.qty || body.qty <= 0) return json({error:"qty required"}, 400);

  const line = body.sku ? await env.DB.prepare("SELECT name,unit_price FROM po_items WHERE po_id=? AND sku=?").bind(poId, body.sku).first() as Record<string,unknown>|null : null;
  const amount = body.amount != null ? Number(body.amount) : Number(body.qty) * Number(line?.unit_price || 0);
  const id = uid();
  await env.DB.prepare("INSERT INTO vendor_debit_notes (id,po_id,vendor_id,sku,name,qty,amount,reason,created_by) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, poId, po.vendor_id, body.sku || null, line ? String(line.name) : null, body.qty, amount, body.reason || null, user!.sub).run();
  await pushNotification(env, "vendor_admin", `Debit note raised on PO ${poId} — ₹${amount.toLocaleString("en-IN")} (${body.reason || "goods rejected"})`);
  await audit(env, user, "DEBIT_NOTE", "purchase_order", poId, undefined, `sku:${body.sku||"-"},qty:${body.qty},amount:${amount}`);
  return json({id, amount}, 201);
}

// GET /api/purchase-orders/:id/debit-notes
async function handleListDebitNotes(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (isExternalRole(user!.role)) return json({error:"Forbidden"}, 403);
  const poId = path.split("/")[3];
  const {results} = await env.DB.prepare("SELECT * FROM vendor_debit_notes WHERE po_id=? ORDER BY created_at DESC").bind(poId).all();
  return json(results);
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

  return json({orders, inventory, vendors, clients, tickets});
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
    zoho_inventory_configured: zohoInvConfigured(env),
    zoho_inventory_enabled: (await getConfig(env, "zoho_inv_sync_enabled", "false")) === "true",
    dc_barcode_capture: (await getConfig(env, "dc_barcode_capture", "false")) === "true",
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
  // Feature flag: barcode-scan step on DC (POD) capture. Off by default.
  if (body.dc_barcode_capture !== undefined) {
    await setConfig(env, "dc_barcode_capture", body.dc_barcode_capture ? "true" : "false", user!.sub);
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

  try {
  switch (type) {
    case "spend": {
      const {results} = await env.DB.prepare(`SELECT c.name as client, strftime('%Y-%m',o.created_at) as month,
        SUM(o.grand_total) as total_spend, COUNT(o.id) as order_count
        FROM orders o JOIN clients c ON o.client_id=c.id
        WHERE o.created_at>=? AND o.created_at<date(?,'+1 day') AND o.status NOT IN ('CANCELLED','DRAFT')
        GROUP BY c.id,month ORDER BY month DESC, total_spend DESC`).bind(from,to).all();
      return json({type,from,to,data:results});
    }
    case "fulfilment": {
      const {results} = await env.DB.prepare(`SELECT o.id,o.status,o.created_at,dc.delivered_at,
        ROUND((julianday(dc.delivered_at)-julianday(o.created_at)),1) as days_to_deliver
        FROM orders o LEFT JOIN delivery_challans dc ON o.id=dc.order_id
        WHERE o.created_at>=? AND o.created_at<date(?,'+1 day') AND o.status NOT IN ('CANCELLED','DRAFT')
        ORDER BY o.created_at DESC LIMIT 100`).bind(from,to).all();
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
      await ensureCriticalTable(env);
      const {results} = await env.DB.prepare(`
        SELECT i.sku, i.name, i.category, i.stock, i.reorder_level, i.max_stock,
          CASE WHEN cs.sku IS NOT NULL THEN 1 ELSE 0 END as is_critical,
          ROUND(i.stock*100.0/i.max_stock,1) as utilisation_pct,
          CASE WHEN i.stock<=i.reorder_level THEN 'LOW' WHEN i.stock<=i.reorder_level*1.5 THEN 'MEDIUM' ELSE 'OK' END as stock_health
        FROM inventory i LEFT JOIN critical_skus cs ON cs.sku=i.sku
        WHERE i.active=1 ORDER BY is_critical DESC, utilisation_pct ASC`).all();
      return json({type,from,to,data:results});
    }
    case "critical-stock": {
      await ensureCriticalTable(env);
      const {results} = await env.DB.prepare(`
        SELECT i.sku, i.name, i.category, i.stock, i.reorder_level, i.max_stock,
          CASE WHEN i.stock=0 THEN 'OUT' WHEN i.stock<=i.reorder_level THEN 'LOW' ELSE 'WATCH' END as status,
          v.name as vendor_name, v.contact_email as vendor_email, v.avg_lead_days
        FROM inventory i
        JOIN critical_skus cs ON cs.sku = i.sku
        LEFT JOIN vendors v ON i.vendor_id=v.id
        WHERE i.active=1
        ORDER BY i.stock ASC, i.name ASC`).all();
      return json({type,from,to,data:results});
    }
    case "budget": {
      const {results} = await env.DB.prepare(`SELECT c.name,c.monthly_budget,
        COALESCE((SELECT SUM(o.grand_total) FROM orders o
          WHERE o.client_id=c.id AND o.status NOT IN ('CANCELLED','DRAFT')
          AND strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now')),0) AS spent_this_month,
        ROUND(COALESCE((SELECT SUM(o.grand_total) FROM orders o
          WHERE o.client_id=c.id AND o.status NOT IN ('CANCELLED','DRAFT')
          AND strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now')),0)*100.0/c.monthly_budget,1) as utilisation_pct,
        c.approval_threshold,
        c.monthly_budget - COALESCE((SELECT SUM(o.grand_total) FROM orders o
          WHERE o.client_id=c.id AND o.status NOT IN ('CANCELLED','DRAFT')
          AND strftime('%Y-%m',o.created_at)=strftime('%Y-%m','now')),0) AS remaining
        FROM clients c WHERE c.active=1 ORDER BY utilisation_pct DESC`).all();
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
        WHERE o.created_at>=? AND o.created_at<date(?,'+1 day') AND o.status NOT IN ('CANCELLED','DRAFT')
        GROUP BY i.hsn_code,i.name ORDER BY gst_amount DESC`).bind(from,to).all();
      return json({type,from,to,data:results});
    }
    case "budget-forecast": {
      const {results: clients2} = await env.DB.prepare("SELECT id,name FROM clients WHERE active=1").all();
      const forecast = [];
      for (const cl of clients2 as Record<string,unknown>[]) {
        const {results: history} = await env.DB.prepare(`
          SELECT strftime('%Y-%m',created_at) as month, SUM(grand_total) as actual
          FROM orders WHERE client_id=? AND status NOT IN ('CANCELLED','DRAFT')
          AND created_at >= datetime('now','-6 months')
          GROUP BY month ORDER BY month ASC`).bind(cl.id).all();
        const actuals = (history as Record<string,unknown>[]).map(r => ({ month: r.month as string, actual: r.actual as number }));
        const last3 = actuals.slice(-3);
        const avg = last3.length ? last3.reduce((s,r) => s + (r.actual||0), 0) / last3.length : 0;
        const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextLabel = nextMonth.toISOString().slice(0,7);
        forecast.push({ client: cl.name, history: actuals, forecast: { month: nextLabel, predicted: Math.round(avg) } });
      }
      return json({ type, data: forecast });
    }
    case "order-items": {
      const {results} = await env.DB.prepare(`
        SELECT
          c.name AS client_name,
          o.id AS order_id,
          o.status AS order_status,
          o.created_at,
          o.grand_total,
          COALESCE((SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=o.id), 0) AS item_count,
          COALESCE((SELECT SUM(oi.qty) FROM order_items oi WHERE oi.order_id=o.id), 0) AS qty_ordered,
          COALESCE((SELECT dc.status FROM delivery_challans dc WHERE dc.order_id=o.id LIMIT 1), 'NOT_DISPATCHED') AS delivery_status
        FROM orders o
        JOIN clients c ON o.client_id=c.id
        WHERE o.status NOT IN ('CANCELLED','DRAFT')
          AND o.created_at >= ?
          AND o.created_at < date(?, '+1 day')
        ORDER BY c.name, o.created_at DESC
        LIMIT 200`).bind(from, to).all();
      return json({type,from,to,data:results});
    }
    default: return json({error:"Unknown report type"}, 400);
  }
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({error:"Report query failed", detail: msg}, 500);
  }
}

// ════════════════════════════════════════════════════════════════════
// FULFILMENT REPORTS (15.X series)
// ════════════════════════════════════════════════════════════════════

async function handleRptOrderVsDelivery(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || '';
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  const dueOnly = url.searchParams.get('due_only') === '1';

  let query = `
    SELECT
      o.id AS order_number,
      o.created_at AS order_date,
      c.name AS client_name,
      COALESCE(c.location,'') AS client_location,
      COALESCE(i.brand, i.category,'') AS brand_name,
      oi.name AS item_name,
      oi.qty AS ordered_qty,
      MIN(oi.qty, COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0)) AS delivered_qty,
      MAX(0, oi.qty - COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0)) AS due_qty,
      MAX(0, oi.qty - COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0)) * oi.unit_price AS due_value,
      (SELECT COUNT(*) FROM delivery_challans dc3 WHERE dc3.order_id=o.id AND dc3.status NOT IN ('CANCELLED')) AS dc_count,
      (SELECT MAX(dc4.delivered_at) FROM delivery_challans dc4 WHERE dc4.order_id=o.id AND dc4.status='DELIVERED') AS last_delivery_date,
      CASE
        WHEN o.status IN ('CLOSED','PARTIALLY_CLOSED') AND oi.qty <= COALESCE((SELECT SUM(CASE WHEN dc2b.status='DELIVERED' AND dci2.qty_delivered=0 THEN dci2.qty_ordered ELSE dci2.qty_delivered END) FROM dc_items dci2 JOIN delivery_challans dc2b ON dci2.dc_id=dc2b.id WHERE dc2b.order_id=o.id AND dci2.sku=oi.sku),0) THEN 'Complete'
        WHEN COALESCE((SELECT SUM(CASE WHEN dc2c.status='DELIVERED' AND dci3.qty_delivered=0 THEN dci3.qty_ordered ELSE dci3.qty_delivered END) FROM dc_items dci3 JOIN delivery_challans dc2c ON dci3.dc_id=dc2c.id WHERE dc2c.order_id=o.id AND dci3.sku=oi.sku),0) > 0 THEN 'Partial'
        ELSE 'Open'
      END AS order_status
    FROM orders o
    JOIN clients c ON o.client_id=c.id
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    WHERE o.status NOT IN ('CANCELLED','DRAFT')
      AND date(o.created_at) >= ? AND date(o.created_at) <= ?`;
  const params: (string|number)[] = [from, to];
  if (clientId) { query += ` AND o.client_id=?`; params.push(clientId); }
  if (dueOnly) { query += ` AND oi.qty > COALESCE((SELECT SUM(CASE WHEN dc6.status='DELIVERED' AND dci3.qty_delivered=0 THEN dci3.qty_ordered ELSE dci3.qty_delivered END) FROM dc_items dci3 JOIN delivery_challans dc6 ON dci3.dc_id=dc6.id WHERE dc6.order_id=o.id AND dci3.sku=oi.sku),0)`; }
  query += ` ORDER BY o.created_at DESC, c.name, oi.name LIMIT 500`;
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleRptBrandProcurement(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  const {results} = await env.DB.prepare(`
    SELECT
      COALESCE(i.brand, i.category) AS brand_name,
      i.category,
      SUM(oi.qty) AS total_ordered_qty,
      COALESCE(SUM(dci_sum.qty_delivered),0) AS total_delivered_qty,
      MAX(0, SUM(oi.qty) - COALESCE(SUM(dci_sum.qty_delivered),0)) AS shortfall_qty,
      MAX(0, SUM(oi.qty) - COALESCE(SUM(dci_sum.qty_delivered),0)) AS suggested_po_qty,
      GROUP_CONCAT(DISTINCT c.name) AS clients,
      COALESCE(v.name,'') AS primary_vendor,
      MAX(i.vendor_id) AS vendor_id,
      COUNT(DISTINCT o.client_id) AS client_count,
      COUNT(DISTINCT o.id) AS order_count
    FROM orders o
    JOIN clients c ON o.client_id=c.id
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN vendors v ON v.id=i.vendor_id
    LEFT JOIN (
      SELECT dci.sku, dc.order_id, SUM(dci.qty_delivered) AS qty_delivered
      FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
      GROUP BY dci.sku, dc.order_id
    ) dci_sum ON dci_sum.sku=oi.sku AND dci_sum.order_id=o.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT')
      AND date(o.created_at) >= ? AND date(o.created_at) <= ?
    GROUP BY COALESCE(i.brand,i.category)
    ORDER BY total_ordered_qty DESC`).bind(from, to).all();
  return json(results);
}

// SKU-level shortfall for one brand — used to pre-fill the "Initiate PO" modal
async function handleRptBrandProcurementItems(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const brand = url.searchParams.get('brand') || '';
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  if (!brand) return json({error:"brand required"}, 400);

  const {results} = await env.DB.prepare(`
    SELECT
      oi.sku,
      MAX(i.name) AS name,
      MAX(i.vendor_id) AS vendor_id,
      MAX(i.unit_price) AS unit_price,
      MAX(0, SUM(oi.qty) - COALESCE(SUM(dci_sum.qty_delivered),0)) AS shortfall_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN (
      SELECT dci.sku, dc.order_id, SUM(dci.qty_delivered) AS qty_delivered
      FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
      GROUP BY dci.sku, dc.order_id
    ) dci_sum ON dci_sum.sku=oi.sku AND dci_sum.order_id=o.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT')
      AND COALESCE(i.brand,i.category)=?
      AND date(o.created_at) >= ? AND date(o.created_at) <= ?
    GROUP BY oi.sku
    HAVING shortfall_qty > 0
    ORDER BY shortfall_qty DESC`).bind(brand, from, to).all();
  return json(results);
}

async function handleRptDueItems(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id') || '';
  const from = url.searchParams.get('from') || new Date(Date.now()-60*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  let query = `
    SELECT
      c.name AS client_name,
      COALESCE(c.location,'') AS location,
      o.id AS order_number,
      COALESCE(i.brand, i.category,'') AS brand_name,
      oi.name AS item_name,
      oi.qty AS ordered_qty,
      COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND d.qty_delivered=0 THEN d.qty_ordered ELSE d.qty_delivered END) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0) AS delivered_qty,
      oi.qty - COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND d.qty_delivered=0 THEN d.qty_ordered ELSE d.qty_delivered END) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0) AS due_qty,
      o.created_at AS due_since_date,
      CAST(julianday('now') - julianday(o.created_at) AS INTEGER) AS due_ageing_days,
      COALESCE(v.name,'') AS responsible_vendor,
      CASE
        WHEN CAST(julianday('now') - julianday(o.created_at) AS INTEGER) >= 15 THEN 'Critical Due'
        WHEN CAST(julianday('now') - julianday(o.created_at) AS INTEGER) >= 8 THEN 'Delayed'
        WHEN CAST(julianday('now') - julianday(o.created_at) AS INTEGER) >= 4 THEN 'Due'
        ELSE 'Due'
      END AS due_status
    FROM orders o
    JOIN clients c ON o.client_id=c.id
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN vendors v ON v.id=i.vendor_id
    WHERE o.status NOT IN ('CLOSED','CANCELLED','DRAFT')
      AND date(o.created_at) >= ? AND date(o.created_at) <= ?
      AND oi.qty > COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND d2.qty_delivered=0 THEN d2.qty_ordered ELSE d2.qty_delivered END) FROM dc_items d2 JOIN delivery_challans dc2 ON d2.dc_id=dc2.id WHERE dc2.order_id=o.id AND d2.sku=oi.sku),0)`;
  const params: (string|number)[] = [from, to];
  if (clientId) { query += ` AND o.client_id=?`; params.push(clientId); }
  query += ` ORDER BY due_ageing_days DESC, c.name LIMIT 300`;
  const {results} = await env.DB.prepare(query).bind(...params).all();
  return json(results);
}

async function handleRptDCPerOrder(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  const {results: orders} = await env.DB.prepare(`
    SELECT o.id, c.name AS client_name, o.grand_total, o.status, o.created_at,
      (SELECT COUNT(*) FROM delivery_challans dc WHERE dc.order_id=o.id AND dc.status NOT IN ('CANCELLED')) AS dc_count,
      (SELECT COALESCE(SUM(oi.qty),0) FROM order_items oi WHERE oi.order_id=o.id) AS total_ordered,
      (SELECT COALESCE(SUM(dci.qty_delivered),0) FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id WHERE dc.order_id=o.id) AS total_delivered,
      (SELECT MAX(dc.delivered_at) FROM delivery_challans dc WHERE dc.order_id=o.id AND dc.status='DELIVERED') AS completion_date
    FROM orders o JOIN clients c ON o.client_id=c.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT')
      AND date(o.created_at) >= ? AND date(o.created_at) <= ?
    ORDER BY o.created_at DESC LIMIT 200`).bind(from, to).all();
  const totalOrders = (orders as Record<string,unknown>[]).length;
  const singleDC = (orders as Record<string,unknown>[]).filter(o => (o.dc_count as number) === 1).length;
  const multiDC = (orders as Record<string,unknown>[]).filter(o => (o.dc_count as number) > 1).length;
  const avgDCsPerOrder = totalOrders ? ((orders as Record<string,unknown>[]).reduce((s,o) => s + (o.dc_count as number||0), 0) / totalOrders).toFixed(1) : '0';
  return json({ orders, kpis: { totalOrders, singleDC, multiDC, avgDCsPerOrder } });
}

async function handleRptOrderDCs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const orderId = new URL(request.url).searchParams.get('order_id');
  if (!orderId) return json({error:'order_id required'}, 400);
  const {results} = await env.DB.prepare(`
    SELECT dc.id,
      COALESCE(dc.dc_number, dc.id) AS dc_number,
      date(dc.dispatched_at) AS dc_date,
      dc.delivered_at,
      dc.status,
      dc.driver_name,
      dc.vehicle_no,
      COUNT(dci.id) AS line_count,
      COALESCE(SUM(dci.qty_ordered),0) AS total_qty_ordered,
      COALESCE(SUM(dci.qty_delivered),0) AS total_qty_delivered
    FROM delivery_challans dc
    LEFT JOIN dc_items dci ON dci.dc_id = dc.id
    WHERE dc.order_id = ?
    GROUP BY dc.id
    ORDER BY dc.dispatched_at`).bind(orderId).all();
  return json(results);
}

async function handleRptDCReconciliation(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  const {results} = await env.DB.prepare(`
    SELECT
      dc.id AS dc_number,
      date(dc.dispatched_at) AS dc_date,
      c.name AS client_name,
      dc.order_id AS order_number,
      dc.delivered_qty,
      COALESCE(dc.driver_name,'') AS delivery_executive,
      dc.pod_uploaded,
      dc.dc_scan_uploaded,
      dc.billed AS is_billed,
      dc.status
    FROM delivery_challans dc
    JOIN orders o ON dc.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE date(dc.dispatched_at) >= ? AND date(dc.dispatched_at) <= ?
    ORDER BY dc.dispatched_at DESC LIMIT 300`).bind(from, to).all();
  const rows = results as Record<string,unknown>[];
  const kpis = {
    total_dcs: rows.length,
    pod_uploaded: rows.filter(r => r.pod_uploaded).length,
    dc_scan_uploaded: rows.filter(r => r.dc_scan_uploaded).length,
    missing_pod: rows.filter(r => !r.pod_uploaded && r.status === 'DELIVERED').length,
    missing_dc_scan: rows.filter(r => !r.dc_scan_uploaded).length,
  };
  return json({ dcs: results, kpis });
}

async function handleRptPendingSupply(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const [openR, partialR, dueQtyR, delayedR] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM orders WHERE status NOT IN ('CLOSED','CANCELLED','DRAFT') AND (SELECT COALESCE(SUM(dci.qty_delivered),0) FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id WHERE dc.order_id=orders.id) = 0`).first() as Promise<Record<string,unknown>|null>,
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM orders WHERE status NOT IN ('CLOSED','CANCELLED','DRAFT') AND (SELECT COALESCE(SUM(dci.qty_delivered),0) FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id WHERE dc.order_id=orders.id) > 0`).first() as Promise<Record<string,unknown>|null>,
    env.DB.prepare(`SELECT COALESCE(SUM(oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0)),0) AS due_qty, COALESCE(SUM((oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0))*oi.unit_price),0) AS due_value FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.status NOT IN ('CLOSED','CANCELLED','DRAFT')`).first() as Promise<Record<string,unknown>|null>,
    env.DB.prepare(`SELECT COUNT(*) AS cnt FROM orders WHERE status='IN_SHIPMENT' AND julianday('now')-julianday(updated_at) > 3`).first() as Promise<Record<string,unknown>|null>,
  ]);
  const {results: clientRows} = await env.DB.prepare(`
    SELECT c.name, c.id, COUNT(DISTINCT o.id) AS order_count,
      SUM(oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0)) AS due_qty,
      SUM((oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0))*oi.unit_price) AS due_value
    FROM orders o JOIN clients c ON o.client_id=c.id JOIN order_items oi ON oi.order_id=o.id
    WHERE o.status NOT IN ('CLOSED','CANCELLED','DRAFT')
    GROUP BY c.id ORDER BY due_qty DESC`).all();
  return json({
    kpis: {
      open_orders: (openR as Record<string,number>)?.cnt || 0,
      partial_orders: (partialR as Record<string,number>)?.cnt || 0,
      due_qty: (dueQtyR as Record<string,number>)?.due_qty || 0,
      due_value: (dueQtyR as Record<string,number>)?.due_value || 0,
      delayed_deliveries: (delayedR as Record<string,number>)?.cnt || 0,
    },
    clients: clientRows
  });
}

async function handleRptDueAgeing(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT
      CASE
        WHEN CAST(julianday('now')-julianday(o.created_at) AS INTEGER) <= 1 THEN '0-1 Days'
        WHEN CAST(julianday('now')-julianday(o.created_at) AS INTEGER) <= 3 THEN '2-3 Days'
        WHEN CAST(julianday('now')-julianday(o.created_at) AS INTEGER) <= 7 THEN '4-7 Days'
        WHEN CAST(julianday('now')-julianday(o.created_at) AS INTEGER) <= 15 THEN '8-15 Days'
        ELSE '15+ Days'
      END AS age_bucket,
      COUNT(DISTINCT o.id) AS order_count,
      COUNT(DISTINCT o.client_id) AS client_count,
      COALESCE(SUM(oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0)),0) AS due_qty,
      COALESCE(SUM((oi.qty - COALESCE((SELECT SUM(d.qty_delivered) FROM dc_items d JOIN delivery_challans dc ON d.dc_id=dc.id WHERE dc.order_id=o.id AND d.sku=oi.sku),0))*oi.unit_price),0) AS due_value,
      COUNT(DISTINCT i.vendor_id) AS vendor_count
    FROM orders o
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    WHERE o.status NOT IN ('CLOSED','CANCELLED','DRAFT')
      AND oi.qty > COALESCE((SELECT SUM(d2.qty_delivered) FROM dc_items d2 JOIN delivery_challans dc2 ON d2.dc_id=dc2.id WHERE dc2.order_id=o.id AND d2.sku=oi.sku),0)
    GROUP BY age_bucket
    ORDER BY MIN(CAST(julianday('now')-julianday(o.created_at) AS INTEGER))`).all();
  return json(results);
}

async function handleRptBrandShortfall(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  const {results} = await env.DB.prepare(`
    SELECT
      COALESCE(i.brand, i.category) AS brand_name,
      SUM(oi.qty) AS ordered_qty,
      COALESCE(SUM(dlvd.qty_delivered),0) AS delivered_qty,
      SUM(oi.qty) - COALESCE(SUM(dlvd.qty_delivered),0) AS due_qty,
      CASE WHEN SUM(oi.qty) > 0 THEN ROUND(COALESCE(SUM(dlvd.qty_delivered),0)*100.0/SUM(oi.qty),1) ELSE 100 END AS fulfilment_pct,
      COALESCE(v.name,'') AS primary_vendor
    FROM orders o
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN vendors v ON v.id=i.vendor_id
    LEFT JOIN (
      SELECT dci.sku, dc.order_id, SUM(dci.qty_delivered) AS qty_delivered
      FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id GROUP BY dci.sku, dc.order_id
    ) dlvd ON dlvd.sku=oi.sku AND dlvd.order_id=o.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT') AND date(o.created_at) >= ? AND date(o.created_at) <= ?
    GROUP BY COALESCE(i.brand,i.category)
    HAVING due_qty > 0
    ORDER BY due_qty DESC`).bind(from, to).all();
  return json(results);
}

async function handleRptClientFulfilment(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0,10);
  // A client sees only its own fulfilment row — never other clients' volumes/values.
  const isClientRole = CLIENT_ROLES.includes(user!.role);
  const clientFilter = isClientRole && user!.client_id ? " AND o.client_id = ?" : "";
  const binds: (string)[] = [from, to, ...(isClientRole && user!.client_id ? [String(user!.client_id)] : [])];
  const {results} = await env.DB.prepare(`
    SELECT
      c.name AS client_name,
      COALESCE(c.location,'') AS location,
      COUNT(DISTINCT o.id) AS total_orders,
      SUM(oi.qty) AS ordered_qty,
      COALESCE(SUM(dlvd.qty_delivered),0) AS delivered_qty,
      SUM(oi.qty) - COALESCE(SUM(dlvd.qty_delivered),0) AS due_qty,
      CASE WHEN SUM(oi.qty) > 0 THEN ROUND(COALESCE(SUM(dlvd.qty_delivered),0)*100.0/SUM(oi.qty),1) ELSE 100 END AS fulfilment_pct,
      SUM((oi.qty - COALESCE(dlvd.qty_delivered,0))*oi.unit_price) AS due_value,
      ROUND(AVG(CASE WHEN dc.delivered_at IS NOT NULL THEN julianday(dc.delivered_at)-julianday(o.created_at) END),1) AS avg_delivery_days
    FROM orders o
    JOIN clients c ON o.client_id=c.id
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN delivery_challans dc ON dc.order_id=o.id AND dc.status='DELIVERED'
    LEFT JOIN (
      SELECT dci.sku, dc2.order_id, SUM(dci.qty_delivered) AS qty_delivered
      FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id GROUP BY dci.sku, dc2.order_id
    ) dlvd ON dlvd.sku=oi.sku AND dlvd.order_id=o.id
    WHERE o.status NOT IN ('CANCELLED','DRAFT') AND date(o.created_at) >= ? AND date(o.created_at) <= ?${clientFilter}
    GROUP BY c.id ORDER BY fulfilment_pct ASC`).bind(...binds).all();
  return json(results);
}

async function handleRptProcurementForecast(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT
      COALESCE(i.brand, i.category) AS brand_name,
      oi.name AS item_name,
      oi.sku,
      SUM(oi.qty - COALESCE(dlvd.qty_delivered,0)) AS due_qty,
      i.stock AS current_stock,
      CASE WHEN i.stock < SUM(oi.qty - COALESCE(dlvd.qty_delivered,0))
           THEN SUM(oi.qty - COALESCE(dlvd.qty_delivered,0)) - i.stock
           ELSE 0 END AS suggested_procurement_qty,
      COALESCE(v.name,'') AS vendor_name,
      v.id AS vendor_id
    FROM orders o
    JOIN order_items oi ON oi.order_id=o.id
    LEFT JOIN inventory i ON i.sku=oi.sku
    LEFT JOIN vendors v ON v.id=i.vendor_id
    LEFT JOIN (
      SELECT dci.sku, dc.order_id, SUM(dci.qty_delivered) AS qty_delivered
      FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id GROUP BY dci.sku, dc.order_id
    ) dlvd ON dlvd.sku=oi.sku AND dlvd.order_id=o.id
    WHERE o.status NOT IN ('CLOSED','CANCELLED','DRAFT')
      AND oi.qty > COALESCE(dlvd.qty_delivered,0)
    GROUP BY oi.sku
    HAVING suggested_procurement_qty > 0
    ORDER BY suggested_procurement_qty DESC`).all();
  return json(results);
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

// ════════════════════════════════════════════════════════════════════
// Feature 16: DELIVERY ROUTES
// ════════════════════════════════════════════════════════════════════

async function handleListDeliveryRoutes(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(
    "SELECT * FROM delivery_routes ORDER BY route_date DESC LIMIT 50"
  ).all();
  return json(results);
}

async function handleCreateDeliveryRoute(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const dcIds = (body.dc_ids as string[]) || [];
  const stops = dcIds.map((dcId, i) => ({ seq: i + 1, dc_id: dcId }));
  const id = uid();
  const name = (body.name as string) || `Route ${new Date().toISOString().slice(0,10)}`;
  const routeDate = (body.route_date as string) || new Date().toISOString().slice(0,10);
  await env.DB.prepare(
    "INSERT INTO delivery_routes (id,name,route_date,stops,status,created_by) VALUES (?,?,?,?,?,?)"
  ).bind(id, name, routeDate, JSON.stringify(stops), "PLANNED", user!.sub).run();
  await audit(env, user, "CREATE", "delivery_route", id, undefined, JSON.stringify({name, stops: stops.length}));
  return json({id, name, route_date: routeDate, stops, status: "PLANNED"}, 201);
}

async function handlePatchDeliveryRoute(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = ["updated_at=datetime('now')"];
  const vals: unknown[] = [];
  if (body.status) { fields.push("status=?"); vals.push(body.status); }
  if (body.stops)  { fields.push("stops=?");  vals.push(JSON.stringify(body.stops)); }
  if (body.name)   { fields.push("name=?");   vals.push(body.name); }
  vals.push(id);
  await env.DB.prepare(`UPDATE delivery_routes SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// Feature 17: DUNNING / PAYMENT ESCALATION
// ════════════════════════════════════════════════════════════════════

async function handleListDunningRules(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM dunning_rules WHERE active=1 ORDER BY days_overdue").all();
  return json(results);
}

async function handleCreateDunningRule(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","finance_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO dunning_rules (id,days_overdue,action,message_template) VALUES (?,?,?,?)"
  ).bind(id, body.days_overdue, body.action, body.message_template||null).run();
  return json({id}, 201);
}

async function handleRunDunning(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","finance_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const {results: rules} = await env.DB.prepare("SELECT * FROM dunning_rules WHERE active=1").all();
  const {results: overdue} = await env.DB.prepare(`
    SELECT o.id, o.client_id, o.grand_total, o.created_at, c.name as client_name, c.contact_email
    FROM orders o JOIN clients c ON o.client_id=c.id
    WHERE o.status IN ('CLOSED','PARTIALLY_CLOSED')
    AND o.id NOT IN (SELECT DISTINCT order_id FROM delivery_challans WHERE billed=1)
    AND julianday('now') - julianday(o.created_at) > 0
  `).all();

  let triggered = 0;
  for (const rule of rules as Record<string,unknown>[]) {
    for (const order of overdue as Record<string,unknown>[]) {
      const daysDiff = Math.floor((Date.now() - new Date(order.created_at as string).getTime()) / 86400000);
      if (daysDiff >= (rule.days_overdue as number)) {
        const existing = await env.DB.prepare(
          "SELECT id FROM dunning_events WHERE rule_id=? AND order_id=?"
        ).bind(rule.id, order.id).first();
        if (existing) continue;
        const evId = uid();
        await env.DB.prepare(
          "INSERT INTO dunning_events (id,rule_id,client_id,order_id,action_taken,notes) VALUES (?,?,?,?,?,?)"
        ).bind(evId, rule.id, order.client_id, order.id, rule.action,
          `${daysDiff} days overdue — ₹${order.grand_total}`).run();
        await pushNotification(env, "finance_admin",
          `Dunning ${rule.action}: ${order.client_name} order ${order.id} is ${daysDiff} days overdue`);
        triggered++;
      }
    }
  }
  await audit(env, user, "RUN_DUNNING", "dunning", "global", undefined, `triggered:${triggered}`);
  return json({ok:true, triggered});
}

async function handleListDunningEvents(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(
    "SELECT de.*,c.name as client_name FROM dunning_events de LEFT JOIN clients c ON de.client_id=c.id ORDER BY de.created_at DESC LIMIT 100"
  ).all();
  return json(results);
}

// ════════════════════════════════════════════════════════════════════
// Feature 18: CSV IMPORT
// ════════════════════════════════════════════════════════════════════

async function handleImportInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  let rows: Record<string,unknown>[];
  try { rows = await request.json() as Record<string,unknown>[]; }
  catch { return json({error:"Invalid JSON body"}, 400); }

  if (!Array.isArray(rows) || !rows.length) return json({error:"No rows provided"}, 400);

  let success = 0; const errors: string[] = [];

  // Validate rows and split valid/invalid upfront
  const validRows: { row: Record<string,unknown>; idx: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.sku || !row.name) { errors.push(`Row ${i+1}: sku and name are required`); }
    else validRows.push({ row, idx: i });
  }

  if (validRows.length === 0) return json({success: 0, failed: errors.length, errors});

  // One query to find which SKUs already exist — counts as 1 subrequest
  const skus = validRows.map(v => String(v.row.sku));
  const ph = skus.map(() => '?').join(',');
  const existingSkus = new Set<string>();
  try {
    const res = await env.DB.prepare(`SELECT sku FROM inventory WHERE sku IN (${ph})`).bind(...skus).all();
    for (const r of res.results) existingSkus.add(String((r as Record<string,unknown>).sku));
  } catch { /* treat all as new if lookup fails */ }

  // Build batch statements in chunks of 200 — each batch() call = 1 subrequest
  const CHUNK = 200;
  for (let c = 0; c < validRows.length; c += CHUNK) {
    const chunk = validRows.slice(c, c + CHUNK);
    const stmts: ReturnType<typeof env.DB.prepare>[] = [];
    const chunkIdxMap: number[] = []; // track original row index per stmt

    for (const { row, idx } of chunk) {
      const sku = String(row.sku);
      if (existingSkus.has(sku)) {
        stmts.push(env.DB.prepare(
          `UPDATE inventory SET name=?,stock=?,unit_price=?,category=?,brand=?,gst_rate=?,reorder_level=?,max_stock=? WHERE sku=?`
        ).bind(
          row.name, Number(row.stock)||0, Number(row.unit_price)||0,
          row.category||"General", row.brand||"",
          Number(row.gst_rate)||18, Number(row.reorder_level)||10, Number(row.max_stock)||500,
          sku
        ));
      } else {
        stmts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO inventory (sku,name,stock,unit_price,category,brand,gst_rate,reorder_level,max_stock) VALUES (?,?,?,?,?,?,?,?,?)`
        ).bind(
          sku, row.name, Number(row.stock)||0, Number(row.unit_price)||0,
          row.category||"General", row.brand||"",
          Number(row.gst_rate)||18, Number(row.reorder_level)||10, Number(row.max_stock)||500
        ));
        existingSkus.add(sku);
      }
      chunkIdxMap.push(idx);
    }

    try {
      await env.DB.batch(stmts);
      success += stmts.length;
    } catch (e) {
      // Batch failed — record error for each row in this chunk and fall back to individual inserts
      for (let i = 0; i < stmts.length; i++) {
        errors.push(`Row ${chunkIdxMap[i]+1} (${chunk[i].row.sku}): ${String(e)}`);
      }
    }
  }

  try {
    const jobId = uid();
    await env.DB.prepare(
      "INSERT INTO import_jobs (id,type,total,success_count,failed_count,errors,created_by) VALUES (?,?,?,?,?,?,?)"
    ).bind(jobId, "inventory", rows.length, success, errors.length, JSON.stringify(errors), user!.sub).run();
  } catch { /* non-fatal — job log table may be missing */ }

  return json({success, failed: errors.length, errors});
}

async function handleImportOrders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","client_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const rows = await request.json() as Record<string,unknown>[];
  let success = 0; const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.client_id || !row.grand_total) { errors.push(`Row ${i+1}: client_id and grand_total required`); continue; }
    try {
      const orderId = (row.id as string) || `SP-IMP-${Math.floor(Math.random()*9000+1000)}`;
      await env.DB.prepare(
        "INSERT OR IGNORE INTO orders (id,client_id,status,grand_total,subtotal,gst,notes) VALUES (?,?,'DRAFT',?,?,?,?)"
      ).bind(orderId, row.client_id, row.grand_total, row.subtotal||row.grand_total, row.gst||0, row.notes||"Imported").run();
      success++;
    } catch (e) {
      errors.push(`Row ${i+1}: ${String(e)}`);
    }
  }
  const jobId = uid();
  await env.DB.prepare(
    "INSERT INTO import_jobs (id,type,total,success_count,failed_count,errors,created_by) VALUES (?,?,?,?,?,?,?)"
  ).bind(jobId, "orders", rows.length, success, errors.length, JSON.stringify(errors), user!.sub).run();
  return json({job_id: jobId, success, failed: errors.length, errors});
}

async function handleImportVendors(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (user!.role !== "super_admin") return json({error:"Forbidden — super admin only"}, 403);

  let body: {rows: Record<string,unknown>[]; overwrite?: boolean};
  try { body = await request.json() as {rows: Record<string,unknown>[]; overwrite?: boolean}; }
  catch { return json({error:"Invalid JSON body"}, 400); }

  const { rows, overwrite = false } = body;
  if (!Array.isArray(rows) || !rows.length) return json({error:"No rows provided"}, 400);

  // Build name→id map of existing vendors
  const existingRes = await env.DB.prepare("SELECT id, name FROM vendors").all();
  const nameToId = new Map<string, string>();
  for (const v of existingRes.results) {
    nameToId.set(String((v as Record<string,unknown>).name).trim().toLowerCase(), String((v as Record<string,unknown>).id));
  }

  let success = 0, skipped = 0;
  const errors: string[] = [];

  const validRows: {row: Record<string,unknown>; idx: number; existingId: string|null}[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name || !String(row.name).trim()) { errors.push(`Row ${i+1}: name is required`); continue; }
    const normName = String(row.name).trim().toLowerCase();
    const existingId = nameToId.get(normName) || null;
    if (existingId && !overwrite) { skipped++; continue; }
    validRows.push({row, idx: i, existingId});
  }

  const CHUNK = 200;
  for (let c = 0; c < validRows.length; c += CHUNK) {
    const chunk = validRows.slice(c, c + CHUNK);
    const stmts: ReturnType<typeof env.DB.prepare>[] = [];
    const chunkIdxMap: number[] = [];

    for (const {row, idx, existingId} of chunk) {
      const name     = String(row.name).trim();
      const category = String(row.category || "General").trim();
      const email    = String(row.contact_email || row.email || "").trim();
      const phone    = String(row.contact_phone || row.phone || "").trim();
      const location = String(row.location || "").trim();
      const address  = String(row.address || "").trim();
      const lead     = Number(row.avg_lead_days) || 3;
      const rating   = Math.min(5, Math.max(0, Number(row.rating) || 4.0));

      if (existingId) {
        stmts.push(env.DB.prepare(
          `UPDATE vendors SET name=?,category=?,contact_email=?,contact_phone=?,location=?,address=?,avg_lead_days=?,rating=? WHERE id=?`
        ).bind(name, category, email, phone, location, address, lead, rating, existingId));
      } else {
        const newId = `V-${uid().slice(0,8).toUpperCase()}`;
        stmts.push(env.DB.prepare(
          `INSERT OR IGNORE INTO vendors (id,name,category,contact_email,contact_phone,location,address,avg_lead_days,rating) VALUES (?,?,?,?,?,?,?,?,?)`
        ).bind(newId, name, category, email, phone, location, address, lead, rating));
      }
      chunkIdxMap.push(idx);
    }

    if (!stmts.length) continue;
    try {
      await env.DB.batch(stmts);
      success += stmts.length;
    } catch (e) {
      for (let i = 0; i < stmts.length; i++) {
        errors.push(`Row ${chunkIdxMap[i]+1}: ${String(e)}`);
      }
    }
  }

  try {
    const jobId = uid();
    await env.DB.prepare(
      "INSERT INTO import_jobs (id,type,total,success_count,failed_count,errors,created_by) VALUES (?,?,?,?,?,?,?)"
    ).bind(jobId, "vendors", rows.length, success, errors.length, JSON.stringify(errors), user!.sub).run();
  } catch { /* non-fatal */ }

  return json({success, skipped, failed: errors.length, errors});
}

async function handleListImportJobs(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  try {
    const {results} = await env.DB.prepare(
      "SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50"
    ).all();
    return json(results);
  } catch {
    return json([]); // table may not exist yet — show the empty state, don't error
  }
}

// ════════════════════════════════════════════════════════════════════
// Feature 19: ORDER / PO TEMPLATES
// ════════════════════════════════════════════════════════════════════

async function handleListOrderTemplates(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(
    "SELECT * FROM order_templates ORDER BY created_at DESC"
  ).all();
  return json(results);
}

async function handleCreateOrderTemplate(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  if (!body.name) return json({error:"Template name required"}, 400);
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO order_templates (id,name,client_id,items,notes,created_by) VALUES (?,?,?,?,?,?)"
  ).bind(id, body.name, body.client_id||null, JSON.stringify(body.items||[]), body.notes||null, user!.sub).run();
  return json({id}, 201);
}

async function handleDeleteOrderTemplate(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  await env.DB.prepare("DELETE FROM order_templates WHERE id=?").bind(id).run();
  return json({id});
}

async function handleListPOTemplates(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(
    "SELECT * FROM po_templates ORDER BY created_at DESC"
  ).all();
  return json(results);
}

async function handleCreatePOTemplate(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  if (!body.name) return json({error:"Template name required"}, 400);
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO po_templates (id,name,vendor_id,items,notes,created_by) VALUES (?,?,?,?,?,?)"
  ).bind(id, body.name, body.vendor_id||null, JSON.stringify(body.items||[]), body.notes||null, user!.sub).run();
  return json({id}, 201);
}

async function handleDeletePOTemplate(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  await env.DB.prepare("DELETE FROM po_templates WHERE id=?").bind(id).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// Feature 20: VENDOR FEEDBACK
// ════════════════════════════════════════════════════════════════════

async function handleListVendorFeedback(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const vendorId = path.split("/")[3];
  const {results} = await env.DB.prepare(
    "SELECT * FROM vendor_feedback WHERE vendor_id=? ORDER BY created_at DESC"
  ).bind(vendorId).all();
  return json(results);
}

async function handleCreateVendorFeedback(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const vendorId = path.split("/")[3];
  const body = await request.json() as Record<string,unknown>;
  const id = uid();
  const q = Math.min(5, Math.max(1, Number(body.quality_rating)||3));
  const d = Math.min(5, Math.max(1, Number(body.delivery_rating)||3));
  const s = Math.min(5, Math.max(1, Number(body.service_rating)||3));
  await env.DB.prepare(
    "INSERT INTO vendor_feedback (id,vendor_id,po_id,grn_id,quality_rating,delivery_rating,service_rating,comments,submitted_by) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(id, vendorId, body.po_id||null, body.grn_id||null, q, d, s, body.comments||null, user!.sub).run();

  const {results: allFb} = await env.DB.prepare(
    "SELECT quality_rating,delivery_rating,service_rating FROM vendor_feedback WHERE vendor_id=?"
  ).bind(vendorId).all();
  const avgRating = allFb.length
    ? allFb.reduce((sum, r: Record<string,unknown>) =>
        sum + ((r.quality_rating as number) + (r.delivery_rating as number) + (r.service_rating as number)) / 3, 0) / allFb.length
    : (q + d + s) / 3;
  await env.DB.prepare("UPDATE vendors SET rating=? WHERE id=?").bind(Math.round(avgRating * 10) / 10, vendorId).run();
  await audit(env, user, "FEEDBACK", "vendor", vendorId, undefined, `rating:${avgRating.toFixed(1)}`);
  return json({id, avg_rating: avgRating}, 201);
}

// ════════════════════════════════════════════════════════════════════
// Feature 21: SLA TRACKING
// ════════════════════════════════════════════════════════════════════

async function handleListSLARules(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM sla_rules WHERE active=1 ORDER BY max_hours").all();
  return json(results);
}

async function handleCreateSLARule(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  const id = uid();
  await env.DB.prepare(
    "INSERT INTO sla_rules (id,name,entity_type,trigger_status,max_hours,action) VALUES (?,?,?,?,?,?)"
  ).bind(id, body.name, body.entity_type||"order", body.trigger_status, body.max_hours, body.action||"NOTIFY").run();
  return json({id}, 201);
}

async function handleListSLABreaches(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT sb.*,sr.name as rule_name,sr.max_hours,sr.trigger_status
    FROM sla_breaches sb LEFT JOIN sla_rules sr ON sb.rule_id=sr.id
    WHERE sb.status='OPEN' ORDER BY sb.breached_at DESC LIMIT 100
  `).all();
  return json(results);
}

async function handleSLACheck(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const {results: rules} = await env.DB.prepare("SELECT * FROM sla_rules WHERE active=1").all();
  let newBreaches = 0;

  for (const rule of rules as Record<string,unknown>[]) {
    const {results: entities} = await env.DB.prepare(`
      SELECT id, status, updated_at FROM orders
      WHERE status=? AND (julianday('now') - julianday(updated_at)) * 24 > ?
    `).bind(rule.trigger_status, rule.max_hours).all();

    for (const entity of entities as Record<string,unknown>[]) {
      const existing = await env.DB.prepare(
        "SELECT id FROM sla_breaches WHERE rule_id=? AND entity_id=? AND status='OPEN'"
      ).bind(rule.id, entity.id).first();
      if (existing) continue;

      const breachId = uid();
      await env.DB.prepare(
        "INSERT INTO sla_breaches (id,rule_id,entity_id,entity_type,status) VALUES (?,?,?,?,?)"
      ).bind(breachId, rule.id, entity.id, rule.entity_type||"order", "OPEN").run();
      await pushNotification(env, "ops_admin",
        `SLA breach: ${rule.name} — order ${entity.id} exceeded ${rule.max_hours}h in status ${rule.trigger_status}`);
      newBreaches++;
    }
  }
  return json({ok:true, new_breaches: newBreaches});
}

// ════════════════════════════════════════════════════════════════════
// Feature 22: TWO-FACTOR AUTHENTICATION
// ════════════════════════════════════════════════════════════════════

async function handleToggle2FA(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const targetId = path.split("/")[3];
  if (user!.sub !== targetId && !["super_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  const enabled = body.two_fa_enabled ? 1 : 0;
  await env.DB.prepare("UPDATE users SET two_fa_enabled=? WHERE id=?").bind(enabled, targetId).run();
  await audit(env, user, enabled ? "ENABLE_2FA" : "DISABLE_2FA", "user", targetId);
  return json({id: targetId, two_fa_enabled: enabled});
}

// ════════════════════════════════════════════════════════════════════
// Feature 23: CLIENT CREDIT LIMITS
// ════════════════════════════════════════════════════════════════════

async function handleGetClientCredit(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const clientId = path.split("/")[3];
  const cs = clientScopeDenied(user!, clientId); if (cs) return cs;
  const row = await env.DB.prepare(
    "SELECT id,name,credit_limit,credit_used FROM clients WHERE id=?"
  ).bind(clientId).first() as Record<string,unknown>|null;
  if (!row) return json({error:"Client not found"}, 404);
  return json({...row, credit_available: (row.credit_limit as number) - (row.credit_used as number)});
}

async function handleCreditAdjust(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","finance_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const clientId = path.split("/")[3];
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (body.credit_limit !== undefined) { fields.push("credit_limit=?"); vals.push(body.credit_limit); }
  if (body.credit_used  !== undefined) { fields.push("credit_used=?");  vals.push(body.credit_used); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(clientId);
  await env.DB.prepare(`UPDATE clients SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  await audit(env, user, "CREDIT_ADJUST", "client", clientId, undefined, JSON.stringify(body));
  return json({id: clientId});
}

// ════════════════════════════════════════════════════════════════════
// Feature 24: MULTI-LEVEL APPROVAL CHAINS
// ════════════════════════════════════════════════════════════════════

async function handleListApprovalChains(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results: chains} = await env.DB.prepare(
    "SELECT * FROM approval_chains WHERE active=1 ORDER BY min_amount"
  ).all();
  for (const chain of chains as Record<string,unknown>[]) {
    const {results: steps} = await env.DB.prepare(
      "SELECT * FROM approval_chain_steps WHERE chain_id=? ORDER BY step_order"
    ).bind(chain.id).all();
    chain.steps = steps;
  }
  return json(chains);
}

async function handleCreateApprovalChain(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Record<string,unknown>;
  if (!body.name) return json({error:"Chain name required"}, 400);
  const chainId = uid();
  await env.DB.prepare(
    "INSERT INTO approval_chains (id,name,entity_type,min_amount) VALUES (?,?,?,?)"
  ).bind(chainId, body.name, body.entity_type||"order", body.min_amount||0).run();

  const steps = (body.steps as Array<{role:string;label?:string}>) || [];
  for (let i = 0; i < steps.length; i++) {
    const stepId = uid();
    await env.DB.prepare(
      "INSERT INTO approval_chain_steps (id,chain_id,step_order,role,label) VALUES (?,?,?,?,?)"
    ).bind(stepId, chainId, i+1, steps[i].role, steps[i].label||null).run();
  }
  await audit(env, user, "CREATE", "approval_chain", chainId, undefined, body.name as string);
  return json({id: chainId}, 201);
}

async function handleListApprovalChainInstances(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT aci.*,ac.name as chain_name,ac.min_amount
    FROM approval_chain_instances aci
    LEFT JOIN approval_chains ac ON aci.chain_id=ac.id
    WHERE aci.status='PENDING'
    ORDER BY aci.created_at DESC LIMIT 50
  `).all();
  return json(results);
}

async function handleApprovalChainAct(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const instanceId = path.split("/")[3];
  const body = await request.json() as Record<string,unknown>;
  const action = (body.action as string) || "APPROVED";

  const instance = await env.DB.prepare(
    "SELECT * FROM approval_chain_instances WHERE id=?"
  ).bind(instanceId).first() as Record<string,unknown>|null;
  if (!instance) return json({error:"Instance not found"}, 404);

  const actionId = uid();
  await env.DB.prepare(
    "INSERT INTO approval_chain_actions (id,instance_id,step_order,actor_id,actor_name,action,comments) VALUES (?,?,?,?,?,?,?)"
  ).bind(actionId, instanceId, instance.current_step, user!.sub, user!.name, action, body.comments||null).run();

  if (action === "REJECTED") {
    await env.DB.prepare(
      "UPDATE approval_chain_instances SET status='REJECTED',updated_at=datetime('now') WHERE id=?"
    ).bind(instanceId).run();
    await env.DB.prepare("UPDATE orders SET status='CANCELLED' WHERE id=?").bind(instance.entity_id).run();
    await pushNotification(env, null, `Approval chain rejected for order ${instance.entity_id} by ${user!.name}`);
    return json({ok:true, status:"REJECTED"});
  }

  const {results: steps} = await env.DB.prepare(
    "SELECT * FROM approval_chain_steps WHERE chain_id=? ORDER BY step_order"
  ).bind(instance.chain_id).all();
  const totalSteps = steps.length;
  const nextStep = (instance.current_step as number) + 1;

  if (nextStep > totalSteps) {
    await env.DB.prepare(
      "UPDATE approval_chain_instances SET status='APPROVED',current_step=?,updated_at=datetime('now') WHERE id=?"
    ).bind(nextStep - 1, instanceId).run();
    await env.DB.prepare(
      "UPDATE orders SET status='APPROVED' WHERE id=? AND status='PENDING_APPROVAL'"
    ).bind(instance.entity_id).run();
    await pushNotification(env, null, `Order ${instance.entity_id} fully approved via chain`);
    await audit(env, user, "CHAIN_APPROVED", "order", instance.entity_id as string);
    return json({ok:true, status:"APPROVED", all_steps_done:true});
  } else {
    await env.DB.prepare(
      "UPDATE approval_chain_instances SET current_step=?,updated_at=datetime('now') WHERE id=?"
    ).bind(nextStep, instanceId).run();
    const nextStepRow = steps.find((s: Record<string,unknown>) => s.step_order === nextStep) as Record<string,unknown>|undefined;
    await pushNotification(env, nextStepRow?.role as string || null,
      `Approval needed for order ${instance.entity_id} — step ${nextStep} of ${totalSteps}`);
    return json({ok:true, status:"PENDING", next_step: nextStep});
  }
}

// ════════════════════════════════════════════════════════════════════
// FEATURE 16: DELIVERY ROUTE OPTIMIZATION
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// STAFF MASTER
// ════════════════════════════════════════════════════════════════════

async function handleListStaff(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(
    "SELECT * FROM staff ORDER BY name"
  ).all();
  return json(results);
}

async function handleAddStaff(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  if (!body.name) return json({error:"name required"}, 400);
  const id = `staff-${uid().slice(0,8)}`;
  await env.DB.prepare("INSERT INTO staff (id,name,phone,role,active) VALUES (?,?,?,?,1)")
    .bind(id, body.name, body.phone||null, body.role||'delivery_staff').run();
  return json({id}, 201);
}

async function handlePatchStaff(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = []; const vals: unknown[] = [];
  if (body.name   !== undefined) { fields.push("name=?");   vals.push(body.name); }
  if (body.phone  !== undefined) { fields.push("phone=?");  vals.push(body.phone||null); }
  if (body.role   !== undefined) { fields.push("role=?");   vals.push(body.role); }
  if (body.active !== undefined) { fields.push("active=?"); vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE staff SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// TODAY'S DELIVERY SCHEDULE
// ════════════════════════════════════════════════════════════════════

async function handleTodaySchedule(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const today = new Date().toISOString().slice(0,10);
  const {results} = await env.DB.prepare(`
    SELECT
      dc.id, dc.status, dc.dc_number, dc.scheduled_time,
      dc.vehicle_no, dc.driver_name, dc.delivered_at,
      dc.staff_id, s.name as staff_name,
      dc.order_id, c.name as client_name,
      COALESCE(c.zone,'') as zone,
      dc.total_qty, dc.delivered_qty,
      dc.expected_delivery_date
    FROM delivery_challans dc
    LEFT JOIN orders o ON dc.order_id=o.id
    LEFT JOIN clients c ON o.client_id=c.id
    LEFT JOIN staff s ON dc.staff_id=s.id
    WHERE (date(dc.dispatched_at)=? OR date(dc.expected_delivery_date)=? OR dc.status='SCHEDULED')
    ORDER BY dc.scheduled_time ASC, s.name ASC
  `).bind(today, today).all();
  return json(results);
}

async function handlePatchDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const staffOnly = requireInternal(user!); if (staffOnly) return staffOnly; // editing a challan is 4SYZ-only
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = []; const vals: unknown[] = [];
  if (body.dc_number       !== undefined) { fields.push("dc_number=?");       vals.push(body.dc_number||null); }
  if (body.staff_id        !== undefined) { fields.push("staff_id=?");        vals.push(body.staff_id||null); }
  if (body.scheduled_time  !== undefined) { fields.push("scheduled_time=?");  vals.push(body.scheduled_time||null); }
  if (body.scheduled_date  !== undefined) { fields.push("scheduled_date=?");  vals.push(body.scheduled_date||null); }
  if (body.reminder_armed  !== undefined) { fields.push("reminder_armed=?");  vals.push(body.reminder_armed===null ? null : (body.reminder_armed ? 1 : 0)); }
  if (body.driver_name     !== undefined) { fields.push("driver_name=?");     vals.push(body.driver_name||null); }
  if (body.vehicle_no      !== undefined) { fields.push("vehicle_no=?");      vals.push(body.vehicle_no||null); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE delivery_challans SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// STANDING ORDERS — list, skip a cycle, materialize a cycle into a real
// order (Delivery Calendar Phase 2: recurring "ghost" projections)
// ════════════════════════════════════════════════════════════════════

async function handleListStandingOrders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  try {
    // Aliases keep the older client-portal standing-orders card working too.
    let sql = `SELECT so.*, so.name AS description, so.next_run_date AS next_run,
      CASE WHEN so.active=1 THEN 'Active' ELSE 'Paused' END AS status,
      c.name AS client_name
      FROM standing_orders so LEFT JOIN clients c ON c.id=so.client_id WHERE so.active=1`;
    const binds: string[] = [];
    if (isClientRole) {
      if (!user!.client_id) return json([]);
      sql += " AND so.client_id=?"; binds.push(user!.client_id);
    }
    const {results} = await env.DB.prepare(sql).bind(...binds).all();
    const sos = results as Record<string,unknown>[];
    for (const so of sos) {
      try {
        const ev = await env.DB.prepare(
          `SELECT cycle_date, action, order_id FROM standing_order_events WHERE so_id=? AND cycle_date >= date('now','-90 days')`
        ).bind(so.id).all();
        so.events = ev.results;
      } catch { so.events = []; }
    }
    return json(sos);
  } catch { return json([]); }
}

function soCycleGuard(user: NonNullable<Awaited<ReturnType<typeof getUser>>>, so: Record<string,unknown>): Response | null {
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user.role);
  if (isClientRole && user.client_id !== so.client_id) return json({error:"Forbidden"}, 403);
  return null;
}

async function handleSkipStandingOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const soId = path.split("/").slice(-2)[0];
  const soRow = await env.DB.prepare("SELECT client_id FROM standing_orders WHERE id=?").bind(soId).first() as Record<string,unknown>|null;
  if (!soRow) return json({error:"Not found"}, 404);
  const scoped = clientScopeDenied(user!, String(soRow.client_id||"")); if (scoped) return scoped;
  const body = await request.json() as {date?:string};
  const date = String(body.date||'').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({error:"date (YYYY-MM-DD) required"}, 400);
  const so = await env.DB.prepare("SELECT * FROM standing_orders WHERE id=?").bind(soId).first() as Record<string,unknown>|null;
  if (!so) return json({error:"Standing order not found"}, 404);
  const forbidden = soCycleGuard(user!, so); if (forbidden) return forbidden;
  try {
    await env.DB.prepare("INSERT OR IGNORE INTO standing_order_events (id,so_id,cycle_date,action,actor_name) VALUES (?,?,?,?,?)")
      .bind(uid(), soId, date, "SKIPPED", user!.name).run();
  } catch(e) { return json({error:String(e)}, 500); }
  await audit(env, user, "UPDATE", "standing_order", soId, undefined, `skip:${date}`);
  return json({ok:true});
}

async function handleMaterializeStandingOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const soId = path.split("/").slice(-2)[0];
  const soRow = await env.DB.prepare("SELECT client_id FROM standing_orders WHERE id=?").bind(soId).first() as Record<string,unknown>|null;
  if (!soRow) return json({error:"Not found"}, 404);
  const scoped = clientScopeDenied(user!, String(soRow.client_id||"")); if (scoped) return scoped;
  const body = await request.json() as {date?:string};
  const date = String(body.date||'').slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({error:"date (YYYY-MM-DD) required"}, 400);
  const so = await env.DB.prepare("SELECT * FROM standing_orders WHERE id=?").bind(soId).first() as Record<string,unknown>|null;
  if (!so) return json({error:"Standing order not found"}, 404);
  const forbidden = soCycleGuard(user!, so); if (forbidden) return forbidden;

  const existing = await env.DB.prepare("SELECT order_id FROM standing_order_events WHERE so_id=? AND cycle_date=?")
    .bind(soId, date).first() as Record<string,string>|null;
  if (existing) return json({error:`This cycle is already resolved${existing.order_id?` (order ${existing.order_id})`:''}`}, 409);

  // Build order items from the standing order, pricing from the live catalogue.
  let items: Array<{sku:string;name?:string;qty:number}> = [];
  try { items = JSON.parse(String(so.items||'[]')); } catch { /* fall through */ }
  if (!items.length) return json({error:"Standing order has no items"}, 400);
  const priced: Array<{sku:string;name:string;qty:number;unit_price:number}> = [];
  for (const it of items) {
    const inv = await env.DB.prepare("SELECT name, unit_price FROM inventory WHERE sku=?")
      .bind(it.sku).first() as Record<string,unknown>|null;
    // Client-specific price lives on client_catalog (not inventory); prefer it when set.
    let price = Number(inv?.unit_price || 0);
    try {
      const cc = await env.DB.prepare("SELECT client_price FROM client_catalog WHERE client_id=? AND sku=?")
        .bind(so.client_id, it.sku).first() as Record<string,unknown>|null;
      if (cc && cc.client_price != null) price = Number(cc.client_price);
    } catch { /* client_catalog / client_price not present — use catalogue price */ }
    priced.push({ sku: it.sku, name: String(inv?.name || it.name || it.sku), qty: Number(it.qty)||1, unit_price: price });
  }

  // Reuse the full order pipeline — approval rules, stock reservation,
  // history and notifications all apply exactly as for a manual order.
  const synth = new Request("http://internal/api/orders", { method:"POST",
    headers: { "Content-Type":"application/json", "Authorization": request.headers.get("Authorization") || "" },
    body: JSON.stringify({ client_id: so.client_id, items: priced, need_by_date: date, order_period: date.slice(0,7),
      notes: `Recurring — created from standing order ${soId} (${so.name}) for ${date}` }) });
  const res = await handleCreateOrder(synth, env);
  if (res.status >= 400) return res;
  const created = await res.json() as {id:string; status:string; grand_total:number};

  try {
    await env.DB.prepare("INSERT OR IGNORE INTO standing_order_events (id,so_id,cycle_date,action,order_id,actor_name) VALUES (?,?,?,?,?,?)")
      .bind(uid(), soId, date, "CREATED", created.id, user!.name).run();
  } catch { /* ignore */ }
  const next = nextCycleDate(date, String(so.frequency||'MONTHLY'));
  await env.DB.prepare("UPDATE standing_orders SET last_run_date=?, next_run_date=? WHERE id=?").bind(date, next, soId).run();
  await audit(env, user, "CREATE", "standing_order_run", soId, undefined, `order:${created.id},cycle:${date}`);
  return json({ ok:true, order_id: created.id, order_status: created.status, grand_total: created.grand_total, next_run_date: next }, 201);
}

function nextCycleDate(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const f = freq.toUpperCase();
  if (f.startsWith("DAI")) d.setUTCDate(d.getUTCDate()+1);
  else if (f.startsWith("WEEK")) d.setUTCDate(d.getUTCDate()+7);
  else if (f.startsWith("FORT") || f === "BIWEEKLY") d.setUTCDate(d.getUTCDate()+14);
  else if (f.startsWith("QUART")) d.setUTCMonth(d.getUTCMonth()+3);
  else d.setUTCMonth(d.getUTCMonth()+1);
  return d.toISOString().slice(0,10);
}

// ════════════════════════════════════════════════════════════════════
// DELIVERY REMINDERS — global policy, per-DC overrides, daily cron
// (Delivery Calendar Phase 3)
// ════════════════════════════════════════════════════════════════════

interface DcalPolicy { email_t1: boolean; dayof: boolean; ghost_nudge: boolean; capacity: number }
const DCAL_POLICY_DEFAULT: DcalPolicy = { email_t1: true, dayof: true, ghost_nudge: true, capacity: 6 };

async function getDcalPolicy(env: Env): Promise<DcalPolicy> {
  try {
    const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key='dcal_policy'").first() as Record<string,string>|null;
    if (row?.value) return { ...DCAL_POLICY_DEFAULT, ...JSON.parse(row.value) };
  } catch { /* fall through */ }
  return { ...DCAL_POLICY_DEFAULT };
}

async function handleGetDcalSettings(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  return json(await getDcalPolicy(env));
}

async function handleSaveDcalSettings(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!['super_admin','ops_admin'].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const body = await request.json() as Partial<DcalPolicy>;
  const cur = await getDcalPolicy(env);
  const merged: DcalPolicy = {
    email_t1:    body.email_t1    !== undefined ? !!body.email_t1    : cur.email_t1,
    dayof:       body.dayof       !== undefined ? !!body.dayof       : cur.dayof,
    ghost_nudge: body.ghost_nudge !== undefined ? !!body.ghost_nudge : cur.ghost_nudge,
    capacity:    body.capacity    !== undefined ? Math.max(1, Math.min(99, Number(body.capacity)||6)) : cur.capacity,
  };
  await env.DB.prepare("INSERT INTO app_settings (key,value) VALUES ('dcal_policy',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(JSON.stringify(merged)).run();
  await audit(env, user, "UPDATE", "settings", "dcal_policy", undefined, JSON.stringify(merged));
  return json({ ok: true, ...merged });
}

async function handleRunDcalReminders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (['client_admin','client_approver','client_user','vendor','vendor_user'].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const summary = await runDeliveryReminders(env);
  return json({ ok: true, ...summary });
}

// The daily sweep. Also invoked manually via "Send reminders now".
async function runDeliveryReminders(env: Env): Promise<{t1:number; dayof:number; overdue:number; ghosts:number}> {
  const pol = await getDcalPolicy(env);
  const summary = { t1: 0, dayof: 0, overdue: 0, ghosts: 0 };
  const effDate = "COALESCE(dc.scheduled_date, date(dc.dispatched_at), date(dc.created_at))";
  const live = "dc.status NOT IN ('DELIVERED','CANCELLED','RETURNED')";

  // Recipients for email (best-effort; in-app notifications always fire)
  let emails: string[] = [];
  try {
    const { results } = await env.DB.prepare("SELECT email FROM users WHERE role IN ('super_admin','ops_admin') AND active=1").all();
    emails = (results as Record<string,string>[]).map(r => r.email).filter(Boolean);
  } catch { /* ignore */ }

  // T-1: due tomorrow, policy on (or forced per-DC), not already reminded today
  try {
    const { results } = await env.DB.prepare(`
      SELECT dc.id, dc.dc_number, dc.scheduled_time, c.name AS client_name
      FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id LEFT JOIN clients c ON o.client_id=c.id
      WHERE ${live} AND ${effDate} = date('now','+1 day')
        AND (dc.reminder_sent_at IS NULL OR date(dc.reminder_sent_at) < date('now'))
        AND (dc.reminder_armed = 1 OR (dc.reminder_armed IS NULL AND ?=1))`).bind(pol.email_t1 ? 1 : 0).all();
    const rows = results as Record<string,unknown>[];
    for (const r of rows) {
      await pushNotification(env, "ops_admin", `⏰ Delivery tomorrow: ${r.dc_number||r.id} — ${r.client_name||'client'}${r.scheduled_time?` at ${r.scheduled_time}`:''}`);
      await env.DB.prepare("UPDATE delivery_challans SET reminder_sent_at=datetime('now') WHERE id=?").bind(r.id).run();
      summary.t1++;
    }
    if (rows.length && emails.length) {
      const lines = rows.map(r => `• ${r.dc_number||r.id} — ${r.client_name||'client'}${r.scheduled_time?` at ${r.scheduled_time}`:''}`).join('\n');
      for (const to of emails) {
        await sendEmail(env, to, `Smart Pantry — ${rows.length} deliver${rows.length===1?'y':'ies'} due tomorrow`,
          `Deliveries scheduled for tomorrow:\n\n${lines}\n\nOpen the Delivery Calendar to review or reschedule.`);
      }
    }
  } catch { /* ignore */ }

  // Day-of digest
  if (pol.dayof) {
    try {
      const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM delivery_challans dc
        WHERE ${live} AND ${effDate} = date('now') AND COALESCE(dc.reminder_armed,1) != 0`).first() as Record<string,number>|null;
      if (row?.c) { await pushNotification(env, "ops_admin", `🚚 ${row.c} deliver${row.c===1?'y':'ies'} due today — see the Delivery Calendar`); summary.dayof = row.c; }
    } catch { /* ignore */ }
  }

  // Overdue (at-risk) digest
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM delivery_challans dc
      WHERE ${live} AND ${effDate} < date('now')`).first() as Record<string,number>|null;
    if (row?.c) { await pushNotification(env, "ops_admin", `⚠️ ${row.c} deliver${row.c===1?'y is':'ies are'} past date and undelivered — at risk`); summary.overdue = row.c; }
  } catch { /* ignore */ }

  // Unconfirmed recurring cycles due within 2 days
  if (pol.ghost_nudge) {
    try {
      const { results } = await env.DB.prepare("SELECT * FROM standing_orders WHERE active=1").all();
      const today = new Date().toISOString().slice(0,10);
      const limit = new Date(Date.now() + 2*86400000).toISOString().slice(0,10);
      for (const so of results as Record<string,unknown>[]) {
        let k = String(so.next_run_date||'').slice(0,10);
        if (!k) continue;
        let guard = 0;
        while (k < today && guard++ < 400) k = nextCycleDate(k, String(so.frequency||'MONTHLY'));
        if (k > limit) continue;
        const ev = await env.DB.prepare("SELECT 1 FROM standing_order_events WHERE so_id=? AND cycle_date=?").bind(so.id, k).first();
        if (ev) continue;
        await pushNotification(env, "ops_admin", `◌ Recurring order "${so.name}" is due ${k} — create the order or skip the cycle`);
        summary.ghosts++;
      }
    } catch { /* ignore */ }
  }
  return summary;
}

// ════════════════════════════════════════════════════════════════════
// PORTER EXPENSES
// ════════════════════════════════════════════════════════════════════

async function handleListPorterExpenses(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT pe.*, c.name as client_name, s.name as staff_name
    FROM porter_expenses pe
    LEFT JOIN clients c ON pe.client_id=c.id
    LEFT JOIN staff s ON pe.staff_id=s.id
    ORDER BY pe.trip_date DESC, pe.created_at DESC
    LIMIT 100
  `).all();
  return json(results);
}

async function handleAddPorterExpense(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  if (!body.trip_date || !body.amount) return json({error:"trip_date and amount required"}, 400);
  const id = uid();
  await env.DB.prepare("INSERT INTO porter_expenses (id,trip_date,route,amount,client_id,staff_id,notes) VALUES (?,?,?,?,?,?,?)")
    .bind(id, body.trip_date, body.route||null, body.amount, body.client_id||null, body.staff_id||null, body.notes||null).run();
  return json({id}, 201);
}

// ════════════════════════════════════════════════════════════════════
// DELIVERY RETURNS
// ════════════════════════════════════════════════════════════════════

async function handleListDeliveryReturns(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const dcId = url.searchParams.get("dc_id");
  let q = "SELECT dr.*, s.name as staff_name FROM delivery_returns dr LEFT JOIN staff s ON dr.staff_id=s.id WHERE 1=1";
  const params: string[] = [];
  if (dcId) { q += " AND dr.dc_id=?"; params.push(dcId); }
  q += " ORDER BY dr.returned_at DESC LIMIT 100";
  const {results} = await env.DB.prepare(q).bind(...params).all();
  return json(results);
}

async function handleAddDeliveryReturn(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  if (!body.dc_id || !body.sku || !body.qty_returned) return json({error:"dc_id, sku, qty_returned required"}, 400);
  const id = uid();
  await env.DB.prepare("INSERT INTO delivery_returns (id,dc_id,sku,item_name,qty_returned,reason,staff_id) VALUES (?,?,?,?,?,?,?)")
    .bind(id, body.dc_id, body.sku, body.item_name||null, body.qty_returned, body.reason||null, body.staff_id||null).run();
  // Restore stock for returned items
  await env.DB.prepare("UPDATE inventory SET stock=stock+? WHERE sku=?").bind(body.qty_returned, body.sku).run();
  // Update dc_items delivered qty
  await env.DB.prepare("UPDATE dc_items SET qty_delivered=MAX(0,qty_delivered-?) WHERE dc_id=? AND sku=?")
    .bind(body.qty_returned, body.dc_id, body.sku).run();
  await audit(env, user, "RETURN", "delivery", body.dc_id as string, undefined, `Returned ${body.qty_returned} x ${body.sku}`);
  return json({id}, 201);
}

// ════════════════════════════════════════════════════════════════════
// CONSOLIDATED REPORTS
// ════════════════════════════════════════════════════════════════════

async function handleRptConsolidatedOrders(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // All open orders grouped by item — procurement view
  const {results} = await env.DB.prepare(`
    SELECT
      oi.sku, oi.name as item_name,
      SUM(oi.qty) as total_ordered_qty,
      COALESCE(SUM(
        COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
          JOIN delivery_challans dc ON dci.dc_id=dc.id
          WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)
      ),0) as total_delivered_qty,
      SUM(oi.qty) - COALESCE(SUM(
        COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
          JOIN delivery_challans dc ON dci.dc_id=dc.id
          WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)
      ),0) as total_due_qty,
      COUNT(DISTINCT o.client_id) as client_count,
      GROUP_CONCAT(DISTINCT c.name) as clients
    FROM order_items oi
    JOIN orders o ON oi.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE o.status NOT IN ('CANCELLED','CLOSED','DRAFT')
    GROUP BY oi.sku, oi.name
    HAVING total_due_qty > 0
    ORDER BY total_due_qty DESC
  `).all();
  return json(results);
}

// Shared filter for the consolidated order report: date range (from/to on the
// order's created date) and/or an explicit set of order ids. Cancelled & draft
// orders are always excluded. Returns a WHERE clause fragment + ordered binds.
function orderConsolidationFilters(url: URL): { clause: string; binds: string[] } {
  const parts: string[] = ["o.status NOT IN ('CANCELLED','DRAFT')"];
  const binds: string[] = [];
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const orderIds = url.searchParams.get("order_ids");
  if (from) { parts.push("date(o.created_at) >= date(?)"); binds.push(from); }
  if (to)   { parts.push("date(o.created_at) <= date(?)"); binds.push(to); }
  if (orderIds) {
    const ids = orderIds.split(",").map(s => s.trim()).filter(Boolean).slice(0, 500);
    if (ids.length) { parts.push(`o.id IN (${ids.map(() => "?").join(",")})`); binds.push(...ids); }
  }
  return { clause: parts.join(" AND "), binds };
}

const OC_DELIVERED_SUBQUERY =
  "COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)";

// GET /api/reports/order-consolidation — per-product roll-up across every order
// in the selected period / order set: total ordered, delivered, and due, with
// the number of distinct orders and clients contributing (e.g. two clients each
// ordering 10 Coke → Coke: 20 ordered, 2 clients).
async function handleRptOrderConsolidation(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  // Cross-client consolidation is an internal (4SYZ) view.
  if (["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const url = new URL(request.url);
  const { clause, binds } = orderConsolidationFilters(url);
  const { results } = await env.DB.prepare(`
    SELECT oi.sku, oi.name as item_name,
      SUM(oi.qty) as ordered_qty,
      COALESCE(SUM(${OC_DELIVERED_SUBQUERY}),0) as delivered_qty,
      SUM(oi.qty) - COALESCE(SUM(${OC_DELIVERED_SUBQUERY}),0) as due_qty,
      COUNT(DISTINCT o.id) as order_count,
      COUNT(DISTINCT o.client_id) as client_count,
      GROUP_CONCAT(DISTINCT c.name) as clients
    FROM order_items oi
    JOIN orders o ON oi.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE ${clause}
    GROUP BY oi.sku, oi.name
    ORDER BY ordered_qty DESC, item_name ASC
  `).bind(...binds).all();
  return json(results);
}

// GET /api/reports/order-consolidation/drill?sku=… — the per-order / per-client
// breakdown behind one product row in the consolidated report.
async function handleRptOrderConsolidationDrill(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (["client_admin","client_approver","client_user","vendor_admin","vendor_user"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const url = new URL(request.url);
  const sku = url.searchParams.get("sku");
  if (!sku) return json({error:"sku required"}, 400);
  const { clause, binds } = orderConsolidationFilters(url);
  const { results } = await env.DB.prepare(`
    SELECT o.id as order_id, o.created_at as order_date, o.status,
      c.name as client_name,
      oi.qty as ordered_qty,
      ${OC_DELIVERED_SUBQUERY} as delivered_qty,
      oi.qty - ${OC_DELIVERED_SUBQUERY} as due_qty
    FROM order_items oi
    JOIN orders o ON oi.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE ${clause} AND oi.sku=?
    ORDER BY o.created_at DESC, c.name ASC
  `).bind(...binds, sku).all();
  return json(results);
}

async function handleRptConsolidatedDue(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT
      c.name as client_name,
      COALESCE(c.zone,'—') as zone,
      o.id as order_id,
      o.created_at as order_date,
      oi.sku, oi.name as item_name,
      oi.qty as ordered_qty,
      COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
        JOIN delivery_challans dc ON dci.dc_id=dc.id
        WHERE dc.order_id=o.id AND dci.sku=oi.sku),0) as delivered_qty,
      oi.qty - COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
        JOIN delivery_challans dc ON dci.dc_id=dc.id
        WHERE dc.order_id=o.id AND dci.sku=oi.sku),0) as due_qty,
      CAST(julianday('now') - julianday(o.created_at) AS INTEGER) as days_overdue
    FROM order_items oi
    JOIN orders o ON oi.order_id=o.id
    JOIN clients c ON o.client_id=c.id
    WHERE o.status NOT IN ('CANCELLED','CLOSED','DRAFT')
      AND oi.qty > COALESCE((SELECT SUM(dci.qty_delivered) FROM dc_items dci
        JOIN delivery_challans dc ON dci.dc_id=dc.id
        WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)
    ORDER BY days_overdue DESC, c.name ASC
  `).all();
  return json(results);
}

async function handleRptClientSummary(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare(`
    SELECT
      c.id, c.name as client_name, COALESCE(c.zone,'—') as zone,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(o.grand_total),0) as total_value,
      COUNT(DISTINCT CASE WHEN o.status='CLOSED' THEN o.id END) as closed_orders,
      COUNT(DISTINCT CASE WHEN o.status NOT IN ('CLOSED','CANCELLED','DRAFT') THEN o.id END) as open_orders,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CLOSED','CANCELLED','DRAFT') THEN
        o.grand_total - COALESCE((SELECT SUM(dci.qty_delivered * oi2.unit_price)
          FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
          JOIN order_items oi2 ON oi2.sku=dci.sku AND oi2.order_id=dc.order_id
          WHERE dc.order_id=o.id),0) END),0) as outstanding_value
    FROM clients c
    LEFT JOIN orders o ON o.client_id=c.id AND o.status != 'CANCELLED'
    WHERE c.active=1
    GROUP BY c.id, c.name, c.zone
    ORDER BY total_orders DESC
  `).all();
  return json(results);
}


// ── Feature 25: Client Store Inventory Tracking ────────────────────────────

async function handleListClientInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';

  // Resolve client_id: use JWT client_id for client roles, or ?client_id= for admins
  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  const clientId: string | null = isClientRole ? (user!.client_id || null) : url.searchParams.get('client_id');
  if (!clientId) return json([]);

  // category is sourced live from the master catalogue (inventory) so per-product
  // category edits show immediately; ci.category is only a fallback. The aliased
  // `category` is selected after ci.* so it wins in the returned row.
  let sql = `SELECT ci.*,
    COALESCE(NULLIF(inv.category,''), ci.category) AS category,
    CASE WHEN ci.qty_on_hand = 0 THEN 'out' WHEN ci.reorder_level > 0 AND ci.qty_on_hand <= ci.reorder_level THEN 'low' ELSE 'ok' END AS stock_status
    FROM client_inventory ci
    LEFT JOIN inventory inv ON inv.sku = ci.sku
    WHERE ci.client_id=?
    -- Only surface items in the client's allocated catalogue; if none is
    -- assigned, fall back to showing everything they hold (same rule as the
    -- master inventory). Prevents historically-delivered but unassigned items
    -- (e.g. from the DC backfill) leaking into the low/out-of-stock reorder view.
    AND (ci.sku IN (SELECT sku FROM client_catalog WHERE client_id=?)
         OR NOT EXISTS (SELECT 1 FROM client_catalog WHERE client_id=?))`;
  const binds: unknown[] = [clientId, clientId, clientId];
  if (q) { sql += ` AND (ci.item_name LIKE ? OR ci.sku LIKE ? OR COALESCE(inv.category, ci.category) LIKE ?)`; const like = `%${q}%`; binds.push(like,like,like); }
  sql += ` ORDER BY ci.item_name ASC`;

  try {
    const {results} = await env.DB.prepare(sql).bind(...binds).all();
    return json(results);
  } catch { return json([]); }
}

async function handleClientConsume(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const body = await request.json() as {sku:string;qty:number;notes?:string};
  if (!body.sku || !body.qty || body.qty <= 0) return json({error:"sku and qty > 0 required"}, 400);

  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (!isClientRole) return json({error:"Only client users can log consumption"}, 403);
  const clientId = user!.client_id;
  if (!clientId) return json({error:"Client not linked to your account"}, 400);

  const row = await env.DB.prepare("SELECT item_name, qty_on_hand FROM client_inventory WHERE client_id=? AND sku=?").bind(clientId, body.sku).first() as Record<string,unknown>|null;
  if (!row) return json({error:"Item not in your inventory"}, 404);

  const onHand = (row.qty_on_hand as number) || 0;
  if (body.qty > onHand) {
    return json({error:`Cannot log ${body.qty} — only ${Math.round(onHand)} in store`}, 400);
  }

  const newQty = onHand - body.qty;
  await env.DB.prepare("UPDATE client_inventory SET qty_on_hand=?, last_consumed_at=datetime('now'), updated_at=datetime('now') WHERE client_id=? AND sku=?")
    .bind(newQty, clientId, body.sku).run();
  await env.DB.prepare("INSERT INTO client_consumption (client_id,sku,item_name,qty,notes,recorded_by) VALUES (?,?,?,?,?,?)")
    .bind(clientId, body.sku, row.item_name, body.qty, body.notes||null, user!.name).run();

  return json({ok:true, qty_on_hand: newQty});
}

async function handleListClientConsumption(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);

  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  const clientId: string | null = isClientRole ? (user!.client_id || null) : url.searchParams.get('client_id');
  if (!clientId) return json([]);

  try {
    const {results} = await env.DB.prepare(
      `SELECT * FROM client_consumption WHERE client_id=? AND consumed_at >= ? AND consumed_at < date(?,'+1 day') ORDER BY consumed_at DESC LIMIT 500`
    ).bind(clientId, from, to).all();
    return json(results);
  } catch { return json([]); }
}

async function handlePatchClientInventory(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const sku = decodeURIComponent(path.split('/').pop()!);
  const body = await request.json() as {reorder_level?:number;qty_on_hand?:number;item_name?:string;is_critical?:number};

  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (!isClientRole) return json({error:"Forbidden"}, 403);
  const clientId = user!.client_id;
  if (!clientId) return json({error:"Client not linked to your account"}, 400);

  const sets: string[] = ['updated_at=datetime(\'now\')'];
  const vals: unknown[] = [];
  if (body.item_name     !== undefined) { sets.push('item_name=?');     vals.push(body.item_name.trim()); }
  if (body.reorder_level !== undefined) { sets.push('reorder_level=?'); vals.push(body.reorder_level); }
  if (body.qty_on_hand   !== undefined) { sets.push('qty_on_hand=?');   vals.push(Math.max(0, body.qty_on_hand)); }
  if (body.is_critical   !== undefined) { sets.push('is_critical=?');   vals.push(body.is_critical ? 1 : 0); }
  if (sets.length === 1) return json({error:"Nothing to update"}, 400);

  vals.push(clientId, sku);
  await env.DB.prepare(`UPDATE client_inventory SET ${sets.join(',')} WHERE client_id=? AND sku=?`).bind(...vals).run();
  return json({ok:true});
}

async function handleSyncClientInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;

  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (!isClientRole) return json({error:"Forbidden"}, 403);
  const clientId = user!.client_id;
  if (!clientId) return json({error:"Client not linked"}, 400);

  try {
    await env.DB.prepare(`
      INSERT INTO client_inventory (client_id, sku, item_name, category, uom, qty_on_hand, last_received_qty, last_received_at, updated_at)
      SELECT
        o.client_id, dci.sku,
        COALESCE(NULLIF(dci.name,''), NULLIF(i.name,''), MAX(NULLIF(oi.name,'')), dci.sku),
        COALESCE(NULLIF(i.category,''), ''), COALESCE(NULLIF(i.uom,''), 'unit'),
        SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
        SUM(CASE WHEN dci.qty_delivered > 0 THEN dci.qty_delivered ELSE dci.qty_ordered END),
        MAX(dc.delivered_at), datetime('now')
      FROM dc_items dci
      JOIN delivery_challans dc ON dci.dc_id = dc.id
      JOIN orders o ON dc.order_id = o.id
      LEFT JOIN inventory i ON i.sku = dci.sku
      LEFT JOIN order_items oi ON oi.order_id = dc.order_id AND oi.sku = dci.sku
      WHERE dc.status = 'DELIVERED' AND o.client_id = ?
      GROUP BY o.client_id, dci.sku
      ON CONFLICT(client_id, sku) DO UPDATE SET
        qty_on_hand       = excluded.qty_on_hand,
        last_received_qty = excluded.last_received_qty,
        last_received_at  = excluded.last_received_at,
        item_name         = CASE WHEN excluded.item_name = excluded.sku THEN COALESCE(NULLIF(client_inventory.item_name, client_inventory.sku), excluded.item_name) ELSE excluded.item_name END,
        updated_at        = datetime('now')
    `).bind(clientId).run();
    return json({ok:true});
  } catch(e) {
    return json({error: String(e)}, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT REPORTS — Consumption & Spend
// ═══════════════════════════════════════════════════════════════════

// Client consumption report — per item: received & consumed in the period, plus
// current in-stock and a low-stock flag. Client roles are scoped to their own
// client; internal roles may pass ?client_id= to view one, else it aggregates.
async function handleRptClientConsumption(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);
  const isClientRole = ['client_admin','client_approver','client_user'].includes((user as any).role);
  const clientId = isClientRole ? ((user as any).client_id || null) : (url.searchParams.get('client_id') || null);

  try {
    const cf = (col: string) => clientId ? ` AND ${col} = ?` : '';
    const cb = clientId ? [clientId] : [];

    // Received in period — delivered challan lines for this client's orders.
    const { results: recv } = await env.DB.prepare(`
      SELECT dci.sku AS sku, MAX(dci.name) AS name, SUM(dci.qty_delivered) AS received
      FROM dc_items dci
      JOIN delivery_challans dc ON dci.dc_id = dc.id
      JOIN orders o ON dc.order_id = o.id
      WHERE dc.delivered_at IS NOT NULL AND dc.delivered_at >= ? AND dc.delivered_at < date(?, '+1 day')${cf('o.client_id')}
      GROUP BY dci.sku`).bind(from, to, ...cb).all();

    // Consumed in period.
    const { results: cons } = await env.DB.prepare(`
      SELECT cc.sku AS sku, MAX(cc.item_name) AS name, SUM(cc.qty) AS consumed
      FROM client_consumption cc
      WHERE cc.consumed_at >= ? AND cc.consumed_at < date(?, '+1 day')${cf('cc.client_id')}
      GROUP BY cc.sku`).bind(from, to, ...cb).all();

    // Current stock on hand + reorder level (point-in-time, not period-bound).
    // Category is sourced live from the master catalogue (inventory) so a
    // per-product category edit shows immediately; ci.category is only a
    // fallback — matching handleListClientInventory.
    const { results: stock } = await env.DB.prepare(`
      SELECT ci.sku AS sku, MAX(ci.item_name) AS name,
             COALESCE(NULLIF(MAX(i.category),''), NULLIF(MAX(ci.category),''), '') AS category,
             SUM(ci.qty_on_hand) AS in_stock, MAX(ci.reorder_level) AS reorder_level
      FROM client_inventory ci
      LEFT JOIN inventory i ON i.sku = ci.sku
      WHERE 1=1${cf('ci.client_id')}
      GROUP BY ci.sku`).bind(...cb).all();

    type Row = { sku:string; item_name:string; category:string; received:number; consumed:number; in_stock:number; reorder_level:number; low_stock:boolean };
    const map = new Map<string, Row>();
    const get = (sku: string, name?: unknown): Row => {
      let r = map.get(sku);
      if (!r) { r = { sku, item_name: String(name || sku), category: '', received: 0, consumed: 0, in_stock: 0, reorder_level: 0, low_stock: false }; map.set(sku, r); }
      else if (name && (r.item_name === sku || !r.item_name)) r.item_name = String(name);
      return r;
    };
    for (const r of recv  as Record<string,unknown>[]) { const x = get(String(r.sku), r.name); x.received = Number(r.received) || 0; }
    for (const r of cons  as Record<string,unknown>[]) { const x = get(String(r.sku), r.name); x.consumed = Number(r.consumed) || 0; }
    for (const r of stock as Record<string,unknown>[]) {
      const x = get(String(r.sku), r.name);
      x.category = String(r.category || '');
      x.in_stock = Number(r.in_stock) || 0;
      x.reorder_level = Number(r.reorder_level) || 0;
      x.low_stock = x.reorder_level > 0 && x.in_stock <= x.reorder_level;
    }

    // Hide orphan rows — stock-only leftovers from deleted test orders. Keep an
    // item only if it had activity in the period OR is in the client's assigned
    // catalogue. If the client has no catalogue assigned, show everything they
    // hold (matches handleListClientInventory's fallback). Aggregate view (no
    // client) keeps everything with activity.
    let catalogSet: Set<string> | null = null;
    if (clientId) {
      const { results: cat } = await env.DB.prepare("SELECT sku FROM client_catalog WHERE client_id=?").bind(clientId).all();
      catalogSet = new Set(cat.map(r => String((r as Record<string, unknown>).sku)));
    }
    const hasCatalog = !!(catalogSet && catalogSet.size);

    // total_qty is kept as an alias of `consumed` for older consumers
    // (Executive Reports "most consumed" list) that predate this enrichment.
    const rows = [...map.values()]
      .filter(r => r.received > 0 || r.consumed > 0 || !hasCatalog || catalogSet!.has(r.sku))
      .sort((a, b) => b.consumed - a.consumed || b.received - a.received)
      .map(r => ({ ...r, total_qty: r.consumed }));
    const totals = rows.reduce((t, r) => ({
      received: t.received + r.received, consumed: t.consumed + r.consumed,
      in_stock: t.in_stock + r.in_stock, low_stock: t.low_stock + (r.low_stock ? 1 : 0),
    }), { received: 0, consumed: 0, in_stock: 0, low_stock: 0 });

    return json({ from, to, rows, totals: { ...totals, items: rows.length } });
  } catch (e) { return json({ error: String(e) }, 500); }
}

async function handleRptClientSpend(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const from = url.searchParams.get('from') || new Date(Date.now()-365*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);
  const clientId = (user as any).client_id || null;
  const isClientRole = ['client_admin','client_approver','client_user'].includes((user as any).role);

  try {
    const clientWhere = isClientRole && clientId ? ' AND o.client_id = ?' : '';
    const baseBinds: (string|number)[] = [from, to, ...(isClientRole && clientId ? [clientId] : [])];

    const {results: monthly} = await env.DB.prepare(`
      SELECT
        strftime('%Y-%m', o.created_at) AS month,
        strftime('%Y', o.created_at) AS year,
        COUNT(DISTINCT o.id) AS order_count,
        SUM(o.grand_total) AS total_spend
      FROM orders o
      WHERE o.created_at >= ? AND o.created_at <= ?
        AND o.status NOT IN ('CANCELLED','DRAFT')
        ${clientWhere}
      GROUP BY month ORDER BY month ASC
    `).bind(...baseBinds).all();

    const {results: po_wise} = await env.DB.prepare(`
      SELECT
        o.id AS order_id,
        o.created_at,
        o.status,
        o.grand_total,
        c.name AS client_name,
        COUNT(oi.id) AS item_count
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.created_at >= ? AND o.created_at <= ?
        AND o.status NOT IN ('CANCELLED','DRAFT')
        ${clientWhere}
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 200
    `).bind(...baseBinds).all();

    return json({ from, to, monthly: monthly as Record<string,unknown>[], po_wise: po_wise as Record<string,unknown>[] });
  } catch(e) { return json({error: String(e)}, 500); }
}

// Order-vs-delivery fulfilment, bucketed by the order's business period
// (order_period, falling back to created_at month). Returns per-month rows;
// the frontend rolls these up into month / quarter / fiscal-year views.
async function handleRptOrderFulfilmentMonthly(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  // client role → own client; admin can pass ?client_id= to scope, else all clients
  const clientId = isClientRole ? (user!.client_id || null) : (url.searchParams.get('client_id') || null);

  try {
    const clientWhere = clientId ? ' AND o.client_id = ?' : '';
    const binds: string[] = clientId ? [clientId] : [];
    const deliveredExpr = `COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END)
        FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
        WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)`;

    const {results} = await env.DB.prepare(`
      SELECT
        COALESCE(o.order_period, strftime('%Y-%m', o.created_at)) AS period,
        COUNT(DISTINCT o.id) AS order_count,
        SUM(oi.qty) AS ordered_qty,
        SUM(oi.qty * oi.unit_price) AS ordered_value,
        SUM(${deliveredExpr}) AS delivered_qty,
        SUM(${deliveredExpr} * oi.unit_price) AS delivered_value
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status NOT IN ('CANCELLED','DRAFT') ${clientWhere}
      GROUP BY period ORDER BY period ASC
    `).bind(...binds).all();

    return json({ rows: results as Record<string,unknown>[], client_id: clientId, scope: clientId ? 'client' : 'all' });
  } catch(e) { return json({error: String(e)}, 500); }
}

// Ordered-vs-delivered split by category, or by sub-category when ?category= is given.
// Scope: client role → own client; admin may pass ?client_id=. Filter by exact
// ?period=YYYY-MM (order period) or a ?from=&to= date range for custom windows.
async function handleRptCategoryBreakdown(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  const clientId = isClientRole ? (user!.client_id || null) : (url.searchParams.get('client_id') || null);
  const period = url.searchParams.get('period');           // exact YYYY-MM
  const category = url.searchParams.get('category');        // when set → sub-category level
  const from = url.searchParams.get('from') || new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);

  try {
    const where: string[] = ["o.status NOT IN ('CANCELLED','DRAFT')"];
    const binds: string[] = [];
    if (clientId) { where.push("o.client_id = ?"); binds.push(clientId); }
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      where.push("COALESCE(o.order_period, strftime('%Y-%m', o.created_at)) = ?"); binds.push(period);
    } else {
      where.push("o.created_at >= ? AND o.created_at < date(?, '+1 day')"); binds.push(from, to);
    }

    const groupExpr = category != null
      ? "COALESCE(NULLIF(i.sub_category,''),'Normal')"
      : "COALESCE(NULLIF(i.category,''),'Uncategorised')";
    if (category != null) { where.push("COALESCE(NULLIF(i.category,''),'Uncategorised') = ?"); binds.push(category); }

    const deliveredExpr = `COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END)
        FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
        WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)`;

    const {results} = await env.DB.prepare(`
      SELECT
        ${groupExpr} AS grp_name,
        COUNT(DISTINCT o.id) AS order_count,
        SUM(oi.qty) AS ordered_qty,
        SUM(oi.qty * oi.unit_price) AS ordered_value,
        SUM(${deliveredExpr}) AS delivered_qty,
        SUM(${deliveredExpr} * oi.unit_price) AS delivered_value
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN inventory i ON i.sku = oi.sku
      WHERE ${where.join(' AND ')}
      GROUP BY grp_name
      ORDER BY ordered_value DESC
    `).bind(...binds).all();

    return json({
      level: category != null ? 'subcategory' : 'category',
      category: category || null, period: period || null, from, to,
      rows: (results as Record<string,unknown>[]).map(r => ({ ...r, name: r.grp_name })),
    });
  } catch(e) { return json({error: String(e)}, 500); }
}

// Shared: SQL fragment for delivered qty of an order line across all its DCs
const DELIVERED_EXPR = `COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END)
  FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
  WHERE dc.order_id=o.id AND dci.sku=oi.sku),0)`;

// ── Executive KPI wall: Orders / Delivery / Finance / Inventory + client roll-up ──
async function handleRptExecSummary(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  const clientId = isClientRole ? (user!.client_id || null) : (url.searchParams.get('client_id') || null);
  const from = url.searchParams.get('from') || new Date(Date.now()-30*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);

  try {
    const cWhere = clientId ? ' AND o.client_id=?' : '';
    const dWhere = `o.created_at >= ? AND o.created_at < date(?, '+1 day')`;
    const b = (extra: (string|number)[] = []) => [from, to, ...(clientId?[clientId]:[]), ...extra];

    // Orders KPIs
    const orderAgg = await env.DB.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(grand_total),0) AS value,
        SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='PARTIALLY_CLOSED' THEN 1 ELSE 0 END) AS partial,
        SUM(CASE WHEN status NOT IN ('CLOSED','PARTIALLY_CLOSED','CANCELLED') THEN 1 ELSE 0 END) AS pending
      FROM orders o WHERE ${dWhere} AND o.status NOT IN ('CANCELLED','DRAFT') ${cWhere}`).bind(...b()).first() as Record<string,number>;

    // Delivery + margin (ordered vs delivered qty/value, cost)
    const line = await env.DB.prepare(`
      SELECT COALESCE(SUM(oi.qty),0) AS ord_qty,
        COALESCE(SUM(${DELIVERED_EXPR}),0) AS del_qty,
        COALESCE(SUM(oi.qty*oi.unit_price),0) AS ord_val,
        COALESCE(SUM((oi.qty - ${DELIVERED_EXPR})*oi.unit_price),0) AS due_val,
        COALESCE(SUM(oi.qty * COALESCE(i.cost_excl_gst,0)),0) AS cost_val,
        COALESCE(SUM(CASE WHEN i.cost_excl_gst IS NOT NULL AND i.cost_excl_gst>0 THEN oi.qty*oi.unit_price ELSE 0 END),0) AS costed_val
      FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN inventory i ON i.sku=oi.sku
      WHERE ${dWhere} AND o.status NOT IN ('CANCELLED','DRAFT') ${cWhere}`).bind(...b()).first() as Record<string,number>;

    const awaitingDispatch = await env.DB.prepare(`SELECT COUNT(*) AS c FROM delivery_challans WHERE status='SCHEDULED'`).first() as Record<string,number>;
    const awaitingProc = await env.DB.prepare(`SELECT COUNT(*) AS c FROM orders o WHERE o.status IN ('APPROVED','ACKNOWLEDGED') AND ${dWhere} ${cWhere}`).bind(...b()).first() as Record<string,number>;

    // Finance — budget from clients (all or one)
    const budRow = await env.DB.prepare(clientId
      ? `SELECT COALESCE(SUM(monthly_budget),0) AS budget FROM clients WHERE id=?`
      : `SELECT COALESCE(SUM(monthly_budget),0) AS budget FROM clients WHERE active=1`)
      .bind(...(clientId?[clientId]:[])).first() as Record<string,number>;

    // Inventory snapshot (global — inventory is not client-scoped)
    let inv: Record<string,number> = { val:0, total:0, instock:0, low:0, out:0 };
    try {
      inv = await env.DB.prepare(`SELECT COALESCE(SUM(stock*unit_price),0) AS val, COUNT(*) AS total,
        SUM(CASE WHEN stock>0 THEN 1 ELSE 0 END) AS instock,
        SUM(CASE WHEN stock<=reorder_level AND stock>0 THEN 1 ELSE 0 END) AS low,
        SUM(CASE WHEN stock=0 THEN 1 ELSE 0 END) AS out
        FROM inventory WHERE active=1`).first() as Record<string,number>;
    } catch { /* ignore */ }
    let mustHave = { total:0, avail:0 };
    try {
      await ensureCriticalTable(env);
      const mh = await env.DB.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN i.stock>0 THEN 1 ELSE 0 END) AS avail
        FROM critical_skus cs JOIN inventory i ON i.sku=cs.sku WHERE i.active=1`).first() as Record<string,number>;
      mustHave = { total: mh?.total||0, avail: mh?.avail||0 };
    } catch { /* ignore */ }

    // Clients roll-up
    const clientRows = await env.DB.prepare(`
      SELECT c.id, c.name, c.monthly_budget,
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(o.grand_total),0) AS spend,
        COALESCE((SELECT SUM(oi.qty) FROM order_items oi WHERE oi.order_id IN (SELECT id FROM orders o2 WHERE o2.client_id=c.id AND o2.created_at>=? AND o2.created_at<date(?, '+1 day') AND o2.status NOT IN ('CANCELLED','DRAFT'))),0) AS ord_qty,
        COALESCE((SELECT SUM(CASE WHEN dc.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END)
          FROM dc_items dci JOIN delivery_challans dc ON dci.dc_id=dc.id
          WHERE dc.order_id IN (SELECT id FROM orders o3 WHERE o3.client_id=c.id AND o3.created_at>=? AND o3.created_at<date(?, '+1 day') AND o3.status NOT IN ('CANCELLED','DRAFT'))),0) AS del_qty
      FROM clients c
      LEFT JOIN orders o ON o.client_id=c.id AND o.created_at>=? AND o.created_at<date(?, '+1 day') AND o.status NOT IN ('CANCELLED','DRAFT')
      WHERE c.active=1 ${clientId?'AND c.id=?':''}
      GROUP BY c.id ORDER BY spend DESC`).bind(from,to,from,to,from,to,...(clientId?[clientId]:[])).all();

    const clients = (clientRows.results as Record<string,number>[]).map(c => ({
      ...c, fill_pct: c.ord_qty ? Math.round((c.del_qty as number)/(c.ord_qty as number)*100) : 0,
      budget_util: c.monthly_budget ? Math.round((c.spend as number)/(c.monthly_budget as number)*100) : 0,
    }));

    const ordVal = line?.ord_val||0, delQty = line?.del_qty||0, ordQty = line?.ord_qty||0;
    const margin = line?.costed_val ? Math.round(((line.costed_val - line.cost_val)/line.costed_val)*1000)/10 : null;

    return json({
      from, to, scope: clientId ? 'client':'all',
      orders: { total: orderAgg?.total||0, value: orderAgg?.value||0,
        avg: orderAgg?.total ? Math.round((orderAgg.value)/(orderAgg.total)) : 0,
        completed: orderAgg?.completed||0, partial: orderAgg?.partial||0, pending: orderAgg?.pending||0 },
      delivery: { fill_pct: ordQty?Math.round(delQty/ordQty*100):100,
        due_qty: Math.max(0, ordQty-delQty), due_value: Math.max(0, Math.round(line?.due_val||0)),
        awaiting_dispatch: awaitingDispatch?.c||0, awaiting_procurement: awaitingProc?.c||0 },
      finance: { budget: budRow?.budget||0, spend: Math.round(ordVal),
        budget_util: budRow?.budget ? Math.round(ordVal/budRow.budget*100) : 0,
        revenue: Math.round(ordVal), gross_margin: margin },
      inventory: { value: Math.round(inv?.val||0),
        availability: inv?.total ? Math.round((inv.instock)/(inv.total)*100) : 0,
        must_have: mustHave.total ? Math.round(mustHave.avail/mustHave.total*100) : 100,
        low_stock: inv?.low||0, stock_out: inv?.out||0 },
      clients,
    });
  } catch(e) { return json({error: String(e)}, 500); }
}

// ── Predictive Control Tower radar (Phase 1) — pure run-rate projections
//    over live data: no models, every number carries its arithmetic. ──
async function handleTowerRadar(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (['client_admin','client_approver','client_user','vendor','vendor_user'].includes(user!.role)) return json({error:"Forbidden"}, 403);

  const now = new Date();
  const isoD = (d: Date) => d.toISOString().slice(0,10);
  const todayK = isoD(now);
  const monthStart = todayK.slice(0,8) + '01';
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const dayOfMonth = now.getDate();
  const out: Record<string, unknown> = {};

  // 1) Fulfilment: MTD fill %, weekly trend (last 7d vs prior 7d), month-end projection
  try {
    const fill = async (from: string, to: string): Promise<number|null> => {
      const r = await env.DB.prepare(`
        SELECT COALESCE(SUM(oi.qty),0) AS oq, COALESCE(SUM(${DELIVERED_EXPR}),0) AS dq
        FROM orders o JOIN order_items oi ON oi.order_id=o.id
        WHERE o.created_at >= ? AND o.created_at < date(?, '+1 day') AND o.status NOT IN ('CANCELLED','DRAFT')`)
        .bind(from, to).first() as Record<string,number>|null;
      return r?.oq ? Math.round((r.dq / r.oq) * 1000) / 10 : null;
    };
    const mtd = await fill(monthStart, todayK);
    const last7 = await fill(isoD(new Date(Date.now()-7*86400000)), todayK);
    const prior7 = await fill(isoD(new Date(Date.now()-14*86400000)), isoD(new Date(Date.now()-8*86400000)));
    const trend = (last7 != null && prior7 != null) ? Math.round((last7 - prior7) * 10) / 10 : 0;
    const weeksLeft = Math.max(0, (daysInMonth - dayOfMonth) / 7);
    const projected = mtd != null ? Math.max(0, Math.min(100, Math.round((mtd + trend * weeksLeft) * 10) / 10)) : null;
    out.fulfilment = { mtd, trend_wk: trend, projected_eom: projected, target: 95 };
  } catch { out.fulfilment = null; }

  // 2) Budget pace per client: projected month-end % and breach crossing date
  try {
    const { results } = await env.DB.prepare(`
      SELECT c.name, c.monthly_budget AS budget,
        COALESCE((SELECT SUM(o.grand_total) FROM orders o WHERE o.client_id=c.id
          AND o.created_at >= ? AND o.status NOT IN ('CANCELLED','DRAFT')),0) AS spend
      FROM clients c WHERE c.active=1 AND c.monthly_budget > 0`).bind(monthStart).all();
    const clients = (results as Record<string,unknown>[]).map(c => {
      const spend = Number(c.spend)||0, budget = Number(c.budget)||0;
      const daily = spend / Math.max(1, dayOfMonth);
      const projected = budget ? Math.round(daily * daysInMonth / budget * 100) : 0;
      let crossing: string | null = null;
      if (projected > 100 && daily > 0) {
        const crossDay = Math.min(daysInMonth, Math.ceil(budget / daily));
        crossing = monthStart.slice(0,8) + String(crossDay).padStart(2,'0');
      }
      return { name: String(c.name), spend: Math.round(spend), budget, projected_pct: projected, crossing };
    }).sort((a,b) => b.projected_pct - a.projected_pct);
    out.budget = { clients: clients.slice(0,5), hot: clients.filter(c=>c.projected_pct>100).length, total: clients.length };
  } catch { out.budget = null; }

  // 3) Stock run-outs: days of cover = stock ÷ 14-day average consumption draw.
  //    The forecast can only project SKUs with recent consumption; also report
  //    whether ANY consumption exists and the below-reorder count, so the UI can
  //    tell "all clear" apart from "no data to forecast from".
  try {
    await ensureCriticalTable(env);
    const { results } = await env.DB.prepare(`
      SELECT i.sku, i.name, i.stock, i.reorder_level,
        (SELECT COALESCE(SUM(cc.qty),0) FROM client_consumption cc
          WHERE cc.sku=i.sku AND cc.consumed_at >= date('now','-14 day')) / 14.0 AS draw,
        EXISTS(SELECT 1 FROM critical_skus cs WHERE cs.sku=i.sku) AS critical
      FROM inventory i WHERE i.active=1`).all();
    const all = (results as Record<string,unknown>[])
      .map(r => ({ sku: String(r.sku), name: String(r.name||r.sku), stock: Number(r.stock)||0,
        reorder_level: Number(r.reorder_level)||0, draw: Math.round((Number(r.draw)||0)*10)/10, critical: !!Number(r.critical) }));
    const consumed = all.filter(r => r.draw > 0);
    out.stock = consumed
      .map(r => ({ ...r, days_cover: Math.round(r.stock / r.draw),
        runout: isoD(new Date(Date.now() + Math.max(0, r.stock / r.draw) * 86400000)) }))
      .filter(r => r.days_cover <= 30)
      .sort((a,b) => a.days_cover - b.days_cover)
      .slice(0,6);
    const below = all.filter(r => r.stock <= r.reorder_level);
    out.stock_meta = {
      has_consumption: consumed.length > 0,
      below_reorder: below.length,
      below_top: below.sort((a,b) => (a.stock - a.reorder_level) - (b.stock - b.reorder_level))
        .slice(0,5).map(r => ({ name: r.name, stock: r.stock, reorder_level: r.reorder_level, critical: r.critical })),
    };
  } catch { out.stock = []; out.stock_meta = null; }

  // 4) Capacity next 30 days: booked DCs + recurring projections vs fleet capacity
  //    (frontend charts the first 7, filters overloads per horizon)
  try {
    const pol = await getDcalPolicy(env);
    const end = isoD(new Date(Date.now()+29*86400000));
    const eff = "CASE WHEN dc.status='DELIVERED' AND dc.delivered_at IS NOT NULL THEN date(dc.delivered_at) ELSE COALESCE(dc.scheduled_date, date(dc.dispatched_at), date(dc.created_at)) END";
    const { results } = await env.DB.prepare(`
      SELECT ${eff} AS d, o.client_id AS cid, COUNT(*) AS n
      FROM delivery_challans dc LEFT JOIN orders o ON dc.order_id=o.id
      WHERE dc.status != 'CANCELLED' AND ${eff} BETWEEN ? AND ?
      GROUP BY d, cid`).bind(todayK, end).all();
    const booked: Record<string, number> = {};
    const covered = new Set<string>();
    for (const r of results as Record<string,unknown>[]) {
      const dd = String(r.d);
      booked[dd] = (booked[dd]||0) + Number(r.n);
      if (r.cid) covered.add(String(r.cid) + '|' + dd);
    }
    const projected: Record<string, number> = {};
    const ghosts: Array<Record<string,unknown>> = [];
    const sos = await env.DB.prepare("SELECT * FROM standing_orders WHERE active=1").all();
    for (const so of sos.results as Record<string,unknown>[]) {
      let k = String(so.next_run_date||'').slice(0,10);
      if (!k) continue;
      let guard = 0;
      while (k < todayK && guard++ < 400) k = nextCycleDate(k, String(so.frequency||'MONTHLY'));
      const evs = await env.DB.prepare("SELECT cycle_date FROM standing_order_events WHERE so_id=?").bind(so.id).all();
      const done = new Set((evs.results as Record<string,string>[]).map(e => e.cycle_date));
      guard = 0;
      while (k <= end && guard++ < 40) {
        if (!done.has(k) && !covered.has(String(so.client_id)+'|'+k)) {
          projected[k] = (projected[k]||0) + 1;
          if (ghosts.length < 8) {
            const cl = await env.DB.prepare("SELECT name FROM clients WHERE id=?").bind(so.client_id).first() as Record<string,string>|null;
            ghosts.push({ so: so.id, name: so.name, client: cl?.name||'', date: k });
          }
        }
        k = nextCycleDate(k, String(so.frequency||'MONTHLY'));
      }
    }
    const days: Array<{date:string;booked:number;projected:number}> = [];
    for (let i=0;i<30;i++){ const dk = isoD(new Date(Date.now()+i*86400000)); days.push({ date: dk, booked: booked[dk]||0, projected: projected[dk]||0 }); }
    out.capacity = { cap: pol.capacity, days, over: days.filter(x => x.booked + x.projected > pol.capacity).map(x => x.date) };
    out.ghosts = ghosts;
  } catch { out.capacity = null; out.ghosts = []; }

  // 5) At-risk deliveries (fact, not projection — but belongs on the radar)
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS c FROM delivery_challans dc
      WHERE dc.status NOT IN ('DELIVERED','CANCELLED','RETURNED')
      AND COALESCE(dc.scheduled_date, date(dc.dispatched_at), date(dc.created_at)) < date('now')`).first() as Record<string,number>|null;
    out.at_risk = row?.c||0;
  } catch { out.at_risk = 0; }

  // 6) Billing runway: delivered & unbilled challans
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS c,
      CAST(MAX(julianday('now') - julianday(dc.delivered_at)) AS INTEGER) AS old
      FROM delivery_challans dc WHERE dc.status='DELIVERED' AND COALESCE(dc.billed,0)=0`).first() as Record<string,number>|null;
    out.billing = { unbilled: row?.c||0, oldest_days: row?.old||0 };
  } catch { out.billing = null; }

  // 7) Approvals waiting more than 24 hours (queue fodder)
  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS c,
      CAST(MAX(julianday('now') - julianday(created_at)) * 24 AS INTEGER) AS h
      FROM orders WHERE status='PENDING_APPROVAL' AND created_at < datetime('now','-1 day')`).first() as Record<string,number>|null;
    out.approvals_stale = { count: row?.c||0, oldest_hours: row?.h||0 };
  } catch { out.approvals_stale = null; }

  // 8) Pipeline bottleneck: average days spent in each stage, from order_history
  //    transitions over the last 30 days (stage = time between consecutive rows)
  try {
    const { results } = await env.DB.prepare(`
      SELECT order_id, to_status, created_at FROM order_history
      WHERE created_at >= datetime('now','-30 day')
      ORDER BY order_id, created_at LIMIT 2000`).all();
    const rows = results as Array<Record<string,string>>;
    const stageNames: Record<string,string> = {
      SUBMITTED:'Approval', PENDING_APPROVAL:'Approval', APPROVED:'Acknowledge',
      ACKNOWLEDGED:'Picking', PICKED:'Dispatch', IN_SHIPMENT:'Delivery',
    };
    const agg: Record<string,{sum:number;n:number}> = {};
    for (let i = 0; i < rows.length - 1; i++) {
      const a = rows[i], nxt = rows[i+1];
      if (a.order_id !== nxt.order_id) continue;
      const stage = stageNames[a.to_status];
      if (!stage) continue;
      const t0 = new Date(String(a.created_at).replace(' ','T') + 'Z').getTime();
      const t1 = new Date(String(nxt.created_at).replace(' ','T') + 'Z').getTime();
      const daysIn = (t1 - t0) / 86400000;
      if (!isFinite(daysIn) || daysIn < 0 || daysIn > 30) continue;
      (agg[stage] = agg[stage] || { sum:0, n:0 });
      agg[stage].sum += daysIn; agg[stage].n++;
    }
    const stages = Object.entries(agg)
      .map(([stage, v]) => ({ stage, avg_days: Math.round(v.sum / v.n * 10) / 10, n: v.n }))
      .filter(s => s.n >= 2)
      .sort((x, y) => y.avg_days - x.avg_days);
    if (stages.length >= 2 && stages[0].avg_days > 0) {
      const ratio = stages[1].avg_days > 0 ? Math.round(stages[0].avg_days / stages[1].avg_days * 10) / 10 : null;
      out.bottleneck = { stages, worst: { ...stages[0], ratio } };
    } else out.bottleneck = null;
  } catch { out.bottleneck = null; }

  // 9) Client health trajectory: score = 0.6×fulfilment + 0.4×budget-pace,
  //    trailing 30 days vs the prior 30 — the arrow is the sign of the change.
  try {
    const winStats = async (from: string, to: string): Promise<Record<string,{fill:number|null;spend:number}>> => {
      const m: Record<string,{fill:number|null;spend:number}> = {};
      const fillRows = await env.DB.prepare(`
        SELECT o.client_id AS cid, COALESCE(SUM(oi.qty),0) AS oq, COALESCE(SUM(${DELIVERED_EXPR}),0) AS dq
        FROM orders o JOIN order_items oi ON oi.order_id=o.id
        WHERE o.created_at >= ? AND o.created_at < ? AND o.status NOT IN ('CANCELLED','DRAFT')
        GROUP BY o.client_id`).bind(from, to).all();
      for (const r of fillRows.results as Record<string,unknown>[]) {
        const oq = Number(r.oq)||0, dq = Number(r.dq)||0;
        m[String(r.cid)] = { fill: oq ? Math.round(dq/oq*100) : null, spend: 0 };
      }
      const spendRows = await env.DB.prepare(`
        SELECT client_id AS cid, COALESCE(SUM(grand_total),0) AS sp FROM orders
        WHERE created_at >= ? AND created_at < ? AND status NOT IN ('CANCELLED','DRAFT')
        GROUP BY client_id`).bind(from, to).all();
      for (const r of spendRows.results as Record<string,unknown>[]) {
        const k = String(r.cid);
        (m[k] = m[k] || { fill:null, spend:0 }).spend = Number(r.sp)||0;
      }
      return m;
    };
    const d30 = isoD(new Date(Date.now()-30*86400000));
    const d60 = isoD(new Date(Date.now()-60*86400000));
    const curW = await winStats(d30, todayK + ' 23:59:59');
    const prevW = await winStats(d60, d30);
    const { results: cls } = await env.DB.prepare("SELECT id, name, monthly_budget FROM clients WHERE active=1").all();
    const paceScore = (spend: number, budget: number) => budget > 0 ? Math.max(0, 100 - Math.max(0, (spend/budget*100) - 100)) : 100;
    const scoreOf = (w: {fill:number|null;spend:number}|undefined, budget: number): number|null => {
      if (!w || w.fill == null) return null;
      return Math.round(0.6 * w.fill + 0.4 * paceScore(w.spend, budget));
    };
    const health = (cls as Record<string,unknown>[]).map(c => {
      const id = String(c.id), budget = Number(c.monthly_budget)||0;
      const s = scoreOf(curW[id], budget), p = scoreOf(prevW[id], budget);
      let dir = 'flat', why = '';
      if (s != null && p != null) {
        dir = s - p >= 2 ? 'up' : p - s >= 2 ? 'down' : 'flat';
        const cf = curW[id]?.fill, pf = prevW[id]?.fill;
        const cp = Math.round(paceScore(curW[id]?.spend||0, budget)), pp = Math.round(paceScore(prevW[id]?.spend||0, budget));
        why = `fulfilment ${pf}% → ${cf}% · budget-pace score ${pp} → ${cp} (trailing 30d vs prior 30d)`;
      } else if (s != null) why = 'no orders in the prior 30-day window to compare';
      return { name: String(c.name), score: s, prev: p, dir, why };
    }).filter(x => x.score != null)
      .sort((a,b) => (a.score as number) - (b.score as number))
      .slice(0, 6);
    out.health = health;
  } catch { out.health = []; }

  // 10) "What changed" vs the last snapshot, then record today's (first
  //     computation of the day wins, so intraday reloads don't erase it)
  try {
    const num = (v: unknown, k: string): number => { const o = v as Record<string,unknown>|null; return o ? Number(o[k])||0 : 0; };
    const in7 = isoD(new Date(Date.now()+7*86400000));
    const snap = {
      at_risk: Number(out.at_risk)||0,
      dry: Array.isArray(out.stock) ? (out.stock as unknown[]).length : 0,
      hot: num(out.budget, 'hot'),
      unbilled: num(out.billing, 'unbilled'),
      stale: num(out.approvals_stale, 'count'),
      ghosts: Array.isArray(out.ghosts) ? (out.ghosts as Array<Record<string,unknown>>).filter(g => String(g.date) <= in7).length : 0,
      fulfil: (out.fulfilment as Record<string,unknown>|null)?.mtd ?? null,
    };
    const prevRow = await env.DB.prepare("SELECT day, data FROM tower_snapshots WHERE day < ? ORDER BY day DESC LIMIT 1")
      .bind(todayK).first() as Record<string,string>|null;
    if (prevRow?.data) {
      try { out.changes = { since: prevRow.day, prev: JSON.parse(prevRow.data), cur: snap }; } catch { /* ignore */ }
    }
    await env.DB.prepare("INSERT OR IGNORE INTO tower_snapshots (day, data) VALUES (?,?)").bind(todayK, JSON.stringify(snap)).run();
  } catch { /* ignore */ }

  return json(out);
}

// ── Generalized drill: group ordered vs delivered by category / subcategory / brand / sku ──
async function handleRptDrill(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  const clientId = isClientRole ? (user!.client_id || null) : (url.searchParams.get('client_id') || null);
  const orderId = url.searchParams.get('order_id');
  const level = url.searchParams.get('level') || 'category';
  const category = url.searchParams.get('category');
  const subcategory = url.searchParams.get('subcategory');
  const brand = url.searchParams.get('brand');
  const from = url.searchParams.get('from') || new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);

  const groupExprs: Record<string,string> = {
    category:    "COALESCE(NULLIF(i.category,''),'Uncategorised')",
    subcategory: "COALESCE(NULLIF(i.sub_category,''),'Normal')",
    brand:       "COALESCE(NULLIF(i.brand,''),NULLIF(i.category,''),'—')",
    sku:         "oi.sku",
  };
  const groupExpr = groupExprs[level] || groupExprs.category;

  try {
    const where: string[] = ["o.status NOT IN ('CANCELLED','DRAFT')"];
    const binds: string[] = [];
    if (orderId) { where.push("o.id=?"); binds.push(orderId); }
    else {
      if (clientId) { where.push("o.client_id=?"); binds.push(clientId); }
      where.push("o.created_at >= ? AND o.created_at < date(?, '+1 day')"); binds.push(from, to);
    }
    if (category != null)    { where.push("COALESCE(NULLIF(i.category,''),'Uncategorised')=?"); binds.push(category); }
    if (subcategory != null) { where.push("COALESCE(NULLIF(i.sub_category,''),'Normal')=?"); binds.push(subcategory); }
    if (brand != null)       { where.push("COALESCE(NULLIF(i.brand,''),NULLIF(i.category,''),'—')=?"); binds.push(brand); }

    const nameSel = level === 'sku' ? "MAX(i.name) AS item_name, oi.sku AS sku," : "";
    const {results} = await env.DB.prepare(`
      SELECT ${groupExpr} AS grp_name, ${nameSel}
        COUNT(DISTINCT o.id) AS order_count,
        COALESCE(SUM(oi.qty),0) AS ordered_qty,
        COALESCE(SUM(oi.qty*oi.unit_price),0) AS ordered_value,
        COALESCE(SUM(${DELIVERED_EXPR}),0) AS delivered_qty,
        COALESCE(SUM(${DELIVERED_EXPR}*oi.unit_price),0) AS delivered_value
      FROM orders o JOIN order_items oi ON oi.order_id=o.id LEFT JOIN inventory i ON i.sku=oi.sku
      WHERE ${where.join(' AND ')}
      GROUP BY grp_name ${level==='sku'?', oi.sku':''}
      ORDER BY ordered_value DESC`).bind(...binds).all();

    return json({ level, rows: (results as Record<string,unknown>[]).map(r => ({ ...r, name: level==='sku' ? (r.item_name||r.sku) : r.grp_name })) });
  } catch(e) { return json({error: String(e)}, 500); }
}

// ── Delivery challans that carried a given SKU (drill: SKU → DC → Invoice) ──
async function handleRptSkuChallans(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const url = new URL(request.url);
  const isClientRole = ['client_admin','client_approver','client_user'].includes(user!.role);
  const clientId = isClientRole ? (user!.client_id || null) : (url.searchParams.get('client_id') || null);
  const orderId = url.searchParams.get('order_id');
  const sku = url.searchParams.get('sku');
  const from = url.searchParams.get('from') || new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const to   = url.searchParams.get('to')   || new Date().toISOString().slice(0,10);
  if (!sku) return json({error:"sku required"}, 400);

  try {
    const where: string[] = ["di.sku=?"];
    const binds: string[] = [sku];
    if (orderId) { where.push("dc.order_id=?"); binds.push(orderId); }
    else {
      if (clientId) { where.push("o.client_id=?"); binds.push(clientId); }
      where.push("o.created_at >= ? AND o.created_at < date(?, '+1 day')"); binds.push(from, to);
    }
    const {results} = await env.DB.prepare(`
      SELECT dc.id, dc.dc_number, dc.order_id, dc.status, dc.dispatched_at, dc.delivered_at,
        dc.billed, dc.billed_at, dc.vehicle_no, dc.driver_name,
        c.name AS client_name,
        di.qty_ordered AS dispatched_qty, di.qty_delivered,
        COALESCE(i.unit_price,0) AS unit_price,
        di.qty_delivered * COALESCE(i.unit_price,0) AS line_value,
        (SELECT COUNT(*) FROM dc_documents d WHERE d.dc_id=dc.id AND d.doc_type='pod') AS pod_count
      FROM dc_items di
      JOIN delivery_challans dc ON di.dc_id=dc.id
      JOIN orders o ON dc.order_id=o.id
      LEFT JOIN clients c ON o.client_id=c.id
      LEFT JOIN inventory i ON i.sku=di.sku
      WHERE ${where.join(' AND ')}
      ORDER BY dc.dispatched_at DESC`).bind(...binds).all();
    return json({ sku, rows: results as Record<string,unknown>[] });
  } catch(e) { return json({error: String(e)}, 500); }
}
