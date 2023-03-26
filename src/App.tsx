// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { CSSProperties, forwardRef, useContext, useEffect, useRef, useState } from 'react';
import {MultiLayoutComponentId, SingleLayoutComponentId, State} from './state/app-state'
import Editor, { loader, Monaco } from '@monaco-editor/react';
// import './App.css';
import openscadEditorOptions from './language/openscad-editor-options';
import { Model, ModelContext } from './state/model';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {StlViewer} from "react-stl-viewer";
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { MenuItem } from 'primereact/menuitem';
import { TreeSelect } from 'primereact/treeselect';
import TreeNode from 'primereact/treenode';
import { TabMenu } from 'primereact/tabmenu';
import { Badge } from 'primereact/badge';
import { Menu } from 'primereact/menu';
import { ToggleButton } from 'primereact/togglebutton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Toast } from 'primereact/toast';
import { getParentDir } from './filesystem';
import { BreadCrumb } from 'primereact/breadcrumb';
import { ScrollPanel } from 'primereact/scrollpanel';
import { Splitter, SplitterPanel } from 'primereact/splitter';
import { Toolbar } from 'primereact/toolbar';
import { buildUrlForStateParams } from './state/fragment-state';
import { blankProjectState } from './state/initial-state';

// import "primereact/resources/themes/lara-light-indigo/theme.css";
// import "primereact/resources/primereact.min.css";
// import "primeicons/primeicons.css"; 

let monacoInstance: Monaco
loader.init().then(mi => monacoInstance = mi);

const isFileWritable = (path: string) => getParentDir(path) === '/home'

const FSContext = React.createContext<FS | undefined>(undefined);

function listFilesAsNodes(fs: FS, path: string): TreeNode[] {
  const files: [string, string][] = []
  const dirs: [string, string][] = []
  for (const name of fs.readdirSync(path)) {
    const childPath = `${path}/${name}`;
    const stat = fs.lstatSync(childPath);
    const isDirectory = stat.isDirectory();
    if (!isDirectory && !name.endsWith('.scad')) {
      continue;
    }
    (isDirectory ? dirs : files).push([name, childPath]);
  }
  [files, dirs].forEach(arr => arr.sort(([a], [b]) => a.localeCompare(b)));

  const nodes: TreeNode[] = []
  for (const [arr, isDirectory] of [[files, false], [dirs, true]] as [[string, string][], boolean][]) {
    for (const [name, path] of arr) {
      const children = isDirectory ? listFilesAsNodes(fs, path) : undefined;
      if (isDirectory && children!.length == 0) {
        continue;
      }
      nodes.push({
        // icon: path == '/home' ? 'pi-home' : ...
        icon: isDirectory ? 'pi pi-folder' : isFileWritable(path) ? 'pi pi-file' : 'pi pi-lock',
        label: name,
        data: path,
        key: path,
        children,
        selectable: !isDirectory // && (name == 'LICENSE' || name.endsWith('.scad') || name.endsWith('.scad')
      });
    }
  }
  return nodes;
}

