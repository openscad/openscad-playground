// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

// WebAssembly capability detection for the optional wasm2js OpenSCAD fallback
// (see docs/WASM_FALLBACK.md).

import { resolveUrl } from '../resource-loader.ts';

/** OpenSCAD execution engine actually used by a render. */
export type RenderEngine = 'wasm' | 'wasm2js';

/** What this device is able to run; `'none'` means neither engine is usable. */
export type RenderEngineAvailability = RenderEngine | 'none';

/**
 * Filename of the optional wasm2js fallback build. It is served next to the
 * app (and the worker) so both `importScripts()` from the worker and `fetch()`
 * from the page resolve to the same URL.
 */
export const FALLBACK_ENGINE_SCRIPT = 'openscad.fallback.js';

let cachedWasmSupport: boolean | undefined;

/**
 * Synchronously probes whether the current realm can compile *and* instantiate
 * WebAssembly. Returns false when WASM is absent (very old browsers) or blocked
 * (iOS/macOS Lockdown Mode, a Content-Security-Policy without `wasm-unsafe-eval`,
 * hardened or enterprise-locked browsers).
 *
 * Safe to call from both a Window and a Worker. The result is memoized.
 */
export function detectWasmSupport(): boolean {
  if (cachedWasmSupport !== undefined) {
    return cachedWasmSupport;
  }
  cachedWasmSupport = (() => {
    try {
      if (typeof WebAssembly !== 'object' ||
          typeof WebAssembly.instantiate !== 'function') {
        return false;
      }
      // The 8-byte module header is a minimal valid module. `new WebAssembly.Module`
      // compiles synchronously and throws if WASM is disabled or CSP-blocked.
      const probe = new WebAssembly.Module(
        Uint8Array.of(0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
      return probe instanceof WebAssembly.Module &&
        new WebAssembly.Instance(probe) instanceof WebAssembly.Instance;
    } catch {
      return false;
    }
  })();
  return cachedWasmSupport;
}

/**
 * Reads a forced engine from the `?wasmEngine=` URL parameter (`wasm` or
 * `wasm2js`) — a testing hook to exercise the fallback path without disabling
 * WebAssembly browser-wide. Returns undefined for normal automatic detection.
 */
export function getForcedEngine(): RenderEngine | undefined {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('wasmEngine');
    return v === 'wasm' || v === 'wasm2js' ? v : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Determines which OpenSCAD engine this device can use:
 *  - `'wasm'`:    the normal WebAssembly build.
 *  - `'wasm2js'`: WASM is blocked but the JS fallback build is deployed.
 *  - `'none'`:    WASM is blocked and no fallback build is deployed.
 *
 * Honours the `?wasmEngine=` override. Only performs network I/O (a single
 * HEAD request) when a JS fallback is in play, so the common case stays free.
 */
export async function probeRenderEngine(): Promise<RenderEngineAvailability> {
  const forced = getForcedEngine();
  if (forced === 'wasm') {
    return 'wasm';
  }
  if (!forced && detectWasmSupport()) {
    return 'wasm';
  }
  // WASM is unavailable, or the wasm2js engine was explicitly forced: report
  // whether the JS fallback build is actually deployed.
  try {
    // Resolves against the document URL (or the `openscad-base-url` meta tag
    // when assets are hosted on another origin, as in the MCP App). The fallback build is served next to
    // the app (and the worker), so this matches the URL the worker loads via
    // importScripts() in openscad-loader.ts.
    const res = await fetch(resolveUrl(`./${FALLBACK_ENGINE_SCRIPT}`), { method: 'HEAD' });
    return res.ok ? 'wasm2js' : 'none';
  } catch {
    return 'none';
  }
}

/**
 * Thrown when WebAssembly is unavailable and no JS fallback build can be
 * loaded. Carries a message suitable for showing directly to the user.
 */
export class WasmUnavailableError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options as ErrorOptions | undefined);
    this.name = 'WasmUnavailableError';
    this.userMessage = userMessage;
  }
}
