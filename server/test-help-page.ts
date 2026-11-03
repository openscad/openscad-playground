/** Unit tests for browser content negotiation and the help page (help-page.ts). */
import assert from "node:assert/strict";
import { deepLinks, renderHelpPage, wantsHtml } from "./help-page.js";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const get = (accept?: string, extra: Record<string, string> = {}, method = "GET") =>
  ({ method, headers: { ...(accept === undefined ? {} : { accept }), ...extra } });

console.log("help page tests");
const browsers: Record<string, string> = {
  chrome: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  firefox: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  safari: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};
for (const [n, a] of Object.entries(browsers)) test(`${n} navigation wants html`, () => assert.equal(wantsHtml(get(a)), true));
test("HEAD from a browser wants html", () => assert.equal(wantsHtml(get(browsers.chrome, {}, "HEAD")), true));
test("curl */* is not html", () => assert.equal(wantsHtml(get("*/*")), false));
test("MCP client accept is not html", () => assert.equal(wantsHtml(get("application/json, text/event-stream")), false));
test("SSE only is not html", () => assert.equal(wantsHtml(get("text/event-stream")), false));
test("html plus event-stream is not html", () => assert.equal(wantsHtml(get("text/html, text/event-stream")), false));
test("missing accept is not html", () => assert.equal(wantsHtml(get()), false));
test("POST/DELETE/OPTIONS are not html", () => {
  for (const m of ["POST", "DELETE", "OPTIONS"]) assert.equal(wantsHtml(get(browsers.chrome, {}, m)), false);
});
test("MCP headers disable html", () => {
  assert.equal(wantsHtml(get(browsers.chrome, { "mcp-session-id": "x" })), false);
  assert.equal(wantsHtml(get(browsers.chrome, { "mcp-protocol-version": "2025-06-18" })), false);
});
test("page contains server URL, MCP Apps note and the repo link", () => {
  const h = renderHelpPage("https://openscad.ochafik.com/");
  assert.ok(h.includes("https://openscad.ochafik.com/mcp"));
  assert.ok(h.includes("needs a client with MCP Apps support"));
  assert.ok(!h.includes("mcpServers") && !h.includes("Add it to your client") && !h.includes("inspector"));
  assert.ok(h.includes('href="https://openscad.ochafik.com/"'));
  assert.ok(h.length < 10 * 1024, `page is ${h.length} bytes`);
});
test("origin is HTML-escaped", () => {
  const h = renderHelpPage('http://a"><script>alert(1)</script>/');
  assert.ok(!h.includes("<script>alert(1)"));
  assert.ok(!h.includes('a"><'));
});
test("no external requests", () => {
  const h = renderHelpPage("http://localhost:9100/");
  assert.ok(!/(src|href)="https?:\/\/[^"]*\.(js|css|woff2?)"/.test(h));
  assert.ok(!/<link /.test(h));
});
test("deep links round-trip, host with port and special chars", () => {
  const url = "http://localhost:9100/mcp?a=b&c=<d>";
  const l = deepLinks(url);
  assert.equal(new URL(l.claude).searchParams.get("connectorUrl"), url);
  assert.equal(new URL(l.claude).searchParams.get("connectorName"), "OpenSCAD");
  assert.ok(deepLinks("https://x.test:8443/mcp").claude.endsWith("connectorUrl=https%3A%2F%2Fx.test%3A8443%2Fmcp"));
  const cu = new URL(l.cursor);
  assert.equal(cu.protocol, "cursor:");
  assert.equal(cu.host, "anysphere.cursor-deeplink");
  assert.equal(cu.pathname, "/mcp/install");
  assert.equal(cu.searchParams.get("name"), "openscad");
  assert.deepEqual(JSON.parse(Buffer.from(cu.searchParams.get("config")!, "base64").toString()), { url });
  for (const [scheme, k] of [["vscode:", "vscode"], ["vscode-insiders:", "vscodeInsiders"]] as const) {
    const v = (l as Record<string, string>)[k];
    assert.ok(v.startsWith(`${scheme}mcp/install?`));
    assert.deepEqual(JSON.parse(decodeURIComponent(v.slice(v.indexOf("?") + 1))), { name: "openscad", type: "http", url });
  }
});
test("page has escaped one-click links", () => {
  const h = renderHelpPage("https://openscad.ochafik.com/");
  assert.ok(h.includes('href="https://claude.ai/customize/connectors?modal=add-custom-connector&amp;connectorName=OpenSCAD&amp;connectorUrl=https%3A%2F%2Fopenscad.ochafik.com%2Fmcp"'));
  assert.ok(h.includes('href="cursor://anysphere.cursor-deeplink/mcp/install?name=openscad&amp;config='));
  assert.ok(h.includes('href="vscode:mcp/install?%7B'));
  assert.ok(h.length < 10 * 1024, `page is ${h.length} bytes`);
});
test("icons are inline, decorative and theme-following", () => {
  const h = renderHelpPage("http://localhost:9100/");
  const icons = h.match(/<svg class="ic"[^>]*>/g) ?? [];
  assert.ok(icons.length >= 4);
  for (const i of icons) assert.ok(i.includes('aria-hidden="true"') && i.includes('width="18"'));
  assert.ok(!/<svg[^>]*(fill|stroke)="#/.test(h));
});
console.log(`${passed} passed`);
