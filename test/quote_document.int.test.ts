// Integration tests for Quotations send + customer document + lifecycle
// (milestone 006, Slice 5): APPROVED → SENT generates a redacted, hash-stamped
// customer document; GET /document returns it; accept/lost transitions; the
// document carries no cost/margin and its stored hash matches the stamped body.
import { SELF, env } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

const migrationModules = import.meta.glob<string>("../migrations/*.sql", { as: "raw", eager: true });
const migrations = Object.entries(migrationModules).sort(([a], [b]) => a.localeCompare(b)).map(([, sql]) => sql);

const BASE = "http://localhost";
const hdr = (t?: string) => ({ "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
const get = (p: string, t?: string) => SELF.fetch(`${BASE}${p}`, { headers: hdr(t) });
const post = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "POST", headers: hdr(t), body: JSON.stringify(b) });
const put = (p: string, b: unknown, t?: string) => SELF.fetch(`${BASE}${p}`, { method: "PUT", headers: hdr(t), body: JSON.stringify(b) });
async function login(email: string, pw: string) { return (await (await post("/api/auth/login", { email, password: pw })).json() as any).token as string; }
const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));

let adminTok: string, salesTok: string, mgrTok: string, finTok: string, opsTok: string;

const line = (itc: boolean) => ({ sku: null, qty: 1, pricing_mode: "cost_markup", purchase_cost_paise: 10000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: itc });
const CREATE = (itc = true) => ({ client_id: "c1", place_of_supply: "KL", lines: [line(itc)] });

beforeAll(async () => {
  const db = env.DB as D1Database;
  for (const sql of migrations) {
    for (const stmt of sql.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter((s) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)\s/i.test(s))) {
      for (let a = 0; ; a++) {
        try { await db.prepare(stmt).run(); break; }
        catch (e: any) { const m = String(e);
          if (m.includes("duplicate column") || m.includes("already exists") || m.includes("UNIQUE constraint")) break;
          if (m.includes("internal error") && a < 4) { await new Promise((r) => setTimeout(r, 100 * (a + 1))); continue; }
          throw e; }
      }
    }
  }
  const mk = (id: string, email: string, role: string) =>
    db.prepare("INSERT OR IGNORE INTO users (id,email,password_hash,role,name,org,initials,active) VALUES (?,?,?,?,?,?,?,1)")
      .bind(id, email, "SEED:pw123", role, id, "SmartPantry", "XX").run();
  await mk("tst-dadmin", "dadmin@sp.test", "super_admin");
  await mk("tst-dsales", "dsales@sp.test", "procurement_manager");
  await mk("tst-dmgr", "dmgr@sp.test", "warehouse_exec");
  await mk("tst-dfin", "dfin@sp.test", "delivery_exec");
  await mk("tst-dops", "dops@sp.test", "delivery_exec");
  await db.prepare("INSERT OR IGNORE INTO clients (id,name,contact_email,active) VALUES ('c1','Meta India','x@y.z',1)").run();
  await db.prepare("INSERT OR IGNORE INTO vendors (id,name,category) VALUES ('v-gift','Gifto Supplies','Gifting')").run();
  await get("/api/quotes"); // warm schema into the per-test baseline
  await get("/api/gifting-orders"); // warm gifting_items into the baseline (module-flag vs rollback hazard)
  adminTok = await login("dadmin@sp.test", "pw123");
  salesTok = await login("dsales@sp.test", "pw123");
  mgrTok = await login("dmgr@sp.test", "pw123");
  finTok = await login("dfin@sp.test", "pw123");
  opsTok = await login("dops@sp.test", "pw123");
});

