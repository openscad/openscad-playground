const libraryCases = require('./library-cases');

const longTimeout = 60000;

const isProd = process.env.NODE_ENV === 'production';
// E2E_BASE_URL: test against an already running server (e.g. when the default ports are taken).
const baseUrl = process.env.E2E_BASE_URL ?? (isProd ? 'http://localhost:3000/dist/' : 'http://localhost:4000/');

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
  await page.goto('about:blank');
  // Leaving the previous page can log aborted prefetches/CORS errors against about:blank: not this test's.
  messages.length = 0;
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
// Both the syntax check and the render mount archives (in separate workers).
function expectMountedArchives(archives) {
  const expected = `Mounting archives: ${archives.length ? archives.join(', ') : '(none)'}`;
  const mounted = messages.filter(msg => msg.type === 'debug' && msg.text.startsWith('Mounting archives: '));
  expect(mounted.length).toBeGreaterThan(0);
  for (const msg of mounted) {
    expect(msg.text).toBe(expected);
  }
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

  test('the completion sound ships in compact formats', async () => {
    await page.goto(baseUrl);
    const sources = await page.evaluate(() => [...document.querySelectorAll('#complete-sound source')].map(s => s.src));
    expect(sources.map(s => s.split('/').pop())).toEqual(['complete.ogg', 'complete.m4a']);
    for (const src of sources) {
      const res = await page.evaluate(async (u) => {
        const r = await fetch(u);
        return {ok: r.ok, bytes: (await r.arrayBuffer()).byteLength};
      }, src);
      expect(res.ok).toBe(true); // 200, or 206 from servers that answer media requests with ranges
      expect(res.bytes).toBeGreaterThan(1000);
      expect(res.bytes).toBeLessThan(20 * 1024);
    }
    // The e2e browser (Chrome) must be able to decode the first source.
    const canPlay = await page.evaluate(() => document.getElementById('complete-sound').canPlayType('audio/ogg; codecs="opus"'));
    expect(canPlay).not.toBe('');
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

  test('a script without library references fetches no library archive', async () => {
    const zips = [];
    const onRequest = (req) => { if (/\/libraries\/[^/]+\.zip$/.test(req.url())) zips.push(req.url()); };
    page.on('request', onRequest);
    try {
      await loadSrc('cube([10, 10, 10]);');
      await waitForViewer();
      // (The archives are fetched in the background, but only a moment after the first render.)
    } finally {
      page.off('request', onRequest);
    }
    expect3DPolySet();
    // The worker mounts nothing; the main thread only fetches the archives after the first render.
    expectMountedArchives([]);
    expect(zips).toEqual([]);
  }, longTimeout);

  test('mounts the fonts for text()', async () => {
    await loadSrc('linear_extrude(1) text("Hi");');
    await waitForViewer();
    expectMountedArchives(['fonts']);
  }, longTimeout);

  test('mounts BOSL2 but not other libraries', async () => {
    await loadSrc(`
      include <BOSL2/std.scad>
      prismoid([40,40], [0,0], h=20);
    `);
    await waitForViewer();
    expect3DPolySet();
    expectMountedArchives(['BOSL2']);
  }, longTimeout);

  test('mounts the libraries that libraries depend on', async () => {
    await loadSrc(`
      include <openscad_attachable_text3d/attachable_text3d.scad>
      cube(1);
    `);
    await waitForViewer();
    expectMountedArchives(['fonts', 'BOSL2', 'openscad_attachable_text3d']);
  }, longTimeout);

  test('missing libraries are mounted by a retry, leaving clean logs and markers', async () => {
    // ?archives= (none) makes the first attempt miss BOSL2, as if the scan had.
    await page.goto(`${baseUrl}?archives=#src=${encodeURIComponent(`
      include <BOSL2/std.scad>
      prismoid([40,40], [0,0], h=20);
    `)}`);
    await waitForViewer();
    const mounted = new Set(messages.filter(msg => msg.type === 'debug' && msg.text.startsWith('Mounting archives: ')).map(msg => msg.text));
    expect([...mounted].sort()).toEqual(['Mounting archives: (none)', 'Mounting archives: BOSL2'].sort());
    // Let the (also retried) syntax check finish: no stale 'Can't open library' marker may remain.
    await new Promise(r => setTimeout(r, 3000));
    expect(await page.$$('.squiggly-error, .squiggly-warning')).toHaveLength(0);
  }, longTimeout);

  // Library zips requested by the page (the worker's own requests aren't visible here).
  function collectZipRequests() {
    const zips = [];
    const onRequest = (req) => { const m = req.url().match(/\/libraries\/([^/]+)\.zip$/); if (m) zips.push(m[1]); };
    page.on('request', onRequest);
    return { zips, stop: () => page.off('request', onRequest) };
  }
  // Expands the given chain of nodes of the open file picker tree (each is a child of the previous one).
  // The tree can re-render and collapse while libraries get mounted/indexed: re-expand from the top until the whole chain is open.
  function expandTreePath(path) {
    return page.waitForFunction((path) => {
      for (const label of path) {
        const li = [...document.querySelectorAll('li.p-treenode')]
          .find(li => li.querySelector(':scope > .p-treenode-content .p-treenode-label')?.textContent === label);
        if (!li) return false;
        if (li.getAttribute('aria-expanded') !== 'true') {
          li.querySelector(':scope > .p-treenode-content .p-tree-toggler')?.click();
          return false;
        }
      }
      return true;
    }, {timeout: 30000, polling: 200}, path);
  }
  // Expands the given nodes of the open file picker tree, then clicks the last one.
  // (The tree may re-render and collapse while libraries get mounted/indexed: retry from the top.)
  function clickTreePath(path) {
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
  const lazyLibraries = ['BOSL', 'openscad-tray', 'Stemfie_OpenSCAD', 'lasercut', 'boltsparts', 'openscad_attachable_text3d'];

  test('the file picker lists libraries, lazy ones from the index without fetching them', async () => {
    const requests = collectZipRequests();
    await loadSrc('cube([10, 10, 10]);');
    await waitForViewer();
    await page.click('.p-treeselect');
    await page.waitForFunction((names) => {
      // (Re-expand: the tree may re-render and collapse while libraries get mounted/indexed.)
      const folder = [...document.querySelectorAll('li.p-treenode')].find(li => li.querySelector(':scope > .p-treenode-content .p-treenode-label')?.textContent === 'libraries');
      if (folder && folder.getAttribute('aria-expanded') !== 'true') folder.querySelector(':scope > .p-treenode-content .p-tree-toggler')?.click();
      const labels = new Set([...document.querySelectorAll('.p-treenode-label')].map(l => l.textContent));
      return names.every(n => labels.has(n));
    }, {timeout: 30000, polling: 200}, ['BOSL2', 'NopSCADlib', 'MCAD', 'openscad', ...lazyLibraries]);
    // Lazy libraries can be browsed...
    await expandTreePath(['libraries', 'boltsparts', 'vacuum']);
    await page.waitForFunction(() => [...document.querySelectorAll('.p-treenode-label')].some(l => l.textContent === 'CF-Flange.scad'), {timeout: 30000, polling: 200});
    // ...without having been fetched; the removed library is gone.
    await new Promise(r => setTimeout(r, 1500));
    requests.stop();
    for (const name of lazyLibraries) {
      expect(requests.zips).not.toContain(name);
    }
    expect(await page.evaluate(() => document.body.innerText)).not.toContain('FunctionalOpenSCAD');
  }, longTimeout);

  test('the file picker keeps the folders you expanded when the app re-renders', async () => {
    await loadSrc('cube([10, 10, 10]);');
    await waitForViewer();
    await page.click('.p-treeselect');
    await expandTreePath(['libraries', 'openscad', 'examples']);
    const expandedFolders = () => page.evaluate(() => [...document.querySelectorAll('li.p-treenode[aria-expanded=true]')]
      .map(li => li.querySelector(':scope > .p-treenode-content .p-treenode-label')?.textContent));
    expect(await expandedFolders()).toEqual(expect.arrayContaining(['libraries', 'openscad', 'examples']));
    // Any state change re-renders the app (here: editing the source, which renders again).
    const before = await page.evaluate(() => document.querySelector('model-viewer.main-viewer').src);
    await page.evaluate(() => window.monaco.editor.getModels()[0].setValue('cube([12, 12, 12]);'));
    await page.waitForFunction((before) => document.querySelector('model-viewer.main-viewer').src !== before, {timeout: 30000}, before);
    expect(await expandedFolders()).toEqual(expect.arrayContaining(['libraries', 'openscad', 'examples']));
  }, longTimeout);

  test('opening a file of a lazy library fetches the library and opens the file', async () => {
    await loadSrc('cube([10, 10, 10]);');
    await waitForViewer();
    await page.click('.p-treeselect');
    const requests = collectZipRequests();
    messages.length = 0;
    await clickTreePath(['libraries', 'boltsparts', 'vacuum', 'CF-Flange.scad']);
    await page.waitForFunction(() => document.querySelector('.p-treeselect-label')?.textContent.includes('CF-Flange.scad'), {timeout: 30000});
    for (let i = 0; i < 300 && !messages.some(m => m.text === 'Mounting archives: boltsparts'); i++) {
      await new Promise(r => setTimeout(r, 100)); // the file renders (mounting its library in the worker)
    }
    requests.stop();
    expect(requests.zips).toContain('boltsparts');
    expectMountedArchives(['boltsparts']);
    // (Switching away from the unsaved default file logs 'Error while reading file', which is not about libraries.)
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].text.startsWith('Error while reading file')) messages.splice(i, 1);
  }, longTimeout);

  test('typing a long burst under CPU throttling keeps every keystroke', async () => {
    // The controlled editor value used to lag behind typing: a stale render overwrote newer keystrokes
    // ("boltsparts/" became "boltsarts/") and closed the completion widget, which made the completion tests
    // flaky under CI load. (Throttling only makes the race likelier; the deterministic check is the
    // EditorValueSync unit test.)
    await loadSrc('// ');
    await page.waitForSelector('.monaco-editor .view-lines');
    await page.click('.monaco-editor .view-lines');
    await page.keyboard.down('Control');
    await page.keyboard.press('End');
    await page.keyboard.up('Control');
    const client = await page.createCDPSession();
    await client.send('Emulation.setCPUThrottlingRate', {rate: 4});
    const typed = '// ' + 'abcdefghijklmnopqrstuvwxyz0123456789 '.repeat(12) + 'boltsparts/vacuum';
    try {
      await page.keyboard.type(typed);
      await new Promise(r => setTimeout(r, 4000)); // let the throttled renders drain
    } finally {
      await client.send('Emulation.setCPUThrottlingRate', {rate: 1});
    }
    expect(await page.evaluate(() => window.monaco.editor.getModels().map(m => m.getValue()).join('\n'))).toBe('// ' + typed);
    messages.length = 0; // the intermediate sources are not valid scripts
  }, longTimeout);

  test('completes include/use library names and paths, lazy libraries included, without fetching them', async () => {
    const requests = collectZipRequests();
    await loadSrc('use <');
    await page.waitForSelector('.monaco-editor .view-lines');
    await page.click('.monaco-editor .view-lines');
    await page.keyboard.down('Control');
    await page.keyboard.press('End');
    await page.keyboard.press('Space');
    await page.keyboard.up('Control');
    await page.waitForFunction(() => {
      const w = document.querySelector('.suggest-widget.visible');
      return w && w.textContent.includes('BOSL2');
    }, {timeout: 30000});
    // The widget only renders the first rows: narrow the list down to a lazy library, then to its files.
    const suggests = (text) => page.waitForFunction((text) => document.querySelector('.suggest-widget.visible')?.textContent.includes(text), {timeout: 30000}, text);
    try {
      await page.keyboard.type('bolt', {delay: 50});
      await suggests('boltsparts');
      await page.keyboard.type('sparts/', {delay: 50});
      await suggests('vacuum');
      await page.keyboard.type('vacuum/', {delay: 50});
      await suggests('CF-Flange.scad');
      requests.stop();
      expect(requests.zips).not.toContain('boltsparts');
    } finally {
      messages.length = 0; // the incomplete scripts typed here fail to render: not what this test is about
    }
  }, longTimeout);

  test('a removed library gives OpenSCAD\'s missing file warning and a hint', async () => {
    await loadSrc(`
      include <FunctionalOpenSCAD/functional.scad>
      cube(1);
    `);
    await waitForViewer();
    await page.waitForSelector('button .pi-align-left');
    await page.evaluate(() => document.querySelector('button .pi-align-left').closest('button').click());
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("Can't open include file 'FunctionalOpenSCAD/functional.scad'")
        && text.includes('"FunctionalOpenSCAD" is no longer bundled');
    }, {timeout: 30000});
  }, longTimeout);

  test('use NopSCADlib', async () => {
    await loadSrc(`
      include <NopSCADlib/vitamins/led_meters.scad>
      meter(led_meter);
    `);
    await waitForViewer();
    expect3DManifold();
    expectMountedArchives(['fonts', 'NopSCADlib']);
  }, longTimeout);

  test('mounts the fonts when a library turns out to need them', async () => {
    await loadSrc(`
      include <BOSL2/std.scad>
      text3d("Hi");
    `);
    await waitForViewer();
    // The first run only had BOSL2 (no text() in the source), and got a font warning.
    await page.waitForFunction(() => document.querySelector('model-viewer.main-viewer')?.src);
    const mounted = new Set(messages.filter(msg => msg.type === 'debug' && msg.text.startsWith('Mounting archives: ')).map(msg => msg.text));
    expect([...mounted].sort()).toEqual(['Mounting archives: BOSL2', 'Mounting archives: fonts, BOSL2'].sort());
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

  // Only the production build has a Service Worker.
  (isProd ? test : test.skip)('works offline after a first visit', async () => {
    // A first visit that uses BOSL2 and fonts (fetched by the render worker, before the Service Worker is in control).
    await loadSrc('include <BOSL2/std.scad>\nlinear_extrude(1) text("Online");\nprismoid([40,40], [0,0], h=20);');
    await waitForViewer();

    // Wait for the Service Worker to be in control and for the (deferred)
    // fetches of the engine and the libraries to have gone through it.
    await page.waitForFunction(async () => {
      if (!navigator.serviceWorker.controller) return false;
      for (const url of ['openscad.wasm', 'libraries/BOSL2.zip', 'libraries/index.json', 'libraries/fonts.zip', 'index.js']) {
        if (!await caches.match(new URL(url, location.href).href, {ignoreSearch: true})) return false;
      }
      return true;
    }, {timeout: 45000, polling: 500});

    // Offline for the page *and* for the Service Worker, which has its own network.
    const swSession = await (await browser.waitForTarget(t => t.type() === 'service_worker')).createCDPSession();
    await swSession.send('Network.enable');
    const setOffline = (offline) => Promise.all([
      page.setOfflineMode(offline),
      swSession.send('Network.emulateNetworkConditions', {offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1}),
    ]);
    await setOffline(true);
    try {
      await page.goto('about:blank');
      messages.length = 0;
      await loadSrc(`
        include <BOSL2/std.scad>
        linear_extrude(1) text("Offline");
        prismoid([40,40], [0,0], h=20);
      `);
      await waitForViewer();
      expect(messages.some(msg => msg.type === 'debug' && msg.text.startsWith('stderr: Top level object is a'))).toBe(true);
      expectMountedArchives(['fonts', 'BOSL2']);

      // A library that was never fetched can be browsed (index) but not opened: a clear message.
      await page.click('.p-treeselect');
      // (lasercut: no other test fetches it, which would put it in the Service Worker's cache.)
      await clickTreePath(['libraries', 'lasercut', 'examples_flattened_tweak.scad']);
      await page.waitForFunction(() => document.querySelector('.p-treeselect-label')?.textContent.includes('Could not load lasercut'), {timeout: 30000});
      // (The failed fetch is logged by the browser, which is the point of this part of the test.)
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i].type === 'error' && /Failed to load resource|Error while reading file/.test(messages[i].text)) messages.splice(i, 1);
    } finally {
      await setOffline(false);
    }
  }, 2 * longTimeout);

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
    expect(withParams).toEqual(expect.arrayContaining(['Customize', 'Download .scad']));
    expect(withParams).not.toContain('Copy source');
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
    await page.waitForSelector('[role=toolbar] button[aria-label="Download .scad"]', { timeout: 45000 });
    const without = await toolbarLabels();
    expect(without).not.toContain('Customize');
    expect(without).toContain('Download .scad');
    expect(without).not.toContain('Copy source');
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

  test('Download .scad downloads the active file as UTF-8 text and confirms; there is no Copy source button', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(src)}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Download .scad"]', { timeout: 45000 });
    expect(await page.$('button[aria-label="Copy source"]')).toBeNull();
    await page.evaluate(() => {
      window.__downloads = [];
      HTMLAnchorElement.prototype.click = function () { window.__downloads.push({ href: this.href, name: this.download }); };
    });
    await page.click('button[aria-label="Download .scad"]');
    await page.waitForFunction(() => window.__downloads.length === 1, { timeout: 30000 });
    const dl = await page.evaluate(async () => {
      const d = window.__downloads[0];
      const res = await fetch(d.href);
      return { name: d.name, type: (await res.blob()).type, text: await (await fetch(d.href)).text() };
    });
    expect(dl.name).toBe('playground.scad');
    expect(dl.type).toContain('text/x-openscad');
    expect(dl.text).toBe(src);
    await page.waitForFunction(() => /^Downloaded playground\.scad/.test(document.querySelector('[role=status][aria-live=polite]')?.textContent ?? ''));
  }, longTimeout);
});

