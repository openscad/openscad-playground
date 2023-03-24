// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { FS } from "./filesystem";

interface EmscriptenFS extends FS {
  
};

export let BrowserFS = (window as any)['BrowserFS'] as {
  BFSRequire: (name: string) => any,

  install: (windowOrSelf: Window) => void,
  configure: (options: any, callback: (e?: any) => void) => void,

  EmscriptenFS: {
    new(fs: FS, path: string, errnoCodes: object): EmscriptenFS
  }
};
