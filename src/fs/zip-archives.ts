// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Symlinks } from "./filesystem";
import libsConfig from "../../libs-config.json";

export type ZipArchives = {
  [name: string]: {
    description?: string,
    // libs-config.json `lazy`: not fetched in the background, only when something needs it.
    lazy?: boolean,
    gitOrigin?: {
      repoUrl: string,
    }
    symlinks?: Symlinks,
    docs?: {[name: string]: string}
  }
};

type LibraryConfig = {
  name: string,
  repo: string,
  description?: string,
  lazy?: boolean,
  symlinks?: Symlinks,
  docs?: {[name: string]: string},
};

// The list of bundled libraries (and what's shown about them) lives in libs-config.json,
// which is also what the build uses to produce public/libraries/<name>.zip.
export const zipArchives: ZipArchives = {
  // Built by the libs plugin, only ever needed by the worker (and only for text()).
  'fonts': {},
  ...Object.fromEntries((libsConfig.libraries as LibraryConfig[]).map(({name, repo, description, lazy, symlinks, docs}) =>
    [name, {description, lazy, gitOrigin: {repoUrl: repo.replace(/\.git$/, '')}, symlinks, docs}])),
};

export const deployedArchiveNames = Object.keys(zipArchives);

/**
 * Archives the main thread mounts in the background after the first render (file
 * picker, completions). Not the fonts (only the worker needs them, and only for text()), nor
 * the libraries marked `lazy` in libs-config.json: those are listed from the build-time index
 * (see library-index.ts) and only fetched when a script, a file or a completion needs them.
 */
export const backgroundArchiveNames = deployedArchiveNames.filter(n => n !== 'fonts' && !zipArchives[n].lazy);

/** Libraries that are no longer bundled, with a hint for scripts that still refer to them. */
export const removedLibraries: {[name: string]: string} = libsConfig.removedLibraries;
