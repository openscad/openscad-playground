# OpenSCAD MCP Server

An [MCP](https://modelcontextprotocol.io/) server that exposes an interactive OpenSCAD 3D viewer as an [MCP App](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/apps). It lets LLMs create, edit, and render OpenSCAD models through tool calls, while users see a live 3D preview in the host UI.

Built with the [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps) v2: the server exposes a single `create` tool that opens the viewer, and the viewer itself registers a set of app tools (source editing, state, camera, screenshots) with the host. The host routes those calls straight into the iframe, so the server is fully stateless — no command queue, no polling, no external storage.

## Quick Start

```bash
cd server
npm install

# Start the server (Streamable HTTP on port 3001)
npm start

# Or on a custom port
PORT=4000 npm start
```

The MCP endpoint is at `http://localhost:3001/mcp`.

## Transport Modes

The server supports two MCP transports:

### Streamable HTTP (default)

```bash
cd server
npm start
# or: npm run start:http
```

Listens on `http://localhost:<PORT>/mcp` (default port: 3001). Use this when connecting from MCP hosts that support HTTP-based transports (e.g., Claude Desktop with remote servers, basic-host).

### Stdio

```bash
cd server
npm run start:stdio
```

Communicates over stdin/stdout. Use this for local MCP hosts that launch the server as a subprocess (e.g., Claude Desktop local config).

To serve assets locally in stdio mode (fully self-contained, no CDN):

```bash
cd server
OPENSCAD_SERVE_DIST=1 npm run start:stdio
# or: npm run start:self-serve -- --stdio
```

This starts a lightweight HTTP server on a free port for static assets and automatically sets `OPENSCAD_BASE_URL` to point to it. The CSP headers are configured to allow the app to load from this local server.

> **Note:** The `.npmrc` sets `loglevel=silent` so npm doesn't print its lifecycle banner to stdout (which would corrupt the JSON-RPC stream). The `build` script also redirects its output to stderr (`1>&2`). If you add build steps, make sure they also redirect stdout to stderr.

**Claude Desktop config example** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "openscad": {
      "command": "npm",
      "args": ["run", "start:stdio"],
      "cwd": "/path/to/openscad-playground/server"
    }
  }
}
```

**Self-contained (with local asset serving):**
```json
{
  "mcpServers": {
    "openscad": {
      "command": "npm",
      "args": ["run", "start:stdio"],
      "cwd": "/path/to/openscad-playground/server",
      "env": { "OPENSCAD_SERVE_DIST": "1" }
    }
  }
}
```

## Running with an MCP App Host

### With basic-host (from ext-apps)

```bash
# Terminal 1: Start the OpenSCAD MCP server
cd server
npm start

# Terminal 2: Start the basic-host pointing to the server
cd ../ext-apps/examples/basic-host
SERVERS='["http://localhost:3001/mcp"]' npm start
```

Then open the basic-host URL (usually `http://localhost:3002`) in Chrome.

### Self-serve mode

By default, the app's HTML loads JS/WASM/CSS from the public deployment at `https://ochafik.com/openscad2/`. To serve all static files from the MCP server itself (fully self-contained, no CDN dependency):

```bash
# Make sure the client is built first
cd /path/to/openscad-playground
npm install && npm run build:all

# Start server with self-serve
cd server
npm run start:self-serve
```

This adds `express.static` serving of the `dist/` directory and points the app's base URL to the server itself.

## Deployment

### Static + serverless hosting (e.g. Vercel)

The server is stateless, so it also runs as a serverless function next to the static `dist/` files. This repository ships no platform-specific files; see [docs/MCP_APP_DEPLOYMENT.md](../docs/MCP_APP_DEPLOYMENT.md) for a generic walkthrough and an example `vercel.json`.

The CSP metadata automatically includes the `OPENSCAD_BASE_URL` origin in `resourceDomains` and `connectDomains`, so the MCP App iframe can load scripts and WASM from whatever domain you configure.

### Other platforms (Fly.io, Railway, etc.)

