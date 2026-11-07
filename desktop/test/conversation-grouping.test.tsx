// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConversationItems, turnBlocks, type TurnHeading } from '../src/renderer/Shell/ConversationItems';
import type { ProgressItem } from '../src/renderer/Shell/tasks-bridge';

afterEach(cleanup);

const user = (id: string, text = id): ProgressItem => ({ id, kind: 'message', role: 'user', status: 'completed', text });
const agent = (id: string, text = id, status: ProgressItem['status'] = 'completed'): ProgressItem => ({ id, kind: 'message', role: 'agent', status, text });
const command = (id: string, status: ProgressItem['status'] = 'completed', text = `run ${id}`): ProgressItem => ({ id, kind: 'command', status, text });

const twoTurns: ProgressItem[] = [
  user('u1'), agent('a1', 'Checking the register.'), command('c1'), { id: 't1', kind: 'tool', status: 'failed', text: 'read failed' }, agent('a2', 'Final answer one.'),
  user('u2'), command('c2', 'running', 'pytest -q\nmore output'), agent('a3', 'Streaming…', 'running'),
];
const finished = (heading: Partial<TurnHeading> = {}): TurnHeading => ({ status: 'completed', live: '', finished: { text: 'Finished · worked for 1m 12s', measured: true }, ...heading });

