// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { getParentDir } from '../fs/filesystem';
import { spawnOpenSCAD } from "./openscad-runner";
import { processMergedOutputs } from "./output-parser";
import { AbortablePromise, turnIntoDelayableExecution } from '../utils';
import { Source, VALID_EXPORT_FORMATS, VALID_RENDER_FORMATS } from '../state/app-state';
import { materialize3MFFile } from '../multimaterial/materialize';
import { parseColors } from '../multimaterial/colors';
import { ParameterSet } from '../state/customizer-types';

const syntaxDelay = 300;

type SyntaxCheckOutput = {logText: string, markers: monaco.editor.IMarkerData[], parameterSet?: ParameterSet};
export const checkSyntax =
  turnIntoDelayableExecution(syntaxDelay, (activePath: string, sources: Source[]) => {
    // const timestamp = Date.now(); 
    
    const content = '$preview=true;\n' + sources[0].content;

    const outFile = 'out.json';
    const job = spawnOpenSCAD({
      inputs: sources,
      args: [activePath, "-o", outFile, "--export-format=param"],
      // workingDir: sourcePath.startsWith('/') ? getParentDir(sourcePath) : '/home'
      outputPaths: [outFile],
    });

    return AbortablePromise<SyntaxCheckOutput>((res, rej) => {
      (async () => {
        try {
          const result = await job;
          // console.log(result);

          let parameterSet: ParameterSet | undefined = undefined;
          if (result.outputs && result.outputs.length == 1) {
            let [[, content]] = result.outputs;
            content = new TextDecoder().decode(content as any);
            try {
              parameterSet = JSON.parse(content)
              // console.log('PARAMETER SET', JSON.stringify(parameterSet, null, 2))
            } catch (e) {
              console.error(`Error while parsing parameter set: ${e}\n${content}`);
            }
          } else {
            console.error('No output from runner!');
          }

          res({
            ...processMergedOutputs(result.mergedOutputs, {shiftSourceLines: {
              sourcePath: sources[0].path,
              skipLines: 1,
            }}),
            parameterSet,
          });
        } catch (e) {
          console.error(e);
          rej(e);
        }
      })()
      return () => job.kill();
    });
  });

var renderDelay = 1000;
export type RenderOutput = {
  outFile: File,
  logText: string,
  markers: monaco.editor.IMarkerData[],
  elapsedMillis: number}

export type RenderArgs = {
  scadPath: string,
  sources: Source[],
  vars?: {[name: string]: any},
  features?: string[],
  extraArgs?: string[],
  isPreview: boolean,
  renderFormat: keyof typeof VALID_EXPORT_FORMATS | keyof typeof VALID_RENDER_FORMATS,
  extruderColors?: string[]
}

function formatValue(any: any): string {
  if (typeof any === 'string') {
    return `"${any}"`;
  } else if (any instanceof Array) {
    return `[${any.map(formatValue).join(', ')}]`;
  } else {
    return `${any}`;
  }
}
export const render =
 turnIntoDelayableExecution(renderDelay, ({scadPath, sources, isPreview, vars, features, extraArgs, renderFormat, extruderColors}: RenderArgs) => {

    const extruderRGBColors = renderFormat == '3mf' && extruderColors ? parseColors(extruderColors.join('\n')) : undefined;

    const prefixLines: string[] = [];
    if (isPreview) {
      prefixLines.push('$preview=true;');
      features = ['render-modifiers', ...(features ?? [])];
    } else {
      features = (features ?? []).filter(f => f != 'render-modifiers');
    }
    if (!scadPath.endsWith('.scad')) throw new Error('First source must be a .scad file, got ' + sources[0].path + ' instead');
    
    const source = sources.filter(s => s.path === scadPath)[0];
    if (!source) throw new Error('Active path not found in sources!');

    if (source.content == null) throw new Error('Source content is null!');
    const content = [...prefixLines, source.content].join('\n');

    const outFile = 'out.' + renderFormat;
    const args = [
      scadPath,
      "-o", outFile,
      "--export-format=" + (renderFormat == 'stl' ? 'binstl' : renderFormat),
      ...(Object.entries(vars ?? {}).flatMap(([k, v]) => [`-D${k}=${formatValue(v)}`])),
      ...(features ?? []).map(f => `--enable=${f}`),
      ...(extraArgs ?? [])
    ]
    
    const job = spawnOpenSCAD({
      // wasmMemory,
      inputs: sources.map(s => s.path === scadPath ? {path: s.path, content} : s),
      args,
      outputPaths: [outFile],
      // workingDir: sourcePath.startsWith('/') ? getParentDir(sourcePath) : '/home'
    });

    return AbortablePromise<RenderOutput>((resolve, reject) => {
      (async () => {
        try {
          const result = await job;
          // console.log(result);

          const {logText, markers} = processMergedOutputs(result.mergedOutputs, {
            shiftSourceLines: {
              sourcePath: source.path,
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
          let outFile = new File([blob], fileName);
          if (extruderRGBColors) {
            try {
              outFile = await materialize3MFFile(outFile, extruderRGBColors);
            } catch (e) {
              console.error('Error while materializing 3MF file:', e);
            }
          }
          resolve({outFile, logText, markers, elapsedMillis: result.elapsedMillis});
          // const stlFile = new File([blob], fileName);
          // resolve({stlFile, logText, markers, elapsedMillis: result.elapsedMillis});
        } catch (e) {
          console.error(e);
          reject(e);
        }
      })();

      return () => job.kill()
    });
  });

