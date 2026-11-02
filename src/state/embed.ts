/**
 * Embed mode: just the 3D viewer filling the frame, with a floating
 * customizer button, no tab bar / footer. It is the default when the page is
 * framed (any iframe, including the MCP app, which is just an iframed
 * instance) and can be forced either way from the URL:
 *
 *   ?embed=1  ?embed  #embed=1&src=...  -> embed
 *   ?embed=0  #embed=0&...              -> full UI, even inside an iframe
 *
 * Pure functions (no DOM access) so they can be unit tested.
 */

const TRUE = new Set(['', '1', 'true', 'yes', 'on']);
const FALSE = new Set(['0', 'false', 'no', 'off']);

function parseValue(v: string | null | undefined): boolean | undefined {
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (TRUE.has(s)) return true;
  if (FALSE.has(s)) return false;
  return undefined;
}

/** `embed` override from `location.search` ("?embed=0") or a leading `embed=` fragment parameter ("#embed=1&src=..."). */
export function parseEmbedOverride(search: string, hash: string): boolean | undefined {
  const fromQuery = parseValue(new URLSearchParams(search).get('embed'));
  if (fromQuery !== undefined) return fromQuery;
  const m = /^#?embed(?:=([^&]*))?(?:&|$)/.exec(hash);
  return m ? parseValue(m[1] ?? '') : undefined;
}

/** Remove a leading `embed=...&` from a fragment (without the `#`), so the remaining state parses as usual. */
export function stripEmbedFromFragment(fragment: string): string {
  return fragment.replace(/^embed(?:=[^&]*)?(?:&|$)/, '');
}

/** Whether `win` is inside a frame. A throwing cross-origin access means we are framed. */
export function isFramed(win: { self: unknown; top: unknown } = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

/** Resolve the embed default: explicit URL override wins both ways, then "are we framed". */
export function resolveEmbed(opts: { search: string; hash: string; framed: boolean }): boolean {
  return parseEmbedOverride(opts.search, opts.hash) ?? opts.framed;
}

/** Same state in a top-level, full-UI window: `?embed=0`, other query parameters kept. */
export function fullAppUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.set('embed', '0');
  url.hash = stripEmbedFromFragment(url.hash.replace(/^#/, '')) ? '#' + stripEmbedFromFragment(url.hash.replace(/^#/, '')) : '';
  return url.toString();
}

/**
 * Absolute URL of the MCP setup page from the build-time OPENSCAD_MCP_URL
 * (absolute, or relative like `/mcp`), or undefined when it is unset, invalid,
 * or the page is framed (an embed or the MCP app itself doesn't advertise it).
 */
export function resolveMcpSetupUrl(raw: string | undefined, base: string, framed: boolean): string | undefined {
  if (!raw || framed) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}
