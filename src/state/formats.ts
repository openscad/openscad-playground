
export const VALID_RENDER_FORMATS = {
  'stl': true,
  'off': true,
  // 'glb': true,
  'svg': true,
  'dxf': true,
};
export const VALID_EXPORT_FORMATS = {
  'stl': true,
  'off': true,
  '3mf': true,
  'svg': true,
  'dxf': true,
};

export function is2DFormatExtension(ext: string) {
  return ext === 'svg' || ext === 'dxf';
}

const supportedImportExtensions = new Set([
  'stl',
  'off',
  'dxf',
  'nef3',
  '3mf',
  'amf',
  'svg',
  'obj',
]);

export function isSupportedImportExtension(ext: string) {
  return supportedImportExtensions.has(ext);
}