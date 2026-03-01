/**
 * MCP App mode: minimal UI with viewer, customizer overlay, and toolbar.
 *
 * The App (created in index.tsx) registers the `interact` tool with the
 * host before connecting; this component installs the processor those tool
 * handlers delegate to, and reports passive state changes back to the model
 * via updateModelContext.
 */

import React, { CSSProperties, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { State, StatePersister } from '../state/app-state.ts';
import { Model } from '../state/model.ts';
import ViewerPanel, { ViewerPanelHandle } from './ViewerPanel.tsx';
import CustomizerPanel from './CustomizerPanel.tsx';
import { ModelContext, FSContext, McpContext } from './contexts.ts';
import {
  OpenSCADCommand,
  McpToolProcessor,
  ToolEventBuffer,
  ToolInputParams,
  ToolResultParams,
  setActiveProcessor,
  publishModelContext,
  applyHostStyles,
} from '../state/mcp-app.ts';
import { PREDEFINED_ORBITS } from './ViewerPanel.tsx';
import { encodeStateParamsAsFragment } from '../state/fragment-state.ts';
import { ProgressBar } from 'primereact/progressbar';

export function McpApp({
  initialState,
  statePersister,
  fs,
  app,
  toolEvents,
}: {
  initialState: State;
  statePersister: StatePersister;
  fs: FS;
  app: App;
  toolEvents: ToolEventBuffer;
}) {
  const [state, setState] = useState(initialState);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const model = new Model(fs, state, setState, statePersister);
  const viewerRef = useRef<ViewerPanelHandle>(null);
  const updateContextRef = useRef<(() => Promise<void>) | null>(null);
  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced context update — at most once per second
  const scheduleContextUpdate = useCallback(() => {
    if (contextTimerRef.current) return; // already scheduled
    contextTimerRef.current = setTimeout(async () => {
      contextTimerRef.current = null;
      try {
        await updateContextRef.current?.();
      } catch (e) {
        console.warn('Auto context update failed:', e);
      }
    }, 1000);
  }, []);

  // Theme detection: prefer hostContext, fall back to media query
  const [isDark, setIsDark] = useState(() => {
    const ctx = app.getHostContext();
    if (ctx?.theme === 'light') return false;
    if (ctx?.theme === 'dark') return true;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  // Draggable customizer panel
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const customizerRef = useRef<HTMLDivElement>(null);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const panel = customizerRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const parentRect = (panel.offsetParent as HTMLElement)?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const curX = rect.left - parentRect.left;
    const curY = rect.top - parentRect.top;
    const startX = e.clientX, startY = e.clientY;

    const onMove = (me: MouseEvent) => {
      setPanelPos({
        x: Math.max(0, curX + me.clientX - startX),
        y: Math.max(0, curY + me.clientY - startY),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => model.init());

  // Always act on the latest model/viewer — tool handlers and buffered-event
  // replay outlive any single render's closures.
  const modelRef = useRef(model);
  modelRef.current = model;

  const applySource = useCallback((source: string) => {
    const m = modelRef.current;
    m.mutate(s => {
      s.params.sources = s.params.sources.map(src =>
        src.path === s.params.activePath ? { path: src.path, content: source } : src
      );
    });
    // Trigger syntax check and preview
    m.source = source;
  }, []);

  const applyCameraPreset = useCallback((view: string) => {
    const preset = PREDEFINED_ORBITS.find(
      ([name]) => name.toLowerCase() === view.toLowerCase()
    );
    if (preset) {
      viewerRef.current?.setCameraOrbit(preset[1], preset[2]);
    }
  }, []);

  // Apply the create tool's input (early: streamed before the result).
  const applyToolInput = useCallback((params: ToolInputParams) => {
    const args = params.arguments ?? {};
    if (args.source && typeof args.source === 'string') {
      applySource(args.source);
    }
    if (args.vars && typeof args.vars === 'object') {
      for (const [name, value] of Object.entries(args.vars as Record<string, unknown>)) {
        modelRef.current.setVar(name, value);
      }
    }
  }, [applySource]);

  // Apply the create tool's result — authoritative: carries the server-side
  // defaults (e.g. the demo source and camera preset when the model passed
  // no arguments).
  const applyToolResult = useCallback((params: ToolResultParams) => {
    const sc = params.structuredContent as Record<string, unknown> | undefined;
    if (!sc || typeof sc !== 'object') return;
    if (typeof sc.source === 'string' && sc.source !== modelRef.current.source) {
      applySource(sc.source);
    }
    if (sc.vars && typeof sc.vars === 'object') {
      for (const [name, value] of Object.entries(sc.vars as Record<string, unknown>)) {
        // Skip values already applied from the tool-input notification —
        // each setVar schedules a preview render.
        const current = modelRef.current.state.params.vars?.[name];
        if (JSON.stringify(current) !== JSON.stringify(value)) {
          modelRef.current.setVar(name, value);
        }
      }
    }
    if (typeof sc.camera === 'string') {
      applyCameraPreset(sc.camera);
    }
  }, [applySource, applyCameraPreset]);

  // Replay events buffered before mount, then take over the handlers.
  useEffect(() => {
    for (const params of toolEvents.inputs.splice(0)) applyToolInput(params);
    for (const params of toolEvents.results.splice(0)) applyToolResult(params);
    app.ontoolinput = applyToolInput;
    app.ontoolresult = applyToolResult;
  }, [app, toolEvents, applyToolInput, applyToolResult]);

  // Install the processor that the view-registered `interact` tool delegates to
  useEffect(() => {
    const processor: McpToolProcessor = {
      async processCommand(command: OpenSCADCommand): Promise<unknown> {
        const model = modelRef.current;
        switch (command.type) {
          case 'write_source': {
            applySource(command.content as string);
            return { timedOut: !(await waitForIdle(modelRef.current, 5000)) };
          }
          case 'edit_source': {
            const oldText = command.old_text as string;
            const newText = command.new_text as string;
            const current = model.source;
            if (!current.includes(oldText)) {
              return { notFound: true }; // caller reports "old_text not found"
            }
            // Replacement callback: a literal new_text must not have its
            // $-sequences ($$, $&, …) interpreted by String.replace.
            applySource(current.replace(oldText, () => newText));
            return { timedOut: !(await waitForIdle(modelRef.current, 5000)) };
          }
          case 'set_camera': {
            const { view, theta, phi } = command as any;
            if (typeof view === 'string') {
              applyCameraPreset(view);
            } else if (typeof theta === 'number' && typeof phi === 'number') {
              viewerRef.current?.setCameraOrbit(theta, phi);
            }
            return;
          }
          case 'set_var': {
            const { name, value } = command as any;
            model.setVar(name as string, value);
            return { timedOut: !(await waitForIdle(modelRef.current, 10000)) };
          }
          case 'set_vars': {
            const vars = (command as any).vars as Record<string, unknown>;
            for (const [name, value] of Object.entries(vars)) {
              model.mutate(s => s.params.vars = { ...s.params.vars ?? {}, [name]: value });
            }
            // Trigger single preview render
            model.render({ isPreview: true, now: false });
            return { timedOut: !(await waitForIdle(modelRef.current, 10000)) };
          }
          case 'render': {
            model.render({ isPreview: false, now: true });
            return { timedOut: !(await waitForIdle(modelRef.current, 30000)) };
          }
          case 'zoom': {
            const factor = (command as any).factor as number;
            viewerRef.current?.zoom(factor);
            return;
          }
          case 'auto_fit': {
            viewerRef.current?.autoFit();
            return;
          }
          case 'get_screenshot': {
            const screenshot = await viewerRef.current?.captureScreenshot();
            return { screenshot: screenshot ?? null };
          }
          case 'get_state': {
            await waitForIdle(modelRef.current, 5000);
            return processor.getContextState();
          }
        }
      },

      async captureScreenshot(): Promise<string | null> {
        return viewerRef.current?.captureScreenshot() ?? null;
      },

      getContextState(): Record<string, unknown> {
        const model = modelRef.current;
        const s = model.state;
        const cam = viewerRef.current?.getCameraInfo();
        return {
          source: model.source,
          errors: s.lastCheckerRun?.markers
            ?.filter(m => m.severity === 8) // MarkerSeverity.Error
            .map(m => ({ line: m.startLineNumber, message: m.message })) ?? [],
          warnings: s.lastCheckerRun?.markers
            ?.filter(m => m.severity === 4) // MarkerSeverity.Warning
            .map(m => ({ line: m.startLineNumber, message: m.message })) ?? [],
          customizerParams: s.parameterSet?.parameters?.map(p => ({
            name: p.name,
            type: p.type,
            group: p.group,
            caption: p.caption,
            initial: p.initial,
            currentValue: s.params.vars?.[p.name] ?? p.initial,
            ...('min' in p ? { min: p.min, max: p.max, step: p.step } : {}),
            ...('options' in p && p.options ? { options: p.options } : {}),
          })) ?? [],
          camera: cam ? { theta: cam.theta, phi: cam.phi, view: cam.closestView } : null,
          is2D: s.is2D,
          rendering: s.rendering || s.previewing,
        };
      },
    };

    setActiveProcessor(processor);
    updateContextRef.current = () => publishModelContext(app, processor);
    return () => {
      setActiveProcessor(null);
      updateContextRef.current = null;
    };
  }, [app, applySource, applyCameraPreset]);

  // Auto-update model context when source, vars, or rendering status change
  const sourceContent = state.params.sources.find(s => s.path === state.params.activePath)?.content;
  const varsJson = JSON.stringify(state.params.vars ?? {});
  const isIdle = !state.rendering && !state.previewing && !state.checkingSyntax;
  useEffect(() => {
    scheduleContextUpdate();
  }, [sourceContent, varsJson, isIdle, scheduleContextUpdate]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (contextTimerRef.current) {
        clearTimeout(contextTimerRef.current);
        contextTimerRef.current = null;
      }
    };
  }, []);

  // Apply host styles and listen for changes
  useEffect(() => {
    // Apply initial host styles
    applyHostStyles(app.getHostContext());

    // Listen for host context changes (theme, CSS variables, fonts)
    app.onhostcontextchanged = () => {
      const newCtx = app.getHostContext();
      applyHostStyles(newCtx);
      if (newCtx?.theme === 'light') setIsDark(false);
      else if (newCtx?.theme === 'dark') setIsDark(true);
    };

    // Fallback: listen for OS dark mode changes
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (mq) {
      const handler = (e: MediaQueryListEvent) => {
        // Only use media query if host hasn't set a theme
        if (!app.getHostContext()?.theme) setIsDark(e.matches);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [app]);

  const params = state.parameterSet?.parameters ?? [];
  const hasParams = params.length > 0;
  const changedParamCount = params.filter(p => {
    const v = state.params.vars?.[p.name];
    return v !== undefined && JSON.stringify(v) !== JSON.stringify(p.initial);
  }).length;

  const openInBrowser = useCallback(async () => {
    const fragment = await encodeStateParamsAsFragment(state);
    const url = `https://ochafik.com/openscad2/#${fragment}`;
    app.openLink({ url }).catch(e => console.warn('openLink failed:', e));
  }, [state, app]);

  const toggleFullscreen = useCallback(() => {
    const newMode = isFullscreen ? 'inline' : 'fullscreen';
    app.requestDisplayMode({ mode: newMode })
      // Track the mode the host actually granted (it may deny fullscreen).
      .then(result => setIsFullscreen(result.mode === 'fullscreen'))
      .catch(e => console.warn('requestDisplayMode failed:', e));
  }, [isFullscreen, app]);

  // Keyboard shortcuts: +/- zoom, Alt+Enter fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        viewerRef.current?.zoom(0.9);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        viewerRef.current?.zoom(1.1);
      } else if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewerRef, toggleFullscreen]);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const copyToClipboard = useCallback(async () => {
    try {
      const screenshot = await viewerRef.current?.captureScreenshot();
      const source = model.source;

      // Build markdown
      let md = '';
      if (screenshot) md += `![OpenSCAD Render](${screenshot})\n\n`;
      md += '```scad\n' + source + '\n```';

      // Build HTML (complete fragment so paste targets recognize structure)
      const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      let html = '<html><body>';
      if (screenshot) html += `<p><img src="${screenshot}" alt="OpenSCAD Render" /></p>`;
      html += `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto"><code class="language-scad">${escaped}</code></pre>`;
      html += '</body></html>';

      // Write both MIME types to clipboard
      const item = new ClipboardItem({
        'text/plain': new Blob([md], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);

      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  }, [model, viewerRef]);

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        <McpContext.Provider value={app}>
          <div className="mcp-viewer-container" style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            position: 'relative',
            height: '100%',
            overflow: 'hidden',
          }}>
            <style>{`
              .mcp-viewer-container:hover .mcp-toolbar { opacity: 0.8 !important; }
              .mcp-toolbar:hover { opacity: 1 !important; }
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
            {/* Viewer (full size) */}
            <ViewerPanel ref={viewerRef} style={{ flex: 1 }} disableZoom={!isFullscreen} onCameraChange={scheduleContextUpdate} />

            {/* Progress bar */}
            <ProgressBar mode="indeterminate"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                visibility: state.rendering || state.previewing || state.checkingSyntax
                  ? 'visible' : 'hidden',
                height: '4px',
                zIndex: 100,
              }} />

            {/* Customizer floating panel */}
            {hasParams && showCustomizer && (
              <div
                ref={customizerRef}
                className={isDark ? 'mcp-dark' : ''}
                style={{
                  position: 'absolute',
                  ...(panelPos ? { left: panelPos.x, top: panelPos.y } : { right: 8, top: 48 }),
                  width: '300px',
                  maxWidth: 'calc(100% - 16px)',
                  maxHeight: isFullscreen ? 'calc(100vh - 100px)' : 'calc(100% - 60px)',
                  backgroundColor: `var(--color-background-secondary, ${isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)'})`,
                  backdropFilter: 'blur(12px)',
                  borderRadius: 'var(--border-radius-lg, 10px)',
                  border: `var(--border-width-regular, 1px) solid var(--color-border-primary, ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'})`,
                  boxShadow: `var(--shadow-lg, ${isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.15)'})`,
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 50,
                  color: `var(--color-text-primary, ${isDark ? '#e0e0e0' : '#333'})`,
                  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
                }}>
                {/* Drag handle */}
                <div
                  onMouseDown={onDragStart}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    cursor: 'grab',
                    borderBottom: `1px solid var(--color-border-secondary, ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'})`,
                    borderRadius: 'var(--border-radius-lg, 10px) var(--border-radius-lg, 10px) 0 0',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    userSelect: 'none',
                  }}>
                  <strong style={{ fontSize: 'var(--font-text-sm-size, 13px)' }}>Customizer</strong>
                  <button
                    onClick={() => setShowCustomizer(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '16px',
                      cursor: 'pointer',
                      padding: '2px 6px',
                      color: `var(--color-text-secondary, ${isDark ? '#aaa' : '#666'})`,
                      lineHeight: 1,
                    }}
                    title="Close"
                  >&times;</button>
                </div>
                <CustomizerPanel dark={isDark} style={{
                  maxHeight: 'unset',
                  overflow: 'auto',
                  flex: 1,
                }} />
              </div>
            )}

            {/* Zoom hint (inline mode only) */}
            {!isFullscreen && (
              <div style={{
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

            {/* Corner toolbar */}
            <div className="mcp-toolbar" style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              display: 'flex',
              gap: '4px',
              zIndex: 60,
              opacity: 0,
              transition: 'opacity 0.2s ease',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              {hasParams && (
                <CornerButton
                  icon={McpIcons.sliders}
                  label="Customize"
                  active={showCustomizer}
                  badge={changedParamCount || undefined}
                  onClick={() => setShowCustomizer(!showCustomizer)}
                />
              )}
              <CornerButton
                icon={copyStatus === 'copied' ? McpIcons.check : McpIcons.copy}
                label={copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                onClick={copyToClipboard}
              />
              <CornerButton
                icon={McpIcons.externalLink}
                label="Open in Browser"
                onClick={openInBrowser}
              />
              <CornerButton
                icon={isFullscreen ? McpIcons.minimize : McpIcons.maximize}
                label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                onClick={toggleFullscreen}
              />
            </div>
          </div>
        </McpContext.Provider>
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}

// Inline SVG icons (no font dependency — works in sandboxed iframes)
const SVG = ({ children, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);
const McpIcons = {
  sliders: <SVG><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></SVG>,
  maximize: <SVG><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></SVG>,
  minimize: <SVG><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></SVG>,
  copy: <SVG><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></SVG>,
  check: <SVG><polyline points="20 6 9 17 4 12" /></SVG>,
  externalLink: <SVG><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></SVG>,
};

function CornerButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
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
    </button>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Wait until the model is idle (not checking syntax, not rendering).
 */
/** Resolves true once the model is idle, false when timeoutMs elapses first. */
function waitForIdle(model: Model, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const s = model.state;
      if (!s.checkingSyntax && !s.previewing && !s.rendering) {
        resolve(true);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        resolve(false); // Timeout: the operation is still running
        return;
      }
      setTimeout(check, 100);
    };
    // Give a small initial delay for the operation to start
    setTimeout(check, 200);
  });
}
