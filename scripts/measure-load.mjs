#!/usr/bin/env node
// Load-performance harness for the OpenSCAD Playground.
//
// Serves a built `dist/` directory from a local server that mimics GitHub Pages
// (gzip for text/wasm, ETag + `Cache-Control: max-age=600`), optionally shaping
// bandwidth/latency server-side (so that Service Worker and Worker traffic is
// throttled too, which CDP page-level throttling would miss), drives headless
// Chrome through puppeteer and records, per run:
//   - every request that hit the wire (url, status, bytes transferred, decoded
//     bytes, start/end ms since navigation start), incl. Service Worker fetches
//   - DOMContentLoaded, FCP, LCP, editor-usable, worker-ready, first-render-done
//   - total blocking time (long tasks) on the main thread
//   - peak renderer RSS (page + workers) in MB
//
// Usage:
//   node scripts/measure-load.mjs [--dist dist] [--label baseline]
//        [--profile none|fast4g|slow4g|3g] [--cpu 1] [--runs 5]
//        [--states cold,warm-http,warm-sw] [--src 'cube(1);'|--src-file f.scad]
//        [--no-wasm-gzip] [--max-age 600] [--out results.json] [--waterfall]
//
// States: cold (fresh profile), warm-http (second load, HTTP cache only, SW
// bypassed), warm-sw (second load after the Service Worker has installed).
// "First render done" = `model-viewer.main-viewer` has a non-empty `src`.
// Requires `npm run build` first. Prints a median/min/max table and writes JSON.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? def : (args[i + 1]?.startsWith('--') || args[i + 1] === undefined ? true : args[i + 1]);
};
const dist = path.resolve(opt('dist', 'dist'));
const label = opt('label', path.basename(dist));
const profileName = opt('profile', 'none');
const cpu = Number(opt('cpu', 1));
const runs = Number(opt('runs', 5));
const states = String(opt('states', 'cold,warm-http,warm-sw')).split(',');
const wasmGzip = !args.includes('--no-wasm-gzip');
const maxAge = Number(opt('max-age', 600)); // GitHub Pages sends 600
const outFile = opt('out', null);
const showWaterfall = args.includes('--waterfall');
let src = opt('src', null);
const srcFile = opt('src-file', null);
if (srcFile) src = fs.readFileSync(srcFile, 'utf8');

// bytes/ms and RTT ms
const PROFILES = {
  none: { bps: Infinity, rtt: 0 },
  fast4g: { bps: 9e6 / 8, rtt: 170 },
  slow4g: { bps: 1.6e6 / 8, rtt: 150 },
  '3g': { bps: 0.4e6 / 8, rtt: 400 },
};
const profile = PROFILES[profileName];
if (!profile) throw new Error(`unknown profile ${profileName}`);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.wasm': 'application/wasm', '.zip': 'application/zip', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.glb': 'model/gltf-binary', '.wav': 'audio/wav',
  '.ico': 'image/x-icon', '.map': 'application/json', '.txt': 'text/plain',
};
const COMPRESSIBLE = (ext) => ['.html', '.js', '.json', '.css', '.svg', '.map', '.txt', '.ttf', '.eot', '.glb']
  .includes(ext) || (wasmGzip && ext === '.wasm');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requestLog = [];
let t0 = 0;
const gzCache = new Map();

// One shared link: chunks are transmitted one at a time at `bps`; chunks of
// "prefetch" requests (Sec-Purpose: prefetch) only go out when no other
// request has a chunk waiting, like an HTTP/2 server honouring priorities.
// Prefetches (Sec-Purpose: prefetch) and requests with an HTTP/2 priority urgency of 4 or more
// (fetchpriority=low, images...) only go out when nothing else is waiting.
const isLowPriority = (headers) => !!headers['sec-purpose']?.includes('prefetch') || Number(/u=(\d)/.exec(headers.priority ?? '')?.[1] ?? 3) >= 4;
const waiting = [[], []];
let linkBusy = false;
function pump() {
  if (linkBusy) return;
  const next = waiting[0].shift() ?? waiting[1].shift();
  if (!next) return;
  linkBusy = true;
  setTimeout(() => { linkBusy = false; next.resolve(); pump(); }, next.bytes / profile.bps * 1000);
}
function transmit(prio, bytes) {
  return new Promise((resolve) => { waiting[prio].push({ bytes, resolve }); pump(); });
}
async function shapedSend(res, buf, prio) {
  const CH = 16 * 1024;
  for (let i = 0; i < buf.length; i += CH) {
    const chunk = buf.subarray(i, i + CH);
    if (profile.bps !== Infinity) await transmit(prio, chunk.length);
    if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
  }
}

