/**
 * Authorized progress presentation only; no transport, authority or lifecycle state.
 * WorkLogDetails adapts pingdotgg/t3code WorkLog.tsx at
 * 82b10d546c1041d8eff40425f076d61f608d518f (MIT, © 2026 T3 Tools Inc.).
 * Full attribution and license: desktop/THIRD_PARTY_NOTICES.md.
 */
import { useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { DiffLine } from '../primitives';
import type { ProgressItem } from './tasks-bridge';

const ended = (status: string) => ['completed', 'failed', 'cancelled', 'uncertain', 'setup-failed'].includes(status);
const LIVE_EDGE_PX = 4;

/** Follow only a scroller the reader has left at its live edge, never the page. */
export function WorkLogDetails({ children, followLive = false }: { children: ReactNode; followLive?: boolean }): ReactElement {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atLiveEdgeRef = useRef(true);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (followLive && atLiveEdgeRef.current && scroller) scroller.scrollTop = scroller.scrollHeight;
  });
  return <div ref={scrollerRef} className="iq-work-log-details"
    onScroll={event => {
      const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
      atLiveEdgeRef.current = scrollHeight - scrollTop - clientHeight <= LIVE_EDGE_PX;
    }}
    onClick={event => event.stopPropagation()}
    onPointerDown={event => event.stopPropagation()}>
    {children}
  </div>;
}

function nativeStatus(item: ProgressItem, status: string): string {
  if (ended(status) && item.status === 'running') return 'Execution ended — outcome unconfirmed';
  if (item.status === 'completed') return item.kind === 'message' ? 'Message complete' : 'Execution completed';
  return item.status;
}

function ItemContent({ item }: { item: ProgressItem }): ReactElement {
  return item.kind === 'edit'
    ? <><DiffLine kind="change" stage={item.application === 'applied' ? 'applied-locally' : 'suggested'}>{item.text}</DiffLine>
        {item.application !== 'applied' && <p>Not confirmed as applied. This is not a delivered artifact.</p>}</>
    : <p className="iq-progress-text">{item.text}</p>;
}

/** Preserve item order/identity and original text; never derive execution from output. */
export function ConversationItems({ items, status, label }: { items: ProgressItem[]; status: string; label: string }): ReactElement {
  return <ol className="iq-progress-items iq-conversation-items" aria-label={label}>
    {items.map(item => {
      const message = item.kind === 'message';
      const role = message ? item.role ?? 'unknown' : 'activity';
      return <li key={item.id} className={`iq-conversation-item iq-conversation-item--${role}`}
        data-progress-item={item.id} data-status={ended(status) && item.status === 'running' ? 'unconfirmed' : item.status}>
        {message ? <>
          <div className="iq-message-body">{role==='unknown'&&<span className="iq-message-unknown">Unknown speaker</span>}<ItemContent item={item} /></div>
        </> : <details className="iq-work-log-row">
          <summary><span className="iq-work-log-kind">{item.kind === 'command' ? 'Command' : item.kind === 'tool' ? 'Tool activity' : 'File change'}</span>
            <span className="iq-work-log-status">{ended(status) && item.status === 'running' ? 'Outcome unconfirmed' : nativeStatus(item, status)}</span>
          </summary>
          <WorkLogDetails followLive={!ended(status) && item.status === 'running'}>
            <ItemContent item={item} />
            {(item.kind === 'command' || item.kind === 'tool') && (item.status === 'failed' || item.status === 'cancelled') &&
              <p>Native status: this action {item.status}. The source/output text above remains untrusted; this status alone does not establish a policy refusal or detection of untrusted instructions.</p>}
            </WorkLogDetails>
        </details>}
      </li>;
    })}
  </ol>;
}
