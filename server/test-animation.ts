/**
 * Unit tests for animation support: `$t` detection (src/state/animation-detect.ts), the frame cache
 * (animation-cache.ts) and the playback controller (animation.ts) driven by a fake renderer and a fake clock.
 * Run with: npm test.
 */
import assert from "node:assert/strict";
import { projectUsesAnimationTime, stripCommentsAndStrings, usesAnimationTime } from "../src/state/animation-detect.ts";
import { FrameCache, frameKey, projectKey } from "../src/state/animation-cache.ts";
import {
  AnimationController, clampSettings, frameAt, nearestCached, normalizeStoredSettings, SEEK_DEBOUNCE_MS, LOAD_TIMEOUT_MS,
  type AnimationFrame, type AnimationHost, type AnimationSettings, type AnimationTimers,
} from "../src/state/animation.ts";
import { AbortablePromise, SupersededError } from "../src/utils.ts";

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log(`  ✓ ${name}`); };

// ─── Fake clock ─────────────────────────────────────────────────────────

class FakeClock implements AnimationTimers {
  time = 1000;
  private seq = 0;
  private timers = new Map<number, { at: number; f: () => void }>();
  now() { return this.time; }
  setTimeout(f: () => void, ms: number) { const id = ++this.seq; this.timers.set(id, { at: this.time + ms, f }); return id; }
  clearTimeout(id: unknown) { this.timers.delete(id as number); }
  /** Advance the clock, firing due timers in order. */
  async advance(ms: number) {
    const end = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      this.timers.delete(due[0]);
      this.time = Math.max(this.time, due[1].at);
      due[1].f();
      await flush();
    }
    this.time = end;
    await flush();
  }
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

// ─── Fake host ──────────────────────────────────────────────────────────

interface TestFrame extends AnimationFrame { t: number; released?: boolean }

function makeHost(clock: FakeClock, settings: AnimationSettings = { steps: 4, fps: 10 }) {
  const log = {
    rendered: [] as number[], shown: [] as number[], released: [] as number[], published: [] as any[], errors: [] as unknown[],
    killed: 0, busy: false, hidden: false,
  };
  const pending: Array<{ t: number; resolve: () => void; fail: (e: unknown) => void }> = [];
  const host: AnimationHost<TestFrame> = {
    settings: () => settings,
    renderFrame: t => {
      log.rendered.push(t);
      return AbortablePromise<TestFrame>((resolve, reject) => {
        const entry = { t, resolve: () => resolve({ t, bytes: 10, url: `frame:${t}` }), fail: reject };
        pending.push(entry);
        return () => { log.killed++; pending.splice(pending.indexOf(entry), 1); reject(new SupersededError()); };
      });
    },
    show: (f, i) => log.shown.push(i),
    release: f => log.released.push(f.t),
    busy: () => log.busy,
    hidden: () => log.hidden,
    publish: s => log.published.push(s),
    error: e => log.errors.push(e),
    lookahead: () => 8,
  };
  /** Complete the oldest pending render. */
  const finish = async () => { pending.shift()!.resolve(); await flush(); await clock.advance(0); };
  const finishAll = async () => { while (pending.length) await finish(); };
  return { host, log, pending, finish, finishAll, settings };
}

