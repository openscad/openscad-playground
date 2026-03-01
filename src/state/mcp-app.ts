/**
 * MCP Apps integration for running the OpenSCAD playground inside an MCP host
 * iframe, built on @modelcontextprotocol/ext-apps.
 *
 * The view registers its own `interact` app tool (declared to the host during
 * the ui/initialize handshake), so the model's actions are routed by the host
 * straight into this iframe — no server-side command queue or polling.
 *
 * The tool handlers delegate to a {@link McpToolProcessor} that the React
 * UI (McpApp.tsx) installs once it has mounted; calls that arrive earlier
 * wait for it.
 */

import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/client';
import { z } from 'zod';

export function isMcpMode(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return false; // cross-origin check failed = we're in an iframe
  }
}

export interface OpenSCADCommand {
  type: string;
  [key: string]: unknown;
}

// Must stay in sync with CAMERA_VIEWS in server/openscad-server.ts (the
// create tool's enum) and with the preset names in ViewerPanel.tsx's
// PREDEFINED_ORBITS (what applyCameraPreset resolves against).
export const CAMERA_VIEWS = ['diagonal', 'front', 'right', 'back', 'left', 'top', 'bottom'] as const;

// ─── Processor (installed by the React UI once mounted) ─────────────────

export interface McpToolProcessor {
  /** Process a command. Return value is used for request-response commands. */
  processCommand(command: OpenSCADCommand): Promise<unknown>;
  captureScreenshot(): Promise<string | null>;
  getContextState(): Record<string, unknown>;
}

/** How long a tool call waits for the UI to mount before failing. */
const PROCESSOR_WAIT_TIMEOUT_MS = 15_000;

let activeProcessor: McpToolProcessor | null = null;
let processorWaiters: Array<(p: McpToolProcessor) => void> = [];

/** Install (or clear) the processor tool handlers delegate to. */
export function setActiveProcessor(processor: McpToolProcessor | null): void {
  activeProcessor = processor;
  if (processor) {
    const waiters = processorWaiters;
    processorWaiters = [];
    for (const w of waiters) w(processor);
  }
}

function requireProcessor(): Promise<McpToolProcessor> {
  if (activeProcessor) return Promise.resolve(activeProcessor);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      processorWaiters = processorWaiters.filter(w => w !== onReady);
      reject(new Error('Viewer not ready (UI never mounted)'));
    }, PROCESSOR_WAIT_TIMEOUT_MS);
    const onReady = (p: McpToolProcessor) => {
      clearTimeout(timer);
      resolve(p);
    };
    processorWaiters.push(onReady);
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
  registerInteractTool(app);
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

// ─── App tool definitions ────────────────────────────────────────────────

function errResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** Result shape processCommand returns for mutation commands. */
interface MutationOutcome {
  timedOut?: boolean;
  notFound?: boolean;
}

/**
 * Summarize a mutation's outcome. When the operation was still running at
 * the processor's wait timeout, say so instead of reporting a checker state
 * that may be stale.
 */
function mutationSummary(processor: McpToolProcessor, outcome: unknown): string {
  if ((outcome as MutationOutcome | undefined)?.timedOut) {
    return 'Still processing (timed out waiting for idle) — call get_state for the final result.';
  }
  return stateSummary(processor);
}

/** Summarize checker state after a source/vars mutation, for the tool result. */
function stateSummary(processor: McpToolProcessor): string {
  const state = processor.getContextState() as {
    errors?: Array<{ line: number; message: string }>;
    warnings?: Array<{ line: number; message: string }>;
  };
  const errors = state.errors ?? [];
  const warnings = state.warnings ?? [];
  if (errors.length === 0 && warnings.length === 0) return 'OK (no errors)';
  const fmt = (ms: Array<{ line: number; message: string }>) =>
    ms.map(m => `  line ${m.line}: ${m.message}`).join('\n');
  return [
    errors.length > 0 ? `${errors.length} error(s):\n${fmt(errors)}` : null,
    warnings.length > 0 ? `${warnings.length} warning(s):\n${fmt(warnings)}` : null,
  ].filter(s => s != null).join('\n');
}

