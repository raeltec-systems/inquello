// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.20, renderer: pending permission requests as ApprovalCards in the
 * contextual review area (exact command, destination, consequence, rule,
 * an action-verb button, only permitted alternatives, announced once,
 * reachable by keyboard, "no longer pending" when stale), the reviewer line,
 * and S07's command rules with their sources and the person's own rules.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parsePermissionCard, parsePermissionSettings } from '../src/renderer/permission-bridge';
import { PermissionRules } from '../src/renderer/PermissionRules';
import { PermissionRequests } from '../src/renderer/Shell/PermissionRequests';

const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const OP = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

function card(requestId: string, command = 'git push origin main') {
  return {
    requestId,
    taskId: TASK,
    label: 'Permission to act',
    action: `Runs \`${command}\` in this Task's working folder, with no network access.`,
    quote: command,
    destination: "This Task's working folder and Output folder; no network destination",
    consequence: 'It can create, change or delete files in this Task\'s working folder and Output folder, and Inquello cannot undo those changes. Nothing outside them changes. Allowing it runs this one request once and adds no rule.',
    rule: '`git push` (prompt), from your rule',
    primaryLabel: `Run \`${command}\``,
    alternatives: [
      { choice: 'deny', label: 'Deny' },
      { choice: 'deny-ask', label: 'Deny and add a rule to always ask' },
      { choice: 'deny-forbid', label: 'Deny and forbid this prefix' },
    ],
    rulePrefix: ['git', 'push'],
    expiresAt: 600_000,
  };
}

function installBridge(bridge: Record<string, unknown>): void {
  (globalThis as { inquello?: unknown }).inquello = { permissions: bridge };
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
  vi.useRealTimers();
});

