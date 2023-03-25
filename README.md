# OpenSCAD Playground

[Open the Demo](https://ochafik.com/openscad2)

This is a WIP revamp of https://ochafik.com/openscad.

Licenses: see [LICENSES](./LICENSE).

## Features & Roadmap

Should work:

- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6). Currently using a trick to force $preview=true, it's not perfect.
- Syntax highlighting
- Ships with many standard SCAD libraries
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)

Planned:

- Customizer support. Probably by adding --export-json or --export-format=customizer-json to OpenSCAD.
- Mobile (iOS) editing support: switch to https://www.npmjs.com/package/react-codemirror ?
- Preview rendering: have OpenSCAD export the preview scene to a rich format (e.g. glTF, with some parts being translucent when prefixed w/ % modifier) and display it using https://modelviewer.dev/ maybe)

Prerequisites:
*   wget
*   GNU make
*   npm
*   deno

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
