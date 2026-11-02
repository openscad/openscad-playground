// Figures out which of the bundled library archives a render needs, so that
// only those get fetched and mounted (see openscad-worker-core.ts).
//
// The scan is a deliberately cheap over-approximation: any path component of
// an `include`/`use` target or of any string literal that equals a library's
// name (or one of its top-level symlink aliases) selects that library.
// Being wrong in the "too many" direction only costs bytes; being wrong in
// the "too few" direction is caught by `getMissingArchives` (the render is
// run again with what OpenSCAD complained about added).

import { deployedArchiveNames, removedLibraries, zipArchives } from "./zip-archives";

export const FONTS_ARCHIVE = 'fonts';

/** Archives that `use`/`include` files from other archives. */
const archiveDependencies: {[archive: string]: string[]} = {
  'openscad': ['MCAD'],
  // Some of its parts call text() (e.g. 7-segment meters).
  'NopSCADlib': [FONTS_ARCHIVE],
  'openscad_attachable_text3d': ['BOSL2', FONTS_ARCHIVE],
};

const aliasToArchive = new Map<string, string>();
for (const n of deployedArchiveNames) {
  aliasToArchive.set(n, n);
  for (const alias of Object.keys(zipArchives[n].symlinks ?? {})) {
    aliasToArchive.set(alias.replace(/^\/+/, ''), n);
  }
}

const includedOrQuoted = /<([^<>\n"]+)>|"((?:[^"\\\n]|\\.)*)"/g;
const usesText = /\b(?:text|textmetrics|fontmetrics)\s*\(|\bfont\s*=/;

/** Messages for references to libraries that are no longer bundled (libs-config.json `removedLibraries`). */
export function getRemovedLibraryMessages(texts: string[], paths: string[] = []): string[] {
  const names = Object.keys(removedLibraries).filter(n => !aliasToArchive.has(n));
  if (names.length === 0) {
    return [];
  }
  const found = new Set<string>();
  const visitPath = (p: string) => p.split('/').forEach(c => names.includes(c) && found.add(c));
  paths.forEach(visitPath);
  for (const text of texts) {
    for (const m of text.matchAll(includedOrQuoted)) {
      visitPath(m[1] ?? m[2]);
    }
  }
  return [...found].map(n => `[playground] The library "${n}" is no longer bundled with the playground. ${removedLibraries[n]}`);
}

/** Archive names (fonts included) that a set of sources / file paths refers to. */
export function getRequiredArchives(texts: string[], paths: string[] = []): string[] {
  const needed = new Set<string>();
  const visitPath = (p: string) => {
    for (const component of p.split('/')) {
      const archive = aliasToArchive.get(component);
      if (archive) needed.add(archive);
    }
  };
  for (const p of paths) {
    visitPath(p);
  }
  for (const text of texts) {
    if (usesText.test(text)) {
      needed.add(FONTS_ARCHIVE);
    }
    for (const m of text.matchAll(includedOrQuoted)) {
      visitPath(m[1] ?? m[2]);
    }
  }
  // Transitive closure over archives referring to each other.
  const queue = [...needed];
  while (queue.length) {
    for (const dep of archiveDependencies[queue.pop()!] ?? []) {
      if (!needed.has(dep)) {
        needed.add(dep);
        queue.push(dep);
      }
    }
  }
  return deployedArchiveNames.filter(n => needed.has(n));
}

/**
 * Archives that OpenSCAD's stderr shows it needed (a missing library file, or
 * the fonts) and that were not mounted. Empty when nothing is missing.
 */
export function getMissingArchives(stderrLines: string[], mounted: string[]): string[] {
  const missing = new Set<string>();
  for (const line of stderrLines) {
    const m = /Can't open (?:library|include file) '([^']*)'/.exec(line);
    if (m) {
      getRequiredArchives([], [m[1]]).forEach(n => missing.add(n));
    } else if (/Can't get font\b/.test(line)) {
      // (Also hit by fonts that don't exist anywhere: the fonts archive then
      // provides the fallback font.)
      missing.add(FONTS_ARCHIVE);
    }
  }
  return deployedArchiveNames.filter(n => missing.has(n) && !mounted.includes(n));
}
