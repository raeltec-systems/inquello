/**
 * The 48px Header (Story 1.14): the open Task's title (14px), its Engagement,
 * the Engagement's client or entity and period, and the effective Workspace,
 * the context in muted text (Story 1.16). An ad hoc Task has no
 * Engagement, so client and period are absent rather than invented. Data
 * attributes expose each field to the smoke probe.
 */
import type { ReactElement } from 'react';
import {Menu} from '../primitives';

import type { EngagementItem, TaskItem, WorkspaceEntry } from './organise-bridge';

export interface HeaderProps {
  onOptions?:()=>void;
  onPermissions?:()=>void;
  task: TaskItem | null;
  engagement: EngagementItem | null;
  workspace: WorkspaceEntry | null;
}

/** `YYYY-MM-DD – YYYY-MM-DD`, or one open end; null without a period. */
export function periodText(engagement: EngagementItem | null): string | null {
  if (!engagement || (!engagement.periodStart && !engagement.periodEnd)) return null;
  if (engagement.periodStart && engagement.periodEnd) return `${engagement.periodStart} – ${engagement.periodEnd}`;
  return engagement.periodStart ? `From ${engagement.periodStart}` : `Until ${engagement.periodEnd}`;
}

export function Header({ task, engagement,onOptions,onPermissions }: HeaderProps): ReactElement {
  const period = periodText(engagement);
  return (
    <header className="iq-header" data-header data-header-empty={!task && !engagement || undefined}>
      <div className="iq-header-main">
        <span className="iq-header-title" data-header-title>
          {task ? conversationTitle(task.title) : 'Inquello'}
        </span>
        {task ? (
          <span className="iq-header-private" data-header-visibility="private">
            Private to you
          </span>
        ) : null}
      </div>
      <dl className="iq-header-context">
        {engagement ? (
          <div className="iq-header-item">
            <dt>Engagement</dt>
            <dd data-header-engagement>{engagement.name}</dd>
          </div>
        ) : null}
        {engagement?.clientEntity ? (
          <div className="iq-header-item">
            <dt>Client</dt>
            <dd data-header-client>{engagement.clientEntity}</dd>
          </div>
        ) : null}
        {period ? (
          <div className="iq-header-item">
            <dt>Period</dt>
            <dd data-header-period>{period}</dd>
          </div>
        ) : null}

      </dl>
      {task&&onOptions&&<Menu showChevron={false} label="Conversation options" triggerContent={<span aria-hidden="true">•••</span>} triggerVariant="quiet" items={[{label:"Rename or organise",onSelect:onOptions},...(onPermissions?[{label:"Permissions",onSelect:onPermissions}]:[])]}/>}
    </header>
  );
}

export function conversationTitle(title:string):string {return title==='Private task'?'New chat':title;}
