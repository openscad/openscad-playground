// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import loader from '@monaco-editor/loader';
import { ZipArchives } from '../zip-archives';
import { buildOpenSCADCompletionItemProvider } from './openscad-completions';
import openscadLanguage from './openscad-language';
// import jsLanguage from 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'

// https://microsoft.github.io/monaco-editor/playground.html#extending-language-services-custom-languages
export async function registerOpenSCADLanguage(fs: any, workingDir: string, zipArchives: ZipArchives) {
  const monaco = await loader.init();
  
  monaco.languages.register({
    id: 'openscad',
    extensions: ['.scad'],
    mimetypes: ["text/openscad"],
  });

  //const [inheritLanguage] = monaco.languages.getLanguages().filter(l => l.id === 'javascript');
  const { conf, language } = openscadLanguage;
  monaco.languages.setLanguageConfiguration('openscad', conf);
  monaco.languages.setMonarchTokensProvider('openscad', language);

  monaco.languages.registerCompletionItemProvider('openscad',
      await buildOpenSCADCompletionItemProvider(fs, workingDir, zipArchives));
}
