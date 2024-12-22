// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import defaultScad from './default-scad';
import { State } from './app-state';

export const defaultSourcePath = '/playground.scad';
export const defaultModelColor = '#f9d72c';
  
export function createInitialState(state: State | null, content: string = defaultScad): State {

  type Mode = State['view']['layout']['mode'];
  const mode: Mode = window.matchMedia("(min-width: 768px)").matches 
    ? 'multi' : 'single';

  const initialState: State = {
    params: {
      activePath: defaultSourcePath,
      sources: [{path: defaultSourcePath, content}],
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
    ...(state ?? {})
  };

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

  initialState.view.showAxes ??= true
  initialState.view.showShadows ??= true

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


export const blankProjectState: State = createInitialState(null, '');
