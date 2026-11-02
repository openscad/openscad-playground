/**
 * Embed layout: the 3D viewer filling the frame, a small floating customizer
 * button (only when the file has customizer parameters) that toggles the
 * customizer as an overlay on top of the viewer, and a corner toolbar.
 *
 * Shared by the standalone web app (when framed or ?embed=1) and the MCP app,
 * which is just an iframed instance. The overlay state lives in the model
 * (state.view.customizerOverlay) so tools and the UI stay in sync.
 */

import React, { CSSProperties, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { ProgressBar } from 'primereact/progressbar';
import { ModelContext } from './contexts.ts';
import ViewerPanel, { ViewerPanelHandle } from './ViewerPanel.tsx';
import CustomizerPanel from './CustomizerPanel.tsx';

export interface EmbedViewProps {
  viewerRef: React.Ref<ViewerPanelHandle>;
  isDark: boolean;
  /** Inline (non-fullscreen) viewers disable plain wheel zoom so the page can scroll. */
  disableZoom?: boolean;
  showHint?: boolean;
  onCameraChange?: () => void;
  /** Present only where fullscreen is supported (host display mode or the Fullscreen API). */
  fullscreen?: { active: boolean; toggle: () => void };
  /** Extra corner buttons, rendered before the built-in ones. */
  toolbar?: ReactNode;
  /**
   * Escape hatch to the full UI, always present (files without customizer
   * parameters have no overlay button). Either switches in place (`onClick`) or
   * is a link opening the full app in a new tab (`href`, evaluated on click).
   */
  exit: ExitAction;
}

export interface ExitAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: () => string;
}

