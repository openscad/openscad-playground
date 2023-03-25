// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { forwardRef, useContext, useEffect, useRef, useState } from 'react';
import {ModelContext, State} from './app-state'
import Editor, { loader, Monaco } from '@monaco-editor/react';
// import './App.css';
import openscadEditorOptions from './language/openscad-editor-options';
import { Model } from './model';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {StlViewer} from "react-stl-viewer";
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';

// import "primereact/resources/themes/lara-light-indigo/theme.css";
// import "primereact/resources/primereact.min.css";
// import "primeicons/primeicons.css"; 

let monacoInstance: Monaco
loader.init().then(mi => monacoInstance = mi);

function EditorPanel() {
  const model = useContext(ModelContext);
  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)

  if (editor) {
    const checkerRun = model.state.lastCheckerRun;
    const editorModel = editor.getModel();
    if (editorModel && checkerRun) {
      monacoInstance.editor.setModelMarkers(editorModel, 'openscad', checkerRun.markers);
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

  return (
    <div className="editor-panel" style={{
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      <Editor
        className="openscad-editor"
        defaultLanguage="openscad"
        value={model.state.params.source}
        onChange={s => model.source = s ?? ''}
        onMount={onMount} // TODO: This looks a bit silly, does it trigger a re-render??
        options={openscadEditorOptions}
        height="50vh"/>
    
      <div className="logs-container">
        <pre><code id="logs">{model.state.lastCheckerRun?.logText ?? 'No log yet!'}</code></pre>
      </div>
    </div>
  )
}


export function App({initialState}: {initialState: State}) {
  const [state, setState] = useState(initialState);
  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)
  
  if (editor) {
    const editorModel = editor.getModel();
    if (editorModel && state.lastCheckerRun) {
      monacoInstance.editor.setModelMarkers(editorModel, 'openscad', state.lastCheckerRun.markers);
    }
  }

  const model = new Model(state, setState);
  useEffect(() => model.init());

  // const stlModelRef = forwardRef();
  
  return (
    <ModelContext.Provider value={model}>
      <div style={{display: 'flex', flexDirection: 'column', flex: 1}}>
        <div style={{display: 'flex', flexDirection: 'row', flex: 1}}>
          <div style={{width: "50vw"}}>
            <EditorPanel/>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', flex: 1, position: 'relative'}}>
            {(state.rendering || state.previewing) &&
              <ProgressBar mode="indeterminate" style={{ height: '6px' }}></ProgressBar>}
            {state.output?.stlFileURL &&
              <StlViewer
                  style={{
                    flex: 1
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
        </div>
        <div style={{display: 'flex', flexDirection: 'row', gap: '10px'}}>
            <Button onClick={() => model.render({isPreview: false, now: true})}>Render</Button>
            {state.output && state.output.formattedElapsedMillis}
            &nbsp;
            {state.previewing && 'previewing... '}
            {state.rendering && 'rendering... '}
            {state.checkingSyntax && 'checking syntax... '}

            {state.output && (
              <a href={state.output.stlFileURL}
              target="_blank" 
              download={state.output.isPreview ? "preview.stl" : "render.stl"}
              title="STL Download">
                  {state.output.isPreview ? "preview.stl" : "render.stl"} ({state.output.formattedStlFileSize})
              </a>
            )}

            <span style={{flex: 1}}></span>
            
            <a target="_blank" className="text-fragment" href="http://openscad.org/documentation.html">Docs</a> |
            <a target="_blank" className="text-fragment" href="http://openscad.org/cheatsheet/">Cheatsheet</a> |
            <a target="_blank" href="https://github.com/openscad/openscad-playground/blob/rewrite1/LICENSE.md">LICENSES</a>
        </div>
      </div>
    </ModelContext.Provider>
  );
}
