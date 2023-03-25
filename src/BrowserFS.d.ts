// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

// import { FS } from "./filesystem";

declare interface FS {
  readdir(path: string, cb: (err: any, files: string[]) => void): void;
  symlink(target: string, source: string): void;
}

declare interface EmscriptenFS extends FS {}

declare type BrowserFSInterface = {
  BFSRequire: (name: string) => any,

  install: (windowOrSelf: Window) => void,
  configure: (options: any, callback: (e?: any) => void) => void,

  EmscriptenFS: {
    new(fs: FS, path: string, errnoCodes: object): EmscriptenFS
  }
};
