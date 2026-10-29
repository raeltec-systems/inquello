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

// ---- local data (Story 1.12) ---------------------------------------------------

export interface DataCategoryView {
  id: string;
  label: string;
  enabled: boolean;
  location: 'files' | 'os-credential-store';
  owner: string;
  ruleOwner: string;
  retention: 'until-owner-deletes' | 'unknown';
  access: 'main-process-only' | 'runtime';
  export: { mode: 'included' | 'excluded' | 'unknown'; reason?: string };
  deletion: string;
  recovery: string;
  held: { files: number; bytes: number };
}

export interface DataBlockerView {
  kind: string;
  category?: string;
  path?: string;
  detail: string;
}

export interface DataPolicyView {
  loaded: boolean;
  policyOwner: string | null;
  notice: string | null;
  categories: DataCategoryView[];
  blockers: DataBlockerView[];
}

export interface DataBridge {
  getPolicy(): Promise<unknown>;
  export(): Promise<unknown>;
  import(): Promise<unknown>;
  delete(categories: string[]): Promise<unknown>;
}

/** The local data operations, or null outside the desktop. */
export function dataBridge(): DataBridge | null {
  const bridge = (globalThis as { inquello?: { data?: DataBridge } }).inquello;
  return bridge?.data ?? null;
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0);
const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function parseCategory(value: unknown): DataCategoryView | null {
  const r = record(value);
  if (!r) return null;
  const id = text(r.id);
  const label = text(r.label);
  const owner = text(r.owner);
  const ruleOwner = text(r.ruleOwner);
  const deletion = text(r.deletion);
  const recovery = text(r.recovery);
  const exportRule = record(r.export);
  const held = record(r.held);
  if (!id || !label || !owner || !ruleOwner || !deletion || !recovery || !exportRule || typeof r.enabled !== 'boolean') return null;
  if (r.retention !== 'until-owner-deletes' && r.retention !== 'unknown') return null;
  if (r.access !== 'main-process-only' && r.access !== 'runtime') return null;
  const location = r.location === 'os-credential-store' ? 'os-credential-store' : 'files';
  const mode = exportRule.mode;
  if (mode !== 'included' && mode !== 'excluded' && mode !== 'unknown') return null;
  const reason = text(exportRule.reason);
  return {
    id,
    label,
    enabled: r.enabled,
    location,
    owner,
    ruleOwner,
    retention: r.retention,
    access: r.access,
    export: reason ? { mode, reason } : { mode },
    deletion,
    recovery,
    held: { files: count(held?.files), bytes: count(held?.bytes) },
  };
}

export function parseDataPolicy(value: unknown): DataPolicyView | null {
  const r = record(value);
  if (!r || typeof r.loaded !== 'boolean') return null;
  const categories = list(r.categories).map(parseCategory);
  if (categories.some((category) => category === null)) return null;
  const blockers: DataBlockerView[] = [];
  for (const item of list(r.blockers)) {
    const b = record(item);
    const kind = text(b?.kind);
    const detail = text(b?.detail);
    if (!b || !kind || !detail) return null;
    const blocker: DataBlockerView = { kind, detail };
    const category = text(b.category);
    const path = text(b.path);
    if (category) blocker.category = category;
    if (path) blocker.path = path;
    blockers.push(blocker);
  }
  return { loaded: r.loaded, policyOwner: text(r.policyOwner), notice: text(r.notice), categories: categories as DataCategoryView[], blockers };
}

