// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import {MultiLayoutComponentId, State, StatePersister} from '../state/app-state'
import { Model } from '../state/model';
import EditorPanel from './EditorPanel';
import ViewerPanel from './ViewerPanel';
import Footer from './Footer';
import { ModelContext, FSContext } from './contexts';
import PanelSwitcher from './PanelSwitcher';
import { ProjectGalleryDialog } from './ProjectGalleryDialog';

declare global {
  interface Window {
    OPENSCAD_PLAYGROUND_CONFIG?: {
      editor?: boolean;
      editorToggle?: boolean;
      customizerOpen?: boolean;
    };
  }
}
import { ConfirmDialog } from 'primereact/confirmdialog';
import CustomizerPanel from './CustomizerPanel';


type UIConfig = {
  editorEnabled: boolean;
  showEditorToggle: boolean;
  customizerDefaultOpen: boolean;
};

const baseUIConfig: UIConfig = {
  editorEnabled: true,
  showEditorToggle: true,
  customizerDefaultOpen: false,
};

function computeDefaultUIConfig(): UIConfig {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.endsWith('github.io')) {
      return {
        editorEnabled: false,
        showEditorToggle: false,
        customizerDefaultOpen: false,
      };
    }
  }
  return baseUIConfig;
}

function readUIConfig(): UIConfig {
  const defaults = computeDefaultUIConfig();
  if (typeof window === 'undefined') return defaults;
  const globalConfig = window.OPENSCAD_PLAYGROUND_CONFIG ?? {};
  let editorEnabled = typeof globalConfig.editor === 'boolean' ? globalConfig.editor : defaults.editorEnabled;
  let showEditorToggle = typeof globalConfig.editorToggle === 'boolean' ? globalConfig.editorToggle : defaults.showEditorToggle;
  let customizerDefaultOpen = typeof globalConfig.customizerOpen === 'boolean' ? globalConfig.customizerOpen : defaults.customizerDefaultOpen;
  let toggleExplicit = typeof globalConfig.editorToggle === 'boolean';
  let customizerExplicit = typeof globalConfig.customizerOpen === 'boolean';

  const envEditor = (typeof process !== 'undefined' && process.env?.PLAYGROUND_EDITOR_ENABLED ? process.env.PLAYGROUND_EDITOR_ENABLED : '').toLowerCase();
  if (envEditor) {
    editorEnabled = !['0', 'false', 'off', 'no'].includes(envEditor);
  }

  const envToggle = (typeof process !== 'undefined' && process.env?.PLAYGROUND_EDITOR_TOGGLE ? process.env.PLAYGROUND_EDITOR_TOGGLE : '').toLowerCase();
  if (envToggle) {
    toggleExplicit = true;
    showEditorToggle = !['0', 'false', 'off', 'no'].includes(envToggle);
  }

  const envCustomizer = (typeof process !== 'undefined' && process.env?.PLAYGROUND_CUSTOMIZER_OPEN ? process.env.PLAYGROUND_CUSTOMIZER_OPEN : '').toLowerCase();
  if (envCustomizer) {
    customizerExplicit = true;
    customizerDefaultOpen = !['0', 'false', 'off', 'no', 'closed'].includes(envCustomizer);
  }

  const params = new URLSearchParams(window.location.search);
  const editorParam = params.get('editor');
  if (editorParam) {
    const normalized = editorParam.toLowerCase();
    editorEnabled = !['0', 'false', 'off', 'no'].includes(normalized);
  }

  const toggleParam = params.get('editorToggle');
  if (toggleParam) {
    const normalized = toggleParam.toLowerCase();
    showEditorToggle = !['0', 'false', 'off', 'no'].includes(normalized);
    toggleExplicit = true;
  }

  const customizerParam = params.get('customizer');
  if (customizerParam) {
    const normalized = customizerParam.toLowerCase();
    customizerDefaultOpen = !['0', 'false', 'off', 'no', 'closed'].includes(normalized);
    customizerExplicit = true;
  }

  if (!toggleExplicit) {
    showEditorToggle = editorEnabled;
  }

  if (!editorEnabled) {
    showEditorToggle = false;
  }

  return {
    editorEnabled,
    showEditorToggle,
    customizerDefaultOpen,
  };
}

function applyUIConfigToState(state: State, config: UIConfig): State {
  const result = JSON.parse(JSON.stringify(state)) as State;

  if (!config.editorEnabled) {
    result.view.logs = false;

    if (result.view.layout.mode === 'multi') {
      result.view.layout.editor = false;
      if (!result.view.layout.viewer && !result.view.layout.customizer) {
        result.view.layout.viewer = true;
      }
    } else if (result.view.layout.focus === 'editor') {
      result.view.layout.focus = 'viewer';
    }
  }

  if (config.customizerDefaultOpen) {
    if (result.view.layout.mode === 'multi') {
      result.view.layout.customizer = true;
      if (!result.view.layout.viewer && (config.editorEnabled ? !result.view.layout.editor : true)) {
        result.view.layout.viewer = true;
      }
    } else {
      if (!config.editorEnabled && result.view.layout.focus === 'editor') {
        result.view.layout.focus = 'viewer';
      }
      result.view.layout.focus = 'customizer';
    }
  }

  return result;
}

