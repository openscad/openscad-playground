/**
 * OpenSCAD Playground MCP Server
 *
 * An MCP server that opens the OpenSCAD playground as an interactive
 * MCP App (3D viewer + customizer) inside the host's iframe.
 *
 * Tools:
 * - create: opens the viewer with initial source / customizer vars / camera.
 *
 * All follow-up interaction goes through app tools that the view itself
 * registers with the host once it loads (src/state/mcp-tools.ts: view_source,
 * str_replace_source, screenshot, set_camera, ...): the host routes those
 * calls straight into the iframe, so the server needs no command queue,
 * polling, or shared state — it works stateless, including on serverless
 * deployments.
 */

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  McpServer,
  type CallToolResult,
  type ReadResourceResult,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { envBaseUrl } from "./base-url.js";
import { serverIcons } from "./icons.js";

export const RESOURCE_URI = "ui://openscad/viewer.html";

// ─── ChatGPT (OpenAI MCP Extensions) metadata ───────────────────────────
//
// ChatGPT implements MCP Apps, so `_meta.ui.*` alone makes the app work
// there. These optional `openai/*` keys opt into ChatGPT-specific surfaces
// (https://github.com/openai/mcp-extensions/blob/main/docs/spec.md); hosts
// that don't know them ignore them.

/**
 * Entrypoints (sidebar, conversation tab, file handler) are separate app-only
 * tools so the sidebar entry gets a proper title and the model's tool list
 * stays `create`. ChatGPT calls the global and thread ones with `{}` and
 * the file one with `{file: {name, resourceUri}}`; `_meta.ui.visibility` is
 * ignored when it launches them.
 */
export const OPENAI_UI_OPEN_META = {
  entrypoints: [{ type: "global" }, { type: "thread" }],
} as const;
export const OPENAI_UI_FILE_META = {
  entrypoints: [{ type: "file", extensions: [".scad"] }],
} as const;

/**
 * Display modes (resource content item): ChatGPT opens the app fullscreen
 * (entrypoints always do). The MCP Apps spec has no declarative preferred
 * mode, and the view never calls requestDisplayMode on its own, so other
 * hosts keep their inline default (400 px, growing for the customizer).
 */
export const OPENAI_UI_RESOURCE_META = {
  availableDisplayModes: ["inline", "fullscreen"],
  preferredDisplayMode: "fullscreen",
} as const;

// Must stay in sync with CAMERA_VIEWS in src/state/mcp-app.ts and the preset
// names in src/state/mcp-tools-logic.ts (`diagonal` is the legacy name of `iso`).
export const CAMERA_VIEWS = [
  "diagonal",
  "iso",
  "front",
  "right",
  "back",
  "left",
  "top",
  "bottom",
] as const;

// ─── Default source for the create tool ─────────────────────────────────

export const DEFAULT_SOURCE = `// Parametric rounded box — try the customizer!

/* [Dimensions] */
width = 30;   // [10:100]
depth = 20;   // [10:100]
height = 15;  // [5:50]

/* [Style] */
rounding = 3; // [0:0.5:10]
wall = 2;     // [1:0.5:5]

$fn = $preview ? 32 : 64;

difference() {
  minkowski() {
    cube([width - 2*rounding, depth - 2*rounding, height - rounding], center = true);
    sphere(r = rounding);
  }
  translate([0, 0, wall])
    minkowski() {
      cube([width - 2*wall - 2*rounding, depth - 2*wall - 2*rounding, height], center = true);
      sphere(r = max(0.01, rounding - wall));
    }
}`;

// ─── Server ─────────────────────────────────────────────────────────────

export const INSTRUCTIONS = `OpenSCAD Playground: create and iterate on parametric 3D models (OpenSCAD) in a live viewer the user sees.

Workflow:
1. Call \`create\` ONCE (with initial \`source\` if you have one). It opens the viewer. Calling it again opens a separate viewer.
2. Once the viewer has loaded it registers its own tools with the host (hosts that route "app tools" list them next to this server's tools): view_source, str_replace_source, insert_source, delete_source_lines, write_source, delete_source_file, undo_source_edit, get_viewer_state, render_model, download_model, get_parameters, set_parameters, reset_parameters, set_layout, set_camera, get_camera, orbit_camera, set_view_options, screenshot. Use view_source before editing; prefer str_replace_source for small changes (old_string must match exactly and be unique).
3. Every edit re-renders and the tool result contains the render status, errors/warnings (file:line:col) and the OpenSCAD log tail. A result starting "EDIT APPLIED, BUT THE RENDER FAILED" means the source was changed but is broken: fix it (or undo_source_edit) before continuing.
4. Verify visually with \`screenshot\` (use views such as ["iso","front","top"] to check several angles in one call), then adjust with set_camera / orbit_camera or edit the source again.
5. Customizer parameters: top-level variables annotated like \`width = 60; // [10:100]\` (optionally under \`/* [Group] */\`) are a quick way to satisfy requests like "make it taller" or "thicker walls" without editing code. set_parameters overlays values on the source (it does not modify the file), get_parameters lists names, ranges and current values, reset_parameters restores defaults. Check them before editing code for value tweaks; edit the source for structural changes, and annotate the variables a user is likely to adjust.
6. download_model exports the model (stl, 3mf, glb, off; svg/dxf for 2D) or, with format \"scad\", a source file and has the host save it (delivery \"auto\" falls back to a chat attachment, then to returning the file in the tool result; \"link\" sends a resource_link instead of embedding the bytes).
7. The viewer opens in a compact embed layout (3D view + customizer button). set_layout mode \"full\" shows the code editor; use it if the user wants to see or edit the code.
8. Fallback: some hosts do not expose the viewer's own tools to the model. If none of them appear in your tool list, iterate by calling \`create\` again with the complete updated \`source\` (each call opens a fresh viewer) instead of waiting for them.
Units are millimetres, Z is up.`;

