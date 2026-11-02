/**
 * Inline sizing rules for the MCP app (pure; unit tested in server/test-tools.ts).
 *
 * The view reports its own height with ui/notifications/size-changed
 * (App.sendSizeChanged; autoResize is off because the app fills its container):
 *
 *  - Default: a fixed INLINE_HEIGHT (400px). Without an explicit report the
 *    host picks its own default.
 *  - When the customizer side sheet opens, grow to fit its content, but never
 *    beyond a conservative cap. The host's reported maximum is only an upper
 *    bound: it can be far taller than what is VISIBLE (the chat is a scrolling
 *    column, mobile browser chrome and keyboards eat space, and the iframe
 *    cannot see the host page's viewport). So the cap is also 0.85 x the
 *    device's available screen height (minus safe-area insets when the host
 *    gives them) and an absolute MAX_HEIGHT. The 2.0.4 host context has no
 *    "visible area" hint, and there is no SDK scroll helper, so nothing else
 *    can be done about partial visibility; instead everything essential lives
 *    at the TOP of the frame (toolbar, panel title/close) and the panel
 *    scrolls internally.
 *  - Fullscreen / pip: the host sizes the container, we fill it and report nothing.
 *
 * Users who want a bigger canvas can use the fullscreen button.
 */

/** Default inline height of the MCP app, in CSS pixels. */
export const INLINE_HEIGHT = 400;
/** Height of the full (editor) layout when switched to inline, where 400px would be cramped. */
export const FULL_LAYOUT_HEIGHT = 600;
/** Absolute upper bound for any height we request. */
export const MAX_HEIGHT = 900;
/** Fraction of the device's available screen height we dare to use. */
export const SCREEN_FRACTION = 0.85;
/** Height changes below this many pixels are not reported (avoids resize feedback loops). */
export const REPORT_THRESHOLD = 4;

export interface SizingInputs {
  /** Natural height of the customizer panel (header + content + offset of the panel from the frame top), or null when closed. */
  panelContentHeight: number | null;
  /** containerDimensions.maxHeight from the host context. */
  hostMaxHeight?: number;
  /** window.screen.availHeight. */
  screenAvailHeight?: number;
  /** safeAreaInsets.top + bottom. */
  safeAreaVertical?: number;
}

/** Upper bound for the requested height (never below the default). */
export function heightCap({ hostMaxHeight, screenAvailHeight, safeAreaVertical }: SizingInputs): number {
  const candidates = [MAX_HEIGHT];
  if (hostMaxHeight != null && hostMaxHeight > 0) candidates.push(hostMaxHeight);
  if (screenAvailHeight != null && screenAvailHeight > 0) candidates.push(SCREEN_FRACTION * screenAvailHeight - (safeAreaVertical ?? 0));
  return Math.max(INLINE_HEIGHT, Math.floor(Math.min(...candidates)));
}

/** Height to request: the default, or the customizer's natural height clamped to [default, cap]. */
export function targetHeight(inputs: SizingInputs): number {
  if (inputs.panelContentHeight == null) return INLINE_HEIGHT;
  return Math.round(Math.min(heightCap(inputs), Math.max(INLINE_HEIGHT, inputs.panelContentHeight)));
}

export function shouldReport(last: number | null, next: number): boolean {
  return last == null || Math.abs(next - last) > REPORT_THRESHOLD;
}
