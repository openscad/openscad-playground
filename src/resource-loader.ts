/**
 * Pluggable resource loader interface.
 * In traditional mode: uses standard fetch().
 * In MCP mode: can use tool-based loading via the MCP server.
 */

export interface ResourceLoader {
  /** Fetch a resource as ArrayBuffer (for WASM, ZIPs, binary files). */
  fetchBinary(url: string): Promise<ArrayBuffer>;
  /** Fetch a resource as text (for JS, CSS, JSON). */
  fetchText(url: string): Promise<string>;
}

/**
 * Read the base URL from a <meta name="openscad-base-url"> tag.
 * Returns empty string if not found (standalone mode).
 */
export function getBaseUrl(): string {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="openscad-base-url"]');
  return meta?.getAttribute('content') ?? '';
}

/**
 * Resolve a relative URL against the configured base URL.
 * In standalone mode (no base URL), returns the original URL.
 */
export function resolveUrl(url: string, base?: string): string {
  const b = base ?? getBaseUrl();
  if (!b) return url;
  return new URL(url, b).href;
}

/**
 * Default resource loader using standard fetch().
 * Resolves relative URLs against the base URL from <meta name="openscad-base-url">.
 */
export class FetchResourceLoader implements ResourceLoader {
  async fetchBinary(url: string): Promise<ArrayBuffer> {
    const resolved = resolveUrl(url);
    const response = await fetch(resolved);
    if (!response.ok) throw new Error(`Failed to fetch ${resolved}: ${response.status}`);
    return response.arrayBuffer();
  }

  async fetchText(url: string): Promise<string> {
    const resolved = resolveUrl(url);
    const response = await fetch(resolved);
    if (!response.ok) throw new Error(`Failed to fetch ${resolved}: ${response.status}`);
    return response.text();
  }
}

/** Global resource loader instance. */
let globalLoader: ResourceLoader = new FetchResourceLoader();

export function getResourceLoader(): ResourceLoader {
  return globalLoader;
}
