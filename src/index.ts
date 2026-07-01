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

      // Orders — specific paths must come before the wildcard /:id routes
      if (path==="/api/orders"                 && method==="GET")  return handleListOrders(request,env);
      if (path==="/api/orders"                 && method==="POST") return handleCreateOrder(request,env);
      if (path==="/api/orders/picklist"        && method==="GET")  return handlePickList(request,env);
      if (path==="/api/orders/items-summary"   && method==="GET")  return handleOrderItemsSummary(request,env);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="GET")   return handleGetOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+$/) && method==="PATCH") return handlePatchOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/drilldown$/)    && method==="GET")  return handleOrderDrilldown(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/transition$/)   && method==="POST") return handleTransitionOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/pick$/)         && method==="POST") return handlePickOrder(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/allocations$/)  && method==="GET")  return handleGetAllocations(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)     && method==="GET")  return handleListComments(request,env,path);
      if (path.match(/^\/api\/orders\/[^/]+\/comments$/)     && method==="POST") return handleAddComment(request,env,path);

      // Inventory
      if (path==="/api/inventory"               && method==="GET")   return handleListInventory(request,env);
      if (path==="/api/inventory"               && method==="POST")  return handleAddInventory(request,env);
      if (path==="/api/inventory/critical-alerts" && method==="POST") return handleSendCriticalAlerts(request,env);
      if (path.match(/^\/api\/inventory\/[^/]+\/critical$/) && method==="PATCH") return handleToggleCritical(request,env,path);
      if (path.match(/^\/api\/inventory\/[^/]+$/) && method==="PATCH") return handlePatchInventory(request,env,path);

      // Vendors
      if (path==="/api/vendors"  && method==="GET")  return handleListVendors(request,env);
      if (path==="/api/vendors"  && method==="POST") return handleAddVendor(request,env);
      if (path.match(/^\/api\/vendors\/[^/]+$/) && method==="PATCH") return handlePatchVendor(request,env,path);

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

      // Feature 15.X: Fulfilment & Reconciliation reports (must be before generic reports regex)
      if (path==="/api/reports/order-vs-delivery"    && method==="GET") return handleRptOrderVsDelivery(request,env);
      if (path==="/api/reports/brand-procurement"    && method==="GET") return handleRptBrandProcurement(request,env);
      if (path==="/api/reports/due-items"            && method==="GET") return handleRptDueItems(request,env);
      if (path==="/api/reports/dc-per-order"         && method==="GET") return handleRptDCPerOrder(request,env);
      if (path==="/api/reports/order-dcs"             && method==="GET") return handleRptOrderDCs(request,env);
      if (path==="/api/reports/dc-reconciliation"    && method==="GET") return handleRptDCReconciliation(request,env);
      if (path==="/api/reports/pending-supply"       && method==="GET") return handleRptPendingSupply(request,env);
      if (path==="/api/reports/due-ageing"           && method==="GET") return handleRptDueAgeing(request,env);
      if (path==="/api/reports/brand-shortfall"      && method==="GET") return handleRptBrandShortfall(request,env);
      if (path==="/api/reports/client-fulfilment"    && method==="GET") return handleRptClientFulfilment(request,env);
      if (path==="/api/reports/procurement-forecast" && method==="GET") return handleRptProcurementForecast(request,env);
      if (path==="/api/reports/consolidated-orders"  && method==="GET") return handleRptConsolidatedOrders(request,env);
      if (path==="/api/reports/consolidated-due"     && method==="GET") return handleRptConsolidatedDue(request,env);
      if (path==="/api/reports/client-summary"       && method==="GET") return handleRptClientSummary(request,env);

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
    FROM orders o LEFT JOIN clients c ON o.client_id=c.id LEFT JOIN users u ON o.created_by=u.id WHERE o.id=?`).bind(id).first();
  if (!order) return json({error:"Not found"}, 404);

  const [{results:items},{results:history},{results:comments}] = await Promise.all([
    env.DB.prepare("SELECT * FROM order_items WHERE order_id=?").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_history WHERE order_id=? ORDER BY created_at").bind(id).all(),
    env.DB.prepare("SELECT * FROM order_comments WHERE order_id=? ORDER BY created_at").bind(id).all(),
  ]);
  return json({...order, items, history, comments});
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
      for (const item of dcItems as Record<string,number>[]) {
        const delivered = (item.qty_delivered && item.qty_delivered > 0) ? item.qty_delivered : item.qty_ordered;
        deliveredBySku[item.sku as unknown as string] = (deliveredBySku[item.sku as unknown as string] || 0) + delivered;
      }
    }
  }

  // Build line-level reconciliation
  const lines = (orderItems as Record<string,unknown>[]).map(item => {
    const ordered   = Number(item.qty) || 0;
    const delivered = deliveredBySku[item.sku as string] || 0;
    const due       = Math.max(0, ordered - delivered);
    return {
      sku:       item.sku,
      name:      item.name,
      unit_price: item.unit_price,
      qty_ordered:   ordered,
      qty_delivered: delivered,
      qty_due:       due,
      value_ordered:   ordered   * Number(item.unit_price),
      value_delivered: delivered * Number(item.unit_price),
      value_due:       due       * Number(item.unit_price),
      status: delivered === 0 ? 'not_delivered' : due === 0 ? 'fully_delivered' : 'partial',
    };
  });

  // Summary
  const totalLines     = lines.length;
  const deliveredLines = lines.filter(l => l.status === 'fully_delivered').length;
  const partialLines   = lines.filter(l => l.status === 'partial').length;
  const dueLines       = lines.filter(l => l.status !== 'fully_delivered').length;
  const noDeliveryLines= lines.filter(l => l.status === 'not_delivered').length;

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
      total_ordered_value:   lines.reduce((s,l)=>s+l.value_ordered,0),
      total_delivered_value: lines.reduce((s,l)=>s+l.value_delivered,0),
      total_due_value:       lines.reduce((s,l)=>s+l.value_due,0),
    },
  });
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;

  const body = await request.json() as {
    client_id: string;
    items: Array<{sku:string;name:string;qty:number;unit_price:number}>;
    notes?: string;
    order_type?: string;
    need_by_date?: string;
    save_as_draft?: boolean;
  };
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
    await env.DB.prepare(`INSERT INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes,order_type,need_by_date) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, body.client_id, user!.sub, "DRAFT", subtotal, gst, grand_total, body.notes||null, orderType, needByDate).run();
    for (const item of body.items) {
      await env.DB.prepare(`INSERT INTO order_items (id,order_id,sku,name,qty,unit_price,total) VALUES (?,?,?,?,?,?,?)`)
        .bind(uid(), id, item.sku, item.name, item.qty, item.unit_price, item.qty*item.unit_price).run();
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

  let status = "SUBMITTED";
  if (rule?.auto_approve) status = "APPROVED";
  else if (grand_total > (rule?.min_amount as number || 100000)) status = "PENDING_APPROVAL";

  const validTypes = ['Regular','Urgent','Ad-Hoc'];
  const orderType = validTypes.includes(body.order_type||'') ? body.order_type! : 'Regular';
  const needByDate = body.need_by_date || null;
  await env.DB.prepare(`INSERT INTO orders (id,client_id,created_by,status,subtotal,gst,grand_total,notes,order_type,need_by_date) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, body.client_id, user!.sub, status, subtotal, gst, grand_total, body.notes||null, orderType, needByDate).run();

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
  const {results} = await env.DB.prepare("SELECT * FROM order_allocations WHERE order_id=? ORDER BY sku").bind(id).all();
  return json(results);
}

async function handlePatchOrder(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const id = path.split("/").pop()!;
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
        // Replace unit_price with client-specific price where set
        results = (results as Record<string,unknown>[]).map(item => {
          const cp = priceMap[item.sku as string];
          return cp != null ? {...item, unit_price: cp, client_price: cp} : item;
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
  return json(results);
}

async function handleAddInventory(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user);
  if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const sku = `SKU${String(Math.floor(Math.random()*900+100)).padStart(3,"0")}`;
  await env.DB.prepare(`INSERT INTO inventory
    (sku,name,category,unit_price,stock,reorder_level,max_stock,vendor_id,hsn_code,gst_rate,emoji,
     uom,pack_size,units_per_case,weight_grams,barcode,sub_category,vendor_sku,vendor_lead_days,vendor_moq,
     mrp,cost_excl_gst,margin_pct,brand)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(sku,body.name,body.category,body.unit_price,body.stock||0,body.reorder_level||20,body.max_stock||200,
      body.vendor_id||null,body.hsn_code||"2101",body.gst_rate||18,body.emoji||"📦",
      body.uom||"unit",body.pack_size||1,body.units_per_case||1,body.weight_grams||0,
      body.barcode||"",body.sub_category||"Normal",body.vendor_sku||"",body.vendor_lead_days||3,body.vendor_moq||1,
      body.mrp||0,body.cost_excl_gst||0,body.margin_pct||0,body.brand||"").run();
  await audit(env, user, "CREATE", "inventory", sku, undefined, JSON.stringify({name:body.name,stock:body.stock}));
  return json({sku}, 201);
}

async function handleToggleCritical(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);
  const sku = decodeURIComponent(path.split("/")[3]);
  try {
    const item = await env.DB.prepare("SELECT is_critical FROM inventory WHERE sku=?").bind(sku).first() as Record<string,unknown>|null;
    if (!item) return json({error:"Not found"}, 404);
    const newVal = (item.is_critical as number) ? 0 : 1;
    await env.DB.prepare("UPDATE inventory SET is_critical=? WHERE sku=?").bind(newVal, sku).run();
    return json({ok:true, is_critical: newVal});
  } catch(e) {
    return json({error:"Migration 0021 not applied yet — run: npx wrangler d1 migrations apply smart-pantry-db --remote"}, 500);
  }
}

