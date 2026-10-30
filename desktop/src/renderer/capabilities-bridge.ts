/** Credential-free, fail-closed renderer projection of the main inventory. */
export const KINDS = ['built_in', 'app', 'mcp_server', 'plugin', 'skill'] as const;
export type CapabilityKind = typeof KINDS[number];
export const ACTIONS = ['install', 'uninstall', 'enable', 'disable', 'connect', 'cancel', 'remove'] as const;
export type CapabilityAction = typeof ACTIONS[number];
export interface InventoryEntry {
  kind: CapabilityKind; id: string; display_name: string; source: string; version: string | null;
  requires_local_confirmation?: boolean;
  state_known?: boolean;
  dependencies: string[]; installed: boolean; enabled: boolean; callable_now: boolean;
  reason_not_callable: string | null; effective_permission: string; next_action: string | null;
  actions: CapabilityAction[];
}
export interface Inventory {
  workspaceId: string; refreshedAt: string | null; stale: boolean; available: boolean; reason: string | null;
  entries: InventoryEntry[];
  provider: { provider: string; accountType: string; effectiveRoute: string; limits: string[] };
}
export interface CapabilityRequest {
  workspaceId: string; action: CapabilityAction | 'add'; kind: CapabilityKind; id: string;
  url?: string; command?: string; args?: string[]; confirmation?: string;
}
export interface CapabilitiesBridge {
  getInventory(request: { workspaceId: string }): Promise<unknown>;
  manage(request: CapabilityRequest): Promise<unknown>;
  onChanged?(listener: () => void): () => void;
}
export function capabilitiesBridge(): CapabilitiesBridge | null {
  return (globalThis as { inquello?: { capabilities?: CapabilitiesBridge } }).inquello?.capabilities ?? null;
}
const record = (v: unknown): Record<string, unknown> | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : null;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string';
export function parseInventory(value: unknown): Inventory | null {
  const r = record(value), provider = record(r?.provider);
  if (!r || typeof r.workspaceId !== 'string' || !nullableText(r.refreshedAt) || typeof r.stale !== 'boolean' || typeof r.available !== 'boolean' || !nullableText(r.reason) || !Array.isArray(r.entries)) return null;
  if (!provider || typeof provider.provider !== 'string' || typeof provider.accountType !== 'string' || typeof provider.effectiveRoute !== 'string' || !strings(provider.limits)) return null;
  const entries: InventoryEntry[] = [];
  for (const value of r.entries) {
    const e = record(value);
    if (!e || !KINDS.includes(e.kind as CapabilityKind) || typeof e.id !== 'string' || typeof e.display_name !== 'string' || typeof e.source !== 'string' || !nullableText(e.version) || !strings(e.dependencies) || typeof e.installed !== 'boolean' || typeof e.enabled !== 'boolean' || typeof e.callable_now !== 'boolean' || !nullableText(e.reason_not_callable) || typeof e.effective_permission !== 'string' || !nullableText(e.next_action) || !strings(e.actions) || !e.actions.every(a => ACTIONS.includes(a as CapabilityAction))) return null;
    if (e.state_known !== undefined && typeof e.state_known !== 'boolean') return null;
    if (e.callable_now && (e.state_known === false || !e.installed || !e.enabled || e.reason_not_callable !== null)) return null;
    entries.push({kind: e.kind as CapabilityKind, id:e.id, display_name:e.display_name, source:e.source, version:e.version, requires_local_confirmation:e.requires_local_confirmation === true, state_known:e.state_known !== false, dependencies:[...e.dependencies], installed:e.installed, enabled:e.enabled, callable_now:e.callable_now, reason_not_callable:e.reason_not_callable, effective_permission:e.effective_permission, next_action:e.next_action, actions:e.actions as CapabilityAction[]});
  }
  return { workspaceId:r.workspaceId, refreshedAt:r.refreshedAt, stale:r.stale, available:r.available, reason:r.reason, entries, provider:{provider:provider.provider, accountType:provider.accountType, effectiveRoute:provider.effectiveRoute, limits:[...provider.limits]} };
}
