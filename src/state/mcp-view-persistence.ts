/**
 * Where the viewer's state is persisted: the host (EXPERIMENTAL) and/or
 * localStorage. The ONLY file that touches the draft host API.
 *
 * Host path: proposed MCP Apps `ui/set-view-state`
 * (https://github.com/modelcontextprotocol/ext-apps/pull/844, DRAFT, not in
 * @modelcontextprotocol/ext-apps 2.1.0). It may change or never ship, so it is
 * used only when ALL of these hold, checked on every call:
 *   - `typeof app.setViewState === 'function'` (the SDK knows the method; we
 *     never send a raw `ui/set-view-state` ourselves),
 *   - `app.getHostCapabilities()?.viewState.maxBytes` is a number,
 *   - `app.getHostContext()` has a `viewState` key (null means "nothing saved").
 * Any failure (throw, -32601/-32602/-32603, timeout) turns the host path off
 * for the rest of the session with a single console.warn; there are no retries.
 * Whatever the host hands back is only trusted if it is a plain object carrying
 * our version (`v: 1`, see mcp-viewstate.ts); anything else is ignored.
 *
 * localStorage is the baseline and is written on every save (even when the host
 * path works) so that a host that lost its copy still restores. It is keyed by
 * the server's `viewUUID` (tool result `_meta.viewUUID`, the ext-apps Patterns
 * guide recommendation). Reads prefer the host copy. Nothing here throws.
 *
 * To remove the experiment: delete the `host*` members below.
 */
import { VIEW_STATE_MAX_BYTES, loadLocal, parseViewState, safeLocalStorage, saveLocal, serializeViewState, type KeyValueStorage, type ViewState } from './mcp-viewstate.ts';

/** The slice of `App` used here; every member is feature-detected. */
export interface PersistenceApp {
  getHostCapabilities?(): unknown;
  getHostContext?(): unknown;
  setViewState?(state: Record<string, unknown> | null, options?: { timeout?: number }): Promise<unknown>;
}

export interface PersistenceOptions {
  storage?: KeyValueStorage | null;
  /** Give up on a host save after this long. */
  timeoutMs?: number;
  warn?: (message: string) => void;
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;

/** localStorage key for a view instance. `base` separates deployments sharing an origin. */
export function storageKeyFor(viewUUID: string, base = ''): string {
  return `openscad-mcp-view:${base}:${viewUUID}`;
}

/** `_meta.viewUUID` of a tool result, if the server sent a sane one. */
export function readViewUUID(result: unknown): string | undefined {
  try {
    const id = (result as { _meta?: { viewUUID?: unknown } } | undefined)?._meta?.viewUUID;
    return typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : undefined;
  } catch {
    return undefined;
  }
}

export class ViewPersistence {
  private hostDisabled = false;
  private warned = false;
  private storage: KeyValueStorage | null;
  private timeoutMs: number;
  private warn: (m: string) => void;

  constructor(private app: PersistenceApp, opts: PersistenceOptions = {}) {
    this.storage = opts.storage === undefined ? safeLocalStorage() : opts.storage;
    this.timeoutMs = opts.timeoutMs ?? 4000;
    this.warn = opts.warn ?? (m => console.warn(m));
  }

  /** `maxBytes` when the host path is usable right now, else undefined. */
  get hostMaxBytes(): number | undefined {
    if (this.hostDisabled) return undefined;
    try {
      if (typeof this.app.setViewState !== 'function') return undefined;
      const max = (this.app.getHostCapabilities?.() as { viewState?: { maxBytes?: unknown } } | undefined)?.viewState?.maxBytes;
      if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return undefined;
      const ctx = this.app.getHostContext?.();
      if (!ctx || typeof ctx !== 'object' || !('viewState' in ctx)) return undefined;
      return max;
    } catch {
      return undefined;
    }
  }

  /** The state the host kept, if the host path is usable and it looks like ours. */
  readHost(): ViewState | null {
    if (this.hostMaxBytes === undefined) return null;
    try {
      const raw = (this.app.getHostContext!() as { viewState?: unknown }).viewState;
      return isPlainObject(raw) ? parseViewState(raw) : null;
    } catch {
      return null;
    }
  }

  readLocal(key: string | null): ViewState | null {
    return key ? parseViewState(loadLocal(key, this.storage)) : null;
  }

  /** Candidates in precedence order (host, then localStorage), for chooseRestore. */
  candidates(key: string | null): Array<ViewState | null> {
    return [this.readHost(), this.readLocal(key)];
  }

  /**
   * Save `state`: always to localStorage (when `key` is known), and to the host
   * when usable, trimmed to the host's `maxBytes` (the screenshot-like and large
   * parts go first; screenshots are never part of the state). Resolves true if
   * the host accepted it.
   */
  async save(state: ViewState, key: string | null): Promise<boolean> {
    const local = serializeViewState(state, VIEW_STATE_MAX_BYTES);
    if (key && local) saveLocal(key, local, this.storage);
    const max = this.hostMaxBytes;
    if (max === undefined) return false;
    const json = serializeViewState(state, Math.min(max, VIEW_STATE_MAX_BYTES));
    if (!json) return false; // cannot fit even trimmed: leave the host copy alone
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.app.setViewState!(JSON.parse(json), { timeout: this.timeoutMs }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), this.timeoutMs); }),
      ]);
      return true;
    } catch (e) {
      this.hostDisabled = true;
      if (!this.warned) {
        this.warned = true;
        const err = e as { code?: number; message?: string };
        this.warn(`[view-state] host persistence disabled, using localStorage (${err?.code ?? ''} ${err?.message ?? e})`);
      }
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