The server is a standard Node.js/Express app. Deploy `server/` with:
- `npm install && npm start` as the start command
- Set `PORT` (the asset base follows the request host; see the table below for overrides)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `HOST` | `localhost` | HTTP server bind address |
| `OPENSCAD_BASE_URL` | _(derived per request)_ | Explicit override of the asset base URL (JS, WASM, CSS, libraries, fallback). When unset, the base is the request's own origin (`Host`; `X-Forwarded-Host`/`-Proto` only behind a trusted proxy), then `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`, then `https://ochafik.com/openscad2/`. Also feeds the CSP `resourceDomains`/`connectDomains`. Without `--serve-dist` the request origin is not used (nothing would serve assets there). |
| `OPENSCAD_ALLOWED_HOSTS` | _(unset)_ | Comma-separated hostnames (`example.com`, `host:port`, `*.example.com`) the per-request base may use; other hosts fall back to the env chain. |
| `OPENSCAD_TRUST_PROXY` | _(unset)_ | Honour `X-Forwarded-Host`/`X-Forwarded-Proto` (always on when `VERCEL` is set). Hosts must be plain `hostname[:port]`. |
| `OPENSCAD_DIST_DIR` | `../dist` (relative to server/) | Path to the built dist/ directory (for `--serve-dist`) |
| `OPENSCAD_SERVE_DIST` | _(unset)_ | Set to any value to enable static file serving (alternative to `--serve-dist` flag) |
| `ASSET_PORT` | `0` (auto) | Port for the stdio-mode asset server (only used with `--stdio --serve-dist`) |

## Tools

### Server tools

| Tool | Description |
|---|---|
| `create` | Open the OpenSCAD viewer (an app tool bound to the `ui://openscad/viewer.html` resource). Accepts optional initial `source`, `vars`, and `camera`; echoes the applied values (defaults included) in `structuredContent`, which the view reads to initialize itself. |

### App-registered tools

The view registers these with the host during the `ui/initialize` handshake (definitions in `src/state/mcp-tools.ts`, pure logic in `src/state/mcp-tools-logic.ts`); the host routes calls straight into the iframe. They are only available once the viewer has loaded (after `create`). Source paths are the playground's virtual files (e.g. `/playground.scad`); `path` defaults to the active file.

| Tool | Description |
|---|---|
| `view_source` | Numbered lines (`cat -n` style) of a file, optional `start_line`/`end_line`, plus the file list. |
| `str_replace_source` | Exact string replacement like Claude Code's Edit: **fails** if `old_string` is not found, or is not unique unless `replace_all`. |
| `insert_source` | Insert `text` after line N (0 = top). |
| `delete_source_lines` | Delete `start_line`..`end_line`. |
| `write_source` | Create or overwrite a file (`activate` to make it the rendered file; new files can be `include`d from others). |
| `delete_source_file` | Delete a file (never the last one). |
| `undo_source_edit` | Undo the last tool edit (history of 20; refuses if the file changed since, e.g. by the user). |
| `get_viewer_state` | Active file, file list, render status, errors/warnings (`file:line:col`), OpenSCAD log tail, customizer parameters, camera, view options. |
| `render_model` | Force a full (non-preview) render and wait for it. |
| `get_parameters` | The active file's customizer schema: name, type, caption, group, default, current value (and whether it differs), min/max/step or dropdown options (value + label). Says so when the file has none; reflects source edits after the re-render. |
| `set_parameters` | Set one or many values (same path as the customizer UI; unchanged values are skipped). All values are validated first; if any is unknown/invalid nothing changes and every problem is listed with the allowed range/options. Waits for the render. |
| `reset_parameters` | Reset all (or the named) parameters to the defaults in the source. |
| `set_layout` | `mode` `embed` \| `full` (full = code editor, tabs, footer; the editor loads lazily from cdn.jsdelivr.net, allowed by the resource CSP), `customizer_overlay` `open`\|`closed`\|`toggle`, and in full mode `editor`/`viewer`/`customizer` or `focus`. The layout is reported by `get_viewer_state`. |
| `set_camera` | `view` preset (`iso`, `front`, `back`, `left`, `right`, `top`, `bottom`) and/or `azimuth_deg`/`elevation_deg`, `zoom` (1 = fit), `distance`, `target`, `field_of_view_deg`, `fit`. |
| `orbit_camera` | Relative rotate (`azimuth_deg`, `elevation_deg`) and `zoom_factor`. |
| `get_camera` | Current camera in model-friendly units. |
| `set_view_options` | `show_axes`. (There is no shadows or wireframe mode.) |
| `screenshot` | PNG/JPEG image blocks of the 3D canvas (`max_size` up to 1024). `views: ["iso","front","top"]` returns several angles in one call; the camera is restored unless `keep_camera`. |

