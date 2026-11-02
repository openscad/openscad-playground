// (3MF is produced by the app in JS from OFF, so it is not an OpenSCAD output.)
// Renders a corpus of models with both OpenSCAD engines (WebAssembly and the
// wasm2js fallback, forced per invocation) in headless Chrome and compares the
// exported files and logs. Serves dist/ (run `npm run build` first). See
// docs/WASM_FALLBACK.md.
//
//   node scripts/compare-wasm-engines.mjs [--only=name,name] [--out=dir]
//        [--timeout=900000] [--tol=1e-5]
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [, k, v = 'true'] = a.match(/^--([^=]*)(?:=([\s\S]*))?$/);
  return [k, v];
}));
const timeout = Number(args.timeout ?? 900000);
const tol = Number(args.tol ?? 1e-5);
const only = args.only?.split(',');
const outDir = path.resolve(args.out ?? 'wasm-engine-compare');
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
fs.mkdirSync(outDir, {recursive: true});

const THREE_D = ['binstl', 'asciistl', 'off'];
const TWO_D = ['svg', 'dxf'];
const corpus = {
  cube: {src: 'cube(10);'},
  spheres_fn: {src: 'difference(){ sphere(10,$fn=32); translate([5,0,0]) sphere(8,$fn=48); }\n' +
    'translate([30,0,0]) union(){ sphere(10,$fn=96); translate([8,3,0]) sphere(7,$fn=64); }'},
  sphere_cube_256: {src: 'difference(){ sphere(10,$fn=256); cube(12,center=true); }'},
  minkowski: {src: 'minkowski(){ cube([10,10,3],center=true); sphere(2,$fn=24); }'},
  hull: {src: 'hull(){ translate([0,0,0]) sphere(5,$fn=40); translate([20,5,3]) cylinder(r=3,h=9,$fn=33); }'},
  text_extrude: {src: 'linear_extrude(3) text("Hello, wasm2js!", size=8);\n' +
    'translate([0,-20,0]) rotate_extrude($fn=60) translate([10,0]) text("R", size=6);'},
  bosl2: {src: 'include <BOSL2/std.scad>\nprismoid(size1=[40,30], size2=[20,15], h=20, rounding=3);\n' +
    'translate([60,0,0]) cuboid([20,20,10], rounding=2, $fn=24);'},
  polyhedron: {src: 'polyhedron(points=[[0,0,0],[10,0,0],[10,7,0],[0,7,0],[0,0,5],[10,0,5],[10,7,5],[0,7,5]],' +
    'faces=[[0,1,2,3],[5,4,7,6],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]);'},
  random_trig: {src: 'r=rands(0,10,60,42);\nfor(i=[0:59]) translate([i*1.3*cos(i*7.3), i*1.3*sin(i*7.3), sin(i*13.1)*r[i]])' +
    ' rotate([i*3.7, i*11.9, i*5.3]) scale([1+0.1*sin(i), 1, 1+r[i]/20]) cube([1+r[i]/10, 1, 1], center=true);'},
  heavy: {src: 'difference(){ union(){ for(i=[0:11]) rotate([0,0,i*30]) translate([12,0,0]) sphere(8,$fn=160); }\n' +
    'for(i=[0:9]) rotate([i*18,i*20,0]) cylinder(r=3,h=60,center=true,$fn=96); }'},
  offset_2d: {src: 'offset(r=3,$fn=48) difference(){ square(30,center=true); circle(10,$fn=64); }\n' +
    'translate([50,0]) offset(delta=-2) union(){ square(20); translate([15,15]) circle(10,$fn=50); }', twoD: true},
  text_2d: {src: 'text("Fonts: 2D", size=10); translate([0,-15]) offset(0.5) text("offset", size=8);', twoD: true},
};

