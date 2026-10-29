/**
 * The 264px Sidebar (Story 1.14): the Workspace selector, the Engagements
 * section (each Engagement, then its folders, then their Tasks), the ad hoc
 * Tasks, and New thread.
 *
 * - Lists only the signed-in principal's own Tasks (main filters them; nothing
 *   here can list another creator's). There is no Share control.
 * - Engagement and folder creation use the Story 1.6 inputs. Creating an
 *   Engagement needs the shared service: while it is unavailable the button is
 *   disabled with main's reason, and existing Tasks still list and open.
 * - A failed creation keeps the draft and its operation ID, so a retry cannot
 *   create a second Engagement or folder.
 * - Story 1.16 hardens layout, keyboard and responsiveness; this is the
 *   minimal real Sidebar.
 */
import { useState, type FormEvent, type ReactElement } from 'react';

import { Button, IconButton, Menu, TextField, type MenuEntry } from '../primitives';
import type { EngagementItem, FolderItem, Outcome, TaskItem, WorkspacesState, WorkspaceTree } from './organise-bridge';

export interface EngagementDraft {
  name: string;
  objectives: string;
  scope: string;
  clientEntity: string;
  periodStart: string;
  periodEnd: string;
}

export const EMPTY_ENGAGEMENT: EngagementDraft = { name: '', objectives: '', scope: '', clientEntity: '', periodStart: '', periodEnd: '' };

