import { isFramed } from './embed.ts';

/**
 * Running as an MCP app: framed AND loaded from the MCP resource HTML (which
 * carries the `openscad-base-url` meta tag). A plain iframe of the web app is
 * not an MCP app (there is no host to handshake with) and runs standalone.
 *
 * (Kept apart from mcp-app.ts, which pulls in the MCP SDK: the standalone app
 * only loads that code in MCP mode.)
 */
export function isMcpMode(): boolean {
  if (!isFramed()) return false;
  return document.querySelector('meta[name="openscad-base-url"]') != null;
}