/**
 * @param baseUrl Where the app's assets are served from (see base-url.ts).
 *   The server is stateless and created per request, so callers pass the
 *   base derived from that request. Defaults to the environment-derived one.
 */
export function createServer(baseUrl: string = envBaseUrl()): McpServer {
  const icons = serverIcons(baseUrl);
  // registerAppTool forwards extra config to registerTool, which supports `icons`; its config type just doesn't list it.
  const toolIcons: object = { icons };
  const server = new McpServer(
    { name: "OpenSCAD Playground", version: "0.2.0", icons },
    { instructions: INSTRUCTIONS },
  );

  // ─── Create tool (app tool — opens the viewer) ─────────────────────

  registerAppTool(
    server,
    "create",
    {
      title: "Create OpenSCAD Viewer",
      ...toolIcons,
      description: `Open an interactive OpenSCAD 3D viewer and editor. Call this ONCE per model.

**All follow-up actions use the viewer's own tools**, which the app registers with the host once it loads: view_source / str_replace_source / insert_source / write_source (edit code and get render diagnostics), get_viewer_state, render_model, set_parameters, set_camera / orbit_camera / get_camera, set_view_options, and screenshot (images, multi-angle). Calling create again opens a SEPARATE viewer (only do that when the viewer's tools are not in your tool list: then pass the complete updated source to iterate).

Optionally pass initial OpenSCAD source code, customizer variable values, and a camera preset. With no source, a default parametric model is shown.

Customizer: top-level variables annotated like \`width = 60; // [10:100]\` become parameters, a quick way to satisfy "make it taller/thicker" without editing code: set_parameters overlays values on the source (it does not modify the file), get_parameters lists names/ranges/current values, reset_parameters restores defaults. Check them before editing code for value tweaks; edit the source for structural changes.`,
      inputSchema: z.object({
        source: z
          .string()
          .default(DEFAULT_SOURCE)
          .describe("OpenSCAD source code (.scad)"),
        vars: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Initial customizer variable values"),
        camera: z
          .enum(CAMERA_VIEWS)
          .default("diagonal")
          .describe("Camera preset"),
      }),
      outputSchema: z.object({
        source: z.string().describe("The source the viewer opens with"),
        camera: z.string(),
        vars: z.record(z.string(), z.unknown()).optional(),
      }),
      // Opening a viewer has no server-side effect (the server is stateless),
      // so it is read-only and safe to auto-approve.
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        // registerAppTool mirrors resourceUri to the legacy flat `ui/resourceUri`.
        ui: { resourceUri: RESOURCE_URI, visibility: ["model", "app"] },
        "openai/toolInvocation/invoking": "Opening the OpenSCAD viewer…",
        "openai/toolInvocation/invoked": "OpenSCAD viewer ready",
      },
    },
    async ({ source, vars, camera }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: "text",
            text:
              "OpenSCAD viewer opened. Use the viewer's tools to work on the model: view_source, " +
              "str_replace_source, insert_source, write_source, get_viewer_state, set_parameters, " +
              "set_camera, screenshot, ... (edits return render errors/warnings). If those tools are not " +
              "in your tool list, call create again with the full updated source to iterate.",
          },
        ],
        // The view reads its initial state from this structured content
        // (via ontoolresult) — including the defaults applied above when
        // the model omitted an argument.
        structuredContent: {
          source,
          camera,
          ...(vars ? { vars } : {}),
        },
      };
    },
  );

  // ─── Entrypoint tools (ChatGPT sidebar / conversation tab / .scad files) ───

  const entryAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

  registerAppTool(
    server,
    "open_openscad",
    {
      title: "OpenSCAD",
      ...toolIcons,
      description: "Open the OpenSCAD viewer and editor with the default parametric model. For user-initiated launches (ChatGPT sidebar or conversation tab); models should call `create` instead.",
      inputSchema: z.object({}),
      outputSchema: z.object({ source: z.string(), camera: z.string() }),
      annotations: entryAnnotations,
      _meta: {
        ui: { resourceUri: RESOURCE_URI, visibility: ["app"] },
        "openai/ui": OPENAI_UI_OPEN_META,
      },
    },
    async (): Promise<CallToolResult> => ({
      content: [{ type: "text", text: `OpenSCAD viewer opened with the default model.` }],
      structuredContent: { source: DEFAULT_SOURCE, camera: "diagonal" },
    }),
  );

  registerAppTool(
    server,
    "open_scad_file",
    {
      title: "Open OpenSCAD file",
      ...toolIcons,
      description: "Open a .scad file in the OpenSCAD viewer and editor. Launched by ChatGPT's file handler; the viewer reads (and saves back) the file through the host's resources.",
      inputSchema: z.object({
        file: z.object({
          name: z.string().min(1).describe("File name including extension"),
          resourceUri: z.string().min(1).describe("Opaque host URI to read the file through"),
        }),
      }),
      outputSchema: z.object({ file: z.object({ name: z.string(), resourceUri: z.string() }) }),
      annotations: entryAnnotations,
      _meta: {
        ui: { resourceUri: RESOURCE_URI, visibility: ["app"] },
        "openai/ui": OPENAI_UI_FILE_META,
      },
    },
    async ({ file }): Promise<CallToolResult> => ({
      content: [{ type: "text", text: `OpenSCAD viewer opened ${file.name}.` }],
      structuredContent: { file },
    }),
  );

  // ─── UI Resource ───────────────────────────────────────────────────

  registerAppResource(
    server,
    "OpenSCAD Viewer",
    RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Interactive OpenSCAD 3D viewer and editor",
      icons,
    },
    async (): Promise<ReadResourceResult> => {
      const html = buildAppHtml(baseUrl);
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              "openai/ui": OPENAI_UI_RESOURCE_META,
              ui: {
                permissions: { clipboardWrite: {} },
                csp: {
                  // cdn.jsdelivr.net: the code editor (Monaco), only loaded when the model switches to the full layout.
                  resourceDomains: [new URL(baseUrl).origin, "https://cdn.jsdelivr.net"],
                  connectDomains: [new URL(baseUrl).origin, "https://cdn.jsdelivr.net", "blob:", "data:"],
                },
              },
            },
          },
        ],
      };
    },
  );

  return server;
}

