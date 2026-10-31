/**
 * The 264px Sidebar (Story 1.14): the Workspace selector, the Engagements
 * section (each Engagement, then its folders, then their Tasks), the ad hoc
 * Tasks, and New thread.
 *
 * - Lists only the signed-in principal's own Tasks (main filters them; nothing
 *   here can list another creator's). There is no Share control.
 * - Engagement and folder creation use the Story 1.6 inputs. Creating an
 *   Engagement needs the shared service: while it is unavailable the button is
 *   disabled with main's reason; private work requires current authority.
 * - A failed creation keeps the draft and its operation ID, so a retry cannot
 *   create a second Engagement or folder.
 * - Story 1.16: the 20px lockup with a Collapse control, NavRows (Task rows
 *   are links with `aria-current`; Engagements and folders are disclosure
 *   buttons with `aria-expanded`; actions are buttons), the person and
 *   Settings at the bottom, and the 52px rail: the symbol (Expand
 *   navigation, a keyboard-operable button), labelled icon actions with
 *   tooltips on hover and focus, the current Workspace, surface and Task
 *   marked, and the Task count. When the Sidebar does not fit, the rail's
 *   Expand opens the full Sidebar as a transient overlay instead. Collapsing
 *   never closes the open Task.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type ReactElement, type ReactNode } from 'react';

import lockupUrl from '../design/assets/logo/inquello-lockup.svg';
import symbolUrl from '../design/assets/logo/inquello-symbol.svg';
import { Icon, type IconName } from '../icons/Icon';
import { Avatar, Badge, Button, IconButton, Menu, TextField, type MenuEntry } from '../primitives';
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
  /** `sidebar`: the full 264px Sidebar; `rail`: the 52px rail. */
  presentation?: NavPresentation;
  /** In the rail, the full Sidebar is open over the work area. */
  overlayOpen?: boolean;
  /** Collapse to the rail (or close the overlay). */
  onCollapse?: () => void;
  /** Expand from the rail's symbol. */
  onExpand?: () => void;
  /** The signed-in person, when known. */
  person?: PersonView | null;
}

export type NavPresentation = 'sidebar' | 'rail';

export interface PersonView {
  name: string;
  detail: string;
}

/** Up to two initials of a display name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[words.length - 1]![0]] : [...(words[0] ?? '?')].slice(0, 2);
  return letters.join('').toUpperCase();
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

/** A navigation row: a link to the Task, marked `aria-current` while it is open. */
function TaskRow({ task, open, onOpen }: { task: TaskItem; open: boolean; onOpen: (task: TaskItem) => void }): ReactElement {
  return (
    <li className="iq-sidebar-task" data-task-id={task.taskId}>
      <a
        href={`#task-${task.taskId}`}
        className="iq-nav-row iq-sidebar-row"
        aria-current={open ? 'page' : undefined}
        data-nav-row="task"
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onOpen(task);
        }}
      >
        <span className="iq-nav-row-label">{task.title}</span>
      </a>
    </li>
  );
}

