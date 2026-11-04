/**
 * Recorded Task states in the conversation (Story 1.15, owner amendment
 * 2026-11-04, following the Codex desktop pattern).
 *
 * - Execution is shown elsewhere: the sidebar's live status and the neutral
 *   end-of-turn line. The Task, run and output dimensions are not listed here.
 * - Checks, review, Professional Approval and Delivery appear only once a
 *   record exists. Nothing is defaulted and there is no "Not recorded"
 *   placeholder; with no record this renders nothing.
 * - Every value goes through StatusChip's custom `label` path, so it renders
 *   in the neutral outlined style with its own truthful text, never green and
 *   never accepted, approved or done. The approval and delivery markers say
 *   they are local markers, not an authoritative record.
 * - Earlier records of a dimension are listed under it, latest first, with
 *   their version and who recorded them.
 */
import type { ReactElement } from 'react';

import { StatusChip } from '../primitives';
import { ACTOR_TEXT, DIMENSION_LABEL, stateText, type StateDimension, type StateRecordItem, type TaskStatesItem } from './state-bridge';

/** The dimensions shown in the conversation, and only when recorded. */
export const RECORDED_ONLY_DIMENSIONS = ['checks', 'review', 'approval_marker', 'delivery_marker'] as const satisfies readonly StateDimension[];

export interface TaskStatesProps {
  states: TaskStatesItem | null;
}

/** The chip's status key: never one of StatusChip's source states. */
const statusKey = (record: StateRecordItem) => `${record.dimension}:${record.value}`;

function recordMeta(record: StateRecordItem): string {
  return `Version ${record.version}, recorded by ${ACTOR_TEXT[record.actorKind]}`;
}

export function TaskStates({ states }: TaskStatesProps): ReactElement | null {
  const recorded = RECORDED_ONLY_DIMENSIONS.flatMap((dimension) => {
    const records = states?.dimensions.find((entry) => entry.dimension === dimension)?.records ?? [];
    return records.length ? [{ dimension, records }] : [];
  });
  if (!recorded.length) return null;
  return (
    <section className="iq-task-states" aria-label="Recorded states" data-task-states>
      <dl className="iq-task-states-list">
        {recorded.map(({ dimension, records }) => {
          const [latest, ...earlier] = records as [StateRecordItem, ...StateRecordItem[]];
          return (
            <div key={dimension} className="iq-task-state" data-state-dimension={dimension} data-state-value={latest.value}>
              <dt className="iq-task-state-name">{DIMENSION_LABEL[dimension]}</dt>
              <dd className="iq-task-state-value">
                <StatusChip status={statusKey(latest)} label={stateText(latest.dimension, latest.value) ?? latest.value} />
                <span className="iq-task-state-meta">{recordMeta(latest)}</span>
                {earlier.length > 0 ? (
                  <ol className="iq-task-state-history" aria-label={`Earlier ${DIMENSION_LABEL[dimension]} states`} data-state-history>
                    {earlier.map((record) => (
                      <li key={record.revision}>
                        {stateText(record.dimension, record.value)} <span className="iq-task-state-meta">({recordMeta(record)})</span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
