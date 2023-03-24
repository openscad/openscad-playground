// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
const options: monaco.editor.IStandaloneEditorConstructionOptions = {
  lineNumbers: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 12,
  language: 'openscad',
  wordWrap: 'on',
  wrappingStrategy: 'advanced',
  suggest: {
    // snippetsPreventQuickSuggestions: false,
    showStatusBar: true,
    preview: true,
  },
  codeLens: true,
function SCADEditor({value, ...props}: {value: string, height: string}) {

  // let editor: monaco.editor.IStandaloneCodeEditor;
  
  // function editorDidMount(e) {
  //   editor = e;
  //   console.log('editorDidMount', monaco.languages.getLanguages(), editor);
    <Editor {...props} className="openscad-editor" defaultLanguage="openscad" value={value} options={options} />
    // onMount={editorDidMount} />
  );
}

// export function createEditor() {
//   monaco.editor.create(document.getElementById('openscad-editor') as any, options);
// }

export default SCADEditor;
