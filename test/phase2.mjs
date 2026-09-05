// Phase 2 — Consolidation: executable acceptance criteria (see
// plans/active_milestones/001-phase2-consolidation/spec.md).
// Loads the app like smoke.mjs (stubbed DOM, per-URL fetch), then asserts each AC
// against the SHIPPED code. Two recorders (plan-validator finding):
//   expect(name,cond) — a failure increments the exit code (a real gate).
//   todo(name,cond,ac) — an expected-red check: prints ⚠, NEVER affects exit code.
// Group A registers known-red ACs via todo(); Group B/C promote them to expect().
//
// Run: npm run test:phase2   (no server / no D1)

import { loadApp } from "./_apploader.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = (n) => JSON.parse(readFileSync(path.join(ROOT, "test/fixtures", n), "utf8"));

const fails = [];
const todos = [];
const ok = (n) => console.log(`  ✓ ${n}`);
function expect(name, cond) { cond ? ok(name) : (fails.push(name), console.log(`  ✗ ${name}`)); }
function todo(name, cond, ac) { cond ? ok(`${name}  (todo[${ac}] now green — promote to expect)`) : (todos.push(name), console.log(`  ⚠ TODO[${ac}] ${name}`)); }

// AC15 fetch fixtures: N=5 overdue rows for /reports/consolidated-due.
const fetchRouterSrc = `(url) => {
  if (url.includes('/reports/consolidated-due')) {
    return { json: [
      { client_name:'A', days_overdue: 9, due_qty: 3 },
      { client_name:'B', days_overdue: 5, due_qty: 1 },
      { client_name:'C', days_overdue: 2, due_qty: 2 },
      { client_name:'D', days_overdue: 8, due_qty: 4 },
      { client_name:'E', days_overdue: 1, due_qty: 1 },
    ] };
  }
  if (url.includes('/nav-badges')) return { json: { consolidated_due: 5, orders: 2 } };
  return null; // → 401
}`;

const { page, errors, localScripts, close } = await loadApp({ fetchRouterSrc });

const R1 = ["super_admin","ops_admin","procurement_manager","warehouse_exec","delivery_manager",
  "delivery_exec","finance_admin","client_admin","client_approver","client_user","vendor_admin","vendor_user"];
const aclMatrix = FIX("acl-matrix.json").allow;
const preIds = FIX("pre-consolidation-page-ids.json").ids;
const untouchedNav = FIX("untouched-nav.json").profiles;

console.log(`\nLoaded ${localScripts.length} script(s). Load errors: ${errors.length}`);
expect("all app scripts load without error", errors.length === 0 || (console.log("   ", errors.slice(0,3)), false));

const src = localScripts.map((s) => readFileSync(path.join(ROOT, "public", s), "utf8")).join("\n");