function EditorPanel({className, style}: {className?: string, style?: CSSProperties}) {

  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

  const fs = useContext(FSContext);
  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)
  // const [modelFile, setModelFile] = useState(state.params.sourcePath);

  if (editor) {
    const checkerRun = state.lastCheckerRun;
    const editorModel = editor.getModel();
    if (editorModel) {
      if (checkerRun) {
        monacoInstance.editor.setModelMarkers(editorModel, 'openscad', checkerRun.markers);
      }
      // if (modelFile !== state.params.sourcePath) {
      //   editor.setModel(monaco.editor.createModel('', 'openscad'));
      //   setModelFile(state.params.sourcePath)
      // }
    }
  }

  const onMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editor.addAction({
      id: "openscad-render",
      label: "Render OpenSCAD",
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        monaco.KeyCode.F6,
      ],
      run: () => model.render({isPreview: false, now: true})
    });
    editor.addAction({
      id: "openscad-preview",
      label: "Preview OpenSCAD",
      keybindings: [monaco.KeyCode.F5],
      run: () => model.render({isPreview: true, now: true})
    });
    setEditor(editor)
  }

  // const breadCrumbsHome: MenuItem = {
  //   icon: 'pi pi-home'
  // }

  // const breadCrumbsItems: MenuItem[] = [
  //   {
  //     label: 'input.scad',
  //     command: () => alert('ok')
  //   }
  // ]

  const fsItems = fs && listFilesAsNodes(fs, '/home') || [];

  // console.log('getParentDir(', state.params.sourcePath, ')', getParentDir(state.params.sourcePath))
  return (
    <div className={`editor-panel ${className ?? ''}`} style={{
      // maxWidth: '5 0vw',
      display: 'flex',
      flexDirection: 'column',
      // position: 'relative',
      // width: '100%', height: '100%',
      ...(style ?? {})
    }}>
      {/* <BreadCrumb model={breadCrumbsItems} home={breadCrumbsHome}/> */}
      <TreeSelect 
          title='OpenSCAD Playground Files'
          value={state.params.sourcePath}
          onChange={(e) => model.openFile(String(e.value))}
          filter
          options={fsItems} />

      {/* <SplitPane type="vertical"> */}
      {/* <div className='flex flex-column'> */}
      {/* <Splitter style={{ 
        // height: '300px' 
      }} layout="vertical"> */}
        {/* <SplitterPanel className="flex flex-column align-items-center justify-content-center"
          style={{
            // width: '100%', height: '100%'
          }}> */}
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <Editor
              className="openscad-editor absolute-fill"
              defaultLanguage="openscad"
              path={state.params.sourcePath}
              value={state.params.source}
              onChange={s => model.source = s ?? ''}
              onMount={onMount} // TODO: This looks a bit silly, does it trigger a re-render??
              options={{
                ...openscadEditorOptions,
                readOnly: !isFileWritable(state.params.sourcePath)
              }}
              // height="100%"
              // width="100%"
              // height="80vh"
              />
          </div>

          {/* </SplitterPanel>
          <SplitterPanel className="flex flex-column align-items-center justify-content-center" style={{position: 'relative'}}> */}
            {/* <ScrollPanel style={{
              //  width: '100%', height: '200px' 
            }} className="custombar2"> */}
            <div style={{
              display: state.view.logs ? undefined : 'none',
              overflowY: 'scroll',
              height: 'calc(min(200px, 30vh))',
              // position: 'relative',
              // maxWidth: '100%',
              // maxWidth: '50vw',
            }}>
              <pre><code id="logs" style={{
                // maxWidth: '200px'
              }}>{state.lastCheckerRun?.logText ?? 'No log yet!'}</code></pre>
            </div>
            {/* </ScrollPanel> */}
            {/* <div className="logs-container">
            </div> */}
          {/* </SplitterPanel>
      </Splitter> */}
      {/* </SplitPane> */}
      {/* </div> */}
    
    </div>
  )
}

