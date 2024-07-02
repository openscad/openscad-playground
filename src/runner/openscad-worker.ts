// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import OpenSCAD from "../wasm/openscad.js";

import { createEditorFS, getParentDir, symlinkLibraries } from "../fs/filesystem";
import { OpenSCADInvocation, OpenSCADInvocationResults } from "./openscad-runner";
import { deployedArchiveNames, zipArchives } from "../fs/zip-archives";
import { fetchSource } from "../utils.js";
declare var BrowserFS: BrowserFSInterface

importScripts("browserfs.min.js");
// importScripts("https://cdnjs.cloudflare.com/ajax/libs/BrowserFS/2.0.0/browserfs.min.js");

export type MergedOutputs = {stdout?: string, stderr?: string, error?: string}[];

addEventListener('message', async (e) => {

  const { inputs, args, outputPaths, wasmMemory } = e.data as OpenSCADInvocation;

  const mergedOutputs: MergedOutputs = [];
  let instance: any;
  try {
    instance = await OpenSCAD({
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
      'ENV': {
        'OPENSCADPATH': '/libraries',
      },
    });

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

    // Fonts are seemingly resolved from $(cwd)/fonts
    instance.FS.chdir("/");
      
    // const walkFolder = (path: string, indent = '') => {
    //   console.log("Walking " + path);
    //   instance.FS.readdir(path)?.forEach((f: string) => {
    //     if (f.startsWith('.')) {
    //       return;
    //     }
    //     const ii = indent + '  ';
    //     const p = `${path != '/' ? path + '/' : '/'}${f}`;
    //     console.log(`${ii}${p}`);
    //     walkFolder(p, ii);
    //   });
    // };
    // walkFolder('/libraries');

    if (inputs) {
      for (const source of inputs) {
        try {
          instance.FS.writeFile(source.path, await fetchSource(source));
        } catch (e) {
          console.error(`Error while trying to write ${source.path}`, e);
        }
      }
    }
    
    console.log('Invoking OpenSCAD with: ', args)
    const start = performance.now();
    // console.log(Object.keys(instance.FS))

    // instance.FS.readdir('/libraries').forEach((f: string) => {
    //   console.log("TOP LEVEL: " + f);
    //   instance.FS.readdir(`/libraries/${f}`).forEach((ff: string) => {
    //     console.log("  " + ff);
    //   });
    // });
    let exitCode;
    try {
      exitCode = instance.callMain(args);
    } catch(e){
      if(typeof e === "number"){
        // The number was a raw C++ exception
        // See https://github.com/emscripten-core/emscripten/pull/16343
        e = instance.formatException(e);
      }
      throw new Error(`OpenSCAD invocation failed: ${e}`);
    }
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
