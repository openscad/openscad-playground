// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax, render, RenderArgs, RenderOutput } from "./actions";
import { State } from "./app-state";
import { bubbleUpDeepMutations } from "./deep-mutate";
import { writeStateInFragment } from "./fragment-state";

export class Model {
  constructor(public state: State, private setStateCallback?: (state: State) => void) {
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

  set source(source: string) {
    if (this.mutate(s => { s.params.source = source; })) {
      this.processSource();
    }
  }

  private processSource() {
    this.checkSyntax();
    this.render({isPreview: true});
  }
  checkSyntax() {
    this.mutate(s => s.checkingSyntax = true);
    checkSyntax(this.state.params.source)({now: false, callback: checkerRun => this.mutate(s => {
      s.lastCheckerRun = checkerRun;
      s.checkingSyntax = false;
    })});
  }

  render({isPreview}: {isPreview: boolean}) {
    const setRendering = (s: State, value: boolean) => {
      if (isPreview) {
        s.previewing = value;
      } else {
        s.rendering = value;
      }
    }
    this.mutate(s => setRendering(s, true));

    const source = this.state.params.source;
    const features = this.state.params.features;
    const renderArgs = {source, features, extraArgs: ['-D$preview=true'], isPreview};

    render(renderArgs)({now: !isPreview, callback: output => {
      this.mutate(s => {
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
        };
        setRendering(s, false);
      });
    }})
  }

}
