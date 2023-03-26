// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { readDirAsArray, Symlinks } from '../fs/filesystem';
import { ParsedFile, ParsedFunctionoidDef, parseOpenSCAD, stripComments } from './openscad-pseudoparser';
import builtinSignatures from './openscad-builtins'
import { mapObject } from '../utils';
import { ZipArchives } from '../fs/zip-archives';
import openscadLanguage from './openscad-language';

function makeFunctionoidSuggestion(name: string, mod: ParsedFunctionoidDef) {
  const argSnippets: string[] = [];
  const namedArgs: string[] = [];
  let collectingPosArgs = true;
  let i = 0;
  for (const param of mod.params ?? []) {
    if (collectingPosArgs) {
      if (param.defaultValue != null) {
        collectingPosArgs = false;
      } else {
        //argSnippets.push(`${param.name}=${'${' + (i + 1) + ':' + param.name + '}'}`);
        argSnippets.push(`${param.name.replaceAll('$', '\\$')}=${'${' + (++i) + ':' + param.name + '}'}`);
        continue;
      }
    }
    namedArgs.push(param.name);
  }
  if (namedArgs.length) {
    argSnippets.push(`${'${' + (++i) + ':' + namedArgs.join('|') + '=}'}`);
  }
  let insertText = `${name.replaceAll('$', '\\$')}(${argSnippets.join(', ')})`;
  if (mod.referencesChildren !== null) {
    insertText += mod.referencesChildren ? ' ${' + (++i) + ':children}' : ';';
  }
  return {
    label: mod.signature,//`${name}(${(mod.params ?? []).join(', ')})`,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  };
}

const builtinCompletions = [
  ...[true, false].map(v => ({
    label: `${v}`,
    kind: monaco.languages.CompletionItemKind.Value,
    insertText: `${v}`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  })),
  ...openscadLanguage.language.keywords.map((v: string) => ({
    label: v,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: v,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
  }))
];

const keywordSnippets = [
  'for(${1:variable}=[${2:start}:${3:end}) ${4:body}',
  'for(${1:variable}=[${2:start}:${3:increment}:${4:end}) ${5:body}',
  'if (${1:condition}) {\n\t$0\n} else {\n\t\n}'
];

function cleanupVariables(snippet: string) {
  return snippet
    .replaceAll(/\$\{\d+:([$\w]+)\}/g, '$1')
    .replaceAll(/\$\d+/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

// https://microsoft.github.io/monaco-editor/playground.html#extending-language-services-custom-languages
export async function buildOpenSCADCompletionItemProvider(fs: FS, workingDir: string, zipArchives: ZipArchives) {

  const parsedFiles: {[path: string]: Promise<ParsedFile>} = {};
  const toAbsolutePath = (path: string) => path.startsWith('/') ? path : `${workingDir}/${path}`;
  
  const allSymlinks: Symlinks = {};
  for (const n of Object.keys(zipArchives)) {
    if (n == 'fonts') {
      continue;
    }
    const { symlinks } = zipArchives[n];
    for (const s in symlinks) {
      allSymlinks[s] = `${n}/${symlinks[s]}`;
    }
  }
  async function readFile(path: string) {
    if (path in allSymlinks) {
      path = allSymlinks[path];
    }
    path = toAbsolutePath(path);
    try {
      const bytes = await fs.readFileSync(path);
      const src = new TextDecoder("utf-8").decode(bytes as any);
      return src;
    } catch (e) {
      throw e;
    }
  }
  const builtinsPath = '<builtins>';
  let builtinsDefs: ParsedFile;

  function getParsed(path: string, src: string, {skipPrivates, addBuiltins}: {skipPrivates: boolean, addBuiltins: boolean}) {
    return parsedFiles[path] ??= new Promise(async (res, rej) => {
      if (src == null) {
        src = await readFile(path);
      }
      const result: ParsedFile = {
        functions: {},
        modules: {},
        vars: [],
        includes: [],
        uses: [],
      }

      const mergeDefinitions = (isUse: boolean, defs: ParsedFile) => {
        result.functions = {...result.functions, ...defs.functions }
        result.modules = {...result.modules, ...defs.modules }
        if (!isUse) {
          result.vars = [...result.vars, ...defs.vars]
        }
      };
      const dir = (path.split('/').slice(0, -1).join('/') || '.') + '/';

      const handleInclude = async (isUse: boolean, otherPath: string) => {
        for (const path of [`${dir}/${otherPath}`, otherPath]) {
          try {
            const otherSrc = await readFile(otherPath);
            const sub = await getParsed(otherPath, otherSrc, {skipPrivates: true, addBuiltins: false});
            mergeDefinitions(isUse, sub);
          } catch (e) {
            // console.warn(path, e);
          }
        }
        console.error('Failed to find ', otherPath, '(context imported in ', path, ')');
      };

      if (addBuiltins && path != builtinsPath) {
        mergeDefinitions(false, builtinsDefs);
      }

      const ownDefs = parseOpenSCAD(path, src, skipPrivates);
      
      await Promise.all(
        [
          ...(ownDefs.uses ?? []).map(p => [p, true] as [string, boolean]),
          ...(ownDefs.includes ?? []).map(p => [p, false] as [string, boolean])
        ].map(([otherPath, isUse]) => handleInclude(isUse, otherPath)));

      mergeDefinitions(false, ownDefs);

      res(result);
    });
  }

  builtinsDefs = await getParsed(builtinsPath, builtinSignatures, {skipPrivates: false, addBuiltins: false});

  return {
    triggerCharacters: ["<", "/"], //, "\n"],
    //provideCompletionItems: (async (model, position, context, token) => {
    provideCompletionItems: ((async (model: monaco.editor.ITextModel, position: monaco.Position, context: monaco.languages.CompletionContext, token: monaco.CancellationToken) => {
      try {
        const {word} = model.getWordUntilPosition(position);
        const offset = model.getOffsetAt(position);
        const text = model.getValue();
        let previous = text.substring(0, offset);
        let i = previous.lastIndexOf('\n');
        previous = previous.substring(i + 1);

        const includeMatch = /\b(include|use)\s*<([^<>\n"]*)$/.exec(previous);
        if (includeMatch) {
          const prefix = includeMatch[2];
          let folder, filePrefix, folderPrefix;
          const i = prefix.lastIndexOf('/');
          if (i < 0) {
            folderPrefix = '';
            filePrefix = prefix;
          } else {
            folderPrefix = prefix.substring(0, i);
            filePrefix = prefix.substring(i + 1);
          }
          folder = workingDir + (folderPrefix == '' ? '' : '/' + folderPrefix);
          let files = folderPrefix == '' ? [...Object.keys(allSymlinks)] : [];
          try {
            files = [...(await readDirAsArray(fs, folder) ?? []), ...files];
            // console.log('readDir', folder, files);
          } catch (e) {
            console.error(e);
          }

          const suggestions = [];
          for (const file of files) {
            if (filePrefix != '' && !file.startsWith(filePrefix)) {
              continue;
            }
            if (/^(LICENSE.*|fonts)$/.test(file)) {
              continue;
            }
            if (folderPrefix == '' && (file in zipArchives) && zipArchives[file].symlinks) {
              continue;
            }
            const isFolder = !file.endsWith('.scad');
            const completion = file + (isFolder ? '' : '>\n'); // don't append '/' as it's a useful trigger char

            console.log(JSON.stringify({
              prefix,
              folder,
              filePrefix,
              folderPrefix,
              // files,
              completion,
              file,
            }, null, 2));

            suggestions.push({
              label: file,
              kind: isFolder ? monaco.languages.CompletionItemKind.Folder : monaco.languages.CompletionItemKind.File,
              insertText: completion
            });
          }
          suggestions.sort();

          return { suggestions };
        }

        const inputFile = workingDir + "/foo.scad";
        delete parsedFiles[inputFile];
        const parsed = await getParsed(inputFile, text, {skipPrivates: false, addBuiltins: true});
        // console.log("PARSED", JSON.stringify(parsed, null, 2));
        
        type CompletionItem = monaco.languages.CompletionItem & {
          range?: monaco.IRange
        }
        
        const previousWithoutComments = stripComments(previous);
        // console.log('previousWithoutComments', previousWithoutComments);
        const statementMatch = /(^|.*?[{});]|>\s*\n)\s*([$\w]*)$/m.exec(previousWithoutComments);
        if (statementMatch) {
          const start = statementMatch[1];
          const suggestions: CompletionItem[] = [
            ...builtinCompletions,
            ...mapObject(
              parsed.modules ?? {},
              (name, mod) => makeFunctionoidSuggestion(name, mod),
              name => name.indexOf(word) >= 0),
            ...((parsed.vars ?? []).filter(name => name.indexOf(word) >= 0).map(name => ({
              label: name,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: name.replaceAll('$', '\\$'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }))),
            ...keywordSnippets.map(snippet => ({
              label: cleanupVariables(snippet).replaceAll(/ body/g, ''),
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: snippet,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            })),
            // ...getStatementSuggestions().filter(s => start == '' || s.insertText.indexOf(start) >= 0)
          ];
          suggestions.sort((a, b) => a.insertText.indexOf(start) - b.insertText.indexOf(start));
          return { suggestions };
        }

        const allWithoutComments = stripComments(text);
        
        const named: [string, CompletionItem][] = [
          ...mapObject(parsed.functions ?? {},
            (name, mod) => [name, makeFunctionoidSuggestion(name, mod)],
            name => name.indexOf(word) >= 0)
        ];
        named.sort(([a], [b]) => a.indexOf(word) - b.indexOf(word));
        // const suggestions = names.map(name => ({
        //   label: name,
        //   kind: monaco.languages.CompletionItemKind.Constant,
        //   insertText: name
        // }));

        const suggestions = named.map(([n, s]) => s as any as monaco.languages.CompletionItem);
        return { suggestions };
        
      } catch (e) {
        console.error(e);//, (e as any).stackTrace);
        return { suggestions: [] };
      }
    }) as any),
  } as monaco.languages.CompletionItemProvider;
}
