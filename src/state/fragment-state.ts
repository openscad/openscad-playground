// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { State } from "./app-state";
import { VALID_EXPORT_FORMATS, VALID_RENDER_FORMATS } from './formats';
import { validateArray, validateBoolean, validateString, validateStringEnum } from "../utils";
import { defaultModelColor, defaultSourcePath } from "./initial-state";

export function buildUrlForStateParams(state: State) {//partialState: {params: State['params'], view: State['view']}) {
  return `${location.protocol}//${location.host}${location.pathname}#${encodeStateParamsAsFragment(state)}`;
}
export async function writeStateInFragment(state: State) {
  window.location.hash = await encodeStateParamsAsFragment(state);
}
async function compressString(input: string): Promise<string> {
  return btoa(String.fromCharCode(...new Uint8Array(await new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(input));
      controller.close();
    }
  // @ts-ignore
  }).pipeThrough(new CompressionStream('gzip'))).arrayBuffer())));
}

async function decompressString(compressedInput: string): Promise<string> {
  return new TextDecoder().decode(await new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(Uint8Array.from(atob(compressedInput), c => c.charCodeAt(0)));
      controller.close();
    }
  // @ts-ignore
  }).pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

// async function addFile(path: string, content: string) {
//   const state = JSON.parse(await decompressString(window.location.hash.substring(1)));
//   // console.log(JSON.stringify(state, null, 2)); // Put a breakpoint here if you wanna peek into the state
//   state.params.sources.push({ path, content });
//   window.history.pushState(state, '', '#' + await compressString(JSON.stringify(state)));
//   window.location.reload();
// }

export function encodeStateParamsAsFragment(state: State) {
  const json = JSON.stringify({
    params: state.params,
    view: state.view
  });
  // return encodeURIComponent(json);
  return compressString(json);
}
export async function readStateFromFragment(): Promise<State | null> {
  if (window.location.hash.startsWith('#') && window.location.hash.length > 1) {
    try {
      const serialized = window.location.hash.substring(1);
      let obj;
      try {
        obj = JSON.parse(await decompressString(serialized));
      } catch (e) {
        // Backwards compatibility
        obj = JSON.parse(decodeURIComponent(serialized));
      }
      const {params, view} = obj;
      return {
        params: {
          activePath: validateString(params?.activePath, () => defaultSourcePath),
          features: validateArray(params?.features, validateString),
          vars: params?.vars, // TODO: validate!
          // Source deserialization also handles legacy links (source + sourcePath)
          sources: params?.sources ?? (params?.source ? [{path: params?.sourcePath, content: params?.source}] : undefined), // TODO: validate!
          renderFormat: validateStringEnum(params?.renderFormat, Object.keys(VALID_RENDER_FORMATS), s => 'glb'),
          exportFormat: validateStringEnum(params?.exportFormat, Object.keys(VALID_EXPORT_FORMATS), s => 'glb'),
          extruderColors: validateArray(params?.extruderColors, validateString),
        },
        view: {
          logs: validateBoolean(view?.logs),
          extruderPicker: validateBoolean(view?.extruderPicker),
          layout: {
            mode: validateStringEnum(view?.layout?.mode, ['multi', 'single']),
            focus: validateStringEnum(view?.layout?.focus, ['editor', 'viewer', 'customizer'], s => false),
            editor: validateBoolean(view?.layout['editor']),
            viewer: validateBoolean(view?.layout['viewer']),
            customizer: validateBoolean(view?.layout['customizer']),
          },
          collapsedCustomizerTabs: validateArray(view?.collapsedCustomizerTabs, validateString),
          color: validateString(view?.color, () => defaultModelColor),
          showAxes: validateBoolean(view?.layout?.showAxis, () => true),
          showShadows: validateBoolean(view?.layout?.showShadow, () => true),
          lineNumbers: validateBoolean(view?.layout?.lineNumbers, () => false)
        }
      };
    } catch (e) {
      console.error(e);
    }
  }
  return null;
}