interface AppToolDef {
  name: string;
  description: string;
  /** Validates the action's own parameters (required fields per action). */
  inputSchema?: z.ZodObject<z.ZodRawShape>;
  handler: (processor: McpToolProcessor, args: Record<string, unknown>) => Promise<CallToolResult>;
}

/** Keeps each handler typed by its own schema while storing defs uniformly. */
function defineAppTool<Shape extends z.ZodRawShape>(def: {
  name: string;
  description: string;
  inputSchema?: z.ZodObject<Shape>;
  handler: (processor: McpToolProcessor, args: z.output<z.ZodObject<Shape>>) => Promise<CallToolResult>;
}): AppToolDef {
  return def as unknown as AppToolDef;
}

const APP_TOOL_DEFS: AppToolDef[] = [
  defineAppTool({
    name: 'write_source',
    description: 'Replace the OpenSCAD source code entirely',
    inputSchema: z.object({
      content: z.string().describe('New OpenSCAD source code'),
    }),
    handler: async (processor, { content }) => {
      const outcome = await processor.processCommand({ type: 'write_source', content });
      return textResult(`Source updated. ${mutationSummary(processor, outcome)}`);
    },
  }),
  defineAppTool({
    name: 'edit_source',
    description: 'Find-and-replace within the OpenSCAD source (first occurrence)',
    inputSchema: z.object({
      old_text: z.string().describe('Text to find (must occur in the source)'),
      new_text: z.string().describe('Replacement text'),
    }),
    handler: async (processor, { old_text, new_text }) => {
      const outcome = await processor.processCommand({ type: 'edit_source', old_text, new_text });
      if ((outcome as MutationOutcome | undefined)?.notFound) {
        return errResult('edit_source: old_text not found in the current source');
      }
      return textResult(`Source edited. ${mutationSummary(processor, outcome)}`);
    },
  }),
  defineAppTool({
    name: 'set_camera',
    description: 'Change the camera angle: pass a preset name, or theta/phi in radians',
    inputSchema: z.object({
      view: z.enum(CAMERA_VIEWS).optional().describe('Camera preset name'),
      theta: z.number().optional().describe('Horizontal angle in radians'),
      phi: z.number().optional().describe('Vertical angle in radians'),
    }),
    handler: async (processor, { view, theta, phi }) => {
      if (view == null && (theta == null || phi == null)) {
        return errResult('set_camera requires `view`, or both `theta` and `phi`');
      }
      await processor.processCommand({ type: 'set_camera', view, theta, phi });
      return textResult(view ? `Camera set to ${view}` : `Camera set to theta=${theta}, phi=${phi}`);
    },
  }),
  defineAppTool({
    name: 'set_var',
    description: 'Set one customizer parameter',
    inputSchema: z.object({
      name: z.string().describe('Variable name'),
      value: z.unknown().describe('Variable value'),
    }),
    handler: async (processor, { name, value }) => {
      if (value === undefined) {
        // z.unknown() admits an omitted value — catch it here rather than
        // silently setting the variable to undefined.
        return errResult('set_var requires `value`');
      }
      const outcome = await processor.processCommand({ type: 'set_var', name, value });
      return textResult(`Set ${name} = ${JSON.stringify(value)}. ${mutationSummary(processor, outcome)}`);
    },
  }),
  defineAppTool({
    name: 'set_vars',
    description: 'Set multiple customizer parameters at once',
    inputSchema: z.object({
      vars: z.record(z.string(), z.unknown()).describe('Map of variable names to values'),
    }),
    handler: async (processor, { vars }) => {
      const outcome = await processor.processCommand({ type: 'set_vars', vars });
      return textResult(`Set ${Object.keys(vars).length} variable(s). ${mutationSummary(processor, outcome)}`);
    },
  }),
  defineAppTool({
    name: 'render',
    description: 'Full (non-preview) render of the current model',
    handler: async (processor) => {
      const outcome = await processor.processCommand({ type: 'render' });
      if ((outcome as MutationOutcome | undefined)?.timedOut) {
        return textResult('Render still running — call get_state for the final result.');
      }
      return textResult(`Render complete. ${stateSummary(processor)}`);
    },
  }),
  defineAppTool({
    name: 'zoom',
    description: 'Zoom by factor (<1 = zoom in, >1 = zoom out, e.g. 0.5 doubles size)',
    inputSchema: z.object({
      factor: z.number().positive().describe('Zoom factor'),
    }),
    handler: async (processor, { factor }) => {
      await processor.processCommand({ type: 'zoom', factor });
      return textResult(`Zoomed by ${factor}`);
    },
  }),
  defineAppTool({
    name: 'auto_fit',
    description: 'Reset zoom to fit the model in view',
    handler: async (processor) => {
      await processor.processCommand({ type: 'auto_fit' });
      return textResult('Auto-fit applied');
    },
  }),
  defineAppTool({
    name: 'get_screenshot',
    description: 'Capture the current 3D view as a PNG image',
    handler: async (processor) => {
      const screenshot = await processor.captureScreenshot();
      if (!screenshot) {
        return errResult('Screenshot capture failed: no image data');
      }
      const base64 = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot;
      return {
        content: [
          { type: 'image', data: base64, mimeType: 'image/png' },
        ],
      };
    },
  }),
  defineAppTool({
    name: 'get_state',
    description: 'Read current source, errors, warnings, customizer parameters and camera',
    handler: async (processor) => {
      const state = await processor.processCommand({ type: 'get_state' }) as Record<string, unknown>;
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
        structuredContent: state,
      };
    },
  }),
];

