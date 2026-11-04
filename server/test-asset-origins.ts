/**
 * Static checks that nothing the MCP app loads can resolve against the host's sandbox origin.
 *
 * The view's document is served from the HOST's origin; the assets from the server's base URL. So the HTML must
 * only reference the base URL by absolute URL, the CSP must declare that origin, and the built CSS must not
 * contain references that the runtime cannot re-base (src/style-tag-transform.ts). The browser-level
 * counterpart is test-origins-e2e.ts.
 *
 * Needs dist/ for the bundle checks (`npm run build` in the repo root); those are skipped without it.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { appCsp, buildAppHtml } from "./openscad-server.js";

const DIST = path.resolve(process.env.OPENSCAD_DIST_DIR ?? path.join(import.meta.dirname, "../dist"));
let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✓ ${name}`); };

console.log("MCP app asset origin tests");

for (const base of ["https://openscad.ochafik.com/", "http://localhost:9100/", "https://cdn.example/sub/dir/"]) {
  const origin = new URL(base).origin;

  test(`HTML references only absolute URLs on the base (${base})`, () => {
    const html = buildAppHtml(base);
    // Attributes of the markup (inline script bodies are code, not references) and url()s of the <style> blocks.
    const markup = html.replace(/<script>[\s\S]*?<\/script>/g, "");
    const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const refs = [...markup.matchAll(/\b(?:src|href|poster|data-src|srcset|action)\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1])
      .concat([...styles.matchAll(/url\(\s*["']?([^"')\s]+)/gi)].map((m) => m[1]));
    assert.ok(refs.length >= 3, "expected the script tags");
    for (const ref of refs) {
      assert.ok(/^https?:\/\//.test(ref), `relative reference ${ref} would resolve against the host sandbox`);
      assert.ok(ref.startsWith(base), `${ref} is not under the base ${base}`);
    }
    assert.ok(html.includes(`<meta name="openscad-base-url" content="${base}">`));
    assert.ok(!/<base[\s>]/i.test(html), "no <base>: it would need baseUriDomains and re-point every relative URL");
    assert.ok(!/<link\b/i.test(html) && !/@import/i.test(html), "no <link>/@import in the shell");
  });

  test(`CSP declares the base origin for every fetching directive (${base})`, () => {
    const csp = appCsp(base);
    assert.ok(csp.resourceDomains.includes(origin), "resourceDomains (script/style/img/font/media/worker-src)");
    assert.ok(csp.connectDomains.includes(origin), "connectDomains (connect-src)");
    for (const d of [...csp.resourceDomains, ...csp.connectDomains]) {
      assert.ok(!d.includes("*"), `no wildcard: ${d}`);
      assert.ok(/^(https?:\/\/[^/\s;'"]+|blob:|data:)$/.test(d), `bare origin or scheme: ${d}`);
    }
    // blob:/data: are connect-src only: workers and scripts get blob: from the host baseline.
    assert.ok(csp.connectDomains.includes("blob:") && csp.connectDomains.includes("data:"));
    assert.ok(!csp.resourceDomains.some((d) => d === "blob:" || d === "data:"));
    assert.ok(!("frameDomains" in csp) && !("baseUriDomains" in csp), "view has no frames and no <base>");
  });
}

if (fs.existsSync(path.join(DIST, "index.js"))) {
  const scripts = fs.readdirSync(DIST).filter((f) => /^(\d+\.)?index\.js$/.test(f));

  test("every url() in the bundled CSS is a file of dist/ (the runtime re-bases them onto the base URL)", () => {
    // Third-party URLs are fine; an Inter italic face is declared by the PrimeReact theme but never shipped
    // (only loaded when italic text is displayed; same in the standalone app).
    const ignored = new Set(["fonts/InterVariable-Italic.woff2"]);
    const found = new Set<string>();
    for (const f of scripts) {
      const src = fs.readFileSync(path.join(DIST, f), "utf8");
      for (const m of src.matchAll(/url\(\\?["']?([^"')\\\s]+)/g)) {
        const u = m[1];
        // Only look at CSS (font-face sources), not at code that happens to contain "url(".
        if (!/\.(woff2?|ttf|eot|svg|png|jpe?g|gif|webp)(\?|#|$)/.test(u) || /^(data:|https?:|\/\/|#)/.test(u)) continue;
        found.add(u);
        const rel = u.replace(/[?#].*$/, "").replace(/^\.\//, "");
        if (ignored.has(rel)) continue;
        assert.ok(!u.startsWith("/"), `root-relative CSS url ${u} cannot be re-based onto a base URL with a path`);
        assert.ok(fs.existsSync(path.join(DIST, rel)), `url(${u}) in ${f}: ${rel} is not in dist/`);
      }
    }
    assert.ok(found.size > 0, "expected the PrimeIcons/Inter font references");
  });

  test("the bundle re-bases CSS urls and pins the webpack public path to the base URL", () => {
    const src = fs.readFileSync(path.join(DIST, "index.js"), "utf8");
    assert.ok(src.includes("openscad-base-url"));
    // style-loader's styleTagTransform hook (src/style-tag-transform.ts) rewrites url(x) into url("<base>x").
    assert.ok(/url\("\$\{new URL\(/.test(src), "style tag transform present");
    // src/public-path.ts: `__webpack_public_path__ = base` compiles to `<require>.p = base.endsWith("/") ? ...`.
    assert.ok(/\.p=\w+\.endsWith\("\/"\)\?/.test(src), "__webpack_public_path__ assignment present");
  });
} else {
  console.log("  - dist/ not built: bundle checks skipped");
}

console.log(`${passed} test(s) passed`);
