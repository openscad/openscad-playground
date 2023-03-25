# OpenSCAD Playground

WIP revamp of https://github.com/ochafik/openscad-wasm/tree/editor-ochafik.com / https://ochafik.com/openscad.

Licenses: see [LICENSES](./LICENSES).

## Build

Prerequisites:
*   wget
*   GNU make
*   npm
*   deno

```bash
make clean

# When doing local development, ensure the import.meta.url is replaced to localhost:
# (otherwise will get cryptic `RangeError: WebAssembly.Table.get(): invalid index 999948 into function table`)
dev=1 make public
npm start

# When building a release
make
```