# OpenSCAD Playground

[Open the Demo](https://ochafik.com/openscad2)

<a href="https://ochafik.com/openscad2" target="_blank">
<img width="694" alt="image" src="https://github.com/user-attachments/assets/58305f27-7e95-4c56-9cd7-0d766e0a21ae" />
</a>

This is a limited port of [OpenSCAD](https://openscad.org) to WebAssembly, using at its core a headless WASM build of OpenSCAD ([done by @DSchroer](https://github.com/DSchroer/openscad-wasm)), wrapped in a UI made of pretty [PrimeReact](https://github.com/primefaces/primereact) components, a [React Monaco editor](https://github.com/react-monaco-editor/react-monaco-editor) (VS Codesque power!), and an interactive [model-viewer](https://modelviewer.dev/) renderer.

It defaults to the [Manifold backend](https://github.com/openscad/openscad/pull/4533) so it's **super** fast.

Enjoy!

Licenses: see [LICENSES](./LICENSE).

## Features

- Automatic preview on edit (F5), and full rendering on Ctrl+Enter (or F6). Using a trick to force $preview=true.
- [Customizer](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Customizer) support
- Syntax highlighting
- Ships with many standard SCAD libraries (can browse through them in the UI)
- Autocomplete of imports
- Autocomplete of symbols / function calls (pseudo-parses file and its transitive imports)
- Responsive layout. On small screens editor and viewer are stacked onto each other, while on larger screens they can be side-by-side
- Installable as a PWA (then persists edits in localStorage instead of the hash fragment). On iOS just open the sharing panel and tap "Add to Home Screen". *Should not* require any internet connectivity once cached.

## Roadmap

- [x] Add tests!
- [x] Persist camera state
- [x] Support 2D somehow? (e.g. add option in OpenSCAD to output 2D geometry as non-closed polysets, or to auto-extrude by some height)
- [x] Proper Preview rendering: have OpenSCAD export the preview scene to a rich format (e.g. glTF, with some parts being translucent when prefixed w/ % modifier) and display it using https://modelviewer.dev/ maybe)
- ~~Rebuild w/ (and sync) ochafik@'s filtered kernel (https://github.com/openscad/openscad/pull/4160) to fix(ish) 2D operations~~
- [x] Bundle more examples (ask users to contribute)
- Animation rendering (And other formats than STL)
- [x] Compress URL fragment
- [x] Mobile (iOS) editing support: switch to https://www.npmjs.com/package/react-codemirror ?
- [x] Replace Makefile w/ something that reads the libs metadata
- [ ] Merge modifiers rendering code to openscad
- Model /home fs in shared state. have two clear paths: /libraries for builtins, and /home for user data. State pointing to /libraries paths needs not store the data except if there's overrides (flagged as modifications in the file picker)
- Drag and drop of files (SCAD, STL, etc) and Zip archives. For assets, auto insert the corresponding import.
- Fuller PWA support w/ link Sharing, File opening / association to *.scad files... 
- Look into accessibility
- Setup [OPENSCADPATH](https://en.wikibooks.org/wiki/OpenSCAD_User_Manual/Libraries#Setting_OPENSCADPATH) env var w/ Emscripten to ensure examples that include assets / import local files will run fine.
- Every bundled library is fetched on demand (by a render that refers to it, or when a file of it is opened from the file explorer); the file explorer and the `use <` / `include <` completions list all of them from the build-time `libraries/index.json`. Non-`.scad` assets and directories with no `.scad` file are not in the index (not listed in the explorer).
- Preparse builtin libraries definitions at compile time, ship the JSON.

## Building

The project uses a **webpack-based build system** that reads library metadata from `libs-config.json` to automatically download, clone, and package OpenSCAD libraries and dependencies. This replaces the previous Makefile approach with a more standard, maintainable solution.

Prerequisites:
*   wget or curl
*   Node.js (>=22)
*   npm
*   git
*   zip
*   Docker able to run amd64 containers (only needed if building WASM from source). If running on a different platform (including Silicon Mac), you can add support for amd64 images through QEMU with:

  ```bash
  docker run --privileged --rm tonistiigi/binfmt --install all
  ```

Local dev:

```bash
npm run build:libs  # Download WASM and build all OpenSCAD libraries
npm install
npm run start
# http://localhost:4000/
```

Local prod (test both the different inlining and serving under a prefix):

```bash
npm run build:libs  # Download WASM and build all OpenSCAD libraries
npm install
npm run start:production
# http://localhost:3000/dist/
```

Deployment (edit "homepage" in `package.json` to match your deployment root!):

```bash
npm run build:all  # Build libraries and compile the application
npm install

rm -fR ../ochafik.github.io/openscad2 && cp -R dist ../ochafik.github.io/openscad2 
# Now commit and push changes, wait for site update and enjoy!
```

Libraries and fonts are pinned to exact commits in `libs-config.json` (`commit` fields), so builds are reproducible. To bump them to the current branch heads, run `npm run libs:update`, review the diff, and commit (`npm run libs:check` reports out-of-date pins without writing). Libraries with a stable release process (BOSL2, NopSCADlib) set a `tag` field instead: `libs:update` then pins the commit of that tag, and you bump the tag by hand.

## Embedding

The playground can be embedded in any page with an iframe. When it runs inside a frame it defaults to **embed mode**: no tab bar or footer, just the 3D viewer filling the frame and one discreet toolbar in the top-right corner with: the customizer toggle (only when the model has customizer parameters), **Copy source** (the active file's OpenSCAD code, with an aria-live confirmation), fullscreen (if the host/iframe allows it) and an exit to the full UI. The customizer opens as a translucent side sheet docked on the right (about 360px, 85% of the width on small screens): it overlays the viewer without resizing it, stays non-modal on desktop (the model remains interactive), and closes with the toolbar toggle, Escape, or a tap outside on small screens. The exit switches to the full UI in place in a top-level window and opens the same state in a new tab (`?embed=0`) when framed.

A deployment that also serves the MCP endpoint (see [docs/MCP_APP_DEPLOYMENT.md](docs/MCP_APP_DEPLOYMENT.md)) can set the build-time variable `OPENSCAD_MCP_URL` (e.g. `/mcp` or an absolute URL): the settings menu then shows a **Configure MCP** entry opening that page in a new tab. It is hidden when unset, and when framed (embeds and the MCP app itself).

In the full UI, the settings menu has an **Embed mode** item (session-level: not saved in links or persisted) and **Copy embed code**, which copies an `<iframe>` snippet for the current model.

```html
<iframe
  src="https://ochafik.com/openscad2/?embed=1#src=width%20%3D%2030%3B%20%2F%2F%20%5B10%3A100%5D%0Acube(width)%3B"
  style="width: 100%; height: 480px; border: 0"
  allow="fullscreen; clipboard-write"
  loading="lazy"></iframe>
```

| URL state | Effect |
|---|---|
| `?embed=1` (or `?embed`), `#embed=1&...` | Force embed mode, even in a top-level window. |
| `?embed=0`, `#embed=0&...` | Force the full UI, even inside an iframe. |
| _(none)_ | Embed when framed (or running as an MCP app), full UI otherwise. |
| `#src=<urlencoded code>`, `#url=<urlencoded url>`, `#path=<library path>` | Deep-link the model to show. |

Prefer the query parameter (`?embed=`): the app rewrites the fragment as the model changes, which drops a `#embed=` prefix on reload. Any host serving the app must leave framing open: do not send `X-Frame-Options` or a restrictive `Content-Security-Policy: frame-ancestors`.

## Build your own WASM binary

The build system fetches a prebuilt OpenSCAD web WASM binary, but you can build your own in a couple of minutes:

- **Optional**: use your own openscad fork / branch:

  ```bash
  rm -fR libs/openscad
  ln -s $PWD/../absolute/path/to/your/openscad libs/openscad
  
  # If you had a native build directory, delete it.
  rm -fR libs/openscad/build
  ```

- Build WASM binary (add `WASM_BUILD=Debug` argument if you'd like to debug any cryptic crashes):

  ```bash
  npm run build:libs:wasm
  ```

- Then continue the build:

  ```bash
  npm run build:libs
  npm run start
  ```

## WebAssembly fallback

On devices where WebAssembly is disabled (Lockdown Mode, strict CSP, locked-down
browsers), the playground can fall back to an optional pure-JavaScript (wasm2js)
build of OpenSCAD, loaded only when needed. Build it with Docker:

```bash
npm run build:wasm-fallback   # writes public/openscad.fallback.js
npm run build
```

Without that file the app works as usual and shows a banner on such devices.
See [docs/WASM_FALLBACK.md](./docs/WASM_FALLBACK.md) for details, including the
patched Binaryen the build relies on.

## Adding OpenSCAD libraries

The build system uses a webpack plugin that reads from `libs-config.json` to manage all library dependencies. You'll need to update 2 files (search for BOSL2 for an example):

- [libs-config.json](./libs-config.json): the single list of libraries: repository URL, branch, files to include/exclude in the zip archive, and what the UI shows (`description`, `docs` links, `symlinks` that make top-level files such as `tray.scad` includable directly). Nothing is fetched up front: the zip is only fetched by a render whose sources refer to the library (by its name or one of its `symlinks`), or when a file of it is opened from the file explorer. The explorer and the `use <` / `include <` completions list every library's `.scad` files from `libraries/index.json` (written by the build: each library's zip size and its files), without the zip. Libraries that include other libraries are covered by `archiveDependencies` in [src/fs/archive-deps.ts](./src/fs/archive-deps.ts) (a missing one is also recovered by re-running the render with it mounted).

- [LICENSE.md](./LICENSE.md): most libraries require proper disclosure of their usage and of their license. If a license is unique, paste it in full, otherwise, link to one of the standard ones already there.

### Library Configuration Format

In `libs-config.json`, add an entry like this:

```json
{
  "name": "LibraryName",
  "repo": "https://github.com/user/repo.git", 
  "branch": "main",
  "zipIncludes": ["*.scad", "LICENSE", "examples"],
  "zipExcludes": ["**/tests/**"],
  "workingDir": ".",
  "tag": "v1.2.3",
  "commit": "<full SHA, set by `npm run libs:update`>"
}
```

`tag` (optional) pins the library to a release; `commit` is the exact commit that gets built.

Available build commands:
- `npm run build:libs` - Build all libraries
- `npm run build:libs:clean` - Clean all build artifacts
- `npm run build:libs:wasm` - Download/build just the WASM binary
- `npm run build:libs:fonts` - Download/build just the fonts

To retire a library, delete its entry from `libs-config.json` and add its name to `removedLibraries` there (name -> hint): scripts that still refer to it get OpenSCAD's usual missing-file warning plus that hint in the logs.

Send us a PR, then once it's merged request an update to the hosted https://ochafik.com/openscad2 demo.
