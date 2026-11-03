// Network-level regression tests: which library archives does the production build
// really download, whoever asks for them (page, render workers, Service Worker)?
//
// dist/ is served by an in-process server that records every request, so (unlike
// page-level request events) this also sees the workers' and the Service Worker's.
// Each test runs in a fresh browser context: empty HTTP cache, no Service Worker.
// Production build only (`NODE_ENV=production npm run build` first).

const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const isProd = process.env.NODE_ENV === 'production';
const dist = path.resolve(__dirname, '..', 'dist');
const longTimeout = 120000;

// What the build is configured to fetch in the background after the first render.
const libsConfig = require('../libs-config.json');
const eager = libsConfig.libraries.filter(l => !l.lazy).map(l => l.name);
const zipSize = (name) => fs.statSync(path.join(dist, 'libraries', `${name}.zip`)).size;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.wasm': 'application/wasm', '.zip': 'application/zip', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.json', '.css', '.wasm', '.glb']);

/** Serves dist/ like a static host (gzip, ETag, must-revalidate) and records the requests. */
function startServer() {
  /** @type {{path: string, status: number, bytes: number, time: number}[]} */
  const log = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dist, p);
    const record = (status, bytes) => log.push({path: p, status, bytes, time: Date.now()});
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return record(404, 0);
    }
    const ext = path.extname(file);
    const stat = fs.statSync(file);
    const etag = `"${stat.size}-${stat.mtimeMs}"`;
    const headers = {'content-type': MIME[ext] ?? 'application/octet-stream', etag, 'cache-control': 'public, max-age=0, must-revalidate'};
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers).end();
      return record(304, 0);
    }
    let body = fs.readFileSync(file);
    if (COMPRESSIBLE.has(ext) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      body = zlib.gzipSync(body);
      headers['content-encoding'] = 'gzip';
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers).end(body);
    record(200, body.length);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}/`,
    log,
    close: () => server.close(),
  })));
}

const zipName = (p) => (p.match(/^\/libraries\/([^/]+)\.zip$/) ?? [])[1];
/** name -> number of full downloads (200) of each library archive so far. */
const zipDownloads = (log) => {
  const counts = {};
  for (const {path: p, status} of log) {
    const name = zipName(p);
    if (name && status === 200) counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
};
const sortedKeys = (o) => Object.keys(o).sort();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** Waits until `ready()` and then until nothing has been requested for `quietMs`. */
async function waitForQuiet(log, ready, {quietMs = 3000, timeoutMs = 90000} = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const last = log.length ? log[log.length - 1].time : 0;
    if (ready() && Date.now() - last >= quietMs) return;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for the network to settle (${log.length} requests, ready=${ready()})`);
}

(isProd ? describe : describe.skip)('network', () => {
  let server;
  let context;
  let page;
  const messages = [];

  beforeAll(async () => {
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      throw new Error('dist/ not found: run `NODE_ENV=production npm run build` first');
    }
    server = await startServer();
  });
  afterAll(() => server && server.close());

  beforeEach(async () => {
    server.log.length = 0;
    messages.length = 0;
    context = await browser.createBrowserContext();
    page = await context.newPage();
    page.on('console', msg => messages.push({type: msg.type(), text: msg.text()}));
  });
  afterEach(async () => {
    await context.close();
    expect(messages.filter(m => m.type === 'error')).toEqual([]);
  });

  /** Loads a script and returns the library archives downloaded by the time it is first rendered. */
  async function openAndRender(src) {
    await page.goto(`${server.url}#src=${encodeURIComponent(src)}`);
    await page.waitForFunction(() => document.querySelector('model-viewer.main-viewer')?.src, {timeout: 60000, polling: 50});
    return zipDownloads(server.log);
  }
  const mountedArchives = () => messages
    .filter(m => m.type === 'debug' && m.text.startsWith('Mounting archives: '))
    .map(m => m.text.substring('Mounting archives: '.length));

  /** After the first render: waits for the background fetches, returns what was downloaded in all. */
  async function settle(expected) {
    await waitForQuiet(server.log, () => expected.every(n => zipDownloads(server.log)[n]));
    return zipDownloads(server.log);
  }

  test('a script without library references downloads no archive until idle, then only the eager ones', async () => {
    const atRender = await openAndRender('cube([10, 10, 10]);');
    expect(atRender).toEqual({});
    expect(mountedArchives()).toEqual(['(none)', '(none)']); // syntax check + render

    const total = await settle(eager);
    expect(sortedKeys(total)).toEqual([...eager].sort());
    for (const name of eager) expect(total[name]).toBe(1); // downloaded once, not per render or per worker

    // The bytes spent on libraries: the eager archives (+ the small index), nothing else.
    const libBytes = server.log.filter(r => r.path.startsWith('/libraries/') && r.status === 200).reduce((s, r) => s + r.bytes, 0);
    const eagerBytes = eager.reduce((s, n) => s + zipSize(n), 0);
    const indexBytes = fs.statSync(path.join(dist, 'libraries', 'index.json')).size;
    expect(libBytes).toBeLessThanOrEqual(eagerBytes + indexBytes);
  }, longTimeout);

  test('a BOSL2-only script downloads BOSL2 (and the eager archives), not the other libraries', async () => {
    const atRender = await openAndRender('include <BOSL2/std.scad>\ncuboid(10);');
    expect(Object.keys(atRender).every(n => n === 'BOSL2')).toBe(true);
    expect(mountedArchives()).toEqual(['BOSL2', 'BOSL2']);

    const expected = [...new Set([...eager, 'BOSL2'])].sort();
    const total = await settle(expected);
    expect(sortedKeys(total)).toEqual(expected);
    expect(total.BOSL2).toBe(1); // not once per render / worker / background mount
    expect(total.NopSCADlib ?? 0).toBe(eager.includes('NopSCADlib') ? 1 : 0);
    expect(total.MCAD ?? 0).toBe(eager.includes('MCAD') ? 1 : 0);
    expect(total.fonts).toBeUndefined();
  }, longTimeout);

  test('a script using another library downloads that one once, and no BOSL2 duplication', async () => {
    const atRender = await openAndRender('use <MCAD/boxes.scad>\nroundedBox([10, 10, 10], 2, true);');
    expect(Object.keys(atRender).every(n => n === 'MCAD')).toBe(true);
    expect(mountedArchives()).toEqual(['MCAD', 'MCAD']);

    const expected = [...new Set([...eager, 'MCAD'])].sort();
    const total = await settle(expected);
    expect(sortedKeys(total)).toEqual(expected);
    for (const name of expected) expect(total[name]).toBe(1);
  }, longTimeout);

  test('the fonts are only downloaded for text()', async () => {
    const atRender = await openAndRender('linear_extrude(1) text("Hi");');
    expect(Object.keys(atRender)).toEqual(['fonts']);
    expect(atRender.fonts).toBe(1);

    const expected = [...new Set([...eager, 'fonts'])].sort();
    const total = await settle(expected);
    expect(sortedKeys(total)).toEqual(expected);
    expect(total.fonts).toBe(1);
  }, longTimeout);

  test('the engine is downloaded once', async () => {
    await openAndRender('cube([10, 10, 10]);');
    await settle(eager);
    const wasm = server.log.filter(r => r.path === '/openscad.wasm' && r.status === 200);
    expect(wasm).toHaveLength(1);
  }, longTimeout);
});
