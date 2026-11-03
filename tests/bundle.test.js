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
});