describe('embed render and download', () => {
  const cube = 'cube([5, 5, 5]);';
  const labels = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('[role=toolbar][aria-label="Viewer actions"] [aria-label]')).map(e => e.getAttribute('aria-label')));

  test('the toolbar has Render and Download; Render reports completion', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(cube)}`);
    await waitForViewer();
    await page.waitForSelector('button[aria-label="Render"]', { timeout: 45000 });
    expect(await labels()).toEqual(expect.arrayContaining(['Render', 'Download', 'Download .scad']));
    await page.click('button[aria-label="Render"]');
    await page.waitForFunction(() => /^Rendered/.test(document.querySelector('[role=status][aria-live=polite]')?.textContent ?? ''), { timeout: 60000 });
  }, longTimeout);

  test('Download offers the 3D formats and delivers a valid binary STL', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent(cube)}`);
    await waitForViewer();
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Download"]')?.disabled, { timeout: 45000 });
    await page.evaluate(() => {
      window.__downloads = [];
      HTMLAnchorElement.prototype.click = function () { window.__downloads.push({ href: this.href, name: this.download }); };
    });
    await page.click('button[aria-label="Download"]');
    await page.waitForSelector('[role=menu][aria-label="Download format"]');
    const items = await page.evaluate(() => Array.from(document.querySelectorAll('[role=menuitem]')).map(e => e.textContent));
    expect(items.map(t => t.split(' ')[0])).toEqual(['STL', '3MF', 'GLB', 'OFF']);
    await page.click('[role=menuitem]'); // STL
    await page.waitForFunction(() => window.__downloads.length === 1, { timeout: 60000 });
    const dl = await page.evaluate(async () => {
      const d = window.__downloads[0];
      return { name: d.name, bytes: Array.from(new Uint8Array(await (await fetch(d.href)).arrayBuffer())) };
    });
    expect(dl.name).toBe('playground.stl');
    // Binary STL: 80-byte header, uint32 triangle count, 50 bytes per triangle; a cube has 12.
    const buf = Buffer.from(dl.bytes);
    expect(buf.readUInt32LE(80)).toBe(12);
    expect(buf.length).toBe(84 + 12 * 50);
    await page.waitForFunction(() => /^Downloaded playground\.stl/.test(document.querySelector('[role=status][aria-live=polite]')?.textContent ?? ''));
  }, longTimeout);
});

