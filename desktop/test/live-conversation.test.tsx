// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaskProgress } from '../src/renderer/Shell/TaskProgress';
import { LIVE_REFRESH_MS } from '../src/renderer/Shell/task-observation';
import type { ProgressSnapshot, ProgressResult } from '../src/renderer/Shell/tasks-bridge';

const base: ProgressSnapshot = { version: 1, taskId: 'task-1', workspaceId: 'workspace-1', runId: 'run-1', threadId: 'thread-1', turnId: 'turn-1', runtimeId: 'runtime-1', sessionGeneration: 1, status: 'running', historyIncomplete: false, items: [], plan: [], results: [], artifact: 'absent', questions: [] };
const sleep = (ms: number) => act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); });

function setup(initial: ProgressSnapshot) {
  let next = initial, changed = () => {};
  const progress = vi.fn(async () => ({ ok: true, value: next }));
  Object.assign(globalThis, { inquello: { tasks: { progress, answer: vi.fn(), onProgressChanged: (listener: () => void) => { changed = listener; return () => {}; }, onSessionChanged: () => () => {} } } });
  const view = render(<TaskProgress taskId="task-1" workspaceId="workspace-1" />);
  return { ...view, progress, set: (value: ProgressSnapshot) => { next = value; }, notify: () => act(async () => { changed(); }) };
}
afterEach(() => { cleanup(); delete (globalThis as { inquello?: unknown }).inquello; });

const agent = (text: string, status: 'running' | 'completed' = 'running') => ({ id: 'answer', kind: 'message' as const, role: 'agent' as const, status, text });

describe('live message text for the open conversation', () => {
  it('refreshes a running open Task faster than the general invalidation cadence, through the same read', async () => {
    const x = setup({ ...base, items: [agent('First')] });
    await screen.findByText('First');
    await sleep(300);
    const before = x.progress.mock.calls.length;
    x.set({ ...base, items: [agent('First words of the **answer**')] });
    await x.notify();
    await sleep(LIVE_REFRESH_MS + 20);
    expect(x.progress.mock.calls.length).toBeGreaterThan(before);
    expect(screen.getByText('answer').tagName).toBe('STRONG');
    expect(x.progress.mock.calls.every(call => (call as unknown[]).length === 1)).toBe(true);
  });

  it('does not use the fast lane once the open Task has ended', async () => {
    const x = setup({ ...base, status: 'completed', items: [agent('Done', 'completed')] });
    await screen.findByText('Done');
    await sleep(300);
    const before = x.progress.mock.calls.length;
    await x.notify();
    await sleep(LIVE_REFRESH_MS + 20);
    expect(x.progress.mock.calls.length).toBe(before);
    await sleep(200);
    expect(x.progress.mock.calls.length).toBe(before + 1);
  });

  it('bounds reads during a long delta burst and never announces streamed text', async () => {
    const x = setup({ ...base, items: [agent('A')] });
    await screen.findByText('A');
    await sleep(300);
    const region = document.querySelector('.iq-task-progress [aria-live="polite"]')!;
    expect(document.querySelectorAll('.iq-task-progress [aria-live]')).toHaveLength(1);
    const announced = region.textContent;
    const before = x.progress.mock.calls.length;
    const started = Date.now();
    let text = 'A';
    while (Date.now() - started < 900) {
      text += ' word';
      x.set({ ...base, items: [agent(text)] });
      await x.notify();
      await sleep(15);
    }
    await sleep(LIVE_REFRESH_MS + 30);
    const reads = x.progress.mock.calls.length - before;
    const elapsed = Date.now() - started;
    expect(reads).toBeGreaterThanOrEqual(3);
    expect(reads).toBeLessThanOrEqual(Math.ceil(elapsed / LIVE_REFRESH_MS) + 2);
    await waitFor(() => expect(document.querySelector('[data-progress-item="answer"]')!.textContent).toBe(text));
    expect(region.textContent).toBe(announced);
  });
});

const finding = (id: string, extra: Partial<ProgressResult> = {}): ProgressResult => ({ id, kind: 'observation', text: `Finding ${id}`, checks: 'unchecked', checkScope: null, evidenceIds: ['c1'], basis: null, revision: 2, state: 'current', changeReason: 'Vendor added to key', ...extra });

