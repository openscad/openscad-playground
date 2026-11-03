/**
 * Content negotiation for stray browsers: a person who opens the MCP endpoint
 * in a tab gets an explanatory page instead of a protocol error.
 *
 * One-click links, checked 2026-11-02:
 *  - Claude: https://claude.ai/customize/connectors?modal=add-custom-connector
 *    &connectorName=..&connectorUrl=.. (format supplied and tested by the owner).
 *  - Cursor: cursor://anysphere.cursor-deeplink/mcp/install?name=..&config=<base64
 *    of JSON.stringify(server config)> per https://cursor.com/docs/mcp/install-links
 *    (remote servers use {"url": ..} as in mcp.json).
 *  - VS Code: vscode:mcp/install?<encodeURIComponent(JSON.stringify({name, ...config}))>
 *    and vscode-insiders: per https://code.visualstudio.com/api/extension-guides/ai/mcp
 *  - Button icons: Claude and Cursor glyphs are the Simple Icons paths (CC0,
 *    https://github.com/simple-icons/simple-icons/tree/develop/icons, fetched
 *    2026-11-02). Simple Icons no longer ships a VS Code glyph, so the VS Code
 *    buttons use a generic plug icon rather than invented brand art.
 *  - ChatGPT: no documented prefill link (help.openai.com / developers.openai.com
 *    only describe manual steps), so none is offered. Goose/Windsurf/Zed: no
 *    official, verifiable link spec found; omitted.
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

const SERVER_NAME = "openscad";

const svg = (inner: string, attrs = 'fill="currentColor"') =>
  `<svg class="ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" ${attrs}>${inner}</svg>`;
const strokeAttrs = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON_CLAUDE = svg('<path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>');
const ICON_CURSOR = svg('<path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/>');
const ICON_PLUG = svg('<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4"/>', strokeAttrs);
const ICON_COPY = svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>', strokeAttrs);

/** Deep links that pre-fill "add MCP server" in each client, for the full server URL. */
export function deepLinks(serverUrl: string) {
  const vscode = encodeURIComponent(JSON.stringify({ name: SERVER_NAME, type: "http", url: serverUrl }));
  return {
    claude: `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=OpenSCAD&connectorUrl=${encodeURIComponent(serverUrl)}`,
    cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encodeURIComponent(Buffer.from(JSON.stringify({ url: serverUrl })).toString("base64"))}`,
    vscode: `vscode:mcp/install?${vscode}`,
    vscodeInsiders: `vscode-insiders:mcp/install?${vscode}`,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** `baseUrl` is the validated request origin from resolveBaseUrl(), e.g. "https://host/". */
export function renderHelpPage(baseUrl: string): string {
  const origin = baseUrl.replace(/\/+$/, "");
  const url = `${origin}/mcp`;
  const u = esc(url);
  const links = deepLinks(url);
  const code = (id: string, text: string) =>
    `<div class="code"><pre id="${id}">${text}</pre><button type="button" class="copy" data-copy="${id}" hidden>${ICON_COPY}<span>Copy</span></button></div>`;

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
h1 img{vertical-align:middle;margin-right:.45em;border-radius:9px}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:46rem;margin:0 auto;padding:2rem 16px 3rem}
h1{font-size:1.9rem;margin:0 0 .5rem}
h1::before{content:"";display:inline-block;width:.8em;height:.8em;margin-right:.45em;border:3px solid var(--accent);border-radius:3px;transform:rotate(45deg) scale(.8)}
h2{font-size:1.15rem;margin:2rem 0 .6rem}
p{margin:.5rem 0}
a{color:var(--link)}
.muted{color:var(--muted);font-size:.92rem}
.code{position:relative;margin:.4rem 0}
pre{margin:0;padding:.65rem 4.5rem .65rem .8rem;background:var(--code);border:1px solid var(--line);border-radius:8px;font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.ic{flex-shrink:0;display:block}
.copy{display:inline-flex;align-items:center;gap:.35rem;position:absolute;top:.4rem;right:.4rem;font:inherit;font-size:.8rem;padding:.2rem .6rem;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--fg);cursor:pointer}
.copy:hover{border-color:var(--accent)}
.hero pre{font-size:15px}
.buttons{display:flex;flex-wrap:wrap;gap:.5rem;margin:.8rem 0 .3rem}
.btn{display:inline-flex;align-items:center;gap:.5rem;padding:.45rem .9rem;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);text-decoration:none;font-weight:600;font-size:.95rem}
.btn:hover{border-color:var(--accent)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#1d1d1b;padding:.6rem 1.2rem;font-size:1.05rem}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line)}
</style>
</head>
<body>
<main>
<h1><img src="${esc(origin)}/logo192.png" alt="" width="40" height="40">OpenSCAD MCP App</h1>
<p>This address is an <a href="https://modelcontextprotocol.io">MCP</a> server, not a web page. It opens an interactive OpenSCAD 3D viewer and editor inside AI chat clients that support MCP Apps. The model gets tools to read and edit the source, tweak customizer parameters, move the camera and take screenshots, so you can design parametric models by chatting.</p>

<h2>Server URL</h2>
<div class="hero">${code("url", u)}</div>
<p class="buttons">
<a class="btn primary" href="${esc(links.claude)}" target="_blank" rel="noopener">${ICON_CLAUDE}Add to Claude</a>
<a class="btn" href="${esc(links.cursor)}">${ICON_CURSOR}Add to Cursor</a>
<a class="btn" href="${esc(links.vscode)}">${ICON_PLUG}Add to VS Code</a>
<a class="btn" href="${esc(links.vscodeInsiders)}">${ICON_PLUG}VS Code Insiders</a>
</p>
<p class="muted">These open the client with the server pre-filled. Any client that supports remote MCP servers over Streamable HTTP can use this URL.</p>

<h2>Try it</h2>
${code("prompt", "Make a parametric box with a customizer for width and height, then show me a screenshot from the top")}
<p class="muted">The interactive 3D viewer needs a client with MCP Apps support; other clients can connect but will not show the viewer.</p>

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
      var l=b.querySelector("span");l.textContent="Copied";setTimeout(function(){l.textContent="Copy"},1500);
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
