// Sanity checks for a freshly built public/openscad.fallback.js, cheap enough
// for CI (no browser, no webpack build):
//   1. file size is plausible;
//   2. it parses (`node --check`) — this is where excessive JS nesting blows up;
//   3. brace/paren/bracket nesting stays shallow (the wasm2js patch keeps it ~70;
//      upstream wasm2js reaches ~1500);
//   4. it loads in Node and renders cube(10) to a non-empty STL.
//
//   node scripts/check-wasm-fallback.mjs [path/to/openscad.fallback.js]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.resolve(process.argv[2] ?? path.join(root, 'public/openscad.fallback.js'));
const MIN_BYTES = 5e6;
const MAX_NESTING = 200;

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

const size = fs.statSync(file).size;
console.log(`size: ${(size / 1e6).toFixed(1)} MB`);
if (size < MIN_BYTES) fail(`${file} is smaller than ${MIN_BYTES} bytes`);

execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log('syntax: ok (node --check)');

// Nesting depth ignoring string/regex/comment contents, approximately: the
// generated code is machine-written, so a simple scanner is good enough.
const src = fs.readFileSync(file, 'utf8');
let depth = 0, max = 0, quote = '';
for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (quote) {
    if (c === '\\') i++;
    else if (c === quote) quote = '';
    continue;
  }
  if (c === '"' || c === "'" || c === '`') quote = c;
  else if (c === '{' || c === '(' || c === '[') { if (++depth > max) max = depth; }
  else if (c === '}' || c === ')' || c === ']') depth--;
}
console.log(`max bracket nesting: ${max} (final depth ${depth})`);
if (depth !== 0) fail(`unbalanced brackets (final depth ${depth})`);
if (max > MAX_NESTING) fail(`nesting ${max} > ${MAX_NESTING}: the Binaryen patch was probably not applied`);

// Smoke render.
// Evaluate as CommonJS regardless of the nearest package.json "type".
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const OpenSCAD = mod.exports;
const start = Date.now();
const out = [];
const instance = await OpenSCAD({
  noInitialRun: true,
  print: (t) => out.push(t),
  printErr: (t) => out.push(t),
});
instance.FS.writeFile('/in.scad', 'cube(10);');
const code = instance.callMain(['/in.scad', '-o', '/out.stl', '--backend=manifold']);
const stl = code === 0 ? instance.FS.readFile('/out.stl', { encoding: 'utf8' }) : '';
console.log(`render: exit ${code}, ${stl.length} bytes of STL, ${Date.now() - start} ms`);
if (code !== 0 || !stl.startsWith('solid') || (stl.match(/facet normal/g) ?? []).length !== 12) {
  console.error(out.join('\n'));
  fail('cube(10) did not render to a 12-facet STL');
}
console.log('OK');
