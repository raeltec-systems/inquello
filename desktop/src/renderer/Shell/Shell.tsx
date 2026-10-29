/**
 * The desktop Shell (Story 1.14): Sidebar, Header and the open Task.
 *
 * It talks to main only through the named `inquello.organise` operations (and
 * `inquello.identity.signIn` from the signed-out Sidebar). Main binds the
 * signed-in principal, so nothing here names one. Every mutation carries a
 * fresh operation ID per user action; a retry of the same action reuses it.
 * The Workspace list and tree are re-read after each change and every 30s.
 * The open Task's states (Story 1.15) are read through `inquello.state.list`
 * when it opens and with every refresh; the Shell never records one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import { identityBridge } from '../bridge';
import { Header } from './Header';
import {
  newOperationId,
  organiseBridge,
  parseEngagement,
  parseFolder,
  parseOutcome,
  parseTask,
  parseTree,
  parseWorkspaces,
  type EngagementItem,
  type FolderItem,
  type Outcome,
  type TaskItem,
  type WorkspacesState,
  type WorkspaceTree,
} from './organise-bridge';
import { Sidebar, type EngagementDraft } from './Sidebar';
import { parseTaskStates, stateBridge, type TaskStatesItem } from './state-bridge';
import { TaskView, type MoveTarget } from './TaskView';

const REFRESH_MS = 30_000;
export const UNTITLED_TASK = 'Untitled thread';

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export interface ShellProps {
  onShowSpecimen: () => void;
  /** Tests inject a deterministic ID source. */
  operationIds?: () => string;
}

