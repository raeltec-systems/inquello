/**
 * `JudgmentTag`: what kind of claim a figure or statement is
 * (DESIGN.md `components.JudgmentTag`).
 *
 * - Five kinds: calculation (ƒ, ink), observation (◦, muted), suggestion
 *   (dashed blue box), decision (green dot) and gap (–, amber).
 * - The kind is visible text, so it is part of the accessible text, and it sits
 *   beside the claim's readable content (`children`). The glyph is decorative.
 * - A `decision` names its `basis`: the person or policy that decided and the
 *   scope it covers. TypeScript requires it. At runtime a decision without a
 *   complete basis reads "Decision (basis missing)", loses the green dot (agent
 *   text never gains human authority through styling) and warns.
 * - `uppercase` (default) is the 10px mono label; `false` is the 11px
 *   sentence-case legend style.
 */
import type { ReactElement, ReactNode } from 'react';

export const JUDGMENT_KINDS = ['calculation', 'observation', 'suggestion', 'decision', 'gap'] as const;
export type JudgmentKind = (typeof JUDGMENT_KINDS)[number];

/** The visible, readable name of each kind. */
export const JUDGMENT_TEXT: Record<JudgmentKind, string> = {
  calculation: 'Calculation',
  observation: 'Observation',
  suggestion: 'Suggestion',
  decision: 'Decision',
  gap: 'Gap',
};

/** Shown in place of "Decision" when a decision has no complete basis. */
export const MISSING_BASIS_TEXT = 'Decision (basis missing)';

/** Who or what decided, and what the decision covers. */
export interface JudgmentBasis {
  /** The named person or policy. */
  by: string;
  /** What the decision covers, for example "Q3 bank reconciliation". */
  scope: string;
}

interface CommonProps {
  /** The claim's readable content, shown beside the tag. */
  children: ReactNode;
  uppercase?: boolean;
  className?: string;
}

export type JudgmentTagProps = CommonProps &
  ({ kind: 'decision'; basis: JudgmentBasis } | { kind: Exclude<JudgmentKind, 'decision'>; basis?: never });

const GLYPHS: Partial<Record<JudgmentKind, string>> = { calculation: 'ƒ', observation: '◦', gap: '–' };

const hasBasis = (basis: JudgmentBasis | undefined): basis is JudgmentBasis =>
  basis !== undefined && basis.by.trim() !== '' && basis.scope.trim() !== '';

export function JudgmentTag({ kind, basis, children, uppercase = true, className }: JudgmentTagProps): ReactElement {
  const known = (JUDGMENT_KINDS as readonly string[]).includes(kind);
  const unbased = kind === 'decision' && !hasBasis(basis);
  if (!known) console.warn(`JudgmentTag: ${JSON.stringify(kind)} is not a judgment kind; only the claim is shown.`);
  if (unbased) console.warn('JudgmentTag: a decision needs a basis naming the person or policy and its scope; shown as "Decision (basis missing)".');
  const variant = unbased ? 'unbased' : kind;
  const glyph = GLYPHS[kind];
  return (
    <span
      className={['iq-judgment', `iq-judgment--${variant}`, uppercase ? undefined : 'iq-judgment--sentence', className].filter(Boolean).join(' ')}
    >
      {known ? (
        <span className="iq-judgment-tag">
          {unbased ? null : glyph !== undefined ? (
            <span className="iq-judgment-mark" aria-hidden="true">
              {glyph}
            </span>
          ) : (
            <span className="iq-judgment-mark iq-judgment-mark--shape" aria-hidden="true" />
          )}
          <span className="iq-judgment-kind">{unbased ? MISSING_BASIS_TEXT : JUDGMENT_TEXT[kind]}</span>
        </span>
      ) : null}
      {/* The text space keeps "Decision by …" apart in the accessible text; flex layout drops it visually. */}
      {kind === 'decision' && hasBasis(basis) ? (
        <>
          {' '}
          <span className="iq-judgment-basis">{`by ${basis.by} (${basis.scope})`}</span>
        </>
      ) : null}
      {known ? <span className="iq-visually-hidden">: </span> : null}
      <span className="iq-judgment-claim">{children}</span>
    </span>
  );
}
