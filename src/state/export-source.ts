/**
 * Exporting the OpenSCAD source itself (a "Download .scad" of the active file, or of any file of the project),
 * as opposed to exporting the rendered model. Pure, so it is unit tested (server/test-tools.ts).
 */

import { buildFilename, bytesToBase64, ExportError, FORMAT_INFO } from './export-logic.ts';

export interface SourceFileInput {
  path: string;
  content?: string;
}

export interface SourceExport {
  filename: string;
  mimeType: string;
  base64: string;
  size: number;
  /** The project file that was exported. */
  path: string;
  /** The UTF-8 bytes (for browser downloads). */
  bytes: Uint8Array;
}

/** `/lib/gear.scad` -> `gear`. Falls back to `playground` for empty names. */
export function sourceStem(path: string): string {
  return (path.split('/').pop() ?? '').replace(/\.[^.]+$/, '') || 'playground';
}

/** The source of `path` (default: the active file) as a downloadable file named after it. */
export function exportSource(files: SourceFileInput[], activePath: string, path?: string, filename?: string): SourceExport {
  const target = path ?? activePath;
  const file = files.find(f => f.path === target);
  if (!file) throw new ExportError(`No such file: ${target}. Files: ${files.map(f => f.path).join(', ') || '(none)'}`);
  const bytes = new TextEncoder().encode(file.content ?? '');
  return {
    filename: buildFilename(filename, sourceStem(file.path), 'scad'),
    mimeType: FORMAT_INFO.scad.mimeType,
    base64: bytesToBase64(bytes),
    size: bytes.length,
    path: file.path,
    bytes,
  };
}
