# OpenSCAD Playground

[Open the Demo](https://ochafik.com/openscad2)

This is wrapping the headless WASM build of OpenSCAD ([done by @DSchroer](https://github.com/DSchroer/openscad-wasm)) into a lots of pretty [PrimeReact](https://github.com/primefaces/primereact) components, slapping in a [React Monaco editor](https://github.com/react-monaco-editor/react-monaco-editor) (VS Codesque power!), a [React STL viewer](https://github.com/gabotechs/react-stl-viewer) and a few tricks (of course, it's using the [experimental Manifold support](https://github.com/openscad/openscad/pull/4533) we've added recently, to make it super fast).

Enjoy!

An [earlier iteration of this](https://ochafik.com/openscad) offered more control over the features that are enabled. This will come soon too.

Licenses: see [LICENSES](./LICENSE).

## Features

- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6). Using a trick to force $preview=true.
- Syntax highlighting
- Ships with many standard SCAD libraries (can browse through them in the UI)
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)
- Responsive layout (but editing on iOS is still a pain, will address that soon). On small screens editor and viewer are stacked onto each other, while on larger screens they can be side-by-side

## Roadmap

- Add tests!
- Persist camera state
- Support 2D somehow? (e.g. add option in OpenSCAD to output 2D geometry as non-closed polysets, or to auto-extrude by some height)
- Customizer support. Probably by adding --export-json or --export-format=customizer-json to OpenSCAD. And use React Hook Forms maybe? https://react-hook-form.com/
- Rebuild w/ (and sync) ochafik@'s filtered kernel (https://github.com/openscad/openscad/pull/4160) to fix(ish) 2D operations
- Replace Makefile w/ something that reads the libs metadata
- Proper Preview rendering: have OpenSCAD export the preview scene to a rich format (e.g. glTF, with some parts being translucent when prefixed w/ % modifier) and display it using https://modelviewer.dev/ maybe)
- Better names for downloads (matching source)
- Model /home fs in shared state. have two clear paths: /libraries for builtins, and /home for user data. State pointing to /libraries paths needs not store the data except if there's overrides (flagged as modifications in the file picker)
- Drag and drop of files (SCAD, STL, etc) and Zip archives. For assets, auto insert the corresponding import.
- Proper PWA w/ File opening / association to *.scad files
- Setup [OPENSCADPATH](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Libraries#Setting_OPENSCADPATH) env var w/ Emscripten to ensure examples that include assets / import local files will run fine.
- Bundle more examples (ask users to contribute)
- Animation rendering (And other formats than STL)
- Compress URL fragment
- Mobile (iOS) editing support: switch to https://www.npmjs.com/package/react-codemirror ?
- Detect which bundled libraries are included / used in the sources and only download these rather than wait for all of the zips. Means the file explorer would need to be more lazy or have some prebuilt hierarchy.
- Preparse builtin libraries definitions at compile time, ship the JSON.

## Building

Prerequisites:
*   wget
*   GNU make
*   npm

Local dev:

```bash
make public
npm start
# http://localhost:4000/
```

Local prod (test both the different inlining and serving under a prefix):

```bash
make public
npm run start:prod
# http://localhost:3000/dist/
```

Deployment (edit "homepage" in `package.json` to match your deployment root!):

```bash
make public
npm run build

rm -fR ../ochafik.github.io/openscad2 && cp -R dist ../ochafik.github.io/openscad2 
# Now commit and push changes, wait for site update and enjoy!
```
