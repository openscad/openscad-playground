// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { State } from "./app-state";
import { validateString } from "./utils";

export function writeStateInFragment(state: State) {
  window.location.hash = encodeURIComponent(JSON.stringify(state));
}
export function readStateFromFragment(): State | null {
  if (window.location.hash.startsWith('#') && window.location.hash.length > 1) {
    try {
      const state = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
      return {
        params: {
          source: validateString(state.params?.source),
        },
      };
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}
