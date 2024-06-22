// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export type MultiLayoutComponentId = 'editor' | 'viewer' | 'customizer';
export type SingleLayoutComponentId = MultiLayoutComponentId;

export const VALID_RENDER_FORMATS = {
  'stl': true,
  'glb': true,
  '3mf': true,
  'x3d': true,
  'stp': true,
  'dae': true,
};

export interface State {
  params: {
    sourcePath: string,
    source: string,
    features: string[],
    renderFormat: keyof typeof VALID_RENDER_FORMATS,
    extruderColors?: string[],
  },

  view: {
    logs?: boolean,
    layout: {
      mode: 'single',
      focus: SingleLayoutComponentId,
    } | ({
      mode: 'multi',
    } & { [K in MultiLayoutComponentId]: boolean })
    
    color: string,
    showAxes?: boolean,
    showShadows?: boolean,
    lineNumbers?: boolean,
  }

  lastCheckerRun?: {
    logText: string,
    markers: monaco.editor.IMarkerData[]
  }
  rendering?: boolean,
  previewing?: boolean,
  checkingSyntax?: boolean,

  error?: string,
  output?: {
    isPreview: boolean,
    outFile: File,
    outFileURL: string,
    elapsedMillis: number,
    formattedElapsedMillis: string,
    formattedOutFileSize: string,
    // path: string,
    // timestamp: number,
    // sizeBytes: number,
    // formattedSize: string,
  },
};

export interface StatePersister {
  set(state: State): Promise<void>;
}

export {}