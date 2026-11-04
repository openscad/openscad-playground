/** Unit tests for the experimental host / localStorage view-state wrapper (src/state/mcp-view-persistence.ts). */
import assert from "node:assert/strict";
import { ViewPersistence, readViewUUID, storageKeyFor, type PersistenceApp } from "../src/state/mcp-view-persistence.ts";
import { chooseRestore, parseViewState, type ViewState } from "../src/state/mcp-viewstate.ts";

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try { await fn(); passed++; console.log(`  ok  ${name}`); } catch (e) { console.error(`FAIL  ${name}\n`, e); process.exit(1); }
};

const mem = () => { const m = new Map<string, string>(); return { m, s: { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } }; };
const state = (over: Partial<ViewState> = {}): ViewState => ({ v: 1, inv: "uuid:A", files: [{ path: "/a.scad", content: "cube(1);" }], active: "/a.scad", vars: { w: 3 }, camera: { theta: 1, phi: 2 }, axes: true, ...over });
const sdkApp = (over: Partial<PersistenceApp> & { saved?: unknown[] } = {}): PersistenceApp & { saved: unknown[] } => {
  const saved: unknown[] = over.saved ?? [];
  return {
    saved,
    getHostCapabilities: () => ({ viewState: { maxBytes: 100_000 } }),
    getHostContext: () => ({ viewState: null }),
    setViewState: async (st) => { saved.push(st); return {}; },
    ...over,
  } as PersistenceApp & { saved: unknown[] };
};
const quiet = () => { const w: string[] = []; return { w, warn: (m: string) => void w.push(m) }; };

