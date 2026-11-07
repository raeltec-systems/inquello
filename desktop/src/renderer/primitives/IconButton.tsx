/**
 * `IconButton`: a native `<button>` showing only an icon (DESIGN.md
 * `components.IconButton`).
 *
 * - `label` is required by the type and becomes `aria-label`; the icon is decorative.
 * - Variants ghost, outline and active at 28px; round send (arrow-up) and stop
 *   (a 9px square) at the 30px round size.
 * - `pressed` exposes a toggle through `aria-pressed`; `expanded` exposes a
 *   disclosure through `aria-expanded`.
 * - `disabledReason` works as on `Button`: `aria-disabled`, still focusable,
 *   reason visible and linked.
 *
 * Send and stop only call `onPress`; stopping requests interruption and is
 * never a rollback, which the caller owns.
 */
import { useId, type ButtonHTMLAttributes, type MouseEvent, type ReactElement } from 'react';

import { Icon, type IconName } from '../icons/Icon';
import { describedBy, Note } from './shared';

export type IconButtonVariant = 'ghost' | 'outline' | 'active' | 'send' | 'stop';

type NativeProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'disabled' | 'onClick' | 'type' | 'aria-label' | 'aria-pressed' | 'aria-expanded' | 'aria-disabled'
>;

interface CommonProps extends NativeProps {
  /** Accessible name. Required: an icon alone never names a control. */
  label: string;
  onPress?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Toggle state, exposed as `aria-pressed`. */
  pressed?: boolean;
  /** Disclosure state, exposed as `aria-expanded`. */
  expanded?: boolean;
  /** Why the button is unavailable. Setting it disables the button. */
  disabledReason?: string;
}

export type IconButtonProps =
  | (CommonProps & { variant?: 'ghost' | 'outline' | 'active'; icon: IconName })
  | (CommonProps & { variant: 'send' | 'stop'; icon?: never });

export function IconButton(props: IconButtonProps): ReactElement {
  const { label, onPress, pressed, expanded, disabledReason, variant = 'ghost', icon, className, ...rest } = props;
  const noteId = useId();
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  const round = variant === 'send' || variant === 'stop';
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (unavailable) {
      event.preventDefault();
      return;
    }
    onPress?.(event);
  };
  const classes = ['iq-icon-button', `iq-icon-button--${variant}`, round && 'iq-icon-button--round', className].filter(Boolean).join(' ');
  return (
    <span className="iq-action">
      <button
        {...rest}
        type="button"
        className={classes}
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-disabled={unavailable ? true : undefined}
        aria-describedby={describedBy(rest['aria-describedby'], unavailable && noteId)}
        onClick={handleClick}
      >
        {variant === 'stop' ? (
          <span className="iq-icon-button-stop" aria-hidden="true" />
        ) : (
          <Icon name={variant === 'send' ? 'arrow-up' : (icon as IconName)} />
        )}
      </button>
      {unavailable ? <Note id={noteId}>{disabledReason}</Note> : null}
    </span>
  );
}
