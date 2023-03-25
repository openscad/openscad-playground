// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { spawnOpenSCAD } from "./openscad-runner";
import { processMergedOutputs } from "./output-parser";
import { AbortablePromise, turnIntoDelayableExecution } from './utils';

const syntaxDelay = 300;

type SyntaxCheckOutput = {logText: string, markers: monaco.editor.IMarkerData[]};
export const checkSyntax =
  turnIntoDelayableExecution(syntaxDelay, (source: string) => {
    // const timestamp = Date.now(); 
    
    source = '$preview=true;\n' + source;
    const sourceFile = 'input.scad';

    const job = spawnOpenSCAD({
      inputs: [[sourceFile, source + '\n']],
      args: [sourceFile, "-o", "out.ast"],
    });

    return AbortablePromise<SyntaxCheckOutput>((res, rej) => {
      (async () => {
        try {
          const result = await job;
          // console.log(result);
          res(processMergedOutputs(result.mergedOutputs, {shiftSourceLines: {[sourceFile]: 1}}));
        } catch (e) {
          console.error(e);
          rej(e);
        }
      })()
      return () => job.kill();
    });
  });

var renderDelay = 1000;
export type RenderOutput = {stlFile: File, logText: string, markers: monaco.editor.IMarkerData[], elapsedMillis?: number}

export type RenderArgs = {
  source: string,
  features?: string[],
  extraArgs?: string[],
  isPreview: boolean
}
export const render =
 turnIntoDelayableExecution(renderDelay, (args: RenderArgs) => {
  
    const prefixLines: string[] = [];
    if (args.isPreview) prefixLines.push('$preview=false;');
    const source = args.isPreview ? [...prefixLines, args.source].join('\n') : args.source
    const inputFile = 'input.scad';
    
    const job = spawnOpenSCAD({
      // wasmMemory,
      inputs: [['input.scad', source]],
      args: [
        inputFile,
        "-o", "out.stl",
        "--export-format=binstl",
        ...(args.features ?? []).map(f => `--enable=${f}`),
        ...(args.extraArgs ?? [])
      ],
      outputPaths: ['out.stl']
    });

    return AbortablePromise<RenderOutput>((resolve, reject) => {
      (async () => {
        try {
          const result = await job;
          console.log(result);

          const {logText, markers} = processMergedOutputs(result.mergedOutputs, {
            shiftSourceLines: {[inputFile]: prefixLines.length}
          });
    
          if (result.error) {
            reject(result.error);
          }
          
          const [output] = result.outputs ?? [];
          if (!output) throw 'No output from runner!'
          const [filePath, content] = output;
          const filePathFragments = filePath.split('/');
          const fileName = filePathFragments[filePathFragments.length - 1];

          // TODO: have the runner accept and return files.
          const blob = new Blob([content], { type: "application/octet-stream" });
          // console.log(new TextDecoder().decode(content));
          const stlFile = new File([blob], fileName);
          resolve({stlFile, logText, markers, elapsedMillis: result.elapsedMillis});
        } catch (e) {
          console.error(e);
          reject(e);
        }
      })();

      return () => job.kill()
    });
  });