async function prep() {
  await put("/api/admin/quote-settings", { _ver: 0, seller_state_code: "KL" }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dsales", quoteRole: "sales", _ver: 0 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dmgr", quoteRole: "commercial_manager", _ver: 1 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dfin", quoteRole: "finance", _ver: 2 }, adminTok);
  await put("/api/admin/quote-access", { userId: "tst-dops", quoteRole: "ops", _ver: 3 }, adminTok);
}
const createAs = async (tok: string, itc = true) => (await (await post("/api/quotes", CREATE(itc), tok)).json() as any).id as string;
async function approvedQuote(): Promise<string> {
  const id = await createAs(salesTok);                 // ITC=yes → manager leg only
  await post(`/api/quotes/${id}/submit`, {}, salesTok);
  await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
  return id;
}

describe("send + customer document (Slice 5)", () => {
  it("APPROVED → SENT: stamps sent_at + default valid_until, document hash matches stored + stamped body", async () => {
    await prep();
    const id = await approvedQuote();
    const sent = await post(`/api/quotes/${id}/send`, {}, salesTok);
    expect(sent.status).toBe(200);
    const sb = await sent.json() as any;
    expect(sb.status).toBe("SENT");
    expect(sb.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // default validity = 30 days after sent_at
    const expUntil = new Date(Date.parse(sb.sent_at + "T00:00:00Z") + 30 * 86400000).toISOString().slice(0, 10);
    expect(sb.valid_until).toBe(expUntil);
    expect(sb.document_hash).toMatch(/^[0-9a-f]{64}$/);

    const doc = await get(`/api/quotes/${id}/document`, salesTok);
    expect(doc.status).toBe(200);
    const d = await doc.json() as any;
    expect(d.content_hash).toBe(sb.document_hash);
    const html = b64decode(d.content_b64);
    // the hash is stamped into the body (placeholder resolved) and matches the stored hash
    expect(html).toContain(sb.document_hash);
    expect(html).not.toContain("__QUOTE_DOC_HASH__");
    // redacted: no cost / margin / ITC leakage to the customer document
    expect(html.toLowerCase()).not.toContain("margin");
    expect(html.toLowerCase()).not.toContain("landed");
    expect(html.toLowerCase()).not.toContain("purchase_cost");
    expect(html).toContain("Grand total");
  });

  it("send is 409 unless APPROVED", async () => {
    await prep();
    const id = await createAs(salesTok);               // still DRAFT
    expect((await post(`/api/quotes/${id}/send`, {}, salesTok)).status).toBe(409);
  });

  it("document is 404 before the quote is sent", async () => {
    await prep();
    const id = await approvedQuote();
    const r = await get(`/api/quotes/${id}/document`, salesTok);
    expect(r.status).toBe(404);
    expect((await r.json() as any).code).toBe("E_NO_DOCUMENT");
  });

  it("SENT → ACCEPTED", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const acc = await post(`/api/quotes/${id}/accept`, {}, salesTok);
    expect(acc.status).toBe(200);
    expect((await acc.json() as any).status).toBe("ACCEPTED");
    expect((await (await get(`/api/quotes/${id}`, salesTok)).json() as any).status).toBe("ACCEPTED");
  });

  it("lost requires a reason (422) then marks LOST and records it", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/lost`, {}, salesTok)).status).toBe(422);
    const lost = await post(`/api/quotes/${id}/lost`, { reason: "chose a competitor" }, salesTok);
    expect(lost.status).toBe(200);
    const lb = await lost.json() as any;
    expect(lb.status).toBe("LOST");
    expect(lb.lost_reason).toBe("chose a competitor");
  });

  it("accept is 409 when not SENT; finance (a raiser role) may send", async () => {
    await prep();
    const id = await approvedQuote();
    expect((await post(`/api/quotes/${id}/accept`, {}, salesTok)).status).toBe(409); // still APPROVED
    const sent = await post(`/api/quotes/${id}/send`, {}, finTok);
    expect(sent.status).toBe(200);                                                   // finance may send now
    expect((await sent.json() as any).status).toBe("SENT");
  });
});

describe("admin-editable document terms", () => {
  it("payment terms + T&C from settings appear on the sent document", async () => {
    await prep();
    const cur = await (await get("/api/admin/quote-settings", adminTok)).json() as any;
    await put("/api/admin/quote-settings", { ...cur, _ver: cur._ver, seller_state_code: "KL",
      payment_terms: "100% advance against this quotation", terms: "First custom clause\nSecond custom clause" }, adminTok);
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const html = b64decode((await (await get(`/api/quotes/${id}/document`, salesTok)).json() as any).content_b64);
    expect(html).toContain("100% advance against this quotation");
    expect(html).toContain("First custom clause");
    expect(html).toContain("Second custom clause");
    expect(html).toContain("Amount in words");
    // still redacted
    expect(html.toLowerCase()).not.toContain("margin");
    expect(html.toLowerCase()).not.toContain("landed");
  });
});

describe("post-send revision with lineage", () => {
  async function sentQuote(): Promise<string> {
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    return id;
  }
  it("revise from SENT creates a linked Rev 2 DRAFT and supersedes the original", async () => {
    await prep();
    const id = await sentQuote();
    const r = await post(`/api/quotes/${id}/revise`, {}, salesTok);
    expect(r.status).toBe(200);
    const rb = await r.json() as any;
    expect(rb.status).toBe("DRAFT");
    expect(rb.revision).toBe(2);
    expect(rb.revised_from_id).toBe(id);
    expect(rb.quote_no).toMatch(/-R2$/);
    // original is now SUPERSEDED and points to the revision
    const parent = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(parent.status).toBe("SUPERSEDED");
    expect(parent.superseded_by_id).toBe(rb.id);
    // the revision carries the copied lines + lineage back-link
    const child = await (await get(`/api/quotes/${rb.id}`, salesTok)).json() as any;
    expect(child.revision).toBe(2);
    expect(child.revised_from_id).toBe(id);
    expect(child.lines.length).toBe(1);
    expect(child.grand_total_paise).toBe(parent.grand_total_paise);
  });
  it("a quote cannot be revised twice, and DRAFT cannot be revised", async () => {
    await prep();
    const id = await sentQuote();
    await post(`/api/quotes/${id}/revise`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/revise`, {}, salesTok)).status).toBe(409); // already revised
    const draft = await createAs(salesTok);
    expect((await post(`/api/quotes/${draft}/revise`, {}, salesTok)).status).toBe(409); // bad transition
  });
  it("ops (view-only) cannot revise or convert", async () => {
    await prep();
    const id = await sentQuote();
    expect((await post(`/api/quotes/${id}/revise`, {}, opsTok)).status).toBe(403);
    await post(`/api/quotes/${id}/accept`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/convert`, {}, opsTok)).status).toBe(403);
  });
});

describe("convert accepted quote to order", () => {
  async function acceptedQuote(): Promise<string> {
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    await post(`/api/quotes/${id}/accept`, {}, salesTok);
    return id;
  }
  it("convert creates a DRAFT order carrying the quote's agreed totals, and marks the quote CONVERTED", async () => {
    await prep();
    const id = await acceptedQuote();
    const q = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    const r = await post(`/api/quotes/${id}/convert`, {}, salesTok);
    expect(r.status).toBe(200);
    const rb = await r.json() as any;
    expect(rb.order_id).toMatch(/^SP-/);
    expect(rb.order_status).toBe("DRAFT");
    // quote is CONVERTED and linked to the order
    const after = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(after.status).toBe("CONVERTED");
    expect(after.converted_order_id).toBe(rb.order_id);
    // order carries the quote's grand total exactly and links back
    const order = await (await get(`/api/orders/${rb.order_id}`, adminTok)).json() as any;
    expect(order.status).toBe("DRAFT");
    expect(order.source_quote_id).toBe(id);
    expect(Math.round(order.grand_total * 100)).toBe(q.grand_total_paise);
  });
  it("convert is 409 unless ACCEPTED and cannot run twice", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/convert`, {}, salesTok)).status).toBe(409); // SENT, not ACCEPTED
    await post(`/api/quotes/${id}/accept`, {}, salesTok);
    expect((await post(`/api/quotes/${id}/convert`, {}, salesTok)).status).toBe(200);
    expect((await post(`/api/quotes/${id}/convert`, {}, salesTok)).status).toBe(409); // already converted
  });
});

