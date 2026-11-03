// Work that is not needed for the first render and would only compete with it
// for bandwidth: installing the Service Worker, then copying what the page has
// loaded into its caches (offline use) and fetching the library archives through it.

import { isMcpMode } from './state/mcp-mode.ts';

function reloadWhenHidden() {
  const reloadIfHidden = () => {
    if (document.visibilityState === 'hidden') {
      document.removeEventListener('visibilitychange', reloadIfHidden);
      window.location.reload();
    }
  };
  document.addEventListener('visibilitychange', reloadIfHidden);
  reloadIfHidden();
}

async function registerServiceWorker() {
  // (Not in the MCP app: it runs in a host's sandboxed iframe, on another origin than its assets.)
  if (process.env.NODE_ENV !== 'production' || isMcpMode() || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    if (navigator.serviceWorker.controller) {
      // A new version was deployed if another Service Worker takes over this page. It then controls the
      // page (skipWaiting) while the page still runs the old code: pick the new one up when the user
      // can't notice, never in the middle of their session (it'd throw away the render in flight and
      // reset the viewer).
      navigator.serviceWorker.addEventListener('controllerchange', reloadWhenHidden, {once: true});
    }
    const registration = await navigator.serviceWorker.register('./sw.js');
    console.log('ServiceWorker registration successful with scope: ', registration.scope);

    // Wait for it to take control of this page, so that what we fetch next is cached.
    await Promise.race([
      navigator.serviceWorker.ready.then(() => new Promise<void>(resolve => {
        if (navigator.serviceWorker.controller) return resolve();
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true});
      })),
      new Promise(resolve => setTimeout(resolve, 10000)),
    ]);
  } catch (err) {
    console.log('ServiceWorker registration failed: ', err);
  }
}

/** Archives the render workers used before the Service Worker took control (see runner). */
const usedArchives = new Set<string>();
export function noteUsedArchives(names: string[]) {
  names.forEach(n => usedArchives.add(n));
}

/**
 * The Service Worker has no precache: what the page loaded before it took control
 * (the shell, the engine, what the workers fetched) wasn't seen by its runtime caching
 * rules. Fetch it all again through the Service Worker: the HTTP cache serves it (at
 * worst with a revalidation), and the runtime caches store it.
 */
async function warmServiceWorkerCaches() {
  const urls = new Set<string>([
    location.href.split('#')[0],
    './openscad.wasm',
    './browserfs.min.js',
    './libraries/index.json',
    ...[...usedArchives].map(n => `./libraries/${n}.zip`),
  ]);
  for (const entry of performance.getEntriesByType('resource')) {
    if (/^https?:/.test(entry.name)) urls.add(entry.name);
  }
  await Promise.all([...urls].map(url => {
    const sameOrigin = new URL(url, location.href).origin === location.origin;
    // force-cache: use the HTTP cache without revalidating (no request at all if it has the file).
    return fetch(url, sameOrigin ? {cache: 'force-cache'} : {mode: 'no-cors', cache: 'force-cache'}).then(r => r.body?.cancel(), () => {});
  }));
}

/** Whether the user asked to save data, or is on a slow connection: nothing optional is fetched then. */
export function isDataConstrained(): boolean {
  const connection = (navigator as any).connection;
  return !!connection && (connection.saveData === true || ['slow-2g', '2g', '3g'].includes(connection.effectiveType));
}

let started: Promise<void> | undefined;

/** Idempotent. Call once the first render is out of the way. */
export function startBackgroundLoading(): Promise<void> {
  return started ??= (async () => {
    if (isDataConstrained()) {
      // (Libraries are still fetched when something needs them, and the picker / completions start the mount.)
      return;
    }
    // Let the first render's model load and paint before anything else uses the network,
    // and wait for the main thread to be idle.
    await new Promise(resolve => setTimeout(resolve, 1000));
    await new Promise<void>(resolve => 'requestIdleCallback' in window
      ? window.requestIdleCallback(() => resolve(), {timeout: 5000})
      : setTimeout(resolve, 0));
    await registerServiceWorker();
    if (navigator.serviceWorker?.controller) {
      await warmServiceWorkerCaches();
    }
  })();
}
