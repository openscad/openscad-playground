// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import React from 'react';
import { Model } from "./model"

export interface State {
  params: {
    source: string,
    features: string[],
  },
  lastCheckerRun?: {
    logText: string,
    markers: monaco.editor.IMarkerData[]
  }
  rendering?: boolean,
  previewing?: boolean,
  checkingSyntax?: boolean,

  output?: {
    isPreview: boolean,
    stlFile: File,
    stlFileURL: string,
  },
};

export const ModelContext = React.createContext(new Model(
  {
    params: {
      source: '',
      features: ['manifold', 'lazy-union'],
    }
  },
  () => { throw new Error('Not implemented'); }
));

