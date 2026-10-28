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