describe("gifting orders (milestone 007, Slice 1)", () => {
  async function acceptedGiftingQuote(lines = 2): Promise<string> {
    const body = { client_id: "c1", place_of_supply: "KL", kind: "GIFTING", lines: Array.from({ length: lines }, () => line(true)) };
    const id = (await (await post("/api/quotes", body, salesTok)).json() as any).id as string;
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    await post(`/api/quotes/${id}/accept`, {}, salesTok);
    return id;
  }

  it("converting a GIFTING quote seeds one gifting item per line and lists it in the gifting pipeline (not the regular orders list)", async () => {
    await prep();
    const id = await acceptedGiftingQuote(2);
    const rb = await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any;
    expect(rb.order_kind).toBe("GIFTING");
    const orderId = rb.order_id as string;

    // appears in the gifting pipeline with 2 items, all TO_ORDER (none ready)
    const gifts = await (await get("/api/gifting-orders", adminTok)).json() as any[];
    const row = gifts.find((g) => g.id === orderId);
    expect(row).toBeTruthy();
    expect(row.item_count).toBe(2);
    expect(row.ready_count).toBe(0);
    expect(row.phase).toBe("PROCURING");

    // and is EXCLUDED from the regular orders list
    const orders = await (await get("/api/orders", adminTok)).json() as any[];
    expect(orders.find((o) => o.id === orderId)).toBeFalsy();

    const detail = await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any;
    expect(detail.items.length).toBe(2);
    expect(detail.items.every((i: any) => i.stage === "TO_ORDER")).toBe(true);
  });

  it("an item cannot be ordered without a vendor; with one it advances; a non-branded item reaches AT_OFFICE then DISPATCHED", async () => {
    await prep();
    const id = await acceptedGiftingQuote(1);
    const orderId = (await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any).order_id as string;
    const itemId = (await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any).items[0].id as string;

    // advance without a vendor → 409
    expect((await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).status).toBe(409);
    // set vendor, then advance through the non-branded path
    expect((await post(`/api/gifting-items/${itemId}/vendor`, { vendor_id: "v-gift" }, adminTok)).status).toBe(200);
    expect((await (await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).json() as any).stage).toBe("ORDERED");
    expect((await (await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).json() as any).stage).toBe("RECEIVED");
    expect((await (await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).json() as any).stage).toBe("AT_OFFICE");
    // at office, item-level advance is blocked — dispatch is order-level (Slice 3)
    const atOffice = await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok);
    expect(atOffice.status).toBe(409);
    expect((await atOffice.json() as any).code).toBe("E_USE_DISPATCH");
  });

  async function brandedItemAtBranding(): Promise<{ orderId: string; itemId: string }> {
    const id = await acceptedGiftingQuote(1);
    const orderId = (await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any).order_id as string;
    const itemId = (await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any).items[0].id as string;
    await post(`/api/gifting-items/${itemId}/branding`, { needs_branding: true }, adminTok);
    await post(`/api/gifting-items/${itemId}/vendor`, { vendor_id: "v-gift" }, adminTok);
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok);   // ORDERED
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok);   // RECEIVED
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok);   // BRANDING
    return { orderId, itemId };
  }
  const itemOf = async (orderId: string, itemId: string) =>
    (await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any).items.find((i: any) => i.id === itemId);
  const formPost = (p: string, body: string) =>
    SELF.fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });

  it("a branded item diverts to BRANDING; ops sends a sample instead of advancing", async () => {
    await prep();
    const { itemId } = await brandedItemAtBranding();
    const blocked = await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok);
    expect(blocked.status).toBe(409);
    expect((await blocked.json() as any).code).toBe("E_USE_SAMPLE");
  });

  it("Slice 2: send sample → SAMPLE_SENT + token; the client approves via the public link → APPROVED", async () => {
    await prep();
    const { orderId, itemId } = await brandedItemAtBranding();
    const s = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "Logo on lid, gold foil" }, adminTok)).json() as any;
    expect(s.stage).toBe("SAMPLE_SENT");
    expect(s.approval_token).toBeTruthy();
    expect(s.round).toBe(1);
    // ops cannot advance a SAMPLE_SENT item — the client must decide
    expect((await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).status).toBe(409);
    // the public page loads as HTML without auth
    const page = await get(`/gift-approve/${s.approval_token}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    // client approves (unauthenticated form POST)
    const ok = await formPost(`/gift-approve/${s.approval_token}`, "decision=APPROVED");
    expect(ok.status).toBe(200);
    expect(await itemOf(orderId, itemId).then((i: any) => i.stage)).toBe("APPROVED");
    // then ops can collect it at office
    expect((await (await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok)).json() as any).stage).toBe("AT_OFFICE");
  });

  it("Slice 2: the client rejects → item loops back to BRANDING with the reason; a new round can be sent", async () => {
    await prep();
    const { orderId, itemId } = await brandedItemAtBranding();
    const s = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "v1" }, adminTok)).json() as any;
    const rej = await formPost(`/gift-approve/${s.approval_token}`, "decision=REJECTED&reason=" + encodeURIComponent("Make the logo bigger"));
    expect(rej.status).toBe(200);
    const it = await itemOf(orderId, itemId);
    expect(it.stage).toBe("BRANDING");
    expect(it.sample.decision).toBe("REJECTED");
    expect(it.sample.reject_reason).toBe("Make the logo bigger");
    // a second sample round opens
    const s2 = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "v2 bigger logo" }, adminTok)).json() as any;
    expect(s2.round).toBe(2);
    expect(s2.stage).toBe("SAMPLE_SENT");
    // the first token is single-use: deciding again just reports it was already reviewed
    const again = await formPost(`/gift-approve/${s.approval_token}`, "decision=APPROVED");
    expect(again.status).toBe(200);
    expect(await itemOf(orderId, itemId).then((i: any) => i.stage)).toBe("SAMPLE_SENT"); // unchanged by the stale token
  });

  it("Slice 3: partial dispatch creates a Gifting DC for the at-office items; the order closes when all are dispatched", async () => {
    await prep();
    const id = await acceptedGiftingQuote(2);
    const orderId = (await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any).order_id as string;
    const [a, b] = (await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any).items as any[];
    const toOffice = async (itemId: string) => {
      await post(`/api/gifting-items/${itemId}/vendor`, { vendor_id: "v-gift" }, adminTok);
      await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // ORDERED
      await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // RECEIVED
      await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // AT_OFFICE (non-branded)
    };

    // nothing ready yet → 409
    expect((await post(`/api/gifting-orders/${orderId}/dispatch`, {}, adminTok)).status).toBe(409);

    await toOffice(a.id);
    const d1 = await (await post(`/api/gifting-orders/${orderId}/dispatch`, {}, adminTok)).json() as any;
    expect(d1.dispatched).toBe(1);
    expect(d1.all_dispatched).toBe(false);
    expect(d1.dc_number).toBeTruthy();
    expect(await itemOf(orderId, a.id).then((i: any) => i.stage)).toBe("DISPATCHED");

    // a real DC + dc_items were written, linked to the gifting order
    const db = env.DB as D1Database;
    const dc = await db.prepare("SELECT order_id, status, dc_class FROM delivery_challans WHERE id=?").bind(d1.dc_id).first() as any;
    expect(dc.order_id).toBe(orderId);
    expect(dc.status).toBe("DISPATCHED");
    expect(dc.dc_class).toBe("GIFTING");
    const dcItems = (await db.prepare("SELECT id FROM dc_items WHERE dc_id=?").bind(d1.dc_id).all()).results;
    expect(dcItems.length).toBe(1);

    // dispatch the second item → order fully dispatched; then nothing left
    await toOffice(b.id);
    const d2 = await (await post(`/api/gifting-orders/${orderId}/dispatch`, {}, adminTok)).json() as any;
    expect(d2.all_dispatched).toBe(true);
    expect((await post(`/api/gifting-orders/${orderId}/dispatch`, {}, adminTok)).status).toBe(409);
  });

  it("Slice 4: convert carries each line's sale value; setting costs yields margin and the order rollup aggregates", async () => {
    await prep();
    const id = await acceptedGiftingQuote(2);
    const orderId = (await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any).order_id as string;
    const detail = await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any;
    // line() → ex-GST cost 10000 × (1 + 20%) = 12000 paise sale per line.
    expect(detail.items.every((i: any) => i.sale_value_paise === 12000)).toBe(true);
    expect(detail.items.every((i: any) => i.cost_paise === 0 && i.margin_paise === 12000)).toBe(true);
    expect(detail.totals).toMatchObject({ sale_paise: 24000, procurement_paise: 0, branding_paise: 0, cost_paise: 0, margin_paise: 24000 });

    // set a buying + branding cost on the first item (rupees → paise)
    const a = detail.items[0];
    const r = await (await post(`/api/gifting-items/${a.id}/costs`, { procurement_cost: 50, branding_cost: 10 }, adminTok)).json() as any;
    expect(r.procurement_cost_paise).toBe(5000);
    expect(r.branding_cost_paise).toBe(1000);
    expect(r.cost_paise).toBe(6000);
    expect(r.margin_paise).toBe(6000); // 12000 sale − 6000 cost

    // partial update: only branding on the same item leaves buying cost intact
    await post(`/api/gifting-items/${a.id}/costs`, { branding_cost: 20 }, adminTok);
    const after = await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any;
    const a2 = after.items.find((i: any) => i.id === a.id);
    expect(a2.procurement_cost_paise).toBe(5000);
    expect(a2.branding_cost_paise).toBe(2000);
    expect(a2.margin_paise).toBe(12000 - 7000);
    expect(after.totals).toMatchObject({ sale_paise: 24000, cost_paise: 7000, margin_paise: 17000 });

    // the pipeline list rollup reflects the same cost / margin
    const row = (await (await get("/api/gifting-orders", adminTok)).json() as any[]).find((g) => g.id === orderId);
    expect(row.sale_paise).toBe(24000);
    expect(row.cost_paise).toBe(7000);
    expect(row.margin_paise).toBe(17000);
  });

  it("Slice 4: a negative cost is rejected, and costs lock once the item is dispatched", async () => {
    await prep();
    const id = await acceptedGiftingQuote(1);
    const orderId = (await (await post(`/api/quotes/${id}/convert`, {}, salesTok)).json() as any).order_id as string;
    const itemId = (await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any).items[0].id as string;

    expect((await post(`/api/gifting-items/${itemId}/costs`, { procurement_cost: -5 }, adminTok)).status).toBe(422);

    // drive to AT_OFFICE then dispatch (non-branded)
    await post(`/api/gifting-items/${itemId}/vendor`, { vendor_id: "v-gift" }, adminTok);
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // ORDERED
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // RECEIVED
    await post(`/api/gifting-items/${itemId}/advance`, {}, adminTok); // AT_OFFICE
    await post(`/api/gifting-orders/${orderId}/dispatch`, {}, adminTok);

    const locked = await post(`/api/gifting-items/${itemId}/costs`, { procurement_cost: 10 }, adminTok);
    expect(locked.status).toBe(409);
    expect((await locked.json() as any).code).toBe("E_STAGE");
  });

  it("Slice 5: sample history returns every round with its decision + reason, oldest first; detail reports the round count", async () => {
    await prep();
    const { orderId, itemId } = await brandedItemAtBranding();
    // round 1 → rejected with a reason
    const s1 = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "v1 small logo" }, adminTok)).json() as any;
    await formPost(`/gift-approve/${s1.approval_token}`, "decision=REJECTED&reason=" + encodeURIComponent("Make the logo bigger"));
    // round 2 → approved
    const s2 = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "v2 big logo" }, adminTok)).json() as any;
    expect(s2.round).toBe(2);
    await formPost(`/gift-approve/${s2.approval_token}`, "decision=APPROVED");

    const hist = await (await get(`/api/gifting-items/${itemId}/samples`, adminTok)).json() as any;
    expect(hist.item.id).toBe(itemId);
    expect(hist.samples.length).toBe(2);
    expect(hist.samples[0]).toMatchObject({ round: 1, ref: "v1 small logo", decision: "REJECTED", reject_reason: "Make the logo bigger" });
    expect(hist.samples[1]).toMatchObject({ round: 2, ref: "v2 big logo", decision: "APPROVED" });
    expect(hist.samples[0].sent_at).toBeTruthy();
    expect(hist.samples[1].decided_at).toBeTruthy();

    // the order detail now reports how many rounds the item has had
    const detail = await (await get(`/api/gifting-orders/${orderId}`, adminTok)).json() as any;
    const it = detail.items.find((i: any) => i.id === itemId);
    expect(it.sample_rounds).toBe(2);
  });

  it("Slice 6: sending a sample notifies the client with the approval link; a decision notifies ops", async () => {
    await prep();
    const { itemId } = await brandedItemAtBranding();
    const db = env.DB as D1Database;
    const s = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "Gold foil logo" }, adminTok)).json() as any;

    // a client-facing notification carries the tokenised approval link
    const clientNote = await db.prepare("SELECT message FROM notifications WHERE message LIKE '%gift-approve/%' ORDER BY rowid DESC LIMIT 1")
      .first() as { message: string } | null;
    expect(clientNote).toBeTruthy();
    expect(clientNote!.message).toContain("/gift-approve/" + s.approval_token);

    // the client requests changes → ops is notified with the item + reason
    await formPost(`/gift-approve/${s.approval_token}`, "decision=REJECTED&reason=" + encodeURIComponent("Logo too small"));
    const opsNote = await db.prepare("SELECT message FROM notifications WHERE user_role='ops_admin' AND message LIKE '%requested changes%' ORDER BY rowid DESC LIMIT 1").first() as { message: string } | null;
    expect(opsNote).toBeTruthy();
    expect(opsNote!.message).toContain("Logo too small");

    // and an approval on a fresh sample notifies ops it's ready to collect
    const s2 = await (await post(`/api/gifting-items/${itemId}/sample`, { ref: "Gold foil v2" }, adminTok)).json() as any;
    await formPost(`/gift-approve/${s2.approval_token}`, "decision=APPROVED");
    const okNote = await db.prepare("SELECT message FROM notifications WHERE user_role='ops_admin' AND message LIKE '%APPROVED%' ORDER BY rowid DESC LIMIT 1").first() as { message: string } | null;
    expect(okNote).toBeTruthy();
    expect(okNote!.message).toContain("ready to collect");
  });
});

describe("per-quote purpose + payment terms override", () => {
  it("title + payment_terms are stored, returned, searchable in the list, and the override prints on the document", async () => {
    await prep();
    const cur = await (await get("/api/admin/quote-settings", adminTok)).json() as any;
    await put("/api/admin/quote-settings", { ...cur, _ver: cur._ver, seller_state_code: "KL", payment_terms: "GLOBAL DEFAULT TERMS" }, adminTok);
    const id = (await (await post("/api/quotes",
      { ...CREATE(true), title: "Diwali hampers for Meta", payment_terms: "100% advance — this quote only" }, salesTok)).json() as any).id;
    const d = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(d.title).toBe("Diwali hampers for Meta");
    expect(d.payment_terms).toBe("100% advance — this quote only");
    const list = await (await get("/api/quotes", salesTok)).json() as any;
    expect(list.quotes.find((r: any) => r.id === id)?.title).toBe("Diwali hampers for Meta");
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const html = b64decode((await (await get(`/api/quotes/${id}/document`, salesTok)).json() as any).content_b64);
    expect(html).toContain("100% advance — this quote only");
    expect(html).not.toContain("GLOBAL DEFAULT TERMS");
  });
  it("a revision carries the purpose + payment terms forward", async () => {
    await prep();
    const id = (await (await post("/api/quotes",
      { ...CREATE(true), title: "Quarterly pantry restock", payment_terms: "Net 30" }, salesTok)).json() as any).id;
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const rev = await (await post(`/api/quotes/${id}/revise`, {}, salesTok)).json() as any;
    const child = await (await get(`/api/quotes/${rev.id}`, salesTok)).json() as any;
    expect(child.title).toBe("Quarterly pantry restock");
    expect(child.payment_terms).toBe("Net 30");
  });
});

describe("HSN/UoM, header discount + charges, and pipeline", () => {
  it("HSN/UoM + apportioned discount + taxable charge round-trip to detail and document", async () => {
    await prep();
    const id = (await (await post("/api/quotes", {
      client_id: "c1", place_of_supply: "KL", title: "Widgets + install",
      header_discount_bp: 1000,
      charges: [{ label: "Installation", amount_paise: 500000, gst_bp: 1800 }],
      lines: [{ sku: "SKU1", description: "Widget", hsn: "8471", uom: "Nos", qty: 2, pricing_mode: "cost_markup", purchase_cost_paise: 100000, markup_bp: 2000, sale_gst_bp: 1800, itc_claimable: true }],
    }, salesTok)).json() as any).id;
    const d = await (await get(`/api/quotes/${id}`, salesTok)).json() as any;
    expect(d.lines[0].hsn).toBe("8471");
    expect(d.lines[0].uom).toBe("Nos");
    expect(d.lines[0].line_discount_paise).toBeGreaterThan(0);
    expect(d.charges[0]).toMatchObject({ label: "Installation", amount_paise: 500000, gst_bp: 1800 });
    expect(d.version.payload.totals.discount_total_paise).toBeGreaterThan(0);
    expect(d.version.payload.totals.charges_total_paise).toBe(500000);
    await post(`/api/quotes/${id}/submit`, {}, salesTok);
    await post(`/api/quotes/${id}/approve`, { leg: "manager" }, mgrTok);
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const html = b64decode((await (await get(`/api/quotes/${id}/document`, salesTok)).json() as any).content_b64);
    expect(html).toContain("8471");
    expect(html).toContain("Nos");
    expect(html).toContain("Installation");
    expect(html).toContain("HSN/SAC");
    expect(html.toLowerCase()).toContain("discount");
    expect(html.toLowerCase()).not.toContain("margin");
    expect(html.toLowerCase()).not.toContain("landed");
  });
  it("pipeline endpoint returns stage, client and type breakdowns", async () => {
    await prep();
    await createAs(salesTok);
    const r = await get("/api/quotes/pipeline", salesTok);
    expect(r.status).toBe(200);
    const p = await r.json() as any;
    expect(Array.isArray(p.by_status)).toBe(true);
    expect(Array.isArray(p.by_client)).toBe(true);
    expect(Array.isArray(p.by_type)).toBe(true);
    expect(p.by_status.some((s: any) => s.status === "DRAFT")).toBe(true);
  });
});

describe("pipeline counts one deal per revision chain", () => {
  it("revising a sent quote does not inflate pipeline value and hides the superseded predecessor", async () => {
    await prep();
    const id = await approvedQuote();
    await post(`/api/quotes/${id}/send`, {}, salesTok);
    const sumV = (p: any) => (p.by_status || []).reduce((a: number, s: any) => a + (s.v || 0), 0);
    const before = await (await get("/api/quotes/pipeline", salesTok)).json() as any;
    const totalBefore = sumV(before);
    await post(`/api/quotes/${id}/revise`, {}, salesTok);   // original → SUPERSEDED, new DRAFT head
    const after = await (await get("/api/quotes/pipeline", salesTok)).json() as any;
    // one deal per chain: the superseded predecessor is excluded, so value is unchanged
    expect(sumV(after)).toBe(totalBefore);
    expect(after.by_status.some((s: any) => s.status === "SUPERSEDED")).toBe(false);
  });
});
