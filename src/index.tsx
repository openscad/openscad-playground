// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './App';
import { createEditorFS } from './filesystem';
import { registerOpenSCADLanguage } from './language/openscad-register-language';
import { zipArchives } from './zip-archives';
import {readStateFromFragment} from './state/fragment-state'
import { createInitialState } from './state/initial-state';
import './index.css';

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

  // type Mode = State['view']['layout']['mode'];
  // const mode: Mode = window.matchMedia("(min-width: 768px)").matches 
  //   ? 'multi' : 'single';

  const initialState = createInitialState(fs, readStateFromFragment());

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App initialState={initialState} fs={fs} />
    </React.StrictMode>
  );
})();


