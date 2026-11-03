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

// Every library is fetched on demand: when a script refers to it, or something from it is opened.

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

/** Expands the given nodes of the open file picker tree (retrying: it re-renders), then clicks the last one. */
function clickTreePath(page, path) {
  return page.waitForFunction((path) => {
    const find = (label) => [...document.querySelectorAll('li.p-treenode')]
      .find(li => li.querySelector(':scope > .p-treenode-content .p-treenode-label')?.textContent === label);
    for (const label of path.slice(0, -1)) {
      const li = find(label);
      if (!li) return false;
      if (li.getAttribute('aria-expanded') !== 'true') {
        li.querySelector(':scope > .p-treenode-content .p-tree-toggler')?.click();
        return false;
      }
    }
    const file = find(path[path.length - 1]);
    if (!file) return false;
    file.querySelector(':scope > .p-treenode-content').click();
    return true;
  }, {timeout: 30000, polling: 200}, path);
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

  /**
   * After the first render: waits until the Service Worker has been installed and has copied the page's
   * files into its caches (the last thing the app does by itself), then for the network to be quiet,
   * and returns the archives downloaded in all.
   */
  async function settle() {
    await waitForQuiet(server.log, () => server.log.some(r => r.path === '/sw.js'), {quietMs: 4000});
    return zipDownloads(server.log);
  }

  test('a script without library references never downloads an archive', async () => {
    const atRender = await openAndRender('cube([10, 10, 10]);');
    expect(atRender).toEqual({});
    expect(mountedArchives()).toEqual(['(none)', '(none)']); // syntax check + render
    expect(await settle()).toEqual({});

    // No library bytes at all but the small index.
    const libBytes = server.log.filter(r => r.path.startsWith('/libraries/') && r.status === 200).reduce((s, r) => s + r.bytes, 0);
    expect(libBytes).toBeLessThanOrEqual(fs.statSync(path.join(dist, 'libraries', 'index.json')).size);
  }, longTimeout);

  test('a BOSL2-only script downloads BOSL2, once, and nothing else', async () => {
    const atRender = await openAndRender('include <BOSL2/std.scad>\ncuboid(10);');
    expect(atRender).toEqual({BOSL2: 1});
    expect(mountedArchives()).toEqual(['BOSL2', 'BOSL2']);
    expect(await settle()).toEqual({BOSL2: 1}); // not once per render / worker / SW
  }, longTimeout);

  test('a script using another library downloads that one once', async () => {
    const atRender = await openAndRender('use <MCAD/boxes.scad>\nroundedBox([10, 10, 10], 2, true);');
    expect(atRender).toEqual({MCAD: 1});
    expect(mountedArchives()).toEqual(['MCAD', 'MCAD']);
    expect(await settle()).toEqual({MCAD: 1});
  }, longTimeout);

  test('the fonts are only downloaded for text()', async () => {
    const atRender = await openAndRender('linear_extrude(1) text("Hi");');
    expect(atRender).toEqual({fonts: 1});
    expect(await settle()).toEqual({fonts: 1});
  }, longTimeout);

  test('opening an example from the file picker downloads openscad and what it depends on (MCAD), then', async () => {
    await openAndRender('cube([10, 10, 10]);');
    await settle();
    expect(zipDownloads(server.log)).toEqual({});
    // The picker lists the examples from the index, without the archive...
    await page.click('.p-treeselect');
    await clickTreePath(page, ['libraries', 'openscad', 'examples', 'Basics', 'CSG-modules.scad']);
    // ...and opening one downloads it.
    await waitForQuiet(server.log, () => zipDownloads(server.log).openscad, {quietMs: 4000});
    expect(zipDownloads(server.log)).toEqual({openscad: 1, MCAD: 1});
    expect(page.url()).toContain('#'); // still the app
    messages.length = 0; // (switching away from the unsaved default file logs 'Error while reading file')
  }, longTimeout);

  test('a demo link (#path=) downloads openscad and MCAD, once', async () => {
    await page.goto(`${server.url}#path=${encodeURIComponent('/libraries/openscad/examples/Basics/CSG-modules.scad')}`);
    await page.waitForFunction(() => document.querySelector('model-viewer.main-viewer')?.src, {timeout: 60000, polling: 50});
    expect(await settle()).toEqual({openscad: 1, MCAD: 1});
  }, longTimeout);

  test.each([
    ['saveData', {saveData: true, effectiveType: '4g'}],
    ['a slow connection', {saveData: false, effectiveType: '3g'}],
  ])('nothing optional is fetched in the background with %s', async (_, connection) => {
    await page.evaluateOnNewDocument((c) => Object.defineProperty(navigator, 'connection', {value: c}), connection);
    const atRender = await openAndRender('cube([10, 10, 10]);');
    expect(atRender).toEqual({});
    await waitForQuiet(server.log, () => true, {quietMs: 5000});
    expect(zipDownloads(server.log)).toEqual({});
    expect(server.log.some(r => r.path === '/sw.js')).toBe(false); // no Service Worker either
  }, longTimeout);

  test('the engine is downloaded once', async () => {
    await openAndRender('cube([10, 10, 10]);');
    await settle();
    const wasm = server.log.filter(r => r.path === '/openscad.wasm' && r.status === 200);
    expect(wasm).toHaveLength(1);
  }, longTimeout);
});
