const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const longTimeout = 300000;

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = process.env.E2E_BASE_URL ?? (isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/');

const hasFallback = fs.existsSync(path.join(__dirname, '../public/openscad.fallback.js'));

// --jitless removes the WebAssembly global entirely (unlike ?wasmEngine=wasm2js, which only forces the
// fallback on a browser that still has WebAssembly), so this covers `typeof WebAssembly === 'undefined'` paths.
describe('browser without the WebAssembly global', () => {
  (hasFallback ? test : test.skip)('renders a cube through the JavaScript fallback with no page errors', () => {
    const url = `${baseUrl}#src=${encodeURIComponent('cube([10, 10, 10]);')}`;
    const out = execFileSync(
      process.execPath,
      [path.join(__dirname, 'no-webassembly-probe.mjs'), url, String(longTimeout - 30000)],
      {encoding: 'utf8', timeout: longTimeout});
    const report = JSON.parse(out.trim().split('\n').pop());
    expect(report.webAssemblyType).toBe('undefined');
    expect(report.pageErrors).toEqual([]);
    expect(report.rendered).toBe(true);
    expect(report.bannerShown).toBe(false);
    expect(report.renderTimeLogged).toBe(true);
  }, longTimeout);
});
