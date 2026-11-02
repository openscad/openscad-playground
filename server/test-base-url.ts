/** Unit tests for per-request asset base URL resolution (base-url.ts). */
import assert from "node:assert/strict";
import { DEFAULT_BASE_URL, resolveBaseUrl } from "./base-url.js";

const req = (headers: Record<string, string>, encrypted = false) => ({ headers, socket: { encrypted } });
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log("base URL resolution tests");
test("Host header, plain http", () =>
  assert.equal(resolveBaseUrl(req({ host: "localhost:9100" }), {}), "http://localhost:9100/"));
test("untrusted: X-Forwarded-* ignored", () =>
  assert.equal(resolveBaseUrl(req({ host: "a.test", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" }), {}), "http://a.test/"));
test("trusted proxy (VERCEL): forwarded host/proto", () =>
  assert.equal(resolveBaseUrl(req({ host: "internal", "x-forwarded-host": "app.vercel.app", "x-forwarded-proto": "https" }), { VERCEL: "1" }), "https://app.vercel.app/"));
test("OPENSCAD_TRUST_PROXY enables forwarded headers", () =>
  assert.equal(resolveBaseUrl(req({ host: "internal", "x-forwarded-host": "x.test", "x-forwarded-proto": "https" }), { OPENSCAD_TRUST_PROXY: "1" }), "https://x.test/"));
test("OPENSCAD_BASE_URL wins, slash added", () =>
  assert.equal(resolveBaseUrl(req({ host: "a.test" }), { OPENSCAD_BASE_URL: "https://cdn.test/app" }), "https://cdn.test/app/"));
for (const bad of ["a.test/path", "user@a.test", "a.test:99999x", "a b", "a.test\r\nx", "<script>", ""]) {
  test(`invalid host rejected: ${JSON.stringify(bad)}`, () =>
    assert.equal(resolveBaseUrl(req({ host: bad }), {}), DEFAULT_BASE_URL));
}
test("allowlist accepts and rejects", () => {
  const env = { OPENSCAD_ALLOWED_HOSTS: "ok.test, *.vercel.app" };
  assert.equal(resolveBaseUrl(req({ host: "ok.test" }), env), "http://ok.test/");
  assert.equal(resolveBaseUrl(req({ host: "x.vercel.app" }), env), "http://x.vercel.app/");
  assert.equal(resolveBaseUrl(req({ host: "evil.test" }), env), DEFAULT_BASE_URL);
});
test("rejected host falls back to VERCEL_* then default", () => {
  const env = { OPENSCAD_ALLOWED_HOSTS: "ok.test", VERCEL_URL: "p-abc.vercel.app" };
  assert.equal(resolveBaseUrl(req({ host: "evil.test" }), env), "https://p-abc.vercel.app/");
  assert.equal(resolveBaseUrl(req({ host: "evil.test" }), { ...env, VERCEL_PROJECT_PRODUCTION_URL: "prod.example" }), "https://prod.example/");
});
test("no request: env chain", () => assert.equal(resolveBaseUrl(undefined, {}), DEFAULT_BASE_URL));
console.log(`${passed} test(s) passed`);
