/**
 * OpenSCAD Playground MCP Server
 *
 * An MCP server that opens the OpenSCAD playground as an interactive
 * MCP App (3D viewer + customizer) inside the host's iframe.
 *
 * Tools:
 * - create: opens the viewer with initial source / customizer vars / camera.
 *
 * All follow-up interaction goes through the `interact` tool that the view
 * itself registers with the host once it loads (see src/state/mcp-app.ts):
 * the host routes those calls straight into the iframe, so the server needs
 * no command queue, polling, or shared state — it works stateless, including
 * on serverless deployments.
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

// Read at call time, not module load: stdio --serve-dist sets
// OPENSCAD_BASE_URL only once its asset server knows its port (index.ts).
function getBaseUrl(): string {
  return process.env.OPENSCAD_BASE_URL ?? "https://ochafik.com/openscad2/";
}

export const RESOURCE_URI = "ui://openscad/viewer.html";

// Must stay in sync with CAMERA_VIEWS in src/state/mcp-app.ts (the view's
// set_camera enum) and the preset names in ViewerPanel.tsx's PREDEFINED_ORBITS.
export const CAMERA_VIEWS = [
  "diagonal",
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

export function createServer(): McpServer {
  const server = new McpServer({
    name: "OpenSCAD Playground",
    version: "0.2.0",
  });

  // ─── Create tool (app tool — opens the viewer) ─────────────────────

  registerAppTool(
    server,
    "create",
    {
      title: "Create OpenSCAD Viewer",
      description: `Open an interactive OpenSCAD 3D viewer and editor. Call this ONCE per model.

**All follow-up actions go through the viewer's own \`interact\` tool**, which the app registers with the host once it loads — editing source, setting customizer variables, changing camera, rendering, zooming, capturing screenshots, reading state. Calling create again opens a SEPARATE viewer.

Optionally pass initial OpenSCAD source code, customizer variable values, and a camera preset. With no source, a default parametric model is shown.`,
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
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async ({ source, vars, camera }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: "text",
            text:
              "OpenSCAD viewer opened. Use the viewer's `interact` tool to modify the model " +
              "(write_source, edit_source, set_var, set_vars, set_camera, render, zoom, auto_fit, " +
              "get_screenshot, get_state).",
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

  // ─── UI Resource ───────────────────────────────────────────────────

  registerAppResource(
    server,
    "OpenSCAD Viewer",
    RESOURCE_URI,
    {
      mimeType: RESOURCE_MIME_TYPE,
      description: "Interactive OpenSCAD 3D viewer and editor",
    },
    async (): Promise<ReadResourceResult> => {
      const baseUrl = getBaseUrl();
      const html = buildAppHtml(baseUrl);
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                permissions: { clipboardWrite: {} },
                csp: {
                  resourceDomains: [new URL(baseUrl).origin],
                  connectDomains: [new URL(baseUrl).origin, "blob:", "data:"],
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
  </style>
</head>
<body>
  <noscript>You need to enable JavaScript to run the OpenSCAD Playground.</noscript>
  <div id="root"></div>
</body>
</html>`;
}
