/**
 * The Composer (Story 1.17): a plain-text request for the open Task.
 *
 * - The text lives in the Shell's in-memory draft store (`drafts.ts`) through a
 *   `DraftBinding`, so it survives opening other Tasks, layout changes and the
 *   Conversation/Artifact switch. Nothing here saves, logs or sends it.
 * - Shift+Enter inserts a newline. Enter submits only when Send is available;
 *   until real runs exist (Story 1.25) it never is, so Enter does nothing and
 *   keeps the text. Enter during input-method composition (`isComposing`, or
 *   keyCode 229) is always left to the input method.
 * - Escape never clears the draft; Ctrl/Cmd+N stays with the text field.
 * - Send is visible but unavailable (`aria-disabled`, still focusable), with
 *   its reason shown and linked through `aria-describedby`.
 * - No attachment, Method, scope, environment or reasoning controls are built:
 *   none is shown, so none can pretend to work.
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
}

export function Composer({ draft }: ComposerProps): ReactElement {
  const inputId = useId();
  const label = draft.taskId ? COMPOSER_LABEL : COMPOSER_LABEL_NO_TASK;
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter') return;
    // The input method owns Enter while it composes.
    if (isComposingEnter(event)) return;
    // Shift+Enter (and other modified Enters) keep the field's own behaviour.
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    // Enter would submit when Send is available; it never is yet, so it only keeps the text.
    event.preventDefault();
  };

  return (
    <div className="iq-composer" data-composer data-composer-task={draft.taskId ?? ''}>
      <label className="iq-visually-hidden" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
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
        <IconButton variant="send" label="Send" disabledReason={sendReason(draft.value)} data-composer-send />
      </div>
    </div>
  );
}
