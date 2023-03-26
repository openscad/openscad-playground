# OpenSCAD Playground

[Open the Demo](https://ochafik.com/openscad2)

This is a WIP revamp of https://ochafik.com/openscad.

Licenses: see [LICENSES](./LICENSE).

## Features

- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6). Using a trick to force $preview=true.
- Syntax highlighting
- Ships with many standard SCAD libraries (can browse through them in the UI)
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)
- Responsive layout (but editing on iOS is still a pain, will address that soon). On small screens editor and viewer are stacked onto each other, while on larger screens they can be side-by-side

## Roadmap

- Drag and drop of files (SCAD, STL, etc) and Zip archives. For assets, auto insert the corresponding import.
- Proper PWA w/ File opening / association to *.scad files
- Setup [OPENSCADPATH](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Libraries#Setting_OPENSCADPATH) env var w/ Emscripten.
- Customizer support. Probably by adding --export-json or --export-format=customizer-json to OpenSCAD.
- Mobile (iOS) editing support: switch to https://www.npmjs.com/package/react-codemirror ?
- Proper Preview rendering: have OpenSCAD export the preview scene to a rich format (e.g. glTF, with some parts being translucent when prefixed w/ % modifier) and display it using https://modelviewer.dev/ maybe)

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

Deployment (edit "homepage" in `package.json` to match your deployment root!):

```bash
make public
npm build

rm -fR ../ochafik.github.io/openscad2 && cp -R dist ../ochafik.github.io/openscad2 
# Now commit and push changes, wait for site update and enjoy!
```