describe('render supersede', () => {
  test('a full render started while the initial preview is still pending leaves nothing stuck busy', async () => {
    // Regression: the full render cancelled the debounced preview, whose promise never settled, so `previewing`
    // stayed true: the Render button spun forever and tools waiting for idle timed out.
    await page.goto(`${baseUrl}?embed=1#src=${encodeURIComponent('cube([5, 5, 5]);')}`);
    // The toolbar shows "Rendering…" (disabled) while the initial preview is pending; F6 is the full render.
    await page.waitForSelector('[role=toolbar] button[aria-label="Rendering…"], [role=toolbar] button[aria-label="Render"]', { timeout: 45000 });
    await page.keyboard.press('F6'); // within the preview debounce window: cancels the pending preview
    await page.waitForSelector('[role=toolbar] button[aria-label="Render"]:not([disabled])', { timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500)); // longer than the preview debounce
    expect(await page.$('[role=toolbar] button[aria-label="Render"]:not([disabled])')).not.toBeNull();
  }, longTimeout);
});

describe('GitHub ribbon', () => {
  const ribbonVisible = (target) => target.evaluate(() => {
    const r = document.querySelector('.github-fork-ribbon');
    return !!r && getComputedStyle(r).display !== 'none';
  });
  const src = `#src=${encodeURIComponent('cube(5);')}`;

  test('visible in the full UI, hidden in embed (?embed=1, framed, runtime toggle)', async () => {
    await page.setViewport({ width: 1200, height: 900 }); // the ribbon is also hidden on small viewports
    await page.goto(`${baseUrl}?embed=0${src}`);
    await page.waitForSelector('button[title="Settings menu"]', { timeout: 45000 });
    expect(await ribbonVisible(page)).toBe(true);

    // Runtime toggle through the settings menu, both ways.
    await page.click('button[title="Settings menu"]');
    await page.evaluate(() => Array.from(document.querySelectorAll('.p-menuitem-link')).find(a => a.textContent.includes('Embed mode')).click());
    await page.waitForSelector('button[aria-label="Download .scad"]', { timeout: 20000 });
    expect(await ribbonVisible(page)).toBe(false);
    await page.click('button[aria-label^="Exit embed mode"]');
    await page.waitForSelector('button[title="Settings menu"]', { timeout: 20000 });
    expect(await ribbonVisible(page)).toBe(true);

    await page.goto('about:blank');
    await page.goto(`${baseUrl}?embed=1${src}`);
    await page.waitForSelector('button[aria-label="Download .scad"]', { timeout: 45000 });
    expect(await ribbonVisible(page)).toBe(false);

    // Framed: no ?embed at all.
    await page.goto(`${baseUrl}manifest.json`);
    await page.evaluate((u) => { document.body.innerHTML = `<iframe style="width:1100px;height:800px" src="${u}"></iframe>`; }, `${baseUrl}${src}`);
    const frame = await (await page.waitForSelector('iframe')).contentFrame();
    await frame.waitForSelector('button[aria-label="Download .scad"]', { timeout: 45000 });
    expect(await ribbonVisible(frame)).toBe(false);
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].location?.url?.endsWith('/favicon.ico')) messages.splice(i, 1);
    await page.setViewport({ width: 800, height: 600 });
  }, longTimeout * 2);
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
  (configured ? test : test.skip)('opens the configured URL in a new tab when set', async () => {
    await openSettings();
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll('.p-menuitem-link')).map(a => a.textContent));
    expect(labels).toContain('Configure MCP');
    const opened = new Promise(resolve => browser.once('targetcreated', t => resolve(t)));
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('.p-menuitem-link')).find(a => a.textContent.includes('Configure MCP')).click();
    });
    const target = await opened;
    expect(target.url() === new URL(configured, baseUrl).toString() || target.url() === 'about:blank').toBe(true);
    // A noopener popup starts at about:blank before navigating: wait for the final URL.
    await new Promise(r => setTimeout(r, 1500));
    const urls = (await browser.pages()).map(p => p.url());
    expect(urls).toContain(new URL(configured, baseUrl).toString());
    await (await target.page())?.close();
  }, longTimeout);
});

