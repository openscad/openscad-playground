/**
 * Keeps a controlled Monaco editor from eating keystrokes.
 *
 * `@monaco-editor/react` applies its `value` prop to the editor in an effect that runs after a render commits
 * and whenever the prop changed, replacing the whole text if it differs from the editor's. The prop comes from
 * app state, which lags behind typing (the state update is asynchronous, renders and effects can be slow, e.g.
 * on a loaded machine): while the user types "ab", the effect of a render showing "a" can run after the editor
 * already holds "ab" and replace it by "a", losing keystrokes (and closing the completion widget).
 *
 * The fix is to never feed typing back: the prop only changes for *external* changes (file switch, tool edit,
 * undo, ...). A render showing text the editor itself emitted is an echo of typing and keeps the previous prop
 * (an unchanged prop is a no-op for the library). Echoes are recognised by the editor's emissions arriving in
 * order; a text that goes back to one whose echo was already seen is an external restore.
 */
export class EditorValueSync {
  private prop: string;
  /** Texts emitted by the editor since the last external change, oldest first. */
  private emissions: string[] = [];
  /** Index in `emissions` of the newest echo seen so far. */
  private echoed = -1;

  constructor(initial: string) {
    this.prop = initial;
  }

  /** The editor emitted new text (the user typed). */
  emitted(text: string): void {
    this.emissions.push(text);
    if (this.emissions.length > 256) {
      this.emissions.shift();
      this.echoed--;
    }
  }

  /** The `value` prop to render, given the source currently in the app state. */
  valueProp(source: string): string {
    for (let j = this.emissions.length - 1; j > this.echoed; j--) {
      if (this.emissions[j] === source) {
        this.echoed = j; // an echo of typing (possibly stale): the editor is ahead or equal, leave it alone
        return this.prop;
      }
    }
    if (this.echoed >= 0 && this.emissions[this.echoed] === source) return this.prop; // re-render of the newest echo
    if (source === this.prop) return this.prop;
    // External change: pass it through.
    this.emissions.length = 0;
    this.echoed = -1;
    return this.prop = source;
  }
}
