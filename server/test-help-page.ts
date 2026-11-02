/** Unit tests for browser content negotiation and the help page (help-page.ts). */
import assert from "node:assert/strict";
import { renderHelpPage, wantsHtml } from "./help-page.js";

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
test("page contains server URL and commands", () => {
  const h = renderHelpPage("https://openscad.ochafik.com/");
  assert.ok(h.includes("https://openscad.ochafik.com/mcp"));
  assert.ok(h.includes("claude mcp add --transport http openscad https://openscad.ochafik.com/mcp"));
  assert.ok(h.includes('href="https://openscad.ochafik.com/"'));
  assert.ok(h.length < 12 * 1024, `page is ${h.length} bytes`);
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
console.log(`${passed} passed`);
