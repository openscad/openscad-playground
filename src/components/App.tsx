// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useEffect, useState } from 'react';
import {MultiLayoutComponentId, State, StatePersister} from '../state/app-state'
import { Model } from '../state/model';
import EditorPanel from './EditorPanel';
import ViewerPanel from './ViewerPanel';
import Footer from './Footer';
import { ModelContext, FSContext } from './contexts';
import PanelSwitcher from './PanelSwitcher';
import { ConfirmDialog } from 'primereact/confirmdialog';
import CustomizerPanel from './CustomizerPanel';


export function App({initialState, statePersister, fs}: {initialState: State, statePersister: StatePersister, fs: FS}) {
  const [state, setState] = useState(initialState);

  const model = new Model(fs, state, setState, statePersister);
  useEffect(() => model.init());

  // Dynamic theme loading
  useEffect(() => {
    const theme = state.view.theme;
    const themeCssId = 'primereact-theme-css';

    // Remove existing theme CSS
    const existingTheme = document.getElementById(themeCssId);
    if (existingTheme) {
      existingTheme.remove();
    }

    // Load new theme CSS
    const link = document.createElement('link');
    link.id = themeCssId;
    link.rel = 'stylesheet';
    link.href = `/primereact/resources/themes/lara-${theme}-indigo/theme.css`;
    document.head.appendChild(link);

  }, [state.view.theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F5') {
        event.preventDefault();
        model.render({isPreview: true, now: true})
      } else if (event.key === 'F6') {
        event.preventDefault();
        model.render({isPreview: false, now: true})
      } else if (event.key === 'F7') {
        event.preventDefault();
        model.export();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const zIndexOfPanelsDependingOnFocus = {
    editor: {
      editor: 3,
      viewer: 1,
      customizer: 0,
    },
    viewer: {
      editor: 2,
      viewer: 3,
      customizer: 1,
    },
    customizer: {
      editor: 0,
      viewer: 1,
      customizer: 3,
    }
  }

  const layout = state.view.layout
  const mode = state.view.layout.mode;
  function getPanelStyle(id: MultiLayoutComponentId): CSSProperties {
    if (layout.mode === 'multi') {
      const itemCount = (layout.editor ? 1 : 0) + (layout.viewer ? 1 : 0) + (layout.customizer ? 1 : 0)
      return {
        flex: 1,
        maxWidth: Math.floor(100/itemCount) + '%',
        display: (state.view.layout as any)[id] ? 'flex' : 'none'
      }
    } else {
      return {
        flex: 1,
        zIndex: Number((zIndexOfPanelsDependingOnFocus as any)[id][layout.focus]),
      }
    }
  }

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        <div className='flex flex-column' style={{
            flex: 1,
          }}>

          <PanelSwitcher />

          <div className={mode === 'multi' ? 'flex flex-row' : 'flex flex-column'}
              style={mode === 'multi' ? {flex: 1} : {
                flex: 1,
                position: 'relative'
              }}>

            <EditorPanel className={`
              opacity-animated
              ${layout.mode === 'single' && layout.focus !== 'editor' ? 'opacity-0' : ''}
              ${layout.mode === 'single' ? 'absolute-fill' : ''}
            `} style={getPanelStyle('editor')} />
            <ViewerPanel className={layout.mode === 'single' ? `absolute-fill` : ''} style={getPanelStyle('viewer')} />
            <CustomizerPanel className={`
              opacity-animated
              ${layout.mode === 'single' && layout.focus !== 'customizer' ? 'opacity-0' : ''}
              ${layout.mode === 'single' ? `absolute-fill` : ''}
            `} style={getPanelStyle('customizer')} />
          </div>

          <Footer />
          <ConfirmDialog />
        </div>
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}
