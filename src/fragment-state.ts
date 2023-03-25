// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { State } from "./app-state";
import { validateArray, validateString } from "./utils";

export function writeStateInFragment(state: State) {
  window.location.hash = encodeURIComponent(JSON.stringify(state.params));
}
export function readStateFromFragment(): State | null {
  if (window.location.hash.startsWith('#') && window.location.hash.length > 1) {
    try {
      const params = JSON.parse(decodeURIComponent(window.location.hash.substring(1)));
      return {
        params: {
          source: validateString(params?.source),
          features: validateArray(params?.features, validateString),
        },
      };
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}
