/**
 * `TextField`: a labelled native `<input>` or `<textarea>` (DESIGN.md
 * `components.TextField`).
 *
 * - The `<label>` is always rendered and stays visible; `placeholder` is an
 *   optional hint and never the label.
 * - `instruction`, `error` and `disabledReason` are visible text linked
 *   through `aria-describedby`; `error` also sets `aria-invalid="true"`.
 * - Setting an error never touches the value: an uncontrolled field keeps
 *   what was typed, a controlled one keeps the caller's `value`.
 * - `readOnly` keeps the value focusable and selectable; `disabledReason`
 *   disables the field and says why.
 */
import { useId, type ChangeEvent, type InputHTMLAttributes, type ReactElement, type TextareaHTMLAttributes } from 'react';

import { Icon } from '../icons/Icon';
import { DENSE_ICON_SIZE, describedBy, Note } from './shared';

interface FieldProps {
  /** Persistent visible label and accessible name. */
  label: string;
  /** Visible guidance, linked to the field. */
  instruction?: string;
  /** Visible error, linked to the field; also sets `aria-invalid`. */
  error?: string;
  /** Why the field is unavailable. Setting it disables the field. */
  disabledReason?: string;
  readOnly?: boolean;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  name?: string;
  id?: string;
  /** Receives the new text; the field does nothing else with it. */
  onChange?: (value: string) => void;
  className?: string;
}

type SingleProps = FieldProps & {
  multiline?: false;
  type?: 'text' | 'search' | 'email' | 'url' | 'tel' | 'password';
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
};
type MultilineProps = FieldProps & {
  multiline: true;
  rows?: number;
};

export type TextFieldProps = SingleProps | MultilineProps;

export function TextField(props: TextFieldProps): ReactElement {
  const { label, instruction, error, disabledReason, readOnly, value, defaultValue, placeholder, name, onChange, className } = props;
  const generated = useId();
  const id = props.id ?? `${generated}field`;
  const instructionId = `${id}-instruction`;
  const errorId = `${id}-error`;
  const reasonId = `${id}-reason`;
  const unavailable = disabledReason !== undefined && disabledReason !== '';
  const invalid = error !== undefined && error !== '';
  const shared = {
    id,
    name,
    value,
    defaultValue,
    placeholder,
    readOnly,
    disabled: unavailable,
    className: 'iq-field-control',
    'aria-invalid': invalid ? true : undefined,
    'aria-describedby': describedBy(instruction && instructionId, invalid && errorId, unavailable && reasonId),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange?.(event.target.value),
  } satisfies InputHTMLAttributes<HTMLInputElement> & TextareaHTMLAttributes<HTMLTextAreaElement>;
  return (
    <div className={['iq-field', className].filter(Boolean).join(' ')}>
      <label className="iq-field-label" htmlFor={id}>
        {label}
      </label>
      {instruction ? (
        <span id={instructionId} className="iq-field-instruction">
          {instruction}
        </span>
      ) : null}
      {props.multiline ? (
        <textarea {...shared} rows={props.rows ?? 2} />
      ) : (
        <input {...shared} type={props.type ?? 'text'} autoComplete={props.autoComplete} />
      )}
      {invalid ? (
        <span id={errorId} className="iq-field-error">
          <Icon name="circle-alert" size={DENSE_ICON_SIZE} />
          <span>{error}</span>
        </span>
      ) : null}
      {unavailable ? <Note id={reasonId}>{disabledReason}</Note> : null}
    </div>
  );
}
