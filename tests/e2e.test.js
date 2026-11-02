const libraryCases = require('./library-cases');

const longTimeout = 60000;

const isProd = process.env.NODE_ENV === 'production';
const baseUrl = isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/';

const messages = [];

beforeAll(async () => {
  page.on('console', (msg) => messages.push({
    type: msg.type(),
    text: msg.text(),
    stack: msg.stackTrace(),
    location: msg.location(),
  }));
});

beforeEach(async () => {
  messages.length = 0;
  await page.goto('about:blank');
});

afterEach(async () => {
  // console.log('Messages:', JSON.stringify(messages, null, 2));
  const testName = expect.getState().currentTestName;
  console.log(`[${testName}] Messages:`, JSON.stringify(messages.map(({ text }) => text), null, 2));

  const errors = messages.filter(msg =>
    msg.type === 'error' &&
    !(msg.text.includes('404')
      && msg.stack.some(s =>
        s.url.indexOf('fonts/InterVariable.woff') >= 0)));
  expect(errors).toHaveLength(0);
});

function loadSrc(src) {
  return page.goto(`${baseUrl}#src=${encodeURIComponent(src)}`);
}
function loadPath(path) {
  return page.goto(`${baseUrl}#path=${encodeURIComponent(path)}`);
}
function loadUrl(url) {
  return page.goto(`${baseUrl}#url=${encodeURIComponent(url)}`);
}
async function waitForViewer() {
  await page.waitForSelector('model-viewer');
  await page.waitForFunction(() => {
    const viewer = document.querySelector('model-viewer.main-viewer');
    return viewer && viewer.src !== '';
  });
}
function expectMessage(messages, line) {
  const successMessage = messages.filter(msg => msg.type === 'debug' && msg.text === line);
  expect(successMessage).toHaveLength(1);
}
function expectObjectList() {
  expectMessage(messages, 'stderr: Top level object is a list of objects:');
}
function expect3DPolySet() {
  expectMessage(messages, 'stderr: Top level object is a 3D object (PolySet):');
}
function expect3DManifold() {
  expectMessage(messages, 'stderr:    Top level object is a 3D object (manifold):');
}
function waitForCustomizeButton() {
  return page.waitForFunction(() => {
    // Try multiple selectors for PrimeReact components
    // ToggleButton might render as button or input elements
    const selectors = [
      'input[role=switch]',
      'button',
      '[role=tab]',
      '.p-togglebutton',
      '.p-tabmenu-nav a'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent || element.innerText || '';
        const parentText = element.parentElement?.textContent || element.parentElement?.innerText || '';
        if (text.includes('Customize') || parentText.includes('Customize')) {
          return element;
        }
      }
    }
    return null;
  }, { timeout: 45000 }); // Increase timeout to 45 seconds
}
function waitForLabel(text) {
  return page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('label')).find(el => el.textContent === 'myVar');
    // return Array.from(document.querySelectorAll('label')).find(el => el.textContent === text);
  });
}

