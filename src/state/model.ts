// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, RenderArgs, RenderOutput } from "../runner/actions";
import { MultiLayoutComponentId, SingleLayoutComponentId, State, StatePersister } from "./app-state";
import { bubbleUpDeepMutations } from "./deep-mutate";
import { formatBytes, formatMillis } from '../utils'
import { useContext, useState } from "react";
import { FileSystemContext } from "../components/contexts";
import { BaseFileSystem, FileSystemContextInterface } from "../fs/base-filesystem";

export class Model {
  constructor(private fs: FS, private fileSystem: BaseFileSystem, public state: State, private setStateCallback?: (state: State) => void,
    private statePersister?: StatePersister) {
  }

  init() {
    if (!this.state.output && !this.state.lastCheckerRun && !this.state.previewing && !this.state.checkingSyntax && !this.state.rendering &&
      this.state.params.source.trim() != '') {
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

  setVar(name: string, value: any) {
    this.mutate(s => s.params.vars = { ...s.params.vars ?? {}, [name]: value });
    this.render({ isPreview: true, now: false });
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

  async openFile(path: string) {
    const fileSystem = this.fileSystem;
    if (fileSystem === undefined) {
      return;
    }

    let fileContent = await fileSystem.readFile(path);
    // alert(`TODO: open ${path}`);
    if (this.mutate(s => {
      s.params.source = fileContent;
      if (s.params.sourcePath != path) {
        s.params.sourcePath = path;
        s.lastCheckerRun = undefined;
        s.output = undefined;
      }
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
    // if (isFileWritable(params.sourcePath)) {
    // const absolutePath = params.sourcePath.startsWith('/') ? params.sourcePath : `/${params.sourcePath}`;
    this.fileSystem.saveFile(params.sourcePath, params.source);
    //this.fs.writeFile(params.sourcePath, params.source);
    // }
    this.checkSyntax();
    this.render({ isPreview: true, now: false });
  }
  checkSyntax() {
    this.mutate(s => s.checkingSyntax = true);
    checkSyntax(this.state.params.source, this.state.params.sourcePath)({
      now: false, callback: (checkerRun, err) => this.mutate(s => {
        if (err != null) {
          console.error('Error while checking syntax:', err)
        } else {
          s.lastCheckerRun = checkerRun;
          s.parameterSet = checkerRun?.parameterSet;
          s.checkingSyntax = false;
        }
      })
    });
  }

  render({ isPreview, now }: { isPreview: boolean, now: boolean }) {
    const setRendering = (s: State, value: boolean) => {
      if (isPreview) {
        s.previewing = value;
      } else {
        s.rendering = value;
      }
    }
    this.mutate(s => setRendering(s, true));

    const { source, sourcePath, vars, features } = this.state.params;

    render({ source, sourcePath, vars, features, extraArgs: [], isPreview })({
      now, callback: (output, err) => {
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

            if (!isPreview) {
              const audio = document.getElementById('complete-sound') as HTMLAudioElement;
              audio?.play();
            }
          }
        });
      }
    })
  }
}
