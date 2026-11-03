/**
 * What the MCP app shows while it waits for its tool input and for the first render (pure, unit tested in
 * server/test-tools.ts). The host mounts the view as soon as the tool call starts; the tool input/result arrive
 * later and the OpenSCAD engine still has to load and render, so without feedback the frame looks empty.
 *
 *   waiting   -> no tool input yet ("Waiting for the assistant…")
 *   loading   -> input received, nothing running yet: the engine is being fetched/started ("Loading OpenSCAD engine…")
 *   rendering -> a check/render is running ("Rendering…")
 *   done      -> the first render produced output (latched by the caller)
 *   error     -> a render failed: the error is shown instead of a bar
 *   cancelled -> the host cancelled the tool call
 *   timeout   -> no input for NO_INPUT_TIMEOUT_MS: stop spinning, say so
 *
 * The bar/status is not shown for the first SHOW_DELAY_MS so fast loads don't flash. Progress stays indeterminate:
 * the engine is fetched inside a worker, which exposes no download progress, and percentages are not faked.
 */

export const SHOW_DELAY_MS = 200;
export const NO_INPUT_TIMEOUT_MS = 30_000;

export type LoadingPhase = 'waiting' | 'loading' | 'rendering' | 'done' | 'error' | 'cancelled' | 'timeout';

export interface LoadingInputs {
  now: number;
  mountedAt: number;
  /** When the first tool input/result was received, or null. */
  inputAt: number | null;
  cancelled: boolean;
  /** The render/check error to show, if any. */
  error?: string;
  /** A syntax check or render is running. */
  busy: boolean;
  /** A render has produced output. */
  hasOutput: boolean;
}

export function loadingPhase(i: LoadingInputs): LoadingPhase {
  if (i.cancelled) return 'cancelled';
  if (i.error) return 'error';
  if (i.hasOutput) return 'done';
  if (i.inputAt == null) return i.now - i.mountedAt >= NO_INPUT_TIMEOUT_MS ? 'timeout' : 'waiting';
  return i.busy ? 'rendering' : 'loading';
}

export interface LoadingView {
  phase: LoadingPhase;
  /** Show the slim progress bar. */
  showBar: boolean;
  /** Status line, or null for none. */
  message: string | null;
  hint?: string;
}

export function loadingView(i: LoadingInputs): LoadingView {
  const phase = loadingPhase(i);
  const delayed = i.now - i.mountedAt >= SHOW_DELAY_MS;
  switch (phase) {
    case 'waiting':
      return { phase, showBar: delayed, message: delayed ? 'Waiting for the assistant…' : null };
    case 'loading':
      return { phase, showBar: delayed, message: delayed ? 'Loading OpenSCAD engine…' : null };
    case 'rendering':
      return { phase, showBar: delayed, message: delayed ? 'Rendering…' : null };
    case 'error':
      return { phase, showBar: false, message: `Could not render: ${i.error}` };
    case 'cancelled':
      return { phase, showBar: false, message: 'The tool call was cancelled' };
    case 'timeout':
      return {
        phase, showBar: false, message: 'No input received',
        hint: 'The assistant has not sent anything to show yet. Ask it to call the tool again.',
      };
    case 'done':
      return { phase, showBar: false, message: null };
  }
}
