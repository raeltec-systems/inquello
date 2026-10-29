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
 *
 * Story 1.16 completes the layout and keyboard model:
 * - Layout mode (full, rail, single) follows the window width live
 *   (`layout.ts`). The rail never closes the open Task. In single mode one work
 *   area shows at a time behind a Conversation/Artifact switch; the selected
 *   item and the unsent draft (`drafts.ts`) are owned here, so switching and
 *   resizing lose neither, and focus stays on the switch.
 * - DOM and tab order: navigation, the work area (the single-mode switch, then
 *   the Task in `main`), the artifact with its contextual review region, then
 *   the Composer slot last.
 * - One polite live region announces each surface change once: a Task opened,
 *   the view switched, navigation collapsed or expanded.
 * - Ctrl/Cmd+N activates New thread outside text fields; Ctrl/Cmd+K is not
 *   bound; Escape closes the topmost overlay and returns focus to its opener,
 *   and never acts on a Task (`keyboard.ts`).
 * - The artifact area stays closed: nothing in the app opens one yet. The
 *   `artifact` and `renderComposer` props are for tests and later stories.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { identityBridge, parseIdentityStatus } from '../bridge';
import { SegmentedControl } from '../primitives';
import { ArtifactArea, type ShellArtifact } from './ArtifactArea';
import { useDraftBinding, type DraftBinding } from './drafts';
import { Header } from './Header';
import { EscapeStack, isNewThreadShortcut, isTextEntry } from './keyboard';
import { artifactFits, layoutMode, THREAD_MIN_WIDTH } from './layout';
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
import { Sidebar, type EngagementDraft, type PersonView } from './Sidebar';
import { parseTaskStates, stateBridge, type TaskStatesItem } from './state-bridge';
import { TaskView, type MoveTarget } from './TaskView';

const REFRESH_MS = 30_000;
export const UNTITLED_TASK = 'Untitled thread';

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export interface ShellProps {
  onShowSpecimen: () => void;
  /** Tests inject a deterministic ID source. */
  operationIds?: () => string;
  /**
   * An open artifact. Nothing in the app passes one yet (a later story opens
   * real artifacts); only tests do, so users never see a fake artifact.
   */
  artifact?: ShellArtifact | null;
  /** The Composer (Story 1.17), bound to the open Task's preserved draft. Until then the slot stays empty. */
  renderComposer?: (draft: DraftBinding) => ReactNode;
}

export type WorkView = 'conversation' | 'artifact';

const viewportWidth = (): number => (typeof globalThis.innerWidth === 'number' && globalThis.innerWidth > 0 ? globalThis.innerWidth : 1280);

/** The signed-in person for the Sidebar footer, read from the identity status; null otherwise. */
async function readPerson(): Promise<PersonView | null> {
  const identity = identityBridge();
  if (!identity || typeof identity.getStatus !== 'function') return null;
  try {
    const status = parseIdentityStatus(await identity.getStatus());
    return status?.identity.state === 'signed-in' ? { name: status.identity.displayName, detail: status.identity.issuerLabel } : null;
  } catch {
    return null;
  }
}

