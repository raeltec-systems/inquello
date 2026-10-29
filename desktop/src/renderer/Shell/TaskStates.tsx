/**
 * The open Task's States section (Story 1.15).
 *
 * - Every dimension is listed on its own row with its latest value, or "Not
 *   recorded"; nothing is defaulted or derived from another dimension.
 * - Every value goes through StatusChip's custom `label` path, so it renders
 *   in the neutral outlined style with its own truthful text. A finished run
 *   reads "Execution finished", never accepted, approved or done, and nothing
 *   here is ever green.
 * - The approval and delivery markers say they are local markers, not an
 *   authoritative record.
 * - Earlier records of a dimension are listed under it, latest first, with
 *   their version and who recorded them.
 */
import type { ReactElement } from 'react';

import { StatusChip } from '../primitives';
import { ACTOR_TEXT, DIMENSION_LABEL, NOT_RECORDED, STATE_DIMENSIONS, stateText, type StateRecordItem, type TaskStatesItem } from './state-bridge';

export interface TaskStatesProps {
  states: TaskStatesItem | null;
  /** Why the states could not be read, if they could not. */
  notice?: string | null;
}

/** The chip's status key: never one of StatusChip's source states. */
const statusKey = (record: StateRecordItem) => `${record.dimension}:${record.value}`;

function recordMeta(record: StateRecordItem): string {
  return `Version ${record.version}, recorded by ${ACTOR_TEXT[record.actorKind]}`;
}

function StateValue({ record }: { record: StateRecordItem }): ReactElement {
  return <StatusChip status={statusKey(record)} label={stateText(record.dimension, record.value) ?? record.value} />;
}

export function TaskStates({ states, notice }: TaskStatesProps): ReactElement {
  return (
    <section className="iq-task-states" aria-labelledby="iq-task-states-heading" data-task-states>
      <h2 id="iq-task-states-heading" className="iq-task-states-heading">
        States
      </h2>
      {notice ? (
        <p className="iq-task-notice" role="status" data-task-states-notice>
          {notice}
        </p>
      ) : null}
      <dl className="iq-task-states-list">
        {STATE_DIMENSIONS.map((dimension) => {
          const records = states?.dimensions.find((entry) => entry.dimension === dimension)?.records ?? [];
          const [latest, ...earlier] = records;
          return (
            <div key={dimension} className="iq-task-state" data-state-dimension={dimension} data-state-value={latest?.value ?? 'not-recorded'}>
              <dt className="iq-task-state-name">{DIMENSION_LABEL[dimension]}</dt>
              <dd className="iq-task-state-value">
                {latest ? (
                  <>
                    <StateValue record={latest} />
                    <span className="iq-task-state-meta">{recordMeta(latest)}</span>
                  </>
                ) : (
                  <span className="iq-task-state-none">{NOT_RECORDED}</span>
                )}
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
