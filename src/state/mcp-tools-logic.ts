/**
 * Pure (DOM-free) logic behind the MCP app tools: line-numbered source
 * viewing, Claude-Code-style unique string replacement, line insertion and
 * deletion, file path resolution, and camera math. Kept separate from
 * mcp-tools.ts so it is unit-testable under plain node (server/test-tools.ts).
 *
 * All line numbers exposed to the model are 1-based.
 */

export class ToolError extends Error {}

// ─── Lines ──────────────────────────────────────────────────────────────

/** Split into lines; a single trailing newline does not create an extra line. */
export function splitLines(content: string): string[] {
  if (content === '') return [];
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function lineCount(content: string): number {
  return splitLines(content).length;
}

/** 1-based line number of a character offset. */
export function lineOfOffset(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
}

export interface NumberedView {
  text: string;
  start: number;
  end: number;
  total: number;
}

/** `cat -n` style numbered lines (right-aligned number, tab, text). */
export function formatNumbered(content: string, startLine?: number, endLine?: number): NumberedView {
  const lines = splitLines(content);
  const total = lines.length;
  if (total === 0) {
    if ((startLine ?? 1) > 1) throw new ToolError(`start_line ${startLine} is out of range: the file is empty`);
    return { text: '(empty file)', start: 0, end: 0, total: 0 };
  }
  const start = startLine ?? 1;
  const end = Math.min(endLine ?? total, total);
  if (!Number.isInteger(start) || start < 1) throw new ToolError(`start_line must be an integer >= 1 (got ${startLine})`);
  if (start > total) throw new ToolError(`start_line ${start} is out of range: the file has ${total} line(s)`);
  if (endLine != null && (!Number.isInteger(endLine) || endLine < start)) {
    throw new ToolError(`end_line (${endLine}) must be an integer >= start_line (${start})`);
  }
  const width = String(end).length < 6 ? 6 : String(end).length;
  const text = lines
    .slice(start - 1, end)
    .map((l, i) => `${String(start + i).padStart(width)}\t${l}`)
    .join('\n');
  return { text, start, end, total };
}

// ─── Edits ──────────────────────────────────────────────────────────────

export interface ReplaceResult {
  content: string;
  count: number;
  /** 1-based first line of the first replacement in the new content. */
  firstLine: number;
  /** 1-based last line of the last replacement in the new content. */
  lastLine: number;
}

/**
 * Claude-Code `Edit` semantics: old_string must exist, and must be unique
 * unless replaceAll. Literal replacement (no `$` pattern interpretation).
 */
export function replaceUnique(content: string, oldString: string, newString: string, replaceAll = false): ReplaceResult {
  if (oldString === '') throw new ToolError('old_string must not be empty (use insert_source or write_source to add text)');
  if (oldString === newString) throw new ToolError('old_string and new_string are identical: nothing to change');
  const offsets: number[] = [];
  for (let i = content.indexOf(oldString); i !== -1; i = content.indexOf(oldString, i + oldString.length)) {
    offsets.push(i);
  }
  if (offsets.length === 0) {
    throw new ToolError(
      'old_string not found in the file. It must match exactly, including whitespace and indentation; ' +
      'use view_source to copy the current text.');
  }
  if (offsets.length > 1 && !replaceAll) {
    const lines = offsets.map(o => lineOfOffset(content, o)).join(', ');
    throw new ToolError(
      `old_string appears ${offsets.length} times (at lines ${lines}), so the edit is ambiguous. ` +
      'Include more surrounding context to make it unique, or set replace_all=true to replace every occurrence.');
  }
  const targets = replaceAll ? offsets : [offsets[0]];
  let out = '';
  let prev = 0;
  let firstLine = 0;
  let lastLine = 0;
  for (const o of targets) {
    out += content.slice(prev, o);
    const startLine = lineOfOffset(out, out.length) ;
    if (!firstLine) firstLine = startLine;
    out += newString;
    lastLine = lineOfOffset(out, Math.max(0, out.length - 1)) ;
    prev = o + oldString.length;
  }
  out += content.slice(prev);
  return { content: out, count: targets.length, firstLine, lastLine: Math.max(lastLine, firstLine) };
}

export interface LineEditResult {
  content: string;
  /** 1-based first affected line in the new content (0 if none remain). */
  firstLine: number;
  lastLine: number;
}

/** Insert `text` after line `line` (0 = at the very top, lineCount = at the end). */
export function insertLines(content: string, line: number, text: string): LineEditResult {
  const lines = splitLines(content);
  if (!Number.isInteger(line) || line < 0 || line > lines.length) {
    throw new ToolError(`line ${line} is out of range: insert after a line in 0..${lines.length} (0 = top of file)`);
  }
  const inserted = splitLines(text.endsWith('\n') ? text : text + '\n');
  if (text === '') throw new ToolError('text must not be empty');
  lines.splice(line, 0, ...inserted);
  return { content: lines.join('\n') + '\n', firstLine: line + 1, lastLine: line + inserted.length };
}

/** Delete lines start..end inclusive. */
export function deleteLines(content: string, start: number, end: number = start): LineEditResult & { removed: string } {
  const lines = splitLines(content);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) {
    throw new ToolError(`line range ${start}-${end} is invalid: the file has ${lines.length} line(s) (need 1 <= start <= end <= ${lines.length})`);
  }
  const removed = lines.splice(start - 1, end - start + 1).join('\n');
  const remaining = lines.length;
  return {
    content: remaining === 0 ? '' : lines.join('\n') + '\n',
    firstLine: remaining === 0 ? 0 : Math.min(start, remaining),
    lastLine: remaining === 0 ? 0 : Math.min(start, remaining),
    removed,
  };
}