async function main() {
  console.log("animation tests");

  // ─── Detection ────────────────────────────────────────────────────────
  await test("detects $t as a whole identifier in code", () => {
    assert.ok(usesAnimationTime("rotate([0, 0, $t * 360]) cube(5);"));
    assert.ok(usesAnimationTime("a=$t;"));
    assert.ok(usesAnimationTime("x = sin($t*360);"));
    assert.ok(!usesAnimationTime("cube(5);"));
    assert.ok(!usesAnimationTime("$fn = 32; sphere(3, $fn=12);"));
    assert.ok(!usesAnimationTime("a = $tx + $t2 + $total;"), "other special variables are not $t");
  });
  await test("ignores comments and strings", () => {
    assert.ok(!usesAnimationTime("// animate with $t\ncube(1);"));
    assert.ok(!usesAnimationTime("/* $t\n $t */ cube(1);"));
    assert.ok(!usesAnimationTime('echo("time is $t"); cube(1);'));
    assert.ok(!usesAnimationTime('echo("quote \\" $t"); cube(1);'));
    assert.ok(usesAnimationTime('echo("x"); // c\ncube($t);'), "code after a comment/string still counts");
    assert.ok(usesAnimationTime('/* a */ /* b */ s = "x"; rotate($t);'));
    assert.equal(stripCommentsAndStrings("a/*x\ny*/b").split("\n").length, 2, "newlines are kept");
  });
  await test("follows include/use of project files, not libraries", () => {
    const src = (path: string, content: string) => ({ path, content });
    const sources = [
      src("/main.scad", "include <lib/anim.scad>\nuse </other.scad>\nspin();"),
      src("/lib/anim.scad", "module spin() { rotate($t*360) cube(2); }"),
      src("/other.scad", "module x() {}"),
    ];
    assert.ok(projectUsesAnimationTime(sources, "/main.scad"));
    assert.ok(!projectUsesAnimationTime(sources, "/other.scad"), "only files reachable from the active one");
    assert.ok(!projectUsesAnimationTime([src("/main.scad", "include <MCAD/boxes.scad>\ncube(1);")], "/main.scad"), "unknown (library) files are skipped");
    assert.ok(!projectUsesAnimationTime([src("/main.scad", "// include <lib.scad>\ncube(1);"), src("/lib.scad", "$t")], "/main.scad"), "commented include");
    assert.ok(projectUsesAnimationTime([src("/a/main.scad", "include <../b.scad>"), src("/b.scad", "x=$t;")], "/a/main.scad"), "relative to the including file");
    assert.ok(!projectUsesAnimationTime([{ path: "/model.stl", content: "$t" }], "/model.stl"), "not a .scad");
  });
  await test("include cycles terminate", () => {
    const sources = [{ path: "/a.scad", content: "include <b.scad>" }, { path: "/b.scad", content: "include <a.scad>" }];
    assert.ok(!projectUsesAnimationTime(sources, "/a.scad"));
  });

  // ─── Cache ────────────────────────────────────────────────────────────
  await test("frame cache: LRU by entries and bytes, eviction callback", () => {
    const evicted: string[] = [];
    const cache = new FrameCache<{ bytes: number }>({ maxEntries: 3, maxBytes: 100, onEvict: k => evicted.push(k) });
    cache.set("a", { bytes: 10 }); cache.set("b", { bytes: 10 }); cache.set("c", { bytes: 10 });
    cache.get("a"); // a is now the most recently used
    cache.set("d", { bytes: 10 });
    assert.deepEqual(evicted, ["b"]);
    assert.deepEqual(cache.keys(), ["c", "a", "d"]);
    cache.set("e", { bytes: 95 }); // over the byte budget: evict until it fits
    assert.deepEqual(cache.keys(), ["e"]);
    assert.equal(cache.bytes, 95);
    cache.set("e", { bytes: 5 }); // replacing releases the old value
    assert.equal(evicted.filter(k => k === "e").length, 1);
    assert.equal(cache.bytes, 5);
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.bytes, 0);
  });
  await test("an oversized frame is still kept (it has to be shown)", () => {
    const cache = new FrameCache<{ bytes: number }>({ maxEntries: 10, maxBytes: 10 });
    cache.set("big", { bytes: 1000 });
    assert.ok(cache.has("big"));
  });
  await test("keys: depend on sources, customizer values, features and t; not on the order of vars", () => {
    const p = { activePath: "/a.scad", sources: [{ path: "/a.scad", content: "cube($t);" }], vars: { x: 1, y: 2 }, features: ["lazy-union"] };
    const k = projectKey(p);
    assert.equal(projectKey({ ...p, vars: { y: 2, x: 1 } }), k);
    assert.notEqual(projectKey({ ...p, vars: { x: 1, y: 3 } }), k);
    assert.notEqual(projectKey({ ...p, sources: [{ path: "/a.scad", content: "cube($t*2);" }] }), k);
    assert.notEqual(projectKey({ ...p, features: [] }), k);
    assert.equal(frameKey(k, 0.5), frameKey(k, 2 / 4));
    assert.notEqual(frameKey(k, 0.5), frameKey(k, 0.25));
  });

  // ─── Settings helpers ─────────────────────────────────────────────────
  await test("settings are clamped; stored ones keep only valid fields", () => {
    assert.deepEqual(clampSettings({ steps: 1000, fps: 0 }), { steps: 360, fps: 1 });
    assert.deepEqual(clampSettings({ steps: 12.4 }), { steps: 12, fps: 15 });
    assert.deepEqual(clampSettings(undefined, { steps: 8, fps: 4 }), { steps: 8, fps: 4 });
    assert.deepEqual(normalizeStoredSettings({ steps: 20, fps: "x" }), { steps: 20 });
    assert.equal(normalizeStoredSettings({ steps: "a" }), undefined);
    assert.equal(normalizeStoredSettings(null), undefined);
  });
  await test("frameAt / nearestCached wrap around the loop", () => {
    assert.equal(frameAt(0.37, 30), 11);
    assert.equal(frameAt(0.999, 30), 0, "rounds up onto the loop start");
    assert.equal(frameAt(-0.1, 10), 9);
    const cached = new Set([0, 7]);
    assert.equal(nearestCached(9, 10, i => cached.has(i)), 0, "forward across the wrap");
    assert.equal(nearestCached(5, 10, i => cached.has(i)), 7);
    assert.equal(nearestCached(3, 10, () => false), undefined);
  });

  // ─── Controller ───────────────────────────────────────────────────────
  const setup = (settings?: AnimationSettings) => {
    const clock = new FakeClock();
    const h = makeHost(clock, settings);
    const c = new AnimationController<TestFrame>(h.host, clock);
    c.invalidate("proj");
    return { clock, c, ...h };
  };

  await test("play renders ahead progressively and loops over cached frames at the set fps", async () => {
    const { c, clock, finish, log, pending } = setup();
    c.play();
    await flush();
    assert.deepEqual(log.rendered, [0.25], "renders the frame after the current one first");
    assert.deepEqual(log.shown, [], "nothing to show until it is ready");
    await finish(); // frame 1 ready -> shown, then the look-ahead continues
    assert.deepEqual(log.shown, [1]);
    await clock.advance(1); // the viewer has not reported the load yet: no advance
    c.notifyLoaded();
    await finish(); // frame 2
    await finish(); // frame 3
    await finish(); // frame 0
    assert.equal(pending.length, 0, "all four frames of the loop rendered once");
    assert.deepEqual(log.rendered, [0.25, 0.5, 0.75, 0]);
    // From here on frames are served from the cache, one per 1/fps, each only after the previous one loaded.
    for (let i = 0; i < 6; i++) { await clock.advance(100); c.notifyLoaded(); }
    assert.equal(log.rendered.length, 4, "no re-render in later laps");
    const seq = log.shown;
    for (let i = 1; i < seq.length; i++) assert.equal(seq[i], (seq[i - 1] + 1) % 4, `frame ${seq[i]} follows ${seq[i - 1]}`);
    assert.ok(seq.length >= 6);
    c.dispose();
  });
  await test("playback waits for the viewer's load report (bounded by a timeout), and does not outrun the fps", async () => {
    const { c, clock, finishAll, log } = setup();
    c.play(); await clock.advance(0);
    for (let i = 0; i < 4; i++) await finishAll();
    const n = log.shown.length;
    await clock.advance(500);
    assert.equal(log.shown.length, n, "stuck on the unloaded frame");
    await clock.advance(LOAD_TIMEOUT_MS);
    assert.ok(log.shown.length > n, "the load timeout releases playback");
    c.dispose();
  });
  await test("a changed project invalidates: stops playing, drops frames and kills the render", async () => {
    const { clock, c, finishAll, log, pending } = setup();
    c.play(); await clock.advance(0);
    await finishAll();
    assert.ok(c.cache.size > 0);
    c.invalidate("proj");
    assert.ok(c.isPlaying, "same key: nothing happens");
    c.invalidate("proj2");
    assert.ok(!c.isPlaying);
    assert.equal(c.cache.size, 0);
    assert.equal(log.released.length > 0, true, "frames released");
    assert.equal(pending.length, 0, "in-flight render killed");
    assert.equal(log.published.at(-1).playing, false);
    c.dispose();
  });
  await test("a late frame from an invalidated project is discarded and released", async () => {
    const clock = new FakeClock();
    const h = makeHost(clock);
    const c = new AnimationController<TestFrame>(h.host, clock);
    c.invalidate("a");
    c.play(); await clock.advance(0);
    const entry = h.pending[0];
    c.invalidate("b"); // kills (removes from pending) but the render resolves anyway
    entry.resolve(); await flush();
    assert.equal(c.cache.size, 0);
    c.dispose();
  });
  await test("normal renders have priority: the frame render is killed, and background work resumes afterwards", async () => {
    const { clock, c, log, finish, pending } = setup();
    c.play(); await clock.advance(0);
    assert.equal(pending.length, 1);
    log.busy = true;
    c.yieldToRender();
    assert.equal(pending.length, 0, "killed");
    c.resume();
    assert.equal(pending.length, 0, "does not start while a normal render is busy");
    log.busy = false;
    c.resume();
    await flush();
    assert.equal(pending.length, 1, "restarted once idle");
    await finish();
    c.dispose();
  });
  await test("seek: shows a cached frame at once, otherwise the nearest one while the frame renders (debounced)", async () => {
    const { c, clock, log, finish, finishAll, pending } = setup({ steps: 10, fps: 10 });
    c.seek(3); // nothing cached at all
    assert.deepEqual(log.shown, []);
    assert.equal(pending.length, 0, "debounced");
    await clock.advance(SEEK_DEBOUNCE_MS + 1);
    assert.deepEqual(log.rendered, [0.3]);
    await finish();
    assert.deepEqual(log.shown, [3]);
    // seek far away: the stand-in is the nearest cached frame
    c.seek(5);
    assert.deepEqual(log.shown, [3, 3].slice(0, 1), "same frame url: not shown again");
    c.seek(4); // rapid scrubbing: only the resting position is rendered
    await clock.advance(SEEK_DEBOUNCE_MS + 1);
    assert.deepEqual(log.rendered, [0.3, 0.4]);
    assert.equal(pending.length, 1);
    await finishAll();
    assert.equal(log.shown.at(-1), 4);
    c.seek(3);
    assert.equal(log.shown.at(-1), 3, "cached: immediate");
    assert.equal(c.currentFrame, 3);
    assert.ok(!c.isPlaying);
    c.dispose();
  });
  await test("seeking pauses playback; an obsolete look-ahead render is replaced by the requested frame", async () => {
    const { c, clock, log, pending } = setup({ steps: 10, fps: 10 });
    c.play(); await clock.advance(0);
    assert.deepEqual(log.rendered, [0.1]);
    c.seek(7);
    assert.ok(!c.isPlaying);
    assert.equal(pending.length, 0, "look-ahead killed");
    await clock.advance(SEEK_DEBOUNCE_MS + 1);
    assert.deepEqual(log.rendered, [0.1, 0.7]);
    c.dispose();
  });
  await test("changing the steps keeps the animation time and the cache is shared by equal times", async () => {
    const { c, settings, clock, log, finish } = setup({ steps: 4, fps: 10 });
    c.seek(2); await clock.advance(SEEK_DEBOUNCE_MS + 1); await finish(); // t = 0.5 cached
    const t = c.t;
    settings.steps = 8;
    c.retime(t);
    assert.equal(c.currentFrame, 4);
    assert.equal(log.rendered.length, 1, "t=0.5 was already rendered: no new render");
    c.dispose();
  });
  await test("a render error stops playback and is reported", async () => {
    const { clock, c, pending, log } = setup();
    c.play(); await clock.advance(0);
    pending[0].fail(new Error("boom")); await flush();
    assert.ok(!c.isPlaying);
    assert.equal(log.errors.length, 1);
    c.dispose();
  });
  await test("hidden pages neither advance nor render ahead", async () => {
    const { c, clock, log, pending } = setup();
    log.hidden = true;
    c.play(); await clock.advance(0);
    await clock.advance(2000);
    assert.equal(pending.length, 0);
    assert.deepEqual(log.shown, []);
    c.dispose();
  });
  await test("the cache cap evicts old frames and releases them", async () => {
    const clock = new FakeClock();
    const h = makeHost(clock, { steps: 6, fps: 10 });
    const c = new AnimationController<TestFrame>(h.host, clock, { maxEntries: 3 });
    c.invalidate("p");
    c.play(); await clock.advance(0);
    for (let i = 0; i < 6; i++) { await h.finishAll(); await clock.advance(100); c.notifyLoaded(); }
    assert.ok(c.cache.size <= 3);
    assert.ok(h.log.released.length > 0);
    c.dispose();
  });

  console.log(`${passed} animation tests passed`);
}

main().catch(e => { console.error(e); process.exit(1); });