describe('Codex-style grouped activity per turn', () => {
  it('folds each turn’s action span into one group without reordering any item', () => {
    const blocks = turnBlocks(twoTurns);
    expect(blocks.map(block => block.kind === 'item' ? block.item.id : `[${block.items.map(item => item.id).join(',')}]`))
      .toEqual(['u1', 'a1', '[c1,t1]', 'a2', 'u2', '[c2]', 'a3']);
    const { container } = render(<ConversationItems items={twoTurns} status="running" label="Work activity" grouped heading={{ status: 'running', live: 'Running' }} />);
    expect([...container.querySelectorAll('[data-progress-item]')].map(row => row.getAttribute('data-progress-item'))).toEqual(twoTurns.map(item => item.id));
    expect(container.querySelectorAll('[data-activity-group]')).toHaveLength(2);
    for (const group of container.querySelectorAll<HTMLDetailsElement>('[data-activity-group] > details')) expect(group.open).toBe(false);
  });

  it('heads a running turn with the live status and its current step, and earlier turns with neutral counts', () => {
    const { container } = render(<ConversationItems items={twoTurns} status="running" label="Work activity" grouped heading={{ status: 'running', live: 'Running' }} />);
    const [earlier, current] = [...container.querySelectorAll('[data-activity-group]')];
    expect(earlier!.getAttribute('data-activity-state')).toBe('earlier');
    expect(earlier!.querySelector('summary')!.textContent).toBe('Activity2 steps · 1 failed');
    expect(current!.getAttribute('data-activity-state')).toBe('running');
    expect(current!.querySelector('.iq-activity-status')!.textContent).toBe('Running');
    expect(current!.querySelector('.iq-activity-summary')!.textContent).toBe('Command: pytest -q');
    expect(container.querySelector('[data-turn-finished]')).toBeNull();
    // Streaming agent text stays in the transcript, outside the collapsed group.
    expect(container.querySelector('[data-progress-item="a3"]')!.closest('[data-activity-group]')).toBeNull();
  });

  it('heads the finished latest turn with the neutral end-of-turn line and never claims acceptance', () => {
    const items = [user('u1'), command('c1'), command('c2', 'cancelled'), { id: 'e1', kind: 'edit', status: 'proposed', text: 'note', application: 'suggested' } as ProgressItem, agent('a1', 'Done answer')];
    const { container } = render(<ConversationItems items={items} status="completed" label="Work activity" grouped heading={finished()} />);
    const group = container.querySelector('[data-activity-group]')!;
    expect(group.getAttribute('data-activity-state')).toBe('finished');
    const line = group.querySelector<HTMLElement>('[data-turn-finished]')!;
    expect(line.className).toBe('iq-turn-finished');
    expect(line.textContent).toBe('Finished · worked for 1m 12s');
    expect(line.dataset.turnDuration).toBe('measured');
    const summary = group.querySelector('.iq-activity-summary')!.textContent!;
    expect(summary).toBe('3 steps · 1 cancelled · 1 proposed');
    expect(group.querySelector('summary')!.textContent).not.toMatch(/accept|approv|complete|success|\bdone\b/i);
    expect(container.querySelectorAll('[data-turn-finished]')).toHaveLength(1);
    const items$ = container.querySelector('.iq-conversation-items')!;
    expect(items$.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ends a finished turn without actions with the standalone neutral line', () => {
    const { container } = render(<ConversationItems items={[user('u1'), agent('a1')]} status="completed" label="Work activity" grouped heading={finished({ finished: { text: 'Finished', measured: false } })} />);
    expect(container.querySelector('[data-activity-group]')).toBeNull();
    const line = container.querySelector<HTMLElement>('p[data-turn-finished]')!;
    expect(line.textContent).toBe('Finished');
    expect(line.previousElementSibling?.classList.contains('iq-conversation-items')).toBe(true);
  });

  it('keeps interrupted wording and shows a formerly running step as unconfirmed, never completed', () => {
    const items = [user('u1'), command('c1', 'running', 'still going')];
    const { container } = render(<ConversationItems items={items} status="cancelled" label="Work activity" grouped heading={{ status: 'cancelled', live: 'Interrupted — Resume available' }} />);
    const group = container.querySelector('[data-activity-group]')!;
    expect(group.getAttribute('data-activity-state')).toBe('ended');
    expect(group.querySelector('summary')!.textContent).toBe('Interrupted — Resume available1 step · 1 outcome unconfirmed');
    fireEvent.click(group.querySelector('summary')!);
    const row = within(group as HTMLElement).getByText('Outcome unconfirmed').closest('[data-progress-item]')!;
    expect(row.getAttribute('data-status')).toBe('unconfirmed');
    expect(document.body.textContent).not.toMatch(/Finished|Execution completed/);
  });

  it('keeps the group, its open state and row identity while the turn streams and finishes', () => {
    const start = [user('u1'), command('c1', 'running', 'first')];
    const view = render(<ConversationItems items={start} status="running" label="Work activity" grouped heading={{ status: 'running', live: 'Running' }} />);
    const group = view.container.querySelector<HTMLDetailsElement>('[data-activity-group] > details')!;
    const row = view.container.querySelector('[data-progress-item="c1"]')!;
    fireEvent.click(group.querySelector('summary')!);
    expect(group.open).toBe(true);
    const next = [user('u1'), command('c1', 'completed', 'first'), command('c2', 'running', 'second'), agent('a1', 'Partial **answer**', 'running')];
    view.rerender(<ConversationItems items={next} status="running" label="Work activity" grouped heading={{ status: 'running', live: 'Running' }} />);
    expect(view.container.querySelector('[data-activity-group] > details')).toBe(group);
    expect(group.open).toBe(true);
    expect(view.container.querySelector('[data-progress-item="c1"]')).toBe(row);
    expect(view.container.querySelector('.iq-activity-summary')!.textContent).toBe('Command: second');
    view.rerender(<ConversationItems items={[...next.slice(0, 2), command('c2'), agent('a1', 'Partial **answer** done')]} status="completed" label="Work activity" grouped heading={finished()} />);
    expect(view.container.querySelector('[data-activity-group] > details')).toBe(group);
    expect(group.querySelector('[data-turn-finished]')!.textContent).toBe('Finished · worked for 1m 12s');
    expect(screen.getByText('answer').tagName).toBe('STRONG');
  });

  it('keeps evidence lists ungrouped, one row per item', () => {
    const { container } = render(<ConversationItems items={[command('c1'), command('c2')]} status="completed" label="Evidence" />);
    expect(container.querySelector('[data-activity-group]')).toBeNull();
    expect(container.querySelectorAll('.iq-work-log-row')).toHaveLength(2);
  });
});
