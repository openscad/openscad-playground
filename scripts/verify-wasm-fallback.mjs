// Serves dist/ and loads it in headless Chrome with WebAssembly enabled or
// disabled (via a Content-Security-Policy without 'wasm-unsafe-eval', which
// also applies inside workers), reporting whether a model renders, the time to first render, and
// whether the banner shows. See docs/WASM_FALLBACK.md.
//
//   node scripts/verify-wasm-fallback.mjs --wasm=on|off [--no-fallback]
//        [--src='cube(10);'] [--shot=out.png] [--timeout=300000]
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [, k, v = 'true'] = a.match(/^--([^=]*)(?:=([\s\S]*))?$/);
  return [k, v];
}));
const wasm = args.wasm !== 'off';
const hideFallback = args['no-fallback'] === 'true';
const src = args.src ?? 'cube(10);';
const timeout = Number(args.timeout ?? 300000);
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const types = {'.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css'};
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(dist, p === '/' ? 'index.html' : p);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()
      || (hideFallback && p.endsWith('openscad.fallback.js'))) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': types[path.extname(file)] ?? 'application/octet-stream',
    ...(wasm ? {} : {'Content-Security-Policy': "script-src 'self' 'unsafe-inline' blob: https://cdn.jsdelivr.net; worker-src 'self' blob:"}),
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const url = `http://localhost:${server.address().port}/#src=${encodeURIComponent(src)}`;

const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'dl-'));
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const result = {wasm, hideFallback, src};
try {
  const page = await browser.newPage();
  await page.setViewport({width: 1400, height: 900});
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: downloads});
  const logs = [];
  page.on('console', m => logs.push(`${m.type()}: ${m.text()}`));
  page.on('response', r => { if (r.url().endsWith('/openscad.fallback.js') && r.ok()) result.fallbackFetched = true;
     if (r.status() >= 400) logs.push(`error: ${r.status()} ${r.url()}`); });
  page.on('pageerror', e => logs.push(`pageerror: ${e}`));

  const start = Date.now();
  await page.goto(url);
  result.pageWebAssembly = await page.evaluate(() => typeof WebAssembly);
  result.wasmCompiles = await page.evaluate(() => {
    try {
      new WebAssembly.Module(Uint8Array.of(0, 0x61, 0x73, 0x6d, 1, 0, 0, 0));
      return true;
    } catch (e) {
      return false;
    }
  });
  try {
    await page.waitForFunction(() => {
      const v = document.querySelector('model-viewer.main-viewer');
      return v && v.src !== '';
    }, {timeout});
    result.rendered = true;
    result.timeToFirstRenderMs = Date.now() - start;
  } catch {
    result.rendered = false;
  }
  result.bannerText = await page.evaluate(() => document.body.innerText.match(/WebAssembly is disabled[^\n]*(\n[^\n]*)?/)?.[0] ?? null);
  if (args.shot) await page.screenshot({path: args.shot});

  if (result.rendered) {
    const exportStart = Date.now();
    // Preview output first; a full render enables export.
    await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Render');
      if (b && !b.disabled) { b.click(); return true; }
      return !!document.querySelector('.p-splitbutton button');
    }, {timeout});
    await page.waitForFunction(() => {
      const b = document.querySelector('.p-splitbutton button');
      return b && !b.disabled;
    }, {timeout});
    await page.click('.p-splitbutton button');
    const deadline = Date.now() + timeout;
    let file;
    while (Date.now() < deadline) {
      file = fs.readdirSync(downloads).find(f => !f.endsWith('.crdownload'));
      if (file) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (file) {
      result.export = {file, bytes: fs.statSync(path.join(downloads, file)).size, ms: Date.now() - exportStart};
    }
  }
  result.errors = logs.filter(l => /^(error|pageerror)/.test(l)).slice(0, 5);
  result.log = logs.filter(l => /stderr|stdout|Invoking/.test(l)).slice(0, 8);
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(result, null, 2));
