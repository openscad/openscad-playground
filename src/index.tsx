import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {App} from './App';
import reportWebVitals from './reportWebVitals';
import { createEditorFS } from './filesystem';
import { registerOpenSCADLanguage } from './language/openscad-register-language';
import { zipArchives } from './zip-archives';
import {readStateFromFragment} from './state'
import { State } from './app-state';

(async () => {
  
  const workingDir = '/home';
  const fs = await createEditorFS(workingDir);
  await registerOpenSCADLanguage(fs, workingDir, zipArchives);

  const initialState = readStateFromFragment() ?? {
    source: {
      content: 'cube(1);\ntranslate([0.5, 0.5, 0.5])\n\tcube(1);',
    }
  } as State;

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App initialState={initialState} />
    </React.StrictMode>
  );
  
  // If you want to start measuring performance in your app, pass a function
  // to log results (for example: reportWebVitals(console.log))
  // or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
  reportWebVitals();
})();


