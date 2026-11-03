import {TaskPolicy} from './TaskPolicy';
import {providerSettingsHash} from '../provider-settings';
import {smokeStartTrace} from './smoke-start-trace';
import {Search} from './Search';
import {Inbox,useInbox,type InputRequest,type QuestionSelection} from './Inbox';
import {reopenView,type ReopenView} from '../../main/organise/navigation';
import {taskValue,tasksBridge,parseProgress} from './tasks-bridge';
import {SavedWorkDialog} from './Search';
import {TaskDetails} from './TaskView';
import {TaskLifecycle} from './TaskLifecycle';
import {useConversationFollow} from './use-conversation-follow';
/**
 * The desktop Shell (Story 1.14): Sidebar, Header and the open Task.
 *
 * It talks to main only through the named `inquello.organise` operations (and
 * `inquello.identity.signIn` from the signed-out Sidebar). Main binds the
 * signed-in principal, so nothing here names one. Every mutation carries a
 * fresh operation ID per user action; a retry of the same action reuses it.
 * The Workspace list and tree are re-read after each change and every 30s.
 * The open Task's states (Story 1.15) are read through `inquello.state.list`
 * when it opens and with every refresh; the Shell never records one. Its
 * effective policy and execution mode (Story 1.18) are read the same way
 * through `inquello.policy.forTask`, so a new policy revision shows on open
 * and refresh; a broader mode is set only from the Task's confirmation.
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
 * - Ctrl/Cmd+N activates New thread outside text fields; Ctrl/Cmd+K opens saved-work Search; Escape closes the topmost overlay and returns focus to its opener,
 *   and never acts on a Task (`keyboard.ts`).
 * - The artifact area stays closed: nothing in the app opens one yet. The
 *   `artifact` and `renderComposer` props are for tests and later stories.
 *
 * Story 1.17 fills the Composer slot with the plain Composer (`Composer.tsx`)
 * while signed in. Its drafts live in memory only (`drafts.ts`): in the App's
 * store when one is passed, so a visit to Settings keeps them, else in the
 * Shell's own. Every draft is cleared when the Shell sees no one signed in, a
 * different principal, or a sign-in from the Sidebar; a Task's draft goes when
 * the Task is no longer in its Workspace.
 *
 * Story 1.20 puts the open Task's pending permission requests
 * (`PermissionRequests.tsx`) in the contextual review area after the work
 * area and before the Composer slot; each new request is announced once.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';

import { identityBridge, parseIdentityStatus } from '../bridge';
import { SegmentedControl,Button } from '../primitives';
import { ArtifactArea, type ShellArtifact } from './ArtifactArea';
import { Composer } from './Composer';
import { StartView } from './StartView';
import type { StartedTask } from './tasks-bridge';
import { createDraftStore, useDraftBinding, type DraftBinding, type DraftStore } from './drafts';
import { Header } from './Header';
import { PermissionRequests } from './PermissionRequests';
import { EscapeStack, isNewThreadShortcut, isTextEntry } from './keyboard';
import { artifactFits, layoutMode, THREAD_MIN_WIDTH, workWidth } from './layout';
import {clampSidebarWidth,readSidebarWidth,saveSidebarWidth,MAX_SIDEBAR_WIDTH} from './sidebar-width';
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
import { parseTaskPolicy, policyBridge, type TaskPolicyItem } from '../policy-bridge';
import { parseTaskStates, stateBridge, type TaskStatesItem } from './state-bridge';
import { AcceptedRequest, TaskView, type MoveTarget } from './TaskView';

const REFRESH_MS = 30_000;
export const UNTITLED_TASK = 'Untitled thread';

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

export interface ShellProps {
  onWorkspaceChanged?:(workspaceId:string|null)=>void;
  active?: boolean;
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
  /** The window's in-memory draft store; the Shell keeps its own when none is passed. */
  drafts?: DraftStore;
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

/** The principal the identity status names, as a draft-ownership key; null when unknown. */
const ownerKey = (person: PersonView | null): string | null => (person ? `${person.name}\n${person.detail}` : null);

