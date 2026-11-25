const fs = require('fs');
const path = require('path');

const libraryCases = require('./library-cases');

const longTimeout = 300000;

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/';

const hasFallback = fs.existsSync(path.join(__dirname, '../public/openscad.fallback.js'));

// ?wasmEngine=wasm2js forces the JavaScript engine on a WebAssembly-capable browser.
function loadForcedFallback(src) {
  return page.goto(`${baseUrl}?wasmEngine=wasm2js#src=${encodeURIComponent(src)}`);
}

const expectEngine = (engine) => page.waitForFunction(
  (e) => document.documentElement.dataset.engine === e, {timeout: longTimeout}, engine);

const messages = [];
beforeAll(() => {
  page.on('console', msg => messages.push({type: msg.type(), text: msg.text()}));
});
beforeEach(() => { messages.length = 0; });

describe('wasm2js fallback', () => {
  (hasFallback ? test : test.skip)('renders a cube with the JavaScript engine', async () => {
    await loadForcedFallback('cube([10, 10, 10]);');
    await page.waitForFunction(() => {
      const viewer = document.querySelector('model-viewer.main-viewer');
      return viewer && viewer.src !== '';
    }, {timeout: longTimeout});
    await expectEngine('wasm2js');
  }, longTimeout);

  // The same library models as in e2e.test.js, on the JavaScript engine.
  (hasFallback ? test.each : test.skip.each)(libraryCases)('renders with library: %s', async (_, src) => {
    await loadForcedFallback(src);
    await page.waitForFunction(() => {
      const viewer = document.querySelector('model-viewer.main-viewer');
      return viewer && viewer.src !== '';
    }, {timeout: longTimeout});
    await expectEngine('wasm2js');
    expect(messages.filter(m => /Can't open (include|library)|ERROR|Ignoring unknown/.test(m.text))).toHaveLength(0);
  }, longTimeout);

  (hasFallback ? test : test.skip)('shows no banner in JavaScript compatibility mode', async () => {
    await loadForcedFallback('cube([10, 10, 10]);');
    await expectEngine('wasm2js');
    expect(await page.$('.wasm-banner')).toBeNull();
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/compatibility mode/);
  }, longTimeout);

  (hasFallback ? test.skip : test)('shows a dismissible error banner when the fallback is not deployed', async () => {
    await loadForcedFallback('cube([10, 10, 10]);');
    await expectEngine('none');
    await page.waitForFunction(
      () => document.body.innerText.includes('no JavaScript fallback build is available'));
    await page.click('.wasm-banner button[aria-label="Dismiss"]');
    await page.waitForFunction(() => !document.querySelector('.wasm-banner'));
    // Remembered for the session.
    expect(await page.evaluate(() => sessionStorage.getItem('openscad-wasm-banner-dismissed'))).toBe('1');
  }, longTimeout);
});
