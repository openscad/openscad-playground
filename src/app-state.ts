// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

import { createContext } from "react"
import { Model } from "./model"

export interface State {
  params: {
    source: string,
  },
  checkerRun?: {
    logText: string,
    markers: monaco.editor.IMarkerData[]
  }
  output?: {
    path: string,
    timestamp: number,
    sizeBytes: number,
    formattedSize: string,
  },
};

export const ModelContext = createContext(new Model(
  {
    params: {
      source: ''
    }
  },
  () => { throw new Error('Not implemented'); }
));

