# OpenSCAD Playground – Portfolio Edition

This fork of ochafik’s original OpenSCAD Playground keeps the proven WASM renderer and Monaco-driven editing environment, but layers on a gallery-first experience aimed at showcasing curated models. Highlights:

- **Gallery landing page** – Visiting `http://localhost:4000/` opens a full-screen model gallery. Selecting a card navigates directly to the viewer with the model loaded.
- **In-app gallery dialog** – Inside the playground UI, the “Gallery” button opens the same browsing experience as a dialog for quick project switching.
- **Direct linking** – URLs such as `?model=3D%20Rack%20SCAD` load the viewer with that model and skip the landing page. `?editor=off` (or the matching `.env` flag) keeps the editor hidden for kiosk deployments.
- **Runtime configuration** – Point-and-click options plus `.env`, query-string, or `window.OPENSCAD_PLAYGROUND_CONFIG` flags let you control editor visibility and gallery behaviour without code changes.

The sections below retain the upstream documentation for reference and build instructions, with additional notes where behaviour differs.

---

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
- **Static 3D model support** - Display pre-rendered GLTF, GLB, STL, and other 3D formats alongside OpenSCAD projects (see [STATIC_MODELS.md](./STATIC_MODELS.md))
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
- Detect which bundled libraries are included / used in the sources and only download these rather than wait for all of the zips. Means the file explorer would need to be more lazy or have some prebuilt hierarchy.
- Preparse builtin libraries definitions at compile time, ship the JSON.

## Building

The project uses a **webpack-based build system** that reads library metadata from `libs-config.json` to automatically download, clone, and package OpenSCAD libraries and dependencies. This replaces the previous Makefile approach with a more standard, maintainable solution.

Prerequisites:
*   wget or curl
*   Node.js (>=18.12.0)
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

## Adding OpenSCAD libraries

The build system uses a webpack plugin that reads from `libs-config.json` to manage all library dependencies. You'll need to update 3 files (search for BOSL2 for an example):

- [libs-config.json](./libs-config.json): to add the library's metadata including repository URL, branch, and files to include/exclude in the zip archive

- [src/fs/zip-archives.ts](./src/fs/zip-archives.ts): to use the `.zip` archive in the UI (both for file explorer and automatic imports mounting)

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
  "workingDir": "."
}
```

To bundle a directory that lives inside this repository (for example the curated `Models` gallery), omit `repo`/`branch` and use the `localPath` field instead:

```json
{
  "name": "Models",
  "localPath": "Models",
  "zipExcludes": ["__MACOSX/*", "*.DS_Store", "*/.DS_Store"]
}
```

Available build commands:
- `npm run build:libs` - Build all libraries
- `npm run build:libs:clean` - Clean all build artifacts
- `npm run build:libs:wasm` - Download/build just the WASM binary
- `npm run build:libs:fonts` - Download/build just the fonts

Send us a PR, then once it's merged request an update to the hosted https://ochafik.com/openscad2 demo.

## Adding Static 3D Models

In addition to OpenSCAD projects, the gallery can showcase pre-rendered static 3D models (GLTF, GLB, STL, PLY, OBJ, etc.). These models are displayed using the same Google [Model Viewer](https://modelviewer.dev/) that renders OpenSCAD outputs.

**Quick Start**: See [QUICK_START.md](./QUICK_START.md) for a step-by-step guide to adding static models.

**Detailed Documentation**: See [STATIC_MODELS.md](./STATIC_MODELS.md) for technical details and architecture.

### Creating a Static Model Project

1. Create a new directory in the `Models` folder with your project name
2. Add your 3D model file (e.g., `model.gltf`, `model.glb`, etc.)
3. Create a `project.json` file with the following structure:

```json
{
  "title": "My Static Model",
  "entry": "model.gltf",
  "type": "static",
  "description": "A showcase of a pre-rendered 3D model",
  "category": "Showcase",
  "tags": ["static", "model"],
  "author": "Your Name"
}
```

4. Optionally, add a thumbnail image (`thumbnail.png`, `thumbnail.jpg`, etc.) for the gallery preview

### Supported Model Formats

The viewer supports various 3D model formats through the browser's native capabilities:
- **GLTF/GLB** (`.gltf`, `.glb`) - Recommended format with best features
- **STL** (`.stl`) - Common 3D printing format
- **OBJ** (`.obj`) - Wavefront object format
- **PLY** (`.ply`) - Polygon file format
- **OFF** (`.off`) - Object file format

**Example:** See `Models/Atmospheric Sampler/` for a complete static model project example.

### Benefits of Static Models

- **Faster loading** - No need to render or compile OpenSCAD code
- **Complex models** - Display models that may be too complex to render in real-time
- **External sources** - Showcase models created in other 3D software (Blender, CAD tools, etc.)
- **Interactive viewing** - Same AR and camera controls as OpenSCAD renders

## Runtime configuration

You can control the default UI via environment variables stored in a local `.env` file (loaded by the webpack config) before build or `npm start`.

| Variable | Default | Description |
| --- | --- | --- |
| `PLAYGROUND_EDITOR_ENABLED` | `true` | Set to `false`, `0`, `off`, or `no` to disable the Monaco editor entirely (viewer + customizer only). |
| `PLAYGROUND_EDITOR_TOGGLE` | `true` | Set to `false` to hide the editor toggle button while keeping the editor enabled. |

Example `.env`:

```
# Start in kiosk mode
PLAYGROUND_EDITOR_ENABLED=false

# Optional: keep the toggle hidden even when the editor runs
PLAYGROUND_EDITOR_TOGGLE=false
```

Query-string parameters still override everything at runtime: `?editor=off` and `?editorToggle=off` mirror the variables above, while `window.OPENSCAD_PLAYGROUND_CONFIG` remains available for custom embeds.
