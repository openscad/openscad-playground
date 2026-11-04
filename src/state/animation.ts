/**
 * Animation playback: renders the frames of a `$t`-driven model one by one
 * (preview mode, `-D$t=<t>`), caches them (see animation-cache.ts) and loops
 * over the cached frames. See docs/ANIMATION.md.
 *
 * The controller is DOM-free; everything environment specific (rendering, the
 * viewer, the clock) comes in through {@link AnimationHost} and
 * {@link AnimationTimers}, so the playback rules are unit tested
 * (server/test-animation.ts).
 *
 * Rules:
 *  - Frames are rendered in the background only while playing (look-ahead from
 *    the current frame, bounded by the cache), or on demand for a scrubbed-to
 *    frame, one render at a time.
 *  - The displayed model is only swapped when the next frame is ready AND the
 *    viewer reported the previous one loaded (no flicker, no frame pile-up).
 *  - Playback never advances onto a frame that is not ready: it waits for it
 *    (the first lap runs at the render speed, later laps at the set fps).
 *  - Normal renders (edits, Render) have priority: the in-flight frame render is
 *    killed and background rendering waits until the host is idle again.
 */

import { AbortablePromise, SupersededError } from '../utils.ts';
import { FrameCache, frameKey } from './animation-cache.ts';

export interface AnimationSettings {
  /** Number of frames in one loop; frame i is rendered at $t = i / steps. */
  steps: number;
  fps: number;
}

export const MIN_STEPS = 2;
export const MAX_STEPS = 360;
export const MIN_FPS = 1;
export const MAX_FPS = 60;

export const DEFAULT_SETTINGS: AnimationSettings = { steps: 30, fps: 15 };
/** wasm2js is an order of magnitude slower: a short loop, rendered a frame or two ahead. */
export const DEFAULT_SETTINGS_SLOW: AnimationSettings = { steps: 8, fps: 4 };

export const FRAME_CACHE_MAX_ENTRIES = 240;
export const FRAME_CACHE_MAX_BYTES = 96 * 1024 * 1024;
/** Longest wait for the viewer to report a swapped model as loaded. */
export const LOAD_TIMEOUT_MS = 1500;
/** Scrubbing: render the requested frame once the slider rested this long. */
export const SEEK_DEBOUNCE_MS = 120;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function clampSettings(s: Partial<AnimationSettings> | undefined, defaults: AnimationSettings = DEFAULT_SETTINGS): AnimationSettings {
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    steps: Math.round(clamp(num(s?.steps, defaults.steps), MIN_STEPS, MAX_STEPS)),
    fps: Math.round(clamp(num(s?.fps, defaults.fps), MIN_FPS, MAX_FPS) * 100) / 100,
  };
}

/** Validate user-supplied settings (URL, view state): only the valid fields survive; undefined when none do. */
export function normalizeStoredSettings(raw: unknown): { steps?: number; fps?: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: { steps?: number; fps?: number } = {};
  if (typeof r.steps === 'number' && Number.isFinite(r.steps)) out.steps = clampSettings({ steps: r.steps }).steps;
  if (typeof r.fps === 'number' && Number.isFinite(r.fps)) out.fps = clampSettings({ fps: r.fps }).fps;
  return out.steps === undefined && out.fps === undefined ? undefined : out;
}

/** Frame index (0..steps-1) of animation time t (0 <= t < 1; wraps). */
export function frameAt(t: number, steps: number): number {
  const i = Math.round(t * steps) % steps;
  return i < 0 ? i + steps : i;
}

/** Index of the cached frame closest to `index` on the loop (ties go backwards), or undefined when none is cached. */
export function nearestCached(index: number, steps: number, isCached: (i: number) => boolean): number | undefined {
  for (let d = 0; d <= steps / 2; d++) {
    const back = ((index - d) % steps + steps) % steps;
    if (isCached(back)) return back;
    const fwd = (index + d) % steps;
    if (isCached(fwd)) return fwd;
  }
  return undefined;
}

export const loopSeconds = (s: AnimationSettings) => s.steps / s.fps;

/** What the controller stores per frame; hosts add their own fields. */
export interface AnimationFrame {
  bytes: number;
  /** URL the viewer loads for this frame (when equal to the current one, no load event will follow). */
  url?: string;
}

export interface AnimationHost<F extends AnimationFrame> {
  settings(): AnimationSettings;
  /** Render the frame at animation time `t`. Must reject with SupersededError when killed. */
  renderFrame(t: number): AbortablePromise<F>;
  /** Display a frame. */
  show(frame: F, index: number): void;
  /** Free what a frame holds (object URLs). */
  release(frame: F): void;
  /** A normal (edit / Render) render is running: do not compete with it. */
  busy(): boolean;
  /** The page is not visible: do not burn CPU. */
  hidden(): boolean;
  /** Mirror the controller state for the UI. */
  publish(s: { playing: boolean; frame: number; ready: number }): void;
  /** A frame failed to render. */
  error(e: unknown): void;
  /** Frames rendered ahead of the displayed one while playing (bounded by the cache). */
  lookahead(): number;
}

