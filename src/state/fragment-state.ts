// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { State, VALID_EXPORT_FORMATS, VALID_RENDER_FORMATS } from "./app-state";
import { validateArray, validateBoolean, validateString, validateStringEnum } from "../utils";
import { defaultModelColor } from "./initial-state";

export function buildUrlForStateParams(state: State) {//partialState: {params: State['params'], view: State['view']}) {
  return `${location.protocol}//${location.host}${location.pathname}#${encodeStateParamsAsFragment(state)}`;
}
export async function writeStateInFragment(state: State) {
  window.location.hash = await encodeStateParamsAsFragment(state);
}
async function compressString(input: string): Promise<string> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(input));
      controller.close();
    }
  });
  // @ts-ignore
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  const compressedData = await new Response(compressedStream).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(compressedData)));
}

async function decompressString(compressedInput: string): Promise<string> {
  const compressedData = Uint8Array.from(atob(compressedInput), c => c.charCodeAt(0));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(compressedData);
      controller.close();
    }
  });

  // @ts-ignore
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  const decompressedData = await new Response(decompressedStream).arrayBuffer();
  return new TextDecoder().decode(decompressedData);
}

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
          activePath: validateString(params?.activePath),
          features: validateArray(params?.features, validateString),
          vars: params?.vars, // TODO: validate!
          // sources: validateArray(params?.sources, validateSource),
          sources: params?.sources, // TODO: validate!
          renderFormat: validateStringEnum(params?.renderFormat, Object.keys(VALID_RENDER_FORMATS)),
          exportFormat: validateStringEnum(params?.exportFormat, Object.keys(VALID_EXPORT_FORMATS)),
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
          // customizerExpandedTabs: validateArray(view?.customizerExpandedTabs, validateString),
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
