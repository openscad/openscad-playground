/**
 * Best-effort persistence of the viewer's state across reloads/remounts, in
 * the host and in localStorage (see mcp-view-persistence.ts for where and how;
 * this file is DOM-free logic for tests). Nothing here may throw into the app.
 *
 * Restore rule (decided when the tool RESULT arrives): the saved state names
 * the view instance it belongs to (`inv`): `uuid:<viewUUID>` when the server
 * sent `_meta.viewUUID`, else a fingerprint of the tool input (older servers).
 * It is restored only for the SAME view instance (a reload or replay of the
 * original tool call), where the user's later edits win over the tool's own
 * source/vars/camera. A new tool call has a new viewUUID, so it starts fresh
 * and never sees stale state. Among same-instance states: host > localStorage.
 * File entrypoints (open_scad_file) never restore: the host file wins.
 */

export const VIEW_STATE_VERSION = 1;
/** Hard cap on the serialized state. */
export const VIEW_STATE_MAX_BYTES = 64 * 1024;

export interface ViewStateCamera {
  theta: number;
  phi: number;
  radius?: number;
  target?: { x: number; y: number; z: number };
  fov?: number;
}

export interface ViewState {
  v: 1;
  /** Fingerprint of the tool invocation that produced the state (see {@link fingerprint}). */
  inv?: string;
  files?: Array<{ path: string; content: string }>;
  active?: string;
  vars?: Record<string, unknown>;
  camera?: ViewStateCamera;
  embed?: boolean;
  overlay?: boolean;
  axes?: boolean;
}

/** Stable short hash of a tool invocation's explicit input. */
export function fingerprint(input: unknown): string {
  const stable = (v: unknown): unknown => v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : 1).map(([k, x]) => [k, stable(x)]))
    : Array.isArray(v) ? v.map(stable) : v;
  const s = JSON.stringify(stable(input ?? {}));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
}

const byteLength = (s: string) => new TextEncoder().encode(s).length;

/**
 * Serialize within the cap, dropping the biggest pieces first: source files
 * (largest first), then the camera/vars. Never throws; returns undefined only
 * if even the minimal state cannot be produced.
 */
export function serializeViewState(state: ViewState, maxBytes = VIEW_STATE_MAX_BYTES): string | undefined {
  try {
    const work: ViewState = { ...state, v: VIEW_STATE_VERSION, files: state.files ? [...state.files] : undefined };
    let json = JSON.stringify(work);
    while (byteLength(json) > maxBytes && work.files?.length) {
      let big = 0;
      work.files.forEach((f, i) => { if (f.content.length > work.files![big].content.length) big = i; });
      work.files.splice(big, 1);
      if (!work.files.length) { delete work.files; delete work.active; }
      json = JSON.stringify(work);
    }
    for (const key of ['vars', 'camera'] as const) {
      if (byteLength(json) <= maxBytes) break;
      delete work[key];
      json = JSON.stringify(work);
    }
    return byteLength(json) <= maxBytes ? json : undefined;
  } catch {
    return undefined;
  }
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Validate untrusted input (string or object); null when unusable or from another version. */
export function parseViewState(raw: unknown): ViewState | null {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!o || typeof o !== 'object' || (o as { v?: unknown }).v !== VIEW_STATE_VERSION) return null;
    const r = o as Record<string, any>;
    const out: ViewState = { v: 1 };
    if (typeof r.inv === 'string') out.inv = r.inv;
    if (Array.isArray(r.files)) {
      const files = r.files.filter((f: any) => f && typeof f.path === 'string' && typeof f.content === 'string').map((f: any) => ({ path: f.path, content: f.content }));
      if (files.length) {
        out.files = files;
        if (typeof r.active === 'string' && files.some((f: { path: string }) => f.path === r.active)) out.active = r.active;
      }
    }
    if (r.vars && typeof r.vars === 'object' && !Array.isArray(r.vars)) out.vars = r.vars;
    const c = r.camera;
    if (c && isNum(c.theta) && isNum(c.phi)) {
      out.camera = { theta: c.theta, phi: c.phi };
      if (isNum(c.radius) && c.radius > 0) out.camera.radius = c.radius;
      if (isNum(c.fov) && c.fov > 0) out.camera.fov = c.fov;
      if (c.target && isNum(c.target.x) && isNum(c.target.y) && isNum(c.target.z)) out.camera.target = { x: c.target.x, y: c.target.y, z: c.target.z };
    }
    if (typeof r.embed === 'boolean') out.embed = r.embed;
    if (typeof r.overlay === 'boolean') out.overlay = r.overlay;
    if (typeof r.axes === 'boolean') out.axes = r.axes;
    return out;
  } catch {
    return null;
  }
}

/**
 * Pick the state to restore: host before localStorage, but only a state that
 * belongs to this very invocation (matching fingerprint).
 */
export function chooseRestore(invocation: string, candidates: Array<unknown>): ViewState | null {
  for (const c of candidates) {
    const s = parseViewState(c);
    if (s && s.inv === invocation) return s;
  }
  return null;
}

// ─── Storage adapters (never throw) ─────────────────────────────────────

export interface KeyValueStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function safeLocalStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    return s ?? null;
  } catch {
    return null; // blocked or partitioned in the sandboxed iframe
  }
}

export function loadLocal(key: string, storage: KeyValueStorage | null = safeLocalStorage()): string | null {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

export function saveLocal(key: string, json: string, storage: KeyValueStorage | null = safeLocalStorage()): boolean {
  try { storage?.setItem(key, json); return !!storage; } catch { return false; }
}

/**
 * Debounced saver: `request()` after every state change; `flush()` on
 * pagehide/visibilitychange. `collect` gathers the current state.
 */
export class ViewStateSaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last: string | undefined;

  constructor(
    private collect: () => Promise<ViewState | null> | ViewState | null,
    private sinks: Array<(json: string, state: ViewState) => unknown>,
    private debounceMs = 700,
  ) {}

  request(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try {
      const state = await this.collect();
      if (!state) return;
      const json = serializeViewState(state);
      if (!json || json === this.last) return;
      this.last = json;
      for (const sink of this.sinks) {
        try { await sink(json, state); } catch { /* best effort */ }
      }
    } catch { /* best effort */ }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
