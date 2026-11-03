// The OpenSCAD engine (openscad.wasm, ~2.5 MB compressed) is downloaded and compiled once, on
// the main thread, and the compiled WebAssembly.Module is handed to every render worker
// (structured clone). Without it each worker fetched the file itself: when a worker started
// before the first download had finished (slow connections: the syntax check and the first render
// start together), the file was downloaded again for each of them.
//
// Falls back to undefined (the worker then loads the engine itself) when this isn't possible.

import { resolveUrl } from '../resource-loader.ts';
import { isMcpMode } from '../state/mcp-mode.ts';
import { getForcedEngine } from './wasm-support.ts';

let shared: Promise<WebAssembly.Module | undefined> | undefined;

/** Starts (once) and returns the download + compilation of the engine. */
export function getSharedWasmModule(): Promise<WebAssembly.Module | undefined> {
  return shared ??= (async () => {
    // (The MCP app loads the engine through its own resource loader, in the worker.)
    if (isMcpMode() || getForcedEngine() === 'wasm2js' || typeof WebAssembly?.compile !== 'function') {
      return undefined;
    }
    try {
      const response = await fetch(resolveUrl('./openscad.wasm'));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      try {
        return await WebAssembly.compileStreaming(response.clone());
      } catch (e) {
        // (E.g. a wrong content type.)
        return await WebAssembly.compile(await response.arrayBuffer());
      }
    } catch (e) {
      console.warn('Could not preload the engine, workers will load it themselves:', e);
      return undefined;
    }
  })();
}
