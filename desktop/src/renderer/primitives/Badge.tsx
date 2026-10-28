/**
 * `Badge`: a count of a named category (DESIGN.md `components.Badge`).
 *
 * - `label` names what is counted and is required: the accessible text is
 *   "<count> <label>" (for example "3 items need evidence"); the visible
 *   number alone is hidden from assistive technology.
 * - A count changing never moves focus. Only a `live` badge is a polite live
 *   region, so its new count is announced without interrupting.
 * - Tones: attention (amber-500 with ink-900 text), neutral and accent. A
 *   count signals attention, never accepted or finished work.
 */
import type { ReactElement } from 'react';

export type BadgeTone = 'attention' | 'neutral' | 'accent';

export interface BadgeProps {
  count: number;
  /** What is counted, read after the number: "items need evidence". */
  label: string;
  tone?: BadgeTone;
  /** Announce count changes politely. */
  live?: boolean;
  className?: string;
}

export function Badge({ count, label, tone = 'attention', live = false, className }: BadgeProps): ReactElement {
  return (
    <span
      className={['iq-badge', `iq-badge--${tone}`, className].filter(Boolean).join(' ')}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? true : undefined}
    >
      <span aria-hidden="true">{count}</span>
      <span className="iq-visually-hidden">{`${count} ${label}`}</span>
    </span>
  );
}
