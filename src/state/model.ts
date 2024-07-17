// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, RenderArgs, RenderOutput } from "../runner/actions";
import { MultiLayoutComponentId, SingleLayoutComponentId, Source, State, StatePersister, VALID_EXPORT_FORMATS, VALID_RENDER_FORMATS } from "./app-state";
import { bubbleUpDeepMutations } from "./deep-mutate";
import { downloadUrl, fetchSource, formatBytes, formatMillis } from '../utils'

import JSZip from 'jszip';

export class Model {
  constructor(private fs: FS, public state: State, private setStateCallback?: (state: State) => void, 
    private statePersister?: StatePersister) {
  }
  
  init() {
    if (!this.state.output && !this.state.lastCheckerRun && !this.state.previewing && !this.state.checkingSyntax && !this.state.rendering &&
        this.source.trim() != '') {
      this.processSource();
    }
  }

  private setState(state: State) {
    this.state = state;
    this.statePersister && this.statePersister.set(state);
    this.setStateCallback && this.setStateCallback(state);
  }

  mutate(f: (state: State) => void) {
    const mutated = bubbleUpDeepMutations(this.state, f);
    // No matter how deep the mutation happened, the top-level object's identity
    // will have changed iff the mutated values are different.
    if (mutated !== this.state) {
      this.setState(mutated);
      return true;
    }

    return false;
  }

  set renderFormat(format: keyof typeof VALID_RENDER_FORMATS) {
    this.mutate(s => s.params.renderFormat = format);
  }

  set exportFormat(format: keyof typeof VALID_EXPORT_FORMATS) {
    this.mutate(s => s.params.exportFormat = format);
  }
  setVar(name: string, value: any) {
    this.mutate(s => s.params.vars = {...s.params.vars ?? {}, [name]: value});
    this.render({isPreview: true, now: false});
  }

  set logsVisible(value: boolean) {
    if (value) {
      if (this.state.view.layout.mode === 'single') {
        this.changeSingleVisibility('editor');
      } else {
        this.changeMultiVisibility('editor', true);  
      }
    }
    this.mutate(s => s.view.logs = value);
  }

  isComponentFullyVisible(id: SingleLayoutComponentId) {
    if (this.state.view.layout.mode === 'multi') {
      return this.state.view.layout[id];
    } else {
      return this.state.view.layout.focus === id;
    }
  }

  changeLayout(mode: 'multi' | 'single') {
    if (this.state.view.layout.mode === mode) return;
    this.mutate(s => {
      s.view.layout = s.view.layout.mode === 'multi'
        ? {
          mode: 'single',
          focus: s.view.layout.editor ? 'editor' : s.view.layout.viewer ? 'viewer' : 'customizer'
        }
        : {
          mode: 'multi',
          editor: s.view.layout.focus === 'editor',
          viewer: s.view.layout.focus === 'viewer',
          customizer: s.view.layout.focus === 'customizer',
        }
    });
  }
  changeSingleVisibility(focus: SingleLayoutComponentId) {
    this.mutate(s => {
      if (s.view.layout.mode !== 'single') throw new Error('Wrong mode');
      s.view.layout.focus = focus;
      if (focus !== 'editor') {
        s.view.logs = false;
      }
    });
  }

  changeMultiVisibility(target: MultiLayoutComponentId, visible: boolean) {
    this.mutate(s => {
      if (s.view.layout.mode !== 'multi') throw new Error('Wrong mode');
      s.view.layout[target] = visible
      if ((s.view.layout.customizer ? 1 : 0) + (s.view.layout.editor ? 1 : 0) + (s.view.layout.viewer ? 1 : 0) == 0) {
        // Select at least one panel
        // s.view.layout.editor = true;
        s.view.layout[target] = !visible;
        if (target === 'editor' && !visible) {
          s.view.logs = false;
        }
      }
    })
  }

  openFile(path: string) {
    // alert(`TODO: open ${path}`);
    if (this.mutate(s => {
      if (s.params.activePath != path) {
        s.params.activePath = path;
        if (!s.params.sources.find(src => src.path === path)) {
          let content = '';
          try {
            content = new TextDecoder("utf-8").decode(this.fs.readFileSync(path));
          } catch (e) {
            console.error('Error while reading file:', e);
          }
          s.params.sources = [...s.params.sources, {path, content}];
        }
        s.lastCheckerRun = undefined;
        s.output = undefined;
        s.export = undefined;
      }
    })) {
      this.processSource();
    }
  }

  get source(): string {
    return this.state.params.sources.find(src => src.path === this.state.params.activePath)?.content ?? '';
  }
  set source(source: string) {
    if (this.mutate(s => s.params.sources = s.params.sources.map(src => src.path === s.params.activePath ? {path: src.path, content: source} : src))) {
      this.processSource();
    }
  }

