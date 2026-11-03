/**
 * MCP App mode: minimal UI with viewer, customizer overlay, and toolbar.
 *
 * The App (created in index.tsx) registers the app tools (mcp-tools.ts) with
 * the host before connecting; this component installs the ViewerHost those
 * tool handlers delegate to, and reports passive state changes back to the
 * model via updateModelContext.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { State, StatePersister } from '../state/app-state.ts';
import { Model } from '../state/model.ts';
import { ViewerPanelHandle } from './ViewerPanel.tsx';
import { FULL_LAYOUT_HEIGHT, shouldReport, targetHeight } from '../state/mcp-sizing.ts';
import { useEmbedClass } from './use-embed-class.ts';
import EmbedView, { CornerButton, EmbedIcons } from './EmbedView.tsx';
import { ModelContext, FSContext, McpContext } from './contexts.ts';
import {
  ToolEventBuffer,
  ToolInputParams,
  ToolResultParams,
  setActiveHost,
  publishModelContext,
  applyHostStyles,
} from '../state/mcp-app.ts';
import type { Diagnostic, ViewerHost, ViewerSnapshot } from '../state/mcp-tools.ts';
import { DeclinedError, deliverPlanViaHost, hostFileCaps, type ExportedFile } from '../state/mcp-download.ts';
import { bytesToBase64, buildFilename, deliveryPlan, FORMAT_INFO, formatSize, type ExportFormat } from '../state/export-logic.ts';
import { canonicalPreset, lineCount, presetOrbit } from '../state/mcp-tools-logic.ts';
import { encodeStateParamsAsFragment } from '../state/fragment-state.ts';
import { ProgressBar } from 'primereact/progressbar';

/**
 * The full UI (editor etc.) is only needed when the model switches layout to
 * 'full': load it lazily so the MCP bundle stays light, and register the
 * OpenSCAD editor language on first use.
 */
/** Falls back to the embed layout (and records why) if the lazily loaded full UI fails to load or crashes. */
class FullLayoutBoundary extends React.Component<{ model: Model; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error instanceof Event ? `failed to load a script (${error.type}); the host CSP may block it` : error);
    console.error('Full layout failed:', error);
    this.props.model.mutate(s => { s.view.embed = true; s.view.fullReady = false; s.view.layoutError = `Full layout failed to load: ${message}`; });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Marks the lazily loaded full UI as mounted, so set_layout knows it worked. */
function FullMounted({ model, children }: { model: Model; children: React.ReactNode }) {
  useEffect(() => {
    model.mutate(s => { s.view.fullReady = true; s.view.layoutError = undefined; });
    return () => { model.mutate(s => { s.view.fullReady = false; }); };
  }, [model]);
  return <>{children}</>;
}

const lazyFullLayout = (fs: FS) => React.lazy(async () => {
  const [{ registerOpenSCADLanguage }, { zipArchives }, layout] = await Promise.all([
    import('../language/openscad-register-language.ts'),
    import('../fs/zip-archives.ts'),
    import('./FullLayout.tsx'),
  ]);
  await registerOpenSCADLanguage(fs, '/', zipArchives);
  return layout;
});

