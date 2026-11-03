#!/usr/bin/env node
// Regression harness for tool-triggered renders racing the initial render of an MCP app session.
//
// Calls the view's app tools (render_model, download_model, str_replace_source, ...) immediately after the viewer
// registers them, while its initial render is still pending, and checks that every call succeeds and that the
// final state is a successful render (before the fixes: "Failed to read output file ... FS error", and
// previewing/checkingSyntax flags stuck on).
//
// Needs an MCP Apps host page that exposes its AppBridge as `window.__appBridge` (the ext-apps `examples/basic-host`
// with a one-line patch: `window.__appBridge = appBridge;` where it creates the bridge) and the OpenSCAD MCP server
// serving dist/:
//   OPENSCAD_SERVE_DIST=1 OPENSCAD_BASE_URL=http://localhost:9100/ PORT=9100 npx tsx server/index.ts
//   SERVERS='["http://localhost:9100/mcp"]' npx tsx examples/basic-host/serve.ts   # host on :8080
//   RUNS=4 [SCENARIO=render-immediately] [HOST_URL=http://localhost:8080] node scripts/verify-mcp-tool-races.mjs
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const scenarios = {
  'render-immediately': async call => [await call('render_model', { mode: 'preview' })],
  'render-full-immediately': async call => [await call('render_model', { mode: 'full' })],
  'download-immediately': async call => [await call('download_model', { format: 'stl', delivery: 'return' })],
  'two-renders-parallel': async call => await Promise.all([call('render_model', { mode: 'preview' }), call('render_model', { mode: 'full' })]),
  'edit-then-render': async call => [await call('str_replace_source', { old_string: 'width = 30;', new_string: 'width = 44;' }), await call('render_model', {})],
  'edits-parallel': async call => await Promise.all([call('str_replace_source', { old_string: 'width = 30;', new_string: 'width = 41;' }), call('render_model', { mode: 'preview' }), call('get_viewer_state')]),
};
const N = Number(process.env.RUNS ?? 4);
const results = {};
for (const [name, run] of Object.entries(scenarios)) {
  if (process.env.SCENARIO && process.env.SCENARIO !== name) continue;
  let fails = 0; const notes = [];
  for (let i = 0; i < N; i++) {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', m => logs.push(m.text()));
    await page.setViewport({ width: 900, height: 700 });
    await page.goto((process.env.HOST_URL ?? 'http://localhost:8080') + '/?server=' + encodeURIComponent('OpenSCAD Playground') + '&tool=create&call=true&caps=download');
    await page.waitForFunction(() => window.__appBridge, { timeout: 30000 });
    const call = (n, a = {}) => Promise.race([page.evaluate((n, a) => window.__appBridge.callTool({ name: n, arguments: a }).catch(e => ({ content: [{ type: 'text', text: 'THROWN ' + e }], isError: true })), n, a), new Promise(r => setTimeout(() => r({ content: [{ type: 'text', text: 'TOOL CALL HUNG (>45s) ' + n }], isError: true }), 45000))]);
    // wait only until the tool is registered (the initial render is typically still running)
    for (let k = 0; k < 100; k++) { const t = await page.evaluate(async () => { try { return (await window.__appBridge.listTools({})).tools.length; } catch { return 0; } }); if (t) break; await new Promise(r => setTimeout(r, 50)); }
    const rs = await run(call);
    const txt = rs.map(r => (r.content ?? []).map(c => c.text ?? `<${c.type}>`).join(' ').slice(0, 220));
    const failed = rs.some(r => r.isError);
    const state = await call('get_viewer_state');
    const finalOk = !state.isError && /Render: OK/.test(state.content[0].text);
    if (failed || !finalOk) { fails++; notes.push({ run: i, results: txt, final: state.content[0].text.split('\n').slice(0, 5).join(' | '), errLogs: logs.filter(l => /ERROR|FS error|Failed to read|Error while/i.test(l)).slice(0, 4) }); }
    await page.close();
  }
  results[name] = { runs: N, failures: fails };
  console.log(`${fails ? 'FAIL' : 'PASS'} ${name}: ${fails}/${N} failed`);
  if (fails) process.exitCode = 1;
  for (const n of notes.slice(0, 2)) console.log('   ', JSON.stringify(n).slice(0, 700));
}
await browser.close();
