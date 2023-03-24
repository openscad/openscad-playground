// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.
export type ParsedFunctionoidDef = {
  path: string,
  name: string,
  params?: {
    name: string,
    defaultValue: string,
  }[],
  signature: string,
  referencesChildren: boolean | null,
};
export type ParsedFunctionoidDefs = {[name: string]: ParsedFunctionoidDef};

export type ParsedFile = {
  functions: ParsedFunctionoidDefs,
  modules: ParsedFunctionoidDefs,
  vars: string[],
  includes: string[],
  uses: string[],
};

export const stripComments = (src: string) => src.replaceAll(/\/\*(.|[\s\S])*?\*\/|\/\/.*?$/gm, '');

export function parseOpenSCAD(path: string, src: string, skipPrivates: boolean): ParsedFile {
  const withoutComments = stripComments(src);
  const vars = [];
  const functions: ParsedFunctionoidDefs = {};
  const modules: ParsedFunctionoidDefs = {};
  const includes: string[] = [];
  const uses: string[] = [];
  for (const m of withoutComments.matchAll(/(use|include)\s*<([^>]+)>/g)) {
    (m[1] == 'use' ? uses : includes).push(m[2]);
  }
  for (const m of withoutComments.matchAll(/(?:^|[{};])\s*([$\w]+)\s*=/g)) {
    vars.push(m[1]);
  }
  for (const m of withoutComments.matchAll(/(function|module)\s+([$\w]+)\s*\(([^)]*)\)(?:\s*(?:=\s*)?(\{\}|[^{}]+?;))?/gm)) {
    const type = m[1];
    const name = m[2];
    if (skipPrivates && name.startsWith('_')) {
      continue;
    }
    const paramsStr = m[3];
    const optBody = m[4];
    const params = [];
    if (/^(\s*([$\w]+(\s*=[^,()[]+)?(\s*,\s*[$\w]+(\s*=[^,()[]+)?)*)?\s*)$/m.test(paramsStr)) {
      for (const paramStr of paramsStr.split(',')) {
        const am = /^\s*([$\w]+)(?:\s*=([^,()[]+))?\s*$/.exec(paramStr);
        if (am) {
          const paramName = am[1];
          const defaultValue = am[2];
          params.push({
            name: paramName,
            defaultValue
          });
        }
      }
    }
    (type == 'function' ? functions : modules)[name] = {
      path,
      name,
      signature: `${name}(${paramsStr.replaceAll(/[\s]+/gm, ' ').replaceAll(/\b | \b/g, '')})`,
      params,
      referencesChildren: optBody != null ? (optBody.indexOf('children()') >= 0) : null,
    };
  }
  return {vars, functions, modules, includes, uses};
}
