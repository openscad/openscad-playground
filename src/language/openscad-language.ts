// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

const builtInFunctionNames = [
  'abs',
    'acos', 'asin', 'atan', 'atan2', 'ceil',
    'len', 'let', 'ln', 'log',
    'lookup', 'max', 'min', 'sqrt', 'tan', 'rands',
    'search', 'sign', 'sin', 'str', 'norm', 'pow', 
    'concat', 'cos', 'cross', 'floor', 'exp', 
    'chr',
];
const builtInModuleNames = [
  'children',
  'circle', 'color', 'cube', 'cylinder',
  'diameter', 'difference', 'echo', 'extrude', 
  'for', 'function', 'hull', 'if', 'include',
  'intersection_for', 'intersection',  'linear',  'minkowski', 'mirror', 'module', 'multmatrix',
  'offset', 'polyhedron', 'projection', 'radius', 
  'render', 'resize', 'rotate', 'round', 'scale', 
  'sphere', 'square', 'surface', 'translate', 
  'union', 'use', 'value', 'version', 
  // 'center', 'width', 'height', 
];
const builtInVarNames = [
  'false', 'true', 'PI', 'undef', '$children',
  '$fa', '$fn', '$fs', '$t', '$vpd', '$vpr', '$vpt',
]

var conf: monaco.languages.LanguageConfiguration = {

  colorizedBracketPairs: [['{', '}'], ['(', ')'], ['[', ']']], 
  
  wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"]
  },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"]
  ],
  onEnterRules: [
    {
      beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
      afterText: /^\s*\*\/$/,
      action: {
        indentAction: monaco.languages.IndentAction.IndentOutdent,
        appendText: " * "
      }
    },
    {
      beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
      action: {
        indentAction: monaco.languages.IndentAction.None,
        appendText: " * "
      }
    },
    {
      beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
      action: {
        indentAction: monaco.languages.IndentAction.None,
        appendText: "* "
      }
    },
    {
      beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
      action: {
        indentAction: monaco.languages.IndentAction.None,
        removeText: 1
      }
    }
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["string"] },
    { open: "'", close: "'", notIn: ["string", "comment"] },
    { open: "`", close: "`", notIn: ["string", "comment"] },
    { open: "/**", close: " */", notIn: ["string"] }
  ],
  folding: {
    markers: {
      start: new RegExp("^\\s*//\\s*#?region\\b"),
      end: new RegExp("^\\s*//\\s*#?endregion\\b")
    }
  }
};

var language: monaco.languages.IMonarchLanguage = {
  defaultToken: "invalid",
  tokenPostfix: ".js",
  keywords: [...builtInFunctionNames, ...builtInModuleNames, ...builtInVarNames, 'each'],
  typeKeywords: [],
  operators: [
    "<=",
    ">=",
    "==",
    "!=",
    "=>",
    "+",
    "-",
    "*",
    "/",
    "%",
    "<<",
    ">>",
    ">>>",
    "&",
    "|",
    "^",
    "!",
    "&&",
    "||",
    "?",
    ":",
    "=",
  ],
  symbols: /[=><!~?:&|+\-*\/\^%]+/,
  escapes: /\\[abfnrtv\\"']/,
  digits: /\d+/,
  tokenizer: {
    root: [[/[{}]/, "delimiter.bracket"], { include: "common" }],
    common: [
      [
        /[a-z_$][\w$]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@default": "identifier"
          }
        }
      ],
      [/[A-Z][\w\$]*/, "type.identifier"],
      { include: "@whitespace" },
      [/[()\[\]]/, "@brackets"],
      [/[<>](?!@symbols)/, "@brackets"],
      [/!(?=([^=]|$))/, "delimiter"],
      [
        /@symbols/,
        {
          cases: {
            "@operators": "delimiter",
            "@default": ""
          }
        }
      ],
      [/(@digits)[eE]([\-+]?(@digits))?/, "number.float"],
      [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, "number.float"],
      [/(@digits)n?/, "number"],
      [/[;,.]/, "delimiter"],
      [/"([^"\\]|\\.)*$/, "string.invalid"],
      [/'([^'\\]|\\.)*$/, "string.invalid"],
      [/"/, "string", "@string_double"],
    ],
    whitespace: [
      [/[ \t\r\n]+/, ""],
      [/\/\*/, "comment", "@comment"],
      [/\/\/.*$/, "comment"]
    ],
    comment: [
      [/[^\/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[\/*]/, "comment"]
    ],
    string_double: [
      [/[^\\"]+/, "string"],
      [/@escapes/, "string.escape"],
      [/\\./, "string.escape.invalid"],
      [/"/, "string", "@pop"]
    ],
    bracketCounting: [
      [/\{/, "delimiter.bracket", "@bracketCounting"],
      [/\}/, "delimiter.bracket", "@pop"],
      { include: "common" }
    ]
  }
};

export default {
  conf,
  language,
}
