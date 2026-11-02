// Portions of this file are Copyright 2021 Google LLC, and licensed under GPL2+. See COPYING.

import React, { useEffect, useState } from 'react';
import { Message } from 'primereact/message';
import { probeRenderEngine, RenderEngineAvailability } from '../runner/wasm-support.ts';

// Shown only when WebAssembly is unavailable on this device:
//  - 'wasm2js': the JS fallback build is deployed, so rendering still works
//               (much slower) — an informational notice.
//  - 'none':    no fallback build is deployed — rendering is unavailable.
// When WASM works ('wasm'), this renders nothing.
export default function WasmStatusBanner() {
  const [engine, setEngine] = useState<RenderEngineAvailability | undefined>();

  useEffect(() => {
    let cancelled = false;
    probeRenderEngine().then(e => {
      if (!cancelled) setEngine(e);
    });
    return () => { cancelled = true; };
  }, []);

  if (!engine || engine === 'wasm') {
    return null;
  }

  const compat = engine === 'wasm2js';
  const text = compat
    ? 'WebAssembly is disabled in this browser — OpenSCAD is running in ' +
      'JavaScript compatibility mode, which is significantly slower. Rendering ' +
      'complex models may take a while.'
    : 'WebAssembly is disabled in this browser (e.g. iOS Lockdown Mode, a strict ' +
      'Content-Security-Policy, or an enterprise-locked browser), and no ' +
      'JavaScript fallback build is available on this site. You can still edit ' +
      'code, but models cannot be rendered here.';

  return (
    // Right padding keeps the message clear of the "Fork me on GitHub" ribbon.
    <div style={{ display: 'flex', padding: '4px 150px 4px 8px' }}>
      <Message
        severity={compat ? 'warn' : 'error'}
        text={text}
        style={{ width: '100%', justifyContent: 'flex-start' }}
      />
    </div>
  );
}
