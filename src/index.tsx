// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { McpApp } from './components/McpApp.tsx';
import { createEditorFS } from './fs/filesystem.ts';
import { zipArchives } from './fs/zip-archives.ts';
import { createInitialState } from './state/initial-state.ts';
import './index.css';

import debug from 'debug';
import { isInStandaloneMode, registerCustomAppHeightCSSProperty } from './utils.ts';
import { State, StatePersister } from './state/app-state.ts';
import { isMcpMode, createMcpApp, bufferToolEvents, ToolEventBuffer } from './state/mcp-app.ts';
import type { App as McpApp_App } from '@modelcontextprotocol/ext-apps';

import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.min.css";

const log = debug('app:log');

if (process.env.NODE_ENV !== 'production') {
  debug.enable('*');
  log('Logging is enabled!');
} else {
  debug.disable();
}

declare var BrowserFS: BrowserFSInterface


window.addEventListener('load', async () => {
  const mcpMode = isMcpMode();

  // Skip service worker in MCP mode (we're in an iframe loading from the host)
  if (!mcpMode && process.env.NODE_ENV === 'production') {
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

  registerCustomAppHeightCSSProperty();

  // ─── MCP: connect early so resource loader is set before FS init ─
  // The App's tool surface (the `interact` tool) is declared during the
  // ui/initialize handshake, so createMcpApp() registers it before connect().
  // Tool input/result notifications that arrive before React mounts are
  // buffered and replayed by the McpApp component.
  let mcpApp: McpApp_App | undefined;
  let toolEvents: ToolEventBuffer | undefined;
  if (mcpMode) {
    console.log('[MCP] Detected MCP mode (running in iframe)');
    const ribbon = document.querySelector('.github-fork-ribbon');
    if (ribbon) (ribbon as HTMLElement).style.display = 'none';

    mcpApp = createMcpApp();
    toolEvents = bufferToolEvents(mcpApp);
    try {
      await mcpApp.connect();
      console.log('[MCP] Connected to host');
    } catch (err) {
      console.error('[MCP] Failed to connect to host:', err);
      mcpApp = undefined; // fall back to standalone
    }
  }

  console.log('[init] Creating editor FS...');
  // In MCP mode, skip loading 21 library ZIPs on the main thread — workers load them independently.
  const fs = await createEditorFS({prefix: '/libraries/', allowPersistence: !mcpMode && isInStandaloneMode(), skipLibraries: mcpMode});
  console.log('[init] Editor FS created');

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  if (mcpMode && mcpApp && toolEvents) {
    // ─── MCP App mode ──────────────────────────────────────────────
    const statePersister: StatePersister = { set: async () => {} };
    const initialState = createInitialState(null, { content: '' });

    root.render(
      <React.StrictMode>
        <McpApp
          initialState={initialState}
          statePersister={statePersister}
          fs={fs}
          app={mcpApp}
          toolEvents={toolEvents}
        />
      </React.StrictMode>
    );
  } else {
    // ─── Standalone mode ───────────────────────────────────────────
    renderStandalone(fs, root);
  }
});

async function renderStandalone(fs: FS, root: ReactDOM.Root) {
  // Dynamic imports to keep Monaco/editor out of the MCP bundle
  const [
    { App },
    { registerOpenSCADLanguage },
    { readStateFromFragment, writeStateInFragment },
  ] = await Promise.all([
    import('./components/App.tsx'),
    import('./language/openscad-register-language.ts'),
    import('./state/fragment-state.ts'),
  ]);

  await registerOpenSCADLanguage(fs, '/', zipArchives);

  let statePersister: StatePersister;
  let persistedState: State | null = null;

  if (isInStandaloneMode()) {
    const bfs: FS = (globalThis as any).BrowserFS.BFSRequire('fs');
    try {
      const data = JSON.parse(new TextDecoder("utf-8").decode(bfs.readFileSync('/state.json')));
      const {view, params} = data;
      persistedState = {view, params};
    } catch (e) {
      console.log('Failed to read the persisted state from local storage.', e);
    }
    statePersister = {
      set: async ({view, params}) => {
        bfs.writeFile('/state.json', JSON.stringify({view, params}));
      }
    };
  } else {
    persistedState = await readStateFromFragment();
    statePersister = {
      set: writeStateInFragment,
    };
  }

  const initialState = createInitialState(persistedState);

  root.render(
    <React.StrictMode>
      <App initialState={initialState} statePersister={statePersister} fs={fs} />
    </React.StrictMode>
  );
}
