// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import { deployedArchiveNames, zipArchives } from "./zip-archives";

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

async function validateZipArchive(zipData: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const ZipFS = (BrowserFS as any).FileSystem?.ZipFS;
    if (!ZipFS || typeof ZipFS.Create !== 'function') {
      resolve();
      return;
    }
    ZipFS.Create({ zipData }, (err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function getBrowserFSLibrariesMounts(archiveNames: string[]): Promise<{ mounts: FSMounts, mountedArchives: string[] }> {
  const Buffer = BrowserFS.BFSRequire('buffer').Buffer;
  const mounts: FSMounts = {};
  const mountedArchives: string[] = [];

  for (const name of archiveNames) {
    const url = `./libraries/${name}.zip`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[filesystem] Skipping ${name}.zip (HTTP ${response.status})`);
        continue;
      }
      const data = Buffer.from(await response.arrayBuffer());
      await validateZipArchive(data);
      mounts[name] = {
        fs: 'ZipFS',
        options: {
          zipData: data,
        },
      };
      mountedArchives.push(name);
    } catch (error) {
      console.error(`[filesystem] Failed to load archive ${name}.zip`, error);
    }
  }

  if (mountedArchives.length === 0) {
    console.warn('[filesystem] No library archives were mounted. Run `make public` to generate ZIP archives.');
  }

  return { mounts, mountedArchives };
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

export async function createEditorFS({prefix, allowPersistence}: {prefix: string, allowPersistence: boolean}): Promise<{ fs: FS, mountedArchives: string[] }> {
  const archiveNames = deployedArchiveNames;
  const { mounts: librariesMounts, mountedArchives } = await getBrowserFSLibrariesMounts(archiveNames);
  const allMounts: FSMounts = {};
  for (const n in librariesMounts) {
    allMounts[`${prefix}${n}`] = librariesMounts[n];
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

  return { fs, mountedArchives };
}
