/**
 * `ApprovalCard`: a request for permission to take one exact action
 * (DESIGN.md `components.ApprovalCard`).
 *
 * - Required: `context` (who or what is asking), `action` (the exact action),
 *   `destination`, `consequence`, `primaryLabel` and `onPrimary`. `quote`
 *   optionally shows the exact content that would be sent.
 * - The primary label names the action. A generic label (Approve, OK, Yes,
 *   Confirm, Continue) is rejected: a warning names it and nothing renders.
 *   Alternatives are optional, each with a real label and handler; one with a
 *   blank or generic label is dropped with a warning.
 * - The card is a labelled `region` ("Permission needed" plus the action). It
 *   never moves focus; the person reaches it in reading order.
 * - It grants nothing itself: the handlers are the caller's, and permission
 *   for one action is not Professional Approval.
 */
import { useId, type ReactElement, type ReactNode } from 'react';

import { Button } from './Button';

/** Labels that do not name an action. Compared trimmed, case-insensitive, without trailing punctuation. */
export const GENERIC_ACTION_LABELS = ['Approve', 'OK', 'Yes', 'Confirm', 'Continue'] as const;

/** The card's visible overline, also the start of the region's name. */
export const APPROVAL_OVERLINE = 'Permission needed';

export interface ApprovalAlternative {
  /** A real action label, for example "Edit the request". */
  label: string;
  onSelect: () => void;
}

export interface ApprovalCardProps {
  /** Who or what is asking, for example "Subsequent clearance · R4". */
  context: ReactNode;
  /** The exact action, for example "Send the October statement request to Northwind Ltd". */
  action: ReactNode;
  /** Where the action takes effect. */
  destination: ReactNode;
  /** What happens once it is done. */
  consequence: ReactNode;
  /** The exact content that would be sent. */
  quote?: ReactNode;
  /** Names the action, for example "Send October statement request". */
  primaryLabel: string;
  onPrimary: () => void;
  alternatives?: readonly ApprovalAlternative[];
  className?: string;
}

/** Whether `label` is blank or one of `GENERIC_ACTION_LABELS`. */
export function isGenericActionLabel(label: string): boolean {
  const normalised = label.trim().replace(/[.!?…]+$/u, '').trim().toLowerCase();
  return normalised === '' || GENERIC_ACTION_LABELS.some((generic) => generic.toLowerCase() === normalised);
}

export function ApprovalCard({
  context,
  action,
  destination,
  consequence,
  quote,
  primaryLabel,
  onPrimary,
  alternatives = [],
  className,
}: ApprovalCardProps): ReactElement | null {
  const id = useId();
  if (isGenericActionLabel(primaryLabel)) {
    console.warn(`ApprovalCard: ${JSON.stringify(primaryLabel)} does not name the action; use the exact action as the label. Nothing rendered.`);
    return null;
  }
  const usable = alternatives.filter((alternative) => {
    if (!isGenericActionLabel(alternative.label)) return true;
    console.warn(`ApprovalCard: the alternative ${JSON.stringify(alternative.label)} does not name an action; it is not shown.`);
    return false;
  });
  const overlineId = `${id}-overline`;
  const actionId = `${id}-action`;
  return (
    <section role="region" aria-labelledby={`${overlineId} ${actionId}`} className={['iq-approval', className].filter(Boolean).join(' ')}>
      <div className="iq-approval-head">
        <span id={overlineId} className="iq-approval-overline">
          {APPROVAL_OVERLINE}
        </span>
        <span className="iq-approval-context">{context}</span>
      </div>
      <p id={actionId} className="iq-approval-action">
        {action}
      </p>
      {quote !== undefined ? <blockquote className="iq-approval-quote">{quote}</blockquote> : null}
      <dl className="iq-approval-facts">
        <div className="iq-approval-fact">
          <dt>Destination</dt>
          <dd>{destination}</dd>
        </div>
        <div className="iq-approval-fact">
          <dt>Consequence</dt>
          <dd>{consequence}</dd>
        </div>
      </dl>
      <div className="iq-approval-actions">
        <Button variant="primary" onPress={() => onPrimary()}>
          {primaryLabel}
        </Button>
        {usable.map((alternative) => (
          <Button key={alternative.label} onPress={() => alternative.onSelect()}>
            {alternative.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