async function handleSendCriticalAlerts(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  if (!["super_admin","ops_admin","warehouse_exec","procurement_manager"].includes(user!.role)) return json({error:"Forbidden"}, 403);

  let results: Record<string,unknown>[];
  try {
    const res = await env.DB.prepare(`
      SELECT i.sku, i.name, i.stock, i.reorder_level, v.name as vendor_name, v.contact_email as vendor_email
      FROM inventory i LEFT JOIN vendors v ON i.vendor_id = v.id
      WHERE i.is_critical = 1 AND i.stock <= i.reorder_level AND i.active = 1
      ORDER BY i.stock ASC
    `).all();
    results = res.results as Record<string,unknown>[];
  } catch {
    return json({error:"Migration 0021 not applied yet — run: npx wrangler d1 migrations apply smart-pantry-db --remote"}, 500);
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
// VENDORS
// ════════════════════════════════════════════════════════════════════

async function handleListVendors(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const {results} = await env.DB.prepare("SELECT * FROM vendors ORDER BY name").all();
  return json(results);
}

async function handleAddVendor(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const id = `v${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO vendors (id,name,category,location,address,map_pin,contact_email,contact_phone) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id,body.name,body.category,body.location||'',body.address||'',body.map_pin||'',body.contact_email||null,body.contact_phone||null).run();
  await sendEmail(env, body.contact_email as string, "Welcome to Smart Pantry Vendor Portal",
    `Dear ${body.name},\n\nYou have been registered as a vendor on the Smart Pantry platform.\n\nVendor ID: ${id}\n\nRegards,\n4SYZ Smart Pantry Team`);
  await audit(env, user, "CREATE", "vendor", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handlePatchVendor(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").pop()!;
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
  if (body.active        !== undefined) { fields.push("active=?");        vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE vendors SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
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
  }

  query += " ORDER BY dc.dispatched_at DESC";
  const {results} = await env.DB.prepare(query).bind(...params).all();
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

  const body = await request.json().catch(()=>({})) as {items?:{sku:string;qty_delivered:number}[]};
  const {results: dcItems} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=?").bind(id).all() as {results: Record<string,unknown>[]};
  const dc = await env.DB.prepare("SELECT * FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!dc) return json({error:"Not found"}, 404);

  // Merge per-item delivered qtys (body.items if provided, else full dispatched qty)
  const deliveries = dcItems.map(di => {
    const override = body.items?.find(i => i.sku === di.sku);
    const qty_delivered = override !== undefined ? Math.max(0, Math.min(override.qty_delivered, di.qty_ordered as number)) : (di.qty_ordered as number);
    return { sku: di.sku as string, name: di.name as string, qty_delivered, qty_dispatched: di.qty_ordered as number };
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

  // Create follow-up DC for any items not fully delivered from this DC
  const shortItems = deliveries.filter(i => i.qty_delivered < i.qty_dispatched);
  if (shortItems.length > 0 && dc.order_id) {
    const newDCId = `DC-${Math.floor(Math.random()*9000+1000)}`;
    const remainingTotal = shortItems.reduce((s, i) => s + (i.qty_dispatched - i.qty_delivered), 0);
    await env.DB.prepare("INSERT INTO delivery_challans (id,order_id,status,total_qty) VALUES (?,?,'SCHEDULED',?)")
      .bind(newDCId, dc.order_id, remainingTotal).run();
    for (const r of shortItems) {
      await env.DB.prepare("INSERT INTO dc_items (id,dc_id,sku,name,qty_ordered,qty_delivered) VALUES (?,?,?,?,?,0)")
        .bind(uid(), newDCId, r.sku, r.name, r.qty_dispatched - r.qty_delivered).run();
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
      await env.DB.prepare("UPDATE orders SET status='CLOSED',updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')").bind(dc.order_id).run();
      await env.DB.prepare("INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,?,?,?,?,?)")
        .bind(uid(), dc.order_id, 'IN_SHIPMENT', 'CLOSED', user!.sub, user!.name, `Fully delivered — DC ${id}`).run();
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
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {delivered_qty:number;total_qty:number;notes?:string;items?:{sku:string;qty_delivered:number}[]};
  const {delivered_qty, total_qty, notes} = body;

  if (!delivered_qty || delivered_qty >= total_qty) {
    return json({error:"delivered_qty must be less than total_qty"}, 400);
  }

  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
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
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {vehicle_no?:string;driver_name?:string;driver_phone?:string;expected_delivery_date?:string};
  await env.DB.prepare("UPDATE delivery_challans SET status='IN_TRANSIT',vehicle_no=?,driver_name=?,driver_phone=?,dispatched_at=datetime('now'),expected_delivery_date=? WHERE id=?")
    .bind(body.vehicle_no||null, body.driver_name||null, body.driver_phone||null, body.expected_delivery_date||null, id).run();
  const dc = await env.DB.prepare("SELECT order_id FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,string>|null;
  if (dc?.order_id) {
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
  const {results} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=? ORDER BY name").bind(id).all();
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
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET pod_uploaded=1 WHERE id=?").bind(id).run();
  await audit(env, user, "POD_UPLOAD", "delivery_challan", id);
  return json({id, pod_uploaded:true});
}

async function handleMarkScan(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  await env.DB.prepare("UPDATE delivery_challans SET dc_scan_uploaded=1 WHERE id=?").bind(id).run();
  await audit(env, user, "DC_SCAN_UPLOAD", "delivery_challan", id);
  return json({id, dc_scan_uploaded:true});
}

async function handleUploadDCDoc(request: Request, env: Env, path: string, docType: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/")[3];
  const body = await request.json() as { filename?: string; mime_type?: string; content_b64: string; file_size?: number };
  if (!body.content_b64) return json({ error: "content_b64 required" }, 400);
  if (body.file_size && body.file_size > 5 * 1024 * 1024) return json({ error: "File too large (max 5 MB)" }, 400);

  try {
    await env.DB.prepare(
      `INSERT INTO dc_documents (dc_id, doc_type, filename, mime_type, content_b64, file_size, uploaded_by)
       VALUES (?,?,?,?,?,?,?)`
    ).bind(id, docType, body.filename||null, body.mime_type||null, body.content_b64, body.file_size||null, user?.name||null).run();
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
  await audit(env, user, docType === "pod" ? "POD_UPLOAD" : "DC_SCAN_UPLOAD", "delivery_challan", id, undefined, body.filename||"file");
  return json({ id, doc_type: docType, uploaded: true });
}

async function handleListDCDocs(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/")[3];
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, dc_id, doc_type, filename, mime_type, content_b64, file_size, uploaded_at, uploaded_by
       FROM dc_documents WHERE dc_id=? ORDER BY uploaded_at DESC`
    ).bind(id).all();
    return json(results);
  } catch {
    return json([]); // table not yet created — return empty list gracefully
  }
}

