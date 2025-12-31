// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import defaultScad from './default-scad.ts';
import { State } from './app-state.ts';

export const defaultSourcePath = '/playground.scad';
export const defaultModelColor = '#f9d72c';
const defaultBlurhash = "|KSPX^%3~qtjMx$lR*x]t7n,R%xuxbM{WBt7ayfk_3bY9FnAt8XOxanjNF%fxbMyIn%3t7NFoLaeoeV[WBo{xar^IoS1xbxcR*S0xbofRjV[j[kCNGofxaWBNHW-xasDR*WTkBxuWBM{s:t7bYahRjfkozWUadofbIW:jZ";
  
export function createInitialState(state: State | null, source?: {content?: string, path?: string, url?: string, blurhash?: string}): State {

  type Mode = State['view']['layout']['mode'];
  
  const mode: Mode = window.matchMedia("(min-width: 768px)").matches 
    ? 'multi' : 'single';

  let initialState: State;
  if (state) {
    if (source) throw new Error('Cannot provide source when state is provided');
    initialState = state;
  } else {
    let content, path, url, blurhash;
    if (source) {
      content = source.content;
      path = source.path;
      url = source.url;
      blurhash = source.blurhash;
    } else {
      content = defaultScad;
      path = defaultSourcePath;
      blurhash = defaultBlurhash;
    }
    let activePath = path ?? (url && new URL(url).pathname.split('/').pop()) ?? defaultSourcePath;
    initialState = {
      params: {
        activePath,
        sources: [{path: activePath, content, url}],
        features: [],
        exportFormat2D: 'svg',
        exportFormat3D: 'stl',
      },
      view: {
        layout: {
          mode: 'multi',
          editor: true,
          viewer: true,
          customizer: false,
        } as any,

        color: defaultModelColor,
        theme: (typeof localStorage !== 'undefined' && localStorage.getItem('theme') as 'light' | 'dark') || 'dark' as const,
      },
      preview: blurhash ? {blurhash} : undefined,
    };
  }

  if (initialState.view.layout.mode != mode) {
    if (mode === 'multi' && initialState.view.layout.mode === 'single') {
      initialState.view.layout = {
        mode,
        editor: true,
        viewer: true,
        customizer: initialState.view.layout.focus == 'customizer'
      }
    } else if (mode === 'single' && initialState.view.layout.mode === 'multi') {
      const layout = initialState.view.layout;
      const focus = layout.viewer ? 'viewer'
        : layout.customizer ? 'customizer'
        : 'editor';
      initialState.view.layout = {
        mode,
        focus
      }
    }
  }

  initialState.view.showAxes ??= true;
  
  const defaultFeatures = ['lazy-union'];
  defaultFeatures.forEach(f => {
    if (initialState.params.features.indexOf(f) < 0)
    initialState.params.features.push(f);
  });

  return initialState;
}

export function getBlankProjectState() {
  return createInitialState(null, {
    path: defaultSourcePath,
    content: defaultScad, 
  });
}