describe('view notices', () => {
  const src = encodeURIComponent('cube([5, 5, 5]);');
  const orbit = () => page.$eval('model-viewer.main-viewer', el => { const o = el.getCameraOrbit(); return [o.theta, o.phi].map(v => Math.round(v * 1000) / 1000); });
  async function clickAxesGizmo() {
    await page.waitForSelector('model-viewer:not(.main-viewer)', { timeout: 45000 });
    await new Promise(r => setTimeout(r, 1500)); // let the models load
    const box = await (await page.$('model-viewer:not(.main-viewer)')).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }

  test('embed: clicking the axes gizmo changes the view without a visible toast, but announces it', async () => {
    await page.goto(`${baseUrl}?embed=1#src=${src}`);
    await waitForViewer();
    await page.waitForSelector('[role=toolbar]', { timeout: 45000 });
    const before = await orbit();
    await clickAxesGizmo();
    await page.waitForFunction(() => /view$/.test(document.querySelector('[data-announcer]')?.textContent ?? ''), { timeout: 10000 });
    expect(await page.$$('.p-toast-message')).toHaveLength(0);
    await new Promise(r => setTimeout(r, 1500));
    expect(await orbit()).not.toEqual(before);
    expect(await page.$$('.p-toast-message')).toHaveLength(0);
  }, longTimeout);

  test('full UI: the same click still shows the toast', async () => {
    await page.goto(`${baseUrl}?embed=0#src=${src}`);
    await waitForViewer();
    await clickAxesGizmo();
    await page.waitForSelector('.p-toast-message', { timeout: 10000 });
    expect(await page.$eval('.p-toast-message', el => el.textContent)).toMatch(/view/);
  }, longTimeout);
});

