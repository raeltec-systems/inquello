/**
 * The Shell's keyboard rules (Story 1.16), bound in the renderer only: no
 * global or OS-level shortcut is registered.
 *
 * - Ctrl+N (Cmd+N on macOS) activates New thread, and only while focus is not
 *   in a text field, so typing and the field's own shortcuts are never taken.
 * - Ctrl/Cmd+K is deliberately unbound until a Search surface exists.
 * - Escape closes the topmost open overlay and returns focus to the control
 *   that opened it. A Menu closes itself first (it handles its own Escape and
 *   marks the event handled). Escape never acts on a Task.
 */

const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);

/** Whether keyboard input at this target is typing into a text field. */
export function isTextEntry(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type.toLowerCase());
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  return target.closest('[contenteditable=""], [contenteditable="true"], [role="textbox"]') !== null;
}

export interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Ctrl+N or Cmd+N with no other modifier. */
export function isNewThreadShortcut(event: ShortcutKey): boolean {
  return event.key.toLowerCase() === 'n' && event.ctrlKey !== event.metaKey && !event.altKey && !event.shiftKey;
}

export interface EscapeLayer {
  /** Closes the layer. */
  close: () => void;
  /** The control that opened it; focus returns there. */
  opener: () => HTMLElement | null;
}

/** Open overlays, most recently opened last. */
export class EscapeStack {
  private readonly layers: EscapeLayer[] = [];

  /** Adds a layer on top; the returned function removes it. */
  push(layer: EscapeLayer): () => void {
    this.layers.push(layer);
    return () => {
      const index = this.layers.lastIndexOf(layer);
      if (index >= 0) this.layers.splice(index, 1);
    };
  }

  get size(): number {
    return this.layers.length;
  }

  /** Closes the topmost layer and focuses its opener; false when none is open. */
  closeTopmost(): boolean {
    const layer = this.layers.pop();
    if (!layer) return false;
    const opener = layer.opener();
    layer.close();
    opener?.focus();
    return true;
  }
}
