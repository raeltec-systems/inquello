/** Plain text Composer. Draft ownership remains in Shell memory. The Start surface
 * supplies an explicit authorized Send action; existing Tasks stay read-only here.
 * IME owns composition Enter, Shift+Enter inserts lines, Escape keeps the draft.
 * Unavailable Send remains focusable with a visible explanation.
 */
import { useId, type KeyboardEvent, type ReactElement } from 'react';

import { IconButton } from '../primitives';
import type { DraftBinding } from './drafts';

/** Why Send is unavailable until runs exist (Story 1.25). */
export const SEND_ROUTE_REASON = 'Sending starts once a processing route is set up.';
/** Shown before the route reason while the request is empty. */
export const SEND_EMPTY_REASON = 'Type a request to send.';

export const COMPOSER_LABEL = 'Request for this Task';
export const COMPOSER_LABEL_NO_TASK = 'Request (no Task open)';

/** Whether a keydown is Enter while an input method is composing text. */
export function isComposingEnter(event: { key: string; keyCode?: number; nativeEvent?: { isComposing?: boolean }; isComposing?: boolean }): boolean {
  return event.isComposing === true || event.nativeEvent?.isComposing === true || event.keyCode === 229;
}

/** The reason Send is unavailable for this text. */
export function sendReason(value: string): string {
  return value.trim() === '' ? `${SEND_EMPTY_REASON} ${SEND_ROUTE_REASON}` : SEND_ROUTE_REASON;
}

export interface ComposerProps {
  draft: DraftBinding;
  onSend?: () => void;
  disabledReason?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

export function Composer({ draft, onSend, disabledReason, autoFocus, readOnly }: ComposerProps): ReactElement {
  const inputId = useId();
  const reason = !onSend ? sendReason(draft.value) : draft.value.trim() === '' ? SEND_EMPTY_REASON : disabledReason;
  const label = draft.taskId ? COMPOSER_LABEL : COMPOSER_LABEL_NO_TASK;
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // The input method owns Enter while it composes.
    if (isComposingEnter(event)) return;
    // Shift+Enter (and other modified Enters) keep the field's own behaviour.
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter submits only the explicitly enabled action.
    event.preventDefault();
    if (!reason && !readOnly) onSend?.();
  };

  return (
    <div className="iq-composer" data-composer data-composer-task={draft.taskId ?? ''}>
      <label className="iq-visually-hidden" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className="iq-composer-input"
        rows={2}
        value={draft.value}
        placeholder={draft.taskId ? 'Describe what you need from this Task' : 'Describe what you need'}
        onChange={(event) => draft.onChange(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck
        data-composer-input
      />
      <div className="iq-composer-actions">
        <IconButton variant="send" label="Send" disabledReason={reason} onPress={() => { if (!readOnly) onSend?.(); }} data-composer-send />
      </div>
    </div>
  );
}
