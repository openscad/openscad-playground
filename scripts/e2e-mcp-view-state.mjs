#!/usr/bin/env node
/**
 * Manual e2e for MCP view-state persistence, driven through an ext-apps
 * basic-host that exposes `window.__appBridge` (a small test-only patch; the
 * stock host does not) with the OpenSCAD server already running.
 *
 *   HOST_URL=http://localhost:8080 SERVER_NAME='OpenSCAD Playground' \
 *   EXPECT=local|host REPLAY=1|0 node scripts/e2e-mcp-view-state.mjs
 *
 * EXPECT=local  the app must save to localStorage[openscad-mcp-view:<base>:<viewUUID>] (host path unavailable)
 * EXPECT=host   the host must also hold the state (needs a host + app SDK with ui/set-view-state, ext-apps#844)
 * REPLAY=1      the host replays stored tool calls on page reload (the #844 basic-host does), so reload must restore
 * REPLAY=0      the host calls the tool anew (stock basic-host): only the localStorage write and "new call => fresh" are checked
 */
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';

const HOST = process.env.HOST_URL ?? 'http://localhost:8080';
const NAME = process.env.SERVER_NAME ?? 'OpenSCAD Playground';
const EXPECT = process.env.EXPECT ?? 'local';
const REPLAY = process.env.REPLAY === '1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// The basic-host calls `create` with no arguments, so the viewer opens the server's default model.
const url = () => `${HOST}/?server=${encodeURIComponent(NAME)}&tool=create&call=true`;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 800 });
if (process.env.V) { page.on('console', m => console.log('[c]', m.type(), m.text().slice(0, 300))); page.on('pageerror', e => console.log('[err]', e.message.slice(0, 300))); }
const findApp = async () => { for (const f of page.frames()) { try { if (await f.$('model-viewer.main-viewer')) return f; } catch { /* detached */ } } return null; };
const call = (name, args = {}) => page.evaluate(async (name, args) => (await window.__appBridge.callTool({ name, arguments: args })).content.map(c => c.text ?? '').join('\n'), name, args);
async function ready() {
  await page.waitForFunction(() => window.__appBridge, { timeout: 90000 });
  for (let i = 0; i < 90; i++) {
    const ok = await page.evaluate(async () => { try { return (await window.__appBridge.listTools({})).tools.some(t => t.name === 'write_source'); } catch { return false; } });
    if (ok) break; await sleep(1000);
  }
  let f; for (let i = 0; i < 60 && !(f = await findApp()); i++) await sleep(500);
  assert.ok(f, 'app frame');
  return f;
}
const appKeys = (f) => f.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('openscad-mcp-view:')));
const hostKeys = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('basic-host:view-state:')));
const log = (...a) => console.log(...a);

try {
  const EDITED = 'cube([7, 7, 7]); // edited by the user';
  await page.goto(url());
  let f = await ready(); await sleep(3000);
  assert.ok((await call('view_source')).includes('Parametric rounded box'), 'starts from the default model');
  await call('write_source', { content: EDITED });
  await call('set_camera', { azimuth: 33, elevation: 44, distance: 55 }).catch(() => {});
  await sleep(2500); // > the 700 ms debounce
  const keys = await appKeys(f);
  log('app localStorage keys:', keys);
  assert.equal(keys.length, 1, 'one localStorage entry keyed by viewUUID');
  assert.match(keys[0], /:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, 'key ends with a UUID');
  const saved = JSON.parse(await f.evaluate(k => localStorage.getItem(k), keys[0]));
  assert.equal(saved.v, 1); assert.ok(JSON.stringify(saved).includes('edited by the user'));
  assert.ok(saved.inv.startsWith('uuid:'));
  const hk = await hostKeys();
  log('host view-state keys:', hk);
  if (EXPECT === 'host') {
    assert.equal(hk.length, 1, 'the host holds the state');
    assert.ok((await page.evaluate(k => localStorage.getItem(k), hk[0])).includes('edited by the user'));
  } else {
    assert.equal(hk.length, 0, 'the host path must not be used');
  }

  if (REPLAY) {
    for (const dropLocal of EXPECT === 'host' ? [false, true] : [false]) {
      if (dropLocal) { await f.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('openscad-mcp-view:')).forEach(k => localStorage.removeItem(k))); log('dropped the app localStorage copy: the host copy must restore'); }
      await page.reload();
      f = await ready();
      await sleep(1500);
      const src = await call('view_source');
      log(`after reload${dropLocal ? ' (host copy only)' : ''}:`, src.split('\n').slice(0, 3).join(' | '));
      assert.ok(src.includes('edited by the user'), 'edits restored after reload');
      assert.ok(!src.includes('Parametric rounded box'), 'not the default model');
      await sleep(1500);
    }
  }

  // A new tool call (new viewUUID) must not pick up the stale state.
  await page.evaluate(() => localStorage.removeItem('basic-host:tool-calls'));
  await page.goto(url());
  f = await ready(); await sleep(4000);
  const fresh = await call('view_source');
  
  assert.ok(fresh.includes('Parametric rounded box') && !fresh.includes('edited by the user'), 'new call starts fresh');
  log('PASS', { EXPECT, REPLAY });
} finally {
  await browser.close();
}
