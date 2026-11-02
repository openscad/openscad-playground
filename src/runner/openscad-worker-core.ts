// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/**
 * Shared worker logic: handles OpenSCAD invocations using the OpenSCAD
 * factory supplied by the worker entry point (openscad-worker.ts).
 */

import { createEditorFS, symlinkLibraries } from "../fs/filesystem.ts";
import { OpenSCADInvocation, OpenSCADInvocationCallback, OpenSCADInvocationResults } from "./openscad-runner.ts";
import { deployedArchiveNames } from "../fs/zip-archives.ts";
import { fetchSource } from "../utils.ts";
import UZIP from "uzip";
import type { LoadedOpenSCAD } from "./openscad-loader.ts";
import { RenderEngine, WasmUnavailableError } from "./wasm-support.ts";

export type MergedOutputs = {stdout?: string, stderr?: string, error?: string}[];

declare const self: DedicatedWorkerGlobalScope;

function callback(payload: OpenSCADInvocationCallback) {
  self.postMessage(payload);
}

// BrowserFS's EmscriptenFS bridge doesn't work with the wasm2js build, so its
// library archives are unpacked straight into the Emscripten FS instead.
async function unpackArchivesIntoFS(FS: any, archives: string[], root: string) {
  await Promise.all(archives.map(async (name) => {
    const url = `./libraries/${name}.zip`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`);
        return;
      }
      const files = UZIP.parse(await resp.arrayBuffer());
      const archiveRoot = `${root}/${name}`;
      try { FS.mkdir(archiveRoot); } catch (e) { /* already exists */ }
      for (const relPath in files) {
        if (relPath.endsWith('/')) continue;
        const parts = relPath.split('/');
        let dir = archiveRoot;
        for (let i = 0; i < parts.length - 1; i++) {
          dir += '/' + parts[i];
          try { FS.mkdir(dir); } catch (e) { /* already exists */ }
        }
        FS.writeFile(`${archiveRoot}/${relPath}`, files[relPath]);
      }
    } catch (e) {
      console.warn(`Failed to unpack ${url}:`, e);
    }
  }));
}

/**
 * Install the message handler that processes OpenSCAD invocations.
 * @param loadEngine - Loads and instantiates the Emscripten module (WASM or wasm2js)
 */
export function installWorkerHandler(
    loadEngine: (moduleArg: any, forceEngine?: RenderEngine) => Promise<LoadedOpenSCAD>) {
  self.addEventListener('message', async (e: MessageEvent<OpenSCADInvocation>) => {
    const {
      mountArchives,
      inputs,
      args,
      outputPaths,
      forceEngine,
    } = e.data;

    const mergedOutputs: MergedOutputs = [];
    let engine: RenderEngine | undefined;
    let instance: any;
    const start = performance.now();
    try {
      const loaded = await loadEngine({
        noInitialRun: true,
        'print': (text: string) => {
          console.debug('stdout: ' + text);
          callback({stdout: text})
          mergedOutputs.push({ stdout: text })
        },
        'printErr': (text: string) => {
          console.debug('stderr: ' + text);
          callback({stderr: text})
          mergedOutputs.push({ stderr: text })
        },
      }, forceEngine);
      engine = loaded.engine;
      instance = loaded.instance;

      if (mountArchives) {
        instance.FS.mkdir('/libraries');

        if (engine === 'wasm2js') {
          await unpackArchivesIntoFS(instance.FS, deployedArchiveNames, '/libraries');
        } else {
          // This will mount lots of libraries' ZIP archives under /libraries/<name> -> <name>.zip
          await createEditorFS({prefix: '', allowPersistence: false});

          // https://github.com/emscripten-core/emscripten/issues/10061
          const BFS = new BrowserFS.EmscriptenFS(
            instance.FS,
            instance.PATH ?? {
              join2: (a: string, b: string) => `${a}/${b}`,
              join: (...args: string[]) => args.join('/'),
            },
            instance.ERRNO_CODES ?? {}
          );

          instance.FS.mount(BFS, {root: '/'}, '/libraries');
        }

        await symlinkLibraries(deployedArchiveNames, instance.FS, '/libraries', "/");
      }

      // Fonts are seemingly resolved from $(cwd)/fonts
      instance.FS.chdir("/");

      instance.FS.mkdir('/locale');

      if (inputs) {
        for (const source of inputs) {
          try {
            console.log(`Writing ${source.path}`);
            if (source.content == null && source.path != null && source.url == null) {
              if (!instance.FS.isFile(source.path)) {
                console.error(`File ${source.path} does not exist!`);
              }
            } else {
              instance.FS.writeFile(source.path, await fetchSource(instance.FS, source));
            }
          } catch (e) {
            console.trace(e);
            throw new Error(`Error while trying to write ${source.path}: ${e}`);
          }
        }
      }

      console.log('Invoking OpenSCAD with: ', args)
      let exitCode;
      try {
        exitCode = instance.callMain(args);
      } catch(e){
        if(typeof e === "number" && instance.formatException){
          // The number was a raw C++ exception
          // See https://github.com/emscripten-core/emscripten/pull/16343
          e = instance.formatException(e);
        }
        throw new Error(`OpenSCAD invocation failed: ${e}`);
      }
      const end = performance.now();
      const elapsedMillis = end - start;

      const outputs: [string, string][] = [];
      for (const path of (outputPaths ?? [])) {
        try {
          const content = instance.FS.readFile(path);
          outputs.push([path, content]);
        } catch (e) {
          console.trace(e);
          throw new Error(`Failed to read output file ${path}: ${e}`);
        }
      }
      const result: OpenSCADInvocationResults = {
        outputs,
        mergedOutputs,
        exitCode,
        elapsedMillis,
        engine,
      }

      console.debug(result);
      callback({result});
    } catch (e) {
      const end = performance.now();
      const elapsedMillis = end - start;

      console.trace(e);
      const error = e instanceof WasmUnavailableError ? e.userMessage : `${e}`;
      mergedOutputs.push({ error });
      callback({
        result: {
          exitCode: undefined,
          error,
          mergedOutputs,
          elapsedMillis,
          engine,
        }
      });
    }
  });
}