// ─── Paths ──────────────────────────────────────────────────────────────

/**
 * Resolve a user-supplied path against the known files: exact match, then
 * leading-slash-insensitive, then a unique basename match.
 */
export function resolvePath(paths: string[], requested: string): string {
  if (paths.includes(requested)) return requested;
  const norm = (p: string) => p.replace(/^\.?\/+/, '');
  const byNorm = paths.filter(p => norm(p) === norm(requested));
  if (byNorm.length === 1) return byNorm[0];
  const base = requested.split('/').pop()!;
  const byBase = paths.filter(p => p.split('/').pop() === base);
  if (byBase.length === 1) return byBase[0];
  throw new ToolError(`No such file: ${requested}. Files: ${paths.join(', ') || '(none)'}`);
}

/** Normalize a path for a NEW file: absolute, no `..`. */
export function normalizeNewPath(path: string): string {
  const p = '/' + path.replace(/^\.?\/+/, '');
  if (p.split('/').includes('..') || p.endsWith('/') || p === '/') {
    throw new ToolError(`Invalid file path: ${path}`);
  }
  return p;
}

// ─── Camera ─────────────────────────────────────────────────────────────

const DEG = 180 / Math.PI;

/**
 * Presets as azimuth/elevation in degrees. Azimuth is model-viewer's `theta`
 * (0 = front, +90 = right), elevation is 90deg - `phi`. Kept consistent with
 * PREDEFINED_ORBITS in components/ViewerPanel.tsx.
 */
export const CAMERA_PRESETS = {
  iso: { azimuth: 45, elevation: 45 },
  front: { azimuth: 0, elevation: 0 },
  right: { azimuth: 90, elevation: 0 },
  back: { azimuth: 180, elevation: 0 },
  left: { azimuth: -90, elevation: 0 },
  top: { azimuth: 0, elevation: 90 },
  bottom: { azimuth: 0, elevation: -90 },
} as const;
export type CameraPresetName = keyof typeof CAMERA_PRESETS;
export const CAMERA_PRESET_NAMES = Object.keys(CAMERA_PRESETS) as [CameraPresetName, ...CameraPresetName[]];

