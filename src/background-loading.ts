// Work that is not needed for the first render and would only compete with it
// for bandwidth: installing the Service Worker (which precaches the app shell),
// then fetching the library archives and the engine through it so that they
// land in its runtime cache (offline use).

import { whenLibrariesMounted } from './fs/filesystem.ts';

async function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    console.log('ServiceWorker registration successful with scope: ', registration.scope);

    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      if (installingWorker) {
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Reload to activate the service worker and apply caching
            window.location.reload();
            return;
          }
        };
      }
    };

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

let started: Promise<void> | undefined;

/** Idempotent. Call once the first render is out of the way. */
export function startBackgroundLoading(): Promise<void> {
  return started ??= (async () => {
    await registerServiceWorker();
    await whenLibrariesMounted();
    if (navigator.serviceWorker?.controller) {
      // Served by the HTTP cache, ends up in the Service Worker's runtime cache.
      fetch('./openscad.wasm').catch(() => {});
    }
  })();
}