export function Shell({ onShowSpecimen, operationIds = newOperationId, artifact = null, renderComposer }: ShellProps): ReactElement {
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
  const [person, setPerson] = useState<PersonView | null>(null);

  // ---- layout (Story 1.16) ----
  const [width, setWidth] = useState(viewportWidth);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [view, setView] = useState<WorkView>('conversation');
  const [dismissedArtifact, setDismissedArtifact] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ artifactId: string; itemId: string } | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const escapeStack = useRef(new EscapeStack());
  const draft = useDraftBinding(openTaskId);

  const openArtifact = artifact && artifact.artifactId !== dismissedArtifact ? artifact : null;
  const mode = layoutMode(width, openArtifact !== null);
  const presentation = mode === 'full' && !userCollapsed ? 'sidebar' : 'rail';
  const showOverlay = presentation === 'rail' && mode !== 'full' && overlayOpen;
  const workView: WorkView = mode === 'single' && openArtifact ? view : 'conversation';

  /** One polite announcement per surface change. */
  const announce = useCallback((text: string) => setAnnouncement((current) => ({ text, count: current.count + 1 })), []);

  useEffect(() => {
    const onResize = () => setWidth(viewportWidth());
    globalThis.addEventListener('resize', onResize);
    return () => globalThis.removeEventListener('resize', onResize);
  }, []);

  const expandButton = () => shellRef.current?.querySelector<HTMLElement>('[data-sidebar] [data-action="expand-nav"]') ?? null;

  const closeOverlay = useCallback(
    (returnFocus: boolean) => {
      setOverlayOpen(false);
      announce('Navigation closed');
      if (returnFocus) shellRef.current?.querySelector<HTMLElement>('[data-sidebar] [data-action="expand-nav"]')?.focus();
    },
    [announce],
  );

  // The overlay is an Escape layer; growing back to full mode closes it silently.
  useEffect(() => {
    if (!showOverlay) return undefined;
    return escapeStack.current.push({ close: () => closeOverlay(false), opener: expandButton });
  }, [showOverlay, closeOverlay]);
  useEffect(() => {
    if (mode === 'full' && overlayOpen) setOverlayOpen(false);
  }, [mode, overlayOpen]);

  // Focus moves into the overlay when it opens; a click outside it closes it without pulling focus.
  useEffect(() => {
    if (!showOverlay) return undefined;
    shellRef.current?.querySelector<HTMLElement>('[data-nav-overlay] [data-action="collapse-nav"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const nav = shellRef.current?.querySelector('[data-sidebar]');
      if (nav && event.target instanceof Node && !nav.contains(event.target)) closeOverlay(false);
    };
    document.addEventListener('mousedown', onPointer, true);
    return () => document.removeEventListener('mousedown', onPointer, true);
  }, [showOverlay, closeOverlay]);

  // A new artifact starts on its own selection; a closed one returns the view to the conversation.
  useEffect(() => {
    if (!openArtifact) setView('conversation');
  }, [openArtifact]);

  const collapseNav = () => {
    if (showOverlay) {
      closeOverlay(true);
      return;
    }
    setUserCollapsed(true);
    announce('Navigation collapsed');
  };

  const expandNav = () => {
    if (mode === 'full') {
      setUserCollapsed(false);
      announce('Navigation expanded');
      return;
    }
    setOverlayOpen(true);
    announce('Navigation opened');
  };

  const switchView = (next: string) => {
    const target: WorkView = next === 'artifact' ? 'artifact' : 'conversation';
    if (target === workView) return;
    setView(target);
    announce(target === 'artifact' ? 'Showing the Artifact' : 'Showing the Conversation');
  };

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
      void readPerson().then(setPerson);
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
    const name = state?.workspaces.find((item) => item.workspaceId === id)?.name;
    if (name) announce(`Workspace ${name}`);
    void loadTree(id);
  };

  /** Opens a Task from navigation; the overlay (if open) closes and focus returns to its opener. */
  const openTaskFromNav = (item: TaskItem) => {
    if (showOverlay) closeOverlay(true);
    if (item.taskId === openTask.current) return;
    setOpenTaskId(item.taskId);
    announce(`Opened Task ${item.title}`);
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
    if (result.ok) {
      setOpenTaskId(result.value.taskId);
      announce(`Opened Task ${result.value.title}`);
    } else setNotice(result.reason);
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

  // Ctrl/Cmd+N and Escape, bound in the renderer only. The handler reads the
  // latest state through a ref, so the listener is added once.
  const newThreadShortcut = useRef<() => boolean>(() => false);
  newThreadShortcut.current = () => {
    if (!bridge || !state?.signedIn || !workspaceId) return false;
    void createTask(null, null);
    return true;
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (escapeStack.current.closeTopmost()) event.preventDefault();
        return;
      }
      if (!isNewThreadShortcut(event) || isTextEntry(event.target) || event.repeat) return;
      if (newThreadShortcut.current()) event.preventDefault();
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, []);

  const task = useMemo(() => tree?.tasks.find((item) => item.taskId === openTaskId) ?? null, [tree, openTaskId]);
  const engagement = useMemo(() => (task?.engagementId ? (tree?.engagements.find((item) => item.engagementId === task.engagementId) ?? null) : null), [tree, task]);
  const workspace = state?.workspaces.find((item) => item.workspaceId === workspaceId) ?? null;

  const selectedItemId = openArtifact && selectedItem?.artifactId === openArtifact.artifactId ? selectedItem.itemId : null;
  const composer = renderComposer ? renderComposer(draft) : null;

  return (
    <div
      ref={shellRef}
      className={`iq-shell iq-shell--${mode} iq-shell--nav-${presentation}`}
      data-shell
      data-layout-mode={mode}
      data-nav-presentation={presentation}
      data-artifact-open={openArtifact ? 'true' : 'false'}
      data-artifact-fits={artifactFits(width) ? 'true' : 'false'}
      data-work-view={workView}
      style={{ '--iq-thread-min-width': `${THREAD_MIN_WIDTH}px` } as CSSProperties}
    >
      <Sidebar
        state={state}
        workspaceId={workspaceId}
        tree={tree}
        openTaskId={openTaskId}
        onSelectWorkspace={selectWorkspace}
        onOpenTask={openTaskFromNav}
        onNewThread={() => void createTask(null, null)}
        onNewTask={(engagementId, folderId) => void createTask(engagementId, folderId)}
        onCreateEngagement={createEngagement}
        onCreateFolder={createFolder}
        onSignIn={() => void signIn()}
        onShowSpecimen={onShowSpecimen}
        newOperationId={operationIds}
        busy={creatingTask}
        presentation={presentation}
        overlayOpen={showOverlay}
        onCollapse={collapseNav}
        onExpand={expandNav}
        person={person}
      />
      <div className="iq-shell-main">
        <Header task={task} engagement={engagement} workspace={workspace} />
        <div className={`iq-work${openArtifact ? ' iq-work--artifact' : ''}`} data-work>
          {mode === 'single' && openArtifact ? (
            <div className="iq-work-switch" data-work-switch>
              <SegmentedControl
                label="Work area"
                options={[
                  { value: 'conversation', label: 'Conversation' },
                  { value: 'artifact', label: 'Artifact' },
                ]}
                value={workView}
                onChange={switchView}
              />
            </div>
          ) : null}
          <main className="iq-thread" aria-label="Task work" hidden={workView === 'artifact'} data-thread>
            <div className="iq-shell-content">
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
            </div>
          </main>
          {openArtifact ? (
            <ArtifactArea
              artifact={openArtifact}
              selectedItemId={selectedItemId}
              onSelectItem={(itemId) => setSelectedItem({ artifactId: openArtifact.artifactId, itemId })}
              onClose={() => {
                setDismissedArtifact(openArtifact.artifactId);
                announce('Artifact closed');
              }}
              hidden={workView === 'conversation' && mode === 'single'}
            />
          ) : null}
          <div className="iq-composer-slot" data-composer-slot={composer ? 'filled' : 'empty'}>
            {composer}
          </div>
        </div>
      </div>
      <div className="iq-visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-shell-announcer data-announce-count={announcement.count}>
        {announcement.text ? <span key={announcement.count}>{announcement.text}</span> : null}
      </div>
    </div>
  );
}
