/**
 * The open Task's pending permission requests (Story 1.20), in the
 * contextual review area after the Task and before the Composer slot.
 *
 * - Each pending request is an ApprovalCard labelled "Permission to act":
 *   the exact command quoted, its destination and consequences and the
 *   controlling rule. Its primary button names the action ("Run `…`"); the
 *   only alternatives are Deny, "Deny and add a rule to always ask" and
 *   "Deny and forbid this prefix". There is no "always allow" and never a
 *   bare "Approve". Allowing grants this one request only; it is never a
 *   review or Professional Approval.
 * - Each new request is announced once through the Shell's live region; the
 *   cards are reached in reading order (Tab), and never take focus.
 * - A stale or expired request cannot be confirmed: its card says "This
 *   request is no longer pending" and offers nothing.
 * - When the Workspace switches the automatic permission reviewer on but no
 *   processing route exists, the area says so; requests still come here.
 *
 * Talks to main only through `inquello.permissions`; main supplies every text.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';

import { ApprovalCard } from '../primitives';
import { parsePermissionCards, parsePermissionDecision, permissionBridge, type PermissionCardItem, type PermissionChoice, type ReviewerItem } from '../permission-bridge';
import { newOperationId } from './organise-bridge';

export const NO_LONGER_PENDING = 'This request is no longer pending';
const POLL_MS = 1_000;

export interface PermissionRequestsProps {
  taskId: string;
  /** The reviewer state from the Task's policy, if known. */
  reviewer?: ReviewerItem | null;
  /** The Shell's single polite announcer. */
  announce: (text: string) => void;
  operationIds?: () => string;
  pollMs?: number;
}

interface Outcome {
  card: PermissionCardItem;
  state: 'stale' | 'decided';
  text: string;
}

