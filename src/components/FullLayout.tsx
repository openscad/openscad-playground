// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useContext } from 'react';
import { MultiLayoutComponentId } from '../state/app-state';
import EditorPanel from './EditorPanel';
import ViewerPanel, { ViewerPanelHandle } from './ViewerPanel';
import Footer from './Footer';
import { ModelContext } from './contexts';
import PanelSwitcher from './PanelSwitcher';
import { ConfirmDialog } from 'primereact/confirmdialog';
import CustomizerPanel from './CustomizerPanel';
import WasmStatusBanner from './WasmStatusBanner';

/** The full UI: tab bar, editor / viewer / customizer panels and footer. */
export default function FullLayout({viewerRef}: {viewerRef?: React.Ref<ViewerPanelHandle>}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

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
    <div className='flex flex-column' style={{
        flex: 1,
      }}>
      
      <PanelSwitcher />

      <WasmStatusBanner />

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
        <ViewerPanel ref={viewerRef} className={layout.mode === 'single' ? `absolute-fill` : ''} style={getPanelStyle('viewer')} />
        <CustomizerPanel className={`
          opacity-animated
          ${layout.mode === 'single' && layout.focus !== 'customizer' ? 'opacity-0' : ''}
          ${layout.mode === 'single' ? `absolute-fill` : ''}
        `} style={getPanelStyle('customizer')} />
      </div>

      <Footer />
      <ConfirmDialog />
    </div>
  );
}
