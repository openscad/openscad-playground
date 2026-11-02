const fs = require('fs');
const path = require('path');

const longTimeout = 300000;

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/';

const hasFallback = fs.existsSync(path.join(__dirname, '../public/openscad.fallback.js'));

// ?wasmEngine=wasm2js forces the JavaScript engine on a WebAssembly-capable browser.
function loadForcedFallback(src) {
  return page.goto(`${baseUrl}?wasmEngine=wasm2js#src=${encodeURIComponent(src)}`);
}

describe('wasm2js fallback', () => {
  (hasFallback ? test : test.skip)('renders a cube with the JavaScript engine', async () => {
    await loadForcedFallback('cube([10, 10, 10]);');
    await page.waitForFunction(() => {
      const viewer = document.querySelector('model-viewer.main-viewer');
      return viewer && viewer.src !== '';
    }, {timeout: longTimeout});
    await page.waitForFunction(
      () => document.body.innerText.includes('JavaScript compatibility mode'));
  }, longTimeout);

  (hasFallback ? test.skip : test)('shows a banner when the fallback is not deployed', async () => {
    await loadForcedFallback('cube([10, 10, 10]);');
    await page.waitForFunction(
      () => document.body.innerText.includes('no JavaScript fallback build is available'));
  }, longTimeout);
});
