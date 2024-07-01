import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { MergedOutputs } from "./openscad-worker";

const ignoredLogs = new Set([
  'Could not initialize localization.'
]);

type MergedOutputsOptions = {
  shiftSourceLines?: {
    sourcePath: string,
    skipLines: number,
  }
}

export const processMergedOutputs = (outputs: MergedOutputs, opts: MergedOutputsOptions) => ({
  logText: joinMergedOutputs(outputs, opts),
  markers: parseMergedOutputs(outputs, opts)
});

export function joinMergedOutputs(mergedOutputs: MergedOutputs, opts: MergedOutputsOptions) {
  let allLines = [];
  for (const {stderr, stdout, error} of mergedOutputs){
    const line = stderr ?? stdout ?? `EXCEPTION: ${error}`;
    if (ignoredLogs.has(line)) {
      continue;
    }
    allLines.push(line);
  }

  return allLines.join("\n");
}

export function parseMergedOutputs(mergedOutputs: MergedOutputs, opts: MergedOutputsOptions): monaco.editor.IMarkerData[] {
  let unmatchedLines = [];

  const markers = [];
  let warningCount = 0, errorCount = 0;
  const addError = (error: string, file: string, line: number) => {
    markers.push({
      startLineNumber: Number(line),
      startColumn: 1,
      endLineNumber: Number(line),
      endColumn: 1000,
      message: error,
      severity: monaco.MarkerSeverity.Error
    })
  }
  const shiftSourceName = opts.shiftSourceLines && opts.shiftSourceLines.sourcePath;
  const getLine = (path: string, lineStr: string) => {
    const line = Number(lineStr);
    if (shiftSourceName && path.endsWith(shiftSourceName)) {
      return line - opts.shiftSourceLines!.skipLines;
    } else {
      return line;
    }
  }
  for (const {stderr, stdout, error} of mergedOutputs){
    if (stderr) {
      if (stderr.startsWith('ERROR:')) errorCount++;
      if (stderr.startsWith('WARNING:')) warningCount++;

      let m = /^ERROR: Parser error in file "([^"]+)", line (\d+): (.*)$/.exec(stderr)
      if (m) {
        const [_, file, line, error] = m
        addError(error, file, getLine(file, line));
        continue;
      }

      m = /^ERROR: Parser error: (.*?) in file ([^",]+), line (\d+)$/.exec(stderr)
      if (m) {
        const [_, error, file, line] = m
        addError(error, file, getLine(file, line));
        continue;
      }

      m = /^WARNING: (.*?),? in file ([^,]+), line (\d+)\.?/.exec(stderr);
      if (m) {
        const [_, warning, file, line] = m
        markers.push({
          startLineNumber: getLine(file, line),
          startColumn: 1,
          endLineNumber: getLine(file, line),
          endColumn: 1000,
          message: warning,
          severity: monaco.MarkerSeverity.Warning
        })
        continue;
      }
    }
    unmatchedLines.push(stderr ?? stdout ?? `EXCEPTION: ${error}`);
  }
  if (errorCount || warningCount) unmatchedLines = [`${errorCount} errors, ${warningCount} warnings!`, '', ...unmatchedLines];

  // logsElement.innerText = unmatchedLines.join("\n")
  
  return markers;
}