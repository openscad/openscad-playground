// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useState } from 'react';
import {State} from './app-state'
import Editor from '@monaco-editor/react';
import './App.css';
import openscadEditorOptions from './language/openscad-editor-options';
import { writeStateInFragment } from './state';

export function App({initialState}: {initialState: State}) {
  const [state, rawSetState] = useState(initialState);

  const setState = (state: State) => {
    rawSetState(state);
    writeStateInFragment(state);
  };

  const value = state.source.content;
  const setValue = (content?: string) => setState({...state, source: {...state.source, content: content ?? ''}});

  return (
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
            value={value}
            onChange={setValue}
            options={openscadEditorOptions}
            height="50vh"/>
        </header>
    </div>
  );
}
