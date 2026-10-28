/**
 * `SegmentedControl`: one selected view among a few compact options
 * (DESIGN.md `components.SegmentedControl`).
 *
 * - Radio-group semantics: a `role="radiogroup"` named by `label`, one
 *   `<button role="radio" aria-checked>` per option.
 * - One tab stop (the selected segment). ArrowRight/ArrowDown and
 *   ArrowLeft/ArrowUp select and focus the next or previous segment, wrapping;
 *   Home and End select the first and last. Enter and Space select the
 *   focused segment (native button activation).
 * - Selection is shown by the ink-900 fill, white weight-500 text and
 *   `aria-checked`, never colour alone.
 *
 * Selecting only reports the value through `onChange`; it changes the view,
 * never data.
 */
import { useRef, useState, type KeyboardEvent, type ReactElement } from 'react';

import { rovingIndex } from './shared';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  /** Accessible name of the group. */
  label: string;
  options: readonly SegmentedOption[];
  /** Controlled selection; omit to let the control keep its own. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function SegmentedControl({ label, options, value, defaultValue, onChange, className }: SegmentedControlProps): ReactElement {
  const [local, setLocal] = useState(defaultValue ?? options[0]?.value);
  const selected = value !== undefined ? value : local;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selected),
  );

  const select = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (value === undefined) setLocal(option.value);
    if (option.value !== selected) onChange?.(option.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = rovingIndex(event.key, index, options.length, event.key === 'ArrowUp' || event.key === 'ArrowDown' ? 'vertical' : 'horizontal');
    if (target === null) return;
    event.preventDefault();
    select(target);
    refs.current[target]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={['iq-segmented', className].filter(Boolean).join(' ')}>
      {options.map((option, index) => {
        const checked = index === selectedIndex && option.value === selected;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === selectedIndex ? 0 : -1}
            className="iq-segment"
            onClick={() => select(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