export function Shell({ active = true, onWorkspaceChanged, onShowSpecimen, operationIds = newOperationId, artifact = null, renderComposer, drafts }: ShellProps): ReactElement {
  const bridge = organiseBridge();
  const [state, setState] = useState<WorkspacesState | null>(null);
  const [workspaceId, setWorkspaceIdState] = useState<string | null>(null);
  useEffect(()=>{onWorkspaceChanged?.(state?.signedIn?workspaceId:null);},[workspaceId,state?.signedIn,onWorkspaceChanged]);
  // The periodic reload reads the current choice without re-creating itself.
  const chosenWorkspace = useRef<string | null>(null);
  const setWorkspaceId = (id: string | null) => {
    recoveryRead.current++;setRecoveringNavigation(false);setNotice(null);
    setSavedHit(null);setOpenedEngagement(null);setSelectedQuestion(null);setSavedSurface(null);
    chosenWorkspace.current = id;
    setWorkspaceIdState(id);
  };
  const [tree, setTree] = useState<WorkspaceTree | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [noticeState,setNoticeState]=useState<{text:string;kind:'navigation-unavailable'|'info'}|null>(null);
  const notice=noticeState?.text??null;
  const setNotice=useCallback((text:string|null)=>setNoticeState(text===null?null:{text,kind:'info'}),[]);
  const setNavigationNotice=useCallback((text:string)=>setNoticeState({text,kind:'navigation-unavailable'}),[]);
  const [recoveringNavigation,setRecoveringNavigation]=useState(false);
  const recoveryRead=useRef(0);
  const [savedSurface,setSavedSurface]=useState<'search'|'inbox'|null>(null);
  const [savedHit,setSavedHit]=useState<(ReopenView&{generation:number})|null>(null);
  const [openedEngagement,setOpenedEngagement]=useState<string|null>(null);
  const [selectedQuestion,setSelectedQuestion]=useState<QuestionSelection|null>(null);
  const inbox=useInbox(workspaceId,active&&!!state?.signedIn);
  const creatingTask = false;
  const [startLocation, setStartLocation] = useState<{workspaceId:string;engagementId:string|null;folderId:string|null}|null>(null);
  const [showStart,setShowStart] = useState(false);
  const [pendingStart,setPendingStart] = useState(false);
  const [runtimeEpoch,setRuntimeEpoch] = useState(0);
  const [acceptedTasks,setAcceptedTasks] = useState<Record<string,{workspaceId:string;binding:StartedTask}>>({});
  const authorizedWorkspaces = useRef<string[]>([]);
  const authorityGeneration = useRef(0);
  const workspaceRead = useRef(0);
  const navigationRead = useRef(0);
  const disclosedOwner = useRef<string | null>(null);
  const activeStart = useRef({active:false,location:startLocation});
  activeStart.current = {active:active && showStart,location:startLocation};
  const [states, setStates] = useState<TaskStatesItem | null>(null);
  const [statesNotice, setStatesNotice] = useState<string | null>(null);
  const [taskPolicy, setTaskPolicy] = useState<TaskPolicyItem | null>(null);
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);
  const openTask = useRef<string | null>(null);
  openTask.current = openTaskId;
  const [person, setPerson] = useState<PersonView | null>(null);

  // ---- layout (Story 1.16) ----
  const [width, setWidth] = useState(viewportWidth);
  const [preferredSidebarWidth,setPreferredSidebarWidth]=useState(readSidebarWidth);
  const resizeSidebar=(value:number)=>{const next=clampSidebarWidth(value);setPreferredSidebarWidth(next);saveSidebarWidth(next);};
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [view, setView] = useState<WorkView>('conversation');
  const [dismissedArtifact, setDismissedArtifact] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ artifactId: string; itemId: string } | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const shellRef = useRef<HTMLDivElement>(null);
  const escapeStack = useRef(new EscapeStack());
  const [ownDrafts] = useState(createDraftStore);
  const draftStore = drafts ?? ownDrafts;

  const openArtifact = artifact && artifact.artifactId !== dismissedArtifact ? artifact : null;
  const sidebarMaximum=Math.min(MAX_SIDEBAR_WIDTH,Math.max(280,width-workWidth(openArtifact!==null)));
  const sidebarWidth=clampSidebarWidth(preferredSidebarWidth,sidebarMaximum);
  const mode = layoutMode(width, openArtifact !== null,sidebarWidth);
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

  /** Reads one Task's effective policy and execution mode, recomputed by main on each read. */
  const loadPolicy = useCallback(async (taskId: string | null) => {
    const api = policyBridge();
    if (!api || !taskId) {
      setTaskPolicy(null);
      setPolicyNotice(null);
      return;
    }
    let result: Outcome<TaskPolicyItem>;
    try {
      result = parseOutcome(await api.forTask({ taskId }), parseTaskPolicy);
    } catch {
      result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
    }
    if (openTask.current !== taskId) return;
    if (result.ok) {
      setTaskPolicy(result.value);
      setPolicyNotice(null);
    } else {
      setTaskPolicy(null);
      setPolicyNotice(`The policy could not be read. ${result.reason}`);
    }
  }, []);

  /** Sets the open Task's execution mode under one fresh operation ID; resolves with a refusal reason. */
  const setMode = useCallback(
    async (mode: 'standard' | 'no_prompt' | 'full_access', confirmation: string | null): Promise<string | null> => {
      const api = policyBridge();
      const taskId = openTask.current;
      if (!api || !taskId || !taskPolicy || taskPolicy.taskId !== taskId) return 'The policy is not loaded.';
      let result: Outcome<TaskPolicyItem>;
      try {
        result = parseOutcome(
          await api.setBroadMode({ operationId: operationIds(), taskId, expectedRevision: taskPolicy.broadMode.revision, mode, confirmation }),
          parseTaskPolicy,
        );
      } catch {
        result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
      }
      if (openTask.current !== taskId) return null;
      if (result.ok) {
        setTaskPolicy(result.value);
        return null;
      }
      await loadPolicy(taskId);
      return result.reason;
    },
    [taskPolicy, operationIds, loadPolicy],
  );

  useEffect(() => {
    void loadStates(openTaskId);
    void loadPolicy(openTaskId);
  }, [openTaskId, loadStates, loadPolicy]);

  const treeTraceRead=useRef(0);
  const loadTree = useCallback(
    async (id: string | null, refreshInspection = true) => {
      if (!bridge || !id) {
        setTree(null);
        return;
      }
      const generation = authorityGeneration.current,read=++treeTraceRead.current;
      smokeStartTrace('tree-start',{selected:!!openTask.current},read);
      const result = parseOutcome(await bridge.getTree({ workspaceId: id }), parseTree);
      smokeStartTrace('tree-result',{ok:result.ok,scopeCurrent:generation===authorityGeneration.current,workspaceAllowed:chosenWorkspace.current===id&&authorizedWorkspaces.current.includes(id),selected:!!openTask.current,hasTasks:result.ok&&result.value.tasks.length>0,taskPresent:result.ok&&result.value.tasks.some(item=>item.taskId===openTask.current),selectedUnavailable:result.ok&&(result.value.unavailableTasks??[]).some(item=>item.taskId===openTask.current)},read);
      if (generation !== authorityGeneration.current) return;
      if (chosenWorkspace.current !== id || !authorizedWorkspaces.current.includes(id)) return;
      // An earlier successful inventory cannot erase a newer accepted Task or
      // restore data after a newer refusal. Refusals always remain fail-closed.
      if (result.ok && read !== treeTraceRead.current) return;
      if (result.ok) {
        // A Task that is gone (deleted) takes its draft with it.
        const unavailable=new Set((result.value.unavailableTasks??[]).map(item=>item.taskId));
        draftStore.retain(result.value.workspaceId, [...result.value.tasks.map((item) => item.taskId),...unavailable]);
        setAcceptedTasks(previous=>Object.fromEntries(Object.entries(previous).filter(([taskId])=>!unavailable.has(taskId))));
        if(openTask.current&&unavailable.has(openTask.current)){setOpenTaskId(null);openTask.current=null;setStates(null);setTaskPolicy(null);setNavigationNotice('This Task is currently unavailable. Your draft is kept.');}
        setTree(result.value);
      } else {
        setTree(null); setAcceptedTasks({}); setStates(null); setTaskPolicy(null);
        setOpenTaskId(null); openTask.current=null; setNavigationNotice(result.reason);
      }
      if (openTask.current && refreshInspection) await Promise.all([loadStates(openTask.current), loadPolicy(openTask.current)]);
    },
    [bridge, loadStates, loadPolicy, draftStore],
  );

  const suppressPrivateContent = useCallback(() => {
    recoveryRead.current++;setRecoveringNavigation(false);
    authorityGeneration.current++; authorizedWorkspaces.current=[];
    setState(null); setPerson(null); setTree(null); setAcceptedTasks({});
    setStates(null); setTaskPolicy(null); setOpenTaskId(null); openTask.current=null;
    activeStart.current.active=false; setStartLocation(null); setShowStart(false); setPendingStart(false);
    draftStore.clear();
  }, [draftStore]);

  const load = useCallback(async () => {
    if (!bridge) return;
    const read=++workspaceRead.current; const generation=authorityGeneration.current;
    try {
      const next = parseWorkspaces(await bridge.getWorkspaces());
      if (read!==workspaceRead.current || generation!==authorityGeneration.current) return;
      if (!next) {
        suppressPrivateContent();
        setNavigationNotice('Your Workspaces could not be read.');
        return;
      }
      // Drafts belong to one signed-in principal: none signed in, or a different one, clears them all.
      const nextPerson = next.signedIn ? await readPerson() : null;
      if (read!==workspaceRead.current || generation!==authorityGeneration.current) return;
      const nextOwner=next.signedIn?ownerKey(nextPerson):null;
      if (disclosedOwner.current!==nextOwner) {
        setAcceptedTasks({}); setTree(null); setStates(null); setTaskPolicy(null);
        setOpenTaskId(null); openTask.current=null;
      }
      disclosedOwner.current=nextOwner;
      if (next.signedIn) draftStore.claim(ownerKey(nextPerson));
      else { draftStore.clear(); setPendingStart(false); setStartLocation(null); setShowStart(false); setAcceptedTasks({}); }
      setState(next);
      setPerson(nextPerson);
      const ids = next.workspaces.map((workspace) => workspace.workspaceId);
      authorizedWorkspaces.current = next.signedIn ? ids : [];
      setAcceptedTasks(previous => Object.fromEntries(Object.entries(previous).filter(([,entry]) => next.signedIn && ids.includes(entry.workspaceId))));
      const current = chosenWorkspace.current;
      if (!next.signedIn || (current && !ids.includes(current))) {
        setOpenTaskId(null); openTask.current=null; setTree(null);
        setStates(null); setTaskPolicy(null);
      }
      if (activeStart.current.location && !authorizedWorkspaces.current.includes(activeStart.current.location.workspaceId)) {
        activeStart.current={active:false,location:null};
        setStartLocation(null); setShowStart(false); setPendingStart(false);
      }
      const chosen = current && ids.includes(current) ? current : (ids[0] ?? null);
      if(current!==chosen){recoveryRead.current++;setRecoveringNavigation(false);setNotice(null);}
      chosenWorkspace.current = chosen;
      setWorkspaceIdState(chosen);
      await loadTree(chosen);
    } catch {
      if (read!==workspaceRead.current || generation!==authorityGeneration.current) return;
      suppressPrivateContent();
      setNavigationNotice('Your Workspaces could not be read.');
    }
  }, [bridge, loadTree, draftStore, suppressPrivateContent]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load, active]);

  // Private-scope invalidation must remove submitted content immediately. Route
  // changes use this signal too, so memory-only drafts and pending operation IDs
  // remain intact; fresh identity/policy reads decide whether they can be shown.
  useEffect(() => {
    const usage = (globalThis as {inquello?:{usage?:{onChanged?:(listener:(privateScope:boolean)=>void)=>()=>void}}}).inquello?.usage;
    return usage?.onChanged?.((privateScope) => {
      if (!privateScope) return;
      authorityGeneration.current++; authorizedWorkspaces.current=[];
      setTree(null); setState(null); setStates(null); setTaskPolicy(null);
      setAcceptedTasks({});
      void load();
    });
  }, [load]);

  useEffect(() => {
    const api = (globalThis as {inquello?:{tasks?:{onSessionChanged?:(listener:(identityChanged:boolean)=>void)=>()=>void}}}).inquello?.tasks;
    return api?.onSessionChanged?.((identityChanged) => {
      recoveryRead.current++;setRecoveringNavigation(false);setNotice(null);
      authorityGeneration.current++; authorizedWorkspaces.current=[];
      setAcceptedTasks({}); setTree(null); setOpenTaskId(null); setState(null); setStates(null); setTaskPolicy(null);
      if (identityChanged) { draftStore.clear(); setPendingStart(false); setStartLocation(null); setShowStart(false); setState(null); setPerson(null); }
      else setRuntimeEpoch(n => n + 1);
      void load();
    });
  }, [load, draftStore]);

  /** Explicit recovery only. Clear old work first; no mutation or draft is replayed. */
  const refreshWorkspace = async () => {
    const id=chosenWorkspace.current;
    if(!id||!bridge?.recoverNavigation||recoveringNavigation||noticeState?.kind!=='navigation-unavailable')return;
    const read=++recoveryRead.current,nav=++navigationRead.current;
    const generation=++authorityGeneration.current;
    setRecoveringNavigation(true);setTree(null);setAcceptedTasks({});setStates(null);setTaskPolicy(null);
    setOpenTaskId(null);openTask.current=null;setSavedHit(null);setOpenedEngagement(null);setSelectedQuestion(null);setSavedSurface(null);
    setNavigationNotice('Checking current Workspace access. No work will be restarted.');
    const current=()=>read===recoveryRead.current&&nav===navigationRead.current&&generation===authorityGeneration.current&&id===chosenWorkspace.current;
    try{
      const result=await bridge.recoverNavigation({workspaceId:id});
      if(!current())return;
      const accepted=parseOutcome(result,value=>typeof value==='object'&&value!==null&&(value as {accepted?:unknown}).accepted===true?{accepted:true}:null);
      if(!accepted.ok){setNavigationNotice('Workspace access could not be restored. Refresh cannot restore revoked permissions; no work was restarted.');return;}
      setNotice(null);
      await load(); // A new authorized read, never reuse an old response or mutation.
    }catch{if(current())setNavigationNotice('Workspace access is unavailable. Refresh cannot restore revoked permissions; no work was restarted.');}
    finally{if(read===recoveryRead.current)setRecoveringNavigation(false);}
  };

  /** Every foreground destination invalidates all older awaited navigation. */
  const selectDestination = () => {
    recoveryRead.current++;setRecoveringNavigation(false);setNotice(null);
    navigationRead.current++;
    setSavedHit(null);setSelectedQuestion(null);setOpenedEngagement(null);
    return navigationRead.current;
  };
  const selectWorkspace = (id: string) => {
    selectDestination();
    activeStart.current.active=false;
    setWorkspaceId(id);
    setShowStart(false);
    setOpenTaskId(null);
    const name = state?.workspaces.find((item) => item.workspaceId === id)?.name;
    if (name) announce(`Workspace ${name}`);
    void loadTree(id);
  };

  /** Opens a Task from navigation; the overlay (if open) closes and focus returns to its opener. */
  const acceptSaved = (value:ReopenView) => {
    if(value.task.workspaceId!==chosenWorkspace.current||!authorizedWorkspaces.current.includes(value.task.workspaceId))return;
    selectDestination();
    activeStart.current.active=false;setShowStart(false);setOpenedEngagement(null);setSelectedQuestion(null);
    setTree(previous=>previous?.workspaceId===value.task.workspaceId?{...previous,tasks:[...previous.tasks.filter(t=>t.taskId!==value.task.taskId),value.task]}:previous);
    const changed=openTask.current!==value.task.taskId;openTask.current=value.task.taskId;
    setOpenTaskId(value.task.taskId);setSavedHit(value.hit?{...value,generation:authorityGeneration.current}:null);
    if(changed)announce(`Opened Task ${value.task.title}`);
  };
  const openTaskFromNav = async (item:TaskItem,question?:InputRequest) => {
    if(!bridge)return;const generation=authorityGeneration.current,workspace=item.workspaceId,read=selectDestination();
    setSavedHit(null);setSelectedQuestion(null);setOpenedEngagement(null);
    if(showOverlay)closeOverlay(true);
    try {
      // Older bridge callers still use a fresh authorized tree, never cached Task labels.
      let value:ReopenView;
      if(bridge.reopen)value=reopenView(taskValue(await bridge.reopen({workspaceId:workspace,taskId:item.taskId,query:null,turnId:null,itemId:null})));
      else {const result=parseOutcome(await bridge.getTree({workspaceId:workspace}),parseTree);const task=result.ok?result.value.tasks.find(t=>t.taskId===item.taskId):null;if(!task)throw new Error();value={task,hit:null};}
      if(read!==navigationRead.current||generation!==authorityGeneration.current||workspace!==chosenWorkspace.current)return;
      if(question){
        const api=tasksBridge();if(!api)throw new Error();
        const progress=parseProgress(taskValue(await api.progress({taskId:item.taskId,workspaceId:workspace})));
        if(read!==navigationRead.current||generation!==authorityGeneration.current||workspace!==chosenWorkspace.current)return;
        if(progress.taskId!==item.taskId||progress.workspaceId!==workspace||!progress.questions.some(q=>q.requestId===question.requestId&&q.turnId===question.turnId&&q.itemId===question.itemId)){
          setNotice('The selected question was resolved or replaced while opening. No answer was sent.');return;
        }
      }
      acceptSaved(value);
      if(question)setSelectedQuestion({requestId:question.requestId,turnId:question.turnId,itemId:question.itemId,visit:navigationRead.current});
      return navigationRead.current;
    }catch{if(read===navigationRead.current&&generation===authorityGeneration.current&&workspace===chosenWorkspace.current){setOpenTaskId(null);setNavigationNotice('This Task is unavailable. No cached work was opened.');}}
  };


  /** Runs one mutation, then re-reads the tree; a refusal is shown, never hidden. */
  const mutate = async <T,>(call: () => Promise<unknown>, parse: (value: unknown) => T | null, refreshInspection = true): Promise<Outcome<T>> => {
    let result: Outcome<T>;
    try {
      result = parseOutcome(await call(), parse);
    } catch {
      result = { ok: false, code: 'failed', reason: 'The request did not complete.' };
    }
    if (result.ok) setNotice(null);
    await loadTree(chosenWorkspace.current, refreshInspection);
    return result;
  };

  const createTask = async (engagementId: string | null, folderId: string | null) => {
    if (!workspaceId) return;
    selectDestination();openTask.current=null;
    if (pendingStart && startLocation) {
      setWorkspaceId(startLocation.workspaceId); setOpenTaskId(null); setShowStart(true);
      setNotice('Check the pending operation before starting another private Task.');
      void loadTree(startLocation.workspaceId); return;
    }
    setStartLocation({workspaceId,engagementId,folderId});
    setOpenTaskId(null);
    setShowStart(true);
    shellRef.current?.querySelector<HTMLElement>('[data-start-view] textarea')?.focus();
    announce('New private Task. What should we work on?');
    void loadTree(workspaceId);
    if (showOverlay) closeOverlay(false);
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

  const setNavigation = (task:TaskItem,pinned:boolean,archived:boolean,operationId:string,expectedRevision:number):Promise<Outcome<TaskItem>> => {
    if(!bridge?.setNavigation)return Promise.resolve({ok:false,code:'failed',reason:'Navigation preferences are unavailable.'});
    // Personal navigation changes require a fresh authorized tree, but do not
    // change execution policy. A slow sandbox inspection must not hold Pin or
    // Archive in their saving state after the navigation write has completed.
    return mutate(()=>bridge.setNavigation!({operationId,workspaceId:task.workspaceId,taskId:task.taskId,expectedRevision,pinned,archived}),parseTask,false);
  };
  const reconnect = (destination:string) => {globalThis.location.hash=providerSettingsHash(destination);};
  const signIn = async () => {
    const identity = identityBridge();
    if (!identity) return;
    try {
      await identity.signIn();
    } finally {
      draftStore.clear();
      await load();
    }
  };

  // Ctrl/Cmd+N and Escape, bound in the renderer only. The handler reads the
  // latest state through a ref, so the listener is added once.
  const newThreadShortcut = useRef<() => boolean>(() => false);
  newThreadShortcut.current = () => {
    if (!active || !bridge || !state?.signedIn || !workspaceId) return false;
    void createTask(null, null);
    return true;
  };
  const openSavedSurface=(surface:'search'|'inbox')=>{selectDestination();setSavedSurface(surface);};
  const searchShortcut=useRef<()=>void>(()=>{});searchShortcut.current=()=>{if(active)openSavedSurface('search');};
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if(!event.isComposing&&!event.repeat&&event.key.toLowerCase()==='k'&&event.ctrlKey!==event.metaKey&&!event.altKey&&!event.shiftKey){event.preventDefault();searchShortcut.current();return;}
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

  const authorizedWorkspace = state?.signedIn && state.workspaces.some(item => item.workspaceId === workspaceId);
  const currentTree = authorizedWorkspace && tree?.workspaceId === workspaceId ? tree : null;
  const task = useMemo(() => currentTree?.tasks.find((item) => item.taskId === openTaskId) ?? null, [currentTree, openTaskId]);
  const acceptedFor = (id:string) => {
    const entry=acceptedTasks[id];
    return authorizedWorkspace && entry?.workspaceId===workspaceId ? entry.binding : undefined;
  };
  useEffect(()=>{smokeStartTrace('shell-committed',{foreground:active,selected:!!openTaskId,taskPresent:!!task,receiptPresent:!!(openTaskId&&acceptedFor(openTaskId)),showStart});},[active,openTaskId,task,acceptedTasks,showStart,authorizedWorkspace]);
  const engagement = useMemo(() => (task?.engagementId ? (tree?.engagements.find((item) => item.engagementId === task.engagementId) ?? null) : null), [tree, task]);
  const workspace = state?.workspaces.find((item) => item.workspaceId === workspaceId) ?? null;

  const selectedItemId = openArtifact && selectedItem?.artifactId === openArtifact.artifactId ? selectedItem.itemId : null;
  // The draft follows the Task actually shown; a Task that vanished falls back to the no-Task draft.
  const draft = useDraftBinding(task?.taskId ?? null, draftStore, task?.workspaceId ?? null);
  const startDraft = useDraftBinding(null, draftStore);
  const conversationFollow=useConversationFollow(state?.signedIn&&!showStart&&task?JSON.stringify([ownerKey(person),task.workspaceId,task.taskId,runtimeEpoch]):null,!active||workView==='artifact'||!!savedHit?.hit||!!selectedQuestion||!!savedSurface);
  // Initial home is the real memory-only draft surface, never a persisted Task.
  // Do this once per owner/workspace and never replace a pending or visited draft.
  const initializedHome = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !authorizedWorkspace || !currentTree || !workspaceId) return;
    const scope = JSON.stringify([ownerKey(person), workspaceId]);
    if (initializedHome.current === scope) return;
    initializedHome.current = scope;
    if (openTaskId || openedEngagement || startLocation || pendingStart || savedSurface) return;
    setStartLocation({workspaceId, engagementId:null, folderId:null});
    setShowStart(true);
  }, [active, authorizedWorkspace, currentTree, workspaceId, person, openTaskId, openedEngagement, startLocation, pendingStart, savedSurface]);
  const [conversationPermissions,setConversationPermissions]=useState<string|null>(null);
  const [conversationOptions,setConversationOptions]=useState<string|null>(null);
  useEffect(()=>{setConversationOptions(null);setConversationPermissions(null);},[active,showStart,task?.taskId,task?.workspaceId,runtimeEpoch,person]);
  const composer = !state?.signedIn || showStart ? null : renderComposer ? renderComposer(draft) : task?.runtimeThreadId || (task&&acceptedFor(task.taskId)) ? <TaskLifecycle key={`${runtimeEpoch}:${task!.taskId}`} taskId={task!.taskId} workspaceId={task!.workspaceId} draft={draft} operationIds={operationIds} onContinuationRequested={conversationFollow.continuation}/> : <Composer draft={draft} />;

  return (
    <div
      ref={shellRef}
      className={`iq-shell iq-shell--${mode} iq-shell--nav-${presentation}`}
      data-shell
      data-new-chat={state?.signedIn && !task && !openTaskId && !openedEngagement && !showStart ? true : undefined}
      data-layout-mode={mode}
      data-nav-presentation={presentation}
      data-artifact-open={openArtifact ? 'true' : 'false'}
      data-artifact-fits={artifactFits(width) ? 'true' : 'false'}
      data-work-view={workView}
      style={{ '--iq-thread-min-width': `${THREAD_MIN_WIDTH}px`, '--sidebar-width':`${sidebarWidth}px` } as CSSProperties}
    >
      <Sidebar
        state={state}
        workspaceId={workspaceId}
        tree={currentTree}
        openTaskId={openTaskId}
        onSelectWorkspace={selectWorkspace}
        onOpenTask={openTaskFromNav}
        onNewThread={() => void createTask(null, null)}
        onNewTask={(engagementId, folderId) => void createTask(engagementId, folderId)}
        onCreateEngagement={createEngagement}
        onCreateFolder={createFolder}
        onSignIn={() => void signIn()}
        onShowSpecimen={onShowSpecimen}
        onSignOut={()=>{globalThis.location.hash='#settings-signout';}}
        sidebarWidth={sidebarWidth} sidebarMaximum={sidebarMaximum} onResizeSidebar={resizeSidebar}
        onSearch={()=>openSavedSurface('search')}
        onInbox={()=>openSavedSurface('inbox')}
        inboxCount={inbox && !inbox.unavailable ? inbox.items.length : null}
        newOperationId={operationIds}
        busy={creatingTask}
        presentation={presentation}
        overlayOpen={showOverlay}
        onCollapse={collapseNav}
        onExpand={expandNav}
        person={person}
      />
      <div className="iq-shell-main">
        <Header task={task} engagement={engagement} workspace={workspace} onOptions={()=>setConversationOptions(task?.taskId??null)} onPermissions={()=>setConversationPermissions(task?.taskId??null)} />
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
          <main ref={conversationFollow.threadRef} className="iq-thread" tabIndex={0} aria-label="Conversation" hidden={workView === 'artifact'} data-thread>
            <div ref={conversationFollow.contentRef} className="iq-shell-content">
              {notice ? (
                <div className="iq-shell-notice" data-shell-notice>
                  <p role="status">{notice}</p>
                  {noticeState?.kind==='navigation-unavailable' && workspaceId && bridge?.recoverNavigation && <>
                    <Button size="sm" onPress={()=>void refreshWorkspace()} pending={recoveringNavigation} pendingText="Checking Workspace access">Refresh workspace</Button>
                    <p>Rechecks your current access. Revoked permissions remain denied; no Task or command is restarted.</p>
                  </>}
                </div>
              ) : null}
              {state?.signedIn && startLocation ? <StartView
                key={`${ownerKey(person)}:${startLocation.workspaceId}`}
                {...startLocation} onPendingChange={setPendingStart} runtimeEpoch={runtimeEpoch} draft={startDraft} active={showStart && active} operationIds={operationIds}
                onAccepted={(accepted) => {
                  const origin=startLocation;
                  smokeStartTrace('shell-accepted',{workspaceAllowed:authorizedWorkspaces.current.includes(origin.workspaceId),foreground:activeStart.current.active&&activeStart.current.location===origin&&chosenWorkspace.current===origin.workspaceId});
                  if (!authorizedWorkspaces.current.includes(origin.workspaceId)) return;
                  setAcceptedTasks(previous => ({...previous,[accepted.taskId]:{workspaceId:origin.workspaceId,binding:accepted}}));
                  // Async acknowledgement may outlive this Start's foreground visit.
                  // Keep its binding without taking over the user's current navigation.
                  if (!activeStart.current.active || activeStart.current.location!==origin || chosenWorkspace.current!==origin.workspaceId) return;
                  setNotice(null); setOpenTaskId(accepted.taskId); setShowStart(false);
                  announce('Private Task accepted.'); void loadTree(origin.workspaceId);
                }}
              /> : null}
              {savedHit?.hit&&task?.taskId===savedHit.task.taskId&&savedHit.generation===authorityGeneration.current&&<section className="iq-saved-hit" aria-label="Selected saved message" tabIndex={-1} ref={element=>{if(element&&!element.dataset.focused){element.dataset.focused='true';setTimeout(()=>{if(element.isConnected){element.focus();element.scrollIntoView?.({block:'center'});}},0);}}}><h2>Selected saved message</h2><details><summary>Message source</summary><p>Turn {savedHit.hit.turnId} · Item {savedHit.hit.itemId}</p></details><p className="iq-progress-text">{savedHit.hit.text}</p><p>{savedHit.hit.truncated?'Bounded matching context; the full message is longer.':'Exact retained message.'} Inspection does not resume work.</p><Button onPress={()=>setSavedHit(null)}>Close saved message</Button></section>}
              {!showStart&&openedEngagement&&currentTree?.engagements.filter(e=>e.engagementId===openedEngagement).map(e=><section key={e.engagementId} aria-label="Engagement details"><h2>{e.name}</h2><p>{e.objectives}</p><p>{e.scope}</p><p>{e.clientEntity} · {e.periodStart}–{e.periodEnd}</p></section>)}
              {!showStart && task && tree ? (
                <TaskView
                  task={task}
                  accepted={acceptedFor(task.taskId)}
                  engagements={tree.engagements}
                  folders={tree.folders}
                  onNavigation={setNavigation}
                  onReconnect={reconnect}
                  selectedQuestion={selectedQuestion}
                  onRename={renameTask}
                  onMove={moveTask}
                  newOperationId={operationIds}
                  states={states}
                  statesNotice={statesNotice}
                  policy={taskPolicy}
                  policyNotice={policyNotice}
                  onSetMode={policyBridge() ? setMode : undefined}
                />
              ) : !showStart && openTaskId && acceptedFor(openTaskId) ? <AcceptedRequest accepted={acceptedFor(openTaskId)!}/> : !showStart ? (
                <div className="iq-thread-placeholder" data-thread-placeholder="none">
                  <p className="iq-thread-placeholder-title">What should we work on?</p>
                  <p className="iq-thread-placeholder-body">Start a new chat, or pick up a recent conversation.</p>
                </div>
              ) : null}
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
          {task && state?.signedIn ? (
            <PermissionRequests
              taskId={task.taskId}
              reviewer={taskPolicy && taskPolicy.taskId === task.taskId ? (taskPolicy.reviewer ?? null) : null}
              announce={announce}
              operationIds={operationIds}
            />
          ) : null}
          <div className="iq-composer-slot" data-composer-slot={composer ? 'filled' : 'empty'}>
            {conversationFollow.away&&<Button size="sm" onPress={conversationFollow.jump}>Jump to latest</Button>}
            {composer}
          </div>
        </div>
      </div>
      {active&&task&&conversationPermissions===task.taskId&&<SavedWorkDialog label="Conversation permissions" onClose={()=>setConversationPermissions(null)}><TaskPolicy compact policy={taskPolicy?.taskId===task.taskId?taskPolicy:null} notice={policyNotice} onSetMode={policyBridge()?setMode:undefined}/></SavedWorkDialog>}
      {active&&task&&<SavedWorkDialog key={`${ownerKey(person)}:${runtimeEpoch}:${task.workspaceId}:${task.taskId}`} open={conversationOptions===task.taskId} label="Conversation options" onClose={()=>setConversationOptions(null)}><TaskDetails task={task} engagements={tree?.engagements??[]} folders={tree?.folders??[]} onNavigation={setNavigation} onRename={renameTask} onMove={moveTask} newOperationId={operationIds}/></SavedWorkDialog>}
      {active&&savedSurface==='search'&&<Search key={`${workspaceId}:${runtimeEpoch}:${authorityGeneration.current}`} workspaceId={authorizedWorkspace?workspaceId:null} onClose={()=>setSavedSurface(null)} onOpen={acceptSaved} onEngagement={e=>{if(e.workspaceId===chosenWorkspace.current&&authorizedWorkspaces.current.includes(e.workspaceId)){selectDestination();openTask.current=null;setTree(previous=>previous?{...previous,engagements:[...previous.engagements.filter(row=>row.engagementId!==e.engagementId),e]}:previous);setOpenTaskId(null);setSavedHit(null);setShowStart(false);setOpenedEngagement(e.engagementId);}}}/>}
      {active&&savedSurface==='inbox'&&<Inbox key={`${workspaceId}:${runtimeEpoch}:${authorityGeneration.current}`} view={authorizedWorkspace?inbox:null} tasks={currentTree?.tasks??[]} onClose={()=>setSavedSurface(null)} onOpen={(task,question)=>{void openTaskFromNav(task,question);}}/>}
      <div className="iq-visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-shell-announcer data-announce-count={announcement.count}>
        {announcement.text ? <span key={announcement.count}>{announcement.text}</span> : null}
      </div>
    </div>
  );
}
