/**
 * Unit tests for the model-context formatting and scheduling
 * (src/state/mcp-context.ts). Run with: npm test.
 */
import assert from "node:assert/strict";
import { ContextScheduler, buildContextBlocks, captureForContext, changedParameters, formatContextText, readContextCaps, readyToPublish, CONTEXT_IMAGE_MAX_BASE64 } from "../src/state/mcp-context.ts";
import type { CameraState, ViewerSnapshot } from "../src/state/mcp-tools.ts";

const snap = (over: Partial<ViewerSnapshot> = {}): ViewerSnapshot => ({
  activePath: "/playground.scad", files: [{ path: "/playground.scad", lines: 3, active: true }], status: "idle", diagnostics: [], logTail: [],
  hasOutput: true, renderKind: "preview", parameters: [
    { name: "width", type: "number", initial: 30, value: 42 },
    { name: "depth", type: "number", initial: 20, value: 20 },
  ], showAxes: true, layout: { mode: "embed", customizerOverlay: false }, ...over,
});
const cam: CameraState = { theta: 0, phi: Math.PI / 2, radius: 10, fitRadius: 10, target: { x: 0, y: 0, z: 0 }, fov: 30 };
const img = (n: number) => ({ data: "A".repeat(n), mimeType: "image/jpeg", width: 10, height: 10 });

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log(`  ✓ ${name}`); };

async function main() {
  console.log("model context tests");
  await test("capabilities: none without updateModelContext; image/openai flags", () => {
    assert.equal(readContextCaps({}), null);
    assert.deepEqual(readContextCaps({ updateModelContext: { text: {} } }), { text: true, image: false, openai: false });
    assert.deepEqual(readContextCaps({ updateModelContext: { text: {}, image: {} }, experimental: { "openai/modelContext": {} } }), { text: true, image: true, openai: true });
  });
  await test("text lists camera, preset, only changed parameters, source", () => {
    const t = formatContextText(snap(), cam, "cube(1);");
    assert.match(t, /\/playground\.scad, 3 lines, 8 chars; status idle/);
    assert.match(t, /Camera: azimuth .*preset/);
    assert.match(t, /width = 42 \(default 30\)/);
    assert.doesNotMatch(t, /depth =/);
    assert.match(t, /```scad\ncube\(1\);\n```/);
    assert.deepEqual(changedParameters(snap()), ["width = 42 (default 30)"]);
  });
  await test("failures include diagnostics; long sources are truncated", () => {
    const t = formatContextText(snap({ diagnostics: [{ path: "/playground.scad", line: 2, column: 1, severity: "error", message: "syntax error" }] }), null, "x".repeat(9000));
    assert.match(t, /Render: FAILED/);
    assert.match(t, /playground\.scad:2:1: error: syntax error/);
    assert.match(t, /truncated \(3000 more chars/);
  });
  await test("blocks: image only if the host accepts it; groups only with the openai extension", () => {
    const plain = buildContextBlocks(snap(), cam, "s", img(10), { text: true, image: false, openai: false });
    assert.deepEqual(plain.map((b) => b.type), ["text"]);
    assert.equal(plain[0]._meta, undefined);
    const rich = buildContextBlocks(snap(), cam, "s", img(10), { text: true, image: true, openai: true });
    assert.deepEqual(rich.map((b) => b.type), ["text", "image"]);
    for (const b of rich) assert.equal((b._meta as any)["openai/group"].title, "OpenSCAD viewer");
    assert.deepEqual((rich[0] as any).annotations, { audience: ["assistant"] });
  });
  await test("publish only once idle with a result (or a failure)", () => {
    assert.ok(readyToPublish(snap()));
    assert.ok(!readyToPublish(snap({ status: "rendering" })));
    assert.ok(!readyToPublish(snap({ hasOutput: false })));
    assert.ok(readyToPublish(snap({ hasOutput: false, error: "boom" })));
  });
  await test("image capture shrinks until it fits the budget", async () => {
    const sizes: number[] = [];
    const out = await captureForContext(async (o) => { sizes.push(o.maxSize); return img(o.maxSize === 768 ? CONTEXT_IMAGE_MAX_BASE64 + 1 : 1000); });
    assert.deepEqual(sizes, [768, 512]);
    assert.equal(out!.data.length, 1000);
    assert.equal(await captureForContext(async () => img(CONTEXT_IMAGE_MAX_BASE64 + 1)), null);
    assert.equal(await captureForContext(async () => null), null);
  });
  await test("scheduler debounces bursts, rate-limits and coalesces during a run", async () => {
    let t = 0, runs = 0;
    const timers: Array<{ at: number; fn: () => void }> = [];
    let release!: () => void;
    let slow = false;
    const sch = new ContextScheduler(async () => { runs++; if (slow) await new Promise<void>((r) => (release = r)); }, {
      debounceMs: 800, minIntervalMs: 1000, now: () => t,
      setTimer: ((fn: () => void, ms: number) => { const h = { at: t + ms, fn }; timers.push(h); return h; }) as any,
      clearTimer: ((h: any) => { timers.splice(timers.indexOf(h), 1); }) as any,
    });
    const advance = async (ms: number) => { t += ms; for (const h of timers.filter((x) => x.at <= t)) { timers.splice(timers.indexOf(h), 1); h.fn(); } await Promise.resolve(); await Promise.resolve(); };
    for (let i = 0; i < 20; i++) { sch.request(); await advance(100); } // a burst of camera moves
    assert.equal(runs, 0, "nothing while the burst continues");
    await advance(800);
    assert.equal(runs, 1);
    sch.request(); await advance(100);
    assert.equal(timers.length, 1);
    await advance(900);
    assert.equal(runs, 2);
    slow = true; sch.request(); await advance(1000); assert.equal(runs, 3);
    sch.request(); sch.request(); await advance(2000); assert.equal(runs, 3, "no concurrent run");
    slow = false; release(); await advance(0); await advance(1000); await advance(1000);
    assert.equal(runs, 4, "one coalesced follow-up");
    sch.dispose();
  });
  console.log(`${passed} test(s) passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
