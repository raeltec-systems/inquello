// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.18, renderer: S07 ("Capabilities and processing") and the open
 * Task's policy summary and broader execution mode. Every setting names its
 * governing rule, prompt inspection and cyber access are not enabled, and a
 * broader mode needs an explicit confirmation that states its reach. Nothing
 * reads as review or approval, and nothing is green.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Capabilities } from '../src/renderer/Capabilities';
import { parseSettingsPolicy, parseTaskPolicy, type TaskPolicyItem } from '../src/renderer/policy-bridge';
import { TaskPolicy } from '../src/renderer/Shell/TaskPolicy';

const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const FULL_REACH = 'Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions.';
const NO_PROMPT_REACH = 'No prompt: commands on this Task run inside the sandbox on this device, and you will not be asked before actions.';

const setting = (name: string, label: string, valueLabel: string, sourceLabel: string, restricted = true) => ({
  name,
  label,
  value: name,
  valueLabel,
  source: { kind: 'inquello_default', revision: null },
  sourceLabel,
  restricted,
});

const capabilities = [
  { id: 'prompt_inspection', label: 'Prompt inspection', enabled: false, statusLabel: 'Not enabled — eligibility verification required' },
  { id: 'specialist_cyber_access', label: 'Specialist cyber access', enabled: false, statusLabel: 'Not enabled — eligibility verification required' },
];

function policy(sandboxSource = 'Inquello default') {
  return {
    environment: 'local_device',
    environmentLabel: 'Local device',
    workspaceId: WORKSPACE,
    policyRevision: 4,
    authorizationEpoch: 9,
    settings: [
      setting('sandbox', 'Sandbox ceiling', 'Workspace write', sandboxSource),
      setting('approval', 'Asking before actions', 'Asks when the agent requests it', 'Inquello default', false),
      setting('network', 'Network access in the sandbox', 'Denied', 'Inquello default'),
      setting('mcp_tools', 'MCP and connector tools', 'Denied', 'Inquello default'),
      setting('extensions', 'Plugins and extensions', 'Denied', 'Inquello default'),
      setting('full_access', 'Full access mode', 'Not available', 'Inquello default'),
      setting('no_prompt', 'No-prompt mode', 'Not available', 'Inquello default'),
    ],
    device: { configured: false, label: 'None configured on this device' },
    capabilities,
  };
}

function taskPolicy(overrides: { status?: 'standard' | 'active' | 'suspended'; recorded?: 'standard' | 'no_prompt' | 'full_access'; fullAvailable?: boolean } = {}): TaskPolicyItem {
  const status = overrides.status ?? 'standard';
  const recorded = overrides.recorded ?? 'standard';
  const fullAvailable = overrides.fullAvailable ?? false;
  const parsed = parseTaskPolicy({
    ...policy(),
    taskId: TASK,
    broadMode: {
      label: 'Broader execution mode',
      revision: recorded === 'standard' ? 0 : 1,
      recorded,
      status,
      effectiveMode: status === 'active' ? recorded : 'standard',
      reach: recorded === 'full_access' ? FULL_REACH : 'Standard reach',
      statusLabel: status === 'suspended' ? 'Suspended by policy' : status === 'active' ? 'Full access' : 'Standard',
      suspendedReason: status === 'suspended' ? 'Suspended by policy: Workspace policy, revision 5 no longer permits Full access. This Task runs in Standard mode.' : null,
    },
    options: [
      { mode: 'no_prompt', title: 'No prompt', reach: NO_PROMPT_REACH, available: false, unavailableReason: 'No prompt is not available: not permitted by the Inquello default.' },
      {
        mode: 'full_access',
        title: 'Full access',
        reach: FULL_REACH,
        available: fullAvailable,
        unavailableReason: fullAvailable ? null : 'Full access is not available: not permitted by Workspace policy, revision 4.',
      },
    ],
    threadSettings: { sandbox: 'workspace-write', approvalPolicy: 'on-request', networkAccess: false, mode: 'standard' },
  });
  if (!parsed) throw new Error('the Task policy did not parse');
  return parsed;
}

const GREEN = /green|accepted|approved/i;

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

