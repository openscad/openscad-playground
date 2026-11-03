// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { Symlinks } from "./filesystem";
import libsConfig from "../../libs-config.json";

export type ZipArchives = {
  [name: string]: {
    description?: string,
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
  symlinks?: Symlinks,
  docs?: {[name: string]: string},
};

// The list of bundled libraries (and what's shown about them) lives in libs-config.json,
// which is also what the build uses to produce public/libraries/<name>.zip.
export const zipArchives: ZipArchives = {
  // Built by the libs plugin, only ever needed by the worker (and only for text()).
  'fonts': {},
  ...Object.fromEntries((libsConfig.libraries as LibraryConfig[]).map(({name, repo, description, symlinks, docs}) =>
    [name, {description, gitOrigin: {repoUrl: repo.replace(/\.git$/, '')}, symlinks, docs}])),
};

export const deployedArchiveNames = Object.keys(zipArchives);

/** Libraries that are no longer bundled, with a hint for scripts that still refer to them. */
export const removedLibraries: {[name: string]: string} = libsConfig.removedLibraries;
