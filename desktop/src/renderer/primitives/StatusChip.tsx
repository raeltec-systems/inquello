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
 * - `decidedBy` adds the 16px decision disc (green-600, white initials) beside
 *   the chip. It names the person who made the call and needs the recorded
 *   identity of that decision; without one the disc is not shown. Its
 *   accessible name is "Decided by <name>", never approval.
 */
import type { ReactElement } from 'react';

import type { AvatarDecision } from './Avatar';

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

/** The person who made the call on this item, as recorded. */
export interface StatusDecision extends AvatarDecision {
  /** The full readable identity; part of the accessible name. */
  name: string;
  /** Supplementary visible initials on the disc. */
  initials: string;
}

interface CommonProps {
  className?: string;
  decidedBy?: StatusDecision;
}

/** A source state shows its own text; any other state must bring a truthful label. */
export type StatusChipProps = CommonProps & ({ status: SourceStatus; label?: never } | { status: string; label: string });

const isSourceStatus = (status: string): status is SourceStatus => (SOURCE_STATUSES as readonly string[]).includes(status);

function DecisionDisc({ decision }: { decision: StatusDecision }): ReactElement | null {
  if (decision.recordedIdentity.trim() === '') {
    console.warn(`StatusChip: the decision by ${JSON.stringify(decision.name)} has no recorded identity; the decision disc is not shown.`);
    return null;
  }
  return (
    <span role="img" aria-label={`Decided by ${decision.name}`} className="iq-status-decision">
      <span aria-hidden="true">{decision.initials}</span>
    </span>
  );
}

function withDecision(chip: ReactElement, decidedBy: StatusDecision | undefined): ReactElement {
  if (decidedBy === undefined) return chip;
  return (
    <span className="iq-status-chip-group">
      {chip}
      <DecisionDisc decision={decidedBy} />
    </span>
  );
}

export function StatusChip({ status, label, className, decidedBy }: StatusChipProps): ReactElement | null {
  if (isSourceStatus(status)) {
    if (label !== undefined && label !== STATUS_TEXT[status]) {
      console.warn(`StatusChip: "${status}" always reads ${JSON.stringify(STATUS_TEXT[status])}; the label ${JSON.stringify(label)} is ignored.`);
    }
    return withDecision(
      <span className={['iq-status-chip', `iq-status-chip--${status}`, className].filter(Boolean).join(' ')}>{STATUS_TEXT[status]}</span>,
      decidedBy,
    );
  }
  const text = label?.trim() ?? '';
  if (text === '') {
    console.warn(`StatusChip: ${JSON.stringify(status)} is not a source state and has no label; nothing rendered.`);
    return null;
  }
  return withDecision(
    <span className={['iq-status-chip', 'iq-status-chip--other', className].filter(Boolean).join(' ')} data-status={status}>
      {text}
    </span>,
    decidedBy,
  );
}
