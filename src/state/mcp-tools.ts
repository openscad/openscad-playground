/**
 * App tools the OpenSCAD viewer registers with the MCP host (so the model can
 * drive the open viewer): source viewing/editing modelled on Claude Code's
 * file tools, state/diagnostics, customizer parameters, camera and
 * screenshots.
 *
 * The tool layer is DOM-free: it talks to the live UI through the
 * {@link ViewerHost} interface (implemented by McpApp.tsx), so it can be unit
 * tested against a mock host (server/test-tools.ts).
 */

import type { CallToolResult } from '@modelcontextprotocol/client';
import { z } from 'zod';
import {
  CAMERA_PRESET_NAMES,
  azElFromOrbit,
  nearestPreset,
  ToolError,
  canonicalPreset,
  deleteLines,
  formatNumbered,
  insertLines,
  lineCount,
  normalizeNewPath,
  orbitDelta,
  replaceUnique,
  resolveCamera,
  resolvePath,
  type CameraRequest,
  type ResolvedCamera,
} from './mcp-tools-logic.ts';

// ─── Host interface ─────────────────────────────────────────────────────

export interface Diagnostic {
  path: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export interface FileInfo {
  path: string;
  lines: number;
  active: boolean;
}

export interface CameraState {
  /** model-viewer orbit, radians. */
  theta: number;
  phi: number;
  /** Orbit radius in viewer scene units. */
  radius: number;
  /** Radius at which the whole model is framed (zoom 1), when known. */
  fitRadius?: number;
  target: { x: number; y: number; z: number };
  /** Field of view in degrees. */
  fov: number;
  /** Model bounding-box size in viewer scene units, when known. */
  dimensions?: { x: number; y: number; z: number };
}

export interface ParameterInfo {
  name: string;
  type: string;
  group?: string;
  caption?: string;
  initial: unknown;
  value: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: unknown;
}

export interface ViewerSnapshot {
  activePath: string;
  files: FileInfo[];
  status: 'idle' | 'checking' | 'previewing' | 'rendering';
  /** The wait for idle ran out before the viewer settled. */
  timedOut?: boolean;
  /** Set when the last render threw (e.g. OpenSCAD failed). */
  error?: string;
  diagnostics: Diagnostic[];
  logTail: string[];
  hasOutput: boolean;
  renderKind?: 'preview' | 'full';
  elapsedMs?: number;
  is2D?: boolean;
  parameters: ParameterInfo[];
  showAxes: boolean;
}

export interface CapturedImage {
  /** Base64 (no data: prefix). */
  data: string;
  mimeType: string;
  width: number;
  height: number;
}

export interface CaptureOptions {
  maxSize: number;
  mimeType: 'image/png' | 'image/jpeg';
  quality: number;
}

export interface ViewerHost {
  snapshot(): ViewerSnapshot;
  /** Wait until checking/previewing/rendering has finished (or the timeout), then snapshot. */
  settle(timeoutMs: number): Promise<ViewerSnapshot>;
  readFile(path: string): string | undefined;
  /** Create or replace a file; re-checks and re-renders. */
  writeFile(path: string, content: string, opts?: { activate?: boolean }): void;
  removeFile(path: string): void;
  /** Start a full (non-preview) render of the active file. */
  startFullRender(): void;
  /** Merge customizer values and start a preview render. */
  setParameters(vars: Record<string, unknown>): void;
  setShowAxes(show: boolean): void;
  getCamera(): Promise<CameraState | null>;
  setCamera(camera: ResolvedCamera): Promise<CameraState | null>;
  /** Wait until the viewer has loaded the latest rendered model. */
  waitForModel(timeoutMs: number): Promise<boolean>;
  captureImage(opts: CaptureOptions): Promise<CapturedImage | null>;
}

// ─── Result helpers ─────────────────────────────────────────────────────

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] });
const fail = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }], isError: true });

const RENDER_TIMEOUT_MS = 30_000;
const LOG_TAIL_LINES = 8;

const fmtNum = (n: number) => String(Math.round(n * 1000) / 1000);

function formatDiagnostic(d: Diagnostic): string {
  return `  ${d.path}:${d.line}:${d.column}: ${d.severity}: ${d.message}`;
}

export function hasRenderFailure(s: ViewerSnapshot): boolean {
  return !!s.error || s.diagnostics.some(d => d.severity === 'error');
}