const types = {'.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css'};
const harness = `<!doctype html><meta charset=utf-8><script>
window.run = (engine, src, format, outFile) => new Promise((resolve, reject) => {
  const w = new Worker('./openscad-worker.js');
  const mergedOutputs = [];
  w.onmessage = e => {
    if ('result' in e.data) {
      const r = e.data.result; w.terminate();
      const out = (r.outputs || [])[0];
      let b64 = null;
      if (out) { let s = ''; const u = new Uint8Array(out[1]); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); b64 = btoa(s); }
      resolve({engine: r.engine, error: r.error, exitCode: r.exitCode, elapsedMillis: r.elapsedMillis, b64, log: (r.mergedOutputs || []).map(o => o.stdout ?? o.stderr ?? o.error ?? '')});
    }
  };
  w.onerror = e => reject(new Error('worker error: ' + e.message));
  w.postMessage({mountArchives: true, inputs: [{path: '/input.scad', content: src}],
    args: ['/input.scad', '-o', outFile, '--backend=manifold', '--export-format=' + format],
    outputPaths: [outFile], forceEngine: engine});
});</script>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__harness.html') { res.writeHead(200, {'Content-Type': 'text/html'}).end(harness); return; }
  const file = path.join(dist, p);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] ?? 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));

// --- parsing / comparison -------------------------------------------------
function parseBinStl(buf) {
  const n = buf.readUInt32LE(80);
  if (buf.length !== 84 + n * 50) return null;
  const tris = [];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12, t = [];
    for (let v = 0; v < 3; v++) t.push([0, 1, 2].map(k => buf.readFloatLE(o + v * 12 + k * 4)));
    tris.push(t);
  }
  return tris;
}
function parseAsciiStl(text) {
  const vs = [...text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m => [+m[1], +m[2], +m[3]]);
  const tris = [];
  for (let i = 0; i + 2 < vs.length; i += 3) tris.push(vs.slice(i, i + 3));
  return tris;
}
function parseOff(text) {
  const l = text.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const [nv, nf] = l[1].split(/\s+/).map(Number);
  const vs = l.slice(2, 2 + nv).map(s => s.split(/\s+/).map(Number));
  const tris = [];
  for (const s of l.slice(2 + nv, 2 + nv + nf)) {
    const idx = s.split(/\s+/).map(Number).slice(1, 1 + Number(s.split(/\s+/)[0]));
    if (idx.some(i => !vs[i])) return null; // malformed: face index outside the vertex list
    for (let i = 1; i + 1 < idx.length; i++) tris.push([vs[idx[0]], vs[idx[i]], vs[idx[i + 1]]]); // fan
  }
  return tris;
}
const cmpKey = (x, y) => x < y ? -1 : x > y ? 1 : 0;
// Rotates each triangle so its smallest vertex is first (keeps winding), then sorts the triangles.
function canon(tris, q) {
  const key = v => q ? v.map(x => Math.round(x / q)).join(',') : v.join(',');
  return tris.map(t => {
    let best = 0;
    for (let i = 1; i < 3; i++) if (key(t[i]) < key(t[best])) best = i;
    return [...t.slice(best), ...t.slice(0, best)];
  }).sort((a, b) => cmpKey(a.map(key).join('|'), b.map(key).join('|')));
}
function meshStats(tris) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let vol = 0;
  const uniq = new Set();
  for (const [a, b, c] of tris) {
    for (const v of [a, b, c]) { uniq.add(v.join(',')); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
    vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return {tris: tris.length, verts: uniq.size, vol, lo, hi};
}
function compareMeshes(a, b) {
  if (!a || !b) return {note: 'unparseable'};
  const sa = meshStats(a), sb = meshStats(b);
  const d = {stats: [sa, sb], volRelDelta: Math.abs(sa.vol - sb.vol) / (Math.abs(sa.vol) || 1),
    bboxMaxDelta: Math.max(...[0, 1, 2].flatMap(k => [Math.abs(sa.lo[k] - sb.lo[k]), Math.abs(sa.hi[k] - sb.hi[k])]))};
  const vkey = t => [...new Set(t.flat().map(v => v.join(',')))].sort();
  const va = vkey(a), vb = vkey(b);
  d.sameVertexSet = JSON.stringify(va) === JSON.stringify(vb);
  if (a.length !== b.length) return {...d, note: `triangle count ${a.length} vs ${b.length}${d.sameVertexSet ? ', same vertex set' : ''}`};
  const ea = canon(a), eb = canon(b);
  if (JSON.stringify(ea) === JSON.stringify(eb)) return {...d, maxDelta: 0, sameTrianglesReordered: true};
  if (d.sameVertexSet) return {...d, maxDelta: 0, retriangulated: true};
  const ca = canon(a, tol), cb = canon(b, tol);
  let max = 0;
  for (let i = 0; i < ca.length; i++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++)
    max = Math.max(max, Math.abs(ca[i][v][k] - cb[i][v][k]));
  return {...d, maxDelta: max};
}
const nums = s => s.match(/-?\d+\.?\d*(?:[eE][-+]?\d+)?/g)?.map(Number) ?? [];
function compareText(a, b) {
  const na = nums(a), nb = nums(b);
  if (na.length !== nb.length) return {note: `numeric token count ${na.length} vs ${nb.length}`};
  let max = 0;
  for (let i = 0; i < na.length; i++) max = Math.max(max, Math.abs(na[i] - nb[i]));
  return {maxDelta: max, tokens: na.length};
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);
// Log lines whose content must match. Cache byte counts and timings are expected to differ.
const normLog = log => log.filter(l => /Simple:|Vertices:|Facets:|Volumes:|Genus:|Status:|WARNING|ERROR|Top level object|Geometries in cache|Polyhedrons in cache|Convex:|Polygons:|Contours:|Outline/i.test(l));

function judge(row) {
  const [a, b] = [row.runs.wasm, row.runs.wasm2js];
  const format = row.format;
  if (!a.bytes || !b.bytes) {
    row.verdict = `no output (${a.bytes ? '' : 'wasm: ' + (a.error ?? a.exitCode)} ${b.bytes ? '' : 'wasm2js: ' + (b.error ?? b.exitCode)})`;
  } else if (a.bytes.equals(b.bytes)) row.verdict = 'identical';
  else {
    const parse = {binstl: x => parseBinStl(x), asciistl: x => parseAsciiStl(x.toString()), off: x => parseOff(x.toString())}[format];
    const c = parse ? compareMeshes(parse(a.bytes), parse(b.bytes)) : compareText(a.bytes.toString(), b.bytes.toString());
    row.detail = c;
    row.verdict = c.sameTrianglesReordered ? 'same triangles, different order'
      : c.retriangulated ? `same vertices, different triangulation (volume rel. delta ${c.volRelDelta.toExponential(1)})`
      : c.maxDelta !== undefined ? (c.maxDelta <= tol ? `tolerance-equal (max delta ${c.maxDelta.toExponential(2)})` : `DIFFERENT (max delta ${c.maxDelta.toExponential(2)})`)
      : `DIFFERENT (${c.note}${c.volRelDelta !== undefined ? `; volume rel. delta ${c.volRelDelta.toExponential(2)}, bbox delta ${c.bboxMaxDelta.toExponential(2)}` : ''})`;
  }
  row.logMatch = JSON.stringify(normLog(a.log)) === JSON.stringify(normLog(b.log));
  row.sha = [a.bytes && sha(a.bytes), b.bytes && sha(b.bytes)];
  console.log(`${row.model.padEnd(16)} ${format.padEnd(8)} ${row.verdict.padEnd(60)} wasm ${a.ms?.toFixed(0)}ms wasm2js ${b.ms?.toFixed(0)}ms log ${row.logMatch ? 'same' : 'DIFF'}`);
  if (!row.logMatch) console.log('   wasm   :', normLog(a.log).map(s => s.trim()).join(' | '), '\n   wasm2js:', normLog(b.log).map(s => s.trim()).join(' | '));
}

const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const results = [];
try {
  const page = await browser.newPage();
  page.on('console', m => { if (args.verbose) console.error('[page]', m.text().slice(0, 300)); });
  page.on('pageerror', e => console.error('[pageerror]', e));
  await page.goto(`http://localhost:${server.address().port}/__harness.html`);
  for (const [name, m] of Object.entries(corpus)) {
    if (only && !only.includes(name)) continue;
    for (const format of m.twoD ? TWO_D : THREE_D) {
      const row = {model: name, format, runs: {}};
      for (const engine of ['wasm', 'wasm2js']) {
        const ext = format === 'binstl' || format === 'asciistl' ? 'stl' : format;
        const t0 = Date.now();
        let r;
        try {
          r = await Promise.race([
            page.evaluate((e, s, f, o) => window.run(e, s, f, o), engine, m.src, format, `out.${ext}`),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout)),
          ]);
        } catch (e) { r = {error: String(e)}; }
        r.wallMs = Date.now() - t0;
        const bytes = r.b64 ? Buffer.from(r.b64, 'base64') : null;
        fs.writeFileSync(path.join(outDir, `${name}.${format}.${engine}.log`), (r.log ?? []).join('\n'));
        if (bytes) fs.writeFileSync(path.join(outDir, `${name}.${format}.${engine}.${ext}`), bytes);
        row.runs[engine] = {engine: r.engine, error: r.error, exitCode: r.exitCode, ms: r.elapsedMillis, wallMs: r.wallMs, bytes, log: r.log ?? []};
      }
      judge(row);
      results.push(row);
    }
  }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results.map(r => ({...r, runs: Object.fromEntries(Object.entries(r.runs).map(([k, v]) => [k, {...v, bytes: v.bytes?.length}]))})), null, 2));
