// Regression: Cmd+A did not select all in the editor on macOS. BrowserFS.install() leaked a global `process`
// polyfill, which Monaco takes for a Node environment: it read the platform ('browser') from it instead of the
// user agent, no longer saw macOS and bound Select All to Ctrl+A instead of Cmd+A.
const isProd = process.env.NODE_ENV === 'production';
const baseUrl = process.env.E2E_BASE_URL ?? (isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/');

const macUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let originalUserAgent;
beforeAll(async () => {
  originalUserAgent = await browser.userAgent();
});
afterAll(async () => {
  await page.setUserAgent(originalUserAgent);
});

async function selectedLines() {
  return page.evaluate(() => document.querySelectorAll('.monaco-editor .selected-text').length);
}

async function pressSelectAll(client, modifiers) {
  // Meta can't be emulated reliably through keyboard.down('Meta'): dispatch the modified key press directly.
  const event = {key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers};
  await client.send('Input.dispatchKeyEvent', {type: 'rawKeyDown', ...event});
  await client.send('Input.dispatchKeyEvent', {type: 'keyUp', ...event});
}

describe('editor select all', () => {
  beforeEach(async () => {
    await page.setUserAgent(macUserAgent);
    await page.goto('about:blank');
    await page.goto(`${baseUrl}#src=${encodeURIComponent('cube(10);\nsphere(5);')}`);
    await page.waitForSelector('.monaco-editor textarea, .monaco-editor .native-edit-context');
    await page.waitForFunction(() => window.monaco?.editor.getEditors().length > 0);
    await page.click('.monaco-editor .view-lines');
  });

  test('Monaco sees macOS (no global process polyfill)', async () => {
    expect(await page.evaluate(() => typeof process === 'undefined' || process.platform)).not.toBe('browser');
    const label = await page.evaluate(() =>
      monaco.editor.getEditors()[0]._standaloneKeybindingService
        .lookupKeybinding('editor.action.selectAll')?.getLabel());
    expect(label).toBe('⌘A');
  });

  test('Cmd+A selects all', async () => {
    expect(await selectedLines()).toBe(0);
    const client = await page.createCDPSession();
    await pressSelectAll(client, 4 /* Meta */);
    await page.waitForFunction(() => document.querySelectorAll('.monaco-editor .selected-text').length > 0);
    expect(await selectedLines()).toBe(2);
  });
});
