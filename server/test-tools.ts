/**
 * Unit tests for the view-registered app tools (src/state/mcp-tools.ts) and
 * the pure logic behind them (src/state/mcp-tools-logic.ts), run headless
 * against a mock ViewerHost.
 *
 * Covers: line numbering and ranges, str_replace uniqueness/not-found
 * failures, insert/delete range checks, undo, diagnostics reporting (render
 * failure => isError, timeout wording), parameter validation, camera math,
 * and multi-view screenshot content/camera restore.
 *
 * Run with: npm test. Excluded from the server tsconfig because it imports
 * across the frontend rootDir; tsx handles it directly.
 */

import assert from "node:assert/strict";
import { decideNotification, notify } from "../src/state/notify.ts";
import { NO_INPUT_TIMEOUT_MS, SHOW_DELAY_MS, loadingPhase, loadingView, type LoadingInputs } from "../src/state/loading-state.ts";
import { exportSource, sourceStem } from "../src/state/export-source.ts";
import {
  createTools,
  type CameraState,
  type CaptureOptions,
  type Diagnostic,
  type ViewerHost,
  type ViewerSnapshot,
} from "../src/state/mcp-tools.ts";
import { EditorValueSync } from "../src/state/editor-value-sync.ts";
import { AbortablePromise, SupersededError, turnIntoDelayableExecution } from "../src/utils.ts";
import { FORMAT_INFO, LINK_CAP, SIZE_CAPS, buildFilename, bytesToBase64, dataUri, deliveryPlan, parseFormat, ExportError } from "../src/state/export-logic.ts";
import { FULL_LAYOUT_HEIGHT, INLINE_HEIGHT, MAX_HEIGHT, heightCap, shouldReport, targetHeight } from "../src/state/mcp-sizing.ts";
import { fullAppUrl, isFramed, resolveMcpSetupUrl, parseEmbedOverride, resolveEmbed, stripEmbedFromFragment } from "../src/state/embed.ts";
import {
  ToolError,
  azElFromOrbit,
  deleteLines,
  fitSize,
  formatNumbered,
  insertLines,
  nearestPreset,
  normalizeDeg,
  normalizeNewPath,
  orbitDelta,
  orbitFromAzEl,
  presetOrbit,
  replaceUnique,
  resolveCamera,
  resolvePath,
  validateParameterValue,
} from "../src/state/mcp-tools-logic.ts";

// ─── Mock host ──────────────────────────────────────────────────────────

function mockHost(initial: Record<string, string> = { "/playground.scad": "cube(10);\nsphere(5);\n" }) {
  const files = new Map(Object.entries(initial));
  let active = Object.keys(initial)[0];
  let diagnostics: Diagnostic[] = [];
  let timedOut = false;
  let camera: CameraState = { theta: Math.PI / 4, phi: Math.PI / 4, radius: 10, fitRadius: 10, target: { x: 0, y: 0, z: 0 }, fov: 45 };
  const captures: Array<{ theta: number; opts: CaptureOptions }> = [];
  const log: string[] = [];
  let renderKind: "preview" | "full" = "preview";
  let caps: { download: boolean; message: boolean; messageLink?: boolean } = { download: false, message: false };
  const opts = { bigFile: false, rejectEmbedded: false };
  let params: ViewerSnapshot["parameters"] = [
    { name: "width", type: "number", group: "Dimensions", caption: "Box width", initial: 30, value: 30, min: 10, max: 100, step: 1 },
    { name: "style", type: "string", group: "Style", initial: "round", value: "round", options: [{ name: "Round", value: "round" }, { name: "Square", value: "sq" }] },
    { name: "lid", type: "boolean", group: "Style", initial: true, value: true },
    { name: "size", type: "number", group: "Style", initial: [1, 2, 3], value: [1, 2, 3], min: 0, max: 10, step: 1 },
  ];
  let layout: ViewerSnapshot["layout"] = { mode: "embed", customizerOverlay: false };

  const snapshot = (): ViewerSnapshot => ({
    activePath: active,
    files: [...files].map(([path, c]) => ({ path, lines: c === "" ? 0 : c.replace(/\n$/, "").split("\n").length, active: path === active })),
    status: "idle",
    timedOut: timedOut || undefined,
    diagnostics,
    logTail: ["Rendering..."],
    hasOutput: true,
    renderKind,
    elapsedMs: 12,
    parameters: params,
    showAxes: false,
    layout,
  });
  const host: ViewerHost = {
    snapshot,
    settle: async () => snapshot(),
    readFile: (p) => files.get(p),
    writeFile: (p, c, o) => { files.set(p, c); if (o?.activate) active = p; log.push(`write ${p}`); },
    removeFile: (p) => { files.delete(p); if (active === p) active = [...files.keys()][0]; },
    startRender: (m) => { log.push(m === "full" ? "full-render" : "preview-render"); if (m === "full") renderKind = "full"; },
    fileCapabilities: () => caps,
    exportFile: async (format, filename, path) => {
      if (format === "scad") {
        const e = exportSource([...files].map(([p, content]) => ({ path: p, content })), active, path, filename);
        return { filename: e.filename, mimeType: e.mimeType, base64: e.base64, size: e.size };
      }
      const bytes = new Uint8Array(opts.bigFile ? 2 * 1024 * 1024 : 200).fill(65);
      return { filename: buildFilename(filename, "playground", format), mimeType: FORMAT_INFO[format].mimeType, base64: bytesToBase64(bytes), size: bytes.length };
    },
    deliver: async (file, steps) => {
      for (const step of steps) {
        if (step.channel === "return") return undefined;
        log.push(`deliver ${step.channel}/${step.form} ${file.filename}`);
        if (opts.rejectEmbedded && step.form === "embedded") continue; // host throws on embedded resources
        return { outcome: step.channel === "download" ? `Downloaded ${file.filename}` : `Sent ${file.filename} to the chat`, step };
      }
      return undefined;
    },
    setParameters: (v) => {
      const changed = Object.entries(v).filter(([n, x]) => JSON.stringify(params.find((p) => p.name === n)!.value) !== JSON.stringify(x));
      if (!changed.length) return false;
      params = params.map((p) => (p.name in v ? { ...p, value: v[p.name] } : p));
      log.push(`params ${JSON.stringify(Object.fromEntries(changed))}`);
      return true;
    },
    resetParameters: (names) => {
      const t = params.filter((p) => JSON.stringify(p.value) !== JSON.stringify(p.initial) && (!names || names.includes(p.name)));
      if (!t.length) return false;
      params = params.map((p) => (t.includes(p) ? { ...p, value: p.initial } : p));
      log.push(`reset ${t.map((p) => p.name)}`);
      return true;
    },
    setLayout: (r) => {
      layout = { ...layout, ...(r.mode ? { mode: r.mode } : {}) };
      if (r.customizerOverlay) layout.customizerOverlay = r.customizerOverlay === "toggle" ? !layout.customizerOverlay : r.customizerOverlay === "open";
      log.push(`layout ${JSON.stringify(r)}`);
    },
    setShowAxes: (b) => { log.push(`axes ${b}`); },
    getCamera: async () => camera,
    setCamera: async (r) => {
      camera = { ...camera, theta: r.theta, phi: r.phi, radius: r.distance ?? camera.radius };
      log.push(`camera ${r.theta.toFixed(3)} ${r.phi.toFixed(3)}`);
      return camera;
    },
    waitForModel: async () => true,
    captureImage: async (opts) => {
      captures.push({ theta: camera.theta, opts });
      return { data: "QUFBQQ==", mimeType: opts.mimeType, width: 100, height: 80 };
    },
  };
  return {
    host, files, log, captures,
    setDiagnostics: (d: Diagnostic[]) => { diagnostics = d; },
    setParams: (p: ViewerSnapshot["parameters"]) => { params = p; },
    setCaps: (c: { download: boolean; message: boolean; messageLink?: boolean }) => { caps = c; },
    opts,
    setTimedOut: (t: boolean) => { timedOut = t; },
    camera: () => camera,
  };
}