describe('e2e', () => {
  test('load the default page', async () => {
    await page.goto(baseUrl);
    await waitForViewer();
    expectObjectList();
  }, longTimeout);

  test('sources in subdirectories can be included', async () => {
    // Regression: the worker did not create parent directories, so /lib/foo.scad failed with an FS error.
    const state = {
      params: {
        activePath: '/main.scad',
        sources: [
          { path: '/lib/foo.scad', content: 'module foo() { cube(5); }\n' },
          { path: '/main.scad', content: 'include </lib/foo.scad>\nfoo();\n' },
        ],
        features: [], exportFormat2D: 'svg', exportFormat3D: 'stl',
      },
      view: { layout: { mode: 'multi', editor: true, viewer: true, customizer: false }, color: '#f9d72c' },
    };
    await page.goto(baseUrl); // same-origin page to run the compressor in
    const fragment = await page.evaluate(async (json) => {
      const bytes = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
      return btoa(String.fromCharCode(...bytes));
    }, JSON.stringify(state));
    messages.length = 0;
    await page.goto(`${baseUrl}#${fragment}`);
    await page.reload();
    await waitForViewer();
    expect3DPolySet();
  }, longTimeout);

  test('can render cube', async () => {
    await loadSrc('cube([10, 10, 10]);');
    await waitForViewer();
    expect3DPolySet();
  }, longTimeout);

  test('displayed model is a valid GLB', async () => {
    await loadSrc('cube([10, 20, 30]);');
    await waitForViewer();
    await page.waitForFunction(() => document.querySelector('model-viewer.main-viewer').src.startsWith('data:'));
    const glb = await page.evaluate(async () => {
      const src = document.querySelector('model-viewer.main-viewer').src;
      return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()));
    });
    const buf = Buffer.from(glb);
    expect(buf.toString('ascii', 0, 4)).toBe('glTF');
    expect(buf.readUInt32LE(4)).toBe(2);
    expect(buf.readUInt32LE(8)).toBe(buf.length);
    const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)));
    expect(json.meshes).toHaveLength(1);
    const prim = json.meshes[0].primitives[0];
    const position = json.accessors[prim.attributes.POSITION];
    expect(position.count).toBe(8);
    expect(position.min).toEqual([0, 0, 0]);
    expect(position.max).toEqual([10, 20, 30]);
    expect(json.accessors[prim.indices].count).toBe(36);
  }, longTimeout);

  test('syntax error markers point at the offending line', async () => {
    // Regression: the syntax checker used to subtract a line for a prefix it never injected.
    await loadSrc('a = 1;\nb = 2;\ncube(;\nsphere(3);\n');
    await page.waitForSelector('.squiggly-error', { timeout: 60000 });
    // The squiggle lives in an overlay layer: match it to the editor line at the same height.
    const lineText = await page.evaluate(() => {
      const top = document.querySelector('.squiggly-error').getBoundingClientRect().top;
      const line = [...document.querySelectorAll('.view-line')].find(l => Math.abs(l.getBoundingClientRect().top - top) < 2);
      return line?.textContent ?? '';
    });
    expect(lineText).toContain('cube(;');
    messages.length = 0; // the failed render legitimately logs a console error
  }, longTimeout);

  test('use BOSL2', async () => {
    await loadSrc(`
      include <BOSL2/std.scad>;
      prismoid([40,40], [0,0], h=20);
    `);
    await waitForViewer();
    expect3DPolySet();
  }, longTimeout);

  test('use NopSCADlib', async () => {
    await loadSrc(`
      include <NopSCADlib/vitamins/led_meters.scad>
      meter(led_meter);
    `);
    await waitForViewer();
    expect3DManifold();
  }, longTimeout);

  // Libraries whose entry points live at the root of the zip (or in a sub-folder matched by a wildcard).
  test.each([
    ['NopSCADlib/lib.scad', `include <NopSCADlib/lib.scad>\nball_bearing(BB608);`],
    ['YAPP_Box template', `include <YAPP_Box/YAPP_Template_v3.scad>\ncube(5);`],
    ['UB.scad', `include <UB.scad/libraries/ub.scad>\ncube(5);`],
    ['MCAD', `use <MCAD/boxes.scad>\nroundedCube([20,20,10], 3, true, true);`],
  ])('library entry point resolves: %s', async (_, src) => {
    await loadSrc(src);
    await waitForViewer();
    expect(messages.filter(m => m.text.includes("Can't open include file") || m.text.includes("Can't open library"))).toHaveLength(0);
  }, longTimeout);

  test.each(libraryCases)('renders with library: %s', async (_, src) => {
    await loadSrc(src);
    await waitForViewer();
    expect(messages.filter(m => /Can't open (include|library)|ERROR|Ignoring unknown/.test(m.text))).toHaveLength(0);
    // The render log can trail the viewer update.
    for (let i = 0; i < 100 && !messages.some(m => m.text.includes('Top level object is')); i++) {
      await new Promise(r => setTimeout(r, 200));
    }
    expect(messages.filter(m => m.text.includes('Top level object is'))).not.toHaveLength(0);
  }, longTimeout);

  test('load a demo by path', async () => {
    await loadPath('/libraries/closepoints/demo_3D_art.scad');
    await waitForViewer();
    expect3DPolySet();
  }, longTimeout);

  test('load a demo by url', async () => {
    await loadUrl('https://github.com/tenstad/keyboard/blob/main/keyboard.scad');
    await waitForViewer();
    expect3DManifold();
  }, longTimeout);

  test('customizer & windows line endings work', async () => {
    await loadSrc([
      'myVar = 10;',
      'cube(myVar);',
    ].join('\r\n'));
    await waitForViewer();
    expect3DPolySet();

    // Wait for syntax checking to complete and parameters to be detected
    await page.waitForFunction(() => {
      // Look for any indication that parameters have been processed
      const messages = Array.from(document.querySelectorAll('*')).map(el => el.textContent || '').join(' ');
      return messages.includes('myVar') || messages.includes('Customize');
    }, { timeout: 30000 });

    await (await waitForCustomizeButton()).click();
    await page.waitForSelector('fieldset');
    await waitForLabel('myVar');
  }, longTimeout);
});