let inflight = 0;
let lastActivity = 0;
async function waitForServerIdle(quietMs) {
  while (inflight > 0 || performance.now() - lastActivity < quietMs) await sleep(100);
}

const server = http.createServer(async (req, res) => {
  inflight++;
  res.once('close', () => { inflight--; lastActivity = performance.now(); });
  const start = performance.now() - t0;
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dist, p);
  const entry = { url: p, start, kind: req.headers['sec-fetch-dest'] ?? '' };
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end();
    Object.assign(entry, { status: 404, wire: 0, decoded: 0, end: performance.now() - t0 });
    requestLog.push(entry);
    return;
  }
  const ext = path.extname(file);
  const st = fs.statSync(file);
  const etag = `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"`;
  const headers = { 'content-type': MIME[ext] ?? 'application/octet-stream', etag, 'cache-control': `max-age=${maxAge}` };
  if (profile.rtt) await sleep(profile.rtt);
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers); res.end();
    Object.assign(entry, { status: 304, wire: 0, decoded: 0, end: performance.now() - t0 });
    requestLog.push(entry);
    return;
  }
  let body = fs.readFileSync(file);
  const decoded = body.length;
  if (COMPRESSIBLE(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
    if (!gzCache.has(file)) gzCache.set(file, zlib.gzipSync(body, { level: 6 }));
    body = gzCache.get(file);
    headers['content-encoding'] = 'gzip';
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  await shapedSend(res, body, isLowPriority(req.headers) ? 1 : 0);
  res.end();
  Object.assign(entry, { status: 200, wire: body.length, decoded, end: performance.now() - t0 });
  requestLog.push(entry);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function rssOfBrowser(pid) {
  try {
    const out = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,command=']).toString().split('\n');
    const procs = out.map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
      .map((m) => ({ pid: +m[1], ppid: +m[2], rss: +m[3], cmd: m[4] }));
    const kids = new Set([pid]);
    let grew = true;
    while (grew) { grew = false; for (const q of procs) if (kids.has(q.ppid) && !kids.has(q.pid)) { kids.add(q.pid); grew = true; } }
    return procs.filter((q) => kids.has(q.pid) && /--type=renderer/.test(q.cmd)).reduce((s, q) => s + q.rss, 0) / 1024;
  } catch { return 0; }
}

const PAGE_INIT = () => {
  window.__m = { tbt: 0, lcp: 0, fcp: 0, workers: [] };
  // Lifetime of each OpenSCAD worker: spawn to result (engine load + mounts + run).
  const OrigWorker = window.Worker;
  window.Worker = class extends OrigWorker {
    constructor(...a) {
      super(...a);
      const t = performance.now();
      this.addEventListener('message', (e) => { if (e.data && e.data.result) window.__m.workers.push(performance.now() - t); });
    }
  };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50); })
    .observe({ type: 'longtask', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; })
    .observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__m.fcp = e.startTime; })
    .observe({ type: 'paint', buffered: true });
  const poll = () => {
    const m = window.__m;
    if (!m.editor && document.querySelector('.monaco-editor .view-lines')) m.editor = performance.now();
    const v = document.querySelector('model-viewer.main-viewer');
    if (!m.viewerEl && v) m.viewerEl = performance.now();
    if (!m.render && v && (v.src || v.getAttribute('src'))) m.render = performance.now();
    if (!m.render) requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
};

async function browserLaunch() {
  return puppeteer.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.CHROME_PATH || undefined });
}

