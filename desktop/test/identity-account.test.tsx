// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.10b: the Account block. Identity, shared-service availability and
 * private local work render as separate states; sign-in and sign-out go
 * through the named `inquello.identity` operations only; unavailable actions
 * say why.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Account } from '../src/renderer/Account';
import type { IdentityStatusView } from '../src/renderer/bridge';

const signedOut: IdentityStatusView = { identity: { state: 'signed-out' }, sharedService: 'available', credentialStorage: 'os-backed', privateWork: 'local' };
const signedIn: IdentityStatusView = {
  identity: { state: 'signed-in', displayName: 'Synthetic Developer', issuerLabel: 'Synthetic test issuer' },
  sharedService: 'available',
  credentialStorage: 'os-backed',
  privateWork: 'local',
};

function installBridge(status: IdentityStatusView, overrides: Partial<Record<'getStatus' | 'signIn' | 'signOut', () => Promise<unknown>>> = {}) {
  const bridge = {
    getStatus: vi.fn(async () => status),
    signIn: vi.fn(async () => ({ ok: true, status: signedIn })),
    signOut: vi.fn(async () => ({ ok: true, status: signedOut })),
    ...overrides,
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ identity: Object.freeze(bridge) });
  return bridge;
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

const block = () => document.querySelector<HTMLElement>('[data-account]')!;
const button = (name: string) => screen.getByRole('button', { name });

describe('Account block', () => {
  it('shows identity, shared service and private work as separate states', async () => {
    installBridge(signedIn);
    render(<Account />);
    await screen.findByText('Synthetic Developer');
    expect(block().dataset).toMatchObject({ identityState: 'signed-in', sharedService: 'available', credentialStorage: 'os-backed', privateWork: 'local' });
    const rows = within(block()).getAllByRole('term').map((term) => term.textContent);
    expect(rows).toEqual(['Inquello identity', 'Shared service', 'Private work', 'Sign-in storage']);
    expect(screen.getByText('Signed in')).toBeTruthy();
    expect(screen.getByText('via Synthetic test issuer')).toBeTruthy();
    expect(screen.getByText('Shared service available')).toBeTruthy();
    expect(screen.getByText('Private work stays local')).toBeTruthy();
    expect(screen.getByText(/remembered in this computer's credential store/)).toBeTruthy();
    expect(button('Sign in').getAttribute('aria-disabled')).toBe('true');
    expect(button('Sign out').getAttribute('aria-disabled')).toBeNull();
  });

  it('signs in through the bridge and shows the result', async () => {
    const bridge = installBridge(signedOut);
    render(<Account />);
    await screen.findByText('Signed out');
    await userEvent.click(button('Sign in'));
    await screen.findByText('Synthetic Developer');
    expect(bridge.signIn).toHaveBeenCalledTimes(1);
    expect(bridge.signIn).toHaveBeenCalledWith();
  });

  it('shows the reason when sign-in does not complete', async () => {
    installBridge(signedOut, {
      signIn: async () => ({ ok: false, reason: 'Sign-in was not completed in time.', status: signedOut }),
    });
    render(<Account />);
    await screen.findByText('Signed out');
    await userEvent.click(button('Sign in'));
    expect((await screen.findByRole('status')).textContent).toBe('Sign-in was not completed in time.');
    expect(block().dataset.identityState).toBe('signed-out');
  });

  it('a shared-service outage blocks shared work only; private work stays local', async () => {
    installBridge({ ...signedIn, sharedService: 'unavailable' });
    render(<Account />);
    await screen.findByText('Shared service unavailable');
    expect(screen.getByText('Shared work is blocked until the service is reachable.')).toBeTruthy();
    expect(screen.getByText('Private work stays local')).toBeTruthy();
    expect(block().dataset.identityState).toBe('signed-in');
  });

  it('not configured: sign-in is unavailable with a reason, and memory-only says it is not remembered', async () => {
    installBridge({ identity: { state: 'signed-out' }, sharedService: 'not-configured', credentialStorage: 'memory-only', privateWork: 'local' });
    render(<Account />);
    await screen.findByText('Shared service not configured');
    expect(button('Sign in').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('The shared service is not configured.')).toBeTruthy();
    expect(screen.getByText(/not remembered/)).toBeTruthy();
  });

  it('a pending sign-out shows the block reason and lets sign-out be retried', async () => {
    const bridge = installBridge({ ...signedIn, identity: { state: 'blocked', reason: 'Sign-out is waiting for the shared service. Sign out again to retry.' } });
    render(<Account />);
    await screen.findByText('Blocked');
    await userEvent.click(button('Sign out'));
    await screen.findByText('Signed out');
    expect(bridge.signOut).toHaveBeenCalledTimes(1);
  });

  it('ignores fields outside the published status and renders without the bridge', async () => {
    installBridge({ ...signedIn, accessCredential: 'iqa_LEAK' } as unknown as IdentityStatusView);
    render(<Account />);
    await screen.findByText('Synthetic Developer');
    expect(block().outerHTML).not.toContain('LEAK');
    cleanup();
    delete (globalThis as { inquello?: unknown }).inquello;
    await act(async () => {
      render(<Account />);
    });
    expect(block().dataset.identityState).toBe('unknown');
    expect(button('Sign in').getAttribute('aria-disabled')).toBe('true');
  });
});