const err = (line = 3): Diagnostic => ({ path: "/playground.scad", line, column: 1, severity: "error", message: "syntax error" });

function tools(h = mockHost()) {
  const defs = createTools(async () => h.host);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const d = defs.find((t) => t.name === name);
    assert.ok(d, `no tool ${name}`);
    const parsed = d.inputSchema.safeParse(args);
    if (!parsed.success) return { content: [{ type: "text" as const, text: `invalid: ${parsed.error.message}` }], isError: true };
    return d.handler(parsed.data);
  };
  return { h, defs, call };
}
const textOf = (r: { content: Array<{ type: string; text?: string }> }) => r.content.map((c) => c.text ?? "").join("\n");

// ─── Tests ──────────────────────────────────────────────────────────────

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
};
const throwsTool = (fn: () => unknown, re: RegExp) =>
  assert.throws(fn, (e) => e instanceof ToolError && re.test(e.message));

async function main() {
  console.log("OpenSCAD MCP app tool tests");

  // Logic
  await test("formatNumbered numbers lines cat -n style and handles ranges", () => {
    const v = formatNumbered("a\nb\nc\n");
    assert.equal(v.total, 3);
    assert.equal(v.text, "     1\ta\n     2\tb\n     3\tc");
    assert.equal(formatNumbered("a\nb\nc\n", 2, 3).text, "     2\tb\n     3\tc");
    assert.equal(formatNumbered("a\nb\n", 2, 99).end, 2); // end clamps
    throwsTool(() => formatNumbered("a\nb\n", 3), /out of range/);
    throwsTool(() => formatNumbered("a\nb\n", 2, 1), /end_line/);
    throwsTool(() => formatNumbered("a\nb\n", 0), /start_line/);
    assert.equal(formatNumbered("").text, "(empty file)");
  });

  await test("replaceUnique replaces a unique match literally", () => {
    const r = replaceUnique("x = 1;\ny = 2;\n", "y = 2", "y = '$&'");
    assert.equal(r.content, "x = 1;\ny = '$&';\n");
    assert.equal(r.count, 1);
    assert.equal(r.firstLine, 2);
  });
  await test("replaceUnique fails when not found / empty / identical", () => {
    throwsTool(() => replaceUnique("abc", "zzz", "y"), /not found/);
    throwsTool(() => replaceUnique("abc", "", "y"), /must not be empty/);
    throwsTool(() => replaceUnique("abc", "a", "a"), /identical/);
  });
  await test("replaceUnique fails on ambiguous match unless replace_all, listing lines", () => {
    const src = "a\nfoo\nb\nfoo\n";
    throwsTool(() => replaceUnique(src, "foo", "bar"), /2 times \(at lines 2, 4\)/);
    const r = replaceUnique(src, "foo", "bar", true);
    assert.equal(r.content, "a\nbar\nb\nbar\n");
    assert.equal(r.count, 2);
  });
  await test("insertLines inserts after a line, at top, at end; validates range", () => {
    assert.equal(insertLines("a\nb\n", 1, "X").content, "a\nX\nb\n");
    assert.equal(insertLines("a\nb\n", 0, "X\nY").content, "X\nY\na\nb\n");
    const end = insertLines("a\nb\n", 2, "X\n");
    assert.equal(end.content, "a\nb\nX\n");
    assert.equal(end.firstLine, 3);
    assert.equal(insertLines("", 0, "X").content, "X\n");
    throwsTool(() => insertLines("a\nb\n", 3, "X"), /out of range/);
    throwsTool(() => insertLines("a\nb\n", -1, "X"), /out of range/);
  });
  await test("deleteLines deletes ranges and validates", () => {
    assert.equal(deleteLines("a\nb\nc\n", 2).content, "a\nc\n");
    assert.equal(deleteLines("a\nb\nc\n", 1, 3).content, "");
    throwsTool(() => deleteLines("a\nb\n", 2, 3), /invalid/);
    throwsTool(() => deleteLines("a\nb\n", 0, 1), /invalid/);
    throwsTool(() => deleteLines("a\nb\n", 2, 1), /invalid/);
  });
  await test("resolvePath tolerates missing leading slash and unique basenames", () => {
    const paths = ["/playground.scad", "/lib/gear.scad"];
    assert.equal(resolvePath(paths, "playground.scad"), "/playground.scad");
    assert.equal(resolvePath(paths, "gear.scad"), "/lib/gear.scad");
    throwsTool(() => resolvePath(paths, "nope.scad"), /No such file/);
    assert.equal(normalizeNewPath("lib/x.scad"), "/lib/x.scad");
    throwsTool(() => normalizeNewPath("../x.scad"), /Invalid/);
  });
  await test("camera math: presets, az/el round trip, clamping, nearest preset", () => {
    assert.equal(normalizeDeg(270), -90);
    assert.equal(normalizeDeg(-180), 180);
    const iso = presetOrbit("iso");
    assert.ok(Math.abs(iso.theta - Math.PI / 4) < 1e-9 && Math.abs(iso.phi - Math.PI / 4) < 1e-9);
    const top = presetOrbit("top");
    assert.ok(Math.abs(top.phi) < 1e-9);
    const { azimuth, elevation } = azElFromOrbit(...(Object.values(orbitFromAzEl(30, 20)) as [number, number]));
    assert.deepEqual([azimuth, elevation], [30, 20]);
    assert.ok(Math.abs(orbitFromAzEl(0, 120).phi) < 1e-9); // elevation clamps to 90
    assert.equal(nearestPreset(0.01, Math.PI / 2 - 0.01).name, "front");
    assert.equal(nearestPreset(Math.PI / 2, Math.PI / 2).name, "right");
  });
  await test("resolveCamera: preset, overrides, fit, validation", () => {
    const cur = { theta: 1, phi: 1 };
    const r = resolveCamera({ view: "right" }, cur);
    assert.ok(Math.abs(r.theta - Math.PI / 2) < 1e-9);
    const o = resolveCamera({ elevation_deg: 90 }, orbitFromAzEl(40, 10)); // keeps azimuth
    assert.ok(Math.abs(o.theta - (40 / 180) * Math.PI) < 1e-9 && Math.abs(o.phi) < 1e-9);
    const f = resolveCamera({ fit: true, zoom: 3 }, cur);
    assert.equal(f.zoom, 1);
    assert.equal(f.target, "auto");
    throwsTool(() => resolveCamera({ zoom: 0 }, cur), /zoom/);
    throwsTool(() => resolveCamera({ zoom: 2, distance: 5 }, cur), /either/);
    throwsTool(() => resolveCamera({ field_of_view_deg: 500 }, cur), /field_of_view/);
  });
  await test("orbitDelta rotates, clamps elevation, and zooms", () => {
    const base = { ...orbitFromAzEl(10, 80), radius: 10 };
    const r = orbitDelta(base, { azimuth_deg: 20, elevation_deg: 30, zoom_factor: 2 });
    const ae = azElFromOrbit(r.theta, r.phi);
    assert.deepEqual([ae.azimuth, ae.elevation, r.radius], [30, 90, 5]);
    throwsTool(() => orbitDelta(base, { zoom_factor: -1 }), /zoom_factor/);
  });
  await test("fitSize never upscales", () => {
    assert.deepEqual(fitSize(2000, 1000, 1000), { width: 1000, height: 500 });
    assert.deepEqual(fitSize(300, 200, 1000), { width: 300, height: 200 });
  });

  await test("embed: URL overrides win both ways, else framed decides", () => {
    assert.equal(parseEmbedOverride("?embed=1", ""), true);
    assert.equal(parseEmbedOverride("?embed", ""), true);
    assert.equal(parseEmbedOverride("?embed=0", ""), false);
    assert.equal(parseEmbedOverride("?x=1", "#embed=1&src=cube(1)%3B"), true);
    assert.equal(parseEmbedOverride("", "#embed=0"), false);
    assert.equal(parseEmbedOverride("", "#src=embed=1"), undefined);
    assert.equal(parseEmbedOverride("?embed=maybe", ""), undefined);
    assert.equal(resolveEmbed({ search: "", hash: "", framed: true }), true);
    assert.equal(resolveEmbed({ search: "", hash: "", framed: false }), false);
    assert.equal(resolveEmbed({ search: "?embed=0", hash: "", framed: true }), false);
    assert.equal(resolveEmbed({ search: "?embed=1", hash: "", framed: false }), true);
    assert.equal(stripEmbedFromFragment("embed=1&src=a%26b"), "src=a%26b");
    assert.equal(stripEmbedFromFragment("embed=0"), "");
    assert.equal(stripEmbedFromFragment("src=embed=1"), "src=embed=1");
    assert.equal(fullAppUrl("https://x.test/app/?embed=1#embed=1&src=abc"), "https://x.test/app/?embed=0#src=abc");
  });
  await test("resolveMcpSetupUrl: hidden unless configured, relative or absolute, never when framed", () => {
    const base = "https://app.example/play/index.html";
    assert.equal(resolveMcpSetupUrl(undefined, base, false), undefined);
    assert.equal(resolveMcpSetupUrl("", base, false), undefined);
    assert.equal(resolveMcpSetupUrl("/mcp", base, false), "https://app.example/mcp");
    assert.equal(resolveMcpSetupUrl("https://mcp.example/mcp", base, false), "https://mcp.example/mcp");
    assert.equal(resolveMcpSetupUrl("/mcp", base, true), undefined);
    assert.equal(resolveMcpSetupUrl("http://", base, false), undefined);
  });
  await test("export-logic: formats, filenames, delivery choice", () => {
    assert.equal(parseFormat(undefined, false), "stl");
    assert.equal(parseFormat("GLB", false), "glb");
    assert.equal(parseFormat(undefined, true), "svg");
    assert.throws(() => parseFormat("stl", true), (e) => e instanceof ExportError && /not available for this 2D/.test(e.message));
    assert.throws(() => parseFormat("obj", false), /Unknown format/);
    assert.equal(buildFilename(undefined, "playground", "stl"), "playground.stl");
    assert.equal(buildFilename("my part.STL", "x", "stl"), "my part.stl");
    assert.equal(buildFilename("../../etc/pass wd?.3mf", "x", "3mf"), "pass wd_.3mf");
    assert.equal(buildFilename("..", "x", "off"), "model.off");
    const none = { download: false, message: false };
    const names = (steps: ReturnType<typeof deliveryPlan>) => steps.map((x) => `${x.channel}/${x.form}`);
    // auto order: download (embedded, link), message (embedded, link), return (embedded, link)
    assert.deepEqual(names(deliveryPlan("auto", { download: true, message: true, messageLink: true }, 100)),
      ["download/embedded", "download/link", "message/embedded", "message/link", "return/embedded", "return/link"]);
    assert.deepEqual(names(deliveryPlan(undefined, { download: false, message: true }, 100)), ["message/embedded", "return/embedded", "return/link"]);
    assert.deepEqual(names(deliveryPlan("auto", none, 100)), ["return/embedded", "return/link"]);
    assert.deepEqual(names(deliveryPlan("download", { download: true, message: true }, 100)), ["download/embedded", "download/link"]);
    assert.deepEqual(names(deliveryPlan("link", { download: true, message: true, messageLink: true }, 100)), ["download/link", "message/link", "return/link"]);
    assert.deepEqual(names(deliveryPlan("link", { download: false, message: true }, 100)), ["return/link"]);
    assert.throws(() => deliveryPlan("download", none, 100), /not supported by this host. Available: return, link/);
    assert.throws(() => deliveryPlan("message", { download: true, message: false }, 100), /not supported/);
    // size caps: links are capped small, embedded per channel
    assert.deepEqual(names(deliveryPlan("auto", { download: true, message: true }, SIZE_CAPS.message + 1)), ["download/embedded"]);
    assert.deepEqual(names(deliveryPlan("auto", { download: true, message: true }, LINK_CAP + 1)), ["download/embedded", "message/embedded", "return/embedded"]);
    assert.throws(() => deliveryPlan("auto", none, SIZE_CAPS.return + 1), /over the limit.*Try a smaller model/);
    assert.throws(() => deliveryPlan("message", { download: true, message: true }, SIZE_CAPS.message + 1), /Other available: download/);
    assert.throws(() => deliveryPlan("link", { download: true, message: true }, LINK_CAP + 1), /over the limit for delivery "link"/);
    assert.equal(dataUri("model/stl", "QUJD"), "data:model/stl;base64,QUJD");
    assert.equal(bytesToBase64(new Uint8Array([72, 105])), "SGk=");
    assert.equal(bytesToBase64(new Uint8Array(100_000).fill(1)).length, Math.ceil(100_000 / 3) * 4);
  });
  await test("sizing: fixed default, grow for the customizer, conservative cap", () => {
    assert.equal(INLINE_HEIGHT, 400);
    assert.equal(targetHeight({ panelContentHeight: null }), 400);
    assert.equal(targetHeight({ panelContentHeight: 250 }), 400); // never below the default
    assert.equal(targetHeight({ panelContentHeight: 620 }), 620);
    assert.equal(targetHeight({ panelContentHeight: 5000 }), MAX_HEIGHT);
    // host max is an upper bound, never the target
    assert.equal(targetHeight({ panelContentHeight: null, hostMaxHeight: 6000 }), 400);
    assert.equal(targetHeight({ panelContentHeight: 800, hostMaxHeight: 700 }), 700);
    // 0.85 x the device's available height, minus safe-area insets
    assert.equal(heightCap({ panelContentHeight: 0, screenAvailHeight: 800, hostMaxHeight: 6000 }), 680);
    assert.equal(heightCap({ panelContentHeight: 0, screenAvailHeight: 800, safeAreaVertical: 80 }), 600);
    assert.equal(targetHeight({ panelContentHeight: 900, screenAvailHeight: 800 }), 680);
    // tiny screens/hosts never push the cap below the default
    assert.equal(heightCap({ panelContentHeight: 0, screenAvailHeight: 300, hostMaxHeight: 200 }), 400);
    assert.equal(FULL_LAYOUT_HEIGHT, 600);
    // feedback-loop guard
    assert.equal(shouldReport(null, 400), true);
    assert.equal(shouldReport(400, 403), false);
    assert.equal(shouldReport(400, 405), true);
  });
  await test("delayable jobs: a newer call supersedes older ones, and every call settles", async () => {
    (globalThis as any).window ??= globalThis;
    const events: string[] = [];
    const delayable = turnIntoDelayableExecution(15, (id: string) =>
      AbortablePromise<string>((resolve) => {
        events.push(`start ${id}`);
        const t = setTimeout(() => resolve(`done ${id}`), 40);
        return () => { events.push(`kill ${id}`); clearTimeout(t); };
      }));
    const outcome = (p: Promise<string>) => p.then((v) => v, (e) => (e instanceof SupersededError ? "superseded" : `error ${e}`));
    // 1. a debounced call replaced before its timer fires never runs and rejects instead of hanging
    const a = outcome(delayable("a")({ now: false }));
    const b = outcome(delayable("b")({ now: true }));
    assert.deepEqual(await Promise.all([a, b]), ["superseded", "done b"]);
    assert.deepEqual(events, ["start b"]);
    // 2. a running job replaced by a newer call is killed and its call rejects
    events.length = 0;
    const c = outcome(delayable("c")({ now: true }));
    await new Promise((r) => setTimeout(r, 10));
    const d = outcome(delayable("d")({ now: true }));
    assert.deepEqual(await Promise.all([c, d]), ["superseded", "done d"]);
    assert.deepEqual(events, ["start c", "kill c", "start d"]);
    // 3. an older job that finishes does not clear the kill signal of a newer one
    events.length = 0;
    const e1 = outcome(delayable("e")({ now: true }));
    assert.equal(await e1, "done e");
    const f1 = outcome(delayable("f")({ now: true }));
    const g1 = outcome(delayable("g")({ now: true }));
    assert.deepEqual(await Promise.all([f1, g1]), ["superseded", "done g"]);
    assert.ok(events.includes("kill f"));
  });
  await test("EditorValueSync: typing is never fed back, external changes still apply", () => {
    const sync = new EditorValueSync("start");
    // The user types a, b, c; renders (and the library's effects) lag behind the editor.
    sync.emitted("starta");
    sync.emitted("startab");
    assert.equal(sync.valueProp("starta"), "start", "stale echo: the prop does not follow typing");
    sync.emitted("startabc");
    assert.equal(sync.valueProp("startab"), "start");
    assert.equal(sync.valueProp("startabc"), "start", "caught up: still the same prop (the editor already has the text)");
    // Echo of the same text again (re-render without change).
    assert.equal(sync.valueProp("startabc"), "start");
    // A restore to an older text whose echo was already seen is an external change (undo, tool edit).
    assert.equal(sync.valueProp("starta"), "starta");
    // File switch / tool edit with nothing typed.
    assert.equal(sync.valueProp("cube(1);"), "cube(1);");
    // After an external change typing resumes and is still not fed back.
    sync.emitted("cube(1);x");
    assert.equal(sync.valueProp("cube(1);x"), "cube(1);");
    // Backspace to the prop text: still fine.
    sync.emitted("cube(1);");
    assert.equal(sync.valueProp("cube(1);"), "cube(1);");
    // Unrelated external text while typing in flight is passed through.
    sync.emitted("cube(1);y");
    assert.equal(sync.valueProp("from a tool"), "from a tool");
  });
  await test("loading state machine: waiting -> loading -> rendering -> done, plus error/cancelled/timeout and the delay", () => {
    const base: LoadingInputs = { now: 1000, mountedAt: 1000, inputAt: null, cancelled: false, busy: false, hasOutput: false };
    const at = (ms: number, over: Partial<LoadingInputs> = {}) => ({ ...base, now: 1000 + ms, ...over });
    // No flash for fast loads: nothing is shown before the delay.
    assert.deepEqual(loadingView(at(0)), { phase: "waiting", showBar: false, message: null });
    assert.equal(loadingView(at(SHOW_DELAY_MS - 1)).showBar, false);
    assert.deepEqual(loadingView(at(SHOW_DELAY_MS)), { phase: "waiting", showBar: true, message: "Waiting for the assistant…" });
    // Input received: loading the engine, then rendering, then done.
    assert.equal(loadingView(at(500, { inputAt: 1300 })).message, "Loading OpenSCAD engine…");
    assert.equal(loadingView(at(500, { inputAt: 1300, busy: true })).message, "Rendering…");
    assert.deepEqual(loadingView(at(900, { inputAt: 1300, hasOutput: true })), { phase: "done", showBar: false, message: null });
    // Input that was already there at mount (delivered before the view mounted) skips "waiting".
    assert.equal(loadingPhase(at(10, { inputAt: 1000 })), "loading");
    // Errors win over progress and hide the bar immediately (no delay), cancellation too.
    const err = loadingView(at(10, { inputAt: 1000, busy: true, error: "syntax error" }));
    assert.deepEqual([err.phase, err.showBar, err.message], ["error", false, "Could not render: syntax error"]);
    assert.deepEqual(loadingView(at(10, { cancelled: true })), { phase: "cancelled", showBar: false, message: "The tool call was cancelled" });
    // Never spins forever: after the timeout without input, say so.
    assert.equal(loadingPhase(at(NO_INPUT_TIMEOUT_MS - 1)), "waiting");
    const t = loadingView(at(NO_INPUT_TIMEOUT_MS));
    assert.deepEqual([t.phase, t.showBar, t.message], ["timeout", false, "No input received"]);
    assert.ok(t.hint && /call the tool again/.test(t.hint));
    // Input arriving after the timeout recovers.
    assert.equal(loadingPhase(at(NO_INPUT_TIMEOUT_MS + 5, { inputAt: 1000 + NO_INPUT_TIMEOUT_MS + 1 })), "loading");
  });
  await test("notification policy: full UI unchanged, embed only shows what needs attention", () => {
    // Full UI: everything is a visible toast.
    for (const level of ["info", "success", "warn", "error"] as const) {
      assert.deepEqual(decideNotification(false, level), { visible: true, announceOnly: false });
    }
    // Embed: camera/view notices and other non-essential info/success are announced only.
    assert.deepEqual(decideNotification(true, "info"), { visible: false, announceOnly: true });
    assert.deepEqual(decideNotification(true, "success"), { visible: false, announceOnly: true });
    // ...errors and warnings stay visible, and so does the sole feedback of an explicit click.
    assert.equal(decideNotification(true, "error").visible, true);
    assert.equal(decideNotification(true, "warn").visible, true);
    assert.equal(decideNotification(true, "success", { essential: true }).visible, true);
    // Routing: a hidden notice reaches the live region and never the toast.
    const toasts: string[] = [], said: string[] = [];
    const sinks = { toast: (_l: string, t: string) => toasts.push(t), announce: (t: string) => said.push(t) };
    notify(true, sinks, "info", "Front view");
    notify(false, sinks, "info", "Top view");
    notify(true, sinks, "error", "Render failed");
    assert.deepEqual(toasts, ["Top view", "Render failed"]);
    assert.deepEqual(said, ["Front view"]);
  });
  await test("export-source: filename, mime and content of a .scad download", () => {
    const files = [{ path: "/playground.scad", content: "cube(10); // é\n" }, { path: "/lib/gear box.scad", content: "module g(){}\n" }, { path: "/empty.scad" }];
    const a = exportSource(files, "/playground.scad");
    assert.equal(a.filename, "playground.scad");
    assert.equal(a.mimeType, "text/x-openscad;charset=utf-8");
    assert.equal(Buffer.from(a.base64, "base64").toString("utf8"), "cube(10); // é\n", "bytes decode to the source (UTF-8)");
    assert.equal(a.size, Buffer.byteLength("cube(10); // é\n")); // é is two bytes
    assert.equal(a.path, "/playground.scad");
    // another file, named after it (sanitized), and a custom name
    assert.equal(exportSource(files, "/playground.scad", "/lib/gear box.scad").filename, "gear box.scad");
    assert.equal(exportSource(files, "/playground.scad", undefined, "../my part?.SCAD").filename, "my part_.scad");
    assert.equal(exportSource(files, "/empty.scad").size, 0);
    assert.equal(sourceStem("/x/.scad"), "playground");
    assert.equal(sourceStem("/foo.bar.scad"), "foo.bar");
    assert.throws(() => exportSource(files, "/playground.scad", "/nope.scad"), (e) => e instanceof ExportError && /No such file: \/nope\.scad/.test(e.message));
    assert.equal(parseFormat("scad", true), "scad", "scad is valid for 2D and 3D models");
    assert.equal(parseFormat("SCAD", false), "scad");
  });
  await test("download_model scad: the source, no render needed, same delivery chain", async () => {
    const h = mockHost({ "/playground.scad": "cube(5);\n", "/lib/a.scad": "module a(){}\n" });
    const { call } = tools(h);
    h.setDiagnostics([err()]); // a broken render does not matter for the source
    h.setCaps({ download: true, message: true });
    const r = await call("download_model", { format: "scad" });
    assert.ok(!r.isError, textOf(r));
    assert.match(textOf(r), /Downloaded playground\.scad\. playground\.scad: 9 bytes .*format scad, text\/x-openscad;charset=utf-8, delivery: download/);
    assert.deepEqual(h.log, ["deliver download/embedded playground.scad"], "no render was started");
    h.log.length = 0;
    assert.match(textOf(await call("download_model", { format: "scad", path: "a.scad", delivery: "message" })), /Sent a\.scad to the chat/);
    h.setCaps({ download: false, message: false });
    const ret = await call("download_model", { format: "scad", delivery: "return", filename: "my model" });
    const res = ret.content.find((c) => c.type === "resource") as { resource: { blob: string; mimeType: string; uri: string } };
    assert.equal(res.resource.uri, "file:///my%20model.scad");
    assert.equal(res.resource.mimeType, "text/x-openscad;charset=utf-8");
    assert.equal(Buffer.from(res.resource.blob, "base64").toString("utf8"), "cube(5);\n");
    const link = await call("download_model", { format: "scad", delivery: "link" });
    assert.ok((link.content.find((c) => c.type === "resource_link") as { uri: string }).uri.startsWith("data:text/x-openscad;charset=utf-8;base64,"));
    // errors
    assert.match(textOf(await call("download_model", { format: "scad", path: "nope.scad" })), /No such file/);
    assert.match(textOf(await call("download_model", { format: "stl", path: "a.scad" })), /path only applies to format "scad"/);
  });
  await test("isFramed: top-level false, framed true, cross-origin access throwing means framed", () => {
    const w = {} as { self: unknown; top: unknown };
    w.self = w; w.top = w;
    assert.equal(isFramed(w), false);
    assert.equal(isFramed({ self: {}, top: {} }), true);
    const thrower = { self: {}, get top(): unknown { throw new Error("SecurityError"); } };
    assert.equal(isFramed(thrower as never), true);
  });

  await test("validateParameterValue edge cases", () => {
    const num = { name: "n", type: "number", initial: 1, min: 0, max: 5 };
    assert.equal(validateParameterValue(num, 5), 5);
    throwsTool(() => validateParameterValue(num, "5"), /expected a number/);
    throwsTool(() => validateParameterValue(num, NaN), /expected a number/);
    const dd = { name: "d", type: "number", initial: 1, options: [{ name: "One", value: 1 }, { name: "Two", value: 2 }] };
    assert.equal(validateParameterValue(dd, "two"), 2);
    throwsTool(() => validateParameterValue(dd, 3), /allowed options: 1 \(One\), 2 \(Two\)/);
  });

  // Tools
  await test("view_source lists files and numbers lines", async () => {
    const { call } = tools();
    const r = await call("view_source", { start_line: 2 });
    assert.ok(!r.isError);
    const t = textOf(r);
    assert.match(t, /\/playground\.scad \(2 lines\) \[active\]/);
    assert.match(t, /\(lines 2-2 of 2\)/);
    assert.match(t, /\s2\tsphere\(5\);/);
    const bad = await call("view_source", { start_line: 9 });
    assert.ok(bad.isError);
    assert.match(textOf(bad), /out of range/);
    assert.ok((await call("view_source", { path: "missing.scad" })).isError);
  });
  await test("str_replace_source edits, reports OK diagnostics and a numbered snippet", async () => {
    const { h, call } = tools();
    const r = await call("str_replace_source", { old_string: "cube(10)", new_string: "cube(20)" });
    assert.ok(!r.isError, textOf(r));
    assert.equal(h.files.get("/playground.scad"), "cube(20);\nsphere(5);\n");
    assert.match(textOf(r), /Replaced 1 occurrence/);
    assert.match(textOf(r), /Render: OK \(preview, 12 ms\) — 0 errors, 0 warning/);
    assert.match(textOf(r), /1\tcube\(20\);/);
  });
  await test("str_replace_source not-found and ambiguous leave the file untouched", async () => {
    const { h, call } = tools(mockHost({ "/playground.scad": "a();\na();\n" }));
    const nf = await call("str_replace_source", { old_string: "zzz", new_string: "y" });
    assert.ok(nf.isError);
    assert.match(textOf(nf), /not found/);
    const amb = await call("str_replace_source", { old_string: "a();", new_string: "b();" });
    assert.ok(amb.isError);
    assert.match(textOf(amb), /2 times \(at lines 1, 2\)/);
    assert.equal(h.files.get("/playground.scad"), "a();\na();\n");
    assert.deepEqual(h.log, []);
    const all = await call("str_replace_source", { old_string: "a();", new_string: "b();", replace_all: true });
    assert.ok(!all.isError);
    assert.equal(h.files.get("/playground.scad"), "b();\nb();\n");
  });
  await test("a render failure after an edit is reported loudly with file:line:col", async () => {
    const h = mockHost();
    h.setDiagnostics([err(2)]);
    const { call } = tools(h);
    const r = await call("insert_source", { line: 1, text: "cube(" });
    assert.ok(r.isError);
    assert.match(textOf(r), /EDIT APPLIED, BUT THE RENDER FAILED/);
    assert.match(textOf(r), /\/playground\.scad:2:1: error: syntax error/);
    assert.match(textOf(r), /OpenSCAD log \(tail/);
  });
  await test("a render timeout is not an error but says so", async () => {
    const h = mockHost();
    h.setTimedOut(true);
    const r = await tools(h).call("write_source", { content: "cube(1);\n" });
    assert.ok(!r.isError);
    assert.match(textOf(r), /STILL RUNNING/);
  });
  await test("insert_source / delete_source_lines edit and validate ranges", async () => {
    const { h, call } = tools();
    assert.ok(!(await call("insert_source", { line: 2, text: "cylinder(1);" })).isError);
    assert.equal(h.files.get("/playground.scad"), "cube(10);\nsphere(5);\ncylinder(1);\n");
    assert.ok((await call("insert_source", { line: 9, text: "x" })).isError);
    assert.ok(!(await call("delete_source_lines", { start_line: 1, end_line: 2 })).isError);
    assert.equal(h.files.get("/playground.scad"), "cylinder(1);\n");
    assert.ok((await call("delete_source_lines", { start_line: 5 })).isError);
  });
  await test("write_source creates files (optionally active); delete_source_file protects the last file", async () => {
    const { h, call } = tools();
    const r = await call("write_source", { path: "lib/gear.scad", content: "module g(){}\n", activate: true });
    assert.ok(!r.isError);
    assert.match(textOf(r), /Created \/lib\/gear\.scad/);
    assert.equal(h.host.snapshot().activePath, "/lib/gear.scad");
    assert.ok(!(await call("delete_source_file", { path: "gear.scad" })).isError);
    assert.equal(h.host.snapshot().activePath, "/playground.scad");
    const last = await call("delete_source_file", { path: "/playground.scad" });
    assert.ok(last.isError);
    assert.match(textOf(last), /only remaining/);
  });
  await test("undo_source_edit restores, handles created files, and refuses over foreign changes", async () => {
    const { h, call } = tools();
    assert.ok((await call("undo_source_edit")).isError); // nothing yet
    await call("str_replace_source", { old_string: "cube(10)", new_string: "cube(99)" });
    await call("write_source", { path: "/b.scad", content: "x();\n" });
    assert.ok(!(await call("undo_source_edit")).isError);
    assert.ok(!h.files.has("/b.scad"));
    h.files.set("/playground.scad", "user typed this\n");
    const refused = await call("undo_source_edit");
    assert.ok(refused.isError);
    assert.match(textOf(refused), /changed since/);
    h.files.set("/playground.scad", "cube(99);\nsphere(5);\n");
    assert.ok(!(await call("undo_source_edit")).isError);
    assert.equal(h.files.get("/playground.scad"), "cube(10);\nsphere(5);\n");
  });
  await test("get_parameters lists schema, options, ranges, and says so when there are none", async () => {
    const h = mockHost();
    const { call } = tools(h);
    const t = textOf(await call("get_parameters"));
    assert.match(t, /\[Dimensions\]/);
    assert.match(t, /width = 30\s+number, range 10\.\.100 step 1\s+— Box width/);
    assert.match(t, /style = "round"\s+string, options: "round" \(Round\), "sq" \(Square\)/);
    assert.match(t, /size = \[1,2,3\]\s+number\[3\]/);
    h.setParams([]);
    assert.match(textOf(await call("get_parameters")), /declares no customizer variables/);
  });
  await test("set_parameters validates everything first and lists every problem", async () => {
    const h = mockHost();
    const { call } = tools(h);
    const bad = await call("set_parameters", { values: { nope: 1, width: 500, style: "triangle", lid: "yes", size: [1, 2] } });
    assert.ok(bad.isError);
    const t = textOf(bad);
    assert.match(t, /No parameter was changed/);
    assert.match(t, /nope: unknown parameter\. Known: width, style, lid, size/);
    assert.match(t, /width: 500 is out of range 10\.\.100/);
    assert.match(t, /style: "triangle" is not one of the allowed options: "round" \(Round\), "sq" \(Square\)/);
    assert.match(t, /lid: expected a boolean/);
    assert.match(t, /size: expected an array of 3 numbers/);
    assert.deepEqual(h.log, []);
  });
  await test("set_parameters applies valid values (labels map to values), skips unchanged", async () => {
    const h = mockHost();
    const { call } = tools(h);
    const ok = await call("set_parameters", { values: { width: 50, style: "Square", size: [2, 2, 2] } });
    assert.ok(!ok.isError, textOf(ok));
    assert.match(textOf(ok), /Set width=50, style="sq", size=\[2,2,2\]/);
    assert.deepEqual(h.log, ['params {"width":50,"style":"sq","size":[2,2,2]}']);
    const again = await call("set_parameters", { values: { width: 50 } });
    assert.match(textOf(again), /No change/);
    assert.equal(h.log.length, 1);
    assert.match(textOf(await call("get_parameters")), /width = 50 \*\(default 30\)/);
  });
  await test("reset_parameters resets all or named, rejects unknown names", async () => {
    const h = mockHost();
    const { call } = tools(h);
    assert.match(textOf(await call("reset_parameters")), /No change/);
    await call("set_parameters", { values: { width: 50, lid: false } });
    assert.ok(!(await call("reset_parameters", { names: ["width"] })).isError);
    assert.match(textOf(await call("get_parameters")), /lid = false \*/);
    assert.ok((await call("reset_parameters", { names: ["zzz"] })).isError);
    await call("reset_parameters");
    assert.doesNotMatch(textOf(await call("get_parameters")), /\*\(default/);
  });
  await test("set_layout switches mode/overlay, reports layout in get_viewer_state, validates", async () => {
    const h = mockHost();
    const { call } = tools(h);
    assert.match(textOf(await call("get_viewer_state")), /Layout: embed; customizer overlay closed/);
    assert.match(textOf(await call("set_layout", { customizer_overlay: "open" })), /embed; customizer overlay open/);
    assert.match(textOf(await call("set_layout", { customizer_overlay: "toggle" })), /overlay closed/);
    assert.ok((await call("set_layout", { editor: true })).isError, "panels need full mode");
    assert.match(textOf(await call("set_layout", { mode: "full" })), /Layout: full/);
    h.setParams([]);
    assert.ok((await call("set_layout", { customizer_overlay: "open" })).isError);
  });
  await test("render_model starts a full render and reports failure as an error", async () => {
    const h = mockHost();
    const { call } = tools(h);
    assert.ok(!(await call("render_model")).isError);
    assert.ok(h.log.includes("full-render"));
    h.setDiagnostics([err()]);
    assert.ok((await call("render_model")).isError);
  });
  await test("set_camera / orbit_camera / get_camera / set_view_options", async () => {
    const h = mockHost();
    const { call } = tools(h);
    const r = await call("set_camera", { view: "top" });
    assert.ok(!r.isError);
    assert.match(textOf(r), /elevation 90deg/);
    assert.ok((await call("set_camera", { zoom: 2, distance: 3 })).isError);
    assert.ok((await call("set_camera", { elevation_deg: 120 })).isError); // zod range
    const o = await call("orbit_camera", { azimuth_deg: 90, zoom_factor: 2 });
    assert.ok(!o.isError, textOf(o));
    assert.equal(h.camera().radius, 5);
    assert.match(textOf(await call("get_camera")), /distance 5/);
    assert.ok((await call("set_view_options", {})).isError);
    assert.ok(!(await call("set_view_options", { show_axes: true })).isError);
    assert.ok(h.log.includes("axes true"));
  });
  await test("screenshot returns one image per view and restores the camera", async () => {
    const h = mockHost();
    const { call } = tools(h);
    const before = h.camera().theta;
    const r = await call("screenshot", { views: ["iso", "front", "top"], format: "jpeg", max_size: 256 });
    assert.ok(!r.isError, textOf(r));
    const images = r.content.filter((c) => c.type === "image");
    assert.equal(images.length, 3);
    assert.equal((images[0] as { mimeType: string }).mimeType, "image/jpeg");
    assert.equal(h.captures.length, 3);
    assert.equal(h.captures[0].opts.maxSize, 256);
    assert.equal(h.camera().theta, before); // restored
    const kept = await call("screenshot", { camera: { azimuth_deg: 180 }, keep_camera: true });
    assert.equal(kept.content.filter((c) => c.type === "image").length, 1);
    assert.notEqual(h.camera().theta, before);
  });
  await test("screenshot warns when the last render failed", async () => {
    const h = mockHost();
    h.setDiagnostics([err()]);
    const r = await tools(h).call("screenshot");
    assert.ok(!r.isError);
    assert.match(textOf(r), /last render FAILED/);
  });
  await test("render_model passes the mode", async () => {
    const h = mockHost();
    const { call } = tools(h);
    await call("render_model");
    await call("render_model", { mode: "preview" });
    assert.deepEqual(h.log, ["full-render", "preview-render"]);
    assert.ok((await call("render_model", { mode: "weird" })).isError);
  });
  await test("download_model: auto delivery follows host capabilities, renders in full first", async () => {
    const h = mockHost();
    const { call } = tools(h);
    h.setCaps({ download: true, message: true });
    const r = await call("download_model", { format: "glb", filename: "box" });
    assert.ok(!r.isError, textOf(r));
    assert.match(textOf(r), /Downloaded box\.glb\. box\.glb: \d+ bytes .*format glb, model\/gltf-binary, delivery: download, form: embedded resource/);
    assert.deepEqual(h.log, ["full-render", "deliver download/embedded box.glb"]); // preview output => full render first
    h.log.length = 0;
    h.setCaps({ download: false, message: true });
    assert.match(textOf(await call("download_model")), /Sent playground\.stl to the chat.*delivery: message/);
    h.setCaps({ download: false, message: false });
    const ret = await call("download_model", { format: "off" });
    assert.ok(!ret.isError);
    const res = ret.content.find((c) => c.type === "resource") as { resource: { blob: string; mimeType: string; uri: string } };
    assert.equal(res.resource.mimeType, "model/off");
    assert.equal(res.resource.uri, "file:///playground.off");
    assert.ok(res.resource.blob.length > 0);
    assert.match(textOf(ret), /delivery: return, form: embedded resource/);
  });
  await test("download_model: resource_link delivery and fallbacks between forms", async () => {
    const h = mockHost();
    const { call } = tools(h);
    h.setCaps({ download: true, message: true, messageLink: true });
    // host throws on embedded resources: auto falls through to the link form of the same channel
    h.opts.rejectEmbedded = true;
    const viaLink = await call("download_model");
    assert.ok(!viaLink.isError, textOf(viaLink));
    assert.match(textOf(viaLink), /delivery: download, form: resource_link \(data: URI\)/);
    assert.deepEqual(h.log.filter((l) => l.startsWith("deliver")), ["deliver download/embedded playground.stl", "deliver download/link playground.stl"]);
    h.opts.rejectEmbedded = false;
    h.log.length = 0;
    assert.match(textOf(await call("download_model", { delivery: "link" })), /delivery: download, form: resource_link/);
    h.setCaps({ download: false, message: false });
    const ret = await call("download_model", { delivery: "link", format: "glb" });
    const link = ret.content.find((c) => c.type === "resource_link") as { uri: string; name: string; mimeType: string; size: number };
    assert.ok(link.uri.startsWith("data:model/gltf-binary;base64,"));
    assert.equal(link.name, "playground.glb");
    assert.ok(link.size > 0);
    h.opts.bigFile = true;
    assert.match(textOf(await call("download_model", { delivery: "link" })), /over the limit for delivery "link"/);
  });
  await test("download_model: errors are explicit", async () => {
    const h = mockHost();
    const { call } = tools(h);
    assert.match(textOf(await call("download_model", { delivery: "download" })), /not supported by this host. Available: return, link/);
    assert.match(textOf(await call("download_model", { format: "svg" })), /SVG is not available for this 3D model/);
    h.opts.bigFile = true;
    assert.match(textOf(await call("download_model", { delivery: "return" })), /over the limit for delivery/);
    h.setDiagnostics([err()]);
    const failed = await call("download_model");
    assert.ok(failed.isError);
    assert.match(textOf(failed), /last render failed/);
  });
  await test("every tool has MCP annotations; mutating source tools are destructive, readers read-only", () => {
    const defs = createTools(async () => mockHost().host);
    for (const d of defs) assert.ok(d.annotations && Object.keys(d.annotations).length > 0, `${d.name} lacks annotations`);
    for (const d of defs) assert.equal(d.annotations!.openWorldHint, false, `${d.name} should declare openWorldHint: false`);
    const a = (n: string) => defs.find((d) => d.name === n)!.annotations!;
    for (const n of ["view_source", "get_viewer_state", "get_parameters", "get_camera", "screenshot"]) assert.equal(a(n).readOnlyHint, true, n);
    for (const n of ["str_replace_source", "insert_source", "delete_source_lines", "write_source", "delete_source_file", "undo_source_edit"]) assert.equal(a(n).destructiveHint, true, n);
    for (const n of ["set_camera", "orbit_camera", "set_layout", "set_view_options", "download_model", "render_model"]) assert.equal(a(n).destructiveHint, false, n);
  });
  await test("tool names are unique and every tool has a description", () => {
    const defs = createTools(async () => mockHost().host);
    assert.equal(new Set(defs.map((d) => d.name)).size, defs.length);
    for (const d of defs) assert.ok(d.description.length > 40, d.name);
    console.log(`    (${defs.length} tools: ${defs.map((d) => d.name).join(", ")})`);
  });

  console.log(`${passed} test(s) passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