export interface AnimationTimers {
  now(): number;
  setTimeout(f: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const realTimers: AnimationTimers = {
  now: () => Date.now(),
  setTimeout: (f, ms) => setTimeout(f, ms),
  clearTimeout: id => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export class AnimationController<F extends AnimationFrame> {
  readonly cache: FrameCache<F>;
  private key = '';
  /** Slider position: the frame shown, or the one being waited for after a seek. */
  private frame = 0;
  private playing = false;
  private seekTarget: number | null = null;
  private inflight: { index: number; job: AbortablePromise<F> } | null = null;
  private tickTimer: unknown = null;
  private seekTimer: unknown = null;
  private loadTimer: unknown = null;
  private awaitingLoad = false;
  private stalled = false;
  private lastShownAt = -Infinity;
  private lastUrl: string | undefined;
  private shownIndex = -1;
  private disposed = false;
  private maxEntries: number;

  constructor(private host: AnimationHost<F>, private timers: AnimationTimers = realTimers,
              limits: { maxEntries?: number; maxBytes?: number } = {}) {
    this.maxEntries = limits.maxEntries ?? FRAME_CACHE_MAX_ENTRIES;
    this.cache = new FrameCache<F>({
      maxEntries: this.maxEntries,
      maxBytes: limits.maxBytes ?? FRAME_CACHE_MAX_BYTES,
      onEvict: (_k, f) => this.host.release(f),
    });
  }

  get isPlaying() { return this.playing; }
  get currentFrame() { return this.frame; }
  /** The frame index currently displayed by the controller (-1: none, e.g. after a normal render replaced it). */
  get shown() { return this.shownIndex; }
  get hasInflight() { return this.inflight != null; }
  get t() { return this.frame / this.host.settings().steps; }

  private steps() { return this.host.settings().steps; }
  private keyOf(index: number) { return frameKey(this.key, index / this.steps()); }
  private isCached = (index: number) => this.cache.has(this.keyOf(index));

  private ready(): number {
    let n = 0;
    for (let i = 0, steps = this.steps(); i < steps; i++) if (this.isCached(i)) n++;
    return n;
  }
  private publish() { this.host.publish({ playing: this.playing, frame: this.frame, ready: this.ready() }); }

  // ── Invalidation ─────────────────────────────────────────────────────

  /**
   * The project changed (sources, customizer values, features): drop every frame, stop rendering and playing.
   * Returns whether anything changed.
   */
  invalidate(key: string): boolean {
    if (key === this.key) return false;
    this.key = key;
    this.stop();
    this.cache.clear();
    this.lastUrl = undefined;
    this.shownIndex = -1;
    this.publish();
    return true;
  }

  /** Pause and cancel every pending or running render and timer. */
  private stop() {
    this.playing = false;
    this.seekTarget = null;
    this.stalled = false;
    this.awaitingLoad = false;
    this.clearTimers();
    this.killInflight();
  }

  private clearTimers() {
    for (const k of ['tickTimer', 'seekTimer', 'loadTimer'] as const) {
      if (this[k] != null) { this.timers.clearTimeout(this[k]); this[k] = null; }
    }
  }

  private killInflight() {
    const inflight = this.inflight;
    this.inflight = null;
    inflight?.job.kill();
  }

  /** A normal render starts: yield. Background rendering resumes with {@link resume}. */
  yieldToRender() { this.killInflight(); this.lastUrl = undefined; this.shownIndex = -1; }
  /** A normal render ended. */
  resume() { this.pump(); }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.stalled = false;
    if (this.tickTimer != null) { this.timers.clearTimeout(this.tickTimer); this.tickTimer = null; }
    // Look-ahead renders are no longer wanted; an on-demand seek render still is.
    if (this.inflight && this.inflight.index !== this.seekTarget) this.killInflight();
    this.publish();
  }

  // ── Playback ─────────────────────────────────────────────────────────

  play() {
    if (this.playing || this.disposed) return;
    this.playing = true;
    this.seekTarget = null;
    this.lastShownAt = -Infinity;
    this.publish();
    this.kick();
    this.pump();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  /** Time between two frames. */
  private interval() { return 1000 / this.host.settings().fps; }

  /** (Re)arm the tick that advances to the next frame. */
  private kick() {
    if (!this.playing || this.awaitingLoad || this.tickTimer != null) return;
    const wait = Math.max(0, this.lastShownAt + this.interval() - this.timers.now());
    this.tickTimer = this.timers.setTimeout(() => { this.tickTimer = null; this.tick(); }, wait);
  }

  private tick() {
    if (!this.playing) return;
    if (this.host.hidden()) { this.tickTimer = this.timers.setTimeout(() => { this.tickTimer = null; this.tick(); }, 500); return; }
    const next = (this.frame + 1) % this.steps();
    const frame = this.cache.get(this.keyOf(next));
    if (!frame) { this.stalled = true; this.pump(); return; }
    this.stalled = false;
    this.frame = next;
    this.display(frame, next);
    this.publish();
    this.kick();
    this.pump();
  }

  private display(frame: F, index: number) {
    this.host.show(frame, index);
    this.shownIndex = index;
    this.lastShownAt = this.timers.now();
    this.awaitingLoad = frame.url == null || frame.url !== this.lastUrl;
    this.lastUrl = frame.url;
    if (this.loadTimer != null) this.timers.clearTimeout(this.loadTimer);
    this.loadTimer = this.awaitingLoad
      ? this.timers.setTimeout(() => { this.loadTimer = null; this.notifyLoaded(); }, LOAD_TIMEOUT_MS)
      : null;
  }

  /** The viewer finished loading the displayed model. */
  notifyLoaded() {
    if (this.loadTimer != null) { this.timers.clearTimeout(this.loadTimer); this.loadTimer = null; }
    if (!this.awaitingLoad) return;
    this.awaitingLoad = false;
    this.kick();
  }

  // ── Scrubbing ────────────────────────────────────────────────────────

  /**
   * Go to a frame (slider / tools). Pauses. A cached frame shows at once; otherwise the nearest cached one stands in
   * while the requested frame is rendered on demand (debounced, so a drag only renders where it rests).
   */
  seek(index: number) {
    if (this.disposed) return;
    const steps = this.steps();
    index = ((Math.round(index) % steps) + steps) % steps;
    this.pause();
    this.frame = index;
    if (this.seekTimer != null) { this.timers.clearTimeout(this.seekTimer); this.seekTimer = null; }
    const cached = this.cache.get(this.keyOf(index));
    if (cached) {
      this.seekTarget = null;
      if (this.inflight) this.killInflight();
      this.display(cached, index);
    } else {
      this.seekTarget = index;
      if (this.inflight && this.inflight.index !== index) this.killInflight();
      const near = nearestCached(index, steps, this.isCached);
      const stand = near === undefined ? undefined : this.cache.peek(this.keyOf(near));
      if (stand && stand.url !== this.lastUrl) this.display(stand, near!);
      this.seekTimer = this.timers.setTimeout(() => { this.seekTimer = null; this.pump(); }, SEEK_DEBOUNCE_MS);
    }
    this.publish();
  }

  /** The settings (steps) changed: keep the animation time. */
  retime(t: number) {
    this.frame = frameAt(t, this.steps());
    this.lastUrl = undefined;
    this.cache.get(this.keyOf(this.frame)); // (touch)
    if (this.playing) { this.killInflight(); this.pump(); }
    else if (!this.isCached(this.frame)) this.seek(this.frame);
    this.publish();
  }

  // ── Background rendering ─────────────────────────────────────────────

  private wanted(): number[] {
    const out: number[] = [];
    if (this.seekTarget != null && this.seekTimer == null && !this.isCached(this.seekTarget)) out.push(this.seekTarget);
    if (this.playing) {
      const steps = this.steps();
      const ahead = Math.max(1, Math.min(steps - 1, this.host.lookahead(), this.maxEntries - 2)); // (never evict what is about to be shown)
      for (let k = 1; k <= ahead; k++) {
        const i = (this.frame + k) % steps;
        if (!this.isCached(i)) out.push(i);
      }
    }
    return out;
  }

  private pump() {
    if (this.disposed || this.host.busy()) return;
    if (this.host.hidden() && this.seekTarget == null) return;
    const wanted = this.wanted();
    if (this.inflight) {
      // Keep the running render only if it is still the most urgent one.
      if (wanted[0] === this.inflight.index || (wanted.includes(this.inflight.index) && this.seekTarget == null)) return;
      this.killInflight();
    }
    if (wanted.length) this.start(wanted[0]);
  }

  private start(index: number) {
    const key = this.key;
    const frameK = this.keyOf(index);
    let job: AbortablePromise<F>;
    try {
      job = this.host.renderFrame(index / this.steps());
    } catch (e) {
      this.fail(e);
      return;
    }
    this.inflight = { index, job };
    job.then(frame => {
      if (this.inflight?.job !== job || this.key !== key || this.disposed) { this.host.release(frame); return; }
      this.inflight = null;
      this.cache.set(frameK, frame);
      if (this.seekTarget === index) {
        this.seekTarget = null;
        this.display(frame, index);
      } else if (this.stalled && this.playing) {
        this.stalled = false;
        this.kick();
      }
      this.publish();
      this.pump();
    }, err => {
      if (this.inflight?.job === job) this.inflight = null;
      if (err instanceof SupersededError || this.key !== key || this.disposed) return;
      this.fail(err);
    });
  }

  private fail(e: unknown) {
    this.stop();
    this.publish();
    this.host.error(e);
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.cache.clear();
  }
}
