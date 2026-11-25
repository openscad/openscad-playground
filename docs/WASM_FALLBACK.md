# WebAssembly and the JavaScript (wasm2js) fallback

The playground runs OpenSCAD as a WebAssembly module. On some devices
WebAssembly is disabled, and the playground used to fail opaquely there. It now
detects this at runtime and, if an optional pure-JavaScript build of OpenSCAD is
deployed, uses it instead.

## Overview

- Classic asm.js no longer exists in Emscripten (removed in 2.0). The modern
  equivalent is **wasm2js**, a Binaryen pass that translates the linked `.wasm`
  into plain JavaScript, selected at link time with `-sWASM=0`. The existing
  `openscad.wasm` cannot be converted in place; OpenSCAD has to be re-linked.
- The fallback is a separate artifact, `public/openscad.fallback.js` (~22 MB,
  several times slower than WASM). It is **not bundled**: it is only fetched
  (via `importScripts` in the worker) when WebAssembly is unavailable, and it is
  excluded from the service worker precache.
- If the file is absent the app builds and runs as before; on a device without
  WebAssembly a banner explains that rendering is unavailable.

| Cause of missing WASM | Does the fallback help? |
|---|---|
| iOS/macOS Lockdown Mode (no WASM, no JIT) | Runs, but interpreted only: very slow |
| Strict CSP without `wasm-unsafe-eval` | Yes: wasm2js output is plain JS |
| Enterprise / hardened browsers | Yes |

## How it works

| Piece | File |
|---|---|
| Capability probe (`detectWasmSupport`, `probeRenderEngine`) | `src/runner/wasm-support.ts` |
| Engine selection inside the worker | `src/runner/openscad-loader.ts` |
| Shared worker logic (invocation, library mounting) | `src/runner/openscad-worker-core.ts` |
| Engine probe, `data-engine` attribute, error banner when no engine | `src/components/WasmStatusBanner.tsx` |

The probed engine is exposed as `data-engine="wasm|wasm2js|none"` on `<html>`.
Running on the JavaScript fallback shows no banner (only a `console.info` line);
with no fallback deployed (`none`) a dismissible error banner explains why
rendering is unavailable.

`?wasmEngine=wasm2js` (or `wasm`) in the page URL forces an engine, to test the
fallback on a WASM-capable browser. Without `openscad.fallback.js`,
`?wasmEngine=wasm2js` exercises the "rendering unavailable" path.

Under wasm2js, BrowserFS's `EmscriptenFS` bridge does not work, so library
archives are unpacked directly into the Emscripten filesystem.

## Building `public/openscad.fallback.js`

Requires Docker (or a Docker-compatible CLI), git and ~6 GB of disk. The build
takes a long time (CGAL, Boost, ...).

```bash
npm run build:wasm-fallback     # runs scripts/build-wasm-fallback.sh
npm run build                   # copies public/ into dist/
```

In CI, `.github/workflows/build-fallback.yml` builds it on demand (workflow
dispatch), on `v*` tags and when the recipe changes, caching the patched
`wasm2js` binary, the final module and a ccache, and runs
`scripts/check-wasm-fallback.mjs` (size, syntax, nesting depth, Node render).
Cold: ~24 min on a standard `ubuntu-24.04` runner; cache hit: under 1 min.
`ONLY=binaryen`, `JOBS`, `CCACHE_DIR` and an empty `PLATFORM` are the script's CI hooks.

The script:

1. clones upstream [WebAssembly/binaryen](https://github.com/WebAssembly/binaryen)
   at a pinned commit, applies
   `scripts/patches/binaryen-wasm2js-flatten-deep-control-flow.patch` and builds
   a native Linux `wasm2js`;
2. clones `openscad/openscad` at a pinned commit (`OPENSCAD_REF`);
3. rewrites OpenSCAD's Emscripten link flags for a wasm2js target and builds it
   in the `openscad/wasm-base-release` image with the patched `wasm2js` mounted
   over the emsdk's.

Environment overrides: `BINARYEN_REF`, `OPENSCAD_REF`, `BASE_IMAGE`,
`PATCHED_WASM2JS` (use an existing Linux `wasm2js`), `DOCKER`.

Link flags that differ from the normal web build:

| Flag | Why |
|---|---|
| `-sWASM=0` | emit wasm2js JavaScript |
| `-sSINGLE_FILE=1` | one self-contained `.js` |
| `-sWASM_BIGINT=0` | rejected by wasm2js |
| `-sEXPORT_ES6=0`, `-sMODULARIZE=1`, `-sEXPORT_NAME=OpenSCAD` | classic script defining a global `OpenSCAD` factory, loadable with `importScripts` |
| `-sMAXIMUM_MEMORY=2GB` | wasm2js cannot address more |
| `-sSUPPORT_LONGJMP=emscripten`, `-fexceptions` | JS-based longjmp/exceptions (no `WebAssembly.Tag`) |

## The Binaryen patch

Upstream wasm2js emits one JS nesting level per wasm `block` / `if`. LLVM
produces very deep towers of these for large functions, so the OpenSCAD output
reaches a nesting depth of ~1514. JS engines parse nested statements
recursively and overflow their stack (`RangeError: Maximum call stack size
exceeded`) at parse time, in both Node and browser workers, before any code
runs.

The patch makes wasm2js track its JS nesting depth and, past a threshold (40),
lower the remaining chain of nested blocks / then-only ifs into a single
`while (1) { switch (state) { ... } }` dispatch loop. Maximum nesting drops
from ~1514 to ~70, and code under the threshold is emitted unchanged.
The patch also adds Binaryen's regression test `test/wasm2js/deep-control-flow.wast`
with its generated expected outputs (`*.2asm.js`, `*.2asm.js.opt`); `check.py
wasm2js` passes and no pre-existing expected output changes.

The patch is vendored (`scripts/patches/`) and applies to upstream Binaryen
`58e27a24d`. It has not been submitted upstream yet; drafts of the upstream
issue and PR (`ISSUE_DRAFT.md`, `PR_DRAFT.md`) live in the author's Binaryen
checkout, branch `wasm2js-flatten-deep-control-flow` of `ochafik/binaryen`.
Once an equivalent change is released upstream, the patch and the pin can go.

## Caveats

- ~22 MB of JavaScript, fetched only on demand; several times slower than WASM
  with a JIT, and far slower without one (Lockdown Mode).
- The fallback must be rebuilt and redeployed when the OpenSCAD WASM build is
  bumped; `OPENSCAD_REF` is pinned independently of `libs-config.json`.