export function App({initialState, statePersister, fs}: {initialState: State, statePersister: StatePersister, fs: FS}) {
  const uiConfig = useMemo(readUIConfig, []);
  const initialStateWithConfig = useMemo(
    () => applyUIConfigToState(initialState, uiConfig),
    [initialState, uiConfig],
  );

  const [state, setState] = useState(initialStateWithConfig);

  const urlParams = new URLSearchParams(window.location.search);
  const modelParam = urlParams.get('model');
  const isDefaultActive = initialStateWithConfig.params.activePath === '/playground.scad';
  const shouldOpenGallery = !modelParam && (!window.location.hash) && (
    !uiConfig.editorEnabled || isDefaultActive
  );

  const defaultGalleryVariant: 'dialog' | 'fullscreen' = uiConfig.editorEnabled ? 'dialog' : 'fullscreen';
  const [galleryVisible, setGalleryVisible] = useState(shouldOpenGallery);
  const [galleryVariant, setGalleryVariant] = useState<'dialog' | 'fullscreen'>(shouldOpenGallery ? 'fullscreen' : defaultGalleryVariant);
  
  const showLanding = galleryVisible && galleryVariant === 'fullscreen';

  const modelRef = useRef<Model | null>(null);
  if (!modelRef.current) {
    modelRef.current = new Model(fs, state, setState, statePersister, uiConfig.editorEnabled);
  } else {
    modelRef.current.state = state;
  }
  const model = modelRef.current;
  const isStaticProject = model.state.project?.type === 'static';
  const editorEnabledForProject = uiConfig.editorEnabled && !isStaticProject;
  model.setEditorEnabled(editorEnabledForProject);

  useEffect(() => {
    if (!model || showLanding) {
      return;
    }
    model.init();

    // Handle model parameter from URL
    if (modelParam) {
      const modelPath = `/libraries/Models/${modelParam}`;
      const bfs = fs as any;
      let opened = false;

      try {
        // First, try to read project.json to get the entry point
        const projectJsonPath = `${modelPath}/project.json`;
        if (bfs.existsSync(projectJsonPath)) {
          const projectData = JSON.parse(bfs.readFileSync(projectJsonPath, 'utf-8'));
          const projectType = (projectData.type === 'static') ? 'static' : 'scad';
          if (projectData.entry) {
            const entryPath = `${modelPath}/${projectData.entry}`;
            if (bfs.existsSync(entryPath)) {
              if (projectType === 'static') {
                model.openStaticProject(entryPath, { projectId: modelParam });
                opened = true;
              } else {
                model.openFile(entryPath);
                opened = true;
              }
            }
          }
        }
      } catch (err) {
        console.debug('Failed to read project.json:', err);
      }

      // Fallback: Try common file names
      const tryPaths = [
        `${modelPath}/main.scad`,
        `${modelPath}/Main.scad`,
        `${modelPath}/${modelParam}.scad`
      ];

      for (const path of tryPaths) {
        try {
          if (bfs.existsSync(path)) {
            model.openFile(path);
            opened = true;
            break;
          }
        } catch (err) {
          console.debug(`Model file not found at ${path}`);
        }
      }

      // If still not found, scan directory for any .scad file
      if (!opened) {
        try {
          const files = bfs.readdirSync(modelPath) as string[];
          for (const file of files) {
            if (file.toLowerCase().endsWith('.scad')) {
              model.openFile(`${modelPath}/${file}`);
              opened = true;
              break;
            }
          }
        } catch (err) {
          console.error(`Failed to load model ${modelParam}:`, err);
        }
      }

      if (opened) {
        setGalleryVisible(false);
        setGalleryVariant(defaultGalleryVariant);
        return;
      }
    }
  }, [model, modelParam, fs, defaultGalleryVariant, showLanding]);

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

  if (showLanding) {
    return (
      <FSContext.Provider value={fs}>
        <ModelContext.Provider value={null}>
          <ProjectGalleryDialog
            visible={true}
            variant="fullscreen"
            mode="standalone"
            onHide={() => {
              /* no-op */
            }}
            onOpenProject={() => {
              setGalleryVisible(false);
              setGalleryVariant(defaultGalleryVariant);
            }}
          />
        </ModelContext.Provider>
      </FSContext.Provider>
    );
  }

  if (!model) {
    return null;
  }

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        <div className='flex flex-column' style={{
            flex: 1,
          }}>
          
          <PanelSwitcher
            onOpenGallery={(variant) => {
              const nextVariant = editorEnabledForProject ? variant : 'fullscreen';
              setGalleryVariant(nextVariant);
              setGalleryVisible(true);
            }}
            editorEnabled={editorEnabledForProject}
            showEditorToggle={uiConfig.showEditorToggle && !isStaticProject}
          />

          <ProjectGalleryDialog
            visible={galleryVisible}
            variant={galleryVariant}
            onHide={() => {
              setGalleryVisible(false);
              setGalleryVariant(defaultGalleryVariant);
            }}
            onOpenProject={() => {
              setGalleryVariant(defaultGalleryVariant);
            }}
          />

          <div className={mode === 'multi' ? 'flex flex-row' : 'flex flex-column'}
              style={mode === 'multi' ? {flex: 1} : {
                flex: 1,
                position: 'relative'
              }}>

            {editorEnabledForProject && (
              <EditorPanel className={`
                opacity-animated
                ${layout.mode === 'single' && layout.focus !== 'editor' ? 'opacity-0' : ''}
                ${layout.mode === 'single' ? 'absolute-fill' : ''}
              `} style={getPanelStyle('editor')} />
            )}
            <ViewerPanel className={layout.mode === 'single' ? `absolute-fill` : ''} style={getPanelStyle('viewer')} />
            {!isStaticProject && (
              <CustomizerPanel className={`
              opacity-animated
              ${layout.mode === 'single' && layout.focus !== 'customizer' ? 'opacity-0' : ''}
              ${layout.mode === 'single' ? `absolute-fill` : ''}
            `} style={getPanelStyle('customizer')} />
            )}
          </div>

          <Footer />
          <ConfirmDialog />
        </div>
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}