describe('quiet results in the transcript', () => {
  it('keeps judgment and check inline and every other fact behind one disclosure per result', async () => {
    setup({ ...base, status: 'completed', results: [finding('r1'), finding('r2', { kind: 'gap', evidenceIds: [], revision: undefined, changeReason: null })], resultHistory: [finding('r1', { revision: 1, state: 'superseded', text: 'Old r1', changeReason: null, supersededReason: 'Vendor added to key' })] });
    await screen.findByText('Finding r1');
    const results = screen.getByRole('region', { name: 'Results' });
    const articles = [...results.querySelectorAll('article[data-result-id]')];
    expect(articles).toHaveLength(2);
    const first = articles[0]!;
    expect(first.querySelector('.iq-result-line .iq-judgment')).not.toBeNull();
    expect(first.querySelector('.iq-result-line [data-result-check]')!.textContent).toBe('Unchecked');
    expect(first.querySelectorAll('details')).toHaveLength(1);
    expect([...first.querySelectorAll('details p')].map(p => p.textContent)).toEqual(['Revision 2 · Current · Vendor added to key', 'Evidence: c1']);
    expect(articles[1]!.querySelector('details')).toBeNull();
    // A single page needs no paging controls.
    expect(screen.queryByRole('navigation', { name: 'current results pages' })).toBeNull();
    // Earlier versions sit behind one quiet disclosure with their count and reasons.
    const history = document.querySelector<HTMLDetailsElement>('details.iq-result-history')!;
    expect(history.open).toBe(false);
    expect(history.querySelector('summary')!.textContent).toBe('Previous result versions · 1');
    expect(history.textContent).toContain('These versions are not current findings.');
    expect(history.textContent).toContain('Superseded because: Vendor added to key');
    expect(document.body.textContent).not.toMatch(/accepted|approved/i);
  });

  it('keeps multi-page results reachable through quiet paging with full accessible names', async () => {
    setup({ ...base, status: 'completed', results: [finding('r1')], resultPage: { snapshotId: '11111111-1111-4111-8111-111111111111', currentOffset: 0, currentTotal: 70, currentNextOffset: 1, historyOffset: 0, historyTotal: 0, historyNextOffset: null } });
    await screen.findByText('Finding r1');
    const nav = screen.getByRole('navigation', { name: 'current results pages' });
    expect(nav.textContent).toContain('1–1 of 70');
    expect(screen.getByRole('button', { name: 'Next current results' }).textContent).toContain('Next');
    for (const button of nav.querySelectorAll('button')) expect(button.classList.contains('iq-button--sm')).toBe(true);
  });
});

it('does not resurrect an old completed read when a follow-up starts during that read',async()=>{
 let changed=()=>{},release!:(value:unknown)=>void,reads=0;
 let next:ProgressSnapshot={...base,status:'completed',items:[agent('Earlier answer','completed')]};
 const progress=vi.fn(async()=>{
  reads++;
  if(reads===2)return new Promise(resolve=>{release=resolve;});
  return {ok:true,value:next};
 });
 Object.assign(globalThis,{inquello:{tasks:{progress,answer:vi.fn(),onProgressChanged:(fn:()=>void)=>{changed=fn;return()=>{};},onSessionChanged:()=>()=>{}}}});
 render(<TaskProgress taskId="task-1" workspaceId="workspace-1"/>);
 await screen.findByText('Earlier answer');
 await act(async()=>{changed();});
 await waitFor(()=>expect(release).toBeTypeOf('function'));
 next={...base,runId:'run-2',turnId:'turn-2',items:[agent('Held follow-up text')]};
 const {refreshTaskObservation}=await import('../src/renderer/Shell/task-observation');
 await act(async()=>{refreshTaskObservation('task-1','workspace-1');changed();release({ok:true,value:{...base,status:'completed',items:[agent('Stale completed response','completed')]}});});
 await screen.findByText('Held follow-up text');
 expect(screen.queryByText('Stale completed response')).toBeNull();
 expect(screen.queryByText(/^Finished/)).toBeNull();
});
