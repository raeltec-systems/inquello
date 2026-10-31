// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.12: the Local data block on the specimen page. It lists every
 * category with its rule and owner, shows the blockers, and runs export,
 * import and delete through the named `inquello.data` operations only, never
 * passing a path. Also covers the smoke's pure `evaluateData`.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LocalData } from '../src/renderer/LocalData';
import { parseDataAction, parseDataPolicy, type DataPolicyView } from '../src/renderer/bridge';
import { evaluateData, type DataProbeRead } from '../src/main/smoke-probe';

const POLICY: DataPolicyView = {
  loaded: true,
  policyOwner: 'Organisation data-policy owner (OQ-2)',
  notice: 'Notice.',
  categories: [
    {
      id: 'task-history',
      label: 'Task history',
      enabled: true,
      location: 'files',
      owner: 'The signed-in creator, on this device',
      ruleOwner: 'Organisation data-policy owner (OQ-2)',
      retention: 'until-owner-deletes',
      access: 'runtime',
      export: { mode: 'included' },
      deletion: 'Delete Task history in Local data',
      recovery: 'Reimport',
      held: { files: 2, bytes: 10 },
    },
    {
      id: 'identity-session',
      label: 'Identity session',
      enabled: true,
      location: 'files',
      owner: 'The signed-in creator, on this device',
      ruleOwner: 'Organisation data-policy owner (OQ-2)',
      retention: 'until-owner-deletes',
      access: 'main-process-only',
      export: { mode: 'excluded', reason: 'Holds Inquello session credentials, which are never exported' },
      deletion: 'Signs out first',
      recovery: 'Sign in again',
      held: { files: 1, bytes: 100 },
    },
    {
      id: 'artifacts',
      label: 'Artifacts',
      enabled: false,
      location: 'files',
      owner: 'Not held',
      ruleOwner: 'Organisation data-policy owner (OQ-2)',
      retention: 'unknown',
      access: 'main-process-only',
      export: { mode: 'excluded', reason: 'Not held' },
      deletion: 'Not held',
      recovery: 'Not applicable',
      held: { files: 0, bytes: 0 },
    },
  ],
  blockers: [],
};

function installBridge(overrides: Partial<Record<'getPolicy' | 'export' | 'import' | 'delete', (...args: unknown[]) => Promise<unknown>>> = {}) {
  const bridge = {
    getPolicy: vi.fn(async () => POLICY),
    export: vi.fn(async () => ({
      ok: true,
      export: {
        path: '/home/alice/inquello-export',
        included: [{ category: 'task-history', label: 'Task history', files: 2 }],
        omissions: [{ category: 'identity-session', label: 'Identity session', reason: 'Holds Inquello session credentials, which are never exported', files: 1 }],
        notice: 'This export transfers no permissions and is not an accepted audit record.',
      },
    })),
    import: vi.fn(async () => ({ ok: false, reason: 'The runtime home already holds data; import restores only into an empty runtime home.' })),
    delete: vi.fn(async () => ({
      ok: true,
      delete: {
        removed: [{ category: 'task-history', label: 'Task history', filesRemoved: 2, filesRemaining: 0 }],
        retained: [{ category: 'identity-session', label: 'Identity session', files: 1 }],
        survivingExports: [{ path: '/home/alice/inquello-export', exportedAt: '2026-10-28T12:00:00.000Z', categories: ['task-history'], outsideInquelloControl: true }],
      },
    })),
    ...overrides,
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ data: Object.freeze(bridge) });
  return bridge;
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

const button = (name: string) => screen.getByRole('button', { name });