async function visit(browser, ctx, { bypassSW, cdnSeen }) {
  const page = await ctx.newPage();
  const cdp = await page.createCDPSession();
  if (bypassSW) await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await interceptCdn(cdp, cdnSeen);
  await page.evaluateOnNewDocument(PAGE_INIT);
  let workerReady = 0;
  let navigations = 0;
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navigations++; });
  const errors = [];
  page.on('console', (m) => {
    const t = m.text();
    if (!workerReady && t.startsWith('Invoking OpenSCAD with')) workerReady = performance.now() - t0;
    if (m.type() === 'error') errors.push(t.slice(0, 200));
  });
  requestLog = [];
  t0 = performance.now();
  const startedAt = t0;
  const pid = browser.process().pid;
  let peak = 0;
  const sampler = setInterval(() => { peak = Math.max(peak, rssOfBrowser(pid)); }, 250);
  const target = origin + '/' + (src ? '#src=' + encodeURIComponent(src) : '');
  await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const dcl = performance.now() - t0;
  await page.waitForFunction(() => window.__m?.render, { timeout: 300000, polling: 50 });
  const m = await page.evaluate(() => window.__m);
  await sleep(300); // let tail requests (SW, prefetch) show up
  clearInterval(sampler);
  const heap = (await page.metrics()).JSHeapUsedSize / 1048576;
  const res = {
    dcl, fcp: m.fcp, lcp: m.lcp, editorMs: m.editor ?? null, workerReadyMs: workerReady || null,
    navigations: () => navigations, renderMs: m.render, workerMs: m.workers ?? [], tbt: m.tbt, rssPeakMB: peak, jsHeapMB: heap, errors,
    requests: requestLog.slice(), startedAt,
  };
  // Give the SW time to finish precaching before we close (cold runs).
  res.navigations = res.navigations();
  return { page, res };
}

