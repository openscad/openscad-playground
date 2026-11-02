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
import {
  createTools,
  type CameraState,
  type CaptureOptions,
  type Diagnostic,
  type ViewerHost,
  type ViewerSnapshot,
} from "../src/state/mcp-tools.ts";
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

  const snapshot = (): ViewerSnapshot => ({
    activePath: active,
    files: [...files].map(([path, c]) => ({ path, lines: c === "" ? 0 : c.replace(/\n$/, "").split("\n").length, active: path === active })),
    status: "idle",
    timedOut: timedOut || undefined,
    diagnostics,
    logTail: ["Rendering..."],
    hasOutput: true,
    renderKind: "preview",
    elapsedMs: 12,
    parameters: [{ name: "width", type: "number", initial: 30, value: 30, min: 10, max: 100 }],
    showAxes: false,
  });
  const host: ViewerHost = {
    snapshot,
    settle: async () => snapshot(),
    readFile: (p) => files.get(p),
    writeFile: (p, c, o) => { files.set(p, c); if (o?.activate) active = p; log.push(`write ${p}`); },
    removeFile: (p) => { files.delete(p); if (active === p) active = [...files.keys()][0]; },
    startFullRender: () => { log.push("full-render"); },
    setParameters: (v) => { log.push(`params ${JSON.stringify(v)}`); },
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
  await test("set_parameters validates names; get_viewer_state lists parameters", async () => {
    const { h, call } = tools();
    const bad = await call("set_parameters", { values: { nope: 1 } });
    assert.ok(bad.isError);
    assert.match(textOf(bad), /Unknown parameter.*nope.*Known: width/);
    assert.ok(!(await call("set_parameters", { values: { width: 50 } })).isError);
    assert.deepEqual(h.log, ['params {"width":50}']);
    const st = await call("get_viewer_state");
    assert.match(textOf(st), /width = 30 \[30\] \(number range 10\.\.100\)/);
    assert.match(textOf(st), /Active file: \/playground\.scad/);
    assert.match(textOf(st), /azimuth 45deg/);
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
