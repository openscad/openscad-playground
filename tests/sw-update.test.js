const fs = require('fs');
const http = require('http');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const dist = path.join(__dirname, '../dist');

const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm',
  '.css': 'text/css', '.zip': 'application/zip', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg'};

// Serves dist/ like a host with must-revalidate caching; `redeploy()` changes the Service Worker script
// (all it takes for a browser to see a new version).
function serveDist() {
  let version = 0;
  const server = http.createServer((req, res) => {
    let file = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file.endsWith('/')) file += 'index.html';
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    let body = fs.readFileSync(file);
    if (file === path.join(dist, 'sw.js')) body = Buffer.concat([body, Buffer.from(`\n// version ${version}\n`)]);
    res.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate'});
    res.end(body);
  });
  return new Promise(resolve => server.listen(0, () => resolve({
    url: `http://localhost:${server.address().port}/`,
    redeploy: () => { version++; },
    close: () => server.close(),
  })));
}

// Only the production build has a Service Worker.
(isProd ? describe : describe.skip)('service worker update', () => {
  let site;
  beforeAll(async () => { site = await serveDist(); });
  afterAll(() => site.close());

  test('a redeploy does not reload the page under the user; it does once the tab is hidden', async () => {
    const url = `${site.url}#src=${encodeURIComponent('cube([1, 2, 3]);')}`;
    const cdp = await page.createCDPSession();
    await cdp.send('Page.enable');
    await cdp.send('Page.setLifecycleEventsEnabled', {enabled: true});
    let documents = 0;
    cdp.on('Page.lifecycleEvent', e => { if (e.name === 'init') documents++; });
    // Counts the times a new Service Worker took control of the page.
    await page.evaluateOnNewDocument(() => {
      window.__controllerChanges = 0;
      navigator.serviceWorker?.addEventListener('controllerchange', () => window.__controllerChanges++);
    });

    // First visit: the Service Worker installs and takes control.
    await page.goto(url);
    await page.waitForFunction(() => navigator.serviceWorker.controller, {timeout: 60000, polling: 250});
    // (Its registration waits for the first render to settle.)
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', {timeout: 30000});

    // Second visit, after a redeploy: the browser finds a new Service Worker while the user is working.
    site.redeploy();
    await page.goto('about:blank');
    documents = 0;
    await page.goto(url);
    await page.waitForFunction(() => window.__controllerChanges > 0, {timeout: 60000, polling: 100});
    await new Promise(resolve => setTimeout(resolve, 3000));
    expect(documents).toBe(1);

    // Tab goes to the background: now it picks up the new version.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'});
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    expect(documents).toBe(2);
  }, 180000);
});
