/**
 * `StatusChip`: the state of an evidence, review or reconciling item
 * (DESIGN.md `components.StatusChip`).
 *
 * - Exactly the seven source states, each with explicit visible text:
 *   Suggested (dashed blue), Investigating (pale ink), Open (outlined), Needs
 *   evidence and Awaiting client (amber), Accepted and Explained (pale green
 *   with green-800 text).
 * - Any other state needs a caller-supplied truthful `label`; a missing label
 *   is a type error. At runtime an unknown state renders the supplied label in
 *   the neutral outlined style; without one it renders nothing and warns.
 * - A status never claims execution completion, Professional Approval or
 *   delivery: a green chip names the item's Method state, not sign-off.
 */
import type { ReactElement } from 'react';

export const SOURCE_STATUSES = ['suggested', 'investigating', 'open', 'evidence', 'waiting', 'accepted', 'explained'] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** The source taxonomy's visible text for each state. */
export const STATUS_TEXT: Record<SourceStatus, string> = {
  suggested: 'Suggested',
  investigating: 'Investigating',
  open: 'Open',
  evidence: 'Needs evidence',
  waiting: 'Awaiting client',
  accepted: 'Accepted',
  explained: 'Explained',
};

interface CommonProps {
  className?: string;
}

/** A source state shows its own text; any other state must bring a truthful label. */
export type StatusChipProps = CommonProps & ({ status: SourceStatus; label?: never } | { status: string; label: string });

const isSourceStatus = (status: string): status is SourceStatus => (SOURCE_STATUSES as readonly string[]).includes(status);

export function StatusChip({ status, label, className }: StatusChipProps): ReactElement | null {
  if (isSourceStatus(status)) {
    if (label !== undefined && label !== STATUS_TEXT[status]) {
      console.warn(`StatusChip: "${status}" always reads ${JSON.stringify(STATUS_TEXT[status])}; the label ${JSON.stringify(label)} is ignored.`);
    }
    return <span className={['iq-status-chip', `iq-status-chip--${status}`, className].filter(Boolean).join(' ')}>{STATUS_TEXT[status]}</span>;
  }
  const text = label?.trim() ?? '';
  if (text === '') {
    console.warn(`StatusChip: ${JSON.stringify(status)} is not a source state and has no label; nothing rendered.`);
    return null;
  }
  return (
    <span className={['iq-status-chip', 'iq-status-chip--other', className].filter(Boolean).join(' ')} data-status={status}>
      {text}
    </span>
  );
}
