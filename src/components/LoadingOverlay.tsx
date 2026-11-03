import { useEffect } from 'react';
import { ProgressBar } from 'primereact/progressbar';
import type { LoadingView } from '../state/loading-state.ts';

/**
 * Slim indeterminate bar across the top of the frame and a status line, while the MCP app waits for its input
 * and first render. Overlaid (fixed), so it never changes the layout/height of the frame. Theme tokens come
 * from the host; reduced motion gets a static bar.
 */
export default function LoadingOverlay({ view }: { view: LoadingView }) {
  // The whole page is busy while the bar is up.
  useEffect(() => {
    const root = document.getElementById('root');
    root?.setAttribute('aria-busy', String(view.showBar));
    return () => root?.removeAttribute('aria-busy');
  }, [view.showBar]);

  const isProblem = view.phase === 'error' || view.phase === 'cancelled' || view.phase === 'timeout';
  return (
    <div className="mcp-loading" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, pointerEvents: 'none' }}>
      <style>{`
        .mcp-loading .p-progressbar { height: 3px; background: var(--color-background-tertiary, rgba(127,127,127,0.2)); border-radius: 0; }
        .mcp-loading .p-progressbar .p-progressbar-value { background: var(--color-ring-primary, #6366f1); }
        @media (prefers-reduced-motion: reduce) {
          .mcp-loading .p-progressbar-indeterminate .p-progressbar-value { animation: none; width: 100%; left: 0; opacity: 0.55; }
        }
      `}</style>
      {view.showBar && <ProgressBar mode="indeterminate" style={{ height: '3px' }} aria-hidden="true" />}
      {/* Polite live region: announces each status change; problems are announced assertively. */}
      <div role={isProblem ? 'alert' : 'status'} aria-live={isProblem ? 'assertive' : 'polite'} style={{
        display: view.message ? 'block' : 'none',
        // Centered in the frame: the top corners belong to the toolbar and the hint.
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'max-content',
        maxWidth: 'calc(100% - 24px)',
        padding: '4px 12px',
        borderRadius: 'var(--border-radius-lg, 10px)',
        fontSize: 'var(--font-text-sm-size, 13px)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        textAlign: 'center',
        color: `var(--color-text-${isProblem ? 'primary' : 'secondary'}, inherit)`,
        background: 'var(--color-background-secondary, rgba(127,127,127,0.18))',
        border: `1px solid var(--color-border-${isProblem ? 'primary' : 'secondary'}, rgba(127,127,127,0.3))`,
      }}>
        {view.message}
        {view.hint && <div style={{ opacity: 0.8, fontSize: '12px', marginTop: 2 }}>{view.hint}</div>}
      </div>
    </div>
  );
}
