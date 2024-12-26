// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import defaultScad from './default-scad';
import { State } from './app-state';
import { fetchSource } from '../utils';

export const defaultSourcePath = '/playground.scad';
export const defaultModelColor = '#f9d72c';
  
export async function createInitialState(state: State | null, source?: {content?: string, path?: string, url?: string}): Promise<State> {

  type Mode = State['view']['layout']['mode'];
  const mode: Mode = window.matchMedia("(min-width: 768px)").matches 
    ? 'multi' : 'single';

  let initialState: State;
  if (state) {
    if (source) throw new Error('Cannot provide source when state is provided');
    initialState = state;
  } else {
    let content, path, url;
    if (source) {
      content = source.content;
      path = source.path;
      url = source.url;
    } else {
      content = defaultScad;
      path = defaultSourcePath;
    }
    let activePath = path ?? (url && new URL(url).pathname.split('/').pop()) ?? defaultSourcePath;
    initialState = {
      params: {
        activePath,
        sources: [{path: activePath, content, url}],
        features: [],
        exportFormat2D: 'svg',
        exportFormat3D: 'glb',
      },
      view: {
        layout: {
          mode: 'multi',
          editor: true,
          viewer: true,
          customizer: false,
        } as any,

        color: defaultModelColor,
      },
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
      initialState.view.layout = {
        mode,
        focus: initialState.view.layout.viewer ? 'viewer'
          : initialState.view.layout.customizer ? 'customizer'
          : 'editor'
      }
    }
  }

  initialState.view.showAxes ??= true;

  // fs.writeFile(initialState.params.sourcePath, initialState.params.source);
  // if (initialState.params.sourcePath !== defaultSourcePath) {
  //   fs.writeFile(defaultSourcePath, defaultScad);
  // }
  
  const defaultFeatures = ['lazy-union'];
  defaultFeatures.forEach(f => {
    if (initialState.params.features.indexOf(f) < 0)
    initialState.params.features.push(f);
  });

  return initialState;
}

export async function getBlankProjectState() {
  return await createInitialState(null, {
    path: defaultSourcePath,
    content: defaultScad, 
  });
}
