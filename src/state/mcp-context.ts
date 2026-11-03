/**
 * What the viewer tells the model about itself via `ui/update-model-context`:
 * a compact text block (file, render status, camera, parameters that differ
 * from their defaults, source summary) plus a small screenshot where the host
 * accepts images. DOM-free, so the formatting and the scheduling are unit
 * tested (server/test-tools.ts).
 *
 * Each call REPLACES the context this app instance supplied before
 * (spec: ui/update-model-context is idempotent), so every update carries the
 * whole current picture and stale state never accumulates.
 */

import { cameraText, formatDiagnostics, hasRenderFailure, type CameraState, type CapturedImage, type ViewerSnapshot } from './mcp-tools.ts';

export type ContextBlock =
  | { type: 'text'; text: string; annotations?: { audience: string[] }; _meta?: Record<string, unknown> }
  | { type: 'image'; data: string; mimeType: string; _meta?: Record<string, unknown> };

/** What the host advertised (see McpUiHostCapabilities.updateModelContext and `experimental`). */
export interface ContextHostCaps {
  text: boolean;
  image: boolean;
  /** ChatGPT `openai/modelContext` extension: groups and titles are honoured. */
  openai: boolean;
}

/** Longest image side and size budget of the screenshot attached to the context. */
export const CONTEXT_IMAGE_MAX_SIZE = 768;
/** Base64 length budget (~150 KB of image bytes), well under the ~200 KB ceiling. */
export const CONTEXT_IMAGE_MAX_BASE64 = 200_000;
/** Source is only echoed up to this size; larger files get a head excerpt. */
export const CONTEXT_SOURCE_MAX_CHARS = 6000;
export const CONTEXT_GROUP_TITLE = 'OpenSCAD viewer';

export function readContextCaps(hostCapabilities: { updateModelContext?: Record<string, unknown>; experimental?: Record<string, unknown> } | undefined): ContextHostCaps | null {
  const u = hostCapabilities?.updateModelContext;
  if (!u) return null;
  return { text: true, image: !!u.image, openai: !!hostCapabilities?.experimental?.['openai/modelContext'] };
}

/** Parameters whose value differs from the default, as `name = value (default d)`. */
export function changedParameters(s: ViewerSnapshot): string[] {
  return s.parameters
    .filter(p => JSON.stringify(p.value) !== JSON.stringify(p.initial))
    .map(p => `${p.name} = ${JSON.stringify(p.value)} (default ${JSON.stringify(p.initial)})`);
}

export function formatContextText(s: ViewerSnapshot, camera: CameraState | null, source: string): string {
  const lines: string[] = [];
  const active = s.files.find(f => f.path === s.activePath);
  const errors = s.diagnostics.filter(d => d.severity === 'error').length;
  const warnings = s.diagnostics.filter(d => d.severity === 'warning').length;
  lines.push(`OpenSCAD viewer — ${s.activePath}${s.files.length > 1 ? ` (+${s.files.length - 1} more file${s.files.length > 2 ? 's' : ''})` : ''}, ${active ? `${active.lines} lines, ` : ''}${source.length} chars; status ${s.status}.`);
  if (hasRenderFailure(s)) lines.push(formatDiagnostics(s));
  else lines.push(`Render OK${s.renderKind ? ` (${s.renderKind})` : ''}; ${errors} errors, ${warnings} warnings.`);
  if (camera) lines.push(`Camera: ${cameraText(camera)}`);
  const changed = changedParameters(s);
  if (changed.length) lines.push(`Customizer values changed from defaults: ${changed.join('; ')}.`);
  lines.push(`Layout: ${s.layout.mode}${s.layout.customizerOverlay ? ', customizer open' : ''}; axes ${s.showAxes ? 'shown' : 'hidden'}.`);
  const excerpt = source.length > CONTEXT_SOURCE_MAX_CHARS ? `${source.slice(0, CONTEXT_SOURCE_MAX_CHARS)}\n// … truncated (${source.length - CONTEXT_SOURCE_MAX_CHARS} more chars; use view_source)` : source;
  lines.push('', '```scad', excerpt, '```');
  return lines.join('\n');
}

export function buildContextBlocks(s: ViewerSnapshot, camera: CameraState | null, source: string, image: CapturedImage | null, caps: ContextHostCaps): ContextBlock[] {
  const group = caps.openai ? { 'openai/group': { title: CONTEXT_GROUP_TITLE } } : undefined;
  const blocks: ContextBlock[] = [{
    type: 'text',
    text: formatContextText(s, camera, source),
    ...(caps.openai ? { annotations: { audience: ['assistant'] }, _meta: { ...group, 'openai/title': 'OpenSCAD viewer state' } } : {}),
  }];
  if (image && caps.image) {
    blocks.push({ type: 'image', data: image.data, mimeType: image.mimeType, ...(caps.openai ? { _meta: { ...group, 'openai/title': 'Current 3D view' } } : {}) });
  }
  return blocks;
}

/** True once there is something worth reporting: a finished render or a failure. */
export function readyToPublish(s: ViewerSnapshot): boolean {
  return s.status === 'idle' && (s.hasOutput || hasRenderFailure(s));
}

/**
 * Capture a small screenshot within the size budget: JPEG at 768 px, retried
 * smaller if over budget. Returns null when capture fails or nothing fits.
 */
export async function captureForContext(capture: (o: { maxSize: number; mimeType: 'image/jpeg'; quality: number }) => Promise<CapturedImage | null>): Promise<CapturedImage | null> {
  for (const [maxSize, quality] of [[CONTEXT_IMAGE_MAX_SIZE, 0.7], [512, 0.6], [384, 0.5]] as const) {
    const img = await capture({ maxSize, mimeType: 'image/jpeg', quality });
    if (!img) return null;
    if (img.data.length <= CONTEXT_IMAGE_MAX_BASE64) return img;
  }
  return null;
}

/**
 * Debounced, rate-limited, coalescing publisher. `request()` may be called as
 * often as state changes; `run` executes at most once per `minIntervalMs`, only
 * after `debounceMs` of quiet, never concurrently, and a request made while a
 * run is in flight triggers exactly one follow-up run.
 */
export class ContextScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private again = false;
  private lastStart = -Infinity;
  private disposed = false;

  constructor(
    private run: () => Promise<void>,
    private opts: { debounceMs: number; minIntervalMs: number; now?: () => number; setTimer?: typeof setTimeout; clearTimer?: typeof clearTimeout },
  ) {}

  private now() { return (this.opts.now ?? Date.now)(); }

  request(): void {
    if (this.disposed) return;
    if (this.running) { this.again = true; return; }
    if (this.timer) (this.opts.clearTimer ?? clearTimeout)(this.timer);
    const wait = Math.max(this.opts.debounceMs, this.lastStart + this.opts.minIntervalMs - this.now());
    this.timer = (this.opts.setTimer ?? setTimeout)(() => this.fire(), wait);
  }

  private async fire() {
    this.timer = null;
    this.running = true;
    this.lastStart = this.now();
    try { await this.run(); } catch (e) { console.warn('model context update failed:', e); }
    this.running = false;
    if (this.again) { this.again = false; this.request(); }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) (this.opts.clearTimer ?? clearTimeout)(this.timer);
    this.timer = null;
  }
}
