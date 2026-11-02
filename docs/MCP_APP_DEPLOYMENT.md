# Deploying the MCP app

The playground can run as an [MCP App](https://github.com/modelcontextprotocol/ext-apps):
an MCP server (`server/`) exposes a `create` tool whose UI resource is a small
HTML page that loads the playground's JS, worker, WASM and libraries from an
**asset base URL**. This page explains how to host both parts. For local
development see [server/README.md](../server/README.md).

## Pieces

| Piece | What | Where it runs |
|---|---|---|
| Static app | `dist/` from `npm run build:all` | any static host / CDN |
| MCP server | `server/index.ts` (stateless, Streamable HTTP at `/mcp`) | Node, or a serverless function |

The recommended setup serves both from one deployment: the web app at `/` and
the MCP endpoint at `/mcp`. The server then needs **no configuration**: it
derives the asset base URL from each request (`Host`, or `X-Forwarded-Host` /
`X-Forwarded-Proto` behind a trusted proxy such as Vercel), so it works on any
host, including preview URLs. Set `OPENSCAD_ALLOWED_HOSTS` to restrict which
hosts are accepted. To serve assets from elsewhere (a CDN), set
`OPENSCAD_BASE_URL` (trailing slash), which always wins, e.g.
`https://assets.example.com/`. The base is embedded in the UI resource as `<meta name="openscad-base-url">` and its
origin is added to the CSP (`resourceDomains`, `connectDomains`; `blob:` and
`data:` are always added to `connectDomains`).

## Requirements on the asset host

- Serves `dist/` including `openscad-worker.js`, `openscad.wasm`, `libraries/*.zip`.
- Sends CORS headers (`Access-Control-Allow-Origin: *`): the MCP host renders the
  app in a sandboxed iframe on a different origin, so everything is cross-origin.
- Optional: `openscad.fallback.js` next to the other files, for browsers without
  WebAssembly ([WASM_FALLBACK.md](WASM_FALLBACK.md)). It is not built by
  `npm run build:all`; build it separately and copy it into the deployed directory.

## Example: Vercel

[`vercel.example.json`](vercel.example.json) is an **example only** (copy it to
the repository root as `vercel.json` in your own fork or deployment branch; it is
deliberately not at the root here). It:

1. installs with `npm ci` (root and `server/`),
2. builds `dist/` with `npm run build:all`,
3. bundles `server/` into a single file with esbuild, used by a thin function
   `api/mcp.ts` that creates a fresh server + transport per request,
4. rewrites `/mcp` to that function and adds CORS headers.

The function file is not provided; a minimal version:

```ts
// api/mcp.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { createServer, NodeStreamableHTTPServerTransport } = require("./_server.js");
  const { resolveBaseUrl } = require("./_server.js");
  const server = createServer(resolveBaseUrl(req));
  const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
```

with `server/vercel-entry.ts` re-exporting `createServer` from
`./openscad-server.js`, `resolveBaseUrl` from `./base-url.js` and `NodeStreamableHTTPServerTransport` from
`@modelcontextprotocol/node`.

Then in the project settings:

- No `OPENSCAD_BASE_URL` is needed (the base follows the request host). Optionally
  set `OPENSCAD_ALLOWED_HOSTS=openscad.example.com,*.vercel.app`.
- Add the custom domain and DNS record at your registrar.

You get `https://openscad.example.com/` (the playground) and
`https://openscad.example.com/mcp` (the MCP endpoint to register in an MCP host).

## Other platforms

Run `cd server && npm ci && PORT=8080 npx tsx index.ts`
behind your usual process manager, and publish `dist/` anywhere that satisfies
the requirements above. With `OPENSCAD_SERVE_DIST=1` the server also serves
`dist/` itself, and the asset base follows the request host (set `OPENSCAD_TRUST_PROXY=1` behind a reverse proxy, and `OPENSCAD_BASE_URL` if assets live elsewhere).