describe('S07 Capabilities and processing', () => {
  it('shows each setting with its governing rule, the device layer and the not-enabled contract entries', async () => {
    const getSettings = vi.fn(async () => ({
      signedIn: true,
      environmentLabel: 'Local device',
      workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit', policy: policy('Restricted by Workspace policy, revision 4'), reason: null }],
      capabilities,
      reason: null,
    }));
    (globalThis as { inquello?: unknown }).inquello = { policy: { getSettings, forTask: vi.fn(), setBroadMode: vi.fn() } };
    render(<Capabilities />);
    await waitFor(() => expect(document.querySelector('[data-policy-loaded="true"]')).not.toBeNull());
    const workspace = screen.getByRole('region', { name: 'Policy for Synthetic Audit' });
    const sandbox = workspace.querySelector<HTMLElement>('[data-policy-setting="sandbox"]')!;
    expect(sandbox.textContent).toContain('Workspace write');
    expect(sandbox.querySelector('[data-policy-source]')!.textContent).toBe('Restricted by Workspace policy, revision 4');
    expect(workspace.querySelector('[data-policy-setting="network"] [data-policy-source]')!.textContent).toBe('Inquello default');
    expect(workspace.querySelector('[data-policy-device]')!.textContent).toBe('Device-managed requirements: None configured on this device');
    expect(screen.getByText('Environment: Local device. Tasks run on this device only.')).toBeTruthy();
    const contract = document.querySelector<HTMLElement>('[data-capability-contract]')!;
    expect(within(contract).getByText('Prompt inspection')).toBeTruthy();
    expect(within(contract).getByText('Specialist cyber access')).toBeTruthy();
    expect(within(contract).getAllByText('Not enabled — eligibility verification required')).toHaveLength(2);
    const section = document.querySelector<HTMLElement>('[data-policy-section]')!;
    expect(section.textContent).not.toMatch(/approv|review|accept/i);
    for (const chip of section.querySelectorAll('.iq-status-chip')) expect(chip.className).not.toMatch(GREEN);
  });

  it('lists the contract entries while signed out and says why there is no policy', async () => {
    (globalThis as { inquello?: unknown }).inquello = {
      policy: {
        getSettings: async () => ({ signedIn: false, environmentLabel: 'Local device', workspaces: [], capabilities: [], reason: 'Sign in to see the policy that governs your Tasks.' }),
        forTask: vi.fn(),
        setBroadMode: vi.fn(),
      },
    };
    render(<Capabilities />);
    await screen.findByText('Sign in to see the policy that governs your Tasks.');
    expect(parseSettingsPolicy({ signedIn: false, environmentLabel: 'x', workspaces: [], capabilities: [{ ...capabilities[0], enabled: true }], reason: null })).toBeNull();
  });
});

describe('the Task policy and execution mode', () => {
  it('summarises the policy and shows Standard, with each unavailable mode naming its rule', () => {
    render(<TaskPolicy policy={taskPolicy()} onSetMode={vi.fn()} />);
    const summary = document.querySelector<HTMLElement>('[data-task-policy-summary]')!;
    expect(summary.textContent).toContain('Sandbox ceiling');
    expect(summary.textContent).toContain('(Inquello default)');
    const mode = document.querySelector<HTMLElement>('[data-broad-mode]')!;
    expect(mode.dataset.broadModeStatus).toBe('standard');
    expect(mode.textContent).toContain('Broader execution mode');
    const full = document.querySelector<HTMLElement>('[data-broad-mode-option="full_access"]')!;
    expect(full.getAttribute('aria-disabled')).toBe('true');
    expect(document.body.textContent).toContain('Full access is not available: not permitted by Workspace policy, revision 4.');
    expect(document.querySelector('[data-broad-mode-confirm]')).toBeNull();
  });

  it('turns a broader mode on only through the confirmation that states its reach', async () => {
    const user = userEvent.setup();
    const onSetMode = vi.fn(async () => null);
    render(<TaskPolicy policy={taskPolicy({ fullAvailable: true })} onSetMode={onSetMode} />);
    await user.click(document.querySelector<HTMLElement>('[data-broad-mode-option="full_access"]')!);
    expect(onSetMode).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: 'Turn on Full access for this Task?' });
    expect(within(dialog).getByText(FULL_REACH)).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/approv|review|accept/i);
    // Escape cancels and sets nothing.
    expect(document.activeElement?.getAttribute('data-broad-mode-action')).toBe('cancel');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onSetMode).not.toHaveBeenCalled();
    await user.click(document.querySelector<HTMLElement>('[data-broad-mode-option="full_access"]')!);
    await user.click(screen.getByRole('button', { name: 'Turn on Full access' }));
    expect(onSetMode).toHaveBeenCalledWith('full_access', FULL_REACH);
  });

  it('shows an active mode with its reach and a refusal with its reason', async () => {
    const user = userEvent.setup();
    const onSetMode = vi.fn(async () => 'Full access is not available: not permitted by Workspace policy, revision 5.');
    render(<TaskPolicy policy={taskPolicy({ status: 'active', recorded: 'full_access', fullAvailable: true })} onSetMode={onSetMode} />);
    expect(document.querySelector('[data-broad-mode-reach]')!.textContent).toBe(FULL_REACH);
    for (const chip of document.querySelectorAll('.iq-status-chip')) expect(chip.className).not.toMatch(GREEN);
    await user.click(screen.getByRole('button', { name: 'Return to Standard' }));
    expect(onSetMode).toHaveBeenCalledWith('standard', null);
    expect((await screen.findByText('Full access is not available: not permitted by Workspace policy, revision 5.')).hasAttribute('data-broad-mode-notice')).toBe(true);
  });

  it('shows a mode the policy no longer permits as suspended by policy', () => {
    render(<TaskPolicy policy={taskPolicy({ status: 'suspended', recorded: 'full_access' })} onSetMode={vi.fn()} />);
    const mode = document.querySelector<HTMLElement>('[data-broad-mode]')!;
    expect(mode.dataset.broadModeStatus).toBe('suspended');
    expect(mode.dataset.broadModeEffective).toBe('standard');
    expect(mode.textContent).toContain('Suspended by policy');
    expect(document.querySelector('[data-broad-mode-suspended]')!.textContent).toContain('This Task runs in Standard mode.');
    expect(document.querySelector('[data-broad-mode-reach]')).toBeNull();
  });
});
