// Renders one small model per bundled library with the WebAssembly engine and/or
// the wasm2js fallback in headless Chrome (serves dist/, run `npm run build` first)
// and reports warnings/errors. Used to vet library updates (`npm run libs:update`).
//
//   node scripts/test-libs-render.mjs [--engines=wasm,wasm2js] [--only=BOSL2,MCAD]
//        [--examples] [--out=report.json] [--dist=dir] [--timeout=900000]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [, k, v = 'true'] = a.match(/^--([^=]*)(?:=([\s\S]*))?$/);
  return [k, v];
}));
const engines = (args.engines ?? 'wasm,wasm2js').split(',');
const only = args.only?.split(',');
const timeout = Number(args.timeout ?? 900000);
const dist = path.resolve(args.dist ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist'));

const cases = {
  openscad: 'include <openscad/examples/Basics/hull.scad>',
  BOSL2: 'include <BOSL2/std.scad>\ninclude <BOSL2/screws.scad>\ncuboid([30,20,10], rounding=2, anchor=BOTTOM)\n' +
    '  attach(TOP) screw("M4", length=10, anchor=BOTTOM);',
  'BOSL2-gears-sweep': 'include <BOSL2/std.scad>\ninclude <BOSL2/gears.scad>\ninclude <BOSL2/rounding.scad>\ninclude <BOSL2/beziers.scad>\n' +
    'spur_gear(mod=2, teeth=16, thickness=5);\n' +
    'right(40) offset_sweep(rect(20), height=8, top=os_circle(r=2), bottom=os_teardrop(r=2));\n' +
    'fwd(40) path_sweep(circle(r=2,$fn=16), bezpath_curve([[0,0,0],[10,0,0],[10,10,5],[20,10,10]]));',
  BOSL: 'use <BOSL/constants.scad>\nuse <BOSL/transforms.scad>\nuse <BOSL/shapes.scad>\ncuboid([30,20,10], fillet=2);\nup(10) xcyl(l=20, r=3);',
  NopSCADlib: 'include <NopSCADlib/core.scad>\ninclude <NopSCADlib/vitamins/ball_bearings.scad>\nball_bearing(BB608);',
  funcutils: 'include <funcutils/func.scad>\nr = filter([1,2,3,4,5], function(x) x > 2);\necho(r);\ncube(len(r));',
  YAPP_Box: 'include <YAPP_Box/examples/YAPP_Demo_RealBox_v31.scad>',
  MCAD: 'use <MCAD/boxes.scad>\nroundedCube([20,20,10], 3, true, true);',
  boltsparts: 'use <boltsparts/washer/washer.scad>\nwasher1(10,20,2);',
  'OpenSCAD-Snippet': 'include <OpenSCAD-Snippet/Basic Example/Raccordo.scad>',
  Stemfie_OpenSCAD: 'use <Stemfie_OpenSCAD/stemfie.scad>\nbeam_block([4,1,1]);',
  pathbuilder: 'include <pathbuilder/pathbuilder.scad>\nlinear_extrude(2) svgShape("m 0 0chamfer8h20fillet2v20fillet10h20v-10fillet2l35 20fillet2l-35 20fillet2v-10h-40fillet30", $fn=32);',
  openscad_attachable_text3d: 'include <openscad_attachable_text3d/attachable_text3d.scad>\nattachable_text3d("Hi", size=8, h=2);',
  brailleSCAD: 'include <BOSL2/std.scad>\ninclude <brailleSCAD/en-us-g2.scad>\ninclude <brailleSCAD/braille.scad>\nbraille("abc");',
  'smooth-prim': 'use <smooth-prim/smooth_prim.scad>\nSmoothCube([20,20,10], 2);',
  'plot-function': 'use <plot-function/plot_function.scad>\nDemoFunc = function(x, y) 2*(1.5 + cos(x*x + y*y/4));\nPlotFunction(DemoFunc, [-40, 2, 40], [-40, 2, 40]);',
  closepoints: 'use <closepoints/closepoints.scad>\nClosePoints([[ [0,0,0],[10,0,0],[10,10,0],[0,10,0] ],[ [0,0,10],[10,0,10],[10,10,10],[0,10,10] ]]);',
  'UB.scad': 'include <UB.scad/libraries/ub.scad>\ncube(5);',
  'openscad-tray': 'include <openscad-tray/tray.scad>\ntray([100, 60, 30], n_columns=3, n_rows=2);',
  lasercut: 'include <lasercut/lasercut.scad>\nlasercutout(thickness=3, points=[[0,0],[40,0],[40,30],[0,30]]);',
  'gridfinity-rebuilt-openscad': 'include <gridfinity-rebuilt-openscad/gridfinity-rebuilt-bins.scad>',
  'Round-Anything': 'include <Round-Anything/polyround.scad>\nradiiPoints=[[-4,0,1],[5,3,1.5],[0,7,0.1],[8,7,10],[20,20,0.8],[10,0,10]];\nlinear_extrude(2) polygon(polyRound(radiiPoints,30));',
  'threads-scad': 'use <threads-scad/threads.scad>\nScrewThread(10, 20, pitch=1.5);',
  dotSCAD: 'use <dotSCAD/src/hexagons.scad>\nuse <dotSCAD/src/arc.scad>\nlinear_extrude(2) hexagons(5, 1, 3);\ntranslate([40,0,0]) linear_extrude(2) arc(radius=10, angle=[0,120], width=2);',
  'scad-utils': 'use <scad-utils/morphology.scad>\nuse <scad-utils/transformations.scad>\n$fn=32;\nlinear_extrude(2) rounding(r=0.3) polygon([[0,0],[1,0],[1.5,1],[2.5,1],[2,-1],[0,-1]]);\nmultmatrix(translation([5,0,0]) * rotation([0,0,30])) cube(1);',
  KeyV2: 'include <KeyV2/includes.scad>\ndcs_row(3) key();',
};

if (args.examples) { // render every bundled OpenSCAD example instead (needs libs/openscad from `npm run build:libs`)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../libs/openscad/examples');
  for (const f of fs.readdirSync(root, {recursive: true}).filter(f => f.endsWith('.scad') && !f.includes('tests/')).sort()) {
    cases[`examples/${f}`] = `include <openscad/examples/${f}>`;
    delete cases.openscad;
  }
  for (const k of Object.keys(cases)) if (!k.startsWith('examples/')) delete cases[k];
}

const types = {'.js': 'text/javascript', '.html': 'text/html', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css'};
const harness = `<!doctype html><meta charset=utf-8><script>
window.run = (engine, src) => new Promise((resolve, reject) => {
  const w = new Worker('./openscad-worker.js');
  w.onmessage = e => {
    if ('result' in e.data) {
      const r = e.data.result; w.terminate();
      const out = (r.outputs || [])[0];
      resolve({engine: r.engine, error: r.error, exitCode: r.exitCode, elapsedMillis: r.elapsedMillis, bytes: out ? out[1].byteLength : 0,
        log: (r.mergedOutputs || []).map(o => o.stdout ?? o.stderr ?? o.error ?? '')});
    }
  };
  w.onerror = e => reject(new Error('worker error: ' + e.message));
  w.postMessage({mountArchives: true, inputs: [{path: '/input.scad', content: src}],
    args: ['/input.scad', '-o', 'out.off', '--backend=manifold', '--export-format=off'],
    outputPaths: ['out.off'], forceEngine: engine});
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

const interesting = /WARNING|\bERROR\b|Ignoring unknown|Can't open|not found|Unable to|deprecat|syntax/i;
const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
const results = [];
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/__harness.html`);
  for (const [name, src] of Object.entries(cases)) {
    if (only && !only.includes(name)) continue;
    for (const engine of engines) {
      let r;
      try {
        r = await Promise.race([
          page.evaluate((e, s) => window.run(e, s), engine, src),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout)),
        ]);
      } catch (e) { r = {error: String(e), log: []}; }
      const lines = (r.log ?? []).map(s => s.trim()).filter(s => interesting.test(s));
      const status = r.error || r.exitCode ? 'FAIL' : !r.bytes ? 'NO OUTPUT' : lines.length ? 'WARN' : 'OK';
      console.log(`${name.padEnd(28)} ${engine.padEnd(8)} ${status.padEnd(10)} ${String(r.elapsedMillis ?? '').padStart(7)}ms ${r.bytes ?? 0}B`);
      for (const l of lines.slice(0, 5)) console.log('    ' + l.slice(0, 220));
      results.push({name, engine, status, ms: r.elapsedMillis, bytes: r.bytes, error: r.error, exitCode: r.exitCode, warnings: lines.slice(0, 20)});
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (args.out) fs.writeFileSync(args.out, JSON.stringify(results, null, 2));
