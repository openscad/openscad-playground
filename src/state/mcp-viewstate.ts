/**
 * Best-effort persistence of the viewer's state across reloads/remounts, in
 * two places: the host (a `ui/set-view-state` request plus an initial
 * `viewState` handed to the view) and localStorage. DOM-free for tests.
 *
 * The host API is NOT standardised yet (modelcontextprotocol/ext-apps#417, no
 * names in SDK 2.1.0 or the draft spec), so the names below are assumptions,
 * used defensively: reads look at `hostContext.viewState` then
 * `hostInfo.viewState`; writes use the request `ui/set-view-state`
 * `{viewState}` and stop for good after the first "method not found" (or
 * repeated timeouts). Nothing here may throw into the app.
 *
 * Restore precedence on mount: this invocation's explicit tool input (a
 * deliberate create({source}) or file entrypoint) > host viewState >
 * localStorage > defaults. "Explicit input wins" is decided by fingerprint:
 * the saved state records the fingerprint of the invocation that produced it;
 * it is restored only when the mount carries the SAME invocation (a reload or
 * replay of the original tool call), where the user's later edits should
 * win. A different invocation never gets stale state.
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

/** The slice of App used for host persistence. */
export interface ViewStateHostApp {
  getHostContext(): unknown;
  getHostVersion(): unknown;
  /** Non-spec methods need a result schema (SDK 2.x): `request(req, resultSchema, options)`. */
  request(req: { method: string; params: unknown }, resultSchema: unknown, options?: unknown): Promise<unknown>;
}

/** Initial state the host handed over, if any (assumed names; see file header). */
export function readHostViewState(app: ViewStateHostApp): unknown {
  try {
    return (app.getHostContext() as { viewState?: unknown } | undefined)?.viewState
      ?? (app.getHostVersion() as { viewState?: unknown } | undefined)?.viewState;
  } catch {
    return undefined;
  }
}

/** Writes to the host; feature-detects once and gives up after a method-not-found. */
export class HostViewStateWriter {
  private disabled = false;
  private failures = 0;
  /** Last failure, for diagnostics. */
  lastError: string | undefined;
  constructor(private app: ViewStateHostApp, private resultSchema: unknown, private timeoutMs = 3000) {}

  get enabled(): boolean { return !this.disabled; }

  async write(json: string): Promise<boolean> {
    if (this.disabled) return false;
    try {
      await this.app.request({ method: 'ui/set-view-state', params: { viewState: JSON.parse(json) } }, this.resultSchema, { timeout: this.timeoutMs });
      this.failures = 0;
      return true;
    } catch (e) {
      const err = e as { code?: number; message?: string };
      this.lastError = err?.message ?? String(e);
      if (err?.code === -32601 || /method not found|not supported|unknown method|no handler|no schema/i.test(err?.message ?? '')) this.disabled = true;
      else if (++this.failures >= 3) this.disabled = true;
      return false;
    }
  }
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
    private sinks: Array<(json: string) => unknown>,
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
        try { await sink(json); } catch { /* best effort */ }
      }
    } catch { /* best effort */ }
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