export interface SidebarProps {
  state: WorkspacesState | null;
  workspaceId: string | null;
  tree: WorkspaceTree | null;
  openTaskId: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onOpenTask: (task: TaskItem) => void;
  onNewThread: () => void;
  onNewTask: (engagementId: string, folderId: string | null) => void;
  onCreateEngagement: (draft: EngagementDraft, operationId: string) => Promise<Outcome<EngagementItem>>;
  onCreateFolder: (engagementId: string, name: string, operationId: string) => Promise<Outcome<FolderItem>>;
  onSignIn: () => void;
  onShowSpecimen: () => void;
  newOperationId: () => string;
  busy: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Field errors the renderer can tell before main does; main and the domain still validate. */
export function engagementDraftErrors(draft: EngagementDraft): Partial<Record<keyof EngagementDraft, string>> {
  const errors: Partial<Record<keyof EngagementDraft, string>> = {};
  if (draft.name.trim() === '') errors.name = 'A name is required.';
  if (draft.periodStart.trim() !== '' && !DATE.test(draft.periodStart.trim())) errors.periodStart = 'Use YYYY-MM-DD.';
  if (draft.periodEnd.trim() !== '' && !DATE.test(draft.periodEnd.trim())) errors.periodEnd = 'Use YYYY-MM-DD.';
  if (!errors.periodStart && !errors.periodEnd && draft.periodStart.trim() && draft.periodEnd.trim() && draft.periodEnd.trim() < draft.periodStart.trim()) {
    errors.periodEnd = 'The period cannot end before it starts.';
  }
  return errors;
}

function TaskRow({ task, open, onOpen }: { task: TaskItem; open: boolean; onOpen: (task: TaskItem) => void }): ReactElement {
  return (
    <li className="iq-sidebar-task" data-task-id={task.taskId}>
      <button type="button" className="iq-sidebar-row" aria-current={open ? 'page' : undefined} onClick={() => onOpen(task)}>
        {task.title}
      </button>
    </li>
  );
}

function EngagementForm({
  onSubmit,
  onCancel,
  newOperationId,
}: {
  onSubmit: SidebarProps['onCreateEngagement'];
  onCancel: () => void;
  newOperationId: () => string;
}): ReactElement {
  const [draft, setDraft] = useState<EngagementDraft>(EMPTY_ENGAGEMENT);
  const [operationId] = useState(newOperationId);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const errors = submitted ? engagementDraftErrors(draft) : {};
  const set = (key: keyof EngagementDraft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (busy || Object.keys(engagementDraftErrors(draft)).length > 0) return;
    setBusy(true);
    setNotice(null);
    // The same operation ID on every retry of this draft: the shared service
    // replays its receipt instead of creating a second Engagement.
    const result = await onSubmit(draft, operationId);
    setBusy(false);
    if (result.ok) onCancel();
    else setNotice(result.reason);
  };

  return (
    <form className="iq-sidebar-form" aria-label="New Engagement" onSubmit={(event) => void submit(event)} data-engagement-form>
      <TextField label="Name" name="name" value={draft.name} onChange={set('name')} error={errors.name} />
      <TextField label="Objectives" name="objectives" multiline value={draft.objectives} onChange={set('objectives')} />
      <TextField label="Scope" name="scope" multiline value={draft.scope} onChange={set('scope')} />
      <TextField label="Client or entity" name="clientEntity" value={draft.clientEntity} onChange={set('clientEntity')} instruction="Optional." />
      <TextField label="Period start" name="periodStart" value={draft.periodStart} onChange={set('periodStart')} placeholder="YYYY-MM-DD" error={errors.periodStart} />
      <TextField label="Period end" name="periodEnd" value={draft.periodEnd} onChange={set('periodEnd')} placeholder="YYYY-MM-DD" error={errors.periodEnd} />
      {notice ? (
        <p className="iq-sidebar-notice" role="status" data-engagement-notice>
          {notice}
        </p>
      ) : null}
      <div className="iq-sidebar-form-actions">
        <Button variant="primary" size="sm" type="submit" pending={busy} data-action="submit-engagement">
          Create Engagement
        </Button>
        <Button variant="quiet" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FolderForm({
  engagement,
  onSubmit,
  onCancel,
  newOperationId,
}: {
  engagement: EngagementItem;
  onSubmit: SidebarProps['onCreateFolder'];
  onCancel: () => void;
  newOperationId: () => string;
}): ReactElement {
  const [name, setName] = useState('');
  const [operationId] = useState(newOperationId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (name.trim() === '') {
      setError('A name is required.');
      return;
    }
    setBusy(true);
    setError(undefined);
    const result = await onSubmit(engagement.engagementId, name, operationId);
    setBusy(false);
    if (result.ok) onCancel();
    else setError(result.reason);
  };

  return (
    <form className="iq-sidebar-form" aria-label={`New folder in ${engagement.name}`} onSubmit={(event) => void submit(event)} data-folder-form>
      <TextField label="Folder name" name="folderName" value={name} onChange={setName} error={error} />
      <div className="iq-sidebar-form-actions">
        <Button variant="primary" size="sm" type="submit" pending={busy} data-action="submit-folder">
          Create folder
        </Button>
        <Button variant="quiet" size="sm" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function Sidebar(props: SidebarProps): ReactElement {
  const { state, workspaceId, tree, openTaskId, onSelectWorkspace, onOpenTask, onNewThread, onNewTask, newOperationId, busy } = props;
  const [creatingEngagement, setCreatingEngagement] = useState(false);
  const [folderFor, setFolderFor] = useState<string | null>(null);

  if (!state || !state.signedIn) {
    return (
      <nav className="iq-sidebar" aria-label="Workspace navigation" data-sidebar data-sidebar-state={state ? 'signed-out' : 'loading'}>
        <p className="iq-sidebar-empty">{state ? 'Sign in to see your Workspaces and private Tasks.' : 'Loading…'}</p>
        {state ? (
          <Button variant="primary" size="sm" onPress={props.onSignIn} data-action="sign-in">
            Sign in
          </Button>
        ) : null}
        <div className="iq-sidebar-footer">
          <Button variant="ghost" size="sm" onPress={props.onShowSpecimen}>
            Design specimen
          </Button>
        </div>
      </nav>
    );
  }

  const workspace = state.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? null;
  const selector: MenuEntry = {
    kind: 'radio',
    label: 'Workspace',
    value: workspaceId ?? '',
    options: state.workspaces.map((entry) => ({
      value: entry.workspaceId,
      label: entry.name,
      description: entry.source === 'local' ? 'Remembered on this device' : undefined,
    })),
    onChange: onSelectWorkspace,
  };
  const engagements = tree?.engagements ?? [];
  const folders = tree?.folders ?? [];
  const tasks = tree?.tasks ?? [];
  const adHoc = tasks.filter((task) => task.engagementId === null);
  const noWorkspace = workspace ? undefined : 'Choose a Workspace first.';
  const creationReason = noWorkspace ?? (state.engagementCreation.enabled ? undefined : (state.engagementCreation.reason ?? 'Engagement creation is unavailable.'));

  return (
    <nav className="iq-sidebar" aria-label="Workspace navigation" data-sidebar data-sidebar-state="ready" data-shared-service={state.sharedService}>
      <div className="iq-sidebar-workspace" data-workspace-selector data-workspace-id={workspaceId ?? ''}>
        {state.workspaces.length > 0 ? (
          <Menu label={workspace ? workspace.name : 'Choose a Workspace'} heading="Workspace" items={[selector]} triggerVariant="ghost" />
        ) : (
          <p className="iq-sidebar-empty">No Workspace is available to you yet.</p>
        )}
      </div>
      <Button variant="primary" size="sm" icon="plus" onPress={onNewThread} disabledReason={noWorkspace} pending={busy} data-action="new-thread">
        New thread
      </Button>

      <section className="iq-sidebar-section" aria-labelledby="iq-sidebar-engagements">
        <h2 className="iq-sidebar-heading" id="iq-sidebar-engagements">
          Engagements
        </h2>
        {creatingEngagement ? (
          <EngagementForm onSubmit={props.onCreateEngagement} onCancel={() => setCreatingEngagement(false)} newOperationId={newOperationId} />
        ) : (
          <Button variant="quiet" size="sm" icon="plus" onPress={() => setCreatingEngagement(true)} disabledReason={creationReason} data-action="new-engagement">
            New Engagement
          </Button>
        )}
        <ul className="iq-sidebar-list">
          {engagements.map((engagement) => {
            const own = folders.filter((folder) => folder.engagementId === engagement.engagementId);
            const loose = tasks.filter((task) => task.engagementId === engagement.engagementId && task.folderId === null);
            return (
              <li key={engagement.engagementId} className="iq-sidebar-engagement" data-engagement-id={engagement.engagementId}>
                <div className="iq-sidebar-engagement-row">
                  <span className="iq-sidebar-engagement-name">{engagement.name}</span>
                  <IconButton icon="folder" label={`New folder in ${engagement.name}`} onPress={() => setFolderFor(engagement.engagementId)} data-action="new-folder" />
                  <IconButton icon="plus" label={`New Task in ${engagement.name}`} onPress={() => onNewTask(engagement.engagementId, null)} data-action="new-engagement-task" />
                </div>
                {folderFor === engagement.engagementId ? (
                  <FolderForm engagement={engagement} onSubmit={props.onCreateFolder} onCancel={() => setFolderFor(null)} newOperationId={newOperationId} />
                ) : null}
                <ul className="iq-sidebar-list iq-sidebar-list--nested">
                  {own.map((folder) => (
                    <li key={folder.folderId} className="iq-sidebar-folder" data-folder-id={folder.folderId}>
                      <div className="iq-sidebar-folder-row">
                        <span className="iq-sidebar-folder-name">{folder.name}</span>
                        <IconButton
                          icon="plus"
                          label={`New Task in ${folder.name}`}
                          onPress={() => onNewTask(engagement.engagementId, folder.folderId)}
                          data-action="new-folder-task"
                        />
                      </div>
                      <ul className="iq-sidebar-list iq-sidebar-list--nested">
                        {tasks
                          .filter((task) => task.folderId === folder.folderId)
                          .map((task) => (
                            <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
                          ))}
                      </ul>
                    </li>
                  ))}
                  {loose.map((task) => (
                    <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="iq-sidebar-section" aria-labelledby="iq-sidebar-adhoc" data-ad-hoc-tasks>
        <h2 className="iq-sidebar-heading" id="iq-sidebar-adhoc">
          Ad hoc Tasks
        </h2>
        {adHoc.length === 0 ? <p className="iq-sidebar-empty">No ad hoc Tasks.</p> : null}
        <ul className="iq-sidebar-list">
          {adHoc.map((task) => (
            <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
          ))}
        </ul>
      </section>

      <div className="iq-sidebar-footer">
        <Button variant="ghost" size="sm" onPress={props.onShowSpecimen}>
          Design specimen
        </Button>
      </div>
    </nav>
  );
}