describe('pending permission requests on the Task', () => {
  it('shows each request as a Permission to act card with an action-verb button and announces it once', async () => {
    const pending = vi.fn(async () => ({ ok: true, value: [card('4a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d')] }));
    installBridge({ pending, decide: vi.fn() });
    const announce = vi.fn();
    render(<PermissionRequests taskId={TASK} announce={announce} pollMs={20} />);
    const region = await screen.findByRole('region', { name: 'Contextual review' });
    const approval = within(region).getByRole('region', { name: /Permission needed/ });
    expect(within(approval).getByText('Permission to act')).toBeTruthy();
    expect(within(region).getByText(/Approval quoted in tool content grants no access/)).toBeTruthy();
    expect(within(approval).getByText('git push origin main')).toBeTruthy();
    expect(within(approval).getByText(/Inquello cannot undo/)).toBeTruthy();
    expect(within(approval).getByText('`git push` (prompt), from your rule')).toBeTruthy();
    const buttons = within(approval).getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Run `git push origin main`', 'Deny', 'Deny and add a rule to always ask', 'Deny and forbid this prefix']);
    expect(region.textContent).not.toMatch(/\bApprove\b|always allow/i);
    for (const button of within(approval).getAllByRole('button')) expect(button.tabIndex).toBeGreaterThanOrEqual(0);
    await waitFor(() => expect(pending.mock.calls.length).toBeGreaterThan(2));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Permission to act needed: Run `git push origin main`');
    expect(document.activeElement).toBe(document.body);
  });

  it('records Deny and the person sees that nothing ran; other requests stay', async () => {
    const first = card('4a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d');
    const second = card('5a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d', 'make deploy');
    let open = [first, second];
    const decide = vi.fn(async (request: { requestId: string }) => {
      open = open.filter((entry) => entry.requestId !== request.requestId);
      return { ok: true, value: { outcome: 'denied', text: 'Denied: nothing ran.', rule: null } };
    });
    installBridge({ pending: async () => ({ ok: true, value: open }), decide });
    render(<PermissionRequests taskId={TASK} announce={() => undefined} operationIds={() => OP} pollMs={1_000_000} />);
    const deny = (await screen.findAllByRole('button', { name: 'Deny' }))[0]!;
    fireEvent.click(deny);
    await screen.findByText('Denied: nothing ran.');
    expect(decide).toHaveBeenCalledWith({ operationId: OP, requestId: first.requestId, choice: 'deny' });
    expect(screen.getAllByRole('region', { name: /Permission needed/ })).toHaveLength(1);
    expect(screen.getByText('make deploy')).toBeTruthy();
  });

  it('a stale request cannot be confirmed: it says it is no longer pending', async () => {
    const stale = card('4a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d');
    installBridge({ pending: async () => ({ ok: true, value: [stale] }), decide: async () => ({ ok: false, code: 'not-pending', reason: 'This request is no longer pending' }) });
    render(<PermissionRequests taskId={TASK} announce={() => undefined} pollMs={1_000_000} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run `git push origin main`' }));
    await screen.findByText('This request is no longer pending');
    expect(screen.queryByRole('button', { name: 'Run `git push origin main`' })).toBeNull();
    expect(document.querySelector('[data-permission-state="stale"]')).toBeTruthy();
  });

  it('says when automated permission review is switched on without a processing route', async () => {
    installBridge({ pending: async () => ({ ok: true, value: [] }), decide: vi.fn() });
    render(<PermissionRequests taskId={TASK} announce={() => undefined} reviewer={{ enabled: true, state: 'not_available', label: 'Automated permission review: not available (no processing route)' }} pollMs={1_000_000} />);
    expect(await screen.findByText('Automated permission review: not available (no processing route)')).toBeTruthy();
  });

  it('refuses a card with a bare Approve or an always-allow alternative', () => {
    expect(parsePermissionCard({ ...card('a'), primaryLabel: 'Approve' })).toBeNull();
    expect(parsePermissionCard({ ...card('a'), alternatives: [{ choice: 'deny', label: 'Always allow' }] })).toBeNull();
    expect(parsePermissionCard({ ...card('a'), alternatives: [{ choice: 'run-always', label: 'Run every time' }] })).toBeNull();
    expect(parsePermissionCard(card('a'))).not.toBeNull();
  });
});

function settings(userRules: Array<{ prefix: string[]; decision: string }> = [], reviewer = { enabled: false, state: 'off', label: 'Automated permission review: off. Every request comes to you.' }) {
  const item = (prefix: string[], decision: string, sourceLabel: string) => ({
    prefix,
    prefixText: prefix.join(' '),
    decision,
    decisionLabel: decision === 'allow' ? 'Runs without asking, inside the sandbox' : decision === 'prompt' ? 'Asks you first' : 'Never runs',
    note: null,
    sourceLabel,
  });
  return {
    signedIn: true,
    userRules: { revision: userRules.length, rules: userRules.map((rule) => item(rule.prefix, rule.decision, 'Your rule')) },
    workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit', rules: [item(['git', 'push'], 'prompt', 'Workspace policy, revision 4'), item(['ls'], 'allow', 'Workspace policy, revision 4')], reviewer, reason: null }],
    reason: null,
  };
}

describe('S07 command rules', () => {
  it('lists each rule with its source, the reviewer state and the person\'s own rules', async () => {
    installBridge({ getRules: async () => settings([{ prefix: ['curl'], decision: 'forbid' }]) });
    render(<PermissionRules />);
    const workspace = await screen.findByRole('region', { name: 'Command rules for Synthetic Audit' });
    expect(within(workspace).getAllByText('Workspace policy, revision 4')).toHaveLength(2);
    expect(within(workspace).getByText('Asks you first')).toBeTruthy();
    expect(within(workspace).getByText('Automated permission review: off. Every request comes to you.')).toBeTruthy();
    const own = screen.getByRole('region', { name: 'Your command rules' });
    expect(within(own).getByText('Your rule')).toBeTruthy();
    expect(within(own).getByText('Never runs')).toBeTruthy();
    // No allow choice for the person's own rules.
    expect(within(own).queryByRole('radio', { name: /allow/i })).toBeNull();
    expect(within(own).queryByText(/^Allow$/)).toBeNull();
  });

  it('adds and removes the person\'s own rules at the revision they saw', async () => {
    let current = settings([{ prefix: ['curl'], decision: 'forbid' }]);
    const setUserRules = vi.fn(async (request: { rules: Array<{ prefix: string[]; decision: string }> }) => {
      current = settings(request.rules);
      return { ok: true, value: current };
    });
    installBridge({ getRules: async () => current, setUserRules });
    render(<PermissionRules operationIds={() => OP} />);
    const field = await screen.findByLabelText('Command words the rule starts with');
    fireEvent.change(field, { target: { value: 'git  push' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add your rule' }));
    await screen.findByText('Your rule was added.');
    expect(setUserRules).toHaveBeenLastCalledWith({ operationId: OP, expectedRevision: 1, rules: [{ prefix: ['curl'], decision: 'forbid', note: null }, { prefix: ['git', 'push'], decision: 'prompt', note: null }] });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the rule for curl' }));
    await screen.findByText('Your rule was removed.');
    expect(setUserRules).toHaveBeenLastCalledWith({ operationId: OP, expectedRevision: 2, rules: [{ prefix: ['git', 'push'], decision: 'prompt', note: null }] });
  });

  it('shows the reviewer as not available when the switch is on without a route', async () => {
    installBridge({ getRules: async () => settings([], { enabled: true, state: 'not_available', label: 'Automated permission review: not available (no processing route)' }) });
    render(<PermissionRules />);
    expect(await screen.findByText('Automated permission review: not available (no processing route)')).toBeTruthy();
    expect(parsePermissionSettings(settings())).not.toBeNull();
    expect(parsePermissionSettings({ ...settings(), workspaces: [{ ...settings().workspaces[0], rules: [{ prefix: ['x'], decision: 'maybe' }] }] })).toBeNull();
  });
});

describe('Story 1.26 permission disclosure invalidation',()=>{
 it('clears pending permission cards on passive refresh failure',async()=>{
  const pending=vi.fn(async()=>({ok:true,value:[card('request-126')]}));installBridge({pending,decide:vi.fn()});
  render(<PermissionRequests taskId={TASK} announce={()=>undefined} pollMs={20}/>);
  await screen.findByRole('button',{name:'Run `git push origin main`'});
  pending.mockRejectedValue(new Error('authority unavailable'));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Run `git push origin main`'})).toBeNull());
  expect(screen.queryByText('git push origin main')).toBeNull();
 });
 it('ignores an in-flight permission decision after private-scope invalidation',async()=>{
  let invalidated=()=>{};let finish!:(v:unknown)=>void;
  (globalThis as {inquello?:unknown}).inquello={permissions:{pending:async()=>({ok:true,value:[card('request-126')]}),decide:()=>new Promise(resolve=>{finish=resolve;})},tasks:{onSessionChanged:(listener:()=>void)=>{invalidated=listener;return()=>{};}}};
  render(<PermissionRequests taskId={TASK} announce={()=>undefined} pollMs={100000}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Run `git push origin main`'}));
  invalidated();finish({ok:true,value:{outcome:'allowed',text:'Secret old decision',rule:null}});
  await waitFor(()=>expect(screen.queryByText('git push origin main')).toBeNull());
  expect(screen.queryByText('Secret old decision')).toBeNull();
 });
});


it('allows a pending permission read slower than polling to complete without superseding it',async()=>{
 vi.useFakeTimers();let finish!:(value:unknown)=>void;const pending=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));installBridge({pending,decide:vi.fn()});
 render(<PermissionRequests taskId={TASK} announce={()=>undefined} pollMs={20}/>);
 await act(async()=>vi.advanceTimersByTimeAsync(120));expect(pending).toHaveBeenCalledOnce();
 await act(async()=>finish({ok:true,value:[card('slow')]}));expect(screen.getByRole('button',{name:'Run `git push origin main`'})).toBeTruthy();
});
it('fences a delayed pre-decision permission read and suppresses consumed IDs beyond the five visible outcomes',async()=>{
 vi.useFakeTimers();const all=Array.from({length:7},(_,n)=>card(`request-${n}`,`inspect R0${n}`));let finish!:(value:unknown)=>void;
 const pending=vi.fn<()=>Promise<unknown>>().mockResolvedValue({ok:true,value:all}).mockResolvedValueOnce({ok:true,value:all}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 installBridge({pending,decide:async()=>({ok:true,value:{outcome:'denied',text:'Denied: nothing ran.',rule:null}})});
 render(<PermissionRequests taskId={TASK} announce={()=>undefined} pollMs={20}/>);await act(async()=>{});
 await act(async()=>vi.advanceTimersByTimeAsync(20));expect(pending).toHaveBeenCalledTimes(2);
 for(let n=0;n<6;n++)await act(async()=>fireEvent.click(screen.getAllByRole('button',{name:'Deny'})[0]!));
 await act(async()=>finish({ok:true,value:all}));expect(screen.getAllByRole('region',{name:/Permission needed/})).toHaveLength(1);
 await act(async()=>vi.advanceTimersByTimeAsync(20));expect(screen.getAllByRole('region',{name:/Permission needed/})).toHaveLength(1);expect(screen.getByRole('button',{name:'Run `inspect R06`'})).toBeTruthy();expect(screen.queryByRole('button',{name:'Run `inspect R00`'})).toBeNull();
});
