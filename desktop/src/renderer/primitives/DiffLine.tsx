/**
 * `DiffLine`: one line of a proposed or applied change (DESIGN.md
 * `components.DiffLine`).
 *
 * - Kinds `add` (+), `delete` (−), `change` (~) and `context`. The sign is
 *   visible and the kind is accessible text ("Removed line, suggested"), so the
 *   meaning never rests on colour alone.
 * - `stage` is required and shows as visible text: Suggested, Applied locally
 *   or Delivered. It is the caller's truthful stage; the line applies nothing.
 * - `gutter` optionally shows the source line or row (muted, 40px column).
 */
import type { ReactElement, ReactNode } from 'react';

export type DiffKind = 'add' | 'delete' | 'change' | 'context';
export type DiffStage = 'suggested' | 'applied-locally' | 'delivered';

export const DIFF_SIGN: Record<DiffKind, string> = { add: '+', delete: '−', change: '~', context: '' };
export const DIFF_KIND_TEXT: Record<DiffKind, string> = {
  add: 'Added line',
  delete: 'Removed line',
  change: 'Changed line',
  context: 'Unchanged line',
};
export const DIFF_STAGE_TEXT: Record<DiffStage, string> = {
  suggested: 'Suggested',
  'applied-locally': 'Applied locally',
  delivered: 'Delivered',
};

export interface DiffLineProps {
  kind: DiffKind;
  stage: DiffStage;
  /** The source line, row or cell reference. */
  gutter?: string | number;
  children: ReactNode;
  className?: string;
}

export function DiffLine({ kind, stage, gutter, children, className }: DiffLineProps): ReactElement {
  const hasGutter = gutter !== undefined && gutter !== '';
  return (
    <div className={['iq-diff-line', `iq-diff-line--${kind}`, hasGutter ? 'iq-diff-line--gutter' : undefined, className].filter(Boolean).join(' ')}>
      {hasGutter ? <span className="iq-diff-gutter">{gutter}</span> : null}
      <span className="iq-diff-sign" aria-hidden="true">
        {DIFF_SIGN[kind]}
      </span>
      <span className="iq-visually-hidden">{`${DIFF_KIND_TEXT[kind]}, ${DIFF_STAGE_TEXT[stage].toLowerCase()}: `}</span>
      <span className="iq-diff-body">{children}</span>
      <span className="iq-diff-stage" aria-hidden="true">
        {DIFF_STAGE_TEXT[stage]}
      </span>
    </div>
  );
}
