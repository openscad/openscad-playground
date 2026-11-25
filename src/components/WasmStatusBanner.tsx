// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { probeRenderEngine, RenderEngineAvailability } from '../runner/wasm-support.ts';

const DISMISSED_KEY = 'openscad-wasm-banner-dismissed';

function readDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

// Probes the render engine available on this device and exposes it as
// `data-engine="wasm|wasm2js|none"` on <html>. Visible UI only when rendering is
// impossible:
//  - 'wasm':    nothing.
//  - 'wasm2js': the JS fallback build is deployed, so rendering still works
//               (slower); logged to the console only.
//  - 'none':    no fallback build is deployed: a dismissible error banner.
export default function WasmStatusBanner() {
  const [engine, setEngine] = useState<RenderEngineAvailability | undefined>();
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let cancelled = false;
    probeRenderEngine().then(e => {
      if (cancelled) return;
      document.documentElement.dataset.engine = e;
      if (e === 'wasm2js') {
        console.info('Running OpenSCAD in JavaScript compatibility mode (WebAssembly unavailable)');
      }
      setEngine(e);
    });
    return () => { cancelled = true; };
  }, []);

  if (engine !== 'none' || dismissed) {
    return null;
  }

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode etc. */ }
    setDismissed(true);
  };

  return (
    // Right padding keeps the message clear of the "Fork me on GitHub" ribbon.
    <div className="wasm-banner" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 150px 4px 8px' }}>
      <Message
        severity="error"
        text={'WebAssembly is disabled in this browser (e.g. iOS Lockdown Mode, a strict ' +
          'Content-Security-Policy, or an enterprise-locked browser), and no ' +
          'JavaScript fallback build is available on this site. You can still edit ' +
          'code, but models cannot be rendered here.'}
        style={{ width: '100%', justifyContent: 'flex-start' }}
      />
      <Button
        icon="pi pi-times"
        rounded
        text
        severity="danger"
        aria-label="Dismiss"
        onClick={dismiss}
      />
    </div>
  );
}