/** Multi-line diagnostics report: render status, markers, log tail. */
export function formatDiagnostics(s: ViewerSnapshot): string {
  const errors = s.diagnostics.filter(d => d.severity === 'error');
  const warnings = s.diagnostics.filter(d => d.severity === 'warning');
  const out: string[] = [];
  if (s.timedOut) {
    out.push(`Render: STILL RUNNING after ${RENDER_TIMEOUT_MS / 1000}s (status: ${s.status}); the diagnostics below may be stale. Call get_viewer_state again shortly.`);
  } else if (hasRenderFailure(s)) {
    out.push(`Render: FAILED — ${errors.length} error(s), ${warnings.length} warning(s)${s.error ? `; ${s.error}` : ''}`);
  } else {
    const how = s.renderKind ? `${s.renderKind}${s.elapsedMs != null ? `, ${Math.round(s.elapsedMs)} ms` : ''}` : 'no output yet';
    out.push(`Render: OK (${how}) — 0 errors, ${warnings.length} warning(s)`);
  }
  const shown = s.diagnostics.filter(d => d.severity !== 'info');
  if (shown.length) out.push(...shown.map(formatDiagnostic));
  const tail = s.logTail.filter(l => l.trim() !== '').slice(-LOG_TAIL_LINES);
  if (tail.length) out.push('OpenSCAD log (tail; its line numbers can be off by one in previews, prefer the file:line entries above):', ...tail.map(l => `  ${l}`));
  return out.join('\n');
}

