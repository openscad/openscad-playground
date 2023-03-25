// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { checkSyntax } from "./actions";
import { State } from "./app-state";
import { bubbleUpDeepMutations } from "./deep-mutate";
import { writeStateInFragment } from "./fragment-state";

export class Model {
  constructor(private state: State, private setState_: (state: State) => void) {}

  private setState(state: State) {
    this.state = state;
    this.setState_(state);
    writeStateInFragment(state);
  }

  mutate(f: (state: State) => void) {
    const state = this.state;
    const mutated = bubbleUpDeepMutations(state, f);
    // No matter how deep the mutation happened, the top-level object's identity
    // will have changed iff the mutated values are different.
    if (mutated !== state) {
      this.setState(mutated);
      return true;
    }

    return false;
  }

  get source(): string {
    return this.state.params.source;//.source, this.state.editor;//params.source.content;
  }

  
  set source(source) {
    if (this.mutate(s => s.params.source = source)) {
      checkSyntax(source, checkerRun => this.mutate(s => s.checkerRun = checkerRun))({now: false});
    }
  }


}
