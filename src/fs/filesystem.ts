// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { deployedArchiveNames, zipArchives } from "./zip-archives";
import { getResourceLoader, ResourceLoader } from "../resource-loader";

declare var BrowserFS: BrowserFSInterface

export type FSMounts = {
  [n: string]: {fs: string, options: {zipData: Buffer}}
}

export type Symlinks = {[alias: string]: string};

export const getParentDir = (path: string) => {
  let d = path.split('/').slice(0, -1).join('/');
  return d === '' ? (path.startsWith('/') ? '/' : '.') : d;
} 

export function join(a: string, b: string): string {
  if (a === '.') return b;
  if (a.endsWith('/')) return join(a.substring(0, a.length - 1), b);
  return b === '.' ? a : `${a}/${b}`;
}

export async function getBrowserFSLibrariesMounts(archiveNames: string[], loader?: ResourceLoader) {
  const resolvedLoader = loader ?? getResourceLoader();
  const Buffer = BrowserFS.BFSRequire('buffer').Buffer;
  const results: [string, ArrayBuffer][] =
    await Promise.all(archiveNames.map(async (n: string) => [n, await resolvedLoader.fetchBinary(`./libraries/${n}.zip`)]));

  const zipMounts: FSMounts = {};
  for (const [n, zipData] of results) {
    zipMounts[n] = {
      fs: "ZipFS",
      options: {
        zipData: Buffer.from(zipData)
      }
    }
  }
  return zipMounts;
}

export async function symlinkLibraries(archiveNames: string[], fs: FS, prefix='/libraries', cwd='/tmp') {
  const createSymlink = async (target: string, source: string) => {
    try {
      await fs.symlink(target, source);
    } catch (e) {
      console.error(`symlink(${target}, ${source}) failed: `, e);
    }
  };

  await Promise.all(archiveNames.map(n => (async () => {
    if (!(n in zipArchives)) throw new Error(`Archive named ${n} invalid (valid ones: ${deployedArchiveNames.join(', ')})`);
    const {symlinks} = (zipArchives)[n];
    if (symlinks) {
      for (const from in symlinks) {
        const to = symlinks[from];
        const target = to === '.' ? `${prefix}/${n}` : `${prefix}/${n}/${to}`;
        const source = from.startsWith('/') ? from : `${cwd}/${from}`;
        await createSymlink(target, source);
      }
    } else {
      await createSymlink(`${prefix}/${n}`, `${cwd}/${n}`);
    }
  })()));
}

function configureAndInstallFS(windowOrSelf: Window, options: any) {
  return new Promise(async (resolve, reject) => {
    BrowserFS.install(windowOrSelf);
    try {
      BrowserFS.configure(options, function (e: any) {
        if (e) reject(e);
        else resolve(null);
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

export async function createEditorFS({prefix, allowPersistence, skipLibraries, archiveNames = deployedArchiveNames, deferArchives = false}: {prefix: string, allowPersistence: boolean, skipLibraries?: boolean, archiveNames?: string[], deferArchives?: boolean}): Promise<FS> {
  // With deferArchives, the archives are mounted later by whenLibrariesMounted().
  const allMounts: FSMounts = {};
  if (!skipLibraries && !deferArchives) {
    const librariesMounts = await getBrowserFSLibrariesMounts(archiveNames);
    for (const n in librariesMounts) {
      allMounts[`${prefix}${n}`] = librariesMounts[n];
    }
  }

  await configureAndInstallFS(typeof window === 'object' && window || self, {
    fs: "OverlayFS",
    options: {
      readable: {
        fs: "MountableFileSystem",
        options: {
          ...allMounts,
        }
      },
      writable: allowPersistence ? {
        fs: "LocalStorage",
      } : {
        fs: "InMemory"
      },
    },
  });

  var fs = BrowserFS.BFSRequire('fs');

  if (deferArchives) {
    deferredMounts = {
      readable: fs.getRootFS().getOverlayedFileSystems().readable,
      prefix,
      archiveNames,
    };
  }

  return fs;
}

const librariesMountedListeners = new Set<() => void>();

/** Calls `listener` once the deferred archives have been mounted. Returns an unsubscribe function. */
export function onLibrariesMounted(listener: () => void): () => void {
  librariesMountedListeners.add(listener);
  return () => librariesMountedListeners.delete(listener);
}

let deferredMounts: {readable: any, prefix: string, archiveNames: string[]} | undefined;
let librariesMounted: Promise<void> | undefined;

/**
 * Fetches and mounts the archives left out by createEditorFS({deferArchives}).
 * Idempotent: the first call starts the work, later calls share it.
 */
export function whenLibrariesMounted(): Promise<void> {
  if (!deferredMounts) {
    return Promise.resolve();
  }
  return librariesMounted ??= (async () => {
    try {
      const {readable, prefix, archiveNames} = deferredMounts!;
      const mounts = await getBrowserFSLibrariesMounts(archiveNames);
      for (const [n, {options}] of Object.entries(mounts)) {
        await new Promise<void>((resolve, reject) =>
          BrowserFS.FileSystem.ZipFS.Create(options, (e: Error | null, zipFS: any) => {
            if (e) return reject(e);
            readable.mount(`${prefix}${n}`, zipFS);
            resolve();
          }));
      }
      librariesMountedListeners.forEach(listener => listener());
    } catch (e) {
      console.warn('Failed to mount the library archives:', e);
      librariesMounted = undefined; // Allow retrying
    }
  })();
}
