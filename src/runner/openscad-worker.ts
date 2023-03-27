// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import OpenSCAD from "../wasm/openscad.js";

import { OpenSCADInvocation, OpenSCADInvocationResults } from "./openscad-runner";
import { createEditorFS, symlinkLibraries } from "../fs/filesystem";
import { zipArchives } from "../fs/zip-archives";
declare var BrowserFS: BrowserFSInterface

importScripts("browserfs.min.js");
// importScripts("https://cdnjs.cloudflare.com/ajax/libs/BrowserFS/2.0.0/browserfs.min.js");

const allArchiveNames = Object.keys(zipArchives)

export type MergedOutputs = {stdout?: string, stderr?: string, error?: string}[];

addEventListener('message', async (e) => {

  const { inputs, args, outputPaths, wasmMemory } = e.data as OpenSCADInvocation;

  const mergedOutputs: MergedOutputs = [];
  try {
    const instance = await OpenSCAD({
      wasmMemory,
      buffer: wasmMemory && wasmMemory.buffer,
      noInitialRun: true,
      'print': (text: string) => {
        console.debug('stdout: ' + text);
        mergedOutputs.push({ stdout: text })
      },
      'printErr': (text: string) => {
        console.debug('stderr: ' + text);
        mergedOutputs.push({ stderr: text })
      },
    });

    // This will mount lots of libraries' ZIP archives under /libraries/<name> -> <name>.zip
    await createEditorFS('');
    
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

    await symlinkLibraries(allArchiveNames, instance.FS, '/libraries', "/");

    // Fonts are seemingly resolved from $(cwd)/fonts
    instance.FS.chdir("/");
    
    if (inputs) {
      for (const [path, content] of inputs) {
        try {
          // const parent = getParentDir(path);
          instance.FS.writeFile(path, content);
          // fs.writeFile(path, content);
        } catch (e) {
          console.error(`Error while trying to write ${path}`, e);
        }
      }
    }
    
    console.log('Invoking OpenSCAD with: ', args)
    const start = performance.now();
    const exitCode = instance.callMain(args);
    const end = performance.now();

    const outputs: [string, string][] = [];
    for (const path of (outputPaths ?? [])) {
      try {
        const content = instance.FS.readFile(path);
        outputs.push([path, content]);
      } catch (e) {
        console.trace(`Failed to read output file ${path}`, e);
      }
    }
    const result: OpenSCADInvocationResults = {
      outputs,
      mergedOutputs,
      exitCode,
      elapsedMillis: end - start
    }

    console.debug(result);

    postMessage(result);
  } catch (e) { 
    console.trace(e);//, e instanceof Error ? e.stack : '');
    const error = `${e}`;
    mergedOutputs.push({ error });
    postMessage({
      error,
      mergedOutputs,
    } as OpenSCADInvocationResults);
  }
});
