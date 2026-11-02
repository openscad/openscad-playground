// Models exercising the newer bundled libraries via `use <...>` / `include <...>`,
// shared by the WebAssembly (e2e.test.js) and wasm2js (wasm-fallback.test.js) suites.
module.exports = [
  ['gridfinity-rebuilt-openscad', `include <gridfinity-rebuilt-openscad/gridfinity-rebuilt-baseplate.scad>`],
  ['Round-Anything', `include <Round-Anything/polyround.scad>
radiiPoints=[[-4,0,1],[5,3,1.5],[0,7,0.1],[8,7,10],[20,20,0.8],[10,0,10]];
linear_extrude(2) polygon(polyRound(radiiPoints,30));`],
  ['threads-scad', `use <threads-scad/threads.scad>
ScrewThread(10, 20, pitch=1.5);`],
  ['KeyV2 + scad-utils', `include <KeyV2/includes.scad>
use <scad-utils/morphology.scad>
dcs_row(3) key();
translate([30,0,0]) linear_extrude(2) rounding(r=0.3) polygon([[0,0],[1,0],[1.5,1],[2.5,1],[2,-1],[0,-1]]);`],
  ['dotSCAD', `use <dotSCAD/src/hexagons.scad>
linear_extrude(2) hexagons(5, 1, 3);`],
];
