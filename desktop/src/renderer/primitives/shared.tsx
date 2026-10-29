/**
 * Helpers shared by the Story 1.6 primitives: the visible note that carries a
 * disabled reason or pending text, `aria-describedby` assembly, and a
 * controlled-or-uncontrolled boolean value.
 */
import { useCallback, useState, type ReactElement } from 'react';

import { icon } from '../design/tokens';

/** DESIGN.md `components.Icon.denseSize`: icons inside compact controls. */
export const DENSE_ICON_SIZE = Number.parseFloat(icon.denseSize);

/** Joins the ids of the descriptions that are present, or `undefined` when none are. */
export function describedBy(...ids: Array<string | false | null | undefined>): string | undefined {
  const present = ids.filter((id): id is string => typeof id === 'string' && id !== '');
  return present.length > 0 ? present.join(' ') : undefined;
}

/** A visible caption programmatically linked to its control through `aria-describedby`. */
export function Note({ id, children }: { id: string; children: string }): ReactElement {
  return (
    <span id={id} className="iq-note">
      {children}
    </span>
  );
}

/** A boolean that is controlled when `value` is defined and kept locally otherwise. */
export function useBooleanState(
  value: boolean | undefined,
  defaultValue: boolean,
  onChange: ((next: boolean) => void) | undefined,
): [boolean, (next: boolean) => void] {
  const [local, setLocal] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : local;
  const set = useCallback(
    (next: boolean) => {
      if (!controlled) setLocal(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [current, set];
}

/**
 * Roving focus for the Story 1.7 composites: the index a navigation key moves
 * to in a wrapping list of `count` items, or `null` for any other key.
 * `axis` picks the arrow pair; Home and End go to the first and last item.
 */
export function rovingIndex(key: string, index: number, count: number, axis: 'horizontal' | 'vertical'): number | null {
  if (count === 0) return null;
  const [previous, next] = axis === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  if (key === next) return (index + 1) % count;
  if (key === previous) return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * A stable DOM id fragment for a caller-supplied value, distinct for distinct
 * values: ASCII letters, digits and `-` stay as they are, and every other
 * character (including `_`) becomes `_<hex code point>_`. So `a.b` and `a b`
 * give `a_2e_b` and `a_20_b`, and no two values share an id.
 */
export function idFragment(value: string): string {
  let out = '';
  for (const char of value) out += /^[A-Za-z0-9-]$/.test(char) ? char : `_${char.codePointAt(0)!.toString(16)}_`;
  return out;
}
