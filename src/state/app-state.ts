// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { ParameterSet } from './customizer-types';

export type MultiLayoutComponentId = 'editor' | 'viewer' | 'customizer';
export type SingleLayoutComponentId = MultiLayoutComponentId;

export const VALID_RENDER_FORMATS = {
  'stl': true,
  'glb': true,
};
export const VALID_EXPORT_FORMATS = {
  'stl': true,
  'off': true,
  'glb': true,
  '3mf': true,
  'x3d': true,
  'dae': true,
};

export type Source = {
  // If path ends w/ /, it's a directory, and URL should contain a ZIP file that can be mounted
  path: string,
  url?: string,
  content?: string,
};

export interface FileOutput {
  outFile: File,
  outFileURL: string,
  elapsedMillis: number,
  formattedElapsedMillis: string,
  formattedOutFileSize: string,
}

export interface State {
  params: {
    activePath: string,
    sources: Source[],
    vars?: {[name: string]: any},
    features: string[],
    renderFormat: keyof typeof VALID_RENDER_FORMATS,
    exportFormat: keyof typeof VALID_EXPORT_FORMATS,
    extruderColors?: string[],
  },

  view: {
    logs?: boolean,
    extruderPicker?: boolean,
    layout: {
      mode: 'single',
      focus: SingleLayoutComponentId,
    } | ({
      mode: 'multi',
    } & { [K in MultiLayoutComponentId]: boolean })

    collapsedCustomizerTabs?: string[],
    
    color: string,
    showAxes?: boolean,
    showShadows?: boolean,
    lineNumbers?: boolean,
  }

  lastCheckerRun?: {
    logText: string,
    markers: monaco.editor.IMarkerData[],
  }
  rendering?: boolean,
  previewing?: boolean,
  exporting?: boolean,
  checkingSyntax?: boolean,

  parameterSet?: ParameterSet,
  error?: string,
  output?: FileOutput & {
    isPreview: boolean,
  },
  export?: FileOutput,
};

export interface StatePersister {
  set(state: State): Promise<void>;
}

export {}