/** Run the tool body; map ToolError (user-facing) and unexpected errors to isError results. */
async function guarded(name: string, body: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body();
  } catch (e) {
    if (e instanceof ToolError) return fail(`${name}: ${e.message}`);
    return fail(`${name} failed unexpectedly: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─── Edit history (for undo_source_edit) ────────────────────────────────

interface HistoryEntry {
  path: string;
  /** null = the file did not exist before the edit. */
  before: string | null;
  /** null = the edit deleted the file. */
  after: string | null;
  activeBefore: string;
  what: string;
}
const MAX_HISTORY = 20;

// ─── Tool definitions ───────────────────────────────────────────────────

export interface AppToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  handler: (args: any) => Promise<CallToolResult>;
}

function def<Shape extends z.ZodRawShape>(d: {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<Shape>;
  annotations?: AppToolDef['annotations'];
  handler: (args: z.output<z.ZodObject<Shape>>) => Promise<CallToolResult>;
}): AppToolDef {
  return { ...d, handler: args => guarded(d.name, () => d.handler(args)) } as AppToolDef;
}

const pathParam = z.string().optional().describe('File path as listed by view_source (e.g. "/playground.scad"). Defaults to the active file.');

/**
 * Build the tool set. `getHost` resolves the live UI (it may wait for React
 * to mount). Edit history lives in the returned closure.
 */
export function createTools(getHost: () => Promise<ViewerHost>): AppToolDef[] {
  const history: HistoryEntry[] = [];
  const pushHistory = (e: HistoryEntry) => {
    history.push(e);
    if (history.length > MAX_HISTORY) history.shift();
  };

  const filePaths = (host: ViewerHost) => host.snapshot().files.map(f => f.path);
  const target = (host: ViewerHost, path?: string) =>
    path == null ? host.snapshot().activePath : resolvePath(filePaths(host), path);
  const read = (host: ViewerHost, path: string) => {
    const c = host.readFile(path);
    if (c == null) throw new ToolError(`File ${path} has no loaded content yet`);
    return c;
  };

  /** Common tail of every mutating source tool: wait for the render and report. */
  async function reportAfterEdit(host: ViewerHost, headline: string, snippet?: string): Promise<CallToolResult> {
    const snap = await host.settle(RENDER_TIMEOUT_MS);
    const failed = hasRenderFailure(snap);
    const parts = [failed ? `EDIT APPLIED, BUT THE RENDER FAILED. ${headline}` : headline];
    if (snippet) parts.push(snippet);
    parts.push(formatDiagnostics(snap));
    return { content: [{ type: 'text', text: parts.join('\n') }], ...(failed ? { isError: true } : {}) };
  }

  /** Camera maths need a loaded model (fit radius, bounds): wait for pending renders and the model load. */
  async function cameraOf(host: ViewerHost): Promise<CameraState> {
    await host.settle(RENDER_TIMEOUT_MS);
    await host.waitForModel(10_000);
    const cam = await host.getCamera();
    if (!cam) throw new ToolError('The viewer is not ready (no camera yet)');
    return cam;
  }

  const snippetAround = (content: string, first: number, last: number) => {
    const total = lineCount(content);
    if (total === 0) return '(file is now empty)';
    const from = Math.max(1, first - 2);
    const to = Math.min(total, Math.max(last, first) + 2);
    return `Updated lines ${from}-${to}:\n${formatNumbered(content, from, to).text}`;
  };

  const tools: AppToolDef[] = [
    // ── Source viewing / editing ───────────────────────────────────
    def({
      name: 'view_source',
      title: 'View OpenSCAD source',
      description:
        'Show a source file of the open OpenSCAD viewer with line numbers (like `cat -n`), plus the list of files. ' +
        'Without `path` shows the active file (the one that is rendered). Use start_line/end_line (1-based, inclusive) for large files. ' +
        'Always view before editing so str_replace_source matches exactly.',
      inputSchema: z.object({
        path: pathParam,
        start_line: z.number().int().min(1).optional().describe('First line to show (1-based). Default 1.'),
        end_line: z.number().int().min(1).optional().describe('Last line to show (inclusive). Default: end of file.'),
      }),
      annotations: { readOnlyHint: true },
      handler: async ({ path, start_line, end_line }) => {
        const host = await getHost();
        const snap = host.snapshot();
        const p = target(host, path);
        const view = formatNumbered(read(host, p), start_line, end_line);
        const files = snap.files.map(f => `  ${f.path} (${f.lines} lines)${f.active ? ' [active]' : ''}`).join('\n');
        const range = view.total ? `lines ${view.start}-${view.end} of ${view.total}` : 'empty';
        return text(`Files:\n${files}\n\n${p} (${range}):\n${view.text}`);
      },
    }),

    def({
      name: 'str_replace_source',
      title: 'Replace text in OpenSCAD source',
      description:
        'Replace an exact string in a source file (like Claude Code\'s Edit tool). FAILS if old_string is not found, or if it appears more than once ' +
        'and replace_all is not set — include enough surrounding context to make it unique. The editor updates live; the tool waits for the re-render ' +
        'and returns errors/warnings (file:line:col) and the OpenSCAD log tail.',
      inputSchema: z.object({
        path: pathParam,
        old_string: z.string().describe('Exact text to replace (whitespace-sensitive). Must be unique in the file unless replace_all.'),
        new_string: z.string().describe('Replacement text (must differ from old_string).'),
        replace_all: z.boolean().optional().describe('Replace every occurrence instead of requiring a unique match. Default false.'),
      }),
      annotations: { destructiveHint: false },
      handler: async ({ path, old_string, new_string, replace_all }) => {
        const host = await getHost();
        const p = target(host, path);
        const before = read(host, p);
        const r = replaceUnique(before, old_string, new_string, replace_all ?? false);
        pushHistory({ path: p, before, after: r.content, activeBefore: host.snapshot().activePath, what: 'str_replace_source' });
        host.writeFile(p, r.content);
        return reportAfterEdit(host, `Replaced ${r.count} occurrence(s) in ${p}.`, snippetAround(r.content, r.firstLine, r.lastLine));
      },
    }),

    def({
      name: 'insert_source',
      title: 'Insert lines into OpenSCAD source',
      description:
        'Insert text after a given line of a source file (line 0 = top of file, line N = after line N, N = line count appends). ' +
        'Waits for the re-render and returns diagnostics.',
      inputSchema: z.object({
        path: pathParam,
        line: z.number().int().min(0).describe('Insert after this 1-based line (0 = at the very top).'),
        text: z.string().min(1).describe('Text to insert; may span several lines.'),
      }),
      handler: async ({ path, line, text: t }) => {
        const host = await getHost();
        const p = target(host, path);
        const before = read(host, p);
        const r = insertLines(before, line, t);
        pushHistory({ path: p, before, after: r.content, activeBefore: host.snapshot().activePath, what: 'insert_source' });
        host.writeFile(p, r.content);
        return reportAfterEdit(host, `Inserted ${r.lastLine - r.firstLine + 1} line(s) after line ${line} of ${p}.`, snippetAround(r.content, r.firstLine, r.lastLine));
      },
    }),

    def({
      name: 'delete_source_lines',
      title: 'Delete lines from OpenSCAD source',
      description: 'Delete lines start_line..end_line (1-based, inclusive) from a source file. Waits for the re-render and returns diagnostics.',
      inputSchema: z.object({
        path: pathParam,
        start_line: z.number().int().min(1).describe('First line to delete.'),
        end_line: z.number().int().min(1).optional().describe('Last line to delete (inclusive). Default: start_line.'),
      }),
      handler: async ({ path, start_line, end_line }) => {
        const host = await getHost();
        const p = target(host, path);
        const before = read(host, p);
        const r = deleteLines(before, start_line, end_line ?? start_line);
        pushHistory({ path: p, before, after: r.content, activeBefore: host.snapshot().activePath, what: 'delete_source_lines' });
        host.writeFile(p, r.content);
        return reportAfterEdit(host, `Deleted lines ${start_line}-${end_line ?? start_line} of ${p}.`, r.firstLine ? snippetAround(r.content, r.firstLine, r.lastLine) : '(file is now empty)');
      },
    }),

    def({
      name: 'write_source',
      title: 'Write an OpenSCAD source file',
      description:
        'Create a source file or completely overwrite an existing one. Prefer str_replace_source for small changes. ' +
        'Set activate=true to make it the file that is rendered (new files are not rendered otherwise — they are only reachable via include/use). ' +
        'Without `path`, overwrites the active file. Waits for the re-render and returns diagnostics.',
      inputSchema: z.object({
        path: z.string().optional().describe('File path, e.g. "/lib/gear.scad". Defaults to the active file.'),
        content: z.string().describe('Complete new file content.'),
        activate: z.boolean().optional().describe('Make this the active (rendered) file. Default: true when no path is given or the file is new and the only file; otherwise false.'),
      }),
      handler: async ({ path, content, activate }) => {
        const host = await getHost();
        const snap = host.snapshot();
        const paths = snap.files.map(f => f.path);
        let p: string;
        let existed = true;
        if (path == null) {
          p = snap.activePath;
        } else {
          try {
            p = resolvePath(paths, path);
          } catch {
            p = normalizeNewPath(path);
            existed = false;
          }
        }
        const before = existed ? (host.readFile(p) ?? '') : null;
        pushHistory({ path: p, before, after: content, activeBefore: snap.activePath, what: 'write_source' });
        host.writeFile(p, content, { activate: activate ?? false });
        return reportAfterEdit(host, `${existed ? 'Overwrote' : 'Created'} ${p} (${lineCount(content)} lines)${activate ? ' and made it active' : ''}.`);
      },
    }),

    def({
      name: 'delete_source_file',
      title: 'Delete a source file',
      description: 'Delete a source file from the viewer. The last remaining file cannot be deleted; deleting the active file activates another one.',
      inputSchema: z.object({ path: z.string().describe('File to delete.') }),
      annotations: { destructiveHint: true },
      handler: async ({ path }) => {
        const host = await getHost();
        const snap = host.snapshot();
        const p = resolvePath(snap.files.map(f => f.path), path);
        if (snap.files.length <= 1) throw new ToolError('Cannot delete the only remaining file');
        pushHistory({ path: p, before: host.readFile(p) ?? '', after: null, activeBefore: snap.activePath, what: 'delete_source_file' });
        host.removeFile(p);
        return reportAfterEdit(host, `Deleted ${p}.`);
      },
    }),

    def({
      name: 'undo_source_edit',
      title: 'Undo the last source edit',
      description:
        `Undo the most recent edit made through the source tools (history of the last ${MAX_HISTORY} edits is kept in the viewer). ` +
        'Fails if the file was changed by someone else (e.g. the user) since that edit.',
      inputSchema: z.object({}),
      handler: async () => {
        const host = await getHost();
        const e = history[history.length - 1];
        if (!e) throw new ToolError('Nothing to undo');
        const exists = host.snapshot().files.some(f => f.path === e.path);
        const current = exists ? host.readFile(e.path) : null;
        if (current !== e.after) {
          throw new ToolError(`${e.path} changed since the last tool edit (${e.what}); refusing to undo over those changes. Use write_source to restore content explicitly.`);
        }
        history.pop();
        if (e.before == null) {
          host.removeFile(e.path);
        } else {
          host.writeFile(e.path, e.before, { activate: false });
        }
        return reportAfterEdit(host, `Undid ${e.what} on ${e.path} (${history.length} more edit(s) in history).`);
      },
    }),

    // ── State / render ─────────────────────────────────────────────
    def({
      name: 'get_viewer_state',
      title: 'Get OpenSCAD viewer state',
      description:
        'Report the viewer state: active file and file list, render status, errors/warnings (file:line:col), OpenSCAD log tail, ' +
        'customizer parameters with current values, camera and view settings. Waits briefly for a running render to finish. Does not return source (use view_source).',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      handler: async () => {
        const host = await getHost();
        const s = await host.settle(10_000);
        const lines: string[] = [];
        lines.push(`Active file: ${s.activePath}`);
        lines.push(`Files: ${s.files.map(f => `${f.path} (${f.lines} lines)`).join(', ')}`);
        lines.push(`Status: ${s.status}${s.is2D ? ' (2D model)' : ''}${s.hasOutput ? '' : ' (nothing rendered yet)'}`);
        lines.push(formatDiagnostics(s));
        if (s.parameters.length) {
          lines.push('Customizer parameters (name = value [default]; use set_parameters):');
          for (const p of s.parameters) {
            const range = p.min != null ? ` range ${p.min}..${p.max}${p.step ? ` step ${p.step}` : ''}` : '';
            lines.push(`  ${p.name} = ${JSON.stringify(p.value)} [${JSON.stringify(p.initial)}] (${p.type}${range})${p.group ? ` group "${p.group}"` : ''}`);
          }
        } else {
          lines.push('Customizer parameters: none');
        }
        await host.waitForModel(5_000);
        const cam = await host.getCamera();
        lines.push(`Camera: ${cam ? cameraText(cam) : 'unavailable (viewer not ready)'}`);
        lines.push(`View: axes ${s.showAxes ? 'shown' : 'hidden'}`);
        lines.push(`Exportable: ${s.hasOutput && !hasRenderFailure(s) ? 'yes (a model has been rendered)' : 'no'}`);
        return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: { ...s } as Record<string, unknown> };
      },
    }),

    def({
      name: 'render_model',
      title: 'Render the model',
      description:
        'Force a full (non-preview, CGAL/Manifold) render of the active file and wait for it (up to 30 s). Edits already auto-trigger a fast preview; ' +
        'use this for the final, accurate geometry. Returns errors/warnings and the OpenSCAD log tail.',
      inputSchema: z.object({}),
      handler: async () => {
        const host = await getHost();
        host.startFullRender();
        const snap = await host.settle(RENDER_TIMEOUT_MS);
        return { content: [{ type: 'text', text: formatDiagnostics(snap) }], ...(hasRenderFailure(snap) ? { isError: true } : {}) };
      },
    }),

    def({
      name: 'set_parameters',
      title: 'Set customizer parameters',
      description:
        'Set one or more customizer variables (the `/* [Group] */ name = value; // [min:max]` variables of the active file) without editing the source. ' +
        'Unknown names are rejected. Waits for the re-render and returns diagnostics. Names/values: see get_viewer_state.',
      inputSchema: z.object({
        values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean(), z.array(z.union([z.number(), z.string(), z.boolean()]))]))
          .describe('Map of parameter name to new value, e.g. {"width": 40, "style": "round"}.'),
      }),
      handler: async ({ values }) => {
        const host = await getHost();
        const known = new Set(host.snapshot().parameters.map(p => p.name));
        const unknown = Object.keys(values).filter(n => !known.has(n));
        if (unknown.length) {
          throw new ToolError(`Unknown parameter(s): ${unknown.join(', ')}. Known: ${[...known].join(', ') || '(none — the active file has no customizer parameters)'}`);
        }
        if (Object.keys(values).length === 0) throw new ToolError('values is empty');
        host.setParameters(values);
        const snap = await host.settle(RENDER_TIMEOUT_MS);
        const failed = hasRenderFailure(snap);
        return {
          content: [{ type: 'text', text: `${failed ? 'PARAMETERS SET, BUT THE RENDER FAILED. ' : ''}Set ${Object.entries(values).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}.\n${formatDiagnostics(snap)}` }],
          ...(failed ? { isError: true } : {}),
        };
      },
    }),

    // ── Camera / view ──────────────────────────────────────────────
    def({
      name: 'set_camera',
      title: 'Set the camera',
      description:
        'Move the viewer camera (it stays there; the user sees it). Give a `view` preset and/or azimuth_deg/elevation_deg ' +
        '(azimuth: 0 = looking at the front, +90 = from the right, 180 = back; elevation: 0 = level, 90 = from above, -90 = from below). ' +
        'zoom: 1 frames the whole model, 2 = twice as close. `fit: true` re-frames the model (zoom 1, target centered). ' +
        'Omitted fields keep their current value. Returns the resulting camera.',
      inputSchema: z.object({
        view: z.enum([...CAMERA_PRESET_NAMES, 'diagonal'] as [string, ...string[]]).optional().describe('Preset: iso (alias diagonal), front, back, left, right, top, bottom.'),
        azimuth_deg: z.number().optional().describe('Horizontal angle in degrees.'),
        elevation_deg: z.number().min(-90).max(90).optional().describe('Vertical angle in degrees (-90..90).'),
        zoom: z.number().positive().optional().describe('Relative to fit: 1 = whole model in frame, 2 = twice as close, 0.5 = twice as far.'),
        distance: z.number().positive().optional().describe('Absolute orbit distance in viewer scene units (advanced; see get_camera). Exclusive with zoom.'),
        target: z.union([z.literal('auto'), z.object({ x: z.number(), y: z.number(), z: z.number() })]).optional()
          .describe('Point to look at in viewer scene units, or "auto" for the model center.'),
        field_of_view_deg: z.union([z.number().min(10).max(120), z.literal('auto')]).optional().describe('Vertical field of view in degrees (10..120) or "auto".'),
        fit: z.boolean().optional().describe('Re-frame the whole model (overrides zoom/distance/target).'),
      }),
      handler: async (args) => {
        const host = await getHost();
        const cur = await cameraOf(host);
        const req: CameraRequest = { ...args, view: args.view ? canonicalPreset(args.view) : undefined };
        if (args.view && !req.view) throw new ToolError(`Unknown view ${args.view}`);
        const after = await host.setCamera(resolveCamera(req, cur));
        return text(`Camera set. ${after ? cameraText(after) : ''}`);
      },
    }),

    def({
      name: 'get_camera',
      title: 'Get the camera',
      description: 'Return the current camera: azimuth/elevation in degrees, nearest preset, zoom relative to fit, distance, target, field of view, and model size.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
      handler: async () => {
        const host = await getHost();
        const cam = await cameraOf(host);
        return { content: [{ type: 'text', text: cameraText(cam) }], structuredContent: { ...cam } as Record<string, unknown> };
      },
    }),

    def({
      name: 'orbit_camera',
      title: 'Orbit/zoom the camera relatively',
      description:
        'Rotate and/or zoom the camera relative to where it is now: azimuth_deg (+ = rotate the camera to the right around the model), ' +
        'elevation_deg (+ = move up), zoom_factor (>1 closer, <1 farther). Handy for inspecting from slightly different angles.',
      inputSchema: z.object({
        azimuth_deg: z.number().optional().describe('Degrees to rotate horizontally.'),
        elevation_deg: z.number().optional().describe('Degrees to rotate vertically (result clamped to -90..90).'),
        zoom_factor: z.number().positive().optional().describe('Multiply closeness: 2 = twice as close, 0.5 = twice as far.'),
      }),
      handler: async (args) => {
        const host = await getHost();
        const cur = await cameraOf(host);
        const next = orbitDelta(cur, args);
        const after = await host.setCamera({ theta: next.theta, phi: next.phi, distance: next.radius });
        return text(`Camera moved. ${after ? cameraText(after) : ''}`);
      },
    }),

    def({
      name: 'set_view_options',
      title: 'Set viewer options',
      description:
        'Toggle viewer display options. Currently: show_axes (the orientation axes gizmo in the corner of the viewer). ' +
        'The embedded viewer has no editor/layout panes, shadows or wireframe mode.',
      inputSchema: z.object({ show_axes: z.boolean().optional().describe('Show or hide the axes gizmo.') }),
      handler: async ({ show_axes }) => {
        const host = await getHost();
        if (show_axes == null) throw new ToolError('Pass at least one option (show_axes)');
        host.setShowAxes(show_axes);
        return text(`Axes ${show_axes ? 'shown' : 'hidden'}.`);
      },
    }),

    // ── Screenshot ─────────────────────────────────────────────────
    def({
      name: 'screenshot',
      title: 'Screenshot the 3D view',
      description:
        'Capture the 3D viewer as an image (the model canvas only, not the surrounding UI), after waiting for pending renders to finish. ' +
        'Pass `views` (e.g. ["iso","front","top"]) to get several angles in ONE call — recommended for checking geometry. Views frame the whole model ' +
        '(unless zoom is given). The camera is restored afterwards unless keep_camera=true. Without `views` the current camera is used (optionally overridden by `camera`).',
      inputSchema: z.object({
        views: z.array(z.enum([...CAMERA_PRESET_NAMES, 'diagonal'] as [string, ...string[]])).max(7).optional()
          .describe('Preset views to capture, one image each.'),
        camera: z.object({
          azimuth_deg: z.number().optional(),
          elevation_deg: z.number().min(-90).max(90).optional(),
          zoom: z.number().positive().optional(),
          fit: z.boolean().optional(),
        }).optional().describe('Temporary camera for a single image (same meaning as in set_camera).'),
        zoom: z.number().positive().optional().describe('With `views`: zoom relative to fit (default 1 = whole model).'),
        max_size: z.number().int().min(64).max(1024).optional().describe('Longest image side in pixels (default 768, max 1024; never upscaled).'),
        format: z.enum(['png', 'jpeg']).optional().describe('Image format (default png; jpeg is smaller).'),
        keep_camera: z.boolean().optional().describe('Leave the camera where the screenshot put it. Default false (restore).'),
      }),
      annotations: { readOnlyHint: true },
      handler: async ({ views, camera, zoom, max_size, format, keep_camera }) => {
        const host = await getHost();
        const snap = await host.settle(RENDER_TIMEOUT_MS);
        if (!snap.hasOutput) {
          return fail(`screenshot: nothing has been rendered yet.\n${formatDiagnostics(snap)}`);
        }
        await host.waitForModel(10_000);
        const opts: CaptureOptions = {
          maxSize: max_size ?? 768,
          mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
          quality: 0.85,
        };
        const start = await cameraOf(host);

        const shots: Array<{ label: string; img: CapturedImage }> = [];
        const capture = async (label: string, req?: CameraRequest) => {
          if (req) await host.setCamera(resolveCamera(req, (await host.getCamera()) ?? start));
          const img = await host.captureImage(opts);
          if (!img) throw new ToolError(`could not capture the 3D view (${label})`);
          shots.push({ label, img });
        };
        try {
          if (views?.length) {
            for (const v of views) {
              const name = canonicalPreset(v)!;
              await capture(name, { view: name, zoom: zoom ?? 1, target: 'auto' });
            }
          } else if (camera) {
            await capture('custom camera', camera);
          } else {
            await capture('current camera');
          }
        } finally {
          if (!keep_camera && (views?.length || camera)) {
            await host.setCamera({ theta: start.theta, phi: start.phi, distance: start.radius, target: start.target, fov: start.fov });
          }
        }
        const warn = hasRenderFailure(snap)
          ? `\nWARNING: the last render FAILED, so the image shows the previous successful model.\n${formatDiagnostics(snap)}`
          : '';
        const content: CallToolResult['content'] = [];
        for (const s of shots) {
          content.push({ type: 'text', text: `${s.label} (${s.img.width}x${s.img.height})` });
          content.push({ type: 'image', data: s.img.data, mimeType: s.img.mimeType });
        }
        if (warn) content.push({ type: 'text', text: warn.trim() });
        return { content };
      },
    }),
  ];
  return tools;
}

function cameraText(c: CameraState): string {
  const { azimuth, elevation } = azElFromOrbit(c.theta, c.phi);
  const near = nearestPreset(c.theta, c.phi);
  const preset = near.distanceDeg < 1 ? `preset ${near.name}` : `nearest preset ${near.name}, ~${Math.round(near.distanceDeg)}deg away`;
  const zoom = c.fitRadius ? `zoom ${fmtNum(c.fitRadius / c.radius)} (1 = fit), ` : '';
  const dims = c.dimensions ? `; model size ${fmtNum(c.dimensions.x)} x ${fmtNum(c.dimensions.y)} x ${fmtNum(c.dimensions.z)} scene units` : '';
  return `azimuth ${azimuth}deg, elevation ${elevation}deg (${preset}), ${zoom}distance ${fmtNum(c.radius)}, target (${fmtNum(c.target.x)}, ${fmtNum(c.target.y)}, ${fmtNum(c.target.z)}), fov ${fmtNum(c.fov)}deg${dims}.`;
}
