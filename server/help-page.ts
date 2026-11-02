/**
 * Content negotiation for stray browsers: a person who opens the MCP endpoint
 * in a tab gets an explanatory page instead of a protocol error.
 *
 * Client setup instructions below were checked against the vendors' docs on
 * 2026-11-02 (support.claude.com custom connectors, code.claude.com/docs/en/mcp,
 * code.visualstudio.com mcp-configuration reference, cursor.com/docs/mcp,
 * npm mcp-remote, modelcontextprotocol.io inspector). ChatGPT's UI for custom
 * MCP servers is in flux, so it is only mentioned generically.
 */

export interface HeadersLike {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
}

function header(req: HeadersLike, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v.join(",") : v;
}

/**
 * True for a browser navigation to the endpoint: GET/HEAD whose Accept lists
 * text/html, with no MCP-specific headers and no text/event-stream or
 * application/json offered (curl's wildcard Accept is not a browser).
 */
export function wantsHtml(req: HeadersLike): boolean {
  const method = (req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  if (header(req, "mcp-session-id") || header(req, "mcp-protocol-version")) return false;
  const accept = header(req, "accept")?.toLowerCase();
  if (!accept) return false;
  const types = accept.split(",").map(s => s.split(";")[0].trim());
  if (types.includes("text/event-stream") || types.includes("application/json")) return false;
  return types.includes("text/html") || types.includes("application/xhtml+xml");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** `baseUrl` is the validated request origin from resolveBaseUrl(), e.g. "https://host/". */
export function renderHelpPage(baseUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const url = `${origin}/mcp`;
  const u = esc(url);
  const json = esc(JSON.stringify({ mcpServers: { openscad: { type: "http", url } } }, null, 2));
  const vscodeJson = esc(JSON.stringify({ servers: { openscad: { type: "http", url } } }, null, 2));
  const remoteJson = esc(JSON.stringify({ mcpServers: { openscad: { command: "npx", args: ["-y", "mcp-remote", url] } } }, null, 2));
  const code = (id: string, text: string) =>
    `<div class="code"><pre id="${id}">${text}</pre><button type="button" class="copy" data-copy="${id}" hidden>Copy</button></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>OpenSCAD MCP App</title>
<style>
:root{--bg:#fafaf8;--fg:#1d1d1b;--muted:#5f5f5a;--card:#fff;--line:#deddd6;--accent:#b8860b;--code:#f1f0ea;--link:#0b5fb3}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecebe6;--muted:#a3a29b;--card:#1f1f1d;--line:#34332f;--accent:#e0b13c;--code:#262624;--link:#7ab6f5}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 16px 3rem}
h1{font-size:1.9rem;margin:0 0 .5rem}
h1::before{content:"";display:inline-block;width:.8em;height:.8em;margin-right:.45em;border:3px solid var(--accent);border-radius:3px;transform:rotate(45deg) scale(.8)}
h2{font-size:1.15rem;margin:2rem 0 .6rem}
p{margin:.5rem 0}
a{color:var(--link)}
.muted{color:var(--muted);font-size:.92rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.9rem 1rem;margin:.7rem 0}
.card h3{margin:0 0 .3rem;font-size:1rem}
.code{position:relative;margin:.4rem 0}
pre{margin:0;padding:.65rem 4.5rem .65rem .8rem;background:var(--code);border:1px solid var(--line);border-radius:8px;font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.copy{position:absolute;top:.4rem;right:.4rem;font:inherit;font-size:.8rem;padding:.2rem .6rem;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
.copy:hover{border-color:var(--accent)}
.hero pre{font-size:15px}
ol{padding-left:1.3rem;margin:.3rem 0}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line)}
</style>
</head>
<body>
<main>
<h1>OpenSCAD MCP App</h1>
<p>This address is an <a href="https://modelcontextprotocol.io">MCP</a> server, not a web page. It opens an interactive OpenSCAD 3D viewer and editor inside AI chat clients that support MCP Apps. The model gets tools to read and edit the source, tweak customizer parameters, move the camera and take screenshots, so you can design parametric models by chatting.</p>

<h2>Server URL</h2>
<div class="hero">${code("url", u)}</div>

<h2>Add it to your client</h2>
<div class="card"><h3>Claude (claude.ai and Claude Desktop)</h3>
<ol><li>Open <b>Settings → Connectors</b> (labelled <b>Customize → Connectors</b> in some versions).</li>
<li>Choose <b>Add custom connector</b>.</li>
<li>Enter a name (for example <i>OpenSCAD</i>), paste the URL above, and click <b>Add</b>. No sign-in is needed.</li></ol>
<p class="muted">On Team and Enterprise plans an organization owner adds the connector under Organization settings.</p></div>

<div class="card"><h3>Claude Code</h3>
${code("cc", "claude mcp add --transport http openscad " + u)}</div>

<div class="card"><h3>VS Code</h3>
<p>Run <b>MCP: Add Server → HTTP</b>, or put this in <code>.vscode/mcp.json</code>:</p>
${code("vsc", vscodeJson)}</div>

<div class="card"><h3>Cursor, and other clients with an <code>mcpServers</code> config</h3>
<p>Add to <code>~/.cursor/mcp.json</code> (or the client's equivalent). Cursor only needs <code>url</code>; other clients may want <code>type</code> too.</p>
${code("json", json)}
<p>For clients that only speak stdio, bridge with <a href="https://www.npmjs.com/package/mcp-remote">mcp-remote</a>:</p>
${code("remote", remoteJson)}</div>

<div class="card"><h3>MCP Inspector</h3>
${code("insp", "npx @modelcontextprotocol/inspector")}
<p class="muted">Then choose the <b>Streamable HTTP</b> transport in its UI and paste the URL.</p></div>

<div class="card"><h3>Anything else</h3>
<p>Any client that supports remote MCP servers over Streamable HTTP can use the URL above.</p></div>

<h2>Try it</h2>
${code("prompt", "Make a parametric box with a customizer for width and height, then show me a screenshot from the top")}
<p class="muted">The 3D viewer appears inline only in clients that support MCP Apps UI; other clients still get the tools but no interactive view.</p>

<footer class="muted">
<p>Prefer a browser? Open the <a href="${esc(origin)}/">OpenSCAD web playground</a>. Source and docs: <a href="https://github.com/openscad/openscad-playground">github.com/openscad/openscad-playground</a> (see <a href="https://github.com/openscad/openscad-playground#readme">README</a>).</p>
<p>Licensed GPL-2.0-or-later. Built on <a href="https://openscad.org">OpenSCAD</a>.</p>
</footer>
</main>
<script>
document.querySelectorAll(".copy").forEach(function(b){
  if(!navigator.clipboard)return;
  b.hidden=false;
  b.addEventListener("click",function(){
    navigator.clipboard.writeText(document.getElementById(b.dataset.copy).textContent).then(function(){
      b.textContent="Copied";setTimeout(function(){b.textContent="Copy"},1500);
    },function(){});
  });
});
</script>
</body>
</html>
`;
}

/** Common response headers for the help page. */
export const HELP_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
