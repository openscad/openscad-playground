// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useCallback, useEffect, useState } from 'react';
import {State, StatePersister} from '../state/app-state'
import { Model } from '../state/model';
import FullLayout from './FullLayout';
import EmbedView from './EmbedView';
import { ModelContext, FSContext } from './contexts';
import { fullAppUrl } from '../state/embed';
import { useFullscreenApi } from './use-fullscreen';
import { CornerButton, EmbedIcons } from './EmbedView';


export function App({initialState, statePersister, fs}: {initialState: State, statePersister: StatePersister, fs: FS}) {
  const [state, setState] = useState(initialState);
  
  const model = new Model(fs, state, setState, statePersister);
  useEffect(() => model.init());

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

  const fullscreen = useFullscreenApi();
  const openFullApp = useCallback(() => {
    try {
      window.open(fullAppUrl(window.location.href), '_blank', 'noopener');
    } catch (e) {
      console.warn('Could not open the full app:', e);
    }
  }, []);

  const isDark = false; // the web app has a light theme

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        {state.view.embed
          ? <EmbedView
              viewerRef={null}
              isDark={isDark}
              fullscreen={fullscreen}
              toolbar={
                <CornerButton icon={EmbedIcons.externalLink} label="Open in full app" onClick={openFullApp} />
              } />
          : <FullLayout />}
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}
