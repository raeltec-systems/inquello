// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.19, renderer: the Task view and S07 explain what a Task's tools
 * can reach in plain words (read, write, contact; "No filesystem limits"
 * under Full access), show when the local sandbox is unavailable on this
 * device, and record the execution sandbox in the Capability Contract.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Capabilities } from '../src/renderer/Capabilities';
import { parseSettingsPolicy, parseTaskPolicy, type TaskPolicyItem } from '../src/renderer/policy-bridge';
import { TaskPolicy } from '../src/renderer/Shell/TaskPolicy';

const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const OQ13 = 'Local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)';

const capabilities = [
  { id: 'prompt_inspection', label: 'Prompt inspection', enabled: false, statusLabel: 'Not enabled — eligibility verification required' },
  { id: 'specialist_cyber_access', label: 'Specialist cyber access', enabled: false, statusLabel: 'Not enabled — eligibility verification required' },
  { id: 'execution_sandbox', label: 'Execution sandbox', enabled: true, statusLabel: OQ13 },
];

const boundedReach = (scope: 'task' | 'workspace', domains: string[] = []) => ({
  bounded: true,
  lines: [
    {
      name: 'read',
      label: 'Can read',
      value: `${scope === 'task' ? "This Task's working folder, Output folder" : "A Task's own working folder, its Output folder"} and the system files tools need in order to run (read only). Nothing else on this device.`,
    },
    { name: 'write', label: 'Can write to', value: `${scope === 'task' ? "This Task's working folder and Output folder" : "A Task's own working folder and its Output folder"} only.` },
    { name: 'contact', label: 'Can contact', value: domains.length > 0 ? `Only ${domains.join(', ')}. Any other destination is blocked.` : 'No network destinations. Every destination is blocked.' },
  ],
  domains,
  networkSourceLabel: domains.length > 0 ? 'Restricted by Workspace policy, revision 4' : 'Inquello default',
});

const unboundedReach = {
  bounded: false,
  lines: [
    { name: 'filesystem', label: 'Files', value: 'No filesystem limits: tools can read and change anything this account can on this device' },
    { name: 'network', label: 'Network', value: 'No network limits: tools can contact any destination' },
  ],
  domains: [],
  networkSourceLabel: 'Set by Workspace policy, revision 4',
};

function policy(reach: unknown = boundedReach('workspace')) {
  return {
    environment: 'local_device',
    environmentLabel: 'Local device',
    workspaceId: WORKSPACE,
    policyRevision: 4,
    authorizationEpoch: 9,
    settings: [{ name: 'sandbox', label: 'Sandbox ceiling', value: 'workspace_write', valueLabel: 'Workspace write', source: { kind: 'inquello_default', revision: null }, sourceLabel: 'Inquello default', restricted: true }],
    device: { configured: false, label: 'None configured on this device' },
    capabilities,
    reach,
  };
}