/** Accept the legacy `diagonal` name used by the create tool. */
export function canonicalPreset(name: string): CameraPresetName | undefined {
  const n = name.toLowerCase();
  if (n === 'diagonal' || n === 'isometric') return 'iso';
  return n in CAMERA_PRESETS ? (n as CameraPresetName) : undefined;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Normalize an angle in degrees to (-180, 180]. */
export function normalizeDeg(a: number): number {
  const r = ((a % 360) + 360) % 360; // [0, 360)
  return r > 180 ? r - 360 : r;
}

/** Azimuth/elevation (deg) to model-viewer theta/phi (rad). */
export function orbitFromAzEl(azimuthDeg: number, elevationDeg: number): { theta: number; phi: number } {
  const el = clamp(elevationDeg, -90, 90);
  return { theta: normalizeDeg(azimuthDeg) / DEG, phi: (90 - el) / DEG };
}

export function azElFromOrbit(theta: number, phi: number): { azimuth: number; elevation: number } {
  const round = (x: number) => Math.round(x * 100) / 100;
  return { azimuth: round(normalizeDeg(theta * DEG)), elevation: round(90 - phi * DEG) };
}

export function presetOrbit(name: CameraPresetName): { theta: number; phi: number } {
  const p = CAMERA_PRESETS[name];
  return orbitFromAzEl(p.azimuth, p.elevation);
}

/** Name of the preset closest in angle to the given orbit (angular distance on the sphere). */
export function nearestPreset(theta: number, phi: number): { name: CameraPresetName; distanceDeg: number } {
  const dir = (t: number, p: number) => [Math.sin(p) * Math.sin(t), Math.cos(p), Math.sin(p) * Math.cos(t)];
  const d = dir(theta, phi);
  let best: { name: CameraPresetName; distanceDeg: number } = { name: 'iso', distanceDeg: Infinity };
  for (const name of CAMERA_PRESET_NAMES) {
    const o = presetOrbit(name);
    const q = dir(o.theta, o.phi);
    const dot = clamp(d[0] * q[0] + d[1] * q[1] + d[2] * q[2], -1, 1);
    const deg = Math.acos(dot) * DEG;
    if (deg < best.distanceDeg) best = { name, distanceDeg: deg };
  }
  return best;
}

export interface CameraRequest {
  view?: CameraPresetName;
  azimuth_deg?: number;
  elevation_deg?: number;
  /** 1 = frame the whole model; 2 = twice as close; 0.5 = twice as far. */
  zoom?: number;
  /** Absolute orbit radius in viewer scene units (see get_camera). */
  distance?: number;
  target?: { x: number; y: number; z: number } | 'auto';
  /** Field of view in degrees, or 'auto'. */
  field_of_view_deg?: number | 'auto';
  fit?: boolean;
}

export interface ResolvedCamera {
  theta: number;
  phi: number;
  /** Zoom relative to the fitted radius, or undefined to keep/override via distance. */
  zoom?: number;
  distance?: number;
  target?: { x: number; y: number; z: number } | 'auto';
  fov?: number | 'auto';
}

/**
 * Resolve a camera request against the current orbit. A preset gives both
 * angles; azimuth/elevation override either independently; with neither the
 * current angles are kept. `fit` means zoom 1 and target auto.
 */
export function resolveCamera(req: CameraRequest, current: { theta: number; phi: number }): ResolvedCamera {
  if (req.zoom != null && !(req.zoom > 0)) throw new ToolError(`zoom must be > 0 (got ${req.zoom})`);
  if (req.distance != null && !(req.distance > 0)) throw new ToolError(`distance must be > 0 (got ${req.distance})`);
  if (req.zoom != null && req.distance != null) throw new ToolError('Pass either zoom or distance, not both');
  if (typeof req.field_of_view_deg === 'number' && !(req.field_of_view_deg >= 10 && req.field_of_view_deg <= 120)) {
    throw new ToolError(`field_of_view_deg must be within 10..120 (got ${req.field_of_view_deg})`);
  }
  let { theta, phi } = current;
  if (req.view) {
    ({ theta, phi } = presetOrbit(req.view));
  }
  if (req.azimuth_deg != null || req.elevation_deg != null) {
    const cur = azElFromOrbit(theta, phi);
    ({ theta, phi } = orbitFromAzEl(req.azimuth_deg ?? cur.azimuth, req.elevation_deg ?? cur.elevation));
  }
  return {
    theta,
    phi,
    zoom: req.fit ? 1 : req.zoom,
    distance: req.fit ? undefined : req.distance,
    target: req.fit ? 'auto' : req.target,
    fov: req.field_of_view_deg,
  };
}

/** Relative orbit: rotate by deltas and scale distance (zoomFactor > 1 = closer). */
export function orbitDelta(
  current: { theta: number; phi: number; radius: number },
  d: { azimuth_deg?: number; elevation_deg?: number; zoom_factor?: number },
): { theta: number; phi: number; radius: number } {
  const cur = azElFromOrbit(current.theta, current.phi);
  const o = orbitFromAzEl(cur.azimuth + (d.azimuth_deg ?? 0), cur.elevation + (d.elevation_deg ?? 0));
  const zf = d.zoom_factor ?? 1;
  if (!(zf > 0)) throw new ToolError(`zoom_factor must be > 0 (got ${zf})`);
  return { theta: o.theta, phi: o.phi, radius: current.radius / zf };
}

/** Scale an image size so its larger side is at most `maxSize` (never upscales). */
export function fitSize(width: number, height: number, maxSize: number): { width: number; height: number } {
  const s = Math.min(1, maxSize / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)) };
}