async function handleReturnDC(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const body = await request.json() as {reason?:string};

  // Get DC and items before cancelling
  const dc = await env.DB.prepare("SELECT * FROM delivery_challans WHERE id=?").bind(id).first() as Record<string,unknown>|null;
  if (!dc) return json({error:"DC not found"}, 404);

  const {results: dcItems} = await env.DB.prepare("SELECT * FROM dc_items WHERE dc_id=?").bind(id).all() as {results: Record<string,unknown>[]};

  // Mark DC as cancelled
  await env.DB.prepare("UPDATE delivery_challans SET status='CANCELLED' WHERE id=?").bind(id).run();

  // Restore inventory stock for returned items
  for (const item of dcItems) {
    if ((item.qty_delivered as number) > 0) {
      await env.DB.prepare("UPDATE inventory SET stock=stock+?,reserved=MAX(0,reserved-?) WHERE sku=?")
        .bind(item.qty_delivered, item.qty_delivered, item.sku).run();
      await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
        .bind(uid(), item.sku as string, 'RETURN', item.qty_delivered as number, id, 'delivery_challan',
          `Returned DC ${id}${body.reason ? ': ' + body.reason : ''}`, user!.name).run();
    }
  }

  // Revert order status
  if (dc.order_id) {
    await env.DB.prepare("UPDATE orders SET status='APPROVED',updated_at=datetime('now') WHERE id=? AND status IN ('IN_SHIPMENT','PARTIALLY_CLOSED')")
      .bind(dc.order_id).run();
    await env.DB.prepare(`INSERT INTO order_history (id,order_id,from_status,to_status,actor_id,actor_name,note) VALUES (?,?,'IN_SHIPMENT','APPROVED',?,?,?)`)
      .bind(uid(), dc.order_id, user!.sub, user!.name, `DC ${id} returned: ${body.reason||'No reason given'}`).run();
  }

  await pushNotification(env, "ops_admin", `DC ${id} returned/rejected — stock restored`);
  await audit(env, user, "RETURN", "delivery_challan", id, "IN_TRANSIT", "CANCELLED");
  return json({id, status:'CANCELLED'});
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
  const {results} = await env.DB.prepare("SELECT * FROM clients WHERE active=1 ORDER BY name").all();
  return json(results);
}

