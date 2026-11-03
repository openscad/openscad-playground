// Guards on what the production bundle contains (production build only, see network.test.js).

const fs = require('fs');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const dist = path.resolve(__dirname, '..', 'dist');

const jsFiles = () => fs.readdirSync(dist).filter(f => f.endsWith('.js') && !f.startsWith('model-viewer') && f !== 'sw.js');
const count = (text, needle) => text.split(needle).length - 1;

(isProd ? describe : describe.skip)('bundle', () => {
  test('the Monaco editor is not bundled (it is loaded at runtime by @monaco-editor/loader)', () => {
    // `import * as monaco from 'monaco-editor/...'` used as a value pulls ~3 MB of editor code
    // into a chunk; use `import type` and src/language/monaco-enums.ts instead.
    for (const file of jsFiles()) {
      const text = fs.readFileSync(path.join(dist, file), 'utf8');
      expect({file, monacoModules: count(text, 'vs/editor/')}).toEqual({file, monacoModules: expect.any(Number)});
      expect(count(text, 'vs/editor/')).toBeLessThan(20);
    }
  });

  test('the MCP SDK is only in chunks loaded in MCP mode, not in the standalone entry chunk', () => {
    // McpApp / mcp-app.ts must be reached through import() from index.tsx.
    const entry = fs.readFileSync(path.join(dist, 'index.js'), 'utf8');
    expect(count(entry, 'ui/initialize')).toBe(0);
  });

  test('index.html preconnects to the CDN Monaco is loaded from', () => {
    const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
    // @monaco-editor/loader's default CDN.
    const loader = fs.readFileSync(path.join(__dirname, '..', 'node_modules', '@monaco-editor/loader', 'lib', 'cjs', 'config', 'index.js'), 'utf8');
    const origin = /https:\/\/[^/'"]+/.exec(loader)[0];
    // (The built HTML is minified: attributes may be unquoted.)
    const links = [...html.matchAll(/<link[^>]*rel="?preconnect"?[^>]*>/g)].map(m => m[0]).filter(l => l.includes(origin));
    expect(links).toHaveLength(2);
    expect(links.filter(l => /crossorigin/.test(l))).toHaveLength(1);
  });
});
