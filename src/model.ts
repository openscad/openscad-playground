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

  // get features() { return this.state_.params.features; }

  // get source(): string { return this.state_.params.source; }

  set source(source: string) {
    if (this.mutate(s => { s.params.source = source; })) {
      this.processSource();
    }
  }

  private processSource() {
    this.mutate(s => {
      s.previewing = true;
      s.checkingSyntax = true;
    });
    checkSyntax(this.state.params.source)({now: false, callback: checkerRun => this.mutate(s => {
      s.lastCheckerRun = checkerRun;
      s.checkingSyntax = false;
    })});
    render({...this.renderArgs, isPreview: true})({now: false, callback: output => this.handleRenderOutput(output, s => {
      s.previewing = false;
    })});
  }

  // checkSyntax() {
  //   this.mutate(s => s.checkingSyntax = true);
  //   checkSyntax(this.state.params.source)({now: false, callback: checkerRun => this.mutate(s => {
  //     s.lastCheckerRun = checkerRun;
  //     s.checkingSyntax = false;
  //   })});
  // }
  // preview() {
  //   this.mutate(s => s.previewing = true);
  //   render({...this.renderArgs, isPreview: true})({now: false, callback: output => this.handleRenderOutput(output, s => {
  //     s.previewing = false;
  //   })});
  // }

  private handleRenderOutput(output: RenderOutput, extraMutations: (s: State) => void) {
    this.mutate(s => {
      s.lastCheckerRun = {
        logText: output.logText,
        markers: output.markers,
      }
      if (s.output?.stlFileURL) {
        URL.revokeObjectURL(s.output.stlFileURL);
      }
      s.output = {
        stlFile: output.stlFile,
        stlFileURL: URL.createObjectURL(output.stlFile),
      };
      extraMutations(s);
    });
  }

  private get renderArgs(): RenderArgs {
    const source = this.state.params.source;
    const features = this.state.params.features;
    return {source, features, extraArgs: ['-D$preview=true']};
  }

  render() {
    this.mutate(s => s.rendering = true);

    render(this.renderArgs)({now: true, callback: output => this.handleRenderOutput(output, s => {
      s.rendering = false;
    })})
  }

}
