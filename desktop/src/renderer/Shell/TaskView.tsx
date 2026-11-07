import type {QuestionSelection} from './Inbox';
import { TaskProgress } from './TaskProgress';
import { TaskStates } from './TaskStates';
import { UsageLimitNotices } from './TaskUsage';
import type { StartedTask } from './tasks-bridge';
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
 * - Task states (Story 1.15, owner amendment 2026-11-04): execution shows as
 *   the sidebar's live status and the neutral end-of-turn line in the
 *   conversation; checks, review, Professional Approval and Delivery appear
 *   only once a record exists, with no "Not recorded" placeholders.
 * - The policy section (Story 1.18) summarises the effective policy on this
 *   device and the Task's execution mode, with the explicit confirmation a
 *   broader mode needs.
 * - The Composer (Story 1.17) sits below in the Shell; runtime threads come with Story 1.25:
 *   nothing here starts work.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';

import { Button, Menu, TextField, type MenuEntry } from '../primitives';
import type { EngagementItem, FolderItem, Outcome, TaskItem } from './organise-bridge';
import type { TaskPolicyItem } from '../policy-bridge';
import type { TaskStatesItem } from './state-bridge';

export function AcceptedRequest({accepted}:{accepted:StartedTask}):ReactElement {
  return <section aria-label="Conversation"><div className="iq-message-body iq-conversation-item--user"><p className="iq-progress-text">{accepted.request}</p></div></section>;
}

export interface MoveTarget {
  engagementId: string | null;
  folderId: string | null;
}

export interface TaskViewProps {
  task: TaskItem;
  accepted?: StartedTask;
  engagements: readonly EngagementItem[];
  folders: readonly FolderItem[];
  onNavigation?: (task:TaskItem,pinned:boolean,archived:boolean,operationId:string,expectedRevision:number)=>Promise<Outcome<TaskItem>>;
  onReconnect?: (destination:string)=>void;
  selectedQuestion?:QuestionSelection|null;
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

export function TaskDetails({
  task,
  accepted,
  engagements,
  folders,
  onRename,
  onNavigation,
  onReconnect,
  selectedQuestion,
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
  const [navigation,setNavigation]=useState<{operationId:string;pinned:boolean;archived:boolean;expectedRevision:number;conflict?:boolean}|null>(null);
  const origin=useRef({key:`${task.workspaceId}:${task.taskId}`,generation:0});
  const key=`${task.workspaceId}:${task.taskId}`;
  // Render-synchronous: a completion cannot sneak between a Task switch and its effect.
  if(origin.current.key!==key)origin.current={key,generation:origin.current.generation+1};
  useEffect(()=>()=>{origin.current.generation++;},[]);
  const navigate=async(pinned:boolean,archived:boolean)=>{
    if(!onNavigation||busy)return;
    const generation=origin.current.generation;
    const op=navigation?(navigation.conflict?{...navigation,expectedRevision:task.revision}:navigation):{operationId:newOperationId(),pinned,archived,expectedRevision:task.revision};
    setNavigation(op);setBusy(true);
    let result:Outcome<TaskItem>;
    try{result=await onNavigation(task,op.pinned,op.archived,op.operationId,op.expectedRevision);}
    catch{result={ok:false,code:'failed',reason:'Navigation could not be confirmed. Retry the same change.'};}
    if(generation!==origin.current.generation)return;
    setBusy(false);
    if(result.ok){setNavigation(null);setNotice(result.value.archived?'Archived from navigation. No authoritative record was deleted; running work was not stopped.':'Navigation preference saved.');}
    else {if(result.code==='conflict')setNavigation({...op,conflict:true});setNotice(result.reason);}
  };

  // A different Task opened: start from its title.
  useEffect(() => {
    setDraft(task.title);
    setBusy(false);
    setRenameOp(null);
    setNavigation(null);
    setNotice(null);
  }, [task.taskId,task.workspaceId]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || draft.trim() === '' || draft.trim() === task.title) return;
    const operationId = renameOp ?? newOperationId();
    setRenameOp(operationId);
    setBusy(true);
    setNotice(null);
    const generation=origin.current.generation;
    const result = await onRename(task, draft, operationId);
    if(generation!==origin.current.generation)return;
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
      const generation=origin.current.generation;
      void onMove(task, target).then((result) => {
        if(generation!==origin.current.generation)return;
        if (!result.ok) setNotice(result.reason);
      });
    },
  };

  return (
    <section className="iq-task" aria-label="Task" data-task-view={task.taskId}>
      <div className="iq-task-actions">
      <div className="iq-task-tools">
        {onNavigation&&<Menu label="Organise conversation" items={[
          {label:task.pinned?'Unpin':'Pin',disabledReason:busy?'Saving navigation.':navigation?'Retry the pending navigation change first.':undefined,onSelect:()=>void navigate(!task.pinned,!!task.archived)},
          {label:task.archived?'Unarchive':'Archive',description:'Personal navigation only. No authoritative record is deleted, and running work is not stopped.',disabledReason:busy?'Saving navigation.':navigation?'Retry the pending navigation change first.':undefined,onSelect:()=>void navigate(!!task.pinned,!task.archived)}
        ]}/>}
        {navigation&&!busy&&<Button onPress={()=>void navigate(navigation.pinned,navigation.archived)}>Retry navigation change</Button>}
        {task.archived&&<p>Archived. Opening does not unarchive this Task.</p>}
        <form className="iq-task-rename" onSubmit={(event) => void save(event)} data-task-rename>
          <TextField label="Conversation title" value={draft} onChange={setDraft} />
          <Button variant="secondary" size="sm" type="submit" pending={busy} disabledReason={draft.trim() === '' ? 'A title is required.' : undefined}>
            Rename
          </Button>
        </form>
        <div data-task-move>
          <Menu label="Move" heading="Move this conversation" items={[targets]} triggerVariant="secondary" />
        </div>
      </div>
      {notice ? (
        <p className="iq-task-notice" role="status" data-task-notice>
          {notice}
        </p>
      ) : null}
      </div>

    </section>
  );
}

/** Ordinary chat is a transcript, not a runtime inspector. */
export function TaskView({task,accepted,selectedQuestion,states=null}:TaskViewProps):ReactElement {
 return <section className="iq-task" aria-label="Conversation" data-task-view={task.taskId}>
  <TaskProgress key={task.taskId} taskId={task.taskId} workspaceId={task.workspaceId} selectedQuestion={selectedQuestion} accepted={accepted}/>
  <UsageLimitNotices taskId={task.taskId}/>
  <TaskStates states={states?.taskId===task.taskId?states:null}/>
 </section>;
}
