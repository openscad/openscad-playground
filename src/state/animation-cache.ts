/**
 * Bounded LRU cache of rendered animation frames, keyed by everything that
 * influences a frame: a hash of the project (sources, customizer values,
 * features) plus the animation time `t`. DOM-free (unit tested).
 */

export interface CacheOptions<V> {
  maxEntries: number;
  maxBytes: number;
  /** Called for every entry that leaves the cache (evicted, replaced, deleted, cleared): release its resources (object URLs). */
  onEvict?: (key: string, value: V) => void;
}

export class FrameCache<V extends { bytes: number }> {
  // Map iteration order = insertion order: the first key is the least recently used.
  private map = new Map<string, V>();
  private total = 0;

  constructor(private opts: CacheOptions<V>) {}

  get size() { return this.map.size; }
  get bytes() { return this.total; }
  keys(): string[] { return [...this.map.keys()]; }
  has(key: string) { return this.map.has(key); }

  /** Lookup that counts as a use. */
  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v !== undefined) { this.map.delete(key); this.map.set(key, v); }
    return v;
  }

  peek(key: string): V | undefined { return this.map.get(key); }

  set(key: string, value: V): void {
    this.delete(key);
    this.map.set(key, value);
    this.total += value.bytes;
    // Never evict the entry just added (an oversized frame still has to be shown once).
    while (this.map.size > 1 && (this.map.size > this.opts.maxEntries || this.total > this.opts.maxBytes)) {
      const oldest = this.map.keys().next().value as string;
      this.delete(oldest);
    }
  }

  delete(key: string): boolean {
    const v = this.map.get(key);
    if (v === undefined) return false;
    this.map.delete(key);
    this.total -= v.bytes;
    this.opts.onEvict?.(key, v);
    return true;
  }

  clear(): void {
    for (const key of this.keys()) this.delete(key);
  }
}

/** Fast non-cryptographic 53-bit string hash (cyrb53), as base-36. */
export function hashString(s: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Everything but `t` that changes what a frame looks like. Order-insensitive for the customizer values. */
export function projectKey(p: { activePath: string; sources: ReadonlyArray<{ path: string; content?: string; url?: string }>; vars?: Record<string, unknown>; features?: string[] }): string {
  const vars = Object.entries(p.vars ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const sources = p.sources.map(s => [s.path, s.content ?? null, s.url ?? null]);
  return hashString(JSON.stringify([p.activePath, sources, vars, p.features ?? []]));
}

/** Cache key of the frame at animation time `t` (rounded so equal times from different step counts coincide). */
export function frameKey(project: string, t: number): string {
  return `${project}@${t.toFixed(6)}`;
}