/**
 * Build the MCP App HTML that loads the OpenSCAD playground.
 */
function buildAppHtml(baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const cacheBust = `?v=${Date.now()}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="openscad-base-url" content="${base}">
  <title>OpenSCAD Playground</title>

  <!-- Patch fetch/createObjectURL to handle blob: URLs in CSP-restricted sandboxes.
       model-viewer uses fetch() to load models, but connect-src may block blob:/data: URLs.
       We intercept createObjectURL to keep a Blob→URL map, then intercept fetch to serve
       blob: URLs directly from the map without a network request. -->
  <script>
  (function() {
    var blobMap = new Map();
    var _createObjectURL = URL.createObjectURL.bind(URL);
    var _revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = function(blob) {
      var url = _createObjectURL(blob);
      if (blob instanceof Blob) blobMap.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = function(url) {
      blobMap.delete(url);
      return _revokeObjectURL(url);
    };
    var _fetch = self.fetch;
    self.fetch = function(url) {
      if (typeof url === 'string' && url.startsWith('blob:') && blobMap.has(url)) {
        return Promise.resolve(new Response(blobMap.get(url), { status: 200 }));
      }
      return _fetch.apply(self, arguments);
    };
  })();
  </script>

  <script type="module" src="${base}model-viewer.min.js${cacheBust}" defer></script>
  <script src="${base}browserfs.min.js${cacheBust}" defer></script>
  <script src="${base}index.js${cacheBust}" defer></script>

  <style>
    #root, body, html {
      display: flex;
      flex-direction: column;
      flex: 1;
      margin: 0;
      height: 100vh;
      height: var(--app-height);
      overflow: hidden;
    }
    .p-tabmenu-nav { justify-content: center; }
    .p-fieldset .p-fieldset-content { padding: 0 !important; }
    .p-fieldset-legend { background-color: rgba(255,255,255,0.4) !important; }
    .p-fieldset-legend, .p-fieldset-content { padding-top: 0 !important; padding-bottom: 0 !important; }
    .absolute-fill { position: absolute; top: 0; right: 0; left: 0; bottom: 0; }
    .opacity-animated { transition: opacity 0.5s ease-in-out; }
    .opacity-0 { opacity: 0; }
    /* Before React mounts: a bar that only appears after 250 ms (no flash for fast loads) and is removed on mount. */
    #boot-progress { position: fixed; top: 0; left: 0; right: 0; height: 3px; overflow: hidden; opacity: 0;
      background: var(--color-background-tertiary, rgba(127,127,127,0.2)); animation: boot-in 0s linear 0.25s forwards; }
    #boot-progress::before { content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
      background: var(--color-ring-primary, #6366f1); animation: boot-slide 1.4s ease-in-out infinite; }
    @keyframes boot-in { to { opacity: 1; } }
    @keyframes boot-slide { from { left: -40%; } to { left: 100%; } }
    @media (prefers-reduced-motion: reduce) { #boot-progress::before { animation: none; left: 0; width: 100%; opacity: 0.55; } }
  </style>
</head>
<body>
  <noscript>You need to enable JavaScript to run the OpenSCAD Playground.</noscript>
  <div id="boot-progress" aria-hidden="true"></div>
  <div id="root"></div>
</body>
</html>`;
}