describe('Local data block', () => {
  it('lists every category with its owner, rule, retention and export rule', async () => {
    installBridge();
    render(<LocalData />);
    const rows = await screen.findAllByRole('listitem');
    const categories = document.querySelectorAll('[data-local-data-category]');
    expect([...categories].map((row) => row.getAttribute('data-local-data-category'))).toEqual(['task-history', 'identity-session', 'artifacts']);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const history = document.querySelector<HTMLElement>('[data-local-data-category="task-history"]')!;
    expect(within(history).getByText('Kept until you delete it; no automatic expiry')).toBeTruthy();
    expect(within(history).getByText('Included only with trusted native ownership and current access')).toBeTruthy();
    expect(within(history).getByText('2 files held')).toBeTruthy();
    expect(within(history).getAllByText('Organisation data-policy owner (OQ-2)')).toHaveLength(1);
    const identity = document.querySelector<HTMLElement>('[data-local-data-category="identity-session"]')!;
    expect(within(identity).getByText(/Not exported: Holds Inquello session credentials/)).toBeTruthy();
    const artifacts = document.querySelector<HTMLElement>('[data-local-data-category="artifacts"]')!;
    expect(within(artifacts).getByText('Disabled; never written')).toBeTruthy();
    expect(within(artifacts).queryByRole('checkbox')).toBeNull();
    expect(screen.getByText('No local policy blockers — route evidence and approval are checked separately')).toBeTruthy();
  });

  it('shows real-data blockers', async () => {
    installBridge({
      getPolicy: async () => ({ ...POLICY, blockers: [{ kind: 'unclassified', path: 'runtime-home:notes.txt', detail: 'runtime-home:notes.txt matches no category in the local data policy' }] }),
    });
    render(<LocalData />);
    expect(await screen.findByText('Real data blocked (1)')).toBeTruthy();
    expect(screen.getByText('runtime-home:notes.txt matches no category in the local data policy')).toBeTruthy();
  });

  it('exports and imports without passing any argument, and reports the outcome', async () => {
    const bridge = installBridge();
    render(<LocalData />);
    await screen.findByText('Task history');
    await userEvent.click(button('Export'));
    expect(bridge.export).toHaveBeenCalledWith();
    expect(await screen.findByText('Exported to /home/alice/inquello-export.')).toBeTruthy();
    expect(screen.getByText(/Omitted: Identity session/)).toBeTruthy();
    expect(screen.getByText(/transfers no permissions/)).toBeTruthy();
    await userEvent.click(button('Import'));
    expect(bridge.import).toHaveBeenCalledWith();
    expect(await screen.findByText(/only into an empty runtime home/)).toBeTruthy();
  });

  it('deletes only the chosen category ids after confirmation and lists surviving exports', async () => {
    const bridge = installBridge();
    render(<LocalData />);
    await screen.findByText('Task history');
    expect(button('Delete selected').getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Task history' }));
    await userEvent.click(button('Delete selected'));
    expect(bridge.delete).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete Task history\? The runtime stops and restarts/)).toBeTruthy();
    await userEvent.click(button('Confirm deletion'));
    expect(bridge.delete).toHaveBeenCalledWith(['task-history']);
    expect(await screen.findByText('Removed: Task history (2 files).')).toBeTruthy();
    expect(screen.getByText('Retained: Identity session (1 file).')).toBeTruthy();
    expect(screen.getByText(/Exported copy outside Inquello's control, not deleted: \/home\/alice\/inquello-export/)).toBeTruthy();
  });

  it('says why actions are unavailable outside the desktop', () => {
    render(<LocalData />);
    expect(button('Export').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getAllByText('Local data actions are available in the desktop app only.').length).toBeGreaterThan(0);
  });
});

describe('bridge parsing', () => {
  it('rejects a malformed policy and keeps only published fields', () => {
    expect(parseDataPolicy(null)).toBeNull();
    expect(parseDataPolicy({ ...POLICY, categories: [{ id: 'x' }] })).toBeNull();
    const parsed = parseDataPolicy({ ...POLICY, extra: 'LEAK', categories: [{ ...POLICY.categories[0], secret: 'LEAK' }] });
    expect(JSON.stringify(parsed)).not.toContain('LEAK');
  });

  it('turns a failure into its reason', () => {
    expect(parseDataAction({ ok: false, reason: 'No folder was chosen.' }, 'export')).toEqual({ ok: false, reason: 'No folder was chosen.', lines: [] });
    expect(parseDataAction({ ok: true }, 'export')).toBeNull();
  });
});

describe('smoke data evaluation', () => {
  const good: DataProbeRead = {
    policyLoaded: true,
    ruleBlockers: 0,
    categories: 13,
    runtimeHome: { underUserData: true, matchesHandshake: true },
    unclassified: [],
    disabledHeld: [],
    renderer: { policyLoaded: true, categories: 13, blockShown: true, pathRejected: true },
    export: { ok: true, included: { 'task-history': 1, 'desktop-stderr-log': 1 }, omissions: ['identity-session', 'chromium-profile', 'runtime-state'] },
    import: { ok: true, restored: 2, notRestored: 0, byteIdentical: true, syntheticRestored: true },
  };

  it('passes a clean run', () => {
    expect(evaluateData(good)).toMatchObject({ ok: true, failures: [] });
  });

  it.each<[string, (read: DataProbeRead) => void, RegExp]>([
    ['an unclassified file', (r) => (r.unclassified = ['runtime-home:x']), /unclassified files: runtime-home:x/],
    ['a runtime home outside userData', (r) => (r.runtimeHome.underUserData = false), /not under userData/],
    ['a different CODEX_HOME', (r) => (r.runtimeHome.matchesHandshake = false), /CODEX_HOME/],
    ['an accepted renderer path', (r) => (r.renderer.pathRejected = false), /renderer-supplied path/],
    ['a missing omission', (r) => (r.export.omissions = ['runtime-state']), /identity-session as omitted/],
    ['a partial reimport', (r) => (r.import.restored = 1), /restored 1 of 2/],
    ['a changed file', (r) => (r.import.byteIdentical = false), /differ/],
  ])('fails on %s', (_label, change, message) => {
    const read = structuredClone(good);
    change(read);
    const report = evaluateData(read);
    expect(report.ok).toBe(false);
    expect(report.failures.join('\n')).toMatch(message);
  });
});