export interface DataActionView {
  ok: boolean;
  reason?: string;
  /** Plain-text lines that report what happened. */
  lines: string[];
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Turns an export, import or delete result into report lines; null when the result is malformed. */
export function parseDataAction(value: unknown, action: 'export' | 'import' | 'delete'): DataActionView | null {
  const r = record(value);
  if (!r || typeof r.ok !== 'boolean') return null;
  if (!r.ok) return { ok: false, reason: text(r.reason) ?? 'The request did not complete.', lines: [] };
  const report = record(r[action]);
  if (!report) return null;
  const lines: string[] = [];
  const omissions = list(report.omissions).map(record).filter((o): o is Record<string, unknown> => o !== null);
  if (action === 'export') {
    lines.push(`Exported to ${text(report.path) ?? 'the chosen folder'}.`);
    for (const entry of list(report.included).map(record)) if (entry) lines.push(`Included: ${text(entry.label) ?? '?'} (${plural(count(entry.files), 'file')}).`);
    for (const o of omissions) lines.push(`Omitted: ${text(o.label) ?? '?'}: ${text(o.reason) ?? ''}`);
    const notice = text(report.notice);
    if (notice) lines.push(notice);
  } else if (action === 'import') {
    for (const entry of list(report.restored).map(record)) if (entry) lines.push(`Restored: ${text(entry.label) ?? '?'} (${plural(count(entry.files), 'file')}).`);
    for (const entry of list(report.notRestored).map(record)) if (entry) lines.push(`Not restored: ${text(entry.path) ?? '?'}: ${text(entry.reason) ?? ''}`);
    for (const o of omissions) lines.push(`Not in the export: ${text(o.label) ?? '?'}: ${text(o.reason) ?? ''}`);
  } else {
    for (const entry of list(report.removed).map(record)) {
      if (!entry) continue;
      const remaining = count(entry.filesRemaining);
      const note = text(entry.note);
      lines.push(`Removed: ${text(entry.label) ?? '?'} (${plural(count(entry.filesRemoved), 'file')}${remaining > 0 ? `, ${remaining} remaining` : ''}).${note ? ` ${note}` : ''}`);
    }
    for (const entry of list(report.retained).map(record)) if (entry) lines.push(`Retained: ${text(entry.label) ?? '?'} (${plural(count(entry.files), 'file')}).`);
    for (const entry of list(report.survivingExports).map(record)) {
      if (entry) lines.push(`Exported copy outside Inquello's control, not deleted: ${text(entry.path) ?? '?'} (${text(entry.exportedAt) ?? ''}).`);
    }
  }
  return { ok: true, lines };
}

// ---- provider credentials (Story 1.13) -------------------------------------------

export type ClaudeKeyStateView = 'not-configured' | 'stored-unverified' | 'verified' | 'rejected' | 'unreachable';
export type CodexStateView = 'unavailable' | 'not-connected' | 'connecting' | 'connected';
export type CodexAccountKind = { type: 'apiKey' } | { type: 'chatgpt'; planType: string | null } | { type: 'other' };

export interface RouteAuthorizationView {
  authorized: boolean;
  reason: string;
}

export interface ProviderStatusView {
  claude: { state: ClaudeKeyStateView; storage: 'os-backed' | 'memory-only' };
  codex: { state: CodexStateView; account: CodexAccountKind | null; credentialStore: 'os-keyring'; reason?: string };
  routes: { 'claude-api-key': RouteAuthorizationView; 'codex-inherited': RouteAuthorizationView };
}

export interface ProviderActionView {
  ok: boolean;
  reason?: string;
  status: ProviderStatusView | null;
}

export interface ProviderBridge {
  getStatus(): Promise<unknown>;
  setClaudeKey(key: string): Promise<unknown>;
  verifyClaudeKey(): Promise<unknown>;
  removeClaudeKey(): Promise<unknown>;
  codexLogin(request: { type: 'apiKey'; apiKey: string } | { type: 'chatgpt' }): Promise<unknown>;
  codexLogout(): Promise<unknown>;
}

/** The provider operations, or null outside the desktop. */
export function providerBridge(): ProviderBridge | null {
  const bridge = (globalThis as { inquello?: { provider?: ProviderBridge } }).inquello;
  return bridge?.provider ?? null;
}

const CLAUDE_STATES: readonly ClaudeKeyStateView[] = ['not-configured', 'stored-unverified', 'verified', 'rejected', 'unreachable'];
const CODEX_STATES: readonly CodexStateView[] = ['unavailable', 'not-connected', 'connecting', 'connected'];

function parseRoute(value: unknown): RouteAuthorizationView | null {
  const r = record(value);
  const reason = text(r?.reason);
  if (!r || typeof r.authorized !== 'boolean' || !reason) return null;
  return { authorized: r.authorized, reason };
}

export function parseProviderStatus(value: unknown): ProviderStatusView | null {
  const r = record(value);
  const claude = record(r?.claude);
  const codex = record(r?.codex);
  const routes = record(r?.routes);
  if (!r || !claude || !codex || !routes) return null;
  if (!CLAUDE_STATES.includes(claude.state as ClaudeKeyStateView)) return null;
  if (claude.storage !== 'os-backed' && claude.storage !== 'memory-only') return null;
  if (!CODEX_STATES.includes(codex.state as CodexStateView) || codex.credentialStore !== 'os-keyring') return null;
  let account: CodexAccountKind | null = null;
  const rawAccount = record(codex.account);
  if (rawAccount?.type === 'apiKey') account = { type: 'apiKey' };
  else if (rawAccount?.type === 'chatgpt') account = { type: 'chatgpt', planType: text(rawAccount.planType) };
  else if (rawAccount) account = { type: 'other' };
  const claudeRoute = parseRoute(routes['claude-api-key']);
  const codexRoute = parseRoute(routes['codex-inherited']);
  if (!claudeRoute || !codexRoute) return null;
  const reason = text(codex.reason);
  return {
    claude: { state: claude.state as ClaudeKeyStateView, storage: claude.storage },
    codex: { state: codex.state as CodexStateView, account, credentialStore: 'os-keyring', ...(reason ? { reason } : {}) },
    routes: { 'claude-api-key': claudeRoute, 'codex-inherited': codexRoute },
  };
}

export function parseProviderAction(value: unknown): ProviderActionView | null {
  const r = record(value);
  if (!r || typeof r.ok !== 'boolean') return null;
  const reason = text(r.reason);
  return { ok: r.ok, ...(reason ? { reason } : {}), status: parseProviderStatus(r.status) };
}
