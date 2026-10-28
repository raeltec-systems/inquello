/**
 * The Account block (Story 1.10b): the Inquello identity, the shared service's
 * availability and private local work, shown as three separate states, plus
 * sign-in and sign-out.
 *
 * Built from the Story 1.6–1.8 primitives. It talks to main only through the
 * named `inquello.identity` operations and never sees a credential: the status
 * holds a display name, an issuer label, availability and storage kind only.
 * Private work is always labelled local; a shared-service outage blocks shared
 * work only. Data attributes expose the rendered state to the smoke probe.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { identityBridge, parseIdentityAction, parseIdentityStatus, type IdentityStatusView } from './bridge';
import { Avatar, Button, StatusChip } from './primitives';

/** How often the block re-reads the status while it is shown. */
const STATUS_INTERVAL_MS = 30_000;

const IDENTITY_TEXT = {
  'signed-out': 'Signed out',
  'signing-in': 'Signing in',
  'signed-in': 'Signed in',
  blocked: 'Blocked',
} as const;

const SHARED_TEXT = {
  available: 'Shared service available',
  unavailable: 'Shared service unavailable',
  'not-configured': 'Shared service not configured',
} as const;

const STORAGE_TEXT = {
  'os-backed': "Sign-in is remembered in this computer's credential store.",
  'memory-only': 'Sign-in is not remembered: no OS credential store is available, so it lasts until Inquello quits.',
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

export function Account(): ReactElement {
  const bridge = identityBridge();
  const [status, setStatus] = useState<IdentityStatusView | null>(null);
  const [busy, setBusy] = useState<'sign-in' | 'sign-out' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parseIdentityStatus(await bridge.getStatus());
      if (next) setStatus(next);
    } catch {
      setNotice('The account status could not be read.');
    }
  }, [bridge]);

  useEffect(() => {
    if (!bridge) return;
    void load();
    const timer = setInterval(() => void load(), STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [bridge, load]);

  const act = async (action: 'sign-in' | 'sign-out') => {
    if (!bridge) return;
    setBusy(action);
    setNotice(null);
    if (action === 'sign-in') setStatus((current) => (current ? { ...current, identity: { state: 'signing-in' } } : current));
    try {
      const result = parseIdentityAction(await (action === 'sign-in' ? bridge.signIn() : bridge.signOut()));
      if (result?.status) setStatus(result.status);
      if (result && !result.ok) setNotice(result.reason ?? 'The request did not complete.');
    } catch {
      setNotice('The request did not complete.');
    } finally {
      setBusy(null);
    }
  };

  const identity = status?.identity ?? null;
  const shared = status?.sharedService ?? null;
  const loading = bridge ? 'The account status is loading.' : 'Account actions are available in the desktop app only.';
  const signInReason =
    !status || !identity
      ? loading
      : status.sharedService === 'not-configured'
        ? 'The shared service is not configured.'
        : identity.state === 'signed-in'
          ? 'Already signed in.'
          : identity.state === 'blocked'
            ? identity.reason
            : undefined;
  const signOutReason =
    !status || !identity
      ? loading
      : identity.state === 'signed-in' || (identity.state === 'blocked' && status.sharedService !== 'not-configured')
        ? undefined
        : 'Not signed in.';

  return (
    <div
      className="specimen-account"
      data-account=""
      data-identity-state={identity?.state ?? 'unknown'}
      data-shared-service={shared ?? 'unknown'}
      data-credential-storage={status?.credentialStorage ?? 'unknown'}
      data-private-work="local"
    >
      <dl className="specimen-account-states">
        <div className="specimen-account-state">
          <dt>Inquello identity</dt>
          <dd>
            <StatusChip status={`identity-${identity?.state ?? 'unknown'}`} label={identity ? IDENTITY_TEXT[identity.state] : 'Checking'} />
            {identity?.state === 'signed-in' ? (
              <span className="specimen-account-who">
                <Avatar name={identity.displayName} initials={initials(identity.displayName)} size={20} />
                <span>
                  {identity.displayName} <span className="specimen-account-issuer">via {identity.issuerLabel}</span>
                </span>
              </span>
            ) : null}
            {identity?.state === 'blocked' ? <span className="specimen-account-note">{identity.reason}</span> : null}
          </dd>
        </div>
        <div className="specimen-account-state">
          <dt>Shared service</dt>
          <dd>
            <StatusChip status={`shared-${shared ?? 'unknown'}`} label={shared ? SHARED_TEXT[shared] : 'Checking'} />
            {shared === 'unavailable' ? <span className="specimen-account-note">Shared work is blocked until the service is reachable.</span> : null}
          </dd>
        </div>
        <div className="specimen-account-state">
          <dt>Private work</dt>
          <dd>
            <StatusChip status="private-local" label="Private work stays local" />
          </dd>
        </div>
        <div className="specimen-account-state">
          <dt>Sign-in storage</dt>
          <dd className="specimen-account-note">{status ? STORAGE_TEXT[status.credentialStorage] : 'Checking'}</dd>
        </div>
      </dl>
      <div className="specimen-account-actions">
        <Button
          variant="primary"
          data-account-action="sign-in"
          pending={busy === 'sign-in'}
          pendingText="Waiting for the browser"
          disabledReason={busy === 'sign-in' ? undefined : signInReason}
          onPress={() => void act('sign-in')}
        >
          Sign in
        </Button>
        <Button
          variant="secondary"
          data-account-action="sign-out"
          pending={busy === 'sign-out'}
          disabledReason={busy === 'sign-out' ? undefined : signOutReason}
          onPress={() => void act('sign-out')}
        >
          Sign out
        </Button>
      </div>
      {notice ? (
        <p className="specimen-account-note" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
