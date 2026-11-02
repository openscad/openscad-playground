/**
 * Pure logic for exporting/delivering the rendered model: format and MIME
 * mapping, file names, size caps and the choice of delivery channel given the
 * host's capabilities. DOM-free so it can be unit tested (server/test-tools.ts).
 */

export type ExportFormat = 'stl' | 'off' | 'glb' | '3mf' | 'svg' | 'dxf';

export const FORMATS_3D: ExportFormat[] = ['stl', '3mf', 'glb', 'off'];
export const FORMATS_2D: ExportFormat[] = ['svg', 'dxf'];

export const FORMAT_INFO: Record<ExportFormat, { label: string; mimeType: string }> = {
  stl: { label: 'STL (binary)', mimeType: 'model/stl' },
  '3mf': { label: '3MF', mimeType: 'model/3mf' },
  glb: { label: 'GLB (binary glTF)', mimeType: 'model/gltf-binary' },
  off: { label: 'OFF', mimeType: 'model/off' },
  svg: { label: 'SVG', mimeType: 'image/svg+xml' },
  dxf: { label: 'DXF', mimeType: 'image/vnd.dxf' },
};

export class ExportError extends Error {}

export function formatsFor(is2D: boolean): ExportFormat[] {
  return is2D ? FORMATS_2D : FORMATS_3D;
}

export function defaultFormat(is2D: boolean): ExportFormat {
  return formatsFor(is2D)[0];
}

/** Validate a user/model supplied format against the model's dimensionality. */
export function parseFormat(format: string | undefined, is2D: boolean): ExportFormat {
  if (format == null || format === '') return defaultFormat(is2D);
  const f = format.toLowerCase() as ExportFormat;
  if (!(f in FORMAT_INFO)) {
    throw new ExportError(`Unknown format "${format}". Valid: ${formatsFor(is2D).join(', ')}`);
  }
  if (!formatsFor(is2D).includes(f)) {
    throw new ExportError(`${f.toUpperCase()} is not available for this ${is2D ? '2D' : '3D'} model. Valid: ${formatsFor(is2D).join(', ')}`);
  }
  return f;
}

/** A safe file name ending in the format's extension (path separators and odd characters removed). */
export function buildFilename(requested: string | undefined, fallbackStem: string, format: ExportFormat): string {
  const raw = (requested ?? '').trim() || fallbackStem;
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const stem = base.replace(new RegExp(`\\.${format}$`, 'i'), '').replace(/[^\w.\- ()]+/g, '_').replace(/^\.+/, '').trim() || 'model';
  return `${stem}.${format}`;
}

export type Delivery = 'download' | 'message' | 'return';

export interface HostFileCapabilities {
  /** Host implements ui/download-file. */
  download: boolean;
  /** Host accepts ui/message with embedded resource blocks. */
  message: boolean;
}

/** Maximum file size per channel, in bytes. */
export const SIZE_CAPS: Record<Delivery, number> = {
  download: 32 * 1024 * 1024,
  message: 4 * 1024 * 1024,
  return: 1024 * 1024,
};

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Pick the delivery channel. 'auto' prefers a host download, then a chat
 * attachment, then returning the file in the tool result. An explicit choice
 * that the host cannot do, or a file over the channel's cap, is an error that
 * names the alternatives.
 */
export function chooseDelivery(requested: Delivery | 'auto' | undefined, caps: HostFileCapabilities, size: number): Delivery {
  const available: Delivery[] = [...(caps.download ? ['download' as const] : []), ...(caps.message ? ['message' as const] : []), 'return'];
  const fits = (d: Delivery) => size <= SIZE_CAPS[d];
  const tooBig = (d: Delivery) => new ExportError(
    `The file is ${formatSize(size)}, over the ${formatSize(SIZE_CAPS[d])} limit for delivery "${d}".` +
    (available.some(a => a !== d && fits(a)) ? ` Other available: ${available.filter(a => a !== d && fits(a)).join(', ')}.` : ' Try a smaller model or a more compact format (e.g. STL or GLB instead of OFF).'));
  if (requested && requested !== 'auto') {
    if (!available.includes(requested)) {
      throw new ExportError(`Delivery "${requested}" is not supported by this host. Available: ${available.join(', ')}.`);
    }
    if (!fits(requested)) throw tooBig(requested);
    return requested;
  }
  const pick = available.find(fits);
  if (!pick) throw tooBig(available[available.length - 1]);
  return pick;
}

/** Base64 of bytes, chunked to avoid call-stack limits. */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