// ─── Customizer parameters ──────────────────────────────────────────────

export interface ParamSchema {
  name: string;
  type: string;
  initial: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ name: string; value: number | string }>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function describeOptions(p: ParamSchema): string {
  return (p.options ?? []).map(o => `${JSON.stringify(o.value)}${String(o.value) !== o.name ? ` (${o.name})` : ''}`).join(', ');
}

/**
 * Validate (and normalize) a value for a customizer parameter. Dropdown
 * options may be given by value or by label. Throws a ToolError naming the
 * parameter and the allowed options / range.
 */
export function validateParameterValue(p: ParamSchema, value: unknown): unknown {
  const bad = (why: string): never => { throw new ToolError(`${p.name}: ${why}`); };
  if (p.options?.length) {
    const hit = p.options.find(o => same(o.value, value)) ?? (typeof value === 'string' ? p.options.find(o => o.name.toLowerCase() === value.toLowerCase()) : undefined);
    if (!hit) bad(`${JSON.stringify(value)} is not one of the allowed options: ${describeOptions(p)}`);
    return hit!.value;
  }
  if (p.type === 'boolean') {
    if (typeof value !== 'boolean') bad(`expected a boolean (true/false), got ${JSON.stringify(value)}`);
    return value;
  }
  if (p.type === 'string') {
    if (typeof value !== 'string') bad(`expected a string, got ${JSON.stringify(value)}`);
    return value;
  }
  const inRange = (n: number) => (p.min == null || n >= p.min) && (p.max == null || n <= p.max);
  const range = `${p.min ?? '-inf'}..${p.max ?? 'inf'}`;
  if (Array.isArray(p.initial)) {
    const want = p.initial.length;
    if (!Array.isArray(value) || value.length !== want || value.some(v => typeof v !== 'number' || !Number.isFinite(v))) {
      bad(`expected an array of ${want} numbers, got ${JSON.stringify(value)}`);
    }
    if ((value as number[]).some(v => !inRange(v))) bad(`every component must be within ${range}, got ${JSON.stringify(value)}`);
    return value;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) bad(`expected a number, got ${JSON.stringify(value)}`);
  if (!inRange(value as number)) bad(`${value} is out of range ${range}`);
  return value;
}

/** Validate a name->value map; collects every error (one line per parameter) instead of stopping at the first. */
export function validateParameterValues(schema: ParamSchema[], values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const errors: string[] = [];
  const known = schema.map(p => p.name);
  for (const [name, value] of Object.entries(values)) {
    const p = schema.find(s => s.name === name);
    if (!p) {
      errors.push(`${name}: unknown parameter. Known: ${known.join(', ') || '(none; the active file has no customizer parameters)'}`);
      continue;
    }
    try {
      out[name] = validateParameterValue(p, value);
    } catch (e) {
      if (e instanceof ToolError) errors.push(e.message); else throw e;
    }
  }
  if (errors.length) throw new ToolError(`No parameter was changed.\n${errors.map(e => `  ${e}`).join('\n')}`);
  return out;
}
