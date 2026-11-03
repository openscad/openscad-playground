// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import type * as monaco from 'monaco-editor/editor/editor.api';

export default {
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  fontSize: 12,
  language: 'openscad',
  tabSize: 2,
  wordWrap: 'on',
  wrappingStrategy: 'advanced',
  suggest: {
    localityBonus: true,
    showStatusBar: true,
    preview: true,
  },
  codeLens: true,
  wordBasedSuggestions: "off",
} as monaco.editor.IStandaloneEditorConstructionOptions;
