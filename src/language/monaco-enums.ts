// The few Monaco enums the app uses, as plain constants.
//
// `import * as monaco from 'monaco-editor/...'` used as a value pulls the whole editor
// (~3 MB of JS, 730 KB compressed) into our bundle, although the editor itself is
// loaded at runtime by @monaco-editor/loader. Everything else from monaco is imported
// with `import type`. The values must be those of Monaco's enums:
// tests/monaco-enums.test.js compares them with monaco-editor's typings, and the
// `satisfies` below checks the member names at compile time.

import type * as monaco from 'monaco-editor/editor/editor.api';

type Members<E> = {[K in keyof E]?: number};

export const MarkerSeverity = {
  Hint: 1,
  Info: 2,
  Warning: 4,
  Error: 8,
} as const satisfies Members<typeof monaco.MarkerSeverity>;

export const CompletionItemKind = {
  Function: 1,
  Variable: 4,
  Keyword: 17,
  File: 20,
  Folder: 23,
  Value: 13,
} as const satisfies Members<typeof monaco.languages.CompletionItemKind>;

export const CompletionItemInsertTextRule = {
  None: 0,
  KeepWhitespace: 1,
  InsertAsSnippet: 4,
} as const satisfies Members<typeof monaco.languages.CompletionItemInsertTextRule>;

export const IndentAction = {
  None: 0,
  Indent: 1,
  IndentOutdent: 2,
  Outdent: 3,
} as const satisfies Members<typeof monaco.languages.IndentAction>;

export const KeyMod = {
  CtrlCmd: 2048,
  Shift: 1024,
} as const satisfies Members<typeof monaco.KeyMod>;

export const KeyCode = {
  KeyS: 49,
} as const satisfies Members<typeof monaco.KeyCode>;
