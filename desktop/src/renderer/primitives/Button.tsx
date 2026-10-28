/**
 * `Button`: a native `<button>` with a text label (DESIGN.md `components.Button`).
 *
 * - Variants primary, secondary, quiet and ghost; sizes sm/md/lg (26/28/32px).
 * - `icon` adds a decorative leading icon; the text label stays the name.
 * - `pending` sets `aria-busy`, ignores repeat activation, keeps the label and
 *   shows a decorative spinner plus a visible, linked pending text.
 * - `disabledReason` makes the button unavailable through `aria-disabled`
 *   (it stays focusable so the reason is discoverable) and shows the reason,
 *   linked through `aria-describedby`. There is no bare `disabled` prop.
 *
 * The button performs nothing itself: `onPress` is the caller's handler.
 */
import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactElement } from 'react';

import { Icon, type IconName } from '../icons/Icon';
import { DENSE_ICON_SIZE, describedBy, Note } from './shared';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shown beside a pending button unless the caller supplies its own words. */
export const DEFAULT_PENDING_TEXT = 'In progress';

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled' | 'onClick' | 'type' | 'aria-disabled' | 'aria-busy'> {
  /** The visible text label; it is also the accessible name. */
  children: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Decorative leading icon. */
  icon?: IconName;
  /** Called once per activation, never while pending or unavailable. */
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** An operation this button started is unresolved. */
  pending?: boolean;
  /** Visible text while pending; defaults to `DEFAULT_PENDING_TEXT`. */
  pendingText?: string;
  /** Why the button is unavailable. Setting it disables the button. */
  disabledReason?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  onPress,
  pending = false,
  pendingText = DEFAULT_PENDING_TEXT,
  disabledReason,
  type = 'button',
  className,
  ...rest
}: ButtonProps): ReactElement {
  const noteId = useId();
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  const note = unavailable ? disabledReason : pending ? pendingText : undefined;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (unavailable || pending) {
      event.preventDefault();
      return;
    }
    onPress?.(event);
  };
  const classes = ['iq-button', `iq-button--${variant}`, `iq-button--${size}`, className].filter(Boolean).join(' ');
  return (
    <span className="iq-action">
      <button
        {...rest}
        type={type}
        className={classes}
        onClick={handleClick}
        aria-disabled={unavailable ? true : undefined}
        aria-busy={pending ? true : undefined}
        aria-describedby={describedBy(rest['aria-describedby'], note !== undefined && noteId)}
      >
        {pending ? <span className="iq-spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={DENSE_ICON_SIZE} /> : null}
        <span className="iq-button-label">{children}</span>
      </button>
      {note !== undefined ? <Note id={noteId}>{note}</Note> : null}
    </span>
  );
}
