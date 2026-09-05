// Shared loader for the frontend node tests (smoke.mjs + phase2.mjs).
// Serves public/index.html (minus its <script>s) over a real http:// origin and
// loads the local scripts in document order into one Playwright page — exactly
// like the browser. A real origin (not setContent's opaque one) is required so
// window.localStorage and history.replaceState behave natively (AC16 needs this).
// Callers pass a `fetchRouterSrc` string to control per-URL fetch responses.
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");

function resolveChrome() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = readdirSync(base).find((d) => d.startsWith("chromium-"));
    if (dir) {
      const p = path.join(base, dir, "chrome-linux", "chrome");
      if (existsSync(p)) return p;
    }
  } catch { /* fall through */ }
  return undefined;
}

// Returns { browser, page, errors, localScripts, close }. `close()` shuts the
// browser AND the http server.
export async function loadApp({ fetchRouterSrc = "() => null" } = {}) {
  const html = readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  const localScripts = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*>/g)]
    .map((m) => m[1]).filter((src) => !/^https?:\/\//.test(src));
  const bodyOnly = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<link[^>]*fonts\.googleapis[^>]*>/g, "");

  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(bodyOnly);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}/`;

  const browser = await chromium.launch({ executablePath: resolveChrome() });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: `
    window.__fetchRouter = ${fetchRouterSrc};
    window.fetch = async (url, opts) => {
      const r = window.__fetchRouter(String(url), opts);
      if (r) return { ok: r.ok !== false, status: r.status || 200, json: async () => r.json, text: async () => JSON.stringify(r.json) };
      return { ok: false, status: 401, json: async () => ({}), text: async () => "" };
    };
    window.Chart = window.Chart || function(){ return { destroy(){}, update(){} }; };
  ` });

  for (const src of localScripts) {
    try { await page.addScriptTag({ path: path.join(PUBLIC, src) }); }
    catch (e) { errors.push(`addScriptTag(${src}): ${e.message}`); }
  }
  const close = async () => { try { await browser.close(); } finally { server.close(); } };
  return { browser, page, errors, localScripts, close };
}
