// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { getFileName, getParentDir } from '../fs/filesystem';
import { spawnOpenSCAD } from "./openscad-runner";
import { processMergedOutputs } from "./output-parser";
import { AbortablePromise, turnIntoDelayableExecution } from '../utils';

const syntaxDelay = 300;

type SyntaxCheckOutput = {logText: string, markers: monaco.editor.IMarkerData[]};
export const checkSyntax =
  turnIntoDelayableExecution(syntaxDelay, (source: string, sourcePath: string) => {
    // const timestamp = Date.now(); 
    
    source = '$preview=true;\n' + source;
    sourcePath = getFileName(sourcePath);

    const job = spawnOpenSCAD({
      inputs: [[sourcePath, source + '\n']],
      args: [sourcePath, "-o", "out.ast"],
      // workingDir: sourcePath.startsWith('/') ? getParentDir(sourcePath) : '/home'
    });

    return AbortablePromise<SyntaxCheckOutput>((res, rej) => {
      (async () => {
        try {
          const result = await job;
          // console.log(result);
          res(processMergedOutputs(result.mergedOutputs, {shiftSourceLines: {
            sourcePath,
            skipLines: 1,
          }}));
        } catch (e) {
          console.error(e);
          rej(e);
        }
      })()
      return () => job.kill();
    });
  });

var renderDelay = 1000;
export type RenderOutput = {stlFile: File, logText: string, markers: monaco.editor.IMarkerData[], elapsedMillis: number}

export type RenderArgs = {
  source: string,
  sourcePath: string,
  features?: string[],
  extraArgs?: string[],
  isPreview: boolean
}
export const render =
 turnIntoDelayableExecution(renderDelay, ({sourcePath, source, isPreview, features, extraArgs}: RenderArgs) => {

    const prefixLines: string[] = [];
    if (isPreview) {
      prefixLines.push('$preview=true;');
    }
    source = [...prefixLines, source].join('\n');
    sourcePath = getFileName(sourcePath);

    const args = [
      sourcePath,
      "-o", "out.stl",
      "--export-format=binstl",
      ...(features ?? []).map(f => `--enable=${f}`),
      ...(extraArgs ?? [])
    ]
    
    const job = spawnOpenSCAD({
      // wasmMemory,
      inputs: [[sourcePath, source]],
      args,
      outputPaths: ['out.stl'],
      // workingDir: sourcePath.startsWith('/') ? getParentDir(sourcePath) : '/home'
    });

    return AbortablePromise<RenderOutput>((resolve, reject) => {
      (async () => {
        try {
          const result = await job;
          console.log(result);

          const {logText, markers} = processMergedOutputs(result.mergedOutputs, {
            shiftSourceLines: {
              sourcePath: sourcePath,
              skipLines: prefixLines.length
            }
          });
    
          if (result.error) {
            reject(result.error);
          }
          
          const [output] = result.outputs ?? [];
          if (!output) {
            reject(new Error('No output from runner!'));
            return;
          }
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
