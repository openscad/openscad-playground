export type LabColor = { l: number, a: number, b: number };
export type RGBColor = { r: number, g: number, b: number }

export function parseColors(input: string): RGBColor[] {
  const colorStrings = input.split(/[\n,\s]+/).filter(Boolean);
  return colorStrings.map((colorString, index) => {
      if (!colorString.startsWith('#')) {
          const tempElement = document.createElement('div');
          tempElement.style.color = colorString;
          document.body.appendChild(tempElement);
          const computedColor = getComputedStyle(tempElement).color;
          if (computedColor == null)  {
              throw new Error('Invalid color: ' + colorString);
          }
          document.body.removeChild(tempElement);

          colorString = '#' + computedColor.match(/\d+/g)!.map(Number);
      }
      return hexToRgb(colorString);
  });
}

export function hexToRgb(hex: string): RGBColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})(?:[a-f\d]{2})?$/i.exec(hex);
  if (!result) throw new Error('Invalid hex color: ' + hex);
  return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  };
}

export function rgbToLab(rgb: RGBColor) {
  let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
  return {
      l: (116 * y) - 16,
      a: 500 * (x - y),
      b: 200 * (y - z)
  };
}

export function deltaE(lab1: LabColor, lab2: LabColor) {
  const deltaL = lab1.l - lab2.l;
  const deltaA = lab1.a - lab2.a;
  const deltaB = lab1.b - lab2.b;
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
}

export function findClosestColor(targetColor: LabColor, colors: LabColor[]) : number {
  let closestIndex = 0;
  let closestColor = colors[closestIndex];
  let minDelta = Infinity;
  colors.forEach((color, index) => {
      const delta = deltaE(targetColor, color);
      if (delta < minDelta) {
          minDelta = delta;
          closestColor = color;
          closestIndex = index;
      }
  });
  return closestIndex;
}
