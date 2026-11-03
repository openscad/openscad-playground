/**
 * Pure logic for exporting/delivering the rendered model: format and MIME
 * mapping, file names, size caps and the choice of delivery channel given the
 * host's capabilities. DOM-free so it can be unit tested (server/test-tools.ts).
 */

/** Model formats, plus 'scad': the OpenSCAD source itself (not an export of the rendered model). */
export type ExportFormat = 'stl' | 'off' | 'glb' | '3mf' | 'svg' | 'dxf' | 'scad';

export const FORMATS_3D: ExportFormat[] = ['stl', '3mf', 'glb', 'off'];
export const FORMATS_2D: ExportFormat[] = ['svg', 'dxf'];

export const FORMAT_INFO: Record<ExportFormat, { label: string; mimeType: string }> = {
  stl: { label: 'STL (binary)', mimeType: 'model/stl' },
  '3mf': { label: '3MF', mimeType: 'model/3mf' },
  glb: { label: 'GLB (binary glTF)', mimeType: 'model/gltf-binary' },
  off: { label: 'OFF', mimeType: 'model/off' },
  svg: { label: 'SVG', mimeType: 'image/svg+xml' },
  dxf: { label: 'DXF', mimeType: 'image/vnd.dxf' },
  scad: { label: 'OpenSCAD source (.scad)', mimeType: 'text/x-openscad;charset=utf-8' },
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
    throw new ExportError(`Unknown format "${format}". Valid: ${[...formatsFor(is2D), 'scad'].join(', ')}`);
  }
  if (f !== 'scad' && !formatsFor(is2D).includes(f)) {
    throw new ExportError(`${f.toUpperCase()} is not available for this ${is2D ? '2D' : '3D'} model. Valid: ${[...formatsFor(is2D), 'scad'].join(', ')}`);
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

export type Channel = 'download' | 'message' | 'return';
/** An embedded resource carries the bytes; a resource_link carries a (data:) URI the receiver must fetch. */
export type Form = 'embedded' | 'link';
export interface Step { channel: Channel; form: Form }
export type Delivery = Channel;
export type DeliveryRequest = 'auto' | Channel | 'link';

export interface HostFileCapabilities {
  /** Host implements ui/download-file (embedded resources and resource links are both in its schema). */
  download: boolean;
  /** Host accepts ui/message with embedded resource blocks. */
  message: boolean;
  /** Host accepts ui/message with resource_link blocks. */
  messageLink?: boolean;
}

/** Maximum file size per channel for embedded resources, in bytes. */
export const SIZE_CAPS: Record<Channel, number> = {
  download: 32 * 1024 * 1024,
  message: 4 * 1024 * 1024,
  return: 1024 * 1024,
};
/**
 * resource_link needs a URI the receiver can fetch. A blob: URL only exists inside the (sandboxed, other-origin)
 * iframe and the server is stateless and does not render, so the only portable URI is a data: URI, which inflates
 * the bytes by a third and is rarely fetched by hosts: keep it small.
 */
export const LINK_CAP = 512 * 1024;

export const stepCap = (s: Step) => (s.form === 'link' ? LINK_CAP : SIZE_CAPS[s.channel]);
export const stepName = (s: Step) => `${s.channel}${s.form === 'link' ? ' (resource_link)' : ' (embedded resource)'}`;

export function dataUri(mimeType: string, base64: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function formatSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Ordered delivery candidates for a file. 'auto' tries, in order: host download
 * (embedded, then link), chat message (embedded, then link), tool result
 * (embedded, then link), skipping channels the host lacks and steps the file is
 * too big for. `download`/`message`/`return` restrict to that channel, `link`
 * to resource_link forms. Throws when nothing fits, naming what would.
 */
export function deliveryPlan(requested: DeliveryRequest | undefined, caps: HostFileCapabilities, size: number): Step[] {
  const all: Step[] = [
    ...(caps.download ? [{ channel: 'download', form: 'embedded' }, { channel: 'download', form: 'link' }] as Step[] : []),
    ...(caps.message ? [{ channel: 'message', form: 'embedded' }] as Step[] : []),
    ...(caps.messageLink ? [{ channel: 'message', form: 'link' }] as Step[] : []),
    { channel: 'return', form: 'embedded' },
    { channel: 'return', form: 'link' },
  ];
  const req = requested ?? 'auto';
  const wanted = all.filter(s => req === 'auto' || (req === 'link' ? s.form === 'link' : s.channel === req));
  if (wanted.length === 0) {
    const channels = [...new Set(all.map(s => s.channel))];
    throw new ExportError(`Delivery "${req}" is not supported by this host. Available: ${channels.join(', ')}, link.`);
  }
  const fitting = wanted.filter(s => size <= stepCap(s));
  if (fitting.length === 0) {
    const others = all.filter(s => !wanted.includes(s) && size <= stepCap(s));
    throw new ExportError(
      `The file is ${formatSize(size)}, over the limit for delivery "${req}" (${wanted.map(s => `${stepName(s)} ${formatSize(stepCap(s))}`).join(', ')}).` +
      (others.length ? ` Other available: ${[...new Set(others.map(s => s.channel))].join(', ')}.` : ' Try a smaller model or a more compact format (e.g. STL or GLB instead of OFF).'));
  }
  return fitting;
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
