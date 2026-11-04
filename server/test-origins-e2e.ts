/**
 * Headless-browser check that the MCP app loads everything from the asset origin when its document belongs to
 * another origin, as in a real host sandbox.
 *
 * Three origins (three ports on 127.0.0.1/localhost):
 *  - host:    a minimal MCP Apps host (AppBridge from @modelcontextprotocol/ext-apps) in the top page;
 *  - sandbox: serves ONLY the app document (the HTML the server returns for ui://openscad/viewer.html), with a
 *             CSP header built from the server's `_meta.ui.csp` the way ext-apps' basic-host does. Any other
 *             request landing here (e.g. a root-relative /fonts/x.woff2) is a leak and 404s;
 *  - assets:  dist/ (what OPENSCAD_BASE_URL points to), the origin everything must come from.
 * The test drives the app (render, screenshot, a library include, text()) and asserts that every network request
 * (page, frames and workers, seen from the servers' side) went to the asset origin, and that no CSP violation or
 * 404 was reported.
 *
 * Needs a production or development build in dist/ and the root devDependencies (puppeteer, esbuild); skipped
 * without dist/. Run: node --import tsx test-origins-e2e.ts
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as http from "node:http";
import { createRequire } from "node:module";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer, RESOURCE_URI } from "./openscad-server.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.resolve(process.env.OPENSCAD_DIST_DIR ?? path.join(ROOT, "dist"));
if (!fs.existsSync(path.join(DIST, "index.js"))) {
  console.log("dist/ not built: skipping the foreign-origin e2e");
  process.exit(0);
}
const rootRequire = createRequire(path.join(ROOT, "package.json"));
const puppeteer = rootRequire("puppeteer");
const esbuild = rootRequire("esbuild");

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm",
  ".zip": "application/zip", ".jpg": "image/jpeg", ".png": "image/png", ".glb": "model/gltf-binary", ".woff2": "font/woff2",
  ".ico": "image/x-icon", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
};

type Log = string[];
function listen(handler: http.RequestListener, host: string): Promise<{ origin: string; server: http.Server }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler).listen(0, host, () => {
      resolve({ origin: `http://${host}:${(server.address() as AddressInfo).port}`, server });
    });
  });
}

// ext-apps basic-host's sandbox CSP (examples/basic-host/serve.ts), the reference for what hosts apply to resourceDomains / connectDomains.
function hostCsp(csp: { resourceDomains?: string[]; connectDomains?: string[]; frameDomains?: string[]; baseUriDomains?: string[] }): string {
  const res = (csp.resourceDomains ?? []).join(" "), conn = (csp.connectDomains ?? []).join(" ");
  return [
    "default-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: data: ${res}`,
    `style-src 'self' 'unsafe-inline' blob: data: ${res}`,
    `img-src 'self' data: blob: ${res}`,
    `font-src 'self' data: blob: ${res}`,
    `media-src 'self' data: blob: ${res}`,
    `connect-src 'self' ${conn}`,
    `worker-src 'self' blob: ${res}`,
    csp.frameDomains?.length ? `frame-src ${csp.frameDomains.join(" ")}` : "frame-src 'none'",
    "object-src 'none'",
    csp.baseUriDomains?.length ? `base-uri ${csp.baseUriDomains.join(" ")}` : "base-uri 'none'",
  ].join("; ");
}

async function main() {
  const assetLog: Log = [], sandboxLog: Log = [], hostLog: Log = [];

  // 1. Asset origin: dist/, CORS-open like the real server.
  const assets = await listen((req, res) => {
    const p = decodeURIComponent(new URL(req.url!, "http://x").pathname);
    assetLog.push(p);
    const file = path.join(DIST, p);
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(fs.readFileSync(file));
  }, "127.0.0.1");
  const base = assets.origin + "/";

  // 2. What the MCP server says for that base: the app HTML, its CSP and the `create` result.
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const mcp = createServer(base);
  const client = new Client({ name: "origins-e2e", version: "0.0.0" });
  await Promise.all([mcp.connect(st), client.connect(ct)]);
  const { contents } = await client.readResource({ uri: RESOURCE_URI });
  const html = (contents[0] as { text: string }).text;
  const csp = (contents[0]._meta as { ui: { csp: Parameters<typeof hostCsp>[0] } }).ui.csp;
  const toolResult = await client.callTool({ name: "create", arguments: {
    source: 'include <BOSL2/std.scad>\ncuboid(10);\ntranslate([20, 0, 0]) linear_extrude(2) text("Hi");',
  } });

  // 3. Sandbox origin: the app document only (different port from the assets and the host).
  const sandbox = await listen((req, res) => {
    const p = new URL(req.url!, "http://x").pathname;
    sandboxLog.push(p);
    if (p !== "/app") { res.writeHead(404).end("Only the app document is served on the sandbox origin"); return; }
    res.writeHead(200, { "Content-Type": "text/html", "Content-Security-Policy": hostCsp(csp), "Cache-Control": "no-store" }).end(html);
  }, "localhost");

  // 4. Host origin: a page with an AppBridge talking to the sandboxed iframe.
  const bundle = (await esbuild.build({
    stdin: {
      resolveDir: ROOT,
      contents: `
        import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
        window.startHost = async (src, toolResult) => {
          const iframe = document.createElement('iframe');
          iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
          iframe.style.cssText = 'width:900px;height:600px;border:0';
          document.body.appendChild(iframe);
          const bridge = new AppBridge(null, { name: 'origins-e2e-host', version: '0.0.0' }, { updateModelContext: { text: {} }, openLinks: {} },
            { hostContext: { theme: 'light', platform: 'web', displayMode: 'inline', availableDisplayModes: ['inline'], containerDimensions: { maxHeight: 6000 } } });
          bridge.oninitialized = () => { bridge.sendToolInput({ arguments: {} }); bridge.sendToolResult(toolResult); };
          await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
          iframe.src = src;
          window.__appBridge = bridge;
        };`,
    },
    bundle: true, format: "iife", write: false, platform: "browser", logLevel: "silent",
  })).outputFiles[0].text;
  const host = await listen((req, res) => {
    const p = new URL(req.url!, "http://x").pathname;
    hostLog.push(p);
    if (p === "/") res.writeHead(200, { "Content-Type": "text/html" }).end('<!doctype html><title>host</title><script src="/host.js"></script>');
    else if (p === "/host.js") res.writeHead(200, { "Content-Type": "text/javascript" }).end(bundle);
    else res.writeHead(p === "/favicon.ico" ? 204 : 404).end();
  }, "127.0.0.1");
  assert.notEqual(new URL(host.origin).origin, new URL(sandbox.origin).origin);
  assert.notEqual(new URL(assets.origin).origin, new URL(sandbox.origin).origin);

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const problems: string[] = [];
  const external: string[] = [];
  try {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      document.addEventListener("securitypolicyviolation", (e: any) => console.error(`CSPVIOLATION ${e.violatedDirective} blocked ${e.blockedURI}`));
    });
    page.on("console", (m: any) => {
      const t: string = m.text();
      if (/CSPVIOLATION|Refused to|Content Security Policy|violates the following/.test(t)) problems.push(`CSP: ${t.slice(0, 250)}`);
      else if (m.type() === "error" && /Failed to load resource/.test(t) && !/xr-spatial/.test(t)) problems.push(`console: ${t.slice(0, 200)} (${m.location()?.url ?? ""})`);
    });
    page.on("pageerror", (e: Error) => problems.push(`pageerror: ${e.message.slice(0, 200)}`));
    page.on("request", (r: any) => {
      const u: string = r.url();
      if (/^(blob|data|about):/.test(u)) return;
      const o = new URL(u).origin;
      if (o !== host.origin && o !== sandbox.origin && o !== assets.origin) external.push(u);
    });

    await page.goto(host.origin + "/");
    await page.evaluate((src: string, result: unknown) => (window as any).startHost(src, result), sandbox.origin + "/app", toolResult);
    const call = (name: string, args: object = {}) => page.evaluate(
      (n: string, a: object) => (window as any).__appBridge.callTool({ name: n, arguments: a }).then((r: any) => JSON.stringify(r), (e: unknown) => "ERROR " + e), name, args);
    const deadline = Date.now() + 120_000;
    for (;;) {
      const ready = await page.evaluate(async () => { try { return (await (window as any).__appBridge.listTools({})).tools.some((t: any) => t.name === "screenshot"); } catch { return false; } });
      if (ready) break;
      assert.ok(Date.now() < deadline, "the app never registered its tools");
      await new Promise((r) => setTimeout(r, 500));
    }
    const rendered = await call("render_model", { mode: "preview" });
    assert.ok(/Render: OK/.test(rendered), `render failed: ${rendered.slice(0, 300)}`);
    assert.ok(/"type":"image"/.test(await call("screenshot")), "screenshot should return an image");
    // Icon fonts are only fetched once something uses them (the full layout, which also needs Monaco's CDN):
    // ask the app's document to load its @font-face rules, which is what a rendered icon does.
    const app = page.frames().find((f: any) => f.url().startsWith(sandbox.origin));
    assert.ok(app, "app frame");
    // (A font that 404s rejects/hangs here; the leak assertions below then report which request went astray.)
    await Promise.race([
      app.evaluate(() => Promise.all([document.fonts.load("16px primeicons"), document.fonts.load("16px 'Inter var'")]).then(() => 0, () => 0)).catch(() => 0),
      new Promise((r) => setTimeout(r, 5000)),
    ]).catch(() => 0);
    await new Promise((r) => setTimeout(r, 1500)); // late requests: icon fonts, the environment image, library archives
    // Layout "full" would pull Monaco from its CDN; keep the test offline.
  } finally {
    await browser.close();
    for (const s of [assets.server, sandbox.server, host.server]) s.close();
  }

  const leaked = sandboxLog.filter((p) => p !== "/app");
  const hostExtra = hostLog.filter((p) => p !== "/" && p !== "/host.js" && p !== "/favicon.ico");
  const missing = assetLog.filter((p) => !fs.existsSync(path.join(DIST, p)));
  const must = ["/index.js", "/model-viewer.min.js", "/axes.glb", "/skybox-lights.jpg", "/openscad-worker.js", "/openscad.wasm", "/fonts/primeicons.woff2", "/fonts/InterVariable.woff2"];

  console.log(`asset origin served ${assetLog.length} requests; sandbox ${sandboxLog.length}; host ${hostLog.length}`);
  assert.deepEqual(leaked, [], `requests that resolved against the sandbox origin instead of ${base}`);
  assert.deepEqual(hostExtra, [], "requests that resolved against the host origin");
  assert.deepEqual(external, [], "requests to other origins");
  assert.deepEqual(missing, [], "404s on the asset origin");
  assert.deepEqual(problems, [], "CSP violations / load errors");
  for (const m of must) assert.ok(assetLog.includes(m), `${m} was never requested from the asset origin`);
  assert.ok(assetLog.some((p) => /^\/\d+\.index\.js$/.test(p)), "lazy chunks load from the asset origin");
  console.log("  ✓ every request went to the asset origin; no CSP violations");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
