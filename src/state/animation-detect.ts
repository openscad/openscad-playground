/**
 * Does a project animate? OpenSCAD's own animation feature is the special
 * variable `$t` (0 <= $t < 1): a model "is animated" iff it reads `$t`.
 *
 * The scan is deliberately conservative and cheap (see docs/ANIMATION.md):
 *  - `$t` as a whole identifier (not `$tx`, not `$t2`), anywhere in code;
 *    comments and string literals are blanked out first;
 *  - the active file plus the local files it `include`s / `use`s (transitively),
 *    as far as they are among the project's sources. Libraries that are only
 *    mounted from the library archives are not scanned.
 * A false positive (e.g. a top-level `$t = 0.5;`) merely shows the controls.
 */

/** Source with comments and string literals replaced by spaces (newlines kept), so regexes only see code. */
export function stripCommentsAndStrings(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && d === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
    } else if (c === '"') {
      out += ' ';
      i++;
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < n) { out += ' '; i++; }
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) { out += ' '; i++; }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const TIME_VAR = /\$t(?![A-Za-z0-9_$])/;

/** Whether this single file's code reads `$t`. */
export function usesAnimationTime(source: string): boolean {
  return source.includes('$t') && TIME_VAR.test(stripCommentsAndStrings(source));
}

const INCLUDE = /\b(?:include|use)\s*<([^>]+)>/g;

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return '/' + parts.join('/');
}

/** Candidate project paths for an `include <ref>` written in `fromPath`. */
function resolveCandidates(fromPath: string, ref: string): string[] {
  const dir = fromPath.replace(/[^/]*$/, '');
  return [...new Set([normalizePath(ref.startsWith('/') ? ref : dir + ref), normalizePath('/' + ref)])];
}

const MAX_FILES = 50;

/** `$t` in the active file or in the project files it (transitively) includes / uses. */
export function projectUsesAnimationTime(sources: ReadonlyArray<{ path: string; content?: string }>, activePath: string): boolean {
  if (!activePath.endsWith('.scad')) return false;
  const byPath = new Map(sources.map(s => [normalizePath(s.path), s.content]));
  const seen = new Set<string>();
  const queue = [normalizePath(activePath)];
  while (queue.length && seen.size < MAX_FILES) {
    const path = queue.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    const content = byPath.get(path);
    if (!content) continue;
    if (usesAnimationTime(content)) return true;
    const code = stripCommentsAndStrings(content);
    for (const m of code.matchAll(INCLUDE)) {
      // (string literals are blanked, but include <...> is not a string)
      const found = resolveCandidates(path, m[1].trim()).find(p => byPath.has(p));
      if (found && !seen.has(found)) queue.push(found);
    }
  }
  return false;
}