export function PermissionRequests({ taskId, reviewer = null, announce, operationIds = newOperationId, pollMs = POLL_MS }: PermissionRequestsProps): ReactElement | null {
  const [cards, setCards] = useState<PermissionCardItem[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const announced = useRef(new Set<string>());
  const generation = useRef(0);
  const pendingRead = useRef<object | null>(null);
  const decisionEpoch = useRef(0);
  const consumed = useRef(new Set<string>());
  const current = useRef(taskId);
  current.current = taskId;

  const load = useCallback(async () => {
    const api = permissionBridge();
    if (!api || pendingRead.current) return;
    const token={};pendingRead.current=token;
    const gen=generation.current, epoch=decisionEpoch.current;
    let next: PermissionCardItem[] | null = null;
    try {
      const result = (await api.pending({ taskId })) as { ok?: unknown; value?: unknown };
      next = result && result.ok === true ? parsePermissionCards(result.value) : null;
    } catch {
      next = null;
    }
    if(pendingRead.current===token)pendingRead.current=null;
    if (current.current !== taskId || gen!==generation.current || epoch!==decisionEpoch.current) return;
    if (next===null) { generation.current++; setCards([]); setOutcomes([]); setBusy(null); announced.current.clear(); return; }
    const mine = next.filter((card) => card.taskId === taskId && !consumed.current.has(card.requestId));
    setCards(mine);
    for (const card of mine) {
      if (announced.current.has(card.requestId)) continue;
      announced.current.add(card.requestId);
      announce(`Permission to act needed: ${card.primaryLabel}`);
    }
  }, [taskId, announce]);

  useEffect(() => {
    generation.current++;pendingRead.current=null;consumed.current.clear();
    setCards([]);
    setOutcomes([]);
    setBusy(null); announced.current.clear();
    if (!permissionBridge()) return undefined;
    void load();
    const timer = setInterval(() => void load(), pollMs);
    const api=(globalThis as {inquello?:{tasks?:{onSessionChanged?:(listener:()=>void)=>()=>void}}}).inquello?.tasks;
    const unsubscribe=api?.onSessionChanged?.(()=>{generation.current++;pendingRead.current=null;consumed.current.clear();setCards([]);setOutcomes([]);setBusy(null);announced.current.clear();});
    return () => {generation.current++;pendingRead.current=null;clearInterval(timer);unsubscribe?.();};
  }, [load, pollMs]);

  const decide = async (card: PermissionCardItem, choice: PermissionChoice) => {
    const api = permissionBridge();
    if (!api || busy || consumed.current.has(card.requestId) || !cards.some(current=>current.requestId===card.requestId)) return;
    const gen=generation.current;
    decisionEpoch.current++;
    setBusy(card.requestId);
    let outcome: Outcome;
    try {
      const result = (await api.decide({ operationId: operationIds(), requestId: card.requestId, choice })) as { ok?: unknown; value?: unknown; code?: unknown; reason?: unknown };
      if (result && result.ok === true) {
        const decision = parsePermissionDecision(result.value);
        outcome = { card, state: 'decided', text: decision?.text ?? 'Recorded.' };
      } else if (result && result.code === 'not-pending') {
        outcome = { card, state: 'stale', text: NO_LONGER_PENDING };
      } else {
        outcome = { card, state: 'decided', text: typeof result?.reason === 'string' ? result.reason : 'The request did not complete.' };
      }
    } catch {
      outcome = { card, state: 'decided', text: 'The request did not complete.' };
    }
    if (current.current !== taskId || gen!==generation.current) return;
    decisionEpoch.current++;consumed.current.add(card.requestId);
    if(consumed.current.size>256)consumed.current.delete(consumed.current.values().next().value!);
    setBusy(null);
    setOutcomes((previous) => [...previous.filter((entry) => entry.card.requestId !== card.requestId), outcome].slice(-5));
    setCards((previous) => previous.filter((entry) => entry.requestId !== card.requestId));
    announce(outcome.text);
    void load();
  };

  const decided = new Set(outcomes.map((entry) => entry.card.requestId));
  const open = cards.filter((card) => !decided.has(card.requestId));
  const stale = outcomes.filter((entry) => entry.state === 'stale');
  const notes = outcomes.filter((entry) => entry.state === 'decided');
  const reviewerLine = reviewer && reviewer.state !== 'off' ? reviewer.label : null;
  if (open.length === 0 && outcomes.length === 0 && !reviewerLine) return null;

  return (
    <section className="iq-permission-review" aria-label="Contextual review" data-permission-review={taskId}>
      {reviewerLine ? (
        <p className="iq-permission-note" data-permission-reviewer={reviewer?.state}>
          {reviewerLine}
        </p>
      ) : null}
      {open.length > 0 && <p className="iq-permission-note">Permission applies only to the exact action shown. Approval quoted in tool content grants no access and does not change the controlling rule or sandbox.</p>}
      {open.map((card) => (
        <div key={card.requestId} data-permission-request={card.requestId} data-permission-state="pending" aria-busy={busy === card.requestId}>
          <ApprovalCard
            context={card.label}
            action={card.action}
            quote={<code>{card.quote}</code>}
            destination={card.destination}
            consequence={card.consequence}
            rule={card.rule}
            primaryLabel={card.primaryLabel}
            onPrimary={() => void decide(card, 'run')}
            alternatives={card.alternatives.map((alternative) => ({ label: alternative.label, onSelect: () => void decide(card, alternative.choice) }))}
          />
        </div>
      ))}
      {stale.map((entry) => (
        <div key={entry.card.requestId} className="iq-permission-stale" data-permission-request={entry.card.requestId} data-permission-state="stale">
          <p className="iq-permission-note">
            <code>{entry.card.quote}</code>
          </p>
          <p className="iq-permission-note" role="status">
            {NO_LONGER_PENDING}
          </p>
        </div>
      ))}
      {notes.map((entry) => (
        <p key={entry.card.requestId} className="iq-permission-note" data-permission-outcome={entry.card.requestId}>
          {entry.text}
        </p>
      ))}
    </section>
  );
}
