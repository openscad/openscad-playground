// The build writes libraries/index.json: for each bundled library, the size of its zip and the
// .scad files in it. It lets the UI list libraries that aren't mounted yet (file picker,
// completions) without fetching their archive.

import { getResourceLoader } from '../resource-loader';

export type LibraryIndex = {
  [library: string]: {
    zipBytes: number,
    /** [path inside the zip, uncompressed size] */
    files: [string, number][],
  }
};

let loading: Promise<LibraryIndex> | undefined;
let loaded: LibraryIndex | undefined;
const listings = new Map<string, Set<string>>();

/** Fetches the index once. Resolves to an empty index (and warns) if it can't be fetched. */
export function loadLibraryIndex(): Promise<LibraryIndex> {
  return loading ??= (async () => {
    try {
      loaded = JSON.parse(await getResourceLoader().fetchText('./libraries/index.json')).libraries as LibraryIndex;
    } catch (e) {
      console.warn('Failed to load the library index:', e);
      loading = undefined; // Allow retrying
      return {};
    }
    return loaded;
  })();
}

export function getLoadedLibraryIndex(): LibraryIndex | undefined {
  return loaded;
}

/**
 * Names (files and directories) directly under a directory of the libraries tree, as
 * 'Lib/dir' ('' for the list of libraries). Directories are the names with no ".scad" suffix.
 */
export function listIndexDir(index: LibraryIndex, dir: string): string[] {
  dir = dir.replace(/^\/+|\/+$/g, '');
  if (listings.size === 0) {
    const add = (parent: string, name: string) => {
      let set = listings.get(parent);
      if (!set) listings.set(parent, set = new Set());
      set.add(name);
    };
    for (const [library, {files}] of Object.entries(index)) {
      add('', library);
      for (const [path] of files) {
        const parts = [library, ...path.split('/')];
        for (let i = 1; i < parts.length; i++) {
          add(parts.slice(0, i).join('/'), parts[i]);
        }
      }
    }
  }
  return [...(listings.get(dir) ?? [])];
}
