// Frontend smoke test — the safety net for splitting app.js into modules.
//
// It loads the app's local <script src> files IN THE ORDER index.html declares
// them (so it automatically covers the file split once index.html is updated),
// executing each as a classic script in one shared global scope exactly like the
// browser does. It asserts:
//   1. every script parses and runs its top level with zero errors
//      (catches missing/duplicate declarations and wrong load order — the #1 risk
//       of the split),
//   2. the core globals the inline onclick handlers depend on are defined,
//   3. the modal manager and a pure render function actually work.
//
// Run: npm run test:smoke   (no server or D1 needed — DOM is stubbed, fetch faked)

import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

// Resolve the pre-installed Chromium (revision dir varies by Playwright version);
// fall back to Playwright's own resolution if the sandbox layout changes.
function resolveChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = readdirSync(base).find((d) => d.startsWith("chromium-"));
    if (dir) {
      const p = path.join(base, dir, "chrome-linux", "chrome");
      if (existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  return undefined; // let Playwright resolve it
}
const CHROME = resolveChrome();

const html = readFileSync(path.join(PUBLIC, "index.html"), "utf8");

// Local (non-CDN) script sources, in document order — this list grows automatically
// when app.js is split into multiple files and index.html is updated.
const localScripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*>/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:\/\//.test(src));

// The page body without any <script> so we control execution order and error capture.
const bodyOnly = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "");

const failures = [];
const pass = (name) => console.log(`  ✓ ${name}`);
const check = (name, cond) => (cond ? pass(name) : (failures.push(name), console.log(`  ✗ ${name}`)));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

await page.setContent(html.includes("<body") ? bodyOnly : `<body>${bodyOnly}</body>`, { waitUntil: "domcontentloaded" });

// Fake network + a real localStorage exist in the page already; stub fetch so any
// boot-time calls resolve deterministically instead of hitting a dead origin.
await page.addScriptTag({ content: `
  window.fetch = async () => ({ ok:false, status:401, json: async()=>({}), text: async()=>"" });
  window.Chart = window.Chart || function(){ return { destroy(){}, update(){} }; };
` });

console.log(`\nLoading ${localScripts.length} local script(s): ${localScripts.join(", ")}`);
for (const src of localScripts) {
  const before = errors.length;
  try {
    await page.addScriptTag({ path: path.join(PUBLIC, src) });
  } catch (e) {
    errors.push(`addScriptTag(${src}): ${e.message}`);
  }
  check(`loads ${src} without error`, errors.length === before);
}

// Every delegated target (data-act via dataAct('fn', ...)) must resolve to a real
// function, else clicking that button silently does nothing. Allowlisted:
//  - openNewRouteModal: pre-existing dead code (undefined before delegation too),
//  - inv*: assigned lazily as window.x = function inside the inventory render, so
//    they exist whenever their buttons are on-screen but not at page load.
const DEAD_TARGETS = new Set([
  "openNewRouteModal",
  "invBulkModal", "invClearSelection", "invSortBy", "invBulkApply",
]);
const allSource = localScripts.map((s) => readFileSync(path.join(PUBLIC, s), "utf8")).join("\n");
const actTargets = [...new Set([...allSource.matchAll(/dataAct(?:El|Close)?\('([A-Za-z_$][\w$]*)'/g)].map((m) => m[1]))]
  .filter((n) => !DEAD_TARGETS.has(n));

console.log("\nGlobals & behavior:");
const result = await page.evaluate(async (actTargets) => {
  const out = {};
  // Bare-name lookup: top-level `const`/`let` globals (APP, svg, h) are shared
  // lexical globals but not window properties, so `n in window` misses them.
  const missingGlobal = (n) => { try { return eval("typeof " + n) === "undefined"; } catch { return true; } };
  // Core globals that inline onclick= handlers and the router depend on:
  out.coreGlobals = ["APP", "openModal", "closeModal", "navigate", "api", "showToast",
    "viewVendorModal", "editVendorById", "vendorViewHTML", "svg", "h"].filter(missingGlobal);

  // Modal manager behaves:
  try {
    openModal("Smoke", "<button id='sb'>x</button>", "<button onclick='closeModal()'>Close</button>");
    out.modalOpens = !document.getElementById("modal-overlay").classList.contains("hidden");
    closeModal();
    out.modalCloses = document.getElementById("modal-overlay").classList.contains("hidden");
  } catch (e) { out.modalErr = String(e.message); }

  // Every route target resolves to a real function across the split files:
  try {
    out.unresolvedRoutes = Object.entries(PAGE_MAP)
      .filter(([, name]) => typeof window[name] !== "function")
      .map(([page, name]) => `${page}->${name}`);
    out.routeCount = Object.keys(PAGE_MAP).length;
  } catch (e) { out.routeErr = String(e.message); }

  // A pure render function produces HTML and escapes user text:
  try {
    const v = { id: "v1", vendor_code: "VDR-2026-00001", name: "Smoke <b>Co</b> & Sons",
      category: "Beverages", registration_type: "unregistered", vendor_type: "non_food",
      onboarding_status: "active", active: 1 };
    const frag = vendorViewHTML(v, [], []);
    out.rendersHtml = typeof frag === "string" && frag.length > 200;
    out.escapesUserText = frag.includes("Smoke &lt;b&gt;Co&lt;/b&gt;") && !frag.includes("Smoke <b>Co</b>");
  } catch (e) { out.renderErr = String(e.message); }

  // Every delegated (data-act) target resolves to a callable function:
  out.unresolvedActs = actTargets.filter((n) => typeof window[n] !== "function");
  out.actCount = actTargets.length;
  return out;
}, actTargets);

check("all core globals defined", result.coreGlobals.length === 0 || (console.log("    missing:", result.coreGlobals), false));
check(`all ${result.routeCount || "?"} routes resolve to a function`, Array.isArray(result.unresolvedRoutes) && result.unresolvedRoutes.length === 0 || (console.log("    unresolved:", result.unresolvedRoutes), false));
check("openModal shows the dialog", result.modalOpens === true);
check("closeModal hides the dialog", result.modalCloses === true);
check("vendorViewHTML returns markup", result.rendersHtml === true);
check("vendorViewHTML escapes user text", result.escapesUserText === true);
check(`all ${result.actCount || 0} delegated targets resolve`, Array.isArray(result.unresolvedActs) && result.unresolvedActs.length === 0 || (console.log("    unresolved:", result.unresolvedActs), false));
if (result.modalErr) console.log("    modal error:", result.modalErr);
if (result.renderErr) console.log("    render error:", result.renderErr);

await browser.close();

console.log("");
if (failures.length) {
  console.error(`SMOKE FAILED — ${failures.length} check(s): ${failures.join("; ")}`);
  process.exit(1);
}
console.log(`SMOKE PASSED — ${localScripts.length} script(s), all checks green.`);
