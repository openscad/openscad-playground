// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import { createEditorFS } from './filesystem';
import { registerOpenSCADLanguage } from './language/openscad-register-language';
import { zipArchives } from './zip-archives';
import {readStateFromFragment} from './fragment-state'
import { State } from './app-state';
import './index.css';
import defaultScad from './default-scad'

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
  const fs = await createEditorFS(workingDir);
  await registerOpenSCADLanguage(fs, workingDir, zipArchives);

  const initialState: State = readStateFromFragment() ?? {
    params: {
      source: defaultScad,
      features: [],
    }
  };

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
      <App initialState={initialState} />
    </React.StrictMode>
  );
  
  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
})();