  private processSource() {
    // const params = this.state.params;
    // if (isFileWritable(params.sourcePath)) {
      // const absolutePath = params.sourcePath.startsWith('/') ? params.sourcePath : `/${params.sourcePath}`;
    // this.fs.writeFile(params.sourcePath, params.source);
    // }
    this.checkSyntax();
    this.render({isPreview: true, now: false});
  }

  checkSyntax() {
    this.mutate(s => s.checkingSyntax = true);
    checkSyntax(this.state.params.activePath, this.state.params.sources)({now: false, callback: (checkerRun, err) => this.mutate(s => {
      if (err != null) {
        console.error('Error while checking syntax:', err)
      } else {
        s.lastCheckerRun = checkerRun;
        s.parameterSet = checkerRun?.parameterSet;
        s.checkingSyntax = false;
      }
    })});
  }

  export() {
    if (this.state.output && (this.state.params.renderFormat === this.state.params.exportFormat)) {
      this.mutate(s => s.export = s.output);
      downloadUrl(this.state.output.outFileURL, this.state.output.outFile.name);
      return;
    }
    if (this.state.params.exportFormat == '3mf' && (this.state.view.extruderPicker || (this.state.params.extruderColors ?? []).length === 0)) {
      this.mutate(s => this.state.view.extruderPicker = true);
      return;
    }
    this.mutate(s => s.exporting = true);

    const outFile = this.state.output?.outFile;
    const outFileURL = this.state.output?.outFileURL;
    if (!outFile || !outFileURL) {
      throw new Error('No output file to export');
    }

    const scadPath = '/export.scad'
    const sources: Source[] = [
      {
        path: scadPath,
        content: `import("${outFile.name}");`
      },
      {
        path: outFile.name,
        url: outFileURL,
      }
    ];
    let {features, exportFormat, extruderColors} = this.state.params;
    
    render({scadPath, sources, features, extraArgs: [], isPreview: false, renderFormat: exportFormat, extruderColors})({now: true, callback: (output, err) => {
      this.mutate(s => {
        s.exporting = false;
        
        if (err != null) {
          console.error('Error while exporting:', err)
          s.error = `${err}`;
        } else if (output) {
          if (s.export?.outFileURL) {
            URL.revokeObjectURL(s.export.outFileURL);
          }
          s.export = {
            outFile: output.outFile,
            outFileURL: URL.createObjectURL(output.outFile),
            elapsedMillis: output.elapsedMillis,
            formattedElapsedMillis: formatMillis(output.elapsedMillis),
            formattedOutFileSize: formatBytes(output.outFile.size),
          };
          downloadUrl(s.export.outFileURL, output.outFile.name);
        }
      });
    }})
  }

  async saveProject() {
    if (this.state.params.sources.length == 1) {
      const content = this.state.params.sources[0].content;
      const contentBytes = new TextEncoder().encode(content);
      const blob = new Blob([contentBytes], {type: 'text/plain'});
      const file = new File([blob], this.state.params.activePath.split('/').pop()!);
      downloadUrl(URL.createObjectURL(file), file.name);
    } else {
      const zip = new JSZip();
      for (const source of this.state.params.sources) {
        let path = source.path
        if (path.startsWith('/')) {
          path = path.substring(1);
        }
        zip.file(path, await fetchSource(source));
      }
      zip.generateAsync({type: 'blob'}).then(blob => {
        const file = new File([blob], 'project.zip');
        downloadUrl(URL.createObjectURL(file), file.name);
      });
    }
  }

  render({isPreview, now}: {isPreview: boolean, now: boolean}) {
    const setRendering = (s: State, value: boolean) => {
      if (isPreview) {
        s.previewing = value;
      } else {
        s.rendering = value;
      }
    }
    this.mutate(s => setRendering(s, true));

    let {activePath, sources, vars, features, renderFormat, extruderColors} = this.state.params;
    
    render({scadPath: activePath, sources, vars, features, extraArgs: [], isPreview, renderFormat, extruderColors})({now, callback: (output, err) => {
      this.mutate(s => {
        setRendering(s, false);
        if (err != null) {
          console.error('Error while doing ' + (isPreview ? 'preview' : 'rendering') + ':', err)
          s.error = `${err}`;
        } else if (output) {
          s.error = undefined;
          s.lastCheckerRun = {
            logText: output.logText,
            markers: output.markers,
          }
          if (s.output?.outFileURL) {
            URL.revokeObjectURL(s.output.outFileURL);
          }

          s.output = {
            isPreview: isPreview,
            outFile: output.outFile,
            outFileURL: URL.createObjectURL(output.outFile),
            elapsedMillis: output.elapsedMillis,
            formattedElapsedMillis: formatMillis(output.elapsedMillis),
            formattedOutFileSize: formatBytes(output.outFile.size),
          };

          if (!isPreview) {
            const audio = document.getElementById('complete-sound') as HTMLAudioElement;
            audio?.play();
          }
        }
      });
    }})
  }
}
