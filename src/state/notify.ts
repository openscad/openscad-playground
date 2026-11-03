/**
 * One policy for transient notifications (toasts/snackbars).
 *
 * The full UI shows them as before. In embed mode (web iframe and MCP app) the frame is small and often
 * not the user's focus, so only notifications that need attention are rendered visibly:
 *  - errors and warnings (a failed render or download),
 *  - `essential` ones: the sole feedback of an explicit user click (e.g. "Embed code copied").
 * Everything else (camera/view-preset notices like "Front view") is not rendered, but is still announced to
 * screen readers through a visually hidden live region, so accessibility feedback is kept.
 *
 * Programmatic changes (tool calls such as set_camera, context updates) must never notify at all: only call
 * `notify` from handlers of user interactions.
 */

export type NotifyLevel = 'info' | 'success' | 'warn' | 'error';

export interface NotifyOptions {
  /** Sole feedback of an explicit user click: keep visible even in embed mode. */
  essential?: boolean;
  life?: number;
}

export interface NotifyDecision {
  /** Render a visible toast. */
  visible: boolean;
  /** Announce through the visually hidden live region (used when no visible toast carries the message). */
  announceOnly: boolean;
}

export function decideNotification(embed: boolean, level: NotifyLevel, opts: NotifyOptions = {}): NotifyDecision {
  const visible = !embed || level === 'warn' || level === 'error' || !!opts.essential;
  return { visible, announceOnly: !visible };
}

export interface NotifySinks {
  toast(level: NotifyLevel, text: string, life?: number): void;
  announce(text: string): void;
}

/** Route a notification according to the policy. */
export function notify(embed: boolean, sinks: NotifySinks, level: NotifyLevel, text: string, opts: NotifyOptions = {}) {
  const d = decideNotification(embed, level, opts);
  if (d.visible) sinks.toast(level, text, opts.life);
  else sinks.announce(text);
}

/** Style of a visually hidden but still announced live region. */
export const visuallyHidden = {
  position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const;
