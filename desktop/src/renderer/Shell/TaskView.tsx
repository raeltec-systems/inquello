import { ProcessingRoutes } from '../ProcessingRoutes';
/**
 * The open Task (Story 1.14): a placeholder thread area, the Task's privacy,
 * and the two organisation commands a Task has today: rename and move.
 *
 * - Rename keeps the typed draft when the Task changed first (a stale
 *   revision): the conflict is shown and nothing is lost. A retry of the same
 *   save reuses its operation ID.
 * - Move offers no Engagement (ad hoc), each Engagement, and each of its
 *   folders. A move keeps the Task's ID, thread and references; it never
 *   changes who can see it.
 * - The States section (Story 1.15) lists every state dimension separately,
 *   each with its value or "Not recorded".
 * - The policy section (Story 1.18) summarises the effective policy on this
 *   device and the Task's execution mode, with the explicit confirmation a
 *   broader mode needs.
 * - The Composer (Story 1.17) sits below in the Shell; runtime threads come with Story 1.25:
 *   nothing here starts work.
 */
import { useEffect, useState, type FormEvent, type ReactElement } from 'react';

import { Button, Menu, TextField, type MenuEntry } from '../primitives';
import type { EngagementItem, FolderItem, Outcome, TaskItem } from './organise-bridge';
import type { TaskPolicyItem } from '../policy-bridge';
import type { TaskStatesItem } from './state-bridge';
import { TaskPolicy } from './TaskPolicy';
import { TaskStates } from './TaskStates';
import { TaskEnvironment } from './TaskEnvironment';
import { TaskUsage } from './TaskUsage';

export interface MoveTarget {
  engagementId: string | null;
  folderId: string | null;
}

export interface TaskViewProps {
  task: TaskItem;
  engagements: readonly EngagementItem[];
  folders: readonly FolderItem[];
  onRename: (task: TaskItem, title: string, operationId: string) => Promise<Outcome<TaskItem>>;
  onMove: (task: TaskItem, target: MoveTarget) => Promise<Outcome<TaskItem>>;
  newOperationId: () => string;
  /** The Task's states (Story 1.15); null until read. */
  states?: TaskStatesItem | null;
  /** Why the states could not be read, if they could not. */
  statesNotice?: string | null;
  /** The Task's effective policy and execution mode (Story 1.18); null until read. */
  policy?: TaskPolicyItem | null;
  /** Why the policy could not be read, if it could not. */
  policyNotice?: string | null;
  /** Sets the Task's execution mode; resolves with a reason when refused. */
  onSetMode?: (mode: 'standard' | 'no_prompt' | 'full_access', confirmation: string | null) => Promise<string | null>;
}

const AD_HOC = 'ad-hoc';

export function targetKey(target: MoveTarget): string {
  if (!target.engagementId) return AD_HOC;
  return target.folderId ? `folder:${target.folderId}` : `engagement:${target.engagementId}`;
}

export function TaskView({
  task,
  engagements,
  folders,
  onRename,
  onMove,
  newOperationId,
  states = null,
  statesNotice = null,
  policy = null,
  policyNotice = null,
  onSetMode,
}: TaskViewProps): ReactElement {
  const [draft, setDraft] = useState(task.title);
  const [renameOp, setRenameOp] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A different Task opened: start from its title.
  useEffect(() => {
    setDraft(task.title);
    setRenameOp(null);
    setNotice(null);
  }, [task.taskId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || draft.trim() === '' || draft.trim() === task.title) return;
    const operationId = renameOp ?? newOperationId();
    setRenameOp(operationId);
    setBusy(true);
    setNotice(null);
    const result = await onRename(task, draft, operationId);
    setBusy(false);
    if (result.ok) {
      setRenameOp(null);
      setDraft(result.value.title);
    } else {
      // The draft stays; a conflict needs a new operation against the new revision.
      if (result.code === 'conflict') setRenameOp(null);
      setNotice(result.reason);
    }
  };

  const targets: MenuEntry = {
    kind: 'radio',
    label: 'Move to',
    value: targetKey(task),
    options: [
      { value: AD_HOC, label: 'No Engagement (ad hoc)' },
      ...engagements.flatMap((engagement) => [
        { value: `engagement:${engagement.engagementId}`, label: engagement.name },
        ...folders
          .filter((folder) => folder.engagementId === engagement.engagementId)
          .map((folder) => ({ value: `folder:${folder.folderId}`, label: `${engagement.name} / ${folder.name}` })),
      ]),
    ],
    onChange: (value) => {
      let target: MoveTarget = { engagementId: null, folderId: null };
      if (value.startsWith('engagement:')) target = { engagementId: value.slice('engagement:'.length), folderId: null };
      if (value.startsWith('folder:')) {
        const folder = folders.find((item) => item.folderId === value.slice('folder:'.length));
        if (!folder) return;
        target = { engagementId: folder.engagementId, folderId: folder.folderId };
      }
      if (targetKey(target) === targetKey(task)) return;
      setNotice(null);
      void onMove(task, target).then((result) => {
        if (!result.ok) setNotice(result.reason);
      });
    },
  };

  return (
    <section className="iq-task" aria-label="Task" data-task-view={task.taskId}>
      <div className="iq-task-tools">
        <form className="iq-task-rename" onSubmit={(event) => void save(event)} data-task-rename>
          <TextField label="Task title" value={draft} onChange={setDraft} />
          <Button variant="secondary" size="sm" type="submit" pending={busy} disabledReason={draft.trim() === '' ? 'A title is required.' : undefined}>
            Rename
          </Button>
        </form>
        <div data-task-move>
          <Menu label="Move" heading="Move this Task" items={[targets]} triggerVariant="secondary" />
        </div>
      </div>
      {notice ? (
        <p className="iq-task-notice" role="status" data-task-notice>
          {notice}
        </p>
      ) : null}
      <TaskEnvironment taskId={task.taskId} />
      <ProcessingRoutes taskId={task.taskId} />
      <TaskUsage taskId={task.taskId} />
      <TaskStates states={states && states.taskId === task.taskId ? states : null} notice={statesNotice} />
      <TaskPolicy policy={policy && policy.taskId === task.taskId ? policy : null} notice={policyNotice} onSetMode={onSetMode} />
      <div className="iq-thread-placeholder" data-thread-placeholder>
        <p className="iq-thread-placeholder-title">This Task has no thread yet.</p>
        <p className="iq-thread-placeholder-body">
          Requests and replies will appear here once runtime threads arrive. Only you can see this Task; moving it never shares it.
        </p>
      </div>
    </section>
  );
}
