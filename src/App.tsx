// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import SCADEditor from './Editor';
import './App.css';

export function App() {
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
        <SCADEditor height="50vh" value="if (true) sphere(10); else cube();"/>

      </header>
    </div>
  );
}