/** How long tool calls wait for the create tool's result before assuming there is none. */
const INITIAL_STATE_GRACE_MS = 4000;

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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // One Model for the component's lifetime: a Model per render would leave
  // in-flight async work (checks, renders) mutating a stale state snapshot,
  // silently reverting edits made by tool calls in the meantime. Model.state
  // always tracks the latest state (setState assigns it synchronously).
  const [model] = useState(() => new Model(fs, state, setState, statePersister));
  const modelRef = useRef(model);
  // The app tools are registered with the host before React mounts, so a fast caller can invoke one before the
  // create tool's result (the initial source) has been applied: it would then render an empty model. Tool calls
  // therefore wait for the initial state, or for a short grace period when no create result ever arrives.
  const [initialApplied, setInitialApplied] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setInitialApplied(true), INITIAL_STATE_GRACE_MS);
    return () => clearTimeout(t);
  }, []);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<string | undefined>(() => app.getHostContext()?.displayMode);
  useEmbedClass(state.view.embed);
  const LazyFullLayout = useMemo(() => lazyFullLayout(fs), [fs]);
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

  useEffect(() => model.init());

  // Tool handlers and buffered-event replay outlive any single render's
  // closures, so they go through modelRef / viewerRef.
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
    const name = canonicalPreset(view);
    if (name) {
      const { theta, phi } = presetOrbit(name);
      viewerRef.current?.setCameraOrbit(theta, phi);
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
    setInitialApplied(true); // from now on tool calls see the created model (see the gate below)
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
    app.ontoolcancelled = () => setInitialApplied(true);
  }, [app, toolEvents, applyToolInput, applyToolResult]);

  // Install the host that the view-registered app tools delegate to
  useEffect(() => {
    if (!initialApplied) return;
    const snapshot = (timedOut?: boolean): ViewerSnapshot => buildSnapshot(modelRef.current, timedOut);
    const host: ViewerHost = {
      snapshot: () => snapshot(),
      async settle(timeoutMs) {
        const idle = await waitForIdle(() => modelRef.current, timeoutMs);
        return snapshot(!idle);
      },
      readFile: path => modelRef.current.state.params.sources.find(src => src.path === path)?.content,
      writeFile(path, content, opts) {
        const m = modelRef.current;
        m.mutate(s => {
          const exists = s.params.sources.some(src => src.path === path);
          s.params.sources = exists
            ? s.params.sources.map(src => src.path === path ? { path, content } : src)
            : [...s.params.sources, { path, content }];
          if (opts?.activate && s.params.activePath !== path) {
            s.params.activePath = path;
            s.lastCheckerRun = undefined;
            s.error = undefined;
          }
        });
        m.processSource();
      },
      removeFile(path) {
        const m = modelRef.current;
        m.mutate(s => {
          s.params.sources = s.params.sources.filter(src => src.path !== path);
          if (s.params.activePath === path) {
            s.params.activePath = s.params.sources[0].path;
            s.lastCheckerRun = undefined;
            s.error = undefined;
          }
        });
        m.processSource();
      },
      startRender(mode) {
        modelRef.current.render({ isPreview: mode === 'preview', now: true });
      },
      fileCapabilities: () => hostFileCaps(app),
      exportFile: (format, filename) => exportAsFile(modelRef.current, format, filename),
      deliver: (file, steps) => deliverPlanViaHost(app, file, steps),
      setParameters: vars => modelRef.current.setVars(vars),
      resetParameters: names => modelRef.current.resetVars(names),
      setLayout(req) {
        const m = modelRef.current;
        m.mutate(s => {
          if (req.mode) s.view.embed = req.mode === 'embed';
          if (req.customizerOverlay) {
            s.view.customizerOverlay = req.customizerOverlay === 'toggle' ? !s.view.customizerOverlay : req.customizerOverlay === 'open';
          }
        });
        const layout = m.state.view.layout;
        if (m.state.view.embed) return;
        if (layout.mode === 'single') {
          if (req.focus) m.changeSingleVisibility(req.focus);
        } else {
          // Show first, so hiding the last visible panel never trips the "at least one" guard.
          const wanted = [['editor', req.editor], ['viewer', req.viewer], ['customizer', req.customizer]] as const;
          for (const [id, v] of wanted) if (v === true) m.changeMultiVisibility(id, true);
          for (const [id, v] of wanted) if (v === false) m.changeMultiVisibility(id, false);
        }
      },
      setShowAxes(show) {
        modelRef.current.mutate(s => s.view.showAxes = show);
      },
      getCamera: async () => (await viewerRef.current?.getCamera()) ?? null,
      setCamera: async camera => (await viewerRef.current?.setCamera(camera)) ?? null,
      waitForModel: async timeoutMs => (await viewerRef.current?.waitForModel(timeoutMs)) ?? false,
      captureImage: async opts => (await viewerRef.current?.captureImage(opts)) ?? null,
    };

    setActiveHost(host);
    updateContextRef.current = () => publishModelContext(app, host);
    return () => {
      setActiveHost(null);
      updateContextRef.current = null;
    };
  }, [app, initialApplied]);

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

  // Report the inline height to the host (see state/mcp-sizing.ts for the rules).
  const lastReportedHeight = useRef<number | null>(null);
  const isEmbed = !!state.view.embed;
  useEffect(() => {
    if (displayMode && displayMode !== 'inline') {
      lastReportedHeight.current = null; // the host owns the size; report again on return to inline
      return;
    }
    const ctx = app.getHostContext();
    const dims = ctx?.containerDimensions as { height?: number; maxHeight?: number } | undefined;
    if (dims && 'height' in dims && dims.height != null) return; // fixed by the host
    const next = isEmbed
      ? targetHeight({
          panelContentHeight: panelHeight,
          hostMaxHeight: dims?.maxHeight,
          screenAvailHeight: window.screen?.availHeight,
          safeAreaVertical: (ctx?.safeAreaInsets?.top ?? 0) + (ctx?.safeAreaInsets?.bottom ?? 0),
        })
      : FULL_LAYOUT_HEIGHT;
    const timer = setTimeout(() => {
      if (!shouldReport(lastReportedHeight.current, next)) return;
      lastReportedHeight.current = next;
      app.sendSizeChanged({ height: next }).catch(e => console.warn('sendSizeChanged failed:', e));
    }, 120);
    return () => clearTimeout(timer);
  }, [app, panelHeight, isEmbed, displayMode]);

  // Apply host styles and listen for changes
  useEffect(() => {
    // Apply initial host styles
    applyHostStyles(app.getHostContext());

    // Listen for host context changes (theme, CSS variables, fonts)
    app.onhostcontextchanged = () => {
      const newCtx = app.getHostContext();
      setDisplayMode(newCtx?.displayMode);
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

  const toolbar = (
    <CornerButton
      icon={EmbedIcons.externalLink}
      label="Open in Browser"
      onClick={openInBrowser}
    />
  );

  // Toolbar Download: host download, else chat attachment, else a manual-save dialog.
  const onDownload = useCallback(async (format: ExportFormat) => {
    const m = modelRef.current;
    if (m.state.output?.isPreview) await m.render({ isPreview: false, now: true });
    const file = await exportAsFile(m, format);
    const caps = hostFileCaps(app);
    const plan = deliveryPlan('auto', caps, file.size);
    const delivered = await deliverPlanViaHost(app, file, plan);
    if (delivered) return { message: delivered.outcome };
    return {
      message: `This host cannot save files; ${file.filename} (${formatSize(file.size)}) is ready below`,
      fallback: { filename: file.filename, mimeType: file.mimeType, base64: file.base64, note: 'This host cannot download files or attach them to the chat. Try the link (it may be blocked by the sandbox), or use "Open in Browser" and download there.' },
    };
  }, [app]);

  // Fullscreen only where the host offers that display mode.
  const hostModes = app.getHostContext()?.availableDisplayModes;
  const fullscreen = hostModes?.includes('fullscreen') ? { active: isFullscreen, toggle: toggleFullscreen } : undefined;

  return (
    <ModelContext.Provider value={model}>
      <FSContext.Provider value={fs}>
        <McpContext.Provider value={app}>
          {state.view.embed
            ? <EmbedView
                viewerRef={viewerRef}
                isDark={isDark}
                disableZoom={!isFullscreen}
                showHint={!isFullscreen}
                onCameraChange={scheduleContextUpdate}
                fullscreen={fullscreen}
                toolbar={toolbar}
                onDownload={onDownload}
                onPanelContentHeight={setPanelHeight}
                exit={{
                  label: 'Full editor',
                  icon: EmbedIcons.layout,
                  onClick: () => model.mutate(s => { s.view.embed = false; s.view.customizerOverlay = false; }),
                }} />
            : <FullLayoutBoundary key={state.view.layoutError ?? 'ok'} model={model}>
                <Suspense fallback={<ProgressBar mode="indeterminate" style={{ height: '4px' }} />}>
                  <FullMounted model={model}>
                    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <LazyFullLayout viewerRef={viewerRef} />
                      {/* Top-right is free: the panel switcher is centered */}
                      <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1000, opacity: 0.55 }}
                        className="mcp-toolbar">
                        <CornerButton
                          icon={EmbedIcons.minimize}
                          label="Back to embed mode"
                          onClick={() => model.mutate(s => { s.view.embed = true; })} />
                      </div>
                    </div>
                  </FullMounted>
                </Suspense>
              </FullLayoutBoundary>}
        </McpContext.Provider>
      </FSContext.Provider>
    </ModelContext.Provider>
  );
}

