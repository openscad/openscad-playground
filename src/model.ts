// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, RenderArgs, RenderOutput } from "./actions";
import { MultiLayoutComponentId, SingleLayoutComponentId, State } from "./app-state";
import { bubbleUpDeepMutations } from "./deep-mutate";
import { writeStateInFragment } from "./fragment-state";

export class Model {
  constructor(private fs: FS, public state: State, private setStateCallback?: (state: State) => void) {
  }
  
  init() {
    if (!this.state.output && !this.state.lastCheckerRun && !this.state.previewing && !this.state.checkingSyntax && !this.state.rendering &&
        this.state.params.source.trim() != '') {
      this.processSource();
    }
  }

  private setState(state: State) {
    this.state = state;
    writeStateInFragment(state);
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

  set logsVisible(value: boolean) {
    this.mutate(s => s.view.logs = value);
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
      }
    })
  }

  openFile(path: string) {
    // alert(`TODO: open ${path}`);
    if (this.mutate(s => {
      s.params.source = new TextDecoder("utf-8").decode(this.fs.readFileSync(path));
      s.params.sourcePath = path;
    })) {
      this.processSource();
    }
  }

  set source(source: string) {
    if (this.mutate(s => { s.params.source = source; })) {
      this.processSource();
    }
  }

  private processSource() {
    const params = this.state.params;
    // this.fs.writeFile(params.sourcePath, params.source);
    this.checkSyntax();
    this.render({isPreview: true, now: false});
  }
  checkSyntax() {
    this.mutate(s => s.checkingSyntax = true);
    checkSyntax(this.state.params.source, this.state.params.sourcePath)({now: false, callback: (checkerRun, err) => this.mutate(s => {
      if (err != null) {
        console.error('Error while checking syntax:', err)
      } else {
        s.lastCheckerRun = checkerRun;
        s.checkingSyntax = false;
      }
    })});
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

    const {source, sourcePath, features} = this.state.params;
    
    render({source, sourcePath, features, extraArgs: [], isPreview})({now, callback: (output, err) => {
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
          if (s.output?.stlFileURL) {
            URL.revokeObjectURL(s.output.stlFileURL);
          }

          s.output = {
            isPreview: isPreview,
            stlFile: output.stlFile,
            stlFileURL: URL.createObjectURL(output.stlFile),
            elapsedMillis: output.elapsedMillis,
            formattedElapsedMillis: formatMillis(output.elapsedMillis),
            formattedStlFileSize: formatBytes(output.stlFile.size),
          };
        }
      });
    }})
  }

}

function formatBytes(n: number) {
  if (n < 1024) {
    return `${Math.floor(n)} bytes`;
  }
  n /= 1024;
  if (n < 1024) {
    return `${Math.floor(n * 10) / 10} kB`;
  }
  n /= 1024;
  return `${Math.floor(n * 10) / 10} MB`;
}

function formatMillis(n: number) {
  if (n < 1000)
    return `${Math.floor(n)} millis`;

  return `${Math.floor(n / 100) / 10} sec`;
}