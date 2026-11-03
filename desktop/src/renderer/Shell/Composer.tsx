/** Plain text Composer. Draft ownership remains in Shell memory. The Start surface
 * supplies an explicit authorized Send action; Task lifecycle supplies steering and Stop.
 * IME owns composition Enter, Shift+Enter inserts lines, Escape keeps the draft.
 * Unavailable Send remains focusable with a visible explanation.
 */
import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';

import { IconButton } from '../primitives';
import type { DraftBinding } from './drafts';

/** Why Send is unavailable until runs exist (Story 1.25). */
export const SEND_ROUTE_REASON = 'Choose a model before sending.';
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
  onStop?: () => void;
  stopDisabledReason?: string;
  routeLabel?: ReactNode;
}

export function Composer({ draft, onSend, disabledReason, autoFocus, readOnly, onStop, stopDisabledReason, routeLabel }: ComposerProps): ReactElement {
  const inputId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const input=inputRef.current;if(!input)return;
    const resize=()=>{
      input.style.height='auto';
      const maximum=Number.parseFloat(getComputedStyle(input).maxHeight)||192;
      const minimum=Number.parseFloat(getComputedStyle(input).lineHeight)||24;
      const height=Math.min(maximum,Math.max(minimum,input.scrollHeight));
      input.style.height=`${height}px`;
      input.style.overflowY=input.scrollHeight>maximum?'auto':'hidden';
    };
    resize();
    if(typeof ResizeObserver==='undefined')return;
    let width=input.getBoundingClientRect().width;
    const observer=new ResizeObserver(entries=>{
      const next=entries[0]?.contentRect.width;
      // Height-only callbacks must not form a resize feedback loop. A hidden
      // draft becoming visible, or a narrower window, changes its width.
      if(next===undefined||next===width)return;
      width=next;resize();
    });
    observer.observe(input);
    return()=>observer.disconnect();
  }, [draft.value]);
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
        ref={inputRef}
        id={inputId}
        autoFocus={autoFocus}
        readOnly={readOnly}
        className="iq-composer-input"
        rows={1}
        value={draft.value}
        placeholder={draft.taskId ? 'Describe what you need from this Task' : 'Describe what you need'}
        onChange={(event) => draft.onChange(event.target.value)}
        onKeyDown={onKeyDown}
        spellCheck
        data-composer-input
      />
      <div className="iq-composer-actions">
        {routeLabel}
        <span className="iq-composer-hint">Shift+Enter for a new line</span>
        {onStop && <IconButton variant="stop" label="Stop" disabledReason={stopDisabledReason} onPress={onStop} data-composer-stop />}
        <IconButton variant="send" label="Send" disabledReason={reason} onPress={() => { if (!readOnly) onSend?.(); }} data-composer-send />
      </div>
    </div>
  );
}