/** Export the rendered model as a base64 file for delivery through the host. */
async function exportAsFile(model: Model, format: ExportFormat, filename?: string): Promise<ExportedFile> {
  const file = await model.exportFile(format);
  const stem = (model.state.params.activePath.split('/').pop() ?? 'model').replace(/\.[^.]+$/, '');
  return {
    filename: buildFilename(filename, stem, format),
    mimeType: FORMAT_INFO[format].mimeType,
    base64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
    size: file.size,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────

const LOG_TAIL_MAX = 40;

/** Snapshot of the model state in the shape the app tools report. */
function buildSnapshot(model: Model, timedOut?: boolean): ViewerSnapshot {
  const s = model.state;
  const activePath = s.params.activePath;
  const severity = (sev: number): Diagnostic['severity'] => sev >= 8 ? 'error' : sev >= 4 ? 'warning' : 'info';
  const logLines = s.currentRunLogs?.length
    ? s.currentRunLogs.map(([, line]) => line)
    : (s.lastCheckerRun?.logText ?? '').split('\n');
  return {
    activePath,
    files: s.params.sources.map(src => ({
      path: src.path,
      lines: lineCount(src.content ?? ''),
      active: src.path === activePath,
    })),
    status: s.rendering ? 'rendering' : s.previewing ? 'previewing' : s.checkingSyntax ? 'checking' : 'idle',
    ...(timedOut ? { timedOut } : {}),
    error: s.error,
    diagnostics: (s.lastCheckerRun?.markers ?? []).map(m => ({
      path: activePath,
      line: m.startLineNumber,
      column: m.startColumn,
      severity: severity(m.severity),
      message: m.message,
    })),
    logTail: logLines.slice(-LOG_TAIL_MAX),
    hasOutput: !!s.output,
    renderKind: s.output ? (s.output.isPreview ? 'preview' : 'full') : undefined,
    elapsedMs: s.output?.elapsedMillis,
    is2D: s.is2D,
    parameters: (s.parameterSet?.parameters ?? []).map(p => ({
      name: p.name,
      type: p.type,
      group: p.group,
      caption: p.caption,
      initial: p.initial,
      value: s.params.vars?.[p.name] ?? p.initial,
      ...('min' in p ? { min: p.min, max: p.max, step: p.step } : {}),
      ...('options' in p && p.options ? { options: p.options } : {}),
    })),
    showAxes: !!s.view.showAxes,
    layout: {
      mode: s.view.embed ? 'embed' : 'full',
      ...(s.view.embed ? {} : { ready: !!s.view.fullReady }),
      ...(s.view.layoutError ? { error: s.view.layoutError } : {}),
      customizerOverlay: !!s.view.customizerOverlay,
      ...(s.view.embed ? {} : {
        panels: s.view.layout.mode === 'multi'
          ? { kind: 'multi' as const, editor: s.view.layout.editor, viewer: s.view.layout.viewer, customizer: s.view.layout.customizer }
          : { kind: 'single' as const, focus: s.view.layout.focus },
      }),
    },
  };
}

/** Resolves true once the model is idle (not checking syntax, not rendering), false when timeoutMs elapses first. */
function waitForIdle(getModel: () => Model, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const s = getModel().state;
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
