// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useState } from 'react';
import {ModelContext, State} from './app-state'
import Editor, { loader, Monaco } from '@monaco-editor/react';
import './App.css';
import openscadEditorOptions from './language/openscad-editor-options';
import { Model } from './model';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

let monacoInstance: Monaco
loader.init().then(mi => monacoInstance = mi);

export function App({initialState}: {initialState: State}) {
  const [state, setState] = useState(initialState);
  const [editor, setEditor] = useState(null as monaco.editor.IStandaloneCodeEditor | null)
  const model = new Model(state, setState);

  if (editor) {
    const editorModel = editor.getModel();
    if (editorModel && state.checkerRun) {
      monacoInstance.editor.setModelMarkers(editorModel, 'openscad', state.checkerRun.markers);
    }
  }
  
  const source = model.source;
  
  return (
    <ModelContext.Provider value={model}>
      <div className="App">
        <header className="App-header">
          <img src="logo.png" className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.tsx</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://openscad.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn OpenSCAD
          </a>
          <Editor
              className="openscad-editor"
              defaultLanguage="openscad"
              value={source}
              onChange={s => model.source = s ?? ''}
              onMount={e => setEditor(e)} // TODO: This looks a bit silly, does it trigger a re-render??
              options={openscadEditorOptions}
              height="50vh"/>
          </header>
      </div>
    </ModelContext.Provider>
  );
}
