// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import {App} from './components/App.tsx';
import { createEditorFS } from './fs/filesystem.ts';
import { registerOpenSCADLanguage } from './language/openscad-register-language.ts';
import { zipArchives } from './fs/zip-archives.ts';
import {readStateFromFragment} from './state/fragment-state.ts'
import { createInitialState, defaultSourcePath } from './state/initial-state.ts';
import defaultScad from './state/default-scad.ts';
import './index.css';

import debug from 'debug';
import { isInStandaloneMode, registerCustomAppHeightCSSProperty } from './utils.ts';
import { State, StatePersister } from './state/app-state.ts';
import { writeStateInFragment } from "./state/fragment-state.ts";

import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.min.css";

const nodeEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV) ? process.env.NODE_ENV : 'production';

const log = debug('app:log');

if (nodeEnv !== 'production') {
  debug.enable('*');
  log('Logging is enabled!');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        registrations.forEach(registration => {
          if (registration.scope.startsWith(window.location.origin)) {
            registration.unregister().catch((error) => {
              console.warn('Failed to unregister service worker in development mode.', error);
            });
          }
        });
      })
      .catch((error) => {
        console.warn('Failed to enumerate service workers in development mode.', error);
      });
  }
} else {
  debug.disable();
}

declare var BrowserFS: BrowserFSInterface


window.addEventListener('load', async () => {
  //*
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (nodeEnv === 'production' && !isLocalhost) {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('ServiceWorker registration successful with scope: ', registration.scope);

            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                  installingWorker.onstatechange = () => {
                      if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          // Reload to activate the service worker and apply caching
                          window.location.reload();
                          return;
                      }
                  };
                }
            };
        } catch (err) {
            console.log('ServiceWorker registration failed: ', err);
        }
    }
  }
  //*/
  
  registerCustomAppHeightCSSProperty();

  const computeDefaultEditorEnabled = () => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host.endsWith('github.io')) {
        return false;
      }
    }
    return true;
  };

  const editorEnabled = (() => {
    const getEnvValue = (key: string) =>
      (typeof process !== 'undefined' && process.env?.[key]) ? String(process.env[key]) : '';

    const defaultEnabled = computeDefaultEditorEnabled();

    if (typeof window === 'undefined') {
      const envValue = getEnvValue('PLAYGROUND_EDITOR_ENABLED').toLowerCase();
      if (envValue) {
        return !['0', 'false', 'off', 'no'].includes(envValue);
      }
      return defaultEnabled;
    }
    const globalConfig = window.OPENSCAD_PLAYGROUND_CONFIG ?? {};
    let enabled = typeof globalConfig.editor === 'boolean' ? globalConfig.editor : defaultEnabled;

    const envValue = getEnvValue('PLAYGROUND_EDITOR_ENABLED').toLowerCase();
    if (envValue) {
      enabled = !['0', 'false', 'off', 'no'].includes(envValue);
    }

    const params = new URLSearchParams(window.location.search);
    const param = params.get('editor');
    if (param) {
      const normalized = param.toLowerCase();
      enabled = !['0', 'false', 'off', 'no'].includes(normalized);
    }
    return enabled;
  })();

  const { fs } = await createEditorFS({prefix: '/libraries/', allowPersistence: isInStandaloneMode()});

  const seedDefaultSource = () => {
    try {
      const bfs = fs as any;
      if (typeof bfs?.existsSync === 'function' && bfs.existsSync(defaultSourcePath)) {
        return;
      }
      bfs.writeFileSync(defaultSourcePath, defaultScad, 'utf-8');
    } catch (error) {
      console.warn('Failed to seed default OpenSCAD source file.', error);
    }
  };

  seedDefaultSource();

  await registerOpenSCADLanguage(fs, '/', zipArchives);

  let statePersister: StatePersister;
  let persistedState: State | null = null;

  if (!editorEnabled) {
    statePersister = {
      set: async () => {},
    };
  } else if (isInStandaloneMode()) {
    const fs: FS = BrowserFS.BFSRequire('fs')
    try {
      const data = JSON.parse(new TextDecoder("utf-8").decode(fs.readFileSync('/state.json')));
      const {view, params} = data
      persistedState = {view, params};
    } catch (e) {
      console.log('Failed to read the persisted state from local storage.', e)
    }
    statePersister = {
      set: async ({view, params}) => {
        fs.writeFile('/state.json', JSON.stringify({view, params}));
      }
    };
  } else {
    persistedState = await readStateFromFragment();
    statePersister = {
      set: writeStateInFragment,
    };
  }

  const initialState = createInitialState(editorEnabled ? persistedState : null);

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App initialState={initialState} statePersister={statePersister} fs={fs} />
    </React.StrictMode>
  );
});
