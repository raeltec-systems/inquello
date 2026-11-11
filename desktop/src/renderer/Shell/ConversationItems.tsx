/**
 * Authorized progress presentation only; no transport, authority or lifecycle state.
 * WorkLogDetails adapts pingdotgg/t3code WorkLog.tsx at
 * 82b10d546c1041d8eff40425f076d61f608d518f (MIT, © 2026 T3 Tools Inc.).
 * Full attribution and license: desktop/THIRD_PARTY_NOTICES.md.
 */
import { useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { DiffLine } from '../primitives';
import { MessageMarkdown } from './MessageMarkdown';
import { MessageWithSources } from './SourceReferences';
import type { MessageReferences } from './sources-bridge';
import type { ProgressItem } from './tasks-bridge';

/** Story 2.1: checked references per agent message, by item ID, as main reported them. */
export type ReferencesByItem = ReadonlyMap<string, MessageReferences>;

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

/** A running item in a run that has ended is never shown as completed. */
const unconfirmed = (item: ProgressItem, status: string) => ended(status) && item.status === 'running';

function nativeStatus(item: ProgressItem, status: string): string {
  if (unconfirmed(item, status)) return 'Execution ended — outcome unconfirmed';
  if (item.status === 'completed') return item.kind === 'message' ? 'Message complete' : 'Execution completed';
  return item.status;
}

const kindLabel = (item: ProgressItem) => item.kind === 'command' ? 'Command' : item.kind === 'tool' ? 'Tool activity' : item.kind === 'edit' ? 'File change' : 'Message';

function ItemContent({ item, references }: { item: ProgressItem; references?: ReferencesByItem }): ReactElement {
  if (item.kind === 'edit') return <><DiffLine kind="change" stage={item.application === 'applied' ? 'applied-locally' : 'suggested'}>{item.text}</DiffLine>
    {item.application !== 'applied' && <p>Not confirmed as applied. This is not a delivered artifact.</p>}</>;
  // Only the agent's own message text is formatted. Everything else stays literal.
  if (item.kind === 'message' && item.role === 'agent') {
    const checked = references?.get(item.id);
    return checked ? <MessageWithSources text={item.text} references={checked} /> : <MessageMarkdown text={item.text} />;
  }
  return <p className="iq-progress-text">{item.text}</p>;
}

function Row({ item, status, references }: { item: ProgressItem; status: string; references?: ReferencesByItem }): ReactElement {
  const message = item.kind === 'message';
  const role = message ? item.role ?? 'unknown' : 'activity';
  return <li className={`iq-conversation-item iq-conversation-item--${role}`}
    data-progress-item={item.id} data-status={unconfirmed(item, status) ? 'unconfirmed' : item.status}>
    {message
      ? <div className="iq-message-body">{role === 'unknown' && <span className="iq-message-unknown">Unknown speaker</span>}<ItemContent item={item} references={references} /></div>
      : <details className="iq-work-log-row">
        <summary><span className="iq-work-log-kind">{kindLabel(item)}</span>
          <span className="iq-work-log-status">{unconfirmed(item, status) ? 'Outcome unconfirmed' : nativeStatus(item, status)}</span>
        </summary>
        <WorkLogDetails followLive={!ended(status) && item.status === 'running'}>
          <ItemContent item={item} />
          {(item.kind === 'command' || item.kind === 'tool') && (item.status === 'failed' || item.status === 'cancelled') &&
            <p>Native status: this action {item.status}. The source/output text above remains untrusted; this status alone does not establish a policy refusal or detection of untrusted instructions.</p>}
        </WorkLogDetails>
      </details>}
  </li>;
}

/** How the open conversation's latest turn is headed. */
export interface TurnHeading {
  /** The run's native status. */
  status: string;
  /** The neutral end-of-turn text; present only when the latest turn finished. */
  finished?: { text: string; measured: boolean };
  /** The sidebar's live wording (Running, Waiting for your answer, Interrupted …); empty when finished. */
  live: string;
}

type Block = { kind: 'item'; item: ProgressItem } | { kind: 'group'; key: string; items: ProgressItem[]; latest: boolean };

/**
 * Turns start at each user message. Within a turn, the contiguous span from its
 * first to its last action becomes one group; messages before and after stay in
 * the transcript. Every item keeps its original order and identity.
 */
export function turnBlocks(items: ProgressItem[]): Block[] {
  const turns: ProgressItem[][] = [];
  for (const item of items) {
    if (!turns.length || (item.kind === 'message' && item.role === 'user')) turns.push([]);
    turns[turns.length - 1]!.push(item);
  }
  const blocks: Block[] = [];
  turns.forEach((turn, index) => {
    const first = turn.findIndex(item => item.kind !== 'message');
    if (first < 0) { for (const item of turn) blocks.push({ kind: 'item', item }); return; }
    let last = turn.length - 1;
    while (turn[last]!.kind === 'message') last--;
    for (const item of turn.slice(0, first)) blocks.push({ kind: 'item', item });
    blocks.push({ kind: 'group', key: turn[first]!.id, items: turn.slice(first, last + 1), latest: index === turns.length - 1 });
    for (const item of turn.slice(last + 1)) blocks.push({ kind: 'item', item });
  });
  return blocks;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Native counts only; the summary never says completed, accepted or done. */
function activitySummary(items: ProgressItem[], status: string): string {
  const actions = items.filter(item => item.kind !== 'message');
  const parts = [plural(actions.length, 'step')];
  const count = (test: (item: ProgressItem) => boolean) => actions.filter(test).length;
  const failed = count(item => item.status === 'failed'), cancelled = count(item => item.status === 'cancelled');
  const open = count(item => unconfirmed(item, status)), unknown = count(item => item.status === 'unknown');
  const proposed = count(item => item.status === 'proposed');
  if (failed) parts.push(`${failed} failed`);
  if (cancelled) parts.push(`${cancelled} cancelled`);
  if (open) parts.push(`${open} outcome unconfirmed`);
  if (unknown) parts.push(`${unknown} status unknown`);
  if (proposed) parts.push(`${proposed} proposed`);
  return parts.join(' · ');
}

/** The step a running turn is on: the latest running action, else the latest action. */
function currentStep(items: ProgressItem[]): string {
  const actions = items.filter(item => item.kind !== 'message');
  const step = [...actions].reverse().find(item => item.status === 'running') ?? actions[actions.length - 1];
  if (!step) return '';
  const line = step.text.split('\n').find(text => text.trim())?.trim() ?? '';
  return line ? `${kindLabel(step)}: ${line.length > 96 ? `${line.slice(0, 95)}…` : line}` : kindLabel(step);
}

function FinishedLine({ finished, as = 'p' }: { finished: NonNullable<TurnHeading['finished']>; as?: 'p' | 'span' }): ReactElement {
  const Tag = as;
  return <Tag className="iq-turn-finished" data-turn-finished data-turn-duration={finished.measured ? 'measured' : 'unknown'}>{finished.text}</Tag>;
}

function ActivityGroup({ items, status, heading, latest }: { items: ProgressItem[]; status: string; heading?: TurnHeading; latest: boolean }): ReactElement {
  const running = latest && !!heading && !ended(heading.status);
  const finished = latest ? heading?.finished : undefined;
  const state = finished ? 'finished' : running ? 'running' : latest && heading?.live ? 'ended' : 'earlier';
  return <li className="iq-activity-group" data-activity-group data-activity-state={state}>
    <details className="iq-activity">
      <summary>
        <span className="iq-activity-heading">
          {finished ? <FinishedLine finished={finished} as="span" />
            : <span className="iq-activity-status">{latest && heading?.live ? heading.live : 'Activity'}</span>}
          <span className="iq-activity-summary">{running ? currentStep(items) || activitySummary(items, status) : activitySummary(items, status)}</span>
        </span>
      </summary>
      <ol className="iq-progress-items iq-activity-items" aria-label="Turn activity">
        {items.map(item => <Row key={item.id} item={item} status={status} />)}
      </ol>
    </details>
  </li>;
}

/**
 * Preserve item order/identity and original text; never derive execution from output.
 * `grouped` folds each turn's actions into one collapsed group (the open
 * conversation); evidence lists pass `grouped={false}` and keep one row each.
 */
export function ConversationItems({ items, status, label, grouped = false, heading, references }: { items: ProgressItem[]; status: string; label: string; grouped?: boolean; heading?: TurnHeading; references?: ReferencesByItem }): ReactElement {
  if (!grouped) return <ol className="iq-progress-items iq-conversation-items" aria-label={label}>
    {items.map(item => <Row key={item.id} item={item} status={status} references={references} />)}
  </ol>;
  const blocks = turnBlocks(items);
  // The finished line heads the latest turn's group; without one it ends the turn.
  const finishedInGroup = !!heading?.finished && blocks.some(block => block.kind === 'group' && block.latest);
  return <>
    <ol className="iq-progress-items iq-conversation-items" aria-label={label}>
      {blocks.map(block => block.kind === 'item'
        ? <Row key={block.item.id} item={block.item} status={status} references={references} />
        : <ActivityGroup key={`group:${block.key}`} items={block.items} status={status} heading={heading} latest={block.latest} />)}
    </ol>
    {heading?.finished && !finishedInGroup && <FinishedLine finished={heading.finished} />}
  </>;
}