async function main() {
  await test("viewUUID: read from _meta only, sanitized; key includes base", () => {
    assert.equal(readViewUUID({ _meta: { viewUUID: "abc" } }), "abc");
    assert.equal(readViewUUID({ structuredContent: { viewUUID: "abc" } }), undefined);
    assert.equal(readViewUUID({ _meta: { viewUUID: 5 } }), undefined);
    assert.equal(readViewUUID({ _meta: { viewUUID: "" } }), undefined);
    assert.equal(readViewUUID(null), undefined);
    assert.notEqual(storageKeyFor("a", "x"), storageKeyFor("a", "y"));
  });

  await test("stock SDK (no setViewState): pure localStorage, same uuid restores, other uuid does not", async () => {
    const { m, s } = mem();
    const app: PersistenceApp = { getHostCapabilities: () => ({}), getHostContext: () => ({}) };
    const p = new ViewPersistence(app, { storage: s });
    assert.equal(p.hostMaxBytes, undefined);
    assert.equal(await p.save(state(), storageKeyFor("A")), false);
    assert.equal(m.size, 1);
    const again = new ViewPersistence(app, { storage: s });
    assert.deepEqual(chooseRestore("uuid:A", again.candidates(storageKeyFor("A"))), state());
    assert.equal(chooseRestore("uuid:B", again.candidates(storageKeyFor("B"))), null, "new tool call => fresh");
    assert.equal(chooseRestore("uuid:B", again.candidates(storageKeyFor("A"))), null, "even under a stale key");
  });

  await test("capability without the SDK method, or without the context key, is not used", async () => {
    const noMethod = sdkApp({ setViewState: undefined });
    assert.equal(new ViewPersistence(noMethod, { storage: null }).hostMaxBytes, undefined);
    const noKey = sdkApp({ getHostContext: () => ({}) });
    assert.equal(new ViewPersistence(noKey, { storage: null }).hostMaxBytes, undefined);
    const badMax = sdkApp({ getHostCapabilities: () => ({ viewState: { maxBytes: "big" } }) });
    assert.equal(new ViewPersistence(badMax, { storage: null }).hostMaxBytes, undefined);
    const noCap = sdkApp({ getHostCapabilities: () => ({}) });
    assert.equal(new ViewPersistence(noCap, { storage: null }).hostMaxBytes, undefined);
    const throws = sdkApp({ getHostCapabilities: () => { throw new Error("x"); } });
    assert.equal(new ViewPersistence(throws, { storage: null }).hostMaxBytes, undefined);
  });

  await test("host path: saves via setViewState (also localStorage), reads host state first", async () => {
    const { m, s } = mem();
    const app = sdkApp({ getHostContext: () => ({ viewState: state({ axes: false }) }) });
    const p = new ViewPersistence(app, { storage: s });
    assert.equal(p.hostMaxBytes, 100_000);
    assert.equal(await p.save(state(), storageKeyFor("A")), true);
    assert.equal(app.saved.length, 1);
    assert.equal((app.saved[0] as ViewState).v, 1);
    assert.equal(m.size, 1);
    const cands = p.candidates(storageKeyFor("A"));
    assert.equal(chooseRestore("uuid:A", cands)!.axes, false, "host wins");
  });

  await test("maxBytes: largest sources dropped, state stays within the host limit", async () => {
    const app = sdkApp({ getHostCapabilities: () => ({ viewState: { maxBytes: 1500 } }) });
    const p = new ViewPersistence(app, { storage: null });
    const big = state({ files: [{ path: "/s.scad", content: "s".repeat(100) }, { path: "/big.scad", content: "b".repeat(9000) }], active: "/s.scad" });
    assert.equal(await p.save(big, null), true);
    const sent = JSON.stringify(app.saved[0]);
    assert.ok(new TextEncoder().encode(sent).length <= 1500);
    assert.deepEqual((app.saved[0] as ViewState).files!.map(f => f.path), ["/s.scad"]);
    const tiny = sdkApp({ getHostCapabilities: () => ({ viewState: { maxBytes: 10 } }) });
    assert.equal(await new ViewPersistence(tiny, { storage: null }).save(big, null), false);
    assert.equal(tiny.saved.length, 0, "nothing sent when even the trimmed state cannot fit");
  });

  for (const [label, err] of [
    ["-32601 method not found", Object.assign(new Error("Method not found"), { code: -32601 })],
    ["-32602 too large", Object.assign(new Error("too large"), { code: -32602 })],
    ["-32603 not now", Object.assign(new Error("later"), { code: -32603 })],
  ] as const) {
    await test(`host error ${label}: disabled for the session, warn once, localStorage keeps working`, async () => {
      const { m, s } = mem();
      let calls = 0;
      const q = quiet();
      const p = new ViewPersistence(sdkApp({ setViewState: async () => { calls++; throw err; } }), { storage: s, warn: q.warn });
      assert.equal(await p.save(state(), "k"), false);
      assert.equal(await p.save(state({ axes: false }), "k"), false);
      assert.equal(calls, 1, "no retry storm");
      assert.equal(q.w.length, 1);
      assert.equal(p.hostMaxBytes, undefined);
      assert.equal(parseViewState(m.get("k"))!.axes, false, "local copy is current");
    });
  }

  await test("host timeout: falls back, does not hang", async () => {
    const q = quiet();
    const p = new ViewPersistence(sdkApp({ setViewState: () => new Promise(() => {}) }), { storage: null, timeoutMs: 20, warn: q.warn });
    assert.equal(await p.save(state(), null), false);
    assert.equal(p.hostMaxBytes, undefined);
    assert.equal(q.w.length, 1);
  });

  await test("spec drift: host state that is not our plain object is ignored", () => {
    for (const bad of ["str", 5, [], [state()], { version: 1, tab: "x" }, { v: 2 }, new Map(), Object.create(null) && 0]) {
      const p = new ViewPersistence(sdkApp({ getHostContext: () => ({ viewState: bad }) }), { storage: null });
      assert.equal(p.readHost(), null, JSON.stringify(bad));
    }
    const { s } = mem();
    s.setItem("k", "{corrupt");
    assert.equal(new ViewPersistence(sdkApp(), { storage: s }).readLocal("k"), null);
    s.setItem("k", JSON.stringify({ v: 99, inv: "uuid:A" }));
    assert.equal(new ViewPersistence(sdkApp(), { storage: s }).readLocal("k"), null, "unknown version");
  });

  await test("blocked localStorage and throwing getters never throw", async () => {
    const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
    const p = new ViewPersistence({ getHostCapabilities: () => { throw new Error("x"); } }, { storage: blocked });
    assert.equal(p.readLocal("k"), null);
    assert.equal(await p.save(state(), "k"), false);
    assert.equal(p.readHost(), null);
  });

  console.log(`${passed} view-persistence tests passed`);
}
main();
