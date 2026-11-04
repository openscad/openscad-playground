/**
 * Controls for models that read `$t` (see docs/ANIMATION.md): a play/pause button, a time slider with the current
 * `$t`, and a small settings popover (steps = frames per loop, fps). Shared by the full UI footer, the embed
 * toolbar and the MCP app; they only differ in styling.
 */

import React, { CSSProperties, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { ModelContext } from './contexts.ts';
import { loopSeconds, MAX_FPS, MAX_STEPS, MIN_FPS, MIN_STEPS } from '../state/animation.ts';

export function useAnimationState() {
  const model = useContext(ModelContext);
  if (!model) throw new Error('No model');
  const animation = model.state.animation;
  return { model, animation, settings: model.animationSettings };
}

const SVG = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
export const AnimationIcons = {
  play: <SVG><circle cx="12" cy="12" r="10" fill="none" /><polygon points="10 8 16 12 10 16 10 8" /></SVG>,
  pause: <SVG><circle cx="12" cy="12" r="10" fill="none" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></SVG>,
  gear: <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>,
};

export function playLabel(playing: boolean) { return playing ? 'Pause animation' : 'Play animation'; }

/** Number field that commits on blur / Enter (so typing "15" does not pass through the invalid "1"). */
function NumberField({ label, value, min, max, onCommit, width }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void; width: number }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const v = Number(draft);
    if (Number.isFinite(v) && draft.trim() !== '') onCommit(Math.min(max, Math.max(min, v)));
    else setDraft(String(value));
  };
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span>{label}</span>
      <input type="number" aria-label={`Animation ${label.toLowerCase()}`} value={draft} min={min} max={max} step="any"
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } e.stopPropagation(); }}
        style={{ width, font: 'inherit', padding: '2px 4px', color: 'inherit', background: 'rgba(127,127,127,0.18)', border: '1px solid rgba(127,127,127,0.5)', borderRadius: 4 }} />
    </label>
  );
}

/** The time slider, the current `$t` and the loop settings. `dark`: light-on-dark styling (over the 3D view). */
export function AnimationBar({ dark, style }: { dark?: boolean; style?: CSSProperties }) {
  const { model, animation, settings } = useAnimationState();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!animation) return null;

  const t = animation.frame / settings.steps;
  const rendering = animation.ready < settings.steps && animation.playing ? `${animation.ready}/${settings.steps} frames rendered` : '';
  return (
    <div ref={rootRef} className="animation-bar" role="group" aria-label="Animation" style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
      fontFamily: 'var(--font-sans, system-ui, sans-serif)', fontSize: 12, ...(style ?? {}),
    }}>
      <input type="range" aria-label="Animation time" min={0} max={settings.steps - 1} step={1} value={animation.frame}
        title={`Frame ${animation.frame + 1} of ${settings.steps}${rendering ? ` (${rendering})` : ''}`}
        onChange={e => model.animation.seek(Number(e.target.value))}
        onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); model.animation.toggle(); } }}
        style={{ flex: 1, minWidth: 36, maxWidth: 520, accentColor: dark ? '#a5b4fc' : undefined, cursor: 'pointer' }} />
      <span data-testid="animation-time" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace' }}>
        $t={t.toFixed(2)}
      </span>
      <button type="button" aria-label="Animation settings" aria-expanded={open} title="Animation settings" onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', padding: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: open ? 1 : 0.8 }}>
        {AnimationIcons.gear}
      </button>
      {open && (
        <div role="dialog" aria-label="Animation settings" style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, zIndex: 90, width: 190, padding: 10, borderRadius: 8,
          display: 'flex', flexDirection: 'column', gap: 6,
          background: dark ? 'rgba(30,30,30,0.95)' : 'var(--surface-overlay, #fff)', color: dark ? '#eee' : 'inherit',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <NumberField label="Steps" value={settings.steps} min={MIN_STEPS} max={MAX_STEPS} width={64} onCommit={steps => model.setAnimationSettings({ steps })} />
          <NumberField label="FPS" value={settings.fps} min={MIN_FPS} max={MAX_FPS} width={64} onCommit={fps => model.setAnimationSettings({ fps })} />
          <span style={{ opacity: 0.75 }}>Loop: {loopSeconds(settings).toFixed(1)} s ({settings.steps} frames)</span>
          <span style={{ opacity: 0.75 }}>{animation.ready}/{settings.steps} frames rendered</span>
        </div>
      )}
    </div>
  );
}
