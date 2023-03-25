# OpenSCAD Playground

WIP revamp of https://github.com/ochafik/openscad-wasm/tree/editor-ochafik.com / https://ochafik.com/openscad.

Licenses: see [LICENSES](./LICENSES).

## Features

- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6)
- Syntax highlighting
- Ships with many standard SCAD libraries
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)
- 

## TODO

- Investigate https://www.npmjs.com/package/react-codemirror for mobile editor (Monaco on iOS is terribly broken)
- Link to https://www.npmjs.com/package/monaco-languages MIT JS source for language 
## Build

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
