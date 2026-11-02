// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/// <reference lib="webworker" />

// Picks the OpenSCAD engine inside the worker: the bundled WebAssembly build
// when available, otherwise the optional wasm2js build `openscad.fallback.js`,
// which is only fetched (importScripts) in that case.

import OpenSCADWasmFactory from "../wasm/openscad.js";
import {
  detectWasmSupport,
  FALLBACK_ENGINE_SCRIPT,
  RenderEngine,
  WasmUnavailableError,
} from "./wasm-support.ts";

declare const self: DedicatedWorkerGlobalScope;

/** Emscripten MODULARIZE factory: `createModule(moduleArg) -> Promise<instance>`. */
export type OpenSCADModuleFactory = (moduleArg: any) => Promise<any>;

export interface LoadedOpenSCAD {
  /** Engine that actually ran the load. */
  engine: RenderEngine;
  /** The instantiated Emscripten module instance. */
  instance: any;
}

/**
 * Loads and instantiates OpenSCAD. Tries the WASM build first when available;
 * on any instantiation failure (and unless explicitly forced to `'wasm'`)
 * falls back to the wasm2js JS build. Throws {@link WasmUnavailableError}
 * when WASM is unavailable *and* the JS fallback can't be loaded — callers
 * should surface its `userMessage` to the user.
 *
 * @param moduleArg    Emscripten Module options (print, printErr, etc.).
 * @param forceEngine  Testing override (`?wasmEngine=`). `'wasm'` pins WASM
 *                     with no fallback; `'wasm2js'` skips WASM and uses
 *                     the JS build.
 */
export async function loadOpenSCAD(
  moduleArg: any,
  forceEngine?: RenderEngine,
): Promise<LoadedOpenSCAD> {
  const tryWasm =
    forceEngine === 'wasm' ||
    (forceEngine !== 'wasm2js' && detectWasmSupport());

  if (tryWasm) {
    try {
      const instance = await (OpenSCADWasmFactory as unknown as OpenSCADModuleFactory)(moduleArg);
      return { engine: 'wasm', instance };
    } catch (e) {
      if (forceEngine === 'wasm') {
        throw e;
      }
      console.warn(
        '[openscad-loader] WebAssembly instantiation failed; falling back to wasm2js:',
        e,
      );
      // fall through to wasm2js
    }
  }

  // The fallback is a classic script defining a global `OpenSCAD` factory.
  // Relative URLs resolve against the worker script, next to which it is served.
  let factory: unknown;
  try {
    self.importScripts(FALLBACK_ENGINE_SCRIPT);
    factory = (self as any).OpenSCAD;
  } catch (e) {
    throw new WasmUnavailableError(
      `WebAssembly is unavailable or failed in this browser and the ` +
      `JavaScript fallback build ("${FALLBACK_ENGINE_SCRIPT}") could not ` +
      `be loaded, so models cannot be rendered here.`,
      { cause: e },
    );
  }
  if (typeof factory !== 'function') {
    throw new WasmUnavailableError(
      `WebAssembly is unavailable or failed, and the JavaScript fallback ` +
      `build did not load correctly.`,
    );
  }

  const instance = await (factory as OpenSCADModuleFactory)(moduleArg);
  return { engine: 'wasm2js', instance };
}
