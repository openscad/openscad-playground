// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './components/App';
import { createEditorFS } from './fs/filesystem';
import { registerOpenSCADLanguage } from './language/openscad-register-language';
import { zipArchives } from './fs/zip-archives';
import {readStateFromFragment} from './state/fragment-state'
import { createInitialState } from './state/initial-state';
import './index.css';

import debug from 'debug';
import { registerCustomAppHeightCSSProperty } from './utils';
const log = debug('app:log');

if (process.env.NODE_ENV !== 'production') {
  debug.enable('*');
  log('Logging is enabled!');
} else {
  debug.disable();
}

(async () => {
  registerCustomAppHeightCSSProperty();

  const fs = await createEditorFS('/');
  await registerOpenSCADLanguage(fs, '/', zipArchives);

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