async function handleAddClient(request: Request, env: Env): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const body = await request.json() as Record<string,unknown>;
  const id = `c${uid().slice(0,6)}`;
  await env.DB.prepare("INSERT INTO clients (id,name,contact_email,contact_name,monthly_budget,approval_threshold,zone,contact_phone,map_pin,address) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(id,body.name,body.contact_email||null,body.contact_name||null,body.monthly_budget||500000,body.approval_threshold||100000,body.zone||'',body.contact_phone||'',body.map_pin||'',body.address||'').run();
  await audit(env, user, "CREATE", "client", id, undefined, body.name as string);
  return json({id}, 201);
}

async function handleClientBudget(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const id = path.split("/").slice(-2)[0];
  const client = await env.DB.prepare(
    "SELECT monthly_budget, spent_this_month, approval_threshold FROM clients WHERE id=?"
  ).bind(id).first() as Record<string,number>|null;
  if (!client) return json({error:"Client not found"}, 404);
  return json({ monthly_budget: client.monthly_budget, used: client.spent_this_month, approval_threshold: client.approval_threshold });
}

async function handlePatchClient(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
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
  if (body.active             !== undefined) { fields.push("active=?");             vals.push(body.active); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE clients SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
}

// ════════════════════════════════════════════════════════════════════
// CLIENT CATALOG (per-client product assignments)
// ════════════════════════════════════════════════════════════════════

async function handleGetClientCatalog(request: Request, env: Env, path: string): Promise<Response> {
  const user = await getUser(request, env);
  const denied = requireUser(user); if (denied) return denied;
  const clientId = path.split("/")[3];
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
  const body = await request.json() as { skus: string[] };
  if (!Array.isArray(body.skus) || !body.skus.length) return json({error:"skus array required"}, 400);
  const stmts = body.skus.map(sku =>
    env.DB.prepare("INSERT OR IGNORE INTO client_catalog (client_id,sku,added_by) VALUES (?,?,?)")
      .bind(clientId, sku, user!.sub)
  );
  await env.DB.batch(stmts);
  await audit(env, user, "UPDATE", "client_catalog", clientId, undefined, `added ${body.skus.length} items`);
  return json({added: body.skus.length});
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
    const valid = hash.startsWith("hash:") ? await verifyPassword(body.current_password, hash.slice(5)) : body.current_password === hash;
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
  const body = await request.json() as {po_id:string;sku:string;qty_received:number;notes?:string};
  const {po_id, sku, qty_received, notes} = body;
  if (!po_id || !qty_received) return json({error:"po_id and qty_received required"}, 400);

  const id = uid();
  await env.DB.prepare("INSERT INTO grn_records (id,po_id,received_at,received_by,qty_received,notes) VALUES (?,?,datetime('now'),?,?,?)")
    .bind(id, po_id, user!.sub, qty_received, notes||null).run();

  // Update inventory stock
  if (sku) {
    await env.DB.prepare("UPDATE inventory SET stock=stock+? WHERE sku=?").bind(qty_received, sku).run();
    await env.DB.prepare("INSERT INTO stock_movements (id,sku,type,qty_change,reference_id,reference_type,note,actor) VALUES (?,?,?,?,?,?,?,?)")
      .bind(uid(), sku, 'GRN', qty_received, id, 'grn', `Received via GRN for PO ${po_id}`, user!.name).run();
  }

  // Update PO status to INVOICED and vendor metrics
  const po = await env.DB.prepare("SELECT * FROM purchase_orders WHERE id=?").bind(po_id).first() as Record<string,unknown>|null;
  if (po) {
    await env.DB.prepare("UPDATE purchase_orders SET status='INVOICED',updated_at=datetime('now') WHERE id=?").bind(po_id).run();
    // Vendor metrics: on_time = delivered before expected_delivery
    const expectedDate = po.expected_delivery ? new Date(po.expected_delivery as string) : null;
    const isOnTime = expectedDate ? new Date() <= expectedDate : true;
    const leadDays = Math.max(1, Math.round((Date.now() - new Date(po.created_at as string).getTime()) / 86400000));
    // Recalculate vendor averages using recent POs
    const {results: recentGRNs} = await env.DB.prepare(`
      SELECT p.expected_delivery, g.received_at, julianday(g.received_at)-julianday(p.created_at) as lead
      FROM grn_records g JOIN purchase_orders p ON g.po_id=p.id
      WHERE p.vendor_id=? ORDER BY g.received_at DESC LIMIT 10`).bind(po.vendor_id).all() as {results: Record<string,unknown>[]};
    const onTimeCount = recentGRNs.filter(g => !g.expected_delivery || new Date(g.received_at as string) <= new Date(g.expected_delivery as string)).length;
    const avgLead = recentGRNs.reduce((s, g) => s + (g.lead as number || 3), 0) / (recentGRNs.length || 1);
    const onTimeRate = Math.round((onTimeCount / (recentGRNs.length || 1)) * 100);
    await env.DB.prepare("UPDATE vendors SET on_time_rate=?,avg_lead_days=? WHERE id=?")
      .bind(onTimeRate, Math.round(avgLead), po.vendor_id).run();
  }

  // Check auto-reorder after stock increase
  await checkAutoReorder(env, user);
  await audit(env, user, "GRN", "inventory", sku||po_id, undefined, `qty_received:${qty_received}`);
  return json({id, qty_received}, 201);
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

  try {
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
      const {results} = await env.DB.prepare(`SELECT sku,name,category,stock,reorder_level,max_stock,is_critical,
        ROUND(stock*100.0/max_stock,1) as utilisation_pct,
        CASE WHEN stock<=reorder_level THEN 'LOW' WHEN stock<=reorder_level*1.5 THEN 'MEDIUM' ELSE 'OK' END as stock_health
        FROM inventory WHERE active=1 ORDER BY is_critical DESC, utilisation_pct ASC`).all();
      return json({type,from,to,data:results});
    }
    case "critical-stock": {
      try {
        const {results} = await env.DB.prepare(`
          SELECT i.sku, i.name, i.category, i.stock, i.reorder_level, i.max_stock,
            CASE WHEN i.stock=0 THEN 'OUT' WHEN i.stock<=i.reorder_level THEN 'LOW' ELSE 'WATCH' END as status,
            v.name as vendor_name, v.contact_email as vendor_email, v.avg_lead_days
          FROM inventory i LEFT JOIN vendors v ON i.vendor_id=v.id
          WHERE i.is_critical=1 AND i.active=1
          ORDER BY i.stock ASC, i.name ASC`).all();
        return json({type,from,to,data:results});
      } catch {
        return json({type,from,to,data:[],note:"Apply migration 0021 to enable critical stock tracking"});
      }
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
    case "budget-forecast": {
      const {results: clients2} = await env.DB.prepare("SELECT id,name FROM clients WHERE active=1").all();
      const forecast = [];
      for (const cl of clients2 as Record<string,unknown>[]) {
        const {results: history} = await env.DB.prepare(`
          SELECT strftime('%Y-%m',created_at) as month, SUM(grand_total) as actual
          FROM orders WHERE client_id=? AND status NOT IN ('CANCELLED')
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
      COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0) AS delivered_qty,
      oi.qty - COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0) AS due_qty,
      (oi.qty - COALESCE((SELECT SUM(CASE WHEN dc2.status='DELIVERED' AND dci.qty_delivered=0 THEN dci.qty_ordered ELSE dci.qty_delivered END) FROM dc_items dci JOIN delivery_challans dc2 ON dci.dc_id=dc2.id WHERE dc2.order_id=o.id AND dci.sku=oi.sku),0)) * oi.unit_price AS due_value,
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
      SUM(oi.qty) - COALESCE(SUM(dci_sum.qty_delivered),0) AS shortfall_qty,
      SUM(oi.qty) - COALESCE(SUM(dci_sum.qty_delivered),0) AS suggested_po_qty,
      GROUP_CONCAT(DISTINCT c.name) AS clients,
      COALESCE(v.name,'') AS primary_vendor,
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
    WHERE o.status NOT IN ('CANCELLED','DRAFT') AND date(o.created_at) >= ? AND date(o.created_at) <= ?
    GROUP BY c.id ORDER BY fulfilment_pct ASC`).bind(from, to).all();
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
  const {results} = await env.DB.prepare(
    "SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50"
  ).all();
  return json(results);
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
  const id = path.split("/").pop()!;
  const body = await request.json() as Record<string,unknown>;
  const fields: string[] = []; const vals: unknown[] = [];
  if (body.dc_number       !== undefined) { fields.push("dc_number=?");       vals.push(body.dc_number||null); }
  if (body.staff_id        !== undefined) { fields.push("staff_id=?");        vals.push(body.staff_id||null); }
  if (body.scheduled_time  !== undefined) { fields.push("scheduled_time=?");  vals.push(body.scheduled_time||null); }
  if (body.driver_name     !== undefined) { fields.push("driver_name=?");     vals.push(body.driver_name||null); }
  if (body.vehicle_no      !== undefined) { fields.push("vehicle_no=?");      vals.push(body.vehicle_no||null); }
  if (!fields.length) return json({error:"Nothing to update"}, 400);
  vals.push(id);
  await env.DB.prepare(`UPDATE delivery_challans SET ${fields.join(",")} WHERE id=?`).bind(...vals).run();
  return json({id});
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

  let sql = `SELECT ci.*,
    CASE WHEN ci.qty_on_hand = 0 THEN 'out' WHEN ci.reorder_level > 0 AND ci.qty_on_hand <= ci.reorder_level THEN 'low' ELSE 'ok' END AS stock_status
    FROM client_inventory ci WHERE ci.client_id=?`;
  const binds: unknown[] = [clientId];
  if (q) { sql += ` AND (ci.item_name LIKE ? OR ci.sku LIKE ? OR ci.category LIKE ?)`; const like = `%${q}%`; binds.push(like,like,like); }
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

  const newQty = Math.max(0, (row.qty_on_hand as number) - body.qty);
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
  const body = await request.json() as {reorder_level?:number;qty_on_hand?:number;item_name?:string};

  const isClientRole = ['client_admin','client_user','client_approver'].includes(user!.role);
  if (!isClientRole) return json({error:"Forbidden"}, 403);
  const clientId = user!.client_id;
  if (!clientId) return json({error:"Client not linked to your account"}, 400);

  const sets: string[] = ['updated_at=datetime(\'now\')'];
  const vals: unknown[] = [];
  if (body.item_name     !== undefined) { sets.push('item_name=?');     vals.push(body.item_name.trim()); }
  if (body.reorder_level !== undefined) { sets.push('reorder_level=?'); vals.push(body.reorder_level); }
  if (body.qty_on_hand   !== undefined) { sets.push('qty_on_hand=?');   vals.push(Math.max(0, body.qty_on_hand)); }
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
