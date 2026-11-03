/**
 * MCP Apps integration for running the OpenSCAD playground inside an MCP host
 * iframe, built on @modelcontextprotocol/ext-apps.
 *
 * The view registers its own app tools (declared to the host during the
 * ui/initialize handshake; see mcp-tools.ts), so the model's actions are
 * routed by the host straight into this iframe — no server-side command
 * queue or polling.
 *
 * The tool handlers delegate to a {@link ViewerHost} that the React UI
 * (McpApp.tsx) installs once it has mounted; calls that arrive earlier wait
 * for it.
 */

import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import { createTools, formatDiagnostics, type ViewerHost } from './mcp-tools.ts';

export { isMcpMode } from './mcp-mode.ts';

// Must stay in sync with CAMERA_VIEWS in server/openscad-server.ts (the
// create tool's enum). `diagonal` is the legacy name of `iso`.
export const CAMERA_VIEWS = ['diagonal', 'iso', 'front', 'right', 'back', 'left', 'top', 'bottom'] as const;

// ─── Host (installed by the React UI once mounted) ──────────────────────

/** How long a tool call waits for the UI to mount before failing. */
const HOST_WAIT_TIMEOUT_MS = 15_000;

let activeHost: ViewerHost | null = null;
let hostWaiters: Array<(h: ViewerHost) => void> = [];

/** Install (or clear) the host the tool handlers delegate to. */
export function setActiveHost(host: ViewerHost | null): void {
  activeHost = host;
  if (host) {
    const waiters = hostWaiters;
    hostWaiters = [];
    for (const w of waiters) w(host);
  }
}

function requireHost(): Promise<ViewerHost> {
  if (activeHost) return Promise.resolve(activeHost);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      hostWaiters = hostWaiters.filter(w => w !== onReady);
      reject(new Error('Viewer not ready (UI never mounted)'));
    }, HOST_WAIT_TIMEOUT_MS);
    const onReady = (h: ViewerHost) => {
      clearTimeout(timer);
      resolve(h);
    };
    hostWaiters.push(onReady);
  });
}

// ─── App instance ────────────────────────────────────────────────────────

/**
 * Create the App and declare its tool surface. Must be called (and tools
 * registered) BEFORE connect(): the tool list is declared during the
 * ui/initialize handshake.
 */
export function createMcpApp(): App {
  const app = new App(
    { name: 'OpenSCAD Playground', version: '0.2.0' },
    {},
    { autoResize: false }, // the app fills its container
  );
  for (const tool of createTools(requireHost)) {
    const { name, handler, ...config } = tool;
    app.registerTool(name, config, async (args: unknown) => handler(args));
  }
  return app;
}

// ─── Tool event buffering ────────────────────────────────────────────────

export interface ToolInputParams {
  arguments?: Record<string, unknown>;
}

export interface ToolResultParams {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  _meta?: Record<string, unknown>;
}

export interface ToolEventBuffer {
  inputs: ToolInputParams[];
  results: ToolResultParams[];
}

/**
 * Buffer tool-input / tool-result notifications until the React UI mounts
 * and installs its own handlers. The host typically delivers the `create`
 * call's input and result right after ui/initialize — well before React has
 * rendered (the editor FS loads in between) — so without this the initial
 * source would be lost.
 *
 * Call right after {@link createMcpApp}, before connect(). The UI replays
 * and clears the buffers when it takes over the handlers.
 */
export function bufferToolEvents(app: App): ToolEventBuffer {
  const buffer: ToolEventBuffer = { inputs: [], results: [] };
  app.ontoolinput = (params) => {
    buffer.inputs.push(params as ToolInputParams);
  };
  app.ontoolresult = (params) => {
    buffer.results.push(params as ToolResultParams);
  };
  return buffer;
}

// ─── Model context updates ───────────────────────────────────────────────

/**
 * Push the viewer's current state (and a screenshot, where the host accepts
 * images) into the model's context, so passive changes made by the user in
 * the UI are visible to the model without it having to call get_viewer_state.
 */
export async function publishModelContext(app: App, host: ViewerHost): Promise<void> {
  const caps = app.getHostCapabilities();
  if (!caps?.updateModelContext) return;

  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  > = [];

  if (caps.updateModelContext.image) {
    const img = await host.captureImage({ maxSize: 512, mimeType: 'image/png', quality: 0.8 });
    if (img) content.push({ type: 'image', data: img.data, mimeType: img.mimeType });
  }

  const snap = host.snapshot();
  const source = host.readFile(snap.activePath) ?? '';
  content.push({
    type: 'text',
    text: `OpenSCAD viewer state — active file ${snap.activePath}, status ${snap.status}\n` +
      `${formatDiagnostics(snap)}\n\n\`\`\`scad\n${source}\n\`\`\``,
  });

  await app.updateModelContext({ content });
}

// ─── Host style helpers ──────────────────────────────────────────────────

/** Apply all styles from hostContext in one call. */
export function applyHostStyles(ctx: McpUiHostContext | undefined) {
  if (!ctx) return;
  if (ctx.theme === 'light' || ctx.theme === 'dark') {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  const fonts = ctx.styles?.css?.fonts;
  if (fonts) {
    applyHostFonts(fonts);
  }
}
