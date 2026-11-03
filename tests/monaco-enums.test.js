// src/language/monaco-enums.ts duplicates a few Monaco enums as plain constants (so that the
// production bundle doesn't contain the editor itself): check the values against the
// enums of the monaco-editor typings.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function loadOurEnums() {
  const file = path.join(__dirname, '..', 'src', 'language', 'monaco-enums.ts');
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const module = {exports: {}};
  new Function('module', 'exports', js)(module, module.exports);
  return module.exports;
}

/** name -> member -> value, for the (numeric) enums declared in the typings. */
function loadMonacoEnums() {
  const file = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'esm', 'vs', 'editor', 'editor.api.d.ts');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const enums = {};
  const visit = (node) => {
    if (ts.isEnumDeclaration(node)) {
      const members = (enums[node.name.text] ??= {});
      let next = 0;
      for (const m of node.members) {
        const name = m.name.getText(source);
        if (m.initializer) {
          next = Function(`return (${m.initializer.getText(source)})`)();
        }
        members[name] = next++;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  // KeyMod is a class in the typings; its values are in the implementation.
  const base = fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'esm', 'vs', 'editor', 'common', 'services', 'editorBaseApi.js'), 'utf8');
  enums.KeyMod = {};
  for (const [, name, value] of base.matchAll(/static \{ this\.(\w+) = (\d+) \/\* ConstKeyMod\./g)) {
    enums.KeyMod[name] = Number(value);
  }
  return enums;
}

test('monaco-enums.ts has the values of the Monaco enums', () => {
  const ours = loadOurEnums();
  const monaco = loadMonacoEnums();
  expect(Object.keys(ours).length).toBeGreaterThan(0);
  for (const [enumName, members] of Object.entries(ours)) {
    expect(monaco[enumName]).toBeDefined();
    for (const [member, value] of Object.entries(members)) {
      expect({enumName, member, value: monaco[enumName][member]}).toEqual({enumName, member, value});
    }
  }
});
