/**
 * `Choice` primitives on native inputs (DESIGN.md `components.Choice`).
 *
 * - `RadioGroup`: one `<input type="radio">` per option inside a
 *   `<fieldset>`/`<legend>`; the browser provides Tab into the group and
 *   arrow-key selection.
 * - `Checkbox`: an independent `<input type="checkbox">`; `CheckboxGroup`
 *   groups several under a `<fieldset>`/`<legend>`.
 * - An option with a `description` renders as an option card. The label is the
 *   accessible name; the description is linked through `aria-describedby`.
 * - `disabledReason` on a group, option or checkbox disables it and shows the
 *   linked reason.
 *
 * Selecting only reports the value through `onChange`; it commits nothing.
 */
import { useId, useState, type ReactElement, type ReactNode } from 'react';

import { Icon } from '../icons/Icon';
import { DENSE_ICON_SIZE, describedBy, Note, useBooleanState } from './shared';

interface GroupProps {
  /** Visible group name, rendered as the `<legend>`. */
  legend: string;
  /** Visible guidance, linked to the group. */
  instruction?: string;
  /** Why the whole group is unavailable. Setting it disables every option. */
  disabledReason?: string;
  className?: string;
}

function ChoiceGroup({ legend, instruction, disabledReason, className, children }: GroupProps & { children: ReactNode }): ReactElement {
  const id = useId();
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  return (
    <fieldset
      className={['iq-choice-group', className].filter(Boolean).join(' ')}
      disabled={unavailable}
      aria-describedby={describedBy(instruction && `${id}-instruction`, unavailable && `${id}-reason`)}
    >
      <legend className="iq-choice-legend">{legend}</legend>
      {instruction ? (
        <span id={`${id}-instruction`} className="iq-choice-instruction">
          {instruction}
        </span>
      ) : null}
      {children}
      {unavailable ? <Note id={`${id}-reason`}>{disabledReason}</Note> : null}
    </fieldset>
  );
}

interface ChoiceItemProps {
  type: 'radio' | 'checkbox';
  label: string;
  description?: string;
  disabledReason?: string;
  name?: string;
  value?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ChoiceItem({ type, label, description, disabledReason, name, value, checked, onChange }: ChoiceItemProps): ReactElement {
  const id = useId();
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  const card = description !== undefined && description !== '';
  const classes = ['iq-choice', `iq-choice--${type}`, card && 'iq-choice--card', checked && 'iq-choice--checked', unavailable && 'iq-choice--disabled']
    .filter(Boolean)
    .join(' ');
  return (
    <div className="iq-choice-item">
      <label className={classes}>
        <span className="iq-choice-control">
          <input
            type={type}
            className="iq-choice-input"
            name={name}
            value={value}
            checked={checked}
            disabled={unavailable || undefined}
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy(card && `${id}-description`, unavailable && `${id}-reason`)}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span className="iq-choice-box" aria-hidden="true">
            {type === 'checkbox' ? <Icon name="check" size={DENSE_ICON_SIZE} className="iq-choice-check" /> : null}
          </span>
        </span>
        <span className="iq-choice-text">
          <span id={`${id}-label`} className="iq-choice-label">
            {label}
          </span>
          {card ? (
            <span id={`${id}-description`} className="iq-choice-description">
              {description}
            </span>
          ) : null}
        </span>
      </label>
      {unavailable ? <Note id={`${id}-reason`}>{disabledReason}</Note> : null}
    </div>
  );
}

export interface RadioOption {
  value: string;
  label: string;
  /** Renders the option as an option card. */
  description?: string;
  /** Why this option is unavailable. */
  disabledReason?: string;
}

export interface RadioGroupProps extends GroupProps {
  options: readonly RadioOption[];
  /** Shared input name; generated when omitted. */
  name?: string;
  /** Controlled selection; omit to let the group keep its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export function RadioGroup({ options, name, value, defaultValue, onChange, ...group }: RadioGroupProps): ReactElement {
  const generated = useId();
  const [local, setLocal] = useState(defaultValue);
  const selected = value !== undefined ? value : local;
  return (
    <ChoiceGroup {...group}>
      {options.map((option) => (
        <ChoiceItem
          key={option.value}
          type="radio"
          name={name ?? generated}
          value={option.value}
          label={option.label}
          description={option.description}
          disabledReason={option.disabledReason}
          checked={selected === option.value}
          onChange={(checked) => {
            if (!checked) return;
            if (value === undefined) setLocal(option.value);
            onChange?.(option.value);
          }}
        />
      ))}
    </ChoiceGroup>
  );
}

export interface CheckboxProps {
  label: string;
  /** Renders the checkbox as an option card. */
  description?: string;
  /** Controlled state; omit to let the checkbox keep its own. */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  /** Why the checkbox is unavailable. Setting it disables the checkbox. */
  disabledReason?: string;
  name?: string;
  value?: string;
}

export function Checkbox({ checked, defaultChecked = false, onChange, ...item }: CheckboxProps): ReactElement {
  const [current, setCurrent] = useBooleanState(checked, defaultChecked, onChange);
  return <ChoiceItem type="checkbox" {...item} checked={current} onChange={setCurrent} />;
}

export type CheckboxGroupProps = GroupProps & { children: ReactNode };

/** Groups independent `Checkbox`es under a `<fieldset>` and `<legend>`. */
export function CheckboxGroup(props: CheckboxGroupProps): ReactElement {
  return <ChoiceGroup {...props} />;
}