export function ViewerPanel({className, style}: {className?: string, style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');

  const state = model.state;

  return (
    <div className={className}
          style={{display: 'flex', flexDirection: 'column', 
              flex: 1, 
              position: 'relative',
              width: '100%',
              height: '100%',
              ...(style ?? {})
          }}>
      {state.output?.stlFileURL &&
        <StlViewer
            style={{
              flex: 1
              // width: '100%'
            }}
            // ref={stlModelRef}
            showAxes={true}
            orbitControls
            shadows
            modelProps={{
              color: '#f9d72c',

            }}
            url={state.output?.stlFileURL ?? ''}
            />
      }

    </div>
  )
}

function downloadOutput(state: State) {
  if (!state.output) return;

  const fileName = state.output!.isPreview ? 'preview.stl' : 'render.stl';
  const doDownload = () => {
    const a = document.createElement('a')
    a.href = state.output!.stlFileURL
    a.download = fileName;
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  };

  if (state.output.isPreview && state.params.source.indexOf('$preview') >= 0) {
    confirmDialog({
        message: "This model references the $preview variable but hasn't been rendered (F6), or its rendering is stale. You're about to download the preview result itself, which may not have the intended refinement of the render. Sure you want to proceed?",
        header: 'Preview vs. Render',
        icon: 'pi pi-exclamation-triangle',
        accept: () => doDownload, 
        acceptLabel: `Download ${fileName}`,
        rejectLabel: 'Cancel'
        // reject: () => {}
    });
  } else {
    doDownload();
  }

}


function Footer({style}: {style?: CSSProperties}) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  
  const menu = useRef<Menu>(null);

  const state = model.state;
  
  const severityByMarkerSeverity = new Map<monaco.MarkerSeverity, 'danger' | 'warning' | 'info'>([
    [monaco.MarkerSeverity.Error, 'danger'],
    [monaco.MarkerSeverity.Warning, 'warning'],
    [monaco.MarkerSeverity.Info, 'info'],
  ]);
  const markers = state.lastCheckerRun?.markers ?? [];
  const getBadge = (s: monaco.MarkerSeverity) => {
    const count = markers.filter(m => m.severity == s).length;
    const sev = s == monaco.MarkerSeverity.Error ? 'danger'
      : s == monaco.MarkerSeverity.Warning ? 'warning'
      : s == monaco.MarkerSeverity.Info ? 'info'
      : 'success';
    return <>{count > 0 && <Badge value={count} severity={severityByMarkerSeverity.get(s)}></Badge>}</>;
  };


  const maxMarkerSeverity = markers.length == 0 ? undefined : markers.map(m => m.severity).reduce((a, b) => Math.max(a, b));
  
  return <>
    <ProgressBar mode="indeterminate"
                style={{
                  marginLeft: '5px',
                  marginRight: '5px',
                    visibility: state.rendering || state.previewing || state.checkingSyntax
                      ? 'visible' : 'hidden',
                    height: '6px' }}></ProgressBar>
      
    <div className="flex flex-row gap-1" style={{
        // display: 'flex',
        // flexDirection: 'row',
        // gap: '10px',
        // verticalAlign: 'center',
        alignItems: 'center',
        margin: '5px',
        ...(style ?? {})
    }}>
      <Button onClick={() => model.render({isPreview: false, now: true})}
        loading={state.rendering}
        icon="pi pi-refresh"
        label="Render" />
      
      {/* {state.error != null &&
        <i className="pi pi-exclamation-circle" style={{color: 'red'}} title={state.error}></i>} */}

      <Button type="button"
          // label={state.view.logs ? "Hide logs" : "Show logs"}
          label="Logs"
          icon="pi pi-align-left"
          text={!state.view.logs}
          onClick={() => model.logsVisible = !state.view.logs}
          // onLabel="Logs" offLabel="Logs" 
          // onIcon="pi pi-align-left"
          // offIcon="pi pi-align-left"
          className={maxMarkerSeverity && `p-button-${severityByMarkerSeverity.get(maxMarkerSeverity) ?? 'success'}`}
          >
        {getBadge(monaco.MarkerSeverity.Error)}
        {getBadge(monaco.MarkerSeverity.Warning)}
        {getBadge(monaco.MarkerSeverity.Info)}
      </Button>

      {/* {state.output &&
        <span style={{color: 'blue'}}>
          <i className="pi pi-stopwatch" title={state.error}></i>
          <span style={{margin: '5px'}}>{state.output.formattedElapsedMillis}</span>
        </span>} */}
        
      {/* {state.previewing && 'previewing... '}
      {state.rendering && 'rendering... '}
      {state.checkingSyntax && 'checking syntax... '} */}

      {/* <span style={{flex: 1}}></span> */}
      
      <span style={{flex: 1}}></span>

      <ConfirmDialog />

      {state.output && (
        <Button icon='pi pi-download'
          title={`Download ${state.output.isPreview ? "preview.stl" : "render.stl"} (${state.output.formattedStlFileSize})`}
          severity="secondary"
          text
          // label={state.output.isPreview ? "preview.stl" : "render.stl"}
          iconPos='right'
          onClick={() => downloadOutput(state)} />
        // <a href={state.output.stlFileURL}
        // target="_blank" 
        // download={state.output.isPreview ? "preview.stl" : "render.stl"}
        // title="STL Download">
        //     {state.output.isPreview ? "preview.stl" : "render.stl"} ({state.output.formattedStlFileSize})
        // </a>
      )}

      <ToggleButton
                  style={{
                    // flex: 1,
                  }}
                  onIcon='pi pi-table'
                  offIcon='pi pi-table'
                  onLabel=''
                  offLabel=''
                  // onLabel='Multi'
                  // offLabel='Single'
                  title='Change between single and multiple layout'
                  checked={state.view.layout.mode === 'multi'}
                  onChange={e => model.changeLayout(e.value ? 'multi' : 'single')} />
      
      <Menu model={[
        {
          label: "openscad-playground",
          icon: 'pi pi-github',
          command: () => window.open('https://github.com/openscad/openscad-playground/tree/rewrite1', '_blank'),
        },
        {
          label: 'LICENSES',
          icon: 'pi pi-info-circle',
          command: () => window.open('https://github.com/openscad/openscad-playground/blob/rewrite1/LICENSE.md', '_blank'),
        },
        {
          label: 'OpenSCAD Docs',
          icon: 'pi pi-book',
          command: () => window.open('http://openscad.org/documentation.html', '_blank'),
        },
        {
          label: 'OpenSCAD Cheatsheet',
          icon: 'pi pi-palette',
          command: () => window.open('http://openscad.org/cheatsheet/', '_blank'),
        },
        {
          label: 'BOSL2 Cheatsheet',
          icon: 'pi pi-palette',
          command: () => window.open('https://github.com/revarbat/BOSL2/wiki/CheatSheet', '_blank'),
        },
      ] as MenuItem[]} popup ref={menu} />
      <Button title="Help & Licenses" rounded icon="pi pi-question-circle" onClick={(e) => menu.current && menu.current.toggle(e)} />

    </div>
  </>
}

