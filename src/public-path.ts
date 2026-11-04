// Must be the first import of the entry point (see index.tsx).
//
// Lazy chunks (N.index.js) are loaded relative to `__webpack_public_path__`, which webpack by default infers
// from the running script's URL. In the MCP app that is the server (the <script src> is absolute), but pin it
// to the configured base URL explicitly so chunks can never fall back to the host sandbox's origin
// (e.g. when a host re-injects or inlines the bootstrap script).
declare let __webpack_public_path__: string;

const meta = typeof document !== 'undefined' ? document.querySelector('meta[name="openscad-base-url"]') : null;
const base = meta?.getAttribute('content');
if (base) __webpack_public_path__ = base.endsWith('/') ? base : base + '/';