const res = await page.evaluate(async (args) => {
  const { R1, aclMatrix, preIds, untouchedNav } = args;
  const out = {};
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sortedKeys = (o) => Object.keys(o).sort();

  // ── AC7 / R1: role universe + phantom roles ──
  out.rolesExact = eq([...Object.keys(ROLES)].sort(), [...R1].sort());
  const rolesSet = new Set(Object.keys(ROLES));
  const phantom = [];
  for (const [pg, roles] of Object.entries(typeof ACTION_PAGES !== "undefined" ? ACTION_PAGES : {}))
    for (const r of roles) if (!rolesSet.has(r)) phantom.push(`${pg}->${r}`);
  out.phantomRoles = phantom;

  // ── AC7: canAccessPage matrix parity vs frozen ground truth ──
  const pages = Object.keys(PAGE_MAP);
  const matrixDiffs = [];
  for (const role of Object.keys(aclMatrix)) {
    APP.user = { role, nav: ROLES[role].nav };
    const got = pages.filter((pg) => canAccessPage(pg)).sort();
    if (!eq(got, aclMatrix[role])) {
      const exp = new Set(aclMatrix[role]); const g = new Set(got);
      matrixDiffs.push(`${role}: +[${got.filter((p)=>!exp.has(p))}] -[${aclMatrix[role].filter((p)=>!g.has(p))}]`);
    }
  }
  APP.user = null;
  out.matrixDiffs = matrixDiffs;

  // ── AC8: PAGE_MAP ⊇ frozen ids; untouched navs deep-equal ──
  const cur = new Set(Object.keys(PAGE_MAP));
  out.missingIds = preIds.filter((id) => !cur.has(id));
  const navDiffs = [];
  for (const prof of Object.keys(untouchedNav)) {
    const got = (NAV[prof] || []).filter((i) => i.id).map((i) => ({ id: i.id, label: i.label }));
    if (!eq(got, untouchedNav[prof])) navDiffs.push(prof);
  }
  out.navDiffs = navDiffs;

  // ── AC9: phase-stepper coverage ──
  const PHASE = { placed:0, approved:1, fulfilment:2, shipment:3, delivered:4 };
  const map = {
    DRAFT:0,PENDING_PRICING:0,SUBMITTED:0, PENDING_APPROVAL:1,APPROVED:1,ACKNOWLEDGED:1,
    INVENTORY_CHECK:2,VENDOR_PO_RAISED:2,READY_TO_PICK:2,PICKED:2,QUALITY_CHECK:2,
    IN_SHIPMENT:3,PARTIALLY_CLOSED:3, CLOSED:4,DELIVERED:4,RECEIVED:4 };
  const phaseBad = [];
  for (const [s, idx] of Object.entries(map)) if (orderPhaseIndex(s) !== idx) phaseBad.push(`${s}=${orderPhaseIndex(s)}!=${idx}`);
  out.phaseBad = phaseBad;
  // cancelled marker present for CANCELLED/REJECTED, absent for fallback set
  out.cancelledMarker = ["CANCELLED","REJECTED"].every((s) => phaseStepper(s).includes("ostep--cancelled"));
  const fallback = [null, undefined, "", "IN_TRANSIT","DISPATCHED","ACCEPTED","SENT","SCHEDULED","OPEN",
    "IN_PROGRESS","RESOLVED","INVOICED","HIGH","MEDIUM","LOW","ZZZ_UNKNOWN"];
  const fbBad = [];
  for (const s of fallback) {
    try {
      const html = phaseStepper(s);
      if (orderPhaseIndex(s) !== -1) fbBad.push(`${s}:idx=${orderPhaseIndex(s)}`);
      if (html.includes("ostep--cancelled")) fbBad.push(`${s}:cancelledmarker`);
    } catch (e) { fbBad.push(`${s}:threw`); }
  }
  out.fbBad = fbBad;

  // ── AC5/R3/AC14: delivery gate ──
  const DELIV_BACK = { today:"todays_schedule", list:"delivery", calendar:"delivery_calendar", routes:"delivery_routes" };
  const delivDiffHub = []; const delivNoAccessNonEmpty = [];
  for (const role of Object.keys(ROLES)) {
    APP.user = { role, nav: ROLES[role].nav };
    const hub = canAccessPage("delivery");
    const tabs = (typeof delivTabsForRole === "function") ? delivTabsForRole(role).map((t) => t.k) : [];
    if (hub) {
      const expected = Object.keys(DELIV_BACK).filter((k) => canAccessPage(DELIV_BACK[k]) || DELIV_BACK[k] === "delivery");
      // 'list' backing is page id 'delivery' (the hub itself) → always accessible when hub is
      const got = [...tabs].sort();
      const exp = expected.sort();
      if (!eq(got, exp)) delivDiffHub.push(`${role}: got[${got}] exp[${exp}]`);
    } else {
      if (tabs.length !== 0) delivNoAccessNonEmpty.push(`${role}:[${tabs}]`);
    }
  }
  APP.user = null;
  out.delivDiffHub = delivDiffHub;               // hub-accessible roles: must match (expect)
  out.delivNoAccessNonEmpty = delivNoAccessNonEmpty; // no-access roles: must be [] (todo→B5)

  // ── AC1 / hash helpers round-trip ──
  const hashCases = [["orders","pipeline"],["orders","queue"],["my_orders","tracking"],["delivery","calendar"]];
  const hashBad = [];
  for (const [pg, tab] of hashCases) {
    writeHash(pg, tab);
    const p = parseHash();
    if (p.page !== pg || p.tab !== tab || location.hash !== `#${pg}/${tab}`) hashBad.push(`${pg}/${tab}->${location.hash}`);
  }
  out.hashBad = hashBad;
  // routeTab picks a valid tab from hash / falls back
  writeHash("orders", "pipeline");
  out.routeTabFromHash = routeTab("orders", ["queue","pipeline","due"], "queue") === "pipeline";
  location.hash = "#orders/bogus";
  out.routeTabFallback = routeTab("orders", ["queue","pipeline","due"], "queue") === "queue";

  // ── AC3: echo dedupe — return-to-last-written-tab must still flip ──
  // Simulate: hub 'orders' registered; write tab A (queue); later a hashchange to queue must flip.
  // The registered switcher must mirror the REAL one (ordersHubTab), which calls
  // writeHash(page, k) so _hubTabWritten tracks the displayed tab.
  let flipped = 0;
  registerHub("orders", (k) => { flipped++; writeHash("orders", k); });
  APP.user = { role: "super_admin", nav: "platform" }; APP.page = "orders";
  writeHash("orders", "queue");                        // shown: queue
  location.hash = "#orders/pipeline"; onHashChange();  // Back/nav → flip to pipeline
  location.hash = "#orders/queue";    onHashChange();  // Back to queue → must flip again
  out.ac3ReturnFlips = flipped >= 2;
  APP.user = null; APP.page = null;

  // ── AC16: logout clears hash + sp_page ──
  try {
    location.hash = "#orders/pipeline";
    localStorage.setItem("sp_page", "orders");
    APP.token = "x"; APP.user = { role: "super_admin" };
    // doLogout touches DOM ids that may not exist in the stub; guard.
    try { doLogout(); } catch (e) { out.logoutThrew = String(e.message); }
    out.hashCleared = location.hash === "";
    out.spPageCleared = localStorage.getItem("sp_page") === null;
  } catch (e) { out.logoutErr = String(e.message); }

  // ── AC15: Due Items badge states (drive loadOrdersDueBadge with a controllable fetch) ──
  async function badgeState(fetchImpl) {
    let el = document.getElementById("orders-due-badge");
    if (!el) { el = document.createElement("span"); el.id = "orders-due-badge"; el.className = "hub-badge"; document.body.appendChild(el); }
    el.hidden = true; el.textContent = ""; el.removeAttribute("data-badge-state");
    const orig = window.fetch; window.fetch = fetchImpl;
    try { await loadOrdersDueBadge(); } finally { window.fetch = orig; }
    const e = document.getElementById("orders-due-badge");
    return { hidden: e.hidden, text: e.textContent, state: e.getAttribute("data-badge-state") };
  }
  const overdueRows = (n) => Array.from({ length: n }, () => ({ days_overdue: 3 })).concat([{ days_overdue: 0 }]);
  out.badgeN5     = await badgeState(async () => ({ ok: true, json: async () => overdueRows(5) }));
  out.badgeZero   = await badgeState(async () => ({ ok: true, json: async () => [{ days_overdue: 0 }, { days_overdue: -1 }] }));
  out.badgeBig    = await badgeState(async () => ({ ok: true, json: async () => overdueRows(150) }));
  out.badgeUnavail= await badgeState(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  out.badgeThrows = await badgeState(async () => { throw new Error("network"); });

  return out;
}, { R1, aclMatrix, preIds, untouchedNav });

console.log("\nAcceptance criteria:");
// AC7 / R1
expect("AC7/R1 · ROLES is exactly the 12 R1 roles", res.rolesExact);
expect("AC7/R1 · no ACTION_PAGES role outside ROLES", res.phantomRoles.length === 0 || (console.log("     phantom:", res.phantomRoles), false));
expect("AC7 · canAccessPage matches frozen ACL matrix", res.matrixDiffs.length === 0 || (console.log("     diffs:", res.matrixDiffs), false));
// AC8
expect("AC8 · PAGE_MAP ⊇ pre-consolidation ids", res.missingIds.length === 0 || (console.log("     missing:", res.missingIds), false));
expect("AC8 · untouched NAV profiles unchanged", res.navDiffs.length === 0 || (console.log("     changed:", res.navDiffs), false));
// AC9
expect("AC9 · phaseStepper maps every status", res.phaseBad.length === 0 || (console.log("     bad:", res.phaseBad), false));
expect("AC9 · CANCELLED/REJECTED render cancelled marker", res.cancelledMarker);
expect("AC9 · fallback set → no-progress, no throw, no cancelled marker", res.fbBad.length === 0 || (console.log("     bad:", res.fbBad), false));
// AC5/R3/AC14
expect("AC5/R3/AC14 · delivery gate consistent for hub-accessible roles", res.delivDiffHub.length === 0 || (console.log("     diffs:", res.delivDiffHub), false));
expect("AC5/R3/AC14 · delivTabsForRole == [] for no-access roles", res.delivNoAccessNonEmpty.length === 0 || (console.log("     nonempty:", res.delivNoAccessNonEmpty), false));
// AC1 / AC3 / AC16
expect("AC1 · hub tab hash round-trips (#hub/slug)", res.hashBad.length === 0 || (console.log("     bad:", res.hashBad), false));
expect("AC1 · routeTab honors hash tab + falls back on unknown", res.routeTabFromHash && res.routeTabFallback);
expect("AC3 · Back to last-written tab still flips (real switcher)", res.ac3ReturnFlips);
expect("AC16 · logout clears hash", res.hashCleared === true);
expect("AC16 · logout clears sp_page", res.spPageCleared === true);

// AC10 (source-level)
expect("AC10 · renderMyOrders calls phaseStepper", /renderMyOrders[\s\S]{0,4000}?phaseStepper\(/.test(src));
expect("AC10 · no bespoke ORDER_STEPS constant remains", !/\bORDER_STEPS\b/.test(src));

// AC15 · Due Items badge
expect("AC15 · badge element rendered synchronously on the due tab", /id="orders-due-badge"/.test(src) && /loadOrdersDueBadge\(\)/.test(src));
expect("AC15 · overdue count N>0 shows N, visible", res.badgeN5.text === "5" && res.badgeN5.hidden === false && res.badgeN5.state === "count");
expect("AC15 · count 0 → badge hidden", res.badgeZero.hidden === true && res.badgeZero.state === "zero");
expect("AC15 · count > 99 → '99+'", res.badgeBig.text === "99+" && res.badgeBig.hidden === false);
expect("AC15 · data unavailable → distinct unknown state, hidden", res.badgeUnavail.hidden === true && res.badgeUnavail.state === "unknown");
expect("AC15 · fetch throws → unknown state, no throw", res.badgeThrows.hidden === true && res.badgeThrows.state === "unknown");

await close();

console.log("");
if (todos.length) console.log(`TODO (expected-red, tracked for Group B/C): ${todos.length} — ${todos.join("; ")}`);
if (fails.length) { console.error(`PHASE2 FAILED — ${fails.length} check(s): ${fails.join("; ")}`); process.exit(1); }
console.log(`PHASE2 GREEN — ${todos.length} tracked todo(s), no failing gate.`);
