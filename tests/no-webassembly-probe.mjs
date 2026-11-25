// Launches its own Chrome with --jitless (which removes the WebAssembly global), loads the app and prints
// a JSON report. Run as a child process by no-webassembly.test.js: jest-puppeteer's shared browser cannot
// take custom V8 flags per test file, and puppeteer is ESM-only (not require()-able from the jest sandbox).
import puppeteer from 'puppeteer';

const [url, timeoutMs] = [process.argv[2], Number(process.argv[3])];
const pageErrors = [];
const messages = [];
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--js-flags=--jitless'],
});
const report = {};
try {
  const page = await browser.newPage();
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', msg => messages.push(msg.text()));
  await page.goto(url);
  report.webAssemblyType = await page.evaluate(() => typeof WebAssembly);
  try {
    await page.waitForFunction(() => {
      const viewer = document.querySelector('model-viewer.main-viewer');
      return viewer && viewer.src !== '';
    }, {timeout: timeoutMs});
    await page.waitForFunction(
      () => document.documentElement.dataset.engine === 'wasm2js', {timeout: timeoutMs});
    report.bannerShown = await page.evaluate(() => !!document.querySelector('.wasm-banner'));
    report.rendered = true;
  } catch (e) {
    report.rendered = false;
    report.error = String(e);
  }
  report.renderTimeLogged = messages.some(t => /Total rendering time/.test(t));
} finally {
  report.pageErrors = pageErrors;
  await browser.close();
}
console.log(JSON.stringify(report));
