import type { PolicyView } from '../policy/views';
import type { CapabilityEntry } from './types';
/** Runtime-owned facts, not supplied by the renderer. */
export interface CapabilityFact extends Omit<CapabilityEntry, 'callable_now' | 'reason_not_callable' | 'effective_permission' | 'next_action'> {
    host?: string;
    extensionOwned?: boolean;
    stateUnknown?: boolean;
    local?: boolean;
    connection?: 'connected' | 'not-connected' | 'expired' | 'revoked' | 'unknown';
    unavailable?: string;
    dependencyRefs?: { kind: 'app' | 'mcp_server' | 'unknown'; id: string }[];
}
export function hostAllowed(host: string, domains: readonly string[]): boolean {
    const name = host.toLowerCase();
    return domains.some(pattern => pattern.startsWith('**.') ? name === pattern.slice(3) || name.endsWith('.' + pattern.slice(3)) : pattern.startsWith('*.') ? name.endsWith('.' + pattern.slice(2)) : name === pattern);
}
export function policyRefusal(kind: CapabilityEntry['kind'], policy: PolicyView): string | null {
    if (kind === 'built_in')
        return null;
    const key = kind === 'plugin' || kind === 'skill' ? 'extensions' : 'mcp_tools';
    const setting = policy.settings.find(x => x.name === key);
    return setting?.value === 'allowed' ? null : `Blocked by Workspace policy (${key === 'mcp_tools' ? 'tools' : 'extensions'} not allowed) — ${setting?.sourceLabel ?? 'Inquello default'}`;
}
function factPolicyRefusal(fact: CapabilityFact, policy: PolicyView): string | null {
    return (fact.kind === 'built_in' && fact.id === 'write' && policy.settings.some(x => x.name === 'sandbox' && x.value === 'read_only') ? 'Blocked by Workspace policy (read-only sandbox)' : null)
        ?? policyRefusal(fact.kind, policy)
        ?? (fact.extensionOwned ? policyRefusal('plugin', policy) : null)
        ?? (fact.local && policy.settings.find(x => String(x.name) === 'allow_local_mcp_servers')?.value !== 'allowed' ? 'Blocked by Workspace policy (execution.allow_local_mcp_servers is false)' : null)
        ?? (fact.host && !hostAllowed(fact.host, policy.reach.domains) ? `Host ${fact.host} is not on this Workspace's allowed list` : null);
}
export function entryFromFact(fact: CapabilityFact, all: CapabilityFact[], policy: PolicyView): CapabilityEntry {
    let blocked = factPolicyRefusal(fact, policy);
    let dependencyReason: string | null = null;
    for (const ref of fact.dependencyRefs ?? []) {
        const matches = all.filter(x => x.id === ref.id && x.kind === ref.kind);
        const dep = matches.length === 1 ? matches[0] : undefined;
        if (!dep) { dependencyReason ??= `Needs connection: ${ref.id} (exact ${ref.kind} identity unavailable; no fallback used)`; continue; }
        blocked ??= factPolicyRefusal(dep, policy);
        if (!dep.installed || !dep.enabled || dep.connection !== 'connected' || dep.unavailable)
            dependencyReason ??= dep.connection === 'expired' ? `Connection expired — sign in again: ${dep.display_name}` : dep.connection === 'revoked' ? `Connection revoked — remove: ${dep.display_name}` : dep.unavailable ?? `Needs connection: ${dep.display_name} (not signed in)`;
    }
    const reason = blocked
        ?? (fact.stateUnknown ? fact.unavailable ?? 'Runtime state unavailable' : null)
        ?? (!fact.installed ? 'Available — not installed' : null)
        ?? (!fact.enabled ? 'Disabled by you' : null)
        ?? (fact.connection === 'expired' ? 'Connection expired — sign in again' : fact.connection === 'revoked' ? 'Connection revoked — remove or sign in again' : null)
        ?? (fact.connection === 'not-connected' ? `Needs connection: ${fact.display_name} (not signed in)` : null)
        ?? (fact.connection === 'unknown' ? fact.unavailable ?? 'Connection state unavailable' : null)
        ?? dependencyReason ?? fact.unavailable ?? null;
    const guidance = blocked ? 'Ask a Workspace administrator to review the named policy rule'
        : fact.connection === 'expired' ? 'Sign in again'
        : fact.connection === 'revoked' ? 'Remove'
        : fact.unavailable?.includes('sandbox') ? 'Open a Task to check the local sandbox; refresh after resolving the reported limit'
        : dependencyReason ? 'Review and connect the exact required dependency; refresh to verify'
        : fact.connection === 'unknown' || fact.unavailable ? 'Refresh runtime status; resolve the reported missing evidence before use'
        : !fact.installed ? 'Install' : !fact.enabled ? 'Enable' : fact.connection === 'not-connected' ? 'Connect' : null;
    return {
        kind: fact.kind, id: fact.id, display_name: fact.display_name, source: fact.source, version: fact.version,
        requires_local_confirmation: fact.requires_local_confirmation,
        state_known: !fact.stateUnknown,
        dependencies: fact.dependencies, installed: fact.installed, enabled: fact.enabled,
        callable_now: !reason, reason_not_callable: reason,
        effective_permission: blocked ?? 'Allowed by effective Workspace policy',
        next_action: guidance, actions: fact.actions,
    };
}
