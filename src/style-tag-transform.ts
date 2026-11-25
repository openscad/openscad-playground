// style-loader hook (see webpack.config.js): how CSS text is put into the <style> tags the bundle creates.
//
// css-loader runs with `url: false`, so `url(./fonts/...)` references stay as written in the CSS (Inter,
// PrimeIcons). In a normal page they resolve against the document, which is right. In the MCP app the document
// belongs to the host's sandbox (another origin than the one serving the assets), so they would 404 there:
// when a base URL is configured, rewrite them to absolute URLs on it.
import { getBaseUrl } from './resource-loader.ts';

const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s][^)\s]*))\s*\)/g;

/** Absolute URLs, protocol-relative ones, data:/blob: URIs and bare `#fragment`s (SVG references) are kept. */
const KEEP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export function rewriteCssUrls(css: string, base: string): string {
  if (!base) return css;
  return css.replace(CSS_URL, (whole, dq, sq, bare) => {
    const url: string = dq ?? sq ?? bare;
    if (KEEP.test(url)) return whole;
    return `url("${new URL(url, base).href}")`;
  });
}

export default function styleTagTransform(css: string, styleElement: HTMLStyleElement): void {
  const text = rewriteCssUrls(css, getBaseUrl());
  while (styleElement.firstChild) styleElement.removeChild(styleElement.firstChild);
  styleElement.appendChild(document.createTextNode(text));
}
