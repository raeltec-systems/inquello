/** Credential-free S07 projection. Raw runtime/config responses never cross IPC. */
export type CapabilityKind = 'built_in' | 'app' | 'mcp_server' | 'plugin' | 'skill';
export type CapabilityAction = 'install' | 'uninstall' | 'enable' | 'disable' | 'connect' | 'cancel' | 'remove';
export interface CapabilityEntry {
    kind: CapabilityKind;
    id: string;
    display_name: string;
    source: string;
    version: string;
    requires_local_confirmation?: boolean;
    dependencies: string[];
    /** False when runtime source state could not be read; booleans are not evidence. */
    state_known?: boolean;
    installed: boolean;
    enabled: boolean;
    callable_now: boolean;
    reason_not_callable: string | null;
    effective_permission: string;
    next_action: string | null;
    actions: CapabilityAction[];
}
export interface CapabilityInventory {
    workspaceId: string;
    refreshedAt: string | null;
    stale: boolean;
    available: boolean;
    reason: string | null;
    entries: CapabilityEntry[];
    provider: {
        provider: string;
        accountType: string;
        effectiveRoute: string;
        limits: string[];
    };
}
export interface CapabilityInput {
    workspaceId: string;
    action: CapabilityAction | 'add';
    kind: CapabilityKind;
    id: string;
    url?: string;
    command?: string;
    args?: string[];
    confirmation?: string;
}
export interface CapabilityResult {
    ok: boolean;
    reason: string | null;
    inventory: CapabilityInventory;
}
export const LOCAL_MCP_CONFIRMATION = 'This program runs on this device outside the Task sandbox.';
export function inventoryPayload(args: readonly unknown[]): {
    workspaceId: string;
} {
    const x = plain(args);
    if (Object.keys(x).join() !== 'workspaceId' || !identifier(x.workspaceId))
        throw new Error('invalid workspace');
    return { workspaceId: x.workspaceId };
}
function plain(args: readonly unknown[]): Record<string, unknown> {
    const x = args[0];
    if (args.length !== 1 || !x || typeof x !== 'object' || Array.isArray(x) || ![Object.prototype, null].includes(Object.getPrototypeOf(x)))
        throw new Error('expected one plain object');
    return x as Record<string, unknown>;
}
function identifier(x: unknown): x is string { return typeof x === 'string' && x.length > 0 && x.length <= 300 && !/[\x00-\x1f\x7f]/.test(x); }
export function capabilityPayload(args: readonly unknown[]): CapabilityInput {
    const x = plain(args);
    if (!identifier(x.workspaceId) || !identifier(x.id) || !['built_in', 'app', 'mcp_server', 'plugin', 'skill'].includes(String(x.kind)) || !['install', 'uninstall', 'enable', 'disable', 'connect', 'cancel', 'remove', 'add'].includes(String(x.action)))
        throw new Error('invalid capability action');
    const allowed = x.action === 'add' ? ['workspaceId', 'action', 'kind', 'id', 'url', 'command', 'args', 'confirmation'] : x.kind === 'plugin' && ['install','enable'].includes(String(x.action)) ? ['workspaceId','action','kind','id','confirmation'] : ['workspaceId', 'action', 'kind', 'id'];
    if (Object.keys(x).some(k => !allowed.includes(k)))
        throw new Error('unknown field');
    if (x.confirmation !== undefined && x.confirmation !== LOCAL_MCP_CONFIRMATION) throw new Error('invalid local execution confirmation');
    if (x.action === 'add') {
        if (x.kind !== 'mcp_server' || !/^[a-zA-Z0-9_-]{1,80}$/.test(x.id))
            throw new Error('invalid server name');
        if ((x.url === undefined) === (x.command === undefined))
            throw new Error('choose remote URL or local command');
        for (const k of ['url', 'command', 'confirmation'])
            if (x[k] !== undefined && !identifier(x[k]))
                throw new Error('invalid server field');
        if (x.args !== undefined && (!Array.isArray(x.args) || x.args.length > 64 || !x.args.every(identifier)))
            throw new Error('invalid arguments');
        if (x.url !== undefined) {
            const u = new URL(String(x.url));
            if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || x.args !== undefined)
                throw new Error('invalid remote URL');
        }
    }
    return x as unknown as CapabilityInput;
}
