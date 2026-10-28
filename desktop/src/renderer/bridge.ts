/**
 * The renderer's typed view of `window.inquello`, the frozen bridge the
 * sandboxed preload exposes. Results come from main; they are parsed
 * defensively here so the UI shows only the published status fields.
 */

export type IdentityStateView =
  | { state: 'signed-out' }
  | { state: 'signing-in' }
  | { state: 'signed-in'; displayName: string; issuerLabel: string }
  | { state: 'blocked'; reason: string };

export interface IdentityStatusView {
  identity: IdentityStateView;
  sharedService: 'available' | 'unavailable' | 'not-configured';
  credentialStorage: 'os-backed' | 'memory-only';
  privateWork: 'local';
}

export interface IdentityActionView {
  ok: boolean;
  reason?: string;
  status: IdentityStatusView | null;
}

export interface IdentityBridge {
  getStatus(): Promise<unknown>;
  signIn(): Promise<unknown>;
  signOut(): Promise<unknown>;
}

/** The identity operations, or null outside the desktop (for example in tests). */
export function identityBridge(): IdentityBridge | null {
  const bridge = (globalThis as { inquello?: { identity?: IdentityBridge } }).inquello;
  return bridge?.identity ?? null;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

export function parseIdentityStatus(value: unknown): IdentityStatusView | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const identity = record.identity as Record<string, unknown> | null | undefined;
  if (typeof identity !== 'object' || identity === null) return null;
  let parsed: IdentityStateView | null = null;
  switch (identity.state) {
    case 'signed-out':
    case 'signing-in':
      parsed = { state: identity.state };
      break;
    case 'signed-in': {
      const displayName = text(identity.displayName);
      const issuerLabel = text(identity.issuerLabel);
      if (displayName && issuerLabel) parsed = { state: 'signed-in', displayName, issuerLabel };
      break;
    }
    case 'blocked': {
      const reason = text(identity.reason);
      if (reason) parsed = { state: 'blocked', reason };
      break;
    }
  }
  const shared = record.sharedService;
  const storage = record.credentialStorage;
  if (!parsed || (shared !== 'available' && shared !== 'unavailable' && shared !== 'not-configured')) return null;
  if ((storage !== 'os-backed' && storage !== 'memory-only') || record.privateWork !== 'local') return null;
  return { identity: parsed, sharedService: shared, credentialStorage: storage, privateWork: 'local' };
}

export function parseIdentityAction(value: unknown): IdentityActionView | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.ok !== 'boolean') return null;
  const reason = text(record.reason);
  return { ok: record.ok, ...(reason ? { reason } : {}), status: parseIdentityStatus(record.status) };
}
