// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export default {
  lineNumbers: 'on',
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 12,
  language: 'openscad',
  tabSize: 2,
  wordWrap: 'on',
  wrappingStrategy: 'advanced',
  suggest: {
    // snippetsPreventQuickSuggestions: false,
    localityBonus: true,
    showStatusBar: true,
    preview: true,
  },
  codeLens: true,
  // language: 'javascript',
  wordBasedSuggestions: false,
} as monaco.editor.IStandaloneEditorConstructionOptions;

// monaco.editor.IModelContentChangedEvent

// function SCADEditor({input, onInputChanged, ...props}: {input: string, onInputChanged: (value?: string) => void, height: string}) {

//   // let editor: monaco.editor.IStandaloneCodeEditor;
  
//   // function editorDidMount(e) {
//   //   editor = e;
//   //   console.log('editorDidMount', monaco.languages.getLanguages(), editor);
//   //   // editor.
//   //   editor.setModel(monaco.editor.createModel('sphere(123);', 'openscad'));
//   //   // editor.trigger('anything', 'editor.action.triggerSuggest', {});    
//   // }

//   return (
//     <Editor {...props}
//       className="openscad-editor"
//       defaultLanguage="openscad"
//       value={n}
//       onChange={setValue}
//       options={options} />
//     // onMount={editorDidMount} />
//   );
// }
