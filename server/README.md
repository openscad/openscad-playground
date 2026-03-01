# OpenSCAD MCP Server

An [MCP](https://modelcontextprotocol.io/) server that exposes an interactive OpenSCAD 3D viewer as an [MCP App](https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/apps). It lets LLMs create, edit, and render OpenSCAD models through tool calls, while users see a live 3D preview in the host UI.

Built with the [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps) v2: the server exposes a single `create` tool that opens the viewer, and the viewer itself registers an `interact` app tool with the host. The host routes `interact` calls straight into the iframe, so the server is fully stateless — no command queue, no polling, no Redis.

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
OPENSCAD_BASE_URL=http://localhost:3001/ npm run start:self-serve
```

This adds `express.static` serving of the `dist/` directory and points the app's base URL to the server itself.

## Deployment

### Vercel

The repo root has a `vercel.json` that deploys both the **web app** (static files from `dist/`) and the **MCP endpoint** (serverless function at `/mcp`) from the same project. The server is stateless, so serverless deployment needs no shared storage.

1. Set environment variables in your Vercel project:
   - `OPENSCAD_BASE_URL` — set to your Vercel deployment URL (e.g. `https://openscad.vercel.app/`)

2. Deploy from the repo root:
   ```bash
   vercel
   ```

This gives you:
- `https://openscad.vercel.app/` — the standalone web playground
- `https://openscad.vercel.app/mcp` — the MCP endpoint for AI hosts

The CSP headers automatically include the `OPENSCAD_BASE_URL` origin in `resourceDomains` and `connectDomains`, so the MCP App iframe can load scripts and WASM from whatever domain you configure.

### Other platforms (Fly.io, Railway, etc.)

The server is a standard Node.js/Express app. Deploy `server/` with:
- `npm install && npm start` as the start command
- Set `PORT` and `OPENSCAD_BASE_URL` environment variables

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP server port |
| `HOST` | `localhost` | HTTP server bind address |
| `OPENSCAD_BASE_URL` | `https://ochafik.com/openscad2/` | Base URL for loading app assets (JS, WASM, CSS). Also controls CSP `resourceDomains` and `connectDomains`. |
| `OPENSCAD_DIST_DIR` | `../dist` (relative to server/) | Path to the built dist/ directory (for `--serve-dist`) |
| `OPENSCAD_SERVE_DIST` | _(unset)_ | Set to any value to enable static file serving (alternative to `--serve-dist` flag) |
| `ASSET_PORT` | `0` (auto) | Port for the stdio-mode asset server (only used with `--stdio --serve-dist`) |

## Tools

### Server tools

| Tool | Description |
|---|---|
| `create` | Open the OpenSCAD viewer (an app tool bound to the `ui://openscad/viewer.html` resource). Accepts optional initial `source`, `vars`, and `camera`; echoes the applied values (defaults included) in `structuredContent`, which the view reads to initialize itself. |

### App-registered tools

The view registers these with the host during the `ui/initialize` handshake (see `src/state/mcp-app.ts`); the host routes calls straight into the iframe:

| Tool | Description |
|---|---|
| `interact` | One tool for every viewer action, with an `action` enum plus a flat schema of per-action fields, and an optional `commands` array for sequential batching (content[i] is the result of commands[i]). |

**`interact` actions:**

| Action | Required fields | Description |
|---|---|---|
| `write_source` | `content` | Replace entire source code |
| `edit_source` | `old_text`, `new_text` | Find-and-replace in source (errors if `old_text` is absent) |
| `set_camera` | `view` or `theta`+`phi` | Set camera angle (preset name or custom radians) |
| `set_var` | `name`, `value` | Set a single customizer variable |
| `set_vars` | `vars` | Set multiple customizer variables at once |
| `render` | _(none)_ | Trigger a full (non-preview) render |
| `zoom` | `factor` | Zoom by factor (<1 = zoom in, >1 = zoom out) |
| `auto_fit` | _(none)_ | Reset zoom to fit the model in view |
| `get_screenshot` | _(none)_ | Capture the current view as a PNG image |
| `get_state` | _(none)_ | Read source, errors, warnings, customizer params and camera |

Source/variable mutations return the checker's errors and warnings directly in the tool result, so the model gets immediate feedback without a round-trip through `get_state`.

## Architecture

```
┌─────────────┐        create        ┌──────────────────┐
│   LLM / AI  │ ───────────────────▶ │   MCP Server     │  (stateless)
│   (model)   │                      │  create + UI res │
└─────────────┘                      └──────────────────┘
       │                                       │ serves ui://openscad/viewer.html
       │  interact (routed by host)            ▼
       │                              ┌──────────────────┐
       └────────────────────────────▶ │   App (iframe)   │
       ▲                              │ 3D viewer+editor │
       │  tool results, model context └──────────────────┘
       └───────────────────────────────────────┘
```

1. LLM calls `create` — the host opens the viewer resource; the view reads the initial source/vars/camera from the tool's input and result
2. The view registers `interact` during its `ui/initialize` handshake
3. LLM calls `interact` — the host routes the call into the iframe, which applies it and answers with results (including screenshots) directly
4. The view also pushes passive state changes (user edits in the customizer, render status) into the model context via `updateModelContext`

## Testing

```bash
cd server
npm test
```

Runs an in-process test suite over linked in-memory transports, covering the tool/resource surface: `create` registration and `_meta.ui.resourceUri` binding, default application and echo, input validation, and the UI resource's HTML + CSP metadata.

The `interact` tool lives in the view, so it is exercised in a browser host (e.g. basic-host), not here.

## asm.js Fallback (Optional)

The app uses WebAssembly by default. For environments without WASM support, an optional asm.js variant can be built; if `src/asmjs/openscad.js` exists, webpack automatically builds `openscad-worker-asmjs.js` alongside the regular `openscad-worker.js`. At runtime, the app detects WebAssembly support and automatically falls back to the asm.js worker if available.

**Trade-offs:**
- asm.js binary is ~2-3x larger than WASM
- Runtime performance is ~5-10x slower
- 98%+ of browsers support WASM, so this is rarely needed

## Development

```bash
cd server
npm run dev          # Same as npm start, for development
npm test             # Run the server tests
```

The server uses `tsx` for direct TypeScript execution — no build step needed for the server itself. The client-side code requires `npm run build` (webpack) from the project root.
