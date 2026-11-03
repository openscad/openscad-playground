/**
 * Unit tests for the model-context formatting and scheduling
 * (src/state/mcp-context.ts). Run with: npm test.
 */
import assert from "node:assert/strict";
import { formatParameterNames, ContextScheduler, buildContextBlocks, captureForContext, changedParameters, formatContextText, readContextCaps, readyToPublish, CONTEXT_IMAGE_MAX_BASE64 } from "../src/state/mcp-context.ts";
import { HostFileWriter, hasOpenAIResources, parseFileInput, readHostFile, type FileHostApp } from "../src/state/mcp-file.ts";
import { HostViewStateWriter, ViewStateSaver, chooseRestore, fingerprint, loadLocal, parseViewState, readHostViewState, saveLocal, serializeViewState, type ViewState } from "../src/state/mcp-viewstate.ts";
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
  await test("file entrypoint: input parsing, text/blob reads, capability", async () => {
    assert.equal(parseFileInput({}), null);
    assert.equal(parseFileInput({ file: { name: "a.scad", resourceUri: " " } }), null);
    assert.deepEqual(parseFileInput({ file: { name: "a.scad", resourceUri: "host-resource://a" } }), { name: "a.scad", resourceUri: "host-resource://a" });
    assert.ok(hasOpenAIResources({ experimental: { "openai/resource": {} } }));
    assert.ok(!hasOpenAIResources({}));
    let asked: any;
    const app: FileHostApp = {
      readServerResource: async (p) => { asked = p; return { contents: [{ uri: p.uri, blob: Buffer.from("cube(1); // é").toString("base64"), _meta: { "openai/resource": { etag: "v1", writable: true } } }] }; },
      request: async () => ({}),
    };
    const got = await readHostFile(app, { name: "a.scad", resourceUri: "u" });
    assert.deepEqual(got, { text: "cube(1); // é", etag: "v1", writable: true });
    assert.equal(asked._meta["openai/resource"].representation, "text");
  });
  await test("file writer: debounced saves with ifMatch, stops on conflict, read-only never writes", async () => {
    const calls: any[] = [];
    let next: any = { outcome: "saved", etag: "v2" };
    const app: FileHostApp = { readServerResource: async () => ({ contents: [] }), request: async (r) => { calls.push(r.params); return next; } };
    const msgs: string[] = [];
    const w = new HostFileWriter(app, { name: "a.scad", resourceUri: "u" }, { text: "a", etag: "v1", writable: true }, null, (m) => msgs.push(m), 5);
    w.schedule("a"); w.schedule("b"); w.schedule("bc");
    await new Promise((r) => setTimeout(r, 40));
    assert.deepEqual(calls, [{ uri: "u", text: "bc", ifMatch: "v1" }]);
    next = { outcome: "conflict", etag: "v9" };
    w.schedule("bcd");
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(calls.length, 2); assert.match(msgs[0], /changed elsewhere/);
    w.schedule("zzz"); await new Promise((r) => setTimeout(r, 20));
    assert.equal(calls.length, 2, "stopped after a conflict");
    const ro = new HostFileWriter(app, { name: "a.scad", resourceUri: "u" }, { text: "a", writable: false }, null, () => {}, 1);
    ro.schedule("x"); await new Promise((r) => setTimeout(r, 20));
    assert.equal(calls.length, 2);
    w.dispose();
  });
  const vs = (over: Partial<ViewState> = {}): ViewState => ({ v: 1, inv: "i1", files: [{ path: "/a.scad", content: "cube(1);" }], active: "/a.scad", vars: { w: 3 }, camera: { theta: 1, phi: 2, radius: 5, fov: 30, target: { x: 0, y: 0, z: 0 } }, embed: true, overlay: false, axes: true, ...over });
  await test("view state: round trip, version check, untrusted input", () => {
    const json = serializeViewState(vs())!;
    assert.deepEqual(parseViewState(json), vs());
    assert.equal(parseViewState(JSON.stringify({ ...vs(), v: 2 })), null);
    assert.equal(parseViewState("not json"), null);
    assert.equal(parseViewState(null), null);
    assert.deepEqual(parseViewState({ v: 1, files: [{ path: 1 }, { path: "/x.scad", content: "x" }], active: "/gone", camera: { theta: "1" }, axes: "yes" }), { v: 1, files: [{ path: "/x.scad", content: "x" }] });
  });
  await test("view state: the cap drops the largest files first and never fails", () => {
    const big = vs({ files: [{ path: "/small.scad", content: "s".repeat(100) }, { path: "/big.scad", content: "b".repeat(5000) }, { path: "/mid.scad", content: "m".repeat(1000) }], active: "/big.scad" });
    const out = parseViewState(serializeViewState(big, 1500)!)!;
    assert.deepEqual(out.files!.map((f) => f.path), ["/small.scad", "/mid.scad"]);
    assert.equal(out.active, undefined, "active dropped with its file");
    const none = parseViewState(serializeViewState(big, 300)!)!;
    assert.equal(none.files, undefined);
    assert.equal(serializeViewState(big, 5), undefined);
    assert.ok(new TextEncoder().encode(serializeViewState(vs({ files: [{ path: "/a", content: "é".repeat(100000) }] }))!).length <= 64 * 1024);
  });
  await test("view state precedence: only the same invocation restores; host before localStorage", () => {
    const fp = fingerprint({ source: "cube(2);" });
    assert.equal(fingerprint({ b: 1, a: [2] }), fingerprint({ a: [2], b: 1 }));
    assert.notEqual(fp, fingerprint({ source: "cube(3);" }));
    const host = JSON.stringify(vs({ inv: fp, axes: false }));
    const local = JSON.stringify(vs({ inv: fp, axes: true }));
    assert.equal(chooseRestore(fp, [host, local])!.axes, false, "host wins");
    assert.equal(chooseRestore(fp, [undefined, local])!.axes, true, "then localStorage");
    assert.equal(chooseRestore(fp, [JSON.stringify(vs({ inv: "other" })), local])!.axes, true, "a stale host state is skipped");
    assert.equal(chooseRestore(fingerprint({ source: "new" }), [host, local]), null, "a deliberate new create wins over saved state");
    assert.equal(chooseRestore(fp, [undefined, "garbage"]), null);
  });
  await test("localStorage helpers swallow blocked storage", () => {
    const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
    assert.equal(loadLocal("k", blocked), null);
    assert.equal(saveLocal("k", "v", blocked), false);
    assert.equal(loadLocal("k", null), null);
    assert.equal(saveLocal("k", "v", null), false);
    const mem = new Map<string, string>();
    const ok = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    assert.ok(saveLocal("k", "v", ok)); assert.equal(loadLocal("k", ok), "v");
  });
  await test("host view state: reads assumed locations; writer stops after method-not-found", async () => {
    assert.equal(readHostViewState({ getHostContext: () => ({ viewState: 1 }), getHostVersion: () => ({}), request: async () => ({}) }), 1);
    assert.equal(readHostViewState({ getHostContext: () => ({}), getHostVersion: () => ({ viewState: 2 }), request: async () => ({}) }), 2);
    assert.equal(readHostViewState({ getHostContext: () => { throw new Error("x"); }, getHostVersion: () => ({}), request: async () => ({}) }), undefined);
    let calls = 0;
    const w = new HostViewStateWriter({ getHostContext: () => ({}), getHostVersion: () => ({}), request: async () => { calls++; throw Object.assign(new Error("Method not found"), { code: -32601 }); } }, null);
    assert.equal(await w.write("{\"v\":1}"), false);
    assert.equal(await w.write("{\"v\":1}"), false);
    assert.equal(calls, 1, "no retry after method-not-found");
    let sent: any;
    const ok = new HostViewStateWriter({ getHostContext: () => ({}), getHostVersion: () => ({}), request: async (r) => { sent = r; return {}; } }, null);
    assert.ok(await ok.write("{\"v\":1}"));
    assert.deepEqual(sent, { method: "ui/set-view-state", params: { viewState: { v: 1 } } });
    let n = 0;
    const flaky = new HostViewStateWriter({ getHostContext: () => ({}), getHostVersion: () => ({}), request: async () => { n++; throw new Error("timeout"); } }, null);
    for (let i = 0; i < 5; i++) await flaky.write("{}");
    assert.equal(n, 3, "gives up after repeated failures");
  });
  await test("saver: debounces, skips unchanged, sinks may throw", async () => {
    const seen: string[] = [];
    let state = vs();
    const saver = new ViewStateSaver(() => state, [(j) => { seen.push(j); }, () => { throw new Error("sink down"); }], 5);
    saver.request(); saver.request(); saver.request();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(seen.length, 1);
    await saver.flush(); assert.equal(seen.length, 1, "unchanged state is not re-sent");
    state = vs({ axes: false }); await saver.flush(); assert.equal(seen.length, 2);
    saver.dispose();
  });
  await test("parameter names: in every update, short values only, capped; follow schema changes", () => {
    const t = formatContextText(snap(), cam, "s");
    assert.match(t, /Customizer parameters \(set_parameters overlays values without editing the source\): width=42, depth=20\./);
    assert.doesNotMatch(formatContextText(snap({ parameters: [] }), cam, "s"), /Customizer parameters/);
    assert.match(t, /width = 42 \(default 30\)/, "changed values stay listed");
    assert.equal(formatParameterNames(snap({ parameters: [] })), null);
    const many = snap({ parameters: Array.from({ length: 45 }, (_, i) => ({ name: `p${i}`, type: "number", initial: i, value: i })) });
    const line = formatParameterNames(many)!;
    assert.match(line, /p29=29, \+15 more\.$/);
    assert.doesNotMatch(line, /p30/);
    assert.equal(formatParameterNames(snap({ parameters: [{ name: "s", type: "string", initial: "x", value: "a very long string value" }] }))!.includes("s=a very"), false);
  });
  await test("every update replaces the last, so each carries the current names", () => {
    const before = formatContextText(snap(), cam, "s");
    const after = formatContextText(snap({ parameters: [{ name: "h", type: "number", initial: 1, value: 1 }] }), { ...cam, theta: 1 }, "s2");
    assert.match(before, /width=42, depth=20/);
    assert.match(after, /Customizer parameters \(set_parameters overlays values without editing the source\): h=1\./);
    assert.doesNotMatch(after, /width=/);
  });
  console.log(`${passed} test(s) passed`);
}
main().catch((e) => { console.error(e); process.exit(1); });