/** Run one action of the app-side `interact` tool. */
async function runInteractCommand(cmd: Record<string, unknown>): Promise<CallToolResult> {
  const def = APP_TOOL_DEFS.find(d => d.name === cmd.action);
  if (!def) {
    return errResult(`Unknown action: ${String(cmd.action)}`);
  }
  let args: Record<string, unknown> = cmd;
  if (def.inputSchema) {
    const parsed = def.inputSchema.safeParse(cmd);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map(i => `${i.path.join('.') || '(input)'}: ${i.message}`)
        .join('; ');
      return errResult(`${def.name}: ${issues}`);
    }
    args = parsed.data as Record<string, unknown>;
  }
  let processor: McpToolProcessor;
  try {
    processor = await requireProcessor();
  } catch (e) {
    return errResult(e instanceof Error ? e.message : String(e));
  }
  try {
    return await def.handler(processor, args);
  } catch (e) {
    return errResult(`${def.name} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Register the single `interact` app tool, mirroring pdf-server's shape:
 * one tool for every viewer action (hosts that ask the user to approve each
 * app tool separately then only ask once), with optional `commands` batching.
 */
function registerInteractTool(app: App): void {
  app.registerTool(
    'interact',
    {
      title: 'Interact with OpenSCAD Viewer',
      description: `Interact with this OpenSCAD viewer: edit source, set customizer variables, change camera, render, zoom, capture screenshots, read state.

**BATCHING**: Send multiple commands in one call via \`commands\` array. Commands run sequentially; content[i] is the result of commands[i]. If a command fails, the batch stops there and that command's slot contains text starting with \`ERROR\` — content.length tells you how far it got. TIP: end with \`get_screenshot\` to verify changes.

**SOURCE**:
• write_source: replace source entirely (content)
• edit_source: find-and-replace, first occurrence (old_text, new_text)

**CUSTOMIZER**:
• set_var: set one parameter (name, value) • set_vars: set many (vars object)

**VIEW**:
• set_camera: preset name (${CAMERA_VIEWS.join(', ')}) or theta/phi in radians
• zoom: by factor (<1 = zoom in, >1 = zoom out) • auto_fit: fit model in view

**RENDER/INSPECT**:
• render: full (non-preview) render
• get_screenshot: capture current view as PNG
• get_state: source, errors, warnings, customizer parameters, camera`,
      inputSchema: z.object({
        action: z
          .enum(APP_TOOL_DEFS.map(d => d.name) as [string, ...string[]])
          .optional()
          .describe('Action to perform (for a single command). Use `commands` for batching.'),
        content: z.string().optional().describe('New source code (for write_source)'),
        old_text: z.string().optional().describe('Text to find (for edit_source)'),
        new_text: z.string().optional().describe('Replacement text (for edit_source)'),
        view: z.enum(CAMERA_VIEWS).optional().describe('Camera preset name (for set_camera)'),
        theta: z.number().optional().describe('Horizontal angle in radians (for set_camera)'),
        phi: z.number().optional().describe('Vertical angle in radians (for set_camera)'),
        name: z.string().optional().describe('Variable name (for set_var)'),
        value: z.unknown().optional().describe('Variable value (for set_var)'),
        vars: z.record(z.string(), z.unknown()).optional().describe('Map of variable names to values (for set_vars)'),
        factor: z.number().optional().describe('Zoom factor (for zoom)'),
        commands: z
          .array(z.record(z.string(), z.any()))
          .optional()
          .describe('Array of {action, ...params} commands to execute sequentially. More efficient than separate calls.'),
      }),
    },
    async ({ action, commands, ...rest }) =>
      handleInteractToolCall({ action, commands, ...rest }),
  );
}

