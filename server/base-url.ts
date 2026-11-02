/**
 * Resolves the asset base URL (where the playground's JS, worker, WASM and
 * libraries are served from) for an incoming request, so the app works from
 * whichever host serves it without configuration.
 *
 * Precedence:
 *  1. OPENSCAD_BASE_URL (explicit override, always wins)
 *  2. the request's own origin (Host, or X-Forwarded-Host/-Proto when behind a
 *     trusted proxy), if it is a valid hostname[:port] and allowed by
 *     OPENSCAD_ALLOWED_HOSTS (when set)
 *  3. VERCEL_PROJECT_PRODUCTION_URL, then VERCEL_URL
 *  4. the public playground
 *
 * X-Forwarded-* headers are only honoured when OPENSCAD_TRUST_PROXY is set or
 * the server runs on Vercel (VERCEL is set), since otherwise any client could
 * choose the origin that ends up in the CSP.
 */

export const DEFAULT_BASE_URL = "https://ochafik.com/openscad2/";

// hostname (letters, digits, hyphens, dots) or bracketed IPv6, optional port.
const HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*|\[[0-9a-f:]+\])(?::\d{1,5})?$/i;

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  socket?: object;
}

function ensureSlash(u: string): string {
  return u.endsWith("/") ? u : u + "/";
}

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.split(",")[0].trim() || undefined;
}

function trustProxy(env: NodeJS.ProcessEnv): boolean {
  return !!env.OPENSCAD_TRUST_PROXY || !!env.VERCEL;
}

function hostAllowed(host: string, env: NodeJS.ProcessEnv): boolean {
  const allowed = env.OPENSCAD_ALLOWED_HOSTS?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed?.length) return true;
  const h = host.toLowerCase();
  const name = h.replace(/:\d+$/, "");
  return allowed.some(a => a === h || a === name || (a.startsWith("*.") && name.endsWith(a.slice(1))));
}

/** Env-only part of the chain (no request): stdio, or an unusable request. */
export function envBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.OPENSCAD_BASE_URL) return ensureSlash(env.OPENSCAD_BASE_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}/`;
  return DEFAULT_BASE_URL;
}

export function resolveBaseUrl(req?: RequestLike, env: NodeJS.ProcessEnv = process.env): string {
  if (env.OPENSCAD_BASE_URL) return ensureSlash(env.OPENSCAD_BASE_URL);
  if (req) {
    const trusted = trustProxy(env);
    const host = (trusted ? first(req.headers["x-forwarded-host"]) : undefined) ?? first(req.headers["host"]);
    if (host && HOST_RE.test(host) && hostAllowed(host, env)) {
      let proto = trusted ? first(req.headers["x-forwarded-proto"])?.toLowerCase() : undefined;
      if (proto !== "http" && proto !== "https") proto = (req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http";
      return `${proto}://${host.toLowerCase()}/`;
    }
  }
  return envBaseUrl(env);
}