function taskPolicy(reach: unknown, sandbox: { status: string; label: string }): TaskPolicyItem {
  const parsed = parseTaskPolicy({
    ...policy(reach),
    taskId: TASK,
    broadMode: { label: 'Broader execution mode', revision: 0, recorded: 'standard', status: 'standard', effectiveMode: 'standard', reach: 'Standard reach', statusLabel: 'Standard', suspendedReason: null },
    options: [],
    threadSettings: { sandbox: 'workspace-write', approvalPolicy: 'on-request', networkAccess: false, mode: 'standard' },
    sandbox,
  });
  if (!parsed) throw new Error('the Task policy did not parse');
  return parsed;
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

describe('the Task view explains what its tools can reach', () => {
  it('lists what tools can read, write and contact, with no path and no sandbox syntax', () => {
    render(<TaskPolicy policy={taskPolicy(boundedReach('task', ['example.org']), { status: 'available', label: 'Local OS sandbox on this device.' })} onSetMode={vi.fn()} />);
    const section = screen.getByRole('region', { name: "What this Task's tools can reach" });
    const line = (name: string) => section.querySelector(`[data-reach-line="${name}"]`)!.textContent;
    expect(line('read')).toContain("This Task's working folder, Output folder and the system files tools need in order to run (read only)");
    expect(line('write')).toBe("Can write toThis Task's working folder and Output folder only.");
    expect(line('contact')).toBe('Can contactOnly example.org. Any other destination is blocked.');
    expect(line('network-rule')).toContain('Restricted by Workspace policy, revision 4');
    expect(section.querySelector('[data-task-sandbox]')!.textContent).toBe('Local OS sandbox on this device.');
    expect(section.textContent).not.toMatch(/\/|:minimal|permission|bwrap|approv|review|accept/i);
  });

  it('says when the local sandbox is unavailable on this device', () => {
    render(<TaskPolicy policy={taskPolicy(boundedReach('task'), { status: 'unavailable', label: 'Local sandbox unavailable on this device' })} onSetMode={vi.fn()} />);
    const notice = document.querySelector<HTMLElement>('[data-task-sandbox="unavailable"]')!;
    expect(notice.textContent).toBe('Local sandbox unavailable on this device');
    expect(notice.getAttribute('role')).toBe('status');
  });

  it('states the true reach of Full access and never shows it as bounded', () => {
    render(<TaskPolicy policy={taskPolicy(unboundedReach, { status: 'not-applicable', label: 'Full access runs without the local sandbox on this device.' })} onSetMode={vi.fn()} />);
    const reach = document.querySelector<HTMLElement>('[data-reach="task"]')!;
    expect(reach.dataset.reachBounded).toBe('false');
    expect(reach.textContent).toContain('No filesystem limits');
    expect(reach.textContent).not.toContain('Can write to');
  });

  it('refuses a reach it cannot read rather than showing part of it', () => {
    expect(parseTaskPolicy({ ...taskPolicy(boundedReach('task'), { status: 'available', label: 'x' }), reach: { bounded: true, lines: [] } })).toBeNull();
    const base = { ...policy(), taskId: TASK, broadMode: { label: 'x', revision: 0, recorded: 'standard', status: 'standard', effectiveMode: 'standard', reach: 'x', statusLabel: 'x', suspendedReason: null }, options: [] };
    expect(parseTaskPolicy({ ...base, sandbox: { status: 'maybe', label: 'x' } })).toBeNull();
  });
});

describe('S07 records the execution sandbox and each Workspace reach', () => {
  it('shows the local OS sandbox entry and the Workspace reach', async () => {
    (globalThis as { inquello?: unknown }).inquello = {
      policy: {
        getSettings: vi.fn(async () => ({
          signedIn: true,
          environmentLabel: 'Local device',
          workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit', policy: policy(), reason: null }],
          capabilities,
          reason: null,
        })),
        forTask: vi.fn(),
        setBroadMode: vi.fn(),
      },
    };
    render(<Capabilities />);
    await waitFor(() => expect(document.querySelector('[data-policy-loaded="true"]')).not.toBeNull());
    const contract = document.querySelector<HTMLElement>('[data-capability-contract]')!;
    const sandbox = contract.querySelector<HTMLElement>('[data-capability="execution_sandbox"]')!;
    expect(sandbox.dataset.enabled).toBe('true');
    expect(within(sandbox).getByText('Execution sandbox')).toBeTruthy();
    expect(within(sandbox).getByText(OQ13)).toBeTruthy();
    const workspace = screen.getByRole('region', { name: 'Policy for Synthetic Audit' });
    expect(workspace.querySelector('[data-reach="workspace"] [data-reach-line="contact"]')!.textContent).toContain('No network destinations');
    expect(workspace.textContent).not.toMatch(/approv|review|accept/i);
  });

  it('refuses any other enabled contract entry', () => {
    expect(parseSettingsPolicy({ signedIn: false, environmentLabel: 'x', workspaces: [], capabilities: [{ ...capabilities[0], enabled: true }], reason: null })).toBeNull();
    expect(parseSettingsPolicy({ signedIn: false, environmentLabel: 'x', workspaces: [], capabilities, reason: null })?.capabilities.map((entry) => entry.enabled)).toEqual([false, false, true]);
  });
});