/** Input shape of the `interact` app tool (post-zod-validation). */
export interface InteractToolInput {
  action?: string;
  commands?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Dispatch one `interact` call: a single action, or a `commands` batch.
 * Exported (separately from the registered tool) so the batch contract is
 * unit-testable against a mock processor.
 */
export async function handleInteractToolCall(
  { action, commands, ...rest }: InteractToolInput,
): Promise<CallToolResult> {
  {
      if (commands && commands.length > 0) {
        // Batch contract (mirrors pdf-server): content[i] is the result of
        // commands[i], a failed step's slot is text starting with "ERROR",
        // and isError is only set for single-command calls — some host SDKs
        // collapse isError results to content[0].text, which would drop
        // images from earlier successful steps.
        const content: CallToolResult['content'] = [];
        let failed = false;
        for (let i = 0; i < commands.length; i++) {
          const res = await runInteractCommand(commands[i]);
          if (res.isError) {
            const errText = res.content
              .map(c => (c.type === 'text' ? c.text : null))
              .filter(t => t != null)
              .join(' — ')
              .replace(/^error:\s*/i, '');
            content.push({
              type: 'text',
              text: commands.length > 1
                ? `ERROR at step ${i + 1}/${commands.length} (${String(commands[i].action)}): ${errText}`
                : `ERROR: ${errText}`,
            });
            failed = true;
            break;
          }
          // Squash multi-part successes into one slot so 1:1 indexing holds.
          // Preserve a lone image as-is — that's the screenshot the model wants.
          if (res.content.length === 1) {
            content.push(res.content[0]);
          } else {
            const texts = res.content
              .map(c => (c.type === 'text' ? c.text : null))
              .filter(t => t != null);
            content.push({ type: 'text', text: texts.join('\n') });
          }
        }
        return {
          content,
          ...(failed && commands.length === 1 ? { isError: true } : {}),
        };
      }
      if (!action) {
        return errResult('Provide `action` (or a `commands` array)');
      }
      // Single-action calls return the handler's result verbatim —
      // structuredContent, image content and isError included.
      return runInteractCommand({ action, ...rest });
  }
}

// ─── Model context updates ───────────────────────────────────────────────

/**
 * Push the viewer's current state (and a screenshot, where the host accepts
 * images) into the model's context, so passive changes made by the user in
 * the UI are visible to the model without it having to call get_state.
 */
export async function publishModelContext(app: App, processor: McpToolProcessor): Promise<void> {
  const caps = app.getHostCapabilities();
  if (!caps?.updateModelContext) return;

  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }
  > = [];

  if (caps.updateModelContext.image) {
    const screenshot = await processor.captureScreenshot();
    const base64 = screenshot?.split(',')[1];
    if (base64) {
      content.push({ type: 'image', data: base64, mimeType: 'image/png' });
    }
  }

  const state = processor.getContextState();
  content.push({ type: 'text', text: JSON.stringify(state, null, 2) });

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
