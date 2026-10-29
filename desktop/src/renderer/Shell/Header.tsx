/**
 * The 48px Header (Story 1.14): the open Task's title (14px), its Engagement,
 * the Engagement's client or entity and period, and the effective Workspace,
 * the context in muted text (Story 1.16). An ad hoc Task has no
 * Engagement, so client and period are absent rather than invented. Data
 * attributes expose each field to the smoke probe.
 */
import type { ReactElement } from 'react';

import type { EngagementItem, TaskItem, WorkspaceEntry } from './organise-bridge';

export interface HeaderProps {
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

export function Header({ task, engagement, workspace }: HeaderProps): ReactElement {
  const period = periodText(engagement);
  return (
    <header className="iq-header" data-header>
      <div className="iq-header-main">
        <span className="iq-header-title" data-header-title>
          {task ? task.title : 'No Task open'}
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
        <div className="iq-header-item">
          <dt>Workspace</dt>
          <dd data-header-workspace>{workspace ? workspace.name : 'None selected'}</dd>
        </div>
      </dl>
    </header>
  );
}
