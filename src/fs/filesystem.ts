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

export function readDirAsArray(fs: FS, path: string): Promise<string[] | undefined> {
  return new Promise((res, rej) => fs.readdir(path, (err, files) => err ? rej(err) : res(files)));
}

export function join(a: string, b: string): string {
  if (a === '.') return b;
  if (a.endsWith('/')) return join(a.substring(0, a.length - 1), b);
  return b === '.' ? a : `${a}/${b}`;
}

export async function getBrowserFSLibrariesMounts(archiveNames: string[]) {
  const Buffer = BrowserFS.BFSRequire('buffer').Buffer;
  const fetchData = async (url: string) => (await fetch(url)).arrayBuffer();
  const results: [string, ArrayBuffer][] =
    await Promise.all(archiveNames.map(async (n: string) => [n, await fetchData(`./libraries/${n}.zip`)]));
  
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
    // console.log('symlink', target, source);
    try {
      await fs.symlink(target, source);
    } catch (e) {
      console.error(`symlink(${target}, ${source}) failed: `, e);
    }
    // await symlink(target, source);
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

export async function createEditorFS({prefix, allowPersistence}: {prefix: string, allowPersistence: boolean}): Promise<FS> {
  const archiveNames = deployedArchiveNames;
  const librariesMounts = await getBrowserFSLibrariesMounts(archiveNames);
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
  // const symlink = (target, source) => new Promise((res, rej) => fs.symlink(target, source, (err) => err ? rej(err) : res()));

  // await setupLibraries(archiveNames, symlink, '/libraries', workingDir);
  return fs;
}
