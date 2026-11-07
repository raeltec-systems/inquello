/**
 * `PlanStep` and `PlanSteps`: the steps of a plan and how far each actually
 * got (DESIGN.md `components.PlanStep`).
 *
 * - States `pending`, `running`, `done`, `blocked`, `failed` and
 *   `interrupted`, each with its own text: visible for running, blocked,
 *   failed and interrupted; visually hidden for pending and done, whose
 *   indicator shows the state.
 * - Only `done` shows the check (green-600). Done means the step actually
 *   finished; no other state borrows the check.
 * - `running` is the blue indicator with a pulsing inner dot (`iq-pulse`).
 *   Under `prefers-reduced-motion: reduce` the pulse stops and the visible
 *   "Running" text remains, so state never depends on animation.
 * - `PlanSteps` renders the steps as an ordered list with one polite live
 *   region. A step whose state changes between renders is announced once as
 *   "<step>: <state>"; the first render and visual pulses announce nothing.
 *
 * `PlanStep` renders an `<li>`; use it inside `PlanSteps` (or another `<ol>`).
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { Icon } from '../icons/Icon';

export const PLAN_STEP_STATES = ['pending', 'running', 'done', 'blocked', 'failed', 'interrupted'] as const;
export type PlanStepState = (typeof PLAN_STEP_STATES)[number];

/** The text of each state; it is announced in lower case. */
export const PLAN_STEP_TEXT: Record<PlanStepState, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  blocked: 'Blocked',
  failed: 'Failed',
  interrupted: 'Interrupted',
};

/** States whose text is visible; the others are read by assistive technology only. */
const VISIBLE_STATE: ReadonlySet<PlanStepState> = new Set(['running', 'blocked', 'failed', 'interrupted']);

export interface PlanStepProps {
  state: PlanStepState;
  label: string;
  /** Supporting detail, for example a count or duration. */
  meta?: string;
  className?: string;
}

export function PlanStep({ state, label, meta, className }: PlanStepProps): ReactElement {
  return (
    <li className={['iq-plan-step', `iq-plan-step--${state}`, className].filter(Boolean).join(' ')}>
      <span className="iq-plan-step-indicator" aria-hidden="true">
        {state === 'done' ? <Icon name="check" size={10} strokeWidth={3} /> : null}
        {state === 'running' ? <span className="iq-plan-step-pulse" /> : null}
      </span>
      <span className="iq-plan-step-label">{label}</span>
      <span className={VISIBLE_STATE.has(state) ? 'iq-plan-step-state' : 'iq-plan-step-state iq-visually-hidden'}>
        {VISIBLE_STATE.has(state) ? PLAN_STEP_TEXT[state] : `, ${PLAN_STEP_TEXT[state]}`}
      </span>
      {meta !== undefined && meta !== '' ? <span className="iq-plan-step-meta">{meta}</span> : null}
    </li>
  );
}

export interface PlanStepItem {
  /** Stable identity across renders; transitions are tracked by it. */
  id: string;
  label: string;
  state: PlanStepState;
  meta?: string;
}

export interface PlanStepsProps {
  /** Names the list, for example "Plan". */
  label: string;
  steps: readonly PlanStepItem[];
  className?: string;
}

/** The announcement for the steps whose state changed, or `null` when none did. */
export function transitionAnnouncement(previous: ReadonlyMap<string, PlanStepState>, steps: readonly PlanStepItem[]): string | null {
  const changed = steps.filter((step) => previous.has(step.id) && previous.get(step.id) !== step.state);
  if (changed.length === 0) return null;
  return changed.map((step) => `${step.label}: ${PLAN_STEP_TEXT[step.state].toLowerCase()}`).join('. ');
}

export function PlanSteps({ label, steps, className }: PlanStepsProps): ReactElement {
  const previous = useRef<Map<string, PlanStepState> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const before = previous.current;
    previous.current = new Map(steps.map((step) => [step.id, step.state]));
    if (before === null) return;
    const message = transitionAnnouncement(before, steps);
    if (message !== null) setAnnouncement(message);
  }, [steps]);
  return (
    <div className={['iq-plan', className].filter(Boolean).join(' ')}>
      <ol className="iq-plan-steps" aria-label={label}>
        {steps.map((step) => (
          <PlanStep key={step.id} state={step.state} label={step.label} meta={step.meta} />
        ))}
      </ol>
      <div className="iq-visually-hidden" aria-live="polite" aria-atomic="true" data-plan-announcer="">
        {announcement}
      </div>
    </div>
  );
}
