// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { MergedOutputs } from "./openscad-worker-core.ts";
import { AbortablePromise } from "../utils.ts";
import { Source } from "../state/app-state.ts";
import { getForcedEngine, type RenderEngine } from "./wasm-support.ts";
import { resolveUrl } from "../resource-loader.ts";
import { noteUsedArchives } from "../background-loading.ts";
import { getSharedWasmModule } from "./wasm-module.ts";

export type OpenSCADInvocation = {
  mountArchives: boolean,
  // Archives to mount (instead of the ones the sources seem to refer to).
  archives?: string[],
  inputs?: Source[],
  args: string[],
  outputPaths?: string[],
  // Testing override (see getForcedEngine); the worker can't read the page URL.
  forceEngine?: RenderEngine,
  // The engine, downloaded and compiled once by the main thread (see wasm-module.ts).
  wasmModule?: WebAssembly.Module,
}

export type OpenSCADInvocationResults = {
  exitCode?: number,
  error?: string,
  outputs?: [string, string][],
  mergedOutputs: MergedOutputs,
  elapsedMillis: number,
  // Engine that ran the invocation; undefined if it failed before one was loaded.
  engine?: RenderEngine,
  // Archives OpenSCAD's output shows it needed beyond the ones mounted: the
  // invocation should be run again with these added.
  missingArchives?: string[],
  // Archives that were mounted.
  archives?: string[],
};

export type ProcessStreams = {stderr: string} | {stdout: string}
export type OpenSCADInvocationCallback = {result: OpenSCADInvocationResults} | ProcessStreams;

/**
 * Create a Worker, handling cross-origin URLs (e.g. an MCP App sandbox iframe
 * served from the host's origin loading the worker from the OpenSCAD server's
 * origin). Browsers refuse `new Worker(<cross-origin url>)`, so a same-origin
 * blob wrapper `importScripts()` the real script instead (allowed cross-origin
 * for classic workers). The wrapper:
 *  - overrides `self.location` so webpack's auto-detected publicPath points at
 *    the right origin;
 *  - resolves relative `importScripts()` / `fetch()` URLs against the worker's
 *    intended base rather than the opaque blob: URL. This also covers the
 *    wasm2js fallback (`openscad.fallback.js`, see openscad-loader.ts), which
 *    is therefore loaded from the asset origin as well.
 */
function createWorker(url: string): Worker {
  try {
    if (new URL(url, location.href).origin === location.origin) {
      return new Worker(url);
    }
  } catch {
    return new Worker(url);
  }

  const workerBase = new URL('./', url).href;
  const blob = new Blob([
    `Object.defineProperty(self, 'location', {\n` +
    `  value: new URL(${JSON.stringify(url)}),\n` +
    `  writable: false, configurable: true\n` +
    `});\n` +
    `(function() {\n` +
    `  var _base = ${JSON.stringify(workerBase)};\n` +
    `  function resolveUrl(u) {\n` +
    `    try { new URL(u); return u; } catch(e) {}\n` +
    `    return new URL(u, _base).href;\n` +
    `  }\n` +
    `  var _importScripts = self.importScripts.bind(self);\n` +
    `  self.importScripts = function() {\n` +
    `    return _importScripts.apply(self, Array.prototype.map.call(arguments, resolveUrl));\n` +
    `  };\n` +
    `  var _fetch = self.fetch.bind(self);\n` +
    `  self.fetch = function(resource, init) {\n` +
    `    if (typeof resource === 'string') resource = resolveUrl(resource);\n` +
    `    return _fetch(resource, init);\n` +
    `  };\n` +
    `})();\n` +
    `importScripts(${JSON.stringify(url)});\n`
  ], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

/**
 * `?archives=a,b` (empty for none): testing override of the archives mounted by the first
 * attempt of an invocation, to exercise the retry with the missing ones.
 */
function getForcedArchives(): string[] | undefined {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? '').get('archives');
    return v == null ? undefined : v.split(',').filter(n => n !== '');
  } catch {
    return undefined;
  }
}

export function spawnOpenSCAD(
  invocation: OpenSCADInvocation, 
  streamsCallback: (ps: ProcessStreams) => void
): AbortablePromise<OpenSCADInvocationResults> {
  let worker: Worker | null;
  let rejection: (err: any) => void;

  function terminate() {
    if (!worker) {
      return;
    }
    worker.terminate();
    worker = null;
  }
    
  return AbortablePromise<OpenSCADInvocationResults>((resolve: (result: OpenSCADInvocationResults) => void, reject: (error: any) => void) => {
    rejection = reject;
    const forceEngine = invocation.forceEngine ?? getForcedEngine();
    // Each attempt runs in a fresh worker: an Emscripten module can't be run twice.
    const run = (invocation: OpenSCADInvocation, retriesLeft: number) => {
      worker = createWorker(resolveUrl('./openscad-worker.js'));
      worker.onmessage = (e: MessageEvent<OpenSCADInvocationCallback>) => {
        if ('result' in e.data) {
          const {result} = e.data;
          // (Logged here rather than in the worker, whose early console output can be missed by observers.)
          console.debug(`Mounting archives: ${result.archives?.join(', ') || '(none)'}`);
          noteUsedArchives(result.archives ?? []);
          terminate();
          if (result.missingArchives?.length && retriesLeft > 0) {
            // The sources only seemed to need some of the archives: add what was missing and retry.
            streamsCallback({stderr: `[playground] Mounting more libraries (${result.missingArchives.join(', ')}) and running again.`});
            run({...invocation, archives: [...(result.archives ?? []), ...result.missingArchives]}, retriesLeft - 1);
          } else {
            resolve(result);
          }
        } else {
          streamsCallback(e.data);
        }
      }
      worker.postMessage({...invocation, forceEngine})  // (with wasmModule, if any)
    };
    let aborted = false;
    getSharedWasmModule().then(wasmModule => {
      if (!aborted) run({...invocation, archives: invocation.archives ?? getForcedArchives(), wasmModule}, 2);
    });

    return () => {
      aborted = true;
      terminate();
    };
  });
}