/** An Engagement or folder row: a disclosure button that shows or hides its nested rows. */
function DisclosureRow({
  label,
  expanded,
  controls,
  onToggle,
  kind,
  children,
}: {
  label: string;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
  kind: 'engagement' | 'folder';
  children?: ReactNode;
}): ReactElement {
  return (
    <div className={`iq-sidebar-${kind}-row`}>
      <button
        type="button"
        className={`iq-nav-row iq-nav-disclosure iq-sidebar-${kind}-name`}
        aria-expanded={expanded}
        aria-controls={controls}
        data-nav-row={kind}
        onClick={onToggle}
      >
        <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={14} className="iq-nav-disclosure-icon" />
        <span className="iq-nav-row-label">{label}</span>
      </button>
      {children}
    </div>
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


/** The person and Settings at the bottom of the Sidebar. */
function SidebarFooter({ person, onShowSpecimen }: { person: PersonView | null; onShowSpecimen: () => void }): ReactElement {
  return (
    <div className="iq-sidebar-footer" data-sidebar-footer>
      <div className="iq-sidebar-person" data-sidebar-person>
        {person ? (
          <>
            <Avatar name={person.name} initials={initialsOf(person.name)} />
            <span className="iq-sidebar-person-text">
              <span className="iq-sidebar-person-name">{person.name}</span>
              <span className="iq-sidebar-person-detail">{person.detail}</span>
            </span>
          </>
        ) : (
          <span className="iq-sidebar-person-detail">Not signed in</span>
        )}
      </div>
      <IconButton icon="settings" label="Settings" onPress={onShowSpecimen} data-action="settings" />
    </div>
  );
}

/** The full Sidebar's contents, inline or in the rail's overlay. */
function SidebarContent(props: SidebarProps & { collapseLabel: string }): ReactElement {
  const { state, workspaceId, tree, openTaskId, onSelectWorkspace, onOpenTask, onNewThread, onNewTask, newOperationId, busy, person = null } = props;
  const [creatingEngagement, setCreatingEngagement] = useState(false);
  const [folderFor, setFolderFor] = useState<string | null>(null);
  const [collapsedRows, setCollapsedRows] = useState<ReadonlySet<string>>(() => new Set());
  const baseId = useId();
  const toggleRow = (id: string) =>
    setCollapsedRows((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const top = (
    <div className="iq-sidebar-top">
      <img className="iq-sidebar-lockup" src={lockupUrl} alt="Inquello" />
      {props.onCollapse ? (
        <IconButton icon="panel-left" label={props.collapseLabel} expanded onPress={props.onCollapse} data-action="collapse-nav" />
      ) : null}
    </div>
  );

  if (!state || !state.signedIn) {
    return (
      <>
        {top}
        <p className="iq-sidebar-empty">{state ? 'Sign in to see your Workspaces and private Tasks.' : 'Loading…'}</p>
        {state ? (
          <Button variant="primary" size="sm" onPress={props.onSignIn} data-action="sign-in">
            Sign in
          </Button>
        ) : null}
        <SidebarFooter person={person} onShowSpecimen={props.onShowSpecimen} />
      </>
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
    <>
      {top}
      <div className="iq-sidebar-workspace" data-workspace-selector data-workspace-id={workspaceId ?? ''}>
        {state.workspaces.length > 0 ? (
          <Menu label={workspace ? workspace.name : 'Choose a Workspace'} heading="Workspace" items={[selector]} triggerVariant="ghost" />
        ) : (
          <p className="iq-sidebar-empty">No Workspace is available to you yet.</p>
        )}
      </div>
      {(tree?.unavailableTasks?.length??0)>0?<p className="iq-sidebar-empty" role="status">Some of your Tasks are unavailable until current authority can be verified. Your drafts are kept.</p>:null}
      <Button variant="primary" size="sm" icon="plus" onPress={onNewThread} disabledReason={noWorkspace} pending={busy} data-action="new-thread">
        New thread
      </Button>

      <section className="iq-sidebar-section" aria-labelledby={`${baseId}engagements`}>
        <h2 className="iq-sidebar-heading" id={`${baseId}engagements`}>
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
            const listId = `${baseId}engagement-${engagement.engagementId}`;
            const expanded = !collapsedRows.has(engagement.engagementId);
            return (
              <li key={engagement.engagementId} className="iq-sidebar-engagement" data-engagement-id={engagement.engagementId}>
                <DisclosureRow kind="engagement" label={engagement.name} expanded={expanded} controls={listId} onToggle={() => toggleRow(engagement.engagementId)}>
                  <IconButton icon="folder" label={`New folder in ${engagement.name}`} onPress={() => setFolderFor(engagement.engagementId)} data-action="new-folder" />
                  <IconButton icon="plus" label={`New Task in ${engagement.name}`} onPress={() => onNewTask(engagement.engagementId, null)} data-action="new-engagement-task" />
                </DisclosureRow>
                {folderFor === engagement.engagementId ? (
                  <FolderForm engagement={engagement} onSubmit={props.onCreateFolder} onCancel={() => setFolderFor(null)} newOperationId={newOperationId} />
                ) : null}
                <ul id={listId} className="iq-sidebar-list iq-sidebar-list--nested" hidden={!expanded}>
                  {own.map((folder) => {
                    const folderListId = `${baseId}folder-${folder.folderId}`;
                    const folderExpanded = !collapsedRows.has(folder.folderId);
                    return (
                      <li key={folder.folderId} className="iq-sidebar-folder" data-folder-id={folder.folderId}>
                        <DisclosureRow kind="folder" label={folder.name} expanded={folderExpanded} controls={folderListId} onToggle={() => toggleRow(folder.folderId)}>
                          <IconButton
                            icon="plus"
                            label={`New Task in ${folder.name}`}
                            onPress={() => onNewTask(engagement.engagementId, folder.folderId)}
                            data-action="new-folder-task"
                          />
                        </DisclosureRow>
                        <ul id={folderListId} className="iq-sidebar-list iq-sidebar-list--nested" hidden={!folderExpanded}>
                          {tasks
                            .filter((task) => task.folderId === folder.folderId)
                            .map((task) => (
                              <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
                            ))}
                        </ul>
                      </li>
                    );
                  })}
                  {loose.map((task) => (
                    <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="iq-sidebar-section" aria-labelledby={`${baseId}adhoc`} data-ad-hoc-tasks>
        <h2 className="iq-sidebar-heading" id={`${baseId}adhoc`}>
          Ad hoc Tasks
        </h2>
        {adHoc.length === 0 ? <p className="iq-sidebar-empty">No ad hoc Tasks.</p> : null}
        <ul className="iq-sidebar-list">
          {adHoc.map((task) => (
            <TaskRow key={task.taskId} task={task} open={task.taskId === openTaskId} onOpen={onOpenTask} />
          ))}
        </ul>
      </section>

      <SidebarFooter person={person} onShowSpecimen={props.onShowSpecimen} />
    </>
  );
}

/** One rail action: an icon control with a tooltip shown on hover and on focus. */
function RailItem({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <span className="iq-rail-item">
      {children}
      <span className="iq-rail-tip" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

/** The 52px rail: symbol (Expand navigation), labelled icon actions, counts and the current marks. */
function Rail(props: SidebarProps): ReactElement {
  const { state, workspaceId, tree, openTaskId, onNewThread, onOpenTask, overlayOpen = false, person = null } = props;
  const signedIn = !!state?.signedIn;
  const workspace = state?.workspaces.find((entry) => entry.workspaceId === workspaceId) ?? null;
  const tasks = tree?.tasks ?? [];
  const openTask = tasks.find((task) => task.taskId === openTaskId) ?? null;
  const expand = () => props.onExpand?.();
  const railButton = (icon: IconName, label: string, extra: Record<string, unknown> = {}) => (
    <RailItem label={label}>
      <IconButton icon={icon} label={label} onPress={expand} {...extra} />
    </RailItem>
  );
  return (
    <div className="iq-rail" data-rail>
      <RailItem label={overlayOpen ? 'Close navigation' : 'Expand navigation'}>
        <button
          type="button"
          className="iq-rail-logo"
          aria-label={overlayOpen ? 'Close navigation' : 'Expand navigation'}
          aria-expanded={overlayOpen}
          data-action="expand-nav"
          onClick={() => (overlayOpen ? props.onCollapse?.() : expand())}
        >
          <img src={symbolUrl} alt="" aria-hidden="true" />
        </button>
      </RailItem>
      {signedIn ? (
        <>
          <RailItem label="New thread">
            <IconButton
              icon="plus"
              label="New thread"
              onPress={onNewThread}
              disabledReason={workspace ? undefined : 'Choose a Workspace first.'}
              data-action="new-thread"
            />
          </RailItem>
          {railButton('folder', workspace ? `Workspace: ${workspace.name}` : 'Choose a Workspace', { 'data-rail-workspace': workspace?.workspaceId ?? '' })}
          <RailItem label="Tasks">
            <span className="iq-rail-count">
              <IconButton icon="list-checks" label="Tasks" variant="active" aria-current="true" onPress={expand} data-rail-surface="tasks" />
              {tasks.length > 0 ? <Badge count={tasks.length} label="Tasks in this Workspace" tone="neutral" className="iq-rail-badge" /> : null}
            </span>
          </RailItem>
          {openTask ? (
            <RailItem label={`Open Task: ${openTask.title}`}>
              <a
                href={`#task-${openTask.taskId}`}
                className="iq-rail-task"
                aria-label={`Open Task: ${openTask.title}`}
                aria-current="page"
                data-rail-task={openTask.taskId}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenTask(openTask);
                }}
              >
                <Icon name="message-square" />
              </a>
            </RailItem>
          ) : null}
        </>
      ) : null}
      <div className="iq-rail-footer">
        {person ? (
          <RailItem label={person.name}>
            <span className="iq-rail-person">
              <Avatar name={person.name} initials={initialsOf(person.name)} />
            </span>
          </RailItem>
        ) : null}
        <RailItem label="Settings">
          <IconButton icon="settings" label="Settings" onPress={props.onShowSpecimen} data-action="settings" />
        </RailItem>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps): ReactElement {
  const { state, presentation = 'sidebar', overlayOpen = false } = props;
  const navRef = useRef<HTMLElement>(null);
  const previous = useRef(presentation);

  // Toggling between the Sidebar and the rail removes the control that was
  // pressed; focus moves to its counterpart (Collapse ↔ Expand).
  useEffect(() => {
    if (previous.current === presentation) return;
    previous.current = presentation;
    const nav = navRef.current;
    if (!nav || !nav.contains(document.activeElement) && document.activeElement !== document.body) return;
    const target = presentation === 'rail' ? '[data-action="expand-nav"]' : '[data-action="collapse-nav"]';
    nav.querySelector<HTMLElement>(target)?.focus();
  }, [presentation]);

  const sidebarState = !state ? 'loading' : state.signedIn ? 'ready' : 'signed-out';
  return (
    <nav
      ref={navRef}
      className={`iq-sidebar iq-sidebar--${presentation}`}
      aria-label="Workspace navigation"
      data-sidebar
      data-sidebar-state={sidebarState}
      data-shared-service={state?.signedIn ? state.sharedService : undefined}
      data-nav-presentation={presentation}
    >
      {presentation === 'sidebar' ? (
        <SidebarContent {...props} collapseLabel="Collapse navigation" />
      ) : (
        <>
          <Rail {...props} />
          {overlayOpen ? (
            <div className="iq-nav-overlay" data-nav-overlay>
              <SidebarContent {...props} collapseLabel="Close navigation" />
            </div>
          ) : null}
        </>
      )}
    </nav>
  );
}
