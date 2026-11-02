/**
 * Lightweight marker types compatible with monaco.editor.IMarkerData.
 * Extracted so that the runner and output parser (which also run in web
 * workers) don't pull in the full Monaco editor.
 */

export enum MarkerSeverity {
  Hint = 1,
  Info = 2,
  Warning = 4,
  Error = 8,
}

export interface MarkerData {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: MarkerSeverity;
}