describe('embed layout', () => {
  const src = 'width = 30; // [10:100]\ncube(width);';
  const embedProbe = () => ({
    customize: !!document.querySelector('button[aria-label="Customize"]'),
    overlay: !!document.querySelector('[role=complementary][aria-label=Customizer]'),
    tabs: !!document.querySelector('.p-togglebutton, .p-tabmenu'),
    editor: !!document.querySelector('.monaco-editor'),
  });

  test('?embed=1 shows only the viewer, with a customizer overlay toggle', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Customize"]', { timeout: 45000 });
    expect(await page.evaluate(embedProbe)).toEqual({ customize: true, overlay: false, tabs: false, editor: false });
    await page.click('button[aria-label="Customize"]');
    await page.waitForSelector('[role=complementary][aria-label=Customizer]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role=complementary][aria-label=Customizer]'));
  }, longTimeout);

  test('a framed page defaults to embed, ?embed=0 keeps the full UI', async () => {
    for (const [query, wantEmbed] of [['', true], ['?embed=0', false]]) {
      // Any non-app document works as the embedder (a JSON file here), framing the app.
      const url = `${baseUrl}${query}#src=${encodeURIComponent(src)}`;
      await page.goto(`${baseUrl}manifest.json`);
      await page.evaluate((u) => {
        document.body.innerHTML = `<iframe style="width:900px;height:500px" src="${u}"></iframe>`;
      }, url);
      const handle = await page.waitForSelector('iframe');
      const frame = await handle.contentFrame();
      await frame.waitForSelector('model-viewer');
      const probe = await frame.waitForFunction(
        wantEmbed ? () => !!document.querySelector('button[aria-label="Customize"]')
                  : () => !!document.querySelector('.monaco-editor, .p-togglebutton'),
        { timeout: 45000 });
      expect(!!probe).toBe(true);
      expect(await frame.evaluate(() => !!document.querySelector('button[aria-label="Customize"]'))).toBe(wantEmbed);
      if (wantEmbed) {
        // Framed: the escape hatch is a link to the full app in a new tab (not opened here).
        const link = await frame.$eval('a[aria-label="Open full app in a new tab"]', a => ({ href: a.href, target: a.target, rel: a.rel }));
        expect(link.target).toBe('_blank');
        expect(link.rel).toContain('noopener');
        expect(new URL(link.href).searchParams.get('embed')).toBe('0');
        expect(new URL(link.href).hash.length).toBeGreaterThan(10); // the current state travels along
      }
    }
    // The JSON "embedder" page has no favicon: not an app error.
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].location?.url?.endsWith('/favicon.ico')) messages.splice(i, 1);
    }
  }, longTimeout * 2);

  test('embed has an exit control even without customizer parameters, switching to the full UI in place', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent('cube(5);')}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Exit embed mode (full app)"]', { timeout: 45000 });
    expect(await page.evaluate(embedProbe)).toMatchObject({ customize: false, editor: false });
    await page.click('button[aria-label="Exit embed mode (full app)"]');
    await page.waitForSelector('.monaco-editor', { timeout: 45000 });
    expect(await page.evaluate(embedProbe)).toMatchObject({ editor: true });
  }, longTimeout);

  test('the settings menu toggles embed mode and the exit control returns', async () => {
    await page.goto(`${baseUrl}?embed=0#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('button[title="Settings menu"]', { timeout: 45000 });
    await page.click('button[title="Settings menu"]');
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.p-menuitem-link')).find(a => a.textContent.includes('Embed mode')).click();
    });
    await page.waitForSelector('button[aria-label="Exit embed mode (full app)"]', { timeout: 20000 });
    expect(await page.evaluate(embedProbe)).toMatchObject({ customize: true, editor: false });
    await page.click('button[aria-label="Exit embed mode (full app)"]');
    await page.waitForSelector('button[title="Settings menu"]', { timeout: 20000 });
  }, longTimeout);

  const toolbarLabels = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[role=toolbar][aria-label="Viewer actions"] [aria-label]')).map(e => e.getAttribute('aria-label')));

  test('one top-right toolbar, with the customizer toggle only when there are parameters', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('[role=toolbar] button[aria-label="Customize"]', { timeout: 45000 });
    const withParams = await toolbarLabels();
    expect(withParams).toEqual(expect.arrayContaining(['Customize', 'Copy source']));
    expect(withParams.some(l => l.startsWith('Exit embed mode'))).toBe(true);
    const box = await page.$eval('[role=toolbar][aria-label="Viewer actions"]', el => {
      const r = el.getBoundingClientRect();
      return { right: r.right, top: r.top, w: innerWidth, h: r.height };
    });
    expect(box.top).toBeLessThan(20);
    expect(box.w - box.right).toBeLessThan(20);

    await page.goto('about:blank'); // a hash-only change would not reload
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent('cube(5);')}`);
    await waitForViewer();
    await page.waitForSelector('[role=toolbar] button[aria-label="Copy source"]', { timeout: 45000 });
    const without = await toolbarLabels();
    expect(without).not.toContain('Customize');
    expect(without).toContain('Copy source');
  }, longTimeout);

  test('the customizer docks on the right without resizing the viewer', async () => {
    await page.setViewport({ width: 1000, height: 600 });
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Customize"]', { timeout: 45000 });
    const viewerBox = () => page.$eval('model-viewer.main-viewer', el => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); });
    const before = await viewerBox();
    await page.click('button[aria-label="Customize"]');
    await page.waitForSelector('[role=complementary][aria-label=Customizer]');
    await new Promise(r => setTimeout(r, 500)); // slide-in animation
    const panel = await page.$eval('[role=complementary][aria-label=Customizer]', el => { const r = el.getBoundingClientRect(); return { right: r.right, left: r.left, bottom: r.bottom, w: innerWidth, h: innerHeight }; });
    expect(Math.round(panel.right)).toBe(panel.w);
    expect(panel.left).toBeGreaterThan(panel.w - 400);
    expect(Math.round(panel.bottom)).toBe(panel.h);
    expect(await viewerBox()).toEqual(before);
    // Desktop: clicking the model keeps the (non-modal) panel open.
    await page.mouse.click(200, 300);
    expect(await page.$('[role=complementary][aria-label=Customizer]')).not.toBeNull();
    await page.setViewport({ width: 800, height: 600 });
  }, longTimeout);

  test('copy source puts the active file on the clipboard and confirms', async () => {
    const origin = new URL(baseUrl).origin;
    await page.browserContext().overridePermissions(origin, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Copy source"]', { timeout: 45000 });
    await page.click('button[aria-label="Copy source"]');
    await page.waitForFunction(() => /^Copied /.test(document.querySelector('[role=status][aria-live=polite]')?.textContent ?? ''));
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(src);
  }, longTimeout);
});

describe('Configure MCP menu entry', () => {
  // The entry is driven by the build-time OPENSCAD_MCP_URL define: hidden by default. Run the suite with
  // OPENSCAD_MCP_URL=/mcp (dev server or build) to exercise the configured case.
  const configured = process.env.OPENSCAD_MCP_URL;
  const openSettings = async () => {
    await page.goto(`${baseUrl}#src=${encodeURIComponent('cube(5);')}`);
    await page.waitForSelector('button[title="Settings menu"]', { timeout: 45000 });
    await page.click('button[title="Settings menu"]');
    await page.waitForSelector('.p-menuitem-link');
  };
  (configured ? test.skip : test)('is absent by default', async () => {
    await openSettings();
    expect(await page.evaluate(() => Array.from(document.querySelectorAll('.p-menuitem-link')).some(a => a.textContent.includes('Configure MCP')))).toBe(false);
  }, longTimeout);
  (configured ? test : test.skip)('is a new-tab link to the configured URL when set', async () => {
    await openSettings();
    const link = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('Configure MCP'));
      return a && { href: a.href, target: a.target, rel: a.rel };
    });
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.href).toBe(new URL(configured, baseUrl).toString());
  }, longTimeout);
});

