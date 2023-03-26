// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';
import { createEditorFS } from './filesystem';
import { registerOpenSCADLanguage } from './language/openscad-register-language';
import { zipArchives } from './zip-archives';
import {readStateFromFragment} from './fragment-state'
import { State } from './app-state';
import defaultScad from './default-scad'
import './index.css';
// import "react-widgets/styles.css";

import debug from 'debug';
const log = debug('app:log');

if (process.env.NODE_ENV !== 'production') {
  debug.enable('*');
  log('Logging is enabled!');
} else {
  debug.disable();
}

(async () => {
  
  const workingDir = '/home';
  const fs = await createEditorFS(workingDir)!;
  await registerOpenSCADLanguage(fs, workingDir, zipArchives);

  type Mode = State['view']['layout']['mode'];
  const mode: Mode = window.matchMedia("(min-width: 768px)").matches 
    ? 'multi' : 'single';

  const defaultSourcePath = '/home/playground.scad';
  const initialState: State = {
    params: {
      sourcePath: defaultSourcePath,
      source: defaultScad,
      features: [],
    },
    view: {
      layout: {
        mode: 'multi',
        editor: true,
        viewer: true,
        customizer: false,
      } as any
    },
    ...(readStateFromFragment() ?? {})
  };

  if (initialState.view.layout.mode != mode) {
    if (mode === 'multi' && initialState.view.layout.mode === 'single') {
      initialState.view.layout = {
        mode,
        editor: true,
        viewer: true,
        customizer: initialState.view.layout.focus == 'customizer'
      }
    } else if (mode === 'single' && initialState.view.layout.mode === 'multi') {
      initialState.view.layout = {
        mode,
        focus: initialState.view.layout.viewer ? 'viewer'
          : initialState.view.layout.customizer ? 'customizer'
          : 'editor'
      }
    }
  }

  fs.writeFile(initialState.params.sourcePath, initialState.params.source);
  if (initialState.params.sourcePath !== defaultSourcePath) {
    fs.writeFile(defaultSourcePath, defaultScad);
  }

  const defaultFeatures = ['manifold', 'fast-csg', 'lazy-union'];
  defaultFeatures.forEach(f => {
    if (initialState.params.features.indexOf(f) < 0)
      initialState.params.features.push(f);
  });

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App initialState={initialState} fs={fs} />
    </React.StrictMode>
  );
})();