export function App({initialState, fs}: {initialState: State, fs: FS}) {
  const [state, setState] = useState(initialState);
  
  const model = new Model(fs, state, setState);
  useEffect(() => model.init());

  // const breadCrumbsItems: MenuItem[] = [
  //   {
  //     label: 'input.scad',
  //     command: () => alert('ok')

  const singleTargets: {id: SingleLayoutComponentId, icon: string, label: string}[] = [
    { id: 'editor', icon: 'pi pi-pencil', label: 'Edit' },
    { id: 'viewer', icon: 'pi pi-box', label: 'View' },
    { id: 'customizer', icon: 'pi pi-cog', label: 'Customize' },
  ];
  const multiTargets = singleTargets;
  // const multiTargets: {id: MultiLayoutComponentId, icon: string, label: string}[] = [
  //   { id: 'editor', icon: 'pi pi-pencil', label: 'Editor' },
  //   { id: 'viewer', icon: 'pi pi-box', label: 'Viewer' },
  //   { id: 'customizer', icon: 'pi pi-cog', label: 'Customizer' },
  // ];
  const zIndexOfPanelsDependingOnFocus = {
    editor: {
      editor: 3,
      viewer: 1,
      customizer: 0,
    },
    viewer: {
      editor: 2,
      viewer: 3,
      customizer: 2,
    },
    customizer: {
      editor: 0,
      viewer: 0,
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

  const isIPhone = /iPhone/.test(navigator.userAgent)
  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        <div className='flex flex-column' style={{
            // height: '100vh'
            // maxHeight: '-webkit-fill-available',
            height: isIPhone ? "calc(100vh - 80px - env(safe-area-inset-bottom) - env(safe-area-inset-top))" : '100vh'
          }}>
          {isIPhone && <Footer />}
          <div className="">
            <div className='flex flex-row' style={{
              margin: '5px',
            }}>

              {state.view.layout.mode === 'multi'
                ?   <div className='flex flex-row gap-1' style={{
                  justifyContent: 'center',
                  flex: 1,
                  margin: '5px'
                }}>
                      {multiTargets.map(({icon, label, id}) => 
                        // <Button
                        <ToggleButton
                          key={id}
                          // raised={(state.view.layout as any)[id]}
                          checked={(state.view.layout as any)[id]}
                          // label={label}
                          onLabel={label}
                          offLabel={label}
                          onIcon={icon}
                          offIcon={icon}
                          // icon={icon}
                          disabled={id === 'customizer'}
                          // onClick={() => model.changeMultiVisibility(id, !(state.view.layout as any)[id])}
                          onChange={e => model.changeMultiVisibility(id, e.value)}
                          />
                        )}
                    </div>
                :   <TabMenu
                        activeIndex={singleTargets.map(t => t.id).indexOf(state.view.layout.focus)}
                        style={{
                          flex: 1,
                          // justifyContent: 'center'
                        }}
                        model={singleTargets.map(({icon, label, id}) => 
                            ({icon, label, disabled: id === 'customizer', command: () => model.changeSingleVisibility(id)}))} />
              }
            </div>
          </div>
    
          <div className={mode === 'multi' ? 'flex flex-row' : 'flex flex-column'}
              style={mode === 'multi' ? {flex: 1} : {
                flex: 1,
                position: 'relative'
              }}>
                {/* {position: 'relative'}}> */}

            <EditorPanel className={`
              opacity-animated
              ${layout.mode === 'single' && layout.focus !== 'editor' ? 'opacity-0' : ''}
              ${layout.mode === 'single' ? 'absolute-fill' : ''}
            `} style={getPanelStyle('editor')} />
            <ViewerPanel className={layout.mode === 'single' ? `absolute-fill` : ''} style={getPanelStyle('viewer')} />
            {/* <CustomizerPanel className={`${getPanelClasses('customizer')} absolute-fill`} style={getPanelStyle('customizer')} /> */}
          </div>

          {!isIPhone && <Footer />}
        </div>
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}

        // <Splitter style={{ flex: 1 }}>
        //     <SplitterPanel className="flex flex-column align-items-center justify-content-center">
        //       <EditorPanel />
        //     </SplitterPanel>
        //     <SplitterPanel className="flex flex-column align-items-center justify-content-center">
        //       <ViewerPanel/>
        //     </SplitterPanel>
        // </Splitter>
        // <Footer />