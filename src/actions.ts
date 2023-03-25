// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { spawnOpenSCAD } from "./openscad-runner";
import { joinMergedOutputs, parseMergedOutputs } from "./output-parser";
import { AbortablePromise, turnIntoDelayableExecution } from './utils';

const syntaxDelay = 300;

type SyntaxCheckOutput = {logText: string, markers: monaco.editor.IMarkerData[]};
export const checkSyntax = (source: string, callback: (out: SyntaxCheckOutput) => void) => 
  turnIntoDelayableExecution(syntaxDelay, () => {
    // const timestamp = Date.now();

    const job = spawnOpenSCAD({
      inputs: [['input.scad', source + '\n']],
      args: ["input.scad", "-o", "out.ast"],
    });

    return AbortablePromise<SyntaxCheckOutput>((res, rej) => {
      (async () => {
        try {
          const result = await job;
          // console.log(result);
          const logText = joinMergedOutputs(result.mergedOutputs);
          const markers = parseMergedOutputs(result.mergedOutputs);
          res({logText, markers});
        } catch (e) {
          console.error(e);
          rej(e);
        }
      })()
      return () => job.kill();
    });
  }, callback);

var sourceFileName;
// var editor;

var renderDelay = 1000;
type RenderOutput = {stlFile: File, logText: string, markers: monaco.editor.IMarkerData[], elapsedMillis?: number}

export const render = (source: string, features: string[], callback: (result: RenderOutput) => void) =>
 turnIntoDelayableExecution(renderDelay, () => {
  
    const job = spawnOpenSCAD({
      // wasmMemory,
      inputs: [['input.scad', source]],
      args: [
        "input.scad",
        "-o", "out.stl",
        "--export-format=binstl",
        ...features.map(f => `--enable=${f}`),
      ],
      outputPaths: ['out.stl']
    });

    return AbortablePromise<RenderOutput>((resolve, reject) => {
      (async () => {
        try {
          const result = await job;
          console.log(result);

          const logText = joinMergedOutputs(result.mergedOutputs);
          const markers = parseMergedOutputs(result.mergedOutputs);
    
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
  }, callback);