export default function EmbedView({ viewerRef, isDark, disableZoom, showHint, onCameraChange, fullscreen, toolbar, exit }: EmbedViewProps) {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const state = model.state;

  const params = state.parameterSet?.parameters ?? [];
  const hasParams = params.length > 0;
  const showCustomizer = !!state.view.customizerOverlay && hasParams;
  const setShowCustomizer = useCallback((open: boolean) => {
    model.mutate(s => s.view.customizerOverlay = open);
  }, [model]);
  const changedParamCount = params.filter(p => {
    const v = state.params.vars?.[p.name];
    return v !== undefined && JSON.stringify(v) !== JSON.stringify(p.initial);
  }).length;

  const panelId = useId();
  const customizerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Non-modal side sheet: Escape closes it (focus returns to the toggle); a click outside closes it only on
  // small screens, where it covers most of the viewer. On desktop the model stays interactive behind it.
  useEffect(() => {
    if (!showCustomizer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setShowCustomizer(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!window.matchMedia('(max-width: 600px)').matches) return;
      const t = e.target as Node;
      if (customizerRef.current?.contains(t) || toolbarRef.current?.contains(t)) return;
      // PrimeReact dropdown panels render in a portal outside the panel.
      if ((t as HTMLElement).closest?.('.p-dropdown-panel, .p-overlay')) return;
      setShowCustomizer(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [showCustomizer, setShowCustomizer]);

  const toolbarRef = useRef<HTMLDivElement>(null);

  // Copy the active file's OpenSCAD source.
  const [copyNote, setCopyNote] = useState<string>('');
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const copySource = useCallback(async () => {
    const source = model.source;
    const files = model.state.params.sources.length;
    const name = model.state.params.activePath.split('/').pop() || model.state.params.activePath;
    try {
      await navigator.clipboard.writeText(source);
      setCopyFallback(null);
      setCopyNote(`Copied ${name}${files > 1 ? ` (active file of ${files})` : ''}`);
      setTimeout(() => setCopyNote(''), 2500);
    } catch (e) {
      console.warn('Clipboard write failed, showing the source for manual copy:', e);
      setCopyFallback(source);
    }
  }, [model]);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (copyFallback != null) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [copyFallback]);

  const busy = state.rendering || state.previewing || state.checkingSyntax;
  const isFullscreen = !!fullscreen?.active;

  return (
    <div className="mcp-viewer-container" style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      position: 'relative',
      height: '100%',
      overflow: 'hidden',
    }}>
      <style>{`
              .embed-panel {
                --embed-bg: var(--color-background-secondary, #ffffff);
                background: var(--embed-bg);
                animation: embed-slide-in 0.2s ease-out;
              }
              .embed-panel.embed-dark { --embed-bg: var(--color-background-secondary, #1e1e1e); }
              /* Translucent glass where supported; the model stays visible behind. */
              @supports (background: color-mix(in srgb, red 50%, transparent)) and (backdrop-filter: blur(1px)) {
                .embed-panel {
                  background: color-mix(in srgb, var(--embed-bg) 78%, transparent);
                  -webkit-backdrop-filter: blur(14px) saturate(1.2);
                  backdrop-filter: blur(14px) saturate(1.2);
                }
              }
              @media (forced-colors: active) {
                .embed-panel { background: Canvas; backdrop-filter: none; border: 1px solid CanvasText !important; }
              }
              @media (prefers-reduced-motion: reduce) { .embed-panel { animation: none; } }
              @keyframes embed-slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: none; opacity: 1; } }
              @media (max-width: 520px) { .embed-hint { display: none; } }
              .mcp-toolbar:hover, .mcp-toolbar:focus-within { opacity: 1 !important; }
              .mcp-dark .p-inputtext, .mcp-dark .p-dropdown, .mcp-dark .p-inputnumber-input,
              .mcp-dark .p-checkbox .p-checkbox-box, .mcp-dark .p-inputnumber-button {
                background: var(--color-background-tertiary, rgba(255,255,255,0.1)) !important;
                color: var(--color-text-primary, #e0e0e0) !important;
                border-color: var(--color-border-secondary, rgba(255,255,255,0.2)) !important;
              }
              .mcp-dark .p-dropdown-panel {
                background: var(--color-background-secondary, #2a2a2a) !important;
                color: var(--color-text-primary, #e0e0e0) !important;
              }
              .mcp-dark .p-dropdown-item:hover { background: var(--color-background-ghost, rgba(255,255,255,0.1)) !important; }
              .mcp-dark .p-slider { background: var(--color-background-tertiary, rgba(255,255,255,0.2)) !important; }
              .mcp-dark .p-slider .p-slider-range, .mcp-dark .p-slider .p-slider-handle {
                background: var(--color-ring-primary, #6366f1) !important;
                border-color: var(--color-ring-primary, #6366f1) !important;
              }
              .mcp-dark .p-fieldset, .mcp-dark .p-fieldset-legend {
                border-color: var(--color-border-secondary, rgba(255,255,255,0.15)) !important;
                color: var(--color-text-primary, #e0e0e0) !important;
              }
              .mcp-dark .p-fieldset-legend {
                background: var(--color-background-tertiary, rgba(50, 50, 50, 0.95)) !important;
              }
              .mcp-dark .p-fieldset-legend > a,
              .mcp-dark .p-fieldset-legend > span {
                color: var(--color-text-primary, #e0e0e0) !important;
              }
            `}</style>
      {/* Viewer (full size): never resized by the overlay */}
      <ViewerPanel ref={viewerRef} style={{ flex: 1 }} disableZoom={disableZoom} onCameraChange={onCameraChange} />

      {/* Progress bar */}
      <ProgressBar mode="indeterminate"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          visibility: busy ? 'visible' : 'hidden',
          height: '4px',
          zIndex: 100,
        }} />

      {/* Customizer: translucent side sheet docked on the right, below the toolbar */}
      {showCustomizer && (
        <aside
          ref={customizerRef}
          id={panelId}
          role="complementary"
          aria-label="Customizer"
          className={`embed-panel ${isDark ? 'mcp-dark embed-dark' : ''}`}
          style={{
            position: 'absolute',
            top: 52,
            right: 0,
            bottom: 0,
            width: 'min(360px, 85vw)',
            borderLeft: `var(--border-width-regular, 1px) solid var(--color-border-primary, ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)'})`,
            borderTopLeftRadius: 'var(--border-radius-lg, 10px)',
            boxShadow: `var(--shadow-lg, ${isDark ? '-4px 0 20px rgba(0,0,0,0.45)' : '-4px 0 20px rgba(0,0,0,0.15)'})`,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 50,
            color: `var(--color-text-primary, ${isDark ? '#e0e0e0' : '#333'})`,
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
          }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            borderBottom: `1px solid var(--color-border-secondary, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'})`,
          }}>
            <strong style={{ fontSize: 'var(--font-text-sm-size, 13px)' }}>Customizer</strong>
            <button
              type="button"
              onClick={() => { setShowCustomizer(false); buttonRef.current?.focus(); }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                color: 'inherit',
                lineHeight: 1,
              }}
              title="Close"
              aria-label="Close customizer"
            >&times;</button>
          </div>
          <CustomizerPanel dark={isDark} style={{
            maxHeight: 'unset',
            overflow: 'auto',
            flex: 1,
          }} />
        </aside>
      )}

      {/* Zoom hint (inline mode only) */}
            {showHint && (
              <div className="embed-hint" style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                zIndex: 60,
                fontSize: '11px',
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                lineHeight: 1.4,
                fontFamily: 'var(--font-sans, system-ui, sans-serif)',
              }}>
                {(() => {
                  const kbdStyle: CSSProperties = {
                    padding: '1px 4px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                    borderRadius: '3px',
                    fontSize: '10px',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
                  };
                  return <>
                    <kbd style={kbdStyle}>Shift</kbd>{'+scroll · '}
                    <kbd style={kbdStyle}>+</kbd>{' / '}<kbd style={kbdStyle}>-</kbd>{' zoom · '}
                    <kbd style={kbdStyle}>Alt</kbd>{'+'}<kbd style={kbdStyle}>Enter</kbd>{' fullscreen'}
                  </>;
                })()}
              </div>
            )}

      {/* The one toolbar, top-right: everything the embed UI offers */}
      <div ref={toolbarRef} className="mcp-toolbar" role="toolbar" aria-label="Viewer actions" style={{
        position: 'absolute',
        top: '8px',
        right: '8px',
        display: 'flex',
        gap: '4px',
        zIndex: 60,
        // Subtle but visible at rest (touch screens have no hover); full opacity on hover/focus/open.
        opacity: showCustomizer ? 1 : 0.55,
        transition: 'opacity 0.2s ease',
      }}>
        {hasParams && (
          <CornerButton
            icon={EmbedIcons.sliders}
            label="Customize"
            active={showCustomizer}
            badge={changedParamCount || undefined}
            ariaExpanded={showCustomizer}
            ariaControls={showCustomizer ? panelId : undefined}
            buttonRef={buttonRef}
            onClick={() => setShowCustomizer(!showCustomizer)}
          />
        )}
        <CornerButton icon={EmbedIcons.copy} label="Copy source" onClick={copySource} />
        {toolbar}
        {fullscreen && (
          <CornerButton
            icon={isFullscreen ? EmbedIcons.minimize : EmbedIcons.maximize}
            label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            onClick={fullscreen.toggle}
          />
        )}
        <CornerButton icon={exit.icon} label={exit.label} onClick={exit.onClick} href={exit.href} />
      </div>

      {/* Copy confirmation (announced to screen readers) */}
      <div role="status" aria-live="polite" style={{
        position: 'absolute',
        top: 52,
        right: 8,
        zIndex: 70,
        pointerEvents: 'none',
        padding: copyNote ? '4px 10px' : 0,
        borderRadius: '6px',
        fontSize: '12px',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        color: '#fff',
        backgroundColor: 'rgba(0,0,0,0.75)',
        opacity: copyNote ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}>{copyNote}</div>

      {/* Fallback when the clipboard is unavailable: the source, selected, for manual copy */}
      {copyFallback != null && (
        <div role="dialog" aria-label="Copy source" style={{
          position: 'absolute', top: 52, right: 8, left: 8, maxWidth: 420, marginLeft: 'auto', zIndex: 80,
          padding: 8, borderRadius: 8, background: isDark ? '#222' : '#fff', color: isDark ? '#eee' : '#222',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontSize: 12, fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Clipboard unavailable: copy the source below (Ctrl/Cmd+C)</span>
            <button type="button" aria-label="Close" onClick={() => setCopyFallback(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>&times;</button>
          </div>
          <textarea ref={fallbackRef} readOnly value={copyFallback}
            style={{ width: '100%', height: 140, boxSizing: 'border-box', fontFamily: 'monospace', fontSize: 11 }} />
        </div>
      )}
    </div>
  );
}

// Inline SVG icons (no font dependency — works in sandboxed iframes)
const SVG = ({ children, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);
export const EmbedIcons = {
  sliders: <SVG><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></SVG>,
  maximize: <SVG><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></SVG>,
  minimize: <SVG><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></SVG>,
  copy: <SVG><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></SVG>,
  check: <SVG><polyline points="20 6 9 17 4 12" /></SVG>,
  layout: <SVG><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /></SVG>,
  externalLink: <SVG><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></SVG>,
};

export function CornerButton({
  icon,
  label,
  active,
  badge,
  onClick,
  ariaExpanded,
  ariaControls,
  buttonRef,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  /** Render a link opening this URL (evaluated at click time) in a new tab. */
  href?: () => string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const [hovered, setHovered] = useState(false);
  const Tag: any = href ? 'a' : 'button';
  const tagProps = href
    ? { href: href(), target: '_blank', rel: 'noopener', onClick: (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.href = href(); } }
    : { ref: buttonRef, type: 'button', onClick };
  return (
    <Tag
      {...tagProps}
      title={label}
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        textDecoration: 'none',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        border: 'none',
        backgroundColor: active
          ? 'rgba(79, 70, 229, 0.85)'
          : hovered ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
        cursor: 'pointer',
        color: 'white',
        transition: 'background 0.15s ease',
      }}
    >
      {icon}
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          minWidth: '16px',
          height: '16px',
          borderRadius: '8px',
          backgroundColor: '#ef4444',
          color: 'white',
          fontSize: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 3px',
          lineHeight: 1,
        }}>{badge}</span>
      )}
    </Tag>
  );
}

