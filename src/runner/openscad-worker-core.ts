// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

/**
 * Shared worker logic: handles OpenSCAD invocations using the OpenSCAD
 * factory supplied by the worker entry point (openscad-worker.ts).
 */

import { createEditorFS, symlinkLibraries } from "../fs/filesystem.ts";
import { OpenSCADInvocation, OpenSCADInvocationCallback, OpenSCADInvocationResults } from "./openscad-runner.ts";
import { deployedArchiveNames } from "../fs/zip-archives.ts";
import { fetchSource } from "../utils.ts";

export type MergedOutputs = {stdout?: string, stderr?: string, error?: string}[];

declare const self: DedicatedWorkerGlobalScope;

function callback(payload: OpenSCADInvocationCallback) {
  self.postMessage(payload);
}

/**
 * Install the message handler that processes OpenSCAD invocations.
 * @param OpenSCADFactory - The Emscripten module factory
 */
export function installWorkerHandler(OpenSCADFactory: (opts: any) => Promise<any>) {
  self.addEventListener('message', async (e: MessageEvent<OpenSCADInvocation>) => {
    const {
      mountArchives,
      inputs,
      args,
      outputPaths,
    } = e.data;

    const mergedOutputs: MergedOutputs = [];
    let instance: any;
    const start = performance.now();
    try {
      instance = await OpenSCADFactory({
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
      });

      if (mountArchives) {
        // This will mount lots of libraries' ZIP archives under /libraries/<name> -> <name>.zip
        await createEditorFS({prefix: '', allowPersistence: false});

        instance.FS.mkdir('/libraries');

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
      }

      console.debug(result);
      callback({result});
    } catch (e) {
      const end = performance.now();
      const elapsedMillis = end - start;

      console.trace(e);
      const error = `${e}`;
      mergedOutputs.push({ error });
      callback({
        result: {
          exitCode: undefined,
          error,
          mergedOutputs,
          elapsedMillis,
        }
      });
    }
  });
}
