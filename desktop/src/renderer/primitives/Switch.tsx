/**
 * `Switch`: a native `<button role="switch">` with `aria-checked` and a
 * visible On/Off text (DESIGN.md `components.Switch`).
 *
 * The native button already activates on Space and Enter, so the switch adds
 * no key handling of its own. `disabledReason` keeps it focusable with
 * `aria-disabled`, ignores activation and shows the linked reason. Toggling
 * only reports the new value through `onChange`; applying it is the caller's.
 */
import { useId, type ButtonHTMLAttributes, type ReactElement } from 'react';

import { describedBy, Note, useBooleanState } from './shared';

export const SWITCH_STATE_TEXT = { on: 'On', off: 'Off' } as const;

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'onClick' | 'disabled' | 'type' | 'role' | 'aria-checked' | 'defaultChecked'> {
  /** Visible label and accessible name. */
  label: string;
  /** Controlled state; omit to let the switch keep its own. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Why the switch is unavailable. Setting it disables the switch. */
  disabledReason?: string;
}

export function Switch({ label, checked, defaultChecked = false, onChange, disabledReason, className, ...rest }: SwitchProps): ReactElement {
  const noteId = useId();
  const [on, setOn] = useBooleanState(checked, defaultChecked, onChange);
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  return (
    <span className="iq-action">
      <button
        {...rest}
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={unavailable ? true : undefined}
        aria-describedby={describedBy(rest['aria-describedby'], unavailable && noteId)}
        className={['iq-switch', className].filter(Boolean).join(' ')}
        onClick={() => {
          if (!unavailable) setOn(!on);
        }}
      >
        <span className="iq-switch-label">{label}</span>
        <span className="iq-switch-track" aria-hidden="true">
          <span className="iq-switch-thumb" />
        </span>
        <span className="iq-switch-state" aria-hidden="true">
          {on ? SWITCH_STATE_TEXT.on : SWITCH_STATE_TEXT.off}
        </span>
      </button>
      {unavailable ? <Note id={noteId}>{disabledReason}</Note> : null}
    </span>
  );
}