const classify = (u) => {
  if (/jsdelivr/.test(u)) return 'monaco (CDN)';
  if (/\/libraries\/fonts\.zip$/.test(u)) return 'lib:fonts.zip';
  if (/\/libraries\//.test(u)) return 'libs (code zips)';
  if (/\.wasm$/.test(u)) return 'openscad.wasm';
  if (/openscad\.js$|openscad-worker/.test(u)) return 'worker js';
  if (/model-viewer/.test(u)) return 'model-viewer';
  if (/browserfs/.test(u)) return 'browserfs';
  if (/\/\d+\.index\.js|\/index\.js$/.test(u)) return 'app js (incl. monaco)';
  if (/\/fonts\//.test(u)) return 'ui fonts';
  if (/sw\.js|workbox/.test(u)) return 'service worker';
  if (/\.map$/.test(u)) return 'sourcemaps';
  return 'other';
};

function summarize(res) {
  const by = {};
  for (const r of res.requests) {
    const c = classify(r.url);
    by[c] ??= { n: 0, wire: 0, decoded: 0 };
    by[c].n++; by[c].wire += r.wire; by[c].decoded += r.decoded;
  }
  return by;
}

// Monaco is loaded from cdn.jsdelivr.net by @monaco-editor/loader. Requests to
// the CDN are intercepted (CDP Fetch domain), served from a local copy through
// the same shaped link on the first visit of a browser profile, and instantly
// afterwards (the CDN sends `immutable` caching headers).
const cdnCacheDir = path.join(os.homedir(), '.cache', 'openscad-measure-load');
fs.mkdirSync(cdnCacheDir, { recursive: true });
async function fetchCdn(url) {
  const file = path.join(cdnCacheDir, crypto.createHash('sha1').update(url).digest('hex'));
  if (!fs.existsSync(file)) {
    const r = await fetch(url, { headers: { 'accept-encoding': 'identity' } });
    fs.writeFileSync(file + '.type', r.headers.get('content-type') ?? 'application/octet-stream');
    fs.writeFileSync(file + '.status', String(r.status));
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return { body: fs.readFileSync(file), type: fs.readFileSync(file + '.type', 'utf8'), status: +fs.readFileSync(file + '.status', 'utf8') };
}
async function interceptCdn(cdp, seen) {
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.jsdelivr.net/*' }] });
  cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
    const entry = { url: request.url, start: performance.now() - t0, kind: 'cdn' };
    try {
      const { body, type, status } = await fetchCdn(request.url);
      let wire = body;
      if (/javascript|css|json|html|text/.test(type)) wire = zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      const first = !seen.has(request.url);
      seen.add(request.url);
      if (first) {
        if (profile.rtt) await sleep(profile.rtt);
        if (profile.bps !== Infinity) for (let i = 0; i < wire.length; i += 16384) await transmit(['Low', 'VeryLow'].includes(request.initialPriority) ? 1 : 0, Math.min(16384, wire.length - i));
      }
      await cdp.send('Fetch.fulfillRequest', {
        requestId, responseCode: status,
        responseHeaders: [{ name: 'content-type', value: type }, { name: 'access-control-allow-origin', value: '*' },
          { name: 'cache-control', value: 'public, max-age=31536000, immutable' }],
        body: body.toString('base64'),
      });
      Object.assign(entry, { status, wire: first ? wire.length : 0, decoded: body.length, end: performance.now() - t0 });
    } catch (e) {
      await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
      Object.assign(entry, { status: 0, wire: 0, decoded: 0, end: performance.now() - t0 });
    }
    requestLog.push(entry);
  });
}

const results = {};
for (const state of states) {
  results[state] = [];
  for (let i = 0; i < runs; i++) {
    const browser = await browserLaunch();
    try {
      const ctx = await browser.createBrowserContext();
      const cdnSeen = new Set();
      const first = await visit(browser, ctx, { bypassSW: state !== 'cold' && state !== 'warm-sw', cdnSeen });
      let r = first.res;
      if (state !== 'cold') {
        // The first visit warmed caches; wait for SW precache (if any) then reload.
        await waitForServerIdle(2000);
        await first.page.close();
        const second = await visit(browser, ctx, { bypassSW: state === 'warm-http', cdnSeen });
        r = second.res;
        await second.page.close();
      } else {
        await first.page.close();
      }
      r.byClass = summarize(r);
      r.totalWire = r.requests.reduce((s, x) => s + x.wire, 0);
      r.totalRequests = r.requests.length;
      if (!showWaterfall) delete r.requests;
      results[state].push(r);
      process.stderr.write(`${label} ${profileName} cpu${cpu} ${state} #${i + 1}: render ${Math.round(r.renderMs)}ms wire ${(r.totalWire / 1e6).toFixed(2)}MB\n`);
    } finally {
      await browser.close();
    }
  }
}
server.close();

const fmt = (a) => a.length ? `${Math.round(median(a))} [${Math.round(Math.min(...a))}-${Math.round(Math.max(...a))}]` : 'n/a';
const lines = [`## ${label} | profile=${profileName} cpu=${cpu}x runs=${runs} src=${src ? 'custom' : 'default'} wasm-gzip=${wasmGzip}`,
  '', '| state | wire MB | reqs | DCL ms | FCP ms | LCP ms | editor ms | worker-ready ms | first-render ms | TBT ms | peak RSS MB | longest worker ms |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
for (const s of states) {
  const rs = results[s];
  const col = (k) => fmt(rs.map((r) => r[k]).filter((x) => x != null));
  lines.push(`| ${s} | ${(median(rs.map((r) => r.totalWire)) / 1e6).toFixed(2)} | ${median(rs.map((r) => r.totalRequests))} | ${col('dcl')} | ${col('fcp')} | ${col('lcp')} | ${col('editorMs')} | ${col('workerReadyMs')} | ${col('renderMs')} | ${col('tbt')} | ${col('rssPeakMB')} | ${fmt(rs.map((r) => Math.max(0, ...r.workerMs)))} |`);
}
lines.push('', '| state | class | requests | wire KB | decoded KB |', '|---|---|---|---|---|');
for (const s of states) {
  const rs = results[s];
  const classes = new Set(rs.flatMap((r) => Object.keys(r.byClass)));
  for (const c of [...classes].sort()) {
    const v = (k) => median(rs.map((r) => r.byClass[c]?.[k] ?? 0));
    lines.push(`| ${s} | ${c} | ${v('n')} | ${(v('wire') / 1024).toFixed(0)} | ${(v('decoded') / 1024).toFixed(0)} |`);
  }
}
console.log(lines.join('\n'));
if (outFile) fs.writeFileSync(outFile, JSON.stringify({ label, profileName, cpu, runs, src, results }, null, 1));