export function Shell({ onShowSpecimen, operationIds = newOperationId }: ShellProps): ReactElement {
  const bridge = organiseBridge();
  const [state, setState] = useState<WorkspacesState | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  // The periodic reload reads the current choice without re-creating itself.
  const chosenWorkspace = useRef<string | null>(null);
  const setWorkspaceId = (id: string | null) => {
    chosenWorkspace.current = id;
    setWorkspaceIdState(id);
  };
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [states, setStates] = useState<TaskStatesItem | null>(null);
  const [statesNotice, setStatesNotice] = useState<string | null>(null);
  const openTask = useRef<string | null>(null);
  openTask.current = openTaskId;

  /** Reads one Task's states; a malformed or refused answer is shown as unread, never half-read. */
  const loadStates = useCallback(async (taskId: string | null) => {
    const api = stateBridge();
    if (!api || !taskId) {
      setStates(null);
      setStatesNotice(null);
      return;
    }
    let result: Outcome<TaskStatesItem>;
    try {
      result = parseOutcome(await api.list({ taskId }), parseTaskStates);
    } catch {
      result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
    }
    // Another Task opened meanwhile: its own read wins.
    if (openTask.current !== taskId) return;
    if (result.ok) {
      setStates(result.value);
      setStatesNotice(null);
    } else {
      setStates(null);
      setStatesNotice(`States could not be read. ${result.reason}`);
    }
  }, []);

  useEffect(() => {
    void loadStates(openTaskId);
  }, [openTaskId, loadStates]);

  const loadTree = useCallback(
    async (id: string | null) => {
      if (!bridge || !id) {
        setTree(null);
        return;
      }
      const result = parseOutcome(await bridge.getTree({ workspaceId: id }), parseTree);
      if (result.ok) setTree(result.value);
      else setNotice(result.reason);
      if (openTask.current) await loadStates(openTask.current);
    },
    [bridge, loadStates],
  );

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parseWorkspaces(await bridge.getWorkspaces());
      if (!next) {
        setNotice('Your Workspaces could not be read.');
        return;
      }
      setState(next);
      const ids = next.workspaces.map((workspace) => workspace.workspaceId);
      const current = chosenWorkspace.current;
      const chosen = current && ids.includes(current) ? current : (ids[0] ?? null);
      chosenWorkspace.current = chosen;
      setWorkspaceIdState(chosen);
      await loadTree(chosen);
    } catch {
      setNotice('Your Workspaces could not be read.');
    }
  }, [bridge, loadTree]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const selectWorkspace = (id: string) => {
    setWorkspaceId(id);
    setOpenTaskId(null);
    void loadTree(id);
  };

  /** Runs one mutation, then re-reads the tree; a refusal is shown, never hidden. */
  const mutate = async <T,>(call: () => Promise<unknown>, parse: (value: unknown) => T | null): Promise<Outcome<T>> => {
    let result: Outcome<T>;
    try {
      result = parseOutcome(await call(), parse);
    } catch {
      result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
    }
    if (result.ok) setNotice(null);
    await loadTree(chosenWorkspace.current);
    return result;
  };

  const createTask = async (engagementId: string | null, folderId: string | null) => {
    if (!bridge || !workspaceId || creatingTask) return;
    setCreatingTask(true);
    const operationId = operationIds();
    const result = await mutate(() => bridge.createTask({ operationId, workspaceId, engagementId, folderId, title: UNTITLED_TASK }), parseTask);
    setCreatingTask(false);
    if (result.ok) setOpenTaskId(result.value.taskId);
    else setNotice(result.reason);
  };

  const createEngagement = (draft: EngagementDraft, operationId: string): Promise<Outcome<EngagementItem>> => {
    if (!bridge || !workspaceId) return Promise.resolve({ ok: false, code: 'invalid', reason: 'Choose a Workspace first.' });
    return mutate(
      () =>
        bridge.createEngagement({
          operationId,
          workspaceId,
          name: draft.name,
          objectives: draft.objectives,
          scope: draft.scope,
          clientEntity: blankToNull(draft.clientEntity),
          periodStart: blankToNull(draft.periodStart),
          periodEnd: blankToNull(draft.periodEnd),
        }),
      parseEngagement,
    );
  };

  const createFolder = (engagementId: string, name: string, operationId: string): Promise<Outcome<FolderItem>> => {
    if (!bridge || !workspaceId) return Promise.resolve({ ok: false, code: 'invalid', reason: 'Choose a Workspace first.' });
    return mutate(() => bridge.createFolder({ operationId, workspaceId, engagementId, name }), parseFolder);
  };

  const renameTask = (task: TaskItem, title: string, operationId: string): Promise<Outcome<TaskItem>> => {
    if (!bridge) return Promise.resolve({ ok: false, code: 'failed', reason: 'The request did not complete.' });
    return mutate(() => bridge.renameTask({ operationId, workspaceId: task.workspaceId, taskId: task.taskId, expectedRevision: task.revision, title }), parseTask);
  };

  const moveTask = (task: TaskItem, target: MoveTarget): Promise<Outcome<TaskItem>> => {
    if (!bridge) return Promise.resolve({ ok: false, code: 'failed', reason: 'The request did not complete.' });
    return mutate(
      () =>
        bridge.moveTask({
          operationId: operationIds(),
          workspaceId: task.workspaceId,
          taskId: task.taskId,
          expectedRevision: task.revision,
          engagementId: target.engagementId,
          folderId: target.folderId,
        }),
      parseTask,
    );
  };

  const signIn = async () => {
    const identity = identityBridge();
    if (!identity) return;
    try {
      await identity.signIn();
    } finally {
      await load();
    }
  };

  const task = useMemo(() => tree?.tasks.find((item) => item.taskId === openTaskId) ?? null, [tree, openTaskId]);
  const engagement = useMemo(() => (task?.engagementId ? (tree?.engagements.find((item) => item.engagementId === task.engagementId) ?? null) : null), [tree, task]);
  const workspace = state?.workspaces.find((item) => item.workspaceId === workspaceId) ?? null;

  return (
    <div className="iq-shell" data-shell>
      <Sidebar
        state={state}
        workspaceId={workspaceId}
        tree={tree}
        openTaskId={openTaskId}
        onSelectWorkspace={selectWorkspace}
        onOpenTask={(item) => setOpenTaskId(item.taskId)}
        onNewThread={() => void createTask(null, null)}
        onNewTask={(engagementId, folderId) => void createTask(engagementId, folderId)}
        onCreateEngagement={createEngagement}
        onCreateFolder={createFolder}
        onSignIn={() => void signIn()}
        onShowSpecimen={onShowSpecimen}
        newOperationId={operationIds}
        busy={creatingTask}
      />
      <div className="iq-shell-main">
        <Header task={task} engagement={engagement} workspace={workspace} />
        <main className="iq-shell-content">
          {notice ? (
            <p className="iq-shell-notice" role="status" data-shell-notice>
              {notice}
            </p>
          ) : null}
          {task && tree ? (
            <TaskView
              task={task}
              engagements={tree.engagements}
              folders={tree.folders}
              onRename={renameTask}
              onMove={moveTask}
              newOperationId={operationIds}
              states={states}
              statesNotice={statesNotice}
            />
          ) : (
            <div className="iq-thread-placeholder" data-thread-placeholder="none">
              <p className="iq-thread-placeholder-title">No Task open.</p>
              <p className="iq-thread-placeholder-body">Choose a Task in the Sidebar, or start one with New thread.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
