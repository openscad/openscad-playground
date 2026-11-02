// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { MergedOutputs } from "./openscad-worker-core.ts";
import { AbortablePromise } from "../utils.ts";
import { Source } from "../state/app-state.ts";
import { getForcedEngine, type RenderEngine } from "./wasm-support.ts";
import { resolveUrl } from "../resource-loader.ts";

export type OpenSCADInvocation = {
  mountArchives: boolean,
  inputs?: Source[],
  args: string[],
  outputPaths?: string[],
  // Testing override (see getForcedEngine); the worker can't read the page URL.
  forceEngine?: RenderEngine,
}

export type OpenSCADInvocationResults = {
  exitCode?: number,
  error?: string,
  outputs?: [string, string][],
  mergedOutputs: MergedOutputs,
  elapsedMillis: number,
  // Engine that ran the invocation; undefined if it failed before one was loaded.
  engine?: RenderEngine,
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
    worker = createWorker(resolveUrl('./openscad-worker.js'));
    rejection = reject;
    worker.onmessage = (e: MessageEvent<OpenSCADInvocationCallback>) => {
      if ('result' in e.data) {
        resolve(e.data.result);
        terminate();
      } else {
        streamsCallback(e.data);
      }
    }
    worker.postMessage({...invocation, forceEngine: invocation.forceEngine ?? getForcedEngine()})
    
    return () => {
      terminate();
    };
  });
}
