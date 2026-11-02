// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useEffect, useState } from 'react';
import {State, StatePersister} from '../state/app-state'
import { Model } from '../state/model';
import FullLayout from './FullLayout';
import EmbedView from './EmbedView';
import { ModelContext, FSContext } from './contexts';
import { fullAppUrl, isFramed } from '../state/embed';
import { useFullscreenApi } from './use-fullscreen';
import { EmbedIcons } from './EmbedView';


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
  const isDark = false; // the web app has a light theme

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        {state.view.embed
          ? <EmbedView
              viewerRef={null}
              isDark={isDark}
              fullscreen={fullscreen}
              // Framed: open the same state as the full app in a new tab (the embedder wants the iframe to stay
              // compact). Top-level: switch in place.
              exit={isFramed()
                ? { label: 'Open full app in a new tab', icon: EmbedIcons.externalLink, href: () => fullAppUrl(window.location.href) }
                : { label: 'Exit embed mode (full app)', icon: EmbedIcons.layout, onClick: () => model.mutate(s => { s.view.embed = false; s.view.customizerOverlay = false; }) }} />
          : <FullLayout />}
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}