The viewer opens in **embed mode** (see the main README): only the 3D view, with a floating customizer button whose overlay closes on Escape or an outside click; the button and `get_viewer_state` stay in sync with `set_layout`. A fullscreen button appears when the host offers the `fullscreen` display mode.

Parameter presets are not exposed: the app has no preset concept (only the values the customizer holds), so there are no `list_presets`/`apply_preset` tools.

Every mutating tool waits (up to 30 s) for the re-check/re-render and returns the render status, errors/warnings and the OpenSCAD log tail in its result. If the render failed, `isError` is set and the text starts with `EDIT APPLIED, BUT THE RENDER FAILED` so the model knows the source did change. A render still running at the timeout is reported as `STILL RUNNING` (not an error).

The previous single `interact` tool (action enum + `commands` batching) was replaced by these focused tools: each has its own JSON schema and description, which models call more reliably than one flat union, and hosts that can issue parallel tool calls do not need a batching parameter. The server's `instructions` describe the intended workflow (create, view_source / str_replace_source, read diagnostics, screenshot, adjust camera).

## Architecture

```
┌─────────────┐        create        ┌──────────────────┐
│   LLM / AI  │ ───────────────────▶ │   MCP Server     │  (stateless)
│   (model)   │                      │  create + UI res │
└─────────────┘                      └──────────────────┘
       │                                       │ serves ui://openscad/viewer.html
       │  app tools (routed by host)           ▼
       │                              ┌──────────────────┐
       └────────────────────────────▶ │   App (iframe)   │
       ▲                              │ 3D viewer+editor │
       │  tool results, model context └──────────────────┘
       └───────────────────────────────────────┘
```

1. LLM calls `create` — the host opens the viewer resource; the view reads the initial source/vars/camera from the tool's input and result
2. The view registers its app tools during its `ui/initialize` handshake
3. LLM calls an app tool (e.g. `str_replace_source`, `screenshot`) — the host routes the call into the iframe, which applies it, waits for the render and answers with diagnostics and images directly
4. The view also pushes passive state changes (user edits in the customizer, render status) into the model context via `updateModelContext`

## Testing

```bash
cd server
npm test
```

Runs an in-process test suite over linked in-memory transports, covering the tool/resource surface: `create` registration and `_meta.ui.resourceUri` binding, default application and echo, input validation, and the UI resource's HTML + CSP metadata.

The app tools live in the view. `npm test` also runs `test-tools.ts`, which unit-tests the tool layer and its pure logic (line numbering and range checks, `str_replace` uniqueness, insert/delete, undo, diagnostics wording, camera math, multi-view screenshots) against a mock viewer host. End-to-end behaviour (real renders, screenshots) is exercised in a browser host such as the ext-apps `basic-host`: call `create`, then `bridge.callTool(...)` on the app bridge for each app tool.

## WebAssembly-less fallback (optional)

The app uses WebAssembly by default. When WebAssembly is unavailable (e.g. iOS Lockdown Mode, or a strict CSP without `wasm-unsafe-eval`), the worker loads the optional wasm2js build `openscad.fallback.js` instead, if it is deployed next to the app (see [docs/WASM_FALLBACK.md](../docs/WASM_FALLBACK.md) for how to build it).

In the MCP App the page lives on the host's sandbox origin while assets live on `OPENSCAD_BASE_URL`. The worker is started through a blob wrapper that resolves relative `importScripts()`/`fetch()` URLs against the asset origin, so the fallback script is fetched from `OPENSCAD_BASE_URL` too. Make sure it is served from there (in `--serve-dist` mode, copy it into `dist/`; it is ~22 MB and only downloaded when needed) and that the origin is allowed by the CSP, which the server derives from `OPENSCAD_BASE_URL`.

## Development

```bash
cd server
npm run dev          # Same as npm start, for development
npm test             # Run the server tests
```

The server uses `tsx` for direct TypeScript execution — no build step needed for the server itself. The client-side code requires `npm run build` (webpack) from the project root.
